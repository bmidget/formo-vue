<script setup lang="ts">
/**
 * A "third-party" component with a non-standard model: `value` prop + `change`
 * event. The field definition says `model: { prop: 'value', event: 'change' }`.
 */
defineProps<{ value?: number | null; min?: number; max?: number; unit?: string }>()
const emit = defineEmits<{ change: [value: number] }>()
</script>

<template>
  <div class="flex items-center gap-3">
    <input
      type="range"
      class="w-full accent-emerald-600"
      :min="min ?? 0"
      :max="max ?? 100"
      :value="value ?? 0"
      @input="emit('change', Number(($event.target as HTMLInputElement).value))"
    />
    <output class="w-16 shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-center text-sm font-semibold text-emerald-700">
      {{ value ?? 0 }}{{ unit }}
    </output>
  </div>
</template>
