import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Formo, FormoForm, FormoRender, FormoRest, useFormo } from 'formo-vue'
import type { FormoController } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const definition = () =>
  Formo.form({ alias: 'user' })
    .add('first_name', { required: true })
    .add('last_name', { required: true })
    .add('email', 'input|email', { required: true, message: 'We never share it' })
    .add(
      Formo.group('address', { theme: { classes: { control: 'address-control' } } })
        .add('street', { required: true })
        .add('zip', { rules: 'required|digits:5' })
        .add('city'),
    )
    .add(Formo.group('contact', { config: { namespaces: false } }).add('phone'))
    .add(Formo.group('phones', { blueprint: true, min: 1 }).add('type', 'select', 'home', { opts: { home: 'Home', work: 'Work' } }).add('number', { required: true }))

/** Mount a component owning the form, with `template` as its layout */
function host(template: (form: FormoController) => any, onSubmit = vi.fn()) {
  let form!: FormoController
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition())
        return () => template(form)
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, form: () => form, onSubmit }
}

describe('<FormoForm> with your own layout', () => {
  it('renders only what you place, where you place it, and validates it', async () => {
    const onSubmit = vi.fn()
    const { wrapper, form } = host((form) =>
      h(FormoForm, { form, onSubmit }, () => [
        h('div', { class: 'row' }, [h(FormoRender, { path: 'last_name' }), h(FormoRender, { path: 'first_name' })]),
        h('aside', [h(FormoRender, { path: 'address' })]),
        h(FormoRest),
      ]),
    )
    await settle()
    // Placed in the order given, inside your markup
    expect(wrapper.findAll('.row [data-formo-path]').map((e) => e.attributes('data-formo-path'))).toEqual(['last_name', 'first_name'])
    expect(wrapper.find('aside fieldset[data-formo-group="address"]').exists()).toBe(true)
    // FormoRest rendered everything else, once
    expect(wrapper.findAll('[data-formo-path="email"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-formo-path="first_name"]')).toHaveLength(1)
    expect(wrapper.find('[data-formo-group="phones"]').exists()).toBe(true)

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(Object.keys(form().flatErrors).sort()).toEqual(
      ['address.street', 'address.zip', 'email', 'first_name', 'last_name', 'phones[0].number'].sort(),
    )
    wrapper.unmount()
  })

  it('warns about fields nobody rendered (they would not be validated)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper } = host((form) => h(FormoForm, { form }, () => [h(FormoRender, { path: 'email' })]))
    await settle()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("custom layout doesn't render: first_name, last_name, address.street"))
    warn.mockRestore()
    wrapper.unmount()
  })

  it('an empty / v-if-false default slot falls back to the automatic layout', async () => {
    const { wrapper } = host((form) => h(FormoForm, { form }, () => []))
    await settle()
    expect(wrapper.findAll('[data-formo-path]').length).toBeGreaterThan(5)
    wrapper.unmount()
  })
})

