import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInstance, defineBehavior, prop } from '../runtime';
import { createScrollLock, lockScroll } from './scroll-lock';

const modal = defineBehavior({
  name: 'modal',
  parts: ['root'],
  props: { isOpen: prop(false) },
  setup(ctx) {
    createScrollLock(ctx, { part: 'root', isActive: ctx.props.isOpen });
    return {};
  },
  expose: () => ({}),
  connect: () => ({ root: { attrs: {} } }),
});

const root = document.documentElement;

const releases: (() => void)[] = [];

/** `lockScroll`, released after the test if the test does not release it. */
function lock() {
  const release = lockScroll(document);
  releases.push(release);
  return release;
}

const byId = (id: string) => document.getElementById(id)!;

/** A frame, then another: when the focus wrapper checks the keyboard. */
const frames = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );

function mockPlatform(platform: string, maxTouchPoints = 5) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(maxTouchPoints);
}

afterEach(() => {
  for (const release of releases.splice(0)) release();
  vi.restoreAllMocks();
  getSelection()?.removeAllRanges();
  root.removeAttribute('style');
  document.body.replaceChildren();
});

describe('lockScroll', () => {
  it('hides overflow on <html> until released', () => {
    const release = lockScroll(document);
    expect(root.style.overflow).toBe('hidden');
    release();
    expect(root.style.overflow).toBe('');
    expect(root.getAttribute('style')).toBe('');
  });

  it('stays locked until the last lock is released, in any order', () => {
    const first = lockScroll(document);
    const second = lockScroll(document);
    first();
    expect(root.style.overflow).toBe('hidden');
    first();
    expect(root.style.overflow).toBe('hidden');
    second();
    expect(root.style.overflow).toBe('');
  });

  it('puts back the inline value and priority that were there', () => {
    root.style.setProperty('overflow', 'scroll', 'important');
    const release = lockScroll(document);
    expect(root.style.overflow).toBe('hidden');
    release();
    expect(root.style.getPropertyValue('overflow')).toBe('scroll');
    expect(root.style.getPropertyPriority('overflow')).toBe('important');
  });

  it('keeps the scrollbar gutter when a classic scrollbar goes away', () => {
    const tall = document.createElement('div');
    tall.style.height = '300vh';
    document.body.append(tall);
    const width = window.innerWidth - root.clientWidth;
    const release = lockScroll(document);
    if (width > 0) {
      expect(root.style.getPropertyValue('scrollbar-gutter')).toBe('stable');
    } else {
      // Overlay scrollbars take no room, so nothing shifts.
      expect(root.style.getPropertyValue('scrollbar-gutter')).toBe('');
    }
    expect(root.style.paddingRight).toBe('');
    release();
    expect(root.style.getPropertyValue('scrollbar-gutter')).toBe('');
  });
});

describe('createScrollLock', () => {
  it('locks while active, and releases when it stops', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const instance = createInstance(modal);
    instance.attach('root', element);
    instance.start();
    expect(root.style.overflow).toBe('');

    instance.setProps({ isOpen: true });
    instance.sync();
    expect(root.style.overflow).toBe('hidden');
    instance.setProps({ isOpen: false });
    instance.sync();
    expect(root.style.overflow).toBe('');

    instance.setProps({ isOpen: true });
    instance.sync();
    instance.stop();
    expect(root.style.overflow).toBe('');
  });
});

