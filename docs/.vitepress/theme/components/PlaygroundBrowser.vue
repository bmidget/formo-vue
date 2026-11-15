<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { examples } from '../../../../playground/examples'
import Demo from './Demo.vue'

const currentId = ref(
  typeof window !== 'undefined' ? window.location.hash.slice(1) || examples[0].id : examples[0].id,
)

const sections = computed(() => {
  const map = new Map<string, typeof examples>()
  for (const e of examples) map.set(e.section, [...(map.get(e.section) ?? []), e])
  return [...map.entries()]
})

const current = computed(() => examples.find((e) => e.id === currentId.value) ?? examples[0])

function select(id: string) {
  currentId.value = id
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', `#${id}`)
  }
}

const onHash = () => {
  const hash = window.location.hash.slice(1)
  if (hash && examples.some((e) => e.id === hash)) currentId.value = hash
}

onMounted(() => window.addEventListener('hashchange', onHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))
</script>

<template>
  <div class="vp-raw grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
    <nav class="space-y-4">
      <div v-for="[section, items] in sections" :key="section">
        <p class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {{ section }}
        </p>
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition"
          :class="
            item.id === current.id
              ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          "
          @click="select(item.id)"
        >
          {{ item.title }}
        </button>
      </div>
    </nav>

    <div class="min-w-0">
      <Demo :key="current.id" :name="current.id" />
    </div>
  </div>
</template>
