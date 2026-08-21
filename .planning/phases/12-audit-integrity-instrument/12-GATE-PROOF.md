---
outcome: red-then-green
guard: docs-linerefs.test.ts
planted_change: "CLAUDE.md line 26, the rewriteArguments() call-site citation `vice-proxy.ts:3029` changed to `vice-proxy.ts:3030` -- a single digit, one line, no other bytes touched"
reverted: true
criteria: [1, 2]
date: 2026-08-21
sha: f22cfc3c2926fc430324f9b2499fd4ce69020020
---

# Phase 12 Plan 04 -- The real-tree plant-and-revert transcript

This document is the one-time evidence GATE-01's criteria 1 and 2 ask for: a
guard deliberately turned red on the actual repository working tree, the
mechanism (`scripts/audit-gate.mjs`) captured refusing the audit-`passed` path
while it is red, a revert shown as explicitly as the plant, and the same
mechanism captured allowing the gated path again afterwards. Every command
below ran against this repository's real working tree at sha
`f22cfc3c2926fc430324f9b2499fd4ce69020020`, never a synthetic fixture. No
source file other than `CLAUDE.md` was touched during the plant, and
`CLAUDE.md` itself was reverted to its exact pre-plant byte content before any
`git add` in this plan.

The permanent, standing proof that this mechanism keeps working is the
committed planted-violation/planted-false-negative pair in
`audit-integrity.test.ts` (D-12-16, built in plan 12-01, against
`mkdtempSync`-built synthetic trees). This document is the secondary, one-time
proof that the same mechanism also works against the real tree, once, on the
record.

## 1. Baseline

Before touching anything, the tree is clean and every relevant check is green.

```
$ git status --porcelain
(no output -- clean)
```

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status
```

```
$ cd .claude/mcp/vice && node --test docs-linerefs.test.ts
TAP version 13
# Subtest: CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)
ok 1 - CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)
# Subtest: every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
ok 2 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
# Subtest: planted-violation: a citation pointing at an unrelated line fails this test's own logic (proves the guard is not vacuous)
ok 3 - planted-violation: a citation pointing at an unrelated line fails this test's own logic (proves the guard is not vacuous)
1..3
# tests 3
# suites 0
# pass 3
# fail 0
```

## 2. The plant (D-12-18)

`CLAUDE.md` line 26 is the Architecture bullet citing `rewriteArguments()`'s
call sites. The digit changed is the first citation, `3029` (the call site
inside `forwardToVice()`), which becomes `3030`. Nothing else in the file
changes -- confirmed by a `--stat` of exactly one file, one line, and the full
one-line diff hunk:

```
$ sed -i 's/vice-proxy\.ts:3029/vice-proxy.ts:3030/' CLAUDE.md
$ git diff --stat CLAUDE.md
 CLAUDE.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

```
$ git diff CLAUDE.md
-- ... `rewriteArguments()` runs at `vice-proxy.ts:3029` inside `forwardToVice()` ...
++ ... `rewriteArguments()` runs at `vice-proxy.ts:3030` inside `forwardToVice()` ...
(single line changed, single digit inside it: 3029 -> 3030)
```

This one-digit choice is deliberate (D-12-18): reverting a documentation
citation is a one-character undo with zero risk to product code, unlike
reddening `docs-review-disposition.test.ts` or `docs-deferred-ledger.test.ts`,
either of which would require moving a todo out of the tree or editing
`STATE.md` -- files other derivations read.

## 3. The guard is genuinely red

`vice-proxy.ts:3030` is `translatedArgs = rewritten.args;` -- neither a
`rewriteArguments()` call nor a function declaration. `docs-linerefs.test.ts`'s
own second test catches it, in its own voice, quoting the bad line:

```
$ cd .claude/mcp/vice && node --test docs-linerefs.test.ts
TAP version 13
ok 1 - CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)
not ok 2 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
  ---
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/docs-linerefs.test.ts:66:1'
  failureType: 'testCodeFailure'
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
  code: 'ERR_ASSERTION'
  ...
ok 3 - planted-violation: a citation pointing at an unrelated line fails this test's own logic (proves the guard is not vacuous)
1..3
# tests 3
# suites 0
# pass 2
# fail 1
```

## 4. The mechanism refuses (criterion 1)

Running the check-mode CLI from the repo root, against the real tree, with the
real guard genuinely red:

```
$ node scripts/audit-gate.mjs
audit-gate: REFUSED
(a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts -- while 4 milestone audit(s) declare a gated status [/home/henrik/dev/henrik/git/c64-re-tools/.planning/milestones/v0.2.0-MILESTONE-AUDIT-round1-2026-08-19.md (status: tech_debt); /home/henrik/dev/henrik/git/c64-re-tools/.planning/milestones/v0.2.0-MILESTONE-AUDIT.md (status: tech_debt); /home/henrik/dev/henrik/git/c64-re-tools/.planning/milestones/v0.3.0-MILESTONE-AUDIT-round1-2026-08-21.md (status: tech_debt); /home/henrik/dev/henrik/git/c64-re-tools/.planning/milestones/v0.3.0-MILESTONE-AUDIT.md (status: passed)]. (b) failing assertion output:
TAP version 13
... (all 14 real docs-guard subtests, test 14 is the planted failure) ...
not ok 14 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.
$ echo "EXIT:$?"
EXIT:1
```