describe('lockScroll on iOS', () => {
  beforeEach(() => {
    mockPlatform('iPhone');
  });

  /** The overscroll rules adopted by the document. */
  const overscrollRules = () =>
    document.adoptedStyleSheets
      .flatMap((sheet) => [...sheet.cssRules])
      .map((rule) => rule.cssText)
      .filter((text) => text.includes('overscroll-behavior'));

  it('adopts an overscroll rule in an anonymous layer while locked', () => {
    const release = lock();
    expect(root.style.overflow).toBe('hidden');
    expect(root.style.getPropertyValue('scrollbar-gutter')).toBe('');
    expect(overscrollRules()).toHaveLength(1);
    expect(overscrollRules()[0]).toMatch(
      /^@layer\s*\{\s*\*\s*\{\s*overscroll-behavior: contain;\s*\}\s*\}$/,
    );

    release();
    expect(overscrollRules()).toEqual([]);
    expect(root.getAttribute('style')).toBe('');
  });

  it('adopts the rule once for nested locks', () => {
    const first = lock();
    lock();
    first();
    expect(overscrollRules()).toHaveLength(1);
  });

  describe('touches', () => {
    // Desktop WebKit and Firefox have no touch events to dispatch.
    const hasTouch = (() => {
      try {
        new Touch({ identifier: 0, target: document.body });
        return true;
      } catch {
        return false;
      }
    })();

    function touch(target: Element, type: string, fingers: number) {
      const touches = Array.from(
        { length: fingers },
        (_, identifier) => new Touch({ identifier, target }),
      );
      const event = new TouchEvent(type, {
        touches,
        targetTouches: touches,
        changedTouches: touches,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    }

    /** Starts a touch on `target` and moves it: whether the move is blocked. */
    function isBlocked(target: Element, fingers = 1) {
      touch(target, 'touchstart', fingers);
      return touch(target, 'touchmove', fingers);
    }

    function render() {
      document.body.innerHTML = `
        <p id="text">Text</p>
        <div style="overflow: auto; height: 50px">
          <div style="height: 200px"><span id="scrolling">Scrolls</span></div>
        </div>
        <div style="overflow: auto; height: 50px">
          <span id="still">Does not overflow</span>
        </div>
        <input id="range" type="range">
        <input id="field" value="Some text">
      `;
    }

    it.runIf(hasTouch)(
      'blocks a touch that would scroll the page, not one in a scroller',
      () => {
        render();
        lock();
        expect(isBlocked(byId('text'))).toBe(true);
        expect(isBlocked(byId('scrolling'))).toBe(false);
        // Its scroll would chain to the page (WebKit 243452).
        expect(isBlocked(byId('still'))).toBe(true);
      },
    );

    it.runIf(hasTouch)(
      'lets pinch-zoom, sliders and selection adjustments through',
      () => {
        render();
        lock();
        expect(isBlocked(byId('text'), 2)).toBe(false);
        expect(isBlocked(byId('range'))).toBe(false);

        getSelection()!.selectAllChildren(byId('text'));
        expect(isBlocked(byId('text'))).toBe(false);

        const field = byId('field') as HTMLInputElement;
        field.focus();
        field.setSelectionRange(0, 4);
        expect(isBlocked(field)).toBe(false);
        field.setSelectionRange(2, 2);
        expect(isBlocked(field)).toBe(true);
      },
    );

    it.runIf(hasTouch)('blocks nothing once released, or elsewhere', () => {
      render();
      lock()();
      expect(isBlocked(byId('text'))).toBe(false);

      mockPlatform('Linux armv8l');
      lock();
      expect(isBlocked(byId('text'))).toBe(false);
    });
  });

  describe('focus()', () => {
    function render() {
      document.body.innerHTML = `
        <div style="height: 300vh"></div>
        <div id="scroller" style="overflow: auto; height: 100px">
          <div style="height: 1000px"></div>
          <button id="far">Far</button>
          <input id="field">
        </div>
      `;
      return {
        scroller: byId('scroller'),
        far: byId('far'),
        field: byId('field'),
        scrollTo: vi.spyOn(Element.prototype, 'scrollTo'),
      };
    }

    it('never scrolls the page; scrolls within scroll parents instead', async () => {
      const { scroller, far, scrollTo } = render();
      lock();
      far.focus();
      expect(document.activeElement).toBe(far);
      expect(root.scrollTop).toBe(0);
      expect(scroller.scrollTop).toBe(0);

      await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
      expect(scrollTo.mock.contexts[0]).toBe(scroller);
      expect(root.scrollTop).toBe(0);
    });

    it('only focuses with preventScroll', async () => {
      const { far, scrollTo } = render();
      lock();
      far.focus({ preventScroll: true });
      await frames();
      await frames();
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('waits for the keyboard before scrolling a text field', async () => {
      const { scroller, field, scrollTo } = render();
      lock();
      field.focus();
      await frames();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(scrollTo).not.toHaveBeenCalled();
      // WebKit reveals a focused field's caret itself, preventScroll or not.
      scroller.scrollTop = 0;

      // No keyboard comes up on a desktop, so it gives up waiting.
      await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1), {
        timeout: 1500,
      });
      expect(scrollTo.mock.contexts[0]).toBe(scroller);
    });

    it('passes straight through once released', async () => {
      const { scroller, far, scrollTo } = render();
      lock()();
      far.focus();
      // WebKit scrolls a frame later.
      await frames();
      expect(scroller.scrollTop).toBeGreaterThan(0);
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('blur', () => {
    function render() {
      document.body.innerHTML = `
        <div id="dialog" tabindex="-1">
          <input id="first"><input id="second"><button id="button">B</button>
        </div>
      `;
    }

    it('moves focus that goes nowhere to the nearest ancestor with tabindex', () => {
      render();
      lock();
      byId('first').focus();
      byId('first').blur();
      expect(document.activeElement).toBe(byId('dialog'));
    });

    it('focuses a text field again through focus()', () => {
      render();
      lock();
      const second = vi.spyOn(byId('second'), 'focus');
      const button = vi.spyOn(byId('button'), 'focus');
      byId('first').focus();

      const blur = (relatedTarget: Element) =>
        byId('first').dispatchEvent(new FocusEvent('blur', { relatedTarget }));
      blur(byId('button'));
      expect(button).not.toHaveBeenCalled();
      blur(byId('second'));
      // Again for the real blur that the focus change fires.
      expect(second).toHaveBeenCalled();
      expect(document.activeElement).toBe(byId('second'));
    });

    it('does neither elsewhere', () => {
      mockPlatform('MacIntel', 0);
      render();
      lock();
      byId('first').focus();
      byId('first').blur();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
