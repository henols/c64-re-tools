---
phase: 32-the-deletion-and-the-grep-gate
plan: 16
subsystem: testing
tags: [audit-instrument, argv-parsing, cli-hardening, gap-closure, comment-correctness]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-15's whole-set sweep, and the shared argv seam parseRootArg() in scripts/lib/audit-root.mjs"
provides:
  - "scripts/audit-gate.mjs reads argv through parseRootArg() with --json and --hook as declared booleanFlags; its hand-rolled parseArgs() is gone"
  - "Three malformed --root forms that produced a full real-tree report at exit 0 now fail at exit 1 with an `audit-gate: BAD ARGUMENTS --` first stderr line"
  - "A dated, measured decision block in audit-gate.mjs recording why it is on the argv seam but deliberately NOT on the containment seam, with a named reversal trigger"
  - "Six corrected comment blocks that record what the false non-migration claim said and how it propagated, rather than deleting it"
  - "evidence/32-gap2-audit-gate-seam.md — eight captured invocations, the containment decision, and the census in all three readings"
affects: [32-17, 32-18, 32-19, milestone-audit, audit-instrument-completeness]

actuals:
  tokens: 12207
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Comment-strip source before any source-census whose subject the file discusses in prose — otherwise the note explaining an exclusion is counted as a violation of it"
    - "Record an acceptance decision with a MECHANICAL reversal trigger owned by a named later plan, rather than as a silence or a to-do"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-audit-gate-seam.md
  modified:
    - scripts/audit-gate.mjs
    - scripts/check-guard-fates.mjs
    - scripts/check-skill-cli-invocations.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-description-overlap.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/generate-tool-support-table.mjs
    - .planning/WINDOWS.md

key-decisions:
  - "audit-gate.mjs is wired to parseRootArg() but deliberately NOT to resolveContainedRoot(), on the measured basis that it performs no filesystem write (0 across the enumerated write API set over comment-stripped source; fs import surface exactly { readdirSync, readFileSync }) and that its own test suite requires the out-of-repository path for the design reason recorded at audit-integrity.test.ts:162-171"
  - "The six false comment blocks were CORRECTED, not deleted — the record of how a wrong claim propagated is the protection against it propagating again (gaps[0].missing[2] offers deletion only as an alternative)"
  - "Every retraction is written in reported PAST tense, which is the only thing reconciling 'record what the old claim said' with 'the live claim must be gone'"
  - "audit-root-args.test.ts was left RED rather than relaxed: the completeness guard is biting exactly as plan 32-18's own criteria require, and that plan owns the audit-gate matrix row"

patterns-established:
  - "Self-invalidating measurement: any census whose pattern appears in the prose of the file being measured must strip comments first — found and fixed inside this plan's own instrument"
  - "Census scope honesty: a criterion's promise is scoped to exactly the literal its command measures; the half a grep cannot measure is carried by an explicit per-block read and said to be so"

requirements-completed: []

