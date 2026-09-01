---
phase: 31-procedure-re-pointing
plan: 01
subsystem: infra
tags: [manifest, provenance, snapshot-record, upstream-audit, json]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "upstream-procedure-manifest.json — the dated upstream snapshot record this plan re-syncs"
  - phase: 28-annotation-store
    provides: "revertTo(handle, revision) in anno-store.ts and the base_revision compare-and-swap argument — the live subjects two justifications are re-pointed onto"
  - phase: 29-surface-substitution
    provides: "CURATED_ANNO_TOOLS / anno-tools.ts and the anno-derivation.test.ts rename — the surviving subjects trigger 1 and trigger 3 now name"
provides:
  - "The re-synced snapshot record: three re-sync triggers whose mechanisms name live subjects"
  - "anno_undo's omit disposition carrying requirement_id STORE-04 as a decided, not reversed, omission"
  - "Every retired requirement id and phase number preserved as a dated past-tense fact"
affects: [phase-31-verification, future-upstream-resync, milestone-audit]

# Actuals (#2632)
actuals:
  tokens: 3505
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-point a live route; keep-and-date a past-tense fact — applied per-sentence rather than per-token"
    - "The plan itself acts as the mechanical reader a prose record lacks (D8 sweep)"

key-files:
  created:
    - .planning/phases/31-procedure-re-pointing/31-01-SUMMARY.md
  modified:
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json

key-decisions:
  - "anno_undo's disposition stays `omit`: STORE-04's arrival makes the omission DECIDED, it does not reverse it — the criterion was discharged at the store layer by revertTo(handle, revision), deliberately not as a surface verb, per D2"
  - "The three justifications citing the deleted tool registry were converted to dated past-tense facts rather than re-pointed onto anno-tools.ts — that module records none of the three things (no HELD marker, no D18-26, no 'no criterion in this phase' note), so re-pointing would have manufactured a false citation"
  - "The anno-session.ts FIFO-mutex sentence was re-pointed onto the discipline that actually applies (the Phase 28 store's single-writer, open/close-per-call model plus the optional base_revision compare-and-swap) rather than deleted"
  - "Trigger 3's 'Two of them ... already name the requirement' count was corrected to distinguish the two future-surface proposals from anno_undo's arrived-and-discharged criterion — leaving it unqualified would have made an adjacent sentence false by this plan's own edit"

patterns-established:
  - "Occurrence-count hardening: a token asserted at `grep -c` 1 was rewritten so an occurrence-based re-check also reads 1, removing a false drift signal"

