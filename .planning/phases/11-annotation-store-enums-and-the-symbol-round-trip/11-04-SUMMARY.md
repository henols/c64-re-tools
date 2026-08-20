---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 04
subsystem: infra
tags: [mcp-client, jsonrpc, stdio, regenerator2000, child-process, error-handling]

# Dependency graph
requires:
  - phase: 11-01
    provides: r2000-test-gate.ts (the D-11 availability-gate seam) and r2000-launch.ts's FORBIDDEN_R2000_FLAGS/assertNoViceFlag() discipline
provides:
  - "Three fixed regenerator2000 argv builders: buildMcpServerStdioArgs, buildExportLblArgs, buildImportLblArgs"
  - "The client-shape decision record: MCPClient measured against five properties, verdict committed to MCP_CLIENT_VERDICT"
  - "r2000-mcp-client.ts: the one MCP-client seam (withR2000Session/callR2000/saveAndVerify), six named failure-mode error classes"
  - "Five new r2000 module names pre-registered on the correct side of the closed host-path consumer set"
affects: [11-05-r2000-tools, 11-06-enum-generator, 11-08-memory-map-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-shape decision by measurement, not preference: five named properties measured live against stub servers, decision rule applied mechanically, verdict committed as a constant so a dependency bump that changes behavior fails the test rather than silently invalidating the module header"
    - "Hand-rolled newline-delimited JSON-RPC client over a stdio child, request-id-first demux, one session per logical operation (spawn -> initialize -> call(s) -> close -> exit)"
    - "Persistence proven by independent re-read (content hash before/after), never by trusting a child process's own success text"

key-files:
  created:
    - .claude/mcp/vice/r2000-mcp-client.ts
    - .claude/mcp/vice/r2000-mcp-client.test.ts
  modified:
    - .claude/mcp/vice/r2000-launch.ts
    - .claude/mcp/vice/r2000-launch.test.ts
    - .claude/mcp/vice/hostpath-consumers.test.ts
    - .claude/mcp/vice/package.json

key-decisions:
  - "MCPClient vs. hand-rolled resolved by measurement: 4 of 5 required properties satisfied, but exit-code reachability is not (MCPClient's entire public prototype exposes no member related to a spawned child's exit status) -- per the plan's all-or-nothing rule, r2000-mcp-client.ts is a hand-rolled newline-delimited JSON-RPC client, not an MCPClient wrapper"
  - "r2000-mcp-client.ts resolves its regenerator2000 binary fresh per call (process.env.R2000_BIN, or an explicit bin option) rather than importing r2000-launch.ts's frozen module-level R2000_BIN constant -- needed so one test-runner process can drive multiple stub behaviours without restarting"

requirements-completed: [R2000-10, R2000-14, R2000-15]

# Metrics
duration: 27min
completed: 2026-08-20
---

# Phase 11 Plan 04: r2000 MCP client seam Summary

**Hand-rolled newline-delimited JSON-RPC client for regenerator2000's `--mcp-server-stdio`, chosen over `@mastra/mcp`'s `MCPClient` by a five-property live measurement, with six distinct named failure modes and independent persistence verification for `r2000_save_project`.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-20T23:02:37+02:00
- **Completed:** 2026-08-20T23:29:01+02:00
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Three fixed argv builders (`buildMcpServerStdioArgs`, `buildExportLblArgs`, `buildImportLblArgs`) added to `r2000-launch.ts`, argv shapes re-confirmed against a live `regenerator2000 --help` on this host; `buildImportLblArgs()` makes the D-28 discard trap (`main.rs:800-806`) unreachable by construction since `--mcp-server-stdio` is always emitted alongside `--import_lbl`.
- The `MCPClient`-vs-hand-rolled decision made by measurement, not preference: a five-behaviour stub server (happy, never-answers-call, exit-mid-call, exit-with-stderr, ENOENT) drove `@mastra/mcp`'s real `MCPClient`, and the measured verdict (4 of 5 satisfied, exit-code reachability not satisfied — confirmed by runtime reflection over the installed `MCPClient.prototype`, not just its `.d.ts`) is committed as `MCP_CLIENT_VERDICT` so a future dependency bump that changes any property fails the corresponding test.
- `r2000-mcp-client.ts` built as the one MCP-client seam: `withR2000Session()`/`callR2000()` spawn `regenerator2000 --mcp-server-stdio`, handshake, correlate JSON-RPC responses strictly by request id, and close per D-17 (one session per logical operation, never a long-lived child). Six distinct named error classes (`R2000SpawnError`, `R2000ProtocolError`, `R2000TimeoutError`, `R2000ChildExitError`, `R2000SessionFailedError`, plus silent correlation refusal on a mismatched id) cover every failure mode named in the plan objective.
- `saveAndVerify()` proves `r2000_save_project`'s persistence independently by re-reading the project file's own SHA-256 content hash from disk before and after the call — never trusting the child's own `"Project saved to <path>"` text. A stub that reports success while leaving the file byte-identical is rejected with `R2000SaveNotPersistedError`, naming the project path.
- The five new r2000 module names (`r2000-mcp-client.ts`, `r2000-tools.ts`, `r2000-enum-gen.ts`, `r2000-memmap-render.ts`, `r2000-confidence.ts`) are pre-registered on the correct (absent) side of `hostpath-consumers.test.ts`'s closed consumer set, whether or not they exist yet.
- Live-proven against a real installed `regenerator2000 0.9.20`: `r2000_get_binary_info` reports `size: 65536` for a Node-synthesized flat-64K project driven entirely through `withR2000Session()`.

## Task Commits

Each task was committed atomically:

1. **Task 1: the three fixed argv builders, plus the closed-consumer-set and packaging bookkeeping** - `b432f3b` (feat)
2. **Task 2: measure the client shape against the five required properties and record the verdict** - `6bdba3d` (test)
3. **Task 3: r2000-mcp-client.ts — the one seam, with no misleading success** - `085ce12` (feat)

_No TDD gate applies to this plan (`type: execute`, not `type: tdd`); Task 2's own commit type is `test` because it is the decision-record measurement, not implementation._

## Files Created/Modified

- `.claude/mcp/vice/r2000-mcp-client.ts` - The one MCP-client seam: `withR2000Session()`, `callR2000()`, `saveAndVerify()`, six named error classes, `R2000_PROTOCOL_VERSION`, `DEFAULT_R2000_CALL_TIMEOUT_MS`
- `.claude/mcp/vice/r2000-mcp-client.test.ts` - The client-shape decision record (`MCP_CLIENT_VERDICT`, five-property stub measurement against real `MCPClient`) plus 16 Task 3 tests covering every failure mode, both `saveAndVerify()` paths, three structural guards, and a live-gated real-child test
- `.claude/mcp/vice/r2000-launch.ts` - Added `buildMcpServerStdioArgs`, `buildExportLblArgs`, `buildImportLblArgs`
- `.claude/mcp/vice/r2000-launch.test.ts` - Exact-argv tests for the three new builders, the D-28 trap pin, and the `assertNoViceFlag()` pass-through check
- `.claude/mcp/vice/hostpath-consumers.test.ts` - Extended the r2000 must-be-absent array with the five new module names
- `.claude/mcp/vice/package.json` - Added `r2000-mcp-client.ts` to `files[]`

## Decisions Made

- **MCPClient vs. hand-rolled, resolved by measurement (not preference).** RESEARCH.md recommended `@mastra/mcp`'s `MCPClient` with a hand-rolled fallback if its failure-handling surface proved insufficient. This plan measured all five required properties live against a stub server: bounded-timeout-on-unanswered-call (satisfied, ~2050ms against a 2000ms timeout), distinct-mid-call-exit-error (satisfied, fails in ~70ms with a different error code than the timeout case), named-ENOENT-spawn-failure (satisfied, single-digit-millisecond `listToolsWithErrors()` naming both `ENOENT` and the missing binary), stderr-reachable-and-attributable (satisfied, via `getServerStderr()`), and exit-code-reachability (**not satisfied** — `MCPClient.prototype`'s own runtime member list, reflected via `Object.getOwnPropertyNames`, contains no member matching `/exit/i`). Per the plan's all-or-nothing rule, `r2000-mcp-client.ts` is therefore a hand-rolled newline-delimited JSON-RPC client. This is exactly the property `r2000-verify.ts`'s own D-10 incident (a lying zero-exit-code transcript) makes non-negotiable for this phase.
- **`R2000_BIN` resolved fresh per call, not imported as a frozen constant.** `r2000-launch.ts`'s own `R2000_BIN` export is evaluated once at module load — fine for that module's own single-process-lifetime use, but `r2000-mcp-client.ts` needed to let one `node:test` process (all `test()` calls in one file share a module cache) drive many different stub behaviours without restarting. `WithR2000SessionOptions.bin` resolves `process.env.R2000_BIN ?? "regenerator2000"` fresh on every `withR2000Session()` call instead, with the same default `r2000-launch.ts` uses.

