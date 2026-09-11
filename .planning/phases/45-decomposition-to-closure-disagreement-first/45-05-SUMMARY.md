---
phase: 45-decomposition-to-closure-disagreement-first
plan: 05
subsystem: annotation-store
tags: [anno-export-asm, anno-tools, anno-enum-gen, decomposition, acme-export, disassemble, vic-ii, d-16, d-17]

requires:
  - phase: 45
    provides: "plan 45-03's decomposeRegisterValue() -- the ONE owning multi-bit decoder this plan wires into both render surfaces"
provides:
  - "The OR-ed multi-bit render path in anno-export-asm.ts (D-17): a multi-field register write renders as term names joined by ` | ` plus a decoded comment; a single-field register or a non-register-shaped enum name keeps the existing single-symbol path unchanged."
  - "A real-ACME byte-diff oracle case proving the $D011/$D018 OR-ed decomposition reassembles byte-identically, with a non-vacuity control asserting the OR-expression text is actually present."
  - "anno_disassemble as D-16's second renderer: dispatchDisassemble(handle, args) now uses the store handle its own schema already required, rendering a bound register write the same way the export does -- readability, not proof."
affects: []

actuals:
  tokens: 15483
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One decoder, two independent renderer glue layers (D-16): anno-export-asm.ts and anno-tools.ts each carry their OWN REGISTER_ENUM_NAME_RE and their own substitution/collision handling, both calling decomposeRegisterValue() and neither decoding a bit itself -- deliberate duplication of the small glue, never of the decode."
    - "Attempt-then-branch on multiField: an enum usage whose name matches the register-key shape is attempted through decomposeRegisterValue() unconditionally; the decoder's own multiField flag (not the caller) decides whether the OR-ed path or the existing single-symbol path renders, so a single-field register with a register-shaped name still takes the untouched old path."
    - "Merged trailing comment, authored-first (D-17): anno-export-asm.ts's withComments() gained an optional generatedSuffix parameter that renders a stored SIDE comment first and the mechanical decode after a ` -- ` separator, or the mechanical decode alone when no stored comment exists -- never reordering or dropping either."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts

key-decisions:
  - "definedEnumSymbols changed from a Set<string> to a Map<string, number> in anno-export-asm.ts, so a term name redefined with a DIFFERENT value across two decomposed writes is refused by name with both values -- extending the SAME collision check 30-REVIEW WR-10 added, per the plan's own instruction not to add a second one."
  - "anno_disassemble's refusals route through AnnoStoreError (this file's own ViceError family), and register-address parsing uses Number(\"0x...\") rather than parseInt() -- both required by anno-tools.ts's own pre-existing structural guards (no bare Error, no parseInt), discovered by running the file's own test suite rather than assumed from the plan text."
  - "REGISTER_ENUM_NAME_RE is deliberately duplicated, not shared, between anno-export-asm.ts and anno-tools.ts: D-16 names two renderers, each owning its own substitution glue, and only decomposeRegisterValue() itself is the shared seam. Neither task's files_modified included anno-enum-gen.ts, so a shared export was not an option even had it been preferred."
  - "anno_disassemble's readable comment merge does NOT reuse anno-export-asm.ts's exported substituteImmediateEnum() -- that function's own doc comment states it is exported for test reach only, with anno-cli.ts (via exportAsm()) as the one production caller. A small local substituteReadableImmediate() was written instead, confined to the assembler-visible half of the line the same way."

requirements-completed: [DECOMP-04]

