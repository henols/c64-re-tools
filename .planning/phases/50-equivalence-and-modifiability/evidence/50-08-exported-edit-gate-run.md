# Phase 50, plan 50-08 — the real gate run against the EXPORTED-EDIT subject

Declares all seven outcome lines `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-exported-edit-findings.md`'s
frontmatter cites: `tree_rebuild`, `movement_rebuild`, `hazard_disposition`,
`diff_scope_coverage` (both occurrences), `red_controls`, `second_path_guard`
and `ordering_proof`. Read the inputs from this file, never from a summary's
paraphrase.

This is a single combined evidence file, on the same shape plan 50-03's own
`50-03-modified-gate-run.md` uses — one run's worth of measurement.

---

## Part 1 — `TREE_REBUILD`, `MOVEMENT_REBUILD`, `HAZARD_DISPOSITION`, `DIFF_SCOPE_COVERAGE` (both occurrences)

### What was measured

`src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` (this plan's own
Task 2) loads the **COMMITTED** store export
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json`) into a
fresh, throwaway store, exports it as a tree through the real
`exportAsmTree()` against `hazard-subject-exported-edit.prg` (this plan's own
Task 1 output), and verifies that tree through the real tree-aware entry
point `verifyAcmeAssemblesTree()` — a real ACME, `acme` (release 0.97 "Zem",
resolved on `$PATH`) — against the exporter's own `expectedBytes`. Unlike
plan 50-03's modified subject, no separate annostore was needed: the
exported-edit subject's manifest preserves every block boundary and every
symbol value, so the committed store round-trips against it directly (the
primary route the plan names, measured before this file was written).

The same run also builds the real hazard report (`buildHazardReport()`) over
**both** the committed subject and the exported-edit subject, against the
identical committed store ranges, and asserts the disappearing/surviving
findings in both directions in the same run. It runs the diff-scope helper
(`hazardCoverageOutsideDiffScope()`) against the export's own half-open
extent, and disposes the exported-edit subject's own report against a
frozen, four-entry acknowledgement array (the `page-alignment` finding at
`$088B` is absent from this subject's report, exactly as it is absent from
plan 50-03's modified subject's report, because the construction that
produced it was removed). It separately relocates the shared, unmodified
movement subject (`routine_a`) and re-verifies it, exactly as
`reassembly-gate-run.test.ts` and `reassembly-gate-modified-run.test.ts`
already do for their own subjects.

### Command and raw output

```
$ date -u +"%Y-%m-%d"
2026-09-16

$ cd src/mcp/vice && node --test reassembly-gate-exported-edit-run.test.ts
baseline rebuild (exported-edit subject, against the COMMITTED store):
TREE_REBUILD: ok
DIFF_SCOPE_COVERAGE: complete

movement rebuild (shared, unmodified subject):
MOVEMENT_REBUILD: ok
DIFF_SCOPE_COVERAGE: complete

