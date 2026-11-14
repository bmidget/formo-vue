import type { FilterInput, FormoConfig, FormoDriver, FieldNode } from '../types'
import { defaultValueFor } from './drivers'
import { deepClone, deepMerge, getPath, isPlainObject, joinPath, setPath } from './utils'

/** Whether a group namespaces its children (Formo `namespaces` config, cascading) */
export function groupNamespaces(node: FieldNode, inherited: FormoConfig): boolean {
  return node.config?.namespaces ?? inherited.namespaces
}

/**
 * Build the initial values object from a node tree: each field's `val`, or its
 * driver's default value. Groups nest (when namespaced), blueprints become arrays.
 */
export function buildInitialValues(
  node: FieldNode,
  drivers: Record<string, FormoDriver>,
  config: FormoConfig,
  out: Record<string, any> = {},
  prefix = '',
): Record<string, any> {
  const cfg = node.config ? deepMerge(config, node.config) : config

  for (const child of node.fields) {
    const driver = drivers[child.driver]
    const childCfg = child.config ? deepMerge(cfg, child.config) : cfg

    if (driver?.parent || child.fields.length) {
      if (child.blueprint) {
        const rowDefaults = buildInitialValues({ ...child, blueprint: false }, drivers, childCfg)
        const rows = Array.isArray(child.val)
          ? child.val.map((row) => deepMerge(rowDefaults, isPlainObject(row) ? row : {}))
          : Array.from({ length: child.min ?? 0 }, () => deepClone(rowDefaults))
        setPath(out, joinPath(prefix, child.alias), rows)
        continue
      }

      const nextPrefix = groupNamespaces(child, cfg) ? joinPath(prefix, child.alias) : prefix
      buildInitialValues(child, drivers, childCfg, out, nextPrefix)

      if (child.hasVal && isPlainObject(child.val)) {
        // A group's `val` is a values object for its fields
        const target = nextPrefix ? (getPath(out, nextPrefix) ?? {}) : out
        const merged = deepMerge(target, child.val)
        if (nextPrefix) setPath(out, nextPrefix, merged)
        else Object.assign(out, merged)
      }
      continue
    }

    if (driver?.valueless) continue
    const value = child.hasVal ? deepClone(child.val) : defaultValueFor(driver, child)
    setPath(out, joinPath(prefix, child.alias), value)
  }

  if (!prefix && node.hasVal && isPlainObject(node.val)) {
    return deepMerge(out, node.val)
  }

  return out
}

const namedFilters: Record<string, (v: any) => any> = {
  trim: (v) => (typeof v === 'string' ? v.trim() : v),
  lower: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  upper: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  strtolower: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  strtoupper: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  int: (v) => (v === '' || v === null || v === undefined ? null : Number.parseInt(String(v), 10)),
  intval: (v) => (v === '' || v === null || v === undefined ? null : Number.parseInt(String(v), 10)),
  float: (v) => (v === '' || v === null || v === undefined ? null : Number.parseFloat(String(v))),
  number: (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  null_if_empty: (v) => (v === '' ? null : v),
  string: (v) => (v === null || v === undefined ? '' : String(v)),
  boolean: (v) => Boolean(v),
}

/** Apply Formo filters (functions, names like `trim`, or `[fn, [':value']]` tuples) */
export function applyFilters(value: unknown, filters: FilterInput[]): unknown {
  let out = value
  for (const filter of filters) {
    if (typeof filter === 'function') out = filter(out)
    else if (typeof filter === 'string') {
      const fn = namedFilters[filter]
      if (!fn) throw new Error(`[formo] Unknown filter "${filter}"`)
      out = fn(out)
    } else if (Array.isArray(filter)) {
      const [fn, params] = filter
      out = params ? (fn as (...args: unknown[]) => unknown)(...params.map((p) => (p === ':value' ? out : p))) : fn(out)
    }
  }
  return out
}

/** Walk the node tree alongside actual values, applying each field's filters */
export function filterValues(
  node: FieldNode,
  values: Record<string, any>,
  drivers: Record<string, FormoDriver>,
  config: FormoConfig,
  prefix = '',
  out: Record<string, any> = deepClone(values),
): Record<string, any> {
  const cfg = node.config ? deepMerge(config, node.config) : config
  for (const child of node.fields) {
    const driver = drivers[child.driver]
    const path = joinPath(prefix, child.alias)
    if (driver?.parent || child.fields.length) {
      if (child.blueprint) {
        const rows = getPath(values, path)
        if (Array.isArray(rows)) {
          rows.forEach((_row, i) => filterValues({ ...child, blueprint: false }, values, drivers, cfg, `${path}[${i}]`, out))
        }
        continue
      }
      filterValues(child, values, drivers, cfg, groupNamespaces(child, cfg) ? path : prefix, out)
      continue
    }
    if (child.filters.length) {
      setPath(out, path, applyFilters(getPath(values, path), child.filters))
    }
  }
  return out
}
