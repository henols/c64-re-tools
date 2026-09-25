# v2.0.0 step 2: deletion cutover

## Context

Step 1 moved every host-tool caller onto the fixed endpoint. Step 2 removes the old host/container seam from production code, so the old path is **gone, not merely bypassed** (the roadmap's own bar).

What still exists:
- **Path translation, mostly dead:**
  - `stock-paths.ts` has no production caller.
  - `host-tool-client.ts`, together with the legacy token-gated `host_tool` op and the `host-tool.mjs` CLI, has no production caller.
  - `containerizeGrant()` in `vice-proxy.ts` runs on every lease but changes nothing.
  - `hostpath.ts` and `containerpath.ts` exist only to serve those, plus `install-resources.ts`'s launch hint and `vice-proxy.ts`'s broker-absent messages.
- **`broker.json`, still live:** `vice-proxy.ts`'s `ensureBrokerLease()` reads it for the control port and token on every acquire, via `openBrokerControl()`/`readBrokerLiveness()`. No fixed-endpoint acquire exists yet, and `broker.json` is the only channel that hands out the token.

Decisions made in shaping:
- **One spec**, with ordered tasks, and each task lands with the suite green.
- **Token gate removed along with `broker.json`.** Protection rests on the loopback/bridge-only bind, per-grant `ownsTarget()`, and handle checks, as `tech-stack.md` already documents.
- **Out of scope, recorded as roadmap follow-ups:**
  - the epoch drift check reading `epoch_file` across the container boundary;
  - `vice_program_load` sending a client-side path.
- **Kept:**
  - `CONTAINER_WORKSPACE_PATH` in `repo-root.ts` and `container-guard.mts` (root finding and the broker's refuse-in-container guard);
  - `containerGuardEnforce`/`Report`;
  - `runHostTool()`.
- **Not touched:** `.planning/` (gone). Tests that only fail because of pre-existing issues are left as they are.

Baseline: the full suite fails only WR-20 (pre-existing).

## Task 1: Save spec documentation

Create `agent-os/specs/2026-09-25-2240-deletion-cutover/` containing:
- `plan.md` — this plan.
- `shape.md` — scope, decisions, context.
- `standards.md` — the text of `broker/host-bound-modules`, `global/injectable-deps`, `global/module-header`, `global/atomic-state-files` and `skills/cross-package-reach`.
- `references.md`, pointing to:
  - `dialHostToolSession()` (`broker-endpoint.mts`), the pattern for the new control session;
  - `createSession()` (`vice-broker-client.ts`), the framing to reuse;
  - `describeDialFailure()` and `BROKER_START_COMMAND`, which replace the three broker-absent messages;
  - `startHarnessBroker` (`broker-harness.ts`);
  - `hostpath-consumers.test.ts`, whose detector and planted-violation tests get reused.

Also mark step 1 as done in `agent-os/product/roadmap.md`, and fix the stale "one typed `host_tool` operation" line there.

## Task 2: Delete the dead path pieces

- **`stock-paths.ts` and `stock-paths.test.ts`:** delete both. `stock-broker-live.test.ts` imports `snapshotPathFor`/`snapshotMetaPathFor` from `transfer-paths.ts` instead.
- **`host-tool-client.ts`:** delete it and remove it from `files[]`.
  - Remove its test cases from `host-tool.test.ts` and `host-tool-transport.test.ts`. The cross-seam deadline check at around `host-tool.test.ts:3586` points at the endpoint copy instead.
  - Update `mcp-module.test.mjs`'s example file and `agent-os/standards/skills/cross-package-reach.md`.
- **Legacy `host_tool` op (`broker-control.mts`):** remove the kind member, `onHostTool`, `writeHostToolLine()` and the dispatch arm. Remove the `onHostTool` wiring in `vice-broker.mts`, but keep `args.repoRoot`, which `handleHostToolRun` still uses as `projectRoot`. Drop the `onHostTool:` stubs from the listener test fixtures.
- **`host-tool.mts` CLI entry:** remove `parseCliArgs`, `IS_ENTRY_POINT` and `HOST_TOOL_TEST_FORCE_CLI_REJECT`, plus its test at around `host-tool.test.ts:3795`. Reword `fixtures/ghidra/README.md`'s capture-command note.
- **`containerizeGrant()`/`isInsideWorkspace()` (`vice-proxy.ts`):** delete them and adopt the grant as received, keeping the port and URL-port checks. Delete or rewrite the containerize tests in `vice-proxy.test.ts`.
- **`install-resources.ts` `hostLaunchInstructions()`:** print `BROKER_START_COMMAND` instead of a `hostPath()` translation. Update `install-resources.test.ts`.
- **`containerpath.ts` + test, then `hostpath.ts`:** delete them and remove them from `files[]`. Fix `load-order.test.ts`'s `resolveModuleByStem("hostpath")` and its sample strings.
- **`vice-proxy.ts`'s `brokerHostPath()`:** for now the broker-absent messages quote `BROKER_START_COMMAND` instead. Task 4 replaces those messages entirely.

## Task 3: Endpoint control session

In `broker-endpoint.mts`, add `dialControlSession(options)`.
- It runs the same hello race as `dialHostToolSession()`, under tag `"control"`, and keeps the winning socket.
- It returns a `BrokerControlSession` whose request lines carry no token.
- The newline/FIFO framing moves out of `vice-broker-client.ts`'s `createSession()`, so `broker-endpoint.mts` still never imports `vice-broker-client.ts`. Either the session type and factory move into `broker-endpoint.mts`, or `vice-broker-client.ts` wraps the new dialer; the second direction is allowed.
- `BrokerControlSession` and `HeldLease` keep their shape, so `stock-session.ts`, `stock-connect.ts`, `text-connect.ts` and `text-tools.ts` don't change.

In `vice-proxy.ts`, `ensureBrokerLease()` uses `dialControlSession()` instead of `readBrokerLiveness()` + `openBrokerControl()`. A dial failure becomes `describeDialFailure()` text, which names `BROKER_START_COMMAND`.
- The three messages — never started, dead or hung (with pid), control unreachable — are deleted, along with `brokerHostPath()`.
- `brokerRootDir()`'s two non-`broker.json` uses (`HeldLease.supervisorDir` and the fallback directory) read `brokerStateDir()` from `broker-home.mts` directly.
- At this point `broker.json` still exists, but the proxy doesn't read it. Tests: a unit test of `dialControlSession()` against a stub listener, plus `vice-proxy.test.ts`'s `startControlBroker`/`g6408StartFixture` fixtures moved to `VICE_BROKER_CONTROL_PORT`.

## Task 4: Remove broker.json and the token gate (they land together)

- **`broker-control.mts`:**
  - Remove `tokensMatch()`, the `token` option, `newControlToken()` and the `unauthorized` code (if nothing else emits it).
  - Rewrite the header's auth paragraph.
  - Every op is then served post-hello with no token.
- **`vice-broker.mts`:**
  - Stop writing `broker.json`: delete `BrokerRecord`, `WRITTEN_BY`, `writeBrokerRecordFile()`, the heartbeat interval and the token.
  - Replace the EADDRINUSE liveness check (`classifyBrokerLivenessLocal`/`readBrokerRecordMaybe`) with a `dialBrokerEndpoint({ port, candidates: ["127.0.0.1"] })` hello probe. Keep the two exit messages distinct.
  - Rewrite the staging-sweep ordering comment.
  - Keep the `state directory:` stderr line.
- **`vice-broker-client.ts`:**
  - Delete `brokerJsonPath`, `readJsonMaybe`, the liveness code, `resolveControlTarget`, `classifyConnectHost` and the wildcard/loopback helpers, `acquireOverControlPlane`, `openBrokerControl`, and the `never_started`/`stale`/`unreachable_control_plane`/`unauthorized` failure kinds.
  - Keep the request-id helpers, `resolveSessionLabel`, the types and `MonitorOwnershipError`.
- **`vice-errors.ts`:** delete `mcpHost()` and `isInsideContainer()`'s last seam uses. `container-guard.mts` keeps its enforce/report.
- **`vice-broker-client.test.ts`, `broker-control.test.ts`, `broker-e2e.test.ts`, `broker-kill.test.ts` and `vice-broker-launch.test.ts`:**
  - Delete the `broker.json`/token/liveness tests.
  - Move readiness waits to the hello probe.
  - Move `vice-broker-launch.test.ts`'s state-dir observable to the `state directory:` stderr line.
  - Drop the `token:` options.
- Delete `fixtures/bash-broker.json` and its tests, plus its `fixtures/README.md` row.
- The opt-in live suites (`stock-broker-live`, `text-monitor-live`, `stock-a4-checkpoint-flood`, `stock-live-relay`) must still compile against the new session.

## Task 5: Assert the seam is absent; clean up the leftovers

- **Rewrite `hostpath-consumers.test.ts` as `path-seam-absent.test.ts`:**
  - (a) The deleted files are absent from `src/mcp/vice/` and `resources/`.
  - (b) No production `.ts`/`.mts`, `resources/*.mjs` or skill `.mjs` imports any deleted stem.
  - (c) No comment-stripped production source contains `hostPath`, `hostPathCandidates`, `tryHostPaths`, `containerPath`, `containerizeRecord`, `containerizeGrant`, `withEmulatorSidePath`, `SET_ENV_HINT`, `mcpHost`, `openBrokerControl`, `broker.json`, `control_token`, `op: "host_tool"` or a `HOST_WORKSPACE_PATH` read.
  - (d) `files[]`, `tsconfig.build.json` and `HOST_BOUND_ARTIFACTS` name none of the deleted files.
  - (e) A pinned minimum count of scanned files, checked against the measured count.
  - Each of (b) and (c) keeps a planted-violation proof, so the test cannot pass vacuously.
  - Keep `DERIVED_TOOL_MODULES` as the non-empty derived-tool proof.
- **Stale `0.0.0.0` guidance:**
  - Delete the unreachable fork fallback at `broker-launch.mts:396` and the stale widen-the-bind warning text (around lines 386-388).
  - Fix `vice-broker-client.test.ts:176`'s claim.
  - Keep the real refusals (`vice-broker.mts:368`, `broker-control.mts:1887`) and the rule text in `agent-os/product`.
- **Dead guard comments:** remove the "never import hostpath.ts / containerPath" guards in about 40 production and test headers, and the `WORKSPACE_ENV`/`HOST_WORKSPACE_PATH` test setup in `stock-tools.test.ts` and `vice-proxy.test.ts`.
- **Docs:**
  - Fix the stale README sections: `src/mcp/vice/README.md:90-99` and `README.md:278-285`.
  - Add the two follow-up gaps to `agent-os/product/roadmap.md`.
  - Update `tech-stack.md` if its broker bullets mention `broker.json`.
- Run `node build.ts` and commit `resources/`.

## Verification

1. `npm run typecheck` is clean, and `node build.ts` leaves `resources-sync.test.ts` green.
2. `npm test`, redirected, with the exit code read: the failing set equals the baseline (WR-20 only). Run `ls` on every renamed or new test file first.
3. `node --test path-seam-absent.test.ts`: its planted-violation cases fire, and the real-tree cases pass.
4. Live checks:
   - Proxy lease through the new control session against a harness broker: `vice-proxy-ping.test.ts` and `vice-proxy.test.ts` (manual-only).
   - Real broker as a systemd user unit: `npm run smoke`, then a `vice_ping` through the MCP server against `/usr/bin/x64sc`. Stop the broker afterwards and check that no `vice-broker`/`x64sc` process is left.
   - Skip the known-broken opt-in VICE live suites.
5. `git grep` for the deleted identifiers outside tests and specs returns nothing. `npm pack --dry-run` lists none of the deleted files.
