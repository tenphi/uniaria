---
title: DOM layer
description: '@uniaria/core/dom: interactions, focus, layers, positioning and settings.'
---

`@uniaria/core/dom` is the browser half of the core. It holds:

- [Settings](#settings) a page sets once, such as how popovers and tooltips
  are positioned.
- The building blocks of definitions: [interactions](#interactions) (press,
  hover, focus), [focus management](#focus), [layers and
  dismissal](#layers-and-dismissal), [presence](#presence),
  [positioning](#positioning), the [live announcer](#live-announcer) and the
  [part helpers](#parts-and-effects) that tie them to a definition.
- The [pieces both adapters share](#for-adapter-authors): the binder that
  writes part props to elements, part discovery and owner lookup.

```ts
import { configure, createPress, partEffect } from '@uniaria/core/dom';
```

Nothing here touches `document` or `window` when the module loads, so it
imports on a server. Page-wide state is kept on the window under
`Symbol.for('@uniaria/…')` keys, so several copies of UniAria on one page
share it.

## Settings

Settings apply to the whole page and to every copy of UniAria on it.

```ts
configure(settings: Partial<Settings>): void
getSettings(): Settings
```

`configure` changes the settings it is given and keeps the rest;
`getSettings` returns them all. Call `configure` once, before your app
renders: components read the settings when they place a part, so a change
applies from the next time a popover or tooltip opens.

| Setting       | Type                | Default    | Description                                      |
| ------------- | ------------------- | ---------- | ------------------------------------------------ |
| `positioning` | `'script' \| 'css'` | `'script'` | Who places floating parts: UniAria, or your CSS. |

### Positioning modes

Popovers, tooltips and the lists of Select and Combobox float next to an
anchor. Both modes follow
[CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning):
a `position-area` that puts the part on one side of its anchor, and a
`position-try-fallbacks` list for when it doesn't fit.

- **`'script'`**, the default, works in every browser. UniAria places the
  part itself from the component's `positionArea` and
  `positionTryFallbacks` props, by the rules browsers apply to those CSS
  properties: `position: fixed` with `top` and `left`, checked every frame
  while the part is open. It tries the base area, then each fallback, keeps
  the last one that fit while it still fits, and shifts the part into the
  viewport. Gaps are the part's margins, which are yours: the margin facing
  the anchor is the gap, and the others keep the part off the viewport's
  edges.
- **`'css'`** hands placement to your CSS. UniAria only adds a generated
  name to the anchor's inline `anchor-name` list, sets `position-anchor` on
  the part, and reads back the side the browser chose. The `positionArea` and
  `positionTryFallbacks` props are ignored. In a browser without anchor
  positioning, parts stay where your CSS puts them; in development UniAria
  warns once.

```ts
import { configure } from '@uniaria/core/dom';

configure({ positioning: 'css' });
```

```css
[data-uni='popover'] {
  inset: auto;
  position-area: bottom span-right;
  position-try-fallbacks: flip-block, flip-inline;
  margin: 4px 0;
}
```

`inset: auto` undoes the browser's own popover styles, which center it.
The default is planned to become CSS mode once anchor positioning is
[Baseline](https://web.dev/baseline) widely available.

In both modes UniAria writes three custom properties on the floating part, in
pixels: `--anchor-width` (the anchor's width), and `--available-width` and
`--available-height` (the most room the part has in any of its positions,
so a `max-height` built on them never rules out a fallback). Both also place
an arrow part along the edge, pointing at the anchor's center, which CSS
anchor positioning can't do. When the part closes, UniAria puts back the
inline styles it changed. See [Overlays](../guide/overlays.md) and
[Popover](../components/popover.mdx) for the consumer's side.

## Writing definitions

Everything below takes the `setup()` context as its first argument (the
`InteractionContext`, which any [setup context](./core.md#setup-context)
satisfies) and follows the instance's lifecycle: state lives in
`ctx.state()`, listeners are added while the instance is started and removed
when it stops, and nothing runs on the server.

A typical definition creates its interactions in `setup()`, returns their
readers and handlers, and spreads them onto parts in `connect()`:

```ts
import {
  createFocus,
  createHover,
  createPress,
  mergeHandlers,
} from '@uniaria/core/dom';
import type { DomPartProps } from '@uniaria/core/dom';

setup(ctx) {
  const press = createPress(ctx, {
    part: 'root',
    isDisabled: ctx.props.isDisabled,
    onPress: (event) => ctx.emit('press', event),
  });
  const hover = createHover(ctx, { part: 'root', isDisabled: ctx.props.isDisabled });
  const focus = createFocus(ctx, 'root');
  return {
    isPressed: press.isPressed,
    isHovered: hover.isHovered,
    isFocusVisible: focus.isFocusVisible,
    handlers: mergeHandlers(press.handlers, hover.handlers, focus.handlers),
  };
},
connect({ api }) {
  const root: DomPartProps = {
    attrs: {
      'data-pressed': api.isPressed() ? '' : undefined,
      'data-hovered': api.isHovered() ? '' : undefined,
      'data-focus-visible': api.isFocusVisible() ? '' : undefined,
    },
    on: api.handlers,
  };
  return { root };
},
```

Several interactions on one part combine with `mergeHandlers`: spreading two
handler objects would drop one of two `keydown` handlers.

### Parts and effects

| Export                                     | Description                                                                                                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DomPartProps`                             | [Part props](./core.md#part-props) with DOM-typed handlers: `on.keydown` receives a `KeyboardEvent`. Assignable to the runtime's `PartProps`.                                                                               |
| `DomHandlers`                              | Handlers by DOM event name, each typed with its event.                                                                                                                                                                      |
| `partElement(ctx, part)`                   | The element rendered for a part, as an `HTMLElement`, or `null`.                                                                                                                                                            |
| `partEffect(ctx, part, effect, isActive?)` | Runs `effect(element)` while the instance is started, the part has an element and `isActive()` holds, and again (after the previous cleanup) whenever the element changes. Use it for anything that needs a part's element. |
| `elementEffect(ctx, read, effect)`         | The same for any element `read()` returns, such as another component's part.                                                                                                                                                |
| `mergeHandlers(...maps)`                   | Combines handler maps: for each event, every handler runs, in argument order.                                                                                                                                               |
| `InteractionContext`                       | The part of the setup context interactions use: `state`, `effect`, `watch`, `element`, `batch`.                                                                                                                             |

A custom element connects before the parser adds its children, so its parts
often arrive after the instance starts. `partEffect` covers that; an
`effect()` that reads the element once doesn't. Listeners you add to the
document yourself run outside part handlers, so wrap their work in
`ctx.batch()`.

### Development warnings

`warn(message)` logs `[uniaria] message` with `console.warn` in development
only. `isDevelopment()` reads `process.env.NODE_ENV`, which bundlers replace;
on a page with no bundler and no `process`, it is `false` and warnings stay
off.

## Interactions

### createPress

```ts
createPress(ctx, options: PressOptions): Press
```

One `press` for mouse, pen, touch, keyboard and screen-reader activation,
after React Aria's `usePress`. It is what Button, the triggers of overlays and
NumberField's steppers use.

| Option                         | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| `part`                         | The pressable part.                                                |
| `isDisabled()`                 | No presses while it returns `true`; becoming disabled cancels one. |
| `shouldPreventFocusOnPress?()` | A pointer press leaves focus where it was.                         |
| `onPressStart?(event)`         | A press begins.                                                    |
| `onPressEnd?(event)`           | A press ends, whether or not it activates.                         |
| `onPress?(event)`              | The part activates.                                                |

It returns `{ isPressed(), handlers }`: whether a press is active with the
pointer over the part, and the handlers for the part.

- **Order.** `pressstart`, `pressend`, `press` on activation; `pressstart`
  and `pressend` only for a cancelled press (the pointer leaves, a scroll
  takes over the touch, a drag starts).
- **Keys.** Enter and Space press a button-like part, links take only Enter,
  and text fields neither. Where the browser's own activation does something
  UniAria can't (submitting a form, following a link), the keyboard events
  are left alone.
- **Pointers.** A pointer press focuses the part unless
  `shouldPreventFocusOnPress()`, activates on the click that follows the
  release, and turns off text selection during a touch press. A click with no
  pointer behind it (a screen reader, `element.click()`) presses with
  `pointerType: 'virtual'`. `isVirtualClick(event)` tells them apart.
- **Nesting.** Only the innermost pressable handles a press inside nested
  pressable parts.
- **Style.** It sets `touch-action: pan-x pan-y pinch-zoom` inline on the
  part, unless the element has an inline `touch-action` already, and removes
  it when the instance stops.

`PressEvent` carries `type`, `pointerType` (`'mouse'`, `'pen'`, `'touch'`,
`'keyboard'` or `'virtual'`), `target` (the part), the modifier keys,
`key` for keyboard presses, and `x` and `y` relative to the part (its
center when there are no coordinates).

`createItemPress(ctx, options)` is the same for the items of a collection:
one press at a time across all items, keyed by the item's key. Its options
take `element(key)` and `isDisabled(key)`, its callbacks receive the key
first, and it returns `{ pressedKey(), handlers(key) }`. It has no keyboard
press: a collection handles its own keys.

### createHover

```ts
createHover(ctx, { part, isDisabled() }): Hover
```

Returns `{ isHovered(), handlers }`. Hover starts for mouse and pen only
(touch has no hover), ignores the mouse events iOS emulates after a tap and
never starts while disabled. It ends on `pointerleave`, when the part
becomes disabled or the instance stops, and when the pointer is over
something outside the part without a `pointerleave` first (a part removed or
shrunk under it).

### createFocus

```ts
createFocus(ctx, part, options?: { isTextInput?(): boolean }): Focus
```

Returns `{ isFocused(), isFocusVisible(), handlers }` for focus on the part
itself (not its descendants). Focus is visible when the last input was a
keyboard or assistive technology; a key pressed after a click makes it
visible, except typing in a text field. `isTextInput()` marks a part that is
a text field without looking like one.

### createFocusWithin

```ts
createFocusWithin(ctx, { part, isDisabled?() }): FocusWithin
```

Returns `{ isFocusWithin(), isFocusVisible() }`: true while the part or
anything inside it has focus, unchanged while focus moves inside. It listens
on the part element itself, so it has no handlers to spread, and it sees
focus on descendants that are parts of their own.

### Input modality

Focus-visible state comes from one tracker per window that records whether
the user last used a keyboard, a pointer or assistive technology (`virtual`).

| Export                                   | Description                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `modalityTracker(view)`                  | The window's tracker: `get()` (`'keyboard'`, `'pointer'`, `'virtual'` or `null` before any input), `set(modality)`, `isFocusVisible()`, `isEmulatingMouse()`, `subscribe(listener)`. |
| `modalityTrackerFor(element)`            | The tracker of the element's window, or `null`.                                                                                                                                      |
| `isFocusVisibleKey(event, isTextInput?)` | Whether a key event should make focus visible: typing in a text field doesn't, except Tab and Escape.                                                                                |

The tracker starts with the first interaction that asks for it and never
stops. Like React Aria, it wraps `HTMLElement.prototype.focus` once per
window, so a script's `focus()` call isn't taken for a screen reader moving
focus. The wrapper is never removed.

## Focus

### Focusable elements

| Export                            | Description                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `isFocusable(element)`            | Natively focusable or `[tabindex]`, not disabled, not `hidden`, not inside `inert`, and rendered and visible.                        |
| `isTabbable(element)`             | Focusable without `tabindex="-1"`. Of a radio group, only the checked radio, or the first when none is.                              |
| `firstFocusable(root, options?)`  | The first focusable element inside `root`, or `null`.                                                                                |
| `lastFocusable(root, options?)`   | The last one.                                                                                                                        |
| `focusableWalker(root, options?)` | A `TreeWalker` over the focusable elements in document order, starting at `options.from` when given (it never enters `from` itself). |

Options: `isTabbable` (only what Tab reaches) and `accept(element)` (a further
filter).

### createFocusScope

```ts
createFocusScope(ctx, options: FocusScopeOptions): void
```

Runs a focus scope on a part while `isActive()` holds, after React Aria's
`FocusScope`. Dialog and Popover use it.

| Option                  | Description                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `part`                  | The part that holds the scope.                                                                                                                                                                                   |
| `isActive()`            | The scope is live, as while an overlay is open.                                                                                                                                                                  |
| `shouldContain?()`      | Tab and Shift+Tab cycle inside, and focus that moves out or is lost to the body comes back.                                                                                                                      |
| `shouldRestoreFocus?()` | When the scope ends with focus inside, focus returns to the element that had it when the scope started. Tab out of a scope that doesn't contain continues from that element, wherever the scope sits in the DOM. |
| `shouldAutoFocus?()`    | Focuses the first tabbable element when the scope starts, unless focus is already inside.                                                                                                                        |

Scopes nest by when they start, not only by where they sit in the DOM: a
scope that starts while another is active is its child, and only the
innermost active scope contains.

### restoreFocus

`restoreFocus(element, options?)` focuses `element` and marks the call as
focus restoration, which `isRestoringFocus(element)` reports while `focus()`
runs. A tooltip doesn't open for focus that an overlay gives back to its
trigger as it closes.

## Layers and dismissal

### createLayer

```ts
createLayer(ctx, options: LayerOptions): Layer
```

Puts a part on the window's stack of dismissable layers while `isOpen()`
holds. A layer never closes itself: it calls `onDismiss(reason)` and the
component sets its own open state.

| Option                                  | Description                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `part`                                  | The layer's part, such as a popover's root.                                                                   |
| `isOpen()`                              | The layer is on the stack.                                                                                    |
| `isDismissable?()`                      | A press outside closes it.                                                                                    |
| `isKeyboardDismissDisabled?()`          | Escape leaves it open.                                                                                        |
| `shouldCloseOnBlur?(next)`              | Focus moving outside, to `next`, closes it.                                                                   |
| `shouldCloseOnInteractOutside?(target)` | Whether a press outside on `target` may close it.                                                             |
| `isModal?()`                            | A press outside closes it only when it is on top, and never reaches the layers below.                         |
| `source?()`                             | The element that opened it, such as a trigger. A layer below that holds it closes this one along with itself. |
| `onDismiss(reason)`                     | `'escape'`, `'outside'`, `'blur'` or `'parent'`.                                                              |

- **Escape** with focus inside closes the top layer only.
- **A press outside** closes every layer it is outside of, top down, stopping
  at a layer that holds it or a modal one. The press still reaches what it
  hit: one click outside both closes a popover and acts.
- **Closing a layer** closes the layers above it that it holds or that were
  opened from inside it, with reason `'parent'`.

It returns `{ isClosingPress() }`: a press that started outside will close
this layer when it completes. `isTopLayer(element)` tells whether an element
is the topmost open layer in its window.

### interactOutside

```ts
interactOutside(element, { onStart?, onInteract? }): () => void
```

Listens for presses outside `element` and returns the function that stops.
`onStart` hears the primary-button `pointerdown` outside, `onInteract` the
`click` that completes it. Keyboard and focus never count, and neither does
a press whose target was removed from the document. Nothing is stopped: the
outside element still gets its events. A press on a modal `<dialog>`'s
backdrop counts as outside the dialog.

### hideOutside

```ts
hideOutside(targets: Element[], options?): () => void
```

Hides everything under the root except `targets`, their ancestors and their
contents from assistive technology, with `aria-hidden`, and keeps hiding what
is added outside them until you call the function it returns. A modal
popover uses it; a modal `<dialog>` doesn't need it, since the browser makes
the outside inert.

| Option           | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `root`           | Nothing outside it is hidden. Defaults to the targets' `<body>`.                         |
| `shouldUseInert` | Uses `inert` instead, which also takes the outside out of the tab order and hit-testing. |

Calls nest and can be reverted in any order, an element someone else hid
stays theirs, and the live announcer stays exposed. `keepVisible(element)`
keeps an element added later exposed to the newest call, as a non-modal
popover opened from inside a modal needs. Shadow roots aren't supported yet.

### Scroll lock

`lockScroll(document)` locks the page's scrolling and returns the release;
`createScrollLock(ctx, { part, isActive() })` locks the part's document while
`isActive()` holds, as a modal dialog does.

It sets `overflow: hidden` on `<html>`, and keeps the page from shifting when
a classic scrollbar disappears. On iOS, which scrolls the page anyway, it also
prevents touches that would scroll the page, contains overscroll, and stops
`focus()` from scrolling the page. Locks are counted per window: the page
unlocks when the last one is released, in any order, and the inline styles
that were there come back exactly.

## Presence

```ts
createPresence(ctx, { part, isOpen(), shouldSkipExit?() }): Presence
```

An overlay's enter and exit phases. It returns `{ isShown(), isEntering(),
isExiting() }`:

- Opening shows the part at once and marks the first two frames as
  entering, so CSS can transition from them.
- Closing keeps it shown, marked as exiting, until the finite animations on
  the part and its subtree (`::backdrop` included) finish, read with
  `getAnimations()`. Durations are your CSS's; with no animation, it hides in
  the next frame.
- Reopening while exiting cancels the exit. `shouldSkipExit()`, read as it
  closes, hides it at once.

Components turn these into `data-entering` and `data-exiting` style hooks;
see each overlay's page.

## Positioning

```ts
createPosition(ctx, options: PositionOptions): Position
```

Places a floating part against an anchor while `isActive()` holds, in the
page's [positioning mode](#positioning-modes).

| Option                   | Description                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `part`                   | The floating part.                                                                                                                                                          |
| `arrowPart?`             | A part to point at the anchor's center.                                                                                                                                     |
| `isActive()`             | The part is shown.                                                                                                                                                          |
| `anchor()`               | The element to place against.                                                                                                                                               |
| `positionArea()`         | A CSS `position-area` (`PositionArea`): a side, optionally with `center`, `span-all` or a span (`'top span-right'`). Corners aren't supported, since an arrow needs a side. |
| `positionTryFallbacks()` | A CSS `position-try-fallbacks`: try tactics (`flip-block`, `flip-inline`, `flip-start`) and areas, or `none`.                                                               |

It returns `{ side() }`: the side the part landed on after fallbacks
(`'top'`, `'bottom'`, `'left'` or `'right'`), `undefined` while inactive. In
script mode UniAria owns the part's `position` and inset properties; in both
modes `position-anchor`, the custom properties and the arrow's `left` or
`top`. In development it warns once about an invalid area or fallback.

`isInView(element)` tells whether any of an element shows inside the viewport
and every scrolling box around it, and `watchLeavingView(ctx, read, onLeave)`
calls `onLeave` once the element `read()` returns, after being seen, is
scrolled out of view. Popover and Tooltip close that way when their anchor
scrolls away.

## Live announcer

Messages for screen-reader users that nothing on the page shows, such as a
result count or the value a stepper reached.

| Export                                   | Description                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `announce(message, options?)`            | Reads `message`: text, or `{ 'aria-labelledby': id }` to read an element, which may stay hidden. Does nothing on the server.     |
| `clearAnnouncer(politeness?, document?)` | Drops the messages still in a region and those waiting, so the next one is the only one read. Both regions by default.           |
| `destroyAnnouncer(document?)`            | Removes the container; the next message creates it again.                                                                        |
| `hostAnnouncer(element)`                 | Moves the container into `element`, a modal dialog the rest of the page is inert under, until the returned function releases it. |

| `announce` option | Default        | Description                                                   |
| ----------------- | -------------- | ------------------------------------------------------------- |
| `politeness`      | `'assertive'`  | `'assertive'` interrupts the screen reader; `'polite'` waits. |
| `timeout`         | `7000`         | How long the message stays in its region, in milliseconds.    |
| `document`        | the global one | The document to announce in.                                  |

The container is one visually hidden element per document, prepended to
`<body>` on the first message and marked `data-uni-live-announcer`. It holds
an assertive and a polite `role="log"` region, which stay between messages so
screen readers keep tracking them. Repeating a message announces it again.
Messages sent within 100 ms of the container's insertion wait and go in
together, in order, because Safari ignores a region that new.

## Platform and support checks

| Export                                                            | Description                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `isMac(view)`, `isIOS(view)`, `isIPhone(view)`, `isAndroid(view)` | Platform checks, from `navigator.platform` (and the user agent for Android). iPadOS counts as iOS. |
| `supportsPopover(view)`                                           | The Popover API.                                                                                   |
| `supportsAnchorPositioning(view)`                                 | CSS anchor positioning on a popover.                                                               |
| `isComposing(event)`                                              | An IME composition owns the key, including Safari's commit keydown after `compositionend`.         |

For tests, a window property under `Symbol.for('@uniaria/fallbacks/v1')`
forces a fallback in a browser that has the feature:
`{ popover: false }` or `{ anchorPositioning: false }`. Components read it
when they start.

## For adapter authors

The two adapters share these, so neither diffs attributes or searches the DOM
itself. You need them only to write another adapter; see
[Testing](./testing.md) for the contract it must pass.

| Export                                              | Description                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createBinder(instance, { host? })`                 | Writes an instance's part props to its elements. `attach(part, element)` and `attachItem(part, key, element)` register elements, `start()` subscribes and writes, `stop()` unsubscribes, `itemOf(element)` finds an item's part and key. With `host`, it also delegates part listeners for a custom element from its root node. |
| `queryParts(host, definition)`                      | The first element for each part of a definition (its `name`, `parts` and `outsideParts`) inside a host, by its marker (the root's `data-uni`, an outside part's `data-uni-part`, any other part's `data-element`), skipping those inside another UniAria host or another host of the same tag.                                  |
| `queryItemParts(host, parts, onSkip?)`              | Every element of each item part, by part and `data-key`. Elements without a key, or with a repeated one, are skipped and reported to `onSkip`.                                                                                                                                                                                  |
| `observeParts(host, callback)`                      | Calls `callback` when parts may have been added, removed or renamed (a change of `data-uni`, `data-uni-part`, `data-element`, `data-key` or an item's text; never of `class`); returns the stop function.                                                                                                                       |
| `UNI_HOST`                                          | The symbol a custom-element class sets to `true` to count as a UniAria host, so hosts around it leave its parts alone.                                                                                                                                                                                                          |
| `provideOwner(instance, element)`                   | Answers owner and link requests for `instance` that reach `element`: from inside it, or naming it by id. Returns the cleanup, which releases every child it answered.                                                                                                                                                           |
| `requestOwner(element, wanted, onChange, ownerId?)` | Keeps `onChange` told of the owner of `wanted` (a definition, or a link key) for `element`: the element with id `ownerId` when given, else the nearest providing ancestor (for a link, the nearest UniAria host). Waits for an owner that connects later.                                                                       |

The binder writes only what differs from the element: an attribute set to the
same value, or a live property that already matches, is left alone, so a
framework that renders the same values never fights it. A part keeps an `id`
its element carries: the binder reads it as the element attaches and when it
changes, hands it to the instance (`adoptId`), and writes an id only where
there is none; item parts always take the ids made from their key. When an
element stops being a part, the binder removes the attributes and styles it
wrote there, unless another part bound to the element writes them too; what
it never wrote (your markers, your id, what React rendered) stays. React attaches its
own listeners; the custom-element adapter lets the binder delegate them from
the document or shadow root, in the bubble phase for events that bubble and
the capture phase for those that don't, never on the host.
