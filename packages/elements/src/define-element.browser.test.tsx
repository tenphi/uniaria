import { bindable, defineComponent, prop } from '@uniaria/core';
import type { LinkKey } from '@uniaria/core';
import type { combobox } from '@uniaria/core/combobox';
import type { dialog } from '@uniaria/core/dialog';
import type { listbox } from '@uniaria/core/listbox';
import { announce, destroyAnnouncer } from '@uniaria/core/dom';
import { field } from '@uniaria/core/field';
import type { popover } from '@uniaria/core/popover';
import type { select } from '@uniaria/core/select';
import type { tooltip } from '@uniaria/core/tooltip';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import './button';
import './field';
import './text-field';
import './checkbox';
import './checkbox-group';
import './switch';
import './radio';
import './radio-group';
import './dialog';
import './popover';
import './tooltip';
import './number-field';
import './listbox';
import './select';
import './combobox';
import { defineElement } from './define-element';
import type { UniElement } from './define-element';

/** A disclosure with a bindable and props of every attribute type. */
const disclosure = defineComponent({
  name: 'test-disclosure',
  parts: ['trigger', 'panel'],
  props: {
    isOpen: bindable(false),
    isDisabled: prop(false),
    isDismissable: prop(true),
    delay: prop(0),
    label: prop<string | undefined>(undefined),
    options: prop<{ isModal: boolean } | undefined>(undefined, {
      type: 'json',
    }),
  },
  actions: ['toggle'],
  setup(ctx) {
    return {
      toggle: () => {
        if (!ctx.props.isDisabled()) {
          ctx.props.isOpen.set(!ctx.props.isOpen.get());
        }
      },
    };
  },
  expose: ({ props }) => ({
    isOpen: props.isOpen.get(),
    isDisabled: props.isDisabled(),
    isDismissable: props.isDismissable(),
    delay: props.delay(),
    label: props.label(),
    options: props.options(),
  }),
  connect: ({ props, api }) => ({
    trigger: {
      attrs: { 'aria-expanded': String(props.isOpen.get()) },
      on: { click: api.toggle },
    },
    panel: { attrs: { hidden: props.isOpen.get() ? undefined : '' } },
  }),
});

type Disclosure = UniElement<typeof disclosure>;

defineElement(disclosure);

const MARKUP = `
  <button data-element="Trigger">Details</button>
  <div data-element="Panel">Content</div>`;

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

/**
 * The selector for a part other than the root, by its `data-element`:
 * `groupLabel` → `[data-element="GroupLabel"]`.
 */
function byElement(part: string): string {
  return `[data-element="${part.charAt(0).toUpperCase()}${part.slice(1)}"]`;
}

