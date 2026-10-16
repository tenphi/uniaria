import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineComponent, event, prop } from '../runtime';
import { createBinder } from './binder';
import { createPress } from './press';
import type { PressEvent } from './press';

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

/** Emits `press`, for counting presses. */
const emitting = defineComponent({
  name: 'emitting',
  parts: ['root'],
  props: {},
  events: { press: event<PressEvent>() },
  setup(ctx) {
    return createPress(ctx, {
      part: 'root',
      isDisabled: () => false,
      onPress: (detail) => ctx.emit('press', detail),
    });
  },
  expose: () => ({}),
  connect: ({ api }) => ({ root: { attrs: {}, on: api.handlers } }),
});

type Handlers = Record<string, (event: Event) => void>;

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

describe('createPress nesting', () => {
  /**
   * Starts a pressable on `element`. With `host`, listeners are delegated in
   * the capture phase as in the element adapter; without, they sit on the
   * element in the bubble phase, as React's do.
   */
  function mountPressable(element: HTMLElement, host?: HTMLElement) {
    const presses: string[] = [];
    const instance = createInstance(emitting, {
      props: {
        onPress: (detail: PressEvent) => presses.push(detail.pointerType),
      },
    });
    if (host) {
      const binder = createBinder(instance, { host });
      binder.attach('root', element);
      instance.start();
      binder.start();
    } else {
      instance.attach('root', element);
      instance.start();
      const on = () => instance.connect().root.on as Handlers;
      for (const type of Object.keys(on())) {
        element.addEventListener(type, (event) => on()[type]!(event));
      }
    }
    return presses;
  }

  function render() {
    const outerHost = document.createElement('div');
    outerHost.innerHTML = `
      <div id="outer" tabindex="0">Card
        <div id="inner-host"><button id="inner">Inner</button></div>
      </div>`;
    document.body.append(outerHost);
    return {
      outerHost,
      innerHost: outerHost.querySelector<HTMLElement>('#inner-host')!,
      outer: outerHost.querySelector<HTMLElement>('#outer')!,
      inner: outerHost.querySelector<HTMLElement>('#inner')!,
    };
  }

  it('lets only the innermost pressable handle, outer seeing events first', async () => {
    const { outerHost, innerHost, outer, inner } = render();
    const outerPresses = mountPressable(outer, outerHost);
    const innerPresses = mountPressable(inner, innerHost);

    await userEvent.click(inner);
    inner.click();
    inner.focus();
    await userEvent.keyboard('{Enter}');
    expect(innerPresses).toEqual(['mouse', 'virtual', 'keyboard']);
    expect(outerPresses).toEqual([]);

    await userEvent.click(outer, { position: { x: 4, y: 4 } });
    expect(outerPresses).toEqual(['mouse']);
  });

  it('lets only the innermost pressable handle, inner seeing events first', async () => {
    const { outer, inner } = render();
    const outerPresses = mountPressable(outer);
    const innerPresses = mountPressable(inner);

    await userEvent.click(inner);
    inner.click();
    expect(innerPresses).toEqual(['mouse', 'virtual']);
    expect(outerPresses).toEqual([]);
  });
});

describe('createPress on macOS', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup() {
    const element = root();
    element.tabIndex = 0;
    const presses: string[] = [];
    const instance = createInstance(emitting, {
      props: { onPress: (detail: PressEvent) => presses.push(detail.key!) },
    });
    instance.attach('root', element);
    instance.start();
    const on = instance.connect().root.on as Handlers;
    element.addEventListener('keydown', (event) => on.keydown!(event));
    element.focus();
    return { element, presses };
  }

  const key = (target: EventTarget, type: string, init: KeyboardEventInit) =>
    target.dispatchEvent(
      new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }),
    );

  it('finishes a press when Meta is released, since the keyup never comes', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { element, presses } = setup();
    key(element, 'keydown', { key: 'Meta', metaKey: true });
    key(element, 'keydown', { key: 'Enter', metaKey: true });
    key(element, 'keyup', { key: 'Meta' });
    expect(presses).toEqual(['Enter']);
  });

  it('waits for the real keyup elsewhere', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    const { element, presses } = setup();
    key(element, 'keydown', { key: 'Enter', metaKey: true });
    key(element, 'keyup', { key: 'Meta' });
    expect(presses).toEqual([]);
    key(element, 'keyup', { key: 'Enter' });
    expect(presses).toEqual(['Enter']);
  });
});
