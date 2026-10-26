---
'@uniaria/core': patch
---

Field around a `<select multiple>` now shows the value a form or a
controlled `value` gives it: a reset, the form's `setValue()` or a new
`value` selects the matching options. Before, only the user's own
selection reached the form.
