# Working plan

The step-by-step plan for building c64-re-tools from the frozen design in
[`redesign/`](redesign/README.md). Milestones follow
[`19-implementation-plan.md`](redesign/19-implementation-plan.md); this file
turns them into small steps with a status each.

Rules:

- One step is pushed straight to `main`, no PR. It ends with `pnpm typecheck && pnpm build && pnpm test` green.
- Only the current milestone is expanded into steps. Expand the next one when you start it.
- Everything is built new. Nothing from the deleted implementation is ported.
- Open design points are decided once, in [Decisions](#decisions). Change a decision here first, then the code.

Status: `[ ]` todo · `[~]` in progress · `[x]` done

## Step 0 — Remove the old implementation

- [x] 0.1 Delete the old tree: `src/mcp/vice`, `test/vice`, `test/skills`, `skills/`, `evidence/`, old docs, and `redesign/10-current-code-reuse.md`.
- [x] 0.2 Commit the deletion together with the rewritten `.gitignore`, `.graphifyignore`, `README.md`, `CLAUDE.md`.
- [x] 0.3 Remove design text that tells the rewrite to reuse old code: the README row and greenfield wording, 19 §15 (later sections renumbered) and the porting bullet in 19 §14, 04 §9, 05 §5–6, 09 §2, 12 §3, 16 §16.
- [x] 0.4 The local `legacy-final` tag is gone; land the cleanup on `main`.

Done when no tracked file mentions `src/mcp/vice` or the legacy code.

## M0 — Finish the scaffold

Acceptance (19 §2): from a clean clone, `pnpm install --frozen-lockfile && pnpm build && pnpm test` passes and `--help` works on `c64-re-tools`, `c64-re-tools-mcp` and `c64-re-tools-host`.

- [x] M0.1 **pnpm and lockfile.** Add `packageManager`, commit `pnpm-lock.yaml`, CI installs with `--frozen-lockfile`. (pnpm must be installed on the host by hand.)
- [x] M0.2 **Test layout (18 §14).** Unit tests beside source as `src/**/*.test.ts` on `node:test`, run through Node type stripping. `tsconfig.json` globs `src/` for typecheck; `tsconfig.build.json` excludes tests. Move the scaffold tests into `src/`, put the bin `--help` smoke in `test/e2e/bins.test.ts`, delete `test/scaffold/`.
- [ ] M0.3 **Boundary test (18 §15).** `src/boundaries.test.ts` scans imports and fails on a forbidden direction (host ↛ mcp/knowledge, mcp ↛ host/knowledge, knowledge ↛ host/mcp/host-client, skill ↛ skill).

## M1 — First real VICE slice

Path: MCP → host-client → Host Runtime → VICE → binary monitor → C64 state.
Tools: `c64_status`, `c64_memory_read`, `c64_registers` (`get`).

- [ ] M1.1 **Private protocol v1** — `src/protocol.ts`: frames, handshake, request/reply/error types, validation (D1–D4).
- [ ] M1.2 **Host listener** — `src/host/server.ts`, `src/host/main.ts`: foreground `c64-re-tools-host`, bind (D5), handshake, one session per connection, dispatch. Socket tests: handshake, version mismatch refused, malformed frame closes the connection.
- [ ] M1.3 **Process supervisor** — `src/host/processes.ts`: argv-array spawn in its own process group, child tracking, SIGTERM then SIGKILL after 5 s, stop all on exit/SIGINT/SIGTERM. Test: a forking stub leaves no descendant.
- [ ] M1.4 **VICE process** — `src/host/vice/process.ts`: find `x64sc` (D8), free monitor port, scratch config dir outside the project, readiness by monitor connect + ping with a timeout, termination. Live test.
- [ ] M1.5 **Binary-monitor client** — `src/host/vice/binary-monitor.ts`, from the VICE manual: framing, request-id correlation, unsolicited events, zero-length bodies; ping, memory get, registers available/get, exit. Byte-frame unit tests + live test.
- [ ] M1.6 **VICE session** — `src/host/vice/session.ts`, `adapter.ts`: serialized queue, run state from events, pause-then-restore for reads (15 §4), status fields, crash → `machine-state-lost` (D11), connection close kills VICE.
- [ ] M1.7 **Host client** — `src/host-client/connect.ts`, `vice-session.ts`: endpoint list (D5), handshake, typed `status` / `memoryRead` / `registersGet`, 15 §5 error codes. Contract tests against a real host with a stub VICE adapter.
- [ ] M1.8 **MCP server** — `src/mcp/main.ts`, `server.ts`, `tools/machine.ts`, `tools/memory.ts` (D9): session opened at MCP start, schemas exactly as 15 §7, §14, §18, errors as `isError` with `{code, message}`, no IDs/ports/paths/versions/VICE vocabulary in results.
- [ ] M1.9 **Acceptance** — `test/integration/vice/`, real VICE, opt-in with `C64RT_LIVE_VICE=/usr/bin/x64sc`:
  1. host → MCP → one VICE; read KERNAL bytes at `$e000` and the registers; status reports stopped/running correctly;
  2. terminating MCP makes its VICE exit;
  3. two MCP processes get two sessions and two VICE processes.

  Skipped live suites are reported as skipped, never as passed (09 §6).

## Later milestones

Expand each into steps when it starts.

- [ ] **M2** Live-machine foundation: reset, pause/resume/step/next, memory write, register set, program load, autostart, disk attach, keyboard, joystick, warp, screen capture; then advance-frames, run-until, typed conditions, breakpoints, watchpoints. The c64-emulator skill.
- [ ] **M3** The rest of the frozen MCP surface (15 §37), the text monitor when first needed, drive8, `until-return`, screen baselines, snapshots, `c64_observe`.
- [ ] **M4** Knowledge core: `src/knowledge`, `.c64-re-tools/knowledge.db`, the c64-knowledge script.
- [ ] **M5** Native-tool seam + ACME + c64-assembler: assemble → load → known state in VICE.
- [ ] **M6** c1541 + petcat: the c64-disk and c64-basic skills.
- [ ] **M7** DXA + normalized-findings importer: the c64-static-analysis skill.
- [ ] **M8** Ghidra + NMOS SLEIGH language (all 105 undocumented opcodes) on the same importer.
- [ ] **M9** c64-testing: functional equivalence, PASS/FAIL/INCONCLUSIVE.
- [ ] **M10** c64-memory-map, c64-unpacker, c64-provenance, c64-reverse-engineering.
- [ ] **M11** Installation and distribution, tested from installed artifacts.
- [ ] **M12** Hardening and release, including the orphan guard (D7), container binding (D5/D6), platform coverage and release CI.

## Decisions

Points the design leaves open, decided for M1. Revisit a row before changing the behavior it describes.

| # | Point | Decision |
|---|---|---|
| D1 | Framing | Each frame: 4-byte big-endian length, then UTF-8 JSON. Max frame 1 MiB. Binary attachments (M5) travel as raw length-prefixed frames announced by a JSON header. |
| D2 | Handshake | Client sends `hello {protocol: "c64-re-tools-host", version: 1, role: "vice-session" \| "tool"}`. Host replies `ready` once VICE is up, or an `installation-incomplete` error on mismatch. The connection is the session; no open/close messages. |
| D3 | Correlation | Each request carries a client-chosen id. The host replies in completion order and serializes VICE work per session. A disconnect drops queued work. |
| D4 | Wire errors | `{code, message}` using the 15 §5 codes, chosen by the host. host-client passes them through; MCP returns them as `isError` results. |
| D5 | Endpoint | TCP port 6464, bound to `127.0.0.1`. Client tries `127.0.0.1`, `host.docker.internal`, `host.containers.internal`; `C64RT_HOST=host:port` overrides. Container-bridge binding comes in M12. |
| D6 | Auth | None while bound to loopback. Decide together with bridge binding in M12. |
| D7 | Orphans | Process groups cover normal exit and signals. A watchdog for a killed (SIGKILL) host comes in M12. |
| D8 | Finding VICE | `C64RT_VICE`, else `x64sc` on `PATH`. If missing, refuse by name with the install remedy. Never auto-install. |
| D9 | MCP SDK | `@modelcontextprotocol/sdk`, stdio transport, plus its schema library. No other runtime dependency in M1. |
| D10 | Video standard | PAL by default; `C64RT_VIDEO=ntsc` at MCP start. Fixed for the session. |
| D11 | VICE crash | Fail the operation with `machine-state-lost`. No automatic restart in M1. |
