/**
 * Proves the project installs on every supported platform.
 *
 * For each target it copies package.json + bun.lock into a temp dir and runs
 * `bun install --frozen-lockfile --os <os> --cpu <cpu>` — exactly what a
 * teammate on that machine would get — then checks that the native binaries
 * the toolchain needs (Rolldown for Vite, Oxide for Tailwind, Lightning CSS)
 * were installed in the versions their parent packages require.
 *
 * Run after changing dependencies: bun run check:platforms
 */
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')

/** Platforms we support — add win32-x64-msvc etc. here (and to optionalDependencies) if needed */
const targets = [
  { os: 'darwin', cpu: 'arm64', suffix: 'darwin-arm64', label: 'macOS Apple Silicon' },
  { os: 'darwin', cpu: 'x64', suffix: 'darwin-x64', label: 'macOS Intel' },
  { os: 'linux', cpu: 'x64', suffix: 'linux-x64-gnu', label: 'Linux x64 (glibc)' },
  { os: 'linux', cpu: 'arm64', suffix: 'linux-arm64-gnu', label: 'Linux arm64 (glibc)' },
]

/** parent package → binding package prefix */
const natives = [
  { parent: 'rolldown', binding: '@rolldown/binding' },
  { parent: '@tailwindcss/oxide', binding: '@tailwindcss/oxide' },
  { parent: 'lightningcss', binding: 'lightningcss' },
]

function installedVersions(nodeModules: string, name: string): string[] {
  // Isolated layout: node_modules/.bun/<name with / as +>@<version>/node_modules/<name>
  const store = join(nodeModules, '.bun')
  const prefix = `${name.replace('/', '+')}@`
  if (existsSync(store)) {
    return readdirSync(store)
      .filter((d) => d.startsWith(prefix))
      .map((d) => d.slice(prefix.length).split('+')[0])
  }
  const manifest = join(nodeModules, name, 'package.json')
  return existsSync(manifest) ? [JSON.parse(readFileSync(manifest, 'utf8')).version] : []
}

let failed = false
for (const target of targets) {
  const dir = mkdtempSync(join(tmpdir(), `formo-${target.suffix}-`))
  for (const f of ['package.json', 'bun.lock', 'bunfig.toml']) cpSync(join(root, f), join(dir, f))

  const result = spawnSync(
    'bun',
    ['install', '--frozen-lockfile', '--ignore-scripts', `--os=${target.os}`, `--cpu=${target.cpu}`],
    { cwd: dir, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    console.error(`✗ ${target.label}: bun install failed\n${result.stderr || result.stdout}`)
    failed = true
    rmSync(dir, { recursive: true, force: true })
    continue
  }

  const problems: string[] = []
  for (const { parent, binding } of natives) {
    const parentVersions = installedVersions(join(dir, 'node_modules'), parent)
    const bindingName = `${binding}-${target.suffix}`
    const bindingVersions = installedVersions(join(dir, 'node_modules'), bindingName)
    for (const version of parentVersions) {
      if (!bindingVersions.includes(version)) {
        problems.push(`${parent}@${version} needs ${bindingName}@${version}, got ${bindingVersions.join(', ') || 'nothing'}`)
      }
    }
    if (!parentVersions.length) problems.push(`${parent} is not installed`)
  }

  if (problems.length) {
    failed = true
    console.error(`✗ ${target.label}\n  ${problems.join('\n  ')}`)
  } else {
    console.log(`✓ ${target.label}: rolldown, tailwind oxide and lightningcss binaries installed`)
  }
  rmSync(dir, { recursive: true, force: true })
}

if (failed) {
  console.error(
    '\nA native binary is missing for a platform. Usually the lockfile lacks it — regenerate it for every platform:\n' +
      "  rm -rf node_modules bun.lock && bun install --os '*' --cpu '*' && rm -rf node_modules && bun install\n" +
      'If the binary does not exist for that version on the registry at all, pin an older version (see README → Supported platforms).',
  )
  process.exit(1)
}
