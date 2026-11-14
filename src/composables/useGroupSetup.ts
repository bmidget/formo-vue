import { computed, provide, watchEffect, type ComputedRef } from 'vue'
import type { FieldNode, FormoResolvedOptions, FormoTheme } from '../types'
import { applyLayer, FormoOptionsKey, injectController, injectFormoOptions } from './context'
import { resolveLabel } from '../core/labels'
import { mergeTheme } from '../core/theme'
import { groupNamespaces } from '../core/values'

export interface GroupProps {
  node: FieldNode
  path: string
  parentPath: string
  parentAlias?: string | number
  groupPath?: string
}

/**
 * Shared setup for group-like components (FormoGroup, FormoBlueprint, or your
 * own group component): cascades the group's `components` / `config` / `theme`
 * to its children, registers the group with the form, and exposes its label,
 * error and the value prefix for its children.
 */
export function useGroupSetup(props: GroupProps) {
  const form = injectController()
  const parentOptions = injectFormoOptions()

  const options: ComputedRef<FormoResolvedOptions> = computed(() =>
    applyLayer(parentOptions.value, {
      components: props.node.components,
      config: props.node.config,
      theme: props.node.theme,
    }),
  )
  provide(FormoOptionsKey, options)

  /** Where children's values live: under the group (namespaced) or alongside it */
  const childPrefix = computed(() =>
    props.node.blueprint || groupNamespaces(props.node, parentOptions.value.config) ? props.path : props.parentPath,
  )

  const theme: ComputedRef<FormoTheme> = computed(() => mergeTheme(options.value.theme, props.node.classes))
  const label = computed(() => resolveLabel(props.node, props.path, options.value.config, props.parentAlias))
  const error = computed(() => form.error(props.path))
  /** Fully optional right now (`ignore` condition, a parent, or another field's `ignores`) */
  const ignored = computed(() => form.isIgnored(props.path))

  watchEffect((onCleanup) => {
    onCleanup(
      form._register({
        node: props.node,
        path: props.path,
        valuePath: childPrefix.value,
        parentPath: props.parentPath,
        groupPath: props.groupPath ?? '',
        kind: 'group',
        label: () => label.value,
      }),
    )
  })

  return { form, options, childPrefix, theme, label, error, ignored }
}
