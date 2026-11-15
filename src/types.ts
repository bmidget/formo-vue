import type { Component, Ref } from 'vue'
import type { FormoFieldState, FormoGroupState } from './composables/context'
import type { FormContext } from 'vee-validate'

/* -------------------------------------------------------------------------- */
/*  Options (select / radios / checkboxes / datalist)                         */
/* -------------------------------------------------------------------------- */

export interface FormoOption {
  value: unknown
  label: string
  disabled?: boolean
  /** Any extra data a custom component may want (icons, descriptions...) */
  [key: string]: unknown
}

export interface FormoOptionGroup {
  label: string
  options: FormoOption[]
  disabled?: boolean
}

export type FormoOptionItem = FormoOption | FormoOptionGroup

/**
 * Everything `opts` accepts:
 *
 *  - `{ run: 'Running', swim: 'Swimming' }`                 value => label
 *  - `{ Exercise: { run: 'Running' }, Dates: {...} }`       optgroups
 *  - `['BMW', 'Honda']`                                     value === label
 *  - `[{ value: 1, label: 'One' }, ...]`                    explicit
 *  - `[{ label: 'Group', options: [...] }]`                 explicit optgroup
 *  - `[[1, 'One'], [2, 'Two']]`                             ordered pairs (keeps numeric key order)
 *  - a function of the current form values (dependent selects)
 */
export type FormoOptionsInput =
  | Record<string, unknown>
  | Array<string | number | FormoOptionItem | [unknown, string]>

export type FormoOptionsSource = FormoOptionsInput | ((ctx: FormoValueContext) => FormoOptionsInput)

/* -------------------------------------------------------------------------- */
/*  Rules                                                                      */
/* -------------------------------------------------------------------------- */

/** A Standard Schema (zod >= 3.24, valibot, arktype, ...). See https://standardschema.dev */
export interface StandardSchemaLike {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => unknown
  }
}

export interface RuleContext {
  /** The field's normalized definition */
  node: FieldNode
  /** Path of the field inside the form values (ex: `address.street`, `phones[0].number`) */
  path: string
  alias: string | number
  /** The resolved (translated) label */
  label: string
  /** Values of the whole form */
  values: Record<string, any>
  /** Values of the group the field lives in */
  parentValues: Record<string, any>
  /** The form controller */
  form: FormoController
  /** The rule name currently running */
  rule: string
  /** The rule's params as written (before `@field` references are resolved) */
  rawParams?: unknown[]
}

/**
 * A rule implementation. Return `true` to pass, `false` to fail with the
 * configured message, or a string to fail with that exact message.
 */
export type RuleFn = (
  value: any,
  params: any[],
  ctx: RuleContext,
) => boolean | string | Promise<boolean | string>

/** A single rule in any of the supported notations */
export type RuleItem =
  /** `'required'`, `'min:3'`, `'between:1,10'`, `'confirmed:@password'` */
  | string
  /** `(value, params, ctx) => true | false | 'message'` */
  | RuleFn
  /** A tuple: `['between', [1, 10]]`, `['regex', [/^[a-z]+$/]]`, `[myRule, [3]]` (`myRule(value, [3], ctx)`) */
  | [string | RuleFn, unknown[]?]
  /**
   * Explicit object with an optional per-rule message, and a `label` describing
   * the requirement in checklists (`'At least one symbol'`)
   */
  | { rule: string | RuleFn; params?: unknown[]; message?: string; label?: string }
  /** zod / valibot / arktype schema */
  | StandardSchemaLike
  /** VeeValidate object notation inside a list: `{ max: 16 }`, `{ between: [1, 10] }` */
  | { [rule: string]: unknown }

export type RulesInput =
  | RuleItem
  | RuleItem[]
  /** VeeValidate object notation: `{ required: true, min: 3, between: [1, 10] }` */
  | Record<string, unknown>

/** A rule after shape-normalization (names are resolved to functions at validation time) */
export interface RuleSpec {
  name: string
  params: unknown[]
  /** Inline implementation (custom function rules) */
  fn?: RuleFn
  message?: string
  /** Requirement text for checklists */
  label?: string
  schema?: StandardSchemaLike
}

/**
 * How a field shows its validation state:
 *  - `first`     the first failing rule's message (default)
 *  - `all`       every failing rule's message
 *  - `checklist` every rule as a live requirement list (✗ / ✓), e.g. password rules
 */
export type ErrorDisplay = 'first' | 'all' | 'checklist'

/** One line of a requirement checklist */
export interface ChecklistItem {
  /** Rule name (`min`, `mixed_case`…) */
  rule: string
  /** Requirement text (`At least 8 characters`) */
  label: string
  /** Whether the current value meets it */
  passed: boolean
  /** The error message this rule would produce */
  message: string
}

/* -------------------------------------------------------------------------- */
/*  Callbacks & filters                                                        */
/* -------------------------------------------------------------------------- */

export interface CallbackContext {
  node: FieldNode
  path: string
  value: any
  values: Record<string, any>
  form: FormoController
  /** Attach an error to this field/group (causes the submit to fail) */
  setError: (message: string) => void
}

/** Return `false` or a string to fail validation (a string becomes the error message) */
export type FormoCallback = (ctx: CallbackContext) => void | boolean | string | Promise<void | boolean | string>

export interface FormoCallbacks {
  pass?: FormoCallback[]
  fail?: FormoCallback[]
}

export type CallbacksInput = {
  pass?: FormoCallback | FormoCallback[] | Record<string, FormoCallback | FormoCallback[]>
  fail?: FormoCallback | FormoCallback[] | Record<string, FormoCallback | FormoCallback[]>
}

