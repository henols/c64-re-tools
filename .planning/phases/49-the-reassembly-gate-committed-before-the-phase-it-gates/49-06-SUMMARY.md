---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
plan: 06
subsystem: testing
tags: [acme, spawn-seam, byte-diff, structural-guard, tdd]

requires:
  - phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
    provides: "acme-verify.ts's single-call-site byte-diff oracle and shared verdict body (plan 02); the three planted red controls (plan 03); the movement transform and real relocated rebuild (plan 04); the hazard acknowledgement matcher and no-silent-green proof (plan 05)"
provides:
  - "acme-seam.test.ts: a whole-server-tree walk plus two frozen, both-directions set equalities -- ACME_SPAWN_SITES (every module that launches the assembler) and EXPECTED_BYTES_COMPARISON_SITES (every module that derives a verdict by comparing produced bytes to expected bytes)"
  - "functionsReturningOutcomeToken() and the oracle's own single-call-site check, proving acme-verify.ts contains exactly one launch and exactly one outcome-producing verdict body"
affects: [reassembly-gate-run]

actuals:
  tokens: 7770
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A frozen declared set built by RED-then-GREEN: declare the set empty first, let the set-equality test fail against the real tree (the failure message names exactly what belongs), then fill the set in from that failure's own output rather than from an assumption"
    - "A parameter-scan anchored to a genuine parameter list (a parenthesised group followed by `=>` or `{`) rather than any parenthesised text mentioning the identifier -- an unanchored version collides with an ordinary call's own argument list when a coincidence puts the same tokens in both"
    - "A byte-comparison scan flagged only when BOTH operands are present in the same call's arguments -- an expected-bytes field AND a locally-bound readFileSync() result -- so a module that legitimately builds or asserts on expectedBytes without ever comparing an assembled artifact to it is never flagged"
    - "A declared member the scan structurally cannot find (a resolved generic tool path, not an assembler-named identifier) is excluded BY NAME from the found-direction of the equality check, not silently omitted"

key-files:
  created:
    - src/mcp/vice/acme-seam.test.ts
  modified: []

key-decisions:
  - "The module walk is NOT files[]-derived (unlike shippedTsModules()): the assembler oracle and every one of its test-only companions are deliberately absent from the published package, so scoping to files[] would make the guard blind to the very modules it exists to watch. It instead recurses from this file's own directory, skipping node_modules, resources and fixtures by name, each with its reason stated in the skip-list itself."
  - "identNamesAssembler()'s parameter-scan is anchored to a genuine parameter list (parenthesised group followed by `=>` or `{`), not any parenthesised text containing the identifier anywhere in the file -- discovered necessary when the unanchored form (mirrored verbatim from spawn-seam.test.ts) produced a real false positive: skill-acme-build-cli.test.ts spawns `process.execPath` and, elsewhere in the same file, asserts `ACME_BIN` against `process.env.ACME_BIN` inside an ordinary call whose argument list happens to contain both `process` and `ACME_BIN`."
  - "The expected-bytes comparison scan's flagged shape requires a call (assert.deepEqual/deepStrictEqual/Buffer.compare/compareBytes) whose OWN argument text mentions both `expectedBytes` and an identifier this same module bound from readFileSync(...) -- never a same-file or same-neighborhood heuristic, which would have false-flagged the exporter's own expectedBytes-to-expectedBytes assertions sitting a few lines away from a real comparison."
  - "compareBytes( is included in the comparison-call pattern alongside assert.deepEqual/deepStrictEqual/Buffer.compare specifically so the oracle's own call site (compareBytes(Buffer.from(expectedBytes), actual)) is discoverable by the same scan that finds the two pre-existing test-file members, rather than being a third, undiscoverable, hand-declared-only member."
  - "Both frozen sets were built RED-then-GREEN: each was declared empty first, the set-equality test's own failure message named the real members, and the reasoned entries were then filled in from that measurement -- never from an assumed list."

requirements-completed: [BUILD-06]

