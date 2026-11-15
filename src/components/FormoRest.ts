import { computed, defineComponent, h, inject } from 'vue'
import type { FieldNode, FormoConfig, FormoDriver } from '../types'
import { FormoContainerKey, injectController, injectFormoOptions } from '../composables/context'
import { locate } from '../core/locate'
import { deepMerge, joinPath } from '../core/utils'
import { groupNamespaces } from '../core/values'
import FormoNode from './FormoNode'

interface Entry {
  node: FieldNode
  path: string
  parentPath: string
  parentAlias: string | number
  groupPath: string
}

const isGroup = (node: FieldNode, drivers: Record<string, FormoDriver>) =>
  !!drivers[node.driver]?.parent || node.fields.length > 0

/**
 * Renders every field of the current form / subform / row that you didn't place
 * yourself with <FormoRender> — like Symfony's `form_rest()`. Put it at the end
 * of a custom layout so nothing is forgotten (unrendered fields aren't validated).
 *
 * A subform you placed only some fields of gets the rest of its fields rendered
 * individually here. A repeatable group whose rows you render yourself
 * (`row.fields.number`) counts as placed.
 */
export default defineComponent({
  name: 'FormoRest',
  props: {
    /** Subform to render the rest of (default: the one this layout is in, or the form) */
    path: { type: String, default: undefined },
  },
  setup(props) {
    const form = injectController()
    const options = injectFormoOptions()
    const container = inject(FormoContainerKey, () => ({ path: '', prefix: '' }))

    const entries = computed<Entry[]>(() => {
      const { drivers, config } = options.value
      const root = form.root
      const claimed = form._claimed
      const target = props.path ?? container().path

      // Which node's children, under which value prefix
      let group: FieldNode | undefined
      let prefix = ''
      let groupPath = ''
      let cfg: FormoConfig = config
      if (target === '') {
        group = root
      } else if (/\[\d+\]$/.test(target)) {
        // A blueprint row: phones[2]
        const blueprint = target.replace(/\[\d+\]$/, '')
        group = locate(root, blueprint, drivers, config)?.node
        prefix = target
        groupPath = blueprint
      } else {
        const located = locate(root, target, drivers, config)
        group = located?.node
        prefix = located?.childPrefix ?? ''
        groupPath = located?.path ?? ''
      }
      if (!group) return []

      /** Rows of a repeatable group placed by hand (`phones[0].number`): you're rendering its rows yourself */
      const rowsClaimed = (path: string) => [...claimed].some((p) => p.startsWith(`${path}[`))

      const claimedUnder = (node: FieldNode, nodePrefix: string, c: FormoConfig): boolean =>
        node.fields.some((child) => {
          const path = joinPath(nodePrefix, child.alias)
          if (claimed.has(path)) return true
          if (child.blueprint) return rowsClaimed(path)
          if (!isGroup(child, drivers)) return false
          const childCfg = child.config ? deepMerge(c, child.config) : c
          return claimedUnder(child, groupNamespaces(child, c) ? path : nodePrefix, childCfg)
        })

      const out: Entry[] = []
      const collect = (node: FieldNode, nodePrefix: string, nodeGroupPath: string, c: FormoConfig) => {
        const nodeCfg = node.config ? deepMerge(c, node.config) : c
        for (const child of node.fields) {
          const path = joinPath(nodePrefix, child.alias)
          if (claimed.has(path) || (child.blueprint && rowsClaimed(path))) continue
          if (isGroup(child, drivers) && !child.blueprint) {
            const childPrefix = groupNamespaces(child, nodeCfg) ? path : nodePrefix
            if (claimedUnder(child, childPrefix, nodeCfg)) {
              // Partly placed by hand: render the rest of it field by field
              collect(child, childPrefix, path, nodeCfg)
              continue
            }
          }
          out.push({ node: child, path, parentPath: nodePrefix, parentAlias: node.alias, groupPath: nodeGroupPath })
        }
      }
      collect(group, prefix, groupPath, cfg)
      return out
    })

    return () => entries.value.map((e) => h(FormoNode, { ...e, key: e.path }))
  },
})
