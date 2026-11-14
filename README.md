# formo-vue

[Formo](../kohana-formo)'s "forms as objects", rebuilt for **Vue 3**:

- **Vue components** replace the PHP views (`form_template.php`, `field_template.php`, `opts/*_template.php`…)
- The **`Formo` builder** is a port of the PHP object API (`add`, `find`, `order`, `subform`, `add_rules_fields`, `pad_blueprint`…)
- **Validation runs on [VeeValidate](https://vee-validate.logaretm.com/v4/)**. Kohana rule arrays keep working, alongside vee rule strings/objects, functions, async rules and Zod/Valibot schemas
- **Error display per field**: the first error (default), all of them, or a live **requirements checklist** (✗ → ✓ as you type)
- **Optional subforms**: a "Same as billing address" checkbox can make a whole subform optional (Formo's `ignore`), plus Laravel's `required_if` / `required_with` / `exclude_if`…
- **i18n**: live locale switching, built-in en/fr/es/de/nl, adapters for **vue-i18n** and **Laravel lang files** (laravel-vue-i18n), 40+ locales via @vee-validate/i18n
- **CSRF protection built for Laravel**: Blade `@csrf`/meta tokens, Sanctum's `XSRF-TOKEN` cookie, 419 refresh + retry, 422 errors mapped onto fields
- **Tailwind** styles everything through an overridable theme
- **Any component can be swapped**: per field, per driver, per form/group, app-wide, by name, or with a slot

```vue
<script setup lang="ts">
import { Formo, FormoForm } from 'formo-vue'
import StarRating from './StarRating.vue'

const form = Formo.form({ alias: 'review' })
  .add('title', { rules: [['not_empty'], ['max_length', [':value', 80]]] })
  .add('email', 'input|email', { required: true })
  .add('rating', { component: StarRating, rules: 'required|min_value:1' })
  .add('body', 'textarea')
  .add('save', 'button', { label: 'Publish', attr: { type: 'submit' } })

async function save(values) {
  await api.post('/reviews', values)
}
</script>

<template>
  <FormoForm :form="form" @submit="save" />
</template>
```

---

## Contents

- [Playground (`bun run dev`)](#playground) · [Supported platforms](#supported-platforms)
- [Project layout](#project-layout)
- [Installing in an app](#installing-in-an-app)
- [Defining forms](#defining-forms) · [PHP → Vue API map](#php--vue-api-map)
- [Field types (drivers)](#field-types-drivers) · [Field parameters](#field-parameters)
- [Rendering: `<FormoForm>` and `useFormo()`](#rendering-formoform-and-useformo) · [**Rendering parts anywhere**](#rendering-parts-anywhere)
- [Validation](#validation)
- [Error display & checklists](#error-display--checklists)
- [Optional subforms & conditional rules](#optional-subforms--conditional-rules)
- [i18n](#i18n)
- [CSRF & Laravel](#csrf--laravel)
- [**Overriding components**](#overriding-components)
- [Theming](#theming)
- [Subforms, namespaces, repeatable groups](#subforms-namespaces-and-repeatable-groups)
- [Migrating from PHP gradually](#migrating-from-php-gradually)
- [Differences from Formo (PHP)](#differences-from-formo-php)

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
- **POST body**: what a native submit of each form would send, namespaced like Formo's, so a Kohana controller's `$form->load($_POST)` or Laravel's `$request->input('user.address.street')` keeps working.

| Example | Shows |
| --- | --- |
| Getting started | The builder, Kohana + vee rules, filters, async submit |
| **Render parts anywhere** | Your own layout: fields side by side, an input with its label/error placed separately, a subform's inner layout, custom blueprint rows, `<FormoRest />`, and a field rendered by a card outside the `<form>` |
| Field types | Every driver, HTML5 auto-rules, optgroups, multiple, set, file, uneditable |
| Subforms & form objects | Namespaces, `namespaces: false`, ordering, `subform()`, mutating the builder live |
| Validation | All rule notations, async rule, zod, cross-field, group rules, messages, validation modes |
| **Multiple rules per field** | Stacks of 3–6 rules in mixed notations per field; first failure vs every failure vs checklist; `form.allErrors` |
| Error display & checklists | Password requirements checklist (8 chars, mixed case, number, symbol); `first` vs `all` vs `checklist` |
| **Optional subforms** | "Ship to my billing address" makes the shipping subform fully optional; conditions on subforms; `exclude`; `required_if` / `required_with` / `required_without` |
| Callbacks & server errors | `pass`/`fail` callbacks, form-level rule, `setErrors()` from a server |
| **Custom components** | Every override mechanism (see below) |
| Theming | Three themes from the same form object |
| **Translations (i18n)** | Live switching between en / fr / es / de / nl / ja: labels, options, placeholders, messages, checklists, UI strings; errors re-translated in place |
| Repeatable groups | Blueprints: add/remove rows, min/max, rules over the list |
| Laravel & CSRF | A Sanctum SPA form and a Blade-style native post against a **mock Laravel backend** running in the dev server: XSRF cookie priming, 419 → refresh → retry, 422 mapping, `_token` / `_method`, with a live server request log |
| From PHP `to_array()` | Live-editable JSON from the PHP library rendered as-is |

Other scripts:

```bash
bun run check             # everything below except the builds
bun run check:native      # this machine's native toolchain binaries are installed & load (runs before dev/build/test)
bun run check:platforms   # the lockfile installs on macOS (arm64/x64) and Linux (x64/arm64)
bun run check:deps        # every imported package (and required peer) is declared in package.json
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
│   ├── plugin.ts                 createFormo()            (≈ config/formo.php)
│   ├── types.ts
│   ├── core/
│   │   ├── builder.ts            class Formo               (≈ classes/Formo/Core/Formo.php)
│   │   ├── normalize.ts          definitions → node tree   (accepts PHP to_array() JSON)
│   │   ├── drivers.ts            built-in drivers          (≈ classes/Formo/Core/Driver/*)
│   │   ├── conditions.ts         `ignore` / `exclude` conditions
│   │   ├── locate.ts             path/alias → node (for rendering parts)
│   │   ├── rules.ts              rule parsing/running on @vee-validate/rules
│   │   ├── config.ts             defaults + messages       (≈ messages/validation.php)
│   │   ├── theme.ts              Tailwind theme
│   │   └── values.ts, labels.ts, options.ts, utils.ts
│   ├── i18n/
│   │   ├── translator.ts         locale lookup (overrides → i18n bridge → catalogs → fallbacks)
│   │   ├── adapters.ts           vueI18n(), laravelI18n(), fromLaravelValidation(), fromVeeValidateLocale()
│   │   └── locales/              en, fr, es, de, nl
│   ├── http/
│   │   ├── csrf.ts               CSRF tokens (meta / XSRF cookie / Sanctum priming, trusted origins)
│   │   └── request.ts            Laravel-flavoured fetch (JSON/FormData, _method, 419 retry, 422 errors)
│   ├── composables/
│   │   ├── useFormo.ts           the runtime form controller (values, validate, errors…)
│   │   ├── useFormoField.ts      for custom field components
│   │   └── useGroupSetup.ts      for custom group components
│   └── components/
│       ├── FormoForm.vue         (≈ form_template.php)
│       ├── FormoGroup.vue        (≈ group_template.php)
│       ├── FormoBlueprint.vue    repeatable groups
│       ├── FormoFieldWrapper.vue (≈ field_template.php / checkbox_template.php)
│       ├── FormoField.ts         binds a field to VeeValidate, resolves its component
│       ├── FormoRender.ts        any part, anywhere (field / input / label / error / subform…)
│       ├── FormoRest.ts          everything not placed by hand
│       ├── FormoNode.ts, FormoChildren.vue, FormoErrors.vue, FormoUneditable.vue
│       └── controls/             FormoInput, FormoSelect, FormoChoices (radios/checkboxes/set)…
├── playground/                   ← the Vite app served by `bun run dev`
│   ├── main.ts                   app-wide createFormo() setup (custom drivers, rules…)
│   ├── examples/*.vue            each one a standalone Vue component (form + values + errors)
│   ├── server/mock-laravel.ts    fake Laravel backend (Vite dev-server middleware) for the CSRF example
│   └── components/               StarRating, TagInput, ToggleSwitch… (example custom components)
├── scripts/
│   ├── check-deps.ts             every referenced package is declared
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
  // everything optional — see "Overriding components" and "Theming"
  components: { 'input|date': MyDatePicker },
  drivers: { rating: { component: StarRating, defaultValue: () => 0 } },
  rules: { username_available: async (v) => (await api.available(v)) || 'Taken' },
  config: { messages: { required: ':field is required' }, labels: { dob: 'Date of birth' } },
  theme: { control: 'rounded-none' },
}))
```

The plugin is optional; `<FormoForm>` works without it. It also registers `<FormoForm>`/`<FormoErrors>` globally unless `registerComponents: false`.

**Tailwind** (v4) must see the library's classes. Add it as a source in your CSS:

```css
@import "tailwindcss";
@source "../node_modules/formo-vue/src";
```

## Defining forms

Three equivalent ways, usable interchangeably anywhere a form is expected:

```ts
// 1. The builder (port of the PHP API)
const form = Formo.form({ alias: 'user' })
  .add('username', { required: true })
  .add('notes', 'textarea', 'My notes')                       // alias, driver, val
  .add('hobbies', 'checkboxes', ['run'], { opts: hobbies })   // alias, driver, val, options
  .addGroup('hobby', 'select', hobbies, 'run')                 // add_group()
  .add('address', Formo.group().add('street').add('zip'))    // subform

// 2. A plain object (what the builder produces — `form.toSchema()`)
const form = {
  alias: 'user',
  fields: [
    { alias: 'username', required: true },
    { alias: 'notes', driver: 'textarea', val: 'My notes' },
    ['email', 'input|email'],        // compact construct: [alias, driver, val, options]
    'nickname',                      // just an alias
  ],
}

// 3. JSON from Formo (PHP): $form->to_array()
const form = Formo.fromJSON(await (await fetch('/user/form')).json())
```

The builder stays **live**: calling `form.add(…)`, `.remove()`, `.order()`, `.find('x').set(…)` or `.addRule()` after the form is rendered updates it (see the *Subforms & form objects* example).

### PHP → Vue API map

| Formo (PHP) | formo-vue |
| --- | --- |
| `Formo::form(['alias' => 'x'])` | `Formo.form({ alias: 'x' })` |
| `Formo::factory($array)` | `Formo.factory(def)` / `new Formo(def)` |
| `->add($alias, $driver, $val, $opts)` | `.add(alias, driver, val, opts)` (same shorthands) |
| `->add_group(...)` | `.addGroup(...)` |
| `$form->username` / `$form->find('x')` | `form.field('username')` / `form.find('x')` (also `'a.b'`, `['a','b']`) |
| `->set()` / `->get()` (dot syntax) | `.set()` / `.get()` (dot syntax) |
| `->attr()`, `->add_class()`, `->remove_class()` | `.attr()`, `.addClass()`, `.removeClass()` |
| `->add_rule()`, `->add_rules()`, `->add_rule_fields()`, `->add_rules_fields()` | `.addRule()`, `.addRules()`, `.addRuleFields()`, `.addRulesFields()` |
| `->remove_rule()`, `->remove_rules_fields()` | `.removeRule()`, `.removeRulesFields()` |
| `->callback()` / `'callbacks' => [...]` | `.callback()` / `.callbacks()` / `callbacks: {...}` |
| `->order()`, `->subform()`, `->flatten()`, `->remove()` | `.order()`, `.subform()`, `.flatten()`, `.remove()` |
| `->set_fields()`, `->set_var_fields()`, `->attr_fields()`, `->merge()` | `.setFields()`, `.setVarFields()`, `.attrFields()`, `.merge()` |
| `->pad_blueprint($n \| $rows)` | `.padBlueprint(n \| rows)` |
| `->is_required()` | `.isRequired()` |
| `->to_array()` | `.toArray()` / `.toSchema()` / `JSON.stringify(form)` |
| `$form->render()` | `<FormoForm :form="form" />` (or your own layout inside it) |
| `$form->address->render()` | `<FormoRender path="address" />` · `<component :is="form.render('address')" />` |
| `$form->email->render()` | `<FormoRender path="email" />` |
| `$form->email->input()` / `open()…close()` | `<FormoRender path="email" part="input" />` |
| `$form->email->label()` / `->error()` | `<FormoRender path="email" part="label" />` / `part="error"` |
| `->load($_POST)` | `controller.load(values)` or `v-model` |
| `->validate()` | `await controller.validate()` |
| `->val()` / `->val($v)` | `controller.val('path')` / `controller.val('path', v)` |
| `->error('msg')` / `->errors()` | `controller.setError(path, msg)` / `controller.errors` |
| `config/formo.php` | `createFormo({ config })`, `<FormoForm :config>`, or `config` on a group |
| `template` (view file) | `component` / `wrapper` / slots — see [Overriding components](#overriding-components) |

## Field types (drivers)

| Driver | Control | Value |
| --- | --- | --- |
| `input` (default) · `input\|email` · `email`… | `<input>` of any type. `email`, `url`, `tel`, `date`, `color`, `week`, `time`, `month`, `number`, `range` add validation rules automatically (Formo's `input_rules`), `number`/`range` honor `min`/`max`/`step` | string (`number`/`range`: number \| null) |
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
| `driver` | See above. `'input\|email'` sets the type like Formo |
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
| `filters` | Applied to submitted values: `'trim'`, `'lower'`, `'upper'`, `'int'`, `'float'`, `'null_if_empty'`, functions, `[fn, [':value']]` |
| `order` | On add: index or `['before' \| 'after', alias]` |
| `component`, `props`, `model`, `wrapper` | [Overriding components](#overriding-components) |
| `classes` | Theme overrides for this field |
| `fields`, `components`, `config`, `theme` | Groups: children and cascading overrides |
| `blueprint`, `min`, `max`, `addLabel`, `removeLabel`, `rowLabel` | Repeatable groups |
| anything else | Kept in `node.vars` (like Formo's `set('my_var', …)`), available to your components |

## Rendering: `<FormoForm>` and `useFormo()`

```vue
<FormoForm
  :form="form"            <!-- builder, plain definition, PHP JSON, or a useFormo() controller -->
  v-model="values"        <!-- optional two-way values -->
  :components="{ … }"     <!-- component overrides for this form -->
  :config="{ … }"         <!-- messages, labels, validationMode, namespaces… -->
  :theme="{ … }"          <!-- Tailwind overrides -->
  :rules="{ … }"          <!-- extra rules -->
  :drivers="{ … }"        <!-- extra drivers -->
  :disabled="busy"        <!-- disables every control -->
  native                  <!-- validate, then submit the <form> natively (see Migrating) -->
  @submit="save"          <!-- (values, ctx) — may be async: submit buttons spin meanwhile -->
  @invalid="onErrors"     <!-- (flatErrors) -->
  @success="onSaved"      <!-- no @submit + attr.action: the form sends itself → (data, response) -->
  @failure="onFailed"     <!-- …or the failed response (errors are already on the fields) -->
>
  <template #before="{ form }"> <FormoErrors /> </template>     <!-- above the fields -->
  <!-- default slot: your own layout instead of the automatic one — see "Rendering parts anywhere" -->
  <template #control:rating="field"> … </template>               <!-- see Overriding components -->
  <template #actions="{ submitting, valid, reset }"> … </template>
</FormoForm>
```

For programmatic access, create the controller yourself: the runtime half of a Formo object.

```ts
const form = useFormo(definition)   // in setup(); then <FormoForm :form="form" />

form.values                   // reactive values
form.val('address.zip')       // get · form.val('address.zip', '12345') set
form.load({ … })              // merge values (Formo load())
await form.validate()         // fields, then group rules, then callbacks → boolean
await form.submit()
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

## Rendering parts anywhere

Like Formo's `$object->render()`, every level renders on its own: the form, a subform, a field, just its input, or just its label or error. You don't have to render the form as a whole; place the parts you need in your own components.

```vue
<FormoForm :form="form">
  <!-- The default slot replaces the automatic layout -->
  <div class="grid grid-cols-2 gap-4">
    <FormoRender path="first_name" />                  <!-- a field: label, control, help, errors -->
    <FormoRender path="last_name" />
  </div>

  <label-row>
    <FormoRender path="email" part="label" />          <!-- just the label (wired to the input's id) -->
    <FormoRender path="email" part="input" />          <!-- just the control ($field->input()) -->
    <FormoRender path="email" part="error" />          <!-- just the error (linked via aria-describedby) -->
  </label-row>

  <FormoRender path="address" />                       <!-- a whole subform -->

  <FormoRender path="billing">                         <!-- a subform with your own inner layout -->
    <FormoRender path="street" />                      <!-- relative to the subform: billing.street -->
    <div class="flex gap-4"><FormoRender path="zip" /><FormoRender path="city" /></div>
  </FormoRender>

  <FormoRender path="phones">                          <!-- repeatable rows, custom row layout -->
    <template #row="{ index, remove, canRemove }">
      <FormoRender path="type" part="input" />         <!-- relative to the row: phones[index].type -->
      <FormoRender path="number" part="input" />
    </template>
  </FormoRender>

  <FormoRest />                                        <!-- everything you didn't place -->
  <button type="submit">Save</button>
</FormoForm>
```

| `part` | Renders |
| --- | --- |
| `field` (default) | A field with label, help, errors, checklist; a subform's whole fieldset; a repeatable group with its rows |
| `input` | Only the control |
| `label` · `error` · `help` · `checklist` | That piece alone. It reads the field's live state, so render the field (or its `input`) somewhere too |

- **Paths:** `address.street`, `phones[0].number`, or just an alias (`street`, found anywhere like Formo's `find()`). Inside a subform's or row's custom layout, paths are relative to it first. Subform overrides (`components`, `config`, `theme`) still cascade to parts placed in a custom layout.
- **Place each field once**, and don't forget any. An unrendered field isn't validated. `<FormoRest />` renders whatever you haven't placed (like Symfony's `form_rest()`), in the form, or within a subform or row when used inside one. If you placed only some fields of a subform, the rest of its fields are rendered individually. In development, `<FormoForm>` warns about fields no one rendered.
- **Outside `<FormoForm>`**, in any component, pass the form object:

  ```vue
  <FormoRender :form="form" path="newsletter" />      <!-- e.g. in a sidebar component -->
  <component :is="form.render('email')" />            <!-- object style: <?= $form->email->render() ?> -->
  <component :is="form.render('email', 'input')" />
  <button @click="form.submit(save)">Save</button>    <!-- no <form> element needed -->
  ```

  Those parts validate and submit with the rest of the form, whether or not a `<FormoForm>` is also on the page. Form-level rules and callbacks still run. `form.submit(handler)` validates everything and calls `handler(values, ctx)` when it passes.

## Validation

Rules run on VeeValidate (one validator per field built from `@vee-validate/rules`). All notations can be mixed:

```ts
rules: [['not_empty'], ['min_length', [':value', 3]], ['regex', [':value', '/^[a-z]+$/i']]]  // Kohana / Formo
rules: 'required|min:3|confirmed:@password'          // VeeValidate string
rules: { required: true, between: [1, 10] }          // VeeValidate object
rules: [(value, params, ctx) => value !== 'admin' || 'Reserved name']   // function (sync or async)
rules: z.string().email()                            // zod / valibot / arktype (Standard Schema)
rules: ['required', 'username_available']            // rules registered with createFormo({ rules })
rules: [{ rule: 'min', params: [8], message: 'Too short!' }]
required: true                                       // shortcut
```

**Built-in rules** (VeeValidate names, Kohana aliases in parentheses): `required` (`not_empty`), `email`, `url`, `min` (`min_length`), `max` (`max_length`), `length` (`exact_length`), `numeric` (`digit`), `integer`, `decimal`, `digits`, `between` (`range`), `min_value`, `max_value`, `regex` (PHP `/…/flags` strings work), `alpha`, `alpha_num` (`alpha_numeric`), `alpha_dash`, `alpha_spaces`, `is` (`equals`), `is_not`, `one_of` (`in_array`), `not_one_of`, `confirmed`/`matches` (both the Kohana `[':validation', 'a', 'b']` signature and `@field` refs), `date`, `phone`, `color`, `ip`, `min_items`, `max_items`, `ext`, `mimes`, `image`, `size`, `dimensions`, `upload_size` (`Upload::size`, `1M`), `html5_range` (`Formo::range`), Laravel's password helpers `mixed_case`, `letters`, `numbers`, `symbols` (`Password::mixedCase()`…), and Laravel's conditional rules `required_if`, `required_unless`, `required_with`, `required_with_all`, `required_without`, `required_without_all`, `exclude_if`, `exclude_unless` (see [Optional subforms](#optional-subforms--conditional-rules)). `Valid::…` prefixes are stripped.

**Params**: Kohana pseudo-params work: `:value`, `:field`/`:alias`, `:validation`/`:form_val`/`:values` (the group's values), `:form` (controller). `@other_field` references another field's value (sibling first, then from the form root). In messages it becomes that field's label.

**Group / form-level rules**: put `rules` on a group or the form. They receive the group's values and run only once all its fields pass (Formo semantics). The error renders at the top of the group (`errors[':self']`).

**Several rules on a field** run in order. By default the first failure stops the rest, as in Kohana. `errorDisplay: 'all'` runs them all and lists every failure, and `errorDisplay: 'checklist'` shows each one as a live requirement (see the next section). `form.allErrors` has every message per field.

**Messages** (like Formo's message files), first match wins:

1. the rule's own `message`
2. the field's `errorMessages[rule]`
3. `config.messages['path.rule']`, `['parent.alias.rule']`, `['alias.rule']`, `['alias.default']`
4. `config.messages[rule]`, then `default`

Placeholders: `:field` (label), `:value`, `:param1…`, `:params`, `:other` (confirmed/matches/required_if), Laravel's names (`:attribute`, `:min`, `:max`, `:size`, `:digits`, `:values`), or the `{field}` style. Unlike Kohana, `:param1` is the first real param, not the value.

A custom rule with a checklist `label` and no message uses its label as the message. Translations: see [i18n](#i18n).

**When to validate**: `config.validationMode`:

| Mode | Behavior |
| --- | --- |
| `eager` (default) | On blur, then on every change once the field was touched or has an error |
| `aggressive` | On every change |
| `lazy` | On blur (and on change while the field shows an error) |
| `submit` | Only on submit (errors still clear as you fix them) |

**Callbacks** run after validation, deepest first, like Formo's:

```ts
Formo.form({
  callbacks: {
    pass: { ':self': [({ values }) => track('ok')], email: [({ value }) => …] },
    fail: [({ form }) => console.log(form.errors)],
  },
})
```

A `pass` callback can veto by returning `false` or a message. Callbacks get `{ node, path, value, values, form, setError }`.

**Server errors**: `@submit="(values, { setErrors }) => …"`, or `form.setErrors(...)`, accepts flat paths or Formo's nested `errors()` format. `':self'` is the form itself.

## Error display & checklists

Each field shows its validation state in one of three ways (`errorDisplay` on the field, or as a default in `config.errorDisplay`):

| `errorDisplay` | Shows |
| --- | --- |
| `'first'` (default) | The first failing rule's message, like Formo/Kohana |
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

In Formo (PHP), a subform with `ignore` wasn't validated at all. formo-vue makes this reactive: the form's own values decide what's optional. An **ignored** field or subform is fully optional:

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

**Texts** are the strings you write in definitions: explicit labels, `message`s, option labels, placeholders/titles, button labels, `blank` options, `addLabel`s. Like Kohana's `__('Email')`, the text itself is the key. Rules that return a string message are translated the same way.

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
// <FormoForm :form="form" @success="(data) => …" @failure="(response) => …" />
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

## Overriding components

Each field's component is resolved in this order (first match wins):

| # | Mechanism | Scope | Example |
| - | --- | --- | --- |
| 1 | `#field:<path>` slot | one field, **everything** (label, errors…) | `<template #field:address.zip="f">…</template>` |
| 2 | `#control:<path>` slot | one field, **control only** (Formo keeps label/help/error) | `<template #control:phone="f">…</template>` |
| 3 | `component` on the field | one field | `{ alias: 'rating', component: StarRating }` |
| 4 | `components['driver\|type']` | a driver + input type | `components: { 'input\|date': DatePicker }` |
| 5 | `components[driver]` | a driver | `components: { checkbox: ToggleSwitch }` |
| 6 | the driver's component | everywhere | `createFormo({ drivers: { rating: { component: StarRating } } })` |

`components` can be given **app-wide** (`createFormo`), **per form** (`<FormoForm :components>`), or **per group** (`{ driver: 'group', components: {…} }`, cascading into the group). A field's `component` can also be a **name** registered in `components`, or a globally registered Vue component. That lets a schema from the server say `{ "component": "color-swatches" }`. Slot paths match exact paths (`phones[0].number`) or any row (`phones[].number`).

### Writing a custom control

Any `v-model` component works unchanged, including ones from UI libraries:

```ts
.add('rating', { component: StarRating, props: { max: 10 } })
```

- It receives `modelValue` and emits `update:modelValue` (and optionally `blur`).
- `id`, `name` and `aria-*` fall through to its root.
- Components with another contract declare it: `model: { prop: 'value', event: 'change' }`.

When a component needs more (the error, label, options, theme classes…), it has two options:

```vue
<script setup>
// a) ask for it — no props needed
import { useFormoField } from 'formo-vue'
const field = useFormoField()
// field.value, field.setValue(v), field.onBlur(), field.error, field.invalid, field.label,
// field.options (normalized opts), field.classes (resolved theme), field.attrs (id/name/aria),
// field.required, field.node (the definition, incl. custom vars), field.form (controller)
</script>
```

```vue
<script setup>
// b) declare a `formo` prop — Formo passes the same state object
defineProps<{ formo: FormoFieldState; modelValue?: boolean }>()
</script>
```

A component that puts `id` on an inner element should set `defineOptions({ inheritAttrs: false })`.

### New field types

```ts
createFormo({
  drivers: {
    tags: {
      component: TagInput,
      defaultValue: () => [],                 // value when the definition has no `val`
      display: (v) => v.join(', '),           // for editable: false
      layout: 'stacked',                      // 'stacked' | 'inline' (checkbox style) | 'bare'
      labelAs: 'label',                       // 'label' | 'title' (legend, for option groups) | false
      rules: (node, config) => ['min_items:1'],  // automatic rules (Formo pre_validate)
      model: { prop: 'modelValue', event: 'update:modelValue' },
    },
  },
})
// .add('keywords', 'tags')
```

### Wrappers, groups and the rest

- **The label/help/error chrome** (`FormoFieldWrapper`, i.e. `field_template.php`): replace per field with `wrapper: MyWrapper`, or everywhere with `components: { wrapper: MyWrapper }`. Drop it with `wrapper: false`. A wrapper gets the `formo` prop and renders the control through its default slot.
- **Groups / repeatable groups**: `component` on a group, or `components: { group: MyGroup, blueprint: MyRows }`. They receive `{ node, path, parentPath }`; use `useGroupSetup(props)` plus `<FormoChildren :fields="node.fields" :prefix="childPrefix" />` to keep namespaces, cascading and group errors working.
- **Uneditable display**: `components: { uneditable: MyReadonlyView }`.
- **Requirement checklists**: `components: { checklist: MyChecklist }`.
- The built-in controls (`FormoInput`, `FormoSelect`, `FormoChoices`…) are exported, so wrappers can reuse them.

## Theming

Every element takes its classes from a theme key (`control`, `controlInvalid`, `label`, `group`, `error`, `help`, `button`, `buttonPrimary`, `checkbox`, `blueprintRow`… see `src/core/theme.ts`). Layers merge with **tailwind-merge**, so an override only lists what changes:

```ts
createFormo({ theme: { control: 'rounded-none border-2' } })      // app-wide
<FormoForm :theme="{ label: 'uppercase tracking-wide' }" />       // per form
{ driver: 'group', theme: { … } }                                 // a group and its fields
{ alias: 'bio', classes: { control: 'font-mono' } }               // one field
{ alias: 'bio', attr: { class: 'w-1/2' } }                        // the control element
{ driver: 'group', classes: { groupBody: 'grid gap-4 sm:grid-cols-2' } }   // layouts
```

## Subforms, namespaces and repeatable groups

- Adding a form/group to a form nests its values (`{ address: { street } }`) and its names (`user[address][street]`), exactly like Formo's `namespaces`. Set `config: { namespaces: false }` on a group to keep it visual only.
- **Blueprints** (repeatable rows): `Formo.group('phones', { min: 1, max: 5, addLabel: 'Add phone' }).add('number').padBlueprint(rows)`. The value is an array of row objects; `rules` on the group validate the whole list.

## Migrating from PHP gradually

- **Keep your PHP form definitions**: `echo json_encode($form->to_array())` and render it with `<FormoForm :form="Formo.fromJSON(json)">`. Kohana rules, `_NOTSET` labels and `input|type` drivers are understood.
- **Keep your PHP controllers**: `<FormoForm native>` validates client-side, then submits the `<form>` natively to its `action`, with the CSRF `_token` and `_method` fields. Names are namespaced like Formo's (`user[address][street]`), checkboxes post `name[]`, file fields make the form `multipart/form-data`, and custom components get hidden inputs mirroring their value. `$form->load($_POST)->validate()` keeps working server-side.
- Port message files to `config.messages` (or per-locale `locales.xx.validation`) and label files to `config.labels` / `locales.xx.labels`. Laravel lang files can be used directly (see [i18n](#i18n)).

## Differences from Formo (PHP)

- No ORM driver / `Formo_ORM` trait; load model data with `val`/`v-model`/`form.load()`.
- No `sent()`: in the browser, submit is explicit.
- Message params: `:param1` is the first real param (Kohana's `:param1` was the value).
- `numeric` follows VeeValidate (digits only); use `decimal` for Kohana's `numeric`.
- Default ids are prefixed with the form alias (`user-email`) so several forms can share a page; an explicit `attr.id` still wins.
- Labels are humanized by default (`humanizeLabels: false` for raw aliases).
- Fields with `render: false` keep their values (like Formo) but aren't validated.
