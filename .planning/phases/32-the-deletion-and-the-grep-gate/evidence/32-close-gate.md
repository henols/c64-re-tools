# Phase 32 — close-gate run (D-12–D-15)

Every figure below is one the reader can re-derive by running the command printed
immediately above it. Nothing here is a summary of a run; each block is the command as
executed and its raw captured output.

---

## 0. Run identity

**Which tree.** This run was taken in the **GSD worktree** for plan 32-09, not in the
developer's main checkout:

```
$ git rev-parse --show-toplevel
/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a5561dbf359bcb095
```

That distinction is load-bearing twice over, and both consequences are stated where
they bite (§1a and §9). The main checkout does **not** contain this plan's CI change,
so a gate run there would have measured a different tree.

**Commit measured.**

```
$ git rev-parse HEAD
0d7d328fa3baad42222b758ba7ff9068ef64b565
```

`0d7d328` is plan 32-09 Task 1 — the commit that wired the audited-guard fate gate into
CI and added `fetch-depth: 0` to the build job's checkout. Its parent is `90b5a0a`, the
wave-6 tip.

**Date.** 2026-08-31. Run start `2026-08-31T18:59:49Z`, run end `2026-08-31T19:14:13Z`.

**Broker state, BEFORE the first leg.** Read-only. Nothing in this run stops, kills,
restarts or otherwise touches the developer's `vice-broker` systemd user unit (D-13).

```
$ systemctl --user is-active vice-broker
inactive
exit=4
```

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep
exit=1          (no output — no matching process)
```

```
$ ps -eo pid,args | grep -i x64sc | grep -v grep
exit=1          (no output — no emulator running)
```

> **Why `ps | grep -v grep` and not `pgrep -af vice-broker`.** The bare `pgrep` form
> **self-matches**: it finds its own wrapping command line and reports a hit on an idle
> host. Measured in this very run:
>
> ```
> $ pgrep -af 'vice-broker'
> 441645 /bin/bash -c ... eval 'pgrep -af '"'"'vice-broker'"'"'; echo "exit=$?"' ...
> exit=0
> ```
>
> That is the shell wrapper, not a broker. Recording `exit=0` from it would have
> asserted a live broker on a host that had none — the precise inversion of the fact
> D-13's precondition exists to establish. The `ps`-based form above is the one whose
> output is trustworthy, and it is the form every broker reading in this document uses.

**Tree state, BEFORE the first leg.**

```
$ git status --porcelain
                (empty)
exit=0
```

> A worktree checkout does not carry the four untracked files the plan anticipated
> (`docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`,
> `docs/vice-mcp-ideas.md`, `skills-lock.json`) — those are untracked in the developer's
> main checkout and untracked files do not propagate into a linked worktree. An empty
> porcelain here is therefore the *stricter* reading of "clean", not a missing one.

---

## 1. The automated leg

```
$ cd src/mcp/vice && npm run test:automated
```

Raw tail (`node --test`'s own summary block):

```
1..2742
# tests 2950
# suites 24
# pass 2943
# fail 1
# cancelled 0
# skipped 1
# todo 5
# duration_ms 48335.38338
```

Process exit status: **1**.

### 1a. The single failure is a worktree measurement artifact, and here is the proof

```
$ grep -n '^not ok' <capture>
10386:not ok 1477 - path agreement (D-3, D-6, THE regression this task exists to catch): the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

Its raw failure block:

```
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a5561dbf359bcb095/src/mcp/vice/repo-root.test.ts:178:1'
  failureType: 'testCodeFailure'
  error: 'the agreed directory must not sit under .claude -- got /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a5561dbf359bcb095/.vice-supervisor (the exact regression a naive move would introduce)'
  code: 'ERR_ASSERTION'
  expected: true
  actual: false
```

Three independent lines establish that this is the environment failing its own
assertion, not a regression:

1. **The error message names the cause verbatim.** The assertion is
   `!supervisorDir().includes(".claude")`. A GSD worktree's root *is*
   `<repo>/.claude/worktrees/agent-*`, so the assertion is structurally unsatisfiable
   in any worktree. It is measuring the path Claude Code's `isolation="worktree"`
   always uses.
