<script setup lang="ts">
/** The `inline` view (checkbox, switch): the control, then its label, side by side */
import type { FormoFieldState } from 'formo-vue'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div data-slot="form-item" :class="formo.classes.fieldInline" :data-formo-driver="formo.node.driver" :data-invalid="formo.invalid || undefined">
    <div class="flex items-center gap-3">
      <slot name="input" />
      <slot name="label" />
    </div>
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
