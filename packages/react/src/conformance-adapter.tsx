/**
 * The React adapter's side of the mount contract (root AGENTS.md → The mount
 * contract): renders a conformance template as React elements, spreading
 * `ui.parts.<name>` onto part elements, inside StrictMode so every scenario
 * also runs through a double mount. Test support only; not exported.
 */

import type { AnyDefinition, Instance } from '@uniaria/core';
import { answers, callbackName } from '@uniaria/core';
import { button } from '@uniaria/core/button';
import { checkbox } from '@uniaria/core/checkbox';
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { combobox } from '@uniaria/core/combobox';
import { dialog } from '@uniaria/core/dialog';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { toggleSwitch } from '@uniaria/core/switch';
import { field } from '@uniaria/core/field';
import { listbox } from '@uniaria/core/listbox';
import { numberField } from '@uniaria/core/number-field';
import { select } from '@uniaria/core/select';
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
import type { ReactNode } from 'react';
import { StrictMode, createElement, useContext } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { OwnerContext, OwnerProvider } from './owner';
import { reactPropName, reactPropValue } from './props';
import type { ComponentHandle } from './use-component';
import { useComponent, useComponentState } from './use-component';

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
  combobox,
};

/** Form values a consumer would pass as defaults in React. */
const UNCONTROLLED: Readonly<Record<string, string>> = {
  value: 'defaultValue',
  checked: 'defaultChecked',
};

function templateProps(node: TemplateElement): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const isFormControl = ['input', 'textarea', 'select'].includes(node.tag);
  for (const [name, value] of Object.entries(node.attrs)) {
    const prop = (isFormControl && UNCONTROLLED[name]) || reactPropName(name);
    props[prop] = reactPropValue(prop, value);
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

/**
 * Spreads part props onto part elements: `ui.parts.<name>`, or for an item
 * part `ui.getItemProps(part, key)` with the key the template gives as
 * `data-key`, as a consumer mapping its items would. Rows rendered from
 * state are keyed by part and `data-key`, so a row that stays keeps its
 * element.
 */
function renderNodes(
  nodes: readonly TemplateNode[],
  ui: ComponentHandle<AnyDefinition>,
  isKeyed = false,
): ReactNode[] {
  const itemParts: readonly string[] = ui.instance.definition.itemParts ?? [];
  return nodes.map((node, index) => {
    if (typeof node === 'string') return node;
    if (isNested(node)) return createElement(Nested, { key: index, node });
    if (isRows(node)) return createElement(Rows, { key: index, node, ui });
    const dataKey = node.attrs['data-key'];
    const props: Record<string, unknown> = {
      key:
        isKeyed && dataKey !== undefined ? `${node.part}\n${dataKey}` : index,
      ...templateProps(node),
    };
    if (node.part !== undefined) {
      const key = node.attrs['data-key'];
      const own = props.className;
      Object.assign(
        props,
        itemParts.includes(node.part) && key !== undefined
          ? ui.getItemProps(node.part, key)
          : (ui.parts as Readonly<Record<string, unknown>>)[node.part],
      );
      // Keeps the root's `uni-<name>` class beside the consumer's own, as a
      // consumer adding classes does.
      if (own && props.className && own !== props.className) {
        props.className = `${props.className as string} ${own as string}`;
      }
      // A consumer's id goes after the spread, where it overrides the
      // part's (root AGENTS.md → DOM, lifecycle and SSR).
      if (node.attrs.id !== undefined) props.id = node.attrs.id;
    }
    return createElement(
      node.tag,
      props,
      ...renderNodes(node.children, ui, isKeyed),
    );
  });
}

const NONE: readonly string[] = [];

/**
 * Rows from the component's `renderedKeys` and `renderedSections`, in a
 * component of their own, as the virtualization spec's consumer writes
 * them: a change of the rendered set renders this, never the owner.
 */
function Rows({
  node,
  ui,
}: {
  readonly node: TemplateRows;
  readonly ui: ComponentHandle<AnyDefinition>;
}) {
  const keys = useComponentState(
    ui,
    (state: { renderedKeys?: readonly string[] }) => state.renderedKeys ?? NONE,
  );
  const sections = useComponentState(
    ui,
    (state: { renderedSections?: readonly string[] }) =>
      state.renderedSections ?? NONE,
  );
  return renderNodes(node.rows({ keys, sections }), ui, true);
}

function definitionOf(component: string): AnyDefinition {
  const definition = definitions[component];
  if (!definition) {
    throw new Error(`No definition registered for "${component}".`);
  }
  return definition;
}

/**
 * A component nested in the template, rendered as a consumer would: its own
 * `useComponent()`, inside its owner's provider.
 */
function Nested({ node }: { readonly node: TemplateComponent }) {
  const definition = definitionOf(node.component);
  // A link to the component it sits in directly, passed as a consumer
  // would: `useComponent(button, { tooltip: hint.instance })`.
  const parent = useContext(OwnerContext)?.instance;
  const links: Record<string, unknown> = {};
  for (const key of definition.links ?? []) {
    if (parent && answers(parent.definition, key)) links[key.name] = parent;
  }
  const ui = useComponent(definition, { ...links, ...node.props } as never);
  return createElement(
    OwnerProvider,
    { owner: ui.instance },
    ...renderNodes(node.children, ui),
  );
}

interface HarnessProps {
  readonly definition: AnyDefinition;
  readonly props: Readonly<Record<string, unknown>>;
  readonly template: readonly TemplateNode[];
  readonly onRender: () => void;
  readonly onInstance: (instance: Instance, actions: object) => void;
}

function Harness({
  definition,
  props,
  template,
  onRender,
  onInstance,
}: HarnessProps) {
  onRender();
  const ui = useComponent(definition, props as never);
  onInstance(ui.instance, ui.actions);
  // Components nested in the template find this one as their owner.
  return createElement(
    OwnerProvider,
    { owner: ui.instance },
    ...renderNodes(template, ui),
  );
}

export const reactAdapter: ConformanceAdapter = {
  name: 'react',
  async mount({ component, props, template, events, record, container }) {
    const definition = definitionOf(component);
    let renders = 0;
    let instance: Instance | undefined;
    let actions: object = {};
    let current = resolveProps(props);
    const callbacks: Record<string, (detail: unknown) => void> = {};
    for (const name of events) {
      callbacks[callbackName(name)] = (detail) => record(name, detail);
    }

    const root = createRoot(container);
    const render = () =>
      flushSync(() =>
        root.render(
          createElement(
            StrictMode,
            null,
            createElement(Harness, {
              definition,
              props: { ...current, ...callbacks },
              template,
              onRender: () => renders++,
              onInstance: (next, nextActions) => {
                instance = next;
                actions = nextActions;
              },
            }),
          ),
        ),
      );
    render();

    return {
      async setProps(next) {
        current = { ...current, ...resolveProps(next) };
        render();
      },
      state: () => instance!.getState() as Readonly<Record<string, unknown>>,
      async call(action) {
        // The handle's `actions`, as a consumer calls them.
        (actions as Record<string, () => void>)[action]!();
      },
      renderCount: () => renders,
      async unmount() {
        root.unmount();
      },
    };
  },
};
