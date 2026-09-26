# v2.0.0 step 3: Ghidra without the symlink alias

## Context

Ghidra refuses a project location with a dot-prefixed path segment. Today
`ghidra-project.mts` gets around this with a broker-minted symlink handle,
`<repoRoot>/c64-re-tools -> .c64-re-tools`. `ensureGhidraRunsHandle()` mints
it at broker startup and again in `resolveGhidraProject()`, and every project
lands in `<repoRoot>/c64-re-tools/runs/ghidra/<runId>`.

That design needs a project checkout as the broker's `--repo-root`. The v2
broker is machine-level and none of its documented start routes pass one. The
live systemd broker in step 2 logged `ghidra runs handle refused ... requires a
non-empty string "repoRoot"`. **So `ghidra.analyze` does not work at all under
the supported v2 start routes.**

A handle under the broker home would not help: `brokerHome()` defaults to
`~/.c64-re-tools`, which is dotted, and so is every directory derived from it.
There is a second problem: run logs and emptied project directories pile up
under the repo's runs root, and nothing sweeps them.

The roadmap item: "Ghidra runs land on a broker-side root that has no
dot-prefixed segment, and the alias mechanism is deleted. This must be measured
against real Ghidra."

## Decisions

- **New broker-side root** `brokerGhidraDir()` in `broker-home.mts`:
  - `VICE_BROKER_GHIDRA_DIR` when set (absolutized);
  - otherwise `join(os.tmpdir(), "c64-re-tools-ghidra-<uid>")`, which has no
    dotted segment on Linux (`/tmp`) or macOS (`/var/folders/.../T`).
  - It lives outside `brokerHome()` on purpose.
- **A dotted root is refused by name** at the point of use, with the remedy
  (set `VICE_BROKER_GHIDRA_DIR` to a path with no dot-prefixed segment). The
  root is never rewritten or guessed.
- **Nothing persists broker-side:**
  - Each run gets a fresh, uniquely named project directory under the root
    (`mkdtempSync(join(root, runId + "-"))`).
  - The directory is removed once the run finishes, whether the spawn
    succeeded or failed. Nothing ever downloads the Ghidra project itself.
  - The run log is written to the request's own scratch `out/` (the
    `HostToolDeps.outputDir` the broker already sets), so the request-end
    staging cleanup removes it.
- **Run-id reuse refusal goes.** Every run has its own directory, so reuse
  can't collide. `RUN_ID_PATTERN` validation stays, because the run id still
  names the project and the log.
- **The executor gets a new option, `HostToolDeps.ghidraProjectsRoot`.** No
  request can set it; the broker sets it to `brokerGhidraDir()`, and in-process
  callers (tests) name their own. This is the same pattern as `outputDir` in
  step 1.
- **`HostToolDeps.projectRoot` stays.** It is still the `tools.json` locator
  input (`host-tool.mts:2816`); only its Ghidra use goes, and its doc comment
  is updated.
- **Startup sweep:** the broker sweeps leftover run directories under
  `brokerGhidraDir()` by reusing `sweepOrphanedStaging()` (`broker-kill.mts`).
  It runs at the same post-bind point as the staging sweep, for the same
  reason: the broker has just won the bind, so no run can be live yet.
- **Deleted:**
  - `ensureGhidraRunsHandle()`, `ghidraRunsRoot()`, `ghidraRunsRealRoot()`,
    `GHIDRA_RUNS_HANDLE_NAME` and `GHIDRA_RUNS_HANDLE_TARGET`;
  - the broker's startup handle call and its log line;
  - the `.gitignore` alias stanza.
- **Wire redaction:** `vice-broker.mts`'s reply scrub also scrubs the Ghidra
  root, so no broker-side project path reaches a client.

## Task 1: Save spec documentation

Create `agent-os/specs/2026-09-26-0022-ghidra-without-alias/` containing:
- `plan.md`: this plan.
- `shape.md`: scope, decisions, context.
- `standards.md`: the full text of `broker/host-bound-modules`,
  `global/injectable-deps`, `global/module-header` and
  `skills/refuse-never-guess`.
- `references.md`, pointing to:
  - `sweepOrphanedStaging()` (`broker-kill.mts`), to reuse for the sweep;
  - `HostToolDeps.outputDir` (`host-tool.mts`), the precedent for an
    executor-only option;
  - `hasDotPrefixedSegment()` (`ghidra-project.mts`), the existing check;
  - the step-2 staging-sweep placement (`vice-broker.mts`, post-bind, no
    `await`).

## Task 2: Broker-side root and per-run projects

