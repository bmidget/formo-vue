/**
 * The Formo model — IR JSON, version 1. A PUBLIC, VERSIONED CONTRACT.
 *
 * A neutral description of the *data* a form edits (not of the UI): what a
 * backend (Laravel via Inertia props or a schema endpoint, Rails, an OpenAPI
 * document…) or a frontend schema (JSON Schema, Zod) knows about a model.
 * `formFromModel()` turns it into a Formo form definition.
 *
 *   { "version": 1, "name": "user", "fields": [
 *       { "name": "email", "type": "string", "format": "email", "required": true, "constraints": { "maxLength": 255 } },
 *       { "name": "role", "type": "enum", "options": [{ "value": "admin", "label": "Administrator" }] }
 *   ] }
 *
 * Compatibility rules for `version: 1`:
 *  - Only additive changes: new optional keys, new `format` values. Readers ignore keys they don't know.
 *  - A `type` a reader doesn't know is read as `unknown` (with a warning), never an error.
 *  - Anything that changes the meaning of existing keys bumps `version`.
 *
 * The machine-readable contract is `docs/schema/formo-model-v1.schema.json`.
 *
 * Pure TypeScript: no Vue, no DOM — see `scripts/check-pure.ts`.
 */

export const MODEL_VERSION = 1 as const

/** Every `type` of version 1 */
export const MODEL_FIELD_TYPES = [
  'string',
  /** Long text (textarea) */
  'text',
  'integer',
  'number',
  'boolean',
  /** `YYYY-MM-DD` */
  'date',
  /** Date and time */
  'datetime',
  /** `HH:MM[:SS]` */
  'time',
  /** One value out of `options` */
  'enum',
  'file',
  /** Nested fields (a subform) */
  'object',
  /** A list: `items` describes one element (objects → repeatable rows, enums → several choices, files → multiple) */
  'array',
  /** A foreign key / related models (`relation` says which) */
  'relation',
  /** Anything else — skipped unless `ui` says how to render it */
  'unknown',
] as const

export type ModelFieldType = (typeof MODEL_FIELD_TYPES)[number]

export interface ModelOption {
  value: string | number | boolean | null
  /** Shown to the user (translated by Formo like any text). Defaults to the humanized value */
  label?: string
  disabled?: boolean
}

/** Constraints in JSON Schema vocabulary — turned into Formo rules (and HTML attributes) */
export interface ModelConstraints {
  /** Strings: length */
  minLength?: number
  maxLength?: number
  /** Numbers: inclusive bounds */
  min?: number
  max?: number
  /** Numbers: exclusive bounds */
  exclusiveMin?: number
  exclusiveMax?: number
  /** Numbers: granularity (HTML `step`) */
  step?: number
  /** Strings: an ECMAScript regular expression source, unanchored (JSON Schema semantics) */
  pattern?: string
  /** Arrays: number of items */
  minItems?: number
  maxItems?: number
  /** Files: maximum size, in kilobytes (Laravel's unit) */
  maxSize?: number
  /** Files: allowed extensions, without the dot (`pdf`, `png`) */
  extensions?: string[]
  /** Files: allowed MIME types (`image/png`, `image/*`) */
  mimeTypes?: string[]
  /** Booleans: must be checked / accepted (Laravel `accepted`) */
  accepted?: boolean
}

/**
 * An extra client-side rule, in Formo notation: `'required_if:type,business'`,
 * `'matches:@password'`, `{ rule: 'regex', params: ['/^[a-z]+$/i'] }`. The name
 * must be a Formo built-in rule or one the app registers (`createFormo({ rules })`).
 */
export type ModelRule = string | { rule: string; params?: unknown[]; message?: string }

export interface ModelRelation {
  kind: 'belongsTo' | 'belongsToMany' | 'hasOne' | 'hasMany'
  /** Related model (informative: `role`, `App\\Models\\Role`) */
  model?: string
  /** Key of the related records holding the value (default `id`) */
  key?: string
}

