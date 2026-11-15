import { markRaw, shallowRef, type ShallowRef } from 'vue'
import type { CallbacksInput, FieldDef, FieldInput, FieldSchema, FieldsInput, FormoCallback, RuleItem, RulesInput } from '../types'
import { constructToDef, fieldsToList } from './normalize'
import { canonicalRuleName, parseRules } from './rules'
import { NOTSET, cleanAlias, getPath, isPlainObject, setPath, toArray } from './utils'

type Order = number | ['before' | 'after', string | number]

/** Turn any rules input into a list we can append to */
function rulesToList(input: RulesInput | undefined): RulesInput[] {
  if (input === undefined || input === null) return []
  if (Array.isArray(input)) {
    const single = input.length === 2 && typeof input[0] === 'string' && Array.isArray(input[1]) &&
      ((input[1] as unknown[]).some((p) => typeof p === 'string' && p.startsWith(':')) ||
        (input[1].length > 0 && typeof input[1][0] !== 'string' && typeof input[1][0] !== 'function'))
    return single ? [input as RuleItem] : [...(input as RuleItem[])]
  }
  return [input]
}

/**
 * The form object — a JavaScript port of Formo's PHP API.
 *
 * Define it in one go with a nested object (subforms are entries with `fields`):
 *
 * ```ts
 * const form = Formo.form({
 *   alias: 'user',
 *   fields: {
 *     username: { required: true },
 *     email: { driver: 'email', required: true },
 *     notes: 'textarea',
 *     address: { fields: { street: {}, zip: { rules: 'required|digits:5' } } },
 *   },
 * })
 * ```
 *
 * …or field by field, like the PHP API (both mix freely, and `.add()` keeps working after render):
 *
 * ```ts
 * const form = Formo.form({ alias: 'user' })
 *   .add('username', { rules: [['not_empty'], ['min_length', [':value', 3]]] })
 *   .add('email', 'input|email', { required: true })
 *   .add('notes', 'textarea', 'My notes')
 *   .addGroup('hobby', 'radios', { run: 'Running', swim: 'Swimming' }, 'swim')
 *   .add('address', Formo.group().add('street').add('zip'))
 *
 * form.find('street')?.set('label', 'Street address')
 * ```
 *
 * A builder only *describes* a form; render it with `<FormoForm :form="form">`.
 * Mutations after rendering are reactive (fields can be added/removed live).
 * Runtime state (values, errors, validate) lives in the controller — see `useFormo()`.
 */
export class Formo<D extends FieldDef = FieldDef> {
  /** Type only: the definition it was created from (gives `form.fields` its types) */
  declare readonly __formoDef?: D

  /** Bumped on every mutation so rendered forms update */
  readonly version: ShallowRef<number> = markRaw(shallowRef(0))

  #def: FieldDef
  #fields: Formo[] = []
  #parent: Formo | undefined

  /* ---- Factories --------------------------------------------------------- */

  /**
   * A form (Formo::form). Alias defaults to `formo`.
   *   Formo.form('user') · Formo.form({ alias: 'user', fields: { email: {}, bio: 'textarea' } })
   */
  static form<T extends FieldDef = FieldDef>(def?: T | string): Formo<T> {
    const d = typeof def === 'string' ? { alias: def } : (def ?? {})
    return new Formo({ alias: 'formo', driver: 'form', ...d }) as Formo<T>
  }

  /**
   * A group / subform.
   *   Formo.group('address').add('street') · Formo.group('address', { fields: { street: {} } })
   */
  static group<T extends FieldDef = {}>(alias?: string | T, def?: T): Formo<T & { driver: 'group' }> {
    const d = typeof alias === 'object' ? alias : { ...(def ?? {}), alias }
    return new Formo({ driver: 'group', ...d }) as Formo<T & { driver: 'group' }>
  }

  /** Any field (Formo::factory) */
  static factory<T extends FieldDef = FieldDef>(def: T = {} as T): Formo<T> {
    return new Formo(def) as Formo<T>
  }

  /** Build from a definition or from Formo PHP `$form->to_array()` JSON */
  static fromJSON(json: unknown): Formo {
    const def = (typeof json === 'string' ? JSON.parse(json) : json) as FieldDef
    return new Formo(def)
  }

