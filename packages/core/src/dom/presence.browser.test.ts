import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInstance, defineBehavior, prop } from '../runtime';
import { createBinder } from './binder';
import { createPresence } from './presence';
import { partEffect } from './types';

const overlay = defineBehavior({
  name: 'overlay',
  parts: ['root'],
  props: { isOpen: prop(false) },
  events: {},
  setup(ctx) {
    return createPresence(ctx, { part: 'root', isOpen: ctx.props.isOpen });
  },
  expose: ({ api }) => ({
    isShown: api.isShown(),
    isEntering: api.isEntering(),
    isExiting: api.isExiting(),
  }),
  connect: () => ({ root: { attrs: {} } }),
});

const running: { stop(): void }[] = [];
const byId = (id: string) => document.getElementById(id)!;

function render(html: string, css = ''): void {
  const host = document.createElement('div');
  host.innerHTML = `<style>${css}</style>${html}`;
  document.body.append(host);
}

function mount(id: string, isOpen = false) {
  const instance = createInstance(overlay, { props: { isOpen } });
  running.push(instance);
  instance.attach('root', byId(id));
  instance.start();
  const set = (next: boolean) => {
    instance.setProps({ isOpen: next });
    instance.sync();
  };
  return { instance, set, state: () => instance.getState() };
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
/** Waits until the element has been styled, so a transition has a start. */
const rendered = async () => {
  await frame();
  await frame();
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  for (const instance of running.splice(0)) instance.stop();
  document.body.replaceChildren();
});

describe('createPresence entering', () => {
  it('shows at once and is entering for two frames', async () => {
    render(`<div id="root"></div>`);
    const { set, state } = mount('root');
    expect(state()).toEqual({
      isShown: false,
      isEntering: false,
      isExiting: false,
    });
    set(true);
    expect(state()).toEqual({
      isShown: true,
      isEntering: true,
      isExiting: false,
    });
    await frame();
    expect(state().isEntering).toBe(true);
    await vi.waitFor(() => expect(state().isEntering).toBe(false));
    expect(state().isShown).toBe(true);
  });

  it('is entering for the first frames of an instance that starts open', async () => {
    render(`<div id="root"></div>`);
    const { state } = mount('root', true);
    expect(state()).toEqual({
      isShown: true,
      isEntering: true,
      isExiting: false,
    });
    await vi.waitFor(() => expect(state().isEntering).toBe(false));
  });
});

describe('createPresence with the binder', () => {
  /** Whether the root was `data-entering` each time the overlay showed. */
  const shownEntering: boolean[] = [];

  // An overlay as Dialog's: shown by a part effect, its state written by
  // the binder.
  const shownOverlay = defineBehavior({
    name: 'shown-overlay',
    parts: ['root'],
    props: { isOpen: prop(false) },
    events: {},
    setup(ctx) {
      const presence = createPresence(ctx, {
        part: 'root',
        isOpen: ctx.props.isOpen,
      });
      partEffect(
        ctx,
        'root',
        (root) => {
          shownEntering.push(root.hasAttribute('data-entering'));
        },
        presence.isShown,
      );
      return presence;
    },
    expose: () => ({}),
    connect: ({ api }) => ({
      root: { attrs: { 'data-entering': api.isEntering() ? '' : undefined } },
    }),
  });

  /** Starts as both adapters do: the instance, then the binder, in a batch. */
  function bind(isOpen: boolean) {
    render(`<div id="root"></div>`);
    const instance = createInstance(shownOverlay, { props: { isOpen } });
    const binder = createBinder(instance);
    binder.attach('root', byId('root'));
    instance.batch(() => {
      instance.start();
      binder.start();
    });
    running.push({
      stop() {
        binder.stop();
        instance.stop();
      },
    });
    return instance;
  }

  afterEach(() => {
    shownEntering.length = 0;
  });

  it('shows an opening overlay once it is marked entering', () => {
    const instance = bind(false);
    instance.setProps({ isOpen: true });
    instance.sync();
    expect(shownEntering).toEqual([true]);
  });

  it('shows an overlay open from the start once it is marked entering', () => {
    bind(true);
    expect(shownEntering).toEqual([true]);
  });
});

