import { markRaw, toRaw } from 'vue'
import type {
  CallbacksInput,
  FieldDef,
  FieldEntry,
  FieldInput,
  FieldsInput,
  FormoCallback,
  FormoCallbacks,
  FormoDriver,
  FieldNode,
  FormoThemeLayer,
  RulesInput,
} from '../types'
import { isTheme } from './theme'
import { parseRules, hasRule } from './rules'
import { NOTSET, cleanAlias, isPlainObject, setPath, toArray } from './utils'

/** HTML input types — `driver: 'email'` is understood as `input|email` */
const INPUT_TYPES = new Set([
  'text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'datetime-local', 'datetime',
  'month', 'week', 'time', 'color', 'range', 'hidden', 'submit', 'reset', 'image',
])

/** Keys that map to dedicated FieldNode properties (everything else goes in `vars`) */
const KNOWN_KEYS = new Set([
  'alias', 'driver', 'val', 'value', 'label', 'message', 'opts', 'options', 'blank', 'attr', 'rules',
  'required', 'errorMessages', 'error_messages', 'render', 'editable', 'ignore', 'callbacks', 'filters',
  'order', 'component', 'props', 'model', 'view', 'template', 'classes', 'fields', 'components', 'config', 'theme',
  'blueprint', 'min', 'max', 'addLabel', 'removeLabel', 'type', 'parent', 'errorDisplay', 'checklist', 'requirements', 'exclude', 'ignores', 'excludes',
])

export interface NormalizeOptions {
  drivers: Record<string, FormoDriver>
  /** Driver used when a root definition has no driver (default `form`) */
  rootDriver?: string
}

/** Components must never be reactive (definitions may come from reactive()/ref()) */
function rawComponent<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  return markRaw(toRaw(value) as object) as T
}

function rawComponentMap<T extends Record<string, unknown> | undefined>(map: T): T {
  if (!map) return map
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(toRaw(map))) out[key] = rawComponent(value)
  return out as T
}

/** A theme on a node: themes are raw already; a layer's views/components must not become reactive */
function rawTheme(theme: FieldNode['theme']): FieldNode['theme'] {
  if (!theme || isTheme(theme)) return theme
  const layer = toRaw(theme) as FormoThemeLayer
  return {
    ...layer,
    views: layer.views ? rawComponentMap(layer.views as Record<string, unknown>) as FormoThemeLayer['views'] : undefined,
    components: rawComponentMap(layer.components),
  }
}

function hasToSchema(value: unknown): value is { toSchema(): FieldDef } {
  return !!value && typeof (value as any).toSchema === 'function'
}

/** `['email', 'input|email', 'x@y.z', { label: 'E-mail' }]` (Formo's construct order) → FieldDef */
export function constructToDef(args: unknown[]): FieldDef {
  const [alias, driver, val, opts] = args
  const def: FieldDef = { ...(isPlainObject(opts) ? (opts as FieldDef) : {}) }
  if (alias !== undefined) def.alias = alias as string
  if (typeof driver === 'string') def.driver = driver
  if (args.length >= 3) def.val = val
  return def
}

const INTEGER_KEY = /^(0|[1-9]\d*)$/
/** Definitions already warned about (normalize runs again on every change) */
const warned = new WeakSet<object>()

/**
 * A keyed `fields` object → the list form (the key is the alias):
 *
 *   { email: { required: true }, bio: 'textarea', address: { fields: { street: {} } }, admin: false }
 *   → [{ alias: 'email', required: true }, { alias: 'bio', driver: 'textarea' }, { alias: 'address', fields: … }]
 *
 * `false` / `null` / `undefined` entries are skipped. Builders are kept as they are
 * (their alias is set to the key), so they stay live. Lists pass through unchanged.
 */
export function fieldsToList<T = FieldInput>(
  fields: FieldInput[] | FieldsInput | undefined | null,
  withBuilder: (builder: { toSchema(): FieldDef }, alias: string) => T = (builder, alias) =>
    ({ ...builder.toSchema(), alias }) as T,
): Array<FieldInput | T> {
  if (!fields) return []
  if (Array.isArray(fields)) return fields
  if (!isPlainObject(fields)) return []
  const keys = Object.keys(fields)
  const dev = import.meta.env?.DEV && !warned.has(toRaw(fields))
  if (dev) warned.add(toRaw(fields))
  if (dev && keys.some((k) => INTEGER_KEY.test(k)) && keys.some((k) => !INTEGER_KEY.test(k))) {
    console.warn(
      `[formo] fields: integer-like keys (${keys.filter((k) => INTEGER_KEY.test(k)).join(', ')}) always come first in a ` +
        'JavaScript object, whatever order you wrote them in. Use the list form (fields: [...]) or `order` for numeric aliases.',
    )
  }
  const out: Array<FieldInput | T> = []
  for (const key of keys) {
    const entry = (fields as Record<string, FieldEntry>)[key]
    if (entry === false || entry === null || entry === undefined) continue
    if (typeof entry === 'string') {
      out.push({ alias: key, driver: entry })
    } else if (hasToSchema(entry)) {
      out.push(withBuilder(entry, key))
    } else if (isPlainObject(entry)) {
      const def = entry as FieldDef
      if (dev && def.alias !== undefined && String(cleanAlias(def.alias)) !== String(cleanAlias(key))) {
        console.warn(`[formo] fields.${key} has alias "${def.alias}": the key is the alias, "${def.alias}" is ignored`)
      }
      out.push({ ...def, alias: key })
    } else if (dev) {
      console.warn(`[formo] fields.${key}: expected a definition, a driver name, a Formo builder or false`)
    }
  }
  return out
}

