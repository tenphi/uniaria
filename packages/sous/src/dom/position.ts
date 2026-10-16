/**
 * Positioning (Popover spec, Positioning; Resolved questions 3 and 11):
 * places a floating part against an anchor element while active.
 *
 * - Where CSS anchor positioning works, Sous writes inline `position-anchor`,
 *   `position-area`, `position-try-fallbacks` and margins, and the browser
 *   keeps the part placed while the page scrolls and resizes. The side it
 *   picked is read back from the computed `position-area` (both engines
 *   report the applied fallback; probed).
 * - Elsewhere `@floating-ui/dom`, loaded by the browsers that need it,
 *   computes the same placement and Sous writes `top` and `left`. Its flips
 *   are sticky, as the browser's are: a part that flipped stays flipped
 *   until that side has no room.
 *
 * On both paths placements are React Aria's strings, resolved to physical
 * sides first: `start` and `end` follow the floating part's direction.
 * `offset` is the gap to the anchor, `crossOffset` moves the part right or
 * down, and `containerPadding` keeps it off the viewport's edges. The wrapper
 * writes `--trigger-width` (the anchor's width), `--available-width` and
 * `--available-height` in pixels: the most room the part could take, on the
 * larger side when it may flip, so a `max-height` built on them never stops
 * a flip. It places the arrow along the edge, pointing at the anchor's
 * centre; CSS anchor positioning can't (probed).
 *
 * Sous owns the floating part's `inset` and `margin` longhands and its
 * `position-*` properties (`position` on the Floating UI path) and the
 * arrow's `left` or `top`, and puts back what was there when it stops.
 */

import type * as FloatingUi from '@floating-ui/dom';

import { supportsAnchorPositioning } from './support';
import type { InteractionContext } from './types';
import { partEffect, partElement } from './types';

/** React Aria's placement strings: a side, optionally an alignment. */
export type Placement =
  | 'bottom'
  | 'bottom left'
  | 'bottom right'
  | 'bottom start'
  | 'bottom end'
  | 'top'
  | 'top left'
  | 'top right'
  | 'top start'
  | 'top end'
  | 'left'
  | 'left top'
  | 'left bottom'
  | 'start'
  | 'start top'
  | 'start bottom'
  | 'right'
  | 'right top'
  | 'right bottom'
  | 'end'
  | 'end top'
  | 'end bottom';

export type PlacementSide = 'top' | 'bottom' | 'left' | 'right';

export interface PositionOptions {
  /** The floating part, such as a popover. */
  readonly part: string;
  /** A part to point at the anchor's centre, such as an arrow. */
  readonly arrowPart?: string;
  isActive(): boolean;
  /** The element to place against. */
  anchor(): HTMLElement | null;
  placement(): Placement;
  offset(): number;
  crossOffset(): number;
  containerPadding(): number;
  shouldFlip(): boolean;
}

export interface Position {
  /** The side the part was placed on, after flipping; `undefined` while inactive. */
  side(): PlacementSide | undefined;
}

/** Start is left or top; end is right or bottom. */
type Align = 'start' | 'center' | 'end';

interface Resolved {
  readonly side: PlacementSide;
  readonly align: Align;
}

const OPPOSITE: Readonly<Record<PlacementSide, PlacementSide>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/** Above or below the anchor: the cross axis is horizontal. */
const isVertical = (side: PlacementSide) => side === 'top' || side === 'bottom';

function resolve(placement: Placement, isRtl: boolean): Resolved {
  const physical = (word: string) => {
    if (word === 'start') return isRtl ? 'right' : 'left';
    if (word === 'end') return isRtl ? 'left' : 'right';
    return word;
  };
  const [first = 'bottom', second] = placement.split(' ');
  const side = physical(first) as PlacementSide;
  if (!second) return { side, align: 'center' };
  const edge = physical(second);
  return { side, align: edge === 'left' || edge === 'top' ? 'start' : 'end' };
}

