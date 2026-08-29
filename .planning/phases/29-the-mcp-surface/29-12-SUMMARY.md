---
phase: 29-the-mcp-surface
plan: 12
subsystem: infra
tags: [annotation-store, sqlite, markdown-render, removal-gate, confinement, digest]

# Dependency graph
requires:
  - phase: 29-05
    provides: "the renamed capability modules (`anno-memmap-render.ts`) and the gate's row-11 permanent exemption pinned at 1, line 79"
  - phase: 29-07
    provides: "the two-verb CLI, `storePathWithinWorkspace()` already wired into `coverage`, and `block-class.test.ts`'s proof that `blockClassAt()` is total over the frozen twelve `DATA_TYPES`"
  - phase: 29-09
    provides: "the `r2000` -> `anno` subcommand rename the generated banner had not caught up with"
provides:
  - "A `render-memmap` verb that renders from a Phase 28 annotation store with no regenerator2000 child anywhere on its path (D-17)"
  - "`renderMemoryMap()`/`checkRenderedMemoryMap()` taking `{ storePath, provenancePath, workspaceRoot }`, opening ONE store handle per render with `mustExist` and closing it in a `finally`"
  - "Block kind interpreted in exactly one place: `blockClassAt()`. The renderer's second spelling of the store's block vocabulary is gone"
  - "`RENDERER_VERSION = \"3\"`, bumped in the same commit that changed the digest's canonical input"
  - "Three previously-gated render tests converted to ungated store-backed tests -- 0 skipped in the file's render half"
  - "The last importer of the retired runner outside plan 29-10's own deletion set is gone, so 29-10 deletes `anno-tools.ts` rather than discovering it load-bearing"
affects: [29-10, 29-11]

actuals:
  tokens: 16800
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A renderer reads its substrate directly through the store's own readers on ONE handle, opened with an explicit `workspaceRoot` plus `mustExist` and closed in a `finally`"
    - "A digest's version constant moves in the SAME commit as its canonical input, so two incompatible renderings cannot compare as ordinary drift"
    - "A gated test whose subject is removed is RE-POINTED at the replacement substrate, never deleted -- removing a dependency and deleting coverage are different acts"
    - "A count an exemption pins is re-measured with `grep -ac` and re-pinned in the same commit that moves it"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-memmap-render.ts
    - src/mcp/vice/anno-memmap-render.test.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - scripts/check-no-regenerator2000.mjs

key-decisions:
  - "The renderer's three `r2000_get_*` queries became `listRanges()`/`listLabels()`/`listComments()` on one handle, with the line-comment filter moved to the read boundary through `COMMENT_TYPES` rather than a re-typed `\"line\"` literal."
  - "The block kind goes through `blockClassAt()` and nowhere else; the Range/Contents column prints the store's own `dataType` spelling verbatim."
  - "`RenderMemoryMapOptions`/`CheckRenderedMemoryMapOptions` gained a REQUIRED `workspaceRoot` beyond the planned `projectPath` -> `storePath` rename, because T-29-52's mitigation (explicit root plus `mustExist`) cannot be expressed without it and `openStore()`'s default behaviour is to CREATE the file."
  - "The CLI's `render-memmap` positional is documented and refused as a `<store>`: it goes through `storePathWithinWorkspace()` against `repoRoot()` -- the same seam `coverage` uses -- and an absent store is refused by name rather than created."
  - "The `:79` measurement-provenance mention was KEPT and re-anchored rather than discharged. Its new subject is live: it is the record of what the version-2 digest hashed, carrying the three wire spellings inline now that the three `interface` declarations it used to sit above are gone. The escape hatch (delete the comment, re-pin row 11 temporary/0, correct 29-10) was NOT taken and no artifact needed changing."
  - "The three gated render tests were converted, not deleted. 29-10's recorded fate for this file (\"retains its provenance-sidecar and cell-escaping unit tests\", removes the gated half) was written when the gated half had no substrate to move to; it does now."
  - "The allow-list entry for `anno-memmap-render.test.ts` was re-pinned 4 -> 2 AND re-cited from 29-12 to 29-10, the plan that now ENDS it (29-10 carries both the gate and this file in its own `files_modified`, so the reachability rule holds)."

