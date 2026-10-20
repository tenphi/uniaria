/*
 * Ported from Tasty 3.10 (src/utils/merge-styles.ts):
 * Copyright (c) 2026 Andrey Yamanov. Licensed under the MIT License.
 */

/**
 * Tasty's `mergeStyles()`, which `buildCss({ overrides })` applies (spec:
 * Outputs → Customized CSS). Tasty exports it only from entries that load
 * React, so the package keeps a port, which `merge.test.ts` checks against
 * the original (spec: Tasty gaps 17):
 * - a property in the override replaces the base's;
 * - a state map with no `''` key extends the base's, one with `''`
 *   replaces it, `null` in it drops a state and `'@inherit'` keeps the
 *   base's;
 * - `null` removes a property, `null` or `false` a sub-element;
 * - sub-elements (`Indicator`, `&::before`) merge one level deep.
 */

import type { Styles } from '@tenphi/tasty';

type StyleMap = Record<string, unknown>;

const INHERIT = '@inherit';

/** A key for a sub-element or a selector: `Indicator`, `&::before`, `.x`. */
const isSelector = (key: string): boolean => /^[&.A-Z]/.test(key);

const isStateMap = (value: unknown): value is StyleMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Merges `override` into `base`, as Tasty's `mergeStyles(base, override)`. */
export function mergeStyles(base: Styles, override: Styles): Styles {
  const parent = base as StyleMap;
  const child = override as StyleMap;
  const result: StyleMap = { ...parent, ...child };
  const selectors = new Set([
    ...Object.keys(parent).filter((key) => isSelector(key) && parent[key]),
    ...Object.keys(child).filter(isSelector),
  ]);
  for (const key of selectors) {
    const value = child[key];
    if (value === false || value === null) delete result[key];
    else if (value === undefined) result[key] = parent[key];
    else if (value) {
      result[key] = mergeSubElement(
        parent[key] as StyleMap | undefined,
        value as StyleMap,
      );
    }
  }
  for (const key of Object.keys(child)) {
    if (isSelector(key)) continue;
    const value = child[key];
    if (value === undefined) {
      if (key in parent) result[key] = parent[key];
      else delete result[key];
    } else if (value === null) delete result[key];
    else if (isStateMap(value)) result[key] = mergeStateMap(parent[key], value);
  }
  return result as Styles;
}

function mergeSubElement(
  parent: StyleMap | undefined,
  child: StyleMap,
): StyleMap {
  const result: StyleMap = { ...parent, ...child };
  for (const key of Object.keys(child)) {
    const value = child[key];
    if (value === undefined) {
      if (parent && key in parent) result[key] = parent[key];
    } else if (value === null) delete result[key];
    else if (isStateMap(value)) {
      result[key] = mergeStateMap(parent?.[key], value);
    }
  }
  return result;
}

function mergeStateMap(parentValue: unknown, child: StyleMap): StyleMap {
  const parent = isStateMap(parentValue)
    ? parentValue
    : parentValue != null && parentValue !== false
      ? { '': parentValue }
      : null;
  const result: StyleMap = {};
  if (!parent) {
    for (const [key, value] of Object.entries(child)) {
      if (value !== null && value !== INHERIT) result[key] = value;
    }
    return result;
  }
  // With `''`, the override's map replaces the base's.
  if ('' in child) {
    for (const [key, value] of Object.entries(child)) {
      if (value === INHERIT) {
        if (key in parent) result[key] = parent[key];
      } else if (value !== null) result[key] = value;
    }
    return result;
  }
  // Without, it extends it: the base's states keep their order.
  for (const [key, value] of Object.entries(parent)) {
    if (!(key in child)) result[key] = value;
    else if (child[key] !== null && child[key] !== INHERIT) {
      result[key] = child[key];
    }
  }
  for (const [key, value] of Object.entries(child)) {
    if (value === INHERIT) {
      if (key in parent) result[key] = parent[key];
    } else if (value !== null && !(key in parent)) result[key] = value;
  }
  return result;
}
