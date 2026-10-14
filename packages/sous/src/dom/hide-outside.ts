/*
 * Portions adapted from React Spectrum (ariaHideOutside.ts):
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
 * Hide outside: takes everything outside a set of target elements away from
 * assistive technology while a modal is open (`docs/interaction-layer.md`
 * §9), after React Aria's `ariaHideOutside`
 * (`references/react-spectrum/packages/react-aria/src/overlays/ariaHideOutside.ts`).
 *
 * - Every element under the root that is not a target, an ancestor of one or
 *   inside one gets `aria-hidden="true"`, or `inert` with `shouldUseInert`.
 *   Hiding an element hides its subtree, so the walk never descends into
 *   one, with one exception: VoiceOver ignores `aria-hidden` on a
 *   `role="row"` (WebKit 222623), so a hidden row's children are hidden one
 *   by one.
 * - Live announcer containers (`[data-sous-live-announcer]`) count as
 *   targets: the announcer sits beside the app in `<body>` and must stay
 *   audible while a modal is open.
 * - An element someone else already hid is left alone with its subtree and
 *   not tracked, so revert removes exactly what this call added.
 * - Overlapping calls share reference counts, one per attribute, kept per
 *   window under a `Symbol.for` key so that every copy of Sous on a page
 *   shares them: an element stays hidden until the last call that hid it
 *   reverts, in any order.
 * - A `MutationObserver` hides elements added outside the targets later,
 *   judged by where they are when the records arrive. Only the newest call
 *   observes, so a parent modal's call does not hide a nested modal's
 *   content. When the newest call reverts, the previous one walks its root
 *   again to catch up on what it missed, then observes again.
 *
 * Shadow DOM is not supported yet (§9.20): containment and the observer stop
 * at shadow boundaries.
 */

export interface HideOutsideOptions {
  /**
   * Nothing outside this element is hidden. Defaults to the `<body>` of the
   * first target's document.
   */
  readonly root?: Element;
  /**
   * Makes the outside `inert` rather than `aria-hidden`, which also takes it
   * out of the tab order and pointer hit-testing, as modal overlays need.
   * Elements without `inert` (SVG) get `aria-hidden` either way.
   */
  readonly shouldUseInert?: boolean;
}

/** The window property; part of the contract between copies of Sous. */
const KEY = Symbol.for('@tenphi/sous/hide-outside/v1');

/** The live announcer marks its container with this attribute. */
const LIVE_ANNOUNCER = '[data-sous-live-announcer]';

const OBSERVE: MutationObserverInit = { childList: true, subtree: true };

type HidingAttribute = 'aria-hidden' | 'inert';

/**
 * Per-window state. Its shape is the contract between copies of Sous, so
 * changing it needs a new key.
 */
interface SharedState {
  /**
   * How many active calls hide each element, per attribute: an `aria-hidden`
   * call and an `inert` call on the same element each add and remove their
   * own attribute.
   */
  readonly counts: Record<HidingAttribute, WeakMap<Element, number>>;
  /** Active calls, oldest first. Only the last one observes mutations. */
  readonly calls: ActiveCall[];
}

interface ActiveCall {
  /** What the call keeps exposed: targets, live announcers, `keepVisible()`. */
  readonly visible: Set<Element>;
  /** Stops observing while a newer call is on top. */
  suspend(): void;
  /** Catches up on what changed while suspended, then observes again. */
  resume(): void;
}

type StateWindow = Window & { [KEY]?: SharedState };

const noop = () => undefined;

function sharedState(view: Window): SharedState {
  return ((view as StateWindow)[KEY] ??= {
    counts: { 'aria-hidden': new WeakMap(), inert: new WeakMap() },
    calls: [],
  });
}

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function isRow(element: Element): boolean {
  return element.getAttribute('role') === 'row';
}

function isHiddenWith(element: Element, attribute: HidingAttribute): boolean {
  return attribute === 'inert'
    ? element.hasAttribute('inert')
    : element.getAttribute('aria-hidden') === 'true';
}

/**
 * Hides everything under the root except `targets`, their ancestors and
 * their contents, and keeps hiding what is added outside them until the
 * returned function reverts it. Reverting twice is harmless.
 */
