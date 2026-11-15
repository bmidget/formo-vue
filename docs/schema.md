# Forms from Models & Schemas

`formo-vue/schema` builds a form straight from a model: every field, or only some (with overrides), with types, labels and validation already in place. A form can come from a Laravel FormRequest (through Inertia props or a schema endpoint), a JSON Schema, an OpenAPI document (Rails, Scramble, FastAPI…), or a Zod schema.

```ts
import { Formo, useFormo } from 'formo-vue'
import { fromLaravel } from 'formo-vue/schema'

const form = useFormo(
  Formo.fromModel(fromLaravel(props.userRules), {
    except: ['role'],
    fields: { bio: { attr: { rows: 6 } }, terms: { label: 'I accept the terms' } },
    mode: 'update',
    values: props.user,
  }),
)
```

<Demo name="from-models" />

The demo is a workbench:
- **Pick a source:** Laravel rules, a backend model, JSON Schema, OpenAPI or Zod. Edit the JSON sources live.
- **Set the options:** `mode`, `readOnly`, `validation`, `only` / `except`, `clientRules`.
- **Try it:** fill the form in and submit. It validates in the browser, then `form.request()` posts to a fake Laravel backend that runs in the page. The backend validates again, including what only a server can check (`unique:users` — `taken@example.com`, `admin` are taken), and answers 201 / 200, 422 (the errors land on the fields), 419 or 500. The request (method, URL, headers, body) and the response are shown next to the form. Each error is tagged with where it came from: a Formo rule, a field's Zod `.refine()`, an object-level refinement, Zod itself in schema mode, or the server. The **Events** panel logs `@success` / `@invalid` / `@rejected` (with its `reason`) / `@settled` as they fire.
- **JavaScript off:** *Post it like JavaScript is off* sends the form natively (same endpoint, same rules) and compares the browser's errors with the server's — see [below](#javascript-off-and-errors-from-the-server).
- **Code:** the complete component for your current choices, to copy into an app.
- **Room:** the **Full width** button hides "On this page" and gives the demo the whole screen.
- **Inspect:** the Formo model the adapter read, the definition `formFromModel()` returned, and the warnings.

## How it fits together

```
 Laravel rules ─────┐
 JSON Schema ───────┤  adapters    ┌──────────────────┐  formFromModel()    ┌─────────────────┐
 OpenAPI 3.0/3.1 ───┼────────────▶ │ Formo model      │ ──────────────────▶ │ form definition │ ─▶ useFormo / <FormoForm>
 Zod 4 ─────────────┤              │ (IR JSON, v1)    │  only / except /    │ (plain object)  │    Formo.fromModel() builder
 your backend ──────┘              └──────────────────┘  overrides / mode   └─────────────────┘
      └─────────────── formo-vue/schema: plain TypeScript, no Vue, no DOM ───────────────┘
```

- **Adapters** read a source into a **Formo model**. This is a neutral, versioned description of the data (not the UI): field types, constraints, labels, options, relations.
- **`formFromModel(model, options)`** picks the fields (`only` / `except`), maps each type to a driver, derives the rules, and applies your overrides. The result is a plain form definition, usable anywhere a definition is: `useFormo()`, `<FormoForm :form>`, `Formo.form()`.
- **`Formo.fromModel(model, options)`** does the same and returns a **builder**, so you can keep going: `.add()`, `.order()`, `.find('email').set(…)`, `.subform()`.
- **`formo-vue/schema` is plain TypeScript.** It never imports Vue, vee-validate, the DOM or any package (`bun run check:pure` and a test enforce it), so the same code can drive a React Native renderer later.

## The Formo model (IR JSON v1)

A backend can send a model directly, as an Inertia prop or from an endpoint. This is a **public, versioned contract**: `{ "version": 1 }`. It's described by [`formo-model.v1.schema.json`](https://github.com/bmidget/formo-vue/blob/main/src/schema/formo-model.v1.schema.json) (shipped in the package as `formo-vue/src/schema/formo-model.v1.schema.json`), so backend packages can test their output against it.

```json
{
  "version": 1,
  "name": "user",
  "fields": [
    { "name": "id", "type": "integer", "readOnly": true },
    { "name": "name", "type": "string", "label": "Full name", "required": true, "constraints": { "maxLength": 255 } },
    { "name": "email", "type": "string", "format": "email", "required": true, "serverRules": ["unique:users,email"] },
    { "name": "role", "type": "enum", "options": [{ "value": "admin", "label": "Administrator" }, { "value": "editor" }] },
    { "name": "team_id", "type": "relation", "relation": { "kind": "belongsTo", "model": "teams" } },
    { "name": "address", "type": "object", "fields": [{ "name": "street", "type": "string" }] },
    { "name": "phones", "type": "array", "constraints": { "maxItems": 3 },
      "items": { "type": "object", "fields": [{ "name": "number", "type": "string", "format": "tel" }] } },
    { "name": "password", "type": "string", "format": "password", "writeOnly": true, "constraints": { "minLength": 8 } },
    { "name": "company", "type": "string", "rules": ["required_if:account_type,business"] }
  ],
  "messages": { "email.required": "We need your email" }
}
```

| Key | Meaning |
| --- | --- |
| `type` | `string`, `text`, `integer`, `number`, `boolean`, `date`, `datetime`, `time`, `enum`, `file`, `object`, `array`, `relation`, `unknown` |
| `format` | Refines `type`: `email`, `url`, `password`, `tel`, `color`, `uuid`, `ip`, `search`… |
| `required` | Must be **filled**, not just present (Laravel semantics — a form always sends its fields) |
| `nullable` | Empty means `null` |
| `constraints` | `minLength` `maxLength` · `min` `max` `exclusiveMin` `exclusiveMax` `step` · `pattern` · `minItems` `maxItems` · `maxSize` (KB) `extensions` `mimeTypes` · `accepted` |
| `rules` | Extra client-side rules in Formo notation: conditional (`required_if:…`), cross-field (`matches:@password`, `gte:@start`) |
| `serverRules` | Informative only: checked by the server (`unique`, `exists`), never run in the browser |
| `readOnly` / `writeOnly` / `fillable` | Server-set / never sent back (passwords) / not mass-assignable |
| `options`, `relation`, `fields`, `items` | Choices, foreign keys, subform fields, list elements |
| `label`, `description`, `placeholder`, `default`, `messages` | What the user sees |
| `ui` | Formo definition keys merged over what's generated (`driver`, `component`, `view`, `attr`…) |

**Compatibility.** Version 1 only ever changes additively: new optional keys and new formats. Readers ignore keys they don't know and read an unknown `type` as `unknown`, with a warning. Anything that would change the meaning of existing keys bumps the version, and `parseModel()` rejects versions it doesn't know.

## What each type becomes

| Model | Driver | Rules & attributes |
| --- | --- | --- |
| `string` | `text` (`email`, `url`, `password`, `tel`, `color`, `search` by `format`) | `min` / `max` (+ `maxlength`), `regex`, format rules; `textarea` when `maxLength` > 255 |
| `text` | `textarea` | as `string` |
| `integer` / `number` | `number` | `integer`, `min_value` / `max_value`, `gt` / `lt`, `step` |
| `boolean` | `checkbox` | `accepted` when it must be checked (a "required" boolean only has to be present) |
| `date` / `datetime` / `time` | `date` / `datetime-local` / `time` | |
| `enum` | `select` (`radios` with `policy.radiosUpTo`) | options, labels humanized when missing |
| `array` of `enum` / `relation` | `checkboxes` | `min_items` / `max_items` |
| `file`, `array` of `file` | `file` (`multiple`) | `size` (KB), `ext`, `mimes`, `accept` |
| `relation` | `select` (`checkboxes` for many) | options from `options: { path: [...] }` |
| `object` | a subform | |
| `array` of `object` | repeatable rows (blueprint) | `min` (`required` = at least one) / `max` |
| `unknown`, lists of plain values | skipped, with a warning, unless you give them a control | |

Change the mapping app-wide with `policy`: `{ textareaAbove: 500, radiosUpTo: 4, driverFor: (field, proposed, path) => … }`.

## `formFromModel()` / `Formo.fromModel()` options

```ts
formFromModel(model, {
  attr: { action: '/users/7', method: 'put' }, // where it posts — also with JavaScript off
  rootKey: 'user',                          // only if the server wants user[email] / { user: {…} } (Rails)
  only: ['name', 'email', 'address'],       // dotted paths: 'address' = the whole subform, 'address.zip' = just zip ([] = all)
  except: ['password', 'phones.*.note'],    // `*` for list items is optional: 'phones.note' works too
  fields: {                                 // overrides, by dotted path or nested — and additions
    role: { driver: 'radios' },             // merged: rules / opts / val replace, attr / props / errorMessages merge
    bio: false,                             // leave it out
    email: (generated, field) => ({ ...generated, rules: [...(generated.rules ?? []), 'username_available'] }),
    'address.zip': { label: 'Postcode' },
    terms: { driver: 'checkbox', required: true }, // not in the model: added
  },
  order: ['email', 'name', 'address.zip'],  // these first (inside subforms too)
  mode: 'update',                           // see below
  readOnly: 'uneditable',                   // or 'omit'
  metadata: ['id', 'created_at', 'updated_at'], // the defaults — false keeps them
  options: { team_id: teams },              // options for relations / enums, by path
  values: props.user,                       // load a record (see below)
  validation: 'derived',                    // 'schema' | 'none'
  policy: { radiosUpTo: 4 },
  onWarning: (w) => {},                     // default: console.warn, once per message
})
```

- **Bookkeeping fields** (`id`, `created_at`, `updated_at`, `deleted_at`, `email_verified_at`, `remember_token`…) stay out unless you ask for them by listing them in `only` or giving them an override. In repeatable rows, `id` becomes a hidden field, so existing rows keep their identity. It stays even when `only` narrows inside the rows (`only: ['phones.number']`), unless `except` names it.
- **Guarded fields** (`fillable: false`) never appear unless asked for explicitly, and then with a warning.
- **Update forms** (`mode: 'update'`):
  - Read-only fields are shown as text (`editable: false`, the theme's `uneditable` view). They're not validated and not submitted; `readOnly: 'omit'` leaves them out instead. In create forms, they're left out by default.
  - Write-only fields (passwords) become optional, and when left empty they're not submitted ("leave blank to keep the current password"). Their confirmation field follows them.
- **Loading a record:** `values: props.user`, or `toFormValues(model, record, { form })`.
  - Dates, datetimes and times are converted to what their inputs need (`2024-05-01T09:30:00.000000Z` becomes `2024-05-01`, or local time for `datetime-local`).
  - Relations become keys (`team: { id: 3 }` becomes `team_id: 3`), decimal strings become numbers, and `0`/`1` become booleans.
  - Passwords and files are never pre-filled.
  - Only the values of fields the form has are kept, so whatever `only` / `except` leave out is never submitted.
- **Warnings**, never silent drops: unsupported rules and keywords, types without a control, paths that match nothing, relations without options. Pass `onWarning` to collect them (in tests, say) or to silence them.

## JavaScript off, and errors from the server

The browser's validation is a convenience; the server's is the one that counts. A form from a model is built so that both see the same thing.

- **Same keys.** Inputs are named after the model's keys: `email`, `address[street]`, `phones[0][number]`, `tags[]`. That's what a FormRequest (or an API) validates, and what a native post sends. JSON requests (`request()`) use the same keys. If your server expects wrapped params (Rails' `params.require(:user)`), pass `rootKey: 'user'`; names, JSON bodies and the error keys read back all use it. (Forms not made from a model keep Formo's naming, `user[email]` after the form alias. The `namePrefix` config controls it: `false` for bare names.)
- **It can post without JavaScript.** Give the form an action: `attr: { action, method }`. A `PUT` / `PATCH` / `DELETE` form renders a hidden `_method`, and `_token` is rendered too. For server-rendered pages (Inertia SSR, Nuxt), pass the token as a string, `config: { csrf: { token: props.csrfToken } }`, so it's in the HTML; meta tags and cookies are only read in the browser. With JavaScript on, the same form sends itself with `request()` when it has no `@submit` handler.
- **The server's errors come back onto the same fields**, whichever way they arrive:
  - from `request()`: a 422's `errors` map onto the fields automatically;
  - from Inertia: `form.setErrors(errors)`, or `useFormo(definition, { errors: props.errors })` when the page loads;
  - from a server-rendered page after a redirect: `useFormo(definition, { errors })` with what the server put in the page (`$errors->getMessages()`), plus `values` set to the old input.

  Laravel's keys work as they are: `phones.0.number` lands on the first phone row, and `user.email` with a `rootKey`. Messages may be strings or lists. A key no field has becomes the form's error.

The workbench's **Post it like JavaScript is off** button does exactly this. It posts the `<form>`'s own fields, the server validates them with the same rules, and its errors are handed back through `setErrors()`. A table then compares, field by field, what the browser said with what the server said. The differences you'll see are expected ones:

- **Server-only rules** (`unique:users`): only the server can check them.
- **Confirmations:** Formo shows a mismatch on `password_confirmation`, while Laravel reports it on `password`. Same check, different field.
- **Zod refinements:** a backend that runs the same schema reports them too.
- **Update forms:** an empty password isn't submitted by `request()`, but a native post sends it empty. Your update request needs `nullable` on it, as Laravel update requests have.

## Validation: derived rules, schema refinements

By default (`validation: 'derived'`), Formo's own rules are derived from the model's constraints. That keeps Formo's messages, **checklists**, **live locale switching** and **Laravel lang files** (`laravelI18n()`) working out of the box. A Laravel `max:255` on a string becomes Formo's `max:255`, whose message comes from `validation.max.string`.

With Zod, what Formo can't express still runs through Zod:

- A field's `.refine()` / `.superRefine()` runs as that field's last rule, live, after Formo's rules. Only the refinement's message is shown; "too short" stays Formo's job.
- Object-level refinements run when the form validates, and their `path` puts the error on the right field, including inside rows (`phones[0].number`). Issues on fields the form doesn't have, or that are ignored right now, are skipped. That form-level pass is only added when some object (the root, a subform, a list or its rows) actually has a refinement.
- `fromZod(schema, { onRefinement })` is called with `{ path, message, level: 'field' | 'form' }` whenever a refinement fails. Use it for debugging or logging; the playground's workbench uses it to tag each error with where it came from.

`validation: 'schema'` makes the schema the only validator: Zod's messages, no rules derived from input types or HTML attributes. Required fields keep their `*` marker. `validation: 'none'` leaves validation to the server, whose 422 errors still map onto the fields.

Empty inputs are read the Zod way before parsing: `''` becomes `undefined` (or `null` for `.nullable()` fields), so `.optional()` fields accept an empty input.

## Laravel

### Rules, attributes, messages (no backend package needed)

`fromLaravel({ rules, attributes, messages })` reads what a FormRequest already has:

- **Types come from the rules:**
  - `string`, `integer`, `numeric`/`decimal` → `number`, `boolean`, `accepted`
  - `date` / `date_format:` (→ `date`, `datetime` or `time`)
  - `email`, `url`, `uuid`, `ip`, `hex_color`
  - `file` / `image` / `mimes` (extensions) / `mimetypes`
  - `in:` → a choice, `array`, and `exists:` on a `*_id` field → a relation
- **`min` / `max` / `between` / `size` follow the type**, like Laravel: length for strings, value for numbers, item count for arrays, kilobytes for files. Laravel's `numeric` is Formo's `decimal`.
- **Nested keys:** `address.street` → a subform. `phones.*.number` → repeatable rows (a `phones.*.type` reference in a rule means the same row). `tags.*` with `in:` → checkboxes. `photos.*` with `image` → a multiple file input.
- **`confirmed`** adds the `password_confirmation` field Laravel expects (or `confirmed:repeat_password`).
- **Client-side rules:** `required_if` / `_unless` / `_with` / `_with_all` / `_without` / `_without_all`, `exclude_if` / `_unless`, `same`, `different`, `gt` / `gte` / `lt` / `lte`, `not_in`, `regex`, `digits`, `digits_between`, `alpha*` all run in the browser.
- **Server-only rules** — `unique`, `exists`, `current_password`, `after:today`… — are kept in `serverRules` and never run in the browser; their errors come back with the 422. Rules without a client-side equivalent are reported (register yours with `createFormo({ rules })` and list them in `clientRules` to run them in the browser).
- **`attributes()` and `messages()`:** `attributes()` become labels. `messages()` become error messages, with Laravel's rule names translated to Formo's (`age.min` on a number → `age.min_value`, `min.string` → `min`).

Rule objects don't survive `json_encode` (they become `{}`). Send them as strings; `Rule::in()`, `Rule::unique()` and `Rule::exists()` are `Stringable`. Those without a string form — `Password::min(8)`, `Rule::enum()`, `File::types()`, closures — are left out. Describe those fields in a [Formo model](#a-model-endpoint) or with an override.

```php

// app/Support/FormoRules.php — rules as the client reads them
final class FormoRules
{
    public static function from(FormRequest $request): array
    {
        $stringify = fn ($rules) => collect(is_string($rules) ? explode('|', $rules) : $rules)
            ->filter(fn ($rule) => is_string($rule) || $rule instanceof Stringable)
            ->map(fn ($rule) => (string) $rule)->values()->all();

        return [
            'rules' => array_map($stringify, $request->rules()),
            'attributes' => $request->attributes(),
            'messages' => $request->messages(),
        ];
    }
}
```

### With Inertia

```php
return Inertia::render('Users/Edit', [
    'user' => $user,
    // createFrom(): rules() can read the route and the user, and nothing is validated yet
    'rules' => FormoRules::from(UpdateUserRequest::createFrom(request())),
]);
```

```vue
<script setup lang="ts">
import { Formo, FormoForm, useFormo, type FormoOutcome, type FormoSubmitContext } from 'formo-vue'
import { fromLaravel, type LaravelRulesInput } from 'formo-vue/schema'
import { router } from '@inertiajs/vue3'
import { toast } from './toast' // your notifications

const props = defineProps<{ user: Record<string, any>; rules: LaravelRulesInput; errors?: Record<string, string> }>()

const form = useFormo(
  Formo.fromModel(fromLaravel({ ...props.rules, name: 'user' }), {
    attr: { action: `/users/${props.user.id}`, method: 'put' },
    mode: 'update',
    values: props.user,
  }),
  { errors: props.errors }, // the errors of a failed post (JavaScript off too)
)

// Return a promise: the outcome (and the spinning submit button) waits for Inertia.
// Its errors use Laravel's keys (phones.0.number): setErrors() reads them as they are.
function save(values: Record<string, unknown>, { setErrors }: FormoSubmitContext) {
  return new Promise<boolean>((resolve) =>
    router.put(`/users/${props.user.id}`, values, {
      onSuccess: () => resolve(true),
      onError: (errors) => {
        setErrors(errors) // → @rejected, reason 'validation'
        resolve(false)
      },
    }),
  )
}

function refused(outcome: FormoOutcome) {
  // the errors are already on the fields; outcome.reason: 'validation' | 'session' | 'server' | 'handler' | 'error'
  if (outcome.reason !== 'validation') toast('Could not save — please try again')
}
</script>

<template>
  <FormoForm :form="form" @submit="save" @success="toast('Saved')" @rejected="refused" />
</template>
```

Every submit ends with one of `@success(data, outcome)`, `@invalid(errors, outcome)` (the browser's validation stopped it, nothing was sent) or `@rejected(outcome)` (sent, but refused: `outcome.reason` is `validation`, `session`, `server`, `handler` or `error`), then `@settled(outcome)`. See the README's *Submit outcomes*.

### A model endpoint

A backend that sends the IR JSON itself — built from the table's columns (`Schema::getColumns()`), `$casts` (enums with their labels), `$fillable` / `$hidden` and the FormRequest — can be read as is:

```ts
import { parseModel } from 'formo-vue/schema'
const model = parseModel(await (await fetch('/formo/models/user')).json())
const form = useFormo(Formo.fromModel(model, { only: ['name', 'email', 'team_id'] }))
```

The same JSON works as an Inertia prop. Validate what the backend emits against `formo-model.v1.schema.json` in its tests.

## JSON Schema & OpenAPI

```ts
import { fromJsonSchema, fromOpenApi } from 'formo-vue/schema'

fromJsonSchema(schema, { name: 'user' })                  // draft-07 → 2020-12
fromJsonSchema(doc, { root: 'User' })                     // a $defs / definitions entry
fromOpenApi(openapi, { operation: 'POST /users' })        // the request body (or an operationId)
fromOpenApi(openapi, { schema: 'User' })                  // #/components/schemas/User
```

Understood:
- **Structure:** `properties` / `required`, local `$ref`s (cycles stop with a warning), `allOf`.
- **Nullable:** `type: [x, 'null']`, `anyOf` with `{ type: 'null' }`, and OpenAPI 3.0's `nullable`.
- **Labelled choices:** `oneOf: [{ const, title }]` and `x-enumNames`.
- **Text:** `title` → label, `description` → help, `examples` → placeholder; `default`; `readOnly` / `writeOnly`.
- **Formats** (`email`, `uri`, `date`, `date-time`, `time`, `binary`, `password`, `uuid`…) and every length / range / item / pattern constraint.
- **Integer bounds:** exclusive bounds become inclusive ones. Zod's safe-integer bounds are ignored.
- **`dependentRequired`** → `required_with`.
- **`x-formo`:** Formo keys, merged last.

`if` / `then` / `else`, `not`, tuples and unions of different shapes are reported and skipped. OpenAPI request bodies are read as JSON, multipart or urlencoded (`format: binary` is a file upload). Swagger 2 isn't supported.

## Zod

```ts
import { z } from 'zod'
import { fromZod } from 'formo-vue/schema'

const Signup = z.object({
  email: z.email().meta({ title: 'E-mail' }),
  password: z.string().min(8).refine((v) => /\d/.test(v), 'Add a number'),
  password_confirmation: z.string(),
}).refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Passwords differ' })

const form = useFormo(Formo.fromModel(fromZod(Signup, { toJSONSchema: z.toJSONSchema })))
```

`formo-vue` doesn't depend on Zod. The schema is read through its JSON Schema (`z.toJSONSchema`, with `io: 'input'`) and run through `safeParseAsync`. Pass `toJSONSchema` unless the schema can produce its JSON Schema itself. `.meta({ title, description, examples })` and `.describe()` give labels, help texts and placeholders. `.meta({ 'x-formo': { … } })` passes Formo keys. `z.date()` fields become date inputs.

## Pure & portable

`formo-vue/schema` (and the single module it shares with the Vue side, `core/utils`) is checked two ways:

- `bun run check:pure` walks its import graph and fails on any package import (Vue included, even `import type`), `.vue` files, `import.meta` (which Metro / Hermes don't support), or DOM / Node globals. It then type-checks it with `lib: ["ES2022"]` only (`tsconfig.schema.json`).
- `tests/schema-purity.test.ts` runs the same graph check under `bun run test`.

That's what will let it move to `@formo/core` / `@formo/schema` packages for a React Native renderer without a rewrite.
