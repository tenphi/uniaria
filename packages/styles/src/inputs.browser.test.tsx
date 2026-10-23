/**
 * TextField and NumberField with the default styles, mounted through both
 * adapters with the same markup (spec: Testing → Components).
 */

import '@uniaria/elements/number-field';
import '@uniaria/elements/text-field';

import { numberField } from '@uniaria/core/number-field';
import { textField } from '@uniaria/core/text-field';
import { useBehavior } from '@uniaria/react';
import { emulateMedia, pointer, releaseInput } from '@uniaria/testing/browser';
import { afterEach, describe, expect, test } from 'vitest';

import { contrast, rgba } from './testing/browser';
import {
  flags,
  isChromium,
  mountHtml,
  mountReact,
  page,
  part,
  rootOf,
  settle,
  setUpPage,
  style,
  tabInto,
  token,
  unmount,
} from './testing/harness';

interface TextFieldProps {
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
}

interface NumberFieldProps {
  readonly defaultValue?: number;
  readonly minValue?: number;
  readonly isDisabled?: boolean;
}

interface Adapter {
  /** Each resolves to the component's root. */
  textField(props?: TextFieldProps): Promise<HTMLElement>;
  numberField(props?: NumberFieldProps): Promise<HTMLElement>;
  unmount(): void;
}

// The `@` is the consumer's own prefix, beside the input in the box.
const TEXT_FIELD = `
  <div data-uni="text-field">
    <label data-element="Label">Username</label>
    <div data-element="Wrapper">
      <span aria-hidden="true">@</span>
      <input data-element="Input" />
    </div>
    <p data-element="Description">Letters, digits and underscores.</p>
    <p data-element="Error">Use only letters, digits and underscores.</p>
  </div>`;

const NUMBER_FIELD = `
  <div data-uni="number-field">
    <label data-element="Label">Quantity</label>
    <div data-element="Wrapper">
      <button data-element="Decrement">−</button>
      <input data-element="Input" />
      <button data-element="Increment">+</button>
    </div>
    <p data-element="Description">Up to 10 per order.</p>
  </div>`;

const attribute = (name: string, value: number | undefined) =>
  value === undefined ? '' : ` ${name}="${value}"`;

const elements: Adapter = {
  async textField(props = {}) {
    await mountHtml(
      `<uni-text-field${flags({
        disabled: props.isDisabled,
        invalid: props.isInvalid,
      })}>${TEXT_FIELD}</uni-text-field>`,
    );
    return rootOf('text-field');
  },
  async numberField(props = {}) {
    await mountHtml(
      `<uni-number-field${attribute('default-value', props.defaultValue)}${attribute(
        'min-value',
        props.minValue,
      )}${flags({ disabled: props.isDisabled })}>${NUMBER_FIELD}</uni-number-field>`,
    );
    return rootOf('number-field');
  },
  unmount,
};

function ReactTextField(props: TextFieldProps) {
  const { parts } = useBehavior(textField, props);
  return (
    <div {...parts.root}>
      <label {...parts.label}>Username</label>
      <div {...parts.wrapper}>
        <span aria-hidden="true">@</span>
        <input {...parts.input} />
      </div>
      <p {...parts.description}>Letters, digits and underscores.</p>
      <p {...parts.error}>Use only letters, digits and underscores.</p>
    </div>
  );
}

function ReactNumberField(props: NumberFieldProps) {
  const { parts } = useBehavior(numberField, props);
  return (
    <div {...parts.root}>
      <label {...parts.label}>Quantity</label>
      <div {...parts.wrapper}>
        <button {...parts.decrement}>−</button>
        <input {...parts.input} />
        <button {...parts.increment}>+</button>
      </div>
      <p {...parts.description}>Up to 10 per order.</p>
    </div>
  );
}

const react: Adapter = {
  async textField(props = {}) {
    await mountReact(<ReactTextField {...props} />);
    return rootOf('text-field');
  },
  async numberField(props = {}) {
    await mountReact(<ReactNumberField {...props} />);
    return rootOf('number-field');
  },
  unmount,
};

const box = (element: Element) => element.getBoundingClientRect();

/** The ring an element draws: its width, and its contrast with the page. */
function ring(element: Element): { width: number; contrast: number } {
  const { outlineWidth, outlineColor } = style(element);
  return {
    width: parseFloat(outlineWidth),
    contrast: contrast(outlineColor, style(document.body).backgroundColor),
  };
}

setUpPage();

