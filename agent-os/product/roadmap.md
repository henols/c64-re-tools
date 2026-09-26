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
- Nothing the broker started outlives it. Every emulator and host tool runs in
  its own process group and is tracked; a stop (Ctrl-C, SIGTERM, SIGHUP, a
  crash) first stops taking work and blocks respawns, then stops every group,
  descendants included. A SIGKILL of the broker is covered by a watchdog it
  forks at startup, which stops every tracked group when the broker is gone.
- Reproducible runs: a hard reset plus pinned launch settings makes two runs of
  the same program stop in the same frame. A flat 64K RAM capture is sliced from
  a `.vsf` snapshot, with no hex transcription. Runs stay frame-exact through
  anchor hit 50; exactness is lost from anchor hit 75.

**Annotation store**
- Each project keeps its annotations in ONE SQLite file (`node:sqlite`, schema
  version 6), `<project>/.c64-re-tools/annotations.db`, committed with the
  project. It holds labels, comments, a 12-member per-range type vocabulary,
  scopes, project enums and cross-references, with search. Durability is proven
  across a real `SIGKILL`.
- The client opens the file per call; the broker never loads the store, and a
  structural test with a planted proof keeps it that way. The first write
  creates the file and its one project; a read without it is refused. Specs:
  `agent-os/specs/2026-09-26-2233-broker-owned-store/` (the call surface) and
  `2026-09-27-0124-project-owned-store/` (where the store lives).
- A runtime evidence layer stores what the emulator was observed executing,
  keyed by run. It is joined with the byte-derived block table, and disagreements
  are reported first.
- Enums are generated from `memmap.json`, so register writes render with bit
  names.
- The store is reached through the `vice-mcp anno` CLI (`anno call <name> --args
  JSON` and six report verbs), which hands the engine staged input bytes, never
  a path. It is no longer on the MCP tool surface. No call takes a store path.
- `anno export-project` and `anno import-project` give the binary file a
  diffable text form, in the fixtures' format. Import fills an empty project
  only, in one transaction.

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
- Skills install with the `skills` CLI (`npx skills add henols/c64-re-tools
  --skill '*'`) straight from the root `skills/` folder; our own npm installer
  is retired. A skill installed without `c64-ram-capture` refuses by name and
  gives the install command. Skill-script tests live in `test/skills/` and
  derived evidence in `evidence/`, so neither ships.
- The MCP server comes from the Claude Code plugin, or from
  `npm i -g @henols/vice-mcp`: its `prepack` compiles the server graph into
  `dist/`, so `vice-mcp`, `vice-mcp anno` and `vice-mcp broker` run from
  `node_modules` (`smoke-packed.ts` proves it in CI). Other agents wire it with
  `npx add-mcp vice-mcp`. The broker is started by hand. No shipped remedy
  text uses `npx -y`. CI publishes `@henols/vice-mcp` through OIDC from `v*`
  tags. Spec: `agent-os/specs/2026-09-26-2049-skills-cli-install/`.
- TypeScript only. No hand-written JavaScript remains: skill scripts are
  plain `.ts` (each skill's `scripts/` has a `{"type":"module"}`
  `package.json`), repo-only tools and fixture generators are `.ts`, and the
  package bin `vice-cli` is an `.mts` source that `build.ts` compiles beside
  itself (`ENTRY_ARTIFACTS`).
  `no-handwritten-mjs.test.ts` fails on any other `.mjs`/`.js`. Spec:
  `agent-os/specs/2026-09-26-1946-mjs-to-ts-no-auto-install/`.

**One broker, one socket (v2.0.0)**
- Clients find the broker at fixed TCP port 19510 and dial `127.0.0.1`, then
  `host.docker.internal`. A handshake checks the identity and version of what
  answered. When no broker answers, the client refuses and gives the command that
  starts one.
- The broker binds to loopback and to the container bridge gateways it
  enumerates at startup. It never binds `0.0.0.0` and uses no token. Its state is
  at `~/.c64-re-tools` (override with `VICE_BROKER_HOME`). The user starts it by
  hand; no service definition ships with it.
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
  reply for the instance the grant owns. `vice_program_load` takes a path,
  streams the file to the broker and loads the staged copy with VICE's own
  text-monitor `load`, the one `load` shape the text monitor accepts. Rule: `agent-os/standards/global/files-travel-as-bytes.md`.
- Ghidra projects live on a broker-side root with no dot-prefixed segment.
- The old host/container seam is gone from production code: `hostpath.ts`,
  `containerpath.ts`, `stock-paths.ts`, `broker.json` and the Ghidra symlink
  alias are deleted, and structural tests with planted-violation proofs
  assert they stay gone. Specs: `agent-os/specs/2026-09-25-1853-one-endpoint-client/`,
  `2026-09-25-2240-deletion-cutover/`, `2026-09-26-0022-ghidra-without-alias/`
  and `2026-09-26-1019-no-cross-side-paths/`.

## Planned / Later

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
- Cycle-exact equivalence past anchor hit 75 is still open. CPU history through
  the text monitor now provides an instrument for it.

**Cleanup**
- Remove byte-identical assertions from the tests. The owner has decided this;
  its requirements are not written yet.
- Optionally, move the server's colocated tests into a dedicated test folder
  (the skill-script tests already live in `test/skills/`).

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
