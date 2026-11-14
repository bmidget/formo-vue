/**
 * A tiny fake Laravel backend for the playground, served by the Vite dev
 * server (dev only). It mimics what matters for forms:
 *
 *  - a session cookie (`laravel_session`, HttpOnly) holding a CSRF token
 *  - the `XSRF-TOKEN` cookie (the token "encrypted", readable by JS) on every response
 *  - VerifyCsrfToken: `_token` field → `X-CSRF-TOKEN` header → decrypted `X-XSRF-TOKEN` header
 *  - `GET /sanctum/csrf-cookie` (204, sets the cookies)
 *  - 419 on token mismatch, 422 `{ message, errors }` on validation failure
 *  - `_method` spoofing for native forms
 *
 * Routes:
 *   GET  /sanctum/csrf-cookie     Sanctum cookie init
 *   GET  /web/csrf-token          what Blade would print into <meta name="csrf-token">
 *   PUT  /api/profile             JSON API (Sanctum SPA style)
 *   POST /web/profile             native form post (HTML response, for an iframe)
 *   POST /__mock/expire-session   rotate the session token (→ next request gets a 419)
 *   GET  /__mock/log              the last requests, with how CSRF was verified
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import type { Plugin } from 'vite'

interface Session {
  token: string
}

interface LogEntry {
  at: string
  method: string
  url: string
  status: number
  csrf: string
  headers: Record<string, string>
}

const sessions = new Map<string, Session>()
const log: LogEntry[] = []

const newToken = () => randomBytes(20).toString('hex')
/** Stand-in for Laravel's cookie encryption: the cookie value ≠ the raw token */
const encrypt = (token: string) => Buffer.from(JSON.stringify({ iv: 'mock', value: token })).toString('base64')
const decrypt = (value: string) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString()).value as string
  } catch {
    return null
  }
}

function cookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
  )
}

function session(req: IncomingMessage, res: ServerResponse): Session {
  const id = cookies(req).laravel_session
  if (id && sessions.has(id)) return sessions.get(id)!
  const newId = newToken()
  const s = { token: newToken() }
  sessions.set(newId, s)
  appendCookie(res, `laravel_session=${newId}; Path=/; HttpOnly; SameSite=Lax`)
  return s
}

function appendCookie(res: ServerResponse, cookie: string) {
  const existing = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : existing ? [String(existing)] : []), cookie])
}

/** Laravel adds a fresh XSRF-TOKEN cookie (not HttpOnly) to web responses */
function xsrfCookie(res: ServerResponse, s: Session) {
  appendCookie(res, `XSRF-TOKEN=${encodeURIComponent(encrypt(s.token))}; Path=/; SameSite=Lax`)
}

async function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString()
  const type = req.headers['content-type'] ?? ''
  if (type.includes('application/json')) return raw ? JSON.parse(raw) : {}
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw))
  return {}
}

/** VerifyCsrfToken::tokensMatch() */
function verifyCsrf(req: IncomingMessage, body: Record<string, any>, s: Session): string | null {
  if (body._token) return body._token === s.token ? '_token field' : null
  const header = req.headers['x-csrf-token']
  if (typeof header === 'string') return header === s.token ? 'X-CSRF-TOKEN header' : null
  const xsrf = req.headers['x-xsrf-token']
  if (typeof xsrf === 'string') return decrypt(xsrf) === s.token ? 'X-XSRF-TOKEN header (decrypted cookie)' : null
  return null
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.end(type === 'application/json' ? JSON.stringify(body) : String(body))
}

function record(req: IncomingMessage, status: number, csrf: string) {
  const pick = (h: string) => {
    const v = req.headers[h]
    return typeof v === 'string' ? (v.length > 28 ? `${v.slice(0, 28)}…` : v) : ''
  }
  log.unshift({
    at: new Date().toLocaleTimeString(),
    method: req.method ?? '',
    url: req.url ?? '',
    status,
    csrf,
    headers: Object.fromEntries(
      ['x-xsrf-token', 'x-csrf-token', 'accept'].map((h) => [h, pick(h)]).filter(([, v]) => v),
    ),
  })
  log.splice(15)
}

