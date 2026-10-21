---
title: Browser support
description: The browsers and runtimes UniAria supports, and the fallbacks it ships for newer platform features.
---

UniAria uses only web platform features that are
[Baseline widely available](https://web.dev/baseline): supported in every
major browser for at least 30 months. A newer feature is used only behind
feature detection with a fallback that keeps the behavior working, or behind
a setting the page opts into.

| Feature                                                                                     | Status              | What UniAria does                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [Popover API](https://developer.mozilla.org/docs/Web/API/Popover_API)                       | Baseline since 2025 | Used when present. Without it, popovers open in place: `hidden` while closed, `position: fixed` while open, so give them a `z-index`.      |
| [CSS anchor positioning](https://developer.mozilla.org/docs/Web/CSS/CSS_anchor_positioning) | Baseline since 2026 | Opt-in [CSS mode](./overlays.md#script-mode-and-css-mode). By default UniAria places overlays itself, by the same rules, in every browser. |
| `getAnimations()`                                                                           | Widely available    | Waits for exit animations before hiding an overlay. Without it, closes at once.                                                            |

## Tested engines

Every push runs the tests in the current Chromium, Firefox and WebKit through
Playwright, and screen-reader scenarios run nightly in Chromium with
VoiceOver on macOS and NVDA on Windows. iOS and Android behavior (touch,
scroll locking, the on-screen keyboard) is handled after React Aria's
approach and tested in desktop engines with touch input; it hasn't been
tested on devices yet.

## Runtimes and frameworks

- **JavaScript:** ES2022, ES modules only.
- **React:** 18 and 19, for `@uniaria/react`.
- **Vue:** 3.5 and later, for `@uniaria/vue`.
- **Node:** 22 and later, for server rendering and the tooling.
- **Custom elements:** any framework that renders HTML, or none.
