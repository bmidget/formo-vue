<script setup lang="ts">
/** Stub of Nuxt UI's UCheckboxGroup: `items`, `legend`, `orientation`… */
import ChoiceGroup from './ChoiceGroup.vue'

defineOptions({ inheritAttrs: false })
defineProps<{
  name?: string
  items?: unknown[]
  modelValue?: unknown
  legend?: string
  required?: boolean
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  color?: string
  valueKey?: string
  labelKey?: string
  class?: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; change: [event: Event] }>()
</script>

<template>
  <ChoiceGroup kind="checkbox" v-bind="{ ...$attrs, ...$props }" @update:model-value="emit('update:modelValue', $event)" />
</template>
