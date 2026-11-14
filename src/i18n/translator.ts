import { toValue } from 'vue'
import type { FormoConfig, FormoLocaleMessages, FormoUiStrings } from '../types'
import { interpolate } from '../core/utils'
import { ui as englishUi } from './locales/en'

export interface Translator {
  /** The active locale */
  locale: string
  /** Validation message for the first key found (most specific first), interpolated */
  message(keys: string[], params?: Record<string, unknown>): string | undefined
  /** Checklist requirement text */
  requirement(keys: string[], params?: Record<string, unknown>): string | undefined
  /** Field label by path / alias */
  label(keys: string[]): string | undefined
  /** Built-in interface string */
  ui(key: keyof FormoUiStrings, params?: Record<string, unknown>): string
  /** A free text (explicit label, help text, option label, placeholder…): translated, or as-is */
  text<T extends string | undefined>(text: T): T
}

type Section = 'validation' | 'requirements' | 'labels'

/** The active locale of a config (`locale` may be a ref or a getter) */
export function activeLocale(config: FormoConfig): string {
  return String(toValue(config.locale as any) || config.fallbackLocale || 'en')
}

const cache = new WeakMap<FormoConfig, Map<string, Translator>>()

/**
 * Lookup order, for each key from most to least specific:
 *
 *   1. locale-agnostic overrides (`config.messages` / `requirements` / `labels`)
 *   2. the i18n bridge (`config.t`, e.g. vue-i18n / laravel-vue-i18n)
 *   3. the active locale's catalog (`config.locales[locale]`)
 *
 * then the same keys in the base language (`pt` for `pt-BR`), the fallback
 * locale, and English.
 */
export function getTranslator(config: FormoConfig): Translator {
  const locale = activeLocale(config)
  let byLocale = cache.get(config)
  if (!byLocale) cache.set(config, (byLocale = new Map()))
  const cached = byLocale.get(locale)
  if (cached) return cached

  const base = locale.split(/[-_]/)[0]
  const chain = [...new Set([locale, base, config.fallbackLocale, 'en'].filter(Boolean))]
  const catalogs: FormoLocaleMessages[] = chain.map((l) => config.locales?.[l]).filter((c): c is FormoLocaleMessages => !!c)
  const overrides: Record<Section, Record<string, string>> = {
    validation: config.messages ?? {},
    requirements: config.requirements ?? {},
    labels: config.labels ?? {},
  }

  function find(section: Section, keys: string[], params: Record<string, unknown> = {}): string | undefined {
    // Active locale: overrides → bridge → catalog, key by key (specific wins)
    const current = config.locales?.[locale] ?? (locale !== base ? config.locales?.[base] : undefined)
    for (const key of keys) {
      const override = overrides[section][key]
      if (override) return interpolate(override, params)
      const bridged = config.t?.(`${section}.${key}`, params)
      if (bridged) return interpolate(bridged, params)
      const own = current?.[section]?.[key]
      if (own) return interpolate(own, params)
    }
    // Fallbacks
    for (const catalog of catalogs) {
      if (catalog === current) continue
      for (const key of keys) {
        const value = catalog[section]?.[key]
        if (value) return interpolate(value, params)
      }
    }
    return undefined
  }

  const translator: Translator = {
    locale,
    message: (keys, params) => find('validation', keys, params),
    requirement: (keys, params) => find('requirements', keys, params),
    label: (keys) => find('labels', keys),
    ui(key, params = {}) {
      const bridged = config.t?.(`ui.${key}`, params)
      if (bridged) return interpolate(bridged, params)
      for (const catalog of catalogs) {
        const value = catalog.ui?.[key]
        if (value) return interpolate(value, params)
      }
      return interpolate(englishUi[key], params)
    },
    text<T extends string | undefined>(text: T): T {
      if (!text) return text
      if (config.translate) {
        const translated = config.translate(text)
        if (translated && translated !== text) return translated as T
      }
      for (const catalog of catalogs) {
        const value = catalog.texts?.[text]
        if (value) return value as T
      }
      return text
    },
  }

  byLocale.set(locale, translator)
  return translator
}
