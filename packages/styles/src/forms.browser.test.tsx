/**
 * ToggleButton, Switch, Radio, the groups and Field with the default
 * styles, mounted through both adapters with the same markup (spec:
 * Testing → Components).
 */

import '@uniaria/elements/checkbox';
import '@uniaria/elements/checkbox-group';
import '@uniaria/elements/field';
import '@uniaria/elements/radio';
import '@uniaria/elements/radio-group';
import '@uniaria/elements/switch';
import '@uniaria/elements/toggle-button';

import { checkbox } from '@uniaria/core/checkbox';
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { field } from '@uniaria/core/field';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { toggleSwitch } from '@uniaria/core/switch';
import { toggleButton } from '@uniaria/core/toggle-button';
import { OwnerProvider, useBehavior } from '@uniaria/react';
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
  setUpPage,
  style,
  tabInto,
  token,
  unmount,
} from './testing/harness';

interface ToggleButtonProps {
  readonly defaultSelected?: boolean;
  readonly isDisabled?: boolean;
}

interface SwitchProps {
  readonly defaultSelected?: boolean;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
}

interface GroupProps {
  /** The value of the item checked to begin with. */
  readonly selected?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly orientation?: 'horizontal' | 'vertical';
}

interface FieldProps {
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
}

interface Adapter {
  /** Each resolves to the component's root. */
  toggleButton(props?: ToggleButtonProps): Promise<HTMLElement>;
  switch(props?: SwitchProps): Promise<HTMLElement>;
  radioGroup(props?: GroupProps): Promise<HTMLElement>;
  checkboxGroup(props?: GroupProps): Promise<HTMLElement>;
  field(props?: FieldProps): Promise<HTMLElement>;
  unmount(): void;
}

const ITEMS = [
  ['free', 'Free'],
  ['pro', 'Pro'],
] as const;

// `tabindex`, so WebKit's Tab reaches the input, as Safari's does with
// "Press Tab to highlight each item" on.
const SWITCH = `
  <div data-uni="switch">
    <label data-element="Wrapper">
      <input data-element="Input" type="checkbox" tabindex="0" />
      <span data-element="Indicator"><span data-element="Thumb"></span></span>
      <span data-element="Label">Wi-Fi</span>
    </label>
    <p data-element="Description">Joins the networks you know.</p>
    <p data-element="Error">Turn it on to continue.</p>
  </div>`;

const RADIO = (value: string, label: string, isChecked: boolean) =>
  `
  <label data-uni="radio">
    <input data-element="Input" type="radio"${flags({ checked: isChecked })} />
    <span data-element="Indicator"></span>
    <span data-element="Label">${label}</span>
  </label>`.replace('<input', `<input value="${value}"`);

const CHECKBOX = (label: string, isChecked: boolean) => `
  <label data-uni="checkbox">
    <input data-element="Input" type="checkbox"${flags({ checked: isChecked })} />
    <span data-element="Indicator"></span>
    <span data-element="Label">${label}</span>
  </label>`;

/** A group's own parts around its items. */
const group = (kind: string, items: string, orientation = '') => `
  <div data-uni="${kind}"${orientation}>
    <span data-element="Label">Plan</span>
    ${items}
    <p data-element="Description">Billed monthly.</p>
    <p data-element="Error">Pick a plan.</p>
  </div>`;

const FIELD = `
  <div data-uni="field">
    <label data-element="Label">Email</label>
    <input data-element="Control" type="email" />
    <p data-element="Description">We send the receipt here.</p>
    <p data-element="Error">Enter your email.</p>
  </div>`;

