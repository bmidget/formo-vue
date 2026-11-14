<script setup lang="ts">
/**
 * Declares the `formo` prop, so Formo hands it the full field state.
 * Used to override the `checkbox` driver for one form.
 */
import type { FormoFieldState } from 'formo-vue'

defineProps<{ formo: FormoFieldState; modelValue?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; blur: [] }>()
</script>

<template>
  <button
    :id="formo.id"
    type="button"
    role="switch"
    :aria-checked="!!modelValue"
    :aria-describedby="formo.attrs['aria-describedby'] as string"
    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    :class="modelValue ? 'bg-indigo-600' : 'bg-slate-300'"
    @click="emit('update:modelValue', !modelValue)"
    @blur="emit('blur')"
  >
    <span
      class="pointer-events-none inline-block size-5 translate-y-0.5 rounded-full bg-white shadow transition"
      :class="modelValue ? 'translate-x-5.5' : 'translate-x-0.5'"
    />
  </button>
</template>
