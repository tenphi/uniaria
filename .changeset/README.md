# Changesets

Every user-visible change to a published package gets a changeset: a
markdown file in this folder, made with `pnpm changeset`, naming the affected
packages and the bump (`minor` for a feature or a breaking change while
versions are 0.x, `patch` for the rest). It goes in the same pull request as
the change. All published packages share one version (a `fixed` group), so
bumping one bumps them all. Releasing is the owner's: see AGENTS.md →
Releasing.
