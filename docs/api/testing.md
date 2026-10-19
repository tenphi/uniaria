---
title: Testing
description: '@uniaria/testing: conformance suites, adapters and screen-reader helpers.'
---

`@uniaria/testing` is how UniAria checks that a component behaves the same in
every adapter. A component's behavior is described once, as a _conformance
suite_ of scenarios that mount it, drive it with real mouse, keyboard and
touch input, and check the DOM, focus, events, state and what a screen reader
says. Each adapter implements one `mount` function, and every suite runs
against it in Chromium, Firefox and WebKit.

Use it to:

- **Write an adapter** for another framework, and prove it with the same
  suites the React and custom-element adapters pass.
- **Test your own components**: write suites for your definitions, or use
  the real-input and spoken-output helpers in ordinary browser tests.

It is a development dependency. To test a definition's logic without a
browser, you don't need it: drive an instance with
[`createInstance`](./core.md#testing-a-definition-in-node) in Node.

## Entries

| Entry                       | Runs in                     | Exports                                                                                                                                                       |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@uniaria/testing`          | Anywhere, Node included     | `defineConformance`; the templates `h`, `nested`, `rows` and `VIRTUALIZER`; `renderTemplate`, `templateParts`, `partSelector`, `partName`; the contract types |
| `@uniaria/testing/browser`  | Vitest browser mode         | `runConformance`; `pointer`, `keyboard`, `touch`, `releaseInput`, `isTouchSupported`; `emulateMedia`; `spokenPhrases`                                         |
| `@uniaria/testing/commands` | Node, in your Vitest config | `uniCommands`, `screenReaderCommands`                                                                                                                         |

It needs Vitest 5 (a peer dependency) with browser mode and its Playwright
provider: real input goes through Playwright, never through synthetic
`dispatchEvent` calls, so scenarios see the browser's own event sequences.
Spoken output comes from
[`@guidepup/virtual-screen-reader`](https://github.com/guidepup/virtual-screen-reader),
a dependency. Real screen readers need
[`@guidepup/guidepup`](https://www.guidepup.dev), an optional peer.

## Writing a suite

```ts
defineConformance<Props, State>(
  component: string,
  define: (builder: { scenario; group }) => void,
): ConformanceSuite<Props, State>
```

A suite is data: the component's definition name and a tree of scenarios. It
names the component by string and never imports a definition or an adapter,
so it can be written from a spec before the implementation exists.

```ts
import { defineConformance, h } from '@uniaria/testing';
import { expect } from 'vitest';

import type { DisclosureProps, DisclosureState } from './types';

export const disclosureConformance = defineConformance<
  DisclosureProps,
  DisclosureState
>('disclosure', ({ scenario, group }) => {
  const markup = [
    h('button', { part: 'trigger' }, 'Shipping'),
    h('div', { part: 'panel' }, 'Ships in 2 days'),
  ];

  group('keyboard', () => {
    scenario('Enter expands and collapses', async ({ mount, keyboard }) => {
      const mounted = await mount({
        template: markup,
        events: ['expandedChange'],
      });
      mounted.part('trigger').focus();

      await keyboard.press('Enter');

      expect(mounted.part('trigger').getAttribute('aria-expanded')).toBe(
        'true',
      );
      expect(mounted.part('panel').hidden).toBe(false);
      expect(mounted.state().isExpanded).toBe(true);
      expect(mounted.events).toEqual([
        { name: 'expandedChange', detail: true },
      ]);
    });
  });

  scenario('a press renders nothing', async ({ mount, pointer }) => {
    const mounted = await mount({ template: markup });
    const renders = mounted.renderCount();
    await pointer.click(mounted.part('trigger'));
    expect(mounted.state().isExpanded).toBe(true);
    expect(mounted.renderCount()).toBe(renders);
  });
});
```

- `scenario(name, run, options?)` adds a scenario; `group(name, define)`
  nests scenarios under a name.
- `options.phase` (default `1`) tags the roadmap phase whose features a
  scenario needs. A run declares the phase its adapter has reached, and later
  scenarios are skipped, not failed.
- `options.needs` lists input beyond mouse and keyboard: `'touch'` (only
  Chromium takes it; skipped elsewhere) or `'screenReader'` (runs only in a
  real-screen-reader run).
- Event names are camelCase, as in the definition (`expandedChange`); props
  are the definition's (`defaultExpanded`, `isDisabled`).

### Templates

A template is the consumer's markup, described without a framework. Each
adapter renders it its own way: React spreads part props onto the elements,
custom elements wrap them in the host.

| Helper                                   | Description                                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `h(tag, attrs?, ...children)`            | An element. `part` in `attrs` names the UniAria part; every other key is an attribute the consumer owns, with its DOM name (`class`, `for`, `aria-label`). Children are nodes or text.                                                  |
| `nested(component, props?, ...children)` | Another component inside, such as a checkbox in its group. React renders it with its own `useComponent()` inside its owner's `OwnerProvider`; custom elements wrap its children in `<uni-checkbox>`. Parts in its children are its own. |
| `rows(render)`                           | Rows rendered from the component's `renderedKeys` and `renderedSections`, as a virtualized list's consumer renders them: `rows(({ keys }) => keys.map((key) => h('div', { part: 'option', 'data-key': key }, key)))`.                   |
| `VIRTUALIZER`                            | Stands for `virtualizer` from `@uniaria/core/virtual` in a scenario's props; each adapter passes the real one.                                                                                                                          |

### The scenario context

Each scenario receives:

| Member           | Description                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mount(options)` | Mounts the suite's component through the adapter under test: `template`, `props`, and the `events` to record. Returns a `Mounted`.                  |
| `pointer`        | Real mouse input at an element's center: `down`, `up`, `move`, `moveOutside` (24 px below), `click`, `wheel`. It can hold a button while moving.    |
| `keyboard`       | Real keys to the focused element: `down`, `up`, `press`, and `tab({ isBackward })`. Key names follow Playwright: `Enter`, `Space`, `ArrowDown`.     |
| `touch`          | One finger: `down`, `move`, `moveOutside`, `up`, `tap`. Only in scenarios that declare `needs: ['touch']`.                                          |
| `spoken()`       | Reads the whole document with the virtual screen reader and returns every phrase, from `document` to `end of document`.                             |
| `listen()`       | Starts hearing live regions. The function it returns gives what they announced since, each phrase prefixed with its politeness: `assertive: Saved`. |
| `screenReader`   | A real screen reader. Only in scenarios that declare `needs: ['screenReader']`. See [real screen readers](#real-screen-readers).                    |

`Mounted` is what a scenario asserts on:

| Member                                    | Description                                                                                                                                                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`                               | The element the adapter rendered into.                                                                                                                                                                                                                          |
| `part(name = 'root')`                     | The element of a part of the mounted component, by `partSelector()`: the root by `data-uni`, a part outside the root by `data-uni-part`, any other part by `data-element` inside the root. Throws unless exactly one matches, so a missing marker fails loudly. |
| `parts(name)`                             | Every element of a part, for item parts.                                                                                                                                                                                                                        |
| `events`, `eventNames()`, `clearEvents()` | The recorded events, in order: `{ name, detail }`.                                                                                                                                                                                                              |
| `state()`                                 | What the definition's `expose()` returns now.                                                                                                                                                                                                                   |
| `setProps(props)`                         | Merges new props, the way the adapter's consumers pass them; resolves once the DOM shows them.                                                                                                                                                                  |
| `call(action)`                            | Calls one of the component's public [actions](./core.md#actions), such as `'open'`, the way the adapter's consumers do; resolves once the DOM shows the result.                                                                                                 |
| `renderCount()`                           | How many times the framework rendered the owning component. `0` for custom elements.                                                                                                                                                                            |

The runner cleans up after every scenario: it releases held buttons, keys and
fingers, unmounts, removes the container, blurs the focused element and empties
live regions.

## The mount contract

An adapter implements one function. The runner owns everything else:
containers, part lookup, the event log, input, spoken output, cleanup and
skipping.

```ts
interface ConformanceAdapter {
  readonly name: string; // 'react', 'elements'; appears in test names
  mount(request: MountRequest): Promise<AdapterMount>;
}
```

| `MountRequest`          | Description                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component`             | The definition name: `'checkbox-group'`. The adapter maps it to its definition or element.                                                                                            |
| `props`                 | The starting props, to apply the way the adapter's consumers do (React props, element properties).                                                                                    |
| `template`              | The consumer's markup, as template nodes.                                                                                                                                             |
| `events`                | The component's events to observe, camelCase.                                                                                                                                         |
| `record(event, detail)` | Call it whenever one of `events` fires: the React callback's argument, or the DOM event's `detail`. Record only this component's own events, not a nested component's that bubble up. |
| `container`             | An empty element attached to `document.body`. Render into it.                                                                                                                         |

| `AdapterMount`    | Description                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `setProps(props)` | Merges props as consumers update them. Resolves once the DOM reflects them.                                                        |
| `call(action)`    | Calls a public action the way consumers do: the React handle's `actions`, the element's method. Resolves once the DOM reflects it. |
| `state()`         | The object `expose()` returns now: `instance.getState()`.                                                                          |
| `renderCount()`   | Framework renders of the component that owns the instance, the first included; `0` without renders.                                |
| `unmount()`       | Removes everything rendered and stops the instance.                                                                                |

Attribute changes must be visible as soon as the interaction that caused them
resolves, since scenarios assert right after an awaited input. The shared
[binder](./dom.md#for-adapter-authors) writes synchronously after each flush,
so an adapter built on it gets this for free.

`renderTemplate(nodes, document, component, options?)` turns a template of
`component` into real DOM, for adapters that render plain markup. It marks
the parts as you would for the custom elements: the root with `data-uni`, a
part outside the root with `data-uni-part`, the others with `data-element`.
Its options: `outsideParts(component)` names a component's parts outside its
root (its definition's `outsideParts`), `host` creates the element for a
nested component, `rowsIn` places `rows()`, and `decorate` adds attributes
to part elements. `templateParts(nodes)` lists a template's own part
elements. `partSelector(component, part)` is a part's CSS selector: inside
the component's root, minus nested roots, or anywhere no root is around it,
as in a component rendered without its root. `partName(element, component)`
is the part an element is, if any. `isNested` and
`isRows` tell node kinds apart.

### A minimal adapter

The adapters UniAria tests itself with aren't exported. To run suites for
your own components, implement `mount` for them. This one runs any suite
whose template has no nested components or rows, through custom elements
registered with an `acme` prefix:

```ts
import { domEventName } from '@uniaria/core';
import type { AnyDefinition } from '@uniaria/core';
import type { UniElement } from '@uniaria/elements';
import { renderTemplate } from '@uniaria/testing';
import type { ConformanceAdapter } from '@uniaria/testing';

import './elements'; // defines <acme-disclosure> and the rest

export const acmeElements: ConformanceAdapter = {
  name: 'acme-elements',
  async mount({ component, props, template, events, record, container }) {
    const host = document.createElement(
      `acme-${component}`,
    ) as UniElement<AnyDefinition>;
    Object.assign(host, props);
    for (const name of events) {
      host.addEventListener(domEventName(name), (event) => {
        // Events bubble: a nested component's aren't this one's.
        if (event.target === host) record(name, (event as CustomEvent).detail);
      });
    }
    const { outsideParts = [] } = host.instance.definition;
    host.append(
      renderTemplate(template, document, component, {
        outsideParts: () => outsideParts,
      }),
    );
    container.append(host);
    return {
      async setProps(next) {
        Object.assign(host, next);
      },
      async call(action) {
        // The element's own method, as consumers call it.
        (host as unknown as Record<string, () => void>)[action]!();
      },
      state: () => host.instance.getState() as Record<string, unknown>,
      renderCount: () => 0,
      async unmount() {
        container.replaceChildren();
      },
    };
  },
};
```

## Running suites

Register the input commands in a Vitest browser project, then run the suites
against your adapter from a `*.browser.test.ts` file:

```ts
// vitest.config.ts
import { uniCommands } from '@uniaria/testing/commands';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      commands: uniCommands,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
});
```

```ts
// conformance.browser.test.ts
import { runConformance } from '@uniaria/testing/browser';

import { myAdapter } from './adapter';
import { disclosureConformance } from './disclosure.conformance';

runConformance(myAdapter, [disclosureConformance], { phase: 1 });
```

`runConformance(adapter, suites, options?)` registers one `describe` per suite
(`disclosure (my-adapter)`) and one test per scenario.

| Option         | Default     | Description                                                                                                                                       |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase`        | every phase | The highest roadmap phase the adapter implements. Later scenarios are skipped.                                                                    |
| `screenReader` | `false`     | Runs only the scenarios that need a real screen reader, with the machine's screen reader started for the file. Without it they aren't registered. |

UniAria's own suites, one per component, live in the repository's
`conformance` folder. They aren't published yet, so run them against a new
adapter from a checkout of the repository; they are how the React and
custom-element adapters are judged, and they are changed only with the
author's approval. See [Testing](../contributing/testing.md) in Contributing.

### Input in your own tests

`pointer`, `keyboard` and `touch` work in any browser test, not only in
scenarios, as long as `uniCommands` are registered. Call `releaseInput()`
after each test so a held button or key doesn't leak into the next.
`isTouchSupported()` resolves to whether the browser takes touch input
(Chromium only).

```ts
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import { afterEach, expect, it } from 'vitest';

afterEach(releaseInput);

it('keeps the press while the pointer comes back', async () => {
  const button = document.querySelector('button')!;
  await pointer.down(button);
  await pointer.moveOutside(button);
  await pointer.move(button);
  expect(button.hasAttribute('data-pressed')).toBe(true);
  await pointer.up();
});
```

### Media features

`emulateMedia()` sets media features for the whole page through Playwright,
so a test can check forced colors (Chromium only), `prefers-contrast: more`,
reduced motion or a color scheme. It needs `uniCommands` registered, and
resolves once the page has restyled, so computed styles already follow. The
page outlives a test, so end what you set: `null` ends a feature's
emulation.

```ts
import { emulateMedia } from '@uniaria/testing/browser';
import { afterEach, expect, it } from 'vitest';

afterEach(() => emulateMedia({ forcedColors: null }));

it('keeps the focus ring in forced colors', async () => {
  await emulateMedia({ forcedColors: 'active' });
  expect(matchMedia('(forced-colors: active)').matches).toBe(true);
});
```

## Spoken output

Every scenario can check what a screen reader would say, with the virtual
screen reader that runs on every push. It reads the accessibility tree the
browser exposes, so phrases follow its format: `button, Save, disabled`.

- `spoken()` in a scenario, or `spokenPhrases(container?)` from
  `@uniaria/testing/browser` in any browser test, reads from the start of the
  container (the body by default) to its end and returns every phrase.
- `listen()` hears live regions, such as the
  [announcer](./dom.md#live-announcer)'s: a region speaks only when its
  content changes after listening starts. Listening lasts until the scenario
  ends, and `spoken()` can't run meanwhile.

From NumberField's suite, where a step announces the new value:

```ts
scenario(
  'a step announces the new text',
  async ({ mount, keyboard, listen }) => {
    const mounted = await mount({
      template: h(
        'div',
        { part: 'root' },
        h('label', { part: 'label' }, 'Quantity'),
        h('input', { part: 'input' }),
      ),
      props: { defaultValue: 0 },
    });
    mounted.part('input').focus();
    const heard = await listen();
    await keyboard.press('ArrowDown');
    await expect.poll(heard).toEqual(['assertive: −1']);
  },
);
```

## Real screen readers

Scenarios that declare `needs: ['screenReader']` run against VoiceOver on
macOS or NVDA on Windows, in headed Chromium, through
[Guidepup](https://www.guidepup.dev). Keys go through the operating system,
so the screen reader hears them as a user's. Running them takes over the
machine's screen reader and keyboard, so UniAria runs them nightly in CI, not
locally.

`screenReader` in the scenario context has:

| Member               | Description                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `name`               | `'voiceover'` or `'nvda'`.                                                                                             |
| `startFrom(element)` | Clicks `element` (a text field before the component), waits for the speech, and forgets it: start from there with Tab. |
| `press(key)`         | Presses a key through the screen reader and waits until it stops speaking.                                             |
| `type(text)`         | Types text, a key per character.                                                                                       |
| `next()`             | Moves the screen reader's own cursor to the next item.                                                                 |
| `readFocus()`        | What the screen reader holds for the focused element, a check that holds when the speech on arrival is cut short.      |
| `spoken()`           | What it said since `startFrom` or the last call, each key's phrases joined with `/`.                                   |

The screen readers word things differently (`check box` in NVDA, `checkbox` in
VoiceOver), so match what you need to hear, not whole phrases:

```ts
scenario(
  'Tab reads the trigger by name, role and state',
  async ({ mount, screenReader }) => {
    const mounted = await mount({
      template: [
        h('input', { id: 'before', 'aria-label': 'Before' }),
        ...markup,
      ],
    });
    await screenReader.startFrom(
      mounted.container.querySelector<HTMLElement>('#before')!,
    );
    await screenReader.press('Tab');
    expect(await screenReader.spoken()).toMatch(/Shipping.*collapsed/);
  },
  { needs: ['screenReader'] },
);
```

To run them, register `screenReaderCommands` beside `uniCommands` in a
separate project that runs headed Chromium one file at a time, on a machine
prepared with `@guidepup/setup`, and call
`runConformance(adapter, suites, { screenReader: true })` from its test file.
