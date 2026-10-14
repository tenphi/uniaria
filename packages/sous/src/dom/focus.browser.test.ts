import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineComponent, prop } from '../runtime';
import { createBinder } from './binder';
import { createFocus } from './focus';
import { modalityTrackerFor } from './modality';

const focusable = defineComponent({
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
const ROOT = '<div data-part="root" tabindex="0">Root <b>child</b></div>';

function mount(
  html = ROOT,
  props: { isTextInput?: boolean } = {},
  { isAttached = true } = {},
) {
  const host = document.createElement('div');
  host.innerHTML = `<button id="before" tabindex="0">Before</button>${html}`;
  document.body.append(host);
  const root = host.querySelector<HTMLElement>('[data-part="root"]')!;
  const instance = createInstance(focusable, { props });
  const binder = createBinder(instance, { host });
  if (isAttached) binder.attach('root', root);
  instance.start();
  binder.start();
  return { root, instance, binder, state: () => instance.getState() };
}

afterEach(() => {
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
      '<div data-part="root"><button>Inner</button></div>',
    );
    root.querySelector('button')!.focus();
    expect(state().isFocused).toBe(false);
  });

  it('keeps focus hidden while typing into a text field, until Tab or Escape', async () => {
    const { root, state } = mount('<input data-part="root" />');
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
