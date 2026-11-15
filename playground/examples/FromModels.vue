<script setup lang="ts">
/**
 * Forms from models — a workbench. The same "user" described five ways (Laravel
 * rules, a backend's Formo model, JSON Schema, OpenAPI, Zod) becomes a working
 * form with the options you pick. Fill it in and submit: it validates in the
 * browser, then posts to a fake Laravel backend (in the browser too) that
 * validates again — `unique` and the other server-only rules included — and
 * answers 201 / 422 / 419 / 500. Every error says where it came from, and the
 * outcome events (@success / @invalid / @rejected / @settled) are logged as they fire.
 *
 * The Code tab gives the lines to use in your app — essentially:
 *   useFormo(Formo.fromModel(fromLaravel(props.rules), { mode: 'update', values: props.user }))
 */
import { computed, markRaw, ref, shallowRef, watch } from 'vue'
import { z } from 'zod'
import {
  RUNTIME,
  formFromModel,
  fromJsonSchema,
  fromLaravel,
  fromOpenApi,
  fromZod,
  parseModel,
  type FieldSpec,
  type FormFromModelOptions,
  type FormoModel,
  type ModelField,
  type ModelWarning,
  type ValidationMode,
  type ZodRefinement,
} from 'formo-vue/schema'
import JsonView from '../components/JsonView.vue'
import ModelFormPreview from '../components/ModelFormPreview.vue'
import { TAKEN, type ServerBehaviour } from '../components/mockLaravel'

/* ---- The same user, five ways --------------------------------------------- */

/** 1. A FormRequest's rules(), attributes(), messages() — what an Inertia prop carries */
const laravelRequest = {
  name: 'user',
  rules: {
    name: 'required|string|max:255',
    email: 'required|email|max:255|unique:users,email',
    username: 'required|alpha_dash|min:3|username_available',
    role: 'required|in:"admin","editor","viewer"',
    team_id: 'nullable|integer|exists:teams,id',
    bio: 'nullable|string|max:2000',
    birthday: 'nullable|date|before:today',
    password: 'required|string|min:8|confirmed',
    phones: 'array|max:3',
    'phones.*.type': 'required|in:home,work',
    'phones.*.number': 'required|string|max:20',
    newsletter: 'boolean',
    newsletter_frequency: 'required_if:newsletter,true|in:daily,weekly',
    terms: 'accepted',
  },
  attributes: { team_id: 'team', 'phones.*.number': 'phone number' },
  messages: { 'email.required': 'We need an email to reach you.', 'username.min': 'Usernames have at least :min characters.' },
}

/** 2. A backend's Formo model (IR JSON v1) — an Inertia prop or GET /formo/models/user */
const backendModel: FormoModel = {
  version: 1,
  name: 'user',
  fields: [
    { name: 'id', type: 'integer', readOnly: true },
    { name: 'name', type: 'string', label: 'Full name', required: true, constraints: { maxLength: 255 } },
    { name: 'email', type: 'string', format: 'email', required: true, constraints: { maxLength: 255 }, serverRules: ['unique:users,email'] },
    { name: 'username', type: 'string', required: true, description: 'Lowercase letters, digits and _', constraints: { minLength: 3, pattern: '^[a-z0-9_]+$' } },
    {
      name: 'role',
      type: 'enum',
      required: true,
      options: [{ value: 'admin', label: 'Administrator' }, { value: 'editor', label: 'Editor' }, { value: 'viewer', label: 'Viewer' }],
    },
    { name: 'team_id', type: 'relation', label: 'Team', relation: { kind: 'belongsTo', model: 'teams' } },
    { name: 'status', type: 'enum', readOnly: true, options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }] },
    { name: 'bio', type: 'text', nullable: true, constraints: { maxLength: 2000 }, ui: { attr: { rows: 3 } } },
    { name: 'birthday', type: 'date', nullable: true },
    { name: 'password', type: 'string', format: 'password', writeOnly: true, required: true, constraints: { minLength: 8 } },
    { name: 'password_confirmation', type: 'string', format: 'password', writeOnly: true, rules: ['confirmed:@password'] },
    {
      name: 'phones',
      type: 'array',
      constraints: { maxItems: 3 },
      items: {
        type: 'object',
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'type', type: 'enum', required: true, options: [{ value: 'home' }, { value: 'work' }] },
          { name: 'number', type: 'string', format: 'tel', required: true },
        ],
      },
    },
    { name: 'is_admin', type: 'boolean', fillable: false },
    { name: 'created_at', type: 'datetime', label: 'Member since', readOnly: true },
  ],
}