const elements: Adapter = {
  async toggleButton(props = {}) {
    await mountHtml(
      `<uni-toggle-button${flags({
        'default-selected': props.defaultSelected,
        disabled: props.isDisabled,
      })}><button data-uni="toggle-button">Bold</button></uni-toggle-button>`,
    );
    return rootOf('toggle-button');
  },
  async switch(props = {}) {
    await mountHtml(
      `<uni-switch${flags({
        'default-selected': props.defaultSelected,
        disabled: props.isDisabled,
        invalid: props.isInvalid,
      })}>${SWITCH}</uni-switch>`,
    );
    return rootOf('switch');
  },
  async radioGroup(props = {}) {
    const items = ITEMS.map(
      ([value, label]) =>
        `<uni-radio value="${value}">${RADIO(value, label, props.selected === value)}</uni-radio>`,
    ).join('');
    const orientation = props.orientation
      ? ` orientation="${props.orientation}"`
      : '';
    await mountHtml(
      `<uni-radio-group name="plan"${orientation}${flags({
        disabled: props.isDisabled,
        invalid: props.isInvalid,
      })}>${group('radio-group', items)}</uni-radio-group>`,
    );
    return rootOf('radio-group');
  },
  async checkboxGroup(props = {}) {
    const items = ITEMS.map(
      ([value, label]) =>
        `<uni-checkbox value="${value}">${CHECKBOX(label, props.selected === value)}</uni-checkbox>`,
    ).join('');
    // UniAria writes no orientation on a checkbox group: the consumer does.
    const orientation = props.orientation
      ? ` data-orientation="${props.orientation}"`
      : '';
    await mountHtml(
      `<uni-checkbox-group name="plan"${flags({
        disabled: props.isDisabled,
        invalid: props.isInvalid,
      })}>${group('checkbox-group', items, orientation)}</uni-checkbox-group>`,
    );
    return rootOf('checkbox-group');
  },
  async field(props = {}) {
    await mountHtml(
      `<uni-field${flags({
        disabled: props.isDisabled,
        invalid: props.isInvalid,
      })}>${FIELD}</uni-field>`,
    );
    return rootOf('field');
  },
  unmount,
};

function ReactToggleButton(props: ToggleButtonProps) {
  const { parts } = useBehavior(toggleButton, props);
  return <button {...parts.root}>Bold</button>;
}

function ReactSwitch(props: SwitchProps) {
  const { parts } = useBehavior(toggleSwitch, {
    labelElementType: 'span',
    ...props,
  });
  return (
    <div {...parts.root}>
      <label {...parts.wrapper}>
        <input {...parts.input} tabIndex={0} />
        <span {...parts.indicator}>
          <span data-element="Thumb" />
        </span>
        <span {...parts.label}>Wi-Fi</span>
      </label>
      <p {...parts.description}>Joins the networks you know.</p>
      <p {...parts.error}>Turn it on to continue.</p>
    </div>
  );
}

function ReactRadio({ value, label }: { value: string; label: string }) {
  const { parts } = useBehavior(radio, { value, labelElementType: 'span' });
  return (
    <label {...parts.root}>
      <input {...parts.input} />
      <span {...parts.indicator} />
      <span {...parts.label}>{label}</span>
    </label>
  );
}

function ReactRadioGroup({ selected, ...props }: GroupProps) {
  const plan = useBehavior(radioGroup, {
    name: 'plan',
    ...props,
    ...(selected === undefined ? {} : { defaultValue: selected }),
  });
  return (
    <div {...plan.parts.root}>
      <span {...plan.parts.label}>Plan</span>
      <OwnerProvider owner={plan}>
        {ITEMS.map(([value, label]) => (
          <ReactRadio key={value} value={value} label={label} />
        ))}
      </OwnerProvider>
      <p {...plan.parts.description}>Billed monthly.</p>
      <p {...plan.parts.error}>Pick a plan.</p>
    </div>
  );
}

function ReactCheckbox({ value, label }: { value: string; label: string }) {
  const { parts } = useBehavior(checkbox, {
    value,
    labelElementType: 'span',
  });
  return (
    <label {...parts.root}>
      <input {...parts.input} />
      <span {...parts.indicator} />
      <span {...parts.label}>{label}</span>
    </label>
  );
}

function ReactCheckboxGroup({ selected, orientation, ...props }: GroupProps) {
  const plan = useBehavior(checkboxGroup, {
    name: 'plan',
    ...props,
    ...(selected === undefined ? {} : { defaultValue: [selected] }),
  });
  return (
    <div {...plan.parts.root} data-orientation={orientation}>
      <span {...plan.parts.label}>Plan</span>
      <OwnerProvider owner={plan}>
        {ITEMS.map(([value, label]) => (
          <ReactCheckbox key={value} value={value} label={label} />
        ))}
      </OwnerProvider>
      <p {...plan.parts.description}>Billed monthly.</p>
      <p {...plan.parts.error}>Pick a plan.</p>
    </div>
  );
}

