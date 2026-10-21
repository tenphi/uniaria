/**
 * What the Tasty ESLint rules accept in this package's style source: the
 * `uni-` tokens, the units the build points at them, the state aliases,
 * and no presets or recipes (spec: Source of truth). Published as
 * `@uniaria/styles/tasty.config`, and through `tasty.config.js` for a
 * project's `extends: '@uniaria/styles'` (spec: Outputs → Tasty style
 * objects).
 */

import type { TastyValidationConfig } from '@tenphi/eslint-plugin-tasty';

import { colorToken, DEFAULT_ONLY, ROLES, THEMES } from './src/palette/themes';
import { SIZES, STATES, UNITS } from './src/tokens';

export default {
  tokens: [
    ...THEMES.flatMap((theme) => ROLES.map((role) => colorToken(theme, role))),
    ...DEFAULT_ONLY.map((name) => colorToken('default', name)),
    ...Object.keys(SIZES),
    // Tasty's own: `currentColor`, and `transparent` in the built CSS.
    '#current',
    '#clear',
    // A popover's room, which UniAria measures and writes on it.
    '$anchor-width',
    '$available-width',
    '$available-height',
  ],
  units: Object.keys(UNITS),
  states: Object.keys(STATES),
  presets: [],
  recipes: [],
} satisfies TastyValidationConfig;
