# @uniaria/testing

How UniAria checks that a component behaves the same in every adapter. A
component's behavior is described once, as a conformance suite of scenarios
that mount it, drive it with real mouse, keyboard and touch input, and check
the DOM, focus, events, state and what a screen reader says. Each adapter
implements one `mount` function, and every suite runs against it in Chromium,
Firefox and WebKit.

Use it to write an adapter for another framework and prove it with the suites
the React and custom-element adapters pass, or to test components of your own
with real input and spoken output.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add -D @uniaria/testing vitest @vitest/browser-playwright
```

It needs Vitest 5 in browser mode with the Playwright provider. Real screen
readers need [`@guidepup/guidepup`](https://www.guidepup.dev), an optional
peer.

| Entry                       | Runs in                     | Has                                                                  |
| --------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `@uniaria/testing`          | Anywhere, Node included     | `defineConformance`, the markup templates and the contract types     |
| `@uniaria/testing/browser`  | Vitest browser mode         | `runConformance`, real input, `emulateMedia` and `spokenPhrases`     |
| `@uniaria/testing/commands` | Node, in your Vitest config | `uniCommands` and `screenReaderCommands`, the Node side of the above |

## Documentation

The [Testing API](https://github.com/tenphi/uniaria/blob/main/docs/api/testing.md)
page, in the repository's
[`docs`](https://github.com/tenphi/uniaria/tree/main/docs) folder.

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
