<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, inject } from 'vue'
import { cn } from '../../lib/utils'
import { RadioGroupKey } from './context'

const props = defineProps<{ value: unknown; id?: string; disabled?: boolean; class?: HTMLAttributes['class'] }>()
const group = inject(RadioGroupKey)!
const checked = computed(() => group.model.value === props.value)
</script>

<template>
  <button
    :id="id"
    type="button"
    role="radio"
    data-slot="radio-group-item"
    :aria-checked="checked"
    :data-state="checked ? 'checked' : 'unchecked'"
    :disabled="disabled || group.disabled.value"
    :class="cn(
      'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    @click="group.select(value)"
  >
    <span v-if="checked" data-slot="radio-group-indicator" class="relative flex items-center justify-center">
      <span class="bg-primary block size-2 rounded-full" />
    </span>
  </button>
</template>
