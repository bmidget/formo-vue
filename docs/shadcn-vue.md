# Formo × shadcn-vue

shadcn-vue components live in your project (`components/ui/*`), so a package
can't import them. Formo ships its shadcn-vue integration the shadcn way: a
**registry item** that copies a small Formo theme into your
`components/ui/formo/` — yours to read and edit — built on the shadcn-vue
components you already have.

You keep Formo's form object (definitions, rules, errors, subforms, repeatable
groups, `form.fields`, CSRF…) and every customization point: slots, views,
parts, `components`, per-field `props`.

- [Install](#install)
- [What renders what](#what-renders-what)
- [Swapping controls: Switch](#swapping-controls-switch)
- [Just the look: `shadcnClasses`](#just-the-look-shadcnclasses)
- [Your own markup](#your-own-markup)
- [Editing the theme](#editing-the-theme)
- [How the registry item is built](#how-the-registry-item-is-built)

## Install

```bash
npm i formo-vue vee-validate
npx shadcn-vue@latest add https://raw.githubusercontent.com/<owner>/formo-vue/main/registry/r/formo.json
```

(Replace `<owner>` with the GitHub account hosting formo-vue.) The CLI adds the
shadcn-vue components it builds on — `input`, `textarea`, `label`, `select`,
`checkbox`, `switch`, `radio-group` — and writes:

```
components/ui/formo/
├── theme.ts                 shadcnTheme: which view / control renders what
├── FormoFieldView.vue       the field layout (like FormItem): label, control, description, message
├── FormoInlineView.vue      checkbox / switch row: control, then its label
├── FormoLabelView.vue       your <Label>, red when invalid (like FormLabel)
├── FormoHelpView.vue        like FormDescription
├── FormoErrorsView.vue      like FormMessage
├── FormoSelect.vue          a field's options → your <Select> (optgroups, placeholder, multiple)
├── FormoRadioGroup.vue      → your <RadioGroup>
├── FormoCheckboxGroup.vue   → your <Checkbox>es
└── index.ts
```

The files import your components from `@/components/ui/*` (shadcn-vue's
default alias — adjust the imports if your `components.json` uses another one).
Prefer copying by hand? Copy [`registry/shadcn-vue/formo`](../registry/shadcn-vue/formo) — it's the same code.

Then use the theme:

```ts
// main.ts (Nuxt: a plugin)
import { createFormo } from 'formo-vue'
import { shadcnTheme } from '@/components/ui/formo'

app.use(createFormo({ theme: shadcnTheme }))
```

…or per form: `<FormoForm :form="form" :theme="shadcnTheme" />`, or on a subform: `{ fields: {…}, theme: shadcnTheme }`.

Tailwind must see formo-vue's classes: add `@source "../node_modules/formo-vue/src";` to your CSS.

## What renders what

| Formo | shadcn-vue | Notes |
| --- | --- | --- |
| the `field` view | `FormoFieldView` (like `FormItem`) | label, control, description (`message`), checklist, message (errors) |
| the `label` part | `Label` | `for` the control; `data-error` turns it red like `FormLabel` |
| `input` driver (`email`, `password`, `number`…) | `Input` | `type` passed; numbers come back as numbers |
| `textarea` | `Textarea` | |
| `select` | `Select` (`FormoSelect`) | options + optgroups, `blank: 'Pick one'` → placeholder, `attr.multiple` |
| `checkbox` / `bool` | `Checkbox` | in a row with its `Label` |
| `radios` | `RadioGroup` (`FormoRadioGroup`) | under a `<legend>`; `inline: true` → a row |
| `checkboxes`, `set` | `Checkbox`es (`FormoCheckboxGroup`) | `set` (comma-separated string) converted both ways |
| buttons, hidden, range, color, file, datalist | Formo's own | styled with `shadcnClasses` |
| subforms, repeatable groups, checklists, error summary | Formo's own views | styled with `shadcnClasses` |

Wiring you get for free:

- **Ids, labels, aria**: Formo's ids on your components, `for` on labels, `aria-describedby` to the description and the message — and `aria-invalid`, which is what shadcn's components style their error state from (`aria-invalid:border-destructive`).
- **Validation**: Formo's (VeeValidate underneath). shadcn-vue's `<Form>` / `<FormField>` aren't used — Formo is the form, and mixing in their ids would break the wiring.
- **Native submits** (`<FormoForm native>`): the components post their own values under Formo's names (Reka UI's hidden inputs).

## Swapping controls: Switch

The theme registers `switch` by name:

```ts
newsletter: { driver: 'bool', component: 'switch', label: 'Email me the newsletter' },
```

```vue
<!-- every checkbox of one form (or createFormo({ components: … }), or a subform's `components`) -->
<FormoForm :form="form" :theme="shadcnTheme" :components="{ checkbox: 'switch' }" />
```

Add your own in `theme.ts` — any component, with `defineControl()`:

```ts
components: {
  // …
  combobox: defineControl({ component: FormoCombobox, native: true }),   // { driver: 'select', component: 'combobox' }
  'input|date': defineControl({ component: FormoDatePicker }),
}
```

A control gets `modelValue` / `update:modelValue`, Formo's `id`, `name` and
`aria-*` as attributes, and `useFormoField()` for everything else (options,
label, invalid…) — see `FormoSelect.vue` for a complete example.

## Just the look: `shadcnClasses`

No components to install: Formo's own controls, in shadcn's design tokens
(`border-input`, `text-muted-foreground`, `ring-ring`, `text-destructive`…):

```ts
import { createFormo, defineTheme, shadcnClasses, tailwindMergeClasses } from 'formo-vue'

app.use(createFormo({ theme: defineTheme({ name: 'shadcn', classes: shadcnClasses, mergeClasses: tailwindMergeClasses }) }))
```

`shadcnTheme` uses the same classes for everything it doesn't render with your components.

## Your own markup

Everything from the main README works, with your components:

```vue
<FormoField :field="form.fields.role" v-slot="{ field }">
  <div class="grid gap-2 rounded-lg border p-4">
    <div class="flex justify-between"><FormoLabel :field="field" /><span class="text-xs text-muted-foreground">Public</span></div>
    <FormoInput :field="field" />              <!-- your <Select>, wired -->
    <FormoErrors :field="field" />             <!-- like FormMessage -->
  </div>
</FormoField>
```

## Editing the theme

It's your code: change the layout in `FormoFieldView.vue`, the message in
`FormoErrorsView.vue`, map another driver in `theme.ts`, restyle with
`classes: { … }` over `shadcnClasses`. To pick up a newer version of the
registry item, run the `add` command again (the CLI asks before overwriting).

## How the registry item is built

`registry/r/formo.json` is generated from [`registry/shadcn-vue/formo`](../registry/shadcn-vue/formo)
(`bun run build:registry`) and committed, so GitHub serves it as-is; `bun run check`
fails if it's out of date. The source is typechecked and tested in this repo
against stubs shaped like shadcn-vue's components (`playground/stubs/shadcn-vue`,
mapped to `@/components/ui/*`), so shadcn-vue isn't a dependency here either.
