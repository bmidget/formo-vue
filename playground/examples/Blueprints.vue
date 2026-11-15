<script setup lang="ts">
/**
 * Blueprints: a group whose fields are the template for repeatable rows.
 * `blueprint: true` (or the builder's `padBlueprint(rows)`).
 * Values are arrays of row objects; names look like `profile[phones][0][number]`.
 *
 * Rendered by the theme (phones), or by your own markup (education, below):
 * the default slot gets `{ rows, add, remove, canAdd, canRemove }`, each row a
 * handle — `row.fields.school`, `row.remove()`, `row.key` for v-for. The same
 * handles work anywhere: `form.fields.education.rows`, `.add()`.
 */
import { ref } from 'vue'
import { Formo, FormoErrors, FormoForm, FormoHelp, FormoInput, FormoLabel, useFormo } from 'formo-vue'

const phoneTypes = { mobile: 'Mobile', home: 'Home', work: 'Work' }

const definition = Formo.form({ alias: 'profile' })
  .add('name', { required: true })
  .add(
    Formo.group('phones', {
      min: 1,
      max: 4,
      addLabel: 'Add phone',
      rowLabel: 'Phone :index',
      classes: { blueprintRow: 'grid gap-4 space-y-0 sm:grid-cols-[140px_1fr] sm:[&>*:first-child]:col-span-2' },
      // Group rule over the whole array
      rules: [
        (rows: Array<{ type: string }>) =>
          rows.filter((r) => r.type === 'mobile').length <= 1 || 'Only one mobile number, please',
      ],
    })
      .addGroup('type', 'select', phoneTypes, 'mobile', { label: 'Type' })
      .add('number', 'input|tel', { required: true, attr: { placeholder: '555 123 4567' } })
      // Formo's pad_blueprint(): pre-fill rows
      .padBlueprint([{ type: 'mobile', number: '555 010 9999' }]),
  )
  .add(
    Formo.group('education', { addLabel: 'Add school', removeLabel: 'Delete', rowLabel: 'School :index', message: 'Optional — starts empty' })
      .add('school', { required: true })
      .add('graduated', 'input|number', { attr: { min: 1950, max: 2030 } })
      .padBlueprint(0),
  )
  .add('save', 'button', { label: 'Save profile', attr: { type: 'submit' } })

const form = useFormo(definition)

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <FormoForm :form="form" @submit="(values) => (submitted = values)">
        <!-- Your own markup for a whole repeatable group (the automatic layout renders the rest) -->
        <template #field:education="{ rows, add, canAdd }">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <FormoLabel />
              <button
                type="button"
                :disabled="!canAdd"
                class="rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                @click="add()"
              >
                + Add school
              </button>
            </div>
            <FormoHelp />
            <table v-if="rows.length" class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-slate-500">
                  <th class="pb-1 font-medium">School</th>
                  <th class="w-32 pb-1 font-medium">Graduated</th>
                  <th class="w-8" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.key" class="align-top">
                  <td class="pr-2 pb-2">
                    <FormoInput :field="row.fields.school" />
                    <FormoErrors :field="row.fields.school" />
                  </td>
                  <td class="pr-2 pb-2"><FormoInput :field="row.fields.graduated" /></td>
                  <td class="pb-2">
                    <button type="button" class="px-2 py-2 text-slate-400 hover:text-rose-600" aria-label="Remove" @click="row.remove()">×</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
