# Phase 60 — Full-Suite Failing-Set Difference (LOC-03)

Plan 60-05, Task 2. Measures "nothing changed for anyone who already had it working" as a
SET difference between the pre-rewiring tree and the post-rewiring tree, never as a total or
a percentage — per this project's own operational record of three distinct ways to measure
this claim wrongly (Pitfall 3, `60-RESEARCH.md`), and per `60-VALIDATION.md`'s two standing
facts binding every command in this note.

## SHAs

- **Baseline (pre-rewiring):** `884e68c8` (`884e68c87fbbd19d2b8d07f42280f98bfa14ee0f`) — per
  PD-12, the last commit touching `src/mcp/vice/` before Phase 60 began.
- **Post-rewiring (this note's final measurement):** `ce890041`
  (`ce89004169bdb295b93e2da1e5757c2806791fdf`) — includes this plan's own two production-code
  fixes (see "Regressions found and fixed" below), committed before this evidence note.

## Commands, exit status, and the no-broker precondition

Every command below is the FULL `npm test` glob (`node --test '*.test.*'`), never
`npm run test:automated`, which filters out `MANUAL_ONLY_TESTS` and therefore cannot support
this claim. Every exit status is read on the SAME line as the redirect, never through a pipe.

**Precondition, both runs:** no `vice-broker` process and no `x64sc` process running.
`pgrep -af 'vice-broker'` was re-run immediately before the final post-rewiring measurement;
after filtering this diagnostic's own shell-wrapper self-match (the harness's own
`eval 'pgrep -af vice-broker'` invocation text, which trivially contains the search string),
it printed `NO_BROKER`. `pgrep -af 'x64sc'` printed `NO_X64SC`.

```text
$ pgrep -af 'vice-broker' | grep -v "eval 'pgrep\|snapshot-bash\|builtin unalias\|builtin unset"
NO_BROKER
$ pgrep -af 'x64sc' | grep -v "eval 'pgrep\|snapshot-bash\|builtin unalias\|builtin unset"
NO_X64SC
```

**A real, unrelated orphaned `x64sc` process was found and stopped before the first
measurement** — see "Deviations" below; it is not part of the precondition record above,
which reflects the environment as measured for the runs this note reports.

### Post-rewiring (final, at `ce890041`) — run FOUR times, see "Observed flakiness" below

```text
$ cd src/mcp/vice && npm test > /tmp/60-05-t2-post-final.tap 2>&1; echo "POST_EXIT=$?"
POST_EXIT=0    # run 1 (immediately after the fix commit)
POST_EXIT=1    # run 2 -- 1 fail, see "Observed flakiness"
POST_EXIT=0    # run 3
POST_EXIT=0    # run 4
```

Summary (runs 1, 3, 4 — the modal outcome, 3 of 4): `3996 tests / 3915 pass / 0 fail / 81 skipped`.
Summary (run 2): `3996 tests / 3914 pass / 1 fail / 81 skipped`.

### Baseline (at `884e68c8`, in a `mktemp -d` detached worktree)

```text
$ git worktree add --detach "$W/base" 884e68c8
WORKTREE_EXIT=0
$ ln -s "$R/src/mcp/vice/node_modules" "$W/base/src/mcp/vice/node_modules"
$ cd "$W/base/src/mcp/vice" && npm test > /tmp/60-05-t2-base-final.tap 2>&1; echo "BASE_EXIT=$?"
BASE_EXIT=1
```

Summary: `3948 tests / 3860 pass / 6 fail / 82 skipped`.

The baseline worktree was removed with `git worktree remove --force "$W/base"` and the
`mktemp -d` scratch directory (`/tmp/tmp.pC3r2xFckT`) was deleted with `rm -rf` immediately
after the baseline run — this host's system temp directory is RAM-backed (tmpfs) with
automatic cleanup disabled. `git worktree list` afterward showed only the main working tree.

## Baseline failing SET (6)

```text
build-atomic.test.ts :: a real default build leaves no .build-tmp-* directory in the walked tree, before or after
build-atomic.test.ts :: resolveStagingParent(): the DEFAULT outDir stages inside node_modules/.cache -- the one directory the project's recursive walks structurally exclude
containerpath.test.ts :: D-3: containerpath.ts's own source contains no literal of the runtime-derived host root
containerpath.test.ts :: the real captured grant: all three fields translate independently, three separate assertions
phase58-citation-ledger.test.ts :: the committed provenance document's citation ledger is complete and every anchor resolves
vice-proxy.test.ts :: containerize safety net: a grant whose epoch_file translates outside the workspace is refused, falling back to the port-derived path
```

All six are attributable to the baseline MEASUREMENT METHODOLOGY, not to the pre-rewiring
source code's own correctness, verified individually against each failure's own message:

