---
phase: 29-the-mcp-surface
plan: 04
subsystem: mcp-surface
tags: [annotation-store, cross-references, search, disassembly, derived-answers, structural-guards]

# Dependency graph
requires:
  - phase: 28-the-store-core
    provides: "anno-store.ts (listRanges/listLabels/listComments/listXrefs/paintIndexOf), anno-types.ts (parseStoreAddress, assertDataType, assertRangeShape, producesXrefsFor, resolveSplitTargets, splitEntryAddressPairs), anno-index.ts (buildPaintIndex/resolveAt)"
  - phase: 29-the-mcp-surface
    provides: "29-01's anno-tools.ts registration seam and the seven re-pointed registration-time guards; 29-02's measured failing-file baseline; 29-03's SCHEMA_VERSION 3 store"
provides:
  - "src/mcp/vice/anno-derive.ts — the one authoritative place for answers derived from program bytes on every query: crossReferencesTo() over three unioned sources and searchAnnotations() over three independently disableable corpora"
  - "src/mcp/vice/anno-details.ts — composeAddressDetails(), the four-store-read composition with its composed_from disclosure"
  - "A never-cached control with BOTH halves: six behavioural observations of the store file across repeated derived queries, and a directory-wide SQL-write-site census against a NAMED expected set"
  - "Two named bounds on caller-supplied input: ANNO_DERIVE_MAX_IMAGE_BYTES and the call-time ANNO_SEARCH_MAX_CORPUS_BYTES cap, both refusing rather than truncating"
  - "AnnoDeriveArgumentError and AnnoDerivedTargetError, both AnnoStoreError subclasses"
affects: [29-05, 29-06, 29-07, 29-08, 29-10]

actuals:
  tokens: 27383
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Derived-on-every-query with the never-cache rule enforced by a structural control reading the module's own stripped source"
    - "Three-source union collapsed through a Set and returned sorted, so the answer is stable regardless of walk order"
    - "keepLiteralBodies=true stripping for any census whose subject is written as a string literal (SQL, module specifiers)"
    - "An unanswerable component returns {available:false, reason} beside the answerable ones, never instead of them"

key-files:
  created:
    - src/mcp/vice/anno-derive.ts
    - src/mcp/vice/anno-details.ts
    - src/mcp/vice/anno-derive.test.ts
  modified:
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/package.json

key-decisions:
  - "Search matching is byte-exact and CASE SENSITIVE, and the reason is the store's own identity rule: setLabel's doc block records that name comparison is exact byte equality with no case folding, so a case-folding search would report a hit on a label the store considers a DIFFERENT name. r2000_search_disassembly's case-insensitive default is the shape deliberately NOT copied."
  - "The instruction corpus is built with renderLine() per instruction rather than render() over the range: a hit must carry the address it was found at, and render()'s output is one blob with a !cpu 6510 header. Both go through the same renderInstructionLine(), so the matched text is byte-identical to a listing's."
  - "A PARTIAL split table is skipped rather than resolved. SplitTableReinterpretation records that an entry's partner is a function of the row's start AND its length, so a fragment re-pairs every entry and decodes to different 16-bit values -- resolving one would produce legal, plausible, wrong targets."
  - "Split-table entry addresses come from splitEntryAddressPairs() rather than the research example's `range.start + i`. Both compute the same number today; only one of them is the single place that knows an entry's partner."
  - "The SQL-write-site census strips with keepLiteralBodies=true, not the strict mode. SQL in this tree is always a string literal, so strict stripping would blank every statement and the census would find nothing at all. Comments are stripped in both modes, which is the property the plan actually needed."
  - "Two components of the composition have a real cannot-answer state (no typed range covers the address; no program bytes were supplied) and report it by name. Labels and comments stay genuine arrays, because the store can always answer about them -- inventing an unavailable state for them would be decoration."
  - "AnnoDerivedTargetError guards a path decode()'s 16-bit wrap makes unreachable, kept as defence in depth in the same posture disasm-decoder.ts records for its own startAddress bound: a future decoder that stopped wrapping is reported by name rather than silently producing a plausible wrong address."

