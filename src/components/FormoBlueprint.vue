<script setup lang="ts">
/**
 * A repeatable group — Formo's blueprints (`blueprint => TRUE`, `pad_blueprint()`).
 *
 * The group's `fields` are the template for one row; the value is an array of
 * row objects (`phones[0].number`). `val` pre-fills rows (like
 * `pad_blueprint($rows)`), `min` pads empty rows and prevents removing below it,
 * `max` caps the number of rows.
 *
 * Labels: `addLabel`, `removeLabel`, and `rowLabel` (`:index` / `:label` placeholders).
 *
 * Custom row layout — paths inside are relative to the row:
 *   <FormoRender path="phones">
 *     <template #row><FormoRender path="type" part="input" /> <FormoRender path="number" part="input" /></template>
 *   </FormoRender>
 */
import { computed } from 'vue'
import { useFieldArray } from 'vee-validate'
import type { FieldNode } from '../types'
import { useGroupSetup } from '../composables/useGroupSetup'
import { buildInitialValues } from '../core/values'
import { deepClone, interpolate, toId } from '../core/utils'
import { getTranslator } from '../i18n/translator'
import { cx } from '../core/theme'
import FormoChildren from './FormoChildren.vue'
import FormoBlueprintRow from './FormoBlueprintRow'

const props = withDefaults(
  defineProps<{ node: FieldNode; path: string; parentPath?: string; parentAlias?: string | number; groupPath?: string }>(),
  { parentPath: '', parentAlias: undefined, groupPath: '' },
)

const { form, options, theme, label, error, ignored } = useGroupSetup(props)

// useFieldArray needs an array to work with
if (!Array.isArray(form.val(props.path))) form.val(props.path, [])

const { fields, push, remove } = useFieldArray<Record<string, unknown>>(() => props.path)

const rowDefaults = computed(() =>
  buildInitialValues({ ...props.node, blueprint: false }, options.value.drivers, options.value.config),
)

const min = computed(() => props.node.min ?? 0)
const max = computed(() => props.node.max)
const canAdd = computed(() => max.value === undefined || fields.value.length < max.value)
const canRemove = computed(() => fields.value.length > min.value)

const tr = computed(() => getTranslator(options.value.config))
const helpText = computed(() => tr.value.text(props.node.message))
const addText = computed(() => (props.node.addLabel ? tr.value.text(props.node.addLabel) : tr.value.ui('add')))
const removeText = computed(() => (props.node.removeLabel ? tr.value.text(props.node.removeLabel) : tr.value.ui('remove')))
const rowLabel = (index: number) => {
  const params = { label: label.value, index: index + 1 }
  const custom = props.node.vars.rowLabel
  return typeof custom === 'string' ? interpolate(tr.value.text(custom), params) : tr.value.ui('rowLabel', params)
}

const titleId = computed(() => `${toId(form.alias, props.path)}-title`)

function add() {
  if (canAdd.value) push(deepClone(rowDefaults.value))
}
</script>

<template>
  <div
    :class="cx(theme.blueprint, ignored && theme.ignored)"
    :data-ignored="ignored || undefined"
    role="group"
    :aria-labelledby="label ? titleId : undefined"
    :data-formo-group="path"
    :data-invalid="!!error || undefined"
  >
    <div v-if="label" :id="titleId" :class="theme.title">{{ label }}</div>
    <p v-if="node.message" :class="theme.help">{{ helpText }}</p>
    <p v-if="error" :class="theme.groupError" role="alert">{{ error }}</p>

    <div
      v-for="(entry, index) in fields"
      :key="entry.key"
      :class="theme.blueprintRow"
      :data-blueprint-key="index"
    >
      <div :class="theme.blueprintRowHeader">
        <span>{{ rowLabel(index) }}</span>
        <button v-if="canRemove" type="button" :class="theme.blueprintRemove" @click="remove(index)">
          {{ removeText }}
        </button>
      </div>
      <!-- Custom row layout: <FormoRender path="phones"><template #row="{ index }">…</template></FormoRender> -->
      <FormoBlueprintRow :prefix="`${path}[${index}]`">
        <slot name="row" :index="index" :path="`${path}[${index}]`" :remove="() => remove(index)" :canRemove="canRemove">
          <FormoChildren :fields="node.fields" :prefix="`${path}[${index}]`" :parent-alias="node.alias" :group-path="path" />
        </slot>
      </FormoBlueprintRow>
    </div>

    <button v-if="canAdd" type="button" :class="theme.blueprintAdd" @click="add">
      <span aria-hidden="true">+</span> {{ addText }}
    </button>
  </div>
</template>
