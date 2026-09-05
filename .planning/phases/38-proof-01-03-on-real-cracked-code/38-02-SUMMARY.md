---
phase: 38-proof-01-03-on-real-cracked-code
plan: "02"
subsystem: testing
tags: [ghidra, bank-decode, evidence-schema, memmap-join, scratch-tree-mutation]

requires:
  - phase: 38-proof-01-03-on-real-cracked-code
    provides: "evidence/SCHEMA.md's frozen PROOF03_* outcome-line vocabulary and evidence/README.md's conventions (38-01)"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "anno-bank.ts's decodeBankState()/resolveBankedRegion()/isBankConditionalAddress(), anno-join.ts's runMemmapJoin(), the bank-path-dependent.a/.prg fixture and its real Ghidra export, and the 37-06 prior-art transcripts this plan cites"
provides:
  - "evidence/proof03-bank-boundary.mjs: the repeatable driver -- direction1 (two-bank-states), direction2 (forward-carry, in-process scratch-tree mutation), branches (four constWrites shapes)"
  - "evidence/proof03-bank-boundary.md: the fresh, self-contained PROOF-03 record, both directions established whichever way each came out"
affects: [38-03, 38-04]

actuals:
  tokens: 12514
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Scratch-tree module mutation via mkdtempSync + dynamic in-process import(), never a child process -- reused from 37-06/anno-bank.test.ts, built under PROBE_DIR never /tmp"
    - "Cleanliness observed via sha256 byte-identity (before/after) rather than a shelled-out git status --porcelain, when the driver itself must not import a child-process module"

key-files:
  created:
    - .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs
    - .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.md

key-decisions:
  - "Standardized both directions and the branch sweep on the fixture's $D020 shared write (not the $D000 read) for a single, consistent shared program point across direction1/direction2/branches."
  - "Fixed String.replace()'s special $$ -> $ collapsing rule (found while building direction2): switched to a function replacer so the mutated source's own literal $${...} template survives verbatim."
  - "git status --porcelain is run by the executor directly when building the .md, never inside the .mjs driver -- the driver's own cleanliness check is a sha256 byte-identity comparison, since importing node's child-process module is prohibited by this plan's own acceptance criteria (T-38-01)."

requirements-completed: [PROOF-03]

coverage:
  - id: D1
    description: "Direction 1: the same $D020 address annotates differently under $34 (RAM) vs $33 (Character ROM), confirmed by direct string inequality"
    requirement: "PROOF-03"
    verification:
      - kind: other
        ref: "node evidence/proof03-bank-boundary.mjs direction1, run twice, byte-identical stdout (cmp); PROOF03_TWO_BANK_STATES: differ"
        status: pass
    human_judgment: false
  - id: D2
    description: "Direction 2: the committed decline branch declines with a reason naming both values; a scratch-mutated forward-carry annotates confidently and wrongly at the same address"
    requirement: "PROOF-03"
    verification:
      - kind: other
        ref: "node evidence/proof03-bank-boundary.mjs direction2 -- DIRECTION2_COMMITTED_OUTCOME: declined, DIRECTION2_MUTATED_OUTCOME: annotated, ANNO_JOIN_AND_ANNO_BANK_UNCHANGED: yes"
        status: pass
    human_judgment: false
  - id: D3
    description: "All four constWrites shapes (absent, empty, agreeing-values, disagreeing-values) exercised and recorded against JoinDecision.outcome's own vocabulary, plus the decisions[]/decline-reason ordering rule"
    requirement: "PROOF-03"
    verification:
      - kind: other
        ref: "node evidence/proof03-bank-boundary.mjs branches -- four PROOF03_*_BRANCH lines + PROOF03_ORDERING"
        status: pass
    human_judgment: false
  - id: D4
    description: "The record stands alone (D-04): PROOF-03's claim is verifiable from proof03-bank-boundary.md without opening a Phase 37 file, citing 37-06's two transcripts explicitly as prior art"
    verification:
      - kind: other
        ref: "grep checks for both 37-06 filenames cited (>=2), >=3 driver transcript blocks, git status --porcelain clean"
        status: pass
    human_judgment: true
    rationale: "The grep checks prove citation and structure are present; whether the surrounding prose actually reads as self-contained to a reader who has never opened a Phase 37 file -- and whether the 'does not establish' section is honest about the fixture's synthetic nature -- is the judgment this plan's own human-check verify step reserves for a human reader."

duration: 50min
completed: 2026-09-05
status: complete
---

# Phase 38 Plan 02: PROOF-03 -- The `$01` Bank Boundary, Measured in Both Directions Summary

