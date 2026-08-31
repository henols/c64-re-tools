---
phase: 32-the-deletion-and-the-grep-gate
plan: 04
subsystem: testing
tags: [ci-guard, line-citations, planted-violation, non-vacuity, planning-documents]

requires:
  - phase: 32-03
    provides: ".planning/PROJECT.md:311's four re-verified vice-proxy.ts citations (3050/2985/1529/1505) — the repair this widening lands on top of"
  - phase: 32-01
    provides: "the `grep -a` NUL-byte trap finding and the recorded repo-root.test.ts worktree artifact (deferred-items.md §1)"
  - phase: 29-the-mcp-surface
    provides: "plan 29-10's −2 line shift in vice-proxy.ts, the drift that made the second copy's staleness visible"
provides:
  - "`docs-linerefs.test.ts` scans a DECLARED document set (`SCANNED_DOCS`) instead of one hard-coded path — `.planning/PROJECT.md`'s citations are now mechanically checked alongside CLAUDE.md's"
  - "`isolateCitationBullet(doc, text)` — a citation-aware, exactly-one-per-document bullet predicate replacing the first-match one"
  - "`readScannedDoc(doc)` — a declared-but-absent document FAILS in docs-dangling-refs.test.ts:136's message shape rather than shrinking the scanned set"
  - "A per-document non-vacuity floor with the document named in the message, and a plant proving a GLOBAL sum would have stayed green"
  - "Five planted violations (zero-citation, per-document-vs-sum, one-citation floor, ambiguous bullet, missing document) each driving the real predicates from an in-memory body, plus a self-non-vacuity assertion"
  - "A recorded fragility: the predicate is LINE-based, so hard-wrapping CLAUDE.md:26 or PROJECT.md:311 reds the guard on a correct document; the fix is to unwrap, never to widen the predicate"
affects: [32-05, 32-08, 32-09]

actuals:
  tokens: 5620
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Return-don't-assert predicates in a guard test: the checks return `{ problems: string[] }` so planted violations drive the REAL rule from an in-memory string, with no fixture files and no filesystem writes"
    - "Per-document floors, never summed: a guard over N documents asserts its non-vacuity floor inside the per-document path and names the document, and carries a plant proving the summed alternative stays green"
    - "Subtest-per-scanned-document, so `node --test`'s own output NAMES every document the guard read instead of passing silently"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/32-04-SUMMARY.md
  modified:
    - src/mcp/vice/docs-linerefs.test.ts

key-decisions:
  - "Executed Task 1's `tdd=\"true\"` as a genuine RED/GREEN pair rather than a single commit: the RED commit widens the set while deliberately keeping the first-match predicate, and fails with `.planning/PROJECT.md: ... found 0`. That reproduces 32-PATTERNS.md's central measured claim (`.find()` returns `:230`, which carries zero citations) as evidence rather than as an assertion inherited from the plan."
  - "Kept the predicate LINE-based, per the plan's explicit wording, rather than widening it to a paragraph window when a wrapped synthetic body exposed the sensitivity. A multi-line window would sweep in `.planning/PROJECT.md:1319`'s dated drift record — the exact false positive `CITATION_RE`'s do-not-loosen comment exists to prevent. The sensitivity is documented in the predicate instead, with 'unwrap the bullet' named as the correct response."
  - "Added a fifth plant the plan did not list — a one-citation document — because the floor branch (`citations.length >= 2`) is reached by no other plant: the zero-citation case exits earlier through the no-qualifying-line branch. Without it a stub returning `problems: []` from the floor branch would have passed every listed plant."
  - "Reworded three history comments from `.find()` / `lines.find(...)` to `Array#find` / `first-match` so the acceptance grep `grep -c '\\.find('` measures code rather than prose. A grep a comment can trip is a grep that produces false positives forever."
  - "Spelled the floor as the literal `citations.length >= 2` rather than behind a `MIN_CITATIONS` constant, because the phase-32 acceptance criteria grep for that exact expression."

