import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { z } from 'zod'
import { Formo, FormoForm, useFormo } from 'formo-vue'
import type { FormoController } from 'formo-vue'
import { RUNTIME, formFromModel, fromZod, type ModelField } from 'formo-vue/schema'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const byName = (fields: ModelField[]) => Object.fromEntries(fields.map((f) => [f.name, f]))

const User = z
  .object({
    name: z.string().min(2).meta({ title: 'Full name', description: 'As on your ID' }),
    email: z.email(),
    age: z.int().min(18).optional(),
    role: z.enum(['admin', 'editor']).default('editor'),
    bio: z.string().max(500).nullable().optional(),
    newsletter: z.boolean(),
    born: z.iso.date(),
    starts: z.date().optional(),
    password: z.string().min(8).refine((v) => /\d/.test(v), 'Add a number'),
    password_confirmation: z.string(),
    address: z.object({ street: z.string(), zip: z.string().regex(/^\d{5}$/) }),
    phones: z.array(z.object({ number: z.string().min(3) })).min(1).max(3),
  })
  .refine((u) => u.password === u.password_confirmation, { path: ['password_confirmation'], message: 'Passwords differ' })

describe('fromZod (Zod 4)', () => {
  it('reads the schema through z.toJSONSchema', () => {
    const warnings: unknown[] = []
    const model = fromZod(User, { toJSONSchema: z.toJSONSchema, name: 'user', onWarning: (w) => warnings.push(w) })
    const f = byName(model.fields)
    expect(f.name).toMatchObject({ type: 'string', label: 'Full name', description: 'As on your ID', required: true, constraints: { minLength: 2 } })
    expect(f.email).toMatchObject({ type: 'string', format: 'email', required: true })
    expect(f.email.constraints).toBeUndefined()
    expect(f.age).toMatchObject({ type: 'integer', constraints: { min: 18 } })
    expect(f.age.required).toBeUndefined()
    // a default makes it optional on input
    expect(f.role).toMatchObject({ type: 'enum', default: 'editor', options: [{ value: 'admin' }, { value: 'editor' }] })
    expect(f.role.required).toBeUndefined()
    expect(f.bio).toMatchObject({ type: 'string', nullable: true, constraints: { maxLength: 500 } })
    expect(f.newsletter).toMatchObject({ type: 'boolean', required: true })
    expect(f.born.type).toBe('date')
    // z.date() has no JSON Schema, but it's a date for a form
    expect(f.starts.type).toBe('date')
    expect(f.address).toMatchObject({ type: 'object', fields: [{ name: 'street', required: true }, { name: 'zip', constraints: { pattern: '^\\d{5}$' } }] })
    expect(f.phones).toMatchObject({ type: 'array', required: true, constraints: { minItems: 1, maxItems: 3 }, items: { type: 'object' } })
    expect(warnings).toEqual([])
  })

  it('finds the fields — and the objects — that have refinements', () => {
    expect(fromZod(User, { toJSONSchema: z.toJSONSchema })[RUNTIME]?.refine).toBeDefined()
    expect(fromZod(z.object({ a: z.string().refine(Boolean) }), { toJSONSchema: z.toJSONSchema })[RUNTIME]?.refine).toBeUndefined()
    expect(fromZod(z.object({ rows: z.array(z.object({ a: z.string() }).refine(Boolean)) }), { toJSONSchema: z.toJSONSchema })[RUNTIME]?.refine).toBeDefined()
    const f = byName(fromZod(User, { toJSONSchema: z.toJSONSchema }).fields)
    expect(f.password[RUNTIME]?.refine).toBeDefined()
    expect(f.name[RUNTIME]?.refine).toBeUndefined()
    expect(f.name[RUNTIME]?.validate).toBeDefined()
  })

  it('derived rules + the refinement, through Zod, on the real schema', async () => {
    const form = formFromModel(fromZod(User, { toJSONSchema: z.toJSONSchema }))
    const rules = form.fields!.password.rules!
    expect(rules[0]).toBe('min:8')
    const refine = rules[1] as (v: unknown, p: unknown[], c: unknown) => Promise<unknown>
    expect(await refine('abcdefgh', [], {})).toBe('Add a number')
    expect(await refine('short', [], {})).toBe('Add a number')
    expect(await refine('abcdefg1', [], {})).toBe(true)
  })

  describe('in a form', () => {
    const Signup = z
      .object({
        name: z.string().min(2),
        nickname: z.string().min(3).optional(),
        password: z.string().min(8).refine((v) => /\d/.test(v), 'Add a number'),
        password_confirmation: z.string(),
      })
      .refine((u) => u.password === u.password_confirmation, { path: ['password_confirmation'], message: 'Passwords differ' })

    function mountSignup(validation: 'derived' | 'schema' = 'derived', onRefinement?: (r: unknown) => void) {
      let form!: FormoController
      const onSubmit = vi.fn()
      const wrapper = mount(
        defineComponent({
          setup() {
            form = useFormo(Formo.fromModel(fromZod(Signup, { toJSONSchema: z.toJSONSchema, onRefinement }), { alias: 's', validation }))
            return () => h(FormoForm, { form, onSubmit })
          },
        }),
      )
      return { wrapper, form: () => form, onSubmit }
    }

    it('Formo messages first, then the field\'s refinement, then object-level refinements on the right field', async () => {
      const refinements: unknown[] = []
      const { wrapper, form, onSubmit } = mountSignup('derived', (r) => refinements.push(r))
      await settle()
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(form().flatErrors).toEqual({
        name: 'Name must not be empty',
        password: 'Password must not be empty',
        password_confirmation: 'Password confirmation must not be empty',
      })

      // an empty optional field is fine for Zod ('' is read as undefined)
      await wrapper.get('#s-name').setValue('Ada')
      await wrapper.get('#s-password').setValue('analytical')
      await wrapper.get('#s-password_confirmation').setValue('analytical')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(form().flatErrors).toEqual({ password: 'Add a number' })

      await wrapper.get('#s-password').setValue('analytical1')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(form().flatErrors).toEqual({ password_confirmation: 'Passwords differ' })
      expect(onSubmit).not.toHaveBeenCalled()

      await wrapper.get('#s-password_confirmation').setValue('analytical1')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(onSubmit).toHaveBeenCalledTimes(1)
      // where each Zod error came from
      expect(refinements).toContainEqual({ path: 'password', message: 'Add a number', level: 'field' })
      expect(refinements).toContainEqual({ path: 'password_confirmation', message: 'Passwords differ', level: 'form' })
    })

    it('schema mode: Zod is the only validator', async () => {
      const { wrapper, form } = mountSignup('schema')
      await settle()
      await wrapper.get('#s-name').setValue('A')
      await wrapper.get('#s-nickname').setValue('ab')
      await wrapper.get('form').trigger('submit')
      await settle()
      // Zod's own messages
      expect(form().flatErrors.name).toMatch(/>=\s*2|at least 2|too small/i)
      expect(form().flatErrors.nickname).toMatch(/>=\s*3|at least 3|too small/i)
      // required fields still get the marker
      expect(wrapper.find('label[for="s-name"] span[aria-hidden="true"]').exists()).toBe(true)
      expect(wrapper.find('label[for="s-nickname"] span[aria-hidden="true"]').exists()).toBe(false)
    })
  })
})
