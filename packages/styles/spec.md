# Styles spec (`@uniaria/styles`)

Status: approved by @tenphi on 2026-10-19. Delivery phases 1 to 4 done.

## Summary

`@uniaria/styles` gives every UniAria component a default look, so a
project can start with working, accessible styles and replace them part by
part. It is optional: the components keep shipping no look, and everything
in the Styling guide stays true without this package.

One source, written as [Tasty](https://tasty.style) style objects, produces
three outputs (owner, 2026-10-19):

1. **Prebuilt CSS.** Plain stylesheets with the default palette. They need no
   JavaScript, no build step and no Tasty, and work the same with React and
   the custom elements.
2. **Customized CSS.** A Node function that builds the same stylesheets
   with your tokens, palette, units and per-component overrides.
3. **Tasty style objects.** The source itself, one object per component,
   to pass to `tasty()` and extend with `tasty(Base, { styles })` in a
   project that already uses Tasty.

The styles follow the conventions in the Styling guide: the root by
`data-uni`, other parts by `data-element` inside it, a part outside the
root by `data-uni-part`, states by the attributes UniAria writes. They add no markup, no class and no
attribute of their own; the one exception is an optional `data-variant` on
Button and ToggleButton (Resolved questions 10).

Not part of the package:

- **Behavior.** Nothing here changes what a component does or which
  attributes it writes. A style that a behavior needs (positioning,
  `touch-action`, the hidden select) stays in `@uniaria/core`, and these
  styles never style the parts core styles (`hiddenSelect`, `hiddenInput`).
- **Layout of a page.** Components get sizes and inner spacing, not
  margins or placement.
- **Icons and fonts.** Check marks, chevrons and the stepper signs are drawn
  in CSS; the type follows the page (`font: inherit`), with sizes from
  tokens.
- **Custom element hosts.** The styles target the parts inside
  `<uni-checkbox>`, never the host, which keeps its default display.

## Outputs

### 1. Prebuilt CSS

```css
/* Everything: tokens and all 16 components. */
@import '@uniaria/styles/css';

/* The same inside `@layer uniaria`, where an import can't add a layer. */
@import '@uniaria/styles/css/layered';

/* All 16 components without the palette, for your own color tokens. */
@import '@uniaria/styles/css/components.css';

/* Or the tokens and only the components you use. */
@import '@uniaria/styles/css/tokens.css';
@import '@uniaria/styles/css/checkbox.css';
@import '@uniaria/styles/css/select.css';
```

- One file per component plus `tokens.css`; `components.css` with all the
  components, and `index.css` with that and the tokens. A component file needs `tokens.css`; it repeats nothing from
  another component's file (Tasty inlines shared fragments, so two files
  can carry similar rules, never conflicting ones).
- No layer, except in `layered.css`, the layered form of `index.css`
  (Specificity and overrides).
- The files are generated into `dist/` at build time; nothing generated is
  committed.

### 2. Customized CSS

```ts
// build-styles.ts, run by the consumer's build in Node.
import { writeFileSync } from 'node:fs';
import { buildCss } from '@uniaria/styles/build';
import { createPalette } from '@uniaria/styles/palette';

writeFileSync(
  'uniaria.css',
  buildCss({
    // Glaze seeds per theme; the roles and their contrast stay (Tokens).
    palette: createPalette({
      default: { hue: 262, saturation: 8 },
      accent: { hue: 262 },
    }),
    // Any token, over the palette: one value, or one per scheme.
    tokens: {
      '$uni-radius': '4px',
      '#uni-accent-outline': { light: '#0a7', dark: '#3c9' },
    },
    // Default: all 16.
    components: ['checkbox', 'select'],
    // Merged into the source with Tasty's merge rules, by component or by
    // the marker of a part outside its root.
    overrides: {
      checkbox: { Indicator: { radius: '0.5r' } },
      'popover-trigger': { fill: '#uni-accent-fill' },
    },
    // Themes no component uses, written for your own; default: both.
    extraThemes: ['warning'],
    schemes: { dark: true, highContrast: true },
    // Default: none; a name puts the whole file in that layer.
    layer: 'uniaria',
  }),
);
```

- Synchronous and Node-only. Tasty's configuration is one global object, so
  `buildCss()` configures it, extracts, and resets it (`resetConfig()`)
  before it returns; two builds never interleave.
- Needs `@tenphi/tasty` and `@tenphi/glaze` installed (optional peers).
  `configure()` and `resetConfig()` come from `@tenphi/tasty/zero`, which
  needs no React (Tasty 3.10).
- `overrides` take Tasty syntax and Tasty's merge rules: a state map with
  no `''` key extends the default's, one with `''` replaces it, `null`
  removes a property or a sub-element. Tasty exports `mergeStyles()` only
  from entries that load React, so the package keeps a port of it (Tasty
  gaps 17).
- `tokens` take CSS values. A size or a system color with one value goes
  on `:root`; a color with one value goes into every scheme's block, since
  a forced scheme would otherwise keep the palette's; a value per scheme
  (`light`, `dark`, `lightContrast`, `darkContrast`) goes into those
  schemes' blocks. With `palette: false`, a color with one value goes on
  `:root`.
- `replaceTokens` is Tasty's: a token compiles to another
  (`'#uni-accent-fill': '#brand-600'`), for a palette of your own
  (Tokens).

### 3. Tasty style objects

```tsx
import { configure, tasty } from '@tenphi/tasty';
import { uniaria } from '@uniaria/styles/tasty';
import { checkboxStyles } from '@uniaria/styles/checkbox';

// Before the first render (Configuration at run time).
configure({
  plugins: [uniaria({ tokens: { '#uni-accent-fill': '#purple' } })],
});

const CheckboxRoot = tasty({ as: 'label', styles: checkboxStyles });
const CompactCheckbox = tasty(CheckboxRoot, {
  styles: { gap: '0.5x', Indicator: { radius: '0.5r' } },
});
```

- One entry per component (`@uniaria/styles/<name>`), as in
  `@uniaria/core`, each exporting `<name>Styles` (Switch's is
  `switchStyles`; only the core export is `toggleSwitch`). A component with
  parts outside its root also exports those (`popoverTriggerStyles`,
  `dialogTriggerStyles`); see Selectors.
- The objects use Tasty units (`1x`, `1r`, `1bw`, `1ow`), so in a Tasty
  project they take that project's spacing and radii. Colors are
  `#uni-<theme>-<role>` tokens, which the plugin defines with the default
  palette and the consumer can point at their own.
- The plugin brings only what the objects need: the token blocks for
  every scheme, as global styles, and the state aliases
  (`@uni-reduced-motion` and the like). It sets no units.
- `@uniaria/styles/tasty.config` is a Tasty ESLint config listing the
  same tokens and aliases. The ESLint plugin reads an `extends` package's
  config from that package's root, so a project writes
  `extends: '@uniaria/styles'`, which finds the published
  `tasty.config.js`; a subpath such as `@uniaria/styles/tasty.config`
  would be ignored.
