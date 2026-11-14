import { unref } from 'vue'
import type { FormoConfig, FormoLocaleMessages } from '../types'
import { isPlainObject } from '../core/utils'

/* -------------------------------------------------------------------------- */
/*  vue-i18n                                                                   */
/* -------------------------------------------------------------------------- */

/** The parts of a vue-i18n instance we use (no import of vue-i18n needed) */
interface VueI18nLike {
  global: {
    locale: unknown
    // Method syntax: compatible with vue-i18n's strongly typed (generic) signatures
    t(key: string, params?: any): string
    te(key: string): boolean
  }
}

/**
 * Use vue-i18n for Formo's strings: the locale follows `i18n.global.locale`,
 * keys are looked up under `formo.` (`formo.validation.required`,
 * `formo.labels.email`, `formo.ui.add`…) and free texts (labels, help texts,
 * options, placeholders) are used as keys directly. Anything missing falls back
 * to Formo's own catalogs.
 *
 *   app.use(createFormo({ config: vueI18n(i18n) }))
 */
export function vueI18n(i18n: VueI18nLike, options: { prefix?: string } = {}): Partial<FormoConfig> {
  const prefix = options.prefix ?? 'formo'
  const g = i18n.global
  const key = (k: string) => (prefix ? `${prefix}.${k}` : k)
  return {
    locale: () => String(unref(g.locale as any)),
    t: (k, params) => (g.te(key(k)) ? g.t(key(k), stringify(params)) : undefined),
    translate: (text) => (g.te(text) ? g.t(text) : text),
  }
}

/* -------------------------------------------------------------------------- */
/*  Laravel lang files (laravel-vue-i18n, or exported JSON)                     */
/* -------------------------------------------------------------------------- */

/**
 * Formo rule → key in Laravel's `lang/xx/validation.php`.
 * Rules without a Laravel counterpart keep Formo's own translations.
 */
export const laravelValidationKeys: Record<string, string> = {
  required: 'required',
  email: 'email',
  url: 'url',
  min: 'min.string',
  max: 'max.string',
  length: 'size.string',
  integer: 'integer',
  decimal: 'numeric',
  digits: 'digits',
  between: 'between.numeric',
  min_value: 'min.numeric',
  max_value: 'max.numeric',
  regex: 'regex',
  alpha: 'alpha',
  alpha_num: 'alpha_num',
  alpha_dash: 'alpha_dash',
  one_of: 'in',
  not_one_of: 'not_in',
  confirmed: 'confirmed',
  matches: 'same',
  date: 'date',
  ip: 'ip',
  image: 'image',
  mimes: 'mimes',
  ext: 'extensions',
  size: 'max.file',
  upload_size: 'max.file',
  dimensions: 'dimensions',
  min_items: 'min.array',
  max_items: 'max.array',
  required_if: 'required_if',
  required_unless: 'required_unless',
  required_with: 'required_with',
  required_with_all: 'required_with_all',
  required_without: 'required_without',
  required_without_all: 'required_without_all',
  mixed_case: 'password.mixed',
  letters: 'password.letters',
  numbers: 'password.numbers',
  symbols: 'password.symbols',
}

/** Formo's namespaced key → Laravel lang key */
function toLaravelKey(key: string): string {
  const [section, ...rest] = key.split('.')
  const name = rest.join('.')
  if (section === 'validation') {
    // `email.required` (field specific) → Laravel's `validation.custom.email.required`
    if (name.includes('.')) return `validation.custom.${name}`
    return `validation.${laravelValidationKeys[name] ?? name}`
  }
  // Field labels → Laravel's custom attribute names
  if (section === 'labels') return `validation.attributes.${name}`
  // requirements / ui have no Laravel counterpart: put them in lang/xx/formo.php
  return `formo.${key}`
}

/** Laravel replacements are strings */
function stringify(params?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || typeof v === 'object' && !Array.isArray(v)) continue
    out[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return out
}

