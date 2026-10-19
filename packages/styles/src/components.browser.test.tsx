/**
 * Button and Checkbox with the default styles, mounted through both
 * adapters with the same markup (spec: Testing → Components).
 */

import '@uniaria/elements/button';
import '@uniaria/elements/checkbox';

import { button } from '@uniaria/core/button';
import { checkbox } from '@uniaria/core/checkbox';
import { useComponent } from '@uniaria/react';
import {
  emulateMedia,
  keyboard,
  pointer,
  releaseInput,
} from '@uniaria/testing/browser';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { addStyle, contrast, loadStyles, rgba } from './testing/browser';

interface ButtonProps {
  readonly variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  readonly isDisabled?: boolean;
  readonly isFocusableWhenDisabled?: boolean;
  readonly label?: string;
}

interface CheckboxProps {
  readonly defaultSelected?: boolean;
  readonly isIndeterminate?: boolean;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
}

interface Adapter {
  /** Resolves to the button's root. */
  button(props?: ButtonProps): Promise<HTMLElement>;
  /** Resolves to the checkbox's root. */
  checkbox(props?: CheckboxProps): Promise<HTMLElement>;
  unmount(): void;
}

let container: HTMLElement;

/**
 * Two frames, as the binder writes attributes after mount, then every
 * transition at its end, so colors read as the state's own.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  for (const animation of document.getAnimations()) animation.finish();
}

const rootOf = (kind: string): HTMLElement => {
  const root = container.querySelector<HTMLElement>(`[data-uni="${kind}"]`);
  if (!root) throw new Error(`No ${kind} root.`);
  return root;
};

// `tabindex`, so WebKit's Tab reaches the input, as Safari's does with
// "Press Tab to highlight each item" on.
const CHECKBOX = `
  <div data-uni="checkbox">
    <label data-element="Wrapper">
      <input data-element="Input" type="checkbox" tabindex="0" />
      <span data-element="Indicator"></span>
      <span data-element="Label">Accept the terms</span>
    </label>
    <p data-element="Description">We keep them short.</p>
    <p data-element="Error">You must accept the terms.</p>
  </div>`;

const flags = (pairs: Record<string, boolean | undefined>) =>
  Object.entries(pairs)
    .filter(([, isOn]) => isOn)
    .map(([name]) => ` ${name}`)
    .join('');

const elements: Adapter = {
  async button(props = {}) {
    const variant = props.variant ? ` data-variant="${props.variant}"` : '';
    container.innerHTML = `<uni-button${flags({
      disabled: props.isDisabled,
      'focusable-when-disabled': props.isFocusableWhenDisabled,
    })}><button data-uni="button"${variant}>${props.label ?? 'Save'}</button></uni-button>`;
    await settle();
    return rootOf('button');
  },
  async checkbox(props = {}) {
    container.innerHTML = `<uni-checkbox${flags({
      'default-selected': props.defaultSelected,
      indeterminate: props.isIndeterminate,
      disabled: props.isDisabled,
      invalid: props.isInvalid,
      readonly: props.isReadOnly,
    })}>${CHECKBOX}</uni-checkbox>`;
    await settle();
    return rootOf('checkbox');
  },
  unmount() {
    container.innerHTML = '';
  },
};

function ReactButton({ variant, label, ...props }: ButtonProps) {
  const { parts } = useComponent(button, props);
  return (
    <button {...parts.root} data-variant={variant}>
      {label ?? 'Save'}
    </button>
  );
}

function ReactCheckbox(props: CheckboxProps) {
  const { parts } = useComponent(checkbox, {
    labelElementType: 'span',
    ...props,
  });
  return (
    <div {...parts.root}>
      <label {...parts.wrapper}>
        <input {...parts.input} tabIndex={0} />
        <span {...parts.indicator} />
        <span {...parts.label}>Accept the terms</span>
      </label>
      <p {...parts.description}>We keep them short.</p>
      <p {...parts.error}>You must accept the terms.</p>
    </div>
  );
}

let reactRoot: Root | undefined;

async function render(node: ReactNode): Promise<void> {
  reactRoot?.unmount();
  const host = document.createElement('div');
  container.replaceChildren(host);
  reactRoot = createRoot(host);
  flushSync(() => reactRoot!.render(<StrictMode>{node}</StrictMode>));
  await settle();
}

const react: Adapter = {
  async button(props = {}) {
    await render(<ReactButton {...props} />);
    return rootOf('button');
  },
  async checkbox(props = {}) {
    await render(<ReactCheckbox {...props} />);
    return rootOf('checkbox');
  },
  unmount() {
    reactRoot?.unmount();
    reactRoot = undefined;
    container.innerHTML = '';
  },
};

const part = (root: Element, name: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(`[data-element="${name}"]`);
  if (!element) throw new Error(`No ${name} part.`);
  return element;
};

const style = (element: Element, pseudo?: string) =>
  getComputedStyle(element, pseudo);

const isChromium = navigator.userAgent.includes('Chrome/');

let unload: () => void;
let sentinel: HTMLInputElement;

beforeAll(async () => {
  unload = await loadStyles();
  // The page behind the components is the default surface.
  document.body.style.background = 'var(--uni-surface-color)';
  sentinel = document.createElement('input');
  sentinel.setAttribute('aria-label', 'Before');
  container = document.createElement('div');
  document.body.append(sentinel, container);
});

afterAll(() => {
  unload();
  sentinel.remove();
  container.remove();
  document.body.style.background = '';
});

/** Keyboard focus from the input before the component. */
async function tabInto(): Promise<void> {
  sentinel.focus();
  await keyboard.tab();
  await settle();
}

