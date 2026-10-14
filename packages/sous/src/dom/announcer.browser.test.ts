import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AnnouncerModule from './announcer';
import type { Politeness } from './announcer';
import { announce, clearAnnouncer, destroyAnnouncer } from './announcer';

/**
 * A second instance of the module, as when a page bundles two copies of
 * Sous: a different URL is a different module to the browser.
 */
const copyUrl = './announcer.ts?copy';
const copy = (await import(
  /* @vite-ignore */ copyUrl
)) as typeof AnnouncerModule;

const KEY = Symbol.for('@tenphi/sous/announcer/v1');

function container(doc = document) {
  return doc.querySelector<HTMLElement>('[data-sous-live-announcer]');
}

function log(politeness: Politeness, doc = document) {
  return container(doc)?.querySelector(`[aria-live="${politeness}"]`);
}

/** The text of each message in a region, in DOM order. */
function messages(politeness: Politeness, doc = document): string[] {
  return [...(log(politeness, doc)?.children ?? [])].map(
    (node) => node.textContent ?? '',
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  destroyAnnouncer();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('announce', () => {
  it('creates one hidden container at the start of <body> on the first message', () => {
    const content = document.createElement('main');
    document.body.append(content);
    clearAnnouncer();
    destroyAnnouncer();
    expect(container()).toBeNull();

    announce('Saved');
    const node = container()!;
    expect(document.body.firstElementChild).toBe(node);
    expect(node.getAttribute('data-sous-live-announcer')).toBe('');
    expect(node.style.position).toBe('absolute');
    expect(node.style.overflow).toBe('hidden');
    expect(node.style.clipPath).toBe('inset(50%)');
    expect(node.getBoundingClientRect()).toMatchObject({ width: 1, height: 1 });
    expect(
      [...node.children].map((region) => [
        region.getAttribute('role'),
        region.getAttribute('aria-live'),
        region.getAttribute('aria-relevant'),
      ]),
    ).toEqual([
      ['log', 'assertive', 'additions'],
      ['log', 'polite', 'additions'],
    ]);
  });

  it('waits 100 ms after creating the regions, for Safari', () => {
    announce('Saved');
    expect(messages('assertive')).toEqual([]);
    vi.advanceTimersByTime(99);
    expect(messages('assertive')).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(messages('assertive')).toEqual(['Saved']);

    announce('Saved again');
    expect(messages('assertive')).toEqual(['Saved', 'Saved again']);
  });

  it('keeps the order of messages sent during the delay', () => {
    announce('First');
    vi.advanceTimersByTime(50);
    announce('Second');
    announce('Third', { politeness: 'polite' });
    vi.advanceTimersByTime(50);
    expect(messages('assertive')).toEqual(['First', 'Second']);
    expect(messages('polite')).toEqual(['Third']);
  });

  it('is assertive by default and polite on request', () => {
    announce('Error');
    announce('3 results', { politeness: 'polite' });
    announce('Deleted', { politeness: 'assertive' });
    vi.advanceTimersByTime(100);
    expect(messages('assertive')).toEqual(['Error', 'Deleted']);
    expect(messages('polite')).toEqual(['3 results']);
  });

  it('adds a node per message, so a repeated message is read again', () => {
    announce('Copied');
    vi.advanceTimersByTime(100);
    const first = log('assertive')!.firstElementChild;
    announce('Copied');
    expect(messages('assertive')).toEqual(['Copied', 'Copied']);
    expect(log('assertive')!.lastElementChild).not.toBe(first);
  });

  it('removes a message after its timeout, counted from when it goes in', () => {
    announce('Default');
    announce('Short', { timeout: 500 });
    vi.advanceTimersByTime(100 + 499);
    expect(messages('assertive')).toEqual(['Default', 'Short']);
    vi.advanceTimersByTime(1);
    expect(messages('assertive')).toEqual(['Default']);
    vi.advanceTimersByTime(7000 - 500 - 1);
    expect(messages('assertive')).toEqual(['Default']);
    vi.advanceTimersByTime(1);
    expect(messages('assertive')).toEqual([]);
    expect(container()).not.toBeNull();
  });

  it('ignores empty messages', () => {
    announce('');
    announce({ 'aria-labelledby': '' });
    expect(container()).toBeNull();

    announce('Saved');
    vi.advanceTimersByTime(100);
    announce('');
    expect(log('assertive')!.children).toHaveLength(1);
  });

  it('reads another element through aria-labelledby', () => {
    announce({ 'aria-labelledby': 'status' }, { politeness: 'polite' });
    vi.advanceTimersByTime(100);
    const node = log('polite')!.firstElementChild!;
    expect(node.getAttribute('role')).toBe('img');
    expect(node.getAttribute('aria-labelledby')).toBe('status');
    expect(node.textContent).toBe('');
    vi.advanceTimersByTime(7000);
    expect(log('polite')!.children).toHaveLength(0);
  });
});

describe('clearAnnouncer', () => {
  it('empties one region, or both by default', () => {
    announce('Error');
    announce('3 results', { politeness: 'polite' });
    vi.advanceTimersByTime(100);

    clearAnnouncer('assertive');
    expect(messages('assertive')).toEqual([]);
    expect(messages('polite')).toEqual(['3 results']);

    announce('Deleted');
    clearAnnouncer('polite');
    expect(messages('assertive')).toEqual(['Deleted']);
    expect(messages('polite')).toEqual([]);

    clearAnnouncer();
    expect(messages('assertive')).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops messages still waiting for the delay', () => {
    announce('Stale');
    announce('3 results', { politeness: 'polite' });
    clearAnnouncer('assertive');
    announce('Fresh');
    vi.advanceTimersByTime(100);
    expect(messages('assertive')).toEqual(['Fresh']);
    expect(messages('polite')).toEqual(['3 results']);
  });
});

describe('destroyAnnouncer', () => {
  it('removes the container and its timers; the next message recreates it', () => {
    announce('Saved');
    vi.advanceTimersByTime(100);
    const first = container();

    destroyAnnouncer();
    expect(container()).toBeNull();
    expect(KEY in window).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    announce('Saved again');
    expect(container()).not.toBe(first);
    expect(document.body.firstElementChild).toBe(container());
    expect(messages('assertive')).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(messages('assertive')).toEqual(['Saved again']);
  });

  it('drops messages sent during the delay', () => {
    announce('Lost');
    destroyAnnouncer();
    expect(vi.getTimerCount()).toBe(0);

    announce('Kept');
    vi.advanceTimersByTime(100);
    expect(messages('assertive')).toEqual(['Kept']);
  });
});

describe('one announcer per document', () => {
  it('is shared through a global symbol by every copy of Sous', () => {
    expect(copy.announce).not.toBe(announce);
    announce('From this copy');
    copy.announce('From another copy');
    expect(KEY in window).toBe(true);
    expect(
      document.querySelectorAll('[data-sous-live-announcer]'),
    ).toHaveLength(1);

    vi.advanceTimersByTime(100);
    expect(messages('assertive')).toEqual([
      'From this copy',
      'From another copy',
    ]);
    copy.clearAnnouncer();
    expect(messages('assertive')).toEqual([]);
    copy.destroyAnnouncer();
    expect(container()).toBeNull();
  });

  it('replaces a container that something else removed', () => {
    announce('Saved');
    vi.advanceTimersByTime(100);
    document.body.replaceChildren();

    announce('Saved again');
    expect(document.body.firstElementChild).toBe(container());
    vi.advanceTimersByTime(100);
    expect(messages('assertive')).toEqual(['Saved again']);
  });

  it('announces in the document it is given', async () => {
    // The frame keeps its own timers, which fake timers do not reach.
    vi.useRealTimers();
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const doc = frame.contentDocument!;

    announce('Inside', { document: doc, politeness: 'polite' });
    expect(container()).toBeNull();
    expect(doc.body.firstElementChild).toBe(container(doc));
    await vi.waitFor(() => {
      expect(messages('polite', doc)).toEqual(['Inside']);
    });

    clearAnnouncer('polite', doc);
    expect(messages('polite', doc)).toEqual([]);
    destroyAnnouncer(doc);
    expect(container(doc)).toBeNull();
    expect(KEY in window).toBe(false);
  });
});
