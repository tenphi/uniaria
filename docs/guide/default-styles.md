---
title: Default styles
description: An optional look for every component, as prebuilt CSS, as CSS built with your changes, or as Tasty style objects.
---

UniAria has no look, and everything in [Styling](./styling.md) works without
this page. `@uniaria/styles` adds one: a neutral look for all 17 components,
accessible in every scheme, which you can keep, retheme
([Theming](./theming.mdx)) or replace part by part. The demos on these pages
use it.

It comes three ways, all from one source written as
[Tasty](https://tasty.style) style objects:

| Output              | For                                                     | Needs                                                          |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Prebuilt CSS        | Any project: React, Vue or custom elements              | Nothing: plain stylesheets                                     |
| Customized CSS      | Your tokens, palette and overrides, built in Node       | `@tenphi/tasty`, and `@tenphi/glaze` for a palette of your own |
| Tasty style objects | A project that styles its components with Tasty already | `@tenphi/tasty`                                                |

```sh
pnpm add @uniaria/styles
```

Tasty and Glaze are optional peer dependencies: add them only for the outputs
that need them.

## Prebuilt CSS

```css
@import '@uniaria/styles/css';
```

That is everything: the tokens and all 17 components. The package has a file
for each part of it too:

| Import                                | Holds                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `@uniaria/styles/css`                 | The tokens and every component.                                        |
| `@uniaria/styles/css/layered`         | The same, inside `@layer uniaria`.                                     |
| `@uniaria/styles/css/tokens.css`      | The sizes, the durations, and the palette's colors in every scheme.    |
| `@uniaria/styles/css/components.css`  | Every component and the sizes, without colors: for colors of your own. |
| `@uniaria/styles/css/<name>.css`      | One component, such as `checkbox.css`. It needs `tokens.css`.          |
| `@uniaria/styles/css/positioning.css` | Opt-in: each overlay's default placement in CSS positioning mode.      |

So a page with a few components takes the tokens and those:

```css
@import '@uniaria/styles/css/tokens.css';
@import '@uniaria/styles/css/checkbox.css';
@import '@uniaria/styles/css/select.css';
```

In [CSS positioning mode](./overlays.md#script-mode-and-css-mode), UniAria
leaves placing overlays to your CSS. `positioning.css` places each one on its
component's default side with CSS anchor positioning, where the browser has
it, and the component's styles keep the gap from the trigger as a `margin`.
Without it, place the overlays in your own CSS.

The styles select the markers and state attributes UniAria writes
([Parts](./styling.md#parts)), and add no class or attribute of their own,
with one exception: `data-variant` on a Button or a ToggleButton, set to
`primary`, `quiet` or `danger`; without it, the button is secondary. A few
parts expect an element of yours, such as Switch's `Thumb`; each component
page's "Default styles" note says what it styles and expects.

## Labels, frames and extras

A Button or ToggleButton with a `label` part, a Popover's or Dialog's trigger
with a `triggerLabel`, and an option with an `optionLabel` are laid out as
items:

- **Around the label.** The element before the label, such as an icon, sits
  at its start, and the one after it, such as a shortcut hint or a count, at
  its end, half a gap away. One element each: wrap several in one.
- **One line.** The label and its description below take one line each,
  aligned to the start, and end in an ellipsis, as do options without a
  label part. Pair cut-off text with an
  [overflow tooltip](../components/tooltip.mdx). For more lines, set
  `-webkit-line-clamp` on the part yourself.
- **Frames.** In a `frame`, the button spans it and the `extras` sit over its
  end: the label ends before them, and the button's fill, border and focus
  ring stay under them in every state. Only what acts in the extras takes
  the pointer (buttons, links, UniAria components and tooltip triggers), so
  a count or a gap between extras presses the button. A framed button needs
  a label part, which keeps its content clear of the extras. A Button in the
  extras is 24 pixels high.
- **Colors.** The frame takes its button's text color, `data-variant`
  included, so extras drawn in `currentColor` match it. A quiet button takes
  the text color around it and mixes its hover and press fills from it, so
  it reads on any fill, a primary trigger's or a selected option's.
- **Pickers.** Select's chevron comes after its trigger's extras, and an
  option's extras come before its check.

## Overriding a part

Every rule's specificity is flat, whatever the state: a root's is (0,1,0) and
a part's (0,2,0), since Tasty wraps states in `:where()`.

- The same selector, loaded after the styles, wins in every state:

  ```css
  [data-uni='checkbox'] [data-element='Indicator'] {
    border-radius: 2px;
  }
  ```

- One more attribute or class wins in any order:
  `[data-uni='checkbox'] [data-element='Indicator'][data-selected]`.
- A class of yours on a root wins when it loads after the styles.
- A reset never wins: an element rule such as `button { … }` is (0,0,1).

### Layers

The styles have no layer, unless you put them in one of yours:

```css
@import '@uniaria/styles/css' layer(components);
```

With Tailwind 4, `components` sits above Preflight and below the utilities.
Where an import can't name a layer, as in a `<link>` or a CSS file imported
from JavaScript, take the layered file, and declare where its layer goes once,
before any import:

```css
@layer base, uniaria, utilities;
@import '@uniaria/styles/css/layered';
```

UniAria's own global rules sit in an anonymous layer, which the unlayered
styles outrank; the styles never set what those rules do
([Styles UniAria sets](./styling.md#styles-uniaria-sets)).

## Customized CSS

`buildCss()` builds the same stylesheet in Node, with your changes. Run it in
your build:

```ts
import { writeFileSync } from 'node:fs';

import { buildCss } from '@uniaria/styles/build';
import { createPalette } from '@uniaria/styles/palette';

writeFileSync(
  'uniaria.css',
  buildCss({
    palette: createPalette({ accent: { hue: 150 } }),
    tokens: { '$uni-radius': '4px' },
    components: ['button', 'checkbox', 'select'],
    overrides: { checkbox: { Indicator: { radius: '0.5r' } } },
  }),
);
```

| Option        | Default                | What it does                                                                                                                            |
| ------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `palette`     | The package's          | The colors: a palette from [`createPalette()`](./theming.mdx#your-palette), or `false` to leave them out.                               |
| `tokens`      | None                   | Tokens over the sizes and the palette, as CSS: one value, or one per scheme ([Theming](./theming.mdx#tokens)).                          |
| `components`  | All 17                 | The components to style; `[]` writes the tokens only.                                                                                   |
| `overrides`   | None                   | Tasty styles merged into a component's, by its name (`checkbox`), or into a part outside its root, by its marker (`'popover-trigger'`). |
| `extraThemes` | `['warning', 'note']`  | The status themes to write, which no component uses: they are there for yours.                                                          |
| `schemes`     | Dark and high contrast | `{ dark: false }` or `{ highContrast: false }` leaves those schemes out.                                                                |
| `layer`       | None                   | A cascade layer for the whole file.                                                                                                     |

Overrides take Tasty's syntax and its merge rules: a state map without a `''`
key extends the default one, a map with `''` replaces it, and `null` removes a
style or a part's styles. Their units read the size tokens: `1x` is the gap,
`1r` the radius, `1bw` the border width and `1ow` the outline width.

`buildCss()` is synchronous and runs in Node only. Tasty keeps one
configuration per process, so each call sets it, builds, and resets it before
it returns.

## Tasty style objects

In a project that uses Tasty, take the source itself. Each component's object
is an entry of its own, `@uniaria/styles/<name>`, and the parts outside a
root have theirs (`dialogTriggerStyles`, `popoverTriggerStyles`):

```tsx
import { configure, tasty } from '@tenphi/tasty';
import { checkbox } from '@uniaria/core/checkbox';
import { useBehavior } from '@uniaria/react';
import { checkboxStyles } from '@uniaria/styles/checkbox';
import { uniaria } from '@uniaria/styles/tasty';

// Once, before anything renders.
configure({ plugins: [uniaria()] });

const CheckboxRoot = tasty({ styles: checkboxStyles });

export function Terms() {
  const terms = useBehavior(checkbox, { labelElementType: 'span' });
  return (
    <CheckboxRoot {...terms.parts.root}>
      <label {...terms.parts.wrapper}>
        <input {...terms.parts.input} name="terms" />
        <span {...terms.parts.indicator} />
        <span {...terms.parts.label}>Accept the terms</span>
      </label>
    </CheckboxRoot>
  );
}
```

The objects style the parts by the `data-element` markers UniAria writes, and
their states are the attributes it writes, so a `tasty()` element takes the
part props as they are. Extend an object as any Tasty styles:
`tasty(CheckboxRoot, { styles: { Indicator: { radius: '0.5r' } } })`.

`uniaria()` brings what the objects need: the tokens of every scheme, as
global styles, and the state aliases they use (`@uni-reduced-motion` and the
like). It sets no units, so the objects take your project's spacing and radii.
Its options, a palette and tokens, are on [Theming](./theming.mdx#in-tastys-runtime).

The package has a config for Tasty's ESLint plugin, with its tokens and
aliases. Extend it from your `tasty.config.ts`:

```ts
export default {
  extends: '@uniaria/styles',
  tokens: ['#brand'],
};
```

## What the styles leave to you

- **The page's layout.** Components get their sizes and inner spacing, never
  margins or placement.
- **Behavior.** The styles change nothing a component does or writes, and
  leave alone what UniAria styles itself.
- **Icons and fonts.** Check marks, chevrons and the stepper signs are drawn in
  CSS; text takes the page's font, at the sizes of the tokens.
- **Custom element hosts.** The styles target the parts inside
  `<uni-checkbox>`, never the host, which keeps its default display.
