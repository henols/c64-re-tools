---
quick_id: 260819-vie
created: 2026-08-19
status: locked
source: defect diagnosed live during the v0.2.0 release, 2026-08-19
predecessor: 260819-tsz
---

# Context — the merge path never attaches release assets

## The defect, measured not inferred

v0.2.0 was published this session by pushing `main` (`089127a`). CI run
`32299050827` succeeded, and npm is correct. But the job outcomes were:

| job | outcome |
|---|---|
| `build` | success |
| `release-on-merge` | success |
| `publish-npm` | skipped |
| **`release`** | **skipped** |

`release` is the job that (a) runs `scripts/version.mjs stamp` on the plugin
manifests and (b) builds and attaches the installable plugin zip. It is gated
`if: startsWith(github.ref, 'refs/tags/v')`.

`release-on-merge` creates its tag with `gh release create` under `GITHUB_TOKEN`,
which by GitHub's design does not re-trigger workflows — ci.yml's own comment at
that step says so, calling it "no double publish". So **on the merge path the
`release` job can never run.**

Measured consequences:

- `gh release view v0.2.0 --json assets` -> `{"assets": []}`. The v0.2.0 GitHub
  Release has no installable plugin zip, so the `/plugin marketplace add` route
  has no artifact.
- `scripts/version.mjs stamp` never ran on this path, so `plugin.json` and
  `marketplace.json` would read `0.0.0-dev` in any artifact built there.

Unaffected and verified good: both npm packages. `release-on-merge` stamps and
publishes those itself — `npm view @henols/vice-mcp version` = `0.2.0`, and
`npm view @henols/c64-re-tools@0.2.0 dependencies` = `{ '@henols/vice-mcp': '0.2.0' }`.

## This is not a regression from 260819-tsz

The previous quick task moved the stamp step INTO the `release` job, but the
job's `refs/tags/v` gating and the GITHUB_TOKEN no-retrigger behaviour are both
pre-existing. Before that task the merge path attached no zip either, and
`plugin.json` was bumped by nothing at all. The gap is older than the fix that
exposed it.

## Locked decisions

**D-1 — One seam, not a copy-paste.** The three steps (stamp manifests, build the
zip, upload assets) move into ONE reusable place that both jobs call. Copying them
into `release-on-merge` would be exactly the "re-deriving a cross-cutting seam
locally" anti-pattern CLAUDE.md names. A shell script is the right home — the work
is `git archive` plus `gh release` calls, not something `version.mjs` should own.

**D-2 — Version arrives as an explicit argument.** Not read from
`GITHUB_REF_NAME` inside the seam. The tag path derives it from the tag; the merge
path passes the resolver's output. Same convention as `hostpath.ts`/`containerpath.ts`
taking the workspace root as an argument rather than resolving it themselves.

**D-3 — The merge path uploads after the release exists.** The existing upload
step is already idempotent (creates the release if absent, else attaches/replaces
assets). Reuse that property; do not add create-vs-update branching.

**D-4 — The `[skip release]` gate is load-bearing and must not drift.** It must
keep working byte-for-byte, the new steps must be gated on it too (a skipped
release builds and uploads nothing), and the check must be a real sha256 of the
extracted step block before and after — not a regex presence test. The previous
task's plan-checker specifically flagged regex-presence as insufficient proof of
byte-identity on this file.

**D-5 — v0.2.0's asset is attached retroactively** by running the new seam locally
against the existing tag with version `0.2.0`. Verify by extracting the uploaded
zip and reading `plugin.json` / `marketplace.json` out of it — do not assume the
stamp worked.

## The push hazard, stated explicitly

Pushing this fix to `main` would itself trigger `release-on-merge` and publish
**0.2.1**. That is not wanted; npm must stay at `0.2.0`. Therefore the commit that
lands this fix **must carry `[skip release]` in its subject line** — the gate does
`SUBJECT="$(git log -1 --pretty=%s)"` then `grep -qiF '[skip release]'`.

Nothing is pushed by this task. The orchestrator pushes after reviewing, and
checks the subject marker first.

## Permitted and forbidden

Permitted: `gh release upload` against the EXISTING `v0.2.0` release (D-5), and
read-only npm (`npm view`, `npm pack --dry-run`).

Forbidden: `git push`, `git tag`, deleting or moving any tag, `npm publish`,
`npm version` against the registry, and `gh release create` for any new version.

## Gates

- `bash scripts/package.sh` succeeds; `node scripts/check-npm-packages.mjs` passes
  with the new script absent from both tarballs.
- From `.claude/mcp/vice`: `npm run typecheck` clean, `npm run test:automated`
  green. Baseline is 1693 pass / 0 fail / 5 todo.
- `ci.yml` parses as YAML.
- Each changed `run:` block traced locally with the runner's own env var names,
  actual output reported.