patterns-established:
  - "Line-pinned exemptions constrain edits above them: every edit above `anno-memmap-render.ts:79` in this plan was made line-count-neutral so the gate's `lines` pin and `removal-gate.test.ts`'s `deepEqual(hits, [79])` both stayed true without being rewritten."
  - "A test that asserts something about the removal gate's subject imports nothing and spells nothing -- it asserts the SUBJECT'S liveness (the paragraph still states the three wire shapes, the declarations really are gone) so it adds no occurrence to the count it is protecting."

requirements-completed: [CUT-01]

coverage:
  - id: D1
    description: "`render-memmap` renders a memory map from an annotation store with no regenerator2000 child on any path it reaches (D-17)"
    requirement: CUT-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts (47 tests, render-memmap argument contract + WR-09 write guard against a REAL store)"
        status: pass
      - kind: other
        ref: "grep -a 'from \"./' over anno-memmap-render.ts and each of its four local imports: no anno-tools/anno-launch/anno-session/anno-mcp-client (or their r2000-* predecessors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Block kind is interpreted in exactly one place (`blockClassAt()`); the renderer holds no second spelling of the store's block vocabulary"
    requirement: CUT-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts (the class for each of the frozen twelve DATA_TYPES, by name)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#renders a golden memory map ... (Routines table marks exactly the labels inside a code range; Contents cell carries the store's own lowercase spelling)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`RENDERER_VERSION` is \"3\", bumped in the same commit that changed the digest's canonical input, and the digest covers the store as well as the sidecar"
    requirement: CUT-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#RENDERER_VERSION is bumped to \"3\" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#changing a LABEL / a COMMENT / a RANGE in the store changes the render digest (three tests), plus the sidecar-bytes and stability tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three previously-gated render tests run ungated against a real store and assert what they asserted before"
    requirement: CUT-01
    verification:
      - kind: unit
        ref: "node --test anno-memmap-render.test.ts -> 24 tests, 24 pass, 0 skipped"
        status: pass
      - kind: other
        ref: "grep -a 'gated:' anno-memmap-render.test.ts | grep -v 'availability gate' | wc -l -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every regenerator2000 count this plan moved is re-pinned in the same commit, and the removal gate is green at this wave"
    requirement: CUT-01
    verification:
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs -> exit 0 (module at 1/line 79, test file re-pinned 4 -> 2 and re-cited to 29-10)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#binary safety: the one occurrence in the NUL-carrying memmap renderer is reported, in-process (deepEqual hits, [79])"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts DIRECTION 9/9b line-citation containment (anno-cli.ts:63, anno-cli.ts:169, anno-memmap-render.test.ts:21 all held)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rendered memory map is legible and correct against a hand-built store end to end (the tracer's human-check)"
    verification:
      - kind: manual_procedural
        ref: "built a store with a code range, a lo_hi_address range, two labels, two line comments and one side comment; ran `vice-mcp anno render-memmap` and read the output"
        status: pass
    human_judgment: true
    rationale: "\"The Range/Contents rows carry the store's own data-type spellings, and the symbol table's 'confirmed by' column still marks exactly the symbols that fall inside a code range\" is a legibility judgment about generated prose; the golden test pins the bytes, but not that a reader can check them by hand."

# Metrics
duration: 19 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 12: Rebuild `render-memmap` onto the Phase 28 store Summary

