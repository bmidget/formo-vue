<script setup lang="ts">
/**
 * Tailwind everywhere: every element takes its classes from a theme key
 * (`control`, `label`, `group`, `error`, …). Themes merge with
 * tailwind-merge, so overrides only need the classes that change:
 *
 *   app-wide   createFormo({ theme })
 *   per form   <FormoForm :theme="…">
 *   per group  { driver: 'group', theme: {…} }   (cascades to its fields)
 *   per field  { classes: {…} }  or  attr: { class: '…' } on the control
 */
import { computed, ref } from 'vue'
import { Formo, FormoForm, useFormo, type FormoTheme } from 'formo-vue'

const presets: Record<string, { label: string; theme: Partial<FormoTheme>; wrapper: string }> = {
  default: { label: 'Default', theme: {}, wrapper: '' },
  underline: {
    label: 'Minimal underline',
    wrapper: '',
    theme: {
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
    label: 'Midnight',
    wrapper: 'rounded-2xl bg-slate-950 p-6 -m-1',
    theme: {
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

const definition = Formo.form({ alias: 'themed' })
  .add('full_name', { required: true, attr: { placeholder: 'Ada Lovelace' } })
  .add('email', 'input|email', { required: true, message: 'We never share it.' })
  .add(
    Formo.group('preferences')
      .addGroup('contact_by', 'radios', { email: 'Email', phone: 'Phone', pigeon: 'Carrier pigeon' }, 'email', { inline: true })
      .add('digest', 'bool', true, { label: 'Weekly digest' }),
  )
  // Per-field classes win over the theme
  .add('motto', {
    classes: { control: 'font-serif italic' },
    attr: { placeholder: 'Per-field classes: font-serif italic' },
  })
  .add('send', 'button', { label: 'Save preferences', attr: { type: 'submit' } })

const form = useFormo(definition)

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
        <FormoForm :form="form" :theme="current.theme" @submit="(values) => (submitted = values)" />
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
