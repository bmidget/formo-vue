import { twMerge } from 'tailwind-merge'
import { markRaw, toRaw } from 'vue'
import type { ComponentRef, FormoClasses, FormoTheme, FormoThemeInput, FormoThemeLayer } from '../types'

/**
 * The classes of the built-in (Tailwind) theme. Every element the built-in
 * views and controls render takes its classes from one of these keys:
 *
 *   createFormo({ classes: { control: 'rounded-none border-2' } })  // merged with tailwind-merge
 *   <FormoForm :classes="{ label: 'uppercase tracking-wide' }" />    // per form
 *   { alias: 'bio', classes: { control: 'font-mono' } }              // per field
 *   { driver: 'group', theme: { classes: {...} } }                   // cascades into a group
 *
 * NOTE: Tailwind has to see these class names. Add the library to your sources:
 *   @source "../node_modules/formo-vue/src";
 */
export const defaultClasses: FormoClasses = {
  form: 'space-y-5',
  formError:
    'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700',

  group: 'min-w-0 space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5',
  groupLegend: 'float-left w-full pb-3 text-sm font-semibold text-slate-900 [&+*]:clear-left',
  groupBody: 'space-y-4',
  groupError: 'text-sm font-medium text-rose-600',

  field: 'flex min-w-0 flex-col gap-1.5',
  fieldInline: 'flex flex-col gap-1',
  fieldBare: 'min-w-0',
  fieldset: 'm-0 min-w-0 border-0 p-0',

  label: 'text-sm font-medium text-slate-700',
  labelInline: 'inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-700',
  required: 'ml-0.5 text-rose-500',
  title: 'mb-1 text-sm font-medium text-slate-700',

  control: [
    'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs',
    'placeholder:text-slate-400 outline-none transition',
    'focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15',
    'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
  ].join(' '),
  controlInvalid: 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15',
  select: 'pr-8',
  textarea: 'min-h-24 resize-y',
  file: [
    'block w-full text-sm text-slate-600',
    'file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2',
    'file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100',
  ].join(' '),
  color: 'h-10 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1',
  range: 'w-full accent-indigo-600',

  checkbox: 'size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-indigo-600',
  radio: 'size-4 shrink-0 cursor-pointer accent-indigo-600',
  optionList: 'flex flex-col gap-2',
  optionLabel: 'inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-700',
  optionText: '',

  help: 'text-xs text-slate-500',
  error: 'text-xs font-medium text-rose-600',
  uneditable: 'py-2 text-sm text-slate-900',

  button: [
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
    'transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
  ].join(' '),
  buttonPrimary: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-indigo-600',
  buttonSecondary:
    'bg-white text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 focus-visible:outline-slate-400',

  blueprint: 'min-w-0 space-y-3',
  blueprintRow: 'relative space-y-4 rounded-xl border border-slate-200 bg-white p-4',
  blueprintRowHeader: 'flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500',
  blueprintRemove:
    'rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600',
  blueprintAdd:
    'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600',

  errorSummary: 'rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700',
  errorList: 'list-disc space-y-0.5 pl-4 text-xs font-medium text-rose-600',
  ignored: 'opacity-60 transition-opacity',

  // errorDisplay: 'checklist' — a grey box, ✗ until a requirement is met, then ✓
  checklist: 'space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5',
  checklistItem: 'flex items-center gap-2 text-xs transition-colors',
  checklistMet: 'text-emerald-700',
  checklistUnmet: 'text-slate-500',
  checklistFailed: 'text-rose-600',
}

/**
 * The built-in views and controls in shadcn's design tokens (`border-input`,
 * `text-muted-foreground`, `ring-ring`, `text-destructive`, `bg-primary`…) — a
 * shadcn look for the vanilla controls, nothing to install:
 *
 *   createFormo({ theme: defineTheme({ name: 'shadcn', classes: shadcnClasses, mergeClasses: tailwindMergeClasses }) })
 *
 * The shadcn-vue registry item (`registry/r/formo.json`) builds on it with your
 * own shadcn-vue components.
 */