patterns-established:
  - "Pattern: prove the plan's measured claim in the RED commit — when a plan states a measurement that motivates the change, make the RED failure BE that measurement, so the commit history carries the evidence instead of a citation to a research doc"
  - "Pattern: name the branch no plant reaches — before declaring plants complete, enumerate the predicate's branches and add a plant for any branch no listed plant enters; an unproven branch is the vacuity the plants exist to prevent"

requirements-completed: [CUT-06]

coverage:
  - id: D1
    description: ".planning/PROJECT.md's vice-proxy.ts line citations are mechanically checked alongside CLAUDE.md's, through a declared two-document set whose per-document non-vacuity floor names the offending document"
    requirement: "CUT-06"
    verification:
      - kind: integration
        ref: "src/mcp/vice/docs-linerefs.test.ts (12/12 pass; output names both `CLAUDE.md` and `.planning/PROJECT.md` as subtests)"
        status: pass
      - kind: other
        ref: "RED commit 63cd82a: naive widening failed with '.planning/PROJECT.md: expected at least two vice-proxy.ts:<N> citations ... found 0' (tests 3, pass 1, fail 2)"
        status: pass
      - kind: other
        ref: "grep -c 'PROJECT.md' == 6; grep -c 'readFileSync(join(repoRoot({ from: HERE }), \"CLAUDE.md\")' == 0; grep -c '\\.find(' == 0; grep -c 'citations.length >= 2' == 2"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm run typecheck exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The exactly-one-bullet predicate reddens against the REAL tree, not just against synthetic input: a second citation-carrying rewriteArguments() line appended to .planning/PROJECT.md fails the guard with the count named, and the plant is reverted byte-identically"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "temporary append to .planning/PROJECT.md -> 'PLANT_EXIT=1', '.planning/PROJECT.md has 2 lines that both mention rewriteArguments() and cite vice-proxy.ts:<N>; expected exactly 1'"
        status: pass
      - kind: other
        ref: "git diff --exit-code -- .planning/PROJECT.md exits 0 after revert; git status --short lists only src/mcp/vice/docs-linerefs.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every failure mode the widening introduced carries a planted proof driving the real predicate — zero citations, a one-citation floor breach, an ambiguous second bullet, a missing document — plus a self-non-vacuity assertion and an explicit demonstration that a global summed floor would have stayed green"
    requirement: "CUT-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts#planted-violation: a document whose only rewriteArguments() line carries no citation is reported, and the message NAMES the document"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts#planted-violation: the floor is PER DOCUMENT -- a global summed count stays green while one document is reworded to zero"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts#planted-violation: a document whose bullet cites only ONE line number fails the per-document floor"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts#planted-violation: a document with TWO citation-carrying rewriteArguments() bullets is reported, and the message states the count"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts#planted-violation: a declared document that does not exist FAILS rather than shrinking the scanned set"
        status: pass
      - kind: other
        ref: "git status --porcelain -- src/mcp/vice/fixtures/ is empty — no new file under the removal gate's pinned `planted-` prefix"
        status: pass
    human_judgment: false
  - id: D4
    description: "Widening an existing guard changed no guard membership: audit-gate still reports allowed=true with 9 derived docs guards and DOCS_GUARD_FLOOR unchanged at 7, and the removal gate still exits 0"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "node scripts/audit-gate.mjs --json -> allowed=true, redGuards=[], guardFiles.length=9"
        status: pass
      - kind: other
        ref: "grep -c 'export const DOCS_GUARD_FLOOR = 7;' scripts/audit-gate.mjs == 1 (untouched)"
        status: pass
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs exits 0; grep -ac 'regenerator2000' src/mcp/vice/docs-linerefs.test.ts == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The line-based scope of the bullet predicate — and the fact that hard-wrapping either scanned bullet would red the guard on a factually correct document — is recorded in the predicate itself, with 'unwrap the bullet' named as the correct response"
    requirement: "CUT-06"
    verification: []
    human_judgment: true
    rationale: "Whether the in-code note is clear enough to stop a future maintainer from 'fixing' a wrap-induced red by loosening the predicate is a judgment about prose effectiveness, not a property any assertion can check. The mechanism it protects (CITATION_RE not matching bare `:<N>` shorthand) IS asserted, but the note's persuasiveness is not."

