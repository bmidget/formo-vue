<script setup lang="ts">
/** A field's `checkboxes` (an array), with your shadcn-vue Checkbox */
import { computed } from 'vue'
import { flattenOptions, useFormoField } from 'formo-vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown[]] }>()

const field = useFormoField()
const options = computed(() => flattenOptions(field.options))
const selected = computed<unknown[]>(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const itemId = (i: number) => `${field.id || field.name}-${i}`

function toggle(value: unknown, checked: boolean) {
  // Keep the options' order, whatever the click order
  emit('update:modelValue', options.value.map((o) => o.value).filter((v) => (v === value ? checked : selected.value.includes(v))))
}
</script>

<template>
  <div v-bind="{ ...$attrs, name: undefined }" role="group" :class="field.node.vars.inline ? 'flex flex-wrap gap-x-6 gap-y-3' : 'grid gap-3'">
    <div v-for="(opt, i) in options" :key="String(opt.value)" class="flex items-center gap-3">
      <Checkbox
        :id="itemId(i)"
        :name="`${field.name}[]`"
        :value="String(opt.value)"
        :model-value="selected.includes(opt.value)"
        :disabled="opt.disabled || field.disabled"
        :aria-invalid="field.invalid || undefined"
        @update:model-value="toggle(opt.value, !!$event)"
      />
      <Label :for="itemId(i)" class="font-normal">{{ opt.label }}</Label>
    </div>
  </div>
</template>
