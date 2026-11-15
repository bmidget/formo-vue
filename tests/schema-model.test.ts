import { describe, expect, it } from 'vitest'
// Imported as a module (not read through `new URL(…, import.meta.url)`, which Vite rewrites under happy-dom)
import contract from '../src/schema/formo-model.v1.schema.json'
import {
  MODEL_FIELD_TYPES,
  RUNTIME,
  formFromModel,
  mergeSpec,
  parseModel,
  toFormValues,
  type FieldSpec,
  type FormoModel,
  type ModelWarning,
} from 'formo-vue/schema'

/** Collects warnings instead of printing them */
function collector() {
  const warnings: ModelWarning[] = []
  return { warnings, onWarning: (w: ModelWarning) => warnings.push(w) }
}

const user: FormoModel = {
  version: 1,
  name: 'user',
  fields: [
    { name: 'id', type: 'integer', readOnly: true },
    { name: 'name', type: 'string', label: 'Full name', required: true, constraints: { maxLength: 255 } },
    { name: 'email', type: 'string', format: 'email', required: true, description: 'We never share it' },
    { name: 'bio', type: 'string', nullable: true, constraints: { maxLength: 2000 } },
    { name: 'age', type: 'integer', constraints: { min: 18, max: 130 } },
    { name: 'score', type: 'number', constraints: { exclusiveMin: 0, step: 0.5 } },
    { name: 'newsletter', type: 'boolean', default: true },
    { name: 'terms', type: 'boolean', required: true, constraints: { accepted: true } },
    { name: 'born', type: 'date' },
    { name: 'meeting', type: 'datetime' },
    { name: 'role', type: 'enum', required: true, options: [{ value: 'admin', label: 'Administrator' }, { value: 'in_review' }] },
    { name: 'tags', type: 'array', items: { type: 'enum', options: [{ value: 'a' }, { value: 'b' }] }, constraints: { maxItems: 2 } },
    { name: 'avatar', type: 'file', constraints: { maxSize: 2048, mimeTypes: ['image/*'] } },
    { name: 'team_id', type: 'relation', relation: { kind: 'belongsTo' } },
    {
      name: 'address',
      type: 'object',
      label: 'Address',
      fields: [
        { name: 'street', type: 'string', required: true },
        { name: 'zip', type: 'string', constraints: { pattern: '^\\d{5}$' } },
      ],
    },
    {
      name: 'phones',
      type: 'array',
      required: true,
      constraints: { maxItems: 3 },
      items: {
        type: 'object',
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'number', type: 'string', format: 'tel', required: true },
        ],
      },
    },
    { name: 'status', type: 'enum', readOnly: true, options: [{ value: 'active' }, { value: 'banned' }] },
    { name: 'password', type: 'string', format: 'password', writeOnly: true, required: true, constraints: { minLength: 8 } },
    { name: 'password_confirmation', type: 'string', format: 'password', writeOnly: true, rules: ['confirmed:@password'] },
    { name: 'created_at', type: 'datetime', readOnly: true },
    { name: 'secret', type: 'string', fillable: false },
  ],
}

const teams = [{ value: 1, label: 'Core' }]

describe('parseModel (IR JSON v1)', () => {
  it('reads objects and JSON, and checks the version', () => {
    expect(parseModel('{"version":1,"fields":[{"name":"a","type":"string"}]}').fields[0].name).toBe('a')
    expect(() => parseModel({ fields: [] })).toThrow('missing `version`')
    expect(() => parseModel({ version: 2, fields: [] })).toThrow('Unsupported Formo model version 2')
    expect(() => parseModel({ version: 1 })).toThrow('`fields` must be an array')
  })

  it('rejects names that cannot be form aliases, and duplicates', () => {
    expect(() => parseModel({ version: 1, fields: [{ name: 'a.b', type: 'string' }] })).toThrow('not a valid field name')
    expect(() => parseModel({ version: 1, fields: [{ type: 'string' }] })).toThrow('needs a `name`')
    expect(() => parseModel({ version: 1, fields: [{ name: 'a', type: 'string' }, { name: 'a', type: 'text' }] })).toThrow('duplicate field "a"')
  })

  it('reads types from a newer v1 as unknown, with a warning (additive changes only)', () => {
    const { warnings, onWarning } = collector()
    const model = parseModel({ version: 1, fields: [{ name: 'where', type: 'geopoint' }], extra: true }, onWarning)
    expect(model.fields[0].type).toBe('unknown')
    expect(warnings).toMatchObject([{ path: 'where', code: 'unknown-type' }])
  })

  it('keeps runtime validators in memory but never serializes them', () => {
    const refine = () => true
    const model = parseModel({ version: 1, fields: [{ name: 'a', type: 'string', [RUNTIME]: { refine } }] } as FormoModel)
    expect(model.fields[0][RUNTIME]?.refine).toBe(refine)
    expect(JSON.stringify(model)).not.toContain('refine')
  })
})

