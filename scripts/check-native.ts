/**
 * Runs before `dev`, `build`, `build:playground` and `test`: checks that this
 * machine has the native binaries the toolchain needs (Rolldown for Vite,
 * Oxide for Tailwind, Lightning CSS), in the right versions, and that they load.
 * Fails fast with a fix instead of a cryptic "Cannot find module" from Vite.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const require = createRequire(join(root, 'package.json'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

function libc(): 'gnu' | 'musl' {
  if (existsSync('/etc/alpine-release')) return 'musl'
  try {
    if (readdirSync('/lib').some((f) => f.startsWith('ld-musl-'))) return 'musl'
  } catch {}
  return 'gnu'
}

const suffix =
  process.platform === 'linux' ? `linux-${process.arch}-${libc()}` : `${process.platform}-${process.arch}`

const natives = [
  { parent: 'rolldown', binding: `@rolldown/binding-${suffix}`, usedBy: 'Vite' },
  { parent: '@tailwindcss/oxide', binding: `@tailwindcss/oxide-${suffix}`, usedBy: 'Tailwind' },
  { parent: 'lightningcss', binding: `lightningcss-${suffix}`, usedBy: 'Vite / Tailwind CSS' },
]

const declared = new Set(Object.keys(pkg.optionalDependencies ?? {}))
const problems: string[] = []

for (const { parent, binding, usedBy } of natives) {
  if (!declared.has(binding)) {
    problems.push(
      `${binding} (${usedBy}) isn't in optionalDependencies — this platform (${suffix}) isn't set up yet. ` +
        'Add it next to the other bindings, then run `bun run check:platforms`.',
    )
    continue
  }
  const manifest = join(root, 'node_modules', binding, 'package.json')
  if (!existsSync(manifest)) {
    problems.push(`${binding} (${usedBy}) is not installed.`)
    continue
  }
  const version = JSON.parse(readFileSync(manifest, 'utf8')).version
  const expected = pkg.overrides?.[parent]
  if (expected && version !== expected) {
    problems.push(`${binding}@${version} is installed but ${parent} needs ${expected}.`)
    continue
  }
  try {
    require(binding)
  } catch (e) {
    problems.push(`${binding} is installed but fails to load: ${(e as Error).message}`)
  }
}

if (problems.length) {
  console.error(`✗ Native toolchain binaries for ${suffix}:\n  - ${problems.join('\n  - ')}\n`)
  console.error('Fix: rm -rf node_modules && bun install   (see README → Supported platforms)')
  process.exit(1)
}
console.log(`✓ Native binaries OK for ${suffix} (rolldown, tailwind oxide, lightningcss)`)
