<script setup lang="ts">
/**
 * Renders a Formo form: the `<form>` element, its `form` view and the fields.
 *
 * ```vue
 * <FormoForm :form="form" v-model="values" @submit="save" />
 * ```
 *
 * `form` accepts a `Formo` builder, a plain definition (or its JSON),
 * or a controller created with `useFormo()` (for programmatic access).
 *
 * Or lay the form out yourself — the default slot replaces the automatic layout:
 *   <FormoForm :form="form">
 *     <FormoRender path="email" />  <FormoRender path="address" />  <FormoRest />
 *   </FormoForm>
 *
 * Put things around any region of any field from the template (`label`, `input`,
 * `help`, `error`, `checklist`) — each slot gets the region's default rendering:
 *   <template #input:price="{ Input }"> <span>$</span> <component :is="Input" /> </template>
 *   <template #field:address.zip="{ Label, Input }"> ...your own layout for that field... </template>
 */
import { computed, h, markRaw, nextTick, onBeforeUnmount, onMounted, provide, ref, useSlots, watch, watchEffect } from 'vue'
import { FormContextKey } from 'vee-validate'
import type {
  ComponentRef,
  FormoClasses,
  FormoConfig,
  FormoController,
  FormoDefinition,
  FormoDriver,
  FieldNode,
  FormoOutcome,
  FormoSubmitContext,
  FormoTheme,
  FormoThemeLayer,
  FormoViews,
  RuleFn,
} from '../types'
import {
  applyLayer,
  FormoControllerKey,
  FormoOptionsKey,
  FormoContainerKey,
  FormoSlotsKey,
  nodeClasses,
  type FormoFormState,
} from '../composables/context'
import { leafPaths } from '../core/locate'
import { hasContent } from './slots'
import { dispatchOutcome, useFormo } from '../composables/useFormo'
import { csrfField, isTrustedUrl, resolveCsrf } from '../http/csrf'
import { cx } from '../core/theme'
import { deepClone, deepEqual } from '../core/utils'
import FormoChildren from './FormoChildren.vue'
import { nodeView } from './resolve'

const props = withDefaults(
  defineProps<{
    /** Builder, definition (or its JSON), or a `useFormo()` controller */
    form: FormoDefinition | FormoController
    /** Form values (v-model). Merged over the definition's `val`s */
    modelValue?: Record<string, any>
    /** A theme for this form (`defineTheme()`), or overrides: `{ views, components, classes }` */
    theme?: FormoTheme | FormoThemeLayer
    /** View overrides for this form (cascades into groups) */
    views?: Partial<FormoViews>
    /** Control overrides for this form (cascades into groups) */
    components?: Record<string, ComponentRef>
    /** Class overrides for this form (cascades into groups) */
    classes?: Partial<FormoClasses>
    drivers?: Record<string, FormoDriver>
    rules?: Record<string, RuleFn>
    config?: Partial<FormoConfig>
    /** Disable every control */
    disabled?: boolean
    /** After validation passes, submit the <form> natively to its `action` */
    native?: boolean
    /**
     * Called with the (filtered) values when the form passes validation. May be
     * async: the outcome (`@success` / `@rejected`) waits for it. Return `false`,
     * call `ctx.reject()`, set errors or throw to refuse; a request made with
     * `ctx.request()` counts by its response. No `@submit` + an `attr.action`:
     * the form sends itself with `request()`.
     */
    onSubmit?: (values: Record<string, any>, ctx: FormoSubmitContext) => unknown
    /** The browser's validation stopped the submit — nothing was sent */
    onInvalid?: (errors: Record<string, string>, outcome: FormoOutcome) => unknown
    /** It went through: the response's data (or what `@submit` returned) */
    onSuccess?: (data: any, outcome: FormoOutcome) => unknown
    /** Sent, but refused (422, 419, 5xx, a thrown error, `reject()`): `outcome.reason` says why */
    onRejected?: (outcome: FormoOutcome) => unknown
    /** After every submit, whatever happened: `outcome.result` is `success` / `invalid` / `rejected` */
    onSettled?: (outcome: FormoOutcome) => unknown
    /** @deprecated Renamed `@rejected` (same argument: the outcome) */
    onFailure?: (outcome: FormoOutcome) => unknown
  }>(),
  { disabled: false, native: false },
)

const emit = defineEmits<{ 'update:modelValue': [values: Record<string, any>] }>()
const slots = useSlots()

function isController(value: unknown): value is FormoController {
  return !!value && typeof (value as FormoController)._register === 'function'
}

