<script setup lang="ts">
import { computed, inject } from 'vue'
import { SelectKey } from './context'

const props = defineProps<{ placeholder?: string }>()
const select = inject(SelectKey)!
const text = computed(() => {
  const value = select.model.value
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return values.map((v) => select.labels.get(v) ?? String(v)).join(', ')
})
</script>

<template>
  <span data-slot="select-value" :data-placeholder="!text || undefined" class="line-clamp-1 flex items-center gap-2">{{ text || props.placeholder }}</span>
</template>
