---
quick_id: 260819-vie
phase: quick-260819-vie
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-1, D-2, D-3, D-4, D-5]
files_modified:
  - scripts/release-assets.sh
  - .github/workflows/ci.yml
  - .claude/mcp/vice/host-scripts.test.ts
  - .claude/mcp/vice/ci-guardrails.test.mjs

must_haves:
  truths:
    - "Exactly ONE place in the repo stamps the manifests, builds the zip and attaches the release assets; both CI release paths call it and neither re-derives it (D-1)."
    - "A merge to main that releases attaches the plugin zip + .sha256 to the release it just created (the v0.2.0 defect cannot recur)."
    - "A v* tag push attaches the same two assets through the same seam."
    - "The seam receives the version as an explicit argument at every call site; it never reads GITHUB_REF_NAME itself (D-2)."
    - "Running the seam locally leaves the developer's working tree, index, HEAD, branch set and worktree list exactly as they were, and leaves no commit reachable from main."
    - "The zip's own plugin.json / marketplace.json carry the same version as the zip filename, or the seam exits non-zero."
    - "A commit subject carrying [skip release] still skips the entire release, assets included; the gate step's bytes are unchanged (D-4)."
    - "GitHub release v0.2.0 carries c64-re-tools-0.2.0.zip whose internal manifests read 0.2.0 (D-5)."
  artifacts:
    - path: "scripts/release-assets.sh"
      provides: "The one stamp -> zip -> attach seam"
      min_lines: 70
      contains: "worktree add"
    - path: ".github/workflows/ci.yml"
      provides: "Both release paths wired to the seam"
      contains: "scripts/release-assets.sh"
    - path: ".claude/mcp/vice/host-scripts.test.ts"
      provides: "Frozen tracked-shell-script set grown deliberately by one"
      contains: "scripts/release-assets.sh"
    - path: ".claude/mcp/vice/ci-guardrails.test.mjs"
      provides: "Drift guard: the seam is wired into exactly two release steps, gated, and nothing re-derives its three steps"
      contains: "release-assets.sh"
  key_links:
    - from: ".github/workflows/ci.yml (release job)"
      to: "scripts/release-assets.sh"
      via: "run: bash scripts/release-assets.sh \"${GITHUB_REF_NAME#v}\" \"${GITHUB_REF_NAME}\""
      pattern: "release-assets\\.sh"
    - from: ".github/workflows/ci.yml (release-on-merge job)"
      to: "scripts/release-assets.sh"
      via: "run step after 'Create tag + GitHub release', gated on steps.gate.outputs.release"
      pattern: "steps\\.gate\\.outputs\\.release"
    - from: "scripts/release-assets.sh"
      to: "scripts/version.mjs stamp"
      via: "node \"$WT/scripts/version.mjs\" stamp \"$VERSION\" inside the temp worktree"
      pattern: "version\\.mjs\" stamp"
    - from: "scripts/release-assets.sh"
      to: "scripts/package.sh"
      via: "bash \"$WT/scripts/package.sh\" (git archive HEAD of the stamped ephemeral commit)"
      pattern: "package\\.sh"
    - from: "scripts/release-assets.sh"
      to: "GitHub Releases"
      via: "gh release upload --clobber with explicit artifact paths"
      pattern: "gh release upload"
---

<objective>
`release` — the only job that stamps the manifests and attaches the plugin zip — is
gated `startsWith(github.ref, 'refs/tags/v')` and therefore **can never run on the
merge path**, because `release-on-merge` creates its tag with `GITHUB_TOKEN` and
GitHub deliberately does not re-trigger workflows for that. v0.2.0 shipped with
`{"assets": []}` as a direct result.

Extract the three steps (stamp manifests / build zip / attach assets) into ONE
shell seam, `scripts/release-assets.sh`, called by **both** release paths (D-1),
taking the version as an explicit argument (D-2), reusing the existing idempotent
create-or-upload block verbatim (D-3), gated on the untouched `[skip release]`
check (D-4). Then attach v0.2.0's missing asset retroactively by running the same
seam locally against the existing tag (D-5).

Purpose: the `/plugin marketplace add` route has no artifact for v0.2.0, and the
next merge-path release would repeat the defect.
Output: one new script, two rewired CI jobs, two grown drift guards, and a
verified `c64-re-tools-0.2.0.zip` on the existing v0.2.0 release.
</objective>

## MANDATORY: `[skip release]` goes in EVERY commit subject of this task

The gate reads **only the tip commit**: `SUBJECT="$(git log -1 --pretty=%s)"` then
`grep -qiF '[skip release]'`. So it is not enough for the `ci.yml` commit to carry
the marker — whichever commit is HEAD when the orchestrator pushes must carry it,
and that is the LAST commit this task makes (the SUMMARY doc commit, per
`commit_docs: true`). A `ci.yml` commit marked `[skip release]` followed by an
unmarked `docs(...): summary` commit would publish **0.2.1** to npm, which
CONTEXT.md forbids.

Therefore: put `[skip release]` in the subject line of **every** commit this task
creates — plan doc, task 1, task 2, task 3, and the SUMMARY. Verify after each
commit with `git log -1 --pretty=%s | grep -qF '[skip release]'`, and before
handing back with:
`git log origin/main..HEAD --pretty=%s | grep -cvF '[skip release]'` must print `0`.

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260819-vie-extract-release-stamp-zip-upload-into-on/260819-vie-CONTEXT.md
@CLAUDE.md
@.github/workflows/ci.yml
@scripts/package.sh
@scripts/version.mjs
</context>

