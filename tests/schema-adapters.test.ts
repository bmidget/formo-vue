import { describe, expect, it } from 'vitest'
import {
  RUNTIME,
  formFromModel,
  fromJsonSchema,
  fromLaravel,
  fromOpenApi,
  fromZod,
  parseLaravelRule,
  type ModelField,
  type ModelWarning,
  type RuntimeCallbackContext,
} from 'formo-vue/schema'

function collector() {
  const warnings: ModelWarning[] = []
  return { warnings, onWarning: (w: ModelWarning) => warnings.push(w) }
}

const byName = (fields: ModelField[]) => Object.fromEntries(fields.map((f) => [f.name, f]))

/* -------------------------------------------------------------------------- */
/*  JSON Schema                                                                */
/* -------------------------------------------------------------------------- */

describe('fromJsonSchema', () => {
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'User',
    type: 'object',
    required: ['name', 'email', 'role', 'phones'],
    properties: {
      id: { type: 'integer', readOnly: true },
      name: { type: 'string', title: 'Full name', description: 'As on your ID', minLength: 2, maxLength: 255, examples: ['Ada Lovelace'] },
      email: { type: 'string', format: 'email', pattern: '^\\S+@\\S+$' },
      website: { type: ['string', 'null'], format: 'uri' },
      age: { type: 'integer', minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
      rating: { type: 'integer', exclusiveMinimum: 0, exclusiveMaximum: 6 },
      price: { type: 'number', exclusiveMinimum: 0, multipleOf: 0.01 },
      legacy: { type: 'number', minimum: 0, exclusiveMinimum: true, nullable: true },
      role: { $ref: '#/$defs/Role' },
      plan: { oneOf: [{ const: 'free', title: 'Free' }, { const: 'pro', title: 'Pro' }] },
      size: { type: 'string', enum: ['s', 'm'], 'x-enumNames': ['Small', 'Medium'] },
      nick: { anyOf: [{ type: 'string', maxLength: 20 }, { type: 'null' }] },
      terms: { type: 'boolean', const: true },
      born: { type: 'string', format: 'date' },
      avatar: { type: 'string', format: 'binary', contentMediaType: 'image/png' },
      tags: { type: 'array', items: { enum: ['a', 'b'] }, maxItems: 2 },
      address: { $ref: '#/$defs/Address' },
      phones: { type: 'array', minItems: 1, items: { type: 'object', properties: { number: { type: 'string' } }, required: ['number'] } },
      password: { type: 'string', writeOnly: true, format: 'password' },
      dark_mode: { type: 'boolean', 'x-formo': { component: 'switch' } },
      credit_card: { type: 'string' },
      billing_address: { type: 'string' },
    },
    dependentRequired: { credit_card: ['billing_address'] },
    $defs: {
      Role: { type: ['string', 'null'], enum: ['admin', 'editor', null], title: 'Role' },
      Address: {
        type: 'object',
        title: 'Address',
        allOf: [{ properties: { street: { type: 'string' } }, required: ['street'] }, { properties: { zip: { type: 'string' } } }],
      },
    },
  }

  it('reads types, constraints, labels, refs, unions and enums', () => {
    const { warnings, onWarning } = collector()
    const model = fromJsonSchema(schema, { name: 'user', onWarning })
    expect(model).toMatchObject({ version: 1, name: 'user', label: 'User' })
    const f = byName(model.fields)

    expect(f.id).toEqual({ name: 'id', type: 'integer', readOnly: true })
    expect(f.name).toEqual({
      name: 'name',
      type: 'string',
      label: 'Full name',
      description: 'As on your ID',
      placeholder: 'Ada Lovelace',
      required: true,
      constraints: { minLength: 2, maxLength: 255 },
    })
    // a known format already validates: its pattern is dropped
    expect(f.email).toEqual({ name: 'email', type: 'string', format: 'email', required: true })
    expect(f.website).toEqual({ name: 'website', type: 'string', format: 'url', nullable: true })
    // Zod's z.int() bounds aren't constraints
    expect(f.age).toEqual({ name: 'age', type: 'integer' })
    // integers: exclusive bounds become inclusive ones
    expect(f.rating.constraints).toEqual({ min: 1, max: 5 })
    expect(f.price.constraints).toEqual({ exclusiveMin: 0, step: 0.01 })
    // OpenAPI 3.0: boolean exclusiveMinimum + nullable
    expect(f.legacy).toMatchObject({ type: 'number', nullable: true, constraints: { exclusiveMin: 0 } })
    expect(f.role).toEqual({ name: 'role', type: 'enum', label: 'Role', required: true, nullable: true, options: [{ value: 'admin' }, { value: 'editor' }] })
    expect(f.plan.options).toEqual([{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }])
    expect(f.size.options).toEqual([{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }])
    expect(f.nick).toEqual({ name: 'nick', type: 'string', nullable: true, constraints: { maxLength: 20 } })
    expect(f.terms).toEqual({ name: 'terms', type: 'boolean', constraints: { accepted: true } })
    expect(f.born.type).toBe('date')
    expect(f.avatar).toEqual({ name: 'avatar', type: 'file', constraints: { mimeTypes: ['image/png'] } })
    expect(f.tags).toEqual({ name: 'tags', type: 'array', items: { type: 'enum', options: [{ value: 'a' }, { value: 'b' }] }, constraints: { maxItems: 2 } })
    expect(f.address).toMatchObject({ type: 'object', label: 'Address', fields: [{ name: 'street', required: true }, { name: 'zip' }] })
    expect(f.phones).toMatchObject({ type: 'array', required: true, constraints: { minItems: 1 }, items: { type: 'object', fields: [{ name: 'number', required: true }] } })
    expect(f.password).toMatchObject({ type: 'string', format: 'password', writeOnly: true })
    expect(f.dark_mode.ui).toEqual({ component: 'switch' })
    expect(f.billing_address.rules).toEqual(['required_with:credit_card'])
    expect(warnings).toEqual([])
  })

  it('feeds formFromModel', () => {
    const form = formFromModel(fromJsonSchema(schema, { name: 'user' }))
    const f = form.fields!
    expect(f.id).toBeUndefined()
    expect(f.name).toMatchObject({ driver: 'text', label: 'Full name', message: 'As on your ID', attr: { placeholder: 'Ada Lovelace', maxlength: 255 } })
    expect(f.role).toMatchObject({ driver: 'select', required: true, opts: [{ value: 'admin', label: 'Admin' }, { value: 'editor', label: 'Editor' }] })
    expect(f.terms.rules).toEqual(['accepted'])
    expect(f.tags.driver).toBe('checkboxes')
    expect(f.phones).toMatchObject({ blueprint: true, min: 1, fields: { number: { required: true } } })
    expect(f.dark_mode).toEqual({ driver: 'checkbox', component: 'switch' })
    expect(f.billing_address.rules).toEqual(['required_with:credit_card'])
  })

  it('reads a definition by name; recursive refs stop with a warning', () => {
    const { warnings, onWarning } = collector()
    const defs = { $defs: { Node: { type: 'object', properties: { label: { type: 'string' }, child: { $ref: '#/$defs/Node' } } } } }
    const model = fromJsonSchema(defs, { root: 'Node', onWarning })
    // the root *is* Node: its child is already the cycle
    expect(model.fields.map((f) => [f.name, f.type])).toEqual([['label', 'string'], ['child', 'unknown']])
    expect(warnings).toMatchObject([{ path: 'child', code: 'recursive-ref' }])

    // a cycle one level down
    const nested = collector()
    const tree = fromJsonSchema({ type: 'object', properties: { root: { $ref: '#/$defs/Node' } }, ...defs }, { onWarning: nested.onWarning })
    expect(tree.fields[0].fields!.map((f) => [f.name, f.type])).toEqual([['label', 'string'], ['child', 'unknown']])
    expect(nested.warnings).toMatchObject([{ path: 'root.child', code: 'recursive-ref' }])

    const missing = collector()
    expect(() => fromJsonSchema(defs, { root: 'Nope', onWarning: missing.onWarning })).toThrow('must describe an object')
    expect(missing.warnings).toMatchObject([{ code: 'unresolved-ref' }])
  })

  it('warns about unsupported keywords, remote refs, tuples, mixed unions and bad names', () => {
    const { warnings, onWarning } = collector()
    fromJsonSchema(
      {
        type: 'object',
        properties: {
          kind: { type: 'string', if: { const: 'a' }, then: { minLength: 2 } },
          remote: { $ref: 'https://example.com/x.json' },
          pair: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }] },
          either: { oneOf: [{ type: 'string' }, { type: 'object', properties: {} }] },
          'a.b': { type: 'string' },
        },
      },
      { onWarning },
    )
    expect(warnings.map((w) => [w.path, w.code])).toEqual([
      ['kind', 'unsupported-keyword'],
      ['kind', 'unsupported-keyword'],
      ['remote', 'unresolved-ref'],
      ['pair', 'unsupported-keyword'],
      ['either', 'unsupported-keyword'],
      ['a.b', 'invalid-name'],
    ])
  })

  it('needs an object at the root', () => {
    expect(() => fromJsonSchema({ type: 'string' })).toThrow('must describe an object')
  })
})

