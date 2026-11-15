import type { App, Plugin } from 'vue'
import type { FormoOptions } from './types'
import { FormoGlobalKey } from './composables/context'
import FormoForm from './components/FormoForm.vue'
import FormoErrorSummary from './components/FormoErrorSummary.vue'
import { FormoChecklist, FormoErrors, FormoHelp, FormoInput, FormoLabel } from './components/parts'
import FormoField from './components/FormoField.vue'
import FormoRender from './components/FormoRender'
import FormoRest from './components/FormoRest'

export interface FormoPluginOptions extends FormoOptions {
  /** Register <FormoForm>, <FormoField>, <FormoLabel>, <FormoInput>, <FormoErrors>... globally (default: true) */
  registerComponents?: boolean
}

/**
 * App-wide Formo setup — the equivalent of `config/formo.php`.
 *
 * ```ts
 * app.use(createFormo({
 *   theme: bootstrap,                                   // a defineTheme(): views, controls, classes
 *   views: { floating: FloatingLabelField },            // view overrides / extra named views
 *   components: { 'input|date': MyDatePicker, rating: StarRating },
 *   classes: { control: 'rounded-none' },               // class overrides
 *   drivers: { rating: { component: StarRating, defaultValue: () => 0 } },
 *   rules: { username_available: async (v) => (await api.check(v)) || 'Taken!' },
 *   config: { messages: { required: ':field is required' } },
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
        app.component('FormoErrorSummary', FormoErrorSummary)
        app.component('FormoLabel', FormoLabel)
        app.component('FormoInput', FormoInput)
        app.component('FormoHelp', FormoHelp)
        app.component('FormoErrors', FormoErrors)
        app.component('FormoChecklist', FormoChecklist)
        app.component('FormoField', FormoField)
        app.component('FormoRender', FormoRender)
        app.component('FormoRest', FormoRest)
      }
    },
  }
}
