---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
verified: 2026-09-11T20:15:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 46: The Lossless Export Invariant and the Provenance Carry Verification Report

**Phase Goal:** The export path is structurally incapable of dropping a byte on its own
judgement, and what the provenance evidence says about a range travels with the range to
the point of use — established before the exporter is widened for multi-file output rather
than retrofitted onto it afterwards.
**Verified:** 2026-09-11T20:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A planted-control fixture carrying a range a plausible heuristic would want to drop exports with that range present byte for byte, observed RED first against a deliberately-filtering variant | ✓ VERIFIED | `anno-export-asm.test.ts:3856-3985` ("PLANTED CONTROL (BUILD-07)"): builds a `CRACKER-PATCH`/cracktro fixture with three non-vacuity assertions (verdict, printable bytes, zero references in a store that DOES carry labels/comments elsewhere), runs `exportAsmWithVerdictFilter()` (a real, working filtering re-implementation, `:3808-3854`) over the SAME fixture in the SAME test and asserts it drops exactly the planted range (block count −1, start absent, bytes absent from `expectedBytes`) BEFORE calling the real `exportAsm()` and asserting the planted block survives byte-for-byte, annotated, with `blocks.length` unchanged and a real-ACME round trip (`verifyExport().outcome === "ok"`). Ran `node --test anno-export-asm.test.ts` live: 130/130 pass, 0 fail, 0 skipped (ACME 0.97 present on PATH). The filtering variant's identifier is asserted absent from `anno-export-asm.ts`'s own source (`:3988-3994`) and `anno-export-asm.test.ts` is asserted absent from `package.json`'s `files[]` (`:3997-4005`) — confirmed directly: `grep` of `package.json` shows no `.test.ts` entries, and `grep -c exportAsmWithVerdictFilter anno-export-asm.ts` = 0. A structural guard (`blockConstructionSlice()` + four predicates, `:4029-4107`) reads the real module's block-construction stretch through `codeOnly()` (imported from `shipped-modules.ts`, not re-derived) and asserts an unconditional `.map()` with no `.filter()` and no `verdict`/`confidence`/`kind` reference; five separate `guard non-vacuity:` tests (`:4115-4144`) prove each predicate fires against a synthetic in-memory mutation before its silence on the real file is trusted. Cross-checked the real source directly: `anno-export-asm.ts:944-949` is a bare `sortedRanges.map(...)` with no `.filter()` anywhere in the block-construction path (`grep -n .filter(` shows the only filters are on ledger/exclusion row lists inside the later per-block annotation loop, never on the range/block list). |
| 2 | A user-requested exclusion is emitted as a recorded excluded range, readable/extractable from the output, never a silent hole | ✓ VERIFIED | `anno_excluded_range` table (`anno-store.ts:353`, `SCHEMA_VERSION` 5) with `addExcludedRange`/`listExcludedRanges`/`removeExcludedRange` (`:3197-3340`) enforcing overlap-refuse/touch-accept, differing-reason refusal, and reason validation at write time — all confirmed by direct code read. `anno-export-asm.ts`'s per-block loop (`:1532-1575`) emits `EXCLUSION_MARKER_PREFIX` lines naming the exclusion's OWN extent and its re-checked reason, `unshift()`ed onto already-fully-emitted block content — never gating which blocks reach `emitBlock()`. `anno-export-asm.test.ts` EXCLUSION Test 1-7 (`:3360-3488`) plus a dedicated READBACK section (`:3491-3577`) prove: `result.expectedBytes` byte-identical with/without exclusion (Test 2, LOAD-BEARING), `result.blocks` start/endExclusive identical (Test 3), content identical modulo the marker line (Test 4), and — critically — a `readBackExclusions(source)` parser that takes ONLY the source string (no store handle) recovers every excluded extent+reason, anchored on the imported `EXCLUSION_MARKER_PREFIX` constant, with a mutation-of-the-marker-spelling negative control (`:3557+`) proving the anchor is real, not a loose regex. `node --test anno-export-asm.test.ts` confirms 130/130 pass live. |
| 3 | `c64-provenance-diff`'s existing verdict appears inline at point of use on every emitted block regardless of value (HIGH/UNKNOWN/CRACKER-PATCH all annotated); no verdict value changes what is emitted; a structural test asserts this | ✓ VERIFIED | `anno-provenance-ledger.ts`'s `readProvenanceLedger()`/`provenanceForRange()` are a PURE reader — no verdict normalization, no re-derivation (confirmed: the module never computes a verdict, only parses/joins by address). `anno-export-asm.ts:1495-1530` annotates every block whose ledger rows overlap it, with the ONLY conditionals being "is ledger mode on", "zero rows" (refuse) and "more than one row" (record ambiguity) — none inspecting a Verdict/Confidence/Kind VALUE (verified by direct code read, matching the code's own comment at `:1490-1494`). The STRUCTURAL GUARD test (`anno-export-asm.test.ts:4084-4107`) and its five non-vacuity proofs mechanically enforce this for the block-construction stretch (see truth 1). The BEHAVIOURAL COMPANION test (`:4149-4213`) measures losslessness across the WHOLE verdict vocabulary (`ORIGINAL`/`CRACKER-PATCH`/`UNKNOWN`, ≥2 confidence tiers, verified non-vacuously against the fixture's own rendered table), asserting `result.blocks.length` equals the store's live range count, every block individually carries a provenance line, and verdict-set equality holds in BOTH directions (nothing dropped, nothing invented). All tests confirmed passing live. |
| 4 | The verdict is read from the existing ledger, never re-derived; with the ledger absent, the exporter declines by name rather than inventing a verdict | ✓ VERIFIED | `anno-provenance-ledger.ts:320-330`: `readProvenanceLedger()` catches a failed `readFileSync` and throws `ProvenanceLedgerError` naming the path, stating "refusing to annotate without it", and citing `LEDGER_REMEDY` (`:176-177`, `regenerate it with c64-provenance-diff's "ledger" verb, or omit --ledger`) — verified this message is built with the path and the remedy, and no code path in `readProvenanceLedger()` or `exportAsm()` invents a fallback verdict. Nine total named refusals in the module (zero data rows, wrong cell count, unparseable address, inverted span, overlap/non-ascending, non-full coverage, NUL byte, plus file-absent and header-absent) all share this remedy sentence and never quote a cell's own text (confirmed by the information-disclosure control in `anno-provenance-ledger.test.ts`, 22 tests, all passing live). `anno-export-asm.ts:1497-1503`: a block the ledger leaves uncovered is refused by name before any write. `anno-cli.ts`: `exportAsm()` is called (`:1508`) BEFORE `writeFileSync(outPath, ...)` (`:1519`) — an exception from a ledger-absent/malformed refusal propagates before any output file is written, confirmed by reading the call order directly. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-provenance-ledger.ts` | Pure ledger reader, address-join, refuse-by-name | ✓ VERIFIED | Exists, exported in `package.json` `files[]`, 9 named refusals, no verdict invention (direct read) |
| `src/mcp/vice/anno-provenance-ledger.test.ts` | Sibling test suite | ✓ VERIFIED | 22 tests, 0 fail, run live |
| `src/mcp/vice/anno-export-asm.ts` | Optional `ledgerPath`, provenance/exclusion markers, unconditional block map | ✓ VERIFIED | `:944-949` unconditional map; `:1495-1530` provenance annotation; `:1532-1575` exclusion annotation — no filter on ranges/blocks anywhere in the construction path |
| `src/mcp/vice/anno-export-asm.test.ts` | Carry, refusal, planted control, structural guard, behavioural companion tests | ✓ VERIFIED | 130 tests, 0 fail, 0 skipped, ACME present, run live |
| `src/mcp/vice/anno-types.ts` / `anno-store.ts` | `SCHEMA_VERSION` 5, `anno_excluded_range` table + 3 verbs | ✓ VERIFIED | `SCHEMA_VERSION = 5` confirmed; table + `addExcludedRange`/`listExcludedRanges`/`removeExcludedRange` confirmed by direct read; no `name` column added to `anno_scope`; no second new table |
| `src/mcp/vice/anno-tools.ts` / `anno-register.ts` | `anno_exclude_range`/`anno_include_range` on MCP surface, 4 registration sites, register entries | ✓ VERIFIED | All 4 sites confirmed via grep (`ANNO_TOOL_DEFINITIONS`, `assertVerbArgs` arms, `dispatchExcludedRange`, outer `dispatch()` gate); register entries cite `BUILD-05`/`BUILD-07` (both declared) and real consumer paths |
| `src/mcp/vice/anno-cli.ts` | `--ledger FILE` optional flag | ✓ VERIFIED | Flag parsed, confined, `exportAsm()` called before `writeFileSync` |
| `src/skills/c64-provenance-diff/SKILL.md` | Documents the ledger→export route and the exclusion round trip | ✓ VERIFIED | Contains `--ledger` invocation, `anno_exclude_range`/`anno_include_range` prose, "decides nothing" framing |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `anno-export-asm.ts` | `anno-provenance-ledger.ts` | value import, `readProvenanceLedger`/`provenanceForRange` | ✓ WIRED | Confirmed import + call sites; `anno-provenance-ledger.ts` present in `package.json` `files[]` |
| `renderLedger()`'s emit-time preconditions | `readProvenanceLedger()`'s accept-time assertions | address-shaped invariants mirrored | ✓ WIRED | Overlap/ordering/full-coverage refusals confirmed present in reader |
| `provenanceForRange()` / `addExcludedRange()` overlap predicate | per-block exclusion/provenance annotation loop | identical `start <= end && end >= start` predicate reused at all sites | ✓ WIRED | Confirmed textually identical predicate at `anno-export-asm.ts:1552-1554` and in `anno-store.ts`'s overlap checks |
| `ANNO_TOOL_DEFINITIONS` | `CURATED_ANNO_TOOLS` | `.map()` derivation | ✓ WIRED | `check-skill-tool-coverage.mjs` run live: exit 0, `anno_exclude_range`/`anno_include_range` curated |
| `anno-cli.ts`'s `VERB_OPTIONS["export-asm"]["--ledger"]` | `scripts/lib/anno-cli-invocations.mjs` `FLAG_KINDS` | argument-checking | ✓ WIRED | `check-skill-cli-invocations.mjs` run live: exit 0 |
| `exportAsm()` call | `writeFileSync(outPath, ...)` | CLI ordering | ✓ WIRED | `anno-cli.ts:1508` (call) precedes `:1519` (write) — a thrown refusal never reaches the write |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense — this phase's surface is a CLI/MCP export pipeline, not a rendered view. The data-flow equivalent (store → ledger/exclusion read → emitted comment text) was traced directly above (truths 2-4) and confirmed to originate from real store queries (`listRanges`, `listExcludedRanges`, `readProvenanceLedger`), never a static/mock fallback.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Ledger + exclusion + planted-control + structural-guard suite | `node --test anno-export-asm.test.ts` (from `src/mcp/vice`) | 130 tests, 130 pass, 0 fail, 0 skipped | ✓ PASS |
| Ledger reader's own refusal suite | `node --test anno-provenance-ledger.test.ts` | 22 tests, 22 pass | ✓ PASS |
| Store exclusion verbs | `node --test anno-store.test.ts` (included in combined run) | pass | ✓ PASS |
| MCP tool surface (`anno_exclude_range`/`anno_include_range`) | `node --test anno-tools.test.ts` | pass | ✓ PASS |
| CLI `--ledger` flag | `node --test anno-cli.test.ts` | pass | ✓ PASS |
| Register basis-integrity (pre-existing baseline failures only) | `node --test anno-register.test.ts` | 2 failures, both pre-attributed baseline (`DIRECTION 5`, `planted violation (the negative control)`) | ✓ PASS (matches documented baseline) |
| Typecheck | `npm run typecheck` (from `src/mcp/vice`) | exit 0 | ✓ PASS |
| Full automated suite | `npm run test:automated` (from `src/mcp/vice`) | 4232 tests, 4212 pass, 6 fail, 9 skipped — all 6 failures match the pre-attributed known-failure list (2 pre-existing basis-integrity, 1 pre-existing negative-control gap, 3 concurrent-session STATE.md/docs-guard cascade) | ✓ PASS (no new failures) |
| npm package gate | `node scripts/check-npm-packages.mjs` (repo root) | exit 0 — no test files leaked, `anno-provenance-ledger.ts` present | ✓ PASS |
| Skill CLI invocation gate | `node scripts/check-skill-cli-invocations.mjs` | exit 0 | ✓ PASS |
| Skill tool coverage gate | `node scripts/check-skill-tool-coverage.mjs` | exit 0, `anno_exclude_range`/`anno_include_range` curated | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` probes; verification is via the project's own `node --test` suite and the CLI/npm gate scripts (Step 7b covers this).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| `BUILD-05` | 46-01, 46-02, 46-04, 46-05 | Provenance-aware rebuild; verdict carried to point of use; export emits every byte by default; exclusions user-requested and recorded | ✓ SATISFIED | Truths 3, 4 above; REQUIREMENTS.md marks `[x]` and traceability table shows Phase 46 / Complete |
| `BUILD-07` | 46-03, 46-04, 46-05, 46-06 | Lossless-by-default export path; planted control proves it | ✓ SATISFIED | Truths 1, 2 above; REQUIREMENTS.md marks `[x]` and traceability table shows Phase 46 / Complete |

No orphaned requirements: `grep -E "Phase 46"` against `.planning/REQUIREMENTS.md` shows only `BUILD-05`/`BUILD-07`, both declared in every plan's frontmatter that claims them.

### Anti-Patterns Found

None of blocker or warning severity. The code-review process (`46-REVIEW.md`) already found and fixed two WARNING-level issues (WR-01: NUL-byte handling in the ledger parser; WR-02: CLI summary omitting `excludedRangeCount`) and one INFO-level coverage gap (IN-01: missing version-4-store refusal test) — all three confirmed fixed and merged into `main` (commits `76ff4564`, `44b8a553`, `9059d265`, merged via `09eb2418`). One INFO-level cosmetic finding (IN-02: unescaped space-containing ledger field values in the marker line format) was explicitly accepted with a recorded, reasoned disposition rather than fixed — reviewed and judged acceptable (cosmetic only, no correctness impact, would churn pinned test assertions for a value shape the current ledger vocabulary never produces).

Grep of the phase's shipped files for debt markers (`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`) found none introduced by this phase's diffs.

One disclosed, deliberately-unfixed limitation: commit `357667b6`'s historical git blob for `anno-provenance-ledger.ts` permanently contains a raw NUL byte (fixed at HEAD, confirmed NUL-free via direct byte scan). Fixing it would require a history rewrite, which this project's git safety rules forbid. This is a git-history cosmetic artifact, not a functional defect — HEAD's file is text and NUL-free, and the WR-01 fix additionally makes the *reader* refuse any NUL byte a *ledger file* (not the source module) might contain.

### Human Verification Required

None. All four ROADMAP success criteria are backed by structural evidence (direct code reads at the module/function/line level) and re-run automated tests (confirmed passing in this verification session, not merely cited from SUMMARY.md), with no behavior-dependent claim left unexercised by a test.

### Gaps Summary

No gaps found. All four ROADMAP success criteria hold under independent code inspection and live test execution:

1. The planted-control mechanism is genuinely a red-then-green control (the filtering variant is real, working code that actually drops the range when run, verified live), not a described-but-untested claim, and is proven absent from the shipped module and the npm tarball.
2. The exclusion mechanism is a real SQLite table with real overlap/adjacency semantics, and the export-time marker is genuinely recoverable from `result.source` alone with byte-identical `expectedBytes`/`blocks` proven directly on the byte arrays, not the source text.
3. The emission path was read directly, confirming an unconditional `.map()` with the only conditionals gating on "is ledger mode on" / "zero rows" / "more than one row" — never a verdict/confidence/kind value — and this is now also mechanically enforced by a structural guard with proven non-vacuous predicates.
4. The ledger-absent/malformed paths all decline by name, citing the path and a concrete remedy, before any output write occurs, and never invent a verdict.

The code review's three fixable findings were fixed and merged; the one accepted-as-is finding is cosmetic and explicitly non-blocking per the review's own text. `npm run test:automated`'s failure set (6 failures) matches the phase's own pre-attributed baseline exactly, with no new failures introduced by phase 46's work.

---

_Verified: 2026-09-11T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
