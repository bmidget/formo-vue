<script setup lang="ts">
/** Stub of Nuxt UI's UCheckbox: a Reka UI checkbox (a button) with its own label and description */
import { useFormField } from './useFormField'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  name?: string
  label?: string
  description?: string
  required?: boolean
  disabled?: boolean
  color?: string
  highlight?: boolean
  modelValue?: boolean | null
  class?: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; change: [event: Event] }>()
const { id, color, ariaAttrs } = useFormField(props)
</script>

<template>
  <div data-slot="root" class="relative flex items-start gap-2" :class="props.class">
    <button
      :id="id"
      type="button"
      role="checkbox"
      :aria-checked="!!modelValue"
      :disabled="disabled"
      class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm text-[10px] text-white"
      :class="[modelValue ? 'bg-primary' : 'ring ring-inset', color === 'error' ? 'ring-error' : 'ring-accented']"
      v-bind="{ ...$attrs, ...ariaAttrs }"
      data-slot="base"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span v-if="modelValue" aria-hidden="true">✓</span>
    </button>
    <!-- Reka UI renders a hidden input for native form submits -->
    <input v-if="name" type="hidden" :name="name" :value="modelValue ? 'on' : ''" />
    <div v-if="label || description" class="text-sm">
      <label :for="id" class="block font-medium text-default" :class="required && `after:ms-0.5 after:text-error after:content-['*']`">{{ label }}</label>
      <p v-if="description" class="text-muted">{{ description }}</p>
    </div>
  </div>
</template>
