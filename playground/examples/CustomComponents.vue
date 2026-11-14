<script setup lang="ts">
/**
 * Every way to swap the component a field renders with. Resolution order:
 *
 *   #field:<path> slot  →  replaces the whole field (label, errors included)
 *   #control:<path> slot  →  replaces the control, keeps label/help/errors
 *   field.component  (a component, or a name registered in `components`)
 *   components['driver|type']  (ex: 'input|date')
 *   components['driver']       (ex: 'checkbox') — per form, per group, or app-wide
 *   the driver's own component (register new drivers with createFormo({ drivers }))
 *
 * The label/help/error chrome is swappable too: `wrapper` per field or
 * `components.wrapper` for a form/group.
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo } from 'formo-vue'
import StarRating from '../components/StarRating.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import NativeSlider from '../components/NativeSlider.vue'
import CardWrapper from '../components/CardWrapper.vue'

const definition = Formo.form({ alias: 'review' })
  // 1. Per field: any v-model component (StarRating knows nothing about Formo)
  .add('rating', {
    component: StarRating,
    props: { max: 5 },
    rules: [['not_empty'], ['min_value', [':value', 1]]],
    errorMessages: { required: 'Please pick a rating', min_value: 'Please pick a rating' },
  })
  // 2. A new driver registered app-wide in main.ts (createFormo({ drivers: { tags } }))
  .add('tags', 'tags', ['vue', 'forms'], {
    rules: [['min_items', [':value', 2]]],
    message: 'Enter adds a tag, Backspace removes the last one',
  })
  // 3. By name — what you'd use in JSON from a server: { "component": "color-swatches" }
  .add('theme_color', {
    component: 'color-swatches',
    opts: { '#6366f1': 'Indigo', '#0ea5e9': 'Sky', '#10b981': 'Emerald', '#f59e0b': 'Amber', '#f43f5e': 'Rose' },
    val: '#6366f1',
  })
  // 4. A "third-party" component with a different model contract
  .add('budget', {
    component: NativeSlider,
    model: { prop: 'value', event: 'change' },
    props: { min: 0, max: 500, unit: ' $' },
    val: 120,
    rules: { min_value: 50 },
  })
  // 5. Per-driver override for this form only (see :components below) — both use ToggleSwitch
  .add('newsletter', 'checkbox', true, { label: 'Email me product updates' })
  .add('public', 'checkbox', false, { label: 'Make my review public' })
  // 6. Template slot override (see #control:phone below)
  .add('phone', { message: 'Formatted as you type by a slot', rules: [['phone']] })
  // 7. A custom wrapper around a built-in control
  .add('review', 'textarea', {
    wrapper: CardWrapper,
    required: true,
    message: 'Tell us what you think.',
    attr: { rows: 3 },
  })
  .add('submit', 'button', { label: 'Send review', attr: { type: 'submit' } })

const form = useFormo(definition)

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <FormoForm :form="form" :components="{ checkbox: ToggleSwitch }" @submit="(values) => (submitted = values)">
        <!-- Replaces only the control: label, help text and errors still come from Formo -->
        <template #control:phone="field">
          <div class="flex">
            <span class="inline-flex shrink-0 items-center whitespace-nowrap rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
              🇺🇸 +1
            </span>
            <input
              v-bind="field.attrs"
              :value="field.value"
              inputmode="tel"
              placeholder="(555) 123-4567"
              :class="[field.classes.control, 'rounded-l-none', field.invalid && field.classes.controlInvalid]"
              @input="field.setValue(formatPhone(($event.target as HTMLInputElement).value))"
              @blur="field.onBlur()"
            />
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
