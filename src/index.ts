/**
 * formo-vue — Formo's "forms as objects" for Vue 3.
 *
 *  - Build forms with the `Formo` builder (a port of the PHP API) or plain objects
 *  - Render them with <FormoForm> (Tailwind styled, fully overridable)
 *  - Validate with VeeValidate (Kohana rule syntax, vee rules, functions, zod/valibot)
 */

// Components
export { default as FormoForm } from './components/FormoForm.vue'
export { default as FormoChildren } from './components/FormoChildren.vue'
export { default as FormoNode } from './components/FormoNode'
export { default as FormoField } from './components/FormoField'
export { default as FormoGroup } from './components/FormoGroup.vue'
export { default as FormoBlueprint } from './components/FormoBlueprint.vue'
export { default as FormoFieldWrapper } from './components/FormoFieldWrapper.vue'
export { default as FormoUneditable } from './components/FormoUneditable.vue'
export { default as FormoChecklist } from './components/FormoChecklist.vue'
export { default as FormoRender } from './components/FormoRender'
export { default as FormoRest } from './components/FormoRest'
export { default as FormoErrors } from './components/FormoErrors.vue'

// Built-in controls (reuse them inside your own components)
export { default as FormoInput } from './components/controls/FormoInput.vue'
export { default as FormoTextarea } from './components/controls/FormoTextarea.vue'
export { default as FormoSelect } from './components/controls/FormoSelect.vue'
export { default as FormoCheckbox } from './components/controls/FormoCheckbox.vue'
export { default as FormoChoices } from './components/controls/FormoChoices.vue'
export { default as FormoDatalist } from './components/controls/FormoDatalist.vue'
export { default as FormoFile } from './components/controls/FormoFile.vue'
export { default as FormoButton } from './components/controls/FormoButton.vue'

// Form objects & runtime
export { Formo } from './core/builder'
export { useFormo, type UseFormoOptions } from './composables/useFormo'
export { useFormoField } from './composables/useFormoField'
export { useGroupSetup } from './composables/useGroupSetup'
export { createFormo, type FormoPluginOptions } from './plugin'
export {
  FormoControllerKey,
  FormoFieldKey,
  FormoGlobalKey,
  FormoOptionsKey,
  FormoSlotsKey,
  FormoContainerKey,
  type FormoFieldState,
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
export { normalize, findNode } from './core/normalize'
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
export { defaultConfig, defaultMessages, defaultRequirements } from './core/config'
export { defaultTheme, mergeTheme, cx } from './core/theme'
export { normalizeOptions, flattenOptions, isOptionGroup } from './core/options'
export { markBuiltin } from './core/builtin'
export { resolveLabel } from './core/labels'
export { buildInitialValues, applyFilters } from './core/values'
export { humanize, NOTSET } from './core/utils'

export type * from './types'
