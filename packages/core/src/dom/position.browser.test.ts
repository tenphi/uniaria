import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInstance, defineBehavior, prop } from '../runtime';
import { createPosition } from './position';
import type { PositionArea } from './position';
import { configure } from './settings';
import { supportsAnchorPositioning, supportsPopover } from './support';
import { partElement } from './types';

const floating = defineBehavior({
  name: 'floating',
  parts: ['anchor', 'root', 'arrow'],
  props: {
    isActive: prop(true),
    positionArea: prop<PositionArea>('bottom'),
    positionTryFallbacks: prop('flip-block, flip-inline'),
  },
  setup(ctx) {
    const { props } = ctx;
    return createPosition(ctx, {
      part: 'root',
      arrowPart: 'arrow',
      isActive: props.isActive,
      anchor: () => partElement(ctx, 'anchor'),
      positionArea: props.positionArea,
      positionTryFallbacks: props.positionTryFallbacks,
    });
  },
  expose: ({ api }) => ({ side: api.side() }),
  connect: () => ({
    anchor: { attrs: {} },
    root: { attrs: {} },
    arrow: { attrs: {} },
  }),
});

type FloatingProps = Partial<{
  isActive: boolean;
  positionArea: PositionArea;
  positionTryFallbacks: string;
}>;

const FALLBACKS = Symbol.for('@uniaria/fallbacks/v1');
const SETTINGS = Symbol.for('@uniaria/settings/v1');
const running: { stop(): void }[] = [];

afterEach(() => {
  for (const instance of running.splice(0)) instance.stop();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('dir');
  Reflect.deleteProperty(window, FALLBACKS);
  Reflect.deleteProperty(globalThis, SETTINGS);
  vi.restoreAllMocks();
});

/**
 * A fixed 80×30 anchor at `anchorStyle` and a shown 160×100 popover with a
 * 10×10 arrow, the consumer's `margin`, `css` and `arrowCss`, placed by the
 * wrapper.
 */
function render(
  props: FloatingProps = {},
  {
    anchorStyle = 'left: 150px; top: 300px',
    dir = 'ltr',
    margin = '8px 12px 12px',
    height = '100px',
    css = '',
    arrowCss = '',
  } = {},
) {
  const host = document.createElement('div');
  host.dir = dir;
  host.innerHTML = `
    <button id="anchor" style="position: fixed; width: 80px; height: 30px; margin: 0; padding: 0; ${anchorStyle}">A</button>
    <div id="root" popover="manual" style="width: 160px; height: ${height}; margin: ${margin}; padding: 0; border: 0; box-sizing: border-box; ${css}">
      <div id="arrow" style="position: absolute; width: 10px; height: 10px; ${arrowCss}"></div>
    </div>`;
  document.body.append(host);
  const anchor = host.querySelector<HTMLElement>('#anchor')!;
  const root = host.querySelector<HTMLElement>('#root')!;
  const arrow = host.querySelector<HTMLElement>('#arrow')!;
  root.showPopover();
  const instance = createInstance(floating, { props });
  running.push(instance);
  instance.attach('anchor', anchor);
  instance.attach('root', root);
  instance.attach('arrow', arrow);
  instance.start();
  const set = (next: FloatingProps) => {
    instance.setProps({ ...instance.getProps(), ...next });
    instance.sync();
  };
  const side = () => instance.getState().side;
  return { anchor, root, arrow, set, side };
}

const rect = (element: Element) => element.getBoundingClientRect();

