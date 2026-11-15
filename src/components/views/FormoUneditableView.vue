<script setup lang="ts">
/** The `uneditable` view — a field's value as text when `editable: false` */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { getTranslator } from '../../i18n/translator'

const props = defineProps<{ formo: FormoFieldState }>()

const tr = computed(() => getTranslator(props.formo.form.options.config))

const text = computed(() => {
  const { node, value, options, form } = props.formo
  if (typeof value === 'boolean') return tr.value.ui(value ? 'yes' : 'no')
  const driver = form.options.drivers[node.driver]
  if (driver?.display) return driver.display(value, node, options)
  if (value === null || value === undefined) return ''
  return Array.isArray(value) ? value.join(', ') : String(value)
})
</script>

<template>
  <p :id="formo.id || undefined" :class="formo.classes.uneditable">{{ text || tr.ui('empty') }}</p>
</template>