export type FilterFn = (value: any) => any
/** A function, a named filter (`'trim'`, `'lower'`, `'int'`, `'null_if_empty'`…), or `[fn, params]` → `fn(value, ...params)` */
export type FilterInput = FilterFn | string | [(value: any, ...params: any[]) => any, unknown[]?]

/* -------------------------------------------------------------------------- */
/*  Field definitions                                                          */
/* -------------------------------------------------------------------------- */

export interface FormoValueContext {
  /** All form values */
  values: Record<string, any>
  /** Values of the field's group */
  parentValues: Record<string, any>
  node: FieldNode
  path: string
}

/** Either a component or the name of a component registered in `components` */
export type ComponentRef = Component | string

/** How a control receives its value and gives it back */
export interface ControlModel extends ModelBinding {
  /** The field's value → what the control gets (ex: `'a,b'` → `['a', 'b']`) */
  get?: (value: unknown, field: FormoFieldState) => unknown
  /** What the control emits → the field's value */
  set?: (value: unknown, field: FormoFieldState) => unknown
}

/**
 * A control with its contract — `defineControl()`. Lets any component (Nuxt UI,
 * shadcn-vue, your own) be a field's control without a wrapper component:
 *
 * ```ts
 * defineControl({
 *   component: UInput,
 *   props: (field) => ({ type: field.node.type, color: field.invalid ? 'error' : undefined }),
 *   native: true,
 * })
 * ```
 */
export interface FormoControl {
  readonly component: ComponentRef
  /** Props computed from the field's state (options → `items`, invalid → `color`…). The field's own `props` win */
  readonly props?: (field: FormoFieldState) => Record<string, unknown>
  readonly model?: ControlModel
  /**
   * The component renders its own named form input(s) (a real `<input name>`, a
   * hidden `<select>`…): native submits don't need Formo's hidden mirror inputs
   */
  readonly native?: boolean
  /** @internal */
  readonly __formoControl: true
}

/** What a field's control can be: a component, a registered name, or a `defineControl()` */
export type ControlRef = ComponentRef | FormoControl

export interface ModelBinding {
  /** Prop used to pass the value. Default: `modelValue` */
  prop?: string
  /** Event that carries the new value. Default: `update:modelValue` */
  event?: string
}

/**
 * A field / group / form definition.
 *
 * Field parameters (`alias`, `driver`, `val`, `opts`, `attr`,
 * `rules`, `label`, `render`, `editable`, `message`, `callbacks`, `filters`,
 * `fields`, `blueprint` ...) and adds Vue-specific ones (`component`, `props`,
 * `model`, `view`, `classes`, `components`, `theme`).
 */
export interface FieldDef {
  alias?: string | number
  /** `input`, `input|email`, `textarea`, `select`, `checkbox`, `checkboxes`, `radios`, `set`, `datalist`, `file`, `button`, `group`, `form` or any driver you register */
  driver?: string
  /** Initial value. `value` is accepted as an alias */
  val?: unknown
  value?: unknown
  label?: string | false | null
  /** Help text rendered under the control */
  message?: string
  opts?: FormoOptionsSource
  /** Alias of `opts` */
  options?: FormoOptionsSource
  /** Add an empty first option to selects (`true` or the placeholder text) */
  blank?: boolean | string
  /** HTML attributes for the control (`placeholder`, `min`, `class`, `autocomplete`, ...) */
  attr?: Record<string, unknown>
  rules?: RulesInput
  /** Shortcut for adding the `required` rule */
  required?: boolean
  /** Per-rule messages for this field: `{ required: 'Tell us your name!' }` */
  errorMessages?: Record<string, string>
  error_messages?: Record<string, string>
  /** `first` (default), `all` failing messages, or a live `checklist` of every rule */
  errorDisplay?: ErrorDisplay
  /** Shortcut for `errorDisplay: 'checklist'` */
  checklist?: boolean
  /** Per-rule requirement texts for the checklist: `{ min: 'Eight characters or more' }` */
  requirements?: Record<string, string>
  /** `false` (or a function returning false) removes the field: not rendered, not validated */
  render?: boolean | ((ctx: FormoValueContext) => boolean)
  /** `false` shows the value as plain text instead of a control */
  editable?: boolean | ((ctx: FormoValueContext) => boolean)
  /**
   * Make this field — or, on a group, the whole subform — fully optional:
   * no rules, group rules or callbacks run inside it and existing errors clear
   * It stays rendered; combine with `render` to also hide it.
   */
  ignore?: Condition
  /** Like `ignore`, and also drop the values from what's submitted (Laravel `exclude_if`) */
  exclude?: Condition
  /**
   * Put this on a checkbox (or any field): while its value is truthy, these
   * fields/groups are ignored — `{ alias: 'same_as_billing', driver: 'checkbox', ignores: 'shipping' }`.
   * Paths are relative to this field's group.
   */
  ignores?: string | string[]
  /** Same as `ignores`, and the targets' values are dropped from what's submitted */
  excludes?: string | string[]
  callbacks?: CallbacksInput
  filters?: FilterInput[]
  /** Position when added: index, or `['before' | 'after', alias]` */
  order?: number | ['before' | 'after', string | number]

  /* ---- Vue specific ---------------------------------------------------- */

  /** Override the control component for this field only */
  component?: ControlRef
  /** Extra props for the control component */
  props?: Record<string, unknown>
  /** How the control component receives/emits its value */
  model?: ModelBinding
  /**
   * The view that lays this node out. A view name from the
   * theme (`'field'`, `'inline'`, `'fieldset'`, `'bare'`, `'group'`, or one the
   * theme adds, like `'floating'`), a component, or `false` for the bare control.
   */
  view?: ComponentRef | false
  /** Classes for this node only, merged over the theme's */
  classes?: Partial<FormoClasses>

