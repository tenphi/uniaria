/**
 * `@uniaria/core/virtual` — the engine a virtualized list takes as its
 * `virtualizer` prop (Listbox virtualization spec, Resolved questions 1 and
 * 2): `@tanstack/virtual-core`, pinned to one version and bundled into this
 * entry with its development checks compiled out, behind the `Virtualizer`
 * interface UniAria owns. Only lists that virtualize import it.
 *
 * ```ts
 * import { virtualizer } from '@uniaria/core/virtual';
 * useBehavior(listbox, { items, virtualizer, itemSize: 32 });
 * ```
 *
 * UniAria measures rows itself (by key, ignoring the 0 a hidden row
 * reports) and hands the sizes to the engine, which keeps the view anchored
 * when a row above it changes size.
 */

/*! @tanstack/virtual-core | MIT License | Copyright (c) 2021-present Tanner Linsley */

import {
  Virtualizer as Engine,
  elementScroll,
  observeElementOffset,
} from '@tanstack/virtual-core';
import type { Rect, VirtualizerOptions } from '@tanstack/virtual-core';

import type {
  VirtualRowRange,
  VirtualRows,
  VirtualRowsOptions,
  Virtualizer,
} from '../dom/virtual';

type EngineOptions = VirtualizerOptions<HTMLElement, HTMLElement>;

/** A `scroll-padding` length in px; `auto` and anything unresolved is 0. */
const toPx = (value: string): number => Number.parseFloat(value) || 0;

function create(initial: VirtualRowsOptions): VirtualRows {
  let options = initial;
  // The engine lays the rows out again only when its key function changes,
  // so each set of options gets a new one, and nothing else does.
  let getItemKey = (index: number) => options.keyOf(index);
  /** A row to scroll to once the view has a size. */
  let pending: number | null = null;
  /** Reads the scroller's size now, rather than at the next resize. */
  let refresh: (() => void) | undefined;

  const engineOptions = (
    padding: { start: number; end: number } = { start: 0, end: 0 },
  ): EngineOptions => {
    return {
      count: options.count,
      getScrollElement: () => options.scroller,
      getItemKey,
      estimateSize: (index) => options.sizeOf(index),
      horizontal: options.isHorizontal,
      isRtl: options.isRtl,
      overscan: options.overscan,
      scrollPaddingStart: padding.start,
      scrollPaddingEnd: padding.end,
      initialRect: { width: 0, height: 0 },
      scrollToFn: elementScroll,
      observeElementOffset,
      // The view is the scroller's client box, which a scrollbar and borders
      // don't count in; read again on each resize.
      observeElementRect: (_instance, report: (rect: Rect) => void) => {
        const element = options.scroller;
        const read = () => {
          report({ width: element.clientWidth, height: element.clientHeight });
          if (pending !== null && viewSize() > 0) {
            const index = pending;
            pending = null;
            scrollTo(index);
          }
        };
        refresh = read;
        read();
        const view = element.ownerDocument.defaultView;
        if (!view?.ResizeObserver) return;
        const observer = new view.ResizeObserver(read);
        observer.observe(element);
        return () => {
          observer.disconnect();
          if (refresh === read) refresh = undefined;
        };
      },
      onChange: () => options.onChange(),
    };
  };

  const engine = new Engine<HTMLElement, HTMLElement>(engineOptions());
  const unmount = engine._didMount();
  engine._willUpdate();

  const viewSize = (): number => {
    const rect = engine.scrollRect;
    return rect ? (options.isHorizontal ? rect.width : rect.height) : 0;
  };

  /** A row's laid-out box; sizes are read in `getTotalSize()`. */
  const item = (index: number) => {
    engine.getTotalSize();
    return engine.measurementsCache[index];
  };

  const scrollTo = (index: number): void => {
    if (index < 0 || index >= options.count) return;
    if (viewSize() === 0) refresh?.();
    if (viewSize() === 0) {
      pending = index;
      return;
    }
    pending = null;
    const element = options.scroller;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    let padding = { start: 0, end: 0 };
    if (style) {
      padding = options.isHorizontal
        ? {
            start: toPx(style.scrollPaddingLeft),
            end: toPx(style.scrollPaddingRight),
          }
        : {
            start: toPx(style.scrollPaddingTop),
            end: toPx(style.scrollPaddingBottom),
          };
      if (options.isHorizontal && options.isRtl) {
        padding = { start: padding.end, end: padding.start };
      }
    }
    engine.setOptions(engineOptions(padding));
    engine.scrollToIndex(index, { align: 'auto' });
  };

  return {
    update(next) {
      options = next;
      getItemKey = (index: number) => options.keyOf(index);
      engine.setOptions(engineOptions());
      engine._willUpdate();
    },
    viewSize,
    range(): VirtualRowRange | null {
      const indexes = engine.getVirtualIndexes();
      if (indexes.length === 0) return null;
      return { start: indexes[0]!, end: indexes[indexes.length - 1]! };
    },
    start: (index) => item(index)?.start ?? 0,
    size: (index) => item(index)?.size ?? 0,
    total: () => engine.getTotalSize(),
    resize(index, size) {
      engine.resizeItem(index, size);
    },
    scrollTo,
    destroy() {
      pending = null;
      unmount();
    },
  };
}

/** `@tanstack/virtual-core` behind UniAria's `Virtualizer` interface. */
export const virtualizer: Virtualizer = { create };

export type {
  VirtualRowRange,
  VirtualRows,
  VirtualRowsOptions,
  Virtualizer,
} from '../dom/virtual';
