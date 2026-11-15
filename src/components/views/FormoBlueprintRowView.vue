<script setup lang="ts">
/** The `blueprintRow` view — one row of a repeatable group: its heading, the remove button, its fields */
import type { FormoBlueprintRowState, FormoBlueprintState } from '../../composables/context'

defineProps<{ formo: FormoBlueprintState; row: FormoBlueprintRowState }>()
</script>

<template>
  <div :class="formo.classes.blueprintRow" :data-blueprint-key="row.index">
    <div :class="formo.classes.blueprintRowHeader">
      <span>{{ row.label }}</span>
      <button v-if="formo.canRemove" type="button" :class="formo.classes.blueprintRemove" @click="row.remove()">
        {{ formo.removeText }}
      </button>
    </div>
    <slot />
  </div>
</template>
