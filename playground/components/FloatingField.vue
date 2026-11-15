<script setup lang="ts">
/**
 * A `field` view with a floating label — the input comes *before* its label
 * (CSS `peer` needs that order), something classes alone can't do.
 *
 * Views get the field's state as `formo` and render Formo's parts through
 * slots. Attributes on a slot go to that part: here the input gets
 * `placeholder=" "` and `peer`, the label its floating classes.
 */
import type { FormoFieldState } from 'formo-vue'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div class="min-w-0 space-y-1.5" :data-invalid="formo.invalid || undefined">
    <div class="relative">
      <slot name="input" class="peer pt-5 pb-1.5" placeholder=" " />
      <slot
        name="label"
        class="pointer-events-none absolute top-1.5 left-3 text-xs font-medium text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-600"
      />
    </div>
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
