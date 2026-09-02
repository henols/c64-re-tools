---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 04
subsystem: capture-substrate
tags: [vsf, snapshot, binary-parsing, refusal, fixtures, cli, skills, node-test]

# Dependency graph
requires:
  - phase: 33-01
    provides: "The frozen GATE-01 decision rules, the outcome-line schema (SCHEMA.md 2.4's SLICER: derivation) and the evidence conventions"
  - phase: 33-02
    provides: "The AMENDED 2026-09-02 rider on D-21 carrying the measured body lengths 65543/65555, without which the slicer would refuse every real snapshot"
provides:
  - "src/mcp/vice/vsf-slice.ts — the one authoritative place holding .vsf snapshot byte-layout knowledge: the strict module-table walk and the C64MEM slice"
  - "sliceC64Mem() returning a flat 65536-byte image plus the CPU-visible port bytes (dataOut/dataRead/dirRead) from the 3-byte suffix"
  - "listSnapshotModules() — a strict walk from a derived FIRST_MODULE_OFFSET of 58 with a terminal offset-equals-file-length assertion"
  - "Eight named refusals, each observed: malformed header, short body, missing C64MEM, duplicated C64MEM, zero-byte input, truncated header, absent magic, walk not ending at the file length"
  - "Four synthetic .vsf fixtures under src/mcp/vice/fixtures/vsf/ with provenance sidecars, plus their single generator"
  - "A guarded CLI entry point (verbs slice/digest) and the skill-side wrapper that reaches it over a documented resolution ladder"
  - "evidence/33-04-slicer-substrate.md — one half of SLICER:'s declared derivation, plus the ACCEPTED LIMIT recording why the line is not emitted here"
affects: [33-07, 33-10, 33-12, capture-predicate, stop-oracle, capture-pair]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the
# realized diff), never a harness token count.
actuals:
  tokens: 25713
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Library/CLI split inside one module, separated by a source marker the structural test reads, so purity is asserted over the region every importer gets"
    - "Refusal-as-deliverable: every refusal path carries its own fixture or in-test construction, and the discriminating positive is asserted in the same test"
    - "Fixture generator committed alongside the fixtures it produces, named in every provenance sidecar, so a 64K blob is re-derivable and checkable"
    - "Cross-package reach by CLI invocation rather than a second copy of a version-sensitive byte layout, with the choice recorded in the wrapper's header and the absence of layout tokens asserted mechanically"

key-files:
  created:
    - src/mcp/vice/vsf-slice.ts
    - src/mcp/vice/vsf-slice.test.ts
    - src/mcp/vice/fixtures/vsf/make-fixtures.mjs
    - src/mcp/vice/fixtures/vsf/wellformed-minor1.vsf
    - src/mcp/vice/fixtures/vsf/wellformed-minor1.json
    - src/mcp/vice/fixtures/vsf/wellformed-minor0.vsf
    - src/mcp/vice/fixtures/vsf/wellformed-minor0.json
    - src/mcp/vice/fixtures/vsf/malformed-header.vsf
    - src/mcp/vice/fixtures/vsf/malformed-header.json
    - src/mcp/vice/fixtures/vsf/short-c64mem.vsf
    - src/mcp/vice/fixtures/vsf/short-c64mem.json
    - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
    - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-04-slicer-substrate.md
  modified:
    - src/mcp/vice/package.json
    - src/skills/c64-ram-capture/SKILL.md

key-decisions:
  - "Route (b) over route (a) for the cross-package reach: an MCP-side CLI entry point the skill invokes, NOT a second skill-side copy of the layout on anno-d64.ts's two-independent-copies precedent. That precedent duplicates a stable published disk format; the .vsf layout is version-sensitive and one stale copy already existed."
  - "The structural no-I/O assertion is scoped to a CLI_REGION_BEGIN marker in the module's own source, not to the whole file, because the CLI entry point below it does exactly the file I/O the library refuses. The marker must appear exactly once and the test fails loudly rather than scanning the wrong region."
  - "The RAM copy is new Uint8Array + set, never bytes.slice(): Buffer.prototype.slice overrides the TypedArray method as an alias for subarray, so slice() returns a VIEW for the Buffer every real caller passes."
  - "SLICER: is NOT emitted by this plan. SCHEMA.md 2.4 requires the capture-predicate/capture-seam transcript too, and neither file exists yet; the gap is recorded as an ACCEPTED LIMIT in this plan's own evidence file rather than by inventing a line name, guessing a value, or editing a frozen file."
  - "A committed fixture generator, not four opaque blobs: three of the four fixtures are ~64 KB and their interesting facts are arithmetic (65543 versus 65542), which a blob with no producer cannot make checkable."

