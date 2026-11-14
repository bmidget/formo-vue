<script setup lang="ts">
/**
 * Optional subforms — Formo's `ignore`, triggered by the form's own values.
 *
 * An ignored field or subform is fully optional: none of its rules run, group
 * rules and callbacks inside it are skipped, existing errors clear and required
 * markers disappear. It stays rendered (dimmed) — hiding it is a separate choice
 * (`render`). Un-ignore it and it's validated again.
 *
 * Ways to trigger it, all JSON-friendly except the function form:
 *
 *  1. On the checkbox:      { driver: 'checkbox', ignores: 'shipping' }
 *  2. On the subform:       { ignore: { when: 'is_gift', not: true } }   (or a function)
 *     …or `exclude` instead of `ignore` to also drop its values (Laravel exclude_if)
 *  3. Laravel rules on fields: required_if / required_unless / required_with /
 *     required_without / exclude_if
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo } from 'formo-vue'

const address = (alias: string, label: string) =>
  Formo.group(alias, { label, classes: { groupBody: 'grid gap-4 sm:grid-cols-[2fr_1fr_1fr]' } })
    .add('street', { required: true })
    .add('city', { required: true })
    .add('zip', { rules: 'required|digits:5' })

/** Visual only: also hide the shipping subform while it's ignored */
const hideIgnored = ref(false)

const form = useFormo(
  Formo.form({ alias: 'checkout' })
    .add(address('billing', 'Billing address'))

    // 1. The rule lives on the checkbox: while checked, `shipping` is fully optional
    .add('same_as_billing', 'checkbox', false, { label: 'Ship to my billing address', ignores: 'shipping' })
    .add(
      address('shipping', 'Shipping address').set('render', ({ values }: { values: Record<string, any> }) => !(hideIgnored.value && values.same_as_billing)),
    )

    // 2. The condition lives on the subform; `exclude` also drops its values from the submit
    .add('is_gift', 'checkbox', false, { label: 'This is a gift' })
    .add(
      Formo.group('gift', { label: 'Gift message', exclude: { when: 'is_gift', not: true } })
        .add('to', { label: 'Recipient name', required: true })
        .add('note', 'textarea', { rules: 'required|max:140', attr: { rows: 2 } }),
    )

    // 3. Laravel-style conditional rules on individual fields
    .add(
      Formo.group('account', { label: 'Invoice details', classes: { groupBody: 'grid gap-4 sm:grid-cols-2' } })
        .addGroup('type', 'radios', { personal: 'Personal', business: 'Business' }, 'personal', { inline: true })
        .add('email_invoice', 'checkbox', true, { label: 'Email me the invoice' })
        .add('company', { rules: 'required_if:type,business', message: 'required_if:type,business' })
        .add('vat_number', { label: 'VAT number', rules: 'required_with:company', message: 'required_with:company' })
        .add('postal_copy', { label: 'Postal address for the invoice', rules: 'required_without:email_invoice', message: 'required_without:email_invoice' }),
    )
    .add('order', 'button', { label: 'Place order', attr: { type: 'submit' } }),
)

const watched = ['shipping', 'gift', 'account.company', 'account.vat_number', 'account.postal_copy']
const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <label class="mb-5 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
        <input v-model="hideIgnored" type="checkbox" class="accent-indigo-600" />
        Also hide the shipping subform while it's ignored (visual only — validation is the same either way)
      </label>
      <FormoForm :form="form" @submit="(values) => (submitted = values)" />
    </div>

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.isIgnored(path)</h3>
        <ul class="space-y-1 rounded-xl bg-slate-900 p-3 font-mono">
          <li v-for="path in watched" :key="path" class="flex justify-between gap-2">
            <span class="text-slate-300">{{ path }}</span>
            <span :class="form.isIgnored(path) ? 'text-amber-300' : 'text-slate-500'">
              {{ form.isIgnored(path) ? (form.isExcluded(path) ? 'excluded' : 'ignored') : 'validated' }}
            </span>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.errors</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.errors }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted — excluded groups are dropped</h3>
        <pre class="max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted ?? 'Place the order to see the payload' }}</pre>
      </div>
    </aside>
  </div>
</template>
