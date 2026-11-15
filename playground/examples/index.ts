import type { Component } from 'vue'
import GettingStarted from './GettingStarted.vue'
import FieldTypes from './FieldTypes.vue'
import Subforms from './Subforms.vue'
import Validation from './Validation.vue'
import CustomComponents from './CustomComponents.vue'
import Blueprints from './Blueprints.vue'
import ServerErrors from './ServerErrors.vue'
import FromModels from './FromModels.vue'
import Theming from './Theming.vue'
import Checklists from './Checklists.vue'
import MultipleRules from './MultipleRules.vue'
import OptionalSubforms from './OptionalSubforms.vue'
import I18n from './I18n.vue'
import Laravel from './Laravel.vue'
import Layouts from './Layouts.vue'
import NuxtUi from './NuxtUi.vue'
import ShadcnVue from './ShadcnVue.vue'

/** Raw sources, shown in the "Source" tab */
const sources = import.meta.glob('./*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface Example {
  id: string
  title: string
  section: string
  summary: string
  file: string
  component: Component
}

const list: Array<Omit<Example, 'file'> & { file: string }> = [
  {
    id: 'getting-started',
    title: 'Getting started',
    section: 'Basics',
    summary: 'A form defined as one object (or with the builder), rendered by <FormoForm>, with the live form values and errors next to it.',
    file: 'GettingStarted.vue',
    component: GettingStarted,
  },
  {
    id: 'field-types',
    title: 'Field types',
    section: 'Basics',
    summary: 'Every built-in driver: inputs (with HTML5 auto-rules), select, checkboxes, radios, set, datalist, file, uneditable…',
    file: 'FieldTypes.vue',
    component: FieldTypes,
  },
  {
    id: 'layouts',
    title: 'Render parts anywhere',
    section: 'Basics',
    summary: 'Your own layout with form.fields handles: render subforms and fields anywhere (even outside the <form>), wrap a control with a slot, or lay out one field yourself.',
    file: 'Layouts.vue',
    component: Layouts,
  },
  {
    id: 'subforms',
    title: 'Subforms & form objects',
    section: 'Basics',
    summary: 'Namespaced groups, ordering, subform() — and mutating the form object live after render.',
    file: 'Subforms.vue',
    component: Subforms,
  },
  {
    id: 'validation',
    title: 'Validation',
    section: 'Validation',
    summary: 'VeeValidate under the hood. Rule strings and objects, Laravel rules, functions, async rules, zod, group rules, messages.',
    file: 'Validation.vue',
    component: Validation,
  },
  {
    id: 'multiple-rules',
    title: 'Multiple rules per field',
    section: 'Validation',
    summary: 'Stacks of rules in mixed notations on each field — first failure only, every failure, or a live checklist.',
    file: 'MultipleRules.vue',
    component: MultipleRules,
  },
  {
    id: 'checklists',
    title: 'Error display & checklists',
    section: 'Validation',
    summary: "errorDisplay: 'first' | 'all' | 'checklist' — e.g. password requirements that tick off live as you type.",
    file: 'Checklists.vue',
    component: Checklists,
  },
  {
    id: 'optional-subforms',
    title: 'Optional subforms',
    section: 'Validation',
    summary: '“Ship to my billing address” makes the whole shipping subform optional — plus conditions on subforms and Laravel required_if/with/without.',
    file: 'OptionalSubforms.vue',
    component: OptionalSubforms,
  },
  {
    id: 'server-errors',
    title: 'Callbacks & server errors',
    section: 'Validation',
    summary: 'pass/fail callbacks, form-level rules, async submit and errors coming back from the server.',
    file: 'ServerErrors.vue',
    component: ServerErrors,
  },
  {
    id: 'custom-components',
    title: 'Custom components',
    section: 'Customizing',
    summary: 'Override the component of any field: per field, per driver, by name, via slots that wrap or replace the control — plus custom views and new drivers.',
    file: 'CustomComponents.vue',
    component: CustomComponents,
  },
  {
    id: 'theming',
    title: 'Theming',
    section: 'Customizing',
    summary: 'Themes swap the views, controls and classes — floating labels, horizontal forms — or just restyle with class overrides.',
    file: 'Theming.vue',
    component: Theming,
  },
  {
    id: 'i18n',
    title: 'Translations (i18n)',
    section: 'Customizing',
    summary: 'Switch languages live: labels, options, placeholders, messages, checklists and UI strings — built-in en/fr/es/de/nl plus any @vee-validate/i18n locale.',
    file: 'I18n.vue',
    component: I18n,
  },
  {
    id: 'nuxt-ui',
    title: 'Nuxt UI',
    section: 'UI libraries',
    summary: 'formo-vue/nuxt-ui: every field in a UFormField with Nuxt UI controls — USelectMenu / USwitch swapped in by name, parts in your own markup.',
    file: 'NuxtUi.vue',
    component: NuxtUi,
  },
  {
    id: 'shadcn-vue',
    title: 'shadcn-vue',
    section: 'UI libraries',
    summary: 'The formo registry item: your shadcn-vue components as Formo’s controls, in shadcn’s field layout — or just the look, with shadcnClasses.',
    file: 'ShadcnVue.vue',
    component: ShadcnVue,
  },
  {
    id: 'blueprints',
    title: 'Repeatable groups',
    section: 'Advanced',
    summary: 'Formo blueprints: add/remove rows, min/max, pre-filled rows and rules over the whole list.',
    file: 'Blueprints.vue',
    component: Blueprints,
  },
  {
    id: 'laravel',
    title: 'Laravel & CSRF',
    section: 'Advanced',
    summary: 'CSRF for Sanctum SPAs (XSRF cookie, 419 refresh + retry, 422 mapping) and Blade-style native posts (_token, _method) — against a mock Laravel.',
    file: 'Laravel.vue',
    component: Laravel,
  },
  {
    id: 'from-models',
    title: 'Forms from models (workbench)',
    section: 'Advanced',
    summary: 'Pick a source (Laravel rules, backend model, JSON Schema, OpenAPI, Zod) and the options, then use the form: validation in the browser, a submit to a fake Laravel backend (unique, 422, 419, 500), the request and response, where each error comes from — and the code to copy.',
    file: 'FromModels.vue',
    component: FromModels,
  },
]

export const examples: Example[] = list

export function sourceOf(example: Example): string {
  return sources[`./${example.file}`] ?? ''
}
