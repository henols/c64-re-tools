---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 03
subsystem: mcp-tooling
tags: [vice, text-monitor, prof-flat, io, parser, stock-only-tool, tdd, unicode]

# Dependency graph
requires:
  - phase: 42
    provides: "Plan 42-01's tracer slice -- textmon-memmap.ts's module shape (pure, zero-import, never-throw discriminated result), the D-42-3 refusal discipline, and textmon-fixtures.ts's loadTextFixture()"
provides:
  - "textmon-profile.ts: parseFlatProfile(text) -- the one owning module for prof flat output, decoding VICE's U+202F thousands separator correctly and preserving VICE's own row order"
  - "textmon-registers.ts: parseIoRegisters(text) -- the one owning module for io output, decoding the 64-byte VIC-II dump, the three-outcome decoded-prose section, and the header-derived eight-column sprite table"
  - "The D-42-3 refusal discipline's three-outcome refinement for io's free-form decoded-prose section (recognised+parseable / recognised+unparseable / unrecognised-and-preserved), decided in this plan's own <plan_decisions> block and inherited by no later plan (io is the only free-form format in this phase)"
affects: [42-04, 42-07, 42-08]

# Actuals (#2632)
actuals:
  tokens: 18235
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ASCII-space-only tokenization (never \\s) to survive a Unicode thousands separator that JavaScript's whitespace class would otherwise consume -- textmon-profile.ts's tokenizeRow()"
    - "Header-derived column-offset slicing for a fixed-width table whose rows may have zero inter-column separator space -- textmon-registers.ts's deriveSpriteBoundaries(), offset = (header token start index) - 1"
    - "Three-outcome parsing for a free-form (as opposed to closed-format) reply section: typed-decode / named-refusal-by-label / preserve-verbatim-as-drift -- textmon-registers.ts's decodeProseLines()"

key-files:
  created:
    - src/mcp/vice/textmon-profile.ts
    - src/mcp/vice/textmon-profile.test.ts
    - src/mcp/vice/textmon-registers.ts
    - src/mcp/vice/textmon-registers.test.ts
  modified: []

key-decisions:
  - "prof flat rows are tokenized on runs of the ASCII space character (U+0020) only, via /  +/, never \\s -- \\s matches U+202F (the narrow no-break space VICE uses as its thousands separator), so a naive whitespace-class split would silently truncate every cycle count to its leading digit group with no error anywhere"
  - "A malformed prof flat numeric field is split into two distinct refusal codes by WHY it failed to tokenize as one token: if every fragment is digits-only, an ASCII space stood where the separator belongs (unrecognised-separator, the specific hazard this module exists to catch); anything else is a generic structural malformation (malformed-row) -- this lets the two planted controls discriminate cleanly"
  - "io's sprite-table column boundaries are computed as (header token start index - 1), not the token start index itself -- MEASURED against the real captures that a row's own label field can be one character SHORTER than the header's 'Sprites: ' label (X-Pos: is 8 chars vs. Sprites: 's 9), so the value abuts directly against the label with zero separating space; the -1 shift is what makes ONE boundary set correctly slice every row despite each row's label field varying 7-11 characters in width"
  - "io's decoded-prose section follows a three-outcome rule distinct from every other format in this phase (D-42-3's refinement, decided in this plan): a recognised label prefix with a matching detail shape decodes; a recognised prefix whose value fails its detail shape refuses (unparseable-value, naming the label); a line matching no recognised prefix at all is pushed verbatim to unrecognisedLines and never populates a typed field. This is narrower in scope than it sounds -- it applies ONLY to the six free-form prose lines, never to the hex dump, the memspace marker, or the sprite table, all three of which remain closed sets that refuse like every other format's fields"
  - "VICE's two io degradation strings (\"No details available.\" / \"No I/O regs available\", source-traced from monitor.c:1980-2000, never live-observed) are recognised as two of the eight closed IoRegistersRefusalCode members, not as a third arm of the discriminated result type -- this keeps D-42-3's { ok:true } | { ok:false, refusal } shape uniform across all five parsers while still giving the caller a distinctly-named outcome instead of an empty successful decode"
  - "The two degradation-string test names are explicitly labelled 'source-traced (monitor.c:1980-2000, not live-observed)' per the plan's own instruction, so the provenance gap is visible in test output rather than only in this SUMMARY"

