import { afterEach, describe, expect, it } from 'vitest';

import { configure, getSettings } from './settings';

const SETTINGS = Symbol.for('@uniaria/settings/v1');

afterEach(() => {
  Reflect.deleteProperty(globalThis, SETTINGS);
});

describe('settings', () => {
  it('places parts by script by default', () => {
    expect(getSettings()).toEqual({ positioning: 'script' });
  });

  it('changes what it is given, shared by every copy on the page', () => {
    configure({ positioning: 'css' });
    expect(getSettings().positioning).toBe('css');
    expect(Reflect.get(globalThis, SETTINGS)).toEqual({ positioning: 'css' });
    configure({});
    expect(getSettings().positioning).toBe('css');
  });
});
