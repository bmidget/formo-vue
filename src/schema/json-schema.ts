import { isPlainObject } from '../core/utils'
import {
  MODEL_VERSION,
  consoleWarning,
  type FormoModel,
  type ModelConstraints,
  type ModelField,
  type ModelFieldType,
  type ModelItem,
  type ModelOption,
  type ModelRule,
  type WarningHandler,
} from './ir'

/**
 * JSON Schema (draft-07 → 2020-12, and OpenAPI 3.0 / 3.1 schema objects) → Formo model.
 *
 *   const model = fromJsonSchema(await (await fetch('/schemas/user.json')).json(), { name: 'user' })
 *
 * Understood: `properties` / `required`, `$ref` + `$defs` / `definitions` (local refs), `allOf`,
 * nullable unions (`type: ['string', 'null']`, `anyOf` with `{ type: 'null' }`, OpenAPI's
 * `nullable`), labelled enums (`oneOf: [{ const, title }]`, `x-enumNames`), `title` → label,
 * `description` → help, `default`, `examples` → placeholder, `readOnly` / `writeOnly`,
 * string `format`s, length / range / items / pattern constraints, `dependentRequired`
 * (→ `required_with`), and `x-formo` (Formo definition keys, merged last).
 * `if` / `then` / `else`, `not`, `oneOf` of objects… are reported and skipped.
 */

export type JsonSchema = Record<string, any> | boolean

export interface FromJsonSchemaOptions {
  /** The model's name (suggested form alias) */
  name?: string
  /** JSON pointer (`#/$defs/User`) or `$defs` / `definitions` name of the object to read */
  root?: string
  /** Document `$ref`s resolve against (default: the schema itself) — OpenAPI documents */
  document?: Record<string, any>
  onWarning?: WarningHandler
}

const FORMATS: Record<string, { type: ModelFieldType; format?: string }> = {
  email: { type: 'string', format: 'email' },
  'idn-email': { type: 'string', format: 'email' },
  uri: { type: 'string', format: 'url' },
  url: { type: 'string', format: 'url' },
  iri: { type: 'string', format: 'url' },
  'uri-reference': { type: 'string', format: 'url' },
  date: { type: 'date' },
  'date-time': { type: 'datetime' },
  datetime: { type: 'datetime' },
  time: { type: 'time' },
  binary: { type: 'file' },
  password: { type: 'string', format: 'password' },
  textarea: { type: 'text' },
  uuid: { type: 'string', format: 'uuid' },
  color: { type: 'string', format: 'color' },
  tel: { type: 'string', format: 'tel' },
  phone: { type: 'string', format: 'tel' },
  e164: { type: 'string', format: 'tel' },
  ipv4: { type: 'string', format: 'ip' },
  ipv6: { type: 'string', format: 'ip' },
  ip: { type: 'string', format: 'ip' },
}

/** Bounds that mean "it's an integer", not a real constraint (Zod's `z.int()`, `z.int32()`) */
const NOT_A_BOUND = new Set([Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 2147483647, -2147483648])

const UNSUPPORTED = ['if', 'then', 'else', 'not', 'dependentSchemas', 'patternProperties', 'unevaluatedProperties'] as const

interface Reader {
  /** What `$ref`s resolve against */
  refRoot: Record<string, any>
  warn: WarningHandler
}

