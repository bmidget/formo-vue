/**
 * formo-vue — Formo's "forms as objects" for Vue 3.
 *
 *  - Define forms with a nested object, or the `Formo` builder (a port of the PHP API)
 *  - Render them with <FormoForm>, or field by field with <FormoField :field="form.fields.email">
 *  - Themes swap the views (Formo's PHP templates), the controls and the classes
 *  - Validate with VeeValidate (Kohana rule syntax, vee rules, functions, zod/valibot)
 */

// Components
export { default as FormoForm } from './components/FormoForm.vue'
export { default as FormoField } from './components/FormoField.vue'
export { default as FormoRender } from './components/FormoRender'
export { default as FormoRest } from './components/FormoRest'
export { default as FormoErrorSummary } from './components/FormoErrorSummary.vue'
// A field's parts, as the theme renders them — anywhere, e.g. in <FormoField v-slot="{ field }">
export { FormoLabel, FormoInput, FormoHelp, FormoErrors, FormoChecklist } from './components/parts'
export type { FormoFieldSlots } from './components/fieldSlots'

// Built-in views (reuse or extend them in your own themes)
export {
  builtinViews,
  defaultTheme,
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
} from './components/views'

// Built-in controls (reuse them inside your own components)
export { default as FormoInputControl } from './components/controls/FormoInputControl.vue'
export { default as FormoTextareaControl } from './components/controls/FormoTextareaControl.vue'
export { default as FormoSelectControl } from './components/controls/FormoSelectControl.vue'
export { default as FormoCheckboxControl } from './components/controls/FormoCheckboxControl.vue'
export { default as FormoChoicesControl } from './components/controls/FormoChoicesControl.vue'
export { default as FormoDatalistControl } from './components/controls/FormoDatalistControl.vue'
export { default as FormoFileControl } from './components/controls/FormoFileControl.vue'
export { default as FormoButtonControl } from './components/controls/FormoButtonControl.vue'

// Form objects & runtime
export { Formo } from './core/builder'
export { useFormo, type UseFormoOptions } from './composables/useFormo'
export { useFormoField } from './composables/useFormoField'
export { createFormo, type FormoPluginOptions } from './plugin'
export {
  FormoControllerKey,
  FormoFieldKey,
  FormoGlobalKey,
  FormoOptionsKey,
  FormoSlotsKey,
  FormoContainerKey,
  type FormoFieldState,
  type FormoGroupState,
  type FormoBlueprintState,
  type FormoBlueprintRowState,
  type FormoFormState,
  type FormoErrorSummaryState,
  type FormoFieldSlotProps,
  type FormoGroupSlotProps,
  type FormoRowSlotProps,
  type FormoContainer,
} from './composables/context'

// i18n
export { en, fr, es, de, nl } from './i18n/locales'
export { getTranslator, activeLocale, type Translator } from './i18n/translator'
export {
  vueI18n,
  laravelI18n,
  fromLaravelValidation,
  fromVeeValidateLocale,
  laravelValidationKeys,
} from './i18n/adapters'

// CSRF & requests (Laravel / Sanctum conventions)
export {
  csrfPresets,
  resolveCsrf,
  csrfHeaders,
  csrfField,
  primeCsrf,
  readCookie,
  readMeta,
  isTrustedUrl,
  joinUrl,
} from './http/csrf'
export { sendRequest, flattenForPhp, laravelKeyToPath } from './http/request'

// Building blocks
export { normalize, findNode, fieldsToList } from './core/normalize'
export { locate, type LocatedNode } from './core/locate'
export {
  builtinRules,
  ruleAliases,
  parseRules,
  runRules,
  evaluateChecklist,
  canonicalRuleName,
  toRegExp,
} from './core/rules'
export { defaultDrivers } from './core/drivers'
export { defineControl, isControl, type ControlInput } from './core/controls'
export { defaultConfig, defaultMessages, defaultRequirements } from './core/config'
export { defineTheme, defaultClasses, shadcnClasses, isTheme, mergeClassMaps, joinClasses, tailwindMergeClasses, cx } from './core/theme'
export { normalizeOptions, flattenOptions, isOptionGroup } from './core/options'
export { markBuiltin } from './core/builtin'
export { resolveLabel } from './core/labels'
export { buildInitialValues, applyFilters } from './core/values'
export { humanize, NOTSET } from './core/utils'

export type * from './types'
