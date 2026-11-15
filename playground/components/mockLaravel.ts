/**
 * (Playground only) A fake Laravel backend that runs in the browser — a `fetch`
 * to give `form.request()`. It answers like a controller with a FormRequest:
 *
 *  - validates the body against the same Formo model the form came from —
 *    required, lengths, formats, options, `confirmed`, and the server-only rules
 *    the browser never runs (`unique`, custom rules like `username_available`)
 *  - 201 Created / 200 OK with the saved record, or 422 with Laravel's
 *    `{ message, errors: { 'phones.0.number': [...] } }`
 *  - or, on demand, 419 (CSRF token mismatch) / 500
 *
 * Like Laravel, PUT / PATCH only validate the keys that were sent (`sometimes`).
 */
import type { FormoModel, ModelField } from 'formo-vue/schema'

export type ServerBehaviour = 'validate' | 'accept' | 'expired' | 'crash'

export interface Exchange {
  request: { method: string; url: string; headers: Record<string, string>; body: unknown }
  response: { status: number; body: unknown }
  ms: number
}

export interface MockLaravelOptions {
  model: FormoModel
  /** Read at request time: switch it without rebuilding the form */
  behaviour: () => ServerBehaviour
  /** The record being edited: `unique` ignores its own values (Laravel's `unique:users,email,{id}`) */
  current?: Record<string, unknown>
  onExchange: (exchange: Exchange) => void
}

/** Values some other user already has */
export const TAKEN = ['taken@example.com', 'admin@example.com', 'admin', 'root', 'ben', 'formo']

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** PHP bracket names back into nested data: `phones[0][number]`, `tags[]` */
function fromFormData(data: FormData): Record<string, unknown> {
  const out: Record<string, any> = {}
  for (const [name, raw] of data.entries()) {
    // An empty file input posts a nameless, empty file: no file
    const value = typeof raw === 'string' ? raw : raw.name ? `📎 ${raw.name}` : ''
    const segments = name.split('[').map((segment, i) => (i === 0 ? segment : segment.replace(/\]$/, '')))
    let target: any = out
    segments.forEach((segment, i) => {
      const last = i === segments.length - 1
      if (segment === '' && Array.isArray(target)) {
        // `tags[]`: one more item
        if (last) target.push(value)
        return
      }
      const key = /^\d+$/.test(segment) ? Number(segment) : segment
      if (last) {
        target[key] = value
        return
      }
      const next = segments[i + 1]
      target[key] ??= next === '' || /^\d+$/.test(next) ? [] : {}
      target = target[key]
    })
  }
  return out
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const ACCEPTED = [true, 1, '1', 'true', 'on', 'yes']

