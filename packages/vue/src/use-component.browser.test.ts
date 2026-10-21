import { createInstance, defineComponent, itemId, prop } from '@uniaria/core';
import { button } from '@uniaria/core/button';
import type { ButtonProps } from '@uniaria/core/button';
import { field } from '@uniaria/core/field';
import { popover } from '@uniaria/core/popover';
import { textField } from '@uniaria/core/text-field';
import { toggleButton } from '@uniaria/core/toggle-button';
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import type { App, VNodeChild } from 'vue';
import {
  KeepAlive,
  Teleport,
  createApp,
  createSSRApp,
  defineComponent as defineVueComponent,
  h,
  mergeProps,
  nextTick,
  ref,
  shallowRef,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { ComponentHandle } from './use-component';
import { useComponent } from './use-component';
import { useComponentState } from './use-component-state';

let app: App | undefined;
let container: HTMLElement | undefined;

/** Mounts a root render function, as an app's root component. */
function render(root: () => VNodeChild): HTMLElement {
  container = document.createElement('div');
  document.body.append(container);
  app = createApp({ render: root });
  app.mount(container);
  return container;
}

/** Hydrates server HTML for a root render function. */
async function hydrate(root: () => VNodeChild): Promise<HTMLElement> {
  container = document.createElement('div');
  container.innerHTML = await renderToString(createSSRApp({ render: root }));
  document.body.append(container);
  return container;
}

afterEach(async () => {
  await releaseInput();
  app?.unmount();
  app = undefined;
  container?.remove();
  container = undefined;
  document.body.replaceChildren();
});

/** A Save button whose props come from a getter, counting its renders. */
function saveButton(
  props: () => ButtonProps = () => ({}),
  onRender?: () => void,
) {
  return defineVueComponent(() => {
    const ui = useComponent(button, props);
    return () => {
      onRender?.();
      return h('button', ui.parts.root, 'Save');
    };
  });
}

const Docs = defineVueComponent(() => {
  const ui = useComponent(button, { href: '/docs' });
  return () => h('a', ui.parts.root, 'Docs');
});

/** Lets the warnings of every element that reached the binder through. */
const quiet = () => vi.spyOn(console, 'warn');

describe('useComponent', () => {
  it('renders part props for the first paint', () => {
    const Save = saveButton(() => ({ isDisabled: true }));
    const element = render(() => h(Save)).querySelector('button')!;
    expect(element.getAttribute('data-uni')).toBe('button');
    expect(element.hasAttribute('class')).toBe(false);
    expect(element.hasAttribute('data-element')).toBe(false);
    expect(element.getAttribute('type')).toBe('button');
    expect(element.disabled).toBe(true);
    expect(element.hasAttribute('data-disabled')).toBe(true);
  });

  it('marks the root with data-uni, beside a class the template adds', () => {
    const warn = quiet();
    const Primary = defineVueComponent(() => {
      const ui = useComponent(button);
      return () =>
        h('button', mergeProps(ui.parts.root, { class: 'mine' }), 'Save');
    });
    const element = render(() => h(Primary)).querySelector('button')!;
    expect(element.getAttribute('data-uni')).toBe('button');
    expect(element.className).toBe('mine');
    // The binder never writes `class`, so state changes leave it as Vue
    // rendered it.
    element.focus();
    expect(element.hasAttribute('data-focused')).toBe(true);
    expect(element.className).toBe('mine');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('marks other parts with data-element, and no class', () => {
    let label: Record<string, unknown> = {};
    const Name = defineVueComponent(() => {
      const ui = useComponent(field);
      return () => {
        label = ui.parts.label;
        return h('div', ui.parts.root, [
          h('label', ui.parts.label, 'Name'),
          h('input', ui.parts.control),
        ]);
      };
    });
    const element = render(() => h(Name));
    expect(label['data-uni']).toBeUndefined();
    const control = element.querySelector('input')!;
    expect(control.getAttribute('data-element')).toBe('Control');
    expect(control.hasAttribute('class')).toBe(false);
    expect(element.querySelector('label')!.getAttribute('data-element')).toBe(
      'Label',
    );
    expect(element.querySelector('[data-uni="field"]')).toBe(
      element.firstChild,
    );
  });

  it('marks a part outside the root with data-uni-part', () => {
    const warn = quiet();
    const overlay = defineComponent({
      name: 'test-overlay',
      parts: ['trigger', 'root'],
      outsideParts: ['trigger'],
      props: {},
      setup: () => ({}),
      expose: () => ({}),
      connect: () => ({
        trigger: { attrs: { 'aria-haspopup': 'true' } },
        root: { attrs: {} },
      }),
    });
    const Overlay = defineVueComponent(() => {
      const ui = useComponent(overlay);
      return () => [
        h('button', ui.parts.trigger, 'Open'),
        h('div', ui.parts.root),
      ];
    });
    const trigger = render(() => h(Overlay)).querySelector('button')!;
    expect(trigger.getAttribute('data-uni-part')).toBe('test-overlay-trigger');
    expect(trigger.hasAttribute('data-element')).toBe(false);
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps handler identity across renders', async () => {
    const seen: ComponentHandle<typeof button>['parts']['root'][] = [];
    const label = ref('a');
    const Probe = defineVueComponent(() => {
      const ui = useComponent(button);
      return () => {
        seen.push(ui.parts.root);
        return h('button', ui.parts.root, label.value);
      };
    });
    const element = render(() => h(Probe));
    label.value = 'b';
    await nextTick();
    expect(element.textContent).toBe('b');
    expect(seen).toHaveLength(2);
    const [first, last] = seen;
    expect(last!.onKeydown).toBe(first!.onKeydown);
    expect(last!.onClick).toBe(first!.onClick);
    expect(last!.ref).toBe(first!.ref);
  });

  it('keeps attributes the binder wrote when the component renders again', async () => {
    const count = ref(0);
    const Counter = defineVueComponent(() => {
      const ui = useComponent(button);
      return () => h('button', ui.parts.root, String(count.value));
    });
    const element = render(() => h(Counter)).querySelector('button')!;
    element.focus();
    expect(element.hasAttribute('data-focused')).toBe(true);

    count.value = 1;
    await nextTick();
    expect(element.textContent).toBe('1');
    expect(element.hasAttribute('data-focused')).toBe(true);
  });

  it('calls the latest callbacks without rendering for state', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const onPress = shallowRef(first);
    const onRender = vi.fn();
    const Save = saveButton(() => ({ onPress: onPress.value }), onRender);
    const element = render(() => h(Save)).querySelector('button')!;
    onPress.value = second;
    await nextTick();
    const renders = onRender.mock.calls.length;

    element.focus();
    await keyboard.press('Enter');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenCalledTimes(renders);
  });

  it('renders nothing for hover, focus, press or an opening popover', async () => {
    const onRender = vi.fn();
    const Picker = defineVueComponent(() => {
      const ui = useComponent(popover);
      return () => {
        onRender();
        return [
          h('button', ui.parts.trigger, 'Size'),
          h('div', ui.parts.root, 'Content'),
        ];
      };
    });
    const element = render(() => h(Picker));
    const trigger = element.querySelector('button')!;
    await pointer.move(trigger);
    await pointer.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await keyboard.press('Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('types inline callbacks from the definition', async () => {
    const seen: boolean[] = [];
    const Mute = defineVueComponent(() => {
      // Only the definition infers the props type, so the parameter is typed.
      const ui = useComponent(toggleButton, () => ({
        onSelectedChange: (isSelected) => {
          expectTypeOf(isSelected).toEqualTypeOf<boolean>();
          seen.push(isSelected);
        },
      }));
      return () => h('button', ui.parts.root, 'Mute');
    });
    render(() => h(Mute))
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
    const Panel = defineVueComponent(() => {
      const ui = useComponent(panel);
      handle = ui;
      return () => h('div', ui.parts.root);
    });
    render(() => h(Panel));
    expect(Object.keys(handle!.actions)).toEqual(['show']);
    expect(handle!.actions.show()).toBe(1);
    expect('api' in handle!).toBe(false);
    expectTypeOf(handle!.actions).toEqualTypeOf<{ show: () => number }>();
  });

  it('keeps the handle and the instance out of Vue’s reactivity', () => {
    let handle: ComponentHandle<typeof button> | undefined;
    const Save = defineVueComponent(() => {
      handle = useComponent(button);
      return () => h('button', handle!.parts.root, 'Save');
    });
    render(() => h(Save));
    const held = ref({ handle: handle! });
    expect(held.value.handle).toBe(handle);
    expect(held.value.handle.instance).toBe(handle!.instance);
  });
});

describe('props', () => {
  it('follows a getter', async () => {
    const isDisabled = ref(false);
    const Save = saveButton(() => ({ isDisabled: isDisabled.value }));
    const element = render(() => h(Save)).querySelector('button')!;
    expect(element.disabled).toBe(false);
    isDisabled.value = true;
    await nextTick();
    expect(element.disabled).toBe(true);
  });

  it('follows a ref', async () => {
    const props = ref<ButtonProps>({});
    const Save = defineVueComponent(() => {
      const ui = useComponent(button, props);
      return () => h('button', ui.parts.root, 'Save');
    });
    const element = render(() => h(Save)).querySelector('button')!;
    props.value = { isDisabled: true };
    await nextTick();
    expect(element.disabled).toBe(true);
  });

  it("follows the component's own props, key by key", async () => {
    const SaveWrapper = defineVueComponent({
      props: { isDisabled: { type: Boolean, default: undefined } },
      setup(props) {
        const ui = useComponent(button, props);
        return () => h('button', ui.parts.root, 'Save');
      },
    });
    const isDisabled = ref(false);
    const element = render(() =>
      h(SaveWrapper, { isDisabled: isDisabled.value }),
    ).querySelector('button')!;
    expect(element.disabled).toBe(false);
    isDisabled.value = true;
    await nextTick();
    expect(element.disabled).toBe(true);
  });

  it('reads a plain object once', async () => {
    const props: ButtonProps = { isDisabled: true };
    const count = ref(0);
    const Save = defineVueComponent(() => {
      const ui = useComponent(button, props);
      return () => h('button', ui.parts.root, String(count.value));
    });
    const element = render(() => h(Save)).querySelector('button')!;
    expect(element.disabled).toBe(true);
    (props as { isDisabled: boolean }).isDisabled = false;
    count.value = 1;
    await nextTick();
    expect(element.disabled).toBe(true);
  });

  it('leaves a Boolean bindable uncontrolled only with an undefined default', async () => {
    const panel = (props: { readonly isOpen?: boolean }) => {
      const ui = useComponent(popover, props);
      return () => [
        h('button', ui.parts.trigger, 'Size'),
        h('div', ui.parts.root, 'Content'),
      ];
    };
    const Open = defineVueComponent({
      props: { isOpen: { type: Boolean, default: undefined } },
      setup: panel,
    });
    const Closed = defineVueComponent({
      props: { isOpen: { type: Boolean } },
      setup: panel,
    });
    const element = render(() => [h(Open), h(Closed)]);
    const [open, closed] = element.querySelectorAll('button');

    await pointer.click(open!);
    expect(open!.getAttribute('aria-expanded')).toBe('true');
    await keyboard.press('Escape');

    // Vue casts the absent prop to false: controlled, and closed.
    await pointer.click(closed!);
    expect(closed!.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('a component as a part', () => {
  it('binds the root element of a component, as a router link renders it', async () => {
    const Link = defineVueComponent((_, { slots }) => {
      return () => h('a', { href: '/docs' }, slots.default?.());
    });
    const onPress = vi.fn();
    let handle: ComponentHandle<typeof button> | undefined;
    const Docs = defineVueComponent(() => {
      const ui = useComponent(button, { href: '/docs', onPress });
      handle = ui;
      return () => h(Link, ui.parts.root, () => 'Docs');
    });
    const link = render(() => h(Docs)).querySelector('a')!;
    expect(link.getAttribute('data-uni')).toBe('button');
    expect(handle!.instance.element('root')).toBe(link);

    link.addEventListener('click', (event) => event.preventDefault());
    link.focus();
    await keyboard.press('Enter');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('elements reaching the binder', () => {
  /** Records whether each popover shown was in the document. */
  function spyShow() {
    const connected: boolean[] = [];
    const showPopover = HTMLElement.prototype.showPopover;
    const spy = vi
      .spyOn(HTMLElement.prototype, 'showPopover')
      .mockImplementation(function (this: HTMLElement) {
        connected.push(this.isConnected);
        showPopover.call(this);
      });
    return { connected, restore: () => spy.mockRestore() };
  }

  it('get only elements in the document, on mount and in later patches', async () => {
    const shows = spyShow();
    const isShown = ref(false);
    const Deep = defineVueComponent(() => {
      const ui = useComponent(popover, { defaultOpen: true });
      return () =>
        h('section', [
          h('div', [
            h('button', ui.parts.trigger, 'Size'),
            h('div', ui.parts.root, 'Content'),
          ]),
        ]);
    });
    const Later = defineVueComponent(() => {
      const ui = useComponent(popover, { defaultOpen: true });
      return () => [
        h('button', ui.parts.trigger, 'Width'),
        isShown.value
          ? h('div', [h('div', ui.parts.root, 'Later content')])
          : null,
      ];
    });
    try {
      render(() => [h(Deep), h(Later)]);
      expect(shows.connected).toEqual([true]);
      isShown.value = true;
      await nextTick();
      expect(shows.connected).toEqual([true, true]);
    } finally {
      shows.restore();
    }
  });

  it('follow a part through <Teleport>', async () => {
    const Picker = defineVueComponent(() => {
      const ui = useComponent(popover);
      return () => [
        h('button', ui.parts.trigger, 'Size'),
        h(Teleport, { to: 'body' }, [h('div', ui.parts.root, 'Content')]),
      ];
    });
    const trigger = render(() => h(Picker)).querySelector('button')!;
    await pointer.click(trigger);
    const panel = document.body.querySelector<HTMLElement>(
      ':scope > [data-uni="popover"]',
    )!;
    expect(panel.matches(':popover-open')).toBe(true);
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('stop while <KeepAlive> keeps them aside, and start again', async () => {
    const onPress = vi.fn();
    let handle: ComponentHandle<typeof button> | undefined;
    const Save = defineVueComponent(() => {
      handle = useComponent(button, { onPress });
      return () => h('button', handle!.parts.root, 'Save');
    });
    const Other = defineVueComponent(() => () => h('p', 'Other'));
    const isSave = ref(true);
    const element = render(() =>
      h(KeepAlive, null, [isSave.value ? h(Save) : h(Other)]),
    );
    expect(handle!.instance.isStarted()).toBe(true);

    isSave.value = false;
    await nextTick();
    expect(handle!.instance.isStarted()).toBe(false);

    isSave.value = true;
    await nextTick();
    expect(handle!.instance.isStarted()).toBe(true);
    element.querySelector('button')!.focus();
    await keyboard.press('Enter');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('development warnings', () => {
  it('warns when the template writes an attribute UniAria owns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Override = defineVueComponent(() => {
      const ui = useComponent(button);
      return () =>
        h(
          'button',
          mergeProps(ui.parts.root, { type: 'submit', 'data-pressed': '' }),
          'Save',
        );
    });
    render(() => h(Override));
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(messages.some((message) => message.includes('"type"'))).toBe(true);
    expect(messages.some((message) => message.includes('"data-pressed"'))).toBe(
      true,
    );
  });

  it('warns about an attribute falling through from a parent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Save = saveButton();
    render(() => h(Save, { type: 'submit' }));
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(messages.some((message) => message.includes('"type"'))).toBe(true);
  });

  it('warns when the template replaces the data-uni of the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Replaced = defineVueComponent(() => {
      const ui = useComponent(button);
      return () =>
        h('button', mergeProps(ui.parts.root, { 'data-uni': 'mine' }), 'Save');
    });
    const element = render(() => h(Replaced)).querySelector('button')!;
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(element.getAttribute('data-uni')).toBe('button');
    expect(
      messages.filter((message) =>
        message.includes('"data-uni" on the root part'),
      ),
    ).toHaveLength(1);
  });

  it('warns when the root tag and elementType differ', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Wrong = defineVueComponent(() => {
      const ui = useComponent(button);
      return () => h('span', ui.parts.root, 'Save');
    });
    render(() => h(Wrong));
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(
      messages.some((message) => message.includes('elementType="span"')),
    ).toBe(true);
  });

  it('stays quiet for correct markup', () => {
    const warn = quiet();
    const Save = saveButton();
    render(() => [h(Save), h(Docs)]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  // Field links its label only once it has started.
  it('stays quiet when the label is linked after the start', () => {
    const warn = quiet();
    const Name = defineVueComponent(() => {
      const ui = useComponent(field);
      return () => [
        h('label', ui.parts.label, 'Name'),
        h('input', ui.parts.control),
      ];
    });
    const rendered = render(() => h(Name));
    expect(
      rendered.querySelector('input')!.hasAttribute('aria-labelledby'),
    ).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('part ids', () => {
  const labelId = ref<string | undefined>();
  const inputId = ref<string | undefined>();

  const Name = defineVueComponent(() => {
    const ui = useComponent(field);
    // An id after `v-bind` wins, as in a template.
    const own = (id: string | undefined) => (id === undefined ? {} : { id });
    return () => [
      h('label', mergeProps(ui.parts.label, own(labelId.value)), 'Name'),
      h('input', mergeProps(ui.parts.control, own(inputId.value))),
      h('p', ui.parts.description, 'As on your passport'),
    ];
  });

  const partsOf = (element: HTMLElement) => ({
    label: element.querySelector('label')!,
    input: element.querySelector('input')!,
    description: element.querySelector('p')!,
  });

  /** Lets the binder hear of an id Vue changed. */
  const observed = () => new Promise((resolve) => setTimeout(resolve));

  afterEach(() => {
    labelId.value = undefined;
    inputId.value = undefined;
  });

  it('keeps an id the template gives a part after v-bind, and points references at it', () => {
    const warn = quiet();
    labelId.value = 'name-label';
    inputId.value = 'name';
    const { label, input } = partsOf(render(() => h(Name)));
    expect(label.id).toBe('name-label');
    expect(input.id).toBe('name');
    expect(label.getAttribute('for')).toBe('name');
    expect(input.getAttribute('aria-labelledby')).toBe('name-label');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('follows an id a later render changes', async () => {
    labelId.value = 'name-label';
    const element = render(() => h(Name));
    const { label, input, description } = partsOf(element);
    labelId.value = 'full-name';
    inputId.value = 'name';
    await nextTick();
    await observed();
    expect(label.id).toBe('full-name');
    expect(input.getAttribute('aria-labelledby')).toBe('full-name');
    expect(label.getAttribute('for')).toBe('name');
    expect(input.getAttribute('aria-describedby')).toBe(description.id);
  });

  it('hydrates server HTML with consumer ids, then references them', async () => {
    labelId.value = 'name-label';
    inputId.value = 'name';
    const element = await hydrate(() => h(Name));
    const { label, input } = partsOf(element);
    // The server can't see the elements: `for` names the input's own id.
    expect(input.id).toBe('name');
    expect(label.getAttribute('for')).not.toBe('name');

    const warn = quiet();
    const errors = vi.spyOn(console, 'error');
    app = createSSRApp({ render: () => h(Name) });
    app.mount(element);
    expect(warn).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    warn.mockRestore();
    errors.mockRestore();
    expect(label.getAttribute('for')).toBe('name');
    expect(input.getAttribute('aria-labelledby')).toBe('name-label');
  });

  it('leaves nothing it wrote on an element the part moves away from', async () => {
    const pressable = defineComponent({
      name: 'pressable',
      parts: ['trigger'],
      props: {},
      setup(ctx) {
        const isOn = ctx.state(false);
        return { isOn: () => isOn.get(), toggle: () => isOn.set(!isOn.get()) };
      },
      expose: () => ({}),
      connect: ({ api }) => ({
        trigger: { attrs: { 'aria-pressed': String(api.isOn()) } },
      }),
    });
    let instance: ComponentHandle<typeof pressable>['instance'] | undefined;
    const isFirst = ref(true);
    const Two = defineVueComponent(() => {
      const ui = useComponent(pressable);
      instance = ui.instance;
      return () => [
        h('button', isFirst.value ? ui.parts.trigger : {}, 'A'),
        h('button', isFirst.value ? {} : ui.parts.trigger, 'B'),
      ];
    });
    const element = render(() => h(Two));
    const [first, second] = element.querySelectorAll('button');
    instance!.api.toggle();
    expect(first!.getAttribute('aria-pressed')).toBe('true');

    isFirst.value = false;
    await nextTick();
    expect(first!.hasAttribute('aria-pressed')).toBe(false);
    expect(first!.hasAttribute('data-element')).toBe(false);
    expect(second!.getAttribute('aria-pressed')).toBe('true');
    expect(second!.getAttribute('data-element')).toBe('Trigger');
  });
});

describe('useComponentState', () => {
  it('renders only when the selected value changes', async () => {
    const renders: boolean[] = [];
    const Selecting = defineVueComponent(() => {
      const ui = useComponent(button);
      const isPressed = useComponentState(ui, (state) => state.isPressed);
      return () => {
        renders.push(isPressed.value);
        return h('button', ui.parts.root, isPressed.value ? 'Down' : 'Up');
      };
    });
    const element = render(() => h(Selecting)).querySelector('button')!;
    renders.length = 0;

    element.focus();
    element.blur();
    await nextTick();
    expect(renders).toEqual([]);

    element.focus();
    await keyboard.down('Enter');
    await expect.poll(() => element.textContent).toBe('Down');
    await keyboard.up('Enter');
    await expect.poll(() => element.textContent).toBe('Up');
    expect(renders).toEqual([true, false]);
  });

  it('renders once for a prop change the selected state shows', async () => {
    const states: boolean[] = [];
    const isDisabled = ref(false);
    const Selecting = defineVueComponent(() => {
      const ui = useComponent(button, () => ({ isDisabled: isDisabled.value }));
      const state = useComponentState(ui, (current) => current.isDisabled);
      return () => {
        states.push(state.value);
        return h('button', ui.parts.root, 'Save');
      };
    });
    render(() => h(Selecting));
    isDisabled.value = true;
    await nextTick();
    isDisabled.value = false;
    await nextTick();
    expect(states).toEqual([false, true, false]);
  });

  /**
   * A button whose render shows hover and disabled from its state, and the
   * `isDisabled` prop too when `isShowingProp` is set.
   */
  function hoverStates(isShowingProp: boolean) {
    const states: { isDisabled: boolean; isHovered: boolean }[] = [];
    const isDisabled = ref(false);
    const Selecting = defineVueComponent(() => {
      const ui = useComponent(button, () => ({ isDisabled: isDisabled.value }));
      const state = useComponentState(ui, (current) => current);
      return () => {
        states.push({
          isDisabled: state.value.isDisabled,
          isHovered: state.value.isHovered,
        });
        return h(
          'button',
          ui.parts.root,
          isShowingProp && isDisabled.value ? 'Unavailable' : 'Save',
        );
      };
    });
    return { states, isDisabled, Selecting };
  }

  it('renders again for a change the prop sync makes', async () => {
    const { states, isDisabled, Selecting } = hoverStates(true);
    await pointer.move(render(() => h(Selecting)).querySelector('button')!);
    await expect.poll(() => states.at(-1)?.isHovered).toBe(true);
    states.length = 0;

    // Disabling ends hover during the sync: one render for the prop, one for
    // the hover it ended.
    isDisabled.value = true;
    await nextTick();
    expect(states).toEqual([
      { isDisabled: true, isHovered: true },
      { isDisabled: true, isHovered: false },
    ]);
  });

  it('renders once, after the sync, when only the state shows the prop', async () => {
    const { states, isDisabled, Selecting } = hoverStates(false);
    await pointer.move(render(() => h(Selecting)).querySelector('button')!);
    await expect.poll(() => states.at(-1)?.isHovered).toBe(true);
    states.length = 0;

    // The render reads no prop, so only the sync's change renders it.
    isDisabled.value = true;
    await nextTick();
    expect(states).toEqual([{ isDisabled: true, isHovered: false }]);
  });

  it('accepts an equality function', async () => {
    const renders = vi.fn();
    const Selecting = defineVueComponent(() => {
      const ui = useComponent(button);
      const state = useComponentState(
        ui.instance,
        (current) => ({ pressed: current.isPressed }),
        (a, b) => a.pressed === b.pressed,
      );
      return () => {
        renders(state.value.pressed);
        return h('button', ui.parts.root, 'Save');
      };
    });
    const element = render(() => h(Selecting)).querySelector('button')!;
    renders.mockClear();

    element.focus();
    element.blur();
    await nextTick();
    expect(renders).not.toHaveBeenCalled();
  });

  it('unsubscribes when its component unmounts', () => {
    const instance = createInstance(button, { props: {} });
    const unsubscribe = vi.fn();
    const subscribe = instance.subscribe;
    instance.subscribe = (listener) => {
      const stop = subscribe(listener);
      return () => {
        unsubscribe();
        stop();
      };
    };
    const Reader = defineVueComponent(() => {
      const isPressed = useComponentState(instance, (state) => state.isPressed);
      return () => h('p', String(isPressed.value));
    });
    render(() => h(Reader));
    expect(unsubscribe).not.toHaveBeenCalled();
    app!.unmount();
    app = undefined;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('is read-only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const instance = createInstance(button, { props: {} });
    let isPressed: { value: boolean } | undefined;
    const Reader = defineVueComponent(() => {
      isPressed = useComponentState(instance, (state) => state.isPressed);
      return () => h('p', String(isPressed!.value));
    });
    render(() => h(Reader));
    isPressed!.value = true;
    expect(isPressed!.value).toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain('read-only');
    warn.mockRestore();
  });
});

describe('server rendering', () => {
  it('hydrates server HTML without mismatches or a second render', async () => {
    const onPress = vi.fn();
    const onRender = vi.fn();
    const Save = saveButton(
      () => ({ shouldExcludeFromTabOrder: true, onPress }),
      onRender,
    );
    const element = await hydrate(() => h(Save));
    const saveElement = element.querySelector('button')!;
    expect(saveElement.getAttribute('tabindex')).toBe('-1');
    onRender.mockClear();

    const warn = quiet();
    const errors = vi.spyOn(console, 'error');
    app = createSSRApp({ render: () => h(Save) });
    app.mount(element);
    await nextTick();

    expect(warn).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(element.querySelector('button')).toBe(saveElement);
    warn.mockRestore();
    errors.mockRestore();

    saveElement.focus();
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

describe('live DOM properties', () => {
  const text = ref('first');
  const Live = defineVueComponent(() => {
    const ui = useComponent(live, () => ({ text: text.value }));
    return () => h('input', ui.parts.input);
  });

  it('renders a value once as the attribute, and the binder sets later ones', async () => {
    text.value = 'first';
    const input = render(() => h(Live)).querySelector('input')!;
    expect(input.value).toBe('first');
    expect(input.getAttribute('value')).toBe('first');

    text.value = 'second';
    await nextTick();
    expect(input.value).toBe('second');
    // Vue never controls the input: the default stays the first value.
    expect(input.getAttribute('value')).toBe('first');
  });

  it('puts the starting value in server HTML', async () => {
    text.value = 'jane';
    expect(await renderToString(createSSRApp(Live))).toContain('value="jane"');
  });

  it('leaves what the user typed when the component renders again', async () => {
    const count = ref(0);
    const Name = defineVueComponent(() => {
      const ui = useComponent(textField, { defaultValue: 'Jane' });
      return () =>
        h('div', ui.parts.root, [
          h('label', ui.parts.label, `Name ${count.value}`),
          h('input', ui.parts.input),
        ]);
    });
    const input = render(() => h(Name)).querySelector('input')!;
    input.focus();
    input.setSelectionRange(4, 4);
    await keyboard.press('X');
    expect(input.value).toBe('JaneX');

    count.value = 1;
    await nextTick();
    expect(input.value).toBe('JaneX');
    expect(input.getAttribute('value')).toBe('Jane');
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

type RowsHandle = ComponentHandle<typeof rows>;

describe('item parts', () => {
  const keys = ref<readonly string[]>(['a', 'b', 'c']);
  const tone = ref<string | undefined>();
  let handle: RowsHandle | undefined;
  const onRender = vi.fn();

  const Rows = defineVueComponent(() => {
    const ui = useComponent(rows, () =>
      tone.value === undefined ? {} : { tone: tone.value },
    );
    handle = ui;
    return () => {
      onRender();
      return h(
        'div',
        ui.parts.list,
        keys.value.map((key) =>
          h('div', { key, ...ui.getItemProps('row', key) }, [
            h('span', ui.getItemProps('rowLabel', key), key),
          ]),
        ),
      );
    };
  });

  afterEach(() => {
    keys.value = ['a', 'b', 'c'];
    tone.value = undefined;
    handle = undefined;
    onRender.mockClear();
  });

  const row = (element: HTMLElement, key: string) =>
    element.querySelector<HTMLElement>(
      `[data-element="Row"]:nth-child(${['a', 'b', 'c'].indexOf(key) + 1})`,
    )!;

  it('renders item props, and links item parts once they attach', () => {
    const warn = quiet();
    const element = render(() => h(Rows));
    expect(row(element, 'a').getAttribute('role')).toBe('option');
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

  it('renders item props on the server', async () => {
    keys.value = ['a'];
    const html = await renderToString(createSSRApp(Rows));
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('id="r-rowLabel-a"');
    expect(html).not.toContain('aria-labelledby');
  });

  it('finds the key from the element, with one handler per part and event', () => {
    const element = render(() => h(Rows));
    expect(handle!.getItemProps('row', 'a').onClick).toBe(
      handle!.getItemProps('row', 'b').onClick,
    );
    row(element, 'b').click();
    expect(handle!.instance.getState().active).toBe('b');
    expect(row(element, 'b').getAttribute('aria-selected')).toBe('true');
  });

  it('changes items through the binder without rendering again', async () => {
    const element = render(() => h(Rows));
    expect(onRender).toHaveBeenCalledTimes(1);
    row(element, 'a').click();
    row(element, 'c').click();
    await nextTick();
    expect(row(element, 'a').getAttribute('aria-selected')).toBe('false');
    expect(row(element, 'c').getAttribute('aria-selected')).toBe('true');
    expect(onRender).toHaveBeenCalledTimes(1);

    tone.value = 'loud';
    await nextTick();
    expect(row(element, 'a').getAttribute('data-tone')).toBe('loud');
    expect(row(element, 'c').getAttribute('aria-selected')).toBe('true');
  });

  it('hands the binder the rows a patch of their own attaches, in one flush', async () => {
    const rowKeys = ref<readonly string[]>(['a']);
    const RowList = defineVueComponent({
      props: { ui: { type: Object, required: true } },
      setup(props) {
        const ui = props.ui as RowsHandle;
        return () =>
          rowKeys.value.map((key) =>
            h('div', { key, ...ui.getItemProps('row', key) }, key),
          );
      },
    });
    const Owner = defineVueComponent(() => {
      const ui = useComponent(rows);
      handle = ui;
      return () => h('div', ui.parts.list, [h(RowList, { ui })]);
    });
    render(() => h(Owner));
    const { instance } = handle!;
    const listener = vi.fn();
    instance.subscribe(listener);
    rowKeys.value = ['b', 'c', 'd', 'e'];
    await nextTick();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(instance.itemElement('row', 'a')).toBeNull();
    expect(instance.itemElement('row', 'e')).not.toBeNull();
  });

  it('detaches an item that unmounts', async () => {
    render(() => h(Rows));
    const { instance } = handle!;
    expect(instance.itemElement('row', 'c')).not.toBeNull();
    keys.value = ['a', 'b'];
    await nextTick();
    expect(instance.itemElement('row', 'c')).toBeNull();
    expect(instance.itemElement('rowLabel', 'c')).toBeNull();
    expect(instance.itemElement('row', 'b')).not.toBeNull();
  });
});

describe('element effects', () => {
  it('show a popover once it is data-entering, opened or open from the start', async () => {
    const entering: boolean[] = [];
    const showPopover = HTMLElement.prototype.showPopover;
    const spy = vi
      .spyOn(HTMLElement.prototype, 'showPopover')
      .mockImplementation(function (this: HTMLElement) {
        entering.push(this.hasAttribute('data-entering'));
        showPopover.call(this);
      });
    const Size = defineVueComponent({
      props: { id: String, defaultOpen: Boolean },
      setup(props) {
        const ui = useComponent(popover, { defaultOpen: props.defaultOpen });
        return () =>
          h('div', { id: props.id }, [
            h('button', ui.parts.trigger, 'Size'),
            h('div', ui.parts.root, 'Content'),
          ]);
      },
    });
    try {
      const element = render(() => [
        h(Size, { id: 'closed' }),
        h(Size, { id: 'open', defaultOpen: true }),
      ]);
      expect(entering).toEqual([true]);
      element.querySelector<HTMLElement>('#closed button')!.click();
      expect(entering).toEqual([true, true]);
    } finally {
      spy.mockRestore();
    }
  });
});
