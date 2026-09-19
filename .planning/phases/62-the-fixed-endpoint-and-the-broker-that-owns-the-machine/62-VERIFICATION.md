---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
verified: 2026-09-19T00:00:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-01-PLAN.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-01-SUMMARY.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-02-PLAN.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-02-SUMMARY.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-03-PLAN.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-03-SUMMARY.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-04-PLAN.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-04-SUMMARY.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-05-PLAN.md"
  - ".planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-05-SUMMARY.md"
  - "README.md"
  - "docs/phase58-declaration-provenance.md"
  - "src/mcp/vice/broker-control.mts"
  - "src/mcp/vice/broker-control.test.ts"
  - "src/mcp/vice/broker-e2e.test.ts"
  - "src/mcp/vice/broker-endpoint.test.ts"
  - "src/mcp/vice/broker-endpoint.ts"
  - "src/mcp/vice/broker-home.mts"
  - "src/mcp/vice/broker-home.test.ts"
  - "src/mcp/vice/broker-kill.test.ts"
  - "src/mcp/vice/build.ts"
  - "src/mcp/vice/package.json"
  - "src/mcp/vice/repo-root.ts"
  - "src/mcp/vice/resources/broker-control.mjs"
  - "src/mcp/vice/resources/broker-home.mjs"
  - "src/mcp/vice/resources/vice-broker.mjs"
  - "src/mcp/vice/service-no-invoke.test.ts"
  - "src/mcp/vice/service/com.henols.vice-broker.plist"
  - "src/mcp/vice/service/vice-broker.service"
  - "src/mcp/vice/tsconfig.build.json"
  - "src/mcp/vice/vice-broker-client.ts"
  - "src/mcp/vice/vice-broker-launch.test.ts"
  - "src/mcp/vice/vice-broker-supervision.test.ts"
  - "src/mcp/vice/vice-broker.mts"
  - "src/mcp/vice/vice-cli.d.mts"
  - "src/mcp/vice/vice-cli.mjs"
  - "src/mcp/vice/vice-cli.test.ts"
  - "src/mcp/vice/vice-errors.ts"
  - "src/mcp/vice/vice-proxy.ts"
covered_digest: "v1:sha256:d10702c95f2e9b9e2cc4f5026695f8436bee2d80d5e6fb36b80a1dd764d2b491"
---

# Phase 62: The Fixed Endpoint and the Broker That Owns the Machine Verification Report

**Phase Goal:** A user starts one broker on their machine, by hand, and every client —
the MCP server on a bare host, the MCP server inside a devcontainer, a skill script
anywhere — finds it with nothing on disk telling them where it is. The dial order *is*
the host/container detection, so no code reads `isInsideContainer()` to decide how to
reach the broker.

