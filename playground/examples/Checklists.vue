<script setup lang="ts">
/**
 * How a field shows its rules — `errorDisplay` (or the `checklist: true` shortcut):
 *
 *  - 'first'      the first failing rule's message (default)
 *  - 'all'        every failing rule's message
 *  - 'checklist'  every rule as a live requirement: a grey box with ✗ until the
 *                 value meets it, then ✓ — re-evaluated on every keystroke
 *
 * The password rules mirror Laravel's `Password::min(8)->mixedCase()->numbers()->symbols()`.
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo } from 'formo-vue'

const form = useFormo(
  Formo.form({ alias: 'account' })
    .add('email', 'input|email', { required: true, attr: { autocomplete: 'username' } })
    .add('password', 'input|password', {
      checklist: true,
      // 8 characters, upper + lower case, a number, a symbol
      rules: 'required|min:8|mixed_case|numbers|symbols',
      attr: { autocomplete: 'new-password' },
    })
    .add('password_confirmation', 'input|password', {
      label: 'Confirm password',
      rules: 'required|confirmed:@password',
      attr: { autocomplete: 'new-password' },
    })
    .add(
      Formo.group('compare', {
        label: 'Same rules, three displays',
        message: 'Type “a b” in each to compare.',
        config: { namespaces: false, validationMode: 'aggressive' },
      })
        .add('handle_first', { label: 'Handle', message: "errorDisplay: 'first' (default)", rules: 'required|min:4|alpha_dash|max:12' })
        .add('handle_all', { label: 'Handle', message: "errorDisplay: 'all'", errorDisplay: 'all', rules: 'required|min:4|alpha_dash|max:12' })
        .add('handle_checklist', {
          label: 'Handle',
          message: "errorDisplay: 'checklist' — with custom requirement labels",
          errorDisplay: 'checklist',
          // Per-field requirement texts, and a per-rule label
          requirements: { min: '4 characters or more', max: '12 characters at most' },
          rules: ['required', 'min:4', { rule: 'regex', params: [/^[\w-]*$/], label: 'No spaces or symbols (- and _ are fine)' }, 'max:12'],
        }),
    )
    .add('create', 'button', { label: 'Create account', attr: { type: 'submit' } }),
)

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" @submit="(values) => (submitted = values)" />

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.allErrors</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.allErrors }}</pre>
      </div>
      <div v-if="submitted">
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted</h3>
        <pre class="overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted }}</pre>
      </div>
    </aside>
  </div>
</template>
