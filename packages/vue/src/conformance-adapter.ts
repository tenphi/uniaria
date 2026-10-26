/**
 * The Vue adapter's side of the mount contract (root AGENTS.md → The mount
 * contract): renders a conformance template with Vue's `h()`, binding
 * `ui.parts.<name>` onto part elements as `v-bind` does. Test support only;
 * not exported.
 */

import type { AnyDefinition, Instance } from '@uniaria/core';
import { answers, callbackName } from '@uniaria/core';
import { button } from '@uniaria/core/button';
import { checkbox } from '@uniaria/core/checkbox';
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { autocomplete } from '@uniaria/core/autocomplete';
import { combobox } from '@uniaria/core/combobox';
import { form } from '@uniaria/core/form';
import { dialog } from '@uniaria/core/dialog';
import { field } from '@uniaria/core/field';
import { listbox } from '@uniaria/core/listbox';
import { numberField } from '@uniaria/core/number-field';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { select } from '@uniaria/core/select';
import { toggleSwitch } from '@uniaria/core/switch';
import { textField } from '@uniaria/core/text-field';
import { toggleButton } from '@uniaria/core/toggle-button';
import { tooltip } from '@uniaria/core/tooltip';
import { virtualizer } from '@uniaria/core/virtual';
import type {
  ConformanceAdapter,
  TemplateComponent,
  TemplateElement,
  TemplateNode,
  TemplateRows,
} from '@uniaria/testing';
import { VIRTUALIZER, isNested, isRows } from '@uniaria/testing';
import type { PropType, VNodeChild } from 'vue';
import {
  createApp,
  defineComponent,
  h,
  mergeProps,
  nextTick,
  shallowRef,
} from 'vue';

import { injectScope } from './owner';
import type { BehaviorHandle } from './use-behavior';
import { useBehavior } from './use-behavior';
import { useBehaviorState } from './use-behavior-state';

/** Definitions by component name, as conformance suites name them. */
const definitions: Readonly<Record<string, AnyDefinition>> = {
  button,
  'toggle-button': toggleButton,
  field,
  'text-field': textField,
  checkbox,
  'checkbox-group': checkboxGroup,
  switch: toggleSwitch,
  radio,
  'radio-group': radioGroup,
  dialog,
  popover,
  tooltip,
  'number-field': numberField,
  listbox,
  select,
  autocomplete,
  combobox,
  form,
};

/** Form values a consumer writes as starting values in a Vue template. */
const UNCONTROLLED: Readonly<Record<string, string>> = {
  value: '^value',
  checked: '^checked',
};

function templateProps(node: TemplateElement): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const isFormControl = ['input', 'textarea', 'select'].includes(node.tag);
  for (const [name, value] of Object.entries(node.attrs)) {
    props[(isFormControl && UNCONTROLLED[name]) || name] = value;
  }
  return props;
}

/** Props with `VIRTUALIZER` replaced by the virtualizer it stands for. */
function resolveProps(
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    result[key] = value === VIRTUALIZER ? virtualizer : value;
  }
  return result;
}

type Handle = BehaviorHandle<AnyDefinition>;

/**
 * Binds part props onto part elements, as `v-bind` beside the template's
 * attributes does: `ui.parts.<name>`, or for an item part
 * `ui.getItemProps(part, key)` with the key the template gives as
 * `data-key`. Rows rendered from state are keyed by part and `data-key`, so
 * a row that stays keeps its element.
 */
