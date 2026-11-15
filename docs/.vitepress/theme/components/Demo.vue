<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { demos } from 'virtual:formo-demos'
import { examples } from '../../../../playground/examples'
import PostBody from '../../../../playground/components/PostBody.vue'

const props = defineProps<{
  name: string
  /** Hide the example's own title/summary header when embedded inline in prose */
  compact?: boolean
}>()

type Tab = 'preview' | 'vue' | 'post' | 'markup'
const tab = ref<Tab>('preview')
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'vue', label: 'Vue component' },
  { id: 'post', label: 'POST body' },
  { id: 'markup', label: 'Markup' },
]

const example = computed(() => examples.find((e) => e.id === props.name) ?? examples[0])
const demoSource = computed(() => demos[example.value.file] ?? { file: example.value.file, raw: '', html: '' })

const previewRef = ref<HTMLElement>()
const markup = ref('')

function readMarkup() {
  const forms = [...(previewRef.value?.querySelectorAll('form') ?? [])]
  if (!forms.length) {
    markup.value = '<!-- No <form> element rendered in preview -->'
    return
  }
  markup.value = forms.map((f) => f.outerHTML).join('\n\n')
}

watch(tab, async (next) => {
  if (next === 'markup') {
    await nextTick()
    readMarkup()
  }
})

const copied = ref(false)
async function copySource() {
  await navigator.clipboard?.writeText(demoSource.value.raw)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="vp-raw my-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div v-if="!compact" class="min-w-0">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ example.title }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ example.summary }}</p>
      </div>
      <span v-else class="font-mono text-xs text-slate-500 dark:text-slate-400">
        playground/examples/{{ example.file }}
      </span>

      <div class="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-xs font-medium dark:bg-slate-800">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="rounded-md px-2.5 py-1 transition"
          :class="
            tab === t.id
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          "
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- Preview stays mounted so form state survives switching tabs -->
    <div v-show="tab === 'preview'" ref="previewRef" class="formo-demo-preview bg-white p-5 text-slate-900 sm:p-6 dark:bg-slate-900 dark:text-slate-100">
      <component :is="example.component" :key="example.id" />
    </div>

    <!-- Shiki-highlighted Vue SFC source -->
    <div v-if="tab === 'vue'" class="formo-demo-code bg-slate-950 text-slate-200">
      <div class="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span class="font-mono text-xs text-slate-400">playground/examples/{{ example.file }}</span>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
          @click="copySource"
        >
          {{ copied ? 'Copied ✓' : 'Copy' }}
        </button>
      </div>
      <div class="vp-doc" v-html="demoSource.html" />
    </div>

    <!-- Live FormData POST body -->
    <div v-if="tab === 'post'" class="formo-demo-preview bg-white p-5 text-slate-900 sm:p-6 dark:bg-slate-900 dark:text-slate-100">
      <PostBody :root="previewRef" />
    </div>

    <!-- Live rendered <form> DOM markup -->
    <div v-if="tab === 'markup'" class="bg-slate-950 text-slate-200">
      <div class="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span class="font-mono text-xs text-slate-400">Rendered &lt;form&gt; HTML</span>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
          @click="readMarkup"
        >
          Refresh
        </button>
      </div>
      <pre class="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-relaxed text-sky-200">{{ markup }}</pre>
    </div>
  </div>
</template>