duration: 43min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 04: CUT-06 part B — the second copy comes under the guard Summary

**`docs-linerefs.test.ts` now scans a declared two-document set instead of one hard-coded path, with a citation-aware exactly-one-per-document bullet predicate, a per-document non-vacuity floor, and five planted violations that drive the real rule from in-memory bodies — so `.planning/PROJECT.md`'s `vice-proxy.ts` citations can no longer go stale unnoticed the way they did through v0.7.0.**

## Performance

- **Duration:** ~43 min
- **Started:** 2026-08-31T16:07:00Z (approx; the RED commit `63cd82a` landed 16:41:03Z)
- **Completed:** 2026-08-31T16:50:26Z
- **Tasks:** 2
- **Files modified:** 1 (`src/mcp/vice/docs-linerefs.test.ts`), plus this SUMMARY created

## Accomplishments

- **The scanned "set" is now actually a set.** `SCANNED_DOCS = ["CLAUDE.md", ".planning/PROJECT.md"]`, frozen, repo-root-relative, in `docs-dangling-refs.test.ts`'s `ALWAYS_PRESENT_NORMATIVE_DOCS` shape. The two hard-coded `readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), ...)` reads at `:57` and `:67` are gone (`grep -c` → 0). `PROJECT.md:311` recorded its own defect — the numbers stayed stale "until the v0.7.0 open, when `docs-linerefs.test.ts` was found to read only CLAUDE.md and not this copy" — and that sentence is now discharged.

- **The first-match predicate is replaced, and the RED commit proves why it had to be.** `isolateCitationBullet(doc, text)` filters to lines containing BOTH `rewriteArguments()` AND at least one `CITATION_RE` match, then requires EXACTLY ONE such line. Exactly-one rather than at-least-one is the load-bearing choice: a second citation-carrying bullet appearing later would otherwise be checked by nobody while the guard reported success.

- **The plan's central measured claim was reproduced rather than trusted.** The RED commit (`63cd82a`) widens the set while deliberately keeping the old `Array#find`, and fails exactly as 32-PATTERNS.md predicted:
  ```
  not ok 1 - every scanned document's rewriteArguments() bullet cites at least two
             vice-proxy.ts line numbers (non-vacuity)
    error: '.planning/PROJECT.md: expected at least two vice-proxy.ts:<N> citations
            in the rewriteArguments() bullet, found 0'
  # tests 3  # pass 1  # fail 2
  ```
  `.planning/PROJECT.md` has six lines mentioning `rewriteArguments()` (`:230`, `:311`, `:375`, `:381`, `:1111`, `:1319`); first-match returns `:230`, which carries zero citations. Verified independently with `grep -a`, not inherited: `grep -a 'vice-proxy\.ts:[0-9]' .planning/PROJECT.md` matches **line 311 only**.

- **Preserved drift history is excluded by construction, and the reasoning is on the regex.** `.planning/PROJECT.md:1319` records past drift to `:3029`/`:2964`/`:1508`/`:1484` — bare shorthands, which `CITATION_RE` (`/vice-proxy\.ts:(\d+)/g`) does not match. Confirmed by reading the line, not assumed. A `DO NOT loosen this` block on the regex now records both reasons: loosening would red the guard on a line that is right, and a bare `:<digits>` is not a citation signal at all.

- **The non-vacuity floor is per document, and a plant proves the summed alternative would have stayed green.** The floor lives inside the per-document path with the document named in the message. The dedicated plant asserts that `good.citations.length + bad.citations.length >= 2` (2 + 0) — i.e. a global sum WOULD have passed — while the per-document check still reports the reworded document.

