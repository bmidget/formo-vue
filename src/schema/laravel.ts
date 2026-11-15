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
 * Laravel validation rules → Formo model. Pass what a FormRequest has — through
 * Inertia props or a schema endpoint — and get the fields, their types, labels
 * and client-side rules:
 *
 * ```php
 * // In a controller (Inertia): rules as strings — Rule::in() & co. are Stringable
 * return Inertia::render('Users/Edit', [
 *     'user' => $user,
 *     'userForm' => FormoRules::from(UpdateUserRequest::createFrom(request())),   // see docs/schema.md
 * ]);
 * ```
 * ```ts
 * const model = fromLaravel(props.userForm)   // { rules, attributes, messages }
 * ```
 *
 * - Types come from the rules: `string`, `integer`, `numeric`, `boolean`, `date`,
 *   `email`, `file` / `image` / `mimes`, `array`, `in:`, `exists:` on `*_id` (a relation)…
 * - `min` / `max` / `between` / `size` follow the field's type, like Laravel
 *   (length, value, item count, or kilobytes)
 * - `address.street` → a subform, `phones.*.number` → repeatable rows, `tags.*` with `in:` → checkboxes
 * - `confirmed` adds the `password_confirmation` field Laravel expects
 * - `required_if` / `required_with`… / `exclude_if`, `same`, `different`, `gt`… run client-side
 * - `unique`, `exists`, `current_password`… are server-only: listed in `serverRules`, never run
 * - `attributes()` become labels, `messages()` error messages (Laravel placeholders work)
 */
export interface LaravelRulesInput {
  /** `rules()`: `{ email: 'required|email|max:255', 'phones.*.number': ['required', 'string'] }` */
  rules: Record<string, string | unknown[]>
  /** `attributes()`: labels — `{ email: 'e-mail address', 'phones.*.number': 'number' }` */
  attributes?: Record<string, string>
  /** `messages()`: `{ 'email.required': 'We need your email', 'min.string': '…' }` */
  messages?: Record<string, string>
  /** Suggested form alias */
  name?: string
  label?: string
}

export interface FromLaravelOptions {
  /**
   * Custom rules your app also registers client-side (`createFormo({ rules })`):
   * passed through as they are instead of being reported as server-only
   */
  clientRules?: string[]
  onWarning?: WarningHandler
}

interface LaravelRule {
  name: string
  params: string[]
  raw: string
}

interface RuleNode {
  /** Laravel key (`phones.*.number`) */
  key: string
  name?: string
  rules: LaravelRule[]
  children: Map<string, RuleNode>
  item?: RuleNode
}

/* ---- Parsing ------------------------------------------------------------- */

/** `a,"b, c",d` → ['a', 'b, c', 'd'] (Laravel reads params with str_getcsv; Rule::in() quotes its values) */
export function parseCsv(input: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  let wasQuoted = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') quoted = false
      else current += ch
      continue
    }
    if (ch === '"' && current.trim() === '') {
      quoted = true
      wasQuoted = true
      current = ''
    } else if (ch === ',') {
      out.push(wasQuoted ? current : current.trim())
      current = ''
      wasQuoted = false
    } else current += ch
  }
  out.push(wasQuoted ? current : current.trim())
  return out
}

/** `'min:3'` → `{ name: 'min', params: ['3'] }` (regex patterns keep their commas) */
export function parseLaravelRule(text: string): LaravelRule {
  const idx = text.indexOf(':')
  if (idx === -1) return { name: text.trim().toLowerCase(), params: [], raw: text.trim() }
  const name = text.slice(0, idx).trim().toLowerCase()
  const rest = text.slice(idx + 1)
  return { name, params: name === 'regex' || name === 'not_regex' ? [rest] : parseCsv(rest), raw: text.trim() }
}

