import type { InjectionKey, Ref } from 'vue'

export interface SelectContext {
  model: Ref<unknown>
  open: Ref<boolean>
  multiple: Ref<boolean>
  disabled: Ref<boolean>
  /** Item labels by value (items register themselves, like Reka UI's) */
  labels: Map<unknown, string>
  isSelected: (value: unknown) => boolean
  select: (value: unknown) => void
  setOpen: (open: boolean) => void
}
export const SelectKey: InjectionKey<SelectContext> = Symbol('stub-select')
