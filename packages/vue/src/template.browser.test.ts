/**
 * The adapter in compiled templates, where `v-bind` merges with the
 * attributes and listeners around it: Vue's runtime compiler, from its full
 * build, stands in for a `.vue` file.
 */

import 'vue/dist/vue.esm-bundler.js';

import { button } from '@uniaria/core/button';
import { field } from '@uniaria/core/field';
import { listbox } from '@uniaria/core/listbox';
import { popover } from '@uniaria/core/popover';
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import type { App, Component } from 'vue';
import { createApp, defineComponent, nextTick, ref, useModel } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useComponent } from './use-component';
import { useComponentState } from './use-component-state';

let app: App | undefined;

function render(component: Component): HTMLElement {
  const container = document.body.appendChild(document.createElement('div'));
  app = createApp(component);
  app.mount(container);
  return container;
}

afterEach(async () => {
  await releaseInput();
  app?.unmount();
  app = undefined;
  document.body.replaceChildren();
});

describe('templates', () => {
  it('keep the attributes and ids written beside v-bind', () => {
    // Vue's compiler has a notice of its own when it first runs.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = render({
      setup: () => ({ ui: useComponent(field) }),
      template: `
        <div v-bind="ui.parts.root" class="field">
          <label v-bind="ui.parts.label" id="name-label">Name</label>
          <input v-bind="ui.parts.control" id="name" name="name" />
        </div>`,
    });
    const root = element.querySelector('div')!;
    const label = element.querySelector('label')!;
    const input = element.querySelector('input')!;
    expect(root.className).toBe('field');
    expect(root.getAttribute('data-uni')).toBe('field');
    expect(input.name).toBe('name');
    expect(label.getAttribute('for')).toBe('name');
    expect(input.getAttribute('aria-labelledby')).toBe('name-label');
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(messages.filter((message) => message.includes('[uniaria]'))).toEqual(
      [],
    );
  });

  it('run a listener written beside v-bind as well as UniAria’s', async () => {
    const onPress = vi.fn();
    const onClick = vi.fn();
    const element = render({
      setup: () => ({ ui: useComponent(button, { onPress }), onClick }),
      template: `<button v-bind="ui.parts.root" @click="onClick">Save</button>`,
    });
    await pointer.click(element.querySelector('button')!);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('render item parts with v-for, and select without rendering again', async () => {
    const items = [
      { key: 'apple', textValue: 'Apple' },
      { key: 'banana', textValue: 'Banana' },
    ];
    const onRender = vi.fn();
    const element = render({
      setup: () => ({
        ui: useComponent(listbox, { items }),
        items,
        onRender,
      }),
      template: `
        <div v-bind="ui.parts.root">
          {{ onRender() }}
          <ul v-bind="ui.parts.list">
            <li
              v-for="item in items"
              :key="item.key"
              v-bind="ui.getItemProps('option', item.key)"
            >{{ item.textValue }}</li>
          </ul>
        </div>`,
    });
    const [apple, banana] = Array.from(element.querySelectorAll('li'));
    expect(apple!.getAttribute('role')).toBe('option');
    await pointer.click(banana!);
    expect(banana!.getAttribute('aria-selected')).toBe('true');
    expect(apple!.getAttribute('aria-selected')).toBe('false');
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('read selected state as a ref the template unwraps', async () => {
    const element = render({
      setup() {
        const ui = useComponent(button);
        return { ui, isPressed: useComponentState(ui, (s) => s.isPressed) };
      },
      template: `<button v-bind="ui.parts.root">{{ isPressed ? 'Down' : 'Up' }}</button>`,
    });
    const save = element.querySelector('button')!;
    save.focus();
    await keyboard.down('Enter');
    await expect.poll(() => save.textContent).toBe('Down');
    await keyboard.up('Enter');
    await expect.poll(() => save.textContent).toBe('Up');
  });
});

/**
 * A popover with `v-model:open`, as `defineModel('open', { default:
 * undefined })` compiles to.
 */
const Picker = defineComponent({
  props: { open: { type: Boolean, default: undefined } },
  emits: ['update:open'],
  setup(props) {
    const open = useModel(props, 'open');
    const ui = useComponent(popover, () => ({
      isOpen: open.value,
      onOpenChange: (isOpen) => (open.value = isOpen),
    }));
    return { ui };
  },
  template: `
    <button v-bind="ui.parts.trigger">Size</button>
    <div v-bind="ui.parts.root">Content</div>`,
});

describe('v-model through useModel', () => {
  it('controls the component from the parent', async () => {
    const isOpen = ref(false);
    const element = render({
      components: { Picker },
      setup: () => ({ isOpen }),
      template: `<Picker v-model:open="isOpen" />`,
    });
    const trigger = element.querySelector('button')!;
    await pointer.click(trigger);
    expect(isOpen.value).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    isOpen.value = false;
    await nextTick();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves the component uncontrolled without one', async () => {
    const element = render({
      components: { Picker },
      template: `<Picker />`,
    });
    const trigger = element.querySelector('button')!;
    await pointer.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await keyboard.press('Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
