import { button } from '@uniaria/core/button';
import { checkbox } from '@uniaria/core/checkbox';
import { combobox } from '@uniaria/core/combobox';
import { dialog } from '@uniaria/core/dialog';
import { field } from '@uniaria/core/field';
import { listbox } from '@uniaria/core/listbox';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { select } from '@uniaria/core/select';
import { toggleSwitch } from '@uniaria/core/switch';
import { textField } from '@uniaria/core/text-field';
import type { Component } from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';

import { useComponent } from './use-component';
import { useComponentState } from './use-component-state';

const html = (component: Component, props?: Record<string, unknown>) =>
  renderToString(createSSRApp(component, props));

const Docs = defineComponent({
  props: { isDisabled: Boolean },
  setup(props) {
    const ui = useComponent(button, () => ({
      href: '/docs',
      isDisabled: props.isDisabled,
    }));
    const isUnavailable = useComponentState(ui, (state) => state.isDisabled);
    return () =>
      h(
        'a',
        {
          ...ui.parts.root,
          title: isUnavailable.value ? 'Unavailable' : undefined,
        },
        'Docs',
      );
  },
});

describe('server rendering without a DOM', () => {
  it('renders the attributes UniAria owns and no handlers', async () => {
    expect(await html(Docs)).toBe(
      '<a href="/docs" tabindex="0" data-uni="button">Docs</a>',
    );
  });

  it('renders state read through a selector', async () => {
    const result = await html(Docs, { isDisabled: true });
    expect(result).toContain('role="link"');
    expect(result).toContain('aria-disabled="true"');
    expect(result).toContain('title="Unavailable"');
    expect(result).not.toContain('href');
  });
});

const Email = defineComponent(() => {
  const ui = useComponent(field, { isInvalid: true, controlId: 'email' });
  return () =>
    h('div', ui.parts.root, [
      h('label', ui.parts.label, 'Email'),
      h('input', ui.parts.control),
      h('p', ui.parts.error, 'Enter a valid email'),
    ]);
});

describe('Field on the server', () => {
  it('renders ids and the label for, and links the rest on hydration', async () => {
    const result = await html(Email);
    expect(result).toContain('for="email"');
    expect(result).toContain('id="email"');
    expect(result).toContain('aria-invalid="true"');
    // Only rendered parts are referenced, which is known after mount.
    expect(result).not.toContain('aria-labelledby');
    expect(result).not.toContain('aria-describedby');
  });
});

const Name = defineComponent(() => {
  const ui = useComponent(textField, { defaultValue: 'Jane', inputId: 'name' });
  return () =>
    h('div', ui.parts.root, [
      h('label', ui.parts.label, 'Name'),
      h('input', ui.parts.input),
    ]);
});

describe('TextField on the server', () => {
  it('renders the starting value and the label for', async () => {
    const result = await html(Name);
    expect(result).toContain('value="Jane"');
    expect(result).toContain('for="name"');
    expect(result).toContain('id="name"');
  });
});

const Terms = defineComponent(() => {
  const ui = useComponent(checkbox, {
    defaultSelected: true,
    labelElementType: 'span',
  });
  return () =>
    h('label', ui.parts.root, [
      h('input', { ...ui.parts.input, name: 'terms' }),
      h('span', ui.parts.indicator),
      h('span', ui.parts.label, 'Accept terms'),
    ]);
});

describe('Checkbox on the server', () => {
  it('renders a checkbox in its starting state', async () => {
    const result = await html(Terms);
    expect(result).toContain('type="checkbox"');
    expect(result).toMatch(/<input[^>]*\schecked[\s>]/);
    expect(result).toContain('aria-hidden="true"');
    expect(result).toMatch(/\sdata-selected[\s>=]/);
    expect(result).not.toContain('aria-checked');
  });
});

const Wifi = defineComponent(() => {
  const ui = useComponent(toggleSwitch, {
    defaultSelected: true,
    labelElementType: 'span',
  });
  return () =>
    h('label', ui.parts.root, [
      h('input', { ...ui.parts.input, name: 'wifi' }),
      h('span', ui.parts.indicator),
      h('span', ui.parts.label, 'Wi-Fi'),
    ]);
});

