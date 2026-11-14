<script setup lang="ts">
/**
 * Renders a Formo form — Formo's `form_template.php` + `$form->render()`.
 *
 * ```vue
 * <FormoForm :form="form" v-model="values" @submit="save" />
 * ```
 *
 * `form` accepts a `Formo` builder, a plain definition, Formo PHP `to_array()`
 * JSON, or a controller created with `useFormo()` (for programmatic access).
 *
 * Or lay the form out yourself — the default slot replaces the automatic layout:
 *   <FormoForm :form="form">
 *     <FormoRender path="email" />  <FormoRender path="address" />  <FormoRest />
 *   </FormoForm>
 *
 * Override any nested field from the template:
 *   <template #control:rating="field"> ...replaces the control, keeps label/errors... </template>
 *   <template #field:address.zip="field"> ...replaces the whole field... </template>
 */
import { computed, h, nextTick, onBeforeUnmount, onMounted, provide, ref, useSlots, watch, watchEffect } from 'vue'
import { FormContextKey } from 'vee-validate'
import type {
  ComponentRef,
  FormoConfig,
  FormoController,
  FormoDefinition,
  FormoDriver,
  FieldNode,
  FormoResponse,
  FormoSubmitContext,
  FormoTheme,
  RuleFn,
} from '../types'
import {
  applyLayer,
  FormoControllerKey,
  FormoOptionsKey,
  FormoContainerKey,
  FormoSlotsKey,
} from '../composables/context'
import { leafPaths } from '../core/locate'
import { hasContent } from './slots'
import { useFormo } from '../composables/useFormo'
import { csrfField } from '../http/csrf'
import { cx, mergeTheme } from '../core/theme'
import { deepClone, deepEqual } from '../core/utils'
import FormoChildren from './FormoChildren.vue'

const props = withDefaults(
  defineProps<{
    /** Builder, definition, PHP `to_array()` JSON, or a `useFormo()` controller */
    form: FormoDefinition | FormoController
    /** Form values (v-model). Merged over the definition's `val`s */
    modelValue?: Record<string, any>
    /** Component overrides for this form (cascades into groups) */
    components?: Record<string, ComponentRef>
    drivers?: Record<string, FormoDriver>
    rules?: Record<string, RuleFn>
    config?: Partial<FormoConfig>
    theme?: Partial<FormoTheme>
    /** Disable every control */
    disabled?: boolean
    /** After validation passes, submit the <form> natively to its `action` */
    native?: boolean
    /** Called with the (filtered) values when the form passes validation. May be async. */
    onSubmit?: (values: Record<string, any>, ctx: FormoSubmitContext) => unknown
    /** Called with the errors when validation fails */
    onInvalid?: (errors: Record<string, string>) => unknown
    /**
     * No `@submit` handler + an `attr.action` → the form sends itself with
     * `form.request()` (CSRF, JSON, 422 mapping). These get the outcome.
     */
    onSuccess?: (data: any, response: FormoResponse) => unknown
    onFailure?: (response: FormoResponse) => unknown
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
      components: props.components,
      drivers: props.drivers,
      rules: props.rules,
      config: props.config,
      theme: props.theme,
      initialValues: props.modelValue,
    })

const options = computed(() =>
  applyLayer(controller._baseOptions, {
    components: props.components,
    drivers: props.drivers,
    rules: props.rules,
    config: props.native ? { ...props.config, native: true } : props.config,
    theme: props.theme,
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
const theme = computed(() => mergeTheme(options.value.theme, root.value.classes))

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
const csrfInput = ref<{ name: string; value: string } | null>(null)

async function refreshCsrfField() {
  const { csrf, request } = options.value.config
  csrfInput.value = await csrfField(csrf, { url: actionUrl.value, baseUrl: request.baseUrl })
  return csrfInput.value
}

onMounted(() => {
  if (options.value.config.native) refreshCsrfField()
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

const offSubmit = controller._onSubmit(async (values, ctx) => {
  if (props.onSubmit) {
    await props.onSubmit(values, ctx)
  } else if (!options.value.config.native && root.value.attr.action) {
    // Self-submitting form: <FormoForm :form="form"> with attr: { action: '/api/profile', method: 'put' }
    const response = await ctx.request()
    if (response.ok) await props.onSuccess?.(response.data, response)
    else await props.onFailure?.(response)
  }
  if (options.value.config.native) await nativeSubmit()
})
const offInvalid = controller._onInvalid(async (errors) => {
  await props.onInvalid?.(errors)
})

// Custom layout: a field nobody placed isn't rendered, so it isn't validated either — say so
onMounted(async () => {
  if (!import.meta.env?.DEV || !usesCustomLayout) return
  await nextTick()
  const { drivers, config } = options.value
  const missing = leafPaths(root.value, drivers, config)
    .filter((l) => l.node.render === true && l.ancestors.every((a) => a.render === true))
    .filter((l) => !controller.find(l.path))
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
  offInvalid()
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
    // Formo_Driver_Group::added — file fields make the whole form multipart
    enctype: (attr.enctype as string | undefined) ?? (hasFileField(root.value) ? 'multipart/form-data' : undefined),
  }
})

const formError = computed(() => controller.error(''))

const slotProps = computed(() => ({
  form: controller,
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
    <template v-if="options.config.native">
      <input v-if="csrfInput" type="hidden" :name="csrfInput.name" :value="csrfInput.value" />
      <input v-if="SPOOFED.includes(method)" type="hidden" name="_method" :value="method" />
    </template>
    <fieldset :disabled="disabled" :class="cx('m-0 min-w-0 border-0 p-0', theme.form)">
      <p v-if="formError" :class="theme.formError" role="alert">{{ formError }}</p>
      <slot name="before" v-bind="slotProps" />
      <!-- Your own layout (default slot) with <FormoRender path="…" />, or the automatic one -->
      <Body />
      <slot name="actions" v-bind="slotProps" />
    </fieldset>
  </form>
</template>
