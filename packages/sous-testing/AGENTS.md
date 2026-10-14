# AGENTS.md — @tenphi/sous-testing

Read the root [AGENTS.md](../../AGENTS.md) first. Local rules:

- `createInstance(definition, props)` drives part handlers and reads `attrs`
  with no framework and no DOM; it must run in the `node` test project.
- The conformance runner defines the `mount(component, props)` contract each
  adapter implements; scenarios in `conformance/` depend only on that contract.
- Screen-reader helpers wrap `@guidepup/virtual-screen-reader` (every pull
  request) and `@guidepup/guidepup` with `@guidepup/playwright` (nightly).
  These are the only screen-reader dependencies; MCP kits stay out of the repo.
