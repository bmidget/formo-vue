import { ref, watch } from 'vue'

/**
 * Docs "full width" mode: hides the right-hand "On this page" column and lifts
 * the page's max widths, so demos (the forms-from-models workbench…) get the
 * whole screen. Remembered across pages and visits.
 */
const KEY = 'formo-docs-wide'
export const wide = ref(false)

let started = false
/** Call from a mounted component (browser only) */
export function startWide() {
  if (started) return
  started = true
  wide.value = localStorage.getItem(KEY) === '1'
  const apply = (on: boolean) => document.documentElement.classList.toggle('formo-wide', on)
  apply(wide.value)
  watch(wide, (on) => {
    apply(on)
    localStorage.setItem(KEY, on ? '1' : '0')
  })
}
