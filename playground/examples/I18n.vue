<script setup lang="ts">
/**
 * i18n — every string Formo shows can be translated, and switching the locale
 * is live: labels, option texts, placeholders, help texts, checklist
 * requirements, blueprint buttons, the error summary — and errors already on
 * screen are re-translated.
 *
 * Built in: en, fr, es, de, nl. Add any language with `locales`, e.g. the 40+
 * from @vee-validate/i18n (Japanese below). Using vue-i18n or Laravel lang
 * files instead? `config: vueI18n(i18n)` / `laravelI18n({ trans, locale })` —
 * see the README.
 */
import { computed, ref } from 'vue'
import ja from '@vee-validate/i18n/dist/locale/ja.json'
import { Formo, FormoErrors, FormoForm, fromVeeValidateLocale, useFormo, type FormoLocaleMessages } from 'formo-vue'

const locale = ref('en')
const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ja', label: '日本語' },
]

/**
 * This form's own translations. Formo's built-in catalogs already cover the
 * validation messages, checklist requirements and UI strings.
 *  - labels: by field alias / path
 *  - texts:  free texts by their English source (labels set in code, options, help, placeholders…)
 */
const locales: Record<string, FormoLocaleMessages> = {
  fr: {
    labels: { full_name: 'Nom complet', email: 'Adresse e-mail', password: 'Mot de passe', country: 'Pays', phones: 'Téléphones' },
    texts: {
      'Choose a country…': 'Choisissez un pays…', France: 'France', Germany: 'Allemagne', Spain: 'Espagne', Netherlands: 'Pays-Bas', Japan: 'Japon',
      'We never share it.': 'Nous ne la partageons jamais.', 'Send me the newsletter': 'Recevoir la newsletter', 'Create account': 'Créer un compte',
      'Ada Lovelace': 'Marie Curie', Phone: 'Téléphone',
    },
  },
  es: {
    labels: { full_name: 'Nombre completo', email: 'Correo electrónico', password: 'Contraseña', country: 'País', phones: 'Teléfonos' },
    texts: {
      'Choose a country…': 'Elige un país…', France: 'Francia', Germany: 'Alemania', Spain: 'España', Netherlands: 'Países Bajos', Japan: 'Japón',
      'We never share it.': 'Nunca lo compartimos.', 'Send me the newsletter': 'Quiero recibir el boletín', 'Create account': 'Crear cuenta',
      'Ada Lovelace': 'Clara Campoamor', Phone: 'Teléfono',
    },
  },
  de: {
    labels: { full_name: 'Vollständiger Name', email: 'E-Mail-Adresse', password: 'Passwort', country: 'Land', phones: 'Telefonnummern' },
    texts: {
      'Choose a country…': 'Land wählen…', France: 'Frankreich', Germany: 'Deutschland', Spain: 'Spanien', Netherlands: 'Niederlande', Japan: 'Japan',
      'We never share it.': 'Wir geben sie niemals weiter.', 'Send me the newsletter': 'Newsletter abonnieren', 'Create account': 'Konto erstellen',
      'Ada Lovelace': 'Emmy Noether', Phone: 'Telefon',
    },
  },
  nl: {
    labels: { full_name: 'Volledige naam', email: 'E-mailadres', password: 'Wachtwoord', country: 'Land', phones: 'Telefoonnummers' },
    texts: {
      'Choose a country…': 'Kies een land…', France: 'Frankrijk', Germany: 'Duitsland', Spain: 'Spanje', Netherlands: 'Nederland', Japan: 'Japan',
      'We never share it.': 'We delen het nooit.', 'Send me the newsletter': 'Stuur mij de nieuwsbrief', 'Create account': 'Account aanmaken',
      'Ada Lovelace': 'Aletta Jacobs', Phone: 'Telefoon',
    },
  },
  // Validation messages from @vee-validate/i18n; Formo's own strings fall back to English where missing
  ja: {
    ...fromVeeValidateLocale(ja),
    labels: { full_name: '氏名', email: 'メールアドレス', password: 'パスワード', country: '国', phones: '電話番号' },
    texts: {
      'Choose a country…': '国を選択…', France: 'フランス', Germany: 'ドイツ', Spain: 'スペイン', Netherlands: 'オランダ', Japan: '日本',
      'We never share it.': '第三者と共有することはありません。', 'Send me the newsletter': 'ニュースレターを受け取る', 'Create account': 'アカウント作成',
      'Ada Lovelace': '山田 花子', Phone: '電話',
    },
    requirements: { min: ':param1文字以上', mixed_case: '大文字と小文字', numbers: '数字を1つ以上', symbols: '記号を1つ以上' },
    ui: { add: '追加', remove: '削除', errorSummary: '以下を修正してください：', rowLabel: ':label :index' },
  },
}

const form = useFormo(
  Formo.form({ alias: 'signup' })
    .add('full_name', { rules: 'required|min:2', attr: { placeholder: 'Ada Lovelace' } })
    .add('email', 'input|email', { required: true, message: 'We never share it.' })
    .add('password', 'input|password', { checklist: true, rules: 'required|min:8|mixed_case|numbers|symbols' })
    .addGroup('country', 'select', { fr: 'France', de: 'Germany', es: 'Spain', nl: 'Netherlands', jp: 'Japan' }, null, {
      blank: 'Choose a country…',
      required: true,
    })
    .add(Formo.group('phones', { min: 1, max: 3 }).add('number', 'input|tel', { label: 'Phone' }).padBlueprint(1))
    .add('newsletter', 'bool', false, { label: 'Send me the newsletter' })
    .add('create', 'button', { label: 'Create account', attr: { type: 'submit' } }),
)

// `locale` is a ref: changing it re-renders and re-translates everything
const config = computed(() => ({ locale: locale.value, locales }))
const submitted = ref<Record<string, unknown>>()
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="lang in languages"
          :key="lang.code"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="locale === lang.code ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:text-indigo-600'"
          @click="locale = lang.code"
        >
          {{ lang.label }}
        </button>
      </div>
      <p class="mb-6 text-xs text-slate-500">Submit empty to see errors, then switch languages — they're re-translated in place.</p>

      <FormoForm :form="form" :config="config" @submit="(values) => (submitted = values)">
        <template #before>
          <FormoErrors />
        </template>
      </FormoForm>
    </div>

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.errors</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.errors }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
      <div v-if="submitted">
        <h3 class="mb-1.5 font-semibold text-slate-500">Submitted</h3>
        <pre class="overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ submitted }}</pre>
      </div>
    </aside>
  </div>
</template>