/** `#/$defs/User` → the schema */
function pointer(refRoot: Record<string, any>, ref: string): unknown {
  if (!ref.startsWith('#')) return undefined
  const parts = ref.slice(1).split('/').filter(Boolean).map((p) => decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~'))
  let cur: any = refRoot
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

/**
 * Resolve `$ref`s and merge `allOf`. `stack` holds the refs being expanded above
 * this schema (it grows as properties nest): meeting one again is a cycle.
 */
function resolve(schema: JsonSchema, reader: Reader, path: string, stack: string[]): { schema: Record<string, any>; stack: string[] } {
  if (schema === true || schema === undefined) return { schema: {}, stack }
  if (schema === false) return { schema: { not: {} }, stack }
  let s: Record<string, any> = schema
  while (typeof s.$ref === 'string') {
    const ref: string = s.$ref
    if (stack.includes(ref)) {
      reader.warn({ path, code: 'recursive-ref', message: `${ref} refers to itself — not expanded` })
      return { schema: { __recursive: true }, stack }
    }
    const target = pointer(reader.refRoot, ref)
    if (!isPlainObject(target)) {
      reader.warn({ path, code: 'unresolved-ref', message: `can't resolve ${ref} (only local #/ refs are supported)` })
      return { schema: {}, stack }
    }
    stack = [...stack, ref]
    const { $ref: _ignored, ...siblings } = s
    s = { ...target, ...siblings }
  }
  if (Array.isArray(s.allOf)) {
    const { allOf, ...rest } = s
    let merged: Record<string, any> = {}
    for (const part of [...allOf, rest]) {
      const { schema: r } = resolve(part, reader, path, stack)
      merged = {
        ...merged,
        ...r,
        properties: { ...merged.properties, ...r.properties },
        required: [...(merged.required ?? []), ...(r.required ?? [])],
      }
    }
    if (!Object.keys(merged.properties).length) delete merged.properties
    if (!merged.required.length) delete merged.required
    s = merged
  }
  return { schema: s, stack }
}

const isNullSchema = (s: unknown) => isPlainObject(s) && (s.type === 'null' || (Array.isArray(s.enum) && s.enum.length === 1 && s.enum[0] === null))

/** Peel `null` out of unions: returns the non-null schema and whether null was allowed */
function unwrapNullable(s: Record<string, any>, reader: Reader, path: string, stack: string[]): { schema: Record<string, any>; nullable: boolean } {
  let nullable = s.nullable === true || s['x-nullable'] === true
  let schema = s
  if (Array.isArray(s.type) && s.type.includes('null')) {
    nullable = true
    const types = s.type.filter((t: string) => t !== 'null')
    schema = { ...s, type: types.length === 1 ? types[0] : types }
  }
  for (const key of ['anyOf', 'oneOf'] as const) {
    const list = schema[key]
    if (!Array.isArray(list) || !list.some(isNullSchema)) continue
    nullable = true
    const rest = list.filter((m: unknown) => !isNullSchema(m))
    const { [key]: _drop, ...siblings } = schema
    schema = rest.length === 1 ? { ...resolve(rest[0], reader, path, stack).schema, ...siblings } : { ...siblings, [key]: rest }
  }
  if (Array.isArray(schema.enum) && schema.enum.includes(null)) {
    nullable = true
    schema = { ...schema, enum: schema.enum.filter((v: unknown) => v !== null) }
  }
  return { schema, nullable }
}

const scalar = (v: unknown): v is ModelOption['value'] =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

/** `enum` (+ `x-enumNames`), `const`, or `oneOf` / `anyOf` of `{ const, title }` → options */
function readOptions(s: Record<string, any>, reader: Reader, path: string, stack: string[]): ModelOption[] | undefined {
  const labels: unknown[] | undefined = s['x-enumNames'] ?? s.enumNames ?? s['x-enum-varnames']
  if (Array.isArray(s.enum)) {
    return s.enum.filter(scalar).map((value: ModelOption['value'], i: number) => {
      const option: ModelOption = { value }
      if (typeof labels?.[i] === 'string') option.label = labels[i] as string
      return option
    })
  }
  for (const key of ['oneOf', 'anyOf'] as const) {
    const list = s[key]
    if (!Array.isArray(list) || !list.length) continue
    const members = list.map((m: JsonSchema) => resolve(m, reader, path, stack).schema)
    if (!members.every((m) => 'const' in m || (Array.isArray(m.enum) && m.enum.length === 1))) continue
    return members.map((m) => {
      const value = ('const' in m ? m.const : m.enum[0]) as ModelOption['value']
      const option: ModelOption = { value }
      if (typeof m.title === 'string') option.label = m.title
      else if (typeof m.description === 'string') option.label = m.description
      return option
    })
  }
  return undefined
}

function typeOf(s: Record<string, any>): string | undefined {
  if (typeof s.type === 'string') return s.type
  if (s.properties) return 'object'
  if (s.items || s.prefixItems) return 'array'
  return undefined
}

function readConstraints(s: Record<string, any>, type: ModelFieldType): ModelConstraints {
  const c: ModelConstraints = {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && !NOT_A_BOUND.has(v) ? v : undefined)
  if (type === 'string' || type === 'text') {
    if (num(s.minLength) !== undefined) c.minLength = s.minLength
    if (num(s.maxLength) !== undefined) c.maxLength = s.maxLength
    if (typeof s.pattern === 'string') c.pattern = s.pattern
  }
  if (type === 'integer' || type === 'number') {
    // draft-04 / OpenAPI 3.0: boolean `exclusiveMinimum` modifies `minimum`
    if (num(s.minimum) !== undefined) {
      if (s.exclusiveMinimum === true) c.exclusiveMin = s.minimum
      else c.min = s.minimum
    }
    if (num(s.maximum) !== undefined) {
      if (s.exclusiveMaximum === true) c.exclusiveMax = s.maximum
      else c.max = s.maximum
    }
    if (num(s.exclusiveMinimum) !== undefined) {
      // Integers: `> 0` is `>= 1` — keeps Formo's min_value messages
      if (type === 'integer') c.min = Math.floor(s.exclusiveMinimum) + 1
      else c.exclusiveMin = s.exclusiveMinimum
    }
    if (num(s.exclusiveMaximum) !== undefined) {
      if (type === 'integer') c.max = Math.ceil(s.exclusiveMaximum) - 1
      else c.exclusiveMax = s.exclusiveMaximum
    }
    if (num(s.multipleOf) !== undefined) c.step = s.multipleOf
  }
  if (type === 'file') {
    if (typeof s.contentMediaType === 'string') c.mimeTypes = s.contentMediaType.split(',').map((m: string) => m.trim())
  }
  return c
}

function withConstraints<T extends ModelField | ModelItem>(field: T, c: ModelConstraints): T {
  if (Object.keys(c).length) field.constraints = { ...field.constraints, ...c }
  return field
}

function readField(name: string | undefined, raw: JsonSchema, required: boolean, reader: Reader, path: string, parentStack: string[]): ModelField | ModelItem {
  const { schema: resolved, stack } = resolve(raw, reader, path, parentStack)
  const { schema: s, nullable } = unwrapNullable(resolved, reader, path, stack)
  const field: ModelItem = { type: 'unknown' }
  if (name !== undefined) field.name = name

  for (const key of UNSUPPORTED) {
    if (key in s) reader.warn({ path, code: 'unsupported-keyword', message: `\`${key}\` isn't supported — ignored` })
  }

  if (typeof s.title === 'string') field.label = s.title
  if (typeof s.description === 'string') field.description = s.description
  if (Array.isArray(s.examples) && typeof s.examples[0] === 'string') field.placeholder = s.examples[0]
  else if (typeof s.example === 'string') field.placeholder = s.example
  if ('default' in s) field.default = s.default
  if (s.readOnly === true) field.readOnly = true
  if (s.writeOnly === true) field.writeOnly = true
  if (required) field.required = true
  if (nullable) field.nullable = true
  const ui = s['x-formo'] ?? s.formo
  if (isPlainObject(ui)) field.ui = { ...ui }

  if (s.__recursive) return field

  const options = readOptions(s, reader, path, stack)
  let type = typeOf(s)
  if (!type && options?.length) type = typeof options[0].value === 'number' ? 'number' : 'string'

  // A single constant true checkbox: "must be accepted"
  if (type === 'boolean' && (s.const === true || (options?.length === 1 && options[0].value === true))) {
    field.type = 'boolean'
    field.constraints = { accepted: true }
    return field
  }
  if (options && type !== 'array' && type !== 'object') {
    field.type = 'enum'
    field.options = options
    return field
  }

  switch (type) {
    case 'string': {
      const mapped = typeof s.format === 'string' ? FORMATS[s.format] : undefined
      field.type = mapped?.type ?? 'string'
      if (mapped?.format) field.format = mapped.format
      else if (!mapped && typeof s.format === 'string') field.format = s.format
      if (s.contentEncoding === 'binary' || (s.contentEncoding === 'base64' && typeof s.contentMediaType === 'string')) field.type = 'file'
      const c = readConstraints(s, field.type)
      // A known format already validates the shape: its pattern (Zod emits one for emails…) would duplicate it
      if (mapped && c.pattern) delete c.pattern
      return withConstraints(field, c)
    }
    case 'integer':
    case 'number':
      field.type = type
      return withConstraints(field, readConstraints(s, type))
    case 'boolean':
      field.type = 'boolean'
      return field
    case 'object': {
      field.type = 'object'
      field.fields = readProperties(s, reader, path, stack)
      return field
    }
    case 'array': {
      field.type = 'array'
      if (Array.isArray(s.items) || s.prefixItems) {
        reader.warn({ path, code: 'unsupported-keyword', message: 'tuples (`prefixItems` / `items: [...]`) are not supported' })
        field.items = { type: 'unknown' }
      } else {
        field.items = readField(undefined, s.items ?? {}, false, reader, `${path}.*`, stack)
      }
      const c: ModelConstraints = {}
      if (typeof s.minItems === 'number') c.minItems = s.minItems
      if (typeof s.maxItems === 'number') c.maxItems = s.maxItems
      return withConstraints(field, c)
    }
    default:
      if (Array.isArray(s.type)) reader.warn({ path, code: 'unsupported-type', message: `several types (${s.type.join(', ')}) — read as "unknown"` })
      else if (s.oneOf || s.anyOf) reader.warn({ path, code: 'unsupported-keyword', message: '`oneOf` / `anyOf` of different shapes — read as "unknown"' })
      return field
  }
}

function readProperties(s: Record<string, any>, reader: Reader, prefix: string, stack: string[]): ModelField[] {
  const properties: Record<string, JsonSchema> = isPlainObject(s.properties) ? s.properties : {}
  const required = new Set<string>(Array.isArray(s.required) ? s.required : [])
  const fields: ModelField[] = []
  for (const [name, property] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name
    if (/[.*\s[\]]/.test(name)) {
      reader.warn({ path, code: 'invalid-name', message: 'property names with dots, spaces, brackets or * can\'t be form fields — skipped' })
      continue
    }
    fields.push(readField(name, property, required.has(name), reader, path, stack) as ModelField)
  }

  // { dependentRequired: { credit_card: ['billing_address'] } } → billing_address: required_with:credit_card
  const dependent: Record<string, unknown> = { ...(isPlainObject(s.dependencies) ? s.dependencies : {}), ...(isPlainObject(s.dependentRequired) ? s.dependentRequired : {}) }
  for (const [trigger, targets] of Object.entries(dependent)) {
    if (!Array.isArray(targets)) continue
    for (const target of targets) {
      const field = fields.find((f) => f.name === target)
      if (!field) continue
      const rule: ModelRule = `required_with:${trigger}`
      field.rules = [...(field.rules ?? []), rule]
    }
  }
  return fields
}

export function fromJsonSchema(schema: JsonSchema, options: FromJsonSchemaOptions = {}): FormoModel {
  const refRoot = options.document ?? (isPlainObject(schema) ? schema : {})
  const reader: Reader = { refRoot, warn: options.onWarning ?? consoleWarning }
  let root: JsonSchema = schema
  if (options.root) {
    const ref = options.root.startsWith('#') ? options.root : ['$defs', 'definitions'].map((k) => `#/${k}/${options.root}`).find((r) => pointer(refRoot, r))
    root = ref ? { $ref: ref } : {}
    if (!ref) reader.warn({ path: '', code: 'unresolved-ref', message: `no "${options.root}" in $defs / definitions` })
  }
  const { schema: resolved, stack } = resolve(root, reader, '', [])
  const { schema: s } = unwrapNullable(resolved, reader, '', stack)
  if (typeOf(s) !== 'object') throw new Error('[formo] fromJsonSchema: the root schema must describe an object')

  const model: FormoModel = { version: MODEL_VERSION, fields: readProperties(s, reader, '', stack) }
  if (options.name) model.name = options.name
  if (typeof s.title === 'string') model.label = s.title
  return model
}
