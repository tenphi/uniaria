/**
 * Screenshots of every component in every scheme, and in forced colors
 * (spec: Testing → Screenshots): each gallery holds a component's resting
 * states, keyboard focus on the first, or an overlay open. The references
 * are Chromium's on Linux, since every engine and OS renders text its own
 * way (spec: Resolved questions 12), so elsewhere the tests skip.
 * `pnpm -C packages/styles screenshots` makes them in Playwright's Docker
 * image, the Linux CI runs on.
 */

import '@uniaria/elements/button';
import '@uniaria/elements/checkbox';
import '@uniaria/elements/checkbox-group';
import '@uniaria/elements/combobox';
import '@uniaria/elements/dialog';
import '@uniaria/elements/field';
import '@uniaria/elements/listbox';
import '@uniaria/elements/number-field';
import '@uniaria/elements/popover';
import '@uniaria/elements/radio';
import '@uniaria/elements/radio-group';
import '@uniaria/elements/select';
import '@uniaria/elements/switch';
import '@uniaria/elements/text-field';
import '@uniaria/elements/toggle-button';
import '@uniaria/elements/tooltip';

import { emulateMedia, pointer } from '@uniaria/testing/browser';
import type { MediaFeatures } from '@uniaria/testing/browser';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { page as browserPage, server } from 'vitest/browser';

import { addStyle } from './testing/browser';
import {
  flags,
  page,
  settle,
  setUpPage,
  tabInto,
  unmount,
} from './testing/harness';

const isReference =
  server.browser === 'chromium' && server.platform === 'linux';

interface Gallery {
  readonly name: string;
  /** The cases, each a cell of the grid. */
  readonly html: string;
  /** The grid's columns. */
  readonly columns?: number;
  /** Keyboard focus on the first case, for its focus ring. */
  readonly isFocused?: boolean;
  /**
   * `grid` by default; `popup`, a box with room below the first case for
   * its popup; `centered`, a box with the case in its middle, for an
   * overlay above or below it; `page`, the viewport, for a modal dialog.
   */
  readonly layout?: 'grid' | 'popup' | 'centered' | 'page';
}

const BUTTON_VARIANTS = ['secondary', 'primary', 'quiet', 'danger'] as const;

const button = (variant: string, isDisabled: boolean) =>
  `<uni-button${flags({ disabled: isDisabled })}><button data-uni="button"${
    variant === 'secondary' ? '' : ` data-variant="${variant}"`
  }>${variant[0]?.toUpperCase()}${variant.slice(1)}</button></uni-button>`;

const toggleButton = (
  label: string,
  props: { variant?: string; isSelected?: boolean; isDisabled?: boolean },
) =>
  `<uni-toggle-button${flags({
    'default-selected': props.isSelected,
    disabled: props.isDisabled,
  })}><button data-uni="toggle-button"${
    props.variant ? ` data-variant="${props.variant}"` : ''
  }>${label}</button></uni-toggle-button>`;

interface CheckProps {
  readonly isSelected?: boolean;
  readonly isIndeterminate?: boolean;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
  readonly description?: string;
}

const checkFlags = (props: CheckProps) =>
  flags({
    'default-selected': props.isSelected,
    indeterminate: props.isIndeterminate,
    disabled: props.isDisabled,
    invalid: props.isInvalid,
    readonly: props.isReadOnly,
  });

const description = (text?: string) =>
  text ? `<p data-element="Description">${text}</p>` : '';

const checkbox = (label: string, props: CheckProps = {}) => `
  <uni-checkbox${checkFlags(props)}>
    <div data-uni="checkbox">
      <label data-element="Wrapper">
        <input data-element="Input" type="checkbox" />
        <span data-element="Indicator"></span>
        <span data-element="Label">${label}</span>
      </label>
      ${description(props.description)}
      <p data-element="Error">You must accept the terms.</p>
    </div>
  </uni-checkbox>`;

const toggleSwitch = (label: string, props: CheckProps = {}) => `
  <uni-switch${checkFlags(props)}>
    <div data-uni="switch">
      <label data-element="Wrapper">
        <input data-element="Input" type="checkbox" />
        <span data-element="Indicator"><span data-element="Thumb"></span></span>
        <span data-element="Label">${label}</span>
      </label>
      ${description(props.description)}
      <p data-element="Error">Turn it on to continue.</p>
    </div>
  </uni-switch>`;

