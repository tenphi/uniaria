# AGENTS.md — @uniaria/elements

Read the root [AGENTS.md](../../AGENTS.md) first, especially "Custom elements
(light DOM)". Local rules:

- One generic `defineElement(definition, options)`; no Lit, no shadow DOM.
  Element classes are created inside the call, so the package imports in Node.
- The element never creates, moves or removes nodes it did not create, and
  writes only the attributes it owns (ARIA state, `data-state`) plus
  element-owned parts declared by the definition. A part keeps the `id` in
  the markup; UniAria writes one only where there is none, and the `*Id`
  props are no longer adopted from it. Attribute writes go through
  the DOM binder in `@uniaria/core/dom`, the same one the React adapter uses.
- Lifecycle: `connectedCallback` → `start()`, `disconnectedCallback` →
  `stop()`, `attributeChangedCallback` → `setProps()` then `sync()`.
- Owner lookup (root AGENTS.md → Composition between instances), with the
  first composed component: an id-reference attribute first
  (`group="plan"`), then the nearest owner through a bubbling request event.
  Owners announce themselves on connect so children that connected first
  can retry.
- Properties in, events out (`openchange` with `detail`). A bindable's
  property reads the current value (the instance's state, else
  `instance.getValue()`); setting it makes
  the value controlled, `undefined` uncontrolled, so reading and writing back
  the same value (`el.value = el.value`) controls it. Re-apply properties
  set before upgrade. Skip registration when the name is already defined.
- Each component gets one registering entry (`src/<name>.ts`) that calls
  `defineElement` with the default `uni-` prefix (`defineElement` returns
  `undefined` where there is no `customElements`) and declares the tag in
  `HTMLElementTagNameMap`. It needs an entry in `tsdown.config.ts`, an
  `exports` entry, a line in `src/ssr-safety.test.ts`, and a place in
  `sideEffects` in package.json, because importing it registers the element.
- `src/conformance-adapter.ts` implements the mount contract (it wraps the
  template's parts in the host and sets props as properties) and
  `src/conformance.browser.test.ts` runs every suite. Raise its `phase` as
  the roadmap advances.
- Tests also mount the elements inside React to prove the two never fight
  over DOM nodes.
