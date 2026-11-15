<script setup lang="ts">
/** The `bare` view — no label (buttons): the control, help and error */
import type { FormoFieldState } from '../../composables/context'

defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div :class="formo.classes.fieldBare" :data-formo-driver="formo.node.driver" :data-invalid="formo.invalid || undefined">
    <slot name="input" />
    <slot name="help" />
    <slot name="checklist" />
    <slot name="errors" />
  </div>
</template>
