import { afterEach, expect, it } from 'vitest';

import { createInstance } from '../../runtime';
import type { Instance } from '../../runtime';
import { toggleButton } from './toggle-button';

let instance: Instance<typeof toggleButton> | undefined;

afterEach(() => {
  instance?.stop();
  instance = undefined;
  document.body.replaceChildren();
});

/** Binds an instance to a real button, wiring its handlers by hand. */
function mount(props: Record<string, unknown> = {}) {
  const root = document.createElement('button');
  document.body.append(root);
  instance = createInstance(toggleButton, { props: props as never });
  instance.attach('root', root);
  instance.start();
  const on = instance.connect().root.on as Record<string, (e: Event) => void>;
  for (const type of Object.keys(on)) {
    root.addEventListener(type, (event) => {
      instance!.connect().root.on![type]!(event as never);
    });
  }
  return { root, instance };
}

// Not a conformance scenario: a scenario can't run code inside `press`.
it('lets press handlers read the value just toggled', () => {
  const seen: boolean[] = [];
  const { root } = mount({
    onPress: () => seen.push(instance!.getState().isSelected),
  });
  root.click();
  root.click();
  expect(seen).toEqual([true, false]);
});

it('reports the request to a controlled consumer before press', () => {
  const log: string[] = [];
  const { root } = mount({
    isSelected: false,
    onSelectedChange: (isSelected: boolean) => log.push(`change ${isSelected}`),
    onPress: () => log.push(`press ${instance!.getState().isSelected}`),
  });
  root.click();
  expect(log).toEqual(['change true', 'press false']);
});
