import { fileURLToPath, URL } from 'node:url'

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Import aliases shared by the playground (vite.config.ts) and the tests
 * (vitest.config.ts) — keep tsconfig.json `paths` in sync.
 *
 *  - `formo-vue`, `formo-vue/nuxt-ui`   → the library source (./src)
 *  - `#components`                      → Nuxt UI stubs (what Nuxt's `#components` gives an app)
 *  - `@/components/ui/formo`            → the shadcn-vue registry item's source (./registry/shadcn-vue/formo)
 *  - `@/components/ui/*`                → shadcn-vue stubs (an app's own shadcn-vue components)
 */
export const aliases = [
  { find: /^formo-vue$/, replacement: path('./src/index.ts') },
  { find: /^formo-vue\/nuxt-ui$/, replacement: path('./src/nuxt-ui/index.ts') },
  { find: /^#components$/, replacement: path('./playground/stubs/nuxt-ui/index.ts') },
  { find: /^@\/components\/ui\/formo$/, replacement: path('./registry/shadcn-vue/formo/index.ts') },
  { find: /^@\/components\/ui\/(.+)$/, replacement: `${path('./playground/stubs/shadcn-vue/ui')}/$1` },
]