This is D-12-15's three-part refusal, all present: (a) names the red guard(s)
-- `docs-linerefs.test.ts` is named, alongside the other three guard files (see
note below on why all four are listed); (b) the guard's own failing assertion
text, verbatim, including the exact line quoted above; (c) the two legitimate
routes, with an explicit statement that no waiver or environment-variable
bypass exists. The refusal also names
`.planning/milestones/v0.3.0-MILESTONE-AUDIT.md` (`status: passed`) and three
`tech_debt` files -- `v0.2.0-MILESTONE-AUDIT-round1-2026-08-19.md`,
`v0.2.0-MILESTONE-AUDIT.md`, `v0.3.0-MILESTONE-AUDIT-round1-2026-08-21.md` --
real-tree evidence that both gated statuses are blocked (D-12-12).

**Note on why all four guard files are named, not only `docs-linerefs.test.ts`:**
`parseRedGuardNames()` (`scripts/audit-gate.mjs`) looks for top-level
`not ok <n> - <file>` TAP lines naming a guard file directly. When `node --test`
runs multiple files in one invocation, each individual test's own name
surfaces in the TAP stream, not a per-file wrapper name, so that primary parse
finds nothing here and the function falls back to the documented behaviour:
"Falls back to the full guard list when the parse finds nothing, so a refusal
is never silently unnamed even if the TAP shape ever changes." That is exactly
what is captured above -- a real, working fallback, not a defect -- and
`docs-linerefs.test.ts` is present in the listed set either way, satisfying
this plan's acceptance criterion.

The machine-readable form of the same verdict:

```
$ node scripts/audit-gate.mjs --json
{"allowed":false,"redGuards":["docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts","docs-linerefs.test.ts","docs-review-disposition.test.ts"],"gatedAudits":[{"file":".../v0.2.0-MILESTONE-AUDIT-round1-2026-08-19.md","status":"tech_debt"},{"file":".../v0.2.0-MILESTONE-AUDIT.md","status":"tech_debt"},{"file":".../v0.3.0-MILESTONE-AUDIT-round1-2026-08-21.md","status":"tech_debt"},{"file":".../v0.3.0-MILESTONE-AUDIT.md","status":"passed"}], ...}
$ echo "EXIT:$?"
EXIT:1
```

## 5. `gaps_found` is untouched (D-12-13)

The same `--json` capture's `auditFiles` array has six entries; `gatedAudits`
has exactly four. The two files present in `auditFiles` but absent from
`gatedAudits`, even while the guard is red, are the two `gaps_found` rounds:

```
auditFiles (6):
  .../v0.2.0-MILESTONE-AUDIT-round1-2026-08-19.md   -> gatedAudits (tech_debt)
  .../v0.2.0-MILESTONE-AUDIT-round2-2026-08-19.md   -> NOT in gatedAudits (gaps_found)
  .../v0.2.0-MILESTONE-AUDIT-round3-2026-08-19.md   -> NOT in gatedAudits (gaps_found)
  .../v0.2.0-MILESTONE-AUDIT.md                     -> gatedAudits (tech_debt)
  .../v0.3.0-MILESTONE-AUDIT-round1-2026-08-21.md   -> gatedAudits (tech_debt)
  .../v0.3.0-MILESTONE-AUDIT.md                     -> gatedAudits (passed)

statusCounts: {"tech_debt":3,"gaps_found":2,"passed":1}
```

A milestone audit honestly reporting open gaps (`gaps_found`) passes through
unobstructed even while a docs guard is red and even while other audits in the
same tree are gated and refused. This is real-tree evidence for D-12-13, not a
synthetic claim.

## 6. Layer 1 red

`audit-integrity.test.ts` (the committed test suite built in plan 12-01/02/03)
asserts, among its 27 tests, that no milestone audit declares a gated status
while any docs guard is red. Running it with the plant still in place:

```
$ cd .claude/mcp/vice && node --test audit-integrity.test.ts
...
not ok 4 - no milestone audit declares a gated status while any docs guard is red (D-12-02)
  ---
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/audit-integrity.test.ts:210:1'
  failureType: 'testCodeFailure'
  error: |-
    expected exit 0 on the real tree; reason: (a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts -- while 4 milestone audit(s) declare a gated status [...]
...
1..14
# tests 27
# suites 2
# pass 26
# fail 1
```

The planted-violation and planted-false-negative tests (D-12-16) still pass
even here, because they run entirely against `mkdtempSync`-built synthetic
trees, independent of this repo's own real-tree state:

```
ok 6 - planted violation: a synthetic tree with a red guard and an audit declaring status: passed is refused (D-12-16)
ok 7 - planted false-negative: the same synthetic audit with all guards green is allowed (D-12-16)
```

The one real failure (test 4, the real-tree D-12-02 assertion) is the exact
and only expected failure -- it IS the evidence, not a defect to fix.

## 7. Hook path refuses too

The deterministic hook-mode contract tests (plan 12-02, `hook mode` describe
block) run against synthetic roots and stay green regardless of this repo's
real-tree state:

