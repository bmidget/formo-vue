<script setup lang="ts">
/**
 * Error summary — lists every error of a form (`form.errors`),
 * each one linking to its control, once the form was submitted. Use inside
 * <FormoForm> (e.g. in the `#before` slot) or pass a controller:
 * <FormoErrorSummary :form="form" />. Rendered by the theme's `errorSummary` view.
 * (A field's errors: <FormoErrors :field>.)
 */
import { computed, inject, markRaw } from 'vue'
import type { FormoController } from '../types'
import { FormoControllerKey, FormoOptionsKey, type FormoErrorSummaryState } from '../composables/context'
import { toId } from '../core/utils'
import { getTranslator } from '../i18n/translator'
import { resolveView } from './resolve'

const props = withDefaults(defineProps<{ form?: FormoController; title?: string }>(), {
  form: undefined,
  title: undefined,
})

const injected = inject(FormoControllerKey, null)
const injectedOptions = inject(FormoOptionsKey, null)
const controller = computed(() => props.form ?? injected)
const options = computed(() =>
  injectedOptions && (!props.form || props.form === injected) ? injectedOptions.value : controller.value?.options,
)

const items = computed(() => {
  const form = controller.value
  if (!form) return []
  return Object.entries(form.flatErrors).map(([path, message]) => ({
    path,
    message,
    href: path && form.find(path)?.kind === 'field' ? `#${toId(form.alias, path)}` : undefined,
  }))
})

const state = markRaw({
  get form() {
    return controller.value!
  },
  get title() {
    return props.title ?? (options.value ? getTranslator(options.value.config).ui('errorSummary') : '')
  },
  get items() {
    return items.value
  },
  get classes() {
    return options.value!.classes
  },
}) as FormoErrorSummaryState

const View = computed(() => (options.value ? resolveView('errorSummary', options.value) : undefined))
</script>

<template>
  <component :is="View" v-if="View && items.length && controller?.submitCount" :formo="state" />
</template>
