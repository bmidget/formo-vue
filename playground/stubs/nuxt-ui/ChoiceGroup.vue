<script setup lang="ts">
/** Shared body of the URadioGroup / UCheckboxGroup stubs: a fieldset with a legend and Reka-style items */
import { computed } from 'vue'
import { toGroups } from './items'
import { useFormField, useStubId } from './useFormField'

const props = defineProps<{
  kind: 'radio' | 'checkbox'
  name?: string
  items?: unknown[]
  modelValue?: unknown
  legend?: string
  required?: boolean
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  color?: string
  valueKey?: string
  labelKey?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
// Like the real groups: they don't take the field's id (`bind: false`)
const { color, ariaAttrs } = useFormField(props, { bind: false })
const base = useStubId()
const options = computed(() => toGroups(props.items, props.valueKey, props.labelKey).flatMap((g) => g.options))
const values = computed<unknown[]>(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const checked = (value: unknown) => (props.kind === 'radio' ? props.modelValue === value : values.value.includes(value))

function toggle(value: unknown) {
  if (props.kind === 'radio') return emit('update:modelValue', value)
  emit('update:modelValue', checked(value) ? values.value.filter((v) => v !== value) : [...values.value, value])
}
</script>

<template>
  <fieldset class="m-0 min-w-0 border-0 p-0" v-bind="ariaAttrs">
    <legend v-if="legend" class="mb-1 block text-sm font-medium text-default" :class="required && `after:ms-0.5 after:text-error after:content-['*']`">
      {{ legend }}
    </legend>
    <div :role="kind === 'radio' ? 'radiogroup' : 'group'" class="flex gap-x-4 gap-y-1" :class="orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col'">
      <div v-for="(opt, i) in options" :key="String(opt.value)" class="flex items-center gap-2 text-sm">
        <button
          :id="`${base}-${i}`"
          type="button"
          :role="kind"
          :aria-checked="checked(opt.value)"
          :disabled="disabled || opt.disabled"
          class="grid size-4 shrink-0 place-items-center text-[10px] text-white"
          :class="[kind === 'radio' ? 'rounded-full' : 'rounded-sm', checked(opt.value) ? 'bg-primary' : 'ring ring-inset', color === 'error' ? 'ring-error' : 'ring-accented']"
          @click="toggle(opt.value)"
        >
          <span v-if="checked(opt.value)" aria-hidden="true">{{ kind === 'radio' ? '●' : '✓' }}</span>
        </button>
        <input v-if="name && checked(opt.value)" type="hidden" :name="kind === 'radio' ? name : `${name}[]`" :value="String(opt.value)" />
        <label :for="`${base}-${i}`" class="text-default">{{ opt.label }}</label>
      </div>
    </div>
  </fieldset>
</template>
