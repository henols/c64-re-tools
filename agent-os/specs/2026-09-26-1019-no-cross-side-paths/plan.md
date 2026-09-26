# v2.0.0 step 4: remove the last two cross-side paths

## Context

All three roadmapped v2.0.0 steps are done, but the v2.0.0 goal ("the MCP server and
every skill script work the same on a bare host and inside a devcontainer, with no
path translation", `agent-os/product/roadmap.md`) is still not met. The product rule
"neither side ever names a path that the other side must open"
(`agent-os/product/tech-stack.md:94-97`) is still broken in two places. The roadmap lists both
as known defects:

1. **Epoch drift check.** The broker's `grant` reply carries `epoch_file` (a
   broker-side absolute path). The MCP side reads it from disk
   (`stock-connect.ts:564-569`, `:691-705`). In a container the file is absent, so
   `baselineEpoch` is `null` and two things go wrong:
   - every socket reconnect is refused with a **false** `MachineRestartedError`;
   - the WR-14 stopwatch and video-standard epoch guards in
     `stock-timing.ts:151,476` do nothing, because `null === null`.
2. **`vice_program_load`.** It dials the text-monitor line `load "<client repoRoot>/…/hazard-subject*.prg" <dev>`
   (`text-protocol.ts:353-363`). VICE opens that client-side path on the broker host.

Also dead: the grant's `supervisor_dir` (a broker path) is parsed by the client
(`vice-broker-client.ts:716`), but nothing reads it. The lease uses a local `brokerStateDir()` instead.

This step removes all three from production code. It also adds structural tests that
assert the paths are gone. Together this closes v2.0.0.

## Part A: epoch over the socket, not from a file

The broker already sends the live epoch integer in its `status` reply
(`vice-broker.mts:884-903`, client parse `vice-broker-client.ts:731-755`). The
lease's `brokerControl` session already has `status()`, and it survives an
emulator crash. So one source serves both the baseline and the reconnect check.
The only wire change is a removal.

- **Broker:** drop `epoch_file` and `supervisor_dir` from the grant.
  - `broker-control.mts:517` (type) and `:1195-1209` (write).
  - `vice-broker.mts:843-855` (`handleAcquire` grant object) and the `grant`
    type at `broker-control.mts:127`.
  - The broker-internal `record.epochFile` and epoch.json stay. The broker still
    uses them for respawn and reaping.
- **Client:**
  - Remove `epoch_file`/`supervisor_dir` from the grant type and parse
    (`vice-broker-client.ts:55-68, 697-719`).
  - Remove `HeldLease.epochFile` (`:509-518`).
  - Remove `epochFile` from the `useInstance`/`activeInstance` state in
    `vice-errors.ts:39-113`.
  - In `vice-proxy.ts`, drop the `epochFile` flow through `adoptGrant` (`:1004`)
    and `buildHeldLease` (`:880-905`). Rewrite the CR-06 comment.
  - Delete `readEpoch()` in `vice-errors.ts:196` if it has no other production caller.
    Check first. `broker-epoch.mts` has its own reader.
- **Stock handshake** (`stock-connect.ts`, `stock-session.ts`):
  - Replace `epochPath` + `readEpochFn` in `StockConnectDeps` with one injectable
    `readCurrentEpoch?: () => Promise<number | null>`. This follows
    `agent-os/standards/global/injectable-deps.md`.
  - `stockConnectDepsFor(lease)` (`stock-session.ts:318-325`) builds it as
    `lease.brokerControl.status()`, then picks the entry whose `port === lease.port`
    and returns its `epoch`. Any error or no entry returns `null`.
  - The handshake baseline (step 6) and `stockReconnect()` both call it. The D-3
    posture is unchanged: if either value is `null`, or they differ, the result is
    `MachineRestartedError`.
  - Add `status` to the `StockConnectBrokerControl` view only if the closure needs it.
    Otherwise keep that interface narrow.
- **Tests:**
  - Rewrite `stock-connect.test.ts:1039-1110`, `stock-session.test.ts:195-258`
    and the `stock-session-fixtures.ts` `makeLease` default onto a fake
    `readCurrentEpoch`/`status`. Cover these cases:
    - same epoch → reconnect succeeds;
    - advanced epoch → `MachineRestartedError(1,2)`;
    - `status` failing or missing the port → refused.
  - Update the grant-shape assertions in `broker-control.test.ts`,
    `vice-broker-client.test.ts`, `broker-e2e.test.ts:365-464` and
    `vice-broker-acquire.test.ts`.
  - Live suites that read `grant.epoch_file` for the emulator pid
    (`stock-broker-live.test.ts:444-456` and others found by grep) must get the pid
    from `host_state`/`status` instead.
  - Add to `path-seam-absent.test.ts`: `epoch_file`, `supervisor_dir`,
    `epochFile` and `epochPath` must be absent from the client-side production
    modules. Use the existing planted-violation proof so the check cannot pass
    vacuously. Scope it to client modules, because the broker keeps `epochFile` internally.
- **Docs:** fix the out-of-date epoch text ("before and after every forwarded call",
  "re-baselines") in `src/skills/c64-ram-capture/SKILL.md:183-204,469` and
  `src/skills/c64-program-recon/references/observation-hazards.md:116-120`.
  The code checks only on reconnect, against the baseline taken at handshake.

