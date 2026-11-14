import type { Condition, FormoValueContext } from '../types'
import { sameValue } from './options'
import { getPath, isEmptyValue, isPlainObject, toArray } from './utils'

/** Read a referenced field: `@type` or `type`, relative to the group first, then from the form root */
export function refValue(ref: string, ctx: Pick<FormoValueContext, 'values' | 'parentValues'>): unknown {
  const path = ref.replace(/^@/, '')
  const relative = getPath(ctx.parentValues, path)
  return relative !== undefined ? relative : getPath(ctx.values, path)
}

/** Loose equality that also understands how values arrive from rule strings (`'true'`, `'1'`) */
export function looseEquals(value: unknown, expected: unknown): boolean {
  if (Array.isArray(value)) return value.some((v) => looseEquals(v, expected))
  if (typeof value === 'boolean' && typeof expected === 'string') {
    return value ? ['true', '1', 'on', 'yes'].includes(expected) : ['false', '0', '', 'off', 'no'].includes(expected)
  }
  if ((value === null || value === undefined) && (expected === 'null' || expected === '')) return true
  return sameValue(value, expected)
}

/** Truthy in the form sense: checked, filled, non-empty */
export function isActive(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return !isEmptyValue(value) && value !== 0 && value !== '0'
}

export function evaluateCondition(condition: Condition | undefined, ctx: FormoValueContext): boolean {
  if (condition === undefined || condition === null) return false
  if (typeof condition === 'boolean') return condition
  if (typeof condition === 'function') return !!condition(ctx)
  if (isPlainObject(condition) && typeof condition.when === 'string') {
    const value = refValue(condition.when, ctx)
    if ('is' in condition) return toArray(condition.is).some((e) => looseEquals(value, e))
    if ('not' in condition) return !toArray(condition.not).some((e) => looseEquals(value, e))
    if (typeof condition.filled === 'boolean') return condition.filled === !isEmptyValue(value)
    return isActive(value)
  }
  return false
}
