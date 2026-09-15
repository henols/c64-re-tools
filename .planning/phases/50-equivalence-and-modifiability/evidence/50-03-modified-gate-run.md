# Phase 50, plan 50-03 — the real gate run against the MODIFIED subject

Declares all seven outcome lines `docs/phase50-modifiability-findings.md`'s
frontmatter cites: `tree_rebuild`, `movement_rebuild`, `hazard_disposition`,
`diff_scope_coverage` (both occurrences), `red_controls`, `second_path_guard`
and `ordering_proof`. Read the inputs from this file, never from a summary's
paraphrase.

This is a single combined evidence file, not five separate ones the way
Phase 49's own evidence directory split them — this plan's own findings
document is one run's worth of measurement, not a re-measurement layered
over a prior run's, so there is no history to keep visually separate.

---

## Part 1 — `TREE_REBUILD`, `MOVEMENT_REBUILD`, `HAZARD_DISPOSITION`, `DIFF_SCOPE_COVERAGE` (both occurrences)

### What was measured

`src/mcp/vice/reassembly-gate-modified-run.test.ts` (this plan's own Task 1)
loads the MODIFIED subject's committed store export
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.annostore.json`)
into a fresh, throwaway store, exports it as a tree through the real
`exportAsmTree()`, and verifies that tree through the real tree-aware entry
point `verifyAcmeAssemblesTree()` — a real ACME, `acme` (release 0.97
"Zem", resolved on `$PATH`) — against the exporter's own `expectedBytes`.

The same run also builds the real hazard report (`buildHazardReport()`) over
the modified subject's own bytes and store ranges, and runs the diff-scope
helper (`hazardCoverageOutsideDiffScope()`) against the export's own
half-open extent. It disposes that report against a frozen, four-entry
acknowledgement array built from the modified subject's own real findings
(see the test file's own header for why the array has four entries, not the
committed subject's five). It separately relocates the shared, unmodified
movement subject (`routine_a`) and re-verifies it, exactly as
`reassembly-gate-run.test.ts` already does for the committed subject.

### Command and raw output

```
$ date -u +"%Y-%m-%d"
2026-09-15

$ cd src/mcp/vice && node --test reassembly-gate-modified-run.test.ts
baseline rebuild (modified subject):
TREE_REBUILD: ok
DIFF_SCOPE_COVERAGE: complete

movement rebuild (shared, unmodified subject):
MOVEMENT_REBUILD: ok
DIFF_SCOPE_COVERAGE: complete

hazard disposition (modified subject's own real report):
HAZARD_DISPOSITION: acknowledged

Acknowledged findings:
  indexed-dispatch $081C stack-return-dispatch: the RTS-trick return address is reconstructed from a fixed hi/lo table pair; this run does not relocate that table or the code that reads it, so the reconstructed return address stays correct as-is. Unchanged by this phase's modification, which touches only the alignment routine.
  self-modifying-code $0825 store-target-in-instruction-opcode-byte: the opcode-byte write targets a fixed, unrelocated address in this run; the instruction it patches is not moved by this rebuild, so the write still lands on the intended opcode byte. This construction's own bytes are unchanged by this phase's modification -- only its reachability changed, from never-called in the committed subject to called once from the amended alignment routine.
  page-alignment $0881 charset-base-pinned-by-register: the character-set selector is stated as a fixed immediate value naming the committed character-set base; this run does not relocate the character set (the baseline rebuild reproduces the modified subject at its original layout), so the register value still names the correct 2048-byte-aligned block. Unchanged by this phase's modification.
  cycle-exact-raster $10C2 timer-reload-in-vectored-handler: the one-shot timer reload sits inside a vectored handler this run does not relocate; its cycle-exact timing is unaffected by a rebuild that leaves the handler at its original address. Unchanged by this phase's modification.

context: subject=hazard-subject-modified.prg baseline-outcome-reason="the output file this run created is byte-identical to the expected bytes (2279 byte(s) across 16 segment(s))." baseline-byte-length=2279 baseline-segment-count=16 baseline-diff-scope-extent=$0801..$10E8 (exclusive)
context: hazard-report-findings=4 hazard-report-unclassified-regions=0
context: movement-subject=routine_a movement-delta=261 ($0105) movement-original-address=$080B movement-relocated-address=$0910
context: movement-outcome-reason="the output file this run created is byte-identical to the expected bytes (272 byte(s) across 4 segment(s))." movement-byte-length=272 movement-segment-count=4 movement-diff-scope-extent=$0801..$0911 (exclusive)
✔ ACME availability gate (2.418569ms)
✔ gate run: the four in-process gate inputs, measured for real against the MODIFIED subject and a real assembler (416.430206ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 925.49328
```

Exit code of the full `node --test` invocation, read directly on the same
line (never through a pipe): `0`.

The modified subject's real hazard report carries **4 findings** (not the
committed subject's 5): `indexed-dispatch` at `$081C`, `self-modifying-code`
at `$0825`, `page-alignment` at `$0881` (`charset-base-pinned-by-register`),
and `cycle-exact-raster` at `$10C2`. The `page-alignment` finding at `$088B`
(`sprite-pointer-names-aligned-base`) that the committed subject's report
carries is ABSENT here, because the sprite-pointer write that produces it
was removed by this modification. All four present findings were matched by
exactly one reasoned acknowledgement in the frozen array above. Zero
undecided (`"unclassified"`) regions remain.

---

## Part 2 — `RED_CONTROLS`

### What was measured

The same two files Phase 49's own `49-red-controls.md` cites,
`src/mcp/vice/acme-verify.test.ts` and `src/mcp/vice/reassembly-gate.test.ts`,
RE-RUN now as part of this plan's own verification (this file cites the
fresh run's own literal output, never Phase 49's prior run). Neither file
was modified by this plan — this plan reuses the committed rule table and
byte-diff oracle unchanged, only their inputs differ. The planted controls
these two files carry are unchanged from Phase 49: a wrong-byte rebuild
under an exit-zero assembler, a stale-output-path scenario, and a rebuild in
which a hazard-adjacent range was left outside the diff scope — each paired
with a case checking that the gate itself reads the resulting verdict as red
under the correct rule.

### Command and raw output

```
$ cd src/mcp/vice && node --test acme-verify.test.ts reassembly-gate.test.ts
[...]
✔ gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding (30.470934ms)
✔ gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean (42.539772ms)
✔ gate red: a finding whose anchor address equals the extent's exclusive upper bound is reported outside the scope (0.540823ms)
✔ gate red: a finding whose anchor address equals the extent's lower bound is reported inside the scope (4.541779ms)
✔ gate red: a report with zero findings but at least one undecided region is not reported as covered-and-clean; the undecided region is carried in the helper's output (0.848314ms)
✔ gate red: a zero-length extent is refused by name rather than reported as complete (1.434292ms)
✔ reassembly-gate.ts and reassembly-gate.test.ts are absent from package.json's files[] array (test-only, mechanically enforced) (0.687381ms)
ℹ tests 67
ℹ suites 0
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2960.85157
```

Exit code, read directly on the same line (never through a pipe): `0`. All
67 tests pass, including every planted-control case named above — a
planted control's own case passing IS the observation that the gate went
red on it, on the identical reasoning `49-red-controls.md` already states.

`RED_CONTROLS: all-observed`

---

## Part 3 — `SECOND_PATH_GUARD`

### What was measured, and why this is a NARROWER guard than Phase 49's own

Phase 49's own `SECOND_PATH_GUARD` evidence (`49-guards.md`) was read off
`src/mcp/vice/acme-seam.test.ts`, which froze two tree-wide sets
(`ACME_SPAWN_SITES`, `EXPECTED_BYTES_COMPARISON_SITES`) in both directions.
**That file was removed in commit `276c15c9`**, which removed 43
non-qualifying tests together with `module-classification.ts` — after Phase
49 closed, before this phase began. `50-RESEARCH.md` records this
correction directly (`## Correction to 50-RESEARCH.md and 50-PATTERNS.md`,
`50-03-PLAN.md`'s own header). No tree-wide freeze of this kind survives
today, so this plan cannot cite the same evidence Phase 49 cited.

What DOES survive, and is what this plan's own work is actually checked
against, is listed below.

1. `src/mcp/vice/acme-verify.test.ts` pins that `acme-verify.ts` still holds
   exactly one real assembler launch call (`spawnSync(assemblerBin, ...)`).
   Re-run as part of Part 2 above: 67/67 pass, exit 0.
2. This plan's own Task 1 added a grep check (part of its own `<verify>`)
   asserting `src/mcp/vice/reassembly-gate-modified-run.test.ts` contains no
   `spawnSync(` and no `spawn(` call of its own — i.e. this plan's new gate-run
   file adds no second real-assembler launch site.
3. CI's own `scripts/check-no-skill-external-spawn.mjs` step (unchanged,
   unrelated to this plan) independently blocks any skill script from
   reaching a host binary directly.

### Command and raw output

```
$ grep -c 'spawnSync(' src/mcp/vice/acme-verify.ts
1

$ test "$(grep -ac 'spawnSync(\|spawn(' src/mcp/vice/reassembly-gate-modified-run.test.ts)" = "0" && echo NO_SPAWN_IN_NEW_FILE
NO_SPAWN_IN_NEW_FILE
```

`SECOND_PATH_GUARD: held` — on this narrower, but real, evidence: the one
sanctioned assembler-launch site is unchanged and pinned green
(`acme-verify.test.ts`), and this plan's own new gate-run file adds no
launch of its own. This is NOT the same broader guard Phase 49's now-removed
`acme-seam.test.ts` provided. It is stated here exactly that narrowly and no
more strongly.

---

## Part 4 — `ORDERING_PROOF`

### What was measured

Two things were checked. First, the committed rule table
(`src/mcp/vice/reassembly-gate.ts`) is byte-unchanged by this plan — the
gate this phase reads its verdict from is the exact frozen module Phase 49
already ordering-proved (its own `git diff --quiet` check against
`DECISION-RULE.md`/`SCHEMA.md` is `49-guards.md`'s own precedent for this
style of check). Second, this plan's own new allowlist document
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json`,
committed by this plan's own Task 3) is committed before any capture exists
under this phase's evidence directory — verified by the absence of
`.planning/phases/50-equivalence-and-modifiability/evidence/captures/`.

### Command and raw output

```
$ git diff --quiet 702fb21b -- src/mcp/vice/reassembly-gate.ts && echo GATE_MODULE_UNCHANGED
GATE_MODULE_UNCHANGED

$ ls .planning/phases/50-equivalence-and-modifiability/evidence/captures 2>&1
ls: cannot access '.planning/phases/50-equivalence-and-modifiability/evidence/captures': No such file or directory
```

`702fb21b` is plan 50-02's own final commit -- the base commit for this
plan's own work, before any of this plan's own commits exist.

`ORDERING_PROOF: held` — the rule table this run's verdict is read from
predates this run by an entire prior phase, and this run's own new
allowlist predates any capture it will ever be compared under, matching
`hazard-subject-modified.allowlist.json`'s own committed `note` field.
