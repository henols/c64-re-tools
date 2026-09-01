# Milestones

## v0.7.0 Own the Annotation Store (Shipped: 2026-09-01)

**Phases completed:** 6 phases (27-32, no inserted decimals), 80 plans, 214 tasks

**Requirements:** 28/28 Complete

**Timeline:** 2026-08-26 → 2026-09-01 (7 days), 690 commits
(`6403e2f..83112c1`). Outside `.planning/`: 157 files changed,
+54,294 / −15,411.

**Closeout type:** `override_closeout`

**Verification:** all 6 phases `phase_complete: true`, `verification_status:
passed`. **No milestone audit was run** — the per-phase `VERIFICATION.md` files
are the evidence of record, the same posture the v0.5.0 and v0.6.0 closes took.

**Known verification overrides:** 15 newly acknowledged, 21 carried forward from
a prior close (see STATE.md → `### Acknowledged at the v0.7.0 close`). A further
**8 open items could not be acknowledged by any CLI path** and are disclosed
rather than suppressed: all 8 are GFM table rows inside Phase 23's evidence
tables, which `uat.cjs`'s own doc comment calls "permanently un-acknowledgeable
via the CLI writer". Neither parser escape was taken — one destroys the tables,
the other would write `resolved` into a row whose neighbouring cell reads
`unresolved`.

### Known Gaps

None against this milestone's requirements — all 28 read `Complete`. Two
qualifications are recorded rather than smoothed over:

- **`STORE-03`'s traceability row contradicts its own prose.** Phase 29 logged
  that the row reads `Complete` while the round-6 verifier's own quoted sentence
  three screens below says it *"STAYS `Gaps Found`"*. Plan 29-11 correctly
  declined to move a Phase 28 row and routed it to *"a Phase 28 verification pass
  or a milestone audit"*. This close ran neither, so the contradiction ships.
- **Three Validated capabilities have no route.** `ANNO-13` (generated enums)
  and `ANNO-14`/`ANNO-15` (the symbol round trip) were withdrawn with the
  removal, and **no phase owns their return**. This is a deliberate regression
  under the 2026-08-26 "no parity is owed" decision, not an oversight — the
  heuristics survive as live code, and the withdrawal notes under PROJECT.md →
  Validated correct the superseded forecasts rather than deleting them.

**Key accomplishments:**

