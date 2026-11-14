import { defineComponent, provide } from 'vue'
import { FormoContainerKey } from '../composables/context'

/** Scopes relative <FormoRender> paths to one blueprint row (`number` → `phones[2].number`) */
export default defineComponent({
  name: 'FormoBlueprintRow',
  props: { prefix: { type: String, required: true } },
  setup(props, { slots }) {
    // A getter: rows shift index when an earlier one is removed
    provide(FormoContainerKey, () => ({ path: props.prefix, prefix: props.prefix }))
    return () => slots.default?.()
  },
})