patterns-established:
  - "Library/CLI region split by a uniquely-occurring source marker, with the structural guard deriving its scope from that marker rather than from a line number"
  - "Refusal paths as first-class deliverables: a fixture per refusal, message-content assertions rather than assert.throws alone, and the positive control asserted alongside so the refusal discriminates"
  - "A resolution ladder that refuses by name, listing every path tried, with no local re-implementation to fall back to — so a resolution failure can never become a wrong image"
  - "Structural absence assertions on a wrapper: the layout tokens are enumerated in the test and asserted absent from the wrapper's source, making route (b) a red gate rather than a promise"

requirements-completed: [CAP-01]

coverage:
  - id: D1
    description: "A flat 64K image comes out of a .vsf snapshot's C64MEM module body with no transcription step anywhere — bytes in, bytes out, no hex ever rendered or re-parsed"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#sliceC64Mem: a well-formed minor-1 snapshot yields exactly 65536 bytes of RAM"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#sliceC64Mem: the returned image is the RAM ARRAY, not the 4-byte port prefix"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#sliceC64Mem: dataOut/dataRead/dirRead come from the 3-byte SUFFIX after the RAM array"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both accepted body lengths are recognised and reported with their snapshot minor: 65543 at module minor 0 and 65555 at minor 1, with 65542 refused naming the observed value and the minimum"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#the body-length BOUNDARY, as a boundary: 65543 is accepted and 65542 is refused"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#snapshot minor 0: 65536 RAM bytes, snapshotMinor 0, bodyLength 65543, suffix bytes present"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#short C64MEM body: refuses naming both the observed 65542 and the minimum 65543"
        status: pass
    human_judgment: false
  - id: D3
    description: "A malformed snapshot is refused rather than silently truncated or resynced, proven by a fixture with the well-formed case asserted alongside so the refusal discriminates"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#malformed module header: refuses at the offset, naming it, and says it did not rescan"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#the refusal DISCRIMINATES: the well-formed fixture in the same test does not throw"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#a walk that does not end exactly at the file length is refused, naming both numbers"
        status: pass
    human_judgment: false
  - id: D4
    description: "A missing C64MEM, a duplicated C64MEM, a zero-byte input and a truncated header are each refused by name rather than returning a short buffer, and a containing name does not match a byte-exact one"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#no C64MEM module: refuses listing the module names that WERE found"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#two C64MEM modules: refuses naming the count and both offsets, never first-wins"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#a zero-byte input is refused by name, never as a short buffer"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#a name that merely CONTAINS C64MEM does not match -- C64MEMHACKS is a real adjacent module"
        status: pass
    human_judgment: false
  - id: D5
    description: "vsf-slice.ts takes bytes and returns values: no filesystem path parameter, nothing imported from either host/container path-translation seam, so the closed five-member host-path consumer set is unchanged"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#no exported function takes a filesystem path -- both take a byte array"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#vsf-slice.ts imports nothing from this repo -- only node: builtins, and only in the CLI region"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts (13 tests, fail 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The skill-side route reaches the ONE authoritative .vsf layout module over a documented resolution ladder that refuses by name, rather than carrying a second copy of the byte layout"
    requirement: "CAP-01"
    verification:
      - kind: integration
        ref: "src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs#slice: reaches the layout module over the in-repo rung and writes a full 64K image"
        status: pass
      - kind: integration
        ref: "src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs#no rung resolves: exits non-zero naming EVERY path tried and telling the caller to set VICE_MCP_DIR"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs#the wrapper carries no snapshot layout constant of its own"
        status: pass
    human_judgment: false
  - id: D7
    description: "The CLI entry point runs only when the module is the process entry point, so importing it still performs no I/O, and it prints the library's own refusal message unmodified"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#importing vsf-slice.ts runs nothing: a fresh process that only imports it exits 0 and prints nothing"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vsf-slice.test.ts#the CLI exits non-zero on a malformed snapshot and prints the module's OWN message, unmodified"
        status: pass
      - kind: other
        ref: "plan verify: D=$(mktemp -d) && node src/mcp/vice/vsf-slice.ts slice ... --out $D/image.bin && test 65536 && malformed exits non-zero with 'refus' on stderr -> CLI_OK"
        status: pass
    human_judgment: false
  - id: D8
    description: "Four synthetic .vsf fixtures with provenance sidecars declaring themselves synthetic and naming their generator; the module ships in files[] and no fixture does"
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#every .vsf fixture has a sidecar declaring itself synthetic and naming its generator"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vsf-slice.test.ts#vsf-slice.ts is in package.json files[] and no fixtures entry is"
        status: pass
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (exit 0; @henols/vice-mcp 80 files, @henols/c64-re-tools 35 files, no fixture or test file leaked)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The SLICER: gate input is NOT emitted by this plan; the gap is recorded as an ACCEPTED LIMIT with this plan's half of the declared derivation banked as a transcript"
    verification: []
    human_judgment: true
    rationale: "Whether declining to emit a declared gate input was the right call under a frozen pre-commitment is a judgment about the phase's decision discipline, not something a test can assert. The facts a reviewer needs are mechanical and stated in evidence/33-04-slicer-substrate.md: the three frozen files are unmodified at their single commit 2a8ef95, no SLICER: line exists at column 0 anywhere in this plan's output, and capture-predicate.test.ts / capture-seam.test.ts are absent from the tree."

