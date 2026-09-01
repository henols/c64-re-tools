---
phase: 29-the-mcp-surface
plan: 08
subsystem: testing
tags: [mcp, tool-surface, derivation, manifest, register, guards, node-test]

requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: upstream-procedure-manifest.json — the five pinned procedures, their `tools` maps and the three dispositions this surface is derived from
  - phase: 29-05
    provides: the `anno-` prefix rename, `anno-derivation.test.ts`'s new filename, and `ANNO_MODULE_FLOOR = 15`
  - phase: 29-06
    provides: ANNO_TOOL_DEFINITIONS complete at exactly 19 verbs, and CURATED_ANNO_TOOLS
provides:
  - "anno-register.ts — the one committed record of why a surface verb the Phase 19 manifest does not classify exists, four unclassified entries plus one distinguishable manifest-deviation entry"
  - "anno-register.test.ts — six named directions with a derived non-vacuity relation first, and five planted-violation cases driving the same exported predicates"
  - "anno-derivation.test.ts's surface-derivation half — MCP-01 checked mechanically in both directions, with live-proven non-vacuity counters and an ordering direction"
  - "ANNO_MODULE_FLOOR raised 15 -> 16, paired with a pinned-equals-measured relation that names a same-wave module-set change as the diagnosis"
affects: [29-09, 29-10, 29-11, 29-12, skill-coverage-script, verb-surface-changes]

actuals:
  tokens: 13300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A committed register as the sanctioned, bounded escape hatch from a mechanical derivation — every entry citing BOTH a named consumer and a requirement id declared in REQUIREMENTS.md"
    - "Two distinguishable entry kinds so 'this verb has no manifest classification' never reads the same as 'this verb has one and we answered it differently'"
    - "A hand-pinned floor paired with a pinned-equals-measured equality assertion, so a same-wave module-set change fails with the right diagnosis instead of as an off-by-one attributed to the wrong plan"

key-files:
  created:
    - src/mcp/vice/anno-register.ts
    - src/mcp/vice/anno-register.test.ts
  modified:
    - src/mcp/vice/anno-derivation.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/package.json

key-decisions:
  - "The register requires BOTH a named consumer AND a cited requirement id, which is stricter than module-classification.ts's 'one or the other' — a public surface commitment is not a module that already exists and can be read"
  - "Requirement ids are checked for MEMBERSHIP in .planning/REQUIREMENTS.md, not only for FAMILY-NN shape — a plausible-looking id nothing declares is exactly the rubber stamp D-08's prohibition names"
  - "anno-register.test.ts's shadowing check uses a deliberately BROADER suffix-equality relation and says so at the point of use, rather than copying anno-derivation.test.ts's exact mapping — a shadowing check must over-approximate, and the exact mapping stays the single place the correspondence is written down"
  - "The collision direction is checked in BOTH directions: an 'unclassified' entry the manifest does classify is a shadow, and a 'manifest-deviation' entry the manifest does not classify is a deviation from a contract that does not exist"
  - "ANNO_MODULE_FLOOR is written as the literal expression `15 + 1` — the value plan 29-05 set plus the one module this plan adds — never derived from readdirSync, which would make it unfailable"

patterns-established:
  - "Non-vacuity counters proven LIVE rather than asserted: the routed minimum was raised to 17, observed red with the exact walked count in the message, then restored"
  - "A count-neutral edit to a file under the removal gate, measured both with and without `grep -a` before and after, with the gate script deliberately absent from the commit"

requirements-completed: [MCP-01, MCP-05]

