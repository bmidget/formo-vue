<script setup lang="ts">
/**
 * Migration path: keep defining forms in PHP and ship them to Vue.
 * Formo (PHP) already had `$form->to_array()` "for sending form objects
 * across an api" — formo-vue renders that JSON directly: `_NOTSET` labels,
 * `'class' => NULL` attrs, Kohana rule arrays and `input|type` drivers included.
 *
 * Edit the JSON: the form re-renders live.
 */
import { ref, shallowRef, watch } from 'vue'
import { Formo, FormoForm, useFormo, type FieldDef } from 'formo-vue'

const php = `$form = Formo::form(['alias' => 'user'])
  ->add('username', ['rules' => [['not_empty'], ['max_length', [':value', 32]]]])
  ->add('email', 'input|email', ['rules' => [['not_empty'], ['email']]])
  ->add('role', 'select', 'editor', ['opts' => ['admin' => 'Administrator', 'editor' => 'Editor', 'viewer' => 'Viewer']])
  ->add('bio', 'textarea', ['label' => 'About you'])
  ->add('active', 'checkbox', TRUE)
  ->add('save', 'input|submit', 'Save user');

echo json_encode($form->to_array());`

// What the PHP above outputs (Formo_Core_Formo::to_array)
const initialJson = {
  alias: 'user', driver: 'form', template: null, val: { username: null, email: null, role: 'editor', bio: null, active: true, save: 'Save user' },
  opts: [], attr: { class: null, id: 'user' }, rules: [], filters: [], callbacks: [], html: null, render: true, label: '_NOTSET',
  fields: [
    { alias: 'username', driver: 'input', template: null, val: null, opts: [], attr: { class: null, id: 'username' }, rules: [['not_empty'], ['max_length', [':value', 32]]], filters: [], callbacks: [], html: null, render: true, label: '_NOTSET', fields: [] },
    { alias: 'email', driver: 'input', template: null, val: null, opts: [], attr: { class: null, type: 'email', id: 'email' }, rules: [['not_empty'], ['email']], filters: [], callbacks: [], html: null, render: true, label: '_NOTSET', fields: [] },
    { alias: 'role', driver: 'select', template: null, val: 'editor', opts: { admin: 'Administrator', editor: 'Editor', viewer: 'Viewer' }, attr: { class: null, id: 'role' }, rules: [], filters: [], callbacks: [], html: null, render: true, label: '_NOTSET', fields: [] },
    { alias: 'bio', driver: 'textarea', template: null, val: null, opts: [], attr: { class: null, id: 'bio' }, rules: [], filters: [], callbacks: [], html: null, render: true, label: 'About you', fields: [] },
    { alias: 'active', driver: 'checkbox', template: null, val: true, opts: [], attr: { class: null, id: 'active' }, rules: [], filters: [], callbacks: [], html: null, render: true, label: '_NOTSET', fields: [] },
    { alias: 'save', driver: 'input', template: null, val: 'Save user', opts: [], attr: { class: null, type: 'submit', id: 'save' }, rules: [], filters: [], callbacks: [], html: null, render: true, label: '_NOTSET', fields: [] },
  ],
}

const source = ref(JSON.stringify(initialJson, null, 2))
const error = ref('')
const definition = shallowRef<FieldDef>(Formo.fromJSON(initialJson).toSchema())

// Re-parse on every edit; keep the last valid definition while the JSON is broken
watch(source, (json) => {
  try {
    definition.value = Formo.fromJSON(json).toSchema()
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  }
})

const form = useFormo(definition)
const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <details class="group mb-4 rounded-xl bg-slate-900 text-slate-100 open:pb-3">
        <summary class="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-slate-300">
          <span class="mr-1 inline-block transition group-open:rotate-90">▸</span> The PHP that produced this JSON
        </summary>
        <pre class="overflow-x-auto px-4 font-mono text-[12px] leading-relaxed text-emerald-300">{{ php }}</pre>
      </details>

      <label class="mb-1.5 block text-xs font-semibold text-slate-500" for="json"><code class="text-slate-700">$form->to_array()</code> as JSON — edit me</label>
      <textarea
        id="json"
        v-model="source"
        spellcheck="false"
        class="h-56 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-slate-800 outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15"
      />
      <p v-if="error" class="mt-1 text-xs font-medium text-rose-600">Invalid JSON — showing the last valid version. {{ error }}</p>

      <div class="mt-6 border-t border-dashed border-slate-300 pt-6">
        <FormoForm :form="form" @submit="(values) => (submitted = values)" />
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
