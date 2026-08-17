---
phase: 04-client-side-tool-seam-and-6510-disassembler
verified: 2026-08-17T13:53:42Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Push Phase 4's commits to a branch/PR and confirm .github/workflows/ci.yml's build job actually executes (not skips) the ACME install step and disasm-roundtrip.test.ts's five suites in the real GitHub Actions environment"
    expected: "The 'Install ACME cross-assembler' step succeeds and the Test step (VICE_REQUIRE_ACME=1) reports disasm-roundtrip.test.ts's 5 tests as executed and passing, not skipped"
    why_human: "All of Phase 4's work is committed to local main but has not been pushed to origin (gh run list shows no CI run newer than 2026-08-16). This is a deployment-observable fact only visible in the Actions log after a real push -- it cannot be confirmed by static inspection or local reproduction, even though local reproduction with the exact CI command (VICE_REQUIRE_ACME=1 npm test) already passes 1321/0/11 and disasm-roundtrip.test.ts's 5 suites specifically pass with zero skips (independently re-run during this verification)."
---

# Phase 4: Client-Side Tool Seam and 6510 Disassembler Verification Report

**Phase Goal:** Client-side tools have a home that never sees a host-translated path, and the largest one — the disassembler several later tools depend on — works
**Verified:** 2026-08-17T13:53:42Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Client-side tools are intercepted before `forwardToVice()`'s `rewriteArguments()`, live in sibling modules, and a test proves a derived tool receives the container path never the host-translated one | ✓ VERIFIED | `vice-proxy.ts`'s `buildBackendAwareTool()` (line 3166) routes every stock-backend tool call through `stockDispatch.dispatchStock()`, never `forwardToVice()`. `stock-dispatch.ts` (sibling module, not `vice-proxy.ts`) owns `STOCK_DISPATCH_TABLE`/`dispatchStock()`/`withDerivedTool()`; grep confirms zero live calls to `forwardToVice`/`rewriteArguments` in `stock-dispatch.ts`, `stock-derived.ts`, `stock-disassemble.ts` (only disclaiming comments). `stock-derived.test.ts`'s "D-02 mechanism 1" test is genuinely non-vacuous: it first proves `hostPath()` WOULD rewrite `/workspace/out.png` to `/home/user/project/out.png` under the exact env vars in play, then proves the same input dispatched through `withDerivedTool()` reaches the handler unchanged. `hostpath-consumers.test.ts` independently machine-gates the closed 5-module `hostpath.ts` consumer set and asserts every `STOCK_DERIVED_TOOLS` entry's implementation module is absent from it. All re-run and passing (207/207 in the combined suite). |
| 2 | A user can disassemble a memory range on the stock backend; all 256 opcodes decode with correct lengths, including the undocumented 6510 set and the illegal-`NOP` class (27 opcodes / 6 addressing-mode groups) | ✓ VERIFIED | Independently re-derived a 256-entry length/mode table from oxyron.de's opcode matrix (a source separate from cc65, the project's own transcription source) and diffed it against `disasm-opcodes.ts`'s committed `OPCODES` table: **0 length mismatches across all 256 opcodes**; the one mnemonic difference found ($AB, "lax" vs. project's "lxa") is the project's own documented, deliberate rename to disambiguate from the indexed LAX family. Independently re-counted the illegal-NOP class from that same external table: **exactly 27 opcodes across exactly the 6 claimed addressing-mode groups** (6 implied, 5 immediate, 3 zeropage, 6 zeropage_x, 1 absolute, 6 absolute_x) — matching `disasm-opcodes.ts`'s header comment and `disasm-opcodes.test.ts`'s own assertions exactly. `disasm-opcodes.test.ts`'s bit-pattern derivation test (`deriveMode()`) re-derives mode from the 6502's own `aaabbbcc` opcode structure, independent of the transcription source. Live-tested `vice_disassemble` against a genuine unpatched `/usr/bin/x64sc` (VICE 3.9, no `-mcpserver` patch) at KERNAL address `$FFD2`: tool output was byte-identical and mnemonic-identical to VICE's own text-monitor `d` command output (`JMP ($0326)` / `JMP $F49E` / `JMP $F5DD`). |
| 3 | Branch instructions render the resolved target; a partial instruction is reported truncated not fabricated; `JMP ($xxFF)` carries an NMOS page-wrap warning; symbol substitution is gated by operand role and width | ✓ VERIFIED | `disasm-decoder.ts`: relative-mode branches compute `resolvedTarget = (address + 2 + signed8(offset)) & 0xffff` (rule 5); `disasm-renderer.ts` renders that resolved target (or its substituted symbol), never the raw offset. Truncation: when `available < entry.length`, only the bytes present are recorded, `operand`/`resolvedTarget` are omitted, `notes` gets `"truncated"`, and the decode loop stops — no fabricated bytes; the renderer emits truncated instructions as `!byte` with no mnemonic. `JMP ($xxFF)`: decoder sets `pageWrap = true` only for opcode `0x6c` with operand low byte `0xff`; renderer emits the fixed NOTE_TEXT `"NMOS page-wrap: the high byte is fetched from $xx00, not the next page"` as a trailing comment. Substitution gating: `disasm-renderer.ts`'s `renderMnemonicOperand()` never calls `resolveSymbol()` for `immediate` or any `zeropage*` operand role (hardcoded, commented rationale: `#<`/`#>` ambiguity and zeropage-widening risk); it does call it for `indirect`, `relative`, and `absolute*` operands, and forces `+2` width whenever an absolute-family value is `< 0x100` so a symbol substitution can never shrink the encoding. `disasm-roundtrip.test.ts` Suite B independently exercises all four of these (a page-crossing branch, the page-wrap note, the D-11 shrink hazard, `jsr`) against a real ACME and gets a byte-exact round-trip. |
| 4 | Disassembly re-assembles through ACME, round-trip test's exclusions enumerated and asserted, not skipped | ✓ VERIFIED | Re-ran `disasm-roundtrip.test.ts` locally against the real installed ACME 0.97 ("Zem") at `$HOME/.local/bin/acme`: all 5 suites executed (0 skipped) and passed — the full-256-opcode round trip (Suite A), a realistic fragment covering branches/page-wrap/shrink-hazard/jsr (Suite B), the `acmeExpressible` substitution table asserted in BOTH directions driven from `OPCODES` data, never a hardcoded list (Suite C — found and prints the 34-opcode `!byte` set live), and the `+2` size-force spelling proof with its own non-vacuity control (Suite D). The "ACME availability gate" test hard-fails (not skips) when `VICE_REQUIRE_ACME` is set and no ACME is found — confirmed this branch is live in `.github/workflows/ci.yml`'s Test step. Re-ran the full `VICE_REQUIRE_ACME=1 npm test` locally: 1321 pass / 0 fail / 11 skip (skip set is the 4 pre-existing manual/live-emulator suites plus none of Phase 4's own files). |
| 5 | The disassembler adds no npm dependency, no GPL-licensed material, and the opcode table's zlib provenance is attributed in source and third-party notices | ✓ VERIFIED | `disasm-opcodes.ts`'s own header attributes the cc65 zlib source with commit hashes and reproduces the zlib obligations. `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` independently attributes the same source with the full zlib licence text, explicitly states no GPL material is incorporated, and explicitly disclaims VICE (GPL-2) and ACME (GPL, subprocess-only, never shipped) as non-sources. Root `THIRD-PARTY-NOTICES.md` points at the canonical file. `scripts/check-npm-packages.mjs` machine-gates: the notices file must be in the packed tarball's `files[]` (confirmed failing when removed, per orchestrator's prior check), a transitive-closure walk from `vice-proxy.ts` asserts every reachable module ships, and the packed tarball's runtime `dependencies` must exactly equal the pre-phase set (confirmed byte-identical). Grep of the disassembler source tree found zero VICE source references outside the disclaiming comments. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/disasm-opcodes.ts` | 256-entry opcode table, zero imports | ✓ VERIFIED | 256 entries confirmed; zero-import rule enforced by its own test; lengths independently cross-checked against oxyron.de (0 mismatches) |
| `.claude/mcp/vice/disasm-opcodes.test.ts` | Bit-pattern derivation test | ✓ VERIFIED | `deriveMode()` re-derives mode from `aaabbbcc` structure independent of the table; 27/6-group NOP assertion present and correct |
| `.claude/mcp/vice/disasm-decoder.ts` | Pure `decode()`, no transport imports | ✓ VERIFIED | Only imports `disasm-opcodes.ts`; branch/truncation/page-wrap logic all confirmed by direct read and by Suite B's real-ACME round-trip |
| `.claude/mcp/vice/disasm-renderer.ts` | Pure `render()`/`renderLine()`, injected symbol resolver | ✓ VERIFIED | No `stock-*`/`vice*`/`node:` import; substitution gating confirmed by direct read |
| `.claude/mcp/vice/stock-derived.ts` | Derived-tool leaf: registry, `derivedContainerPath()` | ✓ VERIFIED | Sibling module (not `vice-proxy.ts`); no `hostpath.ts` import (machine-gated) |
| `.claude/mcp/vice/stock-dispatch.ts` | `withDerivedTool()` adapter, `STOCK_DISPATCH_TABLE`, `dispatchStock()` | ✓ VERIFIED | `vice_disassemble` registered via `withDerivedTool(..., { needsSession: true }, ...)`; no fall-through to `forwardToVice()` |
| `.claude/mcp/vice/stock-disassemble.ts` | `handleDisassemble` — parse, bounded read, decode+render, answer | ✓ VERIFIED | Live-tested against real stock VICE; byte-exact match to VICE's own text-monitor disassembly at `$FFD2` |
| `.claude/mcp/vice/stock-address.ts` | Symbol resolver hook, `parseAddress()`/`parseByteCount()` | ✓ VERIFIED | Enforces `0..0xffff`, mitigating WR-01 (below) at the only current call site |
| `.claude/mcp/vice/disasm-roundtrip.test.ts` | Real-ACME round-trip, both-direction substitution assertion | ✓ VERIFIED | Re-ran locally: 5/5 pass, 0 skip, against real ACME 0.97 |
| `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` + root pointer | zlib provenance, no-GPL statement | ✓ VERIFIED | Present, correct, packaging-gated |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `vice-proxy.ts` (`buildBackendAwareTool`) | `stock-dispatch.ts` (`dispatchStock`) | stock-backend branch, no `forwardToVice()` fallthrough | WIRED | Confirmed by direct read of both files and by `stock-dispatch.ts`'s own zero-`forwardToVice`-calls invariant |
| `stock-dispatch.ts` | `stock-derived.ts` | `import { STOCK_DERIVED_TOOLS }` | WIRED | One-directional; `stock-derived.ts` imports `stock-dispatch.ts` only as `import type` (erases at compile time, no runtime cycle) |
| `stock-dispatch.ts` | `stock-disassemble.ts` | `STOCK_DISPATCH_TABLE.vice_disassemble: withDerivedTool(...)` | WIRED | Confirmed in table literal; live-tested end-to-end against real VICE |
| `stock-disassemble.ts` | `disasm-decoder.ts` / `disasm-renderer.ts` | `decode()` / `render()` calls over `MEM_GET` bytes | WIRED | Confirmed by direct read; live-tested |
| `stock-disassemble.ts` | `stock-address.ts` | `symbolNameFor` injected as `render()`'s `symbolFor` | WIRED | Confirmed; `show_symbols` with no store installed is a no-op that says so (`symbolNote` field present in live answer) |
| `package.json` `files[]` | disassembler module closure | `scripts/check-npm-packages.mjs` transitive-closure walk | WIRED | Machine-gated; confirmed non-vacuous by orchestrator's prior removal test |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `stock-disassemble.ts`'s `handleDisassemble` | `response.bytes` (real memory) | `session.client.send(CommandType.MemoryGet, ...)` over a real binary-monitor socket | Yes — confirmed by a live test against a genuine unpatched `/usr/bin/x64sc` (VICE 3.9), returning real KERNAL ROM bytes at `$FFD2` that byte-exactly match VICE's own text-monitor `d ffd2 ffd8` output | ✓ FLOWING |
| `disasm-renderer.ts`'s `symbolFor` | `symbolNameFor` (stock-address.ts) | Injected resolver, `null` when no store is loaded | Honest no-op: live answer carries `"symbolsApplied": false` and an explanatory `symbolNote`, never a silently-wrong substitution | ✓ FLOWING (honest-absent case) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `vice_disassemble` decodes a real KERNAL address correctly | Live `dispatchStock("vice_disassemble", { address: "$ffd2", count: 6 }, deps)` against genuine `/usr/bin/x64sc -binarymonitor`, cross-checked against the same VICE's own text monitor `d ffd2 ffd8` | Tool: `jmp ($0326)` / `jmp $f49e` / `jmp $f5dd` / ... — byte-identical to text monitor's `6C 26 03 JMP ($0326)` / `4C 9E F4 JMP $F49E` / `4C DD F5 JMP $F5DD` | ✓ PASS |
| All 256 opcodes have correct instruction length | Length table independently re-derived from oxyron.de's opcode matrix, diffed against `disasm-opcodes.ts`'s `OPCODES` | 0 mismatches out of 256 | ✓ PASS |
| Illegal-NOP class is 27 opcodes / 6 groups (not 12) | Same independent source, filtered to `nop`+illegal, grouped by mode | Exactly 27, exactly the 6 claimed groups with the exact member counts (6/5/3/6/1/6) | ✓ PASS |
| Full automated suite | `VICE_REQUIRE_ACME=1 npm test` (repeated, this session) | 1321 pass / 0 fail / 11 skip | ✓ PASS |
| Real-ACME round-trip suite specifically | `node --test disasm-roundtrip.test.ts` (this session) | 5/5 pass, 0 skip | ✓ PASS |
| Typecheck | `npm run typecheck` (this session) | Clean, exit 0 | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-shaped probes are declared by this phase's PLAN/SUMMARY files or exist under `scripts/`. N/A for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| DERIV-07 | 04-02 | Derived tools live in sibling modules, intercepted before argument rewriting | ✓ SATISFIED | `stock-derived.ts`/`stock-dispatch.ts`; non-vacuous behavioural test + closed-consumer-set test, both re-run passing |
| DISASM-01 | 04-05 | User can disassemble a memory range on the stock backend | ✓ SATISFIED | Live-tested against genuine unpatched stock VICE; byte-exact vs. text monitor |
| DISASM-02 | 04-01, 04-03 | All 256 opcodes decode with correct lengths, undocumented set included | ✓ SATISFIED | Independently re-derived length table (0 mismatches); bit-pattern derivation test; 27/6-group NOP class independently confirmed |
| DISASM-03 | 04-06 | Round-trip through ACME with documented, asserted exclusions | ✓ SATISFIED | 5/5 real-ACME suites re-run passing, 0 skipped |
| DISASM-04 | 04-03 | Branch instructions render resolved target | ✓ SATISFIED | `resolvedTarget` computation confirmed in `disasm-decoder.ts`; rendered by `disasm-renderer.ts` |
| DISASM-05 | 04-03 | Truncation reported, never fabricated | ✓ SATISFIED | Confirmed in `decode()`'s truncation branch; no operand bytes invented |
| DISASM-06 | 04-04, 04-05 | Symbol substitution gated by operand role and width | ✓ SATISFIED | Confirmed: never substituted for immediate/zeropage-family; width-forced for absolute-family |
| DISASM-07 | 04-07 | No new npm dependency, no GPL material | ✓ SATISFIED | Packaging gate machine-enforced; dependencies byte-identical pre/post phase; THIRD-PARTY-NOTICES.md present in both source and notices form |

