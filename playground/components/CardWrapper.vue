<script setup lang="ts">
/**
 * A field view (instead of the theme's `field` view), for one field:
 * `{ view: CardWrapper }`. It gets the field's state as `formo` and places
 * Formo's parts — the control, the error… — through slots.
 */
import type { FormoFieldState } from 'formo-vue'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div
    class="rounded-xl border bg-linear-to-br from-white to-slate-50 p-4 shadow-xs"
    :class="formo.invalid ? 'border-rose-300' : 'border-slate-200'"
  >
    <div class="mb-3 flex items-start justify-between gap-4">
      <div>
        <slot name="label" class="font-semibold text-slate-900" />
        <slot name="help" />
      </div>
      <span v-if="formo.required" class="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Required
      </span>
    </div>
    <slot name="input" />
    <slot name="errors" class="mt-2" />
  </div>
</template>
