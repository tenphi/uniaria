/**
 * The engine behind a virtualized list (Listbox virtualization spec,
 * Resolved questions 1 and 2): `virtualizer` from `@uniaria/core/virtual`
 * implements it with `@tanstack/virtual-core`, which only lists that
 * virtualize load. Definitions see this interface alone, so the engine can
 * change without an API change.
 *
 * A row is an option or a group's label row, in list order. The engine
 * keeps their positions along the list's axis, the scroller's view and
 * scroll offset, and the rows in view; what to render is the definition's.
 */

export interface VirtualRowsOptions {
  /** The element that scrolls. */
  readonly scroller: HTMLElement;
  /** How many rows. */
  readonly count: number;
  /** A row's key: sizes measured stay with it when the rows change. */
  readonly keyOf: (index: number) => string;
  /** A row's size along the axis: exact, or an estimate until measured. */
  readonly sizeOf: (index: number) => number;
  readonly isHorizontal: boolean;
  /** Right to left, which a horizontal list scrolls the other way. */
  readonly isRtl: boolean;
  /** Rows kept beyond each edge of the view. */
  readonly overscan: number;
  /** The rows in view changed, the view was resized, or a size changed. */
  readonly onChange: () => void;
}

export interface VirtualRowRange {
  readonly start: number;
  readonly end: number;
}

export interface VirtualRows {
  /** New rows, sizes or overscan: every size is read again. */
  update(options: VirtualRowsOptions): void;
  /** The view's length along the axis: 0 until the scroller has a size. */
  viewSize(): number;
  /**
   * The first and last row in view with the overscan, both included, or
   * `null` while the view has no size.
   */
  range(): VirtualRowRange | null;
  /** Where a row starts along the axis, from the list's start. */
  start(index: number): number;
  size(index: number): number;
  /** Every row's size together: the list's length. */
  total(): number;
  /**
   * A row's measured size. A row above the view keeps the first visible
   * row where it is.
   */
  resize(index: number, size: number): void;
  /**
   * Scrolls a row into view, to the nearest edge, inside the scroller's
   * `scroll-padding`. Before the view has a size, it scrolls once it has.
   */
  scrollTo(index: number): void;
  /** Stops observing the scroller. */
  destroy(): void;
}

/** What the `virtualizer` prop takes. */
export interface Virtualizer {
  create(options: VirtualRowsOptions): VirtualRows;
}
