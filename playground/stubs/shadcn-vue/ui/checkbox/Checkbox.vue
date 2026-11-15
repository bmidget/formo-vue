<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'

// shadcn-vue: a Reka UI CheckboxRoot (a button, plus a hidden input for form posts)
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  modelValue?: boolean | 'indeterminate' | null
  defaultValue?: boolean
  disabled?: boolean
  value?: string
  id?: string
  name?: string
  required?: boolean
  class?: HTMLAttributes['class']
}>()
const emits = defineEmits<{ (e: 'update:modelValue', payload: boolean): void }>()
</script>

<template>
  <button
    :id="id"
    type="button"
    role="checkbox"
    data-slot="checkbox"
    :aria-checked="!!modelValue"
    :aria-required="required || undefined"
    :data-state="modelValue ? 'checked' : 'unchecked'"
    :disabled="disabled"
    v-bind="$attrs"
    :class="cn(
      'peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    @click="emits('update:modelValue', !modelValue)"
  >
    <span v-if="modelValue" data-slot="checkbox-indicator" class="flex items-center justify-center text-[10px] leading-none">✓</span>
  </button>
  <input v-if="name" type="hidden" :name="name" :value="modelValue ? (value ?? 'on') : ''" />
</template>
