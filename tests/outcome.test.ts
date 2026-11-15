import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Formo, FormoForm, useFormo } from 'formo-vue'
import type { FormoController, FormoOutcome, FormoSubmitContext, UseFormoOptions } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

/** A fetch answering with a status and a JSON body */
function server(status: number, body: unknown = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const definition = () =>
  Formo.form({ alias: 'p', attr: { action: '/api/profile', method: 'put' } })
    .add('name', { required: true, val: 'Ann' })
    .add('email', 'input|email', { val: 'ann@example.com' })

/** <FormoForm> with every outcome event spied */
function mountForm(
  props: { onSubmit?: (values: Record<string, any>, ctx: FormoSubmitContext) => unknown; fetch?: typeof fetch; values?: Record<string, any> } = {},
) {
  const events = { onSuccess: vi.fn(), onInvalid: vi.fn(), onRejected: vi.fn(), onSettled: vi.fn() }
  let form!: FormoController
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition(), { initialValues: props.values })
        return () =>
          h(FormoForm, {
            form,
            config: { csrf: false, request: props.fetch ? { fetch: props.fetch } : {} },
            ...(props.onSubmit ? { onSubmit: props.onSubmit } : {}),
            ...events,
          })
      },
    }),
  )
  const submit = async () => {
    await wrapper.get('form').trigger('submit')
    await settle()
  }
  return { wrapper, form: () => form, events, submit }
}

const outcomeOf = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls[0].at(-1) as FormoOutcome