patterns-established:
  - "Never-cache control with two halves: behavioural (file size, mtime, content hash, row count, revision, snapshot-ring entry count, all unchanged) and structural (stripped-source assertions plus a named-set census), with a planted violation observed reddening three of them"
  - "A named expected set of file-and-declaration pairs instead of a bare count, so a new write site replacing an old one cannot pass"
  - "Non-vacuity control for a census: the same predicate run over a planted synthetic source, proving the scan can still see what it hunts"

requirements-completed: [STORE-06]

coverage:
  - id: D1
    description: "Cross-references are derived from the bytes on every query and unioned across three sources into one ascending, de-duplicated list"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: a stored non-derivable row appears in the same result set as the derived callers"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: an address reached by two sources appears exactly once, and the list is ascending"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: a lo_hi_address table contributes callers and a lo_hi_word table does not"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: an immediate operand contributes NO caller"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: an indirect operand contributes NO caller for the vector it names"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two ranges that exactly touch stay two ranges, and the instruction at the boundary is attributed to the second -- resolveAt() is the single arbiter"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-02: two ranges that exactly touch stay two ranges, and the instruction at the boundary belongs to the second"
        status: pass
    human_judgment: false
  - id: D3
    description: "Search finds a term in a label, a comment and a rendered instruction; each corpus is independently disableable; matching is byte-exact and case-sensitive"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: search finds a term in a label, in a comment and in a rendered instruction"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: each corpus is independently disableable, and disabling one removes ONLY that hit"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: matching is byte-exact and CASE-SENSITIVE, applied identically to all three corpora"
        status: pass
    human_judgment: false
  - id: D4
    description: "A genuine zero over a real corpus and an unsupported corpus are distinguishable in the result body"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: an empty result over a real corpus is a genuine zero, distinguishable from an unavailable corpus"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: a corpus this surface does not have returns {available:false, reason} rather than a plausible zero"
        status: pass
    human_judgment: false
  - id: D5
    description: "max_results is required with no default, 0 is refused by name, and the true total makes truncation detectable; every address argument is validated by parseStoreAddress"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: max_results is REQUIRED with no default, and 0 is refused by name"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: max_results of 1 returns at most one result and reports the TRUE total, so truncation is detectable"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: every address argument goes through parseStoreAddress -- -1 and 0x10000 are refused"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nothing is written on a read path, proven behaviourally and structurally, with a planted violation observed reddening the control"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06 never-cached control: repeated derived queries leave the store byte-identical"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06 never-cached control: the derivation modules' stripped source carries no SQL write verb"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06 never-cached control: the tree's SQL write sites are exactly the named expected set"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06 never-cached control: the census can actually SEE a planted write site"
        status: pass
      - kind: other
        ref: "planted violation: an insert on crossReferencesTo's return path reddened tests 19, 20 and 23; reverted, 24/24 green"
        status: pass
    human_judgment: false
  - id: D7
    description: "Address details compose from four store reads with the composition disclosed in the body, and an address in a gap returns no range without erroring"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: composeAddressDetails discloses that it was composed and names all four sources"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: an address in a gap between ranges returns no range, by name, and does not throw"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06: with no image bytes the cross-reference half is unavailable BY NAME, not an empty list"
        status: pass
      - kind: unit
        ref: "node scripts/check-npm-packages.mjs (83 files, closure clean)"
        status: pass
    human_judgment: false
  - id: D8
    description: "MCP-02 by construction: neither derivation module imports any of the three host-path seam modules"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#MCP-02: the derivation modules import none of the three host-path seam modules"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts (consumer set still exactly five; both new modules named as forbidden before they existed)"
        status: pass
    human_judgment: false

# Metrics
duration: 25 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 04: Derived Cross-References, Search and the Address-Details Composition Summary

**`STORE-06` now answers from the bytes: cross-references union the decoded code, the typed split ADDRESS tables and the stored non-derivable rows into one sorted de-duplicated list, search runs byte-exact over three independently disableable corpora with truncation detectable — and a two-halved control proves a derived query leaves the store byte-for-byte unchanged, with the planted violation observed reddening it.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-29T15:41Z (approx)
- **Completed:** 2026-08-29T16:07Z
- **Tasks:** 3 of 3
- **Files:** 5 (3 created, 2 modified)

