# Interaction layer: behaviours and status

What `packages/sous/src/dom/` has to do, area by area, and how far Sous has
got. The catalogue below was compiled from React Aria's source and tests, the
reference the design doc picks for interaction depth. Sous reimplements the
behaviour; it does not copy React Aria's API. Use the catalogue to:

- find the behaviour, edge cases and browser bugs before building an area;
- pick unit tests (`dom/*.browser.test.ts`) and propose conformance scenarios
  (owner approval) from its numbered items;
- see which items need touch, a real device or a real screen reader
  (appendix).

Source: `references/react-spectrum`, `packages/react-aria` 3.53.1 (commit
e04377c), Apache License 2.0. Paths and line numbers point there. Code adapted
from it keeps the Apache notice (see `dom/press.ts`).

## Status

| Area                   | Status                               | Where                                                       |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------- |
| 1. Press               | Built, except as noted               | `dom/press.ts`; Button conformance                          |
| 2. Hover               | Built                                | `dom/hover.ts`, `hover.browser.test.ts`; Button conformance |
| 3. Focus-visible       | Built                                | `dom/modality.ts`, `dom/focus.ts`, their tests              |
| 4. Focus-within        | Built                                | `dom/focus-within.ts`, its tests                            |
| 5. Focus scope         | Built, except as noted               | `dom/focus-scope.ts`, `dom/focusable.ts`, their tests       |
| 6. Interact outside    | Built                                | `dom/interact-outside.ts`, layer tests                      |
| 7. Dismissable layers  | Built (stack, Escape, outside, blur) | `dom/layers.ts`, its tests                                  |
| 8. Scroll lock         | Planned                              |                                                             |
| 9. aria-hidden outside | Planned                              |                                                             |
| 10. Live announcer     | Built                                | `dom/announcer.ts`, `announcer.browser.test.ts`             |
| 11. Typeahead          | Built (core), not wired yet          | `collections/typeahead.ts`, `typeahead.test.ts`             |

Press, still to build: nested pressables (§1.53-56) and the macOS Meta keyup
workaround (§1.37). Text-selection suppression (`dom/text-selection.ts`,
§1.58-63) applies to touch presses only, as Button's spec says (React Aria now
applies it to every pointer press), and restores after 300 ms without waiting
for CSS transitions to finish (§1.61). Link opening
(§1.40-44) waits for a component that needs it: Button's link mode is a native
`<a href>`. Touch items need touch input in the conformance harness first.

Focus scope, not built yet: the focus manager (§5.44-45, until a component
needs arrow-key focus moves), the cancelable restore event (§5.22-23),
waiting for CSS transitions before restoring in virtual modality (§5.25),
the top-layer exception (§5.11) and shadow DOM (§5.49). Focus-within doesn't
watch for a focused control becoming disabled in Firefox (§4.7).

Typeahead is the DOM-free core only (`createTypeahead`, `findByText`); the
first collection component (Listbox) wires `keydown`. That wiring owns:
calling `handleKey(event, search)` with a `findByText` search from the
focused key over the item keys; focusing the returned key without selecting
it (§11.13) and calling `preventDefault` when `isHandled`; ignoring keydowns
whose target sits outside the collection element (§11.11) or in a text input
inside an item (§11.12: React Aria's row stops their propagation, Sous checks
the target instead); making sure an earlier Space handler, such as an item's
press, leaves Space alone while `isSearching(event.timeStamp)` (§11.7); and
not calling `handleKey` at all when typeahead is turned off (§11.14).

## Where Sous differs

These are decided; follow them rather than the catalogue.

- **No `stopPropagation`.** Components never stop propagation (AGENTS.md,
  ESLint). React Aria stops it for nested pressables (§1.53-56, 1.19) and for
  the outside `pointerdown` and `click` of the top overlay (§7.12). Sous marks
  an event as handled instead, and nested overlays coordinate through the
  global layer stack.
- **Press events.** `pressstart`, `pressend`, `press`; there is no `pressup`
  or `presschange` (§1.1, 1.13, 1.45), no `shouldCancelOnPointerExit` (§1.8)
  and no `continuePropagation` (§1.19).
- **No PressResponder** (§1.57). Instances compose through the DOM
  (design decision 11).
- **`touch-action`** is set inline on the pressable part by press, unless the
  part has an inline value of its own. React Aria injects a stylesheet and an
  attribute (§1 model), which needs a CSP nonce.
- **Modality** is one tracker per window under
  `Symbol.for('@tenphi/sous/modality/v1')`, created on first use and never
  torn down (§3.17 tears down on `beforeunload`). It still wraps
  `HTMLElement.prototype.focus`, as React Aria does (§3.7). The iOS emulated
  mouse window for hover lives in the same tracker.
- **Focus scopes are one part element** (React Aria brackets a fragment with
  sentinel spans), live while `isActive()` holds, because a closed popover
  keeps its instance. A scope's logical parent is the innermost scope around
  it in the DOM, else the active scope. Ending a scope restores focus when
  focus is still inside its (now hidden) element, not only when it fell to
  the body. Containment skips a Tab whose default was already prevented, so
  the Tab-out redirect needs no `stopPropagation`, and a `MutationObserver`
  notices a removed focused element, which gets no `focusout` in WebKit.
  The fallback for focus lost in a scope ends with the scope element itself.
- **Focus-within listens on the part element**, not through part handlers,
  so it behaves the same in both adapters while the custom-element binder
  delivers a bubbling event to the nearest part only (an open question).
- **Live announcer** (§10). Plain functions: `announce(message, options)`
  with `politeness`, `timeout` and `document` options,
  `clearAnnouncer(politeness?, document?)` and `destroyAnnouncer(document?)`.
  One container per document (React Aria has one for the global document),
  stored on its window under `Symbol.for('@tenphi/sous/announcer/v1')` and
  marked `data-sous-live-announcer`. Messages sent during the 100 ms Safari
  delay wait and go in together, in order (§10.3); `clearAnnouncer` drops
  waiting messages too. Empty messages are ignored rather than kept forever
  (§10.8). A container something else removed (a body swap) is replaced, with
  the delay again, on the next message. There is no test-environment shortcut
  (§10.13): tests use fake timers.
- **Outside presses reach their target.** React Aria stops the outside
  `pointerdown` and `click` of the top layer at the document (§7.12); Sous
  never stops propagation, so the element under the pointer still gets them,
  as with the browser's own popover light dismiss. Nested layers resolve
  Escape through `defaultPrevented` instead of `stopPropagation` (§7.1).
  The modal, popover and close-on-scroll compositions (§7.17-24) belong to
  the Popover component.
- **Parts can arrive late.** A custom element connects before its children
  are parsed, so anything that needs a part element runs through
  `partEffect()`.
- **Typeahead has no timer and no listeners.** The query expires when more
  than 1000 ms separate two keystrokes, measured with the events'
  `timeStamp` (§11.5), so there is no timeout to clear on unmount and §11.15
  is moot. `handleKey` returns `{ isHandled, key }` instead of focusing,
  calling `preventDefault` and stopping propagation (§11.7, 11.13); the
  caller does the first two and never the third.
- **Typeahead resets on every miss** (§11.6), Space included. React Aria
  keeps the query, trailing space and all, after a Space that matches
  nothing, so each Space within the next second is swallowed too. Sous still
  consumes that Space, which `isSearching()` promised to earlier handlers,
  but the next Space selects. Disabled items never match, the focused one
  included (React Aria starts at the focused key without checking it), and
  an empty query matches nothing.
- **Overlays use the top layer.** `<dialog>` and the Popover API replace
  portals, so the portal rules (§1.55, 2.11, 4.8, 11.11) become plain DOM
  containment, and a modal `<dialog>` already makes the outside inert.

## Open questions for the owner

- **Bubbling events across nested parts.** The custom-element binder hands a
  bubbling event to the nearest part above its target only (design doc,
  decision 8); React calls every ancestor part's handler. Composites will
  diverge between adapters. Proposal: deliver to every part on the path,
  innermost first, like the DOM and React.

- **Scroll lock on iOS** (§8) injects an `overscroll-behavior: contain` style
  and a second `focus()` wrapper. AGENTS.md says the only CSS Sous ships is
  `touch-action`. Allow a second behavioral rule, or find another way?
- **aria-hidden outside** (§9): is it needed beside a modal `<dialog>`, which
  makes the outside inert natively? It still matters for non-dialog modal
  popovers.
- **Top-layer marker.** React Aria keeps toasts reachable through
  `data-react-aria-top-layer` (§5.11, 6.7, 9.9). Sous needs its own marker
  when toasts arrive.

## Catalogue conventions

Markers on items:

- `[iOS Safari]`, `[Android]`, `[Firefox]`, `[Safari]`, `[macOS]`, `[Chrome]`: behaviour is specific to that platform/engine (gated by `src/utils/platform.ts` UA/platform sniffing, or a documented engine quirk).
- `[VoiceOver]`, `[TalkBack]`, `[JAWS/NVDA]`: screen-reader-specific.
- `[touch]`: needs real touch input. Playwright `hasTouch` + `page.touchscreen.tap()` covers single taps only; long-press, drag, scroll, and pinch need CDP `Input.dispatchTouchEvent` or a real device.
- `[device]`: depends on real mobile engine behaviour (iOS WebKit, Android Chrome, on-screen keyboard) that desktop Playwright WebKit/Chromium does not reproduce. Unit-test with platform mocks; verify on a device.
- `[SR]`: needs a real screen reader to verify the user-visible outcome. The event _signature_ can usually be simulated (see `[synthetic]`).
- `[synthetic]`: drive it by dispatching a hand-crafted event (`dispatchEvent(new PointerEvent(...))`). Synthetic events are untrusted (`isTrusted === false`). That matters for focus-visible, which ignores untrusted focus events, and for the JAWS/NVDA virtual-click check, which requires `isTrusted`.
- Unmarked items can be driven by Playwright mouse/keyboard or plain DOM calls.

