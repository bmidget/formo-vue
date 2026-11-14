<script setup lang="ts">
/**
 * Subforms, namespaces, ordering — and the form object staying "live":
 * the buttons call builder methods (find, set, order, subform, addRule,
 * remove…) and the rendered form updates immediately.
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo } from 'formo-vue'

const address = Formo.form()
  .add('street')
  .add('city')
  .add('zip', { rules: [['regex', [':value', '/^\\d{5}$/']]], errorMessages: { regex: 'Zip must be 5 digits' } })

const definition = Formo.form({ alias: 'user' })
  .add('first_name', { required: true })
  .add('last_name', { required: true })
  // Adding a form to a form makes it a namespaced subform (driver "group")
  .add('address', address.set('classes', { groupBody: 'grid gap-4 sm:grid-cols-[2fr_1fr_1fr]' }))
  // namespaces: false → the group is visual only, its values stay at the top level
  .add(
    Formo.group('contact', { label: 'Contact (not namespaced)', config: { namespaces: false } })
      .add('email', 'input|email')
      .add('phone', 'input|tel'),
  )
  .add('save', 'button', { label: 'Save', attr: { type: 'submit' } })

const form = useFormo(definition)

const actions = [
  { label: 'Add a “company” field after last name', run: () => definition.add('company', { order: ['after', 'last_name'], message: 'Added at runtime' }) },
  { label: 'Make phone required', run: () => definition.find('phone')?.addRule('not_empty') },
  {
    label: 'Move email to the top',
    run: () => {
      const email = definition.find('email')!
      definition.find('contact')!.remove('email')
      definition.add(email.set('order', 0))
    },
  },
  { label: 'Group names into a “name” subform', run: () => definition.subform('name', ['first_name', 'last_name'], 0) },
  { label: 'Relabel “street” → “Street address”', run: () => definition.find('street')?.set({ label: 'Street address', attr: { placeholder: '221B Baker St' } }) },
  { label: 'Remove the address subform', run: () => definition.remove('address') },
]
const done = ref<number[]>([])
const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <FormoForm :form="form" @submit="(values) => (submitted = values)" />

      <div class="mt-8 border-t border-slate-200 pt-6">
        <h3 class="text-sm font-semibold text-slate-900">Mutate the form object</h3>
        <p class="mt-1 text-xs text-slate-500">Builder methods after render — watch the form and its values change.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="(action, i) in actions"
            :key="i"
            type="button"
            :disabled="done.includes(i)"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-40"
            @click="action.run(), done.push(i)"
          >
            {{ action.label }}
          </button>
        </div>
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