/**
 * Use your Laravel translations through laravel-vue-i18n (or any `trans()`
 * that returns the key when missing):
 *
 *  - validation messages from `lang/xx/validation.php` — `:attribute`, `:min`,
 *    `:max`, `:size`, `:values`, `:other`… are filled in; `custom.field.rule` works
 *  - labels from `validation.attributes`
 *  - free texts from `lang/xx.json` (English text as key)
 *  - Formo-only strings (requirements, ui) from `lang/xx/formo.php`, else Formo's catalogs
 *
 *   import { trans, getActiveLanguage } from 'laravel-vue-i18n'
 *   app.use(createFormo({ config: laravelI18n({ trans, locale: getActiveLanguage }) }))
 */
export function laravelI18n(options: {
  trans: (key: string, replacements?: Record<string, string>) => string
  /** The active locale: laravel-vue-i18n's `getActiveLanguage` */
  locale?: string | (() => string)
}): Partial<FormoConfig> {
  const { trans } = options
  const lookup = (key: string, params?: Record<string, unknown>) => {
    const result = trans(key, stringify(params))
    return typeof result === 'string' && result !== key ? result : undefined
  }
  return {
    ...(options.locale ? { locale: options.locale } : {}),
    t: (key, params) => lookup(toLaravelKey(key), params),
    translate: (text) => lookup(text) ?? text,
  }
}

/**
 * Convert a Laravel `lang/xx/validation.php` (exported as JSON — nested, or the
 * flat `"validation.required"` keys laravel-vue-i18n generates) into a Formo
 * locale: `locales: { fr: fromLaravelValidation(json) }`.
 */
export function fromLaravelValidation(input: Record<string, any>): FormoLocaleMessages {
  const flat = flatten(isPlainObject(input.validation) ? input.validation : input)
  const strip = (k: string) => k.replace(/^validation\./, '')
  const byKey = new Map(Object.entries(flat).map(([k, v]) => [strip(k), v]))

  const validation: Record<string, string> = {}
  for (const [rule, laravelKey] of Object.entries(laravelValidationKeys)) {
    const message = byKey.get(laravelKey)
    if (typeof message === 'string') validation[rule] = message
  }
  const labels: Record<string, string> = {}
  for (const [key, value] of byKey) {
    if (typeof value !== 'string') continue
    if (key.startsWith('custom.')) {
      // custom.email.required → email.required (Formo's field specific message key)
      const [field, laravelRule] = splitLast(key.slice('custom.'.length))
      const rule = Object.entries(laravelValidationKeys).find(([, k]) => k === laravelRule || k.startsWith(`${laravelRule}.`))?.[0]
      validation[`${field}.${rule ?? laravelRule}`] = value
    } else if (key.startsWith('attributes.')) {
      labels[key.slice('attributes.'.length)] = value
    }
  }
  return { validation, labels }
}

function splitLast(key: string): [string, string] {
  const i = key.lastIndexOf('.')
  return [key.slice(0, i), key.slice(i + 1)]
}

function flatten(obj: Record<string, any>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (isPlainObject(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

/* -------------------------------------------------------------------------- */
/*  @vee-validate/i18n locales (40+ languages)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Use one of @vee-validate/i18n's locale files for the validation messages:
 *
 *   import ja from '@vee-validate/i18n/dist/locale/ja.json'
 *   createFormo({ config: { locales: { ja: fromVeeValidateLocale(ja) } } })
 *
 * Their `{field}` and `0:{min}` placeholders become `:field` / `:param1`.
 */
export function fromVeeValidateLocale(locale: { messages: Record<string, string> }): FormoLocaleMessages {
  const validation: Record<string, string> = {}
  for (const [rule, message] of Object.entries(locale.messages)) {
    validation[rule === '_default' ? 'default' : rule] = message.replace(/(\d+):\{[^}]+\}/g, (_m, i) => `:param${Number(i) + 1}`)
  }
  return { validation }
}
