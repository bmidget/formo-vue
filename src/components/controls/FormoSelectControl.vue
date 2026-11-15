<script setup lang="ts">
/**
 * `<select>` for the `select` driver — Formo's `opts/select_template.php`:
 * optional blank option, optgroups, and `multiple` (array value).
 * Option values keep their JS type (numbers stay numbers).
 */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { flattenOptions, isOptionGroup, sameValue } from '../../core/options'
import { cx } from '../../core/theme'
import { withoutClass } from './attrs'
import { getTranslator } from '../../i18n/translator'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [] }>()

const multiple = computed(() => !!props.formo.node.attr.multiple)
const blank = computed(() => {
  const b = props.formo.node.blank
  if (b === undefined || b === false || multiple.value) return null
  return typeof b === 'string' ? getTranslator(props.formo.form.options.config).text(b) : ''
})

const flat = computed(() => flattenOptions(props.formo.options))

function isSelected(value: unknown) {
  const current = props.modelValue
  return Array.isArray(current) ? current.some((v) => sameValue(v, value)) : sameValue(current, value)
}

function onChange(event: Event) {
  const el = event.target as HTMLSelectElement
  const picked = Array.from(el.selectedOptions).map((o) => {
    const idx = Number(o.dataset.index)
    return Number.isNaN(idx) ? null : flat.value[idx]?.value
  })
  emit('update:modelValue', multiple.value ? picked.filter((v) => v !== null) : (picked[0] ?? null))
}

const indexOf = (value: unknown) => flat.value.findIndex((o) => o.value === value)
</script>

<template>
  <select
    v-bind="{ ...formo.attrs, ...withoutClass($attrs) }"
    :multiple="multiple"
    :class="cx(formo.classes.control, formo.classes.select, formo.invalid && formo.classes.controlInvalid, formo.node.attr.class, $attrs.class)"
    @change="onChange"
    @blur="emit('blur')"
  >
    <option v-if="blank !== null" value="" :selected="modelValue === null || modelValue === undefined || modelValue === ''">
      {{ blank }}
    </option>
    <template v-for="(item, i) in formo.options" :key="i">
      <optgroup v-if="isOptionGroup(item)" :label="item.label" :disabled="item.disabled">
        <option
          v-for="opt in item.options"
          :key="String(opt.value)"
          :value="String(opt.value)"
          :data-index="indexOf(opt.value)"
          :disabled="opt.disabled"
          :selected="isSelected(opt.value)"
        >
          {{ opt.label }}
        </option>
      </optgroup>
      <option
        v-else
        :value="String(item.value)"
        :data-index="indexOf(item.value)"
        :disabled="item.disabled"
        :selected="isSelected(item.value)"
      >
        {{ item.label }}
      </option>
    </template>
  </select>
</template>
