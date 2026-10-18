# Listbox virtualization spec

Status: approved by @tenphi on 2026-10-18

## Summary

A virtualized list renders only the options in and near its scrolled view:
a few dozen elements stand in for thousands of items, and the rest exist as
data until they scroll in. Listbox deferred it to this spec (Listbox spec,
Resolved questions 12); Select and Combobox, which compose Listbox, get it
through their list.

Nothing about the list changes for the user. The keys, selection,
typeahead, focus and spoken output are Listbox's, Select's and Combobox's,
with every option reachable as if it were rendered: moving to an option
outside the view renders it, scrolls it in and focuses or highlights it,
and each option says where it sits in the whole list (`aria-posinset`,
`aria-setsize`), which the APG requires once not every option is in the
DOM. What changes is the consumer's markup: it renders the keys UniAria
lists (`renderedKeys`) instead of every item, inside a new `scroller` part,
and UniAria positions the rows.

Cube Cloud needs it. Its long lists today: Slack channels (up to 5,000),
every user of a tenant (unbounded), about 400 time zones, Git branches,
distinct dimension values, and the whole data model's members in sectioned
pickers, which Cube UI Kit can't virtualize because they have sections
(research: `scratchpad/virtualization/ui-kit.md` §9).

Cube UI Kit's ListBox is the model only in what it does (every flat list is
virtualized with TanStack's `@tanstack/react-virtual`); how it does it is
where most of its bugs are (Mapping from Cube UI Kit). React Aria's
virtualizer is the reference for behavior (it keeps the focused option
rendered, numbers options, scrolls by layout), and
`@tanstack/virtual-core`, which root AGENTS.md approves "if it fits", is the
engine (Resolved questions 2).

- **WAI-ARIA pattern:** [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/):
  "If the complete set of available options is not present in the DOM due to
  dynamic loading as the user scrolls, `aria-setsize` and `aria-posinset` are
  set on each option"
  (`references/aria-practices/content/patterns/listbox/listbox-pattern.html:229`).
- **Builds on:** Listbox, which gains the props, part and state below; Select
  and Combobox, which forward them to their list; `@tanstack/virtual-core`
  behind a small interface, imported only by lists that virtualize (Resolved
  questions 1 and 2). New in the runtime: an effect per item element and
  `connect()` re-run when an item element comes or goes (Runtime and
  harness changes).
- **Owner:** none.
- **Custom element:** yes, with `items` set as a property: the markup can't
  hold the items, because only the rendered ones are in it. The consumer
  renders the rows when the element reports new `renderedKeys` (Resolved
  questions 8).

Not part of virtualization:

- **Loading more** (`onLoadMore`, a loading row, `aria-busy`): an async
  collections spec, with Combobox's server filtering. No Cloud dropdown loads
  more today (Resolved questions 10).
- **Sticky group labels.** The consumer's CSS: a group is a box as tall as
  its section, so `position: sticky` on its label works (Layout).
- **The popup's width.** Absolutely positioned rows have no intrinsic width,
  so the list takes its width from its container. Select's and Combobox's
  popovers already size to their anchor; a list sized to its content can't
  be virtualized.
- **Smooth scrolling, scroll restoration, lists anchored to the end (chat,
  logs), grids and masonry** (`lanes`).
- **Lists past the browser's element height**, about 17.9 million px in
  Firefox: a million 32 px rows. Not verified here; UniAria doesn't scale
  positions down.

## How it works

A virtualized Listbox keeps a **rendered set**: the options in the
scroller's view, `overscan` options beyond each edge, and the pinned
options, sorted by their position in the list, so the DOM order is the list
order. The rendered set changes when the view scrolls past an option, the
scroller is resized, the items change or a pin changes; nothing else
changes it (a highlight or a selection that moves within it, hover, a
press).

**Pinned options** stay rendered wherever the view is:

| Pin                    | Why                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| the focused option     | DOM focus on an option that unmounts falls to `<body>` (roving focus).                            |
| the tab stop           | Tab enters the list at it; the list is `tabindex="-1"` while an option is the tab stop.           |
| the highlighted option | `aria-activedescendant` must name an element in the document (virtual focus, Combobox).           |
| the pressed option     | A press in progress ends with its element: a wheel scroll with the button held mustn't cancel it. |
| the target of a move   | The option a key, typeahead or the api moves to, until it has focus or the highlight (Focus).     |

With groups, the group holding a rendered option is rendered too, with its
label (Groups).

