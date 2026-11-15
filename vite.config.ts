import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { mockLaravel } from './playground/server/mock-laravel.ts'
import { aliases } from './aliases.config.ts'

/**
 * One config, two jobs:
 *
 *  - `bun run dev` / `vite`            → serves the playground (./playground) with HMR.
 *    The playground imports the library straight from ./src through the
 *    `formo-vue` alias, so editing library code hot-reloads too (aliases.config.ts:
 *    also the Nuxt UI / shadcn-vue stubs).
 *  - `bun run build` (`--mode lib`)    → builds the library in ./src to ./dist.
 */
export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      plugins: [vue()],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        lib: {
          // formo-vue, and the formo-vue/nuxt-ui subpath (which never imports @nuxt/ui: you pass the components)
          entry: {
            'formo-vue': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
            'nuxt-ui': fileURLToPath(new URL('./src/nuxt-ui/index.ts', import.meta.url)),
          },
          formats: ['es'],
          fileName: (_format, name) => `${name}.js`,
        },
        // Vite 8 bundles with Rolldown (declared in devDependencies)
        rolldownOptions: {
          external: ['vue', 'vee-validate', '@vee-validate/rules', 'tailwind-merge'],
        },
      },
    }
  }

  return {
    root: fileURLToPath(new URL('./playground', import.meta.url)),
    // mockLaravel(): a fake Laravel backend for the CSRF example (dev server only)
    plugins: [vue(), tailwindcss(), mockLaravel()],
    resolve: {
      alias: aliases,
    },
    server: {
      port: 5173,
      open: false,
    },
    build: {
      outDir: fileURLToPath(new URL('./dist-playground', import.meta.url)),
      emptyOutDir: true,
    },
  }
})
