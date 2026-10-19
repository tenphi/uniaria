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
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OwnerProvider } from './owner';
import { useComponent, useComponentState } from './use-component';

function Docs({ isDisabled = false }: { readonly isDisabled?: boolean }) {
  const ui = useComponent(button, { href: '/docs', isDisabled });
  const isUnavailable = useComponentState(ui, (state) => state.isDisabled);
  return (
    <a {...ui.parts.root} title={isUnavailable ? 'Unavailable' : undefined}>
      Docs
    </a>
  );
}

describe('server rendering without a DOM', () => {
  it('renders the attributes UniAria owns and no handlers', () => {
    const html = renderToString(<Docs />);
    expect(html).toBe(
      '<a href="/docs" tabindex="0" class="uni-button">Docs</a>',
    );
  });

  it('renders state read through a selector', () => {
    const html = renderToString(<Docs isDisabled />);
    expect(html).toContain('role="link"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('title="Unavailable"');
    expect(html).not.toContain('href');
  });
});

function Email() {
  const ui = useComponent(field, { isInvalid: true, controlId: 'email' });
  return (
    <div {...ui.parts.root}>
      <label {...ui.parts.label}>Email</label>
      <input {...ui.parts.control} />
      <p {...ui.parts.error}>Enter a valid email</p>
    </div>
  );
}

describe('Field on the server', () => {
  it('renders ids and the label for, and links the rest on hydration', () => {
    const html = renderToString(<Email />);
    expect(html).toContain('for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain('aria-invalid="true"');
    // Only rendered parts are referenced, which is known after commit.
    expect(html).not.toContain('aria-labelledby');
    expect(html).not.toContain('aria-describedby');
  });
});

function Name() {
  const ui = useComponent(textField, { defaultValue: 'Jane', inputId: 'name' });
  return (
    <div {...ui.parts.root}>
      <label {...ui.parts.label}>Name</label>
      <input {...ui.parts.input} />
    </div>
  );
}

describe('TextField on the server', () => {
  it('renders the starting value and the label for', () => {
    const html = renderToString(<Name />);
    expect(html).toContain('value="Jane"');
    expect(html).toContain('for="name"');
    expect(html).toContain('id="name"');
  });
});

function Terms() {
  const ui = useComponent(checkbox, {
    defaultSelected: true,
    labelElementType: 'span',
  });
  return (
    <label {...ui.parts.root}>
      <input {...ui.parts.input} name="terms" />
      <span {...ui.parts.indicator} />
      <span {...ui.parts.label}>Accept terms</span>
    </label>
  );
}

describe('Checkbox on the server', () => {
  it('renders a checkbox in its starting state', () => {
    const html = renderToString(<Terms />);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-selected=""');
    expect(html).not.toContain('aria-checked');
  });
});

function Wifi() {
  const ui = useComponent(toggleSwitch, {
    defaultSelected: true,
    labelElementType: 'span',
  });
  return (
    <label {...ui.parts.root}>
      <input {...ui.parts.input} name="wifi" />
      <span {...ui.parts.indicator} />
      <span {...ui.parts.label}>Wi-Fi</span>
    </label>
  );
}

describe('Switch on the server', () => {
  it('renders a switch in its starting state', () => {
    const html = renderToString(<Wifi />);
    expect(html).toMatch(/<input[^>]*role="switch"/);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain('data-scope="switch"');
    expect(html).not.toContain('aria-checked');
  });
});

function PlanOption({
  value,
  children,
}: {
  readonly value: string;
  readonly children: string;
}) {
  const ui = useComponent(radio, { value, labelElementType: 'span' });
  return (
    <label {...ui.parts.root}>
      <input {...ui.parts.input} />
      <span {...ui.parts.label}>{children}</span>
    </label>
  );
}

function Plan() {
  const ui = useComponent(radioGroup, { defaultValue: 'pro', name: 'plan' });
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Plan</span>
      <OwnerProvider owner={ui}>
        <PlanOption value="free">Free</PlanOption>
        <PlanOption value="pro">Pro</PlanOption>
      </OwnerProvider>
    </div>
  );
}

describe('RadioGroup on the server', () => {
  it("renders its radios with the group's name and value", () => {
    const html = renderToString(<Plan />);
    expect(html).toContain('role="radiogroup"');
    const radios = html.match(/<input[^>]*>/g)!;
    expect(radios).toHaveLength(2);
    for (const input of radios) {
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="plan"');
    }
    expect(radios[0]).toContain('value="free"');
    expect(radios[0]).not.toContain('checked');
    expect(radios[1]).toContain('checked=""');
    expect(html).not.toContain('aria-checked');
  });
});

function Confirm() {
  const ui = useComponent(dialog, { defaultOpen: true });
  return (
    <>
      <button {...ui.parts.trigger}>Delete file</button>
      <dialog {...ui.parts.root}>
        <h2 {...ui.parts.title}>Delete file</h2>
        <button {...ui.parts.close}>Cancel</button>
      </dialog>
    </>
  );
}

describe('Dialog on the server', () => {
  it('renders a closed dialog, even one open by default', () => {
    const html = renderToString(<Confirm />);
    const tag = html.match(/<dialog[^>]*>/)![0];
    // `open` would open it non-modally; it opens after hydration.
    expect(tag).not.toMatch(/\sopen[\s=>]/);
    expect(tag).toContain('tabindex="-1"');
    // Only rendered parts are referenced, which is known after commit.
    expect(tag).not.toContain('aria-labelledby');
    expect(html).toContain('type="button"');
  });
});

function SizePicker() {
  const ui = useComponent(popover, {});
  return (
    <>
      <button {...ui.parts.trigger}>Size</button>
      <div {...ui.parts.root}>
        <input aria-label="Width" />
      </div>
    </>
  );
}

describe('Popover on the server', () => {
  it('renders a closed popover that assumes the Popover API', () => {
    const html = renderToString(<SizePicker />);
    const root = html.match(/<div[^>]*>/)![0];
    expect(root).toContain('popover="manual"');
    expect(root).toContain('role="dialog"');
    expect(root).toContain('tabindex="-1"');
    expect(root).not.toMatch(/\shidden[\s=>]/);
    // Only rendered parts are referenced, which is known after commit.
    expect(root).not.toContain('aria-labelledby');
    const trigger = html.match(/<button[^>]*>/)![0];
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('type="button"');
  });
});

const FRUIT = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
];

