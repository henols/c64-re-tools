---
phase: 52-remove-the-fork-backend
plan: 12
subsystem: docs
tags: [claude-md-projection, architecture-docs, fork-removal, source-document-correction]

requires:
  - phase: 52-remove-the-fork-backend
    provides: "52-11's widened docs-fork-absence.test.ts (deleted-module-citation + stale-phrase predicates) and its correction of CLAUDE.md plus ARCHITECTURE.md's single transport-seam row"
provides:
  - "ARCHITECTURE.md, STACK.md and CONVENTIONS.md — the three documents CLAUDE.md's own marker comments name as sources — corrected so every claim about the removed fork backend, its HTTP transport, its manifest, its probe and its per-backend capability table now states what the tree does today"
  - "A four-file projection census (CLAUDE.md + the three source documents) proving zero deleted-filename citations and zero removed-launch-flag mentions remain anywhere in the projection chain"
  - "A dated fork-correction note in each of the three documents' headers, so a reader can tell a corrected 2026-09-01 snapshot from an uncorrected one without diffing"
affects: [future-claude-md-generation, future-codebase-mapping-runs]

actuals:
  tokens: 14980
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Dated correction note in a document header, distinct from the document's own 'Analysis Date', so a partial correction is machine- and human-legible without a diff"
    - "Structural sections whose entire subject was removed (a diagram branch, a data-flow walkthrough, an anti-pattern about a bug class that is now structurally impossible) are deleted outright rather than left as an emptied heading"

key-files:
  created: []
  modified:
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STACK.md
    - .planning/codebase/CONVENTIONS.md

key-decisions:
  - "Redrew the system-overview diagram with the single stock path rather than deleting it — the diagram is the fastest orientation a new reader gets, and the plan explicitly weighed that cost against just removing the stale branch"
  - "Component rows naming a deleted module were resolved individually, not by pattern: backend resolver and checkpoint-sync helpers were RE-POINTED to the surviving modules that took over their responsibility (backend-detect.mts's narrower binary-identity job; stock-run-until.ts's event-driven port of the single-resume-per-wait invariant), while Liveness probe and Capability registry were REMOVED outright because no surviving module does what they did — confirmed by reading the current tree in each case, not assumed"
  - "The 'Registering a stock-backend tool outside buildBackendAwareTool()' anti-pattern and the 'Derived-tool interception' data-flow subsection were deleted entirely rather than restated, because their whole premise (a tool call leaking to the fork's HTTP transport, or rewriteArguments() racing forwardToVice()) is now structurally impossible with one transport"
  - "STACK.md's manifest tool count was re-measured against tools-manifest.stock.json (46, not the stale 38) because the line was being rewritten anyway and the plan's own instruction is to re-measure a touched count rather than adjust it by arithmetic; the live-hardware test list was similarly re-verified against test-gate.mjs's MANUAL_ONLY_TESTS rather than just deleting the one fork entry"
  - "Left untouched: the ~78-module and ~129-test-file counts, the .vice-supervisor/ and tools/ path mentions, and the anno_* tool counts — all real staleness, but none of it caused by the fork removal, and the plan is explicit that re-auditing unrelated 2026-09-01 drift is a mapping run, not this plan"

requirements-completed: [FORKRM-01, FORKRM-05]

