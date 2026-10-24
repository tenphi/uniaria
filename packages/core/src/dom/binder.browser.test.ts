import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInstance, defineBehavior, itemId, prop } from '../runtime';
import { createBinder } from './binder';

const toy = defineBehavior({
  name: 'toy',
  parts: ['root', 'item'],
  props: { label: prop<string | undefined>(undefined) },
  setup(ctx) {
    const on = ctx.state(false);
    const entered = ctx.state(0);
    return {
      on: () => on.get(),
      entered: () => entered.get(),
      toggle: () => on.set(!on.get()),
      enter: () => entered.set(entered.get() + 1),
    };
  },
  expose: ({ api }) => ({ on: api.on(), entered: api.entered() }),
  connect: ({ props, api }) => ({
    root: {
      attrs: {
        'aria-label': props.label(),
        'data-on': api.on() ? '' : undefined,
      },
      on: { click: api.toggle, pointerenter: api.enter },
      style: { '--entered': api.entered() ? String(api.entered()) : undefined },
    },
    item: { attrs: {} },
  }),
});

function setup(
  html = '<div data-uni="toy" class="x"><span>Go</span></div><i data-element="Item"></i>',
) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const root = host.firstElementChild as HTMLElement;
  const item = host.querySelector<HTMLElement>('[data-element="Item"]')!;
  return { host, root, item };
}