describe.each([
  ['elements', elements],
  ['react', react],
] as const)('%s', (_name, adapter) => {
  afterEach(async () => {
    await releaseInput();
    // Off the components, so the next one mounts unhovered.
    await pointer.move(sentinel);
    adapter.unmount();
    container.removeAttribute('dir');
    container.removeAttribute('style');
  });

  describe('focus ring', () => {
    test('a button shows it on focus-visible only, 2 pixels at 3:1', async () => {
      const root = await adapter.button();
      await tabInto();
      expect(root.hasAttribute('data-focus-visible')).toBe(true);
      const ring = style(root);
      expect(ring.outlineStyle).toBe('solid');
      expect(parseFloat(ring.outlineWidth)).toBeGreaterThanOrEqual(2);
      expect(
        contrast(ring.outlineColor, style(document.body).backgroundColor),
      ).toBeGreaterThanOrEqual(3);

      await pointer.click(root);
      await settle();
      expect(root.hasAttribute('data-focus-visible')).toBe(false);
      expect(parseFloat(style(root).outlineWidth)).toBe(0);
    });

    test('a checkbox shows it on its indicator, and keeps it while disabled', async () => {
      const root = await adapter.checkbox();
      const indicator = part(root, 'Indicator');
      expect(parseFloat(style(indicator).outlineWidth)).toBe(0);
      await tabInto();
      const ring = style(indicator);
      expect(parseFloat(ring.outlineWidth)).toBeGreaterThanOrEqual(2);
      expect(
        contrast(ring.outlineColor, style(document.body).backgroundColor),
      ).toBeGreaterThanOrEqual(3);
    });

    test('a disabled button that keeps focus keeps its ring', async () => {
      const root = await adapter.button({
        isDisabled: true,
        isFocusableWhenDisabled: true,
      });
      await tabInto();
      expect(parseFloat(style(root).outlineWidth)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('targets', () => {
    test('a button is at least 24 by 24 pixels', async () => {
      const box = (
        await adapter.button({ label: 'A' })
      ).getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    });

    test("a checkbox's input covers its wrapper, at least 24 by 24 pixels", async () => {
      const root = await adapter.checkbox();
      const input = part(root, 'Input').getBoundingClientRect();
      const wrapper = part(root, 'Wrapper').getBoundingClientRect();
      expect(input.width).toBeCloseTo(wrapper.width, 0);
      expect(input.height).toBeCloseTo(wrapper.height, 0);
      expect(input.height).toBeGreaterThanOrEqual(24);
      expect(input.width).toBeGreaterThanOrEqual(24);
    });
  });

  describe('states', () => {
    test('a selected checkbox takes the accent fill and shows its check', async () => {
      const root = await adapter.checkbox({ defaultSelected: true });
      const indicator = part(root, 'Indicator');
      expect(rgba(style(indicator).backgroundColor)).toEqual(
        rgba(
          style(document.documentElement).getPropertyValue(
            '--uni-accent-fill-color',
          ),
        ),
      );
      expect(style(indicator, '::before').content).not.toBe('none');
    });

    test('an unselected checkbox shows no mark', async () => {
      const root = await adapter.checkbox();
      expect(style(part(root, 'Indicator'), '::before').content).toBe('none');
    });

    test('the error stays hidden until the checkbox is invalid', async () => {
      expect(style(part(await adapter.checkbox(), 'Error')).display).toBe(
        'none',
      );
      const invalid = await adapter.checkbox({ isInvalid: true });
      expect(style(part(invalid, 'Error')).display).not.toBe('none');
    });

    test('a primary button takes the accent fill and its text', async () => {
      const root = await adapter.button({ variant: 'primary' });
      const fill = style(root).backgroundColor;
      expect(contrast(style(root).color, fill)).toBeGreaterThanOrEqual(4.5);
      expect(rgba(fill)).toEqual(
        rgba(
          style(document.documentElement).getPropertyValue(
            '--uni-accent-fill-color',
          ),
        ),
      );
    });
  });

  describe('overrides', () => {
    test('the same selector, loaded later, wins over a part in every state', async () => {
      const remove = addStyle(
        '[data-uni="checkbox"] [data-element="Indicator"] { background-color: rgb(1, 2, 3); }',
      );
      for (const props of [
        {},
        { defaultSelected: true },
        { defaultSelected: true, isInvalid: true },
        { isIndeterminate: true, isDisabled: true },
      ]) {
        const root = await adapter.checkbox(props);
        expect(
          style(part(root, 'Indicator')).backgroundColor,
          JSON.stringify(props),
        ).toBe('rgb(1, 2, 3)');
      }
      remove();
    });

    test('the same selector wins over a root in every state', async () => {
      const remove = addStyle(
        '[data-uni="button"] { background-color: rgb(1, 2, 3); }',
      );
      for (const props of [
        {},
        { variant: 'primary' },
        { isDisabled: true },
      ] as const) {
        const root = await adapter.button(props);
        expect(style(root).backgroundColor).toBe('rgb(1, 2, 3)');
      }
      remove();
    });

    test("a reset's element rule doesn't win", async () => {
      const remove = addStyle(
        'button { background-color: rgb(1, 2, 3); padding: 0; border-radius: 0; }',
      );
      const root = await adapter.button();
      expect(style(root).backgroundColor).not.toBe('rgb(1, 2, 3)');
      expect(style(root).borderRadius).not.toBe('0px');
      remove();
    });
  });

  describe('media', () => {
    afterEach(() => emulateMedia({ forcedColors: null, reducedMotion: null }));

    test('with reduced motion, no transition runs', async () => {
      // Set, not left to the reset after the last run: in WebKit on Linux,
      // `null` didn't end the emulation.
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.checkbox();
      const durations = () =>
        style(part(root, 'Indicator')).transitionDuration.split(', ');
      expect(durations().some((duration) => duration !== '0s')).toBe(true);
      await emulateMedia({ reducedMotion: 'reduce' });
      expect(durations().every((duration) => duration === '0s')).toBe(true);
      const button = await adapter.button();
      expect(style(button).transitionDuration.split(', ')).toEqual(['0s']);
    });

    test.runIf(isChromium)(
      'in forced colors, the box, the check, borders and the ring stay visible',
      async () => {
        await emulateMedia({ forcedColors: 'active' });
        const page = style(document.body).backgroundColor;
        const root = await adapter.checkbox({ defaultSelected: true });
        const indicator = part(root, 'Indicator');
        expect(style(indicator).backgroundColor).not.toBe(page);
        expect(style(indicator, '::before').borderRightColor).not.toBe(
          style(indicator).backgroundColor,
        );
        await tabInto();
        expect(
          parseFloat(style(indicator).outlineWidth),
        ).toBeGreaterThanOrEqual(2);
        expect(style(indicator).outlineColor).not.toBe(page);

        const unselected = part(await adapter.checkbox(), 'Indicator');
        expect(style(unselected).borderTopColor).not.toBe(page);
        expect(style(await adapter.button()).borderTopColor).not.toBe(page);
      },
    );
  });

  describe('text', () => {
    test('in right-to-left text the box sits at the start, on the right', async () => {
      container.dir = 'rtl';
      const root = await adapter.checkbox();
      expect(
        part(root, 'Indicator').getBoundingClientRect().left,
      ).toBeGreaterThan(part(root, 'Label').getBoundingClientRect().left);
    });

    test('at 200% text with WCAG 1.4.12 spacing, nothing clips', async () => {
      container.style.cssText =
        'font-size: 200%; line-height: 1.5; letter-spacing: 0.12em; word-spacing: 0.16em;';
      const remove = addStyle(
        '[data-uni] * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } [data-uni] p { margin-block-end: 2em !important; }',
      );
      for (const root of [
        await adapter.button({ label: 'Save the draft' }),
        part(await adapter.checkbox(), 'Wrapper'),
      ]) {
        expect(root.scrollHeight).toBeLessThanOrEqual(root.clientHeight + 1);
        expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      }
      remove();
    });

    test('at 320 pixels wide, a long label wraps inside the button', async () => {
      container.style.cssText = 'inline-size: 320px;';
      const root = await adapter.button({
        label: 'Save every draft in this folder before the deadline tonight',
      });
      expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(320);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    });
  });
});

describe('before a custom element upgrades', () => {
  afterEach(() => {
    container.innerHTML = '';
  });

  test("a checkbox shows the native input's checked and disabled states", async () => {
    container.innerHTML = CHECKBOX.replace(
      'type="checkbox"',
      'type="checkbox" checked disabled',
    );
    await settle();
    const indicator = part(rootOf('checkbox'), 'Indicator');
    expect(rgba(style(indicator).backgroundColor)).toEqual(
      rgba(
        style(document.documentElement).getPropertyValue(
          '--uni-disabled-fill-color',
        ),
      ),
    );
    expect(style(indicator, '::before').content).not.toBe('none');
  });

  test("a button shows the native button's disabled state", async () => {
    container.innerHTML = '<button data-uni="button" disabled>Save</button>';
    await settle();
    expect(rgba(style(rootOf('button')).color)).toEqual(
      rgba(
        style(document.documentElement).getPropertyValue(
          '--uni-disabled-text-color',
        ),
      ),
    );
  });
});
