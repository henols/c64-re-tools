---
phase: quick-260820-jwb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - .planning/todos/pending/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md
  - .planning/todos/completed/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md
  - .gitignore
  - .planning/PROJECT.md
  - .planning/STATE.md
autonomous: true
requirements: [HYGIENE-01, HYGIENE-02, HYGIENE-03]

must_haves:
  truths:
    - "A stalled apt mirror fails the CI ACME step within ~5 minutes instead of hanging until GitHub's 6-hour job limit"
    - "A transient apt flake is retried up to 3 times before the step is declared failed"
    - "A wrong package name or a broken install still fails the build loudly (set -euo pipefail, command -v acme, banner grep all intact)"
    - "The DISASM-03 round-trip gate still runs as a real gate — the step is neither dropped nor made non-fatal"
    - "`.vice-snapshots/`, `.vscode/` and `.claude/settings.json` no longer appear in `git status`"
    - "Neither published npm tarball's file list changes as a result of the new ignore rules"
    - "PROJECT.md and STATE.md state the true release position, phrased so it does not rot into a new false number"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "ACME install step with timeout-minutes + bounded retry, gates preserved"
      contains: "timeout-minutes"
    - path: ".gitignore"
      provides: "ignore rules for the three runtime/local byproducts, each with a WHY comment"
      contains: "/.vice-snapshots/"
    - path: ".planning/todos/completed/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md"
      provides: "the CI-hang todo, closed by relocation"
    - path: ".planning/PROJECT.md"
      provides: "corrected release-status paragraph"
    - path: ".planning/STATE.md"
      provides: "corrected current-focus sentence and operator next-step bullet"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "disasm-roundtrip.test.ts"
      via: "VICE_REQUIRE_ACME=1 on the Test step, which only holds if acme really installed"
      pattern: "VICE_REQUIRE_ACME"
    - from: ".gitignore"
      to: "npm pack file lists"
      via: "scripts/check-npm-packages.mjs (npm pack --dry-run --json) run after the edit"
      pattern: "check-npm-packages"
---

<objective>
Three post-Phase-9 hygiene fixes, all file edits, no remote mutation:

1. Make CI's ACME-install step fail fast and retry instead of stalling the `build`
   job (and therefore every publish path) for hours.
2. Gitignore the three runtime/local byproducts that pollute every `git status`,
   with a verification pass proving the published npm tarballs are unaffected.
3. Correct three stale, quotable release-status claims in PROJECT.md and STATE.md.

Purpose: `build` is a `needs:` dependency of `release`, `publish-npm` and
`release-on-merge`, so an unbounded apt stall silently blocks all shipping with no
failure signal. `.vice-snapshots/` is a *product* byproduct — every user of
`vice_snapshot_save` gets untracked files in their own repo. And the stale "386
commits ahead of `origin/main` at `v0.1.10`" line already misled a reader today.

Output: hardened CI step, closed todo, three documented ignore rules, corrected
release-status prose.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.gitignore
@.github/workflows/ci.yml
@.planning/todos/pending/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md

Ground truth verified 2026-08-20 — do not re-derive, and do not run `git push`:
- `origin/main` == local `HEAD` == `40af8bf`, 0 ahead / 0 behind.
- `v0.2.0` is tagged on the remote at `089127a`, an ancestor of `origin/main`.
- Both npm packages are published at 0.2.0. Every local tag is pushed.
- CI run `32363584821` on `40af8bf` succeeded; the auto-release path was
  deliberately skipped via `[skip release]` because Phase 9 changed no npm code.

Out of scope (the orchestrator handles it): deleting the merged branch
`ci/phase-03-validation`. No `git push`, no tag creation, no remote mutation.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bound the CI ACME install step with a timeout and a retry, then close the todo</name>
  <files>.github/workflows/ci.yml, .planning/todos/pending/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md -> .planning/todos/completed/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md</files>
  <action>
Edit the `build` job step named `Install ACME cross-assembler (DISASM-03 round-trip gate)`
(currently at .github/workflows/ci.yml:45, `run:` body at :56-61). Apply the todo's
prescribed fix, all three tiers:

1. Add `timeout-minutes: 5` as a step key, directly under the `- name:` line and
   above the existing comment block. Five minutes is generous for an apt install
   against a ~3 minute historical whole-build time.
2. In the `run:` body, keep `set -euo pipefail` as the first line, then define a
   shell helper that wraps `sudo apt-get` in a bounded 3-attempt retry with a
   short sleep between attempts and a message on stderr naming the attempt number
   (so the log says what is wrong while it happens — the todo calls out that the
   current stall "simply produces no output"). Route BOTH `apt-get` calls
   (`update`, then `install -y acme`) through that helper. After three failed
   attempts the helper must return non-zero so `set -e` fails the step — the todo
   is explicit that the step must NOT become non-fatal.