- **Five plants, each driving the real predicates, no fixture files.** Zero-citation (message names the document), per-document-vs-sum, one-citation floor breach, ambiguous second bullet (count reported, `bullet` is `null` rather than a silent pick), and missing document (`text` is `null`, not `""` — empty text would have sailed through the isolation predicate as "no citations"). Closes with `removal-gate.test.ts:58-75`'s self-non-vacuity idiom: `assert.notDeepEqual(stubbedAlwaysClean(), isolation.problems)`.

- **Proven against the real tree, not only against synthetic input.** Appending a second citation-carrying `rewriteArguments()` line to `.planning/PROJECT.md` reddened the guard with `has 2 lines that both mention rewriteArguments() and cite vice-proxy.ts:<N>; expected exactly 1`. The plant was reverted and `git diff --exit-code -- .planning/PROJECT.md` exits 0 — **`.planning/PROJECT.md` is byte-identical to the base commit.**

- **`node --test`'s output now names what it read.** A subtest per document, so a pass reports `CLAUDE.md: bullet isolated, at least two citations` and `.planning/PROJECT.md: bullet isolated, at least two citations` rather than a single anonymous green tick.

## Task Commits

1. **Task 1 (RED): widen the scanned set, keep the first-match predicate** — `63cd82a` (test) — red on purpose, 3 tests / 1 pass / 2 fail
2. **Task 1 (GREEN): citation-aware exactly-one isolation + per-document floor** — `8ee5cda` (feat) — 7/7 pass
3. **Task 2: plant every failure mode the widening introduced** — `9c0a180` (test) — 12/12 pass

**Plan metadata:** this SUMMARY (docs)

_Note: Task 1 carried `tdd="true"`, hence two commits (test → feat). No REFACTOR commit was needed._

## Files Created/Modified

- `src/mcp/vice/docs-linerefs.test.ts` — 431 lines (was 100). Adds `SCANNED_DOCS`, `isolateCitationBullet()`, `readScannedDoc()`, the `BulletIsolation`/`ScannedDocRead` result shapes, five planted-violation tests and four synthetic document bodies. The original three tests survive in widened form, including the untouched line-1 planted-violation test.

## Verification Results

Every `<automated>` command in the plan hardcodes the **orchestrator's** checkout path (`/home/henrik/dev/henrik/git/c64-re-tools`), which does not contain this plan's commits. All commands were re-anchored to the worktree root `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-afd836edb34bc6f5d` and run from there. Commands as actually run:

| Command (run from the worktree root) | Result |
|---|---|
| `cd src/mcp/vice; node --test docs-linerefs.test.ts` | exit 0 — `# tests 12  # pass 12  # fail 0` |
| `cd src/mcp/vice; npm run typecheck` | exit 0 |
| `node scripts/audit-gate.mjs --json` | exit 0 — `allowed true redGuards [] derivedDocsGuards 9` |
| `grep -c 'export const DOCS_GUARD_FLOOR = 7;' scripts/audit-gate.mjs` | `1` — floor unmoved |
| `node scripts/check-no-regenerator2000.mjs` | exit 0 |
| `grep -ac 'regenerator2000' src/mcp/vice/docs-linerefs.test.ts` | `0` |
| `git status --porcelain -- src/mcp/vice/fixtures/` | empty |
| `git diff --exit-code -- .planning/PROJECT.md` | exit 0 |
| `cd src/mcp/vice; npm run test:automated` | exit 1 — `# tests 2950  # pass 2943  # fail 1  # skipped 1` (see Deviations) |

`npm ci` was run once in `src/mcp/vice/` from the committed lockfile before `tsc` would resolve (`node_modules/` is gitignored and absent in a fresh worktree). Nothing new was installed.

## Decisions Made

See `key-decisions` in the frontmatter. The two consequential ones:

1. **Task 1's `tdd="true"` was executed as a real RED/GREEN pair.** The alternative — one commit asserting in its message that first-match would have picked `:230` — would have left the plan's motivating measurement as a claim. Making the RED failure *be* that measurement puts the evidence in the commit history where a later reader can re-run it. Cost: one commit in this branch's history is red in isolation. The branch tip is green, and no green result was recorded over a red state.

