# Phase 60 — Gap-Closure Full-Suite Failing-Set Difference (LOC-03, second baseline)

Plan 60-07, Task 2. Re-measures "nothing changed for anyone who already had it working" as a
SET difference between the tree as it stood at the end of the phase's first execution and the
tree as it stands after this gap-closure pass — repeating plan 60-05's own method
(`phase60-suite-set-diff.md`) for the second time in this phase, because plan 60-06 changed the
environment-layer contract that claim is about. Never a total or a percentage, per this
project's own operational record of three distinct ways to measure this claim wrongly (Pitfall
3, `60-RESEARCH.md`), and per `60-VALIDATION.md`'s two standing facts binding every command in
this note.

## SHAs

- **Baseline (the tree as it stood at the end of the phase's first execution):** `ce890041`
  (`ce89004169bdb295b93e2da1e5757c2806791fdf`) — "fix(60-05): thread the resolved viceBin into
  the broker's real onAcquire wiring, and deploy prerequisites.json alongside every compiled
  artifact." This is the same commit `60-VERIFICATION.md` was run against and the same commit
  plan 60-05's own evidence note ends on.
- **Post-gap-closure (this note's final measurement):** `e3beb3f5`
  (`e3beb3f50bc89c82ec18c7d9418e98ff4221de0e`) — "fix(60-07): repair citation-ledger line drift
  surfaced by the full-suite regression measurement," itself built on `d7d5a151`
  ("feat(60-07): the seam's own reason reaches the c1541 and petcat refusals a user reads") and
  on plan 60-06's two commits (`40dcf216`, `3d9b69d5`). Both `d7d5a151` and `e3beb3f5` are
  committed before this evidence note.

## Commands, exit status, and the no-broker precondition

Every command below is the FULL `npm test` glob (`node --test '*.test.*'`), never
`npm run test:automated`, which filters out `MANUAL_ONLY_TESTS` (`test-gate.mjs`) and therefore
cannot support this claim. Every exit status is read on the SAME line as the redirect, never
through a pipe.

**Precondition, both runs:** no `vice-broker` process running. Checked with a
self-exclusion pattern (`pgrep -af '[v]ice-broker'`) so the check's own shell invocation text —
which trivially contains the search string `vice-broker` once quoted for `eval` — is never
mistaken for a match; the bracket around the first letter is a regex character class of one,
matching the literal `v`, so the invoking process's own command line (`pgrep -af '[v]ice-broker'`
itself, spelled with a bracket) never satisfies its own pattern.

```text
$ pgrep -af '[v]ice-broker'
(no output, exit 1)
```

Re-run immediately before the final post-gap-closure measurement, and again after both the
baseline and post runs completed, with the identical empty result both times.

### Baseline (at `ce890041`, in a `mktemp -d` detached worktree)

```text
$ W=$(mktemp -d)
$ git worktree add --detach "$W/base" ce890041
WORKTREE_EXIT=0
$ ln -s "$R/src/mcp/vice/node_modules" "$W/base/src/mcp/vice/node_modules"
$ cd "$W/base/src/mcp/vice" && node --test --test-reporter=tap '*.test.*' > /tmp/60-07-t2-base.tap 2>&1; echo "BASE_EXIT=$?"
BASE_EXIT=1
```

Summary: `3996 tests / 3909 pass / 5 fail / 82 skipped`.

The baseline worktree was removed with `git worktree remove --force "$W/base"` and the
`mktemp -d` scratch directory was deleted with `rm -rf` immediately after the baseline run —
this host's system temp directory is RAM-backed (tmpfs) with automatic cleanup disabled.
`git worktree list` afterward showed only the main working tree, confirmed both immediately
after removal and again at the end of this task.

### Post-gap-closure (final, at `e3beb3f5`)

```text
$ cd src/mcp/vice && node --test --test-reporter=tap '*.test.*' > /tmp/60-07-t2-post-final.tap 2>&1; echo "POST_EXIT=$?"
POST_EXIT=0
```

Summary: `4020 tests / 3939 pass / 0 fail / 81 skipped`.

**Reporter note:** this run passes `--test-reporter=tap` explicitly. Node 24.20.0's default
`node --test` reporter on this host is the spec-style reporter (`✔`/`✖`) even when stdout is
redirected to a file, so a bare `npm test > file 2>&1` produces no `# tests`/`# pass`/`# fail`
summary line and no `not ok` line to grep for — the regex-based failing-set extraction this
task's own verify block specifies would silently report zero failures regardless of the real
result. `--test-reporter=tap` (placed before the glob argument; `node --test '*.test.*'
--test-reporter=tap` is parsed as a glob, not a flag) restores the TAP summary and `not ok`
lines this note's failing-set extraction depends on, with no other behavioural difference.

## Baseline failing SET (5)

```text
build-atomic.test.ts :: a real default build leaves no .build-tmp-* directory in the walked tree, before or after
build-atomic.test.ts :: resolveStagingParent(): the DEFAULT outDir stages inside node_modules/.cache -- the one directory the project's recursive walks structurally exclude
containerpath.test.ts :: D-3: containerpath.ts's own source contains no literal of the runtime-derived host root
containerpath.test.ts :: the real captured grant: all three fields translate independently, three separate assertions
vice-proxy.test.ts :: containerize safety net: a grant whose epoch_file translates outside the workspace is refused, falling back to the port-derived path
```

All five are attributable to the baseline MEASUREMENT METHODOLOGY this task's own instructions
specify (a `mktemp -d` scratch worktree under this host's RAM-backed `/tmp`, dependencies shared
via a symlink into the real tree), not to the baseline commit's own source-code correctness —
this is the identical failure class plan 60-05's own prior evidence note (`phase60-suite-set-diff.md`)
already found and explained for the same reason, reproduced here because the same baseline
methodology is used again:

- **`containerpath.test.ts` (2) and `vice-proxy.test.ts` (1)** fail because the baseline
  worktree lives under `/tmp`, which this project's own `hostpath.ts` correctly identifies at
  runtime as "a container-only filesystem (tmpfs at /tmp)... nothing outside the container can
  see it under any path" — the host/container-boundary detection `container-guard.mts` exists to
  perform, firing correctly against a scratch worktree that is not bind-mounted from any host.
- **`build-atomic.test.ts` (2)** fail because `resolveStagingParent()`'s own device-identity
  check (`statSync().dev`) correctly detects that the symlinked `node_modules/.cache` (pointing
  at the real repo's disk-backed filesystem) is on a DIFFERENT device than the tmpfs-backed
  worktree — a direct, correct consequence of the symlink-based dependency-sharing this task's
  own instructions specify, not a baseline source-code defect.

None of the five reflect a behavioural difference in the `src/mcp/vice/` source between the two
trees — each is a measurement-environment artifact of the worktree/symlink placement this exact
task instructs. Unlike plan 60-05's own baseline set, `phase58-citation-ledger.test.ts` does NOT
appear here: at `ce890041` every citation in both provenance documents still resolves against
the live source (60-06 and this plan had not yet shifted any cited line).

## Post-gap-closure failing SET (0)

```text
(empty)
```

## Two-way difference

```text
$ comm -13 /tmp/60-07-base-failset.txt /tmp/60-07-post-failset-final.txt   # regressions: in post, not in base
end_of_regressions
```

**The regression list is EMPTY.** No test that passed at baseline fails in the post-gap-closure
tree. (For completeness, `comm -23` — present in base, absent from post — reproduces all five
baseline-only entries above; none is a regression by definition, since the post-gap-closure set
they are being compared against is itself empty.)

## Regressions found and fixed

This task's own required full-suite run is a REAL comparison, and its first pass (measured
against `d7d5a151`, Task 1's own commit, before this task's fix) was NOT empty: it surfaced two
`phase58-citation-ledger.test.ts` failures absent from the baseline —

```text
phase58-citation-ledger.test.ts :: the committed provenance document's citation ledger is complete and every anchor resolves
phase58-citation-ledger.test.ts :: the committed phase59 placement document's citation ledger is complete and every anchor resolves
```

— a genuine regression by this task's own definition, even though the drifted citations inside
these two tests trace to two different plans:

1. **Four `docs/phase58-declaration-provenance.md` citations into `src/mcp/vice/host-tool.mts`
   drifted when this plan's own Task 1 inserted code above them** (the WR-01 refusal branches at
   the former lines 1725/1806, the WR-02 memo header comment above the former line 2396, and the
   cumulative shift reaching the former line 3080). **Caused by this plan.**
