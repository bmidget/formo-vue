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
const markupHtml = ref('')

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

function escapeHtml(val: string) {
  return val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const span = (cls: string, text: string) => `<span class="${cls}">${escapeHtml(text)}</span>`
const PUNCT = 'text-slate-400 dark:text-slate-500'
const TAG = 'text-rose-600 dark:text-rose-400'
const ATTR = 'text-amber-700 dark:text-amber-300'
const VAL = 'text-emerald-700 dark:text-emerald-300'
const TEXT = 'text-slate-800 dark:text-slate-100'

function formatAttrs(el: Element, highlight: boolean) {
  return [...el.attributes]
    .map((a) => {
      if (!highlight) return a.value === '' ? a.name : `${a.name}="${escapeHtml(a.value)}"`
      if (a.value === '') return span(ATTR, a.name)
      return `${span(ATTR, a.name)}${span(PUNCT, '="')}${span(VAL, a.value)}${span(PUNCT, '"')}`
    })
    .join(' ')
}

function formatNode(node: Node, depth = 0, highlight = false): string {
  const indent = '  '.repeat(depth)

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text) return ''
    return `${indent}${highlight ? span(TEXT, text) : escapeHtml(text)}`
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const attrs = formatAttrs(el, highlight)
  const open = highlight
    ? `${span(PUNCT, '<')}${span(TAG, tag)}${attrs ? ` ${attrs}` : ''}${span(PUNCT, '>')}`
    : `<${tag}${attrs ? ` ${attrs}` : ''}>`
  const close = highlight ? `${span(PUNCT, '</')}${span(TAG, tag)}${span(PUNCT, '>')}` : `</${tag}>`

  if (VOID_TAGS.has(tag)) return `${indent}${open}`

  const children = [...el.childNodes].filter(
    (c) =>
      c.nodeType === Node.ELEMENT_NODE ||
      (c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim() !== ''),
  )

  if (children.length === 0) return `${indent}${open}${close}`

  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
    const text = (children[0].textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text.length <= 60) {
      return `${indent}${open}${highlight ? span(TEXT, text) : escapeHtml(text)}${close}`
    }
  }

  const inner = children.map((c) => formatNode(c, depth + 1, highlight)).filter(Boolean).join('\n')
  return `${indent}${open}\n${inner}\n${indent}${close}`
}

function readMarkup() {
  const forms = [...(previewRef.value?.querySelectorAll('form') ?? [])]
  if (!forms.length) {
    markup.value = '<!-- No <form> element rendered in preview -->'
    markupHtml.value = `<span class="italic text-slate-400 dark:text-slate-500">&lt;!-- No &lt;form&gt; element rendered in preview --&gt;</span>`
    return
  }
  markup.value = forms.map((f) => formatNode(f, 0, false)).join('\n\n')
  markupHtml.value = forms.map((f) => formatNode(f, 0, true)).join('\n\n')
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

const copiedMarkup = ref(false)
async function copyMarkup() {
  await navigator.clipboard?.writeText(markup.value)
  copiedMarkup.value = true
  setTimeout(() => (copiedMarkup.value = false), 1500)
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
    <div v-if="tab === 'vue'" class="formo-demo-code bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <span class="font-mono text-xs text-slate-500 dark:text-slate-400">playground/examples/{{ example.file }}</span>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
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
    <div v-if="tab === 'markup'" class="bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <span class="font-mono text-xs text-slate-500 dark:text-slate-400">Rendered &lt;form&gt; HTML</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="readMarkup"
          >
            Refresh
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="copyMarkup"
          >
            {{ copiedMarkup ? 'Copied ✓' : 'Copy' }}
          </button>
        </div>
      </div>
      <pre class="max-h-[70vh] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed" v-html="markupHtml" />
    </div>
  </div>
</template>