hazard disposition (exported-edit subject's own real report):
HAZARD_DISPOSITION: acknowledged

Acknowledged findings:
  indexed-dispatch $081C stack-return-dispatch: the RTS-trick return address is reconstructed from a fixed hi/lo table pair; this run does not relocate that table or the code that reads it, so the reconstructed return address stays correct as-is. Unchanged by this plan's edit, which touches only the alignment routine's own exported scope file.
  self-modifying-code $0825 store-target-in-instruction-opcode-byte: the opcode-byte write targets a fixed, unrelocated address in this run; the instruction it patches is not moved by this rebuild, so the write still lands on the intended opcode byte. This construction's own bytes are unchanged by this plan's edit -- only its reachability changed, from never-called in the committed subject to called once from the amended alignment routine, via the added jsr hazard_smc2_entry.
  page-alignment $0881 charset-base-pinned-by-register: the character-set selector is stated as a fixed immediate value naming the committed character-set base; this run does not relocate the character set (the baseline rebuild reproduces the exported-edit subject at its original layout), so the register value still names the correct 2048-byte-aligned block. Unchanged by this plan's edit.
  cycle-exact-raster $10C2 timer-reload-in-vectored-handler: the one-shot timer reload sits inside a vectored handler this run does not relocate; its cycle-exact timing is unaffected by a rebuild that leaves the handler at its original address. Unchanged by this plan's edit.

context: subject=hazard-subject-exported-edit.prg baseline-outcome-reason="the output file this run created is byte-identical to the expected bytes (2279 byte(s) across 16 segment(s))." baseline-byte-length=2279 baseline-segment-count=16 baseline-diff-scope-extent=$0801..$10E8 (exclusive)
context: hazard-report-findings=4 hazard-report-unclassified-regions=0 committed-hazard-report-findings=5
context: movement-subject=routine_a movement-delta=261 ($0105) movement-original-address=$080B movement-relocated-address=$0910
context: movement-outcome-reason="the output file this run created is byte-identical to the expected bytes (272 byte(s) across 4 segment(s))." movement-byte-length=272 movement-segment-count=4 movement-diff-scope-extent=$0801..$0911 (exclusive)
✔ ACME availability gate (1.135334ms)
✔ gate run: the four in-process gate inputs, measured for real against the EXPORTED-EDIT subject and a real assembler (118.684461ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 300.558904
```

Exit code of the full `node --test` invocation, read directly on the same
line (never through a pipe): `0`.

The exported-edit subject's real hazard report carries **4 findings** (not
the committed subject's 5): `indexed-dispatch` at `$081C`,
`self-modifying-code` at `$0825`, `page-alignment` at `$0881`
(`charset-base-pinned-by-register`), and `cycle-exact-raster` at `$10C2`.
The `page-alignment` finding at `$088B`
(`sprite-pointer-names-aligned-base`) that the committed subject's report
carries is ABSENT here, because the sprite-pointer write that produces it
was removed by this plan's edit. The test asserts this absence directly
(`committedHasRemovedFinding` true, `editedHasRemovedFinding` false), asserts
the `$0881` and `$0825` findings present in BOTH subjects' reports, and
asserts the `self-modifying-code` construction's own bytes at
`$0825`-`$0832` are byte-identical between the two subjects. All four
present findings were matched by exactly one reasoned acknowledgement in the
frozen array above. Zero undecided (`"unclassified"`) regions remain.

---

## Part 2 — `RED_CONTROLS`

### What was measured

The same two files Phase 49's own `49-red-controls.md` cites, and plan
50-03's own Part 2 re-ran, `src/mcp/vice/acme-verify.test.ts` and
`src/mcp/vice/reassembly-gate.test.ts`, RE-RUN now as part of this plan's own
verification (this file cites the fresh run's own literal output). Neither
file was modified by this plan — this plan reuses the committed rule table
and byte-diff oracle unchanged, only their inputs differ. The planted
controls these two files carry are unchanged: a wrong-byte rebuild under an
exit-zero assembler, a stale-output-path scenario, and a rebuild in which a
hazard-adjacent range was left outside the diff scope — each paired with a
case checking that the gate itself reads the resulting verdict as red under
the correct rule.

### Command and raw output

```
$ cd src/mcp/vice && node --test acme-verify.test.ts reassembly-gate.test.ts
[...]
✔ gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding (18.191366ms)
✔ gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean (10.941663ms)
✔ gate red: a finding whose anchor address equals the extent's exclusive upper bound is reported outside the scope (0.334686ms)
✔ gate red: a finding whose anchor address equals the extent's lower bound is reported inside the scope (0.233319ms)
✔ gate red: a report with zero findings but at least one undecided region is not reported as covered-and-clean; the undecided region is carried in the helper's output (0.47485ms)
✔ gate red: a zero-length extent is refused by name rather than reported as complete (0.915292ms)
✔ reassembly-gate.ts and reassembly-gate.test.ts are absent from package.json's files[] array (test-only, mechanically enforced) (0.383018ms)
ℹ tests 67
ℹ suites 0
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1506.468052
```

Exit code, read directly on the same line (never through a pipe): `0`. All
67 tests pass, including every planted-control case named above — a
planted control's own case passing IS the observation that the gate went
red on it. The bare outcome line, at column zero and unwrapped so it is a
literal token a reader (and a grep) can bind on:

RED_CONTROLS: all-observed

---

## Part 3 — `SECOND_PATH_GUARD`

### What was measured, and why this is a NARROWER guard than Phase 49's own

Plan 50-03's own Part 3 records that Phase 49's own tree-wide
`acme-seam.test.ts` freeze was removed in commit `276c15c9`, after Phase 49
closed and before this phase began, and that no tree-wide freeze of that kind
survives today. This plan's own work is checked against the same narrower,
but real, evidence plan 50-03 already stood on:

1. `src/mcp/vice/acme-verify.test.ts` pins that `acme-verify.ts` still holds
   exactly one real assembler launch call (`spawnSync(assemblerBin, ...)`).
   Re-run as part of Part 2 above: 67/67 pass, exit 0.
2. This plan's own Task 1 added a grep check (part of its own `<verify>`)
   asserting `src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs`
   contains no `spawnSync(`/`execFileSync(`/`execSync(` call of its own.
   This plan's own Task 2 adds the sibling check for
   `src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` — neither
   contains a `spawnSync(`/`spawn(` call of its own, so neither adds a
   second real-assembler launch site.
3. CI's own `scripts/check-no-skill-external-spawn.mjs` step (unchanged,
   unrelated to this plan) independently blocks any skill script from
   reaching a host binary directly.

### Command and raw output

```
$ grep -c 'spawnSync(' src/mcp/vice/acme-verify.ts
1

$ test "$(grep -ac 'spawnSync(\|execFileSync(\|execSync(' src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs)" = "0" && echo NO_SPAWN_IN_DRIVER
NO_SPAWN_IN_DRIVER

$ test "$(grep -ac 'spawnSync(\|spawn(' src/mcp/vice/reassembly-gate-exported-edit-run.test.ts)" = "0" && echo NO_SPAWN_IN_NEW_FILE
NO_SPAWN_IN_NEW_FILE
```

The bare outcome line, at column zero and unwrapped:

SECOND_PATH_GUARD: held

— on this narrower, but real, evidence: the one sanctioned assembler-launch
site is unchanged and pinned green (`acme-verify.test.ts`), this plan's own
new driver adds no launch of its own, and this plan's own new gate-run test
file adds no launch of its own. This is NOT the same broader guard Phase
49's now-removed `acme-seam.test.ts` provided. It is stated here exactly
that narrowly and no more strongly, on the identical ground plan 50-03's own
Part 3 already stands on.

---

## Part 4 — `ORDERING_PROOF`

### What was measured

Two things were checked. First, the committed rule table
(`src/mcp/vice/reassembly-gate.ts`) is byte-unchanged by this plan — the gate
this phase reads its verdict from is the exact frozen module Phase 49
already ordering-proved, checked against `1c7a1003`, the commit this plan's
own work started from (the tip of `main` before this plan's Task 1 commit).
Second, this plan touches NEITHER the allowlist plan 50-03 committed
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json`,
still unchanged working-tree-clean as of this run) nor any capture: this
plan's own live capture (`exported-edit.bin`, Task 3) does not exist yet at
the time this file is written, so the pre-registered manifest
(`exported-edit.manifest.json`, committed in Task 1) and this gate re-run
(Task 2) both precede any capture under this phase's evidence directory, on
the identical "pre-registration precedes capture" shape plan 50-03's own
Part 4 already established for the allowlist.

### Command and raw output

```
$ git diff --quiet 1c7a1003 -- src/mcp/vice/reassembly-gate.ts && echo GATE_MODULE_UNCHANGED
GATE_MODULE_UNCHANGED

$ test -z "$(git status --porcelain src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json)" && echo ALLOWLIST_UNCHANGED
ALLOWLIST_UNCHANGED

$ ls .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin 2>&1
ls: cannot access '.planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin': No such file or directory
```

`1c7a1003` is the tip of `main` immediately before this plan's own Task 1
commit -- the base commit for this plan's own work.

The bare outcome line, at column zero and unwrapped:

ORDERING_PROOF: held

— the rule table this run's verdict is read from predates this run by
multiple prior phases and plans, the pre-registered edit manifest and this
gate re-run both precede any capture of this subject, and the allowlist this
plan reuses (never edits) is unchanged.
