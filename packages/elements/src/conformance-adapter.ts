/**
 * The custom-elements side of the mount contract (root AGENTS.md → The mount
 * contract): renders a conformance template as plain DOM, the way a consumer
 * writes it, wraps the part elements in the component's host, and applies
 * props as properties. Test support only; not exported.
 */

import { answers, domEventName } from '@uniaria/core';
import type { AnyDefinition } from '@uniaria/core';
import { virtualizer } from '@uniaria/core/virtual';
import type {
  ConformanceAdapter,
  RenderedRows,
  TemplateComponent,
  TemplateRows,
} from '@uniaria/testing';
import { VIRTUALIZER, renderTemplate } from '@uniaria/testing';

import './button';
import './toggle-button';
import './field';
import './text-field';
import './checkbox';
import './checkbox-group';
import './switch';
import './radio';
import './radio-group';
import './dialog';
import './popover';
import './tooltip';
import './number-field';
import './listbox';
import './select';
import './autocomplete';
import './combobox';
import type { UniElement } from './define-element';

/**
 * Wraps the smallest run of siblings that holds every part in `host`, so
 * markup around the parts (a form, a sibling button) stays outside it.
 */
function wrap(parts: readonly Element[], host: HTMLElement): void {
  let ancestor = parts[0]!.parentNode!;
  while (!parts.every((part) => ancestor.contains(part))) {
    ancestor = ancestor.parentNode!;
  }
  const children = Array.from(ancestor.childNodes);
  const holding = children.filter((child) =>
    parts.some((part) => child.contains(part)),
  );
  const first = children.indexOf(holding[0]!);
  const last = children.indexOf(holding.at(-1)!);
  ancestor.insertBefore(host, holding[0]!);
  host.append(...children.slice(first, last + 1));
}

interface RenderedRowsState {
  readonly renderedKeys: readonly string[];
  readonly renderedSections: readonly string[];
}

/** A keyed row's identity: its part and `data-key`. */
function rowId(node: Node): string | null {
  if (!(node instanceof Element) || !node.hasAttribute('data-key')) return null;
  return `${node.getAttribute('data-element')}\n${node.getAttribute('data-key')}`;
}

/**
 * Makes `parent`'s children the `next` nodes, keeping each element whose
 * part and `data-key` stay (and patching its keyed children, a group's), as
 * a keyed renderer such as lit-html's `repeat` does. Kept rows are never
 * moved, so a focused option keeps focus.
 */
function patch(parent: ParentNode, next: readonly Node[]): void {
  const current = new Map<string, Element>();
  for (const child of Array.from(parent.childNodes)) {
    const id = rowId(child);
    if (id !== null) current.set(id, child as Element);
  }
  const wanted = next.map((node) => {
    const id = rowId(node);
    const kept = id === null ? undefined : current.get(id);
    if (!kept) return node;
    current.delete(id!);
    if (Array.from(node.childNodes).some((child) => rowId(child) !== null)) {
      patch(kept, Array.from(node.childNodes));
    }
    return kept;
  });
  const keep = new Set(wanted);
  for (const child of Array.from(parent.childNodes)) {
    if (!keep.has(child)) child.remove();
  }
  wanted.forEach((node, index) => {
    const at = parent.childNodes[index] ?? null;
    if (at !== node) parent.insertBefore(node, at);
  });
}