  /* ---- Groups / forms -------------------------------------------------- */

  /**
   * Children. Either an object keyed by alias — `{ email: { required: true }, bio: 'textarea',
   * address: { fields: { street: {} } } }` — or a list (`[{ alias: 'email' }, 'bio']`)
   */
  fields?: FieldInput[] | FieldsInput
  /** Component overrides that cascade to every field inside this group */
  components?: Record<string, ControlRef>
  /** Config that cascades to every field inside this group (Formo "cascading config") */
  config?: Partial<FormoConfig>
  /**
   * Cascades to everything inside: a whole theme (`defineTheme()`), or overrides —
   * `{ views?, components?, classes? }`
   */
  theme?: FormoTheme | FormoThemeLayer
  /** Repeatable group: `fields` is the template for each row, the value is an array */
  blueprint?: boolean
  /** Blueprint: minimum/maximum number of rows */
  min?: number
  max?: number
  /** Blueprint button labels */
  addLabel?: string
  removeLabel?: string

  /** Anything else (your own variables: `builder.set('my_var', …)`) */
  [key: string]: unknown
}

/** A definition as the builder outputs it (`toSchema()`): children are always a list */
export interface FieldSchema extends FieldDef {
  fields?: FieldSchema[]
}

/** Compact constructs accepted wherever a field is expected */
export type FieldInput =
  | FieldDef
  | string
  | [alias: string | number, driver?: string, val?: unknown, opts?: FieldDef]
  | { toSchema(): FieldDef }

/**
 * One entry of a keyed `fields` object (the key is the alias):
 *  - a definition (`{ driver: 'email', required: true }`, `{ fields: {...} }` for a subform)
 *  - a driver name (`'textarea'`, like `.add('bio', 'textarea')`)
 *  - a `Formo` builder
 *  - `false` / `null` / `undefined` — skipped (`admin: isAdmin && { driver: 'checkbox' }`)
 */
export type FieldEntry = FieldDef | string | { toSchema(): FieldDef } | false | null | undefined

/** `fields` as an object keyed by alias */
export type FieldsInput = Record<string, FieldEntry>

/** A normalized node. Produced by `normalize()` and consumed by the components. */
export interface FieldNode {
  alias: string | number
  driver: string
  /** Input type, for `input` drivers (`text`, `email`, `password`...) */
  type?: string
  val?: unknown
  hasVal: boolean
  label?: string | false | null
  message?: string
  opts?: FormoOptionsSource
  blank?: boolean | string
  attr: Record<string, unknown>
  rules: RuleSpec[]
  /** A vee-validate TypedSchema / yup schema passed through untouched */
  veeSchema?: unknown
  errorMessages: Record<string, string>
  /** Undefined = use `config.errorDisplay` */
  errorDisplay?: ErrorDisplay
  requirements: Record<string, string>
  render: boolean | ((ctx: FormoValueContext) => boolean)
  editable: boolean | ((ctx: FormoValueContext) => boolean)
  ignore: Condition
  exclude?: Condition
  ignores: string[]
  excludes: string[]
  callbacks: Required<FormoCallbacks>
  filters: FilterInput[]
  component?: ControlRef
  props?: Record<string, unknown>
  model?: ModelBinding
  view?: ComponentRef | false
  classes?: Partial<FormoClasses>
  fields: FieldNode[]
  components?: Record<string, ControlRef>
  config?: Partial<FormoConfig>
  theme?: FormoTheme | FormoThemeLayer
  blueprint: boolean
  min?: number
  max?: number
  addLabel?: string
  removeLabel?: string
  /** Any other variables */
  vars: Record<string, unknown>
}

/* -------------------------------------------------------------------------- */
/*  Drivers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Built-in field view names:
 *  - `field`     label above the control (default)
 *  - `inline`    control, then its label (single checkbox)
 *  - `fieldset`  a legend over a group of controls (radios, checkboxes)
 *  - `bare`      no label (buttons)
 * Themes can add more (`'floating'`…) and fields pick one with `view`.
 */
export type FieldViewName = 'field' | 'inline' | 'fieldset' | 'bare' | (string & {})

/**
 * A driver describes how a kind of field behaves. Register your own through the plugin or the
 * `drivers` prop: `{ rating: { component: StarRating, defaultValue: () => 0 } }`.
 */
export interface FormoDriver {
  /** The control component (leaf drivers only) */
  component?: ControlRef
  /**
   * Turns what the control emits into the field's value, whatever the control
   * (the `input` driver: numbers for `number` / `range`)
   */
  parse?: (value: unknown, node: FieldNode) => unknown
  /** Groups / forms contain other fields */
  parent?: boolean
  /**
   * The view its fields use by default: `field` (label above, default), `inline`
   * (checkbox + label), `fieldset` (legend over a group of controls), `bare` (no label),
   * any view name the theme provides, or `false` (the control alone, ex: hidden inputs)
   */
  view?: FieldViewName | false | ((node: FieldNode) => FieldViewName | false)
  /** Value used when the definition has no `val` */
  defaultValue?: (node: FieldNode) => unknown
  /** Rules automatically added before validation */
  rules?: (node: FieldNode, config: FormoConfig) => RuleItem[] | undefined
  /** Render the value as text when `editable: false` */
  display?: (value: unknown, node: FieldNode, options: FormoOptionItem[]) => string
  /** Driver does not produce a value (buttons) */
  valueless?: boolean
  /** How the control receives/emits its value */
  model?: ModelBinding
}

