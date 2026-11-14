import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { i18nVue, trans, currentLocale, loadLanguageAsync } from 'laravel-vue-i18n'
import ja from '@vee-validate/i18n/dist/locale/ja.json'
import {
  Formo,
  FormoForm,
  createFormo,
  defaultConfig,
  fromLaravelValidation,
  fromVeeValidateLocale,
  getTranslator,
  laravelI18n,
  useFormo,
  vueI18n,
} from 'formo-vue'
import type { FormoConfig, FormoController } from 'formo-vue'

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises()
    await nextTick()
  }
}

const definition = () =>
  Formo.form({ alias: 'f' })
    .add('email', 'input|email', { required: true, attr: { placeholder: 'you@example.com' } })
    .addGroup('color', 'select', { red: 'Red', blue: 'Blue' }, 'red', { label: 'Favorite color' })
    .add(Formo.group('phones', { blueprint: true, min: 1 }).add('number'))

function mountWith(config: Partial<FormoConfig>, plugins: any[] = []) {
  let form!: FormoController
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useFormo(definition())
        return () => h(FormoForm, { form, config })
      },
    }),
    { global: { plugins } },
  )
  return { wrapper, form: () => form }
}

describe('built-in locales', () => {
  it('switches labels, options, placeholders, UI strings — and re-translates errors on screen', async () => {
    const locale = ref('en')
    const { wrapper, form } = mountWith({
      locale,
      locales: {
        fr: {
          labels: { email: 'Adresse e-mail' },
          texts: { 'Favorite color': 'Couleur préférée', Red: 'Rouge', Blue: 'Bleu', 'you@example.com': 'vous@exemple.fr' },
        },
      },
    })
    await settle()
    await form().validate()
    await settle()
    expect(wrapper.get('[data-formo-path="email"] [role="alert"]').text()).toBe('Email must not be empty')

    locale.value = 'fr'
    await settle()
    expect(wrapper.get('label[for="f-email"]').text()).toContain('Adresse e-mail')
    // the error already shown is re-translated
    expect(wrapper.get('[data-formo-path="email"] [role="alert"]').text()).toBe('Le champ Adresse e-mail est obligatoire')
    expect(wrapper.get('label[for="f-color"]').text()).toBe('Couleur préférée')
    expect(wrapper.findAll('select option').map((o) => o.text())).toEqual(['Rouge', 'Bleu'])
    expect(wrapper.get('#f-email').attributes('placeholder')).toBe('vous@exemple.fr')
    expect(wrapper.text()).toContain('Ajouter')
  })

  it('falls back: regional → base language → fallbackLocale → en, specific keys first within a locale', () => {
    const config = {
      ...defaultConfig,
      locale: 'fr-CA',
      locales: { ...defaultConfig.locales, en: { validation: { ...defaultConfig.locales.en.validation, 'email.required': 'EN specific' } } },
    } as FormoConfig
    const tr = getTranslator(config)
    // French generic wins over an English field-specific message
    expect(tr.message(['email.required', 'required'], { field: 'Email' })).toBe('Le champ Email est obligatoire')
    // Missing in French entirely → English
    expect(getTranslator({ ...config, locales: { ...config.locales, fr: {} } }).message(['required'], { field: 'X' })).toBe(
      'X must not be empty',
    )
  })
})

describe('vue-i18n', () => {
  it('drives the locale and supplies messages, labels and texts', async () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: { formo: { validation: { required: 'Please fill in {field}' } } },
        fr: {
          formo: { validation: { required: 'Merci de remplir {field}' }, labels: { email: 'Courriel' } },
          'Favorite color': 'Couleur préférée',
        },
      },
    })
    const { wrapper, form } = mountWith(vueI18n(i18n), [i18n])
    await settle()
    await form().validate()
    await settle()
    expect(wrapper.get('[data-formo-path="email"] [role="alert"]').text()).toBe('Please fill in Email')

    i18n.global.locale.value = 'fr'
    await settle()
    expect(wrapper.get('[data-formo-path="email"] [role="alert"]').text()).toBe('Merci de remplir Courriel')
    expect(wrapper.get('label[for="f-color"]').text()).toBe('Couleur préférée')
    // not in vue-i18n → Formo's own French catalog
    expect(wrapper.text()).toContain('Ajouter')
  })
})

