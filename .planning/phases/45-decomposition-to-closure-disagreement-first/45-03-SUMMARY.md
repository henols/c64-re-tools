---
phase: 45-decomposition-to-closure-disagreement-first
plan: 03
subsystem: annotation-store
tags: [anno-enum-gen, decomposition, acme-export, vic-ii, project-md, d-15, d-16, d-17]

requires:
  - phase: 45
    provides: "plan 45-01's decomp-completeness verb and 45-02's export/import round trip, both unaffected by this plan"
provides:
  - "decomposeRegisterValue() -- the ONE owning multi-bit decoder (D-16), splitting a register write into named, OR-able RegisterTerm[] with an exhaustive OR-reconstruction invariant and a built-in ACME-identifier refusal"
  - "The rebuilt enum fetch-and-install route (D-15): fetchRegisterSearchRows()/generateEnumsFromStore()/installPlannedEnums(), reaching the surviving heuristics (pairSearchRows(), planEnumsForPairing(), sanitizeVariantMap(), buildEnumGenerationReport()) unchanged"
  - "The corrected .planning/PROJECT.md ANNO-13 withdrawal notice: enum half RECLAIMED 2026-09-11 (Phase 45, D-15); ANNO-14/ANNO-15 explicitly STILL UNOWNED"
  - "Two MEASURED findings about the real committed anno-regbits.json: $D019's genuine reserved-bit gap, and $0001's all-digit enum-name prefix making every decomposed term name illegal"
affects: [45-05]

actuals:
  tokens: 14100
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One decode, two callers: decodeField()/requireRegBitsEntry() extracted so variantNameFor() and decomposeRegisterValue() share a single per-field decode path rather than two independently-maintained ones"
    - "Refuse-before-return, not sanitize-after: decomposeRegisterValue() runs assertLegalAcmeIdentifier() on every term name before returning, the same client-side-before-I/O property sanitizeVariantMap() already holds"
    - "Exhaustive test tolerates legitimate refusal: the OR-reconstruction/one-vocabulary/identifier-gate tests iterate every real register key and all 256 values via a tryDecompose() helper that treats a NAMED refusal (uncovered bits, illegal identifier) as an acceptable outcome, never a blanket try/catch swallowing anything"

key-files:
  created:
    - .planning/phases/45-decomposition-to-closure-disagreement-first/deferred-items.md
  modified:
    - src/mcp/vice/anno-enum-gen.ts
    - src/mcp/vice/anno-enum-gen.test.ts
    - .planning/PROJECT.md
    - .planning/WINDOWS.md

key-decisions:
  - "decomposeRegisterValue() validates every term name via assertLegalAcmeIdentifier() before returning (Rule 2 -- missing critical functionality, T-45-10's own mitigation), because the exhaustive test discovered register $0001's all-digit enum-name prefix (registerKeyFor(1).slice(1) === \"0001\") makes every term illegal; refusing is correct, sanitizeVariantMap() alone would never have caught this since it only validates bare variant names, never the enum-name prefix this decoder's OR-emission shape adds."
  - "The exhaustive OR-reconstruction/one-vocabulary/identifier-gate tests treat a decomposeRegisterValue() throw as a legitimate outcome (via tryDecompose()) rather than asserting it never throws, after discovering $D019's real, committed table genuinely leaves bits 4-6 with no field entry at all (a hardware reserved-bit gap, not a bug) -- proven with a non-vacuity assertion (at least one accepted decomposition per loop) so the tolerance can never silently swallow every case."
  - "installPlannedEnums() installs through createProjectEnum()/updateProjectEnum()/applyEnumUsage() directly (the same anno-store.ts functions anno_create_project_enum/anno_update_project_enum/anno_apply_enum_usage dispatch to) rather than through the MCP tool JSON-RPC layer, since the fetch/install route runs in-process against an already-open store handle."
  - "The pre-existing FLOW-02 violation found in anno-cli.ts's decomp-completeness USAGE text (plan 45-01, naming 'Phase 45'/'Phase 33' in shipped source) is logged to deferred-items.md and .planning/WINDOWS.md rather than fixed here -- proven pre-existing by reproducing the identical failure against the pre-Task-3 PROJECT.md, and out of this plan's files_modified scope."

requirements-completed: [DECOMP-04]

