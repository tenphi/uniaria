import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { defineComponent, isOwnerDefinition, itemId } from './define';
import type { ItemPartOf, LinkKey, PropsOf, StateOf } from './define';
import { createInstance } from './instance';
import { bindable, event, prop } from './schema';

/** A disclosure like design decision 9's example, plus a watcher and an effect. */
const disclosure = defineComponent({
  name: 'disclosure',
  parts: ['trigger', 'panel'],
  props: {
    isOpen: bindable(false),
    isDisabled: prop(false),
    label: prop<string | undefined>(undefined),
  },
  events: { toggle: event<{ isOpen: boolean }>() },
  setup(ctx) {
    const toggles = ctx.state(0);
    const log: string[] = [];
    ctx.watch(
      () => ctx.props.isDisabled(),
      (isDisabled, previous) =>
        log.push(`disabled ${previous} → ${isDisabled}`),
    );
    ctx.effect(() => {
      log.push('start');
      return () => log.push('stop');
    });
    const toggle = () => {
      if (ctx.props.isDisabled()) return;
      const isOpen = !ctx.props.isOpen.get();
      toggles.set(toggles.get() + 1);
      ctx.props.isOpen.set(isOpen);
      ctx.emit('toggle', { isOpen });
    };
    const setOpen = (isOpen: boolean) => ctx.props.isOpen.set(isOpen);
    return { toggle, setOpen, toggles: () => toggles.get(), log };
  },
  expose({ props, api }) {
    return {
      isOpen: props.isOpen.get(),
      isDisabled: props.isDisabled(),
      toggles: api.toggles(),
    };
  },
  connect({ props, ids, api }) {
    const isOpen = props.isOpen.get();
    return {
      trigger: {
        attrs: {
          id: ids.trigger,
          'aria-expanded': String(isOpen),
          'aria-controls': ids.panel,
          'aria-label': props.label(),
        },
        on: { click: api.toggle },
      },
      panel: {
        attrs: { id: ids.panel, hidden: isOpen ? undefined : '' },
        style: { '--toggles': String(api.toggles()) },
      },
    };
  },
});

const click = (
  instance: ReturnType<typeof createInstance<typeof disclosure>>,
) => instance.connect().trigger.on!.click!(undefined as never);