describe('createPresence exiting', () => {
  it('hides in the next frame when nothing animates', async () => {
    render(`<div id="root"></div>`);
    const { set, state } = mount('root', true);
    set(false);
    expect(state()).toEqual({
      isShown: true,
      isEntering: false,
      isExiting: true,
    });
    await vi.waitFor(() =>
      expect(state()).toEqual({
        isShown: false,
        isEntering: false,
        isExiting: false,
      }),
    );
  });

  it('waits for a transition the exiting styles start', async () => {
    render(
      `<div id="root"></div>`,
      `#root { transition: opacity 200ms linear }
       #root[data-exiting] { opacity: 0 }`,
    );
    const { set, state } = mount('root', true);
    await rendered();
    set(false);
    byId('root').toggleAttribute('data-exiting', true);
    await wait(120);
    expect(state().isShown).toBe(true);
    expect(state().isExiting).toBe(true);
    await vi.waitFor(() => expect(state().isShown).toBe(false));
  });

  it('waits for animations in its subtree and on its backdrop', async () => {
    render(
      `<dialog id="root"><p id="child">Child</p></dialog>`,
      `@keyframes fade { to { opacity: 0 } }
       #root[data-exiting].child #child { animation: fade 200ms linear forwards }
       #root[data-exiting].backdrop::backdrop {
         animation: fade 200ms linear forwards
       }`,
    );
    const dialog = byId('root') as HTMLDialogElement;
    dialog.showModal();
    for (const where of ['child', 'backdrop']) {
      dialog.className = where;
      const { set, state } = mount('root', true);
      set(false);
      dialog.toggleAttribute('data-exiting', true);
      await wait(120);
      expect(state().isShown, where).toBe(true);
      await vi.waitFor(() => expect(state().isShown, where).toBe(false));
      dialog.removeAttribute('data-exiting');
    }
    dialog.close();
  });

  it('does not wait for an infinite animation inside', async () => {
    render(
      `<div id="root"><span id="spinner"></span></div>`,
      `@keyframes spin { to { rotate: 1turn } }
       #spinner { display: block; animation: spin 1s linear infinite }`,
    );
    const { set, state } = mount('root', true);
    set(false);
    await vi.waitFor(() => expect(state().isShown).toBe(false), {
      timeout: 300,
    });
  });

  it('does not wait for a paused animation', async () => {
    render(
      `<div id="root"></div>`,
      `@keyframes fade { to { opacity: 0 } }
       #root { animation: fade 1s linear paused }`,
    );
    const { set, state } = mount('root', true);
    set(false);
    await vi.waitFor(() => expect(state().isShown).toBe(false), {
      timeout: 300,
    });
  });

  it('stays shown when reopened while exiting', async () => {
    render(
      `<div id="root"></div>`,
      `#root { transition: opacity 150ms linear }
       #root[data-exiting] { opacity: 0 }`,
    );
    const { set, state } = mount('root', true);
    await rendered();
    set(false);
    byId('root').toggleAttribute('data-exiting', true);
    await wait(50);
    set(true);
    byId('root').removeAttribute('data-exiting');
    expect(state()).toEqual({
      isShown: true,
      isEntering: true,
      isExiting: false,
    });
    await wait(250);
    expect(state()).toEqual({
      isShown: true,
      isEntering: false,
      isExiting: false,
    });
  });

  it('catches up on start with a close made while stopped', async () => {
    render(`<div id="root"></div>`);
    const { instance, set, state } = mount('root', true);
    instance.stop();
    set(false);
    instance.start();
    expect(state().isExiting).toBe(true);
    await vi.waitFor(() => expect(state().isShown).toBe(false));
  });
});