/* -------------------------------------------------------------------------- */
/*  OpenAPI                                                                    */
/* -------------------------------------------------------------------------- */

describe('fromOpenApi', () => {
  const doc = {
    openapi: '3.0.3',
    paths: {
      '/users': {
        post: { operationId: 'createUser', requestBody: { $ref: '#/components/requestBodies/StoreUser' } },
      },
      '/users/{user}': {
        put: {
          operationId: 'updateUser',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: { allOf: [{ $ref: '#/components/schemas/User' }, { properties: { avatar: { type: 'string', format: 'binary' } } }] },
              },
            },
          },
        },
        get: { operationId: 'showUser' },
      },
    },
    components: {
      requestBodies: {
        StoreUser: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['email'],
          properties: {
            id: { type: 'integer', readOnly: true },
            email: { type: 'string', format: 'email' },
            nickname: { type: 'string', nullable: true },
            role: { $ref: '#/components/schemas/Role' },
          },
        },
        Role: { type: 'string', enum: ['admin', 'editor'] },
      },
    },
  }

  it('reads an operation\'s request body ("METHOD /path" or operationId)', () => {
    const model = fromOpenApi(doc, { operation: 'POST /users', name: 'user' })
    expect(model.name).toBe('user')
    expect(model.meta).toEqual({ source: 'openapi', operation: 'POST /users', contentType: 'application/json', operationId: 'createUser' })
    expect(model.fields.map((f) => [f.name, f.type])).toEqual([['id', 'integer'], ['email', 'string'], ['nickname', 'string'], ['role', 'enum']])
    expect(byName(model.fields).nickname.nullable).toBe(true)

    const update = fromOpenApi(doc, { operation: 'updateUser' })
    expect(update.meta).toMatchObject({ operation: 'PUT /users/{user}', contentType: 'multipart/form-data' })
    expect(byName(update.fields).avatar.type).toBe('file')
  })

  it('reads a named schema', () => {
    const model = fromOpenApi(doc, { schema: 'User' })
    expect(model.meta).toEqual({ source: 'openapi', schema: '#/components/schemas/User' })
    expect(byName(model.fields).role.options).toEqual([{ value: 'admin' }, { value: 'editor' }])
  })

  it('explains what it cannot read', () => {
    expect(() => fromOpenApi({ swagger: '2.0' }, { schema: 'User' })).toThrow('OpenAPI 3.0 / 3.1')
    expect(() => fromOpenApi(doc, { operation: 'DELETE /users' })).toThrow('no operation "DELETE /users"')
    expect(() => fromOpenApi(doc, { operation: 'showUser' })).toThrow('has no request body schema')
    expect(() => fromOpenApi(doc, {})).toThrow('pass `operation`')
  })
})

