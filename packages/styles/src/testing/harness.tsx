/**
 * The page the component tests mount into (spec: Testing → Components):
 * the default styles over the default surface, an input to Tab from, and
 * helpers that render through either adapter and read what it draws.
 */

import { keyboard } from '@uniaria/testing/browser';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterAll, beforeAll } from 'vitest';

import { loadStyles } from './browser';

/** What `setUpPage()` adds: the components' container and the input before it. */
export const page = {} as {
  container: HTMLElement;
  sentinel: HTMLInputElement;
};

/** Loads the styles and adds the page's elements for the file's tests. */
export function setUpPage(): void {
  let unload: () => void;
  beforeAll(async () => {
    unload = await loadStyles();
    // The page behind the components is the default surface.
    document.body.style.background = 'var(--uni-surface-color)';
    page.sentinel = document.createElement('input');
    page.sentinel.setAttribute('aria-label', 'Before');
    page.container = document.createElement('div');
    document.body.append(page.sentinel, page.container);
  });
  afterAll(() => {
    unload();
    page.sentinel.remove();
    page.container.remove();
    document.body.style.background = '';
  });
}

/**
 * Two frames, as the binder writes attributes after mount, then every
 * transition at its end, so colors read as the state's own.
 */
export async function settle(): Promise<void> {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  for (const animation of document.getAnimations()) animation.finish();
}

/**
 * Opens an overlay from its trigger within the page, without a pointer's
 * round trip, and waits out the frames its component's root is marked
 * `entering`, so its opening transition has just begun. Resolves to the
 * overlay's opacity while `entering`: its hidden look's.
 */
export async function startOpening(
  trigger: HTMLElement,
  root: Element,
  overlay: Element = root,
): Promise<number> {
  const marked = new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!root.hasAttribute('data-entering')) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(root, { attributeFilter: ['data-entering'] });
  });
  trigger.click();
  await marked;
  const opacity = Number(style(overlay).opacity);
  while (root.hasAttribute('data-entering')) {
    await new Promise(requestAnimationFrame);
  }
  return opacity;
}

/**
 * Records how an overlay closes from now on: the properties transitions
 * start on while it is marked `exiting`. Read after it has closed, so a
 * test needn't catch a short transition across a round trip to the test
 * runner.
 */
export function recordExit(overlay: Element): ReadonlySet<string> {
  const properties = new Set<string>();
  overlay.addEventListener('transitionrun', (event) => {
    const transition = event as TransitionEvent;
    if (
      transition.target === overlay &&
      transition.pseudoElement === '' &&
      overlay.hasAttribute('data-exiting')
    ) {
      properties.add(transition.propertyName);
    }
  });
  return properties;
}

/** The first root of a component in the container. */
export function rootOf(kind: string): HTMLElement {
  const root = page.container.querySelector<HTMLElement>(
    `[data-uni="${kind}"]`,
  );
  if (!root) throw new Error(`No ${kind} root.`);
  return root;
}

/** A root's part, the first one in document order. */
export function part(root: Element, name: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-element="${name}"]`);
  if (!element) throw new Error(`No ${name} part.`);
  return element;
}

/** Boolean attributes, each with its leading space, for markup. */
export const flags = (pairs: Record<string, boolean | undefined>): string =>
  Object.entries(pairs)
    .filter(([, isOn]) => isOn)
    .map(([name]) => ` ${name}`)
    .join('');

export const style = (element: Element, pseudo?: string) =>
  getComputedStyle(element, pseudo);

/** A color token's value on the page, as `--uni-<name>-color` holds it. */
export const token = (name: string): string =>
  style(document.documentElement).getPropertyValue(`--uni-${name}-color`);

export const isChromium = navigator.userAgent.includes('Chrome/');

/** Puts markup in the container, as the elements adapter's page would. */
export async function mountHtml(html: string): Promise<void> {
  page.container.innerHTML = html;
  await settle();
}

let reactRoot: Root | undefined;

/** Renders into the container, in strict mode, as the React adapter's page would. */
export async function mountReact(node: ReactNode): Promise<void> {
  reactRoot?.unmount();
  const host = document.createElement('div');
  page.container.replaceChildren(host);
  reactRoot = createRoot(host);
  flushSync(() => reactRoot!.render(<StrictMode>{node}</StrictMode>));
  await settle();
}

/** Empties the container, a React root included. */
export function unmount(): void {
  reactRoot?.unmount();
  reactRoot = undefined;
  page.container.innerHTML = '';
}

/** Keyboard focus from the input before the components. */
export async function tabInto(): Promise<void> {
  page.sentinel.focus();
  await keyboard.tab();
  await settle();
}
