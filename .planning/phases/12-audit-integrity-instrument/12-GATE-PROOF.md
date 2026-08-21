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