3. Pass `-o Acquire::Retries=3 -o Acquire::http::Timeout=30` to the `apt-get`
   invocations inside the helper, so apt also bounds its own network waits.

Preserve EXACTLY, unchanged, in this order after the installs:
  `command -v acme`
  `{ acme --version || acme --help; } 2>&1 | head -5 | tee /tmp/acme-banner.txt`
  `grep -qi acme /tmp/acme-banner.txt`
These are the banner-proof gate that makes a wrong package name or broken install
fail loudly instead of letting the Test step silently skip the round-trip. Do not
drop the step, do not add `continue-on-error`, do not touch the Test step or its
`VICE_REQUIRE_ACME: "1"` env, and do not touch the existing explanatory comment's
content — extend it with one short added paragraph stating why the timeout and
retry exist (run `32303212069`, ~25 min stall, `build` gates all three publish
jobs) and referencing the closed todo by filename.

Match the file's existing YAML style: 2-space indent, `run: |` block scalar.

Then close the todo: `git mv` (or plain move) the pending file to
`.planning/todos/completed/` with its filename unchanged. Do not edit its body.
  </action>
  <verify>
    <automated>python3 - <<'PY'
import yaml,sys,os
d=yaml.safe_load(open('.github/workflows/ci.yml'))
steps=d['jobs']['build']['steps']
s=[x for x in steps if 'ACME cross-assembler' in str(x.get('name',''))]
assert len(s)==1, "expected exactly one ACME install step"
s=s[0]
tm=s.get('timeout-minutes')
assert isinstance(tm,int) and 1<=tm<=10, f"timeout-minutes missing or unreasonable: {tm!r}"
assert not s.get('continue-on-error'), "step must stay fatal"
r=s['run']
assert 'set -euo pipefail' in r, "set -euo pipefail dropped"
assert 'command -v acme' in r, "command -v acme gate dropped"
assert 'grep -qi acme /tmp/acme-banner.txt' in r, "banner gate dropped"
assert 'Acquire::Retries=3' in r and 'Acquire::http::Timeout=30' in r, "apt-level bounds missing"
assert 'apt-get' in r and 'install -y acme' in r, "apt install of acme missing"
# retry loop present: a 3-attempt construct somewhere in the body
assert ('for ' in r or 'while ' in r), "no retry loop found in run body"
t=[x for x in steps if x.get('name')=='Test'][0]
assert t.get('env',{}).get('VICE_REQUIRE_ACME')=='1', "Test step's VICE_REQUIRE_ACME gate changed"
assert os.path.exists('.planning/todos/completed/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md'), "todo not moved to completed/"
assert not os.path.exists('.planning/todos/pending/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md'), "todo still in pending/"
print("OK")
PY</automated>
  </verify>
  <done>ci.yml parses as YAML; the ACME step carries `timeout-minutes` (1-10), a bounded retry loop, apt-level retry/timeout options, and all three original gates verbatim; the Test step is untouched; the todo file lives under `.planning/todos/completed/`.</done>
</task>

<task type="auto">
  <name>Task 2: Gitignore the three byproducts, then prove the npm tarballs and test gate are unaffected</name>
  <files>.gitignore</files>
  <action>
Append three entries to `.gitignore`, matching the file's two established
conventions: (a) every entry or group carries a comment saying WHY it exists and
what writes it; (b) repo-root-anchored paths are `/`-prefixed (see the existing
`/.vice-supervisor/`, `/tools/...`, `/installer/skills/`).

1. `/.vice-snapshots/` — placed adjacent to the existing `/.vice-supervisor/`
   group, because it is the same class of thing: host-side runtime state written
   under the resolved project root. Comment must name `vice_snapshot_save` as the
   writer and `snapshotPathFor()` in `.claude/mcp/vice/stock-paths.ts` as the path
   builder (`<repoRoot>/.vice-snapshots/<name>.vsf` plus its `.json` sidecar), and
   must note that this is a *product* byproduct — any consumer of that tool gets
   these files in their own repo, which is why it is ignored rather than cleaned up.
2. `/.vscode/` — local editor config, machine-specific, never shared.
3. `/.claude/settings.json` — local Claude Code permission/allowlist config.
   Comment must state that it currently holds absolute worktree paths from earlier
   sessions, so it is machine-specific and must not be committed, and that the
   shared plugin config lives in `.mcp.json` / `.claude-plugin/` instead.

Do NOT add a bare `.vice-snapshots` pattern (it would also match nested
directories). Do NOT reorder, reword or remove any existing entry or comment.

