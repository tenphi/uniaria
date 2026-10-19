/*
 * Portions adapted from React Spectrum (FocusScope.tsx):
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
 * Focus scopes (`docs/_internal/interaction-layer.md` §5), after React Aria's
 * `FocusScope`. A scope is one part element, live while `isActive()` holds
 * (an open popover or dialog), and can:
 *
 * - contain focus: Tab and Shift+Tab cycle inside, focus that moves out is
 *   pulled back, and focus lost to the body returns after a frame;
 * - restore focus: when the scope ends with focus inside (or lost), focus
 *   returns to the element that had it when the scope started; Tab out of
 *   a scope that doesn't contain goes to the element after that one, wherever
 *   the scope sits in the DOM;
 * - auto-focus its first tabbable element when it starts.
 *
 * Scopes nest logically, not only in the DOM: a scope that starts inside
 * another, or while another is active, is its child. Only the innermost
 * active scope contains. The registry is per window under `Symbol.for`.
 *
 * UniAria never stops propagation: the Tab-out redirect prevents the default,
 * and containment skips Tab events whose default was prevented.
 */

import { isComposing } from './events';
import {
  firstFocusable,
  focusableWalker,
  isFocusable,
  lastFocusable,
} from './focusable';
import { modalityTrackerFor } from './modality';
import { restoreFocus } from './restore-focus';
import type { InteractionContext } from './types';
import { partEffect } from './types';

export interface FocusScopeOptions {
  /** The part that holds the scope. */
  readonly part: string;
  /** The scope is live, as while its popover is open. */
  isActive(): boolean;
  /** Tab cycles inside, and focus that leaves is pulled back. */
  shouldContain?(): boolean;
  /** When the scope ends with focus inside, focus returns to the element it came from. */
  shouldRestoreFocus?(): boolean;
  /** Focus the first tabbable element when the scope starts, unless focus is already inside. */
  shouldAutoFocus?(): boolean;
}

interface Scope {
  readonly element: HTMLElement;
  parent: Scope | null;
  nodeToRestore: HTMLElement | null;
  readonly options: FocusScopeOptions;
}

interface Registry {
  active: Scope | null;
  readonly scopes: Set<Scope>;
}

const KEY = Symbol.for('@uniaria/focus-scopes/v1');

type RegistryWindow = Window & { [KEY]?: Registry };

function registryFor(view: Window): Registry {
  return ((view as RegistryWindow)[KEY] ??= {
    active: null,
    scopes: new Set(),
  });
}

const isInScope = (node: Node | null, scope: Scope) =>
  node !== null && scope.element.contains(node);

/** `ancestor` is a strict logical ancestor of `scope`. */
function isAncestor(ancestor: Scope, scope: Scope): boolean {
  for (let parent = scope.parent; parent; parent = parent.parent) {
    if (parent === ancestor) return true;
  }
  return false;
}

/** In the scope, or in a scope nested under it. */
function isInChildScope(
  registry: Registry,
  node: Node | null,
  scope: Scope,
): boolean {
  if (isInScope(node, scope)) return true;
  for (const other of registry.scopes) {
    if (isAncestor(scope, other) && isInScope(node, other)) return true;
  }
  return false;
}

function isInAnyScope(registry: Registry, node: Node | null): boolean {
  for (const scope of registry.scopes) if (isInScope(node, scope)) return true;
  return false;
}

/** No contained scope between the active one and this one. */
function shouldContain(registry: Registry, scope: Scope): boolean {
  for (let current = registry.active; current; current = current.parent) {
    if (current === scope) return true;
    if (current.options.shouldContain?.()) return false;
  }
  return true;
}

/** This scope is the innermost one on the active path that restores. */
function shouldRestore(registry: Registry, scope: Scope): boolean {
  for (let current = registry.active; current; current = current.parent) {
    if (current === scope) return true;
    if (current.nodeToRestore) return false;
  }
  return false;
}

function focus(element: HTMLElement, shouldScroll = false): void {
  element.focus(shouldScroll ? undefined : { preventScroll: true });
}

/** The first tabbable element, else the first focusable one, else the scope itself (a dialog with `tabindex="-1"`). */
function firstInScope(element: HTMLElement): HTMLElement | null {
  return (
    firstFocusable(element, { isTabbable: true }) ??
    firstFocusable(element) ??
    (isFocusable(element) ? element : null)
  );
}

