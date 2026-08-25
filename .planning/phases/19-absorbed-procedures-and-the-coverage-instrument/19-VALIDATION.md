---
phase: 19
slug: absorbed-procedures-and-the-coverage-instrument
status: complete
nyquist_compliant: true
created: 2026-08-24
closed: 2026-08-24
closed_by: 19-09
extended: 2026-08-25
---

# Phase 19 Validation Record

Every row below names a command that **actually ran** during this phase, the file it ran
against, and the result that was observed. No row is supported by prose alone, and there
are no placeholders. The draft strategy this file replaced named intentions; this one
names executions.

## Requirement → executed evidence

| Requirement | Plan(s) | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| ABS-01 | 19-01, 19-02 | `node scripts/check-skill-tool-coverage.mjs` | `src/skills/` (33 files, 7 directories) | exit 0 — 17 distinct `r2000_*` names extracted, **all curated**; 8/8 r2000 CLI verbs resolved |
| ABS-01 | 19-01, 19-02 | `node --experimental-strip-types --test skill-attribution.test.ts` | `src/skills/`, `upstream-procedure-manifest.json` | exit 0, 8/8 pass — no file under `src/skills/` names an upstream `.agent/skills` path; registry length **and** path set equal `manifest.procedures`; deleting the `r2000-analyze-basic` row demonstrated exit 1 ("the registry has 4 rows but the manifest lists 5 procedures"), then restored |
| ABS-01 | 19-02 | `grep -ro` per omitted upstream call over `src/skills/` | `src/skills/` | 0 hits each for `r2000_toggle_splitter`, `r2000_undo`, `r2000_set_immediate_format`, `r2000_unpack_binary`, `r2000_get_disassembly_cursor` — no absorbed step calls a tool this project does not expose |
| ABS-02 | 19-01, 19-02 | `node --experimental-strip-types --test skill-attribution.test.ts` | five per-file attribution blocks vs. the manifest | exit 0 — per-row six-field presence, header-vs-manifest **commit and digest equality**, adaptation statement present; `attributionBlockFor()` resolves each registry row to exactly ONE block (zero or two both fail) |
| ABS-02 | 19-01, 19-02 | `node scripts/check-npm-packages.mjs` | both packed tarballs (`npm pack --dry-run --json`) | exit 0 — `@henols/vice-mcp` 75 files, `@henols/c64-re-tools` 34 files / 7 skills; the installer notices file asserted present **in the packed file list**, not at a repo path; removing its `files[]` entry demonstrated exit 1, then restored |
| ABS-03 | 19-05 | `node scripts/check-skill-description-overlap.mjs` | all seven `src/skills/*/SKILL.md` | exit 0 — **7 skills scanned, 21 pairs compared** (n·(n−1)/2 for n=7), observed maximum **0.250** (`c64-program-recon :: c64-provenance-diff`), threshold **0.35** inclusive, **allowlist size 0**, CLAUDE.md table 7 rows byte-identical |
| ABS-03 | 19-05 | `node --experimental-strip-types --test skill-description-overlap.test.ts` | `scripts/lib/skill-descriptions.mjs` + the real corpus | exit 0, **32/32 pass** — exact-duplicate positive control, stop-list negative control, the two real near-threshold pairs as a false-positive control, inclusive-threshold boundary, one-token rule, stable ordering, stale-allowlist detection, every normalisation step pinned individually, live-execution control |
| ABS-04 | 19-01, 19-05 | `node --experimental-strip-types --test r2000-upstream-audit.test.ts` | `upstream-procedure-manifest.json` | exit 0, 4 pass / 1 skipped (clone-gated) — manifest pin is a full 40-hex SHA and `resync_triggers` present; abbreviating the commit to 7 chars demonstrated exit 1, then restored |
| ABS-04 | 19-01 | `R2000_UPSTREAM_CLONE=… VICE_REQUIRE_R2000_UPSTREAM=1 node --experimental-strip-types --test r2000-upstream-audit.test.ts` | clone at `493f840418f1450a342bb220c2fe3d2585dd0525` | exit 0, **5/5 pass, 0 skipped** — all five upstream digests re-hashed byte-exact; with a nonexistent clone under the same opt-in, exit 1 (the live gate cannot pass vacuously) |
| ABS-04 | 19-05 | `grep -Ec '^\|? *(Reversal\|Re-sync\|Reopen)' 19-DECISIONS.md` | `19-DECISIONS.md` | **5** — one named, checkable condition per decision, none of them "if it turns out to be wrong" |
| COV-01 | 19-03 | `node --experimental-strip-types --test r2000-coverage.test.ts` | six committed synthetic fixtures + the Phase 11 fixture | exit 0 — top-level key set exactly the pinned set with its schema version; **no key anywhere in the report matches a combined-figure vocabulary**; census independence proven (a mass block-type rewrite moves zero census bytes, only the divergence sub-report) |
| COV-01 | 19-04 | `node src/mcp/vice/vice-proxy.ts r2000 coverage <project>` | `11-…/evidence/criterion1/recon-subject.regen2000proj` (a fixture authored for another phase, never used to write the instrument's rules) | exit 0 — origin `$0810`, 100 bytes, **the four census classes sum to 100 of 100**; three measures printed separately (87 reached-as-instruction; 4 user / 6 auto → 0.400; sampled 5, agreed 3 → 0.600) plus comment vacuity, the dispatch scan and the divergence sub-report; **no aggregate figure at the point of display** |
| COV-02 | 19-03 | `node --experimental-strip-types --test r2000-coverage.test.ts` | `fixtures/coverage/nc1…nc5` | exit 0 — five planted defects each caught by a **named** measure (all-auto labels, auto-renamed-in-place, generic comments, all-data blocks, multi-caller unnamed), and `nc5-well-documented` comes back clean as the both-directions control |
| SURF-03 | 19-04 | `node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs` | `packer-finding.mjs` | exit 0 — three-valued verdict with a structurally enforced hard unknown (one assignment site for the name, one for high confidence, asserted at source level); the oracle route **skips visibly with a stated reason** because `unp64` is absent, and fails hard under `VICE_REQUIRE_UNP64` |
| SURF-03 | 19-04, 19-05 | `command -v unp64` | this machine | **absent** — closure is on a NEGATIVE result, stated as one; see 19-DECISIONS.md decision 3 for the acceptance bar and its reopen trigger |

## Gap-closure run → executed evidence (2026-08-24 / 2026-08-25, plans 19-06 … 19-09)

`19-VERIFICATION.md` reopened this phase with two gaps. The rows below are the executed
evidence from the four gap-closure plans that answered them. Same five-column shape as the
table above; **no row above was altered, deleted or renumbered** — this section is an
extension, and every command below appears verbatim in a 19-06 / 19-07 / 19-08 / 19-09
SUMMARY with the result that was actually observed there.

| Requirement | Plan(s) | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| ABS-02 | 19-07 | `sha256sum` over the extracted fenced notice block | the `## Upstream MIT permission notice` block in all three `THIRD-PARTY-NOTICES.md` files | **all three** `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b`, 1072 bytes — equal to the upstream `LICENSE-MIT` at `493f840418f1450a342bb220c2fe3d2585dd0525`, so MIT's inclusion condition is discharged **by artifact**, not asserted about |
| ABS-02 | 19-07 | `cd src/mcp/vice && node --test skill-attribution.test.ts` | the three notices files + in-memory planted strings | **12 pass, 0 fail** (8 → 12). Planted violation, one word altered (`sublicense` → `sublicence`) in a **disposable `git archive` shadow tree**, observed red: `the reproduced permission notice is 1072 bytes with sha256 9eaac7c42f31963e90443de0cfb3d80a35c06188f3dd48892e0d3d1c72ea1ed4, expected 1072 bytes with sha256 e2579ce7…4973b`. The byte count is unchanged at 1072 — the digest is what catches it |
| ABS-02 | 19-07 | `node scripts/check-npm-packages.mjs` | both packed tarballs, shadow tree with the whole notice section deleted | **exit 0** on the real tree; **exit 1** in the shadow — `installer/THIRD-PARTY-NOTICES.md is packed but does not reproduce the upstream MIT permission notice`. The `files[]` presence assertion still passed on that same run, which is precisely the blind spot the content check closes |
| COV-02 | 19-06 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the committed `nc4-multi-caller-unnamed` fixture, at report level | **Pre-fix** `reproducibility.multiCallerUndocumented` = `{count: 0, addresses: []}` with `coverageFindings().clean` = `true` and an **empty findings array** — a fully clean verdict on a comment that names neither caller. **Post-fix** `{count: 1, addresses: [2080]}`, non-clean, one finding naming `reproducibility`. 46 pass, 0 fail |
| COV-02 | 19-08 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the `ORDINARY_INDEXED_COPY` / `ORDINARY_IMMEDIATE_COPY` scan-level pair | **Pre-fix** the indexed variant reported `reached=55` / `unreached=9` with `splitTables=1` and `discovered=8`, against the immediate twin's `reached=7` / `unreached=57` — an 8× inflation of the headline structural measure manufactured out of 57 bytes of ordinary data. **Post-fix both report 7.** 51 pass, 0 fail |
| COV-01 | 19-08 | `node src/mcp/vice/vice-proxy.ts r2000 coverage src/mcp/vice/fixtures/coverage/nc5-well-documented/project.regen2000proj` | the committed `nc5` fixture, after `COVERAGE_SCHEMA_VERSION` 1 → 2 | **exit 0** — prints `schema version 2`, `MEASURE 1 of 3`, `MEASURE 2 of 3`, `MEASURE 3 of 3`, and **no combined figure**. The CLI survived the schema change unmodified. *(Green run only — see the Nyquist note below.)* |
| COV-02 | 19-09 | `cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs && node fixtures/coverage/make-coverage-fixtures.mjs && test -z "$(git status --porcelain fixtures/coverage)"` | the eight committed control fixtures, post-commit | `make-coverage-fixtures: wrote 8 control fixtures` on **both** runs and the porcelain output **empty** — the generator's own stated determinism contract, and 19-REVIEW.md IN-02's concern, both discharged by measurement |
| COV-02 | 19-09 | `node fixtures/coverage/make-coverage-fixtures.mjs` with a planted invariant violation | `INDEXED_COPY_LOOP` / `IMMEDIATE_COPY_LOOP` | **Two demonstrated throws.** One byte deleted from the immediate payload: `the false-positive pair must be EQUAL IN LENGTH -- INDEXED_COPY_LOOP is 64 bytes and IMMEDIATE_COPY_LOOP is 63 …`. One DATA byte changed in only one payload: `the false-positive pair must be BYTE-IDENTICAL from offset 7 onward -- they differ at offset 7 ($817) …`. Both restored and the generator re-run green |
| COV-02 | 19-09 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the committed `fp1-indexed-copy-loop` / `fp1b-immediate-copy-loop` pair, through `buildCoverageReport()` | **Post-fix** both report `structural.reachedAsInstruction` = **7** against the `code_size` = 7 their own stores declare; the indexed fixture carries exactly **one** advisory `dispatch.splitTableCandidates` entry with `orientationResolved: false` and no targets, its twin **zero**, and `provenDispatchTargets()` returns `[]` for both. 55 pass, 0 fail. **Observed RED first** against a pre-19-08 `git archive 1706d8b^` shadow tree carrying a recorded null-hypothesis shim: `55 !== 7` (`actual: 55`, `expected: 7`), with the pre-gate report reading `reached=55 / unreached=9 / splitTables=1 / discovered=8 / tableEntryAddresses=34` for the indexed fixture and `reached=7 / unreached=57 / splitTables=0` for its twin |
| COV-01, COV-02 | 19-09 | `cd src/mcp/vice && npm test` (the FULL suite, never `test:automated`) | the whole `src/mcp/vice` suite | exit **0** — `# tests 2564`, `# pass 2519`, **`# fail 0`**, 40 skipped, 5 todo. Exactly `+4 / +4` against the wave-2 boundary measurement of 2560 / 2515 / 0 — the delta this plan authored, with nothing attributed to pre-existing breakage because there was none |

### Requirement status after this run — verified, not asserted

`REQUIREMENTS.md` was **read and not written** by 19-09. Observed at 2026-08-25:

| Observation | Line | State |
|---|---|---|
| COV-02 checkbox | `.planning/REQUIREMENTS.md:59` | `- [ ] **COV-02**: …` — **still unchecked** |
| Phase 19 status-table rows | `.planning/REQUIREMENTS.md:129-135` | six of seven read `Gaps Found` (SURF-03, ABS-01, ABS-03, ABS-04, COV-01, COV-02). **ABS-02 at line 131 reads `Complete`** — see the known-gap row below |

Re-checking a requirement box is **re-verification's** entitlement, never the entitlement of
the plan that did the fixing. 19-08 reverted its own automatic
`requirements.mark-complete COV-01 COV-02` for exactly this reason, and 19-09 did not run the
step at all.

## Second gap-closure run → executed evidence (2026-08-25, plans 19-14, 19-10, 19-11, 19-12, 19-13)

`19-VERIFICATION.md` reopened this phase a second time with two gaps: the class-3 dispatch gate's
residual (`CR-04`) plus four newly-raised findings, and a red workspace suite left by the phase's
own artifacts. The rows below are the executed evidence from the five plans that answered them,
in wave order. Same five-column shape as the two tables above; **no row above was altered,
deleted or renumbered** — this section is an extension, and every command below appears verbatim
in a 19-10 / 19-11 / 19-12 / 19-14 SUMMARY with the result that was actually observed there.

| Requirement | Plan(s) | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-02 | 19-14 | `cd src/mcp/vice && node --test docs-review-disposition.test.ts` | `19-REVIEW.md`'s derived id set against the guard's five disposition sources | **Pre-write** `# tests 7`, `# pass 6`, **`# fail 1`**, exit 1 — `finding(s) with no disposition anywhere … 19-REVIEW.md (19-absorbed-procedures-and-the-coverage-instrument): CR-02`, one id and one phase. **Post-write** `# tests 7`, `# pass 7`, **`# fail 0`**, exit 0. The change was a new file in the guard's source 3, never an edit to `19-REVIEW.md` |
| COV-02 | 19-14 | `node --test {docs-review-disposition,docs-core-value-decision,docs-dangling-refs,docs-deferred-ledger,docs-fork-decision,docs-linerefs,docs-r2000-decisions}.test.ts` — seven separate standalone runs | the seven guards D-12-02's failure message names | **all seven exit 0** (7/7, 6/6, 8/8, 6/6, 6/6, 3/3, 5/5). The six-of-seven cascade claim is measured rather than inherited from `19-VERIFICATION.md`'s three-of-six spot-check; `audit-integrity.test.ts` standalone then exits 0 at `# tests 44 # pass 44 # fail 0` |
| COV-02 | 19-10 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `fp2-zeropage-data-pointer`, the dispatch gate's first INTERIOR control, through the shipped `buildCoverageReport()` | `# tests 64 / # pass 64 / # fail 0`. **Observed RED against the unfixed gate first**, all five assertions: `splitTables.length` **1 → 0**; `provenDispatchTargets()` **eight values (`$840`…`$847`) → `[]`**; `tableEntryAddresses.length` **16 → 0**; `classAt($0840)` **`"reached-as-instruction"` → `"unreached"`**; `structural.reachedAsInstruction` **33 → 17** against a declared `code_size` of 17. Supporting census, same run: pre-fix `tableEntry=16 / referencedAsData=0 / unreached=15 / splitTableCandidates=0`, post-fix `0 / 2 / 45 / 1` |
| COV-01 | 19-10 | `cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs (twice) && test -z "$(git status --porcelain fixtures/coverage)"` | the ten committed control fixtures, after the FP2 pair was added to the generator | porcelain **empty** on both runs — the determinism contract still holds after two plans added fixtures. Two generator-invariant throws demonstrated and restored: `ZEROPAGE_DATA_POINTER must be exactly 64 bytes, got 63` (one prologue byte removed) and `assertDispatchesNowhere()` on any `$6c`/`$48` byte |
| COV-01, COV-02 | 19-10 | `cd src/mcp/vice && npm test` (FULL suite, not `test:automated`) | the whole `src/mcp/vice` suite | exit 0 — `# tests 2573 / # suites 24 / # pass 2528 / # fail 0 / # skipped 40 / # todo 5` |
| COV-02 | 19-11 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the class-4 negative controls, the rebuilt `STACK_RETURN` fixture, and the WR-15 two-payload comparison | `# tests 69 / # pass 69 / # fail 0` (66 before this plan). The class-4 scan now satisfies the two class-3 conditions it never did — same-index-register match and a decodable in-image entry point — through `isPlausibleEntryPoint()`, one predicate shared by both halves of the seam rather than two copies |
| COV-01, COV-02 | 19-11 | `cd src/mcp/vice && npm test` (FULL suite, not `test:automated`) | the whole `src/mcp/vice` suite | `# tests 2578 / # suites 24 / # pass 2533 / # fail 0 / # skipped 40 / # todo 5`. A first run of the same command reported `# fail 1` on `r2000-session.test.ts`'s 200 ms wall-clock stub test, which passed 25/25 standalone — logged as `deferred-items.md` item 3 rather than absorbed |
| COV-02 | 19-12 | `node --test r2000-coverage.test.ts` | the WR-13 citation controls and the extended out-of-16-bit-space test | `# tests 71 / # pass 71 / # fail 0`. `citesCallerByName()` now demands a reference not a coincidence, with `CALLER_CITATION_WORDS` frozen; `nc5-well-documented` stays clean with an empty findings array and `nc4-multi-caller-unnamed` is still caught by `reproducibility` **by name** |
| COV-01, COV-02 | 19-12 | `npm test` (FULL suite, serial schedule) | the whole `src/mcp/vice` suite | **`# tests 2580 / # pass 2535 / # fail 0`**. On the parallel schedule the same command reported `# fail 1` — deferred item 3 again, the same 200 ms stub test |
| COV-02 | 19-12 | `node fixtures/coverage/make-coverage-fixtures.mjs` ×2 → `git status --porcelain src/mcp/vice/fixtures/coverage` | the ten committed control fixtures | **empty** — and `git diff src/mcp/vice/fixtures/` is empty across both of this plan's commits, so no fixture and no expected verdict was moved to accommodate the tightening |

### Measured in this run that the first gap-closure run did not measure

Three things the first run could not have recorded, each with the command that produced it.

**1. The dispatch gate's interior.** Before 19-10 the gate had no interior control at all: FP1/FP1b
carry no zero-page store, and `SPLIT_TABLE` carries a real `jmp ($00fb)`, so all three bracket the
predicate from the *outside*. `fp2-zeropage-data-pointer` satisfies every pre-fix sufficient
condition while dispatching nowhere. Its pre-fix and post-fix values are the five-row table above.
The immediate twin `fp2b-immediate-data-pointer` makes that baseline **measured rather than
remembered** — byte-identical from offset 17 onward, asserted over the *committed* bytes via
`payloadOf()` rather than over the generator's constants.

**2. The class-4 negative controls, which did not exist.** Recorded by 19-11 against the shipped
code at `cdf60bc` before any fix: `STACK_RETURN_MIXED_REGISTERS` (`lda $c010,x : pha : lda $c013,y :
pha : rts`, two tables walked by two different registers) and the implausible-target payload both
reached `provenDispatchTargets()` pre-fix and both are declined post-fix, each carrying a
`GATE_INTERIOR_DECLARATIONS` row stating its position **and** its polarity, mechanically checked in
both directions. The `STACK_RETURN` positive fixture was also rebuilt: it had been naming the
mid-instruction address `$c006` as an entry point, which is not an entry point.

**3. The full-suite line, and the one test that is load-sensitive.** Full-suite runs across this
run: `# tests 2573 / # pass 2528 / # fail 0` (19-10), `2578 / 2533 / 0` (19-11), `2580 / 2535 / 0`
(19-12, serial schedule). Two of the five full-suite runs on 2026-08-25 reported `# fail 1` on
`r2000-session.test.ts:616`'s stub test, which drives a real spawned child against a **200 ms**
wall-clock budget (`:622`) while `node --test` runs test files concurrently across 12 cores. It has
never been observed red standalone — 25/25 on every run, including three consecutive runs by 19-13.
Recorded as `deferred-items.md` item 3 with its owner, not absorbed.

### Second gap-closure phase gate — run at close, 2026-08-25 (plan 19-13)

Every row is an exit code that was observed, from the repository at `88d7de4`. The full suite is
`npm test` = `node --test '*.test.*'`; `npm run test:automated` is **never** the evidence here
because it is `node test-gate.mjs`, which runs every `*.test.*` on disk **minus** the nine frozen
`MANUAL_ONLY_TESTS` entries (`vice-broker-launch`, `vice-proxy`, `broker-e2e`, `stock-live`,
`stock-live-triage`, `stock-live-broker-monitor`, `stock-broker-live`, `fork-live`,
`stock-a4-checkpoint-flood`) — a subset that would hide a CI failure in any of them.

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | vice suite (FULL) | `cd src/mcp/vice && npm test` | **exit 0** — `# tests 2580`, `# suites 24`, `# pass 2535`, **`# fail 0`**, `# skipped 40`, `# todo 5`, `# duration_ms 102561.052051` |
| 2 | AUDIT-01 guard, standalone | `cd src/mcp/vice && node --test docs-review-disposition.test.ts` | **exit 0** — 7 tests / 7 pass / 0 fail |
| 3 | D-12-02 cascade, standalone | `cd src/mcp/vice && node --test audit-integrity.test.ts` | **exit 0** — 44 tests / 44 pass / 0 fail. Observed independently of the aggregate run, so the cascade is demonstrated resolved rather than inferred |
| 4 | Typecheck | `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | **exit 0** |
| 5 | Package contents | `node scripts/check-npm-packages.mjs` | **exit 0** |
| 6 | Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | **exit 0** |
| 7 | Description overlap | `node scripts/check-skill-description-overlap.mjs` | **exit 0** |
| 8 | Fixture determinism | `cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs` ×2 | `wrote 10 control fixtures` on **both** runs; `git status --porcelain fixtures/coverage` **empty**. Directory count **10**, equal to the pinned `COMMITTED_CONTROL_FIXTURES = 10` |
| 9 | Seven-guard cascade census | `node --test <guard>.test.ts` for each of the seven guards D-12-02 names | **all seven exit 0** — `docs-review-disposition` 7/7, `docs-core-value-decision` 6/6, `docs-dangling-refs` 8/8, `docs-deferred-ledger` 6/6, `docs-fork-decision` 6/6, `docs-linerefs` 3/3, `docs-r2000-decisions` 5/5. **Zero of seven genuinely red** |

**`REQUIREMENTS.md` was read and not written.** Observed at 2026-08-25 after every gate above:

| Observation | Line | State |
|---|---|---|
| COV-01 checkbox | `.planning/REQUIREMENTS.md:57` | `- [ ] **COV-01**: …` — **still unchecked** |
| COV-02 checkbox | `.planning/REQUIREMENTS.md:59` | `- [ ] **COV-02**: …` — **still unchecked** |
| COV-01 status row | `.planning/REQUIREMENTS.md:134` | `\| COV-01 \| Phase 19 \| Gaps Found \|` |
| COV-02 status row | `.planning/REQUIREMENTS.md:135` | `\| COV-02 \| Phase 19 \| Gaps Found \|` |
| Working tree | — | `git status --porcelain .planning/REQUIREMENTS.md` **empty** |

19-13 declares `requirements: [COV-02, COV-01]`, so the execute-plan workflow's own
`requirements.mark-complete` step would have ticked both. It was **deliberately not run** — the box
is earned by re-verification, never by the run that fixed the defect, and a self-ticked box poisons
every later judgement built on it. 19-08 reverted its own automatic mark-complete for the same
reason and 19-09 did not run the step at all; this makes three consecutive plans declining it.

**The release hold still stands.** 19-07's checkpoint selected
`approve-wording-release-on-reverification`, and the named condition that lifts `[skip release]` is,
verbatim: *"Phase 19 re-verification returns no gaps."* This run does **not** satisfy it — no
re-verification has been performed, and a green suite is not a re-verification. Every commit in this
plan carries `[skip release]`.

## The inherited concurrency deferral (D18-16) — closed by measurement

| Item | Command that ran | Ran against | Observed result |
|---|---|---|---|
| D18-16 reader-writer deferral | `node .planning/phases/19-…/evidence/measure-stdio-multiplexing.mjs` | the installed `regenerator2000 0.9.20` binary | **3 runs, all `serial-one-request-at-a-time`** — recorded with command sequence, run table and raw JSON in `19-STDIO-MULTIPLEXING-EVIDENCE.md`; negative control `R2000_BIN=/nonexistent-binary` exits 1 with a non-empty reason |
| D18-16 source corroboration | source read at the pin | `crates/regenerator2000-core/src/mcp/stdio.rs:67-98` | `run_headless_stdio_loop` calls `handle_request` synchronously on `&mut AppState`, spawning nothing — two independent methods, one answer |

Outcome: **CLOSED, not re-deferred.** A reader-writer upgrade would buy zero parallelism;
the coarse FIFO mutex is an exact model of the child's own behaviour. Recorded as
19-DECISIONS.md decision 5, with the condition that would reopen it.

## Planted-violation demonstrations performed this phase

A guard is worth exactly what its non-vacuity proof showed. Every demonstration below was
run red, then restored, and re-run green.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 1 | `check-skill-description-overlap.mjs` | one skill's `description:` copied verbatim over another's (`acme-build` → `c64-ram-capture`) | exit 1, naming **both** skills and the colliding clause, score 1.000, flagged IDENTICAL | exit 0 |
| 2 | `skill-description-overlap.test.ts` | synthetic exact-duplicate pair | score 1.0, reported | — |
| 3 | `skill-description-overlap.test.ts` | synthetic **stale** allowlist entry covering no live collision | reported stale | — |
| 4 | `skill-description-overlap.test.ts` | one changed character in the CLAUDE.md copy | reported `text-differs`; a missing row and a stale row both reported too | — |
| 5 | `skill-description-overlap.test.ts` | a synthetic map with one skill removed | pairs-compared equality fires (demonstrated on a synthetic map, never on the real tree) | — |
| 6 | `skill-attribution.test.ts` (19-02) | `r2000-analyze-basic` registry row deleted | exit 1 — "the registry has 4 rows but the manifest lists 5 procedures" | exit 0 |
| 7 | `skill-attribution.test.ts` (19-01) | `ABSORBED_FILES` emptied | exit non-zero | exit 0 |
| 8 | `skill-attribution.test.ts` (19-02) | a BASIC trigger phrase planted into a description (held in memory, never written to `src/skills/`) | the FUT-01 predicate bites | — |
| 9 | `r2000-upstream-audit.test.ts` (19-01) | manifest commit abbreviated to 7 chars | exit non-zero | exit 0 |
| 10 | `r2000-upstream-audit.test.ts` (19-01) | `VICE_REQUIRE_R2000_UPSTREAM=1` with a nonexistent clone | exit 1 — the live gate cannot pass vacuously | 5/5 pass with the real clone |
| 11 | `check-npm-packages.mjs` (19-02) | installer `files[]` entry for `THIRD-PARTY-NOTICES.md` removed | exit 1 — "installer: missing THIRD-PARTY-NOTICES.md -- ABS-02 …" | exit 0 |
| 12 | `r2000-verb-coverage.test.ts` (19-04) | an 8th, genuinely new dispatch case | parsed and reported missing, while a real documented verb is not | — |
| 13 | `r2000-coverage.test.ts` (19-03) | every block entry rewritten to one type | **zero** census bytes move; only the divergence sub-report does | — |
| 14 | `r2000-coverage.test.ts` (19-03) | seed set removed | reached count collapses — a census that barely responded to its seeds would fail here | — |

## Phase gate — run at close, 2026-08-24

All seven CI-gating steps, each actually executed and its real output read.

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | Typecheck | `cd src/mcp/vice && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **exit 0** |
| 2 | vice suite (FULL) | `cd src/mcp/vice && npm test` | **2547 tests, 2502 pass, 0 fail, 40 skipped, 5 todo** |
| 3 | Smoke | `cd src/mcp/vice && npm run smoke` | **exit 0** — `smoke: OK -- initialize + tools/list handshake completed (server vice, 80 tool(s) advertised)` |
| 4 | Skill-script suite | `node --test 'src/skills/*/scripts/*.test.mjs'` | **114 tests, 105 pass, 0 fail, 9 skipped** |
| 5 | Package contents | `node scripts/check-npm-packages.mjs` | **exit 0** — `check-npm-packages: OK` |
| 6a | Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | **exit 0** — `check-skill-tool-coverage: OK` |
| 6b | Skill fork honesty | `node scripts/check-skill-fork-honesty.mjs` | **exit 0** — `check-skill-fork-honesty: OK` |
| 6c | Description overlap (new, ABS-03) | `node scripts/check-skill-description-overlap.mjs` | **exit 0** — `check-skill-description-overlap: OK` |
| 7 | Live coverage run | `node src/mcp/vice/vice-proxy.ts r2000 coverage <Phase 11 fixture>` | **exit 0**, full report captured in 19-05-SUMMARY.md |

Gate 2 is the **FULL** suite (`npm test` → `node --test '*.test.*'`), never
`test:automated`, which skips the `MANUAL_ONLY_TESTS` list — that subset is how a red suite
reads green (19-RESEARCH.md Pitfall 10). Gate 6c is new in 19-05 and was added to
`.github/workflows/ci.yml` as a **blocking** step in the same commit that created it, and is
held there by `ci-guardrails.test.mjs`'s frozen guard-script list — a guard script CI does
not run is a file, not a control.

### Pre-existing failure baseline

The plan required the baseline to be measured against the pre-phase commit rather than
assumed, so only the difference is attributed to this phase.

| Measurement | Where | Result |
|---|---|---|
| Pre-phase, in a detached worktree at `a352500` (the commit before `f59459c`, this phase's first) | `/tmp/…/c64-baseline/src/mcp/vice` with a symlinked `node_modules` | 2460 tests, 2409 pass, **7 fail**, 39 skipped, 5 todo |
| Post-phase, in the real checkout | `src/mcp/vice` | 2547 tests, 2502 pass, **0 fail**, 40 skipped, 5 todo |

**The 7 worktree failures are an artefact of the measurement location, not a baseline.**
All seven are host-path / workspace-translation / build-staging tests
(`resolveStagingParent()`, `.build-tmp-*`, `containerpath.ts` host-root derivation, lexical
`..` translation, the containerize safety net, and the incident-record-on-disk check). They
fail because the harness ran them from `/tmp/…/c64-baseline` against a **symlinked**
`node_modules` — exactly the inputs those tests assert about. Every one of them passes in
the real checkout, in the post-phase run above, at 0 fail overall.

The honest conclusion is therefore the simple one: **the suite is green, and there is no
pre-existing-failure baseline to net out.** The orchestrator's own clean-tree measurements
agree — 0 fail before 19-01, 0 fail after Wave 3, 0 fail now. A relocated-checkout run is
not a valid baseline for a repository whose tests deliberately assert about where the
checkout is, and it is recorded here as an attempted measurement with its confound named
rather than quietly dropped or, worse, reported as seven inherited failures this phase did
not cause.

## Known gaps and carried judgment

| Item | Status |
|---|---|
| MIT licence election published in two npm tarballs | **HUMAN JUDGMENT.** Mechanically proven present and manifest-agreeing; whether these are the right terms to publish is a legal call, not a test outcome. Flagged by 19-01 (D3), 19-02 (D5) and 19-DECISIONS.md decision 4, and carried to the phase verifier rather than closed silently. |
| Coverage report schema shape (`flat-three`) | Chosen at a `checkpoint:decision` **auto-selected under `yolo` mode and never shown to a human**. The schema is pinned (`COVERAGE_SCHEMA_VERSION`, key-set test) so a silent rename fails, but the choice of shape is unreviewed. Recorded in 19-DECISIONS.md so Phase 20's first use is the moment to confirm or revise it. |
| `unp64` stdout shape | Recorded as an **assumption, not a measurement** — the oracle is not installed here. The parser is defensive and the oracle-route test skips visibly rather than pretending to have run. |
| ABS-04 flagged assumption (edge-probe, `unclassified`) | The reversal-condition count is **structural** — it cannot distinguish a checkable condition from a well-formed but unfalsifiable one. Task 3's `<human-check>` is the only thing standing between the two. Left `unresolved`/`unclassified` deliberately; not auto-resolved with a backstop marker. |
| **ABS-02 marked `Complete` by the run that fixed it** (found 2026-08-25 by 19-09) | **OPEN — reported, deliberately not repaired here.** `354bbfa` (19-07's metadata commit) flipped ABS-02's checkbox to `[x]` and its status row to `Complete` via the workflow's automatic `requirements.mark-complete` step. That is the same defect `d6d3fe3` had already reverted once for the other six IDs, and the same one 19-08 caught and reverted for COV-01/COV-02. 19-09 is **read-only over `REQUIREMENTS.md`** by its own must_haves and threat mitigation (T-19G-09-03), so it records the drift rather than editing the file — an edit here would be this plan writing a status claim into the same document, which is the act the gap closure exists to stop. **Phase 19 re-verification must treat ABS-02's `Complete` as unearned and re-decide it on the evidence.** |

### Flagged assumptions carried by the gap-closure run (19-09 frontmatter, nine rows)

These are the edge-probe rows belonging to requirements this gap-closure run did **not** reopen.
Each is surfaced rather than dropped, and each names already-passing verification evidence rather
than inventing new work. Accounting: 8 authored into `must_haves.truths` across 19-06/07/08, plus
the 9 below, == 17 applicable rows.

| Requirement | Category | Status | Assumption, and the standing evidence |
|---|---|---|---|
| ABS-01 | `unclassified` | `unresolved` | The edge probe could not classify ABS-01 ("five procedures absorbed at a pinned commit, tool calls diffed, no `.agent/skills/` runtime dependency"). Left unresolved **deliberately** — not auto-resolved with a backstop marker. Standing evidence: `19-VERIFICATION.md` truth 1 (✓ VERIFIED) confirmed all five upstream sha256 digests **and** byte counts against the real repository over the network at the pin, spot-checked four manifest line-number citations as exact, and recorded `check-skill-tool-coverage.mjs` exit 0 over 17 curated `r2000_*` names with `grep -rn '\.agent/skills' src/skills/` returning 0 hits. This run does not reopen it. |
| ABS-03 | `adjacency` | `unresolved` | "When two descriptions are exactly equal or just touch, do they merge, collide, or separate?" is answered by the shipped gate rather than by new work: `skill-descriptions.mjs`'s threshold is **inclusive** at 0.35 and the boundary case is already pinned by an inclusive-threshold boundary test. Standing evidence: `19-VERIFICATION.md` truth 3 (✓ VERIFIED), 21/21 pairs, observed max 0.250, allowlist size 0. |
| ABS-03 | `empty` | `unresolved` | An empty or single-skill inventory: `skill-description-overlap.test.ts` already carries an emptied-corpus and stale-allowlist control (32/32 pass). Not reopened here. |
| ABS-03 | `ordering` | `unresolved` | Stable output order for equal-scoring pairs is already pinned by a stable-ordering test in `skill-description-overlap.test.ts`. Not reopened here. |
| ABS-04 | `unclassified` | `unresolved` | Carried forward verbatim from this file's own earlier flagged-assumption row: the reversal-condition count is **structural** and cannot distinguish a checkable condition from a well-formed but unfalsifiable one. Left unresolved / unclassified deliberately; not auto-resolved with a backstop marker. Standing evidence: `19-VERIFICATION.md` truth 5 and the artifact row for `19-DECISIONS.md` (✓ VERIFIED, five dated decisions each with a named reversal or re-sync condition, the snapshot trade's mechanism being a hash comparison against `manifest.resync_triggers`). |
| COV-01 | `encoding` | `unresolved` | "Whose definition of length/equality applies" for the coverage measures is already fixed and tested: byte counts are over the half-open range `[origin, origin + size)`, comment equality is exact string equality after a normalisation whose four steps are pinned individually, and auto-name prefix matching is ASCII case-sensitive. Standing evidence: `19-VERIFICATION.md` truth 4 clauses A and B (✓ PASS) and the normalisation tests in `r2000-coverage.test.ts`. Plan 19-08 adds a 16-bit upper bound to the range but does not change what equality means. |
| COV-01 | `concurrency` | `unresolved` | "If interrupted or run in parallel, what is guaranteed?" is answered **structurally** rather than by a concurrency test: a coverage run is read-only over a project file BY CONSTRUCTION, asserted at source level by the committed test that the module contains no `writeFileSync`, `renameSync`, `appendFileSync`, `save_project` or live-session import. Two parallel runs therefore cannot corrupt a project and an interrupted run leaves nothing partial on disk. Standing evidence: `r2000-coverage.test.ts` section 11 (✓ VERIFIED). |
| SURF-03 | `unclassified` | `unresolved` | The edge probe could not classify SURF-03 ("packer identity surfaced as a recon finding"). Left unresolved deliberately. Standing evidence: `19-VERIFICATION.md` truth 5 (✓ VERIFIED) — `PACKER_VERDICTS` frozen to exactly four, `identifiedByOracle()` structurally the only constructor that assigns `packer` and it throws on a non-string or empty name, both `spawnSync` sites passing an argument array with `shell: false`, wired into `c64-program-recon/SKILL.md:88-89`. Note: `19-REVIEW.md` WR-08 and WR-09 are open against that file and are dispositioned **DEFERRED** in 19-08's gap-closure context; they do not reopen SURF-03's verification. |
| SURF-03 | `empty` | `unresolved` | "What is the result for empty, single-element, or null input?" is already the requirement's own core property: `unknownFinding()` throws on an empty reason and `identifiedByOracle()` throws on an empty name, so an absent oracle produces a **hard unknown** rather than a guess. Standing evidence: `packer-finding.test.mjs`, 17 tests, 16 pass, 1 visible skip (the live oracle gate). |

## Nyquist compliance

Every requirement is sampled by at least one executed command **and** at least one
planted-violation demonstration proving that command can fail, rather than by a single
green run that would say nothing about whether the check discriminates. `nyquist_compliant`
is set `true` on that basis, replacing the draft's `false`.

### Re-examined after the gap-closure run (2026-08-25)

The flag was re-examined rather than left standing by default, because this file gained ten new
evidence rows after it was first set.

**Rows that carry both an executed command and a demonstrated failure** — ABS-02 / 19-07 (three
planted violations in a shadow tree: the one-word alteration, the re-wrapped forbidden claim, the
deleted notice section); COV-02 / 19-06 (both anchoring controls authored and observed red before
the fix); COV-02 / 19-08 (both dispatch controls observed red, `55 !== 7`); COV-02 / 19-09 (two
generator-invariant throws demonstrated and restored, plus the report-level census control observed
red at `55 !== 7` against a pre-19-08 shadow tree).

**Rows that are a green run only, stated as such rather than left unexamined:**

1. **COV-01 / 19-08, the live CLI run.** No planted violation was performed against the CLI. The
   requirement is not left unsampled by a failing demonstration, though — COV-01's original
   Nyquist basis is planted-violation rows 13 and 14 of the table above (mass block-type rewrite;
   seed set removed), both still passing, and `19-REVIEW.md` WR-05/WR-06/WR-07/WR-10 record that
   the coverage **CLI surface itself is untested** and are dispositioned DEFERRED in 19-08. That
   deferral is the honest statement of this row's limit.
2. **COV-02 / 19-09, the determinism check.** Idempotence has no meaningful planted violation —
   a non-deterministic generator is caught by the check itself, not by a plant. The two generator
   invariants that *can* be planted were, and are recorded above.

`nyquist_compliant` therefore stays `true`: every requirement still carries at least one executed
command **and** at least one planted-violation demonstration. The two exceptions above are
individual rows, not requirements, and both are named here rather than absorbed silently.

## Round-4 gap closure → executed evidence (2026-08-25, plan 19-15)

`19-VERIFICATION.md` reopened SC4 / COV-01 a third time, on a **different shape** in the same
function. This section is an **extension**: no row above was altered, deleted or renumbered, and
every command below was run in this working tree with the output that is quoted.

The scope of this round is the **defect class** (19-CONTEXT.md D-01/D-02), not a REVIEW finding id.
The invariant under demonstration is D-02:

> A branch of `hasDispatchContext()` may return true only on a **proven data-flow link** from the
> two reconstructed table bases to the dispatch mechanism — never on the mere presence of a shape
> within the window.

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01, COV-02 | 19-15 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the newly committed `fp3-unlinked-push-idiom` / `fp3b-immediate-push-idiom` pair, at report level through `buildCoverageReport()` | **Observed RED first**, before the predicate was touched: `not ok 60 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it`, **75 pass / 1 fail of 76**. Pre-fix the fixture reported `reachedAsInstruction=31`, `tableEntry=16`, `splitTables=1`, `tableEntryAddresses=16` and eight `provenDispatchTargets` at `$0840`…`$0847`, with `classAt($0840)="reached-as-instruction"`. **Post-fix: `reached=15` against the `code_size: 15` its own store declares, `splitTables=[]`, `provenDispatchTargets()=[]`, `tableEntryAddresses=[]`, `classAt($0840)="unreached"`, `splitTableCandidates=1`.** The twin reports `reached=15` and `splitTableCandidates=0`. **76 pass, 0 fail** |
| COV-01 | 19-15 | `cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs` twice, then `git status --porcelain fixtures/coverage` | the twelve committed control fixtures | `make-coverage-fixtures: wrote 12 control fixtures` on **both** runs and the porcelain output **empty** — the generator's determinism contract still holds across the two new fixture directories |
| COV-01 | 19-15 | `cd src/mcp/vice && npx tsc --noEmit` | the whole `src/mcp/vice` TypeScript surface | **exit 0** after the `hasDispatchContext()` signature change (`SplitOrientation`, `DispatchPairing`, the fourth `pairing` parameter, and its one class-3 call site) |
| COV-01 | 19-15 | `node scripts/check-npm-packages.mjs` | both packed tarballs | **exit 0** — `@henols/vice-mcp` 75 files, `@henols/c64-re-tools` 34 files / 7 skills. The two new fixture directories do **not** leak into either tarball |

### The gate watched FAIL — the round-4 planted violation

A gate nobody has watched fail is not known to be a gate (D-07). The branch-A tightening was
reverted **in the working tree only**, to its exact pre-fix form — presence of two `$48` bytes and
a `$60` byte anywhere in the window, ignoring the pairing entirely — and the suite re-run.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 15 | `hasDispatchContext()` branch A (`stack-return-push-idiom`), asserted at report level by `r2000-coverage.test.ts` over `fp3-unlinked-push-idiom` | branch A reverted to `sawPha >= 2 && opcode === 0x60` scanned over the whole window, ignoring the `pairing` parameter | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 76 / # pass 75 / # fail 1`. The single red is `not ok 60 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it`, failing on its FIRST assertion with `actual` `[{ at: 2064, loBase: 2096, hiBase: 2104, entries: 8, orientationResolved: true, targets: [2112…2119] }]` against `expected` `[]`. Direct measurement of the planted predicate over the same fixture: `reached=31`, `tableEntry=16`, `splitTables=1`, `tableEntryAddresses=16`, `provenDispatchTargets = $0840,$0841,$0842,$0843,$0844,$0845,$0846,$0847`, `classAt($0840)="reached-as-instruction"` | `git checkout -- src/mcp/vice/r2000-coverage.ts`, re-run: **76 pass, 0 fail**, and `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 — the demonstration left no trace in the committed source |

**The observed pre-fix numbers match the round-3 verification's own measurement exactly** —
`reachedAsInstruction=31`, `tableEntry=16`, `splitTables=1`, eight proven targets at
`$0840`…`$0847`, `classAt($0840)="reached-as-instruction"`. There is no difference to record as a
finding, and the fixture was not adjusted to reproduce a remembered number: it was generated from
the blocker payload verbatim and then measured.

**What the plant did NOT red is as informative as what it did.** Under the planted predicate the
liveness positive control and the window-edge witness both still passed. That is correct and
expected — the loose branch accepts the linked payload too, and the edge payload's `rts` sits
outside the window under either predicate. Exactly one test discriminates the two predicates, and
it is the one authored for that purpose.

### Liveness — the half a decline-everything tightening would fail

"The gate declines everything" is ruled out by measurement rather than by argument. A tightened
branch that can never return true is dead code wearing a sufficient-shape label, which is a worse
defect than the loose branch it replaced.

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01 | 19-15 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `PUSH_IDIOM_LINKED` — `lda $0830,x : pha : sta $fb : lda $0838,x : pha : sta $fc : rts`, FP3's table and target layout with the two pushes moved to each load's own successor | **PASS.** `scan.splitTables.length === 1`, `scan.stackReturnDispatch.length === 0` (class 4 declines the window, so the class-3 route is genuinely the one under test), `provenDispatchTargets(scan)` deep-equals `[$0840…$0847]`, and `census.reachedAsInstruction` **exceeds** the payload's own derived 13-byte prologue — a relation, not a pinned count. The tightened branch fires |
| COV-01 | 19-15 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `SPLIT_TABLE` and `STACK_RETURN`, the two pre-existing positive controls, re-asserted in the SAME test as the tightening | **PASS.** `scanOf(SPLIT_TABLE).splitTables.length === 1` with `$c00d` still in `provenDispatchTargets()`; `scanOf(STACK_RETURN).stackReturnDispatch.length === 1` with a non-empty proven-target set. The zero-page-vector shape and the class-4 pass both still PROVE |
| COV-01 | 19-15 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the `reachesGateInterior()` witness pair | **PASS.** `reachesGateInterior(payloadOf("fp3-unlinked-push-idiom"), $0810, "stack-return-push-idiom")` is `true` while `reachesGateInterior(PUSH_IDIOM_WINDOW_EDGE, $0810, "stack-return-push-idiom")` is `false` — FP3 is inside the class-3 route and its window-edge twin is outside it, so the interior predicate is not a machine that answers true for everything |

**Test-count movement:** 71 → 76 over this plan. `+2` report-level and liveness tests, `+1`
witness-pair test, and `+2` from the data-driven per-fixture tests that iterate the fixture
directory (10 → 12). `COMMITTED_CONTROL_FIXTURES` moved 10 → 12 with them.

## Round-4 gap closure → executed evidence (2026-08-25, plan 19-16)

The SECOND true-returning site of `hasDispatchContext()`, in the branch round 3 believed it had
fixed. This section is an **extension**: no row above was altered, deleted or renumbered, and every
command below was run in this working tree with the output that is quoted.

The invariant under demonstration is the same D-02, applied to the branch that already demanded a
consumer but went looking for one across the whole window:

> A branch of `hasDispatchContext()` may return true only on a **proven data-flow link** from the
> two reconstructed table bases to the dispatch mechanism — never on the mere presence of a shape
> within the window.

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01, COV-02 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the new in-suite pair `ZP_VECTOR_FOREIGN_JUMP` / `ZP_VECTOR_OWN_JUMP` — `lda $0830,x : sta $fb : lda $0838,x : sta $fc : sta $fd : sta $fe : jmp ($00fd)` and the same 64 bytes with the jump's operand byte changed to `$fb` | **Observed RED first**, before the predicate was touched: `not ok 62 - a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it` and `not ok 63 - the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN`, **76 pass / 2 fail of 78**. Pre-fix the two payloads were INDISTINGUISHABLE in the report — both `splitTables=1`, both `tableEntryAddresses=16`, both eight proven targets at `$0840`…`$0847`, both `reached=33`, both `classAt($0840)="reached-as-instruction"` — which is why test 63's liveness relation (`own > foreign`) failed too: `observed 33 against 33`. **Post-fix: `ZP_VECTOR_FOREIGN_JUMP` reports `splitTables=0`, `splitTableCandidates=1`, `tableEntryAddresses=0`, `provenDispatchTargets()=[]`, `reached=17` against its own derived 17-byte prologue, `classAt($0840)="unreached"`; `ZP_VECTOR_OWN_JUMP` still reports `splitTables=1`, sixteen table-entry addresses, the eight targets `$0840`…`$0847` and `reached=33`.** **78 pass, 0 fail** |
| COV-01 | 19-16 | `cd src/mcp/vice && npx tsc --noEmit` | the whole `src/mcp/vice` TypeScript surface | **exit 0** after `SplitOrientation` gained its third field `vectorLow` and both arms of `resolveSplitOrientation()`'s return were updated |
| COV-01 | 19-16 | `cd src/mcp/vice && node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts` | the three documentation guards | **27 pass, 0 fail** — no phase-number pointer and no dangling reference in the comments this plan wrote, and the two `rewriteArguments()` line citations are still exact |
| COV-01 | 19-16 | `git status --porcelain src/mcp/vice/fixtures/coverage` | the twelve committed control fixtures | **empty** — this plan commits no fixture change; both new payloads are in-suite constants |

### The gate watched FAIL — the branch-B planted violation

A gate nobody has watched fail is not known to be a gate (D-07). Branch B was reverted **in the
working tree only** to its exact pre-fix form — re-collect every zero-page store target across the
whole window, accept when any two of them differ by exactly one and the window carries an indirect
jump naming the lower — and the suite re-run.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 16 | `hasDispatchContext()` branch B (`zeropage-vector-jumped-through`), asserted at scan and census level by `r2000-coverage.test.ts` over `ZP_VECTOR_FOREIGN_JUMP` and its one-byte twin | branch B reverted to the window-wide `zpStores` collection plus the nested `b - a === 1` pair loop, ignoring `pairing.oriented.vectorLow` entirely | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 78 / # pass 76 / # fail 2`. The reds are `not ok 62` (failing on its FIRST assertion with `actual` `[{ at: 2064, loBase: 2096, hiBase: 2104, entries: 8, orientationResolved: true, targets: [2112…2119] }]` against `expected` `[]`) and `not ok 63` (`observed 33 against 33`). Direct measurement of the planted predicate over the same two payloads: **both** report `splitTables=1`, `splitTableCandidates=0`, `tableEntryAddresses=16`, `provenDispatchTargets = $0840,$0841,$0842,$0843,$0844,$0845,$0846,$0847`, `reached=33`, `classAt($0840)="reached-as-instruction"` | `git checkout -- src/mcp/vice/r2000-coverage.ts`, re-run: **78 pass, 0 fail**, and `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 — the demonstration left no trace in the committed source |

**The observed numbers exceeded what the plan anticipated, and the difference is recorded rather
than smoothed over.** The plan expected the planted predicate to promote the foreign-jump payload
to one proven split table, sixteen claimed table-entry bytes and eight proven targets, which it
did. What the plan did not state is that the planted predicate makes the declined payload and the
proven one **byte-for-byte identical in the report**: same `splitTables`, same table-entry count,
same eight targets, same census, same class at `$0840`. The one-operand-byte difference that is the
whole subject of the control had **no observable effect at all** under the old branch. That is a
stronger statement of the defect than "it over-reports", and it is why the liveness test reds under
the plant as well: the relation `own > foreign` is exactly the thing the old predicate could not
express. No payload was adjusted to reproduce a remembered figure — both were generated from one
prologue array and then measured.

### Both directions — the positive control that was actually run

A tightening whose positive control was never run is indistinguishable from one that declines
everything.

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `ZP_VECTOR_OWN_JUMP` — the declined payload with ONE operand byte changed, so the indirect jump names the vector the pairing's own two stores built | **PASS.** `splitTables.length === 1`, `provenDispatchTargets(scan)` deep-equals `[$0840…$0847]`, and `census.reachedAsInstruction` (33) **strictly exceeds** the declined payload's (17) — a relation, not a pinned count. The two payloads are asserted to differ at exactly one byte offset, `ZP_VECTOR_JUMP_OPERAND_INDEX`, so the verdict difference cannot be caused by anything else |
| COV-01 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `SPLIT_TABLE`, `SPLIT_TABLE_CLEAN` and `SPLIT_TABLE_INTERPOSED`, the three pre-existing positive controls for this branch, re-asserted in the SAME test as the tightening | **PASS.** All three still report `splitTables.length === 1`. `SPLIT_TABLE_INTERPOSED` is the sharpest of the three: its orientation resolves across an interposed load through the other index register, and the vector its own two stores build is still the one the jump names |
| COV-02 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `fp2-zeropage-data-pointer`, the CR-04 interior control, re-asserted in the same test | **PASS.** Still `dispatch.splitTables === []` — a vector that is built and then read through as DATA is still declined, and the tightening did not disturb the condition round 2 added |

### D-02 turned from a sentence into an assertion — the pairing-consultation pin

Until this plan, D-02 existed only as prose in plan objectives and `must_haves`. Every other guard
this round builds is satisfiable by the SAME author who writes a loose branch: each one asks that
author to add a declaration, and the author adds it. The pin closes that by reading
`hasDispatchContext()`'s own body, extracting each `return true` site's DEPTH-1 GUARD CHAIN — the
outermost `if` or `for` containing the return, comments stripped — and asserting each chain names
the `pairing` parameter. A presence-only branch structurally cannot satisfy it.

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the pin, against branch A exactly as plan 19-15 committed it | **PASS.** The extraction takes the depth-1 statement, not the nearest preceding boundary: branch A's `return true` sits inside a `for` whose immediate condition reads only `insns[k]!.opcode === 0x60`, and the `pairing` reference lives in the enclosing `if`. Chain extracted verbatim: `if (insns[pairing.firstIndex + 1]?.opcode === 0x48 && insns[pairing.secondIndex + 1]?.opcode === 0x48) { for (let k = pairing.secondIndex + 2; k < end; k++) { if (insns[k]!.opcode === 0x60)`. Branch B's chain: `if (indirectJumpPointers.includes(pairing.oriented.vectorLow))` |
| COV-01 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the pin's two non-vacuity guards | **PASS.** The extracted site count is asserted non-zero AND asserted equal to `DISPATCH_CONTEXT_SHAPES.length` (2), so a site the extraction misses cannot hide behind a passing pin |
| COV-01 | 19-16 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `functionBodyFromSource()`'s own failure mode, asked for a deliberately absent signature | **PASS.** It THROWS with the signature in the message. The helper never returns a bare empty string, so no pin built on it — including the four plan 19-18 adds — can pass vacuously over a renamed function |

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 17 | the pairing-consultation pin, against the FIRST true-returning site | branch A (`stack-return-push-idiom`) reverted in the working tree to its presence-only form — `let sawPha = 0; for (let k = start; ...) { if (opcode === 0x48) sawPha++; if (opcode === 0x60 && sawPha >= 2) return true; }` | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 80 / # pass 78 / # fail 2`. The reds are `not ok 60 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context…` and `not ok 72 - EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window`. The pin's message quoted the offending chain verbatim: `for (let k = start; k < end; k++) { if (insns[k]!.opcode === 0x48) sawPha++; if (insns[k]!.opcode === 0x60 && sawPha >= 2)` | `git checkout -- src/mcp/vice/r2000-coverage.ts`, re-run: **80 pass, 0 fail** |
| 18 | the pairing-consultation pin, against the SECOND true-returning site | branch B (`zeropage-vector-jumped-through`) reverted in the working tree to its window-wide `zpStores` scan | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 80 / # pass 77 / # fail 3`. The reds are `not ok 62`, `not ok 63` and `not ok 72`. The pin's message quoted: `for (const a of zpStores) { for (const b of zpStores) { if (b - a !== 1) continue; if (indirectJumpPointers.includes(a))` | `git checkout -- src/mcp/vice/r2000-coverage.ts`, re-run: **80 pass, 0 fail**, `npx tsc --noEmit` exit 0, and `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 — neither revert survived |

**A defect in the extraction was found BY the first demonstration and fixed, not accepted.** The
first run of plant 17 red correctly but quoted the chain as `k++) { … }` — the backward scan had
treated the semicolons inside a `for (init; cond; step)` header as statement boundaries and cut the
header off. Red for the right reason, but with the wrong text, and latently worse: a CORRECT branch
written as a depth-1 `for` whose header names `pairing` would have had that name scanned away and
would have red. The scan now tracks parenthesis depth and accepts `;` as a boundary only outside
parentheses; plant 17 was re-run and quoted the full header. That is the "if the demonstration
shows nothing, fix the extraction" clause of this task discharged in the direction it was written
for.

**Test-count movement:** 76 → 80 over this plan. `+2` for the foreign-jump control and its proven
twin, `+1` for the pairing-consultation pin, `+1` for `functionBodyFromSource()`'s own throw. No
fixture directory was added, so `COMMITTED_CONTROL_FIXTURES` stays 12.

## Round-4 gap closure → executed evidence (2026-08-25, plan 19-17)

The move that ends the loop (D-06): a PROPERTY over a COMPOSED corpus with a COMPUTED oracle,
replacing "one hand-built fixture per shape". This section is an **extension**: no row above was
altered, deleted or renumbered, and every command below was run in this working tree with the
output that is quoted.

The corpus and the oracle as observed at the time of both demonstrations:

| Quantity | Observed |
|---|---|
| Indexed arrangements | **1000** (`MIN_CORPUS` 400, `MAX_CORPUS` 1000) |
| Immediate twins | 1000 — total corpus **2000 payloads** |
| Families (core combo × attachment set) | **72** = 8 × 9; every family contributed, **11–15 members each** (`MIN_PER_FAMILY` 4) |
| Linked / unlinked split | **22 linked, 1978 unlinked** (`MIN_LINKED` 20). By route: 18 class-3 `zeropage-vector-jumped-through`, 3 class-4 windows published, 1 class-3 `stack-return-push-idiom` |
| Generative reach | load separations 1–9 (past `SPLIT_TABLE_WINDOW` = 8); 13 distinct prologue lengths (7–19 bytes); 55 arrangements whose terminator falls outside the leading load's window; all four register pairings, both base orders, all three terminators, `nop` counts 0/1/2 |
| Suite | `node --test r2000-coverage-grammar.test.ts` — **22 tests, 22 pass, 0 fail**, `duration_ms 449` (budget 30 000) |

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01, COV-02 | 19-17 | `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` | the whole composed corpus, driven through `decode()` → `scanIndirectDispatch()` → `provenDispatchTargets()` → `computeStructuralCensus()`, the same wiring `buildCoverageReport()` uses | **22 pass, 0 fail.** The headline property — the set of arrangements the instrument PROVES equals exactly the set `expectedProvenLink()` says carries a proven data-flow link — holds in **both directions** over 2000 payloads, as ONE assertion |
| COV-01 | 19-17 | `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` | the nine `PINNED_IDIOMS` against the computed oracle | **PASS.** The oracle agrees with all nine hand-declared verdicts (three linked, six unlinked). The declarations were written by reading the shapes; the oracle was written from the six rules — an oracle drifting into being a copy of the scan would start agreeing with the instrument and disagreeing with these nine |
| COV-01 | 19-17 | `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` | the oracle's own source span, between two section markers in the suite | **PASS.** The span names none of `decode(`, `scanIndirectDispatch(`, `computeStructuralCensus(`, `provenDispatchTargets(`, `scanOfPayload(`, `censusOfPayload(`, `measure(` or `.bytes`, and is asserted non-empty and to contain `expectedProvenLink()`. The oracle's isolation is a mechanical fact, not an intention |
| COV-01 | 19-17 | `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` | every corpus payload's `indirectJumps` and `multiEntryTables` | **PASS.** Every recorded indirect jump has a **null** target and `multiEntryTables` is empty throughout, which is what licenses the oracle's silence about classes 1 and 2 |
| COV-01 | 19-17 | `cd src/mcp/vice && npx tsc --noEmit` | the whole `src/mcp/vice` TypeScript surface | **exit 0** |
| COV-01 | 19-17 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the per-case suite this grammar suite JOINS rather than replaces | **80 pass, 0 fail** — unchanged. No existing fixture or declaration was deleted |
| COV-01 | 19-17 | `node scripts/check-npm-packages.mjs` and `grep -c 'r2000-coverage-grammar' src/mcp/vice/package.json` | both packed tarballs | **exit 0** and **0** — the new suite is not in `files[]`, so neither tarball gained a byte |
| COV-01 | 19-17 | `cd src/mcp/vice && node --test ci-suite-coverage.test.ts` | the CI suite-directory derivation | **10 pass, 0 fail** — `src/mcp/vice` was already provably covered, so no CI wiring changed |

### The property watched FAIL — two planted violations, one per tightened branch

A gate nobody has watched fail is not known to be a gate (D-07.2). This round tightened **two**
true-returning sites, so the demonstration is run twice; a demonstration against only one leaves the
other's coverage unwatched. Each revert was applied **in the working tree only** and restored.

The number worth having is not "a test went red" but **how many generated arrangements moved into
the proven-but-not-expected half of the symmetric difference**. A hand-built corpus reports one
template per loosening — the one somebody wrote. A composed corpus reports a POPULATION, and its
size is the measure of what the loosening actually admits.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 19 | `hasDispatchContext()` branch A (`stack-return-push-idiom`), asserted corpus-wide by `r2000-coverage-grammar.test.ts` | branch A reverted to its presence-only form — `let sawPha = 0; for (k = start; k < end; k++) { if (opcode === 0x48) sawPha++; if (opcode === 0x60 && sawPha >= 2) return true; }` — two `$48` bytes and a `$60` byte anywhere in the window, ignoring the `pairing` parameter | **Corpus at the time of this demonstration: 1000 indexed arrangements + 1000 immediate twins, 72 families, 22 linked / 1978 unlinked.** `node --test r2000-coverage-grammar.test.ts` **exit 1**, `# tests 22 / # pass 18 / # fail 4`. The reds are `not ok 15 - the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link`, `not ok 16 - an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class`, `not ok 17 - an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code`, and `not ok 18 - twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin`. **Falsely-proven population: 3** arrangements, `expectedNotProven` 0. The three, verbatim from the failure message: `lda $0838,x : sta $fc : lda $0830,x : pha : sta $fb : txa : tya : pha : rts`; `lda $0830,x : sta $fb : lda $0838,x : sta $fc : pha : txa : pha : tya : rts`; `nop : lda $0838,y : sta $fc : lda $0830,y : pha : pha : sta $fb : rts`. Test 17 quoted `the census reached 31 bytes of a 15-byte program` — the round-3 verification's own numbers for the blocker payload, reproduced by a corpus that was never told about it | `git checkout -- src/mcp/vice/r2000-coverage.ts`, re-run: **22 pass, 0 fail**, and `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 |
| 20 | `hasDispatchContext()` branch B (`zeropage-vector-jumped-through`), asserted corpus-wide by `r2000-coverage-grammar.test.ts` | branch B reverted to its pre-19-16 form — re-collect every zero-page store target across the whole window into `zpStores`, then accept when any two of them differ by exactly one and the window carries an indirect jump naming the lower, ignoring `pairing.oriented.vectorLow` | **Corpus at the time of this demonstration: 1000 indexed arrangements + 1000 immediate twins, 72 families, 22 linked / 1978 unlinked.** `node --test r2000-coverage-grammar.test.ts` **exit 1**, `# tests 22 / # pass 18 / # fail 4`. The reds are the same four tests, 15 through 18. **Falsely-proven population: 6** arrangements, `expectedNotProven` 0. Three of the six, verbatim: `lda $0838,x : sta $fd : lda $0830,x : sta $fc : sta $fe : nop : nop : sta $fb : jmp ($00fb)`; `lda $0838,x : sta $fd : lda $0830,x : sta $fc : sta $fb : sta $fe : jmp ($00fb)`; `nop : lda $0838,x : sta $fd : lda $0830,x : sta $fc : sta $fb : sta $fe : jmp ($00fd)`. Test 17 quoted `the census reached 33 bytes of a 17-byte program` — 19-16's own pre-fix numbers for the foreign-jump control, again reproduced without being told | `git checkout -- src/mcp/vice/r2000-coverage.ts`, re-run: **22 pass, 0 fail**, `npx tsc --noEmit` exit 0, and `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 — neither revert survived |

**Seven of the nine falsely-proven arrangements are shapes nobody wrote.** Only two are the pinned
historical members (the round-3 blocker under plant 19, the foreign-jump control under plant 20).
That ratio is the whole claim of this plan restated as a measurement: the per-shape suite would have
reported one template per loosening, and the composed corpus reports a population of three and six.

**Every red is a population statement, not a template statement.** Tests 16, 17 and 18 red under
both plants as well, and each names the first offending arrangement with its fragment spelling and
the rule number the oracle decided it by — so a NEW defect, in a shape nobody has filed a finding
for, reports itself legibly rather than as an index into an array.

### A sampling defect in the generator, found BY the demonstrations and fixed generatively

The first run of plant 20 came back red but with a falsely-proven population of **1** — the pinned
member alone. Under the letter of the task that is not a GREEN demonstration, but in substance it is
the failure the task's own clause warns about: the GENERATED half of the corpus was contributing
nothing to that branch's coverage, and removing the pinned member would have turned the
demonstration green. It was treated as a finding about the corpus and fixed in the generator, not
worked around with another hand-written template.

The cause, measured rather than reasoned about: the per-family draw indexed each generative axis by
a linear rotation of the sample index, scaled onto the axis length. Any scheme of that form maps an
ARITHMETIC PROGRESSION in the sample index to an arithmetic progression on the axis — and the
stratum index is exactly such a progression, since the terminator is `stratumIndex % 3`. So the
ORDER axis stayed locked to a stride on the terminator axis whichever coprime multiplier was chosen.
Two orderings were tried and measured:

| Draw indexing | Plant 19 falsely proven | Plant 20 falsely proven |
|---|---|---|
| `stratumIndex * PER_STRATUM + r`, linear rotations | 3 (1 pinned + 2 generated) | **1 (pinned only)** |
| `r * STRATA_PER_FAMILY + stratumIndex`, linear rotations | **1 (pinned only)** | 5 (1 pinned + 4 generated) |
| avalanche mix of `(family, sample, axis)` — **shipped** | **3** (1 pinned + 2 generated) | **6** (1 pinned + 5 generated) |

Reordering alone only moved which branch lost its coverage. The shipped draw is a 32-bit avalanche
mix of `(familyIndex, sample, axisSeed)`: still a pure function of three indices, so the corpus is
byte-reproducible and the determinism test asserts it, but a progression on the input is no longer a
progression on the output. Seeding by FAMILY also stopped the eight core combos sharing an
attachment set from drawing identical permutations — seven eighths of the corpus's ORDER coverage
had been duplicated.

### Prohibitions observed

- `git diff --numstat` on `19-VALIDATION.md`: insertions only, **0 deletions**.
- `git diff --name-only` lists neither `.planning/REQUIREMENTS.md` nor `19-REVIEW.md`; both are
  byte-unchanged and no requirement checkbox was ticked.
- `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 — no production code changed in this
  plan; both reverts were working-tree-only and both were restored.
- The grammar suite JOINS the per-case controls rather than replacing them: no fixture directory, no
  committed payload constant and no gate-interior declaration was deleted, and
  `r2000-coverage.test.ts` still reports 80 pass / 0 fail unchanged.

## Round-4 gap closure → executed evidence (2026-08-25, plan 19-18)

The defect class this section closes is **the anti-regression mechanism's own hole**. Round 3's
headline deliverable reds the suite by name when a sufficient shape is admitted without an interior
negative control — and it passed over the defect it was built for, because `reachesGateInterior()`
defined one shape's interior as a DISJUNCTION of two routes and every control declared against that
shape satisfied only the class-4 half. This section is an **extension**: no row above was altered,
deleted or renumbered, and every command below was run in this working tree with the output quoted.

A control's declared position is now a **(shape, route) pair**. `route` is a CLOSED enumeration
derived from source: `DISPATCH_GATE_ROUTES` is a frozen exported array in `r2000-coverage.ts` whose
membership, call sites, publication sites and ordering are all read from that module's own text.

| Requirement | Plan | Command that ran | Ran against | Observed result |
|---|---|---|---|---|
| COV-01 | 19-18 | `cd src/mcp/vice && node --test r2000-coverage.test.ts` | the route-keyed witness, declaration table, reachability matrix and four source-derived pins | **96 pass, 0 fail** (80 before this plan; 86 after task 1, 92 after task 2, 96 after task 3). No existing fixture, payload constant or declaration row was deleted |
| COV-01 | 19-18 | same suite, one assertion | `reachesGateInterior(STACK_RETURN_MIXED_REGISTERS, $c000, "stack-return-push-idiom", "class-3-pass")` | **false**, and with `"class-4-pass"` **true**. This pair of assertions is the proof that the disjunction is gone rather than moved: before the re-key one call answered for both routes and the class-4 answer stood in for the class-3 one |
| COV-01 | 19-18 | same suite, one assertion | `reachesGateInterior(payloadOf(fp3-unlinked-push-idiom), $0810, "stack-return-push-idiom", ...)` | **true** on `class-3-pass`, **false** on `class-4-pass`. FP3 carries no five-instruction window, so it is interior to exactly one route — the other direction, without which a witness that answered "class-3: no" for everything would satisfy the row above |
| COV-01 | 19-18 | same suite | the unreachable pair and an invented route | `reachesGateInterior(…, "zeropage-vector-jumped-through", "class-4-pass")` **THROWS** naming both halves; `reachesGateInterior(…, "stack-return-push-idiom", "route-nobody-declared")` **THROWS** naming the route |
| COV-01 | 19-18 | same suite | `GATE_INTERIOR_DECLARATIONS`, 18 rows | **`STACK_RETURN` carries TWO rows** — `class-3-pass`/`negative` and `class-4-pass`/`positive`. Its dual role (a class-3 decline and a class-4 acceptance in one payload) was inexpressible under shape-only keying and the row had to pick one. Every non-`OUTSIDE` row's route is a member of `DISPATCH_GATE_ROUTES`; every `OUTSIDE` row's route is `null` |
| COV-01 | 19-18 | same suite | `GATE_ROUTE_REACHABILITY` | **exactly 4 rows** — the full 2 × 2 cross product — **3 reachable, 1 unreachable**, set-equality against the cross product passing in both directions |
| COV-01 | 19-18 | same suite | the three pairs on the gate-consulting route | **3 derived-equality assertions**, one per (shape × gate-consulting route) pair, plus a count assertion that the loop reached all 3 |
| COV-01 | 19-18 | `cd src/mcp/vice && npx tsc --noEmit` | the whole `src/mcp/vice` TypeScript surface | **exit 0** |
| COV-01, COV-02 | 19-18 | `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` | plan 19-17's composed corpus | **22 pass, 0 fail** — unchanged. The route work moved no arrangement into or out of the proven set |
| COV-01 | 19-18 | `cd src/mcp/vice && node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts` | every shipped `.ts`/`.mts` module | **24 pass, 0 fail** — no new comment hands work to a numbered phase and no new literal names one |
| COV-01 | 19-18 | `git status --porcelain src/mcp/vice/fixtures/coverage` | the committed fixture set | **empty** — this plan commits no fixture change |

### The measurement that only route-keying makes possible

`STACK_RETURN` measured three ways, in the same run:

| Measured through | Observed | What it means |
|---|---|---|
| `provenDispatchTargets()` (the aggregate seam) | non-empty | "accepted" — and the class-3 decline is invisible |
| `splitTables` (what `class-3-pass` publishes into) | **empty** | the class-3 route DECLINED it, because class 4 claimed the window first |
| `stackReturnDispatch` (what `class-4-pass` publishes into) | non-empty | the class-4 route ACCEPTED it |

Measuring a route-scoped verdict through the aggregate is what made this payload unrepresentable,
and it would let a class-3 positive control pass on a class-4 finding.

### The gate watched FAIL — three planted violations

A gate nobody has watched fail is not known to be a gate (D-07). Each plant was applied **in the
working tree only** and restored from a byte-exact pre-plant copy; the restored file was confirmed
`diff`-identical and the suite re-run green after each.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 21 | the (shape × route) coverage assertion | **every** `negative` row claiming the pair (`stack-return-push-idiom`, `class-3-pass`) deleted — the `fp3-unlinked-push-idiom` row **and** `STACK_RETURN`'s class-3 row. Deleting only ONE is not the demonstration: the point is that a PAIR loses coverage, and this plan's row set gives that pair two controls | **exit 1**, `# tests 92 / # pass 90 / # fail 2`. `not ok 68 - every REACHABLE (shape, route) pair is claimed by a negative interior declaration`, message verbatim: `the REACHABLE pair ("stack-return-push-idiom", "class-3-pass") has NO negative interior declaration. … Routes of "stack-return-push-idiom" that DO have negative coverage: class-4-pass -- so the missing half is "class-3-pass".` The reader is told **which half** is missing, not that something is missing. Also red: `not ok 69 - every REACHABLE pair's negative controls are confirmed INSIDE it by the witness` (`the reachable pair … has no negative control to confirm`) | rows restored, re-run: **92 pass, 0 fail** |
| 22 | the mechanical-truth check | one row **mis-routed**: `fp3-unlinked-push-idiom` flipped from `class-3-pass` to `class-4-pass`, changing nothing else | **exit 1**, `# tests 92 / # pass 89 / # fail 3`. `not ok 66 - every gate-interior declaration is mechanically TRUE, not a claim in a table`, message verbatim: `fp3-unlinked-push-idiom is DECLARED as the interior control for the pair ("stack-return-push-idiom", "class-4-pass"), but the witness says the payload does not satisfy that pair's pre-gate sufficient condition. … one declared against the WRONG ROUTE of a shape it does reach is the same defect wearing a route label.` FP3 carries no five-instruction window, so the witness catches the mis-routing rather than the shape. Also red: `not ok 69` and `not ok 72 - NON-VACUITY per route` | restored from the pre-plant copy, re-run: **92 pass, 0 fail**, `diff` identical |
| 23 | the mechanism's **own dodge** | a genuinely reachable pair — (`stack-return-push-idiom`, `class-3-pass`) — flipped to `reachable: false`, which under a free declaration would stop the coverage assertion demanding a negative control for it | **exit 1**, `# tests 92 / # pass 89 / # fail 3`. **BOTH required checks fired.** `not ok 65 - reachability on a route that CONSULTS the shared gate is DERIVED, not declared`: `the pair ("stack-return-push-idiom", "class-3-pass") is declared reachable=false, but route "class-3-pass" reaches its verdict by calling hasDispatchContext(), and that predicate accepts exactly the shapes in DISPATCH_CONTEXT_SHAPES … the honest edit is to remove the shape, which the branch-count pin ties to the predicate's own true-returning sites.` And `not ok 71 - every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair`: `Missing expected exception … the witness answered instead of throwing`. A third check fired unasked — `not ok 68`, the coverage assertion's reverse-direction stale-row half: `STACK_RETURN claims the interior of the pair ("stack-return-push-idiom", "class-3-pass"), which GATE_ROUTE_REACHABILITY does not declare reachable` | restored, re-run: **92 pass, 0 fail**, `diff` identical |

**The residual, recorded rather than papered over.** Plant 23 shows three independent checks on the
dodge, but all three read the declaration layer. An author who flips the row, deletes the witness's
predicate for that pair **and** deletes that pair's declaration rows in one coordinated edit
produces a self-consistent declaration layer again, and every check in this section goes green.
What stops that is **not in this section**: it is the pairing-consultation pin (plan 19-16), which
reads `hasDispatchContext()`'s own guard text and does not consult any table here, and the composed-
corpus property (plan 19-17), whose oracle is computed from six rules rather than declared. Both are
independent of every table in this section. Saying so is what keeps this mechanism from being
trusted past what it proves.

### The route set DERIVED FROM SOURCE — four pins (D-05)

`DISPATCH_GATE_ROUTES` without these is a hand-maintained mirror with no link to what it mirrors: a
future author who adds a third gate and does not touch the array leaves the suite green — the root
cause displaced one level up rather than removed. All four read `r2000-coverage.ts` through
`functionBodyFromSource()`, the ONE source reader in that file (promoted by plan 19-16 and whose own
failure mode — it THROWS naming the signature for a function that does not exist — is separately
asserted and passing). No second extractor was written; these four plus 19-16's pairing-consultation
pin are five readers of one helper. Every anchor is CODE with comments stripped, so no pin can be
satisfied by editing a comment.

| Pin | Derives | From | Observed | Non-vacuity guard |
|---|---|---|---|---|
| 1 | the number of **call sites** consulting the shared gate | occurrences of `hasDispatchContext(` in the whole comment-stripped module, minus the one declaration | **1 call site = 1 route** with `consultsSharedGate: true` | asserts the occurrence count is non-zero and the declaration count is exactly 1 before subtracting, so a rename fails loudly |
| 2 | each route's **publication site** | `<publishesInto>.push(` inside `scanIndirectDispatch()`'s comment-stripped body | **exactly 1 site per route, total 2** = `DISPATCH_GATE_ROUTES.length` | zero sites fails as loudly as two: a route whose collection is never written to could never produce a finding, so its negative controls would decline for free |
| 3 | the **seam's own sources** | the `scan.` fields `provenDispatchTargets()` iterates | **exactly 4** — `indirectJumps`, `multiEntryTables`, `stackReturnDispatch`, `splitTables` — set-equal to `PROVEN_TARGET_SOURCES` in both directions, and every route's `publishesInto` is a member | asserts both the extracted set and the declared array are non-empty before comparing |
| 4 | the **ordering** that makes the class-4 pass a route rather than a caller of the shared gate | offsets inside `scanIndirectDispatch()`'s comment-stripped body | `stackReturnDispatch.push(` at offset **4474**, `hasDispatchContext(` at **5750**; the region before the publication site contains **no** occurrence of the gate | asserts exactly one standalone route exists and that both anchors were found before comparing offsets |

Pin 4 is what makes the reachability matrix's one UNREACHABLE pair a source-level fact rather than a
claim in a table: the class-4 window reaches its verdict before the shared predicate is consulted at
all, so a shape the shared gate accepts cannot become reachable through it.

### The pins watched FAIL — two planted violations

Both plants were applied to `src/mcp/vice/r2000-coverage.ts` **in the working tree only** and
restored from a byte-exact pre-plant copy, confirmed `diff`-identical, with the suites re-run green.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 24 | pin 1 | a **second call site** for the shared gate: the class-3 condition-(c) expression rewritten to call `hasDispatchContext()` twice, conjoined. `npx tsc --noEmit` **exit 0** and behaviour unchanged — which is the point, a hand-maintained mirror would have accepted it | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 96 / # pass 95 / # fail 1`. `not ok 85 - PIN 1 …`, message verbatim: `r2000-coverage.ts calls hasDispatchContext() from 2 site(s), but DISPATCH_GATE_ROUTES declares 1 route(s) with consultsSharedGate: true (class-3-pass).` The grammar suite stayed **22 pass, 0 fail** — a behaviour-preserving edit is invisible to a report-level property, which is exactly why this pin reads source text | restored, re-run: **96 pass, 0 fail** |
| 25 | pin 3 | a **fifth iteration** in `provenDispatchTargets()` over `scan.splitTableCandidates` — the advisory collection | **exit 1**, `# tests 96 / # pass 95 / # fail 1`. `not ok 87 - PIN 3 …`, message verbatim: `provenDispatchTargets() reads scan.splitTableCandidates, which PROVEN_TARGET_SOURCES does not declare. A source added to the seam is the decision to treat it as proof of code -- and if that source is the advisory candidate collection, pairings the gate explicitly DECLINED become recursive-descent seeds.` **The grammar suite did NOT red: 22 pass, 0 fail** | restored, re-run: **96 pass, 0 fail**, grammar **22 pass, 0 fail** |

**Why plant 25 left the grammar suite green, measured rather than assumed.** An advisory record is
constructed with `targets: []` — the collection carries the pairing's bases and entry count but no
reconstructed addresses at all — so iterating it adds nothing to the seed set and the report does not
move by one byte. The plan anticipated a second red here; the honest observation is that it did not
occur, and the reason is a property of the advisory record rather than a weakness in the corpus.

That makes pin 3 the **only** guard standing between the advisory collection and the seed set for
this exact edit, which is worth knowing precisely. A second, stronger plant was run to establish what
the corpus catches once the leak is real:

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 25b | pin 3 **and** the composed-corpus property | plant 25 **plus** the advisory record built with `targets,` instead of `targets: []`, so the leak actually carries addresses | `r2000-coverage.test.ts` **exit 1**, `# tests 96 / # pass 83 / # fail 13`; `r2000-coverage-grammar.test.ts` **exit 1**, `# tests 22 / # pass 18 / # fail 4`. **Falsely-proven population: 972** of 2000 composed payloads, `expectedNotProven` 0 — e.g. `lda $0838,x : sta $fc : lda $0830,x : sta $fb : jmp ($00fd)` `[oracle: unlinked by R5 no dispatch link]`. Twelve per-case controls red alongside pin 3, including `an advisory split-table candidate never reaches the census` | restored, re-run: **96 pass, 0 fail** and **22 pass, 0 fail**, `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exit 0 |

Two independent mechanisms therefore cover the advisory-source threat, and they cover different
halves of it: pin 3 catches the DECLARATION of the source whether or not it leaks anything today,
and the corpus property catches the LEAK at a population of 972 the moment it becomes real.

### Prohibitions observed (plan 19-18)

- `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0 at the end of every task: all five
  plants were working-tree-only and all five were restored from byte-exact copies.
- `git diff --name-only` lists neither `.planning/REQUIREMENTS.md` nor `19-REVIEW.md`; both are
  byte-unchanged and no requirement checkbox was ticked by this plan.
- `COVERAGE_SCHEMA_VERSION` is still `2` and `COVERAGE_REPORT_KEYS` is unchanged — two new exported
  constants are not a report-shape change, and the report's pinned key-set test still passes.
- No fixture directory, committed payload constant or declaration row was DELETED. Rows gained a
  field; `STACK_RETURN` gained a second row; two payloads that were already committed but undeclared
  (`PUSH_IDIOM_LINKED`, `PUSH_IDIOM_WINDOW_EDGE`) gained rows of their own.
- `git status --porcelain src/mcp/vice/fixtures/coverage` is empty — no fixture changed.
- One correction to this plan's OWN row above, recorded rather than hidden: the per-case suite total
  was written as 98 while task 3 was still unwritten and is 96 as observed. The number was corrected
  in place, which is the single deletion in this plan's `19-VALIDATION.md` diff; no row from any
  earlier round was touched.

## Round-4 gap closure → executed evidence (2026-08-25, plan 19-20)

WR-03, the **second inflation route on the same structural number** SC4 gates on, and a different
mechanism from everything else in this round. Every other plan here is about `provenDispatchTargets()`
and what may seed a recursive descent. This one is the census's **own classification**: the descent
walked straight THROUGH an illegal opcode and claimed its bytes as executed code, while the linear
sweep eight lines below it in the same function refused to count them.

**WR-03 was PROMOTED into this round by orchestrator decision**, superseding the deferral recorded in
`19-CONTEXT.md`'s `<deferred>` section. `19-CONTEXT.md` was **deliberately not edited** to say so —
the promotion is recorded here and in `19-DECISIONS.md` Decision 6 rather than by rewriting a context
document after the fact. The reasoning: an unfixed, measured inflation on the number Phase 20 runs
under, filed by the round-3 verification under `missing` as a human call, risking a fourth
`SC4 partial` and with it D-08's one-way edit to a ROADMAP success criterion.

### The measured contradiction, and what closed it

| Payload | Before | After |
|---|---|---|
| `JAM_FILLED_IMAGE` — 64 bytes at `$0810`, `lda #$01 : ldx #$00` then sixty `$02` | `reachedAsInstruction=64`, `unreached=0`, `linearSweepDecodable=4` | `reachedAsInstruction=4`, `unreached=60`, `linearSweepDecodable=4` |
| `NOP_FILLED_IMAGE` — byte-identical except the filler is `$ea` | `reachedAsInstruction=64`, `unreached=0`, `linearSweepDecodable=64` | **unchanged**: `64`, `0`, `64` |

One hundred per cent structural completeness on a ninety-four-per-cent-garbage image, with the sibling
figure on the SAME report disagreeing sixteen-fold — and the legal twin proving the tightening
discriminates rather than refuses. The pair is built by one function from one filler byte, and that
"the only difference is the filler" is itself asserted (the two members differ at exactly 60 of 64
offsets, and are the same length).

The fix is **one decodability predicate with three consumers** — `isDecodableAsInstruction()`, read by
the recursive descent, the linear sweep and `isPlausibleEntryPoint()`. This is WR-14's pattern one
level over: `isPlausibleEntryPoint()` itself was extracted when the two halves of
`provenDispatchTargets()` were found held to different standards. `linearSweepDecodable`'s MEANING was
not touched — the descent was brought to the sweep's standard, never the reverse.

A general relation is now asserted rather than a fact about one payload:
`reachedAsInstruction <= linearSweepDecodable` for every payload tested. The report can no longer
claim more bytes as executed code than the sweep can decode as legal instructions.

### The twelve-fixture regression — measured, not asserted

Every committed coverage fixture carries **zero illegal instructions on a reached path**, which is WHY
the tightening moves none of them. Asserted per fixture, so a mover would name itself.

| Fixture | `reachedAsInstruction` before | after | `unreached` after | `linearSweepDecodable` after |
|---|---|---|---|---|
| `fp1-indexed-copy-loop` | 7 | 7 | 55 | 48 |
| `fp1b-immediate-copy-loop` | 7 | 7 | 57 | 48 |
| `fp2-zeropage-data-pointer` | 17 | 17 | 45 | 60 |
| `fp2b-immediate-data-pointer` | 17 | 17 | 47 | 60 |
| `fp3-unlinked-push-idiom` | 15 | 15 | 47 | 60 |
| `fp3b-immediate-push-idiom` | 15 | 15 | 49 | 60 |
| `nc1-all-auto` | 30 | 30 | 32 | 57 |
| `nc1b-auto-renamed-in-place` | 30 | 30 | 32 | 57 |
| `nc2-generic-comments` | 30 | 30 | 32 | 57 |
| `nc3-all-data-blocks` | 30 | 30 | 32 | 57 |
| `nc4-multi-caller-unnamed` | 30 | 30 | 32 | 57 |
| `nc5-well-documented` | 30 | 30 | 32 | 57 |
| Phase 11 `recon-subject.regen2000proj` (previously unseen, authored for a different phase) | 68 | 68 | 31 | 94 (range 100) |

The recorded table is asserted **set-equal to the fixture directory listing in both directions**, so a
fixture added without a recorded number reds rather than escaping the regression statement.

The **sealed reproducibility answer still holds**: `ANSWER.sha256` matches, both canonical lines match
the grammar, and the LIVE two-route recomputation from `nc5-well-documented` reproduces the sealed
line on both the store route and the bytes route. `ANSWER.md`, `ANSWER.sha256` and `QUESTION.md` are
byte-unchanged and appear in no diff.

Plan 19-17's composed corpus is unaffected — **22 pass, 0 fail** — which this run confirms rather than
assumes. Its generator still throws on a `0x02` byte, so the corpus remains structurally unable to
launder this route.

### One predicate, three consumers, DERIVED FROM SOURCE — four pins (WR-03)

The same family as 9b's four route pins and 19-16's pairing-consultation pin, one level over: those
say the dispatch gate's ROUTES are read from the module; these say the census's DECODABILITY STANDARD
is one definition with a known set of readers. All four read `r2000-coverage.ts` through
`functionBodyFromSource()`, the ONE source reader in that file — no second extractor was written;
these four join 19-16's pairing-consultation pin and 19-18's four route pins as readers of one
helper. Every anchor is CODE with comments stripped.

| Pin | Derives | From | Observed | Non-vacuity guard |
|---|---|---|---|---|
| 5 | the predicate's **definition and call-site counts** | occurrences of `isDecodableAsInstruction(` in the whole comment-stripped module, minus the declarations | **1 definition, 3 call sites** | asserts the occurrence count is non-zero and the declaration count is exactly 1 before subtracting |
| 6 | **where** the three calls are | occurrences inside `computeStructuralCensus()`'s and `scanIndirectDispatch()`'s comment-stripped bodies, plus their offsets against the sweep region | **2 in the census (one each side of the `linearSweepDecodable` anchor), 1 in the scan, total 3** | asserts the census anchor is unique in the module, that the extracted body is non-empty, that the sweep anchor was found, and that the two census sites are distinct |
| 7 | the **owner of the decoder's illegal flag** | occurrences of `.illegal` in the whole comment-stripped module | **exactly 1**, and it lies inside the predicate's own body | asserts the count is non-zero before comparing, and stripping is load-bearing in both directions — the predicate's own doc comment names the flag, and an unstripped count could also hide a fourth reader behind a comment |
| 8 | the **statement order** inside the descent | offsets of `isDecodableAsInstruction(` and of the class-zero marking loop `mark(pc + i, 0)` inside the census body | predicate at **1586**, marking loop at **1682**; the sweep region begins at **2361** and the sweep's own call is at **2473** | asserts both anchors were found, and says explicitly that a rewritten marking loop must be re-derived rather than the pin deleted |

Pin 8 is the one the counting pins cannot make. Consulted before the marking loop, an illegal byte is
never marked and stays `unreached`; consulted after, it is claimed and only then abandoned — and the
four class counts would still sum, so nothing else in the suite would notice.

The `CENSUS_SIGNATURE` anchor is the return-type tail `): StructuralCensus {` rather than the
`export function …(` head, and that is forced rather than stylistic: the parameter list ends
`opts: StructuralCensusOptions = {}`, whose default-value braces would be the first `{` the shared
reader met, extracting an EMPTY body. The reader throws on an empty extraction, so the wrong anchor
fails loudly — but this is the anchor that lets the pins run.

### The gate watched FAIL — three planted violations

All three were applied to `src/mcp/vice/r2000-coverage.ts` **in the working tree only** and restored
from a byte-exact pre-plant copy (sha256 `9574ff73…4ea09`), confirmed `diff -q`-identical, with
`git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exiting 0 and the suites re-run green.

| # | Guard | Planted violation | Red | Green after restore |
|---|---|---|---|---|
| 26 | the WR-03 control, PIN 7 | the **illegal test removed from the predicate** so it checks only existence and truncation — the one-word edit a future author would actually make. `npx tsc --noEmit` **exit 0** | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 107 / # pass 103 / # fail 4`. `not ok 5 - WR-03: the descent stops at an illegal opcode …` with `64 !== 4`; `not ok 98 - PIN 7 …` on its own non-vacuity guard: `no read of .illegal survives in the stripped source`. Two pre-existing controls red alongside — `not ok 39 - dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction` and `not ok 77 - every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection` — because the plant loosens the entry-point gate too | restored, re-run: **107 pass, 0 fail** |
| 27 | the WR-03 control, the general relation, PINs 5, 6 and 8 | the **descent's guard reverted only**, leaving the sweep strict — the literal pre-fix state | **exit 1**, `# tests 107 / # pass 102 / # fail 5`. Measured: `reached=64 unreached=0 sweep=4`, exactly the round-3 verification's numbers. `not ok 9` verbatim: `JAM_FILLED_IMAGE: the census claims 64 bytes as executed code while the linear sweep can decode only 4 of them as legal, non-truncated instructions.` `not ok 96 - PIN 5` (`2 !== 3`), `not ok 97 - PIN 6` (`1 !== 2`), `not ok 99 - PIN 8` (`predicate at offset 2486 … AFTER the class-zero marking loop at 1695`) | restored, re-run: **107 pass, 0 fail** |
| 28 | PINs 5, 6 and 7 | the **sweep restates the test inline** — `if (insn.illegal) continue; if (insn.notes.includes("truncated")) continue;` — instead of reading the predicate. **Behaviour identical**: `JAM reached=4 unreached=60 sweep=4`, `NOP 64/0/64`, and **not one report-level control moved** | **exit 1**, `# tests 107 / # pass 104 / # fail 3`. `not ok 96 - PIN 5` (`2 !== 3`), `not ok 97 - PIN 6` (`1 !== 2`), `not ok 98 - PIN 7`: `the decoder's illegal flag is read at 2 site(s) in r2000-coverage.ts. Exactly one is allowed …`. The grammar suite stayed **22 pass, 0 fail** | restored, re-run: **107 pass, 0 fail** |

**Plant 26 did NOT reproduce `linearSweepDecodable=4`, and that is the honest result rather than the
predicted one.** The plan expected 64/0/4; the measurement was **64/0/64**. The reason is a property
of the fix: loosening the shared predicate loosens the SWEEP as well, so the two figures move together
and the general `reachedAsInstruction <= linearSweepDecodable` relation **does not red** under that
plant. That is not a weakness — it is the design working. Once both figures read one predicate, no
edit expressible as a change to that predicate can make them contradict each other; only an edit that
un-shares them can, which is what plant 27 does and what PINs 5, 6 and 8 catch by name. Plant 27 was
run specifically to establish the pre-fix numbers the round-3 verification reported, and it reproduced
them exactly.

**Plant 28 is the one worth reading twice.** It is behaviour-preserving: every report-level control in
the file stayed green, the composed corpus stayed green, and `tsc` was clean. Only the source-derived
pins caught it. A second inline standard that AGREES today is exactly how the descent and the sweep
came to disagree in the first place, and a report-level suite cannot see it.

### Prohibitions observed (plan 19-20)

- `COVERAGE_SCHEMA_VERSION` is still `2` (`grep -c 'COVERAGE_SCHEMA_VERSION = 2'` prints 1) and
  `COVERAGE_REPORT_KEYS` is unchanged — this plan changes what a number MEASURES on a garbage image,
  not the report's shape.
- `git diff --name-only` lists none of `ANSWER.md`, `ANSWER.sha256`, `QUESTION.md`, `19-CONTEXT.md`,
  `19-REVIEW.md` or `.planning/REQUIREMENTS.md`. No requirement checkbox was ticked by this plan.
- `git status --porcelain src/mcp/vice/fixtures/coverage` is empty — no fixture changed.
- The dispatch gate was not touched: `hasDispatchContext()`, `DISPATCH_GATE_ROUTES`,
  `PROVEN_TARGET_SOURCES` and `provenDispatchTargets()` are byte-unchanged, and 19-18's four route
  pins plus 19-16's pairing-consultation pin all still pass.
- Plan 19-17's corpus keeps its no-`0x02` generator throw; the grammar suite is untouched and green.
- `r2000-session.ts` was not opened and its 200 ms call timeout was not widened.
- No runtime dependency was added to either published package.
- The full suite was run, not the `test:automated` subset: **2589 pass, 0 fail, 40 skipped, 5 todo**
  over 24 suites — neither of the two known contention flakes
  (`vice-proxy.test.ts` wall-clock budgets, `r2000-session.test.ts`'s 200 ms timeout) appeared.

### The decision this route rests on, and the residual it names (Decision 6)

`19-DECISIONS.md` Decision 6 (dated 2026-08-25) records the choice and its price. The two halves
worth restating here, because they are measurements rather than positions:

- **The rejected alternative had a real case.** Stopping only at the CPU-halting opcodes and
  loosening the linear sweep to match is arguably more faithful to the machine — a `jam` halts the
  processor and a `lax` does not. It is rejected for this round because loosening the sweep would
  change what `linearSweepDecodable` **MEANS**, and that meaning is published in the report Phase 20
  consumes. Redefining it owes a `COVERAGE_SCHEMA_VERSION` bump and a consumer review; this round is
  a predicate-and-control round and does not bump the schema.
- **The residual has a size.** `disasm-opcodes.ts` flags **105 of 256** entries illegal, of which
  only **12** are `jam`. The other **93** are stable undocumented instructions real C64 code does
  use — 27 undocumented `nop` variants, 7 each of `slo`, `rla`, `sre`, `rra`, `dcp` and `isc`, 6
  `lax`, 4 `sax`, and the remainder. A program that legitimately executes one of those will now have
  its census stop there and **under-report**. The direction of the error is the safe one for an
  instrument whose point is that reachability must be PROVEN; it is no longer silent, because the
  two figures now agree and `reachedAsInstruction <= linearSweepDecodable` is asserted generally;
  and the sweep already behaved this way, so the census shares an existing limitation rather than
  inventing one.

The reversal condition is checkable rather than rhetorical: a real target program whose
`linearSweepDecodable` minus `reachedAsInstruction` gap is explained by a stable undocumented opcode
on a path it really executes. The remedy is then a named census option plus a
`COVERAGE_SCHEMA_VERSION` bump, taken with Phase 20's own review of the `flat-three` schema — never
a silent divergence between the descent and the sweep, which is the condition Decision 6 exists to
end.

## Round-4 consolidation — every gate this round added, and the demonstration that watched it fail (2026-08-25, plan 19-19)

This section is an **extension**: no row, table or heading above was altered, deleted or renumbered.
It adds no new measurement of its own. Every number below is transcribed from the plan SUMMARY or the
per-plan section that recorded it, and where a SUMMARY does not state a number, the cell says so
rather than supplying one.

D-07 makes acceptance for this round "every new gate has been demonstrated to fail when its control
is removed", not "SC4 passes". Five plans landed **seven gates**. Counting the planted-violation rows
those five SUMMARY files record — 19-15 one (plant 15), 19-16 three (16, 17, 18), 19-17 two (19, 20),
19-18 six (21, 22, 23, 24, 25, 25b), 19-20 three (26, 27, 28) — the round performed **15
demonstrations**, numbered 15 through 28 with one lettered variant. That total is derived by counting
those rows, not asserted here; a reader who counts them again and gets a different number has found a
defect in this section, not in the sources.

| Gate | Plan | Must DECLINE — measured | Must still ACCEPT — measured | Planted violation | Test observed RED (verbatim) | Counts / exit | Green after restore |
|---|---|---|---|---|---|---|---|
| **1. The tightened push-idiom branch** — `hasDispatchContext()` branch A (`stack-return-push-idiom`) requires a `pha` at each paired load's own successor and an `rts` after both | 19-15 | `fp3-unlinked-push-idiom` (the round-3 blocker payload, 15 declared code bytes): `reachedAsInstruction=15` against its own `code_size: 15`, `splitTables=[]`, `provenDispatchTargets()=[]`, `tableEntryAddresses=[]`, `classAt($0840)="unreached"`, `splitTableCandidates=1`. Its twin `fp3b` reports `reached=15`, `splitTableCandidates=0` | `PUSH_IDIOM_LINKED` — FP3's layout with each push moved to its load's own successor: `splitTables.length===1`, `stackReturnDispatch.length===0` (class 4 declines, so class 3 is genuinely the route under test), `provenDispatchTargets()` deep-equal `[$0840…$0847]`. **Its census is recorded as a RELATION, not a number** — `reachedAsInstruction >` the payload's derived 13-byte prologue — so no census figure is transcribed for this cell. `SPLIT_TABLE` and `STACK_RETURN` re-asserted PROVEN in the same test | **15** — branch A reverted in the working tree to `sawPha >= 2 && opcode === 0x60` scanned over the whole window, ignoring the `pairing` parameter | `not ok 60 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it` — first assertion, `actual` `[{ at: 2064, loBase: 2096, hiBase: 2104, entries: 8, orientationResolved: true, targets: [2112…2119] }]` against `expected` `[]`. Planted predicate measured directly: `reached=31`, `tableEntry=16`, `splitTables=1`, `tableEntryAddresses=16`, eight proven targets `$0840`…`$0847`, `classAt($0840)="reached-as-instruction"` | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 76 / # pass 75 / # fail 1` | `git checkout --`, re-run **76 pass / 0 fail**; `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exit 0 |
| **2. The tightened zero-page-vector branch** — branch B (`zeropage-vector-jumped-through`) is one membership test against `pairing.oriented.vectorLow` | 19-16 | `ZP_VECTOR_FOREIGN_JUMP`: `splitTables=0`, `splitTableCandidates=1`, `tableEntryAddresses=0`, `provenDispatchTargets()=[]`, `reached=17` against its own derived 17-byte prologue, `classAt($0840)="unreached"` | `ZP_VECTOR_OWN_JUMP` — the same 64 bytes with ONE operand byte changed so the jump names the pairing's own vector: `splitTables.length=1`, sixteen table-entry addresses, `provenDispatchTargets()` deep-equal `[$0840…$0847]`, `reached=33`. The pair is asserted to differ at exactly one offset (`ZP_VECTOR_JUMP_OPERAND_INDEX`). `SPLIT_TABLE`, `SPLIT_TABLE_CLEAN`, `SPLIT_TABLE_INTERPOSED` and `fp2-zeropage-data-pointer` all keep their verdicts | **16** — branch B reverted to the window-wide `zpStores` collection plus the nested `b - a === 1` pair loop, ignoring `pairing.oriented.vectorLow` | `not ok 62 - a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it` and `not ok 63 - the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN` (`observed 33 against 33`). Under the plant **both** payloads reported `splitTables=1`, `splitTableCandidates=0`, `tableEntryAddresses=16`, the same eight targets, `reached=33`, `classAt($0840)="reached-as-instruction"` — byte-for-byte identical in the report | `node --test r2000-coverage.test.ts` **exit 1**, `# tests 78 / # pass 76 / # fail 2` | `git checkout --`, re-run **78 pass / 0 fail**; `git diff --quiet` exit 0 |
| **3. The pairing-consultation pin** — D-02 asserted over `hasDispatchContext()`'s own source text: every `return true` site's DEPTH-1 guard chain, comments stripped, must name `pairing` | 19-16 | A presence-only `return true` — a site whose depth-1 guard chain does not name the `pairing` parameter. **This gate has no report-level values by construction; it reads source text, so the DECLINE cell carries a source condition rather than measured report figures.** Its non-vacuity is doubly guarded: the extracted site count is asserted non-zero AND equal to `DISPATCH_CONTEXT_SHAPES.length` | Branch A exactly as 19-15 committed it — chain extracted verbatim `if (insns[pairing.firstIndex + 1]?.opcode === 0x48 && insns[pairing.secondIndex + 1]?.opcode === 0x48) { for (let k = pairing.secondIndex + 2; k < end; k++) { if (insns[k]!.opcode === 0x60)` — and branch B, `if (indirectJumpPointers.includes(pairing.oriented.vectorLow))`. Extracted site count **2**, equal to `DISPATCH_CONTEXT_SHAPES.length` | **17** — branch A reverted to its presence-only form; **18** — branch B reverted to its window-wide `zpStores` scan. Two demonstrations, one per true-returning site | `not ok 72 - EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window` — under plant 17 alongside `not ok 60`, quoting the offending chain `for (let k = start; k < end; k++) { if (insns[k]!.opcode === 0x48) sawPha++; if (insns[k]!.opcode === 0x60 && sawPha >= 2)`; under plant 18 alongside `not ok 62` and `not ok 63`, quoting `for (const a of zpStores) { for (const b of zpStores) { if (b - a !== 1) continue; if (indirectJumpPointers.includes(a))` | plant 17: **exit 1**, `# tests 80 / # pass 78 / # fail 2`. plant 18: **exit 1**, `# tests 80 / # pass 77 / # fail 3` | **80 pass / 0 fail** after each; `npx tsc --noEmit` exit 0; `git diff --quiet` exit 0 — neither revert survived |
| **4. The corpus-wide proven-set equality** — over 2000 composed arrangements, the set the instrument PROVES equals exactly the set the computed oracle says carries a proven data-flow link, asserted in both directions as ONE statement | 19-17 | The **1978 unlinked** arrangements of the corpus (1000 indexed + 1000 immediate twins, 72 families, 11–15 members each). An unlinked arrangement moves not one byte into the seed set or the table-entry class and its census reaches exactly its own prologue length | The **22 linked** arrangements (`MIN_LINKED` 20), each publishing a non-empty seed set and a census strictly exceeding its own prologue; by route, 18 class-3 `zeropage-vector-jumped-through`, 3 class-4 windows, 1 class-3 `stack-return-push-idiom`. The nine `PINNED_IDIOMS` are present by byte identity and the oracle agrees with all nine hand-declared verdicts (three linked, six unlinked) | **19** — branch A reverted to its presence-only form; **20** — branch B reverted to its pre-19-16 window-wide scan. Two demonstrations, one per tightened branch | `not ok 15 - the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link`, with `not ok 16`, `not ok 17` and `not ok 18` under both plants. **Falsely-proven POPULATION: 3 under plant 19, 6 under plant 20**, `expectedNotProven` 0 in both. Seven of those nine are shapes nobody wrote. Test 17 quoted `the census reached 31 bytes of a 15-byte program` under plant 19 — the round-3 verification's own figures — and `the census reached 33 bytes of a 17-byte program` under plant 20 — 19-16's own pre-fix figures — both reproduced by a corpus never told about either | each plant: `node --test r2000-coverage-grammar.test.ts` **exit 1**, `# tests 22 / # pass 18 / # fail 4` | **22 pass / 0 fail** after each; `npx tsc --noEmit` exit 0; `git diff --quiet` exit 0 |
| **5. The (shape × route) coverage assertion and its reachability matrix** — a control target is a PAIR, the disjunction is deleted, and each route's verdict is measured through that route's own publication collection | 19-18 | A REACHABLE `(shape, route)` pair with no negative interior declaration, a row declared against the WRONG route of a shape it does reach, and a genuinely reachable pair flipped to `reachable: false`. **Declaration-layer gate: the DECLINE cell is a declaration condition, not a report figure.** Route-scoped measurement makes `STACK_RETURN`'s dual role expressible — `provenDispatchTargets()` non-empty, `splitTables` **empty** (class-3 decline), `stackReturnDispatch` non-empty (class-4 acceptance) | 18 declaration rows, `STACK_RETURN` carrying two; `GATE_ROUTE_REACHABILITY` exactly 4 rows — the full 2 × 2 cross product, **3 reachable / 1 unreachable** — set-equal to the cross product in both directions; three derived-equality assertions, one per gate-consulting pair; `reachesGateInterior(STACK_RETURN_MIXED_REGISTERS, $c000, "stack-return-push-idiom", "class-3-pass")` **false** and `"class-4-pass"` **true**; FP3 **true** on class-3 and **false** on class-4 | **21** — both negative rows claiming (`stack-return-push-idiom`, `class-3-pass`) deleted; **22** — `fp3-unlinked-push-idiom` mis-routed from `class-3-pass` to `class-4-pass`; **23** — that same reachable pair flipped to `reachable: false`, the mechanism's own dodge | plant 21: `not ok 68 - every REACHABLE (shape, route) pair is claimed by a negative interior declaration` (naming which half is missing) and `not ok 69`. plant 22: `not ok 66 - every gate-interior declaration is mechanically TRUE, not a claim in a table`, plus `not ok 69` and `not ok 72`. plant 23: `not ok 65 - reachability on a route that CONSULTS the shared gate is DERIVED, not declared`, `not ok 71 - every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair`, and `not ok 68` unasked | plant 21: **exit 1**, `# tests 92 / # pass 90 / # fail 2`. plants 22 and 23: **exit 1**, `# tests 92 / # pass 89 / # fail 3` each | **92 pass / 0 fail** after each; restored from a byte-exact pre-plant copy and confirmed `diff`-identical |
| **6. The four source-derived route pins** — the route set's call sites, publication sites, seam sources and gate ORDERING read from `r2000-coverage.ts`'s own comment-stripped text | 19-18 | A second call site of the shared gate (behaviour-preserving, `tsc` exit 0) and a fifth iteration in `provenDispatchTargets()` over the advisory `splitTableCandidates` collection. **Source-text gate: no report figures.** | PIN 1: **1 call site = 1 route** with `consultsSharedGate: true`. PIN 2: exactly **1 publication site per route, total 2**. PIN 3: the seam's **4** `scan.` fields set-equal to `PROVEN_TARGET_SOURCES` both directions. PIN 4: `stackReturnDispatch.push(` at body offset **4474** preceding `hasDispatchContext(` at **5750**, with no gate call before it | **24** — a second `hasDispatchContext()` call site, conjoined, behaviour unchanged; **25** — a fifth seam source over the advisory collection; **25b** — plant 25 *plus* the advisory record built carrying its reconstructed targets | plant 24: `not ok 85 - PIN 1 …` — `r2000-coverage.ts calls hasDispatchContext() from 2 site(s), but DISPATCH_GATE_ROUTES declares 1 route(s) with consultsSharedGate: true (class-3-pass).` plant 25: `not ok 87 - PIN 3 …` — `provenDispatchTargets() reads scan.splitTableCandidates, which PROVEN_TARGET_SOURCES does not declare.` **Recorded as observed rather than as predicted: plant 25 did NOT red the composed corpus** — an advisory record carries `targets: []`, so it leaks nothing. Plant 25b, run to measure what the corpus catches once the leak is real: **972 falsely proven of 2000**, `expectedNotProven` 0 | plant 24: **exit 1**, `# tests 96 / # pass 95 / # fail 1`, grammar suite **22 pass / 0 fail**. plant 25: **exit 1**, `# tests 96 / # pass 95 / # fail 1`, grammar **22 pass / 0 fail**. plant 25b: `r2000-coverage.test.ts` **exit 1**, `# tests 96 / # pass 83 / # fail 13`; grammar **exit 1**, `# tests 22 / # pass 18 / # fail 4` | **96 pass / 0 fail** and **22 pass / 0 fail** after each; `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exit 0 |
| **7. The census decodability predicate (WR-03)** — `isDecodableAsInstruction()`, one definition read by the recursive descent, the linear sweep and `isPlausibleEntryPoint()`, held by PINs 5–8 | 19-20 | `JAM_FILLED_IMAGE` — 64 bytes at `$0810`, `lda #$01 : ldx #$00` then sixty `$02`: **after** `reachedAsInstruction=4`, `unreached=60`, `linearSweepDecodable=4` (**before**: `64`, `0`, `4` — the report disagreeing with itself sixteen-fold) | `NOP_FILLED_IMAGE` — byte-identical except the sixty filler bytes are `$ea`: **unchanged at `64`, `0`, `64`**, and the pair asserted the same length and differing at exactly 60 of 64 offsets. All twelve committed fixtures and the previously-unseen Phase 11 fixture report the same `reachedAsInstruction` as before (7, 7, 17, 17, 15, 15, 30 six times, and 68), the recorded table set-equal to the fixture directory both directions | **26** — the illegal test removed from the predicate (`tsc` exit 0); **27** — the descent's guard reverted alone, leaving the sweep strict, the literal pre-fix state; **28** — the sweep restates the test inline, **behaviour-identical**, no report-level control moved | plant 26: `not ok 5 - WR-03: the descent stops at an illegal opcode …` (`64 !== 4`) and `not ok 98 - PIN 7 …`. plant 27: `not ok 9` — `JAM_FILLED_IMAGE: the census claims 64 bytes as executed code while the linear sweep can decode only 4 of them as legal, non-truncated instructions.` — plus `not ok 96 - PIN 5` (`2 !== 3`), `not ok 97 - PIN 6` (`1 !== 2`), `not ok 99 - PIN 8` (`predicate at offset 2486 … AFTER the class-zero marking loop at 1695`). plant 28: `not ok 96`, `not ok 97`, `not ok 98`. **Recorded as observed rather than as predicted: plant 26 measured `64 / 0 / 64`, not the predicted `64 / 0 / 4`** — loosening the SHARED predicate loosens the sweep too, so the general relation cannot red under any edit to it; plant 27 was run to reproduce the pre-fix `64 / 0 / 4` exactly, and it did | plant 26: **exit 1**, `# tests 107 / # pass 103 / # fail 4`. plant 27: **exit 1**, `# tests 107 / # pass 102 / # fail 5`. plant 28: **exit 1**, `# tests 107 / # pass 104 / # fail 3`, grammar **22 pass / 0 fail** | **107 pass / 0 fail** after each; restored from a byte-exact pre-plant copy (sha256 `9574ff73…4ea09`) and confirmed `diff -q`-identical; `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exit 0 |

**Every gate this round added is listed above and every one carries a demonstration.** No gate is
missing a row, and no row is missing its demonstration; the three cells that carry a source condition
instead of report figures (gates 3, 6 and the declaration half of gate 5) say so explicitly, because a
source-text pin has no report values to transcribe and inventing some would be worse than saying none
exist.

### D-07's three clauses, and the row that discharges each

D-07 states acceptance for this round in three numbered clauses. Each is discharged by exactly one
row above:

1. **"the (shape × route) coverage assertion exists, is source-derived, and FAILS when one route's
   negative control is deleted — shown with a planted violation."** Discharged by **row 5**: plant 21
   deleted *both* negative rows claiming (`stack-return-push-idiom`, `class-3-pass`) and
   `not ok 68` named which half was missing, at `# tests 92 / # pass 90 / # fail 2`. Its
   source-derivation is **row 6** — the route enumeration's call sites, publication sites, seam
   sources and ordering are read from the module's own text, not mirrored by hand.
2. **"the generated-payload property assertion exists and FAILS against the pre-D-03 predicate —
   shown by reverting D-03 locally and observing red."** Discharged by **row 4**: plants 19 and 20
   reverted each tightened branch in turn and the corpus-wide set equality red both times, at
   falsely-proven populations of 3 and 6 with `expectedNotProven` 0.
3. **"the round-3 blocker payload … reports `splitTables === 0`, `provenDispatchTargets() === []`,
   and `classAt($0840) === "unreached"`."** Discharged by **row 1**: the `fp3-unlinked-push-idiom`
   fixture is that payload verbatim, and its measured post-fix report is `splitTables=[]`,
   `provenDispatchTargets()=[]`, `tableEntryAddresses=[]`, `classAt($0840)="unreached"`, with
   `reachedAsInstruction=15` against the `code_size: 15` its own store declares.

### What this round did not close, stated rather than implied

- **The reachability dodge has a coordinated three-edit form that this section's tables do not
  catch** (plan 19-18's own residual). Flipping the row, deleting the witness's predicate for that
  pair and deleting that pair's declaration rows together produces a self-consistent declaration
  layer, and every check in row 5 goes green. What covers it is independent of every table here:
  row 3's pairing-consultation pin, which reads `hasDispatchContext()`'s own guard text, and row 4's
  composed-corpus property, whose oracle is computed from six rules rather than declared.
- **Oracle rule R3 is faithful but never decides an outcome in the current corpus** (plan 19-17). The
  one-terminator-last arrangement contract forces every class-4 window to be the final five
  fragments, after which no consumer store can follow either load. The rule is required for the
  oracle to model the instrument, and its inertness is recorded so a future alphabet change that
  makes it live is recognised as such.
- **Row 7's closure moves the census to the linear sweep's existing standard, and that standard
  under-reports.** See the WR-03 item in `deferred-items.md` and `19-DECISIONS.md` Decision 6 for the
  size of that residual and its named reversal condition.