coverage:
  - id: D1
    description: "A multi-bit register write renders as OR-ed named constants AND a decoded comment in the ACME export -- both halves, never either alone (D-17)."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#D-17 Test 1/2: a multi-field register write renders OR-ed term names in ascending bit order, with no `$` hex literal in the operand, plus a trailing decoded comment naming every field"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#TASK 2 ORACLE: the OR-ed decomposition for BOTH $D011 and $D018 reassembles byte-identically through real ACME, and the exported text is proven non-vacuous"
        status: pass
    human_judgment: false
  - id: D2
    description: "The OR-ed decomposition reassembles byte-identically under real ACME 0.97, and the proof cannot pass on a source that regressed to plain hex literals (the non-vacuity control)."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#TASK 2 ORACLE: ... (byteDiff.equal === true, plus the ` | ` non-vacuity assertions for both $D011 and $D018)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One decoder, two renderers (D-16): anno-export-asm.ts and anno_disassemble both call decomposeRegisterValue(); neither decodes a bit of its own."
    requirement: DECOMP-04
    verification:
      - kind: other
        ref: "grep -ac 'field.mask' src/mcp/vice/anno-export-asm.ts src/mcp/vice/anno-tools.ts -- both 0"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#D-16/D-17 Test 1: anno_disassemble renders a multi-field register write as OR-ed term names plus a decoded comment, on the same line"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every per-field constant is defined exactly once; a name that would be defined twice with two different values is REFUSED by name, naming the symbol and both values."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#D-17 Test 3: each per-field constant is defined exactly once in the header, even when two instructions write the same field value"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#D-17 Test 6: a decomposition that would define one term name with two different values is REFUSED, naming the symbol and both values"
        status: pass
    human_judgment: false
  - id: D5
    description: "anno_disassemble renders the same named constants and decoded comment in its listing as the export, so a Claude session reading code sees what the export proves; anno_read_region's disasm view and the single-field old path are untouched."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#D-16 Test 2: a range with NO enum usage renders exactly what it renders today"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#D-16 Test 3: anno_read_region with view:'disasm' is NOT changed by this task"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#D-16 Test 4: an enum usage naming an enum the store does not hold is REFUSED, matching the export boundary's own refusal shape"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 5: One Decoder, Two Renderers -- the OR-ed Export Proof and the Readable Disassembly Summary

**`decomposeRegisterValue()` now drives BOTH render surfaces: `anno-export-asm.ts` emits OR-ed named bit constants plus a decoded comment under a real-ACME byte-diff proof (D-17), and `anno_disassemble` renders the identical decomposition for readability (D-16), with the old single-symbol path and `anno_read_region` left byte-for-byte untouched.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 completed
- **Files modified:** 4 (`anno-export-asm.ts`, `anno-export-asm.test.ts`, `anno-tools.ts`, `anno-tools.test.ts`)
- **Commits:** 3

## Accomplishments

- `anno-export-asm.ts` gained a new OR-ed multi-bit render path alongside the
  existing single-symbol path. An enum usage whose name matches the
  register-key shape (`registerKeyFor().slice(1)`, e.g. `D018`) is attempted
  through `decomposeRegisterValue()`; when the register has two or more
  fields, the operand renders as `#<term1> | <term2> | <term3>` in ascending
  bit order with no residual hex literal, and a mechanical decode comment
  (`$D018: FIELD=value, ...`) is appended. A single-field register (or an
  enum whose name is not register-shaped at all, e.g. a hand-authored
  `viccolor`) keeps the OLD single-symbol path, proven by a dedicated test
  using the real `$DC00` ("Data Port A") register.
- Every per-field constant is defined exactly once in the header, even
  across multiple instructions writing the same value; a term name that
  would be redefined with a DIFFERENT value is refused by name, naming the
  symbol and both values -- the SAME collision check 30-REVIEW WR-10 added
  for a single enum symbol, extended rather than duplicated. An authored
  store side-comment at the same address renders first, then the mechanical
  decode after a ` -- ` separator, in one merged trailing comment.
  `enumDecompositionCount` is reported as a separate figure from
  `enumSubstitutionCount`, never combined.
- Task 2 added the criterion-5 byte-diff oracle: a synthetic image carrying
  BOTH the `$D011=$1b` and `$D018=$04` writes `fixtures/ghidra/charset-
  phantom.a` itself uses, installed through the same public write path
  (`createProjectEnum`/`applyEnumUsage`) `generateEnumsFromStore()` uses.
  Real ACME 0.97 assembles the exported source and the bytes match the
  source image exactly; a non-vacuity control separately asserts the
  exported text actually contains the ` | ` OR-expression for both
  instructions, so a regression to plain hex literals would fail this case
  even though the bytes would still match.
