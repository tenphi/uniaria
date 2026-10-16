import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createInstance, defineComponent, prop } from '../runtime';
import { createPosition } from './position';
import type { Placement } from './position';
import { supportsAnchorPositioning, supportsPopover } from './support';
import { partElement } from './types';

const floating = defineComponent({
  name: 'floating',
  parts: ['anchor', 'root', 'arrow'],
  props: {
    isActive: prop(true),
    placement: prop<Placement>('bottom'),
    offset: prop(8),
    crossOffset: prop(0),
    containerPadding: prop(12),
    shouldFlip: prop(true),
  },
  setup(ctx) {
    const { props } = ctx;
    return createPosition(ctx, {
      part: 'root',
      arrowPart: 'arrow',
      isActive: props.isActive,
      anchor: () => partElement(ctx, 'anchor'),
      placement: props.placement,
      offset: props.offset,
      crossOffset: props.crossOffset,
      containerPadding: props.containerPadding,
      shouldFlip: props.shouldFlip,
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
  placement: Placement;
  offset: number;
  crossOffset: number;
  containerPadding: number;
  shouldFlip: boolean;
}>;

const FALLBACKS = Symbol.for('@tenphi/sous/fallbacks/v1');
const running: { stop(): void }[] = [];

// Loaded once up front: the first import can outlast a wait.
beforeAll(async () => {
  await import('@floating-ui/dom');
});

afterEach(() => {
  for (const instance of running.splice(0)) instance.stop();
  document.body.replaceChildren();
  Reflect.deleteProperty(window, FALLBACKS);
});

/**
 * A fixed 80×30 anchor at `anchorStyle` and a shown 160×100 popover with a
 * 10×10 arrow, placed by the wrapper.
 */
function render(
  props: FloatingProps = {},
  { anchorStyle = 'left: 150px; top: 300px', dir = 'ltr' } = {},
) {
  const host = document.createElement('div');
  host.dir = dir;
  host.innerHTML = `
    <button id="anchor" style="position: fixed; width: 80px; height: 30px; margin: 0; padding: 0; ${anchorStyle}">A</button>
    <div id="root" popover="manual" style="width: 160px; height: 100px; padding: 0; border: 0; box-sizing: border-box">
      <div id="arrow" style="position: absolute; width: 10px; height: 10px"></div>
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

describe.each([
  { path: 'CSS anchor positioning', fallbacks: undefined },
  { path: 'Floating UI', fallbacks: { anchorPositioning: false } },
])('createPosition with $path', ({ fallbacks }) => {
  const start = (...args: Parameters<typeof render>) => {
    if (fallbacks) Reflect.set(window, FALLBACKS, fallbacks);
    return render(...args);
  };

  it('places it below the anchor, centred and offset, and reports the side', async () => {
    const { anchor, root, side } = start();
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    const a = rect(anchor);
    const p = rect(root);
    expectNear(p.top, a.bottom + 8);
    expectNear(p.left + p.width / 2, a.left + a.width / 2);
  });

  it('aligns edges, with start and end following the direction', async () => {
    const ltr = start({ placement: 'bottom start' });
    await vi.waitFor(() =>
      expectNear(rect(ltr.root).left, rect(ltr.anchor).left),
    );

    const rtl = start({ placement: 'bottom start' }, { dir: 'rtl' });
    await vi.waitFor(() =>
      expectNear(rect(rtl.root).right, rect(rtl.anchor).right),
    );

    const end = start(
      { placement: 'end top' },
      { dir: 'rtl', anchorStyle: 'left: 250px; top: 300px' },
    );
    await vi.waitFor(() => expect(end.side()).toBe('left'));
    expectNear(rect(end.root).right, rect(end.anchor).left - 8);
    expectNear(rect(end.root).top, rect(end.anchor).top);
  });

  it('moves it right or down by crossOffset, centred or aligned', async () => {
    for (const [placement, axis] of [
      ['bottom', 'left'],
      ['bottom end', 'left'],
      ['right', 'top'],
    ] as const) {
      const plain = start({ placement });
      const moved = start({ placement, crossOffset: 20 });
      await vi.waitFor(() =>
        expectNear(rect(moved.root)[axis], rect(plain.root)[axis] + 20),
      );
      plain.set({ isActive: false });
      moved.set({ isActive: false });
    }
  });

  it('keeps containerPadding from the viewport edges', async () => {
    const { root, side } = start({}, { anchorStyle: 'left: 0; top: 300px' });
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    await vi.waitFor(() => expectNear(rect(root).left, 12));
  });

  it('flips to the side with room and stays there; shouldFlip false keeps the side', async () => {
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

    const kept = start({ shouldFlip: false }, { anchorStyle: low });
    await vi.waitFor(() => expect(kept.side()).toBe('bottom'));
  });

  it('writes the anchor width and the most room it could take', async () => {
    const { anchor, root, set } = start();
    const variable = (name: string) => root.style.getPropertyValue(name);
    await vi.waitFor(() => expect(variable('--trigger-width')).toBe('80px'));
    const a = rect(anchor);
    const { clientWidth, clientHeight } = document.documentElement;
    const below = clientHeight - a.bottom - 8 - 12;
    const above = a.top - 8 - 12;
    expect(variable('--available-height')).toBe(`${Math.max(below, above)}px`);
    expect(variable('--available-width')).toBe(`${clientWidth - 24}px`);

    set({ placement: 'top', shouldFlip: false });
    await vi.waitFor(() =>
      expect(variable('--available-height')).toBe(`${above}px`),
    );
  });

  it('points the arrow at the anchor’s centre', async () => {
    const below = start({ placement: 'bottom start' });
    await vi.waitFor(() => {
      const a = rect(below.anchor);
      const arrow = rect(below.arrow);
      expectNear(arrow.left + arrow.width / 2, a.left + a.width / 2);
    });
    expect(below.arrow.style.top).toBe('');

    const beside = start({ placement: 'right top' });
    await vi.waitFor(() => {
      const a = rect(beside.anchor);
      const arrow = rect(beside.arrow);
      expectNear(arrow.top + arrow.height / 2, a.top + a.height / 2);
    });
    expect(beside.arrow.style.left).toBe('');
  });

  it('follows its props', async () => {
    const { anchor, root, set, side } = start();
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    set({ placement: 'top', offset: 20 });
    await vi.waitFor(() => expect(side()).toBe('top'));
    await vi.waitFor(() =>
      expectNear(rect(root).bottom, rect(anchor).top - 20),
    );
  });

  it('puts back the styles it wrote when it stops', async () => {
    const { anchor, root, arrow, set, side } = start();
    root.style.setProperty('opacity', '0.5');
    await vi.waitFor(() => expect(side()).toBe('bottom'));
    set({ isActive: false });
    expect(side()).toBe(undefined);
    for (const property of [
      'inset',
      'margin',
      'position',
      'left',
      'top',
      'position-anchor',
      'position-area',
      '--trigger-width',
      '--available-height',
    ]) {
      expect(root.style.getPropertyValue(property)).toBe('');
    }
    expect(root.style.getPropertyValue('opacity')).toBe('0.5');
    expect(arrow.style.getPropertyValue('left')).toBe('');
    expect(anchor.style.getPropertyValue('anchor-name')).toBe('');
  });
});

describe.runIf(supportsAnchorPositioning(window))(
  'createPosition with CSS anchor positioning',
  () => {
    it('adds its name to the anchor’s own and puts back replaced styles', () => {
      const host = document.createElement('div');
      host.innerHTML = `
        <button id="anchor" style="position: fixed; left: 150px; top: 300px; anchor-name: --mine">A</button>
        <div id="root" popover="manual" style="margin: 5px">P</div>`;
      document.body.append(host);
      const anchor = host.querySelector<HTMLElement>('#anchor')!;
      const root = host.querySelector<HTMLElement>('#root')!;
      root.showPopover();
      const instance = createInstance(floating);
      running.push(instance);
      instance.attach('anchor', anchor);
      instance.attach('root', root);
      instance.start();

      const names = anchor.style.getPropertyValue('anchor-name');
      expect(names).toMatch(/^--mine, --sous-anchor-\d+$/);
      expect(root.style.getPropertyValue('position-anchor')).toBe(
        names.split(', ')[1],
      );

      instance.setProps({ ...instance.getProps(), isActive: false });
      instance.sync();
      expect(anchor.style.getPropertyValue('anchor-name')).toBe('--mine');
      expect(root.style.getPropertyValue('margin')).toBe('5px');
    });

    // Firefox misplaces it with anchor positioning.
    it('leaves a part whose direction differs from the page’s to Floating UI', async () => {
      const { root, side } = render(
        { placement: 'bottom start' },
        { dir: 'rtl' },
      );
      await vi.waitFor(() => expect(side()).toBe('bottom'));
      expect(root.style.getPropertyValue('position-area')).toBe('');
      expect(root.style.getPropertyValue('position')).toBe('fixed');
    });
  },
);