/** Attribute names written to `element` while `fn` runs. */
async function mutations(element: Element, fn: () => void): Promise<string[]> {
  const observer = new MutationObserver(() => undefined);
  observer.observe(element, { attributes: true });
  fn();
  const records = observer.takeRecords();
  observer.disconnect();
  return records.map((record) => record.attributeName!);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('createBinder', () => {
  it('warns once about each composed part left out for want of a place', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const card = defineBehavior({
      name: 'card',
      parts: ['root'],
      props: {},
      setup: (ctx) => ({
        inner: ctx.use(toy, () => ({})),
        quiet: ctx.use(toy, () => ({}), { parts: { item: null } }),
      }),
      expose: () => ({}),
      connect: ({ api }) => ({ root: api.inner.connect().root }),
    });
    createBinder(createInstance(card));
    createBinder(createInstance(card));
    expect(warn.mock.calls).toEqual([
      [
        '[uniaria] card composes toy, whose "item" part has no part to render on, so it is left out. Map it to null to leave it out on purpose.',
      ],
    ]);
    warn.mockRestore();
  });

  it('writes part props when it starts, with the part markers', () => {
    const { root, item } = setup();
    const instance = createInstance(toy, { props: { label: 'Go' } });
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.attach('item', item);
    root.removeAttribute('data-uni');
    item.removeAttribute('data-element');

    binder.start();

    expect(root.getAttribute('aria-label')).toBe('Go');
    // The binder writes the markers, and never `class`: the consumer's.
    expect(root.getAttribute('data-uni')).toBe('toy');
    expect(root.getAttribute('class')).toBe('x');
    expect(root.hasAttribute('data-element')).toBe(false);
    expect(item.getAttribute('data-element')).toBe('Item');
    expect(instance.element('root')).toBe(root);
  });

  it('writes only what changed after each flush', async () => {
    const { root } = setup();
    const instance = createInstance(toy, { props: { label: 'Go' } });
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.start();

    expect(await mutations(root, () => instance.api.toggle())).toEqual([
      'data-on',
    ]);
    expect(root.getAttribute('data-on')).toBe('');
    expect(await mutations(root, () => instance.api.toggle())).toEqual([
      'data-on',
    ]);
    expect(root.hasAttribute('data-on')).toBe(false);
  });

  it('removes attributes that become undefined and keeps the rest', () => {
    const { root } = setup();
    const instance = createInstance(toy, { props: { label: 'Go' } });
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.start();

    instance.setProps({});
    instance.sync();

    expect(root.hasAttribute('aria-label')).toBe(false);
    expect(root.getAttribute('data-uni')).toBe('toy');
    expect(root.getAttribute('class')).toBe('x');
  });

  it('compares with the element, so outside writes are corrected', () => {
    const { root, item } = setup();
    const instance = createInstance(toy);
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.attach('item', item);
    binder.start();

    root.setAttribute('data-on', '');
    item.setAttribute('data-element', 'Other');
    binder.apply();

    expect(root.hasAttribute('data-on')).toBe(false);
    expect(item.getAttribute('data-element')).toBe('Item');
  });

  it('writes CSS custom properties', () => {
    const { root } = setup();
    const instance = createInstance(toy);
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.start();

    instance.api.enter();
    expect(root.style.getPropertyValue('--entered')).toBe('1');
    instance.stop();
  });

  it('sets live properties only when they differ, leaving undefined alone', () => {
    const live = defineBehavior({
      name: 'live',
      parts: ['input'],
      props: { text: prop<string | undefined>(undefined) },
      setup: () => ({}),
      expose: () => ({}),
      connect: ({ props }) => ({
        input: { attrs: {}, properties: { value: props.text() } },
      }),
    });
    const { root: input } = setup('<input data-element="Input" />');
    const instance = createInstance(live, { props: { text: 'abc' } });
    const binder = createBinder(instance);
    binder.attach('input', input);
    instance.start();
    binder.start();
    const element = input as HTMLInputElement;
    expect(element.value).toBe('abc');
    expect(element.hasAttribute('value')).toBe(false);

    // Equal: no write, so the caret stays where the user put it.
    element.focus();
    element.setSelectionRange(1, 1);
    instance.setProps({ text: 'abc' });
    instance.sync();
    binder.apply();
    expect(element.selectionStart).toBe(1);

    instance.setProps({ text: 'xyz' });
    instance.sync();
    expect(element.value).toBe('xyz');

    // Undefined leaves what the user typed.
    instance.setProps({});
    instance.sync();
    element.value = 'typed';
    binder.apply();
    expect(element.value).toBe('typed');
  });

  it('stops writing after stop() and after a part detaches', () => {
    const { root } = setup();
    const instance = createInstance(toy);
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.start();

    binder.stop();
    instance.api.toggle();
    expect(root.hasAttribute('data-on')).toBe(false);

    binder.start();
    expect(root.hasAttribute('data-on')).toBe(true);
    binder.attach('root', null);
    expect(root.hasAttribute('data-on')).toBe(false);
    instance.api.toggle();
    instance.api.toggle();
    expect(root.hasAttribute('data-on')).toBe(false);
    expect(instance.element('root')).toBeNull();
  });

  describe('part ids', () => {
    /** A trigger that controls a panel, as a disclosure's. */
    const disclosure = defineBehavior({
      name: 'disc',
      parts: ['trigger', 'panel'],
      props: {
        panelId: prop<string | undefined>(undefined, { idOf: 'panel' }),
      },
      setup: () => ({}),
      expose: () => ({}),
      connect: ({ ids }) => ({
        trigger: { attrs: { id: ids.trigger, 'aria-controls': ids.panel } },
        panel: { attrs: { id: ids.panel } },
      }),
    });

    function mountDisclosure(html: string, props = {}) {
      const { host } = setup(html);
      const trigger = host.querySelector<HTMLElement>(
        '[data-element="Trigger"]',
      )!;
      const panel = host.querySelector<HTMLElement>('[data-element="Panel"]')!;
      const instance = createInstance(disclosure, { id: 'd', props });
      const binder = createBinder(instance, { host });
      binder.attach('trigger', trigger);
      binder.attach('panel', panel);
      instance.start();
      binder.start();
      return { trigger, panel, instance, binder };
    }

    /** Lets the id observer hear of a change. */
    const observed = () => new Promise((resolve) => setTimeout(resolve));

    it('keeps the id an element has as it attaches, and references follow it', () => {
      const { trigger, panel, instance } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel" id="details"></div>',
      );
      expect(panel.id).toBe('details');
      expect(trigger.getAttribute('aria-controls')).toBe('details');
      expect(trigger.id).toBe('d-trigger');
      expect(instance.ids.panel).toBe('details');
    });

    it("wins over the part's id prop", () => {
      const { trigger, panel } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel" id="details"></div>',
        { panelId: 'more' },
      );
      expect(panel.id).toBe('details');
      expect(trigger.getAttribute('aria-controls')).toBe('details');
    });

    it('follows an id the consumer gives, changes or removes later', async () => {
      const { trigger, panel } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel"></div>',
      );
      expect(panel.id).toBe('d-panel');

      panel.id = 'details';
      await observed();
      expect(trigger.getAttribute('aria-controls')).toBe('details');

      panel.id = 'more';
      await observed();
      expect(trigger.getAttribute('aria-controls')).toBe('more');

      // With none, the part takes its own again.
      panel.removeAttribute('id');
      await observed();
      expect(panel.id).toBe('d-panel');
      expect(trigger.getAttribute('aria-controls')).toBe('d-panel');
    });

    it('never writes over an id the consumer set just before a flush', () => {
      const { trigger, panel, instance } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel"></div>',
      );
      panel.id = 'details';
      instance.setProps({ panelId: 'more' });
      instance.sync();
      expect(panel.id).toBe('details');
      expect(trigger.getAttribute('aria-controls')).toBe('details');
    });

    it('writes its own id again when the id prop changes', async () => {
      const { trigger, panel, instance } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel"></div>',
        { panelId: 'more' },
      );
      expect(panel.id).toBe('more');
      instance.setProps({ panelId: 'extra' });
      instance.sync();
      await observed();
      expect(panel.id).toBe('extra');
      expect(trigger.getAttribute('aria-controls')).toBe('extra');
      expect(instance.ids.panel).toBe('extra');
    });

    it('takes the id a framework rendered from the part props as its own', async () => {
      const { panel, instance } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel"></div>',
        { panelId: 'more' },
      );
      // A render of the new props reaches the element before the sync.
      instance.setProps({ panelId: 'extra' });
      panel.id = 'extra';
      instance.sync();
      await observed();
      instance.setProps({ panelId: 'last' });
      instance.sync();
      expect(panel.id).toBe('last');
    });

    it('agrees on one id with another instance bound to the same element', async () => {
      const { trigger, panel, instance } = mountDisclosure(
        '<button data-element="Trigger"></button><div data-element="Panel"></div>',
      );
      const other = createInstance(disclosure, { id: 'o' });
      const binder = createBinder(other);
      binder.attach('panel', panel);
      other.start();
      binder.start();
      expect(panel.id).toBe('d-panel');
      expect(other.ids.panel).toBe('d-panel');

      panel.id = 'details';
      await observed();
      expect(instance.ids.panel).toBe('details');
      expect(other.ids.panel).toBe('details');
      expect(trigger.getAttribute('aria-controls')).toBe('details');
    });
  });

  describe('letting an element go', () => {
    const panel = defineBehavior({
      name: 'panel',
      parts: ['trigger', 'panel'],
      props: { isOpen: prop(false) },
      setup: () => ({}),
      expose: () => ({}),
      connect: ({ props, ids }) => ({
        trigger: {
          attrs: {
            id: ids.trigger,
            'aria-expanded': String(props.isOpen()),
            'aria-controls': ids.panel,
          },
          style: { '--size': '2' },
        },
        panel: { attrs: { id: ids.panel } },
      }),
    });

    function mountPanel(html: string) {
      const { host } = setup(html);
      const [first, second] = host.querySelectorAll<HTMLElement>('button');
      const instance = createInstance(panel, { id: 'p' });
      const binder = createBinder(instance, { host });
      binder.attach('trigger', first!);
      instance.start();
      binder.start();
      return { first: first!, second: second!, instance, binder };
    }

    const TWO =
      '<button data-element="Trigger" class="a">One</button><button data-element="Trigger">Two</button>';

    it('removes what it wrote when another element takes the part', () => {
      const { first, second, binder } = mountPanel(TWO);
      expect(first.getAttribute('aria-expanded')).toBe('false');

      binder.attach('trigger', second);
      for (const name of ['id', 'aria-expanded', 'aria-controls']) {
        expect(first.hasAttribute(name), name).toBe(false);
      }
      expect(first.style.getPropertyValue('--size')).toBe('');
      // The consumer's markers and classes stay.
      expect(first.getAttribute('data-element')).toBe('Trigger');
      expect(first.className).toBe('a');
      expect(second.getAttribute('aria-expanded')).toBe('false');
      expect(second.id).toBe('p-trigger');
    });

    it("removes what it wrote when the part detaches, and keeps the consumer's id", () => {
      const { first, binder } = mountPanel(
        '<button data-element="Trigger" id="go" aria-label="Go">One</button>',
      );
      expect(first.getAttribute('aria-controls')).toBe('p-panel');
      binder.attach('trigger', null);
      expect(first.id).toBe('go');
      expect(first.getAttribute('aria-label')).toBe('Go');
      expect(first.hasAttribute('aria-controls')).toBe(false);
    });

    it('leaves what no longer holds what it wrote, and what another part writes', () => {
      const { first, second, instance, binder } = mountPanel(TWO);
      first.setAttribute('aria-controls', 'elsewhere');
      const inner = createInstance(panel, { id: 'i' });
      const innerBinder = createBinder(inner);
      innerBinder.attach('trigger', first);
      inner.start();
      innerBinder.start();
      instance.setProps({ isOpen: true });
      instance.sync();
      expect(first.getAttribute('aria-expanded')).toBe('true');

      binder.attach('trigger', second);
      // Still the other instance's to write.
      expect(first.getAttribute('aria-expanded')).toBe('true');
      expect(first.style.getPropertyValue('--size')).toBe('2');
      innerBinder.apply();
      expect(first.getAttribute('aria-expanded')).toBe('false');
    });

    it('removes what it wrote from an element it attaches again only once', () => {
      const { first, binder, instance } = mountPanel(TWO);
      binder.attach('trigger', null);
      binder.attach('trigger', first);
      expect(first.getAttribute('aria-expanded')).toBe('false');
      expect(first.id).toBe('p-trigger');
      expect(instance.ids.trigger).toBe('p-trigger');
    });
  });

  it('adds no listeners without a host', () => {
    const { root } = setup();
    const instance = createInstance(toy);
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.start();

    root.click();
    expect(instance.getState().on).toBe(false);
  });

  describe('with a host', () => {
    it('delegates bubbling events from descendants of a part', () => {
      const { host, root } = setup();
      const instance = createInstance(toy);
      const binder = createBinder(instance, { host });
      binder.attach('root', root);
      binder.start();

      root.querySelector('span')!.click();
      expect(instance.getState().on).toBe(true);
    });

    it('delegates events that do not bubble only from the part itself', () => {
      const { host, root } = setup();
      const instance = createInstance(toy);
      const binder = createBinder(instance, { host });
      binder.attach('root', root);
      binder.start();

      const enter = () => new PointerEvent('pointerenter', { bubbles: false });
      root.querySelector('span')!.dispatchEvent(enter());
      expect(instance.getState().entered).toBe(0);
      root.dispatchEvent(enter());
      expect(instance.getState().entered).toBe(1);
    });

    it('delivers a bubbling event to every part on its path, innermost first', () => {
      const calls: string[] = [];
      const log = (part: string) => (event: Event) =>
        calls.push(`${part}:${event.type}`);
      const nested = defineBehavior({
        name: 'nested',
        parts: ['root', 'item'],
        props: {},
        setup: () => ({}),
        expose: () => ({}),
        connect: () => ({
          root: {
            attrs: {},
            on: { click: log('root'), pointerenter: log('root') },
          },
          item: {
            attrs: {},
            on: { click: log('item'), pointerenter: log('item') },
          },
        }),
      });
      const { root, item, host } = setup(
        '<div data-uni="nested"><p data-element="Item"><span>Go</span></p></div>',
      );
      const binder = createBinder(createInstance(nested), { host });
      binder.attach('root', root);
      binder.attach('item', item);
      binder.start();

      item.querySelector('span')!.click();
      expect(calls).toEqual(['item:click', 'root:click']);

      calls.length = 0;
      item.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
      expect(calls).toEqual(['item:pointerenter']);
    });

    it('removes its listeners on stop', () => {
      const { host, root } = setup();
      const instance = createInstance(toy);
      const binder = createBinder(instance, { host });
      binder.attach('root', root);
      binder.start();
      binder.stop();

      root.click();
      expect(instance.getState().on).toBe(false);
    });

    // Earlier tests leave their hosts started: event types of their own keep
    // the document's listeners for them apart.
    const heard = (types: readonly string[]) => {
      const calls: string[] = [];
      const definition = defineBehavior({
        name: 'heard',
        parts: ['root'],
        props: {},
        setup: () => ({}),
        expose: () => ({}),
        connect: () => ({
          root: {
            attrs: {},
            on: Object.fromEntries(
              types.map((type) => [type, () => calls.push(type)]),
            ),
          },
        }),
      });
      return { definition, calls };
    };

    it('listens on the document, never on the host or a part', () => {
      const { host, root } = setup();
      const onHost = vi.spyOn(host, 'addEventListener');
      const onRoot = vi.spyOn(root, 'addEventListener');
      const onDocument = vi.spyOn(document, 'addEventListener');
      const { definition } = heard(['uni-a', 'uni-b']);
      const binder = createBinder(createInstance(definition), { host });
      binder.attach('root', root);
      binder.start();

      expect(onHost).not.toHaveBeenCalled();
      expect(onRoot).not.toHaveBeenCalled();
      // Capturing, for events that don't bubble, and bubbling.
      expect(
        onDocument.mock.calls.map(([type, , options]) => [
          type,
          typeof options === 'object' && options.capture === true,
        ]),
      ).toEqual([
        ['uni-a', true],
        ['uni-a', false],
        ['uni-b', true],
        ['uni-b', false],
      ]);
      onDocument.mockRestore();
      binder.stop();
    });

    it('shares one listener per event type among hosts, removed with the last', () => {
      const first = setup();
      const second = setup();
      const added = vi.spyOn(document, 'addEventListener');
      const removed = vi.spyOn(document, 'removeEventListener');
      const firstHeard = heard(['uni-c']);
      const secondHeard = heard(['uni-c']);
      const firstBinder = createBinder(createInstance(firstHeard.definition), {
        host: first.host,
      });
      const secondBinder = createBinder(
        createInstance(secondHeard.definition),
        { host: second.host },
      );
      firstBinder.attach('root', first.root);
      secondBinder.attach('root', second.root);
      firstBinder.start();
      secondBinder.start();
      expect(added).toHaveBeenCalledTimes(2);

      const fire = () =>
        second.root.dispatchEvent(new Event('uni-c', { bubbles: true }));
      fire();
      expect(firstHeard.calls).toEqual([]);
      expect(secondHeard.calls).toEqual(['uni-c']);

      firstBinder.stop();
      expect(removed).not.toHaveBeenCalled();
      fire();
      expect(secondHeard.calls).toEqual(['uni-c', 'uni-c']);

      secondBinder.stop();
      expect(removed).toHaveBeenCalledTimes(2);
      fire();
      expect(secondHeard.calls).toEqual(['uni-c', 'uni-c']);
      added.mockRestore();
      removed.mockRestore();
    });

    it('reaches nested hosts innermost first, and none after a handler stops it', () => {
      const calls: string[] = [];
      const logging = (name: string, stops = false) =>
        defineBehavior({
          name,
          parts: ['root'],
          props: {},
          setup: () => ({}),
          expose: () => ({}),
          connect: () => ({
            root: {
              attrs: {},
              on: {
                click: (event: Event) => {
                  calls.push(name);
                  if (stops) event.stopPropagation();
                },
              },
            },
          }),
        });
      const { host: outer, root: outerRoot } = setup(
        '<div data-uni="outer"><div id="inner"><button data-uni="inner">Go</button></div></div>',
      );
      const inner = outer.querySelector<HTMLElement>('#inner')!;
      const button = inner.querySelector('button')!;
      const start = (
        name: string,
        host: HTMLElement,
        part: HTMLElement,
        stops = false,
      ) => {
        const binder = createBinder(createInstance(logging(name, stops)), {
          host,
        });
        binder.attach('root', part);
        binder.start();
        return binder;
      };
      const outerBinder = start('outer', outer, outerRoot);
      const innerBinder = start('inner', inner, button);

      button.click();
      expect(calls).toEqual(['inner', 'outer']);

      outerBinder.stop();
      innerBinder.stop();
      calls.length = 0;
      start('outer', outer, outerRoot);
      start('inner', inner, button, true);
      button.click();
      expect(calls).toEqual(['inner']);
    });

    it('runs after the listeners on the path, which can prevent an event first', () => {
      const { host, root } = setup();
      const instance = createInstance(toy);
      const binder = createBinder(instance, { host });
      binder.attach('root', root);
      binder.start();
      const order: string[] = [];
      const span = root.querySelector('span')!;
      span.addEventListener('click', () => order.push('target'));
      host.addEventListener('click', () => order.push('host'));
      document.body.addEventListener('click', () => order.push('body'));

      span.click();
      expect(order).toEqual(['target', 'host', 'body']);
      expect(instance.getState().on).toBe(true);

      host.addEventListener('click', (event) => event.stopPropagation());
      span.click();
      expect(instance.getState().on).toBe(true);
      binder.stop();
    });

    it('writes no stale live property while an input event is on its way to it', () => {
      const field = defineBehavior({
        name: 'field',
        parts: ['input'],
        props: { mark: prop(0) },
        setup(ctx) {
          const text = ctx.state('');
          return {
            text: () => text.get(),
            setText: (value: string) => text.set(value),
          };
        },
        expose: ({ api }) => ({ text: api.text() }),
        connect: ({ props, api }) => ({
          input: {
            attrs: { 'data-mark': String(props.mark()) },
            on: {
              input: (event: Event) =>
                api.setText((event.target as HTMLInputElement).value),
            },
            properties: { value: api.text() },
          },
        }),
      });
      const { host, root } = setup('<input data-element="Input" />');
      const input = root as HTMLInputElement;
      const instance = createInstance(field);
      const binder = createBinder(instance, { host });
      binder.attach('input', input);
      instance.start();
      binder.start();
      const type = (text: string) => {
        input.value = text;
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      };
      let mark = 0;
      // A consumer's listener setting a host attribute flushes the instance
      // before it hears of the text.
      const flush = () => {
        instance.setProps({ mark: ++mark });
        instance.sync();
      };

      host.addEventListener('input', flush, { once: true });
      type('a');
      expect(input.getAttribute('data-mark')).toBe('1');
      expect(input.value).toBe('a');
      expect(instance.getState().text).toBe('a');

      // A value the instance changes meanwhile is written.
      const replace = () => {
        instance.api.setText('B');
        instance.sync();
      };
      host.addEventListener('input', replace, { once: true });
      type('ab');
      expect(input.value).toBe('B');
      expect(instance.getState().text).toBe('B');

      // An event a listener stops never reaches the instance, and the guard
      // ends with its dispatch: the next flush writes the instance's text.
      const stop = (event: Event) => event.stopPropagation();
      host.addEventListener('input', stop, { once: true });
      type('Bc');
      expect(instance.getState().text).toBe('B');
      flush();
      expect(input.value).toBe('B');
      binder.stop();
    });

    it('listens on the shadow root of a host inside one', () => {
      const shadowHost = document.createElement('div');
      document.body.append(shadowHost);
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const host = document.createElement('div');
      host.innerHTML = '<div data-uni="toy"><span>Go</span></div>';
      shadow.append(host);
      const root = host.querySelector<HTMLElement>('[data-uni="toy"]')!;
      const onShadow = vi.spyOn(shadow, 'addEventListener');
      const instance = createInstance(toy);
      const binder = createBinder(instance, { host });
      binder.attach('root', root);
      binder.start();

      expect(onShadow).toHaveBeenCalled();
      root.querySelector('span')!.click();
      expect(instance.getState().on).toBe(true);
      binder.stop();
    });
  });
});

