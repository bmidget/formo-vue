/**
 * Fails if any package referenced by the project isn't declared in package.json.
 *
 *  - every import in src/, playground/, tests/, registry/ and the root config files
 *    (static, dynamic, `import type`, re-exports)
 *  - CSS `@import` / `@plugin` / `@reference` of packages
 *  - tsconfig `compilerOptions.types`
 *  - required peer dependencies of every declared package
 *
 * Library code (src/) may only use `dependencies` / `peerDependencies`, since
 * apps installing formo-vue won't get our devDependencies.
 *
 * Run: bun run check:deps
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const runtime = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})])
const optionalDeps = new Set(Object.keys(pkg.optionalDependencies ?? {}))
const declared = new Set([...runtime, ...Object.keys(pkg.devDependencies ?? {}), ...optionalDeps])
/**
 * Path aliases resolved by our own config (aliases.config.ts / tsconfig paths):
 * the library, and the Nuxt UI (`#components`) / shadcn-vue (`@/components/ui/*`) stubs
 */
const aliases = new Set(['formo-vue', '#components', '@/components'])
const builtins = new Set(builtinModules)

const problems: string[] = []

function packageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) return null
  if (/^(https?|data|virtual):/.test(specifier)) return null
  const parts = specifier.split('/')
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  if (builtins.has(name) || aliases.has(name)) return null
  return name
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('dist')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|vue|css|js|mjs)$/.test(entry)) out.push(path)
  }
  return out
}

const importPatterns = [
  /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g, // import x from 'y' / import 'y'
  /\bexport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)['"]([^'"]+)['"]/g, // export { x } from 'y'
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, // import('y')
  /@(?:import|plugin|reference)\s+['"]([^'"]+)['"]/g, // CSS
]

function check(file: string, specifier: string) {
  const name = packageName(specifier)
  if (!name) return
  const rel = relative(root, file)
  if (!declared.has(name)) problems.push(`${rel}: "${specifier}" → "${name}" is not in package.json`)
  else if (rel.startsWith('src/') && !runtime.has(name)) {
    problems.push(`${rel}: "${name}" is used by the library but only in devDependencies (move it to dependencies/peerDependencies)`)
  }
}

const files = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'playground')),
  ...walk(join(root, 'tests')),
  ...walk(join(root, 'scripts')),
  ...walk(join(root, 'registry')),
  ...readdirSync(root).filter((f) => /\.config\.(ts|js|mjs)$/.test(f)).map((f) => join(root, f)),
]

/** Only real code counts: drop block comments, line comments and HTML comments */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'))
  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) check(file, match[1])
  }
}

for (const tsconfig of readdirSync(root).filter((f) => /^tsconfig.*\.json$/.test(f))) {
  const types: string[] = JSON.parse(readFileSync(join(root, tsconfig), 'utf8')).compilerOptions?.types ?? []
  for (const type of types) {
    const name = packageName(type)
    if (name && !declared.has(name) && !declared.has(`@types/${name}`)) {
      problems.push(`${tsconfig}: types "${type}" is not in package.json`)
    }
  }
}

for (const name of declared) {
  let manifest: any
  try {
    manifest = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'))
  } catch {
    // Platform-specific binaries (optionalDependencies) are only installed on their platform
    if (!optionalDeps.has(name)) problems.push(`"${name}" is declared but not installed — run bun install`)
    continue
  }
  const optional = manifest.peerDependenciesMeta ?? {}
  for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
    if (!optional[peer]?.optional && !declared.has(peer)) {
      problems.push(`"${name}" requires peer "${peer}", which is not in package.json`)
    }
  }
}

if (problems.length) {
  console.error(`✗ Undeclared dependencies:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`✓ All packages referenced by ${files.length} files are declared in package.json`)