**The memory-map renderer now reads `listRanges`/`listLabels`/`listComments` on one confined store handle instead of driving a regenerator2000 child through three `r2000_get_*` queries, with block kind routed through `blockClassAt()`, `RENDERER_VERSION` bumped "2" -> "3" alongside the digest's changed input, and the three previously-gated render tests converted to ungated store-backed tests rather than deleted.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-29T18:50:26Z
- **Completed:** 2026-08-29T19:09:22Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **D-17 discharged.** `renderMemoryMap()`'s three queries at the old `:353-355` are three store reads on a single handle opened once per render with an explicit `workspaceRoot` plus `mustExist` and closed in a `finally`. `queryR2000Json()` and the `runR2000Tool` import are gone; `checkRenderedMemoryMap()` reaches the same reads, so BOTH CLI entry points are clean. Neither the module nor any of its four local imports (`anno-store.ts`, `anno-types.ts`, `anno-confidence.ts`, `block-class.ts`) reaches `anno-tools.ts`, `anno-launch.ts`, `anno-session.ts` or `anno-mcp-client.ts`. **Plan 29-10 can now delete `anno-tools.ts` rather than discovering it is still load-bearing.**
- **One spelling of the block vocabulary.** The renderer's `b.type === "Code"` test — a second interpretation of exactly what `block-class.ts` says is "interpreted HERE and nowhere else" — is replaced by `blockClassAt()`, whose totality over the frozen twelve `DATA_TYPES` 29-07 established by test. The Range/Contents column prints the store's own `dataType` verbatim (`code`, `lo_hi_address`, …).
- **The digest's version moved with its input.** `computeRenderDigest()` canonicalises `RangeRow`/`LabelRow`/`CommentRow`; `RENDERER_VERSION` is `"3"`, pinned by a test naming the store re-point. `R2000Block`, `R2000Symbol` and `R2000Comment` are deleted — nothing in the build would have flagged them (`tsconfig.json` sets no `noUnusedLocals`), which is why their fate was stated rather than left to be discovered.
- **The gated half was converted, not deleted.** The golden render, the `[unknown]`-grade case and the pipe-plus-newline cell-escaping case each build their input by writing ranges, labels and comments into a real store through `withRenderFixture()`, then drop their skip condition. The file reports **24 tests, 24 pass, 0 skipped** (it previously reported 3 skipped). The golden expectation now encodes store rows a reader can check by hand instead of what a disassembler would have produced.
- **The `[unknown]` test finally makes the assertion its own name always made.** Its title has claimed since Phase 11 that "a malformed store comment throws rather than rendering silently"; its body never asserted it. A near-miss bracket token (`[confirmed_code]`) written straight into the store now makes `renderMemoryMap()` reject.
- **Every moved count was re-pinned in the same commit.** The module stayed at exactly 1 occurrence on exactly line 79; the test file went 4 -> 2 (measured with `grep -ac`) and its allow-list entry was re-cited from 29-12 to 29-10, the plan that now ends it. `node scripts/check-no-regenerator2000.mjs` and `node scripts/audit-gate.mjs` both exit 0.

## Task Commits

1. **Task 1 (tracer): read the memory map from the store, not from a child** — `1221202` (refactor)
2. **Task 2 (tdd RED): pin `RENDERER_VERSION` "3" and the digest's store coverage** — `5f94d38` (test)
3. **Task 2 (tdd GREEN): bump `RENDERER_VERSION` to "3" and retire the three wire shapes** — `4447e17` (feat)
4. **Task 3: convert the three gated render tests onto a real store** — `14a2b19` (test)

No REFACTOR commit: the GREEN edit left nothing to clean up.

## Files Created/Modified

- `src/mcp/vice/anno-memmap-render.ts` — three store reads on one handle; `blockClassAt()`; `storePath`/`workspaceRoot` options; `RENDERER_VERSION` `"3"`; the three wire interfaces deleted; the `:79` provenance paragraph re-anchored and made self-contained.
- `src/mcp/vice/anno-memmap-render.test.ts` — `withRenderFixture()` store builder; five digest tests; a provenance-liveness test that names no subject; the three gated render tests converted and unskipped.
- `src/mcp/vice/anno-cli.ts` — `render-memmap` positional documented and refused as a `<store>`, confined through `storePathWithinWorkspace()` against `repoRoot()`, absent store refused rather than created, both calls pass `{ storePath, workspaceRoot }`.
- `src/mcp/vice/anno-cli.test.ts` — the render-memmap refusal tests moved inside the workspace (a tmpdir path is now refused BY DESIGN), a new confinement-escape test, and the WR-09 write guard rebuilt over a REAL store so it still observes the write failure.
- `scripts/check-no-regenerator2000.mjs` — the temporary allow-list entry for `anno-memmap-render.test.ts` re-pinned 4 -> 2 and re-cited to 29-10.

## Decisions Made

See `key-decisions` in the frontmatter. The one worth restating here is the **escape hatch that was not taken**: Task 2 offered a four-artifact stop-and-report if the `:79` comment's new subject could not be stated truthfully. It can be. With the three `interface` declarations deleted, that paragraph is the last record anywhere of what the version-2 digest hashed, and carrying the spellings inline makes the `"2"` -> `"3"` bump a statement about two KNOWN input shapes rather than one known and one assumed. 29-05 row 11 stays PERMANENT at 1, and plan 29-10's acceptance criterion for this module is untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 re-typed `computeRenderDigest()` a task early, because the planned sequencing is not typecheck-green**

