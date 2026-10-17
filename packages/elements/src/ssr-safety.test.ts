import { describe, expect, it } from 'vitest';

/**
 * The adapter must import in Node without a DOM: element classes extend
 * `HTMLElement`, so they are created inside `defineElement()`, never at module
 * scope (design decision 7).
 */
const entries = {
  '@uniaria/elements': () => import('./index'),
  '@uniaria/elements/button': () => import('./button'),
  '@uniaria/elements/toggle-button': () => import('./toggle-button'),
  '@uniaria/elements/field': () => import('./field'),
  '@uniaria/elements/text-field': () => import('./text-field'),
  '@uniaria/elements/checkbox': () => import('./checkbox'),
  '@uniaria/elements/checkbox-group': () => import('./checkbox-group'),
  '@uniaria/elements/switch': () => import('./switch'),
  '@uniaria/elements/radio': () => import('./radio'),
  '@uniaria/elements/radio-group': () => import('./radio-group'),
  '@uniaria/elements/dialog': () => import('./dialog'),
  '@uniaria/elements/popover': () => import('./popover'),
  '@uniaria/elements/tooltip': () => import('./tooltip'),
};

describe('SSR safety', () => {
  it('runs without a DOM', () => {
    expect(typeof HTMLElement).toBe('undefined');
  });

  it.each(Object.entries(entries))('imports %s', async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
  });

  it('registers nothing where there are no custom elements', async () => {
    const { UniButton } = await import('./button');
    expect(UniButton).toBeUndefined();
    const { UniToggleButton } = await import('./toggle-button');
    expect(UniToggleButton).toBeUndefined();
    const { UniField } = await import('./field');
    expect(UniField).toBeUndefined();
    const { UniTextField } = await import('./text-field');
    expect(UniTextField).toBeUndefined();
    const { UniCheckbox } = await import('./checkbox');
    expect(UniCheckbox).toBeUndefined();
    const { UniCheckboxGroup } = await import('./checkbox-group');
    expect(UniCheckboxGroup).toBeUndefined();
    const { UniSwitch } = await import('./switch');
    expect(UniSwitch).toBeUndefined();
    const { UniRadio } = await import('./radio');
    expect(UniRadio).toBeUndefined();
    const { UniRadioGroup } = await import('./radio-group');
    expect(UniRadioGroup).toBeUndefined();
    const { UniDialog } = await import('./dialog');
    expect(UniDialog).toBeUndefined();
    const { UniPopover } = await import('./popover');
    expect(UniPopover).toBeUndefined();
    const { UniTooltip } = await import('./tooltip');
    expect(UniTooltip).toBeUndefined();
  });
});