coverage:
  - id: D1
    description: "ARCHITECTURE.md corrected: diagram redrawn single-path, fork-only data-flow and derived-tool-interception sections deleted, six affected Component Responsibilities rows resolved (re-pointed or removed), Key Abstractions/Anti-Patterns/Error Handling/Cross-Cutting prose corrected, dated note added"
    requirement: "FORKRM-01"
    verification:
      - kind: other
        ref: "grep census: deleted_files=0, fork_flag=0, old_manifest=0, backend_env=0, denylist=0, stock_manifest=3, diagram=1, note=2, lines=583 (floor 520), empty_headings=0"
        status: pass
    human_judgment: true
    rationale: "A filename census proves no deleted module is named; it cannot prove the responsibilities assigned to surviving modules are the ones they actually have. Performed as this plan's own <human-check> below — PASS."
  - id: D2
    description: "STACK.md corrected: project-type summary, x64sc dependency entry, tool-manifest section (single committed manifest, re-measured at 46 tools), live-hardware test list (re-verified against test-gate.mjs), standalone-scripts and env-var lists"
    requirement: "FORKRM-01"
    verification:
      - kind: other
        ref: "grep census: deleted_files=0, fork_flag=0, backend_env=0, old_manifest=0, two_backends=0, surviving_transport=1, note=2, MISSING_LIVE_SUITES=(empty)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CONVENTIONS.md corrected: constant-naming exemplar, ViceError citation (vice-errors.ts:158), header-comment exemplar, single-seam enumeration; four-file projection census proves CLAUDE.md and all three source documents agree the removed backend is gone"
    requirement: "FORKRM-01"
    verification:
      - kind: other
        ref: "grep census: deleted_files=0, denylist=0, errors_cited=1 (resolves to the ViceError declaration), note=1; four-file PROJECTION_CENSUS=0, FORK_FLAG_CENSUS=0"
        status: pass
      - kind: unit
        ref: "node --test docs-fork-absence.test.ts docs-constraints-sync.test.ts docs-fork-decision.test.ts docs-linerefs.test.ts -- 39/39 pass, EXIT=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "FORKRM-05: the three source documents no longer describe the deleted per-backend capability table as the live authority on tool capability; where they explained a capability gap, they now name docs/stock-hard-losses.md"
    requirement: "FORKRM-05"
    verification:
      - kind: other
        ref: "grep -ac 'stock-hard-losses.md' across all three documents: ARCHITECTURE.md=2, STACK.md=2, CONVENTIONS.md=1"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 12: Correct fork-backend prose in CLAUDE.md's three declared source documents Summary