/** A registered component's parts outside its root, from its definition. */
function outsideParts(component: string): readonly string[] {
  const element = document.createElement(`uni-${component}`);
  const { definition } = (element as UniElement<AnyDefinition>).instance;
  return definition.outsideParts ?? [];
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

/** Ids for hosts a nested component names by attribute. */
let hostIds = 0;

export const elementsAdapter: ConformanceAdapter = {
  name: 'elements',
  async mount({ component, props, template, events, record, container }) {
    const name = `uni-${component}`;
    if (!customElements.get(name)) {
      throw new Error(`<${name}> is not registered.`);
    }
    // Nested components get their own hosts, props set as properties.
    const nestedHosts = new Map<Element, Readonly<Record<string, unknown>>>();
    const nestedHost = (node: TemplateComponent) => {
      const element = document.createElement(`uni-${node.component}`);
      for (const [key, value] of Object.entries(node.props)) {
        (element as unknown as Record<string, unknown>)[key] = value;
      }
      nestedHosts.set(element, node.props);
      return element;
    };
    // Rows render once the host has its props, and again on each
    // renderedkeyschange.
    const rowSites: { node: TemplateRows; parent: ParentNode }[] = [];
    const renderRows = (rendered: RenderedRows) => {
      for (const { node, parent } of rowSites) {
        const fragment = renderTemplate(
          node.rows(rendered),
          document,
          component,
          {
            host: nestedHost,
            outsideParts,
          },
        );
        patch(parent, Array.from(fragment.childNodes));
      }
    };
    container.appendChild(
      renderTemplate(template, document, component, {
        host: nestedHost,
        rowsIn: (node, parent) => rowSites.push({ node, parent }),
        outsideParts,
      }),
    );
    const isOwn = (part: Element) => {
      for (let node = part.parentElement; node; node = node.parentElement) {
        if (nestedHosts.has(node)) return false;
      }
      return true;
    };
    const parts = Array.from(
      container.querySelectorAll('[data-element], [data-uni], [data-uni-part]'),
    ).filter(isOwn);
    if (parts.length === 0) throw new Error('The template has no parts.');

    const host = document.createElement(name) as UniElement<never>;
    // A nested component that links to this one goes inside its host, as a
    // consumer writes `<uni-tooltip><uni-button>…</uni-button>…</uni-tooltip>`.
    // A key found only by its attribute names the host by id, as a consumer
    // writes `option-tooltip="…"`, unless the nested props leave it unset.
    for (const [nestedHost, nestedProps] of nestedHosts) {
      if (!isOwn(nestedHost)) continue;
      const { definition } = (nestedHost as UniElement<AnyDefinition>).instance;
      const keys = (definition.links ?? []).filter((key) =>
        answers(host.instance.definition, key),
      );
      if (keys.length > 0) parts.push(nestedHost);
      for (const key of keys) {
        if (!key.isAttributeOnly) continue;
        if (key.name in nestedProps && nestedProps[key.name] === undefined) {
          continue;
        }
        host.id ||= `${component}-${(hostIds += 1)}`;
        nestedHost.setAttribute(key.attribute ?? key.name, host.id);
      }
    }
    const apply = (next: Readonly<Record<string, unknown>>) => {
      for (const [key, value] of Object.entries(resolveProps(next))) {
        (host as unknown as Record<string, unknown>)[key] = value;
      }
    };
    apply(props);
    if (rowSites.length > 0) {
      const state = host.instance.getState() as Partial<RenderedRowsState>;
      renderRows({
        keys: state.renderedKeys ?? [],
        sections: state.renderedSections ?? [],
      });
      // Synchronously, as the virtualization spec asks of consumers.
      host.addEventListener('renderedkeyschange', (domEvent) => {
        if (domEvent.target !== host) return;
        renderRows((domEvent as CustomEvent<RenderedRows>).detail);
      });
    }
    // Events bubble: a nested component's own events aren't this one's.
    for (const event of events) {
      host.addEventListener(domEventName(event), (domEvent) => {
        if (domEvent.target !== host) return;
        record(event, (domEvent as CustomEvent).detail);
      });
    }
    wrap(parts, host);

    return {
      async setProps(next) {
        apply(next);
      },
      state: () =>
        host.instance.getState() as Readonly<Record<string, unknown>>,
      async call(action, ...args) {
        // The element's own method, as a consumer calls it.
        return await (
          host as unknown as Record<
            string,
            (...args: readonly unknown[]) => unknown
          >
        )[action]!(...args);
      },
      renderCount: () => 0,
      async unmount() {
        container.replaceChildren();
      },
    };
  },
};
