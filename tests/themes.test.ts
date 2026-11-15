import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createFormo, defaultTheme, defineTheme, Formo, FormoErrorSummary, FormoField, FormoForm, FormoInput, FormoLabelView } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

/** A Bootstrap-like field view: the input comes *before* the label (what .form-floating needs) */
const FloatingField = defineComponent({
  props: ['formo'],
  setup: (props, { slots }) => () =>
    h('div', { class: 'form-floating' }, [slots.input?.(), slots.label?.(), slots.errors?.()]),
})
const BsField = defineComponent({
  props: ['formo'],
  setup: (props, { slots }) => () => h('div', { class: 'mb-3' }, [slots.label?.(), slots.input?.(), slots.help?.(), slots.errors?.()]),
})
const BsError = defineComponent({
  props: ['formo'],
  setup: (props) => () => (props.formo.error ? h('div', { class: 'invalid-feedback', id: props.formo.errorId }, props.formo.error) : null),
})
const BsGroup = defineComponent({
  props: ['formo'],
  setup: (props, { slots }) => () => h('section', { class: 'card', 'data-group': props.formo.path }, [h('h5', props.formo.label), slots.default?.()]),
})

const bootstrap = defineTheme({
  name: 'bootstrap',
  views: { field: BsField, errors: BsError, group: BsGroup, floating: FloatingField },
  classes: { control: 'form-control', controlInvalid: 'is-invalid', label: 'form-label' },
})

const form = () =>
  Formo.form({
    alias: 'f',
    fields: {
      email: { driver: 'email', required: true },
      nick: { view: 'floating' },
      address: { fields: { zip: {} } },
    },
  })

