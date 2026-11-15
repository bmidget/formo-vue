<script setup lang="ts">
/**
 * The `blueprint` view — a repeatable group: title, help, the list's error,
 * one `row` slot per row (each rendered with the `blueprintRow` view), and the
 * "add" button.
 */
import type { FormoBlueprintState } from '../../composables/context'

defineProps<{ formo: FormoBlueprintState }>()
</script>

<template>
  <div
    :class="[formo.classes.blueprint, formo.ignored && formo.classes.ignored]"
    :data-ignored="formo.ignored || undefined"
    role="group"
    :aria-labelledby="formo.label ? formo.titleId : undefined"
    :data-formo-group="formo.path"
    :data-invalid="!!formo.error || undefined"
  >
    <div v-if="formo.label" :id="formo.titleId" :class="formo.classes.title">{{ formo.label }}</div>
    <p v-if="formo.message" :class="formo.classes.help">{{ formo.message }}</p>
    <p v-if="formo.error" :class="formo.classes.groupError" role="alert">{{ formo.error }}</p>

    <template v-for="row in formo.rows" :key="row.key">
      <slot name="row" :row="row" />
    </template>

    <button v-if="formo.canAdd" type="button" :class="formo.classes.blueprintAdd" @click="formo.add()">
      <span aria-hidden="true">+</span> {{ formo.addText }}
    </button>
  </div>
</template>