coverage:
  - id: D1
    description: "Every verb the Phase 19 manifest classifies `curated` or `adapt-to-address-input` has a route, every verb it classifies `omit` is absent under both spellings, and an unrecognised disposition fails outright"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts#MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright"
        status: pass
    human_judgment: false
  - id: D2
    description: "`delete_project_enum` — the one verb with zero callers anywhere — is not carried, under either spelling"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts#MCP-01: the one verb with zero callers anywhere is not carried"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every surface verb the manifest does not classify has a committed register entry citing at least one requirement id and at least one named consumer; a verb added later with no named consumer FAILS rather than being reviewed"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts#DIRECTION 2 (completeness): every surface verb the manifest does not classify has a register entry -- a verb with no named consumer FAILS rather than being reviewed (D-08)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts#MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts#planted violation (completeness): a surface verb with NO register entry is reported by the same predicate the real scan calls"
        status: pass
    human_judgment: false
  - id: D4
    description: "A verb name classified by BOTH the manifest AND the register is reported by name rather than allowed to shadow the manifest"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts#DIRECTION 4 (collision): a verb classified by BOTH the manifest and the register is reported by name, and so is the mis-kind in the other direction"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts#planted violation (collision): an entry shadowing a manifest-classified verb, and a deviation entry the manifest does not classify, are both reported by the same predicate the real scan calls"
        status: pass
    human_judgment: false
  - id: D5
    description: "An empty or unreadable manifest read fails the derivation check on its own non-vacuity counters rather than passing every assertion above them trivially"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts#MCP-01 (forward) — routed/omitted minimums 16/4, proven live by raising the minimum to 17 and observing 'walked only 16 curated-or-adapt verbs, expected at least 17', then restoring"
        status: pass
    human_judgment: false
  - id: D6
    description: "The derivation verdict is independent of definition-table order and of manifest procedure order"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts#MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts#DIRECTION 6 (ordering): every direction yields identical results over reversed copies of BOTH the register and the definition table"
        status: pass
    human_judgment: false
  - id: D7
    description: "The register records the deviation where a route answers something other than what upstream's contract described — `anno_save_project` reports the revision and performs no write"
    requirement: "MCP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts#DIRECTION 4 (collision) — asserts the manifest-deviation population is non-empty and correctly kinded"
        status: pass
    human_judgment: false
  - id: D8
    description: "ANNO_MODULE_FLOOR is raised by exactly one when this plan's module lands, stays a hand-pinned integer, and is paired with an assertion that it equals the measured module count; the positive control still names four filenames that exist"
    requirement: "MCP-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set"
        status: pass
    human_judgment: false
  - id: D9
    description: "This plan's edit to anno-derivation.test.ts is count-neutral for the removal gate's needle, proven by measurement rather than by adjusting the gate"
    verification:
      - kind: other
        ref: "grep -aoi the external analyser src/mcp/vice/anno-derivation.test.ts | wc -l — 3 before and 3 after, identical with and without -a; scripts/check-no-analyser.mjs exits 0 and is absent from commit 904763e's git show --stat"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 08: The Manifest Derivation Check and the Verb Register Summary

**`MCP-01` turned from a claim into a checked property in both directions: `anno-derivation.test.ts` now walks the Phase 19 manifest and asserts a route for each of its 16 curated-or-adapt verbs and the absence of all 4 omit verbs under both spellings, while `anno-register.ts` gives the 4 unclassified surface verbs a committed home that fails — naming the verb — when a fifth appears without a requirement id and a named consumer.**

## Performance

