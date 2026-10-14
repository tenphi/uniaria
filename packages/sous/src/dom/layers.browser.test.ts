import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineComponent, event, prop } from '../runtime';
import { interactOutside } from './interact-outside';
import { createLayer } from './layers';
import type { DismissReason } from './layers';

const layer = defineComponent({
  name: 'layer',
  parts: ['root'],
  props: {
    isOpen: prop(true),
    isDismissable: prop(true),
    isKeyboardDismissDisabled: prop(false),
    shouldCloseOnBlur: prop(false),
  },
  events: { dismiss: event<DismissReason>() },
  setup(ctx) {
    createLayer(ctx, {
      part: 'root',
      isOpen: ctx.props.isOpen,
      isDismissable: ctx.props.isDismissable,
      isKeyboardDismissDisabled: ctx.props.isKeyboardDismissDisabled,
      shouldCloseOnBlur: ctx.props.shouldCloseOnBlur,
      shouldCloseOnInteractOutside: (target) =>
        !target.closest('[data-keep-open]'),
      onDismiss: (reason) => ctx.emit('dismiss', reason),
    });
    return {};
  },
  expose: () => ({}),
  connect: () => ({ root: { attrs: {} } }),
});

interface LayerProps {
  isOpen?: boolean;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  shouldCloseOnBlur?: boolean;
}

const running: { stop(): void }[] = [];
const byId = (id: string) => document.getElementById(id)!;

function render(html: string): void {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
}

/** Opens a layer on the element with this id; it closes when dismissed. */
function open(id: string, props: LayerProps = {}) {
  const reasons: DismissReason[] = [];
  const instance = createInstance(layer, {
    props: { ...props, onDismiss: (reason: DismissReason) => close(reason) },
  });
  function close(reason: DismissReason) {
    reasons.push(reason);
    set({ isOpen: false });
  }
  function set(next: LayerProps) {
    instance.setProps({ ...instance.getProps(), ...next });
    instance.sync();
  }
  running.push(instance);
  instance.attach('root', byId(id));
  instance.start();
  return { reasons, set };
}

function escape(target: Element, init: KeyboardEventInit = {}) {
  const keydown = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(keydown);
  return keydown;
}

afterEach(() => {
  for (const instance of running.splice(0)) instance.stop();
  document.body.replaceChildren();
});

describe('createLayer Escape', () => {
  it('closes on Escape inside, preventing its default', () => {
    render(
      `<div id="layer"><button id="in">In</button></div><button id="out">Out</button>`,
    );
    const { reasons } = open('layer');
    expect(escape(byId('out')).defaultPrevented).toBe(false);
    expect(reasons).toEqual([]);

    expect(escape(byId('in')).defaultPrevented).toBe(true);
    expect(reasons).toEqual(['escape']);
    // Closed: a second Escape does nothing.
    expect(escape(byId('in')).defaultPrevented).toBe(false);
  });

  it('ignores repeats, composition, modifiers and a prevented Escape', () => {
    render(`<div id="layer"><button id="in">In</button></div>`);
    const { reasons } = open('layer');
    escape(byId('in'), { repeat: true });
    escape(byId('in'), { isComposing: true });
    escape(byId('in'), { shiftKey: true });
    byId('in').addEventListener('keydown', (event) => event.preventDefault(), {
      once: true,
    });
    escape(byId('in'));
    expect(reasons).toEqual([]);
  });

  it('leaves Escape alone when keyboard dismiss is disabled', () => {
    render(`<div id="layer"><button id="in">In</button></div>`);
    const { reasons } = open('layer', { isKeyboardDismissDisabled: true });
    expect(escape(byId('in')).defaultPrevented).toBe(false);
    expect(reasons).toEqual([]);
  });

  it('closes only the top layer, one per Escape', () => {
    render(`<div id="parent"><button id="p">P</button>
      <div id="child"><button id="c">C</button></div></div>`);
    const parent = open('parent');
    const child = open('child');
    escape(byId('c'));
    expect(child.reasons).toEqual(['escape']);
    expect(parent.reasons).toEqual([]);
    escape(byId('c'));
    expect(parent.reasons).toEqual(['escape']);
  });

  it('does nothing below the top, even with focus there', () => {
    render(`<div id="parent"><button id="p">P</button></div>
      <div id="child"><button id="c">C</button></div>`);
    const parent = open('parent');
    open('child');
    escape(byId('p'));
    expect(parent.reasons).toEqual([]);
  });
});