Event phase notation: `el` = listener on the target element (React's delegated handlers act like bubble listeners on the element), `doc` = `document`, `win` = `window`, `(cap)` = capture, `(bub)` = bubble.

---

## 1. Press (`src/interactions/usePress.ts`, `textSelection.ts`, `utils.ts`, `utils/isVirtualEvent.ts`, `utils/openLink.tsx`)

### Model

Each pressable keeps one state record:

- Fields: `isPressed`, `didFirePressStart`, `isOverTarget`, `activePointerId`, `pointerType` (`mouse|pen|touch|keyboard|virtual`), `target`, `isTriggeringEvent` (re-entrancy guard), `metaKeyEvents` (macOS keyup workaround), and `disposables` (fallback timer, prevent-focus cleanup).

Element-level handlers:

- Listens for `pointerdown`, `mousedown`, `pointerup`, `pointerenter`, `pointerleave`, `click`, `keydown`, and `dragstart`.

Listeners added on `pointerdown`:

- `pointerup` and `pointercancel` on the owner `doc (bub)`.
- If the matching `pointerup` lands over the target, it also adds a `doc (cap)` `click` sentinel and an 80 ms fallback timer.

Pointer press completion:

- Completion is deferred from `pointerup` to the `click` event: `pressup`, `pressend`, then `press`, then the `onClick` prop.

Keyboard press listeners:

- Keydown is handled on `el`.
- Keyup is handled by a `doc (cap)` listener, so it still fires if focus moved or a child stopped propagation.

Event order and gating:

- Events fire as `pressstart → presschange(true) → [pressup] → pressend → presschange(false) → press`.
- `press` fires only when the end is "wasPressed" and the pressable is not disabled.

Propagation:

- Every handler stops propagation unless a press handler calls `e.continuePropagation()`. This is how nested pressables resolve.

Markup:

- Pressables get `data-react-aria-pressable`.
- A once-per-document `<style id="react-aria-pressable-style">` sets `touch-action: pan-x pan-y pinch-zoom` on them (`usePress.ts:963-991`).

### Behaviours

**Mouse / pen / generic pointer**

1. Mouse sequence (left button): pointerdown → pointerup → click. Events fire exactly in this order: `pressstart{pointerType:'mouse'}`, `presschange(true)`, `pressup`, `pressend`, `presschange(false)`, `press`, then the onClick prop. (`test/interactions/usePress.test.js:76`)
2. `pointerdown` and `mousedown` are not default-prevented, so the browser focuses the element natively on mousedown. (`usePress.test.js:99-103`, `:1868`)
3. Pressing with a non-left button (`button !== 0`) does nothing: no press events and no onClick handling. (`:992`)
4. `PressEvent.x/y` are client coordinates relative to the target's bounding rect. A keyboard press reports the element centre. (`:5329`, `:5503`)
5. `PressEvent.target` is always the pressable element, even when the pointer is on a descendant. (`:404`: target is `el.parentElement`)
6. Press, leave the element (same pointerId) → `pressend` (no `press`) + `presschange(false)`. Re-enter → `pressstart` + `presschange(true)` again. Release over the target, then click → `pressup`, `pressend`, `press`. (`:485` second half)
7. Press, leave, release outside (doc pointerup whose target is not inside) → the press is cancelled. A later pointerenter does not restart it, because `activePointerId` was cleared. (`:485` first half)
8. With `shouldCancelOnPointerExit`, leaving cancels the press entirely; re-entering does not fire `pressstart`. (`:804`)
9. A `pointercancel` on the document cancels the press: `pressend` (no `press`) + `presschange(false)`. (`:691`)
10. A `dragstart` on the target cancels the press. (`:749`)
11. If a descendant's click handler calls `stopPropagation`, the doc-capture sentinel sees the click but the pressable's onClick never runs. When the 80 ms timer fires, the press is cancelled: no `pressup`, no `press`, no onClick. (`:404`)
12. `pointerType: 'pen'` is passed through unchanged to the press events.
13. A `pointerup` over the element when it is not pressed (the press began elsewhere) fires only `onPressUp`. There is no start, end, or press. This supports drag-to-release menus. (`usePress.ts:615-625`; `:3506`)
14. With `isDisabled`, no press events and no onClick fire, and the click is `preventDefault`ed, which blocks native link navigation. (`:1356`; `usePress.ts:456`)
15. If the element becomes disabled while pressed, the press is cancelled immediately: `pressend` without `press`. (`usePress.ts:334-344`)
16. With `preventFocusOnPress`, mousedown does not move focus to the target. The browser's focus is reverted to the previously active element, and the intermediate focus/blur events are swallowed via `win/root (cap)` + `stopImmediatePropagation`. (`:1022`, `:3543`; `utils.ts:121-205`)
17. Under `preventFocusOnPress`, if nothing else was focused or the target is already active, prevent-focus is a no-op. (`utils.ts:129-131`)
18. If an `onPressUp` handler calls `target.click()` re-entrantly, no extra events fire, because the `isTriggeringEvent` guard blocks it. (`:3506`)
19. `onPressStart` with `continuePropagation()` lets the original pointerdown keep bubbling. The default is `stopPropagation`.

**Touch** (pointer events with `pointerType:'touch'`)

20. A tap (pointerdown → touchstart → pointerup → touchend → compat mouse events + focus → click) gives `pressstart{touch}` … `press{touch}` + onClick. Focus is applied by the browser at click time, not at pointerdown. (`:181`) `[touch]`
21. On pointerdown, the target's implicit pointer capture is released (`hasPointerCapture` → `releasePointerCapture`) so that `pointerleave` and `pointerenter` fire while the finger moves. (`:485`, `:678`; `usePress.ts:572-583`) `[touch]`
22. If `hasPointerCapture` returns false, `releasePointerCapture` is not called. (`:678`)
23. Long press where the browser fires no click and does not focus: 80 ms after pointerup the element is focused (with `preventScroll`) and `element.click()` is invoked, giving a full press with `pointerType:'touch'` plus onClick. (`:295`) `[touch]` `[iOS Safari]` `[Android]` `[device]`
24. A real click within 80 ms clears the fallback timer, so there is no double press (the timer is in `disposables`, run by `cancel`).
25. A touch that starts on a pressable and turns into a scroll makes the browser fire `pointercancel`, enabled by `touch-action: pan-x pan-y pinch-zoom`. The press is cancelled with no `press`. `[touch]` `[device]`
26. Double-tap-to-zoom click delay is removed by the injected `touch-action`. Pinch-zoom still works. `[touch]` `[device]`

**Keyboard**

27. Space or Enter keydown on the focused pressable → `pressstart{keyboard, key}`. The matching keyup → `pressup`, `pressend`, `press`, then onClick is called with a synthesized `MouseEvent('click')` built from the key event. (`:2621`; `usePress.ts:366-384`)
28. Accepted keys: `' '`, `'Enter'`, `'Spacebar'`, or `code === 'Space'`. (`usePress.ts:1028`)
29. A keydown with `repeat: true` never starts a press. A repeated keydown, then keyup elsewhere, produces no events. (`:3296`)
30. Keydown on A, then focus moves, then keyup on another element → `pressend` (no `pressup`, no `press`, no onClick). State resets, so the next Space on A works normally. (`:3176`)
31. Keyup is caught on `doc (cap)`, so a child calling `stopPropagation` on keyup does not strand the press. (`usePress.ts:409-429`)
32. Enter/Space on a div or a `button[type=button]` has keydown and keyup default-prevented.
    - Not prevented: `button[type=submit|reset]`, `<a href>`, inputs where the key is a valid activation key, and Enter on macOS (any element). (`usePress.ts:1148-1179`)
33. `<input type=checkbox|radio>`:
    - Enter → no press and no `preventDefault`, so implicit form submission still happens.
    - Space → press, and the default is not prevented, so the native toggle happens. (`:3317`)
34. If the pressable element itself is a text `<input>`, a `<textarea>`, or contentEditable, the keyboard never triggers a press. (`usePress.ts:1029-1034`)
35. `<input type=button|submit|reset|image|file|color|range>` accepts both Enter and Space and never `preventDefault`s. (`usePress.ts:1193-1198`)
36. Modifier flags (shift, ctrl, meta, alt) are copied onto every press event, for both keyboard and pointer. (`:880`, `:2980`)
37. `[macOS]` Holding Meta suppresses keyup for other keys.
    - Sequence: keydown Meta → keydown Enter{metaKey} → keyup Meta.
    - On the Meta keyup, synthetic keyups are dispatched for the recorded keys, so the full press completes with `key:'Enter'` and metaKey. (`:3075`; `usePress.ts:435-447, 529-538`)

**Links**

38. `<a href>` with no role:
    - Space does nothing (no press events).
    - Enter → full press.
    - The native click (Enter's default action) is not double-handled, and navigation is left to the browser. (`:2702`)
39. An element with `role="link"`: only Enter presses; Space is ignored. (`:2799`)
40. `<a href role="button">`:
    - Space presses.
    - On keyup, usePress opens the link itself with `openLink(target, modifiers)`, because the browser only activates links on Enter.
    - A hidden symbol on the event ensures a single open when several usePress instances share the element. (`:2891`; `usePress.ts:512-525`)
41. `[Safari]` `[macOS]` (non-iPad): `openLink` dispatches a `keydown` with `keyIdentifier:'Enter'` instead of a `click`, because WebKit ignores modifier keys on synthetic clicks. On all other platforms it dispatches a `MouseEvent('click', {detail:1, modifiers})`. (`openLink.tsx:109-127`)
42. While `openLink` runs (`openLink.isOpening`), the dispatched click or keydown is ignored by usePress's onClick and by modality tracking. (`usePress.ts:454`; `useFocusVisible.ts:88,105`)
43. Client-side routing applies only when all of these hold:
    - `target` is absent or `_self`,
    - the link is same-origin,
    - it has no `download` attribute,
    - none of meta, ctrl, alt, or shift is held.

    The target is read with `getAttribute('target')`, because Firefox defaults `link.target` to `_parent` inside iframes. (`openLink.tsx:92-104`) `[Firefox]`

44. Non-anchor link elements (`data-href`, etc.) open by creating a temporary `<a>` inside the target, dispatching on it, then removing it. (`openLink.tsx:132-157`)

**Virtual clicks** (screen readers, `element.click()`, keyboard-activated native clicks)

45. A click with `detail === 0` and no `pointerType`, on a pressable that is not pressed, fires `pressstart`, `pressup`, `pressend`, `press` (all `pointerType:'virtual'`), then onClick, synchronously. Note that `pressup` comes before `pressend`. (`:3429`, `:1034`) `[synthetic]`
46. `element.click()` from script is treated as a virtual press.
47. A pointerdown with `width === 0 && height === 0` (non-Android) is treated as a screen-reader event: it and its pointerup are ignored, and the following click produces a virtual press. (`:1034`; `usePress.ts:548-555`) `[VoiceOver]` `[iOS Safari]` `[synthetic]`
48. `[Android]` A zero-size pointerdown is NOT treated as virtual and gives a normal mouse press. (`:1126`)
49. `[Android]` `[TalkBack]` A pointerdown with `width:1, height:1, pressure:0, detail:0, pointerType:'mouse'` is virtual. (`:1220`; `isVirtualEvent.ts:49-56`) `[synthetic]`
50. On a non-Android platform, the same `width:1/height:1/pressure:0` pointer is a real press. Safari always reports `pressure:0` (WebKit 206216). (`:1317`)
51. `[JAWS/NVDA]` `[Firefox]` A trusted click with `pointerType === ''` is virtual. (`isVirtualEvent.ts:27-30`) `[SR]`
52. `[Android]` `[TalkBack]` A click that carries a `pointerType` is virtual only if `buttons === 1`. (`isVirtualEvent.ts:35-37`) `[SR]`

**Nested pressables, portals, responders**

53. With nested pressables, a click on the inner one fires its press events, and the outer receives none. The default stops propagation. This holds for the mouse, pointer, and touch paths. (`:3923`)
54. If the inner handlers call `continuePropagation()`, the outer also receives `pressstart`, `pressup`, `pressend`, and `press`. (`:3949`)
55. Events whose target is not a DOM descendant of the pressable (React portal bubbling) are ignored, e.g. pressing inside a dialog opened from a pressable. (`:4019`) For Sous: ignore events whose target is outside the element's DOM subtree.
56. Any left `click` or `mousedown` that reaches a pressable has its propagation stopped, even when no press was in progress. (`usePress.ts:491-493, 611`)
57. PressResponder: press props given to an ancestor responder are merged (not overwritten) into the nearest descendant pressable. The ref is forwarded to it. A warning is logged if no pressable registers. (`test/interactions/PressResponder.test.js:20-85`) Overlays reset this context (`ClearPressResponder`, `src/overlays/Overlay.tsx:86`).

**Text-selection suppression**

58. Non-iOS:
    - pointerdown/touchstart → inline `user-select: none` on the pressed element only (not the page).
    - Press end or cancel → the previous inline value is restored.
    - If the `style` attribute ends up empty, it is removed. (`:1425`, `:3663`, `:3777`)
59. Non-iOS: if `user-select` was changed to something else during the press, it is kept on release. Unrelated inline style changes made during the press survive. (`:3839`, `:3871`)
60. `[iOS Safari]` A press start sets `document.documentElement.style.webkitUserSelect = 'none'` on the whole page, because long-press selects neighbouring text. (`:3589`; `textSelection.ts:17-46`) `[touch]`
61. `[iOS Safari]` The page value is restored 300 ms after press end, and then only after `runAfterTransition`, i.e. once all running CSS transitions finish. It is restored only if the value is still `none`. (`:3625`; `textSelection.ts:56-83`)
62. `[iOS Safari]` Pressing a second element during the 300 ms restore window keeps `none`. Restore happens 300 ms after the last release. (`:3693`, `:3735`)
63. `[iOS Safari]` If the pressable unmounts mid-press, the page's user-select is still restored. (`:3817`; `usePress.ts:993-1005`)
64. `allowTextSelectionOnPress` disables all user-select changes.

### Edge cases and browser bugs worked around

- Press is fired from `click`, not `pointerup`, which avoids problems when the DOM mutates between pointerup and click (RSP #1513, Chromium 40732224) (`usePress.ts:663-666`).
- iOS and Android skip the click after a long press. Hence the 80 ms fallback, which must be ≥ 32 ms because iOS delays clicks on non-form elements for hover emulation (`usePress.ts:667-683`).
- Click tracking uses a `doc (cap)` sentinel, so a child's `stopPropagation` is detected rather than hanging the press (`usePress.ts:684-687`).
- Safari fires no `pointercancel` on drag start (`usePress.ts:706`).
- Pointer capture is released so touch can leave the target (`usePress.ts:572-583`).
- `touch-action: manipulation` was rejected: in Safari it suppresses `pointercancel` on scroll (WebKit 240917) (`usePress.ts:980-982`).
- VoiceOver iOS pointer events have wrong coordinates and target (WebKit 222627/223202), so they are ignored (`usePress.ts:548-551`).
- TalkBack sometimes reports 1×1 pointers (`isVirtualEvent.ts:43-48`).
- macOS drops keyup while Meta is held (Chromium 1393524, WebKit 55291, Mozilla 1299553) (`usePress.ts:435-441`).
- On macOS, Enter is never `preventDefault`ed ("contextmenu shortcut") (`usePress.ts:1165-1168`).
- Hit-testing via rect overlap with touch radius (`isOverTarget`, `usePress.ts:1108-1146`) exists only in the TouchEvent fallback, which runs only in JSDOM. With pointer events, "over target" comes from `pointerenter`/`pointerleave` plus the pointerup target.
- `preventFocus` walks up to the nearest focusable ancestor (what the browser actually focuses). It listens on the shadow root when the target is inside one, and re-focuses the old element on `focusin` (`utils.ts:121-205`).
- Non-iOS user-select is per element because page-level toggling was slow (RSP #1609, `textSelection.ts:27-29`).

### Global singletons

- `textSelection.ts:34-36`: `state` (`default|disabled|restoring`), `savedUserSelect`, and `modifiedElementMap`. iOS toggles a page-wide style, so overlapping presses on different elements must share one state machine to avoid races.
- `openLink.isOpening` (a function property). It lets usePress and useFocusVisible ignore the events openLink itself dispatches.
- One injected `<style>` per document (`STYLE_ID`).
- `utils.ts:113` `ignoreFocusEvent`. It is set while `preventFocus` is active, so modality tracking ignores the transient focus/blur.

---

## 2. Hover (`src/interactions/useHover.ts`)

### Model

Per-instance state:

- `{isHovered, pointerType, target}`.

Element listeners:

- `pointerenter` / `pointerleave` on `el`.

Global listeners:

- On hover start, a `doc (cap)` `pointerover` listener ends the hover if the pointer is over anything outside the element. It is removed on hover end.

Touch-emulation filter:

- A module-level flag `globalIgnoreEmulatedMouseEvents` is set for 500 ms after any `doc (bub)` `pointerup` with `pointerType:'touch'`.
- That `doc` listener is reference-counted across all hover instances (`hoverCount`).

Touch never hovers.

### Behaviours

1. Mouse enter → `hoverstart{pointerType:'mouse', target:el}`, `hoverchange(true)`. Leave → `hoverend`, `hoverchange(false)`. (`test/interactions/useHover.test.js:80`)
2. Entering through or over a child still reports `target` as the hook's element. (`:117`)
3. `pointerType:'touch'` enter/leave produces no hover events and no hovered state. (`:155`, `:257`, `:558`) `[touch]`
4. A pen (`pointerType:'pen'`) hovers like a mouse; only `touch` is excluded. (`useHover.ts:111`)
5. For 500 ms after any touch `pointerup` in the document, a `pointerType:'mouse'` pointerenter is ignored. This is the iOS emulated mouse hover. (`:173`) `[touch]` `[iOS Safari]`
6. After the 500 ms window, a real mouse hover works normally. (`:198`)
7. `isDisabled` → no events. (`:58`)
8. Becoming disabled while hovered → `hoverend` immediately. (`:268`; `useHover.ts:230-237`)
9. If the hovered element's content is removed under the pointer, no `pointerleave` arrives. The next `pointerover` on an element outside → `hoverend`. (`:320`)
10. A second `pointerenter` while already hovered is a no-op, so there is no duplicate `hoverstart`.
11. A `pointerleave` whose target is not inside the element (portal bubbling) is ignored. (`:646`)

### Edge cases and browser bugs

- iOS fires `pointerenter` twice, once as `touch` and once as `mouse` (WebKit 214609, `useHover.ts:35-37`).
- The 500 ms timeout exists so that desktop touch screens do not permanently block mouse hover (`:44-50`).
- After an element is removed, Chrome fires `pointerover` on the new target immediately; Safari and Firefox fire it only after a 1 px move (`useHover.ts:122-125`). Tests should move the mouse by 1 px.

### Global singletons

- `globalIgnoreEmulatedMouseEvents`. Emulated events can land on a different element than the touch, so filtering must be global.
- `hoverCount`. It reference-counts the single `doc` pointerup listener.

---

## 3. Focus-visible and input modality (`src/interactions/useFocusVisible.ts`, `src/focus/useFocusRing.ts`)

### Model

Module-level state:

- `currentModality` (`null|keyboard|pointer|virtual`).
- `currentPointerType`.
- `hasEventBeforeFocus`.
- `hasBlurredWindowRecently`.
- `changeHandlers: Set`.
- A per-`Window` setup map.

Listeners, installed once per window at module load or on first use:

- `doc (cap)`: `keydown`, `keyup`, `click`, `invalid`, `pointerdown`, `pointermove`, `pointerup`.
- `win (cap)`: `focus` (registered on the window so it runs before framework listeners).
- `win (bub)`: `blur`.
- `beforeunload`: tears everything down.

Programmatic focus:

- `HTMLElement.prototype.focus` is patched (with `defineProperty`) so that programmatic `focus()` marks "event before focus" and does not change modality.

Visibility rule:

- `isFocusVisible()` is `modality !== 'pointer'`, so the initial `null` counts as visible.

Notifications:

- Change handlers are notified on keyboard, pointerdown/mousedown, and unexplained focus. They are not notified on pointermove/pointerup or virtual clicks.

### Behaviours

1. An unmodified keydown or keyup anywhere → modality `keyboard`, and handlers are called with `true`. Each keydown and each keyup notifies. (`useFocusVisible.test.js:439`: key a, a, Esc, Esc, then mousedown gives `[true,true,true,true,false]`)
2. Keys with meta, ctrl, or (non-Mac) alt held, and the bare keys Control, Shift, and Meta, do not change modality. `[macOS]`: Alt/Option combinations DO switch to keyboard. (`useFocusVisible.ts:74-84`)
3. pointerdown/mousedown → `pointer`, and handlers are called with `false`. mouseup does not notify. (`:439`)
4. `pointermove` and `pointerup` set modality to `pointer` silently, without notifying.
   - Consequence: Tab to element A (ring visible), move the mouse without clicking, then programmatically focus B. B's ring is not visible, while A's subscription saw no change. (`useFocusVisible.ts:95-102`)
5. A virtual click (`detail 0`, no pointerType) → modality `virtual` (silent). (`useFocusVisible.ts:104-110`)
6. A trusted focus event with no preceding key/pointer event and no programmatic `focus()` → modality `virtual`, and handlers are notified. Examples: iOS form next/previous buttons, screen-reader cursor focus. (`useFocusVisible.ts:139-145`) `[iOS Safari]` `[VoiceOver]` `[device]`
7. `el.focus()` from script does not change modality, thanks to the prototype patch. (`useFocusVisible.ts:190-205`)
8. Keyboard navigation, then switching browser tabs away and back: the browser's restored focus keeps modality `keyboard`, so the ring stays visible. (`:132`)
9. Clicking, then switching tabs away and back: modality stays `pointer`, so there is no ring. (`:142`)
10. `[Safari]` On tab return, the window/element focus pair is fired twice. The ring state is still preserved, because a window-level focus re-arms `hasBlurredWindowRecently`. (`:153`, `:163`; `useFocusVisible.ts:121-130`)
11. Window blur, then focus (switching apps or windows): same as 8 and 9. (`:174`, `:184`)
12. Untrusted focus events, and focus events targeting `document` or `window`, never change modality. Firefox fires extra window/document focus events on the first click into an iframe. (`useFocusVisible.ts:132-137`) `[Firefox]`
13. A form `invalid` event (capture), followed by focus moving within the same microtask (a forms library focusing the first invalid field) → modality `keyboard`. (`useFocusVisible.ts:162-172`)
14. Text-input subscribers are not notified for keyboard events other than Tab and Escape. A subscriber is a text input if it passes `isTextInput`, or if the active element is a text input, textarea, or contentEditable. (`:455` gives `[true,true,false]`; `useFocusVisible.ts:376-402`)
15. `useFocusRing` subscribes to changes only while its element is focused. Unfocused rings receive no callbacks. (`:500`)
16. `autoFocus` → the initial focus-visible state is `true` regardless of modality. (`useFocusVisible.ts:409`)
17. iframes: `addWindowFocusTracking(elInIframe)` installs the same listeners in the iframe's window. It returns a teardown that also restores the original `focus`. It is torn down automatically on `beforeunload`. (`:231-330`)
18. Pointer down then Esc inside an iframe that has its own tracking → the ring shows. (`:417`)
19. Setup must not throw when `HTMLElement.prototype.focus` is an accessor-only property, which `@testing-library/user-event` creates. (`:212`)
20. While `preventFocus` is active (`ignoreFocusEvent`), focus and window-blur events are ignored. (`useFocusVisible.ts:113,152`)
21. `setInteractionModality(m)` notifies handlers with a null event; `pointer` maps to pointerType `mouse`. (`useFocusVisible.ts:328-332`)
22. Events dispatched by `openLink` (`isOpening`) are ignored. (`useFocusVisible.ts:88,105`)
23. During SSR, `useInteractionModality` returns `null`. (`useFocusVisible.ts:357`)

### Edge cases and browser bugs

- Control/Shift keydowns arrive when keyboard-navigating back to a tab (`useFocusVisible.ts:75`).
- Safari double focus pair on tab return (RSP #7468, `useFocusVisible.test.js:84-112`).
- The focus listener is on `window (cap)` so it runs before framework handlers (`:213-215`).
- On page load, modality is `null`, so `isFocusVisible()` returns true. An autofocused element on load will show a ring.

### Global singletons

- All of the state listed above, plus the patched `HTMLElement.prototype.focus`. Modality is a property of the user, not of a component, and it must be known before any component's focus handler runs.
- The per-window map supports multiple documents (iframes).

---

## 4. Focus-within (`src/interactions/useFocusWithin.ts`, `utils.ts:37-111`)

### Model

Per-instance state:

- `isFocusWithin`.

Element listeners:

- `focus` / `blur`, which in React are delegated `focusin`/`focusout` (bubble).

Focus-in handling:

- Focus-in fires only if the event target is inside the element and is actually `document.activeElement`.

Focus-out handling:

- Focus-out fires only when `relatedTarget` is outside the element.

Global listeners:

- While focused-within, a `doc (cap)` `focus` listener synthesizes a blur when focus lands outside without a native blur, e.g. when the focused node was removed.

Disabled elements:

- A per-focus `MutationObserver` on the focused `<button|input|select|textarea>` watches `disabled` and dispatches `blur`/`focusout`, for engines that do not fire one.

### Behaviours

1. Focusing the element itself or any descendant → `onFocusWithin(e)` + `onFocusWithinChange(true)`, exactly once. (`useFocusWithin.test.js:27`, `:54`)
2. Moving focus between descendants → no blur/focus pair, because `relatedTarget` is inside.
3. Focus moving outside, or lost (`relatedTarget` null) → `onBlurWithin` + `onFocusWithinChange(false)`.
4. `isDisabled` → no handlers at all. (`:89`)
5. Events bubble to ancestor focus handlers by default. An inner handler calling `stopPropagation()` prevents the outer one from seeing them. (`:113`, `:140`)
6. Focus a button inside, the button removes itself (no blur fires), then focus an outside input → synthesized `blur` with `target` = the container and `relatedTarget` = the input, plus `change(false)`. (`:191`)
7. A focused descendant button that gets `disabled` → `onBlurWithin` fires, asynchronously after the MutationObserver. (`:167`) `[Firefox]` is the engine named as not firing focusout.
8. Focus events bubbling from portal children (target not a DOM descendant) are ignored. (`useFocusWithin.ts:54-57`)
9. If an earlier handler already moved focus elsewhere (the target is no longer active), the focus event is ignored. (`useFocusWithin.ts:89-94`)

### Edge cases and browser bugs

- React does not fire onBlur for disabled elements (facebook/react#9142).
- Per the code comment, Firefox does not fire focusout when the focused element becomes disabled, while other browsers do. `focusout` fires before the MutationObserver callback, so there is no double blur (`utils.ts:60-63`).
- Browsers fire no blur when the focused element is removed (`useFocusWithin.ts:106-108`).

### Global singletons

- None. The `doc` listener is per instance.

---

## 5. Focus scope (`src/focus/FocusScope.tsx`, `focusSafely.ts`, `utils/isFocusable.ts`, `utils/isElementVisible.ts`, `utils/runAfterTransition.ts`)

### Model

Scope membership:

- A scope is the list of top-level DOM nodes between two hidden sentinel `<span>`s (`FocusScope.tsx:205-207`). Membership is DOM containment in any of those nodes.

Global state:

- `activeScope`: the innermost scope that last received focus.
- `focusScopeTree`: the logical parent/child tree, independent of DOM, so portaled children count as children.

Per-scope state:

- `nodeToRestore`: captured at render time, before children autofocus.
- `focusedNode`: the last focused element inside, used by containment.
- A pending `rAF`.

Containment listeners (`contain`):

- `doc (bub)` `keydown` for Tab.
- `doc (bub)` `focusin`, plus `focusin` on each scope node.
- `focusout` on each scope node, which schedules an rAF check.

Restore listeners (`restoreFocus`, not `contain`):

- `doc (cap)` `keydown` for Tab-out.
- `focusin` for active-scope tracking.

Plain scopes:

- `focusin` only, to track the active scope.

Restore on unmount:

- Unmount restore runs in the layout cleanup and then an rAF.
- It dispatches a cancelable, bubbling `react-aria-focus-scope-restore` event on the node before focusing it.

Focusable/tabbable definitions:

- Focusable/tabbable is selector-based, then filtered: not `inert`, and visible (`checkVisibility({visibilityProperty:true})`, not inside `[data-react-aria-prevent-focus]`).

### Behaviours

**Containment**

1. In a `contain` scope, Tab and Shift+Tab cycle through its tabbable elements and wrap at both ends. (`test/focus/FocusScope.test.js:52`, `:89`)
2. Tab order skips:
   - `tabindex=-1`, `disabled`, and `hidden`,
   - `display:none`, `visibility:hidden`, and `visibility:collapse`,
   - `contenteditable="false"`.

   It includes `contenteditable` and `contenteditable="plaintext-only"`. (`:130`, `:174`, `:235`)

3. Tab with Alt, Ctrl, or Meta, or during IME composition (`isComposing`), is not intercepted. (`:215`; `FocusScope.tsx:354-364`)
4. Tabbing into an `<input>` inside a contained scope selects all of its text: tab, then Delete, empties it. (`:402`)
5. A contained scope with no tabbable element swallows Tab: `preventDefault`, nothing focused. (`FocusScope.tsx:388-394`)
6. With two sibling `contain` scopes, programmatically focusing an element of the inactive one pulls focus back to the last focused node of the active one. (`:235` end)
7. Focus entering from outside (e.g. Tab from the browser address bar) → restored to the last focused element in the scope, or the first tabbable. (`:291`)
8. Focus lost to `<body>` (element `.blur()`, mousedown on a non-focusable backdrop): after one rAF, the element that lost focus is re-focused if still connected, otherwise the first tabbable. (`:335`)
9. The re-focus in 8 uses `preventScroll`, so a tall modal in a scrollable overlay does not jump when the backdrop is pressed. (`react-aria-components/test/Modal.browser.test.tsx:83`) Chrome and Safari move focus to body on backdrop mousedown; Firefox does not.
10. Clicking into an `<iframe>` inside the scope is allowed. The rAF check reads `document.activeElement` rather than `relatedTarget` (which is null). (`:373`)
11. Focus may always move into `[data-react-aria-top-layer]` elements (toasts) even while contained. (`FocusScope.tsx:493-496`)
12. `[Android]` `[Chrome]` `[TalkBack]` The blur re-focus is skipped when modality is `virtual` or `null`. This means focus _can_ leave a contained modal with TalkBack. (`FocusScope.tsx:428-433`) `[SR]` `[device]`
13. Turning `contain` off cancels any pending rAF re-focus. (`FocusScope.tsx:342-348`)
14. Unmounting during the blur rAF window leaks no rAF. (`:2516`)
15. When the focused element is removed and no tabbable element remains, the first _focusable_ one receives focus (e.g. a `tabIndex=-1` dialog). (`:822`)

**Restore**

16. A scope mounts while X is focused, then unmounts with focus inside → after an rAF, X is focused again. (`:427`)
17. `nodeToRestore` is captured during render, so a child with native `autoFocus` does not become the restore target. (`:463`)
18. Restore happens only if focus was "lost to body" by the time the rAF runs. If something else took focus deliberately, nothing happens.
19. If, at unmount, focus is outside the scope (the user moved it, e.g. clicked another button), there is no restore. (`:871`)
20. A dynamically added child of the scope that holds focus at unmount still triggers restore. (`:567`)
21. If `nodeToRestore` is disconnected:
    - walk up ancestor scopes' `nodeToRestore` values,
    - else focus the first tabbable/focusable element in the nearest still-mounted ancestor scope (skipping empty scopes),
    - else leave focus on body without throwing. (`:741` it.each, `:2100`)
22. The restore event can be `preventDefault`ed by an ancestor, which cancels focusing. (`:937`)
23. The restore event does not escape out of an enclosing FocusScope: each scope's top-level nodes stop its propagation. (`:970`)
24. Closing scope A when another scope's `nodeToRestore` lies inside A → that scope inherits A's `nodeToRestore`. Example: Menu → Dialog → close returns focus to the Menu trigger. (`:2146`; `FocusScope.tsx:1060-1073`)
25. Restore uses `focusSafely`. In `virtual` modality it waits for running CSS transitions, then focuses only if focus did not move (or fell to body) in the meantime. (`focusSafely.ts:24-49`) `[VoiceOver]` `[iOS Safari]`
26. Restore skips elements that are no longer connected (`focusSafely` early return). (`test/interactions/focusSafely.test.js:31`)

**Tab order leaving a restoreFocus scope (portal-friendly)**

27. In a `restoreFocus` scope (not contain), Tab from the last element goes to the next tabbable _after the trigger_ (`nodeToRestore`), not to the next in DOM order. (`:606`, `:499`)
28. Shift+Tab from the first element goes to the tabbable _before the trigger_. (`:645`, `:533`)
29. If the scope immediately follows the trigger in the DOM, its own elements are skipped when computing "next after trigger". (`:679`)
30. A scope without `restoreFocus` keeps native DOM tab order. (`:718`)
31. If `nodeToRestore` is `<body>` or disconnected, it is cleared and native DOM order applies. (`:2069`)
32. If nothing tabbable exists after the trigger:
    - when the trigger is in no scope, the focused element is blurred, so focus goes to the browser chrome;
    - otherwise the trigger itself is focused (menu-in-popover → Tab closes back to the menu trigger). (`FocusScope.tsx:733-744`)

**Auto-focus**

33. `autoFocus` focuses the first tabbable descendant on mount, falling back to the first focusable. (`:1007`)
34. If something inside is already focused (native `autoFocus`), nothing is done. (`:1025`)
35. Auto-focus happens on mount only; toggling the prop later does nothing. (`FocusScope.tsx:564-579`)

**Nested scopes and active scope**

36. Focusing a child scope makes it active, even when it is portaled outside the parent's DOM. (`:1719`)
37. A `contain` child inside a `contain` parent locks Tab inside the child, whether it is a direct child or nested deeper in the DOM. (`:1761`, `:1811`)
38. A child scope without `contain` (with or without `restoreFocus`): Tab flows through the child and wraps within the parent's containment. (`:1850`, `:1890`)
39. While a contained child is active, focusing an element of the ancestor scope is blocked; you can move into children, but not out. (`:1930`)
40. Unmounting nested contained scopes makes the nearest surviving ancestor active, and its containment applies. (`:1930`)
41. A portaled child scope without `contain` under a contained parent: both parent and child elements can be focused freely. (`:2001`)
42. A portaled child scope _with_ `contain` locks focus in the child. (`:2034`)
43. A new scope mounted outside the active scope (e.g. a dialog opened from a menu) is re-parented under the active scope in the tree. (`FocusScope.tsx:98-118`)

**Focus manager and tabbable rules**

44. `focusNext`/`focusPrevious`/`focusFirst`/`focusLast` accept `{from, tabbable, wrap, accept}`. `wrap` loops around, `tabbable` restricts to tabbables, and `accept(node)` filters. (`:1041`-`:1395`)
45. In the scope's focus manager, `from` is only the starting node. Tree order then visits `from`'s own descendants first: mousedown on group 2 → `focusNext({from: group2, tabbable})` focuses the first tabbable _inside_ group 2 (item3), and group 1 focuses item2. (`:1154`, `:1349`)
    - The exported `getFocusableTreeWalker(root, {from})` behaves differently: it rejects `from`'s descendants. (`FocusScope.tsx:860-863`; the scope manager does not pass `from` to it, `:229`)
46. Radio groups:
    - Only the checked radio of a same-`name` group is tabbable.
    - If none is checked, a radio is skipped when the walker's current node is a same-name radio. Consecutive unchecked radios collapse to the first, but a same-name radio after an intervening element is reachable again. (`:1434` expected order: button1, radio0, button2, radio3, button3, radio5, button4)
    - A group outside a `<form>` is resolved via `document.querySelectorAll` by name. (`:1500`, `:1629`)
47. A form with a single radio does not crash (`namedItem` returns an Element, not a RadioNodeList). (`:1692`; `FocusScope.tsx:313-325`)
48. A closed `<details>` exposes only its `<summary>`; `inert` ancestors exclude descendants. (`isElementVisible.ts:42-52`, `isFocusable.ts:50-61`)
49. Shadow DOM: containment, nested shadow roots, restore across the shadow boundary, and autofocus all work. (`:2241`-`:2415`)

### Edge cases and browser bugs

- Firefox does not move focus back into the dialog without the rAF re-focus (`FocusScope.tsx:423`).
- Android Chrome TalkBack enters an infinite focus-coercion loop (issuetracker 384844019, `:428-430`).
- Browsers fire no blur on removal, so restore checks `activeElement === body` (`:779-791`).
- The tree is cloned before the restore rAF, because nodes are removed during unmount (`:787-789`).
- Virtualized collections reuse DOM nodes, which is why the restore event is customizable (`:832-834`).
- `checkVisibility` is used when available (`isElementVisible.ts:15-16,57-62`).

### Global singletons

- `activeScope`. Only one scope may own containment at a time, and the decisions span portals.
- `focusScopeTree`. The parent/child relation follows logical nesting (portals), not DOM order. Restore needs ancestry after nodes unmount.
- The `runAfterTransition` registry: `transitionsByElement` and `transitionCallbacks`, fed by `doc` `transitionrun`/`transitionend` and per-element `transitioncancel`. It tracks per property, because Chrome may fire both `transitionend` and `transitioncancel`.

---

## 6. Interact outside (`src/interactions/useInteractOutside.ts`)

### Model

Per-instance state:

- `isPointerDown`.

Listeners, registered in an effect on the ref element's owner document:

- `doc (cap)` `pointerdown` and `doc (cap)` `click`.

Sequence:

- A valid outside pointerdown sets `isPointerDown` and calls `onInteractOutsideStart`.
- A subsequent valid outside click calls `onInteractOutside`.

"Outside" means:

- `!event.composedPath().includes(ref.current)`,
- left button only,
- target still in the document,
- not inside `[data-react-aria-top-layer]`.

### Behaviours

1. pointerdown, pointerup, click on `document.body` → `onInteractOutside` fires once. The same sequence inside the ref → nothing. (`useInteractOutside.test.js:40`)
2. `onInteractOutsideStart` fires at pointerdown, before the click. (`useInteractOutside.ts:44-51`)
3. Non-left buttons (`button > 0`) are ignored for both pointerdown and click. (`:56`)
4. A pointerdown that happened before the hook mounted, followed by a click after mount → no fire. (`:71`)
5. pointerdown inside, drag, release outside → no fire: `isPointerDown` was never set.
6. A target removed from the document by the time of the event (e.g. a menu item that unmounts on pointerdown) → ignored. (`useInteractOutside.ts:126-130`)
7. A target inside `[data-react-aria-top-layer]` (toasts) → ignored. (`:131-134`)
8. Shadow DOM: clicking inside or on the popover inside an open shadow root does not fire; clicking outside the popover, or outside the shadow DOM entirely, fires. (`useInteractOutside.shadow.test.js:56-96`)
9. Elements added dynamically outside count as outside. (`.shadow.test.js:151`)
10. `isDisabled` → no listeners are attached. (`:167`)
11. iframes: the listeners attach to the iframe document that owns the ref. (`:196-440`)
12. Keyboard and focus movement never count as interact-outside (pointer only).

### Edge cases and browser bugs

- `click` is used instead of `pointerup` because of an Android Chrome issue (Chromium 40732224) `[Android]` (`useInteractOutside.ts:77-79`).
- Capture phase "fixed combobox" (`:77`).
- `composedPath` sees into open shadow roots only; closed roots cannot be detected (`:141-145`).

### Global singletons

- None in the hook. Overlay ordering lives in `useOverlay`, see §7.

---

## 7. Dismissable layers (`src/overlays/useOverlay.ts`, `useModalOverlay.ts`, `usePopover.ts`, `Overlay.tsx`, `DismissButton.tsx`, `useCloseOnScroll.ts`, `interactions/useKeyboard.ts`, `createKeyboardShortcutHandler.ts`)

### Model

The overlay stack:

- The module-level `visibleOverlays` array is a stack of refs. A ref is pushed when `isOpen` and spliced out on close or unmount.

Escape:

- Handled by `keydown` on the overlay element (bubble), through the `useKeyboard` shortcuts map `{Escape}`.
- It only fires when focus is inside the overlay.
- It closes only if this overlay is the top of the stack.

Outside press:

- Uses `useInteractOutside`, which is enabled only when `isDismissable && isOpen`.
- At pointerdown, the current top overlay is remembered.
- The top overlay stops propagation of both the outside pointerdown and the click at `doc (cap)`.
- It closes only if it was the top at pointerdown.

Blur close:

- `shouldCloseOnBlur` uses focus-within.

Modal and popover composition:

- Modal = useOverlay + scroll lock + `ariaHideOutside(..., {shouldUseInert:true})` + FocusScope `restoreFocus contain` via `Overlay` (contain is dropped while exiting).
- Popover: modal by default; non-modal variants use `keepVisible`.

### Behaviours

1. Escape keydown inside an open overlay → `onClose`, plus `preventDefault` and `stopPropagation`. (`test/overlays/useOverlay.test.js:126`)
2. Escape closes even when `isDismissable` is false. (`:134`)
3. `isKeyboardDismissDisabled` → Escape is not handled: no `preventDefault`, and it propagates. (`useOverlay.ts:131-137`; `createKeyboardShortcutHandler.ts:205-215`)
4. Auto-repeat Escape (`repeat:true`) and Escape during IME composition are ignored. Holding Escape closes only one layer. (`useKeyboard.ts:55-61`)
5. Escape with modifiers (e.g. Shift+Escape) does not match the shortcut and is not handled. (`createKeyboardShortcutHandler.ts:165-170, 201-204`)
6. Escape pressed while focus is outside the overlay → nothing.
7. With two overlays open, Escape inside the top one closes only it, because the stack-top check applies. (`useOverlay.ts:94-98`)
8. `isDismissable` → an outside pointerdown + click calls `onClose`. This holds for the mouse, pointer, and touch paths. (`:55`)
9. `shouldCloseOnInteractOutside(target)` returning false → no close; returning true → close. (`:64`, `:80`)
10. Not dismissable → an outside press does not close. (`:96`)
11. Two dismissable overlays, outside press → only the most recently opened closes. Once it unmounts, the next outside press closes the first. (`:105`)
12. When the overlay is top, the outside `pointerdown` and `click` are `stopPropagation`ed at `doc (cap)`.
    - The element under the pointer therefore receives no pointerdown or click.
    - `mousedown`, focus change, and `pointerup` are not stopped.
      (`useOverlay.ts:100-126`)
13. If the top overlay changed between pointerdown and click, the overlay that was top at pointerdown is the one that closes. (`useOverlay.ts:102,121-125`)
14. `shouldCloseOnBlur` (popovers): focus moving to an element outside → `onClose`. (`useOverlay.ts:148-171`)
15. `shouldCloseOnBlur` with `relatedTarget === null` (switching tabs, the VoiceOver/Chrome Ctrl+Option+Arrow bug) → no close. (`useOverlay.ts:151-155`) `[VoiceOver]` `[Chrome]`
16. `shouldCloseOnBlur` with focus moving into a child FocusScope (e.g. a menu inside the dialog, or a portaled submenu) → no close. (`useOverlay.ts:157-162`)
17. A popover opened from a modal, then an outside click: the popover closes and the modal stays open. (`react-aria-components/test/Dialog.test.js:727`)
18. Modal popover (default):
    - `isDismissable`, `shouldCloseOnBlur`,
    - scroll locked,
    - outside content made `inert`. (`usePopover.ts:99-139`)
19. Non-modal popover:
    - not outside-dismissable (except submenus),
    - no scroll lock,
    - registered with `keepVisible` so a parent modal's aria-hide observer does not hide it,
    - closes when an ancestor of the trigger scrolls. (`usePopover.ts:105,122,128-139`)
20. Close-on-scroll ignores scroll events whose target is an `<input>` or `<textarea>` (caret scrolling in a combobox) and scrolls in regions not containing the trigger. (`useCloseOnScroll.ts:44-58`; `test/overlays/useOverlayTrigger.test.js:38-66`)
21. A modal or popover that is entering (animating in) uses `keepVisible` instead of hiding outside, so a parent modal does not hide it. (`useModalOverlay.ts:88-92`)
22. `Overlay` wraps content in `FocusScope restoreFocus contain={shouldContainFocus||contain && !isExiting}`. During the exit animation focus may leave. (`Overlay.tsx:76-80`)
23. DismissButton is a visually hidden `<button tabIndex=-1>` labelled "Dismiss" (localized) that calls `onDismiss`. It lets screen-reader users close overlays without Escape. (`DismissButton.tsx:30-46`) `[SR]`
24. Opening an overlay whose child has `autoFocus` leaves focus on that child. The overlay container does not steal focus. (`:44`)

### Edge cases and browser bugs

- RSP #4130 and #4922: focus lost to body must not close (`useOverlay.ts:151-155`).
- Blur runs before focus, so during `onBlurWithin` the active scope is still the outer overlay (`:157-159`).
- The top-most-only rule applies to both Escape and outside press.

### Global singletons

- `visibleOverlays`. Only the top-most layer may close on Escape or outside press, and the order must be known across independent overlay instances.

---

## 8. Scroll lock (`src/overlays/usePreventScroll.ts`, `utils/keyboard.tsx`, `utils/runAfterKeyboard.ts`, `utils/domHelpers.ts:98-131`)

### Model

Reference counting:

- `preventScrollCount` counts active locks.
- The first lock installs a strategy; the last unlock runs its `restore`. Unlock order does not matter.

Standard strategy (everything except iOS WebKit):

- `overflow:hidden` on `<html>`.
- If a classic scrollbar is present, `scrollbar-gutter: stable`, or `padding-right: <scrollbar width>` where `scrollbar-gutter` is unsupported.
- With the modal-only `UNSTABLE_overrideFocus`, programmatic focus is also patched.

iOS WebKit strategy:

- `overflow:hidden` on `<html>`.
- A prepended `<style>` sets `@layer { * { overscroll-behavior: contain } }`.
- `doc (cap, passive:false)` `touchstart` and `touchmove` listeners block window scrolling.
- `HTMLElement.prototype.focus` is patched to always `preventScroll`, then scroll the element into view inside its own scroll parents after the on-screen keyboard settles.
- A `doc (cap)` `blur` handler steers keyboard-related focus moves.

Restoring styles:

- All style edits use `setStyle`, which restores the exact prior inline value and priority.

### Behaviours

1. Lock → `<html>` gets `overflow:hidden`; unlock → removed. (`test/overlays/usePreventScroll.test.js:23`) Note: it is `documentElement`, not `body`.
2. Nested locks: the page stays locked until the last one releases, in either unmount order. (`:33`, `:49`)
3. Toggling `isDisabled` to true releases the lock. (`:65`)
4. A pre-existing inline `overflow` or `padding-right` value (and its `!important` priority) is restored exactly on unlock. (`domHelpers.ts:98-131`)
5. With a visible classic scrollbar, layout does not shift:
   - `scrollbar-gutter: stable` is applied to `<html>`;
   - `padding-right` is used where `scrollbar-gutter` is unsupported;
   - with overlay scrollbars (width 0), neither is applied. (`usePreventScroll.ts:76-82`)
6. Non-modal popovers do not lock; modal popovers and modals do. (`usePopover.ts:128-130`; `useModalOverlay.ts:78-81`)
7. `[iOS Safari]` Lock injects the `overscroll-behavior: contain` style into `<head>` (with a CSP nonce if one is present) and removes it on unlock. (`usePreventScroll.ts:144-159`)
8. `[iOS Safari]` `[touch]` A touchmove starting on non-scrollable content, or on `<html>`/`<body>`, is `preventDefault`ed, so the window does not scroll. (`usePreventScroll.ts:161-171`) `[device]`
9. `[iOS Safari]` `[touch]` A touchmove inside a nested scroller that actually overflows is allowed. A scroller styled `overflow:auto` that does not overflow is prevented, so scroll chaining is blocked (WebKit 243452). (`:173-184`) `[device]`
10. `[iOS Safari]` `[touch]` These moves are always allowed:
    - two-finger touches (pinch-zoom),
    - touches starting on text that is part of a non-collapsed selection,
    - anything in a `<input type=range>` composed path,
    - a focused input with a non-empty selection range (selection handles).
      (`:116-142, 163`) `[device]`
11. `[iOS Safari]` Programmatic `el.focus()` while locked never scrolls the page.
    - `el.focus({preventScroll:true})` does nothing further.
    - Otherwise, after the keyboard opens or closes (or immediately if no keyboard change is expected), `el` is smooth-scrolled to the centre of its scroll parents' visible area. The bottom is clamped to `visualViewport` so it sits above the keyboard, and the scroll is clamped to the valid range. (`:223-301`) `[device]`
12. `[iOS Safari]` Blur where `relatedTarget` is a text input/textarea/contentEditable → that element is re-focused programmatically so the override (11) scrolls it. (`:202-209`) `[device]`
13. `[iOS Safari]` Blur with `relatedTarget === null` (keyboard "Done") → focus moves to the nearest ancestor `[tabindex]` (e.g. the dialog) with `preventScroll`. This keeps a later tap on the same input producing a blur/focus. (`:209-217`) `[device]`
14. Non-iOS with `UNSTABLE_overrideFocus` (modal opt-in): the same focus override. The blur handler from 12 and 13 is installed only if `supportsKeyboard()`. (`:84-85`)
15. Keyboard detection (`keyboard.tsx`):
    - The keyboard is "open" when the visual viewport height drops by ≥ 100 px within 600 ms of focusing a text input.
    - WebKit fires one resize per transition; other engines are debounced 150 ms.
    - Orientation changes swap width and height. (`keyboard.tsx:19-20, 136-255`) `[device]`
16. `[Android]` With `<meta name=viewport content="interactive-widget=overlays-content">`, the keyboard is treated as unsupported, so scrolling happens immediately. (`keyboard.tsx:150-154, 283-287`) `[device]`
17. `runAfterKeyboard` and `runAfterKeyboardTransition`:
    - Without keyboard support, they flush synchronously.
    - Otherwise they wait two frames to see where focus lands, then poll every 50 ms.
    - Flush is guaranteed after 600 ms, with WebKit given 200 ms more after the opening resize.
      (`runAfterKeyboard.ts:17-19, 76-145`; `test/utils/runAfterKeyboard.test.ts`)
18. Locking and unlocking multiple times restores the original `HTMLElement.prototype.focus` (the one seen at lock time). (`usePreventScroll.ts:249-255`)

### Edge cases and browser bugs

- The iOS comment block lists four reasons `overflow:hidden` is insufficient (`usePreventScroll.ts:89-108`):
  - collapsed toolbars,
  - the keyboard not resizing the layout viewport,
  - input centring on tap,
  - next/previous buttons scrolling the page.
- The overscroll style must exist _before_ `touchstart` as of iOS 26 (`:147`).
- WebKit 243452: overscroll-behavior fails for non-overflowing scrollers (`:173-178`).
- `touch-action: pan-x` cannot be added automatically to fix horizontal-only scrollers, because it must be set before touchstart (`:175-178`).
- `<html>` overflow:hidden lets `scrollIntoViewport()` detect a scroll lock (`:110-111`).
- Two separate prototype patches of `focus` exist: useFocusVisible and scroll lock. Sous must chain them deliberately.

### Global singletons

- `preventScrollCount` and `restore`. One page-level lock is shared by all overlays.
- The patched `HTMLElement.prototype.focus`. Every `focus()` call site must be covered.
- Keyboard `state` and the `runAfterKeyboard` queues (`transitionCallbacks`, `resizeCallbacks`, `listenersByWindow`). There is only one on-screen keyboard.

---

## 9. aria-hidden outside (`src/overlays/ariaHideOutside.ts`)

### Model

Input:

- `ariaHideOutside(targets, {root=document.body, shouldUseInert})` keeps the target elements exposed.

Initial walk (TreeWalker over `root`, including `root` itself):

- First, every `[data-live-announcer]` and `[data-react-aria-top-layer]` element is added to the visible set.
- Nodes that contain a visible node are skipped (descended into).
- Visible nodes and descendants of hidden nodes are rejected. The exception: children of a hidden `role=row` are still hidden individually.
- Everything else is hidden: `aria-hidden="true"`, or `inert=true` when `shouldUseInert` and supported.

Reference counting:

- A module-level `WeakMap` ref-counts hidden elements.
- Elements already hidden by someone else (refCount 0 and already aria-hidden/inert) are left untouched and not tracked.

Dynamic content:

- A `MutationObserver` (childList, subtree) on `root` hides nodes added outside the targets.

Nested calls:

- The module-level `observerStack` keeps only the newest call's observer connected.
- The returned revert decrements the counts and reconnects the previous observer.

`keepVisible(el)`:

- Adds `el` to the top observer's visible set.

### Behaviours

1. Siblings of the target and siblings of each of its ancestors (up to `root`) get `aria-hidden="true"`. The target and its ancestors do not. (`test/overlays/ariaHideOutside.test.js:21`)
2. Multiple targets all stay visible. (`:52`)
3. A container that is already hidden is not traversed, so its children get no attribute. (`:83`)
4. A pre-existing `aria-hidden="true"` is left in place and survives revert. (`:116`)
5. Revert removes exactly the attributes this call added. (`:21`, `:83`)
6. Elements added outside while active are hidden asynchronously, after the MutationObserver tick. (`:148`)
7. Elements added into an already-hidden container get no attribute of their own; elements added elsewhere outside do. (`:175`)
8. Elements added _inside_ a target stay visible. (`:275`)
9. A newly added subtree containing a `[data-react-aria-top-layer]` descendant: the top-layer element stays visible, its siblings are hidden, and the wrapper is skipped. (`:210`)
10. A top layer is recognised by attribute presence (`data-react-aria-top-layer=""`). The live announcer must be `data-live-announcer="true"` when added dynamically. (`:244`; `ariaHideOutside.ts:21-23`)
11. Live announcer nodes anywhere in `root` are never hidden. This is required because the announcer is prepended to `<body>` as a sibling of app content. (`ariaHideOutside.ts:96-101`)
12. A node added and then immediately re-parented (the mutation record has a disconnected parent): it is hidden only if its new location is outside the targets. (`:314`, `:349`; `ariaHideOutside.ts:180-183`)
13. Nested calls: call 1 keeps `[button, radios]`, call 2 keeps `[button]`.
    - Radios are hidden while call 2 is active.
    - Reverting call 2 re-exposes the radios.
    - Reverting call 1 re-exposes everything. (`:385`)
14. Nested calls reverted out of order give the same end state; the refcounts keep shared nodes hidden until the last revert. (`:424`)
15. Only the newest call's MutationObserver is connected. When it reverts, the previous one reconnects. (`ariaHideOutside.ts:164-168, 287-295`)
16. `[VoiceOver]` `[iOS Safari]` Hiding a `role=row` also hides each of its descendants individually, because VoiceOver ignores aria-hidden on rows (WebKit 222623). Content inside the visible row is untouched. (`:463`) `[SR]`
17. A reordered list (React moves nodes) does not leave stale aria-hidden after revert. (`:500`)
18. `shouldUseInert` (used by modals and modal popovers): `inert` is applied instead of aria-hidden. This also removes outside content from tab order and pointer hit-testing. Unhiding clears both `aria-hidden` and `inert`. (`ariaHideOutside.ts:58-77`; `useModalOverlay.ts:92`)
19. `keepVisible(el)` registers `el` with the current top call, so that `el` (a non-modal popover, or an entering modal) is not hidden when mutations add it later. It returns an un-register function. (`ariaHideOutside.ts:299-307`)
20. Shadow DOM:
    - Direct parents of the shadow host are not hidden.
    - Siblings in outer and nested shadow roots are hidden.
    - Each enclosing shadow root gets its own observer (behind a feature flag).
      (`:604`-`:873`)
21. Verifying that a screen reader cannot reach hidden content needs a real SR. The DOM attributes can be asserted directly. `[SR]`

### Edge cases and browser bugs

- WebKit 222623: role=row exception (`ariaHideOutside.ts:104-113`).
- The TreeWalker excludes its root, so the root is evaluated manually (`:132-144`).
- MutationObserver does not cross shadow boundaries, so there is one observer per shadow root. Disconnect-per-target is impossible (whatwg/dom#126), so shadow observers are separate instances (`:79-93, 209-251`).

### Global singletons

- `refCountMap`. Overlapping modals hide overlapping sets of nodes, and an element must stay hidden until every caller reverts.
- `observerStack`. A parent's observer must not hide a child modal's newly mounted content. Only the topmost call's observer is active.

---

## 10. Live announcer (`src/live-announcer/LiveAnnouncer.tsx`)

### Model

Instance:

- A lazily created module singleton.

DOM structure:

- One visually hidden `<div data-live-announcer="true">`, prepended to `document.body`.
- Inside it, two `role="log"` regions: `aria-live="assertive"` and `aria-live="polite"`, both with `aria-relevant="additions"`.

Announcing:

- Each `announce()` appends a fresh child node to the matching log, and the node is removed after a timeout.

API:

- `announce(message, assertiveness='assertive', timeout=7000)`.
- `clearAnnouncer(assertiveness)`.
- `destroyAnnouncer()`.

Implementation:

- Vanilla DOM, with no framework rendering. It registers no event listeners.

### Behaviours

1. The first `announce()` creates the container (visually-hidden styles: 1×1 px, clipped, `position:absolute`) as the first child of `<body>`, containing an assertive log and then a polite log. (`LiveAnnouncer.tsx:89-127`)
2. The first message is delivered 100 ms after the container is created. Safari does not announce into a region inserted too recently. Later calls append immediately. (`:30-53`) `[Safari]` `[VoiceOver]`
3. Consequence of 2: two `announce()` calls within the first 100 ms appear in the DOM in reverse order, because the second is appended immediately and the first after the delay. (`:30-56`)
4. If the announcer is destroyed before the 100 ms delay elapses, the pending first message is dropped. (`:47`)
5. The default politeness is `assertive`; `'polite'` goes to the polite log. (`:27, 152-156`)
6. Each call appends a new `<div>` child, so repeating the same string is announced again (an addition, not a text change). (`:143-156`)
7. Message nodes are removed after `timeout` (default 7000 ms, or a per-call value such as 4000 or 500). (`:16, 158-162`)
8. Empty-string messages are appended but never removed. (`:158`)
9. An object message `{'aria-labelledby': id}` creates a child with `role="img"` and `aria-labelledby`, so the SR reads another element's text. (`:144-147`)
10. `clearAnnouncer('assertive' | 'polite')` empties that log; a falsy argument clears both. Usage pattern: `clearAnnouncer('assertive')` before announcing a new spinbutton value. (`:165-177`; `src/spinbutton/useSpinButton.ts:150-155`)
11. `destroyAnnouncer()` removes the container. The next `announce()` recreates it, with the 100 ms delay again. (`:71-76, 129-136`)
12. The container stays exposed while modals hide or `inert` everything else (§9.11).
13. In test environments (`IS_REACT_ACT_ENVIRONMENT` or `jest` global), the first message is announced synchronously. (`:36-53`)
14. Actually hearing the announcement, and checking that assertive messages interrupt and polite ones queue, needs VoiceOver, NVDA, JAWS, or TalkBack. `[SR]`

### Edge cases

- The Safari delay was found empirically; the code comment notes that waits under 100 ms were inconsistent (`:32-34`).
- The announcer is implemented without React to avoid version-specific root APIs (`:78-83`). This is irrelevant for Sous, which uses plain DOM anyway.

### Global singletons

- `liveAnnouncer`. AT tracks live regions that exist before content changes; a single persistent pair of regions avoids duplicates and missed announcements.

---

## 11. Typeahead (`src/selection/useTypeSelect.ts`, `ListKeyboardDelegate.ts:367-388`, `useSelectableList.ts:82`)

### Model

Per-instance state:

- `{search: string, timeout}`.

Listeners on the collection element:

- `keydown` (bubble) and `keydown` (capture), installed only when the delegate implements `getKeyForSearch`.

Search sequence:

- Each printable key is appended to `search`.
- The search runs from the focused key (inclusive), then from the top.
- On a match: focus the matching key, call `onTypeSelect`, and `preventDefault`/`stopPropagation`.

Buffer reset:

- The buffer clears 1000 ms after the last keystroke, or immediately on a miss.

Space handling:

- The capture listener treats Space as part of the query while a search is in progress, so Space does not toggle selection mid-word.

Matching:

- Uses `Intl.Collator({usage:'search', sensitivity:'base'})` on the prefix of each item's `textValue`.

### Behaviours

1. Typing letters in quick succession narrows the match: B → "B…" item, then L → "Bl…", then E → "Ble…". (`@adobe/react-spectrum/test/listbox/ListBox.test.js:615`)
2. Matching is case- and accent-insensitive (collator base sensitivity). (`useSelectableList.ts:82`)
3. The search starts at the focused item _inclusive_, so typing B while focused on "Bar" stays on "Bar".
   - A repeated letter extends the query ("bb"); it does not cycle through items starting with b.
   - After the timeout, typing B again stays on the same B item. (`ListBox.test.js:716`; `ListKeyboardDelegate.ts:373-385`)
4. If no item at or after the focused one matches, the search wraps and runs from the top. (`ListBox.test.js:733`)
5. The buffer resets 1000 ms after the last keystroke. (`useTypeSelect.ts:21, 138-141`; `ListBox.test.js:716`)
6. A miss resets the buffer immediately and does not `preventDefault`, so the key behaves natively. (`useTypeSelect.ts:129-135`)
7. Space while a search is in progress (non-empty buffer) is appended to the query in the capture phase, with `preventDefault` and `stopPropagation`: "foo bar" works. (`ListBox.test.js:631`)
8. Space with an empty buffer, i.e. after the 1000 ms timeout, falls through to selection. (`ListBox.test.js:659`; `useTypeSelect.ts:104`)
9. Keys typed with Ctrl, Meta, or Alt held are ignored.
10. Named keys (`Enter`, `ArrowDown`, `F1`, `Process`, `Dead`) are ignored. A key is printable if `key.length === 1`, or if it does not start with an ASCII letter (multi-code-unit non-ASCII). (`useTypeSelect.ts:161-171`)
11. Keystrokes from portaled children (target not a DOM descendant) are ignored. (`useTypeSelect.ts:103`)
12. Keystrokes typed into a text input inside a collection item must not trigger typeahead. The row stops propagation of non-Tab keydowns from its children. (`react-aria-components/test/GridList.test.js:2014`; `src/gridlist/useGridListItem.ts:361-367`)
13. On a match, `onTypeSelect(key)` is called and `focusedKey` is updated. Selection is not changed by typeahead itself. (`useTypeSelect.ts:120-124`)
14. `disallowTypeAhead` on the collection disables it entirely. (`useSelectableCollection.ts:743-746`)
15. The pending timer is cleared on unmount. (`useTypeSelect.ts:144-149`)

### Edge cases

- Space handling relies on capture/bubble ordering. The capture listener calls `stopPropagation` only if no earlier handler already did (`useTypeSelect.ts:56-65`).
- No IME/`isComposing` check exists. IME keydowns arrive as `Process`, which the printable filter rejects.

### Global singletons

- None.

---

## Appendix: Playwright feasibility summary

- **Drivable with Playwright mouse and keyboard:**
  - mouse press paths (§1.1-19),
  - keyboard press (§1.27-40, except macOS-only items run on a mac runner),
  - virtual clicks via `el.click()` / `dispatchEvent` (§1.45-46),
  - hover with a mouse,
  - focus-visible keyboard/pointer transitions,
  - focus-within,
  - FocusScope (all except TalkBack),
  - interact-outside,
  - dismissable layers,
  - desktop scroll lock,
  - aria-hide (DOM assertions),
  - announcer DOM,
  - typeahead.
- **Needs touch emulation (`hasTouch`) or CDP touch:**
  - §1.20-26 and §1.60-63,
  - §2.3, 2.5,
  - §8.8-10.
- **Needs real iOS/Android engines:**
  - iOS text-selection timing,
  - iOS scroll-lock touch rules, keyboard-aware focus scrolling, and the blur steering,
  - Android TalkBack signatures,
  - long-press click suppression.

  Unit-test these with platform mocks (`navigator.platform`, `userAgent`, `maxTouchPoints`, `visualViewport`) as React Aria does.

- **Needs a real screen reader (to verify outcome):**
  - VoiceOver zero-size pointers (§1.47),
  - JAWS/NVDA and TalkBack virtual clicks (§1.49-52),
  - TalkBack containment bypass (§5.12),
  - row hiding (§9.16),
  - announcements (§10.14),
  - DismissButton (§7.23).

  The event signatures can be simulated with `[synthetic]` events, except the JAWS check, which requires `isTrusted`.
