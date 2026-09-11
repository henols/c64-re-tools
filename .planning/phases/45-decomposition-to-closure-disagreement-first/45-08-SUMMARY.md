---
phase: 45-decomposition-to-closure-disagreement-first
plan: 08
subsystem: annotation-store
tags: [dxa, export-asm, petcat, closure, decomp-completeness, anno-store, enum-gen]

requires:
  - phase: 45
    provides: "plan 45-06's six derived-half fixture stores (dxa/tracer, dxa/fixture, dxa/basic-stub, export-asm/smc, petcat/computed-sys, petcat/not-basic); plan 45-02's export schema and comment-prefix constants; plan 45-04's completeness gate; plan 45-03's decomposeRegisterValue()/generateEnumsFromStore() route"
provides:
  - "Six fixtures in the dxa/export-asm/petcat family closed: every entry point named with a four-element purpose comment, every referenced non-hardware address resolved or declined, and the decomp-completeness gate passing (exit 0) for all six"
  - "Both of criterion 4's named decline shapes, persisted: export-asm/smc.prg's self-modified operand ($0802) and petcat/computed-sys.prg's runtime-varying zero-page pointer ($2B/$2C)"
  - "A measured, disclosed finding that $D020 (the only register this family writes) is ineligible for the enum route -- no bit-field entry in anno-regbits.json or its OVERRIDES"
affects: [45-09, 45-10]

actuals:
  tokens: 42000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Import-edit-export round trip for closure work: a committed .annostore.json is imported into a fresh scratch sqlite store (gitignored), edited through anno-store.ts's own setLabel()/setComment() (the same functions anno_set_label_name/anno_set_comment dispatch to), then re-exported over the committed file -- no MCP tool call layer needed since D-06 already established the store path never touches the broker"
    - "Purpose comments are one physical line with four ' | '-separated labelled elements, never four literal lines -- assertCommentText() refuses any embedded newline by design (the store holds words the exporter turns into ACME comment text, and a stored newline would put everything after it at column zero as assembler input)"

key-files:
  created:
    - docs/phase45-closure-dxa-family.md
  modified:
    - src/mcp/vice/fixtures/dxa/tracer.annostore.json
    - src/mcp/vice/fixtures/dxa/fixture.annostore.json
    - src/mcp/vice/fixtures/dxa/basic-stub.annostore.json
    - src/mcp/vice/fixtures/export-asm/smc.annostore.json
    - src/mcp/vice/fixtures/petcat/computed-sys.annostore.json
    - src/mcp/vice/fixtures/petcat/not-basic.annostore.json

key-decisions:
  - "The gate's own entryPoints census always includes the image's own .prg load address (image.origin), unconditionally, regardless of whether that address is code -- MEASURED by running the real gate against a fresh, unedited store for all six fixtures before any name was written (every one showed '(0 of 1)', never '(0 of 0)'). This plan's own Task 1 action text predicted '0 of 0' for petcat/computed-sys.prg and petcat/not-basic.prg; the measured gate behaviour contradicts that prediction, so both fixtures' load addresses were named and honestly documented as data (not invented as code) to satisfy the actual, measured requirement rather than the plan's prediction."
  - "anno_join_memmap (runMemmapJoin()) was considered per Task 2's own action text but MEASURED to be a structural no-op for this whole family: it joins over listXrefs() rows, and Ghidra's cross-reference import wrote zero xrefs for all six fixtures (plan 45-06's own measurement, re-confirmed here). The gate's own referencedAddresses census instead derives candidates by decoding the store's code-typed ranges directly (buildReferencedAddresses() in anno-cli.ts) -- that is the real mechanism this plan's resolutions and declines were written against."
  - "No project enum was installed anywhere in this family. generateEnumsFromStore() was run against all three register-writing fixtures (tracer.prg, fixture.prg, smc.prg -- all write only $D020) and found zero eligible register stores each time: $D020 has no entry in the curated anno-regbits.json table and no anno-regbits-gen.ts OVERRIDES entry, so fetchRegisterSearchRows()'s known-register filter excludes every $D020 write. This was NOT worked around by hand-editing the generated-but-committed regbits table (explicitly prohibited) or by widening anno-regbits-gen.ts (an architectural change to a shared generator, out of this plan's scope) -- disclosed fully instead."

requirements-completed: [DECOMP-02, DECOMP-03, DECOMP-04]