/* -------------------------------------------------------------------------- */
/*  Config, theme, plugin                                                      */
/* -------------------------------------------------------------------------- */

export type ValidationMode =
  /** validate on blur; once a field was touched or has an error, on every change (default) */
  | 'eager'
  /** validate on every keystroke */
  | 'aggressive'
  /** validate on blur only (and on change while the field shows an error) */
  | 'lazy'
  /** validate on submit only */
  | 'submit'

export interface FormoConfig {
  /** Auto-generate `id`s for controls */
  autoId: boolean
  /** Namespace field names and values by their group */
  namespaces: boolean
  /**
   * What input names start with: the form alias by default (`user[email]`, like
   * Formo), another root (`'account'` → `account[email]`), or `false` for bare
   * names (`email`, `address[street]`) — what a Laravel FormRequest or an API
   * validates, so a native post (JavaScript off) reaches the same rules.
   */
  namePrefix?: string | false
  /** Turn `first_name` into `First name` when there is no label */
  humanizeLabels: boolean
  /**
   * Label overrides for every locale:
   * `{ 'address.street': 'Street', email: 'E-mail' }`. Per-locale: `locales.fr.labels`.
   */
  labels: Record<string, string>
  /**
   * Validation message overrides for every locale.
   * Keys: `rule`, `alias.rule`, `path.rule`, `alias.default`. Per-locale: `locales.fr.validation`.
   * Placeholders: `:field` (or Laravel's `:attribute`), `:value`, `:param1`…, `:other`,
   * Laravel-named params (`:min`, `:max`, `:size`, `:values`…), or the `{field}` style.
   */
  messages: Record<string, string>
  /**
   * Active locale (`'fr'`, `'pt-BR'`…). Can be a ref or a getter — switching it
   * re-renders labels/texts and re-translates current errors.
   */
  locale: string | Ref<string> | (() => string)
  /** Used when the active locale has no translation for a key */
  fallbackLocale: string
  /** Translations per locale (built in: en, fr, es, de, nl) — add or override any of them */
  locales: Record<string, FormoLocaleMessages>
  /**
   * Bridge to an i18n library for namespaced keys (`validation.required`,
   * `labels.email`, `ui.add`…). Return `undefined` to fall back to Formo's
   * catalogs. See `vueI18n()` / `laravelI18n()`.
   */
  t?: (key: string, params: Record<string, unknown>) => string | undefined
  /**
   * Translate free texts — explicit labels, help texts, option labels,
   * placeholders, legends, button texts — the text itself is the key, like Laravel's
   * `__('Email')`. Return the text unchanged when there's no translation.
   */
  translate?: (text: string) => string
  /** Rules added to inputs based on their `type` */
  inputRules: Record<string, RuleItem[]>
  /** Translate HTML constraint attributes (`required`, `minlength`, `maxlength`, `pattern`) into rules */
  htmlConstraintRules: boolean
  /** When to validate */
  validationMode: ValidationMode
  /** Stop at the first failing rule of a field. Ignored by `all` / `checklist` fields */
  bails: boolean
  /** Default error display for every field (`first`, `all`, `checklist`) */
  errorDisplay: ErrorDisplay
  /**
   * Requirement texts for checklists, per rule (`min: 'At least :param1 characters'`).
   * Same lookup as `messages` (`path.rule`, `alias.rule`, `rule`); falls back to the error message.
   */
  requirements: Record<string, string>
  /** CSRF protection for native submits and `form.request()` — see `CsrfConfig` */
  csrf: CsrfConfig
  /** Defaults for `form.request()` / `action` submits */
  request: FormoRequestConfig
  /** Keep values of fields that are removed with `render: false` */
  keepValuesOnUnmount: boolean
  /** Text for the `*` marker on required fields (`false` to hide) */
  requiredMarker: string | false
  /**
   * Progressive enhancement for server-rendered apps: after client-side
   * validation passes, submit the `<form>` natively (to its `action`) so the
   * backend receives the usual namespaced POST. Custom components get hidden
   * inputs mirroring their value.
   */
  native: boolean
}

/** The class of every element the built-in views and controls render */
export interface FormoClasses {
  form: string
  formError: string
  group: string
  groupLegend: string
  groupBody: string
  groupError: string
  field: string
  fieldInline: string
  fieldBare: string
  /** Resets the `<fieldset>` of option groups (radios / checkboxes) */
  fieldset: string
  label: string
  labelInline: string
  required: string
  title: string
  control: string
  controlInvalid: string
  select: string
  textarea: string
  file: string
  color: string
  range: string
  checkbox: string
  radio: string
  optionList: string
  optionLabel: string
  optionText: string
  help: string
  error: string
  uneditable: string
  button: string
  buttonPrimary: string
  buttonSecondary: string
  blueprint: string
  blueprintRow: string
  blueprintRowHeader: string
  blueprintRemove: string
  blueprintAdd: string
  errorSummary: string
  errorList: string
  /** Added to groups/fields while they're ignored (fully optional) */
  ignored: string
  checklist: string
  checklistItem: string
  checklistMet: string
  checklistUnmet: string
  checklistFailed: string
}

