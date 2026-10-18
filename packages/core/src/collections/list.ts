/**
 * A list collection: items as data, flattened once into options in display
 * order, with the lookups keyboard navigation and range selection need
 * (Listbox spec). Keys map to indexes, so moving from a key costs only the
 * disabled options skipped, never a search (Zag's `indexOf` is O(n)).
 *
 * An item with children is a section: its children are options, and a
 * section is never an option itself. Sections don't nest.
 *
 * DOM-free, like the rest of `collections/`.
 */

/** How a collection reads its items. */
export interface ListAccessors<Item> {
  getKey(item: Item): string;
  getTextValue(item: Item): string;
  isDisabled(item: Item): boolean;
  /** A section's options; `undefined` for an option. */
  getChildren(item: Item): readonly Item[] | undefined;
}

export interface ListOption<Item> {
  readonly key: string;
  readonly textValue: string;
  readonly isDisabled: boolean;
  readonly item: Item;
  /** Position among all options, sections flattened. */
  readonly index: number;
  /** The key of the section holding it, or `null`. */
  readonly section: string | null;
}

export interface ListSection<Item> {
  readonly key: string;
  readonly item: Item;
  /** Its options' keys, in order. */
  readonly keys: readonly string[];
}

export interface ListCollection<Item> {
  /** Every option in display order, sections flattened. */
  readonly options: readonly ListOption<Item>[];
  readonly sections: readonly ListSection<Item>[];
  /** Every option key in display order. */
  readonly keys: readonly string[];
  /** Keys that appear more than once; all but the first are dropped. */
  readonly duplicates: readonly string[];
  get(key: string): ListOption<Item> | undefined;
  section(key: string): ListSection<Item> | undefined;
  /** An option that exists and is enabled. */
  isEnabled(key: string): boolean;
  /** The first enabled option. */
  first(): string | null;
  /** The last enabled option. */
  last(): string | null;
  /**
   * The enabled option after `key`; `null` past the last, or the first with
   * `isWrapping`. From a key not in the collection, the first.
   */
  next(key: string | null, isWrapping?: boolean): string | null;
  /** The enabled option before `key`; see `next`. */
  previous(key: string | null, isWrapping?: boolean): string | null;
  /** The enabled options from `a` to `b`, both included, in display order. */
  range(a: string, b: string): string[];
  /** Every enabled option, in display order. */
  enabledKeys(): string[];
}

export function createListCollection<Item>(
  items: readonly Item[],
  accessors: ListAccessors<Item>,
  disabledKeys: Iterable<string> = [],
): ListCollection<Item> {
  const disabled = new Set(disabledKeys);
  const options: ListOption<Item>[] = [];
  const sections: ListSection<Item>[] = [];
  const byKey = new Map<string, ListOption<Item>>();
  const sectionsByKey = new Map<string, ListSection<Item>>();
  const duplicates: string[] = [];

  const isNew = (key: string) => {
    if (!byKey.has(key) && !sectionsByKey.has(key)) return true;
    duplicates.push(key);
    return false;
  };

  const addOption = (item: Item, section: string | null) => {
    const key = accessors.getKey(item);
    if (!isNew(key)) return null;
    const option: ListOption<Item> = {
      key,
      textValue: accessors.getTextValue(item) ?? '',
      isDisabled: disabled.has(key) || accessors.isDisabled(item),
      item,
      index: options.length,
      section,
    };
    options.push(option);
    byKey.set(key, option);
    return key;
  };

  for (const item of items) {
    const children = accessors.getChildren(item);
    if (!children) {
      addOption(item, null);
      continue;
    }
    const key = accessors.getKey(item);
    if (!isNew(key)) continue;
    const keys: string[] = [];
    const section = { key, item, keys };
    sectionsByKey.set(key, section);
    sections.push(section);
    for (const child of children) {
      const added = addOption(child, key);
      if (added !== null) keys.push(added);
    }
  }

  const isEnabled = (key: string) => {
    const option = byKey.get(key);
    return option !== undefined && !option.isDisabled;
  };

  /** The first enabled option from `index` on, moving by `step`. */
  const scan = (index: number, step: 1 | -1): string | null => {
    for (let at = index; at >= 0 && at < options.length; at += step) {
      if (!options[at]!.isDisabled) return options[at]!.key;
    }
    return null;
  };

  const first = () => scan(0, 1);
  const last = () => scan(options.length - 1, -1);

  return {
    options,
    sections,
    keys: options.map((option) => option.key),
    duplicates,
    get: (key) => byKey.get(key),
    section: (key) => sectionsByKey.get(key),
    isEnabled,
    first,
    last,
    next(key, isWrapping = false) {
      const option = key === null ? undefined : byKey.get(key);
      if (!option) return first();
      return scan(option.index + 1, 1) ?? (isWrapping ? first() : null);
    },
    previous(key, isWrapping = false) {
      const option = key === null ? undefined : byKey.get(key);
      if (!option) return last();
      return scan(option.index - 1, -1) ?? (isWrapping ? last() : null);
    },
    range(a, b) {
      const from = byKey.get(a);
      const to = byKey.get(b);
      if (!from || !to) return [];
      const start = Math.min(from.index, to.index);
      const end = Math.max(from.index, to.index);
      const keys: string[] = [];
      for (let at = start; at <= end; at++) {
        if (!options[at]!.isDisabled) keys.push(options[at]!.key);
      }
      return keys;
    },
    enabledKeys: () =>
      options.filter((option) => !option.isDisabled).map(({ key }) => key),
  };
}
