# Advanced & Migration

## Repeatable Groups (Blueprints)

Formo blueprints let users add and remove rows with `min`/`max` bounds, pre-filled rows, and validation over the whole list:

<Demo name="blueprints" />

## CSRF & Laravel

`formo-vue` supports both **Sanctum SPA** requests (`csrf: 'sanctum'`, reading `XSRF-TOKEN` into `X-XSRF-TOKEN`, retrying 419s, and mapping Laravel 422 `errors`) and **Blade-style native posts** (`<FormoForm native>`, injecting hidden `_token` from `<meta name="csrf-token">` and `_method`):

<Demo name="laravel" />

## Migrating from PHP `to_array()`

Render JSON exported directly from Formo (PHP) `$form->to_array()` for a gradual migration path:

<Demo name="from-php" />
