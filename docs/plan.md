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
- [x] M3.4 **Profile and memmap** — `c64_profile` (VICE profiler, on from session start), `c64_memmap` read/clear (text `mmsh`/`mmzap`).
- [x] M3.5 **Screen baselines** — `c64_screen` capture with a baseline name, compare (mask, ratio, bounds, diff image), list, discard; session-local, lost with the machine state.
- [x] M3.6 **Snapshots** — `c64_snapshot` save/restore/list/discard (binary dump/undump in the session scratch directory); restore finishes stopped.
- [x] M3.7 **c64_observe** — one coherent stop for registers, memory ranges, VIC-II, sprites, CIAs, SID, screen and raster timing.
- [x] M3.8 **drive8 execution** — step, next and until-return in space drive8. Not achievable on stock VICE 3.10: it runs the 1541 CPU in batches that catch up with the computer's clock, and neither monitor stops it after one instruction (live-tested with binary step, text `z`/`n`/`ret` under `dev 8:` and drive checkpoints). They stay `unsupported-in-space` with that reason; drive breakpoints remain. Open question for Henrik.
- [x] M3.9 **Acceptance** — the full 15 §37 tool list exactly; the c64-emulator skill updated for the new tools.

## M4 — Knowledge core

Acceptance (19 §6): from a clean C64 project directory, a knowledge read needs no database; the first write creates `.c64-re-tools/knowledge.db`; several semantic changes give a correct current view and keep the full history. No Host Runtime is involved.

- [x] M4.1 **Database and schema** — `src/knowledge/database.ts`, `schema.ts`: built-in `node:sqlite` (no dependency), rollback journal, v1 temporal schema (06 §4), forward migrations, a missing database reads as empty without being created, a newer schema is refused.
- [x] M4.2 **Semantic writes** — `write.ts`: one revision per accepted change; rename/remove symbol, classify/unclassify regions with splits, set/remove comments, add/remove references, revert; stale-revision refusal; rollback on failure.
- [x] M4.3 **Reads and history** — `read.ts`, `history.ts`: `at(address)`, search and lists of current knowledge; history by address, revisions, one revision's changes.
- [x] M4.4 **c64-knowledge skill** — `skills/c64-knowledge/scripts/knowledge.ts` (compact JSON in and out) and `SKILL.md` (ASD-STE100).
- [x] M4.5 **Acceptance** — the 19 §6 scenario through the script in a clean temporary project.

## M5 — Native-tool request seam + ACME

Acceptance (19 §7): a fixture source program assembles through the c64-assembler script, the Host Runtime and real ACME, then loads into VICE through the MCP and reaches a known state. ACME never enters the MCP.

- [x] M5.1 **Tool requests on the wire** — typed tool operations on `tool` connections, attachments in replies, per-request abort when the client goes away, `src/host-client/tools.ts`, source-tree transfer with the 16 §4 symlink rules.
- [x] M5.2 **Staging, discovery, bounded runs** — `src/host/staging.ts` (request workspaces, safe tree materialization, cleanup), `src/host/tools/discover.ts` (`C64RT_<TOOL>` or `PATH`, refusal by name with the remedy), a bounded child run (timeout, output cap, process group).
- [x] M5.3 **ACME adapter** — `src/host/tools/acme.ts`: argv from the typed request (16 §8), diagnostics and symbol parsing, PRG validation; unit tests and a real-ACME test.
- [x] M5.4 **c64-assembler skill** — `skills/c64-assembler/scripts/assemble.ts` writes the program to a project path and reports diagnostics and symbols; `SKILL.md` (ASD-STE100).
- [x] M5.5 **Acceptance** — source → c64-assembler → Host Runtime → ACME → PRG → `c64_program_load` → VICE reaches a known state.

## M6 — Disk and BASIC tooling

Acceptance (19 §8): with real fixture media, inspect a D64 directory, extract a PRG, decode its BASIC loader, find its machine-code handoff, and load the extracted program in VICE.

