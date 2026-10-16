import { bindable, defineComponent, prop } from '@tenphi/sous';
import type { dialog } from '@tenphi/sous/dialog';
import { announce, destroyAnnouncer } from '@tenphi/sous/dom';
import { field } from '@tenphi/sous/field';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import './button';
import './field';
import './text-field';
import './checkbox';
import './checkbox-group';
import './switch';
import './radio';
import './radio-group';
import './dialog';
import { defineElement } from './define-element';
import type { SousElement } from './define-element';

/** A disclosure with a bindable and props of every attribute type. */
const disclosure = defineComponent({
  name: 'test-disclosure',
  parts: ['trigger', 'panel'],
  props: {
    isOpen: bindable(false),
    isDisabled: prop(false),
    isDismissable: prop(true),
    delay: prop(0),
    label: prop<string | undefined>(undefined),
    options: prop<{ isModal: boolean } | undefined>(undefined, {
      type: 'json',
    }),
  },
  setup(ctx) {
    return {
      toggle: () => {
        if (!ctx.props.isDisabled()) {
          ctx.props.isOpen.set(!ctx.props.isOpen.get());
        }
      },
    };
  },
  expose: ({ props }) => ({
    isOpen: props.isOpen.get(),
    isDisabled: props.isDisabled(),
    isDismissable: props.isDismissable(),
    delay: props.delay(),
    label: props.label(),
    options: props.options(),
  }),
  connect: ({ props, api }) => ({
    trigger: {
      attrs: { 'aria-expanded': String(props.isOpen.get()) },
      on: { click: api.toggle },
    },
    panel: { attrs: { hidden: props.isOpen.get() ? undefined : '' } },
  }),
});

type Disclosure = SousElement<typeof disclosure>;

defineElement(disclosure);

const MARKUP = `
  <button data-part="trigger">Details</button>
  <div data-part="panel">Content</div>`;

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

