import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Formo, FormoForm, useFormo } from 'formo-vue'
import type { FormoController } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const address = (alias: string) =>
  Formo.group(alias).add('street', { required: true }).add('city', { required: true }).add('zip', { rules: 'required|digits:5' })

function mountForm(definition: Formo) {
  let form!: FormoController
  const onSubmit = vi.fn()
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition)
        return () => h(FormoForm, { form, onSubmit })
      },
    }),
  )
  return { wrapper, form: () => form, onSubmit }
}

describe('optional subforms: "Same as billing address"', () => {
  const definition = () =>
    Formo.form({ alias: 'order' })
      .add(address('billing'))
      // The rule lives on the checkbox: while checked, the shipping subform is fully optional
      .add('same_as_billing', 'checkbox', false, { label: 'Ship to my billing address', ignores: 'shipping' })
      .add(address('shipping'))

  const fill = async (wrapper: ReturnType<typeof mount>, group: string) => {
    await wrapper.get(`#order-${group}-street`).setValue('1 Main St')
    await wrapper.get(`#order-${group}-city`).setValue('Springfield')
    await wrapper.get(`#order-${group}-zip`).setValue('12345')
  }

  it('requires the shipping subform until the checkbox is checked', async () => {
    const { wrapper, form, onSubmit } = mountForm(definition())
    await settle()
    await fill(wrapper, 'billing')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(Object.keys(form().flatErrors).sort()).toEqual(['shipping.city', 'shipping.street', 'shipping.zip'])

    // Check "same as billing": shipping is now fully optional — errors clear, required markers go
    await wrapper.get('#order-same_as_billing').setValue(true)
    await settle()
    expect(form().isIgnored('shipping')).toBe(true)
    expect(form().isIgnored('shipping.zip')).toBe(true)
    expect(form().flatErrors).toEqual({})
    expect(wrapper.get('[data-formo-group="shipping"]').attributes('data-ignored')).toBe('true')
    expect(wrapper.find('[data-formo-path="shipping.street"] label span').exists()).toBe(false) // no "*"

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    // `ignores` keeps the (empty) values; use `excludes` to drop them
    expect(onSubmit.mock.calls[0][0].shipping).toEqual({ street: '', city: '', zip: '' })

    // Uncheck: shipping is required again, and since the user already submitted, errors come back
    await wrapper.get('#order-same_as_billing').setValue(false)
    await settle()
    expect(Object.keys(form().flatErrors).sort()).toEqual(['shipping.city', 'shipping.street', 'shipping.zip'])
  })

  it('even invalid values inside an ignored subform no longer block the submit', async () => {
    const { wrapper, onSubmit } = mountForm(definition())
    await settle()
    await fill(wrapper, 'billing')
    await wrapper.get('#order-shipping-zip').setValue('nope')
    await wrapper.get('#order-same_as_billing').setValue(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('`excludes` also drops the subform from the submitted values (Laravel exclude_if)', async () => {
    const def = Formo.form({ alias: 'order' })
      .add('same_as_billing', 'checkbox', true, { excludes: 'shipping' })
      .add(address('shipping'))
    const { wrapper, onSubmit } = mountForm(def)
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit.mock.calls[0][0]).toEqual({ same_as_billing: true })
  })

  it('the condition can live on the subform instead (JSON-friendly), and works through non-namespaced groups', async () => {
    const def = Formo.form({ alias: 'o' })
      .add('delivery', 'radios', 'pickup', { opts: { pickup: 'Pick up', ship: 'Ship it' } })
      .add(
        Formo.group('where', { config: { namespaces: false }, ignore: { when: 'delivery', is: 'pickup' } })
          .add('street', { required: true }),
      )
    const { wrapper, form, onSubmit } = mountForm(def)
    await settle()
    expect(form().isIgnored('street')).toBe(true) // `where` doesn't namespace, still cascades
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)

    await wrapper.findAll('input[type="radio"]')[1].setValue(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(form().flatErrors).toEqual({ street: 'Street must not be empty' })
  })

  it('skips group rules and callbacks inside ignored groups', async () => {
    const fail = vi.fn()
    const def = Formo.form()
      .add('skip', 'checkbox', true, { ignores: 'g' })
      .add(Formo.group('g', { rules: [() => 'group rule ran'], callbacks: { fail: [fail], pass: [fail] } }).add('a'))
    const { form } = mountForm(def)
    await settle()
    expect(await form().validate()).toBe(true)
    expect(fail).not.toHaveBeenCalled()
  })
})

describe('Laravel conditional rules', () => {
  it('required_if / required_unless / required_with / required_without (with and without @)', async () => {
    const def = Formo.form({ alias: 'f' })
      .add('type', 'radios', 'personal', { opts: { personal: 'Personal', business: 'Business' } })
      .add('company', { rules: 'required_if:type,business' })
      .add('vat', { rules: 'required_with:@company' })
      .add('phone', { rules: 'required_without:email' })
      .add('email')
      .add('nickname', { rules: 'required_unless:type,business' })
    const { wrapper, form } = mountForm(def)
    await settle()
    const required = () => wrapper.findAll('label span[aria-hidden="true"]').map((s) => s.element.parentElement!.getAttribute('for'))

    expect(required()).toEqual(['f-phone', 'f-nickname']) // marker follows the live condition
    expect(await form().validate()).toBe(false)
    expect(Object.keys(form().flatErrors)).toEqual(['phone', 'nickname'])

    await wrapper.findAll('input[type="radio"]')[1].setValue(true) // business
    await wrapper.get('#f-email').setValue('a@b.co')
    await settle()
    expect(required()).toEqual(['f-company'])
    await wrapper.get('#f-company').setValue('ACME')
    await settle()
    expect(required()).toEqual(['f-company', 'f-vat'])
    expect(await form().validate()).toBe(false)
    expect(Object.keys(form().flatErrors)).toEqual(['vat'])
  })

  it('exclude_if removes the field from validation and from the values', async () => {
    const def = Formo.form()
      .add('same', 'checkbox', true)
      .add('other', { rules: 'exclude_if:same,true|required' })
    const { form } = mountForm(def)
    await settle()
    expect(await form().validate()).toBe(true)
    expect(form().getValues()).toEqual({ same: true })
  })
})