function ReactField(props: FieldProps) {
  const { parts } = useBehavior(field, props);
  return (
    <div {...parts.root}>
      <label {...parts.label}>Email</label>
      <input {...parts.control} type="email" />
      <p {...parts.description}>We send the receipt here.</p>
      <p {...parts.error}>Enter your email.</p>
    </div>
  );
}

const react: Adapter = {
  async toggleButton(props = {}) {
    await mountReact(<ReactToggleButton {...props} />);
    return rootOf('toggle-button');
  },
  async switch(props = {}) {
    await mountReact(<ReactSwitch {...props} />);
    return rootOf('switch');
  },
  async radioGroup(props = {}) {
    await mountReact(<ReactRadioGroup {...props} />);
    return rootOf('radio-group');
  },
  async checkboxGroup(props = {}) {
    await mountReact(<ReactCheckboxGroup {...props} />);
    return rootOf('checkbox-group');
  },
  async field(props = {}) {
    await mountReact(<ReactField {...props} />);
    return rootOf('field');
  },
  unmount,
};

const box = (element: Element) => element.getBoundingClientRect();

/** The thumb's distance from the track's left and right edges. */
function thumbOffsets(root: Element): { left: number; right: number } {
  const track = box(part(root, 'Indicator'));
  const thumb = box(part(root, 'Thumb'));
  return { left: thumb.left - track.left, right: track.right - thumb.right };
}

