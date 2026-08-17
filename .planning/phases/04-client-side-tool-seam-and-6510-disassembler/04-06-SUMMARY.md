---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 06
subsystem: disassembler
tags: [acme, ci, round-trip, node-test, 6502, security]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 04)
    provides: "disasm-renderer.ts's render()/renderLine() -- the ACME-ready listing this plan feeds to a real acme"
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 05)
    provides: "vice_disassemble on the stock backend -- the dispatchStock() path Suite A drives"
provides:
  - "disasm-roundtrip.test.ts: the real-ACME byte-exact round-trip over all 256 opcodes (Suite A), a realistic fragment (Suite B), D-09's acmeExpressible membership proven in BOTH directions against the installed ACME (Suite C), and the D-11 +2 size-force spelling proof (Suite D)"
  - "CI now installs ACME in the build job (before Test) and verifies the installed binary's own banner before proceeding"
  - "VICE_REQUIRE_ACME=1 on CI's Test step turns a missing ACME into a hard failure of disasm-roundtrip.test.ts, never a silent skip"
  - "14 acmeExpressible corrections in disasm-opcodes.ts, found by running the real assembler, not asserted from a static list"
affects: [04-07-parity-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The one place this repo shells out to a second real ACME instance in a test (not just acme-build's scripts/acme.mjs): spawnSync(ACME_BIN, [...]) argv array, never a shell string -- source text reaches ACME only as file contents (T-04-06-01)"
    - "Suite C's membership test is driven entirely from OPCODES, in BOTH directions, and found a subtler failure mode than 'ACME rejects the syntax': several illegal opcodes share an identical (mnemonic, addressing-mode) pair with no operand to disambiguate, and ACME resolves the bare mnemonic to exactly ONE canonical opcode byte -- accepting the syntax but silently producing the WRONG byte for every other member of the group"

key-files:
  created:
    - .claude/mcp/vice/disasm-roundtrip.test.ts
  modified:
    - .github/workflows/ci.yml
    - .claude/mcp/vice/disasm-opcodes.ts
    - .claude/mcp/vice/disasm-opcodes.test.ts

key-decisions:
  - "Suite C's under-substitution direction (acmeExpressible:false entries) is implemented as 'NOT byte-faithful' (assemble() fails OR produces a different opcode byte than expected), not the plan's literal wording 'assemble() returns ok===false'. The literal wording is empirically false against the real ACME for the illegal nop/ane/lxa family: ACME's parser ACCEPTS the mnemonic+mode syntax for all of them (never errors), but for duplicate-mode groups (5 of the 6 nop subgroups) it silently resolves to a DIFFERENT canonical opcode. The corrected wording matches D-09's own stated authority ('the exact set is determined by the assertion test against the installed ACME') and is the true dual of the over-substitution direction -- documented as a plan-defect correction, not a weakening"
  - "Suite D's literal prediction ('lda $0080 without the force assembles to 2 bytes') does not hold against real ACME 0.97: a 4-hex-digit literal (exactly what disasm-renderer.ts's hex4() always emits) already forces word-width addressing independent of the +2 postfix. Implemented Suite D to assert what is actually true (the +2 spelling is understood and produces the correct 3-byte encoding) plus a non-vacuity proof using an UNPADDED 2-digit literal for the identical value, which DOES shrink to zeropage -- proving the underlying hazard is real even though this codebase's own hex4()-padding mechanism independently closes it. No change to disasm-renderer.ts was needed; both of its actual mechanisms (hex4 padding and the +2 force) are independently correct"
  - "No change needed to disasm-renderer.ts at all -- the plan listed it in files_modified anticipating a possible correction, but empirical testing found none was required; documented instead in Suite D's own header comment and here"

requirements-completed: [DISASM-03]

# Metrics
duration: ~50min
completed: 2026-08-17
---

# Phase 04 Plan 06: ACME Round-Trip Summary

**The tool's own `vice_disassemble` listing reassembles through a real, installed ACME 0.97 ("Zem") to exactly the original bytes across all 256 opcodes, zero exclusions -- and the round-trip found 14 real defects in the `acmeExpressible` substitution table's seed values, corrected against the assembler rather than asserted from a list.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified for task 2; 1 modified for task 1)

## Accomplishments

- **CI (task 1):** `.github/workflows/ci.yml`'s `build` job now installs ACME (`sudo apt-get install -y acme`, verified against Debian trixie's real archive during planning) immediately before the `Test` step, and proves the installed binary really is ACME by running it and grepping its own `--version`/`--help` banner under `set -euo pipefail` -- a wrong package name or broken install fails the job loudly rather than letting the round-trip silently skip. The `Test` step now carries `VICE_REQUIRE_ACME: "1"`, which turns `disasm-roundtrip.test.ts`'s local "no ACME, skip" behaviour into a hard failure whenever CI expects ACME to be present.
- **`disasm-roundtrip.test.ts` (task 2):** four suites, gated by a single `SKIP_REASON` computed once (never a hand-rolled early return), plus one always-run "ACME availability gate (D-08)" test:
  - **Suite A** builds a 256-opcode corpus (one instance of every opcode byte, ascending, with bespoke fillers for `$6C` (NMOS page-wrap, low byte `$ff`) and `$AD` (D-11 shrink hazard, operand `< $0100`)), drives `dispatchStock("vice_disassemble", ...)` through the REAL derived-tool path, follows `nextAddress` past D-13's 100-instruction cap across 3 pages, concatenates the returned `listing` strings, assembles the concatenation through real ACME, and asserts the produced bytes equal the original 546-byte corpus exactly. A local, decoder-level check (independent of the tool path) confirms the corpus itself covers exactly 256 distinct opcode values.
  - **Suite B** round-trips a hand-built 23-byte fragment containing a forward branch, a backward branch, a branch that crosses a `$20xx`/`$21xx` page boundary, `lda $0080` (D-11), `jmp ($10ff)` (D-10's page-wrap note), `jsr $ffd2`, and three illegal-but-expressible opcodes (`lax`, `dcp`, `anc`) -- byte-exact.
  - **Suite C**, driven entirely from `OPCODES` (no hardcoded list), asserts D-09's `acmeExpressible` table in BOTH directions against the real assembler and found genuine defects (below). Emits the final `!byte` substitution set via `console.log` in a stable, greppable form for 04-07.
  - **Suite D** proves the `+2` size-force spelling is understood by ACME and produces the correct byte-exact 3-byte encoding, plus a non-vacuity proof (see Deviations).
- **14 `acmeExpressible` corrections in `disasm-opcodes.ts`,** found by Suite C against the real ACME 0.97 ("Zem") -- not asserted from any static list. Full detail in "Corrections Found" below.
- Full regression: `npm run typecheck` exits 0; `disasm-opcodes.test.ts` + `disasm-decoder.test.ts` + `disasm-renderer.test.ts` (188 tests) exit 0 after updating three seed-sanity assertions that pinned the old, now-corrected values; `npm run test:automated` shows 1187/1193 passing, 5 `todo`, and the ONE failure being the pre-existing, already-logged worktree-path `repo-root.test.ts` case (confirmed unrelated -- no reference to `disasm`/`disassemble`/`acme` anywhere in that file); `npm run smoke` exits 0, advertising 61 tools; `node --test test-gate.test.ts` (the drift guard) exits 0 with the new file correctly joining the automated set.
- Verified locally with `ACME_BIN=/nonexistent/acme VICE_REQUIRE_ACME=1 node --test disasm-roundtrip.test.ts`: exit code 1 (the gate test fails, all four ACME-dependent suites report SKIP with a message naming `ACME_BIN` and the CI install step) -- the proof that CI's loud-failure path actually fires.

## Task Commits

1. **Task 1: Install ACME in CI and make its absence fail the job** - `d12dbfd` (feat)
2. **Task 2: Create disasm-roundtrip.test.ts -- the byte-exact round-trip through a real ACME** - `7054364` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `.github/workflows/ci.yml` - one `Install ACME cross-assembler` step added to the `build` job before `Test`; `Test` step gains `VICE_REQUIRE_ACME: "1"`
- `.claude/mcp/vice/disasm-roundtrip.test.ts` - the round-trip test file (four suites plus the always-run gate)
- `.claude/mcp/vice/disasm-opcodes.ts` - 14 `acmeExpressible` corrections plus header-comment corrections documenting them
- `.claude/mcp/vice/disasm-opcodes.test.ts` - three seed-sanity assertions updated to match the corrected, ACME-verified values

## Corrections Found (the round-trip's actual findings against real ACME 0.97 "Zem")

**Over-substitution (was `true`, corrected to `false` -- 12 entries):** ACME resolves an ambiguous bare mnemonic to exactly ONE canonical opcode byte when several opcodes share an identical `(mnemonic, addressing-mode)` pair with no operand to disambiguate:
- `jam` (implicit, no operand): bare `jam` ALWAYS assembles to `$02`. Only `$02` stays `true`; `$12 $22 $32 $42 $52 $62 $72 $92 $B2 $D2 $F2` (11 opcodes) are corrected to `false`.
- `anc` (immediate): `anc #imm` ALWAYS assembles to `$0B`. `$0B` stays `true`; `$2B` is corrected to `false`.

**Under-substitution (was `false`, corrected to `true` -- 7 entries):** the mnemonic+mode syntax IS byte-faithful (ACME reproduces exactly this opcode), so the old `false` seed was over-conservative or simply untested:
- `nop` (five duplicate-mode subgroups): the LOWEST-numbered opcode in each subgroup is ACME's canonical, byte-faithful choice -- `$04` (zeropage, of `$04/$44/$64`), `$14` (zeropage,X, of `$14/$34/$54/$74/$D4/$F4`), `$1C` (absolute,X, of `$1C/$3C/$5C/$7C/$DC/$FC`), `$80` (immediate, of `$80/$82/$89/$C2/$E2`).
- `nop $0C` (absolute): no duplicate at all -- unambiguous and byte-faithful; the `false` seed was simply untested.
- `ane $8B` and `lxa $AB` (both immediate): ACME accepts both (each with a documented "unstable ANE/LXA #NONZERO" WARNING, not an error) and reproduces the exact byte. The `disasm-opcodes.ts` header comment previously stated "ACME does not accept lxa" -- corrected.

**Confirmed correct, no change (all other entries):** every other `true`/`false` value in the seed matched the real assembler exactly, including the illegal `nop` implied-mode group (`$1A/$3A/$5A/$7A/$DA/$FA`, which stays entirely `false` because ACME's bare `nop` with no operand always resolves to the pre-existing legal `$EA`, never to any illegal implied-mode member) and `$EB` (the illegal duplicate of legal `sbc #imm`, which always resolves to `$E9`).

## Decisions Made

See `key-decisions` in the frontmatter for the two implementation-level corrections (Suite C's under-substitution direction, Suite D's non-vacuity design). Both are documented in-line in `disasm-roundtrip.test.ts`'s own comments as well as here.

## Deviations from Plan

### Plan-defect corrections (not Rule 1-4 auto-fixes -- corrections to the PLAN's own text, per `<plan_defect_watch>`)

**1. Suite C's literal wording ("assert assemble() returns ok===false") does not match reality for several illegal opcodes**

- **Found during:** Task 2, while validating Suite C's under-substitution direction against the real installed ACME before writing the assertion
- **Issue:** The plan's task 2 text says a `false` entry must satisfy "assemble() returns ok === false -- i.e. ACME genuinely rejects it," and that any entry ACME "actually accepts" must be flipped to `true`. Empirically, ACME's PARSER accepts the mnemonic+mode syntax for the entire illegal `nop` family, `ane`, and `lxa` (never returns a non-zero exit status) -- but for duplicate-mode groups it silently resolves to a DIFFERENT canonical opcode byte. Implementing the literal wording would have required flipping all 21 multi-byte illegal `nop` opcodes to `true` (since none of them cause an assemble failure), which then immediately fails the OVER-substitution direction for every member except the one canonical opcode per group -- a direct contradiction within the plan's own two directions.
- **Fix:** Implemented the under-substitution check as "NOT byte-faithful" (`!ok || firstByte !== opcode`), the true logical dual of the over-substitution check, and the reading that matches D-09's own stated authority ("the exact set is determined by the assertion test against the installed ACME, not by this list"). Verified independently via two standalone Node scripts run against the real ACME before writing any test code (see the corrections list above) -- both directions now report zero mismatches.
- **Files affected:** `.claude/mcp/vice/disasm-roundtrip.test.ts` (Suite C's implementation and its explanatory comment)
- **Non-vacuity proof:** before this correction, Suite C (if implemented literally) would have demanded flipping ~21 opcodes to `true` and then failing its own over-substitution check for ~16 of them -- an internally contradictory, un-satisfiable literal spec. The corrected version is internally consistent and was verified to produce zero mismatches in either direction against the real, installed ACME 0.97.

**2. Suite D's literal prediction does not hold against the real ACME**

- **Found during:** Task 2, while probing the `+2` size-force spelling
- **Issue:** The plan predicted "lda $0080 without the force assembles to 2 bytes." Empirically false: ACME 0.97 treats any 4-hex-digit literal (exactly what `disasm-renderer.ts`'s `hex4()` always emits, whether for a raw operand or a substituted symbol's header definition) as forcing word-width addressing, independent of `+2`. `lda $0080` (unforced) and `lda+2 $0080` (forced) both assemble to the identical 3-byte `ad 80 00`.
- **Fix:** Implemented Suite D to assert what is actually true and useful: (a) `+2` is understood and produces the correct byte-exact encoding, matching what Suites A/B already exercise for `$AD`; (b) a non-vacuity proof using an UNPADDED 2-digit literal (`lda $80`) for the identical value, which DOES shrink to the 2-byte zeropage encoding (`a5 80`) -- proving the underlying shrink hazard is real, even though this codebase's own rendering mechanism (hex4 padding, independent of `+2`) already closes it.
- **Files affected:** `.claude/mcp/vice/disasm-roundtrip.test.ts` (Suite D). No change to `disasm-renderer.ts` was needed or made -- both of its actual mechanisms are independently correct against the real assembler.

**Total deviations:** 2 plan-defect corrections (both documented in-file and here, both verified against the real installed ACME, neither a weakening of the assertion)
**Impact on plan:** Both corrections make the test suite MORE faithful to reality than the plan's own literal text, not less -- they were required to make the suite pass without contradicting itself while still proving the real invariant (byte-exact round-trip with zero exclusions).

### Auto-fixed Issues (Rule 1)

None beyond the 14 `acmeExpressible` corrections and the accompanying `disasm-opcodes.test.ts` seed-sanity updates, which the plan itself anticipated and explicitly authorized ("Corrections this task is expected to make... Never weaken the assertion to match the code... Re-run node --test disasm-opcodes.test.ts disasm-renderer.test.ts after any such edit... update that suite's expectation and record the change in the summary").

## Issues Encountered

None blocking. The one-time `vice-mcp-selector: deployed host launcher scripts to .../tools` banner that appeared on this file's very first local test run is an unrelated, pre-existing, idempotent side effect of this worktree's first `install-resources.ts` invocation (triggered by whichever test imports the relevant chain first) -- confirmed by its absence on every subsequent run and the presence of `tools/*.mjs` in the worktree afterward. Not a regression, not specific to this plan.

## Plan Defect Watch

Two plan-text corrections found and fixed, both documented above and in `disasm-roundtrip.test.ts`'s own comments. Both were discovered BEFORE writing the corresponding assertion (by running standalone verification scripts against the real installed ACME first), then implemented against that independent ground truth, then proven non-vacuous (Suite C: verified zero mismatches in both directions on the corrected implementation; Suite D: verified the unpadded-literal hazard is real via a direct, separate assembly).

## User Setup Required

None -- ACME 0.97 ("Zem") was already installed locally at `$HOME/.local/bin/acme` per this environment's setup. CI installs it fresh via `apt-get install -y acme` in the same job, before tests run.

## Next Phase Readiness

- The final `!byte` substitution set (every opcode with `acmeExpressible: false` after this plan's corrections), the ACME version the gate ran against, and the `acmeExpressible`/renderer corrections are all recorded above for 04-07 to copy into `docs/stock-vice-parity.md`.
- **ACME version the gate ran against:** `This is ACME, release 0.97 ("Zem"), 31 Jan 2021` (Platform independent version), both locally and in `.github/workflows/ci.yml`'s Debian trixie / `ubuntu-latest` apt install.
- **Final `!byte` substitution set** (35 opcodes, `acmeExpressible: false`, verified against the installed ACME -- emitted by Suite C's own `console.log` in this exact form):
  `$12, $1A, $22, $2B, $32, $34, $3A, $3C, $42, $44, $52, $54, $5A, $5C, $62, $64, $72, $74, $7A, $7C, $82, $89, $92, $B2, $C2, $D2, $D4, $DA, $DC, $E2, $EB, $F2, $F4, $FA, $FC`
- No blockers for 04-07 or beyond. `disasm-opcodes.ts`'s `acmeExpressible` table is now fully verified against a real, installed ACME in both directions, and `disasm-renderer.ts` needed no changes at all -- confirmed correct as written by 04-04.

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml`
- FOUND: `.claude/mcp/vice/disasm-roundtrip.test.ts`
- FOUND: `.claude/mcp/vice/disasm-opcodes.ts`
- FOUND: `.claude/mcp/vice/disasm-opcodes.test.ts`
- FOUND commit `d12dbfd` (Task 1)
- FOUND commit `7054364` (Task 2)

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*