describe('submit outcomes: @success / @invalid / @rejected / @settled', () => {
  afterEach(() => vi.restoreAllMocks())

  it('success: a self-submitting form (attr.action) — the response\'s data', async () => {
    const api = server(200, { data: { id: 7 } })
    const { events, submit, form } = mountForm({ fetch: api.fetch })
    await submit()
    expect(api.calls[0].init.method).toBe('PUT')
    expect(events.onSuccess).toHaveBeenCalledTimes(1)
    expect(events.onSuccess.mock.calls[0][0]).toEqual({ data: { id: 7 } })
    expect(outcomeOf(events.onSuccess)).toMatchObject({ result: 'success', values: { name: 'Ann' }, response: { status: 200 }, errors: {} })
    expect(events.onRejected).not.toHaveBeenCalled()
    expect(events.onSettled).toHaveBeenCalledWith(expect.objectContaining({ result: 'success' }))
    expect(form().outcome?.result).toBe('success')
  })

  it('invalid: the browser stopped it — nothing sent, no handler, @invalid then @settled', async () => {
    const onSubmit = vi.fn()
    const { events, submit, wrapper } = mountForm({ onSubmit })
    await wrapper.get('#p-name').setValue('')
    await submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(events.onInvalid).toHaveBeenCalledWith({ name: 'Name must not be empty' }, expect.objectContaining({ result: 'invalid' }))
    expect(outcomeOf(events.onSettled)).toEqual({ result: 'invalid', errors: { name: 'Name must not be empty' } })
    expect(events.onSuccess).not.toHaveBeenCalled()
    expect(events.onRejected).not.toHaveBeenCalled()
  })

  it('rejected (validation): @submit used ctx.request() and the server answered 422 — errors on the fields', async () => {
    const api = server(422, { message: 'The email has already been taken.', errors: { email: ['The email has already been taken.'] } })
    const { events, submit, form } = mountForm({
      fetch: api.fetch,
      // returns nothing: the request made through ctx counts
      onSubmit: async (_values, { request }) => {
        await request()
      },
    })
    await submit()
    const outcome = outcomeOf(events.onRejected)
    expect(outcome).toMatchObject({ result: 'rejected', reason: 'validation', response: { status: 422 } })
    expect(outcome.errors).toEqual({ email: 'The email has already been taken.' })
    expect(form().flatErrors.email).toBe('The email has already been taken.')
    expect(events.onSuccess).not.toHaveBeenCalled()
  })

  it('rejected (session / server): 419 and 500, with a form-level message', async () => {
    for (const [status, reason] of [[419, 'session'], [500, 'server']] as const) {
      const { events, submit, form } = mountForm({ fetch: server(status, { message: 'x' }).fetch })
      await submit()
      expect(outcomeOf(events.onRejected)).toMatchObject({ result: 'rejected', reason })
      expect(form().flatErrors['']).toBeTruthy()
    }
  })

  it('a request made with form.request() inside the handler counts too, and so does a returned response', async () => {
    const viaForm = mountForm({
      fetch: server(422, { errors: { name: ['Taken'] } }).fetch,
      onSubmit: async () => {
        await viaForm.form().request()
      },
    })
    await viaForm.submit()
    expect(outcomeOf(viaForm.events.onRejected)).toMatchObject({ reason: 'validation' })

    const returned = mountForm({ fetch: server(201, { id: 9 }).fetch, onSubmit: (_v, { request }) => request() })
    await returned.submit()
    expect(returned.events.onSuccess).toHaveBeenCalledWith({ id: 9 }, expect.objectContaining({ result: 'success' }))
  })

  it('rejected (handler): @submit returned false, or called reject()', async () => {
    const refused = mountForm({ onSubmit: () => false })
    await refused.submit()
    expect(outcomeOf(refused.events.onRejected)).toMatchObject({ result: 'rejected', reason: 'handler', errors: {} })

    const message = mountForm({ onSubmit: (_v, { reject }) => reject('Your plan does not allow this') })
    await message.submit()
    expect(outcomeOf(message.events.onRejected)).toMatchObject({ reason: 'validation', errors: { '': 'Your plan does not allow this' } })

    const fields = mountForm({ onSubmit: (_v, { reject }) => reject({ 'emails.0': 'x', email: ['Blocked domain'] }) })
    await fields.submit()
    expect(outcomeOf(fields.events.onRejected).errors.email).toBe('Blocked domain')
  })

  it('rejected (error): the handler threw — a form-level message, no unhandled rejection', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new TypeError('Failed to fetch')
    const { events, submit, form } = mountForm({
      onSubmit: async () => {
        throw boom
      },
    })
    await submit()
    expect(outcomeOf(events.onRejected)).toMatchObject({ result: 'rejected', reason: 'error', error: boom })
    expect(form().flatErrors['']).toBe('Something went wrong. Please try again.')
    expect(form().submitting).toBe(false)
    expect(await form().submit()).toBe(false)
    expect(error).toHaveBeenCalled()
  })

  it('callback APIs (Inertia\'s router): return a promise — the outcome waits for it; errors set meanwhile reject', async () => {
    /** Shaped like Inertia's router.put: returns nothing, reports through callbacks later */
    const router = {
      put(_url: string, _data: unknown, callbacks: { onSuccess?: () => void; onError?: (errors: Record<string, string>) => void }) {
        setTimeout(() => (_data as any).email.includes('taken') ? callbacks.onError?.({ email: 'The email has already been taken.' }) : callbacks.onSuccess?.(), 20)
      },
    }
    const save = (values: Record<string, any>, { setErrors }: FormoSubmitContext) =>
      new Promise<boolean>((resolve) =>
        router.put('/users/7', values, {
          onSuccess: () => resolve(true),
          onError: (errors) => {
            setErrors(errors)
            resolve(false)
          },
        }),
      )

    const bad = mountForm({ onSubmit: save, values: { email: 'taken@example.com' } })
    await bad.wrapper.get('form').trigger('submit')
    expect(bad.form().submitting).toBe(true) // still waiting for the router
    await new Promise((r) => setTimeout(r, 40))
    await settle()
    expect(bad.form().submitting).toBe(false)
    expect(outcomeOf(bad.events.onRejected)).toMatchObject({ reason: 'validation', errors: { email: 'The email has already been taken.' } })

    const good = mountForm({ onSubmit: save })
    await good.wrapper.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r, 40))
    await settle()
    expect(good.events.onSuccess).toHaveBeenCalledTimes(1)
  })

  it('what @submit returns is the success data', async () => {
    const { events, submit } = mountForm({ onSubmit: async (values) => ({ saved: values.name }) })
    await submit()
    expect(events.onSuccess).toHaveBeenCalledWith({ saved: 'Ann' }, expect.objectContaining({ result: 'success' }))
  })

  it('a second submit while one is in flight is the same submit (no double posts)', async () => {
    let release!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const { form, events } = mountForm({ onSubmit })
    await settle()
    const first = form().submit()
    const second = form().submit()
    expect(second).toBe(first)
    await settle()
    release()
    expect(await first).toBe(true)
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(events.onSettled).toHaveBeenCalledTimes(1)
  })

  it('form.submit() resolves to whether it succeeded (not just whether it was valid)', async () => {
    const { form } = mountForm({ fetch: server(422, { errors: { name: ['No'] } }).fetch })
    await settle()
    expect(await form().submit()).toBe(false)
    expect(form().outcome).toMatchObject({ result: 'rejected', reason: 'validation' })
  })

  it('without <FormoForm>: useFormo(…, { onSuccess, onRejected, onSettled }) and form.submit(handler)', async () => {
    const handlers: UseFormoOptions = { onSuccess: vi.fn(), onRejected: vi.fn(), onSettled: vi.fn() }
    let form!: FormoController
    mount(
      defineComponent({
        setup() {
          form = useFormo(Formo.form({ alias: 'x' }).add('name', { val: 'Ann' }), handlers)
          return () => h(FormoForm, { form })
        },
      }),
    )
    await settle()
    await form.submit(() => false)
    expect(handlers.onRejected).toHaveBeenCalledWith(expect.objectContaining({ reason: 'handler' }))
    await form.submit(() => 'done')
    expect(handlers.onSuccess).toHaveBeenCalledWith('done', expect.objectContaining({ result: 'success' }))
    expect(handlers.onSettled).toHaveBeenCalledTimes(2)
  })

  it('@failure still works (deprecated alias of @rejected)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onFailure = vi.fn()
    const wrapper = mount(FormoForm, {
      props: { form: definition(), config: { csrf: false, request: { fetch: server(500).fetch } }, onFailure },
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ result: 'rejected', reason: 'server' }))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@rejected'))
  })
})