/* -------------------------------------------------------------------------- */
/*  Laravel                                                                    */
/* -------------------------------------------------------------------------- */

describe('fromLaravel', () => {
  const request = {
    name: 'user',
    rules: {
      name: 'required|string|max:255',
      email: ['required', 'email', 'max:255', 'unique:users,email'],
      age: 'nullable|integer|min:18|max:130',
      price: 'required|numeric|gt:0|decimal:0,2',
      role: 'required|in:"admin","editor","in_review"',
      level: 'integer|in:1,2,3',
      team_id: 'required|integer|exists:teams,id',
      terms: 'accepted',
      newsletter: 'boolean',
      born: 'nullable|date|before:today',
      starts_at: 'date_format:Y-m-d H:i',
      opens: 'date_format:H:i',
      bio: 'nullable|string|max:2000',
      username: 'required|alpha_dash|min:3|not_in:admin,root',
      code: 'digits_between:4,6',
      pin: 'digits:4',
      slug: ['regex:/^[a-z0-9-]+|x$/i'],
      website: 'nullable|url',
      avatar: 'nullable|image|max:2048',
      resume: 'file|mimes:pdf,doc|max:5120',
      password: 'required|string|min:8|confirmed',
      account_type: 'required|in:personal,business',
      company: 'required_if:account_type,business|string',
      start: 'nullable|integer',
      end: 'nullable|integer|gte:start',
      'address.street': 'required|string',
      'address.zip': 'required|digits:5',
      phones: 'required|array|min:1|max:3',
      'phones.*.type': 'required|in:home,work',
      'phones.*.number': 'required_if:phones.*.type,work|string|max:20',
      tags: 'array',
      'tags.*': 'string|in:vue,laravel',
      'photos.*': 'image|max:1024',
      roles: 'array',
      'roles.*': 'exists:roles,id',
      timezone: 'timezone',
      color: 'hex_color',
      weird: 'foo_bar:1',
      internal: 'exclude',
    },
    attributes: { email: 'e-mail address', 'phones.*.number': 'phone number', password_confirmation: 'password (again)' },
    messages: {
      'email.required': 'We need your e-mail',
      'age.min': 'Too young',
      'min.string': 'At least :min characters',
      required: ':attribute is required',
      'password.confirmed': 'Passwords differ',
      'phones.*.number.max': 'Too long',
      'nope.required': 'x',
    },
  }

  it('parses rule strings like Laravel (str_getcsv params, whole regex patterns)', () => {
    expect(parseLaravelRule('in:"a, b","c""d",e')).toEqual({ name: 'in', params: ['a, b', 'c"d', 'e'], raw: 'in:"a, b","c""d",e' })
    expect(parseLaravelRule('regex:/^a,b$/')).toEqual({ name: 'regex', params: ['/^a,b$/'], raw: 'regex:/^a,b$/' })
    expect(parseLaravelRule('Required')).toEqual({ name: 'required', params: [], raw: 'Required' })
  })

  it('infers types, formats and constraints from the rules', () => {
    const { warnings, onWarning } = collector()
    const model = fromLaravel(request, { onWarning })
    expect(model).toMatchObject({ version: 1, name: 'user', meta: { source: 'laravel' } })
    const f = byName(model.fields)

    expect(f.name).toEqual({ name: 'name', type: 'string', required: true, constraints: { maxLength: 255 } })
    expect(f.email).toEqual({
      name: 'email',
      type: 'string',
      format: 'email',
      label: 'e-mail address',
      required: true,
      constraints: { maxLength: 255 },
      serverRules: ['unique:users,email'],
    })
    // min / max follow the type: a number here
    expect(f.age).toEqual({ name: 'age', type: 'integer', nullable: true, constraints: { min: 18, max: 130 } })
    // Laravel's numeric = Formo's decimal (from the number input); gt:0 = exclusive bound
    expect(f.price).toEqual({ name: 'price', type: 'number', required: true, constraints: { exclusiveMin: 0 }, rules: ['decimal:2'] })
    // Rule::in() quotes its values
    expect(f.role).toEqual({ name: 'role', type: 'enum', required: true, options: [{ value: 'admin' }, { value: 'editor' }, { value: 'in_review' }] })
    expect(f.level.options).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }])
    expect(f.team_id).toEqual({
      name: 'team_id',
      type: 'relation',
      required: true,
      relation: { kind: 'belongsTo', model: 'teams', key: 'id' },
      serverRules: ['exists:teams,id'],
    })
    expect(f.terms).toEqual({ name: 'terms', type: 'boolean', constraints: { accepted: true } })
    expect(f.newsletter.type).toBe('boolean')
    expect(f.born).toEqual({ name: 'born', type: 'date', nullable: true, serverRules: ['before:today'] })
    expect(f.starts_at.type).toBe('datetime')
    expect(f.opens.type).toBe('time')
    expect(f.bio.constraints).toEqual({ maxLength: 2000 })
    expect(f.username).toEqual({
      name: 'username',
      type: 'string',
      required: true,
      constraints: { minLength: 3 },
      rules: ['alpha_dash', { rule: 'not_one_of', params: ['admin', 'root'] }],
    })
    expect(f.code.constraints).toEqual({ pattern: '^\\d{4,6}$' })
    expect(f.pin.rules).toEqual(['digits:4'])
    // array rules aren't split on |
    expect(f.slug.rules).toEqual([{ rule: 'regex', params: ['/^[a-z0-9-]+|x$/i'] }])
    expect(f.website).toMatchObject({ format: 'url', nullable: true })
    // files: max is in kilobytes
    expect(f.avatar).toEqual({ name: 'avatar', type: 'file', nullable: true, constraints: { maxSize: 2048 }, rules: ['image'], ui: { attr: { accept: 'image/*' } } })
    expect(f.resume).toEqual({ name: 'resume', type: 'file', constraints: { extensions: ['pdf', 'doc'], maxSize: 5120 } })
    expect(f.company.rules).toEqual([{ rule: 'required_if', params: ['account_type', 'business'] }])
    expect(f.end.rules).toEqual(['gte:@start'])
    expect(f.timezone.serverRules).toEqual(['timezone'])
    expect(f.color.format).toBe('color')
    expect(f.weird.serverRules).toEqual(['foo_bar:1'])
    expect(f.internal).toBeUndefined()
    expect(warnings.map((w) => [w.path, w.code])).toEqual([['weird', 'unsupported-rule'], ['nope', 'unknown-path']])
  })

  it('confirmed adds the confirmation field Laravel expects, right after', () => {
    const model = fromLaravel(request, { onWarning: () => {} })
    const names = model.fields.map((f) => f.name)
    expect(names.slice(names.indexOf('password'), names.indexOf('password') + 2)).toEqual(['password', 'password_confirmation'])
    const f = byName(model.fields)
    expect(f.password).toEqual({ name: 'password', type: 'string', format: 'password', writeOnly: true, required: true, constraints: { minLength: 8 } })
    expect(f.password_confirmation).toEqual({
      name: 'password_confirmation',
      type: 'string',
      format: 'password',
      writeOnly: true,
      required: true,
      label: 'password (again)',
      rules: ['confirmed:@password'],
    })

    // confirmed:repeat_password (Laravel 11), and an explicitly declared confirmation merged in
    const custom = fromLaravel({ rules: { secret: 'confirmed:repeat_secret', repeat_secret: 'required|min:2' } })
    expect(custom.fields.map((x) => x.name)).toEqual(['secret', 'repeat_secret'])
    expect(byName(custom.fields).repeat_secret).toMatchObject({ required: true, rules: ['confirmed:@secret'], constraints: { minLength: 2 } })
  })

  it('dotted keys are subforms, * keys are rows, checkboxes or file lists', () => {
    const f = byName(fromLaravel(request, { onWarning: () => {} }).fields)
    expect(f.address).toEqual({
      name: 'address',
      type: 'object',
      fields: [
        { name: 'street', type: 'string', required: true },
        { name: 'zip', type: 'string', required: true, rules: ['digits:5'] },
      ],
    })
    expect(f.phones).toEqual({
      name: 'phones',
      type: 'array',
      required: true,
      constraints: { minItems: 1, maxItems: 3 },
      items: {
        type: 'object',
        fields: [
          { name: 'type', type: 'enum', required: true, options: [{ value: 'home' }, { value: 'work' }] },
          // `phones.*.type` → the sibling in the same row
          { name: 'number', type: 'string', label: 'phone number', constraints: { maxLength: 20 }, rules: [{ rule: 'required_if', params: ['type', 'work'] }] },
        ],
      },
    })
    expect(f.tags).toEqual({ name: 'tags', type: 'array', items: { type: 'enum', options: [{ value: 'vue' }, { value: 'laravel' }] } })
    expect(f.photos).toEqual({
      name: 'photos',
      type: 'array',
      items: { type: 'file', constraints: { maxSize: 1024 }, rules: ['image'], ui: { attr: { accept: 'image/*' } } },
    })
    expect(f.roles.items).toEqual({ type: 'relation', relation: { kind: 'belongsTo', model: 'roles', key: 'id' }, serverRules: ['exists:roles,id'] })
  })

  it('messages(): Laravel rule names become Formo\'s, typed by the field', () => {
    const model = fromLaravel(request, { onWarning: () => {} })
    expect(model.messages).toEqual({
      'email.required': 'We need your e-mail',
      'age.min_value': 'Too young',
      min: 'At least :min characters',
      required: ':attribute is required',
      'password_confirmation.confirmed': 'Passwords differ',
      'phones.number.max': 'Too long',
    })
  })

  it('custom rules registered client-side pass through; rule objects are reported', () => {
    const { warnings, onWarning } = collector()
    const model = fromLaravel({ rules: { username: 'required|username_available', other: ['required', {}] } }, { clientRules: ['username_available'], onWarning })
    expect(byName(model.fields).username.rules).toEqual(['username_available'])
    expect(warnings).toMatchObject([{ path: 'other', code: 'rule-object' }])
    expect(() => fromLaravel({} as any)).toThrow('expected { rules')
  })

  it('becomes a Formo form', () => {
    const form = formFromModel(fromLaravel(request, { onWarning: () => {} }), {
      options: { team_id: [{ value: 1, label: 'Core' }], 'roles': [{ value: 1, label: 'Admin' }] },
      onWarning: () => {},
    })
    const f = form.fields!
    expect(form.alias).toBe('user')
    expect(form.config?.messages?.['age.min_value']).toBe('Too young')
    expect(f.name).toEqual({ driver: 'text', attr: { maxlength: 255 }, required: true, rules: ['max:255'] })
    expect(f.price).toEqual({ driver: 'number', required: true, rules: ['gt:0', 'decimal:2'] })
    expect(f.terms).toEqual({ driver: 'checkbox', rules: ['accepted'] })
    expect(f.team_id).toEqual({ driver: 'select', opts: [{ value: 1, label: 'Core' }], blank: true, required: true })
    expect(f.password_confirmation).toEqual({ label: 'password (again)', driver: 'password', required: true, rules: ['confirmed:@password'] })
    expect(f.phones).toMatchObject({ blueprint: true, min: 1, max: 3 })
    expect(f.phones.fields!.number.rules).toEqual(['max:20', { rule: 'required_if', params: ['type', 'work'] }])
    expect(f.photos).toEqual({ driver: 'file', attr: { multiple: true, accept: 'image/*' }, rules: ['size:1024', 'image'] })
    expect(f.roles).toEqual({ driver: 'checkboxes', opts: [{ value: 1, label: 'Admin' }] })
    expect(f.avatar).toEqual({ driver: 'file', attr: { accept: 'image/*' }, rules: ['size:2048', 'image'] })
    expect(f.username.rules).toEqual(['min:3', 'alpha_dash', { rule: 'not_one_of', params: ['admin', 'root'] }])
  })
})

