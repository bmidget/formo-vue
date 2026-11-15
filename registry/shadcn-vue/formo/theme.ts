/**
 * Formo × shadcn-vue — your shadcn-vue components as Formo's controls, in
 * shadcn's field layout. Installed by the `formo` registry item; it's yours:
 * edit anything.
 *
 *   app.use(createFormo({ theme: shadcnTheme }))        // or <FormoForm :theme="shadcnTheme">
 *
 * Swap controls by name: `{ driver: 'bool', component: 'switch' }` (one field),
 * `components: { checkbox: 'switch' }` (a form, a group, the app).
 */
import { defineControl, defineTheme, FormoInputControl, shadcnClasses, tailwindMergeClasses } from 'formo-vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import FormoCheckboxGroup from './FormoCheckboxGroup.vue'
import FormoErrorsView from './FormoErrorsView.vue'
import FormoFieldView from './FormoFieldView.vue'
import FormoHelpView from './FormoHelpView.vue'
import FormoInlineView from './FormoInlineView.vue'
import FormoLabelView from './FormoLabelView.vue'
import FormoRadioGroup from './FormoRadioGroup.vue'
import FormoSelect from './FormoSelect.vue'

export const shadcnTheme = defineTheme({
  name: 'shadcn-vue',
  views: {
    field: FormoFieldView,
    inline: FormoInlineView,
    label: FormoLabelView,
    help: FormoHelpView,
    errors: FormoErrorsView,
    // fieldset (radios, checkbox lists), groups, repeatable rows, checklists…: Formo's own views, in shadcn classes
  },
  components: {
    // Inputs style themselves from `aria-invalid`; Formo passes `type`, `id`, `name`, `aria-*`
    input: defineControl({ component: Input, native: true }),
    textarea: defineControl({ component: Textarea, native: true }),
    select: defineControl({ component: FormoSelect, native: true }),
    checkbox: defineControl({ component: Checkbox, native: true }),
    radios: defineControl({ component: FormoRadioGroup, native: true }),
    checkboxes: defineControl({ component: FormoCheckboxGroup, native: true }),
    // MySQL SET: a comma-separated string in, an array for the checkboxes
    set: defineControl({
      component: FormoCheckboxGroup,
      model: {
        get: (value) => String(value ?? '').split(',').filter(Boolean),
        set: (value) => (Array.isArray(value) ? value.map(String).join(',') : ''),
      },
    }),
    // By name: `component: 'switch'`, `components: { checkbox: 'switch' }`
    switch: defineControl({ component: Switch, native: true }),
    // No shadcn-vue equivalent: Formo's own, in shadcn classes
    'input|hidden': FormoInputControl,
    'input|range': FormoInputControl,
    'input|color': FormoInputControl,
    'input|submit': FormoInputControl,
    'input|reset': FormoInputControl,
    'input|button': FormoInputControl,
    'input|image': FormoInputControl,
  },
  classes: shadcnClasses,
  mergeClasses: tailwindMergeClasses,
})
