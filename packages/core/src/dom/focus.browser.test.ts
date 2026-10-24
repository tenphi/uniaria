import { afterEach, describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';

import { createInstance, defineBehavior, prop } from '../runtime';
import { createBinder } from './binder';
import { createFocus, createPressFocus } from './focus';
import { modalityTrackerFor } from './modality';

const focusable = defineBehavior({
  name: 'focusable',
  parts: ['root'],
  props: { isTextInput: prop(false) },
  setup(ctx) {
    return createFocus(ctx, 'root', { isTextInput: ctx.props.isTextInput });
  },
  expose: ({ api }) => ({
    isFocused: api.isFocused(),
    isFocusVisible: api.isFocusVisible(),
  }),
  connect: ({ api }) => ({ root: { attrs: {}, on: api.handlers } }),
});

// A div with tabindex, because Safari doesn't focus buttons on click; the
// button before it has one because WebKit's Tab skips buttons without.
const ROOT = '<div data-uni="focusable" tabindex="0">Root <b>child</b></div>';

function mount(
  html = ROOT,
  props: { isTextInput?: boolean } = {},
  { isAttached = true } = {},
) {
  const host = document.createElement('div');
  host.innerHTML = `<button id="before" tabindex="0">Before</button>${html}`;
  document.body.append(host);
  const root = host.querySelector<HTMLElement>('[data-uni="focusable"]')!;
  const instance = createInstance(focusable, { props });
  const binder = createBinder(instance, { host });
  if (isAttached) binder.attach('root', root);
  instance.start();
  binder.start();
  return { root, instance, binder, state: () => instance.getState() };
}

/** Real mouse input, from the commands `@uniaria/testing` registers. */
const mouse = commands as unknown as {
  uniPointerDown(selector: string, button: 'left'): Promise<void>;
  uniPointerMove(selector: string, where: 'center'): Promise<void>;
  uniPointerUp(button: 'left'): Promise<void>;
};
let isHeld = false;
const pointer = {
  async down(element: Element) {
    await mouse.uniPointerDown(`#${element.id}`, 'left');
    isHeld = true;
  },
  move: (element: Element) => mouse.uniPointerMove(`#${element.id}`, 'center'),
  async up() {
    await mouse.uniPointerUp('left');
    isHeld = false;
  },
};

const stops: (() => void)[] = [];

afterEach(async () => {
  if (isHeld) await pointer.up();
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

describe('createFocus', () => {
  it('shows focus after Tab, not after a click, and after a key while focused', async () => {
    const { root, state } = mount();

    await userEvent.click(root);
    expect(document.activeElement).toBe(root);
    expect(state()).toEqual({ isFocused: true, isFocusVisible: false });

    await userEvent.keyboard('{ArrowDown}');
    expect(state()).toEqual({ isFocused: true, isFocusVisible: true });

    await userEvent.click(root);
    expect(state().isFocusVisible).toBe(false);
    await userEvent.tab({ shift: true });
    expect(state()).toEqual({ isFocused: false, isFocusVisible: false });
    await userEvent.tab();
    expect(state()).toEqual({ isFocused: true, isFocusVisible: true });
  });

  it('ignores focus on descendants', () => {
    const { root, state } = mount(
      '<div data-uni="focusable"><button>Inner</button></div>',
    );
    root.querySelector('button')!.focus();
    expect(state().isFocused).toBe(false);
  });

  it('keeps focus hidden while typing into a text field, until Tab or Escape', async () => {
    const { root, state } = mount('<input data-uni="focusable" />');
    await userEvent.click(root);
    expect(state()).toEqual({ isFocused: true, isFocusVisible: false });

    await userEvent.keyboard('ab');
    expect(state().isFocusVisible).toBe(false);
    await userEvent.keyboard('{Escape}');
    expect(state().isFocusVisible).toBe(true);
  });

  it('treats any part as a text field with isTextInput', async () => {
    const { root, state } = mount(ROOT, { isTextInput: true });
    await userEvent.click(root);
    await userEvent.keyboard('a');
    expect(state()).toEqual({ isFocused: true, isFocusVisible: false });
  });

  it('picks up focus the part already has when it arrives after start', () => {
    const { root, binder, instance, state } = mount(
      ROOT,
      {},
      {
        isAttached: false,
      },
    );
    root.focus();
    expect(state().isFocused).toBe(false);

    binder.attach('root', root);
    expect(state()).toEqual({
      isFocused: true,
      isFocusVisible: modalityTrackerFor(root)!.isFocusVisible(),
    });

    instance.stop();
    expect(state()).toEqual({ isFocused: false, isFocusVisible: false });
  });
});

const pressFocusable = defineBehavior({
  name: 'press-focusable',
  parts: ['root', 'input'],
  props: {},
  setup: (ctx) => createPressFocus(ctx, 'input'),
  expose: () => ({}),
  connect: ({ api }) => ({
    root: { attrs: {}, on: api.handlers },
    input: { attrs: {}, on: api.handlers },
  }),
});

describe('createPressFocus', () => {
  /** A checkbox in its label, the root, and a box below it. */
  function mountToggle() {
    const host = document.createElement('div');
    host.innerHTML =
      '<label id="label" style="display: block; height: 30px">' +
      '<input id="box" type="checkbox"> Box</label>' +
      '<div id="away" style="height: 30px">Away</div>';
    document.body.append(host);
    const label = host.querySelector<HTMLElement>('#label')!;
    const box = host.querySelector<HTMLInputElement>('#box')!;
    const instance = createInstance(pressFocusable, { props: {} });
    const binder = createBinder(instance, { host });
    binder.attach('root', label);
    binder.attach('input', box);
    instance.start();
    binder.start();
    stops.push(() => {
      binder.stop();
      instance.stop();
    });
    return { label, box, away: host.querySelector<HTMLElement>('#away')! };
  }

  it('focuses the control as a press on it or on its label ends', async () => {
    const { label, box, away } = mountToggle();
    await pointer.down(label);
    await pointer.up();
    expect(document.activeElement).toBe(box);
    expect(box.checked).toBe(true);

    await pointer.down(away);
    await pointer.up();
    expect(document.activeElement).not.toBe(box);
    await pointer.down(box);
    await pointer.up();
    expect(document.activeElement).toBe(box);
    expect(box.checked).toBe(false);
  });

  it('moves no focus for a press that ends elsewhere, or starts elsewhere after one', async () => {
    const { label, box, away } = mountToggle();
    await pointer.down(label);
    await pointer.move(away);
    await pointer.up();
    expect(document.activeElement).not.toBe(box);

    await pointer.down(away);
    await pointer.move(label);
    await pointer.up();
    expect(document.activeElement).not.toBe(box);
    expect(box.checked).toBe(false);
  });

  it('moves no focus for a press on the control whose mousedown is prevented, as Chromium', async () => {
    const { label, box } = mountToggle();
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('mousedown', prevent);
    try {
      await pointer.down(box);
      await pointer.up();
      expect(box.checked).toBe(true);
      expect(document.activeElement).not.toBe(box);

      // A label focuses it all the same, in Chromium natively.
      await pointer.down(label);
      await pointer.up();
      expect(box.checked).toBe(false);
      expect(document.activeElement).toBe(box);
    } finally {
      document.removeEventListener('mousedown', prevent);
    }
  });
});
