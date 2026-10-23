import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineBehavior, event, prop } from '../runtime';
import { interactOutside } from './interact-outside';
import { createLayer, isTopLayer } from './layers';
import { createPress } from './press';
import type { PressEvent } from './press';
import type { DismissReason } from './layers';

const layer = defineBehavior({
  name: 'layer',
  parts: ['root'],
  props: {
    isOpen: prop(true),
    isDismissable: prop(true),
    isKeyboardDismissDisabled: prop(false),
    shouldCloseOnBlur: prop(false),
    isModal: prop(false),
    source: prop<string | undefined>(undefined, { type: 'string' }),
  },
  events: { dismiss: event<DismissReason>() },
  setup(ctx) {
    const { props } = ctx;
    return createLayer(ctx, {
      part: 'root',
      isOpen: props.isOpen,
      isDismissable: props.isDismissable,
      isKeyboardDismissDisabled: props.isKeyboardDismissDisabled,
      shouldCloseOnBlur: (next) =>
        props.shouldCloseOnBlur() && !next.closest('[data-keep-focus]'),
      shouldCloseOnInteractOutside: (target) =>
        !target.closest('[data-keep-open]'),
      isModal: props.isModal,
      ...(props.source() === undefined
        ? {}
        : { source: () => document.getElementById(props.source()!) }),
      onDismiss: (reason) => ctx.emit('dismiss', reason),
    });
  },
  expose: () => ({}),
  connect: () => ({ root: { attrs: {} } }),
});