```
$ node --test --test-name-pattern="hook mode" audit-integrity.test.ts
ok 1 - hook mode: scripts/audit-gate.mjs --hook (plan 12-02, D-12-03)
1..1
# tests 10
# suites 1
# pass 10
# fail 0
```

To show the hook refusing the REAL tree while it is red, a payload was built
in Node (never as a literal Bash string, per this plan's hazard 1) and piped
to `--hook --root <repo-root>`:

```
$ node -e '
const payload = {
  tool_name: "Write",
  tool_input: {
    file_path: ".planning/v9.9.9-MILESTONE-AUDIT.md",
    content: "---\nstatus: passed\n---\n",
  },
};
process.stdout.write(JSON.stringify(payload));
' | node scripts/audit-gate.mjs --hook --root "$(pwd)"
audit-gate --hook: REFUSED
(a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts.
(b) failing assertion output:
... (same TAP block, test 14 the planted failure) ...
(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.
$ echo "EXIT:$?"
EXIT:2
```

Exit code `2` -- the hook's sole blocking mechanism (never the `exit 2` +
`permissionDecision` combination, per plan 12-02's own decision, unreliable
per `anthropics/claude-code#43407`). No scratch file was ever actually created
by this probe -- `--hook` mode only inspects the proposed `tool_input`, it does
not perform the write itself, so there is nothing to clean up.

## 8. The revert (D-12-20)

```
$ sed -i 's/vice-proxy\.ts:3030/vice-proxy.ts:3029/' CLAUDE.md
$ git diff --stat CLAUDE.md
(no output -- no diff)
$ git status --porcelain
(no output -- clean)
```

The tree is byte-identical to its pre-plant state, confirmed mechanically
(`git diff --quiet CLAUDE.md` exits 0), not merely asserted in prose.

## 9. Green again (criterion 2)

The guard's own output after the revert, shown in full -- not a bare claim
that it passed:

```
$ cd .claude/mcp/vice && node --test docs-linerefs.test.ts
TAP version 13
ok 1 - CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)
ok 2 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
ok 3 - planted-violation: a citation pointing at an unrelated line fails this test's own logic (proves the guard is not vacuous)
1..3
# tests 3
# suites 0
# pass 3
# fail 0
```

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status
$ echo "EXIT:$?"
EXIT:0
```

```
$ cd .claude/mcp/vice && npm test
... (full suite) ...
# tests 2229
# suites 23
# pass 2194
# fail 0
# cancelled 0
# skipped 30
# todo 5
```

(One earlier attempt at this same command, run concurrently with a second
`npm test` invocation from a diagnostic `grep` pipeline while investigating
this transcript, reported `# fail 1` with no failing test name visible in the
truncated tail. Re-run cleanly in isolation, immediately after, the full suite
is `2194 pass / 0 fail`, and `git status --porcelain` was clean throughout
both runs -- the one transient failure was contention between two concurrent
`node --test` invocations sharing this repo's broker/pool state, not a
consequence of the plant or the revert. Recorded here rather than omitted.)

```
$ node scripts/check-npm-packages.mjs
check-npm-packages: transitive closure from vice-proxy.ts -- 56 modules, clean
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 73 files
  @henols/c64-re-tools@0.0.0-dev -- 35 files, 6 skills
```

## What this does and does not prove

