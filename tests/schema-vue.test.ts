import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { flushPromises, mount } from '@vue/test-utils'
import { builtinRules, defaultConfig, defaultDrivers, Formo, FormoForm, laravelValidationKeys, normalize, parseRules, runRules, useFormo } from 'formo-vue'
import type { FieldDef, FormoController, RuleSpec, UseFormoOptions } from 'formo-vue'
import { fromLaravel, toFormValues, type FormoModel } from 'formo-vue/schema'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

function mountForm(definition: Formo | FieldDef, initialValues?: Record<string, any>, options: UseFormoOptions = {}) {
  let form!: FormoController
  const onSubmit = vi.fn()
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition, { initialValues, ...options })
        return () => h(FormoForm, { form, onSubmit })
      },
    }),
  )
  return { wrapper, form: () => form, onSubmit }
}

async function check(specs: RuleSpec[], value: unknown, values: Record<string, any> = {}) {
  const node = normalize({ alias: 'field' }, { drivers: defaultDrivers }, false)
  return runRules(
    specs,
    value,
    { node, path: 'field', alias: 'field', label: 'Field', values, parentValues: values, form: {} as FormoController },
    { rules: builtinRules, config: defaultConfig, labelFor: (p) => `<${p}>` },
  )
}

describe('rules used by models (Laravel counterparts)', () => {
  it('accepted: must be checked / yes / on / 1', async () => {
    const specs = parseRules('accepted').specs
    expect(await check(specs, false)).toEqual(['Field must be accepted'])
    expect(await check(specs, '')).toEqual(['Field must be accepted'])
    for (const ok of [true, 1, '1', 'yes', 'on', 'true']) expect(await check(specs, ok)).toEqual([])
  })

  it('gt / gte / lt / lte: against a number or another field; empty sides pass', async () => {
    expect(await check(parseRules('gt:0').specs, 0)).toEqual(['Field must be greater than 0'])
    expect(await check(parseRules('gt:0').specs, 0.5)).toEqual([])
    expect(await check(parseRules('lt:10').specs, 10)).toEqual(['Field must be less than 10'])
    expect(await check(parseRules('gte:@start').specs, 3, { start: 5 })).toEqual(['Field must be <start> or more'])
    expect(await check(parseRules('gte:@start').specs, 5, { start: 5 })).toEqual([])
    expect(await check(parseRules('lte:@start').specs, 6, { start: '' })).toEqual([])
    expect(await check(parseRules('gt:0').specs, '')).toEqual([])
    expect(await check(parseRules('gt:0').specs, 'abc')).toHaveLength(1)
  })

  it('map to Laravel lang keys', () => {
    expect(laravelValidationKeys).toMatchObject({ accepted: 'accepted', gt: 'gt.numeric', gte: 'gte.numeric', lt: 'lt.numeric', lte: 'lte.numeric' })
  })
})

describe('forms from Laravel rules', () => {
  const signup = () =>
    Formo.fromModel(
      fromLaravel({
        name: 'u',
        rules: {
          name: 'required|string|max:20',
          email: 'required|email|unique:users',
          age: 'nullable|integer|min:18',
          password: 'required|string|min:8|confirmed',
          terms: 'accepted',
        },
        messages: { 'email.required': 'We need your e-mail' },
      }),
    )

  it('renders the fields with their types and validates like the FormRequest', async () => {
    const { wrapper, form, onSubmit } = mountForm(signup())
    await settle()
    expect(wrapper.get('#u-name').attributes('maxlength')).toBe('20')
    expect(wrapper.get('#u-email').attributes('type')).toBe('email')
    expect(wrapper.get('#u-age').attributes('type')).toBe('number')
    expect(wrapper.get('#u-password').attributes('type')).toBe('password')
    expect(wrapper.get('#u-password_confirmation').attributes('type')).toBe('password')
    expect(wrapper.get('#u-terms').attributes('type')).toBe('checkbox')

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(Object.keys(form().flatErrors)).toEqual(['name', 'email', 'password', 'password_confirmation', 'terms'])
    expect(form().flatErrors.email).toBe('We need your e-mail')
    expect(form().flatErrors.terms).toBe('Terms must be accepted')

    await wrapper.get('#u-name').setValue('Ada')
    await wrapper.get('#u-email').setValue('ada@example.com')
    await wrapper.get('#u-age').setValue('12')
    await wrapper.get('#u-password').setValue('analytical1')
    await wrapper.get('#u-password_confirmation').setValue('analytical2')
    await wrapper.get('#u-terms').setValue(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(form().flatErrors).toEqual({
      age: 'Age must be 18 or more',
      password_confirmation: 'Password confirmation must be the same as Password',
    })

    await wrapper.get('#u-age').setValue('')
    await wrapper.get('#u-password_confirmation').setValue('analytical1')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      age: null,
      password: 'analytical1',
      password_confirmation: 'analytical1',
      terms: true,
    })
  })

  it('the builder keeps going after fromModel (add / order)', () => {
    const built = signup().add('newsletter', 'checkbox').order('newsletter', 'after', 'email')
    expect(built.fields().map((f) => f.alias())).toEqual(['name', 'email', 'newsletter', 'age', 'password', 'password_confirmation', 'terms'])
  })
})