- Types come from `@tenphi/tasty` (`Styles`), a type-only import.

## Configuration at run time

### In Tasty's runtime

```ts
// design-system/setup.ts, imported by the entry before anything renders.
import { configure } from '@tenphi/tasty';
import { createPalette } from '@uniaria/styles/palette';
import { uniaria } from '@uniaria/styles/tasty';

configure({
  plugins: [
    uniaria({
      // Default: the package's palette.
      palette: createPalette({ accent: { hue: 300 } }),
      // One value for every scheme, or one per scheme.
      tokens: { '#uni-accent-outline': { light: '#0a7', dark: '#3c9' } },
    }),
  ],
  // Yours: the plugin sets no units.
  units: { x: '8px', r: '6px' },
});
```

- **Once, before the first render.** Tasty locks its configuration as soon
  as it generates a style; `configure()` then warns and does nothing. Call
  it at module scope in the entry, or in a setup module every component
  imports.
- **Tokens arrive as global styles.** The plugin's `globalStyles` hold the
  same blocks as `tokens.css`, one per scheme selector (Schemes), which
  Tasty injects with the first style, in client and server rendering alike.
  So `data-uni-scheme` works in Tasty's runtime as with the prebuilt CSS.
  The plugin declares no Tasty `tokens`: those render on `:root` only, so
  a scheme forced on an element inside the page would never reach them.
  A scheme's high-contrast colors are a `@media` state of its selector,
  and the OS's dark scheme a state of the page's. The system colors are
  held in `color-mix(in srgb, Canvas, Canvas)`, since Tasty takes no
  system color in a color token (Tasty gaps 18).
- **The default palette is data.** The plugin takes it from
  `#default-palette` (package.json `imports`): in the source, a module that
  runs Glaze; in the package, `dist/default-palette.js`, which the build
  writes. So the plugin needs no Glaze unless you call `createPalette()`.
- **Your values go through the plugin's options:** `palette` replaces the
  palette (`false` leaves it out, Glaze is opt-out), `tokens` single
  tokens, in Tasty's syntax, laid out as `buildCss()` lays them out (Outputs
  → Customized CSS). A token in
  `configure({ tokens })` would render on `:root` only and lose to the
  plugin's dark and `data-uni-scheme` blocks.
- **Next to other plugins:** Tasty applies plugins in order, and options
  given to `configure()` itself win over all of them; `globalStyles` merge
  per selector.

### Changing a scheme, a token or the palette later

With every output, and after Tasty's configuration is locked:

- **A scheme:** set or remove `data-uni-scheme` on `<html>` or any element.
- **A token:** set its custom property on any element
  (`el.style.setProperty('--uni-accent-fill-color', …)`); its subtree takes
  it in every scheme, unless an element inside forces a scheme of its own.
- **The palette** chosen at run time, such as from a color picker:
  `paletteCss(createPalette({ accent: { hue } }))` writes the same blocks as
  `tokens.css`, to add after the defaults in a `<style>`, a constructed
  stylesheet or Tasty's `injectRawCSS()`.
- `createPalette()` runs Glaze, in Node and in the browser, and
  `buildCss()`, `uniaria()` and `paletteCss()` all take its result. Glaze
  reaches the browser only through `@uniaria/styles/palette`: the default
  palette ships as data, generated at build time.

## Source of truth

Each component is one Tasty style object for its root, with its other parts
as sub-elements under their `data-element` names, which is Tasty's own
model and the one the Styling guide teaches:

```ts
// src/components/checkbox.ts (sketch)
export const checkboxStyles = {
  display: 'inline-grid',
  gridColumns: 'auto 1fr',
  gap: '1x',
  cursor: { '': 'pointer', disabled: 'default' },
  Indicator: {
    fill: {
      '': '#uni-surface',
      selected: '#uni-accent-fill',
      disabled: '#uni-disabled-surface',
    },
    border: {
      '': '1bw #uni-border',
      selected: '1bw #uni-accent-fill',
      invalid: '1bw #uni-danger-border',
      disabled: '1bw #uni-disabled-border',
    },
    outline: {
      '': '0 #uni-accent-outline',
      '@own(focus-visible)': '1ow #uni-accent-outline',
    },
  },
  Label: { … },
} satisfies Styles;
```

- **States** are the attributes UniAria writes, in Tasty's names:
  `selected`, `hovered`, `pressed`, `focus-visible`, `focus-within`,
  `disabled`, `readonly`, `invalid`, `required`, `indeterminate`, `open`,
  `entering`, `exiting`, `placement=top`, `orientation=vertical`,
  `placeholder`, `empty`. Inside a sub-element a state is the root's unless
  wrapped in `@own()`. UniAria writes state attributes on every part, so
  either works; the source uses the root's where the whole component
  changes (disabled, invalid) and `@own()` where one part does (an option's
  `hovered`).
- **State aliases** (`src/tokens.ts`) name the states with a fallback
  before the upgrade (Resolved questions 15) and the media features:
  `@uni-disabled` (`disabled | :disabled`), `@uni-selected`
  (`selected | :has(Input:checked)`), `@uni-input-disabled`
  (`disabled | :has(Input:disabled)`, for components whose root isn't the
  native element), `@uni-focused` (`focused | :focus-within`, for an input
  box, which shows focus on any focus within it, as a text control does),
  `@uni-first` and `@uni-last` (`:first-child`, `:last-child`, for a part at
  the start or end of its box, such as a stepper), `@uni-list-tab-stop`
  (`:has(List[tabindex="0"])`: a list that is its own tab stop, empty or
  with no option to focus, so focus within it is on the list itself),
  `@uni-arrowed` (`:has(> Arrow)`: a popover with an arrow, which needs its
  overflow), `@uni-reduced-motion` and `@uni-forced-colors`.
- **Shared fragments** (`src/shared/`): the field label, description and
  error; the field column; the input box; the button box; the quiet
  button inside an input box (NumberField's steppers, Combobox's button);
  the toggle row Checkbox, Switch and Radio share; the group layout; the
  option and the parts around it; the popup surface; the overlay motion;
  an overlay's arrow; an overlay's close part, Button's look on its own
  state; the focus ring; the check, dash and chevron marks. Components spread them; consumers see only the flattened objects.
- **What the source may use** is fixed by the Web platform baseline and
  Tasty gaps sections below, and checked by tests: no `@starting` (it emits
  `@starting-style`), no `#token.N` alpha (Tasty emits relative color
  syntax), no `@root()` states, no Tasty presets or recipes the plugin
  doesn't register. Motion is transitions only.

## Selectors

The part markers are attributes, and `data-scope` is gone (owner,
2026-10-19; root AGENTS.md → Part markers):

- **Root:** `[data-uni="<name>"]`, which UniAria writes on every root.
- **Other parts:** sub-elements of the root, minus those inside a nested
  root, so a CheckboxGroup's `Label` rule misses the labels of the
  checkboxes inside it, and a Dialog's `Title` rule a Popover's title
  inside the dialog:
  `[data-uni="checkbox-group"] [data-element="Label"]:where(:not([data-uni="checkbox-group"] [data-uni]:not([data-uni="checkbox-group"]) *))`.
  The exclusion is in `:where()`, so a part rule stays (0,2,0). Tasty's `$`
  affixes can't write it (Tasty gaps 10), so the build adds it to each part
  rule in the CSS it writes; the Tasty objects (Output 3) leave it out, as
  Tasty's model does.
