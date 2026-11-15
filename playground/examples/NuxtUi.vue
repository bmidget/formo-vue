<script setup lang="ts">
/**
 * Formo × Nuxt UI: every field in a UFormField, with Nuxt UI's controls —
 * still one form object (values, rules, errors, subforms…), and every override
 * still works (slots, views, `components`, per-field `props`).
 *
 *   import { nuxtUiTheme } from 'formo-vue/nuxt-ui'      // never imports @nuxt/ui: pass the components
 *   app.use(createFormo({ theme: nuxtUiTheme({ UFormField, UInput, … }) }))
 *
 * Swap controls by name: `component: 'select-menu'` (USelectMenu, searchable),
 * `component: 'switch'` (USwitch) — or `components: { checkbox: 'switch' }` for a whole form.
 *
 * This playground has no @nuxt/ui: `#components` points at stubs shaped like it.
 */
import { ref } from 'vue'
import { FormoErrors, FormoField, FormoForm, FormoHelp, FormoInput, FormoLabel, FormoRest, useFormo } from 'formo-vue'
import { nuxtUiTheme } from 'formo-vue/nuxt-ui'
// Nuxt: '#components' · Vue + Vite: import UInput from '@nuxt/ui/components/Input.vue' (…)
import { UButton, UCheckbox, UCheckboxGroup, UFormField, UInput, URadioGroup, USelect, USelectMenu, USwitch, UTextarea } from '#components'

const theme = nuxtUiTheme({ UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton })

const form = useFormo({
  alias: 'account',
  fields: {
    name: { required: true, attr: { placeholder: 'Ada Lovelace' } },
    email: { driver: 'email', required: true, message: 'We never share it.' },
    username: { rules: 'required|alpha_dash|min:3', message: 'Your own markup, Formo’s parts' },
    plan: { driver: 'select', opts: { free: 'Free', pro: 'Pro', team: 'Team' }, blank: 'Choose a plan', required: true },
    country: {
      driver: 'select',
      component: 'select-menu',
      opts: { fr: 'France', de: 'Germany', es: 'Spain', it: 'Italy', nl: 'Netherlands', jp: 'Japan', us: 'United States' },
      blank: 'Search a country',
      message: "USelectMenu — component: 'select-menu'",
    },
    contact: { driver: 'radios', opts: { email: 'Email', phone: 'Phone', pigeon: 'Carrier pigeon' }, val: 'email', inline: true },
    topics: { driver: 'checkboxes', opts: { news: 'News', product: 'Product updates', events: 'Events' } },
    bio: { driver: 'textarea', attr: { placeholder: 'Optional' } },
    newsletter: { driver: 'bool', component: 'switch', val: true, label: 'Send me the newsletter' },
    terms: { driver: 'bool', label: 'I accept the terms', required: true },
    save: { driver: 'button', label: 'Create account', attr: { type: 'submit' } },
  },
})

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" :theme="theme" @submit="(values) => (submitted = values)">
      <div class="grid gap-4 sm:grid-cols-2">
        <FormoField :field="form.fields.name" />
        <FormoField :field="form.fields.email" />
      </div>

      <!-- Your own markup for one field: Formo's parts, rendered the Nuxt UI way -->
      <FormoField :field="form.fields.username" v-slot="{ field }">
        <div class="rounded-lg p-4 ring ring-default" :class="field.invalid && 'ring-error/50'">
          <FormoLabel :field="field" />
          <div class="mt-1 flex items-center gap-2">
            <span class="text-sm text-muted">nuxt.com/@</span>
            <FormoInput :field="field" />
          </div>
          <FormoErrors :field="field" class="mt-2" />
          <FormoHelp v-if="!field.invalid" :field="field" class="mt-2" />
        </div>
      </FormoField>

      <!-- Everything else: the automatic layout, in UFormFields -->
      <FormoRest />
    </FormoForm>

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.errors</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.errors }}</pre>
      </div>
      <div v-if="submitted">
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted</h3>
        <pre class="overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted }}</pre>
      </div>
    </aside>
  </div>
</template>
