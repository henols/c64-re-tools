---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 02
subsystem: ghidra-export
tags: [ghidra-pcode, const-writes, bank-state, acme-fixture, ghidra-export, callother-volatile]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "plan 37-01's anno-import.ts parser (parseGhidraExport, importGhidraExport, AnnoImportError) that this plan extends"
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "GhidraStructExport.java's fixed six-section format, VolatileCarve.java's volatile carve (GHID-02), and the ghidra-live.test.ts scratch-workspace/entrypoints-file harness"
provides:
  - "fixtures/ghidra/bank-path-dependent.a/.prg: a synthetic fixture with a single shared program point (a subroutine) reached from two callers under two different $01 bank states"
  - "GhidraStructExport.java's seventh, additive ## CONST_WRITES section: one line per resolved immediate store to a watched address (processor port, $D011, $D018, $DD00), derived from p-code in the SAME DecompInterface pass as STRUCTURAL_FACTS"
  - "parseConstWrites()/ConstWriteFact/CONST_WRITE_WATCHED_ADDRESSES in anno-import.ts, over a real committed capture (fixtures/ghidra/export-bank-path-dependent.txt)"
  - "parseGhidraAddressToken(): fixes a live defect (found this plan) where the importer refused every real Ghidra-rendered address token"
affects: ["37-03", "37-04", "37-05", "37-06", "37-07", "37-08"]

# Actuals (#2632)
actuals:
  tokens: 27807
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PcodeOp.CALLOTHER dispatch on Ghidra's documented decompiler-internal constant (UserPcodeOp.BUILTIN_VOLATILE_WRITE = 0x10000002, userop.cc) rather than a language-registered userop name, since a volatile write is a decompiler built-in with no pspec-declared name to resolve via getUserDefinedOpName()"
    - "A Ghidra-rendered address token (bare hex, no prefix, from Address.toString()) is a DIFFERENT format from the store's agent-facing parseStoreAddress() contract, and needs its own narrow parser rather than reusing the ambiguity-refusing one"

key-files:
  created:
    - src/mcp/vice/fixtures/ghidra/bank-path-dependent.a
    - src/mcp/vice/fixtures/ghidra/bank-path-dependent.prg
    - src/mcp/vice/fixtures/ghidra/export-bank-path-dependent.txt
  modified:
    - src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java
    - src/mcp/vice/anno-import.ts
    - src/mcp/vice/anno-import.test.ts
    - src/mcp/vice/ghidra-live.test.ts
    - src/mcp/vice/fixtures/ghidra/README.md

key-decisions:
  - "The committed capture fixture uses the .prg route, not flat-64K -- matches the size/format of every other committed export/run-log fixture in fixtures/ghidra/ (a flat-64K capture would be ~700KB, one CLASSIFICATION line per byte of a 65,536-byte image)"
  - "MEASURED, not assumed: a write to a volatile-marked watched address is represented in high p-code as the decompiler's own built-in \"write_volatile\" CALLOTHER, never a plain COPY -- this is the ONLY shape observed against real Ghidra 12.1.3 for any of this section's four watched addresses, because all four fall inside GHID-02's volatile-carved ranges"
  - "The .prg route's own internal-jsr defect (found this plan, see Deviations) means the fixture's shared-subroutine claim is asserted only on the flat-64K route in ghidra-live.test.ts; the .prg route asserts only the $01-differs claim, which remains true there"
  - "parseGhidraAddressToken() replaces parseStoreAddress() at both REFERENCES and CONST_WRITES call sites in the importer -- a Ghidra-rendered address token is never ambiguous the way an agent-supplied one is, so it gets its own narrow parser rather than being forced through the general, ambiguity-refusing one"

patterns-established:
  - "A p-code walk that needs both an existing per-function pass's own boolean flag (SPLIT_POINTER's splitFound) AND a new fact-collection pass reuses ONE iteration over hf.getPcodeOps(), never a second HighFunction.getPcodeOps() call for the same function"

requirements-completed: [AUTO-04]

