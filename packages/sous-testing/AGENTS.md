# AGENTS.md — @tenphi/sous-testing

Read the root [AGENTS.md](../../AGENTS.md) first, especially "The mount
contract". Local rules:

- Three entries:
  - `.` is safe anywhere, including the `node` project: templates (`h`), the
    contract types and `defineConformance`. Driving a definition without a
    framework needs nothing from here: `createInstance` is in the runtime.
  - `./browser` runs suites (`runConformance`) and holds real input and
    spoken output. Browser tests only.
  - `./commands` holds the Node-side Playwright commands (`sousCommands`),
    registered in the browser project of `vitest.config.ts`.
- The runner owns everything adapter-neutral: containers, part lookup, the
  event log, input, spoken output, cleanup and phase skipping. Adapters only
  render, apply props, report events and expose state.
- Real input goes through Playwright, never synthetic `dispatchEvent`, so
  scenarios see the browser's own event sequences.
- `src/conformance/run.browser.test.ts` checks the runner against a plain-DOM
  fixture adapter in every browser. Keep it passing; every adapter's
  conformance run depends on it.
- Screen-reader helpers wrap `@guidepup/virtual-screen-reader` (every push)
  and, later, `@guidepup/guidepup` with `@guidepup/playwright` (nightly).
  These are the only screen-reader dependencies; MCP kits stay out of the
  repo.
