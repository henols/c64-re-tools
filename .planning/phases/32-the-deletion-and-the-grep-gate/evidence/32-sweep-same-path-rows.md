# Phase 32 plan 07 — the same-path sweep: preconditions, method and findings

This file's body below the marker is written verbatim by
`scripts/audit-mutation-harness.mjs`. Everything above the marker is this plan's own
record of the conditions the run was made under, and of the three things a reader
cannot recover from the harness's output alone: which runtimes were measured against
the harness's timeout, which plants needed a second attempt, and why one file's
unscoped run is not in this document at all.

## 1. Preconditions, asserted read-only before the run (D-13)

The vice-broker was asserted DOWN and never touched. A live broker reddens the
`BACK-05` D-G ordering test deterministically, which would contaminate an observed red.

```
$ systemctl --user is-active vice-broker
inactive
exit=4

$ pgrep -af '[v]ice-broker'
exit=1        (no match; no broker process)
```

The bracketed `[v]ice-broker` form is the honest check. Run plainly, `pgrep -af vice-broker`
matches its OWN command line and returns exit 0 with one hit, which reads as a live broker —
the false positive plan 32-06 recorded. Neither form was used to stop anything: the unit's
state was read and recorded, never changed.

Tree at the start of the run: `git status --porcelain` reported exactly one modified path,
`guard-fates.json` (this plan's own uncommitted Task-3 descriptor fixups). The harness compares
every row against THAT baseline, not against the empty string, and reported the tree
byte-identical afterwards.

- **Commit measured:** `95e9b0cbf33550161dcad4135cff14ca6f28494a`
- **Harness:** `scripts/audit-mutation-harness.mjs`, unmodified — this plan measures, it does
  not change the instrument.
- **Selector:** `--rows`, built by FILTERING the registry for rows whose `historicalPath` is in
  `deriveAuditedSet().forwardSamePath` and whose verdict is `re-pointed`. Never retyped from
  the plan's table. `--all` was deliberately not used: it would have re-measured plan 32-06's
  15 rows for no new information.
- **Rows measured:** 18 of 18. All 18 OBSERVED RED. Zero UNMEASURABLE, zero ZERO-EXIT.

## 2. The timeout hazard, measured rather than assumed

`GUARD_RUN_TIMEOUT_MS` is 15000 ms and the harness maps an `ETIMEDOUT` to **status 1** — the
same status a genuine failing assertion produces. Exit status alone therefore cannot tell a
red from a hang. Before any plant was designed, every candidate guard was run UNPLANTED under a
deliberately generous bound and timed. Measured (unplanted, this tree):

| guard | unplanted runtime | verdict against the 15000 ms bound |
|---|---|---|
| `node --test capability-registry.test.ts` | 384 ms | safe |
| `node --test tool-support-table.test.mjs` | 398 ms | safe |
| `node --test hostpath-consumers.test.ts` | 486 ms | safe |
| `node --test docs-dangling-refs.test.ts` | 580 ms | safe |
| `node --test stock-dispatch.test.ts` | 851 ms | safe |
| `node --test hop-chain-comments.test.ts` | 910 ms | safe |
| `node --test skill-acme-build-cli.test.ts` | 1352 ms | safe |
| `node --test disasm-roundtrip.test.ts` | 2031 ms | safe |
| `node scripts/audit-gate.mjs --json` | 1164 ms | safe |
| `node scripts/check-npm-packages.mjs` | 2492 ms | safe |
| `node scripts/check-skill-fork-honesty.mjs` | 156 ms | safe |
| `node scripts/check-skill-tool-coverage.mjs` | 310 ms | safe |
| `node scripts/check-skill-description-overlap.mjs` | 102 ms | safe |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 2045 ms | safe |
| **`node --test audit-integrity.test.ts`** | **21483 ms** | **EXCEEDS — must be scoped** |
| **`node --test vice-proxy.test.ts`** | **DID NOT TERMINATE at 300106 ms** | **EXCEEDS — must be scoped** |

Two guards would have produced a **false observed red** if run unscoped. Both were scoped with
`--test-name-pattern` to the assertion their plant targets, and both scoped forms were
re-measured green before use:

- `audit-integrity.test.ts` → `--test-name-pattern "registry-drift detector"`: 21483 ms → **1525 ms**.
- `vice-proxy.test.ts` → `--test-name-pattern "tools/list survives a missing or corrupt snapshot"`:
  does-not-terminate → **4562 ms control / 1162 ms planted**.

This is the second and third instance of the hazard; plan 32-06 recorded the first
(`anno-cli.test.ts`, 20596 ms).

**How a timeout was distinguished from a red, per row.** Every one of the 18 rows in the body
below carries a **control exit status of exactly 0**, produced by the same command that later
produced the red. A run that timed out could not have produced an exit-0 control, because the
harness kills it at 15000 ms and reports status 1. So for every recorded red: the control
terminated on its own inside the bound, the planted run used the identical command, and the
planted run's captured output names a failing assertion in words. No row's status was inferred.

## 3. `src/mcp/vice/vice-proxy.test.ts` — recorded, not laundered

The plan anticipated this file would be `UNMEASURABLE-LOCALLY`. It is measurable, but only under
a scope that had to be found by measurement, and the two facts that made the obvious routes
unusable are recorded here because they do not appear anywhere in the harness's output.

1. **The unscoped file does not terminate.** `node --test vice-proxy.test.ts` was run with a
   300000 ms bound and was still running when killed at **300106 ms**. Not slow — non-terminating
   at twenty times the harness's bound. Under the harness this becomes status 1, which is
   exit-status-indistinguishable from a failing assertion. It is not recorded as a red anywhere.
2. **The obvious scope is red UNPLANTED.** `--test-name-pattern "tools/list's full output matches
   the manifest exactly"` — the test that carries one of the re-pointed `...CURATED_ANNO_TOOLS`
   spreads — TERMINATES (1665–2095 ms) but its unplanted control **exits 1**: the wire surface
   answers with **58** tools (the stock set) against an expectation of the **80**-name fork
   manifest. It is red for a backend reason, with no plant present. Under the green-control rule
   that is UNMEASURABLE, and it was discarded rather than used.
3. **The scope that was used.** `--test-name-pattern "tools/list survives a missing or corrupt
   snapshot"` reads the OTHER two re-pointed spreads (`vice-proxy.test.ts:603`, `:621`). Control
   exit 0; planted exit 1; the captured diff names all 19 curated tools with and without the
   planted suffix. Both legs are in the body below.

**What CI's green does and does not prove about this file (D-14's phrasing, stated in words).**
CI runs the full `npm test` glob (`.github/workflows/ci.yml:130-161`, decided from run
32517575905, 2026-08-21), which includes `vice-proxy.test.ts`. On the runner this file reaches
its default-SKIP branch. So CI's green proves that the nine `MANUAL_ONLY_TESTS`, this one among
them, **DID NOT FAIL** — it does not prove they exercised anything. A green from a skipped test
and a green from a passing test are the same colour and different facts.

**Diagnosing the hang is out of scope and was not attempted.** `ROADMAP.md` states this phase
contains no build work by design, and `32-CONTEXT.md` lists diagnosing it as a deferred idea.
Recording it is in scope; fixing it is not. One observation is offered without acting on it:
every scoped run of this file prints
`vice-proxy.test: after() force-closed 0 leaked server(s) and killed 1 leaked child(ren)`,
so a leaked child process is present even in a run that completes.

## 4. Two rows needed a second plant (both attempts recorded)

Neither row was reclassified, neither guard was weakened, and both attempts are written into the
row's own `note` in `guard-fates.json` as well as here.

**`scripts/audit-gate.mjs`.** Attempt 1 (`DOCS_GUARD_FLOOR = 7` → `8`, guard
`node scripts/audit-gate.mjs --json`) came back ZERO-EXIT. Two independent causes, both measured:

- *The floor is a `>=` non-vacuity floor and the derived set has outgrown it.* The gate reports
  **9** docs guards on disk while `DOCS_GUARD_FLOOR` is pinned at **7**, so `9 >= 8` still held.
  That gap is not a defect — the constant's own comment says it is a floor to be RAISED, never
  lowered, and records that the 29-05 rename deliberately did not move it — but a plant has to
  clear the REAL count, not the pinned one.
- *Under `--json`, a structural error never reaches the exit status.* The `--json` branch ends
  `process.exit(result.allowed ? 0 : 1)` (`scripts/audit-gate.mjs:1210`), and `allowed` tracks
  GATED AUDITS. The text-mode branch exits 1 on `structuralErrors.length > 0` (`:1213-1218`).
  A floor breach is reported inside the JSON payload while the process exits 0.

  This is a finding in its own right: **any caller treating `audit-gate.mjs --json`'s exit status
  as a structural-health check is reading a signal that cannot go non-zero for a structural error.**

  Attempt 2 — same file, same relation, floor → `10`, guard `node scripts/audit-gate.mjs` — gave
  control exit 0 (`audit-gate: OK -- 9 docs guards green`) and planted exit 1
  (`audit-gate: FAIL -- only 9 docs-*.test.ts guard(s) found ... (>= 10 required)`).

**`src/mcp/vice/vice-proxy.test.ts`.** Attempt 1 used the same plant under the scope
`"tools/list reads the committed snapshot with no emulator"` and came back ZERO-EXIT: that test
consumes the re-pointed expression only as a **length** (`:540-544`), and suffixing every derived
name changes no count, so both sides moved together. Attempt 2 kept the plant byte-identical and
moved the scope to the test that reads the expression's **contents**. See §3.

## 5. How each red was observed, against what

For a same-path member `newSubject === historicalPath`, so — unlike plan 32-06's renamed rows,
where a red naming the historical path would mean the red was observed against the DEAD subject —
here a red naming the member is exactly right. Measured over the 18 rows:

- **14** reds were observed by running the audited member itself.
- **4** were observed through a consuming gate, because the member is a library or a generator
  with no CLI of its own: `scripts/generate-tool-support-table.mjs`, `scripts/lib/skill-corpus.d.mts`,
  `scripts/lib/skill-descriptions.d.mts`, `scripts/lib/skill-honesty-checks.mjs`. That routing is
  the one `evidence/32-root-override-inventory.md` §2.1 tabulates.

## 6. Two harness limitations this sweep worked around, and did not fix

`scripts/audit-mutation-harness.mjs` is plan 32-01's committed deliverable and outside this plan's
declared scope. Both limitations were routed around; neither was patched.

