/**
 * Spoken output through `@guidepup/virtual-screen-reader`, the simulated
 * screen reader every pull request runs. It reads the accessibility tree the
 * browser exposes, so phrases follow the library's format:
 * `button, Save, disabled`.
 */

import { virtual } from '@guidepup/virtual-screen-reader';

/** Upper bound on steps, so a broken tree cannot hang a test. */
const MAX_STEPS = 500;

/**
 * Reads `container` (the whole document by default) from start to end and
 * returns every phrase, `document` to `end of document`.
 */
export async function spokenPhrases(
  container: Element = document.body,
): Promise<string[]> {
  if (listening) {
    throw new Error(
      '[@uniaria/testing] spoken() reads the page with the same virtual screen reader; it cannot run while listening to live regions.',
    );
  }
  await virtual.start({ container });
  try {
    for (
      let step = 0;
      step < MAX_STEPS &&
      (await virtual.lastSpokenPhrase()) !== 'end of document';
      step++
    ) {
      await virtual.next();
    }
    return await virtual.spokenPhraseLog();
  } finally {
    await virtual.stop();
  }
}

/** How the virtual screen reader logs a live region: `assertive: Saved`. */
const LIVE_PHRASE = /^(assertive|polite): /;

let listening = false;

/**
 * Starts the virtual screen reader on `container` (the whole document by
 * default) so it hears live regions, and returns a reader for what they have
 * announced since, in order: `assertive: Saved`, `polite: 3 results`. A
 * region only speaks when content changes inside it after listening starts,
 * as with a real screen reader. Stop with `stopListening()`.
 */
export async function listenLive(
  container: Element = document.body,
): Promise<() => Promise<string[]>> {
  if (listening) {
    throw new Error('[@uniaria/testing] Already listening to live regions.');
  }
  await virtual.start({ container });
  listening = true;
  return async () =>
    (await virtual.spokenPhraseLog()).filter((phrase) =>
      LIVE_PHRASE.test(phrase),
    );
}

/** Stops `listenLive()`, if it is listening. */
export async function stopListening(): Promise<void> {
  if (!listening) return;
  listening = false;
  await virtual.stop();
}
