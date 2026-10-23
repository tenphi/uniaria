/**
 * Dialog, Popover and Tooltip with the default styles, mounted through
 * both adapters with the same markup (spec: Testing → Components).
 */

import '@uniaria/elements/dialog';
import '@uniaria/elements/popover';
import '@uniaria/elements/tooltip';

import { dialog } from '@uniaria/core/dialog';
import { popover } from '@uniaria/core/popover';
import { tooltip } from '@uniaria/core/tooltip';
import { useBehavior } from '@uniaria/react';
import {
  emulateMedia,
  keyboard,
  pointer,
  releaseInput,
} from '@uniaria/testing/browser';
import { afterEach, describe, expect, test } from 'vitest';

import { rgba } from './testing/browser';
import {
  isChromium,
  mountHtml,
  mountReact,
  page,
  part,
  recordExit,
  rootOf,
  settle,
  setUpPage,
  startOpening,
  style,
  tabInto,
  token,
  unmount,
} from './testing/harness';

interface PopoverProps {
  readonly hasArrow?: boolean;
}

interface Adapter {
  /** Each resolves to the component's root. */
  dialog(): Promise<HTMLElement>;
  popover(props?: PopoverProps): Promise<HTMLElement>;
  tooltip(): Promise<HTMLElement>;
  unmount(): void;
}

const DIALOG = `
  <uni-dialog>
    <button data-uni-part="dialog-trigger">Delete file…</button>
    <dialog data-uni="dialog">
      <h2 data-element="Title">Delete “report.pdf”?</h2>
      <p data-element="Description">It stays in the trash for 30 days.</p>
      <button data-element="Close">Cancel</button>
    </dialog>
  </uni-dialog>`;

const POPOVER = (props: PopoverProps) => `
  <uni-popover>
    <button data-uni-part="popover-trigger">Share</button>
    <div data-uni="popover">
      ${props.hasArrow === false ? '' : '<div data-element="Arrow"></div>'}
      <p data-element="Description">Anyone with the link can view.</p>
      <button data-element="Close">Done</button>
    </div>
  </uni-popover>`;

const TOOLTIP = `
  <uni-tooltip>
    <button data-uni-part="tooltip-trigger" tabindex="0">Save</button>
    <div data-uni="tooltip">
      Saves the file
      <div data-element="Arrow"></div>
    </div>
  </uni-tooltip>`;

const elements: Adapter = {
  async dialog() {
    await mountHtml(DIALOG);
    return rootOf('dialog');
  },
  async popover(props = {}) {
    await mountHtml(POPOVER(props));
    return rootOf('popover');
  },
  async tooltip() {
    await mountHtml(TOOLTIP);
    return rootOf('tooltip');
  },
  unmount,
};

function ReactDialog() {
  const confirm = useBehavior(dialog, {});
  return (
    <>
      <button {...confirm.parts.trigger}>Delete file…</button>
      <dialog {...confirm.parts.root}>
        <h2 {...confirm.parts.title}>Delete “report.pdf”?</h2>
        <p {...confirm.parts.description}>It stays in the trash for 30 days.</p>
        <button {...confirm.parts.close}>Cancel</button>
      </dialog>
    </>
  );
}

function ReactPopover(props: PopoverProps) {
  const share = useBehavior(popover, {});
  return (
    <>
      <button {...share.parts.trigger}>Share</button>
      <div {...share.parts.root}>
        {props.hasArrow === false ? null : <div {...share.parts.arrow} />}
        <p {...share.parts.description}>Anyone with the link can view.</p>
        <button {...share.parts.close}>Done</button>
      </div>
    </>
  );
}

function ReactTooltip() {
  const hint = useBehavior(tooltip, {});
  return (
    <>
      <button {...hint.parts.trigger} tabIndex={0}>
        Save
      </button>
      <div {...hint.parts.root}>
        Saves the file
        <div {...hint.parts.arrow} />
      </div>
    </>
  );
}

const react: Adapter = {
  async dialog() {
    await mountReact(<ReactDialog />);
    return rootOf('dialog');
  },
  async popover(props = {}) {
    await mountReact(<ReactPopover {...props} />);
    return rootOf('popover');
  },
  async tooltip() {
    await mountReact(<ReactTooltip />);
    return rootOf('tooltip');
  },
  unmount,
};

