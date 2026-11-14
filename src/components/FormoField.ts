import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  markRaw,
  provide,
  resolveDynamicComponent,
  shallowRef,
  watch,
  watchEffect,
  camelize,
  toHandlerKey,
  type Component,
  type PropType,
  type VNode,
} from 'vue'
import { useField, type FieldContext } from 'vee-validate'
import type {
  ChecklistItem,
  ComponentRef,
  ErrorDisplay,
  FieldNode,
  FormoOptionItem,
  FormoOptionsInput,
  FormoResolvedOptions,
} from '../types'
import {
  FormoFieldKey,
  FormoSlotsKey,
  injectController,
  injectFormoOptions,
  type FormoFieldState,
} from '../composables/context'
import { isBuiltin } from '../core/builtin'
import { defaultValueFor, resolveLabelAs, resolveLayout } from '../core/drivers'
import { resolveButtonText, resolveLabel } from '../core/labels'
import { normalizeOptions } from '../core/options'
import { getTranslator, type Translator } from '../i18n/translator'
import { collectFieldRules, evaluateChecklist, isCurrentlyRequired, runRules, type RunRulesOptions } from '../core/rules'
import { mergeTheme, cx } from '../core/theme'
import { getPath, toId, toName } from '../core/utils'
import FormoFieldWrapper from './FormoFieldWrapper.vue'
import FormoUneditable from './FormoUneditable.vue'

/** Resolve a `ComponentRef` (component or registered name) */
export function resolveComponentRef(ref: ComponentRef | undefined, options: FormoResolvedOptions): Component | undefined {
  if (!ref) return undefined
  if (typeof ref !== 'string') return ref
  const registered = options.components[ref]
  if (registered) return resolveComponentRef(registered, options)
  // Fall back to globally registered components (app.component('StarRating', ...))
  const global = resolveDynamicComponent(ref)
  return typeof global === 'string' ? undefined : (global as Component)
}

/** Option (and optgroup) labels are translatable texts */
function translateOptions(items: FormoOptionItem[], tr: Translator): FormoOptionItem[] {
  return items.map((item) =>
    'options' in item && Array.isArray(item.options)
      ? { ...item, label: tr.text(item.label), options: item.options.map((o) => ({ ...o, label: tr.text(o.label) })) }
      : { ...item, label: tr.text(item.label) },
  )
}

/** Does the component declare this prop? `undefined` when it declares no props at all */
function declaresProp(component: Component, prop: string): boolean | undefined {
  const props = (component as any).props
  if (!props) return undefined
  return Array.isArray(props) ? props.includes(prop) : prop in props
}

/** Custom components may emit native events instead of values */
function unwrapEventValue(value: unknown): unknown {
  if (typeof Event !== 'undefined' && value instanceof Event) {
    const target = value.target as HTMLInputElement | null
    if (!target) return undefined
    if (target.type === 'checkbox') return target.checked
    if (target.type === 'file') return target.multiple ? Array.from(target.files ?? []) : target.files?.[0] ?? null
    return target.value
  }
  return value
}

