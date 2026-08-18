# Phase 7: Cycle Timing and Wedge Triage - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning
**Source:** Operator decisions taken during `/gsd-plan-phase 7`, resolving `07-RESEARCH.md` § Open Questions

> This phase did not run `/gsd-discuss-phase` — Phase 5 did not either, and that is the
> convention here. This file exists so the three operator decisions taken during planning are
> durable rather than living only in a transcript. They are recorded verbatim as they were
> given to the planner.

<domain>
## Phase Boundary

Make `vice_cycles_stopwatch` and `vice_run_until` work on the stock VICE backend, and make
`vice_diagnose` able to tell the five distinguishable stopped-emulator states apart there —
including the one that is new to stock, where the binary monitor is already held by another
client. Together with Phase 5's eight tools, this closes the buildable half of the 12-tool gap.

Phase 8 is what makes the two backends *honest* about the gap that cannot be closed. This phase
builds; it does not do Phase 8's methodology pass.

</domain>

<decisions>
## Implementation Decisions

### Scope

- **D-01**: `vice_recycle` gets a stock-native evidence gatherer in this phase. The research
  found a third skill-called tool broken on stock for the same root cause as the others —
  `gatherWedgeEvidence()` calls `rewriteArguments()`/`call()` and is fork-only, while the
  destructive `controlSession.recycle(grantId)` action is transport-independent and already
  works. Without this, stock `vice-wedge-triage` diagnoses `wedged` correctly and then breaks on
  its own documented recovery step. No screenshot — `SHOT-*` was cut from scope. The incident
  record must be written **before** the destructive RPC, same ordering as the fork path.
  *(Resolves RESEARCH Open Question 1. No `TIME-*` requirement names this tool; it is a
  deliberate scope addition, taken because criterion 4 is meaningless if the skill breaks one
  step after its opening move.)*

### Tool surface

- **D-02**: `vice_run_until` exposes an optional stock-only `timeout_ms`, defaulting to `30000`.
  30 s matches the existing `VICE_MCP_TIMEOUT_MS` default so one number governs both layers.
  Optional, not required — the fork's argument shape and every existing skill call site stay
  valid. `D-03`'s stock-only-optional-extras allowance permits this.
  *(Resolves RESEARCH Open Question 2.)*

- **D-03**: The stock `vice_diagnose` verdict set is exactly five: `["restarted",
  "checkpoint_trap", "wedged", "monitor_held_elsewhere", "live"]`. The fork's
  `"stale_read_path"` verdict is deliberately absent — it exists only because the fork mixes a
  non-pausing `vice_ping` with pausing reads, and on stock every read pauses uniformly, so the
  state is unreachable by construction. This divergence must be recorded in
  `docs/stock-vice-parity.md`; an undocumented missing verdict is exactly the silent capability
  gap Phase 8 exists to prevent.
  *(Resolves RESEARCH Open Question 3.)*

### Claude's Discretion

Everything the three decisions above do not fix was left to the planner and is recorded in the
plans rather than here — notably: the `DIAGNOSE_SESSION_TIMEOUT_MS` bound and its value, whether
`vice_diagnose` owns its own session (`needsSession: false`), how `probeCpuHistory()`'s `0x81`
maps onto the existing capability enum, the wave/plan decomposition, and the mechanical form
TIME-03's honesty assertion takes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own artifacts
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md` — routes, pitfalls, wire layouts, Wave 0 gap list, Validation Architecture
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-PATTERNS.md` — analog files, registration seams, exact line numbers
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md` — per-task verification map and manual-only live proofs

### Protocol and project constraints
- `CLAUDE.md` — the Constraints section is normative and hard-won
- `docs/phase0-binmon-findings.md` — settled binary-monitor protocol reference. **§1's frame-counter stopwatch fallback is superseded by this phase** (it collides with the D-11 trace-hazard guard) and a plan marks it so.
- `docs/stock-vice-parity.md` — where D-03's missing-verdict divergence is recorded

### Dependency
- `.planning/phases/05-skill-critical-derived-tools/05-VERIFICATION.md` — what Phase 5 shipped; its eight derived tools are the direct template

</canonical_refs>

<specifics>
## Specific Ideas

- **The blocking prerequisite is a real bug, empirically confirmed.** `probeCpuHistory()` sends
  `CPUHISTORY_GET` with `count=0`; real VICE rejects that with `InvalidParameter` (0x81), which
  the function does not handle, so it throws and fails the entire stock connect handshake on any
  real VICE ≥ 3.10 build. Captured live during research; the response is a committed regression
  fixture.
- **`rewriteArguments()` is at `vice-proxy.ts:2889`**, not the `2773` CLAUDE.md cites. The
  reference drifted; a plan corrects it, because that constraint text is what future work reads.
- **Do not port `runCycleBracket()`** (`vice-proxy.ts:1101-1113`). It ping-polls while running,
  which stock cannot do — every inbound byte halts the machine. The stock liveness bracket is
  snapshot → resume → bounded real wall-clock wait with zero socket traffic → snapshot → compare.
- **Bounding the diagnosis is the point, not a detail.** The state being detected — a second
  client on a single-client monitor — presents as an indefinite hang with no reply and no EOF. A
  diagnostician that hangs while diagnosing a hang is the defect.

</specifics>

<deferred>
## Deferred Ideas

Explicitly out of this phase, per the scope fence given to the planner:

- Phase 8's work: `BACK-05`'s runtime capability error, the `SKILL-01` sweep across *all* skills,
  `DIST-*` install documentation, the manifest-derived support table. `vice-wedge-triage/SKILL.md`
  is touched here only as far as criterion 4 requires.
- Cut Phase 6's `GAIN-01`..`GAIN-09`: CPU-history *tracing*, drive-CPU debugging, raster-precise
  conditions, exact palette, general resource get/set UX. This phase uses `CPUHISTORY_GET` solely
  as a cycle-counter read.
- `vice_disk_detach` — dropped from this phase by the roadmap.
- Screenshots in the evidence record — `SHOT-*` was cut.

</deferred>

---

*Phase: 07-cycle-timing-and-wedge-triage*
*Context recorded 2026-08-18 during /gsd-plan-phase 7*