- **Duration:** 9 min (first task commit 19:56 CEST → last task commit 20:05 CEST)
- **Started:** 2026-08-29T17:52:00Z (approx., first read)
- **Completed:** 2026-08-29T18:06:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **The derivation is now mechanical in the forward direction.** One total upstream-to-surface mapping with exactly two documented departures (the cursor fold per D-09; the search verb's shortened name) drives a single order-independent verdict function. Every `curated` and `adapt-to-address-input` verb must have a route; every `omit` verb must be absent under BOTH its mapped surface name and its bare suffix; an unrecognised disposition is pushed as a problem and fails, never skipped.
- **And in the backward direction.** Every surface verb is either manifest-classified or carries a register entry citing at least one requirement id. Without this half the surface could have grown without limit while still satisfying the forward check — which is precisely the "derived plus an unwritten allow-list" shape D-08 was written against.
- **The register exists and is bounded.** Four `unclassified` entries — `anno_add_scope`, `anno_remove_scope`, `anno_search`, `anno_update_project_enum` — each citing a requirement id declared in `REQUIREMENTS.md` and at least one consumer path that exists on disk. Plus one `manifest-deviation` entry for `anno_save_project`, kept as a distinguishable kind so a reader can tell "no manifest classification" from "classified, answered differently".
- **The register's guard cannot pass vacuously and cannot be a rubber stamp.** Six named directions with the derived non-vacuity relation placed first, five planted-violation cases each calling the same exported predicate the real scan calls, and a clean synthetic entry reported by none of them.
- **The module floor rose with the module that landed, and now says so if the ground moves.** `ANNO_MODULE_FLOOR` is `15 + 1` — a hand-pinned literal expression, never a disk read — paired with a new equality assertion whose failure message names a same-wave module-set change as the diagnosis and forbids nudging the literal to fit.

## Task Commits

Each task was committed atomically:

1. **Task 1: The committed register for verbs the manifest does not classify** — `1594c3a` (feat)
2. **Task 2: The register's enumerating guard — a verb with no named consumer fails** — `a403fdb` (test)
3. **Task 3: The manifest derivation check — MCP-01 made mechanical** — `904763e` (test)

## Files Created/Modified

- `src/mcp/vice/anno-register.ts` (created, 233 lines) — the entry type, the two entry kinds, the frozen `ANNO_VERB_REGISTER`, and `annoRegisterEntryFor()`. Carries the three-part header the plan asked for: what it is the one authoritative place for, why it exists (D-08 requires a verb with no named consumer to FAIL rather than be reviewed, and amending the manifest was rejected because it describes upstream at a pinned commit), and the citation discipline restated verbatim in intent including that a `line` citation is optional, advisory, and to be omitted rather than guessed.
- `src/mcp/vice/anno-register.test.ts` (created, 393 lines) — the enumerating guard.
- `src/mcp/vice/anno-derivation.test.ts` (modified, +207 lines, pure insertion) — the surface-derivation half appended below a section banner. The upstream-integrity half and both header prohibitions are byte-unchanged.
- `src/mcp/vice/hostpath-consumers.test.ts` (modified) — floor raise plus the pinned-equals-measured relation.
- `src/mcp/vice/package.json` (modified) — `anno-register.ts` added to `files[]`.

## Decisions Made

- **The set of unclassified verbs was DERIVED, not taken from the plan's prose.** Computed as the 19 surface names minus the manifest-classified names: `anno_add_scope`, `anno_remove_scope`, `anno_search`, `anno_update_project_enum`. That is exactly what the plan expected and exactly what `29-06-SUMMARY.md` predicted, so no reconciliation was needed. Recorded because the plan explicitly asked for the difference to be confirmed against the manifest rather than against the paragraph.
- **The register's basis rule is stricter than `module-classification.ts`'s.** That registry accepts "at least one consumer OR at least one requirement id"; this one requires both. Its subject was a module that already existed and could be read; this one's subject is a public surface commitment, and D-08 asks for a cited requirement id AND a named consumer.
- **Requirement ids are checked for membership, not only shape.** `module-classification.test.ts` deliberately checks shape only, on the reasoning that a requirement document is reorganised every milestone and a guard that reddened on that would be re-pointed rather than believed. Here membership is the point: an entry citing a plausible-looking id that nothing declares is the exact rubber stamp the prohibition names, so the guard parses `.planning/REQUIREMENTS.md`'s own bolded declarations and asserts the parse is non-empty first.
- **The shadowing check does not copy the exact mapping.** `anno-register.test.ts` uses a prefix-agnostic suffix-equality relation and documents at the point of use that it is deliberately BROADER than `anno-derivation.test.ts`'s exact mapping, because a shadowing check must over-approximate: a narrower relation could let a shadow through, whereas a broader one can only raise a false alarm that names the verb. `verbSuffix()` strips everything up to the first underscore, so neither family prefix appears as a literal and the relation survives the next rename.
- **Non-vacuity was proven live, not asserted.** `MEASURED_ROUTED_MINIMUM` was temporarily raised from 16 to 17, the test observed red with `walked only 16 curated-or-adapt verbs, expected at least 17`, and the file was restored from a scratch copy. That also confirms the measured value is exact (16 distinct curated-or-adapt names, 4 distinct omit names) rather than merely a satisfied lower bound.

### The two same-wave constraints the plan named — both discharged, with the observed ordering recorded

- **Count neutrality for the removal gate's needle: PROVEN, not assumed.** `anno-derivation.test.ts` carries the permanent manifest-provenance exemption pinned at an exact hit count of **3**. Measured before the edit: **3** with `grep -a`, **3** without. Measured after: **3** with `grep -a`, **3** without. The three occurrences are at lines 41, 69 and 94, all inside the untouched upstream-integrity half; the appended half is written entirely over this surface's own verb names and refers to upstream only as "the Phase 19 manifest" and "the upstream analyser". `scripts/check-no-analyser.mjs` exits **0**, and is **absent** from commit `904763e`'s `git show --stat`, which lists exactly one file.
- **The observed ordering with plan 29-07: 29-07 committed FIRST.** Its four commits (`cd6e2e0`, `d15ea45`, `4e491a6`, `9e91694`) plus its metadata commit `1c8b64c` were already on `main` when this plan started — `1c8b64c` was `HEAD`. So the gate's CLI allow-list entries were already discharged and the contingency the plan described (a gate failure naming a CLI path, to be re-checked after 29-07's commit) never arose. The gate was green on the first invocation and on every subsequent one.
- **The module-set assumption held.** 29-07 added no `anno-*.ts` production module and deleted none, exactly as measured at plan time. The count on this tree before Task 1 was **15**; after `anno-register.ts` landed it is **16**, which is what `ANNO_MODULE_FLOOR` is pinned to and what the new equality assertion confirms.

## Deviations from Plan

None — plan executed exactly as written.

One wording note that is not a deviation: the plan's acceptance criterion says `ANNO_MODULE_FLOOR` must be "a hand-pinned integer literal, exactly one greater than the value plan 29-05 set". Its `<action>` prose asks for the raise to be *expressed* as "the value plan 29-05 set, plus the number of `anno-*.ts` production modules this plan adds, which is exactly one". Both are satisfied by `const ANNO_MODULE_FLOOR = 15 + 1;` — two hand-pinned literals, constant-folded, with no disk read anywhere near it, and the arithmetic readable rather than asserted.