const controller: FormoController = isController(props.form)
  ? props.form
  : useFormo(() => props.form as FormoDefinition, {
      theme: props.theme,
      views: props.views,
      components: props.components,
      classes: props.classes,
      drivers: props.drivers,
      rules: props.rules,
      config: props.config,
      initialValues: props.modelValue,
    })

const options = computed(() =>
  applyLayer(controller._baseOptions, {
    theme: props.theme,
    views: props.views,
    components: props.components,
    classes: props.classes,
    drivers: props.drivers,
    rules: props.rules,
    config: props.native ? { ...props.config, native: true } : props.config,
  }),
)

// request(), group rules & messages use the same (prop-layered) options as the fields
const offOptions = controller._useOptions(() => options.value)

provide(FormoControllerKey, controller)
provide(FormoOptionsKey, options)
provide(FormContextKey, controller._vee as any)
provide(FormoSlotsKey, slots)
provide(FormoContainerKey, () => ({ path: '', prefix: '' }))

const root = computed(() => controller.root)
const classes = computed(() => nodeClasses(options.value, root.value.classes))

// The form itself is a node: it can have rules and callbacks (Formo form-level rules)
watchEffect((onCleanup) => {
  const node = root.value
  onCleanup(
    controller._register({ node, path: '', parentPath: '', kind: 'form', label: () => String(node.label || node.alias) }),
  )
})

const formEl = ref<HTMLFormElement>()

/* ---- CSRF for native posts (Laravel @csrf / @method) ------------------- */

const SPOOFED = ['PUT', 'PATCH', 'DELETE']
const method = computed(() => String(root.value.attr.method ?? 'post').toUpperCase())
const actionUrl = computed(() => String(root.value.attr.action ?? (typeof location !== 'undefined' ? location.href : '')))
/**
 * A token given as a string (`config.csrf.token`, e.g. from an Inertia shared
 * prop) is known right away — so server-rendered HTML has the field too, and a
 * post with JavaScript off passes Laravel's CSRF check. (Meta tags and cookies are read once mounted.)
 */
function knownCsrfField(): { name: string; value: string } | null {
  const { csrf: config, request } = options.value.config
  const token = config && typeof config === 'object' ? config.token : undefined
  if (typeof token !== 'string' || !token) return null
  const csrf = resolveCsrf(config)
  return csrf && isTrustedUrl(actionUrl.value, csrf, request.baseUrl) ? { name: csrf.field, value: token } : null
}
const csrfInput = ref<{ name: string; value: string } | null>(knownCsrfField())
/**
 * `_token` / `_method` for native posts — and for any form with an `action`, so
 * it still posts correctly with JavaScript off (`request()` sends the values, not these fields)
 */
const postsNatively = computed(() => options.value.config.native || !!root.value.attr.action)

async function refreshCsrfField() {
  const { csrf, request } = options.value.config
  csrfInput.value = await csrfField(csrf, { url: actionUrl.value, baseUrl: request.baseUrl })
  return csrfInput.value
}

onMounted(() => {
  if (postsNatively.value) refreshCsrfField()
})

async function nativeSubmit() {
  const field = await refreshCsrfField()
  if (!field && options.value.config.csrf !== false && method.value !== 'GET' && import.meta.env?.DEV) {
    console.warn(
      '[formo] Native submit without a CSRF token: add <meta name="csrf-token" content="{{ csrf_token() }}"> ' +
        'or pass config.csrf.token. (The XSRF-TOKEN cookie only works as a header, not as a form field.)',
    )
  }
  await nextTick()
  formEl.value?.submit()
}

// What @submit returns counts (false, a response…): the controller works out the outcome
const offSubmit = controller._onSubmit(async (values, ctx) => {
  let result: unknown
  if (props.onSubmit) {
    result = await props.onSubmit(values, ctx)
  } else if (!options.value.config.native && root.value.attr.action) {
    // Self-submitting form: <FormoForm :form="form"> with attr: { action: '/api/profile', method: 'put' }
    result = await ctx.request()
  }
  // Native post (to `action`) — unless the handler refused or set errors
  if (options.value.config.native && result !== false && !Object.keys(controller.flatErrors).length) await nativeSubmit()
  return result
})

let warnedFailure = false
const offOutcome = controller._onOutcome((outcome) => {
  if (props.onFailure && !props.onRejected && import.meta.env?.DEV && !warnedFailure) {
    warnedFailure = true
    console.warn('[formo] <FormoForm @failure> is now @rejected (same argument: the outcome)')
  }
  return dispatchOutcome(
    {
      onSuccess: props.onSuccess,
      onInvalid: props.onInvalid,
      onRejected: props.onRejected ?? props.onFailure,
      onSettled: props.onSettled,
    },
    outcome,
  )
})

