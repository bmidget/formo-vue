<script setup lang="ts">
/** The `help` view — a field's help text (its `message`), linked to the control by `aria-describedby` */
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'

defineOptions({ inheritAttrs: false })
defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <p v-if="formo.message" v-bind="$attrs" :id="formo.helpId" :class="cx(formo.classes.help, $attrs.class)">{{ formo.message }}</p>
</template>