duration: 22 min
completed: 2026-09-02
status: complete
---

# Phase 33 Plan 04: The `.vsf` Slicer and the Refusals That Make It Trustworthy Summary

**A flat 64K image sliced out of a VICE `.vsf` snapshot's `C64MEM` body by a strict module-table walk from a derived offset of 58, with eight named refusals each proven by a fixture, reachable from the skill side over a resolution ladder that carries no second copy of the byte layout**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-02T19:10:00Z
- **Completed:** 2026-09-02T19:32:11Z
- **Tasks:** 3
- **Files modified:** 16 (14 created, 2 modified)

## Accomplishments

- **`src/mcp/vice/vsf-slice.ts`** is now the one place in the tree holding `.vsf` byte-layout
  knowledge. `listSnapshotModules()` walks the module table strictly from
  `FIRST_MODULE_OFFSET` — written as `SNAPSHOT_MAGIC.length + 2 + SNAPSHOT_MACHINE_NAME_LEN +
  SNAPSHOT_VERSION_MAGIC.length + 4 + 4`, which evaluates to 58 — reading each size field as
  u32LE at header offset 18, advancing by that size and never by one byte, and asserting the
  walk ends at **exactly** the file length.
- **`sliceC64Mem()`** returns a flat 65536-byte image plus the three CPU-visible port bytes
  taken from the **suffix** after the RAM array (`dataOut`, `dataRead`, `dirRead`), never from
  the 4-byte prefix, along with the `C64MEM` module's own minor and the observed body length.
  Both accepted lengths are recognised: 65543 at minor 0 and 65555 at minor 1.
- **Eight refusals, every one observed rather than asserted:** a malformed module header, a
  short body, a missing `C64MEM`, a duplicated `C64MEM`, a zero-byte input, an input one byte
  short of a header plus one module header, an absent magic, and a walk that does not end at the
  file length. Each names the offending value and the valid range, and every one contains a
  lowercase `refusing`, so the whole family is findable from one pattern.
- **The refusal discriminates.** `malformed-header.vsf` is the positive control for the strict
  walk: an implementation carrying an `off++` rescan fallback would step past it, so that
  fixture slicing successfully means the fallback is back. The well-formed fixture's
  `assert.doesNotThrow` sits in the same test, so a slicer that refused unconditionally would
  fail rather than pass.
- **Four synthetic fixtures with a committed generator.** `fixtures/vsf/make-fixtures.mjs`
  produces all four deterministically and is named in every `"synthetic": true` sidecar, so a
  ~64 KB blob is re-derivable and its interesting arithmetic (65543 versus 65542) is checkable
  rather than taken on trust. The first 64 bytes of `wellformed-minor1.vsf` are byte-identical
  to `33-RESEARCH.md` M5's hexdump of a genuine 3.9 snapshot.
