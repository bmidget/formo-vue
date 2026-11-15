import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Formo, FormoForm, defineControl, useFormo } from 'formo-vue'
import type { FieldDef, FormoController, FormoDefinition, UseFormoOptions } from 'formo-vue'
import type { FormoModel } from 'formo-vue/schema'
import { nuxtUiTheme } from 'formo-vue/nuxt-ui'
import * as ui from '../playground/stubs/nuxt-ui'
import { shadcnTheme } from '@/components/ui/formo'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

function mountForm(definition: FormoDefinition | (() => FormoDefinition), options: UseFormoOptions = {}, formProps: Record<string, unknown> = {}) {
  let form!: FormoController
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition as FormoDefinition, options)
        return () => h(FormoForm, { form, ...formProps })
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, form: () => form }
}

const input = (wrapper: ReturnType<typeof mount>, selector: string) => wrapper.get(selector).element as HTMLInputElement

describe('values from outside keep the form live', () => {
  it('initialValues as a ref: untouched fields follow, the user\'s edits win, the baseline moves', async () => {
    const record = ref({ name: 'Ann', email: 'ann@example.com', role: 'editor' })
    const { wrapper, form } = mountForm(
      Formo.form({ alias: 'u' }).add('name').add('email', 'input|email').add('role', 'select', { opts: { admin: 'Admin', editor: 'Editor' } }),
      { initialValues: record },
    )
    await settle()
    expect(input(wrapper, '#u-name').value).toBe('Ann')
    await wrapper.get('#u-name').setValue('Annie') // edited in the form

    record.value = { name: 'Ann Smith', email: 'ann@new.example.com', role: 'admin' } // e.g. a reload of the record
    await settle()
    expect(input(wrapper, '#u-name').value).toBe('Annie') // the user's value wins
    expect(input(wrapper, '#u-email').value).toBe('ann@new.example.com')
    expect((wrapper.get('#u-role').element as HTMLSelectElement).value).toBe('admin')

    // the new record is the baseline: typing its value back makes the form clean; reset() goes to it
    await wrapper.get('#u-name').setValue('Ann Smith')
    await settle()
    expect(form().dirty).toBe(false)
    form().reset()
    await settle()
    expect(form().values).toEqual({ name: 'Ann Smith', email: 'ann@new.example.com', role: 'admin' })
  })

  it('a getter works too, and mutating the source object in place is seen', async () => {
    const user = reactive({ name: 'Ada', city: 'London' })
    const { wrapper } = mountForm(Formo.form({ alias: 'g' }).add('name').add('city'), { initialValues: () => ({ ...user }) })
    await settle()
    user.city = 'Paris'
    await settle()
    expect(input(wrapper, '#g-city').value).toBe('Paris')
  })

  it('a field showing an error is validated again when its value comes from outside', async () => {
    const record = ref({ email: '' })
    const { wrapper, form } = mountForm(Formo.form({ alias: 'e' }).add('email', 'input|email', { required: true }), { initialValues: record })
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(form().flatErrors.email).toBe('Email must not be empty')
    record.value = { email: 'ada@example.com' }
    await settle()
    expect(form().flatErrors.email).toBeUndefined()
  })

  it('repeatable rows follow too (rows added / removed outside)', async () => {
    const record = ref({ phones: [{ number: '555 0100' }] })
    const { wrapper } = mountForm(Formo.form({ alias: 'r' }).add(Formo.group('phones', { blueprint: true }).add('number')), { initialValues: record })
    await settle()
    expect(wrapper.findAll('input[name="r[phones][0][number]"]')).toHaveLength(1)
    record.value = { phones: [{ number: '555 0100' }, { number: '555 0199' }] }
    await settle()
    expect(input(wrapper, 'input[name="r[phones][1][number]"]').value).toBe('555 0199')
  })

  it('a form from a model with `values`: the record changes → the form follows, read-only values included', async () => {
    const model: FormoModel = {
      version: 1,
      name: 'm',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'status', type: 'enum', readOnly: true, options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }] },
      ],
    }
    const user = reactive({ name: 'Ada', status: 'active' })
    const { wrapper } = mountForm(() => Formo.fromModel(model, { mode: 'update', values: user }))
    await settle()
    expect(wrapper.get('#m-status').text()).toBe('Active')
    user.status = 'suspended'
    user.name = 'Ada Lovelace'
    await settle()
    expect(wrapper.get('#m-status').text()).toBe('Suspended') // read-only is not frozen: it shows the current value
    expect(input(wrapper, '#m-name').value).toBe('Ada Lovelace')
  })

  it('read-only is not set in stone: editable can change while the form is shown (definition or builder)', async () => {
    const locked = ref(false)
    const { wrapper } = mountForm(() => Formo.form({ alias: 'l' }).add('name', { val: 'Ann', editable: !locked.value }))
    await settle()
    expect(wrapper.get('#l-name').element.tagName).toBe('INPUT')
    await wrapper.get('#l-name').setValue('Annie')
    locked.value = true
    await settle()
    expect(wrapper.get('#l-name').element.tagName).toBe('P')
    expect(wrapper.get('#l-name').text()).toBe('Annie') // the value survives
    locked.value = false
    await settle()
    expect(input(wrapper, '#l-name').value).toBe('Annie')

    const builder = Formo.form({ alias: 'b' }).add('name', { val: 'Bo' })
    const live = mountForm(builder)
    await settle()
    builder.find('name')!.set('editable', false)
    await settle()
    expect(live.wrapper.get('#b-name').element.tagName).toBe('P')
  })
})

