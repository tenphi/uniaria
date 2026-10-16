import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineComponent, prop } from '../runtime';
import { createBinder } from './binder';
import { createHover } from './hover';

const hoverable = defineComponent({
  name: 'hoverable',
  parts: ['root'],
  props: { isDisabled: prop(false) },
  setup(ctx) {
    return createHover(ctx, { part: 'root', isDisabled: ctx.props.isDisabled });
  },
  expose: ({ api }) => ({ isHovered: api.isHovered() }),
  connect: ({ api }) => ({
    root: {
      attrs: { 'data-hovered': api.isHovered() ? '' : undefined },
      on: api.handlers,
    },
  }),
});

function mount(props: { isDisabled?: boolean } = {}) {
  const host = document.createElement('div');
  host.innerHTML =
    '<div data-part="root" style="height: 40px">Hover <b>me</b></div>' +
    '<div id="outside" style="height: 40px">Outside</div>';
  document.body.append(host);
  const root = host.querySelector<HTMLElement>('[data-part="root"]')!;
  const outside = host.querySelector<HTMLElement>('#outside')!;
  const instance = createInstance(hoverable, { props });
  const binder = createBinder(instance, { host });
  binder.attach('root', root);
  instance.start();
  binder.start();
  const isHovered = () => instance.getState().isHovered;
  return { root, outside, instance, isHovered };
}

function enter(target: Element, pointerType = 'mouse') {
  target.dispatchEvent(new PointerEvent('pointerenter', { pointerType }));
}

function over(target: Element) {
  target.dispatchEvent(
    new PointerEvent('pointerover', { pointerType: 'mouse', bubbles: true }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('createHover', () => {
  it('ignores touch, and the mouse enter iOS emulates after a tap', () => {
    const { root, isHovered } = mount();
    // A second back, so the real clock is past the window once restored.
    let now = performance.now() - 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    enter(root, 'touch');
    expect(isHovered()).toBe(false);

    root.dispatchEvent(
      new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }),
    );
    now += 100;
    enter(root);
    expect(isHovered()).toBe(false);

    now += 400;
    enter(root);
    expect(isHovered()).toBe(true);
  });

  it('hovers for pen as well as mouse', () => {
    const { root, isHovered } = mount();
    enter(root, 'pen');
    expect(isHovered()).toBe(true);
  });

  it('never starts while disabled, and ends when disabled', () => {
    const { root, instance, isHovered } = mount({ isDisabled: true });
    enter(root);
    expect(isHovered()).toBe(false);

    instance.setProps({ isDisabled: false });
    instance.sync();
    enter(root);
    expect(isHovered()).toBe(true);
    expect(root.hasAttribute('data-hovered')).toBe(true);

    instance.setProps({ isDisabled: true });
    instance.sync();
    expect(isHovered()).toBe(false);
    expect(root.hasAttribute('data-hovered')).toBe(false);
  });

  it('ends when the pointer is over something outside without a leave', () => {
    const { root, outside, isHovered } = mount();
    enter(root);
    over(root.querySelector('b')!);
    expect(isHovered()).toBe(true);

    over(outside);
    expect(isHovered()).toBe(false);
  });

  it('ends when the instance stops', () => {
    const { root, instance, isHovered } = mount();
    enter(root);
    instance.stop();
    expect(isHovered()).toBe(false);
  });

  // Last: real pointer moves leave the mouse where they end.
  it('follows a real mouse in and out, through child elements', async () => {
    const { root, outside, isHovered } = mount();
    await userEvent.hover(root.querySelector('b')!);
    expect(isHovered()).toBe(true);
    await userEvent.hover(root);
    expect(isHovered()).toBe(true);
    await userEvent.hover(outside);
    expect(isHovered()).toBe(false);
  });
});
