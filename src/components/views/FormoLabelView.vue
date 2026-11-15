<script setup lang="ts">
/**
 * The `label` view — a field's label with its required marker. Field views
 * choose the element through the slot (`<slot name="label" as="legend" />`) and
 * can pass classes (`<slot name="label" class="sr-only" />`, merged with the theme's).
 */
import { computed, useAttrs } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ formo: FormoFieldState; as?: 'label' | 'legend' | 'span' }>(), { as: 'label' })
const attrs = useAttrs()

const marker = computed(() => props.formo.form.options.config.requiredMarker)
/** A function: `$attrs` isn't reactive */
const rootAttrs = () => {
  const base = props.as === 'label' ? props.formo.classes.label : props.as === 'legend' ? props.formo.classes.title : ''
  const cls = cx(base, attrs.class)
  return {
    ...attrs,
    for: props.as === 'label' ? props.formo.id || undefined : undefined,
    class: cls || undefined,
  }
}
</script>

<template>
  <component :is="as" v-if="formo.label" v-bind="rootAttrs()">
    {{ formo.label }}<span v-if="formo.required && marker" :class="formo.classes.required" aria-hidden="true">{{ marker }}</span>
  </component>
</template>
