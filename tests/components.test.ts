import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createFormo, Formo, FormoForm, useFormo, useFormoField } from 'formo-vue'
import type { FormoController } from 'formo-vue'

/** Let vee-validate's async validation settle */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await flushPromises()
    await nextTick()
  }
}

describe('<FormoForm>', () => {
  it('renders fields with labels, ids and namespaced names', () => {
    const form = Formo.form({ alias: 'user' })
      .add('first_name')
      .add('address', Formo.group().add('street'))
    const wrapper = mount(FormoForm, { props: { form } })

    const input = wrapper.get('input#user-first_name')
    expect(input.attributes('name')).toBe('user[first_name]')
    expect(wrapper.get('label[for="user-first_name"]').text()).toBe('First name')

    const street = wrapper.get('input#user-address-street')
    expect(street.attributes('name')).toBe('user[address][street]')
    expect(wrapper.get('fieldset[data-formo-group="address"] legend').text()).toBe('Address')
  })

  it('validates, shows errors, and submits filtered values', async () => {
    const onSubmit = vi.fn()
    const form = Formo.form({ alias: 'signup' })
      .add('username', { rules: [['not_empty'], ['min_length', [':value', 3]]], filters: ['trim'] })
      .add('email', 'input|email', { required: true })
    const wrapper = mount(FormoForm, { props: { form, onSubmit } })

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Username must not be empty')
    expect(wrapper.text()).toContain('Email must not be empty')
    expect(wrapper.get('#signup-username').attributes('aria-invalid')).toBe('true')

    await wrapper.get('#signup-username').setValue('  ben  ')
    await wrapper.get('#signup-email').setValue('not-an-email')
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('Email must be an email address')

    await wrapper.get('#signup-email').setValue('ben@example.com')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual({ username: 'ben', email: 'ben@example.com' })
    expect(wrapper.text()).not.toContain('must not be empty')
  })

  it('supports v-model', async () => {
    const model = ref<Record<string, any>>({ name: 'Ann' })
    const wrapper = mount(FormoForm, {
      props: {
        form: { fields: ['name', { alias: 'agree', driver: 'checkbox' }] },
        modelValue: model.value,
        'onUpdate:modelValue': (v: Record<string, any>) => (model.value = v),
      },
    })
    await settle()
    expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe('Ann')

    await wrapper.get('input[type="checkbox"]').setValue(true)
    await settle()
    expect(model.value).toEqual({ name: 'Ann', agree: true })

    await wrapper.setProps({ modelValue: { name: 'Bob', agree: true } })
    await settle()
    expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe('Bob')
  })

  it('renders selects with optgroups, radios, checkboxes and sets', async () => {
    const model = ref<Record<string, any>>({})
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form()
          .addGroup('activity', 'select', { Exercise: { run: 'Running' }, Dates: { movie: 'Movie' } }, 'movie', { blank: 'Pick one' })
          .addGroup('size', 'radios', [[1, 'Small'], [2, 'Large']], 2)
          .addGroup('hobbies', 'checkboxes', { run: 'Running', swim: 'Swimming', hike: 'Hiking' }, ['hike'])
          .addGroup('flags', 'set', { a: 'A', b: 'B' }, 'b'),
        'onUpdate:modelValue': (v: Record<string, any>) => (model.value = v),
      },
    })
    await settle()
    const select = wrapper.get('select').element as HTMLSelectElement
    expect(wrapper.findAll('optgroup').map((o) => o.attributes('label'))).toEqual(['Exercise', 'Dates'])
    expect(select.selectedOptions[0].textContent?.trim()).toBe('Movie')

    await wrapper.findAll('input[type="radio"]')[0].setValue(true)
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true) // run
    await wrapper.findAll('input[type="checkbox"]')[3].setValue(true) // set: a
    await settle()
    // Numbers stay numbers; checkbox order follows the options; set is a CSV string
    expect(model.value).toMatchObject({ activity: 'movie', size: 1, hobbies: ['run', 'hike'], flags: 'a,b' })
  })

  it('runs group-level rules only after the fields pass, and callbacks', async () => {
    const pass = vi.fn()
    const fail = vi.fn()
    const canLogin = (values: Record<string, string>) => values.password === 'secret' || 'Username or password is incorrect'
    const form = Formo.form({ alias: 'login', rules: [canLogin], callbacks: { pass: [pass], fail: [fail] } })
      .add('username', { required: true })
      .add('password', 'input|password', { required: true })

    let controller!: FormoController
    const Host = defineComponent({
      setup() {
        controller = useFormo(form)
        return () => h(FormoForm, { form: controller })
      },
    })
    const wrapper = mount(Host)

    expect(await controller.validate()).toBe(false)
    await settle()
    expect(wrapper.text()).not.toContain('incorrect') // group rule skipped: fields failed
    expect(fail).toHaveBeenCalledTimes(1)

    controller.load({ username: 'ben', password: 'wrong' })
    expect(await controller.validate()).toBe(false)
    await settle()
    expect(wrapper.get('form > fieldset > p[role="alert"]').text()).toBe('Username or password is incorrect')
    expect(controller.errors).toEqual({ ':self': 'Username or password is incorrect' })

    controller.val('password', 'secret')
    expect(await controller.validate()).toBe(true)
    expect(pass).toHaveBeenCalledTimes(1)
    await settle()
    expect(wrapper.text()).not.toContain('incorrect')
  })

  it('accepts server errors in Formo errors() format', async () => {
    let controller!: FormoController
    const Host = defineComponent({
      setup() {
        controller = useFormo(Formo.form().add('email').add('address', Formo.group().add('zip')))
        return () => h(FormoForm, { form: controller })
      },
    })
    const wrapper = mount(Host)
    await settle()
    controller.setErrors({ ':self': 'Server said no', email: 'Email taken', address: { zip: 'Bad zip', ':self': 'Bad address' } })
    await settle()
    expect(wrapper.text()).toContain('Server said no')
    expect(wrapper.text()).toContain('Email taken')
    expect(wrapper.text()).toContain('Bad zip')
    expect(wrapper.text()).toContain('Bad address')
    expect(controller.errors).toEqual({
      ':self': 'Server said no',
      email: 'Email taken',
      address: { zip: 'Bad zip', ':self': 'Bad address' },
    })
  })

  it('renders/hides fields conditionally and skips their validation', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(FormoForm, {
      props: {
        onSubmit,
        form: {
          fields: [
            { alias: 'contact', driver: 'radios', opts: { email: 'Email', phone: 'Phone' }, val: 'email' },
            { alias: 'phone', required: true, render: ({ values }: any) => values.contact === 'phone' },
          ],
        },
      },
    })
    await settle()
    expect(wrapper.find('input[name="formo[phone]"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)

    await wrapper.findAll('input[type="radio"]')[1].setValue(true)
    await settle()
    expect(wrapper.find('input[name="formo[phone]"]').exists()).toBe(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Phone must not be empty')
  })

  it('renders uneditable fields as text', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: { fields: [{ alias: 'hobby', driver: 'select', opts: { run: 'Running' }, val: 'run', editable: false }] } },
    })
    await settle()
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).toContain('Running')
  })
})

