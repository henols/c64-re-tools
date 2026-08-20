---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 06
subsystem: infra
tags: [regenerator2000, memmap, enum-generation, acme, code-generation]

# Dependency graph
requires:
  - phase: 11-05
    provides: "r2000-tools.ts: runR2000Tool()/CURATED_R2000_TOOLS/resolveStorePath() -- the curated allow-list runner every mutating/read call in this plan routes through"
  - phase: 11-02
    provides: "the memmap.json 29-entry bits shape and driver.mjs's own address-resolution precedent this plan's generator overlaps with"
provides:
  - "r2000-regbits-gen.ts: buildRegBits()/buildRegBitsDocument(), the generated address->bit-name table with OVERRIDES fixing two OCR-damage cases and six memmap-absent synthetic registers"
  - "r2000-regbits.json: the committed, banner-marked (generator + memmap.json sha256, no timestamp) generated artifact 35 registers deep"
  - "r2000-enum-gen.ts: variantNameFor()/assertLegalAcmeIdentifier()/pairImmediateLoadsToStores()/createOrUpdateEnum()/generateEnums() -- decode-to-name, sanitize, adjacent-pair, install, and the coverage report"
  - "the gen-enums CLI verb (r2000-cli.ts), and criterion 3's acceptance test proving the pinned lda #$1b/sta $d011 example renders correctly in a real ACME export and reassembles"
