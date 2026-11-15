<script setup lang="ts">
/** `<input type="file">`. Value: `File | null`, or `File[]` with `attr.multiple` */
import { ref, watch } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'
import { withoutClass } from './attrs'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: File | File[] | null]; blur: [] }>()

const input = ref<HTMLInputElement>()

function onChange(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  emit('update:modelValue', props.formo.node.attr.multiple ? files : (files[0] ?? null))
}

// File inputs can't be set programmatically — clear the element when the value is reset
watch(
  () => props.modelValue,
  (value) => {
    if (input.value && (value === null || value === undefined || (Array.isArray(value) && !value.length))) {
      input.value.value = ''
    }
  },
)
</script>

<template>
  <input
    ref="input"
    v-bind="{ ...formo.attrs, ...withoutClass($attrs) }"
    type="file"
    :class="cx(formo.classes.file, formo.node.attr.class, $attrs.class)"
    @change="onChange"
    @blur="emit('blur')"
  />
</template>