describe('defineComponent', () => {
  it('derives props, callbacks and state types from the definition', () => {
    expectTypeOf<PropsOf<typeof disclosure>>().toEqualTypeOf<
      {
        readonly isOpen?: boolean;
        readonly isDisabled?: boolean;
        readonly label?: string | undefined;
      } & { readonly defaultOpen?: boolean } & {
        readonly onOpenChange?: (value: boolean) => void;
      } & { readonly onToggle?: (detail: { isOpen: boolean }) => void }
    >();
    expectTypeOf<StateOf<typeof disclosure>>().toEqualTypeOf<{
      isOpen: boolean;
      isDisabled: boolean;
      toggles: number;
    }>();
  });

  it('resolves attributes and events for adapters', () => {
    expect(disclosure.schema).toEqual({
      props: [
        {
          key: 'isOpen',
          defaultKey: 'defaultOpen',
          kind: 'bindable',
          defaultValue: false,
          type: 'boolean',
          attribute: 'default-open',
          changeEvent: 'openChange',
        },
        {
          key: 'isDisabled',
          kind: 'prop',
          defaultValue: false,
          type: 'boolean',
          attribute: 'disabled',
        },
        {
          key: 'label',
          kind: 'prop',
          defaultValue: undefined,
          type: 'string',
          attribute: 'label',
        },
      ],
      events: ['openChange', 'toggle'],
    });
  });

  it('drops predicate prefixes from derived names', () => {
    const def = defineComponent({
      name: 'prefixes',
      parts: ['root'],
      props: {
        shouldPreventFocusOnPress: prop(false),
        hasArrow: prop(false),
        isolate: prop(false),
        isExpanded: bindable(false),
      },
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    expectTypeOf<PropsOf<typeof def>>().toHaveProperty('defaultExpanded');
    expectTypeOf<PropsOf<typeof def>>().toHaveProperty('onExpandedChange');
    expect(def.schema.props.map((info) => info.attribute)).toEqual([
      'prevent-focus-on-press',
      'has-arrow',
      'isolate',
      'default-expanded',
    ]);
    expect(def.schema.events).toEqual(['expandedChange']);
  });

  it('takes a custom change event and attribute', () => {
    const def = defineComponent({
      name: 'custom',
      parts: ['root'],
      props: {
        value: bindable(0, { event: 'valueCommit', attribute: 'initial' }),
        maxCount: prop(3, { attribute: false }),
      },
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    expectTypeOf<PropsOf<typeof def>>().toHaveProperty('onValueCommit');
    expect(def.schema.events).toEqual(['valueCommit']);
    expect(def.schema.props.map((info) => info.attribute)).toEqual([
      'initial',
      false,
    ]);
  });

  it('rejects names that are not kebab-case', () => {
    expect(() =>
      defineComponent({
        name: 'BadName',
        parts: ['root'],
        props: {},
        setup: () => ({}),
        expose: () => ({}),
        connect: () => ({ root: { attrs: {} } }),
      }),
    ).toThrow(/kebab-case/);
  });

  it('rejects a prop that collides with a callback', () => {
    expect(() =>
      defineComponent({
        name: 'clash',
        parts: ['root'],
        props: { onPress: prop<string | undefined>(undefined) },
        events: { press: event() },
        setup: () => ({}),
        expose: () => ({}),
        connect: () => ({ root: { attrs: {} } }),
      }),
    ).toThrow(/defined twice/);
  });
});

describe('createInstance', () => {
  it('connects parts with data-scope, data-part and stable ids', () => {
    const instance = createInstance(disclosure, { id: 'd' });
    const { trigger, panel } = instance.connect();
    expect(trigger.attrs).toEqual({
      id: 'd-trigger',
      'aria-expanded': 'false',
      'aria-controls': 'd-panel',
      'aria-label': undefined,
      'data-scope': 'disclosure',
      'data-part': 'trigger',
    });
    expect(panel.attrs).toMatchObject({ id: 'd-panel', hidden: '' });
    expect(panel.style).toEqual({ '--toggles': '0' });
    expect(instance.ids).toEqual({ trigger: 'd-trigger', panel: 'd-panel' });
  });

  it('generates an id when the adapter gives none', () => {
    const a = createInstance(disclosure);
    const b = createInstance(disclosure);
    expect(a.id).not.toBe(b.id);
  });

  it('never serves a stale cache inside a batch', () => {
    const instance = createInstance(disclosure);
    instance.batch(() => {
      expect(instance.getState().isOpen).toBe(false);
      instance.api.setOpen(true);
      expect(instance.getState().isOpen).toBe(true);
      expect(instance.connect().trigger.attrs['aria-expanded']).toBe('true');
    });
  });

  it('caches connect() and expose() until something changes', () => {
    const instance = createInstance(disclosure);
    expect(instance.connect()).toBe(instance.connect());
    expect(instance.getState()).toBe(instance.getState());

    const parts = instance.connect();
    const state = instance.getState();
    click(instance);
    expect(instance.connect()).not.toBe(parts);
    expect(instance.getState()).not.toBe(state);
  });

  describe('bindables', () => {
    it('commits uncontrolled changes and reports them', () => {
      const onOpenChange = vi.fn();
      const instance = createInstance(disclosure, {
        props: { defaultOpen: true, onOpenChange },
      });
      expect(instance.getState().isOpen).toBe(true);

      click(instance);

      expect(instance.getState().isOpen).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('follows its default until the first uncontrolled change', () => {
      const instance = createInstance(disclosure);
      instance.setProps({ defaultOpen: true });
      expect(instance.getState().isOpen).toBe(true);

      click(instance);
      expect(instance.getState().isOpen).toBe(false);

      instance.setProps({ defaultOpen: true, label: 'x' });
      expect(instance.getState().isOpen).toBe(false);
    });

    it('only requests controlled changes', () => {
      const onOpenChange = vi.fn();
      const instance = createInstance(disclosure, {
        props: { isOpen: false, onOpenChange },
      });

      click(instance);

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(instance.getState().isOpen).toBe(false);
      expect(instance.connect().trigger.attrs['aria-expanded']).toBe('false');

      instance.setProps({ isOpen: true, onOpenChange });
      instance.sync();
      expect(instance.getState().isOpen).toBe(true);
    });

    it('does not report a change to the current value', () => {
      const onOpenChange = vi.fn();
      const instance = createInstance(disclosure, { props: { onOpenChange } });
      instance.api.setOpen(false);
      expect(onOpenChange).not.toHaveBeenCalled();
      instance.api.setOpen(true);
      instance.api.setOpen(true);
      expect(onOpenChange.mock.calls).toEqual([[true]]);
    });
  });

  describe('props', () => {
    it('falls back to defaults and reads the latest props', () => {
      const instance = createInstance(disclosure);
      expect(instance.getState().isDisabled).toBe(false);
      instance.setProps({ isDisabled: true });
      expect(instance.getState().isDisabled).toBe(true);
    });

    it('stores props silently and notifies on sync', () => {
      const instance = createInstance(disclosure);
      const listener = vi.fn();
      instance.subscribe(listener);

      instance.setProps({ isDisabled: true });
      expect(listener).not.toHaveBeenCalled();

      instance.sync();
      expect(listener).toHaveBeenCalledTimes(1);

      instance.sync();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('ignores new callback identities', () => {
      const instance = createInstance(disclosure, {
        props: { onToggle: () => undefined },
      });
      const listener = vi.fn();
      instance.subscribe(listener);
      instance.setProps({ onToggle: () => undefined });
      instance.sync();
      expect(listener).not.toHaveBeenCalled();
    });

    it('calls the latest event callback', () => {
      const first = vi.fn();
      const second = vi.fn();
      const instance = createInstance(disclosure, {
        props: { onToggle: first },
      });
      instance.setProps({ onToggle: second });
      click(instance);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith({ isOpen: true });
    });
  });

  describe('handlers', () => {
    it('run in a batch, so one action flushes once', () => {
      const instance = createInstance(disclosure);
      const listener = vi.fn();
      instance.subscribe(listener);

      click(instance);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(instance.getState()).toEqual({
        isOpen: true,
        isDisabled: false,
        toggles: 1,
      });
    });
  });

  describe('lifecycle', () => {
    it('runs effects between start and stop, idempotently', () => {
      const instance = createInstance(disclosure);
      const { log } = instance.api;

      instance.start();
      instance.start();
      instance.stop();
      instance.stop();
      instance.start();

      expect(log).toEqual(['start', 'stop', 'start']);
      expect(instance.isStarted()).toBe(true);
    });

    it('runs watchers after a flush, only while started', () => {
      const instance = createInstance(disclosure);
      const { log } = instance.api;

      instance.setProps({ isDisabled: true });
      instance.sync();
      expect(log).toEqual([]);

      instance.start();
      instance.setProps({ isDisabled: false });
      instance.sync();
      expect(log).toEqual(['start', 'disabled true → false']);

      instance.stop();
      instance.setProps({ isDisabled: true });
      instance.sync();
      instance.start();
      instance.setProps({ isDisabled: true, label: 'x' });
      instance.sync();
      expect(log).toEqual(['start', 'disabled true → false', 'stop', 'start']);
    });

    it('settles state changed by watchers before other listeners read it', () => {
      const def = defineComponent({
        name: 'settle',
        parts: ['root'],
        props: { isDisabled: prop(false) },
        setup(ctx) {
          const isPressed = ctx.state(true);
          ctx.watch(
            () => ctx.props.isDisabled(),
            (isDisabled) => {
              if (isDisabled) isPressed.set(false);
            },
          );
          return { isPressed: () => isPressed.get() };
        },
        expose: ({ api }) => ({ isPressed: api.isPressed() }),
        connect: () => ({ root: { attrs: {} } }),
      });
      const instance = createInstance(def);
      instance.start();
      const seen: boolean[] = [];
      instance.subscribe(() => seen.push(instance.getState().isPressed));

      instance.setProps({ isDisabled: true });
      instance.sync();

      // No listener ever sees the press the watcher cancelled.
      expect(seen.length).toBeGreaterThan(0);
      expect(seen).not.toContain(true);
    });
  });

  describe('memo', () => {
    it('recomputes only when a dependency changes', () => {
      const compute = vi.fn((label: string | undefined) => label?.length ?? 0);
      const def = defineComponent({
        name: 'memo',
        parts: ['root'],
        props: { label: prop<string | undefined>(undefined) },
        setup(ctx) {
          return { length: ctx.memo(() => [ctx.props.label()], compute) };
        },
        expose: ({ api }) => ({ length: api.length() }),
        connect: () => ({ root: { attrs: {} } }),
      });
      const instance = createInstance(def, { props: { label: 'ab' } });
      const { length } = instance.api;

      expect(length()).toBe(2);
      expect(length()).toBe(2);
      instance.setProps({ label: 'abc' });
      expect(length()).toBe(3);
      expect(compute).toHaveBeenCalledTimes(2);
    });
  });

  it('registers part elements', () => {
    const instance = createInstance(disclosure);
    const element = {};
    expect(instance.element('trigger')).toBeNull();
    instance.attach('trigger', element);
    expect(instance.element('trigger')).toBe(element);
    instance.attach('trigger', null);
    expect(instance.element('trigger')).toBeNull();
  });

  it('counts a new part element as a change while started', () => {
    const instance = createInstance(disclosure);
    const listener = vi.fn();
    instance.subscribe(listener);
    instance.attach('trigger', {});
    expect(listener).not.toHaveBeenCalled();

    instance.start();
    const element = {};
    instance.attach('trigger', element);
    expect(listener).toHaveBeenCalledTimes(1);
    instance.attach('trigger', element);
    expect(listener).toHaveBeenCalledTimes(1);
    instance.attach('trigger', null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

/** Composes the disclosure, as a component built on another would. */
const accordionItem = defineComponent({
  name: 'accordion-item',
  parts: ['heading', 'trigger', 'body'],
  props: {
    isExpanded: bindable(false),
    isDisabled: prop(false),
  },
  events: { toggle: event<{ isOpen: boolean }>() },
  setup(ctx) {
    const inner = ctx.use(
      disclosure,
      () => ({
        isOpen: ctx.props.isExpanded.get(),
        isDisabled: ctx.props.isDisabled(),
        onOpenChange: (isOpen) => ctx.props.isExpanded.set(isOpen),
        onToggle: (detail) => ctx.emit('toggle', detail),
      }),
      { parts: { panel: 'body' } },
    );
    return { inner };
  },
  expose({ api }) {
    return { ...api.inner.state(), isItem: true };
  },
  connect({ ids, api }) {
    const { trigger, panel } = api.inner.connect();
    return { heading: { attrs: { id: ids.heading } }, trigger, body: panel };
  },
});

describe('ctx.use', () => {
  const clickItem = (
    instance: ReturnType<typeof createInstance<typeof accordionItem>>,
  ) => instance.connect().trigger.on!.click!(undefined as never);

  it('composes state, parts and ids, mapping renamed parts', () => {
    const instance = createInstance(accordionItem, { id: 'item' });
    expect(instance.getState()).toEqual({
      isOpen: false,
      isDisabled: false,
      toggles: 0,
      isItem: true,
    });
    const { trigger, body } = instance.connect();
    expect(trigger.attrs['aria-controls']).toBe('item-body');
    expect(trigger.attrs['data-scope']).toBe('accordion-item');
    expect(body.attrs).toMatchObject({ id: 'item-body', hidden: '' });
  });

  it('reads props from the composing component on every access', () => {
    const instance = createInstance(accordionItem);
    instance.setProps({ isDisabled: true });
    clickItem(instance);
    expect(instance.getState().toggles).toBe(0);
    instance.setProps({ isDisabled: false });
    clickItem(instance);
    expect(instance.getState()).toMatchObject({ isOpen: true, toggles: 1 });
  });

  it('reports through the callbacks it was given, controlled or not', () => {
    const onToggle = vi.fn();
    const onExpandedChange = vi.fn();
    const instance = createInstance(accordionItem, {
      props: { onToggle, onExpandedChange },
    });
    clickItem(instance);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(onToggle).toHaveBeenCalledWith({ isOpen: true });
    expect(instance.getState().isOpen).toBe(true);

    instance.setProps({ isExpanded: false, onExpandedChange });
    clickItem(instance);
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);
    expect(instance.getState().isOpen).toBe(false);
  });

  it('shares the store, so composed changes notify and refresh parts', () => {
    const instance = createInstance(accordionItem);
    const listener = vi.fn();
    instance.subscribe(listener);
    const before = instance.connect();
    clickItem(instance);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(instance.connect()).not.toBe(before);
    expect(instance.connect().body.attrs.hidden).toBeUndefined();
  });

  it('runs composed watchers and effects with the instance lifecycle', () => {
    const instance = createInstance(accordionItem);
    const log = instance.api.inner.api.log;
    instance.start();
    instance.setProps({ isDisabled: true });
    instance.sync();
    instance.stop();
    expect(log).toEqual(['start', 'disabled false → true', 'stop']);
  });

  it('looks up composed parts on the elements they render on', () => {
    const seen: unknown[] = [];
    const probe = defineComponent({
      name: 'probe',
      parts: ['panel'],
      props: {},
      setup(ctx) {
        return { element: () => ctx.element('panel'), ids: ctx.ids };
      },
      expose: () => ({}),
      connect: () => ({ panel: { attrs: {} } }),
    });
    const host = defineComponent({
      name: 'host',
      parts: ['body'],
      props: {},
      setup(ctx) {
        return ctx.use(probe, () => ({}), { parts: { panel: 'body' } });
      },
      expose: () => ({}),
      connect: () => ({ body: { attrs: {} } }),
    });
    const instance = createInstance(host, { id: 'h' });
    const element = {};
    instance.attach('body', element);
    seen.push(instance.api.api.element(), instance.api.api.ids.panel);
    expect(seen).toEqual([element, 'h-body']);
  });

  it('leaves out a composed part mapped to null', () => {
    const probe = defineComponent({
      name: 'probe',
      parts: ['panel', 'note'],
      props: {},
      setup(ctx) {
        return { element: () => ctx.element('note'), ids: ctx.ids };
      },
      expose: () => ({}),
      connect: () => ({ panel: { attrs: {} }, note: { attrs: {} } }),
    });
    const host = defineComponent({
      name: 'host',
      parts: ['body'],
      props: {},
      setup(ctx) {
        return ctx.use(probe, () => ({}), {
          parts: { panel: 'body', note: null },
        });
      },
      expose: () => ({}),
      connect: () => ({ body: { attrs: {} } }),
    });
    const instance = createInstance(host, { id: 'h' });
    instance.attach('body', {});
    expect(instance.api.api.element()).toBeNull();
    expect(instance.api.api.ids).toEqual({
      panel: 'h-body',
      note: 'h-probe-note',
    });
  });

  it('refuses a composed part with nothing to render on', () => {
    const host = defineComponent({
      name: 'host',
      parts: ['trigger'],
      props: {},
      setup(ctx) {
        return ctx.use(disclosure, () => ({}));
      },
      expose: () => ({}),
      connect: () => ({ trigger: { attrs: {} } }),
    });
    expect(() => createInstance(host)).toThrow(
      'host composes disclosure, whose "panel" part has no "panel" part to render on.',
    );
  });
});

describe('owner', () => {
  const group = defineComponent({
    name: 'group',
    parts: ['root'],
    props: { value: bindable<string[]>([]) },
    setup(ctx) {
      const add = (item: string) =>
        ctx.props.value.set([...ctx.props.value.get(), item]);
      return { add };
    },
    expose: ({ props }) => ({ value: props.value.get() }),
    connect: () => ({ root: { attrs: {} } }),
  });
  const item = defineComponent({
    name: 'item',
    parts: ['root'],
    props: { value: prop('') },
    owner: { definition: group, attribute: 'group' },
    setup(ctx) {
      const owned = () => ctx.owner(group);
      const isSelected = () =>
        owned()?.state().value.includes(ctx.props.value()) ?? false;
      return { owned, isSelected };
    },
    expose: ({ api }) => ({ isSelected: api.isSelected() }),
    connect: ({ api }) => ({
      root: { attrs: { 'data-selected': api.isSelected() ? '' : undefined } },
    }),
  });

  it('marks the owner definition', () => {
    expect(isOwnerDefinition(group)).toBe(true);
    expect(isOwnerDefinition(item)).toBe(false);
  });

  it('types the owner prop and the handle', () => {
    const owner = createInstance(group);
    expectTypeOf(owner).toMatchTypeOf<
      NonNullable<PropsOf<typeof item>['owner']>
    >();
    expectTypeOf<PropsOf<typeof group>>().not.toHaveProperty('owner');
  });

  it('reads nothing until linked, then the owner', () => {
    const owner = createInstance(group, { props: { defaultValue: ['a'] } });
    const child = createInstance(item, { props: { value: 'a' } });
    expect(child.api.owned()).toBeUndefined();
    expect(child.getState().isSelected).toBe(false);

    child.link(owner);
    child.sync();
    expect(child.owner()).toBe(owner);
    expect(child.api.owned()?.instance).toBe(owner);
    expect(child.api.owned()).toBe(child.api.owned());
    expect(child.getState().isSelected).toBe(true);
  });

  it('follows the owner while started, and stops with the instance', () => {
    const owner = createInstance(group);
    const child = createInstance(item, { props: { value: 'b' } });
    child.link(owner);
    child.sync();
    child.start();
    const listener = vi.fn();
    child.subscribe(listener);

    owner.api.add('b');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(child.connect().root.attrs['data-selected']).toBe('');

    child.stop();
    owner.api.add('c');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('prefers the owner prop to the link, and unlinks', () => {
    const linked = createInstance(group);
    const explicit = createInstance(group, { props: { defaultValue: ['a'] } });
    const child = createInstance(item, { props: { value: 'a' } });
    child.start();
    child.link(linked);
    child.sync();
    expect(child.getState().isSelected).toBe(false);

    child.setProps({ value: 'a', owner: explicit });
    child.sync();
    expect(child.owner()).toBe(explicit);
    expect(child.getState().isSelected).toBe(true);
    const listener = vi.fn();
    child.subscribe(listener);
    linked.api.add('x');
    expect(listener).not.toHaveBeenCalled();
    explicit.api.add('y');
    expect(listener).toHaveBeenCalledTimes(1);

    child.setProps({ value: 'a' });
    child.link(undefined);
    child.sync();
    expect(child.owner()).toBeUndefined();
    expect(child.getState().isSelected).toBe(false);
  });

  it('returns nothing for another definition', () => {
    const other = defineComponent({
      name: 'other',
      parts: ['root'],
      props: {},
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    const child = createInstance(item);
    child.link(createInstance(other) as never);
    expect(child.api.owned()).toBeUndefined();
  });
});

describe('links', () => {
  interface HintApi {
    text(): string;
    setText(text: string): void;
  }
  const hintLink: LinkKey<'hint', HintApi> = { name: 'hint' };
  const hint = defineComponent({
    name: 'hint',
    parts: ['root'],
    props: { text: prop('') },
    provides: [hintLink],
    setup(ctx): HintApi {
      const override = ctx.state<string | undefined>(undefined);
      return {
        text: () => override.get() ?? ctx.props.text(),
        setText: override.set,
      };
    },
    expose: () => ({}),
    connect: () => ({ root: { attrs: {} } }),
  });
  const button = defineComponent({
    name: 'button',
    parts: ['root'],
    props: {},
    links: [hintLink],
    setup(ctx) {
      const linked = () => ctx.link(hintLink);
      return { linked, text: () => linked()?.api.text() };
    },
    expose: ({ api }) => ({ text: api.text() }),
    connect: ({ api }) => ({
      root: { attrs: { title: api.text() } },
    }),
  });

  it('marks a definition that provides a link, and reserves the prop', () => {
    expect(isOwnerDefinition(hint)).toBe(true);
    expect(isOwnerDefinition(button)).toBe(false);
    expect(() =>
      defineComponent({
        name: 'clash',
        parts: ['root'],
        props: { hint: prop('') },
        links: [hintLink],
        setup: () => ({}),
        expose: () => ({}),
        connect: () => ({ root: { attrs: {} } }),
      }),
    ).toThrow(/"hint" is defined twice/);
  });

  it('types the link prop and the handle', () => {
    expectTypeOf(createInstance(hint)).toMatchTypeOf<
      NonNullable<PropsOf<typeof button>['hint']>
    >();
    expectTypeOf<PropsOf<typeof hint>>().not.toHaveProperty('hint');
    const child = createInstance(button);
    expectTypeOf(child.api.linked()?.api).toEqualTypeOf<HintApi | undefined>();
  });

  it('reads the link prop, else the adapter’s link, and follows it while started', () => {
    const linked = createInstance(hint, { props: { text: 'Linked' } });
    const explicit = createInstance(hint, { props: { text: 'Explicit' } });
    const child = createInstance(button);
    expect(child.getState().text).toBeUndefined();

    child.link(linked, hintLink);
    child.sync();
    child.start();
    expect(child.linked(hintLink)).toBe(linked);
    expect(child.owner()).toBeUndefined();
    expect(child.connect().root.attrs.title).toBe('Linked');
    const listener = vi.fn();
    child.subscribe(listener);
    linked.api.setText('Changed');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(child.getState().text).toBe('Changed');

    child.setProps({ hint: explicit });
    child.sync();
    expect(child.api.linked()?.instance).toBe(explicit);
    linked.api.setText('Ignored');
    expect(listener).toHaveBeenCalledTimes(2);
    explicit.api.setText('Followed');
    expect(listener).toHaveBeenCalledTimes(3);

    child.setProps({});
    child.link(undefined, hintLink);
    child.sync();
    expect(child.api.linked()).toBeUndefined();
    child.stop();
  });

  it('returns nothing for an instance that doesn’t provide the link', () => {
    const child = createInstance(button);
    child.setProps({ hint: createInstance(button) });
    child.sync();
    expect(child.api.linked()).toBeUndefined();
  });
});

/** Rows keyed by item, one active, as a listbox's options are. */
const rows = defineComponent({
  name: 'rows',
  parts: ['root'],
  itemParts: ['row', 'rowLabel'],
  props: { tone: prop('plain') },
  setup(ctx) {
    const active = ctx.state<string | null>(null);
    const computed: string[] = [];
    const activate = (key: string) => {
      const previous = active.get();
      active.set(key);
      ctx.invalidateItems(previous === null ? [key] : [previous, key]);
    };
    return {
      active: () => active.get(),
      activate,
      refresh: (keys?: string[]) => ctx.invalidateItems(keys),
      computed,
      label: (key: string) => ctx.itemElement('rowLabel', key),
    };
  },
  expose: ({ api }) => ({ active: api.active() }),
  connect: ({ ids }) => ({ root: { attrs: { id: ids.root } } }),
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

describe('item parts', () => {
  it('types item parts, and refuses item parts without connectItem or named twice', () => {
    expectTypeOf<ItemPartOf<typeof rows>>().toEqualTypeOf<'row' | 'rowLabel'>();
    expectTypeOf<ItemPartOf<typeof disclosure>>().toEqualTypeOf<never>();
    const base = {
      name: 'broken',
      parts: ['root'],
      props: {},
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    } as const;
    expect(() => defineComponent({ ...base, itemParts: ['row'] })).toThrow(
      'item parts need connectItem()',
    );
    expect(() =>
      defineComponent({
        ...base,
        itemParts: ['root'],
        connectItem: () => ({ attrs: {} }),
      }),
    ).toThrow('"root" is both a part and an item part');
  });

  it('makes item ids that never collide or hold whitespace', () => {
    expect(itemId('list', 'option', 'apple')).toBe('list-option-apple');
    expect(itemId('list', 'option', 'a b')).toBe('list-option-a%20b');
    expect(itemId('list', 'option', 'a%20b')).toBe('list-option-a%2520b');
  });

  it('connects an item part with data-scope and data-part, cached per part and key', () => {
    const instance = createInstance(rows);
    const row = instance.connectItem('row', 'a');
    expect(row.attrs).toMatchObject({
      'data-scope': 'rows',
      'data-part': 'row',
      'data-tone': 'plain',
    });
    expect(instance.connectItem('row', 'a')).toBe(row);
    expect(instance.connectItem('row', 'b')).not.toBe(row);
    expect(instance.api.computed).toEqual(['row:a', 'row:b']);
  });

  it('recomputes only the keys a definition invalidates', () => {
    const instance = createInstance(rows);
    const a = instance.connectItem('row', 'a');
    const b = instance.connectItem('row', 'b');
    const c = instance.connectItem('row', 'c');
    instance.api.computed.length = 0;

    a.on!.click!(undefined as never);
    expect(instance.connectItem('row', 'a')).not.toBe(a);
    expect(instance.connectItem('row', 'a').attrs['data-active']).toBe('');
    expect(instance.connectItem('row', 'b')).toBe(b);
    instance.connectItem('row', 'b').on!.click!(undefined as never);
    expect(instance.connectItem('row', 'a').attrs['data-active']).toBe(
      undefined,
    );
    expect(instance.connectItem('row', 'b').attrs['data-active']).toBe('');
    expect(instance.connectItem('row', 'c')).toBe(c);
    expect(instance.api.computed).toEqual(['row:a', 'row:a', 'row:b']);
  });

  it('recomputes every item when props change', () => {
    const instance = createInstance(rows, { props: { tone: 'plain' } });
    const a = instance.connectItem('row', 'a');
    instance.setProps({ tone: 'plain' });
    expect(instance.connectItem('row', 'a')).toBe(a);
    instance.setProps({ tone: 'loud' });
    expect(instance.connectItem('row', 'a').attrs['data-tone']).toBe('loud');
  });

  it('reports invalidated keys, and flushes without changing state', () => {
    const instance = createInstance(rows);
    const reported: (readonly string[] | null)[] = [];
    instance.subscribeItems((keys) => reported.push(keys));
    const listener = vi.fn();
    instance.subscribe(listener);
    const state = instance.getState();
    const connected = instance.connect();

    instance.start();
    instance.api.refresh(['a', 'b']);
    expect(reported).toEqual([['a', 'b']]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(instance.getState()).toBe(state);
    expect(instance.connect()).toBe(connected);
    instance.api.refresh([]);
    expect(listener).toHaveBeenCalledTimes(1);
    instance.api.refresh();
    expect(reported).toEqual([['a', 'b'], null]);

    instance.setProps({ tone: 'loud' });
    expect(reported.at(-1)).toBeNull();
    expect(reported).toHaveLength(3);
    instance.stop();
  });

  it('registers item elements, and rewrites the key an item part attaches to', () => {
    const instance = createInstance(rows);
    const reported: (readonly string[] | null)[] = [];
    instance.subscribeItems((keys) => reported.push(keys));
    const row = instance.connectItem('row', 'a');
    expect(row.attrs['aria-labelledby']).toBeUndefined();

    const label = {};
    instance.attachItem('rowLabel', 'a', label);
    expect(instance.itemElement('rowLabel', 'a')).toBe(label);
    expect(instance.itemElement('rowLabel', 'b')).toBeNull();
    expect(reported).toEqual([['a']]);
    expect(instance.connectItem('row', 'a').attrs['aria-labelledby']).toBe(
      'r-rowLabel-a',
    );

    instance.attachItem('rowLabel', 'a', label);
    expect(reported).toHaveLength(1);
    instance.attachItem('rowLabel', 'a', null);
    expect(instance.itemElement('rowLabel', 'a')).toBeNull();
    expect(instance.connectItem('row', 'a').attrs['aria-labelledby']).toBe(
      undefined,
    );
  });

  it('notifies for an attached item element only while started', () => {
    const instance = createInstance(rows);
    const listener = vi.fn();
    instance.subscribe(listener);
    instance.attachItem('row', 'a', {});
    expect(listener).not.toHaveBeenCalled();
    instance.start();
    instance.attachItem('row', 'b', {});
    expect(listener).toHaveBeenCalledTimes(1);
    instance.stop();
  });

  it('re-runs connect() and expose() when an item element attaches or detaches while started', () => {
    const instance = createInstance(rows);
    instance.start();
    const connected = instance.connect();
    const state = instance.getState();
    instance.attachItem('row', 'a', {});
    const attached = instance.connect();
    expect(attached).not.toBe(connected);
    expect(instance.getState()).not.toBe(state);
    instance.attachItem('row', 'a', null);
    expect(instance.connect()).not.toBe(attached);
    instance.stop();
  });

  it('runs item effects for each element as it attaches, and cleans up as it detaches or the instance stops', () => {
    const log: string[] = [];
    const tracked = defineComponent({
      name: 'tracked',
      parts: ['root'],
      itemParts: ['row'],
      props: {},
      setup(ctx) {
        ctx.itemEffect('row', (key, element) => {
          log.push(`on ${key} ${String(element)}`);
          return () => log.push(`off ${key} ${String(element)}`);
        });
        return {};
      },
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
      connectItem: () => ({ attrs: {} }),
    });
    const instance = createInstance(tracked);
    instance.attachItem('row', 'a', 'A');
    expect(log).toEqual([]);
    instance.start();
    expect(log).toEqual(['on a A']);
    instance.attachItem('row', 'b', 'B');
    instance.attachItem('row', 'a', 'A2');
    instance.attachItem('row', 'b', null);
    expect(log).toEqual(['on a A', 'on b B', 'off a A', 'on a A2', 'off b B']);
    log.length = 0;
    instance.stop();
    expect(log).toEqual(['off a A2']);
    instance.attachItem('row', 'c', 'C');
    expect(log).toEqual(['off a A2']);
  });

  it('drops a key’s cached props once no part renders it', () => {
    const instance = createInstance(rows);
    instance.attachItem('row', 'a', {});
    const row = instance.connectItem('row', 'a');
    expect(instance.connectItem('row', 'a')).toBe(row);
    instance.attachItem('row', 'a', null);
    instance.api.computed.length = 0;
    instance.connectItem('row', 'a');
    expect(instance.api.computed).toEqual(['row:a']);
  });

  it('forwards connectItem through ctx.use', () => {
    const outer = defineComponent({
      name: 'outer',
      parts: ['root'],
      itemParts: ['row', 'rowLabel'],
      props: {},
      setup: (ctx) => ({ inner: ctx.use(rows, () => ({ tone: 'quiet' })) }),
      expose: () => ({}),
      connect: ({ api }) => api.inner.connect(),
      connectItem: ({ api }, part, key) => api.inner.connectItem(part, key),
    });
    const instance = createInstance(outer);
    expect(instance.connectItem('row', 'a').attrs).toMatchObject({
      'data-scope': 'outer',
      'data-tone': 'quiet',
    });
  });
});
