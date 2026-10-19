import { defineComponent, itemId, prop } from '@uniaria/core';
import { button } from '@uniaria/core/button';
import { field } from '@uniaria/core/field';
import type { ButtonProps } from '@uniaria/core/button';
import { toggleButton } from '@uniaria/core/toggle-button';
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import { StrictMode, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { ComponentHandle } from './use-component';
import { useComponent, useComponentState } from './use-component';

let root: Root | undefined;
let container: HTMLElement | undefined;

function render(node: ReactNode): HTMLElement {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  rerender(node);
  return container;
}

function rerender(node: ReactNode): void {
  flushSync(() => root!.render(<StrictMode>{node}</StrictMode>));
}

/** Renders without StrictMode, to count renders exactly. */
function renderPlain(node: ReactNode): HTMLElement {
  if (!root) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }
  flushSync(() => root!.render(node));
  return container!;
}

afterEach(async () => {
  await releaseInput();
  root?.unmount();
  root = undefined;
  container?.remove();
  container = undefined;
  document.body.replaceChildren();
});

function Save(props: ButtonProps & { readonly onRender?: () => void }) {
  const { onRender, ...rest } = props;
  onRender?.();
  const ui = useComponent(button, rest);
  return <button {...ui.parts.root}>Save</button>;
}

function Docs() {
  const ui = useComponent(button, { href: '/docs' });
  return <a {...ui.parts.root}>Docs</a>;
}

