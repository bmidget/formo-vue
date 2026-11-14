<script setup lang="ts">
/** Pretty JSON with light syntax colouring (no v-html) */
import { computed } from 'vue'

const props = defineProps<{ value: unknown }>()

function replacer(_key: string, value: unknown) {
  if (typeof File !== 'undefined' && value instanceof File) return `📎 ${value.name} (${Math.round(value.size / 1024)} KB)`
  if (value === undefined) return null
  return value
}

const tokens = computed(() => {
  const json = JSON.stringify(props.value, replacer, 2) ?? 'undefined'
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/g
  const out: Array<{ text: string; cls: string }> = []
  let last = 0
  for (const m of json.matchAll(re)) {
    if (m.index! > last) out.push({ text: json.slice(last, m.index), cls: 'text-slate-400' })
    if (m[1] && m[2]) out.push({ text: m[1], cls: 'text-sky-300' }, { text: m[2], cls: 'text-slate-400' })
    else if (m[1]) out.push({ text: m[1], cls: 'text-emerald-300' })
    else if (m[3]) out.push({ text: m[3], cls: 'text-fuchsia-300' })
    else out.push({ text: m[4], cls: 'text-amber-300' })
    last = m.index! + m[0].length
  }
  out.push({ text: json.slice(last), cls: 'text-slate-400' })
  return out
})
</script>

<template>
  <pre class="overflow-x-auto font-mono text-[12px] leading-relaxed"><span v-for="(t, i) in tokens" :key="i" :class="t.cls">{{ t.text }}</span></pre>
</template>
