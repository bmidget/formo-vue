import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import {
  defaultTheme,
  defineTheme,
  FormoErrors,
  FormoField,
  FormoForm,
  FormoHelp,
  FormoInput,
  FormoLabel,
  FormoRest,
  useFormo,
} from 'formo-vue'
import type { FormoController, FormoFieldHandle, FormoFieldSlots } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const definition = () => ({
  alias: 'o',
  fields: {
    email: { driver: 'email' },
    address: {
      label: 'Address',
      message: 'Where we ship',
      rules: [(v: any) => v.zip !== '00000' || 'No such address'],
      fields: { street: { required: true }, zip: {} },
    },
    phones: {
      blueprint: true,
      min: 1,
      max: 3,
      val: [{ number: '111' }, { number: '222' }],
      fields: { type: { val: 'home' }, number: { required: true } },
    },
  },
})

function host(render: (form: any) => any) {
  let form!: FormoController<any>
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition())
        return () => render(form)
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, form: () => form }
}

const names = (wrapper: any, selector: string) => wrapper.findAll(selector).map((e: any) => e.attributes('name'))

describe('subforms: same slot pattern as fields', () => {
  it('the default slot replaces the whole subform: { group, fields } + the parts', async () => {
    const { wrapper, form } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.address }, {
          default: ({ group, fields }: any) =>
            h('section', { class: 'card' }, [
              h('h2', [h(FormoLabel)]), // inside its slot: finds the subform on its own
              h(FormoHelp, { field: group }),
              h(FormoField, { field: fields.street }),
              h('div', { class: 'zip' }, [h(FormoInput, { field: fields.zip })]),
              h('footer', [h(FormoErrors)]),
            ]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.find('fieldset[data-formo-group="address"]').exists()).toBe(false) // no view
    expect(wrapper.get('.card h2').text()).toBe('Address')
    expect(wrapper.get('.card > p').text()).toBe('Where we ship')
    expect(names(wrapper, '.card input')).toEqual(['o[address][street]', 'o[address][zip]'])
    expect(wrapper.findAll('input[name="o[address][zip]"]')).toHaveLength(1) // FormoRest didn't duplicate

    // Group rules still run (the subform is registered), and its error is a part too
    form().load({ address: { street: 'Main St', zip: '00000' } })
    await form().validate()
    await settle()
    expect(wrapper.get('.card footer [role="alert"]').text()).toBe('No such address')
    wrapper.unmount()
  })

  it('#fields lays its fields out inside the theme\'s view (legend, help, error kept)', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.address }, {
          fields: ({ fields }: any) => h('div', { class: 'row' }, [h(FormoField, { field: fields.zip }), h(FormoField, { field: fields.street })]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    const fieldset = wrapper.get('fieldset[data-formo-group="address"]')
    expect(fieldset.get('legend').text()).toBe('Address')
    expect(names(fieldset, '.row input')).toEqual(['o[address][zip]', 'o[address][street]'])
    wrapper.unmount()
  })

  it('parts take subform handles anywhere', async () => {
    const { wrapper, form } = host((form) =>
      h('div', [h('aside', [h(FormoLabel, { field: form.fields.address }), h(FormoErrors, { field: form.fields.address })]), h(FormoForm, { form })]),
    )
    await settle()
    expect(wrapper.get('aside span').text()).toBe('Address')
    form().setError('address', 'Server says no')
    await settle()
    expect(wrapper.get('aside [role="alert"]').text()).toBe('Server says no')
    wrapper.unmount()
  })
})