coverage:
  - id: D1
    description: "A committed, reassemblable fixture (bank-path-dependent.a/.prg) has one shared program point (a subroutine) reached from two callers under two different, determinate $01 bank states, where bank.a could not"
    requirement: "AUTO-04"
    verification:
      - kind: unit
        ref: "manual acme reassembly + grep counts (jsr probe == 2, sta $d020 == 1) -- verified during task execution, no automated test file"
        status: pass
      - kind: e2e
        ref: "ghidra-live.test.ts#ghidra-live CONST_WRITES (flat64k route): ... the shared subroutine is reached from both distinct call sites"
        status: pass
    human_judgment: false
  - id: D2
    description: "GhidraStructExport.java emits a seventh, additive ## CONST_WRITES section (one line per resolved immediate store to a watched address, an explicit ## CONST_WRITES_NONE when none found), derived from p-code, never decompiled text, with the six existing sections byte-identical in name and order"
    requirement: "AUTO-04"
    verification:
      - kind: unit
        ref: "grep-based structural checks (section order, CONST_WRITES_NONE presence, single getCCodeMarkup call site, six pre-existing headers intact) -- run during task execution"
        status: pass
      - kind: e2e
        ref: "ghidra-live.test.ts (full run, 18/18 pass/skip, no regressions against the six pre-existing sections)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real analyzeHeadless capture of the new section is committed as a fixture (export-bank-path-dependent.txt) and parsed hermetically (parseConstWrites) with no JVM, including a non-vacuity floor and element-wise-equal reparse"
    requirement: "AUTO-04"
    verification:
      - kind: unit
        ref: "anno-import.test.ts#parseConstWrites: over the committed real capture, non-vacuity floor, at least two differing processor-port values, and element-wise-equal on a second parse"
        status: pass
      - kind: unit
        ref: "anno-import.test.ts (26/26 pass, full file)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 02: The synthetic path-dependent fixture and the addressed CONST_WRITES export Summary

**A two-caller ACME fixture proves a single instruction reached under two different `$01` bank states; `GhidraStructExport.java` gains a seventh, p-code-derived `## CONST_WRITES` section that resolves those bank-state writes to addresses; a real captured export is committed and parsed hermetically — and along the way, two live-only defects in plan 37-01's own importer (a mis-parsed `## CLASSIFICATION` accounting tail, and a total refusal of Ghidra's own bare-hex address rendering) were found and fixed, since no prior test had ever run the importer against a real Ghidra capture.**

## Performance

- **Duration:** ~75 min
- **Started:** ~2026-09-05T08:14:00+02:00 (estimated from the prior plan's closing commit)
- **Completed:** 2026-09-05T08:50:16+02:00
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `fixtures/ghidra/bank-path-dependent.a`/`.prg`: a subroutine (`probe`) called twice, once after `$01=$34` and once after `$01=$33`, giving a single `sta $d020`/`lda $d000,x` program point reached from two callers under two determinate, different bank states — `bank.a` is measured to have no such site
- `GhidraStructExport.java`'s new `## CONST_WRITES` section: a p-code walk over the SAME `DecompInterface` results `## STRUCTURAL_FACTS` already builds, recognising the decompiler's own built-in `write_volatile` `CALLOTHER` (the ONLY shape a write to a volatile-marked watched address actually takes, MEASURED against real Ghidra 12.1.3), plus `COPY`/`STORE` for generality, watching `$0001`/`$D011`/`$D018`/`$DD00`
- A real, unedited `analyzeHeadless` capture (`.prg` route) committed as `fixtures/ghidra/export-bank-path-dependent.txt`, whose `## CONST_WRITES` section carries three facts (`$34`, `$33`, `$37` at the processor port) — parsed hermetically by the new `parseConstWrites()`/`ConstWriteFact`/`CONST_WRITE_WATCHED_ADDRESSES` in `anno-import.ts`, with a non-vacuity floor and a second-parse element-wise-equality check
- Two new live producing cases in `ghidra-live.test.ts` (both routes), correctly differentiating what each route can actually prove given a newly measured `.prg`-route defect (see Deviations) — the full 18-case file still passes/skips cleanly, no regressions
- Two live-only bugs in plan 37-01's own importer, found because this plan is the first to run it against a REAL Ghidra capture rather than a hand-written `$`-prefixed transfer file: a `## CLASSIFICATION` line-count miscount (+3, from unprefixed trailing informational lines), and a total refusal of every real Ghidra address token (bare hex, no `$`/`0x` prefix) — both fixed in `anno-import.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: The synthetic two-caller path-dependent $01 fixture, assembled and provenance-recorded** - `08f3e705` (feat)
2. **Task 2: The additive ## CONST_WRITES export section, derived from p-code stores** - `5f2a2465` (feat)
3. **Task 3: Capture the real section over the new fixture, commit it, and parse it hermetically** - `8fd80c69` (test)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-02):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a` - the two-caller fixture source, commented in `bank.a`'s own voice
- `src/mcp/vice/fixtures/ghidra/bank-path-dependent.prg` - assembled via `acme -f cbm`, reassembles byte-for-byte
- `src/mcp/vice/fixtures/ghidra/export-bank-path-dependent.txt` - a real, unedited `analyzeHeadless` export (`.prg` route) over the fixture, committed for hermetic parsing
- `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` - `CONST_WRITE_WATCHED_ADDRESSES`, `CALLOTHER_BUILTIN_VOLATILE_WRITE`, `collectConstWrite()`, the seventh `## CONST_WRITES` section
- `src/mcp/vice/anno-import.ts` - `parseConstWrites()`, `ConstWriteFact`, `CONST_WRITE_WATCHED_ADDRESSES`, `parseGhidraAddressToken()` (new, fixes the two live bugs below), a `CONST_WRITES`/`CONST_WRITES_COUNT` trailer check, and the `## CLASSIFICATION` accounting-tail skip
- `src/mcp/vice/anno-import.test.ts` - eight new cases: `parseConstWrites()` unit cases, the committed-capture non-vacuity/reproducibility case, `CONST_WRITE_WATCHED_ADDRESSES` parity
- `src/mcp/vice/ghidra-live.test.ts` - two new live producing cases (`CONST_WRITES`, both routes); `makeScratchWorkspace()` now also copies the new fixture
- `src/mcp/vice/fixtures/ghidra/README.md` - provenance for the new fixture (address trace, ACME command) and the committed capture, plus the newly measured `.prg`-route internal-`jsr` defect