*`actuals.tokens` is chars/4 over the five files actually changed (109,532 chars → 27,383). The plan estimated 105,000 at `confidence: low`; the realized figure is roughly a quarter of it. The gap has a nameable cause rather than being noise: the estimate was sized for a plan that touches large existing modules, and this plan's work is almost entirely three NEW files plus a five-line edit to one existing test — `anno-store.ts` (3,424 lines) was read heavily and modified not at all.*

## Accomplishments

- **`src/mcp/vice/anno-derive.ts`** — the one authoritative place for answers derived from program bytes on every query. `crossReferencesTo(handle, image, origin, to)` builds its caller set from three sources and unions them through a `Set`: every range typed `code`, sliced and decoded fresh; every split range for which `producesXrefsFor()` is true, resolved through `resolveSplitTargets()` and attributed through `splitEntryAddressPairs()`; and `listXrefs()`'s stored rows — the only half that lives on disk, and only because those references cannot be recovered from the bytes at all.
- **The operand-role rule is stated where it is applied.** `referencedAddress()` carries the reason for each exclusion in its own doc block: an `immediate` operand IS the value (`lda #$c0` encodes the byte, not a reference to `$00c0`); an `indirect` operand transfers to whatever the *contents* of the vector hold, which this instruction cannot say. Everything else uses `resolvedTarget ?? operand.value`.
- **`searchAnnotations()` over three corpora**, each independently disableable, with `max_results` **required and no default**, the true total returned beside the truncated list, and the matched corpus name on every hit. An unsupported corpus flag comes back as `{available:false, reason}` in `stock-cia.ts`'s register style; an empty result over a real corpus comes back as a genuine zero with the corpus named and its entry count. **The two are separate fields — neither is inferable from the other.**
- **Two named bounds on caller-supplied input (T-29-15).** `ANNO_DERIVE_MAX_IMAGE_BYTES` refuses an image larger than the address space it claims to describe; `ANNO_SEARCH_MAX_CORPUS_BYTES` bounds the bytes decoded for the instruction corpus and is read **at call time** so a test can point a real cap at the real code. Both **refuse by name** rather than truncating: a corpus cut short reports a genuine-looking zero for a term that is really there.
- **`src/mcp/vice/anno-details.ts`** — `composeAddressDetails()` replaces the analog's four MCP round trips with four in-process store reads, carrying the analog's disclosure shape forward: `composed_client_side: true` plus a `composed_from` list that **is** the source array, so the disclosure and the reads cannot drift. The containing range is resolved through `resolveAt()` over `paintIndexOf()` and then looked up **by id** — there is no start/end bracket comparison anywhere in the file.
- **The never-cached control, both halves, covering the evasion routes rather than one of them.** Behaviourally: six observations — `anno_xref` row count, store file size, mtime, a sha256 of its bytes, the revision, and the snapshot ring's entry count — recorded before and after ten derived queries and asserted unchanged, with `putXref`'s own contract quoted in the failure message. Structurally: the derivation modules' comment-stripped source carries no SQL write verb, no filesystem write call, no persistence binding and none of the three host-path seams; then a directory-wide census of every SQL write site across `shippedTsModules()` compared against a **named expected set of fifteen file-and-declaration pairs**, all in `anno-store.ts`.

## Task Commits

1. **Task 1 (RED): failing tests for derived cross-references and search** — `6f24352` (test)
2. **Task 1 (GREEN): derive cross-references and search from the program bytes** — `119c689` (feat)
3. **Task 2: prove a derived query leaves the store byte-identical** — `e6807ec` (test)
4. **Task 3: compose address details from four store reads** — `98228f1` (feat)
5. **Deviation (Rule 3): declare `anno-derive.test.ts` in the test-tree SQLite guard** — `7c5a136` (fix)

## Files Created/Modified

- `src/mcp/vice/anno-derive.ts` (new, 590 lines) — the three-part header (what it is authoritative for; why a cached derivation is a second on-disk truth, citing all three independent statements of the rule; what not to do), the matching-rule decision, two named error classes, the two bounds, and the two exported derivations.
- `src/mcp/vice/anno-details.ts` (new, 169 lines) — the four-read composition, `ComposedComponent<T>`, and the `ADDRESS_DETAIL_SOURCES` array that doubles as the `composed_from` disclosure.
- `src/mcp/vice/anno-derive.test.ts` (new, 646 lines) — a real 34-byte `.prg` fixture decoded by the real decoders, 29 tests across five sections.
- `src/mcp/vice/anno-seam.test.ts` — `TEST_FILES_NAMING_SQLITE` extended to two declared members with the reason recorded; the hardcoded `namers.length, 1` derived from the list with an explicit `> 0` floor.
- `src/mcp/vice/package.json` — `anno-derive.ts` and `anno-details.ts` added to `files[]`.