- **Found during:** Task 1
- **Issue:** The plan's Task 1 `<done>` says the three wire interfaces should end Task 1 "referenced only by `computeRenderDigest()`'s signature", i.e. that signature keeps the old types until Task 2. But Task 1's own `<verify>` gate is `npm run typecheck`, and once `renderMemoryMap()` reads store rows, passing them to a digest typed on the wire shapes does not compile. Keeping the old signature would have required hand-building wire-shaped objects — including a `type` field `LabelRow` has no equivalent for — which is the exact dishonesty Task 2 forbids.
- **Fix:** Task 1 re-typed `computeRenderDigest()`'s three parameters to `RangeRow`/`LabelRow`/`CommentRow` and left the three `interface` declarations in place, unreferenced but still described by the comment above them. Task 2 deleted them together with the version bump and the comment re-anchor, exactly as planned. The plan's stated *reason* for deferring ("`computeRenderDigest()`'s signature would stop naming a type that exists and this task's typecheck gate would fail") is backwards: deleting them never failed typecheck; keeping the old signature did.
- **Files modified:** `src/mcp/vice/anno-memmap-render.ts`
- **Verification:** `npm run typecheck` green at every commit; `R2000Block`/`R2000Symbol`/`R2000Comment` absent from the module after `4447e17`, asserted by the co-located provenance test.
- **Committed in:** `1221202` (Task 1) and `4447e17` (Task 2)
- **Consequence, stated rather than hidden:** for one intermediate commit (`1221202`) `RENDERER_VERSION` read `"2"` while the digest's input had already changed. `4447e17` closes that window; nothing shipped in between.

**2. [Rule 3 - Blocking] Task 1 had to adapt the render test file the plan told it to leave alone**

- **Found during:** Task 1
- **Issue:** Renaming `projectPath` -> `storePath` broke eight call sites in `anno-memmap-render.test.ts`, so Task 1's typecheck gate failed. The plan assigns that file to Task 3.
- **Fix:** Task 1 made the minimal mechanical rename (`storePath:`/`workspaceRoot:`) so the tree compiled; the tests stayed gated and skipped (`skipReasonFor` reports no binary on this host) until Task 3 converted them properly.
- **Files modified:** `src/mcp/vice/anno-memmap-render.test.ts`
- **Verification:** `npm run typecheck` green; `node --test anno-memmap-render.test.ts` reported 15 pass / 3 skipped at `1221202`, i.e. unchanged behaviour.
- **Committed in:** `1221202`

**3. [Rule 2 - Missing Critical] `render-memmap`'s options gained a required `workspaceRoot`**

- **Found during:** Task 1
- **Issue:** T-29-52 requires `openStore()` be called with an explicit `workspaceRoot` and `mustExist`. `openStore()` refuses outright without a root unless the caller claims `unconfinedModuleDerivedPath` — which is false here, the path is caller-supplied. The plan's rename (`projectPath` -> `storePath`) alone cannot express the mitigation.
- **Fix:** Both option interfaces take a REQUIRED `workspaceRoot`, documented as required rather than defaulted precisely because `openStore()`'s default behaviour is to CREATE the file. The CLI passes `repoRoot()`, the same root it confines the path against, so the two answers agree by construction rather than by a second rule.
- **Files modified:** `src/mcp/vice/anno-memmap-render.ts`, `src/mcp/vice/anno-cli.ts`
- **Verification:** `anno-cli.test.ts`'s new "a store path outside the workspace root is refused by the ONE confinement seam" test, plus "a missing annotation store is refused rather than CREATED" asserting the store does not exist afterwards.
- **Committed in:** `1221202`

**4. [Rule 3 - Blocking] The render-memmap CLI tests had to move inside the workspace**

- **Found during:** Task 1
- **Issue:** Those tests built fixtures in the system tmpdir. With the confinement seam wired in, a tmpdir path is refused BY DESIGN — the mitigation for T-29-51, not an inconvenience — so they would have asserted the wrong refusal.
- **Fix:** Moved to the existing `withWorkspaceTempDir()` helper `coverage`'s own tests already use, and their expectations updated to the store vocabulary. The WR-09 write guard additionally needed a REAL store and a VALID sidecar, since a junk file now fails earlier in `openStore()` and the guard would silently stop testing WR-09; it now asserts `could not write` specifically.
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Verification:** `node --test anno-cli.test.ts` -> 47 tests, 47 pass.
- **Committed in:** `1221202`

**5. [Rule 1 - Bug] The generated banner named a subcommand that no longer exists**