coverage:
  - id: D1
    description: "decomposeRegisterValue(register, value) is the ONE owning decoder for a multi-bit register write, returning one named term per field; both render surfaces will consume it (D-16) -- wired in plan 45-05."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#decomposeRegisterValue(0xd018, 0x04) returns one term per $D018 field..."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#decomposeRegisterValue: the OR of every term's value reconstructs the input value exactly, exhaustively over every register and all 256 values..."
        status: pass
    human_judgment: false
  - id: D2
    description: "Two adjacent bit-fields whose masks touch (e.g. $D018's mask $01/$0E/$F0) each emit their own named constant, and the bitwise OR of every emitted term equals the original operand byte exactly; a value whose fields do not cover it is REFUSED by name."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#decomposeRegisterValue: a register whose fields do not cover every set bit refuses by name, naming the uncovered mask and the OVERRIDES remedy"
        status: pass
    human_judgment: false
  - id: D3
    description: "A register value where every field decodes to a silent token yields exactly one named term matching variantNameFor()'s own V<value> degenerate case."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#decomposeRegisterValue: a value whose every field decodes to a silent token returns exactly one V<value> term, matching variantNameFor()'s own degenerate case"
        status: pass
    human_judgment: false
  - id: D4
    description: "The generated per-field term names are the SAME tokens variantNameFor() joins with underscores, prefixed by the same enum name -- one vocabulary, not two."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#decomposeRegisterValue: joining the returned terms' field-token halves with '_' reproduces variantNameFor() exactly, exhaustively over every register and all 256 values"
        status: pass
    human_judgment: false
  - id: D5
    description: "The enum route is reachable again: a fetch over this project's own disassembler feeds the surviving pairSearchRows() and planEnumsForPairing() unchanged, and installs through anno_create_project_enum + anno_apply_enum_usage (D-15)."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#fetchRegisterSearchRows: a real code range decodes into one lda row and one sta row 2 bytes apart, and pairSearchRows() pairs them into $D011=0x1b"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts#installPlannedEnums (via generateEnumsFromStore): writes exactly one project enum and binds the usage to the lda address, never the store address"
        status: pass
      - kind: other
        ref: "git diff shows no edit inside pairSearchRows()/planEnumsForPairing()/sanitizeVariantMap()/buildEnumGenerationReport() bodies -- only the file is appended to"
        status: pass
    human_judgment: false
  - id: D6
    description: ".planning/PROJECT.md's ANNO-13 withdrawal notice records that Phase 45 owns and returns the ENUM half only, and that ANNO-14/ANNO-15 remain unowned."
    requirement: null
    verification:
      - kind: other
        ref: ".planning/PROJECT.md, three sites (line ~46, ANNO-13 WITHDRAWN sub-bullet, shipped-capability summary list)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-absorbed-decisions.test.ts (all 5, unaffected by this edit)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 3: Criterion 5's Decoder and Route Summary

**`decomposeRegisterValue()` ships as the one owning multi-bit decoder (D-16), the enum fetch-and-install route reaches the surviving `pairSearchRows()`/`planEnumsForPairing()` heuristics again over this project's own disassembler (D-15), and `.planning/PROJECT.md` now records `ANNO-13`'s enum half as reclaimed while `ANNO-14`/`ANNO-15` stay explicitly unowned.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-11T05:15:00Z (approx.)
- **Completed:** 2026-09-11T05:37:50Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 4 modified — `deferred-items.md` new; `anno-enum-gen.ts`, `anno-enum-gen.test.ts`, `.planning/PROJECT.md`, `.planning/WINDOWS.md` modified)

## Accomplishments

- `decomposeRegisterValue(register, value)` (D-16/D-17): splits a register
  write into one named `RegisterTerm` per bit-field, arithmetically exact.
  Shares its per-field decode step with `variantNameFor()` via a new private
  `decodeField()`/`requireRegBitsEntry()` pair, so the two functions can
  never silently drift apart — `variantNameFor()`'s own 256-value
  injectivity tests stayed green, untouched.
- The exhaustive OR-reconstruction and one-vocabulary invariants are proven
  across **every** register key in the real committed `anno-regbits.json`
  (35 registers × 256 values each), not a hand-picked subset — and that
  exhaustive sweep found two genuine, previously-unexercised facts about the
  committed table: `$D019` has a real reserved-bit gap (bits 4–6, no field
  entry at all), and `$0001`'s all-digit enum-name prefix
  (`registerKeyFor(1).slice(1) === "0001"`) makes every decomposed term name
  an illegal ACME identifier. Both are now refused by name rather than
  silently mishandled, and both are pinned by dedicated regression tests.