describe('blueprints (repeatable groups)', () => {
  it('adds and removes rows, respecting min/max', async () => {
    const model = ref<Record<string, any>>({})
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ alias: 'f' }).add(
          Formo.group('phones', { min: 1, max: 2, addLabel: 'Add phone' }).add('number', { required: true }).padBlueprint([{ number: '555' }]),
        ),
        'onUpdate:modelValue': (v: Record<string, any>) => (model.value = v),
      },
    })
    await settle()
    expect(wrapper.findAll('[data-blueprint-key]')).toHaveLength(1)
    expect(wrapper.find('button').text()).toContain('Add phone')
    // min: 1 → cannot remove the only row
    expect(wrapper.text()).not.toContain('Remove')

    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.findAll('[data-blueprint-key]')).toHaveLength(2)
    expect(wrapper.find('input[name="f[phones][1][number]"]').exists()).toBe(true)
    // max: 2 → no more add button
    expect(wrapper.text()).not.toContain('Add phone')

    await wrapper.get('input[name="f[phones][1][number]"]').setValue('777')
    await settle()
    expect(model.value).toEqual({ phones: [{ number: '555' }, { number: '777' }] })

    const remove = wrapper.findAll('button').find((b) => b.text() === 'Remove')!
    await remove.trigger('click')
    await settle()
    expect(model.value).toEqual({ phones: [{ number: '777' }] })
  })
})

