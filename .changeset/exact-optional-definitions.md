---
'@uniaria/core': patch
---

Definitions type-check in a project that turns on `exactOptionalPropertyTypes`. A definition without an owner or links (Popover, Dialog, Tooltip, Form) can be passed to `defineElement()`, `useBehavior()` and anything else that takes a definition, with no cast. Types only: nothing changes at runtime.
