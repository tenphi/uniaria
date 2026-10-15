import { bindable, defineComponent, prop } from '@tenphi/sous';
import { field } from '@tenphi/sous/field';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import './button';
import './field';
import { defineElement } from './define-element';
import type { SousElement } from './define-element';

/** A disclosure with a bindable and props of every attribute type. */
const disclosure = defineComponent({
  name: 'test-disclosure',
  parts: ['trigger', 'panel'],
  props: {
    isOpen: bindable(false),
    isDisabled: prop(false),
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
