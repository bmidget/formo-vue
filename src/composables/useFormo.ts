import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  onMounted,
  markRaw,
  reactive,
  shallowReactive,
  shallowRef,
  toValue,
  watch,
  type Component,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { FormContextKey, useForm } from 'vee-validate'
import type {
  FormoOutcome,
  FormoOutcomeHandlers,
  FormoController,
  FormoDefinition,
  FormoArrayBinding,
  FormoErrorsInput,
  FormoFieldsOfDefinition,
  FormoOptions,
  FormoPart,
  FormoRequestOptions,
  FormoResolvedOptions,
  FormoResponse,
  FormoSubmitContext,
  RegisteredNode,
} from '../types'
import { normalize } from '../core/normalize'
import { buildInitialValues, filterValues } from '../core/values'
import { deepClone, deepEqual, deepMerge, getPath, humanize, interpolate, isPlainObject, joinPath, setPath, toSegments, unsetPath } from '../core/utils'
import { evaluateCondition, isActive } from '../core/conditions'
import { isExcludedByRules, runRules } from '../core/rules'
import { sendRequest } from '../http/request'
import { activeLocale, getTranslator } from '../i18n/translator'
import { applyLayer, baseOptions, FormoGlobalKey } from './context'
import FormoRender from '../components/FormoRender'
import { createHandles } from './handles'

/** A FormoResponse (what `request()` resolves to) */
function isResponse(value: unknown): value is FormoResponse {
  return !!value && typeof value === 'object' && typeof (value as FormoResponse).ok === 'boolean' && typeof (value as FormoResponse).status === 'number' && 'response' in value
}

/** Call the handler matching an outcome, then `onSettled` */
export async function dispatchOutcome(handlers: FormoOutcomeHandlers, outcome: FormoOutcome): Promise<void> {
  if (outcome.result === 'success') await handlers.onSuccess?.(outcome.data, outcome)
  else if (outcome.result === 'invalid') await handlers.onInvalid?.(outcome.errors, outcome)
  else await handlers.onRejected?.(outcome)
  await handlers.onSettled?.(outcome)
}

export interface UseFormoOptions extends FormoOptions, FormoOutcomeHandlers {
  /**
   * Values merged over the definition's `val`s. Can be a ref or a getter
   * (`() => props.user`): when they change, the fields not changed in the form
   * follow — see "Values from outside" in the README.
   */
  initialValues?: MaybeRefOrGetter<Record<string, any> | undefined>
  /**
   * Errors to show from the start — what the server rendered into the page after
   * a failed native post (JavaScript off), or Inertia's `errors` prop. Flat
   * (`{ 'phones.0.number': ['…'] }`, Laravel / Inertia keys work) or nested. Set
   * once the fields are mounted; like any error, they clear when the field is validated again.
   */
  errors?: FormoErrorsInput
}

/** `':self'` / `'address.:self'` → `''` / `'address'` */
function normalizeErrorPath(path: string): string {
  if (path === ':self') return ''
  return path.replace(/\.?:self$/, '')
}

/** Flatten Formo-style nested errors `{ address: { street: '...', ':self': '...' } }` */
function flattenErrors(input: Record<string, any>, prefix = '', out: Record<string, string | string[] | undefined> = {}) {
  for (const [key, value] of Object.entries(input)) {
    const path = key === ':self' ? prefix : prefix ? `${prefix}.${key}` : key
    if (isPlainObject(value)) flattenErrors(value, path, out)
    else out[normalizeErrorPath(path)] = value as string | string[] | undefined
  }
  return out
}

function depth(path: string) {
  return path === '' ? 0 : toSegments(path).length
}

function isUnder(path: string, parent: string) {
  if (parent === '') return true
  return path === parent || path.startsWith(`${parent}.`) || path.startsWith(`${parent}[`)
}

