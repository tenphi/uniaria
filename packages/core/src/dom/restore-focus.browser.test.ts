import { afterEach, describe, expect, it } from 'vitest';

import { isRestoringFocus, restoreFocus } from './restore-focus';

describe('restoreFocus', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function buttons() {
    document.body.innerHTML =
      '<button id="one">One</button><button id="two">Two</button>';
    return [
      document.querySelector<HTMLElement>('#one')!,
      document.querySelector<HTMLElement>('#two')!,
    ] as const;
  }

  it('marks the element as restored only while it focuses it', () => {
    const [one, two] = buttons();
    const seen: [string, boolean, boolean][] = [];
    for (const button of [one, two]) {
      button.addEventListener('focus', () =>
        seen.push([button.id, isRestoringFocus(one), isRestoringFocus(two)]),
      );
    }
    restoreFocus(one);
    two.focus();
    expect(seen).toEqual([
      ['one', true, false],
      ['two', false, false],
    ]);
    expect(document.activeElement).toBe(two);
    expect(isRestoringFocus(one)).toBe(false);
  });

  it('restores the mark around a restore inside another', () => {
    const [one, two] = buttons();
    const seen: boolean[] = [];
    one.addEventListener('focus', () => {
      restoreFocus(two);
      seen.push(isRestoringFocus(one));
    });
    restoreFocus(one);
    expect(seen).toEqual([true]);
    expect(isRestoringFocus(one)).toBe(false);
    expect(isRestoringFocus(two)).toBe(false);
  });

  it('keeps the mark on the window, where every copy of UniAria sees it', () => {
    const [one] = buttons();
    let mark: unknown;
    one.addEventListener('focus', () => {
      mark = Reflect.get(window, Symbol.for('@uniaria/restoring-focus/v1'));
    });
    restoreFocus(one);
    expect(mark).toBe(one);
  });
});
