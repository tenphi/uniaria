/**
 * The benchmark page: a grid of buttons from one implementation in
 * `../src/compare/buttons`, driven by `run.ts` through `window.bench`.
 * Renders are synchronous (`flushSync`), so a timed call covers render,
 * commit and effects.
 */

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import type { Implementation } from '../src/compare/buttons';
import { IMPLEMENTATIONS, renders } from '../src/compare/buttons';

interface GridProps {
  readonly implementation: Implementation;
  readonly count: number;
  readonly isDisabled: boolean;
}

let presses = 0;
const onPress = () => {
  presses++;
};

function Grid({ implementation, count, isDisabled }: GridProps) {
  const Button = IMPLEMENTATIONS[implementation];
  const buttons = [];
  for (let index = 0; index < count; index++) {
    buttons.push(
      <Button key={index} onPress={onPress} isDisabled={isDisabled}>
        {index}
      </Button>,
    );
  }
  return <div className="grid">{buttons}</div>;
}

const root = createRoot(document.getElementById('app')!);
let props: GridProps = { implementation: 'plain', count: 0, isDisabled: false };

function timed(update: () => void): number {
  const start = performance.now();
  flushSync(update);
  return performance.now() - start;
}

const bench = {
  mount(implementation: Implementation, count: number): number {
    props = { implementation, count, isDisabled: false };
    return timed(() => root.render(<Grid {...props} />));
  },
  setDisabled(isDisabled: boolean): number {
    props = { ...props, isDisabled };
    return timed(() => root.render(<Grid {...props} />));
  },
  unmount(): number {
    return timed(() => root.render(null));
  },
  /** Viewport centres of the first `count` buttons. */
  centers(count: number): { x: number; y: number }[] {
    return [...document.querySelectorAll('.grid button')]
      .slice(0, count)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
  },
  renders: () => renders.count,
  presses: () => presses,
  /** Two frames and a task: React renders hover updates after the event. */
  settle: () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setTimeout(resolve)),
      ),
    ),
};

export type Bench = typeof bench;

(window as unknown as { bench: Bench }).bench = bench;
