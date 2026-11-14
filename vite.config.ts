import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { mockLaravel } from './playground/server/mock-laravel.ts'

const src = fileURLToPath(new URL('./src', import.meta.url))

/**
 * One config, two jobs:
 *
 *  - `bun run dev` / `vite`            → serves the playground (./playground) with HMR.
 *    The playground imports the library straight from ./src through the
 *    `formo-vue` alias, so editing library code hot-reloads too.
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
          entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
          formats: ['es'],
          fileName: () => 'formo-vue.js',
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
      alias: {
        'formo-vue': `${src}/index.ts`,
      },
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
