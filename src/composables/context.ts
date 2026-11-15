import { inject, type Component, type ComputedRef, type InjectionKey, type Slots } from 'vue'
import type { FieldContext } from 'vee-validate'
import type {
  ChecklistItem,
  ComponentRef,
  ErrorDisplay,
  FormoClasses,
  FormoController,
  FormoFields,
  FieldNode,
  FormoOptionItem,
  FormoOptions,
  FormoResolvedOptions,
  FormoRowHandle,
  FormoTheme,
  FormoThemeLayer,
} from '../types'
import { defaultConfig } from '../core/config'
import { defaultDrivers } from '../core/drivers'
import { builtinRules } from '../core/rules'
import { asThemeLayer, isTheme, mergeClassMaps, rawComponents } from '../core/theme'
import { deepMerge } from '../core/utils'
import { defaultTheme } from '../components/views'

/** Options installed with `app.use(createFormo(...))` */
export const FormoGlobalKey: InjectionKey<FormoOptions> = Symbol('formo:global')
/** The cascading options (plugin → form → group → ...) */
export const FormoOptionsKey: InjectionKey<ComputedRef<FormoResolvedOptions>> = Symbol('formo:options')
export const FormoControllerKey: InjectionKey<FormoController> = Symbol('formo:controller')
/** Slots given to <FormoForm>, so any nested field can be overridden from the template */
export const FormoSlotsKey: InjectionKey<Slots> = Symbol('formo:slots')
/**
 * The subform / row a custom layout is in: relative <FormoRender> paths resolve
 * against `prefix`; <FormoRest> renders what's left of `path`.
 */
export interface FormoContainer {
  /** Registry path of the container ('' = the form, `phones[0]` = a blueprint row) */
  path: string
  /** Value prefix of its children */
  prefix: string
}
export const FormoContainerKey: InjectionKey<() => FormoContainer> = Symbol('formo:container')
/** State of the current field, for custom components (`useFormoField()`) */
export const FormoFieldKey: InjectionKey<FormoFieldState> = Symbol('formo:field')
/** The field or subform whose slots we're in — what <FormoLabel />, <FormoErrors />… render without `:field` */
export type FormoPartOwner = { kind: 'field'; state: FormoFieldState } | { kind: 'group'; state: FormoGroupState }
export const FormoPartOwnerKey: InjectionKey<FormoPartOwner> = Symbol('formo:part-owner')

/**
 * Everything a control (built-in or custom) needs to know about its field.
 * Built-in controls get it as the `formo` prop; custom components can get it
 * from `useFormoField()` without declaring any prop.
 */
export interface FormoFieldState {
  node: FieldNode
  /** Path in the form values (`address.street`, `phones[0].number`) */
  path: string
  /** HTML `name` attribute (`user[address][street]`) */
  name: string
  id: string
  value: any
  setValue: (value: unknown) => void
  onBlur: () => void
  error: string | undefined
  /** Every failing message (all of them for `all`/`checklist` fields) */
  errors: string[]
  /** `first`, `all` or `checklist` */
  errorDisplay: ErrorDisplay
  /** Live requirement list — only filled for `checklist` fields */
  checklist: ChecklistItem[]
  checklistId: string
  invalid: boolean
  touched: boolean
  dirty: boolean
  required: boolean
  /** Currently ignored (fully optional) — itself, through a parent group, or another field's `ignores` */
  ignored: boolean
  label: string
  /** Help text (the field's `message`), translated */
  message: string | undefined
  /** Text for buttons (label, Formo `html`, value or alias) */
  text: string
  /** Normalized options for select/radios/checkboxes */
  options: FormoOptionItem[]
  /** The classes, resolved for this field (theme + overrides + the field's `classes`) */
  classes: FormoClasses
  /** HTML attributes for the control (id, name, aria-*, plus the field's `attr`) */
  attrs: Record<string, unknown>
  helpId: string
  errorId: string
  disabled: boolean
  /** @internal The field's parts (what <FormoLabel>, <FormoInput>… render) */
  _parts: Record<'label' | 'input' | 'help' | 'errors' | 'checklist', Component>
  /** The underlying vee-validate field */
  field?: FieldContext<any>
  /** The form controller */
  form: FormoController
}

