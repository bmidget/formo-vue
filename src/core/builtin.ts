const BUILTIN = new WeakSet<object>()

/**
 * Mark a control as "built-in": it renders `formo.attrs` (id, name, aria-*)
 * itself, so FormoField won't pass them as fallthrough attributes.
 * Custom components are not marked and receive the attributes normally.
 */
export function markBuiltin<T extends object>(component: T): T {
  BUILTIN.add(component)
  return component
}

export function isBuiltin(component: unknown): boolean {
  return !!component && typeof component === 'object' && BUILTIN.has(component as object)
}
