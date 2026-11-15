import { resolveDynamicComponent, toRaw, type Component } from 'vue'
import type { ControlRef, FieldNode, FormoControl, FormoDriver, FormoResolvedOptions } from '../types'
import { isControl } from '../core/controls'
import { builtinViews } from './views'

/** Resolve a `ComponentRef` (component or registered name) to a component */
export function resolveComponentRef(ref: ControlRef | undefined, options: FormoResolvedOptions): Component | undefined {
  return resolveControlRef(ref, options)?.component
}

/** A control and, when it was given with `defineControl()`, its contract */
export interface ResolvedControl {
  component: Component
  def?: FormoControl
}

/**
 * Resolve a control: a component, a `defineControl()`, or a name registered in
 * `components` (overrides, then the theme's) or globally (`app.component()`).
 * Names can point to other names: `components: { checkbox: 'switch' }`.
 */
export function resolveControlRef(
  ref: ControlRef | undefined,
  options: FormoResolvedOptions,
  seen: Set<string> = new Set(),
): ResolvedControl | undefined {
  if (!ref) return undefined
  if (isControl(ref)) {
    const component = resolveComponentRef(ref.component, options)
    return component ? { component, def: ref } : undefined
  }
  if (typeof ref !== 'string') return { component: ref }
  const registered = options.components[ref] ?? options.theme.components[ref]
  if (registered && registered !== ref && !seen.has(ref)) {
    seen.add(ref)
    return resolveControlRef(registered, options, seen)
  }
  // Fall back to globally registered components (app.component('StarRating', ...))
  const global = resolveDynamicComponent(ref)
  return typeof global === 'string' ? undefined : { component: global as Component }
}

/** A view by name: overrides → the theme's → the built-in one */
export function resolveView(name: string, options: FormoResolvedOptions): Component | undefined {
  const ref = options.views[name] ?? options.theme.views[name] ?? builtinViews[name]
  if (!ref) return undefined
  return typeof ref === 'string' ? resolveComponentRef(ref, options) : ref
}

const warned = new Set<string>()
const warnedMaps = new WeakSet<object>()

/** `view: { errors: MyErrors }` — a map of views where one view is expected */
function isViewMap(value: object): boolean {
  const keys = Object.keys(toRaw(value))
  return keys.length > 0 && keys.every((key) => key in builtinViews)
}

/**
 * The view of a node: its own `view` (a component, a name, or `false`), else
 * the default name (from the driver for fields, `group` / `blueprint` for groups).
 * `false` means no view (the control alone).
 */
export function nodeView(node: FieldNode, fallback: string | false, options: FormoResolvedOptions): Component | false {
  const own = node.view
  if (own === false) return false
  if (own && typeof own !== 'string') {
    if (!isViewMap(own)) return own
    if (import.meta.env?.DEV && !warnedMaps.has(toRaw(own))) {
      warnedMaps.add(toRaw(own))
      console.warn(
        `[formo] "${String(node.alias)}": \`view\` takes one view (a name or a component). To swap several views, ` +
          'use `theme: { views: { … } }` (here and inside), `views` on <FormoForm> / createFormo(), or a defineTheme()',
      )
    }
  }
  if (typeof own === 'string') {
    const view = resolveView(own, options)
    if (view) return view
    if (import.meta.env?.DEV && !warned.has(own)) {
      warned.add(own)
      console.warn(`[formo] No view named "${own}" (field "${String(node.alias)}"): using the default one`)
    }
  }
  if (fallback === false) return false
  return resolveView(fallback, options) ?? false
}

/**
 * The control of a field, first match wins: the field's `component` →
 * `components['driver|type']` → `components[driver]` (overrides, then the theme's)
 * → the driver's component.
 */
export function resolveControl(
  node: FieldNode,
  driver: FormoDriver | undefined,
  options: FormoResolvedOptions,
): ResolvedControl | undefined {
  const keys = node.type ? [`${node.driver}|${node.type}`, node.driver] : [node.driver]
  const fromMaps = (map: Record<string, ControlRef>) => {
    for (const key of keys) if (map[key]) return resolveControlRef(map[key], options)
    return undefined
  }
  return (
    resolveControlRef(node.component, options) ??
    fromMaps(options.components) ??
    fromMaps(options.theme.components) ??
    resolveControlRef(driver?.component, options)
  )
}