describe('Switch on the server', () => {
  it('renders a switch in its starting state', async () => {
    const result = await html(Wifi);
    expect(result).toMatch(/<input[^>]*role="switch"/);
    expect(result).toContain('type="checkbox"');
    expect(result).toMatch(/<input[^>]*\schecked[\s>]/);
    expect(result).toContain('data-uni="switch"');
    expect(result).not.toContain('aria-checked');
  });
});

const PlanOption = defineComponent({
  props: { value: { type: String, required: true } },
  setup(props, { slots }) {
    const ui = useComponent(radio, () => ({
      value: props.value,
      labelElementType: 'span',
    }));
    return () =>
      h('label', ui.parts.root, [
        h('input', ui.parts.input),
        h('span', ui.parts.label, slots.default?.()),
      ]);
  },
});

const Plan = defineComponent(() => {
  const ui = useComponent(radioGroup, { defaultValue: 'pro', name: 'plan' });
  return () =>
    h('div', ui.parts.root, [
      h('span', ui.parts.label, 'Plan'),
      h(PlanOption, { value: 'free' }, () => 'Free'),
      h(PlanOption, { value: 'pro' }, () => 'Pro'),
    ]);
});

describe('RadioGroup on the server', () => {
  it("renders its radios with the group's name and value", async () => {
    const result = await html(Plan);
    expect(result).toContain('role="radiogroup"');
    const radios = result.match(/<input[^>]*>/g)!;
    expect(radios).toHaveLength(2);
    for (const input of radios) {
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="plan"');
    }
    expect(radios[0]).toContain('value="free"');
    expect(radios[0]).not.toContain('checked');
    expect(radios[1]).toMatch(/\schecked[\s>]/);
    expect(result).not.toContain('aria-checked');
  });
});

const Confirm = defineComponent(() => {
  const ui = useComponent(dialog, { defaultOpen: true });
  return () => [
    h('button', ui.parts.trigger, 'Delete file'),
    h('dialog', ui.parts.root, [
      h('h2', ui.parts.title, 'Delete file'),
      h('button', ui.parts.close, 'Cancel'),
    ]),
  ];
});

describe('Dialog on the server', () => {
  it('renders a closed dialog, even one open by default', async () => {
    const result = await html(Confirm);
    const tag = result.match(/<dialog[^>]*>/)![0];
    // `open` would open it non-modally; it opens after hydration.
    expect(tag).not.toMatch(/\sopen[\s=>]/);
    expect(tag).toContain('tabindex="-1"');
    // Only rendered parts are referenced, which is known after mount.
    expect(tag).not.toContain('aria-labelledby');
    expect(result).toContain('type="button"');
  });
});

const SizePicker = defineComponent(() => {
  const ui = useComponent(popover, {});
  return () => [
    h('button', ui.parts.trigger, 'Size'),
    h('div', ui.parts.root, [h('input', { 'aria-label': 'Width' })]),
  ];
});

describe('Popover on the server', () => {
  it('renders a closed popover that assumes the Popover API', async () => {
    const result = await html(SizePicker);
    const root = result.match(/<div[^>]*>/)![0];
    expect(root).toContain('popover="manual"');
    expect(root).toContain('role="dialog"');
    expect(root).toContain('tabindex="-1"');
    expect(root).not.toMatch(/\shidden[\s=>]/);
    // Only rendered parts are referenced, which is known after mount.
    expect(root).not.toContain('aria-labelledby');
    const trigger = result.match(/<button[^>]*>/)![0];
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('type="button"');
  });
});

const FRUIT = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
];

interface Handle {
  getItemProps(part: 'option', key: string): Record<string, unknown>;
}

const options = (ui: Handle) =>
  FRUIT.map((item) =>
    h(
      'li',
      {
        key: item.key,
        'data-key': item.key,
        ...ui.getItemProps('option', item.key),
      },
      item.textValue,
    ),
  );

const FruitList = defineComponent(() => {
  const ui = useComponent(listbox, {
    items: FRUIT,
    defaultValue: ['banana'],
    listId: 'fruit',
  });
  return () =>
    h('div', ui.parts.root, [
      h('span', ui.parts.label, 'Fruit'),
      h('ul', ui.parts.list, options(ui)),
      h('p', ui.parts.empty, 'No fruit'),
    ]);
});

