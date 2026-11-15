<script setup lang="ts">
/**
 * Renders one generated form and runs it for real: client-side validation,
 * then `request()` to a (fake, in-browser) Laravel backend whose 422 errors map
 * back onto the fields. Every error says where it came from — a Formo rule, a
 * Zod refinement, Zod itself (schema mode) or the server.
 *
 * The workbench re-keys it whenever the definition changes: a form reads its
 * initial values once.
 */
import { computed, ref } from 'vue'
import { FormoForm, laravelKeyToPath, useFormo, type FieldSpec, type FormoOutcome, type FormoSubmitContext } from 'formo-vue'
import { RUNTIME, findModelField, modelPath, type FormoModel, type ZodRefinement } from 'formo-vue/schema'
import JsonView from './JsonView.vue'
import { mockLaravel, type Exchange, type ServerBehaviour } from './mockLaravel'

const props = defineProps<{
  definition: FieldSpec
  /** The model the form came from — the mock server validates with it too */
  model: FormoModel
  /** Where submit sends the values */
  endpoint: { method: string; url: string }
  behaviour: ServerBehaviour
  /** The record an update form loaded */
  current?: Record<string, unknown>
  /** Refinement failures reported by fromZod({ onRefinement }) */
  refinements: ZodRefinement[]
  /** validation: 'schema' — every client-side error is Zod's */
  schemaValidated: boolean
}>()

// Read once on purpose: the parent mounts a new preview for a new definition
const form = useFormo(props.definition)

const exchanges = ref<Exchange[]>([])
const fetch = mockLaravel({
  model: props.model,
  behaviour: () => props.behaviour,
  current: props.current,
  onExchange: (exchange) => exchanges.value.unshift(exchange),
})

/** Errors the last response put on the form, by form path */
const serverErrors = ref<Record<string, string[]>>({})
const lastStatus = ref<number>()

/** Valid on the client → sent; the response's 422 errors land on the fields */
async function submit(_values: Record<string, unknown>, { request }: FormoSubmitContext) {
  serverErrors.value = {}
  parity.value = undefined
  const response = await request(props.endpoint.url, { method: props.endpoint.method, fetch })
  lastStatus.value = response.status
  // 422 errors by field; a 419 / 500 (or a 422 key no field has) lands on the form itself
  const errors: Record<string, string[]> = { ...response.errors }
  if (!response.ok && form.flatErrors['']) errors[''] = [form.flatErrors['']]
  serverErrors.value = errors
}

const blocked = ref(0)

/* ---- The outcome events ------------------------------------------------- */

const events = ref<Array<{ id: number; name: string; detail: string }>>([])
let eventId = 0
function log(name: string, detail: string) {
  events.value = [{ id: ++eventId, name, detail }, ...events.value].slice(0, 12)
}
const short = (value: unknown) => {
  const text = JSON.stringify(value) ?? 'undefined'
  return text.length > 70 ? `${text.slice(0, 70)}…` : text
}
const onSuccess = (data: unknown) => log('@success', `data: ${short(data)}`)
const onInvalid = (errors: Record<string, string>) => {
  blocked.value++
  log('@invalid', `${Object.keys(errors).length} error(s) — nothing was sent`)
}
const onRejected = (outcome: FormoOutcome) =>
  log('@rejected', `reason: ${outcome.reason}${outcome.response ? ` (HTTP ${outcome.response.status})` : ''}`)
const onSettled = (outcome: FormoOutcome) => log('@settled', `result: ${outcome.result}`)
const EVENT_CLASS: Record<string, string> = {
  '@success': 'bg-emerald-100 text-emerald-800',
  '@invalid': 'bg-amber-100 text-amber-800',
  '@rejected': 'bg-rose-100 text-rose-700',
  '@settled': 'bg-slate-100 text-slate-600',
}

/* ---- JavaScript off: the same post, natively ------------------------------ */

interface ParityRow {
  path: string
  browser?: string
  server?: string
  verdict: 'same' | 'pair' | 'server-rule' | 'refinement' | 'mismatch'
  note: string
}

const formWrap = ref<HTMLElement>()
const parity = ref<ParityRow[]>()
const posting = ref(false)

/** `password_confirmation` (rule `confirmed:@password`) → `password` */
function confirms(path: string): string | undefined {
  const field = findModelField(props.model, modelPath(path))
  for (const rule of field?.rules ?? []) {
    const text = typeof rule === 'string' ? rule : `${rule.rule}:${String(rule.params?.[0] ?? '')}`
    const target = text.match(/^(?:confirmed|matches):@(.+)$/)?.[1]
    if (target) return path.slice(0, path.lastIndexOf('.') + 1) + target
  }
  return undefined
}

