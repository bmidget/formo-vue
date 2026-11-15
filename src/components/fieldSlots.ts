import type { VNode } from 'vue'
import type { FormoBlueprintHandle, FormoFields, FormoHandle } from '../types'
import type {
  FormoBlueprintSlotProps,
  FormoFieldSlotProps,
  FormoGroupSlotProps,
  FormoRowSlotProps,
} from '../composables/context'

type Slot<P> = (props: P) => VNode[]

type GroupFields<H> = H extends { kind: 'group'; fields: infer F } ? F : FormoFields
type RowFields<H> = H extends FormoBlueprintHandle<infer F> ? F : FormoFields

/** The slots of `<FormoField>`, typed from the handle it renders */
export interface FormoFieldSlots<H extends FormoHandle = FormoHandle> {
  /**
   * Your own markup for the whole thing, instead of the theme's view:
   *  - a field: `{ field }` — render its parts with <FormoLabel :field="field" />, <FormoInput>, <FormoErrors>…
   *  - a subform: `{ group, fields }` — `<FormoField :field="fields.street" />`, <FormoErrors :field="group" />…
   *  - a repeatable group: `{ rows, add, remove, canAdd, canRemove }` — `v-for="row in rows" :key="row.key"`
   */
  default?: Slot<
    H extends { kind: 'field' }
      ? FormoFieldSlotProps
      : H extends { kind: 'blueprint' }
        ? FormoBlueprintSlotProps<RowFields<H>>
        : H extends { kind: 'group' }
          ? FormoGroupSlotProps<GroupFields<H>>
          : FormoFieldSlotProps & FormoGroupSlotProps & FormoBlueprintSlotProps
  >
  /** A field's label region, in the theme's view: `<template #label="{ props }">…<FormoLabel v-bind="props" />…</template>` */
  label?: Slot<FormoFieldSlotProps>
  /** A field's control region, in the theme's view: `<template #input>…<FormoInput />…</template>` */
  input?: Slot<FormoFieldSlotProps>
  help?: Slot<FormoFieldSlotProps>
  errors?: Slot<FormoFieldSlotProps>
  checklist?: Slot<FormoFieldSlotProps>
  /** A subform: your layout of its fields, inside the theme's view (legend, help, error kept) */
  fields?: Slot<FormoGroupSlotProps<GroupFields<H>>>
  /** A repeatable group: your layout of a row, inside the theme's views (`{ row }` → `row.fields.number`) */
  row?: Slot<FormoRowSlotProps<RowFields<H>>>
}
