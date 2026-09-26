# Product Roadmap

## Implemented

**Emulator driving and resilience**
- A `vice_*` MCP tool surface over VICE's binary monitor. It covers memory
  read/write/search/compare, registers, checkpoints and watchpoints, stepping,
  run-until, snapshots, autostart, disk attach, joystick and keyboard input,
  VIC-II/CIA/sprite decoding, symbols and disassembly.
- A second channel, the text monitor (`-remotemonitor`), runs beside the binary
  monitor. Both channels share one FIFO lock. Five text-monitor outputs are parsed
  into structured data: `memmapshow`, `chis`, `bt`, `prof flat` and `io`.
- Crash handling: the broker supervises and respawns crashed emulators, and an
  incident record is written before any kill. When the channels are contended,
  the tool reports the contention by name instead of treating it as a wedge.
  A stuck emulator is recovered by restarting the broker (a human action).
- Reproducible runs: a hard reset plus pinned launch settings makes two runs of
  the same program stop in the same frame. A flat 64K RAM capture is sliced from
  a `.vsf` snapshot, with no hex transcription. Runs stay frame-exact through
  anchor hit 50; exactness is lost from anchor hit 75.

**Annotation store**
- `.annostore` (`node:sqlite`, schema version 5) holds labels, comments, a
  12-member per-range type vocabulary, scopes, project enums, cross-references,
  search and revert. Durability is proven across a real `SIGKILL`.
- A runtime evidence layer stores what the emulator was observed executing,
  keyed by run. It is joined with the byte-derived block table, and disagreements
  are reported first.
- Enums are generated from `memmap.json`, so register writes render with bit
  names.
- The store is reached through the `vice-mcp anno` CLI (`anno call <name> --args
  JSON`). It is no longer on the MCP tool surface.

**Static analysis**
- dxa 0.1.5 (vendored source) produces a machine-readable code/data map.
- Ghidra 12.1.3 runs headless with this project's NMOS 6502 SLEIGH language,
  which decodes all 105 undocumented opcode bytes.
- Automatic annotation into the store: the narrowest range wins, `$01` bank
  state is resolved before the address, and the tool declines where bank state
  depends on the execution path.
- The host tools (ACME, dxa, Ghidra, `c1541`, `petcat`) are reached only through
  the broker's fixed endpoint: inputs upload as bytes, results download by
  handle, and no request names a broker-side path.

**Rebuild**
- The store exports as a directory of ACME source: one file per scope, joined
  with `!source`, and data tables as `.bin` files. Every reference resolves
  through a symbol, or the export refuses. The output reassembles to the same
  bytes under ACME 0.97.
- The export is lossless by construction. A four-class movement-hazard report
  lists what blocks relocation. A reassembly gate returns `red`, `acknowledged` or
  `clean`.
- An equivalence check compares the original and the rebuild in VICE, and a
  person can edit the exported source and see the changed behaviour.

**Setup and distribution**
- All eight prerequisites are declared in one file, `prerequisites.json`: x64sc,
  c1541, petcat, acme, acme-lib, ghidra, dxa and node. One resolver finds each
  tool, in this order: environment variable, then `.c64-re-tools/tools.json`, then
  `$PATH` or a sibling of `x64sc`. Every refusal quotes the remedy from that file,
  and the README install tables are generated from it.
- The project installs through npm/npx or as a Claude Code plugin. CI publishes
  both packages through OIDC from `v*` tags.

**One broker, one socket (v2.0.0)**
- Clients find the broker at fixed TCP port 19510 and dial `127.0.0.1`, then
  `host.docker.internal`. A handshake checks the identity and version of what
  answered. When no broker answers, the client refuses and gives the command that
  starts one.
- The broker binds to loopback and to the container bridge gateways it
  enumerates at startup. It never binds `0.0.0.0` and uses no token. Its state is
  at `~/.c64-re-tools` (override with `VICE_BROKER_HOME`). Service files for
  systemd and launchd ship with it and are never applied automatically.
