<script setup lang="ts">
/** A field's `radios`, with your shadcn-vue RadioGroup (`inline: true` lays them out in a row) */
import { computed } from 'vue'
import { flattenOptions, useFormoField } from 'formo-vue'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

defineOptions({ inheritAttrs: false })
defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const field = useFormoField()
const options = computed(() => flattenOptions(field.options))
const itemId = (i: number) => `${field.id || field.name}-${i}`
</script>

<template>
  <RadioGroup
    v-bind="{ ...$attrs, name: undefined }"
    :model-value="modelValue"
    :name="field.name"
    :disabled="field.disabled"
    :required="field.required"
    :class="field.node.vars.inline ? 'flex flex-wrap gap-x-6' : undefined"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-for="(opt, i) in options" :key="String(opt.value)" class="flex items-center gap-3">
      <RadioGroupItem :id="itemId(i)" :value="opt.value" :disabled="opt.disabled" :aria-invalid="field.invalid || undefined" />
      <Label :for="itemId(i)" class="font-normal">{{ opt.label }}</Label>
    </div>
  </RadioGroup>
</template>