/** Rows keyed by item, one active, as a listbox's options are. */
const rows = defineBehavior({
  name: 'rows',
  parts: ['root'],
  itemParts: ['row', 'rowLabel'],
  props: { tone: prop('plain') },
  setup(ctx) {
    const active = ctx.state<string | null>(null);
    const computed: string[] = [];
    return {
      active: () => active.get(),
      computed,
      label: (key: string) => ctx.itemElement('rowLabel', key),
      activate(key: string) {
        const previous = active.get();
        active.set(key);
        ctx.invalidateItems(previous === null ? [key] : [previous, key]);
      },
    };
  },
  expose: ({ api }) => ({ active: api.active() }),
  connect: () => ({ root: { attrs: {} } }),
  connectItem({ props, api }, part, key) {
    api.computed.push(`${part}:${key}`);
    if (part === 'rowLabel') return { attrs: { id: itemId('r', part, key) } };
    return {
      attrs: {
        'data-active': api.active() === key ? '' : undefined,
        'data-tone': props.tone(),
        'aria-labelledby': api.label(key)
          ? itemId('r', 'rowLabel', key)
          : undefined,
      },
      on: { click: () => api.activate(key) },
    };
  },
});

function setupRows(keys = ['a', 'b', 'c']) {
  const host = document.createElement('div');
  host.innerHTML = keys
    .map(
      (key) =>
        `<p data-element="Row" data-key="${key}"><span>${key}</span></p>`,
    )
    .join('');
  document.body.append(host);
  const row = (key: string) =>
    host.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  return { host, row };
}

