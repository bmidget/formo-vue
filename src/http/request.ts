import type { CsrfConfig, FormoRequestConfig, FormoResponse } from '../types'
import { csrfHeaders, isTrustedUrl, joinUrl, resolveCsrf } from './csrf'
import { isPlainObject, joinPath } from '../core/utils'

export interface SendOptions extends FormoRequestConfig {
  method?: string
  values?: Record<string, any>
  csrf?: CsrfConfig
}

const isFile = (v: unknown) =>
  (typeof Blob !== 'undefined' && v instanceof Blob) || (typeof FileList !== 'undefined' && v instanceof FileList)

export function containsFile(value: unknown): boolean {
  if (isFile(value)) return true
  if (Array.isArray(value)) return value.some(containsFile)
  if (isPlainObject(value)) return Object.values(value).some(containsFile)
  return false
}

/** Flatten values into PHP-style bracket keys: `address[street]`, `phones[0][number]` */
export function flattenForPhp(value: unknown, prefix = '', out: Array<[string, string | Blob]> = []) {
  if (typeof FileList !== 'undefined' && value instanceof FileList) {
    Array.from(value).forEach((f, i) => out.push([`${prefix}[${i}]`, f]))
  } else if (isFile(value)) {
    out.push([prefix, value as Blob])
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => flattenForPhp(v, `${prefix}[${i}]`, out))
  } else if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) flattenForPhp(v, prefix ? `${prefix}[${k}]` : k, out)
  } else if (typeof value === 'boolean') {
    out.push([prefix, value ? '1' : '0'])
  } else {
    // Laravel's ConvertEmptyStringsToNull middleware turns '' back into null
    out.push([prefix, value === null || value === undefined ? '' : String(value)])
  }
  return out
}

/**
 * Laravel error keys → form paths: strips the `rootKey` and turns numeric
 * segments into indexes (`phones.0.number` → `phones[0].number`).
 */
export function laravelKeyToPath(key: string, rootKey?: string): string {
  let segments = key.split('.')
  if (rootKey && segments[0] === rootKey) segments = segments.slice(1)
  return segments.reduce<string>((path, seg) => joinPath(path, /^\d+$/.test(seg) ? Number(seg) : seg), '')
}

async function parseBody(response: Response): Promise<any> {
  const type = response.headers.get('content-type') ?? ''
  if (response.status === 204) return null
  try {
    return type.includes('json') ? await response.json() : await response.text()
  } catch {
    return null
  }
}

/**
 * Send values to a (Laravel) backend:
 *
 *  - `Accept: application/json` + `X-Requested-With` so Laravel answers with JSON (422 instead of a redirect)
 *  - JSON body, or FormData with PHP bracket names when there are files (`body: 'auto'`)
 *  - method spoofing (`_method=PUT`) for multipart PUT/PATCH/DELETE, which PHP can't parse natively
 *  - CSRF headers + credentials for trusted origins only
 *  - on 419 (CSRF token mismatch): refresh the token and retry once
 */
export async function sendRequest(url: string, opts: SendOptions = {}): Promise<FormoResponse> {
  const fetcher = opts.fetch ?? globalThis.fetch
  const fullUrl = joinUrl(opts.baseUrl, url)
  const csrf = resolveCsrf(opts.csrf)
  const trusted = isTrustedUrl(fullUrl, csrf ?? { origins: [] }, opts.baseUrl)
  const method = (opts.method ?? 'POST').toUpperCase()
  const values = opts.values ?? {}
  const payload = opts.rootKey ? { [opts.rootKey]: values } : values

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...opts.headers,
  }
  const init: RequestInit = {
    method,
    // Cookies (session, XSRF) only go to origins we trust
    credentials: opts.credentials ?? (trusted ? 'include' : 'same-origin'),
  }

  let target = fullUrl
  if (method === 'GET' || method === 'HEAD') {
    const query = new URLSearchParams(flattenForPhp(payload).map(([k, v]) => [k, String(v)]))
    const qs = query.toString()
    if (qs) target += (target.includes('?') ? '&' : '?') + qs
  } else if (opts.body === 'form-data' || (opts.body !== 'json' && containsFile(payload))) {
    const form = new FormData()
    for (const [k, v] of flattenForPhp(payload)) form.append(k, v)
    if (method !== 'POST') {
      form.append('_method', method)
      init.method = 'POST'
    }
    init.body = form
  } else {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(payload)
  }

  const send = async (refresh: boolean) =>
    fetcher(target, {
      ...init,
      headers: { ...headers, ...(await csrfHeaders(opts.csrf, { url: fullUrl, baseUrl: opts.baseUrl, fetch: fetcher, refresh })) },
    })

  let response = await send(false)
  // A refresh can only help when a new token can be obtained (Sanctum prime / token function)
  const canRefresh = !!csrf && trusted && csrf.retryOn419 && (!!csrf.prime || typeof csrf.token === 'function')
  if (response.status === 419 && canRefresh) response = await send(true)

  const data = await parseBody(response)
  const result: FormoResponse = { ok: response.ok, status: response.status, data, response }

  if (response.status === 422 && data && isPlainObject(data.errors)) {
    result.errors = {}
    for (const [key, messages] of Object.entries(data.errors as Record<string, string | string[]>)) {
      result.errors[laravelKeyToPath(key, opts.rootKey)] = Array.isArray(messages) ? messages : [messages]
    }
  }

  return result
}