function ruleList(value: unknown, key: string, warn: WarningHandler): LaravelRule[] {
  if (typeof value === 'string') return value.split('|').filter((r) => r.trim()).map(parseLaravelRule)
  if (!Array.isArray(value)) {
    warn({ path: key, code: 'invalid-rules', message: 'rules must be a string or an array' })
    return []
  }
  const out: LaravelRule[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (item.trim()) out.push(parseLaravelRule(item))
    } else {
      warn({
        path: key,
        code: 'rule-object',
        message: 'a rule object reached the client (json_encode turns it into {}) — cast Stringable rules to strings server-side, or describe it in the Formo model',
      })
    }
  }
  return out
}

function newNode(key: string, name?: string): RuleNode {
  return { key, name, rules: [], children: new Map() }
}

function buildTree(rules: Record<string, unknown>, warn: WarningHandler): RuleNode {
  const root = newNode('')
  for (const [key, value] of Object.entries(rules)) {
    let node = root
    for (const segment of key.split('.')) {
      const childKey = node.key ? `${node.key}.${segment}` : segment
      if (segment === '*') node = node.item ??= newNode(childKey)
      else {
        let child = node.children.get(segment)
        if (!child) node.children.set(segment, (child = newNode(childKey, segment)))
        node = child
      }
    }
    node.rules.push(...ruleList(value, key, warn))
  }
  return root
}

/* ---- Rule knowledge ------------------------------------------------------- */

const FILE_RULES = ['file', 'image', 'mimes', 'mimetypes', 'extensions', 'dimensions']
const DATE_RULES = ['date', 'date_format', 'after', 'before', 'after_or_equal', 'before_or_equal', 'date_equals']
const CONDITIONAL = ['required_if', 'required_unless', 'required_with', 'required_with_all', 'required_without', 'required_without_all', 'exclude_if', 'exclude_unless']
/** Conditional rules whose every param is a field (the others: first param only) */
const ALL_FIELDS = ['required_with', 'required_with_all', 'required_without', 'required_without_all']

/** Rules only the server can check — listed in `serverRules`, silently */
const SERVER_ONLY = new Set([
  'unique', 'exists', 'current_password', 'distinct', 'dimensions', 'after', 'before', 'after_or_equal',
  'before_or_equal', 'date_equals', 'not_regex', 'timezone', 'mac_address', 'ulid', 'json', 'lowercase',
  'uppercase', 'starts_with', 'ends_with', 'doesnt_start_with', 'doesnt_end_with', 'prohibited', 'prohibited_if',
  'prohibited_unless', 'prohibits', 'missing', 'missing_if', 'missing_unless', 'missing_with', 'missing_with_all',
  'present_if', 'present_unless', 'present_with', 'present_with_all', 'required_if_accepted', 'required_if_declined',
  'required_array_keys', 'accepted_if', 'declined', 'declined_if', 'exclude_with', 'exclude_without', 'max_digits',
  'min_digits', 'multiple_of', 'in_array', 'ascii', 'enum', 'contains', 'doesnt_contain',
])

/** Rules that only say something about the type / presence — consumed while reading the field */
const STRUCTURAL = new Set([
  'bail', 'sometimes', 'nullable', 'present', 'filled', 'required', 'string', 'array', 'list', 'integer', 'int',
  'numeric', 'boolean', 'bool', 'date', 'date_format', 'file', 'image', 'mimes', 'mimetypes', 'extensions', 'email',
  'url', 'active_url', 'uuid', 'ip', 'ipv4', 'ipv6', 'hex_color', 'in', 'not_in', 'min', 'max', 'between', 'size',
  'gt', 'gte', 'lt', 'lte', 'digits', 'digits_between', 'decimal', 'regex', 'same', 'different', 'confirmed',
  'accepted', 'alpha', 'alpha_num', 'alpha_dash', 'exclude', ...CONDITIONAL,
])

type Kind = 'string' | 'number' | 'array' | 'file' | 'other'

function kindOf(type: ModelFieldType, item?: ModelItem): Kind {
  if (type === 'string' || type === 'text' || type === 'enum') return 'string'
  if (type === 'integer' || type === 'number') return 'number'
  if (type === 'file') return 'file'
  if (type === 'array') return item?.type === 'file' ? 'file' : 'array'
  return 'other'
}

