import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Formo, FormoField, FormoForm, normalize, defaultDrivers, useFormo } from 'formo-vue'
import type {
  FormoBlueprintHandle,
  FormoController,
  FormoFieldHandle,
  FormoGroupHandle,
  FormoHandle,
} from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const aliases = (fields: Array<{ alias?: unknown }> | undefined) => (fields ?? []).map((f) => f.alias)

describe('defining a form with a nested object', () => {
  it('keys are aliases; strings are drivers; falsy entries are skipped; subforms are entries with `fields`', () => {
    const isAdmin = false
    const root = normalize(
      {
        alias: 'user',
        fields: {
          email: { driver: 'email', required: true },
          bio: 'textarea',
          admin: isAdmin && { driver: 'checkbox' },
          nothing: null,
          address: { label: 'Address', fields: { street: { required: true }, zip: 'input' } },
          phones: { blueprint: true, min: 1, fields: { number: 'tel' } },
        },
      },
      { drivers: defaultDrivers },
    )
    expect(aliases(root.fields)).toEqual(['email', 'bio', 'address', 'phones'])
    expect(root.fields[0]).toMatchObject({ driver: 'input', type: 'email' })
    expect(root.fields[0].rules.map((r) => r.name)).toEqual(['required'])
    expect(root.fields[1].driver).toBe('textarea')
    expect(root.fields[2]).toMatchObject({ driver: 'group', label: 'Address' })
    expect(aliases(root.fields[2].fields)).toEqual(['street', 'zip'])
    expect(root.fields[3]).toMatchObject({ driver: 'group', blueprint: true })
    expect(root.fields[3].fields[0]).toMatchObject({ alias: 'number', type: 'tel' })
  })

  it('works with the builder (and .add() takes nested objects); toSchema() still outputs lists', () => {
    const form = Formo.form({
      alias: 'user',
      fields: { email: { driver: 'email' }, address: { fields: { street: {} } } },
    })
    form.add('billing', { label: 'Billing', fields: { street: {}, zip: { rules: 'digits:5' } } })
    form.find('address')!.add('city')

    const schema = form.toSchema()
    expect(aliases(schema.fields)).toEqual(['email', 'address', 'billing'])
    expect(aliases(schema.fields![1].fields)).toEqual(['street', 'city'])
    expect(schema.fields![2]).toMatchObject({ alias: 'billing', label: 'Billing' })
    expect(aliases(schema.fields![2].fields)).toEqual(['street', 'zip'])
    // Round-trips through JSON
    expect(Formo.fromJSON(JSON.parse(JSON.stringify(form))).toSchema()).toEqual(schema)
  })

  it('builders as entries keep their identity (live) and get the key as alias; added forms become groups', () => {
    const address = Formo.form().add('street')
    const form = Formo.form({ alias: 'user', fields: { address } })
    expect(form.field('address')).toBe(address)
    expect(address.driver()).toBe('group')

    const version = computed(() => form.toSchema())
    expect(aliases(version.value.fields![0].fields)).toEqual(['street'])
    address.add('zip')
    expect(aliases(version.value.fields![0].fields)).toEqual(['street', 'zip'])
  })

  it('`order` still applies; a differing `alias` and integer-like keys warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const root = normalize(
      { fields: { a: {}, b: {}, c: { order: 0 }, d: { alias: 'other' } } },
      { drivers: defaultDrivers },
    )
    expect(aliases(root.fields)).toEqual(['c', 'a', 'b', 'd'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fields.d has alias "other"'))

    normalize({ fields: { name: {}, 1: {} } }, { drivers: defaultDrivers })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('integer-like keys (1)'))
    warn.mockRestore()
  })

  it('renders and validates like any other definition', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(FormoForm, {
      props: {
        onSubmit,
        form: {
          alias: 'user',
          fields: {
            email: { driver: 'email', required: true },
            address: { fields: { zip: { rules: 'required|digits:5' } } },
          },
        },
      },
    })
    await settle()
    expect(wrapper.get('#user-address-zip').attributes('name')).toBe('user[address][zip]')
    await wrapper.get('#user-email').setValue('a@b.co')
    await wrapper.get('#user-address-zip').setValue('12345')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit.mock.calls[0][0]).toEqual({ email: 'a@b.co', address: { zip: '12345' } })
  })
})

