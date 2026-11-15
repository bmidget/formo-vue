import { isPlainObject } from '../core/utils'
import { parseModel, type FormoModel, type ModelField, type ModelItem, type WarningHandler } from './ir'
import type { FieldSpec } from './spec'

export interface ToFormValuesOptions {
  /**
   * Keep only the values the form has fields for — the result of `formFromModel()`,
   * or a builder (`Formo.fromModel()`). Without it, every model field's value
   * is kept, and values of fields the form leaves out would be submitted too.
   */
  form?: FieldSpec | { toSchema(): unknown }
  onWarning?: WarningHandler
}

/**
 * A record from your API → the form's values:
 *
 *  - dates / datetimes / times in the shape their inputs need
 *    (`2024-05-01T09:30:00.000000Z` → `2024-05-01`, or `2024-05-01T11:30` in local time)
 *  - relations → their keys (`{ role: { id: 3 } }` → `role_id: 3`, `tags: [{ id: 1 }]` → `[1]`)
 *  - numbers from decimal strings, booleans from `0` / `1`
 *  - write-only fields (passwords) and files are never pre-filled; keys the model doesn't have are dropped
 *  - with `form`, only the values of the fields that form has (so `except` / `only` hold on submit)
 *
 *   const def = formFromModel(model, { mode: 'update', except: ['role'] })
 *   useFormo(def, { initialValues: toFormValues(model, props.user, { form: def }) })
 *
 * (`formFromModel(model, { values: props.user })` does both at once.)
 */
export function toFormValues(
  model: FormoModel | string,
  record: Record<string, any> | null | undefined,
  options: ToFormValuesOptions = {},
): Record<string, any> {
  const parsed = parseModel(model, options.onWarning)
  if (!record) return {}
  const values = readFields(parsed.fields, record)
  if (!options.form) return values
  const form = 'toSchema' in options.form && typeof options.form.toSchema === 'function' ? (options.form.toSchema() as FieldSpec) : (options.form as FieldSpec)
  return pickFormValues(values, form.fields ?? {})
}

type Children = Record<string, FieldSpec> | Array<FieldSpec & { alias?: string | number }>

/** Values restricted to the fields a form definition has (keyed or list `fields`, subforms, rows) */
export function pickFormValues(values: Record<string, any>, fields: Children): Record<string, any> {
  const out: Record<string, any> = {}
  const entries: Array<[string, FieldSpec]> = Array.isArray(fields)
    ? fields.filter((f) => f.alias !== undefined).map((f) => [String(f.alias), f])
    : Object.entries(fields)
  for (const [alias, spec] of entries) {
    if (!(alias in values)) continue
    const value = values[alias]
    const children = spec.fields as Children | undefined
    if (spec.blueprint && children && Array.isArray(value)) {
      out[alias] = value.map((row) => (isPlainObject(row) ? pickFormValues(row, children) : row))
    } else if (children && isPlainObject(value)) {
      out[alias] = pickFormValues(value, children)
    } else out[alias] = value
  }
  return out
}

const pad = (n: number) => String(n).padStart(2, '0')

function toDate(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return undefined
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `<input type="datetime-local">` wants local time without seconds' fraction or zone */
function toDateTime(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    // No zone: already local
    return value.replace(' ', 'T').slice(0, 16)
  }
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return undefined
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toTime(value: unknown): string | undefined {
  const m = String(value).match(/(?:^|T|\s)(\d{2}:\d{2})(?::\d{2})?/)
  return m ? m[1] : undefined
}

function toNumber(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return value
}

function toBoolean(value: unknown): unknown {
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false' || value === '') return false
  return value
}

const keyOf = (field: ModelField | ModelItem) => field.relation?.key ?? 'id'

function relationValue(field: ModelField | ModelItem, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (isPlainObject(v) ? v[keyOf(field)] : v))
  return isPlainObject(value) ? value[keyOf(field)] : value
}

function readValue(field: ModelField | ModelItem, value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  switch (field.type) {
    case 'date':
      return toDate(value)
    case 'datetime':
      return toDateTime(value)
    case 'time':
      return toTime(value)
    case 'integer':
    case 'number':
      return toNumber(value)
    case 'boolean':
      return toBoolean(value)
    case 'relation':
      return relationValue(field, value)
    case 'file':
      return undefined
    case 'object':
      return isPlainObject(value) ? readFields(field.fields ?? [], value) : undefined
    case 'array': {
      if (!Array.isArray(value) || !field.items) return undefined
      const item = field.items
      if (item.type === 'file') return undefined
      return value.map((v) => readValue(item, v)).filter((v) => v !== undefined)
    }
    case 'enum':
      // A number column behind string options (or the reverse): keep the option's type
      if (field.options?.length && !field.options.some((o) => o.value === value)) {
        const match = field.options.find((o) => String(o.value) === String(value))
        if (match) return match.value
      }
      return value
    default:
      return value
  }
}

function readFields(fields: ModelField[], record: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const field of fields) {
    if (field.writeOnly) continue
    let raw = record[field.name]
    // `role_id` missing, but the relation was loaded: `role: { id: 3 }`
    if (raw === undefined && field.name.endsWith('_id') && isPlainObject(record[field.name.slice(0, -3)])) {
      raw = record[field.name.slice(0, -3)][keyOf(field)]
    }
    const value = readValue(field, raw)
    if (value !== undefined) out[field.name] = value
  }
  return out
}
