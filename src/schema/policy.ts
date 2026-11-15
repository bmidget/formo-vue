import { humanize, isPlainObject } from '../core/utils'
import { RUNTIME, type ModelField, type ModelItem, type ModelOption, type ModelRule, type RuntimeRule, type WarningHandler } from './ir'
import type { FieldSpec, SpecOption, SpecRule } from './spec'

/**
 * How model fields become Formo fields: the driver for each type, the rules
 * derived from constraints, options, attributes. Every decision can be
 * changed per field (`formFromModel(model, { fields })`, `ui` in the model) or
 * app-wide (`policy`).
 */

/**
 * - `derived` (default): Formo rules derived from the constraints — messages,
 *   checklists, live locale switching and Laravel lang files all work. Schema
 *   refinements Formo can't express (Zod `.refine()` / `.superRefine()`) still
 *   run through the schema, after Formo's rules.
 * - `schema`: the schema validates everything (needs a schema-backed model: `fromZod`)
 * - `none`: no client-side validation (the server's 422 errors still map onto fields)
 */
export type ValidationMode = 'derived' | 'schema' | 'none'

export interface ModelPolicy {
  /** Strings whose `maxLength` is above this become textareas (default 255) */
  textareaAbove: number
  /** Enums with this many options or fewer become radios instead of a select (default 0: always a select) */
  radiosUpTo: number
  /** Last word on the driver of every field: return another driver name, or `proposed` */
  driverFor?: (field: ModelField | ModelItem, proposed: string | undefined, path: string) => string | undefined
}

export const defaultPolicy: ModelPolicy = { textareaAbove: 255, radiosUpTo: 0 }

/** Options supplied by the app (relations, labelled enums): `{ role_id: roles }` */
export type OptionsInput = SpecOption[] | Array<string | number> | Record<string, string>

export interface PolicyContext {
  /** Dotted path, without row indexes (`phones.number`) */
  path: string
  policy: ModelPolicy
  validation: ValidationMode
  warn: WarningHandler
  options: Record<string, OptionsInput>
}

const FORMAT_DRIVERS: Record<string, string> = {
  email: 'email',
  url: 'url',
  uri: 'url',
  password: 'password',
  tel: 'tel',
  color: 'color',
  search: 'search',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Rules implied by a string format (the driver's input type may add the same ones — Formo dedupes by name) */
const FORMAT_RULES: Record<string, SpecRule> = {
  email: 'email',
  url: 'url',
  uri: 'url',
  color: 'color',
  ip: 'ip',
  uuid: { rule: 'regex', params: [UUID] },
}

const isMany = (field: ModelField | ModelItem) =>
  field.relation?.kind === 'belongsToMany' || field.relation?.kind === 'hasMany'

/** The driver a field gets (`undefined`: Formo can't render this type on its own) */
export function proposeDriver(field: ModelField | ModelItem, policy: ModelPolicy): string | undefined {
  const c = field.constraints ?? {}
  switch (field.type) {
    case 'string':
      if (field.format && FORMAT_DRIVERS[field.format]) return FORMAT_DRIVERS[field.format]
      if (field.format === 'textarea' || (c.maxLength ?? 0) > policy.textareaAbove) return 'textarea'
      return 'text'
    case 'text':
      return 'textarea'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'checkbox'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime-local'
    case 'time':
      return 'time'
    case 'enum':
      return (field.options?.length ?? 0) <= policy.radiosUpTo ? 'radios' : 'select'
    case 'file':
      return 'file'
    case 'relation':
      return isMany(field) ? 'checkboxes' : 'select'
    case 'array': {
      const item = field.items
      if (!item) return undefined
      if (item.type === 'enum' || item.type === 'relation') return 'checkboxes'
      if (item.type === 'file') return 'file'
      return undefined
    }
    default:
      return undefined
  }
}

/** A model rule → a Formo rule */
export function toSpecRule(rule: ModelRule): SpecRule {
  if (typeof rule === 'string') return rule
  const out: { rule: string; params?: unknown[]; message?: string } = { rule: rule.rule }
  if (rule.params) out.params = [...rule.params]
  if (rule.message) out.message = rule.message
  return out
}

/** A JSON Schema pattern → RegExp (unicode-aware when it can be) */
export function patternToRegExp(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, 'u')
  } catch {
    try {
      return new RegExp(pattern)
    } catch {
      return undefined
    }
  }
}

function optionLabel(value: ModelOption['value']): string {
  if (typeof value === 'string') return humanize(value)
  return String(value)
}

function toOptions(options: ModelOption[]): SpecOption[] {
  return options.map((o) => {
    const option: SpecOption = { value: o.value, label: o.label ?? optionLabel(o.value) }
    if (o.disabled) option.disabled = true
    return option
  })
}

