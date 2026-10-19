# Dialog spec

Status: approved by @tenphi on 2026-10-16

## Summary

A modal dialog: a window over the page that takes focus, keeps it, and
leaves the rest of the page inert until it closes. UniAria opens the native
`<dialog>` element with `showModal()` (Resolved questions 1), which puts it in
the top layer, makes everything outside inert in the browser and in the
accessibility tree, and draws its `::backdrop`. UniAria adds what the browser
leaves out or does differently in each engine: the open state, Escape and
backdrop dismissal, Tab wrapping, scroll lock, initial focus, focus restore,
and a closing phase for exit animations.

One definition, `dialog`, holds the trigger, the dialog, its title and
description, and a close button.

- **WAI-ARIA pattern:** [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  and [Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
  (`references/aria-practices/content/patterns/dialog-modal/`,
  `…/alertdialog/`).
- **Builds on:** Button (`ctx.use`, twice: the trigger and the close
  button); `createLayer`, `createFocusScope`, `createScrollLock` and the
  modality tracker from `dom/`. New in `dom/`: a backdrop press check, a
  closing phase that waits for animations (Resolved questions 5), and the live
  announcer's place while a modal is open (Resolved questions 7).
- **Owner:** none.
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec, Resolved
  questions 2): the tooltip instance in React (`tooltip: hint.instance`),
  and on elements the `<uni-tooltip>` it sits in directly or a `tooltip`
  attribute naming one's id. On the trigger, as Popover's.
- **Custom element:** yes, `<uni-dialog>`, wrapping the trigger and the
  `<dialog>`, which hosts consumer markup.

Not part of Dialog:

- **Non-modal dialogs** (`show()`) and dialogs anchored to a trigger: that is
  Popover, next on the roadmap, which reuses this spec's layer, closing
  phase and focus rules. Cube UI Kit's `type="popover"` maps there.
- **Looks and layouts.** UI Kit's `fullscreen`, `fullscreenTakeover`,
  `panel` and `tray` types, `size`, and the header, content and footer slots
  are styles of the same dialog. A design system picks them, as it picks
  `mobileType`.
- **A promise API** like UI Kit's `useAlertDialogAPI().open()`: a design
  system builds it on a controlled Dialog.
- **Form handling** beyond `<form method="dialog">` (Pointer and forms):
  UI Kit's DialogForm stays a design-system component.

## Anatomy

| Part        | Element                | Attributes UniAria owns                                                                                                           | Notes                                                                                                                                                    |
| ----------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| trigger     | `button`               | Button's (`type`, `tabindex`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`); `data-open` | Optional. A press opens the dialog. No `aria-haspopup`, `aria-expanded` or `aria-controls` (Resolved questions 8).                                       |
| root        | `dialog`               | `id`, `role` (only `alertdialog`), `tabindex="-1"`, `aria-labelledby`, `aria-describedby`; state attributes                       | Opened with `showModal()`. UniAria never writes the `open` attribute, which would open it non-modally. Its `::backdrop` is the underlay.                 |
| title       | any; usually a heading | `id`; state attributes                                                                                                            | Names the dialog through `aria-labelledby`.                                                                                                              |
| description | any                    | `id`; state attributes                                                                                                            | Optional; required for an `alertdialog` by the APG. Linked through `aria-describedby` while rendered. Leave it out for long or structured content (APG). |
| close       | `button`               | Button's                                                                                                                          | Optional. A press closes the dialog even when it isn't dismissable: it is an explicit action (as UI Kit's close button).                                 |

`aria-labelledby` and `aria-describedby` reference only rendered parts, as
Field's do, plus `labelledBy` and `describedBy`. Development warns when the
dialog has no name (no title, `labelledBy` or `aria-label`), when an
`alertdialog` has no description, and when the root isn't a `<dialog>`.

State attributes on every part: `data-open` while open, `data-entering` for
the first frame after opening, `data-exiting` while closing (Resolved questions 5).

Render the `<dialog>` always; it is hidden while closed. A design system that
wants to skip rendering heavy content while closed renders the content (not
the dialog) from `isOpen || isExiting`.

## Props

| Prop                      | Type                        | Default    | Bindable | Change event | Notes                                                                                                                                       |
| ------------------------- | --------------------------- | ---------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| isOpen                    | `boolean`                   | `false`    | yes      | `openChange` |                                                                                                                                             |
| isDismissable             | `boolean`                   | `true`     | no       | —            | Escape and a press on the backdrop close it. `false` turns both off; the close part and the consumer still close it (Resolved questions 3). |
| isKeyboardDismissDisabled | `boolean`                   | `false`    | no       | —            | Escape alone doesn't close it.                                                                                                              |
| role                      | `'dialog' \| 'alertdialog'` | `'dialog'` | no       | —            | The element adopts the root's `role` attribute instead of taking one (a `role` on the host would give the host that role).                  |
| isDisabled                | `boolean`                   | `false`    | no       | —            | The trigger can't open it (Button's `isDisabled` on the trigger).                                                                           |
| shouldRestoreFocus        | `boolean`                   | `true`     | no       | —            | Focus goes back on close (Focus).                                                                                                           |
| labelledBy                | `string \| undefined`       | —          | no       | —            | More ids for `aria-labelledby`.                                                                                                             |
| describedBy               | `string \| undefined`       | —          | no       | —            | More ids for `aria-describedby`.                                                                                                            |

## Events

| Event        | Detail                    | When                                                                                                                                                                                                                                                                |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openChange` | `boolean`                 | The trigger, a dismissal, the close part or a dialog form asks to open or close it. Never for a value the consumer sets.                                                                                                                                            |
| `dismiss`    | `{ reason, returnValue }` | Before `openChange(false)`, for each close the user asked for. `reason`: `'escape'`, `'outside'`, `'close'`, `'submit'`, or `'browser'` when the browser closed it itself. `returnValue`: the submitter's `value` for `'submit'`, else `''` (Resolved questions 9). |

## Public state

| Field      | Type      | Meaning                                                |
| ---------- | --------- | ------------------------------------------------------ |
| isOpen     | `boolean` | The current value.                                     |
| isEntering | `boolean` | The first frame after opening, for enter animations.   |
| isExiting  | `boolean` | Closed, but still shown until its exit animations end. |

## Actions

Added on 2026-10-19 (owner): the definition's internal API is not public,
and these are the only members of it consumers may call. They are
`instance.actions`, the React handle's `actions` and methods of the element
(`dialog.open()`). Each runs in a batch.

| Action    | Effect                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open()`  | Asks to open the dialog, as the trigger does. Uncontrolled, it opens and focus moves in (Focus); controlled, only `openChange(true)` is reported. `isDisabled` disables the trigger only, so `open()` still opens. Nothing while open. |
| `close()` | Asks to close it. Uncontrolled, the closing phase runs and focus is restored (Focus); controlled, only `openChange(false)` is reported. No `dismiss` event: no user asked. Nothing while closed.                                       |

## Opening and closing

- **Opening.** When `isOpen` turns true, UniAria calls `showModal()`, locks page
  scroll (neither engine does: probed), joins the global layer stack and
  moves focus (Focus). The trigger reports `openChange(true)`; it never
  closes an open dialog, since the open dialog makes it inert.
- **Closing.** When `isOpen` turns false, the dialog enters its closing
  phase: `data-exiting`, still modal, Escape and backdrop presses ignored.
  When its animations end, UniAria calls `close()`, releases the scroll lock and
  restores focus (Resolved questions 5).
- **Controlled.** A dismissal, the close part or a dialog form only reports
  `dismiss` and `openChange(false)`; the dialog stays open until the
  consumer sets `isOpen` to `false`. When the browser closed it on its own
  (below), UniAria reports `dismiss` with reason `'browser'` and
  `openChange(false)`, and opens it again if the consumer keeps `isOpen`
  true, as a refused Checkbox toggle goes back.
- **What the browser closes on its own.** UniAria prevents every native close
  it can, so each close runs through the state and the closing phase:
  - Escape: the layer prevents the `keydown`, which stops the native close
    request before it starts (probed in Chromium and WebKit). When Escape mustn't close the dialog, UniAria still
    prevents it.
  - A `cancel` event without a keydown (Android's back gesture, a
    `requestClose()`): UniAria prevents it when it can and handles it as
    Escape. Chromium makes it uncancelable when the page has had no user
    activation since the last one (its anti-abuse rule, probed); the dialog
    then closes, with reason `'browser'`.
  - `<form method="dialog">`: see Pointer and forms.
  - Removing an open `<dialog>` from the page: no `close` event fires and the
    page stops being inert (probed). UniAria releases the scroll lock, restores
    focus and reports `dismiss` with reason `'browser'`.
- **Nested dialogs.** A dialog opened from inside another stacks above it in
  the top layer and the layer stack: Escape and the backdrop close only the
  top one, and scroll stays locked until the last one closes.
- **Server rendering.** The server HTML has a closed `<dialog>`; a
  `defaultOpen` dialog opens after hydration, since `showModal()` needs a
  browser and an `open` attribute would make it non-modal.

## Keyboard

| Key            | Where                               | Behavior                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space   | trigger                             | Opens the dialog (Button's press).                                                                                                                                                                                                                    |
| Escape         | anywhere in the open dialog         | Closes the top dialog with reason `'escape'` when it is dismissable and keyboard dismiss isn't disabled; otherwise nothing, and the browser doesn't close it either. A widget inside that handles Escape prevents it, and the dialog leaves it alone. |
| Tab, Shift+Tab | in the dialog                       | Moves through the dialog's tabbable elements and wraps at both ends (APG). Natively both engines let focus leave to the browser's own controls, and WebKit stops on the dialog itself (probed).                                                       |
| Enter, Space   | close                               | Closes the dialog with reason `'close'`.                                                                                                                                                                                                              |
| Enter          | a field in a `method="dialog"` form | Submits it: a close with reason `'submit'` (Pointer and forms).                                                                                                                                                                                       |

## ARIA and state attributes per state

| State            | Part       | Attributes                                                                                                      |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| closed           | root       | `id`, `tabindex="-1"`, `aria-labelledby` and `aria-describedby` (rendered parts); `role="alertdialog"` when set |
| open             | every part | + `data-open`; the root is `:modal`, in the top layer                                                           |
| first frame      | every part | + `data-entering`                                                                                               |
| closing          | every part | − `data-open`, + `data-exiting`; the root is still `:modal` until its animations end                            |
| dismissable      | root       | none: dismissability changes behavior, not semantics                                                            |
| trigger disabled | trigger    | Button's `disabled` or `aria-disabled`, `data-disabled`                                                         |

No `aria-modal`: a dialog opened with `showModal()` is modal in the
accessibility tree already (Chromium's tree marks everything outside it
ignored; probed), as React Aria and UI Kit also leave it off.

## Focus

- **On open** (Resolved questions 2), in order:
  1. the first element in the dialog with `autofocus` or `data-autofocus`;
  2. the dialog itself (`tabindex="-1"`), so a screen reader reads its name
     and description first and no action is focused by surprise.

  Natively Chromium and WebKit focus the first focusable element and differ
  on `autofocus` on the `<dialog>` (Chromium ignores it; probed), so UniAria
  sets the focus itself right after `showModal()`. Focus is visible when
  the dialog was opened from the keyboard, following the modality tracker.

- **While open.** Focus stays in the dialog: Tab wraps (Keyboard), and the
  page is inert. A press on the backdrop moves focus to the dialog element
  (native; probed), which keeps it inside.
- **On close**, after the closing phase, when `shouldRestoreFocus` (Resolved questions 6):
  1. nothing, when focus has already moved to a connected element outside
     the dialog and the trigger (the consumer handed it off, as UI Kit
     allows);
  2. the trigger part, when there is one and it can take focus;
  3. else the element focused before the dialog opened, when it is still
     connected and focusable;
  4. else the dialog below, when this one was nested, or the body.

  Natively, WebKit restores focus to the body after a dialog opened by a
  click, because a click doesn't focus a button on macOS (probed); that is
  why UniAria prefers the trigger part.

## Pointer and forms

- **Trigger.** Button's press, from every input; a press opens the dialog.
- **Backdrop.** Every press on the `::backdrop` targets the `<dialog>`
  itself (probed), so UniAria tells them apart by position: a `pointerdown`
  and its `click` both outside the dialog's border box close it with reason
  `'outside'` when it is dismissable. Nothing under the backdrop receives
  the press: the page is inert (probed), so the owner's rule for popovers,
  where an outside press also acts, doesn't apply.
- **Inside.** Presses inside never close the dialog, except on the close
  part.
- **`<form method="dialog">`.** Natively its submission closes the dialog
  with the submitter's `value` as `returnValue` (probed). UniAria turns it into
  a close request instead (Resolved questions 9): after the consumer's own
  `submit` handlers have run and haven't prevented it, UniAria prevents the
  native close and reports `dismiss` with reason `'submit'` and the
  submitter's value, then closes through the closing phase. Validation that
  prevents `submit` keeps the dialog open.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` in Chromium and WebKit for
a dialog titled "Delete file", described by "This can't be undone.", with
Cancel and Delete buttons.

| State                       | Spoken phrase                                     |
| --------------------------- | ------------------------------------------------- |
| the trigger                 | `button, Delete file`                             |
| opened, focus on the dialog | `dialog, Delete file, This can't be undone.`      |
| without a description       | `dialog, Delete file`                             |
| `alertdialog`               | `alertdialog, Delete file, This can't be undone.` |
| focus on Cancel             | `button, Cancel`                                  |

The virtual screen reader doesn't model a modal's inertness: it still reads
the page behind an open dialog (probed). Scenarios check inertness through
`:modal`, focus that can't reach the page, and Chromium's accessibility
tree, not through spoken output.

## Adapter surface

```tsx
// React
const confirm = useComponent(dialog, { onOpenChange, onDismiss });
return (
  <>
    <button {...confirm.parts.trigger}>Delete file</button>
    <dialog {...confirm.parts.root}>
      <h2 {...confirm.parts.title}>Delete file</h2>
      <p {...confirm.parts.description}>This can't be undone.</p>
      <form method="dialog">
        <button {...confirm.parts.close}>Cancel</button>
        <button value="delete" data-autofocus>
          Delete
        </button>
      </form>
    </dialog>
  </>
);
```

```html
<!-- Custom element -->
<uni-dialog>
  <button data-element="Trigger">Delete file</button>
  <dialog class="uni-dialog" role="alertdialog">
    <h2 data-element="Title">Delete file</h2>
    <p data-element="Description">This can't be undone.</p>
    <form method="dialog">
      <button data-element="Close">Cancel</button>
      <button value="delete" autofocus>Delete</button>
    </form>
  </dialog>
</uni-dialog>
```

`data-autofocus` works in React too: React doesn't write `autoFocus` as an
attribute, it focuses the element on mount, while the dialog is still
closed.

Element attributes: `default-open`, `disabled`, `keyboard-dismiss-disabled`,
`labelled-by`, `described-by`; `isDismissable` and `shouldRestoreFocus`
default to true, which a boolean attribute can't turn off (Resolved questions 4). Properties: `isOpen` (controlled), `defaultOpen`, and the
others by prop name. Events: `openchange`, `dismiss`. The trigger and the
dialog must both be inside `<uni-dialog>`; a page that opens it from
elsewhere sets `isOpen` or calls `instance.api.open()`.

## Mapping from Cube UI Kit

| UI Kit                                                                 | UniAria                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DialogTrigger` + `Dialog`                                             | One `dialog` with a trigger part.                                                       |
| `DialogContainer`, `useDialogContainer`                                | A `dialog` without a trigger, controlled with `isOpen`.                                 |
| `AlertDialog`                                                          | `role="alertdialog"`, `isDismissable={false}`, `data-autofocus` on the button to focus. |
| `isDismissable`, `isKeyboardDismissDisabled`                           | The same props and defaults.                                                            |
| `onDismiss(action)`                                                    | `dismiss` with a `reason`.                                                              |
| `shouldRestoreFocus`                                                   | The same.                                                                               |
| the X close button, `closeIcon`                                        | The close part; its looks are the consumer's.                                           |
| `onEnter` … `onExited`, the `open`, `enter`, `entered` and `exit` mods | `data-open`, `data-entering`, `data-exiting`; `isEntering`, `isExiting`.                |
| `hideOnClose`                                                          | Always: UniAria never unmounts anything.                                                |
| the Underlay                                                           | `::backdrop`.                                                                           |
| `type`, `size`, `mobileType`, header and footer slots                  | Styles (Summary).                                                                       |
| `type="popover"`                                                       | Popover (next).                                                                         |

## Differences from React Aria, the APG and native behavior

Each row was a choice for the owner, approved with the resolved questions as recommended in the last column.

| #   | Topic                       | Cube UI Kit                                                     | React Aria                                                 | APG, Zag, native                                                           | Decided                                                                         |
| --- | --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Element                     | `<section>` in a portal over an underlay `div`                  | `<section>` in a portal                                    | Zag: a `div`; native: `<dialog>`                                           | Native `<dialog>` (Resolved questions 1)                                        |
| 2   | The page behind             | Not hidden: no `inert`, `aria-hidden` or `aria-modal`           | `ariaHideOutside` with `inert`                             | APG: inert or hidden; native modal makes it inert                          | Native inertness, which UI Kit lacks                                            |
| 3   | `isDismissable` default     | `true`                                                          | `false`                                                    | Zag: `true`, `false` for `alertdialog`                                     | `true`, as UI Kit (Resolved questions 3)                                        |
| 4   | Escape when not dismissable | Doesn't close                                                   | Closes (only `isKeyboardDismissDisabled` stops it)         | Zag: separate `closeOnEscape`                                              | Doesn't close, as UI Kit                                                        |
| 5   | Initial focus               | `[data-autofocus]`, a submit or primary button, else the dialog | An autofocused child, else the dialog                      | APG and native: the first focusable; Zag: the same, else the dialog        | `autofocus`/`data-autofocus`, else the dialog (Resolved questions 2)            |
| 6   | Tab containment             | From the end of the enter transition                            | The whole time, off while exiting                          | APG: wrap; native: leaves to the browser                                   | Wrap the whole time it is shown                                                 |
| 7   | Focus restore               | The trigger, as soon as it closes, unless focus was handed off  | The previously focused element, on unmount, with fallbacks | Native: the previously focused element (WebKit: often the body)            | The trigger, after the exit animation, unless handed off (Resolved questions 6) |
| 8   | Trigger ARIA                | None for modal types                                            | `aria-expanded`, `aria-controls` while open                | APG examples: none; Zag: `aria-haspopup`, `aria-expanded`, `aria-controls` | None (Resolved questions 8)                                                     |
| 9   | Description                 | Never linked                                                    | Linked automatically for `alertdialog` only                | APG: required for `alertdialog`, optional otherwise                        | Linked whenever the part is rendered                                            |
| 10  | Scroll lock                 | From the end of the enter transition                            | While open                                                 | Native: none                                                               | While shown                                                                     |
| 11  | While closing               | Still interactive; guards keep it from catching Escape          | —                                                          | —                                                                          | Still modal; ignores Escape and backdrop presses                                |
| 12  | `aria-modal`                | Not set                                                         | Not set (a Safari bug in iframes)                          | APG and Zag set it                                                         | Not set: native modal already is                                                |

## Deviations from the WAI-ARIA pattern

- **Initial focus** goes to the dialog itself unless an element is marked
  (Resolved questions 2). The APG prefers the first focusable element, and
  allows a static element at the top for long content.
- **No `aria-modal`**: the native modal dialog provides the semantics.

## Resolved questions

Decided by @tenphi on 2026-10-16, each as recommended.

1. **The native `<dialog>` with `showModal()`.** It gives the top layer (no
   portals, which AGENTS.md rules out), real inertness of the page in the
   browser and the accessibility tree, `::backdrop`, and Escape plumbing.
   Baseline widely available since 2024-09 (`web-features`). UniAria fills the
   gaps measured above: scroll lock, backdrop presses, Tab wrapping, initial
   focus, focus restore. UI Kit, React Aria and Zag all use a `div` or
   `section`. Decided: yes.
2. **Initial focus**: an element marked `autofocus` or `data-autofocus`,
   else the dialog itself (React Aria; UI Kit's fallback). UI Kit's own
   priority for a submit or primary button becomes a `data-autofocus` its
   Dialog puts on that button. The alternative is native and APG: the first
   focusable element, which in a form is the first field and in a
   confirmation may be a destructive button. Decided: marked, else the
   dialog.
3. **Dismissal props as UI Kit**: `isDismissable` defaults to `true` and
   gates both Escape and the backdrop; `isKeyboardDismissDisabled` turns
   off Escape alone; the close part, a dialog form and the consumer always
   close it (UI Kit #1418). React Aria defaults `isDismissable` to `false`
   and gates only the outside press with it. Decided: as UI Kit.
4. **Booleans that default to `true` on the element** (`isDismissable`,
   `shouldRestoreFocus`): a boolean attribute can only turn a prop on. Either
   (a) the runtime reads `"false"` as false for these props, as HTML's
   `draggable="false"` and `spellcheck="false"` do (a custom-element contract
   change), or (b) they are properties only, or (c) the props flip
   (`isNonDismissable`), against UI Kit's names. Decided: (a).
5. **A closing phase for exit animations.** When it closes, the dialog
   stays modal with `data-exiting` until the animations running on it and
   its subtree (including `::backdrop`) finish, read through
   `getAnimations()` as React Aria does, then UniAria calls `close()`. Reopening
   while closing cancels it. Enter animations need only `data-entering` for
   the first frame (or CSS `@starting-style`). Cross-browser exit animation
   can't be pure CSS: `overlay` and `display` transitions aren't Baseline.
   UI Kit uses a fixed 350 ms instead of reading the animations. This is a
   new `dom/` primitive that Popover and Tooltip reuse. Decided: yes.
6. **Focus restore order** (Focus): the trigger part first, as UI Kit,
   since WebKit's native restore lands on the body after a click; after the
   closing phase, since the page is inert until `close()` (UI Kit restores
   at once because its page never was). Decided: as listed.
7. **The live announcer while a modal is open.** The announcer's regions
   live in the page, which the open modal makes inert: Chromium's
   accessibility tree marks everything outside the dialog ignored (probed),
   which takes the regions with it, so a Field error inside a dialog would
   go unannounced. Confirmed before building: Chromium's tree marks the
   regions ignored as `activeModalDialog`, and a region inside the dialog
   stays exposed. React Aria exempts its announcer from
   `ariaHideOutside`; native inertness has no exemption. Proposed: while a
   modal dialog is open, the announcer writes to a region inside the top
   one, and moves back when it closes. This touches `dom/`'s announcer and
   answers part of the open top-layer question in
   `docs/_internal/interaction-layer.md`. Decided: yes.
8. **No trigger ARIA.** UI Kit's modal triggers, React Spectrum's and the
   APG examples carry no `aria-haspopup`, `aria-expanded` or
   `aria-controls`. An open modal makes the trigger inert, so `aria-expanded`
   would only ever be heard as "collapsed"; React Aria leaves
   `aria-haspopup` off because screen readers read most values as "menu".
   Decided: none.
9. **The `dismiss` event and dialog forms.** `dismiss` carries the reason,
   as UI Kit's `onDismiss(action)` does, and a `<form method="dialog">`
   submission becomes a close request with the submitter's value, so it
   gets the closing phase and a controlled dialog can refuse it. The
   alternative is to let the browser close it and only report it.
   Decided: as described.
10. **One definition with trigger and close parts**, rather than separate
    DialogTrigger and Dialog definitions as in UI Kit and React Aria. Both
    parts are optional, so a dialog without a trigger is UI Kit's
    DialogContainer. On the element, the trigger must sit inside
    `<uni-dialog>`. Decided: one definition.

## Open questions

None.
