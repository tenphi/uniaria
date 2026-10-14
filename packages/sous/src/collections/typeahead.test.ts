import { describe, expect, it, vi } from 'vitest';

import type { FindByTextOptions, TypeaheadInput } from './typeahead';
import { createTypeahead, findByText } from './typeahead';

/** React Spectrum's ListBox test items, without the sections. */
const ITEMS = ['Foo', 'Bar', 'Baz', 'Blah', 'Bleh', 'Foo Bar', 'Foo Baz'];

type Modifiers = Pick<TypeaheadInput, 'ctrlKey' | 'metaKey' | 'altKey'>;

/**
 * A focused list driven the way a collection's keydown handler drives
 * typeahead: search from the focused key, then focus what it returns.
 */
function createList(items: readonly string[] = ITEMS) {
  const typeahead = createTypeahead();
  const search = vi.fn((query: string) =>
    findByText(query, {
      keys: items,
      getTextValue: (key) => key,
      fromKey: list.focusedKey,
    }),
  );
  const list = {
    typeahead,
    search,
    focusedKey: (items[0] ?? null) as string | null,
    time: 0,
    /** Presses `key` `after` ms after the previous keystroke. */
    press(
      key: string,
      { after = 100, ...modifiers }: Modifiers & { after?: number } = {},
    ) {
      list.time += after;
      const result = typeahead.handleKey(
        { key, timeStamp: list.time, ...modifiers },
        search,
      );
      if (result.key !== null) list.focusedKey = result.key;
      return result;
    },
    type(text: string) {
      for (const character of text) list.press(character);
    },
  };
  return list;
}

describe('createTypeahead', () => {
  it('narrows the match as letters are typed in quick succession', () => {
    const list = createList();

    expect(list.press('B')).toEqual({ isHandled: true, key: 'Bar' });
    expect(list.press('L')).toEqual({ isHandled: true, key: 'Blah' });
    expect(list.press('E')).toEqual({ isHandled: true, key: 'Bleh' });
    expect(list.search.mock.calls).toEqual([['B'], ['BL'], ['BLE']]);
  });

  it('keeps focus on the focused item while it still matches', () => {
    const list = createList();

    expect(list.press('f').key).toBe('Foo');
    expect(list.press('o').key).toBe('Foo');
    expect(list.press('o').key).toBe('Foo');
  });

  it('extends the query on a repeated letter instead of cycling', () => {
    const list = createList(['Bar', 'Baz', 'Bbq']);

    expect(list.press('b').key).toBe('Bar');
    expect(list.press('b').key).toBe('Bbq');
  });

  it('wraps to the top when nothing after the focused item matches', () => {
    const list = createList();
    list.focusedKey = 'Foo Baz';

    expect(list.press('b').key).toBe('Bar');
  });

  it('keeps the query for 1000 ms after a keystroke', () => {
    const list = createList();

    list.press('b');
    list.press('l', { after: 1000 });

    expect(list.search).toHaveBeenLastCalledWith('bl');
    expect(list.focusedKey).toBe('Blah');
  });

  it('starts a new query when more than 1000 ms passed', () => {
    const list = createList();

    expect(list.press('B').key).toBe('Bar');
    expect(list.press('B', { after: 1001 }).key).toBe('Bar');
    expect(list.search).toHaveBeenLastCalledWith('B');
  });

  it('starts a new query when the time goes backwards', () => {
    const list = createList();

    list.press('b', { after: 5000 });
    list.press('l', { after: -4000 });

    expect(list.search).toHaveBeenLastCalledWith('l');
  });

  it('empties the query on a miss and leaves the key to the browser', () => {
    const list = createList();

    expect(list.press('f').key).toBe('Foo');
    expect(list.press('x')).toEqual({ isHandled: false, key: null });
    expect(list.typeahead.isSearching(list.time)).toBe(false);
    expect(list.focusedKey).toBe('Foo');

    expect(list.press('b').key).toBe('Bar');
    expect(list.search).toHaveBeenLastCalledWith('b');
  });

  it('adds Space to a query in progress', () => {
    const list = createList();

    list.type('foo');
    expect(list.focusedKey).toBe('Foo');

    expect(list.press(' ')).toEqual({ isHandled: true, key: 'Foo Bar' });
    list.type('ba');
    expect(list.focusedKey).toBe('Foo Bar');
    expect(list.press('z')).toEqual({ isHandled: true, key: 'Foo Baz' });
    expect(list.search).toHaveBeenLastCalledWith('foo baz');
  });

  it('leaves Space alone when no query is in progress', () => {
    const list = createList();

    expect(list.press(' ')).toEqual({ isHandled: false, key: null });
    expect(list.search).not.toHaveBeenCalled();
  });

  it('leaves Space alone once the query expired', () => {
    const list = createList();
    list.type('foo b');
    expect(list.focusedKey).toBe('Foo Bar');

    expect(list.press(' ', { after: 1001 })).toEqual({
      isHandled: false,
      key: null,
    });
    expect(list.search).toHaveBeenLastCalledWith('foo b');
  });

  it('consumes a Space that matches nothing, then lets the next one through', () => {
    const list = createList(['Foo', 'Bar']);
    list.press('f');

    expect(list.press(' ')).toEqual({ isHandled: true, key: null });
    expect(list.focusedKey).toBe('Foo');
    expect(list.typeahead.isSearching(list.time)).toBe(false);
    expect(list.press(' ')).toEqual({ isHandled: false, key: null });
  });

  it.each<keyof Modifiers>(['ctrlKey', 'metaKey', 'altKey'])(
    'ignores keys typed with %s and keeps the query',
    (modifier) => {
      const list = createList();
      list.press('b');

      expect(list.press('l', { [modifier]: true })).toEqual({
        isHandled: false,
        key: null,
      });
      list.press('a');

      expect(list.search.mock.calls).toEqual([['b'], ['ba']]);
    },
  );

  it.each(['Enter', 'ArrowDown', 'F1', 'Process', 'Dead', 'Tab', ''])(
    'ignores the named key %j and keeps the query',
    (key) => {
      const list = createList();
      list.press('b');

      expect(list.press(key)).toEqual({ isHandled: false, key: null });
      list.press('l');

      expect(list.search.mock.calls).toEqual([['b'], ['bl']]);
    },
  );

  it.each(['é', 'ß', '1', 'क्ष', '👍'])('types %j', (key) => {
    const typeahead = createTypeahead();
    const search = vi.fn(() => 'item');

    expect(typeahead.handleKey({ key, timeStamp: 0 }, search).isHandled).toBe(
      true,
    );
    expect(search).toHaveBeenCalledWith(key);
  });

  it('reports a query in progress until it expires', () => {
    const typeahead = createTypeahead();
    expect(typeahead.isSearching(0)).toBe(false);

    typeahead.handleKey({ key: 'f', timeStamp: 500 }, () => 'Foo');

    expect(typeahead.isSearching(500)).toBe(true);
    expect(typeahead.isSearching(1500)).toBe(true);
    expect(typeahead.isSearching(1501)).toBe(false);
    expect(typeahead.isSearching(499)).toBe(false);
  });

  it('forgets the query on reset()', () => {
    const list = createList();
    list.press('f');

    list.typeahead.reset();

    expect(list.typeahead.isSearching(list.time)).toBe(false);
    expect(list.press(' ').isHandled).toBe(false);
    list.press('b');
    expect(list.search).toHaveBeenLastCalledWith('b');
  });
});