- **Parts outside the root** (the trigger of Dialog, the trigger and anchor
  of Popover and Tooltip) are styled on their own:
  `[data-uni-part="popover-trigger"]`. Dialog's and Popover's triggers take
  Button's look, from the same fragment. Tooltip's trigger is the control
  the tooltip describes (a link, an icon, a Button), so it keeps its own
  look; anchors get none.
- **Without a root**, a component gets no styles (owner, 2026-10-19): most
  roots are optional, but nothing else ties a part to its component.
- **Custom elements before they upgrade:** the markers are in the markup
  the consumer writes, so the parts are styled from the first paint; their
  states come with the upgrade, except those the native element shows
  itself (Resolved questions 15).
- **A component inside another kind inside its own kind** (a Dialog in a
  Popover in a Dialog) loses its part styles: CSS can't find a part's
  nearest root, so the outer Dialog's exclusion also covers the inner one's
  parts. `@scope`, which can, isn't widely available yet.
- **Your own elements** inside a part (Switch's `data-element="Thumb"`, as
  in the docs) are reached through that part. They carry no state, so their
  rules read the part's.
- **Pseudo-elements:** Dialog's underlay is the root's `::backdrop`; marks
  are drawn on `::before` of the indicator.
- All state selectors are inside `:where()` (Tasty's default), so a root
  rule and an outside part's are (0,1,0), and a part rule (0,2,0), whatever
  their states.

These selectors need the parts inside the root in the DOM, which is how
UniAria renders (overlays use the top layer, not portals). A part a
consumer portals elsewhere loses its default styles.

## Tokens

Tokens are CSS custom properties prefixed `uni-`, so they never meet a Tasty
project's own: `#uni-danger-surface` is `--uni-danger-surface-color`,
`$uni-radius` is `--uni-radius`.

### Colors: `#uni-<theme>-<role>`, `#uni-<role>` by default

Every color token names a theme of the palette and a role in it:
`#uni-danger-surface` is the danger theme's surface. The default theme's
tokens leave the theme out (owner, 2026-10-19): `#uni-surface`,
`#uni-border`. Every theme has every role, so a component that turns
invalid swaps `#uni-border` for `#uni-danger-border`, and a name never needs
looking up. This is [Glaze](https://github.com/tenphi/glaze)'s model: a
palette of themes made from one with `extend({ hue })`, each with the same
named colors, and `palette.tokens()` prefixing each with its theme, the
default's with nothing. No theme is named like a role, so `#uni-fill-text`
can only be the default theme's.

| Theme      | Colors                                                         | Used by                                                    |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `default`  | Neutral, the base of every component: surfaces, text, borders. | All 16.                                                    |
| `accent`   | Selection, primary actions and the focus ring.                 | Checkbox, Switch, Radio, ToggleButton, options, Button.    |
| `danger`   | Invalid fields, error messages, destructive actions.           | Every field's invalid state and error.                     |
| `warning`  | Cautions.                                                      | No component yet: future ones (Alert, Toast) and your own. |
| `note`     | Information to point out.                                      | As `warning`.                                              |
| `disabled` | A disabled component, which switches to it whole.              | Every component that can be disabled.                      |

| Role                               | Colors                                                                                                                                | Contrast, checked in every scheme              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `surface`                          | The theme's background: in the default theme, controls and panels; in the others, a tinted one (a selected option, an invalid field). | None of its own.                               |
| `surface-hover`, `surface-pressed` | That background hovered and pressed.                                                                                                  | None of its own.                               |
| `text`                             | Text in the theme: body text, an error message.                                                                                       | 4.5:1 on its own surface and on `#uni-surface` |
| `text-soft`                        | Secondary text: descriptions, placeholders.                                                                                           | As `text`.                                     |
| `border`                           | Edges: a field's box, an invalid field, a checkbox.                                                                                   | 3:1 against `#uni-surface` (WCAG 1.4.11)       |
| `fill`                             | The theme's strong color: a selected indicator, a primary button; in the default theme, a tooltip.                                    | None of its own.                               |
| `fill-hover`, `fill-pressed`       | That fill hovered and pressed.                                                                                                        | None of their own.                             |
| `fill-text`                        | Text and marks on the fill: a check mark, a primary button's label.                                                                   | 4.5:1 on its fill                              |
| `outline`                          | The focus ring.                                                                                                                       | 3:1 against its surface and `#uni-surface`     |

- The default theme also has `#uni-shadow` (popovers and dialogs) and
  `#uni-backdrop` (the dialog's underlay), both Glaze shadow colors: a dark
  pigment with an alpha Glaze fits to the page's surface in each scheme.
  The backdrop's is capped at .6, so it dims the dark page as well as the
  light one, which UI Kit's overlay, a fixed color at half alpha,
  lightens.
- `disabled` keeps 3:1 for its text and its fill's text, and nothing
  more: WCAG exempts disabled controls.
- **The focus ring isn't checked against the fill** (owner, 2026-10-20;
  the approved draft said "its surface and its fill"). The ring is drawn
  with an offset, so what lies next to it is the page, never the fill. A
  ring at 3:1 against the white surface and a mid-tone fill at once would
  have to be nearly black in the light scheme.
- **Fills are the same in every scheme** (owner, 2026-10-20): Cube UI
  Kit's, set from their white text. A fill needs no contrast against the
  page, since the text or mark on it identifies it; its text keeps 4.5:1
  on it (7:1 in high contrast). On the dark surface UI Kit's fills measure
  about 2.4 to 3.2:1. Hover and press are tone steps darker than the fill,
  as UI Kit's accent ramp, with no floor of their own: one against the
  text pulls all three to the one tone that meets it, as it did in high
  contrast. The default fill is UI Kit's inverse surface at its own tone,
  not a step from its text, which in the dark scheme fell to the page's
  own tone; a tooltip stands off the page at 1.3:1 at least.
- **Borders are darker than UI Kit's**, which are decoration at about
  1.3:1: here a border is a field's or a checkbox's edge, which needs 3:1.
- A checkbox, for example: `#uni-surface` and `#uni-border` at rest,
  `#uni-accent-fill` with an `#uni-accent-fill-text` check when selected,
  `#uni-danger-border` while invalid, `#uni-disabled-*` while disabled, and
  an `#uni-accent-outline` focus ring. A tooltip is `#uni-fill` with
  `#uni-fill-text`; an error message, `#uni-danger-text`.
- `warning` and `note` cost about 180 declarations across the schemes,
  about 2 kB gzipped (estimated), and `buildCss()` can leave them out
  (Resolved questions 14).
- Hover and press colors are roles, not Tasty's `#token.N` alpha, which
  compiles to relative color syntax (Web platform baseline).
- **Palette:** generated at build time with Glaze, one hue and saturation
  per theme, which gives light, dark and high-contrast variants that meet
  the contrast column. The default palette is a neutral grey with a blue
  accent (Resolved questions 9), with Cube UI Kit's tones, saturations and
  dark tone window, and hues of its own.
- **Glaze is opt-out** (owner, 2026-10-19). The styles only read the
  `--uni-*` variables, so a project with its own color tokens leaves the
  palette out and points the roles at its own:
  - prebuilt CSS: `components.css` without `tokens.css`, and the variables
    set in your CSS (`--uni-accent-fill-color: var(--brand-600)`);
  - `buildCss({ palette: false, replaceTokens })`: the roles compile
    straight to your tokens (`'#uni-accent-fill': '#brand-600'`), with no
    `--uni-*` colors in the output;
  - Tasty's runtime: `uniaria({ palette: false })`, and the roles set as
    tokens, as the project's own are: in global styles such as `body`'s
    (`'#uni-accent-fill': '#brand-600'`), in the plugin's `tokens`
    option, or in an element's styles. Not Tasty's `replaceTokens` (owner,
    2026-10-21): it compiles the roles away, and nothing is left to change
    at run time.

  Glaze isn't needed then, and the contrast column becomes your
  palette's to meet: the tests check the package's palette only.

### Sizes and motion

| Token                                            | Use                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `$uni-gap`, `$uni-radius`                        | The `x` and `r` units in the prebuilt CSS.                                                        |
| `$uni-border-width`, `$uni-outline-width`        | The `bw` and `ow` units.                                                                          |
| `$uni-control-height`                            | Buttons, inputs and triggers.                                                                     |
| `$uni-font-size`, `$uni-line-height`             | Text: 14 and 20 pixels at the default root size.                                                  |
| `$uni-font-size-small`, `$uni-line-height-small` | Descriptions, errors and tooltips: 12 and 18.                                                     |
| `$uni-transition`                                | Hover and press, and the popups of Select, Combobox and Tooltip, as UI Kit's `$transition`: 80ms. |
| `$uni-overlay-transition`                        | Popover opening and closing, as UI Kit's `$disclosure-transition`: 120ms.                         |
| `$uni-dialog-transition`                         | Dialog and its backdrop opening and closing, as UI Kit's modal: 250ms.                            |
| `$uni-z-overlay`                                 | Popovers without the Popover API (Browser support guide).                                         |

### Schemes

A scheme is light, dark or high contrast (Glaze's word; a theme is a hue in
the palette). The color tokens are written once per scheme, each block a
flat token list rendered for its own selector, so no `@root()` state is
needed (Tasty gaps 2):

```css
:root { color-scheme: light; --uni-surface-color: …; }
@media (prefers-color-scheme: dark) {
  :root:not([data-uni-scheme='light']) { color-scheme: dark; … }
}
[data-uni-scheme='light'] { color-scheme: light; … }
[data-uni-scheme='dark'] { color-scheme: dark; … }
@media (prefers-contrast: more) { /* the same four, high contrast */ }
```

- Following the OS is the default. `data-uni-scheme` on `<html>` forces a
  scheme for the page; on any other element, for that subtree.
- `color-scheme` comes with each scheme, so scrollbars and native controls
  match.
- `light-dark()` would make this one block, but it is only Baseline 2024
  (widely available from about November 2026); move to it then.
- **Forced colors** (`@media (forced-colors: active)`): each component
  maps its fills and borders to system colors (`ButtonText`, `Highlight`,
  `GrayText` for disabled, `CanvasText` for marks), and drawn marks and the
  switch thumb get `forced-color-adjust: none` only where the system colors
  are set explicitly. The styles name them as `#uni-system-<name>` tokens
  (`#uni-system-highlight`), which the base block in `tokens.css` defines
  (`--uni-system-highlight-color: Highlight`), since Tasty takes no system
  color in a border or an outline (Tasty gaps 13). Tested (Testing).
- **Reduced motion** (`@media (prefers-reduced-motion: reduce)`):
  transitions go; state changes are instant.

## Specificity and overrides

The styles have no layer (owner, 2026-10-19), and their specificity is
flat: Tasty wraps every state in `:where()`, so a root rule is (0,1,0) and
a part rule (0,2,0), `[data-uni="checkbox"] [data-element="Indicator"]`,
whatever its states.

- **Overriding a part:** the same selector, loaded after the styles, wins
  over that part in every state. One more class or attribute, such as a
  state or a class of yours, wins in any order:
  `[data-uni='checkbox'] [data-element='Indicator'][data-selected]`.
  A root takes any class of yours loaded after the styles.
- **Resets** never win: an element rule, such as modern-normalize's
  `button { … }`, is (0,0,1), whatever the order.
- **Layers are yours to choose.** Importing with
  `@import '@uniaria/styles/css' layer(components);` puts the styles in a
  layer of yours; with Tailwind 4 that layer sits above Preflight and below
  the utilities. Where an import can't name a layer (a `<link>`, a CSS
  file imported from JavaScript), `@uniaria/styles/css/layered` has
  everything inside `@layer uniaria`; declare its place once, before any
  import (`@layer base, uniaria, utilities;`). Only the full export has a
  layered form (owner, 2026-10-19), not the component files, and
  `buildCss({ layer })` wraps the whole file it writes.
- **Core's own global rules** sit in an anonymous layer, which these
  unlayered styles outrank. The styles never set what core does (the
  scroll lock's `overflow` on `<html>`, the hidden select's visually hidden
  styles), and the tests run those behaviors with the CSS loaded.
- **`hidden`:** UniAria hides some parts with the `hidden` attribute: a
  field's error while not shown, filtered-out options, a list's empty part
  while it has options, closed popovers without the Popover API. Any
  author `display` beats the browser's `[hidden] { display: none }`, so a
  rule that sets `display` on such a part keeps `none` under `[hidden]`,
  and a test checks each one.
- In Output 3 there is no cascade to fight: you change a style object with
  `tasty(Base, { styles })` or `mergeStyles()`.

## Web platform baseline

The styles follow AGENTS.md: Baseline widely available features only,
checked with `web-features`. This rules out several things a Tasty source
would otherwise reach for:

| Feature                                   | Status (2026-10-19) | Instead                                                                             |
| ----------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `@starting-style`                         | Baseline 2024 (low) | Overlays animate from `data-entering`, which UniAria sets for the first two frames. |
| `light-dark()`                            | Baseline 2024 (low) | One token block per scheme (Tokens).                                                |
| Relative color syntax (`#token.N` alpha)  | Baseline 2024 (low) | Hover and press tokens; `color-mix()` (widely available) where a tint is computed.  |
| `@property`                               | Baseline 2024 (low) | Plain custom properties.                                                            |
| `transition-behavior: allow-discrete`     | Baseline 2024 (low) | Exits wait for `data-exiting` transitions, which UniAria already does.              |
| `::backdrop` inheriting custom properties | Changed in 2024     | `var(--uni-backdrop-color, rgb(0 0 0 / 40%))`, the default inline.                  |

Allowed and used: `:where()`/`:is()`, cascade layers (the layered export),
logical properties, `color-mix()`, `oklch()`, `prefers-color-scheme`,
`prefers-contrast`, `forced-colors`, `prefers-reduced-motion`,
`color-scheme`, `:focus-visible` (as UniAria's `data-focus-visible`),
`aspect-ratio`. A test scans the built CSS for the excluded syntax.

## Components

All 16, each in its own file and stylesheet:

| Component     | Parts styled                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button        | root                                                                                                              | `data-variant`: `secondary` (default), `primary`, `quiet`, `danger` (Resolved questions 10).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ToggleButton  | root                                                                                                              | Button's look; `selected` takes the accent fill whatever the variant, where UI Kit's light tint would show it mostly by hue (WCAG 1.4.1).                                                                                                                                                                                                                                                                                                                                                                                 |
| Checkbox      | root, wrapper, input, indicator, label, description, error                                                        | The input is laid over the wrapper (or a `label` root), invisible and clickable, as in the Styling guide. Check and dash drawn on `::before`.                                                                                                                                                                                                                                                                                                                                                                             |
| Switch        | as Checkbox                                                                                                       | The indicator is UI Kit's 32 by 20 track; your `Thumb` element, a 12-pixel dot, slides inside it by logical inset, so it mirrors in right-to-left text.                                                                                                                                                                                                                                                                                                                                                                   |
| Radio         | root, wrapper, input, indicator, label, description                                                               | UI Kit's 16-pixel circle, with an 8-pixel dot in the accent text color while selected.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CheckboxGroup | root, label, description, error                                                                                   | Stacks the items; `data-orientation="horizontal"`, which the consumer writes on this group, wraps them in a row.                                                                                                                                                                                                                                                                                                                                                                                                          |
| RadioGroup    | root, label, description, error                                                                                   | As CheckboxGroup; UniAria writes `data-orientation` from `orientation`.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Field         | root, label, control, description, error                                                                          | The label, description and error fragment every field shares. Only a native text control (an `input` you type in, a `textarea`, a `select`) takes the input box.                                                                                                                                                                                                                                                                                                                                                          |
| TextField     | root, wrapper, label, input, description, error                                                                   | The wrapper is the box: border, a ring on any focus within it, the `invalid` border, 7 pixels inside its border and 4 between what it holds, so your prefix or suffix sits beside the input. The input is bare inside it; without a wrapper there is no box (Field draws one around a native input).                                                                                                                                                                                                                      |
| NumberField   | root, wrapper, label, input, increment, decrement, description, error                                             | TextField's box, with the number at the input's end. The steppers are quiet 24-pixel buttons beside the input in markup order, where UI Kit's stacked half-height ones would fall below the 24-pixel target; at the box's edge, as far from it as from the top and bottom.                                                                                                                                                                                                                                                |
| Listbox       | root, label, scroller, list, option, optionLabel, optionDescription, group, groupLabel, empty, description, error | The list is a box like a field's, the scroller instead while virtualized, with a ring only while the list itself has focus. Options, shared with Select and Combobox: 32-pixel rows of soft text, `#uni-surface-hover` hovered or focused, pressed darker, the accent theme and a check at the end once selected (UI Kit's neutral selected fill is alpha, Web platform baseline), a ring inside on `focus-visible`, no hover or press while read-only, no `display`, no margins.                                         |
| Select        | root, label, trigger, value, popover, arrow, scroller, list, the option parts, empty, close, description, error   | The trigger is a field box with a chevron, lighter hovered, its ring on `focus-visible`; `placeholder` dims the value. The popup: UI Kit's surface, `min-inline-size: var(--anchor-width)`, capped by `--available-width` and `--available-height` and at UI Kit's half viewport, a gap's margin, its list scrolling inside, `display` only while open or exiting. `close` stays visually hidden until it has focus. The popup opens with the overlay motion (Overlay motion).                                            |
| Combobox      | root, label, anchor, input, button, popover, arrow, scroller, list, the option parts, empty, description, error   | The anchor is TextField's box around the input and the button, which is NumberField's quiet button drawing a chevron; the popup as Select's.                                                                                                                                                                                                                                                                                                                                                                              |
| Dialog        | trigger, root, `::backdrop`, title, description, close                                                            | UI Kit's modal: a surface panel 22.5rem wide, from 18rem, within the viewport less 32 pixels a side, `fit-content` high and scrolling inside, its parts a column 12 pixels apart and in from its edge, an 18/24 title, a transparent border for forced colors; `display` only while open or exiting. The trigger and close take Button's look, close on its own state. It fades in and drops 24 pixels into place from `entering`, back on `exiting`, with the backdrop fading, in `$uni-dialog-transition`.              |
| Popover       | trigger, root, arrow, title, description, close                                                                   | The popup surface, its parts a column 8 pixels apart and 12 in from its edge, a 1x margin all round (the gap, and room from the viewport, Overlays guide), capped by `--available-width` and `--available-height`; it scrolls unless it has an arrow (`@uni-arrowed`). The arrow part turns in quarter turns by its `placement`, keeping the box UniAria measures, and `::before` draws the turned square. It fades in and grows from .9 along the placement axis, from its trigger's side, in `$uni-overlay-transition`. |
| Tooltip       | root, arrow                                                                                                       | The default fill, UI Kit's 12/18 text, at most `min(20rem, var(--available-width))`, a 1x margin all round, a transparent border for forced colors; the arrow in the fill. The overlay motion, at .8 instead of .9. `data-instant` (warm-up) skips it.                                                                                                                                                                                                                                                                    |

- Every interactive part keeps a target of at least 24 by 24 CSS pixels
  (WCAG 2.5.8): a checkbox's target is its overlaid input, which covers
  the wrapper or label, not the 14-pixel box.
- The focus ring is a 2-pixel outline in `#uni-accent-outline` with an
  offset, on `focus-visible` only, drawn on the part that shows focus: the
  input box for text fields, the indicator for checkbox, switch and radio,
  the option for list items. An input box shows it on any focus within it
  (`@uni-focused`), as browsers show a text control's focus: a click into
  it is focus you type into.

### Overlay motion

Overlays animate with transitions alone, between the hidden look and
their own, as Cube UI Kit's do (Resolved questions 16). UniAria's
presence marks an opening overlay `data-entering` for its first two
frames and a closing one `data-exiting` until its transitions end, then
hides it; the styles key the hidden look on `entering | exiting`
(`src/shared/motion.ts`):

- **Popups** (Select's and Combobox's popover, and Tooltip): faded, 8
  pixels toward the trigger and scaled to .9 (Tooltip .8) along the
  `data-placement` axis, from the side toward the trigger, in
  `$uni-transition`. Without `data-placement` yet, as below its trigger.
- **Popover:** faded and scaled to .9 along the `data-placement` axis, from
  the side toward its trigger, in `$uni-overlay-transition`.
- **Dialog:** faded and 24 pixels up, its `::backdrop` faded, in
  `$uni-dialog-transition`.

Opacity transitions linearly, movement and scale ease. Under reduced
motion no transition runs, so overlays appear and disappear at once.

Nothing transitions while `entering`, so the hidden look applies at once
and only leaving it animates. A browser can compute an overlay's style as
it shows and before `data-entering` lands (a dialog moving focus in,
UniAria measuring a popup), and a transition into the hidden look would
then start from the overlay's own look and turn back, so opening would
barely show.

## Cases

What the styles cover beyond each component's resting look:

- **Interaction states come from UniAria's attributes**, never `:hover`,
  `:active` or `:focus-visible`: `data-hovered` ignores touch, so no hover
  sticks on a phone, and `data-focus-visible` is the same in every browser.
- **Read-only** (`readonly`) looks enabled, with no hover or press
  feedback, and stays distinct from disabled.
- **Disabled but focusable** (`isFocusableWhenDisabled`) takes the disabled
  theme and still shows the focus ring; nothing hides the ring.
- **Invalid and focused:** the ring turns `#uni-danger-outline`, so the
  invalid state still shows while the field has focus.
- **Required** gets no asterisk. CSS-generated content is read aloud
  ("star") where alternative text for `content` isn't supported, which is
  Baseline only since 2024, and `aria-required` already tells assistive
  technology. A consumer who wants one writes it in the markup with
  `aria-hidden="true"`.
- **Placeholders:** `::placeholder` and Select's `placeholder` value use
  `#uni-text-soft`, at 4.5:1.
- **Autofill:** browsers paint autofilled inputs their own color. A rule of
  its own for `:autofill` keeps the field's colors where it is supported;
  `:autofill` isn't Baseline, and elsewhere the browser's look is the
  fallback.
- **Right to left:** logical properties throughout, so the switch thumb's
  travel, an option's check and the steppers' order follow the text;
  `:dir(rtl)` (widely available since 2026-06) is there for anything drawn
  by direction, and nothing needs it yet: the check and the chevron don't
  mirror. Overlays need nothing: UniAria resolves their side into
  `data-placement`.
- **Text zoom and spacing** (WCAG 1.4.4, 1.4.12): sizes in `rem` and `em`,
  so controls grow with the text; `$uni-control-height` is a minimum block
  size, never a fixed height, so wider line spacing doesn't clip.
- **Narrow screens** (WCAG 1.4.10, 320 CSS pixels): dialogs fit the
  viewport (`dvh` and `dvw`, widely available), popups cap at
  `--available-width` and `--available-height`, and long words wrap
  (`overflow-wrap: anywhere`). Select's value stays on one line and ends in
  an ellipsis.
- **Long content:** dialogs, and popovers without an arrow, scroll inside;
  a popover with an arrow keeps its overflow for it, so its content
  scrolls in an element of the consumer's. A tooltip caps its width at
  `min(20rem, var(--available-width))`.
- **Virtualized lists:** the virtualizer positions and measures options, so
  the list has no `gap` and options no margins; the spacing is inside each
  option. Tasty's `gap` writes margins on a block, so every list sets its
  `display`.
- **Overlay gaps:** an overlay's `margin` is its gap from the anchor in both
  positioning modes (Overlays guide), and the arrow sits in that gap.
- **CSS positioning mode** (`configure({ positioning: 'css' })` from
  `@uniaria/core/dom`): the default styles don't place overlays. Script
  mode places them inline, and UniAria doesn't mark CSS mode in the DOM,
  so a page in CSS mode imports `@uniaria/styles/css/positioning.css`,
  each overlay's default placement in CSS anchor positioning (owner,
  2026-10-19), or places them in its own CSS.
