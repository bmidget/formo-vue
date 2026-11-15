<script setup lang="ts">
/**
 * The `errors` view — like shadcn's FormMessage, with Formo's error display:
 * the first message, all of them (`errorDisplay: 'all'`), or what a checklist doesn't already show.
 */
import { computed, useAttrs } from 'vue'
import { cx, type FormoFieldState } from 'formo-vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ formo: FormoFieldState }>()
const attrs = useAttrs()

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
    v-bind="attrs"
    :id="formo.errorId"
    data-slot="form-message"
    :class="cx(formo.classes.errorList, attrs.class)"
    role="alert"
  >
    <li v-for="message in formo.errors" :key="message">{{ message }}</li>
  </ul>
  <p v-else-if="visibleError" v-bind="attrs" :id="formo.errorId" data-slot="form-message" :class="cx(formo.classes.error, attrs.class)" role="alert">
    {{ visibleError }}
  </p>
</template>
