<script setup lang="ts">
/**
 * The `label` view — your shadcn-vue <Label>, wired to the control (`for`), red
 * when the field is invalid (like FormLabel). `as="legend"` for radio groups.
 */
import { computed, useAttrs } from 'vue'
import { cx, type FormoFieldState } from 'formo-vue'
import { Label } from '@/components/ui/label'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ formo: FormoFieldState; as?: 'label' | 'legend' | 'span' }>(), { as: 'label' })
const attrs = useAttrs()
const marker = computed(() => props.formo.form.options.config.requiredMarker)
/** Attributes given by a view or your template (`<FormoLabel class="…">`), class merged */
const rest = () => {
  const { class: _class, ...others } = attrs
  return others
}
</script>

<template>
  <template v-if="formo.label">
    <Label
      v-if="as === 'label'"
      v-bind="rest()"
      :for="formo.id || undefined"
      :data-error="formo.invalid || undefined"
      :class="cx('data-[error=true]:text-destructive', attrs.class)"
    >
      <!-- one span: shadcn's Label is `flex gap-2`, the marker stays next to the text -->
      <span>{{ formo.label }}<span v-if="formo.required && marker" :class="formo.classes.required" aria-hidden="true">{{ marker }}</span></span>
    </Label>
    <component :is="as" v-else v-bind="rest()" :class="cx(as === 'legend' ? formo.classes.title : '', attrs.class)">
      {{ formo.label }}<span v-if="formo.required && marker" :class="formo.classes.required" aria-hidden="true">{{ marker }}</span>
    </component>
  </template>
</template>