export interface ModelField {
  /** The attribute name (a form alias: no dots) */
  name: string
  type: ModelFieldType
  /** Refines `type`: `email`, `url`, `password`, `tel`, `color`, `uuid`, `ip`, `search`… */
  format?: string
  label?: string
  /** Help text */
  description?: string
  placeholder?: string
  /** Must be filled (not just present): Laravel `required` semantics */
  required?: boolean
  /** Empty means `null` */
  nullable?: boolean
  default?: unknown
  /** Choices, for `enum` (and `relation`, or `array` items) */
  options?: ModelOption[]
  constraints?: ModelConstraints
  /** Extra client-side rules (conditional ones: `required_if:…`, cross-field ones: `matches:@…`) */
  rules?: ModelRule[]
  /** Rules only the server can check (`unique:users`, `exists:roles,id`) — informative, never run client-side */
  serverRules?: string[]
  /** Error messages by Formo rule name: `{ required: 'We need your email' }` */
  messages?: Record<string, string>
  /** Set by the server only (shown read-only in update forms, never submitted) */
  readOnly?: boolean
  /** Never sent back by the server (passwords): not pre-filled, optional in update forms */
  writeOnly?: boolean
  /** `false` = not mass-assignable (Laravel `$guarded`): never part of a form unless asked for explicitly */
  fillable?: boolean
  relation?: ModelRelation
  /** `object`: its fields */
  fields?: ModelField[]
  /** `array`: one element */
  items?: ModelItem
  /**
   * Formo definition keys merged over what's generated (`driver`, `component`,
   * `view`, `attr`, `props`, `message`…) — `x-formo` in JSON Schema / OpenAPI
   */
  ui?: Record<string, unknown>
  /** In-memory only (never serialized): validators attached by schema adapters (Zod) */
  [RUNTIME]?: FieldRuntime
}

/** The element of an `array` field (its `name` is ignored) */
export type ModelItem = Omit<ModelField, 'name'> & { name?: string }

export interface FormoModel {
  version: typeof MODEL_VERSION
  /** Suggested form alias (`user`) */
  name?: string
  label?: string
  fields: ModelField[]
  /**
   * Error messages for the whole form, keyed like Formo's `config.messages`:
   * `rule`, `field.rule`, `address.street.rule` (Laravel's `messages()`)
   */
  messages?: Record<string, string>
  /** Anything about where it comes from (`{ source: 'laravel', request: 'StoreUserRequest' }`) */
  meta?: Record<string, unknown>
  /** In-memory only (never serialized): validators attached by schema adapters (Zod) */
  [RUNTIME]?: ModelRuntime
}

/* -------------------------------------------------------------------------- */
/*  Runtime attachments (not part of the JSON contract)                        */
/* -------------------------------------------------------------------------- */

/**
 * Key of the validators a schema adapter (`fromZod`) attaches to a model. A
 * symbol: `JSON.stringify()` leaves it out, spreads keep it.
 */
export const RUNTIME: unique symbol = Symbol.for('formo.model.runtime')

/** `(value, params, ctx) => true | 'message'` — a Formo rule function */
export type RuntimeRule = (value: any, params: any[], ctx: any) => boolean | string | Promise<boolean | string>

/** What a form-level callback receives (a subset of Formo's `CallbackContext`) */
export interface RuntimeCallbackContext {
  values: Record<string, any>
  form: {
    setError(path: string, message: string): void
    find(pathOrAlias: string): { path: string } | undefined
    isIgnored(path: string): boolean
  }
}

export type RuntimeCallback = (ctx: RuntimeCallbackContext) => void | boolean | string | Promise<void | boolean | string>

export interface FieldRuntime {
  /** The field's custom refinements only (`validation: 'derived'`) — absent when it has none */
  refine?: RuntimeRule
  /** The field's whole schema (`validation: 'schema'`) */
  validate?: RuntimeRule
}

export interface ModelRuntime {
  /** Object-level refinements, errors mapped onto fields (`validation: 'derived'`) */
  refine?: RuntimeCallback
  /** The whole schema (`validation: 'schema'`) */
  validate?: RuntimeCallback
}

