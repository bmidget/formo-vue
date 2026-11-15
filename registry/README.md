# shadcn-vue registry

`formo` — Formo forms rendered with your shadcn-vue components. Install:

```bash
npx shadcn-vue@latest add https://raw.githubusercontent.com/<owner>/formo-vue/main/registry/r/formo.json
```

- `shadcn-vue/formo/` — the source (theme, views, controls). It imports the app's
  components from `@/components/ui/*`; in this repo those resolve to stubs shaped
  like shadcn-vue's (`playground/stubs/shadcn-vue`), so it's typechecked and tested
  (`tests/shadcn-vue.test.ts`) without installing shadcn-vue.
- `r/formo.json` — the item the CLI downloads, built from the source:
  `bun run build:registry` (`bun run check` fails when it's stale). Committed, so
  GitHub serves it as-is.

Guide: [docs/shadcn-vue.md](../docs/shadcn-vue.md).