## Part B: `vice_program_load` writes bytes, it does not name a file

**Decision: move the tool to the binary monitor.** The handler reads the chosen
hazard-subject PRG on the client, splits off the 2-byte load address, and writes the
payload with `MemorySet`. It does not stage the file and send a text `load`.

Why:
- No path, no staging slot and no transfer are needed. The PRGs are a few hundred bytes.
- It **removes** the Phase 50 `load` widening from the text-monitor allowlist,
  the one text verb that touches a host file.
- Staging would need a broker-minted string inside a text command. That breaks
  the closed-table and "no string param kind" invariant (`text-protocol.test.ts:599`).

The trade-off is that the `device` parameter goes away. With a staged or broker
path it never meant anything except 0, and v2.0.0 is a major version.

- **Handler:** add `handleProgramLoad` to `stock-memory.ts` next to `handleMemoryWrite`
  (`:334-400`). Reuse `memSetBody()` and `resolveBank()` with the same default bank as
  `vice_memory_write`, and `convertWireError`/`stockAnswer`.
  - Validate: the file is ≥ 3 bytes and `load + len - 1 ≤ 0xFFFF`.
  - Answer `{ subject, loadAddress, endAddress, byteLength }`.
  - Keep the closed `subject` enum and `resolveSubjectId` logic. A subject id is
    still only a lookup key.
- **Registration:** in `stock-tools.ts:134`, change
  `{ kind: "pure", handler: handleProgramLoad }` to `kind: "binary"`. Update
  `tools-manifest.stock.json:4387`:
  - remove `device`;
  - rewrite the description, which also drops the out-of-date "four fixtures / rebuild resolves outside" wording;
  - set the outputSchema to the new answer.
- **Remove the text route:**
  - In `text-protocol.ts`, delete `HAZARD_SUBJECT_LOAD_SPECS`,
    `hazardSubjectLoadVerb`, `HAZARD_SUBJECT_PRG_PATH`, their merge into
    `TEXT_COMMAND_PARAM_SPECS` (`:443-463`), and the `load` paragraph of the allowlist comment.
  - Move `HAZARD_SUBJECT_PRG_RELPATHS`, `HAZARD_SUBJECT_IDS`,
    `isHazardSubjectId` and `hazardSubjectPrgPath` into a small `hazard-subjects.ts`.
    The path is now only ever opened by the client process itself.
  - Delete `handleProgramLoad` from `text-tools.ts:845-930` and remove
    `vice_program_load` from `DERIVED_TOOL_MODULES` in `path-seam-absent.test.ts:228-249`.
- **Tests:**
  - Replace the seven `text-tools.test.ts:1325-1480` tests with binary-session tests
    in `stock-memory.test.ts`. Cover these cases:
    - each subject → one `MemorySet` whose start and body equal the PRG header and payload;
    - a bad subject or a passed `filename`/`path` → refused with zero sends;
    - an unknown `device` arg → rejected by the schema.
  - Update `text-protocol.test.ts:125-235`: assert that no allowlisted or dialable
    text verb starts with `load` (a structural "the seam is absent" check), and keep
    the "table is closed, every file exists" test against `hazard-subjects.ts`.
  - Update `stock-tools.test.ts:109,1742` (it is no longer "stock-only pure").
- **Equivalence gate (live, before deleting the text route).**
  - On the bare host with `/usr/bin/x64sc`, load `original` through the current
    text `load` and capture 64K RAM. Reset, write it with `MemorySet`, capture
    again, and diff. Use a throwaway scratchpad script against the broker running as a systemd unit.
  - If the text `load` touched bytes outside the payload (for example the BASIC
    pointers `$2D/$2E` or `$AE/$AF`), the new handler must reproduce exactly those
    writes, and the plan records it.
  - Then add one opt-in live assertion: after `vice_program_load`, the RAM over
    `[load, end]` equals the PRG payload.

## Order

1. Write spec `agent-os/specs/2026-09-26-<hhmm>-no-cross-side-paths/` (shape.md +
   plan.md, same format as the step-3 spec) and add the step to the roadmap as In Progress.
2. Part B's live equivalence measurement, which needs the old route still present.
3. Part B implementation.
4. Part A implementation. Run `node build.ts` after editing any `.mts`
   compiled into `resources/` (`agent-os/standards/broker/host-bound-modules.md`).
5. Roadmap:
   - remove both known defects;
   - move v2.0.0 to Implemented (if nothing else in the goal is open);
   - record the implementation decisions in shape.md;
   - commit per part.

## Verification

- `npm test` (full glob). Redirect to a file and read `$?` on the same line. Do not
  pipe. Compare the failing **set** against the baseline taken before starting.
- `grep`-level spot check: no `epoch_file`, `supervisor_dir` or `load "` in
  client production code. Use a `readFileSync` scan for the files with NUL bytes.
- Opt-in live suites, each alone under a timeout, against the absolute
  `/usr/bin/x64sc`: `stock-broker-live`, `stock-live`, `text-monitor-live`,
  `stock-live-relay`.
  - Include a forced reconnect: kill the emulator, let the broker respawn it, and
    check that the next call returns `MachineRestartedError` naming epochs 1→2.
  - Also check that a plain socket drop with no respawn reconnects cleanly. This
    is the case that falsely failed before.
- Stop the broker unit when done.