/** Server-side validation, answering like Laravel (422 + errors keyed by dot paths) */
function validateProfile(body: Record<string, any>): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (String(body.email ?? '').toLowerCase() === 'taken@example.com') errors.email = ['The email has already been taken.']
  if (String(body.username ?? '').toLowerCase() === 'admin') errors.username = ['The username is reserved.']
  if (String(body.email ?? '').endsWith('@spam.test')) errors.account = ['Sign-ups from this domain are blocked.']
  ;(Array.isArray(body.phones) ? body.phones : []).forEach((p: any, i: number) => {
    if (String(p?.number ?? '').replace(/\D/g, '').startsWith('555')) {
      errors[`phones.${i}.number`] = ['555 numbers are fictional — use a real one.']
    }
  })
  return errors
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function htmlPage(title: string, ok: boolean, rows: Array<[string, string]>) {
  return `<!doctype html><html><body style="font:13px/1.5 ui-sans-serif,system-ui;margin:0;padding:14px;color:#0f172a">
<p style="margin:0 0 8px;font-weight:600;color:${ok ? '#047857' : '#be123c'}">${escape(title)}</p>
<table style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#64748b">${escape(k)}</td><td style="font-family:ui-monospace,monospace">${escape(v)}</td></tr>`)
    .join('')}</table></body></html>`
}

export function mockLaravel(): Plugin {
  return {
    name: 'formo-playground-mock-laravel',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const routes = ['/sanctum/csrf-cookie', '/web/csrf-token', '/api/profile', '/web/profile', '/__mock/expire-session', '/__mock/log']
        if (!routes.includes(url)) return next()

        const s = session(req, res)

        if (url === '/__mock/log') return send(res, 200, log)

        if (url === '/sanctum/csrf-cookie' && req.method === 'GET') {
          xsrfCookie(res, s)
          record(req, 204, '—')
          res.statusCode = 204
          return res.end()
        }

        if (url === '/web/csrf-token' && req.method === 'GET') {
          xsrfCookie(res, s)
          return send(res, 200, { token: s.token })
        }

        if (url === '/__mock/expire-session' && req.method === 'POST') {
          s.token = newToken() // old tokens (meta + cookie) are now stale
          return send(res, 200, { message: 'Session token rotated' })
        }

        const body = await readBody(req)
        // Native forms spoof PUT/PATCH/DELETE with _method
        const method = String(body._method ?? req.method).toUpperCase()
        const via = verifyCsrf(req, body, s)

        if (url === '/api/profile') {
          if (!via) {
            record(req, 419, 'mismatch ✗')
            return send(res, 419, { message: 'CSRF token mismatch.' })
          }
          xsrfCookie(res, s)
          const errors = validateProfile(body)
          if (Object.keys(errors).length) {
            record(req, 422, via)
            const [first] = Object.values(errors)
            const more = Object.keys(errors).length - 1
            return send(res, 422, {
              message: `${first[0]}${more ? ` (and ${more} more error${more > 1 ? 's' : ''})` : ''}`,
              errors,
            })
          }
          record(req, 200, via)
          return send(res, 200, { message: 'Profile saved', method, csrf: via, data: body })
        }

        if (url === '/web/profile' && req.method === 'POST') {
          const rows: Array<[string, string]> = Object.entries(body).map(([k, v]) => [
            k,
            k === '_token' ? `${String(v).slice(0, 12)}…` : String(v),
          ])
          if (!via) {
            record(req, 419, 'mismatch ✗')
            return send(res, 419, htmlPage('419 | Page Expired — CSRF token mismatch', false, rows), 'text/html')
          }
          xsrfCookie(res, s)
          record(req, 200, via)
          return send(res, 200, htmlPage(`✓ ${method} accepted — CSRF verified via ${via}`, true, rows), 'text/html')
        }

        return next()
      })
    },
  }
}
