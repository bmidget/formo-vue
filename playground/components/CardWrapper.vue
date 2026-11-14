<script setup lang="ts">
/**
 * A replacement for FormoFieldWrapper (label/help/error chrome).
 * Same `formo` prop, control comes through the default slot.
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
        <label :for="formo.id" class="text-sm font-semibold text-slate-900">{{ formo.label }}</label>
        <p v-if="formo.message" :id="formo.helpId" class="text-xs text-slate-500">{{ formo.message }}</p>
      </div>
      <span v-if="formo.required" class="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Required
      </span>
    </div>
    <slot />
    <p v-if="formo.error" :id="formo.errorId" role="alert" class="mt-2 text-xs font-medium text-rose-600">⚠ {{ formo.error }}</p>
  </div>
</template>