- The coverage census's four inline comparisons against a rented analyser's `Display` strings are now one import of `block-class.ts`, and a zero-overlap second vocabulary substituted through that boundary holds every census byte count exact while moving only the divergence sub-report.
- A working `.annostore` on disk: `node:sqlite` behind one structurally-asserted seam, a frozen twelve-member type vocabulary, and one `lo_hi_address` range that survives a close and a reopen readable by value, with `revertTo(0)` restoring the prior state.
- The narrowest-range-wins paint index is now proven exact at all 65,536 addresses against a test-only linear-scan oracle that shares no code path with it — zero disagreements over a 2,000-range overlapping fixture proven non-degenerate on both axes — with $FFFF, both inclusive ends, length 1, the equal-length tie-break and the empty/single-row cases each pinned separately and each observed RED against a deliberately broken production rule.
- `blockClassAt` now accepts the store's lowercase twelve alongside the external analyser's capitalised four, with the false header rationale replaced and both vocabularies pinned by derived total cross-checks whose reddening was observed — no census number, fixture byte or line of `anno-coverage.ts` moved.
- Five annotation kinds persisted over the existing DDL with a validator set that refuses rather than guesses — a label denylist derived from the real 256-entry opcode table, comment text bounded in UTF-8 bytes, and the split-orientation control observed red against a deliberately collapsed implementation.
- Split-and-preserve proven across all five overlap cases with a union-form byte invariant plus a covered-address subset invariant, and a `CONFIDENCE_GRADES`-derived contradicted-comment report returned as data on the successful write — with both plantings observed red and the phase's planted-violation model corrected by measurement.
- One combined test proves durability and revert together across a real `SIGKILL` in a separate OS process — with the removed `COMMIT` observed reddening both halves — plus the cross-process stale-revision refusal, four corrupt-file refusals with the tail residual stated rather than claimed, and a snapshot ring bounded at a single-homed constant.
- One predicate (`retainedRevisions`) and one resolver (`reconcileSnapshotRing`) replace three functions that each decided independently what "retained" meant, so a second revert now refuses by name inside the `ViceError` family with the caller's handle still open, the directory bound survives a revert, and the prune deletes the pointer row before the file it used to delete first.
- A snapshot file is now written by exactly one writer -- the one whose compare-and-swap won and whose pointer row commits it -- because `stageSnapshot` vacuums into a per-attempt `.tmp` name, `publishSnapshot` renames it onto `r<revision>.db` only after the CAS is won, and `discardSnapshot` cleans up on every other exit; plus a CAS refusal that carries both conflicting revisions and an `openStore` whose every failure is inside the `ViceError` family.
- `storePathWithinWorkspace` now compares REAL paths on both sides through a deepest-existing-ancestor walk, so a symlinked subdirectory inside the workspace is refused with `AnnoStorePathError` and no store file is created outside the root — while an inside-pointing symlink is still followed, proven by two plantings rather than one.
- A snapshot's location became a total function of `(handle, revision)` — the ring directory is keyed on `basename(handle.path)`, `anno_snapshot.path` is dropped so no persisted absolute string can disagree with it, and `SCHEMA_VERSION` 2 refuses a previous-shape store by name while leaving its legacy ring untouched.
- `reconcileSnapshotRing` now takes the store's `begin immediate` write lock before it decides anything, so a snapshot a concurrent writer has published-but-not-committed is unobservable to a sweep by construction; it commits its row deletes before it unlinks; it reports `deferred` when it declines; `pruneSnapshots` returns early on that report; and the three unguarded regions in the same code (WR-01, WR-02, WR-04) are wrapped.
- `realpathOfNearestExisting` now stops at a path ENTRY (`lstatSync(p, { throwIfNoEntry: false })`) instead of at a path that RESOLVES (`existsSync`), and resolves a dangling stopping entry by hand with `readlinkSync` against the link's own directory under a 40-hop bound — closing CR-04, where a one-line dangling symlink placed a store file outside the workspace root while the confinement returned an in-workspace path.
- `reconcileSnapshotRing` abstains from the pointer-ROW direction entirely and sweeps only the FILE direction, making the CR-05 class (a second path spelling of the same store file destroying a reachable revert history) structurally unreachable rather than patched at its third cause; its transaction gains a structural lifetime so no reachable throw can wedge the caller's connection (CR-07).
- `runWriteSequence`'s step-8 commit and `revertTo`'s step-6 sweep are each brought inside a handler, so an ordinary READER in another OS process can no longer make an accepted write escape the `ViceError` family, leave the store's write lock held and leave `currentRevision()` reporting a write that never landed (CR-06) — and a housekeeping failure after a revert that already succeeded on disk can no longer cost the caller a handle (CR-07's third property).
- Every stat failure in the confinement ancestor walk other than `ENOENT` is now a named `AnnoStorePathError` decision instead of a bare OS abort — measured at both entry points on the three ordinary inputs 28-12 regressed — and the round closes with 144/144 anno tests at real exit 0, the four non-vacuity controls re-observed one at a time, and criterion 4's planted red re-run against the final tree.
- `revertTo`'s destructive half is now unreachable until an `openStore` has succeeded — one witness (`snapshotOpenFailure`) read by the advertisement, by the source-image gate and by the staged copy — so a retained snapshot that is not a database is an in-family refusal instead of the irrecoverable loss of the live store.
- The publish path now fsyncs the staged image (unguarded) and the ring directory (best effort) so a durable pointer row can no longer name bytes that never reached disk; three rollback handlers report the rollback they OBSERVED via a recorded `rolledBack` / `rollbackFailed`; and two root-sensitive controls skip visibly instead of passing vacuously — 167/167 anno tests, `# fail 0 / # skipped 0` as uid 1000.
- The single-commit-site control now matches commit STATEMENTS across all three SQLite spellings instead of counting the word `commit` — closing a defect that let a working `db.exec("end")` pass the control unchanged — all six round-4 findings carry a recorded decision with cited evidence, STORE-05 returns to `Complete` on the verifier's own verdict, and the round closes on 169/169 at real exit 0 with the CR-08 reproduction re-driven as `69632 -> 69632`.
- `retype()` now asks `assertRangeShape()` itself about every split-and-preserve remainder before it deletes anything, so the store can no longer persist an odd-byte-count split table it would refuse at its own entry point — refusing instead with a named `AnnoSplitRemainderError` that carries both conflicting spans and the two nearest legal boundaries, while the reserved `bank` column now survives a split.
- An argument error that reads like one (`AnnoRevisionArgumentError`, outside the corruption family), a revert staging path no second attempt can produce (`randomUUID`, three cleanups through `discardSnapshot`), and a reported rollback failure that production code now reads at both call sites — carried on the handle so the committed write still reports success.
- `addScope` gained an idempotence check and a no-nesting refusal so both of its doc comments became true, and workspace confinement became `openStore`'s default with a one-word greppable escape pinned to its four module-derived opens.
- A commit-statement matcher that finds the statement inside the `exec()` literal instead of requiring the literal to BE one, twelve round-5 dispositions transcribed into the record that survives, STORE-04 moved up on the verifier's own sentence, and the round closed on nine plantings re-observed red on the final tree.
- The owned annotation store now answers an agent over MCP: `anno_get_symbols` is registered proxy-locally through `buildViceTool()`, opens a real store, reads it and closes it in a `finally` — and all seven guards that break on registration moved in the same wave.
- A CI gate whose scope is `(git ls-files − .planning/) ∪ packFiles("installer")` — 395 files, tracked AND shipped — with eight exact-count exemption classes, a dated 49-entry allow-list keyed to the plans that discharge it, and a recorded transcript of it going red on four evasion routes and on a deleted attribution block, all landed while every file it guards is still present.
- `anno_enum_usage` associates one address with one project enum by enum ID at `SCHEMA_VERSION` 3, and the version refusal is proven — behaviourally and structurally — to have stayed a single witness with no migration arm.
- `STORE-06` now answers from the bytes: cross-references union the decoded code, the typed split ADDRESS tables and the stored non-derivable rows into one sorted de-duplicated list, search runs byte-exact over three independently disableable corpora with truncation detectable — and a two-halved control proves a derived query leaves the store byte-for-byte unchanged, with the planted violation observed reddening it.
- Nine capability modules and the CLI moved out from under the retired prefix — driven entry by entry from the classification registry rather than by a glob — with the registry gaining a checked `ModuleFate`, the module floor re-expressed as a measured raise to 15, and every gate entry that named a moved path re-pointed and re-bucketed in the same commit as its `git mv`.
- The `anno` CLI drops from eight verbs to two, and its `coverage` verb now reads labels, comments, ranges and derived cross-references out of the Phase 28 SQLite annotation store — proven verdict-for-verdict identical against all twelve committed coverage fixtures, with the 512-lookup round-trip ceiling deleted rather than carried.
- `MCP-01` turned from a claim into a checked property in both directions: `anno-derivation.test.ts` now walks the Phase 19 manifest and asserts a route for each of its 16 curated-or-adapt verbs and the absence of all 4 omit verbs under both spellings, while `anno-register.ts` gives the 4 unclassified surface verbs a committed home that fails — naming the verb — when a fifth appears without a requirement id and a named consumer.
- Every absorbed analysis procedure now executes on the owned annotation surface in both trees a user can receive it from — 17 old-family tool names re-pointed onto 18 verbs that actually exist, six withdrawn CLI verbs each described as withdrawn with a dated return condition, the `anno` subcommand renamed to `anno` across its three halves in one commit, and the one guard that contradicted the cut resolved with the skill named as the side that moved.
- The retired static-analysis integration's glue is gone — 14 files and 8,221 lines removed entry by entry from the classification registry, with its two pinned false-pass transcripts carried forward, both capability modules' heuristics extracted out of their dying routes as live code, and three guards re-pointed onto subjects that still exist and re-proven by plants against the real post-deletion tree.
- The planning record now describes what happened rather than what was planned: `D-01`'s falsified coexistence claims are edited with the decision cited by id and the clauses they replace quoted verbatim, Phases 30-32 are narrowed with all 28 requirements still owned by exactly one phase (cross-checked mechanically), the ordering constraint that made an in-phase deletion safe is restated as an intra-phase rule rather than erased, and the removal gate's temporary allow-list is closed with an emptiness assertion observed firing under a plant.
- `anno_disassemble` now refuses an out-of-image address exactly as `anno_read_region` does, a nested `anno_batch_execute` on the documented store inheritance finally validates and executes, and `anno_save_project` reads its revision once.
- All six caller-supplied path arguments on both `anno` verbs now resolve through `storePathWithinWorkspace()` before any filesystem call, the sidecar parse failure no longer echoes the file's bytes, and a closed-consumer-set test makes the next unconfined argument fail a test rather than a review.
- Four dead `anno render-memmap game.regen2000proj` invocations re-pointed onto `game.annostore` across both canonical skill files and their generated installer twins, the falsified 2026-08-29 note deleted and replaced by a dated correction, and the whole thing proven by a committed script that extracts the documented command from `SKILL.md` and runs it against a real store.
- `anno coverage game.prg --store game.annostore` now runs to exit 0 through one exported image loader with two callers, extension-dispatched before any length check, with its JSON-syntax failure no longer echoing the file's own bytes — and a new sixth CI gate argument-checks every documented `anno` invocation in both skill trees so the next dead command fails a gate rather than a review.
- CUT-01's three falsified sizing figures replaced by the measured ones with their derivation carried inside the entry, the requirement moved to Complete on the owner's 2026-08-30 decision in the same edit as its sentence, and MCP-04's stale `Complete` corrected down so two tables in one file stop giving different answers.
- `render-memmap`'s banner now records workspace-relative locations through a new `workspaceRelativePath()` seam, so the identical tree at a different absolute path renders byte-identical markdown and `--check` exits 0 where it previously reported `drifted` at line 3 while printing the same `render_digest`.
- `checkInvocation()` gained a third check and a fourth parameter, and the two per-verb declaration tables moved into the import-safe lib — so the gate that reported `OK`, exit 0, for a documented command that exits 1 now names `--store` and exits 1, against tables its own committed test imports from the same module CI does.
- `anno --help` now states the drift cause set the code has, the `--out` default beside the STORE, an `<image>` positional with its three accepted forms, and an exit contract enumerated from every reachable `return 1`; the copy-forward template and the recon playbook say the same thing and hand 29-18's one-time banner drift to a reader; and the three headers that credited the path-consumer test with per-argument association now state what it checks and name what it does not — proven with a wrap-tolerant probe that read 3 before the fix where the naive grep read 2.
- CUT-01's sizing claim rebuilt from a measurement this plan RAN — 26,023 pre-phase at `8f21d77`, 19,714 surviving at the newly-named anchor `f16d0b1`, 6,309 net removed — and MCP-04 moved to `Complete` across all four of its sites on the verifier's quoted `✓ SATISFIED (was BLOCKED)` verdict.
- One annotation store, one code range, one image, one real ACME 0.97 run, one byte-diff, one `ok` -- with the verdict layer already refusing to read the exit status, refusing to trust the aggregate line, and carrying `skipped` as a third outcome that is never a pass.
- A missing assembler and a corrupted byte are now both OBSERVED refusals -- one in a child process because `ACME_BIN` is a module-load constant, one against a real ACME that exits 0 on the wrong bytes -- each paired with a control that proves the guard can bite, and both pinned transcripts re-recorded from ACME 0.97 output this phase's own producer made.
- Every block now asserts its own origin and its own exclusive end -- both observed making real ACME 0.97 exit 1 on a planted length change with no output file written -- all twelve `DATA_TYPES` members round-trip byte-identically off the vocabulary's own frozen array, and an embedded line break in comment text is refused by name at the store boundary and again at the export boundary.
- A confined, non-overwriting `anno export-asm <image> --store FILE [--out FILE] [--force]` that emits ACME source from an annotation store and states in its own second output line that it assembled nothing — with all nine of the CLI's path arguments now inventoried, the verb floor raised on both sides of its exact equality, the invocation gate's three per-verb tables extended, and the false "returns in Phase 30" forecast in the floor's own doc replaced by what actually happened.
- Every in-tree statement that `anno export-asm` was withdrawn-and-returning-in-a-numbered-phase is discharged with its real invocation and its test-only-oracle caveat; every statement that `gen-enums`/`export-lbl`/`import-lbl`/`.d64` extraction returns in that phase is re-pointed to an explicit no-owner note; and a new guard tied to `parseAnnoCliVerbs()` fails when a dispatched verb is documented as withdrawn — observed failing once, naming both skill trees.
- Eight prose deltas re-syncing Phase 19's upstream snapshot record onto surviving subjects — trigger 3 now names `CURATED_ANNO_TOOLS`/`anno-tools.ts`, trigger 1 names `anno-derivation.test.ts`, and `anno_undo` carries `requirement_id: STORE-04` as a decided omission discharged by `revertTo(handle, revision)` per `D2`.
- `REPOINT-03`'s sentence turned from a recorded grep into two committed assertions: every ABS-02 attribution block in both skill trees is now scored for one byte-exact `Adapted from <name>.` line and one byte-exact two-space-indented `Source repository:` line, compared as relations plus a per-tree floor, with a one-byte plant on each line proving the byte-exactness is real.
- The `skill-attribution-headers` permanent exemption's justification is auditable again — both gate citations and the STATE.md decision line now name ROADMAP Phase 31 criterion 1 with a dated `D-01` renumbering parenthetical, the content clause preserved verbatim — and this phase's four judgements (the inferred `STORE-04` id, date-don't-delete, no permanent prose gate, and the deliberate non-promotion) are one dated `- [Phase 31]:` Decisions entry instead of a diff a later reader would have to reconstruct.
- The two-tree ABS-02 naming-line guard now actually reads two trees in CI, and its documented `grep -rx` whole-line byte equality is true at block boundaries by construction rather than by luck — plus a durable disposition record for all 11 code-review findings.
- One audited guard proven end to end — the guard derives it from the object store at `0394cbc`, the registry names it, the harness plants `ANNO_CLI_VERB_FLOOR = 3` → `4`, `anno-verb-coverage.test.ts` is captured exiting 1 against a green control that exited 0, and the tree comes back byte-identical.
- Six of eight repo-level guard scripts now accept a repository-contained `--root <dir>` (up from one), the table generator's WRITE target included, so the phase-32 sweep can plant against a synthetic tree without touching `docs/tool-support.md` — and D-07's 1/7 split is now a measurement with per-script code-shape reasons instead of a research assumption.
- `docs-linerefs.test.ts` now scans a declared two-document set instead of one hard-coded path, with a citation-aware exactly-one-per-document bullet predicate, a per-document non-vacuity floor, and five planted violations that drive the real rule from in-memory bodies — so `.planning/PROJECT.md`'s `vice-proxy.ts` citations can no longer go stale unnoticed the way they did through v0.7.0.
- A declared, re-derivable 50-member swept set with one mechanically-derived verdict row per file — and three measured corrections to the phase's own published figures: CONTEXT.md's "26 `anno_`" reconciles exactly as a case-insensitive count (research said it could not), research's own 373/338 tree-wide totals reproduce at no commit, and the gate's predicate reaches 37 tracked files where the plan's census reaches 35.
- All 15 renamed set-A guards observed exiting non-zero against their new subjects under recorded minimal plants, each paired with a green exit-0 control, with the tree restored byte-identical — and the renamed group measured at 15, not the plan's 16.
- All 18 re-pointed set-A guards that survived under their original path observed exiting non-zero against their new subjects behind green exit-0 controls, with every guard's unplanted runtime measured against the harness's 15s bound first — including `vice-proxy.test.ts`, which does not terminate at 300106ms unscoped and was made measurable rather than recorded unmeasurable.
- The 25 remaining audited members recorded — 7 `deleted` with two-sided proofs of absence, 16 net-new set-B guards, and the 2 deferred set-C fates against their NEW triggers — taking `guard-fates.json` to a complete 61-row bijection and `check-guard-fates.mjs` to exit 0 for the first time since it landed, with the guard, the harness and every floor byte-identical to what plan 32-01 committed while it was red.
- The audited-guard fate gate now runs in CI as its own named step against a `fetch-depth: 0` checkout, and the phase-close gate was re-run and recorded at `0d7d328` — broker down and read at both ends, both legs of the whole-glob claim worked separately, and the nine-SKIP nuance written out in words instead of left inferable.
- The mutation harness's plant post-condition now counts what the mutation introduced instead of what the file contains, a refused plant fails its own row instead of aborting the loop, and rows whose verdict owes no observed red are reported SKIPPED — so the whole-set `--all` sweep completes for the first time: 35 measured, 26 skipped, 61 total.
- The milestone-audit gate can no longer be pointed at a tree by a typo, a bare flag or an equals form without saying so — three invocations that each produced a full real-tree "OK" at exit 0 are now named failures at exit 1 — and the six source comments asserting this migration would never happen are corrected with the measurement that shows their stated reason was false before they were written.
- `parseRootArg()` learned about declared value-taking flags, and the one instrument in this phase that both mutates the tree and writes the registry can no longer be pointed at the real repository by a flag the operator thought pointed it somewhere else.
- The harness's restore-on-signal invariant is observed through its own registered handler — 10/10 attempts at exit `130` across both signals, against plan 32-14's ten zeros — by creating the window in an in-process driver rather than injecting an `await` into the instrument; and `WR-03`'s latch doubt is settled by a sentinel that survives the second `restoreAll()`.
- The mutation harness's restore machinery is no longer disarmable — the module-level latch that permanently no-opped all four process handlers after one completed restore cycle is deleted, `originals.clear()` is the single remaining mechanism, and the two second-window cases that now guard it were watched failing against a deliberately re-introduced latch before they were trusted.
- The mutation harness's plant post-condition now measures the introduction of the recorded replacement AT ITS SITE rather than as a whole-file difference — so the one committed evidence row it used to refuse re-measures, and the whole-set `--all` sweep reaches the registry write-back it had been blocking (`measured=35 skipped=26 total=61`, 35 OBSERVED RED, zero refused, zero unmeasurable).

---

## v0.6.0 Own the substrate — CLOSED INCOMPLETE by its own gate, 2026-08-26

**Opened 2026-08-25. Closed 2026-08-26 after 1 of 4 phases.**

**Verdict:** Phase 23 was written as a pre-committed go/degrade/no-go gate with
the authority to narrow or cancel every phase after it, and it fired.
**`no-go`, rule `R1`** — recorded in
[`docs/phase23-real-release-gate-findings.md`](../docs/phase23-real-release-gate-findings.md).
`R1` is the first rule under first-match-wins and it matched on the first input
(`C0_CORPUS: partial`), so no later rule was reached. `R1` names its own
consequence: *"secure a corpus first, or re-scope v0.6.0 to a claim explicitly
qualified as fixture-only."*

**Delivered:** Phase 23 only — 6 plans executed, 5 retired unexecuted
(`status: superseded`, no substrate), closed `passed` with **three accepted
overrides recording criteria 1-3 as NOT MET**. The "re-measure against real
cracked releases" half of the phase goal was not achieved and is accepted as not
met rather than reclassified.

- [x] Phase 23: The Real-Release Gate (Go/Degrade/No-Go) (6/6 plans) — completed 2026-08-26 — verdict `no-go`, rule `R1`
- [ ] Phase 24: The Two Engines — **HELD** 2026-08-26 (blocked on a corpus; requirement text unchanged)
- [ ] Phase 25: The Annotation Store and the Cutover — **TAKEN FORWARD** as the whole of v0.7.0
- [ ] Phase 26: Automatic Annotation — **HELD** 2026-08-26 (blocked on a corpus; requirement text unchanged)

**Held, not cut — and the distinction is deliberate.** Phases 24 and 26 keep
their numbers, which are never reused, and their requirements stand unchanged:
`DXA-01..03`, `GHID-01..05`, `OPC-01..03`, `AUTO-01..07`, `PROOF-01..03`. They
are held because nothing about them was falsified — only their substrate is
missing. That is a different disposition from v0.5.0's Phases 20-22, which were
**cut** because a pivot made them wrong.

**Phase 25 was taken forward instead**, because its own goal carries no corpus
dependency once the Phase 24 engine coupling is dropped. It became v0.7.0.

**The single gate on reviving 24 and 26.** Of Phase 23's two capture blockers,
one is solved and one is not:

| blocker | state |
|---|---|
| The flat 64K read out as hex through the tool surface — a 32 KB write lost to truncation, an 8 KB write to ten silently dropped characters | **solved** — extract it from a `.vsf` snapshot's `C64MEM` module body instead (4 bytes of port/PLA state, then exactly 65536 bytes of RAM); validated 2026-08-26 against 23-03's own transcript, which it independently localised |
| The fork's stopping exec checkpoint is not frame-exact | **unsolved** — snapshot-to-snapshot with no transcription anywhere, the two `danish` runs still diverge at 201 multi-bit addresses |

Frame index is the dominant term, and the contrast is the useful part:
`saeger`'s two runs both landed on the same `hit_count` and diverged at exactly
one byte — `$00F6`, the KERNAL keyboard-decode-table pointer. Land two runs on
the same frame and they are one transient pointer from equivalent. **Nothing
owns this.** Raised as verification warning W4 on Phase 23 and tracked in
[`todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`](todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md).
Any fix touches `src/`, which Phase 23 was forbidden from doing.

**Phase directories are deliberately not archived at this close.** Five
committed tests read live paths under `.planning/phases/` — two of them by
hard-coded relative path to
`phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`
(`anno-derivation.test.ts`, `skill-attribution.test.ts`), plus
`absorbed-answer-key.test.ts` (`phases/11-*/evidence/`, no existence guard),
`anno-coverage.test.ts` (`phases/19-*/evidence/`) and `anno-verify.test.ts`
(`phases/10-*/evidence/`). `.planning/milestones/` holds no `*-phases/` archive
because this project has never archived them, for that reason. Archiving here
would also mislabel Phases 1-19 under the v0.6.0 label. If phase archival is
ever wanted, those five path dependencies are what must move first.

**No milestone audit was run**, and that is a statement rather than an omission:
a milestone audit checks delivery against intent, and v0.6.0's own gate already
recorded — with three accepted overrides — that its intent was not delivered.
Phase 23's findings document is the audit of record.

**Not archived:** `ROADMAP.md` and `REQUIREMENTS.md` are left in place rather
than snapshotted to `milestones/v0.6.0-*`, because Phases 24 and 26 are held
with live requirement text that v0.8.0 will carry forward unchanged.

---

## v0.5.0 Persistent Session and the Coverage Instrument (Shipped: 2026-08-25)

**Phases completed:** 2 phases, 27 plans, 61 tasks

**Key accomplishments:**

- Ran the Architecture Change Procedure's six steps in full for the D-17/D-18 per-call-lifecycle reversal, allocated D-36 superseding D-32's `anno_get_address_details` exclusion, and pinned both with `docs-absorbed-decisions.test.ts`, proven non-vacuous by three live red-then-green planted-violation probes against the real committed documents.
- Added `ensureProjectSettings()` and `AnnoProjectSettingsError` to `anno-project.ts` -- a read-parse-force-rewrite pass over an existing `.regen2000proj` that silently forces `use_illegal_opcodes` to `true` and refuses by name on a `settings.system` mismatch, a missing file, or malformed JSON, proven by 11 new unit tests including a committed non-vacuity control and a live red-then-green probe.
- Promoted `withAnnoSession()`'s one-shot spawn/handshake logic into a long-lived `openAnnoSession()` primitive, built a new `anno-session.ts` single-slot lifecycle owner on top of it (reuse-on-same-path, evict-on-path-change, evict-on-external-write), rewired `runAnnoTool()` through it with its save-per-mutation body byte-identical, landed D18-09's three-scenario save-discipline planted-violation gate watched red-then-green, and — while proving the plan's own full-suite requirement — found and fixed a real cross-session staleness bug the persistent-session design introduced for `anno-symbols.ts`'s separate one-shot import/export flow.
- A crashed or wedged the external analyser session is now recoverable and attributable: between-call deaths respawn transparently, mid-call/wedge deaths fail loud and are never retried, a named restart budget refuses a genuinely broken project after repeated crashes, and the proxy's own exit no longer orphans a live child — with the SIGKILLed-proxy risk answered by measurement, not assumption.
- `anno_read_region` joins the curated surface with both views and a documented 4096-byte cap (`ANNO_READ_REGION_MAX_BYTES`), and `anno_get_address_details` is now curated as a four-read client-side composition (`composeAddressDetails()`) under D-36 — never calling upstream's own same-named tool, which live-reconfirmed still answers `OutOfRange` at every address on a full 64K project.
- A single FIFO queue now owns each persistent the external analyser session, preserving whole-operation call-and-save ordering and surfacing stuck contention as a named timeout.
- The phase is closed by a live settings round trip, full Node 22 gate, package checks, and explicit evidence for all six requirements.
- The seventh skill `routine-queue-walker` lands absorbed from the external analyser @`493f840…` with a six-field attribution header, the packaging guard now asserts a relation instead of the literal six, both notices files are true in the same commit, two mechanical guards hold the attribution chain shut (each proven to fire), and D18-16 is answered by a three-run measurement showing the stdio child does not multiplex.
- All five upstream analyze procedures are now absorbed at one pinned commit — `analyze-blocks` and `analyze-symbol` into `c64-memory-mapping`, `analyze-routine` and a deferred REFERENCE-ONLY `analyze-basic` into `c64-program-recon` — with one attribution block per source path rather than per file, a registry asserted equal to the manifest's own procedure set, a BASIC trigger vocabulary proven absent from every description, and the tarball that actually ships the prose finally carrying a notices document asserted against its own packed payload.
- A derived-from-bytes coverage census that the external analyser's own block table cannot move by a single byte, with a four-class widened dispatch scan, two label figures, a comment-vacuity measure, a bytes-versus-store reproducibility seal, and six committed controls — five that must fail for a named reason, one that must pass.
- The coverage instrument became runnable — an eighth `anno` CLI verb that reads the store through the held session and prints three separately named measures with no aggregate anywhere — and packer identity became a project-owned recon finding whose name field has exactly one assignment site, inside an external oracle's branch.
- A pairwise Jaccard trigger-collision gate over all seven skill descriptions — threshold 0.35 justified by the measurement that produced it, empty allowlist, wired blocking into CI — plus three descriptions sharpened by a dispatcher read the metric never fired on, five dated decisions with checkable reversal conditions, and a green seven-step phase gate.
- The one measure whose whole subject is refusing to be talked into a clean verdict can no longer be talked into one: a hex string that merely touches a caller's short form, or a label name embedded in a longer identifier, buys nothing — proven by two controls that were observed red before the fix and green after.
- The census now has a committed false-positive control that was proven red before the gate landed: two 64-byte programs differing only in a seven-byte prologue, generated together under four enforced invariants, reporting `reachedAsInstruction` 55 and 7 against the pre-19-08 instrument and 7 and 7 now — with the phase's validation record extended rather than rewritten, and `REQUIREMENTS.md` verified honest without being touched.
- `hasDispatchContext()` now requires the dispatch CONSUMER rather than the construction — an indirect jump whose operand equals the lower of two adjacent zero-page store targets — held down by `fp2-zeropage-data-pointer`, the gate's first interior control, plus a witness-checked declaration table that reds the suite by name when a sufficient shape has no interior control.
- The class-4 stack-return scan is now held to class 3's standard before it may seed a recursive descent — same-index-register match plus a decodable, in-image entry point — with the two negative controls it never had; and only a PROVEN split-table pairing consumes its leading load, so an unrelated indexed load between the two halves of a real dispatch table no longer erases it.
- A caller's label name now counts only when the comment USES it as a reference (backticked, introduced by a caller-naming word, or followed by its own parenthesised hex address), and the dispatch scan reads one clamped `effectiveEnd` at `$10000` instead of five recomputations of origin-plus-length.
- All 24 `19-REVIEW.md` finding ids now carry a durable, quality-bearing disposition in `19-REVIEW-FIX.md` — measured to cover the full set ALONE, with every other disposition source excluded — while `19-REVIEW.md` itself is byte-unchanged; both stale deferred entries are corrected against measurement rather than prediction; and the full suite is observed green at `# tests 2580 / # pass 2535 / # fail 0` with both named guards passing standalone.
- `CR-02` — the one `19-REVIEW.md` finding id undispositioned in all five sources the AUDIT-01 guard accepts — now carries an evidence-bearing disposition in `.planning/todos/completed/`, taking `docs-review-disposition.test.ts` from 6/7 to 7/7 and clearing the `D-12-02` cascade, with `19-REVIEW.md` byte-unchanged.
- `hasDispatchContext()`'s stack-return branch now demands a `pha` at each paired load's own successor and an `rts` after both, so the round-3 blocker payload — 15 code bytes that manufactured eight "proven" entry points and 47 of 64 bytes of code-or-table — reports nothing.
- `hasDispatchContext()`'s second true-returning site now compares the indirect jump's operand against the vector the pairing's own two stores built, and a source-derived pin asserts that BOTH branches consult the pairing — so a presence-only branch reds the suite by name instead of satisfying declarations its own author writes.
- A thousand 6502 arrangements composed from a ten-fragment alphabet across 72 stratified families, each one's expected verdict COMPUTED by a six-rule oracle that never touches a byte, and one set equality asserting in both directions that the dispatch instrument proves exactly the arrangements that carry a proven data-flow link.
- The anti-regression mechanism's own hole is closed: a control target is now a (shape, route) pair, the disjunction that let a class-4-only control vouch for the class-3 route is deleted, and the route set — its call sites, publication sites, seam sources and gate ordering — is read from `anno-coverage.ts`'s own text rather than mirrored by hand.
- All seven gates this round added consolidated into one traceable table — the payload each must decline with its measured values, the payload it must still accept, the plant, the test observed red and its counts — with D-07's three clauses each mapped to the row that discharges it, WR-03 marked CLOSED with its evidence and its residual, D-08 recorded as a one-way contingency nobody acted on, and the full workspace suite run once, green.
- One decodability predicate read by the recursive descent, the linear sweep and the entry-point gate — closing WR-03, the second inflation route on `reachedAsInstruction`, so a 94%-garbage image reports four bytes of code instead of sixty-four while its legal twin still reports all sixty-four.

---

**Closeout type:** `override_closeout`.

**Known verification overrides:** 5 newly acknowledged, 16 carried forward from a
prior close (see STATE.md → Deferred Items). Phase 19 additionally carries one
verification override inside its own `19-VERIFICATION.md` (SC4 / COV-01),
accepted by the owner on the grounds that a replacement plan for the coverage
instrument supersedes further gap-closure rounds — that replacement is the pivot
recorded below.

### Known Gaps

**Phases 20-22 were CUT on 2026-08-25, dissolved by the dxa+Ghidra pivot rather
than abandoned.** Their goals survive; the substrate they were written against
does not. Nothing was attempted and failed — no plan was ever written for any of
the three. The fourteen requirements they carried are re-mapped to v0.6.0, not
dropped:

- DECOMP-01, DECOMP-02, DECOMP-03, DECOMP-04 — decomposition to closure
- BUILD-01 … BUILD-06 — rebuildable source and the reassembly gate
- EQUIV-01 … EQUIV-04 — equivalence and modifiability

**Why.** Measured on a committed 279-byte fixture, the external analyser unannotated
flat-decodes; dxa recovered 72% of data bytes with zero false positives and
resolved a dispatch table unaided; Ghidra, given dxa's map and volatile I/O
blocks, resolved the indirect dispatch, the self-modifying write, and the
index/stride/split-pointer facts. Full record and reproduction material:
`.planning/notes/dxa-ghidra-pivot.md` and
`.planning/notes/dxa-ghidra-pivot-evidence/`. This reverses D-R1/D-R2 from
`.planning/notes/external-analyser-integration.md`.

**What shipped instead.** This milestone is named for what it actually
delivered — the persistent session and the coverage instrument — not for the
"rebuild half" thesis it opened with, which the pivot cancelled mid-milestone.

## v0.4.0 Debt discharged, decisions settled (Shipped: 2026-08-23)

**Phases completed:** 6 phases (12, 13, 14, 15, 16, 17), 44 plans, 119 tasks
**Requirements:** 16/16 satisfied, zero cut, zero deferred
**Git range:** `8b1beee` → `c8afcb1` (292 commits since `v0.3.0`)
**Changed:** 482 files, +59,739 / −1,512 lines (290 files / +14,621 outside `.planning/`)
**Timeline:** 2 days (2026-08-21 → 2026-08-23)
**Final audit:** round 1, status `tech_debt` — 16/16 requirements, 6/6 phases, 12/12 integration, 4/4 flows, **zero blockers and zero open gaps**; what remains is bookkeeping debt and validation coverage
**Closeout type:** `override_closeout`
**Known verification overrides:** 16 newly acknowledged, 0 carried forward from a prior close (see STATE.md → Deferred Items)

**Delivered:** the project stops inheriting the same ledger. Every carried item
became a fix or a dated decision, the two questions this project had been
answering *by default* each milestone were answered deliberately, and the
instrument that makes all of it checkable was built first — and has been
observed refusing a write. The pending-todo tree reads genuinely empty for the
first time in this project's history: **19 inherited → 0**.

**Key accomplishments:**

- **An audit can no longer declare a clean status over a red guard — and the
  mechanism was watched refusing.** `scripts/audit-gate.mjs` is now the single
  answer to "would a milestone audit's declared status be allowed right now",
  wired as a real `Write|Edit|Bash` PreToolUse hook. Claude Code's own dispatch
  was observed refusing all four write routes — Write, Edit in two payload
  shapes, a Bash heredoc, and a subagent's Write — against a genuinely red
  `docs-linerefs.test.ts`, then allowing them again after a mechanically
  verified revert, with `gaps_found` passing through unobstructed throughout.
  The instrument was built first, then hardened against its own review: a live
  super-linear-regex denial of service and a single-line Bash-append bypass that
  plan 12-02 had *claimed* to close but did not.

- **External verification replaced the internal proxies, and the binaries
  contradicted us.** The three highest-value carried items — one failure mode
  this project has now been taught six times — were each run against real
  hardware rather than a fixture written by the same pass. `VERIF-02`'s three
  synthetic binmon fixtures are real captures; the `--help` backend
  discriminator is confirmed against genuine stock *and* fork `x64sc` with both
  transcripts committed; all four spec-driven Phase 3 wire details were
  live-probed. Two came back confirmed, one inconclusive, and one **refuted** —
  `vice_disk_attach`'s advertised no-side-effect promise is empirically false
  (it resets the machine and loads a program with the run flag clear), and was
  corrected at source rather than annotated.

- **Both default answers became dated decisions, each pinned by its own guard.**
  `FORK-01` decided **retain**: the forked backend stays the hedge, with the
  upstream `KEYBOARD_MATRIX_SET` coupling named as the reversal criterion and
  the caveats carried rather than resolved — and plan 14-03 exercised the fork's
  own `-mcpserver` HTTP transport live for the first time in this repository's
  history (6/6, `vice_sid_get_state` end to end), so the route the decision
  retains is proven followable. `CORE-01` decided **keep-dated** at a
  `gate="blocking-human"` checkpoint. Both are read out of the live file by
  `docs-fork-decision.test.ts` and `docs-core-value-decision.test.ts`.

- **The inherited ledger drained to zero, honestly.** Every one of the 19
  carried items is fixed, dispositioned `wont-fix` with recorded rationale, or
  explicitly promoted with a **named owner**. Widening
  `docs-review-disposition.test.ts`'s parser from level-3-colon-only headings to
  any level 2–6 id surfaced 150 findings where 119 had been visible, and all 9
  newly exposed ones were dispositioned back to green. Phase 03's last partial
  UAT scenario closed with a real experiment, not a re-reading: a non-stopping
  checkpoint armed on the KERNAL IRQ entry ($EA31) against genuine stock VICE
  3.9, with the D-11 rate-limit guard's auto-disable observed firing under a
  sustained ~21-hits/second flood and the emulator still progressing afterward.

- **The repo took its shipping shape.** The plugin payload moved out of Claude
  Code's auto-discovery path into `src/` in two atomic `git mv`s with roughly 30
  functional consumers repointed and the published tarball proven
  byte-identical; `installer/`'s `wireMcp()` — the one function in this repo
  that rewrites a file it does not own — went from never-tested to 18 cases
  driving the shipped `cli.mjs`; the three untested skill scripts got tests
  (`QUAL-01`); a new comment-scoped guard found and fixed **15** pre-existing
  orphaned phase pointers across nine shipped modules (`QUAL-02`); and the
  broker control-plane's `0.0.0.0` bind was recorded as a dated accepted risk
  with its residual exposure stated without softening (`QUAL-03`/`PKG-04`).

**What this milestone proved beyond its requirements.** Two of the closure
plans reversed their own stale premises after re-reading source — plan 15-04
found two findings it had been told were "superseded" still false, and plan
16-08's deferred entry was corrected mid-close when its predicted closure plan
turned out to be the wrong one. Both corrections were made rather than left
standing, which is the same documentation-consistency discipline the milestone
was built to install.

**Regression evidence at close:** `npm test` in `src/mcp/vice` — 2395 tests /
2351 pass / **0 fail** / 39 skipped / 5 todo / 24 suites (the full glob, not
`test:automated`, which skips `MANUAL_ONLY_TESTS`).
`node scripts/audit-gate.mjs --json` → `allowed:true`, `redGuards:[]`, 6/6
guards discovered. `node scripts/check-npm-packages.mjs` → OK, 0 leaks.

---

## v0.3.0 the external analyser static-analysis backend (Shipped: 2026-08-21)

**Phases completed:** 4 phases (9, 10, 11, inserted 11.1), 36 plans, 101 tasks
**Requirements:** 12/12 in-scope satisfied (4 of the original 16 cut or folded 2026-08-17)
**Git range:** `4867535` → `4f048bb` (268 commits since `v0.2.0`)
**Changed:** 244 files, +121,291 / −416 lines (72 files / +18,316 outside `.planning/`)
**Timeline:** 3 days (2026-08-19 → 2026-08-21)
**Final audit:** round 2, status `passed` — 12/12 requirements, 4/4 phases, 12/12 integration, 4/4 flows, zero open gaps
**Known deferred items at close:** 19 (18 pending todos + Phase 03's UAT gap; see STATE.md → Deferred Items)

**Delivered:** recon findings stop being prose. The external analyser is adopted as a
static-analysis backend — a persistent, queryable annotation store plus a
recursive-descent disassembler with an auto-analyzer — reached through 17 curated
`anno_*` tools and a `vice-mcp anno <verb>` CLI, entirely container-side, and
structurally incapable of touching VICE. Register writes read as bit names,
symbols flow both ways between the store and a live emulator, and the flat
linear `toacme` decoder it makes obsolete is deleted.

**Key accomplishments:**

- **Probed the five load-bearing assumptions before building on them, then
  honoured the answer.** A standalone go/no-go phase tested a real
  the external analyser 0.9.20 against seven criteria and recorded a verdict of
  **`degrade`** (rule `R4`) when criterion 3(4) — `.vsf` machine-type
  derivation — proved to be a coincidental default fallback rather than a
  genuine read of the snapshot's own `"C64SC"` field. The milestone shipped
  smaller than proposed because the gate was real: the input set narrowed to
  `.prg` / `.d64` / flat-64K (D-34). Along the way the probe corrected its own
  research — rustc floor `>= 1.90` not 1.85, the true dual `MIT OR Apache-2.0`
  licence, and a Debian-release/glibc mismatch that breaks a naive multi-stage
  container build.

- **Made "the external analyser never touches VICE" a property of the code, twice
  over.** `anno-launch.ts` is the sole spawn seam: `--vice` is unreachable by
  fixed per-verb argv builders *and* denied by a scan that throws
  `AnnoViceFlagError`, both pinned by tests proven to fail under live
  reintroduction. The whole `anno_*` family registers proxy-locally through
  `buildViceTool()` and never reaches `forwardToVice()`, so CLAUDE.md's
  derived-tool path-translation constraint is satisfied by construction rather
  than by an interception — and the family behaves identically on the fork and
  stock backends.

- **Turned a raw binary into an analysed project with no human in the loop.** A
  pure-Node `.regen2000proj` synthesiser (gzip + base64 + minimal JSON) that a
  real the external analyser loads and exports ACME from, with the
  `use_illegal_opcodes`/`system` pair forced explicitly — the keystroke
  bootstrap Phase 9 proved automatable defaults it to `false`, under which an
  export proves nothing about 6510 illegal opcodes. Plus a container-side
  `.d64` reader with a cycle-guarded sector-chain walk that refuses to guess,
  a `vice-mcp anno <verb>` subcommand reaching its CLI before any MCP server
  side effect runs, and one seam parsing `--verify`'s output that keys strictly
  on ACME's own result line — proven in both directions on real transcripts,
  including an exit-1 run where ACME still passed and an exit-0 run where ACME
  never ran.

- **Built the annotation store and proved it holds knowledge, by sealed
  question.** 17 curated `anno_*` tools over a hand-rolled newline-delimited
  JSON-RPC client (chosen over `@mastra/mcp`'s `MCPClient` by a five-property
  live measurement, yielding six distinct named failure modes). Its usefulness
  was then tested falsifiably rather than asserted: session A annotated a
  purpose-made fixture and sealed a question with a hashed answer key; a
  genuinely separate session B answered it from tool calls alone, and the
  canonical line hashed identically — `e64463d8…`.

- **Closed the symbol round trip live, and made register writes readable.**
  `sta $d011` now renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` in real
  ACME-exported source, from a digest-pinned bit-name table generated
  re-runnably from `memmap.json`. A 23-step transcript against genuine
  unpatched stock `x64sc` (VICE 3.9) closes `ANNO-14`/`ANNO-15` end to end: a
  store-written label resolves live, and a name discovered by disassembling the
  running program — never read off source — is written back into the store. The
  store became canonical and the Markdown memory map a generated view with a
  render-digest drift guard.

- **Deleted the thing this milestone earned the right to remove.** The 14-line
  `toacme` wrapper (`cmdDisasm`), its dispatch entry, its usage line, and ~50
  lines of `SKILL.md` caveats structural to a flat linear decoder are gone; both
  playbooks point at the single live-verified `anno export-asm`/`verify` route,
  and a whole-tree grep gate proven to bite on a non-`SKILL.md` file keeps it
  gone.

- **Closed every audit finding behind a guard, and the guard found more than the
  audit did.** Inserted Phase 11.1 fixed or formally dispositioned all of
  `AUDIT-01`..`AUDIT-05`, `FLOW-01`, `FLOW-02`, `INT-01`, `INT-02` plus Phase
  10/11's outstanding review findings — each behind a mechanical guard proven
  non-vacuous by a planted violation or a real reverted edit. Plan 11.1-07's
  new completeness guard, on its first run, found **27** undispositioned
  code-review findings across five phases against the plan's own pre-measured
  8, and closed them all by fixing or filing. Both `SECURITY.md` ledgers now
  read `threats_open: 0` / `status: verified`.

**Archived:**

- [`milestones/v0.3.0-ROADMAP.md`](milestones/v0.3.0-ROADMAP.md)
- [`milestones/v0.3.0-REQUIREMENTS.md`](milestones/v0.3.0-REQUIREMENTS.md)
- [`milestones/v0.3.0-MILESTONE-AUDIT.md`](milestones/v0.3.0-MILESTONE-AUDIT.md) (round 2, plus round 1 verbatim)

---

## v0.2.0 Switchable stock-VICE backend (Shipped: 2026-08-19)

**Phases completed:** 9 phases, 87 plans, 218 tasks
**Requirements:** 51/51 in-scope satisfied (17 cut wholesale 2026-08-17)
**Git range:** `669a7ce` → `HEAD` (696 commits since `v0.1.10`)
**Changed:** 448 files, +133,229 / −736 lines (151 files / +53,857 outside `.planning/`)
**Timeline:** 8 days (2026-08-11 → 2026-08-19)
**Final audit:** round 4, status `tech_debt` — no blockers, Nyquist fully compliant
**Known deferred items at close:** 13 (see STATE.md → Deferred Items)

**Delivered:** the plugin's tool surface no longer requires a custom, non-upstream
VICE fork. A second, project-selectable backend drives stock upstream VICE through
its binary monitor, and the two backends are honest with the user about the three
capabilities stock provably cannot have.

**Key accomplishments:**

- **Corrected the protocol ground truth before building on it.** Fixed four verified
  factual errors and a 3-to-5 unsolicited-event undercount across the normative
  documents, then extended the binary-monitor probe from 6 to 13 checks and ran it
  against both a genuine stock VICE 3.9 and the fork's 3.10 — resolving all five
  UNVERIFIED items with recorded evidence rather than inference.

- **Built a correctly-demultiplexed stock backend connection.** Request-id-first
  demux with a duplicate-reply ring and socket-lifecycle rejection distinguishable
  from timeout, so the five unsolicited event types (two of which share a response
  type with a legitimate command reply) can never resolve a pending request. Backed
  by broker-enforced `monitor_claim`/`monitor_release`, which refuses a conflicting
  claim *by name* before a second binmon `connect()` — the one that would otherwise
  be indistinguishable from a wedge — is ever attempted.

- **Ported every 1:1 tool and built the ten the skills need that stock lacks.**
  38 tools now ship on the stock manifest against the fork's 62: memory, registers,
  checkpoints, execution and machine control direct on the wire; plus a client-side
  6510 disassembler whose output reassembles through a real ACME 0.97 to exactly the
  original bytes across all 256 opcodes, memory search/compare, a symbol store, and
  VIC-II/CIA/sprite state decoders that report six internal-only fields as
  `{available:false, reason}` instead of a plausible-looking zero.

- **Made unavailable capabilities fail honestly instead of silently wrong.** A
  26-entry capability registry, wired strictly after `DENY_LIST`, answers a call to
  an unadvertised tool by naming the capability, the reason, and which backend
  provides it. The three proven-unrecoverable tools (`vice_sid_get_state`,
  `vice_keyboard_matrix`, `vice_keyboard_restore`) are named at their point of use in
  the playbooks, and `docs/tool-support.md` is generated from both manifests with a
  byte-identity drift guard rather than maintained by hand.

- **Cut 17 requirements against a single measured test**, not a judgment call: does a
  shipped skill call this tool, or does something a skill calls depend on it?
  Measured by diffing the six skills' actual `vice_*` usage against both manifests.
  Phase 6 was removed wholesale. Each cut names its requirements, which stay in the
  archive marked `CUT` with rationale.

- **Proved the finish line end-to-end, after it failed once.** Phase 8.1 ran the
  install-to-RAM-capture walkthrough that had only ever been claimed — and it
  falsified the claim, exposing a real defect (stock `x64sc` boots with
  `Drive8Type=0`, unfixable by any MCP tool). Phase 8.2 fixed the launch argv, and
  the re-run reached a verified 65536-byte capture against a broker-launched genuine
  `/usr/bin/x64sc`.

**Archived:**

- [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
- [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
- [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md) (round 4, plus rounds 1-3 verbatim)

---
