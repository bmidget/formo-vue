---
aside: false
---

# Advanced

## Repeatable Groups (Blueprints)

Formo blueprints let users add and remove rows with `min`/`max` bounds, pre-filled rows, and validation over the whole list:

<Demo name="blueprints" />

## CSRF & Laravel

`formo-vue` supports both **Sanctum SPA** requests (`csrf: 'sanctum'`, reading `XSRF-TOKEN` into `X-XSRF-TOKEN`, retrying 419s, and mapping Laravel 422 `errors`) and **Blade-style native posts** (`<FormoForm native>`, injecting hidden `_token` from `<meta name="csrf-token">` and `_method`):

<Demo name="laravel" />

## Forms from Models & Schemas

Build a form from Laravel FormRequest rules, a backend model (IR JSON v1 — an Inertia prop or an endpoint), JSON Schema, OpenAPI or Zod, with `only` / `except` / overrides. See [Forms from Models & Schemas](/schema).

## Submit Outcomes & Live Values

Every submit ends as `success`, `invalid` (the browser stopped it, nothing was sent) or `rejected` (sent, but refused: `outcome.reason` is `validation`, `session`, `server`, `handler` or `error`). `<FormoForm>` fires `@success`, `@invalid` or `@rejected`, then `@settled`. The outcome is worked out from what happened during the submit — a request made with `ctx.request()`, errors set, `ctx.reject()`, a thrown error — so `@submit` doesn't have to report it. Callback APIs like Inertia's router return a promise that settles when they do.

Values from outside stay live: with `initialValues` as a ref or getter, or a reactive definition (`() => Formo.fromModel(model, { values: props.user })`), the fields not changed in the form follow the new values. The user's edits are kept. See the README's *Submit outcomes* and *Values from outside*.