// Custom layout: a field nobody placed isn't rendered, so it isn't validated either — say so
onMounted(async () => {
  if (!import.meta.env?.DEV || !usesCustomLayout) return
  await nextTick()
  const { drivers, config } = options.value
  const missing = leafPaths(root.value, drivers, config)
    .filter((l) => l.node.render === true && l.ancestors.every((a) => a.render === true))
    .filter((l) => !controller.find(l.path))
    // A repeatable group rendered row by row (its rows' fields placed by hand)
    .filter((l) => !(l.node.blueprint && [...controller._claimed].some((p) => p.startsWith(`${l.path}[`))))
    .map((l) => l.path)
  if (missing.length) {
    console.warn(
      `[formo] <FormoForm name="${String(root.value.alias)}"> custom layout doesn't render: ${missing.join(', ')}. ` +
        'Unrendered fields are not validated — place them with <FormoRender>, add <FormoRest />, or set `render: false`.',
    )
  }
})

onBeforeUnmount(() => {
  offOptions()
  offSubmit()
  offOutcome()
})

/* ---- v-model ------------------------------------------------------------ */

watch(
  () => props.modelValue,
  (values) => {
    if (values && !deepEqual(values, controller.values)) controller.load(values)
  },
  { deep: true },
)
watch(
  () => controller.values,
  (values) => {
    if (!deepEqual(values, props.modelValue)) emit('update:modelValue', deepClone(values))
  },
  { deep: true, immediate: props.modelValue !== undefined },
)

/* ---- <form> attributes ------------------------------------------------- */

function hasFileField(node: FieldNode): boolean {
  return node.driver === 'file' || node.fields.some(hasFileField)
}

const formAttrs = computed<Record<string, unknown>>(() => {
  const { class: _class, ...attr } = root.value.attr
  return {
    ...attr,
    // HTML forms only GET/POST: other verbs are spoofed with a `_method` field (Laravel @method)
    method: SPOOFED.includes(method.value) ? 'post' : method.value.toLowerCase(),
    // File fields make the whole form multipart
    enctype: (attr.enctype as string | undefined) ?? (hasFileField(root.value) ? 'multipart/form-data' : undefined),
  }
})

const formState: FormoFormState = markRaw({
  form: controller,
  get error() {
    return controller.error('')
  },
  get classes() {
    return classes.value
  },
  get fields() {
    return controller.fields
  },
})

/** The `form` view (`view` on the root definition, the theme's, or the built-in one) */
const FormView = computed(() => nodeView(root.value, 'form', options.value))

const slotProps = computed(() => ({
  form: controller,
  fields: controller.fields,
  values: controller.values,
  errors: controller.errors,
  valid: controller.valid,
  submitting: controller.submitting,
  submit: controller.submit,
  reset: () => controller.reset(),
}))

/** The default slot is your own layout; empty (or only a v-if placeholder) means the automatic one */
let usesCustomLayout = false
const Body = () => {
  const vnodes = slots.default?.(slotProps.value)
  usesCustomLayout = hasContent(vnodes)
  return usesCustomLayout
    ? vnodes
    : h(FormoChildren, { fields: root.value.fields, prefix: '', parentAlias: root.value.alias, groupPath: '' })
}

defineExpose({ form: controller })
</script>

<template>
  <form
    ref="formEl"
    v-bind="formAttrs"
    :id="(formAttrs.id as string) ?? `formo-${String(root.alias)}`"
    :class="cx(root.attr.class)"
    :name="String(root.alias)"
    novalidate
    @submit.prevent="controller.submit($event)"
    @reset.prevent="controller.reset()"
  >
    <template v-if="postsNatively">
      <input v-if="csrfInput" type="hidden" :name="csrfInput.name" :value="csrfInput.value" />
      <input v-if="SPOOFED.includes(method)" type="hidden" name="_method" :value="method" />
    </template>
    <!-- Only disables every control (`disabled`); the `form` view lays the form out -->
    <fieldset :disabled="disabled" style="margin: 0; padding: 0; border: 0; min-width: 0">
      <component :is="FormView" v-if="FormView" :formo="formState">
        <template #before><slot name="before" v-bind="slotProps" /></template>
        <!-- Your own layout (default slot) with <FormoField :field="…" />, or the automatic one -->
        <Body />
        <template #actions><slot name="actions" v-bind="slotProps" /></template>
      </component>
      <template v-else>
        <slot name="before" v-bind="slotProps" />
        <Body />
        <slot name="actions" v-bind="slotProps" />
      </template>
    </fieldset>
  </form>
</template>
