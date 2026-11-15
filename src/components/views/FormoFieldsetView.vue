<script setup lang="ts">
/** The `fieldset` view — a group of controls (radios, checkboxes) titled by a `<legend>` */
import type { FormoFieldState } from '../../composables/context'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div :class="formo.classes.field" :data-formo-driver="formo.node.driver" :data-invalid="formo.invalid || undefined">
    <fieldset :class="formo.classes.fieldset">
      <slot name="label" as="legend" />
      <slot name="input" />
    </fieldset>
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