/**
 * What every slot of `<FormoField>` receives (the default slot — your own markup
 * for the whole field — and `#label`, `#input`, `#help`, `#errors`, `#checklist`).
 * Render the theme's parts wherever you want with <FormoLabel>, <FormoInput>,
 * <FormoHelp>, <FormoErrors>, <FormoChecklist> — inside a field's slots they
 * find the field on their own, or take it as `:field`:
 *
 * ```vue
 * <FormoField :field="form.fields.price" v-slot="{ field }">
 *   <div class="grid grid-cols-2">
 *     <FormoLabel :field="field" />
 *     <div class="flex"><span>$</span><FormoInput :field="field" class="rounded-l-none" /></div>
 *     <div class="my-box"><FormoErrors :field="field" /></div>
 *   </div>
 * </FormoField>
 * ```
 */
export interface FormoFieldSlotProps {
  /** The field's state (value, error, label, classes…) — give it to <FormoLabel :field> & co. */
  field: FormoFieldState
  /**
   * What the view passed to this slot, ex: `{ as: 'legend' }` for the label of
   * radios. Forward it to the part: `<FormoLabel v-bind="props" />`
   */
  props: Record<string, unknown>
}

/**
 * What a subform's slots receive: the default slot (your own markup for the
 * whole subform) and `#fields` (your layout of its fields, inside the theme's view)
 */
export interface FormoGroupSlotProps<F = FormoFields> {
  /** The subform's state (label, message, error, classes…) — <FormoLabel :field="group" /> & co. render its pieces */
  group: FormoGroupState
  /** Handles for the subform's fields */
  fields: F & FormoFields
  form: FormoController
}

/**
 * What a repeatable group's default slot receives — your own markup for the
 * whole thing: loop over `rows`, add / remove them yourself
 */
export interface FormoBlueprintSlotProps<F = FormoFields> {
  blueprint: FormoBlueprintState
  /** One handle per row: `v-for="row in rows" :key="row.key"` → `row.fields.number`, `row.remove()` */
  rows: Array<FormoRowHandle<F>>
  add: (values?: Record<string, unknown>) => void
  remove: (index: number) => void
  canAdd: boolean
  canRemove: boolean
  form: FormoController
}

/** What the `#row` slot of a repeatable group receives: your layout of one row, inside the theme's views */
export interface FormoRowSlotProps<F = FormoFields> {
  /** Handles for the row: `row.fields.number` */
  row: FormoRowHandle<F>
  index: number
  /** `phones[0]` */
  path: string
  remove: () => void
  canRemove: boolean
}

/** State of a subform — what a `group` view gets as its `formo` prop */
export interface FormoGroupState {
  node: FieldNode
  path: string
  /** DOM id for the group element */
  id: string
  label: string
  /** Help text (the group's `message`), translated */
  message: string | undefined
  /** The group's own error (group rules, server errors…) */
  error: string | undefined
  /** Currently ignored (fully optional) */
  ignored: boolean
  classes: FormoClasses
  form: FormoController
}

/** One row of a repeatable group, for `blueprint` / `blueprintRow` views */
export interface FormoBlueprintRowState {
  /** Stable key for `v-for` */
  key: string | number
  index: number
  /** `phones[0]` */
  path: string
  /** `Phone #1` */
  label: string
  remove: () => void
  /** Handles for the row's fields */
  handle: FormoRowHandle
}