2. **The predicate stayed line-based when a wrapped fixture exposed the sensitivity.** See Issues Encountered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Synthetic plant bodies wrapped their bullets across lines, so the second citation never qualified**

- **Found during:** Task 2 (first run of the appended plants)
- **Issue:** `TWO_CITATION_BODY` and `AMBIGUOUS_BODY` were written with hard-wrapped bullets. Because the predicate is line-based, the wrapped continuation line carried `vice-proxy.ts:1529` but not `rewriteArguments()`, so it did not qualify. Two plants failed: the two-citation *control* reported `found 1` (`not ok 5`), and the ambiguous body yielded `qualifyingCount: 1` instead of `2` (`not ok 7`). Left unfixed, the control would have been silently wrong and the ambiguity plant would have proven nothing.
- **Fix:** Collapsed all synthetic qualifying bullets onto single lines, matching the real documents' shape. The fixtures were wrong, not the rule — line-based isolation is what the plan's `<action>` specifies ("selects the line that BOTH contains ... AND matches the citation regex").
- **Files modified:** `src/mcp/vice/docs-linerefs.test.ts`
- **Verification:** 12/12 pass, typecheck exit 0
- **Committed in:** `9c0a180`

**2. [Rule 2 - Missing Critical] The floor branch was reached by no plant**

- **Found during:** Task 2 (enumerating the predicate's branches before declaring the plants complete)
- **Issue:** The plan lists three plants. None of them enters the `citations.length >= 2` floor branch: a zero-citation document exits earlier via the no-qualifying-line branch, and the ambiguous and missing cases never reach the floor at all. A stub returning `problems: []` from the floor branch would have passed all three listed plants — precisely the vacuity the plants exist to prevent.
- **Fix:** Added a fifth test driving a one-citation synthetic body, asserting the message states the number wanted, the number found, and that the floor is per document.
- **Files modified:** `src/mcp/vice/docs-linerefs.test.ts`
- **Verification:** the new test passes and fails if the floor is removed (the branch is the only producer of its `found 1` message)
- **Committed in:** `9c0a180`

**3. [Rule 3 - Blocking] `tsc` unresolvable in a fresh worktree**

- **Found during:** Task 1 (before the first typecheck)
- **Issue:** `src/mcp/vice/node_modules/` is gitignored, so a fresh worktree has none and `npm run typecheck` cannot run.
- **Fix:** `npm ci` in `src/mcp/vice/` from the committed lockfile. No new dependency, no lockfile change (`git status` shows only the test file modified). Anticipated by the executor prompt's prior-wave finding 6.
- **Files modified:** none tracked
- **Verification:** `npm run typecheck` exit 0
- **Committed in:** n/a (no tracked change)

**4. [Rule 1 - Bug] Two acceptance criteria were red against my first GREEN draft**

- **Found during:** Task 1 (running the acceptance criteria)
- **Issue:** `grep -c '\.find('` returned 3 — my history comments quoted the removed `lines.find(...)` literally — and `grep -c 'citations.length >= 2'` returned 0, because I had used a named `MIN_CITATIONS` constant.
- **Fix:** Reworded the three comments to `Array#find` / `first-match`, keeping the history legible while letting the grep measure code rather than prose; and inlined the floor as the literal `citations.length >= 2` with a comment saying why it is spelled out.
- **Files modified:** `src/mcp/vice/docs-linerefs.test.ts`
- **Verification:** `grep -c '\.find('` → 0; `grep -c 'citations.length >= 2'` → 2; tests 7/7, typecheck exit 0
- **Committed in:** `8ee5cda`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical, 1 blocking)
**Impact on plan:** No scope creep. One file touched, exactly the one the plan declares. The added fifth plant is additional proof of the plan's own stated property, not new functionality. `.planning/PROJECT.md` is byte-identical to the base commit.

## Issues Encountered

**1. The bullet predicate is LINE-based, and hard-wrapping either scanned bullet would red the guard on a correct document.**

