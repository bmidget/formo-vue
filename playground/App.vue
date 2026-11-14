<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { examples, sourceOf } from './examples'
import PostBody from './components/PostBody.vue'

const currentId = ref(location.hash.slice(1) || examples[0].id)
type View = 'preview' | 'vue' | 'post'
const view = ref<View>('preview')
const views: Array<{ id: View; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'vue', label: 'Vue component' },
  { id: 'post', label: 'POST body' },
]
const navOpen = ref(false)
const preview = ref<HTMLElement>()

const onHash = () => (currentId.value = location.hash.slice(1) || examples[0].id)
onMounted(() => window.addEventListener('hashchange', onHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))

const current = computed(() => examples.find((e) => e.id === currentId.value) ?? examples[0])
const sections = computed(() => {
  const map = new Map<string, typeof examples>()
  for (const e of examples) map.set(e.section, [...(map.get(e.section) ?? []), e])
  return [...map.entries()]
})

watch(currentId, () => {
  view.value = 'preview'
  navOpen.value = false
  window.scrollTo({ top: 0 })
})

const copied = ref(false)
async function copySource() {
  await navigator.clipboard?.writeText(sourceOf(current.value))
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
    <!-- Sidebar -->
    <aside class="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div class="flex items-center justify-between gap-3 px-5 py-4 lg:py-6">
        <a href="#" class="flex items-center gap-3">
          <span class="grid size-9 place-items-center rounded-xl bg-indigo-600 font-mono text-sm font-bold text-white shadow-sm">Fo</span>
          <span>
            <span class="block text-sm font-semibold leading-tight">Formo for Vue</span>
            <span class="block text-xs text-slate-500">playground</span>
          </span>
        </a>
        <button type="button" class="rounded-lg p-2 text-slate-500 ring-1 ring-slate-200 lg:hidden" @click="navOpen = !navOpen">
          <span class="sr-only">Toggle navigation</span>☰
        </button>
      </div>

      <nav class="px-3 pb-6 lg:block" :class="navOpen ? 'block' : 'hidden'">
        <div v-for="[section, items] in sections" :key="section" class="mb-5">
          <p class="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ section }}</p>
          <a
            v-for="example in items"
            :key="example.id"
            :href="`#${example.id}`"
            class="block rounded-lg px-2 py-1.5 text-sm transition"
            :class="example.id === current.id ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
          >
            {{ example.title }}
          </a>
        </div>
        <p class="mt-8 px-2 text-xs leading-relaxed text-slate-400">
          Each example is a plain Vue component — what you'd write in your app. Edit
          <code class="rounded bg-slate-100 px-1 text-slate-600">playground/examples/*</code> or
          <code class="rounded bg-slate-100 px-1 text-slate-600">src/*</code>: changes hot-reload.
        </p>
      </nav>
    </aside>

    <!-- Main -->
    <main class="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600">{{ current.section }}</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{{ current.title }}</h1>
          <p class="mt-1.5 text-sm text-slate-600">{{ current.summary }}</p>
        </div>
        <div class="inline-flex rounded-lg bg-slate-200/70 p-1 text-xs font-semibold">
          <button
            v-for="v in views"
            :key="v.id"
            type="button"
            class="rounded-md px-3 py-1.5 transition"
            :class="view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            @click="view = v.id"
          >
            {{ v.label }}
          </button>
        </div>
      </header>

      <!-- The example stays mounted across tabs, so its state survives -->
      <section v-show="view === 'preview'" ref="preview" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <component :is="current.component" :key="current.id" />
      </section>

      <div v-if="view === 'vue'" class="overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-1 ring-slate-800">
        <div class="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <span class="font-mono text-xs text-slate-400">playground/examples/{{ current.file }}</span>
          <button type="button" class="rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800" @click="copySource">
            {{ copied ? 'Copied ✓' : 'Copy' }}
          </button>
        </div>
        <pre class="max-h-[78vh] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-slate-200">{{ sourceOf(current) }}</pre>
      </div>

      <section v-if="view === 'post'" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <PostBody :root="preview" />
      </section>
    </main>
  </div>
</template>
