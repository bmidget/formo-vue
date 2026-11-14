<script setup lang="ts">
/**
 * Reads its choices from the field's `opts` through `useFormoField()` — so a
 * schema (even JSON from the server) can say `{ component: 'color-swatches', opts: {...} }`.
 */
import { useFormoField, flattenOptions } from 'formo-vue'

const field = useFormoField()
</script>

<template>
  <div :id="field.id" role="radiogroup" class="flex flex-wrap gap-2">
    <button
      v-for="opt in flattenOptions(field.options)"
      :key="String(opt.value)"
      type="button"
      role="radio"
      :aria-checked="field.value === opt.value"
      :title="opt.label"
      class="size-9 rounded-full ring-offset-2 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-indigo-500"
      :class="field.value === opt.value ? 'ring-2 ring-slate-900' : 'ring-1 ring-black/10'"
      :style="{ background: String(opt.value) }"
      @click="field.setValue(opt.value)"
      @blur="field.onBlur()"
    >
      <span class="sr-only">{{ opt.label }}</span>
    </button>
  </div>
</template>
