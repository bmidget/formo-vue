<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'
import { cn } from '../../lib/utils'
import { SelectKey } from './context'

// Reka UI portals the content; the stub keeps it in place (and mounted while closed, so items register their labels)
const props = defineProps<{ class?: HTMLAttributes['class']; position?: string }>()
const select = inject(SelectKey)!
</script>

<template>
  <div
    v-show="select.open.value"
    role="listbox"
    data-slot="select-content"
    :data-state="select.open.value ? 'open' : 'closed'"
    :class="cn('bg-popover text-popover-foreground relative z-50 mt-1 max-h-72 min-w-[8rem] overflow-y-auto rounded-md border p-1 shadow-md', props.class)"
  >
    <slot />
  </div>
</template>