requirements-completed: [PARSE-02, PARSE-03]

coverage:
  - id: D1
    description: "prof flat's ranked cycle profile parses into structured data with VICE's U+202F thousands separator decoded correctly, rows in VICE's own emitted order (no re-ranking, including on a tie), and every drifted form refusing by a distinct named code"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "textmon-profile.test.ts (19 tests): both real captures, the exact 2326151 leading-row assertion, the byte-level U+202F assertion over fixture.buffer, the stable-tie ordering control, all five refusal codes each with a discriminating real-capture control, idempotency, concurrency"
        status: pass
    human_judgment: false
  - id: D2
    description: "io's register dump, decoded chip state, and eight-column sprite table parse into structured data, with the sprite table sliced at the capture's own declared header offsets (never a guessed width) and the two decoded-prose degradation strings recognised as named outcomes rather than empty successes"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "textmon-registers.test.ts (23 tests): both real captures, the 64-byte dump plus identical-border/differing-raster divergence proof, the X-Pos no-separator-space sprite-decode proof, all eight refusal codes (including both source-traced degradation strings) each reachable, idempotency, concurrency"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both textmon-profile.ts and textmon-registers.ts are pure (zero imports, no module-scope mutable state) and never throw -- every failure mode is a discriminated refusal, asserted mechanically from each module's own source"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "textmon-profile.test.ts#purity + #ordering discipline; textmon-registers.test.ts#purity + #sprite-table column offsets are derived from the header"
        status: pass
    human_judgment: false
  - id: D4
    description: "The automated test gate is at or below the baseline measured at this plan's start"
    verification:
      - kind: other
        ref: "npm run test:automated, run twice after this plan's changes -- both settled at exactly 8 pre-existing failures, matching plan 42-01's own measured baseline byte-for-byte"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 03: prof flat and io text-format parsers Summary

**Two pure, zero-import parsers -- `parseFlatProfile()` decoding VICE's U+202F narrow-no-break-space thousands separator via ASCII-space-only tokenization (never a whitespace-class split), and `parseIoRegisters()` decoding the VIC-II register dump plus its eight-column sprite table sliced at header-derived offsets -- completing PARSE-02's four structured text-monitor results.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-09T15:17:27+02:00
- **Completed:** 2026-09-09T15:44:00+02:00
- **Tasks:** 2 (both `tdd="true"`, landed as single `feat` commits -- see Deviations)
- **Files modified:** 4 (all created, none modified)

## Accomplishments

- `textmon-profile.ts`: `parseFlatProfile(text)`, zero imports, never throws. Tokenizes rows on ASCII-space runs only (`/ +/`, never `\s`) so a thousands-separated cycle count survives tokenization as one token; the stock capture's leading row decodes to the exact integer `2326151`, only obtainable by treating the separator as a separator rather than whitespace. No sort or reverse call anywhere in the module -- rows are returned in VICE's own emitted order, proven stable on a synthetic tie. Closed 5-code refusal union: `empty-response`, `missing-header`, `malformed-row`, `unrecognised-separator`, `unrecognised-percentage`.
- `textmon-registers.ts`: `parseIoRegisters(text)`, zero imports, never throws. Decodes the 64-byte VIC-II dump (base address `0xd000`), the six-line decoded-prose block under a three-outcome rule (typed-decode / named-refusal-by-label / preserve-verbatim), and the sprite table's eight columns sliced at offsets derived live from the `Sprites:` header line's own token positions -- proven against the real `X-Pos` row, which has zero separating space between adjacent values. Closed 8-code refusal union, including VICE's own two source-traced graceful-degradation strings as named outcomes rather than empty successes.
- 42 tests across both files (19 + 23), all green: every refusal code proven reachable with a discriminating real-capture control, purity and no-sort/no-reverse source assertions, idempotency, and interleaved-parse concurrency.
- Automated test gate measured stable at 8 pre-existing failures (unchanged by this plan) across two full-suite runs, matching plan 42-01's own baseline.