## Decisions Made

- **Case-SENSITIVE, byte-exact matching, and it is not a default that fell out of `String.prototype.includes`.** `anno-store.ts`'s `setLabel` doc block records that the store's own name comparison is exact byte equality on a binary-collation text column — "No case folding, no Unicode normalisation, no trimming". A case-folding search would report a hit on a label the store itself considers a *different name*, putting the search and the store into disagreement about identity. `r2000_search_disassembly`'s case-insensitive default is named in this module's header as the shape deliberately not copied.
- **A partial split table is skipped, not resolved.** `SplitTableReinterpretation`'s own reasoning applies unchanged: an entry's partner is a function of the row's start *and* its length, so a fragment re-pairs every entry and decodes to different 16-bit values. Resolving a fragment would emit legal, plausible, wrong targets — with nothing downstream able to tell.
- **`splitEntryAddressPairs()` rather than `range.start + i`.** `29-RESEARCH.md`'s worked example computes the entry address inline. Both produce the same number today; only one of them goes through the module that is documented as "THE ONE PLACE IN THIS REPO WHERE AN ENTRY'S PARTNER IS COMPUTED", and the plan's own prohibition on a second arithmetic copy is the reason.
- **`renderLine()` per instruction, not `render()` per range.** The plan's action named `render()`. A search hit has to carry the address it was found at, and `render()` returns one blob prefixed by `!cpu 6510` and a symbol block — the addresses are gone. `renderLine()` is `render()`'s own per-instruction primitive and both go through the same `renderInstructionLine()`, so the text a search matches is byte-identical to the text a listing shows. Recorded as an implementation choice, not a behaviour change.
- **The census strips with `keepLiteralBodies = true`.** The plan's Task 2 action required stripping before matching so this module's own header prose could not invalidate the check. That is satisfied in *both* stripper modes (comments are always stripped). But SQL in this tree is only ever written as a string literal, so the strict mode would blank every statement in `anno-store.ts` and the census would find nothing at all — a guard that scans nothing finds nothing. The literal-keeping mode is therefore mandatory in the other direction too, and both reasons are recorded at the helper.
- **`AnnoDerivedTargetError` guards an unreachable path deliberately.** `disasm-decoder.ts`'s rule 2 masks every address with `& 0xffff`, so no `Instruction` this module can receive carries an out-of-space target. The guard is kept in the same posture that module records for its own `startAddress` bound: a future decoder change that stopped wrapping is reported *by name* rather than silently producing a plausible wrong address. This discharges the plan's `backstop`-verified truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] An eighth guard: `anno-seam.test.ts`'s test-tree SQLite declared list**

- **Found during:** post-Task-2 verification of the adjacent anno suites
- **Issue:** `anno-derive.test.ts`'s never-cache structural control asserts that the derivation modules name no persistence binding — which requires spelling `node:sqlite` as a string literal. The test-tree scan runs with `keepLiteralBodies = true` (it must: the thing it hunts *is* a literal), so it cannot tell that literal apart from a real import, and it correctly named the new file as an undeclared member.
- **Fix:** `anno-derive.test.ts` added to `TEST_FILES_NAMING_SQLITE` with the reason recorded at the array — the same DIVERGENCE 2 trade the file's own header already documents, seen from the other side a second time. Neither member imports the builtin. `assert.equal(namers.length, 1)` was derived from the declared list's own length, with an explicit `> 0` floor keeping the broken-scan tooth the literal `1` used to provide.
- **Files modified:** `src/mcp/vice/anno-seam.test.ts`
- **Verification:** Observed red before the declaration (the guard named `anno-derive.test.ts` by name), green after — a re-pointing, not a widening. `node --test anno-seam.test.ts` — 23/23.
- **Committed in:** `7c5a136`

**2. [Measured correction, not a code change] The registration-time guard count is now eight**