/** State of a repeatable group — what `blueprint` / `blueprintRow` views get as `formo` */
export interface FormoBlueprintState extends FormoGroupState {
  /** id of the title element (the group is `aria-labelledby` it) */
  titleId: string
  rows: FormoBlueprintRowState[]
  canAdd: boolean
  canRemove: boolean
  add: () => void
  remove: (index: number) => void
  addText: string
  removeText: string
}

/** State of the form — what the `form` view gets as `formo` */
export interface FormoFormState {
  form: FormoController
  /** The form's own error (form rules, 419/5xx…) */
  error: string | undefined
  classes: FormoClasses
  /** Handles for the form's fields */
  fields: FormoFields
}

/** What the `errorSummary` view (<FormoErrorSummary>) gets as `formo` */
export interface FormoErrorSummaryState {
  form: FormoController
  title: string
  items: Array<{ path: string; message: string; href?: string }>
  classes: FormoClasses
}

export function baseOptions(global?: FormoOptions | null): FormoResolvedOptions {
  return applyLayer(
    {
      theme: defaultTheme,
      views: {},
      components: {},
      classLayers: [],
      classes: defaultTheme.classes,
      drivers: { ...defaultDrivers },
      rules: { ...builtinRules },
      config: defaultConfig,
    },
    global ?? undefined,
  )
}

export interface OptionsLayer extends FormoOptions {}

/**
 * Apply one layer of overrides on top of the resolved options. `theme` is either
 * a whole theme (it becomes the base; overrides from above still apply) or a
 * layer of overrides; `views` / `components` / `classes` are overrides too.
 */
export function applyLayer(base: FormoResolvedOptions, layer?: OptionsLayer): FormoResolvedOptions {
  if (!layer) return base
  const { drivers, rules, config } = layer
  const newTheme = isTheme(layer.theme) ? layer.theme : undefined
  const themeLayer: FormoThemeLayer | undefined = layer.theme && !newTheme ? asThemeLayer(layer.theme) : undefined
  const views = themeLayer?.views || layer.views ? { ...themeLayer?.views, ...layer.views } : undefined
  const components = themeLayer?.components || layer.components ? { ...themeLayer?.components, ...layer.components } : undefined
  const classLayers = [themeLayer?.classes, layer.classes].filter(Boolean) as Array<Partial<FormoClasses>>
  if (!newTheme && !views && !components && !classLayers.length && !drivers && !rules && !config) return base

  const theme: FormoTheme = newTheme ?? base.theme
  const allClassLayers = classLayers.length ? [...base.classLayers, ...classLayers] : base.classLayers
  const classes = newTheme
    ? mergeClassMaps(theme.mergeClasses, theme.classes, ...allClassLayers)
    : classLayers.length
      ? mergeClassMaps(theme.mergeClasses, base.classes, ...classLayers)
      : base.classes

  return {
    theme,
    views: views ? { ...base.views, ...rawComponents(views as Record<string, ComponentRef>) } : base.views,
    components: components ? { ...base.components, ...rawComponents(components) } : base.components,
    classLayers: allClassLayers,
    classes,
    drivers: drivers ? { ...base.drivers, ...drivers } : base.drivers,
    rules: rules ? { ...base.rules, ...rules } : base.rules,
    config: config ? deepMerge(base.config, config) : base.config,
  }
}

/** A node's own `classes` over the resolved ones (merged the theme's way) */
export function nodeClasses(options: FormoResolvedOptions, classes: Partial<FormoClasses> | undefined): FormoClasses {
  return classes ? mergeClassMaps(options.theme.mergeClasses, options.classes, classes) : options.classes
}

export function injectFormoOptions(): ComputedRef<FormoResolvedOptions> {
  const opts = inject(FormoOptionsKey, null)
  if (!opts) throw new Error('[formo] Formo components must be used inside <FormoForm>')
  return opts
}

export function injectController(): FormoController {
  const ctrl = inject(FormoControllerKey, null)
  if (!ctrl) throw new Error('[formo] Formo components must be used inside <FormoForm>')
  return ctrl
}
