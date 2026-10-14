# AGENTS.md — conformance

Read the root [AGENTS.md](../AGENTS.md) first. This folder is the oracle every
adapter is judged by, so it has the strictest rules in the repo:

- **Every change needs the owner's approval.** Scenarios come from an approved
  component spec and land in commits with no implementation changes. CI fails
  any commit or pull request that touches both; only the owner's
  `conformance-approved` label on a pull request overrides it.
- Never edit a scenario to make an implementation pass. If a scenario looks
  wrong, stop and explain why to the owner.
- Scenarios are adapter-agnostic: they mount through the contract in
  `@tenphi/sous-testing` (root AGENTS.md → The mount contract) and assert on
  the DOM, keyboard behavior, focus movement, events, public state, render
  counts and spoken output (virtual screen reader). Never import a
  definition or an adapter here.
- Each suite declares its `Props` and `State` types from the approved spec,
  and tags scenarios that need a later roadmap phase (`{ phase: 2 }`).
- One folder per component, `conformance/src/<name>/`, mirroring the spec's
  keyboard map and ARIA table.