describe('values set from code reach every control (form.val / form.load / v-model)', () => {
  it('built-in controls, and a defineControl() with model get / set', async () => {
    const Chips = defineComponent({
      props: { modelValue: Array },
      setup: (props) => () => h('div', { class: 'chips' }, ((props.modelValue as string[]) ?? []).join('|')),
    })
    const { wrapper, form } = mountForm({
      alias: 'c',
      fields: {
        name: {},
        agree: { driver: 'checkbox' },
        size: { driver: 'radios', opts: { s: 'S', l: 'L' } },
        tags: { driver: 'checkboxes', opts: { a: 'A', b: 'B' } },
        flags: {
          driver: 'set',
          opts: { x: 'X', y: 'Y' },
          component: defineControl({ component: Chips, model: { get: (v) => String(v ?? '').split(',').filter(Boolean) } }),
        },
      },
    } satisfies FieldDef)
    await settle()
    form().load({ name: 'Bob', agree: true, size: 'l', tags: ['b'], flags: 'x,y' })
    await settle()
    expect(input(wrapper, '#c-name').value).toBe('Bob')
    expect(input(wrapper, '#c-agree').checked).toBe(true)
    expect(wrapper.findAll('input[type="radio"]').map((r) => (r.element as HTMLInputElement).checked)).toEqual([false, true])
    expect(wrapper.findAll('[data-formo-path="tags"] input[type="checkbox"]').map((r) => (r.element as HTMLInputElement).checked)).toEqual([false, true])
    expect(wrapper.get('.chips').text()).toBe('x|y')

    form().val('name', 'Cy')
    await settle()
    expect(input(wrapper, '#c-name').value).toBe('Cy')
  })

  it('Nuxt UI controls', async () => {
    const { wrapper, form } = mountForm(
      {
        alias: 'n',
        fields: {
          email: { driver: 'email' },
          age: { driver: 'number' },
          role: { driver: 'select', opts: { admin: 'Admin', editor: 'Editor' } },
          size: { driver: 'radios', opts: { s: 'Small', l: 'Large' } },
          tags: { driver: 'checkboxes', opts: { a: 'A', b: 'B' } },
          flags: { driver: 'set', opts: { x: 'X', y: 'Y' } },
          agree: { driver: 'bool', label: 'I agree' },
        },
      },
      {},
      { theme: nuxtUiTheme(ui) },
    )
    await settle()
    form().load({ email: 'a@b.co', age: 7, role: 'editor', size: 'l', tags: ['b'], flags: 'x', agree: true })
    await settle()
    const field = (path: string) => wrapper.get(`[data-formo-path="${path}"]`)
    const checked = (path: string, role: string) => field(path).findAll(`[role="${role}"]`).map((b) => b.attributes('aria-checked'))
    expect((field('email').get('input').element as HTMLInputElement).value).toBe('a@b.co')
    expect((field('age').get('input').element as HTMLInputElement).value).toBe('7')
    expect(field('role').get('[data-slot="value"]').text()).toBe('Editor')
    expect(checked('size', 'radio')).toEqual(['false', 'true'])
    expect(checked('tags', 'checkbox')).toEqual(['false', 'true'])
    expect(checked('flags', 'checkbox')).toEqual(['true', 'false'])
    expect(field('agree').get('[role="checkbox"]').attributes('aria-checked')).toBe('true')
  })

  it('shadcn-vue controls', async () => {
    const { wrapper, form } = mountForm(
      {
        alias: 's',
        fields: {
          age: { driver: 'number' },
          role: { driver: 'select', opts: { admin: 'Admin', editor: 'Editor' } },
          size: { driver: 'radios', opts: [[1, 'Small'], [2, 'Large']] },
          tags: { driver: 'checkboxes', opts: { a: 'A', b: 'B' } },
          agree: { driver: 'bool', label: 'I agree' },
        },
      },
      {},
      { theme: shadcnTheme },
    )
    await settle()
    form().load({ age: 42, role: 'admin', size: 2, tags: ['a'], agree: true })
    await settle()
    const field = (path: string) => wrapper.get(`[data-formo-path="${path}"]`)
    expect((field('age').get('input').element as HTMLInputElement).value).toBe('42')
    expect(field('role').get('[data-slot="select-value"]').text()).toBe('Admin')
    expect(field('size').findAll('[data-slot="radio-group-item"]').map((b) => b.attributes('aria-checked'))).toEqual(['false', 'true'])
    expect(field('tags').findAll('[data-slot="checkbox"]').map((b) => b.attributes('aria-checked'))).toEqual(['true', 'false'])
    expect(field('agree').get('[data-slot="checkbox"]').attributes('aria-checked')).toBe('true')
  })

  it('v-model: a partial change from the parent reaches the control, the rest stays', async () => {
    const model = ref<Record<string, any>>({ name: 'Ann', city: 'Oslo' })
    const wrapper = mount(FormoForm, {
      props: {
        form: { alias: 'v', fields: { name: {}, city: {} } },
        modelValue: model.value,
        'onUpdate:modelValue': (v: Record<string, any>) => (model.value = v),
      },
    })
    await settle()
    await wrapper.setProps({ modelValue: { ...model.value, city: 'Bergen' } })
    await settle()
    expect(input(wrapper, '#v-city').value).toBe('Bergen')
    expect(input(wrapper, '#v-name').value).toBe('Ann')
  })
})