2. **The delta against the main checkout is exactly one test.** The orchestrator
   measured `npm run test:automated` in the **main checkout** at this run's parent
   commit `90b5a0a`: `tests 2950 / pass 2944 / fail 0 / skipped 1 / todo 5`. This run:
   `tests 2950 / pass 2943 / fail 1 / skipped 1 / todo 5`. Identical totals; exactly
   one test flipped pass→fail, and it is the one above.
3. **It is already recorded, by an earlier plan, before this one ran.**
   `.planning/phases/32-the-deletion-and-the-grep-gate/deferred-items.md` §1 documents
   it, found by plan 32-01 task 2, with the same assertion quoted and the same
   attribution reasoning.

**It was not fixed and not loosened.** The assertion's own name calls it "THE
regression this task exists to catch", and the regression it guards (`.vice-supervisor`
migrating under `.claude`) is real. Blunting a guard to make a number look better —
inside a phase whose entire subject is guard vacuity — is the wrong trade made in the
worst possible place (D-12-14).

**The honest reading of this leg:** `test:automated` is green on the real tree
(0 failures, measured in the main checkout at `90b5a0a`), and is 1-failure in a
worktree for a reason that has nothing to do with the code under test. This document
does not report a bare "1 failure" that a later reader could mistake for a red.

---

## 2. The manual-only leg, worked file-by-file

The nine names were **read from the exported array**, never retyped:

```
$ node -e "import('./test-gate.mjs').then(m=>console.log(m.MANUAL_ONLY_TESTS.join('\n')))"
vice-broker-launch.test.ts
vice-proxy.test.ts
broker-e2e.test.ts
stock-live.test.ts
stock-live-triage.test.ts
stock-live-broker-monitor.test.ts
stock-broker-live.test.ts
fork-live.test.ts
stock-a4-checkpoint-flood.test.ts
```

### 2a. Default disposition — each file exactly as CI meets it

Each run: `cd src/mcp/vice && timeout 300 node --test <file>`.

```
$ timeout 300 node --test vice-broker-launch.test.ts
# tests 15   # pass 11   # fail 0   # skipped 4   # todo 0   # duration_ms 1780.66002
exit=0
```
Four skips, all one reason, quoted from the TAP output:
`# SKIP requires CONTAINER_WORKSPACE_PATH and HOST_WORKSPACE_PATH to be set (see README.md's Development section, or .github/workflows/ci.yml lines 22-23)`.
**Verdict: EXERCISED (11 of 15).** This host is not a container and sets neither
variable; CI sets both at `.github/workflows/ci.yml:22-23`, so CI exercises all 15.

```
$ timeout 300 node --test broker-e2e.test.ts
# tests 12   # pass 11   # fail 0   # skipped 1   # todo 0   # duration_ms 23334.999789
exit=0
```
One skip, same container-variable reason. **Verdict: EXERCISED (11 of 12).**

```
$ timeout 300 node --test stock-live.test.ts
# tests 14   # pass 0   # fail 0   # skipped 14   # todo 0   # duration_ms 412.48191
exit=0
```
**Verdict: DEFAULT-SKIP (14 of 14).**

```
$ timeout 300 node --test stock-live-triage.test.ts
# tests 3    # pass 0   # fail 0   # skipped 3    # todo 0   # duration_ms 428.798217
exit=0
```
**Verdict: DEFAULT-SKIP (3 of 3).**

```
$ timeout 300 node --test stock-live-broker-monitor.test.ts
# tests 1    # pass 0   # fail 0   # skipped 1    # todo 0   # duration_ms 330.001353
exit=0
```
**Verdict: DEFAULT-SKIP (1 of 1).**

```
$ timeout 300 node --test stock-broker-live.test.ts
# tests 5    # pass 0   # fail 0   # skipped 5    # todo 0   # duration_ms 511.775315
exit=0
```
**Verdict: DEFAULT-SKIP (5 of 5).**

```
$ timeout 300 node --test fork-live.test.ts
# tests 6    # pass 0   # fail 0   # skipped 6    # todo 0   # duration_ms 318.955116
exit=0
```
**Verdict: DEFAULT-SKIP (6 of 6).**