function toFieldDef(input: FieldInput): FieldDef {
  if (typeof input === 'string') return { alias: input }
  if (Array.isArray(input)) return constructToDef(input)
  if (hasToSchema(input)) return input.toSchema()
  return input as FieldDef
}

/** Expand dot keys (`'attr.method': 'GET'`, used by Formo) into nested objects */
function expandDotKeys(def: FieldDef): FieldDef {
  if (!Object.keys(def).some((k) => k.includes('.'))) return def
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(def)) {
    if (key.includes('.')) setPath(out, key, value)
    else out[key] = isPlainObject(value) && isPlainObject(out[key]) ? { ...out[key], ...value } : value
  }
  return out as FieldDef
}

function normalizeCallbacks(input: CallbacksInput | undefined): {
  own: FormoCallbacks
  forChildren: Record<string, FormoCallbacks>
} {
  const own: FormoCallbacks = { pass: [], fail: [] }
  const forChildren: Record<string, FormoCallbacks> = {}
  // PHP json_encode(array()) → []
  if (!input || Array.isArray(input)) return { own, forChildren }

  for (const type of ['pass', 'fail'] as const) {
    const value = input[type]
    if (!value) continue
    if (isPlainObject(value)) {
      // Formo form-level syntax: { pass: { ':self': [...], email: [...] } }
      for (const [alias, cbs] of Object.entries(value)) {
        const list = toArray(cbs as FormoCallback | FormoCallback[])
        if (alias === ':self') own[type]!.push(...list)
        else {
          forChildren[alias] ??= { pass: [], fail: [] }
          forChildren[alias][type]!.push(...list)
        }
      }
    } else {
      own[type]!.push(...toArray(value as FormoCallback | FormoCallback[]))
    }
  }
  return { own, forChildren }
}

function resolveDriver(def: FieldDef, drivers: Record<string, FormoDriver>, fallback: string) {
  let driver = typeof def.driver === 'string' && def.driver ? def.driver : ''
  let type: string | undefined

  if (driver.includes('|')) {
    // Formo: 'input|email'
    ;[driver, type] = driver.split('|')
  }
  if (driver === 'bool') driver = 'checkbox'
  if (driver && !drivers[driver] && INPUT_TYPES.has(driver)) {
    type = driver
    driver = 'input'
  }
  if (!driver) {
    // A field with its own component and no driver gets the neutral `custom` driver (empty value: null)
    const hasFields = Array.isArray(def.fields) || isPlainObject(def.fields)
    driver = hasFields ? 'group' : def.component && drivers.custom ? 'custom' : fallback
  }

  return { driver, type }
}

/** Insert children honoring Formo's `order` option (index or ['before'|'after', alias]) */
function applyOrder(children: Array<{ node: FieldNode; order?: FieldDef['order'] }>): FieldNode[] {
  const out: FieldNode[] = []
  for (const { node, order } of children) {
    if (order === undefined || order === null) {
      out.push(node)
      continue
    }
    if (typeof order === 'number' || (typeof order === 'string' && /^\d+$/.test(order))) {
      out.splice(Number(order), 0, node)
      continue
    }
    if (Array.isArray(order)) {
      const [where, relative] = order
      const idx = out.findIndex((n) => String(n.alias) === String(relative))
      if (idx === -1) out.push(node)
      else out.splice(where === 'after' ? idx + 1 : idx, 0, node)
      continue
    }
    out.push(node)
  }
  return out
}

/**
 * Normalize a definition into a FieldNode tree.
 *
 * Accepts Formo builders, plain objects, compact tuples and the JSON produced by
 * Formo (PHP)'s `$form->to_array()`.
 */
