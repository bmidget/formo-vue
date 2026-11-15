/**
 * The framework-free part of the library: `formo-vue/schema` (and whatever it
 * imports) must run anywhere — a browser, a server, a worker, React Native —
 * so it can become `@formo/core` / `@formo/schema` without a rewrite.
 *
 * `checkPure()` walks the import graph from the entry points and reports:
 *  - any package import (Vue, vee-validate, tailwind-merge… — even `import type`)
 *  - `.vue` files, and anything under src/components or src/composables
 *  - `import.meta` (Vite-only; Metro / Hermes don't support it)
 *  - DOM / Node globals (`document`, `window`, `File`, `FormData`, `process`…)
 *
 * Used by scripts/check-pure.ts (with a no-DOM `tsc` run) and tests/schema-purity.test.ts.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The repository root. Never `new URL('..', import.meta.url)`: in vitest's
 * browser-like environments (happy-dom), Vite rewrites that pattern into an
 * http:// asset URL.
 */
function scriptsDir(): string {
  // bun, Node ≥ 20.11 and Vite's module runner provide it
  if (typeof import.meta.dirname === 'string') return import.meta.dirname
  return dirname(fileURLToPath(import.meta.url))
}
export const root = resolve(scriptsDir(), '..')

/** Entry points of the pure layer */
export const pureEntries = ['src/schema/index.ts']

const FORBIDDEN_GLOBALS = [
  'document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'location', 'HTMLElement', 'Element',
  'FileList', 'File', 'Blob', 'FormData', 'XMLHttpRequest', 'requestAnimationFrame', 'getComputedStyle',
  'process', 'Buffer', 'require', '__dirname', 'global',
]

const importPatterns = [
  /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

/** Code without comments and string contents (for global / import.meta scans) */
function codeOnly(source: string): string {
  return stripComments(source)
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

function resolveImport(from: string, specifier: string): string | undefined {
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        readFileSync(candidate)
        return candidate
      } catch {
        // a directory
      }
    }
  }
  return undefined
}

export interface PureReport {
  files: string[]
  problems: string[]
}

export function checkPure(entries: string[] = pureEntries): PureReport {
  const problems: string[] = []
  const seen = new Set<string>()
  const queue = entries.map((e) => join(root, e))

  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    const rel = relative(root, file)

    if (file.endsWith('.vue')) {
      problems.push(`${rel}: a .vue file is reachable from the pure layer`)
      continue
    }
    if (/^src\/(components|composables)\//.test(rel)) problems.push(`${rel}: Vue runtime code is reachable from the pure layer`)

    const source = readFileSync(file, 'utf8')
    const imports = stripComments(source)
    for (const pattern of importPatterns) {
      for (const match of imports.matchAll(pattern)) {
        const specifier = match[1]
        if (!specifier.startsWith('.')) {
          problems.push(`${rel}: imports "${specifier}" — the pure layer may not depend on any package`)
          continue
        }
        const target = resolveImport(file, specifier)
        if (!target) problems.push(`${rel}: can't resolve "${specifier}"`)
        else queue.push(target)
      }
    }

    const code = codeOnly(source)
    if (/\bimport\.meta\b/.test(code)) problems.push(`${rel}: uses import.meta (Vite-only — not available in Metro / Hermes)`)
    for (const name of FORBIDDEN_GLOBALS) {
      // A global use: not a property access (`x.document`), not a key (`document:`), not a declaration
      const pattern = new RegExp(`(?<![.\\w$])${name}(?![\\w$]|\\??\\s*:(?!:))`)
      if (pattern.test(code)) problems.push(`${rel}: uses the global "${name}" (DOM / Node only)`)
    }
  }

  return { files: [...seen].map((f) => relative(root, f)).sort(), problems }
}