1. **Only `kind: "worktree"` plants exist.** `plant()` throws on any other kind. The plan routes
   four `scripts/` rows through a `--root` synthetic tree per `evidence/32-root-override-inventory.md`;
   all four are planted `worktree` instead, and each row's `note` says so. No synthetic fixture
   tree was built, nothing was added under the `src/mcp/vice/fixtures/planted-` prefix (which
   carries an exact `prefixHits: 2` pin), and `mktemp -d` was never used as a `--root`
   (`resolveContainedRoot()` refuses any root outside the repository, which would make "the tree
   is unchanged" pass vacuously).
2. **`guard.argv: ["--run", "typecheck"]` is unusable.** `resolveBin()` maps `argv[0] === "--run"`
   to the npm client, producing `npm --run typecheck`, which npm rejects. Both `.d.mts` rows use
   `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` — byte-for-byte what the
   `typecheck` script runs — reaching the harness through its other documented convention. Plan
   32-06 recorded the same defect on the same convention; it remains the only one of the three
   never successfully exercised.

## 7. Post-run tree state and what was removed

- `git status --porcelain` over tracked non-`.planning` paths: **empty**.
- `git diff --exit-code -- docs/tool-support.md`: **exit 0**.
- `node scripts/check-no-analyser.mjs`: **exit 0** — the removal gate's exact per-exemption
  hit counts are unmoved, so no plant disturbed the subject literal's pinned occurrences.
- All six CI check scripts exit 0; `node scripts/audit-gate.mjs --json` reports
  `allowed: true, redGuards: [], structuralErrors: []`.
- `cd src/mcp/vice && npm run typecheck`: **exit 0**.
- `cd src/mcp/vice && npm run test:automated`: 2950 tests, 2943 pass, **1 fail** — `repo-root.test.ts`'s
  `path agreement (D-3, D-6, ...)`, which asserts the agreed directory is not under `.claude` and is
  therefore false in EVERY GSD worktree by construction. This is the known artifact recorded in
  `deferred-items.md` §1, independently verified 0-fail in the main checkout after each prior wave.
  Not caused here, not fixed, not loosened. It cannot have contaminated any red: every guard in this
  sweep runs a single named file or script, none of which is `repo-root.test.ts`, and every red is
  bracketed by its own green control on the identical command.
- **Leaked directory removed:** one empty `.planning/vice-proxy-evidence-test-wKSMT8/` was created by
  a `vice-proxy.test.ts` run and removed with `rmdir`. It is empty, so `git status --porcelain` never
  reported it — git does not track empty directories — which is why it was looked for by name rather
  than trusted to show up in the porcelain diff. No `.planning/vice-proxy-evidence-test-*` remains.

## 8. The registry after this sweep

- **Before this plan:** 15 rows (plan 32-06). **After:** 36 rows — 33 `re-pointed`, 3 `kept-unchanged`.
  Verified against the guard's own summary line: `rows=36`.
- `node scripts/check-guard-fates.mjs` remains red **as pre-declared**, and its output is now
  **exactly 25** `no recorded fate` lines and nothing else. Mechanically decomposed: **16** set B +
  **7** `gone` + **2** set C = 25, with **0** same-path and **0** renamed members remaining. The full
  audited set is 61; 36 rows are recorded.
- The `gone` group, owed to plan 32-08 as `deleted` or `superseded`, is:
  `anno-launch.test.ts`, `anno-mcp-client.test.ts`, `anno-project.test.ts`, `anno-session.test.ts`,
  `anno-symbol-roundtrip.test.ts`, **`anno-derivation.test.ts`**, `anno-verify.test.ts`.
  The emphasised one is the member plan 32-06 suggested this plan might have to take: the derivation
  places it in `forwardGone`, not `forwardSamePath`, so it is **not** this plan's and no row was
  created for it here.

<!-- harness-written body begins -->

# Phase 32 — observed-red evidence (machine-captured)

Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured `spawnSync` result, not a transcription. Re-run the command in each row's **planted command** line after applying that row's plant to reproduce it.

- **Commit measured:** `95e9b0cbf33550161dcad4135cff14ca6f28494a`
- **Measured at:** 2026-08-31T18:05:16.394Z
- **Root:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff`
- **Rows measured:** 18

## Tree state

`git status --porcelain` BEFORE the run (the baseline every row is compared to):

```
 M .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
```

`git status --porcelain` AFTER the run:

```
 M .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
```

**Byte-identical.** Every plant was reverted.

## `scripts/audit-gate.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/audit-gate.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
```

### Planted run

- **Plant:** `scripts/audit-gate.mjs`: `export const DOCS_GUARD_FLOOR = 7;` → `export const DOCS_GUARD_FLOOR = 10;`
- **Planted command:** `node scripts/audit-gate.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

audit-gate: FAIL
  - only 9 docs-*.test.ts guard(s) found in /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice (>= 10 required) -- an empty or broken glob must fail loudly here rather than let this gate report green forever
```

## `scripts/check-npm-packages.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-npm-packages.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-npm-packages: transitive closure from vice-proxy.ts -- 57 modules, clean
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 79 files
  @henols/c64-re-tools@0.0.0-dev -- 34 files, 7 skills


> @henols/c64-re-tools@0.0.0-dev prepack
> node scripts/sync-skills.mjs

sync-skills: copied 7 skill(s) into /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/installer/skills: acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage
sync-skills: excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)
```

### Planted run

- **Plant:** `src/mcp/vice/package.json`: `    "anno-cli.ts",` → `    "anno-cliX.ts",`
- **Planted command:** `node scripts/check-npm-packages.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```


> @henols/c64-re-tools@0.0.0-dev prepack
> node scripts/sync-skills.mjs

sync-skills: copied 7 skill(s) into /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/installer/skills: acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage
sync-skills: excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)
check-npm-packages: FAIL
  - vice-mcp: missing anno-cli.ts -- ANNO-09 would ship a package that throws ERR_MODULE_NOT_FOUND
  - vice-mcp: anno-cli.ts is imported by vice-proxy.ts but is not in the published tarball -- Rule 2 (see 6801cf5, 897faf6)
```

## `scripts/check-skill-fork-honesty.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-fork-honesty: OK -- 11 fork-only mentions across 33 files in 7 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
```

### Planted run

- **Plant:** `scripts/check-skill-fork-honesty.mjs`: `acmeBuildSkillSource.includes("anno export-asm")` → `acmeBuildSkillSource.includes("anno export-asmZZ")`
- **Planted command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-fork-honesty: FAIL
  - src/skills/acme-build/SKILL.md is missing the replacement pointer string "anno export-asm" -- the deletion must not be "fixed" by deleting the pointer to the route too. While the route was withdrawn that pointer was the dated withdrawal notice naming it; since the route returned on 2026-08-31 the same string is the live invocation, which is why this assertion never had to move.
```

## `scripts/check-skill-tool-coverage.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 33 files across 7 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries). anno CLI verbs: 3 parsed from anno-cli.ts, 3/3 resolved (named by at least one skill file).

(node:339599) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

### Planted run

- **Plant:** `src/skills/routine-queue-walker/SKILL.md`: `anno_set_comment` → `anno_set_commentary`
- **Planted command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-tool-coverage: FAIL
  - anno_set_commentary: referenced by src/skills/routine-queue-walker/SKILL.md but NOT in CURATED_ANNO_TOOLS (anno-tools.ts). Resolve by: (1) implementing it and adding it to ANNO_TOOL_DEFINITIONS with a named criterion, (2) removing the skill reference, or (3) recording it as a scope decision.
```

## `scripts/generate-tool-support-table.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern byte-identical to committed tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
ok 1 - generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
  ---
  duration_ms: 9.751421
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 258.438152
```

### Planted run

- **Plant:** `scripts/generate-tool-support-table.mjs`: `ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/` → `ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONZ\s*\)/`
- **Planted command:** `node --test --test-name-pattern byte-identical to committed tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
not ok 1 - generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
  ---
  duration_ms: 10.572473
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/tool-support-table.test.mjs:148:1'
  failureType: 'testCodeFailure'
  error: 'generate-tool-support-table: could not resolve synthetic tool registration identifier "annoDef" (from `tools[annoDef.name] = ...`) to a declaration -- expected a `const annoDef: ToolDefinition = { ... }` declaration in vice-proxy.ts. Add the declaration, or if this is not a synthetic proxy-local tool registration, fix the discovery regex explicitly rather than silently dropping the identifier.'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    discoverSyntheticToolNames (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/scripts/generate-tool-support-table.mjs:166:13)
    generateToolSupportTable (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/scripts/generate-tool-support-table.mjs:222:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/tool-support-table.test.mjs:149:21)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 270.300864
```

## `scripts/lib/skill-corpus.d.mts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```

```

### Planted run

- **Plant:** `scripts/lib/skill-corpus.d.mts`: `export declare function walkSkills(dir: string): string[];` → `export declare function walkSkillsX(dir: string): string[];`
- **Planted command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
skill-attribution.test.ts(95,10): error TS2724: '"../../../scripts/lib/skill-corpus.mjs"' has no exported member named 'walkSkills'. Did you mean 'walkSkillsX'?
skill-attribution.test.ts(850,51): error TS7006: Parameter 'f' implicitly has an 'any' type.
skill-attribution.test.ts(1035,44): error TS7006: Parameter 'f' implicitly has an 'any' type.
```

## `scripts/lib/skill-descriptions.d.mts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```

```

### Planted run

