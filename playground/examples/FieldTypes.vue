<script setup lang="ts">
/**
 * Every built-in driver. HTML5 input types get validation rules automatically
 * (Formo's `input_rules` config): email, url, tel, date, color, number/range
 * (checked against min/max/step)…
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo } from 'formo-vue'

const hobbies = { run: 'Running', swim: 'Swimming', bike: 'Biking', hike: 'Hiking' }
const activities = {
  Exercise: { run: 'Running', swim: 'Swimming' },
  Dates: { movie: 'Movie', dinner: 'Dinner', bowling: 'Bowling' },
}

const form = useFormo(
  Formo.form({ alias: 'types' })
    .add(
      Formo.group('inputs', { label: 'Inputs', classes: { groupBody: 'grid gap-4 sm:grid-cols-2' } })
        .add('name', { attr: { placeholder: 'Text (default driver)' } })
        .add('email', 'input|email', { attr: { placeholder: 'Validated as email' } })
        .add('website', 'input|url', { attr: { placeholder: 'https://…' } })
        .add('phone', 'input|tel', { message: '7, 10 or 11 digits' })
        .add('age', 'input|number', { attr: { min: 18, max: 120 } })
        .add('dob', 'input|date')
        .add('alarm', 'input|time')
        .add('favorite_color', 'input|color', '#6366f1')
        .add('volume', 'input|range', 40, { attr: { min: 0, max: 100, step: 10 } })
        .add('query', 'input|search', { attr: { placeholder: 'Search…' } })
        .add('secret_id', 'input|hidden', 'abc-123'),
    )
    .add(
      Formo.group('choices', { label: 'Options' })
        // add_group(alias, driver, opts, val, settings) — straight from the Formo guide
        .addGroup('hobby', 'select', hobbies, 'swim', { label: 'Favorite hobby', blank: 'Choose…' })
        .addGroup('activity', 'select', activities, null, { blank: true, message: 'Optgroups from nested options' })
        .addGroup('languages', 'select', ['PHP', 'TypeScript', 'Go', 'Rust'], ['TypeScript'], { attr: { multiple: true, size: 4 } })
        .addGroup('car', 'datalist', ['BMW', 'Mercedes', 'Honda', 'Ford'], '', { attr: { placeholder: 'Start typing…' } })
        .addGroup('favorite_hobbies', 'checkboxes', hobbies, ['swim', 'hike'], { inline: true, rules: 'min_items:1' })
        .addGroup('plan', 'radios', [[1, 'Free'], [2, 'Pro — $9'], [3, 'Team — $29']], 1)
        .addGroup('flags', 'set', { a: 'Option A', b: 'Option B', c: 'Option C' }, 'a,c', {
          message: 'The “set” driver stores a comma separated string (MySQL SET columns)',
        })
        .add('subscribe', 'bool', true, { label: 'Send me the newsletter' }),
    )
    .add(
      Formo.group('misc', { label: 'Other drivers' })
        .add('notes', 'textarea', { attr: { rows: 3 } })
        .add('avatar', 'file', { rules: 'ext:png,jpg,jpeg,gif', message: 'PNG, JPG or GIF' })
        .add('attachments', 'file', { attr: { multiple: true }, rules: [['Upload::size', [':value', '2M']]] })
        .add('member_since', 'input|date', '2014-05-01', { editable: false, message: 'editable: false renders the value as text' })
        .addGroup('level', 'select', { 1: 'Beginner', 2: 'Expert' }, '2', { editable: false })
        .add('locked', { val: 'Disabled input', attr: { disabled: true } }),
    )
    .add(
      Formo.group('actions', {
        label: false,
        config: { namespaces: false },
        classes: { group: 'border-0 bg-transparent p-0 sm:p-0', groupBody: 'flex gap-3' },
      })
        .add('submit', 'button', { label: 'Submit', attr: { type: 'submit' } })
        .add('reset', 'button', { label: 'Reset', attr: { type: 'reset' } }),
    ),
)

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" @submit="(values) => (submitted = values)" />

    <aside class="space-y-4 text-xs xl:sticky xl:top-6">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.errors</h3>
        <pre class="max-h-60 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.errors }}</pre>
      </div>
      <div v-if="submitted">
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted</h3>
        <pre class="max-h-60 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted }}</pre>
      </div>
    </aside>
  </div>
</template>
