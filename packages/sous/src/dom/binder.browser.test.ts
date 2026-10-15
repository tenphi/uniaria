import { afterEach, describe, expect, it } from 'vitest';

import { createInstance, defineComponent, prop } from '../runtime';
import { createBinder } from './binder';

const toy = defineComponent({
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

function setup(html = '<div data-part="root" class="x"><span>Go</span></div>') {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const root = host.querySelector<HTMLElement>('[data-part="root"]')!;
  return { host, root };
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
  it('writes part props when it starts, with data-scope and data-part', () => {
    const { root } = setup();
    const instance = createInstance(toy, { props: { label: 'Go' } });
    const binder = createBinder(instance);
    binder.attach('root', root);
    expect(root.hasAttribute('data-scope')).toBe(false);

    binder.start();

    expect(root.getAttribute('data-scope')).toBe('toy');
    expect(root.getAttribute('aria-label')).toBe('Go');
    expect(root.getAttribute('class')).toBe('x');
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
    expect(root.getAttribute('class')).toBe('x');
  });

  it('compares with the element, so outside writes are corrected', () => {
    const { root } = setup();
    const instance = createInstance(toy);
    const binder = createBinder(instance);
    binder.attach('root', root);
    binder.start();

    root.setAttribute('data-on', '');
    root.setAttribute('data-scope', 'other');
    binder.apply();

    expect(root.hasAttribute('data-on')).toBe(false);
    expect(root.getAttribute('data-scope')).toBe('toy');
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
    const live = defineComponent({
      name: 'live',
      parts: ['input'],
      props: { text: prop<string | undefined>(undefined) },
      setup: () => ({}),
      expose: () => ({}),
      connect: ({ props }) => ({
        input: { attrs: {}, properties: { value: props.text() } },
      }),
    });
    const { root: input } = setup('<input data-part="root" />');
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
    instance.api.toggle();
    expect(root.hasAttribute('data-on')).toBe(true);
    expect(instance.element('root')).toBeNull();
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
      const nested = defineComponent({
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
      const { host, root } = setup(
        '<div data-part="root"><p data-part="item"><span>Go</span></p></div>',
      );
      const item = host.querySelector<HTMLElement>('[data-part="item"]')!;
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
  });
});
