<script setup lang="ts">
/**
 * CSRF with Laravel — two setups, both talking to a mock Laravel backend that
 * runs inside the Vite dev server (playground/server/mock-laravel.ts).
 *
 * 1. SPA / Sanctum (JSON API). The form has `attr.action` and no @submit, so it
 *    sends itself via `form.request()`:
 *      - `csrf: 'sanctum'` GETs /sanctum/csrf-cookie when there's no XSRF-TOKEN
 *        cookie yet, then sends it back as `X-XSRF-TOKEN`
 *      - a 419 (expired session) → fresh cookie + one automatic retry
 *      - a 422 → Laravel's `errors` land on the matching fields
 *        (`phones.0.number` → the first phone row); unknown keys → form error
 *
 * 2. Blade-style native post (`<FormoForm native>`): validated client side,
 *    then posted natively with hidden `_token` (from <meta name="csrf-token">,
 *    like @csrf) and `_method=PUT` (like @method('PUT')).
 *
 * Tokens are only sent to the page's origin, `request.baseUrl` and `csrf.origins`.
 */
import { onMounted, ref } from 'vue'
import { Formo, FormoForm, useFormo, type FormoResponse } from 'formo-vue'

/* ---- 1. SPA / Sanctum --------------------------------------------------- */

const spaForm = useFormo(
  Formo.form({ alias: 'profile', attr: { action: '/api/profile', method: 'put' } })
    .add('name', { required: true })
    .add('username', { rules: 'required|alpha_dash', message: 'Server rejects “admin”' })
    .add('email', 'input|email', {
      required: true,
      message: 'Server rejects taken@example.com (field) and …@spam.test (form-level)',
    })
    .add(
      Formo.group('phones', { label: 'Phones', min: 1, max: 3, addLabel: 'Add phone', rowLabel: 'Phone :index' })
        .add('number', 'input|tel', { label: 'Number', message: 'Server rejects 555 numbers' })
        .padBlueprint([{ number: '555 010 9999' }]),
    )
    .add('save', 'button', { label: 'Save profile', attr: { type: 'submit' } }),
  { config: { csrf: 'sanctum' } },
)

const lastResponse = ref<unknown>()
function onSuccess(data: { message: string; csrf: string }) {
  lastResponse.value = data
  refreshLog()
}
function onFailure(response: FormoResponse) {
  lastResponse.value = { status: response.status, ...response.data }
  refreshLog()
}

/* ---- 2. Blade-style native form ---------------------------------------- */

const nativeForm = Formo.form({ alias: 'settings', attr: { action: '/web/profile', method: 'put', target: 'laravel-result' } })
  .add('display_name', { required: true, val: 'Ada' })
  .add('newsletter', 'bool', true, { label: 'Subscribe to the newsletter' })
  .add('send', 'button', { label: 'Post natively', attr: { type: 'submit' } })

/** In a Blade app this is in your layout: <meta name="csrf-token" content="{{ csrf_token() }}"> */
async function renderMetaToken() {
  const { token } = await (await fetch('/web/csrf-token', { credentials: 'include' })).json()
  let meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
  if (!meta) {
    meta = Object.assign(document.createElement('meta'), { name: 'csrf-token' })
    document.head.appendChild(meta)
  }
  meta.content = token
  metaToken.value = token
}

/* ---- Server tools ------------------------------------------------------- */

interface LogEntry { at: string; method: string; url: string; status: number; csrf: string; headers: Record<string, string> }
const requests = ref<LogEntry[]>([])
const metaToken = ref('')
const xsrfCookie = ref('')

async function refreshLog() {
  requests.value = await (await fetch('/__mock/log')).json()
  xsrfCookie.value = decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '')
}

async function expireSession() {
  await fetch('/__mock/expire-session', { method: 'POST', credentials: 'include' })
  refreshLog()
}

function deleteCookie() {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  refreshLog()
}

onMounted(async () => {
  await renderMetaToken()
  refreshLog()
})

const short = (v: string) => (v.length > 18 ? `${v.slice(0, 18)}…` : v || '—')
const statusClass = (s: number) =>
  s < 300 ? 'bg-emerald-100 text-emerald-800' : s === 422 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div>
      <h3 class="text-sm font-semibold text-slate-900">1 · SPA with Sanctum (JSON API)</h3>
      <p class="mb-5 mt-1 text-xs text-slate-500">
        <code class="rounded bg-slate-100 px-1">csrf: 'sanctum'</code> — no <code class="rounded bg-slate-100 px-1">@submit</code> handler:
        the form PUTs itself to <code class="rounded bg-slate-100 px-1">attr.action</code>.
      </p>
      <FormoForm :form="spaForm" @success="onSuccess" @failure="onFailure" />

      <div class="mt-5 flex flex-wrap gap-2">
        <button type="button" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-400 hover:text-rose-700" @click="expireSession">
          Expire session (→ 419, auto-retry)
        </button>
        <button type="button" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700" @click="deleteCookie">
          Delete XSRF-TOKEN cookie (→ re-prime)
        </button>
      </div>

      <div class="mt-8 border-t border-slate-200 pt-6">
        <h3 class="text-sm font-semibold text-slate-900">2 · Blade-style native form post</h3>
        <p class="mb-5 mt-1 text-xs text-slate-500">
          <code class="rounded bg-slate-100 px-1">&lt;FormoForm native&gt;</code> — hidden <code class="rounded bg-slate-100 px-1">_token</code>
          from the meta tag (<code class="rounded bg-slate-100 px-1">{{ short(metaToken) }}</code>) and
          <code class="rounded bg-slate-100 px-1">_method=PUT</code>; the response opens below.
          After “Expire session” this page's meta token is stale — exactly like an old Blade tab — so
          the server answers <strong>419 Page Expired</strong>; reload the playground for a fresh token.
        </p>
        <FormoForm :form="nativeForm" native />
        <iframe
          name="laravel-result"
          title="Server response"
          class="mt-4 h-40 w-full rounded-lg border border-slate-200 bg-white"
          @load="refreshLog"
        />
      </div>

      <div class="mt-8 border-t border-slate-200 pt-6">
        <div class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold text-slate-900">Requests seen by the server</h3>
          <button type="button" class="text-xs text-indigo-600 hover:underline" @click="refreshLog">Refresh</button>
        </div>
        <p class="mt-1 text-xs text-slate-500">
          XSRF-TOKEN cookie: <code class="rounded bg-slate-100 px-1">{{ short(xsrfCookie) }}</code>
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-slate-500">
              <tr><th class="py-1 pr-3 font-medium">Time</th><th class="pr-3 font-medium">Request</th><th class="pr-3 font-medium">Status</th><th class="font-medium">CSRF</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in requests" :key="i" class="border-t border-slate-100 align-top">
                <td class="py-1.5 pr-3 text-slate-500">{{ r.at }}</td>
                <td class="pr-3 font-mono">{{ r.method }} {{ r.url }}</td>
                <td class="pr-3"><span class="rounded px-1.5 py-0.5 font-semibold" :class="statusClass(r.status)">{{ r.status }}</span></td>
                <td class="text-slate-700">{{ r.csrf }}</td>
              </tr>
              <tr v-if="!requests.length"><td colspan="4" class="py-2 text-slate-400">No requests yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">spaForm.values</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ spaForm.values }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">spaForm.errors — incl. 422s from the server</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ spaForm.errors }}</pre>
      </div>
      <div v-if="lastResponse">
        <h3 class="mb-1.5 font-semibold text-slate-500">Last response</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ lastResponse }}</pre>
      </div>
    </aside>
  </div>
</template>
