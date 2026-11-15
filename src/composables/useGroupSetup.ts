import { computed, provide, watchEffect, type ComputedRef } from 'vue'
import type { FieldNode, FormoClasses, FormoResolvedOptions } from '../types'
import { applyLayer, FormoOptionsKey, injectController, injectFormoOptions, nodeClasses, type FormoGroupState } from './context'
import { getTranslator } from '../i18n/translator'
import { resolveLabel } from '../core/labels'
import { groupNamespaces } from '../core/values'

export interface GroupProps {
  node: FieldNode
  path: string
  parentPath: string
  parentAlias?: string | number
  groupPath?: string
}

/**
 * Shared setup of the group / blueprint engines: cascades the group's `components` / `config` / `theme`
 * to its children, registers the group with the form, and exposes its label,
 * error and the value prefix for its children.
 */
export function useGroupSetup(props: GroupProps, getState?: () => FormoGroupState) {
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

  /** Classes for the group itself: the cascaded ones + its own `classes` */
  const classes: ComputedRef<FormoClasses> = computed(() => nodeClasses(options.value, props.node.classes))
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
        // Lets <FormoLabel :field="form.fields.address" /> & co. render its pieces anywhere
        get groupState() {
          return getState?.()
        },
      }),
    )
  })

  /** Help text (translated) */
  const message = computed(() => (props.node.message ? getTranslator(options.value.config).text(props.node.message) : undefined))

  return { form, options, childPrefix, classes, label, message, error, ignored }
}
