# Requirements (from PRD-class sources)

**No PRD-class documents were ingested.** The ingest set contained 1 ADR, 1 SPEC,
and 1 DOC. No source in this set defines requirements with acceptance criteria.

Nothing below is a requirement contract. To avoid fabricating acceptance criteria
that no source states, the ADR's plan-of-record is recorded here as **candidate
scope items** (`CAND-*`) for the roadmapper to turn into real requirements with
the user. Acceptance criteria are marked `NOT SPECIFIED` wherever the source does
not state one.

---

## CAND-phase0-derisk-probe

- **source:** `docs/roadmap-stock-vice.md` (Phase 0) + `docs/phase0-binmon-findings.md`
- **description:** De-risk the migration by probing a stock `x64sc -binarymonitor`
  for elapsed cycle count, the pause/continue model, and Display Get format;
  decide the timing fallback.
- **acceptance:** Partially stated. `docs/phase0-binmon-findings.md` states the
  probe must confirm on a real build: connectivity + api version, whether CPU
  history is enabled, that `DISPLAY_GET` works, and async STOPPED/RESUMED demux.
- **status:** Source analysis complete; empirical probe run OUTSTANDING (no VICE
  and no display in this repo's container). See `CON-probe-outstanding`.

## CAND-phase1-binmon-client

- **source:** `docs/roadmap-stock-vice.md` (Phase 1)
- **description:** Build `vice-binmon.ts`: TCP framing, request/response
  correlation, async stopped/resumed events, reconnect — behind the existing
  `call()` seam so the rest of the tree is untouched.
- **acceptance:** Partially stated — "Unit tests for the binary-monitor client
  against recorded/stubbed protocol frames" (Verification section). Must honor all
  `CON-wire-*`, `CON-command-opcode-set`, `CON-error-codes`, `CON-async-event-demux`
  constraints in `constraints.md`.

## CAND-phase2-direct-tools

- **source:** `docs/roadmap-stock-vice.md` (Phase 2)
- **description:** Port group-A tools (1:1 with a binary-monitor command).
- **acceptance:** NOT SPECIFIED.

## CAND-phase3-derived-tools

- **source:** `docs/roadmap-stock-vice.md` (Phase 3)
- **description:** Port group-B tools (client-side derivations), including the
  6502 disassembler and symbol store.
- **acceptance:** NOT SPECIFIED. Note `docs/stock-vice-parity.md` §A.7 states
  disassembly formatting and illegal opcodes will not match VICE byte-for-byte,
  so byte-identical output is explicitly NOT an acceptance bar.

## CAND-phase4-screenshot

- **source:** `docs/roadmap-stock-vice.md` (Phase 4)
- **description:** `DISPLAY_GET` + `PALETTE_GET` → client-side PNG encode.
- **acceptance:** NOT SPECIFIED. Constrained by `CON-display-get-indexed8-only`.

## CAND-phase5-broker-launcher

- **source:** `docs/roadmap-stock-vice.md` (Phase 5)
- **description:** Swap `-mcpserver…` → `-binarymonitor -binarymonitoraddress`,
  adapt the port model, review single-connection concurrency; update tests,
  `tools-manifest.json` (mark degraded tools), `.mcp.json`, README.
- **acceptance:** NOT SPECIFIED.

## CAND-phase6-verify

- **source:** `docs/roadmap-stock-vice.md` (Phase 6 + Verification)
- **description:** Run the suite against stock `x64sc`; parity-check tool outputs
  vs the current custom server on a sample program.
- **acceptance:** Partially stated — "End-to-end: launch stock `x64sc
  -binarymonitor`, drive the MCP tools, diff outputs against the current
  `-mcpserver` behavior for a known program." Note the diff cannot be exact for
  the §A.7 reimplemented tools.

---

## Open scope questions the roadmapper must resolve with the user

These are unstated in every source and cannot be synthesized:

1. Are the group-B/§A gains (`1541 drive-CPU debugging`, `USERPORT_SET`,
   raster-precise checkpoint conditions, full `RESOURCE_GET/SET`) in scope for
   this migration, or deferred? `docs/stock-vice-parity.md` §B proposes them as
   upside; the ADR's phase plan does not include them.
2. Is losing `vice_sid_get_state` acceptable, or is a write-shadowing mitigation
   required? See WARNING W1.
3. What is the degraded-tool policy for `tools-manifest.json` — remove, or keep
   and mark degraded? Phase 5 says "mark degraded tools" but defines no criteria.

---

## Resolutions (user, 2026-08-11)

All three open scope questions above are now **RESOLVED**. Captured during an
aborted `/gsd-new-milestone` run (halted at the `project_exists: false` gate —
see `.planning/notes/milestone-intent-switchable-stock-vice-backend.md`). The
original question text is retained above unchanged.

### Question 1 — stock-only gains: IN SCOPE (all three groups)

The user selected **all** of the group-B gains for the migration milestone, not
just parity:

- **CPU-history tracing** (`CPUHISTORY_GET` 0x86). Carries a hard version gate:
  requires **VICE ≥ 3.10**; Debian trixie/forky/sid and all current Ubuntu ship
  3.9, which lacks the opcode entirely. Must degrade gracefully, detected via
  `VICE_INFO` (0x85) + trial 0x86.
- **1541 drive-CPU debugging** — drive CPUs 8–11 as separate memspaces.
- **Raster-precise checkpoint conditions + `PALETTE_GET` (0x91) + full
  `RESOURCE_GET/SET` (0x51/0x52)** — replacing today's whitelisted
  `machine_config` subset.

Consequence: the milestone is **parity + gains**, not parity-first. Scope is
materially larger than `docs/roadmap-stock-vice.md`'s 7-phase plan, which
included none of these.

### Question 2 — SID read-back: RESOLVED by switchability, no mitigation needed

Superseded rather than answered. The milestone intent is a **switchable**
backend, so SID read-back work routes to the fork backend, which retains
`vice_sid_get_state`. The client-side write-shadowing mitigation discussed under
WARNING W1 is therefore **not required** and should not be built.

`CON-sid-readback-hard-loss` remains correct and unchanged as a statement about
the *stock* backend. What changes is that the loss is no longer unconditional at
the product level — it is backend-scoped.

### Question 3 — degraded-tool policy: keep all tools, annotate per-backend

Every tool stays in `tools-manifest.json`. Support is annotated **per backend**
rather than with a single backend-agnostic `degraded` flag, and no tool is
removed from the surface.

Rationale: a tool degraded on stock may be fully supported on the fork, so a
per-backend annotation lets the client tell the user which backend restores the
capability. A single flag would lose that information; removing tools would make
the surface change shape between backends.

### Not resolved by the above

- `CON-probe-outstanding` still stands — the empirical probe
  (`.claude/mcp/vice/probe-binmon.mjs`) has never been run against a real build.
- The `CAND-*` items still lack acceptance criteria (5 of 7 have none). These
  resolutions settle *scope*, not acceptance bars.
- Three corrections to `docs/phase0-binmon-findings.md` are outstanding — see
  `.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`.
  That doc is normative by resolution W2, so the errors propagate until fixed.
