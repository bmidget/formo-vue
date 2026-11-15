/**
 * Builds the shadcn-vue registry item `registry/r/formo.json` from its source in
 * `registry/shadcn-vue/formo/` (files inlined, like shadcn's `build`). The JSON
 * is committed, so it's served straight from GitHub:
 *
 *   npx shadcn-vue@latest add https://raw.githubusercontent.com/<owner>/formo-vue/main/registry/r/formo.json
 *
 * Run: bun run build:registry · Verify it's up to date: bun run check:registry
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const source = join(root, 'registry/shadcn-vue/formo')
const output = join(root, 'registry/r/formo.json')
const check = process.argv.includes('--check')

const files = readdirSync(source)
  .filter((name) => /\.(vue|ts)$/.test(name))
  .sort((a, b) => (a === 'index.ts' ? 1 : b === 'index.ts' ? -1 : a.localeCompare(b)))
  .map((name) => ({
    path: relative(root, join(source, name)),
    type: 'registry:ui',
    target: `components/ui/formo/${name}`,
    content: readFileSync(join(source, name), 'utf8'),
  }))

const item = {
  $schema: 'https://shadcn-vue.com/schema/registry-item.json',
  name: 'formo',
  type: 'registry:block',
  title: 'Formo',
  description:
    'Formo (formo-vue) forms rendered with your shadcn-vue components: a theme with shadcn field views (label, description, message) ' +
    'and controls (Input, Textarea, Select, Checkbox, Switch, RadioGroup). Use it with createFormo({ theme: shadcnTheme }).',
  dependencies: ['formo-vue', 'vee-validate'],
  registryDependencies: ['input', 'textarea', 'label', 'select', 'checkbox', 'switch', 'radio-group'],
  files,
}

const json = `${JSON.stringify(item, null, 2)}\n`

if (check) {
  let current = ''
  try {
    current = readFileSync(output, 'utf8')
  } catch {}
  if (current !== json) {
    console.error('✗ registry/r/formo.json is out of date with registry/shadcn-vue/formo — run: bun run build:registry')
    process.exit(1)
  }
  console.log(`✓ registry/r/formo.json is up to date (${files.length} files)`)
} else {
  writeFileSync(output, json)
  console.log(`✓ Wrote registry/r/formo.json (${files.length} files)`)
}
