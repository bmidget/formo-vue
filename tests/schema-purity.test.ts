import { describe, expect, it } from 'vitest'
import { checkPure } from '../scripts/pure'

/**
 * formo-vue/schema must stay framework-free (no Vue, no DOM, no Node, no packages,
 * no import.meta) so it can become @formo/core / @formo/schema for React Native.
 * `bun run check:pure` also type-checks it without the DOM library.
 */
describe('formo-vue/schema is framework-free', () => {
  it('reaches no Vue, DOM, Node, package or import.meta', () => {
    const { files, problems } = checkPure()
    expect(problems).toEqual([])
    expect(files).toContain('src/schema/index.ts')
    expect(files.every((f) => f.startsWith('src/schema/') || f === 'src/core/utils.ts')).toBe(true)
  })

  it('the check catches them (Vue-side modules fail it)', () => {
    const { problems } = checkPure(['src/core/normalize.ts'])
    expect(problems.some((p) => p.includes('imports "vue"'))).toBe(true)
    expect(problems.some((p) => p.includes('import.meta'))).toBe(true)
    expect(checkPure(['src/http/csrf.ts']).problems.some((p) => p.includes('"document"'))).toBe(true)
  })
})
