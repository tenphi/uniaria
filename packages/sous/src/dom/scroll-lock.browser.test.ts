import { afterEach, describe, expect, it } from 'vitest';

import { createInstance, defineComponent, prop } from '../runtime';
import { createScrollLock, lockScroll } from './scroll-lock';

const modal = defineComponent({
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

afterEach(() => {
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