/**
 * The views of a theme — what lays a form out. Every
 * view gets a `formo` prop (the state of what it renders) and fills its slots:
 *
 *  - `form`          inside `<form>` — slots `before`, `default`, `actions`
 *  - `group`         a subform — slot `default` (the fields)
 *  - `blueprint`     repeatable rows — slot `row` (`{ row }`), once per row
 *  - `blueprintRow`  one row (gets `row` too) — slot `default` (the row's fields)
 *  - `field`, `inline`, `fieldset`, `bare` —
 *                    slots `label`, `input`, `help`, `errors`, `checklist`
 *  - `label`, `help`, `errors`, `checklist`, `uneditable` — the pieces of a field
 *  - `errorSummary`  `<FormoErrorSummary>`
 *
 * Any other key is a named view fields can pick with `view: 'floating'`.
 */
export interface FormoViews {
  form: ComponentRef
  group: ComponentRef
  blueprint: ComponentRef
  blueprintRow: ComponentRef
  field: ComponentRef
  inline: ComponentRef
  fieldset: ComponentRef
  bare: ComponentRef
  label: ComponentRef
  help: ComponentRef
  errors: ComponentRef
  checklist: ComponentRef
  uneditable: ComponentRef
  errorSummary: ComponentRef
  [name: string]: ComponentRef
}

/** Overrides layered over a theme (app-wide, per form, per group) */
export interface FormoThemeLayer {
  views?: Partial<FormoViews>
  /** Controls, keyed by driver (`select`), driver + type (`input|date`) or a name (`component: 'stars'`) */
  components?: Record<string, ControlRef>
  classes?: Partial<FormoClasses>
}

/** What `defineTheme()` accepts */
export interface FormoThemeInput extends FormoThemeLayer {
  name?: string
  /** Start from another theme: its views/components are kept, its classes merged with yours */
  extends?: FormoTheme
  /** How class overrides combine with the theme's (default: the parent's, else concatenation) */
  mergeClasses?: (...classes: Array<string | undefined>) => string
}

/**
 * A complete theme: the views, the controls and the
 * classes they use. Made with `defineTheme()`; the built-in one is `defaultTheme` (Tailwind).
 */
export interface FormoTheme {
  readonly name: string
  /** Views this theme provides (the rest fall back to the built-in views) */
  readonly views: Partial<FormoViews>
  readonly components: Record<string, ControlRef>
  /** Every class key (the ones not given are empty) */
  readonly classes: FormoClasses
  readonly mergeClasses: (...classes: Array<string | undefined>) => string
  /** @internal */
  readonly __formoTheme: true
}

export interface FormoOptions {
  /**
   * The theme — a complete set of views, controls and classes (`defineTheme()`),
   * or overrides over the current one (`{ views, components, classes }`)
   */
  theme?: FormoTheme | FormoThemeLayer
  /** View overrides: `{ field: MyFieldView, errors: MyErrors, floating: FloatingLabel }` */
  views?: Partial<FormoViews>
  /** Control overrides, keyed by driver (`select`), driver + type (`input|date`) or any name referenced by `component: 'name'` */
  components?: Record<string, ControlRef>
  /** Class overrides, merged over the theme's */
  classes?: Partial<FormoClasses>
  /** Extra/overridden drivers */
  drivers?: Record<string, FormoDriver>
  /** Extra/overridden rules */
  rules?: Record<string, RuleFn>
  config?: Partial<FormoConfig>
}

/** The cascading context every component sees (plugin → form → group → ...) */
export interface FormoResolvedOptions {
  /** The base theme */
  theme: FormoTheme
  /** View overrides (over the theme's) */
  views: Record<string, ComponentRef>
  /** Control / named component overrides (over the theme's) */
  components: Record<string, ControlRef>
  /** Class override layers, in order (re-applied when a scope switches theme) */
  classLayers: Array<Partial<FormoClasses>>
  /** The resolved classes: the theme's + every override */
  classes: FormoClasses
  drivers: Record<string, FormoDriver>
  rules: Record<string, RuleFn>
  config: FormoConfig
}

/* -------------------------------------------------------------------------- */
/*  Runtime                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Which part of a field/subform to render:
 *  - `field`     label, control, help, errors (a subform: the whole fieldset)
 *  - `input`     the control only
 *  - `label`, `errors`, `help`, `checklist`  just that piece
 */
export type FormoPart = 'field' | 'input' | 'label' | 'errors' | 'help' | 'checklist'

/**
 * A condition on the form values, used by `ignore` / `exclude`:
 *
 *  - `true` / `false`
 *  - `({ values, parentValues }) => boolean`
 *  - `{ when: 'same_as_billing' }`            → that field is truthy / filled
 *  - `{ when: 'type', is: 'business' }`       → equals (or is one of, with an array)
 *  - `{ when: 'type', not: ['a', 'b'] }`      → isn't
 *  - `{ when: 'notes', filled: false }`       → is empty
 *
 * Field references are relative to the node's group first, then from the form root.
 * The object form is JSON-friendly (schemas from the server).
 */
export type Condition =
  | boolean
  | ((ctx: FormoValueContext) => boolean)
  | { when: string; is?: unknown; not?: unknown; filled?: boolean }

/** Something that can define a form: a builder, or a plain definition (or its JSON) */
export type FormoDefinition = FieldInput

/* -------------------------------------------------------------------------- */
/*  Handles: form.fields.email                                                 */
/* -------------------------------------------------------------------------- */

export type FormoHandleKind = 'field' | 'group' | 'blueprint'

/**
 * A reference to a field, subform or repeatable group of a form — what
 * `<FormoField :field="form.fields.email">` renders. Stable (one object per
 * path), and its getters read the form's live state.
 */
