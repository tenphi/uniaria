/**
 * Positioning (Popover spec, Positioning; Tooltip spec, Positioning): places
 * a floating part against an anchor element while active, in the mode the
 * page-wide `positioning` setting names (`./settings.ts`; owner,
 * 2026-10-16). Both follow CSS Anchor Positioning: a `position-area` that
 * puts the part on one side of the anchor, optionally with an alignment
 * span, and a `position-try-fallbacks` list.
 *
 * - `'script'` (the default): UniAria places the part itself in every
 *   browser, `position: fixed` with `top` and `left`, from its
 *   `positionArea` and `positionTryFallbacks` options, by the rules
 *   Chromium and WebKit follow (probed in Chromium 153 and WebKit 26.6; the
 *   OddBird polyfill, `@oddbird/css-anchor-positioning`, was the reference).
 *   An option fits when the part's margin box fits the area it names: from
 *   the anchor's edge to the viewport's on the side, and along the anchor's
 *   edge as its alignment spans. The base option is tried first, then each
 *   fallback in order, except that the last option that fit is kept while it
 *   still fits; when none fits, the last one that did, else the base. The
 *   margin box is then shifted into the viewport (grown to hold the anchor;
 *   Firefox doesn't shift, probed in Firefox 155). It checks every frame
 *   while active.
 * - `'css'`: the consumer's CSS places the part. UniAria only writes inline
 *   `position-anchor` (a name it adds to the anchor's own `anchor-name`
 *   list) and reads the side the part landed on back from the computed
 *   `position-area`, else from where it is.
 *
 * Gaps are the part's margins, which are the consumer's: the margin facing
 * the anchor is the gap, the others keep the part off the viewport's edges,
 * and try tactics swap them (`flip-block` swaps top and bottom; probed).
 * Logical keywords follow CSS: plain ones the page's direction (the top
 * layer's containing block), `self-` ones the part's own.
 *
 * Both modes write `--anchor-width` (the anchor's width),
 * `--available-width` and `--available-height` in pixels: the most room the
 * part could take in any of its options, so a `max-height` built on them
 * never stops a fallback. Both place the arrow along the edge, pointing at
 * the anchor's centre; CSS anchor positioning can't (probed).
 *
 * In script mode UniAria owns the floating part's `position` and `inset`
 * longhands; in both, `position-anchor`, the variables and the arrow's `left`
 * or `top`. It puts back what was there when it stops.
 */

import { isDevelopment, warn } from './dev';
import { getSettings } from './settings';
import { supportsAnchorPositioning } from './support';
import type { InteractionContext } from './types';
import { partElement } from './types';

type Area<Side extends string, Span extends string> =
  Side | `${Side} ${'center' | 'span-all' | Span}`;

/**
 * A CSS `position-area` that puts the part on one side of the anchor: a side,
 * optionally with the other axis's `center` or a span (`'top span-right'`:
 * above, left edges aligned). Corners and areas over the anchor aren't
 * supported: the arrow needs a side.
 */
export type PositionArea =
  | Area<'top' | 'bottom', 'span-left' | 'span-right'>
  | Area<'left' | 'right', 'span-top' | 'span-bottom'>
  | Area<'block-start' | 'block-end', 'span-inline-start' | 'span-inline-end'>
  | Area<'inline-start' | 'inline-end', 'span-block-start' | 'span-block-end'>
  | Area<
      'self-block-start' | 'self-block-end',
      'span-self-inline-start' | 'span-self-inline-end'
    >
  | Area<
      'self-inline-start' | 'self-inline-end',
      'span-self-block-start' | 'span-self-block-end'
    >;

export interface PositionOptions {
  /** The floating part, such as a popover. */
  readonly part: string;
  /** A part to point at the anchor's centre, such as an arrow. */
  readonly arrowPart?: string;
  isActive(): boolean;
  /** The element to place against. */
  anchor(): HTMLElement | null;
  /** A CSS `position-area` (`PositionArea`). */
  positionArea(): string;
  /** A CSS `position-try-fallbacks`: try tactics and areas, or `none`. */
  positionTryFallbacks(): string;
}