## Decisions Made

- **Committed capture uses the `.prg` route, not flat-64K.** A flat-64K capture would carry one `## CLASSIFICATION` line per byte of a 65,536-byte image (~700KB) — every other committed export/run-log fixture in this directory is small, and `bank.prg`'s own flat-64K variant is generated fresh at test time, never committed (D-36-17). The `.prg` route's own internal-`jsr` defect (below) means it can't prove the fixture's structural claim, so that proof lives only in the (uncommitted, test-generated) flat-64K route's live case.
- **`CALLOTHER` dispatch on Ghidra's documented internal constant, not a language-registered userop name.** `getUserDefinedOpName()` returns `null` for the volatile-write/-read pseudo-ops (`0x10000002`/`0x10000001`) — they are decompiler built-ins with no pspec-declared name, unlike the 8051/HCS08/AVR examples that DO declare `<volatile outputop="write_volatile">`. The numeric constant is `UserPcodeOp.BUILTIN_VOLATILE_WRITE` in Ghidra's own decompiler C++ source (`userop.cc`), not a registration-order-dependent id, and is documented as such in the Java comment.
- **`parseGhidraAddressToken()`, not a fix to `parseStoreAddress()`.** The store's own address parser is deliberately agent-facing and refuses unprefixed numeric strings on purpose (hex/decimal ambiguity from an agent's own typed input). A Ghidra-rendered token carries no such ambiguity — it always comes from `Address.toString()`. Rather than weakening the store's own contract, the importer gained its own narrow parser, still delegating to `parseStoreAddress()` for the `$`/`0x`-prefixed forms so existing hand-written test fixtures keep working unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `parseGhidraExport()` miscounted `## CLASSIFICATION` body lines by +3 against every real capture**
- **Found during:** Task 3's first hermetic-parse attempt against the real committed capture
- **Issue:** `GhidraStructExport.java`'s classification section appends three informational lines (`CLASSIFICATION_EXPECTED_FROM_BLOCKS`, `CLASSIFICATION_OBSERVED`, `CLASSIFICATION_OVERRIDE_USED`) immediately after its own `## CLASSIFICATION_LINES <n>` trailer, with NO `## ` prefix. Because a trailer line never changes `currentSection`, these three bare lines were swept into `sections.get("CLASSIFICATION")` as ordinary body content, inflating the parsed count by exactly 3 relative to the script's own declared trailer — this had never been caught because no prior test ran `parseGhidraExport()` against a real capture with a `CLASSIFICATION` section (plan 37-01's own tests used `REFERENCES`-only synthetic text).
- **Fix:** These three literal line prefixes are now skipped by name (never a generic "looks like a trailer" heuristic) when `currentSection === "CLASSIFICATION"`.
- **Files modified:** `src/mcp/vice/anno-import.ts`
- **Verification:** `parseGhidraExport()` over the real committed capture no longer throws a `CLASSIFICATION_LINES` disagreement; `node --test anno-import.test.ts` 26/26 pass
- **Committed in:** `8fd80c69` (Task 3 commit)

**2. [Rule 1 - Bug] `importGhidraExport()`'s REFERENCES parsing refused EVERY real captured export outright**
- **Found during:** Task 3, first attempt at running the real importer end-to-end against the real committed capture
- **Issue:** `parseStoreAddress()` (the store's general, agent-facing address parser) requires an explicit `$` or `0x` prefix and refuses bare numeric strings on purpose. Ghidra's own `Address.toString()` renders addresses as bare hex with NO prefix (e.g. `"0815"`, `"d020"`) — every prior test used a hand-written, `$`-prefixed transfer file, so this had never been exercised against real Ghidra output. `importGhidraExport()` would have refused every real capture since plan 37-01 landed.
- **Fix:** New `parseGhidraAddressToken()` in `anno-import.ts`, used at both the REFERENCES call site (fixing the pre-existing bug) and the new CONST_WRITES call site — accepts Ghidra's own bare-hex rendering directly, while still delegating `$`/`0x`-prefixed tokens to `parseStoreAddress()` unchanged.
- **Files modified:** `src/mcp/vice/anno-import.ts`
- **Verification:** A manual end-to-end `importGhidraExport()` run against the real committed capture now succeeds (`referencesSeen: 5, xrefsWritten: 3`); `node --test anno-import.test.ts` 26/26 pass
- **Committed in:** `8fd80c69` (Task 3 commit)

**3. [Rule 1 - Bug, measured and worked around rather than "fixed"] The `.prg` route's own internal-`jsr` target is not corrected for the two-byte header shift**
- **Found during:** Task 3's live prg-route run over the new fixture
- **Issue:** ACME assembles `jsr probe`'s absolute operand using the source's own address space (assuming a real C64 loader strips the file's two-byte header). `ghidra.analyze`'s `.prg` route does NOT strip that header (a pre-existing, already-documented quirk for entry points), so on this route the `jsr` instructions land at the correct (shifted) addresses but their OWN embedded target is still the UNSHIFTED source-label value — the call lands two bytes early, on the caller's own trailing `cli`/`rts`, never on `probe`. This is a NEW finding (`bank.a` has no internal control flow, so it never exposed this) with no fixture-level workaround that doesn't also break the `.prg` route's practical use as "the small, committed format."
- **Fix:** Not a code fix — a measurement, documented in `fixtures/ghidra/README.md`, and reflected in `ghidra-live.test.ts`: the shared-subroutine-reached-from-two-callers claim is asserted only on the flat-64K route (where it is genuinely true); the `.prg` route (used for the committed capture, to match every other fixture's size) asserts only the `$01`-differs claim, which remains true there since it involves no internal address reference.
- **Files modified:** `src/mcp/vice/fixtures/ghidra/README.md`, `src/mcp/vice/ghidra-live.test.ts`
- **Verification:** Both live `CONST_WRITES` cases (flat64k and prg routes) pass; the full `ghidra-live.test.ts` (18 cases) passes/skips cleanly with no regressions
- **Committed in:** `8fd80c69` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs, two code fixes and one measured-and-documented finding). **Impact:** the two code fixes make the importer genuinely usable against real Ghidra output for the first time since plan 37-01 shipped it — a necessary correctness fix, not scope creep, since this plan's own acceptance criteria require the importer's parser to work against a real capture. The third is a documented limitation of `ghidra.analyze`'s own `.prg` route for any future fixture with internal absolute code references, not specific to this plan's own construction.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `parseConstWrites()`, `ConstWriteFact` and `CONST_WRITE_WATCHED_ADDRESSES` are available for plan 37-06's bank-state resolution join to consume directly
- `fixtures/ghidra/bank-path-dependent.a`/`.prg` is available as the flip/decline control fixture plan 37-06 needs for its own observed-red controls (AUTO-04/AUTO-05)
- `parseGhidraAddressToken()`'s fix means the WHOLE importer (not just CONST_WRITES) now genuinely works against real Ghidra captures — plans 37-03 through 37-08 inherit this correctness fix for free
- No blockers. The `.prg`-route internal-`jsr` limitation is documented and does not block any downstream plan, since bank-state resolution reads `## CONST_WRITES`'s caller-level facts, not the shared subroutine's own reachability

## Self-Check: PASSED

- `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a` — FOUND
- `src/mcp/vice/fixtures/ghidra/bank-path-dependent.prg` — FOUND
- `src/mcp/vice/fixtures/ghidra/export-bank-path-dependent.txt` — FOUND
- Commit `08f3e705` — FOUND in `git log --oneline --all`
- Commit `5f2a2465` — FOUND in `git log --oneline --all`
- Commit `8fd80c69` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `acme -f cbm` reassembles the committed fixture byte-for-byte; `npm run typecheck` clean; `node --test anno-import.test.ts` 26/26 pass; `node --test ghidra-live.test.ts` (no opt-in) exits 0, 18/18 skipped with named reasons; `node --test ghidra-live.test.ts` (`VICE_LIVE_GHIDRA=1`, real `GHIDRA_HOME`) exits 0, 16 pass / 2 skipped (corpus-gated, unrelated to this plan); six pre-existing export section headers confirmed byte-identical in name and order; `test-gate.mjs`'s `MANUAL_ONLY_TESTS` unchanged; `npm run test:automated` (broker stopped) 3450/3437 pass, 2 fail (the same pre-existing pair in `anno-register.test.ts`)

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