const items = (root: Element, kind: string) => [
  ...root.querySelectorAll<HTMLElement>(`[data-uni="${kind}"]`),
];

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
    page.container.removeAttribute('dir');
  });

  describe('ToggleButton', () => {
    test('selected, it takes the accent fill and its text', async () => {
      const off = await adapter.toggleButton();
      expect(rgba(style(off).backgroundColor)).toEqual(rgba(token('surface')));
      const root = await adapter.toggleButton({ defaultSelected: true });
      const fill = style(root).backgroundColor;
      expect(rgba(fill)).toEqual(rgba(token('accent-fill')));
      expect(contrast(style(root).color, fill)).toBeGreaterThanOrEqual(4.5);
    });

    test('selected and disabled, it takes the disabled fill', async () => {
      const root = await adapter.toggleButton({
        defaultSelected: true,
        isDisabled: true,
      });
      expect(rgba(style(root).backgroundColor)).toEqual(
        rgba(token('disabled-fill')),
      );
    });

    test('is at least 24 by 24 pixels', async () => {
      const { width, height } = box(await adapter.toggleButton());
      expect(width).toBeGreaterThanOrEqual(24);
      expect(height).toBeGreaterThanOrEqual(24);
    });
  });

  describe('Switch', () => {
    test('the thumb sits at the start while off and the end while on', async () => {
      const off = thumbOffsets(await adapter.switch());
      expect(off.left).toBeLessThan(off.right);
      const root = await adapter.switch({ defaultSelected: true });
      const on = thumbOffsets(root);
      expect(on.right).toBeLessThan(on.left);
      expect(rgba(style(part(root, 'Indicator')).backgroundColor)).toEqual(
        rgba(token('accent-fill')),
      );
    });

    test('in right-to-left text the track sits at the start and the thumb mirrors', async () => {
      page.container.dir = 'rtl';
      const root = await adapter.switch({ defaultSelected: true });
      expect(box(part(root, 'Indicator')).left).toBeGreaterThan(
        box(part(root, 'Label')).left,
      );
      const on = thumbOffsets(root);
      expect(on.left).toBeLessThan(on.right);
    });

    test("is UI Kit's 32 by 20 track with a centered 12-pixel thumb", async () => {
      const root = await adapter.switch();
      const track = box(part(root, 'Indicator'));
      const thumb = box(part(root, 'Thumb'));
      expect([track.width, track.height]).toEqual([32, 20]);
      expect([thumb.width, thumb.height]).toEqual([12, 12]);
      expect(thumb.top - track.top).toBeCloseTo(track.bottom - thumb.bottom, 1);
    });

    test('the thumb stands out from the track at 3:1, on and off', async () => {
      for (const defaultSelected of [false, true]) {
        const root = await adapter.switch({ defaultSelected });
        expect(
          contrast(
            style(part(root, 'Thumb')).backgroundColor,
            style(part(root, 'Indicator')).backgroundColor,
          ),
          `selected: ${defaultSelected}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });

    test('the input covers the wrapper, at least 24 by 24 pixels', async () => {
      const root = await adapter.switch();
      const input = box(part(root, 'Input'));
      const wrapper = box(part(root, 'Wrapper'));
      expect(input.width).toBeCloseTo(wrapper.width, 0);
      expect(input.height).toBeCloseTo(wrapper.height, 0);
      expect(input.height).toBeGreaterThanOrEqual(24);
    });

    test('the track shows the focus ring', async () => {
      const root = await adapter.switch();
      await tabInto();
      const ring = style(part(root, 'Indicator'));
      expect(parseFloat(ring.outlineWidth)).toBeGreaterThanOrEqual(2);
      expect(
        contrast(ring.outlineColor, style(document.body).backgroundColor),
      ).toBeGreaterThanOrEqual(3);
    });

    test('the error stays hidden until the switch is invalid', async () => {
      expect(style(part(await adapter.switch(), 'Error')).display).toBe('none');
      const invalid = await adapter.switch({ isInvalid: true });
      expect(style(part(invalid, 'Error')).display).not.toBe('none');
    });
  });

  describe('Radio', () => {
    test('the selected radio shows an 8-pixel dot at 3:1, the others none', async () => {
      const [free, pro] = items(
        await adapter.radioGroup({ selected: 'pro' }),
        'radio',
      );
      expect(style(part(free!, 'Indicator'), '::before').content).toBe('none');
      const indicator = part(pro!, 'Indicator');
      const dot = style(indicator, '::before');
      expect(dot.content).not.toBe('none');
      expect(parseFloat(dot.width)).toBeCloseTo(8, 0);
      expect(rgba(dot.backgroundColor)).toEqual(rgba(token('accent-text')));
      expect(
        contrast(dot.backgroundColor, style(indicator).backgroundColor),
      ).toBeGreaterThanOrEqual(3);
    });

    test('the input covers the radio, at least 24 pixels high', async () => {
      const [first] = items(await adapter.radioGroup(), 'radio');
      const input = box(part(first!, 'Input'));
      expect(input.width).toBeCloseTo(box(first!).width, 0);
      expect(input.height).toBeGreaterThanOrEqual(24);
    });

    test('the circle shows the focus ring', async () => {
      const root = await adapter.radioGroup({ selected: 'pro' });
      await tabInto();
      const [, pro] = items(root, 'radio');
      expect(pro!.hasAttribute('data-focus-visible')).toBe(true);
      expect(
        parseFloat(style(part(pro!, 'Indicator')).outlineWidth),
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe.each(['radioGroup', 'checkboxGroup'] as const)('%s', (kind) => {
    const item = kind === 'radioGroup' ? 'radio' : 'checkbox';

    test("the group's label is a field label, the items' labels body text", async () => {
      const root = await adapter[kind]();
      const label = style(part(root, 'Label'));
      expect([label.fontSize, label.fontWeight]).toEqual(['14px', '500']);
      const [first] = items(root, item);
      const itemLabel = style(part(first!, 'Label'));
      expect([itemLabel.fontSize, itemLabel.fontWeight]).toEqual([
        '14px',
        '400',
      ]);
    });

    test('the items stack 8 pixels apart, the description 4 pixels under them', async () => {
      const root = await adapter[kind]();
      const [first, second] = items(root, item).map(box);
      expect(second!.top - first!.bottom).toBeCloseTo(8, 0);
      expect(box(part(root, 'Description')).top - second!.bottom).toBeCloseTo(
        4,
        0,
      );
    });

    test('horizontal, the items share a row under the label', async () => {
      const root = await adapter[kind]({ orientation: 'horizontal' });
      const [first, second] = items(root, item).map(box);
      expect(second!.top).toBeCloseTo(first!.top, 0);
      expect(second!.left - first!.right).toBeCloseTo(16, 0);
      expect(first!.top).toBeGreaterThanOrEqual(
        box(part(root, 'Label')).bottom,
      );
    });

    test('the error stays hidden until the group is invalid', async () => {
      expect(style(part(await adapter[kind](), 'Error')).display).toBe('none');
      const invalid = await adapter[kind]({ isInvalid: true });
      expect(style(part(invalid, 'Error')).display).not.toBe('none');
    });
  });

  describe('Field', () => {
    test("a text control is UI Kit's 32-pixel box, 8 pixels under the label", async () => {
      const root = await adapter.field();
      const control = part(root, 'Control');
      expect(box(control).height).toBeCloseTo(32, 0);
      expect(style(control).borderTopWidth).toBe('1px');
      expect(rgba(style(control).borderTopColor)).toEqual(
        rgba(token('border')),
      );
      expect(box(control).top - box(part(root, 'Label')).bottom).toBeCloseTo(
        8,
        0,
      );
      expect(
        box(part(root, 'Description')).top - box(control).bottom,
      ).toBeCloseTo(4, 0);
    });

    test('the control shows the focus ring on any focus', async () => {
      const root = await adapter.field();
      await tabInto();
      const ring = style(part(root, 'Control'));
      expect(parseFloat(ring.outlineWidth)).toBeGreaterThanOrEqual(2);
      expect(
        contrast(ring.outlineColor, style(document.body).backgroundColor),
      ).toBeGreaterThanOrEqual(3);
    });

    test('invalid, the control takes the danger border and the error shows', async () => {
      expect(style(part(await adapter.field(), 'Error')).display).toBe('none');
      const root = await adapter.field({ isInvalid: true });
      expect(rgba(style(part(root, 'Control')).borderTopColor)).toEqual(
        rgba(token('danger-border')),
      );
      expect(style(part(root, 'Error')).display).not.toBe('none');
    });
  });

  describe('media', () => {
    afterEach(() => emulateMedia({ forcedColors: null, reducedMotion: null }));

    test('with reduced motion, the thumb jumps', async () => {
      // Set, not left to the reset after the last run: in WebKit on Linux,
      // `null` didn't end the emulation.
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.switch();
      const durations = () =>
        style(part(root, 'Thumb')).transitionDuration.split(', ');
      expect(durations().some((duration) => duration !== '0s')).toBe(true);
      await emulateMedia({ reducedMotion: 'reduce' });
      expect(durations().every((duration) => duration === '0s')).toBe(true);
    });

    test.runIf(isChromium)(
      'in forced colors, the selected states, the thumb and the dot stay visible',
      async () => {
        await emulateMedia({ forcedColors: 'active' });
        const page = style(document.body).backgroundColor;

        const off = style(await adapter.toggleButton()).backgroundColor;
        const on = style(
          await adapter.toggleButton({ defaultSelected: true }),
        ).backgroundColor;
        expect(on).not.toBe(off);

        for (const defaultSelected of [false, true]) {
          const root = await adapter.switch({ defaultSelected });
          const track = style(part(root, 'Indicator'));
          expect(track.borderTopColor).not.toBe(page);
          expect(style(part(root, 'Thumb')).backgroundColor).not.toBe(
            track.backgroundColor,
          );
        }

        const [, pro] = items(
          await adapter.radioGroup({ selected: 'pro' }),
          'radio',
        );
        const circle = part(pro!, 'Indicator');
        expect(style(circle, '::before').backgroundColor).not.toBe(
          style(circle).backgroundColor,
        );

        const control = part(await adapter.field(), 'Control');
        expect(style(control).borderTopColor).not.toBe(page);
      },
    );
  });
});

describe('before a custom element upgrades', () => {
  afterEach(unmount);

  test("a switch shows the native input's checked state", async () => {
    await mountHtml(
      SWITCH.replace('type="checkbox"', 'type="checkbox" checked'),
    );
    const root = rootOf('switch');
    const on = thumbOffsets(root);
    expect(on.right).toBeLessThan(on.left);
    expect(rgba(style(part(root, 'Indicator')).backgroundColor)).toEqual(
      rgba(token('accent-fill')),
    );
  });

  test("a radio shows the native input's checked state", async () => {
    await mountHtml(RADIO('pro', 'Pro', true));
    expect(
      style(part(rootOf('radio'), 'Indicator'), '::before').content,
    ).not.toBe('none');
  });
});
