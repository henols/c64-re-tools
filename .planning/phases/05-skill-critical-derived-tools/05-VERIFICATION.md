---
phase: 05-skill-critical-derived-tools
verified: 2026-08-17T19:09:38Z
status: gaps_found
score: 2/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A user can read decoded VIC-II and CIA state on the stock backend, with every internal field stock cannot read marked explicitly unavailable -- never reported as zero"
    status: failed
    reason: >
      All three chip/sprite reads (stock-vicii.ts, stock-cia.ts, stock-sprites.ts) hardcode
      `bank: 0x0000` (the CPU view, which follows $00/$01 banking) instead of resolving the
      `io` bank id via stock-memory.ts's already-exported bankCatalogFor(). Live-reproduced
      independently against a genuine unpatched /usr/bin/x64sc (VICE 3.9) using the ACTUAL
      production handlers (not a reimplementation): after `MEM_SET $01=$34` (I/O banked out --
      a routine loader/depacker/IRQ state), handleViciiGetState returns `isError:false` with
      `borderColour:15`, `spriteEnabled:[false x8]`, `rasterLine:256`, and NONE of the fields
      normally reported live are moved into `unavailable` -- the answer is indistinguishable
      from a genuine read. Same live-reproduced for handleCiaGetState (portA/portB report
      `raw:255` with plausible-looking joystick state) and handleSpriteGet (screenBase,
      pointerTableAddress, vicBank all wrong, no note). This is worse than the zero-reporting
      criterion 3 was written to prevent: the value is plausible-looking and wrong, and the
      registry-based `{available:false,reason}` mechanism (which does work correctly for the
      11 enumerated internal-only fields) never engages because the bug arrives through the
      address argument, not the field registry.
    artifacts:
      - path: ".claude/mcp/vice/stock-vicii.ts"
        issue: "Line 277: `memGetBody({..., bank: 0x0000})` -- never resolves the io bank"
      - path: ".claude/mcp/vice/stock-cia.ts"
        issue: "Line 339: same hardcoded `bank: 0x0000`"
      - path: ".claude/mcp/vice/stock-memory.ts"
        issue: "Exports bankCatalogFor()/resolveBank() for exactly this purpose; zero callers in stock-vicii.ts, stock-cia.ts, or stock-sprites.ts (confirmed by grep -- no import)"
    missing:
      - "Resolve the io bank id from bankCatalogFor() and read VIC-II/CIA registers through it, refusing rather than guessing if no io bank entry exists"
      - "State which bank was read on the answer"
      - "A live regression test (guarded by the existing opt-in live harness) that sets $01=$34 and asserts the chip-state answer still reports real register values"
  - truth: "A user can read and inspect sprites, including ASCII rendering, on the stock backend"
    status: failed
    reason: >
      Same root cause as above (stock-sprites.ts:230,272,546 all hardcode `bank: 0x0000`), plus
      an independent, live-reproduced rendering defect: `vice_sprite_inspect` attaches the
      multicolour ASCII legend (with '@' and '%' bit-pair meanings) to a hi-res (non-multicolour)
      sprite's render, even though the fork's own binary-per-pixel hi-res rendering uses only
      '.' and '#'. Reproduced live against the default-banked, default-booted machine (no $01
      manipulation needed): `handleSpriteInspect({sprite_number:0, format:'ascii'})` returns
      `multicolour:false` together with
      `legend: "'.' = transparent (00), '#' = sprite colour (10), '@' = multicolour 1 (01), '%' = multicolour 2 (11)"`
      -- an agent reading the grid is told two symbols exist that this render never produces
      and that '#' means something it does not for this sprite.
    artifacts:
      - path: ".claude/mcp/vice/stock-sprites.ts"
        issue: "Lines 74-75/603: SPRITE_ASCII_LEGEND is a single constant attached regardless of `multicolour`; also lines 230/272/546 share CR-01's bank bug"
    missing:
      - "Two legend constants selected on the per-sprite `multicolour` flag"
      - "Read the pointer table and sprite data through the emulator's `ram` bank id, not the CPU-view bank 0, and add an I/O-window hazard note for VIC bank 3 (analogous to the existing char-ROM window note for banks 0/2)"
