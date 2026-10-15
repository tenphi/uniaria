/**
 * Times the buttons in `../src/compare/buttons` in a production build, in
 * Chromium, with real input (owner request, 2026-10-15). Run with
 * `pnpm bench` from the repo root; it prints a table and writes
 * `bench/results.md`.
 *
 * Each run opens a fresh page per implementation (the order rotates between
 * runs), mounts a grid of buttons and drives it:
 *
 * - mount, a parent render that disables every button and one that enables
 *   them, and unmount: timed in the page around `flushSync`;
 * - a hover sweep, clicks and Tab presses through Playwright's mouse and
 *   keyboard: main-thread time from DevTools' `Performance.getMetrics`;
 * - the JS heap after mounting, after a forced garbage collection.
 *
 * Bundle sizes come from a separate minified build of each button with React
 * left out.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { chromium } from 'playwright';
import type { Browser, CDPSession, Page } from 'playwright';
import * as prettier from 'prettier';
import { build, defaultClientConditions, preview } from 'vite';

import type { Implementation } from '../src/compare/buttons';
import type { Bench } from './main';

declare global {
  interface Window {
    bench: Bench;
  }
}

const COUNT = Number(process.env.BENCH_COUNT ?? 1000);
const INTERACTIONS = Number(process.env.BENCH_INTERACTIONS ?? 200);
const RUNS = Number(process.env.BENCH_RUNS ?? 7);

const IMPLEMENTATIONS: readonly Implementation[] = [
  'plain',
  'aria',
  'sous',
  'sousShared',
];

const LABELS: Record<Implementation, string> = {
  plain: 'Plain button',
  aria: 'React Aria',
  sous: 'Sous',
  sousShared: 'Sous, state read',
};

const benchDir = import.meta.dirname;
const config = join(benchDir, 'vite.config.ts');

interface Sample {
  /** Time measured in the page around the update, in ms. */
  readonly inPage: number;
  /** Main-thread task time, in ms. */
  readonly task: number;
  /** JavaScript time, in ms. */
  readonly script: number;
  readonly renders: number;
}

type Scenario =
  'mount' | 'hover' | 'click' | 'tab' | 'disable' | 'enable' | 'unmount';

const samples = new Map<string, Sample[]>();
const heap = new Map<Implementation, number[]>();

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  const result = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(
    result.metrics.map((metric) => [metric.name, metric.value]),
  );
}

async function measure(
  page: Page,
  cdp: CDPSession,
  action: () => Promise<number | void>,
): Promise<Sample> {
  await page.evaluate(() => window.bench.settle());
  const before = await metrics(cdp);
  const rendersBefore = await page.evaluate(() => window.bench.renders());
  const inPage = (await action()) ?? Number.NaN;
  await page.evaluate(() => window.bench.settle());
  const after = await metrics(cdp);
  const rendersAfter = await page.evaluate(() => window.bench.renders());
  const delta = (name: string) => (after[name]! - before[name]!) * 1000;
  return {
    inPage,
    task: delta('TaskDuration'),
    script: delta('ScriptDuration'),
    renders: rendersAfter - rendersBefore,
  };
}

async function usedHeap(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  return (await metrics(cdp)).JSHeapUsedSize!;
}

async function runOnce(
  browser: Browser,
  url: string,
  implementation: Implementation,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(url);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const record = (scenario: Scenario, sample: Sample) =>
    push(samples, `${scenario}:${implementation}`, sample);

  const emptyHeap = await usedHeap(cdp);
  record(
    'mount',
    await measure(page, cdp, () =>
      page.evaluate(([which, count]) => window.bench.mount(which, count), [
        implementation,
        COUNT,
      ] as const),
    ),
  );
  push(heap, implementation, (await usedHeap(cdp)) - emptyHeap);

  const centers = await page.evaluate(
    (count) => window.bench.centers(count),
    INTERACTIONS,
  );
  record(
    'hover',
    await measure(page, cdp, async () => {
      for (const { x, y } of centers) await page.mouse.move(x, y);
      await page.mouse.move(4, 890);
    }),
  );
  const clicks = centers.slice(0, INTERACTIONS / 2);
  const pressesBefore = await page.evaluate(() => window.bench.presses());
  record(
    'click',
    await measure(page, cdp, async () => {
      for (const { x, y } of clicks) await page.mouse.click(x, y);
      await page.mouse.move(4, 890);
    }),
  );
  const presses =
    (await page.evaluate(() => window.bench.presses())) - pressesBefore;
  if (presses !== clicks.length) {
    throw new Error(
      `${implementation}: ${presses} presses for ${clicks.length} clicks`,
    );
  }
  record(
    'tab',
    await measure(page, cdp, async () => {
      for (let index = 0; index < INTERACTIONS; index++) {
        await page.keyboard.press('Tab');
      }
    }),
  );
  record(
    'disable',
    await measure(page, cdp, () =>
      page.evaluate(() => window.bench.setDisabled(true)),
    ),
  );
  record(
    'enable',
    await measure(page, cdp, () =>
      page.evaluate(() => window.bench.setDisabled(false)),
    ),
  );
  record(
    'unmount',
    await measure(page, cdp, () => page.evaluate(() => window.bench.unmount())),
  );
  await context.close();
}

interface Size {
  readonly minified: number;
  readonly gzip: number;
  readonly brotli: number;
}

