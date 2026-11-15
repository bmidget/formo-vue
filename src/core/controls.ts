import { markRaw, toRaw } from 'vue'
import type { ComponentRef, ControlModel, FormoControl } from '../types'
import type { FormoFieldState } from '../composables/context'

export interface ControlInput {
  component: ComponentRef
  /** Props computed from the field's state — the field's own `props` win over them */
  props?: (field: FormoFieldState) => Record<string, unknown>
  model?: ControlModel
  /** The component renders its own named form input(s): no hidden mirror inputs for native submits */
  native?: boolean
}

/**
 * Use any component as a field's control, with its contract spelled out once —
 * in `components` (app, form, group, theme) or as a field's `component`:
 *
 * ```ts
 * createFormo({
 *   components: {
 *     input: defineControl({
 *       component: UInput,
 *       props: (field) => ({ type: field.node.type, color: field.invalid ? 'error' : undefined }),
 *       native: true,
 *     }),
 *     set: defineControl({
 *       component: UCheckboxGroup,
 *       props: (field) => ({ items: field.options }),
 *       model: { get: (v) => String(v ?? '').split(',').filter(Boolean), set: (v) => (v as string[]).join(',') },
 *     }),
 *   },
 * })
 * ```
 */
export function defineControl(input: ControlInput): FormoControl {
  const component = input.component && typeof input.component === 'object' ? markRaw(toRaw(input.component)) : input.component
  return markRaw({ ...input, component, __formoControl: true as const })
}

export function isControl(value: unknown): value is FormoControl {
  return !!value && typeof value === 'object' && (value as FormoControl).__formoControl === true
}
