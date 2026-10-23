import { afterEach, describe, expect, it } from 'vitest';

import { isTruncated } from './truncation';

const TEXT = 'Save the quarterly report';

const LINE =
  'display: block; margin: 0; padding: 0; border: 0; font: 14px/20px sans-serif; white-space: nowrap';
const CUT = `${LINE}; overflow: hidden; text-overflow: ellipsis`;

function mount(html: string, zoom = 1): HTMLElement {
  const container = document.createElement('div');
  container.style.zoom = String(zoom);
  container.innerHTML = html;
  document.body.append(container);
  return container.firstElementChild as HTMLElement;
}

/** The text's width as laid out: an inline block around it. */
function naturalWidth(zoom: number): number {
  const probe = mount(
    `<span style="${LINE}; display: inline-block">${TEXT}</span>`,
    zoom,
  );
  const width = probe.getBoundingClientRect().width / zoom;
  probe.parentElement!.remove();
  return width;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('isTruncated', () => {
  it('reads text an ellipsis cuts, and not text that fits', () => {
    expect(
      isTruncated(mount(`<p style="${CUT}; width: 80px">${TEXT}</p>`)),
    ).toBe(true);
    expect(
      isTruncated(mount(`<p style="${CUT}; width: 400px">${TEXT}</p>`)),
    ).toBe(false);
  });

  it('reads overflow under a pixel at any zoom, and an exact fit as fitting', () => {
    for (const zoom of [1, 0.67, 0.8, 0.9, 1.1, 1.25, 1.5]) {
      const width = naturalWidth(zoom);
      const over = mount(
        `<p style="${CUT}; width: ${width - 0.2}px">${TEXT}</p>`,
        zoom,
      );
      expect(isTruncated(over), `0.2px over at ${zoom}`).toBe(true);
      const exact = mount(
        `<p style="${CUT}; width: ${width}px">${TEXT}</p>`,
        zoom,
      );
      expect(isTruncated(exact), `exact at ${zoom}`).toBe(false);
    }
  });

  it('counts only an element that clips what overflows it', () => {
    expect(
      isTruncated(mount(`<p style="${LINE}; width: 80px">${TEXT}</p>`)),
    ).toBe(false);
    expect(
      isTruncated(
        mount(`<span style="${CUT}; display: inline">${TEXT}</span>`),
      ),
    ).toBe(false);
  });

  it('counts a line clamp, and not one line taller than its box', () => {
    const clamped = mount(
      `<p style="${CUT}; width: 80px; white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2">${TEXT} for the whole team today</p>`,
    );
    expect(isTruncated(clamped)).toBe(true);
    const tall = mount(
      `<p style="${CUT}; width: 300px; line-height: 1; font-family: Georgia, serif">Typography gjpqy</p>`,
    );
    expect(isTruncated(tall)).toBe(false);
  });

  it('reads nothing from an element that isn’t rendered', () => {
    const hidden = mount(
      `<p style="${CUT}; width: 80px; display: none">${TEXT}</p>`,
    );
    expect(isTruncated(hidden)).toBe(false);
    const detached = document.createElement('p');
    detached.textContent = TEXT;
    expect(isTruncated(detached)).toBe(false);
  });
});
