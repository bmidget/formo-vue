/** Nuxt UI `items`: values / objects, or arrays of them (groups); `{ type: 'label' }` items are group titles */
export type Item = string | number | { label?: string; value?: unknown; disabled?: boolean; type?: string; [key: string]: unknown }

export interface Option {
  label: string
  value: unknown
  disabled?: boolean
}
export interface Group {
  label?: string
  options: Option[]
}

/** Groups of options, like the real components read `items` (valueKey / labelKey) */
export function toGroups(items: unknown[] | undefined, valueKey = 'value', labelKey = 'label'): Group[] {
  const list = items ?? []
  const groups = (Array.isArray(list[0]) ? list : [list]) as Item[][]
  return groups.map((group) => {
    const title = group.find((i) => typeof i === 'object' && i.type === 'label') as { label?: string } | undefined
    return {
      label: title?.label,
      options: group
        .filter((i) => !(typeof i === 'object' && (i.type === 'label' || i.type === 'separator')))
        .map((i) =>
          typeof i === 'object'
            ? { label: String(i[labelKey] ?? i[valueKey]), value: i[valueKey], disabled: i.disabled }
            : { label: String(i), value: i },
        ),
    }
  })
}