- **Found during:** the fix above
- **Issue:** 29-01's summary carried forward "the registration-time guard set is seven, not five". Adding a *test* file that must name a forbidden specifier is an eighth guard interaction, and it is not a registration-time one — it fires on the test tree, which the shipped-set scans cannot see.
- **Fix:** None in code. Recorded here so a later plan in this phase (29-05 through 29-08 each add `anno-*` verbs and tests) knows that a test asserting the *absence* of `node:sqlite` must declare itself in `TEST_FILES_NAMING_SQLITE`.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocker) plus 1 recorded fact for later plans.
**Impact on plan:** No scope creep. The Rule 3 fix is a guard this plan's own work necessarily trips, re-pointed with its teeth intact and its planted violation observed.

## Issues Encountered

- **The full-glob suite was deliberately not run.** Per `29-BASELINE.md` it does not terminate on this host (it blocks forever in `vice-proxy.test.ts`, a `MANUAL_ONLY_TESTS` member needing a live emulator). Instead, every test that reads a changed identifier or scans `package.json`'s `files[]` was run: `anno-derive`, `anno-index`, `anno-store`, `anno-durability`, `anno-seam`, `anno-types`, `anno-tools`, `anno-confinement`, `anno-overlap`, `shipped-modules`, `hostpath-consumers`, `module-classification`, `docs-dangling-refs`, `stock-dispatch`, `block-class`, `comment-phase-pointers`, `r2000-spawn-seam`, `docs-linerefs`, `capability-registry`, `disasm-decoder`, `disasm-renderer`, `prg-image` — 636 tests, 0 failures, 1 pre-existing skip.
- **Baseline comparison:** the recorded failing-file **SET** is `{vice-proxy.test.ts, r2000-session.test.ts, audit-integrity.test.ts}`. This plan touches nothing any of the three reads, and every file it does touch is green. **No file entered the set and none left it.**
- **No VICE broker was running**, so the `BACK-05` deterministic reddening did not apply to any result above.

## Verification Results

| Check | Result |
|---|---|
| `node --test anno-derive.test.ts` | 29 tests, 29 pass |
| `node --test` over the plan's five named files | 252 tests, 252 pass (after the Rule 3 fix) |
| `node --test` over all 22 adjacent suites | 636 tests, 635 pass, 1 pre-existing skip, 0 fail |
| `npm run typecheck` | clean |
| `node scripts/check-npm-packages.mjs` | exit 0 — 83 files, closure clean |
| `node scripts/check-no-regenerator2000.mjs` | exit 0 |
| `node scripts/audit-gate.mjs` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| Planted violation (an `insert` on `crossReferencesTo`'s return path) | reddened tests 19, 20 and 23; reverted, 24/24 green |
| Store byte-identical across repeated derived queries | six observations unchanged |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for the next wave. Both derived modules the surface needs exist, are in `files[]`, and are covered by the never-cache control.

Three facts later plans should carry forward:

- **The derivation modules are held to a shared structural rule.** `DERIVATION_MODULES` in `anno-derive.test.ts` is the list; a third module on a read path should join it rather than grow its own copy of the three assertions.
- **A test that asserts the ABSENCE of `node:sqlite` must declare itself** in `anno-seam.test.ts`'s `TEST_FILES_NAMING_SQLITE`. That array is now two members and is meant to be edited deliberately.
- **`EXPECTED_SQL_WRITE_SITES` is a named fifteen-entry set.** A plan that adds a legitimate write entry point to `anno-store.ts` must add its declaration name there in the same commit; a plan that adds one anywhere else has broken the rule the set exists to enforce.

No blockers. No stubs. No new threat surface beyond the two the plan's own register names, and T-29-14 through T-29-17 are all mitigated as specified — the `image` argument never becomes a path in these modules (they take bytes, never a filesystem path, so `parsePrg`/`storePathWithinWorkspace` containment stays at the caller boundary where 29-01 put it).

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

- `src/mcp/vice/anno-derive.ts` — FOUND
- `src/mcp/vice/anno-details.ts` — FOUND
- `src/mcp/vice/anno-derive.test.ts` — FOUND
- `.planning/phases/29-the-mcp-surface/29-04-SUMMARY.md` — FOUND
- Commits `6f24352`, `119c689`, `e6807ec`, `98228f1`, `7c5a136` — all present in `git log --all`