deferred: []
human_verification: []
---

# Phase 5: Skill-Critical Derived Tools Verification Report

**Phase Goal:** Every tool the six shipped skills actually call either works on stock or is explicitly routed to the fork
**Verified:** 2026-08-17T19:09:38Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|------|--------|----------|
| 1 | A user can search and compare memory ranges on the stock backend | ✓ VERIFIED | Live-reproduced against real `/usr/bin/x64sc` (VICE 3.9) via the actual `handleMemorySearch`/`handleMemoryCompare`: exact-pattern search on BASIC ROM returned the correct single match; a ranges-mode compare between $A000 and $E000 returned 17 correct byte-level diffs. `npm run test:automated` = 1349/0/0, matches baseline. |
| 2 | A user can load a symbol file and have addresses resolved to symbol names on the stock backend | ⚠️ VERIFIED (with a warning) | Live-reproduced: loading a real VICE-format `.lbl` and looking up both by name and by address (`"$d020"` and `53280`) both resolve correctly in both directions; `vice_disassemble`'s `show_symbols` path is unmodified (Phase 4 extension point, per code and 05-02-SUMMARY). **However**, `vice_symbols_lookup`'s own declared `outputSchema` requires `query.address: number`, and the handler echoes the raw argument — confirmed live: `{address:"$d020"}` yields `query:{"address":"$d020"}`, a string, violating the schema on a form the tool's own tests exercise. Functional capability works; the schema-conformance promise (part of D-03/D-06's cross-cutting contract) does not. See WR-01. Not blocking criterion 2's core claim, but a real defect. |
| 3 | A user can read decoded VIC-II and CIA state on the stock backend, with every internal field stock cannot read marked explicitly unavailable — never reported as zero | ✗ FAILED | Live-reproduced independently (see gaps). All chip-state reads use the CPU-view bank (`0x0000`) instead of the `io` bank `stock-memory.ts` already exposes via `bankCatalogFor()`. With I/O banked out ($01=$34, a routine loader/depacker/IRQ-scan state), both `vice_vicii_get_state` and `vice_cia_get_state` return fully "available" fabricated register state with no `unavailable` marker at all — the exact failure mode criterion 3 exists to prevent, arriving through the address argument rather than the field registry. |
| 4 | A user can read and inspect sprites, including ASCII rendering, on the stock backend | ✗ FAILED | Live-reproduced: same bank-0 bug (`handleSpriteGet` after $01=$34 returns wrong `screenBase`/`pointerTableAddress`/`vicBank` with no note) plus an independently live-reproduced legend defect — `vice_sprite_inspect` attaches the multicolour legend to a hi-res sprite render on a default-booted machine (no special setup needed to trigger this one). |
| 5 | Running each of the six skills' documented tool calls against the stock backend produces no unadvertised-tool failure except the three proven-unrecoverable tools | ✓ VERIFIED | `node scripts/check-skill-tool-coverage.mjs` exits 0: "35 distinct vice_* names extracted ... 25 resolved as advertised ... Classified: 2 proxy-local, 1 deny-listed, 2 not-a-tool-name, **3 fork-only-unrecoverable**, 2 pending-later-phase" — the fork-only-unrecoverable count matches the criterion's named exception set (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`). |

**Score:** 2/5 truths fully verified, 1 verified-with-warning, 2 failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/stock-memory-search.ts` | handleMemorySearch/handleMemoryCompare | ✓ VERIFIED | Exists, exports both, wired into `stock-dispatch.ts`, live-confirmed functional |
| `.claude/mcp/vice/stock-symbols.ts` | handleSymbolsLoad/handleSymbolsLookup | ⚠️ VERIFIED (warning) | Exists, wired, workspace containment live-confirmed working; output-schema echo defect (WR-01) live-confirmed |
| `.claude/mcp/vice/stock-vicii.ts` | handleViciiGetState, decodeVicii, VICII_UNAVAILABLE_FIELDS | ✗ WRONG DATA VIEW | Exists, exports present, registry mechanism for the 11 enumerated fields works correctly in isolation, but the bank-0 bug (CR-01) makes the whole answer unreliable whenever I/O is banked out |
| `.claude/mcp/vice/stock-cia.ts` | handleCiaGetState, decodeCia, CIA_UNAVAILABLE_FIELDS | ✗ WRONG DATA VIEW | Same bank-0 bug, live-confirmed |
| `.claude/mcp/vice/stock-sprites.ts` | handleSpriteGet, handleSpriteInspect, renderers | ✗ WRONG DATA VIEW + legend bug | Same bank-0 bug plus live-confirmed hi-res/multicolour legend mismatch |
| `.claude/mcp/vice/stock-memory.ts` | bankCatalogFor()/resolveBank() (pre-existing, Phase 3) | ✓ EXISTS, BYPASSED | Confirmed exported and used correctly by `vice_memory_read`/`vice_memory_write`/`vice_memory_banks`; confirmed by grep that stock-vicii.ts/stock-cia.ts/stock-sprites.ts import nothing from it |
| `.claude/mcp/vice/tools-manifest.stock.json` | 34 tools total (26+4+4) | ✓ VERIFIED | `node -e` count = 34 |
| `.claude/mcp/vice/package.json` files[] | 44 entries | ✓ VERIFIED | `node -e` count = 44 |
| `.claude/mcp/vice/stock-derived.ts` STOCK_DERIVED_TOOLS | 9 tools | ✓ VERIFIED | 9-member Set confirmed by direct read |
| `scripts/check-skill-tool-coverage.mjs` | criterion-5 gate | ✓ VERIFIED | Exits 0, non-vacuous (35 extracted names, 3 fork-only-unrecoverable matching the named exception set) |
| `docs/stock-vice-parity.md` | records divergences + DERIV-05 gain | ⚠️ INCOMPLETE per CR-01 | Records the intended 11 unavailable fields and the sidefx claim, but (per WR-12, independently plausible from the CR-01 finding) does not warn that a chip-state answer with I/O banked out is silently wrong rather than marked unavailable |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stock-vicii.ts` / `stock-cia.ts` / `stock-sprites.ts` | `stock-memory.ts` | `bankCatalogFor()` resolving the `io`/`ram` bank | ✗ NOT WIRED | Confirmed by grep: zero imports from stock-memory.ts in any of the three modules |
| `stock-dispatch.ts` | `stock-memory-search.ts`, `stock-symbols.ts`, `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts` | `STOCK_DISPATCH_TABLE` via `withDerivedTool` | ✓ WIRED | `npm run test:automated` 1349/0/0 includes conformance-harness dispatch tests for all 9 derived tools |
| `stock-symbols.ts` | `stock-address.ts` | `setSymbolResolver()` | ✓ WIRED | Live-confirmed: loaded symbol resolves through lookup in both directions |
| `package.json` files[] | the 5 new modules | same-commit `files[]` entries | ✓ WIRED | 44-entry count matches baseline; `npm run test:automated`/`typecheck` clean |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `handleViciiGetState` | `response.bytes` (47-byte VIC-II block) | live `MEM_GET` over the CPU-view bank (0x0000) | Real bytes, but from the **wrong memory device** whenever I/O is banked out | ⚠️ HOLLOW under a common condition — flows, but the source is not what the field name promises |
| `handleCiaGetState` | `response.bytes` (16-byte CIA block) | same CPU-view-bank issue | Same | ⚠️ HOLLOW under a common condition |
| `handleSpriteGet`/`handleSpriteInspect` | pointer table + sprite data bytes | same CPU-view-bank issue (compounded: pointer-derived addresses can land in $D000-$DFFF, VIC bank 3) | Same | ⚠️ HOLLOW under a common condition |
| `handleMemorySearch`/`handleMemoryCompare` | live `MEM_GET` results | direct wire read, no derived bank assumption beyond the caller's explicit `bank` argument | Real | ✓ FLOWING |
| `handleSymbolsLoad`/`handleSymbolsLookup` | parsed `.lbl` file | `node:fs` read inside the container, workspace-contained | Real | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` | clean, no output | ✓ PASS |
| `npm run test:automated` | `node --test` via `test-gate.mjs` | 1354 total / 1349 pass / 0 fail / 5 todo | ✓ PASS (matches baseline) |
| `node scripts/check-skill-tool-coverage.mjs` | repo-root CLI gate | exit 0, non-vacuous | ✓ PASS |
| Stock manifest tool count | `require("tools-manifest.stock.json").tools.length` | 34 | ✓ PASS (matches baseline) |
| Fork manifest tool count | `require("tools-manifest.json").tools.length` | 62 | ✓ PASS (matches baseline, unchanged) |
| `package.json` files[] count | `require("package.json").files.length` | 44 | ✓ PASS (matches baseline) |
| `STOCK_DERIVED_TOOLS` size | direct read of the Set literal | 9 | ✓ PASS (matches baseline) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo for this phase; the phase's own validation strategy substitutes live-VICE checks against the real production handlers, run above under "Goal Achievement." `probe-binmon.mjs` (Phase 1 artifact, unrelated to this phase's tools) was not re-run as it does not cover DERIV-01/04/05/06.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| DERIV-01 | 05-01, 05-06, 05-08 | Search/compare memory ranges on stock | ✓ SATISFIED | Live-confirmed functional; `REQUIREMENTS.md` already marked `[x]` Complete (commit `cd295ec`) |
| DERIV-04 | 05-02, 05-06, 05-08 | Load symbol file, resolve addresses to names | ⚠️ PARTIALLY SATISFIED | Core capability live-confirmed working; WR-01 schema-conformance defect live-confirmed. **`REQUIREMENTS.md` line 54 still reads `[ ]` Pending and its traceability table (line 183) still says "Pending"**, despite 05-02-SUMMARY.md and 05-08-SUMMARY.md both declaring `requirements-completed: [DERIV-04]`. The SUMMARY claim was never reflected in the requirements doc — a real traceability gap independent of the functional defect. |
| DERIV-05 | 05-03, 05-04, 05-07, 05-08 | Decoded VIC-II/CIA state, unavailable fields marked | ✗ BLOCKED | CR-01, live-confirmed. `REQUIREMENTS.md` marks this `[x]` Complete (commit `7061e3c`), which is not accurate given the live-reproduced failure. |
| DERIV-06 | 05-05, 05-07, 05-08 | Read/inspect sprites incl. ASCII | ✗ BLOCKED | CR-02 + legend defect, both live-confirmed. **`REQUIREMENTS.md` line 56 still reads `[ ]` Pending**, despite 05-05-SUMMARY.md and 05-08-SUMMARY.md declaring `requirements-completed: [DERIV-06]` — consistent with (in this one case, correctly reflecting) the actual unresolved state, but for the wrong reason (never updated, not intentionally left open). |

