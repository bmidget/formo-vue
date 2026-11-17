# formo-vue

Forms as objects, for **Vue 3**.

**[Documentation & Live Demos →](https://bmidget.github.io/formo-vue/)**

```bash
bun add formo-vue vee-validate
```

> **What Formo is (and isn't):** Formo is **not a UI library**—it doesn't lock you into a closed widget kit. Instead, Formo makes working with **forms, validation, state, and styling** effortless: define your form once as an object, and render it with the built-in Tailwind theme, **Nuxt UI**, **shadcn-vue**, or your own components.

- **A form is one nested object**: every field keyed by its alias, subforms nested under `fields`. The **`Formo` builder** (`add`, `find`, `order`, `subform`, `addRulesFields`, `padBlueprint`…) is there for changing forms at runtime
- **`form.fields` mirrors the definition**: `<FormoField :field="form.fields.email">` renders any field, subform or repeatable group, anywhere, with typed handles
- **Themes swap views**: a theme is the set of view components that lay a form out (form, group, field, label, errors…), plus its controls and classes
- **Rebuild a field's markup, keep its parts**: `<FormoField :field v-slot="{ field }">` replaces the whole field with your markup, and `<FormoLabel>`, `<FormoInput>`, `<FormoErrors>`… render the theme's pieces wherever you put them — wired, validated, accessible
- **Validation runs on [VeeValidate](https://vee-validate.logaretm.com/v4/)**: rule strings (`'required|min:3'`, Laravel-style, Laravel's conditional rules included) and objects, functions, async rules and Zod/Valibot schemas
- **Error display per field**: the first error (default), all of them, or a live **requirements checklist** (✗ → ✓ as you type)
- **Optional subforms**: a "Same as billing address" checkbox can make a whole subform optional (`ignore`), plus Laravel's `required_if` / `required_with` / `exclude_if`…
- **i18n**: live locale switching, built-in en/fr/es/de/nl, adapters for **vue-i18n** and **Laravel lang files** (laravel-vue-i18n), 40+ locales via @vee-validate/i18n
- **CSRF protection built for Laravel**: Blade `@csrf`/meta tokens, Sanctum's `XSRF-TOKEN` cookie, 419 refresh + retry, 422 errors mapped onto fields
- **Forms from models & schemas**: a form straight from Laravel FormRequest rules, a backend model (IR JSON v1, e.g. an Inertia prop), JSON Schema, OpenAPI or Zod — all fields or `only` / `except`, with overrides, types, labels and validation included. `formo-vue/schema` is plain TypeScript (no Vue, no DOM), ready for other renderers
- **Nuxt UI and shadcn-vue**: render fields with [Nuxt UI](docs/nuxt-ui.md) (`formo-vue/nuxt-ui`, `@nuxt/ui` never required) or [your shadcn-vue components](docs/shadcn-vue.md) (a registry item) — every field in the library's field layout, still one form object
- **Tailwind** styles the built-in theme; class overrides merge with tailwind-merge
- **Any component can be swapped**: views and controls, per field, per driver, per form/group, app-wide, by name, or with a slot

```vue
<script setup lang="ts">
import { FormoErrors, FormoField, FormoForm, FormoInput, FormoLabel, FormoRest, useFormo } from 'formo-vue'
import StarRating from './StarRating.vue'

const form = useFormo({
  alias: 'review',
  fields: {
    title: { rules: 'required|max:80' },
    email: { driver: 'email', required: true },
    rating: { component: StarRating, rules: 'required|min_value:1' },
    price: { driver: 'number' },
    body: 'textarea',
    save: { driver: 'button', label: 'Publish', attr: { type: 'submit' } },
  },
})

async function save(values) {
  await api.post('/reviews', values)
}
</script>

<template>
  <!-- The whole form… -->
  <FormoForm :form="form" @submit="save" />

  <!-- …or your own layout, field by field -->
  <FormoForm :form="form" @submit="save">
    <FormoField :field="form.fields.title" />
    <FormoField :field="form.fields.price" v-slot="{ field }">
      <div class="grid grid-cols-2">
        <div class="my-label"><FormoLabel :field="field" /></div>
        <div class="flex"><span class="addon">$</span><FormoInput :field="field" /></div>
        <div class="my-error-box"><FormoErrors :field="field" /></div>
      </div>
    </FormoField>
    <FormoRest />
  </FormoForm>
</template>
```

---

## Contents

- [Playground (`bun run dev`)](#playground) · [Supported platforms](#supported-platforms)
- [Project layout](#project-layout)
- [Installing in an app](#installing-in-an-app)
- [Defining forms](#defining-forms) · [Builder API](#builder-api)
- [Field types (drivers)](#field-types-drivers) · [Field parameters](#field-parameters)
- [Rendering: `<FormoForm>` and `useFormo()`](#rendering-formoform-and-useformo) · [Submit outcomes](#submit-outcomes-success-invalid-rejected-settled) · [Values from outside](#values-from-outside) · [**Rendering parts anywhere: `<FormoField>`**](#rendering-parts-anywhere-formofield) · [**Your own markup: the parts**](#your-own-markup-the-parts)
- [Validation](#validation)
- [Error display & checklists](#error-display--checklists)
- [Optional subforms & conditional rules](#optional-subforms--conditional-rules)
- [i18n](#i18n)
- [CSRF & Laravel](#csrf--laravel)
- [**Forms from models & schemas**](#forms-from-models--schemas)
- [**Themes & views**](#themes--views)
- [**UI libraries: Nuxt UI & shadcn-vue**](#ui-libraries-nuxt-ui--shadcn-vue)
- [Overriding components](#overriding-components) · [`defineControl()`](#any-component-as-a-control-definecontrol)
- [Subforms, namespaces, repeatable groups](#subforms-namespaces-and-repeatable-groups)
- [Good to know](#good-to-know)

---

## Playground

The library lives in `src/`; the playground is a separate Vite app in `playground/` that imports the library source through the `formo-vue` alias.

```bash
cd formo-vue
bun install
bun run dev            # → http://localhost:5173 (checks the native toolchain binaries first)
```

- Editing any `.vue` file, in `playground/` **or** in the library's `src/`, **hot-swaps in place** and keeps form state.
- Editing plain TS modules in `src/core/` triggers Vite's (fast) full-page reload, since those aren't components.
- Tailwind re-scans both folders on change.

**Every example is a plain Vue component**, exactly what you'd write in your app: the form, its handlers, and its live `form.values` / `form.errors` shown with ordinary template bindings. It imports only `formo-vue`, `vue` and its own components. Each example has three tabs:

- **Preview**: the component running.
- **Vue component**: its complete source, ready to copy.
- **POST body**: what a native submit of each form would send — namespaced names (`user[address][street]`), read by Laravel as `$request->input('user.address.street')`.

| Example | Shows |
| --- | --- |
| Getting started | A form as one object, rule strings and objects, filters, async submit |
| **Render parts anywhere** | Your own layout with `form.fields` handles: fields side by side, a control wrapped by a slot, one field laid out by hand, a subform's inner layout, custom blueprint rows, `<FormoRest />`, and a field rendered by a card outside the `<form>` |
| Field types | Every driver, HTML5 auto-rules, optgroups, multiple, set, file, uneditable |
| Subforms & form objects | Namespaces, `namespaces: false`, ordering, `subform()`, mutating the builder live |
| Validation | All rule notations, async rule, zod, cross-field, group rules, messages, validation modes |
| **Multiple rules per field** | Stacks of 3–6 rules in mixed notations per field; first failure vs every failure vs checklist; `form.allErrors` |
| Error display & checklists | Password requirements checklist (8 chars, mixed case, number, symbol); `first` vs `all` vs `checklist` |
| **Optional subforms** | "Ship to my billing address" makes the shipping subform fully optional; conditions on subforms; `exclude`; `required_if` / `required_with` / `required_without` |
| Callbacks & server errors | `pass`/`fail` callbacks, form-level rule, `setErrors()` from a server |
| **Custom components** | Every override mechanism (see below): a slot wrapping a control, a slot replacing one, a custom view |
| **Theming** | Themes swapping views (floating labels, horizontal form) and class-only restyles, on the same form object |
| **Nuxt UI** | `formo-vue/nuxt-ui`: every field in a `UFormField` with Nuxt UI controls, `USelectMenu` / `USwitch` swapped in by name, Formo's parts in your own markup (against stubs shaped like Nuxt UI) |
| **shadcn-vue** | The `formo` registry item: your shadcn-vue components as controls in shadcn's field layout — or just the look (`shadcnClasses`) (against stubs shaped like shadcn-vue) |
| **Translations (i18n)** | Live switching between en / fr / es / de / nl / ja: labels, options, placeholders, messages, checklists, UI strings; errors re-translated in place |
| Repeatable groups | Blueprints: add/remove rows, min/max, rules over the list |
| Laravel & CSRF | A Sanctum SPA form and a Blade-style native post against a **mock Laravel backend** running in the dev server: XSRF cookie priming, 419 → refresh → retry, 422 mapping, `_token` / `_method`, with a live server request log |
| **Forms from models** | A workbench: the same user as Laravel rules, a backend model (IR JSON), JSON Schema, OpenAPI or Zod (JSON sources editable live); pick `mode`, `readOnly`, `validation`, `only` / `except`; fill the form in and submit it to a **fake Laravel backend in the page** (server-side `unique`, 422 mapped onto fields, 419 / 500), with the request and response shown; every error tagged Formo rule / Zod `.refine()` / object-level refinement / server; **Post it like JavaScript is off** compares the browser's errors with the server's, field by field; the Code tab gives the component to copy |

Other scripts:

```bash
bun run check             # everything below except the builds
bun run check:native      # this machine's native toolchain binaries are installed & load (runs before dev/build/test)
bun run check:platforms   # the lockfile installs on macOS (arm64/x64) and Linux (x64/arm64)
bun run check:deps        # every imported package (and required peer) is declared in package.json
bun run check:pure        # formo-vue/schema stays framework-free: no Vue / DOM / Node / packages / import.meta, type-checks without the DOM lib
bun run check:registry    # registry/r/formo.json (shadcn-vue) is built from registry/shadcn-vue/formo
bun run build:registry    # rebuild it
bun run test              # vitest (rules, builder, components, i18n, CSRF…) — Vue warnings fail tests
bun run typecheck         # vue-tsc
bun run build             # library → dist/ (ESM + .d.ts)
bun run build:playground  # static playground → dist-playground/
```

**Dependencies are strict.** `bunfig.toml` uses Bun's isolated linker, so only packages listed in `package.json` are resolvable from this project. An undeclared import fails immediately instead of working by accident through hoisting.

`bun run check:deps` scans `src/`, `playground/`, `tests/`, the config files, CSS `@import`s and tsconfig `types`. It also checks that library code only uses `dependencies`/`peerDependencies`. Tooling the project configures directly is declared too, for example `rolldown` (Vite 8's bundler, configured through `build.rolldownOptions`).

### Supported platforms

Vite 8 and Tailwind 4 run on native binaries: Rolldown, Tailwind's Oxide engine, and Lightning CSS. npm publishes one package per OS/CPU, and the package manager picks the right one at install time, *if* the lockfile knows about it. The project is set up and verified for:

| Platform | Binaries |
| --- | --- |
| macOS, Apple Silicon (arm64) | `@rolldown/binding-darwin-arm64`, `@tailwindcss/oxide-darwin-arm64`, `lightningcss-darwin-arm64` |
| macOS, Intel (x64) | `…-darwin-x64` |
| Linux x64 / arm64, glibc and musl | `…-linux-x64-gnu`, `…-linux-x64-musl`, `…-linux-arm64-gnu`, `…-linux-arm64-musl` |

How that's guaranteed:

- **The bindings are listed in `optionalDependencies`.** Only your platform's are installed; the others are skipped.
- **`bun.lock` is generated for all platforms** (`bun install --os '*' --cpu '*'`). A lockfile generated on one OS normally records only that OS's binaries, and every other machine then silently installs none.
- **The toolchain is pinned to versions whose binaries exist for every platform above:** `vite@8.3.5`, `rolldown@1.2.15` and `tailwindcss@4.3.3`, with `overrides` keeping transitive copies in line. Newer releases sometimes publish a platform's binary late. Lightning CSS sits at 1.33.0, which already has them all.
- **`bun run check:platforms`** does a frozen-lockfile install *as* each platform and verifies that every binary is present in the exact version its parent needs.
- **`bun run check:native`** runs before `dev`, `build` and `test`, and fails with a clear fix if this machine's binaries are missing or don't load.

**Upgrading Vite or Tailwind:** bump the versions, regenerate the lockfile, and verify:

```bash
rm -rf node_modules bun.lock && bun install --os '*' --cpu '*' && rm -rf node_modules && bun install
bun run check:platforms
```

If `check:platforms` reports a binary that doesn't exist yet, stay on the previous version.

**Need Windows** (or another platform)? Add `win32-x64-msvc` to the `targets` in `scripts/check-platforms.ts` and the three matching packages to `optionalDependencies`, then regenerate the lockfile as above.

## Project layout

```
formo-vue/
├── src/                          ← the library
│   ├── index.ts                  public API
│   ├── plugin.ts                 createFormo()            (app-wide setup)
│   ├── types.ts
│   ├── core/
│   │   ├── builder.ts            class Formo               (the builder; Formo.fromModel())
│   │   ├── normalize.ts          definitions → node tree
│   │   ├── drivers.ts            built-in drivers
│   │   ├── conditions.ts         `ignore` / `exclude` conditions
│   │   ├── locate.ts             path/alias → node (for rendering parts)
│   │   ├── rules.ts              rule parsing/running on @vee-validate/rules
│   │   ├── config.ts             defaults + messages
│   │   ├── theme.ts              defineTheme(), the Tailwind classes, shadcnClasses, class merging
│   │   ├── controls.ts           defineControl(): any component as a control, with its contract
│   │   └── values.ts, labels.ts, options.ts, utils.ts
│   ├── i18n/
│   │   ├── translator.ts         locale lookup (overrides → i18n bridge → catalogs → fallbacks)
│   │   ├── adapters.ts           vueI18n(), laravelI18n(), fromLaravelValidation(), fromVeeValidateLocale()
│   │   └── locales/              en, fr, es, de, nl
│   ├── nuxt-ui/index.ts          formo-vue/nuxt-ui: nuxtUiTheme(), toItems() — takes your Nuxt UI components
│   ├── schema/                   formo-vue/schema — forms from models & schemas, plain TypeScript: no Vue, no DOM
│   │   ├── ir.ts                 the Formo model (IR JSON v1): types, parseModel()   + formo-model.v1.schema.json
│   │   ├── form.ts, policy.ts    formFromModel(): only / except / overrides / modes; type → driver, constraints → rules
│   │   ├── values.ts             toFormValues(): a record → form values
│   │   └── laravel.ts, json-schema.ts, openapi.ts, zod.ts   the adapters
│   ├── http/
│   │   ├── csrf.ts               CSRF tokens (meta / XSRF cookie / Sanctum priming, trusted origins)
│   │   └── request.ts            Laravel-flavoured fetch (JSON/FormData, _method, 419 retry, 422 errors)
│   ├── composables/
│   │   ├── useFormo.ts           the runtime form controller (values, validate, errors…)
│   │   ├── handles.ts            form.fields.email (handles for <FormoField>)
│   │   ├── useFormoField.ts      for custom field components
│   │   └── useGroupSetup.ts      shared by the group / blueprint engines
│   └── components/
│       ├── FormoForm.vue         the <form>: submit + outcome events, CSRF, v-model
│       ├── FormoField.vue        any field / subform / repeatable group, from a handle
│       ├── parts.ts              FormoLabel, FormoInput, FormoHelp, FormoErrors, FormoChecklist
│       ├── FormoErrorSummary.vue every error of the form
│       ├── FormoRender.ts        the same, from a path string (+ label / error / help parts)
│       ├── FormoRest.ts          everything not placed by hand
│       ├── FormoFieldEngine.ts   binds a field to VeeValidate, resolves its control and view, fills the view's slots
│       ├── FormoGroupEngine.ts, FormoBlueprintEngine.ts   the same for subforms / repeatable groups
│       ├── resolve.ts            view / control resolution (overrides → theme → built-in)
│       ├── views/                the built-in views: form, group, blueprint,
│       │                         field, inline, fieldset, bare, label, help, error, checklist…
│       └── controls/             FormoInputControl, FormoSelectControl, FormoChoicesControl (radios/checkboxes/set)…
├── playground/                   ← the Vite app served by `bun run dev`
│   ├── main.ts                   app-wide createFormo() setup (custom drivers, rules…)
│   ├── examples/*.vue            each one a standalone Vue component (form + values + errors)
│   ├── server/mock-laravel.ts    fake Laravel backend (Vite dev-server middleware) for the CSRF example
│   ├── components/               StarRating, TagInput, FloatingField (a view)… (example custom components)
│   └── stubs/                    components shaped like Nuxt UI's (`#components`) and shadcn-vue's
│                                 (`@/components/ui/*`), so neither is installed here — + their design tokens
├── registry/
│   ├── shadcn-vue/formo/         the shadcn-vue registry item's source (theme, views, controls)
│   └── r/formo.json              the built item, served from GitHub raw (bun run build:registry)
├── docs/                         nuxt-ui.md, shadcn-vue.md
├── aliases.config.ts             import aliases shared by the playground and the tests
├── scripts/
│   ├── build-registry.ts         registry/shadcn-vue/formo → registry/r/formo.json
│   ├── check-deps.ts             every referenced package is declared
│   ├── check-pure.ts, pure.ts    formo-vue/schema reaches no Vue / DOM / Node / package (+ tsconfig.schema.json)
│   ├── check-native.ts           this machine's native binaries are there and load
│   └── check-platforms.ts        the lockfile installs on every supported platform
└── tests/
```

## Installing in an app

```bash
bun add formo-vue vee-validate
```

```ts
// main.ts
import { createFormo } from 'formo-vue'

app.use(createFormo({
  // everything optional — see "Themes & views" and "Overriding components"
  theme: bootstrap,                                  // a defineTheme(): views, controls, classes
  components: { 'input|date': MyDatePicker },
  classes: { control: 'rounded-none' },              // class overrides
  drivers: { rating: { component: StarRating, defaultValue: () => 0 } },
  rules: { username_available: async (v) => (await api.available(v)) || 'Taken' },
  config: { messages: { required: ':field is required' }, labels: { dob: 'Date of birth' } },
}))
```

The plugin is optional; `<FormoForm>` works without it. It also registers `<FormoForm>`, `<FormoField>`, `<FormoLabel>`, `<FormoInput>`, `<FormoHelp>`, `<FormoErrors>`, `<FormoChecklist>`, `<FormoRender>`, `<FormoRest>` and `<FormoErrorSummary>` globally unless `registerComponents: false`.

**Tailwind** (v4) must see the library's classes. Add it as a source in your CSS:

```css
@import "tailwindcss";
@source "../node_modules/formo-vue/src";
```

## Defining forms

**A form is one object.** `fields` is keyed by alias, and a subform is any entry with its own `fields`:

```ts
const form = useFormo({
  alias: 'user',
  fields: {
    username: { required: true },
    email: { driver: 'email', required: true },           // 'email' = 'input|email'
    notes: 'textarea',                                     // a string is the driver
    hobby: { driver: 'select', opts: hobbies, val: 'run' },
    admin: isAdmin && { driver: 'checkbox' },              // false / null / undefined: skipped
    address: {                                             // a subform
      label: 'Address',
      fields: { street: { required: true }, zip: { rules: 'required|digits:5' } },
    },
    phones: {                                              // repeatable rows
      blueprint: true, min: 1, max: 3,
      fields: { type: { driver: 'select', opts: phoneTypes }, number: 'tel' },
    },
  },
})
```

- An entry is a definition (every [field parameter](#field-parameters)), a driver name, a `Formo` builder (its alias becomes the key; it stays live), or a falsy value to skip it.
- Subforms always nest under `fields`, never directly in the entry: a subform's fields may well be called `label`, `min` or `rules`.
- Fields come in the order written (`order` still works). JavaScript puts integer-like keys (`'0'`, `'1'`) first whatever you write, so use the list form below for numeric aliases — you'll get a warning in development.
- Definitions from object literals are **typed**: `form.fields.address.fields.zip` autocompletes, and `<FormoField>`'s slots know what they render.

The other ways to define a form work too, and mix freely with it:

```ts
// The builder — handy to change a form at runtime
const form = Formo.form({ alias: 'user' })
  .add('username', { required: true })
  .add('notes', 'textarea', 'My notes')                       // alias, driver, val
  .add('hobbies', 'checkboxes', ['run'], { opts: hobbies })   // alias, driver, val, options
  .addGroup('hobby', 'select', hobbies, 'run')                 // a field with options
  .add('address', { fields: { street: {}, zip: {} } })        // subform (or Formo.group().add(…))

// Both at once: an object, then builder calls
const form = Formo.form({ alias: 'user', fields: { username: {}, email: 'email' } })
form.add('company', { order: ['after', 'username'] })

// `fields` as a list (what the builder outputs: `form.toSchema()`)
const form = { alias: 'user', fields: [{ alias: 'username' }, ['email', 'input|email'], 'nickname'] }

// A definition your server sends as JSON
const form = Formo.fromJSON(await (await fetch('/user/form')).json())

// From a model or a schema: Laravel rules, JSON Schema, OpenAPI, Zod — see "Forms from models & schemas"
const form = Formo.fromModel(fromLaravel(props.rules), { except: ['role'] })
```

The builder stays **live**: calling `form.add(…)`, `.remove()`, `.order()`, `.find('x').set(…)` or `.addRule()` after the form is rendered updates it (see the *Subforms & form objects* example). Typed `form.fields` come from object definitions; fields added with `.add()` are reached with `form.field('company')` (or `form.fields.company`, typed loosely).

### Builder API

| Method | Does |
| --- | --- |
| `Formo.form(def)` / `Formo.group(alias, def)` / `Formo.factory(def)` | A form, a subform, any field |
| `Formo.fromModel(model, options)` / `Formo.fromJSON(json)` | From a model or schema (`formo-vue/schema`) / from a JSON definition |
| `.add(alias, driver?, val?, def?)` · `.addGroup(alias, driver, opts, val?)` · `.remove(alias)` | Add (every shorthand above) / remove fields |
| `.field('username')` · `.find('x')` (also `'a.b'`, `['a', 'b']`) · `.fields()` | Children, by alias or path |
| `.set()` / `.get()` (dot syntax) · `.val()` · `.attr()` · `.addClass()` / `.removeClass()` · `.merge()` | Read / change a field |
| `.addRule()` · `.addRules()` · `.addRuleFields()` · `.addRulesFields()` · `.removeRule()` · `.removeRulesFields()` · `.isRequired()` | Rules |
| `.callback()` / `.callbacks()` | `pass` / `fail` callbacks |
| `.order()` · `.subform()` · `.flatten()` · `.padBlueprint(n \| rows)` | Structure |
| `.setFields()` · `.setVarFields()` · `.attrFields()` · `.mergeFields()` | Several fields at once |
| `.toSchema()` / `JSON.stringify(form)` | The plain definition |

At runtime, the controller (`useFormo()`) and its handles take over: `form.fields.email`, `form.val()`, `form.load()`, `form.validate()`, `form.setErrors()` — see [Rendering](#rendering-formoform-and-useformo).

## Field types (drivers)

| Driver | Control | Value |
| --- | --- | --- |
| `input` (default) · `input\|email` · `email`… | `<input>` of any type. `email`, `url`, `tel`, `date`, `color`, `week`, `time`, `month`, `number`, `range` add validation rules automatically (`config.inputRules`), `number`/`range` honor `min`/`max`/`step` | string (`number`/`range`: number \| null) |
| `textarea` | `<textarea>` | string |
| `select` | `<select>`; `blank: true \| 'Choose…'`, optgroups, `attr.multiple` | option value (keeps its type) / array |
| `datalist` | text input with suggestions | string |
| `checkbox` (alias `bool`) | single checkbox, label on the right | boolean |
| `checkboxes` | checkbox list (`inline: true` for a row) | array |
| `radios` | radio list | option value |
| `set` | checkbox list | comma-separated string (MySQL `SET`) |
| `file` | file input (`attr.multiple`) | `File \| null` / `File[]` |
| `button` | `<button>`; `attr.type: 'submit' \| 'reset' \| 'button'` | none |
| `group` / `form` | subform (`fieldset`) / the form | object |
| `custom` | automatic for fields that only set `component` | anything (empty: `null`) |

Options (`opts`, alias `options`) accept everything Formo did, plus more:

```ts
{ run: 'Running', swim: 'Swimming' }                 // value => label
{ Exercise: { run: 'Running' }, Dates: { … } }       // optgroups
['BMW', 'Honda']                                     // value === label
[[1, 'One'], [2, 'Two']]                             // ordered pairs (numeric keys keep their order & type)
[{ value: 1, label: 'One', disabled: true }]
({ values }) => citiesByCountry[values.country]      // dependent options
```

## Field parameters

| Parameter | Purpose |
| --- | --- |
| `alias` | Key of the value and base of `name`/`id`. Spaces become `_` |
| `driver` | See above. `'input\|email'` sets the input type |
| `val` (or `value`) | Initial value |
| `label` | Label text. Default: the alias, humanized (`first_name` → `First name`); `false` hides it |
| `message` | Help text under the control |
| `opts`, `blank` | Options / empty first option for selects |
| `attr` | HTML attributes (`placeholder`, `min`, `autocomplete`, `class`…). `required`/`minlength`/`maxlength`/`pattern` also become rules |
| `rules`, `required`, `errorMessages` | Validation (see below) |
| `errorDisplay`, `checklist`, `requirements` | `'first'` / `'all'` / `'checklist'` (`checklist: true` is the shortcut); requirement texts — see [Error display](#error-display--checklists) |
| `render` | `false`, or `({ values, parentValues }) => boolean`: not rendered and not validated |
| `editable` | `false`, or a function: show the value as text |
| `ignore` | Make the field, or a whole subform, fully optional: `true`, a condition, or a function. See [Optional subforms](#optional-subforms--conditional-rules) |
| `exclude` | Like `ignore`, and the values are dropped from the submit (Laravel `exclude_if`) |
| `ignores`, `excludes` | On a checkbox (or any field): while truthy, these fields/subforms are ignored / excluded |
| `callbacks` | `{ pass: [...], fail: [...] }` |
| `filters` | Applied to submitted values: `'trim'`, `'lower'`, `'upper'`, `'int'`, `'float'`, `'null_if_empty'`, functions, `[fn, params]` (`fn(value, ...params)`) |
| `order` | On add: index or `['before' \| 'after', alias]` |
| `component`, `props`, `model` | The control — [Overriding components](#overriding-components) |
| `view` | The view that lays the field (or group) out: a view name (`'inline'`, `'floating'`…), a component, or `false` for the bare control — [Themes & views](#themes--views) |
| `classes` | Class overrides for this node only |
| `fields` | Groups: children, keyed by alias (`{ street: {}, zip: 'input' }`) or as a list |
| `components`, `config`, `theme` | Cascading overrides (a subform: everything inside; a field: itself). `theme` is a whole theme (`defineTheme()`) or `{ views, components, classes }` |
| `blueprint`, `min`, `max`, `addLabel`, `removeLabel`, `rowLabel` | Repeatable groups |
| anything else | Kept in `node.vars` (`builder.set('my_var', …)`), available to your components |

## Rendering: `<FormoForm>` and `useFormo()`

```vue
<FormoForm
  :form="form"            <!-- builder, plain definition (or its JSON), or a useFormo() controller -->
  v-model="values"        <!-- optional two-way values -->
  :theme="bootstrap"      <!-- a theme for this form (or { views, components, classes } overrides) -->
  :views="{ … }"          <!-- view overrides for this form -->
  :components="{ … }"     <!-- control overrides for this form -->
  :classes="{ … }"        <!-- class overrides (merged with the theme's) -->
  :config="{ … }"         <!-- messages, labels, validationMode, namespaces… -->
  :rules="{ … }"          <!-- extra rules -->
  :drivers="{ … }"        <!-- extra drivers -->
  :disabled="busy"        <!-- disables every control -->
  native                  <!-- validate, then submit the <form> natively (see CSRF & Laravel) -->
  @submit="save"          <!-- (values, ctx) — may be async: submit buttons spin meanwhile. No @submit + attr.action: the form sends itself -->
  @success="onSaved"      <!-- (data, outcome) it went through -->
  @invalid="onErrors"     <!-- (flatErrors, outcome) the browser's validation stopped it: nothing was sent -->
  @rejected="onRefused"   <!-- (outcome) sent, but refused: outcome.reason = validation (422) / session (419) / server / handler / error -->
  @settled="onDone"       <!-- (outcome) after every submit: outcome.result = success / invalid / rejected -->
>
  <template #before="{ form }"> <FormoErrorSummary /> </template>  <!-- above the fields -->
  <!-- default slot ({ form, fields, values… }): your own layout instead of the automatic one -->
  <template #input:price> … <FormoInput /> … </template>         <!-- any region of any field — see Slots -->
  <template #actions="{ submitting, valid, reset }"> … </template>
</FormoForm>
```

### Submit outcomes: `@success`, `@invalid`, `@rejected`, `@settled`

Every submit ends one of three ways, and fires the matching event, then `@settled`:

| `outcome.result` | Event | Meaning |
| --- | --- | --- |
| `success` | `@success(data, outcome)` | Valid, and accepted. `data` is the response's data, or what `@submit` returned |
| `invalid` | `@invalid(errors, outcome)` | The browser's validation stopped it: nothing was sent, the errors are on screen |
| `rejected` | `@rejected(outcome)` | Sent, but refused. `outcome.reason`: `validation` (a 422, or errors set by the handler), `session` (419), `server` (other 4xx / 5xx), `handler` (returned `false`, or `reject()` without errors), `error` (it threw; a form-level message is shown) |

It's not a single "failure" event because the two cases need different handling. After `invalid`, nothing left the browser. After `rejected`, it did, and the server (or your handler) said no. Use `@settled` to react to any submit.

**How the outcome is worked out** — from what happened during the submit, not from what `@submit` returned (first match wins):
1. `@submit` threw → `rejected` (`error`).
2. It called `ctx.reject(errors?)` → `rejected`.
3. A request made meanwhile didn't succeed → `rejected` (`validation` / `session` / `server`). That's `ctx.request()`, `form.request()`, or a response `@submit` returned.
4. Errors were set meanwhile (`ctx.setErrors`) → `rejected` (`validation`).
5. It returned `false` → `rejected` (`handler`).
6. Otherwise → `success`.

So `@submit` can return nothing and just call `request()`. Callback-style APIs return a promise that settles when they do. The submit button spins until then, and a second click reuses the submit in flight instead of posting twice:

```ts
// Inertia: the outcome waits for the router
const save = (values, { setErrors }) =>
  new Promise((resolve) =>
    router.put(`/users/${id}`, values, {
      onSuccess: () => resolve(true),
      onError: (errors) => { setErrors(errors); resolve(false) },  // → @rejected, reason 'validation'
    }),
  )
```

`@failure` still works, as a deprecated name for `@rejected`. Without `<FormoForm>`, pass the same handlers to `useFormo(definition, { onSuccess, onInvalid, onRejected, onSettled })`. `await form.submit()` resolves to whether it succeeded, and `form.outcome` is the last outcome.

### Values from outside

`initialValues` can be a ref or a getter: `useFormo(definition, { initialValues: () => props.user })`. A reactive definition works the same way: `useFormo(() => Formo.fromModel(model, { values: props.user }))`. When those values change (a reloaded record, a websocket push):

- **Fields not changed in the form follow**, read-only ones included: an uneditable field always shows the current value. Repeatable rows and checkbox lists follow as a whole.
- **Fields the user changed keep the user's value.**
- **The new values become the baseline** for `dirty` and `reset()`, and a field showing an error is validated again.

The changes reach every control, whether built-in, Nuxt UI, shadcn-vue or `defineControl()`. So do `form.val()`, `form.load()` and `v-model`. A definition's structure is live too: `editable`, `render`, labels and rules can change while the form is shown, with values kept.

For programmatic access, create the controller yourself: the runtime half of a Formo object.

```ts
const form = useFormo(definition)   // in setup(); then <FormoForm :form="form" />

form.fields.email             // handles: <FormoField :field="form.fields.email" /> (see below)
form.field('address.zip')     // a handle by path or alias
form.values                   // reactive values
form.val('address.zip')       // get · form.val('address.zip', '12345') set
form.load({ … })              // merge values (Formo load())
await form.validate()         // fields, then group rules, then callbacks → boolean
await form.submit()           // → true if it *succeeded* (valid, and not rejected) · form.outcome: how it ended
form.reset()
form.errors                   // Formo errors() format: { email: '…', address: { zip: '…', ':self': '…' } }
form.flatErrors               // { email: '…', 'address.zip': '…', '': 'form error' }
form.allErrors                // every message per path (fields showing 'all' / 'checklist')
form.isIgnored('shipping')    // is it (or a parent group) optional right now?
form.setErrors({ ':self': 'Server said no', email: 'Taken' })   // flat or nested
form.find('zip')              // by path or alias (recursive)
form.valid / form.dirty / form.submitting / form.submitCount
form.getValues()              // values with filters applied (what @submit receives)
await form.request(url?, { method })  // send values with CSRF (see CSRF & Laravel)
form.vee                      // the underlying VeeValidate form context
```

## Rendering parts anywhere: `<FormoField>`

Every level renders on its own: the form, a subform, a field, just its input. `form.fields` mirrors the definition, one **handle** per field, and `<FormoField>` renders any of them:

```vue
<FormoForm :form="form">
  <!-- The default slot replaces the automatic layout -->
  <div class="grid grid-cols-2 gap-4">
    <FormoField :field="form.fields.first_name" />            <!-- label, control, help, errors -->
    <FormoField :field="form.fields.last_name" />
  </div>

  <FormoField :field="form.fields.address" />                 <!-- a whole subform -->
  <FormoField :field="form.fields.billing.fields.zip" />       <!-- a field of a subform -->

  <FormoField :field="form.fields.shipping">                  <!-- a subform: the theme's fieldset, your layout inside -->
    <template #fields="{ fields }">
      <FormoField :field="fields.street" />
      <div class="flex gap-4"><FormoField :field="fields.zip" /><FormoField :field="fields.city" /></div>
    </template>
  </FormoField>

  <FormoField :field="form.fields.phones">                    <!-- repeatable rows: the theme's rows, your layout in each -->
    <template #row="{ row }">
      <FormoInput :field="row.fields.type" />                 <!-- just the control -->
      <FormoInput :field="row.fields.number" />
      <FormoErrors :field="row.fields.number" />              <!-- just its errors -->
    </template>
  </FormoField>

  <FormoRest />                                               <!-- everything you didn't place -->
  <button type="submit">Save</button>
</FormoForm>
```

- **Handles** are stable objects (one per path): `form.fields.email`, `form.fields.address.fields.zip`, `form.fields.phones.rows[0].fields.number`, or `form.field('address.zip')` by path or alias. They carry `kind` (`field` / `group` / `blueprint`), `path`, `node`, `value` (get/set), `error`, `ignored`, and follow the form: fields added with `.add()` after render show up. With an object definition they're typed, and so are `<FormoField>`'s slot props. `<FormoForm>` also passes `fields` to its default slot.
- **Repeatable groups' handles** manage rows: `phones.rows` (each with `fields`, a stable `key` for `v-for`, `remove()`), `phones.add(values?)`, `phones.remove(index)`, `phones.canAdd` / `canRemove` (`min` / `max` respected). They work whether the group is rendered by the theme, by your markup, or not at all.
- **Pieces of a field, anywhere**: `<FormoInput :field="form.fields.email" />` renders just the control (wired and validated, right there); `<FormoLabel>`, `<FormoErrors>`, `<FormoHelp>`, `<FormoChecklist>` with a handle render that piece of a field rendered elsewhere (they read its live state). See [Parts](#your-own-markup-the-parts).
- **Place each field once**, and don't forget any. An unrendered field isn't validated. `<FormoRest />` renders whatever you haven't placed (like Symfony's `form_rest()`), in the form, or within a subform or row when used inside one — wherever it sits in the template. A field counts as placed when `<FormoField>` or `<FormoInput>` renders it (`<FormoLabel>` / `<FormoErrors>` alone don't: the control is still needed). If you placed only some fields of a subform, the rest of its fields are rendered individually; a repeatable group whose rows you render yourself counts as placed. In development, `<FormoForm>` warns about fields no one rendered. Subform overrides (`components`, `config`, `theme`) still cascade to fields placed in a custom layout.
- **Outside `<FormoForm>`**, in any component: a handle knows its form.

  ```vue
  <FormoField :field="form.fields.newsletter" />      <!-- e.g. in a sidebar component -->
  <component :is="form.render('email')" />            <!-- a component for any part, by path -->
  <button @click="form.submit(save)">Save</button>    <!-- no <form> element needed -->
  ```

  Those parts validate and submit with the rest of the form, whether or not a `<FormoForm>` is also on the page. Form-level rules and callbacks still run. `form.submit(handler)` validates everything and calls `handler(values, ctx)` when it passes.
- **Path strings** (server-driven schemas, fields added at runtime): `<FormoRender path="address.zip" />` renders the same way, with the same slots, and `part="input" | "label" | "errors" | "help" | "checklist"` for a single piece. Its paths are relative to the subform or row you're in first (`path="street"` inside `address`'s layout), then from the form, then by alias (searched recursively).

## Your own markup: the parts

A field is made of **parts** — label, input, help, errors, checklist — and each part has a component that renders it the way the theme does (the theme's `label` / `errors` / `help` / `checklist` views, the control the field resolves to), wired to the field: `for`/`id`, `aria-describedby`, `aria-invalid`, v-model, validation.

| Component | Renders | Theme view |
| --- | --- | --- |
| `<FormoLabel>` | the label (+ required marker); `as="legend" \| "span"` | `label` |
| `<FormoInput>` | the control — the driver's, the theme's or your `component` — and, when read-only, the value | (the control) · `uneditable` |
| `<FormoHelp>` | the help text (`message`) | `help` |
| `<FormoErrors>` | the errors: the first one, or all (`errorDisplay: 'all'`) | `errors` |
| `<FormoChecklist>` | the requirements checklist (`errorDisplay: 'checklist'`) | `checklist` |

**Rebuild a field completely** — the default slot of `<FormoField>` replaces the whole thing (no view) and gets `{ field }`; put the parts wherever your markup needs them:

```vue
<FormoField :field="form.fields.email" v-slot="{ field }">
  <div class="grid grid-cols-2">
    <div class="my-special-label"><FormoLabel :field="field" /></div>
    <FormoInput :field="field" class="w-64" />          <!-- attributes land on the control; classes merge -->
    <div v-if="field.invalid" class="my-error-box">
      <Icon name="warning" /> <FormoErrors :field="field" />
    </div>
  </div>
</FormoField>
```

`field` is the field's state — `value`, `error`, `invalid`, `required`, `label`, `classes`… — so your markup can react to it too. Inside a field's slots the parts find their field on their own (`<FormoInput />` works), and outside they take a handle: `<FormoInput :field="form.fields.email" />`.

**Keep the view, take over one region** — `<FormoField>` also has a slot per region (`#label`, `#input`, `#help`, `#errors`, `#checklist`); the theme's view still lays out the rest:

```vue
<FormoField :field="form.fields.price">
  <template #input>
    <div class="flex">
      <span class="addon">$</span>
      <FormoInput class="rounded-l-none" />
      <span class="addon">.00</span>
    </div>
  </template>
</FormoField>

<FormoField :field="form.fields.password">
  <template #label="{ props }">
    <div class="flex justify-between"><FormoLabel v-bind="props" /><a href="/forgot">Forgot?</a></div>
  </template>
</FormoField>
```

- Every slot gets `{ field, props }`. **`props`** is what the view passed to that region: the `fieldset` view (radios, checkboxes) asks for its label `as="legend"`, the `inline` view (checkbox) `as="span"` — forward it with `v-bind="props"`.
- Because the parts render the **theme's views**, the same markup follows the theme: swap `views: { errors: MyErrors }` app-wide (`createFormo`), per form (`<FormoForm :views>`) or per subform, and every `<FormoErrors>` uses it.
- **Replace** the control instead of rendering `<FormoInput>`: `<template #input="{ field }">` with your own (`field.value`, `field.setValue()`, `field.onBlur()`, `v-bind="field.attrs"`). For native submits, a hidden input mirrors the value when `<FormoInput>` isn't rendered.
- **Automatic layouts** take the same slots on `<FormoForm>`, suffixed with a path: `#input:price`, `#label:address.zip`, `#errors:phones[].number` (`[]` = any row), `#field:email` for a field's (or subform's) whole markup, `#fields:address`, `#row:phones`.

### Subforms and repeatable groups

Same pattern: the **default slot replaces the whole thing**, and named slots lay out the inside of the theme's view.

| Handle | Default slot (replaces everything) | Inside the theme's view |
| --- | --- | --- |
| a field | `{ field, props }` | `#label`, `#input`, `#help`, `#errors`, `#checklist` |
| a subform | `{ group, fields }` | `#fields="{ fields }"` — its fields, in its fieldset |
| a repeatable group | `{ rows, add, remove, canAdd, canRemove }` | `#row="{ row }"` — one row, in the theme's row |

```vue
<!-- A subform as a card: its label, help and error are parts too -->
<FormoField :field="form.fields.address" v-slot="{ fields }">
  <section class="card">
    <h3><FormoLabel /></h3>                              <!-- inside its slot: finds the subform -->
    <FormoField :field="fields.street" />
    <FormoInput :field="fields.zip" />
    <FormoErrors />                                      <!-- the subform's own error (group rules) -->
  </section>
</FormoField>

<!-- A repeatable group as a table: your rows, your buttons -->
<FormoField :field="form.fields.education" v-slot="{ rows, add, canAdd }">
  <table>
    <tr v-for="row in rows" :key="row.key">
      <td><FormoInput :field="row.fields.school" /><FormoErrors :field="row.fields.school" /></td>
      <td><button type="button" @click="row.remove()">×</button></td>
    </tr>
  </table>
  <button type="button" :disabled="!canAdd" @click="add()">Add school</button>
</FormoField>
```

Row handles are typed from the definition (`rows[0].fields.school`), keyed stably across adds and removes, and a field whose row moves up keeps its component (focus, local state). The subform / repeatable group is still registered when you replace its markup, so its rules (over its values, over the list) still run.

## Validation

Rules run on VeeValidate (one validator per field built from `@vee-validate/rules`). All notations can be mixed:

```ts
rules: 'required|min:3|confirmed:@password'          // a string (Laravel-style)
rules: [['required'], ['between', [1, 10]], ['regex', [/^[a-z]+$/i]]]   // tuples: [name, params]
rules: { required: true, between: [1, 10] }          // VeeValidate object
rules: [(value, params, ctx) => value !== 'admin' || 'Reserved name']   // function (sync or async)
rules: z.string().email()                            // zod / valibot / arktype (Standard Schema)
rules: ['required', 'username_available']            // rules registered with createFormo({ rules })
rules: [{ rule: 'min', params: [8], message: 'Too short!' }]
required: true                                       // shortcut
```

**Built-in rules** (VeeValidate / Laravel names): `required`, `email`, `url`, `min`, `max`, `length`, `numeric` (digits only), `integer`, `decimal` (Laravel's `numeric`), `digits`, `between`, `min_value`, `max_value`, `regex` (a RegExp, or a delimited string like Laravel's `/…/i`), `alpha`, `alpha_num`, `alpha_dash`, `alpha_spaces`, `is`, `is_not`, `one_of`, `not_one_of`, `confirmed` / `matches` (`@field` refs), `date`, `phone`, `color`, `ip`, `min_items`, `max_items`, `ext`, `mimes`, `image`, `size` (KB), `dimensions`, `upload_size` (`1M`, `500K`), `html5_range` (the input's `min` / `max` / `step`), Laravel's password helpers `mixed_case`, `letters`, `numbers`, `symbols` (`Password::mixedCase()`…), Laravel's `accepted` and numeric comparisons `gt`, `gte`, `lt`, `lte` (against a number or a field: `gte:@start`), and Laravel's conditional rules `required_if`, `required_unless`, `required_with`, `required_with_all`, `required_without`, `required_without_all`, `exclude_if`, `exclude_unless` (see [Optional subforms](#optional-subforms--conditional-rules)).

**Params**: `@other_field` references another field's value (sibling first, then from the form root). In messages it becomes that field's label. Function rules get `(value, params, ctx)` — `ctx` has the form's and the group's values, the field, its label and the controller.

**Group / form-level rules**: put `rules` on a group or the form. They receive the group's values and run only once all its fields pass (Formo semantics). The error renders at the top of the group (`errors[':self']`).

**Several rules on a field** run in order. By default the first failure stops the rest. `errorDisplay: 'all'` runs them all and lists every failure, and `errorDisplay: 'checklist'` shows each one as a live requirement (see the next section). `form.allErrors` has every message per field.

**Messages**, first match wins:

1. the rule's own `message`
2. the field's `errorMessages[rule]`
3. `config.messages['path.rule']`, `['parent.alias.rule']`, `['alias.rule']`, `['alias.default']`
4. `config.messages[rule]`, then `default`

Placeholders: `:field` (label), `:value`, `:param1…`, `:params`, `:other` (confirmed/matches/required_if), Laravel's names (`:attribute`, `:min`, `:max`, `:size`, `:digits`, `:values`), or the `{field}` style. `:param1` is the rule's first param.

A custom rule with a checklist `label` and no message uses its label as the message. Translations: see [i18n](#i18n).

**When to validate**: `config.validationMode`:

| Mode | Behavior |
| --- | --- |
| `eager` (default) | On blur, then on every change once the field was touched or has an error |
| `aggressive` | On every change |
| `lazy` | On blur (and on change while the field shows an error) |
| `submit` | Only on submit (errors still clear as you fix them) |

**Callbacks** run after validation, deepest first:

```ts
Formo.form({
  callbacks: {
    pass: { ':self': [({ values }) => track('ok')], email: [({ value }) => …] },
    fail: [({ form }) => console.log(form.errors)],
  },
})
```

A `pass` callback can veto by returning `false` or a message. Callbacks get `{ node, path, value, values, form, setError }`.

**Server errors**: `@submit="(values, { setErrors }) => …"`, or `form.setErrors(...)`, accepts flat paths or Formo's nested `errors()` format. `':self'` is the form itself. Laravel / Inertia keys work as they are (`phones.0.number` → the first phone row). Errors a server rendered into the page (a failed post with JavaScript off, Inertia's `errors` prop) go in `useFormo(definition, { errors })`; they're applied once the fields are mounted.

## Error display & checklists

Each field shows its validation state in one of three ways (`errorDisplay` on the field, or as a default in `config.errorDisplay`):

| `errorDisplay` | Shows |
| --- | --- |
| `'first'` (default) | The first failing rule's message |
| `'all'` | Every failing rule's message, as a list |
| `'checklist'` (or `checklist: true`) | **Every** rule as a live requirement: a grey box with ✗ before each one until the value meets it, then a green ✓. Re-evaluated on every keystroke; unmet items turn red once the field failed validation |

```ts
// Laravel's Password::min(8)->mixedCase()->numbers()->symbols()
.add('password', 'input|password', {
  checklist: true,
  rules: 'required|min:8|mixed_case|numbers|symbols',
})
```

- **Requirement texts** come from `config.requirements` (`min: 'At least :param1 characters'`, `mixed_case: 'Uppercase and lowercase letters'`…).
- **Overriding them:** per field with `requirements: { min: 'Eight or more characters' }`, or per rule with the object notation: `{ rule: 'regex', params: [/^\S*$/], label: 'No spaces' }`.
- **Lookup order:** the same as messages (`path.rule`, `alias.rule`, `rule`). A rule with no requirement text shows its error message.
- **Empty values:** an empty value meets no requirement. Normally rules pass on empty values and only `required` fails, but that would show "At least 8 characters ✓" for an empty password.
- **`required`:** it's implied, so it isn't listed unless you give it a label. Its "must not be empty" message still appears under the box. Messages the checklist already shows aren't repeated.
- **Accessibility:** the box is linked to the input with `aria-describedby` and announced with `aria-live`.
- **Overriding the component:** `components: { checklist: MyChecklist }`. It receives the `formo` prop, and `formo.checklist` is `[{ rule, label, passed, message }]`.

## Optional subforms & conditional rules

The form's own values decide what's optional. An **ignored** field or subform is fully optional:

- none of its rules run
- group rules and callbacks inside it are skipped
- its existing errors clear and its required markers disappear

It stays rendered (dimmed with the `ignored` theme class). Hiding it is a separate, purely visual choice with `render`. When it's no longer ignored it's validated again, and errors come back if the user already tried to submit.

```ts
Formo.form({ alias: 'checkout' })
  .add(address('billing'))
  // 1. The rule lives on the checkbox: while checked, the shipping subform is optional
  .add('same_as_billing', 'checkbox', false, { label: 'Ship to my billing address', ignores: 'shipping' })
  .add(address('shipping'))

  // 2. Or the condition lives on the subform (JSON-friendly)…
  .add(Formo.group('gift', { ignore: { when: 'is_gift', not: true } }).add('note', { required: true }))
  // …or as a function
  .add(Formo.group('company', { ignore: ({ values }) => values.type !== 'business' }).add('vat', { required: true }))
```

| Option | Effect |
| --- | --- |
| `ignores: 'shipping'` / `['a', 'b']` (on any field) | While this field's value is truthy (checked / filled), the targets are ignored. Paths are relative to the field's group |
| `excludes: …` | Same, and the targets' values are dropped from what's submitted |
| `ignore: condition` (on a field or group) | Ignored while the condition holds. Cascades into the whole subform, including groups with `namespaces: false` |
| `exclude: condition` | Same, plus the values are dropped (Laravel `exclude_if`) |

Conditions: `true`/`false`, a function `({ values, parentValues }) => boolean`, or JSON-friendly objects:

- `{ when: 'same_as_billing' }`: that field is checked or filled
- `{ when: 'type', is: 'business' }` or `is: ['a', 'b']`
- `{ when: 'type', not: 'personal' }`
- `{ when: 'notes', filled: false }`

Field references resolve relative to the node's group first, then from the root.

**Laravel's conditional rules** do the same per field. Both the `type` and `@type` spellings work:

```ts
.add('company', { rules: 'required_if:type,business' })        // required when type is business
.add('vat', { rules: 'required_with:company' })                  // …when company is filled
.add('postal_copy', { rules: 'required_without:email_invoice' }) // …when email_invoice is off/empty
.add('other', { rules: 'exclude_if:same,true|required' })        // skipped + not submitted when `same`
```

`required_unless`, `required_with_all` and `required_without_all` work too. The required marker follows the condition live, and `form.isIgnored(path)` / `form.isExcluded(path)` tell you the current state.

## i18n

Every string Formo renders can be translated, and the locale is **reactive**. Switching it re-renders labels, option texts, placeholders, help texts, checklist requirements and UI strings (blueprint buttons, the error summary…), and **re-translates errors already on screen**.

```ts
const locale = ref('fr')
app.use(createFormo({ config: { locale } }))     // or per form: <FormoForm :config="{ locale }">
```

**Built in:** `en`, `fr`, `es`, `de` and `nl` cover every validation message, checklist requirement and UI string. Lookup falls back from the regional locale (`fr-CA`) to the base language (`fr`), then `fallbackLocale`, then `en`. Within a locale, the most specific key wins (`path.rule` → `alias.rule` → `rule`).

**Your own translations**: `config.locales`, merged over the built-ins:

```ts
createFormo({ config: { locales: {
  fr: {
    labels: { email: 'Adresse e-mail', 'address.zip': 'Code postal' },   // by path / alias
    texts:  { 'Favorite color': 'Couleur préférée', Red: 'Rouge' },       // free texts, by their source text
    validation: { 'email.required': 'Il nous faut votre e-mail' },      // rule / alias.rule / path.rule
    requirements: { min: ':param1 caractères minimum' },                // checklist lines
    ui: { add: 'Ajouter un téléphone' },
  },
  it: { validation: { required: 'Il campo :field è obbligatorio' } },   // a new language
} } })
```

**Texts** are the strings you write in definitions: explicit labels, `message`s, option labels, placeholders/titles, button labels, `blank` options, `addLabel`s. Like Laravel's `__('Email')`, the text itself is the key. Rules that return a string message are translated the same way.

**vue-i18n:**

```ts
import { vueI18n } from 'formo-vue'
app.use(i18n).use(createFormo({ config: vueI18n(i18n) }))
```

- The locale follows `i18n.global.locale`.
- Keys are looked up under `formo.` (`formo.validation.required`, `formo.labels.email`, `formo.ui.add`), with named params (`{field}`, `{min}`).
- Texts are used as keys.
- Anything missing falls back to Formo's catalogs.

**Laravel lang files** with [laravel-vue-i18n](https://github.com/xiCO2k/laravel-vue-i18n):

```ts
import { trans, currentLocale } from 'laravel-vue-i18n'
app.use(createFormo({ config: laravelI18n({ trans, locale: () => currentLocale.value }) }))
```

Your existing `lang/xx/validation.php` then works as-is:

- **Messages:** Formo's rules map to Laravel's keys (`min` → `min.string`, `min_value` → `min.numeric`, `one_of` → `in`, `mixed_case` → `password.mixed`…), with `:attribute`, `:min`, `:max`, `:size`, `:values`, `:other` and `:value` filled in.
- **Per-field messages:** `custom.email.required` works.
- **Labels:** come from `attributes`.
- **Free texts:** come from `lang/xx.json`.

No laravel-vue-i18n? Export `validation.php` as JSON and convert it:

```ts
locales: { fr: fromLaravelValidation(frValidationJson) }
```

**40+ more languages** for the validation messages, from @vee-validate/i18n:

```ts
import ja from '@vee-validate/i18n/dist/locale/ja.json'
createFormo({ config: { locales: { ja: fromVeeValidateLocale(ja) } } })
```

**Anything else**, for example your own i18n library:

- `config.t(key, params)` answers namespaced keys (return `undefined` to fall back).
- `config.translate(text)` answers free texts.
- `getTranslator(config)` gives you Formo's translator in your own components.

## CSRF & Laravel

CSRF protection is on by default and follows Laravel's `VerifyCsrfToken`, which accepts, in order:

| Laravel reads | formo-vue sends it from | Used for |
| --- | --- | --- |
| `_token` body field | `<meta name="csrf-token" content="{{ csrf_token() }}">` (or `csrf.token`) | native form posts (`<FormoForm native>`), like Blade's `@csrf` |
| `X-CSRF-TOKEN` header | the same raw token | `form.request()` |
| `X-XSRF-TOKEN` header | the `XSRF-TOKEN` cookie Laravel sets on web responses (URL-decoded, like axios) | `form.request()`, Sanctum SPAs |

```ts
createFormo({ config: { csrf: 'sanctum' } })  // or per form: <FormoForm :config="{ csrf: 'sanctum' }">
```

| `config.csrf` | When |
| --- | --- |
| `'laravel'` (default) | Blade apps / session routes: meta tag and/or `XSRF-TOKEN` cookie, when present |
| `'sanctum'` | SPAs using Sanctum cookie auth: also `GET /sanctum/csrf-cookie` when there's no token yet, and to refresh it after a 419 |
| `{ …options }` | Merged over `'laravel'`: `token` (string or async fn), `meta`, `cookie`, `field`, `header`, `cookieHeader`, `prime`, `origins`, `retryOn419` |
| `false` | Stateless APIs (Sanctum/Passport **bearer tokens**): no CSRF involved; pass `request: { headers: { Authorization } }` |

**Sending data.** Give the form an `action` and no `@submit`: it sends itself after validation.

```ts
Formo.form({ alias: 'profile', attr: { action: '/api/profile', method: 'put' } })
// <FormoForm :form="form" @success="(data) => …" @rejected="(outcome) => …" />
```

Or call `request()` yourself from `@submit`, with the same handling:

```ts
async function save(values, { request }) {
  const { ok, data } = await request('/api/profile', { method: 'put' })
}
```

What `request()` does:

- Sends `Accept: application/json` and `X-Requested-With`, so Laravel answers with JSON (and 422 rather than a redirect).
- Sends a **JSON** body, or **FormData** with PHP bracket names (`phones[0][number]`) when there are files. Multipart PUT/PATCH/DELETE are sent as POST + `_method`, because PHP can't parse multipart PUT.
- Sends credentials (`include`) and CSRF headers **only to trusted origins**: the page's origin, `request.baseUrl`'s origin, and `csrf.origins`. A native form posting elsewhere never gets `_token`.
- **On 419:** if a fresh token can be obtained (Sanctum `prime` or a `token` function), it refreshes and retries once. A meta token that caused a 419 is remembered as stale and no longer sent, since Laravel checks it before `X-XSRF-TOKEN`. If it still fails, the form shows *"Your session has expired…"* (`messages.csrf_mismatch`).
- **On 422:** Laravel's `errors` land on the matching fields, with `phones.0.number` mapped to the first phone row. Keys without a field (server-only rules) become the form-level error.
- **Other failures:** the server's `message`, or `messages.request_failed`.
- **Options:** `baseUrl`, `headers`, `credentials`, `body: 'json' | 'form-data' | 'auto'`, `rootKey` (send `{ user: values }`; strips `user.` from error keys), and `fetch`. Set them app-wide (`config.request`), per form, or per call.

**Native posts (Blade pages).** `<FormoForm native>` validates client-side, then posts the `<form>` with hidden `_token` and, for `method: 'put' | 'patch' | 'delete'`, `_method`: the equivalents of `@csrf` and `@method('PUT')`. The token is re-read right before submitting. Only the raw (meta/explicit) token works as a form field; the encrypted cookie is header-only, and a dev warning tells you when no raw token was found.

**Laravel side checklist (Sanctum SPA):**

- Laravel 11+: `->withMiddleware(fn ($m) => $m->statefulApi())`. Older versions: `EnsureFrontendRequestsAreStateful` in the `api` group.
- `SANCTUM_STATEFUL_DOMAINS` includes your SPA's host.
- `SESSION_DOMAIN` covers both hosts when they're subdomains (`.example.com`).
- `config/cors.php`: `'supports_credentials' => true`, with your SPA origin allowed.
- SPA and API on different subdomains: `config: { request: { baseUrl: 'https://api.example.com' }, csrf: 'sanctum' }`. `baseUrl`'s origin is trusted automatically.

**Using axios or your own client instead?** Use the same helpers:

```ts
import { csrfHeaders } from 'formo-vue'
axios.interceptors.request.use(async (cfg) => {
  Object.assign(cfg.headers, await csrfHeaders('sanctum', { url: cfg.url! }))
  return cfg
})
```

## Forms from models & schemas

`formo-vue/schema` builds a form from a model — every field or just some, with overrides — types, labels and validation included:

```ts
import { Formo, useFormo } from 'formo-vue'
import { fromLaravel, fromJsonSchema, fromOpenApi, fromZod, parseModel } from 'formo-vue/schema'

// a FormRequest's rules(), attributes(), messages() — e.g. an Inertia prop
const form = useFormo(
  Formo.fromModel(fromLaravel(props.rules), {
    except: ['role'],                                      // or only: ['name', 'email', 'address.zip']
    fields: { bio: { attr: { rows: 6 } }, terms: { driver: 'checkbox', required: true } },  // overrides & additions
    mode: 'update',                                        // read-only fields shown, passwords optional
    values: props.user,                                    // Formo's orm('load'): dates, relations… converted
  }),
)
// the others: fromJsonSchema(schema) · fromOpenApi(doc, { operation: 'POST /users' })
//             fromZod(Schema, { toJSONSchema: z.toJSONSchema }) · parseModel(json from your backend)
```

- Every source becomes a **Formo model**, a public, versioned IR (`{ "version": 1, "fields": [...] }`, contract in `src/schema/formo-model.v1.schema.json`). A backend can also send one directly, as an Inertia prop or from an endpoint.
- `formFromModel()` returns a plain definition; `Formo.fromModel()` returns a builder, so you can keep going (`.add()`, `.order()`).
- **Derived rules by default**, so Formo's messages, checklists, live locale switching and Laravel lang files keep working:
  - Laravel's typed `min` / `max` / `size`, `numeric`, `confirmed` (adds `password_confirmation`) and `phones.*.number` rows are read like Laravel reads them.
  - Zod's `.refine()` / `.superRefine()` still run through Zod, and object-level issues land on the field their `path` names. Opt into `validation: 'schema'` to make Zod the only validator.
  - Server-only rules (`unique`, `exists`) stay on the server.
- Bookkeeping fields (`id`, `created_at`…) and guarded fields stay out unless asked for. Anything unsupported is reported, never silently dropped.

Full guide: [docs/schema.md](docs/schema.md).

## Themes & views

A **theme** is a set of **views** (Vue components laying out the form, a subform, a field, a label…), plus the **controls** and the **classes** they use. Switching themes changes how every form looks.

| View | Lays out | Slots it fills |
| --- | --- | --- |
| `form` | inside `<form>` (which keeps submit, CSRF, `disabled`) | `before`, default (the fields), `actions` |
| `group` | a subform | default (its fields) |
| `blueprint`, `blueprintRow` | repeatable groups, one row | `row` (`{ row }`, once per row) / default (the row's fields) |
| `field` | label above the control (default) | `label`, `input`, `help`, `checklist`, `errors` |
| `inline` | checkbox, then its label | same |
| `fieldset` | radios / checkboxes under a `<legend>` | same |
| `bare` | no label (buttons) | same, without `label` |
| `label`, `help`, `errors`, `checklist`, `uneditable` | a field's parts — also what `<FormoLabel>`, `<FormoErrors>`… render | — |
| `errorSummary` | `<FormoErrorSummary>` | — |

Every view gets a `formo` prop — the state of what it renders (a field's value, error, label, ids, classes…; a group's label, error…; a repeatable group's rows, `add()`…) — and places Formo's parts through **slots**. A view only does layout; binding, validation, ids and aria stay in Formo. Here's a complete `field` view:

```vue
<!-- BsField.vue -->
<script setup lang="ts">
import type { FormoFieldState } from 'formo-vue'
defineProps<{ formo: FormoFieldState }>()
</script>

<template>
  <div class="mb-3" :class="{ 'has-validation': formo.invalid }">
    <slot name="label" class="form-label" />    <!-- attributes on a slot go to that part (classes merge) -->
    <slot name="input" />
    <slot name="help" />
    <slot name="errors" />
  </div>
</template>
```

Views choose things classes can't: the order of the parts (a floating label needs the input *before* its label: `<slot name="input" class="peer" placeholder=" " />` then `<slot name="label" />`), extra wrappers, a different element (`<slot name="label" as="legend" />`). The *Theming* example has floating-label and horizontal views.

### Defining a theme

```ts
import { defineTheme, defaultTheme } from 'formo-vue'

// A whole theme: classes replace the built-in Tailwind ones (keys you leave out are empty),
// views you leave out fall back to the built-in views
export const bootstrap = defineTheme({
  name: 'bootstrap',
  views: { field: BsField, inline: BsCheck, errors: BsFeedback, floating: BsFloating },
  components: { select: BsSelect },               // controls, by driver / 'driver|type' / name
  classes: { control: 'form-control', controlInvalid: 'is-invalid', label: 'form-label', checkbox: 'form-check-input' },
})

// …or a variant of another theme: its views and controls are kept, your classes merge with its own
export const floating = defineTheme({ extends: defaultTheme, views: { field: FloatingField } })
```

Use it app-wide, per form, or per subform (it cascades):

```ts
app.use(createFormo({ theme: bootstrap }))
<FormoForm :form="form" :theme="bootstrap" />
{ fields: { legacy: { theme: bootstrap, fields: { … } } } }
```

A whole theme can also be set on one subform (`{ fields: {…}, theme: bootstrap }`, cascading inside) or one field (`{ theme: bootstrap }`). Its parts — `<FormoLabel>`, `<FormoErrors>`… in your own markup — follow it too.

A field picks a view with **`view`**: one of the theme's (`view: 'inline'`, or a name the theme adds: `view: 'floating'`), a component (`view: CardField`), or `false` for the bare control. Groups take `view` too (`view: MyFieldset`). Drivers say which view their fields use (`checkbox` → `inline`, `radios` → `fieldset`, buttons → `bare`).

### Overrides

Over the theme, **overrides** can be layered app-wide, per form, or per group (cascading). They apply whatever the theme:

```ts
createFormo({ views: { errors: MyErrors }, components: { 'input|date': DatePicker }, classes: { control: 'rounded-none' } })
<FormoForm :views="{ … }" :components="{ … }" :classes="{ label: 'uppercase tracking-wide' }" />
{ fields: { … }, theme: { views: { … }, components: { … }, classes: { … } } }    // a group: cascades inside
{ classes: { control: 'font-mono' } }                  // one field (or group) only
{ attr: { class: 'w-1/2' } }                           // the control element
{ fields: { … }, classes: { groupBody: 'grid gap-4 sm:grid-cols-2' } }   // a subform's layout
```

A view is resolved as: the node's `view` → overrides (`views`) → the theme's → the built-in one. Note `view` (one view, for one field) vs `views` (a map of overrides): `view: { errors: MyErrors }` warns in development. Class overrides merge with the theme's `mergeClasses` (tailwind-merge for the built-in theme, so an override only lists what changes). The class keys (`control`, `controlInvalid`, `label`, `group`, `error`, `help`, `button`, `buttonPrimary`, `checkbox`, `blueprintRow`…) are in `src/core/theme.ts`.

## UI libraries: Nuxt UI & shadcn-vue

Formo's stock controls are plain HTML. With a theme, fields render with a UI
library's components instead — still one form object, with every override above.

**[Nuxt UI](docs/nuxt-ui.md)** — `formo-vue/nuxt-ui`. Every field in a `UFormField`, with `UInput`,
`UTextarea`, `USelect`, `UCheckbox`, `URadioGroup`, `UCheckboxGroup`, `UButton`. The subpath never
imports `@nuxt/ui` (you pass the components), so it's never a dependency:

```ts
import { nuxtUiTheme } from 'formo-vue/nuxt-ui'
import { UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton } from '#components'

app.use(createFormo({
  theme: nuxtUiTheme({ UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton }),
}))
```

**[shadcn-vue](docs/shadcn-vue.md)** — a registry item, the shadcn way: it copies a small Formo theme
into your `components/ui/formo/`, built on your own `Input`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Label`:

```bash
npx shadcn-vue@latest add https://raw.githubusercontent.com/<owner>/formo-vue/main/registry/r/formo.json
```

```ts
import { shadcnTheme } from '@/components/ui/formo'
app.use(createFormo({ theme: shadcnTheme }))
```

Just the look, with Formo's own controls: `defineTheme({ classes: shadcnClasses, mergeClasses: tailwindMergeClasses })`.

Both wire ids, labels, `aria-invalid` / `aria-describedby`, error styling and
native submits; both swap controls by name — `component: 'switch'` on a field, or
`components: { checkbox: 'switch' }` for a form (Nuxt UI also has `'select-menu'`,
the searchable `USelectMenu`). Neither library's own form component (`UForm`,
shadcn's `<Form>` / `<FormField>`) is used: Formo is the form.

## Overriding components

Each field's **control** is resolved in this order (first match wins):

| # | Mechanism | Scope | Example |
| - | --- | --- | --- |
| 1 | `#field:<path>` slot / `<FormoField>` default slot | one field, **your own markup** (with `<FormoInput>` & co. inside) | `<template #field:address.zip="{ field }">…</template>` |
| 2 | `#input:<path>` slot / `<FormoField #input>` | one field, **wraps (`<FormoInput />`) or replaces the control** (the view stays) | `<template #input:phone="{ field }">…</template>` |
| 3 | `component` on the field | one field | `{ component: StarRating }` |
| 4 | `components['driver\|type']` | a driver + input type | `components: { 'input\|date': DatePicker }` |
| 5 | `components[driver]` | a driver | `components: { checkbox: ToggleSwitch }` |
| 6 | the theme's `components` (same keys) | everywhere the theme is used | `defineTheme({ components: { select: BsSelect } })` |
| 7 | the driver's component | everywhere | `createFormo({ drivers: { rating: { component: StarRating } } })` |

`components` can be given **app-wide** (`createFormo`), **per form** (`<FormoForm :components>`), or **per group** (`{ fields: {…}, components: {…} }`, cascading into the group). A field's `component` can also be a **name** registered in `components` (or the theme's), or a globally registered Vue component. That lets a schema from the server say `{ "component": "color-swatches" }`. Slot paths match exact paths (`phones[0].number`) or any row (`phones[].number`). The layout around the control is a view — see [Themes & views](#themes--views).

### Writing a custom control

Any `v-model` component works unchanged, including ones from UI libraries:

```ts
rating: { component: StarRating, props: { max: 10 } }
```

- It receives `modelValue` and emits `update:modelValue` (and optionally `blur`).
- `id`, `name` and `aria-*` fall through to its root (and `type`, on the `input` driver).
- Components with another contract declare it: `model: { prop: 'value', event: 'change' }`.

When a component needs more (the error, label, options, theme classes…), it has two options:

```vue
<script setup>
// a) ask for it — no props needed
import { useFormoField } from 'formo-vue'
const field = useFormoField()
// field.value, field.setValue(v), field.onBlur(), field.error, field.invalid, field.label,
// field.options (normalized opts), field.classes (resolved classes), field.attrs (id/name/aria),
// field.required, field.node (the definition, incl. custom vars), field.form (controller)
</script>
```

```vue
<script setup>
// b) declare a `formo` prop — Formo passes the same state object
defineProps<{ formo: FormoFieldState; modelValue?: boolean }>()
</script>
```

A component that puts `id` on an inner element should set `defineOptions({ inheritAttrs: false })`. The built-in controls (`FormoInputControl`, `FormoSelectControl`, `FormoChoicesControl`…) and views (`FormoFieldView`, `FormoLabelView`, `FormoErrorsView`…) are exported, so your own controls and views can reuse them.

### Any component as a control: `defineControl()`

A UI library's components usually need more than a `v-model`: options as `items`,
an error `color`, a `label` prop… `defineControl()` spells the contract out once,
so the component is used as-is — no wrapper component:

```ts
import { defineControl } from 'formo-vue'

createFormo({
  components: {
    // props computed from the field's state (FormoFieldState); the field's own `props` win
    input: defineControl({
      component: UInput,
      props: (field) => ({ color: field.invalid ? 'error' : undefined, highlight: field.invalid }),
      native: true,             // it renders a real <input name>: native submits need no hidden mirror
    }),
    // adapt the value both ways: a SET column ('a,b') ↔ an array
    set: defineControl({
      component: UCheckboxGroup,
      props: (field) => ({ items: field.options }),
      model: { get: (v) => String(v ?? '').split(',').filter(Boolean), set: (v) => v.join(',') },
    }),
    // registered by name: { component: 'switch' } on a field, or components: { checkbox: 'switch' }
    switch: defineControl({ component: USwitch, props: (field) => ({ label: field.label }) }),
  },
})
```

Usable wherever a control goes: a field's `component`, `components` (app, form,
group), a theme's `components`, a driver's `component`. The value a control emits
goes through `model.set`, then the driver's `parse` — the `input` driver turns
`number` / `range` values into numbers, whatever the component emits.

### New field types

```ts
createFormo({
  drivers: {
    tags: {
      component: TagInput,
      defaultValue: () => [],                 // value when the definition has no `val`
      display: (v) => v.join(', '),           // for editable: false
      view: 'field',                          // the view its fields use: 'field' | 'inline' | 'fieldset' | 'bare' | a theme's view | false
      rules: (node, config) => ['min_items:1'],  // automatic rules (Formo pre_validate)
      model: { prop: 'modelValue', event: 'update:modelValue' },
      parse: (value, node) => value,          // what the control emits → the field's value
    },
  },
})
// keywords: { driver: 'tags' }
```

## Subforms, namespaces and repeatable groups

- A subform (an entry with `fields`, or a form/group added to a form) nests its values (`{ address: { street } }`) and its names (`user[address][street]`). Set `config: { namespaces: false }` on a group to keep it visual only.
- Names start with the form alias (`user[email]`). `config: { namePrefix: false }` gives bare names (`email`, `address[street]`) — what a FormRequest validates — and `namePrefix: 'account'` another root. Forms from models use their model's keys by default.
- **Blueprints** (repeatable rows): `phones: { blueprint: true, min: 1, max: 5, addLabel: 'Add phone', val: rows, fields: { number: 'tel' } }`, or `Formo.group('phones', { min: 1 }).add('number').padBlueprint(rows)`. The value is an array of row objects; `rules` on the group validate the whole list. Rows have handles: `form.fields.phones.rows[0].fields.number`.

## Good to know

- `numeric` means digits only (VeeValidate); `decimal` is any number — Laravel's `numeric` (`fromLaravel` maps it for you).
- Default ids start with the form alias (`user-email`), so several forms can share a page; an explicit `attr.id` still wins.
- Labels are humanized by default (`first_name` → `First name`; `humanizeLabels: false` for raw aliases).
- Fields with `render: false` keep their values but aren't validated.
- In the browser, submitting is explicit: `<FormoForm @submit>`, `form.submit()`, or a self-submitting form with `attr.action`.
