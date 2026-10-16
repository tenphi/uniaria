/*
 * Portions adapted from React Spectrum (textSelection.ts):
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
 * Text-selection suppression while a touch press lasts
 * (`docs/interaction-layer.md` §1.58-63), after React Aria's
 * `textSelection.ts`.
 *
 * - Elsewhere: `user-select: none` (`-webkit-user-select` in Safari) inline
 *   on the pressed element only, and its previous inline value back when the
 *   press ends. Page-wide toggling was slow (React Spectrum #1609).
 * - iOS: a long press selects the text around the element too, so the whole
 *   page gets `-webkit-user-select: none`, restored 300 ms after the last
 *   press ends (iOS can still select just after the finger lifts). The state
 *   is per window under a `Symbol.for` key, so overlapping presses and copies
 *   of UniAria share it.
 */

import { isIOS } from './platform';

const KEY = Symbol.for('@uniaria/text-selection/v1');

/** iOS can start a selection just after the finger lifts. */
const RESTORE_DELAY = 300;

interface PageState {
  state: 'default' | 'disabled' | 'restoring';
  saved: string;
}

type SelectionWindow = Window & { [KEY]?: PageState };

const saved = new WeakMap<HTMLElement, string>();

function pageState(view: Window): PageState {
  return ((view as SelectionWindow)[KEY] ??= { state: 'default', saved: '' });
}

/** Stops text selection for a touch press on `element`. */
export function disableTextSelection(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (view && isIOS(view)) {
    const page = pageState(view);
    if (page.state === 'default') {
      const { style } = element.ownerDocument.documentElement;
      page.saved = style.webkitUserSelect;
      style.webkitUserSelect = 'none';
    }
    page.state = 'disabled';
    return;
  }
  const property = userSelectProperty(element);
  saved.set(element, element.style[property]);
  element.style[property] = 'none';
}

/** Safari supports only the prefixed property. */
function userSelectProperty(
  element: HTMLElement,
): 'userSelect' | 'webkitUserSelect' {
  return 'userSelect' in element.style ? 'userSelect' : 'webkitUserSelect';
}

/** Undoes `disableTextSelection(element)`. */
export function restoreTextSelection(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (view && isIOS(view)) {
    const page = pageState(view);
    if (page.state !== 'disabled') return;
    page.state = 'restoring';
    const { style } = element.ownerDocument.documentElement;
    view.setTimeout(() => {
      // Another press started meanwhile and owns the page now.
      if (page.state !== 'restoring') return;
      if (style.webkitUserSelect === 'none') {
        style.webkitUserSelect = page.saved;
      }
      page.saved = '';
      page.state = 'default';
    }, RESTORE_DELAY);
    return;
  }
  if (!saved.has(element)) return;
  // Keep a value the consumer set during the press.
  const property = userSelectProperty(element);
  if (element.style[property] === 'none') {
    element.style[property] = saved.get(element)!;
  }
  saved.delete(element);
  if (element.getAttribute('style') === '') element.removeAttribute('style');
}