- [x] M6.1 **c1541 adapter** — `c1541.inspect` on the wire (image bytes as the attachment, `d64`/`d71`/`d81`/`g64`), `src/host/tools/c1541.ts`: c1541 does the image work (`info`, `dir` free count, `bam`, `chain t s`, `bread` raw blocks); the adapter parses the raw header and directory blocks, so file names keep their exact PETSCII bytes (c1541's own `dir` and name arguments lose case). c1541 exits 0 on errors, so failures come from its output and from missing output files. A damaged structure (chain loop, block out of range) is `media-error`; a missing name is `found: false`.
- [x] M6.2 **petcat adapter** — `petcat.decode`, `src/host/tools/petcat.ts`: `petcat -2` for the listing; the adapter parses the tokenized lines itself (end marker at a zero link high byte, as BASIC relinks), checks that petcat's line numbers match, and finds SYS/USR handoffs in the tokens outside strings, REM and DATA. A constant SYS expression gives an address; anything else is `computed`. Bytes that are no BASIC program give `decoded: false`.
- [x] M6.3 **Host client** — `inspectDisk` and `decodeBasic` in `src/host-client/tools.ts`, reading project files through `transfer.ts`.
- [x] M6.4 **c64-disk skill** — `skills/c64-disk/scripts/disk.ts` (directory, bam, entry, chain, read with `--out`) and `SKILL.md` (ASD-STE100).
- [x] M6.5 **c64-basic skill** — `skills/c64-basic/scripts/basic.ts` and `SKILL.md` (ASD-STE100).
- [x] M6.6 **Acceptance** — a D64 made by real c1541 with a BASIC loader and its machine code: directory → read → decode → handoff → `c64_autostart` of the extracted program, run until BASIC reaches the handoff in VICE (live part opt-in).

## M7 — DXA + normalized-findings importer

Acceptance (19 §9): a fixture PRG goes through DXA, normalized findings and the importer into knowledge.db; a second DXA run with changed results retires obsolete DXA facts, keeps history, protects semantic knowledge, and a malformed result imports nothing.

- [x] M7.1 **Importer** — `src/knowledge/import.ts`: normalized findings (analyzer, coverage, authoritative categories, symbols, regions, references), complete validation before any write, one revision per import, same-analyzer retirement in authoritative coverage, coverage-aware region splits, semantic and other-analyzer rows kept. Only code against data is a conflict (12 §12, §19); unchanged facts keep their rows, so a repeated run makes no revision.
- [ ] M7.2 **DXA adapter** — `dxa.analyze`, `src/host/tools/dxa.ts`. Blocked: DXA is not installed on the development host (see D12).
- [ ] M7.3 **c64-static-analysis DXA path** — the DXA → normalized findings mapping in `skills/c64-static-analysis/scripts/analyze.ts`. Blocked with M7.2.
- [ ] M7.4 **Acceptance** — blocked with M7.2.

## M8 — Ghidra deeper analysis

Acceptance (19 §10): the NMOS language compiles, decodes all 105 undocumented opcodes with the right lengths, has tested p-code for the deterministic families, stops flow at JAM, keeps unstable instructions opaque and models NMOS decimal mode; then Ghidra findings go through the same importer, a semantic rename seeds the next run, and an echoed seed does not become Ghidra's.

- [x] M8.1 **NMOS language** — `src/host/tools/ghidra/language/`: a complete 256-opcode NMOS 6502/6510 SLEIGH language with its own id (Ghidra's 6502 decodes only the 151 documented opcodes, has no decimal mode, and its STA pattern takes $89, so a layer over it would clash). Deterministic undocumented instructions get real p-code; XAA/LXA/AHX/TAS/SHX/SHY use opaque pcodeops that keep their inputs; JAM does not fall through; ADC/SBC and the decimal-sensitive undocumented instructions follow NMOS decimal mode. Build copies the Ghidra assets into `dist/`.
- [x] M8.2 **Headless runner** — `src/host/tools/ghidra/index.ts`: find Ghidra (`C64RT_GHIDRA` install directory, or `analyzeHeadless` on PATH), run it with a per-request settings directory (`XDG_CONFIG_HOME`/`XDG_CACHE_HOME`) that holds the language as an extension, a disposable project, our script directory and a bound; the user's Ghidra install and settings stay untouched.
- [x] M8.3 **Language acceptance** — real-Ghidra tests (skipped without Ghidra): compile, the 105-opcode sweep, p-code emulation of SLO/RLA/SRE/RRA, SAX/LAX, DCP/ISC and the immediate family, JAM flow, opaque unstable instructions, decimal arithmetic.
- [ ] M8.4 **ghidra.analyze** — wire types and bounds (16 §10), a Java export script (functions with name source, code/data regions, references, bounded decompilation), seeds (entry points, data ranges, labels), complete validation before the result leaves the host.
- [ ] M8.5 **c64-static-analysis skill** — `skills/c64-static-analysis/scripts/analyze.ts`: seeds from current knowledge, `ghidra.analyze`, Ghidra → normalized findings (seed names stay semantic), `importFindings`, a compact result; `SKILL.md` (ASD-STE100).
- [ ] M8.6 **Acceptance** — the iterative loop on a fixture PRG: Ghidra import → semantic rename → seeded re-run → same importer, history and conflicts kept, echoed seed not owned by Ghidra.

## Later milestones

Expand each into steps when it starts.

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
| D12 | DXA missing | DXA is not installed here, and tools are never installed for the user. Its parser is not written against guessed output. M8 (Ghidra, installed) goes first and gives c64-static-analysis its first analyzer path through the same importer; M7.2–M7.4 follow when DXA is installed. |