coverage:
  - id: D1
    description: "ACME_SPAWN_SITES freezes the set of modules that launch the assembler, in both directions, with a one-line reason per member and the host-tool.mts generic-tool-path member declared by hand"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: every module the scan flags appears in the frozen declared set"
        status: pass
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: every module in the frozen declared set that the scan is capable of finding is actually found by it"
        status: pass
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: a synthetic module source containing a raw assembler launch is flagged"
        status: pass
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: a synthetic module source containing a launch of an unrelated binary is not flagged"
        status: pass
    human_judgment: false
  - id: D2
    description: "The assembler oracle (acme-verify.ts) contains exactly one child-launch call site and exactly one function body that returns an outcome token"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: the assembler oracle contains exactly one launch call site and exactly one function body returning an outcome token"
        status: pass
    human_judgment: false
  - id: D3
    description: "EXPECTED_BYTES_COMPARISON_SITES freezes the set of modules that derive a verdict by comparing an assembler-produced artifact's bytes against an export's expected bytes, in both directions, with the two pre-existing test-file members recorded as an accepted limit"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: every flagged module appears in the frozen comparison set, and every member of that set is flagged"
        status: pass
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: a module that merely constructs or asserts on an export's expected bytes without comparing an assembled artifact to them is not flagged"
        status: pass
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: a synthetic source performing a produced-versus-expected comparison is flagged; one performing an unrelated deep comparison is not"
        status: pass
    human_judgment: false
  - id: D4
    description: "No module belonging to this phase's own gate (reassembly-gate*) appears in either frozen set or either scan's live result, asserted as its own named case"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: no module whose name identifies it as part of this phase's gate appears in the scan's result or in the frozen spawn-site set"
        status: pass
      - kind: unit
        ref: "acme-seam.test.ts#acme seam: no gate module is flagged as an expected-bytes comparison site, and adding one to the frozen set is not how the assertion is satisfied"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 06: The ACME seam guard -- two frozen spawn/comparison sets Summary

