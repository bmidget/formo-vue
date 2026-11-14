import type { CsrfConfig, CsrfOptions } from '../types'

/**
 * CSRF support, following Laravel's `VerifyCsrfToken` middleware, which accepts
 * (in this order):
 *
 *  1. `_token` in the body         — the raw session token (Blade `@csrf`)
 *  2. `X-CSRF-TOKEN` header        — the raw token (Blade `<meta name="csrf-token">`)
 *  3. `X-XSRF-TOKEN` header        — the *encrypted* token from the `XSRF-TOKEN`
 *                                    cookie Laravel sets on every web response
 *                                    (what axios and Sanctum SPAs use)
 *
 * Tokens are only ever sent to trusted origins: the page's own origin, the
 * origin of `request.baseUrl`, and `csrf.origins`.
 */

export type ResolvedCsrf = Required<Omit<CsrfOptions, 'token'>> & Pick<CsrfOptions, 'token'>

const laravel: ResolvedCsrf = {
  token: undefined,
  meta: 'csrf-token',
  cookie: 'XSRF-TOKEN',
  field: '_token',
  header: 'X-CSRF-TOKEN',
  cookieHeader: 'X-XSRF-TOKEN',
  prime: false,
  origins: [],
  retryOn419: true,
}

export const csrfPresets: Record<'laravel' | 'sanctum', ResolvedCsrf> = {
  /** Blade apps / session-authenticated routes: meta tag and/or XSRF-TOKEN cookie */
  laravel,
  /** Sanctum SPA authentication: initializes the cookie with GET /sanctum/csrf-cookie */
  sanctum: { ...laravel, prime: '/sanctum/csrf-cookie' },
}

export function resolveCsrf(config: CsrfConfig | undefined): ResolvedCsrf | null {
  if (config === false) return null
  if (config === undefined || config === 'laravel') return csrfPresets.laravel
  if (config === 'sanctum') return csrfPresets.sanctum
  return { ...csrfPresets.laravel, ...config }
}

const hasDom = () => typeof document !== 'undefined'
const pageHref = () => (typeof location !== 'undefined' ? location.href : 'http://localhost/')

/** `baseUrl` + relative url (absolute urls are left alone) */
export function joinUrl(baseUrl: string | undefined, url: string): string {
  if (!baseUrl || /^[a-z][a-z\d+\-.]*:\/\//i.test(url) || url.startsWith('//')) return url
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

function originOf(url: string): string | null {
  try {
    return new URL(url, pageHref()).origin
  } catch {
    return null
  }
}

/** May this URL receive CSRF tokens and credentials? */
export function isTrustedUrl(url: string, csrf: Pick<CsrfOptions, 'origins'> | null, baseUrl?: string): boolean {
  const origin = originOf(url)
  if (!origin) return false
  const trusted = new Set<string>([originOf(pageHref())!])
  if (baseUrl) {
    const base = originOf(baseUrl)
    if (base) trusted.add(base)
  }
  for (const o of csrf?.origins ?? []) {
    const normalized = originOf(o)
    if (normalized) trusted.add(normalized)
  }
  return trusted.has(origin)
}

export function readCookie(name: string): string | null {
  if (!hasDom()) return null
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      // Laravel URL-encodes the cookie value; the header wants it decoded (like axios does)
      try {
        return decodeURIComponent(rest.join('='))
      } catch {
        return rest.join('=')
      }
    }
  }
  return null
}

export function readMeta(name: string): string | null {
  if (!hasDom()) return null
  const el = document.querySelector(`meta[name="${name.replace(/"/g, '\\"')}"]`)
  return el?.getAttribute('content') || null
}

/**
 * Meta tokens known to be stale (a 419 forced a refresh while they were sent).
 * The meta tag is server-rendered and can't refresh itself, so once it's stale we
 * stop sending it — otherwise Laravel, which checks X-CSRF-TOKEN before
 * X-XSRF-TOKEN, would 419 on every request. A new value in the tag is used again.
 */
const staleMetaTokens = new Set<string>()

/** The raw session token: explicit `token` option, else the `<meta>` tag */
export async function rawCsrfToken(csrf: ResolvedCsrf): Promise<string | null> {
  if (typeof csrf.token === 'function') return (await csrf.token()) || null
  if (typeof csrf.token === 'string' && csrf.token) return csrf.token
  const meta = csrf.meta ? readMeta(csrf.meta) : null
  return meta && !staleMetaTokens.has(meta) ? meta : null
}

/** GET the prime URL (Sanctum: /sanctum/csrf-cookie) so the server sets a fresh XSRF-TOKEN cookie */
export async function primeCsrf(csrf: ResolvedCsrf, baseUrl?: string, fetcher: typeof fetch = globalThis.fetch) {
  if (!csrf.prime) return
  await fetcher(joinUrl(baseUrl, csrf.prime), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  })
}

export interface CsrfHeaderOptions {
  url: string
  baseUrl?: string
  fetch?: typeof fetch
  /**
   * After a 419: re-prime, and don't send a (stale) raw meta token — Laravel
   * checks it *before* X-XSRF-TOKEN, so it would mask the fresh cookie token.
   */
  refresh?: boolean
}

/** Headers carrying the CSRF token for a request (empty for untrusted URLs or when disabled) */
export async function csrfHeaders(config: CsrfConfig | undefined, opts: CsrfHeaderOptions): Promise<Record<string, string>> {
  const csrf = resolveCsrf(config)
  if (!csrf || !isTrustedUrl(opts.url, csrf, opts.baseUrl)) return {}

  const dynamicToken = typeof csrf.token === 'function'
  if (opts.refresh && !csrf.token && csrf.meta) {
    const meta = readMeta(csrf.meta)
    if (meta) staleMetaTokens.add(meta)
  }
  let raw = opts.refresh && !dynamicToken ? null : await rawCsrfToken(csrf)
  let xsrf = csrf.cookie ? readCookie(csrf.cookie) : null

  if (csrf.prime && (opts.refresh || (!raw && !xsrf))) {
    await primeCsrf(csrf, opts.baseUrl, opts.fetch)
    xsrf = csrf.cookie ? readCookie(csrf.cookie) : null
    if (dynamicToken) raw = await rawCsrfToken(csrf)
  }

  const headers: Record<string, string> = {}
  if (raw) headers[csrf.header] = raw
  if (xsrf) headers[csrf.cookieHeader] = xsrf
  return headers
}

/**
 * The hidden field for native form posts (Laravel `@csrf` → `_token`).
 * Only the raw token works here: the encrypted cookie value is header-only.
 */
export async function csrfField(
  config: CsrfConfig | undefined,
  opts: { url: string; baseUrl?: string },
): Promise<{ name: string; value: string } | null> {
  const csrf = resolveCsrf(config)
  if (!csrf || !isTrustedUrl(opts.url, csrf, opts.baseUrl)) return null
  const value = await rawCsrfToken(csrf)
  return value ? { name: csrf.field, value } : null
}
