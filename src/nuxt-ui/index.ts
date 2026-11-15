/**
 * formo-vue/nuxt-ui — Formo's fields rendered with Nuxt UI (v4) components.
 *
 * Nothing here imports `@nuxt/ui`: you pass the components in, so apps that
 * don't use Nuxt UI never need it, and Nuxt UI stays yours to configure.
 *
 * ```ts
 * import { createFormo } from 'formo-vue'
 * import { nuxtUiTheme } from 'formo-vue/nuxt-ui'
 * // Nuxt: from '#components' · Vue + Vite: import UInput from '@nuxt/ui/components/Input.vue'…
 * import { UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton } from '#components'
 *
 * app.use(createFormo({
 *   theme: nuxtUiTheme({ UFormField, UInput, UTextarea, USelect, USelectMenu, UCheckbox, USwitch, URadioGroup, UCheckboxGroup, UButton }),
 * }))
 * ```
 *
 * Swap controls by name: `{ driver: 'select', component: 'select-menu' }` (one field),
 * `components: { checkbox: 'switch' }` (a form, a group, the app).
 */
import { defineComponent, h, type Component, type PropType, type Slots, type VNodeChild } from 'vue'
import type { FormoClasses, FormoControl, FormoOption, FormoOptionItem, FormoTheme } from '../types'
import type { FormoFieldState } from '../composables/context'
import { defineControl } from '../core/controls'
import { defineTheme, tailwindMergeClasses } from '../core/theme'
import { flattenOptions, isOptionGroup } from '../core/options'
import { getTranslator } from '../i18n/translator'
import FormoInputControl from '../components/controls/FormoInputControl.vue'
import { FormoErrorsView, FormoHelpView, FormoLabelView } from '../components/views'

/** The Nuxt UI components the theme renders with — pass the real ones */
export interface NuxtUiComponents {
  UFormField: Component
  UInput: Component
  UTextarea: Component
  USelect: Component
  UCheckbox: Component
  URadioGroup: Component
  UCheckboxGroup: Component
  /** Registered as the `select-menu` control (searchable): `{ driver: 'select', component: 'select-menu' }` */
  USelectMenu?: Component
  /** Registered as the `switch` control: `{ driver: 'bool', component: 'switch' }` */
  USwitch?: Component
  /** Buttons (`driver: 'button'`) — otherwise Formo's own, with Nuxt UI classes */
  UButton?: Component
}

/**
 * Formo options → Nuxt UI `items` (`{ label, value, disabled }` — the same keys).
 * Optgroups become Nuxt UI groups: arrays led by a `{ type: 'label' }` item.
 */
export function toItems(options: FormoOptionItem[]): unknown[] {
  if (!options.some(isOptionGroup)) return (options as FormoOption[]).map(({ label, value, disabled }) => ({ label, value, disabled }))
  const groups: unknown[][] = []
  let loose: unknown[] = []
  for (const item of options) {
    if (isOptionGroup(item)) {
      if (loose.length) groups.push(loose)
      loose = []
      groups.push([{ type: 'label', label: item.label }, ...item.options.map(({ label, value, disabled }) => ({ label, value, disabled }))])
    } else {
      loose.push({ label: item.label, value: item.value, disabled: item.disabled })
    }
  }
  if (loose.length) groups.push(loose)
  return groups
}

/** Flat `items` (radio / checkbox groups have no optgroups) */
const flatItems = (field: FormoFieldState) => flattenOptions(field.options).map(({ label, value, disabled }) => ({ label, value, disabled }))

/** Invalid → Nuxt UI's error look (inside a UFormField it's automatic; in your own markup it isn't) */
const errorLook = (field: FormoFieldState) => ({ color: field.invalid ? 'error' : undefined, highlight: field.invalid || undefined })

const placeholder = (field: FormoFieldState) => {
  const blank = field.node.blank
  return typeof blank === 'string' ? getTranslator(field.form.options.config).text(blank) : undefined
}