**A whole-server-tree scan freezes, in both directions, every module that launches the assembler and every module that derives a pass/fail from a produced-versus-expected byte comparison, so a second unaudited spawn site or a second unaudited verdict path can no longer appear silently under the reassembly gate.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- `serverTreeModules()` walks every `.ts`/`.mts` file under `src/mcp/vice/` (281 real modules), skipping `node_modules`, `resources` and `fixtures` by name with a stated reason each, and asserting a lower bound so a broken walk fails loudly rather than passing on an empty set.
- `scanAcmeSpawnSites()` mirrors `spawn-seam.test.ts`'s own call-shape regular expressions (argv-array form and the deliberately looser shell-string form), reusing `shipped-modules.ts`'s `codeOnly()` comment-and-literal stripper rather than a second implementation. `ACME_SPAWN_SITES` freezes eight declared members: the availability probe, the byte-diff oracle, five test modules that assemble a fixture or round-trip subject directly, and the typed host-tool build branch -- declared by hand because its launch passes a resolved generic tool path a name-based scan structurally cannot see. The set-equality assertion fails in both directions.
- `functionsReturningOutcomeToken()` plus the reused spawn scan prove the oracle (`acme-verify.ts`) contains exactly one child-launch call site and exactly one function body (`assembleAndDiff()`) that assigns a literal value to an `outcome` field.
- `scanExpectedBytesComparisonSites()` flags a module only when the SAME call's arguments mention both an `expectedBytes` field and a locally-bound `readFileSync(...)` result -- narrower than "mentions expectedBytes at all," which would have swept in the exporter's own legitimate expectedBytes-to-expectedBytes assertions. `EXPECTED_BYTES_COMPARISON_SITES` freezes three members: the exporter's own pre-existing round-trip test, the purpose-built subject's own reassembly test (both recorded as an accepted limit -- they predate the oracle's tree support and are not a licence for a new comparison path), and the oracle itself.
- A dedicated case asserts no `reassembly-gate*` module is ever a member of, or discovered by, either scan.
- 14 `acme seam:` cases total; both frozen sets were built RED-then-GREEN (declared empty, the set-equality test's own failure named the real members, then filled in from that measurement).

## Task Commits

Each task was committed atomically (both `tdd="true"`, RED then GREEN):

1. **Task 1: Scan the server tree for assembler launch sites and freeze the set in both directions** - `b8709992` (test, RED) then `f54ffe36` (feat, GREEN)
2. **Task 2: Freeze the set of modules that derive a verdict by comparing produced bytes to expected bytes** - `6db69cc7` (test, RED) then `73d4838a` (feat, GREEN)

**Plan metadata:** _(this commit)_ `docs(49-06): complete the ACME seam guard plan`

## Files Created/Modified

- `src/mcp/vice/acme-seam.test.ts` - the guard: `serverTreeModules()`, `scanAcmeSpawnSites()`/`ACME_SPAWN_SITES`, `functionsReturningOutcomeToken()`, `scanExpectedBytesComparisonSites()`/`EXPECTED_BYTES_COMPARISON_SITES`, 14 `acme seam:` test cases

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential one found during execution (not anticipated by the plan text): `identNamesAssembler()`'s parameter-scan, mirrored verbatim from `spawn-seam.test.ts`'s own unanchored `(...)`-containing-the-identifier pattern, produced a genuine false positive against the real tree -- `skill-acme-build-cli.test.ts` spawns `process.execPath` and, in an unrelated assertion elsewhere in the same file, checks `ACME_BIN` against `process.env.ACME_BIN`, and the unanchored regex misread that assertion's own call-argument list as a parameter declaration naming `process` after the assembler. The fix anchors the parameter-scan to a genuine parameter list (a parenthesised group immediately followed by `=>` or `{`), which a plain call's argument list never is.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The parameter-scan mirrored from spawn-seam.test.ts produced a real false positive against this tree**
- **Found during:** Task 1, first full-tree run
- **Issue:** `identNamesAssembler()`'s parameter-resolution fallback used the same unanchored `\(([^)]*\bIDENT\b[^)]*)\)` pattern `spawn-seam.test.ts`'s `identNamesEmulatorBinary()` uses. Applied to this tree, it matched `skill-acme-build-cli.test.ts`'s own `assert.equal(ACME_BIN, process.env.ACME_BIN ?? "acme")` call -- an ordinary call, not a parameter declaration -- because that call's argument list happens to contain both `process` (the identifier being resolved, from an unrelated `spawnSync(process.execPath, ...)` call elsewhere in the file) and `ACME_BIN`.
- **Fix:** Anchored the parameter-scan regex to require the parenthesised group be immediately followed by an arrow (`=>`) or an opening brace (`{`), with an optional return-type annotation in between -- the shape a genuine parameter list has and an ordinary call's argument list does not.
- **Files modified:** `src/mcp/vice/acme-seam.test.ts` (this plan's own new file; no other file touched)
- **Verification:** `node --test acme-seam.test.ts` -- 14/14 pass, `skill-acme-build-cli.test.ts` no longer discovered as a spawn site
- **Committed in:** `f54ffe36` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- a bug in this plan's own new guard, found and fixed before the GREEN commit). **Impact:** necessary for the plan's own acceptance criteria (the set-equality assertion) to hold against the real tree; no scope creep, and no file outside this plan's own new file was touched.

## Known Stubs

None introduced by this plan.

## Issues Encountered

None beyond the one auto-fixed deviation above, resolved within this plan's own scope before the GREEN commit.

**Pre-existing test-suite baseline, unaffected.** A full `npm run test:automated` run before and after this plan's changes shows the same 4390 tests / 4375 pass / 6 fail, all six failures attributable to the four documented pre-existing files (`anno-import.test.ts`, `anno-register.test.ts`, `audit-integrity.test.ts`, `docs-deferred-ledger.test.ts` -- `audit-integrity.test.ts` re-runs `docs-deferred-ledger.test.ts`'s tests as an import side effect, which is why six failure lines come from four files). No new failing file was introduced. `spawn-seam.test.ts` (10/10), `anno-export-asm.test.ts`, `hazard-subject-reassembly.test.ts` and `acme-verify.test.ts` (264/264 combined) all pass unchanged; `git diff` confirms none of the eight declared spawn-site or three declared comparison-site member files were modified by this plan.

## User Setup Required

None - no external service configuration required. ACME was already detected on `PATH` (`/home/henrik/.local/bin/acme`, release 0.97 "Zem") and no new external tool is introduced.

## Next Phase Readiness

- Both structural disciplines this phase depends on -- a frozen, reasoned assembler-launch set and a frozen, reasoned byte-comparison set, each excluding this phase's own gate modules by name -- are now checked properties rather than review-only conventions. `evidence/49-guards.md` (plan 49-07) can cite `acme-seam.test.ts`'s own set-equality test names directly for `SECOND_PATH_GUARD: held`.
- `BUILD-06` is shared across all seven plans in this phase (01-07) and is not yet marked complete in `REQUIREMENTS.md` -- the shared-ID gate correctly withholds it until every plan declaring it has its own SUMMARY.md.
- No blockers.

---
*Phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates*
*Completed: 2026-09-13*

## Self-Check: PASSED

`src/mcp/vice/acme-seam.test.ts` confirmed present on disk. All four commit hashes (`b8709992`, `f54ffe36`, `6db69cc7`, `73d4838a`) confirmed present in `git log`. Every task's `<acceptance_criteria>` re-verified passing: the module walk skips the three named directories with a lower-bound assertion; both frozen sets were derived by running the scan (RED) before being filled in (GREEN); the host-tool.mts generic-tool-path member is excluded by name from the found-direction; both synthetic fire/decline pairs pass; no gate module appears in either scan or set; the oracle's exactly-one-launch/exactly-one-outcome-body assertion passes; `spawn-seam.test.ts` (10/10) and the three declared comparison-site member files (264/264 combined) pass unchanged; `npm run typecheck` is clean.
