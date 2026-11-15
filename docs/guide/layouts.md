# Layouts & Parts

You don't have to let `<FormoForm>` render every field sequentially. Use `form.fields` handles with `<FormoField>` to place any field or subform anywhere in your own grid, card, or even outside the `<form>` element.

## Rendering Parts Anywhere

Use `<FormoField :field="form.fields.email" />` for a full themed field, or pass a scoped slot `<FormoField :field="form.fields.email" v-slot="{ field }">` and compose `FormoLabel`, `FormoInput`, `FormoHelp`, `FormoErrors`, and `FormoChecklist` in your own markup:

<Demo name="layouts" />