export interface Position {
  /** The side the part was placed on, after fallbacks; `undefined` while inactive. */
  side(): PlacementSide | undefined;
}

export type PlacementSide = 'top' | 'bottom' | 'left' | 'right';

/** Along the anchor's edge; start is left or top. */
type Align = 'start' | 'center' | 'end';

interface Placement {
  readonly side: PlacementSide;
  readonly align: Align;
}

/** Margins in shorthand order: top, right, bottom, left. */
type Box = readonly [number, number, number, number];

type Tactic = 'flip-block' | 'flip-inline' | 'flip-start';

const TACTICS: readonly string[] = ['flip-block', 'flip-inline', 'flip-start'];

/** Edges in shorthand order. */
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const OPPOSITE: Readonly<Record<PlacementSide, PlacementSide>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/** Above or below the anchor: the cross axis is horizontal. */
const isVertical = (side: PlacementSide) => side === 'top' || side === 'bottom';

interface Directions {
  /** The page's, which plain logical keywords follow. */
  readonly isPageRtl: boolean;
  /** The part's own, which `self-` keywords and try tactics follow. */
  readonly isSelfRtl: boolean;
}

/**
 * The physical edge a `position-area` keyword names, without its `span-`.
 * Generic `start` and `end` take their axis from where they stand.
 */
function edgeOf(
  word: string,
  axis: 'block' | 'inline' | undefined,
  { isPageRtl, isSelfRtl }: Directions,
): PlacementSide | undefined {
  const isSelf = word.startsWith('self-');
  const name = isSelf ? word.slice('self-'.length) : word;
  const isRtl = isSelf ? isSelfRtl : isPageRtl;
  const inline = (isEnd: boolean) => (isEnd !== isRtl ? 'right' : 'left');
  switch (name) {
    case 'top':
    case 'bottom':
    case 'left':
    case 'right':
      return isSelf ? undefined : name;
    case 'block-start':
      return 'top';
    case 'block-end':
      return 'bottom';
    case 'inline-start':
      return inline(false);
    case 'inline-end':
      return inline(true);
    case 'start':
    case 'end':
      if (axis === 'block') return name === 'start' ? 'top' : 'bottom';
      return axis === 'inline' ? inline(name === 'end') : undefined;
    default:
      return undefined;
  }
}

/**
 * The side and alignment a `position-area` names, specified or computed
 * (`span-right bottom`, `end span-end`); `undefined` for any other form.
 */
function parseArea(
  value: string,
  directions: Directions,
): Placement | undefined {
  const words = value.trim().split(/\s+/);
  if (words.length > 2 || words[0] === '') return undefined;
  // Two generic keywords are block then inline.
  const isGeneric = (word: string) =>
    /^(span-)?(self-)?(start|end)$/.test(word);
  const axes =
    words.length === 2 && words.every(isGeneric)
      ? (['block', 'inline'] as const)
      : ([undefined, undefined] as const);
  let side: PlacementSide | undefined;
  let toward: PlacementSide | undefined;
  for (const [index, word] of words.entries()) {
    if (word === 'center' || word === 'span-all') continue;
    const isSpan = word.startsWith('span-');
    const edge = edgeOf(
      isSpan ? word.slice('span-'.length) : word,
      axes[index],
      directions,
    );
    if (!edge || (isSpan ? toward : side)) return undefined;
    if (isSpan) toward = edge;
    else side = edge;
  }
  if (!side) return undefined;
  if (!toward) return { side, align: 'center' };
  if (isVertical(toward) === isVertical(side)) return undefined;
  // Spanning toward one edge aligns the part with the anchor's other edge.
  return {
    side,
    align: toward === 'right' || toward === 'bottom' ? 'start' : 'end',
  };
}