/* -------------------------------------------------------------------------- */
/*  Reading a model                                                            */
/* -------------------------------------------------------------------------- */

export interface ModelWarning {
  /** Dotted path of the field concerned (`''` = the model) */
  path: string
  /** Stable identifier: `unknown-type`, `unsupported-rule`, `unsupported-keyword`… */
  code: string
  message: string
}

export type WarningHandler = (warning: ModelWarning) => void

const seenWarnings = new Set<string>()

/** Default: `console.warn`, once per message. Pass `onWarning` to collect or silence them */
export const consoleWarning: WarningHandler = (warning) => {
  const text = `[formo] ${warning.path ? `${warning.path}: ` : ''}${warning.message}`
  if (seenWarnings.has(text)) return
  seenWarnings.add(text)
  // `console` is typed by the DOM lib only, but every JS runtime (Hermes included) has it
  ;(globalThis as { console?: { warn(message: string): void } }).console?.warn(text)
}

const TYPES = new Set<string>(MODEL_FIELD_TYPES)

function fail(path: string, message: string): never {
  throw new Error(`[formo] Invalid Formo model${path ? ` at ${path}` : ''}: ${message}`)
}

function readField(raw: unknown, path: string, warn: WarningHandler, isItem: boolean): ModelField {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(path, 'a field must be an object')
  const field = { ...(raw as ModelField) }
  if (!isItem) {
    if (typeof field.name !== 'string' || !field.name) fail(path, 'every field needs a `name`')
    if (/[.*\s[\]]/.test(field.name)) fail(path, `"${field.name}" is not a valid field name (no dots, spaces, brackets or *)`)
  }
  if (typeof field.type !== 'string' || !TYPES.has(field.type)) {
    warn({ path, code: 'unknown-type', message: `type "${String(field.type)}" isn't part of Formo model v1 — read as "unknown"` })
    field.type = 'unknown'
  }
  if (field.fields !== undefined) {
    if (!Array.isArray(field.fields)) fail(path, '`fields` must be an array')
    field.fields = readFields(field.fields, path, warn)
  }
  if (field.items !== undefined) field.items = readField(field.items, `${path}.*`, warn, true)
  if (field.options !== undefined && !Array.isArray(field.options)) fail(path, '`options` must be an array')
  return field
}

function readFields(list: unknown[], prefix: string, warn: WarningHandler): ModelField[] {
  const names = new Set<string>()
  return list.map((raw, i) => {
    const name = raw && typeof raw === 'object' ? (raw as ModelField).name : undefined
    const field = readField(raw, prefix ? `${prefix}.${name ?? i}` : String(name ?? i), warn, false)
    if (names.has(field.name)) fail(prefix, `duplicate field "${field.name}"`)
    names.add(field.name)
    return field
  })
}

/**
 * Read a Formo model (an object or its JSON): checks the version and the
 * structure, and returns a copy (runtime attachments kept).
 *
 *   parseModel(props.userForm)        // Inertia prop
 *   parseModel(await (await fetch('/formo/models/user')).json())
 */
export function parseModel(input: unknown, onWarning: WarningHandler = consoleWarning): FormoModel {
  const raw = typeof input === 'string' ? JSON.parse(input) : input
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('', 'expected an object')
  const model = raw as FormoModel
  if (!('version' in model)) fail('', 'missing `version` (expected `"version": 1`)')
  if (model.version !== MODEL_VERSION) {
    throw new Error(`[formo] Unsupported Formo model version ${JSON.stringify(model.version)} — this formo-vue reads version ${MODEL_VERSION}`)
  }
  if (!Array.isArray(model.fields)) fail('', '`fields` must be an array')
  return { ...model, fields: readFields(model.fields, '', onWarning) }
}

export function isFormoModel(value: unknown): value is FormoModel {
  return !!value && typeof value === 'object' && (value as FormoModel).version === MODEL_VERSION && Array.isArray((value as FormoModel).fields)
}