/** A Laravel rule → the Formo rule(s) it becomes, for a field of this kind (message keys) */
function formoNames(rule: string, kind: Kind | 'any'): string[] {
  const bySize = (s: string[], n: string[], a: string[], f: string[]) =>
    kind === 'any' ? [...s, ...n, ...a, ...f] : kind === 'string' ? s : kind === 'number' ? n : kind === 'array' ? a : kind === 'file' ? f : []
  switch (rule) {
    case 'min':
      return bySize(['min'], ['min_value'], ['min_items'], [])
    case 'max':
      return bySize(['max'], ['max_value'], ['max_items'], ['size'])
    case 'between':
    case 'size':
      return bySize(['min', 'max'], ['min_value', 'max_value'], ['min_items', 'max_items'], ['size'])
    case 'gte':
      return ['min_value', 'gte']
    case 'lte':
      return ['max_value', 'lte']
    case 'numeric':
      return ['decimal']
    case 'int':
      return ['integer']
    case 'in':
      return ['one_of']
    case 'not_in':
      return ['not_one_of']
    case 'same':
      return ['matches']
    case 'different':
      return ['is_not']
    case 'mimes':
    case 'extensions':
      return ['ext']
    case 'mimetypes':
      return ['mimes']
    case 'digits_between':
    case 'uuid':
      return ['regex']
    case 'hex_color':
      return ['color']
    case 'ipv4':
    case 'ipv6':
      return ['ip']
    case 'active_url':
      return ['url']
    case 'date_format':
      return ['date']
    default:
      return [rule]
  }
}

/** Laravel's typed size message keys: `min.string`, `max.numeric`, `between.array`, `max.file` */
const TYPED_KINDS: Record<string, Kind> = { string: 'string', numeric: 'number', array: 'array', file: 'file' }

/* ---- Conversion ------------------------------------------------------------ */

interface Context {
  attributes: Record<string, string>
  clientRules: Set<string>
  warn: WarningHandler
  /** Field path (with `*`) → its kind, for message keys */
  kinds: Map<string, Kind>
  /** Field path (with `*`) → the path of the confirmation field it got */
  confirmations: Map<string, string>
}

/** A field reference in a rule param, relative to the row when both live in the same `*` rows */
function fieldRef(param: string, key: string): string {
  if (!param.includes('*')) return param
  const star = param.lastIndexOf('.*.')
  const prefix = star === -1 ? '' : param.slice(0, star + 3)
  return prefix && key.startsWith(prefix) ? param.slice(prefix.length) : param.replace(/\.\*/g, '')
}

const numeric = (v: string | undefined) => v !== undefined && v.trim() !== '' && !Number.isNaN(Number(v))

function inferType(node: RuleNode, has: (n: string) => boolean): ModelFieldType {
  if (node.children.size) return 'object'
  if (node.item || has('array') || has('list')) return 'array'
  if (FILE_RULES.some(has)) return 'file'
  if (has('boolean') || has('bool') || has('accepted')) return 'boolean'
  // `integer|in:1,2,3`: a choice (with number values)
  if (has('in')) return 'enum'
  if (has('integer') || has('int')) return 'integer'
  if (has('numeric') || has('decimal')) return 'number'
  if (DATE_RULES.some(has)) {
    const format = node.rules.find((r) => r.name === 'date_format')?.params[0]
    if (format) {
      const hasDate = /[dDjlNSwzWFmMntLoYyUc]/.test(format.replace(/\\./g, ''))
      const hasTime = /[aABgGhHisvu]/.test(format.replace(/\\./g, ''))
      if (hasTime && !hasDate) return 'time'
      if (hasTime) return 'datetime'
    }
    return 'date'
  }
  if (has('json')) return 'text'
  return 'string'
}

