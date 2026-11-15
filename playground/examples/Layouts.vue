<script setup lang="ts">
/**
 * Render any part of a form, anywhere — Formo's `$object->render()` at every level.
 * `form.fields` mirrors the definition, and <FormoField> renders any of it:
 *
 *   <FormoForm :form="form" />                               the whole form (automatic layout)
 *   <FormoForm :form="form"> …your layout… </FormoForm>       your own layout (default slot)
 *   <FormoField :field="form.fields.address" />              a subform
 *   <FormoField :field="form.fields.email" />                a field
 *   <FormoField :field="…" v-slot="{ field }">               your own markup for the whole field, with the
 *     <FormoLabel :field="field" /> <FormoInput … />           theme's parts wherever you want them
 *     <FormoErrors … /> <FormoHelp … />                        (its label / control / errors / help)
 *   <FormoField :field="…"><template #input>…<FormoInput />  keep the view, take over one region (#label, #errors…)
 *   <FormoInput :field="form.fields.email" />                just the control, anywhere
 *   <FormoRest />                                            everything you haven't placed
 *
 * Handles work outside <FormoForm> too: the newsletter card on the right renders one.
 */
import { ref } from 'vue'
import { FormoErrors, FormoField, FormoForm, FormoHelp, FormoInput, FormoLabel, FormoRest, useFormo } from 'formo-vue'
import NewsletterCard from '../components/NewsletterCard.vue'

const form = useFormo({
  alias: 'profile',
  fields: {
    first_name: { required: true },
    last_name: { required: true },
    email: { driver: 'email', required: true, message: 'We never share it.' },
    website: { driver: 'url', attr: { placeholder: 'example.com' } },
    address: {
      label: 'Address',
      fields: {
        street: { required: true },
        zip: { rules: 'required|digits:5' },
        city: { required: true },
      },
    },
    phones: {
      blueprint: true,
      min: 1,
      max: 3,
      addLabel: 'Add phone',
      val: [{}],
      fields: {
        type: { driver: 'select', opts: { mobile: 'Mobile', home: 'Home', work: 'Work' }, val: 'mobile' },
        number: { driver: 'tel', required: true, attr: { placeholder: 'Number' } },
      },
    },
    bio: { driver: 'textarea', attr: { rows: 3 }, message: 'Rendered by <FormoRest /> — not placed by hand' },
    timezone: { driver: 'select', val: 'UTC', opts: ['UTC', 'Europe/Paris', 'America/New_York'], message: 'Also from <FormoRest />' },
    newsletter: { driver: 'bool', val: true, label: 'Send me the monthly newsletter' },
  },
})

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" @submit="(values) => (submitted = values)">
      <!-- Your own layout: place fields wherever you want -->
      <div class="grid gap-4 sm:grid-cols-2">
        <FormoField :field="form.fields.first_name" />
        <FormoField :field="form.fields.last_name" />
      </div>

      <!-- Your own markup for the whole field; the theme's parts render wherever you put them, wired together -->
      <FormoField :field="form.fields.email" v-slot="{ field }">
        <div class="grid items-start gap-x-4 gap-y-1 rounded-xl bg-indigo-50/60 p-4 sm:grid-cols-[8rem_1fr]">
          <div class="pt-2"><FormoLabel :field="field" /></div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-lg" aria-hidden="true">✉️</span>
              <FormoInput :field="field" />
            </div>
            <div v-if="field.invalid" class="rounded-md bg-rose-100/70 px-2 py-1"><FormoErrors :field="field" /></div>
            <FormoHelp :field="field" />
          </div>
        </div>
      </FormoField>

      <!-- Keep the theme's view, take over one region: things around the control -->
      <FormoField :field="form.fields.website">
        <template #input>
          <div class="flex">
            <span class="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">https://</span>
            <FormoInput class="rounded-l-none" />
          </div>
        </template>
      </FormoField>

      <!-- A subform: keep the theme's fieldset, lay out its fields (`#fields`); the default slot would replace it all -->
      <FormoField :field="form.fields.address">
        <template #fields="{ fields }">
          <FormoField :field="fields.street" />
          <div class="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <FormoField :field="fields.zip" />
            <FormoField :field="fields.city" />
          </div>
        </template>
      </FormoField>

      <!-- Repeatable rows with a custom row layout: just the controls, and the errors under them -->
      <FormoField :field="form.fields.phones">
        <template #row="{ row }">
          <div class="flex gap-2">
            <div class="w-32 shrink-0"><FormoInput :field="row.fields.type" /></div>
            <div class="flex-1"><FormoInput :field="row.fields.number" /></div>
          </div>
          <FormoErrors :field="row.fields.number" />
        </template>
      </FormoField>

      <!-- Everything not placed above (bio, timezone). The newsletter field is rendered by the card outside the form -->
      <FormoRest />

      <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Save profile
      </button>
    </FormoForm>

    <aside class="space-y-4 text-xs">
      <!-- Outside <FormoForm>: a separate component rendering one field of the same form -->
      <NewsletterCard :field="form.fields.newsletter" />
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