export interface FormoHandle {
  /** `field`, `group` (a subform) or `blueprint` (repeatable rows) */
  readonly kind: FormoHandleKind
  /** Path in the form values (`address.street`, `phones[0].number`) */
  readonly path: string
  readonly alias: string | number
  /** Its current normalized definition */
  readonly node: FieldNode | undefined
  readonly form: FormoController<any>
  /** Its value (get / set) */
  value: any
  readonly error: string | undefined
  /** Currently ignored (fully optional)? */
  readonly ignored: boolean
  /** Subforms: their children, by alias */
  readonly fields?: FormoFields
  /** Repeatable groups: one handle per row */
  readonly rows?: Array<FormoRowHandle<any>>
}

/** Children of a form / subform / row, by alias */
export type FormoFields = { readonly [alias: string]: FormoHandle | undefined }

export interface FormoFieldHandle extends FormoHandle {
  readonly kind: 'field'
}

export interface FormoGroupHandle<F = FormoFields> extends FormoHandle {
  readonly kind: 'group'
  readonly fields: F & FormoFields
}

export interface FormoBlueprintHandle<F = FormoFields> extends FormoHandle {
  readonly kind: 'blueprint'
  /** One handle per row — `v-for="row in phones.rows" :key="row.key"` */
  readonly rows: Array<FormoRowHandle<F>>
  /** Add a row (the row's defaults, merged with `values`) — unless `max` is reached */
  add(values?: Record<string, unknown>): void
  /** Remove a row — unless `min` is reached */
  remove(index: number): void
  /** Below `max`? */
  readonly canAdd: boolean
  /** Above `min`? */
  readonly canRemove: boolean
}

/** One row of a repeatable group: `form.fields.phones.rows[0].fields.number` */
export interface FormoRowHandle<F = FormoFields> {
  /** Stable across adds / removes — use it as the `v-for` key */
  readonly key: string | number
  readonly index: number
  /** `phones[0]` */
  readonly path: string
  readonly fields: F & FormoFields
  readonly form: FormoController<any>
  /** Remove this row (unless `min` is reached) */
  remove(): void
}

type Falsy = false | null | undefined

/** The handle type of one entry of a keyed `fields` object */
export type FormoHandleOf<E> = E extends Falsy
  ? undefined
  : E extends string
    ? FormoFieldHandle
    : E extends { readonly __formoDef?: infer D }
      ? FormoHandleOf<D>
      : E extends { blueprint: infer B; fields: infer C }
        ? true extends B
          ? FormoBlueprintHandle<FormoFieldsOf<C>>
          : FormoGroupHandle<FormoFieldsOf<C>>
        : E extends { fields: infer C }
          ? FormoGroupHandle<FormoFieldsOf<C>>
          : E extends { driver: 'group' | 'form' }
            ? FormoGroupHandle
            : FormoFieldHandle

/** Handles for a `fields` input: typed for keyed objects, loose for lists */
export type FormoFieldsOf<C> = C extends readonly unknown[]
  ? FormoFields
  : C extends Record<string, unknown>
    ? { readonly [K in keyof C]: FormoHandleOf<C[K]> }
    : FormoFields

/** Handles of a whole definition (a builder or a plain object) */
export type FormoFieldsOfDefinition<D> = D extends { readonly __formoDef?: infer X }
  ? FormoFieldsOfDefinition<X>
  : D extends { fields: infer C }
    ? FormoFieldsOf<C>
    : FormoFields

/** @internal A mounted repeatable group's rows (vee-validate field array) */
export interface FormoArrayBinding {
  keys: () => Array<string | number>
  push: (row: Record<string, unknown>) => void
  remove: (index: number) => void
}

export interface RegisteredNode {
  node: FieldNode
  path: string
  kind: 'field' | 'group' | 'form'
  label: () => string
  /** Parent path ('' = root) */
  parentPath: string
  /** Where the node's value lives, when it differs from `path` (groups with `namespaces: false`) */
  valuePath?: string
  /** Registry path of the group/form containing this node (`undefined` for the form itself) */
  groupPath?: string
  /** Fields: their live state (label, id, error…) — lets <FormoLabel :field="handle"> & co. render pieces elsewhere */
  state?: FormoFieldState
  /** Groups: their live state */
  groupState?: FormoGroupState
  validate?: () => Promise<{ valid: boolean; errors: string[] }>
}

export interface FormoErrorsInput {
  [path: string]: string | string[] | undefined | FormoErrorsInput
}

export interface FormoSubmitContext {
  /** The native event, if any */
  event?: Event
  setErrors: (errors: FormoErrorsInput) => void
  setError: (path: string, message: string | undefined) => void
  reset: (values?: Record<string, any>) => void
  form: FormoController
  /**
   * Send the submitted values to your API with CSRF handled (Laravel conventions):
   * `await request('/api/profile', { method: 'put' })`. Defaults to the form's
   * `attr.action` / `attr.method`. 422 errors are mapped onto the fields.
   */
  request: (url?: string, options?: FormoRequestOptions) => Promise<FormoResponse>
  /**
   * Refuse the submit yourself (your API said no): the outcome is `rejected`.
   * Errors go onto the fields (`{ email: 'Taken' }`, Laravel keys work), a string onto the form.
   */
  reject: (errors?: FormoErrorsInput | string) => void
}

/**
 * How a submit ended:
 *  - `success`   it went through — valid, and the handler / the server accepted it
 *  - `invalid`   the browser's validation stopped it: nothing was sent, the errors are on screen
 *  - `rejected`  it was sent, but refused — see `reason`
 */
export type FormoSubmitResult = 'success' | 'invalid' | 'rejected'

