---
quick_id: 260819-tsz
verified: 2026-08-19T00:00:00Z
status: partial
score: 5/6 verify_specifically criteria fully met (1 partial: README.md documents the superseded release mechanism)
gaps:
  - truth: "A maintainer following the repo's own documentation experiences 'not having to handle version numbers'"
    status: partial
    reason: "README.md's 'Publishing (maintainers)' section (lines ~202-216) was not touched by this task and still describes the OLD mechanism this task replaced: 'CI reads the current version from npm, bumps the patch' and 'For a minor or major bump, trigger a release manually ... Actions -> CI -> Run workflow'. Both statements are now inaccurate: the resolved number comes from the VERSION template (which can already yield a minor/major bump via rule 3, e.g. hand-editing 0.2.- to 0.3.- and pushing main), not from an npm-view-plus-patch-increment, and no manual workflow_dispatch is needed for a minor/major bump anymore -- editing VERSION and pushing main is sufficient. This directly undercuts the user's stated acceptance bar ('so we dont have to handle the version numbers ... if major or minor versions are updated by hand and pushed') for anyone who reads README.md rather than CONTEXT.md/SUMMARY.md to learn the process."
    artifacts:
      - path: "README.md"
        issue: "Publishing section describes deprecated inline npm-view+patch-increment mechanism and an unnecessary manual workflow_dispatch step for minor/major bumps; does not mention VERSION or scripts/version.mjs at all"
    missing:
      - "Update README.md's 'Publishing (maintainers)' section to state: bump VERSION by hand for major/minor (e.g. 0.2.- -> 0.3.-) and push main; release-on-merge resolves and publishes automatically via scripts/version.mjs; workflow_dispatch / manual tag push remains only for the plugin-zip-asset alternative path (R-3)."
---

# Quick Task 260819-tsz Verification Report

**Goal:** One source of truth for the version -- a `VERSION` template at repo
root using `-` for auto-managed slots -- plus a resolver script, wired into
CI, replacing every hand-maintained version string. Readable at runtime from
the package. Hand-editing major/minor must publish X.Y.0, never continuing
the old patch count.

**Status:** partial
**Verified:** 2026-08-19

All hard technical claims in SUMMARY.md were independently reproduced against
the live repository and the live npm registry, not merely read. One residual
finding: the project's own README.md was left describing the release
mechanism this task replaced, which partially undercuts the "we don't have
to handle version numbers" experience for a maintainer who trusts README
over CONTEXT.md.

## Verification by `<verify_specifically>` criterion

### 1. "so we don't have to handle the version numbers" -- full release-flow walk

Traced end to end, independent of SUMMARY.md's narrative:

- **Patch release:** merge to `main`. `release-on-merge`'s gate step reads
  `git log -1 --pretty=%s` (unchanged, confirmed by diff below) and, absent
  `[skip release]`, runs `node scripts/version.mjs resolve --github-output`.
  Ran this literally against the live registry from the repo root:
  `resolved 0.2.0 (rule=prefix-differs, published=0.1.12)`. A human touches
  **zero files** for a patch (the template `0.2.-` never changes for a
  patch bump under R-1).
- **Minor/major release:** hand-edit `VERSION` (e.g. `0.2.-` -> `0.3.-`),
  push `main`. Rule 3 (`prefix-differs`) fires because the literal prefix no
  longer matches published, so `resolveVersion` resets every `-` to 0 --
  confirmed directly against `version.ts`'s `resolveVersion()` and the
  worked-example test table (`0.3.-` / `0.2.7` -> `0.3.0`, rule
  `prefix-differs`, `.claude/mcp/vice/version.test.ts:40`). A human touches
  **one file** (`VERSION`) for a minor/major bump. This is the crux of the
  user's literal ask and it is implemented exactly as specified.
- **Confirmed no other file requires hand-editing per release:** the six
  previously-hand-maintained strings are now `0.0.0-dev` and are stamped by
  automation (`npm version` for the two npm packages inside `publish-npm`/
  `release-on-merge`; `scripts/version.mjs stamp` inside the `release` job
  for the plugin manifests) -- verified by reading the actual `ci.yml` diff,
  not the SUMMARY's description of it (see criterion 4 below).