**No orphaned requirements.** All 8 IDs declared across the phase's PLAN frontmatter (`DERIV-07`, `DISASM-01` through `DISASM-07`) appear in `.planning/REQUIREMENTS.md`'s Derived tools / Disassembler sections, mapped to Phase 4 in the traceability table. `REQUIREMENTS.md`'s top-level checkboxes for `DISASM-01/03/04/05/06/07` are still unchecked and the traceability table still says "Pending" — this is expected process sequencing (Phase 3's own history shows the checkbox/traceability update happens in a `docs(phase-N): verification results, requirement traceability` commit made AFTER verification passes, not before), not a code gap.

### Anti-Patterns Found

None found in the phase's own files. Grepped all Phase 4 source files (`disasm-*.ts`, `stock-derived.ts`, `stock-dispatch.ts`, `stock-disassemble.ts`, `stock-address.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/empty-return patterns: zero matches outside comments explicitly documenting deliberate, tested design decisions (e.g. "never fabricate", "no fix required" on IN-03).

The code review (`04-REVIEW.md`) already surfaced and this verification independently confirmed:

- **WR-01 (Warning, not Blocker):** `disasm-decoder.ts`'s `decode()` accepts a `startAddress` outside `0..0xffff` and silently wraps it via `& 0xffff`, rather than rejecting it. Confirmed by direct read: `isNonNegativeSafeInteger()` has no upper bound. Currently **not reachable** through the shipped `vice_disassemble` tool — `stock-address.ts`'s `parseAddress()` enforces `0..0xffff` before `decode()` is ever called, confirmed by reading `stock-address.ts:95-96`'s `inAddressRange()`. This becomes a live risk only for Phase 5's backtrace (DERIV-02) and Phase 6's CPU-history decode (GAIN-01) if either imports `decode()` directly without going through `parseAddress()` first and has its own off-by-one bug that produces an out-of-range address. Not a Phase 4 blocker; carried forward as a documented risk for those future phases to either fix or explicitly accept.
- **IN-01/IN-02/IN-03 (Info):** operand-text formatting duplication (documented trade-off), symbol Map's no-duplicate-detection (unreachable today, resolver is `null`), and `count`/`end`'s own missing upper bound (harmless, bounded by `bytes.length` in practice). None affect any of the five success criteria.