```
$ timeout 300 node --test stock-a4-checkpoint-flood.test.ts
# tests 1    # pass 0   # fail 0   # skipped 1    # todo 0   # duration_ms 489.120651
exit=0
```
**Verdict: DEFAULT-SKIP (1 of 1).**

### 2b. `vice-proxy.test.ts` — run LAST, under an explicit bound, and it did not terminate

```
$ timeout 180 node --test vice-proxy.test.ts
exit=124
```

`exit=124` is `timeout(1)`'s "the command timed out" status. **The timeout IS the
measured result**, recorded as such rather than retried unbounded. It produced 1063
lines of partial TAP before the bound fired, carrying 39 `not ok` lines whose errors are
all downstream of the deliberately-absent broker, e.g.:

```
  error: |-
    The input did not match the regular expression /no broker lease is held/. Input:
    'vice: the on-demand VICE broker has never been started on this host -- no broker.json record exists at all. ...'
```

This is not new: plan 32-07 measured the same file **still running when killed at
300106 ms**, and it is entry **#26** on the broken-windows ledger. That single file is
why `npm test` — the bare full glob `node --test '*.test.*'` — **cannot be run to
completion on this host**, and why this leg is worked file-by-file instead. That
substitution is stated here rather than performed quietly: **the whole-glob form was
not run to green locally, and nothing in this document claims it was.**

### 2c. Local opt-in runs — the real upgrade over CI's evidence, and its exact size

Six of the nine are opt-in behind a per-file environment variable naming a VICE binary.
Two genuine binaries exist on this host:

```
$ /usr/bin/x64sc --version
x64sc (VICE 3.9)
$ /usr/local/bin/x64sc --version
x64sc (VICE 3.10)
$ /usr/local/bin/x64sc -help | grep -ci mcpserver
0
```

```
$ VICE_LIVE_STOCK_BIN=/usr/bin/x64sc VICE_LIVE_STOCK_BIN_39=/usr/bin/x64sc \
  VICE_LIVE_STOCK_BIN_310=/usr/local/bin/x64sc timeout 600 node --test stock-live.test.ts
# tests 14   # pass 14   # fail 0   # skipped 0   # todo 0   # duration_ms 13297.652902
exit=0
```
**Fully exercised, 14/14, against real VICE 3.9 AND real VICE 3.10.** An intermediate
run with only the 3.9 variable set scored `pass 12 / skipped 2`; the two remaining skips
named their own remedy in the TAP output —
`# SKIP 07-13's genuine-VICE-3.10 proofs (Gap 1, CR-01's inversion) are opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN_310=/usr/local/bin/x64sc` —
and setting it took them to a real pass.

```
$ VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc timeout 600 node --test stock-live-triage.test.ts
# tests 3    # pass 3   # fail 0   # skipped 0   # todo 0   # duration_ms 10737.646542
exit=0
```
**Fully exercised, 3/3, against real stock VICE 3.9.**

```
$ VICE_LIVE_BROKER_BIN=/usr/bin/x64sc timeout 600 node --test stock-live-broker-monitor.test.ts
# tests 1    # pass 1   # fail 0   # skipped 0   # todo 0   # duration_ms 7425.286801
exit=0
```
**Fully exercised, 1/1.**

```
$ VICE_LIVE_STOCK_BIN=/usr/bin/x64sc timeout 600 node --test stock-broker-live.test.ts
# tests 5    # pass 5   # fail 0   # skipped 0   # todo 0   # duration_ms 32438.416275
exit=0
```
**Fully exercised, 5/5.**

```
$ VICE_LIVE_A4_FLOOD_BIN=/usr/bin/x64sc timeout 600 node --test stock-a4-checkpoint-flood.test.ts
# tests 1    # pass 1   # fail 0   # skipped 0   # todo 0   # duration_ms 7867.839426
exit=0
```
**Fully exercised, 1/1** — the checkpoint-flood probe against a real emulator, which CI
never sets the variable for.