No orphaned requirements: all four IDs the phase criteria name (DERIV-01, DERIV-04, DERIV-05, DERIV-06) appear in at least one plan's `requirements:` frontmatter field, and `REQUIREMENTS.md`'s Phase 5 traceability rows account for all four (plus DERIV-02/03, correctly cut).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `stock-vicii.ts` | 277 | Hardcoded `bank: 0x0000` where a resolved bank was required | 🛑 BLOCKER | Criterion 3 failure, live-confirmed (CR-01) |
| `stock-cia.ts` | 339 | Same | 🛑 BLOCKER | Criterion 3 failure, live-confirmed (CR-01) |
| `stock-sprites.ts` | 230, 272, 546 | Same, plus VIC-bank-3 I/O-window aliasing on pointer-derived addresses | 🛑 BLOCKER | Criterion 4 failure, live-confirmed (CR-02) |
| `stock-sprites.ts` | 74-75, 603 | Single ASCII legend attached regardless of `multicolour` | ⚠️ WARNING | Criterion 4 partial failure, live-confirmed |
| `stock-symbols.ts` | 380 | `outputSchema`-declared-number field echoed as raw (possibly string) input | ⚠️ WARNING | Criterion 2 schema-conformance defect, live-confirmed |
| `stock-cia.ts` | 155-197 | Joystick decode ignores DDR-driven keyboard-column aliasing on the same port | ⚠️ WARNING | Plausible-but-wrong CIA field, same class as criterion 3's concern, not live-verified by me but code-confirmed consistent with review |
| `stock-cia.ts` | 113-115 | `fromBcd()` accepts invalid nibbles, returns impossible TOD values | ⚠️ WARNING | Code-confirmed per review, not independently re-verified live |
| `stock-symbols.ts` | 129-146 | Check-then-use path containment (TOCTOU via symlink) | ⚠️ WARNING | Code-confirmed per review |
| Various (WR-05, WR-09, WR-10, WR-11, WR-13) | — | Misleading refusal text, a truncation-flag off-by-one, weak tests, dead code, stale comment | ℹ️ INFO/WARNING | Per 05-REVIEW.md; not independently re-verified live, no reason to doubt the reviewer's static analysis on these |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in the reviewed file list.