describe('Laravel translations', () => {
  const frValidation = {
    'validation.required': 'Le champ :attribute est obligatoire.',
    'validation.min.string': 'Le texte :attribute doit contenir au moins :min caractères.',
    'validation.required_if': 'Le champ :attribute est obligatoire quand :other est :value.',
    'validation.custom.email.required': 'Nous avons besoin de votre :attribute.',
    'validation.attributes.email': 'adresse e-mail',
    'validation.attributes.type': 'type de compte',
    'Favorite color': 'Couleur préférée',
  }

  it('laravel-vue-i18n: Laravel lang keys, :attribute/:min/:other params, custom messages and attributes', async () => {
    const def = Formo.form({ alias: 'l' })
      .add('email', { required: true })
      .add('name', { rules: 'min:3', val: 'ab' })
      .add('type', 'radios', 'business', { opts: { personal: 'Personal', business: 'Business' } })
      .add('company', { rules: 'required_if:type,business' })
    let form!: FormoController
    const wrapper = mount(
      defineComponent({
        setup() {
          form = useFormo(def)
          return () => h(FormoForm, { form, config: laravelI18n({ trans, locale: () => currentLocale.value }) })
        },
      }),
      { global: { plugins: [[i18nVue, { lang: 'fr', resolve: () => frValidation }]] } },
    )
    await loadLanguageAsync('fr')
    await settle()
    await form.validate()
    await settle()
    expect(form.flatErrors).toEqual({
      email: 'Nous avons besoin de votre adresse e-mail.',
      name: 'Le texte Name doit contenir au moins 3 caractères.',
      company: 'Le champ Company est obligatoire quand type de compte est business.',
    })
    wrapper.unmount()
  })

  it('fromLaravelValidation(): converts an exported validation.php into a Formo locale', () => {
    const locale = fromLaravelValidation({
      validation: {
        required: 'Le champ :attribute est obligatoire.',
        min: { string: 'Au moins :min caractères pour :attribute.', numeric: ':attribute doit être au moins :min.' },
        password: { mixed: ':attribute doit mélanger majuscules et minuscules.' },
        custom: { email: { required: 'Votre :attribute !' } },
        attributes: { email: 'adresse e-mail' },
      },
    })
    expect(locale.validation).toMatchObject({
      required: 'Le champ :attribute est obligatoire.',
      min: 'Au moins :min caractères pour :attribute.',
      min_value: ':attribute doit être au moins :min.',
      mixed_case: ':attribute doit mélanger majuscules et minuscules.',
      'email.required': 'Votre :attribute !',
    })
    expect(locale.labels).toEqual({ email: 'adresse e-mail' })

    const tr = getTranslator({ ...defaultConfig, locale: 'fr', locales: { ...defaultConfig.locales, fr: locale } })
    expect(tr.message(['min'], { attribute: 'Nom', min: 3 })).toBe('Au moins 3 caractères pour Nom.')
  })
})

describe('@vee-validate/i18n locales', () => {
  it('converts {field} / 0:{min} placeholders', async () => {
    const { wrapper, form } = mountWith({ locale: 'ja', locales: { ja: fromVeeValidateLocale(ja) } })
    await settle()
    await form().validate()
    await settle()
    expect(wrapper.get('[data-formo-path="email"] [role="alert"]').text()).toBe('Emailは必須項目です')
    expect(fromVeeValidateLocale(ja).validation!.between).toBe('{field}は :param1 から :param2 の間でなければなりません')
  })
})

describe('plugin-level locale', () => {
  it('createFormo({ config: { locale: ref } }) switches every form', async () => {
    const locale = ref('de')
    const wrapper = mount(FormoForm, {
      props: { form: Formo.form({ alias: 'p' }).add('name', { required: true }) },
      global: { plugins: [createFormo({ config: { locale } })] },
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toBe('Name muss ausgefüllt werden')
    locale.value = 'es'
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toBe('El campo Name es obligatorio')
  })
})
