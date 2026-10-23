import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createInstance, defineBehavior, prop } from '../runtime';
import { createFocusScope } from './focus-scope';

const scoped = defineBehavior({
  name: 'scoped',
  parts: ['root'],
  props: {
    isOpen: prop(true),
    shouldContain: prop(false),
    shouldRestoreFocus: prop(false),
    shouldAutoFocus: prop(false),
  },
  setup(ctx) {
    createFocusScope(ctx, {
      part: 'root',
      isActive: ctx.props.isOpen,
      shouldContain: ctx.props.shouldContain,
      shouldRestoreFocus: ctx.props.shouldRestoreFocus,
      shouldAutoFocus: ctx.props.shouldAutoFocus,
    });
    return {};
  },
  expose: () => ({}),
  connect: () => ({ root: { attrs: {} } }),
});

interface ScopeProps {
  isOpen?: boolean;
  shouldContain?: boolean;
  shouldRestoreFocus?: boolean;
  shouldAutoFocus?: boolean;
}

const byId = (id: string) => document.getElementById(id)!;

function render(html: string): void {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
}

const running: { stop(): void }[] = [];

/** Starts a scope on the element with this id. */
function scope(id: string, props: ScopeProps = {}) {
  const instance = createInstance(scoped, { props });
  running.push(instance);
  instance.attach('root', byId(id));
  instance.start();
  return {
    instance,
    set(next: ScopeProps) {
      instance.setProps({ ...instance.getProps(), ...next });
      instance.sync();
    },
  };
}

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The focused element's id; undefined for the body. */
const active = () =>
  document.activeElement === document.body
    ? undefined
    : document.activeElement?.id;

function tabKey(init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const instance of running.splice(0)) instance.stop();
  document.body.replaceChildren();
});

describe('createFocusScope containment', () => {
  it('cycles Tab and Shift+Tab inside, wrapping at both ends', async () => {
    render(`
      <input id="before" />
      <div id="scope"><input id="a" /><button id="b">B</button><input id="c" /></div>
      <input id="after" />`);
    scope('scope', { shouldContain: true });
    byId('a').focus();

    await userEvent.tab();
    expect(active()).toBe('b');
    await userEvent.tab();
    expect(active()).toBe('c');
    await userEvent.tab();
    expect(active()).toBe('a');
    await userEvent.tab({ shift: true });
    expect(active()).toBe('c');
  });

  it('leaves Tab with modifiers alone, and swallows it with nothing tabbable', () => {
    render(`<div id="scope" tabindex="-1"><button id="a">A</button></div>
      <div id="empty" tabindex="-1">Nothing</div>`);
    scope('scope', { shouldContain: true });
    byId('a').focus();
    expect(tabKey({ altKey: true }).defaultPrevented).toBe(false);
    expect(tabKey({ ctrlKey: true }).defaultPrevented).toBe(false);
    document.body.replaceChildren();

    render(`<div id="empty" tabindex="-1">Nothing</div><input id="out" />`);
    scope('empty', { shouldContain: true });
    byId('empty').focus();
    expect(tabKey().defaultPrevented).toBe(true);
    expect(active()).toBe('empty');
  });

  it('selects the text of an input it tabs into', async () => {
    render(
      `<div id="scope"><button id="a">A</button><input id="b" value="text" /></div>`,
    );
    scope('scope', { shouldContain: true });
    byId('a').focus();
    await userEvent.tab();
    const input = byId('b') as HTMLInputElement;
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
  });

  it('pulls focus back when it moves outside', () => {
    render(`<div id="scope"><button id="a">A</button><button id="b">B</button></div>
      <button id="out">Out</button>`);
    scope('scope', { shouldContain: true });
    byId('b').focus();
    byId('out').focus();
    expect(active()).toBe('b');
  });

  it('restores focus lost to the body after a frame', async () => {
    render(
      `<div id="scope"><button id="a">A</button><button id="b">B</button></div>`,
    );
    scope('scope', { shouldContain: true });
    byId('b').focus();
    byId('b').blur();
    expect(active()).toBeUndefined();
    await frame();
    expect(active()).toBe('b');

    // The observer that sees the removal schedules its own frame.
    byId('b').remove();
    await frame();
    await frame();
    expect(active()).toBe('a');
  });

  it('falls back to the first focusable element once nothing is tabbable', async () => {
    render(`<div id="scope" tabindex="-1"><button id="a">A</button></div>`);
    scope('scope', { shouldContain: true });
    byId('a').focus();
    byId('a').remove();
    await frame();
    await frame();
    expect(active()).toBe('scope');
  });

  it('stops containing when switched off or closed', async () => {
    render(
      `<div id="scope"><button id="a">A</button></div><button id="out">Out</button>`,
    );
    const { set } = scope('scope', { shouldContain: true });
    byId('a').focus();
    byId('a').blur();
    set({ shouldContain: false });
    await frame();
    expect(active()).toBeUndefined();

    set({ shouldContain: true });
    byId('a').focus();
    set({ isOpen: false });
    byId('out').focus();
    expect(active()).toBe('out');
  });

  it('locks Tab in a contained child, and hands back to the parent when it ends', async () => {
    render(`
      <div id="parent"><input id="p1" />
        <div id="child"><input id="c1" /><input id="c2" /></div>
        <input id="p2" />
      </div>`);
    scope('parent', { shouldContain: true });
    byId('p1').focus();
    const child = scope('child', { shouldContain: true });
    byId('c1').focus();

    await userEvent.tab();
    expect(active()).toBe('c2');
    await userEvent.tab();
    expect(active()).toBe('c1');
    // The parent can't take focus back while the child contains.
    byId('p1').focus();
    expect(active()).toBe('c1');

    child.instance.stop();
    byId('p2').focus();
    await userEvent.tab();
    expect(active()).toBe('p1');
  });
});