- **The skill reaches the module without duplicating it.**
  `src/skills/c64-ram-capture/scripts/vsf-slice.mjs` forwards to a guarded CLI entry point over
  a three-rung ladder (`VICE_MCP_DIR`, the in-repo path, `@henols/vice-mcp`) and, when no rung
  resolves, exits non-zero **listing every path it tried** with no local re-implementation to
  fall back to. Its test enumerates the layout tokens and asserts every one is absent from the
  wrapper's source.
- **`evidence/33-04-slicer-substrate.md`** banks this plan's half of `SLICER:`'s declared
  derivation and records, as an `## ACCEPTED LIMIT`, why the outcome line itself is not emitted
  here.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): one genuine-shaped snapshot in, one flat 65536-byte image plus its
   CPU-visible port bytes out** — `f8da9e5` (feat)
2. **Task 2: the refusal cases — a malformed header, a short body, a missing and a duplicated
   `C64MEM`, and snapshot minor 0** — `a2d3478` (test)
3. **Task 3: the skill-side route — one CLI entry point, no second copy of the layout** —
   `a6f22ba` (feat)
4. **Evidence: the slicer transcript and the `SLICER:` accepted limit** — `b38efe7` (docs)

## Files Created/Modified

- `src/mcp/vice/vsf-slice.ts` — the one authoritative `.vsf` layout module: named constants
  written as arithmetic, `listSnapshotModules()`, `sliceC64Mem()`, `VsfSliceError`, and (below
  the `CLI_REGION_BEGIN` marker) a guarded CLI entry point with verbs `slice` and `digest`
- `src/mcp/vice/vsf-slice.test.ts` — 34 tests: the constants, the walk, the end-to-end slice,
  every refusal with message-content assertions, and the structural supplement
- `src/mcp/vice/fixtures/vsf/make-fixtures.mjs` — the single deterministic generator, with an
  optional name filter so a plan can land one fixture at a time
- `src/mcp/vice/fixtures/vsf/{wellformed-minor1,wellformed-minor0,malformed-header,short-c64mem}.{vsf,json}`
  — the four fixtures and their provenance sidecars
- `src/mcp/vice/package.json` — `"vsf-slice.ts"` added to `files[]` beside `prg-image.ts`; no
  fixtures entry added
- `src/skills/c64-ram-capture/scripts/vsf-slice.mjs` — the wrapper: verb dispatch, the
  resolution ladder, the named refusal, and the header recording why route (b) was taken
- `src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs` — 10 tests covering both working
  rungs, the total-resolution-failure refusal, message passthrough, and the layout-token absence
- `src/skills/c64-ram-capture/SKILL.md` — a new section documenting both verbs and the
  operational difference that matters, plus a References-table row
- `.planning/phases/33-…/evidence/33-04-slicer-substrate.md` — transcripts, `BROKER_STATE`,
  `TEST_AUTOMATED_BASELINE`, the refusal table, and the `## ACCEPTED LIMIT`

## Decisions Made

1. **Route (b) for the cross-package reach.** `anno-d64.ts`'s header records the constraint as
   measured: the two packages' `files[]` sets do not overlap, so a plain cross-package import
   resolves on neither installer route. Its own answer was a second independent copy — correct
   for a *stable, published* disk format, wrong for this one. The `.vsf` layout is
   version-sensitive (a second magic block moved the first module offset; the body length
   differs between two module minors both in the wild) and this project already carried one
   stale copy of those numbers. So the module gained a CLI entry point and the skill invokes it.
   The reasoning is repeated in the wrapper's own header, where the next reader of that file
   will be, and the absence of every layout token from that file is asserted mechanically.

2. **The purity assertion is scoped by a source marker, not by the file.** The plan requires
   both a module that "performs no filesystem I/O" and a `main()` in the same file that does the
   file I/O the module refuses to do. Rather than let the structural assertion quietly weaken,
   the file carries a `CLI_REGION_BEGIN` marker that must appear exactly once; the test splits
   the raw source on it and scans the region above. A missing or duplicated marker fails loudly
   rather than scanning the whole file (which would fail for a reason that looks unrelated) or
   nothing (which would pass by finding nothing). The property every *importer* gets is the one
   asserted, and a child-process import proves behaviourally that nothing runs on import.