describe('overriding components', () => {
  const Stars = defineComponent({
    name: 'Stars',
    props: { modelValue: Number },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('div', { class: 'stars' }, [1, 2, 3].map((n) =>
          h('button', { type: 'button', 'data-star': n, onClick: () => emit('update:modelValue', n) }, n <= (props.modelValue ?? 0) ? '★' : '☆'),
        ))
    },
  })

  it('per field, with v-model and fallthrough attrs', async () => {
    const model = ref<Record<string, any>>({})
    const wrapper = mount(FormoForm, {
      props: {
        form: { alias: 'r', fields: [{ alias: 'rating', component: Stars, val: 1, rules: 'min_value:2' }] },
        'onUpdate:modelValue': (v: Record<string, any>) => (model.value = v),
      },
    })
    await settle()
    const stars = wrapper.get('.stars')
    expect(stars.attributes('id')).toBe('r-rating')
    expect(wrapper.get('label').text()).toBe('Rating') // still wrapped
    await wrapper.get('[data-star="3"]').trigger('click')
    await settle()
    expect(model.value.rating).toBe(3)
  })

  it('per driver (globally via the plugin, per form, and driver|type)', async () => {
    const Fancy = defineComponent({
      props: { modelValue: String },
      setup: (props) => () => h('div', { class: 'fancy' }, props.modelValue),
    })
    const DatePicker = defineComponent({ setup: () => () => h('div', { class: 'datepicker' }) })

    const wrapper = mount(FormoForm, {
      props: {
        form: { fields: [{ alias: 'bio', driver: 'textarea', val: 'hi' }, { alias: 'when', driver: 'input|date' }, 'plain'] },
        components: { 'input|date': DatePicker },
      },
      global: { plugins: [createFormo({ components: { textarea: Fancy } })] },
    })
    await settle()
    expect(wrapper.get('.fancy').text()).toBe('hi')
    expect(wrapper.find('.datepicker').exists()).toBe(true)
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(1) // 'plain' untouched
  })

  it('by registered name (schemas from JSON) and as a new driver', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: { fields: [{ alias: 'a', component: 'stars' }, { alias: 'b', driver: 'rating' }] },
      },
      global: {
        plugins: [createFormo({ components: { stars: Stars }, drivers: { rating: { component: Stars, defaultValue: () => 2 } } })],
      },
    })
    await settle()
    const groups = wrapper.findAll('.stars')
    expect(groups).toHaveLength(2)
    expect(groups[1].text()).toBe('★★☆')
  })

  it('with useFormoField() inside a custom component', async () => {
    const Toggle = defineComponent({
      setup() {
        const field = useFormoField()
        return () =>
          h('button', { type: 'button', class: 'toggle', onClick: () => field.setValue(!field.value) }, `${field.label}: ${field.value ? 'on' : 'off'}`)
      },
    })
    const wrapper = mount(FormoForm, {
      props: { form: { fields: [{ alias: 'dark_mode', component: Toggle, val: false }] } },
    })
    await settle()
    expect(wrapper.get('.toggle').text()).toBe('Dark mode: off')
    await wrapper.get('.toggle').trigger('click')
    await settle()
    expect(wrapper.get('.toggle').text()).toBe('Dark mode: on')
  })

  it('with #control: and #field: slots', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: { fields: ['tags', 'zip', 'untouched'] } },
      slots: {
        'control:tags': (field: any) => h('span', { class: 'tags-slot' }, `${field.label} control`),
        'field:zip': () => h('div', { class: 'zip-slot' }, 'custom zip'),
      },
    })
    await settle()
    expect(wrapper.get('.tags-slot').text()).toBe('Tags control')
    expect(wrapper.get('label[for="formo-tags"]').text()).toBe('Tags') // wrapper kept for control:
    expect(wrapper.get('.zip-slot').text()).toBe('custom zip')
    expect(wrapper.find('label[for="formo-zip"]').exists()).toBe(false) // field: replaces everything
  })

  it('with a custom wrapper and model binding for third-party components', async () => {
    const Wrapper = defineComponent({
      props: ['formo'],
      setup: (props, { slots }) => () => h('section', { class: 'my-wrapper' }, [h('b', props.formo.label), slots.default?.()]),
    })
    const ThirdParty = defineComponent({
      props: { value: String },
      emits: ['change'],
      setup: (props, { emit }) => () => h('input', { class: 'third', value: props.value, onInput: (e: any) => emit('change', e.target.value) }),
    })
    const model = ref<Record<string, any>>({})
    const wrapper = mount(FormoForm, {
      props: {
        form: { fields: [{ alias: 'color', component: ThirdParty, model: { prop: 'value', event: 'change' } }] },
        components: { wrapper: Wrapper },
        'onUpdate:modelValue': (v: Record<string, any>) => (model.value = v),
      },
    })
    await settle()
    expect(wrapper.get('.my-wrapper b').text()).toBe('Color')
    await wrapper.get('.third').setValue('teal')
    await settle()
    expect(model.value.color).toBe('teal')
  })
})

