---
'@uniaria/core': minor
'@uniaria/elements': minor
---

Items. Button and ToggleButton take `label` and `description` parts, which
name and describe the button while rendered, and a `frame` around the button
with `extras` beside it: your buttons, badges and counts, with the button's
states, and hover over the frame counted as the button's. Popover's and
Dialog's triggers and Select's take the same parts, and a popup is placed
against its trigger's frame. Listbox, Select and Combobox take an
`optionExtras` item part and an `optionTooltip`: one Tooltip for all their
options, following hover and focus. Tooltip opens only for cut-off text with
`shouldOpenOnlyWhenTruncated`, takes `relation: 'none'`, and writes the text it
shows into a `text` part; Select takes a `tooltip` too. `isTruncated()` in
`@uniaria/core/dom` tells whether an element cuts its text off.