- **`broker-home.mts`:** add `brokerGhidraDir(opts)`, taking the same
  `env`/`homedir`-style injectable options as its siblings plus `tmpdir` and
  `uid`.
- **`ghidra-project.mts`:**
  - Delete the handle functions and constants, along with the header prose
    about them.
  - `resolveGhidraProject({ runsRoot, runId })`:
    - validates `runId`;
    - refuses a dotted `runsRoot`, naming `VICE_BROKER_GHIDRA_DIR`;
    - creates `runsRoot` recursively and mkdtemps the per-run directory;
    - returns `{ projectLocation, projectName: runId }`.
  - Keep `hasDotPrefixedSegment()`, `-deleteProject` and the independent
    dotted-location re-check in `buildAnalyzeHeadlessArgv()`.
- **`host-tool.mts`, `ghidra.analyze`:**
  - Resolve the project under `deps.ghidraProjectsRoot`. When that is absent,
    refuse by name; there is no silent default in the executor.
  - Write the run log to `deps.outputDir` (falling back to `repoRootAbs`, the
    scratch, when it is absent).
  - Remove the per-run project directory in a `finally` around the spawn,
    replacing the preflight-only `ghidraReservedProjectLocation` cleanup.
  - Update the oracle-scratch comment (around 3435) that describes the alias.
- **`vice-broker.mts`:**
  - Pass `ghidraProjectsRoot: brokerGhidraDir()` from `handleHostToolRun`.
  - Delete the handle block and its log lines.
  - Add the Ghidra-root sweep beside the staging sweep.
  - Add the root to the reply scrub.
  - Print one stderr line naming the Ghidra root, as it does for the state
    directory.
- **Elsewhere:**
  - `repo-root.ts`: the census drops to 9 occurrences across 7 files, and the
    alias paragraphs go.
  - `.gitignore`: remove the alias stanza and fix the runs/ghidra comment.
- Run `node build.ts`.

## Task 3: Tests

- **`ghidra-project.test.ts`:** delete the handle and reuse tests. Add:
  - a dotted `runsRoot` is refused, naming the env var, and nothing is created;
  - two resolutions of the same `runId` give distinct, existing directories;
  - the project location contains no dotted segment.
- **`broker-home.test.ts`:** cover `brokerGhidraDir()`:
  - the override wins;
  - the default is under the injected tmpdir and carries the uid;
  - the default has no dotted segment even when the injected home is dotted.
- **`host-tool.test.ts`:**
  - Rewrite the `projectRoot` Ghidra test (about line 3835): the project goes
    under `ghidraProjectsRoot`, the run log goes in `outputDir`, and the
    project directory is gone after the run. A fake `analyzeHeadless` is
    enough.
  - Drop the handle realpath test (about 3344).
  - Missing `ghidraProjectsRoot` is refused by name.
- **`vice-broker-supervision.test.ts`:** replace the handle-ordering structural
  tests with one test: the Ghidra sweep sits after the bind and beside the
  staging sweep.
- **`ghidra-live.test.ts`:**
  - The two tests that rebuild the run-log path from `ghidraRunsRealRoot`
    (about 304 and 1018) instead read the client's downloaded log at
    `<ws>/.c64-re-tools/runs/ghidra/<runId>.ghidra-run.log`.
  - The direct-control helper (about 1523) uses a plain `mkdtemp` project root.
  - The symlink guard test (about 2138) becomes two live checks:
    1. a literal dotted location is refused by real Ghidra;
    2. a run through a harness broker whose `VICE_BROKER_HOME` is a dotted
       directory still succeeds, because the Ghidra root is independent of the
       broker home.

## Verification

1. `npm run typecheck` is clean, and `node build.ts` leaves `resources-sync`
   green.
2. `npm test` redirected, with its exit code read: 0 failures (the current
   baseline).
3. Real Ghidra 12.1.3 at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`:
   `VICE_LIVE_GHIDRA=1 VICE_LIVE_GHIDRA_CORPUS=1` for `ghidra-live` and
   `ghidra-opcode-live`, all green.
4. The real start route: a systemd user-unit broker with **no `--repo-root`**
   and the default dotted home, then a `ghidra.analyze` through
   `runGhidraAnalyze()`.
   - The run succeeds.
   - Afterwards, `brokerGhidraDir()` and the broker staging directory hold no
     leftover run.
   - Stop the broker and check that no broker, `x64sc` or Ghidra process
     remains.
5. `git grep` finds no `ensureGhidraRunsHandle`, `ghidraRunsRoot` or
   `GHIDRA_RUNS_HANDLE` outside specs.
