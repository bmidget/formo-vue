<script setup lang="ts">
/** The `help` view — like shadcn's FormDescription */
import { useAttrs } from 'vue'
import { cx, type FormoFieldState } from 'formo-vue'

defineOptions({ inheritAttrs: false })
defineProps<{ formo: FormoFieldState }>()
const attrs = useAttrs()
</script>

<template>
  <p v-if="formo.message" v-bind="attrs" :id="formo.helpId" data-slot="form-description" :class="cx(formo.classes.help, attrs.class)">
    {{ formo.message }}
  </p>
</template>
