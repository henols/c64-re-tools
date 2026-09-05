---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 01
subsystem: annotation-store
tags: [ghidra-export, anno-store, memmap-json, mcp-tool-surface, node-sqlite]

# Dependency graph
requires:
  - phase: 28-the-store-core
    provides: "putXref()/listXrefs()/setComment()/listComments() and the single node:sqlite seam"
  - phase: 29-the-mcp-surface
    provides: "ANNO_TOOL_DEFINITIONS extension point, anno-register.ts's D-08 registration discipline"
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "GhidraStructExport.java's fixed ## -delimited section format, incl. ## REFERENCES"
provides:
  - "anno_import_ghidra_export: a container-side importer reading a host-written transfer file"
  - "anno_join_memmap: a mechanical join annotating stored cross-references against memmap.json"
  - "memmap-lookup.ts: memmap.json loader, sha256 digest, narrowest-containing-range selection"
affects: ["37-02", "37-03", "37-04", "37-05", "37-06", "37-07", "37-08"]

# Actuals (#2632)
actuals:
  tokens: 20362
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Namespace import (`import * as fs from \"node:fs\"`) to keep a grep-counted literal token to exactly one call site"
    - "Test-only injection point (deleteFile) on a production function, defaulting to the real syscall, for deterministic failure-path testing without relying on filesystem permission enforcement"
    - "Whole-call optimistic-concurrency precondition (assertNotStale) for a multi-write verb, instead of threading base_revision through every individual write"

key-files:
  created:
    - src/mcp/vice/anno-import.ts
    - src/mcp/vice/anno-import.test.ts
    - src/mcp/vice/anno-join.ts
    - src/mcp/vice/anno-join.test.ts
    - src/mcp/vice/memmap-lookup.ts
    - src/mcp/vice/memmap-lookup.test.ts
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-register.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/anno-confinement.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/skills/c64-program-recon/SKILL.md

key-decisions:
  - "Two new ANNO_TOOL_DEFINITIONS entries (anno_import_ghidra_export, anno_join_memmap), no new tool family, no new CLI verb -- per D-37-01"
  - "The reserved bank column stays null on every row this plan writes -- per D-37-02"
  - "Unrecognised Reference.getReferenceType() tokens are dropped and counted in kindsSeenNotImported, never refused -- per D-37-05"
  - "deleteFile injection point added to importGhidraExport()'s args, defaulting to the real unlinkSync, so the delete-fails-after-commit path is testable without depending on filesystem permission enforcement (root ignores chmod)"

patterns-established:
  - "A grep-counted single-call-site invariant (e.g. exactly one unlinkSync) is satisfied by routing every other use of that fs function through the same namespace import, never a second named import"

requirements-completed: [IMP-01, IMP-02, AUTO-01]

coverage:
  - id: D1
    description: "anno_import_ghidra_export parses a Ghidra transfer file, writes typed cross-reference rows via putXref(), and deletes the transfer file strictly after every write has durably committed"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-import.test.ts#tracer: import writes an anno_xref row that survives close+reopen..."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-import.test.ts#importGhidraExport: when the delete step itself throws..."
        status: pass
    human_judgment: false
  - id: D2
    description: "The transfer file is transient evidence: digested from one read, deleted only after commit, refused by name on malformed/truncated/digest-mismatched input with nothing written or deleted"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-import.test.ts#importGhidraExport: an expectedSha256 mismatch refuses..."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#20/21 (export_path confinement, .. and symlink)"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno_join_memmap mechanically annotates stored cross-references against memmap.json's narrowest containing entry, with no agent call, no queue walk and no skill invocation -- checked structurally over the module graph"
    requirement: "AUTO-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#the join's module graph ... imports nothing under the skills tree, spawns no child process, and references no queue module"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#addressesConsidered equals the sum of..."
        status: pass
    human_judgment: false
  - id: D4
    description: "memmap-lookup.ts loads and caches memmap.json, computes its sha256 provenance digest, and selects the narrowest containing entry for an address"
    requirement: "AUTO-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup.test.ts#selectMemmapEntry(0xd020): resolves to the 1-byte border-colour entry..."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup.test.ts#memmapDigest(): equals the _generated.memmapSha256 value..."
        status: pass
    human_judgment: false

