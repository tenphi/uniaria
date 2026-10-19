# AGENTS.md — @uniaria/styles

Read the root [AGENTS.md](../../AGENTS.md) first, then this package's
[spec](./spec.md), which is approved and binding. Local rules:

- Optional default styles. Nothing in the other packages imports this one,
  and it imports no framework or component code: from `@tenphi/tasty`, its
  source takes types only, and values from `@tenphi/tasty/zero` alone,
  which runs in Node without React. Tests may import the components and the
  adapters. `eslint.config.js` enforces both.
- Styles read only what UniAria writes: part markers, state attributes and
  the consumer's `data-variant`. A component's style object styles only the
  parts of its definition, every state is one UniAria writes or an alias in
  `src/tokens.ts`, and every rule stays flat (a root (0,1,0), a part
  (0,2,0)). `src/source.test.ts` checks all three.
- Style objects pass the Tasty plugin's strict rules against
  `tasty.config.ts`; a disable comment says why. Colors are `#uni-*` tokens
  from `src/palette/`, system colors `#uni-system-*` tokens, sizes `$uni-*`
  tokens, never literals. Motion is transitions only (spec: Web platform
  baseline).
- Cube UI Kit (`references/cube-ui-kit`, `src/tokens/` and
  `src/data/item-themes.ts`) is the reference for paddings, gaps, sizes,
  type and color tones, not hues (spec: Resolved questions 9). Where it
  falls below a contrast floor, the floor wins; say so in the source.
- A palette change keeps every contrast floor in the spec's Tokens table:
  `createPalette()` must not make Glaze warn, and
  `src/contrast.browser.test.ts` must pass in every engine.
- The built CSS is compared byte for byte with `src/__snapshots__/`. After
  a deliberate change, update them with
  `pnpm vitest run --project node packages/styles -u` and read the diff.
- The build's `build:done` hook imports the built `dist/generate.js`, so
  `generate` stays a tsdown entry, though not an export.
- Never commit probe files; delete them before committing.