## Task Commits

1. **Task 1: prof flat -- ranked cycles, with the separator JavaScript's whitespace class would have eaten** - `24c15c0e` (feat)
2. **Task 2: io -- the decoded register view, its eight-column sprite table, and its two degradation signals** - `cff6a81a` (feat)

**Plan metadata:** committed as part of this SUMMARY.

_Note: both tasks are `tdd="true"` but landed as single `feat` commits, not the usual `test`->`feat` pair -- see Deviations for why._

## Files Created/Modified

- `src/mcp/vice/textmon-profile.ts` (404 lines) - `parseFlatProfile`, its discriminated result/refusal types, and the ASCII-space tokenizer that defends against the U+202F hazard
- `src/mcp/vice/textmon-profile.test.ts` (259 lines) - 19 tests: purity, both real captures, byte-exact separator assertion, stable-tie control, every refusal code, idempotency, concurrency
- `src/mcp/vice/textmon-registers.ts` (638 lines) - `parseIoRegisters`, its discriminated result/refusal types, the dump/decoded-state/sprite-table decoders
- `src/mcp/vice/textmon-registers.test.ts` (334 lines) - 23 tests: purity, both real captures, border/raster divergence proof, header-derived sprite-slicing proof, every refusal code (including both degradation strings), idempotency, concurrency

## Decisions Made

See `key-decisions` in the frontmatter above for the full rationale on each. In brief: ASCII-space-only tokenization for `prof flat` (never `\s`, which matches U+202F); a two-code split (`unrecognised-separator` vs. `malformed-row`) so the two hazard controls discriminate cleanly; the `(header token start - 1)` sprite-boundary formula, MEASURED necessary because real row labels vary 7-11 characters wide while the boundary set must stay uniform; and `io`'s three-outcome decoded-prose rule, scoped explicitly to the free-form middle section only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Process/TDD mismatch] Both tasks' `tdd="true"` marker could not produce a genuine RED phase**

- **Found during:** Task 1, before writing tests
- **Issue:** Both tasks are marked `tdd="true"`, implying a RED (failing test) -> GREEN (minimal implementation) cycle. But each task's own `<action>` text specifies the full parser (including its complete refusal-code union) as a single unit of correct behavior -- a parser cannot correctly accept a real capture's rows/dump without simultaneously implementing every refusal path a malformed row would need, exactly the same process reality plan 42-01's own Task 2 encountered and documented (see `42-01-SUMMARY.md`'s Deviation 3).
- **Fix:** For each module, I wrote the implementation and its full test suite together as a single unit (dry-running the parser mentally and via ad-hoc `node -e` sanity scripts against the real fixture bytes before committing test assertions), then ran the tests and confirmed all green on the first `node --test` invocation. Neither task produced an artificial failing-test commit for zero production-code diff; each landed as one `feat` commit carrying both the module and its test file. This mirrors 42-01's own documented resolution of the identical structural tension.
- **Files modified:** none beyond what is already listed above
- **Verification:** `node --test textmon-profile.test.ts textmon-registers.test.ts` -- 42/42 pass
- **Committed in:** `24c15c0e` (Task 1), `cff6a81a` (Task 2)

---

