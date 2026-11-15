<script setup lang="ts">
/** Stub of Nuxt UI's USwitch */
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
  modelValue?: boolean | null
  class?: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { id, color, ariaAttrs } = useFormField(props)
</script>

<template>
  <div data-slot="root" class="relative flex items-start gap-2" :class="props.class">
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="!!modelValue"
      :disabled="disabled"
      class="inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors"
      :class="[modelValue ? 'bg-primary' : 'bg-accented', color === 'error' && 'ring-2 ring-error']"
      v-bind="{ ...$attrs, ...ariaAttrs }"
      data-slot="base"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="size-4 rounded-full bg-white shadow transition-transform" :class="modelValue && 'translate-x-4'" />
    </button>
    <input v-if="name" type="hidden" :name="name" :value="modelValue ? 'on' : ''" />
    <div v-if="label || description" class="text-sm">
      <label :for="id" class="block font-medium text-default" :class="required && `after:ms-0.5 after:text-error after:content-['*']`">{{ label }}</label>
      <p v-if="description" class="text-muted">{{ description }}</p>
    </div>
  </div>
</template>
