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