**Geometry is UniAria's, never the consumer's render.** UniAria computes
where each row starts from the item sizes (Sizes) and writes it on the
row's element through the binder: scrolling within the rendered set, a
measured row changing size, or a pin that is already rendered re-renders
nothing. Only a change of the rendered set reaches the consumer, as public
state (`renderedKeys`, `renderedSections`) and an event.

**Before the scroller has a size** (on the server, under jsdom, in a popover
that hasn't opened), the rendered set is the first `initialItemCount`
options plus the pins (Resolved questions 7). So the server renders the top of
the list, and tests see options without mocking a viewport.

## Anatomy

Listbox gains one named part:

| Part     | Element            | Attributes UniAria owns                                            | Notes                                                                                                                                                                                                            |
| -------- | ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scroller | any; usually `div` | `tabindex="-1"`, `data-virtualized`; style `overflow-anchor: none` | The element that scrolls, around the list. Required when virtualized, ignored otherwise. Its size is the view; its CSS gives it a height or a max height and `overflow: auto`. `tabindex` and the style: Layout. |

The list and the item parts are Listbox's, with what Layout writes on them.
Select and Combobox expose `scroller` too, mapped to their list's; it goes
inside the popover, around the list.

## Props

On Listbox; Select and Combobox forward each to their list.

| Prop               | Type                                  | Default     | Bindable | Change event | Notes                                                                                                                                                                                                           |
| ------------------ | ------------------------------------- | ----------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| virtualizer        | `Virtualizer \| undefined`            | `undefined` | no       | —            | `virtualizer` from `@uniaria/core/virtual`. Set, the list virtualizes; unset, nothing below applies and the module isn't loaded (Resolved questions 1). Property only.                                          |
| itemSize           | `number \| ((key: string) => number)` | `undefined` | no       | —            | A row's size along the list's axis in px: an option's, or a section's label row (Groups). Exact unless `shouldMeasureItems`. Unset, every row is measured, estimated at 32. Attribute `item-size` for a number. |
| shouldMeasureItems | `boolean`                             | `false`     | no       | —            | `itemSize` is an estimate and each rendered row is measured (Sizes). Attribute `measure-items`.                                                                                                                 |
| overscan           | `number`                              | `10`        | no       | —            | Options rendered beyond each edge of the view. Cube UI Kit renders 10, Zag's examples 12; virtual-core's default of 1 is thin for a held arrow key.                                                             |
| initialItemCount   | `number`                              | `20`        | no       | —            | Options rendered before the scroller has a size (Resolved questions 7).                                                                                                                                         |

## Events

| Event              | Detail                                                     | When                                                                              |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| renderedKeysChange | `{ keys: readonly string[], sections: readonly string[] }` | The rendered set changed. DOM `renderedkeyschange`, React `onRenderedKeysChange`. |

## Public state

| Field            | Type                | Meaning                                                                                                                                 |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| isVirtualized    | `boolean`           | A `virtualizer` is set.                                                                                                                 |
| renderedKeys     | `readonly string[]` | The options to render, in list order. Every option when not virtualized (the collection's keys, the same array until the items change). |
| renderedSections | `readonly string[]` | The sections whose group to render, in list order: those holding a rendered option. Every section when not virtualized.                 |

Both arrays are new only when their contents change, so a selector compares
them by identity.

## Layout

Written through the binder, only while virtualized. Positions are along the
list's axis (`orientation`); the table shows vertical, and horizontal swaps
block for inline (Resolved questions 4).

| Part                    | Style UniAria writes                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| scroller                | `overflow-anchor: none`: the engine keeps the view in place when rows above it change size, and the browser's anchoring would move it twice. |
| list                    | `position: relative; block-size: <total>px`: the scroller's scroll height.                                                                   |
| option, outside a group | `position: absolute; inset-block-start: 0; inset-inline-start: 0; translate: 0 <start>px`                                                    |
| group                   | the same at its section's start, and `block-size: <section size>px`                                                                          |
| option, inside a group  | the same, its start measured from the group's                                                                                                |

`translate`, not `transform`, so a consumer's transform (a press effect)
still composes. Width is the consumer's: usually `inset-inline-end: 0` or
`inline-size: 100%` on options. Gaps between rows are part of the sizes:
absolutely positioned rows ignore margins and the list's `gap`.

The scroller takes `tabindex="-1"`: a box that scrolls and holds nothing
focusable is a tab stop in Chromium and Firefox, and in virtual focus
(Combobox) no option is focusable. The list keeps Listbox's `tabindex`.

In development, UniAria warns once when the scroller part is missing, when a
pinned option's element isn't rendered after the consumer rendered
`renderedKeys`, and, with exact sizes, when a rendered row's size differs
from `itemSize` (its rows overlap or leave gaps).

## Sizes

- **Exact** (`itemSize` set): every row is `itemSize` long, or
  `itemSize(key)` when it depends on the item (Cube UI Kit's rows with a
  description are taller). Nothing is measured: scrolling to any option lands
  exactly, no element is observed, and a hidden popover changes nothing.
- **Measured** (`shouldMeasureItems`, or no `itemSize`): each rendered row's
  border box is observed with a `ResizeObserver`; unmeasured rows count at
  `itemSize` (or 32). Measurements are kept by key, not by element, so
  filtering and re-rendering don't measure again, and a size of 0 from a
  hidden element (a closed popover) is ignored. When a row above the view
  changes size, the view keeps its first visible row in place.

## Groups

ARIA lets an option be a child of the listbox or of a `group` in it, so a
virtualized group is still one element around its options (Resolved questions
5):

- A section is a box at its section's start, as long as its label row plus
  its options; the group's label renders first in it, in flow, `itemSize`
  of the section's key long. Its options are positioned inside it, from its
  start.
- A group renders while any of its options does, with its label, whether or
  not the label row is in view, so the group's `aria-labelledby` always
  resolves (React Aria keeps section headers the same way).
- `renderedSections` names the groups; the consumer renders each with the
  options of `renderedKeys` that belong to it, in order.

## ARIA

While virtualized, each option also has:

| Attribute       | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `aria-posinset` | its position among all options, from 1, across groups (Resolved questions 6) |
| `aria-setsize`  | the number of options                                                        |

Without them a browser counts only the rendered options ("3 of 15" for
option 503 of 10,000; Core-AAM: authors who set one must set both on every
item). Groups, labels and the scroller get no numbers. Unvirtualized,
neither is written, as today: every option is in the DOM, and the browser
counts.

A Combobox's `aria-activedescendant` names the highlighted option only once
its element is rendered: an id that resolves to nothing is non-conforming,
and Chromium drops the relation (probed in Chromium 153). The highlight
pin makes that the same task as the key press (Focus).

## Keyboard

The keys are Listbox's, Select's and Combobox's, unchanged. What changes is
how they reach options outside the view:

| Key                           | Virtualized                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ArrowDown, ArrowUp, Home, End | The target is found in the collection, as today; it is rendered, scrolled into view and focused (Focus).                                                          |
| Page Up, Page Down            | The farthest option within one view's length of the focused one, as today, measured from UniAria's geometry instead of rendered elements, so it works off screen. |
| typeahead                     | Searches every item's text, as today (data); the match is rendered, scrolled in and focused.                                                                      |
| Shift+arrows, Ctrl+A          | Ranges and select-all already work on keys, not elements.                                                                                                         |

## Focus

Moving focus (roving, Listbox and Select) or the highlight (virtual,
Combobox) to an option outside the rendered set:

1. The option becomes the move's target, a pin, so it renders in this flush.
2. Moved by the keyboard, the scroller scrolls it into view by its position,
   to the nearest edge, honouring the scroller's CSS `scroll-padding` (the
   `block: 'nearest'` of Listbox's `scrollIntoView` today). A pointer or hover
   move never scrolls, as today.
3. Roving: when its element attaches, it takes focus (`preventScroll`).
   Virtual: `aria-activedescendant` names it once its element exists.

React renders the new rows in the same task as the key press (an update in a
discrete event is flushed synchronously), so focus and the active
descendant land before the next paint. In custom elements that holds when
the consumer renders synchronously in its `renderedkeyschange` handler,
which the adapter documents.

Opening Select, or Combobox with a value, scrolls the selected option into
view by position (today: by element), as React Aria does on open.

The focused option staying rendered also fixes the focus-loss case React
Aria guards against: a wheel scroll never takes DOM focus off the list.

## Pointer and touch

Unchanged. Hover, press and release over rows are Listbox's; a pressed row
stays rendered until the press ends. UniAria doesn't turn off pointer
events while scrolling (React Aria does, to save hover work): a scroll with
the pointer resting changes the hovered row, which Listbox's hover rules
already handle.

## Styling tokens

| Token              | On                   | Meaning                 |
| ------------------ | -------------------- | ----------------------- |
| `data-virtualized` | root, list, scroller | A `virtualizer` is set. |

Plus the styles in Layout. The rest are Listbox's.

## Expected spoken output

As Listbox, Select and Combobox, with the position from the attributes:

| Situation                                           | Output                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| focus on option 503 of 10,000 (End then Page Up, …) | `option, Kiwi, not selected, position 503, set size 10000`                                                                                       |
| a group's option                                    | `group, Citrus`, then `option, Lemon, not selected, position 41, set size 10000`                                                                 |
| Combobox, ArrowDown to an option outside the view   | `combobox, Fruit, k, has popup listbox, expanded, active descendant Kiwi, autocomplete in list, 1 control` (the option resolves, so it is named) |

The virtual screen reader reads written values as written; it counts per
group only when they are absent (Corrections). It names the active
descendant only in the combobox's phrase (Combobox spec); real screen
readers reading the option and its position as it moves is checked at
gate 5.

## Adapter surface

```tsx
// React: the rows live in a child component, so scrolling re-renders it,
// never the component that owns the list.
import { virtualizer } from '@uniaria/core/virtual';

function Users({ users }: { users: readonly User[] }) {
  const list = useComponent(listbox, {
    items: users,
    virtualizer,
    itemSize: 32,
  });
  return (
    <div {...list.parts.root}>
      <span {...list.parts.label}>Users</span>
      <div {...list.parts.scroller}>
        <div {...list.parts.list}>
          <UserRows list={list} />
        </div>
      </div>
    </div>
  );
}

function UserRows({ list }: { list: ComponentHandle<typeof listbox> }) {
  const keys = useComponentState(list, (state) => state.renderedKeys);
  return keys.map((key) => (
    <div key={key} {...list.getItemProps('option', key)}>
      {byKey.get(key)!.name}
    </div>
  ));
}
```

```js
// Custom element: items as a property; the consumer renders the rows.
import '@uniaria/elements/listbox';
import { virtualizer } from '@uniaria/core/virtual';

const element = document.querySelector('uni-listbox');
const list = element.querySelector('[data-part="list"]');
element.items = users;
element.virtualizer = virtualizer;
element.addEventListener('renderedkeyschange', ({ detail }) => {
  // Synchronously, so a highlighted option exists before the next paint.
  // Each row carries data-part="option" and data-key; lit-html's render
  // keeps the rows that stay.
  render(
    detail.keys.map((key) => row(byKey.get(key))),
    list,
  );
});
```

```html
<uni-listbox item-size="32">
  <span data-part="label">Users</span>
  <div data-part="scroller">
    <div data-part="list"></div>
  </div>
</uni-listbox>
```

Rendering by `renderedKeys` already fits root AGENTS.md: "Changing the
rendered tree by state (other content, lazy mounting) needs a selector." The
component that maps the rows renders once per change of the rendered set;
the owner renders zero times, as for every other state change.

## Runtime and harness changes

To approve with this spec (root AGENTS.md: runtime and custom-element
contract changes, `conformance/`):

1. **An effect per item element**, `ctx.itemEffect(part, (key, element) =>
cleanup)`: focus a target when it attaches, observe a measured row. Named
   parts have `partEffect`; item parts have nothing today.
2. **`connect()` re-runs when an item element attaches or detaches.** Today
   only that key's item props are rewritten, so a named part that names an
   item (Combobox's `aria-activedescendant`) can't follow its element.
3. **Item attaches batched per commit**: React attaches each row through its
   own ref, one store notification each; a range swap of 20 rows is 40
   flushes today.
4. **Per-key caches pruned** for keys no longer in the collection: scrolling
   10,000 rows end to end leaves 10,000 entries today.
5. **The conformance harness renders rows from `renderedKeys`**, in both
   adapters (in React from a child component, so the owner's render count
   stays checked), and the scenarios run on a scroller with a fixed height.
6. **AGENTS.md**, Collections: virtualization through the `virtualizer` prop;
   the consumer renders `renderedKeys`; custom elements need `items` as a
   property and render on `renderedkeyschange`. Dependencies: how
   virtual-core ships (Resolved questions 2).

## Mapping from Cube UI Kit

Cube UI Kit's ListBox at `references/cube-ui-kit` 92561aa (research:
`scratchpad/virtualization/ui-kit.md`):

| UI Kit                                                                                                                           | UniAria                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Every flat, non-reorderable list virtualizes, at any size, with no way out; sections turn it off                                 | Opt-in per list (`virtualizer`); groups virtualize too                     |
| Scroll into view looks the option up in the DOM: Home, End, the page keys, typeahead and open don't scroll off screen (CUB-5906) | Scroll by position for every move                                          |
| Nothing keeps the focused option rendered: focus falls to `<body>`, `aria-activedescendant` names a missing id (CUB-5894)        | Pins                                                                       |
| Page Up and Page Down act as Home and End, or do nothing                                                                         | Paged by geometry                                                          |
| `sortSelectedToTop` hides the scroll-on-open bug; Cloud turns it off at about 10 sites                                           | Opening scrolls to the selected option                                     |
| `aria-posinset`/`aria-setsize` on every non-reorderable list, untested                                                           | Only while virtualized, from the collection, in conformance                |
| An empty list removes `role="listbox"` (CUB-5907)                                                                                | The list stays (Listbox)                                                   |
| Every row measured on every commit, in a layout effect (#1457); virtual-core 3.17 changed that read                              | Exact sizes by default; measured rows observed and cached by key           |
| The whole list and every mounted option re-render on each range change                                                           | Only the row-mapping component re-renders; geometry through the binder     |
| Under jsdom no rows render; Cloud adds an untitled section to see options (`NotificationConfig.tsx:215-220`)                     | The first `initialItemCount` options render before the scroller has a size |
| A virtualized list has no intrinsic width; Cloud adds a section to get one back (`ChatInput.tsx:893-894`)                        | Not solved: the container gives the width (Summary)                        |
| Select never virtualizes (Cloud's most used list, 104 files)                                                                     | Select virtualizes through its list                                        |

## Differences from Cube UI Kit, React Aria, Zag and the APG

| #   | Topic                        | UI Kit                         | React Aria                                  | Zag                        | APG                         | UniAria                                  |
| --- | ---------------------------- | ------------------------------ | ------------------------------------------- | -------------------------- | --------------------------- | ---------------------------------------- |
| 1   | Turned on                    | always for flat lists          | `<Virtualizer>` around the list             | the consumer's virtualizer | —                           | `virtualizer` prop (Q1)                  |
| 2   | Engine                       | `@tanstack/react-virtual` 3.13 | its own (about 9.5 kB gzip with ListLayout) | any                        | —                           | `@tanstack/virtual-core` (Q2)            |
| 3   | Focused option kept rendered | no                             | yes (`persistedKeys`), with its section     | no                         | —                           | yes, with the tab stop and target (pins) |
| 4   | Scroll to an option          | DOM lookup                     | DOM, on the persisted element               | `scrollToIndexFn`          | "scrolls into view"         | by position                              |
| 5   | Page keys                    | broken                         | layout delegate                             | first/last                 | optional                    | by geometry                              |
| 6   | Sizes                        | measured, estimated per token  | estimated, measured                         | the consumer's             | —                           | exact by default, measured opt-in (Q3)   |
| 7   | Groups                       | not virtualized                | virtualized, sections persisted             | flat examples only         | `group`                     | virtualized (Q5)                         |
| 8   | posinset/setsize             | always, flat index             | when virtualized; sibling index in RAC      | none (examples set them)   | required                    | when virtualized, across groups (Q6)     |
| 9   | Before a size                | nothing renders                | everything renders                          | the consumer's             | —                           | the first `initialItemCount` (Q7)        |
| 10  | Load more                    | no                             | sentinel, `onLoadMore`                      | no                         | `aria-setsize="-1"` allowed | later (Q10)                              |

## Deviations from the WAI-ARIA pattern

None. Options outside the rendered set can't be reached in a screen
reader's browse mode or the browser's find in page; the APG accepts that
with `aria-setsize` and `aria-posinset` set.

## Corrections

The Listbox spec says position and set size "are counted by the browser,
per group". That is what the virtual screen reader does; Chromium's
accessibility tree numbers options across the groups of a listbox
(`AXNode::GetOrderedSet` skips a group inside a listbox, from source; not
probed: CDP doesn't expose the numbers). The Listbox spec's sentence is
corrected with this change, and a real screen reader check joins gate 5's
matrix.

## Resolved questions

Decided by @tenphi on 2026-10-18, each as recommended.

1. **Where virtualization lives.** (a) In Listbox, turned on by a
   `virtualizer` prop the consumer imports from a new
   `@uniaria/core/virtual`: the behavior is in the definition, the same in
   both adapters and in conformance, and only lists that virtualize load
   the engine; the engine sits behind a small interface UniAria owns, so it
   can change without an API change. (b) In Listbox, always loaded, turned
   on by `isVirtualized`: every Listbox, Select and Combobox pays about
   7 kB brotli. (c) Zag's way: Listbox exposes a scroll-to-key callback and
   the keys to keep rendered, and the consumer brings any virtualizer: no
   dependency, but every consumer rebuilds pins, scrolling, paging and
   measuring, and conformance can't test it. Decided: (a).
2. **The engine and how it ships.** `@tanstack/virtual-core` 3.19 is one
   framework-free class, 7.0 kB brotli, SSR-safe, with exact sizes,
   measuring and scroll anchoring; but it has churned (ten `scrollToIndex`
   fixes since 3.13), its lifecycle hooks are underscore-prefixed, its dist
   reads `process.env.NODE_ENV` on every call (a plain `<script
type="module">` with an import map throws), and a pin needs a new
   `rangeExtractor` each time (probed). (a) virtual-core, pinned to an exact
   version and bundled into `@uniaria/core/virtual` at build time with
   `NODE_ENV` defined, its license kept: the unbundled path works, and
   upgrades are deliberate. (b) virtual-core as a normal dependency, with a
   documented `process` shim for unbundled pages. (c) An in-house engine
   for exact sizes only (about 1 kB, inferred), measuring later: root
   AGENTS.md asks the owner before building one. Decided: (a).
3. **Sizes.** (a) Exact `itemSize` (a number, or per key) by default, with
   measuring opt-in: exact scrolling, no observers, nothing breaks in a
   hidden popover; Cube UI Kit's per-token and per-description heights fit a
   function. (b) Always measure, as Cube UI Kit. Decided: (a).
4. **Layout.** (a) A `scroller` part around the list; the list is sized to
   the whole list and UniAria positions rows absolutely with `translate`:
   React Aria's and TanStack's layout, which a pinned row far from the view
   needs. (b) Rows in flow, spaced by margins UniAria writes: rows keep an
   intrinsic width, but a consumer's margins and `gap` conflict, and
   measuring is harder to keep exact. (c) The list scrolls and an un-parted
   sizer inside it holds the rows: no new part, but a `div` inside a `ul`
   is invalid HTML. Decided: (a).
5. **Groups.** (a) Virtualized: a rendered group is a box at its section's
   position holding its rendered options, with its label always rendered
   (Groups); Cloud's sectioned member pickers need it. (b) Flat lists only
   for now: a grouped list with a `virtualizer` renders everything and warns
   in development. Decided: (a).
6. **Numbering across groups.** (a) Positions across the whole list
   (`option 41 of 10000`): Chromium's own numbering for a grouped listbox,
   React Aria's set size, and one number per option however the list is
   grouped. (b) Per group, as the virtual screen reader counts an
   unvirtualized list today. Decided: (a).
7. **Before the scroller has a size.** (a) The first `initialItemCount`
   options (default 20) plus the pins: the server renders the top of the
   list, and tests find options without a viewport. (b) Every option
   (React Aria under jsdom): tests see everything, but a server renders
   10,000 rows. (c) Only the pins (Cube UI Kit renders nothing).
   Decided: (a).
8. **Custom elements.** (a) Supported: `items` set as a property (the
   markup can't list them), the consumer renders the rows on
   `renderedkeyschange`, synchronously; the element never creates them.
   (b) The React adapter only, for now. Decided: (a): the behavior is
   the definition's either way, and conformance runs in both adapters.
9. **Select's hidden `<select>`.** It holds one `<option>` per item (Select
   spec); React Aria switches to hidden inputs above 300 items. (a) Keep it
   at every size: one `<option>` per item is cheap next to rendered rows,
   and autofill needs the options. (b) Hidden inputs above 300 items, as
   React Aria. Decided: (a), measured during implementation, with (b)
   if 10,000 items cost more than a frame.
10. **Loading more.** (a) A later spec on async collections: `onLoadMore`
    with a sentinel one view ahead, a loading row, `aria-busy` and
    `aria-setsize="-1"` for an unknown total, with Combobox's server
    filtering. (b) In this spec. Decided: (a): no Cloud dropdown loads
    more, and it is independent of rendering.

## Open questions

None.
