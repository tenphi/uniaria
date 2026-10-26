# Inline popover spec (a responsive drawer)

Status: approved by @tenphi on 2026-10-26

## Summary

A documentation site's navigation is a sidebar on wide screens and a drawer
over the page on narrow ones: the same `<nav>`, the same links, one element.
Below the breakpoint it is a modal overlay (a toggle opens it, Tab stays
inside, Escape and a press outside close it, focus goes back to the toggle).
Above it, it is plain content of the page, with no dialog role and nothing
to open. Popover already is the overlay half. This spec adds the other half:
an **inline state**, in which the popover's root is ordinary content.

In four parts: the new state, two things Popover already does that a drawer
relies on but its spec doesn't say, and a finding from probing.

1. **The inline state** (`isInline`), set by the consumer, typically from a
   media query.
2. **A popover with no anchor** is never placed: its CSS places it (a drawer
   or a sheet). The code does this today; the Popover spec doesn't say it.
3. **A toggle that sits apart.** A drawer's toggle is in the header and the
   drawer is in the page frame, so no element wraps both. Without a trigger
   part, the consumer opens it with `open()` and keeps its own toggle's
   ARIA. A trigger linked by id is left for later (Resolved questions 3).
4. **The backdrop.** A press on a manual popover's `::backdrop` reaches the
   page below it (probed), so it already counts as outside and acts on what
   it hit, as every press outside a popover does (Resolved questions 2).

- **Named consumer:** Cookbook's mobile navigation (`@tenphi/renderer`,
  `#cookbook__sidebar` and its `cookbook-sidebar-pane` element), which does
  all of this by hand today: it removes `popover`, `role` and `aria-modal`
  above 50rem and puts them back below, wraps Tab, sets `inert` on the page,
  and restores focus to its toggle.
- **Prior art:** Fluent UI's `InlineDrawer` and `OverlayDrawer` (a drawer's
  `type`), Bootstrap's responsive offcanvas (`.offcanvas-lg`: an overlay
  below the breakpoint, content above it), and Cube UI Kit's
  `mobileType`/`mobileViewport`, which switches a DialogTrigger's type at a
  breakpoint (`references/cube-ui-kit/src/components/overlays/Dialog/DialogTrigger.tsx`;
  the other two aren't in `references/`).

### Why Popover, not Dialog

The inline form must be plain content: a `<nav>` that is a navigation
landmark, not a dialog. Dialog's root is a `<dialog>`, whose role stays
`dialog` in every state (HTML allows it no role but `alertdialog`), and which
the browser hides while it isn't `open`. Popover's root is any element. So
the inline state goes on Popover.

The Popover spec maps UI Kit's `mobileType` to styles ("a design system
renders a Dialog instead on small screens"). That holds for a design system
that renders different markup per screen. A page rendered once, on the
server, for every width can't: rendering the navigation twice doubles it on
every page. The inline state isn't a look; it decides whether the element is
an overlay at all.

### Not part of this spec

- **Scroll lock** while the drawer is open: a modal popover has none
  (Popover spec, Resolved questions 4). The drawer's own
  `overscroll-behavior: contain` keeps its scrolling in.
- **Closing on a link inside**: the consumer's (Popover spec, Resolved
  questions 12). Cookbook calls `close()` on a link click.
- **Watching the media query**: the consumer's (Resolved questions 1).
- **Looks**: the drawer's slide and its dimmed `::backdrop` are the
  consumer's CSS, on `data-entering`, `data-exiting` and `data-inline`.

## Props

| Prop     | Type      | Default | Bindable | Change event | Notes                                                                                    |
| -------- | --------- | ------- | -------- | ------------ | ---------------------------------------------------------------------------------------- |
| isInline | `boolean` | `false` | no       | —            | The root is plain content: not a popover, nothing opens it (The inline state). `inline`. |

## The inline state

While `isInline` is true:

- **The root is plain content.** UniAria writes none of `popover`, `hidden`,
  `role`, `tabindex`, `aria-labelledby`, `aria-describedby` or
  `data-placement` on it, and removes those it wrote. The root keeps its own
  semantics (a `<nav>` is a navigation landmark) and shows where the
  consumer's CSS puts it.
- **Nothing opens it.** A press on the trigger does nothing and `open()`
  does nothing. A controlled `isOpen: true` is ignored. The popover isn't
  in the layer stack, hides nothing outside it, contains no focus and isn't
  placed.
- **The trigger** gets no `aria-expanded` and no `aria-controls`; it keeps
  Button's attributes. The consumer hides it: it exists for the overlay
  form.
- **Every part** carries `data-inline`.

Turning it on while open closes the popover at once: no closing phase, no
focus restore, since the root stays on the page and focus can stay in it.
Uncontrolled, `isOpen` becomes `false`; either way `openChange(false)` is
reported, and no `dismiss`, since no user asked, as with `close()`. A
controlled consumer sets `isOpen` to `false` in response; otherwise the
popover opens again when it leaves the inline state.