function disclosureIn(container: HTMLElement) {
  const host = container.querySelector<Disclosure>('uni-test-disclosure')!;
  const trigger = host.querySelector<HTMLElement>('[data-element="Trigger"]')!;
  const panel = host.querySelector<HTMLElement>('[data-element="Panel"]')!;
  return { host, trigger, panel };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('defineElement', () => {
  it('returns the registered class instead of defining twice', () => {
    const first = customElements.get('uni-test-disclosure');
    expect(defineElement(disclosure)).toBe(first);
  });

  it('takes a prefix or a full name', () => {
    const Prefixed = defineElement(disclosure, { prefix: 'ui' });
    const Named = defineElement(disclosure, { name: 'my-disclosure' });
    expect(customElements.get('ui-test-disclosure')).toBe(Prefixed);
    expect(customElements.get('my-disclosure')).toBe(Named);
  });

  it('writes part attributes on upgrade and keeps the consumer markup', () => {
    const container = mount(
      `<uni-test-disclosure>${MARKUP}</uni-test-disclosure>`,
    );
    const { host, trigger, panel } = disclosureIn(container);
    expect(host.shadowRoot).toBeNull();
    expect(trigger.getAttribute('data-scope')).toBe('test-disclosure');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(trigger.textContent).toBe('Details');
  });

  it('converts attributes to props', () => {
    const container = mount(
      `<uni-test-disclosure disabled delay="300" label="More" options='{"isModal":true}'>${MARKUP}</uni-test-disclosure>`,
    );
    const { host } = disclosureIn(container);
    expect(host.instance.getState()).toMatchObject({
      isDisabled: true,
      delay: 300,
      label: 'More',
      options: { isModal: true },
    });
    expect(host.isDisabled).toBe(true);

    host.removeAttribute('disabled');
    expect(host.instance.getState().isDisabled).toBe(false);
    expect(host.isDisabled).toBe(false);
  });

  // Dialog spec, Resolved questions 4: presence alone can't turn off a prop
  // that is on by default.
  it('reads "false" as false only for a boolean that defaults to true', () => {
    const container = mount(
      `<uni-test-disclosure disabled="false">${MARKUP}</uni-test-disclosure>`,
    );
    const { host } = disclosureIn(container);
    const state = () => host.instance.getState();
    expect(state()).toMatchObject({ isDisabled: true, isDismissable: true });

    host.setAttribute('dismissable', 'false');
    expect(state().isDismissable).toBe(false);
    host.setAttribute('dismissable', '');
    expect(state().isDismissable).toBe(true);
    host.setAttribute('dismissable', 'false');
    host.removeAttribute('dismissable');
    expect(state().isDismissable).toBe(true);
  });

  describe('bindables', () => {
    it('seeds an uncontrolled value from default-<key> and reports changes', () => {
      const container = mount(
        `<uni-test-disclosure default-open>${MARKUP}</uni-test-disclosure>`,
      );
      const { host, trigger, panel } = disclosureIn(container);
      const onChange = vi.fn();
      container.addEventListener('openchange', (event) =>
        onChange((event as CustomEvent).detail),
      );
      expect(panel.hasAttribute('hidden')).toBe(false);

      trigger.click();

      expect(onChange).toHaveBeenCalledWith(false);
      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(host.instance.getState().isOpen).toBe(false);
    });

    it('only requests changes when the property controls it', () => {
      const container = mount(
        `<uni-test-disclosure>${MARKUP}</uni-test-disclosure>`,
      );
      const { host, trigger } = disclosureIn(container);
      host.isOpen = false;
      const onChange = vi.fn();
      host.addEventListener('openchange', (event) =>
        onChange((event as CustomEvent).detail),
      );

      trigger.click();
      expect(onChange).toHaveBeenCalledWith(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      host.isOpen = true;
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('dispatches events that bubble and are not composed', () => {
    const container = mount(
      `<uni-test-disclosure>${MARKUP}</uni-test-disclosure>`,
    );
    const { trigger } = disclosureIn(container);
    const events: CustomEvent[] = [];
    container.addEventListener('openchange', (event) =>
      events.push(event as CustomEvent),
    );
    trigger.click();
    expect(events).toHaveLength(1);
    expect(events[0]!.bubbles).toBe(true);
    expect(events[0]!.composed).toBe(false);
  });

  it('re-applies properties set before the element was defined', () => {
    const late = defineComponent({
      name: 'test-late',
      parts: ['root'],
      props: { delay: prop(0) },
      setup: () => ({}),
      expose: ({ props }) => ({ delay: props.delay() }),
      connect: ({ props }) => ({
        root: { attrs: { 'data-delay': String(props.delay()) } },
      }),
    });
    const container = mount(
      '<uni-test-late><span class="uni-test-late"></span></uni-test-late>',
    );
    const host = container.querySelector('uni-test-late')!;
    (host as unknown as { delay: number }).delay = 200;

    defineElement(late);

    expect(host.querySelector('span')!.getAttribute('data-delay')).toBe('200');
  });

  it('leaves the parts of a nested instance to that instance', () => {
    const container = mount(`
      <uni-test-disclosure id="outer">
        <button data-element="Trigger">Outer</button>
        <div data-element="Panel">
          <uni-test-disclosure id="inner">${MARKUP}</uni-test-disclosure>
        </div>
      </uni-test-disclosure>`);
    const outer = container.querySelector<Disclosure>('#outer')!;
    const inner = container.querySelector<Disclosure>('#inner')!;
    const innerTrigger = inner.querySelector<HTMLElement>(
      '[data-element="Trigger"]',
    )!;

    innerTrigger.click();

    expect(inner.instance.getState().isOpen).toBe(true);
    expect(outer.instance.getState().isOpen).toBe(false);
    expect(outer.instance.element('trigger')).not.toBe(innerTrigger);
  });

  it('leaves the parts inside a nested UniAria element of another kind to it', () => {
    const wrapper = defineComponent({
      name: 'test-wrapper',
      parts: ['trigger'],
      props: {},
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ trigger: { attrs: {} } }),
    });
    defineElement(wrapper);
    const container = mount(`
      <uni-test-disclosure>
        <uni-test-wrapper>
          <button data-element="Trigger">Inner</button>
        </uni-test-wrapper>
        <uni-test-wrapper data-element="Panel"></uni-test-wrapper>
      </uni-test-disclosure>`);
    const host = container.querySelector<Disclosure>('uni-test-disclosure')!;
    const [inner, panel] = host.querySelectorAll('uni-test-wrapper');

    expect(host.instance.element('trigger')).toBeNull();
    expect(inner!.querySelector('button')!.getAttribute('data-scope')).toBe(
      'test-wrapper',
    );
    // A nested UniAria element can still be one of the outer host's parts.
    expect(host.instance.element('panel')).toBe(panel);
  });

  it('gives up the parts inside a nested UniAria element defined after it', async () => {
    const container = mount(`
      <uni-test-disclosure>
        <uni-test-late-wrapper>
          <button data-element="Trigger">Inner</button>
        </uni-test-late-wrapper>
        <test-never-defined>
          <button data-element="Trigger">Outer</button>
        </test-never-defined>
      </uni-test-disclosure>`);
    const host = container.querySelector<Disclosure>('uni-test-disclosure')!;
    const [inner, outer] = host.querySelectorAll('button');
    // Until its tag is defined, nothing marks the wrapper as a host.
    expect(host.instance.element('trigger')).toBe(inner);

    defineElement(
      defineComponent({
        name: 'test-late-wrapper',
        parts: ['trigger'],
        props: {},
        setup: () => ({}),
        expose: () => ({}),
        connect: () => ({ trigger: { attrs: {} } }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve));

    // A custom element that is never defined is no boundary.
    expect(host.instance.element('trigger')).toBe(outer);
    expect(inner!.getAttribute('data-scope')).toBe('test-late-wrapper');
    inner!.click();
    expect(host.instance.getState().isOpen).toBe(false);
    outer!.click();
    expect(host.instance.getState().isOpen).toBe(true);
  });

  it('finds parts added after it connected', async () => {
    const container = mount(
      '<uni-test-disclosure><button data-element="Trigger">Details</button></uni-test-disclosure>',
    );
    const { host } = disclosureIn(container);
    const panel = document.createElement('div');
    panel.setAttribute('data-element', 'Panel');
    host.append(panel);

    await new Promise((resolve) => setTimeout(resolve));

    expect(panel.getAttribute('data-scope')).toBe('test-disclosure');
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('stops on disconnect and resumes when connected again', () => {
    const container = mount(
      `<uni-test-disclosure>${MARKUP}</uni-test-disclosure>`,
    );
    const { host, trigger } = disclosureIn(container);
    host.remove();
    trigger.click();
    expect(host.instance.getState().isOpen).toBe(false);

    container.append(host);
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('adopts a live property into a bindable default before upgrade', () => {
    const live = defineComponent({
      name: 'test-live',
      parts: ['input'],
      props: {
        value: bindable('', { adopt: { part: 'input', property: 'value' } }),
      },
      setup: () => ({}),
      expose: ({ props }) => ({
        value: props.value.get(),
        isControlled: props.value.isControlled(),
      }),
      connect: ({ props }) => ({
        input: { attrs: {}, properties: { value: props.value.get() } },
      }),
    });
    const container = mount(
      '<uni-test-live><input data-element="Input" value="jane" /></uni-test-live>',
    );
    const input = container.querySelector('input')!;
    // Typed before the element is defined.
    input.value = 'jane doe';

    defineElement(live);

    const host =
      container.querySelector<UniElement<typeof live>>('uni-test-live')!;
    expect(host.instance.getState()).toEqual({
      value: 'jane doe',
      isControlled: false,
    });
    expect(host.defaultValue).toBe('jane doe');
    expect(input.value).toBe('jane doe');
  });

  it('calls an action as a method of the element', () => {
    const container = mount(
      `<uni-test-disclosure>${MARKUP}</uni-test-disclosure>`,
    );
    const host = container.querySelector<Disclosure>('uni-test-disclosure')!;
    const trigger = host.querySelector('[data-element="Trigger"]')!;
    host.toggle();
    expect(host.instance.getState().isOpen).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('refuses actions that would shadow element members', () => {
    const shadowing = defineComponent({
      name: 'test-shadowing-action',
      parts: ['root'],
      props: {},
      actions: ['focus'],
      setup: () => ({ focus: () => undefined }),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    expect(() => defineElement(shadowing)).toThrow(
      'action "focus" would shadow an element member',
    );
  });

  it('refuses props that would shadow element properties', () => {
    const shadowing = defineComponent({
      name: 'test-shadowing',
      parts: ['root'],
      props: { hidden: prop(false) },
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    expect(() => defineElement(shadowing)).toThrow(/shadow/);
  });
});

/** A root and a trigger, each writing an attribute that shows it attached. */
const marked = defineComponent({
  name: 'test-marked',
  parts: ['root', 'trigger'],
  props: {},
  setup: () => ({}),
  expose: () => ({}),
  connect: () => ({
    root: { attrs: { role: 'group' } },
    trigger: { attrs: { 'aria-haspopup': 'true' } },
  }),
});

type Marked = UniElement<typeof marked>;

defineElement(marked);

describe('part markers', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve));

  const markedIn = (container: HTMLElement) => {
    const host = container.querySelector<Marked>('uni-test-marked')!;
    const root = host.querySelector<HTMLElement>('#root')!;
    const button = host.querySelector<HTMLElement>('button')!;
    const span = host.querySelector<HTMLElement>('span')!;
    return { host, root, button, span };
  };

  const MARKED = `
    <uni-test-marked>
      <div id="root" class="card uni-test-marked">
        <button data-element="Trigger">Go</button>
        <span>Other</span>
      </div>
    </uni-test-marked>`;

  it('finds the root by its uni-<name> class and another part by its data-element', () => {
    const container = mount(`
      <uni-test-marked>
        <div id="decoy" class="uni-other" data-element="Root">
          <div id="root" class="card uni-test-marked">
            <button data-element="Trigger">Go</button>
            <span data-element="trigger">Lowercase</span>
          </div>
        </div>
      </uni-test-marked>`);
    const { host, root, button, span } = markedIn(container);
    expect(host.instance.element('root')).toBe(root);
    expect(host.instance.element('trigger')).toBe(button);
    expect(root.getAttribute('role')).toBe('group');
    // The root keeps its markup class and gets no other marker.
    expect(root.getAttribute('class')).toBe('card uni-test-marked');
    expect(root.hasAttribute('data-scope')).toBe(false);
    expect(root.hasAttribute('data-element')).toBe(false);
    expect(button.getAttribute('aria-haspopup')).toBe('true');
    expect(button.getAttribute('data-scope')).toBe('test-marked');
    // Neither another component's class, data-element="Root" nor a part name
    // in the wrong case marks a part.
    const decoy = host.querySelector('#decoy')!;
    expect(decoy.hasAttribute('role')).toBe(false);
    expect(span.hasAttribute('aria-haspopup')).toBe(false);
  });

  it('scans again when a part’s data-element changes or the root loses its class', async () => {
    const { host, root, button, span } = markedIn(mount(MARKED));
    expect(host.instance.element('trigger')).toBe(button);

    button.setAttribute('data-element', 'Other');
    await tick();
    expect(host.instance.element('trigger')).toBeNull();

    span.setAttribute('data-element', 'Trigger');
    await tick();
    expect(host.instance.element('trigger')).toBe(span);
    expect(span.getAttribute('aria-haspopup')).toBe('true');
    expect(span.getAttribute('data-scope')).toBe('test-marked');

    root.classList.remove('uni-test-marked');
    await tick();
    expect(host.instance.element('root')).toBeNull();

    root.classList.add('uni-test-marked');
    await tick();
    expect(host.instance.element('root')).toBe(root);
  });

  it('leaves its parts attached, with no scan, when other classes on the root change', async () => {
    const { host, root, button } = markedIn(mount(MARKED));
    const scans = vi.spyOn(host, 'querySelectorAll');

    root.classList.add('is-active');
    root.classList.remove('card');
    root.className = `${root.className} other`;
    button.classList.add('pressed');
    await tick();

    expect(scans).not.toHaveBeenCalled();
    expect(host.instance.element('root')).toBe(root);
    expect(host.instance.element('trigger')).toBe(button);
    expect(root.getAttribute('class')).toBe('uni-test-marked is-active other');
    expect(root.getAttribute('role')).toBe('group');

    // A change that can move a part scans.
    button.setAttribute('data-element', 'Other');
    await tick();
    expect(scans).toHaveBeenCalled();
    expect(host.instance.element('trigger')).toBeNull();
    scans.mockRestore();
  });
});

/** Item parts keyed by data-key, with items read from the markup. */
const rows = defineComponent({
  name: 'test-rows',
  parts: ['list'],
  itemParts: ['row', 'section'],
  props: {
    items: prop<readonly unknown[]>([], {
      attribute: false,
      adopt: { items: { item: 'row', section: 'section' } },
    }),
  },
  setup(ctx) {
    const active = ctx.state<string | null>(null);
    return {
      active: () => active.get(),
      activate(key: string) {
        const previous = active.get();
        active.set(key);
        ctx.invalidateItems(previous === null ? [key] : [previous, key]);
      },
    };
  },
  expose: ({ props, api }) => ({ items: props.items(), active: api.active() }),
  connect: () => ({ list: { attrs: { role: 'listbox' } } }),
  connectItem: ({ api }, part, key) =>
    part === 'section'
      ? { attrs: { role: 'group' } }
      : {
          attrs: {
            role: 'option',
            'aria-selected': String(api.active() === key),
          },
          on: { click: () => api.activate(key) },
        },
});

type Rows = UniElement<typeof rows>;

defineElement(rows);

describe('item parts', () => {
  const ROWS = `
    <uni-test-rows>
      <div data-element="List">
        <div data-element="Row" data-key="apple">Apple</div>
        <div data-element="Section" data-key="citrus">
          <span>Citrus</span>
          <div data-element="Row" data-key="lemon" data-text-value="Lemon">
            Lemon <small>sour</small>
          </div>
        </div>
        <div data-element="Row" data-key="kiwi">  Kiwi
          fruit </div>
      </div>
    </uni-test-rows>`;

  const rowsIn = (container: HTMLElement) => {
    const host = container.querySelector<Rows>('uni-test-rows')!;
    const row = (key: string) =>
      host.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
    return { host, row };
  };

  it('writes every item part by its data-key and dispatches its events', () => {
    const { host, row } = rowsIn(mount(ROWS));
    expect(row('apple').getAttribute('role')).toBe('option');
    expect(row('apple').getAttribute('data-scope')).toBe('test-rows');
    expect(row('apple').getAttribute('data-element')).toBe('Row');
    expect(row('citrus').getAttribute('role')).toBe('group');
    expect(row('lemon').getAttribute('aria-selected')).toBe('false');

    row('lemon').querySelector('small')!.click();
    expect(host.instance.getState().active).toBe('lemon');
    expect(row('lemon').getAttribute('aria-selected')).toBe('true');
    row('kiwi').click();
    expect(row('lemon').getAttribute('aria-selected')).toBe('false');
  });

  it('reads items from the markup in document order, sections holding theirs', () => {
    const { host } = rowsIn(mount(ROWS));
    expect(host.instance.getState().items).toEqual([
      { key: 'apple', textValue: 'Apple' },
      { key: 'citrus', items: [{ key: 'lemon', textValue: 'Lemon' }] },
      { key: 'kiwi', textValue: 'Kiwi fruit' },
    ]);
  });

  it('reads them again when the markup changes, and attaches new items', async () => {
    const { host, row } = rowsIn(mount(ROWS));
    const items = host.instance.getState().items;
    row('apple').setAttribute('data-key', 'pear');
    const fig = document.createElement('div');
    fig.setAttribute('data-element', 'Row');
    fig.setAttribute('data-key', 'fig');
    fig.textContent = 'Fig';
    host.querySelector('[data-element="List"]')!.append(fig);
    row('kiwi').remove();

    await new Promise((resolve) => setTimeout(resolve));

    expect(host.instance.getState().items).toEqual([
      { key: 'pear', textValue: 'Apple' },
      { key: 'citrus', items: [{ key: 'lemon', textValue: 'Lemon' }] },
      { key: 'fig', textValue: 'Fig' },
    ]);
    expect(host.instance.getState().items).not.toBe(items);
    expect(fig.getAttribute('role')).toBe('option');
    expect(host.instance.itemElement('row', 'kiwi')).toBeNull();
    expect(host.instance.itemElement('row', 'pear')).toBe(row('pear'));
    fig.click();
    expect(host.instance.getState().active).toBe('fig');
  });

  it('reads an item’s text again when its text or data-text-value changes', async () => {
    const { host, row } = rowsIn(mount(ROWS));
    (row('apple').firstChild as Text).data = 'Green apple';
    row('lemon').setAttribute('data-text-value', 'Lime');
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.instance.getState().items).toEqual([
      { key: 'apple', textValue: 'Green apple' },
      { key: 'citrus', items: [{ key: 'lemon', textValue: 'Lime' }] },
      { key: 'kiwi', textValue: 'Kiwi fruit' },
    ]);

    row('lemon').removeAttribute('data-text-value');
    row('lemon').querySelector('small')!.firstChild!.nodeValue = 'tart';
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.instance.getState().items).toEqual([
      { key: 'apple', textValue: 'Green apple' },
      { key: 'citrus', items: [{ key: 'lemon', textValue: 'Lemon tart' }] },
      { key: 'kiwi', textValue: 'Kiwi fruit' },
    ]);
  });

  it('scans no more for a text change outside its items', async () => {
    const { host } = rowsIn(
      mount(`
        <uni-test-rows>
          <p>Fruit</p>
          <div data-element="List">
            <div data-element="Row" data-key="apple">Apple</div>
          </div>
        </uni-test-rows>`),
    );
    const scans = vi.spyOn(host, 'querySelectorAll');
    (host.querySelector('p')!.firstChild as Text).data = 'Fruits';
    await new Promise((resolve) => setTimeout(resolve));
    expect(scans).not.toHaveBeenCalled();
    scans.mockRestore();
  });

  it('keeps items the consumer sets, and the same items while the markup reads the same', async () => {
    const { host, row } = rowsIn(mount(ROWS));
    const items = host.instance.getState().items;
    row('apple').append(document.createElement('i'));
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.instance.getState().items).toBe(items);

    const own = [{ key: 'only', textValue: 'Only' }];
    host.items = own;
    row('apple').setAttribute('data-key', 'pear');
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.instance.getState().items).toBe(own);
  });

  it('leaves an item part without a data-key, or a repeated one, alone and warns', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { host } = rowsIn(
      mount(`
        <uni-test-rows>
          <div data-element="Row">No key</div>
          <div data-element="Row" data-key="a">A</div>
          <div data-element="Row" data-key="a">Again</div>
        </uni-test-rows>`),
    );
    const [noKey, , again] = host.querySelectorAll('[data-element="Row"]');
    expect(noKey!.hasAttribute('role')).toBe(false);
    expect(again!.hasAttribute('role')).toBe(false);
    expect(host.instance.getState().items).toEqual([
      { key: 'a', textValue: 'A' },
    ]);
    expect(spy.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining('the Row part has no data-key'),
      expect.stringContaining('with data-key "a" repeats an earlier one'),
    ]);
    spy.mockRestore();
  });
});

describe('links', () => {
  const hintLink: LinkKey<'hint'> = { name: 'hint' };
  const hint = defineComponent({
    name: 'test-hint',
    parts: ['root'],
    props: {},
    provides: [hintLink],
    setup: () => ({}),
    expose: () => ({}),
    connect: () => ({ root: { attrs: {} } }),
  });
  const linker = defineComponent({
    name: 'test-linker',
    parts: ['root'],
    props: {},
    links: [hintLink],
    setup: () => ({}),
    expose: () => ({}),
    connect: () => ({ root: { attrs: {} } }),
  });
  defineElement(hint);
  defineElement(linker);
  type Host = UniElement<typeof linker>;

  it('links to the host it sits in directly, not through another host', () => {
    const container = mount(`
      <uni-test-hint>
        <uni-test-linker id="direct"><span class="uni-test-linker"></span></uni-test-linker>
        <uni-test-disclosure>
          <uni-test-linker id="nested"><span class="uni-test-linker"></span></uni-test-linker>
        </uni-test-disclosure>
      </uni-test-hint>`);
    const tip =
      container.querySelector<UniElement<typeof hint>>('uni-test-hint')!;
    const direct = container.querySelector<Host>('#direct')!;
    const nested = container.querySelector<Host>('#nested')!;
    expect(direct.instance.linked(hintLink)).toBe(tip.instance);
    expect(nested.instance.linked(hintLink)).toBeUndefined();
  });

  it('has no property for a link, which it takes by attribute or from the host around it', () => {
    expectTypeOf<Host>().not.toHaveProperty('hint');
    expect('hint' in document.createElement('uni-test-linker')).toBe(false);
  });

  it('links by id through the attribute of the key’s name, and unlinks when moved', () => {
    const container = mount(`
      <uni-test-linker hint="tip"><span class="uni-test-linker"></span></uni-test-linker>`);
    const host = container.querySelector<Host>('uni-test-linker')!;
    expect(host.instance.linked(hintLink)).toBeUndefined();

    const tip = document.createElement('uni-test-hint') as UniElement<
      typeof hint
    >;
    tip.id = 'tip';
    container.append(tip);
    expect(host.instance.linked(hintLink)).toBe(tip.instance);

    host.removeAttribute('hint');
    expect(host.instance.linked(hintLink)).toBeUndefined();
    host.setAttribute('hint', 'tip');
    expect(host.instance.linked(hintLink)).toBe(tip.instance);
    host.remove();
    expect(host.instance.linked(hintLink)).toBeUndefined();
  });
});

describe('<uni-button>', () => {
  it('adopts the root tag and its href', () => {
    const container = mount(`
      <uni-button id="div"><div class="uni-button">Save</div></uni-button>
      <uni-button id="link"><a class="uni-button" href="/docs">Docs</a></uni-button>`);
    const div = container.querySelector('#div .uni-button')!;
    const link = container.querySelector<HTMLElement>('#link .uni-button')!;
    const host = container.querySelector<UniElement<never>>('#link')!;
    expect(div.getAttribute('role')).toBe('button');
    expect(link.getAttribute('href')).toBe('/docs');
    expect(link.hasAttribute('role')).toBe(false);

    (host as unknown as { isDisabled: boolean }).isDisabled = true;
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('role')).toBe('link');

    (host as unknown as { isDisabled: boolean }).isDisabled = false;
    expect(link.getAttribute('href')).toBe('/docs');
  });

  it('shares its DOM with React without either one undoing the other', () => {
    const container = mount('');
    const root = createRoot(container);
    const render = (label: string, isDisabled: boolean) =>
      flushSync(() =>
        root.render(
          createElement(
            'uni-button',
            { isDisabled },
            createElement(
              'button',
              { className: `uni-button ${label}` },
              label,
            ),
          ),
        ),
      );

    render('Save', true);
    const host = container.querySelector('uni-button')!;
    const button = container.querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(host.instance.element('root')).toBe(button);

    render('Saving', false);
    expect(button.textContent).toBe('Saving');
    expect(button.className).toBe('uni-button Saving');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.hasAttribute('data-scope')).toBe(false);
    expect(button.getAttribute('type')).toBe('button');
    expect(host.instance.element('root')).toBe(button);
    root.unmount();
  });
});

describe('<uni-field>', () => {
  it("adopts the control's id and the label's tag", () => {
    const container = mount(`
      <uni-field>
        <span data-element="Label">Plan</span>
        <div data-element="Control" id="plan" role="radiogroup"></div>
      </uni-field>`);
    const host =
      container.querySelector<UniElement<typeof field>>('uni-field')!;
    const label = host.querySelector('[data-element="Label"]')!;
    const control = host.querySelector('[data-element="Control"]')!;
    expect(host.controlId).toBe('plan');
    expect(host.labelElementType).toBe('span');
    expect(control.id).toBe('plan');
    expect(label.hasAttribute('for')).toBe(false);
    expect(control.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('leaves a UniAria input inside it alone and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const textInput = defineComponent({
      name: 'test-text-input',
      parts: ['root', 'label', 'input', 'description', 'error'],
      props: {},
      setup: (ctx) => ({
        field: ctx.use(field, () => ({}), { parts: { control: 'input' } }),
      }),
      expose: () => ({}),
      connect: ({ api }) => {
        const { control, ...parts } = api.field.connect();
        return { ...parts, input: control };
      },
    });
    defineElement(textInput);
    const container = mount(`
      <uni-field>
        <label data-element="Label">Email</label>
        <uni-test-text-input>
          <label data-element="Label">Work email</label>
          <input data-element="Input" />
        </uni-test-text-input>
      </uni-field>`);
    const [outer, inner] = container.querySelectorAll('label');
    const input = container.querySelector('input')!;

    expect(input.getAttribute('aria-labelledby')).toBe(inner!.id);
    expect(outer!.getAttribute('for')).not.toBe(input.id);
    await new Promise((resolve) => setTimeout(resolve));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('without a control part'),
    );
    warn.mockRestore();
  });
});

describe('<uni-text-field>', () => {
  it('takes the markup value as its default and the readonly attribute', () => {
    const container = mount(`
      <uni-text-field readonly>
        <label data-element="Label">Name</label>
        <input data-element="Input" value="Jane" />
      </uni-text-field>`);
    const host = container.querySelector('uni-text-field')!;
    const input = host.querySelector('input')!;
    expect(host.instance.getState()).toMatchObject({
      value: 'Jane',
      isReadOnly: true,
    });
    expect(host.defaultValue).toBe('Jane');
    expect(input.value).toBe('Jane');
    expect(input.readOnly).toBe(true);
  });

  it('keeps what the user types when a listener of theirs changes an attribute', async () => {
    const container = mount(`
      <uni-text-field>
        <label data-element="Label">Name</label>
        <input data-element="Input" />
      </uni-text-field>`);
    const host = container.querySelector('uni-text-field')!;
    const input = host.querySelector('input')!;
    // Validating as the user types flushes the instance before its own
    // listener has read the new text.
    host.addEventListener('input', () => {
      host.toggleAttribute('invalid', input.value.length < 3);
    });
    await userEvent.type(input, 'Jane');
    expect(input.value).toBe('Jane');
    expect(host.instance.getState().value).toBe('Jane');
  });
});

describe('<uni-number-field>', () => {
  const field = (attributes = '', value = '1.234,5') => `
    <uni-number-field lang="de-DE" ${attributes}>
      <label data-element="Label">Menge</label>
      <input data-element="Input" value="${value}" />
      <button data-element="Decrement">−</button>
      <button data-element="Increment">+</button>
      <input data-element="HiddenInput" name="menge" />
    </uni-number-field>`;

  it('takes the markup text, parsed for its language, as its default', () => {
    const container = mount(field());
    const host = container.querySelector('uni-number-field')!;
    const [input, hidden] = Array.from(host.querySelectorAll('input'));
    expect(host.instance.getState().value).toBe(1234.5);
    expect(input!.value).toBe('1.234,5');
    expect(hidden!.type).toBe('hidden');
    expect(hidden!.value).toBe('1234.5');
    // German: no English role description.
    expect(input!.hasAttribute('aria-roledescription')).toBe(false);
  });

  it('takes number attributes, and default-value over the markup text', () => {
    const container = mount(
      field('default-value="7" min-value="0" max-value="7" step="0.5"'),
    );
    const host = container.querySelector('uni-number-field')!;
    const input = host.querySelector('input')!;
    expect(host.instance.getState()).toMatchObject({
      value: 7,
      canIncrement: false,
      canDecrement: true,
    });
    expect(input.value).toBe('7');
    expect(host.minValue).toBe(0);
    expect(host.step).toBe(0.5);
  });

  it('takes formatOptions as a property', () => {
    const container = mount(field('', '12,5'));
    const host = container.querySelector('uni-number-field')!;
    host.formatOptions = { style: 'currency', currency: 'EUR' };
    expect(host.querySelector('input')!.value).toBe('12,50\u00a0€');
  });

  it('reports a commit as valuechange', () => {
    const container = mount(field('', ''));
    const host = container.querySelector('uni-number-field')!;
    const input = host.querySelector('input')!;
    const values: unknown[] = [];
    host.addEventListener('valuechange', (event) =>
      values.push((event as CustomEvent).detail),
    );
    input.focus();
    input.value = '2,5';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    input.blur();
    expect(values).toEqual([2.5]);
    expect(input.value).toBe('2,5');
  });
});

describe('<uni-checkbox>', () => {
  it('takes the markup checked state as its default and reads the label tag', () => {
    const container = mount(`
      <uni-checkbox readonly>
        <label class="uni-checkbox">
          <input data-element="Input" type="checkbox" checked />
          <span data-element="Label">Accept terms</span>
        </label>
      </uni-checkbox>`);
    const host = container.querySelector('uni-checkbox')!;
    const input = host.querySelector('input')!;
    const label = host.querySelector('span')!;
    expect(host.instance.getState()).toMatchObject({
      isSelected: true,
      isReadOnly: true,
    });
    expect(host.defaultSelected).toBe(true);
    expect(input.checked).toBe(true);
    expect(input.getAttribute('aria-readonly')).toBe('true');
    // A span label inside the label root: linked, with no `for`.
    expect(input.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('keeps a click made before upgrade', () => {
    const container = mount(`
      <div>
        <input data-element="Input" type="checkbox" />
        <label data-element="Label">News</label>
      </div>`);
    const markup = container.firstElementChild!;
    (markup.querySelector('input') as HTMLInputElement).click();
    const host = document.createElement('uni-checkbox');
    host.append(markup);
    container.append(host);
    expect(host.instance.getState().isSelected).toBe(true);
    expect(host.querySelector('input')!.checked).toBe(true);
  });

  it('takes indeterminate as an attribute', () => {
    const container = mount(`
      <uni-checkbox indeterminate>
        <input data-element="Input" type="checkbox" />
      </uni-checkbox>`);
    const host = container.querySelector('uni-checkbox')!;
    expect(host.isIndeterminate).toBe(true);
    expect(host.querySelector('input')!.indeterminate).toBe(true);
  });

  it('keeps a toggle when a click listener of theirs changes an attribute', async () => {
    const container = mount(`
      <uni-checkbox>
        <label class="uni-checkbox">
          <input data-element="Input" type="checkbox" />
          <span data-element="Label">News</span>
        </label>
      </uni-checkbox>`);
    const host = container.querySelector('uni-checkbox')!;
    const input = host.querySelector('input')!;
    host.addEventListener('click', () => host.toggleAttribute('invalid'));
    await userEvent.click(input);
    expect(input.checked).toBe(true);
    expect(host.instance.getState().isSelected).toBe(true);
  });
});

describe('<uni-checkbox-group>', () => {
  const option = (value: string, extra = '') => `
    <uni-checkbox value="${value}" ${extra}>
      <label class="uni-checkbox">
        <input data-element="Input" type="checkbox" ${value === 'sms' ? 'checked' : ''} />
        <span data-element="Label">${value}</span>
      </label>
    </uni-checkbox>`;

  it('takes the checkboxes checked in the markup as its default', () => {
    const container = mount(`
      <uni-checkbox-group>
        <div class="uni-checkbox-group">
          <span data-element="Label">Notify</span>
          ${option('email')}${option('sms')}
        </div>
      </uni-checkbox-group>`);
    const group = container.querySelector('uni-checkbox-group')!;
    const [email, sms] = Array.from(container.querySelectorAll('input'));
    expect(group.instance.getState().value).toEqual(['sms']);
    expect(email!.value).toBe('email');
    expect(sms!.checked).toBe(true);

    const changes: unknown[] = [];
    group.addEventListener('valuechange', (event) =>
      changes.push((event as CustomEvent).detail),
    );
    email!.click();
    expect(changes).toEqual([['sms', 'email']]);
    expect(group.instance.getState().value).toEqual(['sms', 'email']);
  });

  it('links a checkbox by id, to a group that comes later, and unlinks without the id', () => {
    const container = mount(option('email', 'group="notify"'));
    const box = container.querySelector('uni-checkbox')!;
    expect(box.instance.owner()).toBeUndefined();

    const group = document.createElement('uni-checkbox-group');
    group.id = 'notify';
    group.defaultValue = ['email'];
    group.innerHTML = '<div class="uni-checkbox-group"></div>';
    container.append(group);
    expect(box.instance.owner()).toBe(group.instance);
    expect(box.querySelector('input')!.checked).toBe(true);

    box.removeAttribute('group');
    expect(box.instance.owner()).toBeUndefined();
  });

  it('leaves the group when moved out of it', () => {
    const container = mount(`
      <uni-checkbox-group>
        <div class="uni-checkbox-group">${option('email')}</div>
      </uni-checkbox-group>`);
    const box = container.querySelector('uni-checkbox')!;
    expect(box.instance.owner()).toBeDefined();
    container.append(box);
    expect(box.instance.owner()).toBeUndefined();
  });
});

describe('<uni-switch>', () => {
  it('takes the markup checked state as its default and sets its role', () => {
    const container = mount(`
      <uni-switch readonly>
        <label class="uni-switch">
          <input data-element="Input" type="checkbox" checked />
          <span data-element="Indicator"><span class="thumb"></span></span>
          <span data-element="Label">Wi-Fi</span>
        </label>
      </uni-switch>`);
    const host = container.querySelector('uni-switch')!;
    const input = host.querySelector('input')!;
    expect(host.instance.getState()).toMatchObject({
      isSelected: true,
      isReadOnly: true,
    });
    expect(host.defaultSelected).toBe(true);
    expect(input.checked).toBe(true);
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.getAttribute('aria-readonly')).toBe('true');
    expect(
      host
        .querySelector('[data-element="Indicator"]')!
        .hasAttribute('data-selected'),
    ).toBe(true);
  });

  it('never joins a checkbox group around it', () => {
    const container = mount(`
      <uni-checkbox-group>
        <div class="uni-checkbox-group">
          <uni-switch>
            <label class="uni-switch">
              <input data-element="Input" type="checkbox" checked />
              <span data-element="Label">Wi-Fi</span>
            </label>
          </uni-switch>
        </div>
      </uni-checkbox-group>`);
    const group = container.querySelector('uni-checkbox-group')!;
    const host = container.querySelector('uni-switch')!;
    expect(host.instance.owner()).toBeUndefined();
    expect(group.instance.getState().value).toEqual([]);
    host.querySelector('input')!.click();
    expect(host.instance.getState().isSelected).toBe(false);
    expect(group.instance.getState().value).toEqual([]);
  });
});

describe('<uni-radio-group>', () => {
  const option = (value: string, extra = '') => `
    <uni-radio value="${value}" ${extra}>
      <label class="uni-radio">
        <input data-element="Input" type="radio" ${value === 'pro' ? 'checked' : ''} />
        <span data-element="Label">${value}</span>
      </label>
    </uni-radio>`;

  it('takes the radio checked in the markup as its default and names its radios', () => {
    const container = mount(`
      <uni-radio-group name="plan">
        <div class="uni-radio-group">
          <span data-element="Label">Plan</span>
          ${option('free')}${option('pro')}
        </div>
      </uni-radio-group>`);
    const group = container.querySelector('uni-radio-group')!;
    const [free, pro] = Array.from(container.querySelectorAll('input'));
    expect(group.instance.getState().value).toBe('pro');
    expect([free!.name, pro!.name]).toEqual(['plan', 'plan']);
    expect([free!.value, pro!.value]).toEqual(['free', 'pro']);
    expect(pro!.checked).toBe(true);
    expect([free!.tabIndex, pro!.tabIndex]).toEqual([-1, 0]);

    const changes: unknown[] = [];
    group.addEventListener('valuechange', (event) =>
      changes.push((event as CustomEvent).detail),
    );
    free!.click();
    expect(changes).toEqual(['free']);
    expect([free!.tabIndex, pro!.tabIndex]).toEqual([0, -1]);
  });

  it('gives each radio its own state and focuschange', () => {
    const container = mount(`
      <uni-radio-group>
        <div class="uni-radio-group">${option('free')}${option('pro')}</div>
      </uni-radio-group>`);
    const [free, pro] = Array.from(container.querySelectorAll('uni-radio'));
    expect(pro!.instance.getState()).toMatchObject({
      isSelected: true,
      isFocused: false,
      isDisabled: false,
      isReadOnly: false,
      isInvalid: false,
    });
    expect(free!.instance.getState().isSelected).toBe(false);
    // Read-only and invalid are the group's.
    const group = container.querySelector('uni-radio-group')!;
    group.setAttribute('readonly', '');
    group.setAttribute('invalid', '');
    expect(free!.instance.getState()).toMatchObject({
      isReadOnly: true,
      isInvalid: true,
    });

    const focus: unknown[] = [];
    free!.addEventListener('focuschange', (event) =>
      focus.push((event as CustomEvent).detail),
    );
    const input = free!.querySelector('input')!;
    input.focus();
    expect(free!.instance.getState().isFocused).toBe(true);
    input.blur();
    expect(focus).toEqual([true, false]);
  });

  it('links a radio by id, to a group that comes later', () => {
    const container = mount(
      option('free', 'group="plan"').replace(
        'type="radio"',
        'type="radio" name="legacy"',
      ),
    );
    const host = container.querySelector('uni-radio')!;
    const input = host.querySelector('input')!;
    expect(host.instance.owner()).toBeUndefined();
    // Until it links, the markup's name stays.
    expect(input.name).toBe('legacy');

    const group = document.createElement('uni-radio-group');
    group.id = 'plan';
    group.defaultValue = 'free';
    group.innerHTML = '<div class="uni-radio-group"></div>';
    container.append(group);
    expect(host.instance.owner()).toBe(group.instance);
    expect(input.checked).toBe(true);
    // No name prop: the group's root id, unique on the page.
    expect(input.name).toBe(group.querySelector('.uni-radio-group')!.id);
  });

  it('keeps a choice when a click listener of theirs changes an attribute', async () => {
    const container = mount(`
      <uni-radio-group>
        <div class="uni-radio-group">${option('free')}${option('pro')}</div>
      </uni-radio-group>`);
    const group = container.querySelector('uni-radio-group')!;
    const [free, pro] = Array.from(container.querySelectorAll('input'));
    // The flush writes every radio: the one the click unchecked as well.
    group.addEventListener('click', () => group.toggleAttribute('invalid'));
    await userEvent.click(free!);
    expect([free!.checked, pro!.checked]).toEqual([true, false]);
    expect(group.instance.getState().value).toBe('free');
  });

  it('leaves a focusable disabled radio out of its form’s data, as a disabled one is', () => {
    const container = mount(`
      <form>
        <uni-radio-group name="plan">
          <div class="uni-radio-group">
            ${option('free')}${option('pro', 'disabled focusable-when-disabled')}
          </div>
        </uni-radio-group>
        <input type="hidden" name="plan" value="also" />
      </form>`);
    const form = container.querySelector('form')!;
    const pro = container.querySelectorAll('uni-radio')[1]!;
    expect(pro.querySelector('input')!.checked).toBe(true);
    expect(new FormData(form).getAll('plan')).toEqual(['also']);

    pro.removeAttribute('disabled');
    expect(new FormData(form).getAll('plan')).toEqual(['pro', 'also']);
  });
});

describe('<uni-dialog>', () => {
  const DIALOG = `
    <button data-element="Trigger">Delete file</button>
    <dialog class="uni-dialog" role="alertdialog">
      <h2 data-element="Title">Delete file</h2>
      <p data-element="Description">This can't be undone.</p>
      <button data-element="Close">Cancel</button>
    </dialog>`;

  function dialogIn(container: HTMLElement) {
    const host = container.querySelector('uni-dialog')!;
    const trigger = host.querySelector<HTMLElement>(
      '[data-element="Trigger"]',
    )!;
    const modal = host.querySelector('dialog')!;
    const events: unknown[] = [];
    for (const type of ['dismiss', 'openchange']) {
      host.addEventListener(type, (event) =>
        events.push((event as CustomEvent).detail),
      );
    }
    return { host, trigger, modal, events };
  }

  const escape = (target: Element) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );

  it('adopts the role of its dialog and turns off dismissal with "false"', () => {
    const container = mount(
      `<uni-dialog dismissable="false">${DIALOG}</uni-dialog>`,
    );
    const { host, trigger, modal, events } = dialogIn(container);
    expect(host.role).toBe('alertdialog');
    expect(host.hasAttribute('role')).toBe(false);
    expect(modal.getAttribute('role')).toBe('alertdialog');

    trigger.click();
    expect(modal.matches(':modal')).toBe(true);
    escape(modal);
    expect(events).toEqual([true]);
    host.removeAttribute('dismissable');
    escape(modal);
    expect(events).toEqual([
      true,
      { reason: 'escape', returnValue: '' },
      false,
    ]);
  });

  it('opens from open() and closes from close()', async () => {
    const container = mount(`<uni-dialog>${DIALOG}</uni-dialog>`);
    const { host, modal, events } = dialogIn(container);
    host.open();
    expect(modal.matches(':modal')).toBe(true);
    host.close();
    expect(events).toEqual([true, false]);
    await vi.waitFor(() => expect(modal.open).toBe(false));
  });

  it('reports a dialog removed while open, unlocks scroll and restores focus', async () => {
    const container = mount(`<uni-dialog>${DIALOG}</uni-dialog>`);
    const { host, trigger, modal, events } = dialogIn(container);
    trigger.click();
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden');

    modal.remove();
    await vi.waitFor(() =>
      expect(events).toEqual([
        true,
        { reason: 'browser', returnValue: '' },
        false,
      ]),
    );
    expect(host.instance.getState().isOpen).toBe(false);
    expect(getComputedStyle(document.documentElement).overflow).not.toBe(
      'hidden',
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus the page moved elsewhere when its dialog is removed', async () => {
    const container = mount(
      `<uni-dialog>${DIALOG}</uni-dialog><input id="elsewhere" aria-label="Elsewhere" />`,
    );
    const { trigger, modal, events } = dialogIn(container);
    trigger.click();
    modal.remove();
    const elsewhere = container.querySelector<HTMLElement>('#elsewhere')!;
    elsewhere.focus();
    await vi.waitFor(() => expect(events).toHaveLength(3));
    expect(document.activeElement).toBe(elsewhere);
  });

  it('hosts the live announcer while open', async () => {
    const container = mount(`<uni-dialog>${DIALOG}</uni-dialog>`);
    const { trigger, modal, events } = dialogIn(container);
    announce('Before');
    const announcer = () =>
      document.querySelector('[data-uni-live-announcer]')!;
    expect(announcer().parentElement).toBe(document.body);

    trigger.click();
    expect(announcer().parentElement).toBe(modal);
    escape(modal);
    expect(events).toEqual([
      true,
      { reason: 'escape', returnValue: '' },
      false,
    ]);
    // The native dialog closes after the closing phase, which CI's WebKit
    // has taken just over the default second to finish.
    await vi.waitFor(() => expect(modal.open).toBe(false), { timeout: 3000 });
    expect(announcer().parentElement).toBe(document.body);
    destroyAnnouncer();
  });

  it('warns about a dialog without a name, an alertdialog without a description and a root that is not a dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = mount(`
      <uni-dialog id="unnamed">
        <dialog class="uni-dialog"><button data-element="Close">Close</button></dialog>
      </uni-dialog>
      <uni-dialog id="alert">
        <dialog class="uni-dialog" role="alertdialog">
          <h2 data-element="Title">Delete file</h2>
        </dialog>
      </uni-dialog>
      <uni-dialog id="div"><div class="uni-dialog"></div></uni-dialog>`);
    const messages = () => warn.mock.calls.map(([message]) => String(message));
    expect(messages().some((message) => message.includes('<div>'))).toBe(true);

    for (const id of ['unnamed', 'alert']) {
      const host = container.querySelector<UniElement<typeof dialog>>(
        `#${id}`,
      )!;
      host.isOpen = true;
    }
    // Checked once its parts have settled.
    await vi.waitFor(() =>
      expect(
        messages().filter((message) => message.includes('dialog:')),
      ).toHaveLength(3),
    );
    const all = messages();
    warn.mockRestore();
    expect(all.some((message) => message.includes('no name'))).toBe(true);
    expect(all.some((message) => message.includes('needs a description'))).toBe(
      true,
    );
  });

  // Parts added after it connected arrive in document order: the root,
  // which opens it, before the title.
  it('does not warn about a titled dialog that opens with its parts', async () => {
    const warn = vi.spyOn(console, 'warn');
    const host = document.createElement('uni-dialog');
    host.defaultOpen = true;
    document.body.append(host);
    host.innerHTML = DIALOG;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('<uni-popover>', () => {
  const POPOVER = `
    <button data-element="Trigger">Size</button>
    <div class="uni-popover">
      <h2 data-element="Title">Size</h2>
      <input aria-label="Width" />
      <button data-element="Close">Apply</button>
    </div>`;

  type Popover = UniElement<typeof popover>;

  /** The popover's parts and its own events, not a nested one's. */
  function popoverIn(host: Popover) {
    const part = (selector: string) =>
      host.querySelector<HTMLElement>(`:scope > ${selector}`)!;
    const events: unknown[] = [];
    for (const type of ['dismiss', 'openchange']) {
      host.addEventListener(type, (event) => {
        if (event.target === host) events.push((event as CustomEvent).detail);
      });
    }
    return {
      trigger: part(byElement('trigger')),
      root: part('.uni-popover'),
      events,
    };
  }

  const hostIn = (container: HTMLElement, selector = 'uni-popover') =>
    container.querySelector<Popover>(selector)!;

  it('reads its attributes, "false" turning off what is on by default', async () => {
    const container = mount(`
      <uni-popover non-modal dismissable="false" restore-focus="false"
        position-area="top span-right" position-try-fallbacks="none">
        ${POPOVER}
      </uni-popover>`);
    const host = hostIn(container);
    expect(host).toMatchObject({
      isNonModal: true,
      isDismissable: false,
      shouldRestoreFocus: false,
      positionArea: 'top span-right',
      positionTryFallbacks: 'none',
    });
    // A property only: a function can't be an attribute.
    host.setAttribute('should-close-on-interact-outside', '');
    expect(host.shouldCloseOnInteractOutside).toBe(undefined);

    const { trigger, root } = popoverIn(host);
    trigger.click();
    expect(root.matches(':popover-open')).toBe(true);
    await vi.waitFor(() => expect(root.dataset.placement).toBe('top'));
    // Non-modal: the page stays exposed.
    expect(trigger.hasAttribute('aria-hidden')).toBe(false);
  });

  it('opens from open() and closes from close()', async () => {
    const container = mount(`<uni-popover>${POPOVER}</uni-popover>`);
    const host = hostIn(container);
    const { root, events } = popoverIn(host);
    host.open();
    expect(root.matches(':popover-open')).toBe(true);
    host.close();
    expect(events).toEqual([true, false]);
    await vi.waitFor(() => expect(root.matches(':popover-open')).toBe(false));
  });

  it('asks shouldCloseOnInteractOutside about a press outside', async () => {
    const container = mount(`
      <uni-popover>${POPOVER}</uni-popover>
      <button id="keep">Keep</button><button id="other">Other</button>`);
    const host = hostIn(container);
    host.shouldCloseOnInteractOutside = (target) => !target.closest('#keep');
    const { trigger, root, events } = popoverIn(host);
    await userEvent.click(trigger);
    expect(root.matches(':popover-open')).toBe(true);

    await userEvent.click(container.querySelector('#keep')!);
    expect(events).toEqual([true]);
    await userEvent.click(container.querySelector('#other')!);
    expect(events).toEqual([true, { reason: 'outside' }, false]);
  });

  it('reports a popover removed while open and restores focus', async () => {
    const container = mount(`<uni-popover>${POPOVER}</uni-popover>`);
    const { trigger, root, events } = popoverIn(hostIn(container));
    trigger.click();
    expect(root.contains(document.activeElement)).toBe(true);

    root.remove();
    await vi.waitFor(() =>
      expect(events).toEqual([true, { reason: 'browser' }, false]),
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('closes a popover nested in it as it closes, with reason "parent"', async () => {
    const container = mount(`
      <uni-popover id="outer">
        <button data-element="Trigger">Outer</button>
        <div class="uni-popover" aria-label="Outer">
          <uni-popover id="inner">
            <button data-element="Trigger">Inner</button>
            <div class="uni-popover" aria-label="Inner"><button>Deep</button></div>
          </uni-popover>
        </div>
      </uni-popover>`);
    const outerHost = hostIn(container, '#outer');
    const outer = popoverIn(outerHost);
    const inner = popoverIn(hostIn(container, '#inner'));
    outer.trigger.click();
    inner.trigger.click();
    expect(inner.root.matches(':popover-open')).toBe(true);

    outerHost.close();
    expect(inner.events).toEqual([true, { reason: 'parent' }, false]);
    expect(outer.events).toEqual([true, false]);
    await vi.waitFor(() =>
      expect(inner.root.matches(':popover-open')).toBe(false),
    );
  });

  it('opens above a modal dialog it is inside, and Escape closes only the popover', async () => {
    const warn = vi.spyOn(console, 'warn');
    const container = mount(`
      <uni-dialog>
        <button data-element="Trigger">Settings</button>
        <dialog class="uni-dialog" aria-label="Settings">
          <uni-popover>${POPOVER}</uni-popover>
          <button data-element="Close">Done</button>
        </dialog>
      </uni-dialog>`);
    const modal = container.querySelector('dialog')!;
    container
      .querySelector<HTMLElement>('uni-dialog > [data-element="Trigger"]')!
      .click();
    expect(modal.matches(':modal')).toBe(true);

    const { trigger, root, events } = popoverIn(hostIn(container));
    await userEvent.click(trigger);
    expect(root.matches(':popover-open')).toBe(true);
    const box = root.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    expect(root.contains(hit)).toBe(true);
    expect(root.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    expect(events).toEqual([true, { reason: 'escape' }, false]);
    expect(modal.matches(':modal')).toBe(true);
    // Restored once the closing phase ends.
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns about a popover without a name and one opened outside an open modal dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = mount(`
      <uni-popover id="unnamed">
        <div class="uni-popover"><button>Go</button></div>
      </uni-popover>
      <uni-popover id="outside">${POPOVER}</uni-popover>
      <dialog id="modal">Modal</dialog>`);
    const messages = () => warn.mock.calls.map(([message]) => String(message));
    hostIn(container, '#unnamed').isOpen = true;
    await vi.waitFor(() =>
      expect(
        messages().filter((message) => message.includes('popover:')),
      ).toHaveLength(1),
    );
    container.querySelector<HTMLDialogElement>('#modal')!.showModal();
    hostIn(container, '#outside').isOpen = true;
    await vi.waitFor(() =>
      expect(
        messages().filter((message) => message.includes('popover:')),
      ).toHaveLength(2),
    );
    const all = messages();
    warn.mockRestore();
    expect(all.some((message) => message.includes('no name'))).toBe(true);
    expect(all.some((message) => message.includes('modal dialog'))).toBe(true);
  });

  it('does not warn about a titled popover that opens with its parts', async () => {
    const warn = vi.spyOn(console, 'warn');
    const host = document.createElement('uni-popover');
    host.defaultOpen = true;
    document.body.append(host);
    host.innerHTML = POPOVER;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(warn).not.toHaveBeenCalled();
    expect(host.querySelector(':popover-open')).not.toBe(null);
    warn.mockRestore();
  });
});

describe('<uni-tooltip>', () => {
  type Tooltip = UniElement<typeof tooltip>;

  const TOOLTIP = `
    <button data-element="Trigger">Save</button>
    <div class="uni-tooltip">Saves the file</div>`;

  /** The tooltip's parts and its `openchange` details. */
  function tooltipIn(container: HTMLElement, selector = 'uni-tooltip') {
    const host = container.querySelector<Tooltip>(selector)!;
    const part = (selector: string) =>
      host.querySelector<HTMLElement>(`:scope > ${selector}`);
    const events: unknown[] = [];
    host.addEventListener('openchange', (event) =>
      events.push((event as CustomEvent).detail),
    );
    return {
      host,
      trigger: part(byElement('trigger')),
      root: part('.uni-tooltip')!,
      events,
    };
  }

  const isOpen = (root: Element) => root.matches(':popover-open');

  it('reads its attributes', () => {
    const container = mount(`
      <uni-tooltip relation="label" delay="0" close-delay="100" trigger="focus">
        ${TOOLTIP}
      </uni-tooltip>`);
    const { trigger, root } = tooltipIn(container);
    expect(trigger!.getAttribute('aria-labelledby')).toBe(root.id);
    expect(trigger!.hasAttribute('aria-describedby')).toBe(false);
  });

  it('links a component outside it by id through the tooltip attribute', async () => {
    const container = mount(`
      <uni-button tooltip="save-tip"><button class="uni-button">Save</button></uni-button>
      <uni-tooltip id="save-tip"><div class="uni-tooltip">Saves the file</div></uni-tooltip>`);
    const button = container.querySelector('button')!;
    const { root, events } = tooltipIn(container);
    expect(button.getAttribute('aria-describedby')).toBe(root.id);

    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(button);
    expect(events).toEqual([true]);
    await vi.waitFor(() => expect(isOpen(root)).toBe(true));

    button.blur();
    button.parentElement!.removeAttribute('tooltip');
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });

  it('closes when its trigger or the component it describes is removed', async () => {
    // One at a time: each opens after the one before has gone.
    const container = mount(
      `<uni-tooltip id="plain" default-open>${TOOLTIP}</uni-tooltip>`,
    );
    const plain = tooltipIn(container, '#plain');
    await vi.waitFor(() => expect(isOpen(plain.root)).toBe(true));
    plain.trigger!.remove();
    await vi.waitFor(() => expect(isOpen(plain.root)).toBe(false));
    expect(plain.events).toEqual([false]);

    container.insertAdjacentHTML(
      'beforeend',
      `<uni-tooltip id="linked" default-open>
        <uni-button><button class="uni-button">Open</button></uni-button>
        <div class="uni-tooltip">Opens a file</div>
      </uni-tooltip>`,
    );
    const linked = tooltipIn(container, '#linked');
    await vi.waitFor(() => expect(isOpen(linked.root)).toBe(true));
    linked.host.querySelector('uni-button')!.remove();
    await vi.waitFor(() => expect(isOpen(linked.root)).toBe(false));
    expect(linked.events).toEqual([false]);
  });

  it('leaves an Escape that is composing text alone', async () => {
    const container = mount(
      `<uni-tooltip default-open>${TOOLTIP}</uni-tooltip>`,
    );
    const { root, events } = tooltipIn(container);
    await vi.waitFor(() => expect(isOpen(root)).toBe(true));
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(events).toEqual([]);
  });

  it('does not open for focus coming back with the window', async () => {
    // tabindex: WebKit tabs to a button only with one, as macOS.
    const container = mount(`
      <input aria-label="Before" />
      <uni-tooltip>
        <button data-element="Trigger" tabindex="0">Save</button>
        <div class="uni-tooltip">Saves the file</div>
      </uni-tooltip>`);
    const { trigger, root, events } = tooltipIn(container);
    container.querySelector('input')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger);
    expect(events).toEqual([true]);

    // The window loses focus and gets it back, as switching apps does: the
    // browser blurs and focuses the trigger again.
    window.dispatchEvent(new FocusEvent('blur'));
    trigger!.dispatchEvent(new FocusEvent('blur'));
    expect(events).toEqual([true, false]);
    window.dispatchEvent(new FocusEvent('focus'));
    trigger!.dispatchEvent(new FocusEvent('focus'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events).toEqual([true, false]);
    expect(isOpen(root)).toBe(false);
  });

  it('warns about a focusable element inside, a second component, a trigger part beside a component and opening outside an open modal dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = mount(`
      <uni-tooltip id="focusable">
        <button data-element="Trigger">Help</button>
        <div class="uni-tooltip">See <a href="#docs">the docs</a></div>
      </uni-tooltip>
      <uni-tooltip id="both">
        <button data-element="Trigger">Save</button>
        <uni-button><button class="uni-button">Open</button></uni-button>
        <uni-button><button class="uni-button">Close</button></uni-button>
        <div class="uni-tooltip">Opens a file</div>
      </uni-tooltip>
      <uni-tooltip id="outside">${TOOLTIP}</uni-tooltip>
      <dialog id="modal">Modal</dialog>`);
    const messages = () =>
      warn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('tooltip:'));
    tooltipIn(container, '#focusable').host.isOpen = true;
    await vi.waitFor(() => expect(messages()).toHaveLength(1));
    tooltipIn(container, '#both').host.isOpen = true;
    await vi.waitFor(() => expect(messages()).toHaveLength(3));
    container.querySelector<HTMLDialogElement>('#modal')!.showModal();
    tooltipIn(container, '#outside').host.isOpen = true;
    await vi.waitFor(() => expect(messages()).toHaveLength(4));
    const all = messages();
    container.querySelector<HTMLDialogElement>('#modal')!.close();
    warn.mockRestore();
    expect(all.some((message) => message.includes('focusable'))).toBe(true);
    expect(all.some((message) => message.includes('another component'))).toBe(
      true,
    );
    expect(all.some((message) => message.includes('trigger part'))).toBe(true);
    expect(all.some((message) => message.includes('modal dialog'))).toBe(true);
  });

  it('does not warn about a tooltip that opens with its text', async () => {
    const warn = vi.spyOn(console, 'warn');
    const host = document.createElement('uni-tooltip');
    host.defaultOpen = true;
    document.body.append(host);
    host.innerHTML = TOOLTIP;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(warn).not.toHaveBeenCalled();
    expect(host.querySelector(':popover-open')).not.toBe(null);
    warn.mockRestore();
    host.remove();
  });
});

describe('<uni-listbox>', () => {
  const FRUIT = `
    <uni-listbox selection-mode="multiple" disabled-keys='["cherry"]'>
      <span data-element="Label">Fruit</span>
      <div data-element="List" id="fruit">
        <div data-element="Option" data-key="apple">Apple</div>
        <div data-element="Option" data-key="cherry">Cherry</div>
        <div data-element="Group" data-key="citrus">
          <span data-element="GroupLabel" data-key="citrus">Citrus</span>
          <div data-element="Option" data-key="lemon" data-text-value="Lemon">
            Lemon <small>sour</small>
          </div>
        </div>
      </div>
      <p data-element="Empty">No fruit</p>
    </uni-listbox>`;

  const listboxIn = (container: HTMLElement) => {
    const host =
      container.querySelector<UniElement<typeof listbox>>('uni-listbox')!;
    const part = (name: string) =>
      host.querySelector<HTMLElement>(byElement(name))!;
    const option = (key: string) =>
      host.querySelector<HTMLElement>(
        `[data-element="Option"][data-key="${key}"]`,
      )!;
    return { host, part, option };
  };

  it('reads its options from the markup and adopts the list id', () => {
    const { host, part, option } = listboxIn(mount(FRUIT));
    expect(host.listId).toBe('fruit');
    expect(part('list').getAttribute('aria-multiselectable')).toBe('true');
    expect(option('apple').getAttribute('role')).toBe('option');
    expect(option('apple').id).toBe('fruit-option-apple');
    expect(option('cherry').getAttribute('aria-disabled')).toBe('true');
    expect(part('group').getAttribute('aria-labelledby')).toBe(
      part('groupLabel').id,
    );
    expect(part('empty').hidden).toBe(true);

    option('lemon').querySelector('small')!.click();
    option('cherry').click();
    option('apple').click();
    expect(host.instance.getState().value).toEqual(['lemon', 'apple']);
  });

  it('finds an option by typing its data-text-value', async () => {
    const { option } = listboxIn(mount(FRUIT));
    option('apple').focus();
    await userEvent.keyboard('l');
    expect(document.activeElement).toBe(option('lemon'));
  });

  it('finds an option by a data-text-value that changed', async () => {
    const { option } = listboxIn(mount(FRUIT));
    option('lemon').setAttribute('data-text-value', 'Kiwi');
    await new Promise((resolve) => setTimeout(resolve));
    option('apple').focus();
    await userEvent.keyboard('k');
    expect(document.activeElement).toBe(option('lemon'));
  });

  it('shows the empty part once the markup has no options', async () => {
    const { host, part } = listboxIn(mount(FRUIT));
    part('list').replaceChildren();
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.instance.getState().isEmpty).toBe(true);
    expect(part('empty').hidden).toBe(false);
    expect(part('list').getAttribute('tabindex')).toBe('0');
    expect(part('list').getAttribute('aria-describedby')).toBe(
      part('empty').id,
    );
  });
});

describe('<uni-select>', () => {
  const FRUIT = `
    <uni-select placeholder="Pick a fruit" required>
      <span data-element="Label">Fruit</span>
      <button data-element="Trigger" id="pick">
        <span data-element="Value"></span>
      </button>
      <div data-element="Popover">
        <div data-element="List" id="fruit">
          <div data-element="Option" data-key="apple">Apple</div>
          <div data-element="Group" data-key="citrus">
            <span data-element="GroupLabel" data-key="citrus">Citrus</span>
            <div data-element="Option" data-key="lemon">Lemon</div>
          </div>
        </div>
      </div>
      <select data-element="HiddenSelect" name="fruit"></select>
    </uni-select>`;

  const selectIn = (container: HTMLElement) => {
    const host =
      container.querySelector<UniElement<typeof select>>('uni-select')!;
    const part = (name: string) =>
      host.querySelector<HTMLElement>(byElement(name))!;
    const option = (key: string) =>
      host.querySelector<HTMLElement>(
        `[data-element="Option"][data-key="${key}"]`,
      )!;
    return { host, part, option };
  };

  it('reads its options from the markup and adopts the trigger and list ids', () => {
    const { host, part, option } = selectIn(mount(FRUIT));
    expect(host.triggerId).toBe('pick');
    expect(host.listId).toBe('fruit');
    const trigger = part('trigger');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-controls')).toBe('fruit');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(part('value').textContent).toBe('Pick a fruit');
    expect(option('lemon').id).toBe('fruit-option-lemon');
    const hidden = part('hiddenSelect') as HTMLSelectElement;
    expect(Array.from(hidden.options, (each) => each.value)).toEqual([
      '',
      'apple',
      'lemon',
    ]);
    expect(hidden.required).toBe(true);
  });

  it('opens on a click and writes the option chosen', async () => {
    const { host, part, option } = selectIn(mount(FRUIT));
    part('trigger').click();
    await expect
      .poll(() => part('popover').matches(':popover-open'))
      .toBe(true);
    option('lemon').click();
    expect(host.instance.getState().value).toEqual(['lemon']);
    expect(part('value').textContent).toBe('Lemon');
    expect((part('hiddenSelect') as HTMLSelectElement).value).toBe('lemon');
    await expect
      .poll(() => part('popover').matches(':popover-open'))
      .toBe(false);
  });
});

describe('<uni-combobox>', () => {
  const FRUIT = `
    <uni-combobox required>
      <label data-element="Label">Fruit</label>
      <input data-element="Input" id="pick" />
      <button data-element="Button">▾</button>
      <div data-element="Popover">
        <div data-element="List" id="fruit">
          <div data-element="Option" data-key="apple">Apple</div>
          <div data-element="Group" data-key="citrus">
            <span data-element="GroupLabel" data-key="citrus">Citrus</span>
            <div data-element="Option" data-key="lemon">Lemon</div>
          </div>
        </div>
      </div>
      <input data-element="HiddenInput" name="fruit" />
    </uni-combobox>`;

  const comboboxIn = (container: HTMLElement) => {
    const host =
      container.querySelector<UniElement<typeof combobox>>('uni-combobox')!;
    const part = (name: string) =>
      host.querySelector<HTMLElement>(byElement(name))!;
    const option = (key: string) =>
      host.querySelector<HTMLElement>(
        `[data-element="Option"][data-key="${key}"]`,
      )!;
    return { host, part, option };
  };

  it('reads its options from the markup and adopts the input and list ids', () => {
    const { host, part, option } = comboboxIn(mount(FRUIT));
    expect(host.inputId).toBe('pick');
    expect(host.listId).toBe('fruit');
    const input = part('input') as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-controls')).toBe('fruit');
    expect(input.required).toBe(true);
    expect(part('label').getAttribute('for')).toBe('pick');
    expect(option('lemon').id).toBe('fruit-option-lemon');
    expect((part('hiddenInput') as HTMLInputElement).type).toBe('hidden');
  });

  it('hides the options and groups the typed text leaves out, and writes the option chosen', async () => {
    const { host, part, option } = comboboxIn(mount(FRUIT));
    const input = part('input') as HTMLInputElement;
    input.focus();
    await userEvent.keyboard('ap');
    await expect
      .poll(() => part('popover').matches(':popover-open'))
      .toBe(true);
    expect(option('apple').hidden).toBe(false);
    expect(option('lemon').hidden).toBe(true);
    expect(part('group').hidden).toBe(true);
    option('apple').click();
    expect(host.instance.getState().value).toEqual(['apple']);
    expect(input.value).toBe('Apple');
    expect((part('hiddenInput') as HTMLInputElement).value).toBe('apple');
    await expect
      .poll(() => part('popover').matches(':popover-open'))
      .toBe(false);
    expect(option('lemon').hidden).toBe(false);
  });
});
