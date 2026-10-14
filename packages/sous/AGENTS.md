# AGENTS.md — @tenphi/sous

Read the root [AGENTS.md](../../AGENTS.md) first. Local rules:

- Layers inside `src/`: `components/` → `dom/` → `runtime/`, `collections/`.
  Nothing imports upward. ESLint enforces it.
- `runtime/` and `collections/` are DOM-free: `pnpm typecheck` also compiles
  them with `tsconfig.core.json`, which has no DOM lib. Host globals they may
  use are listed in `types/host.d.ts` (owner approval to extend).
- No framework imports anywhere in this package.
- `dom/` holds the DOM binder both adapters use to write part attributes
  after mount; adapters never diff attributes themselves.
- A new subpath needs three edits: an entry in `tsdown.config.ts`, an
  `exports` entry in `package.json` (with the `sous-source` condition first),
  and a line in `src/ssr-safety.test.ts`.
- Each component folder holds `spec.md` (approved before code), the
  definition, its `index.ts` and its tests. Composite components compose other
  definitions with `ctx.use()` instead of duplicating them.
- Runtime dependencies come only from the approved list in the root
  AGENTS.md.
