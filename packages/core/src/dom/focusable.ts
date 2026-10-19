/*
 * Portions adapted from React Spectrum (isFocusable.ts, isElementVisible.ts,
 * FocusScope.tsx):
 * Copyright 2020 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR REPRESENTATIONS OF ANY KIND, either express or implied. See
 * the License for the specific language governing permissions and limitations
 * under the License.
 */

/**
 * What can take focus, and in which order Tab visits it
 * (`docs/_internal/interaction-layer.md` §5.2, 5.44-48), after React Aria.
 *
 * - Focusable: a natively focusable element or any `[tabindex]`, not
 *   disabled, not `hidden`, not inside `inert`, and rendered and visible
 *   (`checkVisibility`, which also hides a closed `<details>` except its
 *   `<summary>`).
 * - Tabbable: focusable without `tabindex="-1"`. Of a radio group, only the
 *   checked radio is tabbable, or the first one when none is checked.
 */

const FOCUSABLE = [
  'input:not([disabled]):not([type=hidden])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'a[href]',
  'area[href]',
  'summary',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable^="false"])',
];

const FOCUSABLE_SELECTOR = [
  ...FOCUSABLE.map((selector) => `${selector}:not([hidden])`),
  '[tabindex]:not([disabled]):not([hidden])',
].join(',');

const TABBABLE_SELECTOR = [
  ...FOCUSABLE,
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
]
  .map((selector) => `${selector}:not([hidden]):not([tabindex="-1"])`)
  .join(',');

export interface FocusableOptions {
  /** Only elements Tab reaches. */
  readonly isTabbable?: boolean;
  /** Further filter, such as skipping one part. */
  accept?(element: Element): boolean;
}

function isVisible(element: Element): boolean {
  return element.checkVisibility({ visibilityProperty: true });
}

function isInert(element: Element): boolean {
  return element.closest('[inert]') !== null;
}

export function isFocusable(element: Element): boolean {
  return (
    element.matches(FOCUSABLE_SELECTOR) &&
    !isInert(element) &&
    isVisible(element)
  );
}

export function isTabbable(element: Element): boolean {
  return (
    element.matches(TABBABLE_SELECTOR) &&
    !isInert(element) &&
    isVisible(element)
  );
}

function radiosInGroup(radio: HTMLInputElement): HTMLInputElement[] {
  const { form } = radio;
  if (!form) {
    const selector = `input[type="radio"][name="${CSS.escape(radio.name)}"]`;
    return [
      ...radio.ownerDocument.querySelectorAll<HTMLInputElement>(selector),
    ].filter((other) => !other.form);
  }
  // One radio comes back as the element itself, several as a RadioNodeList.
  const named = form.elements.namedItem(radio.name);
  if (!named) return [];
  if ('length' in named) {
    return [...(named as RadioNodeList)].filter(
      (node): node is HTMLInputElement =>
        (node as Element).localName === 'input',
    );
  }
  return [named as HTMLInputElement];
}

function isRadio(node: Node | null): node is HTMLInputElement {
  return (
    (node as Element | null)?.localName === 'input' &&
    (node as HTMLInputElement).type === 'radio'
  );
}

/**
 * A tree walker over the focusable (or tabbable) elements inside `root`,
 * in document order, starting at `from` when given. A walk never enters
 * `from` itself, so `nextNode()` from a container skips its contents.
 */
export function focusableWalker(
  root: Element,
  options: FocusableOptions & { readonly from?: Element } = {},
): TreeWalker {
  const { isTabbable: isTabbableOnly = false, accept, from } = options;
  const matches = isTabbableOnly ? isTabbable : isFocusable;
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const element = node as Element;
        if (from?.contains(element)) return NodeFilter.FILTER_REJECT;
        if (isTabbableOnly && isRadio(element)) {
          const group = radiosInGroup(element);
          const hasChecked = group.some((radio) => radio.checked);
          if (hasChecked ? !element.checked : false) {
            return NodeFilter.FILTER_REJECT;
          }
          // With none checked, the group is one stop: skip the rest of it.
          const current = walker.currentNode;
          if (
            !hasChecked &&
            isRadio(current) &&
            current.name === element.name
          ) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        if (matches(element) && (!accept || accept(element))) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
  if (from) walker.currentNode = from;
  return walker;
}

/** The first focusable (or tabbable) element inside `root`. */
export function firstFocusable(
  root: Element,
  options: FocusableOptions = {},
): HTMLElement | null {
  return focusableWalker(root, options).nextNode() as HTMLElement | null;
}

/** The last focusable (or tabbable) element inside `root`. */
export function lastFocusable(
  root: Element,
  options: FocusableOptions = {},
): HTMLElement | null {
  const walker = focusableWalker(root, options);
  let last: Node | null = null;
  for (let node = walker.lastChild(); node; node = walker.lastChild()) {
    last = node;
  }
  return last as HTMLElement | null;
}
