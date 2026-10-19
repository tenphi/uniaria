---
title: Documentation
description: How this site is built, and how to write a component page with a live demo.
---

This site is built with [Cookbook](https://cookbook.tenphi.me), an Astro
documentation toolkit. The pages are Markdown and MDX files in the
repository's `docs/` folder, next to the code they describe; the app that
builds them is `apps/docs/`.

## How the site is built

`apps/docs` is a private workspace package, `@uniaria/docs`, that needs Node
22.19 or later. Its files:

| File                     | What it does                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `astro.config.ts`        | An Astro config with one integration, `cookbook()`.                                                                                                              |
| `docs.config.ts`         | The site: `root: '../..'` (the repository), the title, description and repository link, edit links to `main`, the content sources, the navigation and the theme. |
| `tasty.config.ts`        | What the Tasty ESLint rules accept: Cookbook's tokens, units, states and presets, plus whatever the site's theme adds.                                           |
| `demo/<page>.ts`         | One bundle entry per component page, importing the element entries its demos use.                                                                                |
| `scripts/build-demo.mjs` | Builds those entries into `public/demo/<page>.js`.                                                                                                               |
| `public/demo/`           | The built demo bundles. Generated, gitignored, and skipped by ESLint and Prettier.                                                                               |

`docs.config.ts` reads every `docs/**/*.{md,mdx}` file with `base: 'docs'`,
so a file's route is its path under `docs/` without the extension:
`docs/guide/state.md` is `/guide/state`, and an `index.md` or `index.mdx` is
its folder's route. Files and folders whose names begin with `_` are left
out, so **`docs/_internal/` is never published**: it holds the component
spec template and `interaction-layer.md`, which are for contributors only.

`navigation.tabs` in `docs.config.ts` defines the four tabs, Guide,
Components, API and Contributing. Each tab has a `label`, a `link` and
`items`: routes, or `{ label, items }` groups that become sidebar sections.
A new page needs an entry there to appear in the sidebar.

## Pages

- **Frontmatter.** Every page has a `title`, which the sidebar shows, and a
  one-line `description`.
- **`.md` or `.mdx`.** A page that imports components (`Preview`, `Tabs`,
  `Tab`, `Callout`, `Card` from `@tenphi/cookbook/components`) is `.mdx`;
  everything else is plain `.md`.
- **Links.** Link to another page by its relative file path, such as
  `../guide/state.md` or `./tooltip.mdx`. Cookbook rewrites the link to the
  page's route and checks it, heading fragments included. Link to files
  outside `docs/`, such as `AGENTS.md` or source code, by their GitHub URL,
  as this section does.
- **Diagrams.** Cookbook renders `mermaid` code fences as SVG at build time.
  Give each diagram an `accTitle` and an `accDescr`, which become its
  accessible name and description. A node keeps the first label it is given,
  so declare labeled nodes before the edges that use them. An invalid diagram
  stays on the page as source code, so check the built page.
- **Style.** Plain, concise American English: short sentences, present
  tense, active voice, sentence-case headings, code identifiers in
  backticks, tables for reference material. Pages in Guide, Components and
  API are for developers using UniAria: no internal names (the store, the
  binder, `connect()`, `ctx`) unless the page is about internals, and no
  owner decisions or dates.

MDX has a few traps:

- In prose, `{`, `}` and `<` start expressions and elements: keep them
  inside backticks or code fences.
- Escape `|` inside a table cell as `\|`.
- Inside a `<Tab>`, keep a blank line before and after each code fence.

## Component pages

[Button](../components/button.mdx) is the model, with its demo in
`docs/components/demos/button.{html,css,js}` and its bundle entry
`apps/docs/demo/button.ts`. A component page has these sections, in this
order, skipping any that don't apply:

1. **Frontmatter:** the component's name as `title`, and a one-line
   `description`.
2. **Intro:** what the component is and does, the native element underneath,
   and the WAI-ARIA Authoring Practices pattern it follows, linked.
3. **The live demo**, right after the intro.
4. **Usage:** `<Tabs label="Usage">` with a React tab and an HTML tab, each a
   realistic, complete and minimal example. Then a subsection for each
   important variant or recipe, with both tabs where both help.
5. **Anatomy:** a table of Part, Element and Notes. Say which parts are
   optional, which are item parts and how items are keyed, and which parts
   the component fills itself.
6. **Props:** Prop, Attribute (`—` with a reason when there is none), Type,
   Default and Description. Show a bindable value as its
   `value`/`defaultValue`-style pair and its change event.
7. **Events:** the DOM event name, the React prop, the detail, and when it
   fires.
8. **State:** the public state, and how to read it in React
   (`useComponentState`) and on the element (`element.instance.getState()`).
9. **Styling:** every data attribute and when it is present, the CSS custom
   properties UniAria writes, and any style UniAria sets inline for a
   behavior.
10. **Keyboard:** a table of Key and Behavior.
11. **Accessibility:** focus management, what screen readers announce, live
    announcements, labelling requirements and pitfalls.
12. **Compared with other libraries:** the differences from React Aria, the
    APG, native elements or Zag that someone migrating would notice. Short.

Every prop, attribute, event, part, state field, data attribute, CSS
variable, key and code sample must match the implementation. The sources of
truth, in order: the code (the definition in
`packages/core/src/components/<name>/`, the element entry in
`packages/elements/src/<name>.ts`, the adapters), then the approved
`spec.md` next to the definition, then the conformance scenarios in
`conformance/src/<name>/`. When the spec and the code disagree, the page
documents the code, and the disagreement is reported to the owner.

## Live demos

A component page has one live demo, two at most when a second variant
matters. It shows the component's real behavior with the custom elements,
and looks right in light and dark mode.

**The demo files** are `docs/components/demos/<page>.html`, `<page>.css` and,
only when the demo needs it, `<page>.js`; a second demo uses
`<page>-<variant>.*`. The page imports them as strings with Vite's `?raw`
suffix and passes them to Cookbook's `Preview`:

```mdx
import { Preview } from '@tenphi/cookbook/components';

import css from './demos/button.css?raw';
import html from './demos/button.html?raw';
import javascript from './demos/button.js?raw';

<Preview
  title="Buttons"
  scripts={['/demo/button.js']}
  html={html}
  css={css}
  javascript={javascript}
/>
```

The CSS is self-contained and small, since it doubles as a styling example:
`color-scheme: light dark`, system colors (`Canvas`, `CanvasText`,
`GrayText`, `Highlight`, `color-mix(in srgb, …)`), the root selected by `data-uni` (`[data-uni='checkbox']`), the other parts
by `data-element` inside it, a part outside the root by `data-uni-part`
(`[data-uni-part='popover-trigger']`), and state attributes. Start from the Button demo's `:root` and `body` rules. No
external resources and no frameworks. The JavaScript does only what the demo
needs to show, such as logging events into an `<output>`, in plain modern
browser JavaScript; ESLint checks `docs/**/*.js` with browser globals.

**The bundle** gives the demo its elements. `apps/docs/demo/<page>.ts`
imports the element entries the page's demos register, such as
`import '@uniaria/elements/dialog'` and `import '@uniaria/elements/button'`
for a Dialog demo with a Button inside. `apps/docs/scripts/build-demo.mjs`
builds each entry with Vite into `apps/docs/public/demo/<page>.js`:

- one classic script per page, with its own copy of the runtime, since each
  demo runs in a sandboxed frame of its own;
- built from the workspace sources through the `uniaria-source` export
  condition, so the site needs no package build;
- with `process.env.NODE_ENV` set to `"production"`.

```sh
pnpm -C apps/docs demo button dialog   # rebuild the named pages' bundles
pnpm -C apps/docs demo                 # rebuild every bundle
```

`dev` and `build` rebuild every bundle first. During `dev`, rebuild a page's
bundle after you change its entry or the component behind it.

**`Preview`'s `scripts` prop** names bundles in `apps/docs/public/` to inline
into the preview's sandboxed frame. Inlining keeps the frame's opaque origin, so a demo can't reach
the documentation page. It also works on `localhost`: Chrome blocks a
sandboxed frame from loading scripts from a local address, so a `<script
src>` pointing at the dev server would fail there.

## Styling the site

Cookbook's rules allow only [Tasty](https://tasty.style) for the site's
interface: no CSS files, CSS modules, Astro `<style>` blocks or inline
styles. The site's look comes from the theme in
`docs.config.ts`, which today sets only the brand color (`theme.brand`).
Change a built-in surface with a partial Tasty object in `theme.styles`, and
style a custom component with `defineComponent()` or `tasty()` from
`@tenphi/cookbook/styling`. Cookbook's guides ship in the package, under
`node_modules/@tenphi/cookbook/docs/`; read `customization-rules.md` first.
The CSS inside a `Preview` frame is the demo's and is separate.

ESLint checks the Tasty styles in `apps/docs/**/*.{ts,tsx}` with the strict
rules of `@tenphi/eslint-plugin-tasty` (configured in the root
`eslint.config.js`). The rules check every token, unit, state and preset
against `apps/docs/tasty.config.ts`, which builds its list from Cookbook's
defaults and the site's theme with `createValidationConfig(docs.theme)`, so
a name the theme adds is accepted as soon as the theme declares it.

## Commands

Run these from the repository root:

| Command                           | What it does                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm -C apps/docs dev`           | Builds every demo bundle, then starts Astro's dev server.                                                                               |
| `pnpm -C apps/docs build`         | Builds every demo bundle, then the static site into `apps/docs/dist/`.                                                                  |
| `pnpm -C apps/docs preview`       | Serves the built site. Search works only here: the dev server has no search index.                                                      |
| `pnpm -C apps/docs validate`      | Type-checks the app, runs `cookbook doctor` (configuration, links, navigation), builds, then runs `cookbook check-build` on the output. |
| `pnpm -C apps/docs demo [page …]` | Rebuilds the demo bundles of the named pages, or all of them.                                                                           |
| `pnpm -C apps/docs doctor`        | Only `cookbook doctor`.                                                                                                                 |
| `pnpm -C apps/docs typecheck`     | Only the type check.                                                                                                                    |

The root `pnpm lint`, `pnpm format:check` and `pnpm typecheck` cover the
pages, the demo files and the app. CI's `docs` job also runs `validate` on
every push, so run it before you push a change to the site.