requirements-completed: [REPOINT-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "No manifest sentence points a reader at a module, symbol or test file Phase 29 deleted — all four retired tokens return zero hits"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "grep -c 'anno-tools' / 'anno-session' / 'anno-upstream-audit' / 'CURATED_ANNO_TOOLS' over the manifest → 0 0 0 0 (was 5 lines before)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Trigger 3's mechanism — the instruction REPOINT-04 turns on — names CURATED_ANNO_TOOLS and src/mcp/vice/anno-tools.ts, keeping its same-commit clause"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "grep -o 'CURATED_ANNO_TOOLS' | wc -l → 1; grep -c 'anno-tools.ts' → 4"
        status: pass
    human_judgment: false
  - id: D3
    description: "Trigger 1's mechanism names anno-derivation.test.ts, with ANNO_UPSTREAM_CLONE byte-identical"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "grep -c 'anno-derivation.test.ts' → 1; grep -o 'ANNO_UPSTREAM_CLONE' | wc -l → 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno_undo reads `omit` with requirement_id STORE-04 in the documented key slot, and a justification naming STORE-04, revertTo and D2"
    requirement: "REPOINT-04"
    verification:
      - kind: unit
        ref: "node -e '...anno_undo...' prints `omit STORE-04 disposition,justification,upstream_citation,requirement_id,sites`"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts#every non-curated upstream call carries a justification and a citation (requirement_id shape gate + manifest-to-surface agreement)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The manifest schema, the pins, and the manifest-to-surface agreement in BOTH directions survive the edit"
    requirement: "REPOINT-04"
    verification:
      - kind: unit
        ref: "node --test anno-derivation.test.ts skill-attribution.test.ts anno-register.test.ts → # fail 0 (34 tests, 1 expected skip)"
        status: pass
      - kind: other
        ref: "procedures / sites / upstream_citation / dispositions arrays JSON-compared byte-identical against HEAD~1"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every stale reference became a re-pointed route or a dated past-tense fact — no justification, citation or trigger lost the decision it records"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "git show --numstat HEAD → 9 insertions / 8 deletions (insertions >= deletions)"
        status: pass
    human_judgment: true
    rationale: "The numstat shape proves no net deletion, but whether each retained fact still reads as the decision it recorded is editorial. The flagged assumption in the plan (a stale reference of a shape outside the four-token grep set) is only coverable by a human reading of the 66-line file — this SUMMARY is the record that it is uncovered mechanically."
  - id: D7
    description: "The whole manifest change lands in exactly one commit whose git show --stat lists the manifest alone"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "git show --stat 7adcbaf → 1 file changed; no diff-inspecting gate built (Finding 6)"
        status: pass
    human_judgment: false

# Metrics
duration: 21 min
completed: 2026-08-31
status: complete
---

# Phase 31 Plan 01: Upstream Procedure Manifest Re-sync Summary

**Eight prose deltas re-syncing Phase 19's upstream snapshot record onto surviving subjects — trigger 3 now names `CURATED_ANNO_TOOLS`/`anno-tools.ts`, trigger 1 names `anno-derivation.test.ts`, and `anno_undo` carries `requirement_id: STORE-04` as a decided omission discharged by `revertTo(handle, revision)` per `D2`.**

## Performance

- **Duration:** 21 min
- **Completed:** 2026-08-31T09:07:41Z
- **Tasks:** 1 (type `tracer`)
- **Files modified:** 1

## Accomplishments

- **The drift no gate could see is gone.** All four retired tokens (`anno-tools`, `anno-session`, `anno-upstream-audit`, `CURATED_ANNO_TOOLS`) return zero hits. They survived all of Phase 29 because the removal gate excludes the `.planning/` prefix and `docs-dangling-refs.test.ts` deliberately excludes `.planning/phases/**` — the manifest's prose has no mechanical reader, so this plan was that reader.
- **Trigger 3 — the instruction `REPOINT-04` turns on — points at live subjects again**, with its "in the same commit" clause intact.
- **`anno_undo`'s omission is now a decided one**, carrying `STORE-04` and a justification stating the criterion arrived and was discharged at the store layer, deliberately not as a surface verb. The disposition stayed `omit`.
- **Every retired id and phase number survives as a dated fact** — `SURF-01`, `SURF-03`, `Phase 20/21`, `Phase 21` — and `STORE-02`'s by-construction closure of the splitter blocker is recorded.
- **A third manifest reader was found that the plan did not name:** `anno-register.test.ts`. It was run and is green (13/13).

## Task Commits

1. **Task 1: Re-sync the whole manifest end-to-end** — `7adcbaf` (docs)

_Single-task, single-commit by design: the record must never exist in a committed state where half of it describes the surface._

## Files Created/Modified

- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json` — eight prose deltas plus one added `requirement_id` key; every pin, digest, `sites` array and `upstream_citation` left byte-identical

## Verification Results

Broker confirmed `inactive` before every suite run (a live broker deterministically reddens the BACK-05 test).

| Check | Result |
|---|---|
| `grep -c` the four retired tokens | `0` `0` `0` `0` (was 5 matching lines) |
| `CURATED_ANNO_TOOLS` / `anno-tools.ts` / `anno-derivation.test.ts` | `1` / `4` / `1` |
| `ANNO_UPSTREAM_CLONE` occurrences | `1` — spelling unchanged |
| `STORE-04` / `revertTo` / `\bD2\b` | `2` / `1` / `1` — all three were `0` before (false-before/true-after) |
| `anno_undo` shape | `omit STORE-04 disposition,justification,upstream_citation,requirement_id,sites` |
| Pins and counts | `3 5 493f840418f1450a342bb220c2fe3d2585dd0525 0.9.20 MIT OR Apache-2.0 MIT` — unchanged |
| `node --test anno-derivation.test.ts skill-attribution.test.ts` | `# fail 0` (21 tests, 1 expected skip) |
| `node --test anno-register.test.ts` (third reader) | `# fail 0` (13 tests) |
| `node scripts/check-no-analyser.mjs` | exit `0`, `skill-attribution-headers 24` |
| `npm run typecheck` | exit `0` (no-op — zero TypeScript changed) |
| `npm run test:automated` | `# fail 1` — see Issues Encountered |
| `git show --stat HEAD` | 1 file changed, 9 insertions(+), 8 deletions(-) |
| `git status --porcelain src/skills installer/skills anno-tools.ts anno-derivation.test.ts` | empty |

## Decisions Made

- **The omission stands.** `STORE-04` arriving is what makes `anno_undo`'s omission *decided* rather than unexamined; it does not reverse it. Flipping to `curated` would have gone red at `anno-derivation.test.ts`'s `assert.equal(disposition === "curated", curated, …)` because the surface carries no undo route under any spelling.
- **Three justifications were dated, not re-pointed.** `anno-tools.ts` records none of the three things the manifest attributed to its deleted predecessor (no `HELD` marker, no `D18-26`, no "no criterion in this phase" note). Re-pointing would have manufactured a false citation — worse than the stale one.
- **The FIFO-mutex sentence was re-pointed onto the real discipline**: the Phase 28 store's single-writer, open/close-per-call model (`D-06`) plus the optional `base_revision` compare-and-swap argument, whose validator refuses a non-integer by name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trigger 3's "Two of them" count was made false by this plan's own edit**

- **Found during:** Task 1 (delta D2)
- **Issue:** Trigger 3's mechanism reads *"Two of them (anno_toggle_splitter, anno_set_immediate_format) already name the requirement that would supply their criterion."* Delta D3 adds a `requirement_id` to a third entry, which would have left that sentence stating a false count — freshly-introduced staleness of exactly the class this plan exists to remove.
- **Fix:** Kept the two-item claim (still exactly true of the two *future-surface* proposals) and added that a third, `anno_undo`, names the criterion that ARRIVED and was discharged without a surface verb. This preserves the distinction between "a criterion that would justify adding it" and "a criterion already answered elsewhere" rather than collapsing them into a count of three.
- **Files modified:** the manifest (trigger 3's mechanism)
- **Verification:** `anno-derivation.test.ts` green; the mechanism still names `CURATED_ANNO_TOOLS` and the same-commit clause
- **Committed in:** `7adcbaf`

**2. [Rule 3 - Blocking] `node_modules/` absent in the worktree blocked two mandated verifications**

- **Found during:** Task 1 verification
- **Issue:** `npm run typecheck` failed with `sh: 1: tsc: not found` and `npm run test:automated` reported **51 failures**, all `ERR_MODULE_NOT_FOUND: Cannot find package '@mastra/mcp'`. `node_modules/` is gitignored and provisioned by a `SessionStart` hook in the main checkout, so a fresh worktree has none. The plan's `<verify>` block could not be honestly executed.
- **Fix:** Ran the project's own provisioning seam, `scripts/ensure-mcp-deps.sh`, which does `npm ci --no-audit --no-fund` from the **committed lockfile**. This is not a package-manager *addition* (no new or unpinned package — the exact pinned tree already present in the main checkout), so the Rule 3 package-install exclusion does not apply. Failures dropped 51 → 1.
- **Files modified:** none tracked (`node_modules/` is gitignored; `git status --porcelain` is empty)
- **Verification:** typecheck now exits 0; `test:automated` 2911 pass / 1 fail
- **Committed in:** n/a — no tracked file changed

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were necessary for correctness of the record and for honest verification. No scope creep — the manifest remains the only file changed.

## Issues Encountered

**One `test:automated` failure remains, and it is a worktree-location artifact, not a regression.**

`not ok 1451 - path agreement (D-3, D-6 …): … the agreed path is not under .claude` in `repo-root.test.ts`. Its own error text is decisive:

> `the agreed directory must not sit under .claude -- got /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a9a7005f32a825bc7/.vice-supervisor`

This worktree *itself* lives at `.claude/worktrees/…`, so the resolved supervisor directory is under `.claude` by construction. Attribution is proven two independent ways:

1. `grep -c "upstream-procedure-manifest" repo-root.test.ts` → **0**. The test never reads the file this plan changed. Only three test files read the manifest (`anno-derivation`, `skill-attribution`, `anno-register`) and all three are green.
2. The assertion is a predicate over the worktree's own filesystem path, which no `.planning/` JSON edit can influence.

**Expected to pass in the main checkout after merge** (which is not under `.claude`). It should not be treated as a defect introduced by this plan, and the plan's `# fail 0` criterion is met for every instrument that actually reads the manifest.

## Known Stubs

None.

## Threat Flags

None — no new security-relevant surface. No runtime code path, dependency, network call, input or credential was touched; the change is prose in a first-party JSON planning artifact.

## Threat Register Outcome

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-31-01 | mitigate | **Held.** The rewritten justification states the criterion's arrival AND the omission's survival in the same paragraph; `STORE-04`, `revertTo` and `D2` all assert present |
| T-31-02 | mitigate | **Held.** `disposition` compared against `HEAD~1` — all five unchanged, `anno_undo` still `omit` |
| T-31-03 | mitigate | **Held.** `procedures` array JSON-identical to `HEAD~1`; the two pin-pattern hits in the diff are prose mentions of the words "sha256"/"commit" inside trigger 1's mechanism, not pin values |
| T-31-04 | mitigate | **Held.** 9 insertions vs 8 deletions; every retired id and phase number retained with a dated parenthetical |
| T-31-05 | mitigate | **Held.** `ANNO_UPSTREAM_CLONE` occurrence count is exactly 1 and byte-identical; `VICE_REQUIRE_ANNO_UPSTREAM` untouched |
| T-31-06, T-31-07, T-31-SC | accept | Unchanged — no install task, no execution, nothing secret |

## Flagged Assumptions Carried Forward

- **`STORE-04` remains an inferred id, not a quoted one.** No document says "the criterion for `anno_undo` is `STORE-04`" verbatim. The justification therefore carries the *reasoning* in words (revert answered by whole-store snapshot/restore at the store layer, per `D2`) rather than leaning on the id alone. If the id is wrong, the fix is a one-token edit.
- **The `unclassified` edge-probe category stays unresolved, deliberately.** The residual risk is a stale reference of a shape outside the four-token grep set. The D8 sweep plus a full read of the file covered what could be covered; a human reading at review time is the only remaining coverage, recorded here as `human_judgment: true` on deliverable D6.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `REPOINT-04`'s manifest half is complete and green. The plan did **not** touch `REQUIREMENTS.md`, `ROADMAP.md` or `STATE.md`; the orchestrator owns those writes post-wave.
- **For plan 31-03 (or whoever owns delta 8):** the two stale `"ROADMAP Phase 31 criterion 4"` citations in `scripts/check-no-analyser.mjs` (`:293`, `:523`) and the third at `.planning/STATE.md:718` are **still present** — deliberately out of this plan's scope (`files_modified` names the manifest alone).
- **For the verifier:** `31-VALIDATION.md` names two manifest readers; there are **three**. Add `anno-register.test.ts` to the per-task verification map.
- **Note for anyone running suites in a worktree:** `node_modules/` must be provisioned first via `scripts/ensure-mcp-deps.sh`, and `repo-root.test.ts:1451` fails by construction inside `.claude/worktrees/`.

## Self-Check: PASSED

- `.planning/phases/31-procedure-re-pointing/31-01-SUMMARY.md` — created (this file)
- `.planning/phases/19-.../upstream-procedure-manifest.json` — modified, exists on disk, valid JSON
- Commit `7adcbaf` — present in `git log`, lists exactly one path
- All `<acceptance_criteria>` re-run post-commit; every criterion reporting on an instrument that reads the manifest passes. The single `test:automated` failure is attributed to the worktree's location under `.claude` with two independent proofs (see Issues Encountered).

---
*Phase: 31-procedure-re-pointing*
*Completed: 2026-08-31*
