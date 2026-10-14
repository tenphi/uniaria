import { describe, expect, it, vi } from 'vitest';

import { createInstance, defineComponent } from '../runtime';
import { mergeHandlers, partEffect } from './types';

function probe() {
  const calls: string[] = [];
  const definition = defineComponent({
    name: 'probe',
    parts: ['root'],
    props: {},
    setup(ctx) {
      partEffect(ctx, 'root', (element) => {
        calls.push(`run ${element.id}`);
        return () => calls.push(`clean ${element.id}`);
      });
      return {};
    },
    expose: () => ({}),
    connect: () => ({ root: { attrs: {} } }),
  });
  return { instance: createInstance(definition), calls };
}

function element(id: string): HTMLElement {
  const div = document.createElement('div');
  div.id = id;
  return div;
}

describe('partEffect', () => {
  it('runs with the part element while started, and again for a new one', () => {
    const { instance, calls } = probe();
    const a = element('a');
    const b = element('b');

    instance.attach('root', a);
    expect(calls).toEqual([]);
    instance.start();
    expect(calls).toEqual(['run a']);

    instance.attach('root', b);
    instance.attach('root', null);
    instance.attach('root', a);
    expect(calls).toEqual(['run a', 'clean a', 'run b', 'clean b', 'run a']);

    instance.stop();
    instance.attach('root', b);
    expect(calls.slice(5)).toEqual(['clean a']);
    instance.start();
    expect(calls.slice(6)).toEqual(['run b']);
  });

  it('waits for a part that arrives after start', () => {
    const { instance, calls } = probe();
    instance.start();
    expect(calls).toEqual([]);
    instance.attach('root', element('late'));
    expect(calls).toEqual(['run late']);
  });
});

describe('mergeHandlers', () => {
  it('runs every handler for an event type, in order', () => {
    const order: string[] = [];
    const first = vi.fn(() => order.push('first'));
    const second = vi.fn(() => order.push('second'));
    const merged = mergeHandlers(
      { click: first },
      { click: second, keydown: second },
    );
    const event = new PointerEvent('click');
    merged.click!(event);
    expect(order).toEqual(['first', 'second']);
    expect(first).toHaveBeenCalledWith(event);
    expect(merged.keydown).toBe(second);
  });
});
