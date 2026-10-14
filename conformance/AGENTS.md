# AGENTS.md — conformance

Read the root [AGENTS.md](../AGENTS.md) first. This folder is the oracle every
adapter is judged by, so it has the strictest rules in the repo:

- **Every change needs the owner's approval.** Scenarios come from an approved
  component spec and land in a pull request with no implementation changes.
  CI fails pull requests that touch both; only the owner's
  `conformance-approved` label overrides it.
- Never edit a scenario to make an implementation pass. If a scenario looks
  wrong, stop and explain why to the owner.
- Scenarios are adapter-agnostic: they mount through the `mount(component,
props)` contract from `@tenphi/sous-testing` and assert on the DOM, keyboard
  behavior, focus movement and spoken output (virtual screen reader).
- One folder per component, `conformance/src/<name>/`, mirroring the spec's
  keyboard map and ARIA table.
