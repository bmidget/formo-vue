import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import {
  Formo,
  FormoForm,
  csrfField,
  csrfHeaders,
  isTrustedUrl,
  laravelKeyToPath,
  sendRequest,
  useFormo,
} from 'formo-vue'
import type { FormoController } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 5; i++) {
    await flushPromises()
    await nextTick()
  }
}

function setMeta(token: string | null) {
  document.querySelector('meta[name="csrf-token"]')?.remove()
  if (token === null) return
  const meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = token
  document.head.appendChild(meta)
}

function setCookie(name: string, value: string | null) {
  document.cookie = value === null ? `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` : `${name}=${value}; path=/`
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A tiny fake Laravel: checks X-XSRF-TOKEN / X-CSRF-TOKEN like VerifyCsrfToken */
function fakeLaravel(opts: { sessionToken: () => string; handler?: (body: any, init: RequestInit) => Response }) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    if (url.endsWith('/sanctum/csrf-cookie')) {
      setCookie('XSRF-TOKEN', encodeURIComponent(`enc:${opts.sessionToken()}`))
      return new Response(null, { status: 204 })
    }
    const headers = init.headers as Record<string, string>
    const raw = headers['X-CSRF-TOKEN']
    const xsrf = headers['X-XSRF-TOKEN']?.replace(/^enc:/, '')
    const token = raw ?? xsrf
    if (token !== opts.sessionToken()) return json(419, { message: 'CSRF token mismatch.' })
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    return opts.handler ? opts.handler(body, init) : json(200, { saved: body })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

beforeEach(() => {
  setMeta(null)
  setCookie('XSRF-TOKEN', null)
})
afterEach(() => {
  setMeta(null)
  setCookie('XSRF-TOKEN', null)
})

describe('csrf tokens', () => {
  it('reads the raw token from <meta name="csrf-token"> and the XSRF-TOKEN cookie (URL-decoded)', async () => {
    setMeta('raw123')
    setCookie('XSRF-TOKEN', encodeURIComponent('eyJpdiI6=='))
    expect(await csrfHeaders('laravel', { url: '/api/x' })).toEqual({
      'X-CSRF-TOKEN': 'raw123',
      'X-XSRF-TOKEN': 'eyJpdiI6==',
    })
  })

  it('never sends tokens to untrusted origins', async () => {
    setMeta('raw123')
    expect(await csrfHeaders('laravel', { url: 'https://evil.example.com/steal' })).toEqual({})
    expect(await csrfField('laravel', { url: 'https://evil.example.com/steal' })).toBeNull()
    // …unless allowed via baseUrl or origins
    expect(isTrustedUrl('https://api.example.com/x', { origins: [] }, 'https://api.example.com')).toBe(true)
    expect(isTrustedUrl('https://api.example.com/x', { origins: ['https://api.example.com'] })).toBe(true)
    expect(isTrustedUrl('https://api.example.com.evil.io/x', { origins: ['https://api.example.com'] })).toBe(false)
  })

  it('can be disabled (stateless token APIs) or given an explicit/async token', async () => {
    setMeta('raw123')
    expect(await csrfHeaders(false, { url: '/api/x' })).toEqual({})
    expect(await csrfHeaders({ token: async () => 'from-fn', meta: false, cookie: false }, { url: '/x' })).toEqual({
      'X-CSRF-TOKEN': 'from-fn',
    })
  })

  it('sanctum: primes /sanctum/csrf-cookie when there is no token yet', async () => {
    const server = fakeLaravel({ sessionToken: () => 'S1' })
    const response = await sendRequest('/api/profile', { csrf: 'sanctum', fetch: server.fetch, values: { name: 'Ann' } })
    expect(server.calls.map((c) => c.url)).toEqual(['/sanctum/csrf-cookie', '/api/profile'])
    expect(server.calls[0].init.credentials).toBe('include')
    expect((server.calls[1].init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('enc:S1')
    expect(response.ok).toBe(true)
    expect(response.data).toEqual({ saved: { name: 'Ann' } })
  })

  it('sanctum: on 419, refreshes the cookie and retries once — ignoring a stale meta token', async () => {
    let token = 'OLD'
    const server = fakeLaravel({ sessionToken: () => token })
    setMeta('OLD')
    setCookie('XSRF-TOKEN', 'enc:OLD')
    token = 'NEW' // session rotated server side
    const response = await sendRequest('/api/profile', { csrf: 'sanctum', fetch: server.fetch })
    expect(server.calls.map((c) => c.url)).toEqual(['/api/profile', '/sanctum/csrf-cookie', '/api/profile'])
    const retryHeaders = server.calls[2].init.headers as Record<string, string>
    expect(retryHeaders['X-CSRF-TOKEN']).toBeUndefined()
    expect(retryHeaders['X-XSRF-TOKEN']).toBe('enc:NEW')
    expect(response.status).toBe(200)

    // The stale meta token isn't sent anymore: no more 419 round trips
    server.calls.length = 0
    await sendRequest('/api/profile', { csrf: 'sanctum', fetch: server.fetch })
    expect(server.calls.map((c) => c.url)).toEqual(['/api/profile'])
    expect((server.calls[0].init.headers as Record<string, string>)['X-CSRF-TOKEN']).toBeUndefined()
    // …until the page has a new one
    setMeta('NEW')
    expect(await csrfHeaders('sanctum', { url: '/api/x' })).toMatchObject({ 'X-CSRF-TOKEN': 'NEW' })
  })

  it('laravel preset (no prime): a 419 is returned as-is, without a pointless retry', async () => {
    const server = fakeLaravel({ sessionToken: () => 'NEW' })
    setMeta('OLD')
    const response = await sendRequest('/api/profile', { csrf: 'laravel', fetch: server.fetch })
    expect(server.calls).toHaveLength(1)
    expect(response.status).toBe(419)
  })
})

describe('sendRequest (Laravel conventions)', () => {
  it('sends JSON with Accept/X-Requested-With, and FormData + _method spoofing when there are files', async () => {
    const fetch = vi.fn(async () => json(200, {})) as unknown as typeof globalThis.fetch
    await sendRequest('/api/a', { method: 'put', values: { a: 1 }, fetch, csrf: false })
    const [, jsonInit] = (fetch as any).mock.calls[0]
    expect(jsonInit.method).toBe('PUT')
    expect(jsonInit.headers).toMatchObject({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' })
    expect(jsonInit.body).toBe('{"a":1}')

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await sendRequest('/api/a', {
      method: 'patch',
      values: { name: 'Ann', active: true, address: { zip: '123' }, phones: [{ n: '5' }], avatar: file },
      fetch,
      csrf: false,
    })
    const [, formInit] = (fetch as any).mock.calls[1]
    const body = formInit.body as FormData
    expect(formInit.method).toBe('POST')
    expect(body.get('_method')).toBe('PATCH')
    expect(body.get('active')).toBe('1')
    expect(body.get('address[zip]')).toBe('123')
    expect(body.get('phones[0][n]')).toBe('5')
    expect((body.get('avatar') as File).name).toBe('a.png')
  })

  it('maps Laravel 422 error keys to form paths', () => {
    expect(laravelKeyToPath('phones.0.number')).toBe('phones[0].number')
    expect(laravelKeyToPath('user.address.zip', 'user')).toBe('address.zip')
  })
})

describe('forms + requests', () => {
  it('form.request(): 422 errors land on fields, unknown keys on the form', async () => {
    setMeta('T')
    const server = fakeLaravel({
      sessionToken: () => 'T',
      handler: () =>
        json(422, {
          message: 'The email has already been taken. (and 2 more errors)',
          errors: {
            email: ['The email has already been taken.'],
            'phones.0.number': ['The phone number is invalid.'],
            plan: ['Your plan does not allow this.'],
          },
        }),
    })
    let form!: FormoController
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo(
            Formo.form({ alias: 'f' })
              .add('email')
              .add(Formo.group('phones').add('number').padBlueprint([{ number: 'x' }])),
            { config: { request: { fetch: server.fetch } } },
          )
          return () => h(FormoForm, { form })
        },
      }),
    )
    await settle()
    const response = await form.request('/api/profile')
    await settle()
    expect(response.status).toBe(422)
    expect(form.flatErrors).toEqual({
      email: 'The email has already been taken.',
      'phones[0].number': 'The phone number is invalid.',
      '': 'Your plan does not allow this.',
    })
    expect(wrapper.text()).toContain('The phone number is invalid.')
  })

  it('a form with attr.action and no @submit sends itself; @success / @rejected get the outcome', async () => {
    setMeta('T')
    const server = fakeLaravel({ sessionToken: () => 'T' })
    const onSuccess = vi.fn()
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ alias: 'p', attr: { action: '/api/profile', method: 'put' } }).add('name', 'input', 'Ann'),
        config: { request: { fetch: server.fetch } },
        onSuccess,
      },
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(server.calls[0].init.method).toBe('PUT')
    expect(onSuccess).toHaveBeenCalledWith(
      { saved: { name: 'Ann' } },
      expect.objectContaining({ result: 'success', response: expect.objectContaining({ status: 200 }) }),
    )
  })

  it('a 419 that survives the retry shows a "session expired" form error', async () => {
    const server = fakeLaravel({ sessionToken: () => 'never-matches' })
    setMeta('T')
    const onRejected = vi.fn()
    const wrapper = mount(FormoForm, {
      props: {
        form: Formo.form({ attr: { action: '/api/x' } }).add('name', 'input', 'Ann'),
        config: { request: { fetch: server.fetch } },
        onRejected,
      },
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(onRejected).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'rejected', reason: 'session', response: expect.objectContaining({ status: 419 }) }),
    )
    expect(wrapper.get('form [role="alert"]').text()).toBe('Your session has expired. Please refresh the page and try again.')
  })

  it('native forms get hidden _token (from the meta tag) and _method fields', async () => {
    setMeta('blade-token')
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
    const wrapper = mount(FormoForm, {
      props: {
        native: true,
        form: Formo.form({ alias: 'u', attr: { action: '/profile', method: 'put' } }).add('name', 'input', 'Ann'),
      },
    })
    await settle()
    const form = wrapper.get('form')
    expect(form.attributes('method')).toBe('post')
    expect(wrapper.get('input[name="_method"]').attributes('value')).toBe('PUT')
    expect(wrapper.get('input[name="_token"]').attributes('value')).toBe('blade-token')

    setMeta('rotated-token') // the token is re-read right before submitting
    await form.trigger('submit')
    await settle()
    expect(wrapper.get('input[name="_token"]').attributes('value')).toBe('rotated-token')
    expect(submit).toHaveBeenCalledTimes(1)
    submit.mockRestore()
  })

  it('native forms posting to another origin never get the token', async () => {
    setMeta('blade-token')
    const wrapper = mount(FormoForm, {
      props: { native: true, form: Formo.form({ attr: { action: 'https://elsewhere.example.com/hook' } }).add('a') },
    })
    await settle()
    expect(wrapper.find('input[name="_token"]').exists()).toBe(false)
  })
})

describe('options passed to <FormoForm> reach the controller', () => {
  it('request() uses <FormoForm :config> even with an external useFormo() controller', async () => {
    const server = fakeLaravel({ sessionToken: () => 'S' })
    let form!: FormoController
    mount(
      defineComponent({
        setup() {
          form = useFormo(Formo.form().add('name', 'input', 'Ann'))
          return () => h(FormoForm, { form, config: { csrf: 'sanctum', request: { fetch: server.fetch } } })
        },
      }),
    )
    await settle()
    const response = await form.request('/api/profile')
    expect(server.calls.map((c) => c.url)).toEqual(['/sanctum/csrf-cookie', '/api/profile'])
    expect(response.ok).toBe(true)
  })

  it('group rules can use rules passed with <FormoForm :rules>', async () => {
    let form!: FormoController
    mount(
      defineComponent({
        setup() {
          form = useFormo(Formo.form({ rules: ['never'] }).add('a', 'input', 'x'))
          return () => h(FormoForm, { form, rules: { never: () => 'Nope' } })
        },
      }),
    )
    await settle()
    expect(await form.validate()).toBe(false)
    expect(form.errors).toEqual({ ':self': 'Nope' })
  })
})