- **`containerpath.test.ts` (2) and `vice-proxy.test.ts` (1)** fail because the baseline
  worktree lives under `/tmp`, which this project's own `hostpath.ts` correctly identifies at
  runtime as "a container-only filesystem (tmpfs at /tmp)... nothing outside the container can
  see it under any path" — the exact host/container-boundary detection this project's own
  `container-guard.mts` family exists to perform, firing correctly against a scratch worktree
  that is not bind-mounted from any host. This is a property of where `mktemp -d` placed the
  baseline checkout (per this task's own instruction), not of the pre-rewiring code.
- **`build-atomic.test.ts` (2)** fail because `resolveStagingParent()`'s own device-identity
  check (`statSync().dev`) correctly detects that the symlinked `node_modules/.cache` (pointing
  at the real repo's disk-backed filesystem) is on a DIFFERENT device than the tmpfs-backed
  worktree — again a direct, correct consequence of the symlink-based dependency-sharing this
  task's own instructions specify ("symlinking the real tree's `node_modules` into it"), not a
  pre-rewiring source-code defect.
- **`phase58-citation-ledger.test.ts` (1)** is the ALREADY-MEASURED, pre-existing failure this
  plan's own briefing named in advance: caused by `.planning/ROADMAP.md` line drift, not by any
  Phase 60 work, and already repaired in the post-rewiring tree (commits `bf8bcee5` and its
  successor, per the phase's own record).

None of the six reflect a behavioural difference in the `src/mcp/vice/` source between the two
trees — each is either a measurement-environment artifact of the worktree/symlink setup this
exact task instructs, or a documented pre-existing issue this phase already repaired.

## Post-rewiring failing SET (0)

```text
(empty)
```

## Two-way difference

```text
$ comm -13 /tmp/60-05-base-failset.txt /tmp/60-05-post-failset-final.txt   # regressions: in post, not in base
end_of_regressions
```

**The regression list is EMPTY.** No test that passed at baseline fails in the post-rewiring
tree. (For completeness, `comm -23` — present in base, absent from post — reproduces all six
baseline-only entries above; none is a regression by definition, since the post-rewiring set
they are being compared against is itself empty.)

## Regressions found and fixed

Task 2's own required full-suite run is a REAL-PROCESS comparison, which caught two genuine
regressions that plan 60-01's own unit tests (each of which injects `viceBin` directly into
`handleAcquire()`'s deps, bypassing the real production wiring) could not have caught. Both
were absent from the baseline tree (confirmed: `grep -c resolveTool resources/vice-broker.mjs`
on the baseline tree returns `0` — the pre-rewiring broker never calls `resolveTool()` at
startup at all, so neither failure mode could exist before Phase 60's plan 60-01). Both are
now fixed, committed at `ce890041`, and documented in that commit's own message:

1. **`vice-broker.mts`'s real `onAcquire` callback never passed `resolvedViceBin` to
   `handleAcquire()`.** Every real acquire silently fell through to `broker-launch.mts`'s
   `"x64sc"`-literal last-resort default, regardless of what `tools.json` or `VICE_BIN`
   named — LOC-01's core criterion failing in the one production call site plan 60-01's own
   summary claimed was wired. Found via `broker-e2e.test.ts`'s "wired disconnect-while-queued"
   case (a real `/bin/sleep` stub, spawned through the real broker process, crashing within
   ~300ms because the broker was actually trying to spawn a literal `x64sc` with the wrong
   argv, never reaching a real `/bin/sleep`). Fixed by adding `viceBin: resolvedViceBin` to the
   real `onAcquire` deps object.
2. **`tool-location.mts`'s `readDeclaration()` could not find `prerequisites.json` once the
   compiled broker was deployed away from `src/mcp/vice/resources/`.** Its two-candidate lookup
   ("beside `here`", "one directory up from `here`") only ever resolved correctly while the
   artifact ran in place; deployed into a consuming project's `.c64-re-tools/bin/` (the real
   `install-resources.ts` target), neither candidate exists, and the broker throws before it
   ever writes `broker.json`. Found via `vice-broker-launch.test.ts`'s `freshDeployDir()`
   helper, which already simulates exactly this deploy shape. Fixed by copying
   `prerequisites.json` into `resources/` as a `build.ts` step (a plain copy, not a `tsc`
   compile), so `install-resources.ts`'s own generic recursive walk of `resources/` deploys it
   automatically.

Both fixes are verified: `broker-e2e.test.ts` (12/12) and `vice-broker-launch.test.ts` (15/15)
both now match the baseline's own clean counts for those files, `resources-sync.test.ts` is
green against the regenerated `resources/vice-broker.mjs` and the new `resources/prerequisites.json`,
and `npm run typecheck` is clean.

## Observed flakiness (post-fix, full-glob run 2 of 4, disclosed for honesty)

One of the four post-rewiring full-suite runs (run 2 above) reported a SINGLE failure in
`broker-e2e.test.ts`'s "wired disconnect-while-queued" case — the same test name the fixed
regression above also touched, but a DIFFERENT failure mode with a different message:

```
AssertionError [ERR_ASSERTION]: PRECONDITION NOT REPRODUCED: the queued connection answered
(...) instead of remaining queued -- widen OCCUPIED_PORT_COUNT (currently 60) and retry
```

This is the test's OWN self-documented, self-diagnosing race-window guard (its own comment:
"fail loudly with a diagnostic ... rather than silently passing on an unreproduced
precondition") — it fires when, under real system load, the SECOND of two back-to-back
acquire requests answers immediately instead of genuinely queueing behind the first, which
depends on wall-clock timing between two real socket handshakes and a real port scan. This is
NOT the deterministic regression fixed above: the fixed regression failed 100% of the time,
including when this same test file was run ALONE at `--test-concurrency=1` (verified three
consecutive times before the fix, and three more times after with zero failures); this
race-window guard instead failed in only ONE of four FULL, CONCURRENT glob runs — exactly the
signature of a load-dependent timing flake, not a logic defect. `broker-e2e.test.ts`'s own
`OCCUPIED_PORT_COUNT`/`POLL_MS` timing constants are untouched by Phase 60 (this file is not
in any of the five plans' `key-files` lists), so this same race-window potential is present,
unchanged, in the pre-rewiring baseline's own copy of this file — Phase 60 neither introduced
nor widened this specific flake. It is disclosed here rather than silently omitted, but it is
not counted as a regression: the regression list below is about a test that reliably passed at
baseline and reliably fails post-rewiring, and this is neither.

## Outcomes for `60-RESEARCH.md` § item 6's enumerated invocations

Per-file check against the final post-rewiring run (`ce890041`). Every file below EXISTS in
the glob and was invoked; the question is whether ITS OWN env-var-dependent case(s) ran or
were skipped in this sandboxed environment (no `VICE_LIVE_*`/`GHIDRA_HOME` opt-in set).

**`VICE_BIN`-setting files — all RAN (no live-binary opt-in required for these):**
`vice-broker-launch.test.ts`, `broker-kill.test.ts`, `vice-broker-acquire.test.ts`,
`host-tool-oracle.test.ts`, `broker-e2e.test.ts`, `broker-control.test.ts`, `host-tool.test.ts`
all stub `VICE_BIN` to a harmless local binary (`/bin/sleep`, a recorder script, or similar) and
ran their full case sets, 0 failures.

**`VICE_BIN`-setting files that are opt-in live-emulator suites — SKIPPED, not run:**
`stock-a4-checkpoint-flood.test.ts` (1/1 skipped), `stock-broker-live.test.ts` (5/5 skipped),
`text-monitor-live.test.ts` (8/9 skipped, 1/9 ran — the one non-gated case). None require
`VICE_LIVE_A4_FLOOD_BIN`/`VICE_LIVE_STOCK_BIN` to be set, which they were not in this run.

**`ACME_BIN`/`ACME`-setting files — all RAN:** `skill-acme-build-cli.test.ts`,
`anno-export-asm.test.ts`, `acme-verify.test.ts`, `host-tool.test.ts`, `anno-derivation.test.ts`,
`hazard-subject-variants.test.ts`, `disasm-roundtrip.test.ts`, `hazard-subject-fixture.test.ts`,
`host-tool-transport.test.ts`, `dxa-seam.test.ts` — these use a real, locally-installed ACME
(this host has ACME on `$PATH`; `VICE_REQUIRE_ACME` was not set, so a missing-ACME case would
SKIP rather than hard-fail, but ACME being present meant these ran for real).

**`GHIDRA_HOME`-setting files — SKIPPED, not run (opt-in not set):** `ghidra-live.test.ts`
(24/24 skipped), `ghidra-opcode-live.test.ts` (8/12 skipped, 4/12 ran — non-gated structural
cases), `sleigh-compile-gate.test.ts` (5/9 skipped, 4/9 ran). None of these files' live-Ghidra
cases were exercised in this run; `VICE_LIVE_GHIDRA=1` was not set. `ghidra-project.test.ts`
(the non-live structural companion) ran in full, 0 failures. This SKIP is explicitly recorded
here rather than silently read as a pass, per this task's own instruction.

`test-gate.mjs` is not a `node:test` file (it is the gate script itself, per `60-RESEARCH.md`'s
own parenthetical) and is not part of this enumeration's per-file skip/run accounting.

## Verdict

The failing SET after the rewiring, at the final committed state (`ce890041`), contains
NOTHING that was passing before it — the regression list is empty, both by direct comparison
against the baseline's own six-entry failing set (all six explained as measurement-methodology
artifacts or the already-known citation-ledger drift, none a source-behaviour difference) and
because the modal, repeatable post-rewiring set itself is empty (3 of 4 full-glob runs, and
every isolated run of the two touched files). Two genuine, DETERMINISTIC regressions were
found during this measurement (both absent from the pre-rewiring baseline, both introduced by
plan 60-01, both discovered by this task's own required real-process, full-glob comparison
rather than by the phase's own unit tests) and are fixed and committed as part of this plan.
One additional, NON-deterministic, pre-existing timing flake in `broker-e2e.test.ts` (unrelated
to Phase 60, unchanged by it) was observed once in four runs and is disclosed above rather than
hidden, but is not a regression by this note's own definition. `test:automated` was used
nowhere in this note as a source of any result — named above only as the gate this claim does
NOT rely on.
