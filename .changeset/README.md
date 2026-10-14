# Changesets

Not used until the first release: until then, changes go straight to `main`
without changesets or version bumps.

From the first release on, every user-visible change gets a changeset: a
markdown file in this folder naming the affected packages and the bump. All
four published packages share one version (a `fixed` group), so bumping one
bumps them all.
