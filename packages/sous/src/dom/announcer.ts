/*
 * Portions adapted from React Spectrum (LiveAnnouncer.tsx):
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
 * The live announcer: messages for screen-reader users that nothing on the
 * page shows, like a result count or a value a spin button stepped to
 * (`docs/interaction-layer.md` §10). Modelled on React Aria's `LiveAnnouncer`
 * (`references/react-spectrum/packages/react-aria/src/live-announcer/LiveAnnouncer.tsx`).
 *
 * - One visually hidden container per document, prepended to `<body>` on the
 *   first message, holding an assertive and a polite `role="log"` region.
 *   Screen readers only track live regions that exist before their content
 *   changes, so the regions stay between messages. The container sits outside
 *   every consumer tree, and `data-sous-live-announcer` keeps it exposed
 *   while a modal hides the rest of the page.
 * - Each message is a new node, so repeating a message announces it again.
 *   It is removed after its timeout. Empty messages are dropped: they would
 *   announce nothing.
 * - Safari ignores a region inserted less than about 100 ms earlier, so
 *   messages sent in that time wait and then go in together, in order. React
 *   Aria delays only the first one, which lets the second overtake it.
 * - The announcer is stored on the window under a `Symbol.for` key, so every
 *   copy of Sous on a page shares one container. A container something else
 *   removed (a test, a framework that swaps `<body>`) is replaced on the next
 *   message.
 */

export type Politeness = 'assertive' | 'polite';

/**
 * Text to read, or the id of an element to read instead, which may stay
 * hidden: screen readers read it through `aria-labelledby`.
 */
export type AnnouncerMessage = string | { readonly 'aria-labelledby': string };

export interface AnnounceOptions {
  /**
   * `assertive` (the default) interrupts the screen reader; `polite` waits
   * until it is idle.
   */
  readonly politeness?: Politeness;
  /** How long the message stays in its region, in ms. 7000 by default. */
  readonly timeout?: number;
  /** The document to announce in; the global `document` by default. */
  readonly document?: Document;
}

/** The window property; part of the contract between copies of Sous. */
const KEY = Symbol.for('@tenphi/sous/announcer/v1');

const DEFAULT_TIMEOUT = 7000;

/**
 * Safari announces nothing into a region inserted too recently. React Aria
 * found shorter waits unreliable.
 */
const SETTLE_DELAY = 100;

/**
 * React Aria's visually hidden styles. Hiding the container is behaviour, so
 * Sous sets them through the CSSOM, which needs no stylesheet or CSP nonce.
 */
const VISUALLY_HIDDEN = {
  border: '0',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: '0',
  position: 'absolute',
  width: '1px',
  whiteSpace: 'nowrap',
} satisfies Partial<CSSStyleDeclaration>;

/** What the window holds; every copy of Sous calls it the same way. */
interface Announcer {
  announce(
    message: AnnouncerMessage,
    politeness: Politeness,
    timeout: number,
  ): void;
  /** Both regions when `politeness` is missing. */
  clear(politeness?: Politeness): void;
  destroy(): void;
  isAttached(): boolean;
}

interface Announcement {
  readonly message: AnnouncerMessage;
  readonly politeness: Politeness;
  readonly timeout: number;
}

type AnnouncerWindow = Window & { [KEY]?: Announcer };

/**
 * Reads `message` to screen-reader users. Does nothing without a document
 * (on the server) or before `<body>` exists.
 */
export function announce(
  message: AnnouncerMessage,
  options: AnnounceOptions = {},
): void {
  const text =
    typeof message === 'string' ? message : message['aria-labelledby'];
  const view = windowOf(options.document);
  if (text === '' || !view?.document.body) return;
  let announcer = view[KEY];
  if (!announcer?.isAttached()) {
    announcer?.destroy();
    announcer = view[KEY] = createAnnouncer(view);
  }
  announcer.announce(
    message,
    options.politeness ?? 'assertive',
    options.timeout ?? DEFAULT_TIMEOUT,
  );
}

/**
 * Removes the messages still in a region, and those waiting to go in, so the
 * next message is the only one read. Clears both regions by default.
 */
export function clearAnnouncer(
  politeness?: Politeness,
  document?: Document,
): void {
  windowOf(document)?.[KEY]?.clear(politeness);
}

/**
 * Removes the container and drops pending messages. The next `announce()`
 * creates it again.
 */
export function destroyAnnouncer(document?: Document): void {
  const view = windowOf(document);
  if (!view) return;
  view[KEY]?.destroy();
  delete view[KEY];
}

/** Read inside the functions only, so the module imports on the server. */
function windowOf(document: Document | undefined): AnnouncerWindow | null {
  const target = document ?? globalThis.document;
  return target?.defaultView ?? null;
}

function createAnnouncer(view: Window): Announcer {
  const document = view.document;
  const container = document.createElement('div');
  container.setAttribute('data-sous-live-announcer', '');
  Object.assign(container.style, VISUALLY_HIDDEN);
  const logs: Record<Politeness, HTMLElement> = {
    assertive: createLog(document, 'assertive'),
    polite: createLog(document, 'polite'),
  };
  container.append(logs.assertive, logs.polite);
  document.body.prepend(container);

  // The removal timer of each message node in a region.
  const timers = new Map<Element, number>();
  let queue: Announcement[] = [];
  let isSettled = false;

  const insert = ({ message, politeness, timeout }: Announcement) => {
    const node = document.createElement('div');
    if (typeof message === 'string') {
      node.textContent = message;
    } else {
      // Only an element with a role that takes a name reads its label.
      node.setAttribute('role', 'img');
      node.setAttribute('aria-labelledby', message['aria-labelledby']);
    }
    logs[politeness].append(node);
    const timer = view.setTimeout(() => {
      timers.delete(node);
      node.remove();
    }, timeout);
    timers.set(node, timer);
  };

  const settleTimer = view.setTimeout(() => {
    isSettled = true;
    const settled = queue;
    queue = [];
    settled.forEach(insert);
  }, SETTLE_DELAY);

  const clearLog = (politeness: Politeness) => {
    for (const node of logs[politeness].children) {
      view.clearTimeout(timers.get(node));
      timers.delete(node);
    }
    logs[politeness].replaceChildren();
  };

  return {
    announce(message, politeness, timeout) {
      const announcement = { message, politeness, timeout };
      if (isSettled) insert(announcement);
      else queue.push(announcement);
    },
    clear(politeness) {
      const cleared: readonly Politeness[] = politeness
        ? [politeness]
        : ['assertive', 'polite'];
      cleared.forEach(clearLog);
      queue = queue.filter((waiting) => !cleared.includes(waiting.politeness));
    },
    destroy() {
      view.clearTimeout(settleTimer);
      for (const timer of timers.values()) view.clearTimeout(timer);
      timers.clear();
      queue = [];
      container.remove();
    },
    isAttached: () => container.isConnected,
  };
}

function createLog(document: Document, politeness: Politeness): HTMLElement {
  const log = document.createElement('div');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', politeness);
  log.setAttribute('aria-relevant', 'additions');
  return log;
}
