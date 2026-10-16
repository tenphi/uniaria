import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineComponent, prop } from '../runtime';
import { createFocusWithin } from './focus-within';

const group = defineComponent({
  name: 'group',
  parts: ['root'],
  props: { isDisabled: prop(false) },
  setup(ctx) {
    return createFocusWithin(ctx, {
      part: 'root',
      isDisabled: ctx.props.isDisabled,
    });
  },
  expose: ({ api }) => ({
    isFocusWithin: api.isFocusWithin(),
    isFocusVisible: api.isFocusVisible(),
  }),
  connect: () => ({ root: { attrs: {} } }),
});

function mount(props: { isDisabled?: boolean } = {}) {
  const host = document.createElement('div');
  host.innerHTML = `
    <div data-part="root" tabindex="-1">
      <button id="one">One</button><button id="two">Two</button>
    </div>
    <button id="outside">Outside</button>`;
  document.body.append(host);
  const root = host.querySelector<HTMLElement>('[data-part="root"]')!;
  const instance = createInstance(group, { props });
  instance.attach('root', root);
  instance.start();
  const byId = (id: string) => host.querySelector<HTMLElement>(`#${id}`)!;
  return {
    root,
    instance,
    byId,
    isFocusWithin: () => instance.getState().isFocusWithin,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('createFocusWithin', () => {
  it('is visible after keyboard input inside, not after a click', async () => {
    const { byId, instance } = mount();
    const state = () => instance.getState();

    await userEvent.click(byId('one'));
    expect(state()).toEqual({ isFocusWithin: true, isFocusVisible: false });

    await userEvent.keyboard('{ArrowDown}');
    expect(state()).toEqual({ isFocusWithin: true, isFocusVisible: true });

    // Focus moving inside takes the modality it came by.
    await userEvent.click(byId('two'));
    expect(state()).toEqual({ isFocusWithin: true, isFocusVisible: false });

    byId('outside').focus();
    expect(state()).toEqual({ isFocusWithin: false, isFocusVisible: false });
  });

  it('holds while focus moves inside, and ends when it leaves', () => {
    const { root, byId, instance, isFocusWithin } = mount();
    const changes: boolean[] = [];
    instance.subscribe(() => changes.push(isFocusWithin()));

    byId('one').focus();
    byId('two').focus();
    root.focus();
    expect(isFocusWithin()).toBe(true);
    expect(changes).toEqual([true]);

    byId('outside').focus();
    expect(isFocusWithin()).toBe(false);
    byId('one').focus();
    byId('one').blur();
    expect(isFocusWithin()).toBe(false);
  });

  it('ends when the focused element is removed and focus lands outside', () => {
    // Chromium fires focusout on removal; WebKit doesn't, and the document
    // focusin ends it there.
    const { byId, isFocusWithin } = mount();
    byId('one').focus();
    byId('one').remove();
    byId('outside').focus();
    expect(isFocusWithin()).toBe(false);
  });

  it('stays off while disabled, and ends when disabled', () => {
    const { byId, instance, isFocusWithin } = mount({ isDisabled: true });
    byId('one').focus();
    expect(isFocusWithin()).toBe(false);

    byId('outside').focus();
    instance.setProps({ isDisabled: false });
    instance.sync();
    byId('one').focus();
    expect(isFocusWithin()).toBe(true);
    instance.setProps({ isDisabled: true });
    instance.sync();
    expect(isFocusWithin()).toBe(false);
  });

  it('picks up focus already inside when the part arrives', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div><button>In</button></div>';
    document.body.append(host);
    const root = host.firstElementChild as HTMLElement;
    root.querySelector('button')!.focus();
    const instance = createInstance(group);
    instance.start();
    instance.attach('root', root);
    expect(instance.getState().isFocusWithin).toBe(true);
    instance.stop();
    expect(instance.getState().isFocusWithin).toBe(false);
  });
});
