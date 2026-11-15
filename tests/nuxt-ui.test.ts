import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { FormoErrors, FormoField, FormoForm, FormoInput, FormoLabel, FormoRest, useFormo } from 'formo-vue'
import type { FieldDef } from 'formo-vue'
import { nuxtUiTheme, toItems } from 'formo-vue/nuxt-ui'
import * as ui from '../playground/stubs/nuxt-ui'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const theme = nuxtUiTheme(ui)

const definition = (): FieldDef & { fields: Record<string, FieldDef | string> } => ({
  alias: 'n',
  fields: {
    email: { driver: 'email', required: true, message: 'We never share it' },
    age: { driver: 'number' },
    bio: 'textarea',
    role: { driver: 'select', opts: { Staff: { admin: 'Admin', editor: 'Editor' }, guest: 'Guest' }, blank: 'Choose a role' },
    level: { driver: 'select', opts: [[1, 'One'], [2, 'Two']] },
    size: { driver: 'radios', opts: { s: 'Small', l: 'Large' }, inline: true },
    tags: { driver: 'checkboxes', opts: { a: 'A', b: 'B' } },
    flags: { driver: 'set', opts: { x: 'X', y: 'Y' }, val: 'y' },
    agree: { driver: 'bool', label: 'I agree', required: true },
    save: { driver: 'button', label: 'Save', attr: { type: 'submit' } },
  },
})

function host(render: (form: any) => any, options: Record<string, unknown> = {}) {
  let form: any
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition())
        return () => render(form)
      },
    }),
    { attachTo: document.body, ...options },
  )
  return { wrapper, form: () => form }
}

const field = (wrapper: any, path: string) => wrapper.get(`[data-formo-path="${path}"]`)