affects: [11-07, 11-08-memory-map-renderer, 11-09-skill-prose, 11-10, 11-11, 11-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generated-but-committed artifact with a source-digest banner and a drift guard that re-runs the generator in memory and deep-equals the committed file (mirrors resources-sync.test.ts's pattern for a JSON target instead of compiled .mjs)"
    - "Explicit-token-including-empty-string design for a 'silent by design' flag state: a field's tokens map always has an entry for every value it can take, even when that entry is the empty string (filtered out of the joined name) -- never an absent key, so 'no token' stays a genuine, throwable data error rather than an expected shape"
    - "Client-side register/mode narrowing after an exact-mnemonic search, replacing a combined mnemonic+operand regex that regenerator2000's own search_disassembly does not support (mnemonic and operand are matched independently, never concatenated) -- measured live, not assumed from RESEARCH.md"

key-files:
  created:
    - .claude/mcp/vice/r2000-regbits-gen.ts
    - .claude/mcp/vice/r2000-regbits.json
    - .claude/mcp/vice/r2000-regbits.test.ts
    - .claude/mcp/vice/r2000-enum-gen.ts
    - .claude/mcp/vice/r2000-enum-gen.test.ts
  modified:
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-cli.test.ts

key-decisions:
  - "Table keys are $XXXX (uppercase, dollar-prefixed, 4-hex-digit) strings, not decimal numbers -- matches this project's own assembly/documentation convention and keeps Object.keys().sort() numeric-order-equivalent for free"
  - "A field whose entire tokens map is silent (the empty-string state) at a given register value -- e.g. $D015 (Sprite Enable) value 0, all eight sprites off -- falls back to the identifier V<value> rather than emitting an illegal empty string; this can fire at most once per register (only a numeric-free, all-flag register can reach it), so it never collides with a genuine multi-token name"
  - "createOrUpdateEnum()'s documented precedence: try r2000_create_project_enum first; only on regenerator2000's own 'already exists' failure (validate_new_enum_name, app_state.rs:443-457 -- there is no upsert) fall back to r2000_update_project_enum, which replaces the variant map wholesale"
  - "Sanitization runs entirely client-side (assertLegalAcmeIdentifier on the enum name and every variant name) BEFORE any r2000_create_project_enum/_update_ call -- proven zero-spawn via a spy binary, mirroring r2000-tools.test.ts's own D-33 smuggling proof"
  - "gen-enums is a CLI verb, never an 18th MCP tool -- same reasoning the plan's own objective states: a whole-project mutation plus a save plus a coverage report is bootstrap's shape, and a CLI run leaves the numbers in a visible transcript"

patterns-established:
  - "A generated JSON artifact's banner records generator name + upstream source digest + a do-not-hand-edit warning, deliberately omitting any timestamp so the drift comparison stays byte-total, not merely 'close enough'"
  - "A reserved-identifier check backed by a REAL measurement against the external tool it protects (LDA rejected, A accepted by real ACME 0.97), not a guessed keyword list"

requirements-completed: [R2000-13]

# Metrics
duration: ~100min
completed: 2026-08-21
---

# Phase 11 Plan 06: Enums Generated From memmap.json Summary

**`lda #$1b` / `sta $d011` now renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` in real ACME-exported source, generated re-runnably from a curated, digest-pinned bit-name table built from `memmap.json`.**

## Performance

- **Duration:** ~100 min (PLAN_START_TIME not captured at kickoff; timed from first file read to final commit)
- **Started:** 2026-08-21T00:20 (approx.)
- **Completed:** 2026-08-21T02:00 (approx.)
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- `r2000-regbits-gen.ts` reads `memmap.json`'s 29 structured `bits` entries, normalises single/descending/ascending bit ranges, and mechanically derives a legal ACME identifier per field -- throwing (never placeholdering) when a description is unmappable and uncovered by `OVERRIDES`. `OVERRIDES` fixes two real OCR-damage cases (`$D011` bit 4's "O = Blank" letter-O-for-zero, `$DD0D`'s "Read NMls") and supplies six registers `memmap.json`'s own `io` parser never produced `bits` for at all (`$D015`/`$D017`/`$D01A`/`$D01B`/`$D01C`/`$D01D`), every entry carrying its own WHY comment.
- `r2000-regbits.json` is the committed, banner-marked artifact (35 registers, no timestamp) -- the drift guard re-runs `buildRegBits()` in memory and deep-equals it against the committed file; regenerating leaves `git diff` clean.
- `r2000-enum-gen.ts`'s `variantNameFor()` decodes `$D011` value `0x1b` to exactly `YSCROLL3_ROW25_SCREENON_TEXT` (the pinned target), and is proven injective across all 256 values for `$D011`/`$D016`/`$D018`/`$D015`.
- `assertLegalAcmeIdentifier()` (T-11-ENUM-NAME) refuses an empty/oversized/illegal-character identifier and a reserved 6502/6510 mnemonic -- the mnemonic reservation is a REAL measurement against ACME 0.97 (`LDA = $05` rejected, `A = $05` accepted), not a guessed list.
- Corrected RESEARCH.md's own Pattern 2 assumption via a live measurement this session: `r2000_search_disassembly` matches `mnemonic` and `operand` INDEPENDENTLY (`state/search.rs:309-313`), never as one concatenated string, so a combined `"^sta \$(...)"`-style query never matches either field. `pairImmediateLoadsToStores()` instead queries exact mnemonics (`"^lda$"`/`"^sta$"`) and narrows to known registers client-side -- still derived from `r2000-regbits.json`'s own keys, never a second hardcoded list.
- `gen-enums <project> [--max-results N]` (CLI verb, not an MCP tool) drives `generateEnums()` end to end: two explicit-`max_results` searches, adjacent-only pairing (D-23), one variant per distinct value observed (D-20), create-or-update precedence, apply-usage at every paired `lda` address, and a coverage report naming totals/pairing/truncation in words.
- Criterion 3's acceptance test synthesizes the criterion's own literal example (`lda #$1b`/`sta $d011`/`rts` at `$0810`), runs `gen-enums` then `export-asm` then `verify`, and proves against the REAL ACME export (never the live query view) that it contains `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` and `D011_YSCROLL3_ROW25_SCREENON_TEXT = $1b`, never falls back to bare `lda #$1b`, and reassembles byte-identical under real ACME.

## Task Commits

Each task was committed atomically:

1. **Task 1: r2000-regbits-gen.ts and the committed curated table (D-22)** - `8b54299` (feat)
2. **Task 2: r2000-enum-gen.ts -- value decoding, the adjacent-pair pass, sanitization and the coverage report** - `e83f697` (feat)
3. **Task 3: the gen-enums verb and criterion 3's acceptance test against the ACME export** - `27b6a32` (feat)

## Files Created/Modified

- `.claude/mcp/vice/r2000-regbits-gen.ts` - The re-runnable generator: `buildRegBits()`/`buildRegBitsDocument()`, `OVERRIDES`, mechanical identifier derivation, overlap dedup
- `.claude/mcp/vice/r2000-regbits.json` - The committed, banner-marked generated table (35 registers)
- `.claude/mcp/vice/r2000-regbits.test.ts` - 13 tests: drift guard, digest pin, identifier legality, override-supplied-register presence, WHY-comment coverage, two non-vacuity proofs
- `.claude/mcp/vice/r2000-enum-gen.ts` - `variantNameFor`, `assertLegalAcmeIdentifier`, `pairImmediateLoadsToStores`, `createOrUpdateEnum`, `generateEnums`
- `.claude/mcp/vice/r2000-enum-gen.test.ts` - 23 tests: pinned target, 256-value injectivity x4, sanitization refusals + zero-spawn proof, pairing arithmetic, truncation wording, live-gated pairing/generation/precedence
- `.claude/mcp/vice/r2000-cli.ts` - `gen-enums` verb (`cmdGenEnums`/`parseGenEnumsArgs`), extended `USAGE`
- `.claude/mcp/vice/r2000-cli.test.ts` - gen-enums CLI tests (unknown option, missing path, nonexistent file) plus criterion 3's full acceptance test
- `.claude/mcp/vice/package.json` - Added `r2000-regbits-gen.ts`/`r2000-regbits.json`/`r2000-enum-gen.ts` to `files[]`

## Decisions Made

- **Table keys are `$XXXX` strings** (documented in the generator's own header) -- matches this repo's own assembly convention and keeps fixed-width lexicographic sort numeric-order-equivalent.
- **The `V<value>` fallback for an all-fields-silent decode** -- see Deviations #2 below; this was discovered live, not anticipated by the plan text.
- **`createOrUpdateEnum()`'s create-then-update precedence**, decided and documented per the plan's own instruction: create first, fall back to update only on regenerator2000's own "already exists" failure.
- **No standalone final `r2000_save_project` call in `generateEnums()`** -- see Deviations #4 below; every mutating call already persists via `r2000-tools.ts`'s own per-call auto-save (plan 11-05), so an additional explicit save would only ever observe an unchanged hash and report a spurious `R2000SaveNotPersistedError`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RESEARCH.md's Pattern 2 combined-regex assumption does not match measured regenerator2000 behavior**
- **Found during:** Task 2, implementing `pairImmediateLoadsToStores()`
- **Issue:** RESEARCH.md's own worked example queried `` `^sta \$(${knownRegisterHexAlternation})` `` expecting it to match a "mnemonic + operand" combined string. Live measurement against a real regenerator2000 0.9.20 child (`state/search.rs:309-313`) showed `mnemonic` and `operand` are matched INDEPENDENTLY (OR semantics) -- neither field alone ever starts with `"sta $d011"`, so the combined-regex query always returned zero rows.
- **Fix:** Query exact mnemonics (`"^lda$"`/`"^sta$"`, case-insensitive via the server's own `(?i)` prefix), then filter client-side: Pass 1 keeps only rows whose `operand` starts with `#` (immediate mode); Pass 2 keeps only rows whose `operand` (normalised to a `$XXXX` key) is a member of the register set derived from `r2000-regbits.json`'s own keys -- preserving D-23's "the register list is derived from the table, never a second hardcoded list" requirement, just via a different mechanism.
- **Files modified:** `.claude/mcp/vice/r2000-enum-gen.ts` (documented at length in the module's own header, under "MEASURED MECHANISM FACTS")
- **Verification:** Live-gated `pairImmediateLoadsToStores()` test finds exactly the expected 1 paired occurrence on the criterion-3 fixture; `generateEnums()`'s own gated test and criterion 3's full acceptance test both pass end to end.
- **Committed in:** `e83f697` (Task 2 commit)

**2. [Rule 1 - Bug] `variantNameFor()` could produce an illegal empty-string identifier for an all-fields-silent register value**
- **Found during:** Task 2, writing the 256-value injectivity property test for `$D015`
- **Issue:** `$D015` (Sprite Enable) is modeled as eight independent flag fields, each silent (empty token) when its own bit is clear -- deliberately, so a typical "most sprites off" value renders as a short name. At value `0` (every sprite disabled), EVERY field contributes an empty token, so the joined name is `""` -- not a legal ACME identifier, and would have thrown inside `assertLegalAcmeIdentifier` the first time a real program actually wrote `0` to that register.
- **Fix:** `variantNameFor()` now falls back to `V<value>` (e.g. `V0`) when the joined token list is empty. Since only a register whose EVERY field is flag/enum-kind (never numeric, which always emits a non-empty token) can reach this branch, and only at the single value where every one of those fields lands on its silent state, the fallback can fire at most once per register and can never collide with a genuine multi-token name.
- **Files modified:** `.claude/mcp/vice/r2000-enum-gen.ts`
- **Verification:** The `$D015` 256-value injectivity test (previously failing with "value 0x0 produced an empty variant name") now passes.
- **Committed in:** `e83f697` (Task 2 commit)

**3. [Rule 3 - Blocking] Gated tests using the OS temp directory were refused by `resolveStorePath()`'s workspace-containment check**
- **Found during:** Task 2 and Task 3, writing the live-gated integration tests
- **Issue:** `r2000-tools.ts`'s `resolveStorePath()` (T-11-PATH-ESCAPE) requires every `.regen2000proj` path to resolve inside the workspace root. Tests built with `mkdtempSync(join(os.tmpdir(), ...))` (a natural default) were refused with `R2000StorePathError`, since `/tmp/...` is outside the repo.
- **Fix:** Every gated test now uses a workspace-local temp directory (`mkdtempSync(join(HERE, ".xyz-test-..."))`), mirroring `r2000-tools.test.ts`'s own existing convention for its live-gated tests.
- **Files modified:** `.claude/mcp/vice/r2000-enum-gen.test.ts`, `.claude/mcp/vice/r2000-cli.test.ts`
- **Verification:** All previously-failing gated tests pass under `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1`.
- **Committed in:** `e83f697` and `27b6a32`

**4. [Rule 1 - Bug, plan-text clarification] The literal "then r2000_save_project through the curated runner's verified-save route" step is not a separate call**
- **Found during:** Task 2, designing `generateEnums()`'s own persistence step
- **Issue:** Plan 11-05's own `runR2000Tool()` already auto-saves internally after every mutating call (a plain, non-hash-verified save, by design -- see 11-05-SUMMARY's own Deviations #2). A literal standalone `runR2000Tool("r2000_save_project", ...)` call issued AFTER a sequence of already-auto-saving `r2000_create_project_enum`/`r2000_apply_enum_usage` calls would find nothing new pending and throw `R2000SaveNotPersistedError` -- documented in 11-05-SUMMARY.md as the EXPECTED (not buggy) shape of exactly that call sequence ("rarely required standalone").
- **Fix:** `generateEnums()` issues no separate final save call. Persistence is proven independently at the ACME export layer (Task 3's criterion-3 test reads the actual exported file), not re-asserted via a save call that would always report a spurious failure in this design.
- **Files modified:** `.claude/mcp/vice/r2000-enum-gen.ts` (documented in `generateEnums()`'s own doc comment)
- **Verification:** The gated `generateEnums()` end-to-end test and criterion 3's acceptance test both confirm the mutations are durably on disk (the ACME export reads them back from a fresh `--headless` process) without any explicit final save call.
- **Committed in:** `e83f697` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking-issue fix across two commits)
**Impact on plan:** All four were necessary for correctness -- without #1 the pairing pass would find nothing ever; without #2 a real program writing `0` to a sprite-plane register would crash generation; without #3 the live-gated tests could never run; without #4 `generateEnums()` would always fail its own last step. No scope creep: every fix stayed inside the files this plan's own tasks already touch.

## Issues Encountered

- **A genuine limitation, documented rather than silently worked around (not a bug fixed, a boundary named):** once `r2000_apply_enum_usage` has been applied to an address, that instruction's own `r2000_search_disassembly` operand text switches from the raw immediate (`"#$1b"`) to the applied enum reference (`"#D011.YSCROLL3_..."`, the dot form). A literal `generateEnums()`-then-`generateEnums()`-again re-run over the SAME already-applied instructions therefore finds nothing left to pair on its second pass (a safe no-op, not a crash -- `parseImmediateOperand` correctly refuses the enum-reference text and the miss costs nothing, per D-23's own posture). The create-then-update PRECEDENCE itself is still fully proven (via a direct `createOrUpdateEnum()` call with a hand-built variants map, isolated from the pairing pass), but a literal end-to-end double-run over the identical fixture does not exercise it. Filed as a known follow-up: closing this fully would need either a pre-pass that clears every existing enum usage before re-pairing, or a currently out-of-scope tool (`r2000_read_region`, excluded by D-18) to read a raw byte directly regardless of its current enum-usage state.

## User Setup Required

None -- no external service configuration required. `regenerator2000 0.9.20` (`~/.cargo/bin/regenerator2000`) and ACME 0.97 (`~/.local/bin/acme`) were already installed on this host from prior phase work; every gated test in this plan ran against them directly.

## Non-Vacuity / Drift Transcripts (recorded per this plan's own `<verification>` requirement)

**Memmap-digest drift transcript** (`r2000-regbits.test.ts`, planted violation -- a byte appended to a SCRATCH copy of `memmap.json`, the real file never touched):
```
committed memmap.json digest: 60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
mutated (planted-violation) memmap.json digest: 9d1cd787afc983a7309269cfd3b730c8052fb3cdc2845ef2e1e45af78f9faaa1
```
The two digests disagree, proving the drift guard's own comparison (`banner.memmapSha256 === memmapSha256()`) would genuinely fail if this mutated file were the real one and nobody had regenerated.

**Zero-spawn injection refusal** (`r2000-enum-gen.test.ts`): a variant name `"BAD\nNAME = $00"` passed to `createOrUpdateEnum()` with `R2000_BIN` pointed at a spy binary that writes a marker file and exits 1 if ever invoked -- the call rejected with `/not a legal ACME identifier/` and the marker file was never created (`existsSync(marker) === false`), confirming sanitization happens entirely client-side before any child process spawn.

**Coverage numbers from the criterion-3 acceptance run** (`r2000-cli.test.ts`, `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1`):
```
total register stores seen: 1
paired (adjacent lda #imm found): 1
unpaired (no adjacent immediate load): 0
```
Both search passes reported `pass1Truncated: false` / `pass2Truncated: false` (well under the 10000-row default ceiling for this 6-byte fixture).

**Separator observed on each surface, recorded live this session** (`r2000-cli.test.ts` diagnostics):
```
live search_disassembly operand for the applied enum: "#D011.YSCROLL3_ROW25_SCREENON_TEXT"
ACME export operand:                                  "lda #D011_YSCROLL3_ROW25_SCREENON_TEXT"
separator comparison: export=underscore, live=dot -- RESEARCH.md's dot-vs-underscore finding still holds on this regenerator2000 version
```
RESEARCH.md's Assumption A2 (the dot-vs-underscore discrepancy is version-scoped, not permanent) is confirmed unchanged on the installed `regenerator2000 0.9.20`.

## Verification Evidence

- `cd .claude/mcp/vice && node --test r2000-regbits.test.ts` -> 13/13 pass.
- `cd .claude/mcp/vice && node --test r2000-enum-gen.test.ts` -> 19/19 pass locally (no live binary required beyond the always-run gate test); `VICE_REQUIRE_R2000=1 node --test r2000-enum-gen.test.ts` -> 23/23 pass (4 additional live-gated tests run).
- `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-enum-gen.test.ts r2000-cli.test.ts` -> 47/47 pass.
- `node r2000-regbits-gen.ts && git diff --exit-code -- r2000-regbits.json` -> clean (byte-identical regeneration).
- `cd .claude/mcp/vice && npm run typecheck` -> clean.
- `cd .claude/mcp/vice && npm run test:automated` -> 1868 pass, 1 fail (pre-existing, worktree-only `repo-root.test.ts` path-agreement assertion, documented in this plan's own `prior_wave_context` and NOT introduced by this plan), 5 todo.
- `node scripts/check-npm-packages.mjs` -> OK, 69 files for `@henols/vice-mcp` (the three new files present, transitive closure clean, 52 modules from `vice-proxy.ts`).
- `node scripts/check-skill-tool-coverage.mjs` -> OK (r2000_*: 0 distinct names extracted from skills yet -- expected, no skill mentions an r2000_* name until plan 11-09).
- `node scripts/check-skill-fork-honesty.mjs` -> OK.
- Without `VICE_REQUIRE_R2000`/`VICE_REQUIRE_ACME` set and with `R2000_BIN`/`ACME_BIN` pointed at nonexistent paths: `node --test r2000-cli.test.ts` -> 21 pass, 3 SKIP (never fail), exit 0.

## Next Phase Readiness

- `r2000-regbits.json`'s 35-register table and `r2000-enum-gen.ts`'s `variantNameFor()`/`registerKeyFor()` are available for any later plan needing address->semantic-name decoding (e.g. plan 11-08's memory-map renderer).
- `gen-enums` is reachable as `vice-mcp r2000 gen-enums <project> [--max-results N]` through all three distribution routes this repo already resolves the `r2000` subcommand from.
- Known, documented (not blocking) follow-up: a literal double-run of `generateEnums()` over already-enum-applied addresses is a safe no-op rather than a genuine re-derivation, per Issues Encountered above -- worth revisiting if a future plan needs true idempotent re-generation after external disassembly changes.
- No blockers. `regenerator2000` and `ACME` both remain available and live-verified on this host for any future plan needing either oracle.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/r2000-regbits-gen.ts
- FOUND: .claude/mcp/vice/r2000-regbits.json
- FOUND: .claude/mcp/vice/r2000-regbits.test.ts
- FOUND: .claude/mcp/vice/r2000-enum-gen.ts
- FOUND: .claude/mcp/vice/r2000-enum-gen.test.ts
- FOUND: .claude/mcp/vice/package.json
- FOUND: .claude/mcp/vice/r2000-cli.ts
- FOUND: .claude/mcp/vice/r2000-cli.test.ts
- FOUND commit: 8b54299 (feat(11-06): r2000-regbits-gen.ts -- the generated address-to-bit-name table (D-22))
- FOUND commit: e83f697 (feat(11-06): r2000-enum-gen.ts -- value decoding, adjacent pairing, sanitization and the coverage report (D-20/D-23))
- FOUND commit: 27b6a32 (feat(11-06): the gen-enums verb and criterion 3's acceptance test against the ACME export)
