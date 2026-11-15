<script setup lang="ts">
/**
 * Formo × shadcn-vue: your shadcn-vue components as Formo's controls, in
 * shadcn's field layout (label, control, description, message) — one form object.
 *
 *   npx shadcn-vue@latest add https://raw.githubusercontent.com/<owner>/formo-vue/main/registry/r/formo.json
 *   → components/ui/formo/ (yours to edit), on top of your input, select, checkbox… components
 *
 *   app.use(createFormo({ theme: shadcnTheme }))
 *
 * Or, without any component: shadcn's look for Formo's own controls — `shadcnClasses`.
 *
 * This playground has no shadcn-vue: `@/components/ui/*` points at stubs shaped like it.
 */
import { computed, ref } from 'vue'
import { defineTheme, FormoErrors, FormoField, FormoForm, FormoInput, FormoLabel, FormoRest, shadcnClasses, tailwindMergeClasses, useFormo } from 'formo-vue'
import { shadcnTheme } from '@/components/ui/formo'

/** The look alone: Formo's vanilla controls in shadcn's classes */
const shadcnLook = defineTheme({ name: 'shadcn-look', classes: shadcnClasses, mergeClasses: tailwindMergeClasses })
const themes = { components: shadcnTheme, classes: shadcnLook }
const choice = ref<keyof typeof themes>('components')
const theme = computed(() => themes[choice.value])

const form = useFormo({
  alias: 'profile',
  fields: {
    name: { required: true, attr: { placeholder: 'Ada Lovelace' } },
    email: { driver: 'email', required: true, message: 'We never share it.' },
    role: { driver: 'select', opts: { Engineering: { frontend: 'Frontend', backend: 'Backend' }, design: 'Design' }, blank: 'Select a role', required: true },
    plan: { driver: 'radios', opts: { free: 'Free', pro: 'Pro' }, val: 'free' },
    interests: { driver: 'checkboxes', opts: { vue: 'Vue', nuxt: 'Nuxt', laravel: 'Laravel' }, inline: true },
    bio: { driver: 'textarea', message: 'A few words, optional.' },
    newsletter: { driver: 'bool', component: 'switch', val: true, label: 'Email me the newsletter' },
    terms: { driver: 'bool', label: 'Accept terms and conditions', required: true },
    save: { driver: 'button', label: 'Save profile', attr: { type: 'submit' } },
  },
})

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="(label, key) in { components: 'Your shadcn-vue components (registry item)', classes: 'Classes only (shadcnClasses)' }"
          :key="key"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="choice === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:text-slate-900'"
          @click="choice = key"
        >
          {{ label }}
        </button>
      </div>

      <div class="shadcn rounded-xl border bg-background p-6">
        <FormoForm :form="form" :theme="theme" @submit="(values) => (submitted = values)">
          <div class="grid gap-4 sm:grid-cols-2">
            <FormoField :field="form.fields.name" />
            <FormoField :field="form.fields.email" />
          </div>

          <!-- Your own markup, with the theme's parts -->
          <FormoField :field="form.fields.role" v-slot="{ field }">
            <div class="grid gap-2 rounded-lg border border-dashed p-4">
              <div class="flex items-baseline justify-between">
                <FormoLabel :field="field" />
                <span class="text-xs text-muted-foreground">Shown on your profile</span>
              </div>
              <FormoInput :field="field" />
              <FormoErrors :field="field" />
            </div>
          </FormoField>

          <FormoRest />
        </FormoForm>
      </div>
    </div>

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