```
$ VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc timeout 600 node --test fork-live.test.ts
# tests 6    # pass 0   # fail 6   # skipped 0   # todo 0   # duration_ms 20429.742138
exit=1
```
```
  error: 'waitForEndpointReady: http://127.0.0.1:34069/mcp (fork binary /usr/local/bin/x64sc) never answered within 20000ms (last error: TypeError: fetch failed)'
```
**NOT exercised — the opt-in was mis-pointed, and the fork is not installed on this
host.** `/usr/local/bin/x64sc` reports `VICE 3.10` and its own `-help` output contains
**zero** occurrences of `mcpserver`, so it is a locally-built **stock** 3.10, not the
non-upstream fork. The test failed correctly: its premise (a binary serving HTTP
JSON-RPC at `/mcp`) was false. These six failures are an opt-in pointed at the wrong
binary, not a code regression, and **not** part of the close gate's pass/fail contract —
`fork-live.test.ts`'s gate disposition is its default run in §2a, which is `exit=0`.
Recording it as "exercised" would have been the overstatement D-14 warns about in the
other direction.

**Net size of the local upgrade over CI, stated exactly:** five of the nine
manual-only files were driven against a real emulator and passed for real
(`stock-live` 14/14, `stock-live-triage` 3/3, `stock-live-broker-monitor` 1/1,
`stock-broker-live` 5/5, `stock-a4-checkpoint-flood` 1/1). Two more were partially
exercised at their default disposition (`vice-broker-launch` 11/15, `broker-e2e`
11/12). One could not be exercised because the binary it needs is not on this host
(`fork-live`). One does not terminate (`vice-proxy`). That is the whole of it.

---

## 3. The seven CI check scripts, each invoked directly as its own file name

```
$ node scripts/check-npm-packages.mjs
check-npm-packages: transitive closure from vice-proxy.ts -- 57 modules, clean
sync-skills: copied 7 skill(s) ...; excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 79 files
  @henols/c64-re-tools@0.0.0-dev -- 34 files, 7 skills
exit=0
```

```
$ node scripts/check-no-analyser.mjs
check-no-<subject>: OK -- scanned 406 files (376 tracked outside ".planning/" + 30 shipped-but-untracked installer paths, floor 350); 157 occurrence(s) permanently exempt, 0 temporarily allow-listed across 0 entries.
  permanent exemptions (exact pins):
    gate-self 5 | findings-docs 47 | attribution-guard-test 14 |
    upstream-audit-manifest-provenance 3 | memmap-measurement-provenance 1 |
    enum-name-threat-history 1 | census-design-and-incident-records 3 |
    renamed-guard-disciplines 5 | surviving-provenance 25 |
    skill-attribution-headers 24 | planted-fixtures 2 | notices-attribution-blocks 27
  temporary allow-list by discharging plan (opened 2026-08-29; asserted EMPTY since 2026-08-30, plan 29-11):
exit=0
```
The `gate-self` pin still reads **5**, and its `.github/workflows/ci.yml` component is
still pinned at exactly 1 with `===`. Confirmed independently:
```
$ grep -ac 'the external analyser' .github/workflows/ci.yml
1
```
(`grep -a` deliberately: a NUL byte can hide a file from a plain `grep`.) The CI step
added by `0d7d328` names the audited set **by role** in its `name:`, its `run:` and its
comment, so the count did not move on its own landing commit.

```
$ node scripts/check-skill-tool-coverage.mjs
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 33 files across 7 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries). anno CLI verbs: 3 parsed from anno-cli.ts, 3/3 resolved (named by at least one skill file).
exit=0
```

```
$ node scripts/check-skill-fork-honesty.mjs
check-skill-fork-honesty: OK -- 11 fork-only mentions across 33 files in 7 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
exit=0
```

```
$ node scripts/check-skill-description-overlap.mjs
check-skill-description-overlap: OK -- 7 skills scanned (acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage); 21 pairs compared (n*(n-1)/2 for n=7); observed maximum score 0.250 from c64-program-recon :: c64-provenance-diff; threshold 0.35 (inclusive); allowlist size 0; CLAUDE.md project-skills table: 7 rows, all byte-identical to their SKILL.md.
exit=0
```

