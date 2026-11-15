import { isEmptyValue, isPlainObject, joinPath } from '../core/utils'
import {
  RUNTIME,
  consoleWarning,
  type FormoModel,
  type ModelField,
  type ModelItem,
  type RuntimeCallback,
  type RuntimeRule,
  type WarningHandler,
} from './ir'
import { fromJsonSchema, type JsonSchema } from './json-schema'

/**
 * Zod (v4) object schema → Formo model. No dependency on Zod: the schema is read
 * through its JSON Schema (`z.toJSONSchema`) and run through `safeParseAsync`.
 *
 * ```ts
 * import { z } from 'zod'
 * const User = z.object({
 *   name: z.string().min(2).meta({ title: 'Full name' }),
 *   email: z.email(),
 *   password: z.string().min(8).refine((v) => /\d/.test(v), 'Add a number'),
 *   password_confirmation: z.string(),
 * }).refine((u) => u.password === u.password_confirmation, { path: ['password_confirmation'], message: 'Passwords differ' })
 *
 * const form = useFormo(formFromModel(fromZod(User, { toJSONSchema: z.toJSONSchema })))
 * ```
 *
 * With `validation: 'derived'` (the default), Formo rules come from the schema's
 * constraints — Formo's messages, checklists, locales, Laravel lang files — and
 * what Formo can't express still runs through Zod: a field's `.refine()` /
 * `.superRefine()` as its last rule, object-level refinements when the form is
 * submitted (their `path` puts the error on the right field).
 * `validation: 'schema'` makes Zod the only validator.
 *
 * Empty inputs are read the Zod way before parsing: `''` / `null` → `undefined`
 * (or `null` for `.nullable()` fields), so `.optional()` fields accept empty inputs.
 */

export interface FromZodOptions {
  /** The model's name (suggested form alias) */
  name?: string
  /**
   * Zod's JSON Schema converter — `z.toJSONSchema`. Optional when the schema
   * can produce its JSON Schema itself (Standard JSON Schema / `.toJSONSchema()`)
   */
  toJSONSchema?: (schema: any, params?: any) => unknown
  onWarning?: WarningHandler
  /**
   * Called whenever a Zod refinement (`.refine()`, `.superRefine()`, `z.custom()`)
   * fails — a field's while it's validated, an object-level one on the field its
   * `path` names. For debugging, logging, analytics (the playground tags errors with it)
   */
  onRefinement?: (refinement: ZodRefinement) => void
}

export interface ZodRefinement {
  /** Form path the error is shown on (`password`, `phones[0].number`, `''` for the form) */
  path: string
  message: string
  /** `field`: the field's own refinement · `form`: an object-level one */
  level: 'field' | 'form'
}

/**
 * What's used from a Zod schema (duck-typed). Method syntax on purpose: Zod's
 * own signatures are narrower (literal `target`s, extra params) and must fit.
 */
export interface ZodLikeSchema {
  safeParseAsync?(value: unknown): Promise<{ success: boolean; error?: { issues: readonly ZodLikeIssue[] } }>
  '~standard'?: { validate(value: unknown): unknown; jsonSchema?: { input?(options: { target: string }): unknown } }
  [key: string]: any
}

export interface ZodLikeIssue {
  code?: string
  path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>
  message: string
}

/** How to turn form values into what the schema expects, per field */
interface Coercion {
  nullable?: boolean
  date?: boolean
  fields?: Record<string, Coercion>
  items?: Coercion
}

const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault', 'catch', 'readonly', 'nonoptional', 'lazy'])

const defOf = (schema: any): Record<string, any> | undefined => {
  const def = schema?._zod?.def
  return def && typeof def === 'object' ? def : undefined
}

/** Peel optional / nullable / default… and pipes (their input side) */
function unwrap(schema: any): any {
  let cur = schema
  for (let i = 0; i < 32; i++) {
    const def = defOf(cur)
    if (!def) return cur
    if (WRAPPERS.has(def.type) && def.innerType) cur = def.innerType
    else if (def.type === 'lazy' && typeof def.getter === 'function') cur = def.getter()
    else if (def.type === 'pipe' && def.in) cur = def.in
    else return cur
  }
  return cur
}

