import type { Component } from 'vue'
import GettingStarted from './GettingStarted.vue'
import FieldTypes from './FieldTypes.vue'
import Subforms from './Subforms.vue'
import Validation from './Validation.vue'
import CustomComponents from './CustomComponents.vue'
import Blueprints from './Blueprints.vue'
import ServerErrors from './ServerErrors.vue'
import FromPhp from './FromPhp.vue'
import Theming from './Theming.vue'
import Checklists from './Checklists.vue'
import MultipleRules from './MultipleRules.vue'
import OptionalSubforms from './OptionalSubforms.vue'
import I18n from './I18n.vue'
import Laravel from './Laravel.vue'
import Layouts from './Layouts.vue'

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
    summary: 'The Formo builder — same fluent API as the PHP library — rendered by <FormoForm>, with the live form values and errors next to it.',
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
    summary: 'Your own layout: render subforms, fields, just the input, label or error — anywhere, even outside the <form> — like Formo’s render() at every level.',
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
    summary: 'VeeValidate under the hood. Kohana rule arrays, vee strings/objects, functions, async rules, zod, group rules, messages.',
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
    summary: 'Override the component of any field: per field, per driver, by name, via slots — plus custom wrappers and new drivers.',
    file: 'CustomComponents.vue',
    component: CustomComponents,
  },
  {
    id: 'theming',
    title: 'Theming',
    section: 'Customizing',
    summary: 'Tailwind theme keys merged with tailwind-merge — app-wide, per form, per group or per field.',
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
    id: 'from-php',
    title: 'From PHP to_array()',
    section: 'Advanced',
    summary: 'Render JSON from Formo (PHP) $form->to_array() directly — a gradual migration path.',
    file: 'FromPhp.vue',
    component: FromPhp,
  },
]

export const examples: Example[] = list

export function sourceOf(example: Example): string {
  return sources[`./${example.file}`] ?? ''
}