interface GroupProps {
  /** The group's name: native radios with one name are one group. */
  readonly name: string;
  readonly selected?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly isHorizontal?: boolean;
}

const PLANS = [
  ['free', 'Free'],
  ['pro', 'Pro'],
  ['team', 'Team'],
] as const;

/** A group's own parts around its items. */
const group = (kind: string, items: string, orientation: string) => `
  <div data-uni="${kind}"${orientation}>
    <span data-element="Label">Plan</span>
    ${items}
    <p data-element="Description">Billed monthly.</p>
    <p data-element="Error">Pick a plan.</p>
  </div>`;

const radioGroup = (props: GroupProps) => {
  const items = PLANS.map(
    ([value, label]) => `
      <uni-radio value="${value}">
        <label data-uni="radio">
          <input data-element="Input" type="radio"${flags({ checked: props.selected === value })} />
          <span data-element="Indicator"></span>
          <span data-element="Label">${label}</span>
        </label>
      </uni-radio>`,
  ).join('');
  const orientation = props.isHorizontal ? ' orientation="horizontal"' : '';
  return `
    <uni-radio-group name="${props.name}"${orientation}${flags({
      disabled: props.isDisabled,
      invalid: props.isInvalid,
      'data-wide': props.isHorizontal,
    })}>${group('radio-group', items, '')}</uni-radio-group>`;
};

const checkboxGroup = (props: GroupProps) => {
  const items = PLANS.map(
    ([value, label]) => `
      <uni-checkbox value="${value}">
        <label data-uni="checkbox">
          <input data-element="Input" type="checkbox"${flags({ checked: props.selected === value })} />
          <span data-element="Indicator"></span>
          <span data-element="Label">${label}</span>
        </label>
      </uni-checkbox>`,
  ).join('');
  // UniAria writes no orientation on a checkbox group: the consumer does.
  const orientation = props.isHorizontal
    ? ' data-orientation="horizontal"'
    : '';
  return `
    <uni-checkbox-group name="${props.name}"${flags({
      disabled: props.isDisabled,
      invalid: props.isInvalid,
      'data-wide': props.isHorizontal,
    })}>${group('checkbox-group', items, orientation)}</uni-checkbox-group>`;
};

interface FieldProps {
  readonly value?: string;
  readonly placeholder?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
}

const fieldFlags = (props: FieldProps) =>
  flags({
    disabled: props.isDisabled,
    invalid: props.isInvalid,
    readonly: props.isReadOnly,
  });

const value = (text?: string) =>
  text === undefined ? '' : ` default-value="${text}"`;

const field = (props: FieldProps = {}) => `
  <uni-field${fieldFlags(props)}>
    <div data-uni="field">
      <label data-element="Label">Email</label>
      <input data-element="Control" type="email" value="${props.value ?? ''}"${flags({ disabled: props.isDisabled })} />
      <p data-element="Description">We send the receipt here.</p>
      <p data-element="Error">Enter your email.</p>
    </div>
  </uni-field>`;

// The `@` is the consumer's own prefix, beside the input in the box.
const textField = (props: FieldProps = {}) => `
  <uni-text-field${value(props.value)}${fieldFlags(props)}>
    <div data-uni="text-field">
      <label data-element="Label">Username</label>
      <div data-element="Wrapper">
        <span aria-hidden="true">@</span>
        <input data-element="Input" placeholder="${props.placeholder ?? ''}" />
      </div>
      <p data-element="Description">Letters, digits and underscores.</p>
      <p data-element="Error">Use only letters, digits and underscores.</p>
    </div>
  </uni-text-field>`;

const numberField = (props: FieldProps & { minValue?: number } = {}) => `
  <uni-number-field${value(props.value)}${
    props.minValue === undefined ? '' : ` min-value="${props.minValue}"`
  }${fieldFlags(props)}>
    <div data-uni="number-field">
      <label data-element="Label">Quantity</label>
      <div data-element="Wrapper">
        <button data-element="Decrement">−</button>
        <input data-element="Input" />
        <button data-element="Increment">+</button>
      </div>
      <p data-element="Description">Up to 10 per order.</p>
      <p data-element="Error">Order at least one.</p>
    </div>
  </uni-number-field>`;