/** 3. JSON Schema (2020-12) */
const jsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'User',
  type: 'object',
  required: ['name', 'email', 'role', 'password'],
  properties: {
    id: { type: 'integer', readOnly: true },
    name: { type: 'string', title: 'Full name', maxLength: 255, examples: ['Ada Lovelace'] },
    email: { type: 'string', format: 'email', maxLength: 255 },
    role: { type: 'string', enum: ['admin', 'editor', 'viewer'], 'x-enumNames': ['Administrator', 'Editor', 'Viewer'] },
    status: { type: 'string', enum: ['active', 'suspended'], readOnly: true },
    bio: { type: ['string', 'null'], maxLength: 2000, description: 'A few words about you', 'x-formo': { attr: { rows: 3 } } },
    birthday: { type: ['string', 'null'], format: 'date' },
    password: { type: 'string', format: 'password', minLength: 8, writeOnly: true },
    newsletter: { type: 'boolean' },
    newsletter_frequency: { oneOf: [{ const: 'daily', title: 'Every day' }, { const: 'weekly', title: 'Once a week' }] },
    phones: {
      type: 'array',
      maxItems: 3,
      items: { type: 'object', required: ['number'], properties: { number: { type: 'string', format: 'tel' } } },
    },
    created_at: { type: 'string', format: 'date-time', readOnly: true },
  },
  dependentRequired: { newsletter: ['newsletter_frequency'] },
}

/** 4. OpenAPI 3.1: the request body of an operation */
const openapi = {
  openapi: '3.1.0',
  info: { title: 'Users API', version: '1.0.0' },
  paths: {
    '/users': {
      post: {
        operationId: 'createUser',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInput' } } } },
      },
    },
    '/users/{user}': {
      put: {
        operationId: 'updateUser',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/UserInput' },
                  { properties: { avatar: { type: 'string', format: 'binary', contentMediaType: 'image/png' } } },
                ],
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      UserInput: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          id: { type: 'integer', readOnly: true },
          name: { type: 'string', maxLength: 255 },
          email: { type: 'string', format: 'email' },
          role: { $ref: '#/components/schemas/Role' },
          status: { type: 'string', enum: ['active', 'suspended'], readOnly: true },
          password: { type: 'string', format: 'password', minLength: 8, writeOnly: true },
          created_at: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      Role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
    },
  },
}
const operations = ['POST /users', 'PUT /users/{user}']

/** 5. A Zod schema — with refinements Formo can't express */
const UserSchema = z
  .object({
    name: z.string().min(2).max(255).meta({ title: 'Full name' }),
    email: z.email(),
    username: z.string().min(3).regex(/^[a-z0-9_]+$/).meta({ description: 'Lowercase letters, digits and _' }),
    role: z.enum(['admin', 'editor', 'viewer']),
    status: z.enum(['active', 'suspended']).optional().meta({ readOnly: true }),
    bio: z.string().max(2000).nullable().optional(),
    birthday: z.iso.date().optional(),
    password: z
      .string()
      .min(8)
      .refine((v) => /\d/.test(v), 'Add at least one digit')
      .meta({ writeOnly: true }),
    password_confirmation: z.string().meta({ writeOnly: true }),
    phones: z
      .array(
        z.object({
          type: z.enum(['home', 'work']),
          number: z.string().min(5).refine((v) => v.trim().startsWith('+'), 'Use the international format: +1 555…'),
        }),
      )
      .max(3),
    terms: z.literal(true).meta({ title: 'I accept the terms' }),
  })
  .refine((u) => u.password === u.password_confirmation, { path: ['password_confirmation'], message: "The passwords don't match" })

