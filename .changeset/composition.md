---
'@uniaria/core': minor
'@uniaria/elements': minor
---

Composition. TextInput (`@uniaria/core/text-input`) is a native input or
textarea with TextField's value handling and no labelling, for definitions to
compose; it has no element. Autocomplete (`@uniaria/core/autocomplete`,
`<uni-autocomplete>`) is a text input that filters a list always shown below
it and moves a highlight through it while focus stays in the input, with
`showAll()` to show every option again. TextField and NumberField are now
built on TextInput, and Combobox on Autocomplete and Popover: their APIs
don't change, Combobox's `filter` gets the item as a third argument, and a
press on Combobox's list or scroller outside an option keeps focus in the
input. `ctx.use()` returns the composed definition's `actions` and passes
links on with `links`; a composed part with no part to render on is left
out, with a warning in development, and a composed bindable its composer
controls leaves the form reset to the composer.
