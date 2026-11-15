# Validation & Checklists

`formo-vue` validates with VeeValidate under the hood and accepts Kohana rule arrays, VeeValidate rule strings/objects, sync & async functions, Zod schemas, and group-level rules.

## Rules

<Demo name="validation" />

## Multiple Rules per Field

Stack rules in mixed notations on each field and control how failures are presented:

<Demo name="multiple-rules" />

## Error Display & Checklists

Set `errorDisplay: 'first' | 'all' | 'checklist'` per field, per form, or globally — ideal for password requirements that tick off live as the user types:

<Demo name="checklists" />

## Optional Subforms & Conditional Rules

Make an entire subform optional based on another field (e.g., "Ship to my billing address"), or use conditional rules like `required_if`, `required_with`, and `required_without`:

<Demo name="optional-subforms" />

## Callbacks & Server Errors

Attach `pass` / `fail` callbacks, form-level rules, async submit handlers, and map server validation errors back onto fields:

<Demo name="server-errors" />
