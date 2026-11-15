<script setup lang="ts">
/** A single boolean checkbox (`checkbox` / `bool` driver). The `inline` view puts the label next to it. */
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'
import { withoutClass } from './attrs'

defineOptions({ inheritAttrs: false })
defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; blur: [] }>()
</script>

<template>
  <input
    v-bind="{ ...formo.attrs, ...withoutClass($attrs) }"
    type="checkbox"
    value="1"
    :checked="!!modelValue"
    :class="cx(formo.classes.checkbox, formo.node.attr.class, $attrs.class)"
    @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    @blur="emit('blur')"
  />
</template>