const OPTIONS = `
  <div data-element="Option" data-key="apple">Apple</div>
  <div data-element="Option" data-key="banana">Banana</div>
  <div data-element="Option" data-key="cherry">Cherry</div>
  <div data-element="Group" data-key="citrus">
    <span data-element="GroupLabel" data-key="citrus">Citrus</span>
    <div data-element="Option" data-key="lemon">Lemon</div>
    <div data-element="Option" data-key="lime">Lime</div>
  </div>
  <div data-element="Option" data-key="mango">Mango</div>`;

interface PickerProps {
  readonly value?: readonly string[];
  readonly isOpen?: boolean;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly isMultiple?: boolean;
  readonly isEmpty?: boolean;
}

// A value is an array, which no attribute holds: `data-value` stands in
// for the property, which the test sets.
const pickerAttributes = (props: PickerProps) =>
  `${props.value ? ` data-value='${JSON.stringify(props.value)}'` : ''}${
    props.isMultiple ? ' selection-mode="multiple"' : ''
  } disabled-keys='["cherry"]'${flags({
    'default-open': props.isOpen,
    disabled: props.isDisabled,
    invalid: props.isInvalid,
  })}`;

const listbox = (props: PickerProps = {}) => `
  <uni-listbox${pickerAttributes(props)}>
    <div data-uni="listbox">
      <span data-element="Label">Fruit</span>
      <div data-element="List">${props.isEmpty ? '' : OPTIONS}</div>
      <p data-element="Empty">No fruit</p>
    </div>
  </uni-listbox>`;

const select = (props: PickerProps = {}) => `
  <uni-select placeholder="Pick a fruit"${pickerAttributes(props)}>
    <div data-uni="select">
      <span data-element="Label">Fruit</span>
      <button data-element="Trigger"><span data-element="Value"></span></button>
      <div data-element="Popover">
        <div data-element="List">${OPTIONS}</div>
      </div>
      <p data-element="Error">Pick a fruit.</p>
    </div>
  </uni-select>`;

const combobox = (props: PickerProps = {}) => `
  <uni-combobox${pickerAttributes(props)}>
    <div data-uni="combobox">
      <label data-element="Label">Fruit</label>
      <div data-element="Anchor">
        <input data-element="Input" placeholder="Type to search" />
        <button data-element="Button"></button>
      </div>
      <div data-element="Popover">
        <div data-element="List">${OPTIONS}</div>
        <p data-element="Empty">No fruit matches.</p>
      </div>
      <p data-element="Error">Pick a fruit.</p>
    </div>
  </uni-combobox>`;