describe('createBinder with item parts', () => {
  it('writes every item part when it starts, and only invalidated keys after', async () => {
    const { host, row } = setupRows();
    const instance = createInstance(rows);
    const binder = createBinder(instance, { host });
    for (const key of ['a', 'b', 'c']) binder.attachItem('row', key, row(key));
    row('c').removeAttribute('data-element');

    binder.start();
    expect(row('c').getAttribute('data-element')).toBe('Row');
    expect(binder.itemOf(row('b'))).toEqual({ part: 'row', key: 'b' });
    instance.api.computed.length = 0;

    row('b').querySelector('span')!.click();
    expect(row('b').hasAttribute('data-active')).toBe(true);
    expect(instance.api.computed).toEqual(['row:b']);
    expect(await mutations(row('a'), () => row('c').click())).toEqual([]);
    expect(row('b').hasAttribute('data-active')).toBe(false);
    expect(row('c').hasAttribute('data-active')).toBe(true);
    expect(instance.api.computed).toEqual(['row:b', 'row:b', 'row:c']);

    instance.setProps({ tone: 'loud' });
    instance.sync();
    expect(row('a').getAttribute('data-tone')).toBe('loud');
    binder.stop();
  });

  it('writes a key again when another of its parts attaches or detaches', () => {
    const { host, row } = setupRows(['a']);
    const label = document.createElement('span');
    row('a').append(label);
    const instance = createInstance(rows);
    const binder = createBinder(instance, { host });
    binder.attachItem('row', 'a', row('a'));
    instance.start();
    binder.start();
    expect(row('a').hasAttribute('aria-labelledby')).toBe(false);

    binder.attachItem('rowLabel', 'a', label);
    expect(label.id).toBe('r-rowLabel-a');
    expect(row('a').getAttribute('aria-labelledby')).toBe('r-rowLabel-a');
    binder.attachItem('rowLabel', 'a', null);
    expect(row('a').hasAttribute('aria-labelledby')).toBe(false);
    expect(binder.itemOf(label)).toBeUndefined();
    instance.stop();
  });

  it('removes what it wrote from an item element it lets go', () => {
    const { host, row } = setupRows(['a', 'b']);
    const instance = createInstance(rows);
    const binder = createBinder(instance, { host });
    binder.attachItem('row', 'a', row('a'));
    instance.start();
    binder.start();
    row('a').click();
    expect(row('a').getAttribute('data-active')).toBe('');

    binder.attachItem('row', 'a', row('b'));
    expect(row('a').hasAttribute('data-active')).toBe(false);
    expect(row('a').hasAttribute('data-tone')).toBe(false);
    expect(row('a').getAttribute('data-key')).toBe('a');
    expect(row('a').getAttribute('data-element')).toBe('Row');
    expect(row('b').getAttribute('data-active')).toBe('');

    binder.attachItem('row', 'a', null);
    expect(row('b').hasAttribute('data-tone')).toBe(false);
    binder.stop();
  });

  it('stops writing and dispatching to a detached item', () => {
    const { host, row } = setupRows(['a', 'b']);
    const instance = createInstance(rows);
    const binder = createBinder(instance, { host });
    binder.attachItem('row', 'a', row('a'));
    binder.attachItem('row', 'b', row('b'));
    binder.start();

    binder.attachItem('row', 'a', null);
    row('a').click();
    expect(instance.getState().active).toBeNull();
    row('b').click();
    expect(instance.getState().active).toBe('b');
    expect(row('a').hasAttribute('data-active')).toBe(false);
    expect(instance.itemElement('row', 'a')).toBeNull();
    binder.stop();
  });
});
