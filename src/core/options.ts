import type { FormoOption, FormoOptionGroup, FormoOptionItem, FormoOptionsInput } from '../types'
import { isPlainObject } from './utils'

export function isOptionGroup(item: FormoOptionItem): item is FormoOptionGroup {
  return Array.isArray((item as FormoOptionGroup).options)
}

/**
 * Normalize any supported `opts` shape into `[{ value, label }]` / optgroups.
 * Object keys are used as values (Formo: `$key => $label`), nested objects become optgroups.
 */
export function normalizeOptions(input: FormoOptionsInput | undefined | null): FormoOptionItem[] {
  if (!input) return []

  if (Array.isArray(input)) {
    return input.map((item): FormoOptionItem => {
      if (Array.isArray(item)) {
        return { value: item[0], label: String(item[1] ?? item[0]) }
      }
      if (isPlainObject(item)) {
        if (Array.isArray(item.options)) {
          return {
            ...(item as any),
            label: String(item.label ?? ''),
            options: normalizeOptions(item.options as FormoOptionsInput) as FormoOption[],
          }
        }
        if ('value' in item) {
          return { ...(item as any), label: String(item.label ?? item.value) }
        }
      }
      return { value: item, label: String(item) }
    })
  }

  if (isPlainObject(input)) {
    return Object.keys(input).map((key): FormoOptionItem => {
      const label = input[key]
      if (isPlainObject(label) || Array.isArray(label)) {
        return { label: key, options: normalizeOptions(label as FormoOptionsInput) as FormoOption[] }
      }
      return { value: key, label: String(label) }
    })
  }

  return []
}

/** All options, optgroups flattened */
export function flattenOptions(items: FormoOptionItem[]): FormoOption[] {
  return items.flatMap((item) => (isOptionGroup(item) ? item.options : [item]))
}

/** Loose equality like PHP's `==` used by Formo's templates (`1 == '1'`) */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a === 'object' || typeof b === 'object') return false
  return String(a) === String(b)
}

export function optionLabel(items: FormoOptionItem[], value: unknown): string | undefined {
  return flattenOptions(items).find((o) => sameValue(o.value, value))?.label
}