- `anno_disassemble` is now D-16's second renderer. `dispatchDisassemble()`
  takes the store handle its own tool schema already required and never
  used; a new `renderDisassembleListing()` post-processes `render()`'s
  own output (relying on the fact that this call never sets `showSymbols`,
  so the header is always exactly two lines) to substitute a bound
  register write's operand and append the decoded comment, calling the
  SAME `decomposeRegisterValue()`. An unbound instruction, and
  `anno_read_region`'s `view: "disasm"`, render byte-identically to before.
  A dangling enum usage (the enum it names no longer exists in the store)
  refuses by name, matching the export boundary's own refusal shape,
  rather than rendering a silently plain listing.
- The `anno_disassemble` tool description now states the new rendering
  behaviour, so a caller reading it is not surprised by the operand text.

## Task Commits

1. **Task 1: OR-ed named constants and the decoded comment in the ACME export** - `5f82b075` (feat)
2. **Task 2: Prove the decomposition under real ACME -- the byte-diff oracle case** - `9a508164` (test)
3. **Task 3: The readability renderer -- anno_disassemble uses the store it already requires** - `cda7c786` (feat)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-export-asm.ts` - the OR-ed multi-bit render path,
  `enumDecompositionCount`, the `definedEnumSymbols` Map (was a Set),
  `withComments()`'s new `generatedSuffix` parameter, `REGISTER_ENUM_NAME_RE`
- `src/mcp/vice/anno-export-asm.test.ts` - 8 new tests: the 7 Task 1
  behaviours (D-17 Tests 1-2 combined, 3, 4, 5, 6, 7) plus Task 2's dedicated
  byte-diff oracle case for both `$D011` and `$D018`
- `src/mcp/vice/anno-tools.ts` - `dispatchDisassemble(handle, args)`,
  `renderDisassembleListing()`, `substituteReadableImmediate()`,
  `appendReadableComment()`, the file's own `REGISTER_ENUM_NAME_RE`, the
  `anno_disassemble` tool description
- `src/mcp/vice/anno-tools.test.ts` - 4 new tests (D-16/D-17 Tests 1-4)

## Decisions Made

- `definedEnumSymbols`: Set -> Map<string, number>, so a term redefined with
  a different value is a detectable, named collision rather than a silent
  Set membership check.
- `anno_disassemble`'s new refusals use `AnnoStoreError`, not a bare `Error`,
  and register-address parsing uses `Number("0x...")`, not `parseInt()` --
  both are pre-existing structural guards in `anno-tools.test.ts`, caught by
  running the suite rather than assumed from the plan's action text.
- `REGISTER_ENUM_NAME_RE` is deliberately duplicated (not centrally
  exported) between the two renderer files, matching D-16's "two renderers,
  one decoder" design; only `decomposeRegisterValue()` itself is shared.
- `anno_disassemble`'s substitution logic is a small local function, not a
  reuse of `anno-export-asm.ts`'s exported `substituteImmediateEnum()` --
  that export's own doc comment restricts it to test reach plus
  `exportAsm()`'s one production call site.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A literal match inside my own new header comment tripped the `field.mask` verification gate**
- **Found during:** Task 1's own `<verify>` block (`grep -ac 'field.mask' src/mcp/vice/anno-export-asm.ts`)
- **Issue:** The import comment explaining why `anno-export-asm.ts` must never re-derive a bit mask itself literally contained the string `field.mask` (inside a backtick-quoted `grep` invocation), so the verification gate counted itself as a violation.
- **Fix:** Reworded the comment to describe the same constraint without using the literal substring.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts`
- **Verification:** `grep -ac 'field.mask' src/mcp/vice/anno-export-asm.ts` returns 0
- **Committed in:** `5f82b075` (Task 1 commit)