Risk this task must clear: `npm pack` can honour a root `.gitignore` when a package
has no `.npmignore` and no `files` field, and `scripts/check-npm-packages.mjs`
asserts via `npm pack --dry-run --json` that both published tarballs contain
exactly the right files. So run that script after the edit — it is part of this
task, not optional. Also run the project's real local test gate,
`npm run test:automated` from `.claude/mcp/vice` (NOT bare `npm test`: a documented
pending disposition records that bare `npm test` needs a broker/emulator/display
topology and is not a usable local gate).

If `check-npm-packages.mjs` reports any tarball difference, do not paper over it —
stop and report which entry caused it.
  </action>
  <verify>
    <automated>set -euo pipefail
grep -v '^#' .gitignore | grep -qx '/.vice-snapshots/'
grep -v '^#' .gitignore | grep -qx '/.vscode/'
grep -v '^#' .gitignore | grep -qx '/.claude/settings.json'
for p in .vice-snapshots/ .vscode/ .claude/settings.json; do git check-ignore -q "$p" || { echo "not ignored: $p" >&2; exit 1; }; done
test -z "$(git status --porcelain | grep -E '^\?\? (\.vice-snapshots/|\.vscode/|\.claude/settings\.json)' || true)"
node scripts/check-npm-packages.mjs
npm --prefix .claude/mcp/vice run test:automated</automated>
  </verify>
  <done>All three paths are ignored and absent from `git status`; `node scripts/check-npm-packages.mjs` passes (both tarball file lists still exactly correct); `npm run test:automated` passes in `.claude/mcp/vice`.</done>
</task>

<task type="auto">
  <name>Task 3: Correct the stale release-status claims in PROJECT.md and STATE.md</name>
  <files>.planning/PROJECT.md, .planning/STATE.md</files>
  <action>
Three claims are false as of 2026-08-20. Rewrite each to state the true position,
and phrase it so it will not rot the same way — describe the *relationship*
("in sync with `origin/main`", "every local tag is pushed") rather than baking in a
commit count or an ahead/behind number that decays within days. Do not invent a new
number that will be wrong next week.

1. `.planning/PROJECT.md:215-216` — the paragraph beginning
   `**Not yet released.** The tree is 386 commits ahead of ...`. Replace the whole
   two-line paragraph with a corrected one: `v0.2.0` is tagged on the remote and is
   an ancestor of `origin/main`, both npm packages are published at 0.2.0, every
   local tag is pushed, and the working tree is in sync with `origin/main` — i.e.
   this milestone has shipped. Keep the paragraph's position and its
   `**Bold lead-in.**` sentence shape so the surrounding milestone-close section
   still reads consistently.

2. `.planning/STATE.md:35-36` — the trailing clause
   `Also open and arguably first: publishing v0.2.0, which is 386 commits ahead of
   \`origin/main\` at tag \`v0.1.10\`.` The whole premise is gone (v0.2.0 is
   shipped), so replace that clause with a short sentence stating that v0.2.0 is
   tagged, pushed and published, so no release work gates the milestone. Leave the
   preceding sentence (`No Phase 10/11 plan is written before it closes.`) intact.

3. `.planning/STATE.md:288-289` — the Operator Next Steps bullet
   `- Consider publishing first: 386 commits sit unpushed ahead of \`origin/main\`,
   newest tag \`v0.1.10\`. None of v0.2.0 has reached a user.` The action no longer
   exists. Replace the bullet with one stating there is nothing to publish: v0.2.0
   is tagged, pushed and live on npm for both packages, and the tree is in sync
   with `origin/main`. Keep it as a single bullet in the same list position; leave
   the other two bullets in that list untouched.

4. Required consistency fix inside the same item: `.planning/PROJECT.md:129`
   currently opens `**Shipping history.** Tagged through \`v0.1.10\`; both npm
   packages published.` Item 3's rewrite of :215-216 would directly contradict it,
   so update that clause to name `v0.2.0` as the newest tag with both npm packages
   published at 0.2.0. Preserve the rest of that paragraph verbatim — in particular
   the note that the planning label and the published npm semver are independent
   numbers, and the sentence about every merge to `main` auto-publishing a patch
   version unless the subject contains `[skip release]`. That caveat is still true
   and is exactly why this plan's own commit carries the marker.

Change nothing else in either file. Do not touch frontmatter, progress counters,
`stopped_at`, or the Current Position block in STATE.md.
  </action>
  <verify>
    <automated>set -euo pipefail
