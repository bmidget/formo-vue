import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { FormoErrors, FormoField, FormoForm, FormoInput, FormoLabel, FormoRest, useFormo } from 'formo-vue'
import type { FieldDef } from 'formo-vue'
import { shadcnTheme } from '@/components/ui/formo'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const definition = (): FieldDef & { fields: Record<string, FieldDef | string> } => ({
  alias: 's',
  fields: {
    email: { driver: 'email', required: true, message: 'We never share it' },
    age: { driver: 'number' },
    bio: 'textarea',
    role: { driver: 'select', opts: { Staff: { admin: 'Admin' }, guest: 'Guest' }, blank: 'Pick a role' },
    size: { driver: 'radios', opts: [[1, 'Small'], [2, 'Large']] },
    tags: { driver: 'checkboxes', opts: { a: 'A', b: 'B' } },
    agree: { driver: 'bool', label: 'I agree', required: true },
  },
})

function host(render: (form: any) => any) {
  let form: any
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
const field = (wrapper: any, path: string) => wrapper.get(`[data-formo-path="${path}"]`)

describe('the shadcn-vue registry item (registry/shadcn-vue/formo)', () => {
  it('your shadcn-vue components as the controls, in shadcn\'s field layout, wired to Formo', async () => {
    const { wrapper } = host((form) => h(FormoForm, { form, theme: shadcnTheme }))
    await settle()
    const email = field(wrapper, 'email')
    expect(email.attributes('data-slot')).toBe('form-item')
    const input = email.get('[data-slot="input"]')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('id')).toBe('s-email')
    expect(email.get('[data-slot="label"]').attributes('for')).toBe('s-email')
    expect(email.get('[data-slot="form-description"]').text()).toBe('We never share it')
    expect(field(wrapper, 'bio').find('[data-slot="textarea"]').exists()).toBe(true)
    expect(field(wrapper, 'role').get('[data-slot="select-trigger"]').attributes('id')).toBe('s-role')
    expect(field(wrapper, 'role').get('[data-slot="select-value"]').text()).toBe('Pick a role')
    expect(field(wrapper, 'size').findAll('[data-slot="radio-group-item"]')).toHaveLength(2)
    expect(field(wrapper, 'size').get('legend').text()).toBe('Size')
    const agree = field(wrapper, 'agree')
    expect(agree.get('[data-slot="checkbox"]').attributes('id')).toBe('s-agree')
    expect(agree.get('[data-slot="label"]').attributes('for')).toBe('s-agree')
  })

  it('validation: aria-invalid styles the controls, FormMessage-like errors, red labels', async () => {
    const { wrapper } = host((form) => h(FormoForm, { form, theme: shadcnTheme }))
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    const email = field(wrapper, 'email')
    const input = email.get('[data-slot="input"]')
    const message = email.get('[data-slot="form-message"]')
    expect(message.text()).toBe('Email must not be empty')
    expect(message.classes()).toContain('text-destructive')
    expect(input.attributes('aria-invalid')).toBe('true') // shadcn's aria-invalid:border-destructive kicks in
    expect(input.attributes('aria-describedby')).toContain(message.attributes('id'))
    expect(email.get('[data-slot="label"]').attributes('data-error')).toBe('true')
    expect(field(wrapper, 'agree').get('[data-slot="checkbox"]').attributes('aria-invalid')).toBe('true')
  })

  it('values round-trip: numbers from a string-emitting Input, select / radios keep their types, arrays, booleans', async () => {
    const { wrapper, form } = host((form) => h(FormoForm, { form, theme: shadcnTheme }))
    await settle()
    await field(wrapper, 'age').get('input').setValue('42')
    await field(wrapper, 'role').get('[data-slot="select-trigger"]').trigger('click')
    await field(wrapper, 'role').findAll('[data-slot="select-item"]')[0].trigger('click')
    await field(wrapper, 'size').findAll('[data-slot="radio-group-item"]')[1].trigger('click')
    await field(wrapper, 'tags').findAll('[data-slot="checkbox"]')[1].trigger('click')
    await field(wrapper, 'agree').get('[data-slot="checkbox"]').trigger('click')
    await settle()
    expect(form().values).toMatchObject({ age: 42, role: 'admin', size: 2, tags: ['b'], agree: true })
    expect(field(wrapper, 'role').get('[data-slot="select-value"]').text()).toBe('Admin')
  })

  it('native submits: the components post their own values (no duplicates)', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: { ...definition(), fields: { ...definition().fields, agree: { driver: 'bool', val: true }, size: { driver: 'radios', opts: [[1, 'S']], val: 1 } } }, theme: shadcnTheme, native: true },
    })
    await settle()
    expect(wrapper.findAll('[name="s[email]"]')).toHaveLength(1)
    expect(wrapper.findAll('[name="s[agree]"]')).toHaveLength(1)
    expect(wrapper.findAll('[name="s[size]"]')).toHaveLength(1)
  })

  it('swap in the Switch by name, and the parts in your own markup', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form, theme: shadcnTheme, components: { checkbox: 'switch' } }, () => [
        h(FormoField, { field: form.fields.email }, {
          default: ({ field }: any) => h('div', { class: 'mine' }, [h(FormoLabel, { field, class: 'text-lg' }), h(FormoInput, { field }), h(FormoErrors, { field })]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    expect(field(wrapper, 'agree').find('[data-slot="switch"]').exists()).toBe(true)
    const label = wrapper.get('.mine [data-slot="label"]')
    expect(label.classes()).toContain('text-lg')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('.mine [data-slot="form-message"]').text()).toBe('Email must not be empty')
  })
})

describe('registry/r/formo.json', () => {
  it('is the registry item built from registry/shadcn-vue/formo (bun run build:registry)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const item = JSON.parse(readFileSync('registry/r/formo.json', 'utf8'))
    const sources = readdirSync('registry/shadcn-vue/formo').filter((f: string) => /\.(vue|ts)$/.test(f))
    expect(item.name).toBe('formo')
    expect(item.files.map((f: any) => f.target).sort()).toEqual(sources.map((f: string) => `components/ui/formo/${f}`).sort())
    for (const file of item.files) expect(file.content).toBe(readFileSync(file.path, 'utf8'))
    expect(item.registryDependencies).toEqual(expect.arrayContaining(['input', 'label', 'select', 'checkbox', 'radio-group', 'switch', 'textarea']))
  })
})
