---
applyTo: "**/package-lock.json"
---

# Updating `package-lock.json`

When updating a dependency (for example to resolve a security advisory), keep the
change as small as possible and follow these rules:

## 1. Prefer updating only `package-lock.json`; leave `package.json` untouched

- If the existing semver range in `package.json` already allows the target
  version, update **only** `package-lock.json`. Regenerate it with
  `npm install --package-lock-only` (run from the repository root, which
  contains `package.json`/`package-lock.json`).
- Most dependency bumps in this repo are lock-only. For example,
  `js-yaml@4.2.0` already satisfies the existing `^4.1.0` range, and
  `@babel/core@7.29.6` already satisfies the existing `^7` ranges, so no
  `package.json` change is needed — pinning the new version in
  `package-lock.json` is enough.
- Only modify `package.json` (by adding an `overrides` entry or a direct
  dependency) when it is required to keep `package-lock.json` in sync and valid
  — for example when a parent package pins a transitive dependency to an
  **exact** version, so that a lock-only bump is reverted on the next
  `npm install`/`npm ci`.

## 2. When an override is needed, override to `^X.Y.Z` (roll-forward), not exact `X.Y.Z`

- Prefer `^X.Y.Z` so the dependency rolls forward to future minor and patch
  releases, rather than pinning the exact `X.Y.Z`.
- Add the override consistent with the existing structure in `package.json`. In
  this repo, `overrides` are nested under the parent package key (for example
  `glob` is overridden under `copyfiles`, `rimraf`, and `test-exclude`), not at
  the top level.

## 3. Beware overrides that break transitive consumers

- An `overrides` entry forces **every** consumer to the new version, including
  transitive ones that may rely on removed APIs. Do not add an override unless
  you have confirmed the affected consumers still work.
- Known example: forcing `js-yaml` to `4.x` via `overrides` breaks
  `@azure/openapi-markdown` and `front-matter`, which call `js-yaml.safeLoad`
  (removed in js-yaml 4.x). This causes readme-parsing tests in
  `exampleGeneratorTests` to fail (YAML parses to empty). Do not add this
  override.
- Some transitive advisories cannot be remediated by a lock or `package.json`
  change (for example when there is no patched `3.x` release and the parent
  package still requires the vulnerable major). In that case, do not force a
  breaking override or regenerate snapshots to hide the failure — leave the
  dependency as-is and defer to a maintainer on how to handle the alert
  (e.g. suppress/dismiss vs. wait for an upstream bump).

## 4. Keep the change scoped to the dependency update

- The diff should be limited to `package-lock.json` (and `package.json` only
  when strictly required, per the rules above). Do not commit unrelated files.
- Never modify Jest snapshots or test fixtures to make a dependency change
  "pass". A snapshot that changes because of a dependency bump usually signals a
  real regression — investigate it rather than regenerating the snapshot.

## 5. Validate the result

- After any change, run `npm ci` at the repository root to confirm
  `package-lock.json` is consistent with `package.json`. `npm ci` failing with
  an "Invalid: lock file's ... does not satisfy ..." error means an override (or
  a `package.json` change) is still required.
- Run `npm run build` and `npm test` to confirm the build and the full test
  suite still pass. Do not run a single test case in isolation (for example
  `jest -t`) for `exampleGeneratorTests`, because those tests share cumulative
  state and can produce false snapshot failures; run the full suite.
- Verify the intended package resolves to the target version in
  `package-lock.json`. Note that an override does not necessarily remove every
  reference to the old version: a parent's own dependency list may still record
  its original pinned version even though the resolved package was overridden.
  Make PR descriptions accurate about which references remain.
