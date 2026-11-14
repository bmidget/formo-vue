import type { App, Plugin } from 'vue'
import type { FormoOptions } from './types'
import { FormoGlobalKey } from './composables/context'
import FormoForm from './components/FormoForm.vue'
import FormoErrors from './components/FormoErrors.vue'
import FormoChildren from './components/FormoChildren.vue'
import FormoField from './components/FormoField'
import FormoGroup from './components/FormoGroup.vue'
import FormoRender from './components/FormoRender'
import FormoRest from './components/FormoRest'

export interface FormoPluginOptions extends FormoOptions {
  /** Register <FormoForm>, <FormoErrors>... globally (default: true) */
  registerComponents?: boolean
}

/**
 * App-wide Formo setup — the equivalent of `config/formo.php`.
 *
 * ```ts
 * app.use(createFormo({
 *   components: { 'input|date': MyDatePicker, rating: StarRating },
 *   drivers: { rating: { component: StarRating, defaultValue: () => 0 } },
 *   rules: { username_available: async (v) => (await api.check(v)) || 'Taken!' },
 *   config: { messages: { required: ':field is required' } },
 *   theme: { control: 'rounded-none' },
 * }))
 * ```
 *
 * Everything is optional; <FormoForm> works without the plugin.
 */
export function createFormo(options: FormoPluginOptions = {}): Plugin {
  return {
    install(app: App) {
      const { registerComponents = true, ...formoOptions } = options
      app.provide(FormoGlobalKey, formoOptions)
      if (registerComponents) {
        app.component('FormoForm', FormoForm)
        app.component('FormoErrors', FormoErrors)
        app.component('FormoChildren', FormoChildren)
        app.component('FormoField', FormoField)
        app.component('FormoGroup', FormoGroup)
        app.component('FormoRender', FormoRender)
        app.component('FormoRest', FormoRest)
      }
    },
  }
}
