import type { InjectionKey, Ref } from 'vue'

export interface RadioGroupContext {
  model: Ref<unknown>
  select: (value: unknown) => void
  disabled: Ref<boolean>
}
export const RadioGroupKey: InjectionKey<RadioGroupContext> = Symbol('stub-radio-group')
