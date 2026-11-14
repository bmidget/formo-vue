<script setup lang="ts">
/** `<input>` for the `input` driver (every HTML type except checkbox/file) */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'

const props = defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [] }>()

const type = computed(() => props.formo.node.type ?? 'text')
const numeric = computed(() => type.value === 'number' || type.value === 'range')
const isButton = computed(() => ['submit', 'reset', 'button', 'image'].includes(type.value))

const inputClass = computed(() => {
  const c = props.formo.classes
  const extra = props.formo.node.attr.class
  if (isButton.value) return cx(c.button, type.value === 'submit' ? c.buttonPrimary : c.buttonSecondary, extra)
  if (type.value === 'color') return cx(c.color, extra)
  if (type.value === 'range') return cx(c.range, extra)
  if (type.value === 'hidden') return undefined
  return cx(c.control, props.formo.invalid && c.controlInvalid, extra)
})

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (numeric.value) {
    emit('update:modelValue', raw === '' ? null : Number(raw))
    return
  }
  emit('update:modelValue', raw)
}
</script>

<template>
  <input
    v-if="isButton"
    v-bind="formo.attrs"
    :type="type"
    :value="formo.text"
    :class="inputClass"
    :disabled="(formo.attrs.disabled as boolean) || (type === 'submit' && formo.form.submitting)"
    @mousedown="type === 'submit' && $event.preventDefault()"
  />
  <input
    v-else
    v-bind="formo.attrs"
    :type="type"
    :value="modelValue ?? ''"
    :class="inputClass"
    @input="onInput"
    @blur="emit('blur')"
  />
</template>
