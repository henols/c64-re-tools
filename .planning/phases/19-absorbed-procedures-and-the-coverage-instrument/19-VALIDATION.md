---
phase: 19
slug: absorbed-procedures-and-the-coverage-instrument
status: complete
nyquist_compliant: true
created: 2026-08-24
closed: 2026-08-24
closed_by: 19-05
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

## Nyquist compliance

Every requirement is sampled by at least one executed command **and** at least one
planted-violation demonstration proving that command can fail, rather than by a single
green run that would say nothing about whether the check discriminates. `nyquist_compliant`
is set `true` on that basis, replacing the draft's `false`.
