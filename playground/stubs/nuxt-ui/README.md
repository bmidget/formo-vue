# Nuxt UI stubs

Small components **shaped like Nuxt UI v4's** (same names, props, events and
`UFormField` ↔ input wiring: the input's `id` becomes the field's label `for`,
the field's `error` turns inputs red and sets their `aria-invalid` /
`aria-describedby`). The playground and the tests use them so `@nuxt/ui` never
has to be installed here.

In your app, pass the real components instead:

```ts
import { UFormField, UInput /* … */ } from '#components'          // Nuxt
import UInput from '@nuxt/ui/components/Input.vue'                 // Vue + Vite
```
