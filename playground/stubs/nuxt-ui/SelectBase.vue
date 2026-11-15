<script setup lang="ts">
/**
 * The body of the USelect / USelectMenu stubs: a Reka UI style listbox, like
 * Nuxt UI's — a trigger button (role="combobox") showing the value or the
 * placeholder, a popover with groups, labels and items (✓ on the selected ones),
 * keyboard navigation, and a hidden native <select> for form posts (Reka UI's
 * BubbleSelect). USelectMenu adds a search input.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toGroups } from './items'
import { useFormField, useStubId } from './useFormField'

const props = withDefaults(
  defineProps<{
    id?: string
    name?: string
    items?: unknown[]
    modelValue?: unknown
    placeholder?: string
    multiple?: boolean
    color?: string
    variant?: string
    size?: string
    highlight?: boolean
    disabled?: boolean
    required?: boolean
    valueKey?: string
    labelKey?: string
    /** USelectMenu */
    searchable?: boolean
    searchPlaceholder?: string
    rootClass?: any
    attrs?: Record<string, unknown>
  }>(),
  { valueKey: 'value', labelKey: 'label' },
)
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; blur: [event: FocusEvent]; focus: [event: FocusEvent] }>()
const { id, color, highlight, ariaAttrs } = useFormField(props)

const listId = useStubId()
const open = ref(false)
const query = ref('')
const active = ref(-1)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const list = ref<HTMLElement>()
const search = ref<HTMLInputElement>()

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  return toGroups(props.items, props.valueKey, props.labelKey)
    .map((group) => ({ ...group, options: group.options.filter((o) => !q || o.label.toLowerCase().includes(q)) }))
    .filter((group) => group.options.length)
})
/** Items in display order (keyboard navigation) */
const flat = computed(() => groups.value.flatMap((g) => g.options))
const all = computed(() => toGroups(props.items, props.valueKey, props.labelKey).flatMap((g) => g.options))

const selectedValues = computed<unknown[]>(() =>
  props.multiple ? (Array.isArray(props.modelValue) ? props.modelValue : []) : props.modelValue === null || props.modelValue === undefined ? [] : [props.modelValue],
)
const isSelected = (value: unknown) => selectedValues.value.includes(value)
const display = computed(() => {
  const labels = all.value.filter((o) => isSelected(o.value)).map((o) => o.label)
  return labels.length ? labels.join(', ') : null
})

const sizes: Record<string, { base: string; item: string; label: string }> = {
  xs: { base: 'px-2 py-1 text-xs gap-1', item: 'p-1 text-xs gap-1', label: 'p-1 text-[10px]/3' },
  sm: { base: 'px-2.5 py-1.5 text-xs gap-1.5', item: 'p-1.5 text-xs gap-1.5', label: 'p-1.5 text-[10px]/3' },
  md: { base: 'px-2.5 py-1.5 text-sm gap-1.5', item: 'p-1.5 text-sm gap-1.5', label: 'p-1.5 text-xs' },
  lg: { base: 'px-3 py-2 text-sm gap-2', item: 'p-2 text-sm gap-2', label: 'p-2 text-xs' },
  xl: { base: 'px-3 py-2 text-base gap-2', item: 'p-2 text-base gap-2', label: 'p-2 text-sm' },
}
const size = computed(() => sizes[props.size ?? 'md'] ?? sizes.md)
const base = computed(() => [
  'relative group inline-flex w-full items-center rounded-md pe-9 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-75',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset',
  size.value.base,
  props.variant === 'soft'
    ? 'bg-elevated/50 hover:bg-elevated focus-visible:ring-primary'
    : color.value === 'error' || highlight.value
      ? 'bg-default ring ring-inset ring-error focus-visible:ring-error'
      : 'bg-default ring ring-inset ring-accented hover:bg-elevated focus-visible:ring-primary',
])

async function openList() {
  if (props.disabled || open.value) return
  open.value = true
  const first = flat.value.findIndex((o) => isSelected(o.value))
  active.value = first >= 0 ? first : 0
  await nextTick()
  ;(props.searchable ? search.value : list.value)?.focus()
  scrollActive()
}

function closeList(refocus = true) {
  if (!open.value) return
  open.value = false
  query.value = ''
  if (refocus) trigger.value?.focus()
  // Like Nuxt UI: closing the list is the field's blur (validation timing)
  emit('blur', new FocusEvent('blur'))
}

function pick(index: number) {
  const option = flat.value[index]
  if (!option || option.disabled) return
  if (!props.multiple) {
    emit('update:modelValue', option.value)
    closeList()
    return
  }
  const current = selectedValues.value
  emit('update:modelValue', isSelected(option.value) ? current.filter((v) => v !== option.value) : [...current, option.value])
}

function move(step: number) {
  const count = flat.value.length
  if (!count) return
  let next = active.value
  for (let i = 0; i < count; i++) {
    next = (next + step + count) % count
    if (!flat.value[next].disabled) break
  }
  active.value = next
  scrollActive()
}

