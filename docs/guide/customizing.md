---
aside: false
---

# Theming & Customizing

Every field's **view** (wrapper/label/help/error layout), **control** (input widget), and **classes** can be customized per field, per driver, per group, per form, or app-wide.

## Custom Components

Override a component by name, per driver, or via slots — or define brand new drivers with `drivers`:

<Demo name="custom-components" />

## Themes & Views

Use `defineTheme()` to swap views (such as floating labels or horizontal layouts), controls, and Tailwind classes:

<Demo name="theming" />

## Translations (i18n)

Built-in locales (`en`, `fr`, `es`, `de`, `nl`) plus adapters for `vue-i18n`, `laravel-vue-i18n`, and `@vee-validate/i18n`:

<Demo name="i18n" />