/** Keys whose value replaces the generated one wholesale (the rest merge one level deep) */
const REPLACED = new Set(['rules', 'opts', 'filters', 'callbacks', 'val', 'fields'])

/**
 * Merge definition keys over a generated spec: plain objects (`attr`, `props`,
 * `errorMessages`, `classes`, `config`) merge one level, everything else —
 * `rules`, `opts`, `val` included — is replaced. `options` / `value` are read
 * as `opts` / `val`.
 */
export function mergeSpec(base: FieldSpec, over: Record<string, unknown>): FieldSpec {
  const out: FieldSpec = { ...base }
  for (const [rawKey, value] of Object.entries(over)) {
    if (value === undefined) continue
    const key = rawKey === 'options' ? 'opts' : rawKey === 'value' ? 'val' : rawKey
    if (!REPLACED.has(key) && isPlainObject(value) && isPlainObject(out[key])) out[key] = { ...(out[key] as object), ...value }
    else out[key] = value
  }
  return out
}

/** A function rule named for Formo (a rule's name is its function's name) */
export function namedRule(fn: RuntimeRule, name: string): RuntimeRule {
  const rule: RuntimeRule = (value, params, ctx) => fn(value, params, ctx)
  Object.defineProperty(rule, 'name', { value: name })
  return rule
}

function derivedRules(field: ModelField | ModelItem, ctx: PolicyContext): SpecRule[] {
  const c = field.constraints ?? {}
  const rules: SpecRule[] = []
  const isArray = field.type === 'array'
  const item = isArray ? field.items : undefined
  const kind = item?.type === 'file' ? 'file' : field.type

  if (field.type === 'string' || field.type === 'text') {
    if (field.format && FORMAT_RULES[field.format]) rules.push(FORMAT_RULES[field.format])
    if (c.minLength !== undefined) rules.push(`min:${c.minLength}`)
    if (c.maxLength !== undefined) rules.push(`max:${c.maxLength}`)
    if (c.pattern !== undefined) {
      const regex = patternToRegExp(c.pattern)
      if (regex) rules.push({ rule: 'regex', params: [regex] })
      else ctx.warn({ path: ctx.path, code: 'invalid-pattern', message: `pattern ${JSON.stringify(c.pattern)} isn't a valid JavaScript regular expression — skipped` })
    }
  }

  if (field.type === 'integer' || field.type === 'number') {
    if (field.type === 'integer') rules.push('integer')
    if (c.min !== undefined) rules.push(`min_value:${c.min}`)
    if (c.max !== undefined) rules.push(`max_value:${c.max}`)
    if (c.exclusiveMin !== undefined) rules.push(`gt:${c.exclusiveMin}`)
    if (c.exclusiveMax !== undefined) rules.push(`lt:${c.exclusiveMax}`)
  }

  if (field.type === 'boolean' && c.accepted) rules.push('accepted')

  if (kind === 'file') {
    const fc = { ...(item?.constraints ?? {}), ...(isArray ? {} : c) }
    if (fc.maxSize !== undefined) rules.push(`size:${fc.maxSize}`)
    if (fc.extensions?.length) rules.push({ rule: 'ext', params: [...fc.extensions] })
    if (fc.mimeTypes?.length) rules.push({ rule: 'mimes', params: [...fc.mimeTypes] })
  }

  if (isArray) {
    if (c.minItems !== undefined) rules.push(`min_items:${c.minItems}`)
    if (c.maxItems !== undefined) rules.push(`max_items:${c.maxItems}`)
  }

  return rules
}

function attrsFor(field: ModelField | ModelItem): Record<string, unknown> {
  const attr: Record<string, unknown> = {}
  const c = field.constraints ?? {}
  if (field.placeholder) attr.placeholder = field.placeholder
  if ((field.type === 'string' || field.type === 'text') && c.maxLength !== undefined) attr.maxlength = c.maxLength
  if ((field.type === 'integer' || field.type === 'number') && c.step !== undefined) attr.step = c.step
  const fileField = field.type === 'file' ? field : field.type === 'array' && field.items?.type === 'file' ? field.items : undefined
  if (fileField) {
    const fc = fileField.constraints ?? {}
    const accept = [...(fc.mimeTypes ?? []), ...(fc.extensions ?? []).map((e) => `.${e.replace(/^\./, '')}`)]
    if (accept.length) attr.accept = accept.join(',')
    if (field.type === 'array') attr.multiple = true
  }
  return attr
}

/** What every spec carries: label, help text, placeholder, default, messages */
function baseSpec(field: ModelField | ModelItem): FieldSpec {
  const spec: FieldSpec = {}
  if (field.label !== undefined) spec.label = field.label
  if (field.description) spec.message = field.description
  if (field.default !== undefined && !field.writeOnly) spec.val = field.default
  if (field.messages && Object.keys(field.messages).length) spec.errorMessages = { ...field.messages }
  return spec
}