duration: 60min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 01: Import Ghidra cross-references and join them against memmap.json Summary

**A host-written Ghidra export text file is imported by one tool call into typed `anno_xref` rows, then joined by a second tool call against `c64-memory-mapping/memmap.json`'s 959 entries into comment rows — both mechanical, both proven by a close-and-reopen read-back, never by a call's own return value.**

## Performance

- **Duration:** ~60 min (estimated; not captured at session start)
- **Started:** ~2026-09-05T05:15:00Z (estimated)
- **Completed:** 2026-09-05T06:10:00Z
- **Tasks:** 3
- **Files modified:** 12 (6 created, 6 modified) across `src/mcp/vice/` and `src/skills/c64-program-recon/`

## Accomplishments

- `anno-import.ts` parses `GhidraStructExport.java`'s `## `-delimited transfer file in one forward pass, maps Ghidra's `ReferenceType` vocabulary onto the store's frozen four-member `XrefAccessKind` (dropping and counting unrecognised kinds rather than refusing or guessing), writes every surviving reference via `putXref()`, and deletes the transfer file in the single statement after the last write has durably committed
- `memmap-lookup.ts` loads and caches `memmap.json`'s 959 entries, computes its sha256 digest (asserted equal to `anno-regbits.json`'s own committed banner value, never pinned as a literal), and implements narrowest-containing-range selection — proven against the real 8-way `$D020` overlap
- `anno-join.ts` mechanically joins every distinct stored cross-reference target against `memmap.json`, skipping addresses inside the caller's own loaded image range, and writes one comment per resolved address — with a source-level structural scan proving no import reaches the skills tree, no child process is spawned, and no queue module is referenced anywhere in the three modules' own code
- Two new `anno_*` tools (`anno_import_ghidra_export`, `anno_join_memmap`) registered in the existing `ANNO_TOOL_DEFINITIONS` array with matching `anno-register.ts` entries citing `IMP-01`/`IMP-02`/`AUTO-01`; no new tool family, no new CLI verb, no new store column
- `export_path`'s workspace confinement goes through the same `resolveWorkspacePath()` the `store`/`image` arguments use, with two new `anno-confinement.test.ts` cases (`..` escape, workspace-internal symlink to an outside target) hand-confirmed to redden when the resolve call is removed
- `c64-program-recon/SKILL.md` documents both tools, the import-then-join order, and states plainly that neither call takes an agent turn — with no reference to the queue-walker skill in the describing paragraph, and the `installer/skills/` mirror regenerated byte-identical

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — a host-written export file becomes an annotation read back out of the store** - `ba329774` (feat)
2. **Task 2: The importer refuses loudly, confines its path, and never deletes before it commits** - `9517a2f4` (fix)
3. **Task 3: AUTO-01's counts, and the structural proof that no agent, queue or skill is in the loop** - `7cda46df` (test)

