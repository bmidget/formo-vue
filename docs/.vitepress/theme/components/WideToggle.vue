<script setup lang="ts">
/**
 * The "full width" switch: `aside` — at the top of "On this page" (hides it);
 * `floating` — a pill in the corner on every doc page (brings it back / widens pages without it).
 */
import { computed, onMounted } from 'vue'
import { useData } from 'vitepress'
import { startWide, wide } from '../wide'

const props = defineProps<{ placement: 'aside' | 'floating' }>()
const { frontmatter } = useData()

onMounted(startWide)

const isDoc = computed(() => !['home', 'page'].includes(frontmatter.value.layout))
const hasAside = computed(() => frontmatter.value.aside !== false)
const label = computed(() => {
  if (!wide.value) return '⤢ Full width'
  return hasAside.value ? '☰ Show “On this page”' : '⤡ Exit full width'
})
</script>

<template>
  <button
    v-if="placement === 'aside'"
    type="button"
    class="formo-wide-aside"
    title="Hide this column and use the whole screen"
    @click="wide = true"
  >
    Hide ⇥ full width
  </button>
  <button
    v-else-if="isDoc && (wide || !hasAside)"
    type="button"
    class="formo-wide-floating"
    :title="wide ? 'Back to the normal layout' : 'Use the whole screen'"
    @click="wide = !wide"
  >
    {{ label }}
  </button>
</template>