**Built a repeatable driver and a fresh, self-contained transcript establishing PROOF-03's `$01` bank-boundary claim in both directions against the real committed `bank-path-dependent` fixture: the same `$D020` write annotates differently under `$34` (RAM) vs `$33` (Character ROM), and a scratch-mutated forward-carry produces a confident, wrong annotation exactly where the committed code correctly declines.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-05T19:48:00Z (approx.)
- **Completed:** 2026-09-05T20:32:00Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `evidence/proof03-bank-boundary.mjs` drives `anno-bank.ts`'s `decodeBankState()`/`resolveBankedRegion()`/`isBankConditionalAddress()` and `anno-join.ts`'s `runMemmapJoin()` directly, over the real committed export via `anno-import.ts`'s `parseGhidraExport()`/`parseConstWrites()` -- never a private re-implementation of the `$01` bit arithmetic, never a shelled-out subprocess, and provably clean via a `grep -al 'node:child_process'` count of 0.
- `direction1` subcommand: the same `$D020` write resolves to two different, real memmap.json labels under `$34` ("I/O Area..." RAM-constrained) vs `$33` ("Shape of characters..." Character-ROM-constrained) -- `PROOF03_TWO_BANK_STATES: differ`, verified byte-identical across two runs.
- `direction2` subcommand: the committed module declines at `$D020` (`counts.declined: 1`, reason naming both `$33` and `$34`); an in-process scratch-tree mutation (built under `PROBE_DIR`, torn down in a `finally`) replacing only the decline branch with a forward-carry annotates confidently with the wrong label -- `PROOF03_FORWARD_CARRY_WRONG_AT: $d020`. Cleanliness of `anno-join.ts`/`anno-bank.ts` observed via sha256 byte-identity before/after, confirmed `yes`.
- `branches` subcommand: all four `constWrites` shapes exercised against the same address -- absent (`annotated`, the ordinary unconstrained label, proving the bank machinery is a true no-op), empty (`declined`, no default to the power-on value), agreeing-values (`annotated`, two facts/one region), disagreeing-values (`declined`, both values named) -- plus an ordering demonstration (`decisions[]` returns address-ascending regardless of insertion order; a decline reason names disagreeing values in ascending numeric order regardless of insertion order).
- `evidence/proof03-bank-boundary.md` records both directions and the branch sweep as a fresh, self-contained transcript, citing Phase 37's `37-06-bank-decode-bypass-red.md` and `37-06-path-dependent-decline-red.md` explicitly as prior art (badged `AUTO-04`/`AUTO-05`) per D-04 -- a reader never has to open a Phase 37 file to verify PROOF-03's claim.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the repeatable PROOF-03 driver -- both directions, three constWrites shapes, scratch-tree mutation** - `374514ac` (feat)
2. **Task 2: Record PROOF-03 in both directions, whichever way each came out** - `f7af7902` (docs)

**Plan metadata:** committed after this SUMMARY.

## Files Created/Modified

- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs` - the repeatable driver (`direction1`, `direction2`, `branches` subcommands)
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.md` - the fresh, self-contained PROOF-03 record

## Decisions Made