/** Every schema along the wrappers — refinements can sit on any of them */
function chain(schema: any, out: any[] = [], depth = 0): any[] {
  const def = defOf(schema)
  if (!def || depth > 32) return out
  out.push(schema)
  if (WRAPPERS.has(def.type) && def.innerType) chain(def.innerType, out, depth + 1)
  if (def.type === 'pipe') {
    chain(def.in, out, depth + 1)
    chain(def.out, out, depth + 1)
  }
  return out
}

/** Has `.refine()` / `.superRefine()` / `z.custom()`? `undefined`: can't tell (not a Zod 4 schema) */
function hasRefinements(schema: any): boolean | undefined {
  if (!defOf(schema)) return undefined
  return chain(schema).some((s) => {
    const def = defOf(s)!
    if (def.type === 'custom') return true
    return Array.isArray(def.checks) && def.checks.some((check: any) => (check?._zod?.def?.check ?? check?.def?.check) === 'custom')
  })
}

function shapeOf(schema: any): Record<string, any> | undefined {
  const inner = unwrap(schema)
  const def = defOf(inner)
  const shape = def?.type === 'object' ? def.shape : inner?.shape
  return shape && typeof shape === 'object' ? shape : undefined
}

function elementOf(schema: any): any {
  const inner = unwrap(schema)
  const def = defOf(inner)
  return def?.type === 'array' ? def.element : inner?.element
}

const isDate = (schema: any) => defOf(unwrap(schema))?.type === 'date'

/* ---- Parsing with form values ------------------------------------------------ */

function coerce(c: Coercion | undefined, value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return c?.nullable ? null : undefined
  if (!c) return value
  if (c.date && typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date
  }
  if (c.fields && isPlainObject(value)) {
    const out: Record<string, unknown> = { ...value }
    for (const [key, child] of Object.entries(c.fields)) out[key] = coerce(child, value[key])
    return out
  }
  if (c.items && Array.isArray(value)) return value.map((v) => coerce(c.items, v))
  return value
}

async function parse(schema: ZodLikeSchema, value: unknown): Promise<readonly ZodLikeIssue[]> {
  if (typeof schema.safeParseAsync === 'function') {
    const result = await schema.safeParseAsync(value)
    return result.success ? [] : (result.error?.issues ?? [])
  }
  const standard = schema['~standard']
  if (standard) {
    const result = (await standard.validate(value)) as { issues?: ZodLikeIssue[] }
    return result?.issues ?? []
  }
  throw new Error('[formo] fromZod: the schema has neither safeParseAsync() nor ~standard.validate()')
}

/** Keep only refinement issues (Standard Schema issues carry no code: keep them) */
const isRefinement = (issue: ZodLikeIssue) => issue.code === undefined || issue.code === 'custom'

type Report = ((refinement: ZodRefinement) => void) | undefined

function fieldRule(schema: ZodLikeSchema, c: Coercion, only: 'refinements' | 'all', name: string, report: Report): RuntimeRule {
  return async (value: unknown, _params: unknown[], ctx?: { path?: string }) => {
    // Like every Formo rule but `required`: refinements don't run on empty values
    if (only === 'refinements' && isEmptyValue(value)) return true
    const issues = await parse(schema, coerce(c, value))
    const issue = only === 'all' ? issues[0] : issues.find(isRefinement)
    if (issue && isRefinement(issue)) report?.({ path: ctx?.path ?? name, message: issue.message, level: 'field' })
    return issue ? issue.message : true
  }
}

/** An issue path → the form path of the closest rendered field (`undefined`: nothing to show it on) */
function issueTarget(path: ZodLikeIssue['path'], form: Parameters<RuntimeCallback>[0]['form']): string | undefined {
  const segments = (path ?? []).map((p) => (typeof p === 'object' && p !== null && 'key' in p ? p.key : p))
  if (!segments.length) return ''
  for (let n = segments.length; n > 0; n--) {
    const target = segments.slice(0, n).reduce<string>((acc, s) => joinPath(acc, typeof s === 'number' ? s : String(s)), '')
    if (form.isIgnored(target)) return undefined
    if (form.find(target)?.path === target) return target
  }
  return undefined
}

