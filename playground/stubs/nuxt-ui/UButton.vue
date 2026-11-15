<script setup lang="ts">
/** Stub of Nuxt UI's UButton */
defineProps<{
  label?: string
  type?: 'button' | 'submit' | 'reset'
  color?: string
  variant?: string
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-75"
    :class="[
      block && 'w-full',
      variant === 'outline' ? 'text-default ring ring-inset ring-accented hover:bg-elevated' : color === 'neutral' ? 'bg-inverted text-inverted hover:opacity-90' : 'bg-primary text-white hover:bg-primary/90',
    ]"
  >
    <span v-if="loading" class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <slot>{{ label }}</slot>
  </button>
</template>