/* -------------------------------------------------------------------------- */
/*  Zod — the runtime part, with a schema shaped like Zod 4's                  */
/*  (tests/schema-zod.test.ts runs the same against the real Zod)              */
/* -------------------------------------------------------------------------- */

type Issue = { code: string; path: PropertyKey[]; message: string }

/** A Zod-4-shaped schema: `_zod.def` + `safeParseAsync`, answering from a function */
function fake(def: Record<string, any>, check: (value: unknown) => Issue[] = () => []) {
  const calls: unknown[] = []
  return {
    calls,
    _zod: { def },
    async safeParseAsync(value: unknown) {
      calls.push(value)
      const issues = check(value)
      return issues.length ? { success: false, error: { issues } } : { success: true }
    },
  }
}

const customCheck = { _zod: { def: { check: 'custom' } } }

describe('fromZod (runtime)', () => {
  const password = fake({ type: 'string', checks: [{ _zod: { def: { check: 'min_length' } } }, customCheck] }, (v) => {
    const issues: Issue[] = []
    if (typeof v !== 'string') return [{ code: 'invalid_type', path: [], message: 'Expected string' }]
    if (v.length < 8) issues.push({ code: 'too_small', path: [], message: 'Too small' })
    if (!/\d/.test(v)) issues.push({ code: 'custom', path: [], message: 'Add a number' })
    return issues
  })
  const nickname = fake({ type: 'nullable', innerType: { _zod: { def: { type: 'string' } } } })
  const name = fake({ type: 'string', checks: [] })
  const born = fake({ type: 'optional', innerType: { _zod: { def: { type: 'date' } } } })
  const number = fake({ type: 'string' })
  const row = { _zod: { def: { type: 'object', shape: { number } } } }
  const phones = { _zod: { def: { type: 'array', element: row } } }

  let formIssues: Issue[] = []
  const root = fake(
    // an object-level refinement (the "passwords match" kind)
    { type: 'object', shape: { name, password, nickname, born, phones }, checks: [customCheck] },
    () => formIssues,
  )
  const json = {
    type: 'object',
    required: ['name', 'password', 'phones'],
    properties: {
      name: { type: 'string', minLength: 2 },
      password: { type: 'string', minLength: 8 },
      nickname: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      born: {},
      phones: { type: 'array', items: { type: 'object', properties: { number: { type: 'string' } } } },
    },
  }

  it('reads the JSON Schema, attaches validators, and finds z.date() fields', () => {
    const model = fromZod(root, { toJSONSchema: () => json, name: 'signup' })
    expect(model).toMatchObject({ name: 'signup', meta: { source: 'zod' } })
    const f = byName(model.fields)
    expect(f.born.type).toBe('date')
    expect(Object.keys(f.password[RUNTIME]!)).toEqual(['validate', 'refine'])
    // no refinement: nothing to run in derived mode
    expect(Object.keys(f.name[RUNTIME]!)).toEqual(['validate'])
    expect(f.phones.items!.fields![0][RUNTIME]).toBeDefined()
    expect(Object.keys(model[RUNTIME]!)).toEqual(['refine', 'validate'])
  })

  it('derived: a field\'s refinements run after Formo\'s rules, skip empty values, report refinements only', async () => {
    const form = formFromModel(fromZod(root, { toJSONSchema: () => json }))
    const rules = form.fields!.password.rules!
    expect(rules[0]).toBe('min:8')
    const refine = rules[1] as (...a: any[]) => Promise<unknown>
    expect(refine.name).toBe('refine')
    expect(await refine('', [], {})).toBe(true)
    // "Too small" is Formo's job (min:8) — only the refinement comes from Zod
    expect(await refine('abc', [], {})).toBe('Add a number')
    expect(await refine('abcdefgh1', [], {})).toBe(true)
  })

  it('schema: every issue; empty values read as undefined (or null when nullable)', async () => {
    const form = formFromModel(fromZod(root, { toJSONSchema: () => json }), { validation: 'schema' })
    const validate = form.fields!.password.rules![0] as (...a: any[]) => Promise<unknown>
    expect(validate.name).toBe('required')
    expect(await validate('abc', [], {})).toBe('Too small')
    expect(await validate('', [], {})).toBe('Expected string')
    expect(password.calls.at(-1)).toBeUndefined()

    const nick = form.fields!.nickname.rules![0] as (...a: any[]) => Promise<unknown>
    expect(nick.name).toBe('schema')
    await nick('', [], {})
    expect(nickname.calls.at(-1)).toBeNull()

    const date = form.fields!.born.rules![0] as (...a: any[]) => Promise<unknown>
    await date('2024-05-01', [], {})
    expect(born.calls.at(-1)).toBeInstanceOf(Date)
  })

  it('object-level refinements: errors mapped onto the fields they name', async () => {
    const model = fromZod(root, { toJSONSchema: () => json })
    const errors: Record<string, string> = {}
    const registered = new Set(['', 'name', 'password', 'phones', 'phones[0].number', 'ignored'])
    const ctx: RuntimeCallbackContext = {
      values: { name: 'Ada', password: 'x', nickname: '', born: '', phones: [{ number: '' }], ignored: 'x' },
      form: {
        setError: (path, message) => (errors[path] = message),
        find: (path) => (registered.has(path) ? { path } : undefined),
        isIgnored: (path) => path === 'ignored',
      },
    }
    formIssues = [
      { code: 'custom', path: ['password'], message: 'Passwords differ' },
      { code: 'custom', path: ['password'], message: 'Shown once' },
      { code: 'custom', path: ['phones', 0, 'number', 'deep'], message: 'Row problem' },
      { code: 'custom', path: [], message: 'Form problem' },
      { code: 'custom', path: ['ignored'], message: 'Not while ignored' },
      { code: 'custom', path: ['not_in_form'], message: 'Nowhere to show it' },
      { code: 'invalid_type', path: ['name'], message: 'Not a refinement' },
    ]
    expect(await model[RUNTIME]!.refine!(ctx)).toBe(false)
    expect(errors).toEqual({ password: 'Passwords differ', 'phones[0].number': 'Row problem', '': 'Form problem' })
    // values were read the Zod way
    expect(root.calls.at(-1)).toEqual({ name: 'Ada', password: 'x', nickname: null, born: undefined, phones: [{ number: undefined }], ignored: 'x' })

    // schema mode maps every issue
    const all: Record<string, string> = {}
    await model[RUNTIME]!.validate!({ ...ctx, form: { ...ctx.form, setError: (p, m) => (all[p] = m) } })
    expect(all.name).toBe('Not a refinement')

    formIssues = []
    expect(await model[RUNTIME]!.refine!(ctx)).toBeUndefined()
  })

  it('onRefinement reports every failed refinement, with the path it\'s shown on', async () => {
    const events: unknown[] = []
    const model = fromZod(root, { toJSONSchema: () => json, onRefinement: (r) => events.push(r) })
    const refine = formFromModel(model).fields!.password.rules![1] as (...a: any[]) => Promise<unknown>
    await refine('abcdefgh', [], { path: 'password' })
    // Formo's own failures are not refinements: not reported
    await refine('abcdefg1', [], { path: 'password' })

    formIssues = [
      { code: 'custom', path: ['phones', 0, 'number'], message: 'Row problem' },
      { code: 'too_small', path: ['name'], message: 'Not a refinement' },
    ]
    await model[RUNTIME]!.refine!({
      values: {},
      form: { setError: () => {}, find: (path) => ({ path }), isIgnored: () => false },
    })
    formIssues = []
    expect(events).toEqual([
      { path: 'password', message: 'Add a number', level: 'field' },
      { path: 'phones[0].number', message: 'Row problem', level: 'form' },
    ])
  })

  it('form-level pass only when some object has refinements — the root, a subform, a list or its rows', () => {
    const plain = fake({ type: 'object', shape: { name } })
    const toJSONSchema = () => ({ type: 'object', properties: { name: { type: 'string' } } })
    expect(Object.keys(fromZod(plain, { toJSONSchema })[RUNTIME]!)).toEqual(['validate'])
    // a refined row inside a list
    const refinedRow = { _zod: { def: { type: 'object', shape: { number }, checks: [customCheck] } } }
    const withRows = fake({ type: 'object', shape: { phones: { _zod: { def: { type: 'array', element: refinedRow } } } } })
    expect(Object.keys(fromZod(withRows, { toJSONSchema })[RUNTIME]!)).toEqual(['refine', 'validate'])
    // a refined subform, behind .optional()
    const refinedGroup = { _zod: { def: { type: 'optional', innerType: { _zod: { def: { type: 'object', shape: {}, checks: [customCheck] } } } } } }
    expect(Object.keys(fromZod(fake({ type: 'object', shape: { address: refinedGroup } }), { toJSONSchema })[RUNTIME]!)).toEqual(['refine', 'validate'])
    // the callbacks have names (readable in devtools)
    expect(fromZod(withRows, { toJSONSchema })[RUNTIME]!.refine!.name).toBe('zodObjectRefinements')
  })

  it('needs a way to get the JSON Schema', () => {
    expect(() => fromZod(fake({ type: 'object', shape: {} }))).toThrow('pass { toJSONSchema: z.toJSONSchema }')
    // a schema that can produce it itself
    const self = Object.assign(fake({ type: 'object', shape: {} }), { toJSONSchema: () => ({ type: 'object', properties: { a: { type: 'string' } } }) })
    expect(fromZod(self).fields.map((f) => f.name)).toEqual(['a'])
  })
})
