<script setup lang="ts">
/**
 * Validation runs on VeeValidate. Rules can be written in any of these
 * notations — mix them freely:
 *
 *  - strings (Laravel-style)   'required|min:3|confirmed:@email'
 *  - tuples                    [['required'], ['between', [1, 10]]]
 *  - VeeValidate objects       { required: true, between: [1, 10] }
 *  - functions (sync/async)    (value, params, ctx) => true | false | 'message'
 *  - Standard Schema           z.string().min(3)  (zod, valibot, arktype)
 *  - registered rule names     'username_available' (see playground/main.ts)
 */
import { computed, ref } from 'vue'
import { z } from 'zod'
import { Formo, FormoErrorSummary, FormoForm, useFormo, type ValidationMode } from 'formo-vue'

const form = useFormo(
  Formo.form({ alias: 'validation' })
    .add('username', {
      // Tuples + a rule registered app-wide with createFormo({ rules })
      rules: [['required'], ['alpha_dash'], ['min', [3]], ['username_available']],
      message: 'Try “admin” or “ben” — checked asynchronously',
    })
    .add('email', 'input|email', { rules: 'required' })
    .add('email_confirm', 'input|email', {
      label: 'Confirm email',
      // Cross-field reference with @ (the message uses the other field's label)
      rules: 'required|confirmed:@email',
    })
    .add('age', 'input|number', { rules: { required: true, integer: true, between: [18, 99] } })
    .add('nickname', {
      // A zod schema (any Standard Schema works)
      rules: z.string().max(12, 'Keep it under 12 characters').regex(/^[^\d]*$/, 'No digits, please'),
      message: 'Validated by zod',
    })
    .add('coupon', {
      // A plain function; return a string to choose the message
      rules: [(value: string) => !value || /^FORMO-\d{4}$/.test(value) || 'Coupons look like FORMO-1234'],
      attr: { placeholder: 'FORMO-2024' },
    })
    .add(
      // Group-level rules get the group's values and run once its fields pass
      Formo.group('trip', {
        label: 'Trip dates',
        rules: [
          (trip: { start: string; end: string }) =>
            !trip.start || !trip.end || trip.end > trip.start || 'The trip must end after it starts',
        ],
        classes: { groupBody: 'grid gap-4 sm:grid-cols-2' },
      })
        .add('start', 'input|date', { required: true })
        .add('end', 'input|date', { required: true }),
    )
    .add('terms', 'bool', false, {
      label: 'I have read the rules',
      required: true,
      // Per-field messages, like Formo's `error_messages`
      errorMessages: { required: 'Please tick the box' },
    })
    .add('go', 'button', { label: 'Validate & submit', attr: { type: 'submit' } }),
)

const mode = ref<ValidationMode>('eager')
const modes: Array<{ id: ValidationMode; hint: string }> = [
  { id: 'eager', hint: 'on blur, then on every keystroke once touched' },
  { id: 'aggressive', hint: 'on every keystroke' },
  { id: 'lazy', hint: 'on blur only (re-checks while an error is shown)' },
  { id: 'submit', hint: 'only when submitting' },
]

// Form-wide config (cascades to every field): message overrides + validation mode
const config = computed(() => ({
  validationMode: mode.value,
  messages: {
    between: ':field must be between :param1 and :param2 (inclusive)', // a rule, for every field
    'email.required': 'We need an email to reach you', // one field (Formo message file keys)
  },
}))

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <div class="mb-6 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Validation mode</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="m in modes"
            :key="m.id"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="mode === m.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:text-indigo-600'"
            @click="mode = m.id"
          >
            {{ m.id }}
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-500">{{ modes.find((m) => m.id === mode)?.hint }}</p>
      </div>

      <FormoForm :form="form" :config="config" @submit="(values) => (submitted = values)">
        <template #before>
          <FormoErrorSummary />
        </template>
      </FormoForm>
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