type TryOption =
  { readonly tactics: readonly Tactic[] } | { readonly area: string };

/** `position-try-fallbacks`: try tactics, or a `position-area` each. */
function parseFallbacks(value: string): TryOption[] {
  const text = value.trim();
  if (text === '' || text === 'none') return [];
  return text.split(',').map((entry) => {
    const words = entry.trim().split(/\s+/);
    return words.every((word) => TACTICS.includes(word))
      ? { tactics: words as Tactic[] }
      : { area: entry.trim() };
  });
}

/**
 * A try tactic as a swap of edges: `flip-block` and `flip-inline` mirror an
 * axis, `flip-start` swaps block-start with inline-start and block-end with
 * inline-end, in the part's own direction.
 */
function tacticEdges(
  tactic: Tactic,
  isRtl: boolean,
): (edge: PlacementSide) => PlacementSide {
  if (tactic === 'flip-block') {
    return (edge) => (isVertical(edge) ? OPPOSITE[edge] : edge);
  }
  if (tactic === 'flip-inline') {
    return (edge) => (isVertical(edge) ? edge : OPPOSITE[edge]);
  }
  const start: PlacementSide = isRtl ? 'right' : 'left';
  const swap: Record<PlacementSide, PlacementSide> = {
    top: start,
    bottom: OPPOSITE[start],
    [start]: 'top',
    [OPPOSITE[start]]: 'bottom',
  } as Record<PlacementSide, PlacementSide>;
  return (edge) => swap[edge];
}

/** The anchor edge an aligned part lines up with. */
function alignedEdge({ side, align }: Placement): PlacementSide | undefined {
  if (align === 'center') return undefined;
  if (isVertical(side)) return align === 'start' ? 'left' : 'right';
  return align === 'start' ? 'top' : 'bottom';
}

/** Applies try tactics, in order, to a placement and its margins. */
function applyTactics(
  placement: Placement,
  margins: Box,
  tactics: readonly Tactic[],
  isRtl: boolean,
): [Placement, Box] {
  let current = placement;
  let box = margins;
  for (const tactic of tactics) {
    const swap = tacticEdges(tactic, isRtl);
    const edge = alignedEdge(current);
    const next = edge && swap(edge);
    current = {
      side: swap(current.side),
      align: !next
        ? 'center'
        : next === 'left' || next === 'top'
          ? 'start'
          : 'end',
    };
    // Each tactic is its own inverse: an edge takes the swapped edge's margin.
    const at = (side: PlacementSide) => box[SIDES.indexOf(swap(side))]!;
    box = [at('top'), at('right'), at('bottom'), at('left')];
  }
  return [current, box];
}

interface Candidate {
  readonly placement: Placement;
  readonly margins: Box;
  readonly tactics: readonly Tactic[];
}

/** The base option, then each fallback that parses, with their margins. */
function candidates(
  base: Placement,
  fallbacks: string,
  margins: Box,
  directions: Directions,
): Candidate[] {
  const list: Candidate[] = [{ placement: base, margins, tactics: [] }];
  for (const option of parseFallbacks(fallbacks)) {
    if ('area' in option) {
      const placement = parseArea(option.area, directions);
      if (placement) list.push({ placement, margins, tactics: [] });
      continue;
    }
    const [placement, box] = applyTactics(
      base,
      margins,
      option.tactics,
      directions.isSelfRtl,
    );
    list.push({ placement, margins: box, tactics: option.tactics });
  }
  return list;
}

/**
 * In CSS mode only the applied option and its margins can be read: the
 * options of every base it could have come from, as its try tactics undone
 * (in reverse, each being its own inverse) give back.
 */
