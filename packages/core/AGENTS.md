# AGENTS.md — @uniaria/core

Read the root [AGENTS.md](../../AGENTS.md) first. Local rules:

- Layers inside `src/`: `components/` → `dom/` → `runtime/`, `collections/`.
  Nothing imports upward. ESLint enforces it.
- `runtime/` and `collections/` are DOM-free: `pnpm typecheck` also compiles
  them with `tsconfig.core.json`, which has no DOM lib. Host globals they may
  use are listed in `types/host.d.ts` (owner approval to extend).
- No framework imports anywhere in this package.
- `dom/` holds what both adapters share: the DOM binder that writes part
  attributes after mount (and delegates a custom-element host's listeners
  from its root), part discovery for elements, and later the owner lookup (request
  events, id references). Adapters never diff attributes or search the DOM
  themselves. It also holds the interactions definitions build on
  (`createPress`, `createFocus` with focus-visible, `createHover`), the
  shared input-modality tracker, and `warn()` for development warnings.
- Before building or changing an interaction, read its section of
  `docs/interaction-layer.md` (behaviours, browser bugs, where UniAria differs)
  and update the status there.
- Interactions take the `setup()` context (`InteractionContext`), keep their
  state in `ctx.state()`, clean up through `ctx.effect()`, and batch any
  document listener they add (`ctx.batch()`), since only part handlers are
  batched for them.
- Anything that needs a part element goes through `partEffect()`, never a
  `ctx.effect()` that reads the element once: a custom element connects
  before the parser adds its children, so parts often attach after
  `start()`. Several interactions on one part combine with
  `mergeHandlers()`; spreading handler objects drops handlers. An item
  part's elements come and go with the rows a list renders: anything that
  needs one goes through `ctx.itemEffect()`, which runs per key as each
  attaches.
- `src/virtual/` is the `./virtual` entry: the only code that imports
  `@tanstack/virtual-core`, which the build bundles into it. Everything else
  sees the engine through the `Virtualizer` interface in `dom/virtual.ts`.
- A new subpath needs three edits: an entry in `tsdown.config.ts`, an
  `exports` entry in `package.json` (with the `uniaria-source` condition first),
  and a line in `src/ssr-safety.test.ts`.
- Each component folder holds `spec.md` (approved before code), the
  definition, its `index.ts` and its tests. Composite components compose other
  definitions with `ctx.use()` instead of duplicating them.
- Runtime dependencies come only from the approved list in the root
  AGENTS.md.
