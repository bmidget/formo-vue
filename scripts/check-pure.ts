/**
 * Fails if formo-vue/schema (the framework-free layer) reaches Vue, the DOM,
 * Node, any package, or `import.meta` — see scripts/pure.ts — then type-checks
 * it with the ES library only (tsconfig.schema.json: no DOM, no Node types).
 *
 * Run: bun run check:pure
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { checkPure, root } from './pure'

const { files, problems } = checkPure()
if (problems.length) {
  console.error(`✗ formo-vue/schema is not framework-free:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

const tsc = createRequire(join(root, 'package.json')).resolve('typescript/bin/tsc')
const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.schema.json'], { cwd: root, encoding: 'utf8' })
if (result.status !== 0) {
  console.error(`✗ formo-vue/schema doesn't type-check without the DOM / Node libraries:\n${result.stdout}${result.stderr}`)
  process.exit(1)
}

console.log(`✓ formo-vue/schema is framework-free: ${files.length} files, no Vue / DOM / Node / packages, type-checks with lib ES2022 only`)
