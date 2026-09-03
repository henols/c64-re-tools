# Plan 34-01: Guard Dispositions

Every guard the ROADMAP names for this phase, with what plan 34-01 did to it and WHY, so
the next reader sees a decision rather than a diff. Every row carries a verdict from
exactly `unmoved` / `widened-reviewed` / `repaired-reviewed` / `not-applicable` — no row
carries a diminished-floor verdict, and none of the rows below does.

## Guard-by-guard disposition

### 1. `broker-control.test.ts`'s two byte-exact `ControlRequestKind` declarations

**Verdict: repaired-reviewed.**

Both tests (`broker-control.test.ts:895` and `:1369` as of this plan's commits) asserted a
byte-exact seven-member union string. Adding `host_tool` as the eighth member is
unavoidable for any new control-plane op — `34-RESEARCH.md`'s own Pitfall 3 names this as
deliberate, expected breakage, not a workaround to route around — and the ROADMAP's own
Phase 34 note independently confirms it: *"`ControlRequestKind`'s byte-exact declaration
in `broker-control.test.ts` trips on **any** new control-plane op (`ghidra.*`, `dxa.*`,
`tool.*`) and is therefore unavoidable in every execution-seam design — it is not a
discriminator between them."*

Both cases were edited in the SAME commit that added the member (`test(34-01)` commit),
both are still byte-exact — one a whole-string `assert.equal`, the other a
`assert.deepEqual` over the split member list — and both now cite decision A-01 by name
and state that the eighth member is the whole host-tool subsystem, never widened again
per-tool. A third, new structural test was added asserting `onHostTool` is declared and
that the `host_tool` dispatch branch's character index precedes the `acquire` branch's,
making "routed before any lease-bearing path" a checked property rather than a claim.

Measured: `ControlRequestKind` has exactly 8 members
(`"acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" |
"monitor_release" | "host_tool"`), confirmed via `node --test broker-control.test.ts`
(89 tests, `fail 0`, including both updated byte-exact cases and the new structural case).

### 2. `spawn-seam.test.ts`'s `EXPECTED_EMULATOR_SPAWN_SITES`

**Verdict: unmoved**, at exactly 1 entry (`backend-detect.mts`).

Measured: `node --test spawn-seam.test.ts` — 12/12 pass, including the
both-directions set-equality test and all four planted-violation controls. The discovered
emulator spawn-site set is still `{ "backend-detect.mts": ... }`, unchanged from before
this plan.

Mechanism: `EXPECTED_EMULATOR_SPAWN_SITES` is derived from `shippedTsModules()`
(`package.json`'s `files[]`, filtered to `.ts`/`.mts`), scanned for the argv-form and
shell-form spawn call patterns. `host-tool.mts` is deliberately **absent** from
`files[]` — it ships only as its compiled `resources/host-tool.mjs` artifact, following
`broker-control.mts`'s own precedent — so `shippedTsModules()` never scans it at all,
regardless of what it spawns. `host-tool-client.ts` **is** added to `files[]` in this
plan and IS scanned, but it names none of the four `EMULATOR_BIN_SHAPE` identifier shapes
(`VICE_BIN` / `x64sc` / `binPath` / `viceBin`) anywhere in its code lines — confirmed by
this plan's own acceptance-criteria grep (`grep -a -v '^\s*//' host-tool.mts
host-tool-client.ts | grep -c 'binPath\|viceBin\|VICE_BIN\|x64sc'` → `0`) and independently
by `spawn-seam.test.ts`'s own discovery pass finding no new site. The local variable
holding the resolved ACME binary path is named `acmePath`, never `binPath`/`viceBin`, per
`34-PATTERNS.md`'s own naming pitfall.

### 3. `hostpath-consumers.test.ts`'s five-member `EXPECTED_IMPORTERS`

**Verdict: unmoved**, at exactly 5 entries
(`containerpath.ts`, `install-resources.ts`, `stock-paths.ts`, `vice-proxy.ts`,
`vice-sync.ts`).

Measured: `node --test hostpath-consumers.test.ts` — all cases pass, including
`"hostpath.ts's production consumer set is exactly the five declared modules"`.

Mechanism: decision A-03 (recorded in `34-01-PLAN.md`'s planner-assumptions section) keeps
every host-facing translation on the RESULT side, through `containerPath()`
(`containerpath.ts`) — never through `hostpath.ts` directly. `containerpath.ts` is
already one of the five declared consumers, so the new host-tool family reaches
host-path logic through an already-declared consumer rather than joining the list itself.
`host-tool-client.ts`'s own acceptance-criteria grep confirms this by construction:
`grep -a -c 'from "./containerpath.ts"' host-tool-client.ts` → `1`, and
`grep -a -v '^\s*//' host-tool-client.ts | grep -c 'hostpath'` → `0` (comment lines
excluded, so the header may explain the constraint by name without ever importing the
module it names). This is the ROADMAP's own preferred shape for this exact situation —
*"Prefer **one** declared-consumer module the rest of the family reaches through"* — achieved
here by construction rather than by widening the list.

### 4. `hostpath-consumers.test.ts`'s `ANNO_MODULE_FLOOR`

**Verdict: not-applicable** to this plan.

`ANNO_MODULE_FLOOR` (currently `16 + 1 = 17`) is derived from `topLevelProductionModules()`
filtered to `/^anno-.*\.ts$/` — a prefix `host-tool.mts` and `host-tool-client.ts` are
structurally outside, by name. Measured: `node --test hostpath-consumers.test.ts`'s
`"the annotation module family ... is derived from disk with a non-vacuity floor"` and
`"MCP-05: the hand-pinned annotation module floor equals the measured count"` cases both
pass, at 17 modules — unchanged by this plan. This is precisely the blind spot
`34-RESEARCH.md`'s own Pitfall 2 names: a `host-tool-*`/`ghidra-*`/`dxa-*` family sits
entirely outside this floor's scan, so a future member of that family importing
`hostpath.ts` directly would produce **no red anywhere** unless a second,
separately-pinned floor exists over the new family's own prefix. That second floor is
plan 34-06's job (SEAM-06), not this tracer plan's — recorded here as a disposition of
"not applicable **to this plan**", not as a claim that the underlying blind spot is closed.

### 5. `host-scripts.test.ts`'s `EXPECTED_TRACKED_SHELL_SCRIPTS`

**Verdict: unmoved**, at exactly 5 entries.

Measured: `node --test host-scripts.test.ts` — 4/4 pass, including
`"git ls-files enumerates the tracked shell-script set as exactly EXPECTED_TRACKED_SHELL_SCRIPTS"`.

Mechanism: this plan introduces one host-bound `.mts` module (`host-tool.mts`) compiled to
`resources/host-tool.mjs` by `build.ts`, not a `.sh` shell script — `git ls-files --
'*.sh'` is unchanged. A related guard this plan DID trip and had to repair (not one of the
ROADMAP's eight, but discovered live): `host-scripts.test.ts`'s separate
`.gitignore`/`resourceEntries()` two-way-parity test, which required adding
`/tools/host-tool.mjs` to `.gitignore`'s deployed-artifact block in the same commit —
recorded here for completeness even though it is not one of the eight named guards, since
it is the SAME discipline (a guard this plan's own artifact addition touches) applied to a
sibling gate the ROADMAP note did not enumerate by name.

### 6. `docs-linerefs.test.ts`'s four `rewriteArguments()` citations

**Verdict: unmoved.**

This plan adds no interception near `forwardToVice()` — the new seam is entirely on the
broker's TCP control plane (`broker-control.mts`, `vice-broker.mts`), never on the MCP
tool-dispatch path in `vice-proxy.ts`, so nothing in that file moves.

Measured, directly against `vice-proxy.ts` at this plan's HEAD:
- `rewriteArguments()` call site 1: line **3050** (inside `forwardToVice()`, which starts
  at line **2985**)
- `rewriteArguments()` call site 2: line **1529** (inside `gatherWedgeEvidence()`, which
  starts at line **1505**)

All four equal CLAUDE.md's stated numbers (`3050` / `2985` / `1529` / `1505`) exactly — no
drift. `node --test docs-linerefs.test.ts` passes. Per this plan's own standing
instruction, a mismatch would be treated as drift to re-verify rather than as evidence the
constraint changed; here there is no mismatch to treat either way.

### 7. `shipped-modules.ts`'s `shippedTsModules()` throw-on-missing behaviour

**Verdict: satisfied.**

`shippedTsModules()` throws `ShippedFilesEntryMissingError` if any `package.json` `files[]`
entry ending `.ts`/`.mts` does not exist on disk. This plan adds `host-tool-client.ts` to
`files[]`, and the file exists on disk in the same commit — confirmed by
`node --test shipped-modules.test.ts` passing (no throw) and by every guard that consumes
`shippedTsModules()` (`spawn-seam.test.ts`, `hostpath-consumers.test.ts`) running clean
against the widened `files[]` array. `host-tool.mts` is deliberately NOT added to
`files[]` (guard #2's own mechanism above), so it is never a candidate for this throw
either.

### 8. `scripts/check-npm-packages.mjs`'s transitive-closure walk over `files[]`

**Verdict: satisfied.**

Every module `host-tool-client.ts` imports — `containerpath.ts`, `container-guard.mts`,
`vice-broker-client.ts`, `repo-root.ts` — is already listed in `files[]`. Measured:
`node scripts/check-npm-packages.mjs` → `check-npm-packages: OK`,
`@henols/vice-mcp@0.0.0-dev -- 85 files`, `@henols/c64-re-tools@0.0.0-dev -- 37 files,
7 skills`. The "transitive closure from vice-proxy.ts" line reports 59 modules, clean —
no missing import, no leaked `node_modules`/test file/fixture.

## No row carries a diminished-floor verdict

Confirmed above: verdicts used are `repaired-reviewed` (1), `unmoved` (4), `not-applicable`
(1), `satisfied` (2 — for the two guards whose own wording is "satisfied" rather than a
movement/no-movement question: `shippedTsModules()`'s throw behaviour and
`check-npm-packages.mjs`'s closure walk, both of which either fire or they don't, with no
"moved/unmoved" axis to report). No row anywhere in this document reads a diminished-floor verdict.

## `npm run test:automated` baseline — measured before and after this plan's commits

Both measurements below ran with **no VICE broker running** — `pgrep -af 'vice-broker'`
returned nothing before each run — since a live broker deterministically reds the
`BACK-05` case, which is not a flake this plan should absorb into its own delta.

The BEFORE measurement ran from a `git worktree` checked out at `cd745cc` (the commit
immediately preceding this plan's first task commit), placed as a sibling directory
under `/home/henrik/dev/henrik/git/` — NOT under `/tmp`, because a first attempt at
`/tmp/.../scratchpad/` produced two SPURIOUS `containerpath.test.ts` failures
(`hostRootCandidates() must return at least one root in this environment`) that do not
reproduce in the real checkout location or in this sibling-directory worktree; `/tmp` is
tmpfs on this host, and `hostpath.ts`'s host-root derivation reads `/proc/self/mountinfo`,
which behaves differently under a tmpfs-mounted working directory. That contamination is
an artifact of where the measurement ran, not of any code this plan touched, and would
have inflated BOTH the before and after counts identically had it been used for only one
side — it was discarded rather than included in either baseline.

```
TEST_AUTOMATED_BASELINE_BEFORE: 2 failing tests, 1 failing file (anno-register.test.ts)
  -- 3127 tests, 3119 pass, 2 fail, 24 suites, 1 skipped, 5 todo
  -- measured at commit cd745cc (immediately before this plan's task 1 commit),
     via a git worktree at /home/henrik/dev/henrik/git/.gsd-scratch/before-wt
BROKER_STATE: no VICE broker running (pgrep -af 'vice-broker' returned nothing)

TEST_AUTOMATED_BASELINE_AFTER: 2 failing tests, 1 failing file (anno-register.test.ts)
  -- 3153 tests, 3145 pass, 2 fail, 24 suites, 1 skipped, 5 todo
  -- measured at this plan's HEAD (both task commits applied), in the real checkout
BROKER_STATE: no VICE broker running (pgrep -af 'vice-broker' returned nothing)
```

**Asserted relation (a DELTA, not a zero-floor claim):** the failing-test count AFTER this
plan (2) is NOT HIGHER than the failing-test count BEFORE this plan (2) — a delta of 0 —
and the failing FILE is the same single file, `anno-register.test.ts`, both before and
after. This project's own recorded floor is documented elsewhere as "5 failing tests in 3
files as of 2026-09-02" (`docs/phase33-reproducible-run-gate-findings.md`'s "Never a gate"
section, cited by `34-RESEARCH.md`); this plan's own two direct measurements, taken
immediately before and after its own commits in the same environment, both show 2 failing
tests in 1 file — a smaller number than that recorded floor, not a larger one, and either
way the number this plan is answerable for is its OWN before/after delta, which is 0. The
36 additional total tests recorded AFTER (3153 vs. 3127) are entirely
`host-tool.test.ts`'s 25 new cases plus `broker-control.test.ts`'s widened case count from
this plan's own task 2 commit; none of them are failing.

## Phase close

Recorded by plan 34-05, task 3 -- the last task of the last wave, and the only point at
which every guard this phase touched can be observed green TOGETHER on the merged tree.
This run had **no worktree isolation** (the phase was auto-degraded to `ISOLATION=none`
per #683/#3659): all five preceding plans committed straight onto this working tree, so the
tree this measurement runs against IS the merged tree, not a simulation of one.

No VICE broker daemon was running for any measurement below (`pgrep -af 'vice-broker.mjs\|
vice-broker.mts'` returned nothing beforehand) -- a live broker deterministically reds the
`BACK-05` case, which would corrupt this closing measurement rather than reflect this
phase's own work.

```
PHASE_CLOSE_BROKER_STATE: no VICE broker running (pgrep -af 'vice-broker.mjs\|vice-broker.mts' returned nothing)
PHASE_CLOSE_TYPECHECK: clean (npm run typecheck -- 0 error TS lines)
PHASE_CLOSE_TARBALL: ok (node scripts/check-npm-packages.mjs -- OK, 86 files / 38 files, 7 skills;
  node scripts/check-no-skill-external-spawn.mjs -- OK, tracked-tree 16 files, packed-tarball 15 files)
PHASE_CLOSE_TEST_AUTOMATED: 2 failing tests, 1 failing file (anno-register.test.ts)
  -- 3222 tests, 3214 pass, 2 fail, 24 suites
  -- DELTA against TEST_AUTOMATED_BASELINE_BEFORE (2 failing, 1 file, same file): 0
  -- the two failures are the SAME two named above ("DIRECTION 5 (basis integrity)..." and
     "planted violation (the negative control)..."), both pre-existing and out of this
     phase's scope; this is a delta claim, not a zero-floor claim -- this project's own
     recorded floor elsewhere is "5 failing tests in 3 files" (docs/phase33-reproducible-run-
     gate-findings.md), and this measurement's smaller number does not change what this
     phase is answerable for, which is its own before/after delta
```

Guard-by-guard, the eight named in this document plus the four suites this phase created,
each run individually AND together in the same 13-file `node --test` invocation this plan's
own `<verify>` block specifies (`spawn-seam.test.ts hostpath-consumers.test.ts
host-scripts.test.ts docs-linerefs.test.ts shipped-modules.test.ts resources-sync.test.ts
ci-suite-coverage.test.ts skill-external-spawn-gate.test.ts host-tool.test.ts
host-tool-transport.test.ts ghidra-project.test.ts skill-acme-build-cli.test.ts
docs-dangling-refs.test.ts` -- 183 tests, 183 pass, 0 fail; `broker-control.test.ts` run
separately for guard 1, since it is not part of that thirteen-file list -- 64/64 pass):

```
PHASE_CLOSE_GUARD_broker-control-controlrequestkind: green
PHASE_CLOSE_GUARD_spawn-seam-emulator-sites: green
PHASE_CLOSE_GUARD_hostpath-consumers-expected-importers: green
PHASE_CLOSE_GUARD_hostpath-consumers-anno-module-floor: green
PHASE_CLOSE_GUARD_host-scripts-tracked-shell-scripts: green
PHASE_CLOSE_GUARD_docs-linerefs-rewritearguments: green
PHASE_CLOSE_GUARD_shipped-modules-throw-on-missing: green
PHASE_CLOSE_GUARD_check-npm-packages-closure-walk: green
PHASE_CLOSE_GUARD_host-tool: green
PHASE_CLOSE_GUARD_host-tool-transport: green
PHASE_CLOSE_GUARD_ghidra-project: green
PHASE_CLOSE_GUARD_skill-external-spawn-gate: green
```

No row above is red. If a future re-run of this measurement finds one red, it is a finding
for verification to act on -- the Standing Constraint on repaired guards means the correct
response is never lowering a floor or editing a pinned literal to turn it back green.