describe('themes swap views, not just classes', () => {
  it('a theme replaces views and classes (no Tailwind left); fields pick named views', async () => {
    const wrapper = mount(FormoForm, { props: { form: form(), theme: bootstrap } })
    await settle()
    const email = wrapper.get('[data-formo-path="email"]')
    expect(email.classes()).toEqual(['mb-3'])
    expect(email.get('label').classes()).toEqual(['form-label'])
    expect(wrapper.get('#f-email').classes()).toEqual(['form-control']) // replaced, not merged with Tailwind's
    // view: 'floating' → the input before the label
    const floating = wrapper.get('[data-formo-path="nick"]')
    expect(floating.classes()).toContain('form-floating')
    expect(floating.element.firstElementChild!.tagName).toBe('INPUT')
    expect(floating.element.children[1].tagName).toBe('LABEL')
    // Groups: the theme's group view, the fields inside through its slot
    expect(wrapper.get('section.card[data-group="address"] h5').text()).toBe('Address')
    expect(wrapper.find('section.card input#f-address-zip').exists()).toBe(true)

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('#f-email').classes()).toEqual(['form-control', 'is-invalid'])
    const error = wrapper.get('.invalid-feedback')
    expect(error.text()).toBe('Email must not be empty')
    expect(wrapper.get('#f-email').attributes('aria-describedby')).toContain(error.attributes('id'))
  })

  it('template slots work with any theme (they fill the view slots)', async () => {
    let controller: any
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(FormoForm, { form: form(), theme: bootstrap, ref: (r: any) => (controller = r?.form) }, {
              default: ({ fields }: any) => [
                h(FormoField, { field: fields.email }, {
                  input: () => h('div', { class: 'input-group' }, [h('span', { class: 'input-group-text' }, '@'), h(FormoInput)]),
                }),
                h(FormoField, { field: fields.nick }),
                h(FormoField, { field: fields.address }),
              ],
            })
        },
      }),
    )
    await settle()
    expect(controller).toBeTruthy()
    expect(wrapper.get('.mb-3 > .input-group > input').attributes('id')).toBe('f-email')
  })

  it('extends another theme; overrides (app, form, group) layer over the theme', async () => {
    const Marked = defineComponent({ props: ['formo', 'as'], setup: (p) => () => h(FormoLabelView, { formo: p.formo, as: p.as, class: 'marked' }) })
    const tailwindPlus = defineTheme({ extends: defaultTheme, views: { label: Marked }, classes: { control: 'border-2' } })
    expect(tailwindPlus.classes.control).toContain('border-2')
    expect(tailwindPlus.classes.control).not.toMatch(/\bborder\b(?!-)/) // tailwind-merge kept from the parent

    const DatePicker = defineComponent({ setup: () => () => h('div', { class: 'picker' }) })
    const wrapper = mount(FormoForm, {
      props: {
        form: {
          fields: {
            a: {},
            when: { driver: 'date' },
            g: { theme: { classes: { control: 'g-control' }, views: { label: FormoLabelView } }, fields: { b: {} } },
          },
        },
        theme: tailwindPlus,
        classes: { control: 'rounded-none' },
      },
      global: { plugins: [createFormo({ components: { 'input|date': DatePicker } })] },
    })
    await settle()
    const a = wrapper.get('#formo-a')
    expect(a.classes()).toEqual(expect.arrayContaining(['border-2', 'rounded-none']))
    expect(a.classes()).not.toContain('rounded-lg')
    expect(wrapper.get('label[for="formo-a"]').classes()).toContain('marked')
    expect(wrapper.find('.picker').exists()).toBe(true) // app-wide control override, whatever the theme
    // Inside the group: its own layer cascades
    expect(wrapper.get('#formo-g-b').classes()).toContain('g-control')
    expect(wrapper.get('label[for="formo-g-b"]').classes()).not.toContain('marked')
  })

  it('app-wide theme, per-field `view: false`, and the control from the theme', async () => {
    const Stars = defineComponent({ props: ['modelValue'], setup: () => () => h('div', { class: 'stars' }) })
    const themed = defineTheme({ extends: defaultTheme, components: { rating: Stars } })
    const wrapper = mount(FormoForm, {
      props: {
        form: { fields: { score: { driver: 'rating' }, raw: { view: false }, name: {} } },
        drivers: { rating: { defaultValue: () => 0 } },
      },
      global: { plugins: [createFormo({ theme: themed })] },
    })
    await settle()
    expect(wrapper.find('[data-formo-path="score"] .stars').exists()).toBe(true)
    expect(wrapper.find('[data-formo-path="raw"]').exists()).toBe(false)
    expect(wrapper.find('#formo-raw').exists()).toBe(true)
    expect(wrapper.find('label[for="formo-raw"]').exists()).toBe(false)
  })

  it('PHP `template` is the view name; unknown views warn and fall back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.fromJSON({ alias: 'p', fields: [{ alias: 'a', template: 'floating' }, { alias: 'b', template: 'nope' }, { alias: 'c', template: null }] }),
        theme: bootstrap,
      },
    })
    await settle()
    expect(wrapper.get('[data-formo-path="a"]').classes()).toContain('form-floating')
    expect(wrapper.get('[data-formo-path="b"]').classes()).toEqual(['mb-3'])
    expect(wrapper.get('[data-formo-path="c"]').classes()).toEqual(['mb-3'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No view named "nope"'))
    warn.mockRestore()
  })

  it('form, blueprint and error summary views are swappable too', async () => {
    const FormView = defineComponent({
      props: ['formo'],
      setup: (props, { slots }) => () => h('div', { class: 'my-form' }, [props.formo.error && h('b', props.formo.error), slots.before?.(), slots.default?.()]),
    })
    const Rows = defineComponent({
      props: ['formo'],
      setup: (props, { slots }) => () =>
        h('ol', { class: 'rows' }, [...props.formo.rows.map((row: any) => slots.row?.({ row })), h('button', { type: 'button', class: 'more', onClick: props.formo.add }, '+')]),
    })
    const Row = defineComponent({ props: ['formo', 'row'], setup: (props, { slots }) => () => h('li', { class: 'row' }, slots.default?.()) })
    const Summary = defineComponent({ props: ['formo'], setup: (props) => () => h('div', { class: 'summary' }, `${props.formo.items.length} errors`) })

    const wrapper = mount(FormoForm, {
      props: {
        form: { alias: 'x', fields: { name: { required: true }, tags: { blueprint: true, min: 1, fields: { tag: {} } } } },
        views: { form: FormView, blueprint: Rows, blueprintRow: Row, errorSummary: Summary },
      },
      slots: { before: () => h(FormoErrorSummary) },
    })
    await settle()
    expect(wrapper.find('form > fieldset > .my-form').exists()).toBe(true)
    expect(wrapper.findAll('ol.rows > li.row')).toHaveLength(1)
    await wrapper.get('.more').trigger('click')
    await settle()
    expect(wrapper.findAll('ol.rows > li.row input').map((i) => i.attributes('name'))).toEqual(['x[tags][0][tag]', 'x[tags][1][tag]'])

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('.summary').text()).toBe('1 errors')
  })

  it('views pass attributes and classes to the parts through their slots (merged with the theme)', async () => {
    const Floating = defineComponent({
      props: ['formo'],
      setup: (props, { slots }) => () =>
        h('div', { class: 'relative' }, [
          slots.input?.({ class: 'peer pt-5', placeholder: ' ' }),
          slots.label?.({ class: 'absolute text-xs' }),
        ]),
    })
    const wrapper = mount(FormoForm, {
      props: { form: { fields: { name: { attr: { placeholder: 'Ada' } } } }, views: { field: Floating } },
    })
    await settle()
    const input = wrapper.get('input')
    expect(input.attributes('placeholder')).toBe(' ')
    expect(input.classes()).toEqual(expect.arrayContaining(['peer', 'pt-5', 'w-full']))
    const label = wrapper.get('label')
    expect(label.classes()).toEqual(expect.arrayContaining(['absolute', 'text-xs', 'font-medium']))
    expect(label.classes()).not.toContain('text-sm')
  })

  it('subforms take `view` too: a component, or false for just their fields', async () => {
    const Card = defineComponent({
      props: ['formo'],
      setup: (props, { slots }) => () => h('article', { class: 'card', 'data-error': props.formo.error }, [h('h3', props.formo.label), slots.default?.()]),
    })
    const wrapper = mount(FormoForm, {
      props: {
        form: {
          alias: 'v',
          fields: {
            billing: { view: Card, fields: { street: {} } },
            meta: { view: false, fields: { source: {} } },
          },
        },
      },
    })
    await settle()
    expect(wrapper.get('article.card h3').text()).toBe('Billing')
    expect(wrapper.get('article.card input').attributes('name')).toBe('v[billing][street]')
    expect(wrapper.find('[data-formo-group="meta"]').exists()).toBe(false)
    expect(wrapper.get('#v-meta-source').attributes('name')).toBe('v[meta][source]')
  })

  it('warns about a flat class map given as `theme` (classes go in `classes`)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(FormoForm, { props: { form: { fields: ['a'] }, theme: { control: 'x' } as any } })
    await settle()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('theme: unknown key(s) control'))
    warn.mockRestore()
  })
})
