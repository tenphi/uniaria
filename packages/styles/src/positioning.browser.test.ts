/**
 * `css/positioning.css` in CSS positioning mode (spec: Cases → CSS
 * positioning mode): the browser places each overlay on its component's
 * default side, the default styles' margin away, and UniAria only links
 * it to its anchor. Custom elements only: placing doesn't depend on the
 * adapter.
 */

import '@uniaria/elements/combobox';
import '@uniaria/elements/popover';
import '@uniaria/elements/select';
import '@uniaria/elements/tooltip';

import { configure } from '@uniaria/core/dom';
import { pointer } from '@uniaria/testing/browser';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';

import { addStyle } from './testing/browser';
import {
  mountHtml,
  page,
  part,
  rootOf,
  settle,
  setUpPage,
  tabInto,
  unmount,
} from './testing/harness';

const OPTIONS = ['Apple', 'Banana', 'Cherry']
  .map((name) => `<div data-element="Option" data-key="${name}">${name}</div>`)
  .join('');

const box = (element: Element) => element.getBoundingClientRect();

/** Placed by the browser: script mode would write the insets inline. */
function expectPlacedByCss(floating: HTMLElement): void {
  expect(floating.style.top).toBe('');
  expect(floating.style.getPropertyValue('position-anchor')).not.toBe('');
}

setUpPage();

let removePositioning: (() => void) | undefined;
beforeAll(async () => {
  configure({ positioning: 'css' });
  removePositioning = addStyle(await commands.uniStylesPositioningCss());
});
afterAll(() => {
  configure({ positioning: 'script' });
  removePositioning?.();
});
afterEach(() => {
  unmount();
  page.container.style.cssText = '';
});

describe.skipIf(!CSS.supports('position-area: top'))('in CSS mode', () => {
  test('a popover opens below its trigger', async () => {
    await mountHtml(`
      <uni-popover>
        <button data-uni-part="popover-trigger">Share</button>
        <div data-uni="popover">Anyone with the link can view.</div>
      </uni-popover>`);
    const trigger = page.container.querySelector('button');
    if (!trigger) throw new Error('No trigger.');
    await pointer.click(trigger);
    await settle();
    const root = rootOf('popover');
    expectPlacedByCss(root);
    expect(root.getAttribute('data-placement')).toBe('bottom');
    expect(box(root).top - box(trigger).bottom).toBeCloseTo(8, 0);
  });

  test('a tooltip opens above its trigger', async () => {
    // Room above. WebKit tabs only to an element with a `tabindex`.
    page.container.style.cssText = 'padding-block-start: 5rem;';
    await mountHtml(`
      <uni-tooltip>
        <button data-uni-part="tooltip-trigger" tabindex="0">Save</button>
        <div data-uni="tooltip">Saves the file</div>
      </uni-tooltip>`);
    await tabInto();
    const root = rootOf('tooltip');
    const trigger = page.container.querySelector('button');
    if (!trigger) throw new Error('No trigger.');
    expectPlacedByCss(root);
    expect(root.getAttribute('data-placement')).toBe('top');
    expect(box(trigger).top - box(root).bottom).toBeCloseTo(8, 0);
  });

  test('a select’s list opens below its trigger, from its start', async () => {
    await mountHtml(`
      <uni-select placeholder="Pick a fruit">
        <div data-uni="select">
          <span data-element="Label">Fruit</span>
          <button data-element="Trigger"><span data-element="Value"></span></button>
          <div data-element="Popover"><div data-element="List">${OPTIONS}</div></div>
        </div>
      </uni-select>`);
    const root = rootOf('select');
    const trigger = part(root, 'Trigger');
    await pointer.click(trigger);
    await settle();
    const popup = part(root, 'Popover');
    expectPlacedByCss(popup);
    expect(box(popup).top - box(trigger).bottom).toBeCloseTo(8, 0);
    expect(box(popup).left).toBeCloseTo(box(trigger).left, 0);
  });

  test('a combobox’s list opens below its anchor, from its start', async () => {
    await mountHtml(`
      <uni-combobox>
        <div data-uni="combobox">
          <label data-element="Label">Fruit</label>
          <div data-element="Anchor">
            <input data-element="Input" />
            <button data-element="Button"></button>
          </div>
          <div data-element="Popover"><div data-element="List">${OPTIONS}</div></div>
        </div>
      </uni-combobox>`);
    const root = rootOf('combobox');
    await pointer.click(part(root, 'Button'));
    await settle();
    const anchor = part(root, 'Anchor');
    const popup = part(root, 'Popover');
    expectPlacedByCss(popup);
    expect(box(popup).top - box(anchor).bottom).toBeCloseTo(8, 0);
    expect(box(popup).left).toBeCloseTo(box(anchor).left, 0);
  });
});