/** Same failures on both sides? Explain the differences that are expected */
function compare(browser: Record<string, string>, server: Record<string, string[]>): ParityRow[] {
  const paths = [...new Set([...Object.keys(browser), ...Object.keys(server)])]
  // Laravel reports a failed confirmation on the confirmed field; Formo, on the confirmation field
  const pairs = new Map(paths.map((p) => [p, confirms(p)]).filter((e): e is [string, string] => !!e[1]))
  return paths.map((path): ParityRow => {
    const b = browser[path]
    const s = server[path]?.[0]
    const row = { path: path || '(form)', browser: b, server: s }
    if (b && s) return { ...row, verdict: 'same', note: 'Both caught it' }
    const field = path ? findModelField(props.model, modelPath(path)) : undefined
    if (b) {
      const target = pairs.get(path)
      if (target && server[target]) return { ...row, verdict: 'pair', note: `Same check — Laravel reports it on ${target}` }
      if (field?.[RUNTIME]?.refine || props.refinements.some((r) => r.path === path)) {
        return { ...row, verdict: 'refinement', note: 'A Zod refinement — a backend running the same schema reports it too' }
      }
      return { ...row, verdict: 'mismatch', note: 'Only the browser catches it' }
    }
    if ([...pairs].some(([confirmation, target]) => target === path && browser[confirmation])) {
      return { ...row, verdict: 'pair', note: 'Same check — Formo shows it on the confirmation field' }
    }
    if (field?.serverRules?.length) return { ...row, verdict: 'server-rule', note: `Server-only: ${field.serverRules.join(', ')}` }
    return { ...row, verdict: 'mismatch', note: 'Only the server catches it' }
  })
}

/**
 * What happens without JavaScript: the browser posts the <form> itself — its
 * fields as named, `_method` included — the server validates with the same
 * rules, and the page it sends back carries the errors (here: `setErrors()`
 * with the raw Laravel keys, what `useFormo({ errors })` does on load).
 */
async function postWithoutJavaScript() {
  const element = formWrap.value?.querySelector('form')
  if (!element) return
  posting.value = true
  try {
    const body = new FormData(element)
    if (props.endpoint.method !== 'POST' && !body.has('_method')) body.append('_method', props.endpoint.method)
    const response = await fetch(props.endpoint.url, { method: 'POST', body, headers: { Accept: 'text/html, application/json' } })
    const data = (await response.json()) as { message?: string; errors?: Record<string, string[]> }
    lastStatus.value = response.status

    // What the browser would have said about the same values
    form.clearErrors()
    await form.validate()
    const browser = { ...form.flatErrors }

    // The page the server sends back
    form.clearErrors()
    const fromServer: Record<string, string[]> = {}
    for (const [key, messages] of Object.entries(data.errors ?? {})) fromServer[laravelKeyToPath(key)] = messages
    if (!response.ok && !data.errors) fromServer[''] = [String(data.message ?? `HTTP ${response.status}`)]
    form.setErrors(data.errors ?? fromServer)
    serverErrors.value = fromServer
    parity.value = response.ok ? [] : compare(browser, fromServer)
  } finally {
    posting.value = false
  }
}

const VERDICTS: Record<ParityRow['verdict'], string> = {
  same: 'bg-emerald-100 text-emerald-800',
  pair: 'bg-emerald-100 text-emerald-800',
  'server-rule': 'bg-sky-100 text-sky-800',
  refinement: 'bg-violet-100 text-violet-700',
  mismatch: 'bg-rose-100 text-rose-700',
}
const VERDICT_LABEL: Record<ParityRow['verdict'], string> = {
  same: '✓ same',
  pair: '✓ same check',
  'server-rule': 'server-only rule',
  refinement: 'Zod refinement',
  mismatch: '⚠ differs',
}

type Source = { label: string; cls: string }
const SOURCES: Record<'formo' | 'field' | 'form' | 'schema' | 'server', Source> = {
  formo: { label: 'Formo rule', cls: 'bg-slate-100 text-slate-600' },
  field: { label: 'Zod .refine()', cls: 'bg-violet-100 text-violet-700' },
  form: { label: 'Zod object .refine()', cls: 'bg-fuchsia-100 text-fuchsia-700' },
  schema: { label: 'Zod schema', cls: 'bg-indigo-100 text-indigo-700' },
  server: { label: 'Server', cls: 'bg-amber-100 text-amber-800' },
}

const errors = computed(() =>
  Object.entries(form.flatErrors).map(([path, message]) => {
    const refinement = props.refinements.find((r) => r.path === path && r.message === message)
    const fromServer = serverErrors.value[path]?.includes(message)
    const source = fromServer
      ? { ...SOURCES.server, label: `Server ${lastStatus.value ?? ''}`.trim() }
      : refinement
        ? SOURCES[refinement.level]
        : props.schemaValidated
          ? SOURCES.schema
          : SOURCES.formo
    return { path: path || '(form)', message, source }
  }),
)

const statusClass = (status: number) =>
  status < 300 ? 'bg-emerald-100 text-emerald-800' : status === 422 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
const STATUS_TEXT: Record<number, string> = { 200: 'OK', 201: 'Created', 419: 'Page Expired', 422: 'Unprocessable Content', 500: 'Server Error' }
</script>

