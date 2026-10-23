/**
 * The links a component takes to a tooltip (`./spec.md`, Resolved questions
 * 2; items spec, Runtime and harness changes 4): small keys and the contract
 * between the two, so Button, Checkbox, the lists and the rest import this
 * module and never the tooltip itself.
 *
 * A component hands the tooltip the elements it routes from: hover from its
 * visible part, focus and presses from its focusable part, the anchor, and
 * its text elements, which an overflow tooltip measures and copies. It adds
 * the tooltip's id to its focusable part's `aria-describedby`, or
 * `aria-labelledby` with `relation: 'label'`, so the relation is in the
 * server HTML.
 *
 * A list drives its option tooltip instead (items spec, Option tooltips):
 * it reports where hover and visible focus are, each with the option's
 * anchor and text elements, and the presses and typing that close it.
 */

import { isDevelopment, partEffect, partElement, warn } from '../../dom';
import type { InteractionContext } from '../../dom';
import type { LinkKey, Linked } from '../../runtime';

/** The elements of the component a tooltip describes. */
export interface TooltipTarget {
  /** Where hover counts: the component's visible part. */
  readonly hover: HTMLElement | null;
  /** Where focus and presses count: its focusable part. */
  readonly focus: HTMLElement | null;
  /** What the tooltip is placed against. */
  readonly anchor: HTMLElement | null;
  /** What it measures and copies (items spec, The trigger's text). */
  readonly text: readonly HTMLElement[];
}

/** An option a list reports to its tooltip. */
export interface TooltipItem {
  readonly key: string;
  /** The option: what the tooltip is placed against. */
  readonly anchor: HTMLElement;
  /** Its `optionLabel` and `optionDescription` while rendered, else it. */
  readonly text: readonly HTMLElement[];
}

/** What a list drives its option tooltip with. */
export interface TooltipDriver {
  /** The option under the pointer, or none. */
  hover(item: TooltipItem | null): void;
  /** The option with visible focus or the visible highlight, or none. */
  focus(item: TooltipItem | null): void;
  /**
   * A press or typing: closed until the pointer moves to another option
   * or leaves, or focus moves to another one.
   */
  dismiss(): void;
  /** Gives the tooltip back. */
  release(): void;
}

/** The reference a described component carries; one of the two is set. */
export interface TooltipRelation {
  readonly describedBy?: string;
  readonly labelledBy?: string;
}

/** What a tooltip's `setup()` offers the component linked to it. */
export interface TooltipLinkApi {
  /**
   * Makes `target` the component the tooltip describes, replacing what the
   * same taker gave before. Returns the release, or `null` when another
   * component has the tooltip: a tooltip describes one.
   */
  take(target: TooltipTarget): (() => void) | null;
  /** The driven mode, for a list; `null` when another component has it. */
  drive(): TooltipDriver | null;
  /** The reference for the focusable part; `undefined` while disabled. */
  relation(): TooltipRelation | undefined;
}

export const tooltipLink: LinkKey<'tooltip', TooltipLinkApi> = {
  name: 'tooltip',
};

/**
 * One tooltip for every option of a list. On elements only its attribute
 * names it, so a `<uni-select>` in a `<uni-tooltip>` takes that tooltip for
 * its trigger (items spec, Resolved questions 7).
 */
export const optionTooltipLink: LinkKey<'optionTooltip', TooltipLinkApi> = {
  name: 'optionTooltip',
  attribute: 'option-tooltip',
  isAttributeOnly: true,
};

/**
 * The part names a linking component routes from. Hover falls back to the
 * focusable part and the anchor to hover, for a part that isn't rendered.
 */
export interface TooltipParts {
  /** One part, or several in order: the first one rendered. */
  readonly hover: string | readonly string[];
  readonly focus: string;
  /** Defaults to `hover`. */
  readonly anchor?: string;
  /**
   * Its text elements: these parts while rendered, else `textFallback`
   * (items spec, The trigger's text). Default: none.
   */
  readonly text?: readonly string[];
  /** Measured when no `text` part is rendered; defaults to `focus`, `null` for none. */
  readonly textFallback?: string | null;
}

interface LinkContext extends InteractionContext {
  link<Api>(key: LinkKey<string, Api>): Linked<Api> | undefined;
  memo<const D extends readonly unknown[], T>(
    deps: () => D,
    compute: (...deps: D) => T,
  ): () => T;
}

/**
 * For a component that declares `links: [tooltipLink]`: hands the linked
 * tooltip its parts while started, and returns the relation its focusable
 * part carries.
 */