const GALLERIES: readonly Gallery[] = [
  {
    name: 'button',
    html: [
      ...BUTTON_VARIANTS.map((variant) => button(variant, false)),
      ...BUTTON_VARIANTS.map((variant) => button(variant, true)),
    ].join(''),
    columns: 4,
    isFocused: true,
  },
  {
    name: 'toggle-button',
    html: [
      toggleButton('Bold', {}),
      toggleButton('Bold', { isSelected: true }),
      toggleButton('Quiet', { variant: 'quiet' }),
      toggleButton('Quiet', { variant: 'quiet', isSelected: true }),
      toggleButton('Disabled', { isDisabled: true }),
      toggleButton('Disabled', { isDisabled: true, isSelected: true }),
      toggleButton('Quiet', { variant: 'quiet', isDisabled: true }),
      toggleButton('Quiet', {
        variant: 'quiet',
        isDisabled: true,
        isSelected: true,
      }),
    ].join(''),
    columns: 4,
    isFocused: true,
  },
  {
    name: 'checkbox',
    html: [
      checkbox('Unchecked', { description: 'We keep them short.' }),
      checkbox('Checked', { isSelected: true }),
      checkbox('Mixed', { isIndeterminate: true }),
      checkbox('Read-only', { isSelected: true, isReadOnly: true }),
      checkbox('Disabled', { isDisabled: true }),
      checkbox('Disabled', { isDisabled: true, isSelected: true }),
      checkbox('Invalid', { isInvalid: true }),
      checkbox('Invalid', { isInvalid: true, isSelected: true }),
    ].join(''),
    columns: 4,
    isFocused: true,
  },
  {
    name: 'switch',
    html: [
      toggleSwitch('Off', { description: 'Joins the networks you know.' }),
      toggleSwitch('On', { isSelected: true }),
      toggleSwitch('Read-only', { isSelected: true, isReadOnly: true }),
      toggleSwitch('Disabled', { isDisabled: true }),
      toggleSwitch('Disabled', { isDisabled: true, isSelected: true }),
      toggleSwitch('Invalid', { isInvalid: true }),
    ].join(''),
    columns: 3,
    isFocused: true,
  },
  {
    name: 'radio-group',
    html: [
      radioGroup({ name: 'plan', selected: 'pro' }),
      radioGroup({ name: 'disabled', selected: 'pro', isDisabled: true }),
      radioGroup({ name: 'invalid', isInvalid: true }),
      radioGroup({ name: 'row', selected: 'free', isHorizontal: true }),
    ].join(''),
    columns: 3,
    isFocused: true,
  },
  {
    name: 'checkbox-group',
    html: [
      checkboxGroup({ name: 'plan', selected: 'pro' }),
      checkboxGroup({ name: 'disabled', selected: 'pro', isDisabled: true }),
      checkboxGroup({ name: 'invalid', isInvalid: true }),
      checkboxGroup({ name: 'row', selected: 'free', isHorizontal: true }),
    ].join(''),
    columns: 3,
    isFocused: true,
  },
  {
    name: 'field',
    html: [
      field(),
      field({ value: 'ana@example.com' }),
      field({ value: 'ana@', isInvalid: true }),
      field({ value: 'ana@example.com', isDisabled: true }),
    ].join(''),
    columns: 2,
    isFocused: true,
  },
  {
    name: 'text-field',
    html: [
      textField({ placeholder: 'your_name' }),
      textField({ value: 'ana_lee' }),
      textField({ value: 'ana lee', isInvalid: true }),
      textField({ value: 'ana_lee', isReadOnly: true }),
      textField({ value: 'ana_lee', isDisabled: true }),
    ].join(''),
    columns: 2,
    isFocused: true,
  },
  {
    name: 'number-field',
    html: [
      numberField({ value: '3' }),
      numberField({ value: '1', minValue: 1 }),
      numberField({ value: '0', isInvalid: true }),
      numberField({ value: '3', isReadOnly: true }),
      numberField({ value: '3', isDisabled: true }),
    ].join(''),
    columns: 2,
    isFocused: true,
  },
  {
    name: 'listbox',
    html: [
      listbox({ value: ['banana'] }),
      listbox({ value: ['apple', 'lemon'], isMultiple: true }),
      listbox({ value: ['banana'], isDisabled: true }),
      listbox({ isEmpty: true }),
    ].join(''),
    columns: 4,
    isFocused: true,
  },
  {
    name: 'select',
    html: [
      select(),
      select({ value: ['banana'] }),
      select({ isInvalid: true }),
      select({ value: ['banana'], isDisabled: true }),
    ].join(''),
    columns: 2,
    isFocused: true,
  },
  {
    name: 'select-open',
    html: select({ value: ['banana'], isOpen: true }),
    layout: 'popup',
  },
  {
    name: 'combobox',
    html: [
      combobox(),
      combobox({ value: ['banana'] }),
      combobox({ isInvalid: true }),
      combobox({ value: ['banana'], isDisabled: true }),
    ].join(''),
    columns: 2,
    isFocused: true,
  },
  {
    name: 'combobox-open',
    html: combobox({ isOpen: true }),
    layout: 'popup',
  },
  {
    name: 'dialog',
    html: `
      <uni-dialog default-open>
        <button data-uni-part="dialog-trigger">Delete file…</button>
        <dialog data-uni="dialog">
          <h2 data-element="Title">Delete “report.pdf”?</h2>
          <p data-element="Description">It stays in the trash for 30 days.</p>
          <button data-element="Close">Cancel</button>
        </dialog>
      </uni-dialog>`,
    layout: 'page',
  },
  {
    name: 'popover',
    html: `
      <uni-popover default-open>
        <button data-uni-part="popover-trigger">Share</button>
        <div data-uni="popover">
          <div data-element="Arrow"></div>
          <p data-element="Description">Anyone with the link can view.</p>
          <button data-element="Close">Done</button>
        </div>
      </uni-popover>`,
    layout: 'centered',
  },
  {
    name: 'tooltip',
    html: `
      <uni-tooltip default-open>
        <button data-uni-part="tooltip-trigger">Save</button>
        <div data-uni="tooltip">
          Saves the file
          <div data-element="Arrow"></div>
        </div>
      </uni-tooltip>`,
    layout: 'centered',
  },
];