coverage:
  - id: D1
    description: "Every code entry point the gate enumerates in the six fixtures (dxa/tracer.prg, dxa/fixture.prg, dxa/basic-stub.prg, export-asm/smc.prg, petcat/computed-sys.prg, petcat/not-basic.prg) has an authored name and a four-element purpose comment (function/inputs/outputs/side effects), checkable per entry point."
    requirement: DECOMP-02
    verification:
      - kind: unit
        ref: "node -e range/duplicate-address assertions against all six committed .annostore.json files (duplicate_addresses=0 for all six); node -e four_elements_present=true and self_modification_documented=true against export-asm/smc.annostore.json -- run during execution, matching this plan's own <verify> commands"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-closure-dxa-family.md -- Task 1 table (every entry point by address/name/comment) and the real decomp-completeness/completeness-report.mjs gate output per fixture, ENTRY POINTS section reading N of N (fully documented) for all six"
        status: pass
    human_judgment: true
    rationale: "The gate mechanically checks that all four labelled elements are present as substrings; whether the prose itself is TRUE (an honest, accurate description of what each routine does) is a human judgement call this plan made in good faith from the fixture's own source (fixture.a, smc.a) but that a reviewer should still read."
  - id: D2
    description: "Every referenced non-hardware address in dxa/fixture.prg (7 addresses) and export-asm/smc.prg (2 addresses) is resolved (named) or declined (DECLINED: comment); both of criterion 4's named decline shapes -- the genuinely path-dependent/runtime-varying operand (export-asm/smc.prg's $0802) and the runtime-varying zero-page pointer (petcat/computed-sys.prg's $2B/$2C, decimal 43/44) -- are persisted."
    requirement: DECOMP-03
    verification:
      - kind: unit
        ref: "node -e checks: export-asm/smc.annostore.json carries exactly one DECLINED: comment at $0802 tagged provenance:authored; petcat/computed-sys.annostore.json carries a DECLINED: comment matching /2b|2B|43|44/; dxa/tracer, dxa/fixture, export-asm/smc all report zero mistagged declines"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-closure-dxa-family.md Task 2 section and the gate's own REFERENCED NON-HARDWARE ADDRESSES output per fixture (dxa/fixture.prg: 7 resolved of 7; export-asm/smc.prg: 1 resolved + 1 declined of 2; all others: 0 of 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The decomp-completeness gate (completeness-report.mjs) exits 0 for all six fixtures in this family, run against the FINAL committed stores, with each of the three NOT EXECUTED fixtures still rendering its own NOT EXECUTED line on a green run."
    requirement: DECOMP-02
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-closure-dxa-family.md -- verbatim gate output for all six fixtures, each showing GATE: PASS and exit=0"
        status: pass
      - kind: unit
        ref: "node --test src/skills/routine-queue-walker/scripts/completeness-report.test.mjs (24/24 pass, unaffected by this plan's fixture edits since it uses its own in-process fixtures)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hardware register writes in this family render as named enum members wherever the current enum route makes that possible."
    requirement: DECOMP-04
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-closure-dxa-family.md Task 3 section -- buildEnumGenerationReport() output for all three register-writing fixtures, all reporting totalRegisterStores: 0, with the measured reason ($D020 absent from anno-regbits.json and its OVERRIDES) named"
        status: fail
    human_judgment: true
    rationale: "This deliverable is NOT met for this family, and is disclosed as such rather than falsified. $D020 is the only register any of these six fixtures writes, and it carries no bit-field entry in the curated table the enum route's own known-register filter reads -- a pre-existing, measured limitation of the shipped code this plan's own files_modified does not include a remedy for (anno-regbits.json/anno-regbits-gen.ts are out of scope and explicitly protected from hand-editing). A human/later plan needs to decide whether to widen the curated table's inclusion rule to admit plain value registers."

duration: ~50min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 8: Close the dxa/export-asm/petcat Fixture Family Summary

