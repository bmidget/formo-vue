---
aside: false
---

# Formo × Nuxt UI

`formo-vue/nuxt-ui` renders Formo's fields with [Nuxt UI](https://ui.nuxt.com) (v4)
components: every field in a `UFormField`, with `UInput`, `USelect`, `UCheckbox`…
as controls. You keep Formo's form object (definitions, rules, errors, subforms,
repeatable groups, `form.fields`, CSRF…) and every customization point: slots,
views, parts, `components`, per-field `props`.

**`@nuxt/ui` is not a dependency of formo-vue.** The subpath never imports it:
you pass your Nuxt UI components in. Apps that don't use Nuxt UI never install
it, and yours stays configured the way you configure it (`app.config.ts`,
`ui` props, colors, icons).

- [Setup](#setup)
- [What renders what](#what-renders-what)
- [Swapping controls: USelectMenu, USwitch](#swapping-controls-uselectmenu-uswitch)
- [Styling one field](#styling-one-field)
- [Your own markup](#your-own-markup)
- [Going further](#going-further)

## Live Demo

<Demo name="nuxt-ui" />

## Setup

### Nuxt

```ts
// plugins/formo.ts
import { createFormo } from 'formo-vue'
import { nuxtUiTheme } from 'formo-vue/nuxt-ui'
import {
  UButton, UCheckbox, UCheckboxGroup, UFormField, UInput,
  URadioGroup, USelect, USelectMenu, USwitch, UTextarea,
} from '#components'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(
    createFormo({
      theme: nuxtUiTheme({ UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton }),
    }),
  )
})
```

### Vue + Vite

With Nuxt UI's Vite plugin set up ([Nuxt UI's Vue installation](https://ui.nuxt.com/docs/getting-started/installation/vue)):

```ts
// main.ts
import { createFormo } from 'formo-vue'
import { nuxtUiTheme } from 'formo-vue/nuxt-ui'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import UCheckboxGroup from '@nuxt/ui/components/CheckboxGroup.vue'
import UButton from '@nuxt/ui/components/Button.vue'

app.use(createFormo({
  theme: nuxtUiTheme({ UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton }),
}))
```

> In plain Vue, Nuxt UI's components import `vue-router` (install it, or see Nuxt
> UI's docs for router-less setups).

Tailwind must see formo-vue's classes (its views use Nuxt UI's semantic classes
like `text-muted`, `ring-default`): add `@source "../node_modules/formo-vue/src";`
to your CSS, next to `@import "@nuxt/ui";`.

Per form instead of app-wide: `<FormoForm :form="form" :theme="nuxtUi" />`, or on a
subform: `{ fields: {…}, theme: nuxtUi }`.

### Which components are required

`UFormField`, `UInput`, `UTextarea`, `USelect`, `UCheckbox`, `URadioGroup` and
`UCheckboxGroup`. Optional: `USelectMenu` (registered as `select-menu`),
`USwitch` (`switch`), `UButton` (buttons — otherwise Formo's own button, in
Nuxt UI classes).

## What renders what

| Formo | Nuxt UI | Notes |
| --- | --- | --- |
| the `field` view | `UFormField` | label (+ `required` asterisk), control, then the error — or the help (`message`) |
| `input` driver (`email`, `password`, `number`…) | `UInput` | `type` passed; numbers come back as numbers |
| `textarea` | `UTextarea` | |
| `select` | `USelect` | options → `items` (optgroups → groups), `blank: 'Choose…'` → `placeholder`, `attr.multiple` → `multiple` |
| `checkbox` / `bool` | `UCheckbox` | its own `label` (so no label around it) |
| `radios` | `URadioGroup` | `items`, its own `legend`; `inline: true` → horizontal |
| `checkboxes`, `set` | `UCheckboxGroup` | `set` (comma-separated string) converted both ways |
| `button` | `UButton` | `type`, `label`, spins while a submit is pending |
| hidden, range, color, file, datalist | Formo's own | styled with Nuxt UI classes (`nuxtUiClasses`) |
| subforms, repeatable groups, checklists, error summary | Formo's own views | styled with Nuxt UI classes |

Wiring you get for free:

- **Ids and labels**: the control gets Formo's id, and `UFormField`'s label points to it.
- **Errors**: `UFormField` shows Formo's error (same message, `errorDisplay: 'all'` lists them); inputs take Nuxt UI's error look (`color: 'error'`, `highlight`), `aria-invalid` and `aria-describedby`.
- **Validation timing**: Nuxt UI's `update:modelValue` / `blur` drive Formo's `validationMode`. `<UForm>` isn't used — Formo is the form.
- **Native submits** (`<FormoForm native>`): Nuxt UI controls post their own values under Formo's names (`account[email]`).

## Swapping controls: USelectMenu, USwitch

The theme registers `select-menu` (USelectMenu, searchable) and `switch` (USwitch) by name:

```ts
// one field
country: { driver: 'select', component: 'select-menu', opts: countries },
newsletter: { driver: 'bool', component: 'switch', label: 'Send me the newsletter' },
```

```vue
<!-- every checkbox of one form (or: createFormo({ components: { checkbox: 'switch' } }), or a subform's `components`) -->
<FormoForm :form="form" :components="{ checkbox: 'switch', select: 'select-menu' }" />
```

Any other Nuxt UI component works the same way, with `defineControl()` —
the props it needs computed from the field:

```ts
import { defineControl } from 'formo-vue'
import { toItems } from 'formo-vue/nuxt-ui'

createFormo({
  theme: nuxtUiTheme({ /* … */ }),
  components: {
    'input|number': defineControl({
      component: UInputNumber,
      props: (field) => ({ color: field.invalid ? 'error' : undefined }),
      native: true,
    }),
    tags: defineControl({ component: UInputTags, native: true }),          // a new driver: { driver: 'tags' }
    'multi-select': defineControl({
      component: USelectMenu,
      props: (field) => ({ items: toItems(field.options), multiple: true }),
      native: true,
    }),
  },
})
```

## Styling one field

Nuxt UI styles its components itself (`app.config.ts` → `ui`), so per-field
styling goes through Nuxt UI's props — Formo passes a field's `props` to its control:

```ts
email: { driver: 'email', props: { size: 'xl', variant: 'soft', icon: 'i-lucide-at-sign' } },
bio: { driver: 'textarea', props: { autoresize: true, ui: { base: 'font-mono' } } },
```

Formo's own elements (subforms, repeatable rows, checklists…) take `classes`, as
always: `{ fields: {…}, classes: { group: 'ring-primary/50' } }`.

## Your own markup

Everything from the main README works, with Nuxt UI's rendering:

```vue
<!-- Around the control, keeping the UFormField -->
<FormoField :field="form.fields.price">
  <template #input>
    <UFieldGroup><UBadge label="$" color="neutral" variant="outline" /><FormoInput /></UFieldGroup>
  </template>
</FormoField>

<!-- Your own markup for the whole field: the parts render Nuxt UI-styled, wired to the field -->
<FormoField :field="form.fields.username" v-slot="{ field }">
  <UCard>
    <FormoLabel :field="field" />
    <FormoInput :field="field" />          <!-- a UInput, red when invalid -->
    <FormoErrors :field="field" />
  </UCard>
</FormoField>
```

Swap the views themselves like any theme's: `views: { field: MyNuxtField }`, or
extend it — `defineTheme({ extends: nuxtUiTheme({…}), views: {…} })`.

## Going further

- `nuxtUiClasses` — the class map (Nuxt UI's semantic colors) of Formo's own elements; override keys with `classes`.
- `toItems(field.options)` — Formo options → Nuxt UI `items`, optgroups as groups.
- The playground's *Nuxt UI* example runs against stubs shaped like Nuxt UI's components (`playground/stubs/nuxt-ui`), so this repo never installs `@nuxt/ui`.