/** TalkBack on Android Chrome loops when focus is pulled back (Chromium 384844019). */
function isAndroidChrome(view: Window): boolean {
  const { userAgent } = view.navigator;
  return /Android/i.test(userAgent) && /Chrome/i.test(userAgent);
}

function isTabNavigation(event: KeyboardEvent): boolean {
  return (
    event.key === 'Tab' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !isComposing(event)
  );
}

/** Starts a scope on `element`; returns the function that ends it. */
function activate(element: HTMLElement, options: FocusScopeOptions) {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return () => undefined;
  const registry = registryFor(view);
  const shouldContainOwn = () => options.shouldContain?.() ?? false;
  const shouldRestoreOwn = () => options.shouldRestoreFocus?.() ?? false;

  // The innermost scope around it in the DOM, else the active one (a popover
  // placed elsewhere, opened from inside a dialog).
  let parent: Scope | null = null;
  for (const other of registry.scopes) {
    if (other.element !== element && other.element.contains(element)) {
      if (!parent || parent.element.contains(other.element)) parent = other;
    }
  }
  parent ??= registry.active;

  const previous = document.activeElement as HTMLElement | null;
  const scope: Scope = {
    element,
    parent,
    nodeToRestore:
      shouldRestoreOwn() &&
      previous &&
      previous !== document.body &&
      !element.contains(previous)
        ? previous
        : null,
    options,
  };
  registry.scopes.add(scope);

  // The last element focused inside, for containment.
  let focusedNode: HTMLElement | null = null;
  let frame = 0;

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    const { active } = registry;
    const isEntering = !active || isAncestor(active, scope);
    if (shouldContainOwn()) {
      if (isEntering && isInScope(target, scope)) {
        registry.active = scope;
        focusedNode = target;
      } else if (
        shouldContain(registry, scope) &&
        !isInChildScope(registry, target, scope)
      ) {
        // Focus arrived from outside, as from the address bar.
        const fallback = focusedNode?.isConnected
          ? focusedNode
          : registry.active && firstInScope(registry.active.element);
        if (fallback) focus(fallback);
      } else if (shouldContain(registry, scope)) {
        focusedNode = target;
      }
    } else if (shouldRestoreOwn()) {
      if (isEntering && isInScope(document.activeElement, scope)) {
        registry.active = scope;
      }
    } else if (isInScope(target, scope)) {
      registry.active = scope;
    } else if (!isInAnyScope(registry, target)) {
      registry.active = null;
    }
  };

  // Focus lost to the body (a removed element, a press on a backdrop) comes
  // back after a frame. Reading activeElement rather than relatedTarget lets
  // a click into an iframe inside the scope through.
  const refocusSoon = (target: HTMLElement | null) => {
    view.cancelAnimationFrame(frame);
    frame = view.requestAnimationFrame(() => {
      const modality = modalityTrackerFor(element)?.get() ?? null;
      const isTalkBack =
        (modality === 'virtual' || modality === null) && isAndroidChrome(view);
      const active = document.activeElement;
      if (
        isTalkBack ||
        !active ||
        !shouldContainOwn() ||
        !shouldContain(registry, scope) ||
        isInChildScope(registry, active, scope)
      ) {
        return;
      }
      registry.active = scope;
      if (target?.isConnected && isInScope(target, scope)) {
        focusedNode = target;
        focus(target);
      } else {
        const first = firstInScope(element);
        if (first) focus(first);
      }
    });
  };

  const onFocusOut = (event: FocusEvent) => {
    if (shouldContainOwn()) refocusSoon(event.target as HTMLElement);
  };

  // WebKit fires no focusout when the focused element is removed.
  const observer = new view.MutationObserver(() => {
    if (!shouldContainOwn() || !focusedNode || focusedNode.isConnected) return;
    const current = document.activeElement;
    if (!current || current === document.body) refocusSoon(focusedNode);
  });
  observer.observe(element, { childList: true, subtree: true });

  const onContainKey = (event: KeyboardEvent) => {
    if (!isTabNavigation(event) || event.defaultPrevented) return;
    if (!shouldContainOwn() || !shouldContain(registry, scope)) return;
    const focused = document.activeElement;
    if (!focused || !isInScope(focused, scope)) return;
    const walker = focusableWalker(element, { isTabbable: true });
    walker.currentNode = focused;
    const next =
      ((event.shiftKey
        ? walker.previousNode()
        : walker.nextNode()) as HTMLElement | null) ??
      (event.shiftKey
        ? lastFocusable(element, { isTabbable: true })
        : firstFocusable(element, { isTabbable: true }));
    // With nothing tabbable inside, Tab goes nowhere.
    event.preventDefault();
    if (!next) return;
    focus(next, true);
    if (next.localName === 'input') (next as HTMLInputElement).select();
  };

  // Tab out of a scope that restores but doesn't contain: continue from
  // the element focus came from, so a popover placed at the end of the
  // document still sits in the tab order after its trigger.
  const onRestoreKey = (event: KeyboardEvent) => {
    if (!isTabNavigation(event) || shouldContainOwn() || !shouldRestoreOwn()) {
      return;
    }
    if (!shouldContain(registry, scope)) return;
    const focused = document.activeElement as HTMLElement | null;
    if (!isInChildScope(registry, focused, scope)) return;
    if (!shouldRestore(registry, scope)) return;
    const { body } = document;
    if (!scope.nodeToRestore?.isConnected || scope.nodeToRestore === body) {
      scope.nodeToRestore = null;
      return;
    }
    const step = (walker: TreeWalker) =>
      (event.shiftKey
        ? walker.previousNode()
        : walker.nextNode()) as HTMLElement | null;
    const walker = focusableWalker(body, { isTabbable: true });
    walker.currentNode = focused!;
    let next = step(walker);
    if (next && isInChildScope(registry, next, scope)) return;
    const origin = scope.nodeToRestore;
    walker.currentNode = origin;
    do {
      next = step(walker);
    } while (next && isInChildScope(registry, next, scope));
    event.preventDefault();
    if (next) focus(next, true);
    // Nothing after the trigger: leave the page if the trigger is in no
    // scope, or go back to the trigger (a menu in a popover).
    else if (!isInAnyScope(registry, origin)) focused!.blur();
    else focus(origin, true);
  };

  document.addEventListener('focusin', onFocusIn);
  element.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onContainKey);
  document.addEventListener('keydown', onRestoreKey, true);

  if (options.shouldAutoFocus?.()) {
    registry.active = scope;
    if (!element.contains(document.activeElement)) {
      const first = firstInScope(element);
      if (first) focus(first);
    }
  }

  return () => {
    document.removeEventListener('focusin', onFocusIn);
    element.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('keydown', onContainKey);
    document.removeEventListener('keydown', onRestoreKey, true);
    observer.disconnect();
    view.cancelAnimationFrame(frame);

    const active = document.activeElement;
    const isRestoring =
      shouldRestoreOwn() &&
      scope.nodeToRestore !== null &&
      (isInChildScope(registry, active, scope) ||
        (active === document.body && shouldRestore(registry, scope)));
    // The path to restore along, as it is now.
    const path: { scope: Scope; nodeToRestore: HTMLElement | null }[] = [];
    for (let current: Scope | null = scope; current; current = current.parent) {
      path.push({ scope: current, nodeToRestore: current.nodeToRestore });
    }

    registry.scopes.delete(scope);
    if (registry.active === scope) registry.active = scope.parent;
    for (const other of registry.scopes) {
      if (other.parent === scope) other.parent = scope.parent;
      // A dialog opened from a menu returns focus to the menu's trigger.
      if (
        scope.nodeToRestore &&
        other.nodeToRestore &&
        isInScope(other.nodeToRestore, scope)
      ) {
        other.nodeToRestore = scope.nodeToRestore;
      }
    }

    if (!isRestoring) return;
    view.requestAnimationFrame(() => {
      const current = document.activeElement;
      // Something else took focus on purpose meanwhile.
      if (current !== document.body && !element.contains(current)) return;
      for (const step of path) {
        if (step.nodeToRestore?.isConnected) {
          restoreFocus(step.nodeToRestore, { preventScroll: true });
          return;
        }
      }
      for (const step of path) {
        if (!registry.scopes.has(step.scope)) continue;
        const first = firstInScope(step.scope.element);
        if (first) {
          focus(first);
          return;
        }
      }
    });
  };
}

/** Runs a focus scope on a part while `isActive()` holds. */
export function createFocusScope(
  ctx: InteractionContext,
  options: FocusScopeOptions,
): void {
  partEffect(
    ctx,
    options.part,
    (element) => activate(element, options),
    options.isActive,
  );
}
