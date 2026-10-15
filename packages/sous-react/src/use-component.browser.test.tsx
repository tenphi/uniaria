import { button } from '@tenphi/sous/button';
import type { ButtonProps } from '@tenphi/sous/button';
import { keyboard, pointer, releaseInput } from '@tenphi/sous-testing/browser';
import { StrictMode, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    expect(element.getAttribute('data-scope')).toBe('button');
    expect(element.getAttribute('data-part')).toBe('root');
    expect(element.getAttribute('type')).toBe('button');
    expect(element.disabled).toBe(true);
    expect(element.hasAttribute('data-disabled')).toBe(true);
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
});

describe('development warnings', () => {
  it('warns when the consumer writes an attribute Sous owns', () => {
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