Turning it off makes the root a closed popover again (`popover="manual"`,
hidden). When focus was inside it, focus moves to the trigger, so it doesn't
fall to the body. Without a trigger part the browser drops it to the body,
and the consumer, which turned the state off, moves it (to its own toggle).

Nested popovers inside an inline root work as on the page: their layer has
no parent popover.

### Server rendering

The server can't evaluate a media query. The root's server HTML follows
`isInline` as given:

- **React and Vue:** pass the form you want before mount. For a drawer,
  `isInline: true` on the server (the root is content, correct for wide
  screens), then the media query's value after mount.
- **Custom elements:** the consumer's markup is the server HTML. Render the
  inline form (the `inline` attribute on the host, no `popover` or `role` on
  the root), then set `isInline` from the media query once the element is
  defined; UniAria writes `popover` and `role` when it leaves the inline
  state.
- **Either way**, hide the root below the breakpoint with CSS while it has
  no `popover` attribute (before UniAria starts, and until the media query
  is applied), and, for pages that should work without JavaScript, show it
  as content there with `@media (scripting: none)` (Baseline widely
  available since 2026-06).

## A popover with no anchor

Changed in the Popover spec's Positioning, from what the code does: UniAria
places the root against the anchor part, else the trigger frame, else the
trigger, **and places nothing when there is none of them**, in both modes.
The consumer's CSS places it, as a drawer's `inset-inline-start: 0` does.
`data-placement` is absent and the arrow isn't positioned.

## A toggle that sits apart

When no element can wrap both the toggle and the popover, the popover has
no trigger part:

- **Opening.** The toggle's own handler calls `open()` (the element's
  `open()` method, `actions.open()` in React and Vue).
- **Its ARIA.** The consumer writes `aria-expanded` and `aria-controls` on
  its toggle from `openChange`. UniAria writes nothing on an element that
  isn't a part.
- **Pressing it while open.** The toggle is outside the popover, so a press
  on it closes the popover with reason `'outside'` before the toggle's
  handler runs. To make it a toggle, return `false` from
  `shouldCloseOnInteractOutside` for it and call `close()` from its handler
  when open. A drawer usually covers its toggle while open, so it can skip
  this.
