import { afterEach, describe, expect, it } from 'vitest';

/**
 * Smoke test for the browser project: a light-DOM custom element registers,
 * upgrades and keeps the consumer's children in place, in every engine CI runs.
 * Replace with real `defineElement` tests once it exists.
 */
describe('light-DOM custom element (smoke)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('upgrades without a shadow root and keeps its children', () => {
    const name = 'sous-smoke-test';
    if (!customElements.get(name)) {
      customElements.define(name, class extends HTMLElement {});
    }

    document.body.innerHTML = `<${name}><button data-part="trigger">Go</button></${name}>`;
    const host = document.querySelector(name);

    expect(host).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot).toBeNull();
    expect(host?.querySelector('[data-part="trigger"]')?.textContent).toBe(
      'Go',
    );
  });
});