/** The record an update form loads — as Laravel serializes it */
const user = {
  id: 7,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  username: 'ada',
  role: 'editor',
  team: { id: 2, name: 'Docs' },
  status: 'active',
  bio: null,
  birthday: '1815-12-10T00:00:00.000000Z',
  password: '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2',
  phones: [{ id: 1, type: 'work', number: '+1 555 010 9999' }],
  newsletter: true,
  newsletter_frequency: 'weekly',
  is_admin: false,
  created_at: '2024-03-01T10:00:00.000000Z',
}
const teams = [{ value: 1, label: 'Core' }, { value: 2, label: 'Docs' }]

/* ---- Workbench state ------------------------------------------------------ */

type SourceId = 'laravel' | 'backend' | 'jsonSchema' | 'openapi' | 'zod'
type EditableId = Exclude<SourceId, 'zod'>

const sources: Array<{ id: SourceId; label: string; hint: string }> = [
  {
    id: 'laravel',
    label: 'Laravel rules',
    hint: "A FormRequest's rules(), attributes(), messages(). Types come from the rules; `unique` stays server-side; `username_available` is a custom rule — run it in the browser with clientRules. Rules don't say what's read-only: a backend model does.",
  },
  {
    id: 'backend',
    label: 'Backend model',
    hint: 'IR JSON v1 as a backend sends it: read-only (status, created_at), write-only (password) and guarded (is_admin) fields, labelled options, a relation.',
  },
  { id: 'jsonSchema', label: 'JSON Schema', hint: 'title, examples, readOnly / writeOnly, x-enumNames, labelled oneOf, dependentRequired, x-formo.' },
  { id: 'openapi', label: 'OpenAPI', hint: "An OpenAPI 3.1 document: the chosen operation's request body (PUT adds a file upload)." },
  {
    id: 'zod',
    label: 'Zod',
    hint: "The schema is in this example's source. Try a password without a digit, a phone number without +, or different passwords (checked on submit).",
  },
]

const pretty = (value: unknown) => JSON.stringify(value, null, 2)
const initialText: Record<EditableId, string> = {
  laravel: pretty(laravelRequest),
  backend: pretty(backendModel),
  jsonSchema: pretty(jsonSchema),
  openapi: pretty(openapi),
}

const source = ref<SourceId>('laravel')
const text = ref<Record<EditableId, string>>({ ...initialText })
/** The selected source's text (Zod is code: edited in the source) */
const sourceText = computed({
  get: () => (source.value === 'zod' ? '' : text.value[source.value]),
  set: (value: string) => {
    if (source.value !== 'zod') text.value = { ...text.value, [source.value]: value }
  },
})
const resetSource = () => (sourceText.value = source.value === 'zod' ? '' : initialText[source.value])
const modes = ['create', 'update'] as const
const readOnlyModes = ['auto', 'uneditable', 'omit'] as const
const validations = ['derived', 'schema', 'none'] as const
const operation = ref(operations[0])
const mode = ref<'create' | 'update'>('create')
const readOnly = ref<'auto' | 'uneditable' | 'omit'>('auto')
const validation = ref<ValidationMode>('derived')
const clientRules = ref(false)
const only = ref('')
const except = ref('')
const tab = ref<'try' | 'code' | 'model' | 'definition' | 'warnings'>('try')
const behaviour = ref<ServerBehaviour>('validate')
const behaviours: Array<{ id: ServerBehaviour; label: string; hint: string }> = [
  { id: 'validate', label: 'Validates', hint: `Checks the rules again, like a FormRequest — and the ones the browser can't: ${TAKEN.slice(0, 3).join(', ')}… are taken.` },
  { id: 'accept', label: 'Accepts all', hint: 'Saves whatever it gets: 201 / 200.' },
  { id: 'expired', label: '419', hint: 'The session expired (CSRF token mismatch).' },
  { id: 'crash', label: '500', hint: 'The server failed.' },
]

/** Where the form posts: the REST route for the mode, or the OpenAPI operation */
const endpoint = computed(() => {
  if (source.value === 'openapi') {
    const [method, path] = operation.value.split(' ')
    return { method, url: `/api${path.replace('{user}', String(user.id))}` }
  }
  return mode.value === 'update' ? { method: 'PUT', url: `/api/users/${user.id}` } : { method: 'POST', url: '/api/users' }
})