- **Before JavaScript runs:** React's server HTML has the markers and every
  state attribute, so it renders styled. A custom element's markup has its
  markers, so its parts are styled, and the states the native element
  shows itself come from it: `:has(input:checked)` for a selected
  checkbox, switch or radio, `:disabled` for a disabled one. The rest wait
  for the upgrade (Resolved questions 15).
- **Targets and sizes** (owner, 2026-10-19): every pointer gets the
  24-pixel minimum target, coarse ones included, and controls are 32
  pixels high by default (`$uni-control-height: 2rem`).
- **Print** gets no rules in v1.

## Package layout

```
packages/styles/
  package.json         @uniaria/styles, private until release
  tsdown.config.ts     JS entries; generates the CSS after the build
  tasty.config.ts      the ESLint config (/tasty.config)
  tasty.config.js      published: the built config, where `extends` finds it
  spec.md
  src/
    palette/           createPalette() and paletteCss() (/palette); the
                       token sheet both outputs lay out; the default
                       palette (#default-palette), data in a build
    tokens.ts          sizes, system colors, units and state aliases
    plugin.ts          uniaria(): the Tasty plugin (/tasty)
    build.ts           buildCss() (/build, Node only)
    merge.ts           Tasty's mergeStyles(), ported (Tasty gaps 17)
    generate.ts        writes dist/css/*.css with buildCss() defaults and
                       dist/default-palette.js; an internal entry
    shared/            fragments: field text, input box, option, popup, focus, marks
    components/        one file per component (/<name>)
    testing/           the uniStylesCss browser command and test helpers
    *.test.ts          Testing
    __references__/    the screenshots' references, Chromium on Linux
  scripts/
    screenshots.sh     remakes the references in Docker (`pnpm screenshots`)
```