describe('createFocusScope restore', () => {
  it('returns focus to where it was when the scope ends', async () => {
    render(`<button id="trigger">Open</button>
      <div id="scope"><button id="a">A</button></div>`);
    byId('trigger').focus();
    const { set } = scope('scope', { shouldRestoreFocus: true });
    byId('a').focus();
    set({ isOpen: false });
    byId('scope').hidden = true;
    await frame();
    expect(active()).toBe('trigger');
  });

  it('leaves focus the user moved elsewhere', async () => {
    render(`<button id="trigger">Open</button><button id="other">Other</button>
      <div id="scope"><button id="a">A</button></div>`);
    byId('trigger').focus();
    const { set } = scope('scope', { shouldRestoreFocus: true });
    byId('a').focus();
    byId('other').focus();
    set({ isOpen: false });
    await frame();
    expect(active()).toBe('other');
  });

  it('walks up to an ancestor’s target when its own is gone', async () => {
    render(`<button id="outer-trigger">Outer</button>
      <div id="outer"><button id="inner-trigger">Inner</button><button id="o2">O2</button>
        <div id="inner"><button id="i1">I1</button></div>
      </div>`);
    byId('outer-trigger').focus();
    scope('outer', { shouldRestoreFocus: true });
    byId('inner-trigger').focus();
    const inner = scope('inner', { shouldRestoreFocus: true });
    byId('i1').focus();
    byId('inner-trigger').remove();
    inner.set({ isOpen: false });
    byId('inner').hidden = true;
    await frame();
    expect(active()).toBe('outer-trigger');
  });

  it('falls back to the first tabbable element of a scope still open', async () => {
    render(`<div id="outer"><button id="inner-trigger">Inner</button><button id="o2">O2</button>
        <div id="inner"><button id="i1">I1</button></div>
      </div>`);
    scope('outer');
    byId('inner-trigger').focus();
    const inner = scope('inner', { shouldRestoreFocus: true });
    byId('i1').focus();
    byId('inner-trigger').remove();
    inner.set({ isOpen: false });
    byId('inner').hidden = true;
    await frame();
    expect(active()).toBe('o2');
  });

  it('hands a closing scope’s target to a scope it opened', async () => {
    // A dialog opened from a menu returns focus to the menu's trigger.
    render(`<button id="trigger">Menu</button>
      <div id="menu"><button id="item">Open dialog</button></div>
      <div id="dialog"><button id="d1">D1</button></div>`);
    byId('trigger').focus();
    const menu = scope('menu', { shouldRestoreFocus: true });
    byId('item').focus();
    const dialog = scope('dialog', { shouldRestoreFocus: true });
    byId('d1').focus();

    menu.set({ isOpen: false });
    byId('menu').remove();
    dialog.set({ isOpen: false });
    byId('dialog').hidden = true;
    await frame();
    expect(active()).toBe('trigger');
  });

  it('tabs out to the element after the trigger, wherever the scope sits', async () => {
    render(`<input id="before" /><input id="trigger" /><input id="after" />
      <div style="height: 10px"></div>
      <div id="scope"><input id="a" /><input id="b" /></div>`);
    byId('trigger').focus();
    scope('scope', { shouldRestoreFocus: true });
    byId('b').focus();
    await userEvent.tab();
    expect(active()).toBe('after');

    // As in React Aria, Shift+Tab goes to the element before the trigger.
    byId('a').focus();
    await userEvent.tab({ shift: true });
    expect(active()).toBe('before');
  });

  it('keeps native order inside, and for scopes that don’t restore', async () => {
    render(`<input id="trigger" /><input id="after" />
      <div id="scope"><input id="a" /><input id="b" /></div><input id="end" />`);
    byId('trigger').focus();
    scope('scope');
    byId('a').focus();
    await userEvent.tab();
    expect(active()).toBe('b');
    await userEvent.tab();
    expect(active()).toBe('end');
  });
});

describe('createFocusScope auto-focus', () => {
  it('focuses the first tabbable element, or the first focusable one', () => {
    render(`<div id="scope"><span>Text</span><button id="a">A</button></div>
      <div id="bare" tabindex="-1"><div id="inner" tabindex="-1">X</div></div>`);
    scope('scope', { shouldAutoFocus: true });
    expect(active()).toBe('a');
    scope('bare', { shouldAutoFocus: true });
    expect(active()).toBe('inner');
  });

  it('leaves focus that is already inside', () => {
    render(
      `<div id="scope"><button id="a">A</button><button id="b">B</button></div>`,
    );
    byId('b').focus();
    scope('scope', { shouldAutoFocus: true });
    expect(active()).toBe('b');
  });

  it('starts when the scope opens, not before', () => {
    render(`<div id="scope"><button id="a">A</button></div>`);
    const { set } = scope('scope', { isOpen: false, shouldAutoFocus: true });
    expect(active()).toBeUndefined();
    set({ isOpen: true });
    expect(active()).toBe('a');
  });
});
