import { createApp } from 'vue'
import { createFormo } from 'formo-vue'
import App from './App.vue'
import StarRating from './components/StarRating.vue'
import TagInput from './components/TagInput.vue'
import ColorSwatches from './components/ColorSwatches.vue'
import './style.css'

/** A fake API call for the async validation demo */
const takenUsernames = ['admin', 'root', 'ben', 'formo']
async function usernameAvailable(value: string) {
  if (!value) return true
  await new Promise((r) => setTimeout(r, 350))
  return !takenUsernames.includes(String(value).toLowerCase()) || `"${value}" is already taken`
}

const app = createApp(App)

/**
 * App-wide Formo setup — the equivalent of Kohana's config/formo.php.
 * Every option can also be set per form (<FormoForm :components ...>) or per group.
 */
app.use(
  createFormo({
    // Components referenced by name from schemas: { component: 'color-swatches' }
    components: {
      'color-swatches': ColorSwatches,
    },
    // New field types, usable as `driver: 'rating'` / `driver: 'tags'`
    drivers: {
      rating: { component: StarRating, defaultValue: () => 0, display: (v) => '★'.repeat(Number(v) || 0) },
      tags: { component: TagInput, defaultValue: () => [], display: (v) => (v as string[]).join(', ') },
    },
    // Extra rules, usable by name: 'required|username_available'
    rules: {
      username_available: usernameAvailable,
    },
    config: {
      // Like Formo's label message file
      labels: { dob: 'Date of birth' },
    },
  }),
)

app.mount('#app')