## Design decisions resolved during planning (do not re-litigate at execution)

### 1. Where the seam lives and what its contract is (D-1, D-2)

`scripts/release-assets.sh` — a bash script, per D-1 ("the work is `git archive`
plus `gh release` calls, not something `version.mjs` should own"; `version.mjs`'s
own header forbids ever adding a git or publish code path to it).

Signature: `scripts/release-assets.sh <version> [<ref>] [--dry-run]`

- `<version>` — REQUIRED, bare semver, **no leading `v`**. Validated against
  `^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$`; a value starting with `v` is a
  named hard error, because `v0.2.0` would silently produce
  `c64-re-tools-v0.2.0.zip`. This is D-2's explicit argument — the seam never
  reads `GITHUB_REF_NAME`, `GITHUB_SHA` or `VERSION` itself.
- `<ref>` — OPTIONAL git ref to build from, default `HEAD`. All three real call
  sites pass it explicitly (tag path: the tag; merge path: `github.sha`; D-5:
  `v0.2.0`), so the artifact provably matches the ref being released.
- `--dry-run` — build and self-verify, then print what *would* be uploaded and
  exit 0 without any `gh` invocation. This exists so the human-local path can be
  rehearsed before touching a published release, and so the seam is verifiable in
  CI-less isolation.
- Tag name is derived as `TAG="v$VERSION"` (single argument, one less thing to
  desync — both existing call sites already build exactly that string).

Environment: `git`, `node` (>= 22.18 — `version.mjs` dynamically imports the
type-stripped `version.ts`), `unzip`, `sha256sum`, and `gh` (unless `--dry-run`),
each checked in a preflight loop that fails with `release-assets: ERROR: <tool> is
required`. Auth is `gh`'s own concern: `GH_TOKEN` in CI (both jobs pass
`${{ github.token }}`), an interactive `gh auth login` locally. The seam reads no
token itself. **No git identity is required from the caller** — the ephemeral
commit passes `-c user.name=github-actions[bot] -c user.email=...` inline, exactly
the identity the current `release` job uses, so a machine with no configured
identity works and the user's config is never consulted or changed.

Idempotent and safe to re-run: every run builds from `<ref>` in a throwaway
worktree, so byte-for-byte the same zip, and uploads with `--clobber`. The single
non-idempotent branch is `gh release create`, which only fires when the release is
absent (D-3, kept verbatim).

### 2. The ephemeral stamp commit — isolation and the empty-commit trap (Q2)

**Isolation: a detached temporary worktree, not stash-and-restore.**
`TMPROOT="$(mktemp -d)"`, `WT="$TMPROOT/wt"` (a *non-existent child* of the temp
dir — `git worktree add` refuses an existing path), then
`git worktree add --detach "$WT" "$REF"`, with an `EXIT` trap doing
`git worktree remove --force "$WT"`, `git worktree prune`, `rm -rf "$TMPROOT"`.
Verified working against this repo during planning (`add` at `v0.2.0` + `remove`
both clean, `git worktree list` back to one entry).

Why a worktree beats stashing: the caller's working tree, index and HEAD are never
touched at all, so the seam is safe with a dirty tree; the stamp commit lands on a
**detached HEAD inside the throwaway worktree**, so after removal it is
unreferenced by any branch or ref — no stray commit on `main`, nothing to undo, no
stash to lose. It also makes the merge path deterministic: by the time the seam
runs, `npm version` and `npm pkg set` have already dirtied the runner checkout's
`package.json` files, and a fresh worktree of the commit ignores all of that.

**The empty-commit trap (Q2a): yes, it can happen, and it must not fail.**
`git commit -am` exits non-zero when there is nothing staged, which under
`set -euo pipefail` would abort the seam *after* stamping and *before* zipping —
a hard failure for a state that is actually correct. It triggers whenever
`<ref>`'s six derived strings already equal `<version>` (a release cut from a
branch where someone hand-stamped; a `<ref>` that is itself a stamped commit).
The seam therefore guards it: `if git -C "$WT" diff --quiet; then` note
"manifests at $REF already read $VERSION — nothing to commit" `else` commit `fi`.
All six R-2 locations are tracked files, so `git diff` is the right predicate.

### 3. What the merge path passes as the version (Q3)

