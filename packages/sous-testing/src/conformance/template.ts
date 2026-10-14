/**
 * Adapter-neutral markup for conformance scenarios. A scenario describes the
 * DOM a consumer would write — part elements, their content and the
 * attributes the consumer owns — and each adapter renders it its own way:
 * React spreads part props onto these elements, the custom element wraps them
 * in its host. Scenarios never import a definition, so they can be written
 * before the implementation exists.
 */

export interface TemplateElement {
  /** Tag name, as the consumer would write it (`button`, `a`, `div`). */
  readonly tag: string;
  /** The Sous part this element is, if any (`root`, `trigger`). */
  readonly part?: string;
  /** Consumer-owned attributes, with DOM names (`class`, `for`, `aria-label`). */
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly TemplateNode[];
}

/** An element or a text node. */
export type TemplateNode = TemplateElement | string;

export type TemplateAttrs = Readonly<Record<string, string>> & {
  readonly part?: string;
};

/**
 * Builds a template element: `h('button', { part: 'root' }, 'Save')`. The
 * `part` key names the Sous part; every other key is a consumer-owned
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

/** Every part element in document order, for adapters that render templates. */
export function templateParts(
  nodes: readonly TemplateNode[],
): TemplateElement[] {
  const found: TemplateElement[] = [];
  const walk = (list: readonly TemplateNode[]) => {
    for (const node of list) {
      if (typeof node === 'string') continue;
      if (node.part !== undefined) found.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return found;
}

/**
 * Renders a template to real DOM, writing `data-part` on part elements the way
 * a consumer of the custom elements would. `decorate` lets an adapter add
 * attributes to part elements as they are created.
 */
export function renderTemplate(
  nodes: readonly TemplateNode[],
  doc: Document,
  decorate?: (element: HTMLElement, node: TemplateElement) => void,
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const append = (parent: Node, list: readonly TemplateNode[]) => {
    for (const node of list) {
      if (typeof node === 'string') {
        parent.appendChild(doc.createTextNode(node));
        continue;
      }
      const element = doc.createElement(node.tag);
      for (const [name, value] of Object.entries(node.attrs)) {
        element.setAttribute(name, value);
      }
      if (node.part !== undefined) {
        element.setAttribute('data-part', node.part);
        decorate?.(element, node);
      }
      append(element, node.children);
      parent.appendChild(element);
    }
  };
  append(fragment, nodes);
  return fragment;
}
