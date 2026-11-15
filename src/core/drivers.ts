import type { FormoDriver, FieldNode, FormoOptionItem } from '../types'
import FormoInputControl from '../components/controls/FormoInputControl.vue'
import FormoTextareaControl from '../components/controls/FormoTextareaControl.vue'
import FormoSelectControl from '../components/controls/FormoSelectControl.vue'
import FormoCheckboxControl from '../components/controls/FormoCheckboxControl.vue'
import FormoChoicesControl from '../components/controls/FormoChoicesControl.vue'
import FormoDatalistControl from '../components/controls/FormoDatalistControl.vue'
import FormoFileControl from '../components/controls/FormoFileControl.vue'
import FormoButtonControl from '../components/controls/FormoButtonControl.vue'
import { markBuiltin } from './builtin'
import { optionLabel } from './options'
import { toArray } from './utils'

const NO_LABEL_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image'])

const displayOptions = (value: unknown, _node: FieldNode, options: FormoOptionItem[]) =>
  toArray(value)
    .map((v) => optionLabel(options, v) ?? String(v))
    .join(', ')

/**
 * The built-in drivers. Each one is the Vue equivalent of a `Formo_Driver_*`
 * class: it picks the control component and describes labels, default values,
 * automatic rules and how to display uneditable values.
 */
export const defaultDrivers: Record<string, FormoDriver> = {
  form: { parent: true },
  group: { parent: true },

  input: {
    component: markBuiltin(FormoInputControl),
    // hidden: the control alone; buttons: no label; everything else: label above
    view: (node) => (node.type === 'hidden' ? false : NO_LABEL_TYPES.has(node.type ?? '') ? 'bare' : 'field'),
    defaultValue: (node) => (node.type === 'number' || node.type === 'range' ? null : ''),
    // Formo `input_rules`: html5 types get validation rules automatically
    rules: (node, config) => config.inputRules[node.type ?? 'text'],
    // number / range: a number (or null), whatever the control emits (UI libraries' inputs emit strings)
    parse: (value, node) => {
      if (node.type !== 'number' && node.type !== 'range') return value
      if (value === '' || value === null || value === undefined) return null
      const number = Number(value)
      return Number.isNaN(number) ? value : number
    },
  },

  textarea: {
    component: markBuiltin(FormoTextareaControl),
    defaultValue: () => '',
  },

  select: {
    component: markBuiltin(FormoSelectControl),
    defaultValue: (node) => (node.attr.multiple ? [] : null),
    display: displayOptions,
  },

  datalist: {
    component: markBuiltin(FormoDatalistControl),
    defaultValue: () => '',
  },

  /** A single boolean checkbox (Formo `checkbox` / `bool`) */
  checkbox: {
    component: markBuiltin(FormoCheckboxControl),
    view: 'inline',
    defaultValue: () => false,
    display: (value) => (value ? 'Yes' : 'No'),
  },

  checkboxes: {
    component: markBuiltin(FormoChoicesControl),
    view: 'fieldset',
    defaultValue: () => [],
    display: displayOptions,
  },

  radios: {
    component: markBuiltin(FormoChoicesControl),
    view: 'fieldset',
    defaultValue: () => null,
    display: displayOptions,
  },

  /** Checkboxes whose value is a comma separated string (MySQL SET columns) */
  set: {
    component: markBuiltin(FormoChoicesControl),
    view: 'fieldset',
    defaultValue: () => '',
    display: (value, node, options) =>
      displayOptions(String(value ?? '').split(',').filter(Boolean), node, options),
  },

  file: {
    component: markBuiltin(FormoFileControl),
    defaultValue: (node) => (node.attr.multiple ? [] : null),
    display: (value) =>
      toArray(value as File | File[])
        .map((f) => (f && typeof f === 'object' && 'name' in f ? f.name : String(f)))
        .join(', '),
  },

  /** Fields that only set `component` (no driver): neutral defaults, the component does the rest */
  custom: {
    defaultValue: () => null,
  },

  button: {
    component: markBuiltin(FormoButtonControl),
    view: 'bare',
    valueless: true,
  },
}

/** The view name a driver gives its fields (`field` unless it says otherwise) */
export function driverView(driver: FormoDriver | undefined, node: FieldNode): string | false {
  const view = driver?.view
  return (typeof view === 'function' ? view(node) : view) ?? 'field'
}

export function defaultValueFor(driver: FormoDriver | undefined, node: FieldNode): unknown {
  return driver?.defaultValue ? driver.defaultValue(node) : ''
}
