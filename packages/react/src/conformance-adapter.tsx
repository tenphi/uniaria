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
import { dialog } from '@uniaria/core/dialog';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { toggleSwitch } from '@uniaria/core/switch';
import { field } from '@uniaria/core/field';
import { numberField } from '@uniaria/core/number-field';
import { textField } from '@uniaria/core/text-field';
import { toggleButton } from '@uniaria/core/toggle-button';
import { tooltip } from '@uniaria/core/tooltip';
import type {
  ConformanceAdapter,
  TemplateComponent,
  TemplateElement,
  TemplateNode,
} from '@uniaria/testing';
import { isNested } from '@uniaria/testing';
import type { ReactNode } from 'react';
import { StrictMode, createElement, useContext } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { OwnerContext, OwnerProvider } from './owner';
import { reactPropName, reactPropValue } from './props';
import type { ReactPartProps } from './use-component';
import { useComponent } from './use-component';

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

function renderNodes(
  nodes: readonly TemplateNode[],
  parts: Readonly<Record<string, ReactPartProps>>,
): ReactNode[] {
  return nodes.map((node, index) => {
    if (typeof node === 'string') return node;
    if (isNested(node)) return createElement(Nested, { key: index, node });
    const props: Record<string, unknown> = {
      key: index,
      ...templateProps(node),
    };
    if (node.part !== undefined) Object.assign(props, parts[node.part]);
    return createElement(node.tag, props, ...renderNodes(node.children, parts));
  });
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
    ...renderNodes(node.children, ui.parts),
  );
}

interface HarnessProps {
  readonly definition: AnyDefinition;
  readonly props: Readonly<Record<string, unknown>>;
  readonly template: readonly TemplateNode[];
  readonly onRender: () => void;
  readonly onInstance: (instance: Instance) => void;
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
  onInstance(ui.instance);
  // Components nested in the template find this one as their owner.
  return createElement(
    OwnerProvider,
    { owner: ui.instance },
    ...renderNodes(template, ui.parts),
  );
}

export const reactAdapter: ConformanceAdapter = {
  name: 'react',
  async mount({ component, props, template, events, record, container }) {
    const definition = definitionOf(component);
    let renders = 0;
    let instance: Instance | undefined;
    let current = { ...props };
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
              onInstance: (next) => (instance = next),
            }),
          ),
        ),
      );
    render();

    return {
      async setProps(next) {
        current = { ...current, ...next };
        render();
      },
      state: () => instance!.getState() as Readonly<Record<string, unknown>>,
      renderCount: () => renders,
      async unmount() {
        root.unmount();
      },
    };
  },
};
