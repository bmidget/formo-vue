import { inject, markRaw, toRaw, type ComputedRef, type InjectionKey, type Slots } from 'vue'
import type { FieldContext } from 'vee-validate'
import type {
  ChecklistItem,
  ComponentRef,
  ErrorDisplay,
  FormoController,
  FieldNode,
  FormoOptionItem,
  FormoOptions,
  FormoResolvedOptions,
  FormoTheme,
  WrapperLayout,
} from '../types'
import { defaultConfig } from '../core/config'
import { defaultDrivers } from '../core/drivers'
import { builtinRules } from '../core/rules'
import { defaultTheme, mergeTheme } from '../core/theme'
import { deepMerge } from '../core/utils'

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
  /** The theme, resolved for this field (includes `classes`) */
  classes: FormoTheme
  /** HTML attributes for the control (id, name, aria-*, plus the field's `attr`) */
  attrs: Record<string, unknown>
  layout: WrapperLayout
  labelAs: 'label' | 'title' | false
  helpId: string
  errorId: string
  disabled: boolean
  /** The underlying vee-validate field */
  field?: FieldContext<any>
  /** The form controller */
  form: FormoController
}

export function baseOptions(global?: FormoOptions | null): FormoResolvedOptions {
  return applyLayer(
    {
      components: {},
      drivers: { ...defaultDrivers },
      rules: { ...builtinRules },
      config: defaultConfig,
      theme: defaultTheme,
    },
    global ?? undefined,
  )
}

/** Apply one layer of overrides on top of the resolved options */
export function applyLayer(
  base: FormoResolvedOptions,
  layer?: {
    components?: Record<string, ComponentRef>
    drivers?: FormoOptions['drivers']
    rules?: FormoOptions['rules']
    config?: FormoOptions['config']
    theme?: FormoOptions['theme']
  },
): FormoResolvedOptions {
  if (!layer) return base
  const { components, drivers, rules, config, theme } = layer
  if (!components && !drivers && !rules && !config && !theme) return base
  return {
    components: components ? { ...base.components, ...rawComponents(components) } : base.components,
    drivers: drivers ? { ...base.drivers, ...drivers } : base.drivers,
    rules: rules ? { ...base.rules, ...rules } : base.rules,
    config: config ? deepMerge(base.config, config) : base.config,
    theme: theme ? mergeTheme(base.theme, theme) : base.theme,
  }
}

function rawComponents(map: Record<string, ComponentRef>): Record<string, ComponentRef> {
  const out: Record<string, ComponentRef> = {}
  for (const [key, value] of Object.entries(toRaw(map))) {
    out[key] = value && typeof value === 'object' ? markRaw(toRaw(value)) : value
  }
  return out
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
