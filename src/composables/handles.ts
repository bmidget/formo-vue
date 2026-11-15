import { markRaw } from 'vue'
import type { FieldNode, FormoController, FormoFields, FormoHandle, FormoHandleKind, FormoRowHandle } from '../types'
import { isGroup, locate } from '../core/locate'
import { deepMerge, joinPath, toSegments } from '../core/utils'
import { buildInitialValues } from '../core/values'

/** Where a `fields` object reads its children from (evaluated on every access, so it follows the form) */
interface Scope {
  node: () => FieldNode | undefined
  prefix: () => string
}

export interface FormoHandles {
  /** `form.fields` */
  root: FormoFields
  /** The handle of an exact path (whatever is there now) */
  at: (path: string) => FormoHandle
  /** By path, then by alias (searched recursively) */
  find: (pathOrAlias: string) => FormoHandle | undefined
  row: (blueprintPath: string, index: number) => FormoRowHandle
}

/**
 * Handles — `form.fields.email`, `form.fields.address.fields.zip`,
 * `form.fields.phones.rows[0].fields.number`. One object per path (so they can be
 * passed as props without re-rendering); everything on them is read live from
 * the form, so fields added with `.add()` after render show up too.
 */
export function createHandles(getForm: () => FormoController): FormoHandles {
  const handles = new Map<string, FormoHandle>()
  const rows = new Map<string, FormoRowHandle>()
  const scopes = new Map<string, FormoFields>()
  /** Row keys of repeatable groups that aren't mounted (mounted ones have their field array's keys) */
  const localKeys = new Map<string, number[]>()
  let nextKey = 0

  const opts = () => getForm().options
  const exact = (path: string) => {
    const { drivers, config } = opts()
    return locate(getForm().root, path, drivers, config, { byAlias: false })
  }
  const kindOf = (node: FieldNode): FormoHandleKind =>
    node.blueprint ? 'blueprint' : isGroup(node, opts().drivers) ? 'group' : 'field'

  function fieldsOf(key: string, scope: Scope): FormoFields {
    let proxy = scopes.get(key)
    if (proxy) return proxy
    const childAlias = (alias: string) => scope.node()?.fields.find((f) => String(f.alias) === alias)?.alias
    const child = (key: string) => {
      const alias = childAlias(key)
      return alias === undefined ? undefined : at(joinPath(scope.prefix(), alias))
    }
    const target = markRaw({} as Record<string | symbol, unknown>)
    proxy = new Proxy(target, {
      get(t, key) {
        // Vue / devtools internals (__v_skip, __v_isRef…), symbols
        if (typeof key !== 'string' || key.startsWith('__v_')) return Reflect.get(t, key)
        return child(key)
      },
      has: (t, key) => (typeof key === 'string' && childAlias(key) !== undefined) || Reflect.has(t, key),
      ownKeys: () => (scope.node()?.fields ?? []).map((f) => String(f.alias)),
      getOwnPropertyDescriptor(t, key) {
        if (typeof key !== 'string' || childAlias(key) === undefined) return Reflect.getOwnPropertyDescriptor(t, key)
        return { enumerable: true, configurable: true, writable: false, value: child(key) }
      },
      set: () => false,
    }) as FormoFields
    scopes.set(key, proxy)
    return proxy
  }

  /* ---- Repeatable groups ----------------------------------------------- */

  const rowValues = (path: string): unknown[] => {
    const value = getForm().val(path)
    return Array.isArray(value) ? value : []
  }

  /** Keys of the rows: the mounted field array's, else tracked here (stable across our own add / remove) */
  function keysOf(path: string): Array<string | number> {
    const bound = getForm()._arrays.get(path)
    const length = rowValues(path).length
    if (bound) return bound.keys()
    let keys = localKeys.get(path) ?? []
    // Rows changed from outside (load(), reset()…): keep the keys we have, new rows get new ones
    if (keys.length > length) keys = keys.slice(0, length)
    while (keys.length < length) keys = [...keys, nextKey++]
    localKeys.set(path, keys)
    return keys
  }

  const limits = (path: string) => {
    const node = exact(path)?.node
    const length = rowValues(path).length
    return {
      node,
      canAdd: !!node?.blueprint && (node.max === undefined || length < node.max),
      canRemove: !!node?.blueprint && length > (node.min ?? 0),
    }
  }

  function addRow(path: string, values: Record<string, unknown> = {}) {
    const { node, canAdd } = limits(path)
    if (!node || !canAdd) return
    const { drivers, config } = opts()
    const row = deepMerge(buildInitialValues({ ...node, blueprint: false }, drivers, config), values)
    const bound = getForm()._arrays.get(path)
    if (bound) return bound.push(row)
    keysOf(path)
    localKeys.set(path, [...(localKeys.get(path) ?? []), nextKey++])
    getForm().val(path, [...rowValues(path), row])
  }

  function removeRow(path: string, index: number) {
    if (!limits(path).canRemove) return
    const bound = getForm()._arrays.get(path)
    if (bound) return bound.remove(index)
    const keys = [...keysOf(path)] as number[]
    keys.splice(index, 1)
    localKeys.set(path, keys)
    getForm().val(path, rowValues(path).filter((_, i) => i !== index))
  }

  function row(blueprintPath: string, index: number): FormoRowHandle {
    const path = `${blueprintPath}[${index}]`
    let handle = rows.get(path)
    if (!handle) {
      handle = markRaw({
        get key() {
          return keysOf(blueprintPath)[index] ?? path
        },
        index,
        path,
        form: getForm(),
        fields: fieldsOf(path, { node: () => exact(blueprintPath)?.node, prefix: () => path }),
        remove: () => removeRow(blueprintPath, index),
      }) as FormoRowHandle
      rows.set(path, handle)
    }
    return handle
  }

  function at(path: string): FormoHandle {
    let handle = handles.get(path)
    if (handle) return handle
    const segments = toSegments(path)
    handle = markRaw({
      get kind() {
        const node = exact(path)?.node
        return node ? kindOf(node) : 'field'
      },
      path,
      alias: segments[segments.length - 1] ?? '',
      get node() {
        return exact(path)?.node
      },
      get form() {
        return getForm()
      },
      get value() {
        return getForm().val(path)
      },
      set value(value: unknown) {
        getForm().val(path, value)
      },
      get error() {
        return getForm().error(path)
      },
      get ignored() {
        return getForm().isIgnored(path)
      },
      get fields() {
        const located = exact(path)
        if (!located || kindOf(located.node) !== 'group') return undefined
        return fieldsOf(path, { node: () => exact(path)?.node, prefix: () => exact(path)?.childPrefix ?? path })
      },
      get rows() {
        const node = exact(path)?.node
        if (!node?.blueprint) return undefined
        return rowValues(path).map((_, i) => row(path, i))
      },
      // Repeatable groups
      add: (values?: Record<string, unknown>) => addRow(path, values),
      remove: (index: number) => removeRow(path, index),
      get canAdd() {
        return limits(path).canAdd
      },
      get canRemove() {
        return limits(path).canRemove
      },
    }) as FormoHandle
    handles.set(path, handle)
    return handle
  }

  function find(pathOrAlias: string): FormoHandle | undefined {
    const { drivers, config } = opts()
    const located = locate(getForm().root, pathOrAlias, drivers, config)
    return located && located.path !== '' ? at(located.path) : undefined
  }

  const root = fieldsOf('', { node: () => getForm().root, prefix: () => '' })
  return { root, at, find, row }
}
