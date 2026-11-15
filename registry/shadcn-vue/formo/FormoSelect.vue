<script setup lang="ts">
/**
 * A field's `select`, with your shadcn-vue Select: options and optgroups from
 * the field, `blank` as the placeholder, `multiple` from `attr.multiple`.
 */
import { computed } from 'vue'
import { getTranslator, isOptionGroup, useFormoField } from 'formo-vue'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

defineOptions({ inheritAttrs: false })
defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [] }>()

const field = useFormoField()
const placeholder = computed(() => {
  const blank = field.node.blank
  return typeof blank === 'string' ? getTranslator(field.form.options.config).text(blank) : undefined
})
</script>

<template>
  <Select
    :model-value="modelValue ?? undefined"
    :name="field.name"
    :multiple="!!field.node.attr.multiple"
    :disabled="field.disabled"
    :required="field.required"
    @update:model-value="emit('update:modelValue', $event)"
    @update:open="(open: boolean) => !open && emit('blur')"
  >
    <!-- id and aria-* (invalid, describedby) go on the trigger — the element the label points to -->
    <SelectTrigger v-bind="{ ...$attrs, name: undefined }" class="w-full">
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <template v-for="(item, i) in field.options" :key="i">
        <SelectGroup v-if="isOptionGroup(item)">
          <SelectLabel>{{ item.label }}</SelectLabel>
          <SelectItem v-for="opt in item.options" :key="String(opt.value)" :value="opt.value" :disabled="opt.disabled">{{ opt.label }}</SelectItem>
        </SelectGroup>
        <SelectItem v-else :value="item.value" :disabled="item.disabled">{{ item.label }}</SelectItem>
      </template>
    </SelectContent>
  </Select>
</template>
