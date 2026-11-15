<script setup lang="ts">
/** A `field` view with the label in a left column (Bootstrap's "horizontal form") */
import type { FormoFieldState } from 'formo-vue'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div class="grid gap-x-6 gap-y-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start" :data-invalid="formo.invalid || undefined">
    <div class="sm:pt-2 sm:text-right"><slot name="label" /></div>
    <div class="min-w-0 space-y-1.5">
      <slot name="input" />
      <slot name="help" />
      <slot name="checklist" />
      <slot name="errors" />
    </div>
  </div>
</template>