**2. [Rule 3 - Blocking] `anno-tools.ts`'s own structural guards forbid `parseInt()` and a bare `throw new Error()`**
- **Found during:** Task 3, running `anno-tools.test.ts` after the first draft of `dispatchDisassemble()`/`renderDisassembleListing()`
- **Issue:** Two pre-existing tests in `anno-tools.test.ts` failed: one asserts the file never calls `parseInt(` (a second, divergent numeric-parsing rule beside the store's own), the other asserts the file never throws a bare `Error` (every refusal must be an `AnnoStoreError`, and therefore a `ViceError`). My first draft used both, mirroring `anno-export-asm.ts`'s own style, which carries neither restriction.
- **Fix:** Register-address parsing changed to `Number(\`0x${usage.enumName}\`)`; all five new `throw new Error(...)` call sites changed to `throw new AnnoStoreError(...)` (already imported in this file).
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `node --test anno-tools.test.ts` full suite green (90/91, 1 pre-existing opt-in skip)
- **Committed in:** `cda7c786` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 -- blocking issues surfaced by this file's own pre-existing structural guards). **Impact on plan:** Both fixes were required for the plan's own `<verify>` commands to pass; neither expands scope beyond the plan's stated files.

## Issues Encountered

None beyond the deviations above. Two test-authoring mistakes were caught and
fixed before committing (not deviations from the plan, just incorrect first
drafts of my own tests): an expected `sta+2 $d018` assertion in Task 3's Test
2 was wrong (`$d018` is above `$0100`, so no width force applies -- corrected
to `sta $d018`), and Task 3's Test 4 initially reopened the store with
`mustExist: true` (which opens READ-ONLY) before attempting a write, which
`anno-store.ts`'s own doc comment explains is the "judge an existing image"
mode -- corrected to the default, writable open.

`npm run test:automated` was run twice from `src/mcp/vice`, redirected to a
file with `$?` read on the same line, broker confirmed `inactive` and no
`x64sc` process alive both before and after. Both runs show the SAME stable
3-failure floor `docs/phase45-wave0-measurements.md`'s MEASUREMENT B names
(`anno-register.test.ts` x2, `anno-import.test.ts` x1, all pre-existing
requirement-id findings unrelated to this plan). The first run additionally
showed `text-protocol.test.ts`'s `WR-01 (planted RED, without the fix)` test
failing; the second full run and three isolated re-runs of that file alone
(34/34 green each time) confirm this is a timing-sensitive flake unrelated
to this plan's changes (this plan touches neither `text-protocol.ts` nor
anything in its dependency chain) -- consistent with the project's own
recorded pattern of two named flakes outside the stable floor varying
between runs.

## Known Stubs

None. Every deliverable this plan claims (the OR-ed render path, the
byte-diff oracle proof, the readable `anno_disassemble` renderer) is backed
by real, tested code exercised against the real committed `anno-regbits.json`
table and, where ACME-dependent, a real ACME 0.97 binary -- no placeholder
value or empty default stands in for unimplemented behaviour.

## User Setup Required

None -- no external service configuration required. ACME was already
detected and available locally (`/home/henrik/.local/bin/acme`, release
0.97), so no ACME-dependent test skipped in this session; no host tool was
newly needed. `pgrep -x x64sc` and `systemctl --user is-active vice-broker`
were both confirmed clean before and after this plan's work.

## Next Phase Readiness

- D-16 and D-17 are both fully closed: one decoder, two renderers, both
  proven -- `anno-export-asm.ts` by a real assembler, `anno_disassemble` by
  its own dedicated tests plus the shared decoder's own exhaustive coverage
  from plan 45-03.
- Criterion 5 (hardware register writes render as named enums, `$D011`/
  `$D018` decomposed) is now demonstrably met on the one fixture that
  exercises it (`fixtures/ghidra/charset-phantom.prg`), independent of
  whether that fixture has yet been derived and annotated by a later plan.
- No blockers. The remaining phase work (plans 45-06 through 45-10 per
  45-04-SUMMARY.md's own "Next Phase Readiness") is unaffected by anything
  in this plan's scope.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
