import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import {
  createFormo,
  Formo,
  FormoErrors,
  FormoField,
  FormoForm,
  FormoHelp,
  FormoInput,
  FormoLabel,
  FormoRest,
  useFormo,
} from 'formo-vue'
import type { FormoController } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const definition = () =>
  Formo.form({
    alias: 'shop',
    fields: {
      price: { driver: 'number', required: true, message: 'Before taxes' },
      password: { driver: 'password', required: true },
      size: { driver: 'radios', opts: { s: 'Small', l: 'Large' }, required: true },
      address: { fields: { street: {}, zip: { rules: 'required|digits:5' } } },
      phones: { blueprint: true, min: 1, fields: { number: { required: true } } },
      notes: 'textarea',
    },
  })

/** Mount a component owning the form; `render` gets the controller */
function host(render: (form: FormoController<any>) => any, def: Formo<any> = definition()) {
  let form!: FormoController<any>
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(def)
        return () => render(form)
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, form: () => form }
}

describe('<FormoField :field>', () => {
  it('renders fields, subforms and repeatable groups from handles — inside <FormoForm> or anywhere', async () => {
    const save = vi.fn()
    const { wrapper, form } = host((form) =>
      h('div', [
        h(FormoForm, { form, onSubmit: save }, () => [
          h('div', { class: 'a' }, [h(FormoField, { field: form.fields.address })]),
          h('div', { class: 'b' }, [h(FormoField, { field: form.fields.phones })]),
          h(FormoRest),
        ]),
        // Outside the <form>: the handle knows its form
        h('aside', [h(FormoField, { field: form.fields.notes })]),
      ]),
    )
    await settle()
    expect(wrapper.find('.a fieldset[data-formo-group="address"]').exists()).toBe(true)
    expect(wrapper.get('.b input').attributes('name')).toBe('shop[phones][0][number]')
    expect(wrapper.get('aside textarea').attributes('name')).toBe('shop[notes]')
    // <FormoRest> knows what was placed: each field once
    expect(wrapper.findAll('[data-formo-path="notes"]')).toHaveLength(1)
    expect(wrapper.findAll('fieldset[data-formo-group="address"]')).toHaveLength(1)

    await wrapper.get('aside textarea').setValue('hi')
    await settle()
    expect(form().values.notes).toBe('hi')
    wrapper.unmount()
  })

  it('handles are exact: inside a subform layout, a top-level handle stays top-level', async () => {
    const { wrapper } = host(
      (form) =>
        h(FormoForm, { form }, () => [
          h(FormoField, { field: form.fields.address }, {
            default: ({ fields }: any) => [
              h('div', { class: 'inner' }, [h(FormoField, { field: fields.street }), h(FormoField, { field: form.fields.street })]),
              h(FormoRest),
            ],
          }),
          h(FormoRest),
        ]),
      Formo.form({ alias: 'f', fields: { street: {}, address: { fields: { street: {} } } } }),
    )
    await settle()
    expect(wrapper.findAll('.inner input').map((i) => i.attributes('name'))).toEqual(['f[address][street]', 'f[street]'])
    wrapper.unmount()
  })

  it('<FormoInput :field="handle"> renders just the control, wired — anywhere', async () => {
    const { wrapper } = host((form) => h('div', [h(FormoInput, { field: form.fields.price, class: 'w-24' })]))
    await settle()
    expect(wrapper.find('label').exists()).toBe(false)
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('number')
    expect(input.attributes('name')).toBe('shop[price]')
    expect(input.classes()).toContain('w-24')
    expect(input.classes()).not.toContain('w-full')
    wrapper.unmount()
  })

  it('blueprint #row slot gets row handles', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.phones }, {
          row: ({ row, index }: any) => h('div', { class: 'row', 'data-index': index }, [h(FormoInput, { field: row.fields.number })]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.get('.row input').attributes('name')).toBe('shop[phones][0][number]')
    wrapper.unmount()
  })
})