function convert(node: RuleNode, ctx: Context): ModelItem | undefined {
  const names = new Set(node.rules.map((r) => r.name))
  const has = (n: string) => names.has(n)
  const rule = (n: string) => node.rules.find((r) => r.name === n)
  if (has('exclude')) return undefined

  const field: ModelItem = { type: inferType(node, has) }
  if (node.name !== undefined) field.name = node.name
  const label = ctx.attributes[node.key]
  if (label) field.label = label
  if (has('required')) field.required = true
  if (has('nullable')) field.nullable = true

  const c: ModelConstraints = {}
  const rules: ModelRule[] = []
  const serverRules: string[] = []

  // Relations: `role_id` => exists:roles,id — and list items: `roles.*` => exists:roles,id
  const exists = rule('exists')
  if (exists && !['object', 'array', 'file', 'boolean', 'enum'].includes(field.type) && (node.name === undefined || node.name.endsWith('_id'))) {
    field.type = 'relation'
    field.relation = { kind: 'belongsTo', model: exists.params[0] }
    if (exists.params[1] && exists.params[1] !== 'NULL') field.relation.key = exists.params[1]
  }

  // Formats
  if (has('email')) field.format = 'email'
  else if (has('url') || has('active_url')) field.format = 'url'
  else if (has('uuid')) field.format = 'uuid'
  else if (has('ip') || has('ipv4') || has('ipv6')) field.format = 'ip'
  else if (has('hex_color')) field.format = 'color'
  if (field.type === 'string' && !field.format && (has('current_password') || /password/i.test(node.name ?? ''))) {
    field.format = 'password'
    field.writeOnly = true
  }

  // Children
  if (field.type === 'object') {
    field.fields = convertChildren(node.children.values(), ctx)
  }
  if (field.type === 'array') {
    const inRule = rule('in')
    if (node.item) field.items = convert(node.item, ctx) ?? { type: 'unknown' }
    else if (inRule) field.items = { type: 'enum' }
    else field.items = { type: 'unknown' }
    // `array|in:a,b` checks every element
    if (inRule && field.items.type !== 'object') {
      field.items = { ...field.items, type: field.items.type === 'relation' ? 'relation' : 'enum', options: options(inRule.params, field.items.type) }
    }
  }

  const kind = kindOf(field.type, field.items)
  ctx.kinds.set(node.key, kind)

  for (const r of node.rules) {
    const [p1, p2] = r.params
    switch (r.name) {
      case 'min':
      case 'max':
      case 'between':
      case 'size': {
        const lo = r.name === 'max' ? undefined : p1
        const hi = r.name === 'min' ? undefined : r.name === 'between' ? p2 : r.name === 'size' ? p1 : p1
        if (kind === 'string') {
          if (numeric(lo)) c.minLength = Number(lo)
          if (numeric(hi)) c.maxLength = Number(hi)
        } else if (kind === 'number') {
          if (numeric(lo)) c.min = Number(lo)
          if (numeric(hi)) c.max = Number(hi)
        } else if (kind === 'array') {
          if (numeric(lo)) c.minItems = Number(lo)
          if (numeric(hi)) c.maxItems = Number(hi)
        } else if (kind === 'file' && numeric(hi) && r.name !== 'size') {
          c.maxSize = Number(hi)
          if (r.name === 'between') serverRules.push(r.raw)
        } else serverRules.push(r.raw)
        break
      }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        if (kind === 'number' && numeric(p1)) {
          if (r.name === 'gt') c.exclusiveMin = Number(p1)
          if (r.name === 'gte') c.min = Number(p1)
          if (r.name === 'lt') c.exclusiveMax = Number(p1)
          if (r.name === 'lte') c.max = Number(p1)
        } else if (kind === 'number' && p1) rules.push(`${r.name}:@${fieldRef(p1, node.key)}`)
        else serverRules.push(r.raw)
        break
      case 'digits':
        if (numeric(p1)) rules.push(`digits:${p1}`)
        break
      case 'digits_between':
        if (numeric(p1) && numeric(p2)) c.pattern = `^\\d{${Number(p1)},${Number(p2)}}$`
        break
      case 'decimal':
        rules.push(`decimal:${p2 ?? p1}`)
        break
      case 'regex':
        if (p1) rules.push({ rule: 'regex', params: [p1] })
        break
      case 'in':
        if (field.type === 'enum') field.options = options(r.params, field.type, has('integer') || has('numeric'))
        break
      case 'not_in':
        rules.push({ rule: 'not_one_of', params: [...r.params] })
        break
      case 'same':
        if (p1) rules.push(`matches:@${fieldRef(p1, node.key)}`)
        break
      case 'different':
        if (p1) rules.push(`is_not:@${fieldRef(p1, node.key)}`)
        break
      case 'accepted':
        c.accepted = true
        break
      case 'alpha':
      case 'alpha_num':
      case 'alpha_dash':
        rules.push(r.name)
        break
      case 'mimes':
      case 'extensions':
        c.extensions = [...(c.extensions ?? []), ...r.params.map((e) => e.replace(/^\./, ''))]
        break
      case 'mimetypes':
        c.mimeTypes = [...(c.mimeTypes ?? []), ...r.params]
        break
      case 'image':
        rules.push('image')
        break
      default:
        if (CONDITIONAL.includes(r.name)) {
          const params = r.params.map((p, i) => (i === 0 || ALL_FIELDS.includes(r.name) ? fieldRef(p, node.key) : p))
          rules.push({ rule: r.name, params })
        } else if (ctx.clientRules.has(r.name)) {
          rules.push(r.raw)
        } else if (SERVER_ONLY.has(r.name)) {
          serverRules.push(r.raw)
        } else if (!STRUCTURAL.has(r.name)) {
          serverRules.push(r.raw)
          ctx.warn({ path: node.key, code: 'unsupported-rule', message: `"${r.name}" has no client-side equivalent — left to the server (register it and list it in clientRules to run it in the browser)` })
        }
    }
  }

  // An image with no explicit types: let the file picker show images
  if (has('image') && !c.mimeTypes && !c.extensions) field.ui = { attr: { accept: 'image/*' } }

  // A file field's constraints live on the item when it's a list of files
  if (field.type === 'array' && field.items?.type === 'file') {
    const { maxSize, extensions, mimeTypes, ...rest } = c
    const itemConstraints = { ...field.items.constraints }
    if (maxSize !== undefined) itemConstraints.maxSize = maxSize
    if (extensions) itemConstraints.extensions = extensions
    if (mimeTypes) itemConstraints.mimeTypes = mimeTypes
    if (Object.keys(itemConstraints).length) field.items = { ...field.items, constraints: itemConstraints }
    Object.keys(c).forEach((k) => delete (c as Record<string, unknown>)[k])
    Object.assign(c, rest)
  }

  if (Object.keys(c).length) field.constraints = c
  if (rules.length) field.rules = rules
  if (serverRules.length) field.serverRules = serverRules
  return field
}

