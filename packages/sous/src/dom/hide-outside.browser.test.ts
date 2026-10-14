import { afterEach, describe, expect, it } from 'vitest';

import { hideOutside, keepVisible } from './hide-outside';

const reverts: (() => void)[] = [];

/** `hideOutside`, reverted after the test if the test does not revert it. */
function hide(...args: Parameters<typeof hideOutside>) {
  const revert = hideOutside(...args);
  reverts.push(revert);
  return revert;
}

function render(html: string) {
  document.body.innerHTML = html;
}

const byId = (id: string) => document.getElementById(id)!;

function element(
  tag: string,
  id: string,
  attributes: Record<string, string> = {},
) {
  const created = document.createElement(tag);
  created.id = id;
  for (const [name, value] of Object.entries(attributes)) {
    created.setAttribute(name, value);
  }
  return created;
}

/** Ids of the elements hidden with `attribute`, in document order. */
function marked(attribute: 'aria-hidden' | 'inert' = 'aria-hidden') {
  const selector = attribute === 'inert' ? '[inert]' : '[aria-hidden="true"]';
  return [...document.querySelectorAll(selector)].map(({ id }) => id);
}

/** Mutation observer callbacks are microtasks; a task later all have run. */
const tick = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  for (const revert of reverts.splice(0).reverse()) revert();
  document.body.replaceChildren();
});

