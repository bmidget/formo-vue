import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { createMarkdownRenderer, defineConfig, type Plugin } from 'vitepress'
import { aliases } from '../../aliases.config.ts'

const rootDir = fileURLToPath(new URL('../..', import.meta.url))
const examplesDir = join(rootDir, 'playground/examples')

const VIRTUAL_ID = 'virtual:formo-demos'
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`

function formoDemoHighlighter(): Plugin {
  let mdPromise: ReturnType<typeof createMarkdownRenderer> | null = null
  const getMd = () => (mdPromise ??= createMarkdownRenderer(rootDir))

  return {
    name: 'formo-demo-highlighter',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return
      const md = await getMd()
      const files = readdirSync(examplesDir).filter((f) => f.endsWith('.vue'))
      const entries: Record<string, { file: string; raw: string; html: string }> = {}
      for (const file of files) {
        const raw = readFileSync(join(examplesDir, file), 'utf8')
        const html = md.render(`\`\`\`vue\n${raw.trimEnd()}\n\`\`\``)
        entries[file] = { file, raw, html }
      }
      return `export const demos = ${JSON.stringify(entries)};`
    },
    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(examplesDir) && ctx.file.endsWith('.vue')) {
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod)
          return [mod]
        }
      }
    },
  }
}

export default defineConfig({
  title: 'formo-vue',
  description: 'Forms as objects for Vue 3 — VeeValidate validation, Tailwind styling, Nuxt UI & shadcn-vue.',
  base: process.env.VITEPRESS_BASE ?? '/',
  cleanUrls: true,
  ignoreDeadLinks: [/registry/],

  themeConfig: {
    search: { provider: 'local' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'UI Libraries', link: '/nuxt-ui' },
      { text: 'Playground', link: '/playground' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Defining Forms & Fields', link: '/guide/defining-forms' },
          { text: 'Layouts & Parts', link: '/guide/layouts' },
          { text: 'Validation & Checklists', link: '/guide/validation' },
          { text: 'Theming & Customizing', link: '/guide/customizing' },
          { text: 'Advanced & Migration', link: '/guide/advanced' },
        ],
      },
      {
        text: 'UI Libraries',
        items: [
          { text: 'Nuxt UI', link: '/nuxt-ui' },
          { text: 'shadcn-vue', link: '/shadcn-vue' },
        ],
      },
      {
        text: 'Interactive Playground',
        items: [{ text: 'All 17 Examples', link: '/playground' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/bmidget/formo-vue' }],
  },

  vite: {
    plugins: [tailwindcss() as unknown as Plugin, formoDemoHighlighter()],
    resolve: {
      alias: aliases,
    },
  },
})