**Criterion 3's citation.** The check point is `checkAuditGate()`, exported
from `scripts/audit-gate.mjs` at line 298 (as of sha
`f22cfc3c2926fc430324f9b2499fd4ce69020020`), which derives the guard set,
re-runs it live via `runGuardsLive()`, discovers every `*MILESTONE-AUDIT*.md`
file via `milestoneAuditFiles()`, and refuses whenever a gated status is
declared while any guard is red. It is called from `main()`
(`scripts/audit-gate.mjs`, human/check mode) and from `hookMain()` (`--hook`
mode, plan 12-02). The live PreToolUse wiring that invokes it is
`.claude/settings.json`'s single `hooks.PreToolUse` entry: matcher
`Write|Edit|Bash`, command
`node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook`, timeout 30
(committed in plan 12-03, guarded by Layer 1's own "settings wiring" tests).

**Gating `tech_debt` alongside `passed` is deliberate, and stricter than
GATE-01's literal wording**, which names only `passed`. `isGatedStatus()`
gates both because both statuses route to `/gsd-complete-milestone` (D-12-12)
-- a milestone audit that honestly reports outstanding tech debt is still
making the same kind of forward-moving claim `4f048bb` got wrong once before,
and the mechanism that exists to prevent a repeat of that mistake would be
incomplete if it only watched `passed`. `gaps_found` is deliberately never
gated (D-12-13, shown live in section 5 above): a milestone honestly reporting
open gaps must never be blocked from saying so. A future milestone audit
reading this document should read the `tech_debt` inclusion as intentional
scope, not as drift beyond GATE-01's stated wording.

**The Bash-mode scan is a heuristic, not a parser, and is evadable.** Hook
mode's Bash-target detection (plan 12-02) matches literal command TEXT
adjacency -- a writer token (`>`, `tee`, `sed -i`, etc.) immediately or
eventually preceding a `MILESTONE-AUDIT...md` token -- never actual shell
syntax. A base64-encoded payload, or a `python -c` one-liner that assembles
the write target or the gated status text at runtime, evades this scan by
design (T-12-02, accepted, carried forward unchanged from plan 12-02). This is
stated here plainly rather than implied away: the hook is a fast, in-session
deterrent, not the enforcement boundary. Layer 1 -- `audit-integrity.test.ts`
driving `checkAuditGate()`, which re-reads the actual committed file content
regardless of how the shell wrote it -- is the unevadable enforcement point.
Any milestone-close workflow that only trusted the hook, and skipped running
Layer 1's tests before declaring a gated status, would not actually be
protected by this mechanism.

**The live in-session hook block is not exercised by this document.** Claude
Code loads `PreToolUse` hook configuration at session start, and this
session's `.claude/settings.json` predates plan 12-03's commit that made the
hook block live and committed. What this document proves is the mechanism
itself -- `checkAuditGate()` and `--hook` mode -- refusing and allowing
correctly against the real tree, run directly as a subprocess exactly as the
hook would invoke it. The actual live, in-session Write/Edit/Bash block --
Claude Code itself refusing a tool call because this hook fired -- is verified
separately by the end-of-phase human check recorded in `12-04-PLAN.md`'s
`<verify>` block, which requires a fresh session (so the now-committed hook
configuration is loaded) to plant the same digit, attempt the three write
routes, observe all three refused, then revert and observe the same write
succeed.

**Superseded 2026-08-21 (plan 12-07).** The paragraph above is left exactly as
written, because it was true when written and the record of what this document
did *not* prove is worth keeping. Its claim no longer holds, though: the
`## Live in-session hook block` section below now records the live
Write/Edit/Bash block, observed in a session that did load the committed
project hook -- all three routes refused, plus a fourth subagent-routed
attempt. The forward reference to `12-04-PLAN.md`'s `<verify>` block is
discharged in that section, not elsewhere.

## Detection contract amended by gap closure

**Dated: 2026-08-21, plan 12-05.** The paragraph above headed "The Bash-mode
scan is a heuristic, not a parser, and is evadable" describes the Bash
detection contract as it stood after plan 12-02: a writer token (`>`, `tee`,
`sed -i`, etc.) matched IMMEDIATELY or EVENTUALLY preceding a
`MILESTONE-AUDIT...md` token, via `BASH_ADJACENT_WRITE_RE` and
`BASH_INPLACE_EDIT_RE`, bridged by an unbounded `[\s\S]*?`. `12-VERIFICATION.md`
and `12-REVIEW.md` (CR-01) independently reproduced that this unbounded bridge
is a live denial-of-service: an ordinary large `sed -i`/`perl -i` Bash call
unrelated to any milestone audit measured 7,050 ms to evaluate, against a hook
wired to every Write/Edit/Bash call in this repo via the committed
`.claude/settings.json` (matcher `Write|Edit|Bash`, timeout 30). `12-REVIEW.md`
(CR-03) separately found that the single-line Bash append shapes (`echo`,
`printf`, `tee -a`, one-line `sed -i`) bypassed detection entirely, because
`writtenDeclaresGatedStatus()`'s line-anchored scan never finds `status:` at
the start of a line inside a one-line command string.

**What replaced it.** CR-01: the unbounded bridging regexes are gone.
`auditTokenOffsets()` locates the literal `MILESTONE-AUDIT` token with
`String.prototype.indexOf` (linear, cannot backtrack, up to 64 occurrences per
text), then `bashTargetsMilestoneAudit()` examines only a fixed-length window
around each hit: 512 characters preceding the token for the redirect/writer
adjacency shapes (`>`, `>>`, `tee`, `dd of=`), and 4096 characters preceding it
for `sed -i`/`perl -i` in-place-edit presence. Measured post-fix: the same
100,000-character `sed -i ` command now evaluates in ~44 ms through the real
`--hook` CLI end to end (down from 7,050 ms for the regex alone, pre-fix).
CR-03: a new unanchored scan, `declaresGatedStatusUnanchored()`, built from
the same `GATED_STATUSES` set `isGatedStatus()` uses, replaces the
line-anchored scan specifically in the Bash branch of `isHookInScope()`
(the structured `Write`/`Edit` document-content branch keeps the
line-anchored scan unchanged, to preserve the T-12-04 false-positive
defence). All four single-line append shapes are now blocked; both fixes are
pinned by committed tests seen red against the pre-fix source and green
against the fix.

**Why bounded windows rather than one global input cap.** A global cap (e.g.
slicing the command to its first 4096 characters before matching) is a
bypass: place the write past the cut point and the gate never sees it. The
windowed approach instead locates the token first across the FULL input, then
bounds only the regex work done around each hit -- full-length coverage is
preserved while every regex evaluation stays constant-cost.

**T-12-20 (new, accepted).** The 4096-character in-place-edit window means a
`sed -i`/`perl -i` script argument longer than that, before its target
filename, is no longer detected. This is accepted as strictly better than the
alternative it replaces (the unbounded bridge was the denial of service): a
3,000-character `sed -i` script is still detected (measured); realistic
in-place edits are far below the window; and Layer 1 (`checkAuditGate()`
re-reading the actual committed file content) still catches the landed write
regardless of how the shell wrote it.

**Carried forward unchanged.** T-12-02's base64/`python -c` limitation --
this function matches literal command TEXT, never shell semantics, and a
runtime-assembled write target or status string evades it by design -- is
unaffected by this amendment. Layer 1 remains the unevadable enforcement
point; the hook is a fast, in-session deterrent, not the enforcement
boundary.

This section is additive. The paragraph above it is left as originally
written -- a historical transcript of the contract as it stood after plan
12-02 -- not rewritten to match the current code.

## Live in-session hook block

This is the `## Live in-session hook block` section the closing paragraph
above (dated before this section existed) says is "not exercised by this
document." Plan 12-07 exists to discharge that promise. Everything below this
point is either a verbatim instruction for the human to follow in a live
Claude Code session, or a slot for the human's reported observation. Nothing
below was predicted, inferred, or produced by this executor's own tool calls
(hazard 3 of `12-07-PLAN.md`: this executor's own writes go through the same
hook, but whether the hook was loaded for *this* session cannot be
established by this executor -- only the human's restart establishes that).

### Preflight, recorded by the executor (Task 1, 2026-08-21)

- `.claude/settings.json` parses as valid JSON and declares exactly one
  `PreToolUse` entry: matcher `Write|Edit|Bash`, command
  `node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook`, timeout `30`.
- The settings-wiring suite (`audit-integrity.test.ts`, describe block
  `settings wiring: .claude/settings.json (plan 12-03, D-12-05)`, 5 subtests)
  passes, and the full `audit-integrity.test.ts` suite passes 43/43.
- The plant target is still in place: `CLAUDE.md`'s `rewriteArguments()`
  bullet still cites `vice-proxy.ts:3029` as the first citation (the digit
  has not moved since plan 12-04), and `docs-linerefs.test.ts` currently
  passes 3/3.
- The tree is green and clean: `node scripts/audit-gate.mjs` prints
  `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4
  declaring a gated status`, and `git status --porcelain` shows no
  modifications to tracked files (only pre-existing untracked GSD-core
  installer scaffolding unrelated to this plan).
- The hook command line resolves standalone: piping a `Read`-shaped payload
  (an out-of-scope tool) to `node scripts/audit-gate.mjs --hook --root
  "$(pwd)"` exits `0`. This proves the command in `settings.json` is
  runnable; it does not and cannot prove Claude Code's own dispatch invokes
  it -- that is exactly what this section exists to observe.
- `node scripts/audit-gate.mjs --json`'s `auditFiles` array has **6** entries
  at preflight time. Task 3 compares the post-test count against this number
  to confirm the scratch file left no residue.

### Instructions for the human (run in order)

Everything here is copy-pasteable or paste-as-a-prompt. Nothing needs to be
reconstructed at checkpoint time.

1. **Load the hook.** Start a fresh Claude Code session in this repo (or run
   `/hooks` and approve the committed project hook in the current session).
   Note the Claude Code version (`claude --version` or the session's own
   startup banner).
2. **Plant.** Run:
   ```
   sed -i 's/vice-proxy\.ts:3029/vice-proxy.ts:3030/' CLAUDE.md
   ```
   Then confirm it reddened:
   ```
   cd .claude/mcp/vice && node --test docs-linerefs.test.ts
   ```
3. **Route A -- Write.** In the live session, ask Claude:
   > Use the Write tool to create `.planning/v9.9.9-MILESTONE-AUDIT.md` with
   > this exact content:
   > ```
   > ---
   > status: passed
   > ---
   > # Scratch milestone audit (live hook test, plan 12-07 -- delete after use)
   > ```
   Expect the tool call to be refused, with the gate's stderr visible in the
   transcript. Copy the refusal text verbatim.
4. **Route B -- Edit.** Ask Claude to make the equivalent change with the
   Edit tool against an *existing* milestone-audit file (e.g. change
   `status: tech_debt` to `status: tech_debt` unchanged but touch a comment
   line in `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`, or, if Route A's
   scratch file was created before the refusal fired, edit that). Expect the
   same class of refusal. Copy the refusal text verbatim.
5. **Route C -- Bash heredoc.** Ask Claude to run:
   ```
   cat > .planning/v9.9.9-MILESTONE-AUDIT.md <<'EOF'
   ---
   status: passed
   ---
   # Scratch milestone audit (live hook test, plan 12-07 -- delete after use)
   EOF
   ```
   via the Bash tool. Expect the same class of refusal. This step doubles as
   the **A3** observation (`12-HOOK-STDIN-EVIDENCE.md`): if the refusal
   fires, the heredoc's full multi-line body reached `tool_input.command`
   intact (the hook could not have refused on the first line alone, since the
   first line contains no gated-status token).
6. **Revert.** Run:
   ```
   sed -i 's/vice-proxy\.ts:3030/vice-proxy.ts:3029/' CLAUDE.md
   ```
   Then confirm:
   ```
   cd .claude/mcp/vice && node --test docs-linerefs.test.ts
   node scripts/audit-gate.mjs
   ```
   Expect 3/3 green and `audit-gate: OK`.
7. **Control.** Ask Claude to repeat Route A's Write exactly. Expect it to
   **succeed** this time (guard is green again). Then delete the scratch
   file:
   ```
   rm -f .planning/v9.9.9-MILESTONE-AUDIT.md
   ```
   Confirm with `git status --porcelain` and `test ! -e
   .planning/v9.9.9-MILESTONE-AUDIT.md`.
8. **Optional -- Route D (A2).** If you want the A2 assumption (subagent
   routing) confirmed rather than accepted, spawn a subagent (e.g. via the
   Task tool) and have it attempt one of the same writes from inside its own
   context. Record whether the hook fired for it.
9. Report back, in your own words, what happened at each step above --
   including anything that did NOT behave as expected. Name which branch
   (CONFIRMED or ACCEPTED LIMITATION) you want recorded for A2 and for A3.

### Step 1 -- Session state

Claude Code version and how the hook was loaded (fresh session start, or
`/hooks` approval of the committed project hook):

Claude Code 2.1.238 (`claude --version`, run in this session).

The committed project `PreToolUse` entry in `.claude/settings.json` was
already active when the session began. No `/hooks` approval was performed
in-session; the first gated write attempted (Step 3) was refused immediately.
The hook was therefore loaded at session start from the committed file, which
is what the entry exists to do.

OBSERVER: this Claude Code session itself (model `claude-opus-5[1m]`), not a
human reading a screen. Every refusal quoted in Steps 3, 4, 5 and 9 is the
verbatim tool-result payload the harness returned to the model after blocking
the call -- not prose composed by the recorder. See "Provenance of these
observations" at the end of this section for why that differs from what these
slots anticipated, and what it still does not cover.

### Step 2 -- The plant

The exact one-digit `CLAUDE.md` edit (`vice-proxy.ts:3029` -> `:3030`), its
`git diff`, and the `docs-linerefs.test.ts` run showing it red, with the
failing assertion named:

The plant, and the guard going red:

```
$ sed -i 's/vice-proxy\.ts:3029/vice-proxy.ts:3030/' CLAUDE.md
$ git diff --stat CLAUDE.md
 CLAUDE.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

$ cd .claude/mcp/vice && node --test docs-linerefs.test.ts
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/docs-linerefs.test.ts:81:12)
1..3
# tests 3
# pass 2
# fail 1
```

FAILING ASSERTION NAMED: subtest 14 of the derived guard set, subtest 2 of 3
within `docs-linerefs.test.ts` itself -- "every vice-proxy.ts:<N> citation in
CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments()
call or its enclosing function", at `docs-linerefs.test.ts:66:1`, asserting
at `:81:12`. Subtest 3 ("planted-violation: ... proves the guard is not
vacuous") stayed green throughout, so the guard's own non-vacuity control was
never what reddened.

NOTE ON REPETITION (D-12-20 honesty): the live test ran across three
plant/revert cycles, not one, because the session was driven interactively in
three batches and the guard has to be red for each batch's attempts to mean
anything. Each cycle used the identical one-digit `sed` above and each was
reverted with the inverse `sed` before the batch ended. The final state is
recorded in Steps 6 and 7.

### Step 3 -- Route A (Write)

Observed outcome of the live `Write` tool call attempting to create
`.planning/v9.9.9-MILESTONE-AUDIT.md` with a gated status. If refused, the
gate's stderr text verbatim:

REFUSED. The file was not created.

Payload: `file_path` `.planning/v9.9.9-MILESTONE-AUDIT.md`, `content` the
four-line scratch audit whose frontmatter declares `status: passed`.

Gate stderr, verbatim as returned to the model:

```
PreToolUse:Write hook error: [node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook]: audit-gate --hook: REFUSED
(a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts.
(b) failing assertion output:
TAP version 13
[... ok 1 through ok 13 elided by the recorder; all thirteen passed ...]
# Subtest: every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
not ok 14 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
  ---
  duration_ms: 1.792024
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/docs-linerefs.test.ts:66:1'
  failureType: 'testCodeFailure'
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: f
... [truncated 2030 more characters]
(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.
```

The trailing `actual: f` and `... [truncated 2030 more characters]` are the
harness clipping the hook's stderr on its way into the tool result, not the
hook emitting malformed output; the `(c)` paragraph was still rendered after
the truncation marker. What is quoted here is therefore what the model was
actually shown, which is the thing under test.

### Step 4 -- Route B (Edit)

Observed outcome of the live `Edit` tool call attempting the same change
against an existing milestone-audit file:

REFUSED, in two independent payload shapes. The target file was
unmodified in both cases.

Route A's scratch file did not exist to edit -- Step 3 was refused before
creation -- so both variants used an existing audit,
`.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`, whose frontmatter line 11
reads `status: tech_debt` (verified unique in the file by `grep -n`).

VARIANT B1 -- the gated token present as unchanged context. `old_string`
`status: tech_debt\nscores:`, `new_string` the same two lines with a comment
line inserted between them. REFUSED.

VARIANT B2 -- the gated token as the edit itself. `old_string`
`status: tech_debt`, `new_string` `status: passed`: a real milestone audit
being upgraded to a gated status while four guards are red, which is
precisely the failure mode this instrument exists to prevent. REFUSED.

B2 also exercises the D-12-13 both-sides property: a gated value on the OLD
side and a gated value on the NEW side. Gate stderr for B2, verbatim:

```
PreToolUse:Edit hook error: [node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook]: audit-gate --hook: REFUSED
(a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts.
(b) failing assertion output:
TAP version 13
[... ok 1 through ok 13 elided by the recorder; all thirteen passed ...]
# Subtest: every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
not ok 14 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
  ---
  duration_ms: 1.832296
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/docs-linerefs.test.ts:66:1'
  failureType: 'testCodeFailure'
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: f
... [truncated 2030 more characters]
(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.
```

B1 returned the same refusal with the same four red guards and the same
`not ok 14`. Post-revert verification: line 11 of the audit still reads
`status: tech_debt`, and `git status --porcelain -- .planning/milestones/` is
empty.

### Step 5 -- Route C (Bash heredoc) -- also the A3 observation

Observed outcome of the live `Bash` heredoc attempting the same write. This
step is the A3 disposition: whether the full multi-line heredoc body reached
`tool_input.command` intact.

REFUSED.

The command dispatched through the `Bash` tool was, in full:

```
cat > .planning/v9.9.9-MILESTONE-AUDIT.md <<'EOF'
---
status: passed
---
# Scratch milestone audit (live hook test, plan 12-07 -- delete after use)
EOF
```

Gate stderr, verbatim:

```
PreToolUse:Bash hook error: [node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook]: audit-gate --hook: REFUSED
(a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts.
(b) failing assertion output:
TAP version 13
[... ok 1 through ok 13 elided by the recorder; all thirteen passed ...]
# Subtest: every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
not ok 14 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
  ---
  duration_ms: 1.750489
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/docs-linerefs.test.ts:66:1'
  failureType: 'testCodeFailure'
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: fa
... [truncated 2029 more characters]
(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.
```

A3 DISPOSITION: CONFIRMED. The command's first line,
`cat > .planning/v9.9.9-MILESTONE-AUDIT.md <<'EOF'`, carries the
`MILESTONE-AUDIT` target but contains no gated-status token; `status: passed`
sits on line 3 of the heredoc body. The hook cannot reach REFUSED without
both halves of its predicate, so the multi-line body was present in
`tool_input.command` and was scanned. A first-line-only payload would have
exited 0 under the scope fence.

This is a positive-evidence confirmation, not an absence-of-error one: the
refusal could only have fired if the body arrived.

### Step 6 -- The revert (D-12-20)

The digit restored, `docs-linerefs.test.ts` green again with its output
shown, `node scripts/audit-gate.mjs` back to `audit-gate: OK`:

The digit restored and everything green again:

```
$ sed -i 's/vice-proxy\.ts:3030/vice-proxy.ts:3029/' CLAUDE.md
$ git status --porcelain -- CLAUDE.md
(no output -- CLAUDE.md byte-identical to HEAD)

$ cd .claude/mcp/vice && node --test docs-linerefs.test.ts
# tests 3
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0

$ node scripts/audit-gate.mjs
audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status
$ echo $?
0
```

The `git status --porcelain -- CLAUDE.md` line is the load-bearing one: the
plant is not merely re-fixed but byte-identical to the committed file, so no
residue of the three plant/revert cycles survives in the tracked tree.

### Step 7 -- The post-revert control

Route A's `Write` attempted again, now succeeding, followed by deletion of
the scratch file and confirmation it is gone:

The control SUCCEEDED, and the scratch file is gone.

```
Write .planning/v9.9.9-MILESTONE-AUDIT.md   (identical file_path and content to Step 3)
-> File created successfully at /home/henrik/dev/henrik/git/c64-re-tools/.planning/v9.9.9-MILESTONE-AUDIT.md

$ node scripts/audit-gate.mjs
audit-gate: OK -- 4 docs guards green, 7 milestone audits scanned, 5 declaring a gated status

$ rm -f .planning/v9.9.9-MILESTONE-AUDIT.md
$ test ! -e .planning/v9.9.9-MILESTONE-AUDIT.md && echo "scratch deleted: confirmed"
scratch deleted: confirmed

$ node scripts/audit-gate.mjs
audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status
$ git status --porcelain -- CLAUDE.md .planning/
?? .planning/milestone.lock
```

Two things this control establishes beyond "the write works when green".

First, the intermediate `7 milestone audits scanned, 5 declaring a gated
status` proves the scratch file was genuinely discovered by
`milestoneAuditFiles()` and genuinely classified as gated -- so the Step 3-5
refusals were the gate deciding on a real in-scope target, not an accident of
path matching. The count returns to `6 / 4` after deletion, matching the
Task 1 preflight figure exactly.

Second, `.planning/milestone.lock` is the only entry left in `git status`,
and it was already untracked before this test began. No tracked file was
left modified.

### Step 8 -- What this does and does not establish

This section, once Steps 1-7 are filled in, establishes live `PreToolUse`
dispatch for the three write routes tested (Write, Edit, Bash heredoc) on the
one Claude Code version recorded in Step 1, in this one session, against this
one committed hook configuration. It does not establish that dispatch holds
for every future Claude Code version, nor does it establish anything about
subagent-routed tool calls (assumption A2) unless Step 9 below records an
attempt. A route observed NOT refused in any step above is a real finding
about this mechanism, not something this paragraph should be read as
overriding.

### Step 9 -- Optional: Route D (subagent routing, A2)

If attempted, the subagent's tool-call attempt and whether the hook fired for
it. If not attempted, an explicit statement that Route D was not attempted
and A2 is being recorded as an accepted limitation instead:

ROUTE D WAS ATTEMPTED. A2 DISPOSITION: CONFIRMED.

A `general-purpose` subagent was spawned via the Agent tool while the guard
was red, instructed to make exactly one `Write` attempt at
`.planning/v9.9.9-MILESTONE-AUDIT.md` with the same gated-status content, to
not retry, to not fall back to another route, and to report a success
honestly if one occurred. It reported REFUSED, quoting the gate stderr from
its own tool result:

```
PreToolUse:Write hook error: [node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook]: audit-gate --hook: REFUSED
(a) red guard(s): docs-dangling-refs.test.ts, docs-deferred-ledger.test.ts, docs-linerefs.test.ts, docs-review-disposition.test.ts.
(b) failing assertion output:
TAP version 13
[... ok 1 through ok 13 elided by the recorder; all thirteen passed ...]
# Subtest: every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
not ok 14 - every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
  ---
  duration_ms: 1.730578
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/docs-linerefs.test.ts:66:1'
  failureType: 'testCodeFailure'
  error: 'vice-proxy.ts:3030 (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: "    translatedArgs = rewritten.args;"'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: fals
... [truncated 2026 more characters]
(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.
```

The parent session then verified independently that the subagent's blocked
write left no file (`test ! -e` passed before the Step 6 revert).

ORDERING DEVIATION: this step was run BEFORE Step 6's revert, not after as
the instructions list it. A subagent attempt made after the revert would run
against a green guard and could only ever succeed, establishing nothing. The
revert and control in Steps 6 and 7 follow it.

SCOPE OF THE CONFIRMATION, stated narrowly: Claude Code 2.1.238, one
in-process `general-purpose` subagent, `Write` route only. It does not cover
a subagent's `Bash` or `Edit` routes, nor other agent types, nor a nested
`claude -p` process (which this plan prohibits and which was not used).
Nothing in the hook's dispatch path distinguishes subagent context, and the
parent session confirmed all three routes directly, but those are arguments
rather than observations and are not recorded here as observations.


### Provenance of these observations

The eight slots above were authored expecting a human operator to run the
kit and report back, because plan 12-07 anticipated its own executor being a
GSD subagent that could not know whether the hook was loaded in its session
-- so anything that executor wrote about a live refusal would be
reconstruction from reading `audit-gate.mjs`, which the plan's prohibitions
forbid outright.

That hazard is absent from what is recorded above, by a different route than
the plan planned for. The observer is the Claude Code session itself. Every
refusal block is the tool-result payload the harness handed back after
refusing the model's own call -- the model could not have obtained that text
by predicting it, and each blocked write was independently verified to have
left no file. The operator drove the kit step by step in this session and the
refusals appeared in the shared transcript.

What this provenance does NOT establish, and is not claimed above: that a
human independently reproduced the refusals in a separate session, or that
any route not listed was tested. A future reader wanting a
human-eyeballs-on-screen confirmation should treat this section as
session-observed evidence rather than operator-observed evidence, and rerun
the kit's Steps 1-7 if that distinction matters to them.

### Deviations from the kit as written

Four, all recorded above at their step, collected here so a reader does not
have to reassemble them:

1. Step 4 used the existing-audit branch (Route A's file never existed to
   edit) and ran TWO variants, B1 and B2, rather than one.
2. Step 9 ran before Step 6, because a subagent attempt against a green
   guard proves nothing.
3. Three plant/revert cycles were used rather than one, matching the three
   interactive batches the session was driven in. Each was reverted.
4. The refusal names all FOUR docs guards as red -- `docs-dangling-refs`,
   `docs-deferred-ledger`, `docs-linerefs`, `docs-review-disposition` -- not
   only `docs-linerefs.test.ts` as the instructions' step 2 implies. This is
   known, documented behaviour rather than a finding against the mechanism:
   see this document's own section 4, "Note on why all four guard files are
   named, not only `docs-linerefs.test.ts`", which traces it to
   `parseRedGuardNames()` finding no top-level `not ok <n> - <file>` line
   when `node --test` runs several files in one invocation, and falling back
   to the documented full-guard-list behaviour. The live section observed
   exactly what section 4 predicted; the instruction text is what was
   imprecise.

One further incidental observation, worth recording because it is the only
live evidence this document holds for the scope fence: the plant and revert
`sed` commands in Steps 2 and 6 are themselves `Bash` writes dispatched
through the same hook while the guard was red, and both were allowed. Their
target is `CLAUDE.md`, not a `*MILESTONE-AUDIT*.md` file, so hook mode exits
0 before any `spawnSync` -- fail-open, as designed. A mechanism that refused
those would have made the test impossible to run.