- Standardized on the fixture's `$D020` shared border-colour write (not the `$D000` sprite-read point) as the single shared program point exercised across `direction1`/`direction2`/`branches`, for consistency and to keep the transcript focused on one address.
- Fixed a real bug found while building `direction2`: `String.prototype.replace()` treats `$$` in a plain-string replacement as a special pattern collapsing to a single literal `$`, and the forward-carried mutation's own source legitimately contains `` `$${uniqueValues[0]!.toString(16)}` `` (a literal `$` immediately followed by a template interpolation) -- exactly the sequence that rule silently eats, producing a subtly wrong mutated `reason` string (`"(33)"` instead of `"($33)"`). Switched to a function-form replacer (`.replace(pattern, () => replacement)`), which inserts its return value verbatim with no `$`-pattern substitution. This does not affect the pre-existing, already-committed `anno-bank.test.ts` (out of scope for this plan; its own equivalent tests never assert the mutated-path reason text, so the same latent quirk there is harmless and untouched).
- The driver's own cleanliness check (`direction2`) is a sha256 byte-identity comparison of `anno-join.ts`/`anno-bank.ts` before and after the scratch-tree work, not a shelled-out `git status --porcelain` -- this plan's own acceptance criteria (T-38-01) requires the driver to import no child-process module at all. The literal `git status --porcelain` transcript the plan's action text asks for is instead run by the executor directly (not the driver) when building `proof03-bank-boundary.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `String.replace()`'s `$$` -> `$` collapse in the direction2 scratch-mutation builder**
- **Found during:** Task 1, first live run of `direction2`
- **Issue:** `joinBefore.replace(FIXED_DECLINE_BLOCK, FORWARD_CARRIED_DECLINE_BLOCK)` silently dropped one of two literal `$` characters in the mutated source's own `` `$${uniqueValues[0]!.toString(16)}` `` template, because `String.replace()`'s special replacement-pattern syntax treats `$$` in a plain-string replacement argument as an escaped single `$`. The scratch-mutated module then produced a `reason` string reading `"...(33)..."` instead of the correct `"...($33)..."` -- cosmetically wrong, though the substantive observation (outcome `annotated` where committed code `declined`, and the wrong label) was unaffected.
- **Fix:** Changed to a function-form replacer: `.replace(FIXED_DECLINE_BLOCK, () => FORWARD_CARRIED_DECLINE_BLOCK)`, whose return value is inserted verbatim with no `$`-pattern substitution.
- **Files modified:** `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs`
- **Verification:** Re-ran `direction2`; `DIRECTION2_MUTATED_REASON` now correctly reads `reached under differing processor-port values ($33) that all resolve to the same region (character_rom)`. Re-verified determinism (two runs, byte-identical) and the `git status --porcelain`/`grep -al 'node:child_process'` checks all still pass.
- **Committed in:** `374514ac` (Task 1 commit -- fixed before the task's own commit, not a follow-up)

**2. [Rule 1 - Bug] Rephrased header/inline comments that literally spelled `node:child_process`**
- **Found during:** Task 1, running the verify command `grep -al 'node:child_process' proof03-bank-boundary.mjs | wc -l`
- **Issue:** The driver's own explanatory comments (written to document WHY the file never imports Node's child-process module) spelled out the literal string `node:child_process` twice in prose, which the acceptance-criteria grep matches regardless of comment-vs-code context -- a self-inflicted false positive on the very check meant to prove the constraint.
- **Fix:** Rephrased both comments to say "Node's child-process module" / "child-process module" instead of the literal specifier string.
- **Files modified:** `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs`
- **Verification:** `grep -al 'node:child_process' ... | wc -l` returns `0`; all other checks re-verified unaffected.
- **Committed in:** `374514ac` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, both found and fixed before the Task 1 commit landed).
**Impact:** Both fixes were necessary for the driver to satisfy its own plan-mandated acceptance criteria (accurate mutated-run output; zero child-process references). No scope creep -- both fixes are entirely inside the new driver file this task creates.

## Issues Encountered

While running Task 2's own verify command (`pgrep -f vice-broker >/dev/null && echo BROKER_RUNNING || npm run test:automated`), the naive invocation self-matched: `pgrep -f` substring-matches ANY process's full command line, and the shell wrapper evaluating that exact command line contains the literal string `vice-broker`, so the check reported `BROKER_RUNNING` even though the broker was genuinely stopped (confirmed independently via `systemctl --user is-active vice-broker` = `inactive` and `pgrep -x x64sc` = no match, both before and after). This is the same documented `pgrep -af`/`-f` self-match trap `evidence/README.md`'s own convention 3 and Phase 33's `capture-pair.mjs` already record for the `x64sc` process name; it applies identically to `vice-broker`. Resolved by running `npm run test:automated` directly rather than trusting the `pgrep -f` gate. `test:automated` was measured three times in this session; two runs showed the already-documented intermittent `audit-root-args.test.ts:982` scratch-file race (an extra 2 failures, `ENOENT ... zz-scratch-in03-negative.md`-shaped), which cleared on re-run. The recorded, trusted result is `tests 3525 / pass 3512 / fail 2`, at the baseline `evidence/README.md` already established, both failures the same pre-existing `anno-register.test.ts` findings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `evidence/proof03-bank-boundary.mjs` and `.md` are committed; `PROOF-03`'s outcome lines are all recorded per `evidence/SCHEMA.md`'s frozen vocabulary, and the record cites Phase 37's prior art rather than standing on it (D-04 satisfied).
- No blockers for `38-03` (PROOF-02 loader stage) or `38-04` (PROOF-02 depacked capture), both of which depend only on `38-01`, not on this plan.
- `TEST_AUTOMATED_BASELINE: tests 3525 / pass 3512 / fail 2` remains the floor later plans compare against -- unaffected by this plan's work.

## Self-Check: PASSED

Both created files confirmed present on disk (`ls`); both commits (`374514ac`, `f7af7902`) confirmed in `git log --oneline --all`.

---
*Phase: 38-proof-01-03-on-real-cracked-code*
*Completed: 2026-09-05*
