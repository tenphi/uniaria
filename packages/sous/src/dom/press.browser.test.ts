import { afterEach, describe, expect, it } from 'vitest';

import { createInstance, defineComponent, prop } from '../runtime';
import { createPress } from './press';

// Press behavior runs through the Button conformance suite in both adapters;
// these cover what a single component can't show.

const pressable = defineComponent({
  name: 'pressable',
  parts: ['root'],
  props: { isDisabled: prop(false) },
  setup(ctx) {
    return createPress(ctx, { part: 'root', isDisabled: ctx.props.isDisabled });
  },
  expose: ({ api }) => ({ isPressed: api.isPressed() }),
  connect: ({ api }) => ({ root: { attrs: {}, on: api.handlers } }),
});

function root(style = ''): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('style', style);
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('createPress touch-action', () => {
  it('sets touch-action on the part while started', () => {
    const element = root();
    const instance = createInstance(pressable);
    instance.attach('root', element);
    instance.start();
    expect(element.style.touchAction).toBe('pan-x pan-y pinch-zoom');
    instance.stop();
    expect(element.getAttribute('style')).toBe('');
  });

  it('sets it on a part that arrives after start', () => {
    const element = root();
    const instance = createInstance(pressable);
    instance.start();
    instance.attach('root', element);
    expect(element.style.touchAction).toBe('pan-x pan-y pinch-zoom');
  });

  it('leaves an inline value the consumer set', () => {
    const element = root('touch-action: none');
    const instance = createInstance(pressable);
    instance.attach('root', element);
    instance.start();
    expect(element.style.touchAction).toBe('none');
    instance.stop();
    expect(element.style.touchAction).toBe('none');
  });
});
