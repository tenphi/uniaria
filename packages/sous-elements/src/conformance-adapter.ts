/**
 * The custom-elements side of the mount contract (root AGENTS.md → The mount
 * contract): renders a conformance template as plain DOM, the way a consumer
 * writes it, wraps the part elements in the component's host, and applies
 * props as properties. Test support only; not exported.
 */

import { domEventName } from '@tenphi/sous';
import type { ConformanceAdapter } from '@tenphi/sous-testing';
import { renderTemplate } from '@tenphi/sous-testing';

import './button';
import './toggle-button';
import './field';
import './text-field';
import './checkbox';
import type { SousElement } from './define-element';

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

export const elementsAdapter: ConformanceAdapter = {
  name: 'elements',
  async mount({ component, props, template, events, record, container }) {
    const name = `sous-${component}`;
    if (!customElements.get(name)) {
      throw new Error(`<${name}> is not registered.`);
    }
    container.appendChild(renderTemplate(template, document));
    const parts = Array.from(container.querySelectorAll('[data-part]'));
    if (parts.length === 0) throw new Error('The template has no parts.');

    const host = document.createElement(name) as SousElement<never>;
    const apply = (next: Readonly<Record<string, unknown>>) => {
      for (const [key, value] of Object.entries(next)) {
        (host as unknown as Record<string, unknown>)[key] = value;
      }
    };
    apply(props);
    for (const event of events) {
      host.addEventListener(domEventName(event), (domEvent) =>
        record(event, (domEvent as CustomEvent).detail),
      );
    }
    wrap(parts, host);

    return {
      async setProps(next) {
        apply(next);
      },
      state: () =>
        host.instance.getState() as Readonly<Record<string, unknown>>,
      renderCount: () => 0,
      async unmount() {
        container.replaceChildren();
      },
    };
  },
};