/** A small FormRequest: Laravel's messages, keys like `phones.0.number` */
function validate(
  fields: ModelField[],
  data: Record<string, any>,
  prefix: string,
  partial: boolean,
  current: Record<string, unknown>,
  errors: Record<string, string[]>,
) {
  const startOfToday = new Date(new Date().toDateString())
  for (const field of fields) {
    if (field.readOnly || field.fillable === false) continue
    const key = prefix ? `${prefix}.${field.name}` : field.name
    const present = !!data && field.name in data
    if (partial && !present) continue
    const value = data?.[field.name]
    // An update request has `nullable` on passwords: empty means "keep the current one"
    if (partial && field.writeOnly && isEmpty(value)) continue
    const attribute = (field.label ?? field.name.replace(/_/g, ' ')).toLowerCase()
    const fail = (message: string) => (errors[key] ??= []).push(message)

    if (field.type === 'object') {
      validate(field.fields ?? [], value ?? {}, key, partial, {}, errors)
      continue
    }
    if (field.type === 'array' && field.items?.type === 'object') {
      if (field.required && isEmpty(value)) fail(`The ${attribute} field is required.`)
      const rows = Array.isArray(value) ? value : []
      if (field.constraints?.maxItems !== undefined && rows.length > field.constraints.maxItems) {
        fail(`The ${attribute} field must not have more than ${field.constraints.maxItems} items.`)
      }
      rows.forEach((row, i) => validate(field.items!.fields ?? [], row ?? {}, `${key}.${i}`, false, {}, errors))
      continue
    }
    if (field.constraints?.accepted) {
      if (!ACCEPTED.includes(value as never)) fail(`The ${attribute} field must be accepted.`)
      continue
    }
    if (isEmpty(value)) {
      if (field.required && field.type !== 'boolean') fail(`The ${attribute} field is required.`)
      continue
    }

    const text = String(value)
    const c = field.constraints ?? {}
    if (field.format === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) fail(`The ${attribute} field must be a valid email address.`)
    if (field.type === 'string' || field.type === 'text') {
      if (c.minLength !== undefined && text.length < c.minLength) fail(`The ${attribute} field must be at least ${c.minLength} characters.`)
      if (c.maxLength !== undefined && text.length > c.maxLength) fail(`The ${attribute} field must not be greater than ${c.maxLength} characters.`)
    }
    if ((field.type === 'integer' || field.type === 'number') && Number.isNaN(Number(text))) fail(`The ${attribute} field must be a number.`)
    if (field.type === 'enum' && field.options?.length && !field.options.some((o) => String(o.value) === text)) {
      fail(`The selected ${attribute} is invalid.`)
    }
    for (const rule of field.rules ?? []) {
      const written = typeof rule === 'string' ? rule : `${rule.rule}:${(rule.params ?? []).join(',')}`
      const other = written.match(/^(?:confirmed|matches):@(.+)$/)?.[1]
      // Laravel reports a failed confirmation on the confirmed field itself
      if (other && text !== String(data?.[other] ?? '')) (errors[prefix ? `${prefix}.${other}` : other] ??= []).push(`The ${other.replace(/_/g, ' ')} field confirmation does not match.`)
    }
    for (const rule of field.serverRules ?? []) {
      const [name, params = ''] = rule.split(/:(.*)/s)
      const mine = text === String(current[field.name] ?? '')
      if ((name === 'unique' || name === 'username_available') && TAKEN.includes(text.toLowerCase()) && !mine) {
        fail(`The ${attribute} has already been taken.`)
      }
      if (name === 'before' && params === 'today' && !(new Date(text) < startOfToday)) fail(`The ${attribute} field must be a date before today.`)
      if (name === 'after' && params === 'today' && !(new Date(text) > startOfToday)) fail(`The ${attribute} field must be a date after today.`)
    }
  }
}

/** What the server would store and send back: no passwords, no files */
function saved(body: Record<string, unknown>, id: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { id }
  for (const [key, value] of Object.entries(body)) {
    if (/password/.test(key) || (typeof value === 'string' && value.startsWith('📎'))) continue
    out[key] = value
  }
  return { ...out, updated_at: new Date().toISOString() }
}

export function mockLaravel(options: MockLaravelOptions): typeof fetch {
  return async (input, init = {}) => {
    const started = Date.now()
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let method = (init.method ?? 'GET').toUpperCase()
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    let body: Record<string, any> = {}
    if (typeof FormData !== 'undefined' && init.body instanceof FormData) body = fromFormData(init.body)
    else if (typeof init.body === 'string' && init.body) body = JSON.parse(init.body)
    // PHP can't read multipart PUT: Formo spoofs it, like Laravel's @method('PUT')
    if (typeof body._method === 'string') {
      method = body._method.toUpperCase()
      delete body._method
    }

    await wait(450)

    let status: number
    let payload: unknown
    const behaviour = options.behaviour()
    if (behaviour === 'expired') {
      status = 419
      payload = { message: 'CSRF token mismatch.' }
    } else if (behaviour === 'crash') {
      status = 500
      payload = { message: 'Server Error' }
    } else {
      const errors: Record<string, string[]> = {}
      if (behaviour === 'validate') validate(options.model.fields, body, '', method !== 'POST', options.current ?? {}, errors)
      const keys = Object.keys(errors)
      if (keys.length) {
        status = 422
        const first = errors[keys[0]][0]
        const more = keys.reduce((n, k) => n + errors[k].length, 0) - 1
        payload = { message: more ? `${first} (and ${more} more error${more > 1 ? 's' : ''})` : first, errors }
      } else {
        status = method === 'POST' ? 201 : 200
        payload = { data: saved(body, options.current?.id ?? 42) }
      }
    }

    options.onExchange({
      request: { method, url, headers, body },
      response: { status, body: payload },
      ms: Date.now() - started,
    })
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