describe('theme', () => {
  it('merges theme layers with tailwind-merge', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: { fields: [{ alias: 'a' }, { alias: 'b', classes: { control: 'rounded-none' }, attr: { class: 'w-1/2' } }] },
        theme: { control: 'border-2' },
      },
    })
    await settle()
    const [a, b] = wrapper.findAll('input')
    expect(a.classes()).toContain('border-2')
    expect(a.classes()).not.toContain('border') // replaced by tailwind-merge
    expect(b.classes()).toContain('rounded-none')
    expect(b.classes()).not.toContain('rounded-lg')
    expect(b.classes()).toContain('w-1/2')
    expect(b.classes()).not.toContain('w-full')
  })
})

describe('native submit (progressive enhancement for server-rendered apps)', () => {
  it('mirrors custom components into hidden inputs and submits the <form> once valid', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
    const meta = Object.assign(document.createElement('meta'), { name: 'csrf-token', content: 'blade' })
    document.head.appendChild(meta)
    const Picker = defineComponent({
      props: { modelValue: Array },
      setup: () => () => h('div', { class: 'picker' }),
    })
    const wrapper = mount(FormoForm, {
      props: {
        native: true,
        form: Formo.form({ alias: 'post', attr: { action: '/save' } })
          .add('title', { required: true })
          .add('tags', { component: Picker, val: ['a', 'b'] })
          .add('cover', 'file'),
      },
      attachTo: document.body,
    })
    await settle()
    const form = wrapper.get('form')
    expect(form.attributes('action')).toBe('/save')
    expect(form.attributes('enctype')).toBe('multipart/form-data') // a file field makes the form multipart
    expect(wrapper.findAll('input[type="hidden"][name="post[tags][]"]').map((i) => i.attributes('value'))).toEqual(['a', 'b'])

    await form.trigger('submit')
    await settle()
    expect(submit).not.toHaveBeenCalled() // invalid: title is required

    await wrapper.get('#post-title').setValue('Hello')
    await form.trigger('submit')
    await settle()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(wrapper.get('input[name="_token"]').attributes('value')).toBe('blade')
    submit.mockRestore()
    meta.remove()
    wrapper.unmount()
  })
})

describe('labels', () => {
  it('resolves labels from config.labels (path, parent.alias, alias) and translates them', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ alias: 'f' })
          .add('email')
          .add('address', Formo.group().add('street').add('zip'))
          .add('plain_field'),
        config: {
          labels: { email: 'E-mail', 'address.street': 'Street address', 'address.zip': 'Postcode' },
          translate: (text: string) => (text === 'Postcode' ? 'Code postal' : text),
        },
      },
    })
    await settle()
    expect(wrapper.findAll('label').map((l) => l.text())).toEqual(['E-mail', 'Street address', 'Code postal', 'Plain field'])
  })
})