- The connection is the session. The MCP server's long-lived connection holds
  its emulator instance. The broker reclaims the instance when the socket drops,
  including after a `SIGKILL` or a silent peer death, and writes an incident
  record first.
- Files travel as bytes. `vice_autostart`, `vice_disk_attach`,
  `vice_snapshot_save` and `vice_snapshot_load` work with no shared filesystem.
  Transfers are integrity-checked and size-capped, path traversal is refused, and
  staged files are swept.
- The input paths of every host tool bind by a handle that the broker creates.
- No request or reply names a path the other side must open. The grant carries
  coordinates only; the reconnect epoch is read from the broker's `status`
  reply for the instance the grant owns. `vice_program_load` writes the PRG
  bytes through the binary monitor, and the text monitor has no `load` verb.
- Ghidra projects live on a broker-side root with no dot-prefixed segment.
- The old host/container seam is gone from production code: `hostpath.ts`,
  `containerpath.ts`, `stock-paths.ts`, `broker.json` and the Ghidra symlink
  alias are deleted, and structural tests with planted-violation proofs
  assert they stay gone. Specs: `agent-os/specs/2026-09-25-1853-one-endpoint-client/`,
  `2026-09-25-2240-deletion-cutover/`, `2026-09-26-0022-ghidra-without-alias/`
  and `2026-09-26-1019-no-cross-side-paths/`.

## Planned / Later

**Annotation store**
- Move to one broker-owned annotation database per machine. Rows are scoped by a
  persisted, script-created `project_id`, and no call can read or write another
  project's data. See `agent-os/standards/anno/store-ownership.md`.

**Operator surface**
- Check Podman ≥ 5's `pasta` default and its effect on `host.containers.internal`
  against a primary release note.

**Known defects and gaps**
- The text-monitor command timeout does nothing. `TextMonitorClient.command()`
  ignores `timeoutMs`, so a VICE that does not respond can hang while it holds
  the channel lock.
- A relay attach to a cold-launched instance races the emulator's startup. The
  first call after a cold start usually fails, and the release policy then kills
  the process while it is still booting.
- The symbol round trip (store ⇄ VICE label files) was lost when the earlier
  external analyser was removed, and nothing replaces it yet.
- The bank-boundary annotation claim is proven only on a synthetic fixture, not
  yet on real cracked code.
- v2.0.0's container case is proven by tests that give the client and the
  broker disjoint roots, and by the structural seam tests. It has not been run
  inside a real devcontainer, because this repository has none.
- Cycle-exact equivalence past anchor hit 75 is still open. CPU history through
  the text monitor now provides an instrument for it.

**Cleanup**
- Convert the remaining hand-written JavaScript (`.mjs`) to TypeScript: the
  installer, the skill scripts under `src/skills/*/scripts/`, and the `.mjs`
  entry files in `src/mcp/vice/`. Skill scripts become plain `.ts` on Node ≥ 24.
  The installer CLI, and anything loaded from `node_modules`, go through the
  `build.ts` compile step.
- Enforce never-auto-install. The installer still writes an `npx -y` line into a
  consumer's `.mcp.json` and still has the `--vendor` npm-install route.
- Remove byte-identical assertions from the tests. The owner has decided this;
  its requirements are not written yet.
- Optionally, move the colocated tests into a dedicated test folder.

## Explicitly Out of Scope

- A second emulator backend, or any VICE variant other than a package-manager
  `x64sc`.
- TLS, auth tokens or credentials on the broker socket, and reaching the broker
  from another machine.
- Session resumption after a drop, resumable or chunked transfers, and any RPC
  framework.
- A client that starts the broker automatically, or a tool that installs
  prerequisites automatically.
- A pre-flight "doctor" or check command. Missing tools are reported where they
  are used, by the refusal.
- VICE's text-monitor assembler/disassembler (`a`/`d`) and switching between
  `x64` and `x64sc`.
- Recovering SID read-back, matrix keyboard or RESTORE/NMI.
