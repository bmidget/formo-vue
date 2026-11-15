<script setup lang="ts">
/**
 * The `errors` view — the field's errors: the first failing message (default),
 * every message (`errorDisplay: 'all'`), and for checklists only what the list
 * doesn't already show (ex: required).
 */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ formo: FormoFieldState }>()

const visibleError = computed(() => {
  const { error, errors, errorDisplay, checklist } = props.formo
  if (!error || errorDisplay !== 'checklist') return error
  const listed = new Set(checklist.map((item) => item.message))
  return errors.find((message) => !listed.has(message))
})
</script>

<template>
  <ul
    v-if="formo.errorDisplay === 'all' && formo.errors.length > 1"
    v-bind="$attrs"
    :id="formo.errorId"
    :class="cx(formo.classes.errorList, $attrs.class)"
    role="alert"
  >
    <li v-for="message in formo.errors" :key="message">{{ message }}</li>
  </ul>
  <p v-else-if="visibleError" v-bind="$attrs" :id="formo.errorId" :class="cx(formo.classes.error, $attrs.class)" role="alert">
    {{ visibleError }}
  </p>
</template>
