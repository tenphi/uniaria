/*
 * Portions adapted from React Spectrum (useTypeSelect.ts, ListKeyboardDelegate.ts):
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
 * Typeahead: typing moves focus to the first item whose text starts with what
 * was typed (interaction layer §11). Modelled on React Aria's `useTypeSelect`
 * and `ListKeyboardDelegate.getKeyForSearch`
 * (`references/react-spectrum/packages/react-aria/src/selection/`).
 *
 * DOM-free, like the rest of `collections/`: `handleKey` reads the few
 * keydown fields it needs and returns whether the key joined the query (the
 * caller calls `preventDefault`) and which key to focus. It never moves focus
 * or changes selection itself, and it never touches propagation.
 *
 * The query lasts until a second passes without a keystroke, matched or not,
 * as in Chromium's and Firefox's `<select>` (React Aria empties it when a
 * letter misses but keeps it when a Space misses). While it lasts, Space
 * types a space instead of selecting, so "New York" can be typed, and a typo
 * leaves focus where it is rather than starting a new query on the next
 * letter; pausing starts over.
 *
 * No timers: the query expires when more than a second separates two
 * keystrokes, measured with the events' own `timeStamp`, so an unmounted
 * collection leaves nothing behind.
 */

/** The keydown fields typeahead reads. A DOM `KeyboardEvent` fits as is. */
export interface TypeaheadInput {
  /** `KeyboardEvent.key`. */
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  /** Milliseconds on one clock per collection, like `Event.timeStamp`. */
  readonly timeStamp: number;
}

export interface TypeaheadResult<Key> {
  /**
   * The key joined the query, matched or not: the caller should call
   * `preventDefault`. Only a Space with no query in progress stays out.
   */
  readonly isHandled: boolean;
  /** The key to focus (not to select), or `null` when nothing matched. */
  readonly key: Key | null;
}

export interface Typeahead {
  /**
   * Adds a printable key to the query and asks `search` for the item to
   * focus (usually `findByText`). A miss keeps the query, so the next key
   * extends it.
   */
  handleKey<Key>(
    input: TypeaheadInput,
    search: (query: string) => Key | null,
  ): TypeaheadResult<Key>;
  /**
   * Whether a query is in progress at `timeStamp`, i.e. whether a Space
   * without modifiers would join it. Handlers that see Space before the
   * collection does (an item's press) ask this to leave Space to typeahead,
   * since Sous never stops propagation.
   */
  isSearching(timeStamp: number): boolean;
  /** Forgets the query. */
  reset(): void;
}

export interface FindByTextOptions<Key> {
  /** Every item key, in display order. */
  readonly keys: Iterable<Key>;
  getTextValue(key: Key): string;
  /** Items typeahead never lands on. */
  isDisabled?(key: Key): boolean;
  /** Where the search starts, inclusive: the focused key. */
  readonly fromKey?: Key | null;
  /**
   * Compares the start of each text with the query. Defaults to
   * `new Intl.Collator(undefined, { usage: 'search', sensitivity: 'base' })`;
   * pass one with the same options for the component's locale.
   */
  readonly collator?: Intl.Collator;
}

/** React Aria's `TYPEAHEAD_DEBOUNCE_WAIT_MS`. */
const QUERY_TIMEOUT_MS = 1000;

const NOT_HANDLED: TypeaheadResult<never> = Object.freeze({
  isHandled: false,
  key: null,
});

export function createTypeahead(): Typeahead {
  let query = '';
  let lastTimeStamp = 0;

  // A timestamp from before the last keystroke comes from another clock (an
  // event from another document): start over rather than trust the gap.
  const isFresh = (timeStamp: number): boolean => {
    const elapsed = timeStamp - lastTimeStamp;
    return elapsed >= 0 && elapsed <= QUERY_TIMEOUT_MS;
  };

  const isSearching = (timeStamp: number): boolean =>
    query !== '' && isFresh(timeStamp);

  return {
    handleKey(input, search) {
      // Shortcuts are not typing. This also drops AltGr characters on
      // Windows, which report Ctrl and Alt, as React Aria does.
      if (input.ctrlKey || input.metaKey || input.altKey) return NOT_HANDLED;
      const character = characterOf(input.key);
      if (character === '') return NOT_HANDLED;
      if (!isSearching(input.timeStamp)) {
        // Outside a query, Space keeps its native meaning (selection).
        if (character === ' ') return NOT_HANDLED;
        query = '';
      }
      query += character;
      lastTimeStamp = input.timeStamp;
      return { isHandled: true, key: search(query) };
    },
    isSearching,
    reset() {
      query = '';
    },
  };
}

/**
 * The first item whose text starts with `query`, case- and accent-insensitive
 * by default: from `fromKey` inclusive to the end, then from the top. Starting
 * at the focused item keeps focus there while its text still matches, so a
 * repeated letter extends the query instead of cycling through items.
 */
export function findByText<Key>(
  query: string,
  options: FindByTextOptions<Key>,
): Key | null {
  if (query === '') return null;
  const { keys, getTextValue, isDisabled, fromKey = null } = options;
  const collator = options.collator ?? getDefaultCollator();
  const isMatch = (key: Key): boolean =>
    !isDisabled?.(key) && startsWith(getTextValue(key), query, collator);

  // One pass instead of React Aria's two: the first match above `fromKey` is
  // kept for the wrap-around, and items above it are not compared after that.
  let isPastFrom = fromKey === null;
  let wrapped: Key | null = null;
  for (const key of keys) {
    if (key === fromKey) isPastFrom = true;
    else if (!isPastFrom && wrapped !== null) continue;
    if (!isMatch(key)) continue;
    if (isPastFrom) return key;
    wrapped = key;
  }
  return wrapped;
}

/**
 * The text a key types, or `''` for a named key (`Enter`, `F1`, `Dead`,
 * `Process`). Named key values start with an ASCII letter (UI Events); a
 * typed value is one code unit or starts with something else, like an emoji
 * or a cluster of non-ASCII characters.
 */
function characterOf(key: string): string {
  return key.length === 1 || !/^[a-z]/i.test(key) ? key : '';
}

/**
 * Compares as many code units as the query has, like React Aria. An item
 * without text never matches.
 */
function startsWith(
  text: string,
  query: string,
  collator: Intl.Collator,
): boolean {
  return (
    text !== '' && collator.compare(text.slice(0, query.length), query) === 0
  );
}

let defaultCollator: Intl.Collator | undefined;

/**
 * Built on first use: a collator is costly to create, and importing the
 * module should do no work.
 */
function getDefaultCollator(): Intl.Collator {
  return (defaultCollator ??= new Intl.Collator(undefined, {
    usage: 'search',
    sensitivity: 'base',
  }));
}