/** The `position-area` for a placement: aligned edges span away from them. */
function area({ side, align }: Resolved): string {
  if (align === 'center') return side;
  const spans = isVertical(side)
    ? { start: 'span-right', end: 'span-left' }
    : { start: 'span-bottom', end: 'span-top' };
  return `${side} ${spans[align]}`;
}

/** The side a computed `position-area` names, such as `span-right top`. */
function readSide(floating: HTMLElement): PlacementSide | undefined {
  const value = getComputedStyle(floating).getPropertyValue('position-area');
  for (const token of value.split(/\s+/)) {
    if (token in OPPOSITE) return token as PlacementSide;
  }
  return undefined;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

let floatingUi: Promise<typeof FloatingUi> | undefined;

/** Floating UI, loaded once, by the browsers that need it. */
function loadFloatingUi(): Promise<typeof FloatingUi> {
  return (floatingUi ??= import('@floating-ui/dom'));
}

/** Inline styles Sous writes on an element, put back as they were. */
function inlineStyles(element: HTMLElement) {
  const saved = new Map<string, readonly [string, string]>();
  const put = (
    property: string,
    [value, priority]: readonly [string, string],
  ) => {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  };
  return {
    set(property: string, value: string) {
      if (!saved.has(property)) {
        saved.set(property, [
          element.style.getPropertyValue(property),
          element.style.getPropertyPriority(property),
        ]);
      }
      element.style.setProperty(property, value);
    },
    reset(property: string) {
      const before = saved.get(property);
      if (!before) return;
      saved.delete(property);
      put(property, before);
    },
    restore() {
      for (const [property, before] of saved) put(property, before);
      saved.clear();
    },
  };
}

type InlineStyles = ReturnType<typeof inlineStyles>;

/** Edges in shorthand order. */
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Writes `inset` or `margin` as longhands: a shorthand would drop a
 * consumer's own longhand when put back.
 */
function setBox(
  styles: InlineStyles,
  property: 'inset' | 'margin',
  values: readonly [string, string, string, string],
): void {
  SIDES.forEach((edge, index) => {
    styles.set(property === 'inset' ? edge : `margin-${edge}`, values[index]!);
  });
}

const ANCHORS = Symbol.for('@tenphi/sous/anchors/v1');

/** A new anchor name, unique in the window across copies of Sous. */
function anchorName(view: Window): string {
  const count = ((Reflect.get(view, ANCHORS) as number | undefined) ?? 0) + 1;
  Reflect.set(view, ANCHORS, count);
  return `--sous-anchor-${count}`;
}

/** Adds `name` to the anchor's `anchor-name` list; returns the undo. */
function nameAnchor(anchor: HTMLElement, name: string): () => void {
  const names = () =>
    anchor.style
      .getPropertyValue('anchor-name')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '' && item !== 'none');
  anchor.style.setProperty('anchor-name', [...names(), name].join(', '));
  return () => {
    const rest = names().filter((item) => item !== name);
    if (rest.length > 0)
      anchor.style.setProperty('anchor-name', rest.join(', '));
    else anchor.style.removeProperty('anchor-name');
  };
}

interface Placed {
  readonly floating: HTMLElement;
  readonly anchor: HTMLElement;
  update(): void;
  stop(): void;
}