function disclosureIn(container: HTMLElement) {
  const host = container.querySelector<Disclosure>('sous-test-disclosure')!;
  const trigger = host.querySelector<HTMLElement>('[data-part="trigger"]')!;
  const panel = host.querySelector<HTMLElement>('[data-part="panel"]')!;
  return { host, trigger, panel };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('defineElement', () => {
  it('returns the registered class instead of defining twice', () => {
    const first = customElements.get('sous-test-disclosure');
    expect(defineElement(disclosure)).toBe(first);
  });

  it('takes a prefix or a full name', () => {
    const Prefixed = defineElement(disclosure, { prefix: 'ui' });
    const Named = defineElement(disclosure, { name: 'my-disclosure' });
    expect(customElements.get('ui-test-disclosure')).toBe(Prefixed);
    expect(customElements.get('my-disclosure')).toBe(Named);
  });

  it('writes part attributes on upgrade and keeps the consumer markup', () => {
    const container = mount(
      `<sous-test-disclosure>${MARKUP}</sous-test-disclosure>`,
    );
    const { host, trigger, panel } = disclosureIn(container);
    expect(host.shadowRoot).toBeNull();
    expect(trigger.getAttribute('data-scope')).toBe('test-disclosure');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(trigger.textContent).toBe('Details');
  });

  it('converts attributes to props', () => {
    const container = mount(
      `<sous-test-disclosure disabled delay="300" label="More" options='{"isModal":true}'>${MARKUP}</sous-test-disclosure>`,
    );
    const { host } = disclosureIn(container);
    expect(host.instance.getState()).toMatchObject({
      isDisabled: true,
      delay: 300,
      label: 'More',
      options: { isModal: true },
    });
    expect(host.isDisabled).toBe(true);

    host.removeAttribute('disabled');
    expect(host.instance.getState().isDisabled).toBe(false);
    expect(host.isDisabled).toBe(false);
  });

  // Dialog spec, Resolved questions 4: presence alone can't turn off a prop
  // that is on by default.
  it('reads "false" as false only for a boolean that defaults to true', () => {
    const container = mount(
      `<sous-test-disclosure disabled="false">${MARKUP}</sous-test-disclosure>`,
    );
    const { host } = disclosureIn(container);
    const state = () => host.instance.getState();
    expect(state()).toMatchObject({ isDisabled: true, isDismissable: true });

    host.setAttribute('dismissable', 'false');
    expect(state().isDismissable).toBe(false);
    host.setAttribute('dismissable', '');
    expect(state().isDismissable).toBe(true);
    host.setAttribute('dismissable', 'false');
    host.removeAttribute('dismissable');
    expect(state().isDismissable).toBe(true);
  });

  describe('bindables', () => {
    it('seeds an uncontrolled value from default-<key> and reports changes', () => {
      const container = mount(
        `<sous-test-disclosure default-open>${MARKUP}</sous-test-disclosure>`,
      );
      const { host, trigger, panel } = disclosureIn(container);
      const onChange = vi.fn();
      container.addEventListener('openchange', (event) =>
        onChange((event as CustomEvent).detail),
      );
      expect(panel.hasAttribute('hidden')).toBe(false);

      trigger.click();

      expect(onChange).toHaveBeenCalledWith(false);
      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(host.instance.getState().isOpen).toBe(false);
    });

    it('only requests changes when the property controls it', () => {
      const container = mount(
        `<sous-test-disclosure>${MARKUP}</sous-test-disclosure>`,
      );
      const { host, trigger } = disclosureIn(container);
      host.isOpen = false;
      const onChange = vi.fn();
      host.addEventListener('openchange', (event) =>
        onChange((event as CustomEvent).detail),
      );

      trigger.click();
      expect(onChange).toHaveBeenCalledWith(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      host.isOpen = true;
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('dispatches events that bubble and are not composed', () => {
    const container = mount(
      `<sous-test-disclosure>${MARKUP}</sous-test-disclosure>`,
    );
    const { trigger } = disclosureIn(container);
    const events: CustomEvent[] = [];
    container.addEventListener('openchange', (event) =>
      events.push(event as CustomEvent),
    );
    trigger.click();
    expect(events).toHaveLength(1);
    expect(events[0]!.bubbles).toBe(true);
    expect(events[0]!.composed).toBe(false);
  });

  it('re-applies properties set before the element was defined', () => {
    const late = defineComponent({
      name: 'test-late',
      parts: ['root'],
      props: { delay: prop(0) },
      setup: () => ({}),
      expose: ({ props }) => ({ delay: props.delay() }),
      connect: ({ props }) => ({
        root: { attrs: { 'data-delay': String(props.delay()) } },
      }),
    });
    const container = mount(
      '<sous-test-late><span data-part="root"></span></sous-test-late>',
    );
    const host = container.querySelector('sous-test-late')!;
    (host as unknown as { delay: number }).delay = 200;

    defineElement(late);

    expect(host.querySelector('span')!.getAttribute('data-delay')).toBe('200');
  });

  it('leaves the parts of a nested instance to that instance', () => {
    const container = mount(`
      <sous-test-disclosure id="outer">
        <button data-part="trigger">Outer</button>
        <div data-part="panel">
          <sous-test-disclosure id="inner">${MARKUP}</sous-test-disclosure>
        </div>
      </sous-test-disclosure>`);
    const outer = container.querySelector<Disclosure>('#outer')!;
    const inner = container.querySelector<Disclosure>('#inner')!;
    const innerTrigger = inner.querySelector<HTMLElement>(
      '[data-part="trigger"]',
    )!;

    innerTrigger.click();

    expect(inner.instance.getState().isOpen).toBe(true);
    expect(outer.instance.getState().isOpen).toBe(false);
    expect(outer.instance.element('trigger')).not.toBe(innerTrigger);
  });

  it('leaves the parts inside a nested Sous element of another kind to it', () => {
    const wrapper = defineComponent({
      name: 'test-wrapper',
      parts: ['trigger'],
      props: {},
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ trigger: { attrs: {} } }),
    });
    defineElement(wrapper);
    const container = mount(`
      <sous-test-disclosure>
        <sous-test-wrapper>
          <button data-part="trigger">Inner</button>
        </sous-test-wrapper>
        <sous-test-wrapper data-part="panel"></sous-test-wrapper>
      </sous-test-disclosure>`);
    const host = container.querySelector<Disclosure>('sous-test-disclosure')!;
    const [inner, panel] = host.querySelectorAll('sous-test-wrapper');

    expect(host.instance.element('trigger')).toBeNull();
    expect(inner!.querySelector('button')!.getAttribute('data-scope')).toBe(
      'test-wrapper',
    );
    // A nested Sous element can still be one of the outer host's parts.
    expect(host.instance.element('panel')).toBe(panel);
  });

  it('finds parts added after it connected', async () => {
    const container = mount(
      '<sous-test-disclosure><button data-part="trigger">Details</button></sous-test-disclosure>',
    );
    const { host } = disclosureIn(container);
    const panel = document.createElement('div');
    panel.setAttribute('data-part', 'panel');
    host.append(panel);

    await new Promise((resolve) => setTimeout(resolve));

    expect(panel.getAttribute('data-scope')).toBe('test-disclosure');
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('stops on disconnect and resumes when connected again', () => {
    const container = mount(
      `<sous-test-disclosure>${MARKUP}</sous-test-disclosure>`,
    );
    const { host, trigger } = disclosureIn(container);
    host.remove();
    trigger.click();
    expect(host.instance.getState().isOpen).toBe(false);

    container.append(host);
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('adopts a live property into a bindable default before upgrade', () => {
    const live = defineComponent({
      name: 'test-live',
      parts: ['input'],
      props: {
        value: bindable('', { adopt: { part: 'input', property: 'value' } }),
      },
      setup: () => ({}),
      expose: ({ props }) => ({
        value: props.value.get(),
        isControlled: props.value.isControlled(),
      }),
      connect: ({ props }) => ({
        input: { attrs: {}, properties: { value: props.value.get() } },
      }),
    });
    const container = mount(
      '<sous-test-live><input data-part="input" value="jane" /></sous-test-live>',
    );
    const input = container.querySelector('input')!;
    // Typed before the element is defined.
    input.value = 'jane doe';

    defineElement(live);

    const host =
      container.querySelector<SousElement<typeof live>>('sous-test-live')!;
    expect(host.instance.getState()).toEqual({
      value: 'jane doe',
      isControlled: false,
    });
    expect(host.defaultValue).toBe('jane doe');
    expect(input.value).toBe('jane doe');
  });

  it('refuses props that would shadow element properties', () => {
    const shadowing = defineComponent({
      name: 'test-shadowing',
      parts: ['root'],
      props: { hidden: prop(false) },
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({ root: { attrs: {} } }),
    });
    expect(() => defineElement(shadowing)).toThrow(/shadow/);
  });
});

describe('<sous-button>', () => {
  it('adopts the root tag and its href', () => {
    const container = mount(`
      <sous-button id="div"><div data-part="root">Save</div></sous-button>
      <sous-button id="link"><a data-part="root" href="/docs">Docs</a></sous-button>`);
    const div = container.querySelector('#div [data-part="root"]')!;
    const link = container.querySelector<HTMLElement>(
      '#link [data-part="root"]',
    )!;
    const host = container.querySelector<SousElement<never>>('#link')!;
    expect(div.getAttribute('role')).toBe('button');
    expect(link.getAttribute('href')).toBe('/docs');
    expect(link.hasAttribute('role')).toBe(false);

    (host as unknown as { isDisabled: boolean }).isDisabled = true;
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('role')).toBe('link');

    (host as unknown as { isDisabled: boolean }).isDisabled = false;
    expect(link.getAttribute('href')).toBe('/docs');
  });

  it('shares its DOM with React without either one undoing the other', () => {
    const container = mount('');
    const root = createRoot(container);
    const render = (label: string, isDisabled: boolean) =>
      flushSync(() =>
        root.render(
          createElement(
            'sous-button',
            { isDisabled },
            createElement(
              'button',
              { 'data-part': 'root', className: label },
              label,
            ),
          ),
        ),
      );

    render('Save', true);
    const button = container.querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('data-scope')).toBe('button');

    render('Saving', false);
    expect(button.textContent).toBe('Saving');
    expect(button.className).toBe('Saving');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('data-scope')).toBe('button');
    expect(button.getAttribute('type')).toBe('button');
    root.unmount();
  });
});

describe('<sous-field>', () => {
  it("adopts the control's id and the label's tag", () => {
    const container = mount(`
      <sous-field>
        <span data-part="label">Plan</span>
        <div data-part="control" id="plan" role="radiogroup"></div>
      </sous-field>`);
    const host =
      container.querySelector<SousElement<typeof field>>('sous-field')!;
    const label = host.querySelector('[data-part="label"]')!;
    const control = host.querySelector('[data-part="control"]')!;
    expect(host.controlId).toBe('plan');
    expect(host.labelElementType).toBe('span');
    expect(control.id).toBe('plan');
    expect(label.hasAttribute('for')).toBe(false);
    expect(control.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('leaves a Sous input inside it alone and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const textInput = defineComponent({
      name: 'test-text-input',
      parts: ['root', 'label', 'input', 'description', 'error'],
      props: {},
      setup: (ctx) => ({
        field: ctx.use(field, () => ({}), { parts: { control: 'input' } }),
      }),
      expose: () => ({}),
      connect: ({ api }) => {
        const { control, ...parts } = api.field.connect();
        return { ...parts, input: control };
      },
    });
    defineElement(textInput);
    const container = mount(`
      <sous-field>
        <label data-part="label">Email</label>
        <sous-test-text-input>
          <label data-part="label">Work email</label>
          <input data-part="input" />
        </sous-test-text-input>
      </sous-field>`);
    const [outer, inner] = container.querySelectorAll('label');
    const input = container.querySelector('input')!;

    expect(input.getAttribute('aria-labelledby')).toBe(inner!.id);
    expect(outer!.getAttribute('for')).not.toBe(input.id);
    await new Promise((resolve) => setTimeout(resolve));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('without a control part'),
    );
    warn.mockRestore();
  });
});

describe('<sous-text-field>', () => {
  it('takes the markup value as its default and the readonly attribute', () => {
    const container = mount(`
      <sous-text-field readonly>
        <label data-part="label">Name</label>
        <input data-part="input" value="Jane" />
      </sous-text-field>`);
    const host = container.querySelector('sous-text-field')!;
    const input = host.querySelector('input')!;
    expect(host.instance.getState()).toMatchObject({
      value: 'Jane',
      isReadOnly: true,
    });
    expect(host.defaultValue).toBe('Jane');
    expect(input.value).toBe('Jane');
    expect(input.readOnly).toBe(true);
  });
});

describe('<sous-checkbox>', () => {
  it('takes the markup checked state as its default and reads the label tag', () => {
    const container = mount(`
      <sous-checkbox readonly>
        <label data-part="root">
          <input data-part="input" type="checkbox" checked />
          <span data-part="label">Accept terms</span>
        </label>
      </sous-checkbox>`);
    const host = container.querySelector('sous-checkbox')!;
    const input = host.querySelector('input')!;
    const label = host.querySelector('span')!;
    expect(host.instance.getState()).toMatchObject({
      isSelected: true,
      isReadOnly: true,
    });
    expect(host.defaultSelected).toBe(true);
    expect(input.checked).toBe(true);
    expect(input.getAttribute('aria-readonly')).toBe('true');
    // A span label inside the label root: linked, with no `for`.
    expect(input.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('keeps a click made before upgrade', () => {
    const container = mount(`
      <div>
        <input data-part="input" type="checkbox" />
        <label data-part="label">News</label>
      </div>`);
    const markup = container.firstElementChild!;
    (markup.querySelector('input') as HTMLInputElement).click();
    const host = document.createElement('sous-checkbox');
    host.append(markup);
    container.append(host);
    expect(host.instance.getState().isSelected).toBe(true);
    expect(host.querySelector('input')!.checked).toBe(true);
  });

  it('takes indeterminate as an attribute', () => {
    const container = mount(`
      <sous-checkbox indeterminate>
        <input data-part="input" type="checkbox" />
      </sous-checkbox>`);
    const host = container.querySelector('sous-checkbox')!;
    expect(host.isIndeterminate).toBe(true);
    expect(host.querySelector('input')!.indeterminate).toBe(true);
  });
});

describe('<sous-checkbox-group>', () => {
  const option = (value: string, extra = '') => `
    <sous-checkbox value="${value}" ${extra}>
      <label data-part="root">
        <input data-part="input" type="checkbox" ${value === 'sms' ? 'checked' : ''} />
        <span data-part="label">${value}</span>
      </label>
    </sous-checkbox>`;

  it('takes the checkboxes checked in the markup as its default', () => {
    const container = mount(`
      <sous-checkbox-group>
        <div data-part="root">
          <span data-part="label">Notify</span>
          ${option('email')}${option('sms')}
        </div>
      </sous-checkbox-group>`);
    const group = container.querySelector('sous-checkbox-group')!;
    const [email, sms] = Array.from(container.querySelectorAll('input'));
    expect(group.instance.getState().value).toEqual(['sms']);
    expect(email!.value).toBe('email');
    expect(sms!.checked).toBe(true);

    const changes: unknown[] = [];
    group.addEventListener('valuechange', (event) =>
      changes.push((event as CustomEvent).detail),
    );
    email!.click();
    expect(changes).toEqual([['sms', 'email']]);
    expect(group.instance.getState().value).toEqual(['sms', 'email']);
  });

  it('links a checkbox by id, to a group that comes later', () => {
    const container = mount(option('email', 'group="notify"'));
    const box = container.querySelector('sous-checkbox')!;
    expect(box.instance.owner()).toBeUndefined();

    const group = document.createElement('sous-checkbox-group');
    group.id = 'notify';
    group.defaultValue = ['email'];
    group.innerHTML = '<div data-part="root"></div>';
    container.append(group);
    expect(box.instance.owner()).toBe(group.instance);
    expect(box.querySelector('input')!.checked).toBe(true);
  });

  it('leaves the group when moved out of it', () => {
    const container = mount(`
      <sous-checkbox-group>
        <div data-part="root">${option('email')}</div>
      </sous-checkbox-group>`);
    const box = container.querySelector('sous-checkbox')!;
    expect(box.instance.owner()).toBeDefined();
    container.append(box);
    expect(box.instance.owner()).toBeUndefined();
  });
});

describe('<sous-switch>', () => {
  it('takes the markup checked state as its default and sets its role', () => {
    const container = mount(`
      <sous-switch readonly>
        <label data-part="root">
          <input data-part="input" type="checkbox" checked />
          <span data-part="indicator"><span class="thumb"></span></span>
          <span data-part="label">Wi-Fi</span>
        </label>
      </sous-switch>`);
    const host = container.querySelector('sous-switch')!;
    const input = host.querySelector('input')!;
    expect(host.instance.getState()).toMatchObject({
      isSelected: true,
      isReadOnly: true,
    });
    expect(host.defaultSelected).toBe(true);
    expect(input.checked).toBe(true);
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.getAttribute('aria-readonly')).toBe('true');
    expect(
      host
        .querySelector('[data-part="indicator"]')!
        .hasAttribute('data-selected'),
    ).toBe(true);
  });

  it('never joins a checkbox group around it', () => {
    const container = mount(`
      <sous-checkbox-group>
        <div data-part="root">
          <sous-switch>
            <label data-part="root">
              <input data-part="input" type="checkbox" checked />
              <span data-part="label">Wi-Fi</span>
            </label>
          </sous-switch>
        </div>
      </sous-checkbox-group>`);
    const group = container.querySelector('sous-checkbox-group')!;
    const host = container.querySelector('sous-switch')!;
    expect(host.instance.owner()).toBeUndefined();
    expect(group.instance.getState().value).toEqual([]);
    host.querySelector('input')!.click();
    expect(host.instance.getState().isSelected).toBe(false);
    expect(group.instance.getState().value).toEqual([]);
  });
});

describe('<sous-radio-group>', () => {
  const option = (value: string, extra = '') => `
    <sous-radio value="${value}" ${extra}>
      <label data-part="root">
        <input data-part="input" type="radio" ${value === 'pro' ? 'checked' : ''} />
        <span data-part="label">${value}</span>
      </label>
    </sous-radio>`;

  it('takes the radio checked in the markup as its default and names its radios', () => {
    const container = mount(`
      <sous-radio-group name="plan">
        <div data-part="root">
          <span data-part="label">Plan</span>
          ${option('free')}${option('pro')}
        </div>
      </sous-radio-group>`);
    const group = container.querySelector('sous-radio-group')!;
    const [free, pro] = Array.from(container.querySelectorAll('input'));
    expect(group.instance.getState().value).toBe('pro');
    expect([free!.name, pro!.name]).toEqual(['plan', 'plan']);
    expect([free!.value, pro!.value]).toEqual(['free', 'pro']);
    expect(pro!.checked).toBe(true);
    expect([free!.tabIndex, pro!.tabIndex]).toEqual([-1, 0]);

    const changes: unknown[] = [];
    group.addEventListener('valuechange', (event) =>
      changes.push((event as CustomEvent).detail),
    );
    free!.click();
    expect(changes).toEqual(['free']);
    expect([free!.tabIndex, pro!.tabIndex]).toEqual([0, -1]);
  });

  it('gives each radio its own state and focuschange', () => {
    const container = mount(`
      <sous-radio-group>
        <div data-part="root">${option('free')}${option('pro')}</div>
      </sous-radio-group>`);
    const [free, pro] = Array.from(container.querySelectorAll('sous-radio'));
    expect(pro!.instance.getState()).toMatchObject({
      isSelected: true,
      isFocused: false,
      isDisabled: false,
      isReadOnly: false,
      isInvalid: false,
    });
    expect(free!.instance.getState().isSelected).toBe(false);
    // Read-only and invalid are the group's.
    const group = container.querySelector('sous-radio-group')!;
    group.setAttribute('readonly', '');
    group.setAttribute('invalid', '');
    expect(free!.instance.getState()).toMatchObject({
      isReadOnly: true,
      isInvalid: true,
    });

    const focus: unknown[] = [];
    free!.addEventListener('focuschange', (event) =>
      focus.push((event as CustomEvent).detail),
    );
    const input = free!.querySelector('input')!;
    input.focus();
    expect(free!.instance.getState().isFocused).toBe(true);
    input.blur();
    expect(focus).toEqual([true, false]);
  });

  it('links a radio by id, to a group that comes later', () => {
    const container = mount(
      option('free', 'group="plan"').replace(
        'type="radio"',
        'type="radio" name="legacy"',
      ),
    );
    const host = container.querySelector('sous-radio')!;
    const input = host.querySelector('input')!;
    expect(host.instance.owner()).toBeUndefined();
    // Until it links, the markup's name stays.
    expect(input.name).toBe('legacy');

    const group = document.createElement('sous-radio-group');
    group.id = 'plan';
    group.defaultValue = 'free';
    group.innerHTML = '<div data-part="root"></div>';
    container.append(group);
    expect(host.instance.owner()).toBe(group.instance);
    expect(input.checked).toBe(true);
    // No name prop: the group's root id, unique on the page.
    expect(input.name).toBe(group.querySelector('[data-part="root"]')!.id);
  });
});

describe('<sous-dialog>', () => {
  const DIALOG = `
    <button data-part="trigger">Delete file</button>
    <dialog data-part="root" role="alertdialog">
      <h2 data-part="title">Delete file</h2>
      <p data-part="description">This can't be undone.</p>
      <button data-part="close">Cancel</button>
    </dialog>`;

  function dialogIn(container: HTMLElement) {
    const host = container.querySelector('sous-dialog')!;
    const trigger = host.querySelector<HTMLElement>('[data-part="trigger"]')!;
    const modal = host.querySelector('dialog')!;
    const events: unknown[] = [];
    for (const type of ['dismiss', 'openchange']) {
      host.addEventListener(type, (event) =>
        events.push((event as CustomEvent).detail),
      );
    }
    return { host, trigger, modal, events };
  }

  const escape = (target: Element) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );

  it('adopts the role of its dialog and turns off dismissal with "false"', () => {
    const container = mount(
      `<sous-dialog dismissable="false">${DIALOG}</sous-dialog>`,
    );
    const { host, trigger, modal, events } = dialogIn(container);
    expect(host.role).toBe('alertdialog');
    expect(host.hasAttribute('role')).toBe(false);
    expect(modal.getAttribute('role')).toBe('alertdialog');

    trigger.click();
    expect(modal.matches(':modal')).toBe(true);
    escape(modal);
    expect(events).toEqual([true]);
    host.removeAttribute('dismissable');
    escape(modal);
    expect(events).toEqual([
      true,
      { reason: 'escape', returnValue: '' },
      false,
    ]);
  });

  it('opens from instance.api.open() and closes from close()', async () => {
    const container = mount(`<sous-dialog>${DIALOG}</sous-dialog>`);
    const { host, modal, events } = dialogIn(container);
    host.instance.api.open();
    expect(modal.matches(':modal')).toBe(true);
    host.instance.api.close();
    expect(events).toEqual([true, false]);
    await vi.waitFor(() => expect(modal.open).toBe(false));
  });

  it('reports a dialog removed while open, unlocks scroll and restores focus', async () => {
    const container = mount(`<sous-dialog>${DIALOG}</sous-dialog>`);
    const { host, trigger, modal, events } = dialogIn(container);
    trigger.click();
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden');

    modal.remove();
    await vi.waitFor(() =>
      expect(events).toEqual([
        true,
        { reason: 'browser', returnValue: '' },
        false,
      ]),
    );
    expect(host.instance.getState().isOpen).toBe(false);
    expect(getComputedStyle(document.documentElement).overflow).not.toBe(
      'hidden',
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus the page moved elsewhere when its dialog is removed', async () => {
    const container = mount(
      `<sous-dialog>${DIALOG}</sous-dialog><input id="elsewhere" aria-label="Elsewhere" />`,
    );
    const { trigger, modal, events } = dialogIn(container);
    trigger.click();
    modal.remove();
    const elsewhere = container.querySelector<HTMLElement>('#elsewhere')!;
    elsewhere.focus();
    await vi.waitFor(() => expect(events).toHaveLength(3));
    expect(document.activeElement).toBe(elsewhere);
  });

  it('hosts the live announcer while open', async () => {
    const container = mount(`<sous-dialog>${DIALOG}</sous-dialog>`);
    const { trigger, modal } = dialogIn(container);
    announce('Before');
    const announcer = () =>
      document.querySelector('[data-sous-live-announcer]')!;
    expect(announcer().parentElement).toBe(document.body);

    trigger.click();
    expect(announcer().parentElement).toBe(modal);
    escape(modal);
    await vi.waitFor(() => expect(modal.open).toBe(false));
    expect(announcer().parentElement).toBe(document.body);
    destroyAnnouncer();
  });

  it('warns about a dialog without a name, an alertdialog without a description and a root that is not a dialog', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = mount(`
      <sous-dialog id="unnamed">
        <dialog data-part="root"><button data-part="close">Close</button></dialog>
      </sous-dialog>
      <sous-dialog id="alert">
        <dialog data-part="root" role="alertdialog">
          <h2 data-part="title">Delete file</h2>
        </dialog>
      </sous-dialog>
      <sous-dialog id="div"><div data-part="root"></div></sous-dialog>`);
    const messages = () => warn.mock.calls.map(([message]) => String(message));
    expect(messages().some((message) => message.includes('<div>'))).toBe(true);

    for (const id of ['unnamed', 'alert']) {
      const host = container.querySelector<SousElement<typeof dialog>>(
        `#${id}`,
      )!;
      host.isOpen = true;
      host.isOpen = false;
    }
    const all = messages();
    warn.mockRestore();
    expect(all.some((message) => message.includes('no name'))).toBe(true);
    expect(all.some((message) => message.includes('needs a description'))).toBe(
      true,
    );
  });
});
