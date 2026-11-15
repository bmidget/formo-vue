<script setup lang="ts">
/** A text input with suggestions (`datalist` driver) */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { flattenOptions } from '../../core/options'
import { cx } from '../../core/theme'
import { withoutClass } from './attrs'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ formo: FormoFieldState; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()

const listId = computed(() => `${props.formo.id || props.formo.name}-list`)
</script>

<template>
  <input
    v-bind="{ ...formo.attrs, ...withoutClass($attrs) }"
    type="text"
    :list="listId"
    :value="(modelValue as string) ?? ''"
    :class="cx(formo.classes.control, formo.invalid && formo.classes.controlInvalid, formo.node.attr.class, $attrs.class)"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @blur="emit('blur')"
  />
  <datalist :id="listId">
    <option v-for="opt in flattenOptions(formo.options)" :key="String(opt.value)" :value="String(opt.value)">
      {{ opt.label !== String(opt.value) ? opt.label : '' }}
    </option>
  </datalist>
</template>
