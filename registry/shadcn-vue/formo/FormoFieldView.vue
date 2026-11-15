<script setup lang="ts">
/**
 * The `field` view: label, control, description, checklist, message — like
 * shadcn's FormItem, with Formo's ids / aria (`aria-invalid` styles the controls).
 */
import type { FormoFieldState } from 'formo-vue'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div data-slot="form-item" :class="formo.classes.field" :data-formo-driver="formo.node.driver" :data-invalid="formo.invalid || undefined">
    <slot name="label" />
    <slot name="input" />
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
