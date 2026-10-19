---
title: Composition
description: How radios find their group, checkboxes their group, and components their tooltip.
---

Some components work together as separate instances: a radio and its radio
group, a checkbox and its checkbox group, a button and its tooltip. The child
needs its owner's state (which value is selected, whether the group is
disabled) from its first render, wherever it sits in your tree. UniAria links
them for you, in both adapters.

| Child                                                                                  | Owner or link | How the element names it                             |
| -------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------- |
| Radio                                                                                  | RadioGroup    | Inside `<uni-radio-group>`, or `group="<id>"`        |
| Checkbox                                                                               | CheckboxGroup | Inside `<uni-checkbox-group>`, or `group="<id>"`     |
| Button, ToggleButton, Checkbox, Switch, Radio, TextField, NumberField, Dialog, Popover | Tooltip       | Inside `<uni-tooltip>` directly, or `tooltip="<id>"` |

Composite components, such as Select (a listbox, a popover and a trigger) or
TextField (a field and an input), are one component with more parts. They
need none of this. When one element is a part of two components at once, as
a component's root can be a part of the one around it in React, both use the
id the element carries.

## Finding the owner

A child looks for its owner in this order:

1. **An explicit link.** In React, the owner's instance in the child's `owner`
   prop (`tooltip` for a tooltip). On elements, an attribute naming the
   owner's `id`, like HTML's `for`: `<uni-radio group="plan">`. Use it when
   the two sit in different branches of the page.
2. **React context.** Inside an `OwnerProvider`, a React child finds its owner
   during its first render, so server-rendered HTML already shows the right
   state, such as the selected radio's `checked`.
3. **The nearest owner around it in the DOM.** A child asks with a bubbling
   event when it connects, and the nearest owner answers. An owner that
   connects later announces itself, so upgrade order doesn't matter. This also
   links a React child rendered inside a custom-element owner.

## In React

`useComponent` is a hook, and a hook can't provide context. Render an
`OwnerProvider` around the children:

```tsx
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { OwnerProvider, useComponent } from '@uniaria/react';

function PlanPicker() {
  const plan = useComponent(radioGroup, { defaultValue: 'pro' });
  return (
    <div {...plan.parts.root}>
      <span {...plan.parts.label}>Plan</span>
      <OwnerProvider owner={plan}>
        <Option value="free">Free</Option>
        <Option value="pro">Pro</Option>
      </OwnerProvider>
    </div>
  );
}

function Option({ value, children }: { value: string; children: string }) {
  const option = useComponent(radio, { value, labelElementType: 'span' });
  return (
    <label {...option.parts.root}>
      <input {...option.parts.input} />
      <span {...option.parts.label}>{children}</span>
    </label>
  );
}
```

The context holds only the owner's instance, which never changes, so the
provider renders nothing again when the group's value changes. Each radio
reads the group's state directly and UniAria updates its attributes.

For a child rendered somewhere else, pass the owner instance instead:
`useComponent(radio, { value: 'pro', owner: plan.instance })`.

A tooltip is a link rather than an owner, and is passed by its own prop:

```tsx
const hint = useComponent(tooltip, { positionArea: 'top' });
const save = useComponent(button, {
  onPress: saveFile,
  tooltip: hint.instance,
});
```

## On custom elements

Nest the child inside its owner, or link it by id:

```html
<uni-radio-group id="plan" default-value="pro">…</uni-radio-group>

<!-- elsewhere on the page -->
<uni-radio group="plan" value="enterprise">…</uni-radio>
```

The id is looked up in the child's own document or shadow root. Without one,
the request a child sends crosses shadow roots, so a radio inside your own
wrapper element's shadow root finds the group the wrapper sits in. For a
child that isn't inside its owner at all, and isn't in the same root, set its
`owner` property to the owner's instance:
`radioElement.owner = groupElement.instance`.

A tooltip links to the UniAria element it directly wraps, or to the one whose
`tooltip` attribute names it. The trigger's `aria-describedby` names the
tooltip's root by its id, yours if you give it one:

```html
<uni-tooltip id="save-hint">
  <div class="uni-tooltip">Saves the file</div>
</uni-tooltip>

<uni-button tooltip="save-hint">
  <button class="uni-button">Save</button>
</uni-button>
```
