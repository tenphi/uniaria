import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defaultExclude, defineConfig } from 'vitest/config';

import { uniCommands } from './packages/testing/src/commands';

/**
 * Two projects, split by file name:
 *
 * - `node` — `*.test.ts(x)`. Pure logic with no DOM: the runtime, collections,
 *   component definitions driven through test instances, SSR-safety checks.
 *   A DOM access here fails loudly with `document is not defined`.
 * - `browser` — `*.browser.test.ts(x)`. Anything that renders, touches the
 *   DOM, moves focus or listens to a screen reader. Runs in real Chromium,
 *   Firefox and WebKit through Playwright. `uniCommands` give tests real
 *   mouse and keyboard input that can hold a button or key
 *   (`@uniaria/testing/browser`).
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
          exclude: [...defaultExclude, '**/*.browser.test.{ts,tsx}'],
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
            commands: uniCommands,
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
    ],
  },
});
