import { inject } from 'vue'
import { FormoFieldKey, type FormoFieldState } from './context'

/**
 * For custom field components: get the field's state (value, error, label,
 * options, classes, attrs...) without declaring any prop.
 *
 * ```vue
 * <script setup>
 * const field = useFormoField()
 * </script>
 * <template>
 *   <button v-for="n in 5" @click="field.setValue(n)" :class="n <= field.value ? 'text-amber-400' : ''">★</button>
 *   <p v-if="field.error">{{ field.error }}</p>
 * </template>
 * ```
 *
 * The state object uses getters, so read properties where you need them
 * (`field.value`), don't destructure them once in setup.
 */
export function useFormoField(): FormoFieldState {
  const state = inject(FormoFieldKey, null)
  if (!state) throw new Error('[formo] useFormoField() must be used in a component rendered by a Formo field')
  return state
}