/** One button's code, minified, with React left out. */
async function bundleSize(implementation: Implementation): Promise<Size> {
  const result = await build({
    configFile: false,
    root: benchDir,
    logLevel: 'silent',
    resolve: { conditions: ['sous-source', ...defaultClientConditions] },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: true,
      lib: {
        entry: join(benchDir, 'size', `${implementation}.ts`),
        formats: ['es'],
      },
      rolldownOptions: {
        external: (id) => /^react(-dom)?($|\/)/.test(id),
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  let code = '';
  for (const output of outputs) {
    if (!('output' in output)) continue;
    for (const chunk of output.output) {
      if (chunk.type === 'chunk') code += chunk.code;
    }
  }
  return {
    minified: Buffer.byteLength(code),
    gzip: gzipSync(code, { level: 9 }).length,
    brotli: brotliCompressSync(code).length,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  return sorted.length % 2
    ? sorted[Math.floor(middle)]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const format = (value: number, digits = 1) => value.toFixed(digits);

function versionOf(name: string): string {
  const path = join(benchDir, '..', 'node_modules', name, 'package.json');
  return (JSON.parse(readFileSync(path, 'utf8')) as { version: string })
    .version;
}

function table(
  rows: readonly (readonly [
    string,
    (implementation: Implementation) => string,
  ])[],
): string {
  const header = ['', ...IMPLEMENTATIONS.map((which) => LABELS[which])];
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map((_, index) => (index ? '---:' : '---')).join(' | ')} |`,
  ];
  for (const [label, cell] of rows) {
    lines.push(`| ${[label, ...IMPLEMENTATIONS.map(cell)].join(' | ')} |`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  await build({ configFile: config, mode: 'production' });
  const server = await preview({
    configFile: config,
    preview: { port: 4179, strictPort: false },
  });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('The preview server has no URL.');
  const browser = await chromium.launch();
  const browserVersion = browser.version();
  try {
    for (let run = 0; run < RUNS; run++) {
      const order = IMPLEMENTATIONS.map(
        (_, index) => IMPLEMENTATIONS[(index + run) % IMPLEMENTATIONS.length]!,
      );
      for (const implementation of order) {
        await runOnce(browser, url, implementation);
      }
      console.log(`Run ${run + 1} of ${RUNS} done.`);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const sizes = new Map<Implementation, Size>();
  for (const implementation of IMPLEMENTATIONS) {
    sizes.set(implementation, await bundleSize(implementation));
  }

  const stat =
    (scenario: Scenario, field: keyof Sample, digits = 1) =>
    (implementation: Implementation) =>
      format(
        median(
          samples
            .get(`${scenario}:${implementation}`)!
            .map((sample) => sample[field]),
        ),
        digits,
      );

  const timings = table([
    [`Mount ${COUNT} (ms, in page)`, stat('mount', 'inPage')],
    [`Mount ${COUNT} (ms, main thread)`, stat('mount', 'task')],
    [
      'JS heap after mount (MB)',
      (which) => format(median(heap.get(which)!) / 2 ** 20),
    ],
    [`Hover ${INTERACTIONS} buttons (ms, main thread)`, stat('hover', 'task')],
    [`Hover ${INTERACTIONS} buttons (ms, script)`, stat('hover', 'script')],
    [
      `Click ${INTERACTIONS / 2} buttons (ms, main thread)`,
      stat('click', 'task'),
    ],
    [`Click ${INTERACTIONS / 2} buttons (ms, script)`, stat('click', 'script')],
    [`Tab ${INTERACTIONS} times (ms, main thread)`, stat('tab', 'task')],
    [`Tab ${INTERACTIONS} times (ms, script)`, stat('tab', 'script')],
    [`Disable all ${COUNT} (ms, in page)`, stat('disable', 'inPage')],
    [`Enable all ${COUNT} (ms, in page)`, stat('enable', 'inPage')],
    [`Unmount ${COUNT} (ms, in page)`, stat('unmount', 'inPage')],
  ]);
  const renderCounts = table(
    (['hover', 'click', 'tab', 'disable'] as const).map(
      (scenario) => [scenario, stat(scenario, 'renders', 0)] as const,
    ),
  );
  const sizeTable = table([
    ['Minified (kB)', (which) => format(sizes.get(which)!.minified / 1000)],
    ['gzip (kB)', (which) => format(sizes.get(which)!.gzip / 1000)],
    ['brotli (kB)', (which) => format(sizes.get(which)!.brotli / 1000)],
  ]);

  const report = `# Button: Sous against React Aria

Generated by \`pnpm bench\` on ${new Date().toISOString().slice(0, 10)}.

- ${cpus()[0]?.model ?? 'Unknown CPU'}, ${platform()} ${release()}
- Headless Chromium ${browserVersion}
- React ${versionOf('react')}, react-aria ${versionOf('react-aria')}
- Production builds; medians of ${RUNS} runs, each on a fresh page with ${COUNT} buttons

Lower is better. Main-thread time is DevTools' \`TaskDuration\`: it includes
the browser's own input handling and style work, so the plain button is the
floor.

## Timings

${timings}

## Renders

${renderCounts}

## Bundle size

Each button alone, React excluded.

${sizeTable}
`;
  const file = join(benchDir, 'results.md');
  const formatted = await prettier.format(report, {
    ...(await prettier.resolveConfig(file)),
    filepath: file,
  });
  writeFileSync(file, formatted);
  console.log(`\n${formatted}`);
}

await main();
