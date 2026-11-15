# Defining Forms & Fields

Forms can be defined as a plain nested JavaScript object, with the chainable `Formo` builder, or loaded from JSON exported by Formo PHP (`$form->to_array()`).

## Field Types (Drivers)

Every built-in driver — `input` (plus HTML5 subtypes like `input|email`, `input|number`, `input|date`, `input|range`, `input|color`), `textarea`, `select`, `bool`, `checkboxes`, `radios`, `set`, `datalist`, `file`, `uneditable`, and `button`:

<Demo name="field-types" />

## Subforms & Form Objects

Group fields into namespaced subforms, control ordering, and mutate the form object live after render:

<Demo name="subforms" />

## PHP → Vue API Map

| Formo (PHP) | `formo-vue` |
| :--- | :--- |
| `Formo::form($alias)` | `Formo.form({ alias })` |
| `$form->add($alias, $driver, $val, $params)` | `.add(alias, driver, val, params)` |
| `$form->add_group($alias, ...)` | `.add(Formo.group(alias, params))` |
| `$form->subform()` | `form.subform()` / `group.subform()` |
| `$form->val($alias, $value)` | `form.values[alias]` or `field.value` |
| `$form->error($alias, $msg)` | `form.setErrors({ [alias]: msg })` |
| `$form->validate()` | `form.validate()` |
| `$form->render()` | `<FormoForm :form="form" />` |
