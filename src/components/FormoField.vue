<script setup lang="ts" generic="H extends FormoHandle">
/**
 * Render any field, subform or repeatable group of a form, from its handle —
 * Formo's `$form->email->render()`:
 *
 *   <FormoField :field="form.fields.email" />                 label, control, help, errors (the theme's view)
 *   <FormoField :field="form.fields.address" />               a whole subform
 *   <FormoField :field="form.fields.address.fields.zip" />
 *
 * The default slot replaces the whole field with your markup; it gets the
 * field, and the theme's parts render it wherever you want them:
 *
 *   <FormoField :field="form.fields.email" v-slot="{ field }">
 *     <div class="grid grid-cols-2">
 *       <div class="my-label"><FormoLabel :field="field" /></div>
 *       <FormoInput :field="field" />
 *       <div class="my-box"><FormoErrors :field="field" /></div>
 *     </div>
 *   </FormoField>
 *
 * Or keep the theme's view and take over one region — `#label`, `#input`,
 * `#help`, `#errors`, `#checklist` — rendering its part inside your markup:
 *
 *   <FormoField :field="form.fields.price">
 *     <template #input><div class="flex"><span>$</span><FormoInput /></div></template>
 *   </FormoField>
 *
 * Subforms and repeatable groups work the same way. The default slot replaces
 * the whole thing — a subform gets `{ group, fields }`, a repeatable group
 * `{ rows, add, remove, canAdd, canRemove }` (`v-for="row in rows" :key="row.key"`).
 * Or keep the theme's view and lay out the inside: `#fields` (a subform's
 * fields), `#row="{ row }"` (one row: `row.fields.number`). Slot props are typed
 * from the handle.
 *
 * Works inside `<FormoForm>` or anywhere else (the handle knows its form).
 */
import { h } from 'vue'
import type { FormoHandle } from '../types'
import type { FormoFieldSlots } from './fieldSlots'
import FormoRender, { formKey } from './FormoRender'

const props = defineProps<{
  /** A handle: `form.fields.email`, `form.fields.address.fields.zip`, `form.field('address.zip')` */
  field: H
}>()
const slots = defineSlots<FormoFieldSlots<H>>()

/**
 * Our slots go straight through (no wrapping): the engines check whether you gave one.
 * Keyed by form, not by path: a row handle that shifts (`phones[1]` → `phones[0]`
 * after a remove) keeps its field, like the theme's own rows do.
 */
const Render = () =>
  h(
    FormoRender,
    // The handle's path is absolute: no resolving relative to the subform we're in, nor by alias
    { key: formKey(props.field.form), form: props.field.form, path: props.field.path, exact: true },
    slots as Record<string, (...args: any[]) => any>,
  )
</script>

<template>
  <Render />
</template>