```
$ node scripts/check-skill-cli-invocations.mjs
check-skill-cli-invocations: OK -- 18 documented anno CLI invocation(s) extracted from 20 of 60 skill file(s) across 2 trees (src/skills, installer/skills); 3 verb(s) covered (coverage, export-asm, render-memmap); every flag checked against anno-cli.ts's own VERB_OPTIONS, every positional against the kinds its loader reads, every REQUIRED flag for its presence, and every value-taking flag for both a value and that value's kind.
exit=0
```

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 814.
exit=0
```
This is the seventh — this phase's own, wired into CI by the commit under measurement.
It resolved both pinned commits (`0394cbc`, and `345d5c4` via the forward map) out of
the worktree's object store, which a linked worktree shares with the main repository. On
a CI runner that object store is a depth-1 clone containing neither, which is why
`0d7d328` also added `fetch-depth: 0`.

---

## 4. `docs/tool-support.md` is byte-identical to a fresh generation

The generator **writes unconditionally** — it has no `--check` mode — so run-then-diff
is the only correct form:

```
$ node scripts/generate-tool-support-table.mjs
generate-tool-support-table: wrote docs/tool-support.md
exit=0

$ git diff --exit-code -- docs/tool-support.md
                (no output)
exit=0
```

The generator rewrote the file and the result was byte-for-byte what was already
committed.

---

## 5. The docs-guard sweep

Run **without** `--json` first, deliberately. `scripts/audit-gate.mjs:1210` ends
`process.exit(result.allowed ? 0 : 1)`, and `allowed` tracks gated audits only — a
structural error such as a `DOCS_GUARD_FLOOR` breach lands in the payload's
`structuralErrors` while the process still exits **0** (broken window #28, filed by plan
32-07). Text mode exits 1 on the same condition, so text mode is the form whose exit
status can actually contradict a green:

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

The `--json` payload, inspected field by field rather than trusted via exit status:

```
$ node scripts/audit-gate.mjs --json
allowed            true
redGuards          []
structuralErrors   []
guardFiles         9
expectedGuardNames 9
statusCounts       {'tech_debt': 4, 'gaps_found': 2, 'passed': 1}
```

The nine derived docs guards, in the order `EXPECTED_DOCS_GUARD_NAMES` reports them:

```
docs-linerefs.test.ts           docs-dangling-refs.test.ts      docs-deferred-ledger.test.ts
docs-review-disposition.test.ts docs-fork-decision.test.ts      docs-core-value-decision.test.ts
docs-absorbed-decisions.test.ts docs-uat-abstention.test.ts     docs-worktree-isolation.test.ts
```

`guardFiles == expectedGuardNames == 9` — no derived guard is missing and none is extra.

---

## 6. Typecheck

```
$ cd src/mcp/vice && npm run typecheck
> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json
exit=0
```

No output from `tsc` beyond npm's own banner: no `.d.mts` drift from this phase's three
new declaration files.

---

## 7. D-14's honesty clause, stated in words

Four claims, separately, because the failure this section exists to prevent is exactly
the one where they get collapsed into a single "CI is green".

**1. CI runs the FULL `npm test` glob, on purpose, and it is green.** The build job's
Test step at `.github/workflows/ci.yml:130-161` runs `npm test` — `node --test
'*.test.*'`, the whole glob, **not** the narrower `npm run test:automated`. Its own
comment records the decision and the evidence: run **32517575905** (2026-08-21, GitHub
Actions, ubuntu-latest), whose Test-step log shows every manual-only entry running to
completion with zero failures in under two minutes wall-clock. The step also sets
`VICE_REQUIRE_ACME: "1"`, which turns "ACME absent" from a named SKIP into a hard fail
for the round-trip gate.

**2. That green proves the nine manual-only files DID NOT FAIL. It does not prove they
exercised anything.** Every one of `MANUAL_ONLY_TESTS`'s nine entries reaches its own
default-SKIP branch on the runner — none of them needs a real emulator binary to get
there, and the newest entry, the checkpoint-flood probe, is opt-in behind an
environment variable CI never sets. **CI's green therefore proves those nine did not
fail; it does not prove they exercised their subjects.** Citing the CI green alone
quietly counts nine SKIPs as coverage, and that is the exact shape of claim this
milestone has already had to correct once.

**3. The LOCAL legs are what add real exercise, and §2c states exactly how much.**
`/usr/bin/x64sc` on this host is genuine unpatched stock VICE 3.9 and
`/usr/local/bin/x64sc` is genuine unpatched stock VICE 3.10, so five of the nine ran
against a real emulator and passed for real, and two more were partially exercised at
their default disposition. One (`fork-live.test.ts`) could **not** be exercised: the
fork is not installed on this host. One (`vice-proxy.test.ts`) does not terminate. The
upgrade over CI's evidence is only as large as the files that genuinely ran, and §2c
gives the per-file breakdown rather than a rounded-up total.

**4. The union of the two legs IS the whole glob — by construction, guarded.** The seam
is this repository's own, not one invented for this audit:
`automatedTestFiles()` at `src/mcp/vice/test-gate.mjs:107-114` lists every `*.test.*`
entry in the directory and removes every `MANUAL_ONLY_TESTS` member;
`MANUAL_ONLY_TESTS` is the frozen array at `src/mcp/vice/test-gate.mjs:95-105`. So
`test:automated` ∪ `test:manual` = the full `*.test.*` glob, with no overlap and no gap,
because the second set is defined as the first's complement within it.
`src/mcp/vice/test-gate.test.ts` is the drift guard that keeps that true, and it is the
single source of truth for which files are manual-only. This document deliberately does
not restate the nine names as a second list — it points at the guard, and the one place
the names appear above (§2) is the raw output of reading the exported array itself.

---

## 8. Recorded precondition: the BACK-05 D-G ordering test and a live broker

`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`
records that the BACK-05 D-G ordering test fails **deterministically** on a host with a
live broker. It is not flaky: the failure is a function of host state, and it reproduces
every time that state holds.

That is the recorded reason D-13's broker-down precondition exists. With a live broker,
every red in this run would have been ambiguous between a real regression and an
artifact of the developer's environment — and an ambiguous red in a close-gate record is
worth nothing to the reader it is written for.

**The todo STAYS OPEN.** Nothing in this phase fixes it, and fixing it is explicitly out
of scope: ROADMAP.md scopes phase 32 to contain no build work by design. It is folded
here as a recorded precondition, not as adopted work.

A second pending todo is worth naming for the same reason — it stays open too:
`.planning/todos/pending/2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path.md`.
This run observed its symptom directly (see §9).

---

## 9. Closing state

**Broker state, AFTER the last leg.** Same two commands, same read-only form:

```
$ systemctl --user is-active vice-broker
inactive
exit=4
```

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep
exit=1          (no output)
```