`steps.ver.outputs.version`, produced by the existing `Resolve version from the
VERSION template` step (`id: ver`) in the **same job**, so it is in scope for
every later step of `release-on-merge`. The new step goes **after** `Create tag +
GitHub release` (currently the job's last step), so the release always exists when
the seam runs and D-3's `create` branch cannot fire on this path. `permissions:
contents: write` and `setup-node@v4` are already present in that job under the
same gate condition, so nothing else needs adding.

### 4. Can `release` and `release-on-merge` both fire for the same version? (Q4)

**Not in normal operation.** A push event is either to `refs/heads/main` or to
`refs/tags/v*`, never both, and the tag `release-on-merge` creates under
`GITHUB_TOKEN` does not re-trigger the workflow (that is the whole cause of this
defect). So each release runs exactly one of the two paths.

**One reachable exception:** a hand-crafted push of `main` *and* a `v*` tag (e.g.
`git push --atomic origin main v0.2.0`) produces two separate workflow runs, one
per ref. If the tag equals what the VERSION template resolves to, both paths
target `v0.2.0`. The outcome is *not* duplicated assets: both build from the same
commit (`git archive` is deterministic for a fixed commit) and upload with
`--clobber` under identical filenames, so the second write replaces identical
bytes. What *does* break first, loudly and pre-existing, is `npm publish` —
whichever side loses the race gets a registry 409 — and `gh release create` in
`release-on-merge` fails "release already exists". This is precisely the scenario
quick-260819-tsz's R-3 already tells the operator not to create. No new guard is
added for it: it is louder and earlier on the npm side than anything the asset
step could add.

### 5. How D-5's retroactive attach is performed (Q5)

Tag `v0.2.0` = `089127a` locally **and** on the remote (`git ls-remote origin
refs/tags/v0.2.0` confirms), and `089127a` is also `origin/main` and this
checkout's HEAD. `gh release view v0.2.0 --json assets` returns `{"assets":[]}`.

Exact command, run from the repo root of this checkout:
`bash scripts/release-assets.sh 0.2.0 v0.2.0`

Ref `v0.2.0` (not `HEAD`) so the archive contains exactly v0.2.0's tracked files —
notably *not* the new seam script, which is correct: the artifact must represent
the released commit. Both `scripts/package.sh` and `scripts/version.mjs` exist at
`089127a` (quick-260819-tsz landed there), and the seam invokes the **worktree's
own copies** (`$WT/scripts/...`), each of which resolves its own root from
`BASH_SOURCE`/`import.meta.url` — so no env juggling is needed and the historical
copies are what run.

Verification is against the **downloaded** asset, not the local `dist/` copy:
`gh release download v0.2.0 --pattern '*.zip*' --dir <tmp> --clobber`, then
`sha256sum -c` the sidecar, then `unzip -p <tmp>/c64-re-tools-0.2.0.zip
'c64-re-tools-0.2.0/.claude-plugin/plugin.json'` and the same for
`marketplace.json`, asserting `.version == "0.2.0"` and
`.plugins[0].version == "0.2.0"` (the zip prefix is `<name>-<version>/`, name
`c64-re-tools`, per `package.sh`).

### 6. Two hazards found in the current CI code that the seam must not inherit

- **`dist/*.zip` globs are unsafe outside a runner.** This checkout's `dist/`
  currently holds `c64-re-tools-0.0.0-dev.zip`, `c64-re-tools-0.1.1.zip` and
  `c64-re-tools-9.9.9.zip`. The existing `gh release upload "$TAG" dist/*.zip
  dist/*.zip.sha256` is only safe because a runner's `dist/` is fresh; run
  locally it would attach a dev build and a bogus 9.9.9 build to the release. The
  seam therefore computes `NAME` from the worktree's `plugin.json` and uploads
  **exactly** `dist/${NAME}-${VERSION}.zip` and its `.sha256`, asserting both
  exist first. Never a glob.
- **`.claude/mcp/vice/host-scripts.test.ts` freezes the tracked shell-script
  set.** `EXPECTED_TRACKED_SHELL_SCRIPTS` (3 entries) is asserted `deepEqual`
  against `git ls-files -- '*.sh'`; adding a fourth `.sh` turns that test red by
  design. Its own comment demands the array "grows only by a deliberate,
  committed edit" — so the edit belongs in the same commit as the new script, with
  a comment saying why it grew.

<tasks>

<task type="auto">
  <name>Task 1: The one seam — scripts/release-assets.sh, provably isolated</name>
  <files>scripts/release-assets.sh, .claude/mcp/vice/host-scripts.test.ts</files>
  <action>
Create `scripts/release-assets.sh`, `chmod +x` (mode 755, matching `package.sh`
and `ensure-mcp-deps.sh`), shebang `#!/usr/bin/env bash`, `set -euo pipefail`.

Header comment, in this repo's established style — WHY it exists (v0.2.0 shipped
`{"assets":[]}` because `release` is gated on `refs/tags/v` and a
`GITHUB_TOKEN`-created tag does not re-trigger workflows, so on the merge path
that job can never run); what it is the ONE authoritative place for (stamp
manifests -> build zip -> attach assets, per D-1); and what NOT to do — do not
copy these three steps back into a job (that is CLAUDE.md's "re-deriving a
cross-cutting seam locally" anti-pattern), do not read the version from
`GITHUB_REF_NAME`/`VERSION` inside (D-2), do not stamp in the caller's working
tree, and do not upload with a `dist/*.zip` glob (a local `dist/` accumulates
other versions — this checkout's holds 0.0.0-dev, 0.1.1 and 9.9.9).

Behaviour, in order:

1. Arg scan: collect non-flag positionals in order (`VERSION`, then `REF`),
   recognise `--dry-run` anywhere, reject any other `--*` and any third
   positional with a usage line and `exit 2`. `REF` defaults to `HEAD`.
2. Reject a missing `VERSION`; reject one matching `^v` with a named error
   ("pass 0.2.0, not v0.2.0 — the tag is derived"); require
   `^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$`. Set `TAG="v$VERSION"`.
3. Preflight `command -v` over `git node unzip sha256sum` plus `gh` unless
   dry-run; each failure `release-assets: ERROR: <tool> is required` and exit 1.
   Adopt `package.sh`'s `fail()`/`note()` helper idiom verbatim so the two
   scripts read alike.
4. `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"`; `cd "$ROOT"`;
   assert `git rev-parse --is-inside-work-tree`; assert
   `git rev-parse --verify "$REF^{commit}"` resolves (named error naming the ref).
5. `TMPROOT="$(mktemp -d)"`, `WT="$TMPROOT/wt"`, install the EXIT trap
   (`git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true`;
   `git -C "$ROOT" worktree prune 2>/dev/null || true`; `rm -rf "$TMPROOT"`)
   BEFORE creating the worktree, then `git worktree add --detach "$WT" "$REF"`.
   Comment that the trap is what keeps a local run from leaving a worktree
   registration or a stray commit behind, per design decision 2.
6. `node "$WT/scripts/version.mjs" stamp "$VERSION"` — the worktree's own copy,
   which resolves its root from its own path.
7. Empty-commit guard exactly as design decision 2 specifies:
   `if git -C "$WT" diff --quiet; then note "..."; else git -C "$WT" -c
   user.name="github-actions[bot]" -c
   user.email="github-actions[bot]@users.noreply.github.com" commit -am "chore:
   stamp v$VERSION into plugin manifests (ephemeral, never pushed)"; fi`, with a
   comment naming the `set -e` trap it avoids.
8. `bash "$WT/scripts/package.sh"`.
9. `NAME="$(node -p "require('$WT/.claude-plugin/plugin.json').name")"`;
   `ZIP="$WT/dist/${NAME}-${VERSION}.zip"`; assert `$ZIP` and `$ZIP.sha256` exist.
10. Fail-closed self-check — the defect class this whole task exists to kill:
    `unzip -p "$ZIP" "${NAME}-${VERSION}/.claude-plugin/plugin.json"` piped into
    `node -e` reading stdin (fd 0) must yield `.version == "$VERSION"`, and the
    same for `marketplace.json`'s `.version` AND `.plugins[0].version`. Any
    mismatch is a `fail()` naming the file, the expected and the found value.
11. Copy `$ZIP` and `$ZIP.sha256` into `$ROOT/dist/` (`mkdir -p` first) so the
    caller can inspect them after the trap fires; re-point `ZIP` at the copy.
12. If dry-run: `note` the tag, the two absolute paths and the sha256, state that
    no `gh` call was made, exit 0.
13. Otherwise, D-3 verbatim — no new branching:
    `if gh release view "$TAG" >/dev/null 2>&1; then note "attaching to existing
    release $TAG"; gh release upload "$TAG" "$ZIP" "$ZIP.sha256" --clobber; else
    note "creating release $TAG"; gh release create "$TAG" "$ZIP" "$ZIP.sha256"
    --generate-notes --title "$TAG"; fi`. The two `note` lines are load-bearing:
    they tell an operator which branch fired, which is how the D-5 run proves it
    never created anything.

Then, in `.claude/mcp/vice/host-scripts.test.ts`, add `"scripts/release-assets.sh"`
to `EXPECTED_TRACKED_SHELL_SCRIPTS` (the array is `.sort()`ed at use, so append is
fine) and extend the block comment above it: the set grows to four because the
release stamp/zip/attach seam became one script both CI release paths call
(quick-260819-vie D-1) — the deliberate committed edit that comment demands, not a
silent widening.

Do NOT touch `ci.yml` in this task.
  </action>
  <verify>
    <automated>bash -n scripts/release-assets.sh && test -x scripts/release-assets.sh</automated>
    <automated>bash scripts/release-assets.sh 2>&1 | grep -qi usage; bash scripts/release-assets.sh v0.2.0 --dry-run 2>&1 | grep -qi "not v0.2.0"</automated>
    <automated>git rev-parse HEAD > /tmp/vie-head-before && git status --porcelain > /tmp/vie-status-before && git worktree list > /tmp/vie-wt-before && bash scripts/release-assets.sh 0.2.0 v0.2.0 --dry-run</automated>
    <automated>unzip -p dist/c64-re-tools-0.2.0.zip 'c64-re-tools-0.2.0/.claude-plugin/plugin.json' | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));if(j.version!=="0.2.0")throw new Error("plugin.json in zip = "+j.version);console.log("plugin.json in zip OK")' && unzip -p dist/c64-re-tools-0.2.0.zip 'c64-re-tools-0.2.0/.claude-plugin/marketplace.json' | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));if(j.version!=="0.2.0"||j.plugins[0].version!=="0.2.0")throw new Error("marketplace.json in zip = "+j.version+"/"+j.plugins[0].version);console.log("marketplace.json in zip OK")'</automated>
    <automated>git rev-parse HEAD | diff - /tmp/vie-head-before && git status --porcelain | diff - /tmp/vie-status-before && git worktree list | diff - /tmp/vie-wt-before && node scripts/version.mjs check</automated>
    <automated>cd .claude/mcp/vice && node --test host-scripts.test.ts 2>&1 | tail -12</automated>
  </verify>
  <done>
`scripts/release-assets.sh` exists, is executable, rejects a `v`-prefixed version
and a missing version, and `--dry-run` against `v0.2.0` produces
`dist/c64-re-tools-0.2.0.zip` + `.sha256` whose *internal* `plugin.json` and
`marketplace.json` all read `0.2.0`. After that run, `git rev-parse HEAD`,
`git status --porcelain` and `git worktree list` are byte-identical to before, and
`node scripts/version.mjs check` still passes (proving the stamp never reached the
real working tree). `host-scripts.test.ts` passes with the four-entry frozen set.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire both release paths to the seam, with the [skip release] gate byte-frozen</name>
  <files>.claude/mcp/vice/ci-guardrails.test.mjs, .github/workflows/ci.yml</files>
  <behavior>
New assertions in `ci-guardrails.test.mjs`, written and run FIRST (they must fail
for the right reason — the seam is not wired yet — before `ci.yml` is edited).
They reuse the file's own `splitIntoStepBlocks()` / `CI_YAML_PATH`; add no YAML
dependency, matching that file's stated no-runtime-dependency scope:

- `bash scripts/release-assets.sh` appears in exactly TWO step blocks of ci.yml
  (the tag path and the merge path). RED before the edit: 0 found.
- Both of those step blocks pass a version as an explicit argument and neither
  contains the literal `GITHUB_REF_NAME#v` *inside the script* — i.e. assert each
  block matches `release-assets\.sh\s+"?\$` or a quoted expression argument, and
  that neither block is a bare invocation with no argument (D-2).
- The merge-path block (the one referencing `steps.ver.outputs.version`) carries
  `if: steps.gate.outputs.release == 'true'` (D-4: a skipped release builds and
  uploads nothing). RED before the edit.
- Neither block carries `continue-on-error` (a silently-evaporating asset step is
  exactly the v0.2.0 defect again).
- `version.mjs stamp` appears in ZERO ci.yml step blocks — it lives in the seam
  now, and `scripts/release-assets.sh` itself contains that call (read the script
  from `REPO_ROOT`, comment-stripped is unnecessary; assert plain containment).
  RED before the edit: 1 found in the `release` job.
- `bash scripts/package.sh` appears in exactly ONE ci.yml step block (the `build`
  job's artifact build); every release path reaches it only through the seam
  (D-1). RED before the edit: 2 found.
  </behavior>
  <action>
FIRST capture the byte-identity baseline for D-4, before touching `ci.yml`:
sha256 the `[skip release]` gate step block extracted content-anchored (from the
index of `      - name: Decide whether to release` up to the next `\n      - `) out
of BOTH `git show v0.2.0:.github/workflows/ci.yml` and the working tree, and
record the hash in the task output. Line-number anchoring is forbidden here — the
`release` job edit shifts every later line, which is exactly why quick-260819-tsz
used content anchoring.

Pre-measured during planning against this checkout, so the executor has an
independent expected value: the gate block's sha256 is
`1635ef80f739f55866b7110782889e12747a69c04769f3cda023df95daecbc8f` (identical in
`v0.2.0:.github/workflows/ci.yml` and the current working tree). The `build` and
`publish-npm` job blocks are 3633 and 2550 bytes respectively and must also come
out byte-identical after the edit.

Write the `<behavior>` assertions into `ci-guardrails.test.mjs`, run them, record
the RED output (each must fail for the "not wired yet" reason listed, not for a
parser or path error).

Then edit `.github/workflows/ci.yml`:

**`release` job (tag path).** Replace its three steps — `Stamp the real version
into the plugin manifests`, `Build installable package`, `Publish release
assets` — with ONE step, `name: Stamp, package, and publish release assets`,
`env: GH_TOKEN: ${{ github.token }}`, whose `run:` is `set -euo pipefail` then
`bash scripts/release-assets.sh "${GITHUB_REF_NAME#v}" "${GITHUB_REF_NAME}"`.
Keep `needs: build`, the `if:` gate, `permissions: contents: write`, the
`actions/checkout@v4` and `actions/setup-node@v4` steps unchanged (the seam needs
node). Move the explanatory prose from the three deleted steps into a short
comment on the new one, pointing at `scripts/release-assets.sh` as the place that
now documents the mechanism — do not duplicate the seam's header here.

**`release-on-merge` job (merge path).** Append ONE step AFTER `Create tag +
GitHub release`, `name: Publish release assets`,
`if: steps.gate.outputs.release == 'true'`, `env: GH_TOKEN: ${{ github.token }}`,
`run:` = `set -euo pipefail` then
`bash scripts/release-assets.sh "${{ steps.ver.outputs.version }}" "${{ github.sha }}"`.
Comment it with the defect it closes: this job creates the tag with
`GITHUB_TOKEN`, which by design does not re-trigger the workflow, so the `release`
job above can never run on this path — v0.2.0 shipped with zero assets because of
it (quick-260819-vie). Ordering is load-bearing: after `gh release create`, so the
seam takes its upload branch and D-3's create branch never fires here.

**Do not touch** the `build` job, the `publish-npm` job, or the `Decide whether to
release` gate step — not one byte. Then re-run the D-4 hash comparison and confirm
the gate block hash is unchanged.

The commit for this task MUST carry `[skip release]` in its SUBJECT line (first
line), e.g. `refactor(quick-260819-vie): one release-assets seam for both release
paths [skip release]`. This is not optional and not a body note: the gate does
`SUBJECT="$(git log -1 --pretty=%s)"` then `grep -qiF '[skip release]'`, and
without it pushing this fix would itself publish 0.2.1 to npm while npm must stay
at 0.2.0. Verify it with `git log -1 --pretty=%s | grep -qF '[skip release]'`
after committing. Same rule for every other commit in this task — see the
MANDATORY section above; the SUMMARY commit is the one most easily forgotten.
  </action>
  <verify>
    <automated>node -e 'const fs=require("fs"),cp=require("child_process"),cr=require("crypto");const ex=s=>{const i=s.indexOf("      - name: Decide whether to release");if(i<0)throw new Error("gate step not found");const j=s.indexOf("\n      - ",i+1);return s.slice(i,j<0?s.length:j+1)};const h=x=>cr.createHash("sha256").update(x).digest("hex");const base=h(ex(cp.execFileSync("git",["show","v0.2.0:.github/workflows/ci.yml"],{encoding:"utf8"})));const cur=h(ex(fs.readFileSync(".github/workflows/ci.yml","utf8")));console.log("gate base",base);console.log("gate cur ",cur);if(base!==cur)throw new Error("D-4 VIOLATION: [skip release] gate step drifted");console.log("D-4 OK: gate step byte-identical")'</automated>
    <automated>node -e 'const fs=require("fs"),cp=require("child_process"),cr=require("crypto");const ex=(s,a)=>{const i=s.indexOf(a);if(i<0)throw new Error("not found: "+a);const m=/\n {2}\S/.exec(s.slice(i+a.length));return m?s.slice(i,i+a.length+m.index+1):s.slice(i)};const h=x=>cr.createHash("sha256").update(x).digest("hex");const base=cp.execFileSync("git",["show","v0.2.0:.github/workflows/ci.yml"],{encoding:"utf8"});const cur=fs.readFileSync(".github/workflows/ci.yml","utf8");for(const a of ["  publish-npm:","  build:"]){const b=h(ex(base,a)),c=h(ex(cur,a));console.log(a,b===c?"identical":"DRIFTED",b,c);if(b!==c)throw new Error("untouched job drifted: "+a)}console.log("build + publish-npm byte-identical")'</automated>
    <automated>python3 -c 'import yaml;d=yaml.safe_load(open(".github/workflows/ci.yml"));print("yaml ok, jobs:",sorted(d["jobs"]));assert sorted(d["jobs"])==["build","publish-npm","release","release-on-merge"]'</automated>
    <automated>cd .claude/mcp/vice && node --test ci-guardrails.test.mjs 2>&1 | tail -12</automated>
    <automated>GITHUB_REF_NAME=v0.2.0 bash -c 'set -euo pipefail; bash scripts/release-assets.sh "${GITHUB_REF_NAME#v}" "${GITHUB_REF_NAME}" --dry-run' | tail -6</automated>
    <automated>VER=0.2.0 SHA=$(git rev-parse HEAD) bash -c 'set -euo pipefail; bash scripts/release-assets.sh "$VER" "$SHA" --dry-run' | tail -6</automated>
    <automated>git log -1 --pretty=%s | grep -qF '[skip release]' && echo "skip-release marker present in subject"</automated>
  </verify>
  <done>
`ci.yml` parses as YAML with the same four jobs; the `[skip release]` gate step and
the whole `build` and `publish-npm` jobs hash byte-identical to `v0.2.0`'s copy;
`bash scripts/release-assets.sh` appears in exactly two gated, argument-passing
step blocks; `version.mjs stamp` appears in zero ci.yml steps and
`bash scripts/package.sh` in exactly one; both new `run:` blocks were traced
locally with the runner's own env-var names / expression substitutions and printed
the expected dry-run artifact; and the commit subject contains `[skip release]`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Attach v0.2.0's missing asset for real, and prove it from inside the uploaded zip</name>
  <files>dist/c64-re-tools-0.2.0.zip (untracked build output; no tracked file changes)</files>
  <action>
D-5. Run the completion gates first, then perform the one permitted network write.

1. Completion gates (must be green before uploading anything): from
   `.claude/mcp/vice`, `npm run typecheck` clean and `npm run test:automated`
   green — baseline 1693 pass / 0 fail / 5 todo, expected to rise by the new
   `ci-guardrails.test.mjs` cases with zero failures; report the actual numbers.
   From the repo root, `bash scripts/package.sh` succeeds and
   `node scripts/check-npm-packages.mjs` passes. Confirm from that run's own
   output that `scripts/release-assets.sh` is absent from both tarballs — it lives
   at the repo root under `scripts/`, outside both package dirs, and the existing
   `scripts/` leak assertions cover the vice package.
2. Pre-flight the upload, so D-3's `create` branch provably cannot fire and no new
   release can be created: `gh release view v0.2.0 --json assets,tagName,targetCommitish`
   must succeed and show `{"assets":[]}` with target `089127a...`. Also confirm
   `git ls-remote origin refs/tags/v0.2.0` still resolves to `089127a`. If either
   check disagrees, STOP and report — do not upload.
3. Run exactly: `bash scripts/release-assets.sh 0.2.0 v0.2.0`. Capture the full
   output and confirm the line it printed was "attaching to existing release
   v0.2.0", NOT "creating release v0.2.0".
4. Verify from the REMOTE artifact, not the local `dist/` copy: download with
   `gh release download v0.2.0 --pattern '*.zip*' --dir <tmpdir> --clobber`; in
   that directory `sha256sum -c c64-re-tools-0.2.0.zip.sha256`; then
   `unzip -p c64-re-tools-0.2.0.zip 'c64-re-tools-0.2.0/.claude-plugin/plugin.json'`
   and the `marketplace.json` sibling, asserting `.version == "0.2.0"`,
   `.plugins[0].version == "0.2.0"` and `name == "c64-re-tools"`. Also spot-check
   that `unzip -l` shows no `node_modules/` or `tools/` entries.
5. Confirm the local tree is still clean afterwards: `git status --porcelain`
   shows no tracked modifications (only the pre-existing untracked
   `.claude/settings.json`, `.vscode/` and this quick task's own planning dir),
   `git worktree list` shows one entry, and `node scripts/version.mjs check`
   passes.

6. Final marker sweep before handing back:
   `git log origin/main..HEAD --pretty=%s` — every subject, including this task's
   SUMMARY commit, must contain `[skip release]`;
   `git log origin/main..HEAD --pretty=%s | grep -cvF '[skip release]'` must print
   `0`. If the SUMMARY commit was already made without it, amend that commit's
   subject (it is local and unpushed) rather than leaving the gate re-armed.

PROHIBITED in this task, without exception: `git push`, `git tag`, deleting or
moving any tag, `npm publish`, `npm version` against the registry, and
`gh release create` for any version. The only permitted network write in this
whole plan is `gh release upload` against the already-existing v0.2.0 release.
  </action>
  <verify>
    <automated>gh release view v0.2.0 --json assets --jq '[.assets[].name] | sort | @json' | tee /tmp/vie-assets.json && grep -q 'c64-re-tools-0.2.0.zip' /tmp/vie-assets.json && grep -q 'c64-re-tools-0.2.0.zip.sha256' /tmp/vie-assets.json</automated>
    <automated>D=$(mktemp -d) && gh release download v0.2.0 --pattern '*.zip*' --dir "$D" --clobber && (cd "$D" && sha256sum -c c64-re-tools-0.2.0.zip.sha256) && unzip -p "$D/c64-re-tools-0.2.0.zip" 'c64-re-tools-0.2.0/.claude-plugin/plugin.json' | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));if(j.name!=="c64-re-tools"||j.version!=="0.2.0")throw new Error("uploaded plugin.json = "+j.name+"@"+j.version);console.log("uploaded plugin.json OK")' && unzip -p "$D/c64-re-tools-0.2.0.zip" 'c64-re-tools-0.2.0/.claude-plugin/marketplace.json' | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));if(j.version!=="0.2.0"||j.plugins[0].version!=="0.2.0")throw new Error("uploaded marketplace.json = "+j.version+"/"+j.plugins[0].version);console.log("uploaded marketplace.json OK")' && unzip -l "$D/c64-re-tools-0.2.0.zip" | grep -Eq '/(node_modules|tools)/' && echo "LEAK" || echo "no node_modules/tools leak"</automated>
    <automated>cd .claude/mcp/vice && npm run typecheck && npm run test:automated 2>&1 | tail -12</automated>
    <automated>bash scripts/package.sh >/dev/null && node scripts/check-npm-packages.mjs && node scripts/version.mjs check && git worktree list</automated>
    <automated>test "$(git log origin/main..HEAD --pretty=%s | grep -cvF '[skip release]')" = "0" && echo "every local commit subject carries [skip release]"</automated>
    <automated>git rev-parse v0.2.0 | grep -q '^089127ad963aa91ad49e69c4a4dea22bfbbb869f' && git ls-remote origin refs/tags/v0.2.0 | grep -q '089127ad963aa91ad49e69c4a4dea22bfbbb869f' && echo "tag v0.2.0 unmoved, local and remote"</automated>
  </verify>
  <done>
`gh release view v0.2.0 --json assets` lists exactly `c64-re-tools-0.2.0.zip` and
`c64-re-tools-0.2.0.zip.sha256`; the downloaded zip's sha256 matches its sidecar
and its own `plugin.json`/`marketplace.json` read `0.2.0` in all three locations;
typecheck clean, `test:automated` green with reported counts, `package.sh` and
`check-npm-packages.mjs` pass; tag `v0.2.0` still resolves to `089127a` locally and
on the remote; nothing was pushed, tagged or published.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| runner/local shell -> GitHub Releases API | `gh` writes published artifacts consumers install from |
| repo working tree -> release artifact | whatever `git archive` sees becomes what users install |
| CI job -> `GITHUB_TOKEN` (`contents: write`) | the token that can create tags and releases |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-VIE-01 | Tampering | the uploaded zip's contents | mitigate | built only from `git archive` of a committed ref in a throwaway worktree (tracked files only; `package.sh`'s existing `node_modules/`/`tools/` guard retained), and the seam fails closed unless the zip's own `plugin.json` + `marketplace.json` read the requested version |
| T-VIE-02 | Spoofing | `gh release create` firing for an unintended version during the local D-5 run | mitigate | task 3 pre-flights `gh release view v0.2.0` and aborts if absent; the seam prints which branch it took; `--dry-run` rehearsal exists so the first real invocation is not the first invocation |
| T-VIE-03 | Information disclosure | uploading unrelated local build output | mitigate | explicit `${NAME}-${VERSION}.zip` paths, never `dist/*.zip` — this checkout's `dist/` holds 0.0.0-dev, 0.1.1 and 9.9.9 zips today |
| T-VIE-04 | Denial of service | `[skip release]` gate silently evaporating, or an asset step silently disabled | mitigate | sha256 byte-identity proof of the extracted gate block against `v0.2.0`'s copy; new `ci-guardrails` assertions require the merge-path step to carry the gate `if:` and forbid `continue-on-error` on either step |
| T-VIE-05 | Tampering | developer's working tree / a stray commit on `main` | mitigate | detached temp worktree + EXIT trap; verified by diffing `git rev-parse HEAD`, `git status --porcelain`, `git worktree list` across a dry run and by `version.mjs check` still passing |
| T-VIE-06 | Elevation of privilege | `contents: write` token reach | accept | both jobs already hold `contents: write`; the new step adds no scope, only the asset upload the job was always meant to do |
| T-VIE-SC | Tampering | npm/pip/cargo installs | accept | this task installs no packages; `check-npm-packages.mjs` runs read-only (`npm pack --dry-run`) |
</threat_model>

<verification>
1. `bash -n scripts/release-assets.sh`; `--dry-run` against `v0.2.0` produces a zip
   whose internal manifests read `0.2.0`; the caller's HEAD, status and worktree
   list are unchanged and `node scripts/version.mjs check` still passes.
2. D-4: sha256 of the content-anchored `[skip release]` gate block, and of the
   whole `build` and `publish-npm` jobs, identical to `git show v0.2.0:...`.
3. `python3 -c 'import yaml; yaml.safe_load(...)'` parses `ci.yml`; the four job
   names are unchanged.
4. `ci-guardrails.test.mjs`: seam wired into exactly two gated steps;
   `version.mjs stamp` in zero ci.yml steps; `package.sh` in exactly one.
5. Both new `run:` blocks traced locally with the runner's own env-var names.
6. `npm run typecheck` clean; `npm run test:automated` green (baseline 1693/0/5,
   actual counts reported); `bash scripts/package.sh` and
   `node scripts/check-npm-packages.mjs` pass.
7. D-5: the downloaded v0.2.0 asset's sha256 matches its sidecar and its own
   `plugin.json`/`marketplace.json` read `0.2.0` in all three locations.
8. Nothing pushed, tagged or published; tag `v0.2.0` still `089127a` local+remote.

<human-check>
The v0.2.0 release page shows two assets and `/plugin marketplace add` has an
artifact to fetch again — worth an eyeball before the orchestrator pushes.
</human-check>
</verification>

<success_criteria>
- One script, `scripts/release-assets.sh`, is the only place that stamps, zips and
  attaches; both `release` and `release-on-merge` call it (D-1) with the version as
  an explicit argument (D-2), and the create-or-upload block is unchanged (D-3).
- The `[skip release]` gate step is byte-identical and the new merge-path step is
  gated on it (D-4), proven by sha256 of the extracted block, not a regex.
- GitHub release v0.2.0 carries `c64-re-tools-0.2.0.zip` + `.sha256` whose internal
  manifests read `0.2.0` (D-5).
- EVERY local commit subject — including the final SUMMARY commit, which is the
  tip the gate actually reads — carries `[skip release]`.
- All CONTEXT.md gates green with reported numbers; nothing pushed, tagged or
  published.
</success_criteria>

## Risks

1. **D-3 says "do not add create-vs-update branching" and I have kept it exactly
   as-is — but I added a `--dry-run` flag the CONTEXT did not ask for.** Justified,
   not scope creep: D-5 requires a human to run this against a *published*
   release, and without a rehearsal mode the first invocation of brand-new release
   automation is also its first live write. It is also what makes task 1
   verifiable without touching the network. It is a separate flag, not a branch
   inside the upload logic.
2. **Tag-path `ref` argument.** The tag path passes `"${GITHUB_REF_NAME}"` as the
   ref. `actions/checkout@v4` fetches and checks out that tag, so it resolves —
   but if some future checkout configuration ever leaves the tag ref absent, the
   seam fails loudly at its `git rev-parse --verify` guard and the fallback is
   simply to pass nothing (default `HEAD`, which is what the old step effectively
   used). Loud, not silent.
3. **Merge-path ordering depends on `gh release create` having succeeded.** If
   that step fails, the new step does not run (job already failed) — no orphan
   upload. If it ever became `continue-on-error`, the seam would take its `create`
   branch instead; the new guardrail test forbids `continue-on-error` on the asset
   step but not on the create step. Acceptable: that would be a deliberate,
   visible edit to a step this plan does not touch.
4. **Test-count drift.** `test:automated`'s baseline moves from 1693 by the number
   of new `ci-guardrails` cases. The plan asks for actual numbers rather than
   pinning a magic total, so a future test addition does not falsely fail this
   task's own gate.
5. **`git worktree` metadata under `.git/worktrees`** is written and removed per
   run. If a run is `SIGKILL`ed the trap does not fire and a stale registration
   survives; the next run's `git worktree prune` clears it. Cosmetic, self-healing.

<output>
Create `.planning/quick/260819-vie-extract-release-stamp-zip-upload-into-on/260819-vie-SUMMARY.md`
when done, including the actual `test:automated` counts, both D-4 sha256 hashes,
the seam's own "attaching to existing release" line from the D-5 run, and the
verified asset list.
</output>
