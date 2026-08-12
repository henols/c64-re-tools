# Ingest Synthesis

Produced by `gsd-doc-synthesizer`. Mode: `new`. Precedence: ADR > SPEC > PRD > DOC,
with 2 user-approved per-scope overrides (2026-08-11). This is the entry point for
`gsd-roadmapper`.

---

## Subject

Migrating `c64-re-tools` off a custom, non-upstream `x64sc -mcpserver` build onto
**stock upstream VICE** driven through its binary monitor, while preserving the
existing 63-tool stdio MCP surface.

## Doc counts by type

- ADR: 1 — `docs/roadmap-stock-vice.md`
- SPEC: 1 — `docs/phase0-binmon-findings.md`
- PRD: 0
- DOC: 1 — `docs/stock-vice-parity.md`
- UNKNOWN: 0

All three classified at `medium` confidence on content signals alone (no
frontmatter, no filename-convention signal). See INFO I6 in the conflicts report.

## Cross-ref graph

1 doc-to-doc edge: `stock-vice-parity.md → roadmap-stock-vice.md`. Max depth 1.
**Cycle detection: PASS.** All remaining cross-refs point at source files outside
the ingest set (`vice.ts`, `vice-proxy.ts`, `vice-sync.ts`, `broker-launch.mts`,
`vice-broker.mts`, `probe-binmon.mjs`, `monitor_binary.c`, `mon_register.c`,
`.mcp.json`, `tools-manifest.json`, `d64-parse.mjs`, README.md).

## Precedence overrides in force

Two per-scope overrides, approved by the user 2026-08-11. Both are scoped to their
subject only; default ordering applies elsewhere.

- **Chip-state read-back** — `docs/stock-vice-parity.md` (DOC) is authoritative
  over the ADR. SID read-back is a hard loss; VIC-II/CIA internal state is partial.
- **Binary-monitor wire format** — `docs/phase0-binmon-findings.md` (SPEC) is
  normative over the ADR's paraphrase.

## Decisions

11 extracted → `.planning/intel/decisions.md`

**Locked: 0.** The sole ADR-class source is `Status: proposed`, so no decision in
this ingest is locked and none can block downstream revision.

Core: `DEC-stock-vice-migration` · `DEC-preserve-mcp-surface` ·
`DEC-server-logic-moves-client-side` · `DEC-tool-triage-abc` (amended, W1) ·
`DEC-ship-6502-disassembler` · `DEC-client-side-png-screenshots` ·
`DEC-d64-parsed-client-side` · `DEC-new-binmon-client-module` ·
`DEC-broker-flag-and-concurrency-review` · `DEC-phased-delivery-plan` (amended,
W2) · `DEC-doability-assessment`

Superseded ADR text is retained inline under "W1 amendment" and "W2 amendment"
rather than deleted.

## Requirements

**0 requirements.** No PRD-class source was ingested; no document in the set
defines acceptance criteria. To avoid fabricating them, the ADR's phase plan is
recorded as 7 candidate scope items (`CAND-*`) in
`.planning/intel/requirements.md`, with `NOT SPECIFIED` marked wherever no source
states an acceptance bar (5 of 7 have no acceptance criteria at all).

That file also lists 3 open scope questions the roadmapper must resolve with the
user before requirements can be written. Question 2 (whether losing
`vice_sid_get_state` is acceptable) is now partly answered by the W1 resolution —
the loss is confirmed unavoidable; what remains is whether to build the optional
write-shadowing mitigation.

## Constraints

14 extracted → `.planning/intel/constraints.md`

- protocol: 7 (request header, response header, no monotonic cycle register,
  stopwatch via CPU history, no run-for-N-cycles, async event demux, no pause-now)
- api-contract: 3 (command opcode set, error codes, DISPLAY_GET INDEXED8-only)
- schema: 1 (`CPUHISTORY_GET` request/response)
- nfr: 3 (SID read-back hard loss, chip internal state partial, outstanding probe)

Status flags: `CON-wire-request-header` and `CON-wire-response-header` are
**SETTLED/normative** (W2). `CON-sid-readback-hard-loss` and
`CON-chip-internal-state-partial` are **SETTLED** (W1).
`CON-stopwatch-via-cpuhistory` is **PROVISIONAL** (CPU history is a compile-time
VICE feature) and `CON-probe-outstanding` is **OUTSTANDING** (the probe has never
been run — no VICE, no display in this container). The probe result decides the
timing-tool design before Phase-1 client code lands.

## Context topics

4 → `.planning/intel/context.md`
net parity assessment · capability losses (7 ranked, §A.1 and §A.6 now
authoritative) · capability gains (8) · MCP value-add to port.

## Conflicts

**0 blockers · 0 warnings · 2 user-resolved · 6 auto-resolved**

Detail: `.planning/INGEST-CONFLICTS.md`

- **W1** — RESOLVED 2026-08-11. SID / chip-state read-back: DOC authoritative.
  SID read-back is a hard loss; VIC-II/CIA internal state is partial; client-side
  write-shadowing is an optional mitigation, not parity.
- **W2** — RESOLVED 2026-08-11. Binary-monitor wire format: SPEC normative. The
  11-byte request header byte-offset table stands.

## Downstream status

**READY — cleared for routing to `gsd-roadmapper`.** No blockers, no open
warnings. Both precedence questions are settled and applied across
`decisions.md`, `constraints.md`, and `context.md`.

Two non-blocking carries for the roadmapper:
1. `CON-probe-outstanding` — the empirical probe gates the timing-tool design, not
   the roadmap itself. Plan Phase 0's probe run as real work.
2. `requirements.md` has 0 requirements and 3 open scope questions. Requirements
   must be elicited with the user; nothing in this ingest supplies acceptance
   criteria.

## Files

- `.planning/intel/decisions.md`
- `.planning/intel/requirements.md`
- `.planning/intel/constraints.md`
- `.planning/intel/context.md`
- `.planning/INGEST-CONFLICTS.md`

Background only, not ingested: `.planning/codebase/{CONVENTIONS,INTEGRATIONS,STACK}.md`.
