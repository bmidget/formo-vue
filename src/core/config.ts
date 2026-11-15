import type { FormoConfig } from '../types'
import { requirements as defaultRequirements, validation as defaultMessages } from '../i18n/locales/en'
import { de, en, es, fr, nl } from '../i18n/locales'

/** English validation messages (the built-in `en` locale) */
export { defaultMessages, defaultRequirements }

export const defaultConfig: FormoConfig = {
  autoId: true,
  namespaces: true,
  humanizeLabels: true,
  labels: {},
  // Overrides for every locale (translations live in `locales`)
  messages: {},
  translate: undefined,
  // Rules each input type gets automatically
  inputRules: {
    email: ['email'],
    url: ['url'],
    tel: ['phone'],
    date: ['date'],
    'datetime-local': ['date'],
    color: ['color'],
    week: [['regex', [/^\d{4}-[Ww](?:0[1-9]|[1-4]\d|5[0-2])$/]]],
    time: [['regex', [/^(?:[01]?\d|2[0-3]):[0-5]?\d(?::[0-5]?\d)?$/]]],
    month: [['regex', [/^\d{4}-(?:0[1-9]|1[0-2])$/]]],
    number: ['decimal', 'html5_range'],
    range: ['decimal', 'html5_range'],
  },
  htmlConstraintRules: true,
  validationMode: 'eager',
  bails: true,
  errorDisplay: 'first',
  requirements: {},
  locale: 'en',
  fallbackLocale: 'en',
  // Built-in translations — switch with `locale`, add more with `locales`
  locales: { en, fr, es, de, nl },
  t: undefined,
  // Reads <meta name="csrf-token"> / the XSRF-TOKEN cookie when present; only sent to trusted origins
  csrf: 'laravel',
  request: {},
  keepValuesOnUnmount: true,
  requiredMarker: '*',
  native: false,
}
