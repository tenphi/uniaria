---
'@uniaria/core': minor
---

A press focuses a Checkbox, Switch or Radio in every browser: a pointer
press on the input, or on a `label` that activates it, focuses the input,
where Safari and Firefox on macOS left focus where it was. Focus from a
pointer stays not visible, so rings drawn on `data-focus-visible` don't show.
`createPressFocus` in `@uniaria/core/dom` does the same for a native control
in your own definition.
