---
aside: false
---

# Getting Started

`formo-vue` brings Formo's **"forms as objects"** model to Vue 3, backed by VeeValidate and Tailwind CSS.

## Installation

```bash
bun add formo-vue vee-validate
```

Register the plugin in your app entry (`src/main.ts`) if you want app-wide defaults (custom components, drivers, rules, theme, or labels):

```ts
import { createApp } from 'vue'
import { createFormo } from 'formo-vue'
import App from './App.vue'

const app = createApp(App)
app.use(createFormo())
app.mount('#app')
```

`<FormoForm>` and `<FormoField>` also work standalone without `app.use(createFormo())`.

## Your First Form

Define a form as a nested object (or with the `Formo` builder), wrap it in `useFormo()`, and pass it to `<FormoForm>`:

<Demo name="getting-started" />

## Rendering with `useFormo()`

`useFormo(definition, options?)` creates a reactive form controller (`form.values`, `form.errors`, `form.valid`, `form.dirty`, `form.submitting`, `form.submit()`, `form.reset()`, `form.setErrors()`).

You can also pass a raw schema object or `Formo` builder directly to `<FormoForm :form="definition" />` when you don't need external access to `form.values` or `form.errors`.