export default defineComponent({
  name: 'FormoField',
  props: {
    node: { type: Object as PropType<FieldNode>, required: true },
    /** Path in the form values */
    path: { type: String, required: true },
    /** Path of the parent group ('' for the form) */
    parentPath: { type: String, default: '' },
    parentAlias: { type: [String, Number], default: undefined },
    /** Registry path of the containing group */
    groupPath: { type: String, default: '' },
    /** `field`: label, control, help, errors · `input`: the control only (Formo's `$field->input()`) */
    part: { type: String as PropType<'field' | 'input'>, default: 'field' },
  },
  setup(props, { slots: ownSlots }) {
    const form = injectController()
    const options = injectFormoOptions()
    const slots = inject(FormoSlotsKey, {})

    const driver = computed(() => options.value.drivers[props.node.driver])
    const config = computed(() => options.value.config)
    const theme = computed(() => mergeTheme(options.value.theme, props.node.classes))
    const valueless = !!driver.value?.valueless

    const tr = computed(() => getTranslator(config.value))
    const label = computed(() => resolveLabel(props.node, props.path, config.value, props.parentAlias))
    /** Help text (translated) */
    const message = computed(() => tr.value.text(props.node.message))
    const parentValues = () => (props.parentPath ? getPath(form.values, props.parentPath) ?? {} : form.values)
    /** Ignored (itself, by a parent group, or by another field's `ignores`) → fully optional */
    const ignored = computed(() => form.isIgnored(props.path))
    const allSpecs = computed(() => collectFieldRules(props.node, driver.value?.rules?.(props.node, config.value), config.value))
    const specs = computed(() => (ignored.value ? [] : allSpecs.value))
    /** `required`, or a conditional rule (required_if…) whose condition holds right now */
    const required = computed(() => isCurrentlyRequired(specs.value, { values: form.values, parentValues: parentValues() }))

    /** `first` (default), `all` or `checklist` */
    const errorDisplay = computed<ErrorDisplay>(() => props.node.errorDisplay ?? config.value.errorDisplay)
    /** Only `first` stops at the first failing rule; `all`/`checklist` need every message */
    const bails = computed(() => (errorDisplay.value === 'first' ? config.value.bails : false))

    const ruleContext = () => ({
      node: props.node,
      path: props.path,
      alias: props.node.alias,
      label: label.value,
      values: form.values,
      parentValues: parentValues(),
      form,
    })
    const runOptions = (): RunRulesOptions => ({
      rules: options.value.rules,
      config: config.value,
      labelFor: (ref) => {
        const sibling = props.parentPath ? `${props.parentPath}.${ref}` : ref
        return form.find(sibling) ? form.label(sibling) : form.label(ref)
      },
      parentAlias: props.parentAlias,
      bails: bails.value,
    })

    /** One validator per field: compiles Formo/Kohana/vee rules and runs them in order */
    const validator = async (value: unknown) => {
      const errors = await runRules(specs.value, value, ruleContext(), runOptions())
      if (!errors.length) return true
      return bails.value ? errors[0] : errors
    }
    const rules = computed(() => (props.node.veeSchema as any) ?? validator)

    let field: FieldContext<any> | undefined
    if (!valueless) {
      const fieldOptions: Record<string, unknown> = {
        form: form._vee,
        label: () => label.value,
        validateOnValueUpdate: false,
        syncVModel: false,
      }
      if (getPath(form.values, props.path) === undefined) {
        fieldOptions.initialValue = props.node.hasVal ? props.node.val : defaultValueFor(driver.value, props.node)
      }
      field = useField<any>(() => props.path, rules as any, fieldOptions)
    }

    // Register so the form can find labels, run callbacks, route errors...
    watchEffect((onCleanup) => {
      const unregister = form._register({
        node: props.node,
        path: props.path,
        parentPath: props.parentPath,
        groupPath: props.groupPath,
        kind: 'field',
        label: () => label.value,
        get state() {
          return state
        },
        validate: field
          ? async () => {
              const r = await field!.validate()
              return { valid: r.valid, errors: r.errors }
            }
          : undefined,
      })
      onCleanup(unregister)
    })

    const hasError = () => !!field?.errorMessage.value

    // Becoming ignored clears errors; coming back re-validates if the user already saw errors
    watch(ignored, (isIgnored) => {
      if (!field) return
      if (isIgnored) field.setErrors([])
      else if (form.submitCount > 0 || field.meta.validated) field.validate()
    })

    /** Live requirement checklist (`errorDisplay: 'checklist'`), re-evaluated on every change */
    const checklist = shallowRef<ChecklistItem[]>([])
    let checklistRun = 0
    watch(
      () =>
        errorDisplay.value === 'checklist' && field
          ? [field.value.value, specs.value, label.value, tr.value.locale, JSON.stringify(form.values)]
          : null,
      async (deps) => {
        const run = ++checklistRun
        if (!deps || !field) {
          checklist.value = []
          return
        }
        const items = await evaluateChecklist(specs.value, field.value.value, ruleContext(), runOptions())
        // Ignore results of an older (slower, async) evaluation
        if (run === checklistRun) checklist.value = items
      },
      { immediate: true },
    )

    function setValue(value: unknown) {
      if (!field) return
      const mode = config.value.validationMode
      const validate =
        mode === 'aggressive' ||
        hasError() ||
        (mode === 'eager' && field.meta.touched)
      field.handleChange(value, validate)
    }

    function onBlur() {
      if (!field) return
      field.handleBlur(undefined, config.value.validationMode !== 'submit')
    }

    const options$ = computed(() => {
      const source = props.node.opts
      const input = typeof source === 'function'
        ? source({ values: form.values, parentValues: parentValues(), node: props.node, path: props.path })
        : source
      return translateOptions(normalizeOptions(input as FormoOptionsInput), tr.value)
    })

    const id = computed(() => {
      const explicit = props.node.attr.id
      if (explicit !== undefined && explicit !== null && explicit !== '') return String(explicit)
      return config.value.autoId ? toId(form.alias, props.path) : ''
    })
    // The form alias prefixes names when the *form* namespaces (groups are already in the path)
    const name = computed(() => toName(form.options.config.namespaces ? form.alias : undefined, props.path))
    const helpId = computed(() => `${id.value || toId(form.alias, props.path)}-help`)
    const errorId = computed(() => `${id.value || toId(form.alias, props.path)}-error`)
    const checklistId = computed(() => `${id.value || toId(form.alias, props.path)}-checklist`)

    const attrs = computed(() => {
      const { class: _class, type: _type, value: _value, id: _id, ...rest } = props.node.attr
      // Human-facing attributes are translatable texts
      for (const key of ['placeholder', 'title', 'aria-label'] as const) {
        if (typeof rest[key] === 'string') rest[key] = tr.value.text(rest[key] as string)
      }
      const error = field?.errorMessage.value
      const describedBy = [
        props.node.message ? helpId.value : '',
        errorDisplay.value === 'checklist' ? checklistId.value : '',
        error ? errorId.value : '',
      ]
        .filter(Boolean)
        .join(' ')
      return {
        ...rest,
        id: id.value || undefined,
        name: name.value,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describedBy || undefined,
        'aria-required': required.value ? 'true' : undefined,
      } as Record<string, unknown>
    })

    /** The field state every control gets (plain getters → always fresh, no deep proxies) */
    const state: FormoFieldState = markRaw({
      get node() { return props.node },
      get path() { return props.path },
      get name() { return name.value },
      get id() { return id.value },
      get value() { return field ? field.value.value : props.node.val },
      setValue,
      onBlur,
      get error() { return field?.errorMessage.value },
      get errors() { return field?.errors.value ?? [] },
      get errorDisplay() { return errorDisplay.value },
      get checklist() { return checklist.value },
      get checklistId() { return checklistId.value },
      get invalid() { return !!field?.errorMessage.value },
      get touched() { return !!field?.meta.touched },
      get dirty() { return !!field?.meta.dirty },
      get required() { return required.value },
      get ignored() { return ignored.value },
      get label() { return label.value },
      get message() { return message.value },
      get text() { return resolveButtonText(props.node, config.value) },
      get options() { return options$.value },
      get classes() { return theme.value },
      get attrs() { return attrs.value },
      get layout() { return resolveLayout(driver.value, props.node) },
      get labelAs() { return resolveLabelAs(driver.value, props.node) },
      get helpId() { return helpId.value },
      get errorId() { return errorId.value },
      get disabled() { return !!props.node.attr.disabled },
      field: field ? markRaw(field) : undefined,
      form,
    })

    provide(FormoFieldKey, state)

    const editable = computed(() => {
      const e = props.node.editable
      return typeof e === 'function'
        ? e({ values: form.values, parentValues: parentValues(), node: props.node, path: props.path })
        : e !== false
    })

    /** Component resolution order — see README "Overriding components" */
    const control = computed<Component | undefined>(() => {
      const opts = options.value
      const node = props.node
      const template = typeof node.vars.template === 'string' ? node.vars.template : undefined
      return (
        resolveComponentRef(node.component, opts) ??
        (template && opts.components[template] ? resolveComponentRef(template, opts) : undefined) ??
        (node.type ? resolveComponentRef(opts.components[`${node.driver}|${node.type}`], opts) : undefined) ??
        resolveComponentRef(opts.components[node.driver], opts) ??
        resolveComponentRef(driver.value?.component, opts)
      )
    })

    const wrapper = computed<Component | false>(() => {
      if (props.node.wrapper === false) return false
      return (
        resolveComponentRef(props.node.wrapper || undefined, options.value) ??
        resolveComponentRef(options.value.components.wrapper, options.value) ??
        FormoFieldWrapper
      )
    })

    function findSlot(kind: 'field' | 'control') {
      // <FormoRender path="x"><template #control="field">…</template></FormoRender>
      const own = (ownSlots as Record<string, any>)[kind]
      if (own) return own
      const generic = props.path.replace(/\[\d+\]/g, '[]')
      return (slots as Record<string, any>)[`${kind}:${props.path}`] ?? (slots as Record<string, any>)[`${kind}:${generic}`]
    }

    function renderHiddenMirror(): VNode[] {
      if (!config.value.native || !field) return []
      const value = field.value.value
      if (Array.isArray(value)) {
        return value.map((v, i) => h('input', { key: i, type: 'hidden', name: `${name.value}[]`, value: String(v ?? '') }))
      }
      if (typeof value === 'boolean') return [h('input', { type: 'hidden', name: name.value, value: value ? '1' : '' })]
      if (value !== null && typeof value === 'object') return []
      return [h('input', { type: 'hidden', name: name.value, value: String(value ?? '') })]
    }

    function renderControl(): VNode | VNode[] | undefined {
      if (!editable.value) {
        const Uneditable = resolveComponentRef(options.value.components.uneditable, options.value) ?? FormoUneditable
        return h(Uneditable as any, { formo: state })
      }

      const controlSlot = findSlot('control')
      if (controlSlot) return h(Fragment, [controlSlot(state), ...renderHiddenMirror()])

      const Comp = control.value
      if (!Comp) {
        console.warn(`[formo] No component found for driver "${props.node.driver}" (field "${props.path}")`)
        return undefined
      }

      const builtin = isBuiltin(Comp)
      const model = { ...driver.value?.model, ...props.node.model }
      const modelProp = model.prop ?? 'modelValue'
      const modelEvent = model.event ?? 'update:modelValue'
      const { class: attrClass } = props.node.attr

      // Components that only use useFormoField() don't declare the model prop: don't leak it as an attribute
      const passModel = declaresProp(Comp, modelProp) !== false

      const vnodeProps: Record<string, unknown> = {
        ...(builtin ? {} : attrs.value),
        ...(builtin ? {} : { class: attrClass }),
        ...(declaresProp(Comp, 'formo') ? { formo: state } : {}),
        ...props.node.props,
        ...(passModel ? { [modelProp]: field ? field.value.value : undefined } : {}),
        [toHandlerKey(camelize(modelEvent))]: (value: unknown) => setValue(unwrapEventValue(value)),
        onBlur,
      }
      // `update:modelValue` → also listen to the kebab variant some libs emit
      if (modelEvent.includes(':') || modelEvent.includes('-')) {
        vnodeProps[toHandlerKey(modelEvent)] = vnodeProps[toHandlerKey(camelize(modelEvent))]
      }

      const vnode = h(Comp as any, vnodeProps)
      return builtin ? vnode : [vnode, ...renderHiddenMirror()]
    }

    return () => {
      const fieldSlot = findSlot('field')
      if (fieldSlot) return fieldSlot(state)

      const content = renderControl()
      const Wrapper = wrapper.value
      const bareHidden = props.node.type === 'hidden'
      if (!Wrapper || bareHidden || props.part === 'input') return content

      return h(
        Wrapper as any,
        {
          formo: state,
          class: cx(props.node.vars.wrapperClass as string | undefined),
          'data-formo-path': props.path,
        },
        { default: () => content },
      )
    }
  },
})

