<script setup lang="ts">
/**
 * A separate component, outside the <form> element, rendering one field of
 * the same form — it's still validated and submitted with the rest.
 */
import { FormoField, type FormoHandle } from 'formo-vue'

defineProps<{ field: FormoHandle }>()
</script>

<template>
  <div class="rounded-2xl bg-linear-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg">
    <p class="text-sm font-semibold">Stay in the loop</p>
    <p class="mt-1 text-xs text-indigo-100">This card lives outside the &lt;form&gt; — it renders the form's <code>newsletter</code> field itself.</p>
    <div class="mt-4 rounded-xl bg-white/95 p-3 text-slate-900">
      <FormoField :field="field" />
    </div>
  </div>
</template>