function scrollActive() {
  nextTick(() => list.value?.querySelector('[data-highlighted]')?.scrollIntoView?.({ block: 'nearest' }))
}

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined
function onListKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown': event.preventDefault(); return move(1)
    case 'ArrowUp': event.preventDefault(); return move(-1)
    case 'Home': event.preventDefault(); active.value = -1; return move(1)
    case 'End': event.preventDefault(); active.value = 0; return move(-1)
    case 'Enter': event.preventDefault(); return pick(active.value)
    case ' ':
      if (props.searchable) return
      event.preventDefault()
      return pick(active.value)
    case 'Escape': event.preventDefault(); return closeList()
    case 'Tab': return closeList(false)
  }
  // Typeahead (USelect): jump to the first item starting with what's typed
  if (!props.searchable && event.key.length === 1) {
    typed += event.key.toLowerCase()
    clearTimeout(typedTimer)
    typedTimer = setTimeout(() => (typed = ''), 500)
    const index = flat.value.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed))
    if (index >= 0) {
      active.value = index
      scrollActive()
    }
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    openList()
  }
}

const onOutside = (event: PointerEvent) => {
  if (open.value && root.value && !root.value.contains(event.target as Node)) closeList(false)
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
watch(query, () => (active.value = flat.value.length ? 0 : -1))

const optionId = (index: number) => `${listId}-${index}`
const indexOf = (option: unknown) => flat.value.indexOf(option as (typeof flat.value)[number])
</script>

<template>
  <div ref="root" data-slot="root" class="relative w-full" :class="rootClass">
    <button
      :id="id"
      ref="trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :data-state="open ? 'open' : 'closed'"
      :disabled="disabled"
      data-slot="base"
      :class="base"
      v-bind="{ ...attrs, ...ariaAttrs }"
      @click="open ? closeList() : openList()"
      @keydown="onTriggerKeydown"
      @focus="emit('focus', $event)"
    >
      <span v-if="display !== null" data-slot="value" class="pointer-events-none truncate text-highlighted">{{ display }}</span>
      <span v-else data-slot="placeholder" class="truncate text-dimmed">{{ placeholder ?? '\u00a0' }}</span>
      <span data-slot="trailing" class="absolute inset-y-0 end-0 flex items-center pe-2.5">
        <svg data-slot="trailingIcon" class="size-5 shrink-0 text-dimmed transition-transform" :class="open && 'rotate-180'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>

    <!-- Reka UI's BubbleSelect: a hidden native select carries the value in form posts -->
    <select v-if="name" :name="name" :multiple="multiple" :required="required" hidden aria-hidden="true" tabindex="-1">
      <option v-for="value in selectedValues" :key="String(value)" :value="String(value)" selected />
    </select>

    <div
      v-if="open"
      data-slot="content"
      data-state="open"
      class="absolute inset-x-0 top-full z-50 mt-1 flex max-h-60 flex-col overflow-hidden rounded-md bg-default shadow-lg ring ring-default"
    >
      <div v-if="searchable" class="border-b border-slate-200 p-1">
        <input
          ref="search"
          v-model="query"
          type="text"
          role="searchbox"
          :aria-controls="listId"
          :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
          :placeholder="searchPlaceholder ?? 'Search…'"
          autocomplete="off"
          data-slot="input"
          class="w-full border-0 bg-transparent px-2 py-1.5 text-sm text-highlighted placeholder:text-dimmed focus:outline-none"
          @keydown="onListKeydown"
        />
      </div>
      <div
        :id="listId"
        ref="list"
        role="listbox"
        :tabindex="searchable ? undefined : -1"
        :aria-multiselectable="multiple || undefined"
        :aria-activedescendant="!searchable && active >= 0 ? optionId(active) : undefined"
        data-slot="viewport"
        class="relative flex-1 scroll-py-1 divide-y divide-slate-200 overflow-y-auto focus:outline-none"
        @keydown="onListKeydown"
      >
        <div v-for="(group, g) in groups" :key="g" role="group" data-slot="group" class="isolate p-1">
          <div v-if="group.label" data-slot="label" class="font-semibold text-highlighted" :class="size.label">{{ group.label }}</div>
          <div
            v-for="option in group.options"
            :id="optionId(indexOf(option))"
            :key="String(option.value)"
            role="option"
            data-slot="item"
            :aria-selected="isSelected(option.value)"
            :aria-disabled="option.disabled || undefined"
            :data-disabled="option.disabled || undefined"
            :data-highlighted="indexOf(option) === active || undefined"
            :data-state="isSelected(option.value) ? 'checked' : 'unchecked'"
            class="group relative flex w-full cursor-default items-start text-default outline-none select-none before:absolute before:inset-px before:z-[-1] before:rounded-md data-disabled:cursor-not-allowed data-disabled:opacity-75 data-highlighted:not-data-disabled:text-highlighted data-highlighted:not-data-disabled:before:bg-elevated/50"
            :class="size.item"
            @pointermove="active = indexOf(option)"
            @mousedown.prevent
            @click="pick(indexOf(option))"
          >
            <span data-slot="itemLabel" class="flex-1 truncate">{{ option.label }}</span>
            <svg v-if="isSelected(option.value)" data-slot="itemTrailingIcon" class="ms-auto size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        </div>
        <div v-if="!groups.length" data-slot="empty" class="p-2.5 text-center text-sm text-muted">No data</div>
      </div>
    </div>
  </div>
</template>
