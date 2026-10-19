import { afterEach, describe, expect, it } from 'vitest';

import type { Instance, LinkKey } from '../runtime';
import { createInstance, defineComponent } from '../runtime';
import { provideOwner, requestOwner } from './owner';
import { UNI_HOST } from './parts';

const group = defineComponent({
  name: 'group',
  parts: ['root'],
  props: {},
  setup: () => ({}),
  expose: () => ({}),
  connect: () => ({ root: { attrs: {} } }),
});
const other = defineComponent({
  name: 'other',
  parts: ['root'],
  props: {},
  setup: () => ({}),
  expose: () => ({}),
  connect: () => ({ root: { attrs: {} } }),
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
});

function tree(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

function track(element: Element, ownerId?: string) {
  const seen: (Instance | undefined)[] = [];
  cleanups.push(
    requestOwner(element, group, (owner) => seen.push(owner), ownerId),
  );
  return seen;
}

describe('owner lookup', () => {
  it('finds the nearest providing ancestor of the definition', () => {
    const container = tree(
      '<div id="outer"><div id="decoy"><div id="inner"><span id="child"></span></div></div></div>',
    );
    const outer = createInstance(group);
    const inner = createInstance(group);
    cleanups.push(provideOwner(outer, container.querySelector('#outer')!));
    cleanups.push(
      provideOwner(createInstance(other), container.querySelector('#decoy')!),
    );
    cleanups.push(provideOwner(inner, container.querySelector('#inner')!));
    expect(track(container.querySelector('#child')!)).toEqual([inner]);
  });

  it('waits for an owner that provides later', () => {
    const container = tree('<div id="owner"><span id="child"></span></div>');
    const seen = track(container.querySelector('#child')!);
    expect(seen).toEqual([]);
    const owner = createInstance(group);
    cleanups.push(provideOwner(owner, container.querySelector('#owner')!));
    expect(seen).toEqual([owner]);
  });

  it('releases children when the owner leaves, and they ask again', () => {
    const container = tree(
      '<div id="outer"><div id="inner"><span id="child"></span></div></div>',
    );
    const outer = createInstance(group);
    const inner = createInstance(group);
    cleanups.push(provideOwner(outer, container.querySelector('#outer')!));
    const stop = provideOwner(inner, container.querySelector('#inner')!);
    const seen = track(container.querySelector('#child')!);
    stop();
    expect(seen).toEqual([inner, undefined, outer]);
  });

  it('finds an owner by id, and waits for one not there yet', () => {
    const container = tree(
      '<span id="child"></span><div id="plan"></div><div id="later"></div>',
    );
    const plan = createInstance(group);
    cleanups.push(provideOwner(plan, container.querySelector('#plan')!));
    expect(track(container.querySelector('#child')!, 'plan')).toEqual([plan]);

    const seen = track(container.querySelector('#child')!, 'later');
    expect(seen).toEqual([]);
    const later = createInstance(group);
    cleanups.push(provideOwner(later, container.querySelector('#later')!));
    expect(seen).toEqual([later]);
  });

  it('finds an owner around the shadow root it sits in, now or later, and by id only in its own root', () => {
    const container = tree(
      '<div id="owner"><div id="wrapper"></div></div><div id="plan"></div>',
    );
    const shadow = container
      .querySelector('#wrapper')!
      .attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span id="child"></span>';
    const child = shadow.querySelector('#child')!;

    const seen = track(child);
    expect(seen).toEqual([]);
    const owner = createInstance(group);
    cleanups.push(provideOwner(owner, container.querySelector('#owner')!));
    expect(seen).toEqual([owner]);
    expect(track(child)).toEqual([owner]);

    cleanups.push(
      provideOwner(createInstance(group), container.querySelector('#plan')!),
    );
    expect(track(child, 'plan')).toEqual([]);
  });

  it('stops asking after its cleanup', () => {
    const container = tree('<div id="owner"><span id="child"></span></div>');
    const seen: (Instance | undefined)[] = [];
    requestOwner(container.querySelector('#child')!, group, (owner) =>
      seen.push(owner),
    )();
    cleanups.push(
      provideOwner(createInstance(group), container.querySelector('#owner')!),
    );
    expect(seen).toEqual([]);
  });
});

describe('link lookup', () => {
  const hintLink: LinkKey<'hint'> = { name: 'hint' };
  const hint = defineComponent({
    name: 'hint',
    parts: ['root'],
    props: {},
    provides: [hintLink],
    setup: () => ({}),
    expose: () => ({}),
    connect: () => ({ root: { attrs: {} } }),
  });

  class Host extends HTMLElement {
    static readonly [UNI_HOST] = true;
  }
  if (!customElements.get('test-link-host')) {
    customElements.define('test-link-host', Host);
  }

  function trackLink(element: Element, ownerId?: string) {
    const seen: (Instance | undefined)[] = [];
    cleanups.push(
      requestOwner(element, hintLink, (owner) => seen.push(owner), ownerId),
    );
    return seen;
  }

  it('asks only the nearest UniAria host, by key, and waits for it', () => {
    const container = tree(
      '<test-link-host id="tip"><div><test-link-host id="pop"><span id="inside"></span></test-link-host><span id="direct"></span></div></test-link-host>',
    );
    const inside = trackLink(container.querySelector('#inside')!);
    const direct = trackLink(container.querySelector('#direct')!);
    const instance = createInstance(hint);
    cleanups.push(provideOwner(instance, container.querySelector('#tip')!));
    expect(direct).toEqual([instance]);
    expect(inside).toEqual([]);
    // An owner of another kind on the nearest host doesn't answer either.
    cleanups.push(
      provideOwner(createInstance(group), container.querySelector('#pop')!),
    );
    expect(inside).toEqual([]);
  });

  it('finds a link by id', () => {
    const container = tree(
      '<span id="child"></span><test-link-host id="tip"></test-link-host>',
    );
    const instance = createInstance(hint);
    cleanups.push(provideOwner(instance, container.querySelector('#tip')!));
    expect(trackLink(container.querySelector('#child')!, 'tip')).toEqual([
      instance,
    ]);
  });
});
