# Publishing

ConvexFS is distributed from GitHub version tags. `main` is the source branch
and does not track generated `dist/` artifacts. Release tags are consumable
snapshots that include `dist/` built from the source at that version.

## Version Contract

`package.json#version` is the source of truth for release tags.

When `package.json` changes on `main`, the release workflow:

1. Reads `package.json#version`.
2. Resolves the release tag as `v${version}`.
3. Refuses non-semver versions.
4. Refuses versions that are not greater than the latest `vX.Y.Z` tag.
5. Runs checks.
6. Builds `dist/`.
7. Creates an annotated tag containing a release-only commit with `dist/`.

If the tag already exists, the workflow exits without creating a new tag.

## Releasing

1. Update `package.json#version`.
2. Update `CHANGELOG.md`.
3. Commit and push to `main`.
4. Let `.github/workflows/release.yml` create the matching tag.

Consumers should depend on a version tag, not `main`:

```bash
bun add github:ethan-huo/convex-fs#v0.2.2
```

## Local Validation

Run the same source checks used by CI:

```bash
bun install --frozen-lockfile --ignore-scripts
bun run check
```

To inspect the release artifact shape locally:

```bash
rm -rf dist *.tsbuildinfo
bun run build
test -f dist/client/index.js
test -f dist/client/index.d.ts
test -f dist/component/convex.config.js
test -f dist/component/_generated/component.d.ts
```