**Verified:** 2026-09-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria and requirement IDs)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A client reaches the broker with nothing on disk, dialling `127.0.0.1` then `host.docker.internal`, each candidate on its own timeout (ENDPOINT-01, ENDPOINT-02) | VERIFIED | `broker-endpoint.ts` exports `DIAL_CANDIDATES` (frozen `["127.0.0.1","host.docker.internal"]`); `dialBrokerEndpoint()` opens both concurrently with independent connect/reply timers. `broker-endpoint.test.ts` behavior cases (wedged candidate 1 does not block candidate 2, elapsed-time assertion) — 34/34 tests pass, re-run live. |
| 2 | The broker answers `hello` credential-free, ahead of the token gate; the eight pre-existing ops still require the token (ENDPOINT-03) | VERIFIED | `broker-control.mts`: `hello` dispatch arm sits between the JSON-parse/shape guards and `tokensMatch()` (read at source, lines ~917-926); `broker-control.test.ts`'s source-offset assertion and no-token behavioral tests pass — 88/88 tests re-run live. |
| 3 | "Something else answered" / stale broker / version skew are each distinguishable and refused by name, naming which side to update (ENDPOINT-03, ENDPOINT-05) | VERIFIED | `classifyHelloReply()` maps every observation onto 4 ranks; `describeDialFailure()` builds 4 distinct messages, rank 4 naming both package names and versions. Re-run live: all classifier/refusal tests in `broker-endpoint.test.ts` pass. |
| 4 | A client finding no broker refuses by name with the exact, path-free start command; no client ever spawns the broker (ENDPOINT-04, BROKER-02) | VERIFIED | `BROKER_START_COMMAND = "npx -y @henols/vice-mcp broker"` exported once from `broker-endpoint.ts`, quoted verbatim in rank-1/rank-3 refusals. `service-no-invoke.test.ts`'s `spawnsBrokerArtifact()` scan asserts zero production modules spawn the broker artifact — re-run live, 12/12 pass. |
| 5 | The broker binds loopback plus enumerated bridge-gateway addresses only, never `0.0.0.0`, never a hardcoded gateway (BROKER-03) | VERIFIED | `enumerateBindHosts()` uses the INTERNAL flag for loopback and a 4-pattern name allowlist (`docker0`, `br-`, `podman`, `cni-`) for bridges, IPv4-only. Grep-confirmed live: `VICE_BROKER_CONTROL_HOST ?? "0.0.0.0"` absent from both `broker-control.mts`/`.mjs` and `vice-broker.mts`/`.mjs`. |
| 6 | An empty bridge subset is a steady state; only a totally empty bound set (loopback failure) or an already-held port refuses by name (BROKER-04) | VERIFIED | `vice-broker.mts` startup: bridge-bind failures logged, non-fatal; loopback failure routes through the existing EADDRINUSE/liveness classification. `vice-broker-launch.test.ts` + `broker-e2e.test.ts` re-run live: 34/34 pass (both on the manual-only exclusion list, run by name per plan instruction). |
| 7 | One broker serves every session from every project on the machine; broker-owned state resolves under a machine-level root, inside neither of two distinct project roots (BROKER-01, BROKER-06) | VERIFIED | `broker-home.mts`'s `brokerHome()`/`brokerStateDir()` resolve `VICE_BROKER_HOME` (default `~/.c64-re-tools`); `vice-broker.mts`'s `parseArgs()` reaches `brokerStateDir()` as a 4th, lowest-precedence step (grep-confirmed in both `.mts` and compiled `.mjs`). `broker-e2e.test.ts`'s two-project case (one broker, two independent handshakes, state dir inside neither temp project root) and zero-session case re-run live and pass. |
| 8 | No client ever spawns the broker; the user starts it; a service definition ships for Linux and macOS, committed, never auto-applied, with a documented foreground fallback (BROKER-02, BROKER-05) | VERIFIED | `src/mcp/vice/service/vice-broker.service` and `.../com.henols.vice-broker.plist` exist, tracked by git, both user-scoped, both quote `npx -y @henols/vice-mcp broker` byte-for-byte (grep-confirmed). `service-no-invoke.test.ts`'s `invokesServiceManager()` predicate scans every top-level `.ts`/`.mts`/`.mjs` (tests included) for a `systemctl`/`launchctl` call and proves it bites on a planted violation before trusting the empty real scan — re-run live, 12/12 pass. README's "Starting the broker" section names the foreground command first and both files by path. |
| 9 | The dial order (loopback, then bridge alias) *is* the host/container detection — no code in the new dial path calls `isInsideContainer()` (phase objective) | VERIFIED | `broker-endpoint.ts`'s own header states this constraint; `broker-endpoint.test.ts` asserts (via byte-read, comment-stripped) the module contains no filesystem call and no import of the legacy discovery-record client. Grep confirms no `isInsideContainer` reference in `broker-endpoint.ts`. |
| 10 | The bind set is enumerated exactly once at startup and held immutable for the process's life — no re-enumeration timer (BROKER-03, D-10) | VERIFIED | `vice-broker.mts` calls `enumerateBindHosts()` exactly once at startup (grep-confirmed: the identifier appears once outside comments); no `setInterval`/`setTimeout` wraps it. `broker-control.test.ts`'s "single-call proof" behavior case re-run live and passes. |
| 11 | Every occurrence of the start command across the dial refusal, both service definitions and README is byte-identical to one exported constant (D-01, BROKER-05) | VERIFIED | `grep -c 'npx -y @henols/vice-mcp broker'` returns 1 in each of `service/vice-broker.service` (ExecStart line), `service/com.henols.vice-broker.plist` (header comment), and `README.md`; `service-no-invoke.test.ts` asserts byte-identity against the exported constant programmatically. |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/broker-endpoint.ts` | Fixed-endpoint dial, classification, refusals | VERIFIED | 544 lines; exports match PLAN 62-01's declared set exactly (`BROKER_START_COMMAND`, `HELLO_PROTOCOL_MAGIC`, `DIAL_CANDIDATES`, `dialBrokerEndpoint`, `classifyHelloReply`, `describeDialFailure`) |
| `src/mcp/vice/broker-endpoint.test.ts` | End-to-end + behavior coverage | VERIFIED | 632 lines, 34 tests, all passing on live re-run |
| `src/mcp/vice/broker-control.mts` + compiled `.mjs` | 9th `hello` op, pre-gate dispatch | VERIFIED | Source read confirms placement; compiled copy regenerated and matches (`resources-sync.test.ts` passes) |
| `src/mcp/vice/broker-home.mts` + compiled `.mjs` | Machine-level root + 6 derived resolvers | VERIFIED | Exports match declared set exactly; `brokerStateDir` is the only one wired into a live consumer (`vice-broker.mts`) this phase — the other five (`brokerIncidentsDir`, `brokerEpochFile`, `brokerStagingDir`, `brokerRunsDir`, `ensureBrokerDir`) are present, tested in isolation, and correctly unconsumed (their own consumers are out of this phase's declared scope per 62-02's "Scope boundary held deliberately" and CONTEXT.md) |
| `src/mcp/vice/vice-cli.mjs` | Single binary/main entry, floor refusal, broker dispatch | VERIFIED | `package.json`'s `bin`/`main` retargeted (confirmed live); 15/15 tests pass |
| `src/mcp/vice/service/vice-broker.service`, `.../com.henols.vice-broker.plist` | Committed, never-applied service definitions | VERIFIED | Both tracked by git, both quote the start command byte-identically |
| `src/mcp/vice/service-no-invoke.test.ts` | Never-invoke / never-spawn structural gate | VERIFIED | 12/12 tests pass live, planted-violation proofs present for both predicates |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `broker-endpoint.ts` | `broker-control.mts` | `hello` handshake line | VERIFIED — end-to-end test against a real listener passes |
| `vice-broker.mts` | `broker-control.mts` | `startControlListenerOnHosts` | VERIFIED — grep-confirmed call site, live-tested startup |
| `vice-broker.mts` | `broker-home.mts` | `brokerStateDir` (compiled-sibling import) | VERIFIED — grep-confirmed in both `.mts` and `.mjs`, live two-project test passes |
| `vice-cli.mjs` | `resources/vice-broker.mjs` | dynamic import on `broker` subcommand, subcommand token stripped | VERIFIED — dispatch code read at source; behavioral test passes |
| `service/vice-broker.service`, `.../com.henols.vice-broker.plist` | `broker-endpoint.ts`'s `BROKER_START_COMMAND` | byte-identical quoted string | VERIFIED — grep + programmatic test |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Plan 62-01 files | `node --test broker-endpoint.test.ts broker-control.test.ts resources-sync.test.ts` | 122/122 pass | PASS |
| Plan 62-02 files | `node --test broker-home.test.ts resources-sync.test.ts build-atomic.test.ts repo-root.test.ts` | 31/31 pass | PASS |
| Plan 62-03 files | `node --test broker-control.test.ts resources-sync.test.ts` + `node --test vice-broker-launch.test.ts broker-e2e.test.ts` (manual-only, by name) | 88/88 + 34/34 pass | PASS |
| Plan 62-04 files | `node --test vice-cli.test.ts` + `node --test broker-e2e.test.ts vice-broker-launch.test.ts` (manual-only, by name) | 15/15 + 34/34 pass | PASS |
| Plan 62-05 files | `node --test service-no-invoke.test.ts` | 12/12 pass | PASS |
| Typecheck | `npm run typecheck` | clean, exit 0 | PASS |
| README generation idempotence | `npm run generate:readme` then `git diff --quiet -- README.md` | no diff | PASS |
| Full suite (`npm test`, the wider glob per orchestrator note 2) | `node --test '*.test.*'` | 4150 tests / 4068 pass / 1 fail / 81 skipped | 1 known pre-existing failure (see below) |

**The one full-suite failure** (`phase58-citation-ledger.test.ts`, a citation-anchor drift in `.planning/PROJECT.md:2083`) is pre-existing and unrelated to this phase. Verified directly: `.planning/PROJECT.md` carries no changes from any phase-62 commit, and the orchestrator's own record shows this failure reproduced at the phase's base commit (`6dd9fd89^`) before any phase-62 work existed. Logged in `deferred-items.md`. Not scored against this phase.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| ENDPOINT-01 | Client reaches broker with no file on disk, fixed candidate order | SATISFIED | `broker-endpoint.ts`, `broker-endpoint.test.ts` |
| ENDPOINT-02 | Each candidate bounded by its own timeout | SATISFIED | Per-candidate connect/reply timers, wedged-candidate test |
| ENDPOINT-03 | Handshake proves genuine broker + compatible version | SATISFIED | `hello` op, `classifyHelloReply()` |
| ENDPOINT-04 | No-broker refusal names exact start command | SATISFIED | `BROKER_START_COMMAND`, rank-1/rank-3 refusals |
| ENDPOINT-05 | Incompatible-version refusal names which side to update | SATISFIED | Rank-4 refusal names both packages/versions |
| BROKER-01 | One broker serves every session/project | SATISFIED | Two-project e2e test, shared pending-acquire queue |
| BROKER-02 | No client spawns the broker | SATISFIED | `service-no-invoke.test.ts`'s `spawnsBrokerArtifact()` |
| BROKER-03 | Broker binds loopback + enumerated bridges only | SATISFIED | `enumerateBindHosts()`, wildcard-default removed (grep-confirmed) |
| BROKER-04 | Refuses by name when port already in use | SATISFIED (see Anti-Patterns note below) | Loopback-fatal EADDRINUSE path tested live |
| BROKER-05 | Service definitions committed, never auto-applied, foreground fallback documented | SATISFIED | Two definitions + structural gate + README section |
| BROKER-06 | Broker-owned state lands under a machine-level root | SATISFIED (partial — see note) | `brokerStateDir()` wired; instance-level epoch/log dirs inherit it |

All 11 requirement IDs from the phase's PLAN frontmatter cross-reference cleanly against `REQUIREMENTS.md`'s traceability table, which lists all 11 as `Phase 62 | Complete`. No orphaned requirements found for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/vice-broker.mts` | ~1565 | Unguarded `writeBrokerRecordFile()` call (CR-01 from `62-REVIEW.md`) | Warning | A failed initial discovery-record write (disk full, permission-denied home directory — made *more* likely by this phase's move of the default state dir to `~/.c64-re-tools/`) leaves the broker holding the control port open forever with no valid `broker.json`, invisible to `registerShutdownHandlers()`. This is a genuine, code-review-confirmed robustness gap. It does **not** invalidate the tested BROKER-04 truth (the port-already-held scenario the roadmap SC and this phase's tests describe is independently verified correct) — it is a *different* failure trigger the phase's own review surfaced. Recommend a follow-up fix per `62-REVIEW.md`'s suggested patch before this is exercised in production. |
| `src/mcp/vice/broker-endpoint.ts` | 242-249 | `finish()` strips all socket listeners (incl. `'error'`) without destroying the socket (WR-01) | Warning | Contained today (`dialBrokerEndpoint` has no production caller yet); becomes live risk once phase 63+ wires a real caller. |
| `src/mcp/vice/broker-control.mts` | 917-926 | Unmemoised, synchronous `resolveBrokerVersion()` on every pre-auth `hello` call (WR-02) | Warning | A reachable peer can force repeated blocking disk I/O; low urgency but worth closing given `hello`'s pre-auth exposure surface just widened (loopback + all enumerated bridges). |
| `src/mcp/vice/vice-broker-client.ts` | 636, 1103 | Dead `warm_floor` field always evaluates `NaN` (WR-03) | Info | Predates this phase; not introduced by it. |
| `src/mcp/vice/service/com.henols.vice-broker.plist` | 32-38 | No `VICE_BROKER_NODE`-equivalent PATH escape hatch, unlike the systemd unit (WR-04) | Warning | Documented asymmetry; does not block phase completion. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file this phase touches (checked via byte-safe reads, including the four NUL-byte-carrying files elsewhere in the tree, none of which this phase modifies).