describe('handles: form.fields', () => {
  function setup<T>(make: () => T) {
    let result!: T
    mount(defineComponent({ setup: () => ((result = make()), () => null) }))
    return result
  }

  it('mirrors the definition: fields, subforms (.fields), repeatable groups (.rows)', () => {
    const form = setup(() =>
      useFormo({
        alias: 'user',
        fields: {
          email: { driver: 'email', val: 'a@b.co' },
          address: { fields: { zip: {} } },
          contact: { config: { namespaces: false }, fields: { phone: {} } },
          phones: { blueprint: true, val: [{ number: '1' }, { number: '2' }], fields: { number: {} } },
        },
      }),
    )
    const { email, address, contact, phones } = form.fields
    expect(email).toMatchObject({ kind: 'field', path: 'email', alias: 'email', value: 'a@b.co' })
    expect(address).toMatchObject({ kind: 'group', path: 'address' })
    expect(address.fields.zip).toMatchObject({ kind: 'field', path: 'address.zip' })
    // A group that doesn't namespace: its fields live at the top level
    expect(contact.fields.phone.path).toBe('phone')
    expect(phones.kind).toBe('blueprint')
    expect(phones.rows.map((r) => r.fields.number?.path)).toEqual(['phones[0].number', 'phones[1].number'])
    expect(phones.rows[1].fields.number?.value).toBe('2')

    // Stable objects, so they can be passed as props
    expect(form.fields.email).toBe(email)
    expect(address.fields.zip).toBe(form.fields.address.fields.zip)
    expect(form.field('address.zip')).toBe(address.fields.zip)
    expect(form.field('zip')).toBe(address.fields.zip) // by alias, like find()
    expect(Object.keys(form.fields)).toEqual(['email', 'address', 'contact', 'phones'])
    expect('email' in form.fields).toBe(true)
    expect((form.fields as Record<string, FormoHandle | undefined>).nope).toBeUndefined()

    // Read / write values
    email.value = 'c@d.co'
    expect(form.values.email).toBe('c@d.co')
  })

  it('follows the builder: fields added or removed after creation show up', () => {
    const definition = Formo.form({ alias: 'f' }).add('name')
    const form = setup(() => useFormo(definition))
    expect(form.fields.company).toBeUndefined()
    definition.add('company', { order: ['after', 'name'] })
    expect(form.fields.company?.path).toBe('company')
    expect(Object.keys(form.fields)).toEqual(['name', 'company'])
    definition.remove('name')
    expect(form.fields.name).toBeUndefined()
  })

  it('are typed from object definitions', () => {
    const typed = () =>
      useFormo(
        Formo.form({
          alias: 'user',
          fields: {
            email: { driver: 'email' },
            bio: 'textarea',
            admin: Math.random() > 1 && { driver: 'checkbox' },
            address: { fields: { zip: {} } },
            phones: { blueprint: true, fields: { number: {} } },
            sub: Formo.group('sub').add('x'),
          },
        }),
      )
    type Fields = ReturnType<typeof typed>['fields']
    expectTypeOf<Fields['email']>().not.toBeAny()
    expectTypeOf<Fields['address']['fields']['zip']>().not.toBeAny()
    expectTypeOf<Fields['email']['kind']>().toEqualTypeOf<'field'>()
    expectTypeOf<Fields['address']['kind']>().toEqualTypeOf<'group'>()
    expectTypeOf<Fields['phones']['kind']>().toEqualTypeOf<'blueprint'>()
    expectTypeOf<Fields['sub']['kind']>().toEqualTypeOf<'group'>()
    expectTypeOf<NonNullable<Fields['admin']>['kind']>().toEqualTypeOf<'field'>()
    expectTypeOf<Fields['email']>().toMatchTypeOf<FormoFieldHandle>()
    expectTypeOf<Fields['bio']>().toMatchTypeOf<FormoFieldHandle>()
    expectTypeOf<Fields['admin']>().toMatchTypeOf<FormoFieldHandle | undefined>()
    expectTypeOf<Fields['address']>().toMatchTypeOf<FormoGroupHandle>()
    expectTypeOf<Fields['address']['fields']['zip']>().toMatchTypeOf<FormoFieldHandle>()
    expectTypeOf<Fields['phones']>().toMatchTypeOf<FormoBlueprintHandle>()
    expectTypeOf<Fields['phones']['rows'][number]['fields']['number']>().toMatchTypeOf<FormoFieldHandle>()
    expectTypeOf<Fields['sub']>().toMatchTypeOf<FormoGroupHandle>()
    // Strictly typed controllers are still controllers
    expectTypeOf<ReturnType<typeof typed>>().toMatchTypeOf<FormoController>()
    // Builder chains / lists: loose
    const loose = () => useFormo(Formo.form('x').add('a'))
    expectTypeOf<ReturnType<typeof loose>['fields']['anything']>().toEqualTypeOf<FormoHandle | undefined>()
  })

  it('<FormoForm> passes them to its default slot', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: { alias: 'f', fields: { a: {}, b: {} } } },
      slots: { default: ({ fields }: any) => [h(FormoField, { field: fields.b }), h(FormoField, { field: fields.a })] },
    })
    await settle()
    expect(wrapper.findAll('[data-formo-path]').map((e) => e.attributes('data-formo-path'))).toEqual(['b', 'a'])
  })
})
