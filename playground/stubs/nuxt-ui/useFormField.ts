import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

/** What UFormField shares with the input inside it (like Nuxt UI's formFieldInjectionKey / inputIdInjectionKey) */
export interface FormFieldContext {
  inputId: Ref<string | undefined>
  ariaId: string
  error: ComputedRef<string | boolean | undefined>
  described: ComputedRef<string[]>
}
export const FormFieldKey: InjectionKey<FormFieldContext | undefined> = Symbol('stub-form-field')

/** Like Nuxt UI's useFormField(): the field's id, error color and aria attributes for an input */
export function useFormField(props: { id?: string; color?: string; highlight?: boolean }, opts: { bind?: boolean } = {}) {
  const field = inject(FormFieldKey, undefined)
  provide(FormFieldKey, undefined) // no nesting
  if (field && opts.bind !== false && props.id) field.inputId.value = props.id
  if (field && opts.bind === false) field.inputId.value = undefined
  return {
    id: computed(() => props.id ?? field?.inputId.value),
    color: computed(() => (field?.error.value ? 'error' : props.color)),
    highlight: computed(() => (field?.error.value ? true : props.highlight)),
    ariaAttrs: computed(() =>
      field
        ? {
            'aria-invalid': !!field.error.value,
            ...(field.described.value.length ? { 'aria-describedby': field.described.value.join(' ') } : {}),
          }
        : {},
    ),
  }
}

let nextId = 0
export const useStubId = () => `nuxt-ui-${nextId++}`

/** Ring classes like Nuxt UI's `color` / `highlight` */
export const ring = (color?: string, highlight?: boolean) =>
  color === 'error' || highlight ? 'ring-2 ring-inset ring-error' : 'ring ring-inset ring-accented focus-visible:ring-2 focus-visible:ring-primary'