coverage:
  - id: D1
    description: "scripts/audit-gate.mjs reads its arguments through parseRootArg() with --json and --hook as declared booleanFlags, and its hand-rolled parseArgs() is gone"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/audit-gate.mjs --root=/tmp | --root | --rooot /tmp (all three: exit 1, first stderr line `audit-gate: BAD ARGUMENTS --`, no report line; each captured beside a differing pre-fix reading)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/audit-integrity.test.ts (44/44 pass, 0 fail — the three existing spawn shapes unchanged, no test file edited)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The unflagged, --json and --hook paths are unchanged in shape by the migration"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "diff of pre-fix vs post-fix `--json` stdout — byte-identical (exit 0); unflagged control byte-identical; `--hook` scope rule unchanged across four stdin payloads"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/audit-integrity.test.ts hook-mode suite (--hook --root <out-of-repo dir>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The containment asymmetry is recorded as a decision with a measured basis and a named reversal trigger, not left as an omission"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "comment-stripped counts on scripts/audit-gate.mjs: write API set = 0, resolveContainedRoot( = 0, parseRootArg( = 1; fs import surface exactly { readdirSync, readFileSync }, 0 from node:fs/promises"
        status: pass
    human_judgment: true
    rationale: "The measurements pass mechanically, but whether declining containment is the RIGHT call against the verifier's generically-phrased truth 12 is a judgment the plan itself anticipates being scored differently (flagged assumption 3). A human should confirm the decision, not just its arithmetic."
  - id: D4
    description: "No living source file still asserts that audit-gate.mjs was deliberately not migrated to the shared parser; all six blocks corrected with the measurement and dated"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "whitespace- and case-insensitive flag-count census over scripts/*.mjs and scripts/lib/*.mjs: 6 before, 0 after (non-vacuous; single-line form measured at 5 and rejected as inadequate)"
        status: pass
      - kind: other
        ref: "per-block read of every remaining `audit-gate` mention across scripts/ for tense — one live residue found at generate-tool-support-table.mjs:348 and corrected"
        status: pass
      - kind: other
        ref: "git diff -U0 per file: 0 non-comment changed lines across all six"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two committed plant descriptors targeting scripts/audit-gate.mjs still match exactly once, so plan 32-15's whole-set sweep is not broken"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "grep -aoF 'export const DOCS_GUARD_FLOOR = 7;' = 1 and the docs-absorbed-decisions.test.ts list entry = 1, both before and after"
        status: pass
    human_judgment: false
  - id: D6
    description: "The evidence record: eight captured invocations, the containment decision, the census in all three readings, and the gates re-run under a read broker state"
    verification:
      - kind: other
        ref: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-audit-gate-seam.md"
        status: pass
    human_judgment: true
    rationale: "Whether the record is COMPLETE and honest enough to satisfy D-15 — particularly its account of the two test:automated failures it did not close — is an editorial judgment no test asserts."

duration: 22 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 16: `audit-gate.mjs` on the Shared Argv Seam Summary

**The milestone-audit gate can no longer be pointed at a tree by a typo, a bare flag or an equals form without saying so — three invocations that each produced a full real-tree "OK" at exit 0 are now named failures at exit 1 — and the six source comments asserting this migration would never happen are corrected with the measurement that shows their stated reason was false before they were written.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-01T07:23:33Z
- **Completed:** 2026-09-01T07:45:46Z
- **Tasks:** 3
- **Files modified:** 8 (7 modified, 1 created)

## Accomplishments

- **Closed the Gap 2 defect on `audit-gate.mjs`.** `--root=/tmp`, a bare `--root` and `--rooot /tmp` each produced the *identical* full real-tree report as an unflagged run — the audit instrument vouching for a tree it was told not to read. All three now exit 1 with an `audit-gate: BAD ARGUMENTS --` first stderr line naming the offending token and quoting the accepted spelling. Captured before and after, eight invocations in total.
- **Recorded the containment asymmetry as a decision rather than a silence.** `audit-gate.mjs` is on the argv seam and deliberately *not* on the containment seam, on a re-measured basis (zero writes across the enumerated filesystem-write API set; fs import surface closed at `{ readdirSync, readFileSync }`) with a named, mechanically-guarded reversal trigger that plan 32-18 pins.
- **Corrected six propagated false comments in one change.** All six asserted a non-migration that Task 1 falsified; worse, their stated reason ("five further flags with their own exactly-one-selector rule") described `audit-mutation-harness.mjs`, not `audit-gate.mjs`. Census: 6 → 0.
- **Found and corrected a live residue the census structurally cannot see** — `generate-tool-support-table.mjs:348` read "the same nine lines `audit-gate.mjs` **still carries**".
- **Found and fixed a self-invalidating measurement inside this plan's own instrument** (see Deviations).

## Task Commits

1. **Task 1: `audit-gate.mjs` on the shared strict parser, without containment** — `234a900` (fix)
2. **Task 2: the six false comment blocks** — `b23dbc5` (docs)
3. **Task 3: the evidence record and the gates re-run** — `74baf00` (docs)

## Files Created/Modified

