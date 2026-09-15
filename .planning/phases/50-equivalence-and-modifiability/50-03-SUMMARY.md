---
phase: 50-equivalence-and-modifiability
plan: 03
subsystem: testing
tags: [reassembly-gate, hazard-report, allowlist, cross-binary-comparison, acme, node-test]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability
    provides: "plan 50-01's compare-cross-binary.mjs (the allowlist schema this plan's document conforms to). Also plan 50-02's hazard-subject-modified.prg / .annostore.json (the subject this plan reassembles through the gate)."
provides:
  - "docs/phase50-modifiability-findings.md: the modified subject's own machine-readable reassembly-gate verdict (acknowledged, rule R10). This satisfies ROADMAP criterion 4's 'reassembled through Phase 49's gate' as a NEW run, never a reuse of Phase 49's own verdict."
  - "hazard-subject-modified.allowlist.json: the pre-registered, committed allowlist for the modified subject's intentional differences. Ready for plan 50-06's real capture-based comparison in wave 4."
affects: [50-04, 50-05, 50-06, 50-07]

# Actuals (#2632)
actuals:
  tokens: 15200
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reassembly-gate-modified-run.test.ts is a SIBLING of reassembly-gate-run.test.ts, not an edit to it. The committed subject's own run stays on the record unchanged. This run's verdict is a second, independent measurement over the modified subject's own real hazard report."
    - "Cross-package subprocess pattern for the allowlist's static proof: src/mcp/vice/** cannot import src/skills/**. compare-cross-binary.mjs is driven via spawnSync(process.execPath, [...]) instead -- the same pattern skill-acme-build-cli.test.ts already established for acme.mjs."
    - "A minimal, commented, address-matched duplicate of compare-cross-binary.mjs's own mask tables lives inside the new TS test file. It exists for the two static mask-overlap assertions the cross-package boundary otherwise makes unreachable -- the same second-implementation-across-a-package-boundary pattern acme-verify.ts's own ACME_VERIFY_ARGV_FLAGS/MSVC regex already carry."

key-files:
  created:
    - src/mcp/vice/reassembly-gate-modified-run.test.ts
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json
    - docs/phase50-modifiability-findings.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/50-03-modified-gate-run.md

key-decisions:
  - "The frozen acknowledgement array was built from the modified subject's OWN real hazard report, measured at authoring time via buildHazardReport(). It was not copied from reassembly-gate-run.test.ts's five-entry array. The modified subject carries 4 findings, not 5. The page-alignment finding at $088B is absent because the sprite-pointer write that produced it is removed."
  - "compare-cross-binary.mjs is exercised via a subprocess (spawnSync(process.execPath, [SCRIPT, 'cross', ...])), never an import. src/mcp/vice/** and src/skills/** publish as separate npm packages and cannot import each other. This follows skill-acme-build-cli.test.ts's own established pattern for the identical package-boundary problem."
  - "The allowlist's code-range entry ($87A..$FFF) was bounded by real ACME symbol addresses (hazard_align_entry, align_char_base). These were resolved by actually assembling the modified subject at plan-authoring time. The bounds were read from its symbol list, never hand-derived from source alone, per the plan's own instruction."
  - "The findings document records an Override section for a plan-verify-vs-document-structure mismatch. 50-03-PLAN.md's own Task 2 <verify> asserts the seven input-key names at column zero. Its own action text instead requires nesting them under a YAML inputs: block (matching docs/phase49-the-reassembly-gate-findings.md's own structure). The identical literal grep against the committed Phase 49 document also returns 0. This shows the plan's own verify-command literal disagrees with the schema it asks this document to mirror -- not a defect in this document. Disclosed rather than silently worked around, following Phase 49's own precedent for the identical class of gap."

requirements-completed: [EQUIV-03]

