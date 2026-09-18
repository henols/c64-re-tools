---
phase: 59-the-tool-location-seam-and-its-precedence-order
plan: 05
subsystem: infra
tags: [tool-location, path-resolution, build-pipeline, host-bound-module, documentation, citation-ledger]

# Dependency graph
requires:
  - phase: 59-the-tool-location-seam-and-its-precedence-order
    provides: "resolveTool()/validateToolsFile()'s completed refusal contract, the fully-declared prerequisites.json (plans 59-01/59-02/59-03/59-04)"
provides:
  - "toolsFileTemplate(resolved, deps): string -- the .c64-re-tools/tools.json template as an export the doctor (Phase 61, DOCTOR-08) calls with paths it itself resolved, never a committed static example"
  - "The seam's own module header documents both deliberate exclusions (VICE_BROKER_NODE, dxa) with their reasons, satisfying ROADMAP criterion 4's written-documentation half"
  - "docs/phase59-tool-location-placement.md -- the written answer to ROADMAP criterion 5: the seam wraps the existing resolver externally, why, the five-item bill Phase 60 pays, and the six planner decisions (D-12..D-17) this phase added"
  - "phase58-citation-ledger.test.ts now audits a second document through the same exported auditProvenanceCitations()/parseCitationLedger()/extractCitations() -- no second ledger implementation"
affects: [60-rewire-every-live-resolution-path-through-the-seam, 61-the-doctor]

# Actuals (#2632)
actuals:
  tokens: 7626
  tasks: 2
  commits: 2
plan_head_before: 882ce4cebf3ca07d13a7d02e5542d8cec9d2d558

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toolsFileTemplate() reuses the module's existing readDeclaration() reader and here override -- no second declaration reader, matching D-12's locked bare-string tools.json value shape"
    - "A second phase-provenance document audited by the same generic auditProvenanceCitations() exported from phase58-citation-ledger.test.ts, rather than a second ledger implementation"

key-files:
  created:
    - docs/phase59-tool-location-placement.md
  modified:
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/resources/tool-location.mjs
    - src/mcp/vice/phase58-citation-ledger.test.ts

key-decisions:
  - "toolsFileTemplate() emits the three reserved keys (_readme, _viceBrokerNode, _dxa) unconditionally, then one bare-string key per resolved id the declaration both knows and marks fileOverridable, in declaration order -- matching the plan's locked shape exactly, with no path invented for an id the caller did not resolve."
  - "The placement document's citation-ledger anchor for 59-CONTEXT.md:55-57 was corrected from a paraphrase (\"Phase 60 must decide whether\") to the live text's exact wording (\"Phase 60 must decide there whether\") after the newly-added citation-ledger test case caught the drift on its first run -- exactly the mechanism this ledger exists to provide, exercised on this plan's own first draft rather than merely on the Phase 58 precedent it cites."

requirements-completed: [LOC-05, LOC-06, LOC-07]

