---
title: Compared with others
description: How UniAria differs from React Aria, Radix, Headless UI, Base UI and Zag, and when to pick one of them instead.
---

UniAria is a headless library, like React Aria, Radix Primitives, Headless
UI, Base UI and Zag.js: it gives components their behavior and accessibility
and leaves the look to you. What sets it apart is a handful of design
choices, which this page goes through.

|                | Frameworks                                                   | What you use                                            | Overlays     |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ------------ |
| UniAria        | React, Vue, and custom elements for any other framework      | Props on your own markup                                | Top layer    |
| React Aria     | React                                                        | Hooks that return props, or React Aria Components       | Portal       |
| Radix          | React                                                        | Components                                              | Portal       |
| Headless UI    | React and Vue, as separate implementations                   | Components                                              | Portal       |
| Base UI        | React                                                        | Components                                              | Portal       |
| Zag.js, Ark UI | React, Vue, Solid, Svelte, and plain DOM wired by hand (Zag) | Props from Zag's state machines, or Ark UI's components | Portal (Ark) |

## One definition, three adapters

Most headless libraries are written for one framework. Ports to another,
such as Radix's to Vue, are separate projects that follow the original at
their own pace, and their accessibility can drift from it.

UniAria writes each component once, in plain TypeScript, and binds it to
React and to Vue with two small generic adapters. Zag.js works the same way.
UniAria adds a third adapter: every component is also a light-DOM custom
element, so Svelte, Angular, server-rendered templates and plain HTML use the
same implementation without an adapter of their own. A fix lands in one
place, and the same [conformance scenarios](./accessibility.md) check it in
every adapter.

## No re-renders for internal state

In most libraries, interaction state is framework state. React Aria's
`useHover`, `usePress` and `useFocusRing` each hold theirs in `useState`, and
Zag's React and Vue adapters keep a machine's values in framework state, so
hovering, pressing or moving a highlight renders the component again.

UniAria writes that state straight to the DOM: hover, press, focus, a
highlighted option and an opening popover change attributes on your elements,
and your React or Vue component doesn't render. It renders again only for
the state it [selects](./state.md#reading-state). For one button the
difference is small. It shows in long lists, in pages with many components,
and in design-system components whose render is expensive.

## Your markup, not components

Radix, Headless UI, Base UI, Ark UI and React Aria Components give you
components with an API of their own. UniAria gives you props for each part,
as React Aria's hooks and Zag do: you spread them onto your own elements, and
your design system decides the components its users see. You write more
markup, and in exchange you control every element in the tree.

## Native elements and the top layer

A real `<button>`, `<input>` or `<dialog>` sits under each component wherever
HTML has one. Overlays open in the browser's top layer, with `<dialog>` and
the Popover API, where most libraries render them through a portal at the
end of `<body>`. The overlay's markup stays next to its trigger, so the tab
order, React context, what Vue provides and CSS inheritance stay intact. See
[Overlays](./overlays.md).

One behavior differs from React Aria on purpose: a click outside an open
popover closes it and also acts on what it hit, so a single click on another
button closes the menu and presses that button. In React Aria the first click
only closes the popover.

## Custom elements in the light DOM

Web component libraries such as Shoelace and Spectrum Web Components render
into a shadow root and ship a look of their own, so you style them through
the parts and custom properties they expose. UniAria's elements wrap your
markup and stay in the light DOM: your `<input>` is a real input in your
form, and your CSS styles it like any other element. See
[Custom elements](../api/elements.md).

## Accessibility checked in every adapter

Every component follows its
[WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/)
pattern. The same scenarios drive real mouse, touch and keyboard input in
Chromium, Firefox and WebKit, through React, Vue and custom elements, check
what a virtual screen reader says on every push, and run against VoiceOver
and NVDA every night. React Aria remains the reference for browser and
screen-reader edge cases, and its testing across devices and assistive
technology is broader. See [Accessibility](./accessibility.md).

## An optional look

Headless doesn't mean you start from nothing. The optional
[default styles](./default-styles.md) give every component a look you can
keep, [retheme](./theming.mdx) or replace part by part. They are CSS, prebuilt
or built with your changes, or Tasty style objects, written against the same
part markers and state attributes your own CSS would use, so they style the
markup you already write. Nothing else in UniAria depends on them. Radix
Themes and React Spectrum, by contrast, are component libraries of their
own, built on their headless layer.

## When to pick something else

- **You need a component UniAria doesn't have yet**, such as a menu, tabs, a
  table, a tree, a date picker, toasts or drag and drop. React Aria has the
  widest set.
- **You want ready-made components** with an API of their own rather than
  props on your markup: Radix, Base UI, Headless UI or Ark UI.
- **You want Solid or Svelte bindings.** UniAria's custom elements work
  there, but Zag.js and Ark UI have adapters for those frameworks.
- **You need a stable API today.** UniAria is at 0.x, and its APIs can change
  in any 0.x version.