/**
 * Pixelmatch's default threshold, .1, passes a dark surface ten tones
 * lighter as the same color; .02 fails it, and still passes the level or
 * two antialiasing moves between runs.
 */
const COMPARISON = {
  comparatorName: 'pixelmatch',
  comparatorOptions: { threshold: 0.02 },
} as const;

const MODES: readonly (readonly [string, MediaFeatures])[] = [
  ['light', { colorScheme: 'light', contrast: 'no-preference' }],
  ['dark', { colorScheme: 'dark', contrast: 'no-preference' }],
  ['light-contrast', { colorScheme: 'light', contrast: 'more' }],
  ['dark-contrast', { colorScheme: 'dark', contrast: 'more' }],
  ['forced-colors', { colorScheme: 'light', forcedColors: 'active' }],
];

// Liberation Sans is in Playwright's Linux dependencies, so the Docker
// image and CI's runner draw the same text.
const LAYOUT = `
  [data-screenshot] {
    box-sizing: border-box;
    padding: 16px;
    font-family: 'Liberation Sans';
  }
  [data-screenshot='grid'] {
    display: grid;
    grid-template-columns: repeat(var(--columns), max-content);
    gap: 24px 32px;
    align-items: start;
    inline-size: max-content;
  }
  [data-screenshot='grid'] > [data-wide] { grid-column: 1 / -1; }
  [data-screenshot='popup'] { inline-size: 320px; block-size: 360px; }
  [data-screenshot='centered'] {
    display: grid;
    place-items: center;
    inline-size: 320px;
    block-size: 280px;
  }
  [data-screenshot='page'] { position: fixed; inset: 0; }
  #rest { position: fixed; inset: auto 0 0 auto; inline-size: 1px; block-size: 1px; }
  /* The input that tabInto() starts from, hidden from the page layout. */
  body > input { position: absolute; opacity: 0; }`;

describe.skipIf(!isReference)('screenshots', () => {
  setUpPage();

  // Where the pointer rests between tests: away from every case.
  const rest = document.createElement('div');
  rest.id = 'rest';
  let removeLayout: () => void;
  beforeAll(async () => {
    await browserPage.viewport(720, 480);
    removeLayout = addStyle(LAYOUT);
    document.body.append(rest);
  });
  afterAll(() => {
    removeLayout();
    rest.remove();
  });

  describe.each(MODES)('%s', (mode, features) => {
    beforeAll(() => emulateMedia(features));
    afterAll(() =>
      emulateMedia({ colorScheme: null, contrast: null, forcedColors: null }),
    );
    afterEach(unmount);

    test.for(GALLERIES)('$name', async (gallery) => {
      // A click resets the input modality, so only `isFocused` shows a ring.
      await pointer.click(rest);
      page.container.dataset.screenshot = gallery.layout ?? 'grid';
      page.container.style.setProperty(
        '--columns',
        String(gallery.columns ?? 1),
      );
      page.container.innerHTML = gallery.html;
      for (const host of page.container.querySelectorAll<
        HTMLElement & { value: unknown }
      >('[data-value]')) {
        host.value = JSON.parse(host.dataset.value ?? '[]');
      }
      await settle();
      if (gallery.isFocused) await tabInto();
      // An overlay opened on mount: wait out its entering frames.
      while (document.querySelector('[data-entering]')) {
        await new Promise(requestAnimationFrame);
      }
      // Past the viewport's edge, a screenshot gets no pixels.
      expect(page.container.getBoundingClientRect().right).toBeLessThanOrEqual(
        innerWidth,
      );
      await expect
        .element(browserPage.elementLocator(page.container))
        .toMatchScreenshot(`${gallery.name}-${mode}`, COMPARISON);
    });
  });
});
