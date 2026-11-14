<script setup lang="ts">
/**
 * A field's rules as a live requirement list (`errorDisplay: 'checklist'` /
 * `checklist: true`): a grey box with ✗ before each requirement until the value
 * meets it, then ✓. Unmet requirements turn red once the field failed validation
 * (blur in eager mode, or a submit).
 *
 * Override with `components: { checklist: MyChecklist }` — same `formo` prop.
 */
import { computed } from 'vue'
import type { FormoFieldState } from '../composables/context'
import { cx } from '../core/theme'
import { getTranslator } from '../i18n/translator'

const props = defineProps<{ formo: FormoFieldState }>()

const classes = computed(() => props.formo.classes)
const metCount = computed(() => props.formo.checklist.filter((i) => i.passed).length)
const tr = computed(() => getTranslator(props.formo.form.options.config))
const summary = computed(() =>
  tr.value.ui('checklistSummary', { field: props.formo.label, met: metCount.value, total: props.formo.checklist.length }),
)
</script>

<template>
  <ul
    v-if="formo.checklist.length"
    :id="formo.checklistId"
    :class="classes.checklist"
    aria-live="polite"
    :aria-label="summary"
    data-formo-checklist
  >
    <li
      v-for="item in formo.checklist"
      :key="`${item.rule}:${item.label}`"
      :class="
        cx(
          classes.checklistItem,
          item.passed ? classes.checklistMet : formo.invalid ? classes.checklistFailed : classes.checklistUnmet,
        )
      "
      :data-passed="item.passed"
    >
      <svg v-if="item.passed" class="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg v-else class="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span>
        <span class="sr-only">{{ item.passed ? tr.ui('met') : tr.ui('notMet') }}</span>
        {{ item.label }}
      </span>
    </li>
  </ul>
</template>
