import { RUNTIME, consoleWarning, parseModel, type FormoModel, type ModelField, type ModelItem, type WarningHandler } from './ir'
import {
  blueprintSpec,
  defaultPolicy,
  groupSpec,
  leafSpec,
  mergeSpec,
  type ModelPolicy,
  type OptionsInput,
  type PolicyContext,
  type ValidationMode,
} from './policy'
import type { FieldSpec } from './spec'
import { pickFormValues, toFormValues } from './values'

/**
 * A per-field override:
 *  - a definition merged over the generated one (`{ driver: 'radios', attr: { rows: 6 } }`) —
 *    `rules`, `opts` and `val` replace the generated ones, objects (`attr`, `props`…) merge
 *  - `false` to leave the field out
 *  - a function for full control: `(generated, field) => ({ ...generated, rules: [...generated.rules ?? [], 'x'] })`
 *
 * A key that isn't in the model adds a field (`terms: { driver: 'checkbox', required: true }`).
 */
export type FieldOverride = FieldSpec | false | ((generated: FieldSpec, field: ModelField | ModelItem | undefined) => FieldSpec | false)

export interface FormFromModelOptions {
  /** The form alias (default: the model's `name`) — ids start with it */
  alias?: string | number
  /**
   * Input names and request bodies are the model's own keys by default —
   * `email`, `address[street]`, `phones[0][number]`: what the FormRequest / API
   * validates, so a native post (JavaScript off) meets the same rules as
   * `request()`. A `rootKey` wraps both (Rails: `user[email]`, `{ user: {...} }`),
   * and is stripped from the error keys that come back.
   */
  rootKey?: string
  /** The form's attributes — `{ action: '/users/7', method: 'put' }` lets it post with JavaScript off, and send itself */
  attr?: Record<string, unknown>
  /** Only these fields — dotted paths: `'address'` (the whole subform), `'address.zip'`, `'phones.number'`. Empty: all */
  only?: string[]
  /** Leave these out (dotted paths) */
  except?: string[]
  /** Overrides and additions, keyed by dotted path (`'address.zip'`) or nested (`address: { fields: { zip } }`) */
  fields?: Record<string, FieldOverride>
  /** These first, in this order (dotted paths order inside subforms); the rest keep the model's order */
  order?: string[]
  /**
   * `create` (default) or `update`. In update forms read-only fields are shown
   * uneditable, and write-only ones (passwords) become optional: left empty,
   * they're not submitted — "leave blank to keep the current password"
   */
  mode?: 'create' | 'update'
  /**
   * Read-only fields (`readOnly` — set by the server): `uneditable` shows the
   * value as text (not validated, not submitted), `omit` leaves them out.
   * Default: `uneditable` in update forms, `omit` in create forms. Asking for
   * one explicitly (`only`, or an override in `fields`) always includes it, uneditable.
   */
  readOnly?: 'uneditable' | 'omit'
  /**
   * Database bookkeeping fields left out unless asked for explicitly — listed
   * in `only` or given an override in `fields` (default `METADATA_FIELDS`: `id`,
   * `created_at`, `updated_at`…). Inside repeatable rows, `id` becomes a hidden
   * field so existing rows keep their identity. `false` keeps them all.
   */
  metadata?: string[] | false
  /** `derived` (default), `schema` (needs `fromZod`) or `none` — see `ValidationMode` */
  validation?: ValidationMode
  /** Options for relations and enums, by dotted path: `{ role_id: roles, 'address.country': countries }` */
  options?: Record<string, OptionsInput>
  /** Change how types map to drivers: `{ textareaAbove: 500, radiosUpTo: 4, driverFor }` */
  policy?: Partial<ModelPolicy>
  /**
   * A record to load: read with
   * `toFormValues()` (dates, relations…), restricted to the fields this form has
   * (so what `only` / `except` leave out is never submitted), and set as the
   * form's initial values
   */
  values?: Record<string, any> | null
  /** Unsupported constructs, unknown paths… Default: `console.warn` (once per message) */
  onWarning?: WarningHandler
}

/** Bookkeeping columns left out of forms by default (Laravel, Rails, JS ORMs) */
export const METADATA_FIELDS = [
  'id',
  '_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'email_verified_at',
  'remember_token',
  'lock_version',
]

