import { twMerge } from 'tailwind-merge'
import type { FormoTheme } from '../types'

/**
 * The default Tailwind theme. Every element Formo renders takes its classes from
 * one of these keys, so restyling never requires touching a component:
 *
 *   createFormo({ theme: { control: 'rounded-none border-2' } })   // merged with tailwind-merge
 *   <FormoForm :theme="{ label: 'uppercase tracking-wide' }" />     // per form
 *   { alias: 'bio', classes: { control: 'font-mono' } }             // per field
 *   { alias: 'address', driver: 'group', theme: {...} }             // cascades into a group
 *
 * NOTE: Tailwind has to see these class names. Add the library to your sources:
 *   @source "../node_modules/formo-vue/src";
 */
export const defaultTheme: FormoTheme = {
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

/** Merge theme layers; class strings of the same key are merged with tailwind-merge */
export function mergeTheme(base: FormoTheme, ...layers: Array<Partial<FormoTheme> | undefined>): FormoTheme {
  const out = { ...base }
  for (const layer of layers) {
    if (!layer) continue
    for (const key of Object.keys(layer) as Array<keyof FormoTheme>) {
      const value = layer[key]
      if (value === undefined) continue
      out[key] = twMerge(out[key], value)
    }
  }
  return out
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