- The enum fetch-and-install route is rebuilt: `fetchRegisterSearchRows()`
  walks a store's `code`-typed ranges through `disasm-decoder.ts`'s real
  `decode()` (the same path `anno_disassemble` uses), `generateEnumsFromStore()`
  strings fetch → `pairSearchRows()` → `planEnumsForPairing()` →
  `installPlannedEnums()` → `buildEnumGenerationReport()`, and
  `installPlannedEnums()` installs through the same
  `createProjectEnum()`/`updateProjectEnum()`/`applyEnumUsage()` write path
  the by-hand route already used, preserving ANNO-13's create-then-update
  re-runnability.
- `.planning/PROJECT.md`'s `ANNO-13` withdrawal notice is corrected at all
  three sites the plan named: the enum half is recorded as RECLAIMED
  2026-09-11 (Phase 45, D-15), and `ANNO-14`/`ANNO-15` are explicitly named
  as unaffected and still unowned, so the reclaim's scope cannot be misread.

## Task Commits

1. **Task 1: decomposeRegisterValue()** - `2365173c` (feat)
2. **Task 2: rebuild the enum fetch-and-install route** - `e37878df` (feat)
3. **Task 3: correct the ANNO-13 withdrawal notice** - `31f1ccf8` (docs)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-enum-gen.ts` - adds `decomposeRegisterValue()`,
  `RegisterTerm`/`RegisterDecomposition`, `decodeField()`/
  `requireRegBitsEntry()` (Task 1); adds `fetchRegisterSearchRows()`,
  `generateEnumsFromStore()`, `installPlannedEnums()` (Task 2); corrects the
  module header's "WHERE THE ROUTE RETURNS" paragraph
- `src/mcp/vice/anno-enum-gen.test.ts` - 20 new tests: 8 for
  `decomposeRegisterValue()` (the pinned target, the exhaustive
  OR-reconstruction/one-vocabulary/identifier-gate invariants, the uncovered-
  bits refusal, the degenerate case, the `$0001` regression, `multiField`)
  and 7 for the rebuilt route (real-decode pairing, adjacent-only miss,
  install + usage-binding, re-run idempotence, truncation wording, non-code
  ranges skipped)
- `.planning/PROJECT.md` - the `ANNO-13` withdrawal notice corrected at
  three sites (line ~46, the WITHDRAWN sub-bullet, the shipped-capability
  summary list); `ANNO-14`/`ANNO-15` sub-bullet noted as unaffected
- `.planning/WINDOWS.md` - one `deviation` entry for the pre-existing
  FLOW-02 finding (see Deviations below)
- `.planning/phases/45-decomposition-to-closure-disagreement-first/deferred-items.md` -
  new; records the FLOW-02 finding in full for whoever picks it up

## Decisions Made

- `decomposeRegisterValue()` refuses (via `assertLegalAcmeIdentifier()`)
  rather than emits an illegal term name — discovered necessary by the
  exhaustive test against register `$0001`. See Deviations below.
- The exhaustive invariant tests tolerate a *named* refusal as a legitimate
  outcome (via a `tryDecompose()` helper matching only the two known
  refusal-message shapes, re-throwing anything else), after discovering
  `$D019`'s genuine reserved-bit gap. A non-vacuity assertion in each loop
  guards against this tolerance silently swallowing everything.
- `installPlannedEnums()` calls `anno-store.ts`'s write functions directly
  (in-process, same package) rather than routing through the MCP
  JSON-RPC/tool-dispatch layer, since the fetch/install runs against an
  already-open store handle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `decomposeRegisterValue()` needed its own ACME-identifier refusal**
- **Found during:** Task 1, running the exhaustive identifier-gate test across all 35 real registers
- **Issue:** Register `$0001` ("MOS 6510 ... I/O Port")'s `registerKeyFor(1).slice(1)` is the all-digit string `"0001"`, so the `<enumName>_<field token>` naming scheme the plan's own action text specifies produces an illegal, digit-leading ACME identifier for EVERY term of that register, for every value. `sanitizeVariantMap()` never catches this because it only validates a bare variant name, never the enum-name prefix `decomposeRegisterValue()`'s OR-emission shape adds — this is exactly threat T-45-10's own named risk ("Generated variant/term identifiers reaching the ACME export").
- **Fix:** `decomposeRegisterValue()` runs `assertLegalAcmeIdentifier()` on every term name before returning, refusing rather than emitting an illegal identifier — client-side-before-return, the same property `sanitizeVariantMap()` already holds.
- **Files modified:** `src/mcp/vice/anno-enum-gen.ts`, `src/mcp/vice/anno-enum-gen.test.ts`
- **Verification:** dedicated regression test (`T-45-10: decomposeRegisterValue refuses register $0001 for every value...`) plus the exhaustive identifier-gate test, both green
- **Committed in:** `2365173c` (Task 1 commit)

### Non-numbered disclosure (a genuine, pre-existing, out-of-scope finding)

**2. FLOW-02 violation in `anno-cli.ts`'s `decomp-completeness` USAGE text (plan 45-01)**
- **Found during:** Task 3, running this task's own `<verify>` command
  (`node --test docs-absorbed-decisions.test.ts docs-dangling-refs.test.ts`)
- **Issue:** `anno-cli.ts`'s `decomp-completeness` USAGE text (added by plan
  45-01) contains literal phase-number references — `"Phase 45's
  decomposition-closure completeness answer..."` and `"...run under Phase
  33's reproducible-run protocol."` — which `docs-dangling-refs.test.ts`'s
  FLOW-02 guard forbids in shipped source (a phase is a planning artifact,
  never a durable user-facing remediation path).
