/**
 * ToggleButton's items parts, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`). They are
 * Button's, which the Button items suite checks; this suite covers what the
 * selection adds: the label and description beside `aria-pressed`, and
 * `data-selected` on the frame and the extras. Phase 5: the adapters reach
 * it with the implementation.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { ToggleButtonProps, ToggleButtonState } from './types';

type MountedToggle = Mounted<ToggleButtonProps, ToggleButtonState>;

const PHASE = { phase: 5 } as const;

const STYLE = h(
  'style',
  null,
  `.sc-frame { position: fixed; left: 150px; top: 100px; display: flex; align-items: center; gap: 40px; height: 40px; margin: 0; padding: 0 }
   .sc-root { width: 100px; height: 30px; margin: 0; padding: 0 }
   .sc-extra { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-page { position: fixed; left: 0; top: 400px; width: 100px; height: 20px; margin: 0 }`,
);

/**
 * A frame: a toggle "Bold" with a description "Makes text bold", and an
 * extra "Bold options".
 */
function bold(): TemplateNode[] {
  return [
    STYLE,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h(
      'div',
      { part: 'frame', class: 'sc-frame' },
      h(
        'button',
        { part: 'root', class: 'sc-root' },
        h('span', { part: 'label' }, 'Bold'),
        ' ',
        h('span', { part: 'description' }, 'Makes text bold'),
      ),
      h(
        'span',
        { part: 'extras' },
        h(
          'button',
          { id: 'options', class: 'sc-extra', 'aria-label': 'Bold options' },
          '▾',
        ),
      ),
    ),
  ];
}

function stateParts(mounted: MountedToggle): HTMLElement[] {
  return [mounted.part(), mounted.part('frame'), mounted.part('extras')];
}

function expectEverywhere(
  mounted: MountedToggle,
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

export const toggleButtonItemsConformance = defineConformance<
  ToggleButtonProps,
  ToggleButtonState
>('toggle-button', ({ scenario, group }) => {
  group('items parts', () => {
    scenario(
      'the label names the toggle and the description describes it, with aria-pressed kept',
      async ({ mount }) => {
        const mounted = await mount({ template: bold() });
        const root = mounted.part();
        expect(root.getAttribute('aria-labelledby')).toBe(
          mounted.part('label').id,
        );
        expect(root.getAttribute('aria-describedby')).toBe(
          mounted.part('description').id,
        );
        expect(root.getAttribute('aria-pressed')).toBe('false');
      },
      PHASE,
    );

    scenario(
      'the frame and the extras are marked as the toggle’s and carry data-selected',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: bold() });
        expect(mounted.part('frame').getAttribute('data-uni-part')).toBe(
          'toggle-button-frame',
        );
        expect(mounted.part('extras').getAttribute('data-uni-part')).toBe(
          'toggle-button-extras',
        );
        expectEverywhere(mounted, 'data-selected', false);

        await pointer.click(mounted.part());
        expect(mounted.part().getAttribute('aria-pressed')).toBe('true');
        expectEverywhere(mounted, 'data-selected', true);

        await mounted.setProps({ isSelected: false });
        expectEverywhere(mounted, 'data-selected', false);
      },
      PHASE,
    );

    scenario(
      'hover over an extra hovers the toggle; a press on it doesn’t toggle',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: bold(),
          events: ['selectedChange'],
        });
        const options =
          mounted.container.querySelector<HTMLElement>('#options')!;
        await pointer.move(options);
        expectEverywhere(mounted, 'data-hovered', true);
        expect(mounted.state().isHovered).toBe(true);

        await pointer.click(options);
        expect(mounted.eventNames()).toEqual([]);
        expectEverywhere(mounted, 'data-selected', false);

        await pointer.move(
          mounted.container.querySelector<HTMLElement>('#page')!,
        );
        expectEverywhere(mounted, 'data-hovered', false);
      },
      PHASE,
    );
  });
});