### Human Verification Required

### 1. CI actually executed the ACME round-trip on a real push

**Test:** Push Phase 4's commits (currently only on local `main`, unpushed — `gh run list` shows no CI run since 2026-08-16, predating this phase) to a branch or PR, and open the resulting `build` job's log.
**Expected:** The "Install ACME cross-assembler" step succeeds, and the Test step (running with `VICE_REQUIRE_ACME=1`) shows `disasm-roundtrip.test.ts`'s 5 tests executed and passing — not skipped.
**Why human:** This is a deployment/CI-environment fact, only observable in the GitHub Actions log after a real push exists to inspect. It cannot be verified by reading files or running tests locally, even though the *mechanism* (CI env var wiring, ACME install step, non-skip gate) is already confirmed correct by source inspection and by a local re-run using the exact same `VICE_REQUIRE_ACME=1 npm test` command CI uses (1321 pass / 0 fail / 11 skip, disassembler suites among the passes, zero disassembler-related skips).

### Gaps Summary

No functional gaps found. All 5 ROADMAP success criteria are independently verified against the actual codebase — not merely re-read from SUMMARY claims — including:

- An independent, external re-derivation of all 256 opcode lengths (0 mismatches) and the illegal-NOP class (exactly 27 opcodes / 6 groups, matching the phase's own corrected claim, not the ROADMAP's stale "twelve").
- A live end-to-end test against a genuine, unpatched stock VICE 3.9 binary (`/usr/bin/x64sc`, no `-mcpserver` patch), with output cross-checked byte-for-byte against that same VICE's own text-monitor disassembly.
- A structural trace of the derived-tool interception seam confirming it precedes `rewriteArguments()`/`forwardToVice()` with no fall-through path, backed by a non-vacuous behavioural test with its own working negative control.
- A fresh local run of the real-ACME round-trip suite (5/5 pass, 0 skip) and the full automated suite (1321/0/11).
- Direct confirmation that the GPL/zlib provenance is attributed in both the source header and `THIRD-PARTY-NOTICES.md`, and that no npm dependency or GPL material was added.

The single open item is not a code gap: Phase 4's commits have not yet been pushed to a remote branch, so the CI-specific claim ("the round-trip runs in CI as a real gate") cannot be observed in an actual Actions run yet, only reproduced locally with CI's exact command. This routes to `human_needed` rather than `passed` per the workflow's own decision tree (a non-empty human-verification section overrides an otherwise-full score), but does not block confidence in the phase goal being achieved in the codebase today.

---

_Verified: 2026-08-17T13:53:42Z_
_Verifier: Claude (gsd-verifier)_
