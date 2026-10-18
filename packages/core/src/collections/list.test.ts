import { describe, expect, it } from 'vitest';

import { createListCollection } from './list';

interface Item {
  readonly key: string;
  readonly textValue?: string;
  readonly isDisabled?: boolean;
  readonly items?: readonly Item[];
}

const accessors = {
  getKey: (item: Item) => item.key,
  getTextValue: (item: Item) => item.textValue ?? item.key,
  isDisabled: (item: Item) => item.isDisabled === true,
  getChildren: (item: Item) => item.items,
};

const fruit: readonly Item[] = [
  { key: 'apple' },
  { key: 'banana', isDisabled: true },
  {
    key: 'citrus',
    items: [{ key: 'lemon' }, { key: 'lime', isDisabled: true }],
  },
  { key: 'kiwi' },
];

describe('createListCollection', () => {
  it('flattens sections into options in display order', () => {
    const list = createListCollection(fruit, accessors);
    expect(list.keys).toEqual(['apple', 'banana', 'lemon', 'lime', 'kiwi']);
    expect(list.get('lemon')).toMatchObject({
      index: 2,
      section: 'citrus',
      textValue: 'lemon',
    });
    expect(list.get('citrus')).toBeUndefined();
    expect(list.section('citrus')?.keys).toEqual(['lemon', 'lime']);
    expect(list.sections.map(({ key }) => key)).toEqual(['citrus']);
  });

  it('disables by item or by key', () => {
    const list = createListCollection(fruit, accessors, ['kiwi']);
    expect(list.isEnabled('apple')).toBe(true);
    expect(list.isEnabled('banana')).toBe(false);
    expect(list.isEnabled('kiwi')).toBe(false);
    expect(list.isEnabled('missing')).toBe(false);
    expect(list.enabledKeys()).toEqual(['apple', 'lemon']);
  });

  it('moves between enabled options, wrapping only when asked', () => {
    const list = createListCollection(fruit, accessors);
    expect(list.first()).toBe('apple');
    expect(list.last()).toBe('kiwi');
    expect(list.next('apple')).toBe('lemon');
    expect(list.next('lemon')).toBe('kiwi');
    expect(list.next('kiwi')).toBeNull();
    expect(list.next('kiwi', true)).toBe('apple');
    expect(list.previous('lemon')).toBe('apple');
    expect(list.previous('apple')).toBeNull();
    expect(list.previous('apple', true)).toBe('kiwi');
    // From a disabled option, and from none.
    expect(list.next('banana')).toBe('lemon');
    expect(list.next(null)).toBe('apple');
    expect(list.previous('missing')).toBe('kiwi');
  });

  it('has no first or last when every option is disabled', () => {
    const list = createListCollection(
      [{ key: 'a', isDisabled: true }],
      accessors,
    );
    expect(list.first()).toBeNull();
    expect(list.next(null, true)).toBeNull();
    expect(createListCollection([], accessors).last()).toBeNull();
  });

  it('gives ranges of enabled options either way round', () => {
    const list = createListCollection(fruit, accessors);
    expect(list.range('apple', 'kiwi')).toEqual(['apple', 'lemon', 'kiwi']);
    expect(list.range('kiwi', 'lemon')).toEqual(['lemon', 'kiwi']);
    expect(list.range('apple', 'apple')).toEqual(['apple']);
    expect(list.range('apple', 'missing')).toEqual([]);
  });

  it('keeps the first of repeated keys and reports the rest', () => {
    const list = createListCollection(
      [
        { key: 'a' },
        { key: 'a', textValue: 'Again' },
        { key: 'b', items: [{ key: 'b' }] },
      ],
      accessors,
    );
    expect(list.keys).toEqual(['a']);
    expect(list.get('a')?.textValue).toBe('a');
    expect(list.duplicates).toEqual(['a', 'b']);
  });
});
