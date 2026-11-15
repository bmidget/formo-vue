<script setup lang="ts">
/**
 * A Formo-aware component using `useFormoField()`: it reads the field's id,
 * invalid state and theme classes so it looks/behaves like a built-in control.
 * Registered as the `tags` driver in main.ts.
 */
import { ref } from 'vue'
import { cx, useFormoField } from 'formo-vue'

// The id goes on the inner <input> (so the <label for> works) — don't also put it on the root
defineOptions({ inheritAttrs: false })

const field = useFormoField()
const draft = ref('')

const tags = () => (Array.isArray(field.value) ? (field.value as string[]) : [])

function add() {
  const tag = draft.value.trim().replace(/,$/, '')
  if (tag && !tags().includes(tag)) field.setValue([...tags(), tag])
  draft.value = ''
}

function remove(tag: string) {
  field.setValue(tags().filter((t) => t !== tag))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add()
  } else if (e.key === 'Backspace' && !draft.value && tags().length) {
    remove(tags()[tags().length - 1])
  }
}
</script>

<template>
  <div
    :class="cx(field.classes.control, 'flex flex-wrap items-center gap-1.5 py-1.5', field.invalid && field.classes.controlInvalid)"
    @click="($refs.input as HTMLInputElement).focus()"
  >
    <span
      v-for="tag in tags()"
      :key="tag"
      class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
    >
      {{ tag }}
      <button type="button" class="text-indigo-400 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-100" :aria-label="`Remove ${tag}`" @click.stop="remove(tag)">×</button>
    </span>
    <input
      :id="field.id"
      ref="input"
      v-model="draft"
      :aria-invalid="field.invalid || undefined"
      :aria-describedby="field.attrs['aria-describedby'] as string"
      :placeholder="tags().length ? '' : (field.node.attr.placeholder as string) ?? 'Type and press Enter'"
      class="min-w-24 flex-1 border-0 bg-transparent p-0.5 text-sm outline-none"
      @keydown="onKeydown"
      @blur="add(); field.onBlur()"
    />
  </div>
</template>