# The decaying number is gone from both files.
test "$(grep -c '386 commits' .planning/PROJECT.md .planning/STATE.md | awk -F: '{s+=$2} END{print s+0}')" = "0"
# No surviving "not yet released" / "unpushed" / "reached a user" claims.
test -z "$(grep -in 'not yet released\|sit unpushed\|reached a user' .planning/PROJECT.md .planning/STATE.md || true)"
# v0.1.10 no longer appears as a "newest/current tag" claim anywhere.
test -z "$(grep -n 'v0\.1\.10' .planning/PROJECT.md .planning/STATE.md || true)"
# The true position is stated in both files.
grep -q 'origin/main' .planning/PROJECT.md
grep -q 'v0\.2\.0' .planning/PROJECT.md
grep -q 'v0\.2\.0' .planning/STATE.md
# The still-true auto-publish caveat survived.
grep -q '\[skip release\]' .planning/PROJECT.md
# STATE.md frontmatter and Current Position untouched.
grep -q 'stopped_at: Phase 09 complete (8/8) — ready to discuss Phase 10' .planning/STATE.md
grep -q '^Phase: 10$' .planning/STATE.md
echo OK</automated>
  </verify>
  <done>Neither PROJECT.md nor STATE.md contains `386 commits` or a `v0.1.10`-as-newest-tag claim; all three enumerated locations plus the PROJECT.md:129 consistency line state the true, non-decaying position; STATE.md frontmatter and Current Position are byte-identical to before.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Debian/Ubuntu apt mirror -> CI runner | Untrusted third-party network fetch installs a binary that then gates a test |
| Repo working tree -> published npm tarballs | A root `.gitignore` change can silently alter what `npm pack` ships |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260820-01 | Denial of Service | `Install ACME cross-assembler` step in `.github/workflows/ci.yml` | mitigate | `timeout-minutes: 5` plus a 3-attempt bounded retry converts an unbounded stall (up to GitHub's 6h job cap, blocking `release`/`publish-npm`/`release-on-merge`) into a fast, loud failure |
| T-260820-02 | Tampering | ACME binary fetched from the apt mirror | mitigate | Unchanged and preserved: `set -euo pipefail`, `command -v acme`, and `grep -qi acme /tmp/acme-banner.txt` prove the installed binary self-identifies as ACME before the round-trip gate trusts it |
| T-260820-03 | Information Disclosure | new `/.claude/settings.json` ignore rule | mitigate | The file holds machine-specific absolute worktree paths from prior sessions; ignoring it prevents committing local filesystem layout, and it is already untracked so nothing is being removed from history |
| T-260820-04 | Tampering | published tarball contents vs. new `.gitignore` entries | mitigate | `node scripts/check-npm-packages.mjs` (`npm pack --dry-run --json`) is a required in-task step; any file-list drift stops the task rather than shipping silently |
| T-260820-SC | Tampering | npm/pip/cargo installs | mitigate | Not applicable — this plan adds no package dependency. No `npm install` of any new package occurs; `npm run test:automated` and `npm pack --dry-run` use the committed lockfile only |
</threat_model>

<verification>
Run from the repo root after all three tasks:

1. `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` — workflow still parses.
2. `for p in .vice-snapshots/ .vscode/ .claude/settings.json; do git check-ignore -q "$p" || echo "MISS $p"; done` — all three ignored (per-path; a multi-path `check-ignore` exits 0 when only one matches).
3. `git status --porcelain` — shows only the intended tracked-file modifications plus
   the todo move; none of the three byproduct paths appear as `??`.
4. `node scripts/check-npm-packages.mjs` — both tarball file lists still exactly correct.
5. `npm --prefix .claude/mcp/vice run test:automated` — the project's real local gate passes.
6. `grep -rn '386 commits\|v0\.1\.10' .planning/PROJECT.md .planning/STATE.md` — no output.
7. `ls .planning/todos/completed/ | grep acme-install-has-no-timeout` — the todo is closed.

No `git push`, no tag creation, no remote mutation at any point.
</verification>

<success_criteria>
- CI's ACME step fails within ~5 minutes on a mirror stall, retries transient flakes
  3 times, and keeps `set -euo pipefail` + `command -v acme` + the banner grep verbatim.
- The CI-hang todo is in `.planning/todos/completed/`, body unedited.
- `.gitignore` carries `/.vice-snapshots/`, `/.vscode/` and `/.claude/settings.json`,
  each with a WHY comment, root-anchored per the file's convention; `git status` is
  clean of all three.
- `node scripts/check-npm-packages.mjs` passes — no tarball drift.
- `npm run test:automated` passes in `.claude/mcp/vice`.
- PROJECT.md and STATE.md state the true release position with no commit count and
  no `v0.1.10`-as-newest-tag claim; the `[skip release]` auto-publish caveat survives.
- The final commit subject carries `[skip release]` (no npm-shipped code changed;
  every push to `main` otherwise auto-publishes a patch release).
</success_criteria>

<output>
Create `.planning/quick/260820-jwb-post-phase-9-repo-hygiene-ci-acme-timeou/260820-jwb-SUMMARY.md` when done.

Commit subject MUST end with `[skip release]`, e.g.
`chore: bound CI ACME install, ignore runtime byproducts, correct release status [skip release]`
</output>
