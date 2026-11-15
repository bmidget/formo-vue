<script setup lang="ts">
import { computed, provide, ref, shallowReactive } from 'vue'
import { SelectKey } from './context'

// shadcn-vue: a Reka UI SelectRoot (+ a hidden native <select> with `name`, for form posts)
const props = defineProps<{
  modelValue?: unknown
  defaultValue?: unknown
  open?: boolean
  multiple?: boolean
  disabled?: boolean
  name?: string
  required?: boolean
}>()
const emits = defineEmits<{ (e: 'update:modelValue', payload: unknown): void; (e: 'update:open', payload: boolean): void }>()
const openState = ref(!!props.open)
const model = computed(() => props.modelValue ?? props.defaultValue)
const labels = shallowReactive(new Map<unknown, string>())
const isSelected = (value: unknown) =>
  props.multiple ? Array.isArray(model.value) && model.value.includes(value) : model.value === value

function setOpen(open: boolean) {
  openState.value = open
  emits('update:open', open)
}

provide(SelectKey, {
  model,
  open: openState,
  multiple: computed(() => !!props.multiple),
  disabled: computed(() => !!props.disabled),
  labels,
  isSelected,
  select(value) {
    if (!props.multiple) {
      emits('update:modelValue', value)
      setOpen(false)
      return
    }
    const current = Array.isArray(model.value) ? model.value : []
    emits('update:modelValue', isSelected(value) ? current.filter((v) => v !== value) : [...current, value])
  },
  setOpen,
})
const selectedValues = computed(() => (Array.isArray(model.value) ? model.value : model.value === undefined || model.value === null ? [] : [model.value]))
</script>

<template>
  <slot />
  <select v-if="name" :name="name" :multiple="multiple" hidden aria-hidden="true" tabindex="-1">
    <option v-for="value in selectedValues" :key="String(value)" :value="String(value)" selected />
  </select>
</template>