## Issues Encountered

None. Every gate was green on first invocation after the code it checks was written.

## Verification results

| Check | Result |
|---|---|
| `node --test anno-derivation.test.ts anno-register.test.ts anno-tools.test.ts hostpath-consumers.test.ts module-classification.test.ts` | **97 tests, 96 pass, 0 fail, 1 skipped** (the skip is the live upstream re-hash, absent by design) |
| `cd src/mcp/vice && npm run typecheck` | **exit 0** |
| `node scripts/check-npm-packages.mjs` | **exit 0** — `@henols/vice-mcp` now 84 files (was 81 at the baseline; the three added by plans 29-04/29-06/29-08) |
| `node scripts/check-no-analyser.mjs` | **exit 0** |
| `node scripts/audit-gate.mjs` | **exit 0** |
| `cd src/mcp/vice && npm run test:automated` | 2829 tests, 2795 pass, **6 fail**, 23 skipped — see the baseline comparison below |

### Baseline comparison — the failing-file SET, never a count

Per `29-BASELINE.md`, the comparison target is the SET. The VICE broker was confirmed **down** before the run (`systemctl --user status vice-broker` → unit not found; no `vice-broker`/`x64sc` processes), so no phantom `BACK-05` failure is baked in.

| File | Baseline | This run | Verdict |
|---|---|---|---|
| `anno-session.test.ts` | 5 (timing-sensitive FIFO queue, load-sensitive) | 5 in isolation, 6 under the full automated run | **unchanged** — same five named tests, the sixth being the load-sensitive variant the baseline predicts |
| `audit-integrity.test.ts` | 2 | **0** | **left the set, with a known cause** — repaired earlier in this phase by plan 29-05 (`c59fcef`, "move the four unpaired guard tests, raise the module floor, give the registry's non-vacuity a survivable fate"). Confirmed green in isolation here: 44 tests, 44 pass. Not banked as this plan's improvement. |
| `vice-proxy.test.ts` | 41 (lower bound, `MANUAL_ONLY_TESTS`) | not in the automated set | expected — `test:automated` skips it by design |

**No file entered the failing set.** No regression is attributable to this plan.

### Requirement rows: `MCP-01` moved, `MCP-05` deliberately did not

`requirements.ready-ids` reports `MCP-01` ready and `MCP-05` **blocked**, and only `MCP-01`'s row was moved to `Complete` in `.planning/REQUIREMENTS.md`. That is the shared-ID gate working as designed, not an omission: `MCP-05` is declared by **seven** plans in this phase (`29-01`, `29-02`, `29-05`, `29-07`, `29-08`, `29-09`, `29-11`), and `29-09` and `29-11` have not yet produced a SUMMARY. This plan's `MCP-05` obligation — the `ANNO_MODULE_FLOOR` re-point, raised rather than lowered, with its positive control still naming four filenames that exist — is discharged and covered by `D8` above; the row itself moves when the last declaring plan finishes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for 29-09.** The register `anno_search` lives in now exists, which is what C-5's re-point of the skill-coverage script's non-vacuity control depends on. The entry carries a `note` saying so in terms, so a later reader cannot remove it to make a count come out without reading why it is load-bearing.
- **A standing note for 29-10.** `anno-derivation.test.ts`'s upstream-integrity half still compares the manifest's `curated` disposition against `CURATED_ANNO_TOOLS`, imported from the module 29-10 deletes at wave 6. That import was deliberately left alone here, per this plan's own acceptance criterion — 29-10 owns the re-point, names this file in its `files_modified`, and carries the criterion that the comparison must still fail when the manifest and the surface disagree. Do not re-point it early.
- **A standing note for anyone touching the verb surface.** Adding a twentieth verb now requires either a manifest classification or a register entry with a requirement id and a consumer, and the failure names the verb. Retiring a verb requires removing its register entry in the same commit, or `DIRECTION 3 (no orphans)` names it.
- **A standing note for anyone touching the `anno-*.ts` module set.** The floor is now an equality, not just a lower bound. Adding or deleting a production module in that family fails `hostpath-consumers.test.ts` with a message naming every module it found — re-derive the literal deliberately, naming the plan that moved the set.

## Self-Check: PASSED

- `src/mcp/vice/anno-register.ts` — FOUND
- `src/mcp/vice/anno-register.test.ts` — FOUND
- `src/mcp/vice/anno-derivation.test.ts` — FOUND
- `src/mcp/vice/hostpath-consumers.test.ts` — FOUND
- commit `1594c3a` — FOUND
- commit `a403fdb` — FOUND
- commit `904763e` — FOUND

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*
