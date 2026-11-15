import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { createFormo } from 'formo-vue'
import StarRating from '../../../playground/components/StarRating.vue'
import TagInput from '../../../playground/components/TagInput.vue'
import ColorSwatches from '../../../playground/components/ColorSwatches.vue'
import Demo from './components/Demo.vue'
import WideToggle from './components/WideToggle.vue'
import './style.css'

const takenUsernames = ['admin', 'root', 'ben', 'formo']
async function usernameAvailable(value: string) {
  if (!value) return true
  await new Promise((r) => setTimeout(r, 350))
  return !takenUsernames.includes(String(value).toLowerCase()) || `"${value}" is already taken`
}

export default {
  extends: DefaultTheme,
  // "Full width": hide "On this page" and lift the max widths (see wide.ts)
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'aside-outline-before': () => h(WideToggle, { placement: 'aside' }),
      'layout-bottom': () => h(WideToggle, { placement: 'floating' }),
    }),
  enhanceApp({ app }) {
    app.use(
      createFormo({
        components: {
          'color-swatches': ColorSwatches,
        },
        drivers: {
          rating: { component: StarRating, defaultValue: () => 0, display: (v) => '★'.repeat(Number(v) || 0) },
          tags: { component: TagInput, defaultValue: () => [], display: (v) => (v as string[]).join(', ') },
        },
        rules: {
          username_available: usernameAvailable,
        },
        config: {
          labels: { dob: 'Date of birth' },
        },
      }),
    )
    app.component('Demo', Demo)
  },
} satisfies Theme
