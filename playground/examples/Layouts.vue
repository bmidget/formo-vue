<script setup lang="ts">
/**
 * Render any part of a form, anywhere — Formo's `$object->render()` at every level:
 *
 *   <FormoForm :form="form" />                       the whole form (automatic layout)
 *   <FormoForm :form="form"> …your layout… </FormoForm>   your own layout (default slot)
 *   <FormoRender path="address" />                   a subform          ($form->address->render())
 *   <FormoRender path="email" />                     a field            ($form->email->render())
 *   <FormoRender path="email" part="input" />        just the control   ($form->email->input())
 *   <FormoRender path="email" part="label" />        …or label / error / help / checklist
 *   <FormoRender :form="form" path="newsletter" />   outside <FormoForm>, in any component
 *   <component :is="form.render('email')" />         object style, like <?= $form->email->render() ?>
 *   <FormoRest />                                    everything you haven't placed
 *
 * Paths resolve relative to the subform / row you're in, then from the form, then by alias.
 */
import { ref } from 'vue'
import { Formo, FormoForm, FormoRender, FormoRest, useFormo } from 'formo-vue'
import NewsletterCard from '../components/NewsletterCard.vue'

const form = useFormo(
  Formo.form({ alias: 'profile' })
    .add('first_name', { required: true })
    .add('last_name', { required: true })
    .add('email', 'input|email', { required: true, message: 'We never share it.' })
    .add(
      Formo.group('address', { label: 'Address' })
        .add('street', { required: true })
        .add('zip', { rules: 'required|digits:5' })
        .add('city', { required: true }),
    )
    .add(
      Formo.group('phones', { min: 1, max: 3, addLabel: 'Add phone' })
        .addGroup('type', 'select', { mobile: 'Mobile', home: 'Home', work: 'Work' }, 'mobile')
        .add('number', 'input|tel', { required: true, attr: { placeholder: 'Number' } })
        .padBlueprint(1),
    )
    .add('bio', 'textarea', { attr: { rows: 3 }, message: 'Rendered by <FormoRest /> — not placed by hand' })
    .add('timezone', 'select', 'UTC', { opts: ['UTC', 'Europe/Paris', 'America/New_York'], message: 'Also from <FormoRest />' })
    .add('newsletter', 'bool', true, { label: 'Send me the monthly newsletter' }),
)

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <FormoForm :form="form" @submit="(values) => (submitted = values)">
      <!-- Your own layout: place parts wherever you want -->
      <div class="grid gap-4 sm:grid-cols-2">
        <FormoRender path="first_name" />
        <FormoRender path="last_name" />
      </div>

      <!-- A field taken apart: label / input / help / error placed separately -->
      <div class="grid items-start gap-x-4 gap-y-1 rounded-xl bg-indigo-50/60 p-4 sm:grid-cols-[8rem_1fr]">
        <div class="pt-2"><FormoRender path="email" part="label" /></div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-lg" aria-hidden="true">✉️</span>
            <FormoRender path="email" part="input" />
          </div>
          <FormoRender path="email" part="error" />
          <FormoRender path="email" part="help" />
        </div>
      </div>

      <!-- A subform with its own inner layout: paths inside are relative to it -->
      <FormoRender path="address">
        <FormoRender path="street" />
        <div class="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <FormoRender path="zip" />
          <FormoRender path="city" />
        </div>
      </FormoRender>

      <!-- Repeatable rows with a custom row layout -->
      <FormoRender path="phones">
        <template #row>
          <div class="flex gap-2">
            <div class="w-32 shrink-0"><FormoRender path="type" part="input" /></div>
            <div class="flex-1"><FormoRender path="number" part="input" /></div>
          </div>
          <FormoRender path="number" part="error" />
        </template>
      </FormoRender>

      <!-- Everything not placed above (bio, timezone). The newsletter field is rendered by the card outside the form -->
      <FormoRest />

      <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Save profile
      </button>
    </FormoForm>

    <aside class="space-y-4 text-xs">
      <!-- Outside <FormoForm>: a separate component rendering one field of the same form -->
      <NewsletterCard :form="form" />
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
