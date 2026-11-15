import { Comment, Fragment, Text, type VNode } from 'vue'

/** Does slot output contain anything real? (`v-if` placeholders / whitespace don't count) */
export function hasContent(vnodes: VNode[] | undefined): boolean {
  return (vnodes ?? []).some((vnode) => {
    if (vnode.type === Comment) return false
    if (vnode.type === Text) return String(vnode.children ?? '').trim() !== ''
    if (vnode.type === Fragment) return hasContent(vnode.children as VNode[])
    return true
  })
}

type AnySlot = (...args: any[]) => VNode[]

/**
 * A slot for the node at `path`: given to the component rendering it (`own`),
 * else `#name:path` on <FormoForm> (`phones[].number` matches any row).
 */
export function findNodeSlot(
  own: Record<string, unknown>,
  formSlots: Record<string, unknown>,
  path: string,
  name: string,
  formName = name,
): AnySlot | undefined {
  if (own[name]) return own[name] as AnySlot
  const generic = path.replace(/\[\d+\]/g, '[]')
  return (formSlots[`${formName}:${path}`] ?? formSlots[`${formName}:${generic}`]) as AnySlot | undefined
}