const frames = async (count: number) => {
  for (let index = 0; index < count; index++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

function expectNear(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

describe('development fallbacks', () => {
  it('turn off the Popover API, and anchor positioning with it', () => {
    const hasPopover = supportsPopover(window);
    Reflect.set(window, FALLBACKS, { anchorPositioning: false });
    expect(supportsAnchorPositioning(window)).toBe(false);
    expect(supportsPopover(window)).toBe(hasPopover);

    Reflect.set(window, FALLBACKS, { popover: false });
    expect(supportsPopover(window)).toBe(false);
    expect(supportsAnchorPositioning(window)).toBe(false);
  });
});

describe('createPosition in script mode', () => {
  const start = render;

  it('places it below the anchor, centred, its margin the gap, and reports the side', async () => {
    const { anchor, root, side } = start();
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    const a = rect(anchor);
    const p = rect(root);
    expectNear(p.top, a.bottom + 8);
    expectNear(p.left + p.width / 2, a.left + a.width / 2);
  });

  it('aligns edges with a span, its own margin moving it', async () => {
    const aligned = start(
      { positionArea: 'bottom span-right' },
      { margin: '8px 0 0' },
    );
    await vi.waitFor(() =>
      expectNear(rect(aligned.root).left, rect(aligned.anchor).left),
    );

    const moved = start(
      { positionArea: 'bottom span-right' },
      { margin: '8px 0 0 20px' },
    );
    await vi.waitFor(() =>
      expectNear(rect(moved.root).left, rect(moved.anchor).left + 20),
    );

    const beside = start(
      { positionArea: 'left span-bottom' },
      { anchorStyle: 'left: 300px; top: 300px', margin: '0 8px 0 0' },
    );
    await vi.waitFor(() => expect(beside.side()).toBe('left'));
    expectNear(rect(beside.root).right, rect(beside.anchor).left - 8);
    expectNear(rect(beside.root).top, rect(beside.anchor).top);
  });

  it('follows the page’s direction for logical keywords and its own for self- ones', async () => {
    document.documentElement.dir = 'rtl';
    const page = start(
      { positionArea: 'block-end span-inline-end' },
      { dir: 'rtl', margin: '8px 0 0' },
    );
    await vi.waitFor(() =>
      expectNear(rect(page.root).right, rect(page.anchor).right),
    );
    expect(page.side()).toBe('bottom');
    document.documentElement.removeAttribute('dir');

    const own = start(
      { positionArea: 'self-block-end span-self-inline-end' },
      { dir: 'rtl', margin: '8px 0 0' },
    );
    await vi.waitFor(() =>
      expectNear(rect(own.root).right, rect(own.anchor).right),
    );
  });

  it('keeps its margins off the viewport’s edges', async () => {
    const { root, side } = start({}, { anchorStyle: 'left: 0; top: 300px' });
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    await vi.waitFor(() => expectNear(rect(root).left, 12));
  });

  it('flips to the side with room, swapping its margins, and stays there; none keeps the side', async () => {
    const low = 'left: 150px; bottom: 10px';
    const flipped = start({}, { anchorStyle: low });
    await vi.waitFor(() => expect(flipped.side()).toBe('top'));
    expectNear(rect(flipped.root).bottom, rect(flipped.anchor).top - 8);
    // The browser remembers a fallback once it has rendered it.
    await frames(2);

    // Room below again doesn't flip it back while the top still fits.
    flipped.anchor.style.bottom = '';
    flipped.anchor.style.top = '300px';
    await frames(3);
    expect(flipped.side()).toBe('top');
    expectNear(rect(flipped.root).bottom, rect(flipped.anchor).top - 8);

    const kept = start({ positionTryFallbacks: 'none' }, { anchorStyle: low });
    await vi.waitFor(() => expect(kept.side()).toBe('bottom'));
  });

  it('tries flip-start and position-area fallbacks in order', async () => {
    const low = 'left: 150px; bottom: 10px';
    const started = start(
      { positionTryFallbacks: 'flip-start, top' },
      { anchorStyle: low, margin: '8px 0 0' },
    );
    await vi.waitFor(() => expect(started.side()).toBe('right'));
    expectNear(rect(started.root).left, rect(started.anchor).right + 8);

    const listed = start(
      { positionTryFallbacks: 'left, top' },
      { anchorStyle: 'left: 20px; bottom: 10px', margin: '8px' },
    );
    await vi.waitFor(() => expect(listed.side()).toBe('top'));
    expectNear(rect(listed.root).bottom, rect(listed.anchor).top - 8);
  });

  it('moves the alignment when the span has no room along the edge', async () => {
    const { anchor, root, side } = start(
      {
        positionArea: 'bottom span-right',
        positionTryFallbacks: 'flip-inline',
      },
      {
        anchorStyle: 'left: auto; right: 0; top: 300px',
        margin: '8px 0 0',
      },
    );
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    await vi.waitFor(() => expectNear(rect(root).right, rect(anchor).right));
  });

  it('shifts it into the viewport when no option fits', async () => {
    const { root, side } = start(
      { positionTryFallbacks: 'flip-block' },
      { anchorStyle: 'left: 150px; top: 300px', height: '2000px' },
    );
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    await vi.waitFor(() => expectNear(rect(root).top, 8));
  });

  it('writes the anchor width and the most room it could take', async () => {
    const { anchor, root, set } = start();
    const variable = (name: string) => root.style.getPropertyValue(name);
    await vi.waitFor(() => expect(variable('--anchor-width')).toBe('80px'));
    const a = rect(anchor);
    const { clientWidth, clientHeight } = document.documentElement;
    const below = clientHeight - a.bottom - 8 - 12;
    const above = a.top - 8 - 12;
    expect(variable('--available-height')).toBe(`${Math.max(below, above)}px`);
    expect(variable('--available-width')).toBe(`${clientWidth - 24}px`);

    set({ positionArea: 'top', positionTryFallbacks: 'none' });
    // Above, the gap is the bottom margin, 12px.
    await vi.waitFor(() =>
      expect(variable('--available-height')).toBe(`${a.top - 12 - 8}px`),
    );
  });

  it('points the arrow at the anchor’s centre', async () => {
    const below = start({ positionArea: 'bottom span-right' });
    await vi.waitFor(() => {
      const a = rect(below.anchor);
      const arrow = rect(below.arrow);
      expectNear(arrow.left + arrow.width / 2, a.left + a.width / 2);
    });
    expect(below.arrow.style.top).toBe('');

    const beside = start({ positionArea: 'right span-bottom' });
    await vi.waitFor(() => {
      const a = rect(beside.anchor);
      const arrow = rect(beside.arrow);
      expectNear(arrow.top + arrow.height / 2, a.top + a.height / 2);
    });
    expect(beside.arrow.style.left).toBe('');
  });

  it('points the arrow at the anchor’s centre while the part is scaled or the arrow turned', async () => {
    // A scale animating the part in, and a square turned into a diamond:
    // `left` and `top` work in sizes before transforms.
    const scaled = start({}, { css: 'transform: scale(0.5)' });
    const turned = start(
      { positionArea: 'right span-bottom' },
      { arrowCss: 'transform: rotate(45deg)' },
    );
    await vi.waitFor(() => {
      const a = rect(scaled.anchor);
      const arrow = rect(scaled.arrow);
      expectNear(arrow.left + arrow.width / 2, a.left + a.width / 2);
    });
    await vi.waitFor(() => {
      const a = rect(turned.anchor);
      const arrow = rect(turned.arrow);
      expectNear(arrow.top + arrow.height / 2, a.top + a.height / 2);
    });
  });

  it('places the arrow once a part scaled to nothing grows', async () => {
    const { anchor, root, arrow, side } = start(
      {},
      { css: 'transform: scale(0)' },
    );
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    await frames(2);
    root.style.removeProperty('transform');
    await vi.waitFor(() => {
      const a = rect(anchor);
      const placed = rect(arrow);
      expectNear(placed.left + placed.width / 2, a.left + a.width / 2);
    });
  });

  it('follows its props', async () => {
    const { anchor, root, set, side } = start({}, { margin: '20px' });
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    set({ positionArea: 'top' });
    await vi.waitFor(() => expect(side()).toBe('top'));
    await vi.waitFor(() =>
      expectNear(rect(root).bottom, rect(anchor).top - 20),
    );
  });

  it('puts back the styles it wrote when it stops', async () => {
    const { root, arrow, set, side } = start();
    root.style.setProperty('opacity', '0.5');
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    set({ isActive: false });
    expect(side()).toBe(undefined);
    for (const property of [
      'inset',
      'position',
      'left',
      'top',
      '--anchor-width',
      '--available-height',
    ]) {
      expect(root.style.getPropertyValue(property)).toBe('');
    }
    expect(root.style.getPropertyValue('opacity')).toBe('0.5');
    expect(root.style.getPropertyValue('margin')).toBe('8px 12px 12px');
    expect(arrow.style.getPropertyValue('left')).toBe('');
  });

  it('leaves anchor positioning alone', async () => {
    const { anchor, root, side } = start();
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    expect(anchor.style.getPropertyValue('anchor-name')).toBe('');
    expect(root.style.getPropertyValue('position-anchor')).toBe('');
    expect(root.style.getPropertyValue('position-area')).toBe('');
  });
});

describe('createPosition in CSS mode', () => {
  it('warns in development when the browser has no anchor positioning', async () => {
    configure({ positioning: 'css' });
    Reflect.set(window, FALLBACKS, { anchorPositioning: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { root, side } = render();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("positioning is 'css'"),
    );
    // It still reports where the consumer's CSS put it.
    await vi.waitFor(() => expect(side()).not.toBe(undefined));
    expect(root.style.getPropertyValue('position')).toBe('');
  });
});

describe.runIf(supportsAnchorPositioning(window))(
  'createPosition in CSS mode, with anchor positioning',
  () => {
    const start = (
      props: FloatingProps = {},
      {
        area = 'bottom',
        fallbacks = 'flip-block, flip-inline',
        ...rest
      }: Parameters<typeof render>[1] & {
        area?: string;
        fallbacks?: string;
      } = {},
    ) => {
      configure({ positioning: 'css' });
      return render(props, {
        ...rest,
        css: `inset: auto; position-area: ${area}; position-try-fallbacks: ${fallbacks}; ${rest.css ?? ''}`,
      });
    };

    it('only links the part to its anchor, beside the anchor’s own names, and puts them back', async () => {
      const { anchor, root, side, set } = start(
        { positionArea: 'top' },
        { anchorStyle: 'left: 150px; top: 300px; anchor-name: --mine' },
      );
      const names = anchor.style.getPropertyValue('anchor-name');
      expect(names).toMatch(/^--mine, --uni-anchor-\d+$/);
      expect(root.style.getPropertyValue('position-anchor')).toBe(
        names.split(', ')[1],
      );
      // The props are script mode's; the consumer's CSS places it.
      await vi.waitFor(() => expect(side()).toBe('bottom'));
      for (const property of ['position', 'top', 'left', 'position-area']) {
        expect(root.style.getPropertyValue(property)).not.toMatch(
          /fixed|px|top/,
        );
      }
      expectNear(rect(root).top, rect(anchor).bottom + 8);

      set({ isActive: false });
      expect(side()).toBe(undefined);
      expect(anchor.style.getPropertyValue('anchor-name')).toBe('--mine');
      expect(root.style.getPropertyValue('position-anchor')).toBe('');
      expect(root.style.getPropertyValue('--anchor-width')).toBe('');
    });

    it('reports the side the browser applied, after fallbacks', async () => {
      const flipped = start({}, { anchorStyle: 'left: 150px; bottom: 10px' });
      await vi.waitFor(() => expect(flipped.side()).toBe('top'));
      expectNear(rect(flipped.root).bottom, rect(flipped.anchor).top - 8);

      const beside = start(
        {},
        {
          area: 'left span-bottom',
          anchorStyle: 'left: 300px; top: 300px',
          margin: '0 8px 0 0',
        },
      );
      await vi.waitFor(() => expect(beside.side()).toBe('left'));
    });

    it('reports where the part is when the CSS places it otherwise', async () => {
      const { side } = start(
        {},
        {
          area: 'none',
          css: 'top: anchor(bottom); left: anchor(right)',
          margin: '0 0 0 8px',
        },
      );
      await vi.waitFor(() => expect(side()).toBe('right'));
    });

    it('follows the consumer’s CSS as it changes', async () => {
      const { root, side } = start();
      await vi.waitFor(() => expect(side()).toBe('bottom'));
      root.style.setProperty('position-area', 'top');
      await vi.waitFor(() => expect(side()).toBe('top'));
    });

    it('writes the anchor width and the most room it could take', async () => {
      const { anchor, root } = start(
        {},
        { anchorStyle: 'left: 150px; top: 300px' },
      );
      const variable = (name: string) => root.style.getPropertyValue(name);
      await vi.waitFor(() => expect(variable('--anchor-width')).toBe('80px'));
      const a = rect(anchor);
      const { clientWidth, clientHeight } = document.documentElement;
      const below = clientHeight - a.bottom - 8 - 12;
      const above = a.top - 8 - 12;
      expect(variable('--available-height')).toBe(
        `${Math.max(below, above)}px`,
      );
      expect(variable('--available-width')).toBe(`${clientWidth - 24}px`);

      root.style.setProperty('position-area', 'top');
      root.style.setProperty('position-try-fallbacks', 'none');
      await vi.waitFor(() =>
        expect(variable('--available-height')).toBe(`${a.top - 12 - 8}px`),
      );
    });

    it('points the arrow at the anchor’s centre', async () => {
      const below = start({}, { area: 'bottom span-right' });
      await vi.waitFor(() => {
        const a = rect(below.anchor);
        const arrow = rect(below.arrow);
        expectNear(arrow.left + arrow.width / 2, a.left + a.width / 2);
      });

      const beside = start({}, { area: 'right span-bottom' });
      await vi.waitFor(() => {
        const a = rect(beside.anchor);
        const arrow = rect(beside.arrow);
        expectNear(arrow.top + arrow.height / 2, a.top + a.height / 2);
      });
    });

    it('points the arrow at the anchor’s centre while the part is zoomed or scaled', async () => {
      const zoomed = start({}, { area: 'bottom span-right', css: 'zoom: 2' });
      const scaled = start({}, { area: 'right', css: 'transform: scale(0.5)' });
      await vi.waitFor(() => {
        const a = rect(zoomed.anchor);
        const arrow = rect(zoomed.arrow);
        expectNear(arrow.left + arrow.width / 2, a.left + a.width / 2);
      });
      await vi.waitFor(() => {
        const a = rect(scaled.anchor);
        const arrow = rect(scaled.arrow);
        expectNear(arrow.top + arrow.height / 2, a.top + a.height / 2);
      });
    });
  },
);
