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
- [x] M0.3 **Boundary test (18 §15).** `src/boundaries.test.ts` scans imports and fails on a forbidden direction (host ↛ mcp/knowledge, mcp ↛ host/knowledge, knowledge ↛ host/mcp/host-client, skill ↛ skill).

## M1 — First real VICE slice

Path: MCP → host-client → Host Runtime → VICE → binary monitor → C64 state.
Tools: `c64_status`, `c64_memory_read`, `c64_registers` (`get`).

- [x] M1.1 **Private protocol v1** — `src/protocol.ts`: frames, handshake, request/reply/error types, validation (D1–D4).
- [x] M1.2 **Host listener** — `src/host/server.ts`, `src/host/main.ts`: foreground `c64-re-tools-host`, bind (D5), handshake, one session per connection, dispatch. Socket tests: handshake, version mismatch refused, malformed frame closes the connection.
- [x] M1.3 **Process supervisor** — `src/host/processes.ts`: argv-array spawn in its own process group, child tracking, SIGTERM then SIGKILL after 5 s, stop all on exit/SIGINT/SIGTERM. Test: a forking stub leaves no descendant.
- [x] M1.4 **VICE process** — `src/host/vice/process.ts`: find `x64sc` (D8), free monitor port, scratch config dir outside the project, readiness by monitor connect + ping with a timeout, termination. Live test.
- [x] M1.5 **Binary-monitor client** — `src/host/vice/binary-monitor.ts`, from the VICE manual: framing, request-id correlation, unsolicited events, zero-length bodies; ping, memory get, registers available/get, exit. Byte-frame unit tests + live test. (Built before M1.4: VICE readiness needs the ping; the live test lands with M1.4.)
- [x] M1.6 **VICE session** — `src/host/vice/session.ts`, `adapter.ts`: serialized queue, run state from events, pause-then-restore for reads (15 §4), status fields, crash → `machine-state-lost` (D11), connection close kills VICE.
- [x] M1.7 **Host client** — `src/host-client/connect.ts`, `vice-session.ts`: endpoint list (D5), handshake, typed `status` / `memoryRead` / `registersGet`, 15 §5 error codes. Contract tests against a real host with a stub VICE adapter.
- [x] M1.8 **MCP server** — `src/mcp/main.ts`, `server.ts`, `tools/machine.ts`, `tools/memory.ts` (D9): session opened at MCP start, schemas exactly as 15 §7, §14, §18, errors as `isError` with `{code, message}`, no IDs/ports/paths/versions/VICE vocabulary in results.
- [x] M1.9 **Acceptance** — `test/integration/vice/`, real VICE, opt-in with `C64RT_LIVE_VICE=/usr/bin/x64sc`:
  1. host → MCP → one VICE; read KERNAL bytes at `$e000` and the registers; status reports stopped/running correctly;
  2. terminating MCP makes its VICE exit;
  3. two MCP processes get two sessions and two VICE processes.

  Skipped live suites are reported as skipped, never as passed (09 §6). M1 has no pause tool, so the stopped case is proven at the session level (a raw monitor command stops real VICE); M2 re-checks it through `c64_execution`.

## M2 — Live-machine foundation

Acceptance (19 §4): against real VICE, load a fixture PRG → run → send input → run until a known address → advance an exact frame count → read memory/registers → capture the screen; the same scenario repeats with identical results and no wall-clock sleeps.

- [x] M2.1 **Text monitor** — `src/host/vice/text-monitor.ts`: VICE's remote text monitor beside the binary one, connected at launch. A command's output ends at a sentinel command's output, because VICE prints an extra prompt when a command enters the monitor. Commands share the session queue; binary `exit` resumes either way. Live test.
- [x] M2.2 **Execution control** — `c64_execution` pause/resume/step/next/until-return, `c64_reset`, `c64_warp` (text `warp`), status `warp` read from VICE. step/next/until-return in drive8 come with M3 (VICE steps the monitor's default device).
- [x] M2.3 **Writes** — `c64_memory_write`, `c64_registers` `set`; both require the CPU stopped (`machine-running`).
- [x] M2.4 **Media** — private-protocol attachments (D1 raw frames), `src/host-client/transfer.ts`, project-path checks incl. symlinks (17 §4); `c64_program_load` (text `load`), `c64_autostart` (binary autostart, `-autostartprgmode 1`), `c64_disk_attach` (text `attach`).
- [x] M2.5 **Input** — `c64_keyboard` text/petscii (binary keyboard feed), `c64_joystick` (binary joyport set, held until changed).
- [x] M2.6 **Screen capture** — `src/host/vice/screen.ts`: binary display + palette → PNG, `c64_screen` `capture` with an MCP image block (baselines, compare, list and discard come in M3).
- [x] M2.7 **Breakpoints and watchpoints** — typed conditions (15 §6) → VICE condition expressions, `c64_breakpoint` and `c64_watchpoint` lifecycles with session-local ids.
- [x] M2.8 **Frames and run-until** — `advance-frames` on a re-armed raster checkpoint, `c64_run_until` address/memory/raster targets with `timeoutFrames` and `stopReason`.
- [x] M2.9 **c64-emulator skill** — `skills/c64-emulator/SKILL.md` (ASD-STE100).
- [x] M2.10 **Acceptance** — `test/integration/vice/m2-acceptance.test.ts` with a fixture PRG built from bytes in TypeScript.

## M3 — The rest of the frozen VICE MCP surface

Acceptance (19 §5): every public tool in 15 §37 has schema tests, host-client/Host Runtime contract tests, a real-VICE test for each mechanism, and no VICE vocabulary in its results.

- [x] M3.1 **Memory search, compare, disassemble** — `c64_memory_search` (text `hunt`, `xx` wildcards), `c64_memory_compare` (two reads, any spaces/views), `c64_disassemble` (text `d`).
- [x] M3.2 **Chip state** — `c64_vicii`, `c64_sprite`, `c64_cia`, `c64_sid`, decoded from raw I/O registers read without side effects.
- [x] M3.3 **Execution history and timing** — `c64_cpu_history` (text `chis`, raster position from the cycle clock), `c64_backtrace` (JSR return addresses on the real stack; VICE's `bt` keeps stale entries), `c64_timing` (session stopwatch over VICE's cycle counter).
- [ ] M3.4 **Profile and memmap** — `c64_profile` (VICE profiler, on from session start), `c64_memmap` read/clear (text `mmsh`/`mmzap`).
- [ ] M3.5 **Screen baselines** — `c64_screen` capture with a baseline name, compare (mask, ratio, bounds, diff image), list, discard; session-local, lost with the machine state.
- [ ] M3.6 **Snapshots** — `c64_snapshot` save/restore/list/discard (binary dump/undump in the session scratch directory); restore finishes stopped.
- [ ] M3.7 **c64_observe** — one coherent stop for registers, memory ranges, VIC-II, sprites, CIAs, SID, screen and raster timing.
- [ ] M3.8 **drive8 execution** — step, next and until-return in space drive8.
- [ ] M3.9 **Acceptance** — the full 15 §37 tool list exactly; the c64-emulator skill updated for the new tools.

## Later milestones

Expand each into steps when it starts.

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
