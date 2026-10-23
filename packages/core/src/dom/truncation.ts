/**
 * Whether an element's text is cut off (items spec, The overflow tooltip →
 * Measuring), asked only when a tooltip would open: nothing measures on
 * mount, per row or through observers.
 *
 * The element must clip what overflows it (its `overflow` isn't `visible`;
 * an inline box never clips), and either:
 *
 * - its content is wider than its box: a Range around its contents wider
 *   than its content box beyond `TOLERANCE`, or `scrollWidth` more than a
 *   pixel over `clientWidth`. The integers are rounded both ways: they miss
 *   an overflow under a pixel, which still shows the ellipsis (probed in
 *   Chromium and WebKit: 0.2 px over reads 161 against 161), and WebKit at
 *   125% reads text that fits a pixel wider than its box (155 against 154);
 * - or it wraps and its content is taller than its box by more than a
 *   pixel: a line clamp. Chromium reads a single line at `line-height: 1`
 *   a pixel taller than its box, so a pixel never counts.
 */

/**
 * How much wider than its box a Range may read before the text counts as
 * cut off, in CSS pixels: glyph advances and the layout's 1/64 px units
 * round differently. Probed from 67% to 150% zoom in Chromium and WebKit,
 * where text that fits reads at most its box's width.
 */
const TOLERANCE = 0.05;

const NOT_CLIPPING = new Set(['inline', 'contents', 'none']);

const px = (value: string): number => Number.parseFloat(value) || 0;

/** Whether text wraps in the element: a clamp can cut it only then. */
function wraps(style: CSSStyleDeclaration): boolean {
  const mode = style.getPropertyValue('text-wrap-mode');
  if (mode) return mode !== 'nowrap';
  return style.whiteSpace !== 'nowrap' && style.whiteSpace !== 'pre';
}

function isWider(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  if (element.scrollWidth - element.clientWidth > 1) return true;
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const content = range.getBoundingClientRect().width;
  const borders = px(style.borderLeftWidth) + px(style.borderRightWidth);
  const scrollbar = element.offsetWidth - element.clientWidth - borders;
  const box =
    element.getBoundingClientRect().width -
    borders -
    Math.max(0, scrollbar) -
    px(style.paddingLeft) -
    px(style.paddingRight);
  return content - box > TOLERANCE;
}

export function isTruncated(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view || !element.isConnected) return false;
  const style = view.getComputedStyle(element);
  if (NOT_CLIPPING.has(style.display)) return false;
  if (style.overflowX !== 'visible' && isWider(element, style)) return true;
  return (
    style.overflowY !== 'visible' &&
    wraps(style) &&
    element.scrollHeight - element.clientHeight > 1
  );
}
