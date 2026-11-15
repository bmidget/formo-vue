import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createFormo, defineControl, FormoForm, useFormo } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

/** A UI-library-style input: `type` / `color` props, emits strings, renders its own named <input> */
const LibInput = defineComponent({
  inheritAttrs: false,
  props: { modelValue: [String, Number], type: String, color: String, size: String, name: String },
  emits: ['update:modelValue', 'blur'],
  setup: (props, { attrs, emit }) => () =>
    h('div', { class: ['lib', props.color && `lib-${props.color}`, props.size && `lib-${props.size}`] }, [
      h('input', {
        ...attrs,
        type: props.type,
        name: props.name,
        value: props.modelValue ?? '',
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      }),
    ]),
})

/** A group of checkboxes taking `items` and an array */
const LibGroup = defineComponent({
  props: { modelValue: Array, items: Array },
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () =>
    h('div', { class: 'group' }, (props.items as Array<{ label: string; value: string }>).map((item) =>
      h('button', {
        type: 'button',
        'data-value': item.value,
        'aria-pressed': (props.modelValue ?? []).includes(item.value),
        onClick: () => {
          const current = (props.modelValue ?? []) as string[]
          emit('update:modelValue', current.includes(item.value) ? current.filter((v) => v !== item.value) : [...current, item.value])
        },
      }, item.label),
    )),
})

describe('defineControl', () => {
  it('props from the field\'s state, `type` of the input driver, numbers from the driver', async () => {
    let form: any
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo({
            alias: 'c',
            fields: {
              email: { driver: 'email', required: true, props: { size: 'lg' } },
              age: { driver: 'number' },
            },
          })
          return () =>
            h(FormoForm, {
              form,
              components: {
                input: defineControl({ component: LibInput, props: (field) => ({ color: field.invalid ? 'error' : 'neutral', size: 'sm' }) }),
              },
            })
        },
      }),
    )
    await settle()
    const email = wrapper.get('[data-formo-path="email"] input')
    expect(email.attributes('type')).toBe('email') // the driver's type reaches the library's prop
    expect(email.attributes('id')).toBe('c-email')
    expect(wrapper.get('[data-formo-path="email"] .lib').classes()).toEqual(['lib', 'lib-neutral', 'lib-lg']) // the field's own props win

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[data-formo-path="email"] .lib').classes()).toContain('lib-error') // follows the state

    // The library emits "42": the `input` driver makes it a number
    await wrapper.get('[data-formo-path="age"] input').setValue('42')
    await settle()
    expect(form.values.age).toBe(42)
    await wrapper.get('[data-formo-path="age"] input').setValue('')
    await settle()
    expect(form.values.age).toBeNull()
  })

  it('model get / set: adapt the value to the control (a SET string ↔ an array)', async () => {
    let form: any
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo({ fields: { flags: { driver: 'set', opts: { a: 'A', b: 'B' }, val: 'b' } } })
          return () =>
            h(FormoForm, {
              form,
              components: {
                set: defineControl({
                  component: LibGroup,
                  props: (field) => ({ items: field.options }),
                  model: {
                    get: (value) => String(value ?? '').split(',').filter(Boolean),
                    set: (value) => (value as string[]).join(','),
                  },
                }),
              },
            })
        },
      }),
    )
    await settle()
    expect(wrapper.get('[data-value="b"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-value="a"]').trigger('click')
    await settle()
    expect(form.values.flags).toBe('b,a')
  })

  it('native: the control posts its own value — no hidden mirror', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        native: true,
        form: { alias: 'n', fields: { a: { val: 'x' }, b: { val: 'y', component: 'plain' } } },
        components: {
          input: defineControl({ component: LibInput, props: (field) => ({ name: field.name }), native: true }),
          plain: defineControl({ component: LibInput }),
        },
      },
    })
    await settle()
    expect(wrapper.findAll('input[name="n[a]"]')).toHaveLength(1)
    // Not native: Formo mirrors the value in a hidden input (the control has no name)
    expect(wrapper.findAll('input[type="hidden"][name="n[b]"]')).toHaveLength(1)
  })

  it('names resolve through the overrides and the theme: `components: { checkbox: \'switch\' }`', async () => {
    const Switch = defineComponent({
      props: { modelValue: Boolean, label: String },
      emits: ['update:modelValue'],
      setup: (props, { emit }) => () => h('button', { type: 'button', role: 'switch', 'aria-checked': props.modelValue, onClick: () => emit('update:modelValue', !props.modelValue) }, props.label),
    })
    let form: any
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo({ fields: { news: { driver: 'bool', label: 'News' }, terms: { driver: 'checkbox' } } })
          return () => h(FormoForm, { form, components: { checkbox: 'switch' } })
        },
      }),
      {
        global: {
          plugins: [createFormo({ components: { switch: defineControl({ component: Switch, props: (field) => ({ label: field.label }) }) } })],
        },
      },
    )
    await settle()
    expect(wrapper.findAll('[role="switch"]').map((s) => s.text())).toEqual(['News', 'Terms'])
    await wrapper.get('[role="switch"]').trigger('click')
    await settle()
    expect(form.values.news).toBe(true)
  })
})