**The two broker readings AGREE** (`inactive` / no process, at both ends). The run is
therefore VALID and is recorded whole. It was never voided and never restarted, and no
leg's partial output was merged from a second run — the one leg that was interrupted
(`vice-proxy.test.ts`, by its own explicit timeout) is recorded AS a timeout in §2b
rather than having its partial TAP presented as a result.

**Nothing was stopped, killed or restarted.** The unit was `inactive` before this run
began and this run did not change that (D-13, prohibition).

**Tree state, AFTER the last leg.**

```
$ git status --porcelain
                (empty)
exit=0
```

Clean. `docs/tool-support.md` was regenerated in §4 and came back byte-identical, so it
leaves no delta.

**Leaked directories removed.**

```
$ ls -d .planning/vice-proxy-evidence-test-*
.planning/vice-proxy-evidence-test-PrNv7K
$ rmdir .planning/vice-proxy-evidence-test-PrNv7K
exit=0
```

One empty directory, leaked by the `vice-proxy.test.ts` run that its own timeout
prevented from cleaning up after itself. It was empty and untracked, so it never
appeared in `git status --porcelain`; it was removed with a targeted `rmdir`. **No
`git clean` was run at any point** — inside a worktree that command deletes
branch-committed files it sees as untracked.

**Observed but NOT removed:** 200 `/tmp/vice-broker-vicerc-*` scratch directories.

```
$ ls -d /tmp/vice-broker-vicerc-* | wc -l
200
$ df -h /tmp | tail -1
tmpfs            16G  160M   16G   2% /tmp
```

This run cannot distinguish the ones it created from ones already present, and deleting
another session's scratch state would be exactly the "audit script tears down the
developer's environment" shape D-13 rejects. They are recorded, not reaped. This is the
symptom of the second open todo named in §8; `/tmp` is a 16GB RAM tmpfs with aging
disabled on this host, and at 2% it is not close to a problem today.