/**
 * Why a submit was rejected:
 *  - `validation`  the server's validation (422), or errors the handler set (`setErrors`, `reject(errors)`)
 *  - `session`     the session / CSRF token expired (419)
 *  - `server`      any other unsuccessful response (4xx / 5xx)
 *  - `handler`     the handler returned `false` or called `reject()` without errors
 *  - `error`       the handler threw (a network error, a bug) — a form-level message is shown
 */
export type FormoRejectReason = 'validation' | 'session' | 'server' | 'handler' | 'error'

export interface FormoOutcome {
  result: FormoSubmitResult
  /** `rejected` only */
  reason?: FormoRejectReason
  /** What was submitted (not for `invalid`: nothing was) */
  values?: Record<string, any>
  /** `success`: the response's data, or what the handler returned */
  data?: unknown
  /** The response of the request made during the submit, if any */
  response?: FormoResponse
  /** The form's errors afterwards (flat) */
  errors: Record<string, string>
  /** `error`: what was thrown */
  error?: unknown
}

/** What to do after a submit — `<FormoForm @success @invalid @rejected @settled>`, or `useFormo(…, { onSuccess… })` */
export interface FormoOutcomeHandlers {
  /** It went through: the response's data (or the handler's return value) */
  onSuccess?: (data: any, outcome: FormoOutcome) => unknown
  /** The browser's validation stopped it — nothing was sent */
  onInvalid?: (errors: Record<string, string>, outcome: FormoOutcome) => unknown
  /** Sent, but refused: `outcome.reason` says why (the errors are already on the fields) */
  onRejected?: (outcome: FormoOutcome) => unknown
  /** After every submit, whatever happened (`outcome.result`) */
  onSettled?: (outcome: FormoOutcome) => unknown
}

export interface FormoController<F = FormoFields> {
  readonly alias: string | number
  /** The normalized root node */
  readonly root: FieldNode
  /**
   * Handles for the form's fields — `<FormoField :field="form.fields.email" />`.
   * Subforms nest under `fields` too: `form.fields.address.fields.zip`;
   * repeatable groups have `rows`: `form.fields.phones.rows[0].fields.number`.
   */
  readonly fields: F & FormoFields
  /** A handle by path (`address.zip`, `phones[0].number`) or alias — fields added at runtime, JSON schemas */
  field(pathOrAlias: string): FormoHandle | undefined
  /** The underlying vee-validate form */
  readonly vee: FormContext<any>
  /** Raw form values (reactive) */
  readonly values: Record<string, any>
  /** Flat map of errors: `{ 'email': '...', 'address.zip': '...', '': 'form error' }` */
  readonly flatErrors: Record<string, string>
  /** Nested errors (`:self` for group/form errors) */
  readonly errors: Record<string, any>
  /** Every message per path — fields with `errorDisplay: 'all' | 'checklist'` can have several */
  readonly allErrors: Record<string, string[]>
  readonly valid: boolean
  readonly dirty: boolean
  readonly submitting: boolean
  readonly submitCount: number
  /** How the last submit ended (`undefined` before the first one) */
  readonly outcome: FormoOutcome | undefined
  readonly options: FormoResolvedOptions

  /** Get a value by path (no path: all values) */
  val(path?: string): any
  /** Set a value by path */
  val(path: string, value: unknown, validate?: boolean): void
  /** Merge values into the form */
  load(values: Record<string, any>, validate?: boolean): void
  /** Values after applying each field's `filters` (what gets submitted) */
  getValues(): Record<string, any>
  /** Run field rules, group rules and callbacks. Resolves to whether the form passed */
  validate(): Promise<boolean>
  /** Validate a single field */
  validateField(path: string): Promise<boolean>
  /**
   * Validate and submit. Resolves to whether it *succeeded* — valid, and not
   * rejected by the handler or the server (the details: `form.outcome`). Pass a
   * handler to submit without a <form> element (parts rendered with <FormoRender>):
   * `<button @click="form.submit(save)">` — `save(values, ctx)` runs once valid.
   * A second call while one is in flight returns the same promise (no double posts).
   */
  submit(eventOrHandler?: Event | ((values: Record<string, any>, ctx: FormoSubmitContext) => unknown)): Promise<boolean>
  /**
   * A component rendering one part of the form:
   * `<component :is="form.render('address')" />`, `form.render('email', 'input')`.
   */
  render(path?: string, part?: FormoPart): Component
  /**
   * Send the form's (filtered) values with CSRF protection (Laravel/Sanctum
   * conventions). Defaults to `attr.action` / `attr.method`. Maps 422 errors to
   * fields, 419 to a form error (after one automatic CSRF refresh + retry).
   */
  request(url?: string, options?: FormoRequestOptions): Promise<FormoResponse>
  reset(values?: Record<string, any>): void
  /** Attach an error to any path. `''` / `':self'` is the form itself, a group path attaches to the group */
  setError(path: string, message: string | string[] | undefined): void
  /** Flat (`{ 'address.zip': '…' }`) or nested Formo `errors()` format (`{ address: { zip: '…', ':self': '…' } }`) */
  setErrors(errors: FormoErrorsInput): void
  clearErrors(): void
  /** Error for a path (fields and groups) */
  error(path: string): string | undefined
  /** Find a rendered field/group by path, or by alias (searched recursively) */
  find(pathOrAlias: string): RegisteredNode | undefined
  /** Resolved label of a rendered field */
  label(path: string): string
  /** Is this path (or one of its parent groups) currently ignored — i.e. fully optional? */
  isIgnored(path: string): boolean
  /** Is this path (or a parent group) excluded from the submitted values? */
  isExcluded(path: string): boolean

