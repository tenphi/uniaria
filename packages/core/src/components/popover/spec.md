# Popover spec

Status: approved by @tenphi on 2026-10-16

## Summary

A popover: a dialog anchored to the element that opens it, over the page but
not blocking it. Cube UI Kit's `DialogTrigger type="popover"` is the model
(its Picker, DatePicker, ColorPicker and FilterPicker panels). UniAria shows the
popover in the top layer with the Popover API in manual mode (`popover="manual"`,
`showPopover({ source })`, Resolved questions 1), places it next to its trigger by
script or by the consumer's CSS anchor positioning (Resolved questions 3), and adds what the
browser leaves out or does its own way: the open state, Escape and outside
dismissal through the layer stack, focus on open and close, and a closing
phase for exit animations, all reused from Dialog.

One definition, `popover`, holds the trigger, an optional anchor, the popover,
an optional arrow, its title and description, and a close button.

- **WAI-ARIA pattern:** none. The APG has no popover pattern. The trigger
  follows [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  (`aria-expanded`), the content follows
  [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  (`role="dialog"`, a name, Escape, focus in and back). The APG's own anchored
  date picker is a modal dialog
  (`references/aria-practices/content/patterns/dialog-modal/examples/datepicker-dialog.html`).
- **Builds on:** Button (`ctx.use`, twice: the trigger and the close button);
  `createLayer`, `createFocusScope`, `createPresence`, `hideOutside` and the
  modality tracker from `dom/`. New in `dom/`: the positioning wrapper (Resolved
  questions 3), and layer-stack changes for nested popovers (Resolved questions 9).
- **Owner:** none.
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec, Resolved
  questions 2): the tooltip instance in React (`tooltip: hint.instance`),
  and on elements the `<uni-tooltip>` it sits in directly or a `tooltip`
  attribute naming one's id. On the trigger: hover, focus and presses
  count there, and it carries the tooltip's id beside its own
  attributes. Opening the popover is a press, so the tooltip closes;
  focus the popover returns to the trigger doesn't open it again.
- **Custom element:** yes, `<uni-popover>`, wrapping the trigger and the
  popover, which hosts consumer markup.

Not part of Popover:

- **Menus, Select and ComboBox lists.** They compose Popover with `ctx.use`
  and decide their own trigger ARIA, focus and keys in their specs. ComboBox
  keeps focus in its input and anchors to its field group, which is why
  Popover has an `anchor` part and a non-modal mode.
- **Tooltip** (next): hover and focus triggers, no focus inside. It reuses the
  positioning wrapper, the arrow and the closing phase.
- **Looks.** UI Kit's `mobileType` (a tray on small screens), sizes and
  slots are styles a design system picks.
- **Anchoring to a point** (a context menu at the pointer): Menu's spec.
- **UI Kit's "a Button pressed inside closes its popover"** (Resolved questions 12).

## Anatomy

| Part        | Element                | Attributes UniAria owns                                                                                                                                                             | Notes                                                                                                                                                                   |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| trigger     | `button`               | Button's (`type`, `tabindex`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`); `aria-expanded`, `aria-controls` while open; state attributes | Optional. A press toggles the popover. No `popovertarget` (Resolved questions 6).                                                                                       |
| anchor      | any                    | none                                                                                                                                                                                | Optional. The popover is placed against it instead of the trigger (UI Kit's `targetRef`).                                                                               |
| root        | any; usually `div`     | `id`, `popover="manual"`, `role="dialog"`, `tabindex="-1"`, `aria-labelledby`, `aria-describedby`, `data-placement`; state attributes; positioning styles (Positioning)             | Hidden while closed. UniAria never sets the `popover` attribute's other values.                                                                                         |
| arrow       | any                    | `aria-hidden="true"`, `data-placement`; its offset along the edge (Positioning)                                                                                                     | Optional (Resolved questions 11).                                                                                                                                       |
| title       | any; usually a heading | `id`; state attributes                                                                                                                                                              | Optional. Names the popover through `aria-labelledby`.                                                                                                                  |
| description | any                    | `id`; state attributes                                                                                                                                                              | Optional. Linked through `aria-describedby` while rendered.                                                                                                             |
| close       | `button`               | Button's                                                                                                                                                                            | Optional. A press closes the popover even when it isn't dismissable. A visually hidden one lets touch screen-reader users close a modal popover (Resolved questions 4). |

The popover's name, in order: `labelledBy` and a rendered title, an
`aria-label` on the root, else the trigger (`aria-labelledby` = the trigger's
id, as React Aria's DialogTrigger does). Development warns when it has none
of these, and when it opens while a modal `<dialog>` that doesn't contain it
is open (the dialog makes it inert: Opening and closing).

State attributes on every part: `data-open` while open, `data-entering` for
the first frame after opening, `data-exiting` while closing, as Dialog.

Render the root always; it is hidden while closed. Place it right after the
trigger in the DOM when you can: older browsers order Tab by the DOM (Focus).

## Props

| Prop                         | Type                                          | Default                     | Bindable | Change event | Notes                                                                                                                                                     |
| ---------------------------- | --------------------------------------------- | --------------------------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| isOpen                       | `boolean`                                     | `false`                     | yes      | `openChange` |                                                                                                                                                           |
| isNonModal                   | `boolean`                                     | `false`                     | no       | —            | Tab leaves the popover, the page stays exposed to assistive technology, and focus leaving closes it (Resolved questions 4).                               |
| isDismissable                | `boolean`                                     | `true`                      | no       | —            | Escape, a press outside and (non-modal) focus leaving close it. `false` turns all three off; the trigger, the close part and the consumer still close it. |
| isKeyboardDismissDisabled    | `boolean`                                     | `false`                     | no       | —            | Escape alone doesn't close it.                                                                                                                            |
| shouldCloseOnInteractOutside | `((target: Element) => boolean) \| undefined` | —                           | no       | —            | Returns `false` to keep the popover open for a press on `target` (UI Kit's `data-popover-keep`). Property only on the element.                            |
| isDisabled                   | `boolean`                                     | `false`                     | no       | —            | The trigger can't open it.                                                                                                                                |
| shouldRestoreFocus           | `boolean`                                     | `true`                      | no       | —            | Focus goes back on close (Focus).                                                                                                                         |
| positionArea                 | `PositionArea`                                | `'bottom'`                  | no       | —            | CSS `position-area`: a side, optionally an alignment span. Script mode only (Positioning).                                                                |
| positionTryFallbacks         | `string`                                      | `'flip-block, flip-inline'` | no       | —            | CSS `position-try-fallbacks`. Script mode only (Positioning).                                                                                             |
| labelledBy                   | `string \| undefined`                         | —                           | no       | —            | More ids for `aria-labelledby`.                                                                                                                           |
| describedBy                  | `string \| undefined`                         | —                           | no       | —            | More ids for `aria-describedby`.                                                                                                                          |

## Events

| Event        | Detail       | When                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openChange` | `boolean`    | The trigger, a dismissal or the close part asks to open or close it. Never for a value the consumer sets.                                                                                                                                                                                                                                   |
| `dismiss`    | `{ reason }` | Before `openChange(false)`, for each close the user asked for. `reason`: `'escape'`, `'outside'`, `'trigger'` (a press on its own trigger), `'close'`, `'blur'` (non-modal), `'scroll'` (Resolved questions 10), `'parent'` (a popover it was opened from closed, Resolved questions 9), or `'browser'` (removed from the page while open). |

## Public state

| Field      | Type                                                  | Meaning                                                                       |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| isOpen     | `boolean`                                             | The current value.                                                            |
| isEntering | `boolean`                                             | The first frame after opening, for enter animations.                          |
| isExiting  | `boolean`                                             | Closed, but still shown until its exit animations end.                        |
| placement  | `'top' \| 'bottom' \| 'left' \| 'right' \| undefined` | The side it was placed on, after fallbacks; `undefined` while it isn't shown. |

## Opening and closing

- **The native popover.** The root carries `popover="manual"` and UniAria calls
  `showPopover({ source })` and `hidePopover()` itself (Resolved questions 1).
  Manual popovers ignore Escape, outside presses and other popovers opening
  (probed), so every close runs through the state, the layer stack and the
  closing phase. `source` is the trigger: it puts the popover right after the
  trigger in the Tab order (probed in both engines), and older browsers ignore
  the argument.
- **Opening.** When `isOpen` turns true, UniAria calls `showPopover()`, places it
  (Positioning), joins the layer stack, hides the page from assistive
  technology unless non-modal, and moves focus (Focus).
- **Closing.** When `isOpen` turns false, the popover enters its closing phase:
  `data-exiting`, off the layer stack (Escape and presses go to what's below),
  focus no longer contained, the page exposed again. When its animations end,
  UniAria calls `hidePopover()` and restores focus. Reopening while closing
  cancels it.
- **Controlled.** A dismissal, the trigger or the close part only reports
  `dismiss` and `openChange(false)`; the popover stays open until the
  consumer sets `isOpen` to `false`.
- **Removed while open.** The browser hides it without `toggle` events, and
  focus inside falls to the body (probed). UniAria restores focus and reports
  `dismiss` with reason `'browser'`, as Dialog.
- **With a modal Dialog.** A modal `<dialog>` makes everything outside it
  inert, including popovers in the top layer (probed), so a popover used in a
  dialog must be inside the dialog's element (no portals, so it is when its
  markup is). A Dialog opened from inside a popover stacks above it and leaves
  it open underneath (manual popovers stay open; probed); closing the dialog
  returns focus into the popover.
- **Server rendering.** The server HTML has the root with `popover="manual"`,
  which hides it where the Popover API exists. A `defaultOpen` popover opens
  after hydration.
- **Without the Popover API** (Resolved questions 2): the popover opens in place,
  `hidden` while closed, `position: fixed` while open, and the consumer gives
  it a `z-index`.

## Keyboard

| Key            | Where               | Behavior                                                                                                                                                                                                                                      |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space   | trigger             | Toggles the popover (Button's press). Closing reports reason `'trigger'`.                                                                                                                                                                     |
| Escape         | in the open popover | Closes the top popover with reason `'escape'` when it is dismissable and keyboard dismiss isn't disabled. A widget inside that handles Escape prevents it, and the popover leaves it alone.                                                   |
| Escape         | trigger, while open | The same (non-modal popovers, where focus can return to the trigger while it is open), as APG's disclosure navigation example closes on Escape.                                                                                               |
| Tab, Shift+Tab | in a modal popover  | Moves through its tabbable elements and wraps at both ends, as UI Kit (Resolved questions 4).                                                                                                                                                 |
| Tab, Shift+Tab | in a non-modal one  | Continues the page's order as if the popover sat right after the trigger: Shift+Tab from its first element goes to the trigger, Tab from its last goes to what follows the trigger (native with `source`, probed; the focus scope elsewhere). |
| Enter, Space   | close               | Closes the popover with reason `'close'`.                                                                                                                                                                                                     |

## ARIA and state attributes per state

| State            | Part       | Attributes                                                                                                      |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| closed           | trigger    | `aria-expanded="false"`                                                                                         |
| closed           | root       | `id`, `popover="manual"`, `role="dialog"`, `tabindex="-1"`, `aria-labelledby`, `aria-describedby`               |
| open             | trigger    | `aria-expanded="true"`, `aria-controls` = the root's id                                                         |
| open             | every part | + `data-open`; the root is `:popover-open`, in the top layer                                                    |
| open             | root       | + `data-placement`; positioning styles                                                                          |
| open, modal      | the page   | `aria-hidden="true"` on everything outside the root, through `hideOutside` (no `inert`: the page takes presses) |
| first frame      | every part | + `data-entering`                                                                                               |
| closing          | every part | − `data-open`, + `data-exiting`; the page is exposed again                                                      |
| trigger disabled | trigger    | Button's `disabled` or `aria-disabled`, `data-disabled`                                                         |

No `aria-haspopup` and no `aria-modal` (Resolved questions 6). Chromium's
tree shows the popover as a non-modal dialog and gives a `source` no implicit
`aria-expanded` (probed), so UniAria's own attributes are the only ones.

## Focus

- **On open**, as Dialog: the first element inside marked `autofocus` or
  `data-autofocus`, else the root itself (`tabindex="-1"`), so a screen reader
  reads its name first. `showPopover()` focuses an `autofocus` element on its
  own (probed); UniAria moves focus either way.
- **While open, modal.** Tab wraps inside. A press outside that will close the
  popover lets focus go where the press puts it, and the press acts on what it
  hit; any other focus that leaves is brought back (Resolved questions 5).
- **While open, non-modal.** Tab moves in and out as in the Keyboard table;
  focus moving to something outside the popover and its trigger closes it with
  reason `'blur'`, except when focus goes nowhere (switching tabs) or into a
  layer above (React Aria's rule, already in the layer stack).
- **On close**, after the closing phase, when `shouldRestoreFocus`: Dialog's
  order (the trigger, else the element focused before it opened), unless focus
  has already moved to an element outside the popover and its trigger. So after
  a press outside, focus stays on what the press focused (a field; a button in
  Chromium), and goes to the trigger when the press focused nothing (the body,
  or a button in WebKit). Natively focus stays on the body (probed).

## Pointer

- **Trigger.** Button's press toggles the popover, from every input. The
  trigger is never outside: a press on it while open closes it once, with
  reason `'trigger'`, and doesn't reopen it. UniAria never stops propagation, so
  the trigger's press handler does the closing and the layer leaves the trigger
  alone.
- **Outside.** A press outside closes it with reason `'outside'` when it is
  dismissable and `shouldCloseOnInteractOutside` doesn't return `false`, and the
  press still acts on what it hit (owner decision, 2026-10-15): one click on
  another popover's trigger closes this popover and opens that one. UniAria closes
  on the `click`, after the `pointerdown` (React Aria; Android Chrome). The page
  is never inert and has no underlay.
- **Inside.** Presses inside never close it, except on the close part.
- **Nested popovers** (Resolved questions 9): a press inside a popover that was
  opened from inside another is inside both.

## Positioning

The positioning wrapper in `dom/` (Resolved questions 3) places the root against
the anchor part, else the trigger, in one of two modes the page picks once,
with `configure({ positioning })` from `@uniaria/core/dom` (owner,
2026-10-16). Both follow CSS Anchor Positioning (owner, 2026-10-16, with the
Tooltip spec's Resolved questions 1).

**Script mode** (`'script'`, the default) places it from the props, in every
browser:

- **`positionArea`** is a CSS `position-area` value on one side of the
  anchor, optionally with the other axis's `center` or a `span-*` keyword:
  `bottom` centres it below, `bottom span-right` puts it below with the left
  edges aligned. Plain logical keywords follow the page's writing mode (the
  top layer's containing block), `self-` ones the popover's own (probed).
  Corners and areas over the anchor aren't supported: the arrow needs a side.
- **`positionTryFallbacks`** is a CSS `position-try-fallbacks` value: `none`,
  or a list of try tactics (`flip-block`, `flip-inline`, `flip-start`, and
  combinations) and `position-area` values. The default,
  `flip-block, flip-inline`, tries the opposite side on either axis.
- **Gaps are the root's `margin`**, from the consumer's CSS: the margin facing
  the anchor is the gap, the others keep the popover off the viewport's
  edges, and a fallback flips them with the area (try tactics swap margins;
  probed).
- **UniAria places it**, `position: fixed` with `top` and `left`, by the
  rules Chromium and WebKit follow (probed; the OddBird polyfill was the
  reference): an option fits when the popover's margin box fits the area it
  names, the last option that fit stays while it fits, and the margin box is
  shifted into the viewport. It checks every frame while open. It writes
  `position` and the `inset` longhands on the root. `@floating-ui/dom` did
  this until 2026-10-16 (Resolved questions 3).

**CSS mode** (`'css'`, opt-in) leaves placing it to the consumer's CSS
anchor positioning, and the two props are ignored:

```ts
import { configure } from '@uniaria/core/dom';

configure({ positioning: 'css' });
```

```css
.popover {
  inset: auto; /* a popover's own is 0 */
  position-area: bottom span-right;
  position-try-fallbacks: flip-block;
  margin: 8px 0;
}
```

- **UniAria links it to its anchor**: inline `position-anchor`, with a name
  unique in the window added to the anchor's own `anchor-name` list.
- **It reads the side back** from the computed `position-area`, which names
  the fallback the browser applied, else from where the popover is (a
  consumer placing it with `anchor()` insets), for `data-placement`. It
  checks every frame while open.
- **The rest is the browser's and the consumer's**: what CSS allows, how an
  engine shifts an oversized popover (Firefox 155 doesn't; probed), and a
  browser without anchor positioning, which UniAria warns about in
  development.

**In both modes**, UniAria writes the variables (Styling tokens) and places
the arrow, and puts back every inline style it replaced when the popover
closes. Everything else on the root is the consumer's.

- **The arrow** (Resolved questions 11): UniAria measures and writes its offset along
  the popover's edge; the consumer's CSS puts it on the side `data-placement`
  names. CSS anchor positioning can't place it (probed).
- **Scrolling** (Resolved questions 10).

## Styling tokens

| Token                                                                                          | On                                 | Meaning                                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `data-scope="popover"`, `data-part`                                                            | its parts                          | Which part an element is.                                              |
| `data-open`, `data-entering`, `data-exiting`                                                   | every part                         | Open; the first frame after opening; closing until its animations end. |
| `data-placement`                                                                               | root, arrow                        | The side it was placed on, after fallbacks.                            |
| Button's `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` | trigger, close                     | As Button.                                                             |
| `--anchor-width`                                                                               | root                               | The anchor's width, in pixels (for `min-width`).                       |
| `--available-width`, `--available-height`                                                      | root                               | The most room it could take, in pixels, in any of its options.         |
| `isOpen`, `isEntering`, `isExiting`, `placement`                                               | public state (`useComponentState`) | The same, for a framework's own bindings.                              |

The variables resolve on the root only, so use them there, not on its
children. Nothing caps the size unless the consumer uses them.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` in Chromium and WebKit for a
trigger "Size" and a popover with a Width field and an Apply button.

| State                        | Spoken phrase                         |
| ---------------------------- | ------------------------------------- |
| the trigger, closed          | `button, Size, not expanded`          |
| the trigger, open            | `button, Size, 1 control, expanded`   |
| opened, focus on the popover | `dialog, Size` (named by the trigger) |
| with a title "Column size"   | `dialog, Column size`                 |
| Tab to the field             | `textbox, Width`                      |

The virtual screen reader honors `aria-hidden`, so scenarios check that a
modal popover's page is hidden by walking it.

## Adapter surface

```tsx
// React
const size = useComponent(popover, {
  positionArea: 'bottom span-right',
  onOpenChange,
});
return (
  <>
    <button {...size.parts.trigger}>Size</button>
    <div {...size.parts.root}>
      <div {...size.parts.arrow} />
      <label>
        Width <input />
      </label>
      <button {...size.parts.close}>Apply</button>
    </div>
  </>
);
```

```html
<!-- Custom element -->
<uni-popover position-area="bottom span-right">
  <button data-part="trigger">Size</button>
  <div data-part="root">
    <div data-part="arrow"></div>
    <label>Width <input /></label>
    <button data-part="close">Apply</button>
  </div>
</uni-popover>
```

Element attributes: `default-open`, `non-modal`, `keyboard-dismiss-disabled`,
`dismissable="false"`, `disabled`, `restore-focus="false"`, `position-area`,
`position-try-fallbacks`, `labelled-by`,
`described-by`. Properties: those by prop name, `isOpen` (controlled) and
`shouldCloseOnInteractOutside`. Events: `openchange`, `dismiss`. The trigger
and the root must both be inside `<uni-popover>`.

## Mapping from Cube UI Kit

| UI Kit                                                                       | UniAria                                                                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DialogTrigger type="popover"` + `Dialog`                                    | One `popover` with a trigger part.                                                                                                                 |
| `targetRef`                                                                  | The anchor part.                                                                                                                                   |
| `placement`, `offset`, `crossOffset`, `containerPadding`, `shouldFlip`       | `positionArea`, `positionTryFallbacks` and the root's `margin` (Positioning; UI Kit's offset 8 and padding 12 become the design system's margins). |
| `shouldUpdatePosition`                                                       | Always.                                                                                                                                            |
| `isDismissable`, `isKeyboardDismissDisabled`, `shouldCloseOnInteractOutside` | The same. `isDismissable` gates the press outside before it happens, not in `onClose`.                                                             |
| `data-popover-keep`                                                          | `shouldCloseOnInteractOutside` returning `false`; a design system can check the same attribute.                                                    |
| `onDismiss(action)`                                                          | `dismiss` with a `reason`.                                                                                                                         |
| `shouldRestoreFocus`                                                         | The same.                                                                                                                                          |
| `--overlay-min-width` set from the trigger's width                           | `--anchor-width`, kept current.                                                                                                                    |
| `maxHeight` written by React Aria                                            | `--available-height`.                                                                                                                              |
| `data-placement`                                                             | `data-placement` and `placement`.                                                                                                                  |
| `hideArrow`, `arrowProps` (never rendered)                                   | The arrow part.                                                                                                                                    |
| the `open`, `enter`, `entered` and `exit` mods; 350 ms exit                  | `data-open`, `data-entering`, `data-exiting`; exit waits for the animations.                                                                       |
| peers closing each other (`usePopoverSync`)                                  | A press on another trigger is outside, so it closes this one. Opening one by script doesn't.                                                       |
| a Button pressed inside closes the popover                                   | Resolved questions 12.                                                                                                                             |
| closing on scroll; `keepOpenOnScroll`                                        | Resolved questions 10.                                                                                                                             |
| the hidden DismissButton                                                     | A close part, visually hidden if it shouldn't show.                                                                                                |
| `type`, `mobileType`, `mobileViewport`                                       | Styles; a design system renders a Dialog instead on small screens.                                                                                 |

## Differences from React Aria, Zag and native behavior

Each row was a choice for the owner, approved with the resolved questions as
recommended in the last column.

| #   | Topic                | Cube UI Kit                                 | React Aria                                | Zag, native                                                               | Decided                                                    |
| --- | -------------------- | ------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Element              | `div` in a portal                           | `div` in a portal, `z-index: 100000`      | Zag: portal; native: top layer                                            | Top layer, `popover="manual"` (Q1)                         |
| 2   | Modal by default     | Tab wraps; page exposed                     | Yes: page inert, scroll locked, underlay  | Zag: non-modal; native: non-modal                                         | Tab wraps, page hidden from AT only, scroll free (Q4)      |
| 3   | Outside press        | Swallowed, except known controls            | Swallowed (second click acts)             | Native: closes on `pointerdown`, click still acts                         | Closes and acts (owner decision)                           |
| 4   | Initial focus        | Priority buttons, else the dialog           | The dialog                                | Zag: first tabbable; native: `autofocus` only                             | Marked element, else the popover (as Dialog)               |
| 5   | Focus after outside  | Trigger, unless focus moved outside         | Trigger when focus was lost               | Zag: as React Aria; native: stays on the body                             | Trigger unless the press focused something (Q5)            |
| 6   | Trigger ARIA         | `aria-expanded`; `aria-controls` while open | The same; no `aria-haspopup` for dialogs  | Zag: + `aria-haspopup="dialog"`, `aria-controls` always; native: expanded | As UI Kit (Q6)                                             |
| 7   | Positioning          | React Aria's JS                             | JS, recomputed on resize, never on scroll | Zag: Floating UI; native: CSS anchor                                      | Script, or the consumer's CSS anchor (Q3)                  |
| 8   | Scroll               | Closes when a trigger ancestor scrolls      | Modal: locked; non-modal: closes          | Zag: follows                                                              | Follows; closes when the trigger scrolls out of view (Q10) |
| 9   | Nested outside press | Closes the top one; menus close the chain   | Closes the top one                        | Native: every popover the press is outside of                             | Every popover the press is outside of (Q9)                 |
| 10  | Arrow                | Props, never rendered                       | `OverlayArrow`                            | Zag: arrow part                                                           | Arrow part (Q11)                                           |

## Deviations from the WAI-ARIA pattern

None from a pattern, since the APG has none for popovers. Against the Dialog
(Modal) pattern it borrows from: a modal popover leaves the page usable by
pointer (owner decision) and has no `aria-modal`; initial focus goes to the
popover unless an element is marked, as in Dialog.

## Resolved questions

Decided by @tenphi on 2026-10-16, each as recommended.

1. **`popover="manual"`, with UniAria owning every close.** `popover="auto"`
   would give light dismiss and Escape for free, but on the browser's terms
   (probed): it closes on `pointerdown`, not on the click (React Aria's
   Android rule); its closing `beforetoggle` can't be cancelled, so a
   controlled popover can't refuse; any unrelated `auto` popover opening
   closes it; a modal `<dialog>` opening anywhere else closes it; and Escape
   closes it with focus anywhere, outside UniAria's layer stack. Spectrum Web
   Components uses `manual` for its modal and tooltip overlays for similar
   reasons (several modals stacking; tooltips beside an open popover). The
   cost: nested popovers are UniAria's job (question 9). Decided: manual.
2. **Without the Popover API** (Chrome before 114, Firefox before 125, Safari
   before 17; Baseline 2025-01): AGENTS.md requires a fallback. Decided: the
   popover opens in place, `hidden` while closed and `position: fixed` while
   open, placed by the positioning wrapper; the consumer gives it a `z-index`; a transformed,
   filtered or `contain`ed ancestor clips and offsets it (documented, as
   Spectrum Web Components does). Server HTML shows it until UniAria starts in
   those browsers. The alternative was no fallback, which needed an exception
   to AGENTS.md.
3. **The positioning wrapper, and `@floating-ui/dom` as a dependency.**
   (a) CSS anchor positioning where it works, written as inline styles, with
   `@floating-ui/dom` (^1.8, about 7 kB gzipped) loaded by dynamic import only
   in browsers without it; UniAria makes Floating UI's flips sticky and reads the
   side back from the computed `position-area`. (b) Floating UI everywhere now
   (one behavior, 7 kB always, JS on every scroll), CSS anchors later. (c) CSS
   anchors only, against AGENTS.md. Our CI's three engines all support anchor
   positioning, so (a) needs a development switch that forces the fallback,
   and the scenarios run on both paths. The design doc already chose (a); the
   dependency is new to the repo. Decided: (a), and add the dependency.
   Amended 2026-10-16 (owner, with the Tooltip spec's Resolved questions 1):
   the wrapper's props became CSS's own, and the fallback is UniAria's,
   following the browsers' rules; CSS's area, margin and fallback rules don't
   map onto Floating UI's placements, so `@floating-ui/dom` is gone.
   Amended again 2026-10-16 (owner): no detection for positioning. A
   detected fallback has to match the consumer's CSS, and anchor positioning
   lets that be almost anything, so the page picks a mode instead
   (Positioning): script, the default, in every browser; or CSS, opt-in,
   placed by the consumer's own anchor positioning. The scenarios run in
   both. The default changes to CSS once anchor positioning is Baseline
   widely available.
4. **Modal by default.** UI Kit wraps Tab inside a popover but leaves the page
   exposed to screen readers; React Aria makes the page inert, locks scroll and
   adds an underlay; Zag and the native popover are non-modal. Decided: a
   popover is modal by default for the keyboard and assistive technology (Tab
   wraps, `hideOutside` with `aria-hidden`), never for the pointer (owner
   decision), with no scroll lock; `isNonModal` gives the native behavior
   (Tab flows past it, the page stays exposed, focus leaving closes it). A
   touch screen-reader user leaves a modal popover through a close part, which
   a design system may visually hide (React Aria renders hidden dismiss
   buttons; UniAria renders nothing).
5. **Focus and a press outside.** Containment would pull focus back from a
   field the user just clicked outside. Decided: when a press outside will
   close the popover, containment lets focus go where the press puts it, the
   press acts on what it hit (a click on a button outside runs it; owner,
   2026-10-16), and the close doesn't restore focus when it landed on an
   element; when the press doesn't close it (not dismissable, or kept by
   `shouldCloseOnInteractOutside`), focus comes back as UI Kit's does.
6. **Trigger ARIA.** Decided: `aria-expanded` always, `aria-controls` only
   while open, no `aria-haspopup` (UI Kit and React Aria: screen readers read
   most `aria-haspopup` values as "menu"). UniAria doesn't use `popovertarget`:
   it would toggle the popover natively behind the state, and its implicit
   `aria-expanded` overrides an explicit `aria-expanded="false"` (probed). Zag
   and Spectrum Web Components' newer popover add `aria-haspopup="dialog"`
   and keep `aria-controls` while closed.
7. **The trigger names the popover when nothing else does** (React Aria's
   DialogTrigger; heard as "dialog, Size"). The alternative was to require a
   title, `labelledBy` or `aria-label` and warn without one, as Dialog does.
   Decided: the trigger as the last fallback.
8. **One definition with trigger, anchor, arrow, title, description and close
   parts**, as Dialog, and React Aria's `Placement` strings and UI Kit's
   defaults (`'bottom'`, offset 8, container padding 12, flip on). Decided:
   yes. Amended 2026-10-16: `positionArea` (`'bottom'`) and
   `positionTryFallbacks` (`'flip-block, flip-inline'`) replaced the placement
   props, and the gaps are the consumer's margins (Positioning).
9. **Nested popovers.** A popover opened from inside another stacks above it,
   and Escape closes the top one. Two choices touch the layer stack in `dom/`:
   - A press outside both: React Aria closes only the top one (a second click
     closes the parent); the native popover and UI Kit's menus close every
     popover the press is outside of. Decided: every popover the press is
     outside of, top down, stopping at a popover that contains the press or a
     modal dialog (which, as now, closes only when it is on top).
   - Closing a popover closes the popovers opened from inside it, with reason
     `'parent'`, as the native popover and Zag do; React Aria and UI Kit get it
     by unmounting. A manual popover inside a hidden one would otherwise stay
     open, invisible. Decided: yes.
10. **Scrolling.** In CSS mode the browser keeps the popover by its trigger;
    in script mode UniAria recomputes as it scrolls. (a) Follow the
    trigger, and close with reason `'scroll'` (without restoring focus, which
    would scroll the page back) when the trigger is scrolled out of view,
    found with an IntersectionObserver. (b) Close when any scroll container of
    the trigger scrolls, as UI Kit and React Aria's non-modal popovers do. (c)
    Follow only, as Zag; Chromium then hides it when the trigger leaves a
    scroll container and WebKit doesn't (probed). Decided: (a).
11. **The arrow part now.** UI Kit documents `hideArrow` but never renders one;
    Tooltip, next, needs it, and so does the wrapper. Decided: an optional
    arrow part in Popover now, positioned along the edge by UniAria in both
    modes.
12. **UI Kit's "a Button pressed inside closes its popover."** Every UI Kit
    Button inside a popover closes it after its handler runs, unless marked
    `data-popover-keep` or a popover trigger. That is a rule of UI Kit's
    Button, not of the popover. Decided: leave it to the design system's
    Button, which calls the popover's `api.close()` (or sets `isOpen`); UniAria
    adds nothing.

## Open questions

None.