export function createPosition(
  ctx: InteractionContext,
  options: PositionOptions,
): Position {
  const side = ctx.state<PlacementSide | undefined>(undefined);
  let placed: Placed | null = null;

  const floatingElement = () =>
    options.isActive() ? partElement(ctx, options.part) : null;
  const arrowElement = () =>
    options.arrowPart ? partElement(ctx, options.arrowPart) : null;

  const settings = () =>
    [
      options.placement(),
      options.offset(),
      options.crossOffset(),
      options.containerPadding(),
      options.shouldFlip(),
    ].join(' ');

  function place(floating: HTMLElement, anchor: HTMLElement): Placed | null {
    const view = floating.ownerDocument.defaultView;
    if (!view) return null;
    const document = floating.ownerDocument;
    const styles = inlineStyles(floating);
    let arrow: HTMLElement | null = null;
    let arrowStyles: InlineStyles | null = null;
    let isStopped = false;

    const resolved = () =>
      resolve(
        options.placement(),
        view.getComputedStyle(floating).direction === 'rtl',
      );

    // The room on each side, after the gap and the padding.
    const writeVariables = ({ side: preferred }: Resolved) => {
      const box = anchor.getBoundingClientRect();
      const { clientWidth: width, clientHeight: height } =
        document.documentElement;
      const gap = options.offset();
      const padding = options.containerPadding();
      const room: Record<PlacementSide, number> = {
        top: box.top - gap - padding,
        bottom: height - box.bottom - gap - padding,
        left: box.left - gap - padding,
        right: width - box.right - gap - padding,
      };
      const main = options.shouldFlip()
        ? Math.max(room[preferred], room[OPPOSITE[preferred]])
        : room[preferred];
      const across = (isVertical(preferred) ? width : height) - 2 * padding;
      const [availableWidth, availableHeight] = isVertical(preferred)
        ? [across, main]
        : [main, across];
      styles.set('--trigger-width', `${box.width}px`);
      styles.set('--available-width', `${Math.max(0, availableWidth)}px`);
      styles.set('--available-height', `${Math.max(0, availableHeight)}px`);
    };

    // Along the edge facing the anchor, measured in the part's padding box.
    const placeArrow = (placedSide: PlacementSide) => {
      const next = arrowElement();
      if (next !== arrow) {
        arrowStyles?.restore();
        arrow = next;
        arrowStyles = next ? inlineStyles(next) : null;
      }
      if (!arrow || !arrowStyles) return;
      const target = anchor.getBoundingClientRect();
      const box = floating.getBoundingClientRect();
      const size = arrow.getBoundingClientRect();
      if (isVertical(placedSide)) {
        const centre = target.left + target.width / 2;
        const left = centre - box.left - floating.clientLeft - size.width / 2;
        arrowStyles.reset('top');
        arrowStyles.set(
          'left',
          `${clamp(left, 0, floating.clientWidth - size.width)}px`,
        );
      } else {
        const centre = target.top + target.height / 2;
        const top = centre - box.top - floating.clientTop - size.height / 2;
        arrowStyles.reset('left');
        arrowStyles.set(
          'top',
          `${clamp(top, 0, floating.clientHeight - size.height)}px`,
        );
      }
    };

    const report = (placedSide: PlacementSide) => {
      side.set(placedSide);
      placeArrow(placedSide);
    };

    if (supportsAnchorPositioning(view)) {
      const name = anchorName(view);
      const unname = nameAnchor(anchor, name);
      let frame = 0;

      const margins = ({ side: placedSide, align }: Resolved) => {
        const gap = options.offset();
        const cross = options.crossOffset();
        const padding = options.containerPadding();
        // A centred part's margin box is centred, so a cross offset takes
        // twice its size on one side.
        const near =
          align === 'start'
            ? cross
            : padding + (align === 'center' ? Math.max(0, 2 * cross) : 0);
        const far =
          align === 'end'
            ? -cross
            : padding + (align === 'center' ? Math.max(0, -2 * cross) : 0);
        const [before, after] =
          placedSide === 'bottom' || placedSide === 'right'
            ? [gap, padding]
            : [padding, gap];
        const [top, right, bottom, left] = isVertical(placedSide)
          ? [before, far, after, near]
          : [near, after, far, before];
        return [`${top}px`, `${right}px`, `${bottom}px`, `${left}px`] as const;
      };

      const apply = () => {
        const current = resolved();
        writeVariables(current);
        styles.set('position-anchor', name);
        styles.set('position-area', area(current));
        styles.set(
          'position-try-fallbacks',
          options.shouldFlip()
            ? isVertical(current.side)
              ? 'flip-block'
              : 'flip-inline'
            : 'none',
        );
        // Chromium hides a part whose anchor scrolled out of view and
        // WebKit doesn't (probed); the component decides instead.
        styles.set('position-visibility', 'always');
        setBox(styles, 'inset', ['auto', 'auto', 'auto', 'auto']);
        setBox(styles, 'margin', margins(current));
        report(readSide(floating) ?? current.side);
      };
      const schedule = () => {
        view.cancelAnimationFrame(frame);
        frame = view.requestAnimationFrame(apply);
      };

      apply();
      const observer = new view.ResizeObserver(schedule);
      observer.observe(anchor);
      observer.observe(floating);
      view.addEventListener('resize', schedule);
      document.addEventListener('scroll', schedule, {
        capture: true,
        passive: true,
      });
      return {
        floating,
        anchor,
        update: apply,
        stop() {
          view.cancelAnimationFrame(frame);
          observer.disconnect();
          view.removeEventListener('resize', schedule);
          document.removeEventListener('scroll', schedule, { capture: true });
          unname();
          styles.restore();
          arrowStyles?.restore();
        },
      };
    }

    // Floating UI: sticky flips start from the side it was last placed on,
    // until the placement asks for another side.
    let flip: { from: PlacementSide; to: PlacementSide } | undefined;
    let fui: typeof FloatingUi | undefined;
    let stopUpdates: (() => void) | undefined;

    const toFloatingUi = ({ side: placedSide, align }: Resolved) =>
      (align === 'center'
        ? placedSide
        : `${placedSide}-${align}`) as FloatingUi.Placement;

    const compute = async (library: typeof FloatingUi) => {
      const current = resolved();
      writeVariables(current);
      styles.set('position', 'fixed');
      setBox(styles, 'inset', ['0', 'auto', 'auto', '0']);
      setBox(styles, 'margin', ['0', '0', '0', '0']);
      const isFlipping = options.shouldFlip();
      const start: Resolved = {
        side:
          isFlipping && flip?.from === current.side ? flip.to : current.side,
        align: current.align,
      };
      const padding = options.containerPadding();
      const result = await library.computePosition(anchor, floating, {
        strategy: 'fixed',
        placement: toFloatingUi(start),
        middleware: [
          library.offset({
            mainAxis: options.offset(),
            crossAxis: options.crossOffset(),
          }),
          isFlipping &&
            library.flip({
              padding,
              crossAxis: false,
              fallbackPlacements: [
                toFloatingUi({
                  side: OPPOSITE[start.side],
                  align: start.align,
                }),
              ],
              fallbackStrategy: 'initialPlacement',
            }),
          library.shift({ padding, crossAxis: true }),
        ],
        // Placements are physical already: start is left.
        platform: { ...library.platform, isRTL: () => false },
      });
      if (isStopped) return;
      styles.set('left', `${result.x}px`);
      styles.set('top', `${result.y}px`);
      const placedSide = result.placement.split('-')[0] as PlacementSide;
      if (isFlipping) flip = { from: current.side, to: placedSide };
      report(placedSide);
    };

    loadFloatingUi().then(
      (library) => {
        if (isStopped) return;
        fui = library;
        stopUpdates = library.autoUpdate(anchor, floating, () => {
          void compute(library);
        });
      },
      () => undefined,
    );

    return {
      floating,
      anchor,
      update() {
        if (fui) void compute(fui);
      },
      stop() {
        isStopped = true;
        stopUpdates?.();
        styles.restore();
        arrowStyles?.restore();
      },
    };
  }

  const sync = () => {
    const floating = floatingElement();
    const anchor = floating ? options.anchor() : null;
    if (placed?.floating === floating && placed.anchor === anchor) return;
    placed?.stop();
    placed = floating && anchor ? place(floating, anchor) : null;
    if (!placed) side.set(undefined);
  };

  ctx.effect(() => {
    sync();
    return () => {
      placed?.stop();
      placed = null;
      side.set(undefined);
    };
  });
  ctx.watch(floatingElement, sync);
  ctx.watch(options.anchor, sync);
  ctx.watch(settings, () => placed?.update());
  ctx.watch(arrowElement, () => placed?.update());

  // Load Floating UI early in the browsers that need it, so the first open
  // doesn't wait for it.
  partEffect(ctx, options.part, (element) => {
    const view = element.ownerDocument.defaultView;
    if (view && !supportsAnchorPositioning(view)) {
      loadFloatingUi().catch(() => undefined);
    }
  });

  return { side: () => side.get() };
}
