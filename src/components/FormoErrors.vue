<script setup lang="ts">
/**
 * Error summary — lists every error of a form (Formo's `$form->errors()`),
 * each one linking to its control. Use inside <FormoForm> (e.g. in the
 * `#before` slot) or pass a controller: <FormoErrors :form="form" />.
 */
import { computed, inject } from 'vue'
import type { FormoController } from '../types'
import { FormoControllerKey } from '../composables/context'
import { toId } from '../core/utils'
import { getTranslator } from '../i18n/translator'

const props = withDefaults(defineProps<{ form?: FormoController; title?: string }>(), {
  form: undefined,
  title: undefined,
})

const injected = inject(FormoControllerKey, null)
const controller = computed(() => props.form ?? injected)

const heading = computed(() =>
  props.title ?? (controller.value ? getTranslator(controller.value.options.config).ui('errorSummary') : ''),
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
</script>

<template>
  <div v-if="items.length && controller?.submitCount" :class="controller.options.theme.errorSummary" role="alert">
    <p class="font-semibold">{{ heading }}</p>
    <ul class="mt-2 list-disc space-y-1 pl-5">
      <li v-for="item in items" :key="item.path">
        <a v-if="item.href" :href="item.href" class="underline-offset-2 hover:underline">{{ item.message }}</a>
        <span v-else>{{ item.message }}</span>
      </li>
    </ul>
  </div>
</template>