### Notable Scope Observations (not gaps)

- `broker-home.mts`'s `brokerIncidentsDir`, `brokerEpochFile`, `brokerStagingDir`, `brokerRunsDir`, and `ensureBrokerDir` are exported, tested in isolation, and currently unconsumed by any production call site outside `broker-home.mts` itself. This matches plan 62-02's explicit "Scope boundary held deliberately" (BROKER-06 is host-bound/broker-process scope only; the container-side incident writer and epoch constant are declared out of scope for this phase) and is not a defect — they are forward infrastructure for phases 63-65.
- The ROADMAP's Success Criterion 5 text ("everything the broker writes for itself — state, staging, run scratch — lands under a machine-level root") is substantively true for what the broker currently writes: the discovery record and per-instance epoch/log directories (`superviseDepsFor()` → `join(stateDir, String(port))`) both inherit the machine-level `brokerStateDir()` resolution. One narrower, pre-existing item remains outside it: `broker-launch.mts`'s per-launch `XDG_CONFIG_HOME` scratch directory (`mkdtempSync(join(tmpdir(), "vice-broker-vicerc-"))`) still lands in the OS temp directory, not under `VICE_BROKER_HOME`. This is not project-directory pollution (satisfying the SC's "nothing inside any project's `.c64-re-tools/`" clause), and it was explicitly identified, reasoned about, and deliberately deferred in the phase's own `62-CONTEXT.md` ("Folded Todos" — tagged `resolves_phase: 64`, not silently dropped). Recorded here for visibility rather than as a phase-62 gap.
- `RM-04`'s traceability-table mapping to Phase 66 is now stale bookkeeping (D-11 moved the rewrite into Phase 62, completed across plans 62-02/62-03) — flagged by the plans themselves, not a phase-62 defect; Phase 66 will find that specific work already done.

### Human Verification Required

None. Every must-have truth was verified directly against the codebase (source reads, grep-confirmed literal removals/additions, and live re-execution of every test file this phase's plans declare, including the four files on the manual-only exclusion list, run by name). No visual, real-time, or external-service-dependent behavior is in scope for this phase.

### Gaps Summary

No blocking gaps. All 11 requirement IDs (ENDPOINT-01..05, BROKER-01..06) are satisfied with direct, re-executed evidence — not merely SUMMARY.md claims. The five findings above (one from the phase's own code review, four already logged in `62-REVIEW.md`) are Warning/Info severity, do not prevent the roadmap's stated success criteria from being true today, and are recorded for the developer's follow-up decision rather than as phase-blocking defects.

---

_Verified: 2026-09-19_
_Verifier: Claude (gsd-verifier)_