describe('findByText', () => {
  const search = (
    query: string,
    options: Partial<FindByTextOptions<string>> = {},
  ) =>
    findByText(query, { keys: ITEMS, getTextValue: (key) => key, ...options });

  it('starts at the given key, inclusive', () => {
    expect(search('b', { fromKey: 'Bar' })).toBe('Bar');
    expect(search('b', { fromKey: 'Baz' })).toBe('Baz');
    expect(search('foo', { fromKey: 'Foo Baz' })).toBe('Foo Baz');
    expect(search('bl', { fromKey: 'Bar' })).toBe('Blah');
  });

  it('wraps to the top when nothing at or after the given key matches', () => {
    expect(search('b', { fromKey: 'Foo Baz' })).toBe('Bar');
    expect(search('ba', { fromKey: 'Blah' })).toBe('Bar');
  });

  it('searches from the top without a start key', () => {
    expect(search('b')).toBe('Bar');
    expect(search('b', { fromKey: null })).toBe('Bar');
    expect(search('b', { fromKey: 'Missing' })).toBe('Bar');
  });

  it('matches the start of the text, ignoring case and accents', () => {
    const keys = ['Crème brûlée', 'Éclair'];

    expect(search('ecl', { keys })).toBe('Éclair');
    expect(search('CREME B', { keys })).toBe('Crème brûlée');
    expect(search('brulee', { keys })).toBeNull();
  });

  it('skips disabled items, the start key included', () => {
    const isDisabled = (key: string) => key === 'Bar' || key === 'Blah';

    expect(search('b', { fromKey: 'Bar', isDisabled })).toBe('Baz');
    expect(search('bl', { isDisabled })).toBe('Bleh');
  });

  it('never matches an item without text', () => {
    // This collator finds '' equal to '.', so only the empty-text check
    // keeps the first item out.
    const collator = new Intl.Collator('en', { ignorePunctuation: true });

    expect(search('.', { keys: ['', 'Bar'], collator })).toBeNull();
  });

  it('matches nothing for an empty query', () => {
    expect(search('')).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(search('q', { fromKey: 'Bar' })).toBeNull();
  });

  it('compares with the given collator', () => {
    const collator = new Intl.Collator('en', {
      usage: 'search',
      sensitivity: 'variant',
    });

    expect(search('b', { collator })).toBeNull();
    expect(search('B', { collator })).toBe('Bar');
  });

  it('takes any iterable and any key type', () => {
    const items = [{ text: 'One' }, { text: 'Two' }, { text: 'Three' }];
    function* keys() {
      yield* items;
    }
    const options = {
      keys: keys(),
      getTextValue: (item: { text: string }) => item.text,
      fromKey: items[1],
    };

    expect(findByText('th', options)).toBe(items[2]);
    expect(findByText('o', { ...options, keys: new Set(items) })).toBe(
      items[0],
    );
  });
});