  constructor(def: FieldDef | string = {}) {
    const d = typeof def === 'string' ? { alias: def } : { ...def }
    const fields = d.fields
    delete d.fields
    if (d.label === NOTSET) delete d.label
    if (d.alias !== undefined) d.alias = cleanAlias(d.alias)
    this.#def = d
    for (const field of Formo.#childList(fields)) this.#append(Formo.#toFormo(field))
    // Never let Vue proxy a builder (private fields don't work through proxies)
    markRaw(this)
  }

  /** `fields` as a list or keyed by alias — keyed builders get the key as alias (and stay live) */
  static #childList(fields: FieldInput[] | FieldsInput | undefined): Array<FieldInput | Formo> {
    return fieldsToList<Formo>(fields, (builder, alias) => {
      const child = builder instanceof Formo ? builder : new Formo(builder.toSchema())
      child.#def.alias = cleanAlias(alias)
      // "form" should only be used once (Formo converts added forms to groups)
      if (child.#def.driver === 'form') child.#def.driver = 'group'
      return child
    })
  }

  static #toFormo(input: FieldInput | Formo): Formo {
    if (input instanceof Formo) return input
    if (typeof input === 'string') return new Formo({ alias: input })
    if (Array.isArray(input)) return new Formo(constructToDef(input))
    if (typeof (input as any).toSchema === 'function') return new Formo((input as any).toSchema())
    return new Formo(input as FieldDef)
  }

  #bump() {
    this.version.value++
    if (this.#parent) this.#parent.#bump()
  }