_Note: no separate plan-metadata commit exists yet — this SUMMARY and the STATE.md/ROADMAP.md updates land in the final `docs(37-01):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/anno-import.ts` - Ghidra transfer-file parser and importer; `parseGhidraExport`, `importGhidraExport`, `GHIDRA_REFTYPE_TO_ACCESS_KIND`, `AnnoImportError`
- `src/mcp/vice/anno-import.test.ts` - tracer end-to-end case, parser unit cases, confinement/digest/malformed-line/unlink-failure cases, registration-surface cases
- `src/mcp/vice/anno-join.ts` - `runMemmapJoin()`, the mechanical join over `listXrefs()`/`memmap.json`/`setComment()`
- `src/mcp/vice/anno-join.test.ts` - count-identity, decisions-completeness, double-run and the structural no-agent/no-queue/no-skill scan (with its own non-vacuity control)
- `src/mcp/vice/memmap-lookup.ts` - `loadMemmap`, `memmapDigest`, `selectMemmapEntry`, `BANK_CONDITIONAL_RANGES`, `MEMMAP_PATH`
- `src/mcp/vice/memmap-lookup.test.ts` - dedicated unit cases for the loader, digest and selection rule
- `src/mcp/vice/anno-tools.ts` - two new `ANNO_TOOL_DEFINITIONS` entries, validators and dispatch arms for `anno_import_ghidra_export`/`anno_join_memmap`, plus `assertNotStale()`'s whole-call `base_revision` precondition
- `src/mcp/vice/anno-register.ts` - two new `ANNO_VERB_REGISTER` entries citing `IMP-01`/`IMP-02` and `AUTO-01`
- `src/mcp/vice/package.json` - `files[]` gained `anno-import.ts`, `anno-join.ts`, `memmap-lookup.ts`
- `src/mcp/vice/anno-confinement.test.ts` - two new cases (20, 21) for `export_path` confinement through `runAnnoTool()`
- `src/mcp/vice/hostpath-consumers.test.ts` - `ANNO_MODULE_FLOOR` raised from 17 to 19, naming this plan
- `src/skills/c64-program-recon/SKILL.md` - new subsection naming both tools, the import-then-join order, and their mechanical nature

## Decisions Made

- **Namespace `import * as fs from "node:fs"` in `anno-import.ts`.** A later acceptance gate greps the file for the literal token `unlinkSync` and requires it on exactly one non-comment line — a named `import { unlinkSync }` would itself be a second match. Every `fs` function this module uses is reached through the one namespace binding instead.
- **`deleteFile` injection point on `importGhidraExport()`'s args, defaulting to a `deleteTransferFile()` helper that is the file's one real `unlinkSync` call site.** The plan's own action text explicitly authorized this as the alternative to a chmod-based read-only-directory fixture, because a test process running as root (common in CI containers) ignores permission bits and would make that route non-deterministic. Chosen over the permission route; stated here per the plan's own instruction to record which was chosen.
- **`assertNotStale()`: a whole-call `base_revision` precondition, not per-write threading.** The plan's own literal function signatures for `importGhidraExport`/`runMemmapJoin` exclude a `baseRevision` parameter, yet both tool schemas carry `...BASE_REVISION_PROPERTY` for consistency with every other write verb. Resolved by checking `currentRevision(handle)` against the caller-supplied `base_revision` once, before any write in the batch, rather than threading it through each of the several `putXref()`/`setComment()` calls a single import or join may issue — the coherent point to apply an optimistic-concurrency guard for a multi-write verb.
- **`resolveExportPathArg()` wraps `resolveWorkspacePath()`'s thrown `AnnoStorePathError` to name the argument.** The underlying primitive's message reads "store path ... is outside the workspace root" regardless of which higher-level argument (`store`/`image`/`export_path`) called it. Task 2's acceptance criterion required the refusal to name `export_path` specifically, so the message is re-thrown with the argument named while the error class and its `path`/`workspaceRoot` fields are preserved — never a second hand-rolled confinement check, per the plan's own prohibition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ANNO_MODULE_FLOOR` (hostpath-consumers.test.ts) needed raising from 17 to 19**
- **Found during:** Task 1's verify run (`node --test hostpath-consumers.test.ts`)
- **Issue:** This hand-pinned floor asserts the measured count of `anno-*.ts` production modules on disk equals a literal; adding `anno-import.ts` and `anno-join.ts` moved the count to 19 without moving the guard
- **Fix:** Raised the literal from `16 + 1` to `17 + 2`, with a new dated comment naming this plan and the two modules added, following the file's own "re-derive deliberately, never nudge to fit" discipline
- **Files modified:** `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `node --test hostpath-consumers.test.ts anno-cli-path-consumers.test.ts` — 34/34 pass
- **Committed in:** `9517a2f4` (Task 2 commit)