Exports: `.` (all style objects), `./<name>` (16), `./tasty`, `./palette`,
`./build`,
`./tasty.config`, `./css` (`dist/css/index.css`), `./css/layered`
(`dist/css/layered.css`) and `./css/*.css`.
`sideEffects` lists the CSS files only. `imports` maps
`#default-palette` to `src/palette/default.ts` under the `uniaria-source`
condition and to `dist/default-palette.js` otherwise; the build leaves it
external.

Dependencies: none at run time. `@tenphi/tasty` (Output 2 and 3) and
`@tenphi/glaze` (`createPalette()`) are optional peers and development
dependencies; both are
already in the lockfile through Cookbook, MIT, exempt from the
release-age rule as `@tenphi/*`. `@uniaria/core` is a development
dependency for the tests that check part names, and `@uniaria/elements`,
`@uniaria/react`, `@uniaria/testing`, `react` and `react-dom` for the
component tests through both adapters.

## Build

1. tsdown builds the JS entries as in the other packages, and `generate`
   as an internal one.
2. Its `build:done` hook imports the built `dist/generate.js` (tsdown's
   config loader can't follow the source's extensionless imports) and
   runs it: for each component,
   `extractStylesForSelector('[data-uni="<name>"]', styles)` from
   `@tenphi/tasty/zero` (Node only, no React), plus one call per outside
   part and one per scheme block for the tokens, after `configure()` with
   the units pointed at the `$uni-*` tokens
   (`x: 'var(--uni-gap)'`, …), and adds the nested-root exclusion to each
   part rule (Selectors). The hook writes `dist/css/`, with
   `layered.css` as `index.css` inside `@layer uniaria`. `tokens.css`
   starts with a base block of the sizes and the system colors, which
   `index.css` carries too; `components.css` reads them. It also writes
   `dist/default-palette.js`, the default palette as data, for the plugin.
