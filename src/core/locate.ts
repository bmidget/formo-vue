import type { FieldNode, FormoConfig, FormoDriver } from '../types'
import { deepMerge, joinPath } from './utils'
import { groupNamespaces } from './values'

/** Where a node sits in the rendered form — everything needed to render it on its own */
export interface LocatedNode {
  node: FieldNode
  /** Path of the node (`address.street`, `phones[0].number`) */
  path: string
  /** Value path of its parent group ('' = form root) */
  parentPath: string
  parentAlias?: string | number
  /** Registry path of its containing group ('' = the form) */
  groupPath: string
  /** Groups between the form and the node (their components / config / theme cascade) */
  ancestors: FieldNode[]
  /** Value prefix of its children, for groups (what relative paths inside it resolve against) */
  childPrefix: string
}

interface WalkContext {
  drivers: Record<string, FormoDriver>
  visit: (located: LocatedNode) => boolean | void
  /** Blueprint rows to descend into: `phones` → [0, 1] */
  rowsOf?: (path: string) => number[]
}

export const isGroup = (node: FieldNode, drivers: Record<string, FormoDriver>) =>
  !!drivers[node.driver]?.parent || node.fields.length > 0

/**
 * Walk the tree computing paths exactly like the renderer does (namespaces,
 * `namespaces: false` groups, blueprint rows). `visit` returning true stops.
 */
function walk(
  group: FieldNode,
  prefix: string,
  groupPath: string,
  config: FormoConfig,
  ancestors: FieldNode[],
  ctx: WalkContext,
): boolean {
  const cfg = group.config ? deepMerge(config, group.config) : config
  for (const child of group.fields) {
    const path = joinPath(prefix, child.alias)
    const childIsGroup = isGroup(child, ctx.drivers)
    const childPrefix = childIsGroup ? (child.blueprint || groupNamespaces(child, cfg) ? path : prefix) : prefix
    const located: LocatedNode = {
      node: child,
      path,
      parentPath: prefix,
      parentAlias: group.alias,
      groupPath,
      ancestors,
      childPrefix,
    }
    if (ctx.visit(located)) return true
    if (!childIsGroup) continue
    if (child.blueprint) {
      for (const row of ctx.rowsOf?.(path) ?? []) {
        if (walk(child, `${path}[${row}]`, path, cfg, [...ancestors, child], ctx)) return true
      }
      continue
    }
    if (walk(child, childPrefix, path, cfg, [...ancestors, child], ctx)) return true
  }
  return false
}

/**
 * Find a node by path (`address.street`, `phones[0].number`) or by alias
 * anywhere in the form (shallowest match).
 */
export function locate(
  root: FieldNode,
  target: string,
  drivers: Record<string, FormoDriver>,
  config: FormoConfig,
  { byAlias = true }: { byAlias?: boolean } = {},
): LocatedNode | undefined {
  if (target === '' || target === ':self') {
    return { node: root, path: '', parentPath: '', groupPath: '', ancestors: [], childPrefix: '' }
  }
  // Rows to descend into: only the one the target asks for (`phones[3]…` → 3)
  const rowsOf = (path: string) => {
    const m = target.slice(path.length).match(/^\[(\d+)\]/)
    return target.startsWith(path) && m ? [Number(m[1])] : []
  }

  let found: LocatedNode | undefined
  walk(root, '', '', config, [], {
    drivers,
    rowsOf,
    visit: (located) => {
      if (located.path === target) {
        found = located
        return true
      }
    },
  })
  if (found || !byAlias) return found

  // Formo find(): by alias, shallowest first
  let best: LocatedNode | undefined
  walk(root, '', '', config, [], {
    drivers,
    visit: (located) => {
      if (String(located.node.alias) === target && (!best || located.ancestors.length < best.ancestors.length)) best = located
    },
  })
  return best
}

/** Every leaf field of the form (blueprints count as one unit) — used to spot fields nobody rendered */
export function leafPaths(root: FieldNode, drivers: Record<string, FormoDriver>, config: FormoConfig): LocatedNode[] {
  const out: LocatedNode[] = []
  walk(root, '', '', config, [], {
    drivers,
    visit: (located) => {
      if (located.node.blueprint || !isGroup(located.node, drivers)) {
        if (!drivers[located.node.driver]?.valueless) out.push(located)
      }
    },
  })
  return out
}
