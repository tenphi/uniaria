# AGENTS.md — @tenphi/sous-elements

Read the root [AGENTS.md](../../AGENTS.md) first, especially "Custom elements
(light DOM)". Local rules:

- One generic `defineElement(definition, options)`; no Lit, no shadow DOM.
  Element classes are created inside the call, so the package imports in Node.
- The element never creates, moves or removes nodes it did not create, and
  writes only the attributes it owns (ARIA state, `data-state`) plus
  element-owned parts declared by the definition. Attribute writes go through
  the DOM binder in `@tenphi/sous/dom`, the same one the React adapter uses.
- Lifecycle: `connectedCallback` → `start()`, `disconnectedCallback` →
  `stop()`, `attributeChangedCallback` → `setProps()` then `sync()`.
- Properties in, events out (`openchange` with `detail`). Re-apply properties
  set before upgrade. Skip registration when the name is already defined.
- Each component gets one registering entry that calls `defineElement` with
  the default `sous-` prefix and guards on `typeof customElements`.
- Tests also mount the elements inside React to prove the two never fight
  over DOM nodes.
