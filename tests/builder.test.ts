import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { Formo, normalize, defaultDrivers, buildInitialValues, defaultConfig } from 'formo-vue'
import type { FieldDef } from 'formo-vue'

const aliases = (f: Formo) => f.fields().map((x) => x.alias())

describe('Formo builder', () => {
  it('supports every add() signature', () => {
    const form = Formo.form({ alias: 'user' })
      .add('username')
      .add('notes', 'textarea', 'My notes')
      .add('email', 'input|email', { required: true })
      .add('hobbies', 'checkboxes', ['run'], { opts: { run: 'Running' } })
      .add('bio', { driver: 'textarea' })
      .add({ alias: 'age', driver: 'input|number' })

    const schema = form.toSchema()
    expect(schema.alias).toBe('user')
    expect(schema.fields!.map((f: any) => [f.alias, f.driver, f.val])).toEqual([
      ['username', undefined, undefined],
      ['notes', 'textarea', 'My notes'],
      ['email', 'input|email', undefined],
      ['hobbies', 'checkboxes', ['run']],
      ['bio', 'textarea', undefined],
      ['age', 'input|number', undefined],
    ])
    expect('val' in (schema.fields![0] as object)).toBe(false)
    expect(form.find('email')!.isRequired()).toBe(true)
  })

  it('replaces spaces in aliases (Formo convention)', () => {
    expect(Formo.form().add('first name').field('first_name')).toBeDefined()
  })

  it('adds subforms and converts added forms to groups', () => {
    const address = Formo.form().add('street').add('zip')
    const form = Formo.form().add('address', address)
    expect(form.field('address')!.driver()).toBe('group')
    expect(form.find('zip')).toBeDefined()
    expect(form.find(['address', 'street'])).toBeDefined()
    expect(form.find('address.street')).toBeDefined()
  })

  it('orders fields at add time and afterwards', () => {
    const form = Formo.form()
      .add('username')
      .add('password')
      .add('email', { order: ['before', 'password'] })
      .add('firstname', { order: ['after', 'email'] })
    expect(aliases(form)).toEqual(['username', 'email', 'firstname', 'password'])

    form.order({ password: 0, username: ['after', 'firstname'] })
    expect(aliases(form)).toEqual(['password', 'email', 'firstname', 'username'])
  })

  it('creates subforms from existing fields', () => {
    const form = Formo.form().add('email').add('street').add('city').subform('address', ['street', 'city'], 0)
    expect(aliases(form)).toEqual(['address', 'email'])
    expect(aliases(form.field('address')!)).toEqual(['street', 'city'])
  })

  it('adds and removes rules', () => {
    const form = Formo.form()
      .add('username')
      .addRulesFields({ username: [['required'], ['min', [3]]] })
    const username = form.field('username')!
    expect(username.isRequired()).toBe(true)
    username.removeRule('required')
    expect(username.isRequired()).toBe(false)
    expect(username.get('rules')).toEqual([['min', [3]]])

    const piped = Formo.form().add('email', { rules: 'required|email|max:255' }).field('email')!
    piped.removeRule('email')
    expect(piped.get('rules')).toEqual(['required|max:255'])
  })

  it('supports attr / addClass / set with dot syntax', () => {
    const f = Formo.factory({ alias: 'x' }).attr('placeholder', 'Hi').addClass('a b').addClass('b c').set('attr.id', 'my-id')
    expect(f.get('attr')).toEqual({ placeholder: 'Hi', class: 'a b c', id: 'my-id' })
    expect(f.get('attr.class')).toBe('a b c')
  })

  it('is reactive: computed()s over toSchema() update when the form changes', () => {
    const form = Formo.form().add('a')
    const count = computed(() => form.toSchema().fields!.length)
    expect(count.value).toBe(1)
    form.add('b')
    expect(count.value).toBe(2)
    form.field('b')!.set('label', 'B') // nested mutation bubbles up
    expect((form.toSchema().fields![1] as FieldDef).label).toBe('B')
  })

  it('pads blueprints', () => {
    const phones = Formo.group('phones').add('number').padBlueprint([{ number: '555' }])
    const node = normalize(Formo.form().add(phones), { drivers: defaultDrivers })
    expect(buildInitialValues(node, defaultDrivers, defaultConfig)).toEqual({ phones: [{ number: '555' }] })
  })
})

describe('normalize', () => {
  it('reads JSON definitions (Formo.fromJSON) — null attributes are left out', () => {
    const json = JSON.stringify({
      alias: 'user',
      val: { username: 'ben' },
      attr: { class: null, id: 'user' },
      fields: [
        { alias: 'username', driver: 'input', attr: { class: null }, rules: 'required' },
        { alias: 'email', driver: 'input|email', label: 'E-mail' },
        { alias: 'hobby', driver: 'select', val: 'swim', opts: { run: 'Running', swim: 'Swimming' } },
      ],
    })
    const node = normalize(Formo.fromJSON(json), { drivers: defaultDrivers })
    expect(node.fields.map((f) => [f.alias, f.driver, f.type, f.label])).toEqual([
      ['username', 'input', 'text', undefined],
      ['email', 'input', 'email', 'E-mail'],
      ['hobby', 'select', undefined, undefined],
    ])
    expect(node.fields[0].rules[0].name).toBe('required')
    expect(node.fields[0].attr).toEqual({ type: 'text' })
    expect(buildInitialValues(node, defaultDrivers, defaultConfig)).toEqual({ username: 'ben', email: '', hobby: 'swim' })
  })

  it('understands driver shorthands', () => {
    const node = normalize(
      { fields: [{ alias: 'a', driver: 'email' }, { alias: 'b', driver: 'bool' }, ['c', 'input|password'], 'd'] },
      { drivers: defaultDrivers },
    )
    expect(node.fields.map((f) => [f.driver, f.type])).toEqual([
      ['input', 'email'],
      ['checkbox', undefined],
      ['input', 'password'],
      ['input', 'text'],
    ])
  })

  it('distributes form-level callbacks to fields', () => {
    const cb = () => {}
    const node = normalize(
      { callbacks: { pass: { ':self': [cb], email: cb } }, fields: ['email'] },
      { drivers: defaultDrivers },
    )
    expect(node.callbacks.pass).toEqual([cb])
    expect(node.fields[0].callbacks.pass).toEqual([cb])
  })

  it('expands dot keys', () => {
    const node = normalize({ alias: 'foo', driver: 'group', 'attr.method': 'GET' }, { drivers: defaultDrivers })
    expect(node.attr.method).toBe('GET')
  })
})