function renderNodes(
  nodes: readonly TemplateNode[],
  ui: Handle,
  isKeyed = false,
): VNodeChild[] {
  const itemParts: readonly string[] = ui.instance.definition.itemParts ?? [];
  return nodes.map((node, index) => {
    if (typeof node === 'string') return node;
    if (isNested(node)) return h(Nested, { key: index, node });
    if (isRows(node)) return h(Rows, { key: index, node, ui });
    const dataKey = node.attrs['data-key'];
    let props: Record<string, unknown> = templateProps(node);
    if (node.part !== undefined) {
      const part =
        itemParts.includes(node.part) && dataKey !== undefined
          ? ui.getItemProps(node.part, dataKey)
          : (ui.parts as Readonly<Record<string, Record<string, unknown>>>)[
              node.part
            ];
      props = mergeProps(props, part ?? {});
      // A consumer's id goes after `v-bind`, where it overrides the part's
      // (root AGENTS.md → DOM, lifecycle and SSR).
      if (node.attrs.id !== undefined) props.id = node.attrs.id;
    }
    props.key =
      isKeyed && dataKey !== undefined ? `${node.part}\n${dataKey}` : index;
    return h(node.tag, props, renderNodes(node.children, ui, isKeyed));
  });
}

const NONE: readonly string[] = [];

/**
 * Rows from the component's `renderedKeys` and `renderedSections`, in a
 * component of their own, as the virtualization spec's consumer writes
 * them: a change of the rendered set renders this, never the owner.
 */
const Rows = defineComponent({
  props: {
    node: { type: Object as PropType<TemplateRows>, required: true },
    ui: { type: Object as PropType<Handle>, required: true },
  },
  setup(props) {
    const keys = useBehaviorState(
      props.ui,
      (state: { renderedKeys?: readonly string[] }) =>
        state.renderedKeys ?? NONE,
    );
    const sections = useBehaviorState(
      props.ui,
      (state: { renderedSections?: readonly string[] }) =>
        state.renderedSections ?? NONE,
    );
    return () =>
      renderNodes(
        props.node.rows({ keys: keys.value, sections: sections.value }),
        props.ui,
        true,
      );
  },
});

function definitionOf(component: string): AnyDefinition {
  const definition = definitions[component];
  if (!definition) {
    throw new Error(`No definition registered for "${component}".`);
  }
  return definition;
}

/**
 * A component nested in the template, rendered as a consumer would: its own
 * `useBehavior()`, which finds the component around it as its owner.
 */
const Nested = defineComponent({
  props: {
    node: { type: Object as PropType<TemplateComponent>, required: true },
  },
  setup(props) {
    const { node } = props;
    const definition = definitionOf(node.component);
    // A link to the component it sits in directly, passed as a consumer
    // would: `useBehavior(button, () => ({ tooltip: hint.instance }))`.
    const parent = injectScope()?.instance;
    const links: Record<string, unknown> = {};
    for (const key of definition.links ?? []) {
      if (parent && answers(parent.definition, key)) links[key.name] = parent;
    }
    const ui = useBehavior(definition, { ...links, ...node.props } as never);
    return () => renderNodes(node.children, ui);
  },
});

export const vueAdapter: ConformanceAdapter = {
  name: 'vue',
  async mount({ component, props, template, events, record, container }) {
    const definition = definitionOf(component);
    let renders = 0;
    let instance: Instance | undefined;
    let actions: object = {};
    const current = shallowRef(resolveProps(props));
    const callbacks: Record<string, (detail: unknown) => void> = {};
    for (const name of events) {
      callbacks[callbackName(name)] = (detail) => record(name, detail);
    }

    const Harness = defineComponent({
      setup() {
        const ui = useBehavior(
          definition,
          () => ({ ...current.value, ...callbacks }) as never,
        );
        instance = ui.instance;
        actions = ui.actions;
        return () => {
          renders++;
          return renderNodes(template, ui);
        };
      },
    });
    const app = createApp(Harness);
    app.mount(container);

    return {
      async setProps(next) {
        current.value = { ...current.value, ...resolveProps(next) };
        await nextTick();
      },
      state: () => instance!.getState() as Readonly<Record<string, unknown>>,
      async call(action, ...args) {
        // The handle's `actions`, as a consumer calls them.
        const result = await (
          actions as Record<string, (...args: readonly unknown[]) => unknown>
        )[action]!(...args);
        await nextTick();
        return result;
      },
      renderCount: () => renders,
      async unmount() {
        app.unmount();
      },
    };
  },
};
