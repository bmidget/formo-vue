---
aside: false
---

# Defining Forms & Fields

Forms can be defined as a plain nested JavaScript object, with the chainable `Formo` builder, or generated from a model or schema — Laravel rules, JSON Schema, OpenAPI, Zod (see [Forms from Models & Schemas](/schema)).

## Field Types (Drivers)

Every built-in driver — `input` (plus HTML5 subtypes like `input|email`, `input|number`, `input|date`, `input|range`, `input|color`), `textarea`, `select`, `bool`, `checkboxes`, `radios`, `set`, `datalist`, `file`, `uneditable`, and `button`:

<Demo name="field-types" />

## Subforms & Form Objects

Group fields into namespaced subforms, control ordering, and mutate the form object live after render:

<Demo name="subforms" />