/**
 * A leaf field (anything but an object / repeatable rows) → its Formo definition.
 * `undefined` when Formo can't render it (warned).
 */
export function leafSpec(field: ModelField | ModelItem, ctx: PolicyContext): FieldSpec | undefined {
  const ui = field.ui ?? {}
  const proposed = proposeDriver(field, ctx.policy)
  const driver = ctx.policy.driverFor ? ctx.policy.driverFor(field, proposed, ctx.path) : proposed
  if (!driver && !ui.driver && !ui.component) {
    const what = field.type === 'array' ? `a list of ${field.items?.type ?? 'unknown'} values` : `type "${field.type}"`
    ctx.warn({
      path: ctx.path,
      code: 'unsupported-type',
      message: `Formo has no control for ${what} — skipped. Give it one with \`fields: { '${ctx.path}': { driver | component } }\``,
    })
    return undefined
  }

  const spec = baseSpec(field)
  if (driver) spec.driver = driver

  // Options: the app's (relations, labelled enums), else the model's
  const optionSource = field.type === 'array' ? field.items : field
  const supplied = ctx.options[ctx.path]
  if (supplied) spec.opts = supplied
  else if (optionSource?.options) spec.opts = toOptions(optionSource.options)
  else if (field.type === 'relation' || optionSource?.type === 'relation') {
    ctx.warn({ path: ctx.path, code: 'missing-options', message: `relation without options — pass them: \`options: { '${ctx.path}': [...] }\`` })
    spec.opts = []
  }
  if (driver === 'select' && spec.val === undefined) spec.blank = true

  const attr = attrsFor(field)
  if (Object.keys(attr).length) spec.attr = attr

  // A required checkbox only has to be present — Laravel's `accepted` is "must be checked"
  if (field.required && field.type !== 'boolean' && ctx.validation !== 'none') spec.required = true
  if (field.nullable && ['string', 'text', 'date', 'datetime', 'time'].includes(field.type)) spec.filters = ['null_if_empty']

  // A list of files: its element's rules (`image`, `ext`…) check every file
  const itemRules = field.type === 'array' && field.items?.type === 'file' ? (field.items.rules ?? []) : []
  const extra = [...itemRules, ...(field.rules ?? [])].map(toSpecRule)
  const runtime = (field as ModelField)[RUNTIME]
  let rules: SpecRule[] = []
  if (ctx.validation === 'derived') {
    rules = [...derivedRules(field, ctx), ...extra]
    if (runtime?.refine) rules.push(namedRule(runtime.refine, 'refine'))
  } else if (ctx.validation === 'schema') {
    if (runtime?.validate) {
      // Named `required` when the field is: Formo shows the marker, runs it first, and keeps it out of checklists
      rules = [namedRule(runtime.validate, field.required ? 'required' : 'schema'), ...extra]
      delete spec.required
    } else {
      rules = [...derivedRules(field, ctx), ...extra]
    }
  }
  if (rules.length) spec.rules = rules

  // A list's element can carry hints too (`accept` for files): the list's own win
  const itemUi = field.type === 'array' ? field.items?.ui : undefined
  const withItemUi = itemUi && Object.keys(itemUi).length ? mergeSpec(spec, itemUi) : spec
  return Object.keys(ui).length ? mergeSpec(withItemUi, ui) : withItemUi
}

/** An object → a subform */
export function groupSpec(field: ModelField | ModelItem, children: Record<string, FieldSpec>, ctx: PolicyContext): FieldSpec {
  const spec = baseSpec(field)
  delete spec.val
  if (field.default !== undefined && isPlainObject(field.default)) spec.val = field.default
  spec.fields = children
  if (ctx.validation !== 'none' && field.rules?.length) spec.rules = field.rules.map(toSpecRule)
  const ui = field.ui ?? {}
  return Object.keys(ui).length ? mergeSpec(spec, ui) : spec
}

/** An array of objects → repeatable rows */
export function blueprintSpec(field: ModelField | ModelItem, children: Record<string, FieldSpec>, ctx: PolicyContext): FieldSpec {
  const spec = baseSpec(field)
  delete spec.val
  if (Array.isArray(field.default)) spec.val = field.default
  spec.blueprint = true
  spec.fields = children
  const c = field.constraints ?? {}
  const min = c.minItems ?? (field.required ? 1 : undefined)
  if (min !== undefined) spec.min = min
  if (c.maxItems !== undefined) spec.max = c.maxItems
  if (ctx.validation !== 'none' && field.rules?.length) spec.rules = field.rules.map(toSpecRule)
  const ui = field.ui ?? {}
  return Object.keys(ui).length ? mergeSpec(spec, ui) : spec
}
