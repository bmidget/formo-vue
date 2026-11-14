import type { FormoDriver, FieldNode, FormoOptionItem } from '../types'
import FormoInput from '../components/controls/FormoInput.vue'
import FormoTextarea from '../components/controls/FormoTextarea.vue'
import FormoSelect from '../components/controls/FormoSelect.vue'
import FormoCheckbox from '../components/controls/FormoCheckbox.vue'
import FormoChoices from '../components/controls/FormoChoices.vue'
import FormoDatalist from '../components/controls/FormoDatalist.vue'
import FormoFile from '../components/controls/FormoFile.vue'
import FormoButton from '../components/controls/FormoButton.vue'
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
    component: markBuiltin(FormoInput),
    layout: (node) => (NO_LABEL_TYPES.has(node.type ?? '') ? 'bare' : 'stacked'),
    labelAs: (node) => (NO_LABEL_TYPES.has(node.type ?? '') ? false : 'label'),
    defaultValue: (node) => (node.type === 'number' || node.type === 'range' ? null : ''),
    // Formo `input_rules`: html5 types get validation rules automatically
    rules: (node, config) => config.inputRules[node.type ?? 'text'],
  },

  textarea: {
    component: markBuiltin(FormoTextarea),
    defaultValue: () => '',
  },

  select: {
    component: markBuiltin(FormoSelect),
    defaultValue: (node) => (node.attr.multiple ? [] : null),
    display: displayOptions,
  },

  datalist: {
    component: markBuiltin(FormoDatalist),
    defaultValue: () => '',
  },

  /** A single boolean checkbox (Formo `checkbox` / `bool`) */
  checkbox: {
    component: markBuiltin(FormoCheckbox),
    layout: 'inline',
    defaultValue: () => false,
    display: (value) => (value ? 'Yes' : 'No'),
  },

  checkboxes: {
    component: markBuiltin(FormoChoices),
    labelAs: 'title',
    defaultValue: () => [],
    display: displayOptions,
  },

  radios: {
    component: markBuiltin(FormoChoices),
    labelAs: 'title',
    defaultValue: () => null,
    display: displayOptions,
  },

  /** Checkboxes whose value is a comma separated string (MySQL SET columns) */
  set: {
    component: markBuiltin(FormoChoices),
    labelAs: 'title',
    defaultValue: () => '',
    display: (value, node, options) =>
      displayOptions(String(value ?? '').split(',').filter(Boolean), node, options),
  },

  file: {
    component: markBuiltin(FormoFile),
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
    component: markBuiltin(FormoButton),
    layout: 'bare',
    labelAs: false,
    valueless: true,
  },
}

export function resolveLayout(driver: FormoDriver | undefined, node: FieldNode) {
  const layout = driver?.layout
  return (typeof layout === 'function' ? layout(node) : layout) ?? 'stacked'
}

export function resolveLabelAs(driver: FormoDriver | undefined, node: FieldNode) {
  const as = driver?.labelAs
  return (typeof as === 'function' ? as(node) : as) ?? 'label'
}

export function defaultValueFor(driver: FormoDriver | undefined, node: FieldNode): unknown {
  return driver?.defaultValue ? driver.defaultValue(node) : ''
}