coverage:
  - id: D1
    description: "The modified subject is reassembled through Phase 49's gate for real, producing its own new verdict (acknowledged, rule R10) rather than reusing Phase 49's committed verdict"
    requirement: EQUIV-03
    verification:
      - kind: integration
        ref: "src/mcp/vice/reassembly-gate-modified-run.test.ts#gate run: the four in-process gate inputs, measured for real against the MODIFIED subject and a real assembler"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate module itself (reassembly-gate.ts) is byte-unchanged by this plan -- only its inputs differ"
    requirement: EQUIV-03
    verification:
      - kind: other
        ref: "git diff --quiet 702fb21b -- src/mcp/vice/reassembly-gate.ts (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The findings document records all seven gate inputs, each cited to a literal evidence-file line number, with the verdict recomputed through runReassemblyGate() rather than asserted"
    requirement: EQUIV-03
    verification:
      - kind: other
        ref: "grep -c '^\\s*(tree_rebuild|movement_rebuild|hazard_disposition|diff_scope_coverage|red_controls|second_path_guard|ordering_proof):' docs/phase50-modifiability-findings.md -> 7"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both behaviour changes are cross-referenced to their named finding anchors ($088B removed, $0825 added) in the findings document"
    requirement: EQUIV-03
    verification:
      - kind: other
        ref: "grep -c '088B|088b' and grep -c '0825' docs/phase50-modifiability-findings.md -> 3 and 3"
        status: pass
    human_judgment: false
  - id: D5
    description: "The allowlist is committed before any capture exists, every entry carries a non-empty why, no entry overlaps a masked span, and the committed image pair passes with the allowlist and fails without it"
    requirement: EQUIV-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/reassembly-gate-modified-run.test.ts -- four tests: non-empty why, no mask overlap, register entries outside the mask, and the static allowlist proof (pass with allowlist, fail with --no-allowlist)"
        status: pass
      - kind: other
        ref: "ls .planning/phases/50-equivalence-and-modifiability/evidence/captures (no such directory, exit 2)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-15
status: complete
---

# Phase 50 Plan 03: The Modified Subject's Reassembly Gate Verdict Summary

**A new, independent reassembly-gate run over the modified hazard subject (verdict `acknowledged`, rule `R10`, 4 real findings not 5), a machine-readable findings document citing every input to a literal evidence line, and a pre-registered 7-entry allowlist proven to do real work by a static pass/fail pair.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-15 (approximate -- exact start not captured at session open)
- **Completed:** 2026-09-15T14:23:21Z
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments
- Wrote `reassembly-gate-modified-run.test.ts`, modeled on `reassembly-gate-run.test.ts`. It reuses `reassembly-gate.ts`/`acme-verify.ts` unchanged. It drove the same four in-process gate inputs against `hazard-subject-modified.prg`/`.annostore.json`: `TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok` (the shared, unmodified movement subject, reused rather than re-derived), `DIFF_SCOPE_COVERAGE: complete` on both occurrences, and `HAZARD_DISPOSITION: acknowledged`.
- Built the frozen acknowledgement array from the modified subject's OWN real hazard report, measured at authoring time. It carries 4 findings (`indexed-dispatch` $081C, `self-modifying-code` $0825, `page-alignment` $0881, `cycle-exact-raster` $10C2), not the committed subject's 5. The `page-alignment` finding at $088B is absent because the sprite-pointer write producing it is removed.
- Wrote `docs/phase50-modifiability-findings.md`, mirroring Phase 49's frontmatter key order and transcription discipline. Every one of the seven gate inputs is cited to a literal line number in a new evidence file (`evidence/50-03-modified-gate-run.md`). The verdict (`acknowledged`, `R10`) is recomputed via `runReassemblyGate()` against those seven recorded values, not asserted.
- Recorded `red_controls: all-observed` from a fresh re-run of `acme-verify.test.ts` + `reassembly-gate.test.ts` (67/67 pass). Recorded, honestly, a NARROWER `second_path_guard: held` than Phase 49's own: `acme-seam.test.ts`, Phase 49's own tree-wide frozen-set guard, was removed in commit `276c15c9` after Phase 49 closed. This run's `held` rests on `acme-verify.test.ts`'s narrower single-launch pin plus this plan's own grep check, stated no more strongly than that.
- Committed `hazard-subject-modified.allowlist.json`: 7 pre-registered entries (4 image-domain, 3 register-domain). Each predicts an intentional difference from the source before any capture exists. The code-range entry's bounds (`$87A`..`$FFF`) were resolved from a real ACME symbol list, not hand-derived.
- Extended the same test file with the allowlist's static proof. The two committed `.prg` payloads, lifted into zero-filled 64K buffers, pass under `compare-cross-binary.mjs` with the allowlist and fail with `--no-allowlist`. This runs via subprocess (`skill-acme-build-cli.test.ts`'s own established cross-package pattern). Three direct assertions back it: non-empty `why`, no mask overlap, and register entries outside the mask, against a minimal, address-matched duplicate of the mask tables.

