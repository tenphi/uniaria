/**
 * Self-test of the conformance runner and its real input, against a fixture
 * adapter that renders templates as plain DOM. If these fail, every adapter's
 * conformance run is suspect, so they run in all three browsers like any
 * other browser test.
 */

import { expect } from 'vitest';

import type { ConformanceAdapter } from './contract';
import { runConformance } from './run';
import { defineConformance } from './scenario';
import { h, renderTemplate } from './template';

const fixtureAdapter: ConformanceAdapter = {
  name: 'fixture',
  async mount({ component, props, template, events, record, container }) {
    let current = { ...props };
    container.appendChild(
      renderTemplate(template, document, (element) =>
        element.setAttribute('data-scope', component),
      ),
    );
    const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
    const apply = () =>
      root.toggleAttribute('disabled', current.isDisabled === true);
    const onClick = (event: MouseEvent) => {
      if (events.includes('press')) record('press', { detail: event.detail });
    };
    root.addEventListener('click', onClick);
    apply();
    return {
      async setProps(next) {
        current = { ...current, ...next };
        apply();
      },
      state: () => ({ isDisabled: current.isDisabled === true }),
      renderCount: () => 0,
      async unmount() {
        root.removeEventListener('click', onClick);
        container.replaceChildren();
      },
    };
  },
};

interface FixtureProps {
  isDisabled: boolean;
}

interface FixtureState {
  isDisabled: boolean;
}

function track(element: Element, types: string[]) {
  const log: string[] = [];
  for (const type of types) {
    element.addEventListener(type, (event) => {
      const repeat = event instanceof KeyboardEvent && event.repeat;
      log.push(repeat ? `${type}:repeat` : type);
    });
  }
  return log;
}

const fixtureSuite = defineConformance<FixtureProps, FixtureState>(
  'fixture',
  ({ scenario, group }) => {
    scenario('finds parts by data-scope and data-part', async ({ mount }) => {
      const mounted = await mount({
        template: h('button', { part: 'root' }, 'Save'),
      });
      expect(mounted.part().tagName).toBe('BUTTON');
      expect(mounted.parts('root')).toHaveLength(1);
      expect(() => mounted.part('missing')).toThrow(/found 0/);
    });

    scenario('applies and updates props', async ({ mount }) => {
      const mounted = await mount({
        template: h('button', { part: 'root' }, 'Save'),
        props: { isDisabled: true },
      });
      expect(mounted.part().hasAttribute('disabled')).toBe(true);
      await mounted.setProps({ isDisabled: false });
      expect(mounted.part().hasAttribute('disabled')).toBe(false);
      expect(mounted.state()).toEqual({ isDisabled: false });
    });

    group('pointer', () => {
      scenario(
        'clicks with a real mouse and records events',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
            events: ['press'],
          });
          await pointer.click(mounted.part());
          expect(mounted.eventNames()).toEqual(['press']);
          expect(mounted.events[0]!.detail).toEqual({ detail: 1 });
        },
      );

      scenario(
        'holds the button while the pointer leaves and returns',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          const root = mounted.part();
          const log = track(root, [
            'pointerdown',
            'pointerleave',
            'pointerenter',
            'pointerup',
          ]);
          await pointer.down(root);
          await pointer.moveOutside(root);
          await pointer.move(root);
          await pointer.up();
          // `down` moves onto the target first, so the log starts with an enter.
          expect(log).toEqual([
            'pointerenter',
            'pointerdown',
            'pointerleave',
            'pointerenter',
            'pointerup',
          ]);
        },
      );

      scenario(
        'leaves a button held at the end of a scenario',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          await pointer.down(mounted.part());
        },
      );

      scenario(
        'starts the next scenario with every button released',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          const buttons: number[] = [];
          mounted
            .part()
            .addEventListener('pointerdown', (event) =>
              buttons.push(event.buttons),
            );
          await pointer.click(mounted.part());
          expect(buttons).toEqual([1]);
        },
      );
    });

    group('keyboard', () => {
      scenario(
        'moves focus with Tab and Shift+Tab',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: [
              // WebKit tabs to buttons only when they have a tabindex.
              h('button', { part: 'root', tabindex: '0' }, 'One'),
              h('button', { id: 'two', tabindex: '0' }, 'Two'),
            ],
          });
          await keyboard.tab();
          expect(document.activeElement).toBe(mounted.part());
          await keyboard.tab();
          expect(document.activeElement?.id).toBe('two');
          await keyboard.tab({ isBackward: true });
          expect(document.activeElement).toBe(mounted.part());
        },
      );

      scenario(
        'sends a repeat while a key is held',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          const log = track(mounted.part(), ['keydown', 'keyup']);
          mounted.part().focus();
          await keyboard.down('Shift');
          await keyboard.down('Shift');
          await keyboard.up('Shift');
          expect(log).toEqual(['keydown', 'keydown:repeat', 'keyup']);
        },
      );
    });

    group('touch', () => {
      scenario(
        'taps with a real finger',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          const log: string[] = [];
          for (const type of ['pointerdown', 'pointerup', 'click']) {
            mounted.part().addEventListener(type, (event) => {
              log.push(`${type}:${(event as PointerEvent).pointerType}`);
            });
          }
          await touch.tap(mounted.part());
          expect(log).toEqual([
            'pointerdown:touch',
            'pointerup:touch',
            'click:touch',
          ]);
        },
        { needs: ['touch'] },
      );

      scenario(
        'turns a finger moving away into a scroll',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          const log = track(mounted.part(), ['pointercancel', 'click']);
          await touch.down(mounted.part());
          await touch.moveOutside(mounted.part());
          await touch.up();
          expect(log).toEqual(['pointercancel']);
        },
        { needs: ['touch'] },
      );

      scenario(
        'leaves a finger down at the end of a scenario',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          await touch.down(mounted.part());
        },
        { needs: ['touch'] },
      );

      scenario(
        'starts the next scenario with no finger down',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: h('button', { part: 'root' }, 'Save'),
          });
          const touches: number[] = [];
          mounted
            .part()
            .addEventListener('touchstart', (event) =>
              touches.push(event.touches.length),
            );
          await touch.tap(mounted.part());
          expect(touches).toEqual([1]);
        },
        { needs: ['touch'] },
      );
    });

    scenario(
      'reads spoken output for the whole document',
      async ({ mount, spoken }) => {
        await mount({
          template: h('button', { part: 'root' }, 'Save'),
          props: { isDisabled: true },
        });
        const phrases = await spoken();
        expect(phrases[0]).toBe('document');
        expect(phrases).toContain('button, Save, disabled');
        expect(phrases.at(-1)).toBe('end of document');
      },
    );

    scenario(
      'skips scenarios from a later phase',
      async () => {
        throw new Error('A phase 2 scenario ran in a phase 1 run.');
      },
      { phase: 2 },
    );
  },
);

runConformance(fixtureAdapter, [fixtureSuite], { phase: 1 });