function FruitList() {
  const ui = useComponent(listbox, {
    items: FRUIT,
    defaultValue: ['banana'],
    listId: 'fruit',
  });
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Fruit</span>
      <ul {...ui.parts.list}>
        {FRUIT.map((item) => (
          <li
            key={item.key}
            data-key={item.key}
            {...ui.getItemProps('option', item.key)}
          >
            {item.textValue}
          </li>
        ))}
      </ul>
      <p {...ui.parts.empty}>No fruit</p>
    </div>
  );
}

describe('Listbox on the server', () => {
  it('renders its options, the selection and the tab stop', () => {
    const html = renderToString(<FruitList />);
    const [apple, banana] = html.match(/<li[^>]*>/g)!;
    expect(apple).toContain('id="fruit-option-apple"');
    expect(apple).toContain('role="option"');
    expect(apple).toContain('aria-selected="false"');
    expect(apple).toContain('tabindex="-1"');
    expect(apple).toContain('data-scope="listbox"');
    expect(apple).toContain('data-element="Option"');
    expect(banana).toContain('aria-selected="true"');
    expect(banana).toContain('tabindex="0"');
    const list = html.match(/<ul[^>]*>/)![0];
    expect(list).toContain('role="listbox"');
    expect(list).toContain('id="fruit"');
    expect(list).toContain('tabindex="-1"');
    expect(list).toContain('data-element="List"');
    const root = html.match(/<div[^>]*>/)![0];
    expect(root).toContain('class="uni-listbox"');
    expect(root).not.toContain('data-scope');
    expect(root).not.toContain('data-element');
    expect(html.match(/<p[^>]*>/)![0]).toMatch(/\shidden[\s=>]/);
  });
});