function options(values: string[], type: ModelFieldType | undefined, forceNumbers = false): ModelOption[] {
  const asNumbers = (forceNumbers || type === 'integer' || type === 'number') && values.every((v) => numeric(v))
  return values.map((v) => ({ value: asNumbers ? Number(v) : v }))
}

/** A named node → its field, plus the confirmation field `confirmed` asks for */
function convertNamed(node: RuleNode, ctx: Context): ModelField[] {
  const field = convert(node, ctx) as ModelField | undefined
  if (!field) return []
  const confirmed = node.rules.find((r) => r.name === 'confirmed')
  if (!confirmed) return [field]

  // Laravel: `password` => 'confirmed' expects `password_confirmation` (or `confirmed:repeat_password`)
  const name = confirmed.params[0] || `${field.name}_confirmation`
  const parentKey = node.key.slice(0, node.key.length - (node.name?.length ?? 0))
  const key = `${parentKey}${name}`
  ctx.confirmations.set(node.key, key)
  const confirmation: ModelField = { name, type: field.type }
  if (field.format) confirmation.format = field.format
  if (field.writeOnly) confirmation.writeOnly = true
  if (field.required) confirmation.required = true
  const label = ctx.attributes[key]
  if (label) confirmation.label = label
  confirmation.rules = [`confirmed:@${field.name}`]
  ctx.kinds.set(key, 'string')
  return [field, confirmation]
}

