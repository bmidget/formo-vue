import { computed, defineComponent, h, type Component, type PropType } from 'vue'
import type { FieldNode } from '../types'
import { injectController, injectFormoOptions } from '../composables/context'
import { getPath } from '../core/utils'
import FormoField, { resolveComponentRef } from './FormoField'
import FormoGroup from './FormoGroup.vue'
import FormoBlueprint from './FormoBlueprint.vue'

/**
 * Renders any node: groups → <FormoGroup>, repeatable groups → <FormoBlueprint>,
 * everything else → <FormoField>. Handles `render` (static or a function of the values).
 *
 * Groups can be overridden with `component` on the group, or globally with the
 * `group` / `blueprint` keys of `components`. They receive the same props.
 */
export default defineComponent({
  name: 'FormoNode',
  props: {
    node: { type: Object as PropType<FieldNode>, required: true },
    path: { type: String, required: true },
    parentPath: { type: String, default: '' },
    parentAlias: { type: [String, Number], default: undefined },
    groupPath: { type: String, default: '' },
    /** `field` (default) or `input` (the control only) */
    part: { type: String as PropType<'field' | 'input'>, default: 'field' },
  },
  setup(props, { slots }) {
    const form = injectController()
    const options = injectFormoOptions()

    const visible = computed(() => {
      const render = props.node.render
      if (typeof render === 'function') {
        return render({
          values: form.values,
          parentValues: props.parentPath ? getPath(form.values, props.parentPath) ?? {} : form.values,
          node: props.node,
          path: props.path,
        })
      }
      return render !== false
    })

    return () => {
      if (!visible.value) return null
      const node = props.node
      const opts = options.value
      const driver = opts.drivers[node.driver]
      const childProps = {
        node,
        path: props.path,
        parentPath: props.parentPath,
        parentAlias: props.parentAlias,
        groupPath: props.groupPath,
      }

      if (driver?.parent || node.fields.length) {
        const custom = node.component ? resolveComponentRef(node.component, opts) : undefined
        const comp: Component =
          custom ??
          (node.blueprint
            ? resolveComponentRef(opts.components.blueprint, opts) ?? FormoBlueprint
            : resolveComponentRef(opts.components.group, opts) ?? FormoGroup)
        // Slots = a custom layout for the subform (from <FormoRender>)
        return h(comp as any, childProps, slots)
      }

      // Re-mount when the driver changes (different control, different field setup)
      return h(FormoField, { ...childProps, part: props.part, key: node.driver }, slots)
    }
  },
})