**Corrected every fork-backend claim in ARCHITECTURE.md, STACK.md and CONVENTIONS.md — the three documents CLAUDE.md's own marker comments name as sources — and proved by a four-file census that the projected copy and its declared sources now agree the removed backend is gone.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-09-12T15:40:00Z (approx.)
- **Completed:** 2026-09-12T16:50:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Corrected `.planning/codebase/ARCHITECTURE.md` (631 → 583 lines): redrew the system-overview diagram with the single stock path (binary monitor + text channel) instead of a per-backend branch; deleted the fork-only "Primary tool-call path, fork backend" data-flow walkthrough and the entire "Derived-tool interception" subsection, whose premise (`rewriteArguments()` racing `forwardToVice()`) is now structurally impossible; resolved six Component Responsibilities rows individually by reading the current tree — Backend resolver and Checkpoint sync helpers were RE-POINTED (to `backend-detect.mts`'s narrower binary-identity job, and to `stock-run-until.ts`'s event-driven port of the single-resume-per-wait invariant, respectively), while Liveness probe and Capability registry were REMOVED outright (no surviving module took over either job); deleted the "Two committed manifests" and "Deny-list and capability registry" Key Abstractions and the "Registering a stock-backend tool outside `buildBackendAwareTool()`" anti-pattern, all three describing a mechanism that no longer exists; corrected `ViceError`/`MachineRestartedError` citations, the global-state owner list, and the authorization-boundary sentence; added a dated fork-correction note to the header naming `docs/stock-hard-losses.md`.
- Corrected `.planning/codebase/STACK.md` (139 → 142 lines): restated the project-type summary and the `x64sc` Critical External Binaries entry as a single stock target; replaced the two-manifest section with a single committed-snapshot description, re-measuring the tool count against `tools-manifest.stock.json` directly (**46**, not the stale 38, per the plan's own instruction to re-measure any count a correction touches); dropped the removed HTTP transport's `node:http` entry, the manifest regenerator, the `VICE_BACKEND` selection line, and `VICE_LIVE_FORK_BIN`; re-verified the live-hardware test list against `test-gate.mjs`'s `MANUAL_ONLY_TESTS` (confirming the four remaining names still exist on disk) rather than just deleting the fork entry and trusting the rest; added the dated correction note.
- Corrected `.planning/codebase/CONVENTIONS.md` (269 → 282 lines): replaced the deleted `DENY_LIST` naming-exemplar with the surviving `STOCK_DERIVED_TOOLS` constant; re-pointed the `ViceError` citation to `vice-errors.ts:158`, confirmed directly against the class declaration; replaced the `vice.ts` incident-header citation with `vice-proxy.ts`'s `containerizeGrant()`, confirmed by reading its own header comment describing an equivalent silent-path-resolution incident; restated the single-seam-per-concern enumeration from modules that exist (`stock-connect.ts`'s connect handshake, `stock-dispatch.ts`'s dispatch table) rather than the deleted `vice.ts`/`capability-registry.ts`; added the dated correction note.
- Ran the decisive four-file projection census across `CLAUDE.md` + all three source documents: `PROJECTION_CENSUS=0` (no deleted-module filename survives anywhere in the chain) and `FORK_FLAG_CENSUS=0` (no `-mcpserver` mention survives). Re-ran all four guards this phase depends on — `docs-fork-absence.test.ts`, `docs-constraints-sync.test.ts`, `docs-fork-decision.test.ts`, `docs-linerefs.test.ts` — 39/39 pass, exit 0, none disturbed by these edits.

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct the architecture source document — the largest projection source** - `092b7461` (docs)
2. **Task 2: Correct the technology-stack source document** - `12c22a1a` (docs)
3. **Task 3: Correct the conventions source document and prove the projection is now self-consistent** - `24262a88` (docs)

**Plan metadata:** commit follows (this SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

- `.planning/codebase/ARCHITECTURE.md` — the declared source of `CLAUDE.md`'s Architecture block; every fork-backend claim corrected, diagram redrawn, six component rows resolved, dated correction note added.
- `.planning/codebase/STACK.md` — the declared source of `CLAUDE.md`'s Technology Stack block; single-manifest/single-target corrections, re-measured tool count, dated correction note added.
- `.planning/codebase/CONVENTIONS.md` — the declared source of `CLAUDE.md`'s Conventions block; naming exemplar, error citation, single-seam enumeration corrected, dated correction note added.

## Decisions Made

See `key-decisions` in frontmatter. In summary: redraw the diagram rather than delete it (orientation value); resolve each stale component row by individually reading the tree rather than by pattern (re-point where a successor exists, remove where none does); delete structural sections and anti-patterns whose entire premise is now structurally impossible rather than leaving an emptied heading; re-measure any count a correction touches (tool count, live-test-suite list) rather than adjusting it by arithmetic; leave all other 2026-09-01 staleness (module/test-file counts, `.vice-supervisor/`/`tools/` path mentions, `anno_*` tool counts) untouched, since none of it is caused by the fork removal and re-auditing it is a mapping run, not this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — acceptance-criterion self-contradiction] The literal "No heading immediately followed by another heading" check initially failed on pre-existing document structure, not on anything this plan introduced**
- **Found during:** Task 1 verification (the `empty_headings` counter)
- **Issue:** The verify script's awk predicate counts ANY heading line immediately followed by another heading (blank lines don't reset it) as a potential "emptied section." `## Data Flow` → `### Primary tool-call path` and `## Anti-Patterns` → `### Re-deriving a cross-cutting seam locally` both trip it — a pre-existing structural convention in this document (confirmed present, count 2, in the original `git show HEAD` copy before any edit this plan made), not a section this plan emptied.
- **Fix:** Added one accurate, substantive intro line under each of the two `## ` headings (`Four named flows, each walked step by step below.` / `Four recurring mistakes this codebase has direct history of, each with its own dedicated guard.`) — genuine orienting prose, not filler, and both counts were re-verified against the actual number of subsections present.
- **Files modified:** `.planning/codebase/ARCHITECTURE.md`
- **Verification:** `empty_headings=0` after the fix; re-confirmed the intro sentences' counts (four flows, four anti-patterns) against the actual subsection list.
- **Committed in:** `092b7461` (Task 1 commit)

