<script setup lang="ts">
/**
 * A subform / group of fields — Formo's `group_template.php`.
 *
 * Values of its fields are namespaced under the group alias (`address.street`,
 * `name="user[address][street]"`) unless `config: { namespaces: false }`.
 * Group-level rules get the group's values; their error renders here.
 *
 * Hide the legend with `label: false`. Lay fields out with
 * `classes: { groupBody: 'grid gap-4 sm:grid-cols-2' }`, or completely by hand:
 *
 *   <FormoRender path="address">
 *     <FormoRender path="street" />   ← relative to the subform
 *     <div class="flex gap-4"><FormoRender path="zip" /><FormoRender path="city" /></div>
 *   </FormoRender>
 */
import type { FieldNode } from '../types'
import { useGroupSetup } from '../composables/useGroupSetup'
import { toId } from '../core/utils'
import { cx } from '../core/theme'
import { computed, h, provide, useSlots } from 'vue'
import { hasContent } from './slots'
import { FormoContainerKey } from '../composables/context'
import { getTranslator } from '../i18n/translator'
import FormoChildren from './FormoChildren.vue'

const props = withDefaults(
  defineProps<{ node: FieldNode; path: string; parentPath?: string; parentAlias?: string | number; groupPath?: string }>(),
  { parentPath: '', parentAlias: undefined, groupPath: '' },
)

const { form, options, childPrefix, theme, label, error, ignored } = useGroupSetup(props)
const helpText = computed(() => getTranslator(options.value.config).text(props.node.message))

// <FormoRender path="street" /> inside a custom layout means this subform's street
provide(FormoContainerKey, () => ({ path: props.path, prefix: childPrefix.value }))

const slots = useSlots()
const Body = () => {
  const custom = slots.default?.({ form, path: props.path })
  return hasContent(custom)
    ? custom
    : h(FormoChildren, { fields: props.node.fields, prefix: childPrefix.value, parentAlias: props.node.alias, groupPath: props.path })
}
</script>

<template>
  <fieldset
    :id="`${toId(form.alias, path)}-group`"
    :class="cx(theme.group, ignored && theme.ignored)"
    :data-formo-group="path"
    :data-invalid="!!error || undefined"
    :data-ignored="ignored || undefined"
  >
    <legend v-if="label" :class="theme.groupLegend">{{ label }}</legend>
    <p v-if="node.message" :class="theme.help">{{ helpText }}</p>
    <p v-if="error" :class="theme.groupError" role="alert">{{ error }}</p>
    <div :class="theme.groupBody">
      <!-- A custom layout (from <FormoRender path="…">…</FormoRender>): paths inside are relative to this subform -->
      <Body />
    </div>
  </fieldset>
</template>
