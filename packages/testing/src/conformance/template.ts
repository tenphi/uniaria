/**
 * Adapter-neutral markup for conformance scenarios. A scenario describes the
 * DOM a consumer would write — part elements, their content and the
 * attributes the consumer owns — and each adapter renders it its own way:
 * React spreads part props onto these elements, the custom element wraps them
 * in its host. Scenarios never import a definition, so they can be written
 * before the implementation exists.
 */

import { partElement, rootClass } from '@uniaria/core';

export interface TemplateElement {
  /** Tag name, as the consumer would write it (`button`, `a`, `div`). */
  readonly tag: string;
  /** The UniAria part this element is, if any (`root`, `trigger`). */
  readonly part?: string;
  /** Consumer-owned attributes, with DOM names (`class`, `for`, `aria-label`). */
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly TemplateNode[];
}

/**
 * Another UniAria component inside the markup, such as a checkbox in its group.
 * React renders it with its own `useComponent()`; custom elements wrap its
 * children in its own host.
 */
export interface TemplateComponent {
  /** The nested component's definition name: `checkbox`. */
  readonly component: string;
  /** Its props, passed the way the adapter's consumers pass them. */
  readonly props: Readonly<Record<string, unknown>>;
  /** Its markup: part elements in it are its own parts. */
  readonly children: readonly TemplateNode[];
}

/** What a `rows()` node renders from (Listbox virtualization spec). */
export interface RenderedRows {
  /** The component's `renderedKeys`: the options to render, in list order. */
  readonly keys: readonly string[];
  /** Its `renderedSections`: the groups to render, in list order. */
  readonly sections: readonly string[];
}

/**
 * Rows the consumer renders from the component's public state rather than
 * from every item, as a virtualized list's consumer does. React renders
 * them in a child component that selects `renderedKeys` and
 * `renderedSections`, so the owner never renders again for them; custom
 * elements render them again on `renderedkeyschange`, synchronously,
 * keeping each element whose part and `data-key` stay.
 */
export interface TemplateRows {
  readonly rows: (rendered: RenderedRows) => readonly TemplateNode[];
}

/** An element, a nested component, rows or a text node. */
export type TemplateNode =
  TemplateElement | TemplateComponent | TemplateRows | string;

export type TemplateAttrs = Readonly<Record<string, string>> & {
  readonly part?: string;
};

/**
 * Builds a template element: `h('button', { part: 'root' }, 'Save')`. The
 * `part` key names the UniAria part; every other key is a consumer-owned
 * attribute.
 */
export function h(
  tag: string,
  attrs?: TemplateAttrs | null,
  ...children: TemplateNode[]
): TemplateElement {
  const { part, ...rest } = attrs ?? {};
  return part === undefined
    ? { tag, attrs: rest, children }
    : { tag, part, attrs: rest, children };
}

/**
 * Nests another component: `nested('checkbox', { value: 'email' }, …)`.
 * Its children's `part`s are its own parts.
 */
export function nested(
  component: string,
  props?: Readonly<Record<string, unknown>> | null,
  ...children: TemplateNode[]
): TemplateComponent {
  return { component, props: props ?? {}, children };
}

/**
 * Rows rendered from the component's `renderedKeys` and `renderedSections`:
 * `rows(({ keys }) => keys.map((key) => h('li', { part: 'option', 'data-key': key }, key)))`.
 * Each row's top element carries `data-key`, as a consumer's keyed list does.
 */
export function rows(
  render: (rendered: RenderedRows) => readonly TemplateNode[],
): TemplateRows {
  return { rows: render };
}

/** Whether a node is a nested component. */
export function isNested(node: TemplateNode): node is TemplateComponent {
  return typeof node !== 'string' && 'component' in node;
}

/** Whether a node is rows rendered from the component's state. */
export function isRows(node: TemplateNode): node is TemplateRows {
  return typeof node !== 'string' && 'rows' in node;
}

/**
 * Stands for `virtualizer` from `@uniaria/core/virtual` in a scenario's
 * props: scenarios never import the implementation, so each adapter passes
 * the real one in its place.
 */
export const VIRTUALIZER: unique symbol = Symbol.for(
  'uniaria.conformance.virtualizer',
);

/**
 * The component's part elements in document order, for adapters that render
 * templates; nested components' parts and rows are left out.
 */
export function templateParts(
  nodes: readonly TemplateNode[],
): TemplateElement[] {
  const found: TemplateElement[] = [];
  const walk = (list: readonly TemplateNode[]) => {
    for (const node of list) {
      if (typeof node === 'string' || isNested(node) || isRows(node)) continue;
      if (node.part !== undefined) found.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return found;
}

/**
 * The CSS selector for a part of `component` (root AGENTS.md → Part
 * markers): the root by its `uni-<name>` class, any other part by
 * `data-scope` and `data-element`.
 */
export function partSelector(component: string, part: string): string {
  return part === 'root'
    ? `.${rootClass(component)}`
    : `[data-scope="${component}"][data-element="${partElement(part)}"]`;
}

/** Which part of `component` an element is, by its markers. */
export function partName(
  element: Element,
  component: string,
): string | undefined {
  if (element.classList.contains(rootClass(component))) return 'root';
  if (element.getAttribute('data-scope') !== component) return undefined;
  const name = element.getAttribute('data-element');
  return name ? name.charAt(0).toLowerCase() + name.slice(1) : undefined;
}

/**
 * Renders a template of the component `component` to real DOM, marking part
 * elements the way a consumer of the custom elements would: the root with
 * its `uni-<name>` class, the others with `data-element`. `decorate` lets an
 * adapter add attributes to part elements as they are created; `host`
 * creates the element for a nested component, which its children go into;
 * `rowsIn` is told where a `rows()` node goes, and renders it there itself.
 */
export function renderTemplate(
  nodes: readonly TemplateNode[],
  doc: Document,
  component: string,
  decorate?: (element: HTMLElement, node: TemplateElement) => void,
  host?: (node: TemplateComponent) => HTMLElement,
  rowsIn?: (node: TemplateRows, parent: ParentNode) => void,
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const append = (
    parent: ParentNode,
    list: readonly TemplateNode[],
    owner = component,
  ) => {
    for (const node of list) {
      if (typeof node === 'string') {
        parent.appendChild(doc.createTextNode(node));
        continue;
      }
      if (isRows(node)) {
        if (!rowsIn) {
          throw new Error('The template has rows, which need the component.');
        }
        rowsIn(node, parent);
        continue;
      }
      if (isNested(node)) {
        if (!host) {
          throw new Error(
            `The template nests "${node.component}", which needs a host.`,
          );
        }
        const element = host(node);
        append(element, node.children, node.component);
        parent.appendChild(element);
        continue;
      }
      const element = doc.createElement(node.tag);
      for (const [name, value] of Object.entries(node.attrs)) {
        element.setAttribute(name, value);
      }
      if (node.part === 'root') {
        element.classList.add(rootClass(owner));
      } else if (node.part !== undefined) {
        element.setAttribute('data-element', partElement(node.part));
      }
      if (node.part !== undefined) decorate?.(element, node);
      append(element, node.children, owner);
      parent.appendChild(element);
    }
  };
  append(fragment, nodes);
  return fragment;
}
