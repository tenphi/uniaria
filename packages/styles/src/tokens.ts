/**
 * What every output shares besides the palette: the size and motion tokens,
 * the Tasty units the built CSS points at them, and the state aliases the
 * style objects use (spec: Tokens → Sizes and motion).
 */

/**
 * Sizes and motion, written once on `:root` by `tokens.css`. Cube UI Kit's,
 * in `rem` where they size text or controls: its 8-pixel gap, 6-pixel
 * radius, 32-pixel controls, 14/20 and 12/18 text, and its transitions:
 * 80ms, 120ms for a popover, 250ms for a dialog (spec: Overlay motion).
 * Its focus ring is 1 pixel; here it is 2 (spec: Components).
 */
export const SIZES = {
  '$uni-gap': '0.5rem',
  '$uni-radius': '0.375rem',
  '$uni-border-width': '1px',
  '$uni-outline-width': '2px',
  '$uni-control-height': '2rem',
  '$uni-font-size': '0.875rem',
  '$uni-line-height': '1.25rem',
  '$uni-font-size-small': '0.75rem',
  '$uni-line-height-small': '1.125rem',
  '$uni-transition': '80ms',
  '$uni-overlay-transition': '120ms',
  '$uni-dialog-transition': '250ms',
  '$uni-z-overlay': '1000',
} as const;

/**
 * Tasty's units in the CSS this package builds. A Tasty project keeps its
 * own, so the style objects take that project's spacing and radii.
 */
export const UNITS = {
  x: 'var(--uni-gap)',
  r: 'var(--uni-radius)',
  bw: 'var(--uni-border-width)',
  ow: 'var(--uni-outline-width)',
} as const;

/**
 * The state aliases the style objects use. The first four fall back to
 * the native element's own state, so a custom element's markup shows it
 * before the element upgrades (spec: Resolved questions 15):
 * `@uni-disabled` where the root is the native control (Button),
 * `@uni-selected` and `@uni-input-disabled` where an `Input` part inside
 * the root is (Checkbox), and `@uni-focused` on an input box, inside
 * `@own()`: any focus within it, as a text control shows focus, whether
 * UniAria writes `data-focused` on it (TextField's wrapper) or not (Field's
 * control).
 */
export const STATES = {
  '@uni-disabled': 'disabled | :disabled',
  '@uni-selected': 'selected | :has(Input:checked)',
  '@uni-input-disabled': 'disabled | :has(Input:disabled)',
  '@uni-focused': 'focused | :focus-within',
  // Structural, inside `@own()`: a part at the start or the end of its box.
  '@uni-first': ':first-child',
  '@uni-last': ':last-child',
  // A list that is its own tab stop, empty or with no option to focus
  // (Listbox spec, Focus): with `focus-visible`, focus is on the list.
  '@uni-list-tab-stop': ':has(List[tabindex="0"])',
  // An overlay with an arrow, which needs its overflow.
  '@uni-arrowed': ':has(> Arrow)',
  '@uni-reduced-motion': '@media(prefers-reduced-motion: reduce)',
  '@uni-forced-colors': '@media(forced-colors: active)',
} as const;

/** The CSS custom property a Tasty token compiles to. */
export function tokenProperty(token: string): string {
  if (token.startsWith('#')) return `--${token.slice(1)}-color`;
  if (token.startsWith('$')) return `--${token.slice(1)}`;
  throw new Error(`[uniaria] Not a Tasty token: "${token}".`);
}