describe('repeatable groups', () => {
  it('handles: rows (with stable keys), add(), remove(), canAdd / canRemove — with min / max', async () => {
    const { form } = host((form) => h(FormoForm, { form }))
    await settle()
    const phones = form().fields.phones
    const [first, second] = phones.rows
    expect(second.fields.number.value).toBe('222')
    const secondKey = second.key

    phones.add({ number: '333' })
    await settle()
    expect(form().values.phones).toEqual([{ type: 'home', number: '111' }, { type: 'home', number: '222' }, { type: 'home', number: '333' }])
    expect(phones.canAdd).toBe(false) // max: 3
    phones.add()
    await settle()
    expect(phones.rows).toHaveLength(3)

    first.remove()
    await settle()
    expect(phones.rows.map((r: any) => r.fields.number.value)).toEqual(['222', '333'])
    expect(phones.rows[0].key).toBe(secondKey) // keys follow the rows, not the indexes
    phones.remove(0)
    await settle()
    expect(phones.canRemove).toBe(false) // min: 1
    phones.remove(0)
    await settle()
    expect(phones.rows).toHaveLength(1)
  })

  it('the default slot replaces the whole thing: your rows, your buttons — and FormoRest knows', async () => {
    const onSubmit = vi.fn()
    const { wrapper, form } = host((form) =>
      h(FormoForm, { form, onSubmit }, () => [
        h(FormoField, { field: form.fields.phones }, {
          default: ({ rows, add, canAdd, canRemove }: any) =>
            h('ul', { class: 'phones' }, [
              ...rows.map((row: any) =>
                h('li', { key: row.key, class: 'phone' }, [
                  h(FormoInput, { field: row.fields.number }),
                  h(FormoErrors, { field: row.fields.number }),
                  canRemove && h('button', { type: 'button', class: 'rm', onClick: row.remove }, '×'),
                ]),
              ),
              canAdd && h('button', { type: 'button', class: 'add', onClick: () => add() }, '+'),
            ]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(names(wrapper, '.phone input')).toEqual(['o[phones][0][number]', 'o[phones][1][number]'])
    expect(wrapper.find('[data-formo-group="phones"]').exists()).toBe(false) // no view
    // `type` isn't placed: it keeps its value, but it isn't rendered twice either
    expect(wrapper.findAll('input[name^="o[phones]"]')).toHaveLength(2)

    await wrapper.get('.add').trigger('click')
    await settle()
    expect(wrapper.findAll('.phone')).toHaveLength(3)
    expect(wrapper.find('.add').exists()).toBe(false) // max: 3

    // Removing the first row keeps the other rows' elements (keyed by row.key)
    const secondInput = wrapper.findAll('.phone input')[1].element
    await wrapper.findAll('.rm')[0].trigger('click')
    await settle()
    expect(wrapper.findAll('.phone input')[0].element).toBe(secondInput)
    expect(names(wrapper, '.phone input')).toEqual(['o[phones][0][number]', 'o[phones][1][number]'])

    // Row fields validate like any other
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(wrapper.findAll('.phone')[1].get('[role="alert"]').text()).toBe('Number must not be empty')
    wrapper.unmount()
  })

  it('rows rendered straight from the handle (no <FormoField> for the group): no duplicates, no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, form } = host((form) =>
      h(FormoForm, { form }, () => [
        ...form.fields.phones.rows.map((row: any) => h('div', { key: row.key, class: 'r' }, [h(FormoInput, { field: row.fields.type }), h(FormoInput, { field: row.fields.number })])),
        h('button', { type: 'button', class: 'add', onClick: () => form.fields.phones.add() }, '+'),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.findAll('input[name$="[number]"]')).toHaveLength(2)
    expect(wrapper.find('[data-formo-group="phones"]').exists()).toBe(false)
    await wrapper.get('.add').trigger('click')
    await settle()
    expect(wrapper.findAll('.r')).toHaveLength(3)
    expect(form().values.phones[2]).toEqual({ type: 'home', number: '' })
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("doesn't render"))
    warn.mockRestore()
    wrapper.unmount()
  })

  it('slots are typed from the handle', () => {
    const typed = () => useFormo({ fields: { phones: { blueprint: true, fields: { number: {} } }, address: { fields: { zip: {} } } } })
    type Fields = ReturnType<typeof typed>['fields']
    type RowsSlot = NonNullable<FormoFieldSlots<Fields['phones']>['default']>
    type GroupSlot = NonNullable<FormoFieldSlots<Fields['address']>['fields']>
    expectTypeOf<Parameters<RowsSlot>[0]['rows'][number]['fields']['number']>().toEqualTypeOf<FormoFieldHandle>()
    expectTypeOf<Parameters<GroupSlot>[0]['fields']['zip']>().toEqualTypeOf<FormoFieldHandle>()
    expectTypeOf<Fields['phones']['rows'][number]['key']>().toEqualTypeOf<string | number>()
  })
})

describe('<FormoForm> path slots reach subforms and repeatable groups', () => {
  it('#field:address, #fields:address, #row:phones', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: { ...definition(), fields: { ...definition().fields, billing: { fields: { city: {} } } } } },
      slots: {
        'field:address': ({ fields }: any) => h('div', { class: 'whole' }, [h(FormoInput, { field: fields.street })]),
        'fields:billing': ({ fields }: any) => h('div', { class: 'inner' }, [h(FormoField, { field: fields.city })]),
        'row:phones': ({ row }: any) => h('div', { class: 'row' }, [h(FormoInput, { field: row.fields.number })]),
      },
    })
    await settle()
    expect(wrapper.find('fieldset[data-formo-group="address"]').exists()).toBe(false)
    expect(names(wrapper, '.whole input')).toEqual(['o[address][street]'])
    expect(wrapper.find('fieldset[data-formo-group="billing"] .inner input').exists()).toBe(true)
    expect(wrapper.findAll('[data-formo-group="phones"] .row')).toHaveLength(2)
  })
})

describe('FormoRest knows what you placed', () => {
  it('whether <FormoRest> comes before or after, and whatever placed it (<FormoField>, <FormoInput>)', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [h(FormoRest), h('div', { class: 'mine' }, [h(FormoInput, { field: form.fields.email }), h(FormoField, { field: form.fields.address.fields.zip })])]),
    )
    await settle()
    expect(wrapper.findAll('input[name="o[email]"]')).toHaveLength(1)
    expect(wrapper.findAll('input[name="o[address][zip]"]')).toHaveLength(1)
    expect(wrapper.find('.mine input[name="o[email]"]').exists()).toBe(true)
    // The rest of a partly placed subform is rendered field by field
    expect(wrapper.findAll('input[name="o[address][street]"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('<FormoLabel> / <FormoErrors> alone don\'t count as placing the field (it still needs its control)', async () => {
    const { wrapper } = host((form) => h(FormoForm, { form }, () => [h('div', { class: 'top' }, [h(FormoLabel, { field: form.fields.email })]), h(FormoRest)]))
    await settle()
    expect(wrapper.findAll('input[name="o[email]"]')).toHaveLength(1)
    expect(wrapper.get('.top label').attributes('for')).toBe('o-email')
    wrapper.unmount()
  })
})

describe('themes', () => {
  const Card = defineComponent({ props: ['formo'], setup: (_p, { slots }) => () => h('div', { class: 'bs-field' }, [slots.label?.(), slots.input?.()]) })
  const BsErrors = defineComponent({ props: ['formo'], setup: (p) => () => (p.formo.error ? h('div', { class: 'invalid-feedback' }, p.formo.error) : null) })
  const bootstrap = defineTheme({ name: 'bs', views: { field: Card, errors: BsErrors }, classes: { control: 'form-control' } })

  it('a whole theme (views + classes + controls) on one subform — its fields and their parts follow it', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: { alias: 't', fields: { a: {}, legacy: { theme: bootstrap, fields: { b: { required: true } } } } },
      },
      slots: {
        'field:legacy.b': () => h('div', { class: 'mine' }, [h(FormoInput), h(FormoErrors)]),
      },
    })
    await settle()
    expect(wrapper.get('#t-a').classes()).toContain('w-full') // Tailwind outside
    expect(wrapper.get('.mine input').classes()).toEqual(['form-control']) // bootstrap inside
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('.mine .invalid-feedback').text()).toBe('B must not be empty')
  })

  it('a theme on a single field', async () => {
    const wrapper = mount(FormoForm, { props: { form: { fields: { a: { theme: bootstrap }, b: {} } } } })
    await settle()
    expect(wrapper.get('[data-formo-path="a"]').classes()).toEqual(['bs-field'])
    expect(wrapper.get('#formo-a').classes()).toEqual(['form-control'])
    expect(wrapper.get('[data-formo-path="b"]').classes()).not.toContain('bs-field')
  })

  it('`view: { errors: … }` (a map where one view goes) warns and points to theme / views', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(FormoForm, { props: { form: { fields: { a: { view: { errors: BsErrors } as any } } } } })
    await settle()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`view` takes one view'))
    warn.mockRestore()
  })

  it('overrides still layer over a swapped theme', async () => {
    const extended = defineTheme({ extends: defaultTheme, views: { errors: BsErrors } })
    const wrapper = mount(FormoForm, {
      props: { form: { fields: { a: { required: true } } }, theme: extended, classes: { control: 'rounded-none' } },
    })
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('.invalid-feedback').text()).toBe('A must not be empty')
    expect(wrapper.get('#formo-a').classes()).toContain('rounded-none')
  })
})
