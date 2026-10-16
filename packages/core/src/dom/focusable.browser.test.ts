import { afterEach, describe, expect, it } from 'vitest';

import {
  firstFocusable,
  focusableWalker,
  isFocusable,
  isTabbable,
  lastFocusable,
} from './focusable';

function render(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

/** Ids of every element the walker visits, in order. */
function walk(root: Element, isTabbableOnly = true): string[] {
  const walker = focusableWalker(root, { isTabbable: isTabbableOnly });
  const ids: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    ids.push((node as Element).id);
  }
  return ids;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('focusable and tabbable', () => {
  it('skips what Tab never reaches', () => {
    const root = render(`
      <button id="a">A</button>
      <button id="minus" tabindex="-1">-1</button>
      <button id="disabled" disabled>Disabled</button>
      <button id="hidden" hidden>Hidden</button>
      <button id="none" style="display: none">None</button>
      <button id="invisible" style="visibility: hidden">Invisible</button>
      <button id="collapsed" style="visibility: collapse">Collapsed</button>
      <div style="display: none"><button id="in-none">In none</button></div>
      <div inert><button id="inert">Inert</button></div>
      <div id="editable" contenteditable>Editable</div>
      <div id="plain" contenteditable="plaintext-only">Plain</div>
      <div id="not-editable" contenteditable="false">Not editable</div>
      <input id="hidden-input" type="hidden" />
      <a id="link" href="#">Link</a>
      <a id="anchor">No href</a>
      <div id="zero" tabindex="0">Zero</div>
    `);
    expect(walk(root)).toEqual(['a', 'editable', 'plain', 'link', 'zero']);
    expect(walk(root, false)).toEqual([
      'a',
      'minus',
      'editable',
      'plain',
      'link',
      'zero',
    ]);
    expect(isFocusable(root.querySelector('#minus')!)).toBe(true);
    expect(isTabbable(root.querySelector('#minus')!)).toBe(false);
  });

  it('reaches only the summary of a closed details', () => {
    const root = render(`
      <details id="closed"><summary id="summary">More</summary><button id="inside">In</button></details>
      <details open><summary id="open-summary">Open</summary><button id="shown">In</button></details>
    `);
    expect(walk(root)).toEqual(['summary', 'open-summary', 'shown']);
  });

  it('stops once per radio group: the checked radio, or the first', () => {
    // React Aria's FocusScope.test.js, "skips radio buttons that are in the
    // same group and are not the selectable one forwards".
    const root = render(`
      <button id="button1">1</button>
      <form>
        <input type="radio" id="huey" name="drone" checked />
        <input type="radio" id="dewey" name="drone" />
        <button id="button2">2</button>
        <input type="radio" id="louie" name="drone" />
        <input type="radio" id="larry" name="ship" />
        <input type="radio" id="moe" name="ship" />
        <button id="button3">3</button>
        <input type="radio" id="curly" name="ship" />
      </form>
      <button id="button4">4</button>
    `);
    expect(walk(root)).toEqual([
      'button1',
      'huey',
      'button2',
      'larry',
      'button3',
      'curly',
      'button4',
    ]);
  });

  it('resolves radio groups outside a form, and a form with one radio', () => {
    const root = render(`
      <input type="radio" id="a1" name="loose" />
      <input type="radio" id="a2" name="loose" checked />
      <form><input type="radio" id="only" name="single" /></form>
    `);
    expect(walk(root)).toEqual(['a2', 'only']);
  });

  it('walks from an element, skipping its contents', () => {
    const root = render(`
      <div id="group" tabindex="-1"><button id="in">In</button></div>
      <button id="after">After</button>
    `);
    const group = root.querySelector('#group')!;
    const walker = focusableWalker(root, { from: group });
    expect((walker.nextNode() as Element).id).toBe('after');
  });

  it('finds the first and last, with an accept filter', () => {
    const root = render(`
      <button id="a">A</button>
      <div><button id="b">B</button><button id="c">C</button></div>
    `);
    expect(firstFocusable(root)?.id).toBe('a');
    expect(lastFocusable(root)?.id).toBe('c');
    expect(
      lastFocusable(root, { accept: (element) => element.id !== 'c' })?.id,
    ).toBe('b');
    expect(firstFocusable(render('<p>Nothing</p>'))).toBeNull();
  });
});
