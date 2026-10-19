/**
 * What the Tasty ESLint rules accept in this app: Cookbook's tokens, units,
 * states and presets, plus whatever the site's theme adds.
 */

import { createValidationConfig } from '@tenphi/cookbook/eslint-plugin';

import docs from './docs.config';

export default createValidationConfig(docs.theme);