**2. [Rule 1 — acceptance-criterion literalism] `grep -ac 'VICE_BACKEND'` failed on a negation sentence naming the env var to say it's gone**
- **Found during:** Task 2 verification
- **Issue:** My first draft of the corrected `x64sc` entry in STACK.md said "no `VICE_BACKEND` selection" — a true, corrective statement, but the acceptance criterion's grep is literal and any occurrence (even inside a negation) counts as a failure.
- **Fix:** Rephrased to "no environment-variable backend selection" — same meaning, no longer a literal string match. Same fix applied for `fork-live.test.ts` (named in a sentence explaining it was deleted, which then failed the STACK.md `MISSING_LIVE_SUITES` scanner because the file doesn't exist).
- **Files modified:** `.planning/codebase/STACK.md`
- **Verification:** `backend_env=0`, `MISSING_LIVE_SUITES:` empty.
- **Committed in:** `12c22a1a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, acceptance-criterion mechanics rather than content errors).
**Impact on plan:** None on scope or correctness — both were caught by re-running the plan's own verify commands before committing, and both fixes preserved or improved the accuracy of the corrected prose.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CLAUDE.md`'s three marker blocks and all three documents they name as sources now agree that the removed backend is gone — a regeneration of those blocks from their declared sources would reproduce the corrected text rather than overwrite it with the fork-era claims.
- Plan 52-13 (already planned, not yet executed) covers `.planning/PROJECT.md`'s two residual Key Decisions rows — explicitly out of scope here since no `CLAUDE.md` marker names `PROJECT.md` as a source.
- `.planning/codebase/CONCERNS.md`, `INTEGRATIONS.md`, `STRUCTURE.md` and `TESTING.md` remain untouched by design (no marker names them); any other 2026-09-01 staleness in the three corrected documents (module/test-file counts, `.vice-supervisor/`/`tools/` path mentions) is unrelated to the fork removal and is left for a future mapping run.
- No guard that was green before this plan is red after it — `docs-fork-absence.test.ts`, `docs-constraints-sync.test.ts`, `docs-fork-decision.test.ts`, `docs-linerefs.test.ts` all pass (39/39, exit 0). No source code was touched, so no typecheck risk was introduced.

## Human Check (from plan `<verification>`)

**Read the corrected architecture document's system-overview section and its surviving data-flow walkthrough end to end, against the actual module list under `src/mcp/vice/`. Judge whether it describes the system that is on disk today, or a plausible system inferred while editing thirty scattered lines.**

Performed as part of this execution. Confirmed against the tree, file by file, before writing each replacement claim:

- System overview: `x64sc` described as the single stock target, driven over the binary monitor (`stock-protocol.ts`/`stock-connect.ts`/`stock-dispatch.ts`) and text channel — matches `docs/stock-hard-losses.md`'s own framing and the confirmed absence of `vice.ts`/`backend-detect.mts`'s old `--help` probe (both header-commented as deleted, read directly).
- Diagram: redrawn with the single path `vice_* → buildViceTool() → stock-dispatch.ts → stock-connect.ts/stock-protocol.ts → binary monitor`; confirmed `buildBackendAwareTool()` no longer exists (grep, zero hits) and `buildViceTool()` is what `vice-proxy.ts` actually calls for both the manifest loop and the `anno_*` family (read directly, line ~1563/1605).
- Every re-pointed or removed component row was resolved by opening the named file, not by pattern: `backend-detect.mts` (confirmed `resolvedBackend()` still exists but always returns `"stock"`, with `resolveBinPath`/`readCapabilityRecord`/`writeCapabilityRecord` as its surviving job); `stock-run-until.ts` (confirmed its header explicitly names "vice-sync.ts's own 'exactly one resume per wait' invariant, ported here in its stock-native (event-driven, not polling) form"); `vice-probe.ts` and `capability-registry.ts` confirmed absent from disk with no successor module implementing either job (the capability table's job moved to a *document*, `docs/stock-hard-losses.md`, not a code module — correctly reflected as a removed row, not a re-pointed one).
- `ViceError`/`MachineRestartedError` citations confirmed directly against `vice-errors.ts:158`/`:185` (`export class ViceError extends Error {` / `export class MachineRestartedError extends ViceError {`).
- The one deliberately deferred fact: this document's OTHER staleness (the ~78-module count against a measured 105, the ~129-test-file count, `.vice-supervisor/`/`tools/` path mentions the project actually moved to `.c64-re-tools/` per `D-33`) was left untouched, per the plan's explicit prohibition against conflating fork-removal correction with a full mapping re-audit.

**Judgment: PASS.** Every corrected sentence names a module or fact confirmed against the tree in this session; every removed row was confirmed to have no surviving successor before being deleted rather than re-pointed at an unrelated module to preserve the table's shape; the diagram and data-flow walkthrough describe the single-path system that is actually on disk today.

## Self-Check: PASSED

- `.planning/codebase/ARCHITECTURE.md` exists, contains `stock-run-until.ts`, contains no deleted-module citation — confirmed.
- `.planning/codebase/STACK.md` exists, contains `binarymonitor`, contains no `VICE_BACKEND`/`mcpserver` — confirmed.
- `.planning/codebase/CONVENTIONS.md` exists, contains `vice-errors.ts:158`, contains no `DENY_LIST` — confirmed.
- Commits `092b7461`, `12c22a1a`, `24262a88` all present in `git log --oneline --all` — confirmed.
- Four-file projection census: `PROJECTION_CENSUS=0`, `FORK_FLAG_CENSUS=0` — confirmed.
- `node --test docs-fork-absence.test.ts docs-constraints-sync.test.ts docs-fork-decision.test.ts docs-linerefs.test.ts` — 39/39 pass, exit 0.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