/** Input types that can carry automatic rules (Formo's `inputRules`) */
const INPUT_TYPES = ['text', 'email', 'url', 'tel', 'password', 'search', 'color', 'number', 'range', 'date', 'datetime-local', 'time', 'week', 'month']

/** `phones.*.number` / `phones[].number` → `phones.number` */
export function modelPath(path: string): string {
  return path
    .replace(/\[\d*\]/g, '')
    .split('.')
    .filter((s) => s !== '*' && s !== '')
    .join('.')
}

const CONFIRMS = /^(?:confirmed|matches):@(.+)$/

/** The field a `confirmed:@password` / `matches:@password` rule points to */
function confirmsField(field: ModelField | ModelItem): string | undefined {
  for (const rule of field.rules ?? []) {
    const text = typeof rule === 'string' ? rule : rule.params?.length ? `${rule.rule}:${String(rule.params[0])}` : rule.rule
    const m = text.match(CONFIRMS)
    if (m) return m[1]
  }
  return undefined
}

/** Shown, not validated, not submitted */
function makeUneditable(spec: FieldSpec): FieldSpec {
  const out: FieldSpec = { ...spec, editable: false, exclude: true }
  delete out.required
  delete out.rules
  if (out.fields) out.fields = Object.fromEntries(Object.entries(out.fields).map(([k, child]) => [k, makeUneditable(child)]))
  return out
}

/**
 * Turn a Formo model into a form definition — from any backend or schema:
 *
 * ```ts
 * import { formFromModel, fromLaravel } from 'formo-vue/schema'
 *
 * const form = useFormo(formFromModel(props.userModel, {
 *   except: ['password'],
 *   fields: { bio: { driver: 'textarea' }, role: { driver: 'radios' } },
 *   mode: 'update',
 * }), { initialValues: toFormValues(props.userModel, props.user) })
 * ```
 *
 * Accepts a model object or its JSON; see `Formo.fromModel()` for a builder.
 */