  #append(field: Formo, order?: Order) {
    field.#parent = this
    const o = order ?? field.#def.order
    delete field.#def.order
    if (o === undefined || o === null) {
      this.#fields.push(field)
    } else if (typeof o === 'number') {
      this.#fields.splice(o, 0, field)
    } else {
      const [where, relative] = o
      const idx = this.#fields.findIndex((f) => String(f.alias()) === String(relative))
      if (idx === -1) this.#fields.push(field)
      else this.#fields.splice(where === 'after' ? idx + 1 : idx, 0, field)
    }
  }

  /* ---- Fields ------------------------------------------------------------ */

  /**
   * Add a field or subform. Same signatures as Formo:
   *
   *   add('username')
   *   add('notes', 'textarea', 'My notes')
   *   add('email', 'input|email', { required: true })        // 3rd arg object = options
   *   add('hobbies', 'checkboxes', ['run'], { opts })          // alias, driver, val, opts
   *   add('notes', { driver: 'textarea', val: 'My notes' })
   *   add({ alias: 'notes', driver: 'textarea' })
   *   add('address', Formo.group().add('street'))             // subform
   *   add(Formo.factory({ alias: 'x' }))
   */
  add(field: Formo | FieldDef): this
  add(alias: string | number, def?: FieldDef | Formo): this
  add(alias: string | number, driver: string, def?: FieldDef | Formo): this
  add(alias: string | number, driver: string | undefined, val: unknown, def?: FieldDef): this
  add(alias: string | number | FieldDef | Formo, ...args: unknown[]): this {
    let child: Formo

    const formoArg = [alias, ...args].find((a) => a instanceof Formo) as Formo | undefined
    if (formoArg) {
      child = formoArg
      if (typeof alias === 'string' || typeof alias === 'number') child.#def.alias = cleanAlias(alias)
      const driver = args.find((a) => typeof a === 'string') as string | undefined
      if (driver) child.#def.driver = driver
      const opts = args.find((a) => isPlainObject(a)) as FieldDef | undefined
      if (opts) child.set(opts)
      // "form" should only be used once (Formo converts added forms to groups)
      if (child.#def.driver === 'form') child.#def.driver = 'group'
    } else if (isPlainObject(alias)) {
      child = new Formo(alias as FieldDef)
    } else {
      const [driver, val, opts] = args
      let def: FieldDef
      if (isPlainObject(driver)) {
        // add('notes', { driver: 'textarea' })
        def = { ...(driver as FieldDef) }
      } else if (args.length === 2 && isPlainObject(val) && typeof driver === 'string') {
        // add('email', 'input|email', { required: true })
        def = { ...(val as FieldDef), driver }
      } else {
        // add(alias, driver, val, opts)
        def = { ...(isPlainObject(opts) ? (opts as FieldDef) : {}) }
        if (typeof driver === 'string') def.driver = driver
        if (args.length >= 2) def.val = val
      }
      def.alias = alias as string | number
      child = new Formo(def)
    }

    this.#append(child)
    this.#bump()
    return this
  }

  /**
   * Formo's `add_group()`: fields that rely on options.
   *   addGroup('hobby', 'select', { run: 'Running' }, 'run', { label: 'Hobby' })
   */
  addGroup(alias: string, driver: string, opts: FieldDef['opts'], val?: unknown, settings: FieldDef = {}): this {
    const def: FieldDef = { ...settings, alias, driver, opts }
    if (val !== undefined) def.val = val
    return this.add(def)
  }

  /** Remove one or more fields by alias */
  remove(alias: string | number | Array<string | number>): this {
    const aliases = toArray(alias).map(String)
    this.#fields = this.#fields.filter((f) => !aliases.includes(String(f.alias())))
    this.#bump()
    return this
  }

  /** A direct child by alias (PHP `$form->alias` / `$form->{'0'}` for an index) */
  field(alias: string | number): Formo | undefined {
    return (
      this.#fields.find((f) => String(f.alias()) === String(cleanAlias(alias))) ??
      (typeof alias === 'number' ? this.#fields[alias] : undefined)
    )
  }

  /**
   * Find a field by alias, recursively (Formo `find()`), by dotted path
   * (`address.street`) or by an array path (`['address', 'street']`).
   */
  find(alias: string | number | Array<string | number>, notRecursive = false): Formo | undefined {
    if (Array.isArray(alias)) {
      let cur: Formo | undefined = this
      for (const seg of alias) cur = cur?.field(seg)
      return cur
    }
    if (alias === ':self') return this
    if (typeof alias === 'string' && alias.includes('.')) return this.find(alias.split('.'))
    const direct = this.field(alias)
    if (direct || notRecursive) return direct
    for (const f of this.#fields) {
      const found = f.find(alias)
      if (found) return found
    }
    return undefined
  }

  /** All direct children */
  fields(): Formo[] {
    return [...this.#fields]
  }

  /** Children keyed by alias (Formo `as_array()`) */
  asArray(): Record<string, Formo> {
    return Object.fromEntries(this.#fields.map((f) => [String(f.alias()), f]))
  }

  parent(): Formo | undefined {
    return this.#parent
  }

  /* ---- Variables --------------------------------------------------------- */

  alias(): string | number
  alias(alias: string | number): this
  alias(alias?: string | number): any {
    if (alias === undefined) return this.#def.alias as string | number
    this.#def.alias = cleanAlias(alias)
    this.#bump()
    return this
  }

  driver(): string | undefined {
    return this.#def.driver
  }

  /** Get a variable; dot syntax works (`get('attr.class')`) */
  get<T = unknown>(key: string, fallback?: T): T {
    if (key === 'fields') return this.fields() as T
    return getPath(this.#def, key, fallback) as T
  }

  /** Set one variable (dot syntax works) or several at once */
  set(key: string | FieldDef, value?: unknown): this {
    if (isPlainObject(key)) {
      for (const [k, v] of Object.entries(key)) this.#set(k, v)
    } else {
      this.#set(key as string, value)
    }
    this.#bump()
    return this
  }

  #set(key: string, value: unknown) {
    if (key === 'fields') {
      const list = isPlainObject(value) ? Formo.#childList(value as FieldsInput) : toArray(value as FieldInput[])
      for (const f of list) this.#append(Formo.#toFormo(f))
      return
    }
    if (key === 'alias') value = cleanAlias(value as string)
    if (key.includes('.')) setPath(this.#def as Record<string, any>, key, value)
    else (this.#def as Record<string, unknown>)[key] = value
  }

  /** Get/set the initial value */
  val(): unknown
  val(value: unknown): this
  val(...args: unknown[]): any {
    if (!args.length) return this.#def.val ?? this.#def.value
    delete this.#def.value
    this.#def.val = args[0]
    this.#bump()
    return this
  }

  /** Get/set HTML attributes */
  attr(key: string): unknown
  attr(key: string | Record<string, unknown>, value?: unknown): this
  attr(key: string | Record<string, unknown>, ...rest: unknown[]): any {
    if (typeof key === 'string' && !rest.length) return this.#def.attr?.[key]
    const attr = { ...(this.#def.attr ?? {}) }
    if (typeof key === 'string') attr[key] = rest[0]
    else Object.assign(attr, key)
    this.#def.attr = attr
    this.#bump()
    return this
  }

  addClass(classes: string | string[]): this {
    const current = String(this.#def.attr?.class ?? '').split(' ').filter(Boolean)
    for (const c of toArray(classes).flatMap((c) => c.split(' '))) if (c && !current.includes(c)) current.push(c)
    return this.attr('class', current.join(' '))
  }

  removeClass(classes: string | string[]): this {
    const remove = toArray(classes).flatMap((c) => c.split(' '))
    const current = String(this.#def.attr?.class ?? '').split(' ').filter((c) => c && !remove.includes(c))
    return this.attr('class', current.join(' '))
  }

  /** Merge an object into an object variable (`merge('attr', {...})`) */
  merge(key: string | Record<string, Record<string, unknown>>, value?: Record<string, unknown>): this {
    if (isPlainObject(key)) {
      for (const [k, v] of Object.entries(key)) this.merge(k, v)
      return this
    }
    const current = this.get<Record<string, unknown>>(key as string, {})
    return this.set(key as string, { ...current, ...value })
  }

  /* ---- Rules ------------------------------------------------------------- */

  /**
   * Add a rule, in any notation:
   *   addRule('not_empty') · addRule('min_length', [':value', 3]) · addRule(['regex', [':value', '/^a/']])
   *   addRule('required|email') · addRule((v) => v !== 'admin' || 'Reserved')
   */
  addRule(rule: RuleItem, params?: unknown[]): this {
    const item: RuleItem = params !== undefined && typeof rule === 'string' ? [rule, params] : rule
    this.#def.rules = [...rulesToList(this.#def.rules), item] as RulesInput
    this.#bump()
    return this
  }

  addRules(rules: RuleItem[] | RulesInput): this {
    for (const rule of rulesToList(rules as RulesInput)) {
      this.#def.rules = [...rulesToList(this.#def.rules), rule] as RulesInput
    }
    this.#bump()
    return this
  }

  /** The same rule on several fields (`'*'` = all children) */
  addRuleFields(rule: RuleItem, aliases: Array<string | number>): this {
    for (const alias of aliases) {
      const targets = alias === '*' ? this.#fields : toArray(this.find(alias))
      targets.forEach((f) => f.addRule(rule))
    }
    return this
  }

  /** Rules for several fields: `{ username: [...], email: [...], ':self': [...] }` */
  addRulesFields(map: Record<string, RuleItem[] | RulesInput>): this {
    for (const [alias, rules] of Object.entries(map)) {
      const targets = alias === '*' ? this.#fields : alias === ':self' ? [this] : toArray(this.find(alias, true))
      targets.forEach((f) => f.addRules(rules))
    }
    return this
  }

  /** Remove a rule by name (Kohana names work: `not_empty` removes `required`) */
  removeRule(name: string): this {
    const target = canonicalRuleName(name)
    const kept: RulesInput[] = []
    for (const item of rulesToList(this.#def.rules)) {
      if (typeof item === 'string' && item.includes('|')) {
        const rest = item.split('|').filter((part) => canonicalRuleName(part.split(':')[0].trim()) !== target)
        if (rest.length) kept.push(rest.join('|'))
        continue
      }
      const specs = parseRules(item).specs
      if (specs.length === 1 && canonicalRuleName(specs[0].name) === target) continue
      kept.push(item)
    }
    this.#def.rules = kept as RulesInput
    if (target === 'required') delete this.#def.required
    this.#bump()
    return this
  }

  removeRules(names: string[]): this {
    names.forEach((n) => this.removeRule(n))
    return this
  }

  removeRulesFields(map: Record<string, string | string[]>): this {
    for (const [alias, names] of Object.entries(map)) this.find(alias, true)?.removeRules(toArray(names))
    return this
  }

  /** Formo `is_required()` */
  isRequired(): boolean {
    if (this.#def.required === true) return true
    return parseRules(this.#def.rules).specs.some((s) => canonicalRuleName(s.name) === 'required')
  }

  /* ---- Callbacks --------------------------------------------------------- */

  /** Attach callbacks: `callback('pass', fn)` or `callback({ email: { pass: [fn] } })` */
  callback(type: 'pass' | 'fail' | Record<string, CallbacksInput>, callbacks?: FormoCallback | FormoCallback[]): this {
    if (typeof type === 'object') {
      for (const [alias, cbs] of Object.entries(type)) {
        const target = alias === ':self' ? this : this.find(alias, true)
        target?.callbacks(cbs)
      }
      return this
    }
    const current = (this.#def.callbacks ?? {}) as CallbacksInput
    const list = toArray(current[type] as FormoCallback | FormoCallback[] | undefined)
    this.#def.callbacks = { ...current, [type]: [...list, ...toArray(callbacks)] }
    this.#bump()
    return this
  }

  /** Attach a group of callbacks: `{ pass: [...], fail: [...] }` or Formo's `{ pass: { ':self': [...], email: [...] } }` */
  callbacks(input: CallbacksInput): this {
    for (const type of ['pass', 'fail'] as const) {
      const value = input[type]
      if (!value) continue
      if (isPlainObject(value)) {
        for (const [alias, cbs] of Object.entries(value)) {
          const target = alias === ':self' ? this : this.find(alias, true)
          target?.callback(type, cbs as FormoCallback[])
        }
      } else {
        this.callback(type, value as FormoCallback[])
      }
    }
    return this
  }

  /* ---- Bulk helpers ------------------------------------------------------ */

  /** Set variables on several fields: `{ email: { label: 'E-mail' }, '*': { editable: false } }` */
  setFields(map: Record<string, FieldDef>, notRecursive = true): this {
    for (const [alias, vars] of Object.entries(map)) {
      const targets = alias === '*' ? this.#fields : toArray(this.find(alias, notRecursive))
      targets.forEach((f) => f.set(vars))
    }
    return this
  }

  /** Set one variable on several fields: `setVarFields('editable', { email: false })` */
  setVarFields(key: string, map: Record<string, unknown>, notRecursive = true): this {
    for (const [alias, value] of Object.entries(map)) {
      const targets = alias === '*' ? this.#fields : toArray(this.find(alias, notRecursive))
      targets.forEach((f) => f.set(key, value))
    }
    return this
  }

  attrFields(map: Record<string, Record<string, unknown>>): this {
    for (const [alias, attrs] of Object.entries(map)) this.find(alias, true)?.attr(attrs)
    return this
  }

  mergeFields(map: Record<string, Record<string, Record<string, unknown>>>): this {
    for (const [alias, props] of Object.entries(map)) this.find(alias, true)?.merge(props)
    return this
  }

  /* ---- Ordering / structure ---------------------------------------------- */

  /**
   * Reorder fields (Formo `order()`):
   *   order('email', 1) · order('email', 'after', 'username') · order({ email: 0, notes: ['before', 'submit'] })
   */
  order(alias: string | Record<string, Order>, newOrder?: number | 'before' | 'after', relative?: string | number): this {
    if (typeof alias === 'object') {
      for (const [a, o] of Object.entries(alias)) {
        if (Array.isArray(o)) this.order(a, o[0], o[1])
        else this.order(a, o)
      }
      return this
    }
    const field = this.field(alias)
    if (!field) return this
    this.#fields = this.#fields.filter((f) => f !== field)
    const order: Order | undefined =
      typeof newOrder === 'number' ? newOrder : newOrder && relative !== undefined ? [newOrder, relative] : undefined
    this.#append(field, order)
    this.#bump()
    return this
  }

  /**
   * Move existing fields into a new subform (Formo `subform()`):
   *   subform('address', ['street', 'city', 'zip'], ['after', 'email'])
   */
  subform(alias: string, aliases: Array<string | number>, order?: Order, driver = 'group'): this {
    const group = new Formo({ alias, driver })
    for (const a of aliases) {
      const field = this.find(a, true)
      if (!field) continue
      this.#fields = this.#fields.filter((f) => f !== field)
      group.#append(field)
    }
    this.#append(group, order)
    this.#bump()
    return this
  }

  /** Pull every field out of its subforms (Formo `flatten()`) */
  flatten(): this {
    const flat: Formo[] = []
    const walk = (f: Formo) => {
      if (f.#fields.length) f.#fields.forEach(walk)
      else flat.push(f)
    }
    this.#fields.forEach(walk)
    this.#fields = []
    flat.forEach((f) => this.#append(f))
    this.#bump()
    return this
  }

  /**
   * Blueprints: make this group repeatable, optionally pre-filled (Formo `pad_blueprint()`):
   *   Formo.group('phones').add('number').padBlueprint(2)
   *   Formo.group('phones').add('number').padBlueprint([{ number: '555-1234' }])
   */
  padBlueprint(countOrRows: number | Array<Record<string, unknown>> = 1): this {
    this.#def.blueprint = true
    const current = Array.isArray(this.#def.val) ? (this.#def.val as Array<Record<string, unknown>>) : []
    if (typeof countOrRows === 'number') {
      const rows = [...current]
      while (rows.length < countOrRows) rows.push({})
      this.#def.val = rows
    } else {
      this.#def.val = [...countOrRows]
    }
    this.#bump()
    return this
  }

  /* ---- Output ------------------------------------------------------------ */

  /** The plain definition (what <FormoForm> renders) — children as a list, like PHP `to_array()` */
  toSchema(): FieldSchema {
    // Reading the version makes computed()s that call toSchema() reactive to mutations
    void this.version.value
    const def: FieldSchema = { ...this.#def } as FieldSchema
    if (this.#fields.length || this.#def.driver === 'form' || this.#def.driver === 'group') {
      def.fields = this.#fields.map((f) => f.toSchema())
    }
    return def
  }

  /** Formo `to_array()` */
  toArray(): FieldSchema {
    return this.toSchema()
  }

  toJSON(): FieldSchema {
    return this.toSchema()
  }
}