describe('useComponent', () => {
  it('renders part props for the first paint', () => {
    const element = render(<Save isDisabled />).querySelector('button')!;
    expect(element.className).toBe('uni-button');
    expect(element.hasAttribute('data-scope')).toBe(false);
    expect(element.hasAttribute('data-element')).toBe(false);
    expect(element.getAttribute('type')).toBe('button');
    expect(element.disabled).toBe(true);
    expect(element.hasAttribute('data-disabled')).toBe(true);
  });

  it('puts uni-<name> in the root className, which a consumer class merges with', () => {
    const warn = vi.spyOn(console, 'warn');
    const classNames: (string | undefined)[] = [];
    function Primary() {
      const ui = useComponent(button, {});
      classNames.push(ui.parts.root.className);
      return (
        <button
          {...ui.parts.root}
          className={`${ui.parts.root.className} mine`}
        >
          Save
        </button>
      );
    }
    const element = render(<Primary />).querySelector('button')!;
    expect(classNames.at(-1)).toBe('uni-button');
    expect(element.className).toBe('uni-button mine');
    // The binder never writes `class`, so state changes leave it as React
    // rendered it.
    element.focus();
    expect(element.hasAttribute('data-focused')).toBe(true);
    expect(element.className).toBe('uni-button mine');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('marks other parts with data-scope and data-element, and no class', () => {
    let label: Record<string, unknown> = {};
    function Name() {
      const ui = useComponent(field, {});
      label = ui.parts.label;
      return (
        <div {...ui.parts.root}>
          <label {...ui.parts.label}>Name</label>
          <input {...ui.parts.control} />
        </div>
      );
    }
    const element = render(<Name />);
    expect(label.className).toBeUndefined();
    const control = element.querySelector('input')!;
    expect(control.getAttribute('data-scope')).toBe('field');
    expect(control.getAttribute('data-element')).toBe('Control');
    expect(control.hasAttribute('class')).toBe(false);
    expect(element.querySelector('label')!.getAttribute('data-element')).toBe(
      'Label',
    );
    expect(element.querySelector('.uni-field')).toBe(element.firstChild);
  });

  it('keeps handler identity across renders', () => {
    const seen: ComponentHandle<typeof button>['parts']['root'][] = [];
    function Probe({ label }: { readonly label: string }) {
      const ui = useComponent(button, {});
      // Committed renders only: StrictMode throws away its first mount render.
      useLayoutEffect(() => {
        seen.push(ui.parts.root);
      });
      return <button {...ui.parts.root}>{label}</button>;
    }
    const element = render(<Probe label="a" />);
    rerender(<Probe label="b" />);
    expect(element.textContent).toBe('b');
    const first = seen[0]!;
    const last = seen.at(-1)!;
    expect(last.onKeyDown).toBe(first.onKeyDown);
    expect(last.onClick).toBe(first.onClick);
    expect(last.ref).toBe(first.ref);
  });

  it('keeps attributes the binder wrote when the parent re-renders', async () => {
    let setCount: (count: number) => void = () => undefined;
    function Parent() {
      const [count, set] = useState(0);
      setCount = set;
      return (
        <>
          <Save />
          <span>{count}</span>
        </>
      );
    }
    const element = render(<Parent />).querySelector('button')!;
    element.focus();
    expect(element.hasAttribute('data-focused')).toBe(true);

    flushSync(() => setCount(1));
    expect(element.hasAttribute('data-focused')).toBe(true);
  });

  it('attaches one set of listeners under StrictMode', async () => {
    const onPress = vi.fn();
    const element = render(<Save onPress={onPress} />).querySelector('button')!;
    element.focus();
    await keyboard.press('Enter');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls the latest callbacks without re-rendering for state', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const onRender = vi.fn();
    const element = render(
      <Save onPress={first} onRender={onRender} />,
    ).querySelector('button')!;
    rerender(<Save onPress={second} onRender={onRender} />);
    const renders = onRender.mock.calls.length;

    element.focus();
    await keyboard.press('Enter');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenCalledTimes(renders);
  });

  it('types inline callbacks from the definition', async () => {
    const seen: boolean[] = [];
    function Mute() {
      // Only the definition infers the props type, so the parameter is typed.
      const ui = useComponent(toggleButton, {
        onSelectedChange: (isSelected) => {
          expectTypeOf(isSelected).toEqualTypeOf<boolean>();
          seen.push(isSelected);
        },
      });
      return <button {...ui.parts.root}>Mute</button>;
    }
    render(<Mute />)
      .querySelector('button')!
      .focus();
    await keyboard.press('Enter');

    expect(seen).toEqual([true]);
  });

  it("returns the public actions, never setup()'s internal API", () => {
    const panel = defineComponent({
      name: 'test-panel',
      parts: ['root'],
      props: { label: prop('') },
      actions: ['show'],
      setup: () => {
        let count = 0;
        return { show: () => ++count, internal: () => count };
      },
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    let handle: ComponentHandle<typeof panel> | undefined;
    function Panel() {
      handle = useComponent(panel, {});
      return <div {...handle.parts.root} />;
    }
    render(<Panel />);
    expect(Object.keys(handle!.actions)).toEqual(['show']);
    expect(handle!.actions.show()).toBe(1);
    expect('api' in handle!).toBe(false);
    expectTypeOf(handle!.actions).toEqualTypeOf<{ show: () => number }>();
  });
});

describe('development warnings', () => {
  it('warns when the consumer writes an attribute UniAria owns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function Override() {
      const ui = useComponent(button, {});
      return (
        <button {...ui.parts.root} type="submit" data-pressed="">
          Save
        </button>
      );
    }
    render(<Override />);
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(messages.some((message) => message.includes('"type"'))).toBe(true);
    expect(messages.some((message) => message.includes('"data-pressed"'))).toBe(
      true,
    );
  });

  it('warns when the rendered root lacks its uni-<name> class', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function Replaced() {
      const ui = useComponent(button, {});
      return (
        <button {...ui.parts.root} className="mine">
          Save
        </button>
      );
    }
    const element = render(<Replaced />).querySelector('button')!;
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(element.className).toBe('mine');
    expect(
      messages.filter((message) => message.includes('"uni-button" class')),
    ).toHaveLength(1);
    expect(
      messages.some((message) => message.includes('parts.root.className')),
    ).toBe(true);
  });

  it('warns when the root tag and elementType differ', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function Wrong() {
      const ui = useComponent(button, {});
      return <span {...ui.parts.root}>Save</span>;
    }
    render(<Wrong />);
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(
      messages.some((message) => message.includes('elementType="span"')),
    ).toBe(true);
  });

  it('stays quiet for correct markup', () => {
    const warn = vi.spyOn(console, 'warn');
    render(<Save />);
    render(<Docs />);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  // Field links its label only once it has started; StrictMode then
  // attaches the same elements again.
  it('stays quiet when StrictMode attaches an element UniAria wrote to', () => {
    const warn = vi.spyOn(console, 'warn');
    function Name() {
      const ui = useComponent(field, {});
      return (
        <>
          <label {...ui.parts.label}>Name</label>
          <input {...ui.parts.control} />
        </>
      );
    }
    const rendered = render(<Name />);
    expect(
      rendered.querySelector('input')!.hasAttribute('aria-labelledby'),
    ).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('useComponentState', () => {
  it('re-renders only when the selected value changes', async () => {
    const renders: boolean[] = [];
    function Selecting() {
      const ui = useComponent(button, {});
      const isPressed = useComponentState(ui, (state) => state.isPressed);
      renders.push(isPressed);
      return <button {...ui.parts.root}>{isPressed ? 'Down' : 'Up'}</button>;
    }
    const element = render(<Selecting />).querySelector('button')!;
    renders.length = 0;

    element.focus();
    element.blur();
    expect(renders).toEqual([]);

    element.focus();
    await keyboard.down('Enter');
    expect(element.textContent).toBe('Down');
    await keyboard.up('Enter');
    expect(element.textContent).toBe('Up');
    // StrictMode renders twice per update.
    expect(renders).toEqual([true, true, false, false]);
  });

  it('renders once for a prop change the selected state shows', () => {
    const states: boolean[] = [];
    function Selecting({ isDisabled }: { readonly isDisabled: boolean }) {
      const ui = useComponent(button, { isDisabled });
      states.push(useComponentState(ui, (state) => state.isDisabled));
      return <button {...ui.parts.root}>Save</button>;
    }
    renderPlain(<Selecting isDisabled={false} />);
    renderPlain(<Selecting isDisabled={true} />);
    renderPlain(<Selecting isDisabled={false} />);
    expect(states).toEqual([false, true, false]);
  });

  it('re-renders for a change the prop sync makes', async () => {
    const states: { isDisabled: boolean; isHovered: boolean }[] = [];
    function Selecting({ isDisabled }: { readonly isDisabled: boolean }) {
      const ui = useComponent(button, { isDisabled });
      const state = useComponentState(ui, (current) => current);
      states.push({ isDisabled: state.isDisabled, isHovered: state.isHovered });
      return <button {...ui.parts.root}>Save</button>;
    }
    await pointer.move(
      renderPlain(<Selecting isDisabled={false} />).querySelector('button')!,
    );
    await expect.poll(() => states.at(-1)?.isHovered).toBe(true);
    states.length = 0;

    // Disabling ends hover during the sync: one render for the prop, one for
    // the hover it ended.
    renderPlain(<Selecting isDisabled={true} />);
    expect(states).toEqual([
      { isDisabled: true, isHovered: true },
      { isDisabled: true, isHovered: false },
    ]);
  });

  it('accepts an equality function', async () => {
    const renders = vi.fn();
    function Selecting() {
      const ui = useComponent(button, {});
      const state = useComponentState(
        ui.instance,
        (current) => ({ pressed: current.isPressed }),
        (a, b) => a.pressed === b.pressed,
      );
      renders(state.pressed);
      return <button {...ui.parts.root}>Save</button>;
    }
    const element = render(<Selecting />).querySelector('button')!;
    renders.mockClear();

    element.focus();
    element.blur();
    expect(renders).not.toHaveBeenCalled();
  });
});

describe('server rendering', () => {
  it('hydrates server HTML without mismatches', async () => {
    const html = renderToString(<Save shouldExcludeFromTabOrder />);
    container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const element = container.querySelector('button')!;
    expect(element.getAttribute('tabindex')).toBe('-1');

    const errors = vi.spyOn(console, 'error');
    const onRecoverableError = vi.fn();
    const onPress = vi.fn();
    flushSync(() => {
      root = hydrateRoot(
        container!,
        <Save shouldExcludeFromTabOrder onPress={onPress} />,
        {
          onRecoverableError,
        },
      );
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector('button')).toBe(element);
    errors.mockRestore();

    element.focus();
    await keyboard.press('Enter');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

const live = defineComponent({
  name: 'live',
  parts: ['input'],
  props: { text: prop('') },
  setup: () => ({}),
  expose: () => ({}),
  connect: ({ props }) => ({
    input: { attrs: {}, properties: { value: props.text() } },
  }),
});

function Live({ text }: { readonly text: string }) {
  const ui = useComponent(live, { text });
  return <input {...ui.parts.input} />;
}

describe('live DOM properties', () => {
  it('renders a value once as defaultValue, and the binder sets later ones', () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const container = render(<Live text="first" />);
    const input = container.querySelector('input')!;
    expect(input.value).toBe('first');
    expect(input.getAttribute('value')).toBe('first');

    rerender(<Live text="second" />);
    expect(input.value).toBe('second');
    // React never controls the input: the default stays the first value.
    expect(input.getAttribute('value')).toBe('first');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('puts the starting value in server HTML', () => {
    expect(renderToString(<Live text="jane" />)).toContain('value="jane"');
  });
});

/** Rows keyed by item, one active, as a listbox's options are. */
const rows = defineComponent({
  name: 'rows',
  parts: ['list'],
  itemParts: ['row', 'rowLabel'],
  props: { tone: prop('plain') },
  setup(ctx) {
    const active = ctx.state<string | null>(null);
    return {
      active: () => active.get(),
      label: (key: string) => ctx.itemElement('rowLabel', key),
      activate(key: string) {
        const previous = active.get();
        active.set(key);
        ctx.invalidateItems(previous === null ? [key] : [previous, key]);
      },
    };
  },
  expose: ({ api }) => ({ active: api.active() }),
  connect: () => ({ list: { attrs: { role: 'listbox' } } }),
  connectItem({ props, api }, part, key) {
    if (part === 'rowLabel') return { attrs: { id: itemId('r', part, key) } };
    return {
      attrs: {
        role: 'option',
        'aria-selected': String(api.active() === key),
        'data-tone': props.tone(),
        'aria-labelledby': api.label(key)
          ? itemId('r', 'rowLabel', key)
          : undefined,
      },
      on: { click: () => api.activate(key) },
    };
  },
});

function Rows({
  keys = ['a', 'b', 'c'],
  tone,
  onRender,
  onHandle,
}: {
  readonly keys?: readonly string[];
  readonly tone?: string;
  readonly onRender?: () => void;
  readonly onHandle?: (handle: ComponentHandle<typeof rows>) => void;
}) {
  onRender?.();
  const ui = useComponent(rows, tone === undefined ? {} : { tone });
  onHandle?.(ui);
  return (
    <div {...ui.parts.list}>
      {keys.map((key) => (
        <div key={key} {...ui.getItemProps('row', key)}>
          <span {...ui.getItemProps('rowLabel', key)}>{key}</span>
        </div>
      ))}
    </div>
  );
}

describe('item parts', () => {
  const row = (element: HTMLElement, key: string) =>
    element.querySelector<HTMLElement>(
      `[data-element="Row"]:nth-child(${['a', 'b', 'c'].indexOf(key) + 1})`,
    )!;

  it('renders item props, and links item parts once they attach', () => {
    const warn = vi.spyOn(console, 'warn');
    const element = render(<Rows />);
    expect(row(element, 'a').getAttribute('data-scope')).toBe('rows');
    expect(row(element, 'a').querySelector('span')!.dataset.element).toBe(
      'RowLabel',
    );
    expect(row(element, 'a').getAttribute('aria-selected')).toBe('false');
    expect(row(element, 'b').getAttribute('aria-labelledby')).toBe(
      'r-rowLabel-b',
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renders item props on the server', () => {
    const html = renderToString(<Rows keys={['a']} />);
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('id="r-rowLabel-a"');
    expect(html).not.toContain('aria-labelledby');
  });

  it('finds the key from the element, with one handler per part and event', async () => {
    const handles: ComponentHandle<typeof rows>[] = [];
    const element = render(<Rows onHandle={(ui) => handles.push(ui)} />);
    const handle = handles.at(-1)!;
    expect(handle.getItemProps('row', 'a').onClick).toBe(
      handle.getItemProps('row', 'b').onClick,
    );
    row(element, 'b').click();
    expect(handle.instance.getState().active).toBe('b');
    expect(row(element, 'b').getAttribute('aria-selected')).toBe('true');
  });

  it('changes items through the binder without rendering again', () => {
    const onRender = vi.fn();
    const element = renderPlain(<Rows onRender={onRender} />);
    expect(onRender).toHaveBeenCalledTimes(1);
    row(element, 'a').click();
    row(element, 'c').click();
    expect(row(element, 'a').getAttribute('aria-selected')).toBe('false');
    expect(row(element, 'c').getAttribute('aria-selected')).toBe('true');
    expect(onRender).toHaveBeenCalledTimes(1);

    renderPlain(<Rows onRender={onRender} tone="loud" />);
    expect(row(element, 'a').getAttribute('data-tone')).toBe('loud');
    expect(row(element, 'c').getAttribute('aria-selected')).toBe('true');
  });

  it('hands the binder the rows a commit of their own attaches, in one flush', async () => {
    let setKeys: (keys: readonly string[]) => void = () => undefined;
    let handle: ComponentHandle<typeof rows> | undefined;
    function RowList({ ui }: { readonly ui: ComponentHandle<typeof rows> }) {
      const [keys, set] = useState<readonly string[]>(['a']);
      setKeys = set;
      return keys.map((key) => (
        <div key={key} {...ui.getItemProps('row', key)}>
          {key}
        </div>
      ));
    }
    function Owner() {
      const ui = useComponent(rows, {});
      handle = ui;
      return (
        <div {...ui.parts.list}>
          <RowList ui={ui} />
        </div>
      );
    }
    render(<Owner />);
    const { instance } = handle!;
    const listener = vi.fn();
    instance.subscribe(listener);
    flushSync(() => setKeys(['b', 'c', 'd', 'e']));
    expect(listener).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(instance.itemElement('row', 'a')).toBeNull();
    expect(instance.itemElement('row', 'e')).not.toBeNull();
  });

  it('detaches an item that unmounts', () => {
    const handles: ComponentHandle<typeof rows>[] = [];
    render(<Rows onHandle={(ui) => handles.push(ui)} />);
    const { instance } = handles.at(-1)!;
    expect(instance.itemElement('row', 'c')).not.toBeNull();
    rerender(<Rows keys={['a', 'b']} onHandle={(ui) => handles.push(ui)} />);
    expect(instance.itemElement('row', 'c')).toBeNull();
    expect(instance.itemElement('rowLabel', 'c')).toBeNull();
    expect(instance.itemElement('row', 'b')).not.toBeNull();
  });
});
