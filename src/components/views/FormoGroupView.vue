<script setup lang="ts">
/**
 * The `group` view — a subform, Formo's `group_template.php`: legend, help,
 * the group's own error, then its fields (the default slot).
 */
import type { FormoGroupState } from '../../composables/context'

defineProps<{ formo: FormoGroupState }>()
</script>

<template>
  <fieldset
    :id="formo.id"
    :class="[formo.classes.group, formo.ignored && formo.classes.ignored]"
    :data-formo-group="formo.path"
    :data-invalid="!!formo.error || undefined"
    :data-ignored="formo.ignored || undefined"
  >
    <legend v-if="formo.label" :class="formo.classes.groupLegend">{{ formo.label }}</legend>
    <p v-if="formo.message" :class="formo.classes.help">{{ formo.message }}</p>
    <p v-if="formo.error" :class="formo.classes.groupError" role="alert">{{ formo.error }}</p>
    <div :class="formo.classes.groupBody">
      <slot />
    </div>
  </fieldset>
</template>
