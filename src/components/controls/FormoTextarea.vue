<script setup lang="ts">
/** `<textarea>` for the `textarea` driver */
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'

defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()
</script>

<template>
  <textarea
    v-bind="formo.attrs"
    :value="(modelValue as string) ?? ''"
    :class="cx(formo.classes.control, formo.classes.textarea, formo.invalid && formo.classes.controlInvalid, formo.node.attr.class)"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    @blur="emit('blur')"
  />
</template>
