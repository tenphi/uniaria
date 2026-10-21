import { describe, expect, it } from 'vitest';

import { liveDefaults, toVueAttrs, vueEventName } from './props';

describe('vueEventName', () => {
  it('capitalizes the DOM name, which Vue lowercases back', () => {
    expect(vueEventName('click')).toBe('onClick');
    expect(vueEventName('keydown')).toBe('onKeydown');
    expect(vueEventName('focusin')).toBe('onFocusin');
    expect(vueEventName('pointerdown')).toBe('onPointerdown');
    expect(vueEventName('dblclick')).toBe('onDblclick');
  });
});

describe('toVueAttrs', () => {
  it('keeps DOM names and values, and leaves out undefined', () => {
    expect(
      toVueAttrs(
        {
          attrs: {
            'aria-pressed': 'false',
            tabindex: '0',
            for: 'name',
            disabled: '',
            hidden: undefined,
          },
          style: { '--anchor-width': '10px', 'inset-block-start': undefined },
        },
        {},
      ),
    ).toEqual({
      'aria-pressed': 'false',
      tabindex: '0',
      for: 'name',
      disabled: '',
      style: { '--anchor-width': '10px' },
    });
  });
});

describe('liveDefaults', () => {
  it('renders live values as attribute-only props', () => {
    expect(liveDefaults({ attrs: {}, properties: { value: 'Jane' } })).toEqual({
      '^value': 'Jane',
    });
    expect(liveDefaults({ attrs: {}, properties: { value: 3 } })).toEqual({
      '^value': '3',
    });
    expect(
      liveDefaults({
        attrs: {},
        properties: { checked: true, indeterminate: true },
      }),
    ).toEqual({ '^checked': '' });
    expect(liveDefaults({ attrs: {}, properties: { checked: false } })).toEqual(
      {},
    );
  });
});