Surfaced by deviation 1 above. Both scanned documents keep their whole Architecture bullet on one unwrapped line today (`CLAUDE.md:26`, `.planning/PROJECT.md:311`), which is what makes a line-based predicate correct for them. A future editor who hard-wraps `PROJECT.md:311` — a purely cosmetic edit — makes this guard fail with `found 1` or `found 0` on a document whose citations are all correct. This is a live false-positive risk on a file edited every milestone, which is the pressure the plan's own `<reversibility rating="costly">` names.

**Recorded, not silently accepted:** a `SCOPE, and a real fragility` block on `isolateCitationBullet()` states the failure mode and names the correct response — **unwrap the bullet, never widen the predicate into a multi-line window.** A paragraph-scoped window would sweep in neighbouring prose including `.planning/PROJECT.md:1319`'s dated drift record, converting a cosmetic false positive into a permanent one on preserved history. Not escalated to a Rule 4 decision because the plan specifies line-based isolation explicitly and no citation is currently wrapped; changing the scope would be a new design decision, not a fix.

**2. `npm run test:automated` exits 1 on 1 failure, which is the known GSD-worktree artifact.**

`# tests 2950  # pass 2943  # fail 1  # skipped 1`. The single failure is `src/mcp/vice/repo-root.test.ts:178`:

```
error: 'the agreed directory must not sit under .claude -- got
        /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-afd836edb34bc6f5d/.vice-supervisor
        (the exact regression a naive move would introduce)'
```

It is red **only** because a GSD worktree root *is* `<repo>/.claude/worktrees/agent-*`. Already measured and recorded by plan 32-01 in `.planning/phases/32-the-deletion-and-the-grep-gate/deferred-items.md` §1, and 0-fail in the main checkout. Deliberately **not** fixed and the assertion **not** loosened — it is out of this plan's scope and the assertion is correct about real installs. Total count reconciles with the prior wave's 2941: this plan replaced 3 tests with 12 (+9), and 2941 + 9 = 2950.

The plan's Task-2 criterion "`npm run test:automated` exits 0 with 0 failures" is therefore **unsatisfiable inside a worktree** for environmental reasons. Every other failure count is zero, and no failure is attributable to this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 32-05 (wave 3 sibling, document sweep):** this plan touched only `src/mcp/vice/docs-linerefs.test.ts`; the sibling's evidence file was never opened. No merge conflict expected.
- **Ready for the wave-4 sweep:** `docs-linerefs` is now measurable over two documents. A sweep that counts scanned documents should expect **2**, and per-document non-vacuity floors of **2 citations each** — never a summed count of 4.
- **Note for 32-08/32-09 (fate registry, CI):** guard membership did **not** change. `docs-linerefs.test.ts` was already in `EXPECTED_DOCS_GUARD_NAMES` and in `audit-gate.mjs`'s derived set; `DOCS_GUARD_FLOOR` is still 7 with 9 guards on disk. Nothing to register.
- **Carried limitation for whoever next edits `.planning/PROJECT.md`:** do not hard-wrap line 311. See Issues Encountered §1 and the in-code note.

## Self-Check: PASSED

- `src/mcp/vice/docs-linerefs.test.ts` — FOUND (431 lines, 22478 bytes)
- `.planning/phases/32-the-deletion-and-the-grep-gate/32-04-SUMMARY.md` — FOUND (this file)
- Commit `63cd82a` — FOUND (`test(32-04): widen docs-linerefs scanned set to .planning/PROJECT.md (RED)`)
- Commit `8ee5cda` — FOUND (`feat(32-04): citation-aware, exactly-one bullet isolation + per-document floor (GREEN)`)
- Commit `9c0a180` — FOUND (`test(32-04): plant every failure mode the widening introduced`)
- `git diff --diff-filter=D --name-only 19b2c5c..HEAD` — empty (no file deletions)
- `git status --short` — only the tracked test file, no untracked leftovers
- `.planning/STATE.md`, `.planning/ROADMAP.md` — NOT modified (orchestrator-owned)
- `.planning/PROJECT.md` — NOT modified (`git diff --exit-code` exits 0)

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*