describe('formo-vue/nuxt-ui', () => {
  it('toItems: Formo options → Nuxt UI items (optgroups → groups)', () => {
    expect(toItems([{ value: 1, label: 'One' }])).toEqual([{ value: 1, label: 'One', disabled: undefined }])
    expect(toItems([{ label: 'G', options: [{ value: 'a', label: 'A' }] }, { value: 'z', label: 'Z' }])).toEqual([
      [{ type: 'label', label: 'G' }, { label: 'A', value: 'a', disabled: undefined }],
      [{ label: 'Z', value: 'z', disabled: undefined }],
    ])
  })

  it('every field in a UFormField, with Nuxt UI controls — wired to Formo', async () => {
    const { wrapper } = host((form) => h(FormoForm, { form, theme }))
    await settle()
    const email = field(wrapper, 'email')
    const input = email.get('input')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('id')).toBe('n-email')
    expect(email.get('label').attributes('for')).toBe('n-email') // UFormField's label follows the input's id
    expect(email.get('label').text()).toBe('Email') // UFormField draws the required asterisk (CSS)
    expect(email.get('label').classes()).toContain("after:content-['*']")
    expect(email.get('[data-slot="help"]').text()).toBe('We never share it')

    expect(field(wrapper, 'bio').find('textarea').exists()).toBe(true)
    // USelect: a listbox, not a native <select> — placeholder from `blank`, optgroups as labelled groups
    const role = field(wrapper, 'role')
    const trigger = role.get('[role="combobox"]')
    expect(trigger.attributes('id')).toBe('n-role')
    expect(role.get('label').attributes('for')).toBe('n-role')
    expect(role.get('[data-slot="placeholder"]').text()).toBe('Choose a role')
    expect(role.find('[role="listbox"]').exists()).toBe(false)
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(role.findAll('[data-slot="content"] [data-slot="label"]').map((l: any) => l.text())).toEqual(['Staff'])
    expect(role.findAll('[role="option"]').map((o: any) => o.text())).toEqual(['Admin', 'Editor', 'Guest'])
    await role.findAll('[role="option"]')[1].trigger('click')
    expect(role.find('[role="listbox"]').exists()).toBe(false)
    expect(role.get('[data-slot="value"]').text()).toBe('Editor')
    expect(field(wrapper, 'size').get('legend').text()).toBe('Size') // URadioGroup's own legend
    expect(field(wrapper, 'size').findAll('[role="radio"]')).toHaveLength(2)
    // UCheckbox labels itself: no label around it
    const agree = field(wrapper, 'agree')
    expect(agree.findAll('label')).toHaveLength(1)
    expect(agree.get('label').attributes('for')).toBe('n-agree')
    expect(agree.get('[role="checkbox"]').attributes('id')).toBe('n-agree')
    expect(field(wrapper, 'save').get('button').text()).toBe('Save')
  })

  it('validation: errors in UFormField, the Nuxt UI error look, aria wired', async () => {
    const { wrapper } = host((form) => h(FormoForm, { form, theme }))
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    const email = field(wrapper, 'email')
    const input = email.get('input')
    const error = email.get('[data-slot="error"]')
    expect(error.text()).toBe('Email must not be empty')
    expect(email.find('[data-slot="help"]').exists()).toBe(false) // the error replaces the help, like Nuxt UI
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(error.attributes('id'))
    expect(input.classes()).toContain('ring-error')
    expect(field(wrapper, 'agree').get('[data-slot="error"]').text()).toBe('I agree must not be empty')

    await input.setValue('a@b.co')
    await settle()
    expect(email.find('[data-slot="error"]').exists()).toBe(false)
    expect(input.classes()).not.toContain('ring-error')
  })

  it('values round-trip: numbers, select values keep their type, groups, SET strings, booleans', async () => {
    const { wrapper, form } = host((form) => h(FormoForm, { form, theme }))
    await settle()
    await field(wrapper, 'age').get('input').setValue('42')
    await field(wrapper, 'level').get('[role="combobox"]').trigger('click')
    await field(wrapper, 'level').findAll('[role="option"]')[1].trigger('click')
    await field(wrapper, 'size').findAll('[role="radio"]')[1].trigger('click')
    await field(wrapper, 'tags').findAll('[role="checkbox"]')[0].trigger('click')
    await field(wrapper, 'flags').findAll('[role="checkbox"]')[0].trigger('click')
    await field(wrapper, 'agree').get('[role="checkbox"]').trigger('click')
    await settle()
    expect(form().values).toMatchObject({ age: 42, level: 2, size: 'l', tags: ['a'], flags: 'y,x', agree: true })
  })

  it('USelect: keyboard, a hidden <select> for form posts, and closing the list is the blur (validation)', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: { alias: 'k', fields: { kind: { driver: 'select', opts: { a: 'Apple', b: 'Banana', c: 'Cherry' }, required: true } } }, theme },
      attachTo: document.body,
    })
    await settle()
    const trigger = wrapper.get('[role="combobox"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await settle()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const list = wrapper.get('[role="listbox"]')
    expect(document.activeElement).toBe(list.element) // focus moves into the list, like Reka UI
    // Escape without choosing: the field was visited → required error (eager validation on blur)
    await list.trigger('keydown', { key: 'Escape' })
    await settle()
    expect(wrapper.get('[data-slot="error"]').text()).toBe('Kind must not be empty')
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('keydown', { key: 'Enter' })
    await settle()
    await wrapper.get('[role="listbox"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[role="listbox"]').trigger('keydown', { key: 'c' }) // typeahead
    await wrapper.get('[role="listbox"]').trigger('keydown', { key: 'Enter' })
    await settle()
    expect(wrapper.findComponent(FormoForm).vm.form.values.kind).toBe('c')
    expect(wrapper.get('[data-slot="value"]').text()).toBe('Cherry')
    expect(wrapper.find('[data-slot="error"]').exists()).toBe(false)
    const hidden = wrapper.get('select[name="k[kind]"]')
    expect(hidden.attributes('hidden')).toBeDefined()
    expect((hidden.element as HTMLSelectElement).value).toBe('c')
    wrapper.unmount()
  })

  it('native submits: Nuxt UI controls post their own values (no duplicates)', async () => {
    const wrapper = mount(FormoForm, { props: { form: { ...definition(), fields: { ...definition().fields, agree: { driver: 'bool', val: true } } }, theme, native: true } })
    await settle()
    expect(wrapper.findAll('[name="n[email]"]')).toHaveLength(1)
    expect(wrapper.findAll('[name="n[bio]"]')).toHaveLength(1)
    expect(wrapper.findAll('[name="n[agree]"]')).toHaveLength(1)
    expect(wrapper.findAll('[name="n[flags][]"]')).toHaveLength(1)
    expect(wrapper.findAll('[name="n[role]"]')).toHaveLength(1) // the listbox's hidden <select>
  })

  it('swap controls by name: USelectMenu for one field, USwitch for a form\'s checkboxes', async () => {
    const { wrapper, form } = host((form) => h(FormoForm, { form, theme, components: { checkbox: 'switch' } }))
    await settle()
    expect(field(wrapper, 'agree').find('[role="switch"]').exists()).toBe(true)
    wrapper.unmount()

    const menu = mount(FormoForm, {
      props: { form: { alias: 'm', fields: { country: { driver: 'select', component: 'select-menu', opts: { fr: 'France', de: 'Germany' } } } }, theme },
    })
    await settle()
    await menu.get('[role="combobox"]').trigger('click')
    expect(menu.find('[role="searchbox"]').exists()).toBe(true) // USelectMenu: searchable
    await menu.get('[role="searchbox"]').setValue('ger')
    expect(menu.findAll('[role="option"]').map((o) => o.text())).toEqual(['Germany'])
    await menu.get('[role="option"]').trigger('click')
    await settle()
    expect(menu.findComponent(FormoForm).vm.form.values.country).toBe('de')
    expect(form()).toBeTruthy()
  })

  it('optional components: without USelectMenu / USwitch / UButton, Formo falls back', async () => {
    const { UFormField, UInput, UTextarea, USelect, UCheckbox, URadioGroup, UCheckboxGroup } = ui
    const minimal = nuxtUiTheme({ UFormField, UInput, UTextarea, USelect, UCheckbox, URadioGroup, UCheckboxGroup })
    const wrapper = mount(FormoForm, {
      props: { form: { fields: { c: { driver: 'select', component: 'select-menu', opts: ['x'] }, save: { driver: 'button', attr: { type: 'submit' } } } }, theme: minimal },
    })
    await settle()
    expect(wrapper.find('[data-formo-path="c"] [role="combobox"]').exists()).toBe(true) // USelect…
    await wrapper.get('[data-formo-path="c"] [role="combobox"]').trigger('click')
    expect(wrapper.find('[data-formo-path="c"] [role="searchbox"]').exists()).toBe(false) // …not USelectMenu
    expect(wrapper.get('[data-formo-path="save"] button').classes()).toContain('bg-primary') // Formo's button, Nuxt UI classes
  })

  it('your own markup: the parts are Nuxt UI-styled and show the error look without UFormField', async () => {
    const { wrapper } = host((form) =>
      h(FormoForm, { form, theme }, () => [
        h(FormoField, { field: form.fields.email }, {
          default: ({ field }: any) =>
            h('div', { class: 'mine' }, [h(FormoLabel, { field }), h(FormoInput, { field }), h(FormoErrors, { field })]),
        }),
        h(FormoRest),
      ]),
    )
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    const mine = wrapper.get('.mine')
    expect(mine.get('label').classes()).toEqual(expect.arrayContaining(['text-default', 'font-medium']))
    expect(mine.get('input').classes()).toContain('ring-error') // color: 'error' from the field's state
    const error = mine.get('[role="alert"]')
    expect(error.classes()).toContain('text-error')
    expect(mine.get('input').attributes('aria-describedby')).toContain(error.attributes('id'))
  })

  it('UButton: submit spins while submitting; the rest of the theme\'s views stay Nuxt UI', async () => {
    let resolve!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const wrapper = mount(FormoForm, { props: { form: { fields: { save: { driver: 'button', label: 'Go', attr: { type: 'submit' } } } }, theme, onSubmit } })
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button .animate-spin').exists()).toBe(true)
    resolve()
    await settle()
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })
})
