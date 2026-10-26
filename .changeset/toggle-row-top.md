---
'@uniaria/styles': patch
---

Checkbox, Switch and Radio hang from the top of their line instead of sitting on the font's baseline, so a group's items are 8 pixels apart in custom elements too, whatever the page's font. The line under a custom element's host used to make each row taller than its 24 pixels.
