<script setup lang="ts">
/** The `errorSummary` view (<FormoErrorSummary>) — every error of the form, each linking to its control */
import type { FormoErrorSummaryState } from '../../composables/context'

defineProps<{ formo: FormoErrorSummaryState }>()
</script>

<template>
  <div :class="formo.classes.errorSummary" role="alert">
    <p class="font-semibold">{{ formo.title }}</p>
    <ul class="mt-2 list-disc space-y-1 pl-5">
      <li v-for="item in formo.items" :key="item.path">
        <a v-if="item.href" :href="item.href" class="underline-offset-2 hover:underline">{{ item.message }}</a>
        <span v-else>{{ item.message }}</span>
      </li>
    </ul>
  </div>
</template>
