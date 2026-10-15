import { describe, expect, it } from 'vitest';

import { reactEventName, reactPropName, reactPropValue } from './props';

describe('neutral part props → React props', () => {
  it.each([
    ['class', 'className'],
    ['for', 'htmlFor'],
    ['tabindex', 'tabIndex'],
    ['readonly', 'readOnly'],
    ['aria-disabled', 'aria-disabled'],
    ['data-pressed', 'data-pressed'],
    ['role', 'role'],
  ])('maps the %s attribute to %s', (attribute, prop) => {
    expect(reactPropName(attribute)).toBe(prop);
  });

  it('turns empty boolean attributes into true and keeps other values', () => {
    expect(reactPropValue('disabled', '')).toBe(true);
    expect(reactPropValue('hidden', '')).toBe(true);
    expect(reactPropValue('hidden', 'until-found')).toBe('until-found');
    expect(reactPropValue('data-pressed', '')).toBe('');
    expect(reactPropValue('aria-disabled', 'true')).toBe('true');
  });

  it.each([
    ['click', 'onClick'],
    ['keydown', 'onKeyDown'],
    ['pointerenter', 'onPointerEnter'],
    ['focusin', 'onFocus'],
    ['focusout', 'onBlur'],
    ['input', 'onInput'],
    ['dblclick', 'onDoubleClick'],
    ['beforetoggle', 'onBeforeToggle'],
  ])('maps the %s event to %s', (type, prop) => {
    expect(reactEventName(type)).toBe(prop);
  });
});