- `scripts/audit-gate.mjs` — `parseArgs()` deleted; argv read through `parseRootArg()` in a try/catch replicating `check-guard-fates.mjs`'s recorded call-site shape; 40-line dated header block recording the containment decision. +60/−16.
- `scripts/check-guard-fates.mjs` — corrected note. +21/−3.
- `scripts/check-skill-cli-invocations.mjs`, `scripts/check-skill-tool-coverage.mjs`, `scripts/check-skill-description-overlap.mjs`, `scripts/check-skill-fork-honesty.mjs` — corrected notes. +21/−5 each.
- `scripts/generate-tool-support-table.mjs` — corrected note plus the `:348` "still carries" residue. +28/−6.
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-audit-gate-seam.md` — **new**, 666 lines.
- `.planning/WINDOWS.md` — three ledger entries (ids 37–39).

## Key Measurements

| Measurement | Before | After |
|---|---|---|
| `--root=/tmp` / bare `--root` / `--rooot /tmp` | exit 0, full real-tree report ×3 | exit 1, `BAD ARGUMENTS --` ×3 |
| `--json` stdout | — | byte-identical (`diff` exit 0) |
| `audit-integrity.test.ts` | — | 44 tests / 44 pass / 0 fail |
| `git status --porcelain -- src/` | empty | empty (no test file edited) |
| fs-write calls (comment-stripped, whole API set) | 0 | 0 |
| fs import surface | `{ readdirSync, readFileSync }` @ `:90` | same names @ `:130` |
| `resolveContainedRoot(` / `parseRootArg(` call sites | 0 / 0 | 0 / 1 |
| `DOCS_GUARD_FLOOR` plant descriptor | 1 | 1 |
| `docs-absorbed-decisions.test.ts` plant descriptor | 1 | 1 |
| Flag-count census — single-line (**forbidden**) | 5 | 0 |
| Flag-count census — whitespace-insensitive, case-sensitive | 6 | 0 |
| Flag-count census — **required** form (also `-i`) | **6** | **0** |
| Non-comment changed lines across the six note files | — | 0 |
| `check-guard-fates` / `audit-gate` | — | exit 0 / exit 0 |
| `test:automated` | — | 2994 tests / 2986 pass / **2 fail** / 1 skipped |

Broker state during every suite run, read by `32-close-gate.md`'s `ps`-based method (its `pgrep` self-match trap cited, not re-taken): unit `inactive`, no broker process, no `x64sc` process.

**The whole-glob `npm test` was NOT run.** It does not terminate on this host — `vice-proxy.test.ts` blocks indefinitely, recorded in `evidence/32-close-gate.md` §2b as `timeout 180` → `exit=124`, and broken-windows ledger entry #26. This plan cites that record rather than re-taking the decision.

## Decisions Made

1. **Declined containment for `audit-gate.mjs`, following `gaps[0].missing[1]` literally.** That item names `parseRootArg()` and `booleanFlags` and does not ask for `resolveContainedRoot()`. Adding it would have forced either relocating `audit-integrity.test.ts`'s out-of-repository synthetic-tree idiom (overriding a recorded design decision, in a file this plan may not edit) or an `allowExtra` wide enough for any temp directory — the relaxation hatch `audit-root.mjs`'s own header forbids. Flagged assumption 3 anticipates a verifier reading truth 12 generically may still score this partial; the counter-argument is written into the evidence file so the decision can be re-taken with the measurement in hand.
2. **Corrected the six notes rather than deleting them,** and wrote every retraction in reported past tense. Tense is the only thing reconciling "record what the false claim said" (prohibition 3) with "the live claim must be gone" (the census).
3. **Left `audit-root-args.test.ts` red rather than relaxing it.** See Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A self-invalidating measurement in this task's own instrument**
- **Found during:** Task 1 (post-edit source measurements)
- **Issue:** The plan mandates comment-stripping for the *write-call* count because Task 1's header note names write APIs in prose. The same hazard applies to two neighbouring criteria the plan did **not** flag: the `process.stderr.write(` count and the fs-import-surface check. My first run used unstripped greps and scored **6** stderr writes (on a file with 5) and **1** `node:fs/promises` binding (on a file with 0) — both caused by the header note naming those exact tokens while explaining why they are excluded.
- **Fix:** Comment-stripped both measurements to match the write count, then re-ran. Correct readings: 5 stderr writes, 0 `node:fs/promises` bindings, import surface exactly `{ readdirSync, readFileSync }`.
- **Verification:** Re-measured; recorded in the evidence file §4c with the wrong readings shown rather than quietly replaced.
- **Committed in:** measurement-only (no source change); documented in `74baf00`.

**2. [Rule 1 - Bug] A live present-tense false claim the census structurally cannot detect**
- **Found during:** Task 2 (the per-block tense read)
- **Issue:** `scripts/generate-tool-support-table.mjs:348` read "the same nine lines `scripts/audit-gate.mjs` **still carries**". Task 1 falsified it. It is a live sentence telling a reader `audit-gate.mjs` is off the shared parser — exactly Task 2's `<done>` criterion — but it contains none of the censused literal, and I had initially classified the whole paragraph as "still true, preserve byte-identical".
- **Fix:** Corrected to reported past tense in the same commit, with a parenthetical recording what it used to read.
- **Verification:** `node --check` passes; the hunk is comment-only; the paragraph's still-true write-defect sentences remain byte-identical.
- **Committed in:** `b23dbc5`
- **Note:** This is the concrete demonstration that the census is not the whole instrument. Without the per-block read it would have survived untouched.

**3. [Rule 3 - Blocking] The plan's `<verify>` commands `cd` to the main repository**
- **Found during:** Task 1
- **Issue:** Every `<automated>` verify block begins `cd /home/henrik/dev/henrik/git/c64-re-tools`. This executor runs in a worktree at `.claude/worktrees/agent-ab44a8d427a4bf8f0`. Running them verbatim would have measured the **unmodified main repo** and reported a false green for every criterion.
- **Fix:** Ran every verification against the worktree root resolved via `git rev-parse --show-toplevel`. No command was skipped; only its working directory was corrected.
- **Verification:** All captures in the evidence file carry worktree-prefixed absolute paths, making the substitution auditable.

**4. [Rule 3 - Blocking] `node_modules` absent in a fresh worktree**
- **Found during:** Task 3
- **Issue:** `npm run test:automated` cannot run without `src/mcp/vice/node_modules`, which is gitignored and not present in a fresh worktree.
- **Fix:** `npm ci` in `src/mcp/vice`. It is gitignored and left `git status --porcelain` empty.

### Criteria NOT satisfied, and deliberately not forced

**5. [Not fixed — prohibited to fix] `audit-root-args.test.ts` exits 1, not 0**

Task 2 and Task 3 both require this suite to exit 0. It exits 1, with one failure: `the matrix covers EVERY script wired to the shared argv seam` (`:428`).

This is the completeness guard **working exactly as designed**. Its population predicate is `src.includes("parseRootArg(")`, so Task 1 *necessarily* moves `audit-gate` into the population while `MATRIX` carries no row for it. The acceptance criterion is unsatisfiable by this plan in isolation — Task 1 and the criterion contradict each other.

I made **zero** fix attempts, because every available fix is explicitly prohibited:
- Adding an exclusion list or narrowing the predicate is barred by prohibition 1 ("MUST NOT make any check green by narrowing what it measures") and by `gaps[1].missing[1]` in those words.
- Deleting the assertion is barred by the same prohibition.
- Editing `src/mcp/vice/audit-root-args.test.ts` is barred outright — plan 32-17 owns that file in this same wave.

**Plan 32-18 owns the resolution and requires this exact red.** Its own acceptance criteria state the test must exit **NON-ZERO** with `audit-gate` named in the diff: *"A green run here fails this criterion — the whole point is that the flipped predicate bites."* It then adds the row (`audit-gate`, expectation `uncontained-read-only`). The assertion's own message — "add the missing row to MATRIX rather than relaxing this assertion" — is honoured by leaving it red for its owner. Full output captured in the evidence file §7c and logged to the ledger (id 38).

**6. [Not fixed — environmental] `test:automated` second failure is a worktree artifact**

`repo-root.test.ts:178` fails with *"the agreed directory must not sit under `.claude` — got .../.claude/worktrees/agent-ab44a8d427a4bf8f0/.vice-supervisor"*. The assertion forbids the supervisor directory sitting under `.claude`; this executor's worktree *is itself* under `.claude/worktrees/`. Caused by where the run happened, not by what changed — this plan touched only `scripts/*.mjs`, and the test concerns launcher/repo-root path resolution. It will not reproduce on the merged branch. Out of scope per the scope boundary.

**7. [Not fixed — owned by another plan this wave] A stale line citation this plan created**

Task 1's 40-line header block shifted every line number below it in `audit-gate.mjs`. Two live citations elsewhere are now stale:
- `scripts/lib/audit-root.mjs:13` cites `audit-gate.mjs:1147-1151` as the WR-03 try/catch; it is now at ~`:1191`. **Plan 32-17 owns that file this wave**, so I did not edit it. Ledger id 37.
- `32-18-PLAN.md` cites `audit-gate.mjs:90` for the fs import surface; it is now `:130`. The *names* bound are unchanged, which is what the assertion pins. Ledger id 39.

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking) + 3 recorded-not-fixed (1 prohibited to fix, 1 environmental, 1 owned by a sibling plan).
**Impact on plan:** No scope creep. Both auto-fixed bugs were corrections to *measurements this plan itself introduced or relied on* — the kind of error the phase exists to remove. Nothing was made green by narrowing what it measures; the one red that could have been silenced was left red for its designated owner and logged.

## Issues Encountered

- The plan's Task 2/Task 3 acceptance criteria requiring `audit-root-args.test.ts` to exit 0 are **internally inconsistent with the plan's own Task 1** and with plan 32-18's stated criteria. Resolved by following the prohibition over the criterion and documenting it, rather than by relaxing the guard. This is worth surfacing to the verifier: the criterion, not the implementation, is what needs correcting.
- Four `--hook` payloads I captured turned out to exercise the fail-OPEN *scope* rule rather than the fail-CLOSED refusal path. Rather than present them as more than they are, the evidence file says so explicitly and points at `audit-integrity.test.ts`'s hook suite as the actual proof of the fail-closed half.

## Known Stubs

None. No hardcoded empty values, placeholder text or unwired components were introduced. The one unfinished item — the `audit-gate` MATRIX row — is not a stub in this plan's files; it is plan 32-18's declared deliverable.

## Threat Flags

None. This plan added no network endpoint, no auth path, no new file-access pattern and no schema change. `T-32-19` (spoofing via dropped argv tokens) is **mitigated** as planned; `T-32-22` (accepting an out-of-repository root) remains **accepted** on the measured basis recorded above, with its mechanical revocation owned by plan 32-18.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for plan 32-18**, which should consume from here:
- `audit-gate.mjs` is on the argv seam, uncontained by decision, with its header note and reversal trigger in place — the state 32-18's typed matrix expectation and write-freedom assertion are meant to pin.
- The write-freedom fact is **already measured** in both forms (evidence §4c), so 32-18 re-measures a recorded state rather than discovering one.
- **Two citation corrections 32-18 must make:** the fs import is at `:130`, not `:90` (names unchanged); and its observed-red evidence for the completeness guard can be taken from evidence §7c, already captured verbatim with `audit-gate` named in the diff.

**Blocker for the wave merge:** none from this plan. `git status --porcelain` is empty and all three commits are on the branch.

**For plan 32-17:** `scripts/lib/audit-root.mjs:13`'s citation of `audit-gate.mjs:1147-1151` is now stale (→ ~`:1191`). It is a different region from the `:119-122` model citation 32-17 is chartered to fix, but it is in the same file and the same class of defect.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*

## Self-Check: PASSED

Files claimed created, verified on disk:
- `FOUND: .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-audit-gate-seam.md`

Commits claimed, verified in `git log`:
- `FOUND: 234a900` — fix(32-16): audit-gate.mjs reads argv through the shared strict parser
- `FOUND: b23dbc5` — docs(32-16): correct six comment blocks asserting a non-migration that no longer exists
- `FOUND: 74baf00` — docs(32-16): evidence for the audit-gate argv seam and the containment decision

Plan-level `<verification>` items 1–10 re-run: 1 ✓, 2 ✓, 3 ✓, 4 ✓, 5 ✓, 6 ✓, 7 ✓, 8 ✓, 9 — `check-guard-fates` ✓ and `audit-gate` ✓, `audit-root-args.test.ts` **RED by design** (deviation 5), 10 — `test:automated` **2 failures** (deviations 5 and 6). Both non-passing items are documented above with their owners; neither was made green by narrowing what it measures.