### Human Verification Required

None. All success criteria are either mechanically verified or directly falsified by live evidence gathered in this verification pass; no criterion is left in a state that only a human can adjudicate.

### Gaps Summary

Two of the four requirement-bearing chip/sprite tools this phase built —
`vice_vicii_get_state`, `vice_cia_get_state`, `vice_sprite_get`, and
`vice_sprite_inspect` — read the wrong memory view. All four hardcode
`bank: 0x0000` (the CPU's current banking configuration) instead of resolving
the emulator's own `io`/`ram` bank ids through `stock-memory.ts`'s
already-exported `bankCatalogFor()`. I independently reproduced this live
against a genuine unpatched `/usr/bin/x64sc` (VICE 3.9), calling the actual
production handlers (not a reimplementation): with `$01=$34` (I/O banked out —
a state loaders, depackers and IRQ handlers routinely leave the machine in),
`vice_vicii_get_state` and `vice_cia_get_state` both return `isError:false`
with plausible-looking, fully-"available" register values that are actually
the RAM underneath the I/O area, and `vice_sprite_get` reports wrong
`vicBank`/`screenBase`/`pointerTableAddress` with no note. This is exactly the
failure mode criterion 3 was written to forbid ("never reported as zero"),
except worse — the value is not zero, it is plausible and indistinguishable
from a real read, and the registry-based `{available:false, reason}` mechanism
this phase built for the 11 enumerated internal-only fields never engages
because the defect arrives through the address/bank argument rather than
through any of the fields that registry covers.

I also independently live-reproduced a second, narrower defect in
`vice_sprite_inspect`: it attaches the multicolour ASCII legend
(`'@'`/`'%'` bit-pair meanings) to a hi-res sprite's render on a
default-booted, default-banked machine — no special setup required to trigger
this one.

A third, non-blocking defect: `vice_symbols_lookup`'s declared `outputSchema`
requires `query.address` to be a number, but the handler echoes the raw
argument; live-reproduced with `{address:"$d020"}` returning
`query:{"address":"$d020"}` (a string). The underlying symbol-resolution
capability (criterion 2's actual claim) works correctly in both directions —
this is a schema-conformance defect, not a functional one.

Separately, I found (independent of the code review) that `REQUIREMENTS.md`
was never updated to mark DERIV-04 or DERIV-06 complete, despite
05-02-SUMMARY.md, 05-05-SUMMARY.md, and 05-08-SUMMARY.md all declaring
`requirements-completed` for those IDs. `git log` shows dedicated commits
marking DERIV-01 and DERIV-05 complete in `REQUIREMENTS.md`, but no equivalent
commit exists for DERIV-04 or DERIV-06 — the SUMMARY claim was not carried
through to the traceability document that is supposed to be the source of
truth. In DERIV-06's case this accidentally matches the actual (blocked)
state; in DERIV-04's case it understates a mostly-working capability. Either
way it is a process gap worth closing alongside the functional fixes.

**This is not a case for an override.** CR-01/CR-02 are not an alternative
implementation of criterion 3/4's intent — they are a wrong implementation of
the stated intent, live-confirmed to produce exactly the failure mode the
criterion was written to prevent. Baseline regression gates (typecheck, full
test suite, manifest/files[]/STOCK_DERIVED_TOOLS counts, criterion-5 script)
all pass cleanly and are not implicated — the defect is isolated to the three
bank-argument call sites and the one legend constant.

---

_Verified: 2026-08-17T19:09:38Z_
_Verifier: Claude (gsd-verifier)_
