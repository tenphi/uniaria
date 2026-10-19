/**
 * The palette's themes and roles (spec: Tokens → Colors), as Glaze color
 * definitions. Tones are authored for the light scheme; Glaze derives the
 * dark and high-contrast ones. Each `[normal, highContrast]` pair tightens
 * the high-contrast schemes.
 */

import type { ColorMap } from '@tenphi/glaze';

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

/** A neutral grey with a blue accent (spec: Resolved questions 9). */
export const SEEDS: Readonly<Record<Theme, ThemeSeed>> = {
  default: { hue: 262, saturation: 6 },
  accent: { hue: 262, saturation: 80 },
  danger: { hue: 25, saturation: 80 },
  warning: { hue: 75, saturation: 90 },
  note: { hue: 200, saturation: 80 },
  disabled: { hue: 262, saturation: 0 },
};

/** The token name of a theme's role: `#uni-danger-border`, `#uni-border`. */
export function colorToken(theme: Theme, role: string): string {
  return theme === 'default' ? `#uni-${role}` : `#uni-${theme}-${role}`;
}

/**
 * The roles in a colored theme: a tinted surface, the theme's color as
 * text, border and fill. A fill follows the scheme: in the dark ones it is
 * lighter than the surface, with dark text on it.
 */
const COLORED: ColorMap = {
  surface: { tone: [96, 98], saturation: 0.45 },
  'surface-hover': { base: 'surface', tone: '-3', saturation: 0.45 },
  'surface-pressed': { base: 'surface', tone: '-6', saturation: 0.45 },
  text: { base: 'surface', tone: ['-62', '-78'], contrast: 'AA' },
  'text-soft': {
    base: 'surface',
    tone: ['-52', '-66'],
    contrast: 'AA',
    saturation: 0.7,
  },
  border: { base: 'surface', tone: ['-42', '-56'], contrast: [3, 4.5] },
  fill: { base: 'surface', tone: [46, 30], contrast: [3, 4.5] },
  'fill-hover': { base: 'fill', tone: '-6' },
  'fill-pressed': { base: 'fill', tone: '-12' },
  'fill-text': { base: 'fill', tone: 'max', contrast: [4.5, 7] },
  outline: { base: 'surface', tone: ['-50', '-62'], contrast: [3, 4.5] },
};

/** The default theme: white controls, grey text and borders, a dark fill. */
export const DEFAULT_COLORS: ColorMap = {
  ...COLORED,
  surface: { tone: 100 },
  'surface-hover': { base: 'surface', tone: '-4' },
  'surface-pressed': { base: 'surface', tone: '-8' },
  text: { base: 'surface', tone: ['-86', '-100'], contrast: 'AA' },
  'text-soft': { base: 'surface', tone: ['-56', '-72'], contrast: 'AA' },
  fill: { base: 'surface', tone: ['-78', '-90'], contrast: [3, 4.5] },
  shadow: {
    type: 'shadow',
    bg: 'surface',
    fg: 'text',
    intensity: 12,
    inherit: false,
  },
  backdrop: { tone: 0, opacity: 0.45, mode: 'static', inherit: false },
};

/** Per-theme changes to the colored roles. */
export const THEME_COLORS: Readonly<Record<Theme, ColorMap>> = {
  default: {},
  accent: COLORED,
  danger: COLORED,
  // A lighter amber than the other fills, with dark text: at their tone it
  // reads as brown. Between 3:1 against white and 4.5:1 under dark text it
  // has little room, so hovered and pressed get lighter, away from the
  // text, in every scheme. High contrast needs 4.5:1 against the surface,
  // too dark for dark text, so there it darkens and takes white text.
  warning: {
    ...COLORED,
    fill: { base: 'surface', tone: [52, 30], contrast: [3, 4.5] },
    'fill-hover': { base: 'fill', tone: ['+5', '+6'], mode: 'fixed' },
    'fill-pressed': { base: 'fill', tone: ['+10', '+12'], mode: 'fixed' },
  },
  note: COLORED,
  // WCAG exempts disabled controls: 3:1 for the text and the fill's text.
  disabled: {
    surface: { tone: [94, 96] },
    'surface-hover': { base: 'surface' },
    'surface-pressed': { base: 'surface' },
    text: { base: 'surface', tone: ['-40', '-55'], contrast: [3, 4.5] },
    'text-soft': { base: 'surface', tone: ['-40', '-55'], contrast: [3, 4.5] },
    border: { base: 'surface', tone: ['-22', '-40'] },
    fill: { base: 'surface', tone: ['-36', '-50'] },
    'fill-hover': { base: 'fill' },
    'fill-pressed': { base: 'fill' },
    'fill-text': { base: 'fill', tone: 'max', contrast: [3, 4.5] },
    outline: { base: 'surface', tone: '-40' },
  },
};