## Task Commits

Each task was committed atomically:

1. **Task 1: Drive the real gate against the modified subject** - `fd0ba45d` (feat)
2. **Task 2: The machine-readable findings document for the modified subject** - `fad2b511` (docs)
3. **Task 3: Pre-register the intentional differences in a committed allowlist** - `ca02a89c` (feat)

## Files Created/Modified
- `src/mcp/vice/reassembly-gate-modified-run.test.ts` - the gate-run harness (Task 1) plus the allowlist's static proof (Task 3), 6 tests total
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json` - the pre-registered 7-entry allowlist
- `docs/phase50-modifiability-findings.md` - the machine-readable gate verdict for the modified subject
- `.planning/phases/50-equivalence-and-modifiability/evidence/50-03-modified-gate-run.md` - the literal captured run output the findings document cites

## Decisions Made
- **The acknowledgement array is derived from a real measurement, not copied.** `buildHazardReport()` was run directly against the modified subject at authoring time. This discovered its real finding set (4, not 5) before the frozen array was written. The array names exactly what the report carries, no more and no less.
- **Cross-package subprocess, not an import, drives `compare-cross-binary.mjs`.** `src/mcp/vice/**` and `src/skills/**` publish as separate npm packages. They cannot import each other (the same constraint `acme-verify.ts`'s own header states for `ACME_VERIFY_ARGV_FLAGS`). `skill-acme-build-cli.test.ts` already established the exact pattern this plan reuses: `spawnSync(process.execPath, [SCRIPT, "cross", ...])`, never a shell string.
- **The code-range allowlist entry's bounds come from a real ACME symbol list.** They were resolved by actually assembling the modified subject's synthesized root at authoring time (`hazard_align_entry = $87A`, `align_char_base = $1000`) -- never hand-derived from reading the `.a` source's comments alone.
- **A documented Override, not a silent workaround, for a plan-verify-vs-structure mismatch.** `50-03-PLAN.md`'s own Task 2 `<verify>` asserts the seven input keys at column zero. Its own action text instead requires the Phase-49-mirroring nested `inputs:` YAML structure. The identical literal grep against the committed Phase 49 document also returns `0` -- confirmed directly as part of this plan's own work. The findings document keeps the correct, schema-conformant structure. It states the mismatch in its own `## Override` section, following Phase 49's own precedent for this exact class of gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own Task 2 `<verify>` grep does not match the document structure the same task's action text requires**
- **Found during:** Task 2 (writing the findings document's frontmatter)
- **Issue:** `50-03-PLAN.md`'s Task 2 `<verify>` asserts `grep -ac '^\(tree_rebuild\|...\):' docs/phase50-modifiability-findings.md` returns at least 7 -- a column-zero (no leading whitespace) match. The same task's own action text requires nesting those seven keys two spaces under a YAML `inputs:` mapping, mirroring `docs/phase49-the-reassembly-gate-findings.md`'s own committed structure. A nested key can never match a column-zero anchor. The identical literal grep against the already-committed Phase 49 document also returns `0`. This shows the plan's own verify-command literal disagrees with the schema it asks this document to mirror. `docs/phase49-the-reassembly-gate-findings.md`'s own `## Override` section already discloses the same class of gap, for its own Task 2 `<verify>` line-count assertion.
- **Fix:** Kept the proper, schema-conformant nested structure, matching Phase 49's own document and this plan's own explicit instruction. Added a `## Override` section to `docs/phase50-modifiability-findings.md` stating the mismatch. It cites the measured `0`-against-Phase-49 control and reports the whitespace-tolerant equivalent check (`grep -c '^\s*\(...\):' ` -> `7`) that the document's actual content satisfies.
- **Files modified:** `docs/phase50-modifiability-findings.md`
- **Verification:** `grep -c '^\s*\(tree_rebuild\|movement_rebuild\|hazard_disposition\|diff_scope_coverage\|red_controls\|second_path_guard\|ordering_proof\):' docs/phase50-modifiability-findings.md` -> `7`. The column-zero literal against both this document and the committed Phase 49 document -> `0` for both. This shows the mismatch is structural and pre-existing, not introduced here.
- **Committed in:** `fad2b511` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in the plan's own verify-command literal, Rule 1)
**Impact on plan:** The fix preserves the document's correct, schema-conformant structure exactly as the plan's own action text and Phase 49's own precedent require. No scope creep occurred. The mismatch is disclosed in the document itself, following the project's own established pattern for this exact class of gap.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The modified subject's own gate verdict is committed and real: `acknowledged`, rule `R10`, from a fresh run this plan produced, never inherited from Phase 49's own verdict. `reassembly-gate.ts` remains byte-unchanged (`git diff --quiet 702fb21b -- src/mcp/vice/reassembly-gate.ts` passes).
- The pre-registered allowlist is committed and proven to do real work by its own static pass/fail pair. No capture exists yet under `.planning/phases/50-equivalence-and-modifiability/evidence/captures/` (confirmed absent), so plan 50-06's own wave-4 comparison is the first time any capture is measured under it -- the pre-registration gap this plan's own success criteria require.
- `node --test reassembly-gate-modified-run.test.ts acme-verify.test.ts reassembly-gate.test.ts reassembly-gate-run.test.ts` reports 75/75 pass. `npm run test:automated` reports 3654 pass, 0 fail, 9 skipped, matching the pre-existing skip floor. `npm run typecheck` exits 0 with no `error TS` lines.
- No blockers for plan 50-04 onward. Plan 50-04 (the tracer, load-route decision, same-binary re-run) and plan 50-05 (the red control) are unaffected by this plan's own work -- this plan touched only the reassembly-gate path for the modified subject, not the emulator-driven comparison path those plans own.

## Self-Check: PASSED

- `[ -f src/mcp/vice/reassembly-gate-modified-run.test.ts ]` -> FOUND
- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json ]` -> FOUND
- `[ -f docs/phase50-modifiability-findings.md ]` -> FOUND
- `[ -f .planning/phases/50-equivalence-and-modifiability/evidence/50-03-modified-gate-run.md ]` -> FOUND
- `git log --oneline --all --grep="50-03"` -> `ca02a89c`, `fad2b511`, `fd0ba45d`, all present, checked by direct hash lookup
- `node --test reassembly-gate-modified-run.test.ts acme-verify.test.ts reassembly-gate.test.ts reassembly-gate-run.test.ts` -> 75/75 pass
- `npm run test:automated` -> 3654 pass, 0 fail, 9 skipped (pre-existing floor)
- `npm run typecheck` -> exit 0, no `error TS` lines
- `git diff --quiet 702fb21b -- src/mcp/vice/reassembly-gate.ts` -> exit 0 (unchanged)
- `ls .planning/phases/50-equivalence-and-modifiability/evidence/captures` -> no such directory (exit 2)

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-15*