function FruitSelect() {
  const ui = useComponent(select, {
    items: FRUIT,
    defaultValue: ['banana'],
    triggerId: 'pick',
    listId: 'fruit',
  });
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Fruit</span>
      <button {...ui.parts.trigger}>
        <span {...ui.parts.value} />
      </button>
      <div {...ui.parts.popover}>
        <ul {...ui.parts.list}>
          {FRUIT.map((item) => (
            <li
              key={item.key}
              data-key={item.key}
              {...ui.getItemProps('option', item.key)}
            >
              {item.textValue}
            </li>
          ))}
        </ul>
      </div>
      <select {...ui.parts.hiddenSelect} name="fruit" />
    </div>
  );
}

describe('Select on the server', () => {
  it('renders the trigger, the hidden popover with its options and the hidden select', () => {
    const html = renderToString(<FruitSelect />);
    const trigger = html.match(/<button[^>]*>/)![0];
    expect(trigger).toContain('id="pick"');
    expect(trigger).toContain('role="combobox"');
    expect(trigger).toContain('aria-haspopup="listbox"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('aria-controls="fruit"');
    const popover = html.match(/<div[^>]*popover[^>]*>/)![0];
    expect(popover).toContain('popover="manual"');
    expect(popover).not.toContain('role=');
    expect(popover).not.toContain('tabindex=');
    const [, banana] = html.match(/<li[^>]*>/g)!;
    expect(banana).toContain('aria-selected="true"');
    const hidden = html.match(/<select[^>]*>/)![0];
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).toContain('tabindex="-1"');
  });
});

function FruitCombobox() {
  const ui = useComponent(combobox, {
    items: FRUIT,
    defaultValue: ['banana'],
    inputId: 'pick',
    listId: 'fruit',
  });
  return (
    <div {...ui.parts.root}>
      <label {...ui.parts.label}>Fruit</label>
      <input {...ui.parts.input} />
      <button {...ui.parts.button}>▾</button>
      <div {...ui.parts.popover}>
        <ul {...ui.parts.list}>
          {FRUIT.map((item) => (
            <li
              key={item.key}
              data-key={item.key}
              {...ui.getItemProps('option', item.key)}
            >
              {item.textValue}
            </li>
          ))}
        </ul>
      </div>
      <input {...ui.parts.hiddenInput} name="fruit" />
    </div>
  );
}

describe('Combobox on the server', () => {
  it("renders the input with the value's text, the hidden popover and the hidden input", () => {
    const html = renderToString(<FruitCombobox />);
    const [input, hidden] = html.match(/<input[^>]*>/g)!;
    expect(input).toContain('id="pick"');
    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-autocomplete="list"');
    expect(input).toContain('aria-expanded="false"');
    expect(input).toContain('aria-controls="fruit"');
    expect(input).toContain('value="Banana"');
    expect(input).not.toContain('aria-activedescendant');
    expect(html).toContain('for="pick"');
    const button = html.match(/<button[^>]*>/)![0];
    expect(button).toContain('tabindex="-1"');
    expect(button).toContain('aria-label="Show suggestions"');
    const popover = html.match(/<div[^>]*popover[^>]*>/)![0];
    expect(popover).toContain('popover="manual"');
    expect(popover).not.toContain('role=');
    const [, banana] = html.match(/<li[^>]*>/g)!;
    expect(banana).toContain('aria-selected="true"');
    expect(banana).not.toContain('tabindex');
    expect(hidden).toContain('type="hidden"');
    expect(hidden).toContain('value="banana"');
  });
});
