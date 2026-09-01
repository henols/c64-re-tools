---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 04
subsystem: infra
tags: [mcp-client, jsonrpc, stdio, the external analyser, child-process, error-handling]

# Dependency graph
requires:
  - phase: 11-01
    provides: anno-test-gate.ts (the D-11 availability-gate seam) and anno-launch.ts's FORBIDDEN_ANNO_FLAGS/assertNoViceFlag() discipline
provides:
  - "Three fixed the external analyser argv builders: buildMcpServerStdioArgs, buildExportLblArgs, buildImportLblArgs"
  - "The client-shape decision record: MCPClient measured against five properties, verdict committed to MCP_CLIENT_VERDICT"
  - "anno-mcp-client.ts: the one MCP-client seam (withAnnoSession/callAnno/saveAndVerify), six named failure-mode error classes"
  - "Five new anno module names pre-registered on the correct side of the closed host-path consumer set"
affects: [11-05-anno-tools, 11-06-enum-generator, 11-08-memory-map-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-shape decision by measurement, not preference: five named properties measured live against stub servers, decision rule applied mechanically, verdict committed as a constant so a dependency bump that changes behavior fails the test rather than silently invalidating the module header"
    - "Hand-rolled newline-delimited JSON-RPC client over a stdio child, request-id-first demux, one session per logical operation (spawn -> initialize -> call(s) -> close -> exit)"
    - "Persistence proven by independent re-read (content hash before/after), never by trusting a child process's own success text"

key-files:
  created:
    - .claude/mcp/vice/anno-mcp-client.ts
    - .claude/mcp/vice/anno-mcp-client.test.ts
  modified:
    - .claude/mcp/vice/anno-launch.ts
    - .claude/mcp/vice/anno-launch.test.ts
    - .claude/mcp/vice/hostpath-consumers.test.ts
    - .claude/mcp/vice/package.json

key-decisions:
  - "MCPClient vs. hand-rolled resolved by measurement: 4 of 5 required properties satisfied, but exit-code reachability is not (MCPClient's entire public prototype exposes no member related to a spawned child's exit status) -- per the plan's all-or-nothing rule, anno-mcp-client.ts is a hand-rolled newline-delimited JSON-RPC client, not an MCPClient wrapper"
  - "anno-mcp-client.ts resolves its the external analyser binary fresh per call (process.env.ANNO_BIN, or an explicit bin option) rather than importing anno-launch.ts's frozen module-level ANNO_BIN constant -- needed so one test-runner process can drive multiple stub behaviours without restarting"

requirements-completed: [ANNO-10, ANNO-14, ANNO-15]

# Metrics
duration: 27min
completed: 2026-08-20
---

# Phase 11 Plan 04: anno MCP client seam Summary

**Hand-rolled newline-delimited JSON-RPC client for the external analyser's `--mcp-server-stdio`, chosen over `@mastra/mcp`'s `MCPClient` by a five-property live measurement, with six distinct named failure modes and independent persistence verification for `anno_save_project`.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-20T23:02:37+02:00
- **Completed:** 2026-08-20T23:29:01+02:00
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Three fixed argv builders (`buildMcpServerStdioArgs`, `buildExportLblArgs`, `buildImportLblArgs`) added to `anno-launch.ts`, argv shapes re-confirmed against a live `analyser --help` on this host; `buildImportLblArgs()` makes the D-28 discard trap (`main.rs:800-806`) unreachable by construction since `--mcp-server-stdio` is always emitted alongside `--import_lbl`.
- The `MCPClient`-vs-hand-rolled decision made by measurement, not preference: a five-behaviour stub server (happy, never-answers-call, exit-mid-call, exit-with-stderr, ENOENT) drove `@mastra/mcp`'s real `MCPClient`, and the measured verdict (4 of 5 satisfied, exit-code reachability not satisfied — confirmed by runtime reflection over the installed `MCPClient.prototype`, not just its `.d.ts`) is committed as `MCP_CLIENT_VERDICT` so a future dependency bump that changes any property fails the corresponding test.
- `anno-mcp-client.ts` built as the one MCP-client seam: `withAnnoSession()`/`callAnno()` spawn `analyser --mcp-server-stdio`, handshake, correlate JSON-RPC responses strictly by request id, and close per D-17 (one session per logical operation, never a long-lived child). Six distinct named error classes (`AnnoSpawnError`, `AnnoProtocolError`, `AnnoTimeoutError`, `AnnoChildExitError`, `AnnoSessionFailedError`, plus silent correlation refusal on a mismatched id) cover every failure mode named in the plan objective.
- `saveAndVerify()` proves `anno_save_project`'s persistence independently by re-reading the project file's own SHA-256 content hash from disk before and after the call — never trusting the child's own `"Project saved to <path>"` text. A stub that reports success while leaving the file byte-identical is rejected with `AnnoSaveNotPersistedError`, naming the project path.
- The five new anno module names (`anno-mcp-client.ts`, `anno-tools.ts`, `anno-enum-gen.ts`, `anno-memmap-render.ts`, `anno-confidence.ts`) are pre-registered on the correct (absent) side of `hostpath-consumers.test.ts`'s closed consumer set, whether or not they exist yet.
- Live-proven against a real installed `the external analyser 0.9.20`: `anno_get_binary_info` reports `size: 65536` for a Node-synthesized flat-64K project driven entirely through `withAnnoSession()`.

## Task Commits

Each task was committed atomically:

1. **Task 1: the three fixed argv builders, plus the closed-consumer-set and packaging bookkeeping** - `b432f3b` (feat)
2. **Task 2: measure the client shape against the five required properties and record the verdict** - `6bdba3d` (test)
3. **Task 3: anno-mcp-client.ts — the one seam, with no misleading success** - `085ce12` (feat)

_No TDD gate applies to this plan (`type: execute`, not `type: tdd`); Task 2's own commit type is `test` because it is the decision-record measurement, not implementation._

## Files Created/Modified

- `.claude/mcp/vice/anno-mcp-client.ts` - The one MCP-client seam: `withAnnoSession()`, `callAnno()`, `saveAndVerify()`, six named error classes, `ANNO_PROTOCOL_VERSION`, `DEFAULT_ANNO_CALL_TIMEOUT_MS`
- `.claude/mcp/vice/anno-mcp-client.test.ts` - The client-shape decision record (`MCP_CLIENT_VERDICT`, five-property stub measurement against real `MCPClient`) plus 16 Task 3 tests covering every failure mode, both `saveAndVerify()` paths, three structural guards, and a live-gated real-child test
- `.claude/mcp/vice/anno-launch.ts` - Added `buildMcpServerStdioArgs`, `buildExportLblArgs`, `buildImportLblArgs`
- `.claude/mcp/vice/anno-launch.test.ts` - Exact-argv tests for the three new builders, the D-28 trap pin, and the `assertNoViceFlag()` pass-through check
- `.claude/mcp/vice/hostpath-consumers.test.ts` - Extended the anno must-be-absent array with the five new module names
- `.claude/mcp/vice/package.json` - Added `anno-mcp-client.ts` to `files[]`

## Decisions Made

- **MCPClient vs. hand-rolled, resolved by measurement (not preference).** RESEARCH.md recommended `@mastra/mcp`'s `MCPClient` with a hand-rolled fallback if its failure-handling surface proved insufficient. This plan measured all five required properties live against a stub server: bounded-timeout-on-unanswered-call (satisfied, ~2050ms against a 2000ms timeout), distinct-mid-call-exit-error (satisfied, fails in ~70ms with a different error code than the timeout case), named-ENOENT-spawn-failure (satisfied, single-digit-millisecond `listToolsWithErrors()` naming both `ENOENT` and the missing binary), stderr-reachable-and-attributable (satisfied, via `getServerStderr()`), and exit-code-reachability (**not satisfied** — `MCPClient.prototype`'s own runtime member list, reflected via `Object.getOwnPropertyNames`, contains no member matching `/exit/i`). Per the plan's all-or-nothing rule, `anno-mcp-client.ts` is therefore a hand-rolled newline-delimited JSON-RPC client. This is exactly the property `anno-verify.ts`'s own D-10 incident (a lying zero-exit-code transcript) makes non-negotiable for this phase.
- **`ANNO_BIN` resolved fresh per call, not imported as a frozen constant.** `anno-launch.ts`'s own `ANNO_BIN` export is evaluated once at module load — fine for that module's own single-process-lifetime use, but `anno-mcp-client.ts` needed to let one `node:test` process (all `test()` calls in one file share a module cache) drive many different stub behaviours without restarting. `WithAnnoSessionOptions.bin` resolves `process.env.ANNO_BIN ?? "the external analyser"` fresh on every `withAnnoSession()` call instead, with the same default `anno-launch.ts` uses.

