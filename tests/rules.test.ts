import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { builtinRules, defaultConfig, normalize, defaultDrivers, parseRules, runRules } from 'formo-vue'
import type { FormoController, FieldNode, RuleSpec } from 'formo-vue'

const node = (def: Record<string, unknown> = {}): FieldNode =>
  normalize({ alias: 'field', ...def }, { drivers: defaultDrivers }, false)

async function check(specs: RuleSpec[], value: unknown, opts: { values?: Record<string, any>; node?: FieldNode; label?: string } = {}) {
  const n = opts.node ?? node()
  return runRules(
    specs,
    value,
    {
      node: n,
      path: String(n.alias),
      alias: n.alias,
      label: opts.label ?? 'Field',
      values: opts.values ?? {},
      parentValues: opts.values ?? {},
      form: {} as FormoController,
    },
    { rules: builtinRules, config: defaultConfig, labelFor: (p) => `<${p}>` },
  )
}

describe('parseRules', () => {
  it('parses vee strings', () => {
    expect(parseRules('required|min:3|between:1,10').specs).toEqual([
      { name: 'required', params: [] },
      { name: 'min', params: ['3'] },
      { name: 'between', params: ['1', '10'] },
    ])
  })

  it('parses tuples (a list, and a single one)', () => {
    const list = parseRules([['required'], ['min', [3]]]).specs
    expect(list).toEqual([
      { name: 'required', params: [] },
      { name: 'min', params: [3] },
    ])

    const single = parseRules(['between', [1, 10]] as any).specs
    expect(single).toEqual([{ name: 'between', params: [1, 10] }])
  })

  it('parses vee object notation', () => {
    expect(parseRules({ required: true, min: 3, between: [1, 5], email: false }).specs).toEqual([
      { name: 'required', params: [] },
      { name: 'min', params: [3] },
      { name: 'between', params: [1, 5] },
    ])
  })

  it('accepts functions and standard schemas', () => {
    const fn = (v: unknown) => !!v
    const specs = parseRules([fn, z.string()]).specs
    expect(specs[0].fn).toBe(fn)
    expect(specs[1].schema).toBeDefined()
  })
})

describe('runRules', () => {
  it('runs tuples and formats messages', async () => {
    const { specs } = parseRules([['required'], ['min', [3]]])
    expect(await check(specs, '')).toEqual(['Field must not be empty'])
    expect(await check(specs, 'ab')).toEqual(['Field must be at least 3 characters long'])
    expect(await check(specs, 'abc')).toEqual([])
  })

  it('reads delimited regex strings (Laravel `regex:/…/i`)', async () => {
    const { specs } = parseRules([['regex', ['/^\\d{4}$/']]])
    expect(await check(specs, '12a4')).toHaveLength(1)
    expect(await check(specs, '1234')).toEqual([])
  })

  it('resolves @field references (confirmed) with labels in messages', async () => {
    const { specs } = parseRules('confirmed:@password')
    expect(await check(specs, 'secret', { values: { password: 'secret' } })).toEqual([])
    expect(await check(specs, 'nope', { values: { password: 'secret' } })).toEqual([
      'Field must be the same as <password>',
    ])
  })

  it('matches:@field — equal to another field (Laravel `same`)', async () => {
    const { specs } = parseRules('matches:@password')
    const n = node({ alias: 'confirm' })
    expect(await check(specs, 'a', { node: n, values: { password: 'a', confirm: 'a' } })).toEqual([])
    expect(await check(specs, 'b', { node: n, values: { password: 'a', confirm: 'b' } })).toEqual([
      'Field must be the same as <password>',
    ])
  })

  it('uses per-field and global message overrides', async () => {
    const n = node({ errorMessages: { required: 'Tell us :field!' } })
    expect(await check(parseRules('required').specs, '', { node: n })).toEqual(['Tell us Field!'])
  })

  it('runs custom functions (string = message) and async rules', async () => {
    const specs = parseRules([
      (v: string) => v !== 'admin' || 'That name is reserved',
      async (v: string) => v.length < 10,
    ]).specs
    expect(await check(specs, 'admin')).toEqual(['That name is reserved'])
    expect(await check(specs, 'waytoolongname')).toEqual(['Field is invalid'])
  })

  it('runs zod (Standard Schema)', async () => {
    const specs = parseRules(z.string().min(3, 'Too short!')).specs
    expect(await check(specs, 'ab')).toEqual(['Too short!'])
    expect(await check(specs, 'abc')).toEqual([])
  })

  it('validates html5 number attributes (html5_range)', async () => {
    const n = node({ driver: 'input|number', attr: { min: 1, max: 10, step: 2 } })
    const specs = parseRules('html5_range').specs
    expect(await check(specs, 5, { node: n })).toEqual([])
    expect(await check(specs, 4, { node: n })).toHaveLength(1)
    expect(await check(specs, 11, { node: n })).toEqual(['Field must be between 1 and 10'])
  })

  it('bails on the first failure', async () => {
    expect(await check(parseRules('required|email').specs, '')).toHaveLength(1)
  })

  it('throws a helpful error for unknown rules', async () => {
    await expect(check(parseRules('nope').specs, 'x')).rejects.toThrow(/Unknown validation rule "nope"/)
  })
})
