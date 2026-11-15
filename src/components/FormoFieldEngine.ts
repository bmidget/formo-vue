import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  markRaw,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
  watchEffect,
  camelize,
  toHandlerKey,
  type Component,
  type PropType,
  type VNode,
  type VNodeArrayChildren,
} from 'vue'
import { useField, type FieldContext } from 'vee-validate'
import type { ChecklistItem, ErrorDisplay, FieldNode, FormoOptionItem, FormoOptionsInput } from '../types'
import {
  applyLayer,
  FormoFieldKey,
  FormoPartOwnerKey,
  FormoSlotsKey,
  injectController,
  injectFormoOptions,
  nodeClasses,
  type FormoFieldSlotProps,
  type FormoFieldState,
} from '../composables/context'
import { isBuiltin } from '../core/builtin'
import { defaultValueFor, driverView } from '../core/drivers'
import { resolveButtonText, resolveLabel } from '../core/labels'
import { normalizeOptions } from '../core/options'
import { getTranslator, type Translator } from '../i18n/translator'
import { collectFieldRules, evaluateChecklist, isCurrentlyRequired, runRules, type RunRulesOptions } from '../core/rules'
import { getPath, toId, toName } from '../core/utils'
import { nodeView, resolveControl, resolveView, type ResolvedControl } from './resolve'
import { findNodeSlot, hasContent } from './slots'

/** The regions of a field — each one a slot of the field views, and of <FormoField> */
export const FIELD_REGIONS = ['label', 'input', 'help', 'errors', 'checklist'] as const
export type FieldRegion = (typeof FIELD_REGIONS)[number]

/** Component names of the parts (as seen in devtools) */
const PART_NAMES: Record<FieldRegion, string> = {
  label: 'FormoLabelPart',
  input: 'FormoInputPart',
  help: 'FormoHelpPart',
  errors: 'FormoErrorsPart',
  checklist: 'FormoChecklistPart',
}

/** Option (and optgroup) labels are translatable texts */
function translateOptions(items: FormoOptionItem[], tr: Translator): FormoOptionItem[] {
  return items.map((item) =>
    'options' in item && Array.isArray(item.options)
      ? { ...item, label: tr.text(item.label), options: item.options.map((o) => ({ ...o, label: tr.text(o.label) })) }
      : { ...item, label: tr.text(item.label) },
  )
}

/** Does the component declare this prop? `undefined` when it declares no props at all */
function declaresProp(component: Component, prop: string): boolean | undefined {
  const props = (component as any).props
  if (!props) return undefined
  return Array.isArray(props) ? props.includes(prop) : prop in props
}

/** Custom components may emit native events instead of values */
function unwrapEventValue(value: unknown): unknown {
  if (typeof Event !== 'undefined' && value instanceof Event) {
    const target = value.target as HTMLInputElement | null
    if (!target) return undefined
    if (target.type === 'checkbox') return target.checked
    if (target.type === 'file') return target.multiple ? Array.from(target.files ?? []) : target.files?.[0] ?? null
    return target.value
  }
  return value
}

/**
 * The engine of a field (internal): binds it to VeeValidate, builds its state,
 * resolves its control and its view, and fills the view's slots with the
 * field's parts — or with the template's slots (`#input`, `#label`… on
 * <FormoField>, `#input:path`… on <FormoForm>).
 */