function formCallback(schema: ZodLikeSchema, c: Coercion, only: 'refinements' | 'all', report: Report): RuntimeCallback {
  const callback: RuntimeCallback = async ({ values, form }) => {
    const issues = await parse(schema, coerce(c, values))
    const shown = new Set<string>()
    for (const issue of issues) {
      if (only === 'refinements' && !isRefinement(issue)) continue
      const target = issueTarget(issue.path, form)
      if (target === undefined || shown.has(target)) continue
      shown.add(target)
      form.setError(target, issue.message)
      if (isRefinement(issue)) report?.({ path: target, message: issue.message, level: 'form' })
    }
    return shown.size ? false : undefined
  }
  // Named, so definitions read well in devtools / the playground
  Object.defineProperty(callback, 'name', { value: only === 'refinements' ? 'zodObjectRefinements' : 'zodSchema' })
  return callback
}

/**
 * Does anything need a form-level pass — an object-level refinement on the
 * schema, a nested object, a list or a row? (Fields' own refinements run as
 * their rules.) `true` when it can't tell.
 */
function hasObjectRefinements(schema: any, depth = 0): boolean {
  if (depth > 32 || hasRefinements(schema) !== false) return true
  const shape = shapeOf(schema)
  if (!shape) return false
  return Object.values(shape).some((child) => {
    const type = defOf(unwrap(child))?.type
    if (type === 'object') return hasObjectRefinements(child, depth + 1)
    if (type === 'array') {
      const element = elementOf(child)
      return defOf(unwrap(element))?.type === 'object' && (hasRefinements(child) !== false || hasObjectRefinements(element, depth + 1))
    }
    return false
  })
}

/* ---- Model ------------------------------------------------------------------- */

function toJsonSchema(schema: ZodLikeSchema, options: FromZodOptions): JsonSchema {
  const params = { io: 'input', unrepresentable: 'any' }
  const attempts: Array<() => unknown> = []
  if (options.toJSONSchema) attempts.push(() => options.toJSONSchema!(schema, params))
  if (typeof schema.toJSONSchema === 'function') attempts.push(() => schema.toJSONSchema(params))
  const standard = schema['~standard']?.jsonSchema
  if (typeof standard?.input === 'function') attempts.push(() => standard.input!({ target: 'draft-2020-12' }))
  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const json = attempt()
      if (isPlainObject(json)) return json
    } catch (error) {
      lastError = error
    }
  }
  const reason = lastError instanceof Error ? ` (${lastError.message})` : ''
  throw new Error(`[formo] fromZod: can't get this schema's JSON Schema${reason} — pass { toJSONSchema: z.toJSONSchema }`)
}

/** Walk the model next to the Zod shape: attach validators, note how to coerce values */
function attach(fields: Array<ModelField | ModelItem>, shape: Record<string, any> | undefined, report: Report): Record<string, Coercion> {
  const coercions: Record<string, Coercion> = {}
  for (const field of fields) {
    const name = field.name
    const schema = name !== undefined ? shape?.[name] : undefined
    if (!schema || name === undefined) continue
    const c: Coercion = {}
    if (field.nullable) c.nullable = true
    // z.date(): not representable in JSON Schema, but a date input for a form
    if (field.type === 'unknown' && isDate(schema)) field.type = 'date'
    if (isDate(schema)) c.date = true

    if (field.type === 'object') {
      c.fields = attach(field.fields ?? [], shapeOf(schema), report)
    } else if (field.type === 'array' && field.items?.type === 'object') {
      c.items = { fields: attach(field.items.fields ?? [], shapeOf(elementOf(schema)), report) }
    } else {
      const refine = hasRefinements(schema) !== false
      field[RUNTIME] = {
        validate: fieldRule(schema, c, 'all', name, report),
        ...(refine ? { refine: fieldRule(schema, c, 'refinements', name, report) } : {}),
      }
    }
    coercions[name] = c
  }
  return coercions
}

export function fromZod(schema: ZodLikeSchema, options: FromZodOptions = {}): FormoModel {
  const warn = options.onWarning ?? consoleWarning
  const model = fromJsonSchema(toJsonSchema(schema, options), { name: options.name, onWarning: warn })
  model.meta = { source: 'zod' }
  const root: Coercion = { fields: attach(model.fields, shapeOf(schema), options.onRefinement) }
  model[RUNTIME] = {
    // Only when there are object-level refinements: otherwise no extra parse on every submit
    ...(hasObjectRefinements(schema) ? { refine: formCallback(schema, root, 'refinements', options.onRefinement) } : {}),
    validate: formCallback(schema, root, 'all', options.onRefinement),
  }
  return model
}
