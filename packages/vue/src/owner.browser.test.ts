import '@uniaria/elements/checkbox';
import '@uniaria/elements/checkbox-group';

import type { Instance } from '@uniaria/core';
import { checkbox } from '@uniaria/core/checkbox';
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import type { App, PropType, VNodeChild } from 'vue';
import {
  Teleport,
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBehavior } from './use-behavior';

const apps: App[] = [];

/**
 * Mounts an app. Several apps on one page need their own id prefix, since
 * Vue's `useId()` counts per app.
 */
function render(
  root: () => VNodeChild,
  container: HTMLElement = document.body.appendChild(
    document.createElement('div'),
  ),
): HTMLElement {
  const app = createApp({ render: root });
  app.config.idPrefix = `app${apps.length}`;
  app.mount(container);
  apps.push(app);
  return container;
}

afterEach(async () => {
  await releaseInput();
  for (const app of apps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

const Option = defineComponent({
  props: {
    value: { type: String, required: true },
    owner: Object as PropType<Instance<typeof checkboxGroup>>,
    onRender: Function as PropType<() => void>,
  },
  setup(props) {
    const ui = useBehavior(checkbox, () => ({
      value: props.value,
      owner: props.owner,
      labelElementType: 'span',
    }));
    return () => {
      props.onRender?.();
      return h('label', ui.parts.root, [
        h('input', ui.parts.input),
        h('span', ui.parts.label, props.value),
      ]);
    };
  },
});

/** A checkbox group that renders its options from a slot. */
const Group = defineComponent({
  props: {
    defaultValue: { type: Array as PropType<string[]>, required: true },
    onValueChange: Function as PropType<(value: readonly string[]) => void>,
    onRender: Function as PropType<() => void>,
  },
  setup(props, { slots }) {
    const ui = useBehavior(checkboxGroup, {
      defaultValue: props.defaultValue,
      onValueChange: (value) => props.onValueChange?.(value),
    });
    return () => {
      props.onRender?.();
      return h('div', ui.parts.root, [
        h('span', ui.parts.label, 'Notify'),
        slots.default?.(),
      ]);
    };
  },
});

const inputs = (container: ParentNode) =>
  Array.from(container.querySelectorAll('input'));

describe('owners in Vue', () => {
  const tree = () =>
    h(Group, { defaultValue: ['sms'] }, () => [
      h(Option, { value: 'email' }),
      h(Option, { value: 'sms' }),
    ]);

  it('links through slot content from the first render, server HTML included', async () => {
    const html = await renderToString(createSSRApp({ render: tree }));
    expect(html.match(/\schecked[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<input[^>]*\schecked[\s>][^>]*value="sms"/);

    const container = render(tree);
    expect(inputs(container).map((input) => input.checked)).toEqual([
      false,
      true,
    ]);
    expect(container.querySelector('[role="group"]')).not.toBeNull();
  });

  it('changes the group value from a checkbox, without rendering for it', async () => {
    const seen: (readonly string[])[] = [];
    const onRender = vi.fn();
    const container = render(() =>
      h(
        Group,
        {
          defaultValue: ['sms'],
          onValueChange: (value: readonly string[]) => seen.push(value),
          onRender,
        },
        () => [
          h(Option, { value: 'email', onRender }),
          h(Option, { value: 'sms', onRender }),
        ],
      ),
    );
    const renders = onRender.mock.calls.length;
    const [email, sms] = inputs(container);
    await pointer.click(email!);
    await pointer.click(sms!);
    await nextTick();
    expect(seen).toEqual([['sms', 'email'], ['email']]);
    expect(inputs(container).map((input) => input.checked)).toEqual([
      true,
      false,
    ]);
    expect(onRender).toHaveBeenCalledTimes(renders);
  });

  it('links through <Teleport>, which keeps the component tree', () => {
    const elsewhere = document.body.appendChild(document.createElement('div'));
    elsewhere.id = 'elsewhere';
    render(() =>
      h(Group, { defaultValue: ['sms'] }, () => [
        h(Option, { value: 'email' }),
        h(Teleport, { to: '#elsewhere' }, [h(Option, { value: 'sms' })]),
      ]),
    );
    expect(inputs(elsewhere)[0]!.checked).toBe(true);
  });

  it('links through the owner prop, from another branch', () => {
    let group: Instance<typeof checkboxGroup> | undefined;
    const Apart = defineComponent(() => {
      const ui = useBehavior(checkboxGroup, { defaultValue: ['email'] });
      group = ui.instance;
      return () => h('div', ui.parts.root);
    });
    render(() => h(Apart));
    const container = render(() => h(Option, { value: 'email', owner: group }));
    expect(inputs(container)[0]!.checked).toBe(true);
  });

  it("links through the DOM to another app's group", () => {
    const outer = render(() => h(Group, { defaultValue: ['sms'] }));
    const inner = outer
      .querySelector('[data-uni="checkbox-group"]')!
      .appendChild(document.createElement('div'));
    render(
      () => [h(Option, { value: 'email' }), h(Option, { value: 'sms' })],
      inner,
    );
    expect(inputs(inner).map((input) => input.checked)).toEqual([false, true]);
  });
});

describe('owners across Vue and custom elements', () => {
  it('links a Vue checkbox inside <uni-checkbox-group>', async () => {
    const host = document.body.appendChild(
      document.createElement('uni-checkbox-group'),
    );
    host.innerHTML =
      '<div data-uni="checkbox-group"><span data-element="Label">Notify</span><div></div></div>';
    host.defaultValue = ['sms'];
    const inner = host.querySelector('div > div') as HTMLElement;
    render(
      () => [h(Option, { value: 'email' }), h(Option, { value: 'sms' })],
      inner,
    );
    expect(inputs(inner).map((input) => input.checked)).toEqual([false, true]);

    await pointer.click(inputs(inner)[0]!);
    expect(host.value).toEqual(['sms', 'email']);
  });

  it("links a <uni-checkbox> inside a Vue group's root", async () => {
    const seen: (readonly string[])[] = [];
    const container = render(() =>
      h(Group, {
        defaultValue: ['sms'],
        onValueChange: (value: readonly string[]) => seen.push(value),
      }),
    );
    const root = container.querySelector('[data-uni="checkbox-group"]')!;
    const option = document.createElement('uni-checkbox');
    option.setAttribute('value', 'email');
    option.innerHTML =
      '<label data-uni="checkbox"><input data-element="Input" type="checkbox"><span data-element="Label">Email</span></label>';
    root.append(option);
    await pointer.click(option.querySelector('input')!);
    expect(seen).toEqual([['sms', 'email']]);
  });

  it('links a Vue checkbox to a group that connects later', () => {
    const host = document.createElement('uni-checkbox-group');
    host.innerHTML =
      '<div data-uni="checkbox-group"><span data-element="Label">Notify</span><div></div></div>';
    host.defaultValue = ['email'];
    const inner = host.querySelector('div > div') as HTMLElement;
    render(() => h(Option, { value: 'email' }), inner);
    expect(inputs(inner)[0]!.checked).toBe(false);

    document.body.append(host);
    expect(inputs(inner)[0]!.checked).toBe(true);
  });
});

const Radio = defineComponent({
  props: {
    value: { type: String, required: true },
    owner: Object as PropType<Instance<typeof radioGroup>>,
  },
  setup(props) {
    const ui = useBehavior(radio, () => ({
      value: props.value,
      owner: props.owner,
      labelElementType: 'span',
    }));
    return () =>
      h('label', ui.parts.root, [
        h('input', ui.parts.input),
        h('span', ui.parts.label, props.value),
      ]);
  },
});

describe('radios outside their group’s root', () => {
  it('take the arrow keys once each, teleported or linked by the owner prop', async () => {
    // In document order: the group, then the teleported radio, then the
    // linked one.
    const planContainer = document.body.appendChild(
      document.createElement('div'),
    );
    const elsewhere = document.body.appendChild(document.createElement('div'));
    elsewhere.id = 'plans-elsewhere';
    let group: Instance<typeof radioGroup> | undefined;
    const Plan = defineComponent(() => {
      const ui = useBehavior(radioGroup, { defaultValue: 'free' });
      group = ui.instance;
      return () =>
        h('div', ui.parts.root, [
          h(Radio, { value: 'free' }),
          h(Teleport, { to: '#plans-elsewhere' }, [h(Radio, { value: 'pro' })]),
        ]);
    });
    render(() => h(Plan), planContainer);
    const container = render(() => h(Radio, { value: 'team', owner: group }));
    const free = document.querySelector<HTMLInputElement>('[value="free"]')!;
    const pro = elsewhere.querySelector('input')!;
    const team = inputs(container)[0]!;

    free.focus();
    await keyboard.press('ArrowDown');
    expect(document.activeElement).toBe(pro);
    await keyboard.press('ArrowDown');
    expect(document.activeElement).toBe(team);
    await keyboard.press('ArrowDown');
    expect(document.activeElement).toBe(free);
    await keyboard.press('ArrowUp');
    expect(document.activeElement).toBe(team);
    expect(group!.getState().value).toBe('team');
  });
});
