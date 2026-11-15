<script setup lang="ts">
/**
 * A form is one object: every field keyed by its alias, subforms nested under
 * `fields`. Rules keep Formo's notations (Kohana arrays) or VeeValidate's.
 *
 *   $form = Formo::form(['alias' => 'signup'])
 *     ->add('username', ['rules' => [['not_empty'], ['min_length', [':value', 3]]]])
 *     ->add('email', 'input|email', ['required' => TRUE]) …
 *
 * The PHP-style builder is there too — `Formo.form('signup').add('username', {…})`
 * — and handy to change a form at runtime (see "Subforms & form objects").
 *
 * `useFormo()` gives you the live form object: values, errors, validate(), load()…
 */
import { ref } from 'vue'
import { FormoForm, useFormo } from 'formo-vue'

const form = useFormo({
  alias: 'signup',
  fields: {
    username: {
      // Kohana rule arrays work as-is
      rules: [['not_empty'], ['min_length', [':value', 3]], ['alpha_dash']],
      message: 'Letters, numbers, dashes and underscores.',
      attr: { autocomplete: 'username' },
    },
    // `driver: 'email'` is `input|email`, just like Formo
    email: { driver: 'email', required: true, attr: { placeholder: 'you@example.com' } },
    // …and so do VeeValidate rule strings
    password: { driver: 'password', rules: 'required|min:8' },
    password_confirm: {
      driver: 'password',
      label: 'Confirm password',
      rules: [['matches', [':validation', 'password_confirm', 'password']]],
    },
    // A string is just the driver
    website: 'url',
    bio: { driver: 'textarea', attr: { rows: 3, placeholder: 'Optional' }, filters: ['trim'] },
    agree: {
      driver: 'bool',
      val: false,
      label: 'I agree to the terms and conditions',
      rules: [(value: boolean) => value === true || 'You must agree to continue'],
    },
    save: { driver: 'button', label: 'Create account', attr: { type: 'submit' } },
  },
})

const submitted = ref<Record<string, unknown>>()

async function save(values: Record<string, unknown>) {
  await new Promise((r) => setTimeout(r, 600)) // call your API here — the button spins meanwhile
  submitted.value = values
}
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" @submit="save" />

    <!-- The form object is reactive: read its state anywhere -->
    <aside class="space-y-4 text-xs">
      <p class="text-slate-500">
        valid: <b>{{ form.valid }}</b> · dirty: <b>{{ form.dirty }}</b> · submitting: <b>{{ form.submitting }}</b>
      </p>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.errors</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.errors }}</pre>
      </div>
      <div v-if="submitted">
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted (filters applied)</h3>
        <pre class="overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted }}</pre>
      </div>
    </aside>
  </div>
</template>