describe('hideOutside', () => {
  it('hides the siblings of the target and of each ancestor, and reverts', () => {
    render(`
      <div id="before"></div>
      <main id="main">
        <p id="intro"></p>
        <section id="section">
          <span id="label"></span>
          <button id="target"><span id="inside"></span></button>
          <span id="after-target"></span>
        </section>
      </main>
      <div id="after"></div>
    `);

    const revert = hide([byId('target')]);
    expect(marked()).toEqual([
      'before',
      'intro',
      'label',
      'after-target',
      'after',
    ]);

    revert();
    expect(marked()).toEqual([]);
  });

  it('keeps several targets exposed', () => {
    render(`
      <input id="one" type="checkbox">
      <button id="button"></button>
      <input id="two" type="checkbox">
    `);

    const revert = hide([byId('one'), byId('two')]);
    expect(marked()).toEqual(['button']);

    revert();
    expect(marked()).toEqual([]);
  });

  it('does not descend into an element it hides', () => {
    render(`
      <div id="container"><input id="nested" type="checkbox"></div>
      <button id="target"></button>
      <input id="after" type="checkbox">
    `);

    const revert = hide([byId('target')]);
    expect(marked()).toEqual(['container', 'after']);

    revert();
    expect(marked()).toEqual([]);
  });

  it('leaves an element someone else hid as it is, with its subtree', () => {
    render(`
      <div id="hidden" aria-hidden="true"><span id="nested"></span></div>
      <button id="target"></button>
      <div id="other"></div>
    `);

    const revert = hide([byId('target')]);
    expect(marked()).toEqual(['hidden', 'other']);

    revert();
    expect(marked()).toEqual(['hidden']);
  });

  it('hides nothing outside the root', async () => {
    render(`
      <div id="outside"></div>
      <div id="root"><span id="sibling"></span><button id="target"></button></div>
    `);

    const revert = hide([byId('target')], { root: byId('root') });
    expect(marked()).toEqual(['sibling']);

    document.body.append(element('div', 'added'));
    await tick();
    expect(marked()).toEqual(['sibling']);

    revert();
    expect(marked()).toEqual([]);
  });

  it("defaults to the body of the targets' document, with state per window", async () => {
    const frame = document.createElement('iframe');
    const isLoaded = new Promise((resolve) =>
      frame.addEventListener('load', resolve, { once: true }),
    );
    frame.srcdoc =
      '<!doctype html><body><div id="sibling"></div><button id="target"></button></body>';
    document.body.append(frame);
    await isLoaded;
    const frameDocument = frame.contentDocument!;

    const revert = hide([frameDocument.getElementById('target')!]);
    expect(
      frameDocument.getElementById('sibling')!.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(frame.hasAttribute('aria-hidden')).toBe(false);
    const key = Symbol.for('@tenphi/sous/hide-outside/v1');
    expect(key in frame.contentWindow!).toBe(true);

    revert();
    expect(
      frameDocument.getElementById('sibling')!.hasAttribute('aria-hidden'),
    ).toBe(false);
  });

  it('does nothing without targets or a root', () => {
    render('<div id="content"></div>');
    const revert = hide([]);
    expect(marked()).toEqual([]);
    revert();
  });

  it('can be reverted twice without releasing what another call hides', () => {
    render('<div id="outside"></div><button id="target"></button>');

    const revertFirst = hide([byId('target')]);
    const revertSecond = hide([byId('target')]);
    revertSecond();
    revertSecond();
    expect(marked()).toEqual(['outside']);

    revertFirst();
    expect(marked()).toEqual([]);
  });
});

describe('hideOutside on added content', () => {
  it('hides elements added outside the targets after the observer runs', async () => {
    render('<button id="target"></button>');

    const revert = hide([byId('target')]);
    byId('target').before(element('input', 'before'));
    byId('target').after(element('input', 'after'));
    expect(marked()).toEqual([]);

    await tick();
    expect(marked()).toEqual(['before', 'after']);

    revert();
    expect(marked()).toEqual([]);
  });

  it('gives elements added to a hidden container no attribute of their own', async () => {
    render('<div id="container"></div><button id="target"></button>');

    const revert = hide([byId('target')]);
    byId('container').append(element('input', 'nested'));
    document.body.append(element('input', 'added'));
    await tick();
    expect(marked()).toEqual(['container', 'added']);

    revert();
    expect(marked()).toEqual([]);
  });

  it('keeps elements added inside a target exposed', async () => {
    render(`
      <input id="before" type="checkbox">
      <div id="target"><button id="button"></button></div>
      <input id="after" type="checkbox">
    `);

    const revert = hide([byId('target')]);
    byId('target').append(element('input', 'radio', { type: 'radio' }));
    await tick();
    expect(marked()).toEqual(['before', 'after']);

    revert();
  });

  /**
   * Leaves a record whose parent (the first list) is detached by the time the
   * observer runs, while the item is connected through the second list.
   */
  function addThenReparent(container: Element) {
    const first = element('ul', 'first');
    const item = element('li', 'item');
    container.append(first);
    first.append(item);
    first.remove();
    const second = element('ul', 'second');
    second.append(item);
    container.append(second);
  }

  it('keeps an element added and moved inside a target exposed', async () => {
    render('<div id="target"><button></button></div><div id="sibling"></div>');

    hide([byId('target')]);
    addThenReparent(byId('target'));
    await tick();
    expect(marked()).toEqual(['sibling']);
  });

  it('gives an element added and moved inside a hidden container no attribute', async () => {
    render('<div id="target"><button></button></div><div id="sibling"></div>');

    hide([byId('target')]);
    addThenReparent(byId('sibling'));
    await tick();
    expect(marked()).toEqual(['sibling']);
  });

  it('judges an added element by where it is when the observer runs', async () => {
    render('<div id="target"></div><div id="sibling"></div>');

    hide([byId('target')]);
    const moved = element('p', 'moved');
    document.body.append(moved);
    byId('target').append(moved);
    await tick();
    expect(marked()).toEqual(['sibling']);
  });

  it('leaves no stale attribute after hidden elements are reordered', async () => {
    render(`
      <button id="button"></button>
      <div id="item1"><div id="row1" role="row"><div role="gridcell"></div></div></div>
      <div id="item2"><div id="row2" role="row"><div role="gridcell"></div></div></div>
      <div id="item3"><div id="row3" role="row"><div role="gridcell"></div></div></div>
    `);

    const revert = hide([byId('button')]);
    expect(marked()).toEqual(['item1', 'item2', 'item3']);

    byId('item2').after(byId('item1'));
    await tick();
    byId('item3').after(byId('item1'));
    await tick();
    expect(marked()).toEqual(['item2', 'item3', 'item1']);

    revert();
    expect(marked()).toEqual([]);
  });
});

describe('nested hideOutside calls', () => {
  const fixture = `
    <input id="check1" type="checkbox">
    <input id="radio1" type="radio">
    <button id="button"></button>
    <input id="radio2" type="radio">
    <input id="check2" type="checkbox">
  `;

  it('keep an element hidden until the last call that hid it reverts', () => {
    render(fixture);

    const revertFirst = hide([byId('button'), byId('radio1'), byId('radio2')]);
    expect(marked()).toEqual(['check1', 'check2']);

    const revertSecond = hide([byId('button')]);
    expect(marked()).toEqual(['check1', 'radio1', 'radio2', 'check2']);

    revertSecond();
    expect(marked()).toEqual(['check1', 'check2']);

    revertFirst();
    expect(marked()).toEqual([]);
  });

  it('can be reverted out of order', () => {
    render(fixture);

    const revertFirst = hide([byId('button'), byId('radio1'), byId('radio2')]);
    const revertSecond = hide([byId('button')]);

    revertFirst();
    expect(marked()).toEqual(['check1', 'radio1', 'radio2', 'check2']);

    revertSecond();
    expect(marked()).toEqual([]);
  });

  it('observe with the newest call only, which hands back on revert', async () => {
    render('<div id="modal1"></div>');
    const revertFirst = hide([byId('modal1')]);

    // A nested modal mounts outside the first and hides outside itself in
    // the same task: the first call must not hide it.
    const modal2 = element('div', 'modal2');
    document.body.append(modal2);
    const revertSecond = hide([modal2]);
    await tick();
    expect(marked()).toEqual(['modal1']);

    // The first call is not observing, or it would hide this.
    modal2.append(element('p', 'content'));
    document.body.append(element('div', 'toast'));
    await tick();
    expect(marked()).toEqual(['modal1', 'toast']);

    // The first call catches up on what it missed, and observes again.
    revertSecond();
    expect(marked()).toEqual(['modal2', 'toast']);
    document.body.append(element('div', 'late'));
    await tick();
    expect(marked()).toEqual(['modal2', 'toast', 'late']);

    revertFirst();
    expect(marked()).toEqual([]);
  });
});

describe('keepVisible', () => {
  it('keeps an element exposed when the newest call sees it added', async () => {
    render('<div id="modal"></div>');
    hide([byId('modal')]);

    const popover = element('div', 'popover');
    const release = keepVisible(popover);
    document.body.append(popover);
    await tick();
    expect(marked()).toEqual([]);

    release();
    popover.remove();
    document.body.append(popover);
    await tick();
    expect(marked()).toEqual(['popover']);
  });

  it('does nothing without an active call', () => {
    render('<div id="popover"></div>');
    const release = keepVisible(byId('popover'));
    expect(release).toBeTypeOf('function');
    release();
  });
});

describe('hideOutside with shouldUseInert', () => {
  it('makes the outside inert, with aria-hidden where inert is missing', () => {
    render(`
      <div id="before"></div>
      <button id="target"></button>
      <svg id="icon"></svg>
      <div id="already" inert></div>
    `);

    const revert = hide([byId('target')], { shouldUseInert: true });
    expect(marked('inert')).toEqual(['before', 'already']);
    expect(marked()).toEqual(['icon']);

    revert();
    expect(marked('inert')).toEqual(['already']);
    expect(marked()).toEqual([]);
  });

  it('counts aria-hidden and inert separately', () => {
    render('<div id="outside"></div><button id="target"></button>');

    const revertHidden = hide([byId('target')]);
    const revertInert = hide([byId('target')], { shouldUseInert: true });
    expect(marked()).toEqual(['outside']);
    expect(marked('inert')).toEqual(['outside']);

    revertHidden();
    expect(marked()).toEqual([]);
    expect(marked('inert')).toEqual(['outside']);

    revertInert();
    expect(marked('inert')).toEqual([]);
  });

  it('leaves an inert someone else set when it removes aria-hidden', () => {
    render('<div id="outside" inert></div><button id="target"></button>');

    const revert = hide([byId('target')]);
    expect(marked()).toEqual(['outside']);

    revert();
    expect(marked()).toEqual([]);
    expect(marked('inert')).toEqual(['outside']);
  });
});

describe('hideOutside and rows', () => {
  it("hides a hidden row's cells one by one, for VoiceOver", async () => {
    render(`
      <div id="grid" role="grid">
        <div id="row1" role="row">
          <div id="cell1" role="gridcell"><span id="span">Cell 1</span></div>
        </div>
        <div id="row2" role="row">
          <div id="cell2" role="gridcell">Cell 2</div>
        </div>
      </div>
    `);

    const revert = hide([byId('row2')]);
    expect(marked()).toEqual(['row1', 'cell1']);

    byId('row1').append(element('div', 'cell3', { role: 'gridcell' }));
    byId('cell1').append(element('span', 'nested'));
    await tick();
    expect(marked()).toEqual(['row1', 'cell1', 'cell3']);

    revert();
    expect(marked()).toEqual([]);
  });
});

describe('hideOutside and the live announcer', () => {
  it('never hides the announcer', async () => {
    render(`
      <div id="announcer" data-sous-live-announcer><div id="log" role="log"></div></div>
      <main id="app"><button id="target"></button><p id="text"></p></main>
    `);

    const revert = hide([byId('target')]);
    expect(marked()).toEqual(['text']);

    // Recreated while a modal is open.
    const announcer = byId('announcer');
    announcer.remove();
    document.body.prepend(announcer);
    await tick();
    expect(marked()).toEqual(['text']);

    revert();
    expect(marked()).toEqual([]);
  });

  it('keeps an announcer inside added content exposed, and hides the rest', async () => {
    render('<button id="target"></button>');

    const revert = hide([byId('target')]);
    const wrapper = element('div', 'wrapper');
    wrapper.append(
      element('div', 'announcer', { 'data-sous-live-announcer': '' }),
      element('span', 'beside'),
    );
    document.body.append(wrapper);
    await tick();
    expect(marked()).toEqual(['beside']);

    revert();
    expect(marked()).toEqual([]);
  });
});
