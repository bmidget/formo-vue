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
