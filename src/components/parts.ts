import { defineComponent, h, inject, type PropType, type VNode } from 'vue'
import type { FormoHandle } from '../types'
import { FormoPartOwnerKey, type FormoFieldState, type FormoGroupState } from '../composables/context'
import { cx } from '../core/theme'
import FormoRender from './FormoRender'

type Region = 'label' | 'input' | 'help' | 'errors' | 'checklist'

/** What a part can be given: a field's / subform's state (slot props), or a handle (`form.fields.email`) */
export type FormoPartTarget = FormoFieldState | FormoGroupState | FormoHandle

const isHandle = (value: FormoPartTarget): value is FormoHandle => 'kind' in value
const isFieldState = (value: FormoPartTarget): value is FormoFieldState => '_parts' in value

/** A subform's pieces: its label, help text and own error, with the theme's group classes */
function renderGroupPart(region: Region, group: FormoGroupState, attrs: Record<string, unknown>): VNode | null {
  const { class: extra, as, ...rest } = attrs
  const c = group.classes
  switch (region) {
    case 'label': {
      if (!group.label) return null
      const tag = (as as string | undefined) ?? 'span'
      return h(tag, { ...rest, class: cx(tag === 'legend' ? c.groupLegend : c.title, extra) }, group.label)
    }
    case 'help':
      return group.message ? h('p', { ...rest, class: cx(c.help, extra) }, group.message) : null
    case 'errors':
      return group.error ? h('p', { ...rest, class: cx(c.groupError, extra), role: 'alert' }, group.error) : null
    default:
      return null
  }
}

function definePart(region: Region, name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      /**
       * The field or subform: the `field` / `group` of a <FormoField> slot (optional
       * inside one — it's found on its own), or a handle (`form.fields.email`) to use it anywhere
       */
      field: { type: Object as PropType<FormoPartTarget>, default: undefined },
    },
    setup(props, { attrs }) {
      const owner = inject(FormoPartOwnerKey, null)
      const warned = new Set<string>()
      const warn = (message: string) => {
        if (import.meta.env?.DEV && !warned.has(message)) console.warn(`[formo] <${name}> ${message}`)
        warned.add(message)
      }

      return (): VNode | null => {
        const target: FormoPartTarget | undefined = props.field ?? owner?.state
        if (!target) {
          warn('needs :field (a handle, or the `field` / `group` of a slot) outside a <FormoField> slot')
          return null
        }

        // A field's own part: its theme view (or its control), wired to it
        if (isFieldState(target)) return h(target._parts[region], attrs)

        if (!isHandle(target)) {
          if (region === 'input' || region === 'checklist') warn(`renders a field's ${region}, not a subform's`)
          return renderGroupPart(region, target, attrs)
        }

        // A handle to a field: the control is rendered (and validated) right here…
        if (target.kind === 'field' && region === 'input') {
          return h(FormoRender, { ...attrs, form: target.form, path: target.path, part: 'input', exact: true })
        }
        // …the other pieces read its live state, so render it somewhere too
        const entry = target.form.find(target.path)
        if (entry?.state) return h(entry.state._parts[region], attrs)
        if (target.kind !== 'field') {
          if (region === 'input' || region === 'checklist') warn(`renders a field's ${region}, not a subform's`)
          if (entry?.groupState) return renderGroupPart(region, entry.groupState, attrs)
          // Not rendered anywhere: at least its error
          if (region === 'errors' && target.error) {
            return h('p', { ...attrs, class: cx(target.form.options.classes.groupError, attrs.class), role: 'alert' }, target.error)
          }
        }
        return null
      }
    },
  })
}

/**
 * The label, as the theme renders it (the `label` view) — wired to the control
 * (`for`), with the required marker. `as="legend" | "span"` changes the element.
 * For a subform: its label.
 */
export const FormoLabel = definePart('label', 'FormoLabel')
/**
 * The field's control, as the theme renders it (the driver's / theme's / your
 * component), wired: v-model, id, name, aria-*, validation. Attributes (`class`…) land on it.
 * With a handle, the field is rendered (and validated) right there.
 */
export const FormoInput = definePart('input', 'FormoInput')
/** The help text (the `help` view), linked by `aria-describedby`. For a subform: its help text */
export const FormoHelp = definePart('help', 'FormoHelp')
/** The field's errors (the `errors` view): the first one, or all of them (`errorDisplay: 'all'`). For a subform: its own error */
export const FormoErrors = definePart('errors', 'FormoErrors')
/** The field's requirements checklist (the `checklist` view) — `errorDisplay: 'checklist'` fields */
export const FormoChecklist = definePart('checklist', 'FormoChecklist')


