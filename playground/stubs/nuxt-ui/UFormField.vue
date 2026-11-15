<script setup lang="ts">
/** Stub of Nuxt UI's UFormField: label (+ hint), description, the input, then the error — or the help */
import { computed, provide, ref, useSlots } from 'vue'
import { FormFieldKey, useStubId } from './useFormField'

const props = withDefaults(
  defineProps<{
    name?: string
    label?: string
    description?: string
    help?: string
    hint?: string
    error?: string | boolean
    required?: boolean
    size?: string
  }>(),
  { error: undefined },
)
const slots = useSlots()
const inputId = ref<string | undefined>(useStubId())
const ariaId = useStubId()
const error = computed(() => props.error)
provide(FormFieldKey, {
  inputId,
  ariaId,
  error,
  described: computed(() => (['error', 'hint', 'description', 'help'] as const).filter((k) => props[k]).map((k) => `${ariaId}-${k}`)),
})
</script>

<template>
  <div data-slot="root" class="text-sm">
    <div v-if="label || slots.label" class="flex items-center justify-between gap-1">
      <label :for="inputId" data-slot="label" class="block font-medium text-default" :class="required && `after:ms-0.5 after:text-error after:content-['*']`">
        <slot name="label" :label="label">{{ label }}</slot>
      </label>
      <span v-if="hint || slots.hint" :id="`${ariaId}-hint`" class="text-dimmed"><slot name="hint" :hint="hint">{{ hint }}</slot></span>
    </div>
    <p v-if="description || slots.description" :id="`${ariaId}-description`" class="text-muted">
      <slot name="description" :description="description">{{ description }}</slot>
    </p>
    <div :class="(label || slots.label || description) && 'mt-1'">
      <slot :error="error" />
      <div v-if="error !== false && ((typeof error === 'string' && error) || slots.error)" :id="`${ariaId}-error`" data-slot="error" class="mt-2 text-error">
        <slot name="error" :error="error">{{ error }}</slot>
      </div>
      <div v-else-if="help || slots.help" :id="`${ariaId}-help`" data-slot="help" class="mt-2 text-muted">
        <slot name="help" :help="help">{{ help }}</slot>
      </div>
    </div>
  </div>
</template>
