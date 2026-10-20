/** Browser-side helpers for this package's tests. */

import { commands } from 'vitest/browser';

import type { BuildCssOptions } from '../build';

declare module 'vitest/browser' {
  interface BrowserCommands {
    uniStylesCss(options?: BuildCssOptions): Promise<string>;
  }
}

/** Adds `buildCss(options)` to the document; resolves to its removal. */
export async function loadStyles(
  options?: BuildCssOptions,
): Promise<() => void> {
  const style = document.createElement('style');
  style.textContent = await commands.uniStylesCss(options);
  document.head.append(style);
  return () => style.remove();
}

/** An `<style>` added after the package's, for override checks. */
export function addStyle(css: string): () => void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

/**
 * Whether the page's stylesheets see a media query. Under emulation an
 * engine's `matchMedia()` can agree while its stylesheets don't.
 */
export function cssMatches(query: string): boolean {
  const remove = addStyle(`@media ${query} { :root { --uni-test-media: 1; } }`);
  const matches =
    getComputedStyle(document.documentElement).getPropertyValue(
      '--uni-test-media',
    ) === '1';
  remove();
  return matches;
}

/** A color as the browser draws it: sRGB channels 0–255 and alpha 0–1. */
export function rgba(color: string): [number, number, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas.');
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** WCAG 2 relative luminance of an opaque color. */
function luminance(color: string): number {
  const [r, g, b] = rgba(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two opaque colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** The computed `color` an element takes from a token in its scope. */
export function resolveToken(scope: Element, property: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${property})`;
  scope.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
