<script setup lang="ts">
/**
 * Wraps a control with its label, help text and error message.
 * The Vue version of Formo's `field_template.php` / `checkbox_template.php`.
 *
 * Replace it globally with `components: { wrapper: MyWrapper }`, per field with
 * `wrapper: MyWrapper`, or drop it with `wrapper: false`. A replacement gets the
 * same `formo` prop and renders the control through its default slot.
 */
import { computed } from 'vue'
import type { FormoFieldState } from '../composables/context'
import { cx } from '../core/theme'
import FormoChecklist from './FormoChecklist.vue'

const props = defineProps<{ formo: FormoFieldState }>()

const classes = computed(() => props.formo.classes)

const checklistComponent = computed(() => {
  const override = props.formo.form.options.components.checklist
  return override && typeof override !== 'string' ? override : FormoChecklist
})

/** The single error line. Checklist fields skip errors already shown as unmet requirements */
const visibleError = computed(() => {
  const { error, errors, errorDisplay, checklist } = props.formo
  if (!error || errorDisplay !== 'checklist') return error
  const listed = new Set(checklist.map((item) => item.message))
  return errors.find((message) => !listed.has(message))
})
const marker = computed(() => props.formo.form.options.config.requiredMarker)
const rootClass = computed(() =>
  cx(
    props.formo.layout === 'inline'
      ? classes.value.fieldInline
      : props.formo.layout === 'bare'
        ? classes.value.fieldBare
        : classes.value.field,
  ),
)
</script>

<template>
  <div
    :class="rootClass"
    :data-formo-driver="formo.node.driver"
    :data-invalid="formo.invalid || undefined"
  >
    <!-- checkbox_template: control first, label text after -->
    <label v-if="formo.layout === 'inline'" :class="classes.labelInline">
      <slot />
      <span>
        {{ formo.label }}<span v-if="formo.required && marker" :class="classes.required" aria-hidden="true">{{ marker }}</span>
      </span>
    </label>

    <!-- radios / checkboxes: a group of controls gets a legend instead of a <label for> -->
    <fieldset v-else-if="formo.labelAs === 'title'" class="m-0 min-w-0 border-0 p-0">
      <legend v-if="formo.label" :class="classes.title">
        {{ formo.label }}<span v-if="formo.required && marker" :class="classes.required" aria-hidden="true">{{ marker }}</span>
      </legend>
      <slot />
    </fieldset>

    <template v-else>
      <label v-if="formo.labelAs === 'label' && formo.label" :for="formo.id || undefined" :class="classes.label">
        {{ formo.label }}<span v-if="formo.required && marker" :class="classes.required" aria-hidden="true">{{ marker }}</span>
      </label>
      <slot />
    </template>

    <p v-if="formo.message" :id="formo.helpId" :class="classes.help">{{ formo.message }}</p>

    <!-- errorDisplay: 'checklist' — every rule as a live requirement -->
    <component :is="checklistComponent" v-if="formo.errorDisplay === 'checklist'" :formo="formo" />

    <!-- errorDisplay: 'all' — every failing rule -->
    <ul v-if="formo.errorDisplay === 'all' && formo.errors.length > 1" :id="formo.errorId" :class="classes.errorList" role="alert">
      <li v-for="message in formo.errors" :key="message">{{ message }}</li>
    </ul>
    <!-- 'first' (default); for checklists only errors the list doesn't already show (ex: required) -->
    <p v-else-if="visibleError" :id="formo.errorId" :class="classes.error" role="alert">{{ visibleError }}</p>
  </div>
</template>