**2. [Rule 3 - Blocking] `package.json`'s `files[]` needed the three new production modules**
- **Found during:** Task 1's verify run (`node --test anno-seam.test.ts`)
- **Issue:** `anno-seam.test.ts`'s shipped-module census compares `package.json`'s `anno-*` entries against the `anno-*.ts/mts/json` files actually on disk; the two new `anno-*.ts` modules were on disk but not yet shipped
- **Fix:** Added `anno-import.ts`, `anno-join.ts` and `memmap-lookup.ts` (the last carries no `anno-` prefix so is outside that specific census, but is added regardless so the module is genuinely shipped) to `files[]`
- **Files modified:** `src/mcp/vice/package.json`
- **Verification:** `node --test anno-seam.test.ts` passes; `node scripts/check-npm-packages.mjs` exits OK
- **Committed in:** `ba329774` (Task 1 commit)

**3. [Rule 1 - Bug] `check-skill-tool-coverage.mjs`'s `anno_*` extractor flagged `anno_xref` as an uncurated tool reference**
- **Found during:** Task 3's verify run (`node scripts/check-skill-tool-coverage.mjs`)
- **Issue:** The skill documentation's first draft named the store's internal `anno_xref` TABLE (not a tool) in prose; the extractor's `\banno_[a-z0-9_]+/g` regex matches any `anno_`-prefixed identifier regardless of whether it is a tool name
- **Fix:** Reworded the sentence to "one cross-reference row" instead of naming the table
- **Files modified:** `src/skills/c64-program-recon/SKILL.md` (and the regenerated `installer/skills/` mirror)
- **Verification:** `node scripts/check-skill-tool-coverage.mjs` exits 0 with `OK`; `node --test anno-verb-coverage.test.ts` — 10/10 pass
- **Committed in:** `7cda46df` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug). **Impact:** all three are guard/documentation corrections required to keep this plan's own new modules and docs consistent with pre-existing structural gates; none changed this plan's own scope or the shape of any exported function.

## Issues Encountered

None beyond the deviations above. The `pgrep -f vice-broker` check in Task 3's verify step initially reported `BROKER_RUNNING`, which was confirmed to be a false positive — the pattern matched the shell wrapper's own command-line text, not a real broker process (`ps aux` and a precise `pgrep` re-check found none running). `npm run test:automated` was then run directly and confirmed the phase's documented floor: 3442 tests, 3429 pass, 2 fail (both pre-existing, `anno-register.test.ts`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `anno_import_ghidra_export` and `anno_join_memmap` are live on the curated surface, registered, and proven end to end against a real close-and-reopen read-back
- Plans 37-02 through 37-08 can build on `memmap-lookup.ts`'s `selectMemmapEntry()` (37-03's `sym` tie-break), `anno-join.ts`'s `declined` field (37-06's bank-state decline), and `anno-import.ts`'s `GHIDRA_REFTYPE_TO_ACCESS_KIND` table without any of this plan's shapes changing under them
- No blockers. The reserved `bank` column is still `null` on every row this plan writes, confirmed by test assertion

## Self-Check: PASSED

- `src/mcp/vice/anno-import.ts` — FOUND
- `src/mcp/vice/anno-import.test.ts` — FOUND
- `src/mcp/vice/anno-join.ts` — FOUND
- `src/mcp/vice/anno-join.test.ts` — FOUND
- `src/mcp/vice/memmap-lookup.ts` — FOUND
- `src/mcp/vice/memmap-lookup.test.ts` — FOUND
- Commit `ba329774` — FOUND in `git log --oneline --all`
- Commit `9517a2f4` — FOUND in `git log --oneline --all`
- Commit `7cda46df` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node --test anno-import.test.ts anno-join.test.ts memmap-lookup.test.ts` 31/31 pass; `node --test anno-tools.test.ts anno-register.test.ts anno-derivation.test.ts anno-seam.test.ts anno-confinement.test.ts stock-dispatch.test.ts hostpath-consumers.test.ts anno-verb-coverage.test.ts` 279/282 pass, 2 fail (both pre-existing in `anno-register.test.ts`); `node scripts/check-skill-tool-coverage.mjs` exits 0; `npm run test:automated` (broker stopped) 3429/3442 pass, 2 fail (same pre-existing pair)

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