const box = (element: Element) => element.getBoundingClientRect();

/** A part outside its component's root. */
function outside(name: string): HTMLElement {
  const element = page.container.querySelector<HTMLElement>(
    `[data-uni-part="${name}"]`,
  );
  if (!element) throw new Error(`No ${name}.`);
  return element;
}

/** Opens an overlay from its trigger and lets it settle. */
async function open(trigger: HTMLElement): Promise<void> {
  await pointer.click(trigger);
  await settle();
}

/** The properties the transitions running on an element animate. */
const transitioning = (element: Element) =>
  element
    .getAnimations()
    .map((animation) => (animation as CSSTransition).transitionProperty);

/** Draws a Button: the 32-pixel box with a border, on the surface. */
function expectButton(element: Element) {
  expect(box(element).height).toBeCloseTo(32, 0);
  expect(style(element).borderTopWidth).toBe('1px');
  expect(rgba(style(element).borderTopColor)).toEqual(rgba(token('border')));
  expect(rgba(style(element).backgroundColor)).toEqual(rgba(token('surface')));
}

setUpPage();

describe.each([
  ['elements', elements],
  ['react', react],
] as const)('%s', (_name, adapter) => {
  afterEach(async () => {
    await releaseInput();
    await pointer.move(page.sentinel);
    adapter.unmount();
    page.container.removeAttribute('style');
    await emulateMedia({ reducedMotion: null });
  });

  describe('Dialog', () => {
    test('the trigger and the close part are Buttons', async () => {
      const root = await adapter.dialog();
      expectButton(outside('dialog-trigger'));
      await open(outside('dialog-trigger'));
      const close = part(root, 'Close');
      expectButton(close);
      await pointer.move(close);
      await settle();
      expect(rgba(style(close).backgroundColor)).toEqual(
        rgba(token('surface-hover')),
      );
    });

    test('open, it is a panel centered over the backdrop', async () => {
      const root = await adapter.dialog();
      expect(style(root).display).toBe('none');
      await open(outside('dialog-trigger'));
      const panel = box(root);
      expect(style(root).display).toBe('flex');
      // 22.5rem, or the viewport less 32 pixels a side.
      expect(panel.width).toBeCloseTo(Math.min(360, window.innerWidth - 64), 0);
      expect(panel.left).toBeCloseTo((window.innerWidth - panel.width) / 2, 0);
      expect(panel.top).toBeCloseTo((window.innerHeight - panel.height) / 2, 0);
      expect(rgba(style(root).backgroundColor)).toEqual(rgba(token('surface')));
      expect(style(root).borderTopLeftRadius).toBe('10px');
      expect(rgba(style(root, '::backdrop').backgroundColor)).toEqual(
        rgba(token('backdrop')),
      );
      expect(style(part(root, 'Title')).fontSize).toBe('18px');
      expect(
        box(part(root, 'Description')).top - box(part(root, 'Title')).bottom,
      ).toBeCloseTo(12, 0);
    });

    test('opening, it fades in from its hidden look', async () => {
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.dialog();
      expect(await startOpening(outside('dialog-trigger'), root)).toBe(0);
      expect(transitioning(root)).toEqual(
        expect.arrayContaining(['opacity', 'translate']),
      );
      expect(Number(style(root).opacity)).toBeLessThan(0.5);
      expect(Number(style(root, '::backdrop').opacity)).toBeLessThan(0.5);
    });

    test('closing, it fades out before it closes', async () => {
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = (await adapter.dialog()) as HTMLDialogElement;
      await open(outside('dialog-trigger'));
      const exit = recordExit(root);
      await keyboard.press('Escape');
      await settle();
      await settle();
      expect([...exit]).toContain('opacity');
      expect(root.open).toBe(false);
    });

    test('closed with the pointer, it returns focus to its trigger without a ring', async () => {
      const root = await adapter.dialog();
      const trigger = outside('dialog-trigger');
      await open(trigger);
      await pointer.click(part(root, 'Close'));
      await settle();
      await settle();
      expect(document.activeElement).toBe(trigger);
      expect(style(trigger).outlineWidth).toBe('0px');
    });

    test('with reduced motion, nothing transitions', async () => {
      await emulateMedia({ reducedMotion: 'reduce' });
      const root = await adapter.dialog();
      await open(outside('dialog-trigger'));
      for (const pseudo of [undefined, '::backdrop']) {
        expect(
          style(root, pseudo)
            .transitionDuration.split(', ')
            .every((duration) => duration === '0s'),
        ).toBe(true);
      }
    });
  });

  describe('Popover', () => {
    test('it opens a gap below its trigger, the arrow centered on it', async () => {
      const root = await adapter.popover();
      expectButton(outside('popover-trigger'));
      await open(outside('popover-trigger'));
      const trigger = box(outside('popover-trigger'));
      const arrow = part(root, 'Arrow');
      expect(root.getAttribute('data-placement')).toBe('bottom');
      expect(box(root).top - trigger.bottom).toBeCloseTo(8, 0);
      expect(rgba(style(root).backgroundColor)).toEqual(rgba(token('surface')));
      expect(style(root).overflowY).toBe('visible');
      // The part keeps its square box, which UniAria centers on the trigger.
      expect([box(arrow).width, box(arrow).height]).toEqual([8, 8]);
      expect(box(arrow).left + 4).toBeCloseTo(
        trigger.left + trigger.width / 2,
        0,
      );
      expect(style(arrow, '::before').content).not.toBe('none');
      expectButton(part(root, 'Close'));
    });

    test('without an arrow, it scrolls inside', async () => {
      const root = await adapter.popover({ hasArrow: false });
      await open(outside('popover-trigger'));
      expect(style(root).overflowY).toBe('auto');
    });

    test('opening, it fades and grows from its hidden look', async () => {
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.popover();
      expect(await startOpening(outside('popover-trigger'), root)).toBe(0);
      expect(transitioning(root)).toEqual(
        expect.arrayContaining(['opacity', 'scale']),
      );
      expect(Number(style(root).opacity)).toBeLessThan(0.5);
    });

    test('closing, it fades and shrinks before it hides', async () => {
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.popover();
      await open(outside('popover-trigger'));
      const exit = recordExit(root);
      await keyboard.press('Escape');
      await settle();
      await settle();
      expect([...exit]).toEqual(expect.arrayContaining(['opacity', 'scale']));
      expect(style(root).display).toBe('none');
    });
  });

  describe('Tooltip', () => {
    test('keyboard focus opens it above its trigger, in the fill', async () => {
      // Room above, where a tooltip opens. WebKit tabs only to an element
      // with a `tabindex`, so the triggers take one.
      page.container.style.cssText = 'padding-block-start: 5rem;';
      const root = await adapter.tooltip();
      await tabInto();
      expect(document.activeElement).toBe(outside('tooltip-trigger'));
      expect(root.getAttribute('data-placement')).toBe('top');
      const trigger = box(outside('tooltip-trigger'));
      expect(trigger.top - box(root).bottom).toBeCloseTo(8, 0);
      expect(rgba(style(root).backgroundColor)).toEqual(rgba(token('fill')));
      expect(rgba(style(root).color)).toEqual(rgba(token('fill-text')));
      expect(style(root).fontSize).toBe('12px');
      expect(
        rgba(style(part(root, 'Arrow'), '::before').backgroundColor),
      ).toEqual(rgba(token('fill')));
    });
  });

  describe('media', () => {
    afterEach(() => emulateMedia({ forcedColors: null }));

    test.runIf(isChromium)(
      'in forced colors, the tooltip and the dialog keep an edge',
      async () => {
        await emulateMedia({ forcedColors: 'active' });
        const page = style(document.body).backgroundColor;
        const tip = await adapter.tooltip();
        await tabInto();
        expect(style(tip).borderTopWidth).toBe('1px');
        expect(style(tip).borderTopColor).not.toBe(page);
        const panel = await adapter.dialog();
        await open(outside('dialog-trigger'));
        expect(style(panel).borderTopColor).not.toBe(page);
      },
    );
  });
});
