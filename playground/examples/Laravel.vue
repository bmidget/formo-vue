<script setup lang="ts">
/**
 * CSRF with Laravel — two setups (runs 100% client-side, no backend required):
 *
 * 1. SPA / Sanctum (JSON API). With `attr.action` and `csrf: 'sanctum'`,
 *    `form.request()` ensures the `XSRF-TOKEN` cookie is primed, attaches
 *    `X-XSRF-TOKEN`, retries once on 419, and maps Laravel 422 `errors`
 *    (`phones.0.number` → the first phone row) back onto the fields.
 *
 * 2. Blade-style native post (`<FormoForm native>`): validated client side,
 *    then posted natively with hidden `_token` (from <meta name="csrf-token">,
 *    like @csrf) and `_method=PUT` (like @method('PUT')).
 */
import { computed, onMounted, ref } from 'vue'
import { Formo, FormoForm, csrfHeaders, useFormo } from 'formo-vue'

/* ---- 1. SPA / Sanctum --------------------------------------------------- */

const spaForm = useFormo(
  Formo.form({ alias: 'profile', attr: { action: '/api/profile', method: 'put' } })
    .add('name', { required: true, val: 'Ada Lovelace' })
    .add('username', { rules: 'required|alpha_dash', val: 'ada', message: 'Click "Simulate 422" below to see server errors map back' })
    .add('email', 'input|email', { required: true, val: 'ada@example.com' })
    .add(
      Formo.group('phones', { label: 'Phones', min: 1, max: 3, addLabel: 'Add phone', rowLabel: 'Phone :index' })
        .add('number', 'input|tel', { label: 'Number' })
        .padBlueprint([{ number: '555 010 9999' }]),
    )
    .add('save', 'button', { label: 'Inspect request', attr: { type: 'submit' } }),
  { config: { csrf: 'sanctum' } },
)

const lastRequest = ref<{ method: string; url: string; headers: Record<string, string>; body: unknown } | null>(null)

async function onSpaSubmit(values: Record<string, unknown>) {
  // Ensure a demo XSRF-TOKEN cookie exists so csrfHeaders() shows the real header
  if (!document.cookie.includes('XSRF-TOKEN=')) {
    document.cookie = 'XSRF-TOKEN=demo-xsrf-token-7f3a9c; path=/; SameSite=Lax'
  }
  const csrf = await csrfHeaders(spaForm.options.config.csrf, { url: '/api/profile' })
  lastRequest.value = {
    method: 'PUT',
    url: '/api/profile',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...csrf,
    },
    body: values,
  }
}

function simulate422() {
  spaForm.setErrors({
    email: 'The email has already been taken.',
    'phones.0.number': 'The phones.0.number format is invalid.',
  })
}

function clearServerErrors() {
  spaForm.clearErrors()
}

/* ---- 2. Blade-style native form ---------------------------------------- */

const nativeForm = Formo.form({ alias: 'settings', attr: { action: '/web/profile', method: 'put' } })
  .add('display_name', { required: true, val: 'Ada' })
  .add('newsletter', 'bool', true, { label: 'Subscribe to the newsletter' })
  .add('send', 'button', { label: 'Submit (native)', attr: { type: 'submit' } })

const nativeWrap = ref<HTMLElement>()
const hiddenInputsHtml = ref('')
const nativeFormData = ref<Array<[string, string]>>([])

function refreshNativeDom() {
  const form = nativeWrap.value?.querySelector('form')
  if (!form) return
  const hiddens = [...form.querySelectorAll('input[type="hidden"]')]
  hiddenInputsHtml.value = hiddens.map((el) => el.outerHTML).join('\n')
  nativeFormData.value = [...new FormData(form).entries()].map(([k, v]) => [k, String(v)])
}

onMounted(() => {
  // Ensure <meta name="csrf-token"> exists so <FormoForm native> renders _token
  if (!document.querySelector('meta[name="csrf-token"]')) {
    const meta = Object.assign(document.createElement('meta'), {
      name: 'csrf-token',
      content: 'blade-csrf-token-9b2e4d',
    })
    document.head.appendChild(meta)
  }
  setTimeout(refreshNativeDom, 50)
})

const nativeAttrPreview = computed(() => `<form name="settings" action="/web/profile" method="post">\n${hiddenInputsHtml.value}\n  <!-- ...fields... -->\n</form>`)
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="space-y-8">
      <div>
        <h3 class="text-sm font-semibold text-slate-900">1 · SPA with Sanctum (JSON API)</h3>
        <p class="mb-4 mt-1 text-xs text-slate-500">
          <code class="rounded bg-slate-100 px-1">csrf: 'sanctum'</code> reads the <code class="rounded bg-slate-100 px-1">XSRF-TOKEN</code> cookie into
          <code class="rounded bg-slate-100 px-1">X-XSRF-TOKEN</code>, retries 419s, and maps Laravel 422 <code class="rounded bg-slate-100 px-1">errors</code>
          (including <code class="rounded bg-slate-100 px-1">phones.0.number</code>) onto fields.
        </p>

        <FormoForm :form="spaForm" @submit="onSpaSubmit" />

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-amber-400 hover:text-amber-700"
            @click="simulate422"
          >
            Simulate 422 response
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
            @click="clearServerErrors"
          >
            Clear errors
          </button>
        </div>
      </div>

      <div class="border-t border-slate-200 pt-6">
        <h3 class="text-sm font-semibold text-slate-900">2 · Blade-style native form post</h3>
        <p class="mb-4 mt-1 text-xs text-slate-500">
          <code class="rounded bg-slate-100 px-1">&lt;FormoForm native&gt;</code> injects hidden
          <code class="rounded bg-slate-100 px-1">_token</code> (from <code class="rounded bg-slate-100 px-1">&lt;meta name="csrf-token"&gt;</code>)
          and <code class="rounded bg-slate-100 px-1">_method="PUT"</code> into the <code class="rounded bg-slate-100 px-1">&lt;form&gt;</code>.
        </p>

        <div ref="nativeWrap" @input="refreshNativeDom" @change="refreshNativeDom">
          <FormoForm :form="nativeForm" native @submit.prevent="refreshNativeDom" />
        </div>

        <div class="mt-4 space-y-3">
          <div>
            <p class="mb-1 text-xs font-semibold text-slate-500">Rendered &lt;form&gt; hidden inputs</p>
            <pre class="overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-sky-300">{{ nativeAttrPreview }}</pre>
          </div>
          <div>
            <p class="mb-1 text-xs font-semibold text-slate-500">FormData entries</p>
            <pre class="overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-emerald-300">{{ Object.fromEntries(nativeFormData) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">spaForm.values</h3>
        <pre class="max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ spaForm.values }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">spaForm.errors</h3>
        <pre class="max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ spaForm.errors }}</pre>
      </div>
      <div v-if="lastRequest">
        <h3 class="mb-1.5 font-semibold text-slate-500">Outgoing request (csrfHeaders)</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-sky-300">{{ lastRequest }}</pre>
      </div>
    </aside>
  </div>
</template>
