<script setup lang="ts">
/**
 * Callbacks, form-level rules and server errors.
 *
 *  - `callbacks: { pass, fail }` run after validation, deepest fields first
 *    (Formo's `callbacks` — ':self' for the form itself). Returning false or a
 *    string from a `pass` callback fails the form.
 *  - A form-level rule (like Formo's `Model_User::can_login` example) runs
 *    once every field passed; its error shows at the top of the form.
 *  - `@submit` may be async: the submit button spins meanwhile, and errors
 *    from the server go back in with `setErrors()` — in Formo's errors() format.
 *
 * Try: "ben" / anything → the server says the account is locked
 *      "admin" / "wrong" → the form-level rule fails
 *      "admin" / "password" → a pass callback vetoes it
 *      "admin" / "secret" → success
 */
import { ref } from 'vue'
import { Formo, FormoForm, useFormo, type FormoSubmitContext } from 'formo-vue'

const events = ref<string[]>([])
function log(text: string) {
  events.value.unshift(`${new Date().toLocaleTimeString()}  ${text}`)
}

const form = useFormo(
  Formo.form({
    alias: 'login',
    // Form-level rule: gets all the form values
    rules: [
      (values: { username: string; password: string }) =>
        values.username !== 'admin' || values.password === 'secret' || 'Username or password is incorrect',
    ],
    callbacks: {
      pass: {
        ':self': [() => log('callback: form passed (pass → :self)')],
        username: [({ value }) => log(`callback: username "${value}" passed`)],
      },
      fail: {
        ':self': [({ form }) => log(`callback: form failed with ${Object.keys(form.flatErrors).length} error(s)`)],
      },
    },
  })
    .add('username', { required: true, attr: { autocomplete: 'username' } })
    .add('password', 'input|password', {
      required: true,
      attr: { autocomplete: 'current-password' },
      // A pass callback can still veto the submit
      callbacks: { pass: [({ value }) => value !== 'password' || 'Seriously? Pick a better password'] },
    })
    .add('remember', 'bool', false, { label: 'Remember me' })
    .add('login', 'button', { label: 'Sign in', attr: { type: 'submit', class: 'w-full' } }),
)

/** Pretend server: answers like a Laravel/Kohana controller returning errors */
async function submit(values: Record<string, any>, { setErrors }: FormoSubmitContext) {
  await new Promise((r) => setTimeout(r, 900))
  if (values.username === 'ben') {
    setErrors({ username: 'This account is locked', ':self': 'We could not sign you in' })
    log('server: 422 — errors set with setErrors()')
    return
  }
  log('server: 200 — signed in ✓')
}
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="mx-auto w-full max-w-sm">
      <h3 class="mb-6 text-center text-lg font-semibold text-slate-900">Sign in to your account</h3>
      <FormoForm :form="form" @submit="submit" />
      <button type="button" class="mt-4 w-full text-center text-xs text-slate-500 hover:text-indigo-600 hover:underline" @click="form.reset()">
        Reset form
      </button>
    </div>

    <aside class="space-y-4 text-xs">
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">Callbacks & server</h3>
        <ul class="max-h-60 space-y-1 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-slate-200">
          <li v-for="(e, i) in events" :key="i">{{ e }}</li>
          <li v-if="!events.length" class="text-slate-500">Submit to see callbacks run.</li>
        </ul>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.errors</h3>
        <pre class="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-rose-300">{{ form.errors }}</pre>
      </div>
      <div>
        <h3 class="mb-1.5 font-semibold text-slate-500">form.values</h3>
        <pre class="overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-emerald-300">{{ form.values }}</pre>
      </div>
    </aside>
  </div>
</template>
