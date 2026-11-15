<script setup lang="ts">
/**
 * The `field` view — Formo's `field_template.php`: label above the control,
 * then help, checklist and error. Every piece comes through a slot, already
 * rendered by Formo (or by the template's own slots, like `#input`).
 */
import type { FormoFieldState } from '../../composables/context'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div :class="formo.classes.field" :data-formo-driver="formo.node.driver" :data-invalid="formo.invalid || undefined">
    <slot name="label" />
    <slot name="input" />
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