3. **The RAM copy is `new Uint8Array` + `set`, never `bytes.slice()`.** See Deviations.

4. **A committed generator rather than four opaque blobs.** Three of the four fixtures are
   ~64 KB, and everything interesting about them is arithmetic. A blob with no producer gives a
   reader no way to check that the "one below the minimum" fixture really is one below.

5. **`SLICER:` is not emitted by this plan.** See Issues Encountered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Buffer.prototype.slice` returns a view, so the RAM "copy" aliased the snapshot**

- **Found during:** Task 1 (the module's own copy-independence test)
- **Issue:** The research's code example and the first implementation both read
  `const ram = bytes.slice(ramStart, ramStart + RAM_SIZE)`, documented as "`.slice` COPIES".
  That is true for `Uint8Array` but **false for `Buffer`**, which overrides the method as an
  alias for `subarray`. `readFileSync` returns a `Buffer`, so for the input type every real
  caller passes, the returned "image" was a **view into the snapshot**: a caller normalising RAM
  `$0000`/`$0001` (which is exactly what `33-07`'s `normalisePorts()` does with the `dirRead` /
  `dataRead` fields this module returns) would have been writing into the snapshot bytes, and
  the whole ~193 KB snapshot would have stayed alive behind every 64K image.
- **Fix:** `bytes.subarray(...)` into a local, a length re-check that throws if the view is not
  exactly `RAM_SIZE` (so "never `subarray` on an unvalidated length" holds by construction
  rather than by implication from the body-length check), then an explicit
  `new Uint8Array(RAM_SIZE)` + `set`. The measured cause is recorded in a comment at the site.
- **Files modified:** `src/mcp/vice/vsf-slice.ts`
- **Verification:** `sliceC64Mem: the returned image is a COPY -- writing it does not touch the
  snapshot bytes` — written before the fix, observed failing (`14 !== 13`), observed passing
  after.
- **Committed in:** `f8da9e5` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Refusal messages reworded so every one is greppable**

- **Found during:** Task 3 (running the plan's own CLI verify command verbatim)
- **Issue:** The plan's verify greps stderr for lowercase `refus`. Four refusal messages began
  the clause at a sentence boundary ("… file. **R**efusing rather than rescanning"), so the
  declared verification command reported a false negative on a correctly-refusing slicer — the
  same class of error as a guard that passes by finding nothing.
- **Fix:** Every refusal now carries the clause mid-sentence after an em-dash, so all eight
  contain lowercase `refusing` and the whole family is findable from one pattern. The tests
  already matched `/[Rr]efusing …/` and needed no change, which is what let the wording move
  without weakening an assertion.
- **Files modified:** `src/mcp/vice/vsf-slice.ts`
- **Verification:** the plan's verify command run verbatim now prints `CLI_OK`; `grep -c
  "Refusing" vsf-slice.ts` returns 0 against 8 lowercase occurrences.
- **Committed in:** `a6f22ba` (Task 3 commit)

**3. [Rule 2 - Missing Critical] `MODULE_NAME_LEN` split out from `SNAPSHOT_MACHINE_NAME_LEN`**

- **Found during:** Task 2 (writing the in-test module-renaming helper)
- **Issue:** The walk read the module header's 16-byte name field through
  `SNAPSHOT_MACHINE_NAME_LEN`. Both fields are 16 in VICE's source, but they are different
  fields in different structures, and sharing one constant would make a future divergence in
  either look like a bug in the other.
- **Fix:** `MODULE_NAME_LEN` is its own exported constant; `MODULE_HEADER_LEN` is now
  `MODULE_NAME_LEN + 1 + 1 + 4` and `MODULE_SIZE_FIELD_OFFSET` is `MODULE_NAME_LEN + 2`, so both
  are checkable arithmetic rather than the literals 22 and 18.
- **Files modified:** `src/mcp/vice/vsf-slice.ts`, `src/mcp/vice/vsf-slice.test.ts`
- **Verification:** `MODULE_HEADER_LEN is 22 and the size field sits at header offset 18` still
  passes, asserted through the walk (the fixture's MAINCPU size reads 30 only if the u32LE comes
  from offset 18) rather than by re-reading the constant.
- **Committed in:** `a2d3478` (Task 2 commit)

### Added files not in the plan's `files_modified`

**4. [Rule 2 - Missing Critical] `fixtures/vsf/make-fixtures.mjs`**

The plan declares `src/mcp/vice/fixtures/vsf/` as a modified path and requires each sidecar to
"name the generator command". A sidecar naming a command that does not exist would be a
provenance lie, so the generator is committed. It lives under `fixtures/`, is imported by
nothing, is outside `files[]`, and does not match the `*.test.*` collection glob.

**5. [Rule 3 - Blocking] `evidence/33-04-slicer-substrate.md`**

The dispatch required a `SLICER:` outcome line; the frozen schema makes that non-derivable here
(see Issues Encountered). `SCHEMA.md`'s own instruction for a plan that finds a gap in the
pre-commitment is to record it as an `## ACCEPTED LIMIT` in **its own** evidence file, so that
file had to exist. It also banks the `vsf-slice.test.ts` transcript that `33-07` needs, per
evidence convention 7 ("values are transcribed, never remembered … nothing is taken from a plan
SUMMARY's paraphrase").

---

**Total deviations:** 5 auto-fixed (1 bug, 3 missing-critical, 1 blocking)
**Impact on plan:** No scope creep. The bug fix is the plan's own central concern — a slicer that
returns something wrong without erroring — caught one layer in from where the plan pointed. The
wording fix makes the plan's declared verify command work. Both added files exist because a
declared artifact required them.

## Issues Encountered

**`SLICER:` is not derivable by this plan, and was not emitted.** The dispatch's success criteria
required "the `SLICER:` outcome line emitted at column 0 with exactly the name and value domain
`evidence/SCHEMA.md` declares". Reading the frozen schema as instructed shows the line cannot be
produced here:

- `SCHEMA.md` § 2.4 makes `validated` conditional on **both** `node --test vsf-slice.test.ts`
  **and** `node --test capture-predicate.test.ts capture-seam.test.ts` reporting `fail 0`, with
  **both** transcripts appended.
- Neither `capture-predicate.test.ts` nor `capture-seam.test.ts` exists at this commit — they
  are `CAP-02` deliverables produced elsewhere in the phase.
- `SCHEMA.md` § 2 declares the line's single source file as `evidence/33-slicer-validation.md`,
  whose owner in `README.md`'s artifact table is `33-07`, and § 1 states that a gate input
  written into a second file is a name collision rather than a second opinion.

`validated` would therefore have been false, and `failed` would have fired `R1 → no-go` on the
absence of a sibling plan's not-yet-written file — the same class of error as `D-21`'s
arithmetic, which `33-02` had to amend for exactly this reason. Resolution: no line name
invented, no value guessed, no frozen file edited; the gap is recorded as an `## ACCEPTED LIMIT`
in `evidence/33-04-slicer-substrate.md` together with this plan's half of the transcript and an
explicit statement of what `33-07` must do. Verified: the three frozen files are still at their
single commit `2a8ef95` with no working-tree modification, and `grep -n "^SLICER:"` finds
nothing in this plan's output.

**Filed to the broken-windows ledger** as an `open` `deviation` entry so it is visible at ship
time rather than only in this document.

**Nothing else.** No authentication gates, no architectural decisions, no blockers.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data path exists in any file this
plan created. (A stub scan matches `C64MEMHACKS` on the substring `HACK` — that is a real VICE
module name the byte-exact matching test exists to distinguish from `C64MEM`, not a code smell.)

Four tests in `vsf-slice.test.mjs` carry `{ skip: !haveFixtures }`, which is **not** a
left-behind skip: it is `d64-parse.test.mjs`'s established portability posture toward a tree the
skill package cannot assume is present, and all four **ran** in this checkout (`skipped 0` in the
committed transcript). The one test that matters most if the MCP tree is absent — the
total-resolution-failure refusal — runs unconditionally.

## Threat Flags

None. Every threat the plan's register assigns `mitigate` to is implemented and observed:

| Threat | Disposition | Where it is observed |
|---|---|---|
| T-33-01 (DoS via unbounded offsets) | mitigate | Bounds-checked before every read; `malformed-header.vsf` observed refusing; the RAM `subarray` length re-checked before the copy |
| T-33-02 (plausible-but-garbage image) | mitigate | Strict walk, no rescan, terminal file-length equality, body `>= 65543`, duplicate `C64MEM` refused — all four asserted |
| T-33-18 (resolution ladder substitution) | mitigate | Every rung named in the refusal; no local re-implementation exists to fall back to |
| T-33-19 (path handling) | mitigate | No exported function takes a path; `hostpath-consumers.test.ts` green (13 tests, fail 0) |
| T-33-06 (fixture/tarball leakage) | mitigate | Sidecars declare `"synthetic": true`; `check-npm-packages.mjs` exit 0, no fixture or test file in either tarball |
| T-33-SC (package installs) | accept | No dependency added to either `package.json` |

## Verification Results

| Check | Result |
|---|---|
| `node --test vsf-slice.test.ts` | 34 tests, **fail 0** |
| `npm run typecheck` | exit 0, no `error TS` |
| The three constants evaluate to 58 / 65543 / 65555 | `CONSTANTS_OK` |
| Four fixtures, each with a `"synthetic": true` sidecar | `FILES_OK` |
| `node scripts/check-npm-packages.mjs` | exit 0 — 80 / 35 files, closure clean, nothing leaked |
| The plan's CLI verify (65536 bytes written; malformed exits non-zero with `refus` on stderr) | `CLI_OK` |
| `node --test 'src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs'` | 10 tests, **fail 0** |
| `node --test hostpath-consumers.test.ts vsf-slice.test.ts` | 47 tests, **fail 0** |
| Structural guards now scanning the new shipped module (spawn-seam, stock-dispatch, comment-phase-pointers, docs-dangling-refs, shipped-modules, docs-linerefs, hostpath-consumers) | 204 tests, **fail 0** |
| Skill and doc guards (skill-consumer-paths, skill-honesty-checks, skill-description-overlap, skill-basic-trigger, docs-dangling-refs, comment-phase-pointers, spawn-seam, shipped-modules, test-gate) | 109 tests, **fail 0** |
| `npm run test:automated` | 3002 tests, **fail 2** — `anno-register.test.ts:385` and `:479` only, identical before and after this plan's commits |
| `node --test 'src/skills/*/scripts/*.test.mjs'` | 124 tests, 115 pass, **fail 0** |
| `resources-sync.test.ts` | not applicable — no `.mts` or `resources/*.mjs` touched; `vsf-slice.ts` is container-side `.ts` by design |
| `tools-manifest.stock.json` | unchanged (`D-20` — the slicer is deliberately not promoted to an MCP tool) |
| The three frozen evidence files | unmodified, still one commit (`2a8ef95`) |

## Self-Check: PASSED

All 14 created files exist on disk; both modified files carry the intended change. All four
commits are reachable: `f8da9e5`, `a2d3478`, `a6f22ba`, `b38efe7`. Every task-level
`<acceptance_criteria>` and every plan-level `<verification>` item was re-run and is recorded in
the table above.

## User Setup Required

None — no external service configuration required. The whole plan is emulator-free and
corpus-free.

## Next Phase Readiness

**Ready for `33-07`.** `sliceC64Mem()`'s `C64MemSlice` record carries `dirRead` and `dataRead`
as the CPU-visible values of `$0000` and `$0001`, which is exactly what `D-24`'s corrected
in-code normalisation needs — from the 3-byte suffix, not the prefix, so the 176-byte error the
superseded rule would have produced is structurally unavailable. `vsf-slice.ts` is in `files[]`,
so it is inside `shippedTsModules()` and therefore inside the `CAP-03` structural census's scope.

**One item `33-07` must not skip:** emit `SLICER:` in `evidence/33-slicer-validation.md` after
appending **both** suites' transcripts there. This plan's transcript in
`evidence/33-04-slicer-substrate.md` is evidence that `vsf-slice.test.ts` was green at commit
`b38efe7` — it is **not** a substitute for re-running it at the point of derivation, and the
accepted limit says so explicitly.

**No blockers.** The pre-existing 2-in-1 red baseline in `anno-register.test.ts` (undeclared
requirement ids `STORE-01`, `STORE-04`, `STORE-06`, `MCP-04`) is out of this phase's scope and
unchanged by this plan.

---
*Phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d*
*Completed: 2026-09-02*