function appliedCandidates(
  applied: Placement,
  fallbacks: string,
  margins: Box,
  directions: Directions,
): Candidate[] {
  const bases: [Placement, Box][] = [[applied, margins]];
  for (const option of parseFallbacks(fallbacks)) {
    if ('tactics' in option) {
      bases.push(
        applyTactics(
          applied,
          margins,
          [...option.tactics].reverse(),
          directions.isSelfRtl,
        ),
      );
    }
  }
  return bases.flatMap(([base, box]) =>
    candidates(base, fallbacks, box, directions),
  );
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The viewport, grown to hold the anchor, as the browsers' areas are. */
function viewportAround(anchor: Rect, width: number, height: number): Rect {
  return {
    left: Math.min(0, anchor.left),
    top: Math.min(0, anchor.top),
    right: Math.max(width, anchor.right),
    bottom: Math.max(height, anchor.bottom),
  };
}

/** The area an option names: beside the anchor, spanning as it aligns. */
function areaOf({ side, align }: Placement, anchor: Rect, view: Rect): Rect {
  if (isVertical(side)) {
    const left = align === 'start' ? anchor.left : view.left;
    const right = align === 'end' ? anchor.right : view.right;
    return side === 'bottom'
      ? { left, right, top: anchor.bottom, bottom: view.bottom }
      : { left, right, top: view.top, bottom: anchor.top };
  }
  const top = align === 'start' ? anchor.top : view.top;
  const bottom = align === 'end' ? anchor.bottom : view.bottom;
  return side === 'right'
    ? { top, bottom, left: anchor.right, right: view.right }
    : { top, bottom, left: view.left, right: anchor.left };
}

/** Whether the margin box fits the option's area on both axes. */
function fits(
  { placement, margins: [top, right, bottom, left] }: Candidate,
  anchor: Rect,
  view: Rect,
  width: number,
  height: number,
): boolean {
  const area = areaOf(placement, anchor, view);
  return (
    width + left + right <= area.right - area.left + 0.5 &&
    height + top + bottom <= area.bottom - area.top + 0.5
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Where an option puts the part's border box, kept inside the viewport. */
function locate(
  {
    placement: { side, align },
    margins: [top, right, bottom, left],
  }: Candidate,
  anchor: Rect,
  view: Rect,
  width: number,
  height: number,
): { x: number; y: number } {
  const across = (
    start: number,
    end: number,
    size: number,
    before: number,
    after: number,
  ) =>
    align === 'start'
      ? start + before
      : align === 'end'
        ? end - after - size
        : (start + end) / 2 - size / 2 + (before - after) / 2;
  let x =
    side === 'right'
      ? anchor.right + left
      : side === 'left'
        ? anchor.left - right - width
        : across(anchor.left, anchor.right, width, left, right);
  let y =
    side === 'bottom'
      ? anchor.bottom + top
      : side === 'top'
        ? anchor.top - bottom - height
        : across(anchor.top, anchor.bottom, height, top, bottom);
  x = clamp(x, view.left + left, view.right - right - width);
  y = clamp(y, view.top + top, view.bottom - bottom - height);
  return { x, y };
}

/** The most room the part could take in any option, as variables do. */
function room(
  options: readonly Candidate[],
  anchor: Rect,
  view: Rect,
): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const { placement, margins } of options) {
    const area = areaOf(placement, anchor, view);
    // Across, the browsers shift the part over the whole viewport.
    const box = isVertical(placement.side)
      ? { ...area, left: view.left, right: view.right }
      : { ...area, top: view.top, bottom: view.bottom };
    const [top, right, bottom, left] = margins;
    width = Math.max(width, box.right - box.left - left - right);
    height = Math.max(height, box.bottom - box.top - top - bottom);
  }
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

function readMargins(style: CSSStyleDeclaration): Box {
  const px = (value: string) => Number.parseFloat(value) || 0;
  return [
    px(style.marginTop),
    px(style.marginRight),
    px(style.marginBottom),
    px(style.marginLeft),
  ];
}

/** Inline styles UniAria writes on an element, put back as they were. */
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
      if (
        saved.has(property) &&
        element.style.getPropertyValue(property) === value
      ) {
        return;
      }
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

/**
 * Writes `inset` as longhands: a shorthand would drop a consumer's own
 * longhand when put back.
 */
function setInset(
  styles: InlineStyles,
  values: readonly [string, string, string, string],
): void {
  SIDES.forEach((edge, index) => styles.set(edge, values[index]!));
}

const ANCHORS = Symbol.for('@uniaria/anchors/v1');

/** A new anchor name, unique in the window across copies of UniAria. */
function anchorName(view: Window): string {
  const count = ((Reflect.get(view, ANCHORS) as number | undefined) ?? 0) + 1;
  Reflect.set(view, ANCHORS, count);
  return `--uni-anchor-${count}`;
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

/** Values already warned about, so each is reported once. */
const reported = new Set<string>();

/** Warns once per message, in development. */
function warnOnce(message: string): void {
  if (!isDevelopment() || reported.has(message)) return;
  reported.add(message);
  warn(message);
}

/** Development checks for the options' values. */
function checkOptions(view: Window, area: string, fallbacks: string): void {
  if (!isDevelopment()) return;
  const directions = { isPageRtl: false, isSelfRtl: false };
  if (!parseArea(area, directions)) {
    warnOnce(
      `positionArea "${area}" doesn't put the part on one side of the ` +
        'anchor: use a side, optionally with center or a span ("top span-right").',
    );
  }
  for (const option of parseFallbacks(fallbacks)) {
    if ('area' in option && !parseArea(option.area, directions)) {
      warnOnce(
        `positionTryFallbacks entry "${option.area}" is neither try ` +
          'tactics nor a position-area on one side of the anchor; it is skipped.',
      );
    }
  }
  const css = (view as Window & typeof globalThis).CSS as
    typeof CSS | undefined;
  if (css?.supports('position-area: top') === true) {
    if (!css.supports(`position-area: ${area}`)) {
      warnOnce(`positionArea "${area}" isn't a valid CSS position-area.`);
    }
    if (!css.supports(`position-try-fallbacks: ${fallbacks}`)) {
      warnOnce(
        `positionTryFallbacks "${fallbacks}" isn't a valid CSS position-try-fallbacks.`,
      );
    }
  }
}

/** The side of the anchor a part sits on, from where both are. */
function sideFrom(part: Rect, anchor: Rect): PlacementSide {
  const gaps: Record<PlacementSide, number> = {
    top: anchor.top - part.bottom,
    bottom: part.top - anchor.bottom,
    left: anchor.left - part.right,
    right: part.left - anchor.right,
  };
  return (Object.keys(gaps) as PlacementSide[]).reduce((best, side) =>
    gaps[side] > gaps[best] ? side : best,
  );
}

/**
 * An element's size before its own transform and `zoom`. An SVG element has
 * no offset size: its box on screen, scaled back by its part's factor.
 */
function layoutSize(
  element: Element,
  scaleX: number,
  scaleY: number,
): { readonly width: number; readonly height: number } {
  if ('offsetWidth' in element) {
    const { offsetWidth, offsetHeight } = element as HTMLElement;
    return { width: offsetWidth, height: offsetHeight };
  }
  const box = element.getBoundingClientRect();
  return { width: box.width / scaleX, height: box.height / scaleY };
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
    `${options.positionArea()} / ${options.positionTryFallbacks()}`;

  function place(floating: HTMLElement, anchor: HTMLElement): Placed | null {
    const view = floating.ownerDocument.defaultView;
    if (!view) return null;
    const document = floating.ownerDocument;
    const styles = inlineStyles(floating);
    let arrow: HTMLElement | null = null;
    let arrowStyles: InlineStyles | null = null;

    const directions = (): Directions => ({
      isPageRtl:
        view.getComputedStyle(document.documentElement).direction === 'rtl',
      isSelfRtl: view.getComputedStyle(floating).direction === 'rtl',
    });
    const viewport = (box: Rect) => {
      const { clientWidth, clientHeight } = document.documentElement;
      return viewportAround(box, clientWidth, clientHeight);
    };

    const writeVariables = (
      list: readonly Candidate[],
      box: DOMRect,
      area: Rect,
    ) => {
      const { width, height } = room(list, box, area);
      styles.set('--anchor-width', `${box.width}px`);
      styles.set('--available-width', `${width}px`);
      styles.set('--available-height', `${height}px`);
    };

    // Along the edge facing the anchor, measured in the part's padding box.
    // False when the part can't be measured now.
    const placeArrow = (placedSide: PlacementSide): boolean => {
      const next = arrowElement();
      if (next !== arrow) {
        arrowStyles?.restore();
        arrow = next;
        arrowStyles = next ? inlineStyles(next) : null;
      }
      if (!arrow || !arrowStyles) return true;
      const target = anchor.getBoundingClientRect();
      const box = floating.getBoundingClientRect();
      // `left` and `top` work in the part's own pixels, before its transform
      // (a scale animating it in) and `zoom`: its box on screen is scaled
      // back by their factor. The arrow's own transform (a square turned
      // into a diamond) turns it about its centre, so its size is taken
      // before it.
      const scaleX = floating.offsetWidth
        ? box.width / floating.offsetWidth
        : 1;
      const scaleY = floating.offsetHeight
        ? box.height / floating.offsetHeight
        : 1;
      // Scaled to nothing, as an animation may start it.
      if (!scaleX || !scaleY) return false;
      const size = layoutSize(arrow, scaleX, scaleY);
      if (isVertical(placedSide)) {
        const centre = target.left + target.width / 2;
        const left =
          (centre - box.left) / scaleX - floating.clientLeft - size.width / 2;
        arrowStyles.reset('top');
        arrowStyles.set(
          'left',
          `${clamp(left, 0, floating.clientWidth - size.width)}px`,
        );
      } else {
        const centre = target.top + target.height / 2;
        const top =
          (centre - box.top) / scaleY - floating.clientTop - size.height / 2;
        arrowStyles.reset('left');
        arrowStyles.set(
          'top',
          `${clamp(top, 0, floating.clientHeight - size.height)}px`,
        );
      }
      return true;
    };

    const report = (placedSide: PlacementSide) => {
      side.set(placedSide);
      // Unmeasured, it is placed again next frame: a scale animating the
      // part changes nothing the frames compare.
      if (!placeArrow(placedSide)) measured = '';
    };

    let frame = 0;
    let measured = '';
    let unname: (() => void) | null = null;

    // CSS mode: the consumer's CSS places it, and this reads back what the
    // browser applied.
    const follow = (isForced: boolean) => {
      const style = view.getComputedStyle(floating);
      const current = directions();
      const box = anchor.getBoundingClientRect();
      const part = floating.getBoundingClientRect();
      const area = style.getPropertyValue('position-area');
      const fallbacks = style.getPropertyValue('position-try-fallbacks');
      const margins = readMargins(style);
      const { clientWidth, clientHeight } = document.documentElement;
      const key = [
        area,
        fallbacks,
        box.left,
        box.top,
        box.width,
        box.height,
        part.left,
        part.top,
        part.width,
        part.height,
        clientWidth,
        clientHeight,
        ...margins,
        current.isPageRtl,
        current.isSelfRtl,
      ].join(' ');
      if (!isForced && key === measured) return;
      measured = key;
      const applied = parseArea(area, current) ?? {
        side: sideFrom(part, box),
        align: 'center',
      };
      writeVariables(
        appliedCandidates(applied, fallbacks, margins, current),
        box,
        viewport(box),
      );
      report(applied.side);
    };

    // Script mode: it measures and places the part again when anything it
    // depends on changed.
    let lastFit: { readonly settings: string; readonly index: number } | null =
      null;
    const arrange = (isForced: boolean) => {
      const margins = readMargins(view.getComputedStyle(floating));
      const current = directions();
      const box = anchor.getBoundingClientRect();
      const area = viewport(box);
      const list = candidates(
        parseArea(options.positionArea(), current) ?? {
          side: 'bottom',
          align: 'center',
        },
        options.positionTryFallbacks(),
        margins,
        current,
      );
      // Before measuring: a size built on the variables depends on them.
      writeVariables(list, box, area);
      const width = floating.offsetWidth;
      const height = floating.offsetHeight;
      const key = [
        settings(),
        box.left,
        box.top,
        box.width,
        box.height,
        area.right,
        area.bottom,
        width,
        height,
        ...margins,
        current.isPageRtl,
        current.isSelfRtl,
      ].join(' ');
      if (!isForced && key === measured) return;
      measured = key;
      const isFit = (index: number) =>
        fits(list[index]!, box, area, width, height);
      // The last option that fit stays while it fits, as the browsers keep it.
      const last = lastFit?.settings === settings() ? lastFit.index : null;
      let index =
        last !== null && last < list.length && isFit(last)
          ? last
          : list.findIndex((_, at) => isFit(at));
      if (index === -1) index = last !== null && last < list.length ? last : 0;
      else lastFit = { settings: settings(), index };
      const chosen = list[index]!;
      const { x, y } = locate(chosen, box, area, width, height);
      // The part's own margins move it from its inset.
      setInset(styles, [
        `${y - margins[0]}px`,
        'auto',
        'auto',
        `${x - margins[3]}px`,
      ]);
      report(chosen.placement.side);
    };

    let apply = arrange;
    if (getSettings().positioning === 'css') {
      if (!supportsAnchorPositioning(view)) {
        warnOnce(
          "positioning is 'css', but this browser has no CSS anchor " +
            "positioning: parts stay where the consumer's CSS puts them.",
        );
      }
      const name = anchorName(view);
      unname = nameAnchor(anchor, name);
      styles.set('position-anchor', name);
      apply = follow;
    } else {
      checkOptions(
        view,
        options.positionArea(),
        options.positionTryFallbacks(),
      );
      // Placed from its top left, so the browser's `margin: auto` for a
      // popover resolves to nothing before the margins are read.
      styles.set('position', 'fixed');
      setInset(styles, ['0px', 'auto', 'auto', '0px']);
    }

    // Every frame while active: the anchor can move without an event.
    const loop = () => {
      apply(false);
      frame = view.requestAnimationFrame(loop);
    };
    apply(true);
    frame = view.requestAnimationFrame(loop);
    return {
      floating,
      anchor,
      update: () => apply(true),
      stop() {
        view.cancelAnimationFrame(frame);
        unname?.();
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

  // Measured once the store has flushed, as an element effect runs: the
  // floating element is shown and carries the change's state by then.
  let isLive = false;
  const later = (fn: () => void) => () =>
    ctx.afterFlush(() => {
      if (isLive) fn();
    });
  ctx.effect(() => {
    isLive = true;
    later(sync)();
    return () => {
      isLive = false;
      placed?.stop();
      placed = null;
      side.set(undefined);
    };
  });
  ctx.watch(floatingElement, later(sync));
  ctx.watch(options.anchor, later(sync));
  ctx.watch(
    settings,
    later(() => {
      if (!placed) return;
      const view = placed.floating.ownerDocument.defaultView;
      if (view && getSettings().positioning === 'script') {
        checkOptions(
          view,
          options.positionArea(),
          options.positionTryFallbacks(),
        );
      }
      placed.update();
    }),
  );
  ctx.watch(
    arrowElement,
    later(() => placed?.update()),
  );

  return { side: () => side.get() };
}
