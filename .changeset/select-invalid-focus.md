---
'@uniaria/core': patch
---

Select: a form's validation no longer moves focus through every invalid select. Focus goes to a select's trigger only when the browser reports it as the form's first invalid control, and shows there, and `form.checkValidity()` moves none.