  /** @internal vee-validate's private form context (what useField/useFieldArray inject) */
  _vee: unknown
  /** @internal Paths placed explicitly with <FormoRender> (so <FormoRest> skips them) */
  readonly _claimed: Set<string>
  /** @internal */
  _claim(path: string): () => void
  /** @internal */
  _register(entry: RegisteredNode): () => void
  /** @internal Mounted repeatable groups, by path: their row keys and actions (handles use them) */
  readonly _arrays: Map<string, FormoArrayBinding>
  /** @internal */
  _registerArray(path: string, binding: FormoArrayBinding): () => void
  /** @internal The controller's own options (without the rendering form's layer) */
  readonly _baseOptions: FormoResolvedOptions
  /** @internal The rendering <FormoForm> shares its layered options */
  _useOptions(getter: () => FormoResolvedOptions): () => void
  /** @internal */
  _onSubmit(handler: (values: Record<string, any>, ctx: FormoSubmitContext) => unknown): () => void
  /** @internal */
  _onInvalid(handler: (errors: Record<string, string>) => unknown): () => void
  /** @internal Called with every submit's outcome */
  _onOutcome(handler: (outcome: FormoOutcome) => unknown): () => void
}

/* -------------------------------------------------------------------------- */
/*  i18n                                                                       */
/* -------------------------------------------------------------------------- */

/** Built-in interface strings */
export interface FormoUiStrings {
  /** Blueprint "add row" button */
  add: string
  /** Blueprint "remove row" button */
  remove: string
  /** Blueprint row heading — `:label`, `:index` */
  rowLabel: string
  /** <FormoErrorSummary> title */
  errorSummary: string
  yes: string
  no: string
  /** Uneditable field without a value */
  empty: string
  /** Checklist screen-reader prefixes */
  met: string
  notMet: string
  /** Checklist aria-label — `:field`, `:met`, `:total` */
  checklistSummary: string
}

/** One locale's translations. Every section is optional and merged over the built-ins */
export interface FormoLocaleMessages {
  /** Validation messages by rule — and `alias.rule` / `path.rule` for specific fields */
  validation?: Record<string, string>
  /** Checklist requirement texts by rule */
  requirements?: Record<string, string>
  /** Field labels by path / alias */
  labels?: Record<string, string>
  /** Free texts by source text (`'Favorite hobby': 'Passe-temps préféré'`) */
  texts?: Record<string, string>
  ui?: Partial<FormoUiStrings>
}

/* -------------------------------------------------------------------------- */
/*  CSRF & requests                                                            */
/* -------------------------------------------------------------------------- */

export interface CsrfOptions {
  /** An explicit raw token, or a (possibly async) function returning it */
  token?: string | (() => string | null | undefined | Promise<string | null | undefined>)
  /** `<meta>` to read the raw token from (Laravel Blade: `<meta name="csrf-token" content="{{ csrf_token() }}">`). `false` to disable */
  meta?: string | false
  /** Cookie holding the (encrypted) XSRF token, set by Laravel on every web response. `false` to disable */
  cookie?: string | false
  /** Body field for the raw token on native submits (Laravel `@csrf`: `_token`) */
  field?: string
  /** Header for the raw token (Laravel: `X-CSRF-TOKEN`) */
  header?: string
  /** Header for the cookie token (Laravel/Sanctum/axios: `X-XSRF-TOKEN`) */
  cookieHeader?: string
  /**
   * URL to GET when no token is available yet, and to refresh it after a 419
   * (Sanctum: `/sanctum/csrf-cookie`). Relative to `request.baseUrl`. `false` to disable
   */
  prime?: string | false
  /**
   * Extra origins allowed to receive the token (ex: `https://api.example.com`).
   * Tokens are only ever sent to the page's origin, `request.baseUrl`'s origin and these.
   */
  origins?: string[]
  /** Refresh the token and retry once when the server answers 419 (default: true) */
  retryOn419?: boolean
}

/**
 * - `'laravel'` (default): raw token from `<meta name="csrf-token">` + `XSRF-TOKEN` cookie
 * - `'sanctum'`: `'laravel'` + fetches `/sanctum/csrf-cookie` when there's no token yet / after a 419
 * - an options object (merged over `'laravel'`), or `false` (stateless token APIs)
 */
export type CsrfConfig = false | 'laravel' | 'sanctum' | CsrfOptions

export interface FormoRequestConfig {
  /** Prefix for relative URLs (ex: `https://api.example.com`) — its origin is trusted for CSRF */
  baseUrl?: string
  /** Extra headers for every request (ex: `Authorization`) */
  headers?: Record<string, string>
  /** Defaults to `include` for trusted origins, `same-origin` otherwise */
  credentials?: RequestCredentials
  /** `json`, `form-data`, or `auto` (default: form-data when the values contain files) */
  body?: 'json' | 'form-data' | 'auto'
  /** Wrap the values: `{ [rootKey]: values }` */
  rootKey?: string
  /** Custom fetch (tests, interceptors) */
  fetch?: typeof fetch
}

export interface FormoRequestOptions extends FormoRequestConfig {
  method?: string
  /** Values to send (default: the form's filtered values) */
  values?: Record<string, any>
  /** Map 422 / 419 / 5xx responses onto the form's errors (default: true) */
  mapErrors?: boolean
  /** Per-request CSRF override */
  csrf?: CsrfConfig
}

export interface FormoResponse<T = any> {
  ok: boolean
  status: number
  /** Parsed JSON (or text) body */
  data: T
  response: Response
  /** Field errors from a 422, keyed by form path */
  errors?: Record<string, string[]>
}