const isZod = computed(() => source.value === 'zod')
// 'schema' needs a schema behind the model
watch(source, (id) => {
  if (id !== 'zod' && validation.value === 'schema') validation.value = 'derived'
})

/** Refinement failures reported by Zod — the preview tags errors with them */
const refinements = ref<ZodRefinement[]>([])

const list = (value: string) => value.split(',').map((p) => p.trim()).filter(Boolean)

function readModel(onWarning: (w: ModelWarning) => void): FormoModel {
  switch (source.value) {
    case 'laravel':
      return fromLaravel(JSON.parse(text.value.laravel), { onWarning, clientRules: clientRules.value ? ['username_available'] : [] })
    case 'backend':
      return parseModel(text.value.backend, onWarning)
    case 'jsonSchema':
      return fromJsonSchema(JSON.parse(text.value.jsonSchema), { name: 'user', onWarning })
    case 'openapi':
      return fromOpenApi(JSON.parse(text.value.openapi), { operation: operation.value, name: 'user', onWarning })
    case 'zod':
      return fromZod(UserSchema, {
        toJSONSchema: z.toJSONSchema,
        name: 'user',
        onWarning,
        onRefinement: (refinement) => refinements.value.push(refinement),
      })
    default:
      throw new Error(`Unknown source ${String(source.value)}`)
  }
}

/** Everything formFromModel() was given — shown next to the result */
const options = computed<FormFromModelOptions>(() => ({
  // where it posts — also with JavaScript off (method spoofed with _method)
  attr: { action: endpoint.value.url, method: endpoint.value.method.toLowerCase() },
  mode: mode.value,
  ...(readOnly.value !== 'auto' ? { readOnly: readOnly.value } : {}),
  validation: validation.value,
  only: list(only.value),
  except: list(except.value),
  options: { team_id: teams },
  values: mode.value === 'update' ? user : undefined,
  fields: { save: { driver: 'button', label: mode.value === 'update' ? 'Save changes' : 'Create user', attr: { type: 'submit' } } },
}))

interface Built {
  model: FormoModel
  definition: FieldSpec
  warnings: ModelWarning[]
}

const error = ref('')
/** The last result that built — kept while a source being edited is invalid. Raw: its rules hold RegExps and functions */
const built = shallowRef<Built>()
const formKey = ref(0)

watch(
  [source, text, operation, options, clientRules],
  () => {
    const warnings: ModelWarning[] = []
    const onWarning = (w: ModelWarning) => warnings.push(w)
    try {
      const model = readModel(onWarning)
      const definition = formFromModel(model, { ...options.value, onWarning })
      built.value = markRaw({ model, definition, warnings })
      error.value = ''
      refinements.value = []
      formKey.value++
    } catch (e) {
      error.value = (e as Error).message
    }
  },
  { immediate: true, deep: true },
)

