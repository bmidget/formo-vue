import { computed, defineComponent, h, inject, markRaw, provide, watchEffect, type PropType, type VNode } from 'vue'
import { useFieldArray } from 'vee-validate'
import type { FieldNode, FormoBlueprintHandle } from '../types'
import {
  FormoPartOwnerKey,
  FormoSlotsKey,
  type FormoBlueprintRowState,
  type FormoBlueprintSlotProps,
  type FormoBlueprintState,
} from '../composables/context'
import { useGroupSetup } from '../composables/useGroupSetup'
import { buildInitialValues } from '../core/values'
import { deepClone, interpolate, toId } from '../core/utils'
import { getTranslator } from '../i18n/translator'
import { nodeView, resolveView } from './resolve'
import { findNodeSlot, hasContent } from './slots'
import FormoChildren from './FormoChildren.vue'
import FormoBlueprintRow from './FormoBlueprintRow'

/**
 * The engine of a repeatable group — Formo's blueprints (`blueprint => TRUE`,
 * `pad_blueprint()`) (internal).
 *
 * The group's `fields` are the template for one row; the value is an array of
 * row objects (`phones[0].number`). `val` pre-fills rows, `min` pads empty rows
 * and prevents removing below it, `max` caps the number of rows. Labels:
 * `addLabel`, `removeLabel`, and `rowLabel` (`:index` / `:label` placeholders).
 *
 * Renders — like a field:
 *  - the default slot (of <FormoField> / <FormoRender>, or `#field:path` on <FormoForm>):
 *    your own markup for the whole thing (`{ rows, add, remove, canAdd, canRemove }`);
 *  - `#row`: your layout of each row, inside the theme's `blueprint` / `blueprintRow` views;
 *  - otherwise those views, with each row's fields in order.
 */
export default defineComponent({
  name: 'FormoBlueprintEngine',
  props: {
    node: { type: Object as PropType<FieldNode>, required: true },
    path: { type: String, required: true },
    parentPath: { type: String, default: '' },
    parentAlias: { type: [String, Number], default: undefined },
    groupPath: { type: String, default: '' },
  },
  setup(props, { slots }) {
    const { form, options, classes, label, message, error, ignored } = useGroupSetup(props, () => state)
    const formSlots = inject(FormoSlotsKey, {})
    const findSlot = (name: string, formName = name) => findNodeSlot(slots, formSlots, props.path, name, formName)

    // useFieldArray needs an array to work with
    if (!Array.isArray(form.val(props.path))) form.val(props.path, [])

    const { fields, push, remove } = useFieldArray<Record<string, unknown>>(() => props.path)

    // Handles (form.fields.phones.add(), row.key…) go through this field array while it's mounted
    // (follows the path: a repeatable group nested in a row moves when an earlier row is removed)
    watchEffect((onCleanup) => {
      onCleanup(
        form._registerArray(props.path, {
          keys: () => fields.value.map((entry) => entry.key),
          push: (row) => push(row),
          remove: (index) => remove(index),
        }),
      )
    })

    const rowDefaults = computed(() =>
      buildInitialValues({ ...props.node, blueprint: false }, options.value.drivers, options.value.config),
    )

    const min = computed(() => props.node.min ?? 0)
    const max = computed(() => props.node.max)
    const canAdd = computed(() => max.value === undefined || fields.value.length < max.value)
    const canRemove = computed(() => fields.value.length > min.value)

    const tr = computed(() => getTranslator(options.value.config))
    const addText = computed(() => (props.node.addLabel ? tr.value.text(props.node.addLabel) : tr.value.ui('add')))
    const removeText = computed(() => (props.node.removeLabel ? tr.value.text(props.node.removeLabel) : tr.value.ui('remove')))
    const rowLabel = (index: number) => {
      const params = { label: label.value, index: index + 1 }
      const custom = props.node.vars.rowLabel
      return typeof custom === 'string' ? interpolate(tr.value.text(custom), params) : tr.value.ui('rowLabel', params)
    }

    function add() {
      if (canAdd.value) push(deepClone(rowDefaults.value))
    }

    const handle = () => form.field(props.path) as FormoBlueprintHandle

    const rows = computed<FormoBlueprintRowState[]>(() =>
      fields.value.map((entry, index) => {
        const path = `${props.path}[${index}]`
        return {
          key: entry.key,
          index,
          path,
          label: rowLabel(index),
          remove: () => remove(index),
          get handle() {
            return handle().rows[index]
          },
        }
      }),
    )

    const state: FormoBlueprintState = markRaw({
      get node() { return props.node },
      get path() { return props.path },
      get id() { return `${toId(form.alias, props.path)}-group` },
      get titleId() { return `${toId(form.alias, props.path)}-title` },
      get label() { return label.value },
      get message() { return message.value },
      get error() { return error.value },
      get ignored() { return ignored.value },
      get classes() { return classes.value },
      get rows() { return rows.value },
      get canAdd() { return canAdd.value },
      get canRemove() { return canRemove.value },
      get addText() { return addText.value },
      get removeText() { return removeText.value },
      add,
      remove: (index: number) => canRemove.value && remove(index),
      form,
    })

    // <FormoLabel />, <FormoErrors />… in its slots render this group's pieces
    provide(FormoPartOwnerKey, { kind: 'group', state })

    /** One row: the `blueprintRow` view around its fields (or your `#row` layout, relative to the row) */
    function renderRow({ row }: { row: FormoBlueprintRowState }): VNode {
      const body = () =>
        h(FormoBlueprintRow, { prefix: row.path }, () =>
          findSlot('row')?.({ row: row.handle, index: row.index, path: row.path, remove: row.remove, canRemove: canRemove.value }) ??
          h(FormoChildren, { fields: props.node.fields, prefix: row.path, parentAlias: props.node.alias, groupPath: props.path }),
        )
      const RowView = resolveView('blueprintRow', options.value)
      return RowView ? h(RowView as any, { key: row.key, formo: state, row }, { default: body }) : h('div', { key: row.key }, body())
    }

    const slotProps = (): FormoBlueprintSlotProps => ({
      blueprint: state,
      rows: handle().rows,
      add: (values) => handle().add(values),
      remove: (index) => handle().remove(index),
      canAdd: canAdd.value,
      canRemove: canRemove.value,
      form,
    })

    return () => {
      // Your own markup for the whole thing
      const whole: VNode[] | undefined = findSlot('default', 'field')?.(slotProps())
      if (hasContent(whole)) return whole

      const View = nodeView(props.node, 'blueprint', options.value)
      return View
        ? h(View as any, { formo: state }, { row: renderRow })
        : rows.value.map((row) => renderRow({ row }))
    }
  },
})
