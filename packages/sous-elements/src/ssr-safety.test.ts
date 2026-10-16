import { describe, expect, it } from 'vitest';

/**
 * The adapter must import in Node without a DOM: element classes extend
 * `HTMLElement`, so they are created inside `defineElement()`, never at module
 * scope (design decision 7).
 */
const entries = {
  '@tenphi/sous-elements': () => import('./index'),
  '@tenphi/sous-elements/button': () => import('./button'),
  '@tenphi/sous-elements/toggle-button': () => import('./toggle-button'),
  '@tenphi/sous-elements/field': () => import('./field'),
  '@tenphi/sous-elements/text-field': () => import('./text-field'),
  '@tenphi/sous-elements/checkbox': () => import('./checkbox'),
  '@tenphi/sous-elements/checkbox-group': () => import('./checkbox-group'),
  '@tenphi/sous-elements/switch': () => import('./switch'),
  '@tenphi/sous-elements/radio': () => import('./radio'),
  '@tenphi/sous-elements/radio-group': () => import('./radio-group'),
  '@tenphi/sous-elements/dialog': () => import('./dialog'),
};

describe('SSR safety', () => {
  it('runs without a DOM', () => {
    expect(typeof HTMLElement).toBe('undefined');
  });

  it.each(Object.entries(entries))('imports %s', async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
  });

  it('registers nothing where there are no custom elements', async () => {
    const { SousButton } = await import('./button');
    expect(SousButton).toBeUndefined();
    const { SousToggleButton } = await import('./toggle-button');
    expect(SousToggleButton).toBeUndefined();
    const { SousField } = await import('./field');
    expect(SousField).toBeUndefined();
    const { SousTextField } = await import('./text-field');
    expect(SousTextField).toBeUndefined();
    const { SousCheckbox } = await import('./checkbox');
    expect(SousCheckbox).toBeUndefined();
    const { SousCheckboxGroup } = await import('./checkbox-group');
    expect(SousCheckboxGroup).toBeUndefined();
    const { SousSwitch } = await import('./switch');
    expect(SousSwitch).toBeUndefined();
    const { SousRadio } = await import('./radio');
    expect(SousRadio).toBeUndefined();
    const { SousRadioGroup } = await import('./radio-group');
    expect(SousRadioGroup).toBeUndefined();
    const { SousDialog } = await import('./dialog');
    expect(SousDialog).toBeUndefined();
  });
});