**Six derived fixtures (dxa/tracer, dxa/fixture, dxa/basic-stub, export-asm/smc, petcat/computed-sys, petcat/not-basic) closed with authored names, four-element purpose comments, resolved-or-declined referenced addresses, and a passing decomp-completeness gate -- while measuring, and disclosing rather than faking, that this family's only hardware register write ($D020) is ineligible for the enum route.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-11T09:56Z
- **Tasks:** 3 completed (with one measured, disclosed shortfall on Task 3's enum deliverable)
- **Files modified:** 7 (1 created, 6 modified)
- **Commits:** 2

## Accomplishments

- Every entry point the gate enumerates across all six fixtures now carries
  an authored name and a complete four-element purpose comment: `dxa/tracer.prg`
  (`tracer_entry`), `dxa/fixture.prg` (`fixture_entry` plus seven more named
  addresses reached via referenced-address resolution -- `loop_arr`,
  `disp_lo`, `disp_hi`, `arr_src`, `arr_dst`, `dispatch_ptr_lo`,
  `dispatch_ptr_hi`), `dxa/basic-stub.prg` (`basic_stub_entry`),
  `export-asm/smc.prg` (`smc_loop_entry`), `petcat/computed-sys.prg`
  (`computed_sys_program_start`), `petcat/not-basic.prg`
  (`not_basic_data_start`).
- Every referenced non-hardware address the gate's own decoded-instruction
  census finds is resolved or declined: `dxa/fixture.prg`'s all seven
  (`$00fb, $00fc, $0817, $08ab, $08ae, $08bf, $08df`) resolved;
  `export-asm/smc.prg`'s `$0801` resolved, `$0802` declined.
- Both of criterion 4's named decline shapes are persisted: `export-asm/smc.prg`'s
  genuinely path-dependent self-modified operand (`$0802`, incrementing per
  iteration by construction) and `petcat/computed-sys.prg`'s runtime-varying
  zero-page pointer (`$2B`/`$2C`, decimal 43/44, the computed `SYS` target's
  own dependency).
- The `decomp-completeness` gate (`completeness-report.mjs`) exits **0** for
  all six fixtures, run against the FINAL committed stores -- `docs/phase45-closure-dxa-family.md`
  carries the verbatim output for each. The three NOT EXECUTED fixtures
  (`dxa/basic-stub.prg`, `petcat/computed-sys.prg`, `petcat/not-basic.prg`)
  still render their own `NOT EXECUTED` line on this green run.
- Zero survivor label names remain in any of the six stores (the searched
  survivor set was non-vacuous -- every store now carries at least one
  authored label, so the zero-survivor result is a real check, not an empty
  one).
- **Measured, disclosed shortfall:** `generateEnumsFromStore()` was run
  against all three register-writing fixtures (`tracer.prg`, `fixture.prg`,
  `smc.prg` -- all write only `$D020`) and found **zero eligible register
  stores** in every case. `$D020` carries no entry in the curated
  `anno-regbits.json` table and no `anno-regbits-gen.ts` `OVERRIDES` entry,
  so `fetchRegisterSearchRows()`'s known-register filter excludes it
  entirely -- consistent with `45-CONTEXT.md`'s own Flag 3 naming
  `charset-phantom.prg` as the ONLY fixture eligible for the multi-bit
  decomposition demo. No enum was installed anywhere in this family; this
  was NOT worked around by hand-editing the generated-but-committed regbits
  table (explicitly prohibited) or by widening its generator (an
  architectural change outside this plan's own `files_modified`).

## Task Commits

1. **Tasks 1+2 (combined, disclosed sequencing deviation)** - `f22f38cc`
   (feat) -- all six annostore.json files: entry-point names/comments and
   referenced-address resolutions/declines, written in one import-edit-export
   pass per fixture (Task 2 needed Task 1's exact edited store state).
2. **Task 3** - `cbb59f9b` (docs) -- `docs/phase45-closure-dxa-family.md`,
   the full evidence record (entry points by address, declines, the real
   `anno_join_memmap` measurement, the enum-route non-eligibility finding,
   and the final gate output per fixture).

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/fixtures/dxa/tracer.annostore.json` - entry point named and
  documented
- `src/mcp/vice/fixtures/dxa/fixture.annostore.json` - entry point plus
  seven referenced addresses named and documented
- `src/mcp/vice/fixtures/dxa/basic-stub.annostore.json` - entry point named
  and documented (data, not code; stays NOT EXECUTED)
- `src/mcp/vice/fixtures/export-asm/smc.annostore.json` - entry point
  named; self-modified operand declined
- `src/mcp/vice/fixtures/petcat/computed-sys.annostore.json` - entry point
  named; computed-SYS zero-page pointer declined (stays NOT EXECUTED)
- `src/mcp/vice/fixtures/petcat/not-basic.annostore.json` - entry point
  named and documented (stays NOT EXECUTED)
- `docs/phase45-closure-dxa-family.md` - new; the full closure evidence
  record for this family

## Decisions Made

- The gate's `entryPoints` census always includes the image's own `.prg`
  load address regardless of code presence -- MEASURED directly, and both
  petcat fixtures' load addresses were named honestly as data rather than
  left unnamed to chase the plan's own predicted (but measurably incorrect)
  "0 of 0".
- `anno_join_memmap` is a structural no-op for this family (zero xrefs in
  every store); the gate's own decoded-instruction-based `referencedAddresses`
  census is the real mechanism this plan's resolutions were written against.
- No project enum was installed anywhere in this family; see Deviations
  below for the full, measured reason.

## Deviations from Plan

### Disclosed, unresolved shortfall (not auto-fixed -- out of scope by the project's own standing prohibition)

**1. [Disclosed measurement, not a code bug in this plan's own files] The enum route cannot install an enum for this family's only register write ($D020)**
- **Found during:** Task 3, running `generateEnumsFromStore()` against
  `dxa/tracer.prg`, `dxa/fixture.prg` and `export-asm/smc.prg`
- **Issue:** all three fixtures write only `$D020` (VIC-II border colour).
  `fetchRegisterSearchRows()`'s absolute-store pass only counts a write
  whose target key is present in `Object.keys(loadRegBits())`
  (`anno-regbits.json`). `$D020` is not a key in the committed
  `anno-regbits.json`, has no `anno-regbits-gen.ts` `OVERRIDES` entry, and
  `memmap.json`'s own two `$D020` rows describe it as a single scalar
  4-bit value ("Border color (only bits #0-#3)"), never a set of named bit
  fields -- there is nothing to mechanically decompose. This plan's own
  Task 3 action text and `<verify>` command asserted an enum WOULD be
  installed for `tracer.prg`; the measured, real behaviour of the shipped
  code contradicts that.
- **Fix:** NOT applied. Hand-editing `anno-regbits.json` is explicitly
  prohibited by this plan's own `must_haves.prohibitions`; widening
  `anno-regbits-gen.ts`'s inclusion rule to admit a plain value register
  with no bit fields is an architectural change to a generator every other
  register in the project reads, well outside this plan's declared
  `files_modified` and a Rule 4 (architectural) decision, not a Rule 1-3
  auto-fix.
- **Files affected:** none additional -- `tracer.annostore.json`,
  `fixture.annostore.json` and `smc.annostore.json` all retain empty
  `projectEnums`/`enumUsage` arrays.
- **Disclosure:** `docs/phase45-closure-dxa-family.md` Task 3 section (full
  measured reasoning, three independent checks); this SUMMARY's `coverage`
  block (D4, `status: fail`); `.planning/WINDOWS.md` (a `deviation` entry
  recorded via `gsd-tools windows append`).
- **Committed in:** `cbb59f9b` (disclosure only; no code change was made or
  attempted for this finding).

### Disclosed sequencing note (not a numbered rule)

**Tasks 1 and 2 landed in one commit**, per fixture, in a single
import-edit-export pass -- see plan 45-06's own identical precedent. Task
2's referenced-address resolutions read and wrote the SAME scratch store
Task 1's entry-point naming had just edited; re-deriving twice to produce a
"Task-1-only" commit would add no evidentiary value. Both tasks' own
`<verify>` commands were run and passed before the combined commit.

---

**Total deviations:** 1 disclosed-but-not-fixed (out of scope, a shared
generator's own limitation) + 1 disclosed sequencing note (not a numbered
rule). **Impact on plan:** the gate's own numeric stop condition (D-08) does
NOT check for enums at all -- `computeGateFailures()` covers byte census,
survivors, entry points, referenced addresses and disagreement resolution
only -- so all six fixtures' gates PASS regardless of the enum shortfall.
The shortfall is real and disclosed, but it does not block this plan's own
stated stop condition, and is recorded for a later plan/human decision on
whether the curated regbits table's inclusion rule should widen.

## Issues Encountered

None beyond the disclosed enum-route shortfall above.
`docs-dangling-refs.test.ts` (8/8, confirms `docs/` prose is out of
FLOW-02's shipped-source scope) and
`completeness-report.test.mjs` (24/24) are both green.
`pgrep -x x64sc` was confirmed empty throughout -- no emulator was launched;
this plan only reads the already-recorded `anno evid-disagreements` answers
against freshly re-imported scratch stores, never re-runs VICE.

## Known Stubs

None. Every name, comment and decline this plan wrote is a real, reviewed
statement about the fixture's own real bytes/source (`fixture.a`, `smc.a`,
`computed-sys.bas`) or an honest decline naming what is unknown -- no
placeholder value or empty default stands in for unimplemented behaviour.
The one incomplete deliverable (the enum route) is disclosed as incomplete,
not disguised as complete.

## User Setup Required

None -- no external service configuration required. No host tool (VICE,
ACME, dxa, Ghidra) was needed for this plan's own work; all six fixtures'
evidence was already captured by plan 45-06, and this plan only read the
already-recorded `anno evid-disagreements` answers.

## Next Phase Readiness

- The dxa/export-asm/petcat family is fully closed against the
  decomp-completeness gate (D-08's own stop condition): all six fixtures
  exit 0.
- The enum-route limitation for plain value registers (no bit-field entry
  in `anno-regbits.json`) is disclosed and unresolved -- a later plan or the
  project owner should decide whether to widen `anno-regbits-gen.ts`'s
  inclusion rule, or whether this family is simply and permanently outside
  the enum route's scope (matching `45-CONTEXT.md`'s own Flag 3, which
  already named `charset-phantom.prg` as the sole multi-bit-decomposition
  candidate).
- No blockers. `pgrep -x x64sc` confirmed clean throughout and at session
  end.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
