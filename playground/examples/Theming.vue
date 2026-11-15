<script setup lang="ts">
/**
 * A theme is the *views* that lay a form out (form, group, field, label, errors…),
 * the controls, and the classes they use. Swap any of them:
 *
 *   defineTheme({ extends: defaultTheme, views: { field: FloatingField } })   new views
 *   defineTheme({ views, components, classes })                              a whole new theme
 *
 *   app-wide   createFormo({ theme })          per form   <FormoForm :theme="…">
 *   per group  { fields: {…}, theme: … }        per field  { view: 'floating' } (a named view)
 *
 * Just restyling? Class overrides merge with the theme's (tailwind-merge here):
 *   createFormo({ classes })  ·  <FormoForm :classes="…">  ·  { classes: {…} } on a field
 */
import { computed, ref } from 'vue'
import { defaultTheme, defineTheme, FormoForm, useFormo, type FormoClasses, type FormoTheme } from 'formo-vue'
import FloatingField from '../components/FloatingField.vue'
import HorizontalField from '../components/HorizontalField.vue'

/** Themes that swap views — the DOM changes, not just the classes */
const floating = defineTheme({ name: 'floating', extends: defaultTheme, views: { field: FloatingField } })
const horizontal = defineTheme({
  name: 'horizontal',
  extends: defaultTheme,
  views: { field: HorizontalField },
  classes: { group: 'bg-white', groupBody: 'space-y-5' },
})

const presets: Record<string, { label: string; theme?: FormoTheme; classes?: Partial<FormoClasses>; wrapper?: string }> = {
  default: { label: 'Default' },
  floating: { label: 'Floating labels (views)', theme: floating },
  horizontal: { label: 'Horizontal (views)', theme: horizontal },
  underline: {
    label: 'Minimal underline (classes)',
    classes: {
      control: 'rounded-none border-0 border-b-2 border-slate-200 bg-transparent px-0 shadow-none focus:border-slate-900 focus:ring-0',
      controlInvalid: 'border-rose-500 focus:border-rose-600',
      label: 'text-[11px] font-semibold uppercase tracking-widest text-slate-500',
      group: 'rounded-none border-0 border-l-4 border-slate-900 bg-transparent py-1 pl-5 sm:py-1',
      groupLegend: 'text-xs uppercase tracking-widest',
      buttonPrimary: 'rounded-none bg-slate-900 hover:bg-slate-700',
      checkbox: 'accent-slate-900',
      radio: 'accent-slate-900',
    },
  },
  midnight: {
    label: 'Midnight (classes)',
    wrapper: 'rounded-2xl bg-slate-950 p-6 -m-1',
    classes: {
      label: 'text-slate-300',
      title: 'text-slate-300',
      control: 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-fuchsia-400 focus:ring-fuchsia-400/20',
      controlInvalid: 'border-rose-400',
      group: 'border-slate-800 bg-slate-900/60',
      groupLegend: 'text-slate-100',
      optionLabel: 'text-slate-300',
      labelInline: 'text-slate-300',
      help: 'text-slate-500',
      error: 'text-rose-300',
      buttonPrimary: 'bg-fuchsia-500 hover:bg-fuchsia-400 focus-visible:outline-fuchsia-400',
      checkbox: 'accent-fuchsia-500',
      radio: 'accent-fuchsia-500',
    },
  },
}

const preset = ref('default')
const current = computed(() => presets[preset.value])

const form = useFormo({
  alias: 'themed',
  fields: {
    full_name: { required: true, attr: { placeholder: 'Ada Lovelace' } },
    email: { driver: 'email', required: true, message: 'We never share it.' },
    preferences: {
      fields: {
        contact_by: { driver: 'radios', opts: { email: 'Email', phone: 'Phone', pigeon: 'Carrier pigeon' }, val: 'email', inline: true },
        digest: { driver: 'bool', val: true, label: 'Weekly digest' },
      },
    },
    // Per-field classes win over the theme
    motto: { classes: { control: 'font-serif italic' }, attr: { placeholder: 'Per-field classes: font-serif italic' } },
    send: { driver: 'button', label: 'Save preferences', attr: { type: 'submit' } },
  },
})

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="(p, key) in presets"
          :key="key"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="preset === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:text-slate-900'"
          @click="preset = key"
        >
          {{ p.label }}
        </button>
      </div>

      <div :class="current.wrapper">
        <FormoForm :form="form" :theme="current.theme" :classes="current.classes" @submit="(values) => (submitted = values)" />
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