export function hideOutside(
  targets: readonly Element[],
  options: HideOutsideOptions = {},
): () => void {
  const root = options.root ?? targets[0]?.ownerDocument.body;
  const view = root?.ownerDocument.defaultView;
  // Nothing to anchor on, or a document without a window that no one sees.
  if (!root || !view) return noop;

  const state = sharedState(view);
  const shouldUseInert = options.shouldUseInert ?? false;
  const visibleElements = new Set<Element>(targets);
  const hiddenElements = new Set<Element>();

  const attributeFor = (element: Element): HidingAttribute =>
    shouldUseInert && 'inert' in element ? 'inert' : 'aria-hidden';

  const isHidden = (element: Element) =>
    hiddenElements.has(element) || isHiddenWith(element, attributeFor(element));

  const hide = (element: Element) => {
    const attribute = attributeFor(element);
    const counts = state.counts[attribute];
    const count = counts.get(element) ?? 0;
    // Someone else hid it: the attribute stays theirs to remove.
    if (count === 0 && isHiddenWith(element, attribute)) return;
    if (count === 0) {
      element.setAttribute(attribute, attribute === 'inert' ? '' : 'true');
    }
    counts.set(element, count + 1);
    hiddenElements.add(element);
  };

  const reveal = (element: Element) => {
    const attribute = attributeFor(element);
    const counts = state.counts[attribute];
    const count = counts.get(element);
    if (!count) return;
    if (count > 1) {
      counts.set(element, count - 1);
      return;
    }
    counts.delete(element);
    element.removeAttribute(attribute);
  };

  const containsVisible = (element: Element) => {
    for (const visible of visibleElements) {
      if (element.contains(visible)) return true;
    }
    return false;
  };

  const visit = (element: Element): void => {
    if (visibleElements.has(element) || hiddenElements.has(element)) return;
    if (containsVisible(element)) {
      for (const child of element.children) visit(child);
      return;
    }
    hide(element);
    // VoiceOver ignores aria-hidden on a row (WebKit 222623).
    if (isRow(element)) {
      for (const child of element.children) visit(child);
    }
  };

  const walk = (start: Element) => {
    if (start.matches(LIVE_ANNOUNCER)) visibleElements.add(start);
    for (const announcer of start.querySelectorAll(LIVE_ANNOUNCER)) {
      visibleElements.add(announcer);
    }
    visit(start);
  };

  /**
   * Whether a child added to `parent` is already exposed through a target or
   * hidden through an ancestor. A hidden row's own children are not: they
   * are hidden one by one, as the walk does.
   */
  const isCovered = (parent: Element) => {
    for (
      let ancestor: Element | null = parent;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (visibleElements.has(ancestor)) return true;
      if (isHidden(ancestor) && !(ancestor === parent && isRow(parent))) {
        return true;
      }
      if (ancestor === root) return false;
    }
    return false;
  };

  // An added node is judged where it is now, not by the record's parent: it
  // may have moved since, into a target or out of the root (§9.12).
  const onMutations = (records: MutationRecord[]) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        const parent = node.parentElement;
        if (!isElement(node) || !parent || !root.contains(node)) continue;
        if (!isCovered(parent)) walk(node);
      }
    }
  };

  const observer = new view.MutationObserver(onMutations);
  const call: ActiveCall = {
    visible: visibleElements,
    // Pending records are dropped: they may hold a nested modal that is
    // about to call hideOutside itself. resume() walks again instead.
    suspend: () => observer.disconnect(),
    resume: () => {
      walk(root);
      observer.observe(root, OBSERVE);
    },
  };

  state.calls.at(-1)?.suspend();
  state.calls.push(call);
  call.resume();

  let isReverted = false;
  return () => {
    if (isReverted) return;
    isReverted = true;
    observer.disconnect();
    const index = state.calls.indexOf(call);
    if (index !== -1) {
      state.calls.splice(index, 1);
      // The previous call takes over. It walks before this one lets go, so
      // an element both hide keeps its attribute throughout.
      if (index === state.calls.length) state.calls.at(-1)?.resume();
    }
    for (const element of hiddenElements) reveal(element);
  };
}

/**
 * Keeps `element` exposed when the newest active `hideOutside()` call in its
 * window sees it added later, as a non-modal popover opened from a modal
 * needs. It does not reveal an element that is already hidden. Returns a
 * function that unregisters it; with no active call there is nothing to do.
 */
export function keepVisible(element: Element): () => void {
  const view = element.ownerDocument.defaultView as StateWindow | null;
  const call = view?.[KEY]?.calls.at(-1);
  if (!call || call.visible.has(element)) return noop;
  call.visible.add(element);
  return () => {
    call.visible.delete(element);
  };
}
