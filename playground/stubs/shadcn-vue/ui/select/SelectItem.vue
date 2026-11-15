<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { inject, onBeforeUnmount, ref, watchEffect } from 'vue'
import { cn } from '../../lib/utils'
import { SelectKey } from './context'

const props = defineProps<{ value: unknown; disabled?: boolean; class?: HTMLAttributes['class'] }>()
const select = inject(SelectKey)!
const el = ref<HTMLElement>()
watchEffect(() => {
  if (el.value) select.labels.set(props.value, el.value.textContent?.trim() ?? String(props.value))
})
onBeforeUnmount(() => select.labels.delete(props.value))
</script>

<template>
  <div
    ref="el"
    role="option"
    data-slot="select-item"
    :aria-selected="select.isSelected(value)"
    :aria-disabled="disabled || undefined"
    :data-state="select.isSelected(value) ? 'checked' : 'unchecked'"
    :class="cn('focus:bg-accent hover:bg-accent relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none aria-disabled:pointer-events-none aria-disabled:opacity-50', props.class)"
    @click="!disabled && select.select(value)"
  >
    <slot />
    <span v-if="select.isSelected(value)" class="absolute right-2 flex size-3.5 items-center justify-center" aria-hidden="true">✓</span>
  </div>
</template>