export function linkTooltip(ctx: LinkContext, parts: TooltipParts) {
  const linked = () => ctx.link(tooltipLink);
  const hoverParts =
    typeof parts.hover === 'string' ? [parts.hover] : parts.hover;
  const textParts = parts.text ?? [];
  const textFallback =
    parts.textFallback === undefined ? parts.focus : parts.textFallback;
  const hovered = () =>
    hoverParts.map((part) => partElement(ctx, part)).find(Boolean) ?? null;
  const target = ctx.memo(
    () =>
      [
        linked(),
        hovered(),
        partElement(ctx, parts.focus),
        parts.anchor ? partElement(ctx, parts.anchor) : hovered(),
        textFallback === null ? null : partElement(ctx, textFallback),
        ...textParts.map((part) => partElement(ctx, part)),
      ] as const,
    (tooltip, hover, focus, anchor, fallback, ...texts) => {
      if (!tooltip) return null;
      const rendered = texts.filter((element) => element !== null);
      return {
        tooltip,
        elements: {
          hover: hover ?? focus,
          focus,
          anchor: anchor ?? hover ?? focus,
          text: rendered.length > 0 ? rendered : fallback ? [fallback] : [],
        },
      };
    },
  );

  let release: (() => void) | null = null;
  const take = (current: ReturnType<typeof target>) => {
    release?.();
    release = null;
    if (!current) return;
    release = current.tooltip.api.take(current.elements);
    if (!release && isDevelopment()) {
      warn(
        'tooltip: it already describes another component; a tooltip ' +
          'describes one. Give each component its own tooltip.',
      );
    }
  };
  ctx.watch(target, take);
  ctx.effect(() => {
    take(target());
    return () => take(null);
  });

  const relation = () => linked()?.api.relation();
  return {
    describedBy: () => relation()?.describedBy,
    labelledBy: () => relation()?.labelledBy,
  };
}

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/**
 * The relation as attributes, after the component's own references (a
 * Button's label and description), only while one of them is there, so a
 * component never takes over a consumer's own `aria-describedby` without
 * one.
 */
export function relationAttributes(
  link: ReturnType<typeof linkTooltip>,
  own: TooltipRelation = {},
): Record<string, string> {
  const describedBy = references(own.describedBy, link.describedBy());
  const labelledBy = references(own.labelledBy, link.labelledBy());
  return {
    ...(describedBy === undefined ? {} : { 'aria-describedby': describedBy }),
    ...(labelledBy === undefined ? {} : { 'aria-labelledby': labelledBy }),
  };
}

/** What a list reports its option tooltip from. */
export interface OptionTooltipSource {
  /** The option under the pointer. */
  hoveredKey(): string | null;
  /** The option with visible focus or the visible highlight. */
  focusedKey(): string | null;
  /** An option's element, while rendered. */
  option(key: string): HTMLElement | null;
  /** An option's text elements, while rendered. */
  text(key: string): readonly HTMLElement[];
  /** Where keys arrive: the list, and Combobox's input. */
  readonly keyParts: readonly string[];
  /** Where presses on options arrive: the list. */
  readonly pressPart: string;
}

/** Keys that move focus or the highlight (items spec, Option tooltips). */
const NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/** Typeahead, or editing Combobox's text. */
function isTyping(event: KeyboardEvent): boolean {
  if (event.key === 'Backspace' || event.key === 'Delete') return true;
  return (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

/**
 * For a list that declares `links: [optionTooltipLink]`: drives the linked
 * tooltip from hover, visible focus or the highlight, presses and typing
 * while started. Options get no link of their own (root AGENTS.md →
 * Composition: collections stay data).
 */
export function linkOptionTooltip(
  ctx: LinkContext,
  source: OptionTooltipSource,
): void {
  const linked = () => ctx.link(optionTooltipLink);
  let driver: TooltipDriver | null = null;
  // Typing closes it until a navigation key moves focus or the highlight.
  let isTyped = false;
  let isNavigating = false;

  const item = (key: string | null): TooltipItem | null => {
    if (key === null) return null;
    const anchor = source.option(key);
    return anchor ? { key, anchor, text: source.text(key) } : null;
  };
  const reportHover = () => driver?.hover(item(source.hoveredKey()));
  const reportFocus = () =>
    driver?.focus(isTyped ? null : item(source.focusedKey()));

  const drive = (tooltip: ReturnType<typeof linked>) => {
    driver?.release();
    driver = tooltip?.api.drive() ?? null;
    if (tooltip && !driver && isDevelopment()) {
      warn(
        'tooltip: it already describes another component; a tooltip ' +
          'describes one. Give each list its own option tooltip.',
      );
    }
    reportHover();
    reportFocus();
  };
  ctx.watch(linked, drive);
  ctx.effect(() => {
    drive(linked());
    return () => drive(undefined);
  });
  ctx.watch(source.hoveredKey, reportHover);
  ctx.watch(source.focusedKey, () => {
    if (isNavigating) isTyped = false;
    isNavigating = false;
    // Once the flush is done, so a popup that opens with it is shown and
    // its options measure.
    ctx.afterFlush(reportFocus);
  });

  // In the capture phase, so it has seen the key before the list moves
  // focus for it.
  for (const part of source.keyParts) {
    partEffect(ctx, part, (element) => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (NAVIGATION_KEYS.has(event.key)) {
          isNavigating = true;
          return;
        }
        if (!isTyping(event)) return;
        isNavigating = false;
        isTyped = true;
        driver?.dismiss();
      };
      element.addEventListener('keydown', onKeyDown, true);
      return () => element.removeEventListener('keydown', onKeyDown, true);
    });
  }
  partEffect(ctx, source.pressPart, (element) => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') driver?.dismiss();
    };
    element.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      element.removeEventListener('pointerdown', onPointerDown, true);
  });
}
