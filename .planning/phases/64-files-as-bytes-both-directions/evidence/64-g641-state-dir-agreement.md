# G-64-1 secondary cause: broker and client state-directory agreement

Plan 64-10. Records the decision, the route census after the change, the
override table, the container interim limitation, and the package-closure
omission found and fixed along the way.

## The defect, as diagnosed

Quoted from the G-64-1 diagnosis (`.planning/debug/vice-proxy-control-token-handshake.md`,
Evidence 16:18 and 16:38): the real-resolver census measured **AGREE** for the
launcher route (`vice-launcher.sh`, which always passes `--repo-root`) and
**MISMATCH** for every other documented start route — `npx -y @henols/vice-mcp
broker` with no override, and the same command with `VICE_BROKER_HOME` set.

The mechanism, measured against the tree as it stood before this plan:

- With no `--repo-root`, the broker wrote `~/.c64-re-tools/supervisor/broker.json`
  (`broker-home.mts`'s `brokerStateDir()`, BROKER-06's machine-level default).
- The client (`vice-broker-client.ts`'s `brokerRootDir()`) read
  `<project>/.c64-re-tools/supervisor/broker.json` (`repo-root.ts`'s
  `supervisorDir()`, a directory inside whichever project checkout happened to
  be current) and never consulted `broker-home.mts` at all.
- The two directories are the SAME only when `--repo-root <project>` is passed
  AND `<project>` happens to be the one the client's own `.git`-ancestor walk
  (or `CLAUDE_PROJECT_DIR`) resolves to — exactly `vice-launcher.sh`'s own
  invocation shape, and no other documented route's.
- That one route's agreement came at the cost of putting broker state inside
  one project's tree, which BROKER-06 forbids outright ("a broker started from
  project A must not leave its supervisor state ... inside project A's tree").

## The decision

`--repo-root` stops selecting a state directory. The client imports
`broker-home.mts`'s `brokerStateDir()` directly (a value import; that module
carries only `node:` imports, so it loads unbuilt from this container-side
caller exactly as `stock-connect.ts`'s import of `backend-detect.mts` does).
`vice-broker.mts`'s `parseArgs()` now resolves the state directory as the
explicit `--state-dir` when given, otherwise `brokerStateDir()` — the SAME
call, on both sides, whatever `--repo-root` says.

**Why this is the only coherent option.** Keeping the `--repo-root` pin forces
the documented machine-level start route (`npx -y @henols/vice-mcp broker`,
the systemd unit, the launchd agent — none of which pass a project argument at
all) to stay broken: there is no project to pin a machine-level broker's state
to, by construction, so a "fix" that only repairs the launcher route would
leave the three routes CLAUDE.md and the README both document as canonical
still disagreeing with their own client. No machine-level route has a project
argument to give `--repo-root` in the first place.

**BROKER-06 compliance.** BROKER-06 reads: "broker-owned state never lives
inside any project's `.c64-re-tools/`". Before this plan, the ONE route that
agreed did so by violating that rule (state living under `<project>/.c64-re-tools/
supervisor/` whenever `--repo-root` was passed). This decision makes every
route agree by NEVER putting state under a project's tree — the opposite
resolution, and the only one BROKER-06 permits.

**The launcher file itself is unchanged.** `resources/vice-launcher.sh` still
execs `"$BROKER_ARTIFACT" --repo-root "$REPO_ROOT" "$@"` unchanged (its own
header's claim that it "forwards every argument, including `--repo-root`,
unchanged" stays true) — only what the BROKER does with that flag changed.
`--repo-root` keeps its other two meanings inside `vice-broker.mts`'s `run()`:
the Ghidra runs handle (`ensureGhidraRunsHandle(args.repoRoot)`, which
legitimately still writes under `<project>/.c64-re-tools/runs/ghidra/` — a
DIFFERENT concern than broker state, untouched by this plan) and the
once-per-process emulator-binary lookup (`resolvedBackend({ ..., toolsDir:
join(args.repoRoot, ".c64-re-tools"), projectRoot: args.repoRoot })`).

## The route census, after the change

| Start route | Command it runs | Path both sides now resolve | Proven by |
|---|---|---|---|
| No project argument | `npx -y @henols/vice-mcp broker` (and the systemd unit's `ExecStart=/usr/bin/env npx -y @henols/vice-mcp broker`, and the launchd plist's identical `ProgramArguments` — both run `vice-cli.mjs`'s `broker` subcommand, which calls the broker artifact's own `main(argv)` with no project argument) | `<machine-level root>/supervisor/broker.json` (`~/.c64-re-tools/supervisor/broker.json` with no override) | `vice-broker-launch.test.ts`'s "route agreement: no project argument ..." test |
| `--repo-root <project>` | `resources/vice-launcher.sh` (the one committed script that ever passes `--repo-root`) | The SAME machine-level path — no longer `<project>/.c64-re-tools/supervisor/broker.json` | `vice-broker-launch.test.ts`'s "route agreement: --repo-root <project> ..." test, which also asserts `<project>/.c64-re-tools/supervisor/` was never created |
| Either route, `VICE_BROKER_HOME` set | Same two commands, plus `VICE_BROKER_HOME=<dir>` | `<dir>/supervisor/broker.json` | `vice-broker-launch.test.ts`'s two "route agreement, VICE_BROKER_HOME variant" tests |

All four route-agreement tests spawn a REAL broker (the emitted
`resources/vice-broker.mjs` artifact, under a scratch `HOME`, never this
machine's real one) and compare the path it actually wrote `broker.json` to
against the client's own answer — `brokerJsonPath()`, computed in a FRESH
child `node` process that imports `vice-broker-client.ts` directly, under the
identical environment. `vice-broker-launch.test.ts`'s precedence test 3 (which
used to assert the now-retired project-relative default) is replaced by its
inversion: `--repo-root` alone now lands `broker.json` under the machine-level
root, and nothing is created under the project.

## Overrides

- `VICE_POOL_DIR` moves both sides: `brokerStateDir()` reads it first (before
  `VICE_SUPERVISOR_DIR`, before the machine-level default), and `parseArgs()`'s
  own call to `brokerStateDir()` inherits that same precedence — this is
  UNCHANGED from before this plan.
- `VICE_BROKER_HOME` moves both sides: it is `brokerHome()`'s own override, so
  every directory `broker-home.mts` derives (including `brokerStateDir()`'s
  machine-level default) moves with it, on both the broker and the client.
- An explicit `--state-dir` moves only the broker (`parseArgs()`'s own
  highest-precedence branch); the client follows it ONLY through
  `VICE_POOL_DIR` — a caller who sets `--state-dir` to something other than
  what `VICE_POOL_DIR`/`VICE_BROKER_HOME` would resolve to must also set
  `VICE_POOL_DIR` for the client to find it. This is documented, not silent:
  it is the same asymmetry `--state-dir` already had before this plan (it
  never had a client-side counterpart of its own), carried forward unchanged.
- One behavioural edge, newly true because `parseArgs()` now delegates its
  env-var reading to `brokerStateDir()` rather than doing it inline: an
  empty-string `VICE_POOL_DIR` is now treated as unset (`brokerStateDir()`
  uses `||`, not `??`), where the old three-step chain in `parseArgs()` used
  `??` and would have kept an empty string literally. No production caller
  sets `VICE_POOL_DIR=""` deliberately; this is recorded as a discovered
  behavioural edge, not a regression anyone depends on.

## The container interim limitation

Stated plainly: a devcontainer client resolves its OWN home directory (its own
container filesystem's `$HOME`), which is not the host broker's home. No
translation seam can reach across that gap — `hostpath.ts`/`containerpath.ts`
rewrite a bind-mounted container path to a host-reachable path, and a
host-home path lies OUTSIDE the bind-mounted workspace by construction, so
`containerPath()` throws on it rather than translating it (exactly why this is
recorded as an interim limitation, not chased as a translation bug — this
plan's own prohibitions forbid routing a host-home path through either
module).

**The interim remedy:** `VICE_BROKER_HOME` (or `VICE_POOL_DIR`) set on EACH
side to that side's own view of one location both processes can actually see
— e.g. a bind-mounted directory shared between host and container, named
identically to both. This is a per-deployment configuration step, not
something either resolver can infer.

**The permanent fix is Phase 66's RM-02** (ROADMAP.md's Phase 66, Success
Criterion 2: "`broker.json` is neither written nor read anywhere and every
reader of it is deleted"). Once there is no `broker.json` left for a client to
read, there is nothing left for a devcontainer client to fail to see.

**Before this plan, a container client could reach a broker only through the
launcher route, and only for the single project that started it** — the
launcher route was the ONE route that ever agreed, so it was also the only
route a container client's own (project-local) resolver could ever have found
a broker.json through, and even then only for the project the launcher was
invoked against. This plan does not narrow that; it is recorded here because
the container case is genuinely different afterward (an explicit override is
now required on both sides for ANY route, not just an implicit one working for
exactly one project).

## The package-closure omission Task 2 found and fixed

Measured at planning (2026-09-23) and re-measured live in Task 2, BEFORE
editing `package.json`'s `files` array: an `npm pack` + extract + import of
the packed tarball's own shipped entry points (`stock-dispatch.ts`,
`vice-broker-client.ts`) failed with `ERR_MODULE_NOT_FOUND` for
`broker-home.mts` — this plan's own new import — because `package.json`'s
`files` array omitted it, along with three modules shipped code ALREADY
imported before this plan touched anything: `broker-endpoint.ts` (imported by
`stock-connect.ts`), `transfer-hash.mts` (also imported by `stock-connect.ts`),
and `transfer-paths.ts` (imported by `stock-machine.ts`). All four are now
present in `files[]`.

The SAME check, re-run after adding those four, surfaced a SECOND, independent
closure gap: `backend-detect.mts` (already shipped) lazily `require()`s
`./tool-location.mts` as a fallback whenever it is not running from
`resources/` (`toolLocationSeam()`'s own two-candidate resolution — prefer the
compiled `./tool-location.mjs` sibling, fall back to the unbuilt
`./tool-location.mts` source) — and `tool-location.mts` was ALSO missing from
`files[]`. Because `vice-proxy.ts` calls `backendDetect.resolvedBackend(...)`
at module top level (not lazily, not behind any tool call), a real `npm
install` of the published package would crash `vice-proxy.ts` on startup with
`MODULE_NOT_FOUND` before ever reaching the MCP handshake. This is the SAME
threat class Task 2's own `T-64-G1-15` register entry names ("published
package missing imported modules", severity high) — found and closed a second
time in the same pass rather than deferred, since it directly defeats this
task's own `<done>` criterion ("a user who installs the package gets every
module the client needs"). `tool-location.mts` is now present in `files[]`
alongside the other four.

**Proof:** `npm pack` from this tree, extracted to a scratch directory, with
`node_modules` symlinked in and a scratch `CLAUDE_PROJECT_DIR`:
`stock-dispatch.ts`/`vice-broker-client.ts` import cleanly, and `node
vice-proxy.ts < /dev/null` exits 0 (clean stdin-EOF exit) printing `vice-proxy:
ready, stock backend active ...` rather than crashing.

**Recommendation, not built here:** a committed tarball-closure test (an
`npm pack` + extract + import, run in CI on every change to any shipped
module's import graph) is worth adding — this ad hoc check caught two
independent, pre-existing closure gaps in a single pass, and nothing currently
in the suite would have caught either without it.

## The convergence census

This plan adds and removes no import of `hostpath.ts`, `containerpath.ts` or
`stock-paths.ts` — the count STATE.md records (5, measured at Phase 64's close,
`.planning/phases/64-files-as-bytes-both-directions/evidence/64-convergence-metric.md`)
is unchanged by this plan's diff.
