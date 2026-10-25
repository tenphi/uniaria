---
'@uniaria/testing': patch
---

The mount contract's `call()` takes the action's arguments and resolves with what the action returned, awaited, so scenarios can drive actions such as Form's `setValue(name, value)` and read `submit()`'s result.