**Total deviations:** 1 auto-fixed (process/TDD-mismatch, Rule 1, identical in kind to 42-01's own Deviation 3).
**Impact on plan:** No functional gap -- both modules fully implement every behavior and refusal code the plan specifies, proven by 42 passing tests. The deviation is a process note about commit shape, not a missing capability.

## Issues Encountered

None beyond the deviation documented above.

## Measured Findings (plan's own `<output>` requirements)

**Automated-gate baseline, measured at this plan's start and re-measured after both tasks landed:** `npm run test:automated` settled at **8 pre-existing failures** across two full runs taken after this plan's changes -- `anno-register.test.ts` (2), `anno-import.test.ts` (1), `dxa-seam.test.ts` (4, vendored `dxa` binary unbuilt in this worktree), `repo-root.test.ts` (1, worktree-path-location artifact). This is byte-for-byte identical to plan 42-01's own measured baseline (`42-01-SUMMARY.md`'s "Measured Baseline" section). **One run** (the first, immediately after Task 2's commit) additionally showed a 9th failure in `text-protocol.test.ts:311` ("WR-01 planted RED... a quiescence window of 0ms on the banner-drain path splits one logical banner into two events") -- re-run in isolation (`node --test text-protocol.test.ts`), it passed 20/20 with zero failures, and a second full-gate run also returned to exactly 8. This confirms a pre-existing intermittent timing flake in an unrelated file (this plan's two new modules import nothing and have no relationship to `text-protocol.ts`'s banner-drain timing logic), not a regression introduced by this plan.

**The stock capture's leading-row cycle value:** `2326151` (obtained only by decoding the narrow no-break space as a separator rather than treating it as whitespace).

**The thousands separator's exact code point, measured from the real capture's authoritative bytes** (not assumed): **U+202F, NARROW NO-BREAK SPACE**, UTF-8 byte sequence `e2 80 af` -- confirmed via `xxd fixtures/textmon/flat-profile-stock.txt` and asserted in `textmon-profile.test.ts`'s byte-level test against `fixture.buffer`. This is neither U+00A0 (NO-BREAK SPACE, `c2 a0`) nor U+2009 (THIN SPACE, `e2 80 89`) -- the exact byte sequence was read directly from the committed fixture, not inferred from the README's prose description.

**The two captures' measured raster positions and the shared border-colour byte:** stock decodes `Raster cycle/line: 0/311`, fork decodes `Raster cycle/line: 1/0` -- genuinely different, per `fixtures/textmon/README.md`'s own documented finding that `io $d020` samples LIVE, continuously-advancing VIC-II state. The `$D020` register's own byte -- offset `0x20` (32) from the dump's `0xd000` base address, the first byte of the third dump row -- is **identical** across both captures: `0xfe`, decoding to `borderColor: 0x0e` (14) in both. Note: `fixtures/textmon/README.md` describes this as "byte 5 of the register dump," which does not match this plan's own measured offset (`0x20`/32) against the actual `$D000`-based dump this module parses -- a minor imprecision in that pre-existing doc's prose, not something this plan modifies (README.md is out of this plan's `files_modified` scope) and not something that affects correctness here, since both this module's parser and its tests derive the offset from the real bytes directly rather than from the README's prose.

**Every refusal code proven reachable per module:**
- `textmon-profile.ts` (`FlatProfileRefusalCode`, 5 members): `empty-response` (empty string, whitespace-only, prompt-only -- 3 cases), `missing-header`, `malformed-row`, `unrecognised-separator`, `unrecognised-percentage` -- all 5 reachable, each paired with a discriminating real-capture-still-parses control (except the 3 `empty-response` cases, which have no "real capture" analog to pair against).
- `textmon-registers.ts` (`IoRegistersRefusalCode`, 8 members): `empty-response` (3 cases as above), `malformed-dump` (2 planted variants: non-hex byte, wrong value count), `unrecognised-memspace` (message asserted to contain `vice_device_console`), `unparseable-value` (message asserted to name the recognised label), `unrecognised-sprite-row`, `sprite-column-count`, `no-details-available`, `no-io-regs-available` -- all 8 reachable, the 5 structural planted controls each paired with a discriminating real-capture-still-parses control, and both degradation-string tests explicitly named "source-traced (monitor.c:1980-2000, not live-observed)" per the plan's own instruction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both `textmon-profile.ts` and `textmon-registers.ts` are ready for plan 42-07's tool-wiring pass (`vice_prof_flat`, `vice_io_registers`) and for plan 42-08's phase-wide `textmon-` family-floor structural test.
- `PARSE-02`'s four structured text-monitor results are now complete across this phase's four landed parser modules (`textmon-memmap.ts` from 42-01, `textmon-profile.ts` and `textmon-registers.ts` from this plan, plus whatever 42-02/42-05 land for `chis`/`bt`).
- No blockers for the next plan in this wave. `text-protocol.ts`'s `TEXT_COMMAND_ALLOWLIST` parameterization (D-42-1, plan 42-04) and the `vice_prof_flat`/`vice_io_registers` tool registrations (plan 42-07) are both still pending, unaffected by anything in this plan.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