export function formFromModel(input: FormoModel | string, options: FormFromModelOptions = {}): FieldSpec {
  const warn = options.onWarning ?? consoleWarning
  const model = parseModel(input, warn)
  const mode = options.mode ?? 'create'
  const readOnlyMode = options.readOnly ?? (mode === 'update' ? 'uneditable' : 'omit')
  const metadata = new Set(options.metadata === false ? [] : (options.metadata ?? METADATA_FIELDS))
  const validation = options.validation ?? 'derived'
  const policy: ModelPolicy = { ...defaultPolicy, ...options.policy }
  // An empty list is "no filter" (what an empty `only` box in a UI means), not "no fields"
  const only = options.only?.length ? new Set(options.only.map(modelPath)) : undefined
  const except = new Set((options.except ?? []).map(modelPath))
  const suppliedOptions: Record<string, OptionsInput> = {}
  for (const [path, opts] of Object.entries(options.options ?? {})) suppliedOptions[modelPath(path)] = opts

  /** Paths of `only` / `except` that matched something — the rest are typos, warned below */
  const matched = new Set<string>()
  const excludedPaths = new Set<string>()
  const allPaths = modelPaths(model.fields)
  const overrides = flattenOverrides(options.fields ?? {})

  if (validation === 'schema' && !model[RUNTIME]?.validate) {
    warn({ path: '', code: 'no-schema', message: "validation: 'schema' needs a schema-backed model (fromZod) — using derived rules" })
  }

  const ctxFor = (path: string): PolicyContext => ({ path, policy, validation, warn, options: suppliedOptions })

  function included(field: ModelField, path: string, inRow: boolean): 'skip' | 'field' | 'hidden' | 'uneditable' {
    if (except.has(path)) {
      matched.add(path)
      return 'skip'
    }
    // Listed in `only`, or given an override: asked for explicitly
    const override = overrides.get(path)
    const explicit = !!only?.has(path) || (!!override && (!only || only.has(path) || [...only].some((o) => path.startsWith(`${o}.`))))
    if (only?.has(path)) matched.add(path)
    // A row's key: without it, the server can't tell which existing row was edited
    const rowKey = inRow && (field.name === 'id' || field.name === '_id')
    if (only && !explicit) {
      const inside = [...only].some((o) => path.startsWith(`${o}.`))
      const around = [...only].some((o) => o.startsWith(`${path}.`))
      if (!inside && !around) return rowKey ? 'hidden' : 'skip'
    }
    if (!explicit && metadata.has(field.name)) {
      return rowKey ? 'hidden' : 'skip'
    }
    if (field.fillable === false) {
      if (!explicit) return 'skip'
      warn({ path, code: 'not-fillable', message: 'is not mass-assignable (fillable: false) — included because it was asked for explicitly' })
    }
    if (field.readOnly) {
      if (readOnlyMode === 'omit' && !explicit) return 'skip'
      return 'uneditable'
    }
    return 'field'
  }

  function specFor(field: ModelField | ModelItem, path: string, inRow: boolean): FieldSpec | undefined {
    const ctx = ctxFor(path)
    if (field.type === 'object') return groupSpec(field, build(field.fields ?? [], path, inRow), ctx)
    if (field.type === 'array' && field.items?.type === 'object') {
      return blueprintSpec(field, build(field.items.fields ?? [], path, true), ctx)
    }
    // An override giving a control to a type Formo can't render: build on the model's label, help…
    const override = overrides.get(path)
    if (override && typeof override === 'object' && (override.driver || override.component)) {
      field = { ...field, ui: { ...field.ui, driver: override.driver, component: override.component } }
    }
    return leafSpec(field, ctx)
  }

  function build(fields: ModelField[], prefix: string, inRow: boolean): Record<string, FieldSpec> {
    const out: Record<string, FieldSpec> = {}
    const byName = new Map(fields.map((f) => [f.name, f]))
    for (const field of fields) {
      const path = prefix ? `${prefix}.${field.name}` : field.name
      const decision = included(field, path, inRow)
      if (decision === 'skip') {
        excludedPaths.add(path)
        continue
      }
      if (decision === 'hidden') {
        out[field.name] = { driver: 'hidden' }
        continue
      }
      let spec = specFor(field, path, inRow)
      if (!spec) continue
      if (decision === 'uneditable') spec = makeUneditable(spec)
      else if (mode === 'update') {
        // Passwords in update forms: optional, and not submitted when left empty
        // (a confirmation field follows the field it confirms, not its own value)
        const target = confirmsField(field) ?? (field.writeOnly ? field.name : undefined)
        if (target && byName.get(target)?.writeOnly) {
          delete spec.required
          spec.exclude = { when: target, filled: false }
        }
      }
      out[field.name] = spec
    }
    return out
  }

  const fields = build(model.fields, '', false)

  for (const path of [...(only ?? []), ...except]) {
    if (!matched.has(path) && !allPaths.has(path)) {
      warn({ path, code: 'unknown-path', message: `listed in ${only?.has(path) ? 'only' : 'except'} but the model has no such field` })
    }
  }

  applyOverrides(fields, options.fields ?? {}, '', model, excludedPaths, warn)
  if (options.order?.length) applyOrder(fields, options.order.map(modelPath))

  const root: FieldSpec = {}
  const alias = options.alias ?? model.name
  if (alias !== undefined && alias !== '') root.alias = alias
  if (options.attr) root.attr = { ...options.attr }
  root.fields = fields
  // Names and bodies use the model's keys — what the server validates — not the form alias
  root.config = options.rootKey ? { namePrefix: options.rootKey, request: { rootKey: options.rootKey } } : { namePrefix: false }
  if (model.messages && Object.keys(model.messages).length) root.config.messages = { ...model.messages }

  if (options.values) {
    const values = pickFormValues(toFormValues(model, options.values, { onWarning: warn }), fields)
    if (Object.keys(values).length) root.val = values
  }

  const runtime = model[RUNTIME]
  if (validation === 'derived' && runtime?.refine) root.callbacks = { pass: [runtime.refine] }
  if (validation === 'schema' && runtime?.validate) {
    root.callbacks = { pass: [runtime.validate] }
    // The schema is the only validator: no rules from input types or HTML attributes.
    // (Config layers deep-merge, so each type is cleared — an empty object would change nothing)
    root.config = {
      ...root.config,
      inputRules: Object.fromEntries(INPUT_TYPES.map((type) => [type, []])),
      htmlConstraintRules: false,
    }
  }
  return root
}

