#!/bin/sh
# Remakes the reference screenshots of `src/screenshots.browser.test.ts` in
# Playwright's Docker image for the Playwright the repository installs:
# Ubuntu on x86-64, the Linux CI runs the comparison on (spec: Testing →
# Screenshots). It copies the working tree as it is, uncommitted changes
# included, installs it in the container, runs the test with `--update`
# and replaces `src/__references__/` with what it wrote, so a reference
# whose gallery is gone goes too. Review the changed images before
# committing them.
set -eu

root=$(git rev-parse --show-toplevel)
version=$(node -p "require('$root/node_modules/playwright/package.json').version")
image="mcr.microsoft.com/playwright:v$version-noble"
references=packages/styles/src/__references__
# Kept between runs, so an install downloads only what changed.
store="${XDG_CACHE_HOME:-$HOME/.cache}/uniaria-screenshots/pnpm-store"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
mkdir -p "$store"

cd "$root"
# No macOS metadata: `._` files would break Vite's dependency scan.
git ls-files -co --exclude-standard -z |
  COPYFILE_DISABLE=1 tar --no-xattrs --null -T - -cf - |
  docker run --rm -i --init --ipc=host --platform linux/amd64 \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    -v "$store:/store" -v "$out:/out" \
    "$image" sh -euc '
      mkdir /tmp/work && cd /tmp/work && tar -xf -
      corepack pnpm install --frozen-lockfile --store-dir /store
      rm -rf "$1"
      corepack pnpm vitest run --project browser --browser.name=chromium \
        packages/styles/src/screenshots.browser.test.ts --update
      cp -R "$1" /out/references
    ' sh "$references"

rm -rf "$references"
cp -R "$out/references" "$references"
git status --short -- "$references"
