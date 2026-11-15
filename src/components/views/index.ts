import type { FormoViews } from '../../types'
import { defaultClasses, defineTheme, tailwindMergeClasses } from '../../core/theme'
import FormoFormView from './FormoFormView.vue'
import FormoGroupView from './FormoGroupView.vue'
import FormoBlueprintView from './FormoBlueprintView.vue'
import FormoBlueprintRowView from './FormoBlueprintRowView.vue'
import FormoFieldView from './FormoFieldView.vue'
import FormoInlineView from './FormoInlineView.vue'
import FormoFieldsetView from './FormoFieldsetView.vue'
import FormoBareView from './FormoBareView.vue'
import FormoLabelView from './FormoLabelView.vue'
import FormoHelpView from './FormoHelpView.vue'
import FormoErrorsView from './FormoErrorsView.vue'
import FormoChecklistView from './FormoChecklistView.vue'
import FormoUneditableView from './FormoUneditableView.vue'
import FormoErrorSummaryView from './FormoErrorSummaryView.vue'

/**
 * The built-in views — the Vue versions of Formo's PHP view files. A theme
 * that doesn't provide a view falls back to these.
 */
export const builtinViews: FormoViews = {
  form: FormoFormView,
  group: FormoGroupView,
  blueprint: FormoBlueprintView,
  blueprintRow: FormoBlueprintRowView,
  field: FormoFieldView,
  inline: FormoInlineView,
  fieldset: FormoFieldsetView,
  bare: FormoBareView,
  label: FormoLabelView,
  help: FormoHelpView,
  errors: FormoErrorsView,
  checklist: FormoChecklistView,
  uneditable: FormoUneditableView,
  errorSummary: FormoErrorSummaryView,
}

/** The built-in theme: the built-in views, styled with Tailwind (classes merge with tailwind-merge) */
export const defaultTheme = defineTheme({
  name: 'tailwind',
  views: builtinViews,
  classes: defaultClasses,
  mergeClasses: tailwindMergeClasses,
})

export {
  FormoFormView,
  FormoGroupView,
  FormoBlueprintView,
  FormoBlueprintRowView,
  FormoFieldView,
  FormoInlineView,
  FormoFieldsetView,
  FormoBareView,
  FormoLabelView,
  FormoHelpView,
  FormoErrorsView,
  FormoChecklistView,
  FormoUneditableView,
  FormoErrorSummaryView,
}
