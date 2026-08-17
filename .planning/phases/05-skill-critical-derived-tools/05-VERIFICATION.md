---
phase: 05-skill-critical-derived-tools
verified: 2026-08-17T22:35:36Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "A user can read decoded VIC-II and CIA state on the stock backend, with every internal field stock cannot read marked explicitly unavailable — never reported as zero (CR-01 bank-0 bug)"
    - "A user can read and inspect sprites, including ASCII rendering, on the stock backend (CR-02 bank-0 bug + hi-res/multicolour legend defect)"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification: []
---

# Phase 5: Skill-Critical Derived Tools Verification Report

**Phase Goal:** Every tool the six shipped skills actually call either works on stock or is explicitly routed to the fork
**Verified:** 2026-08-17T22:35:36Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 05-09..05-13) plus a post-gap-closure code review and fix pass

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|------|--------|----------|
| 1 | A user can search and compare memory ranges on the stock backend | ✓ VERIFIED | `stock-memory-search.ts`/`stock-memory.ts` wired into `stock-dispatch.ts`. Live re-confirmed against genuine `/usr/bin/x64sc` (VICE 3.9) via `stock-live.test.ts`'s WR-06 case (read this file directly, lines 547-605): a search for a ROM byte at `$E000` matches through the default (CPU) view and correctly fails to match through the `ram` bank, and the RAM-under-ROM byte — previously unreachable — is found through `ram`; `vice_memory_compare` applies one bank to both ranges and reports it. `npm run test:automated` (this repo, this run) = 1426/1421/0/5, matching the stated baseline. Live gate `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` = 10/10 pass (run independently, not taken from any SUMMARY). Known-open, non-blocking: WR-06/WR-07's `mode:'ranges'` refusal text still describes a time dimension the tool does not have (doc wording, not a functional defect); WR-08's `truncated` flag mislabels an exact-boundary result. Neither breaks the ability to search and compare. |
| 2 | A user can load a symbol file and have addresses resolved to symbol names on the stock backend | ✓ VERIFIED | `stock-symbols.ts` load/lookup wired and tested (`stock-symbols.test.ts`, 238-test run across the six stock modules together, 0 fail). WR-01 (previously a warning: `query.address` echoed the caller's raw string, violating the tool's own `outputSchema`) is fixed and independently re-read in the source: `stock-symbols.ts:409-422` now assigns `address` from `parseAddress(args.address, ...)` — a `number` — before building `query: { address }`, never echoing `args.address`. WR-05 (symlinked workspace root falsely refusing legitimate files) is independently re-read as fixed: `resolveLabelFilePath` now canonicalises `repoRoot()` via `realpathSync` before the containment comparison. |
| 3 | A user can read decoded VIC-II and CIA state on the stock backend, with every internal field stock cannot read marked explicitly unavailable — never reported as zero | ✓ VERIFIED (gap closed) | Previously FAILED (CR-01: all chip reads used the CPU-view bank `0x0000`, so I/O-banked-out RAM was silently decoded as chip registers with nothing marked unavailable). Independently re-read: `stock-vicii.ts:285` and `stock-cia.ts:559` both now call `resolveRequiredBank(toolName, "io", session)` and only proceed with a resolved `io` bank id; `stock-memory.ts` exports `resolveRequiredBank`. Live re-confirmed directly from `stock-live.test.ts` (read, not summarized): with `$01=$34` (I/O banked out), `vice_vicii_get_state` still reports `borderColour: 14`/`backgroundColour: 6` (the true KERNAL defaults) through `bank: {name: "io"}`, and its own non-vacuity control proves the CPU-view read at the same moment returns `255` (would-be silent RAM); `vice_cia_get_state` similarly reports `portBDirection.raw: 0` and `timerAControl.raw` not `0xff`. A second Critical from the post-gap-closure re-review (`tod.tenths` fabricating an impossible decimal from a non-BCD nibble, bypassing the hardened `fromBcd()` its three siblings use) is independently re-read as fixed at `stock-cia.ts:408-420`: `tenths` now routes through `fromBcd()` and is omitted plus named in `tod.invalidBcd` when invalid, exactly like `seconds`/`minutes`/`hours`. `npm run test:automated` ran clean at 1426/1421/0/5 in this session. |
| 4 | A user can read and inspect sprites, including ASCII rendering, on the stock backend | ✓ VERIFIED (gap closed) | Previously FAILED (CR-02: same bank-0 bug in `stock-sprites.ts`, plus a hi-res sprite's ASCII render being labelled with the multicolour legend). Independently re-read: `stock-sprites.ts:266-270` resolves both `io` (registers) and `ram` (pointer table + sprite data) via `resolveRequiredBank` before the first send. Two separate legend constants (`SPRITE_ASCII_LEGEND_HIRES` / `SPRITE_ASCII_LEGEND_MULTICOLOUR`) now exist and are selected on the per-sprite `multicolour` flag at line 707. Live re-confirmed directly: `stock-live.test.ts`'s CR-02 case shows sprite geometry (`vicBank`, `screenBase`, `pointerTableAddress`) unchanged across `$01=$34` with a non-vacuity control proving the banking write actually took effect (`cia2PortARaw` sampled through the `io` bank differs from the default-bank read of the same register); the legend case shows sprite 0's live ASCII render legend names only `.`/`#`, never `@`/`%`. |
| 5 | Running each of the six skills' documented tool calls against the stock backend produces no unadvertised-tool failure except for the three tools proven unrecoverable (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`) | ✓ VERIFIED | `node scripts/check-skill-tool-coverage.mjs` run directly in this session, exit 0: "35 distinct vice_* names extracted from 30 files across 6 skill directories; 25 resolved as advertised on the stock manifest (34 tools total). Classified: 2 proxy-local, 1 deny-listed, 2 not-a-tool-name, 3 fork-only-unrecoverable, 2 pending-later-phase." Read the script's `FORK_ONLY_UNRECOVERABLE` array directly: it names exactly `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore` — matching the roadmap's corrected three-tool exception list verbatim, each with a route (`BACK-05`/`SKILL-01`, Phase 8). The script self-asserts non-vacuity (≥30 names extracted, ≥6 skill dirs scanned, two positive-control tool names present) and that every allowlisted name is still actually referenced by a skill file (a stale-allowlist guard). |

**Score:** 5/5 truths verified. All previously-failed truths (3, 4) are now closed with independent re-verification, including a fresh live run against genuine unpatched stock VICE (not reused from any SUMMARY/REVIEW claim).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/stock-memory-search.ts` | handleMemorySearch/handleMemoryCompare, now with an optional `bank` argument (WR-06) | ✓ VERIFIED | Exists, exports both, wired into `stock-dispatch.ts`, live-confirmed functional including the new `bank` argument |
| `.claude/mcp/vice/stock-symbols.ts` | handleSymbolsLoad/handleSymbolsLookup, schema-conformant `query.address`, symlink-safe containment | ✓ VERIFIED | Both WR-01 and WR-05 fixes independently re-read as present and correct in source |
| `.claude/mcp/vice/stock-vicii.ts` | handleViciiGetState resolving the `io` bank, VICII_UNAVAILABLE_FIELDS registry | ✓ VERIFIED | `resolveRequiredBank("vice_vicii_get_state", "io", session)` present at line 285; registry mechanism for the 11 enumerated internal-only fields unchanged and correct |
| `.claude/mcp/vice/stock-cia.ts` | handleCiaGetState resolving the `io` bank, CIA_UNAVAILABLE_FIELDS registry, honest `tod.tenths`, discriminating `confounded` joystick flag | ✓ VERIFIED | `resolveRequiredBank` at line 559; `tod.tenths` routed through `fromBcd()` at lines 408-420; `confounded`/`confoundedDirections` now per-bit, per-read-actual (WR-03), live-confirmed to read clean on a freshly-booted machine and confounded only on a genuinely driven-low pin |
| `.claude/mcp/vice/stock-sprites.ts` | handleSpriteGet/handleSpriteInspect resolving `io`+`ram` banks, per-render-mode legend, attributed hazard notes | ✓ VERIFIED | Bank resolution at lines 266-270; two legend constants selected on `multicolour` at line 707; hazard notes now computed only for returned sprites and attributed by sprite index (WR-02) |
| `.claude/mcp/vice/stock-memory.ts` | `resolveRequiredBank()`/`resolveBank()`, now reporting the emulator's whole bank enumeration including aliased ids (WR-01) | ✓ VERIFIED | `BankCatalog.entries` (wire-order, aliases included) exists and feeds `handleMemoryBanks`; live-confirmed to report all 6 wire pairs (`default`/`cpu` sharing one id) rather than the previous 5 |
| `.claude/mcp/vice/tools-manifest.stock.json` | 34 tools total | ✓ VERIFIED | Direct count = 34 |
| `.claude/mcp/vice/package.json` files[] | 44 entries | ✓ VERIFIED (per stated baseline; not independently re-counted, no change plausible from doc/test-only fix commits) |
| `.claude/mcp/vice/stock-derived.ts` STOCK_DERIVED_TOOLS | 9 tools | ✓ VERIFIED (per stated baseline) |
| `scripts/check-skill-tool-coverage.mjs` | criterion-5 gate | ✓ VERIFIED | Re-run directly, exit 0, non-vacuous, three-tool exception list confirmed by source read |
| `docs/stock-vice-parity.md` | records the CR-01/CR-02 fixes and the bank-resolution discipline | ✓ VERIFIED | §A item 5 and the WR-06 section both describe the fixed bank-resolution behaviour accurately; the WR-07 doc-wording defect (time-dimension claim for `mode:'ranges'`) is confirmed still present verbatim — known open, non-blocking |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stock-vicii.ts` / `stock-cia.ts` / `stock-sprites.ts` | `stock-memory.ts`'s `resolveRequiredBank()` | direct import + call before the first `MEM_GET` | ✓ WIRED | Confirmed by source read in all three files; this is the exact link whose absence caused the previous FAILED verdicts on criteria 3/4 |
| Stock backend dispatch (`vice-proxy.ts`) | `stock-dispatch.ts`'s `dispatchStock()` | `buildBackendAwareTool()` branching on `ACTIVE_BACKEND.backend` | ✓ WIRED | Read `vice-proxy.ts:3166-3187` directly: on any non-fork backend every registered tool (including derived tools) routes through `dispatchStock`, never `forwardToVice()`/`call()`. This satisfies CLAUDE.md's "derived tools must be intercepted before forwardToVice()" constraint structurally, independent of the WR-10 finding that one specific unit test cannot fail (a test-quality gap, not a wiring gap) |
| Skill reference docs (`c64-program-recon/references/*.md`) | Stock tool surface | tool-name extraction + manifest cross-check | ✓ WIRED | `check-skill-tool-coverage.mjs` proves every skill-referenced `vice_*` name is either advertised on stock or explicitly classified with a reason and route |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `vice_vicii_get_state` answer | `borderColour`/`backgroundColour`/registers | one `MEM_GET` against the resolved `io` bank | Live-confirmed: true chip register values survive `$01` banking manipulation, not the CPU view | ✓ FLOWING |
| `vice_cia_get_state` answer | `tod.tenths`/joystick booleans/`confounded` | `fromBcd()` decode of the `io`-bank TOD bytes; per-bit driven-low predicate | Live-confirmed: invalid BCD nibble omitted and named rather than fabricated; joystick flag discriminates a genuinely driven-low pin from a clean read | ✓ FLOWING |
| `vice_sprite_get`/`vice_sprite_inspect` answer | pointer-chain addresses, ASCII render, legend | `io`-bank VIC-II registers + `ram`-bank pointer table/sprite data | Live-confirmed: geometry survives I/O banking; legend matches the render's actual alphabet | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck clean | `npm run typecheck` (in `.claude/mcp/vice`) | clean, no output | ✓ PASS |
| Full automated suite | `npm run test:automated` | 1426 tests, 1421 pass, 0 fail, 5 todo | ✓ PASS |
| Six stock-module unit suites together | `node --test stock-symbols.test.ts stock-cia.test.ts stock-vicii.test.ts stock-sprites.test.ts stock-memory-search.test.ts stock-memory.test.ts` | 238 tests, 238 pass, 0 fail | ✓ PASS |
| Skill-vs-manifest coverage gate | `node scripts/check-skill-tool-coverage.mjs` | exit 0, three-tool exception list confirmed | ✓ PASS |
| Manual-only live gate against genuine unpatched stock VICE | `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` | 10 tests, 10 pass, 0 fail | ✓ PASS |

### Probe Execution

Not applicable — this phase's runnable checks are covered by the automated and manual-only live test suites above (Step 7b), which are the project's equivalent of probes for this codebase and were executed directly by this verifier, not read from a prior report.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| DERIV-01 | 05-01, 05-06, 05-08 | User can search and compare memory ranges on the stock backend | ✓ SATISFIED | Criterion 1, verified above |
| DERIV-04 | 05-02, 05-06, 05-08, 05-11, 05-13 | User can load a symbol file and have addresses resolved to symbol names | ✓ SATISFIED | Criterion 2, verified above; WR-01 fix independently re-read |
| DERIV-05 | 05-03, 05-04, 05-07, 05-08, 05-09, 05-12, 05-13 | User can read decoded VIC-II and CIA state, unavailable fields marked, read side only | ✓ SATISFIED | Criterion 3, verified above; CR-01 gap-closure and the post-gap-closure `tod.tenths` Critical both independently re-read as fixed |
| DERIV-06 | 05-05, 05-07, 05-08, 05-10, 05-13 | User can read and inspect sprites including ASCII rendering, read side only | ✓ SATISFIED | Criterion 4, verified above; CR-02 (bank + legend) gap-closure independently re-read as fixed |

No orphaned requirements: REQUIREMENTS.md's traceability table lists exactly these four requirement IDs against Phase 5 as `Complete`, and its "Open requirements per phase" line states Phase 5: 0. `DERIV-02`/`DERIV-03` and `SHOT-01`..`05` are also mapped to "Phase 5" in the same table but are explicitly reconciled in the same document's "Coverage" section as **Cut** (out of the v0.2.0 milestone's scope, not silently dropped) — the table's literal "Pending" wording for those rows is a residual label inconsistency in REQUIREMENTS.md's own bookkeeping (the narrative Coverage section is authoritative and correctly says Cut), not a Phase 5 code gap, and does not affect any of this phase's four requirement IDs or the five roadmap success criteria.

### Anti-Patterns Found

None newly introduced by the fix pass. All patterns found in the post-gap-closure review are either fixed (CR-01, WR-01 through WR-06 — independently re-confirmed above) or remain open by the orchestrator's deliberate scope decision (WR-07 through WR-11, IN-01 through IN-04). Judged individually against the five success criteria per this task's instructions:

| Finding | File | Severity | Breaks a success criterion? |
|---------|------|----------|------------------------------|
| WR-07 | `stock-memory-search.ts`, `control-flow.md`, `stock-vice-parity.md` | Warning | No — inaccurate error/doc wording about a time dimension, tool still searches/compares correctly (criterion 1 intact) |
| WR-08 | `stock-memory-search.ts` | Warning | No — mislabels `truncated` only on an exact-boundary match count; core search/compare capability unaffected |
| WR-09 | `stock-sprites.ts` | Warning | No — code-duplication/maintainability issue, not a behavioral defect; sprite reads (criterion 4) still correct as independently verified live |
| WR-10 | `stock-derived.test.ts` | Warning | No — the *test* cannot fail, but the production wiring itself was independently re-read (`vice-proxy.ts:3166-3187`) and structurally guarantees derived tools never reach `forwardToVice()` on stock; the invariant holds even though this one test doesn't prove it |
| WR-11 | `stock-derived.ts`, `stock-sprites.ts`, `check-skill-tool-coverage.mjs` | Warning | No — dead code / unreachable guards / unused imports, no behavioral impact |
| IN-01 | `tools-manifest.stock.json`, `stock-memory.ts` | Info | No — latent; VICE 3.9 spells all bank names lowercase, so it does not currently manifest |
| IN-02 | `scripts/check-npm-packages.mjs` | Info | No — packaging-gate regex gap unrelated to any of the five criteria |
| IN-03 | `hostpath-consumers.test.ts` | Info | No — a gate-hardening suggestion, not an observed defect |
| IN-04 | `sound-and-input.md` | Info | No — documentation completeness only; `confounded`/`invalidBcd` are correctly computed and reported by the tool (confirmed live) regardless of whether this one skill reference explains them |

No `TBD`/`FIXME`/`XXX` debt markers found in the files this phase's gap-closure and fix-pass plans modified (checked directly: none of `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts`, `stock-memory.ts`, `stock-memory-search.ts`, `stock-symbols.ts` carry any).

### Human Verification Required

None. Every truth was independently re-verifiable by source reading, the automated test suite, and a fresh live run against genuine unpatched stock VICE (`/usr/bin/x64sc`, VICE 3.9) executed directly in this verification session — not sourced from any SUMMARY.md, REVIEW.md, or REVIEW-FIX.md claim.

### Gaps Summary

None remaining. Both previously-FAILED truths (criteria 3 and 4) are closed:

- **CR-01** (chip-state reads used the CPU-view bank instead of resolving the emulator's `io` bank) — fixed in `stock-vicii.ts`/`stock-cia.ts`, independently re-read in source and re-confirmed live with `$01=$34` against genuine stock VICE.
- **CR-02** (sprite reads shared CR-01's bank bug, plus a hi-res sprite's ASCII render carrying the multicolour legend) — fixed in `stock-sprites.ts`, independently re-read in source (bank resolution + two legend constants) and re-confirmed live.
- A second Critical surfaced by the post-gap-closure code review (`tod.tenths` fabricating an impossible decimal from a non-BCD nibble) was fixed in commit `ecafe21` and independently re-read as routing through the same hardened `fromBcd()` path as its three siblings.
- Six Warning-severity findings from the same review (WR-01 through WR-06) were fixed in commits `11e49bf`, `254324a`, `8b149c3`, `5d1eaa2`, `62518fe`, `e5cf367`; all six independently re-read in source and, where the finding was about real emulator behaviour, re-confirmed against genuine stock VICE via the live gate.
- The remaining five Warnings (WR-07 through WR-11) and four Info items (IN-01 through IN-04) were deliberately left out of the fix pass as out-of-brief. Each was individually checked against the five roadmap success criteria in this verification (table above); none breaks a criterion. They remain legitimate, tracked technical debt for a future pass, not phase-blocking gaps.

---

_Verified: 2026-08-17T22:35:36Z_
_Verifier: Claude (gsd-verifier)_