export function normalize(input: FieldInput, options: NormalizeOptions, isRoot = true): FieldNode {
  const raw = expandDotKeys({ ...toFieldDef(input) })
  const { driver, type } = resolveDriver(raw, options.drivers, isRoot ? (options.rootDriver ?? 'form') : 'input')

  let alias = raw.alias
  if (alias === undefined || alias === null || alias === '') {
    if (isRoot) alias = 'formo'
    else throw new Error('[formo] Every formo field must have an alias')
  }

  const attr: Record<string, unknown> = {}
  if (isPlainObject(raw.attr)) {
    for (const [k, v] of Object.entries(raw.attr)) {
      // Formo's to_array() carries `class => NULL` etc.
      if (v !== null && v !== undefined) attr[k] = v
    }
  }
  if (type) attr.type = type
  const inputType = driver === 'input' ? String(attr.type ?? raw.type ?? 'text') : undefined
  if (inputType) attr.type = inputType

  const hasVal = 'val' in raw || 'value' in raw
  const val = 'val' in raw ? raw.val : raw.value

  const { specs, veeSchema } = parseRules(raw.rules as RulesInput)
  if (raw.required === true && !hasRule(specs, 'required')) specs.unshift({ name: 'required', params: [] })

  const label = raw.label === NOTSET ? undefined : (raw.label as FieldNode['label'])
  const { own: callbacks, forChildren } = normalizeCallbacks(raw.callbacks as CallbacksInput | undefined)

  const vars: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(key)) vars[key] = value
  }

  const node: FieldNode = {
    alias: cleanAlias(alias as string | number),
    driver,
    type: inputType,
    val,
    hasVal: hasVal && val !== NOTSET,
    label,
    message: raw.message as string | undefined,
    opts: (raw.opts ?? raw.options) as FieldNode['opts'],
    blank: raw.blank as FieldNode['blank'],
    attr,
    rules: specs,
    veeSchema,
    errorMessages: { ...((raw.error_messages as object) ?? {}), ...((raw.errorMessages as object) ?? {}) },
    errorDisplay: raw.checklist === true ? 'checklist' : (raw.errorDisplay as FieldNode['errorDisplay']),
    requirements: { ...((raw.requirements as object) ?? {}) },
    render: (raw.render ?? true) as FieldNode['render'],
    editable: (raw.editable ?? true) as FieldNode['editable'],
    ignore: (raw.ignore ?? false) as FieldNode['ignore'],
    exclude: raw.exclude as FieldNode['exclude'],
    ignores: toArray(raw.ignores as string | string[] | undefined),
    excludes: toArray(raw.excludes as string | string[] | undefined),
    callbacks: callbacks as Required<FormoCallbacks>,
    filters: toArray(raw.filters as FieldNode['filters']),
    component: rawComponent(raw.component as FieldNode['component']),
    props: raw.props as FieldNode['props'],
    model: raw.model as FieldNode['model'],
    // Formo `template` (PHP to_array() carries `template: null`) is the view's name
    view: rawComponent((raw.view ?? (typeof raw.template === 'string' ? raw.template : undefined)) as FieldNode['view']),
    classes: raw.classes as FieldNode['classes'],
    fields: [],
    components: rawComponentMap(raw.components as FieldNode['components']),
    config: raw.config as FieldNode['config'],
    theme: rawTheme(raw.theme as FieldNode['theme']),
    blueprint: raw.blueprint === true,
    min: raw.min as number | undefined,
    max: raw.max as number | undefined,
    addLabel: raw.addLabel as string | undefined,
    removeLabel: raw.removeLabel as string | undefined,
    vars,
  }

  if (node.hasVal && node.val === NOTSET) node.val = undefined

  if (import.meta.env?.DEV && 'wrapper' in raw && !warned.has(raw.wrapper as object)) {
    if (raw.wrapper && typeof raw.wrapper === 'object') warned.add(raw.wrapper as object)
    console.warn(`[formo] "${String(alias)}": \`wrapper\` was replaced by \`view\` (a view name, a component, or false)`)
  }

  if (raw.fields && typeof raw.fields === 'object') {
    const children = fieldsToList(raw.fields).map((child) => {
      const def = toFieldDef(child)
      return { node: normalize(def, options, false), order: def.order }
    })
    node.fields = applyOrder(children)

    for (const [alias, cbs] of Object.entries(forChildren)) {
      const child = node.fields.find((f) => String(f.alias) === alias)
      if (!child) continue
      child.callbacks.pass.push(...(cbs.pass ?? []))
      child.callbacks.fail.push(...(cbs.fail ?? []))
    }
  }

  return node
}

/** Find a node in a tree by alias (recursive, Formo `find()`) or by dotted alias path */
export function findNode(root: FieldNode, aliasOrPath: string | number | Array<string | number>): FieldNode | undefined {
  if (Array.isArray(aliasOrPath)) {
    let cur: FieldNode | undefined = root
    for (const seg of aliasOrPath) {
      cur = cur?.fields.find((f) => String(f.alias) === String(seg))
    }
    return cur
  }
  const key = String(aliasOrPath)
  if (key.includes('.')) return findNode(root, key.split('.'))
  const direct = root.fields.find((f) => String(f.alias) === key)
  if (direct) return direct
  for (const child of root.fields) {
    const found = findNode(child, key)
    if (found) return found
  }
  return undefined
}
