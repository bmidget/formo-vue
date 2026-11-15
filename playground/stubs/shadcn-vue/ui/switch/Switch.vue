<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'

// shadcn-vue: a Reka UI SwitchRoot
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: boolean | null; defaultValue?: boolean; disabled?: boolean; id?: string; name?: string; required?: boolean; class?: HTMLAttributes['class'] }>()
const emits = defineEmits<{ (e: 'update:modelValue', payload: boolean): void }>()
</script>

<template>
  <button
    :id="id"
    type="button"
    role="switch"
    data-slot="switch"
    :aria-checked="!!modelValue"
    :data-state="modelValue ? 'checked' : 'unchecked'"
    :disabled="disabled"
    v-bind="$attrs"
    :class="cn(
      'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    @click="emits('update:modelValue', !modelValue)"
  >
    <span data-slot="switch-thumb" class="bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform" :class="modelValue ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'" />
  </button>
  <input v-if="name" type="hidden" :name="name" :value="modelValue ? 'on' : ''" />
</template>