describe('createLayer outside press', () => {
  it('closes on a press outside, which still reaches its target', async () => {
    render(
      `<div id="layer"><button id="in">In</button></div><button id="out">Out</button>`,
    );
    const onClick = vi.fn();
    byId('out').addEventListener('click', onClick);
    const { reasons } = open('layer');
    await userEvent.click(byId('in'));
    expect(reasons).toEqual([]);
    await userEvent.click(byId('out'));
    expect(reasons).toEqual(['outside']);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stays open when not dismissable, or when the target says so', async () => {
    render(`<div id="layer">In</div><button id="out">Out</button>
      <button id="keep" data-keep-open>Keep</button>`);
    const { reasons, set } = open('layer', { isDismissable: false });
    await userEvent.click(byId('out'));
    set({ isDismissable: true });
    await userEvent.click(byId('keep'));
    expect(reasons).toEqual([]);
  });

  it('closes only the layer that was on top at pointer down', async () => {
    render(`<div id="first">First</div><div id="second">Second</div>
      <button id="out">Out</button>`);
    const first = open('first');
    const second = open('second');
    await userEvent.click(byId('out'));
    expect(second.reasons).toEqual(['outside']);
    expect(first.reasons).toEqual([]);
    await userEvent.click(byId('out'));
    expect(first.reasons).toEqual(['outside']);
  });

  it('closes a parent from inside it only once the child is gone', async () => {
    render(`<div id="parent"><button id="p">P</button></div>
      <div id="child">Child</div>`);
    const parent = open('parent');
    const child = open('child');
    await userEvent.click(byId('p'));
    expect(child.reasons).toEqual(['outside']);
    expect(parent.reasons).toEqual([]);
  });
});

describe('interactOutside', () => {
  const pointer = (target: Element, type: string, button = 0) =>
    target.dispatchEvent(
      new PointerEvent(type, { button, bubbles: true, composed: true }),
    );

  it('needs both the pointer down and the click outside, with the primary button', () => {
    render(`<div id="inside">In</div><button id="out">Out</button>`);
    const onInteract = vi.fn();
    const stop = interactOutside(byId('inside'), { onInteract });

    pointer(byId('inside'), 'pointerdown');
    pointer(byId('out'), 'click');
    pointer(byId('out'), 'pointerdown', 2);
    pointer(byId('out'), 'click', 2);
    expect(onInteract).not.toHaveBeenCalled();

    pointer(byId('out'), 'pointerdown');
    pointer(byId('out'), 'click');
    expect(onInteract).toHaveBeenCalledTimes(1);
    stop();
  });

  it('ignores a press that began before it listened, and removed targets', () => {
    render(`<div id="inside">In</div><button id="out">Out</button>`);
    const onInteract = vi.fn();
    pointer(byId('out'), 'pointerdown');
    const stop = interactOutside(byId('inside'), { onInteract });
    pointer(byId('out'), 'click');

    const doomed = byId('out');
    pointer(doomed, 'pointerdown');
    doomed.remove();
    doomed.dispatchEvent(new PointerEvent('click', { button: 0 }));
    expect(onInteract).not.toHaveBeenCalled();
    stop();
  });
});

describe('createLayer blur', () => {
  it('closes when focus moves outside, not when it goes nowhere', () => {
    render(
      `<div id="layer"><button id="in">In</button></div><button id="out">Out</button>`,
    );
    const { reasons } = open('layer', { shouldCloseOnBlur: true });
    byId('in').focus();
    byId('in').blur();
    expect(reasons).toEqual([]);
    byId('in').focus();
    byId('out').focus();
    expect(reasons).toEqual(['blur']);
  });

  it('stays open when focus moves into a layer above', () => {
    render(`<div id="menu"><button id="item">Item</button></div>
      <div id="submenu"><button id="sub">Sub</button></div>`);
    const menu = open('menu', { shouldCloseOnBlur: true });
    open('submenu');
    byId('item').focus();
    byId('sub').focus();
    expect(menu.reasons).toEqual([]);
  });
});
