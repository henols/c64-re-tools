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