describe('<FormoRender> parts', () => {
  it('input, label, help and error separately — wired together (for / aria-describedby)', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h('div', { class: 'my-label' }, [h(FormoRender, { path: 'email', part: 'label' })]),
        h('div', { class: 'my-input' }, [h(FormoRender, { path: 'email', part: 'input' })]),
        h('div', { class: 'my-help' }, [h(FormoRender, { path: 'email', part: 'help' })]),
        h('div', { class: 'my-error' }, [h(FormoRender, { path: 'email', part: 'errors' })]),
        h(FormoRest),
      ]),
    )
    await settle()
    const input = wrapper.get('.my-input input')
    expect(wrapper.find('.my-input label').exists()).toBe(false) // input only
    expect(wrapper.get('.my-label label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('.my-label label').text()).toBe('Email*')
    expect(wrapper.get('.my-help').text()).toBe('We never share it')

    await wrapper.get('form').trigger('submit')
    await settle()
    const error = wrapper.get('.my-error [role="alert"]')
    expect(error.text()).toBe('Email must not be empty')
    expect(input.attributes('aria-describedby')).toContain(error.attributes('id'))
    wrapper.unmount()
  })

  it('a subform with your own inner layout (#fields) — paths inside are relative to it', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoRender, { path: 'address' }, {
          fields: () => h('div', { class: 'inline' }, [h(FormoRender, { path: 'zip' }), h(FormoRender, { path: 'city' }), h(FormoRest)]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    const inline = wrapper.get('fieldset[data-formo-group="address"] .inline')
    expect(inline.findAll('[data-formo-path]').map((e) => e.attributes('data-formo-path'))).toEqual(['address.zip', 'address.city', 'address.street'])
    expect(wrapper.get('#user-address-zip').attributes('name')).toBe('user[address][zip]')
    // The subform's theme still cascades to fields placed in a custom layout
    expect(wrapper.get('#user-address-zip').classes()).toContain('address-control')
    wrapper.unmount()
  })

  it('finds fields by alias (Formo find()) and inside non-namespaced groups', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form }, () => [h('div', { class: 'a' }, [h(FormoRender, { path: 'street' })]), h('div', { class: 'b' }, [h(FormoRender, { path: 'phone' })]), h(FormoRest)]),
    )
    await settle()
    expect(wrapper.get('.a input').attributes('name')).toBe('user[address][street]')
    expect(wrapper.get('.a input').classes()).toContain('address-control')
    expect(wrapper.get('.b input').attributes('name')).toBe('user[phone]')
    wrapper.unmount()
  })

  it('blueprint rows with a custom row layout', async () => {
    const { wrapper, form } = host((form) =>
      h(FormoForm, { form }, () => [
        h(FormoRender, { path: 'phones' }, {
          row: ({ index }: { index: number }) =>
            h('div', { class: 'phone-row', 'data-index': index }, [h(FormoRender, { path: 'type', part: 'input' }), h(FormoRender, { path: 'number', part: 'input' })]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(wrapper.findAll('.phone-row')).toHaveLength(1)
    expect(wrapper.get('.phone-row input').attributes('name')).toBe('user[phones][0][number]')
    await wrapper.findAll('button').find((b) => b.text().includes('Add'))!.trigger('click')
    await settle()
    expect(wrapper.findAll('.phone-row')).toHaveLength(2)
    await wrapper.findAll('.phone-row input')[1].setValue('555')
    await settle()
    expect(form().values.phones).toEqual([{ type: 'home', number: '' }, { type: 'home', number: '555' }])
    wrapper.unmount()
  })
})

describe('parts outside <FormoForm>', () => {
  it('<FormoRender :form> anywhere + form.submit(handler) — no <form> element needed', async () => {
    const save = vi.fn()
    let form!: FormoController
    const Sidebar = defineComponent({
      props: ['form'],
      setup: (props) => () => h('aside', [h(FormoRender, { form: props.form, path: 'email' })]),
    })
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo(Formo.form({ alias: 'nl', rules: [(v: any) => v.email !== 'blocked@x.io' || 'Blocked address'] }).add('email', 'input|email', { required: true }).add('name'))
          return () =>
            h('div', [
              h('main', [h(FormoRender, { form, path: 'name' }), h(FormoRender, { form, path: '', part: 'errors' })]),
              h(Sidebar, { form }),
              h('button', { class: 'go', onClick: () => form.submit(save) }, 'Go'),
            ])
        },
      }),
    )
    await settle()
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.get('.go').trigger('click')
    await settle()
    expect(save).not.toHaveBeenCalled()
    expect(wrapper.get('aside [role="alert"]').text()).toBe('Email must not be empty')

    await wrapper.get('aside input').setValue('blocked@x.io')
    await wrapper.get('.go').trigger('click')
    await settle()
    // form-level rules still run without <FormoForm>
    expect(wrapper.get('main [role="alert"]').text()).toBe('Blocked address')

    await wrapper.get('aside input').setValue('ok@x.io')
    await wrapper.get('.go').trigger('click')
    await settle()
    expect(save).toHaveBeenCalledWith({ email: 'ok@x.io', name: '' }, expect.anything())
  })

  it('form.render(path, part) — like <?= $form->email->render() ?>', async () => {
    let form!: FormoController
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo(definition())
          return () => h('div', [h(form.render('email')), h('span', { class: 'zip' }, [h(form.render('address.zip', 'input'))]), h(form.render('address'))])
        },
      }),
    )
    await settle()
    expect(wrapper.get('[data-formo-path="email"] label').text()).toBe('Email*')
    expect(wrapper.get('.zip > input').attributes('name')).toBe('user[address][zip]')
    expect(form.render('email')).toBe(form.render('email')) // stable identity
    expect(wrapper.find('fieldset[data-formo-group="address"]').exists()).toBe(true)
  })
})
