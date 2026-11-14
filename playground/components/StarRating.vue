<script setup lang="ts">
/**
 * A plain v-model component that knows nothing about Formo — the kind of thing
 * you'd pull from a UI library. Formo passes `modelValue`, listens to
 * `update:modelValue`, and `id`/`name`/`aria-*` fall through to the root.
 */
import { ref } from 'vue'

const props = withDefaults(defineProps<{ modelValue?: number | null; max?: number }>(), { modelValue: 0, max: 5 })
const emit = defineEmits<{ 'update:modelValue': [value: number]; blur: [] }>()
const hover = ref(0)
</script>

<template>
  <div class="flex items-center gap-1" role="radiogroup" @mouseleave="hover = 0" @focusout="emit('blur')">
    <button
      v-for="n in props.max"
      :key="n"
      type="button"
      role="radio"
      :aria-checked="n === props.modelValue"
      :aria-label="`${n} star${n > 1 ? 's' : ''}`"
      class="text-2xl leading-none transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-indigo-500"
      :class="n <= (hover || props.modelValue || 0) ? 'text-amber-400' : 'text-slate-300'"
      @mouseenter="hover = n"
      @click="emit('update:modelValue', n)"
    >
      ★
    </button>
    <span class="ml-2 text-sm text-slate-500">{{ props.modelValue || 0 }} / {{ props.max }}</span>
  </div>
</template>
