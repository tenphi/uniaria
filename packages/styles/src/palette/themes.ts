/**
 * The palette's themes and roles (spec: Tokens → Colors), as Glaze color
 * definitions. Tones are authored for the light scheme; Glaze derives the
 * dark and high-contrast ones. Each `[normal, highContrast]` pair tightens
 * the high-contrast schemes.
 */

import type { ColorMap, GlazeConfigOverride } from '@tenphi/glaze';

export const THEMES = [
  'default',
  'accent',
  'danger',
  'warning',
  'note',
  'disabled',
] as const;

export type Theme = (typeof THEMES)[number];

/** Every theme has every role. */
export const ROLES = [
  'surface',
  'surface-hover',
  'surface-pressed',
  'text',
  'text-soft',
  'border',
  'fill',
  'fill-hover',
  'fill-pressed',
  'fill-text',
  'outline',
] as const;

export type Role = (typeof ROLES)[number];

/** Colors only the default theme has. */
export const DEFAULT_ONLY = ['shadow', 'backdrop'] as const;

/** A scheme, in Glaze's word: light, dark or high contrast. */
export const SCHEMES = [
  'light',
  'dark',
  'lightContrast',
  'darkContrast',
] as const;

export type Scheme = (typeof SCHEMES)[number];

/** A theme's seed: its hue and saturation, both as Glaze takes them. */
export interface ThemeSeed {
  readonly hue: number;
  readonly saturation: number;
}

/**
 * Conventional hues: a blue accent, red danger, amber warning and cyan
 * note (owner, 2026-10-19). Saturations are Cube UI Kit's, the palette's
 * reference: full for the colored themes, and a neutral whose surface
 * carries 12 of it, its text 20.
 */
export const SEEDS: Readonly<Record<Theme, ThemeSeed>> = {
  default: { hue: 262, saturation: 20 },
  accent: { hue: 262, saturation: 100 },
  danger: { hue: 25, saturation: 100 },
  warning: { hue: 75, saturation: 100 },
  note: { hue: 200, saturation: 100 },
  disabled: { hue: 262, saturation: 20 },
};

/** Glaze's dark tone window, and no desaturation in the dark, as UI Kit's. */
export const GLAZE_CONFIG: GlazeConfigOverride = {
  darkTone: [14, 95],
  darkDesaturation: 0,
};

/** The token name of a theme's role: `#uni-danger-border`, `#uni-border`. */
export function colorToken(theme: Theme, role: string): string {
  return theme === 'default' ? `#uni-${role}` : `#uni-${theme}-${role}`;
}

/**
 * The roles in a colored theme, after UI Kit's: a lightly tinted surface,
 * the theme's color as text and border, and a fill set from its white text,
 * as UI Kit's primary button is. Hover and press are tone steps darker than
 * the fill, as UI Kit's accent ramp: a floor of their own against the
 * text would pull all three to the one tone that meets it, as in high
 * contrast, and darker only adds to the text's contrast. Fills and their
 * text are the same in every scheme (`fixed`), and need no contrast
 * against the page: the text or mark on a fill identifies it (owner,
 * 2026-10-20). Tones are UI Kit's; a contrast floor moves a color only
 * where it would fall short (spec: Tokens).
 */
const COLORED: ColorMap = {
  surface: { tone: [98, 96], saturation: 0.2 },
  'surface-hover': { base: 'surface', tone: '-3', saturation: 0.2 },
  'surface-pressed': { base: 'surface', tone: '-6', saturation: 0.2 },
  text: { base: 'surface', tone: '-49', contrast: [6, 11] },
  'text-soft': { base: 'surface', tone: '-49', contrast: [4.5, 7] },
  border: { base: 'surface', tone: '-47', contrast: [3, 4.5] },
  'fill-text': { tone: 100, mode: 'fixed' },
  fill: { base: 'fill-text', tone: '-49', contrast: [4.5, 7], mode: 'fixed' },
  'fill-hover': { base: 'fill', tone: '-3', mode: 'fixed' },
  'fill-pressed': { base: 'fill', tone: '-6', mode: 'fixed' },
  outline: { base: 'surface', tone: '-49', contrast: [3, 4.5] },
};

/**
 * The default theme: a white surface with a faint tint, near-black text,
 * and a dark fill. UI Kit's borders are lighter (tone -10), as decoration;
 * here a border is a field's or a checkbox's edge, which needs 3:1
 * (WCAG 1.4.11), so the floor darkens it. The shadow and the backdrop are
 * Glaze's shadow colors, each a dark pigment with an alpha fitted to the
 * page's surface in every scheme.
 */
export const DEFAULT_COLORS: ColorMap = {
  ...COLORED,
  surface: { tone: 100, saturation: 0.6 },
  'surface-hover': { base: 'surface', tone: '-3', saturation: 0.5 },
  'surface-pressed': { base: 'surface', tone: '-6', saturation: 0.5 },
  text: { base: 'surface', tone: '-100', contrast: [4.5, 7] },
  'text-soft': { base: 'surface', tone: '-54', contrast: [4.5, 7] },
  border: {
    base: 'surface',
    tone: ['-10', '-30'],
    saturation: 0.875,
    contrast: [3, 4.5],
  },
  // UI Kit's inverse surface (`surface-inverse`): dark in every scheme, at
  // its own tone. A step down from its white text, it fell to the floor of
  // the dark scheme's tone window, the dark page's own tone, and a tooltip
  // lost its edge there; its text's floor stays as a safety net.
  fill: { base: 'fill-text', tone: 12, contrast: [4.5, 7], mode: 'fixed' },
  outline: { base: 'surface', tone: '-49', contrast: [3, 4.5] },
  shadow: {
    type: 'shadow',
    bg: 'surface',
    fg: 'text',
    intensity: 10,
    inherit: false,
  },
  // UI Kit's overlay is a fixed color at half alpha, which lightens the
  // dark page; a shadow color darkens every scheme's. The cap keeps the
  // page behind it in sight: half in light, .6 in dark.
  backdrop: {
    type: 'shadow',
    bg: 'surface',
    fg: 'text',
    intensity: 60,
    tuning: { alphaMax: 0.6 },
    inherit: false,
  },
};

/** Per-theme changes to the colored roles. */
export const THEME_COLORS: Readonly<Record<Theme, ColorMap>> = {
  default: {},
  accent: COLORED,
  danger: COLORED,
  warning: COLORED,
  note: COLORED,
  // UI Kit's disabled surface and fill, light and flat. WCAG exempts
  // disabled controls, but their text keeps 3:1 here, on the surface and
  // on the fill (spec: Tokens).
  disabled: {
    surface: { tone: 96.5 },
    'surface-hover': { base: 'surface' },
    'surface-pressed': { base: 'surface' },
    text: { base: 'surface', tone: '-23', contrast: [3, 4.5] },
    'text-soft': { base: 'surface', tone: '-23', contrast: [3, 4.5] },
    border: { base: 'surface', tone: '-10' },
    fill: { base: 'surface', tone: '-10' },
    'fill-hover': { base: 'fill' },
    'fill-pressed': { base: 'fill' },
    'fill-text': { base: 'fill', tone: '-23', contrast: [3, 4.5] },
    outline: { base: 'surface', tone: '-23' },
  },
};