/** Functions and RegExps as text, so the definition reads as JSON */
function printable(value: unknown): unknown {
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`
  if (value instanceof RegExp) return String(value)
  if (Array.isArray(value)) return value.map(printable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, printable(v)]))
  return value
}

/** What runs through Zod (besides Formo's derived rules) */
const zodChecks = computed(() => {
  const model = built.value?.model
  if (!isZod.value || !model) return undefined
  const fields: string[] = []
  const walk = (list: ModelField[], prefix: string) => {
    for (const field of list) {
      const path = prefix ? `${prefix}.${field.name}` : field.name
      if (field[RUNTIME]?.refine) fields.push(path)
      walk(field.fields ?? field.items?.fields ?? [], path)
    }
  }
  walk(model.fields, '')
  return { fields, objectLevel: !!model[RUNTIME]?.refine }
})

/** The lines to use in an app, for the current choices — a complete component */
const code = computed(() => {
  const update = mode.value === 'update'
  const quote = (paths: string[]) => `[${paths.map((p) => `'${p}'`).join(', ')}]`
  const adapters: Record<SourceId, { imports: string[]; props: string[]; call: string; relations: boolean }> = {
    laravel: {
      imports: ["import { fromLaravel, type LaravelRulesInput } from 'formo-vue/schema'"],
      props: ['/** { rules, attributes, messages } of your FormRequest — see docs/schema.md */', 'rules: LaravelRulesInput'],
      call: `fromLaravel(props.rules${clientRules.value ? ", { clientRules: ['username_available'] }" : ''})`,
      relations: true,
    },
    backend: {
      imports: ["import { parseModel, type FormoModel } from 'formo-vue/schema'"],
      props: ['/** The Formo model (IR JSON v1) your backend sends */', 'userModel: FormoModel'],
      call: 'parseModel(props.userModel)',
      relations: true,
    },
    jsonSchema: {
      imports: ["import { fromJsonSchema } from 'formo-vue/schema'", "import userSchema from './user.schema.json'"],
      props: [],
      call: "fromJsonSchema(userSchema, { name: 'user' })",
      relations: false,
    },
    openapi: {
      imports: ["import { fromOpenApi } from 'formo-vue/schema'", "import openapi from './openapi.json'"],
      props: [],
      call: `fromOpenApi(openapi, { operation: '${operation.value}', name: 'user' })`,
      relations: false,
    },
    zod: {
      imports: ["import { z } from 'zod'", "import { fromZod } from 'formo-vue/schema'", "import { UserSchema } from './schemas'"],
      props: [],
      call: "fromZod(UserSchema, { toJSONSchema: z.toJSONSchema, name: 'user' })",
      relations: false,
    },
  }
  const a = adapters[source.value]
  const inertia = source.value === 'laravel' || source.value === 'backend'
  const props = [
    ...a.props,
    ...(update ? ['/** The record being edited */', 'user: Record<string, unknown>'] : []),
    ...(inertia ? ["/** Inertia's errors after a failed post — also with JavaScript off */", 'errors?: Record<string, string>'] : []),
  ]
  const { method, url } = endpoint.value

  const opts: string[] = [`attr: { action: '${url}', method: '${method.toLowerCase()}' }`]
  if (update) opts.push("mode: 'update'")
  if (readOnly.value !== 'auto') opts.push(`readOnly: '${readOnly.value}'`)
  if (validation.value !== 'derived') opts.push(`validation: '${validation.value}'`)
  if (list(only.value).length) opts.push(`only: ${quote(list(only.value))}`)
  if (list(except.value).length) opts.push(`except: ${quote(list(except.value))}`)
  if (a.relations) opts.push('options: { team_id: teams }')
  if (update) opts.push('values: props.user')
  opts.push(`fields: { save: { driver: 'button', label: '${update ? 'Save changes' : 'Create user'}', attr: { type: 'submit' } } }`)

  return [
    '<script setup lang="ts">',
    "import { Formo, FormoForm, useFormo, type FormoOutcome } from 'formo-vue'",
    ...a.imports,
    '',
    ...(props.length ? ['const props = defineProps<{', ...props.map((line) => `  ${line}`), '}>()', ''] : []),
    ...(a.relations ? ['// Options for the team_id relation (from your API, or another prop)', "const teams = [{ value: 1, label: 'Core' }, { value: 2, label: 'Docs' }]", ''] : []),
    '// Inputs are named after the model\'s keys (email, phones[0][number]): with JavaScript off the form',
    '// posts natively to `action`, the server checks the same rules, and its errors come back in `errors`',
    'const form = useFormo(',
    `  Formo.fromModel(${a.call}, {`,
    ...opts.map((o) => `    ${o},`),
    '  }),',
    ...(inertia ? ['  { errors: props.errors },'] : []),
    ')',
    '',
    'function saved(data: unknown) {',
    '  // it went through: what the server saved (a 2xx response)',
    '}',
    '',
    'function refused(outcome: FormoOutcome) {',
    "  // sent, but refused — outcome.reason: 'validation' (422, errors already on the fields),",
    "  // 'session' (419), 'server', 'error'. (@invalid: the browser stopped it; @settled: always)",
    '}',
    '</' + 'script>',
    '',
    '<template>',
    "  <!-- No @submit: it sends itself with request() — CSRF, JSON, 422 errors onto the fields -->",
    '  <FormoForm :form="form" @success="saved" @rejected="refused" />',
    '</template>',
  ].join('\n')
})

const copied = ref(false)
async function copyCode() {
  await navigator.clipboard?.writeText(code.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const tabs = computed(() => [
  { id: 'try' as const, label: 'Try it' },
  { id: 'code' as const, label: 'Code' },
  { id: 'model' as const, label: 'Formo model (IR)' },
  { id: 'definition' as const, label: 'Definition' },
  { id: 'warnings' as const, label: `Warnings (${built.value?.warnings.length ?? 0})` },
])

const button = (active: boolean) =>
  active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'
</script>

<template>
  <div class="grid items-start gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
    <!-- Controls -->
    <div class="space-y-5 text-sm xl:sticky xl:top-6">
      <section>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Source</h3>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in sources"
            :key="s.id"
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
            :class="button(source === s.id)"
            @click="source = s.id"
          >
            {{ s.label }}
          </button>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">{{ sources.find((s) => s.id === source)?.hint }}</p>
      </section>

      <section v-if="source !== 'zod'">
        <div class="mb-1.5 flex items-center justify-between">
          <label class="text-xs font-semibold text-slate-500" for="model-source">Edit it — the form rebuilds as you type</label>
          <button type="button" class="text-xs text-indigo-600 hover:underline" @click="resetSource">Reset</button>
        </div>
        <textarea
          id="model-source"
          v-model="sourceText"
          spellcheck="false"
          class="h-64 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15"
        />
        <p v-if="error" class="mt-1 text-xs font-medium text-rose-600">{{ error }} — showing the last valid version.</p>
      </section>

      <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">formFromModel() options</h3>

        <label v-if="source === 'openapi'" class="block text-xs">
          <span class="mb-1 block font-medium text-slate-600">Operation</span>
          <select v-model="operation" class="w-full rounded-lg border border-slate-300 px-2 py-1.5">
            <option v-for="op in operations" :key="op" :value="op">{{ op }}</option>
          </select>
        </label>

        <div class="text-xs">
          <span class="mb-1 block font-medium text-slate-600">mode</span>
          <div class="flex gap-1.5">
            <button v-for="m in modes" :key="m" type="button" class="rounded-lg px-2.5 py-1" :class="button(mode === m)" @click="mode = m">
              {{ m }}
            </button>
          </div>
          <p class="mt-1 text-slate-500">
            <template v-if="mode === 'update'">Loads a user record (<code>values</code>); passwords become optional — empty means "keep".</template>
            <template v-else>A blank form.</template>
          </p>
        </div>

        <div class="text-xs">
          <span class="mb-1 block font-medium text-slate-600">readOnly</span>
          <div class="flex gap-1.5">
            <button
              v-for="r in readOnlyModes"
              :key="r"
              type="button"
              class="rounded-lg px-2.5 py-1"
              :class="button(readOnly === r)"
              @click="readOnly = r"
            >
              {{ r }}
            </button>
          </div>
          <p class="mt-1 text-slate-500">auto: shown as text in update forms, left out of create forms.</p>
        </div>

        <div class="text-xs">
          <span class="mb-1 block font-medium text-slate-600">validation</span>
          <div class="flex gap-1.5">
            <button
              v-for="v in validations"
              :key="v"
              type="button"
              class="rounded-lg px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              :class="button(validation === v)"
              :disabled="v === 'schema' && !isZod"
              :title="v === 'schema' && !isZod ? 'Needs a schema behind the model: Zod' : undefined"
              @click="validation = v"
            >
              {{ v }}
            </button>
          </div>
          <p class="mt-1 text-slate-500">
            <template v-if="validation === 'derived'">Formo rules from the constraints{{ isZod ? ' + Zod refinements' : '' }}.</template>
            <template v-else-if="validation === 'schema'">Zod validates everything, with its own messages.</template>
            <template v-else>No client-side validation.</template>
          </p>
        </div>

        <label v-if="source === 'laravel'" class="flex items-start gap-2 text-xs text-slate-600">
          <input v-model="clientRules" type="checkbox" class="mt-0.5" />
          <span><code>clientRules: ['username_available']</code> — the playground registers it (try "admin")</span>
        </label>

        <label class="block text-xs">
          <span class="mb-1 block font-medium text-slate-600">only</span>
          <input v-model="only" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono" placeholder="name, email, phones.number" />
        </label>
        <label class="block text-xs">
          <span class="mb-1 block font-medium text-slate-600">except</span>
          <input v-model="except" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono" placeholder="bio, phones" />
          <span class="mt-1 block text-slate-500">Dotted paths. <code>id</code>, <code>created_at</code>… come in only when listed in <code>only</code>.</span>
        </label>
      </section>

      <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-xs">
        <h3 class="font-semibold uppercase tracking-wide text-slate-500">Mock Laravel backend</h3>
        <p class="text-slate-500">
          Submit sends <code class="font-semibold text-slate-700">{{ endpoint.method }} {{ endpoint.url }}</code> with
          <code>form.request()</code> — to a fake backend running in your browser.
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="b in behaviours" :key="b.id" type="button" class="rounded-lg px-2.5 py-1" :class="button(behaviour === b.id)" @click="behaviour = b.id">
            {{ b.label }}
          </button>
        </div>
        <p class="text-slate-500">{{ behaviours.find((b) => b.id === behaviour)?.hint }}</p>
      </section>

      <section v-if="zodChecks" class="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs">
        <h3 class="mb-2 font-semibold uppercase tracking-wide text-violet-700">Runs through Zod</h3>
        <ul class="space-y-1 text-violet-900">
          <li v-for="path in zodChecks.fields" :key="path">
            <code>{{ path }}</code> — its <code>.refine()</code>, live, after Formo's rules
          </li>
          <li v-if="zodChecks.objectLevel">Object-level <code>.refine()</code> — on submit, shown on the field its <code>path</code> names</li>
          <li v-if="validation === 'schema'">Everything else too (schema mode)</li>
        </ul>
      </section>
    </div>

    <!-- Output -->
    <div class="min-w-0">
      <div class="mb-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium"
          :class="[button(tab === t.id), t.id === 'warnings' && built?.warnings.length && tab !== t.id ? 'text-amber-700 ring-amber-300' : '']"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <template v-if="built">
        <!-- v-show: the form keeps its state while you look at the other tabs -->
        <div v-show="tab === 'try'">
          <ModelFormPreview
            :key="formKey"
            :definition="built.definition"
            :model="built.model"
            :endpoint="endpoint"
            :behaviour="behaviour"
            :current="mode === 'update' ? user : undefined"
            :refinements="refinements"
            :schema-validated="isZod && validation === 'schema'"
          />
        </div>

        <div v-if="tab === 'code'" class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-slate-500">This form in your app — the choices on the left, as code.</p>
            <button type="button" class="rounded-lg px-2.5 py-1 text-xs font-medium" :class="button(false)" @click="copyCode">
              {{ copied ? 'Copied ✓' : 'Copy' }}
            </button>
          </div>
          <pre class="overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[12px] leading-relaxed text-slate-200">{{ code }}</pre>
        </div>

        <div v-if="tab === 'model'" class="space-y-2">
          <p class="text-xs text-slate-500">
            What the adapter read — the public contract (<code>formo-model.v1.schema.json</code>). A backend can send this directly.
          </p>
          <div class="overflow-auto rounded-xl bg-slate-900 p-4"><JsonView :value="built.model" /></div>
        </div>

        <div v-if="tab === 'definition'" class="space-y-2">
          <p class="text-xs text-slate-500">
            What <code>formFromModel(model, options)</code> returned — a plain definition (<code>ƒ refine()</code>: a Zod refinement run as a rule).
          </p>
          <div class="grid gap-4 2xl:grid-cols-[16rem_minmax(0,1fr)]">
            <div class="overflow-auto rounded-xl bg-slate-900 p-4"><JsonView :value="printable(options)" /></div>
            <div class="overflow-auto rounded-xl bg-slate-900 p-4"><JsonView :value="printable(built.definition)" /></div>
          </div>
        </div>

        <div v-if="tab === 'warnings'">
          <p v-if="!built.warnings.length" class="text-sm text-slate-500">No warnings — everything in the source was understood.</p>
          <ul v-else class="space-y-2">
            <li v-for="(w, i) in built.warnings" :key="i" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <div class="flex items-center gap-2">
                <code class="font-semibold text-amber-900">{{ w.path || '(model)' }}</code>
                <span class="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{{ w.code }}</span>
              </div>
              <p class="mt-0.5 text-amber-900">{{ w.message }}</p>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>
