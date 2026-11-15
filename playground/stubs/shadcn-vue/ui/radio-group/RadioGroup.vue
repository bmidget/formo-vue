<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, provide } from 'vue'
import { cn } from '../../lib/utils'
import { RadioGroupKey } from './context'

// shadcn-vue: a Reka UI RadioGroupRoot (+ a hidden input with `name`)
const props = defineProps<{
  modelValue?: unknown
  defaultValue?: unknown
  disabled?: boolean
  name?: string
  required?: boolean
  orientation?: 'horizontal' | 'vertical'
  class?: HTMLAttributes['class']
}>()
const emits = defineEmits<{ (e: 'update:modelValue', payload: unknown): void }>()
provide(RadioGroupKey, {
  model: computed(() => props.modelValue ?? props.defaultValue),
  select: (value) => emits('update:modelValue', value),
  disabled: computed(() => !!props.disabled),
})
</script>

<template>
  <div role="radiogroup" data-slot="radio-group" :aria-required="required || undefined" :class="cn('grid gap-3', props.class)">
    <slot />
    <input v-if="name && modelValue !== undefined && modelValue !== null" type="hidden" :name="name" :value="String(modelValue)" />
  </div>
</template>
