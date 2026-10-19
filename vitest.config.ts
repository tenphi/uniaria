import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defaultExclude, defineConfig } from 'vitest/config';

import {
  screenReaderCommands,
  uniCommands,
} from './packages/testing/src/commands';
import { stylesCommands } from './packages/styles/src/testing/commands';

/**
 * Two projects, split by file name, and a third for real screen readers:
 *
 * - `node` — `*.test.ts(x)`. Pure logic with no DOM: the runtime, collections,
 *   component definitions driven through test instances, SSR-safety checks.
 *   A DOM access here fails loudly with `document is not defined`.
 * - `browser` — `*.browser.test.ts(x)`. Anything that renders, touches the
 *   DOM, moves focus or listens to a screen reader. Runs in real Chromium,
 *   Firefox and WebKit through Playwright. `uniCommands` give tests real
 *   mouse and keyboard input that can hold a button or key
 *   (`@uniaria/testing/browser`).
 * - `screen-readers` — `*.screen-reader.test.ts(x)`: the scenarios that need
 *   VoiceOver (macOS) or NVDA (Windows), driven through Guidepup in headed
 *   Chromium, one file at a time. It takes over the machine's screen reader
 *   and keyboard, so it exists only when `UNIARIA_SCREEN_READERS` is set:
 *   nightly in CI (.github/workflows/screen-readers.yml), on runners
 *   prepared by `@guidepup/setup`.
 *
 * Workspace packages resolve each other's `src/` through the `uniaria-source`
 * export condition, so tests never need a build first.
 */
export default defineConfig({
  resolve: { conditions: ['uniaria-source', ...defaultClientConditions] },
  ssr: {
    resolve: { conditions: ['uniaria-source', ...defaultServerConditions] },
  },
  // Reference repos are large and read-only; watching them wastes file handles.
  server: { watch: { ignored: ['**/references/**', '**/specs/**'] } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/*/src/**/*.test.{ts,tsx}',
            'conformance/src/**/*.test.{ts,tsx}',
          ],
          exclude: [
            ...defaultExclude,
            '**/*.browser.test.{ts,tsx}',
            '**/*.screen-reader.test.{ts,tsx}',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: [
            'packages/*/src/**/*.browser.test.{ts,tsx}',
            'conformance/src/**/*.browser.test.{ts,tsx}',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            screenshotFailures: false,
            // `stylesCommands` build `@uniaria/styles`' CSS in Node.
            commands: { ...uniCommands, ...stylesCommands },
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
      ...(process.env.UNIARIA_SCREEN_READERS
        ? [
            {
              extends: true,
              test: {
                name: 'screen-readers',
                include: ['packages/*/src/**/*.screen-reader.test.{ts,tsx}'],
                // One screen reader per machine, started once per file.
                fileParallelism: false,
                // A screen reader that falls behind now and then.
                retry: 1,
                testTimeout: 120_000,
                hookTimeout: 300_000,
                browser: {
                  enabled: true,
                  // Screen readers don't read headless browsers.
                  headless: false,
                  ui: false,
                  provider: playwright(),
                  screenshotFailures: false,
                  commands: { ...uniCommands, ...screenReaderCommands },
                  instances: [{ browser: 'chromium' as const }],
                },
              },
            },
          ]
        : []),
    ],
  },
});