describe('the published contract (formo-model.v1.schema.json)', () => {
  it('stays in sync with the TypeScript types', () => {
    expect(contract.properties.version).toEqual({ const: 1 })
    expect(contract.$defs.type.enum).toEqual([...MODEL_FIELD_TYPES])
    const item = contract.$defs.item.properties
    const keys: Array<keyof import('formo-vue/schema').ModelField> = [
      'name', 'type', 'format', 'label', 'description', 'placeholder', 'required', 'nullable', 'default', 'options', 'constraints',
      'rules', 'serverRules', 'messages', 'readOnly', 'writeOnly', 'fillable', 'relation', 'fields', 'items', 'ui',
    ]
    expect(Object.keys(item).sort()).toEqual([...keys].sort())
    const constraints: Array<keyof import('formo-vue/schema').ModelConstraints> = [
      'minLength', 'maxLength', 'min', 'max', 'exclusiveMin', 'exclusiveMax', 'step', 'pattern', 'minItems', 'maxItems',
      'maxSize', 'extensions', 'mimeTypes', 'accepted',
    ]
    expect(Object.keys(contract.$defs.constraints.properties).sort()).toEqual([...constraints].sort())
  })
})

describe('formFromModel', () => {
  it('maps every type to its driver, rules and attributes', () => {
    const { warnings, onWarning } = collector()
    const form = formFromModel(user, { options: { team_id: teams }, onWarning })
    const f = form.fields!

    expect(form.alias).toBe('user')
    // id / created_at: bookkeeping, status: read-only (create form), secret: not fillable
    expect(Object.keys(f)).toEqual([
      'name', 'email', 'bio', 'age', 'score', 'newsletter', 'terms', 'born', 'meeting', 'role', 'tags', 'avatar',
      'team_id', 'address', 'phones', 'password', 'password_confirmation',
    ])
    expect(f.name).toEqual({ label: 'Full name', driver: 'text', attr: { maxlength: 255 }, required: true, rules: ['max:255'] })
    expect(f.email).toEqual({ message: 'We never share it', driver: 'email', required: true, rules: ['email'] })
    expect(f.bio).toEqual({ driver: 'textarea', attr: { maxlength: 2000 }, filters: ['null_if_empty'], rules: ['max:2000'] })
    expect(f.age).toEqual({ driver: 'number', rules: ['integer', 'min_value:18', 'max_value:130'] })
    expect(f.score).toEqual({ driver: 'number', attr: { step: 0.5 }, rules: ['gt:0'] })
    expect(f.newsletter).toEqual({ val: true, driver: 'checkbox' })
    // a required boolean only has to be present; `accepted` = must be checked
    expect(f.terms).toEqual({ driver: 'checkbox', rules: ['accepted'] })
    expect(f.born).toEqual({ driver: 'date' })
    expect(f.meeting).toEqual({ driver: 'datetime-local' })
    expect(f.role).toEqual({
      driver: 'select',
      opts: [{ value: 'admin', label: 'Administrator' }, { value: 'in_review', label: 'In review' }],
      blank: true,
      required: true,
    })
    expect(f.tags).toEqual({ driver: 'checkboxes', opts: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], rules: ['max_items:2'] })
    expect(f.avatar).toEqual({ driver: 'file', attr: { accept: 'image/*' }, rules: ['size:2048', { rule: 'mimes', params: ['image/*'] }] })
    expect(f.team_id).toEqual({ driver: 'select', opts: teams, blank: true })
    expect(f.address.label).toBe('Address')
    expect(f.address.fields!.street).toEqual({ driver: 'text', required: true })
    expect(f.address.fields!.zip).toEqual({ driver: 'text', rules: [{ rule: 'regex', params: [/^\d{5}$/u] }] })
    // array of objects: repeatable rows, `required` = at least one; a row's id stays (hidden)
    expect(f.phones).toEqual({ blueprint: true, min: 1, max: 3, fields: { id: { driver: 'hidden' }, number: { driver: 'tel', required: true } } })
    expect(f.password).toEqual({ driver: 'password', required: true, rules: ['min:8'] })
    expect(f.password_confirmation).toEqual({ driver: 'password', rules: ['confirmed:@password'] })
    expect(warnings).toEqual([])
  })

  it('update forms: read-only fields uneditable (not validated, not submitted), passwords optional', () => {
    const f = formFromModel(user, { mode: 'update', options: { team_id: teams } }).fields!
    expect(f.status).toEqual({
      driver: 'select',
      opts: [{ value: 'active', label: 'Active' }, { value: 'banned', label: 'Banned' }],
      blank: true,
      editable: false,
      exclude: true,
    })
    // bookkeeping stays out unless asked for
    expect(f.id).toBeUndefined()
    expect(f.created_at).toBeUndefined()
    // "leave blank to keep the current password": optional, dropped when empty — confirmation included
    expect(f.password).toEqual({ driver: 'password', rules: ['min:8'], exclude: { when: 'password', filled: false } })
    expect(f.password_confirmation).toEqual({ driver: 'password', rules: ['confirmed:@password'], exclude: { when: 'password', filled: false } })
  })

  it('readOnly: "omit" leaves read-only fields out of update forms; asking for one includes it anyway', () => {
    expect(formFromModel(user, { mode: 'update', readOnly: 'omit', options: { team_id: teams } }).fields!.status).toBeUndefined()
    expect(formFromModel(user, { only: ['status'] }).fields!.status).toMatchObject({ editable: false, exclude: true })
  })

  it('only / except take dotted paths', () => {
    const only = formFromModel(user, { only: ['name', 'address.zip', 'phones'] }).fields!
    expect(Object.keys(only)).toEqual(['name', 'address', 'phones'])
    expect(Object.keys(only.address.fields!)).toEqual(['zip'])
    expect(Object.keys(only.phones.fields!)).toEqual(['id', 'number'])

    const except = formFromModel(user, { except: ['bio', 'address.street', 'phones.*.number'], options: { team_id: teams } }).fields!
    expect(except.bio).toBeUndefined()
    expect(Object.keys(except.address.fields!)).toEqual(['zip'])
    expect(Object.keys(except.phones.fields!)).toEqual(['id'])
  })

  it('rows keep their id (hidden) when only narrows inside them — unless except names it', () => {
    const record = { phones: [{ id: 1, number: '555' }] }
    const narrowed = formFromModel(user, { only: ['phones.number'], values: record })
    expect(narrowed.fields!.phones.fields).toEqual({ id: { driver: 'hidden' }, number: { driver: 'tel', required: true } })
    expect(narrowed.val).toEqual({ phones: [{ id: 1, number: '555' }] })
    expect(Object.keys(formFromModel(user, { only: ['phones.number'], except: ['phones.id'] }).fields!.phones.fields!)).toEqual(['number'])
  })

  it('an empty only list means no filter (an empty "only" box in a UI)', () => {
    expect(Object.keys(formFromModel(user, { only: [], options: { team_id: teams } }).fields!)).toContain('name')
  })

  it('bookkeeping and guarded fields come in when asked for explicitly', () => {
    const { warnings, onWarning } = collector()
    const f = formFromModel(user, { only: ['id', 'secret'], onWarning }).fields!
    expect(f.id).toEqual({ driver: 'number', editable: false, exclude: true })
    expect(f.secret).toEqual({ driver: 'text' })
    expect(warnings).toMatchObject([{ path: 'secret', code: 'not-fillable' }])

    // an override asks for it too
    const g = formFromModel(user, { mode: 'update', options: { team_id: teams }, fields: { created_at: { label: 'Member since' } } }).fields!
    expect(g.created_at).toEqual({ driver: 'datetime-local', label: 'Member since', editable: false, exclude: true })

    // metadata: false keeps them all
    expect(formFromModel(user, { mode: 'update', metadata: false, options: { team_id: teams } }).fields!.id).toBeDefined()
  })

  it('warns about paths that match nothing', () => {
    const { warnings, onWarning } = collector()
    formFromModel(user, { only: ['name', 'nope'], except: ['address.nope'], onWarning })
    expect(warnings).toMatchObject([
      { path: 'nope', code: 'unknown-path' },
      { path: 'address.nope', code: 'unknown-path' },
    ])
  })

  it('overrides merge, replace, remove and add fields', () => {
    const { warnings, onWarning } = collector()
    const f = formFromModel(user, {
      options: { team_id: teams },
      onWarning,
      fields: {
        role: { driver: 'radios' },
        name: { attr: { autocomplete: 'name' } },
        bio: false,
        email: (generated) => ({ ...generated, rules: [...(generated.rules ?? []), 'username_available'] }),
        age: { rules: ['integer'] },
        'address.zip': { label: 'Postcode' },
        address: { fields: { street: { label: 'Street' } } },
        'phones.*.number': { label: 'Number' },
        captcha: { driver: 'text', label: 'Captcha', required: true },
      },
    }).fields!
    expect(f.role).toMatchObject({ driver: 'radios', opts: [{ value: 'admin' }, { value: 'in_review' }] })
    expect(f.name.attr).toEqual({ maxlength: 255, autocomplete: 'name' })
    expect(f.bio).toBeUndefined()
    expect(f.email.rules).toEqual(['email', 'username_available'])
    expect(f.age.rules).toEqual(['integer'])
    expect(f.address.fields!.zip.label).toBe('Postcode')
    expect(f.address.fields!.street).toEqual({ driver: 'text', required: true, label: 'Street' })
    expect(f.phones.fields!.number.label).toBe('Number')
    expect(Object.keys(f).pop()).toBe('captcha')
    expect(f.captcha).toEqual({ driver: 'text', label: 'Captcha', required: true })
    expect(warnings).toEqual([])
  })

  it('warns about overrides it cannot apply', () => {
    const { warnings, onWarning } = collector()
    formFromModel(user, { options: { team_id: teams }, except: ['bio'], fields: { bio: { label: 'Bio' }, 'nope.x': { label: 'X' } }, onWarning })
    expect(warnings).toMatchObject([
      { path: 'bio', code: 'excluded-override' },
      { path: 'nope.x', code: 'unknown-path' },
    ])
  })

  it('types Formo has no control for are skipped — unless an override gives them one', () => {
    const model: FormoModel = { version: 1, fields: [{ name: 'labels', type: 'array', label: 'Labels', items: { type: 'string' } }, { name: 'geo', type: 'unknown' }] }
    const { warnings, onWarning } = collector()
    expect(formFromModel(model, { onWarning }).fields).toEqual({})
    expect(warnings.map((w) => [w.path, w.code])).toEqual([['labels', 'unsupported-type'], ['geo', 'unsupported-type']])

    const quiet = collector()
    const f = formFromModel(model, { fields: { labels: { driver: 'tags' }, geo: { component: 'map-picker' } }, onWarning: quiet.onWarning }).fields!
    expect(f.labels).toEqual({ label: 'Labels', driver: 'tags' })
    expect(f.geo).toEqual({ component: 'map-picker' })
    expect(quiet.warnings).toEqual([])
  })

  it('orders fields, inside subforms too', () => {
    const f = formFromModel(user, { order: ['email', 'name', 'address.zip'], options: { team_id: teams } }).fields!
    expect(Object.keys(f).slice(0, 3)).toEqual(['email', 'name', 'bio'])
    expect(Object.keys(f.address.fields!)).toEqual(['zip', 'street'])
  })

  it('policy: radios for short enums, textarea threshold, a final say on drivers', () => {
    const f = formFromModel(user, {
      options: { team_id: teams },
      policy: { radiosUpTo: 3, textareaAbove: 100, driverFor: (field, proposed) => (field.type === 'date' ? 'text' : proposed) },
    }).fields!
    expect(f.role.driver).toBe('radios')
    expect(f.name.driver).toBe('textarea')
    expect(f.born.driver).toBe('text')
  })

  it('warns when a relation has no options', () => {
    const { warnings, onWarning } = collector()
    expect(formFromModel(user, { only: ['team_id'], onWarning }).fields!.team_id.opts).toEqual([])
    expect(warnings).toMatchObject([{ path: 'team_id', code: 'missing-options' }])
  })

  it('ui hints from the model are merged last', () => {
    const model: FormoModel = {
      version: 1,
      fields: [{ name: 'bio', type: 'text', placeholder: 'Tell us', ui: { view: 'floating', attr: { rows: 8 }, component: 'rich-text' } }],
    }
    expect(formFromModel(model).fields!.bio).toEqual({ driver: 'textarea', attr: { placeholder: 'Tell us', rows: 8 }, view: 'floating', component: 'rich-text' })
  })

  it('validation: "none" adds no rules at all', () => {
    const f = formFromModel(user, { validation: 'none', options: { team_id: teams } }).fields!
    const anyRules = (fields: Record<string, FieldSpec>): boolean =>
      Object.values(fields).some((s) => !!s.rules?.length || s.required || (s.fields ? anyRules(s.fields) : false))
    expect(anyRules(f)).toBe(false)
  })

  it('model-wide messages become the form\'s message overrides', () => {
    const form = formFromModel({ version: 1, fields: [{ name: 'a', type: 'string' }], messages: { required: 'Fill :field in', 'a.max': 'Too long' } })
    expect(form.config).toEqual({ namePrefix: false, messages: { required: 'Fill :field in', 'a.max': 'Too long' } })
  })

  it('posts with the model\'s own keys (what the server validates) — or wrapped in a rootKey', () => {
    // `email`, `address[street]` — not `user[email]`: a native post (JavaScript off) meets the FormRequest's rules
    expect(formFromModel(user, { only: ['name'] }).config).toEqual({ namePrefix: false })
    // Rails-style params: user[email], { user: {...} } — and `user.email` error keys are read back
    expect(formFromModel(user, { only: ['name'], rootKey: 'user' }).config).toEqual({ namePrefix: 'user', request: { rootKey: 'user' } })
  })

  it('attr: the form\'s action / method (posts with JavaScript off, sends itself)', () => {
    expect(formFromModel(user, { only: ['name'], attr: { action: '/users/7', method: 'put' } }).attr).toEqual({ action: '/users/7', method: 'put' })
  })

  describe('schema-backed models (runtime validators)', () => {
    const refine = async (v: unknown) => v !== 'bad' || 'No bad values'
    const validate = async (v: unknown) => (typeof v === 'string' && v.length > 1) || 'Invalid'
    const formRefine = async () => undefined
    const formValidate = async () => undefined
    const model = {
      version: 1,
      fields: [
        { name: 'code', type: 'string', required: true, constraints: { minLength: 2 }, [RUNTIME]: { refine, validate } },
        { name: 'note', type: 'string', [RUNTIME]: { validate } },
      ],
      [RUNTIME]: { refine: formRefine, validate: formValidate },
    } as FormoModel

    it('derived (default): Formo rules first, then the schema\'s refinements; object-level ones on submit', async () => {
      const form = formFromModel(model)
      const rules = form.fields!.code.rules!
      expect(rules.slice(0, 1)).toEqual(['min:2'])
      const last = rules[1] as (...a: any[]) => unknown
      expect(last.name).toBe('refine')
      expect(await last('bad', [], {})).toBe('No bad values')
      expect(form.fields!.code.required).toBe(true)
      expect(form.fields!.note.rules).toBeUndefined()
      expect(form.callbacks).toEqual({ pass: [formRefine] })
    })

    it('schema: the schema is the only validator (required fields keep the marker)', () => {
      const form = formFromModel(model, { validation: 'schema' })
      const [code] = form.fields!.code.rules as Array<(...a: any[]) => unknown>
      expect(code.name).toBe('required')
      expect(form.fields!.code.required).toBeUndefined()
      expect((form.fields!.note.rules![0] as (...a: any[]) => unknown).name).toBe('schema')
      expect(form.callbacks).toEqual({ pass: [formValidate] })
      // every input type cleared: config layers deep-merge, an empty object would change nothing
      expect(form.config?.htmlConstraintRules).toBe(false)
      expect(form.config?.inputRules).toMatchObject({ email: [], url: [], tel: [], number: [], date: [], time: [] })
    })

    it('schema mode without a schema: derived rules, with a warning', () => {
      const { warnings, onWarning } = collector()
      const form = formFromModel(user, { validation: 'schema', only: ['name'], onWarning })
      expect(form.fields!.name.rules).toEqual(['max:255'])
      expect(warnings).toMatchObject([{ code: 'no-schema' }])
    })
  })

  it('mergeSpec: objects merge one level, rules / opts / val are replaced, options / value aliases', () => {
    const base: FieldSpec = { driver: 'text', attr: { a: 1 }, rules: ['x'], opts: ['a'] }
    expect(mergeSpec(base, { attr: { b: 2 }, rules: ['y'], options: ['b'], value: 'v' })).toEqual({
      driver: 'text',
      attr: { a: 1, b: 2 },
      rules: ['y'],
      opts: ['b'],
      val: 'v',
    })
  })
})

