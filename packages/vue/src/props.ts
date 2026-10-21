/**
 * Neutral part props → Vue props (Vue adapter spec, Part props in Vue).
 * Vue's `v-bind` takes DOM names, so attributes and styles pass through as
 * they are, events become `on` and the capitalized DOM name, and live values
 * render once as attributes.
 */

import type { PartProps } from '@uniaria/core';

/**
 * Live DOM properties rendered once with Vue's attribute-only binding, so
 * the element starts with them and Vue never controls it after that.
 */
const LIVE_PROPS: Readonly<Record<string, string>> = {
  value: '^value',
  checked: '^checked',
};

/**
 * The Vue handler prop for a DOM event name: `keydown` → `onKeydown`. Vue
 * listens to the event named by the rest, lowercased, and DOM event names
 * have no capitals for it to split on.
 */
export function vueEventName(type: string): string {
  return `on${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

/**
 * The attribute-only props for a part's live values, from the first render:
 * `^value` as a string, and `^checked` only while checked (its attribute
 * holds no value).
 */
export function liveDefaults(props: PartProps): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props.properties ?? {})) {
    const prop = LIVE_PROPS[name];
    if (!prop || value === undefined || value === false) continue;
    result[prop] = value === true ? '' : String(value);
  }
  return result;
}

/** Attributes and style as Vue props, leaving out what is `undefined`. */
export function toVueAttrs(
  props: PartProps,
  result: Record<string, unknown>,
): Record<string, unknown> {
  for (const [name, value] of Object.entries(props.attrs)) {
    if (value !== undefined) result[name] = value;
  }
  if (props.style) {
    const style: Record<string, string> = {};
    for (const [name, value] of Object.entries(props.style)) {
      if (value !== undefined) style[name] = value;
    }
    result.style = style;
  }
  return result;
}