export const shadcnClasses: FormoClasses = {
  form: 'space-y-6',
  formError: 'rounded-md border border-destructive/50 px-4 py-3 text-sm text-destructive',

  group: 'min-w-0 space-y-4 rounded-xl border p-4 sm:p-6',
  groupLegend: 'float-left w-full pb-4 text-base font-semibold leading-none [&+*]:clear-left',
  groupBody: 'space-y-4',
  groupError: 'text-sm font-medium text-destructive',

  field: 'grid min-w-0 content-start gap-2',
  fieldInline: 'grid content-start gap-2',
  fieldBare: 'min-w-0',
  fieldset: 'm-0 min-w-0 border-0 p-0',

  label: 'text-sm leading-none font-medium select-none',
  labelInline: 'flex items-center gap-3 text-sm leading-none font-medium',
  required: 'text-destructive',
  title: 'mb-1 text-sm leading-none font-medium',

  control: [
    'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs md:text-sm',
    'placeholder:text-muted-foreground outline-none transition-[color,box-shadow]',
    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  controlInvalid: 'border-destructive ring-destructive/20',
  select: 'pr-8',
  textarea: 'h-auto min-h-16 py-2',
  file: 'text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground',
  color: 'h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1',
  range: 'w-full accent-primary',

  checkbox: 'size-4 shrink-0 rounded-[4px] border-input accent-primary',
  radio: 'size-4 shrink-0 accent-primary',
  optionList: 'grid gap-3',
  optionLabel: 'flex items-center gap-3 text-sm font-normal',
  optionText: '',

  help: 'text-sm text-muted-foreground',
  error: 'text-sm text-destructive',
  uneditable: 'py-2 text-sm',

  button: [
    'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium shadow-xs transition-all',
    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  buttonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  buttonSecondary: 'border bg-background hover:bg-accent hover:text-accent-foreground',

  blueprint: 'min-w-0 space-y-3',
  blueprintRow: 'relative space-y-4 rounded-xl border p-4',
  blueprintRowHeader: 'flex items-center justify-between text-sm font-medium text-muted-foreground',
  blueprintRemove: 'rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-destructive',
  blueprintAdd: 'inline-flex h-9 items-center gap-2 rounded-md border border-dashed px-4 text-sm font-medium hover:bg-accent',

  errorSummary: 'rounded-lg border border-destructive/50 px-4 py-3 text-sm text-destructive',
  errorList: 'list-disc space-y-1 pl-4 text-sm text-destructive',
  ignored: 'opacity-50 transition-opacity',

  checklist: 'space-y-1.5 rounded-md border bg-muted/50 px-3 py-2.5',
  checklistItem: 'flex items-center gap-2 text-sm transition-colors',
  checklistMet: 'text-foreground',
  checklistUnmet: 'text-muted-foreground',
  checklistFailed: 'text-destructive',
}

/** Every class key, empty — what a theme that isn't extending another starts from */
const emptyClasses = Object.fromEntries(Object.keys(defaultClasses).map((k) => [k, ''])) as unknown as FormoClasses

/** Class strings joined (no conflict resolution) — the default for non-Tailwind themes */
export function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** tailwind-merge, for the built-in theme */
export function tailwindMergeClasses(...classes: Array<string | undefined>): string {
  return twMerge(...classes.filter(Boolean) as string[])
}

/** Merge class maps: every key of each layer combined with the theme's `mergeClasses` */
export function mergeClassMaps(
  merge: (...classes: Array<string | undefined>) => string,
  base: FormoClasses,
  ...layers: Array<Partial<FormoClasses> | undefined>
): FormoClasses {
  const out = { ...base }
  for (const layer of layers) {
    if (!layer) continue
    for (const key of Object.keys(layer) as Array<keyof FormoClasses>) {
      const value = layer[key]
      if (value === undefined) continue
      out[key] = merge(out[key], value)
    }
  }
  return out
}

/** Components must never be reactive */
export function rawComponents<T extends Record<string, ComponentRef | undefined>>(map: T | undefined): T {
  const out: Record<string, ComponentRef | undefined> = {}
  for (const [key, value] of Object.entries(toRaw(map ?? {})) as Array<[string, ComponentRef | undefined]>) {
    out[key] = value && typeof value === 'object' ? markRaw(toRaw(value)) : value
  }
  return out as T
}

export function isTheme(value: unknown): value is FormoTheme {
  return !!value && typeof value === 'object' && (value as FormoTheme).__formoTheme === true
}

const LAYER_KEYS = new Set(['views', 'components', 'classes'])
const warnedLayers = new WeakSet<object>()

/** A theme layer (`{ views, components, classes }`) — warns about anything else (ex: a flat class map) */
export function asThemeLayer(value: unknown): FormoThemeLayer | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (import.meta.env?.DEV && !warnedLayers.has(toRaw(value))) {
    warnedLayers.add(toRaw(value))
    const unknown = Object.keys(value).filter((k) => !LAYER_KEYS.has(k))
    if (unknown.length) {
      console.warn(
        `[formo] theme: unknown key(s) ${unknown.join(', ')}. A theme is made with defineTheme(), ` +
          'or is a layer of overrides: { views, components, classes }. Class overrides go in `classes`.',
      )
    }
  }
  return value as FormoThemeLayer
}

/**
 * Define a theme — Formo's template directory: the views that lay forms out,
 * the controls, and the classes they use.
 *
 * ```ts
 * export const bootstrap = defineTheme({
 *   name: 'bootstrap',
 *   views: { field: BsField, inline: BsCheck, error: BsFeedback, floating: BsFloating },
 *   components: { select: BsSelect },
 *   classes: { control: 'form-control', controlInvalid: 'is-invalid', label: 'form-label' },
 * })
 * app.use(createFormo({ theme: bootstrap }))
 * ```
 *
 * A theme's classes *replace* the built-in Tailwind ones (keys you don't give are
 * empty); views you don't give fall back to the built-in views. With `extends`,
 * you start from another theme instead: its views/components are kept and your
 * classes merge over its classes.
 */
export function defineTheme(input: FormoThemeInput): FormoTheme {
  const parent = input.extends
  const mergeClasses = input.mergeClasses ?? parent?.mergeClasses ?? joinClasses
  const classes = parent
    ? mergeClassMaps(parent.mergeClasses, parent.classes, input.classes)
    : { ...emptyClasses, ...(input.classes ?? {}) }
  return markRaw({
    name: input.name ?? (parent ? `${parent.name}+` : 'custom'),
    views: { ...(parent?.views ?? {}), ...rawComponents(input.views) },
    components: { ...(parent?.components ?? {}), ...rawComponents(input.components) },
    classes,
    mergeClasses,
    __formoTheme: true as const,
  })
}

/** `cx('a', cond && 'b', ['c'])` + tailwind-merge */
export function cx(...classes: unknown[]): string {
  const flat: string[] = []
  const walk = (c: unknown) => {
    if (!c) return
    if (Array.isArray(c)) c.forEach(walk)
    else if (typeof c === 'string') flat.push(c)
    else if (typeof c === 'object') {
      for (const [k, v] of Object.entries(c as Record<string, unknown>)) if (v) flat.push(k)
    }
  }
  classes.forEach(walk)
  return twMerge(flat.join(' '))
}
