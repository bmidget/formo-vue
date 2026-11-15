import { computed, defineComponent, h, type PropType } from 'vue'
import type { FieldNode } from '../types'
import { injectController, injectFormoOptions } from '../composables/context'
import { getPath } from '../core/utils'
import FormoFieldEngine from './FormoFieldEngine'
import FormoGroupEngine from './FormoGroupEngine'
import FormoBlueprintEngine from './FormoBlueprintEngine'

/**
 * Renders any node (internal): subforms → the group engine, repeatable groups →
 * the blueprint engine, everything else → the field engine. Handles `render`
 * (static or a function of the values). Each engine renders the node's view.
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
        // Slots: your markup for the subform / repeatable group, its fields (#fields) or rows (#row)
        return h(node.blueprint ? FormoBlueprintEngine : FormoGroupEngine, childProps, slots)
      }

      // Re-mount when the driver changes (different control, different field setup)
      return h(FormoFieldEngine, { ...childProps, part: props.part, key: node.driver }, slots)
    }
  },
})
