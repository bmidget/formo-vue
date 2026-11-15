---
layout: page
title: Interactive Playground
---

<script setup>
import PlaygroundBrowser from './.vitepress/theme/components/PlaygroundBrowser.vue'
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold tracking-tight">Interactive Playground</h1>
    <p class="mt-1 text-sm opacity-75">
      Every example is a live Vue component. Switch tabs on any demo to inspect its highlighted Vue source, POST body, or rendered HTML markup.
    </p>
  </div>
  <PlaygroundBrowser />
</div>
