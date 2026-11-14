<script setup lang="ts">
/**
 * `<button>` (`button` driver). `attr.type` defaults to `button`; use
 * `attr: { type: 'submit' }` for a submit button (styled as primary and
 * disabled while the form is submitting). `variant: 'primary' | 'secondary'` overrides the style.
 */
import { computed } from 'vue'
import type { FormoFieldState } from '../../composables/context'
import { cx } from '../../core/theme'

const props = defineProps<{ formo: FormoFieldState }>()

const type = computed(() => String(props.formo.node.attr.type ?? 'button'))
const variant = computed(() => props.formo.node.vars.variant ?? (type.value === 'submit' ? 'primary' : 'secondary'))
const submitting = computed(() => type.value === 'submit' && props.formo.form.submitting)

/**
 * Keep focus where it is when pressing a submit button: otherwise the field
 * being left blurs on mousedown, shows its error, the layout shifts and the
 * mouseup lands outside the button — swallowing the click.
 */
function onMousedown(event: MouseEvent) {
  if (type.value === 'submit') event.preventDefault()
}

function onClick(event: MouseEvent) {
  const onClick = props.formo.node.vars.onClick
  if (typeof onClick === 'function') onClick(event, props.formo.form)
  if (type.value === 'reset') {
    event.preventDefault()
    props.formo.form.reset()
  }
}
</script>

<template>
  <button
    v-bind="formo.attrs"
    :type="type as 'button' | 'submit' | 'reset'"
    :disabled="(formo.attrs.disabled as boolean) || submitting"
    :aria-busy="submitting || undefined"
    :class="cx(formo.classes.button, variant === 'primary' ? formo.classes.buttonPrimary : formo.classes.buttonSecondary, formo.node.attr.class)"
    @mousedown="onMousedown"
    @click="onClick"
  >
    <svg v-if="submitting" class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
    </svg>
    {{ formo.text }}
  </button>
</template>
