# Tabs spec

Status: approved by @tenphi on 2026-10-26

## Summary

Tabs show one panel of content at a time, chosen from a list of tabs:
`role="tablist"` on the list, `role="tab"` on each tab, `role="tabpanel"` on
each panel, with arrow keys, Home and End moving between tabs and, by default,
selecting the tab they reach. There is no native element underneath.

Tabs are a collection (root AGENTS.md → Collections): `items` plus `getKey`,
`isItemDisabled` and `disabledKeys`, with the tab and its panel as item parts
keyed by the item's key, as Listbox's options are. The selection is a single
key that is never empty. Cube UI Kit's Tabs is the model; it is React Aria's
`useTabList`, `useTab` and `useTabPanel` with UI Kit's own API around them,
so React Aria is the reference for most of the behavior.

- **WAI-ARIA pattern:** [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  (`references/aria-practices/content/patterns/tabs/`, the automatic and
  manual activation examples).
- **Builds on:** item parts in the runtime and `collections/list` for the
  next and previous enabled key (both Listbox's); `createItemPress`, hover,
  focus-visible and focus-within from `dom/`. No new runtime or
  custom-element contract.
- **Owner:** none.
- **Custom element:** yes, `<uni-tabs>`, hosting consumer markup. Its tabs and
  panels are the consumer's elements, found by `data-element` and keyed by the
  consumer's `data-key`.
- **Named consumer:** Cookbook, UniAria's documentation toolkit
  (`@tenphi/renderer`): its `Tabs` and `Tab` MDX components and `CodeGroup`
  (Cookbook).

Not part of Tabs:

- **Tabs that are links.** A row of links to pages is navigation: links with
  `aria-current="page"` in a `<nav>`, as Cookbook's top navigation is. React
  Aria's link tabs and Zag's `navigate` are left out.
- **Closing, renaming, reordering and menus on tabs** (UI Kit's `onDelete`,
  `isEditable`, `isReorderable`, `menu`, `contextMenu`), and the APG's
  optional Delete key. Later additions; actions beside a tab would follow the
  items spec's frame and extras.
- **Overflow handling.** UI Kit's tab picker and scroll arrows are the design
  system's: a picker is a Select over the same items.
- **The selection indicator** that slides between tabs (Resolved questions 6).
- **Rendering panels lazily.** React and Vue render a panel's content from
  `selectedKey`; Tabs only writes the panel's attributes.
- **Looks.** Sizes, types, placement of the list beside the panels.

## Anatomy

Named parts, one element each:

| Part  | Element                | Attributes UniAria owns                                                                                                         | Notes                                                                                             |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| root  | any; usually `div`     | state attributes                                                                                                                | Optional wrapper around the list and the panels.                                                  |
| list  | any; usually `div`     | `id` (unless it has one), `role="tablist"`, `aria-orientation`, `aria-labelledby` while the label is rendered; state attributes | Holds the tabs, and nothing else that takes focus.                                                |
| label | any; usually a heading | `id` (unless it has one)                                                                                                        | Optional. Names the list through `aria-labelledby`. Else the consumer's `aria-label` on the list. |

Item parts, one element per item and part, keyed by the item's key (in
custom elements, the consumer's `data-key` on the element):

| Part  | Element            | Attributes UniAria owns                                                                                                                                                         | Notes                                                                                                   |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| tab   | `button`, or any   | `id`, `role="tab"`, `aria-selected`, `aria-controls` while its panel is rendered, `tabindex`, `aria-disabled`; `type="button"` on a `<button>` without a type; state attributes | Inside the list. Its name is its text.                                                                  |
| panel | any; usually `div` | `id`, `role="tabpanel"`, `aria-labelledby` while its tab is rendered, `tabindex="0"` while shown, `hidden` while not; state attributes                                          | Anywhere in the component, usually after the list. A panel whose key has no tab is left alone (Panels). |

The root carries `data-uni="tabs"`; the list, the label and the item parts
carry `data-element`: `List`, `Label`, `Tab`, `Panel`. Item ids are made from
the list's id and the key, `<list id>-tab-<key>` and `<list id>-panel-<key>`,
with the key passed through `encodeURIComponent` (Listbox spec, Item parts).
A part keeps an `id` the consumer gives its element; item parts always take
the ids made from the list's id (Listbox spec, Resolved questions 1).

Development warns when the list has no name (no label part, no `labelledBy`,
no `aria-label` or `aria-labelledby` from the consumer), and when a panel's
key has no tab.

## Props

Keys are strings.

| Prop               | Type                         | Default                    | Bindable | Change event  | Notes                                                                                                                         |
| ------------------ | ---------------------------- | -------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| items              | `readonly Item[]`            | `[]`                       | no       | —             | The tabs, in order. A property on the element; without it the element reads them from its markup (Resolved questions 5).      |
| getKey             | `(item: Item) => string`     | `item.key`                 | no       | —             | Unique per list; development warns about duplicates.                                                                          |
| isItemDisabled     | `(item: Item) => boolean`    | `item.isDisabled === true` | no       | —             | As Listbox's.                                                                                                                 |
| disabledKeys       | `readonly string[]`          | `[]`                       | no       | —             | As Listbox's; attribute `disabled-keys`, JSON.                                                                                |
| value              | `string \| null`             | `null`                     | yes      | `valueChange` | The selected key. `null`, and a key with no enabled item, show the first enabled tab (Selection). Name: Resolved questions 1. |
| keyboardActivation | `'automatic' \| 'manual'`    | `'automatic'`              | no       | —             | Whether the arrow keys, Home and End select the tab they reach. Attribute `keyboard-activation`.                              |
| orientation        | `'horizontal' \| 'vertical'` | `'horizontal'`             | no       | —             | Which arrows move; `aria-orientation`, always written, and `data-orientation`.                                                |
| isDisabled         | `boolean`                    | `false`                    | no       | —             | Every tab disabled: no tab stop. The shown panel stays shown.                                                                 |
| listId             | `string \| undefined`        | generated                  | no       | —             | The list's `id` where it has none of its own (`idOf`); item ids follow it.                                                    |
| labelledBy         | `string \| undefined`        | —                          | no       | —             | More ids for the list's `aria-labelledby`.                                                                                    |

`Item` is whatever the accessors read; without accessors it is
`{ key: string; isDisabled?: boolean }`. Tabs need no text value: there is no
typeahead (Keyboard).

A tab is disabled when `isItemDisabled` or `disabledKeys` says so, or Tabs is
disabled. A disabled tab can't be focused or selected, and the keys skip it.

## Events

| Event         | Detail   | When                                                                                                                                                                                              |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `string` | The user selected another tab: a press, or a key (an arrow, Home or End when automatic; Enter or Space when manual). Never for a value the consumer sets, and never for the tab already selected. |

## Public state

| Field          | Type             | Meaning                                                                                                       |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| value          | `string \| null` | The bindable's value.                                                                                         |
| selectedKey    | `string \| null` | The tab shown (Selection): `value` when it names an enabled tab, else the fallback. `null` only without tabs. |
| focusedKey     | `string \| null` | The tab with focus, or the one the list will focus on Tab.                                                    |
| isDisabled     | `boolean`        |                                                                                                               |
| isFocusWithin  | `boolean`        | Focus is on a tab.                                                                                            |
| isFocusVisible | `boolean`        | That focus came from the keyboard.                                                                            |

React and Vue render a panel's content from it:
`useBehaviorState(tabs, (s) => s.selectedKey === key)`.

## Selection

- **One tab is always shown** (the APG: "one tab panel is displayed"). The
  shown tab is `value` when it names an enabled tab; otherwise the first
  enabled tab, or the first tab when every tab is disabled (React Aria's
  `findDefaultSelectedKey`). This is derived on every read: it reports no
  `valueChange`, and `value` keeps what it holds (Resolved questions 4).
- **Uncontrolled**, the user's choice is committed; **controlled**, it is
  requested through `valueChange` and shown once `value` changes. A controlled
  `null` stays controlled and shows the fallback.
- **Removing the shown tab** shows the fallback; adding its key back shows it
  again. Focus on a removed tab moves to the tab now shown.
- **No deselection.** A press on the selected tab changes nothing (Zag's
  `deselectable` is left out).

## Panels

- The panel of the shown tab has no `hidden` and `tabindex="0"` (Resolved
  questions 3). Every other panel whose key is an item gets `hidden`.
- **A panel whose key isn't an item** (no tab for it yet) gets nothing from
  UniAria, not even `hidden`, and development warns. So a page whose tabs
  are created later by a script shows every panel until they exist
  (Cookbook).
- **Server HTML.** React and Vue render the part props, so inactive panels
  are `hidden` from the first paint. A custom element's markup is the
  consumer's: panels without `hidden` show until the element starts, so a
  reader without JavaScript sees every panel.
- `hidden` is the only presentational attribute UniAria writes. A consumer
  that animates panels styles `[hidden]` itself (`display` with a
  transition, as for any `hidden` element).

## Keyboard

Keys act on `keydown` of the focused tab and call `preventDefault`; UniAria
never stops propagation. Keys it doesn't handle stay the browser's and the
page's.

Horizontal (in right-to-left text ArrowLeft and ArrowRight swap, read from
the list's computed `direction` when the key is pressed, as Listbox):

| Key                             | Action                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab                             | Into the list: focuses the shown tab (the APG), whatever was focused there last. Out of the list: the browser's, which reaches the shown panel next. |
| ArrowRight                      | Focuses the next enabled tab, from the last to the first. Automatic: selects it.                                                                     |
| ArrowLeft                       | The same, to the previous tab.                                                                                                                       |
| ArrowUp, ArrowDown              | Not handled, so the page scrolls (the APG).                                                                                                          |
| Home, End                       | Focuses the first or last enabled tab. Automatic: selects it.                                                                                        |
| Enter, Space                    | Manual: selects the focused tab. Automatic: nothing new, the tab is already selected.                                                                |
| Alt, Ctrl or Meta with an arrow | Not handled: they pass (Alt+ArrowLeft is Back on Windows).                                                                                           |
| Printable characters, Delete    | Not handled: no typeahead (the APG lists none; React Aria's tabs delegate has no search), no closing.                                                |

Vertical: ArrowDown acts as ArrowRight and ArrowUp as ArrowLeft, and
ArrowLeft and ArrowRight are not handled (the APG; React Aria moves with them
too).

After a key, the focused tab is scrolled into view with
`scrollIntoView({ block: 'nearest', inline: 'nearest' })`, for a list that
scrolls; after a pointer nothing scrolls (Listbox).

## ARIA and state attributes per state

| State         | Part        | Attributes                                                                                                                |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| idle          | list        | `role="tablist"`, `id`, `aria-orientation`, `aria-labelledby` while the label is rendered or `labelledBy` is set          |
|               | tab         | `role="tab"`, `id`, `aria-selected="false"`, `tabindex="-1"`, `aria-controls` the panel's id while it is rendered         |
|               | panel       | `role="tabpanel"`, `id`, `aria-labelledby` the tab's id while it is rendered, `hidden`                                    |
| shown         | tab         | `aria-selected="true"`, + `data-selected`                                                                                 |
|               | panel       | no `hidden`, `tabindex="0"`, + `data-selected`                                                                            |
| the tab stop  | tab         | `tabindex="0"`: the shown tab while focus is outside the list, else the focused tab                                       |
| focused       | tab         | + `data-focused`, + `data-focus-visible` after keyboard focus                                                             |
|               | named parts | + `data-focus-within`, + `data-focus-visible` after keyboard focus                                                        |
| hovered       | tab         | + `data-hovered` (a mouse or pen, never touch, never a disabled tab)                                                      |
| pressed       | tab         | + `data-pressed`                                                                                                          |
| disabled tab  | tab         | + `aria-disabled="true"`, `tabindex="-1"`, + `data-disabled`. Never `disabled`: the tab stays in the tree for browse mode |
| disabled Tabs | every tab   | + `aria-disabled="true"`, `tabindex="-1"`; every part + `data-disabled`                                                   |
| any           | every part  | `data-orientation`: `horizontal` or `vertical`                                                                            |

`aria-selected="false"` is explicit on every other tab, as the APG and React
Aria write it. `aria-setsize` and `aria-posinset` are not written: every tab
is in the DOM and the browser counts them (Expected spoken output).

## Focus

Roving tabindex, as Listbox: DOM focus moves to the tab, never
`aria-activedescendant`.

- **Tab in** lands on the shown tab. In manual mode, focus may rest on
  another tab while in the list; once focus leaves, the tab stop goes back to
  the shown tab.
- **With every tab disabled** (or Tabs disabled) the list has no tab stop.
- **A press** focuses the tab on pointer down. A press on a disabled tab
  prevents the `mousedown`, so focus doesn't fall to the body.
- **The focused tab goes away** or becomes disabled: focus moves to the tab
  now shown, only when focus was on it.
- **A value set by the consumer** shows the new tab and never moves focus.
  With focus outside the list, the new tab takes the tab stop at once. With
  focus in the list, the focused tab keeps it, so Tab and Shift+Tab still
  leave from where focus is, and the new tab takes it once focus leaves.
- **Panels.** Tab from the list reaches the shown panel (`tabindex="0"`), so a
  screen-reader user lands at the start of its content (the APG).

## Pointer and touch

- **Selecting on release.** A press selects when it ends on the tab it
  started on (`createItemPress` from `dom/`), for mouse, pen, touch and a
  screen reader's virtual click alike, as a button and the APG's examples do
  (on `click`). A touch that scrolls the list selects nothing. React Aria, and
  UI Kit through it, select a mouse press on `mousedown`.
- **Other buttons.** Middle and right clicks do nothing.
- **Hover** marks the tab with `data-hovered`, from a mouse or pen.

## Styling tokens

| Token                | On               | Meaning                                                      |
| -------------------- | ---------------- | ------------------------------------------------------------ |
| `data-selected`      | tab, panel       | The shown tab and its panel.                                 |
| `data-focused`       | tab              | Has focus.                                                   |
| `data-focus-visible` | tab, named parts | Keyboard focus.                                              |
| `data-focus-within`  | named parts      | Focus is on a tab.                                           |
| `data-hovered`       | tab              | A mouse or pen is over it.                                   |
| `data-pressed`       | tab              | Being pressed.                                               |
| `data-disabled`      | tab, every part  | The tab, or all of Tabs.                                     |
| `data-orientation`   | every part       | `horizontal` or `vertical`.                                  |
| `hidden`             | panel            | Not shown; the only presentational attribute UniAria writes. |

`aria-selected="true"` and `:focus-visible` work as well. No CSS variables
(Resolved questions 6).

## Expected spoken output

Probed with `@guidepup/virtual-screen-reader` on hand-written markup in
Chromium and WebKit, with the same phrases in both, for a list "Installation"
of tabs npm, pnpm and yarn:

| State                                   | Spoken phrase                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| the list                                | `tablist, Installation, orientated horizontally`                                                           |
| vertical                                | `tablist, Installation, orientated vertically`                                                             |
| a list without a name                   | `tablist, orientated horizontally`                                                                         |
| the shown tab                           | `tab, npm, selected, 1 control, position 1, set size 3`                                                    |
| another tab                             | `tab, pnpm, not selected, 1 control, position 2, set size 3`                                               |
| a disabled tab                          | `tab, yarn, not selected, 1 control, disabled, position 3, set size 3`                                     |
| the shown panel                         | `tabpanel, npm`, then its content, then `end of tabpanel, npm`                                             |
| focus moves to a tab                    | `tablist, Installation, orientated horizontally`, `tab, pnpm, selected, 1 control, position 2, set size 3` |
| focus moves to the panel                | `tabpanel, npm`                                                                                            |
| before the element starts (no `hidden`) | every panel in turn: `tabpanel, npm`, …, `tabpanel, pnpm`, …, `tabpanel, yarn`, …                          |

A panel with or without `tabindex="0"` reads the same. "1 control" is the
tab's `aria-controls`; a tab whose panel isn't rendered has none.

## Adapter surface

```tsx
// React
const install = useBehavior(tabs, {
  items, // [{ key: 'npm' }, { key: 'pnpm' }]
  defaultValue: 'pnpm',
  onValueChange,
});
const selectedKey = useBehaviorState(install, (s) => s.selectedKey);
return (
  <div {...install.parts.root}>
    <div {...install.parts.list} aria-label="Installation">
      {items.map((item) => (
        <button key={item.key} {...install.getItemProps('tab', item.key)}>
          {item.key}
        </button>
      ))}
    </div>
    {items.map((item) => (
      <div key={item.key} {...install.getItemProps('panel', item.key)}>
        {selectedKey === item.key && <Instructions manager={item.key} />}
      </div>
    ))}
  </div>
);
```

```html
<!-- Custom elements: items read from the tabs in the markup -->
<uni-tabs default-value="pnpm">
  <div data-element="List" aria-label="Installation">
    <button data-element="Tab" data-key="npm">npm</button>
    <button data-element="Tab" data-key="pnpm">pnpm</button>
  </div>
  <div data-element="Panel" data-key="npm">Run <code>npm install</code>.</div>
  <div data-element="Panel" data-key="pnpm">Run <code>pnpm add</code>.</div>
</uni-tabs>
```

`@uniaria/core/tabs` exports `tabs`, and the element registers from the same
subpath of `@uniaria/elements`. Attributes: `keyboard-activation`,
`orientation`, `disabled`, `disabled-keys`, `default-value`, `list-id`,
`labelled-by`; properties `items`, `value` (controlled) and `defaultValue`;
event `valuechange`. Without an `items` property the element reads its tabs
in document order, the key from `data-key`, and reads them again when the
markup changes (Listbox's adoption, `adopt: { items: { item: 'tab' } }`), so
tabs a script adds after the element starts join the collection (Resolved
questions 5). A nested `<uni-tabs>` in a panel is its own component: part
discovery stops at it.

## Cookbook, the named consumer

Cookbook's `Tabs` and `Tab` components (MDX) and its `CodeGroup` render
panels with a heading each and `data-label`; `client/tabs.ts` (70 lines)
creates the tab buttons from the labels and does the rest. With Tabs:

| `client/tabs.ts` today                                                                   | With Tabs                                                                               |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `role="tablist"` and `aria-label` (from the root's, "Examples" by default)               | `role` UniAria's; Cookbook renders the `aria-label` on the list                         |
| Creates `<button type="button">` per panel from `data-label`                             | Stays Cookbook's (UniAria never creates nodes); CodeGroup can render them on the server |
| Ids, `role="tab"`, `aria-controls`; `role="tabpanel"`, `aria-labelledby`, `tabindex="0"` | UniAria's                                                                               |
| Hides each panel's `[data-tab-heading]` once tabs exist                                  | Stays Cookbook's (its own CSS or script)                                                |
| `aria-selected`, roving `tabindex`, `hidden` on other panels; the first tab selected     | UniAria's                                                                               |
| Arrows following the root's `direction`, wrapping; Home, End; selecting on focus; click  | UniAria's (automatic activation, the default)                                           |
| Re-running on `astro:after-swap` before a frame paints every panel                       | The element starts when it connects                                                     |

Its requirements, all covered above: automatic activation, RTL arrows,
Home and End, wrapping, focusable panels, every panel readable without
JavaScript, and tabs created after the element starts. Cookbook's `Tab`
component marks its panel `data-element="Tab"` today; with these part names
it becomes `Panel` (Resolved questions 2).

## Mapping from Cube UI Kit

UI Kit at `references/cube-ui-kit` 27a92974, `src/components/navigation/Tabs/`
(`Tabs.tsx`, `TabButton.tsx`, `TabPanel.tsx`, `types.ts`).

- `activeKey`, `defaultActiveKey` and `onChange(key)` map to `value`,
  `defaultValue` and `onValueChange`.
- `placement` maps to `orientation` (`left` and `right` are vertical) plus
  the design system's layout; `label` to the list's `aria-label` or the label
  part.
- `Tab`'s `isDisabled` maps to `isItemDisabled` or `disabledKeys`; `id` (from
  the React key) to `getKey`.
- `prerender`, `keepMounted`, `renderPanel` and `panelCacheKeys` become the
  consumer rendering panel content from `selectedKey`.
- `type`, `size`, `styles` and the bar, list, prefix and suffix styles,
  `tabListPadding`, `hideTabListScroll`: the design system's. `prefix` and
  `suffix` are markup outside the list.
- `showTabPicker`, `showScrollArrows` and their positions: the design system's.
- `onDelete`, `isEditable`, `onTitleChange`, `menu`, `menuTriggerProps`,
  `menuProps`, `contextMenu`, `onAction`, `actions`, `autoHideActions`,
  `isReorderable`, `keyOrder`, `onReorder`: later (Not part of Tabs).
- The indicator (`use-tab-indicator.ts`) measures the selected tab's start
  and size: Resolved questions 6.

## Differences from React Aria, Zag, the APG and Cookbook

| #   | Topic                        | React Aria (and UI Kit)                               | Zag, the APG, Cookbook                                 | Decided                                           |
| --- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| 1   | The value's name             | `selectedKey`; UI Kit `activeKey`                     | Zag `value`                                            | `value` (Q1)                                      |
| 2   | Empty selection              | Never                                                 | Zag: with `deselectable`; APG: never                   | Never; `null` shows the fallback                  |
| 3   | Pointer timing               | `mousedown` for a mouse                               | Zag, APG, Cookbook: `click`                            | On release                                        |
| 4   | `aria-controls`              | On the selected tab only (only its panel is rendered) | Zag: the selected tab; APG, Cookbook: every tab        | Every tab whose panel is rendered                 |
| 5   | Panel `tabindex="0"`         | Only without a tabbable descendant                    | Zag, APG example, Cookbook: always                     | While shown, always (Q3)                          |
| 6   | Vertical ArrowLeft and Right | Move                                                  | APG: not listed; Zag: not handled                      | Not handled                                       |
| 7   | Wrapping                     | Always                                                | Zag: `loopFocus`, on by default; APG, Cookbook: always | Always, no prop                                   |
| 8   | The selected tab removed     | The first enabled tab, reported                       | APG Delete: the following tab, else the preceding      | The first enabled tab, derived, not reported (Q4) |
| 9   | Links as tabs                | Supported                                             | Zag: `navigate`                                        | Out of scope                                      |
| 10  | Disabled tabs                | Skipped; `aria-disabled`                              | APG: —                                                 | Skipped; `aria-disabled`, `tabindex="-1"`         |
| 11  | Activation prop              | `keyboardActivation`                                  | Zag `activationMode`; APG: automatic recommended       | `keyboardActivation`, automatic (Q1)              |

## Deviations from the WAI-ARIA pattern

None. The optional Delete key and Shift+F10 for a tab's menu are left out
with closing and menus.

## Changes outside this spec

- Root AGENTS.md: Tabs joins the component list and the roadmap, with its
  element.
- The implementation registers the subpath in `tsdown.config.ts`, `exports`
  and `ssr-safety.test.ts`, the element's entry in `@uniaria/elements`, and an
  entry in `.size-limit.js`; `docs/components/tabs.mdx` gets a live demo.

## Resolved questions

Decided by @tenphi on 2026-10-26, each as recommended.

1. **Names.** (a) `value`, `defaultValue` and `valueChange`, as Listbox,
   RadioGroup and Select (and Zag and Radix), with `keyboardActivation` from
   React Aria, which UI Kit inherits. (b) React Aria's `selectedKey` and
   `onSelectionChange`. (c) UI Kit's `activeKey` and `onChange`, with Zag's
   `activationMode`. Decided: (a).
2. **Part names.** (a) `tab` and `panel` (`data-element="Tab"` and
   `"Panel"`), the ARIA roles, as Listbox's `option`. Cookbook's `Tab`
   component re-marks its panel `Panel`. (b) `trigger` and `content` (Zag,
   Radix). (c) `tab` and `tabPanel` (React Aria's `TabPanel`), more specific
   than `Panel` in Tasty's sub-element names. Decided: (a).
3. **Panel focusability.** (a) The shown panel always has `tabindex="0"`
   (the APG example, which advises it for every panel of a set where any
   panel starts with content that can't take focus; Zag; Cookbook). (b) Only
   while it has no tabbable descendant (React Aria and UI Kit), watching the
   panel's content: no extra stop before a panel that starts with a link, but
   panels of one set differ, and a mutation observer per panel. Decided:
   (a).
4. **A value that names no enabled tab** (`null`, a removed or disabled tab).
   (a) Derived: the first enabled tab is shown, nothing is reported, and
   `value` keeps its key, as Listbox keeps removed keys; it works the same
   controlled. (b) React Aria's: the selection moves to the first enabled tab
   and `valueChange` reports it (uncontrolled only). (c) The APG's Delete
   rule: the following tab, else the preceding, which needs the old order.
   Decided: (a).
5. **The element's items from markup.** (a) From the tab parts in document
   order, keys from `data-key`, disabled from `disabled-keys`, read again when
   the markup changes; a panel whose key has no tab is left alone, so
   Cookbook's panels show until its script adds the tabs. (b) From the
   panels, so items exist before the tabs: but the tabs' order is the one the
   keys follow. (c) Require the `items` property. Decided: (a).
6. **A sliding selection indicator.** UI Kit measures the selected tab's
   start and size to move one underline between tabs; Zag has an `indicator`
   part with CSS variables. (a) Nothing now: the selected tab's own look
   (`data-selected`) covers Cookbook. (b) CSS variables on the list with the
   shown tab's offset and size along the list, measured on selection and on
   resize. Decided: (a) now, (b) when UI Kit moves to UniAria.
7. **Find in page.** `hidden="until-found"` lets the browser's find reveal
   text in a hidden panel, with `beforematch` selecting its tab: useful for
   documentation. It isn't Baseline (no Safari; Chromium 102, Firefox 148),
   and a hidden panel keeps its own box (padding, border) on screen. (a) Plain
   `hidden` now. (b) An opt-in prop that writes `until-found` where supported
   and plain `hidden` elsewhere. Decided: (a) now.
8. **A value set while focus is in the list.** The tab stop row gave the
   stop to the focused tab while focus is in the list; Focus gave it to the
   new tab. (a) The focused tab keeps it until focus leaves, then the new tab
   takes it, as the row says: roving focus never leaves the focused element
   out of the tab order. (b) The new tab takes it at once, so Tab from the
   focused tab goes to whatever follows the list in the page. Decided: (a),
   raised by the conformance scenarios.

## Open questions

None.