export default defineComponent({
  name: 'FormoFieldEngine',
  props: {
    node: { type: Object as PropType<FieldNode>, required: true },
    /** Path in the form values */
    path: { type: String, required: true },
    /** Path of the parent group ('' for the form) */
    parentPath: { type: String, default: '' },
    parentAlias: { type: [String, Number], default: undefined },
    /** Registry path of the containing group */
    groupPath: { type: String, default: '' },
    /** `field`: label, control, help, errors · `input`: the control only */
    part: { type: String as PropType<'field' | 'input'>, default: 'field' },
  },
  setup(props, { slots: ownSlots }) {
    const form = injectController()
    const parentOptions = injectFormoOptions()
    /** A field can carry its own theme / controls too (`{ theme: bootstrap }`, `{ theme: { views: {…} } }`) */
    const options = computed(() =>
      props.node.theme || props.node.components
        ? applyLayer(parentOptions.value, { theme: props.node.theme, components: props.node.components })
        : parentOptions.value,
    )
    const slots = inject(FormoSlotsKey, {})

    const driver = computed(() => options.value.drivers[props.node.driver])
    const config = computed(() => options.value.config)
    const classes = computed(() => nodeClasses(options.value, props.node.classes))
    const valueless = !!driver.value?.valueless

    const tr = computed(() => getTranslator(config.value))
    const label = computed(() => resolveLabel(props.node, props.path, config.value, props.parentAlias))
    /** Help text (translated) */
    const message = computed(() => tr.value.text(props.node.message))
    const parentValues = () => (props.parentPath ? getPath(form.values, props.parentPath) ?? {} : form.values)
    /** Ignored (itself, by a parent group, or by another field's `ignores`) → fully optional */
    const ignored = computed(() => form.isIgnored(props.path))
    const allSpecs = computed(() => collectFieldRules(props.node, driver.value?.rules?.(props.node, config.value), config.value))
    const specs = computed(() => (ignored.value ? [] : allSpecs.value))
    /** `required`, or a conditional rule (required_if…) whose condition holds right now */
    const required = computed(() => isCurrentlyRequired(specs.value, { values: form.values, parentValues: parentValues() }))

    /** `first` (default), `all` or `checklist` */
    const errorDisplay = computed<ErrorDisplay>(() => props.node.errorDisplay ?? config.value.errorDisplay)
    /** Only `first` stops at the first failing rule; `all`/`checklist` need every message */
    const bails = computed(() => (errorDisplay.value === 'first' ? config.value.bails : false))

    const ruleContext = () => ({
      node: props.node,
      path: props.path,
      alias: props.node.alias,
      label: label.value,
      values: form.values,
      parentValues: parentValues(),
      form,
    })
    const runOptions = (): RunRulesOptions => ({
      rules: options.value.rules,
      config: config.value,
      labelFor: (ref) => {
        const sibling = props.parentPath ? `${props.parentPath}.${ref}` : ref
        return form.find(sibling) ? form.label(sibling) : form.label(ref)
      },
      parentAlias: props.parentAlias,
      bails: bails.value,
    })

    /** One validator per field: compiles its rules (strings, objects, functions, schemas) and runs them in order */
    const validator = async (value: unknown) => {
      const errors = await runRules(specs.value, value, ruleContext(), runOptions())
      if (!errors.length) return true
      return bails.value ? errors[0] : errors
    }
    const rules = computed(() => (props.node.veeSchema as any) ?? validator)

    let field: FieldContext<any> | undefined
    if (!valueless) {
      const fieldOptions: Record<string, unknown> = {
        form: form._vee,
        label: () => label.value,
        validateOnValueUpdate: false,
        syncVModel: false,
      }
      if (getPath(form.values, props.path) === undefined) {
        fieldOptions.initialValue = props.node.hasVal ? props.node.val : defaultValueFor(driver.value, props.node)
      }
      field = useField<any>(() => props.path, rules as any, fieldOptions)
    }

    // Register so the form can find labels, run callbacks, route errors...
    watchEffect((onCleanup) => {
      const unregister = form._register({
        node: props.node,
        path: props.path,
        parentPath: props.parentPath,
        groupPath: props.groupPath,
        kind: 'field',
        label: () => label.value,
        get state() {
          return state
        },
        validate: field
          ? async () => {
              const r = await field!.validate()
              return { valid: r.valid, errors: r.errors }
            }
          : undefined,
      })
      onCleanup(unregister)
    })

    const hasError = () => !!field?.errorMessage.value

    // Becoming ignored clears errors; coming back re-validates if the user already saw errors
    watch(ignored, (isIgnored) => {
      if (!field) return
      if (isIgnored) field.setErrors([])
      else if (form.submitCount > 0 || field.meta.validated) field.validate()
    })

    /** Live requirement checklist (`errorDisplay: 'checklist'`), re-evaluated on every change */
    const checklist = shallowRef<ChecklistItem[]>([])
    let checklistRun = 0
    watch(
      () =>
        errorDisplay.value === 'checklist' && field
          ? [field.value.value, specs.value, label.value, tr.value.locale, JSON.stringify(form.values)]
          : null,
      async (deps) => {
        const run = ++checklistRun
        if (!deps || !field) {
          checklist.value = []
          return
        }
        const items = await evaluateChecklist(specs.value, field.value.value, ruleContext(), runOptions())
        // Ignore results of an older (slower, async) evaluation
        if (run === checklistRun) checklist.value = items
      },
      { immediate: true },
    )

    function setValue(value: unknown) {
      if (!field) return
      const mode = config.value.validationMode
      const validate =
        mode === 'aggressive' ||
        hasError() ||
        (mode === 'eager' && field.meta.touched)
      field.handleChange(value, validate)
    }

    function onBlur() {
      if (!field) return
      field.handleBlur(undefined, config.value.validationMode !== 'submit')
    }

    const options$ = computed(() => {
      const source = props.node.opts
      const input = typeof source === 'function'
        ? source({ values: form.values, parentValues: parentValues(), node: props.node, path: props.path })
        : source
      return translateOptions(normalizeOptions(input as FormoOptionsInput), tr.value)
    })

    const id = computed(() => {
      const explicit = props.node.attr.id
      if (explicit !== undefined && explicit !== null && explicit !== '') return String(explicit)
      return config.value.autoId ? toId(form.alias, props.path) : ''
    })
    // The form alias (or `namePrefix`) prefixes names when the *form* namespaces (groups are already in the path)
    const name = computed(() => {
      const { namespaces, namePrefix } = form.options.config
      const prefix = namePrefix === undefined ? form.alias : namePrefix || undefined
      return toName(namespaces ? prefix : undefined, props.path)
    })
    const helpId = computed(() => `${id.value || toId(form.alias, props.path)}-help`)
    const errorId = computed(() => `${id.value || toId(form.alias, props.path)}-error`)
    const checklistId = computed(() => `${id.value || toId(form.alias, props.path)}-checklist`)

    const attrs = computed(() => {
      const { class: _class, type: _type, value: _value, id: _id, ...rest } = props.node.attr
      // Human-facing attributes are translatable texts
      for (const key of ['placeholder', 'title', 'aria-label'] as const) {
        if (typeof rest[key] === 'string') rest[key] = tr.value.text(rest[key] as string)
      }
      const error = field?.errorMessage.value
      const describedBy = [
        props.node.message ? helpId.value : '',
        errorDisplay.value === 'checklist' ? checklistId.value : '',
        error ? errorId.value : '',
      ]
        .filter(Boolean)
        .join(' ')
      return {
        ...rest,
        id: id.value || undefined,
        name: name.value,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describedBy || undefined,
        'aria-required': required.value ? 'true' : undefined,
      } as Record<string, unknown>
    })

    /** The field state every control gets (plain getters → always fresh, no deep proxies) */
    const state: FormoFieldState = markRaw({
      get node() { return props.node },
      get path() { return props.path },
      get name() { return name.value },
      get id() { return id.value },
      get value() { return field ? field.value.value : props.node.val },
      setValue,
      onBlur,
      get error() { return field?.errorMessage.value },
      get errors() { return field?.errors.value ?? [] },
      get errorDisplay() { return errorDisplay.value },
      get checklist() { return checklist.value },
      get checklistId() { return checklistId.value },
      get invalid() { return !!field?.errorMessage.value },
      get touched() { return !!field?.meta.touched },
      get dirty() { return !!field?.meta.dirty },
      get required() { return required.value },
      get ignored() { return ignored.value },
      get label() { return label.value },
      get message() { return message.value },
      get text() { return resolveButtonText(props.node, config.value) },
      get options() { return options$.value },
      get classes() { return classes.value },
      get attrs() { return attrs.value },
      get helpId() { return helpId.value },
      get errorId() { return errorId.value },
      get disabled() { return !!props.node.attr.disabled },
      get _parts() { return parts },
      field: field ? markRaw(field) : undefined,
      form,
    })

    provide(FormoFieldKey, state)
    // <FormoLabel />, <FormoInput />… in its slots render this field's parts
    provide(FormoPartOwnerKey, { kind: 'field', state })

    const editable = computed(() => {
      const e = props.node.editable
      return typeof e === 'function'
        ? e({ values: form.values, parentValues: parentValues(), node: props.node, path: props.path })
        : e !== false
    })

    /** Component resolution order — see README "Overriding components" */
    const control = computed<ResolvedControl | undefined>(() => resolveControl(props.node, driver.value, options.value))

    /** A slot for this field: given to the component rendering it, or `#name:path` on <FormoForm> */
    const findSlot = (name: string, formName = name) => findNodeSlot(ownSlots, slots, props.path, name, formName)

    function renderHiddenMirror(): VNode[] {
      if (!config.value.native || !field) return []
      const value = field.value.value
      if (Array.isArray(value)) {
        return value.map((v, i) => h('input', { key: i, type: 'hidden', name: `${name.value}[]`, value: String(v ?? '') }))
      }
      if (typeof value === 'boolean') return [h('input', { type: 'hidden', name: name.value, value: value ? '1' : '' })]
      if (value !== null && typeof value === 'object') return []
      return [h('input', { type: 'hidden', name: name.value, value: String(value ?? '') })]
    }

    /** The control, wired (v-model, id/name/aria…). `extra` = attrs given to `<component :is="Input" …>` */
    function renderControl(extra: Record<string, unknown> = {}): VNode | VNode[] | undefined {
      if (!editable.value) {
        const Uneditable = resolveView('uneditable', options.value)
        return Uneditable ? h(Uneditable as any, { ...extra, formo: state }) : undefined
      }

      const resolved = control.value
      if (!resolved) {
        console.warn(`[formo] No component found for driver "${props.node.driver}" (field "${props.path}")`)
        return undefined
      }
      const { component: Comp, def } = resolved

      const builtin = isBuiltin(Comp)
      // The control's contract: the driver's, then its `defineControl()`, then the field's own `model`
      const model = { ...driver.value?.model, ...def?.model, ...props.node.model }
      const modelProp = model.prop ?? 'modelValue'
      const modelEvent = model.event ?? 'update:modelValue'
      const { class: attrClass } = props.node.attr

      // Components that only use useFormoField() don't declare the model prop: don't leak it as an attribute
      const passModel = declaresProp(Comp, modelProp) !== false
      const value = field ? field.value.value : undefined

      const own: Record<string, unknown> = builtin
        ? {}
        : {
            ...attrs.value,
            // `type` of the input driver (email, password, number…) — UI libraries' inputs take it as a prop
            ...(props.node.driver === 'input' && props.node.type ? { type: props.node.type } : {}),
            class: attrClass,
          }
      const vnodeProps: Record<string, unknown> = {
        // attributes → props from the field's state (`defineControl`) → what the template gave <FormoInput>
        ...mergeProps(own, def?.props?.(state) ?? {}, extra),
        ...(declaresProp(Comp, 'formo') ? { formo: state } : {}),
        ...props.node.props,
        ...(passModel ? { [modelProp]: model.get ? model.get(value, state) : value } : {}),
        [toHandlerKey(camelize(modelEvent))]: (emitted: unknown) => {
          let next = unwrapEventValue(emitted)
          if (model.set) next = model.set(next, state)
          // The driver decides what the value is (numbers for number inputs…), whatever the control emits
          setValue(driver.value?.parse ? driver.value.parse(next, props.node) : next)
        },
        onBlur,
      }
      // `update:modelValue` → also listen to the kebab variant some libs emit
      if (modelEvent.includes(':') || modelEvent.includes('-')) {
        vnodeProps[toHandlerKey(modelEvent)] = vnodeProps[toHandlerKey(camelize(modelEvent))]
      }

      const vnode = h(Comp as any, vnodeProps)
      // Built-in and `native` controls post their own value; others get hidden mirror inputs
      return builtin || def?.native ? vnode : [vnode, ...renderHiddenMirror()]
    }

    /** The parts, as the theme renders them (the input part is the control) */
    function renderPart(region: FieldRegion, attrs: Record<string, unknown>): VNode | VNode[] | null | undefined {
      if (region === 'input') return renderControl(attrs)
      const View = resolveView(region, options.value)
      return View ? h(View as any, { ...attrs, formo: state }) : null
    }

    /** How many `Input` parts are on screen — without one, a native submit needs a hidden mirror */
    const inputsMounted = shallowRef(0)

    function makePart(region: FieldRegion): Component {
      return markRaw(
        defineComponent({
          name: PART_NAMES[region],
          inheritAttrs: false,
          setup(_props, { attrs }) {
            if (region === 'input') {
              onMounted(() => inputsMounted.value++)
              onBeforeUnmount(() => inputsMounted.value--)
            }
            return () => renderPart(region, attrs)
          },
        }),
      )
    }

    /**
     * One stable component per part (so re-renders don't remount them). They're
     * what <FormoLabel>, <FormoInput>, <FormoErrors>… render for this field.
     */
    const parts: Record<FieldRegion, Component> = {
      label: makePart('label'),
      input: makePart('input'),
      help: makePart('help'),
      errors: makePart('errors'),
      checklist: makePart('checklist'),
    }

    /** Hidden inputs mirroring the value when a template replaced the control without rendering `Input` */
    const Mirror = markRaw(
      defineComponent({
        name: 'FormoMirror',
        setup: () => () => (inputsMounted.value ? null : h(Fragment, renderHiddenMirror())),
      }),
    )

    const slotProps = (props: Record<string, unknown>): FormoFieldSlotProps => ({ field: state, props })

    /** A region: the template's slot (where <FormoInput /> & co. render the default), else the part itself */
    function renderRegion(region: FieldRegion, viewProps: Record<string, unknown> = {}): VNodeArrayChildren | VNode {
      const slot = findSlot(region)
      if (slot) {
        const out: VNode[] = slot(slotProps(viewProps))
        return region === 'input' ? [...out, h(Mirror)] : out
      }
      return h(parts[region], viewProps)
    }

    const viewSlots = () =>
      Object.fromEntries(FIELD_REGIONS.map((region) => [region, (viewProps?: Record<string, unknown>) => renderRegion(region, viewProps)]))

    return () => {
      // Your own markup for the whole field: <FormoField v-slot="{ field }"> / <FormoForm #field:path>
      if (props.part === 'field') {
        const layout = findSlot('default', 'field')
        if (layout) {
          const out: VNode[] = layout(slotProps({}))
          if (hasContent(out)) return [...out, h(Mirror)]
        }
      }

      const View = props.part === 'input' ? false : nodeView(props.node, driverView(driver.value, props.node), options.value)
      if (!View) return renderRegion('input')

      return h(
        View as any,
        {
          formo: state,
          class: props.node.vars.viewClass as string | undefined,
          'data-formo-path': props.path,
        },
        viewSlots(),
      )
    }
  },
})
