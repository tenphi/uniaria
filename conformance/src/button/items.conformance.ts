/**
 * Button's items parts, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): the `label`
 * that alone names the button and the `description` that describes it, each
 * only while rendered; the `frame` around the button and its `extras`,
 * outside the root, which carry the root's state; hover over the frame as
 * the button's; presses and Tab order of the extras; render counts and
 * spoken output. Phase 5: the adapters reach it with the implementation.
 *
 * The extras here are native buttons and a count: a second UniAria Button
 * would be a second `data-uni="button"` root in the container. The Popover
 * suite presses a UniAria Button extra.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateAttrs, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { ButtonProps, ButtonState } from './types';

type MountedButton = Mounted<ButtonProps, ButtonState>;

const PHASE = { phase: 5 } as const;

const PRESS_EVENTS = ['pressStart', 'pressEnd', 'press'];

/** What the frame and the extras mirror; hover is checked on its own. */
const MIRRORED = [
  'data-pressed',
  'data-focused',
  'data-focus-visible',
  'data-disabled',
];

/**
 * Fixed places: the frame at (150, 100), the button, a 40px gap that is
 * only the frame's, then the extras; `#page` (not focusable), where the
 * pointer rests; `#before` and `#after`, text fields for Tab.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-page { position: fixed; left: 0; top: 400px; width: 100px; height: 20px; margin: 0 }
   .sc-before { position: fixed; left: 0; top: 300px; width: 100px }
   .sc-after { position: fixed; left: 0; top: 340px; width: 100px }
   .sc-frame { position: fixed; left: 150px; top: 100px; display: flex; align-items: center; height: 40px; margin: 0; padding: 0 }
   .sc-root { width: 100px; height: 30px; margin: 0; padding: 0 }
   .sc-gap { display: block; width: 40px; height: 30px }
   .sc-extras { display: flex; gap: 4px; height: 30px }
   .sc-extra { width: 30px; height: 30px; margin: 0; padding: 0 }`,
);

/** The page around the button's markup. */
function page(...content: TemplateNode[]): TemplateNode[] {
  return [
    LAYOUT,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    ...content,
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

interface SaveOptions {
  readonly root?: TemplateAttrs;
  readonly label?: TemplateAttrs | null;
  readonly description?: TemplateAttrs | null;
}

/**
 * A button "Save" with a label, a description "Saves the file" and a
 * shortcut hint "⌘S"; `null` leaves a part's element in place as plain
 * content.
 */
function save({
  root = {},
  label = {},
  description = {},
}: SaveOptions = {}): TemplateNode[] {
  const piece = (attrs: TemplateAttrs | null, part: string, text: string) =>
    h('span', attrs === null ? {} : { part, ...attrs }, text);
  return page(
    h(
      'button',
      { part: 'root', class: 'sc-root', ...root },
      piece(label, 'label', 'Save'),
      ' ',
      piece(description, 'description', 'Saves the file'),
      ' ',
      h('kbd', null, '⌘S'),
    ),
  );
}

/**
 * A frame: a button "Fruit", a gap, and the extras: "Clear Fruit", "Remove
 * Fruit" and a count "3".
 */
function fruit(): TemplateNode[] {
  return page(
    h(
      'div',
      { part: 'frame', class: 'sc-frame' },
      h(
        'button',
        { part: 'root', class: 'sc-root' },
        h('span', { part: 'label' }, 'Fruit'),
      ),
      h('span', { class: 'sc-gap' }),
      h(
        'span',
        { part: 'extras', class: 'sc-extras' },
        h(
          'button',
          { id: 'clear', class: 'sc-extra', 'aria-label': 'Clear Fruit' },
          '×',
        ),
        h(
          'button',
          { id: 'remove', class: 'sc-extra', 'aria-label': 'Remove Fruit' },
          '−',
        ),
        h('span', { id: 'count' }, '3'),
      ),
    ),
  );
}

function byId(mounted: MountedButton, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function activeElement(mounted: MountedButton): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** The root, the frame and the extras, which carry the same state. */
function stateParts(mounted: MountedButton): HTMLElement[] {
  return [mounted.part(), mounted.part('frame'), mounted.part('extras')];
}

/** Whether every part in `stateParts` has `attribute`, or none has. */
function expectEverywhere(
  mounted: MountedButton,
  attribute: string,
  isSet: boolean,
): void {
  for (const element of stateParts(mounted)) {
    expect(
      element.hasAttribute(attribute),
      `${attribute} on ${element.getAttribute('data-uni-part') ?? 'the root'}`,
    ).toBe(isSet);
  }
}

export const buttonItemsConformance = defineConformance<
  ButtonProps,
  ButtonState
>('button', ({ scenario, group }) => {
  group('label and description', () => {
    scenario(
      'the label alone names the button and the description describes it, by ids UniAria gives them',
      async ({ mount }) => {
        const mounted = await mount({ template: save() });
        const root = mounted.part();
        const label = mounted.part('label');
        const description = mounted.part('description');
        expect(label.getAttribute('data-element')).toBe('Label');
        expect(description.getAttribute('data-element')).toBe('Description');
        expect(label.id).not.toBe('');
        expect(description.id).not.toBe('');
        expect(label.id).not.toBe(description.id);
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
        expect(root.getAttribute('aria-describedby')).toBe(description.id);
      },
      PHASE,
    );

    scenario(
      'keeps the ids the consumer gives the label and the description',
      async ({ mount }) => {
        const mounted = await mount({
          template: save({
            label: { id: 'save-label' },
            description: { id: 'save-hint' },
          }),
        });
        expect(mounted.part('label').id).toBe('save-label');
        expect(mounted.part('description').id).toBe('save-hint');
        expect(mounted.part().getAttribute('aria-labelledby')).toBe(
          'save-label',
        );
        expect(mounted.part().getAttribute('aria-describedby')).toBe(
          'save-hint',
        );
      },
      PHASE,
    );

    scenario(
      'without a part, the consumer’s own reference for it stays',
      async ({ mount }) => {
        const references = {
          'aria-labelledby': 'outer-name',
          'aria-describedby': 'outer-hint',
        };
        const neither = await mount({
          template: save({
            root: references,
            label: null,
            description: null,
          }),
        });
        expect(neither.part().getAttribute('aria-labelledby')).toBe(
          'outer-name',
        );
        expect(neither.part().getAttribute('aria-describedby')).toBe(
          'outer-hint',
        );
        neither.container.hidden = true;

        const labelOnly = await mount({
          template: save({ root: references, description: null }),
        });
        expect(labelOnly.part().getAttribute('aria-labelledby')).toBe(
          labelOnly.part('label').id,
        );
        expect(labelOnly.part().getAttribute('aria-describedby')).toBe(
          'outer-hint',
        );
      },
      PHASE,
    );

    scenario(
      'reads the label as the name and the description after it, never the hint',
      async ({ mount, spoken }) => {
        await mount({ template: save() });
        expect(await spoken()).toContain('button, Save, Saves the file');
      },
      PHASE,
    );

    scenario(
      'with a label and no description, reads the label alone',
      async ({ mount, spoken }) => {
        await mount({ template: save({ description: null }) });
        expect(await spoken()).toContain('button, Save');
      },
      PHASE,
    );

    scenario(
      'the label part wins over the consumer’s aria-label',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: save({ root: { 'aria-label': 'Store' } }),
        });
        expect(mounted.part().getAttribute('aria-labelledby')).toBe(
          mounted.part('label').id,
        );
        const phrases = await spoken();
        expect(phrases).toContain('button, Save, Saves the file');
        expect(phrases.some((phrase) => phrase.includes('Store'))).toBe(false);
      },
      PHASE,
    );
  });

  group('frame and extras', () => {
    scenario(
      'the frame and the extras are marked outside the root and take no role',
      async ({ mount }) => {
        const mounted = await mount({ template: fruit() });
        const frame = mounted.part('frame');
        const extras = mounted.part('extras');
        expect(frame.getAttribute('data-uni-part')).toBe('button-frame');
        expect(extras.getAttribute('data-uni-part')).toBe('button-extras');
        for (const element of [frame, extras]) {
          expect(element.hasAttribute('role')).toBe(false);
          expect(element.hasAttribute('data-element')).toBe(false);
          expect(element.hasAttribute('tabindex')).toBe(false);
        }
        expect(frame.contains(mounted.part())).toBe(true);
        expect(mounted.part().contains(extras)).toBe(false);
      },
      PHASE,
    );

    scenario(
      'each extra is read on its own after the button, outside its name',
      async ({ mount, spoken }) => {
        await mount({ template: fruit() });
        const phrases = await spoken();
        const button = phrases.indexOf('button, Fruit');
        const clear = phrases.indexOf('button, Clear Fruit');
        const count = phrases.indexOf('3');
        expect(button).toBeGreaterThanOrEqual(0);
        expect(clear).toBeGreaterThan(button);
        expect(count).toBeGreaterThan(clear);
      },
      PHASE,
    );

    scenario(
      'the frame and the extras carry the root’s focus, press and disabled state',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: fruit() });
        for (const attribute of MIRRORED) {
          expectEverywhere(mounted, attribute, false);
        }

        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(mounted.part());
        expectEverywhere(mounted, 'data-focused', true);
        expectEverywhere(mounted, 'data-focus-visible', true);

        await keyboard.down('Space');
        expectEverywhere(mounted, 'data-pressed', true);
        await keyboard.up('Space');
        expectEverywhere(mounted, 'data-pressed', false);

        await keyboard.tab();
        expect(activeElement(mounted)).toBe(byId(mounted, 'clear'));
        expectEverywhere(mounted, 'data-focused', false);
        expectEverywhere(mounted, 'data-focus-visible', false);

        await mounted.setProps({ isDisabled: true });
        expectEverywhere(mounted, 'data-disabled', true);
        await mounted.setProps({ isDisabled: false });
        expectEverywhere(mounted, 'data-disabled', false);
      },
      PHASE,
    );

    scenario(
      'hover over the frame is the button’s: over the button, a gap or an extra',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: fruit() });
        const gap = mounted.container.querySelector('.sc-gap')!;
        const page = byId(mounted, 'page');

        for (const [target, isHovered] of [
          [mounted.part(), true],
          [gap, true],
          [byId(mounted, 'clear'), true],
          [byId(mounted, 'count'), true],
          [page, false],
          [byId(mounted, 'remove'), true],
          [mounted.part(), true],
          [page, false],
        ] as const) {
          await pointer.move(target);
          expectEverywhere(mounted, 'data-hovered', isHovered);
          expect(mounted.state().isHovered).toBe(isHovered);
        }
      },
      PHASE,
    );

    scenario(
      'hover over the frame never starts while the button is disabled',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { isDisabled: true },
        });
        await pointer.move(byId(mounted, 'clear'));
        expectEverywhere(mounted, 'data-hovered', false);
        expect(mounted.state().isHovered).toBe(false);
      },
      PHASE,
    );

    scenario(
      'a press on an extra is the extra’s alone, by pointer or keyboard',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          events: PRESS_EVENTS,
        });
        const clear = byId(mounted, 'clear');
        let clicks = 0;
        clear.addEventListener('click', () => (clicks += 1));

        await pointer.down(clear);
        expectEverywhere(mounted, 'data-pressed', false);
        await pointer.up();
        expect(clicks).toBe(1);

        clear.focus();
        await keyboard.press('Enter');
        await keyboard.press('Space');
        expect(clicks).toBe(3);
        expect(mounted.eventNames()).toEqual([]);
        expect(mounted.state().isPressed).toBe(false);
      },
      PHASE,
    );

    scenario(
      'Tab moves from the button to each extra in DOM order, and back',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: fruit() });
        byId(mounted, 'before').focus();
        const order = [
          mounted.part(),
          byId(mounted, 'clear'),
          byId(mounted, 'remove'),
          byId(mounted, 'after'),
        ];
        for (const element of order) {
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(element);
        }
        for (const element of order.slice(0, -1).reverse()) {
          await keyboard.tab({ isBackward: true });
          expect(activeElement(mounted)).toBe(element);
        }
      },
      PHASE,
    );

    scenario(
      'hover over the frame, focus and presses never re-render the owner',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          events: PRESS_EVENTS,
        });
        const renders = mounted.renderCount();

        await pointer.move(mounted.container.querySelector('.sc-gap')!);
        await pointer.move(byId(mounted, 'clear'));
        await pointer.click(mounted.part());
        await pointer.move(byId(mounted, 'page'));
        byId(mounted, 'before').focus();
        await keyboard.tab();
        await keyboard.press('Enter');
        await keyboard.tab();

        expect(mounted.eventNames()).toContain('press');
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });
});
