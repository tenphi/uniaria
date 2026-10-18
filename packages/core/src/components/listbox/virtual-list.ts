/**
 * A virtualized list, from the approved spec (`./virtualization.md`): the
 * rendered set (the options in and near the view, plus the pins), where
 * each row sits, and moving the view to an option by its position rather
 * than by its element. Listbox composes it; it reads the collection and the
 * pins Listbox gives it, and the engine is the `virtualizer` prop's.
 *
 * Rows are options and the label rows of sections, in list order. A
 * section's label row starts its group box; the group's options sit inside
 * it, positioned from its start (Groups).
 *
 * Without a `virtualizer` every option is rendered and nothing here writes
 * a style or an attribute.
 */

import type { ListCollection } from '../../collections';
import { isDevelopment, partEffect, partElement, warn } from '../../dom';
import type { VirtualRows, Virtualizer } from '../../dom';
import type { EventsSchema, PropsSchema, SetupContext } from '../../runtime';
import { event, prop } from '../../runtime';

type Context = Pick<
  SetupContext<string, PropsSchema, EventsSchema>,
  | 'state'
  | 'memo'
  | 'watch'
  | 'effect'
  | 'element'
  | 'batch'
  | 'env'
  | 'itemEffect'
  | 'itemElement'
  | 'invalidateItems'
>;

export type ItemSize = number | ((key: string) => number);

/**
 * The virtualization props (Props), on Listbox and on Select and Combobox,
 * which forward them to their list.
 */
export const virtualProps = {
  virtualizer: prop<Virtualizer | undefined>(undefined, { attribute: false }),
  itemSize: prop<ItemSize | undefined>(undefined, { type: 'number' }),
  shouldMeasureItems: prop(false),
  overscan: prop(10),
  initialItemCount: prop(20),
};

/** `renderedKeysChange`'s detail: the rendered set (Events). */
export interface RenderedKeys {
  readonly keys: readonly string[];
  readonly sections: readonly string[];
}

/** The rendered set changed (Events), on Listbox, Select and Combobox. */
export const renderedKeysChange = event<RenderedKeys>();

export interface VirtualListOptions {
  readonly collection: () => ListCollection<unknown>;
  readonly virtualizer: () => Virtualizer | undefined;
  readonly itemSize: () => ItemSize | undefined;
  readonly shouldMeasureItems: () => boolean;
  readonly overscan: () => number;
  readonly initialItemCount: () => number;
  readonly isVertical: () => boolean;
  /** The options that stay rendered wherever the view is (pins). */
  readonly pins: () => readonly (string | null)[];
}

export type LayoutStyle = Readonly<Record<string, string | undefined>>;

interface Row {
  readonly key: string;
  /** The section the row belongs to, or `null` outside one. */
  readonly section: string | null;
  /** A section's label row, which starts its group box. */
  readonly isLabel: boolean;
}

interface Rows {
  readonly list: readonly Row[];
  /** An option's row, or a section's label row. */
  readonly indexOf: ReadonlyMap<string, number>;
  /** A section's last row. */
  readonly lastOf: ReadonlyMap<string, number>;
}

/** An unmeasured row with no `itemSize` (Props). */
const ESTIMATE = 32;

const NONE: readonly string[] = [];

const isSame = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);