**Gap found:** README.md's "Publishing (maintainers)" section (untouched by
this task -- not in `files_modified`) still tells a maintainer to use
`Actions -> CI -> Run workflow` for a minor/major bump and describes the
release number as "CI reads the current version from npm, bumps the patch."
Both statements are now wrong/incomplete: minor/major no longer needs manual
`workflow_dispatch` (edit `VERSION`, push `main`), and the number source is
the `VERSION` template, not an npm-view increment. A maintainer who only
reads README, not CONTEXT.md, would still believe they must "handle" a
release manually for anything but a patch -- the literal condition the user
asked to remove. This is a real, observable gap in the delivered outcome,
even though it was outside the plan's declared `files_modified` list.

### 2. "read out from the package" -- runtime read, concretely proven

Independently simulated both runtime states (did not trust the SUMMARY's
"never throws" claim -- ran it):

```
$ node --input-type=module -e '
  const { runtimeVersion } = await import(".../version.ts");
  let called = 0;
  const v = runtimeVersion({
    pkgJsonPath: "<scratch>/package.json" (contains {"version":"0.1.12"}),
    repoRoot: () => { called++; return "/nonexistent"; }
  });
  console.log(v, called);
'
published-tarball simulated version: 0.1.12 repoRoot called: 0
```

Confirms: (a) a published-tarball layout returns the real npm version, (b)
the `repoRoot` thunk is genuinely never invoked in that path (the "silence
guarantee" claimed in the file header is real, not aspirational).

Also ran the degenerate case (no real package version, no VERSION
reachable): returns `0.0.0-dev`, never throws.

Ran the actual dev-checkout construction site's inputs directly:
`runtimeVersion({ pkgJsonPath: ".claude/mcp/vice/package.json", repoRoot:
() => repoRoot() })` against this real repo returns `0.2.0-dev`. This is an
honest improvement over the old `PROXY_VERSION = "0.1.0"` (a fake-looking-
real but stale number) -- `0.2.0-dev` is unambiguous that it is not a
release build, which is a net improvement, not a regression, over MCP
`initialize` in a dev checkout.

### 3. Exhaustive search for a missed seventh hand-maintained string

Grepped every `package.json`/`plugin.json`/`marketplace.json` in the repo,
`README.md`, `docs/tool-support.md`, `.mcp.json`, `installer/` templates,
and all SKILL.md frontmatter. Findings:

- All six R-2 derived strings correctly read `0.0.0-dev` (verified by direct
  `cat`, not by re-running the pinning test).
- `.claude/mcp/vice/package-lock.json`'s own top-level `"version"` field
  still reads `0.1.1` (npm-generated, not hand-edited). Verified this is
  **not a live gap**: reproduced `npm version 0.2.0 --no-git-tag-version` in
  a scratch copy of the real `package.json` + `package-lock.json` pair, and
  confirmed `npm version` rewrites the lockfile's version field too. Since
  CI's publish steps run `npm version` before `npm publish`, the lockfile
  in the actual publish is stamped correctly; only the working tree's
  never-published lockfile lags, which is inert.
- No `.mcp.json`, no SKILL.md frontmatter, and no installer template
  contains a version literal.
- `README.md` line ~205-216 is the one place a version-*process* claim
  (not a version *number*) is stale -- see criterion 1's gap.

No undiscovered eighth hand-maintained version number was found.

### 4. CI wiring -- actually run, not narrated

Ran every changed `run:` block's shell body locally against the real repo
state and the live registry (not GitHub Actions, per the constraint, but the
identical commands with the identical env variable names):

```
$ SUBJECT="$(git log -1 --pretty=%s)"   # gate step logic, verbatim
docs(quick-260819-tsz): complete VERSION template + resolver seam quick task
-> release=true   (no "[skip release]" in the subject)

$ GITHUB_OUTPUT=/tmp/.../tsz-gho.txt node scripts/version.mjs resolve --github-output
resolved 0.2.0 (rule=prefix-differs, published=0.1.12)
$ cat /tmp/.../tsz-gho.txt
version=0.2.0
published=0.1.12
rule=prefix-differs

$ GITHUB_REF_NAME=v0.2.0; echo "${GITHUB_REF_NAME#v}"   # release job's stamp step
0.2.0

$ GITHUB_REF_NAME=v0.2.0; echo "version=${GITHUB_REF_NAME#v}"   # publish-npm tag path
version=0.2.0
```

Also ran `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
-- parses cleanly. Ran `git diff 93df581..HEAD -- .github/workflows/ci.yml`
directly (not trusting the SUMMARY's sha256 claim) and confirmed by eye:
the "Decide whether to release" gate step block is untouched; only the
"Compute next patch version" step (renamed "Resolve version from the
VERSION template") and a new stamp step in the `release` job were added;
`publish-npm`'s job body does not appear in the diff at all, confirming it
is byte-for-byte unchanged. `grep -n "outputs.current"` returns no hits --
the dangling reference the plan worried about is genuinely gone.

### 5. R-3 release path for the pending v0.2.0

Traced directly:

- `git tag -l v0.2.0 -n1` -> points at `93df581` ("chore: remove
  REQUIREMENTS.md for v0.2.0 milestone"), which predates all six commits of
  this task. Confirmed via `git log -1 --oneline 93df581` matching exactly
  what SUMMARY claims.
- Confirmed the tag is local-only: no CI workflow trigger reacts to a local
  tag; only `git push --tags` or a `v*` tag push over the wire fires
  `release`/`publish-npm`. Nothing in this task's `git log` pushed it.
- Confirmed the actual push-main path resolves to exactly `0.2.0`: ran
  `node scripts/version.mjs resolve --github-output` against the live
  `npm view @henols/vice-mcp version` (`0.1.12`) from the repo root -- same
  command the real CI step will run when `main` is pushed -- and got
  `0.2.0`, `rule=prefix-differs`. This matches R-3's claim exactly.
- **Way this can go wrong on the real push, not previously called out as
  sharply:** if a second npm publish lands on the registry between now and
  when the user pushes `main` (e.g. a stray manual `workflow_dispatch`),
  `published` would no longer be `0.1.12` and the resolved version could
  differ from `0.2.0`, though the strictly-greater guard would still refuse
  a nonsensical result rather than publish something wrong. This is a
  narrow timing window inherent to any "resolve against live npm at release
  time" design, already implicitly covered by the guard, not a defect
  introduced by this task.

## Score

5 of 5 hard technical must-haves (D-1 through D-5, all `must_haves.truths`
in the PLAN frontmatter) verified directly against the codebase and, where
possible, against the live npm registry -- not accepted from SUMMARY.md's
narration. 1 softer criterion (README.md's documented release process)
found stale and misleading relative to the new, better mechanism this task
actually built.

## Anti-Patterns Found

None in the files this task modified. `version.ts`, `version.mjs`, and the
`ci.yml`/`check-npm-packages.mjs` diffs contain no `TODO`/`FIXME`/`XXX`/
placeholder markers, no stub returns, and no empty handlers.

## Human Verification Required

None. Every claim in this report was reproduced with a concrete command and
its actual output, including one live (read-only) call to the real npm
registry.

## Gaps Summary

The mechanism itself is real, tested against the live registry, and matches
the user's literal acceptance bar (`-` defaults to 0 on a hand major/minor
bump; a human only ever edits `VERSION`). The one gap is that README.md
still documents the pre-existing, now-superseded release process and
therefore does not reflect that a minor/major release no longer needs a
manual `workflow_dispatch` step -- a maintainer who trusts README over
CONTEXT.md would still believe they have "version numbers to handle" for
anything but a patch. This was out of the plan's declared `files_modified`
scope, so it is reported as a documentation gap rather than a broken
must-have, but it directly touches the phrase "so we dont have to handle
the version numbers" from the user's own acceptance bar and should be
closed before this is considered fully done from a maintainer's point of
view.

---

_Verified: 2026-08-19_
_Verifier: Claude (gsd-verifier)_
