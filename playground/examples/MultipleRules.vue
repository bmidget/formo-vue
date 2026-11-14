<script setup lang="ts">
/**
 * Several rules on one field. They run in order; what you see depends on
 * `errorDisplay`:
 *
 *  - 'first'     (default) stops at the first failing rule — like Kohana
 *  - 'all'       runs every rule and lists every failure
 *  - 'checklist' shows every rule as a requirement, ticked off live
 *
 * Notations mix freely on the same field: strings, Kohana arrays, vee objects,
 * functions, async rules and `{ rule, params, message, label }` objects.
 * `form.allErrors` holds every message per field.
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo, type RuleContext } from 'formo-vue'

const reserved = ['admin', 'root', 'support']
const notReserved = (value: string) => !reserved.includes(String(value).toLowerCase()) || 'That name is reserved'

const noRepeats = (value: string) => !/(\d)\1/.test(String(value ?? ''))
const notSequential = (value: string) => !'0123456789 9876543210'.includes(String(value ?? '-'))

/** A rule that looks at another field through the rule context */
const notTheUsername = (value: string, _params: unknown[], ctx: RuleContext) =>
  !value || String(value).toLowerCase() !== String(ctx.parentValues.username ?? '').toLowerCase() || 'Must differ from your username'

const form = useFormo(
  Formo.form({ alias: 'multi', config: { validationMode: 'aggressive' } })
    // 6 rules, 4 notations — every failure listed
    .add('username', {
      errorDisplay: 'all',
      message: "errorDisplay: 'all' — try “a!”, then “admin”, then “ben”",
      rules: [
        'required',
        ['min_length', [':value', 3]], // Kohana
        { max: 16 }, // VeeValidate object
        'alpha_dash', // VeeValidate string
        notReserved, // function → custom message
        'username_available', // async, registered in main.ts
      ],
    })
    // Same kind of stack, default display: only the first failure
    .add('website', 'input|url', {
      message: "errorDisplay: 'first' (default) — try “http://example.com”",
      rules: [
        'required',
        // url comes from the input type; these run after it
        { rule: (v: string) => !v || v.startsWith('https://'), message: 'Use a secure https:// address' },
        { rule: (v: string) => !/\.(test|invalid)(\/|$)/.test(v ?? ''), message: '.test and .invalid domains are not allowed' },
      ],
    })
    // Numbers: four rules in object notation
    .add('age', 'input|number', {
      errorDisplay: 'all',
      rules: { required: true, integer: true, min_value: 18, max_value: 120 },
    })
    // Custom function rules in a checklist, each with its own label
    .add('pin', 'input|password', {
      label: 'PIN',
      checklist: true,
      attr: { inputmode: 'numeric' },
      rules: [
        'required',
        'digits:6',
        { rule: noRepeats, label: 'No digit twice in a row' },
        { rule: notSequential, label: 'Not a sequence like 123456' },
      ],
    })
    .add('display_name', {
      errorDisplay: 'all',
      rules: ['required', 'min:2', { rule: notTheUsername, label: 'Different from the username' }],
    })
    // Rules on an option list
    .addGroup('interests', 'checkboxes', { vue: 'Vue', php: 'PHP', laravel: 'Laravel', go: 'Go', rust: 'Rust' }, [], {
      inline: true,
      errorDisplay: 'all',
      rules: 'required|min_items:2|max_items:3',
      message: 'Pick 2 or 3',
    })
    .add('save', 'button', { label: 'Validate', attr: { type: 'submit' } }),
)

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" @submit="(values) => (submitted = values)" />

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.allErrors — every message per field</h3>
        <pre class="max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.allErrors }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
      <div v-if="submitted">
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted</h3>
        <pre class="overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted }}</pre>
      </div>
    </aside>
  </div>
</template>
