import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  watch,
  watchEffect,
  type PropType,
  type VNode,
} from 'vue'
import { FormContextKey } from 'vee-validate'
import type { FormoController, FormoPart } from '../types'
import {
  applyLayer,
  FormoControllerKey,
  FormoOptionsKey,
  FormoContainerKey,
  FormoSlotsKey,
} from '../composables/context'
import { locate } from '../core/locate'
import FormoNode from './FormoNode'
import FormoChildren from './FormoChildren.vue'

const formKeys = new WeakMap<object, number>()
let nextFormKey = 0
/** A stable key per form (to key components by form) */
export function formKey(form: object): number {
  let key = formKeys.get(form)
  if (key === undefined) formKeys.set(form, (key = nextFormKey++))
  return key
}

/** `street` inside the `address` scope → `address.street`; `[0].number` → `phones[0].number` */
function scoped(scope: string, path: string) {
  if (!scope) return path
  return path.startsWith('[') ? `${scope}${path}` : `${scope}.${path}`
}

/**
 * Render any part of a form on its own, at every level:
 *
 * ```vue
 * <FormoRender path="address" />                 <!-- a whole subform -->
 * <FormoRender path="email" />                   <!-- a field: label, control, help, errors -->
 * <FormoRender path="email" part="input" />      <!-- just the control -->
 * <FormoRender path="email" part="label" />      <!-- / errors / help / checklist (the theme's views) -->
 * <FormoRender :form="form" path="email" />      <!-- anywhere, even outside <FormoForm> -->
 * ```
 *
 * Paths resolve relative to the enclosing subform first (inside a subform's
 * custom layout, `path="street"` is `address.street`), then from the form, then
 * by alias (searched recursively).
 *
 * Place each field once; `<FormoRest />` renders whatever you didn't place.
 */
export default defineComponent({
  name: 'FormoRender',
  props: {
    /** Path (`address.street`, `phones[0].number`) or alias. Empty: the whole form's fields */
    path: { type: String, default: '' },
    part: { type: String as PropType<FormoPart>, default: 'field' },
    /** The form (from `useFormo()`). Optional inside <FormoForm> */
    form: { type: Object as PropType<FormoController>, default: undefined },
    /** `path` is exact and absolute: no resolving relative to the subform you're in, nor by alias (handles) */
    exact: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const injected = inject(FormoControllerKey, null)
    const controller = props.form ?? injected
    if (!controller) {
      throw new Error('[formo] <FormoRender> needs :form (a useFormo() controller) or a parent <FormoForm>')
    }

    // No <FormoForm> for this form above us: we're the root of this part of the page
    const standalone = injected !== controller
    const parentOptions = standalone ? computed(() => controller.options) : inject(FormoOptionsKey)!
    if (standalone) {
      provide(FormoControllerKey, controller)
      provide(FormContextKey, controller._vee as any)
      provide(FormoSlotsKey, {})
      // The form is a node too: form-level rules & callbacks keep working without <FormoForm>
      watch(
        () => controller.root,
        (node, _old, onCleanup) => {
          onCleanup(controller._register({ node, path: '', parentPath: '', kind: 'form', label: () => String(node.label || node.alias) }))
        },
        { immediate: true },
      )
    }

    const container = standalone ? () => ({ path: '', prefix: '' }) : inject(FormoContainerKey, () => ({ path: '', prefix: '' }))

    const located = computed(() => {
      const { drivers, config } = parentOptions.value
      const root = controller.root
      if (props.exact) return locate(root, props.path, drivers, config, { byAlias: false })
      const prefix = container().prefix
      if (prefix && props.path) {
        const target = scoped(prefix, props.path)
        const relative = locate(root, target, drivers, config)
        if (relative?.path === target) return relative
      }
      return locate(root, props.path, drivers, config)
    })

    // Subforms / groups between the form and this part still cascade their overrides
    const options = computed(() => {
      let opts = parentOptions.value
      for (const ancestor of located.value?.ancestors ?? []) {
        opts = applyLayer(opts, { components: ancestor.components, config: ancestor.config, theme: ancestor.theme })
      }
      return opts
    })
    provide(FormoOptionsKey, options)

    // Tell <FormoRest> this path is placed by hand
    watchEffect((onCleanup) => {
      const path = located.value?.path
      if (path && (props.part === 'field' || props.part === 'input')) onCleanup(controller._claim(path))
    })

    let warned = false

    return (): VNode | VNode[] | null => {
      const loc = located.value
      if (!loc) {
        if (!warned && import.meta.env?.DEV) console.warn(`[formo] <FormoRender path="${props.path}">: no such field or subform`)
        warned = true
        return null
      }
      const opts = options.value
      const part = props.part

      // The whole form's fields (no <form> element — that's <FormoForm>)
      if (loc.path === '') {
        if (part === 'errors') {
          const message = controller.error('')
          return message ? h('p', { class: opts.classes.formError, role: 'alert' }, message) : null
        }
        return h(FormoChildren, { fields: controller.root.fields, prefix: '', parentAlias: controller.root.alias, groupPath: '' })
      }

      if (part === 'field' || part === 'input') {
        return h(
          FormoNode,
          {
            // Not keyed by path: a field whose row moves (`phones[1]` → `phones[0]`) keeps its component,
            // like the rows the theme renders (the engines follow path changes)
            node: loc.node,
            path: loc.path,
            parentPath: loc.parentPath,
            parentAlias: loc.parentAlias,
            groupPath: loc.groupPath,
            part,
          },
          slots,
        )
      }

      // Single pieces: the field's parts (theme views) — they read its live state, so it must be rendered somewhere
      const state = controller.find(loc.path)?.state
      if (!state) {
        const message = part === 'errors' ? controller.error(loc.path) : undefined
        return message ? h('p', { class: opts.classes.groupError, role: 'alert' }, message) : null
      }
      return h(state._parts[part])
    }
  },
})