const pressable = defineBehavior({
  name: 'pressable',
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

interface LayerProps {
  isOpen?: boolean;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  shouldCloseOnBlur?: boolean;
  isModal?: boolean;
  source?: string;
}

const running: { stop(): void }[] = [];
/** Every layer's id, in the order they were dismissed. */
const dismissed: string[] = [];
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
    dismissed.push(id);
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
  return { reasons, set, api: instance.api };
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
  dismissed.length = 0;
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
    // Safari's composition-commit keydown: not composing, but keyCode 229.
    escape(byId('in'), { keyCode: 229 });
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

  // Owner decision (2026-10-14), after Cube UI Kit: one click outside a
  // popover both closes it and acts on what it hit.
  it('lets a pressable outside press in the same click that closes the layer', async () => {
    render(`<div id="layer">In</div><div id="out" tabindex="0">Out</div>`);
    const presses: string[] = [];
    const instance = createInstance(pressable, {
      props: {
        onPress: (detail: PressEvent) => presses.push(detail.pointerType),
      },
    });
    running.push(instance);
    instance.attach('root', byId('out'));
    instance.start();
    const on = instance.connect().root.on as Record<string, (e: Event) => void>;
    for (const type of Object.keys(on)) {
      byId('out').addEventListener(type, (event) => on[type]!(event));
    }
    const { reasons } = open('layer');

    await userEvent.click(byId('out'));
    expect(reasons).toEqual(['outside']);
    expect(presses).toEqual(['mouse']);
  });

  it('lets a click outside open another layer, which that click leaves open', async () => {
    render(`<div id="first">First</div><div id="second">Second</div>
      <button id="trigger">Open second</button>`);
    const first = open('first');
    let second: ReturnType<typeof open> | undefined;
    byId('trigger').addEventListener('click', () => {
      second = open('second');
    });

    await userEvent.click(byId('trigger'));
    expect(first.reasons).toEqual(['outside']);
    expect(second?.reasons).toEqual([]);
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

  // Popover spec, Resolved questions 9: as the native popover's light
  // dismiss, not React Aria's one layer per click.
  it('closes every layer the press is outside of, top down', async () => {
    render(`<div id="first">First</div><div id="second">Second</div>
      <button id="out">Out</button>`);
    const first = open('first');
    const second = open('second');
    await userEvent.click(byId('out'));
    expect(second.reasons).toEqual(['outside']);
    expect(first.reasons).toEqual(['outside']);
    expect(dismissed).toEqual(['second', 'first']);
  });

  it('stops at a layer that holds the press; one that stays open does not stop it', async () => {
    render(`<div id="parent"><button id="p">P</button>
      <div id="child">Child</div></div><button id="out">Out</button>`);
    const parent = open('parent');
    const child = open('child');
    await userEvent.click(byId('p'));
    expect(child.reasons).toEqual(['outside']);
    expect(parent.reasons).toEqual([]);

    const strict = open('child', { isDismissable: false });
    await userEvent.click(byId('out'));
    expect(strict.reasons).toEqual([]);
    expect(parent.reasons).toEqual(['outside']);
  });

  it('a modal layer closes only on top and shields the layers below', async () => {
    render(`<div id="page">Page</div><div id="modal"><button id="m">M</button></div>
      <div id="popover">Popover</div><button id="out">Out</button>`);
    const page = open('page');
    const modal = open('modal', { isModal: true });
    const popover = open('popover');
    await userEvent.click(byId('out'));
    expect(popover.reasons).toEqual(['outside']);
    expect(modal.reasons).toEqual([]);
    expect(page.reasons).toEqual([]);
    await userEvent.click(byId('out'));
    expect(modal.reasons).toEqual(['outside']);
    expect(page.reasons).toEqual([]);
  });

  it('reports a press that will close it from pointer down to its click', async () => {
    render(`<div id="layer">In</div><button id="out">Out</button>
      <button id="keep" data-keep-open>Keep</button>`);
    const { api } = open('layer');
    const seen: boolean[] = [];
    for (const id of ['out', 'keep']) {
      byId(id).addEventListener('mousedown', () =>
        seen.push(api.isClosingPress()),
      );
    }
    await userEvent.click(byId('keep'));
    expect(api.isClosingPress()).toBe(false);
    await userEvent.click(byId('out'));
    expect(seen).toEqual([false, true]);
    expect(api.isClosingPress()).toBe(false);
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

describe('createLayer parent', () => {
  it('closes the layers above that it holds, or whose source it holds', () => {
    render(`<div id="parent"><button id="t">T</button>
        <div id="inner">Inner</div><div id="plain">Plain</div></div>
      <div id="sourced">Sourced</div><div id="unrelated">Unrelated</div>`);
    const parent = open('parent');
    const inner = open('inner', { source: 'none' });
    const plain = open('plain');
    const sourced = open('sourced', { source: 't' });
    const unrelated = open('unrelated', { source: 'none' });
    parent.set({ isOpen: false });
    expect(inner.reasons).toEqual(['parent']);
    expect(sourced.reasons).toEqual(['parent']);
    expect(plain.reasons).toEqual([]);
    expect(unrelated.reasons).toEqual([]);
  });

  it('closes no one when it stops while open', () => {
    render(`<div id="parent"><div id="inner">Inner</div></div>`);
    open('parent');
    const inner = open('inner', { source: 'none' });
    running[0]!.stop();
    expect(inner.reasons).toEqual([]);
  });
});

describe('isTopLayer', () => {
  it('is true only for the topmost open layer', () => {
    render(`<div id="first">First</div><div id="second">Second</div>`);
    expect(isTopLayer(byId('first'))).toBe(false);
    open('first');
    expect(isTopLayer(byId('first'))).toBe(true);
    const second = open('second');
    expect(isTopLayer(byId('first'))).toBe(false);
    expect(isTopLayer(byId('second'))).toBe(true);
    second.set({ isOpen: false });
    expect(isTopLayer(byId('first'))).toBe(true);
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

  // A modal dialog's backdrop is the dialog: its clicks target it.
  it("counts a press on a modal dialog's backdrop, not on its padding", async () => {
    render(`<dialog id="dialog" style="padding: 40px; width: 200px">
      <button id="in">In</button></dialog>`);
    const dialog = byId('dialog') as HTMLDialogElement;
    dialog.showModal();
    const onInteract = vi.fn();
    const stop = interactOutside(dialog, { onInteract });

    await userEvent.click(dialog, { position: { x: 5, y: 5 } });
    expect(onInteract).not.toHaveBeenCalled();
    // One press beyond each side.
    const { width, height } = dialog.getBoundingClientRect();
    for (const [x, y] of [
      [-20, height / 2],
      [width + 20, height / 2],
      [width / 2, -20],
      [width / 2, height + 20],
    ] as const) {
      await userEvent.click(dialog, { position: { x, y } });
    }
    expect(onInteract).toHaveBeenCalledTimes(4);
    expect(onInteract.mock.calls[0]![0].target).toBe(dialog);
    stop();
    dialog.close();
  });

  // A pseudo-element's press targets its element, wherever it is drawn.
  it("counts a press on an element's own pseudo-element as inside", async () => {
    render(`<div id="inside">In</div>`);
    const style = document.createElement('style');
    style.textContent = `#inside { position: relative; width: 100px }
      #inside::after { content: ''; position: absolute; top: 100%; left: 0;
        width: 100px; height: 40px }`;
    document.body.append(style);
    const onInteract = vi.fn();
    const stop = interactOutside(byId('inside'), { onInteract });
    const { height } = byId('inside').getBoundingClientRect();
    await userEvent.click(byId('inside'), {
      position: { x: 50, y: height + 20 },
    });
    expect(onInteract).not.toHaveBeenCalled();
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

  it('asks with the element focus moved to', () => {
    render(`<div id="layer"><button id="in">In</button></div>
      <button id="trigger" data-keep-focus>Trigger</button>`);
    const { reasons } = open('layer', { shouldCloseOnBlur: true });
    byId('in').focus();
    byId('trigger').focus();
    expect(reasons).toEqual([]);
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
