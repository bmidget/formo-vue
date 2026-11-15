<script setup lang="ts">
/** Stub of Nuxt UI's UInput */
import { computed } from 'vue'
import { ring, useFormField } from './useFormField'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  name?: string
  type?: string
  placeholder?: string
  color?: string
  variant?: string
  size?: string
  required?: boolean
  autocomplete?: string
  disabled?: boolean
  highlight?: boolean
  modelValue?: string | number | null
  modelModifiers?: Record<string, boolean>
  class?: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [event: FocusEvent]; change: [event: Event] }>()
const { id, color, highlight, ariaAttrs } = useFormField(props)
const sizes: Record<string, string> = { sm: 'px-2 py-1 text-xs', md: 'px-2.5 py-1.5 text-sm', lg: 'px-3 py-2 text-sm', xl: 'px-3 py-2 text-base' }

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  // Like Nuxt UI: type="number" (or .number) emits numbers
  emit('update:modelValue', props.type === 'number' || props.modelModifiers?.number ? (raw === '' ? raw : Number(raw)) : raw)
}
const base = computed(() => [
  'w-full rounded-md border-0 bg-default text-highlighted placeholder:text-dimmed outline-none disabled:opacity-75',
  sizes[props.size ?? 'md'],
  props.variant === 'soft' ? 'bg-elevated/50 ring-0' : ring(color.value, highlight.value),
])
</script>

<template>
  <div data-slot="root" class="relative inline-flex w-full items-center" :class="props.class">
    <input
      :id="id"
      :type="type"
      :name="name"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete ?? 'off'"
      :class="base"
      v-bind="{ ...$attrs, ...ariaAttrs }"
      data-slot="base"
      @input="onInput"
      @blur="emit('blur', $event)"
      @change="emit('change', $event)"
    />
  </div>
</template>
