import { isPlainObject } from '../core/utils'
import { consoleWarning, type FormoModel, type WarningHandler } from './ir'
import { fromJsonSchema } from './json-schema'

/**
 * OpenAPI 3.0 / 3.1 → Formo model, from an operation's request body (create and
 * update bodies often differ) or a named schema:
 *
 *   fromOpenApi(doc, { operation: 'POST /users' })        // or an operationId: 'createUser'
 *   fromOpenApi(doc, { schema: 'User' })                   // #/components/schemas/User
 *
 * Rails (rswag), Laravel (Scramble), FastAPI, NestJS… all publish one.
 * `readOnly` properties are server-set, `writeOnly` ones never come back
 * (passwords), `format: binary` is a file upload, `x-formo` carries Formo keys.
 */
export interface FromOpenApiOptions {
  /** `'POST /users'`, `'put /users/{user}'` or an `operationId` */
  operation?: string
  /** A schema name (`User`) or a JSON pointer (`#/components/schemas/User`) */
  schema?: string
  /** Request body media type to read (default: JSON, then multipart, then urlencoded) */
  contentType?: string
  /** The model's name (suggested form alias) */
  name?: string
  onWarning?: WarningHandler
}

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

function deref(doc: Record<string, any>, value: any): any {
  let cur = value
  const seen = new Set<string>()
  while (isPlainObject(cur) && typeof cur.$ref === 'string' && !seen.has(cur.$ref)) {
    seen.add(cur.$ref)
    const parts = cur.$ref.replace(/^#\//, '').split('/').map((p: string) => decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~'))
    cur = parts.reduce((o: any, p: string) => (o && typeof o === 'object' ? o[p] : undefined), doc)
  }
  return cur
}

function findOperation(doc: Record<string, any>, operation: string): { method: string; path: string; op: any } | undefined {
  const m = operation.trim().match(/^([a-z]+)\s+(\S+)$/i)
  const paths: Record<string, any> = isPlainObject(doc.paths) ? doc.paths : {}
  if (m && METHODS.includes(m[1].toLowerCase())) {
    const method = m[1].toLowerCase()
    const op = deref(doc, paths[m[2]])?.[method]
    return op ? { method, path: m[2], op } : undefined
  }
  for (const [path, item] of Object.entries(paths)) {
    const pathItem = deref(doc, item)
    for (const method of METHODS) {
      if (pathItem?.[method]?.operationId === operation) return { method, path, op: pathItem[method] }
    }
  }
  return undefined
}

function pickContent(content: Record<string, any>, wanted?: string): { type: string; media: any } | undefined {
  const types = Object.keys(content)
  const type =
    (wanted && types.find((t) => t === wanted)) ??
    types.find((t) => t === 'application/json' || /\+json$/.test(t)) ??
    types.find((t) => t === 'multipart/form-data') ??
    types.find((t) => t === 'application/x-www-form-urlencoded') ??
    types[0]
  return type ? { type, media: content[type] } : undefined
}

export function fromOpenApi(doc: Record<string, any>, options: FromOpenApiOptions): FormoModel {
  if (!isPlainObject(doc) || typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw new Error('[formo] fromOpenApi: expected an OpenAPI 3.0 / 3.1 document (Swagger 2 is not supported)')
  }
  const warn = options.onWarning ?? consoleWarning
  const base = { document: doc, onWarning: warn, name: options.name }

  if (options.schema) {
    const ref = options.schema.startsWith('#') ? options.schema : `#/components/schemas/${options.schema}`
    const model = fromJsonSchema({ $ref: ref }, base)
    model.meta = { source: 'openapi', schema: ref }
    return model
  }

  if (!options.operation) throw new Error('[formo] fromOpenApi: pass `operation` (\'POST /users\' or an operationId) or `schema`')
  const found = findOperation(doc, options.operation)
  if (!found) throw new Error(`[formo] fromOpenApi: no operation "${options.operation}" in this document`)
  const body = deref(doc, found.op.requestBody)
  const content = isPlainObject(body?.content) ? pickContent(body.content, options.contentType) : undefined
  if (!content?.media?.schema) throw new Error(`[formo] fromOpenApi: "${options.operation}" has no request body schema`)

  const model = fromJsonSchema(content.media.schema, base)
  model.meta = { source: 'openapi', operation: `${found.method.toUpperCase()} ${found.path}`, contentType: content.type }
  if (found.op.operationId) model.meta.operationId = found.op.operationId
  return model
}