## Deviations from Plan

None — plan executed exactly as written. Two implementation adjustments were made during Task 2's test-writing and are documented above as decisions rather than deviations, since both are exactly the "resolved by measurement, not preference" and "testability seam" work the plan's own objective and Task 3 read_first list anticipated.

## Issues Encountered

- An early implementation draft imported `ANNO_BIN` from `anno-launch.ts` as a frozen constant, which is correct for `anno-launch.ts`'s own single-shot use but broke the stub-server test suite (all tests in one file share Node's module cache, so `process.env.ANNO_BIN` changes made after the first import never took effect). Resolved by having `anno-mcp-client.ts` resolve the binary path fresh per call instead (see Decisions above). Caught during Task 3's own manual verification against a scratch probe script before committing, so no test churn resulted.

## User Setup Required

None - no external service configuration required. `the external analyser 0.9.20` was already installed on this host from Phase 9/10 work; the live-gated test in `anno-mcp-client.test.ts` ran against it directly and also verified cleanly skipping when `ANNO_BIN` is pointed at a nonexistent path.

## Next Phase Readiness

- `anno-mcp-client.ts` exports exactly the public surface plan 11-05 (`anno-tools.ts`) needs: `callAnno`, `withAnnoSession`, and their error classes. `anno-tools.ts` should import from here for every `anno_*` tool call and never spawn `--mcp-server-stdio` itself.
- The five-module closed-consumer-set pre-registration in `hostpath-consumers.test.ts` means plans 11-05/11-06/11-08 do not need to touch that test file again when their own modules land, as long as none of them import `hostpath.ts`/`containerpath.ts`.
- No blockers. `the external analyser` remains available and live-verified on this host for any future plan needing the same real-child oracle.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/anno-mcp-client.ts
- FOUND: .claude/mcp/vice/anno-mcp-client.test.ts
- FOUND: .claude/mcp/vice/anno-launch.ts
- FOUND: .claude/mcp/vice/anno-launch.test.ts
- FOUND: .claude/mcp/vice/hostpath-consumers.test.ts
- FOUND: .claude/mcp/vice/package.json
- FOUND commit: b432f3b (feat(11-04): three fixed anno argv builders plus closed-consumer-set bookkeeping)
- FOUND commit: 6bdba3d (test(11-04): measure MCPClient against five failure-mode properties, record hand-rolled verdict)
- FOUND commit: 085ce12 (feat(11-04): anno-mcp-client.ts -- the one MCP-client seam, six named failure modes, no misleading success)
