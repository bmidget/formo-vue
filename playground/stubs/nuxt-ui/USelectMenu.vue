<script setup lang="ts">
/** Stub of Nuxt UI's USelectMenu — the USelect listbox with a search input (see SelectBase.vue) */
import SelectBase from './SelectBase.vue'

defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    id?: string
    name?: string
    items?: unknown[]
    modelValue?: unknown
    placeholder?: string
    searchInput?: boolean | { placeholder?: string }
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
  }>(),
  { searchInput: true },
)
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [event: FocusEvent]; focus: [event: FocusEvent] }>()
</script>

<template>
  <SelectBase
    v-bind="{ ...$props, class: undefined, searchInput: undefined }"
    :searchable="searchInput !== false"
    :search-placeholder="typeof searchInput === 'object' ? searchInput.placeholder : undefined"
    :root-class="$props.class"
    :attrs="$attrs"
    @update:model-value="emit('update:modelValue', $event)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>
