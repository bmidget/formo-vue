<script setup lang="ts">
/**
 * Radios and checkbox lists — Formo's `opts/radios_template.php`,
 * `opts/checkboxes_template.php` and `opts/set_template.php`.
 *
 *  - `radios`      → single value
 *  - `checkboxes`  → array value
 *  - `set`         → comma separated string value (MySQL SET)
 *
 * Set `inline: true` on the field to lay the options out horizontally.
 */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { flattenOptions, sameValue } from '../../core/options'
import { cx } from '../../core/theme'
import { withoutClass } from './attrs'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [] }>()

const driver = computed(() => props.formo.node.driver)
const isRadio = computed(() => driver.value === 'radios')
const options = computed(() => flattenOptions(props.formo.options))

const selected = computed<unknown[]>(() => {
  const v = props.modelValue
  if (driver.value === 'set') return typeof v === 'string' ? v.split(',').filter(Boolean) : Array.isArray(v) ? v : []
  if (isRadio.value) return v === null || v === undefined ? [] : [v]
  return Array.isArray(v) ? v : []
})

const isChecked = (value: unknown) => selected.value.some((v) => sameValue(v, value))

function toggle(value: unknown, checked: boolean) {
  if (isRadio.value) {
    emit('update:modelValue', value)
    return
  }
  // Keep the option order stable regardless of click order
  const next = options.value
    .map((o) => o.value)
    .filter((v) => (sameValue(v, value) ? checked : isChecked(v)))
  emit('update:modelValue', driver.value === 'set' ? next.map(String).join(',') : next)
}

const describedBy = computed(() => props.formo.attrs['aria-describedby'] as string | undefined)
const optionId = (i: number) => (props.formo.id ? `${props.formo.id}-${i}` : undefined)
</script>

<template>
  <div
    v-bind="withoutClass($attrs)"
    :id="formo.id || undefined"
    :role="isRadio ? 'radiogroup' : 'group'"
    :aria-invalid="formo.invalid || undefined"
    :aria-required="formo.required || undefined"
    :aria-describedby="describedBy"
    :class="cx(formo.classes.optionList, formo.node.vars.inline ? 'sm:flex-row sm:flex-wrap sm:gap-x-6' : '', formo.node.attr.class, $attrs.class)"
  >
    <label v-for="(opt, i) in options" :key="String(opt.value)" :class="formo.classes.optionLabel">
      <input
        :id="optionId(i)"
        :type="isRadio ? 'radio' : 'checkbox'"
        :name="isRadio ? formo.name : `${formo.name}[]`"
        :value="String(opt.value)"
        :checked="isChecked(opt.value)"
        :disabled="opt.disabled || formo.disabled"
        :class="isRadio ? formo.classes.radio : formo.classes.checkbox"
        @change="toggle(opt.value, ($event.target as HTMLInputElement).checked)"
        @blur="emit('blur')"
      />
      <span :class="formo.classes.optionText">{{ opt.label }}</span>
    </label>
  </div>
</template>