- **Focus** goes back, on close, to the element focused before it opened
  (the Popover spec's order, with no trigger): the toggle.
- **Its name.** With no trigger to name it, a popover needs a title,
  `labelledBy` or an `aria-label` on the root; development already warns
  without one.
- **The Tab order.** `showPopover()` gets no `source`, so a non-modal
  popover is last in the top layer's order. A drawer is modal, and Tab
  wraps inside it.

## Keyboard

Nothing new. While inline, the root's content takes Tab in the page's order,
and Escape does nothing.

## ARIA and state attributes per state

Added to the Popover spec's table:

| State  | Part       | Attributes                                                                                                                     |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| inline | root       | No `popover`, `hidden`, `role`, `tabindex`, `aria-labelledby`, `aria-describedby` or `data-placement`; the consumer's own stay |
| inline | trigger    | Button's only: no `aria-expanded`, no `aria-controls`                                                                          |
| inline | every part | + `data-inline`; never `data-open`, `data-entering` or `data-exiting`                                                          |

## Focus

- **Into the inline state** with focus inside: it stays.
- **Out of the inline state** with focus inside: to the trigger; without
  one, the consumer moves it (The inline state).
- Otherwise as the Popover spec.

## Pointer

A press on the root's `::backdrop` reaches the element below it: a manual
popover's `::backdrop` computes to `pointer-events: none`, and an author's
`pointer-events: auto` doesn't change it (probed in Chromium and WebKit;
Firefox didn't launch on the probing machine). So the press is outside the
popover, closes it with reason `'outside'`, and acts on what it hit, as
every press outside a popover does (owner decision, 2026-10-15). An `auto`
popover behaves the same (probed): it closes on the press, and the element
below still gets the click. Nothing changes in `dom/`: its backdrop check
covers modal `<dialog>`s, whose backdrop presses do target the dialog.

## Styling tokens

Added to the Popover spec's table:

| Token         | On                                | Meaning                                      |
| ------------- | --------------------------------- | -------------------------------------------- |
| `data-inline` | every part                        | The inline state: the root is plain content. |
| `isInline`    | public state (`useBehaviorState`) | The same.                                    |

## Public state

Adds `isInline` (`boolean`): the prop's value.

## Expected spoken output

To be confirmed with `@guidepup/virtual-screen-reader` in the scenarios, for
a `<nav aria-label="Docs">` root with links:

| State                    | Spoken phrase                                     |
| ------------------------ | ------------------------------------------------- |
| inline, reading the root | `navigation, Docs`, then its links; no `dialog`   |
| overlay, opened          | `dialog, Docs` (the root's `aria-label` names it) |
| overlay, closed          | nothing: the root is hidden                       |

## Adapter surface

```tsx
// React: a drawer whose toggle is elsewhere in the tree.
// `useIsWide` is the app's media-query hook, true on the server.
const isWide = useIsWide('(min-width: 50rem)');
const drawer = useBehavior(popover, { isInline: isWide });
const isOpen = useBehaviorState(drawer, (state) => state.isOpen);
return (
  <>
    <button
      aria-controls={drawer.parts.root.id}
      aria-expanded={isOpen}
      onClick={() => drawer.actions.open()}
    >
      Menu
    </button>
    <nav {...drawer.parts.root} aria-label="Docs">
      <button {...drawer.parts.close}>Close</button>…
    </nav>
  </>
);
```

```html
<!-- Custom element: the toggle sits outside it -->
<button id="menu" aria-controls="docs-nav" aria-expanded="false">Menu</button>
…
<uni-popover id="drawer" inline>
  <nav data-uni="popover" id="docs-nav" aria-label="Docs">
    <button data-element="Close">Close</button>
    …
  </nav>
</uni-popover>
<script type="module">
  await customElements.whenDefined('uni-popover');
  const menu = document.querySelector('#menu');
  const drawer = document.querySelector('#drawer');
  const wide = matchMedia('(min-width: 50rem)');
  const sync = () => (drawer.isInline = wide.matches);
  wide.addEventListener('change', sync);
  sync();
  menu.addEventListener('click', () => drawer.open());
  drawer.addEventListener('openchange', (event) =>
    menu.setAttribute('aria-expanded', String(event.detail)),
  );
</script>
```

Element attribute: `inline` (boolean). Property: `isInline`.

## Changes to approved specs

Made with the implementation, each marked "Changed on <date> (owner)" in
place:

- **Popover:** `isInline` in Props and Public state; the inline state in
  Opening and closing; its rows in ARIA and state attributes per state;
  `data-inline` in Styling tokens; "places nothing without an anchor" in
  Positioning; the backdrop finding in Pointer; focus out of the inline
  state in Focus; `inline` in Adapter surface; a toggle that sits apart
  under Not part of Popover; the UI Kit mapping row for `type`,
  `mobileType` and `mobileViewport` (the inline state is the one switch
  that isn't a style).
- **AGENTS.md, Overlays and positioning:** an inline popover is plain
  content, not an overlay.
- **`docs/components/popover.mdx`:** a responsive drawer section, with the
  element example above.

## Conformance

Written after approval, in `conformance/src/popover/`, in its own pull
request. The scenarios this spec implies:

- An inline root carries none of the overlay attributes, is visible, and
  every part has `data-inline`; the trigger has no `aria-expanded`.
- A press on the trigger and `open()` do nothing while inline.
- Turning `isInline` on while open: `openChange(false)`, no `dismiss`, the
  root stays visible, focus stays inside.
- Turning it off with focus inside: the root is hidden and focus is on the
  trigger.
- A popover with no trigger, opened with `open()`: no positioning styles on
  the root, Tab wraps inside, Escape closes it, focus returns to the element
  focused before it opened.
- A press on the backdrop over a page button closes the popover and the
  button gets the click.
- A nested popover inside an inline root opens and dismisses on its own.
- Spoken output: the inline root reads as its own role, never `dialog`.

## Deviations from the WAI-ARIA pattern

None. The overlay form is the Popover spec's, and the inline form is the
root's own semantics.

## Resolved questions

Decided by @tenphi on 2026-10-26, each as recommended.

1. **How the inline state is set.** (a) `isInline`, a boolean the consumer
   sets (here, from `matchMedia`; in React, a media-query hook): the
   condition stays the consumer's (a container query, a user setting), and
   nothing in UniAria evaluates media. (b) `inlineMedia`, a media query
   string UniAria watches, as UI Kit's `mobileViewport`: declarative on
   elements (`inline-media="(min-width: 50rem)"`), no script, but a second
   way to say the same thing and still unknown on the server. (c) Both.
   Decided: (a).
2. **A press on a dimmed backdrop.** It closes the drawer and acts on what
   is below (probed; the owner's rule for presses outside a popover, and
   what Cookbook's `popover="auto"` drawer does today). A drawer's scrim
   looks like it blocks the page, and a tap on it can follow a link
   underneath. (a) Keep the rule. (b) Swallow the press while a modal
   popover is open: it would need `stopPropagation`, which AGENTS.md bans,
   or an underlay, which it also bans for popovers. (c) Leave it to the
   consumer: an element of its own inside the root, under the panel, as the
   scrim; a press on it is inside, so its handler calls `close()`.
   Decided: (a), with (c) documented for those who want a blocking
   scrim.
3. **A trigger linked by id.** (a) Not now: `open()` and the consumer's
   `aria-expanded` cover it in a few lines (A toggle that sits apart). (b) A
   `trigger` attribute naming the toggle's id, as `popovertarget` does and
   Spectrum Web Components' `trigger="id@click"`, giving it the trigger
   part's attributes and press: a change to the custom-element contract
   (parts found by id, outside the host). Decided: (a); revisit when a
   second consumer needs it.
4. **The prop's name.** (a) `isInline`, attribute `inline` (Fluent's
   `InlineDrawer`). (b) `isDocked`, attribute `docked`. (c) `isStatic`.
   Decided: (a).

## Open questions

None.
