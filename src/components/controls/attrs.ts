/**
 * Built-in controls take `inheritAttrs: false` and put extra attributes — from
 * `<component :is="Input" class="…" @focus="…" />` — on their element, with
 * `class` merged (tailwind-merge) into the theme's classes.
 */
export function withoutClass(attrs: Record<string, unknown>): Record<string, unknown> {
  const { class: _class, ...rest } = attrs
  return rest
}
