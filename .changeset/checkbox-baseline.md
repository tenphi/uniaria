---
'@uniaria/styles': patch
---

A checkbox no longer moves down a pixel or two as it is checked or
mixed: its check and dash are out of the flow, so they don't set the
row's baseline.
