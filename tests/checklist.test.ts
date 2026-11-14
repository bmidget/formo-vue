import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Formo, FormoForm, builtinRules } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 5; i++) {
    await flushPromises()
    await nextTick()
  }
}

const items = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-formo-checklist] li').map((li) => `${li.attributes('data-passed') === 'true' ? '✓' : '✗'} ${li.text().replace(/^(Met|Not met):\s*/, '')}`)

describe('password rules (Laravel Password::…)', () => {
  it('mixed_case / letters / numbers / symbols', () => {
    const ctx = {} as any
    expect(builtinRules.mixed_case('abc', [], ctx)).toBe(false)
    expect(builtinRules.mixed_case('aBc', [], ctx)).toBe(true)
    expect(builtinRules.letters('1234', [], ctx)).toBe(false)
    expect(builtinRules.numbers('abc1', [], ctx)).toBe(true)
    expect(builtinRules.symbols('abc', [], ctx)).toBe(false)
    expect(builtinRules.symbols('ab!c', [], ctx)).toBe(true)
  })
})

describe('errorDisplay: checklist', () => {
  const password = () =>
    Formo.form({ alias: 'f' }).add('password', 'input|password', {
      checklist: true,
      rules: 'required|min:8|mixed_case|numbers|symbols',
    })

  it('lists every requirement as unmet (✗) while empty, and updates live as you type', async () => {
    const wrapper = mount(FormoForm, { props: { form: password() } })
    await settle()
    expect(items(wrapper)).toEqual([
      '✗ At least 8 characters',
      '✗ Uppercase and lowercase letters',
      '✗ At least one number',
      '✗ At least one symbol',
    ])
    // Grey (unmet, not yet validated) rather than red
    expect(wrapper.get('[data-formo-checklist] li').classes()).toContain('text-slate-500')

    await wrapper.get('#f-password').setValue('abcdefgH')
    await settle()
    expect(items(wrapper)).toEqual([
      '✓ At least 8 characters',
      '✓ Uppercase and lowercase letters',
      '✗ At least one number',
      '✗ At least one symbol',
    ])

    await wrapper.get('#f-password').setValue('abcdefgH1!')
    await settle()
    expect(items(wrapper).every((i) => i.startsWith('✓'))).toBe(true)
  })

  it('links the list to the input, turns unmet items red after a failed submit, and avoids duplicate messages', async () => {
    const wrapper = mount(FormoForm, { props: { form: password() } })
    await settle()
    expect(wrapper.get('#f-password').attributes('aria-describedby')).toContain('f-password-checklist')

    await wrapper.get('form').trigger('submit')
    await settle()
    // `required` isn't in the list, so its message is shown on its own…
    expect(wrapper.findAll('[role="alert"]').map((e) => e.text())).toEqual(['Password must not be empty'])
    expect(wrapper.get('[data-formo-checklist] li').classes()).toContain('text-rose-600')

    await wrapper.get('#f-password').setValue('short')
    await wrapper.get('form').trigger('submit')
    await settle()
    // …but failures that the checklist already shows aren't repeated
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(items(wrapper)[0]).toBe('✗ At least 8 characters')
  })

  it('uses explicit labels, per-field requirements and cross-field refs', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ alias: 'f' })
          .add('password', 'input|password', 'Secret1!')
          .add('confirm', 'input|password', {
            errorDisplay: 'checklist',
            requirements: { min: 'Eight or more characters' },
            rules: [
              'min:8',
              { rule: 'regex', params: [/^\S*$/], label: 'No spaces' },
              'confirmed:@password',
            ],
          }),
      },
    })
    await wrapper.get('#f-confirm').setValue('Secret1 ')
    await settle()
    expect(items(wrapper)).toEqual(['✓ Eight or more characters', '✗ No spaces', '✗ Matches Password'])
    await wrapper.get('#f-confirm').setValue('Secret1!')
    await settle()
    expect(items(wrapper)).toEqual(['✓ Eight or more characters', '✓ No spaces', '✓ Matches Password'])
  })
})

describe('errorDisplay: all / first', () => {
  it('`all` lists every failing message, `first` (default) only the first', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ alias: 'f' })
          .add('a', { val: 'x', rules: 'min:3|numeric', errorDisplay: 'all' })
          .add('b', { val: 'x', rules: 'min:3|numeric' }),
      },
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.findAll('[data-formo-path="a"] li').map((l) => l.text())).toEqual([
      'A must be at least 3 characters long',
      'A must contain only digits',
    ])
    expect(wrapper.findAll('[data-formo-path="b"] [role="alert"]').map((l) => l.text())).toEqual([
      'B must be at least 3 characters long',
    ])
  })

  it('cascades from config', async () => {
    const wrapper = mount(FormoForm, {
      props: { form: Formo.form().add('pin', { rules: 'required|digits:4' }), config: { errorDisplay: 'checklist' } },
    })
    await settle()
    expect(wrapper.findAll('[data-formo-checklist] li').map((l) => l.text())).toEqual(['Not met: Exactly 4 digits'])
  })
})

describe('messages of labelled custom rules', () => {
  it('fall back to the requirement label instead of ":field is invalid"', async () => {
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ alias: 'f' }).add('pin', {
          val: '1123',
          rules: [{ rule: (v: string) => !/(\d)\1/.test(v), label: 'No digit twice in a row' }],
        }),
      },
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toBe('No digit twice in a row')
  })
})