/**
 * Sibling nodes → fields. A `password_confirmation` declared explicitly is
 * merged into the one `confirmed` generates (its rules added up).
 */
function convertChildren(nodes: Iterable<RuleNode>, ctx: Context): ModelField[] {
  const fields: ModelField[] = []
  for (const node of nodes) {
    for (const field of convertNamed(node, ctx)) {
      const i = fields.findIndex((f) => f.name === field.name)
      if (i === -1) {
        fields.push(field)
        continue
      }
      const rules = [...(fields[i].rules ?? []), ...(field.rules ?? [])]
      fields[i] = { ...fields[i], ...field }
      if (rules.length) fields[i].rules = rules
    }
  }
  return fields
}

/** `messages()` → Formo message keys (`path.rule` / `rule`), Laravel rules renamed to Formo's */
function readMessages(messages: Record<string, string>, ctx: Context, fieldKeys: Set<string>): Record<string, string> {
  const out: Record<string, string> = {}
  const plain = (key: string) => key.replace(/\.\*(?=\.|$)/g, '')
  for (const [key, message] of Object.entries(messages)) {
    const idx = key.lastIndexOf('.')
    const attribute = idx === -1 ? '' : key.slice(0, idx)
    const rule = (idx === -1 ? key : key.slice(idx + 1)).toLowerCase()

    if (attribute && fieldKeys.has(attribute)) {
      // email.required / phones.*.number.required / password.confirmed (shown on the confirmation field)
      if (rule === 'confirmed' && ctx.confirmations.has(attribute)) {
        out[`${plain(ctx.confirmations.get(attribute)!)}.confirmed`] = message
        continue
      }
      for (const name of formoNames(rule, ctx.kinds.get(attribute) ?? 'other')) out[`${plain(attribute)}.${name}`] = message
      continue
    }
    // min.string / email.min.numeric
    const typed = TYPED_KINDS[rule]
    if (typed && attribute) {
      const split = attribute.lastIndexOf('.')
      const sizeRule = split === -1 ? attribute : attribute.slice(split + 1)
      const field = split === -1 ? '' : attribute.slice(0, split)
      if (['min', 'max', 'between', 'size', 'gt', 'gte', 'lt', 'lte'].includes(sizeRule) && (!field || fieldKeys.has(field))) {
        for (const name of formoNames(sizeRule, typed)) out[field ? `${plain(field)}.${name}` : name] = message
        continue
      }
    }
    if (!attribute) {
      for (const name of formoNames(rule, 'any')) out[name] = message
      continue
    }
    ctx.warn({ path: attribute, code: 'unknown-path', message: `message "${key}" is for a field the rules don't have` })
  }
  return out
}

function allKeys(node: RuleNode, out = new Set<string>()): Set<string> {
  for (const child of node.children.values()) {
    out.add(child.key)
    allKeys(child, out)
  }
  if (node.item) {
    out.add(node.item.key)
    allKeys(node.item, out)
  }
  return out
}

export function fromLaravel(input: LaravelRulesInput, options: FromLaravelOptions = {}): FormoModel {
  if (!input || typeof input !== 'object' || !input.rules || typeof input.rules !== 'object') {
    throw new Error('[formo] fromLaravel: expected { rules, attributes?, messages? }')
  }
  const warn = options.onWarning ?? consoleWarning
  const ctx: Context = {
    attributes: input.attributes ?? {},
    clientRules: new Set((options.clientRules ?? []).map((r) => r.toLowerCase())),
    warn,
    kinds: new Map(),
    confirmations: new Map(),
  }
  const tree = buildTree(input.rules, warn)

  const fields = convertChildren(tree.children.values(), ctx)
  const model: FormoModel = { version: MODEL_VERSION, fields, meta: { source: 'laravel' } }
  if (input.name) model.name = input.name
  if (input.label) model.label = input.label
  if (input.messages && Object.keys(input.messages).length) {
    const keys = allKeys(tree)
    for (const key of ctx.confirmations.values()) keys.add(key)
    const messages = readMessages(input.messages, ctx, keys)
    if (Object.keys(messages).length) model.messages = messages
  }
  return model
}
