import type { Styles } from '@tenphi/tasty';
import { partElement } from '@uniaria/core';
import { combobox } from '@uniaria/core/combobox';
import { popover } from '@uniaria/core/popover';
import { select } from '@uniaria/core/select';
import { tooltip } from '@uniaria/core/tooltip';
import { describe, expect, test } from 'vitest';

import { PLACEMENTS, positioningCss } from './positioning';

const DEFINITIONS = { select, combobox, popover, tooltip };

describe('positioning.css', () => {
  test.each(Object.entries(PLACEMENTS))(
    '%s takes its component’s defaults',
    (name, styles: Styles) => {
      const { parts, props } = DEFINITIONS[name as keyof typeof PLACEMENTS];
      // The root, or the one part the styles name.
      const part = Object.keys(styles).find((key) => /^[A-Z]/.test(key));
      if (part !== undefined) expect(parts.map(partElement)).toContain(part);
      const floating = (part === undefined ? styles : styles[part]) as Styles;
      expect(floating.positionArea).toBe(props.positionArea.defaultValue);
      expect(floating.positionTryFallbacks).toBe(
        props.positionTryFallbacks.defaultValue,
      );
    },
  );

  test('places only where anchor positioning is supported', () => {
    const css = positioningCss();
    expect(css.startsWith('@supports (position-area: top) {\n')).toBe(true);
    expect(css.endsWith('\n}\n')).toBe(true);
  });

  test('keeps a part rule off the parts of a nested root', () => {
    expect(positioningCss()).toContain(
      '[data-uni="select"] [data-element="Popover"]:where(:not([data-uni="select"] [data-uni]:not([data-uni="select"]) *))',
    );
  });
});
