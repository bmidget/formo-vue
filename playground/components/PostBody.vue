<script setup lang="ts">
/**
 * (Playground only) What a native submit of each <form> in the preview would
 * send — namespaced like Formo (`user[address][street]`), so an existing
 * Kohana/Laravel controller keeps working. Read straight from the DOM.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ root: HTMLElement | undefined }>()
const forms = ref<Array<{ name: string; entries: Array<[string, string]> }>>([])

function read() {
  forms.value = [...(props.root?.querySelectorAll('form') ?? [])].map((form) => ({
    name: form.getAttribute('name') ?? 'form',
    entries: [...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `📎 ${v.name || '(no file)'}`]),
  }))
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  read()
  timer = setInterval(read, 500)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-slate-600">
      What a native submit would POST — names are namespaced like Formo's, so an existing Kohana or Laravel
      controller (<code class="rounded bg-slate-100 px-1 text-xs">$form->load($_POST)</code> / <code class="rounded bg-slate-100 px-1 text-xs">$request->input('user.address.street')</code>) keeps working.
    </p>
    <div v-for="form in forms" :key="form.name" class="overflow-hidden rounded-xl bg-slate-900">
      <p class="border-b border-slate-800 px-4 py-2 font-mono text-xs text-slate-400">&lt;form name="{{ form.name }}"&gt;</p>
      <table class="w-full font-mono text-xs">
        <tr v-for="([k, v], i) in form.entries" :key="i" class="border-b border-slate-800/70 last:border-0">
          <td class="px-4 py-1.5 align-top text-sky-300">{{ k }}</td>
          <td class="px-4 py-1.5 break-all text-emerald-300">{{ v === '' ? '""' : v }}</td>
        </tr>
      </table>
    </div>
  </div>
</template>