- **Found during:** Task 1 (the tracer's human-check, reading real rendered output)
- **Issue:** Every generated memory map's banner read ``GENERATED by `vice-mcp r2000 render-memmap` ``. Plan 29-09 renamed that subcommand to `anno` at wave 5, so the banner instructed a reader to run a command that no longer exists — in a file whose whole purpose is telling a human how to regenerate it.
- **Fix:** The banner names `vice-mcp anno render-memmap`; the golden expectation moved with it.
- **Files modified:** `src/mcp/vice/anno-memmap-render.ts`, `src/mcp/vice/anno-memmap-render.test.ts`
- **Verification:** end-to-end run of the verb against a hand-built store; golden test asserts the new line exactly.
- **Committed in:** `1221202`

**6. [Rule 2 - Missing Critical] The `[unknown]` test never asserted the throw its own name claimed**

- **Found during:** Task 3
- **Issue:** The test is named "… and a malformed store comment throws rather than rendering silently". Its body only exercised the empty and `[unknown]` cases. The plan's `<behavior>` for Task 3 names the throw explicitly, so the gap was in the test, not the plan.
- **Fix:** The converted test writes `[confirmed_code]` (underscore, not hyphen — the near-miss `parseConfidencePrefix()` exists to refuse) straight into the store and asserts `renderMemoryMap()` rejects with `/not a valid confidence grade/`.
- **Files modified:** `src/mcp/vice/anno-memmap-render.test.ts`
- **Verification:** `node --test anno-memmap-render.test.ts` -> 24/24.
- **Committed in:** `14a2b19`

**7. [Rule 3 - Blocking] Two guards constrain edits ABOVE line 79 and above three cited lines, and had to be worked around rather than rewritten**

- **Found during:** Tasks 1-3
- **Issue:** Three separate line pins sit on files this plan rewrites: the gate's `lines: { "anno-memmap-render.ts": [79] }` and `removal-gate.test.ts`'s `deepEqual(hits, [79])`; and `module-classification.ts`'s structured citations `anno-cli.ts:63` (`renderMemoryMap`), `anno-cli.ts:169` (`checkAcceptedOptions`) and `anno-memmap-render.test.ts:21` (`formatConfidenceComment`), all verified by containment in `module-classification.test.ts` Direction 9.
- **Fix:** Every edit above those lines was made line-count-neutral — the import block was laid out so the provenance comment still starts where it must, the USAGE rewording preserved its line count, and the new store imports were placed so `formatConfidenceComment` stayed on line 21. No pin was rewritten to accommodate an edit; `module-classification.ts` was not touched at all.
- **Files modified:** `src/mcp/vice/anno-memmap-render.ts`, `src/mcp/vice/anno-memmap-render.test.ts`, `src/mcp/vice/anno-cli.ts`
- **Verification:** `node --test removal-gate.test.ts module-classification.test.ts` -> all pass; `node scripts/check-no-regenerator2000.mjs` -> exit 0.
- **Committed in:** all four commits

**8. [Rule 3 - Blocking] The gate script's own comment must not spell the subject**

- **Found during:** Task 3
- **Issue:** The re-pin comment explaining which two mentions remain named the `regenerator2000 availability gate (D-11)` test literally. `check-no-regenerator2000.mjs` allows itself exactly one occurrence (the `gate-self` exemption), by design: "a gate that exempts its own body is one edit away from exempting anything". The gate went red on its own new comment.
- **Fix:** The comment uses the `<subject>` placeholder and says why.
- **Files modified:** `scripts/check-no-regenerator2000.mjs`
- **Verification:** `node scripts/check-no-regenerator2000.mjs` -> exit 0.
- **Committed in:** `14a2b19`

---

**Total deviations:** 8 auto-fixed (2 missing-critical, 5 blocking, 1 bug).
**Impact on plan:** No scope creep. Six of the eight are mechanical consequences of the plan's own instructions meeting guards the plan did not enumerate (typecheck ordering, the confinement seam, three line pins, the gate's self-exemption). The two Rule 2 items are the plan's own threat register (T-29-52) and its own Task 3 `<behavior>` list being satisfied where the plan text under-specified how. Every plan-level success criterion is met.

## Prohibitions — status

Both of the plan's `<prohibitions>` carried `status: unverified, verification: flagged`. Both are now **satisfied**:

