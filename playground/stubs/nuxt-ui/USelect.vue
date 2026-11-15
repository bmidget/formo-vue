<script setup lang="ts">
/** Stub of Nuxt UI's USelect — a Reka UI listbox (see SelectBase.vue), not a native <select> */
import SelectBase from './SelectBase.vue'

defineOptions({ inheritAttrs: false })
defineProps<{
  id?: string
  name?: string
  items?: unknown[]
  modelValue?: unknown
  placeholder?: string
  multiple?: boolean
  color?: string
  variant?: string
  size?: string
  highlight?: boolean
  disabled?: boolean
  required?: boolean
  valueKey?: string
  labelKey?: string
  class?: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [event: FocusEvent]; focus: [event: FocusEvent]; change: [event: Event] }>()
</script>

<template>
  <SelectBase
    v-bind="{ ...$props, class: undefined }"
    :root-class="$props.class"
    :attrs="$attrs"
    @update:model-value="emit('update:modelValue', $event)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>