2. **One `.planning/ROADMAP.md` citation had drifted from unrelated ROADMAP edits accumulated
   since the citation was written** (orchestrator-driven progress-table updates across this
   phase's plans, not any single plan's source diff). **Not caused by this plan or by 60-06 —
   pre-existing drift this measurement happened to be the first to catch.**
3. **Two `docs/phase59-tool-location-placement.md` citations (`backend-detect.mts`,
   `tool-location.mts`) drifted when plan 60-06 rewired the environment layer and retired the
   hardcoded `"x64sc"` display-name literal (IN-01).** **Caused by plan 60-06.**

All seven were fixed in this plan rather than merely reported, per this task's own acceptance
criterion ("If a test that passed at baseline fails now and is not on the deliberate list, the
verdict names it and this task is NOT done") and per plan 60-05's own precedent for the identical
situation (regressions found by this same required full-suite task, fixed within the plan that
found them, because this gap-closure wave's plan 60-07 is the last plan and there is no
successor to hand a still-open regression to). Fix: updated each drifted citation's line number
(or, for the `.mts` citations, the anchor text as well where the exact literal had moved) to the
current source, re-verified against the live files by re-running the citation-ledger test itself
rather than by inspection alone. Also added one new ledger entry
(`src/mcp/vice/host-tool.mts:1396-1409`) for a citation this fix's own prose introduced, since
the citation-ledger test enforces that every `file:line` citation in a document's body has a
matching ledger entry. Committed at `e3beb3f5`, verified: `phase58-citation-ledger.test.ts` 11/11
green, and the full suite (below) returns to empty.

No `src/mcp/vice` production or test source was touched by this fix — both drifted-citation
causes are documentation-only, and the fix commit's own diff is exactly the two `docs/*.md`
files.

## Deliberate contract changes named (so a reader can tell intended from regression)

- **The renamed test from plan 60-06.** The test in `src/mcp/vice/tool-location.test.ts`
  previously named `"nothing answers: path/layer/mechanism are null and tried lists the
  environment candidate first, PATH candidates last"` was rewritten in place by plan 60-06 into
  two tests: `"an environment variable set to a bare name that resolves nowhere refuses, and
  resolution never reaches the declared-id $PATH probe"` (the new, intended behaviour — a
  slash-free, unresolvable override now refuses by name instead of silently falling through to a
  `$PATH` search for the declared id) and `"an environment variable set to an absolute path that
  does not exist behaves exactly as today: not refused, falling through to the declared-id
  $PATH probe"` (an explicit control proving the separator-containing case is UNCHANGED). Both
  names are confirmed present, verbatim, in the committed `tool-location.test.ts` (lines
  164 and 208 respectively) and are marked `REWRITTEN IN PLACE (Plan 60-06, LOC-03 gap closure,
  deliberate)` in a code comment immediately above the first. This is the one shipped test whose
  intent plan 60-06 deliberately changed, and it is not present in either failing set above
  (neither name appears in the baseline SET or the post SET — the old name no longer exists to
  fail, and the two new names both pass).
- **The seven citation-ledger fixes above** are, by definition, corrections to documentation
  that had fallen out of sync with source the plans themselves deliberately changed (60-06's
  environment-layer rewrite, this plan's own WR-01 refusal branches) — not new behaviour, and
  listed under "Regressions found and fixed" rather than here because the citations themselves
  had genuinely gone stale (a real, if narrow, defect), not because any plan meant to change what
  they said.
- **A known limit of plan 60-06's own contract, recorded here per the orchestrator's standing
  note rather than left implicit:** a separator-containing, unresolvable environment override
  (e.g. an absolute `VICE_BIN`/`ACME_BIN` path that does not exist) still falls through to a
  declared-id `$PATH` probe and can still silently substitute a different binary, with
  `refusal: null` — the identical CR-01 shape plan 60-06 closed for the separator-FREE case only.
  This is NOT a defect this plan is asked to fix, and NOT something this task widens scope over;
  it is 60-06's own deliberate, documented scoping decision (its own SUMMARY's "Terminal refusal
  scoped to separator-free values only" deviation), reconciling the plan's must-have truth ("a
  value containing a path separator behaves exactly as today") with the pre-existing, unmodified
  `vice-broker-acquire.test.ts` "Plan 60-01 Test 4". Recorded here as a carried-forward, accepted
  limit with that provenance, not as a gap this evidence note found.

## Outcomes for `60-RESEARCH.md` § item 6's enumerated invocations

Per-file check against the final post-gap-closure run (`e3beb3f5`). Every file named in
`60-RESEARCH.md` § item 6 EXISTS in the glob and was invoked; the question is whether its own
env-var-dependent case(s) ran or were skipped in this sandboxed environment (no `VICE_LIVE_*` /
`GHIDRA_HOME` opt-in set for this run).

**`VICE_BIN`-setting files that stub to a harmless local binary — all RAN (no live-binary opt-in
required):** `vice-broker-launch.test.ts`, `broker-kill.test.ts`, `vice-broker-acquire.test.ts`,
`host-tool-oracle.test.ts`, `broker-e2e.test.ts`, `broker-control.test.ts`, `host-tool.test.ts` —
0 failures in any of these files.

**`VICE_BIN`-setting files that are opt-in live-emulator suites — SKIPPED, not run (category:
live emulator, `VICE_LIVE_*` not set):** `stock-a4-checkpoint-flood.test.ts` (1 case skipped),
`stock-broker-live.test.ts` (5 skipped), `stock-live-broker-monitor.test.ts` (1 skipped),
`stock-live-triage.test.ts` (3 skipped), `stock-live.test.ts` (10 skipped), `text-monitor-live.test.ts`
(8 skipped), `text-tools.test.ts`'s `vice_memmap_zap` live case (1 skipped), `anno-tools.test.ts`'s
live `anno_evid_ingest` case (1 skipped). None require `VICE_LIVE_STOCK_BIN` /
`VICE_LIVE_STOCK_BIN_39` / `VICE_LIVE_STOCK_BIN_310` / `VICE_LIVE_A4_FLOOD_BIN` /
`VICE_LIVE_BROKER_BIN` / `VICE_LIVE_TRIAGE_BIN` to be set, which they were not in this run — a
host without a live stock VICE opted in for this measurement, an expected skip category on this
host per this project's own operational record.

**`ACME_BIN`/`ACME`-setting files — all RAN:** `skill-acme-build-cli.test.ts`,
`anno-export-asm.test.ts`, `acme-verify.test.ts`, `host-tool.test.ts`, `anno-derivation.test.ts`,
`hazard-subject-variants.test.ts`, `disasm-roundtrip.test.ts`, `hazard-subject-fixture.test.ts`,
`host-tool-transport.test.ts`, `dxa-seam.test.ts` — this host has a real, locally-installed ACME
on `$PATH`, and `VICE_REQUIRE_ACME` was not set (so a missing-ACME case would SKIP rather than
hard-fail), but ACME being genuinely present meant these ran for real, 0 failures.

**`GHIDRA_HOME`-setting files — SKIPPED, not run (category: live Ghidra, `VICE_LIVE_GHIDRA=1` not
set for this run):** `ghidra-live.test.ts` (24 skipped), `ghidra-opcode-live.test.ts` (8
skipped), `sleigh-compile-gate.test.ts`'s COMPILE half (5 skipped). `ghidra-project.test.ts`
(the non-live structural companion, not itself in the item-6 enumeration) ran in full, 0
failures. This host has a real, non-standard-path Ghidra install per this project's own
operational record, but this specific run did not opt in via `VICE_LIVE_GHIDRA=1`; the skip is
explicitly recorded here rather than silently read as a pass.

**Additional opt-in live/manual categories observed in this run's 81-line skip set, outside
item 6's four-variable enumeration but disclosed for completeness:** `dxa-live.test.ts` (5
skipped — category: live dxa, `VICE_LIVE_DXA` not set), `anno-store-export.test.ts`'s live tier
(1 skipped — category: live annotation-store export, `ANNO_STORE_EXPORT_LIVE_STORE` not set), the
upstream re-hash check (1 skipped — category: live upstream-clone comparison,
`ANNO_UPSTREAM_CLONE` not set), and `vice-proxy.test.ts`'s three container-workspace cases (3
skipped — category: requires `CONTAINER_WORKSPACE_PATH`/`HOST_WORKSPACE_PATH` set in this
process's own environment when the file is run directly, not a live-tool gate). Sum of every
category above: 24+8+5+5+1+5+1+3+10+8+1+1+1+1+3 = 81, exactly the run's own reported skip count —
no skip in this run is unaccounted for by a named category.

`test-gate.mjs` is not a `node:test` file (it is the gate script itself, per `60-RESEARCH.md`'s
own parenthetical) and is not part of this enumeration's per-file skip/run accounting.

## Verdict

The failing SET after this gap-closure pass, at the final committed state (`e3beb3f5`), contains
NOTHING that was passing before it. The regression list is empty by direct comparison against
the baseline's own five-entry failing set (all five explained as measurement-methodology
artifacts of the `mktemp -d`/`/tmp` worktree this task's own instructions specify, none a
source-behaviour difference), and the post-gap-closure set itself is empty. This task's own
first measurement pass DID surface two genuine regressions (both `phase58-citation-ledger.test.ts`
subtests, absent from the baseline), traced to stale line citations — two caused by this plan's
own Task 1, four caused by plan 60-06's environment-layer rewrite, one pre-existing and unrelated
to either — and all seven were fixed within this plan (documentation only, no production or test
source touched) rather than merely reported, per this task's own acceptance criterion and per
plan 60-05's own precedent for a regression found by this exact required measurement in the
phase's last plan. The one deliberate contract change from plan 60-06 (the renamed
`tool-location.test.ts` test, both old and new names given above) is confirmed present under its
new names in the passing post-gap-closure set and absent under its old name from both sets.
`test:automated` was used nowhere in this note as a source of any result — named above only as
the gate this claim does NOT rely on.