1. *"A gated test whose subject is being removed must not be deleted when its assertion can be re-pointed at the replacement substrate."* — All three were re-pointed. The file's render half went from 3 skipped to 0 skipped with the assertions intact in substance, and one of them gained the assertion its name had always promised.
2. *"No exemption may be kept alive for a statement that has become false."* — The `:79` mention's subject was restated and is live: it records what the version-2 digest hashed, which is what makes the `"2"` -> `"3"` bump a two-known-shapes statement. A co-located test asserts the paragraph still carries the three wire spellings AND that the declarations it used to point at are gone, so "the comment survives above a hole" is now a red test rather than a discovery.

## Issues Encountered

- **The plan's Task 1/Task 2 boundary is not typecheck-green as written.** Recorded as deviation 1 above; resolved by moving one signature re-type a task earlier. Worth carrying forward: a plan that gates each task on `npm run typecheck` cannot also defer a type change that a value change forces.
- **`mustExist` opens READ-ONLY.** Three of the RED digest tests initially reopened the store with `{ mustExist: true }` to perturb it and failed with `attempt to write a readonly database`. That is `openStore()` behaving exactly as documented ("a judge that can create or modify the thing it judges is not a judge"); the tests were wrong and were fixed inside the RED commit.

## Test suite comparison against `29-BASELINE.md`

`npm run test:automated` (broker confirmed **inactive** before the run):

| Metric | Baseline (29-BASELINE.md) | This run |
|---|---|---|
| tests | 2761 | 2836 |
| pass | 2720 | 2805 |
| fail | 7 | **6** |
| Failing-file SET | `audit-integrity.test.ts` (2) + `r2000-session.test.ts` (5) | **`r2000-session.test.ts` only (6)** |

- **No file entered the set.** No regression attributable to this plan.
- **`audit-integrity.test.ts` left the set**, and not because of this plan — it was repaired earlier in this phase (its census assertions were re-expressed as relations rather than pinned totals). Recorded here as an explained set change, per the baseline's own rule, not banked as an improvement.
- `r2000-session.test.ts` at 6 rather than 5 is the documented load-sensitive variance ("5 in isolation, 6 under load"); the file is on plan 29-10's deletion set.
- `vice-proxy.test.ts` is `MANUAL_ONLY_TESTS` and is excluded from this gate by construction; it was not run (the full glob does not terminate on this host).

Single-command gates: `npm run typecheck` **0**, `node scripts/check-no-regenerator2000.mjs` **0**, `node scripts/audit-gate.mjs` **0**.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 29-10 (wave 7) is unblocked in the way this plan existed to unblock it.** Nothing reachable from the `render-memmap` verb imports the retired runner, so `anno-tools.ts` is deletable rather than load-bearing. 29-10's own `files_modified` already names `anno-memmap-render.test.ts` and the gate script, so re-citing this file's allow-list entry to 29-10 satisfies the reachability rule.
- **Two things 29-10 should expect to find changed from what its plan text describes.** (a) This file's remaining `regenerator2000` count is **2**, not 4 — the two mentions belonging to the availability-gate test (the section comment above it and the test's own name). (b) The file's render half is no longer gated, so 29-10's "removes the gated half" is now only the availability-gate test plus its `skipReasonFor`/`assertR2000RequiredIfEnvSet` imports and the now-consumerless `SKIP_REASON` constant, which carries a comment saying exactly that.
- **Nothing in this plan touched 29-05 row 11.** It stays PERMANENT at 1, line 79, and both its enforcement points (the gate's `lines` pin and `removal-gate.test.ts`'s `deepEqual(hits, [79])`) are green.

## Self-Check: PASSED

- Files claimed as modified, all present on disk: `src/mcp/vice/anno-memmap-render.ts`, `src/mcp/vice/anno-memmap-render.test.ts`, `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`, `scripts/check-no-regenerator2000.mjs`.
- Commits present in `git log`: `1221202`, `5f94d38`, `4447e17`, `14a2b19`.
- Plan-level `<verification>` re-run at HEAD: typecheck **0**; `node --test anno-memmap-render.test.ts anno-cli.test.ts block-class.test.ts removal-gate.test.ts module-classification.test.ts anno-store.test.ts` -> **213 pass, 0 fail, 0 skipped**; `check-no-regenerator2000.mjs` **0**; `audit-gate.mjs` **0**; every count taken against `anno-memmap-render.ts` used `grep -a`.
- No stubs, no skipped tests introduced, no `<verify>` left unrun. Nothing appended to `.planning/WINDOWS.md`.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*