3. The output is deterministic, so a snapshot test catches any change a
   Tasty upgrade makes.

## Tasty gaps

Found while researching this spec (Tasty 3.9.10) and building it. Gaps 1
to 4 and 6 were filed upstream (owner, 2026-10-19) and fixed in Tasty
3.10.0; Tasty 3.11 fixed 11 and its ESLint plugin 1.7.1 fixed 14. The
package requires Tasty 3.11.2. The rest stay workarounds, and those that
need a change in Tasty are filed (owner, 2026-10-20).

1. **`@starting` was dropped** outside generated classes
   ([tenphi/tasty#380](https://github.com/tenphi/tasty/issues/380)). Fixed:
   it emits `@starting-style`. Still unused, since `@starting-style` isn't
   widely available; overlays animate from `data-entering`.
2. **`@root()` states in token maps never matched**
   ([tenphi/tasty#381](https://github.com/tenphi/tasty/issues/381)). Fixed
   for `:root`, but a scheme forced on any element needs its own selector,
   so the tokens stay one flat block per scheme selector.
3. **`configure()` needed React**
   ([tenphi/tasty#382](https://github.com/tenphi/tasty/issues/382)). Fixed:
   `@tenphi/tasty/zero` exports `configure()` and `resetConfig()`.
4. **Local `@keyframes`** weren't emitted for selector or global styles
   ([tenphi/tasty#383](https://github.com/tenphi/tasty/issues/383)). Fixed;
   the styles still use transitions only.
5. **No `@layer`** option for extracted CSS. Workaround: the build wraps
   the layered export itself. Not filed: the wrapping is trivial.
6. **Selector lists** took states and sub-elements on the last item only
   ([tenphi/tasty#384](https://github.com/tenphi/tasty/issues/384)). Fixed.
7. **Units default to pixels** (`x` is `8px`) where the docs said they used
   `--gap`. Tasty 3.11 corrected the docs: units are literal. The build
   still points them at the `$uni-*` tokens.
8. **`#token.N` alpha emits relative color syntax**, which isn't widely
   available. Workaround: explicit tokens and `color-mix()`. Requested: an
   option to compile it with `color-mix()`
   ([tenphi/tasty#415](https://github.com/tenphi/tasty/issues/415)).
9. **Global configuration**: one config per process. Workaround:
   `buildCss()` resets it and runs synchronously.
10. **`$` affixes take no functional pseudo-classes** (`:is()`, `:where()`,
    `:not()`), and split at commas. Not a gap: such a selector violates
    Tasty's model, so it needs an explicit exclusion (owner, 2026-10-19).
    The build adds the nested-root exclusion to the CSS it writes
    (Selectors).
11. **`#clear` was a token**, `var(--clear-color)`, which nothing defined
    outside a Tasty project. Fixed in Tasty 3.11.0: it compiles to
    `transparent`.
12. **A transition's state value is read as a property name**:
    `transition: { '@uni-reduced-motion': 'none' }` emits
    `none var(--none-transition, …)`
    ([tenphi/tasty#412](https://github.com/tenphi/tasty/issues/412)).
    Workaround: the reduced-motion state sets `false`, so no transition is
    written under it.
13. **System colors** aren't accepted in a border or an outline (Tasty 3.11
    replaces them with its default color token)
    ([tenphi/tasty#411](https://github.com/tenphi/tasty/issues/411)), and
    the ESLint plugin reports them in any color position
    ([tenphi/eslint-plugin-tasty#86](https://github.com/tenphi/eslint-plugin-tasty/issues/86)).
    Workaround: `#uni-system-*` tokens, defined as custom properties holding
    the system colors (Tokens → Schemes).
14. **The ESLint plugin's `no-unknown-state-alias`** read a whole key that
    starts with an alias as one alias name. Fixed in its 1.7.1; the keys
    written around it stay.
15. **An own state on a pseudo-element** was written after it
    (`[data-element="Option"]::after:where([data-selected])`), which never
    matched. Tasty 3.11.2 ignores such a state with a warning, and the
    ESLint plugin reports it: a pseudo-element has no state of its own. So
    the part sets a custom property from its own state
    (`--uni-option-mark`), which the pseudo-element reads.
16. **`padding: false`** in a state map writes Tasty's default gap, where
    `false` elsewhere writes nothing
    ([tenphi/tasty#413](https://github.com/tenphi/tasty/issues/413)).
    Workaround: a map that applies under one state leaves its default out.
17. **`mergeStyles()` comes only from entries that load React**
    ([tenphi/tasty#414](https://github.com/tenphi/tasty/issues/414)), so
    `buildCss({ overrides })` can't take it from `/zero`. Workaround: a port
    in `src/merge.ts`, which a test compares with the original.
18. **A color token can't hold a system color**: Tasty warns
    `unable to parse color` and writes nothing
    ([tenphi/tasty#410](https://github.com/tenphi/tasty/issues/410)).
    Workaround: the plugin writes the `#uni-system-*` tokens as
    `color-mix(in srgb, Canvas, Canvas)`; `tokens.css` writes the keywords.

## Testing

In `packages/styles`, run by the root `pnpm test` like every package.
Browser tests take their CSS from `buildCss()` through the `uniStylesCss`
command, which runs in Node, so they need no build first.

- **Snapshot** of each built stylesheet (node project).
- **Source rules** (node): every sub-element names a part of the
  component's definition in `@uniaria/core` or a documented own element
  (`Thumb`), every state is one UniAria writes, and the built CSS has none
  of the excluded syntax (Web platform baseline).
- **Customizing** (node): each `buildCss()` option, the token layout by
  scheme, the default palette's data against `createPalette()`, and the
  merge port against Tasty's `mergeStyles()` on every component.
- **The plugin** (node and browser): its global styles render with Tasty,
  every token included; in Tasty's runtime with React and no prebuilt
  CSS, the page and forced schemes resolve to the palette's colors under
  each OS scheme and contrast, and a component styles itself from its
  object. With `palette: false`, the roles set as tokens in the project's
  global styles take its colors, in its own schemes too.
- **Contrast** (browser, all three engines): renders every role's pairs
  in every theme and scheme, reads the resolved colors, and checks the
  contrast column in Tokens. WCAG 2 contrast is a small in-house function.
  It checks the relations too: hover and press step away from each
  surface and fill, the default fill stands off the page, and the
  backdrop dims it.
- **Components** (browser): mounts the docs examples with the prebuilt
  CSS, through both adapters, and checks:
  - a focus ring appears on `focus-visible` only, at least 2 pixels and
    3:1 against what surrounds it;
  - every interactive target is at least 24 by 24 pixels;
  - in forced colors (Playwright's `forcedColors: 'active'`, Chromium),
    indicators, marks, borders and the focus ring stay visible;
  - with reduced motion, no transition runs; without it, an overlay
    opens from its hidden look and closes back to it;
  - a rule with the same selector, loaded after the styles, overrides a
    part in every state, and a reset's element rule doesn't;
  - a part hidden with the `hidden` attribute stays hidden;
  - with `dir="rtl"`, everything drawn by direction is mirrored;
  - at 200% text size and with WCAG 1.4.12 text spacing, no text clips;
  - at 320 CSS pixels wide, dialogs and popups fit without scrolling the
    page sideways.
- **Screenshots** (browser, Chromium on Linux only, Resolved questions
  12): `src/screenshots.browser.test.ts` renders a gallery for each
  component, its resting states with keyboard focus on the first, or its
  overlay open (Select and Combobox have both). Each gallery is shot in
  the light, dark and both high-contrast schemes, and in forced colors,
  and compared with its reference in `src/__references__/`. The text is
  Liberation Sans, which Playwright installs with its Linux dependencies,
  so CI's runner and Playwright's Docker image draw it alike; elsewhere
  the test skips. Pixelmatch compares at a threshold of .02, not its .1,
  which passes a dark surface ten tones lighter.
  `pnpm -C packages/styles screenshots` updates the references in that
  image (`scripts/screenshots.sh`, Docker needed), writing only those that
  no longer match, and a change to a look commits them with it.

## Documentation

- A **Default styles** guide page: the three outputs, importing, layers,
  overriding a part.
- A **Theming** page: the themes and roles (tables generated from
  `src/palette/`), schemes and `data-uni-scheme`, palettes with
  `createPalette()`, and changing a scheme, a token or the palette at run
  time, in Tasty's runtime too.
- The **Styling** guide links to both and keeps its plain-CSS and Tasty
  examples, which work without the package.
- Each component page gets a "Default styles" note: the parts styled and
  the own elements the styles expect (Switch's `Thumb`).
- The live demos switch to the default styles, and their CSS tabs keep
  only the page layout (Resolved questions 11).

## Changes outside the package

Approved with the spec (owner, 2026-10-19):

- `eslint.config.js`: an import boundary for `packages/styles` (no
  frameworks; `@uniaria/core` and `@uniaria/testing` in tests only) and the
  Tasty plugin's strict rules on its source, against
  `packages/styles/tasty.config.ts`.
- `packages/testing`: `uniEmulateMedia`, a browser command for Playwright's
  media emulation: forced colors (Chromium only), `prefers-contrast` and
  reduced motion.
- New development dependencies in `packages/styles`: `@tenphi/tasty`,
  `@tenphi/glaze`.
- `apps/docs`: the demos load the default styles, built by `buildCss()`
  when the demo scripts are, so the site still needs no package build.
- Following from these: the root `vitest.config.ts` registers
  `stylesCommands` next to `uniCommands`, so browser tests take the CSS
  from `buildCss()` in Node and need no build first; the root AGENTS.md
  lists the package.
- No change to `scripts/`, `.github/`, `pnpm-workspace.yaml` (it already
  includes `packages/*`) or the TypeScript configs beyond the package's
  own `tsconfig.json`.

With phase 4 (owner's go, 2026-10-20): the root `vitest.config.ts` keeps
`toMatchScreenshot()` references in `__references__/`, since
`.gitignore` ignores `__screenshots__/`, and `.gitignore` ignores
`.vitest/`, where a failed screenshot's actual and diff images go.

## Delivery

1. **Foundations:** the package, tokens and palette, the build, Button and
   Checkbox, the tests above. Shown on the docs site for a look review.
2. **The other 14 components.**
3. **Customizing:** `buildCss()` options beyond the defaults (palette,
   overrides, component lists), `createPalette()` and `paletteCss()`, the
   plugin, the ESLint config, and the two docs pages.
4. **Screenshots**, after the look is approved (Testing).

## Resolved questions

Decided by @tenphi on 2026-10-19.

1. **Color tokens** are `#uni-<theme>-<role>`, and the default theme's
   leave the theme out (Tokens).
2. **Schemes:** light, dark and high contrast are schemes, forced with
   `data-uni-scheme`; a theme is a hue in the palette.
3. **No layer by default:** Tasty's `:where()` states keep specificity
   flat. Only the full export also has a layered form (Specificity and
   overrides).
4. **Glaze is opt-out,** for projects with their own color tokens (Tokens).
5. **Part markers are attributes** (`data-uni`, `data-uni-part`,
   `data-element`), and `data-scope` is gone: parts are reached through
   their root, minus nested roots, and a root-less component gets no styles
   (Selectors). This replaced targeting custom elements by tag name, and
   settles the selectors: with no component name on a part, a part can't be
   styled on its own.
6. **CSS positioning mode** gets an opt-in `css/positioning.css` (Cases).
7. **Targets:** 24 pixels at least for every pointer; controls are 32
   pixels high by default (Cases).
8. **Tasty gaps** 1 to 4 and 6 are filed upstream, as tenphi/tasty#380 to
   #384, and fixed in Tasty 3.10.0 (Tasty gaps).

With the spec's approval, its recommendations for the open questions:

9. **The look:** a neutral default (grey surfaces, one blue accent,
   6-pixel radii, 32-pixel controls), close to the platform and easy to
   retheme. Cube UI Kit is the reference for paddings, gaps, sizes, type
   and colors, but not for its hues: the themes take conventional ones,
   a blue accent, red danger, amber warning and cyan note (owner,
   2026-10-19, after approval). Where UI Kit falls below a contrast floor
   here, the floor wins (Tokens).
10. **Button variants through `data-variant`,** which the consumer writes
    (`<button data-variant="primary">`, or `modProps` in Tasty), for Button
    and ToggleButton: `secondary` (the default theme's surface; the
    default), `primary` (the accent fill), `quiet`, and `danger` (the
    danger fill) for a destructive action. No sizes in v1: sizes come from
    tokens.
11. **The docs demos** use the default styles; the Styling guide keeps its
    plain-CSS examples.
12. **Screenshot tests** in phase 4, Chromium on Linux only, since each
    engine and OS font rendering needs its own baseline.
13. **Versioning:** a change that alters a look is a minor release; a
    change to a token's name or a selector is major, as for any public API.
14. **Status themes:** `warning` and `note` are in the palette and in
    `tokens.css` now, for your own components and the future Alert and
    Toast; no `success` until something needs it.
15. **States before custom elements upgrade:** the states the native
    element shows itself fall back to it (`:has(input:checked)` for a
    selected checkbox, switch or radio, `:disabled`); `:has()` is widely
    available since 2026-06. The rest wait for the upgrade.

Decided by the owner after approval:

16. **Overlay motion** (2026-10-20): a shared transition fragment in this
    package (Components → Overlay motion), keyed on the presence states
    UniAria already writes; no wrapper component, since overlays stay
    mounted. Durations as UI Kit's, with their own tokens:
    `$uni-overlay-transition` (120ms) for Popover and
    `$uni-dialog-transition` (250ms) for Dialog; the pickers' popups and
    Tooltip keep `$uni-transition` (80ms), as UI Kit's do.