describe('toFormValues', () => {
  it('loads a record the way the controls need it', () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const zoned = new Date('2024-01-02T03:04:05.000000Z')
    const local = `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`

    const values = toFormValues(user, {
      id: 7,
      name: 'Ada',
      bio: null,
      age: '36',
      score: '4.50',
      newsletter: 1,
      terms: '0',
      born: '1815-12-10T00:00:00.000000Z',
      meeting: '2024-05-01 09:30:00',
      role: 'admin',
      tags: ['a'],
      avatar: 'avatars/ada.png',
      team: { id: 3, name: 'Core' },
      address: { street: 'St James', zip: '12345', country: 'UK' },
      phones: [{ id: 1, number: '555' }],
      password: '$2y$10$hash',
      created_at: '2024-01-02T03:04:05.000000Z',
      unknown: 'dropped',
    })
    expect(values).toEqual({
      id: 7,
      name: 'Ada',
      age: 36,
      score: 4.5,
      newsletter: true,
      terms: false,
      born: '1815-12-10',
      meeting: '2024-05-01T09:30',
      role: 'admin',
      tags: ['a'],
      team_id: 3,
      address: { street: 'St James', zip: '12345' },
      phones: [{ id: 1, number: '555' }],
      created_at: local,
    })
  })

  it('{ form }: only the values of the fields the form has (keyed definitions, builder lists, rows)', () => {
    const record = { name: 'Ada', email: 'a@b.co', role: 'admin', address: { street: 'St', zip: '1' }, phones: [{ id: 1, number: '5' }] }
    const form = formFromModel(user, { only: ['name', 'address.zip', 'phones'] })
    expect(toFormValues(user, record, { form })).toEqual({ name: 'Ada', address: { zip: '1' }, phones: [{ id: 1, number: '5' }] })
    // a builder: its toSchema() lists children with their alias
    const builderLike = { toSchema: () => ({ fields: [{ alias: 'email' }, { alias: 'address', fields: [{ alias: 'street' }] }] }) }
    expect(toFormValues(user, record, { form: builderLike })).toEqual({ email: 'a@b.co', address: { street: 'St' } })
  })

  it('formFromModel({ values }): loads a record as the form\'s initial values', () => {
    const form = formFromModel(user, { mode: 'update', except: ['role'], options: { team_id: teams }, values: { name: 'Ada', role: 'admin', status: 'active', password: 'hash', id: 3 } })
    expect(form.val).toEqual({ name: 'Ada', status: 'active' })
    expect(formFromModel(user, { values: {}, options: { team_id: teams } }).val).toBeUndefined()
  })

  it('relations: objects and lists of objects become keys; enum values keep the options\' type', () => {
    const model: FormoModel = {
      version: 1,
      fields: [
        { name: 'owner', type: 'relation', relation: { kind: 'belongsTo', key: 'uuid' } },
        { name: 'roles', type: 'relation', relation: { kind: 'belongsToMany' } },
        { name: 'level', type: 'enum', options: [{ value: 1 }, { value: 2 }] },
        { name: 'at', type: 'time' },
      ],
    }
    expect(toFormValues(model, { owner: { uuid: 'u-1' }, roles: [{ id: 1 }, { id: 2 }], level: '2', at: '09:15:00' })).toEqual({
      owner: 'u-1',
      roles: [1, 2],
      level: 2,
      at: '09:15',
    })
    expect(toFormValues(model, null)).toEqual({})
  })
})