/** Every dotted path of a model (array items are transparent: `phones.number`) */
function modelPaths(fields: ModelField[] | undefined, prefix = '', out = new Set<string>()): Set<string> {
  for (const field of fields ?? []) {
    const path = prefix ? `${prefix}.${field.name}` : field.name
    out.add(path)
    modelPaths(field.type === 'array' ? field.items?.fields : field.fields, path, out)
  }
  return out
}

/** Overrides by normalized path, nested `fields` included */
function flattenOverrides(overrides: Record<string, FieldOverride>, prefix = '', out = new Map<string, FieldOverride>()) {
  for (const [key, override] of Object.entries(overrides)) {
    const path = modelPath(prefix ? `${prefix}.${key}` : key)
    out.set(path, override)
    if (override && typeof override === 'object' && override.fields && typeof override.fields === 'object') {
      flattenOverrides(override.fields as Record<string, FieldOverride>, path, out)
    }
  }
  return out
}

/** The model field at a dotted path (array items are transparent) */
export function findModelField(model: FormoModel, path: string): ModelField | ModelItem | undefined {
  let list: ModelField[] | undefined = model.fields
  let found: ModelField | ModelItem | undefined
  for (const segment of path.split('.')) {
    found = list?.find((f) => f.name === segment)
    if (!found) return undefined
    const inner: ModelField | ModelItem = found.type === 'array' && found.items ? found.items : found
    list = inner.fields
  }
  return found
}

function applyOverrides(
  fields: Record<string, FieldSpec>,
  overrides: Record<string, FieldOverride>,
  prefix: string,
  model: FormoModel,
  excluded: Set<string>,
  warn: WarningHandler,
) {
  for (const [rawKey, override] of Object.entries(overrides)) {
    const path = modelPath(prefix ? `${prefix}.${rawKey}` : rawKey)
    const segments = modelPath(rawKey).split('.')
    const key = segments.pop()!
    // Walk to the container of the overridden field
    let container: Record<string, FieldSpec> | undefined = fields
    for (const segment of segments) {
      const next: FieldSpec | undefined = container?.[segment]
      container = next?.fields
      if (!container) break
    }
    if (!container) {
      warn({ path, code: 'unknown-path', message: `override ignored: "${segments.join('.')}" is not a subform of this form` })
      continue
    }
    const field = findModelField(model, path)
    if (field && excluded.has(path) && override !== false) {
      warn({ path, code: 'excluded-override', message: 'override ignored: the field is left out (only / except / metadata / readOnly)' })
      continue
    }
    const existing = container[key]

    if (override === false) {
      delete container[key]
    } else if (typeof override === 'function') {
      const result = override(existing ?? {}, field)
      if (result === false) delete container[key]
      else container[key] = result
    } else {
      const { fields: childOverrides, ...rest } = override
      const next = existing ? mergeSpec(existing, rest) : { ...rest }
      container[key] = next
      if (childOverrides && typeof childOverrides === 'object') {
        next.fields = { ...(next.fields ?? {}) }
        applyOverrides(next.fields, childOverrides as Record<string, FieldOverride>, path, model, excluded, warn)
      }
    }
  }
}

function applyOrder(fields: Record<string, FieldSpec>, order: string[]) {
  const byParent = new Map<string, string[]>()
  for (const path of order) {
    const segments = path.split('.')
    const key = segments.pop()!
    const parent = segments.join('.')
    byParent.set(parent, [...(byParent.get(parent) ?? []), key])
  }
  for (const [parent, keys] of byParent) {
    let container: Record<string, FieldSpec> | undefined = fields
    for (const segment of parent ? parent.split('.') : []) container = container?.[segment]?.fields
    if (!container) continue
    const entries = Object.entries(container)
    const first = keys.filter((k) => k in container!).map((k) => [k, container![k]] as const)
    const rest = entries.filter(([k]) => !keys.includes(k))
    for (const k of Object.keys(container)) delete container[k]
    for (const [k, v] of [...first, ...rest]) container[k] = v
  }
}