<template>
  <div class="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div>
      <div ref="formWrap">
        <FormoForm
          :form="form"
          @submit="submit"
          @success="onSuccess"
          @invalid="onInvalid"
          @rejected="onRejected"
          @settled="onSettled"
        />
      </div>
      <p v-if="blocked && !exchanges.length" class="mt-3 text-xs text-slate-500">
        Submit was stopped client-side ({{ blocked }}×) — nothing was sent. Fix the errors, or pick <code>validation: none</code> to let the server answer.
      </p>

      <div class="mt-6 rounded-xl border border-dashed border-slate-300 p-4 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="max-w-xl text-slate-600">
            <b class="text-slate-800">JavaScript off?</b> The browser posts the &lt;form&gt; itself — these inputs, as named,
            with <code>_method</code> — to <code>{{ endpoint.url }}</code>. Same keys, same rules: the server's errors come back
            onto the same fields (<code>useFormo(…, { errors })</code> / <code>setErrors()</code> read Laravel's keys).
          </p>
          <button
            type="button"
            class="rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            :disabled="posting"
            @click="postWithoutJavaScript"
          >
            {{ posting ? 'Posting…' : 'Post it like JavaScript is off' }}
          </button>
        </div>

        <div v-if="parity" class="mt-4">
          <p v-if="!parity.length" class="font-medium text-emerald-700">✓ The server accepted it — nothing to compare.</p>
          <table v-else class="w-full text-left">
            <thead class="text-slate-500">
              <tr>
                <th class="py-1 pr-3 font-medium">Field</th>
                <th class="py-1 pr-3 font-medium">Browser (Formo)</th>
                <th class="py-1 pr-3 font-medium">Server</th>
                <th class="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in parity" :key="row.path" class="border-t border-slate-200 align-top">
                <td class="py-1.5 pr-3"><code class="font-semibold">{{ row.path }}</code></td>
                <td class="py-1.5 pr-3" :class="row.browser ? 'text-rose-600' : 'text-slate-400'">{{ row.browser ?? '—' }}</td>
                <td class="py-1.5 pr-3" :class="row.server ? 'text-rose-600' : 'text-slate-400'">{{ row.server ?? '—' }}</td>
                <td class="py-1.5">
                  <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap" :class="VERDICTS[row.verdict]">{{ VERDICT_LABEL[row.verdict] }}</span>
                  <p class="mt-0.5 text-slate-500">{{ row.note }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <aside class="space-y-4 text-xs">
      <div>
        <h4 class="mb-1.5 font-semibold text-slate-500">Errors — and where they come from</h4>
        <p v-if="!errors.length" class="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-400">
          None — blur a field or submit.
        </p>
        <ul v-else class="space-y-1.5">
          <li v-for="error in errors" :key="error.path" class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <code class="font-semibold text-slate-800">{{ error.path }}</code>
              <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="error.source.cls">{{ error.source.label }}</span>
            </div>
            <p class="mt-0.5 text-rose-600">{{ error.message }}</p>
          </li>
        </ul>
      </div>

      <div>
        <h4 class="mb-1.5 font-semibold text-slate-500">Events — @success / @invalid / @rejected / @settled</h4>
        <p v-if="!events.length" class="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-400">Submit to see them.</p>
        <ul v-else class="space-y-1">
          <li v-for="e in events" :key="e.id" class="flex items-baseline gap-2">
            <span class="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold" :class="EVENT_CLASS[e.name]">{{ e.name }}</span>
            <span class="text-slate-600">{{ e.detail }}</span>
          </li>
        </ul>
      </div>

      <div v-if="exchanges.length" class="space-y-2">
        <h4 class="font-semibold text-slate-500">Last request — {{ exchanges.length }} sent</h4>
        <div class="overflow-hidden rounded-xl border border-slate-200">
          <div class="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <code class="font-semibold text-slate-800">{{ exchanges[0].request.method }} {{ exchanges[0].request.url }}</code>
            <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="statusClass(exchanges[0].response.status)">
              {{ exchanges[0].response.status }} {{ STATUS_TEXT[exchanges[0].response.status] ?? '' }}
            </span>
          </div>
          <details class="border-b border-slate-200 px-3 py-2">
            <summary class="cursor-pointer font-medium text-slate-600">Headers</summary>
            <div class="mt-2 rounded-lg bg-slate-900 p-2"><JsonView :value="exchanges[0].request.headers" /></div>
          </details>
          <div class="border-b border-slate-200 px-3 py-2">
            <p class="mb-1 font-medium text-slate-600">Body — what the controller receives</p>
            <div class="max-h-64 overflow-auto rounded-lg bg-slate-900 p-2"><JsonView :value="exchanges[0].request.body" /></div>
          </div>
          <div class="px-3 py-2">
            <p class="mb-1 font-medium text-slate-600">Response</p>
            <div class="max-h-64 overflow-auto rounded-lg bg-slate-900 p-2"><JsonView :value="exchanges[0].response.body" /></div>
          </div>
        </div>
      </div>

      <div>
        <h4 class="mb-1.5 font-semibold text-slate-500">form.values</h4>
        <div class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3"><JsonView :value="form.values" /></div>
      </div>
      <div>
        <h4 class="mb-1.5 font-semibold text-slate-500">form.errors</h4>
        <div class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3"><JsonView :value="form.errors" /></div>
      </div>
    </aside>
  </div>
</template>