- **Plant:** `scripts/lib/skill-descriptions.d.mts`: `export declare function expectedPairCount(n: number): number;` → `export declare function expectedPairCountX(n: number): number;`
- **Planted command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
skill-description-overlap.test.ts(41,3): error TS2724: '"../../../scripts/lib/skill-descriptions.mjs"' has no exported member named 'expectedPairCount'. Did you mean 'expectedPairCountX'?
```

## `scripts/lib/skill-honesty-checks.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-fork-honesty: OK -- 11 fork-only mentions across 33 files in 7 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
```

### Planted run

- **Plant:** `scripts/lib/skill-honesty-checks.mjs`: `if (!content.includes(needle)) {` → `if (content.includes(needle)) {`
- **Planted command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-fork-honesty: FAIL
  - src/skills/acme-build/scripts/acme.mjs: required claim "no libraries needed" is absent -- WR-11: acme.mjs's own --help claimed the `new` scaffold needs libraries, but plan 10-07 deliberately made the scaffold library-free (local !address/= constants, no !source <cbm/c64/...>) -- the first surface a reader sees about the scaffold must match what it is.
```

## `src/mcp/vice/audit-integrity.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern registry-drift detector audit-integrity.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
ok 1 - the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
  ---
  duration_ms: 992.779768
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1192.478315
```

### Planted run

- **Plant:** `scripts/audit-gate.mjs`: `  "docs-absorbed-decisions.test.ts",` → `  "docs-absorbed-decisionz.test.ts",`
- **Planted command:** `node --test --test-name-pattern registry-drift detector audit-integrity.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
not ok 1 - the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
  ---
  duration_ms: 113.49716
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/audit-integrity.test.ts:260:1'
  failureType: 'testCodeFailure'
  error: |-
    scripts/audit-gate.mjs's own EXPECTED_DOCS_GUARD_NAMES registry has drifted from the disk-derived docs-*.test.ts set -- extend EXPECTED_DOCS_GUARD_NAMES (and DOCS_GUARD_FLOOR) in the same commit that adds or removes a docs-*.test.ts guard file (see that array's own comment); registry=["docs-linerefs.test.ts","docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts","docs-review-disposition.test.ts","docs-fork-decision.test.ts","docs-core-value-decision.test.ts","docs-absorbed-decisionz.test.ts","docs-uat-abstention.test.ts","docs-worktree-isolation.test.ts"] disk=["docs-absorbed-decisions.test.ts","docs-core-value-decision.test.ts","docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts","docs-fork-decision.test.ts","docs-linerefs.test.ts","docs-review-disposition.test.ts","docs-uat-abstention.test.ts","docs-worktree-isolation.test.ts"]
    + actual - expected
    
      [
    +   'docs-absorbed-decisionz.test.ts',
    -   'docs-absorbed-decisions.test.ts',
        'docs-core-value-decision.test.ts',
        'docs-dangling-refs.test.ts',
        'docs-deferred-ledger.test.ts',
        'docs-fork-decision.test.ts',
        'docs-linerefs.test.ts',
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'docs-absorbed-decisions.test.ts'
    1: 'docs-core-value-decision.test.ts'
    2: 'docs-dangling-refs.test.ts'
    3: 'docs-deferred-ledger.test.ts'
    4: 'docs-fork-decision.test.ts'
    5: 'docs-linerefs.test.ts'
    6: 'docs-review-disposition.test.ts'
    7: 'docs-uat-abstention.test.ts'
    8: 'docs-worktree-isolation.test.ts'
  actual:
    0: 'docs-absorbed-decisionz.test.ts'
    1: 'docs-core-value-decision.test.ts'
    2: 'docs-dangling-refs.test.ts'
    3: 'docs-deferred-ledger.test.ts'
    4: 'docs-fork-decision.test.ts'
    5: 'docs-linerefs.test.ts'
    6: 'docs-review-disposition.test.ts'
    7: 'docs-uat-abstention.test.ts'
    8: 'docs-worktree-isolation.test.ts'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/audit-integrity.test.ts:262:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 393.614475
```

## `src/mcp/vice/capability-registry.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test capability-registry.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
ok 1 - fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
  ---
  duration_ms: 3.293293
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 2 - fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.429468
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 3 - fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.541412
  type: 'test'
  ...
# Subtest: fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
ok 4 - fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
  ---
  duration_ms: 0.420409
  type: 'test'
  ...
# Subtest: stock-only tool on fork names the stock route
ok 5 - stock-only tool on fork names the stock route
  ---
  duration_ms: 0.554094
  type: 'test'
  ...
# Subtest: regression guard: a genuinely unknown tool name yields no refusal at all
ok 6 - regression guard: a genuinely unknown tool name yields no refusal at all
  ---
  duration_ms: 0.42402
  type: 'test'
  ...
# Subtest: synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
ok 7 - synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
  ---
  duration_ms: 0.674657
  type: 'test'
  ...
# Subtest: DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
ok 8 - DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
  ---
  duration_ms: 0.38069
  type: 'test'
  ...
# Subtest: same-backend miss: every entry's own providedBy backend yields no refusal for that entry
ok 9 - same-backend miss: every entry's own providedBy backend yields no refusal for that entry
  ---
  duration_ms: 0.983109
  type: 'test'
  ...
# Subtest: mechanical completeness: the registry's name set equals the manifest-derived divergence set
ok 10 - mechanical completeness: the registry's name set equals the manifest-derived divergence set
  ---
  duration_ms: 9.700754
  type: 'test'
  ...
# Subtest: vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
ok 11 - vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
  ---
  duration_ms: 0.563867
  type: 'test'
  ...
# Subtest: every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
ok 12 - every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
  ---
  duration_ms: 0.454774
  type: 'test'
  ...
# Subtest: a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
ok 13 - a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
  ---
  duration_ms: 0.338813
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 296.024348
```

### Planted run

- **Plant:** `src/mcp/vice/vice-proxy.ts`: `for (const annoDef of ANNO_TOOL_DEFINITIONS)` → `for (const annoDefX of ANNO_TOOL_DEFINITIONS)`
- **Planted command:** `node --test capability-registry.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
ok 1 - fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
  ---
  duration_ms: 1.89266
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 2 - fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.311952
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 3 - fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.308327
  type: 'test'
  ...
# Subtest: fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
ok 4 - fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
  ---
  duration_ms: 0.209429
  type: 'test'
  ...
# Subtest: stock-only tool on fork names the stock route
ok 5 - stock-only tool on fork names the stock route
  ---
  duration_ms: 0.292723
  type: 'test'
  ...
# Subtest: regression guard: a genuinely unknown tool name yields no refusal at all
ok 6 - regression guard: a genuinely unknown tool name yields no refusal at all
  ---
  duration_ms: 0.231738
  type: 'test'
  ...
# Subtest: synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
ok 7 - synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
  ---
  duration_ms: 0.643952
  type: 'test'
  ...
# Subtest: DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
ok 8 - DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
  ---
  duration_ms: 0.340315
  type: 'test'
  ...
# Subtest: same-backend miss: every entry's own providedBy backend yields no refusal for that entry
ok 9 - same-backend miss: every entry's own providedBy backend yields no refusal for that entry
  ---
  duration_ms: 0.8958
  type: 'test'
  ...
# Subtest: mechanical completeness: the registry's name set equals the manifest-derived divergence set
not ok 10 - mechanical completeness: the registry's name set equals the manifest-derived divergence set
  ---
  duration_ms: 6.564619
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/capability-registry.test.ts:119:1'
  failureType: 'testCodeFailure'
  error: 'could not resolve synthetic tool registration identifier "annoDef" in vice-proxy.ts to a declaration -- silently dropping it would widen the exclusion set and mask a real capability divergence. Fix the pattern rather than skipping the identifier.'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/capability-registry.test.ts:180:13)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
ok 11 - vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
  ---
  duration_ms: 0.441405
  type: 'test'
  ...
# Subtest: every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
ok 12 - every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
  ---
  duration_ms: 0.372393
  type: 'test'
  ...
# Subtest: a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
ok 13 - a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
  ---
  duration_ms: 0.172034
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 12
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 296.872604
```

## `src/mcp/vice/disasm-roundtrip.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test disasm-roundtrip.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# DISASM-03 !byte substitution set (acmeExpressible=false, verified against installed ACME): $12, $1A, $22, $2B, $32, $34, $3A, $3C, $42, $44, $52, $54, $5A, $5C, $62, $64, $72, $74, $7A, $7C, $82, $89, $92, $B2, $C2, $D2, $D4, $DA, $DC, $E2, $EB, $F2, $F4, $FA, $FC
# Subtest: ACME availability gate (D-08)
ok 1 - ACME availability gate (D-08)
  ---
  duration_ms: 1.169715
  type: 'test'
  ...
# Subtest: Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
ok 2 - Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
  ---
  duration_ms: 13.907728
  type: 'test'
  ...
# Subtest: Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
ok 3 - Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
  ---
  duration_ms: 4.900787
  type: 'test'
  ...
# Subtest: Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
ok 4 - Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
  ---
  duration_ms: 1159.889921
  type: 'test'
  ...
# Subtest: Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
ok 5 - Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
  ---
  duration_ms: 12.588925
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1587.164197
```

### Planted run

- **Plant:** `src/mcp/vice/disasm-renderer.ts`: `(value & 0xffff).toString(16).padStart(4, "0")` → `(value & 0xffff).toString(16).padStart(5, "0")`
- **Planted command:** `node --test disasm-roundtrip.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# DISASM-03 !byte substitution set (acmeExpressible=false, verified against installed ACME): $12, $1A, $22, $2B, $32, $34, $3A, $3C, $42, $44, $52, $54, $5A, $5C, $62, $64, $72, $74, $7A, $7C, $82, $89, $92, $B2, $C2, $D2, $D4, $DA, $DC, $E2, $EB, $F2, $F4, $FA, $FC
# Subtest: ACME availability gate (D-08)
ok 1 - ACME availability gate (D-08)
  ---
  duration_ms: 1.267377
  type: 'test'
  ...
# Subtest: Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
not ok 2 - Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
  ---
  duration_ms: 12.812555
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/disasm-roundtrip.test.ts:206:1'
  failureType: 'testCodeFailure'
  error: |-
    Suite A: the tool's own concatenated listing did not assemble through real ACME:
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 15 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 16 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 17 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 18 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 28 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 30 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 31 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 32 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 33 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-muF7iq/t0.a, line 34 (Zone <untitled>): Number out of range.
    
    ---
    !cpu 6510
    * = $01000
            brk
            ora ($40,x)
            jam  ; illegal opcode
            slo ($40,x)  ; illegal opcode
            nop $40  ; illegal opcode
            ora $40
            asl $40
            slo $40  ; illegal opcode
            php
            ora #$40
            asl
            anc #$40  ; illegal opcode
            nop $02000  ; illegal opcode
            ora $02000
            asl $02000
            slo $02000  ; illegal opcode
            bpl $01027
            ora ($40),y
            !byte $12  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            slo ($40),y  ; illegal opcode
            nop $40,x  ; illegal opcode
            ora $40,x
            asl $40,x
            slo $40,x  ; illegal opcode
            clc
            ora $02000,y
            !byte $1a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            slo $02000,y  ; illegal opcode
            nop $02000,x  ; illegal opcode
            ora $02000,x
            asl $02000,x
            slo $02000,x  ; illegal opcode
            jsr $02000
            and ($40,x)
            !byte $22  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rla ($40,x)  ; illegal opcode
            bit $40
            and $40
            rol $40
            rla $40  ; illegal opcode
            plp
            and #$40
            rol
            !byte $2b, $40  ; anc #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            bit $02000
            and $02000
            rol $02000
            rla $02000  ; illegal opcode
            bmi $0106c
            and ($40),y
            !byte $32  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rla ($40),y  ; illegal opcode
            !byte $34, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            and $40,x
            rol $40,x
            rla $40,x  ; illegal opcode
            sec
            and $02000,y
            !byte $3a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            rla $02000,y  ; illegal opcode
            !byte $3c, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            and $02000,x
            rol $02000,x
            rla $02000,x  ; illegal opcode
            rti
            eor ($40,x)
            !byte $42  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            sre ($40,x)  ; illegal opcode
            !byte $44, $40  ; nop $40  [illegal opcode | not expressible in ACME !cpu 6510]
            eor $40
            lsr $40
            sre $40  ; illegal opcode
            pha
            eor #$40
            lsr
            alr #$40  ; illegal opcode
            jmp $02000
            eor $02000
            lsr $02000
            sre $02000  ; illegal opcode
            bvc $010af
            eor ($40),y
            !byte $52  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            sre ($40),y  ; illegal opcode
            !byte $54, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            eor $40,x
            lsr $40,x
            sre $40,x  ; illegal opcode
            cli
            eor $02000,y
            !byte $5a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            sre $02000,y  ; illegal opcode
            !byte $5c, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            eor $02000,x
            lsr $02000,x
            sre $02000,x  ; illegal opcode
            rts
            adc ($40,x)
            !byte $62  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rra ($40,x)  ; illegal opcode
    !cpu 6510
    * = $010d1
            !byte $64, $40  ; nop $40  [illegal opcode | not expressible in ACME !cpu 6510]
            adc $40
            ror $40
            rra $40  ; illegal opcode
            pla
            adc #$40
            ror
            arr #$40  ; illegal opcode
            jmp ($010ff)  ; NMOS page-wrap: the high byte is fetched from $xx00, not the next page
            adc $02000
            ror $02000
            rra $02000  ; illegal opcode
            bvs $010f2
            adc ($40),y
            !byte $72  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rra ($40),y  ; illegal opcode
            !byte $74, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            adc $40,x
            ror $40,x
            rra $40,x  ; illegal opcode
            sei
            adc $02000,y
            !byte $7a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            rra $02000,y  ; illegal opcode
            !byte $7c, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            adc $02000,x
            ror $02000,x
            rra $02000,x  ; illegal opcode
            nop #$40  ; illegal opcode
            sta ($40,x)
            !byte $82, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            sax ($40,x)  ; illegal opcode
            sty $40
            sta $40
            stx $40
            sax $40  ; illegal opcode
            dey
            !byte $89, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            txa
            ane #$40  ; illegal opcode
            sty $02000
            sta $02000
            stx $02000
            sax $02000  ; illegal opcode
            bcc $01137
            sta ($40),y
            !byte $92  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            sha ($40),y  ; illegal opcode
            sty $40,x
            sta $40,x
            stx $40,y
            sax $40,y  ; illegal opcode
            tya
            sta $02000,y
            txs
            tas $02000,y  ; illegal opcode
            shy $02000,x  ; illegal opcode
            sta $02000,x
            shx $02000,y  ; illegal opcode
            sha $02000,y  ; illegal opcode
            ldy #$40
            lda ($40,x)
            ldx #$40
            lax ($40,x)  ; illegal opcode
            ldy $40
            lda $40
            ldx $40
            lax $40  ; illegal opcode
            tay
            lda #$40
            tax
            lxa #$40  ; illegal opcode
            ldy $02000
            lda+2 $00080
            ldx $02000
            lax $02000  ; illegal opcode
            bcs $0117c
            lda ($40),y
            !byte $b2  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            lax ($40),y  ; illegal opcode
            ldy $40,x
            lda $40,x
            ldx $40,y
            lax $40,y  ; illegal opcode
            clv
            lda $02000,y
            tsx
            las $02000,y  ; illegal opcode
            ldy $02000,x
            lda $02000,x
            ldx $02000,y
            lax $02000,y  ; illegal opcode
            cpy #$40
            cmp ($40,x)
            !byte $c2, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            dcp ($40,x)  ; illegal opcode
            cpy $40
            cmp $40
            dec $40
            dcp $40  ; illegal opcode
    !cpu 6510
    * = $011a8
            iny
            cmp #$40
            dex
            sbx #$40  ; illegal opcode
            cpy $02000
            cmp $02000
            dec $02000
            dcp $02000  ; illegal opcode
            bne $011c1
            cmp ($40),y
            !byte $d2  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            dcp ($40),y  ; illegal opcode
            !byte $d4, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            cmp $40,x
            dec $40,x
            dcp $40,x  ; illegal opcode
            cld
            cmp $02000,y
            !byte $da  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            dcp $02000,y  ; illegal opcode
            !byte $dc, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            cmp $02000,x
            dec $02000,x
            dcp $02000,x  ; illegal opcode
            cpx #$40
            sbc ($40,x)
            !byte $e2, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            isc ($40,x)  ; illegal opcode
            cpx $40
            sbc $40
            inc $40
            isc $40  ; illegal opcode
            inx
            sbc #$40
            nop
            !byte $eb, $40  ; sbc #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            cpx $02000
            sbc $02000
            inc $02000
            isc $02000  ; illegal opcode
            beq $01206
            sbc ($40),y
            !byte $f2  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            isc ($40),y  ; illegal opcode
            !byte $f4, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            sbc $40,x
            inc $40,x
            isc $40,x  ; illegal opcode
            sed
            sbc $02000,y
            !byte $fa  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            isc $02000,y  ; illegal opcode
            !byte $fc, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            sbc $02000,x
            inc $02000,x
            isc $02000,x  ; illegal opcode
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/disasm-roundtrip.test.ts:249:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
not ok 3 - Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
  ---
  duration_ms: 0.684828
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/disasm-roundtrip.test.ts:261:1'
  failureType: 'testCodeFailure'
  error: 'Suite B: the D-11 width force must appear on the lda $0080 line'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    !cpu 6510
    * = $020f0
            bcc $020f4
            nop
            nop
            bcs $020f0
            bne $02102
            lda+2 $00080
            jmp ($010ff)  ; NMOS page-wrap: the high byte is fetched from $xx00, not the next page
            jsr $0ffd2
            lax $40  ; illegal opcode
            dcp $40  ; illegal opcode
            anc #$40  ; illegal opcode
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/disasm-roundtrip.test.ts:286:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
ok 4 - Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
  ---
  duration_ms: 1206.55601
  type: 'test'
  ...
# Subtest: Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
not ok 5 - Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
  ---
  duration_ms: 5.814728
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/disasm-roundtrip.test.ts:402:1'
  failureType: 'testCodeFailure'
  error: 'Suite D: render() must emit the +2 force for an absolute operand below $0100'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    !cpu 6510
    * = $01000
            lda+2 $00080
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/disasm-roundtrip.test.ts:412:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..5
# tests 5
# suites 0
# pass 2
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1589.880067
```

## `src/mcp/vice/docs-dangling-refs.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test docs-dangling-refs.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
ok 1 - no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
  ---
  duration_ms: 15.036454
  type: 'test'
  ...
# Subtest: the `.vsf` backlog item still exists and still records why it is deferred
ok 2 - the `.vsf` backlog item still exists and still records why it is deferred
  ---
  duration_ms: 0.615025
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
ok 3 - non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
  ---
  duration_ms: 1.788354
  type: 'test'
  ...
# Subtest: planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
ok 4 - planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
  ---
  duration_ms: 0.809383
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
ok 5 - no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
  ---
  duration_ms: 68.915809
  type: 'test'
  ...
# Subtest: positive control: the scanner captures the literals this guard exists to police
ok 6 - positive control: the scanner captures the literals this guard exists to police
  ---
  duration_ms: 1.056475
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned set and the extracted literal volume are real
ok 7 - non-vacuity: the scanned set and the extracted literal volume are real
  ---
  duration_ms: 19.135811
  type: 'test'
  ...
# Subtest: planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
ok 8 - planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
  ---
  duration_ms: 1.198676
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 313.608105
```

### Planted run

- **Plant:** `src/mcp/vice/anno-cli.ts`: `refusing to overwrite the existing file` → `refusing to overwrite the existing FILE`
- **Planted command:** `node --test docs-dangling-refs.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
ok 1 - no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
  ---
  duration_ms: 20.551034
  type: 'test'
  ...
# Subtest: the `.vsf` backlog item still exists and still records why it is deferred
ok 2 - the `.vsf` backlog item still exists and still records why it is deferred
  ---
  duration_ms: 1.135203
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
ok 3 - non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
  ---
  duration_ms: 4.126857
  type: 'test'
  ...
# Subtest: planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
ok 4 - planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
  ---
  duration_ms: 1.649393
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
ok 5 - no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
  ---
  duration_ms: 119.309039
  type: 'test'
  ...
# Subtest: positive control: the scanner captures the literals this guard exists to police
not ok 6 - positive control: the scanner captures the literals this guard exists to police
  ---
  duration_ms: 3.625842
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/docs-dangling-refs.test.ts:382:1'
  failureType: 'testCodeFailure'
  error: "the scanner did not capture anno-cli.ts's concatenated overwrite-refusal literal -- the control for multi-part string concatenation"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/docs-dangling-refs.test.ts:399:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: non-vacuity: the scanned set and the extracted literal volume are real
ok 7 - non-vacuity: the scanned set and the extracted literal volume are real
  ---
  duration_ms: 39.347484
  type: 'test'
  ...
# Subtest: planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
ok 8 - planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
  ---
  duration_ms: 2.740675
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 7
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 437.975206
```

## `src/mcp/vice/hop-chain-comments.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test hop-chain-comments.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: non-vacuity: the scan enumerated at least fifty files
ok 1 - non-vacuity: the scan enumerated at least fifty files
  ---
  duration_ms: 2.318866
  type: 'test'
  ...
# Subtest: non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus
ok 2 - non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus
  ---
  duration_ms: 225.899536
  type: 'test'
  ...
# Subtest: in-tree negative control: absorbed-answer-key.test.ts's legitimate chain line is seen but never flagged
ok 3 - in-tree negative control: absorbed-answer-key.test.ts's legitimate chain line is seen but never flagged
  ---
  duration_ms: 209.815559
  type: 'test'
  ...
# Subtest: fixture: the committed fixture exists and its extension is neither .ts nor .mts
ok 4 - fixture: the committed fixture exists and its extension is neither .ts nor .mts
  ---
  duration_ms: 0.324917
  type: 'test'
  ...
# Subtest: fixture-driven positive control: the fixture's planted half-swept chain line is flagged
ok 5 - fixture-driven positive control: the fixture's planted half-swept chain line is flagged
  ---
  duration_ms: 0.467839
  type: 'test'
  ...
# Subtest: fixture-driven negative control: the fixture's legitimate-narration line reports zero violations
ok 6 - fixture-driven negative control: the fixture's legitimate-narration line reports zero violations
  ---
  duration_ms: 0.258331
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
ok 7 - no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
  ---
  duration_ms: 92.206586
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 764.357987
```

### Planted run

- **Plant:** `src/mcp/vice/absorbed-answer-key.test.ts`: `// src/mcp/vice -> repo root -> .planning/phases/11-.../evidence/criterion1` → `
// src/mcp/vice -> repo root -> .planning/phases/11-.../evidence/criterion1`
- **Planted command:** `node --test hop-chain-comments.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: non-vacuity: the scan enumerated at least fifty files
ok 1 - non-vacuity: the scan enumerated at least fifty files
  ---
  duration_ms: 3.161516
  type: 'test'
  ...
# Subtest: non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus
ok 2 - non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus
  ---
  duration_ms: 288.655513
  type: 'test'
  ...
# Subtest: in-tree negative control: absorbed-answer-key.test.ts's legitimate chain line is seen but never flagged
not ok 3 - in-tree negative control: absorbed-answer-key.test.ts's legitimate chain line is seen but never flagged
  ---
  duration_ms: 129.367555
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/hop-chain-comments.test.ts:374:1'
  failureType: 'testCodeFailure'
  error: |-
    expected the legitimate chain line at absorbed-answer-key.test.ts:34, found at line 35
    
    35 !== 34
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 34
  actual: 35
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/hop-chain-comments.test.ts:382:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: fixture: the committed fixture exists and its extension is neither .ts nor .mts
ok 4 - fixture: the committed fixture exists and its extension is neither .ts nor .mts
  ---
  duration_ms: 0.42065
  type: 'test'
  ...
# Subtest: fixture-driven positive control: the fixture's planted half-swept chain line is flagged
ok 5 - fixture-driven positive control: the fixture's planted half-swept chain line is flagged
  ---
  duration_ms: 0.573334
  type: 'test'
  ...
# Subtest: fixture-driven negative control: the fixture's legitimate-narration line reports zero violations
ok 6 - fixture-driven negative control: the fixture's legitimate-narration line reports zero violations
  ---
  duration_ms: 0.431528
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
ok 7 - no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
  ---
  duration_ms: 105.119551
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 6
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 753.409173
```

## `src/mcp/vice/hostpath-consumers.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test hostpath-consumers.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: hostpath.ts's production consumer set is exactly the five declared modules
ok 1 - hostpath.ts's production consumer set is exactly the five declared modules
  ---
  duration_ms: 47.56632
  type: 'test'
  ...
# Subtest: stock-derived.ts is absent from the hostpath.ts consumer set
ok 2 - stock-derived.ts is absent from the hostpath.ts consumer set
  ---
  duration_ms: 32.579174
  type: 'test'
  ...
# Subtest: the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
ok 3 - the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
  ---
  duration_ms: 33.646452
  type: 'test'
  ...
# Subtest: every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
ok 4 - every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
  ---
  duration_ms: 35.339187
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/ANNO-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
ok 5 - the annotation module family (D-08/ANNO-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
  ---
  duration_ms: 1.916632
  type: 'test'
  ...
# Subtest: MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
ok 6 - MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
  ---
  duration_ms: 1.00042
  type: 'test'
  ...
# Subtest: INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
ok 7 - INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
  ---
  duration_ms: 1.252904
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/ANNO-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
ok 8 - the annotation module family (D-08/ANNO-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
  ---
  duration_ms: 33.165532
  type: 'test'
  ...
# Subtest: planted violation (INT-01 proof): a synthetic anno-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
ok 9 - planted violation (INT-01 proof): a synthetic anno-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
  ---
  duration_ms: 1.148679
  type: 'test'
  ...
# Subtest: planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
ok 10 - planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
  ---
  duration_ms: 1.084894
  type: 'test'
  ...
# Subtest: D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
ok 11 - D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
  ---
  duration_ms: 0.514411
  type: 'test'
  ...
# Subtest: D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
ok 12 - D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
  ---
  duration_ms: 0.649185
  type: 'test'
  ...
# Subtest: D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
ok 13 - D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
  ---
  duration_ms: 28.864154
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 555.748841
```

### Planted run

- **Plant:** `src/mcp/vice/anno-store.ts`: `import { randomUUID } from "node:crypto";` → `import { randomUUID } from "node:crypto";
import { hostPath } from "./hostpath.ts";`
- **Planted command:** `node --test hostpath-consumers.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: hostpath.ts's production consumer set is exactly the five declared modules
not ok 1 - hostpath.ts's production consumer set is exactly the five declared modules
  ---
  duration_ms: 31.564462
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/hostpath-consumers.test.ts:146:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'anno-store.ts',
        'containerpath.ts',
        'install-resources.ts',
        'stock-paths.ts',
        'vice-proxy.ts',
        'vice-sync.ts'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'containerpath.ts'
    1: 'install-resources.ts'
    2: 'stock-paths.ts'
    3: 'vice-proxy.ts'
    4: 'vice-sync.ts'
  actual:
    0: 'anno-store.ts'
    1: 'containerpath.ts'
    2: 'install-resources.ts'
    3: 'stock-paths.ts'
    4: 'vice-proxy.ts'
    5: 'vice-sync.ts'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/hostpath-consumers.test.ts:148:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: stock-derived.ts is absent from the hostpath.ts consumer set
ok 2 - stock-derived.ts is absent from the hostpath.ts consumer set
  ---
  duration_ms: 24.478516
  type: 'test'
  ...
# Subtest: the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
ok 3 - the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
  ---
  duration_ms: 20.012512
  type: 'test'
  ...
# Subtest: every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
ok 4 - every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
  ---
  duration_ms: 23.514
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/ANNO-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
ok 5 - the annotation module family (D-08/ANNO-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
  ---
  duration_ms: 1.533671
  type: 'test'
  ...
# Subtest: MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
ok 6 - MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
  ---
  duration_ms: 1.145114
  type: 'test'
  ...
# Subtest: INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
ok 7 - INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
  ---
  duration_ms: 0.991674
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/ANNO-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
not ok 8 - the annotation module family (D-08/ANNO-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
  ---
  duration_ms: 21.873669
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/hostpath-consumers.test.ts:319:1'
  failureType: 'testCodeFailure'
  error: |-
    anno-store.ts must not import hostpath.ts, whether or not it exists yet
    
    true !== false
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: false
  actual: true
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/hostpath-consumers.test.ts:326:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: planted violation (INT-01 proof): a synthetic anno-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
ok 9 - planted violation (INT-01 proof): a synthetic anno-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
  ---
  duration_ms: 0.675577
  type: 'test'
  ...
# Subtest: planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
ok 10 - planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
  ---
  duration_ms: 0.78169
  type: 'test'
  ...
# Subtest: D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
ok 11 - D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
  ---
  duration_ms: 0.67143
  type: 'test'
  ...
# Subtest: D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
ok 12 - D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
  ---
  duration_ms: 0.387506
  type: 'test'
  ...
# Subtest: D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
ok 13 - D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
  ---
  duration_ms: 25.775721
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 11
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 408.582972
```

## `src/mcp/vice/skill-acme-build-cli.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test skill-acme-build-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
ok 1 - ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
  ---
  duration_ms: 1.580945
  type: 'test'
  ...
# Subtest: acme.mjs is resolved at the expected relative path
ok 2 - acme.mjs is resolved at the expected relative path
  ---
  duration_ms: 0.424788
  type: 'test'
  ...
# Subtest: no arguments: prints usage and exits 0
ok 3 - no arguments: prints usage and exits 0
  ---
  duration_ms: 57.361987
  type: 'test'
  ...
# Subtest: an unknown verb: prints usage and exits 1
ok 4 - an unknown verb: prints usage and exits 1
  ---
  duration_ms: 52.108604
  type: 'test'
  ...
# Subtest: the build verb with a missing source path: exits 1 with the documented message
ok 5 - the build verb with a missing source path: exits 1 with the documented message
  ---
  duration_ms: 69.493757
  type: 'test'
  ...
# Subtest: the build verb with a path that does not exist: exits 1 with the documented message
ok 6 - the build verb with a path that does not exist: exits 1 with the documented message
  ---
  duration_ms: 47.003129
  type: 'test'
  ...
# Subtest: the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
ok 7 - the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
  ---
  duration_ms: 99.177255
  type: 'test'
  ...
# Subtest: the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
ok 8 - the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
  ---
  duration_ms: 59.195441
  type: 'test'
  ...
# Subtest: the scaffold verb with a missing path argument: exits 1 with the documented usage message
ok 9 - the scaffold verb with a missing path argument: exits 1 with the documented usage message
  ---
  duration_ms: 55.340306
  type: 'test'
  ...
# Subtest: the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses
ok 10 - the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses
  ---
  duration_ms: 49.780555
  type: 'test'
  ...
# Subtest: assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)
ok 11 - assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)
  ---
  duration_ms: 107.059705
  type: 'test'
  ...
# Subtest: the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents
ok 12 - the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents
  ---
  duration_ms: 175.986901
  type: 'test'
  ...
# Subtest: a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity
ok 13 - a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity
  ---
  duration_ms: 81.577077
  type: 'test'
  ...
# Subtest: the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes
ok 14 - the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes
  ---
  duration_ms: 302.61837
  type: 'test'
  ...
# Subtest: ACME_BIN is the shared seam's binary name, not a second hand-rolled default
ok 15 - ACME_BIN is the shared seam's binary name, not a second hand-rolled default
  ---
  duration_ms: 0.390693
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1366.621404
```

### Planted run

- **Plant:** `src/mcp/vice/acme-gate.ts`: `export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";` → `export const ACME_BIN: string = process.env.ACME_BIN ?? "acmeZZ";`
- **Planted command:** `node --test skill-acme-build-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
ok 1 - ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
  ---
  duration_ms: 2.893776
  type: 'test'
  ...
# Subtest: acme.mjs is resolved at the expected relative path
ok 2 - acme.mjs is resolved at the expected relative path
  ---
  duration_ms: 2.263315
  type: 'test'
  ...
# Subtest: no arguments: prints usage and exits 0
ok 3 - no arguments: prints usage and exits 0
  ---
  duration_ms: 71.541303
  type: 'test'
  ...
# Subtest: an unknown verb: prints usage and exits 1
ok 4 - an unknown verb: prints usage and exits 1
  ---
  duration_ms: 70.893681
  type: 'test'
  ...
# Subtest: the build verb with a missing source path: exits 1 with the documented message
ok 5 - the build verb with a missing source path: exits 1 with the documented message
  ---
  duration_ms: 67.194031
  type: 'test'
  ...
# Subtest: the build verb with a path that does not exist: exits 1 with the documented message
ok 6 - the build verb with a path that does not exist: exits 1 with the documented message
  ---
  duration_ms: 76.88917
  type: 'test'
  ...
# Subtest: the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
ok 7 - the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
  ---
  duration_ms: 137.21361
  type: 'test'
  ...
# Subtest: the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
ok 8 - the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
  ---
  duration_ms: 74.624974
  type: 'test'
  ...
# Subtest: the scaffold verb with a missing path argument: exits 1 with the documented usage message
ok 9 - the scaffold verb with a missing path argument: exits 1 with the documented usage message
  ---
  duration_ms: 84.728848
  type: 'test'
  ...
# Subtest: the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses
ok 10 - the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 1.101182
  type: 'test'
  ...
# Subtest: assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)
ok 11 - assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check) # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.489611
  type: 'test'
  ...
# Subtest: the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents
ok 12 - the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 8.406894
  type: 'test'
  ...
# Subtest: a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity
ok 13 - a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.137485
  type: 'test'
  ...
# Subtest: the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes
ok 14 - the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.099154
  type: 'test'
  ...
# Subtest: ACME_BIN is the shared seam's binary name, not a second hand-rolled default
not ok 15 - ACME_BIN is the shared seam's binary name, not a second hand-rolled default
  ---
  duration_ms: 2.391925
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/skill-acme-build-cli.test.ts:288:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    'acmeZZ' !== 'acme'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'acme'
  actual: 'acmeZZ'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/skill-acme-build-cli.test.ts:289:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..15
# tests 15
# suites 0
# pass 9
# fail 1
# cancelled 0
# skipped 5
# todo 0
# duration_ms 842.353365
```

## `src/mcp/vice/stock-dispatch.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test stock-dispatch.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:341232) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
ok 1 - manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
  ---
  duration_ms: 6.494665
  type: 'test'
  ...
# Subtest: manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
ok 2 - manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
  ---
  duration_ms: 0.701536
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
ok 3 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
  ---
  duration_ms: 0.85374
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
ok 4 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
  ---
  duration_ms: 0.609063
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
ok 5 - manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
  ---
  duration_ms: 4.267769
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
ok 6 - manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
  ---
  duration_ms: 3.268646
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
ok 7 - manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
  ---
  duration_ms: 3.044617
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
ok 8 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
  ---
  duration_ms: 1.933202
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
ok 9 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
  ---
  duration_ms: 3.772748
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
ok 10 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
  ---
  duration_ms: 2.341027
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
ok 11 - WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
  ---
  duration_ms: 2.115228
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
ok 12 - WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
  ---
  duration_ms: 0.525322
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
ok 13 - WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
  ---
  duration_ms: 1.980548
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
ok 14 - manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
  ---
  duration_ms: 4.814269
  type: 'test'
  ...
# Subtest: manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
ok 15 - manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
  ---
  duration_ms: 2.250597
  type: 'test'
  ...
# Subtest: manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
ok 16 - manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
  ---
  duration_ms: 1.905549
  type: 'test'
  ...
# Subtest: manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
ok 17 - manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
  ---
  duration_ms: 3.714824
  type: 'test'
  ...
# Subtest: manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
ok 18 - manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
  ---
  duration_ms: 5.771178
  type: 'test'
  ...
# Subtest: manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
ok 19 - manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
  ---
  duration_ms: 1.858518
  type: 'test'
  ...
# Subtest: manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
ok 20 - manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
  ---
  duration_ms: 1.65778
  type: 'test'
  ...
# Subtest: lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
ok 21 - lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
  ---
  duration_ms: 1.578405
  type: 'test'
  ...
# Subtest: lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
ok 22 - lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
  ---
  duration_ms: 0.697935
  type: 'test'
  ...
# Subtest: lease: a provider failure never calls stockConnect and its message passes through verbatim
ok 23 - lease: a provider failure never calls stockConnect and its message passes through verbatim
  ---
  duration_ms: 0.50279
  type: 'test'
  ...
# Subtest: lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
ok 24 - lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
  ---
  duration_ms: 0.687283
  type: 'test'
  ...
# Subtest: lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
ok 25 - lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
  ---
  duration_ms: 0.655763
  type: 'test'
  ...
# Subtest: lease: a replacement acquisition naming a different targetId calls stockConnect a second time
ok 26 - lease: a replacement acquisition naming a different targetId calls stockConnect a second time
  ---
  duration_ms: 0.903556
  type: 'test'
  ...
# Subtest: CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
ok 27 - CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
  ---
  duration_ms: 0.690745
  type: 'test'
  ...
# Subtest: CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
ok 28 - CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
  ---
  duration_ms: 1.064998
  type: 'test'
  ...
# Subtest: CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
ok 29 - CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
  ---
  duration_ms: 0.803688
  type: 'test'
  ...
# ensureStockSession: tearing down the replaced stock session for target grant-1 did not complete: Error: test: broker refused the release
# Subtest: CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
ok 30 - CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
  ---
  duration_ms: 87.104353
  type: 'test'
  ...
# Subtest: CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
ok 31 - CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
  ---
  duration_ms: 1.077563
  type: 'test'
  ...
# Subtest: CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
ok 32 - CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
  ---
  duration_ms: 1.054073
  type: 'test'
  ...
# Subtest: WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
ok 33 - WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
  ---
  duration_ms: 3.785353
  type: 'test'
  ...
# Subtest: WR-03: reusing the held session for the SAME targetId never evicts its conditions
ok 34 - WR-03: reusing the held session for the SAME targetId never evicts its conditions
  ---
  duration_ms: 1.27945
  type: 'test'
  ...
# Subtest: CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
ok 35 - CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
  ---
  duration_ms: 0.77061
  type: 'test'
  ...
# Subtest: lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
ok 36 - lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
  ---
  duration_ms: 0.776472
  type: 'test'
  ...
# Subtest: lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
ok 37 - lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
  ---
  duration_ms: 1.795626
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
ok 38 - runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
  ---
  duration_ms: 0.526036
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
ok 39 - runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
  ---
  duration_ms: 0.56871
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
ok 40 - runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
  ---
  duration_ms: 0.647838
  type: 'test'
  ...
# Subtest: withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
ok 41 - withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
  ---
  duration_ms: 1.107255
  type: 'test'
  ...
# Subtest: withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
ok 42 - withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
  ---
  duration_ms: 0.494613
  type: 'test'
  ...
# Subtest: withStockSession: a family handler that throws yields isError:true rather than propagating
ok 43 - withStockSession: a family handler that throws yields isError:true rather than propagating
  ---
  duration_ms: 0.786544
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
ok 44 - dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
  ---
  duration_ms: 0.346932
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
ok 45 - dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
  ---
  duration_ms: 0.366493
  type: 'test'
  ...
# Subtest: dispatch: the table's key count is exactly 38
ok 46 - dispatch: the table's key count is exactly 38
  ---
  duration_ms: 0.34064
  type: 'test'
  ...
# Subtest: dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
ok 47 - dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
  ---
  duration_ms: 0.708637
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
ok 48 - dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
  ---
  duration_ms: 0.33893
  type: 'test'
  ...
# Subtest: dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
ok 49 - dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
  ---
  duration_ms: 1.192038
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
ok 50 - refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
  ---
  duration_ms: 0.478768
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
ok 51 - refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
  ---
  duration_ms: 0.418782
  type: 'test'
  ...
# Subtest: refus: dispatchStock never returns a success shape for an unknown tool name
ok 52 - refus: dispatchStock never returns a success shape for an unknown tool name
  ---
  duration_ms: 0.322251
  type: 'test'
  ...
# Subtest: ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
ok 53 - ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
  ---
  duration_ms: 0.921349
  type: 'test'
  ...
# Subtest: ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
ok 54 - ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
  ---
  duration_ms: 0.440873
  type: 'test'
  ...
# Subtest: ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
ok 55 - ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
  ---
  duration_ms: 0.667246
  type: 'test'
  ...
# Subtest: WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
ok 56 - WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
  ---
  duration_ms: 0.526206
  type: 'test'
  ...
# Subtest: WR-05 ping: the resolution flag defaults to false when nothing said otherwise
ok 57 - WR-05 ping: the resolution flag defaults to false when nothing said otherwise
  ---
  duration_ms: 0.536335
  type: 'test'
  ...
# Subtest: WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
ok 58 - WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
  ---
  duration_ms: 0.785583
  type: 'test'
  ...
# Subtest: WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
ok 59 - WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
  ---
  duration_ms: 0.648043
  type: 'test'
  ...
# Subtest: WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
ok 60 - WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
  ---
  duration_ms: 0.584958
  type: 'test'
  ...
# Subtest: ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
ok 61 - ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
  ---
  duration_ms: 0.633022
  type: 'test'
  ...
# Subtest: ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
ok 62 - ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
  ---
  duration_ms: 0.864516
  type: 'test'
  ...
# Subtest: dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
ok 63 - dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
  ---
  duration_ms: 0.465714
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
ok 64 - structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
  ---
  duration_ms: 0.666289
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
ok 65 - structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
  ---
  duration_ms: 0.675503
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
ok 66 - structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
  ---
  duration_ms: 1.398208
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
ok 67 - structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
  ---
  duration_ms: 0.787433
  type: 'test'
  ...
# Subtest: structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
ok 68 - structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
  ---
  duration_ms: 1.050995
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
ok 69 - structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
  ---
  duration_ms: 1.458548
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
ok 70 - structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
  ---
  duration_ms: 1.086972
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
ok 71 - structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
  ---
  duration_ms: 0.931866
  type: 'test'
  ...
# Subtest: structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
ok 72 - structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
  ---
  duration_ms: 0.998371
  type: 'test'
  ...
# Subtest: structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
ok 73 - structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
  ---
  duration_ms: 2.202982
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
ok 74 - structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
  ---
  duration_ms: 0.484684
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
ok 75 - structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
  ---
  duration_ms: 1.031727
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
ok 76 - structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
  ---
  duration_ms: 0.858105
  type: 'test'
  ...
# Subtest: structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
ok 77 - structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
  ---
  duration_ms: 0.5555
  type: 'test'
  ...
# Subtest: structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
ok 78 - structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
  ---
  duration_ms: 0.61583
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
ok 79 - conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.547523
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
ok 80 - conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.07154
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
ok 81 - conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 5.270107
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
ok 82 - conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.472369
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
ok 83 - conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.808113
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
ok 84 - conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.32315
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
ok 85 - conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.508749
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
ok 86 - conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.167143
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
ok 87 - conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.498496
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
ok 88 - conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.925644
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
ok 89 - conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.149107
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
ok 90 - conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.773809
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
ok 91 - conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.671271
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
ok 92 - conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.001786
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
ok 93 - conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 42.097916
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
ok 94 - conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.923061
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
ok 95 - conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.059415
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
ok 96 - conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.910166
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
ok 97 - conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.724559
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
ok 98 - conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.725911
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
ok 99 - conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.102417
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
ok 100 - conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.536462
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
ok 101 - conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.302905
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
ok 102 - conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.379365
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
ok 103 - conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.79875
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
ok 104 - conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.085417
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
ok 105 - conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.498426
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
ok 106 - end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
  ---
  duration_ms: 0.935886
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
ok 107 - conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.740812
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
ok 108 - conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 6.938659
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
ok 109 - end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
  ---
  duration_ms: 1.995213
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
ok 110 - conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.338108
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
ok 111 - conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 5.729781
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
ok 112 - conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.888011
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
ok 113 - conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 5.532961
  type: 'test'
  ...
# Subtest: structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
ok 114 - structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
  ---
  duration_ms: 1.164151
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
ok 115 - conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.872059
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
ok 116 - conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.654729
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
ok 117 - conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 27.92403
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
ok 118 - conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 11.71538
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
ok 119 - conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 20.270583
  type: 'test'
  ...
# Subtest: regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
ok 120 - regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
  ---
  duration_ms: 1.158191
  type: 'test'
  ...
# Subtest: conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
ok 121 - conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
  ---
  duration_ms: 1.826628
  type: 'test'
  ...
# Subtest: conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
ok 122 - conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
  ---
  duration_ms: 1.743028
  type: 'test'
  ...
# Subtest: withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
ok 123 - withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
  ---
  duration_ms: 0.508305
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
ok 124 - withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
  ---
  duration_ms: 0.540309
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
ok 125 - withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
  ---
  duration_ms: 0.638487
  type: 'test'
  ...
# Subtest: withDerivedTool: a handler that throws is converted via convertWireError, not propagated
ok 126 - withDerivedTool: a handler that throws is converted via convertWireError, not propagated
  ---
  duration_ms: 0.550506
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
ok 127 - withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
  ---
  duration_ms: 0.673597
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
ok 128 - withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
  ---
  duration_ms: 0.460683
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
ok 129 - invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
  ---
  duration_ms: 31.20377
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
ok 130 - invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
  ---
  duration_ms: 27.309429
  type: 'test'
  ...
1..130
# tests 130
# suites 0
# pass 130
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1012.15895
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `    assertAnnoTool(name, args);` → `    assertAnnoTool(name, args); // forwardToVice`
- **Planted command:** `node --test stock-dispatch.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:341266) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
ok 1 - manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
  ---
  duration_ms: 7.315027
  type: 'test'
  ...
# Subtest: manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
ok 2 - manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
  ---
  duration_ms: 0.743979
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
ok 3 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
  ---
  duration_ms: 0.838811
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
ok 4 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
  ---
  duration_ms: 0.597158
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
ok 5 - manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
  ---
  duration_ms: 5.834266
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
ok 6 - manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
  ---
  duration_ms: 2.087205
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
ok 7 - manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
  ---
  duration_ms: 2.680705
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
ok 8 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
  ---
  duration_ms: 1.781305
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
ok 9 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
  ---
  duration_ms: 3.367212
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
ok 10 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
  ---
  duration_ms: 2.229333
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
ok 11 - WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
  ---
  duration_ms: 1.8043
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
ok 12 - WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
  ---
  duration_ms: 0.503707
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
ok 13 - WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
  ---
  duration_ms: 2.104676
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
ok 14 - manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
  ---
  duration_ms: 4.994622
  type: 'test'
  ...
# Subtest: manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
ok 15 - manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
  ---
  duration_ms: 2.212862
  type: 'test'
  ...
# Subtest: manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
ok 16 - manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
  ---
  duration_ms: 1.933878
  type: 'test'
  ...
# Subtest: manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
ok 17 - manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
  ---
  duration_ms: 4.184021
  type: 'test'
  ...
# Subtest: manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
ok 18 - manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
  ---
  duration_ms: 6.362165
  type: 'test'
  ...
# Subtest: manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
ok 19 - manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
  ---
  duration_ms: 2.003926
  type: 'test'
  ...
# Subtest: manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
ok 20 - manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
  ---
  duration_ms: 1.643755
  type: 'test'
  ...
# Subtest: lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
ok 21 - lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
  ---
  duration_ms: 1.67313
  type: 'test'
  ...
# Subtest: lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
ok 22 - lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
  ---
  duration_ms: 0.768309
  type: 'test'
  ...
# Subtest: lease: a provider failure never calls stockConnect and its message passes through verbatim
ok 23 - lease: a provider failure never calls stockConnect and its message passes through verbatim
  ---
  duration_ms: 0.51283
  type: 'test'
  ...
# Subtest: lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
ok 24 - lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
  ---
  duration_ms: 0.726559
  type: 'test'
  ...
# Subtest: lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
ok 25 - lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
  ---
  duration_ms: 0.664138
  type: 'test'
  ...
# Subtest: lease: a replacement acquisition naming a different targetId calls stockConnect a second time
ok 26 - lease: a replacement acquisition naming a different targetId calls stockConnect a second time
  ---
  duration_ms: 0.945398
  type: 'test'
  ...
# Subtest: CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
ok 27 - CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
  ---
  duration_ms: 0.738862
  type: 'test'
  ...
# Subtest: CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
ok 28 - CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
  ---
  duration_ms: 0.994569
  type: 'test'
  ...
# Subtest: CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
ok 29 - CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
  ---
  duration_ms: 0.871086
  type: 'test'
  ...
# ensureStockSession: tearing down the replaced stock session for target grant-1 did not complete: Error: test: broker refused the release
# Subtest: CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
ok 30 - CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
  ---
  duration_ms: 84.594412
  type: 'test'
  ...
# Subtest: CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
ok 31 - CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
  ---
  duration_ms: 0.667801
  type: 'test'
  ...
# Subtest: CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
ok 32 - CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
  ---
  duration_ms: 0.574899
  type: 'test'
  ...
# Subtest: WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
ok 33 - WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
  ---
  duration_ms: 2.096921
  type: 'test'
  ...
# Subtest: WR-03: reusing the held session for the SAME targetId never evicts its conditions
ok 34 - WR-03: reusing the held session for the SAME targetId never evicts its conditions
  ---
  duration_ms: 0.693734
  type: 'test'
  ...
# Subtest: CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
ok 35 - CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
  ---
  duration_ms: 0.460883
  type: 'test'
  ...
# Subtest: lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
ok 36 - lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
  ---
  duration_ms: 0.394024
  type: 'test'
  ...
# Subtest: lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
ok 37 - lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
  ---
  duration_ms: 1.14942
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
ok 38 - runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
  ---
  duration_ms: 0.405263
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
ok 39 - runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
  ---
  duration_ms: 0.285529
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
ok 40 - runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
  ---
  duration_ms: 0.280002
  type: 'test'
  ...
# Subtest: withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
ok 41 - withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
  ---
  duration_ms: 0.750988
  type: 'test'
  ...
# Subtest: withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
ok 42 - withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
  ---
  duration_ms: 0.306019
  type: 'test'
  ...
# Subtest: withStockSession: a family handler that throws yields isError:true rather than propagating
ok 43 - withStockSession: a family handler that throws yields isError:true rather than propagating
  ---
  duration_ms: 0.429431
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
ok 44 - dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
  ---
  duration_ms: 0.147526
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
ok 45 - dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
  ---
  duration_ms: 0.151644
  type: 'test'
  ...
# Subtest: dispatch: the table's key count is exactly 38
ok 46 - dispatch: the table's key count is exactly 38
  ---
  duration_ms: 0.137837
  type: 'test'
  ...
# Subtest: dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
ok 47 - dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
  ---
  duration_ms: 0.517371
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
ok 48 - dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
  ---
  duration_ms: 0.209828
  type: 'test'
  ...
# Subtest: dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
ok 49 - dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
  ---
  duration_ms: 0.655645
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
ok 50 - refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
  ---
  duration_ms: 0.242153
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
ok 51 - refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
  ---
  duration_ms: 0.209773
  type: 'test'
  ...
# Subtest: refus: dispatchStock never returns a success shape for an unknown tool name
ok 52 - refus: dispatchStock never returns a success shape for an unknown tool name
  ---
  duration_ms: 0.137508
  type: 'test'
  ...
# Subtest: ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
ok 53 - ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
  ---
  duration_ms: 0.534614
  type: 'test'
  ...
# Subtest: ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
ok 54 - ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
  ---
  duration_ms: 0.248037
  type: 'test'
  ...
# Subtest: ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
ok 55 - ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
  ---
  duration_ms: 0.363543
  type: 'test'
  ...
# Subtest: WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
ok 56 - WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
  ---
  duration_ms: 0.276322
  type: 'test'
  ...
# Subtest: WR-05 ping: the resolution flag defaults to false when nothing said otherwise
ok 57 - WR-05 ping: the resolution flag defaults to false when nothing said otherwise
  ---
  duration_ms: 0.208368
  type: 'test'
  ...
# Subtest: WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
ok 58 - WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
  ---
  duration_ms: 0.49331
  type: 'test'
  ...
# Subtest: WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
ok 59 - WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
  ---
  duration_ms: 0.52058
  type: 'test'
  ...
# Subtest: WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
ok 60 - WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
  ---
  duration_ms: 0.517223
  type: 'test'
  ...
# Subtest: ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
ok 61 - ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
  ---
  duration_ms: 0.534524
  type: 'test'
  ...
# Subtest: ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
ok 62 - ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
  ---
  duration_ms: 0.606964
  type: 'test'
  ...
# Subtest: dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
ok 63 - dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
  ---
  duration_ms: 0.313097
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
ok 64 - structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
  ---
  duration_ms: 0.382535
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
ok 65 - structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
  ---
  duration_ms: 0.434344
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
ok 66 - structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
  ---
  duration_ms: 1.233808
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
ok 67 - structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
  ---
  duration_ms: 0.614298
  type: 'test'
  ...
# Subtest: structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
ok 68 - structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
  ---
  duration_ms: 1.011691
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
ok 69 - structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
  ---
  duration_ms: 1.433175
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
ok 70 - structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
  ---
  duration_ms: 1.031641
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
ok 71 - structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
  ---
  duration_ms: 1.067527
  type: 'test'
  ...
# Subtest: structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
not ok 72 - structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
  ---
  duration_ms: 2.275829
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/stock-dispatch.test.ts:1555:1'
  failureType: 'testCodeFailure'
  error: "runAnnoTool() must not reach forwardToVice -- that is what makes the anno_* family's backend-independence sound: the runner reaches a proxy-local SQLite store and never the host-path seam"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/stock-dispatch.test.ts:1565:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
ok 73 - structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
  ---
  duration_ms: 2.471266
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
ok 74 - structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
  ---
  duration_ms: 0.486825
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
ok 75 - structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
  ---
  duration_ms: 0.937463
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
ok 76 - structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
  ---
  duration_ms: 0.750431
  type: 'test'
  ...
# Subtest: structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
ok 77 - structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
  ---
  duration_ms: 0.569236
  type: 'test'
  ...
# Subtest: structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
ok 78 - structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
  ---
  duration_ms: 0.565461
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
ok 79 - conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.16471
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
ok 80 - conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 5.389335
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
ok 81 - conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.524918
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
ok 82 - conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.128444
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
ok 83 - conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.621741
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
ok 84 - conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.255585
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
ok 85 - conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.510445
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
ok 86 - conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.676826
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
ok 87 - conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.576557
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
ok 88 - conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.270298
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
ok 89 - conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.187252
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
ok 90 - conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.114469
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
ok 91 - conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.883236
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
ok 92 - conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.423117
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
ok 93 - conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 51.106884
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
ok 94 - conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.012737
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
ok 95 - conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.334043
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
ok 96 - conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.658832
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
ok 97 - conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.239825
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
ok 98 - conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.740255
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
ok 99 - conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.396394
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
ok 100 - conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.486513
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
ok 101 - conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.735395
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
ok 102 - conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.035006
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
ok 103 - conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.231456
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
ok 104 - conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.612741
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
ok 105 - conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 8.202424
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
ok 106 - end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
  ---
  duration_ms: 1.138342
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
ok 107 - conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 5.108603
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
ok 108 - conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.027829
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
ok 109 - end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
  ---
  duration_ms: 1.792889
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
ok 110 - conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.841421
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
ok 111 - conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.7652
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
ok 112 - conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.834556
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
ok 113 - conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.834451
  type: 'test'
  ...
# Subtest: structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
ok 114 - structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
  ---
  duration_ms: 0.622894
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
ok 115 - conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.067771
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
ok 116 - conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.208404
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
ok 117 - conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 28.635199
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
ok 118 - conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 4.424579
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
ok 119 - conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 12.519594
  type: 'test'
  ...
# Subtest: regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
ok 120 - regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
  ---
  duration_ms: 0.693526
  type: 'test'
  ...
# Subtest: conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
ok 121 - conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
  ---
  duration_ms: 1.612102
  type: 'test'
  ...
# Subtest: conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
ok 122 - conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
  ---
  duration_ms: 1.136956
  type: 'test'
  ...
# Subtest: withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
ok 123 - withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
  ---
  duration_ms: 0.272592
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
ok 124 - withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
  ---
  duration_ms: 0.236725
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
ok 125 - withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
  ---
  duration_ms: 0.275735
  type: 'test'
  ...
# Subtest: withDerivedTool: a handler that throws is converted via convertWireError, not propagated
ok 126 - withDerivedTool: a handler that throws is converted via convertWireError, not propagated
  ---
  duration_ms: 0.274716
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
ok 127 - withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
  ---
  duration_ms: 0.317059
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
ok 128 - withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
  ---
  duration_ms: 0.192958
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
ok 129 - invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
  ---
  duration_ms: 17.458141
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
ok 130 - invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
  ---
  duration_ms: 14.216212
  type: 'test'
  ...
1..130
# tests 130
# suites 0
# pass 129
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 915.580524
```

## `src/mcp/vice/tool-support-table.test.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern derived-union equality tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
ok 1 - derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
  ---
  duration_ms: 19.367746
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 286.614042
```

### Planted run

- **Plant:** `src/mcp/vice/tool-support-table.test.mjs`: `const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/;` → `const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONZ\s*\)/;`
- **Planted command:** `node --test --test-name-pattern derived-union equality tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
not ok 1 - derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
  ---
  duration_ms: 7.456018
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/tool-support-table.test.mjs:270:1'
  failureType: 'testCodeFailure'
  error: 'independentlyDiscoverSyntheticNames: could not resolve "annoDef" to a declaration'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: ~
  operator: '=='
  stack: |-
    independentlyDiscoverSyntheticNames (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/tool-support-table.test.mjs:106:12)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/tool-support-table.test.mjs:281:26)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 222.054143
```

## `src/mcp/vice/vice-proxy.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern tools/list survives a missing or corrupt snapshot vice-proxy.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:341358) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# vice-proxy.test: after() force-closed 0 leaked server(s) and killed 1 leaked child(ren) -- a test threw before its own teardown ran; this is the net, not the fix -- find and repair that test's try/finally shape.
# Subtest: tools/list survives a missing or corrupt snapshot
ok 1 - tools/list survives a missing or corrupt snapshot
  ---
  duration_ms: 4083.123991
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4630.842698
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `ANNO_TOOL_DEFINITIONS.map((def) => def.name)` → `ANNO_TOOL_DEFINITIONS.map((def) => def.name + "X")`
- **Planted command:** `node --test --test-name-pattern tools/list survives a missing or corrupt snapshot vice-proxy.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:341495) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# vice-proxy.test: after() force-closed 0 leaked server(s) and killed 1 leaked child(ren) -- a test threw before its own teardown ran; this is the net, not the fix -- find and repair that test's try/finally shape.
# Subtest: tools/list survives a missing or corrupt snapshot
not ok 1 - tools/list survives a missing or corrupt snapshot
  ---
  duration_ms: 1555.445267
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/vice-proxy.test.ts:570:1'
  failureType: 'testCodeFailure'
  error: |-
    expected only the synthetic and anno_* tools for /tmp/vice-proxy-manifest-bad-JGLb1S/does-not-exist.json
    + actual - expected
    
      [
        'vice_result_continue',
        'vice_recycle',
        'vice_diagnose',
    +   'anno_set_label_name',
    +   'anno_set_comment',
    +   'anno_set_data_type',
    +   'anno_add_scope',
    +   'anno_remove_scope',
    +   'anno_get_symbols',
    +   'anno_get_comments',
    +   'anno_get_blocks',
    +   'anno_create_project_enum',
    +   'anno_update_project_enum',
    +   'anno_apply_enum_usage',
    +   'anno_save_project',
    +   'anno_disassemble',
    +   'anno_read_region',
    +   'anno_get_binary_info',
    +   'anno_get_cross_references',
    +   'anno_search',
    +   'anno_get_address_details',
    +   'anno_batch_execute'
    -   'anno_set_label_nameX',
    -   'anno_set_commentX',
    -   'anno_set_data_typeX',
    -   'anno_add_scopeX',
    -   'anno_remove_scopeX',
    -   'anno_get_symbolsX',
    -   'anno_get_commentsX',
    -   'anno_get_blocksX',
    -   'anno_create_project_enumX',
    -   'anno_update_project_enumX',
    -   'anno_apply_enum_usageX',
    -   'anno_save_projectX',
    -   'anno_disassembleX',
    -   'anno_read_regionX',
    -   'anno_get_binary_infoX',
    -   'anno_get_cross_referencesX',
    -   'anno_searchX',
    -   'anno_get_address_detailsX',
    -   'anno_batch_executeX'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'vice_result_continue'
    1: 'vice_recycle'
    2: 'vice_diagnose'
    3: 'anno_set_label_nameX'
    4: 'anno_set_commentX'
    5: 'anno_set_data_typeX'
    6: 'anno_add_scopeX'
    7: 'anno_remove_scopeX'
    8: 'anno_get_symbolsX'
    9: 'anno_get_commentsX'
    10: 'anno_get_blocksX'
    11: 'anno_create_project_enumX'
    12: 'anno_update_project_enumX'
    13: 'anno_apply_enum_usageX'
    14: 'anno_save_projectX'
    15: 'anno_disassembleX'
    16: 'anno_read_regionX'
    17: 'anno_get_binary_infoX'
    18: 'anno_get_cross_referencesX'
    19: 'anno_searchX'
    20: 'anno_get_address_detailsX'
    21: 'anno_batch_executeX'
  actual:
    0: 'vice_result_continue'
    1: 'vice_recycle'
    2: 'vice_diagnose'
    3: 'anno_set_label_name'
    4: 'anno_set_comment'
    5: 'anno_set_data_type'
    6: 'anno_add_scope'
    7: 'anno_remove_scope'
    8: 'anno_get_symbols'
    9: 'anno_get_comments'
    10: 'anno_get_blocks'
    11: 'anno_create_project_enum'
    12: 'anno_update_project_enum'
    13: 'anno_apply_enum_usage'
    14: 'anno_save_project'
    15: 'anno_disassemble'
    16: 'anno_read_region'
    17: 'anno_get_binary_info'
    18: 'anno_get_cross_references'
    19: 'anno_search'
    20: 'anno_get_address_details'
    21: 'anno_batch_execute'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a74dc0897a837deff/src/mcp/vice/vice-proxy.test.ts:601:16)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2215.35203
```

