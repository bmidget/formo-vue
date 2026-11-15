<script setup lang="ts">
/**
 * Renders a list of nodes — the fields of a form or a group (internal).
 */
import type { FieldNode } from '../types'
import { joinPath } from '../core/utils'
import FormoNode from './FormoNode'

withDefaults(
  defineProps<{
    fields: FieldNode[]
    /** Value path the children live under ('' = form root) */
    prefix?: string
    parentAlias?: string | number
    /** Registry path of the containing group ('' = the form) — ignore cascades along it */
    groupPath?: string
  }>(),
  { prefix: '', parentAlias: undefined, groupPath: '' },
)
</script>

<template>
  <FormoNode
    v-for="child in fields"
    :key="String(child.alias)"
    :node="child"
    :path="joinPath(prefix, child.alias)"
    :parent-path="prefix"
    :parent-alias="parentAlias"
    :group-path="groupPath"
  />
</template>
