<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'
import { cn } from '../../lib/utils'
import { SelectKey } from './context'

const props = withDefaults(defineProps<{ class?: HTMLAttributes['class']; size?: 'sm' | 'default' }>(), { size: 'default' })
const select = inject(SelectKey)!
</script>

<template>
  <button
    type="button"
    role="combobox"
    data-slot="select-trigger"
    :data-size="size"
    :aria-expanded="select.open.value"
    :disabled="select.disabled.value"
    :class="cn(
      'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8',
      props.class,
    )"
    @click="select.setOpen(!select.open.value)"
  >
    <slot />
    <span aria-hidden="true" class="text-muted-foreground">▾</span>
  </button>
</template>
