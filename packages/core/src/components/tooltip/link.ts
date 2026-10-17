/**
 * The link a component takes to its tooltip (`./spec.md`, Resolved questions
 * 2): a small key and the contract between the two, so Button, Checkbox and
 * the rest import this module and never the tooltip itself.
 *
 * The component hands the tooltip the elements it routes from: hover from
 * its visible part, focus and presses from its focusable part, and the
 * anchor. It adds the tooltip's id to its focusable part's
 * `aria-describedby`, or `aria-labelledby` with `relation: 'label'`, so the
 * relation is in the server HTML.
 */

import { isDevelopment, partElement, warn } from '../../dom';
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
  /** The reference for the focusable part; `undefined` while disabled. */
  relation(): TooltipRelation | undefined;
}

export const tooltipLink: LinkKey<'tooltip', TooltipLinkApi> = {
  name: 'tooltip',
};

/**
 * The part names a linking component routes from. Hover falls back to the
 * focusable part and the anchor to hover, for a part that isn't rendered.
 */
export interface TooltipParts {
  readonly hover: string;
  readonly focus: string;
  /** Defaults to `hover`. */
  readonly anchor?: string;
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
  const target = ctx.memo(
    () =>
      [
        linked(),
        partElement(ctx, parts.hover),
        partElement(ctx, parts.focus),
        partElement(ctx, parts.anchor ?? parts.hover),
      ] as const,
    (tooltip, hover, focus, anchor) =>
      tooltip
        ? {
            tooltip,
            elements: {
              hover: hover ?? focus,
              focus,
              anchor: anchor ?? hover ?? focus,
            },
          }
        : null,
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

/**
 * The relation as attributes, only while a tooltip is linked, so a
 * component never takes over a consumer's own `aria-describedby` without
 * one.
 */
export function relationAttributes(
  link: ReturnType<typeof linkTooltip>,
): Record<string, string> {
  const describedBy = link.describedBy();
  const labelledBy = link.labelledBy();
  return {
    ...(describedBy === undefined ? {} : { 'aria-describedby': describedBy }),
    ...(labelledBy === undefined ? {} : { 'aria-labelledby': labelledBy }),
  };
}
