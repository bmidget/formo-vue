import { defineComponent, h, inject, markRaw, provide, type PropType, type VNode } from 'vue'
import type { FieldNode } from '../types'
import { FormoContainerKey, FormoPartOwnerKey, FormoSlotsKey, type FormoGroupSlotProps, type FormoGroupState } from '../composables/context'
import { useGroupSetup } from '../composables/useGroupSetup'
import { toId } from '../core/utils'
import { nodeView } from './resolve'
import { findNodeSlot, hasContent } from './slots'
import FormoChildren from './FormoChildren.vue'

/**
 * The engine of a subform (internal): cascades its overrides, registers it,
 * and renders it — like a field:
 *
 *  - the default slot (of <FormoField> / <FormoRender>, or `#field:path` on <FormoForm>)
 *    replaces the whole subform with your markup (`{ group, fields }`);
 *  - `#fields` lays its fields out inside the theme's view (legend, help, error kept);
 *  - otherwise the view (`group`, or the node's `view`) with every field in order.
 *
 * Values of its fields are namespaced under the group alias (`address.street`,
 * `name="user[address][street]"`) unless `config: { namespaces: false }`.
 */
export default defineComponent({
  name: 'FormoGroupEngine',
  props: {
    node: { type: Object as PropType<FieldNode>, required: true },
    path: { type: String, required: true },
    parentPath: { type: String, default: '' },
    parentAlias: { type: [String, Number], default: undefined },
    groupPath: { type: String, default: '' },
  },
  setup(props, { slots }) {
    const { form, options, childPrefix, classes, label, message, error, ignored } = useGroupSetup(props, () => state)
    const formSlots = inject(FormoSlotsKey, {})
    const findSlot = (name: string, formName = name) => findNodeSlot(slots, formSlots, props.path, name, formName)

    // <FormoRender path="street" /> inside a custom layout means this subform's street
    provide(FormoContainerKey, () => ({ path: props.path, prefix: childPrefix.value }))

    const state: FormoGroupState = markRaw({
      get node() { return props.node },
      get path() { return props.path },
      get id() { return `${toId(form.alias, props.path)}-group` },
      get label() { return label.value },
      get message() { return message.value },
      get error() { return error.value },
      get ignored() { return ignored.value },
      get classes() { return classes.value },
      form,
    })

    // <FormoLabel />, <FormoErrors />… in its slots render this subform's pieces
    provide(FormoPartOwnerKey, { kind: 'group', state })

    const slotProps = (): FormoGroupSlotProps => ({ group: state, fields: form.field(props.path)?.fields ?? {}, form })

    /** Every field in order */
    const Fields = () =>
      h(FormoChildren, { fields: props.node.fields, prefix: childPrefix.value, parentAlias: props.node.alias, groupPath: props.path })

    /** Your layout of the fields (`#fields`), else all of them */
    const Body = () => {
      const custom: VNode[] | undefined = findSlot('fields')?.(slotProps())
      return hasContent(custom) ? custom : h(Fields)
    }

    return () => {
      // Your own markup for the whole subform
      const whole: VNode[] | undefined = findSlot('default', 'field')?.(slotProps())
      if (hasContent(whole)) return whole

      const View = nodeView(props.node, 'group', options.value)
      return View ? h(View as any, { formo: state }, { default: () => h(Body) }) : h(Body)
    }
  },
})