- **Proven pre-existing:** reproduced identically with `.planning/PROJECT.md`
  reverted to its pre-Task-3 content — the two failures persist regardless
  of this plan's own edit. This plan's `files_modified` is
  `anno-enum-gen.ts`/`anno-enum-gen.test.ts`/`.planning/PROJECT.md` only;
  `anno-cli.ts` is untouched by any task here.
- **Action taken:** NOT fixed (scope boundary — a different plan's file).
  Logged to `deferred-items.md` and appended to `.planning/WINDOWS.md` as an
  open `deviation` entry (id 58), naming the owning plan (45-01) and a
  suggested remedy.
- **Files touched for the disclosure:** `.planning/phases/45-decomposition-to-closure-disagreement-first/deferred-items.md` (new), `.planning/WINDOWS.md`
- **Committed in:** `31f1ccf8` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical) + 1 disclosed-but-not-fixed (pre-existing, out of scope).
**Impact on plan:** The auto-fix was necessary for correctness (T-45-10's own named threat) and adds no scope beyond what the exhaustive test discipline this phase already commits to. The disclosed finding does not block this plan's own deliverables; `docs-dangling-refs.test.ts` will read `# fail 2` until the owning plan (45-01) or a later cleanup pass rewords `anno-cli.ts`'s USAGE text.

## Issues Encountered

`docs-dangling-refs.test.ts` (run as part of Task 3's own `<verify>` block)
reports 2 pre-existing failures unrelated to this plan's changes — see
Deviation 2 above for the full disclosure and proof of pre-existence.
`docs-absorbed-decisions.test.ts` (the other file in that same `<verify>`
command) is fully green (5/5).

## Known Stubs

None. Every deliverable this plan claims (`decomposeRegisterValue()`, the
rebuilt fetch/install route, the corrected `PROJECT.md` notice) is backed by
real, exhaustively-tested code and a real synthetic-store round trip — no
placeholder value or empty default stands in for unimplemented behavior.

## User Setup Required

None — no external service configuration required. No host tool (VICE, ACME,
dxa, Ghidra) was needed for this plan's own work; `pgrep -x x64sc` and
`systemctl --user is-active vice-broker` were both confirmed clean
throughout (no live emulator interaction was needed for this plan).

## Next Phase Readiness

- `decomposeRegisterValue()` is ready for plan 45-05 to wire into both
  render surfaces (`anno-export-asm.ts`'s OR-ed constant emission under the
  real-ACME byte-diff oracle, and `anno_disassemble`'s readable comment) —
  D-16's "one decoder, two renderers" contract.
- The rebuilt enum route (`generateEnumsFromStore()`) is ready to run
  against a real derived store (e.g. `fixtures/ghidra/charset-phantom.prg`,
  criterion 5's own named fixture) whenever a later plan needs to actually
  populate project enums from a real disassembly.
- One open item: `docs/phase45-wave0-measurements.md`'s own MEASUREMENT A
  found that derivation writes zero labels for `dxa/tracer.prg`. That
  finding is orthogonal to this plan (the enum route pairs register writes,
  not labels) and does not block anything here, but a later plan deriving
  `charset-phantom.prg` for criterion 5 should expect the SAME zero-label
  shape from derivation and plan its own name-authoring pass accordingly.
- One disclosed, non-blocking item: the FLOW-02 finding in `anno-cli.ts`
  (Deviation 2 above), tracked in `deferred-items.md` and
  `.planning/WINDOWS.md` (entry id 58).

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