describe.each([
  ['elements', elements],
  ['react', react],
] as const)('%s', (_name, adapter) => {
  afterEach(async () => {
    await releaseInput();
    // Off the components, so the next one mounts unhovered.
    await pointer.move(page.sentinel);
    adapter.unmount();
    page.container.removeAttribute('style');
  });

  describe('TextField', () => {
    test("the wrapper is UI Kit's 32-pixel box, the input bare inside it", async () => {
      const root = await adapter.textField();
      const wrapper = part(root, 'Wrapper');
      const input = part(root, 'Input');
      expect(box(wrapper).height).toBeCloseTo(32, 0);
      expect(style(wrapper).borderTopWidth).toBe('1px');
      expect(rgba(style(wrapper).borderTopColor)).toEqual(
        rgba(token('border')),
      );
      expect(rgba(style(wrapper).backgroundColor)).toEqual(
        rgba(token('surface')),
      );
      expect(style(input).borderTopWidth).toBe('0px');
      expect(rgba(style(input).backgroundColor)[3]).toBe(0);
      expect(box(wrapper).top - box(part(root, 'Label')).bottom).toBeCloseTo(
        8,
        0,
      );
      expect(
        box(part(root, 'Description')).top - box(wrapper).bottom,
      ).toBeCloseTo(4, 0);
    });

    test('your prefix sits in the box, before the input', async () => {
      const root = await adapter.textField();
      const wrapper = box(part(root, 'Wrapper'));
      const prefix = box(part(root, 'Wrapper').querySelector('span')!);
      const input = box(part(root, 'Input'));
      expect(prefix.left).toBeGreaterThan(wrapper.left);
      expect(input.left).toBeGreaterThan(prefix.right);
      expect(input.right).toBeLessThanOrEqual(wrapper.right);
    });

    test('the wrapper shows the ring on any focus, a click included', async () => {
      const root = await adapter.textField();
      const wrapper = part(root, 'Wrapper');
      expect(ring(wrapper).width).toBe(0);
      await pointer.click(part(root, 'Input'));
      await settle();
      expect(ring(wrapper).width).toBeGreaterThanOrEqual(2);
      expect(ring(wrapper).contrast).toBeGreaterThanOrEqual(3);
      expect(ring(part(root, 'Input')).width).toBe(0);
    });

    test('invalid, the wrapper takes the danger border and the error shows', async () => {
      expect(style(part(await adapter.textField(), 'Error')).display).toBe(
        'none',
      );
      const root = await adapter.textField({ isInvalid: true });
      expect(rgba(style(part(root, 'Wrapper')).borderTopColor)).toEqual(
        rgba(token('danger-border')),
      );
      expect(style(part(root, 'Error')).display).not.toBe('none');
    });

    test('disabled, the box takes the disabled theme', async () => {
      const root = await adapter.textField({ isDisabled: true });
      expect(rgba(style(part(root, 'Wrapper')).backgroundColor)).toEqual(
        rgba(token('disabled-surface')),
      );
      expect(rgba(style(part(root, 'Input')).color)).toEqual(
        rgba(token('disabled-text')),
      );
    });
  });

  describe('NumberField', () => {
    test('the steppers sit in the box at 24 by 24 pixels', async () => {
      const root = await adapter.numberField({ defaultValue: 2 });
      const wrapper = box(part(root, 'Wrapper'));
      for (const name of ['Decrement', 'Increment']) {
        const stepper = box(part(root, name));
        expect([stepper.width, stepper.height], name).toEqual([24, 24]);
        expect(stepper.top).toBeGreaterThan(wrapper.top);
        expect(stepper.bottom).toBeLessThan(wrapper.bottom);
      }
      expect(box(part(root, 'Input')).left).toBeGreaterThan(
        box(part(root, 'Decrement')).right,
      );
      // At the box's edges, as far in as from the top and bottom.
      const decrement = box(part(root, 'Decrement'));
      const increment = box(part(root, 'Increment'));
      const inset = decrement.top - wrapper.top;
      expect(decrement.left - wrapper.left).toBeCloseTo(inset, 1);
      expect(wrapper.right - increment.right).toBeCloseTo(inset, 1);
      expect(wrapper.bottom - decrement.bottom).toBeCloseTo(inset, 1);
    });

    test('a stepper that can step lights up under the pointer', async () => {
      const root = await adapter.numberField({ defaultValue: 2 });
      const increment = part(root, 'Increment');
      expect(rgba(style(increment).backgroundColor)[3]).toBe(0);
      await pointer.move(increment);
      await settle();
      expect(rgba(style(increment).backgroundColor)).toEqual(
        rgba(token('surface-hover')),
      );
    });

    test("a stepper that can't step takes the disabled text", async () => {
      const root = await adapter.numberField({ defaultValue: 1, minValue: 1 });
      expect(rgba(style(part(root, 'Decrement')).color)).toEqual(
        rgba(token('disabled-text')),
      );
      expect(rgba(style(part(root, 'Increment')).color)).toEqual(
        rgba(token('text')),
      );
    });

    test('in a narrow field, the box narrows and keeps the steppers inside', async () => {
      page.container.style.cssText = 'inline-size: 160px;';
      const root = await adapter.numberField({ defaultValue: 2 });
      const wrapper = box(part(root, 'Wrapper'));
      expect(wrapper.width).toBeCloseTo(160, 0);
      expect(box(part(root, 'Increment')).right).toBeLessThan(wrapper.right);
    });

    test('the number sits at the end of the input', async () => {
      const root = await adapter.numberField({ defaultValue: 2 });
      expect(style(part(root, 'Input')).textAlign).toBe('end');
    });
  });

  describe('media', () => {
    afterEach(() => emulateMedia({ forcedColors: null }));

    test.runIf(isChromium)(
      'in forced colors, the box, the ring and the steppers stay visible',
      async () => {
        await emulateMedia({ forcedColors: 'active' });
        const page = style(document.body).backgroundColor;
        const root = await adapter.textField();
        expect(style(part(root, 'Wrapper')).borderTopColor).not.toBe(page);
        await tabInto();
        expect(ring(part(root, 'Wrapper')).width).toBeGreaterThanOrEqual(2);
        expect(style(part(root, 'Wrapper')).outlineColor).not.toBe(page);

        const number = await adapter.numberField({ defaultValue: 2 });
        expect(style(part(number, 'Increment')).color).not.toBe(page);
      },
    );
  });
});

describe('before a custom element upgrades', () => {
  afterEach(unmount);

  test("a text field shows the native input's disabled state", async () => {
    await mountHtml(TEXT_FIELD.replace('<input', '<input disabled'));
    expect(
      rgba(style(part(rootOf('text-field'), 'Wrapper')).backgroundColor),
    ).toEqual(rgba(token('disabled-surface')));
  });
});