## Deviations from Plan

None — plan executed exactly as written. Two implementation adjustments were made during Task 2's test-writing and are documented above as decisions rather than deviations, since both are exactly the "resolved by measurement, not preference" and "testability seam" work the plan's own objective and Task 3 read_first list anticipated.

## Issues Encountered

- An early implementation draft imported `R2000_BIN` from `r2000-launch.ts` as a frozen constant, which is correct for `r2000-launch.ts`'s own single-shot use but broke the stub-server test suite (all tests in one file share Node's module cache, so `process.env.R2000_BIN` changes made after the first import never took effect). Resolved by having `r2000-mcp-client.ts` resolve the binary path fresh per call instead (see Decisions above). Caught during Task 3's own manual verification against a scratch probe script before committing, so no test churn resulted.

## User Setup Required

None - no external service configuration required. `regenerator2000 0.9.20` was already installed on this host from Phase 9/10 work; the live-gated test in `r2000-mcp-client.test.ts` ran against it directly and also verified cleanly skipping when `R2000_BIN` is pointed at a nonexistent path.

## Next Phase Readiness

- `r2000-mcp-client.ts` exports exactly the public surface plan 11-05 (`r2000-tools.ts`) needs: `callR2000`, `withR2000Session`, and their error classes. `r2000-tools.ts` should import from here for every `r2000_*` tool call and never spawn `--mcp-server-stdio` itself.
- The five-module closed-consumer-set pre-registration in `hostpath-consumers.test.ts` means plans 11-05/11-06/11-08 do not need to touch that test file again when their own modules land, as long as none of them import `hostpath.ts`/`containerpath.ts`.
- No blockers. `regenerator2000` remains available and live-verified on this host for any future plan needing the same real-child oracle.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/r2000-mcp-client.ts
- FOUND: .claude/mcp/vice/r2000-mcp-client.test.ts
- FOUND: .claude/mcp/vice/r2000-launch.ts
- FOUND: .claude/mcp/vice/r2000-launch.test.ts
- FOUND: .claude/mcp/vice/hostpath-consumers.test.ts
- FOUND: .claude/mcp/vice/package.json
- FOUND commit: b432f3b (feat(11-04): three fixed r2000 argv builders plus closed-consumer-set bookkeeping)
- FOUND commit: 6bdba3d (test(11-04): measure MCPClient against five failure-mode properties, record hand-rolled verdict)
- FOUND commit: 085ce12 (feat(11-04): r2000-mcp-client.ts -- the one MCP-client seam, six named failure modes, no misleading success)
