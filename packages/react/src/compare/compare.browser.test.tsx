/**
 * UniAria against React Aria (owner request, 2026-10-15): the same real-input
 * script drives each button from `./buttons`. At every step their state
 * attributes and presses must match React Aria's, and UniAria must not
 * re-render for interaction state unless the component reads it. Timings live
 * in `bench/`; this file checks behavior and render counts in every browser.
 *
 * The neighbours get a `tabindex` so Tab stays in the test frame in WebKit.
 * Each run starts on an empty page with the pointer parked in a corner:
 * WebKit reports hover for a button that mounts under a still pointer.
 */

import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';

import type { Implementation } from './buttons';
import { IMPLEMENTATIONS, renders } from './buttons';

const STATE_ATTRIBUTES = [
  'data-pressed',
  'data-hovered',
  'data-focused',
  'data-focus-visible',
  'data-disabled',
  'disabled',
] as const;

interface Step {
  readonly name: string;
  readonly attributes: string;
  readonly renders: number;
  readonly presses: number;
}

const roots: Root[] = [];

function cleanup(): void {
  for (const root of roots.splice(0)) root.unmount();
  document.body.replaceChildren();
}

afterEach(async () => {
  await releaseInput();
  cleanup();
});

/** Moves the pointer to the bottom-right corner, away from every button. */
async function parkPointer(): Promise<void> {
  const corner = document.createElement('div');
  corner.style.cssText =
    'position: fixed; right: 0; bottom: 0; width: 8px; height: 8px';
  document.body.append(corner);
  await pointer.move(corner);
  corner.remove();
}

/** Two frames: React renders hover updates in a task after the event. */
const settle = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );

async function run(implementation: Implementation): Promise<Step[]> {
  cleanup();
  await parkPointer();
  const Button = IMPLEMENTATIONS[implementation];
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  let presses = 0;
  const onPress = () => presses++;
  const render = (isDisabled: boolean) =>
    flushSync(() =>
      root.render(
        <>
          <button id="before" tabIndex={0}>
            Before
          </button>
          <Button onPress={onPress} isDisabled={isDisabled}>
            Save
          </Button>
          <button id="after" tabIndex={0}>
            After
          </button>
        </>,
      ),
    );

  const steps: Step[] = [];
  let lastRenders = renders.count;
  const record = async (name: string) => {
    await settle();
    const target = container.children[1]!;
    steps.push({
      name,
      attributes: STATE_ATTRIBUTES.filter((attribute) =>
        target.hasAttribute(attribute),
      ).join(' '),
      renders: renders.count - lastRenders,
      presses,
    });
    lastRenders = renders.count;
  };

  render(false);
  await record('mount');
  const target = container.children[1]!;

  await pointer.move(target);
  await record('mouse enters');
  await pointer.down(target);
  await record('mouse down');
  await pointer.up();
  await record('mouse up');
  await pointer.move(container.querySelector('#after')!);
  await record('mouse moves to the next button');
  await pointer.move(target);
  await record('mouse moves back');
  await pointer.moveOutside(target);
  await record('mouse leaves');

  await keyboard.tab();
  await record('Tab away');
  await keyboard.tab({ isBackward: true });
  await record('Shift+Tab back');
  await keyboard.down('Space');
  await record('Space down');
  await keyboard.up('Space');
  await record('Space up');
  await keyboard.press('Enter');
  await record('Enter');

  render(true);
  await record('disabled by the parent');
  return steps;
}

it('matches React Aria step by step, and UniAria renders only for props', async () => {
  const aria = await run('aria');
  const uni = await run('uni');
  const shared = await run('uniShared');

  const behavior = (steps: Step[]) =>
    steps.map(({ name, attributes, presses }) => ({
      name,
      attributes,
      presses,
    }));
  expect(behavior(uni)).toEqual(behavior(aria));
  expect(behavior(shared)).toEqual(behavior(aria));

  // Mount and the parent's re-render are the only renders without shared
  // state; reading the state re-renders for interactions, as React Aria does.
  const interactions = (steps: Step[]) => steps.slice(1, -1);
  for (const step of interactions(uni)) expect(step.renders).toBe(0);
  const total = (steps: Step[]) =>
    interactions(steps).reduce((sum, step) => sum + step.renders, 0);
  expect(total(shared)).toBeGreaterThan(0);
  expect(total(aria)).toBeGreaterThan(0);
  expect(total(shared)).toBeLessThanOrEqual(total(aria));

  // The parent's re-render costs UniAria one render per button, and reading the
  // state adds none for the props it already rendered.
  expect(uni.at(-1)!.renders).toBe(1);
  expect(shared.at(-1)!.renders).toBeLessThanOrEqual(aria.at(-1)!.renders);
});
