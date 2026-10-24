---
'@uniaria/core': minor
'@uniaria/elements': minor
'@uniaria/react': minor
'@uniaria/vue': minor
---

Add Form (`@uniaria/core/form`, `<uni-form>` from `@uniaria/elements/form`):
the behavior of a `<form>`. It holds the values of the fields bound to it by
`name`, checks them (`isRequired`, the native constraints on a field's
input, and a field's `validate`, sync or async) on each field's trigger,
shows each field's first error, focuses the first invalid field after a
failed submit, and submits through `handleSubmit` or, without one, posts
natively once the checks pass. Every field binds to it: TextField,
NumberField, Checkbox, Switch, CheckboxGroup, RadioGroup, Select, Combobox
and Field around a control of your own.

Fields take the form props (`name`, `form`, `validate`, `validationTrigger`,
`validationDelay`, `validationMessages`, `dependsOn`, `isEqual`,
`shouldPreserve`) and an `errorText` part inside their error part, which a
form fills with the first error. `isInvalid` is now unset by default, so a
field in a form shows the form's errors; `true` or `false` still wins. Field
gains a `setValue` action, follows a native control's value, and reports its
binding in its state.

The runtime adds inherited links (`LinkKey.isInherited`), which resolve
from the nearest provider across other UniAria hosts; `ctx.link(key,
select)`, which follows only what `select` picks from the linked instance;
`null` for no link; and `Bindable.bind()` and `getDefault()`. React's
`OwnerProvider` and Vue's provides answer inherited links.
