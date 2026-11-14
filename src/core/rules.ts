import * as vee from '@vee-validate/rules'
import type {
  ChecklistItem,
  FormoConfig,
  FieldNode,
  RuleContext,
  RuleFn,
  RuleItem,
  RulesInput,
  RuleSpec,
  StandardSchemaLike,
} from '../types'
import { getPath, interpolate, isEmptyValue, isPlainObject, toArray } from './utils'
import { isActive, looseEquals, refValue } from './conditions'
import { getTranslator } from '../i18n/translator'

/* -------------------------------------------------------------------------- */
/*  Built-in rules                                                             */
/* -------------------------------------------------------------------------- */

/** PHP regex strings (`/^\d+$/i`) and plain strings to RegExp */
export function toRegExp(pattern: unknown): RegExp {
  if (pattern instanceof RegExp) return pattern
  const str = String(pattern)
  const m = str.match(/^([/#~@;%`])(.*)\1([a-z]*)$/s)
  if (m) {
    // PHP-only flags (x, u, D, ...) are dropped
    const flags = m[3].replace(/[^gimsuy]/g, '')
    return new RegExp(m[2], flags)
  }
  return new RegExp(str)
}

function toFiles(value: unknown): File[] {
  if (!value) return []
  if (typeof FileList !== 'undefined' && value instanceof FileList) return Array.from(value)
  return toArray(value as File | File[]).filter(Boolean)
}

/** `1M`, `500K`, `20B`, `1024` (bytes) → KB */
function parseSize(size: unknown): number {
  const m = String(size).trim().match(/^([\d.]+)\s*([BKMG])?B?$/i)
  if (!m) return Number(size) / 1024
  const n = Number(m[1])
  switch ((m[2] || 'B').toUpperCase()) {
    case 'G':
      return n * 1024 * 1024
    case 'M':
      return n * 1024
    case 'K':
      return n
    default:
      return n / 1024
  }
}

const num = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : Number(v))

/** Rules that make a field required only under a condition (shown with the required marker when it holds) */
export const conditionalRequiredRules = new Set([
  'required_if',
  'required_unless',
  'required_with',
  'required_with_all',
  'required_without',
  'required_without_all',
])
/** Rules that remove a field from validation and from the submitted values (Laravel `exclude_*`) */
export const excludeRules = new Set(['exclude_if', 'exclude_unless'])

/**
 * Does the condition of a conditional rule hold? Uses the raw params so both
 * Laravel's `required_if:type,business` and `required_if:@type,business` work.
 */
export function conditionHolds(
  rule: string,
  ctx: Pick<RuleContext, 'values' | 'parentValues' | 'rawParams'>,
): boolean {
  const raw = (ctx.rawParams ?? []).map((p) => (typeof p === 'string' ? p.trim() : p))
  const valueOf = (ref: unknown) => refValue(String(ref), ctx)
  switch (rule) {
    case 'required_if':
    case 'exclude_if': {
      const [ref, ...expected] = raw
      const value = valueOf(ref)
      return expected.length ? expected.some((e) => looseEquals(value, e)) : isActive(value)
    }
    case 'required_unless':
    case 'exclude_unless': {
      const [ref, ...expected] = raw
      const value = valueOf(ref)
      return expected.length ? !expected.some((e) => looseEquals(value, e)) : !isActive(value)
    }
    case 'required_with':
      return raw.some((ref) => isActive(valueOf(ref)))
    case 'required_with_all':
      return raw.length > 0 && raw.every((ref) => isActive(valueOf(ref)))
    case 'required_without':
      return raw.some((ref) => !isActive(valueOf(ref)))
    case 'required_without_all':
      return raw.length > 0 && raw.every((ref) => !isActive(valueOf(ref)))
    default:
      return false
  }
}

/**
 * Built-in rules. Names follow VeeValidate (`@vee-validate/rules`), Kohana names
 * are accepted as aliases (see `ruleAliases`). Every rule except `required`
 * passes on empty values, like Kohana's Validation.
 */
export const builtinRules: Record<string, RuleFn> = {
  required: (v) => vee.required(v),
  email: (v) => vee.email(v),
  url: (v, p) => vee.url(v, p.length ? [p[0] as string] : {}),
  min: (v, p) => vee.min(v, [p[0] as number]),
  max: (v, p) => vee.max(v, [p[0] as number]),
  length: (v, p) => vee.length(v, [p[0] as number]),
  numeric: (v) => vee.numeric(v),
  integer: (v) => vee.integer(v),
  digits: (v, p) => vee.digits(v, [p[0] as number]),
  between: (v, p) => vee.between(v, [p[0] as number, p[1] as number]) as boolean,
  min_value: (v, p) => vee.min_value(v, [p[0] as number]),
  max_value: (v, p) => vee.max_value(v, [p[0] as number]),
  regex: (v, p) => vee.regex(v, [toRegExp(p[0])]),
  alpha: (v) => vee.alpha(v, {}),
  alpha_num: (v) => vee.alpha_num(v, {}),
  alpha_dash: (v) => vee.alpha_dash(v, {}),
  alpha_spaces: (v) => vee.alpha_spaces(v, {}),
  is: (v, p) => vee.is(v, [p[0]]),
  is_not: (v, p) => vee.is_not(v, [p[0]]),
  one_of: (v, p) => vee.one_of(v, p.flat()),
  not_one_of: (v, p) => vee.not_one_of(v, p.flat()),
  ext: (v, p) => vee.ext(toFiles(v), p.flat() as string[]),
  mimes: (v, p) => vee.mimes(toFiles(v), p.flat() as string[]),
  image: (v) => vee.image(toFiles(v)),
  /** size in KB */
  size: (v, p) => vee.size(toFiles(v), [p[0] as number]),
  dimensions: (v, p) => vee.dimensions(toFiles(v), [p[0] as number, p[1] as number]),

  /** `confirmed:@password` — equal to another field */
  confirmed: (v, p) => isEmptyValue(v) && isEmptyValue(p[0]) || String(v ?? '') === String(p[0] ?? ''),

  /**
   * Kohana `matches`. Supports both `['matches', [':validation', 'password_confirm', 'password']]`
   * (Kohana signature) and `'matches:@password'` / `['matches', ['password']]`.
   */
  matches: (v, p, ctx) => {
    if (p.length >= 3 && isPlainObject(p[0])) {
      return String(p[0][p[1]] ?? '') === String(p[0][p[2]] ?? '')
    }
    const other = typeof p[0] === 'string' && !(p[0] in ctx.parentValues) ? p[0] : getPath(ctx.parentValues, String(p[0]))
    return String(v ?? '') === String(other ?? '')
  },

  /** A number with optional decimal places limit: `decimal`, `decimal:2` */
  decimal: (v, p) => {
    if (isEmptyValue(v)) return true
    const places = p[0] !== undefined && p[0] !== '' ? Number(p[0]) : undefined
    const re = places === undefined ? /^-?\d*\.?\d+$/ : new RegExp(`^-?\\d+(\\.\\d{1,${places}})?$`)
    return re.test(String(v))
  },
  date: (v) => isEmptyValue(v) || !Number.isNaN(Date.parse(String(v))),
  /** Kohana `phone`: 7, 10 or 11 digits once formatting is stripped (custom lengths as params) */
  phone: (v, p) => {
    if (isEmptyValue(v)) return true
    const lengths = p.length ? p.flat().map(Number) : [7, 10, 11]
    return lengths.includes(String(v).replace(/\D/g, '').length)
  },
  color: (v) => isEmptyValue(v) || /^#?([0-9a-f]{3}){1,2}$/i.test(String(v)),
  ip: (v) =>
    isEmptyValue(v) ||
    /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(String(v)) ||
    /^[0-9a-f:]+$/i.test(String(v)) && String(v).includes(':'),
  /** At least N items (checkboxes, multiple selects) */
  min_items: (v, p) => isEmptyValue(v) || toArray(v).length >= Number(p[0]),
  max_items: (v, p) => isEmptyValue(v) || toArray(v).length <= Number(p[0]),
  /** Kohana Upload::size style limits (`1M`, `500K`) */
  upload_size: (v, p) => {
    const files = toFiles(v)
    const kb = parseSize(p[0])
    return files.every((f) => f.size / 1024 <= kb)
  },
  /** Laravel `Password::mixedCase()`: at least one uppercase and one lowercase letter */
  mixed_case: (v) => isEmptyValue(v) || (/\p{Lu}/u.test(String(v)) && /\p{Ll}/u.test(String(v))),
  /** Laravel `Password::letters()`: at least one letter */
  letters: (v) => isEmptyValue(v) || /\p{L}/u.test(String(v)),
  /** Laravel `Password::numbers()`: at least one number */
  numbers: (v) => isEmptyValue(v) || /\p{N}/u.test(String(v)),
  /** Laravel `Password::symbols()`: at least one symbol */
  symbols: (v) => isEmptyValue(v) || /[\p{Z}\p{S}\p{P}]/u.test(String(v)),
  /* Laravel's conditional requirements. The first param names another field (`type` or `@type`) */
  /** `required_if:type,business` — required when `type` is one of the values (or truthy when none given) */
  required_if: (v, _p, ctx) => !conditionHolds('required_if', ctx) || vee.required(v),
  /** `required_unless:type,personal` */
  required_unless: (v, _p, ctx) => !conditionHolds('required_unless', ctx) || vee.required(v),
  /** `required_with:phone,email` — required when any of them is filled */
  required_with: (v, _p, ctx) => !conditionHolds('required_with', ctx) || vee.required(v),
  /** `required_with_all:a,b` — required when all of them are filled */
  required_with_all: (v, _p, ctx) => !conditionHolds('required_with_all', ctx) || vee.required(v),
  /** `required_without:phone` — required when any of them is empty */
  required_without: (v, _p, ctx) => !conditionHolds('required_without', ctx) || vee.required(v),
  /** `required_without_all:phone,email` — required when all of them are empty */
  required_without_all: (v, _p, ctx) => !conditionHolds('required_without_all', ctx) || vee.required(v),
  /** `exclude_if:same_as_billing,true` — the field is skipped entirely (no rules, not submitted) */
  exclude_if: () => true,
  /** `exclude_unless:type,business` */
  exclude_unless: () => true,
  /** HTML5 `min` / `max` / `step` attributes of number & range inputs (Formo::range) */
  html5_range: (v, _p, ctx) => {
    if (isEmptyValue(v)) return true
    const value = num(v)
    if (Number.isNaN(value)) return false
    const { min, max, step } = ctx.node.attr as Record<string, unknown>
    if (min !== undefined && min !== '' && value < Number(min)) return false
    if (max !== undefined && max !== '' && value > Number(max)) return false
    if (step !== undefined && step !== '' && step !== 'any') {
      const base = min !== undefined && min !== '' ? Number(min) : 0
      const ratio = (value - base) / Number(step)
      return Math.abs(ratio - Math.round(ratio)) < 1e-8
    }
    return true
  },
}

/** Kohana / Formo rule names → built-in names */
export const ruleAliases: Record<string, string> = {
  not_empty: 'required',
  min_length: 'min',
  max_length: 'max',
  exact_length: 'length',
  digit: 'numeric',
  alpha_numeric: 'alpha_num',
  range: 'between',
  equals: 'is',
  in_array: 'one_of',
  'Formo::range': 'html5_range',
  'Upload::not_empty': 'required',
  'Upload::type': 'ext',
  'Upload::size': 'upload_size',
  'Upload::image': 'image',
}

/** Rules that never fail (Upload::valid only makes sense server side) */
const noopRules = new Set(['Upload::valid'])

export function canonicalRuleName(name: string): string {
  if (ruleAliases[name]) return ruleAliases[name]
  const stripped = name.replace(/^Valid::/, '')
  return ruleAliases[stripped] ?? stripped
}

/* -------------------------------------------------------------------------- */
/*  Parsing: any notation → RuleSpec[]                                         */
/* -------------------------------------------------------------------------- */

export function isStandardSchema(value: unknown): value is StandardSchemaLike {
  return !!value && (typeof value === 'object' || typeof value === 'function') && '~standard' in (value as object)
}

/** vee-validate typed schemas (`toTypedSchema(...)`) and yup schemas are passed through untouched */
export function isVeeSchema(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    ((value as any).__type === 'VVTypedSchema' || (value as any).__isYupSchema__ === true)
  )
}

const isPseudo = (v: unknown) => typeof v === 'string' && /^:[a-z_]+$/.test(v)

/** `'min:3'` → `{ name: 'min', params: ['3'] }` */
function parseRuleString(str: string): RuleSpec {
  const idx = str.indexOf(':')
  // `Formo::range` / `Valid::email` have `::` — that's part of the name
  if (idx === -1 || str.slice(idx, idx + 2) === '::') {
    const nsIdx = str.indexOf(':', str.indexOf('::') + 2)
    if (str.includes('::') && nsIdx !== -1) {
      return { name: str.slice(0, nsIdx), params: str.slice(nsIdx + 1).split(',') }
    }
    return { name: str.trim(), params: [] }
  }
  return { name: str.slice(0, idx).trim(), params: str.slice(idx + 1).split(',') }
}

function parseRuleItem(item: RuleItem): RuleSpec[] {
  if (typeof item === 'string') {
    return item
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(parseRuleString)
  }
  if (typeof item === 'function') {
    return [{ name: item.name || 'custom', params: [], fn: item }]
  }
  if (isStandardSchema(item)) {
    return [{ name: 'schema', params: [], schema: item }]
  }
  if (Array.isArray(item)) {
    const [rule, params = []] = item
    const list = toArray(params as unknown[])
    if (typeof rule === 'function') {
      return [{ name: rule.name || 'custom', params: list, callable: rule, kohana: list.some(isPseudo) }]
    }
    return [{ name: String(rule), params: list, kohana: list.some(isPseudo) }]
  }
  if (isPlainObject(item) && !('rule' in item)) {
    // VeeValidate object notation inside a list
    return parseRules(item as Record<string, unknown>).specs
  }
  if (isPlainObject(item) && 'rule' in item) {
    const { rule, params = [], message, label } = item as {
      rule: string | RuleFn
      params?: unknown[]
      message?: string
      label?: string
    }
    if (typeof rule === 'function') return [{ name: rule.name || 'custom', params, fn: rule, message, label }]
    return [{ name: rule, params, message, label, kohana: params.some(isPseudo) }]
  }
  return []
}

/** Is this array a single Kohana tuple (`['min_length', [':value', 3]]`) rather than a list of rules? */
function isSingleTuple(input: unknown[]): boolean {
  if (input.length !== 2 || typeof input[0] !== 'string' || !Array.isArray(input[1])) return false
  const params = input[1] as unknown[]
  return params.some(isPseudo) || (params.length > 0 && typeof params[0] !== 'string' && typeof params[0] !== 'function')
}

export function parseRules(input: RulesInput | undefined | null): { specs: RuleSpec[]; veeSchema?: unknown } {
  if (input === undefined || input === null || (input as unknown) === false) return { specs: [] }
  if (isVeeSchema(input)) return { specs: [], veeSchema: input }

  if (Array.isArray(input)) {
    if (isSingleTuple(input)) return { specs: parseRuleItem(input as RuleItem) }
    return { specs: (input as RuleItem[]).flatMap(parseRuleItem) }
  }

  if (isPlainObject(input) && !('rule' in input) && !isStandardSchema(input)) {
    // VeeValidate object notation: { required: true, min: 3, between: [1, 10], regex: /x/ }
    const specs: RuleSpec[] = []
    for (const [name, value] of Object.entries(input)) {
      if (value === false || value === undefined || value === null) continue
      if (typeof value === 'function') {
        specs.push({ name, params: [], fn: value as RuleFn })
        continue
      }
      const params = value === true ? [] : Array.isArray(value) ? value : isPlainObject(value) ? Object.values(value) : [value]
      specs.push({ name, params })
    }
    return { specs }
  }

  return { specs: parseRuleItem(input as RuleItem) }
}

export function hasRule(specs: RuleSpec[], name: string): boolean {
  return specs.some((s) => canonicalRuleName(s.name) === name)
}

/* -------------------------------------------------------------------------- */
/*  Running rules                                                              */
/* -------------------------------------------------------------------------- */

export interface RunRulesOptions {
  rules: Record<string, RuleFn>
  config: FormoConfig
  /** Label for `@field` references in messages */
  labelFor: (pathOrAlias: string) => string
  /** Alias of the group the field belongs to (for `group.field.rule` message lookups) */
  parentAlias?: string | number
  /** Override `config.bails` (fields showing `all` errors or a checklist run every rule) */
  bails?: boolean
}

/** Resolve `@other_field` to its value, relative to the group first */
function resolveRef(ref: string, ctx: RuleContext): unknown {
  const path = ref.slice(1)
  const relative = getPath(ctx.parentValues, path)
  return relative !== undefined ? relative : getPath(ctx.values, path)
}

function substitute(param: unknown, value: unknown, ctx: RuleContext): unknown {
  if (typeof param !== 'string') return param
  if (param.startsWith('@') && param.length > 1) return resolveRef(param, ctx)
  switch (param) {
    case ':value':
      return value
    case ':field':
    case ':alias':
      return ctx.alias
    case ':validation':
    case ':form_val':
    case ':values':
      return ctx.parentValues
    case ':form':
      return ctx.form
    case ':formo':
      return ctx.node
    default:
      return param
  }
}

/** What `:param1`, `:other`... show in messages (field refs become labels) */
function displayParams(spec: RuleSpec, name: string, ctx: RuleContext, opts: RunRulesOptions) {
  const shown: unknown[] = spec.params
    .filter((p) => !(spec.kohana && isPseudo(p)))
    .map((p) => (typeof p === 'string' && p.startsWith('@') ? opts.labelFor(p.slice(1)) : p))

  const extra: Record<string, unknown> = { params: shown }

  if (name === 'matches' || name === 'confirmed') {
    const refs = spec.params.filter((p) => typeof p === 'string' && !isPseudo(p)) as string[]
    const other = refs.map((r) => r.replace(/^@/, '')).filter((r) => r !== String(ctx.alias)).pop()
    extra.other = other ? opts.labelFor(other) : ''
  }
  if (name === 'html5_range') {
    const { min = '', max = '', step = '' } = ctx.node.attr as Record<string, unknown>
    Object.assign(extra, { min, max, step })
  }

  shown.forEach((p, i) => (extra[`param${i + 1}`] = p))
  return extra
}

/** Laravel's names for each rule's params, so Laravel lang files (`:min`, `:max`, `:size`…) interpolate */
const laravelParamNames: Record<string, string[]> = {
  min: ['min'],
  max: ['max'],
  length: ['size'],
  digits: ['digits'],
  between: ['min', 'max'],
  min_value: ['min'],
  max_value: ['max'],
  min_items: ['min'],
  max_items: ['max'],
  size: ['max'],
  upload_size: ['max'],
  dimensions: ['width', 'height'],
}

/** Everything a message can use: `:field`/`:attribute`, `:value`, `:param1`…, `:params`, `:other` + Laravel names */
function messageParams(spec: RuleSpec | undefined, name: string, value: unknown, ctx: RuleContext, opts: RunRulesOptions) {
  const extra: Record<string, unknown> = spec ? displayParams(spec, name, ctx, opts) : {}
  const named: Record<string, unknown> = { value: Array.isArray(value) ? value.join(', ') : value }
  laravelParamNames[name]?.forEach((n, i) => (named[n] = extra[`param${i + 1}`]))
  if (['one_of', 'not_one_of', 'ext', 'mimes'].includes(name)) named.values = extra.params
  if (spec && (conditionalRequiredRules.has(name) || excludeRules.has(name))) {
    // Laravel: "The :attribute field is required when :other is :value."
    const [ref, ...compared] = spec.params
    named.other = ref !== undefined ? opts.labelFor(String(ref).replace(/^@/, '')) : ''
    named.value = compared.join(', ')
    named.values = compared
  }
  return { ...extra, ...named, field: ctx.label, attribute: ctx.label }
}

/**
 * The final (translated, interpolated) message for a failed rule. Formo's lookup order:
 *
 *  1. the rule's own `message`, the field's `errorMessages[rule]` (run through `translate`)
 *  2. `path.rule`, `parent.alias.rule`, `alias.rule`, `path.default`, `alias.default`, `rule`, `default`
 *     — each looked up in the overrides, the i18n bridge and the locale catalogs
 */
export function buildMessage(
  name: string,
  originalName: string,
  spec: RuleSpec | undefined,
  value: unknown,
  ctx: RuleContext,
  opts: RunRulesOptions,
): string {
  const params = messageParams(spec, name, value, ctx, opts)
  const tr = getTranslator(opts.config)
  const explicit = spec?.message || ctx.node.errorMessages[originalName] || ctx.node.errorMessages[name]
  if (explicit) return interpolate(tr.text(explicit), params)

  const alias = String(ctx.alias)
  const generic = ctx.path.replace(/\[\d+\]/g, '')
  const keys = [
    `${ctx.path}.${originalName}`,
    `${ctx.path}.${name}`,
    `${generic}.${name}`,
    opts.parentAlias !== undefined ? `${opts.parentAlias}.${alias}.${name}` : '',
    `${alias}.${originalName}`,
    `${alias}.${name}`,
    `${ctx.path}.default`,
    `${alias}.default`,
    originalName,
    name,
  ].filter(Boolean)
  const found = tr.message([...new Set(keys)], params)
  if (found) return found
  // A custom rule with a checklist label says more than ":field is invalid"
  if (spec?.label) return interpolate(tr.text(spec.label), params)
  return tr.message(['default'], params) ?? interpolate(':field is invalid', params)
}

async function runSchema(schema: StandardSchemaLike, value: unknown): Promise<string | true> {
  const result = (await schema['~standard'].validate(value)) as { issues?: Array<{ message: string }> }
  if (result && Array.isArray(result.issues) && result.issues.length) return result.issues[0].message
  return true
}

/** The name a spec runs under (Kohana aliases resolved, inline functions keep theirs) */
function specName(spec: RuleSpec): string {
  return spec.fn || spec.callable || spec.schema ? spec.name : canonicalRuleName(spec.name)
}

/** Run one rule. `message` is set when it fails */
async function runRule(
  spec: RuleSpec,
  value: unknown,
  ctx: Omit<RuleContext, 'rule'>,
  opts: RunRulesOptions,
): Promise<{ name: string; passed: boolean; message?: string }> {
  const name = specName(spec)
  if (noopRules.has(spec.name)) return { name, passed: true }
  const ruleCtx: RuleContext = { ...ctx, rule: name, rawParams: spec.params }

  let result: boolean | string | undefined | void

  if (spec.schema) {
    result = await runSchema(spec.schema, value)
    if (typeof result === 'string' && (ctx.node.errorMessages.schema || spec.message)) {
      result = false
    }
  } else if (spec.callable) {
    // Kohana style callable: params are passed positionally after substitution
    result = spec.params.length
      ? await spec.callable(...spec.params.map((p) => substitute(p, value, ruleCtx)))
      : await spec.callable(value, ruleCtx)
  } else {
    const fn = spec.fn ?? opts.rules[name]
    if (!fn) {
      throw new Error(`[formo] Unknown validation rule "${spec.name}". Register it with createFormo({ rules: { ${name}: fn } }).`)
    }
    let params = spec.params.map((p) => substitute(p, value, ruleCtx))
    if (spec.kohana && !spec.fn) {
      // Named Kohana rules receive the value separately, drop the `:value` placeholder
      params = params.filter((_p, i) => spec.params[i] !== ':value')
    }
    result = await fn(value, params, ruleCtx)
  }

  if (result === true || result === undefined) return { name, passed: true }

  const message =
    typeof result === 'string'
      ? getTranslator(opts.config).text(result) // messages returned by rules/schemas are translatable texts
      : buildMessage(name, spec.name, spec, value, ruleCtx, opts)
  return { name, passed: false, message }
}

/**
 * Run a list of rules against a value. Returns error messages (empty when valid).
 */
export async function runRules(
  specs: RuleSpec[],
  value: unknown,
  ctx: Omit<RuleContext, 'rule'>,
  opts: RunRulesOptions,
): Promise<string[]> {
  const errors: string[] = []
  const bails = opts.bails ?? opts.config.bails

  for (const spec of specs) {
    const { passed, message } = await runRule(spec, value, ctx, opts)
    if (passed) continue
    errors.push(message!)
    if (bails) break
  }

  return errors
}

/** Requirement text for a rule in a checklist (`null` when none is configured), translated and interpolated */
export function resolveRequirement(
  name: string,
  originalName: string,
  spec: RuleSpec,
  value: unknown,
  ctx: RuleContext,
  opts: RunRulesOptions,
): string | null {
  const tr = getTranslator(opts.config)
  const params = messageParams(spec, name, value, ctx, opts)
  const explicit = spec.label || ctx.node.requirements[originalName] || ctx.node.requirements[name]
  if (explicit) return interpolate(tr.text(explicit), params)
  const alias = String(ctx.alias)
  const keys = [`${ctx.path}.${name}`, `${alias}.${name}`, originalName, name]
  return tr.requirement([...new Set(keys)], params) ?? null
}

/**
 * Evaluate every rule independently for a checklist. Empty values meet no
 * requirement (rules normally pass on empty values; only `required` fails).
 * `required` itself is left out unless it has a label — it's implied.
 */
export async function evaluateChecklist(
  specs: RuleSpec[],
  value: unknown,
  ctx: Omit<RuleContext, 'rule'>,
  opts: RunRulesOptions,
): Promise<ChecklistItem[]> {
  const empty = isEmptyValue(value)
  const items: ChecklistItem[] = []

  for (const spec of specs) {
    const name = specName(spec)
    if (noopRules.has(spec.name)) continue
    const ruleCtx: RuleContext = { ...ctx, rule: name, rawParams: spec.params }
    // `required` (and its conditional variants / exclude directives) are implied — listed only with a label
    const implied = name === 'required' || conditionalRequiredRules.has(name) || excludeRules.has(name)
    if (implied && !spec.label && !ctx.node.requirements[name] && !ctx.node.requirements[spec.name]) continue

    let passed: boolean
    let message: string
    if (empty && !implied) {
      passed = false
      message = buildMessage(name, spec.name, spec, value, ruleCtx, opts)
    } else {
      const result = await runRule(spec, value, ctx, opts)
      passed = result.passed
      message = result.message ?? buildMessage(name, spec.name, spec, value, ruleCtx, opts)
    }

    const label = resolveRequirement(name, spec.name, spec, value, ruleCtx, opts) ?? message
    items.push({ rule: name, label, passed, message })
  }

  return items
}

/** The rules a field will actually run: driver rules (HTML5 types) + html constraints + its own */
export function collectFieldRules(
  node: FieldNode,
  driverRules: RuleItem[] | undefined,
  config: FormoConfig,
): RuleSpec[] {
  const own = node.rules
  const extra: RuleSpec[] = []

  if (config.htmlConstraintRules) {
    const attr = node.attr
    if (attr.required === true || attr.required === '' || attr.required === 'required') extra.push({ name: 'required', params: [] })
    if (attr.minlength !== undefined) extra.push({ name: 'min', params: [attr.minlength] })
    if (attr.maxlength !== undefined) extra.push({ name: 'max', params: [attr.maxlength] })
    if (typeof attr.pattern === 'string') extra.push({ name: 'regex', params: [`^(?:${attr.pattern})$`] })
  }

  for (const item of driverRules ?? []) extra.push(...parseRuleItem(item))

  // Don't duplicate rules the user already defined (user's win, their params may differ)
  const ownNames = new Set(own.map((s) => canonicalRuleName(s.name)))
  const merged = extra.filter((s, i, all) => {
    const n = canonicalRuleName(s.name)
    return !ownNames.has(n) && all.findIndex((o) => canonicalRuleName(o.name) === n) === i
  })

  // `required` (and conditional variants) run first so "must not be empty" wins over format errors
  const all = [...merged, ...own]
  const first = (s: RuleSpec) => {
    const n = canonicalRuleName(s.name)
    return n === 'required' || conditionalRequiredRules.has(n)
  }
  return [...all.filter(first), ...all.filter((s) => !first(s))]
}

/** Is the field required right now? (`required`, or a conditional rule whose condition holds) */
export function isCurrentlyRequired(
  specs: RuleSpec[],
  ctx: Pick<RuleContext, 'values' | 'parentValues'>,
): boolean {
  return specs.some((spec) => {
    const name = canonicalRuleName(spec.name)
    if (name === 'required') return true
    return conditionalRequiredRules.has(name) && conditionHolds(name, { ...ctx, rawParams: spec.params })
  })
}

/** Does an `exclude_if` / `exclude_unless` rule currently take this field out? */
export function isExcludedByRules(specs: RuleSpec[], ctx: Pick<RuleContext, 'values' | 'parentValues'>): boolean {
  return specs.some((spec) => {
    const name = canonicalRuleName(spec.name)
    return excludeRules.has(name) && conditionHolds(name, { ...ctx, rawParams: spec.params })
  })
}

export function isRequiredNode(node: FieldNode, driverRules?: RuleItem[], config?: FormoConfig): boolean {
  const specs = config ? collectFieldRules(node, driverRules, config) : node.rules
  return hasRule(specs, 'required')
}