/** The classes of Formo's own elements (groups, repeatable rows, checklists, fallbacks…) in Nuxt UI's design tokens */
export const nuxtUiClasses: FormoClasses = {
  form: 'space-y-6',
  formError: 'rounded-md bg-error/10 px-4 py-3 text-sm text-error ring ring-inset ring-error/25',

  group: 'min-w-0 space-y-4 rounded-lg p-4 ring ring-default sm:p-6',
  groupLegend: 'float-left w-full pb-4 text-base font-semibold text-highlighted [&+*]:clear-left',
  groupBody: 'space-y-4',
  groupError: 'text-sm text-error',

  field: 'min-w-0',
  fieldInline: 'min-w-0',
  fieldBare: 'min-w-0',
  fieldset: 'm-0 min-w-0 border-0 p-0',

  label: 'block text-sm font-medium text-default',
  labelInline: 'inline-flex items-center gap-2 text-sm text-default',
  required: 'ms-0.5 text-error',
  title: 'mb-1 block text-sm font-medium text-default',

  control: [
    'w-full rounded-md border-0 bg-default px-2.5 py-1.5 text-sm text-highlighted placeholder:text-dimmed outline-none',
    'ring ring-inset ring-accented focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-75',
  ].join(' '),
  controlInvalid: 'ring-error focus-visible:ring-error',
  select: 'pe-8',
  textarea: '',
  file: 'block w-full text-sm text-muted file:me-3 file:rounded-md file:border-0 file:bg-elevated file:px-2.5 file:py-1.5 file:text-sm file:font-medium file:text-default',
  color: 'h-8 w-14 cursor-pointer rounded-md bg-default p-1 ring ring-inset ring-accented',
  range: 'w-full accent-primary',

  checkbox: 'size-4 shrink-0 rounded-sm accent-primary',
  radio: 'size-4 shrink-0 accent-primary',
  optionList: 'flex flex-col gap-1',
  optionLabel: 'inline-flex items-center gap-2 text-sm text-default',
  optionText: '',

  help: 'text-sm text-muted',
  error: 'text-sm text-error',
  uneditable: 'py-1.5 text-sm text-highlighted',

  button: 'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-75',
  buttonPrimary: 'bg-primary text-inverted hover:bg-primary/75',
  buttonSecondary: 'text-default ring ring-inset ring-accented hover:bg-elevated',

  blueprint: 'min-w-0 space-y-3',
  blueprintRow: 'relative space-y-4 rounded-lg p-4 ring ring-default',
  blueprintRowHeader: 'flex items-center justify-between text-xs font-semibold uppercase text-muted',
  blueprintRemove: 'rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-elevated hover:text-error',
  blueprintAdd: 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-default ring ring-inset ring-accented hover:bg-elevated',

  errorSummary: 'rounded-md bg-error/10 p-4 text-sm text-error ring ring-inset ring-error/25',
  errorList: 'list-disc space-y-0.5 ps-4 text-sm text-error',
  ignored: 'opacity-75 transition-opacity',

  checklist: 'space-y-1.5 rounded-md bg-elevated/50 px-3 py-2.5 ring ring-default',
  checklistItem: 'flex items-center gap-2 text-xs transition-colors',
  checklistMet: 'text-success',
  checklistUnmet: 'text-muted',
  checklistFailed: 'text-error',
}

const formoProp = { formo: { type: Object as PropType<FormoFieldState>, required: true as const } }

/**
 * UFormField's slots, filled with the field's regions. UFormField shows the
 * error *or* the help (like Nuxt UI), so only one of them is given.
 */
function formFieldSlots(field: FormoFieldState, slots: Slots, withLabel: boolean) {
  const out: Record<string, () => VNodeChild> = {
    default: () => [slots.input?.(), slots.checklist?.()],
  }
  if (withLabel && field.label) out.label = () => slots.label?.({ as: 'span' })
  if (field.invalid) out.error = () => slots.errors?.({ as: 'span' })
  else if (field.message) out.help = () => slots.help?.({ as: 'span' })
  return out
}

function formFieldProps(field: FormoFieldState, withLabel: boolean) {
  return {
    label: withLabel ? field.label || undefined : undefined,
    required: withLabel ? field.required : undefined,
    error: field.invalid ? (field.error ?? true) : false,
    help: field.invalid ? undefined : field.message,
    'data-formo-driver': field.node.driver,
    'data-invalid': field.invalid || undefined,
  }
}

