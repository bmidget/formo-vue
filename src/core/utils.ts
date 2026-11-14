/** The marker Formo (PHP) uses for "not set" values, ex: in `to_array()` output */
export const NOTSET = '_NOTSET'

export function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

/** `first_name` → `First name` */
export function humanize(alias: string | number): string {
  const str = String(alias)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Formo: "aliases always replace spaces with underscores" */
export function cleanAlias(alias: string | number): string | number {
  if (typeof alias === 'number') return alias
  return String(alias).trim().replace(/\s+/g, '_').replace(/\./g, '_')
}

/** Split a path like `a.b[0].c` or `a[b][0][c]` into segments */
export function toSegments(path: string | Array<string | number>): Array<string | number> {
  if (Array.isArray(path)) return path
  if (path === '') return []
  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '')
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s))
}

export function getPath(obj: any, path: string | Array<string | number>, fallback?: any): any {
  const segments = toSegments(path)
  let cur = obj
  for (const seg of segments) {
    if (cur === null || cur === undefined) return fallback
    cur = cur[seg as any]
  }
  return cur === undefined ? fallback : cur
}

export function setPath(obj: Record<string, any>, path: string | Array<string | number>, value: unknown): void {
  const segments = toSegments(path)
  let cur: any = obj
  segments.forEach((seg, i) => {
    if (i === segments.length - 1) {
      cur[seg as any] = value
      return
    }
    if (cur[seg as any] === null || typeof cur[seg as any] !== 'object') {
      cur[seg as any] = typeof segments[i + 1] === 'number' ? [] : {}
    }
    cur = cur[seg as any]
  })
}

/** Delete a path from an object (array items are removed) */
export function unsetPath(obj: Record<string, any>, path: string | Array<string | number>): void {
  const segments = toSegments(path)
  const last = segments.pop()
  if (last === undefined) return
  const parent = segments.length ? getPath(obj, segments) : obj
  if (parent === null || typeof parent !== 'object') return
  if (Array.isArray(parent) && typeof last === 'number') parent.splice(last, 1)
  else delete parent[last as any]
}

/** Join a group path and a child alias the way vee-validate expects */
export function joinPath(parent: string, alias: string | number): string {
  if (typeof alias === 'number') return `${parent}[${alias}]`
  return parent ? `${parent}.${alias}` : String(alias)
}

/** Build the HTML `name` attribute Formo style: `form[group][field]` */
export function toName(prefix: string | number | undefined, path: string): string {
  const segments = toSegments(path)
  if (prefix === undefined || prefix === '') {
    const [first, ...rest] = segments
    return String(first ?? '') + rest.map((s) => `[${s}]`).join('')
  }
  return String(prefix) + segments.map((s) => `[${s}]`).join('')
}

/** A DOM-safe id from a form alias and a path */
export function toId(prefix: string | number | undefined, path: string): string {
  const body = toSegments(path).join('-')
  const raw = prefix !== undefined && prefix !== '' ? `${prefix}-${body}` : body
  return raw.replace(/[^\w-]/g, '-')
}

export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as unknown as T
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value)) out[key] = deepClone((value as any)[key])
    return out as T
  }
  return value
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

/** Deep merge plain objects. Arrays and other values from `source` replace the target's */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Array<Record<string, any> | undefined>): T {
  const out: Record<string, any> = { ...target }
  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      const value = source[key]
      if (value === undefined) continue
      out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value
    }
  }
  return out as T
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Replace `:field` / `{field}` style placeholders */
export function interpolate(message: string, values: Record<string, unknown>): string {
  // Longest keys first so `:param10` wins over `:param1`
  const keys = Object.keys(values).sort((a, b) => b.length - a.length)
  let out = message
  for (const key of keys) {
    const replacement = formatParam(values[key])
    out = out.split(`:${key}`).join(replacement).split(`{${key}}`).join(replacement)
  }
  return out
}

function formatParam(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatParam).join(', ')
  if (value instanceof RegExp) return value.toString()
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return ''
  return String(value)
}