describe('update forms', () => {
  const model: FormoModel = {
    version: 1,
    name: 'u',
    fields: [
      { name: 'id', type: 'integer', readOnly: true },
      { name: 'email', type: 'string', format: 'email', required: true },
      { name: 'status', type: 'enum', readOnly: true, options: [{ value: 'active', label: 'Active' }, { value: 'banned', label: 'Banned' }] },
      { name: 'password', type: 'string', format: 'password', writeOnly: true, required: true, constraints: { minLength: 8 } },
      { name: 'password_confirmation', type: 'string', format: 'password', writeOnly: true, rules: ['confirmed:@password'] },
    ],
  }
  const record = { id: 4, email: 'ada@example.com', status: 'active', password: '$2y$10$hash' }

  it('read-only values are shown, not submitted; an empty password means "keep the current one"', async () => {
    const { wrapper, form, onSubmit } = mountForm(Formo.fromModel(model, { mode: 'update', values: record }))
    await settle()
    expect(wrapper.find('#u-id').exists()).toBe(false)
    expect(wrapper.get('#u-status').element.tagName).toBe('P')
    expect(wrapper.get('#u-status').text()).toBe('Active')
    expect((wrapper.get('#u-password').element as HTMLInputElement).value).toBe('')

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual({ email: 'ada@example.com' })

    // Typing a new password: its rules — and the confirmation's — apply again
    await wrapper.get('#u-password').setValue('short')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(Object.keys(form().flatErrors)).toEqual(['password', 'password_confirmation'])
  })

  it('toFormValues({ form }): what the form leaves out is never submitted', async () => {
    const definition = Formo.fromModel(model, { mode: 'update', except: ['status'] })
    const { onSubmit, wrapper } = mountForm(definition, toFormValues(model, record, { form: definition }))
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onSubmit.mock.calls[0][0]).toEqual({ email: 'ada@example.com' })
  })
})

describe('JavaScript off: a native post meets the same rules, and the errors come back', () => {
  const model = fromLaravel({
    name: 'user',
    rules: { email: 'required|email|unique:users', 'phones.*.number': 'required|string|max:20', password: 'nullable|min:8|confirmed' },
  })
  const record = { email: 'ada@example.com', phones: [{ number: '555 010 9999' }] }

  it('the server-rendered form posts the keys the FormRequest validates, with _token and _method', async () => {
    const app = createSSRApp(
      defineComponent({
        setup() {
          const form = useFormo(Formo.fromModel(model, { attr: { action: '/users/7', method: 'put' }, mode: 'update', values: record }), {
            config: { csrf: { token: 'server-token' } },
          })
          return () => h(FormoForm, { form })
        },
      }),
    )
    const html = await renderToString(app)
    expect(html).toContain('action="/users/7"')
    expect(html).toContain('method="post"')
    expect(html).toMatch(/<input[^>]*name="_method"[^>]*value="PUT"/)
    expect(html).toMatch(/<input[^>]*name="_token"[^>]*value="server-token"/)
    // the model's keys — not `user[email]`
    expect(html).toContain('name="email"')
    expect(html).toContain('name="phones[0][number]"')
    expect(html).toContain('name="password_confirmation"')
    expect(html).not.toContain('name="user[')
  })

  it('errors the server rendered into the page (Laravel keys) are on the fields from the start', async () => {
    const { wrapper, form } = mountForm(Formo.fromModel(model, { values: record }), undefined, {
      errors: {
        email: ['The email has already been taken.'],
        'phones.0.number': ['The phones.0.number field must not be greater than 20 characters.'],
      },
    })
    await settle()
    expect(form().flatErrors).toEqual({
      email: 'The email has already been taken.',
      'phones[0].number': 'The phones.0.number field must not be greater than 20 characters.',
    })
    expect(wrapper.text()).toContain('The email has already been taken.')
    // fixing the field clears the server's error, like any error
    await wrapper.get('#user-email').setValue('grace@example.com')
    await wrapper.get('#user-email').trigger('blur')
    await settle()
    expect(form().flatErrors.email).toBeUndefined()
  })

  it('setErrors() reads Inertia / Laravel keys, and strips a rootKey (Rails-style params)', async () => {
    const { wrapper, form } = mountForm(Formo.fromModel(model, { rootKey: 'user', values: record }))
    await settle()
    expect(wrapper.get('#user-email').attributes('name')).toBe('user[email]')
    form().setErrors({ 'user.email': 'Taken', 'user.phones.0.number': 'Too long', 'user.nope': 'Somewhere else' })
    await settle()
    expect(form().flatErrors).toMatchObject({ email: 'Taken', 'phones[0].number': 'Too long' })
    expect(form().error('user.phones.0.number')).toBe('Too long')
  })
})