/** The theme's views and controls for these components */
export function nuxtUiTheme(c: NuxtUiComponents): FormoTheme {
  /** `field` — UFormField: label, the control (+ checklist), then the error or the help */
  const FieldView = defineComponent({
    name: 'NuxtUiFieldView',
    props: formoProp,
    setup: (props, { slots }) => () => h(c.UFormField, formFieldProps(props.formo, true), formFieldSlots(props.formo, slots, true)),
  })

  /** `inline` / `fieldset` / `bare` — the control labels itself (UCheckbox, URadioGroup's legend…) or has no label */
  const SelfLabelledView = defineComponent({
    name: 'NuxtUiSelfLabelledView',
    props: formoProp,
    setup: (props, { slots }) => () => h(c.UFormField, formFieldProps(props.formo, false), formFieldSlots(props.formo, slots, false)),
  })

  /** The parts: just their text inside UFormField (it draws the label, error and help), Formo's own elsewhere */
  const bare = (fallback: Component, render: (field: FormoFieldState) => VNodeChild) =>
    defineComponent({
      props: { ...formoProp, as: { type: String, default: undefined } },
      inheritAttrs: false,
      setup: (props, { attrs }) => () =>
        props.as === 'span' ? render(props.formo) : h(fallback as any, { ...attrs, formo: props.formo, ...(props.as ? { as: props.as } : {}) }),
    })

  const LabelPart = bare(FormoLabelView, (field) => field.label)
  const HelpPart = bare(FormoHelpView, (field) => (field.message ? h('span', { id: field.helpId }, field.message) : null))
  const ErrorsPart = bare(FormoErrorsView, (field) => {
    if (!field.error) return null
    if (field.errorDisplay === 'all' && field.errors.length > 1) {
      return h('ul', { id: field.errorId, class: 'list-disc ps-4' }, field.errors.map((message) => h('li', { key: message }, message)))
    }
    return h('span', { id: field.errorId }, field.error)
  })

  const select = (component: Component) =>
    defineControl({
      component,
      props: (field) => ({ ...errorLook(field), items: toItems(field.options), multiple: !!field.node.attr.multiple || undefined, placeholder: placeholder(field) }),
      native: true,
    })
  const toggle = (component: Component) =>
    defineControl({ component, props: (field) => ({ ...errorLook(field), label: field.label, required: field.required }), native: true })
  const group = (component: Component) =>
    defineControl({
      component,
      props: (field) => ({
        ...errorLook(field),
        items: flatItems(field),
        legend: field.label || undefined,
        required: field.required,
        orientation: field.node.vars.inline ? 'horizontal' : undefined,
      }),
      native: true,
    })

  const components: Record<string, FormoControl | Component> = {
    input: defineControl({ component: c.UInput, props: errorLook, native: true }),
    textarea: defineControl({ component: c.UTextarea, props: errorLook, native: true }),
    select: select(c.USelect),
    checkbox: toggle(c.UCheckbox),
    radios: group(c.URadioGroup),
    checkboxes: group(c.UCheckboxGroup),
    // MySQL SET: a comma-separated string in, an array for UCheckboxGroup
    set: defineControl({
      component: c.UCheckboxGroup,
      props: (field) => ({ ...errorLook(field), items: flatItems(field), legend: field.label || undefined, required: field.required }),
      model: {
        get: (value) => String(value ?? '').split(',').filter(Boolean),
        set: (value) => (Array.isArray(value) ? value.map(String).join(',') : ''),
      },
      native: true,
    }),
    // Nuxt UI has no equivalent worth forcing: Formo's own inputs, in Nuxt UI classes
    'input|hidden': FormoInputControl,
    'input|range': FormoInputControl,
    'input|color': FormoInputControl,
    'input|submit': FormoInputControl,
    'input|reset': FormoInputControl,
    'input|button': FormoInputControl,
    'input|image': FormoInputControl,
  }
  if (c.USelectMenu) components['select-menu'] = select(c.USelectMenu)
  if (c.USwitch) components.switch = toggle(c.USwitch)
  if (c.UButton) {
    components.button = defineControl({
      component: c.UButton,
      props: (field) => {
        const type = String(field.node.attr.type ?? 'button')
        const variant = field.node.vars.variant ?? (type === 'submit' ? 'primary' : 'secondary')
        return {
          type,
          label: field.text,
          loading: type === 'submit' && field.form.submitting,
          ...(variant === 'primary' ? {} : { color: 'neutral', variant: 'outline' }),
          onClick: (event: MouseEvent) => {
            const onClick = field.node.vars.onClick
            if (typeof onClick === 'function') onClick(event, field.form)
            if (type === 'reset') {
              event.preventDefault()
              field.form.reset()
            }
          },
        }
      },
    })
  }

  return defineTheme({
    name: 'nuxt-ui',
    views: {
      field: FieldView,
      inline: SelfLabelledView,
      fieldset: SelfLabelledView,
      bare: SelfLabelledView,
      label: LabelPart,
      help: HelpPart,
      errors: ErrorsPart,
    },
    components,
    classes: nuxtUiClasses,
    mergeClasses: tailwindMergeClasses,
  })
}
