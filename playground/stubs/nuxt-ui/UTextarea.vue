<script setup lang="ts">
/** Stub of Nuxt UI's UTextarea */
import { ring, useFormField } from './useFormField'

defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    id?: string
    name?: string
    placeholder?: string
    color?: string
    highlight?: boolean
    required?: boolean
    disabled?: boolean
    rows?: number
    autoresize?: boolean
    modelValue?: string | null
    class?: any
  }>(),
  { rows: 3 },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [event: FocusEvent] }>()
const { id, color, highlight, ariaAttrs } = useFormField(props)
</script>

<template>
  <div data-slot="root" class="relative inline-flex w-full" :class="props.class">
    <textarea
      :id="id"
      :name="name"
      :rows="rows"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      class="w-full rounded-md border-0 bg-default px-2.5 py-1.5 text-sm text-highlighted placeholder:text-dimmed outline-none"
      :class="ring(color, highlight)"
      v-bind="{ ...$attrs, ...ariaAttrs }"
      data-slot="base"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @blur="emit('blur', $event)"
    />
  </div>
</template>
