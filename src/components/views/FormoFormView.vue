<script setup lang="ts">
/**
 * The `form` view — inside the `<form>` element
 * (which <FormoForm> keeps: submit, CSRF, `disabled`): the form's own error,
 * then the `before`, default (the fields) and `actions` slots.
 */
import type { FormoFormState } from '../../composables/context'

defineProps<{ formo: FormoFormState }>()
</script>

<template>
  <div :class="formo.classes.form">
    <p v-if="formo.error" :class="formo.classes.formError" role="alert">{{ formo.error }}</p>
    <slot name="before" />
    <slot />
    <slot name="actions" />
  </div>
</template>