export function createVirtualList(ctx: Context, options: VirtualListOptions) {
  const { collection } = options;
  const isOn = () => options.virtualizer() !== undefined;

  const rows = ctx.memo(
    () => [collection()] as const,
    (list): Rows => {
      const result: Row[] = [];
      const indexOf = new Map<string, number>();
      const lastOf = new Map<string, number>();
      let section: string | null = null;
      for (const option of list.options) {
        if (option.section !== null && option.section !== section) {
          indexOf.set(option.section, result.length);
          result.push({
            key: option.section,
            section: option.section,
            isLabel: true,
          });
        }
        section = option.section;
        indexOf.set(option.key, result.length);
        if (section !== null) lastOf.set(section, result.length);
        result.push({ key: option.key, section, isLabel: false });
      }
      return { list: result, indexOf, lastOf };
    },
  );

  // Sizes (Sizes): exact from `itemSize`, or measured by key and estimated
  // until then.
  const isMeasured = () =>
    options.shouldMeasureItems() || options.itemSize() === undefined;
  const measured = new Map<string, number>();
  const sizeOf = (key: string): number => {
    if (isMeasured()) {
      const size = measured.get(key);
      if (size !== undefined) return size;
    }
    const itemSize = options.itemSize();
    if (typeof itemSize === 'function') return itemSize(key);
    return itemSize ?? ESTIMATE;
  };

  /** Bumped whenever the engine reports a change: the rendered set is read again. */
  const version = ctx.state(0);
  /** Bumped whenever a row may have moved: rendered rows are written again. */
  const geometry = ctx.state(0);
  const bump = (cell: { get(): number; set(value: number): void }) =>
    cell.set(cell.get() + 1);

  let engine: VirtualRows | null = null;
  let scroller: HTMLElement | null = null;
  let isRtl = false;

  const engineOptions = (element: HTMLElement) => {
    const current = rows();
    return {
      scroller: element,
      count: current.list.length,
      keyOf: (index: number) => current.list[index]!.key,
      sizeOf: (index: number) => sizeOf(current.list[index]!.key),
      isHorizontal: !options.isVertical(),
      isRtl,
      overscan: options.overscan(),
      onChange: () => bump(version),
    };
  };

  partEffect(
    ctx,
    'scroller',
    (element) => {
      const virtualizer = options.virtualizer();
      if (!virtualizer) return;
      scroller = element;
      isRtl =
        element.ownerDocument.defaultView?.getComputedStyle(element)
          .direction === 'rtl';
      ctx.batch(() => {
        engine = virtualizer.create(engineOptions(element));
        bump(version);
        bump(geometry);
      });
      return () => {
        engine?.destroy();
        engine = null;
        scroller = null;
        ctx.batch(() => {
          bump(version);
          bump(geometry);
        });
      };
    },
    isOn,
  );

  // New rows, sizes or overscan: the engine lays the rows out again.
  const layoutInputs = ctx.memo(
    () =>
      [
        rows(),
        options.itemSize(),
        options.shouldMeasureItems(),
        options.overscan(),
        options.isVertical(),
      ] as const,
    (..._inputs) => ({}),
  );
  ctx.watch(layoutInputs, () => {
    if (!engine || !scroller) return;
    engine.update(engineOptions(scroller));
    bump(version);
    bump(geometry);
  });

  // Where each row starts before there is an engine (on the server, before
  // the scroller attaches): the sizes added up.
  const offsets = ctx.memo(
    () => [rows(), options.itemSize(), geometry.get()] as const,
    (current, _itemSize, _geometry): readonly number[] => {
      const result = new Array<number>(current.list.length + 1);
      let at = 0;
      current.list.forEach((row, index) => {
        result[index] = at;
        at += sizeOf(row.key);
      });
      result[current.list.length] = at;
      return result;
    },
  );
  const startOf = (index: number): number =>
    engine ? engine.start(index) : (offsets()[index] ?? 0);
  const endOf = (index: number): number =>
    engine
      ? engine.start(index) + engine.size(index)
      : (offsets()[index + 1] ?? 0);
  const total = (): number =>
    engine ? engine.total() : (offsets()[rows().list.length] ?? 0);

  // The pins as one string, so a memo compares them by value.
  const pinned = () =>
    JSON.stringify(options.pins().filter((key) => key !== null));

  let lastKeys: readonly string[] = NONE;
  const renderedKeys = ctx.memo(
    () =>
      [
        collection(),
        isOn(),
        version.get(),
        pinned(),
        options.initialItemCount(),
      ] as const,
    (list, isVirtualized, _version, pins, initialCount): readonly string[] => {
      if (!isVirtualized) return (lastKeys = list.keys);
      const current = rows();
      const indexes = new Set<number>();
      const range = engine?.range() ?? null;
      if (range) {
        for (let at = range.start; at <= range.end; at++) {
          const row = current.list[at];
          if (row && !row.isLabel) indexes.add(list.get(row.key)!.index);
        }
      } else {
        const count = Math.min(initialCount, list.options.length);
        for (let index = 0; index < count; index++) indexes.add(index);
      }
      for (const key of JSON.parse(pins) as string[]) {
        const option = list.get(key);
        if (option) indexes.add(option.index);
      }
      const next = Array.from(indexes)
        .sort((a, b) => a - b)
        .map((index) => list.options[index]!.key);
      if (!isSame(next, lastKeys)) lastKeys = next;
      return lastKeys;
    },
  );

  let lastSections: readonly string[] = NONE;
  const renderedSections = ctx.memo(
    () => [collection(), renderedKeys()] as const,
    (list, keys): readonly string[] => {
      const next = isOn()
        ? Array.from(
            new Set(
              keys
                .map((key) => list.get(key)?.section ?? null)
                .filter((section): section is string => section !== null),
            ),
          )
        : list.sections.map((section) => section.key);
      if (!isSame(next, lastSections)) lastSections = next;
      return lastSections;
    },
  );

  // A row that moved is written again; rows that stay put keep their props.
  ctx.watch(geometry.get, () => {
    ctx.invalidateItems([...renderedKeys(), ...renderedSections()]);
  });

  /** Absolutely positioned at `start` along the axis, with a length when given. */
  const place = (start: number, size?: number): LayoutStyle => {
    const isVertical = options.isVertical();
    const along = isRtl && !isVertical ? -start : start;
    return {
      position: 'absolute',
      'inset-block-start': '0',
      'inset-inline-start': '0',
      translate: isVertical ? `0 ${along}px` : `${along}px 0`,
      ...(size === undefined
        ? {}
        : { [isVertical ? 'block-size' : 'inline-size']: `${size}px` }),
    };
  };

  // Measured rows (Sizes): observed by key; a 0 from a hidden row is ignored.
  let observer: ResizeObserver | null = null;
  const observed = new Map<Element, string>();
  const onResize = (entries: readonly ResizeObserverEntry[]) => {
    const current = rows();
    let hasChanged = false;
    ctx.batch(() => {
      for (const entry of entries) {
        const key = observed.get(entry.target);
        if (key === undefined) continue;
        const box = entry.borderBoxSize?.[0];
        const rect = entry.target.getBoundingClientRect();
        const size = Math.round(
          options.isVertical()
            ? (box?.blockSize ?? rect.height)
            : (box?.inlineSize ?? rect.width),
        );
        if (size === 0 || measured.get(key) === size) continue;
        measured.set(key, size);
        hasChanged = true;
        const index = current.indexOf.get(key);
        if (engine && index !== undefined) engine.resize(index, size);
      }
      if (hasChanged) bump(geometry);
    });
  };
  const observe = (key: string, element: unknown) => {
    if (!isOn() || !isMeasured()) {
      checkSize(key, element as HTMLElement);
      return;
    }
    const target = element as HTMLElement;
    const view = target.ownerDocument.defaultView;
    if (!view?.ResizeObserver) return;
    observer ??= new view.ResizeObserver(onResize);
    observed.set(target, key);
    observer.observe(target, { box: 'border-box' });
    return () => {
      observed.delete(target);
      observer?.unobserve(target);
    };
  };
  ctx.itemEffect('option', observe);
  ctx.itemEffect('groupLabel', observe);
  ctx.effect(() => () => {
    observer?.disconnect();
    observer = null;
    observed.clear();
  });

  // Development checks (Layout): a missing scroller, a pinned option the
  // consumer didn't render, a row whose size isn't `itemSize`.
  let hasWarnedSize = false;
  const checkSize = (key: string, element: HTMLElement) => {
    if (!isOn() || hasWarnedSize || !isDevelopment()) return;
    const rect = element.getBoundingClientRect();
    const size = Math.round(options.isVertical() ? rect.height : rect.width);
    if (size === 0 || size === sizeOf(key)) return;
    hasWarnedSize = true;
    warn(
      `listbox: the row for "${key}" is ${size}px, but itemSize says ${sizeOf(key)}px, ` +
        'so rows overlap or leave gaps. Fix its size, or set shouldMeasureItems.',
    );
  };
  if (isDevelopment()) {
    ctx.effect(() => {
      if (!isOn()) return;
      const timer = setTimeout(() => {
        if (isOn() && !partElement(ctx, 'scroller')) {
          warn(
            'listbox: a virtualized list needs a scroller part around its list, ' +
              'with a height and overflow: auto.',
          );
        }
      });
      return () => clearTimeout(timer);
    });
    let hasWarnedPin = false;
    ctx.watch(renderedKeys, (keys) => {
      if (!isOn() || hasWarnedPin) return;
      setTimeout(() => {
        const rendered = new Set(keys);
        const missing = options
          .pins()
          .find(
            (key) =>
              key !== null &&
              rendered.has(key) &&
              ctx.itemElement('option', key) === null,
          );
        if (missing == null || hasWarnedPin) return;
        hasWarnedPin = true;
        warn(
          `listbox: option "${missing}" is in renderedKeys but has no element. ` +
            'Render every key of renderedKeys, keyed by it.',
        );
      });
    });
  }

  return {
    isOn,
    renderedKeys,
    renderedSections,
    /** Its 1-based position among every option, while virtualized. */
    position(key: string): number | undefined {
      const option = isOn() ? collection().get(key) : undefined;
      return option ? option.index + 1 : undefined;
    },
    setSize: (): number | undefined =>
      isOn() ? collection().options.length : undefined,
    listStyle: (): LayoutStyle | undefined =>
      isOn()
        ? {
            position: 'relative',
            [options.isVertical() ? 'block-size' : 'inline-size']:
              `${total()}px`,
          }
        : undefined,
    scrollerStyle: (): LayoutStyle | undefined =>
      isOn() ? { 'overflow-anchor': 'none' } : undefined,
    optionStyle(key: string): LayoutStyle | undefined {
      if (!isOn()) return undefined;
      const current = rows();
      const index = current.indexOf.get(key);
      if (index === undefined) return undefined;
      const row = current.list[index]!;
      const section =
        row.section === null ? undefined : current.indexOf.get(row.section);
      return place(
        startOf(index) - (section === undefined ? 0 : startOf(section)),
      );
    },
    groupStyle(key: string): LayoutStyle | undefined {
      if (!isOn()) return undefined;
      const current = rows();
      const first = current.indexOf.get(key);
      const last = current.lastOf.get(key);
      if (first === undefined || last === undefined) return undefined;
      return place(startOf(first), endOf(last) - startOf(first));
    },
    /**
     * Scrolls an option into view by its position (Focus), to the nearest
     * edge; once the view has a size, when it has none yet.
     */
    scrollTo(key: string): void {
      const index = rows().indexOf.get(key);
      if (index !== undefined) engine?.scrollTo(index);
    },
    /**
     * Page Up and Page Down by geometry (Keyboard): the farthest option
     * within one view's length of `key`; `undefined` without a view.
     */
    pageFrom(key: string, step: 1 | -1): string | null | undefined {
      const page = engine?.viewSize() ?? 0;
      const current = rows();
      const from = current.indexOf.get(key);
      if (page === 0 || from === undefined) return undefined;
      const list = collection();
      let target: string | null = null;
      for (
        let at = step > 0 ? list.next(key) : list.previous(key);
        at !== null;
        at = step > 0 ? list.next(at) : list.previous(at)
      ) {
        const index = current.indexOf.get(at)!;
        const distance =
          step > 0
            ? endOf(index) - endOf(from)
            : startOf(from) - startOf(index);
        if (target !== null && distance > page) break;
        target = at;
      }
      return target ?? key;
    },
  };
}

export type VirtualList = ReturnType<typeof createVirtualList>;