coverage:
  - id: D1
    description: "toolsFileTemplate(resolved, deps) exports the tools.json template: the empty map yields exactly the three reserved keys, a resolved id is emitted as a bare string, an excluded id (dxa/node) is never emitted even when present in the map, the two reasons are read from the declaration (not duplicated as literals), and the output round-trips through validateToolsFile() with zero problems"
    requirement: "LOC-05, LOC-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate({}) returns exactly the three reserved keys and no tool id"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate with one resolved id emits it as a bare string alongside the three reserved keys, and nothing else"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: _viceBrokerNode quotes the node record's declared reason verbatim and names VICE_BROKER_NODE as the route instead"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: _dxa quotes the dxa record's declared reason verbatim"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: pointing here at a scratch declaration with different reason strings changes both prose values, proving neither sentence is a literal in the module"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: an id the declaration says may not be named by the file is omitted even when present in resolved"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: an id the declaration does not know at all is silently omitted, not emitted"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: the returned string ends with a newline and two calls with identical inputs return identical strings"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#toolsFileTemplate: writing its output to a scratch tools.json whose named path exists and satisfies its kind yields zero problems from validateToolsFile()"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#compiled artifact: toolsFileTemplate produces the same three reserved keys as the unbuilt source"
        status: pass
    human_judgment: false
  - id: D2
    description: "The module header documents both exclusions (VICE_BROKER_NODE, dxa) with their reasons, satisfying criterion 4's written-documentation half; no tools.json.example is committed anywhere"
    requirement: "LOC-07"
    verification:
      - kind: unit
        ref: "git ls-files grep for tools.json.example -- (none)"
        status: pass
      - kind: unit
        ref: "grep for the module's exported-function set (resolveTool, resolveOnPath, validateToolsFile, toolsFileTemplate) and import-specifier set (node:fs, node:path, node:url)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/phase59-tool-location-placement.md answers ROADMAP criterion 5 in writing: the external shape, the first-regeneration reason naming Phase 60, a five-item numbered bill, and the six D-12..D-17 decisions"
    requirement: "LOC-05, LOC-06, LOC-07"
    verification:
      - kind: unit
        ref: "grep -aci 'wraps .*externally' docs/phase59-tool-location-placement.md == 1"
        status: pass
      - kind: unit
        ref: "grep -acE '^[1-9]\\. ' docs/phase59-tool-location-placement.md == 5"
        status: pass
      - kind: unit
        ref: "grep -acE '^- \\*\\*D-1[2-8]' docs/phase59-tool-location-placement.md == 6"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every citation in the new document has a ledger entry whose anchor is verified against the live cited text, and the ledger is complete/non-vacuous/no-orphans in both directions, through the pre-existing auditProvenanceCitations() -- no second implementation"
    requirement: "LOC-05, LOC-06, LOC-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/phase58-citation-ledger.test.ts#the committed phase59 placement document's citation ledger is complete and every anchor resolves"
        status: pass
      - kind: unit
        ref: "grep for exactly one export each of auditProvenanceCitations/parseCitationLedger/extractCitations in phase58-citation-ledger.test.ts, and git ls-files confirming no second ledger-named file"
        status: pass
    human_judgment: false

duration: approx 50 min
completed: 2026-09-18T12:10:00Z
status: complete
---

# Phase 59 Plan 05: The `tools.json` Template as an Export, and the Placement Record Summary

**`toolsFileTemplate()` builds the `.c64-re-tools/tools.json` text a doctor will write from paths it itself resolved — never a committed static example — and `docs/phase59-tool-location-placement.md` answers ROADMAP criterion 5 in writing, its citations audited by the same ledger machinery `docs/phase58-declaration-provenance.md` already uses.**

## Performance

- **Duration:** approx 50 min
- **Completed:** 2026-09-18T12:10:00Z
- **Tasks:** 2 (Task 1: `tdd="true"`; Task 2: `type="auto"`)
- **Files modified:** 5 (`tool-location.mts`, `tool-location.test.ts`, `resources/tool-location.mjs`, `phase58-citation-ledger.test.ts`, plus the new `docs/phase59-tool-location-placement.md`)

## Accomplishments
- `toolsFileTemplate(resolved, deps): string` added to `tool-location.mts`: emits the three reserved prose keys (`_readme`, `_viceBrokerNode`, `_dxa`) unconditionally — the last two quoting the `node`/`dxa` records' own declared `reason` fields verbatim, read from the declaration at call time — then one bare-string key per entry in `resolved` whose id the declaration both knows and marks `fileOverridable`, in declaration order. An id the caller did not resolve is never invented; an id the declaration excludes (`dxa`, `node`) or does not know at all is silently omitted.
- The module's own header now states both exclusions in prose (the `VICE_BROKER_NODE`/bash-before-Node reason, and the vendored-and-built-by-this-project `dxa` reason), satisfying ROADMAP criterion 4's "documented in the written template **and** in the seam's own documentation" half in full.
- The template round-trips: writing its output to a scratch `tools.json` with a real, executable path yields zero problems from `validateToolsFile()`, proving this project never tells a user to write a file its own validator refuses.
- `docs/phase59-tool-location-placement.md` states the seam wraps the existing resolver externally and edits no existing host-bound module; gives the first-regeneration reason, naming Phase 60; itemises a five-point bill (the two-places precedence order, the three coexisting `$PATH`-walk copies with file-and-line citations for all three, `resolvedBackend()`'s open final-role question, the three unproduced mechanisms, and the pending artifact regeneration); and records the six decisions (D-12 through D-17) this phase's plans added beyond `59-CONTEXT.md`'s original eleven, each with its own reasoning and cost.
- `phase58-citation-ledger.test.ts` gained a second audited document via its already-exported `auditProvenanceCitations()`, mirroring the existing committed-document case with a different `docPath` — no second ledger implementation, and the file was not renamed.
- Every file-and-line citation in the new document carries a ledger entry whose anchor was verified by reading the cited lines, not by recalling them — the citation-ledger test itself caught one drifted anchor on its first run (see Deviations) before this plan's own document ever reached a green state.

## Task Commits

1. **Task 1: The template the doctor will emit, and the exclusions written where a reader looks** — `72b7f281` (feat)
2. **Task 2: The placement record — which shape the seam took, and the bill Phase 60 pays** — `eee67456` (docs)

**Plan metadata:** commit hash recorded below after this file and STATE/ROADMAP/REQUIREMENTS are committed.

_Task 1 carried `tdd="true"`. RED was confirmed genuine: the implementation was temporarily replaced with a deliberately-wrong stub (`return "{}\n";`) and the full new test suite re-run, confirming 6 of 10 new cases failed on their target assertions (the reserved-key-shape, one-resolved-id, both reason-quoting, reason-substitution, and compiled-artifact cases) while 4 already passed vacuously against the stub's trivially-empty output (the exclusion-omission, unknown-id-omission, newline/determinism, and round-trip-validation cases — each of which the stub's `{}` output satisfies by construction, not by the real implementation being present). The real implementation was then restored and all 54 tests in the file passed. No separate REFACTOR commit was needed._