describe('Listbox on the server', () => {
  it('renders its options, the selection and the tab stop', async () => {
    const result = await html(FruitList);
    const [apple, banana] = result.match(/<li[^>]*>/g)!;
    expect(apple).toContain('id="fruit-option-apple"');
    expect(apple).toContain('role="option"');
    expect(apple).toContain('aria-selected="false"');
    expect(apple).toContain('tabindex="-1"');
    expect(apple).toContain('data-element="Option"');
    expect(banana).toContain('aria-selected="true"');
    expect(banana).toContain('tabindex="0"');
    const list = result.match(/<ul[^>]*>/)![0];
    expect(list).toContain('role="listbox"');
    expect(list).toContain('id="fruit"');
    expect(list).toContain('tabindex="-1"');
    expect(list).toContain('data-element="List"');
    const root = result.match(/<div[^>]*>/)![0];
    expect(root).toContain('data-uni="listbox"');
    expect(root).not.toContain('data-element');
    expect(result.match(/<p[^>]*>/)![0]).toMatch(/\shidden[\s=>]/);
  });
});

const FruitSelect = defineComponent(() => {
  const ui = useComponent(select, {
    items: FRUIT,
    defaultValue: ['banana'],
    triggerId: 'pick',
    listId: 'fruit',
  });
  return () =>
    h('div', ui.parts.root, [
      h('span', ui.parts.label, 'Fruit'),
      h('button', ui.parts.trigger, [h('span', ui.parts.value)]),
      h('div', ui.parts.popover, [h('ul', ui.parts.list, options(ui))]),
      h('select', { ...ui.parts.hiddenSelect, name: 'fruit' }),
    ]);
});

describe('Select on the server', () => {
  it('renders the trigger, the hidden popover with its options and the hidden select', async () => {
    const result = await html(FruitSelect);
    const trigger = result.match(/<button[^>]*>/)![0];
    expect(trigger).toContain('id="pick"');
    expect(trigger).toContain('role="combobox"');
    expect(trigger).toContain('aria-haspopup="listbox"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('aria-controls="fruit"');
    const panel = result.match(/<div[^>]*popover[^>]*>/)![0];
    expect(panel).toContain('popover="manual"');
    expect(panel).not.toContain('role=');
    expect(panel).not.toContain('tabindex=');
    const [, banana] = result.match(/<li[^>]*>/g)!;
    expect(banana).toContain('aria-selected="true"');
    const hidden = result.match(/<select[^>]*>/)![0];
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).toContain('tabindex="-1"');
  });
});

const FruitCombobox = defineComponent(() => {
  const ui = useComponent(combobox, {
    items: FRUIT,
    defaultValue: ['banana'],
    inputId: 'pick',
    listId: 'fruit',
  });
  return () =>
    h('div', ui.parts.root, [
      h('label', ui.parts.label, 'Fruit'),
      h('input', ui.parts.input),
      h('button', ui.parts.button, '▾'),
      h('div', ui.parts.popover, [h('ul', ui.parts.list, options(ui))]),
      h('input', { ...ui.parts.hiddenInput, name: 'fruit' }),
    ]);
});

describe('Combobox on the server', () => {
  it("renders the input with the value's text, the hidden popover and the hidden input", async () => {
    const result = await html(FruitCombobox);
    const [input, hidden] = result.match(/<input[^>]*>/g)!;
    expect(input).toContain('id="pick"');
    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-autocomplete="list"');
    expect(input).toContain('aria-expanded="false"');
    expect(input).toContain('aria-controls="fruit"');
    expect(input).toContain('value="Banana"');
    expect(input).not.toContain('aria-activedescendant');
    expect(result).toContain('for="pick"');
    const toggle = result.match(/<button[^>]*>/)![0];
    expect(toggle).toContain('tabindex="-1"');
    expect(toggle).toContain('aria-label="Show suggestions"');
    const panel = result.match(/<div[^>]*popover[^>]*>/)![0];
    expect(panel).toContain('popover="manual"');
    expect(panel).not.toContain('role=');
    const [, banana] = result.match(/<li[^>]*>/g)!;
    expect(banana).toContain('aria-selected="true"');
    expect(banana).not.toContain('tabindex');
    expect(hidden).toContain('type="hidden"');
    expect(hidden).toContain('value="banana"');
  });
});