/**
 * Create a Formo form controller — the runtime counterpart of a Formo object.
 *
 * ```ts
 * const form = useFormo(Formo.form('login').add('username', { required: true }))
 * // <FormoForm :form="form" @submit="save" />
 * form.val('username')            // get
 * form.val('username', 'ben')     // set
 * form.load({ username: 'ben' })  // Formo load()
 * await form.validate()           // Formo validate()
 * form.errors                     // Formo errors()
 * ```
 *
 * Must be called inside `setup()`. `<FormoForm>` calls it for you when you pass
 * it a plain definition.
 */
export function useFormo<D extends FormoDefinition>(
  definition: MaybeRefOrGetter<D>,
  options: UseFormoOptions = {},
): FormoController<FormoFieldsOfDefinition<D>> {
  const global = inject(FormoGlobalKey, null)

  const baseResolved = computed<FormoResolvedOptions>(() => applyLayer(baseOptions(global), options))

  const root = computed(() => {
    const def = toValue(definition)
    // Builders expose a reactive version so mutations (form.add(...)) re-render
    ;(def as any)?.version?.value
    return normalize(def, { drivers: baseResolved.value.drivers })
  })

  /** Options after the root node's own `components` / `config` / `theme` */
  const resolved: ComputedRef<FormoResolvedOptions> = computed(() =>
    applyLayer(baseResolved.value, { components: root.value.components, config: root.value.config, theme: root.value.theme }),
  )

  const handles = createHandles(() => controller)

  const initialValues = computed(() =>
    deepMerge(
      buildInitialValues(root.value, resolved.value.drivers, resolved.value.config),
      deepClone(toValue(options.initialValues) ?? {}),
    ),
  )

  const vee = useForm<Record<string, any>>({
    initialValues: deepClone(initialValues.value),
    keepValuesOnUnmount: computed(() => resolved.value.config.keepValuesOnUnmount),
  })
  // useForm() provides its *private* context (field arrays need it; the returned one has
  // readonly values). Keep a handle so <FormoForm> can re-provide the right one even when
  // several controllers are created in the same component.
  const veePrivate = (getCurrentInstance() as any)?.provides?.[FormContextKey as symbol] ?? vee

  /**
   * Options from the rendering <FormoForm> (its :config / :rules / :components props
   * layered over ours) — so request(), group rules and messages see the same
   * options as the fields do.
   */
  const renderedOptions = shallowRef<(() => FormoResolvedOptions) | null>(null)
  const active = () => renderedOptions.value?.() ?? resolved.value

  /** Errors attached to groups / the form itself (`''`), and to paths without a field */
  const groupErrors = reactive<Record<string, string>>({})
  const registry = shallowReactive(new Map<string, RegisteredNode>())
  /** Paths placed by hand with <FormoRender> */
  const claimed = shallowReactive(new Set<string>())
  const renderCache = new Map<string, Component>()
  const registrations = new Map<string, RegisteredNode[]>()
  /** Mounted repeatable groups (their field arrays): handles add / remove rows through them, and read their keys */
  const arrays = shallowReactive(new Map<string, FormoArrayBinding>())
  const submitHandlers: Array<(values: Record<string, any>, ctx: FormoSubmitContext) => unknown> = []
  const invalidHandlers: Array<(errors: Record<string, string>) => unknown> = []
  const outcomeHandlers: Array<(outcome: FormoOutcome) => unknown> = []
  if (options.onSuccess || options.onInvalid || options.onRejected || options.onSettled) {
    outcomeHandlers.push((outcome) => dispatchOutcome(options, outcome))
  }
  const lastOutcome = shallowRef<FormoOutcome>()
  /** The submit in flight: a second click gets the same promise (no double posts) */
  let inflight: Promise<boolean> | null = null
  /** The last response of a request made while submitting (ctx.request(), form.request()) */
  let submitResponse: FormoResponse | undefined
  let callbackFailed = false

  const flatErrors = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const [path, message] of Object.entries(vee.errors.value)) if (message) out[path] = message
    for (const [path, message] of Object.entries(groupErrors)) if (message) out[path] = message
    return out
  })

  const nestedErrors = computed(() => {
    const out: Record<string, any> = {}
    for (const [path, message] of Object.entries(flatErrors.value)) {
      const isGroup = path === '' || registry.get(path)?.kind !== 'field' && registry.has(path)
      if (isGroup) setPath(out, path === '' ? [':self'] : [...toSegments(path), ':self'], message)
      else setPath(out, path, message)
    }
    return out
  })

  function labelFor(pathOrAlias: string): string {
    const entry = registry.get(pathOrAlias) ?? controller.find(pathOrAlias)
    if (entry) return entry.label()
    const segs = toSegments(pathOrAlias)
    return humanize(segs[segs.length - 1] ?? pathOrAlias)
  }

  /**
   * A server's error key → the form path. Laravel / Inertia / Rails send
   * `phones.0.number` (and `user.email` with a root key); Formo's paths are
   * `phones[0].number`. A path the form has, as written, always wins.
   */
  function toFormPath(path: string): string {
    const p = normalizeErrorPath(path)
    if (p === '' || registry.has(p)) return p
    let segments = toSegments(p)
    const rootKey = active().config.request.rootKey
    if (rootKey && segments.length > 1 && segments[0] === rootKey) segments = segments.slice(1)
    return segments.reduce<string>((acc, segment) => joinPath(acc, segment), '')
  }

  function setError(path: string, message: string | string[] | undefined) {
    const p = toFormPath(path)
    const entry = registry.get(p)
    const msg = Array.isArray(message) ? message[0] : message
    if (entry?.kind === 'field') {
      vee.setFieldError(p, message)
      return
    }
    if (entry || p === '') {
      if (msg) groupErrors[p] = msg
      else delete groupErrors[p]
      return
    }
    // Not rendered (yet): vee keeps it in its "extra errors" bag
    vee.setFieldError(p, message)
  }

  function formMessage(key: string, params: Record<string, unknown> = {}) {
    return getTranslator(active().config).message([key], params) ?? interpolate(key, params)
  }

  /** 422 → field errors (unknown fields → form error), 419 → session expired, others → generic */
  function mapResponseErrors(response: FormoResponse) {
    if (response.status === 422 && response.errors) {
      const unmatched: string[] = []
      for (const [path, messages] of Object.entries(response.errors)) {
        if (registry.has(path)) setError(path, messages)
        else unmatched.push(messages[0])
      }
      if (unmatched.length) setError('', unmatched[0])
      return
    }
    if (response.status === 419) {
      setError('', formMessage('csrf_mismatch'))
      return
    }
    const serverMessage = response.data && typeof response.data === 'object' ? response.data.message : undefined
    setError('', typeof serverMessage === 'string' && serverMessage && response.status < 500
      ? serverMessage
      : formMessage('request_failed', { status: response.status }))
  }

  /* ---- ignore / exclude ------------------------------------------------ */

  function valueContext(entry: RegisteredNode) {
    const parentValues = entry.parentPath ? (getPath(vee.values, entry.parentPath) ?? {}) : vee.values
    return { values: vee.values, parentValues, node: entry.node, path: entry.path }
  }

  /** `ignores: 'shipping'` is relative to the declaring field's group, else an absolute path */
  function resolveTarget(entry: RegisteredNode, target: string) {
    const relative = entry.groupPath ? `${entry.groupPath}.${target}` : target
    const byValue = entry.parentPath ? `${entry.parentPath}.${target}` : target
    if (registry.has(relative)) return relative
    if (registry.has(byValue)) return byValue
    return target
  }

  /** Paths ignored / excluded by their own condition, by `exclude_*` rules, or by another field's `ignores` */
  const directlyIgnored = computed(() => {
    const ignored = new Set<string>()
    const excluded = new Set<string>()
    for (const entry of registry.values()) {
      const ctx = valueContext(entry)
      if (evaluateCondition(entry.node.ignore, ctx)) ignored.add(entry.path)
      if (evaluateCondition(entry.node.exclude, ctx) || (entry.kind === 'field' && isExcludedByRules(entry.node.rules, ctx))) {
        ignored.add(entry.path)
        excluded.add(entry.path)
      }
      if ((entry.node.ignores.length || entry.node.excludes.length) && isActive(getPath(vee.values, entry.path))) {
        for (const t of entry.node.ignores) ignored.add(resolveTarget(entry, t))
        for (const t of entry.node.excludes) {
          ignored.add(resolveTarget(entry, t))
          excluded.add(resolveTarget(entry, t))
        }
      }
    }
    return { ignored, excluded }
  })

  /** Walks up the containing groups: ignoring a subform ignores everything inside it */
  function inheritedFrom(path: string, set: Set<string>): boolean {
    let current: string | undefined = normalizeErrorPath(path)
    const seen = new Set<string>()
    while (current !== undefined && !seen.has(current)) {
      if (set.has(current)) return true
      seen.add(current)
      current = registry.get(current)?.groupPath
    }
    return false
  }

  const isIgnored = (path: string) => inheritedFrom(path, directlyIgnored.value.ignored)
  const isExcluded = (path: string) => inheritedFrom(path, directlyIgnored.value.excluded)

  /** Run group/form-level rules for groups whose fields all passed */
  async function runGroupRules() {
    const { config, rules } = active()
    const groups = [...registry.values()]
      .filter((e) => e.kind !== 'field' && e.node.rules.length && !isIgnored(e.path))
      .sort((a, b) => depth(b.path) - depth(a.path))

    for (const entry of groups) {
      const childFailed = Object.keys(flatErrors.value).some((p) => p !== entry.path && isUnder(p, entry.path))
      if (childFailed) continue
      const valuePath = entry.valuePath ?? entry.path
      const value = valuePath === '' ? vee.values : getPath(vee.values, valuePath)
      const parentValues = entry.parentPath === '' ? vee.values : getPath(vee.values, entry.parentPath) ?? {}
      const errors = await runRules(
        entry.node.rules,
        value,
        {
          node: entry.node,
          path: entry.path,
          alias: entry.node.alias,
          label: entry.label(),
          values: vee.values,
          parentValues,
          form: controller,
        },
        { rules, config, labelFor },
      )
      if (errors.length) groupErrors[entry.path] = errors[0]
    }
  }

  /** Formo callbacks: `pass` / `fail` run for every field and group, deepest first */
  async function runCallbacks() {
    const entries = [...registry.values()]
      .filter((e) => (e.node.callbacks.pass.length || e.node.callbacks.fail.length) && !isIgnored(e.path))
      .sort((a, b) => depth(b.path) - depth(a.path))

    for (const entry of entries) {
      const failed = Object.keys(flatErrors.value).some((p) => isUnder(p, entry.path))
      const list = failed ? entry.node.callbacks.fail : entry.node.callbacks.pass
      for (const callback of list) {
        const result = await callback({
          node: entry.node,
          path: entry.path,
          value: (entry.valuePath ?? entry.path) === '' ? vee.values : getPath(vee.values, entry.valuePath ?? entry.path),
          values: vee.values,
          form: controller,
          setError: (message: string) => setError(entry.path, message),
        })
        if (!failed && (result === false || typeof result === 'string')) {
          callbackFailed = true
          if (typeof result === 'string') setError(entry.path, result)
        }
      }
    }
  }

  function clearGroupErrors() {
    for (const key of Object.keys(groupErrors)) delete groupErrors[key]
  }

  // Locale switched: errors already on screen are strings — re-run validation to re-translate them
  watch(
    () => activeLocale(active().config),
    async () => {
      if (!Object.keys(flatErrors.value).length) return
      await vee.validate({ mode: 'validated-only' })
      if (Object.keys(groupErrors).length) {
        clearGroupErrors()
        await runGroupRules()
      }
    },
  )

  async function validate(): Promise<boolean> {
    clearGroupErrors()
    callbackFailed = false
    const result = await vee.validate()
    await runGroupRules()
    await runCallbacks()
    return result.valid && !callbackFailed && Object.keys(flatErrors.value).length === 0
  }

  /**
   * Validate, run the handler(s), and work out how it ended — from what happened,
   * not just from what the handler returned (first match wins):
   *
   *  1. the handler threw                                 → rejected (`error`), a form-level message
   *  2. it called `ctx.reject()`                          → rejected (`validation` with errors, else `handler`)
   *  3. a request made meanwhile / returned didn't succeed → rejected (`validation` 422, `session` 419, `server`)
   *  4. errors were set meanwhile (`setErrors`)           → rejected (`validation`)
   *  5. it returned `false`                               → rejected (`handler`)
   *  6. otherwise                                         → success (the response's data, or what it returned)
   *
   * Callback-style APIs (Inertia's router): return a promise that settles when they do.
   */
  async function runSubmit(
    handler: ((values: Record<string, any>, ctx: FormoSubmitContext) => unknown) | undefined,
    event: Event | undefined,
  ): Promise<FormoOutcome> {
    if (!(await validate())) {
      const errors = { ...flatErrors.value }
      for (const h of invalidHandlers) await h(errors)
      return { result: 'invalid', errors }
    }

    const values = controller.getValues()
    let rejected = false
    submitResponse = undefined
    const ctx: FormoSubmitContext = {
      event,
      setErrors: controller.setErrors,
      setError: controller.setError,
      reset: controller.reset,
      form: controller,
      request: (url, options) => controller.request(url, { values, ...options }),
      reject: (errors) => {
        rejected = true
        if (typeof errors === 'string') setError('', errors)
        else if (errors) controller.setErrors(errors)
      },
    }

    const returned: unknown[] = []
    try {
      if (handler) returned.push(await handler(values, ctx))
      else for (const h of submitHandlers) returned.push(await h(values, ctx))
    } catch (error) {
      if (!flatErrors.value['']) setError('', formMessage('submit_failed'))
      if (import.meta.env?.DEV) console.error('[formo] The submit handler threw:', error)
      return { result: 'rejected', reason: 'error', values, error, response: submitResponse, errors: { ...flatErrors.value } }
    }

    const response = (returned.find(isResponse) as FormoResponse | undefined) ?? submitResponse
    const errors = () => ({ ...flatErrors.value })
    const hasErrors = () => Object.keys(flatErrors.value).length > 0
    if (rejected) return { result: 'rejected', reason: hasErrors() ? 'validation' : 'handler', values, response, errors: errors() }
    if (response && !response.ok) {
      const reason = response.status === 422 ? 'validation' : response.status === 419 ? 'session' : 'server'
      return { result: 'rejected', reason, values, response, errors: errors() }
    }
    if (hasErrors()) return { result: 'rejected', reason: 'validation', values, response, errors: errors() }
    if (returned.includes(false)) return { result: 'rejected', reason: 'handler', values, response, errors: errors() }
    const data = response ? response.data : returned.find((r) => r !== undefined && r !== true)
    return { result: 'success', values, data, response, errors: {} }
  }

  /* ---- Values from outside ------------------------------------------------ */

  /**
   * The values from outside changed — `initialValues` as a ref / getter, or a
   * reactive definition (`() => Formo.fromModel(model, { values: props.user })`).
   * Fields not changed in the form follow; fields the user changed keep the
   * user's value. Either way the new values become the baseline (`dirty`, `reset()`).
   */
  function followOutside(next: Record<string, any>, previous: Record<string, any> | undefined, prefix: string, changed: string[]) {
    for (const key of Object.keys(next)) {
      const path = joinPath(prefix, key)
      const value = next[key]
      const before = previous?.[key]
      if (isPlainObject(value) && isPlainObject(before)) {
        followOutside(value, before, path, changed)
        continue
      }
      if (deepEqual(value, before)) continue
      const current = getPath(vee.values, path)
      const editedHere = current !== undefined && !deepEqual(current, before)
      if (!editedHere) {
        if (Array.isArray(value)) {
          // Lists (repeatable rows, checkboxes): setValues() merges and rebuilds vee's field arrays
          const partial: Record<string, any> = {}
          setPath(partial, path, deepClone(value))
          vee.setValues(partial, false)
        } else {
          vee.setFieldValue(path, deepClone(value), false)
        }
        changed.push(path)
      }
      ;(veePrivate as { setFieldInitialValue?: (path: string, value: unknown, updateOriginal?: boolean) => void })
        .setFieldInitialValue?.(path, deepClone(value), true)
    }
  }

  watch(initialValues, (next, previous) => {
    if (!previous || deepEqual(next, previous)) return
    const changed: string[] = []
    followOutside(next, previous, '', changed)
    // An error about the old value may not hold any more
    for (const path of changed) if (flatErrors.value[path]) void vee.validateField(path)
  })

  // A plain object: getters read computed refs so they stay reactive, and markRaw
  // keeps Vue from deep-proxying the vee-validate context when it's passed around.
  const controller: FormoController = markRaw({
    get alias() {
      return root.value.alias
    },
    get root() {
      return root.value
    },
    get fields() {
      return handles.root
    },
    field(pathOrAlias: string) {
      return handles.find(pathOrAlias)
    },
    vee: markRaw(vee),
    get values() {
      return vee.values
    },
    get flatErrors() {
      return flatErrors.value
    },
    get errors() {
      return nestedErrors.value
    },
    get allErrors() {
      const out: Record<string, string[]> = {}
      for (const [path, messages] of Object.entries(vee.errorBag.value)) if (messages?.length) out[path] = [...messages]
      for (const [path, message] of Object.entries(groupErrors)) if (message) out[path] = [message]
      return out
    },
    get valid() {
      return vee.meta.value.valid && Object.keys(groupErrors).length === 0
    },
    get dirty() {
      return vee.meta.value.dirty
    },
    get submitting() {
      return vee.isSubmitting.value
    },
    get submitCount() {
      return vee.submitCount.value
    },
    get outcome() {
      return lastOutcome.value
    },
    get options() {
      return active()
    },
    get _baseOptions() {
      return resolved.value
    },

    val(path?: string, ...rest: [unknown?, boolean?]): any {
      if (path === undefined || path === '') return vee.values
      if (rest.length === 0) return getPath(vee.values, path)
      vee.setFieldValue(path, rest[0], rest[1] ?? false)
    },

    load(values: Record<string, any>, shouldValidate = false) {
      vee.setValues(deepClone(values), shouldValidate)
    },

    getValues() {
      const { drivers, config } = active()
      const values = filterValues(root.value, vee.values, drivers, config)
      // exclude / excludes / exclude_if: drop those values (Laravel exclude_if)
      for (const entry of registry.values()) {
        if (entry.kind === 'form' || !isExcluded(entry.path)) continue
        if (entry.kind === 'field') unsetPath(values, entry.path)
        else if ((entry.valuePath ?? entry.path) === entry.path) unsetPath(values, entry.path)
      }
      return values
    },

    validate,

    async validateField(path: string) {
      const result = await vee.validateField(path)
      return result.valid
    },

    submit(eventOrHandler?: Event | ((values: Record<string, any>, ctx: FormoSubmitContext) => unknown)) {
      const handler = typeof eventOrHandler === 'function' ? eventOrHandler : undefined
      const event = typeof eventOrHandler === 'function' ? undefined : eventOrHandler
      event?.preventDefault?.()
      if (inflight) return inflight
      inflight = (async () => {
        vee.setTouched(true)
        vee.submitCount.value++
        vee.isSubmitting.value = true
        let outcome: FormoOutcome
        try {
          outcome = await runSubmit(handler, event)
        } finally {
          vee.isSubmitting.value = false
          inflight = null
        }
        lastOutcome.value = outcome
        for (const h of outcomeHandlers) await h(outcome)
        return outcome.result === 'success'
      })()
      return inflight
    },

    async request(url?: string, options: FormoRequestOptions = {}) {
      const { config } = active()
      const attr = root.value.attr
      const target = url ?? (attr.action as string | undefined)
      if (!target) throw new Error('[formo] request() needs a URL (or an `attr.action` on the form)')
      const { mapErrors = true, values, csrf, method, ...rest } = options

      const response = await sendRequest(target, {
        ...config.request,
        ...rest,
        headers: { ...config.request.headers, ...rest.headers },
        method: method ?? (attr.method as string | undefined) ?? 'post',
        values: values ?? controller.getValues(),
        csrf: csrf ?? config.csrf,
      })

      if (mapErrors && !response.ok) mapResponseErrors(response)
      if (vee.isSubmitting.value) submitResponse = response
      return response
    },

    reset(values?: Record<string, any>) {
      clearGroupErrors()
      vee.resetForm({ values: values ? deepMerge(initialValues.value, values) : deepClone(initialValues.value) }, { force: true })
    },

    setError,

    setErrors(errors: FormoErrorsInput) {
      for (const [path, message] of Object.entries(flattenErrors(errors))) setError(path, message)
    },

    clearErrors() {
      clearGroupErrors()
      for (const path of Object.keys(vee.errors.value)) vee.setFieldError(path, undefined)
    },

    error(path: string) {
      return flatErrors.value[toFormPath(path)]
    },

    find(pathOrAlias: string) {
      const direct = registry.get(pathOrAlias)
      if (direct) return direct
      // Formo find(): search by alias, shallowest match first
      return [...registry.values()]
        .filter((e) => String(e.node.alias) === pathOrAlias)
        .sort((a, b) => depth(a.path) - depth(b.path))[0]
    },

    label: labelFor,

    isIgnored,
    isExcluded,

    _vee: markRaw(veePrivate),

    render(path = '', part: FormoPart = 'field') {
      const key = `${part}:${path}`
      let component = renderCache.get(key)
      if (!component) {
        // Stable identity per path/part, so re-renders don't remount the field
        component = markRaw(
          defineComponent({
            name: `FormoRender(${key})`,
            setup: (_props, { slots }) => () => h(FormoRender, { form: controller, path, part }, slots),
          }),
        )
        renderCache.set(key, component)
      }
      return component
    },

    _claimed: claimed,

    _arrays: arrays,

    _registerArray(path: string, binding: FormoArrayBinding) {
      arrays.set(path, binding)
      return () => {
        if (arrays.get(path) === binding) arrays.delete(path)
      }
    },

    _claim(path: string) {
      claimed.add(path)
      return () => claimed.delete(path)
    },

    _register(entry: RegisteredNode) {
      // A stack per path: the same path may be registered twice for a moment
      // (a part moving between <FormoRest> and <FormoRender>, several standalone roots)
      const stack = registrations.get(entry.path) ?? []
      stack.push(entry)
      registrations.set(entry.path, stack)
      registry.set(entry.path, entry)
      return () => {
        const current = registrations.get(entry.path) ?? []
        const rest = current.filter((e) => e !== entry)
        if (rest.length) {
          registrations.set(entry.path, rest)
          if (registry.get(entry.path) === entry) registry.set(entry.path, rest[rest.length - 1])
          return
        }
        registrations.delete(entry.path)
        if (registry.get(entry.path) === entry) registry.delete(entry.path)
        delete groupErrors[entry.path]
      }
    },

    _useOptions(getter) {
      renderedOptions.value = getter
      return () => {
        if (renderedOptions.value === getter) renderedOptions.value = null
      }
    },

    _onSubmit(handler) {
      submitHandlers.push(handler)
      return () => submitHandlers.splice(submitHandlers.indexOf(handler) >>> 0, 1)
    },

    _onInvalid(handler) {
      invalidHandlers.push(handler)
      return () => invalidHandlers.splice(invalidHandlers.indexOf(handler) >>> 0, 1)
    },

    _onOutcome(handler) {
      outcomeHandlers.push(handler)
      return () => outcomeHandlers.splice(outcomeHandlers.indexOf(handler) >>> 0, 1)
    },
  }) as FormoController

  // Errors from the server (a failed native post, Inertia's `errors` prop): once the fields are there
  if (options.errors && getCurrentInstance()) onMounted(() => controller.setErrors(options.errors!))

  return controller as FormoController<FormoFieldsOfDefinition<D>>
}
