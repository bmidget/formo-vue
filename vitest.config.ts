import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { aliases } from './aliases.config.ts'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: aliases,
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