describe('the default slot replaces the whole field; parts render the theme\'s pieces anywhere', () => {
  it('v-slot="{ field }" with <FormoLabel>, <FormoInput>, <FormoErrors> in your own markup', async () => {
    const { wrapper, form } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.password }, {
          default: ({ field }: any) =>
            h('div', { class: 'grid grid-cols-2' }, [
              h('div', { class: 'my-special-label' }, [h(FormoLabel, { field })]),
              h(FormoInput, { field }),
              h('div', { class: 'my-error-box' }, [h('b', 'Oops'), h(FormoErrors, { field })]),
              h('i', field.path),
            ]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.find('[data-formo-path="password"]').exists()).toBe(false) // no view: your markup only
    const input = wrapper.get('.grid > input')
    expect(input.attributes('id')).toBe('shop-password')
    expect(input.attributes('type')).toBe('password')
    expect(wrapper.get('.my-special-label label').attributes('for')).toBe('shop-password')
    expect(wrapper.get('.my-special-label label').text()).toBe('Password*')
    expect(wrapper.get('.grid i').text()).toBe('password')

    // Validation, errors and aria wiring all come with the parts
    await wrapper.get('form').trigger('submit')
    await settle()
    const error = wrapper.get('.my-error-box [role="alert"]')
    expect(error.text()).toBe('Password must not be empty')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(error.attributes('id'))
    await input.setValue('secret')
    await settle()
    expect(form().values.password).toBe('secret')
    expect(wrapper.find('.my-error-box [role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('inside a field\'s slots, parts find the field on their own', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.price }, {
          default: () => h('section', [h(FormoLabel), h(FormoInput, { class: 'w-24' }), h(FormoHelp), h(FormoErrors)]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.get('section label').attributes('for')).toBe('shop-price')
    expect(wrapper.get('section input').classes()).toContain('w-24')
    expect(wrapper.get('section p').text()).toBe('Before taxes')
    wrapper.unmount()
  })

  it('parts render the theme\'s views — overridden app-wide or per form', async () => {
    const MyErrors = defineComponent({
      props: ['formo'],
      setup: (props) => () => (props.formo.error ? h('em', { class: 'my-errors' }, `!! ${props.formo.error}`) : null),
    })
    const MyLabel = defineComponent({ props: ['formo'], setup: (props) => () => h('span', { class: 'my-label' }, props.formo.label.toUpperCase()) })
    const { wrapper } = host((form) =>
      h(FormoForm, { form, views: { errors: MyErrors } }, () => [
        h(FormoField, { field: form.fields.password }, {
          default: ({ field }: any) => h('div', { class: 'custom' }, [h(FormoLabel, { field }), h(FormoInput, { field }), h(FormoErrors, { field })]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('.custom .my-errors').text()).toBe('!! Password must not be empty')
    wrapper.unmount()

    const app = mount(FormoForm, {
      props: { form: { fields: { name: {} } } },
      slots: { default: ({ fields }: any) => h(FormoField, { field: fields.name }, { default: () => h(FormoLabel) }) },
      global: { plugins: [createFormo({ views: { label: MyLabel } })] },
    })
    await settle()
    expect(app.get('.my-label').text()).toBe('NAME')
  })

  it('parts take handles too: errors / labels placed away from their field', async () => {
    const { wrapper } = host((form) =>
      h('div', [
        h('header', [h(FormoErrors, { field: form.fields.price }), h(FormoErrors, { field: form.fields.address })]),
        h(FormoForm, { form }, () => [h('div', { class: 'lbl' }, [h(FormoLabel, { field: form.fields.price })]), h(FormoRest)]),
      ]),
    )
    await settle()
    expect(wrapper.get('.lbl label').attributes('for')).toBe('shop-price')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('header [role="alert"]').text()).toBe('Price must not be empty')
    wrapper.findComponent(FormoForm).vm.form.setError('address', 'Bad address')
    await settle()
    expect(wrapper.findAll('header [role="alert"]').map((e) => e.text())).toEqual(['Price must not be empty', 'Bad address'])
    wrapper.unmount()
  })
})

describe('region slots: take over one region, keep the theme\'s view', () => {
  it('#input: your markup around <FormoInput />; the view (label, help, errors) stays', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.price }, {
          input: () => h('div', { class: 'group' }, [h('span', { class: 'addon' }, '$'), h(FormoInput, { class: 'rounded-l-none w-24' }), h('span', '.00')]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    const input = wrapper.get('.group > input')
    expect(input.attributes('id')).toBe('shop-price')
    expect(input.attributes('name')).toBe('shop[price]')
    expect(wrapper.get('label[for="shop-price"]').text()).toBe('Price*')
    expect(wrapper.get('[data-formo-path="price"] .group + p').text()).toBe('Before taxes') // help, after the group
    // Classes merge with the theme's (tailwind-merge): w-24 replaces w-full
    expect(input.classes()).toEqual(expect.arrayContaining(['rounded-l-none', 'w-24', 'border']))
    expect(input.classes()).not.toContain('w-full')

    await input.setValue('12')
    await settle()
    expect(wrapper.findComponent(FormoForm).vm.form.values.price).toBe(12)
    wrapper.unmount()
  })

  it('#label and #errors; the view passes props through (`as` for radios)', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoField, { field: form.fields.password }, {
          label: ({ props }: any) => h('div', { class: 'label-row' }, [h(FormoLabel, props), h('a', { href: '/forgot' }, 'Forgot?')]),
          errors: () => h('div', { class: 'err' }, [h('span', '⚠'), h(FormoErrors)]),
        }),
        h(FormoField, { field: form.fields.size }, {
          label: ({ props }: any) => [h(FormoLabel, props), h('small', { class: 'hint' }, 'Pick one')],
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.get('.label-row label').attributes('for')).toBe('shop-password')
    expect(wrapper.get('.label-row a').text()).toBe('Forgot?')
    // radios: the fieldset view asked for a legend
    expect(wrapper.get('[data-formo-path="size"] fieldset > legend').text()).toBe('Size*')
    expect(wrapper.get('[data-formo-path="size"] fieldset > .hint').text()).toBe('Pick one')

    await wrapper.get('form').trigger('submit')
    await settle()
    const error = wrapper.get('.err [role="alert"]')
    expect(error.text()).toBe('Password must not be empty')
    expect(wrapper.get('#shop-password').attributes('aria-describedby')).toContain(error.attributes('id'))
    wrapper.unmount()
  })

  it('the same slots work on <FormoForm> for the automatic layout: #input:path, #label:path, #field:path, rows with []', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: definition() },
      slots: {
        'input:price': () => h('div', { class: 'wrapped' }, [h('span', '$'), h(FormoInput)]),
        'label:address.zip': ({ props }: any) => h('div', { class: 'zip-label' }, [h(FormoLabel, props), ' (5 digits)']),
        'input:phones[].number': () => h('div', { class: 'phone' }, [h('span', '☎'), h(FormoInput)]),
        'field:notes': ({ field }: any) => h('div', { class: 'notes' }, [h(FormoInput, { field }), h('small', field.label)]),
      },
    })
    await settle()
    expect(wrapper.get('.wrapped input').attributes('name')).toBe('shop[price]')
    expect(wrapper.get('.zip-label').text()).toBe('Zip* (5 digits)')
    expect(wrapper.get('.phone input').attributes('name')).toBe('shop[phones][0][number]')
    expect(wrapper.get('.notes textarea').attributes('name')).toBe('shop[notes]')
    expect(wrapper.get('.notes small').text()).toBe('Notes')
  })

  it('replacing the control without <FormoInput> still mirrors the value for native submits', async () => {
    const wrapper = mount(FormoForm, {
      props: { native: true, form: { alias: 'n', fields: { color: { val: 'teal' }, plain: { val: 'x' } } } },
      slots: {
        'input:color': ({ field }: any) => h('button', { type: 'button', class: 'swatch' }, field.value),
        'input:plain': () => h('div', [h(FormoInput)]),
      },
    })
    await settle()
    expect(wrapper.get('.swatch').text()).toBe('teal')
    expect(wrapper.findAll('input[type="hidden"][name="n[color]"]').map((i) => i.attributes('value'))).toEqual(['teal'])
    // <FormoInput> rendered: the real input posts, no mirror
    expect(wrapper.findAll('input[name="n[plain]"]')).toHaveLength(1)
  })
})
