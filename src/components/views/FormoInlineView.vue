<script setup lang="ts">
/** The `inline` view — Formo's `checkbox_template.php`: the control, then its label text, in one `<label>` */
import type { FormoFieldState } from '../../composables/context'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div :class="formo.classes.fieldInline" :data-formo-driver="formo.node.driver" :data-invalid="formo.invalid || undefined">
    <label :class="formo.classes.labelInline">
      <slot name="input" />
      <slot name="label" as="span" />
    </label>
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
