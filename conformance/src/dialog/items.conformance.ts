/**
 * Dialog's trigger parts, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): the
 * `triggerLabel` and `triggerDescription` that name and describe the
 * trigger, and the `triggerFrame` and `triggerExtras` beside it, all outside
 * the dialog; their state and spoken output. A modal dialog leaves nothing
 * outside it to press, so the Popover items suite covers presses on extras.
 * Phase 5: the adapters reach it with the implementation.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { DialogProps, DialogState } from './types';

type MountedDialog = Mounted<DialogProps, DialogState>;

const PHASE = { phase: 5 } as const;

const STYLE = h(
  'style',
  null,
  `.sc-frame { position: fixed; left: 150px; top: 30px; display: flex; align-items: center; gap: 40px; height: 30px; margin: 0; padding: 0 }
   .sc-trigger { width: 120px; height: 30px; margin: 0; padding: 0 }
   .sc-extra { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-page { position: fixed; left: 0; top: 400px; width: 100px; height: 20px; margin: 0 }`,
);

/**
 * A frame: a trigger "Fruit" describing its value "Apple", and an extra
 * "Clear Fruit"; then a dialog "Choose fruit".
 */
function fruit(): TemplateNode[] {
  return [
    STYLE,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h(
      'div',
      { part: 'triggerFrame', class: 'sc-frame' },
      h(
        'button',
        { part: 'trigger', class: 'sc-trigger' },
        h('span', { part: 'triggerLabel' }, 'Fruit'),
        ' ',
        h('span', { part: 'triggerDescription' }, 'Apple'),
      ),
      h(
        'span',
        { part: 'triggerExtras' },
        h(
          'button',
          { id: 'clear', class: 'sc-extra', 'aria-label': 'Clear Fruit' },
          '×',
        ),
      ),
    ),
    h(
      'dialog',
      { part: 'root' },
      h('h2', { part: 'title' }, 'Choose fruit'),
      h('button', { part: 'close' }, 'Cancel'),
    ),
  ];
}

function expectOnTriggerParts(
  mounted: MountedDialog,
  attribute: string,
  isSet: boolean,
): void {
  for (const name of ['trigger', 'triggerFrame', 'triggerExtras']) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(isSet);
  }
}

export const dialogItemsConformance = defineConformance<
  DialogProps,
  DialogState
>('dialog', ({ scenario, group }) => {
  group('trigger parts', () => {
    scenario(
      'triggerLabel names the trigger and triggerDescription describes it; every trigger part is marked outside the dialog',
      async ({ mount }) => {
        const mounted = await mount({ template: fruit() });
        const trigger = mounted.part('trigger');
        expect(trigger.getAttribute('aria-labelledby')).toBe(
          mounted.part('triggerLabel').id,
        );
        expect(trigger.getAttribute('aria-describedby')).toBe(
          mounted.part('triggerDescription').id,
        );
        for (const [part, marker] of [
          ['triggerLabel', 'dialog-trigger-label'],
          ['triggerDescription', 'dialog-trigger-description'],
          ['triggerFrame', 'dialog-trigger-frame'],
          ['triggerExtras', 'dialog-trigger-extras'],
        ] as const) {
          expect(mounted.part(part).getAttribute('data-uni-part')).toBe(marker);
        }
      },
      PHASE,
    );

    scenario(
      'reads the trigger by its label and description',
      async ({ mount, spoken }) => {
        await mount({ template: fruit() });
        const phrases = await spoken();
        expect(phrases).toContain('button, Fruit, Apple');
        expect(phrases).toContain('button, Clear Fruit');
      },
      PHASE,
    );

    scenario(
      'the frame and the extras carry data-open, and hover over the frame is the trigger’s',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: fruit() });
        const page = mounted.container.querySelector('#page')!;
        await pointer.move(mounted.container.querySelector('#clear')!);
        expectOnTriggerParts(mounted, 'data-hovered', true);
        await pointer.move(page);
        expectOnTriggerParts(mounted, 'data-hovered', false);

        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => mounted.state().isOpen).toBe(true);
        expectOnTriggerParts(mounted, 'data-open', true);
        await mounted.setProps({ isOpen: false });
        expectOnTriggerParts(mounted, 'data-open', false);
      },
      PHASE,
    );
  });
});