## Files Created/Modified
- `src/mcp/vice/tool-location.mts` — `toolsFileTemplate()` and `ToolsFileTemplateDeps` added; module header extended to document both exclusions with their reasons
- `src/mcp/vice/tool-location.test.ts` — 10 new colocated tests for the template's shape, reason-quoting, reason-substitution, exclusion/unknown-id omission, determinism/newline, the validator round-trip, and the compiled-artifact equivalent
- `src/mcp/vice/resources/tool-location.mjs` — regenerated compiled artifact, committed
- `docs/phase59-tool-location-placement.md` — new: the criterion-5 placement record with its own `## Citation ledger` section
- `src/mcp/vice/phase58-citation-ledger.test.ts` — header updated to record it now audits more than one document; one new test case auditing the new document via the pre-existing exported functions

## Decisions Made
- **`toolsFileTemplate()`'s emission order and omission rules follow the plan's locked shape exactly** — see frontmatter `key-decisions` for the full statement.
- **The placement document's ledger anchor for `59-CONTEXT.md:55-57` was corrected after the new citation-ledger test case caught a paraphrase drift on its first run** — see frontmatter `key-decisions` and Deviations below.
- Everything else followed the plan as written: the locked template shape, the six D-12..D-17 decisions carried verbatim from plans 59-01 through 59-03, the citation-ledger reuse contract (`D-18`), none reopened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A placement-document citation anchor paraphrased its cited line instead of quoting it verbatim**
- **Found during:** Task 2, first run of the new `phase58-citation-ledger.test.ts` case against the freshly-written document
- **Issue:** The ledger entry for `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-CONTEXT.md:55-57` used the anchor `"Phase 60 must decide whether \`resolvedBackend()\` is reduced to"`, but the live text at those lines reads `"Phase 60 must decide **there** whether \`resolvedBackend()\` is reduced to"` — a one-word paraphrase drift introduced while drafting the document from memory of an earlier read rather than a fresh one.
- **Fix:** Corrected the anchor string in `docs/phase59-tool-location-placement.md`'s Citation ledger to the exact live text, re-verified by reading the cited lines directly with `sed -n '53,58p'` immediately before the fix.
- **Files modified:** `docs/phase59-tool-location-placement.md`
- **Verification:** `node --test phase58-citation-ledger.test.ts` — the new case (`"the committed phase59 placement document's citation ledger is complete and every anchor resolves"`) passed after the fix, with only the pre-existing, unrelated Phase 58 failure remaining
- **Committed in:** `eee67456` (Task 2 commit — the anchor was corrected before this task's single commit, so no separate fix-up commit exists)

---

**Total deviations:** 1 auto-fixed (1 bug fix, scope-internal to this task's own new document)
**Impact:** No scope creep — this is exactly the failure mode `ENGINEERING_RULES.md` §6 and this plan's own `<threat_model>` (T-59-20) require a planted-violation-style catch for, caught by the mechanism this plan built rather than by a later human review pass.

## Issues Encountered

**The one known pre-existing failure, unrelated to this plan, persists exactly as documented in plans 59-01 through 59-04's SUMMARYs.** `phase58-citation-ledger.test.ts`'s `"the committed provenance document's citation ledger is complete and every anchor resolves"` (the Phase 58 document's own case) fails because a citation in `docs/phase58-declaration-provenance.md` points at `.planning/ROADMAP.md:1980-1983` for the anchor `"a user missing ACME learns that"`, but that text now lives further down the file as `ROADMAP.md` has grown across four sibling plans' edits. Neither `ROADMAP.md`, `phase58-citation-ledger.test.ts`'s pre-existing case, nor `docs/phase58-declaration-provenance.md` is in this plan's `files_modified`, and per this plan's own explicit instruction this was NOT repaired here — repairing it would touch a document outside this plan's declared scope and risk weakening the very guard this plan extends. It was already logged in `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md` and `.planning/WINDOWS.md` entry 68 by plan 59-01; not re-logged.

`npm run typecheck` exits 0. Full `npm test`, run with no VICE broker process on the host, reports 3942 total (3860 pass, 1 fail, 81 skipped) — the one known pre-existing failure named above and no other. A separate `npm run test:automated` run during Task 1's verification transiently showed a second, unrelated failure in `anno-tools.test.ts`'s `"Task 3 Test 3: the store file replaced between the existence check and the open refuses by name, writing nothing"` case; re-running that file alone (105/106... 106/106 actually — confirmed 106 pass, 0 fail) and re-running the full gate both showed it passing, confirming a transient load flake unrelated to this plan's files, not a regression this plan introduced.

## Known Stubs

None — no stub patterns (hardcoded empty values flowing to UI, placeholder text, unwired components) apply to this plan. `toolsFileTemplate()` is a pure string builder nothing calls yet by design (D-01, carried from plan 59-01), and the placement document is prose describing an already-completed decision, not a stand-in for future code.

## Threat Flags

None beyond what the plan's own `<threat_model>` already scoped (T-59-18 through T-59-21, T-59-SC) — no new surface was introduced outside that register. T-59-18 (an invented path in the template) and T-59-19 (a template the validator would refuse) are both directly exercised by this plan's tests; T-59-20 (a wrong citation) was caught in this exact plan's own document by the mechanism it builds on, and is recorded above under Deviations rather than merely described in the abstract; T-59-21 (a second static template example) is exercised by the `tools.json.example` absence check.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 59 is now fully complete: all five plans executed, all three of its requirements (`LOC-05`, `LOC-06`, `LOC-07`) closed.
- `resolveTool()`, `validateToolsFile()` and `toolsFileTemplate()` are all proven, compiled, and exported — Phase 60 can rewire every live callsite (`backend-detect.mts`, `host-tool.mts`'s `findAcmeLib()`/`findDxaBinary()`/`findSiblingBinary()`/the `ghidra.analyze` `GHIDRA_HOME` read) through `resolveTool()`, and Phase 61's doctor can call `toolsFileTemplate()` with paths it resolved through the same seam.
- `docs/phase59-tool-location-placement.md` gives Phase 60 its own itemised bill rather than requiring it to reconstruct one from this phase's diff.
- Nothing calls this seam yet, which is correct per D-01 — Phase 60 owns wiring it in.
- No blockers. The one open item remains the pre-existing, unrelated citation-ledger drift in the Phase 58 document, documented above and in `WINDOWS.md` entry 68 across all five of this phase's plans — not a blocker for Phase 60, and explicitly left for the phase gate that owns cross-phase documentation debt to pick up.

## Self-Check: PASSED

- Both key files (`docs/phase59-tool-location-placement.md`, and the four modified `tool-location.*`/`phase58-citation-ledger.test.ts` files) verified present on disk with `[ -f ]`.
- Both commit hashes (`72b7f281`, `eee67456`) verified present via `git log --oneline --all`.
- Re-ran `node --test tool-location.test.ts` (54/54 pass), `node --test phase58-citation-ledger.test.ts` (10/11 pass — the one pre-existing, documented Phase 58 failure and no other), `node --test resources-sync.test.ts` (pass), and `npm run typecheck` (exit 0) immediately before writing this section.
- Re-ran every one of Task 1's and Task 2's embedded `<verify>` gate scripts exactly as written; all reported the expected values (exported-function/import-specifier sets, no `tools.json.example` tracked anywhere, ledger-heading/external-answer/numbered-cost-items/decisions-recorded counts, all 14 citation paths resolving, exactly one implementation each of the three ledger functions).
- `git rev-list --count 882ce4ce..HEAD` measured `2`, matching `actuals.commits` and the two commits listed above.
