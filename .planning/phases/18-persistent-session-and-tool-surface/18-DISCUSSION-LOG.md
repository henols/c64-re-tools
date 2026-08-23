# Phase 18: Persistent Session and Tool Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 18-persistent-session-and-tool-surface
**Areas discussed:** Session lifecycle & keying, Crash-restart visibility, Write serialisation shape, Orphan & lease discipline, D-32 re-decision, How far to widen the surface now, `use_illegal_opcodes` forcing

**Areas offered:** all seven were presented across two multi-select questions; the user selected all seven.

---

## Session lifecycle & keying

### How does a session get opened?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy on first call (Rec) | First `r2000_*` call needing a child spawns it; no new tool, no protocol change. Invisible optimisation — nothing can forget to open one. | ✓ |
| Explicit `r2000_session_open` | Makes the session a thing Phase 19's playbooks reason about, at the cost of a curated tool and a forgot-to-open failure class. | |
| You decide | | |

**User's choice:** Lazy on first call.

### What happens when a call arrives for a different project path?

| Option | Description | Selected |
|--------|-------------|----------|
| Single slot, evict+respawn (Rec) | One session at a time; a different path closes the current child and spawns fresh. Lossless because save-per-mutation already persisted everything. | ✓ |
| Keyed map of sessions | One live child per project path. Free on stdio (FUT-02's blocker is HTTP-only) but promises capability with no measured caller. | |
| Refuse the second path | Loudest, but makes a legitimate two-fixture workflow in Phases 20-22 fail rather than just be slow. | |

**User's choice:** Single slot, evict+respawn.

### Should an idle session close itself?

| Option | Description | Selected |
|--------|-------------|----------|
| No timeout — lives to proxy exit (Rec) | `vice-proxy.ts` is already one process per Claude Code session; a 64K project's footprint is trivial. Avoids the idle-close-vs-crash ambiguity. | ✓ |
| Idle close after N minutes | Frees the child during long non-r2000 stretches; costs a timer and muddies SESS-02's detection. | |
| You decide | | |

**User's choice:** No timeout.

### Should the session be visible to a caller at all?

| Option | Description | Selected |
|--------|-------------|----------|
| Invisible — no session tools (Rec) | Health surfaces only through named errors on ordinary calls. Tool count 17 → 18 from `r2000_read_region` alone at that point in the discussion. | ✓ |
| Add read-only `r2000_session_status` | One diagnostic tool for Phase 19 and wedge triage; costs a curated tool plus pin/doc updates. | |
| Full open/close/status trio | Most explicit; three tools with no demonstrated caller. | |

**User's choice:** Invisible.
**Notes:** The later D-32 decision brought the final count to 19, not 18.

---

## Crash-restart visibility

### The child died between two calls. What does the caller see?

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent respawn, call runs (Rec) | Detected via the continuously-tracked `exit` event, not a broken-pipe write. Lossless; strictly better than SESS-02's floor. | ✓ |
| Respawn, then fail loud | More honest, but puts retry logic in every Phase 19 procedure for an event that loses nothing. | |
| You decide | | |

**User's choice:** Transparent respawn.

### The child died mid-call — possibly between a mutation and its own save.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loud, never auto-retry (Rec) | Named error via existing classes; a call killed in that window may or may not have applied, so auto-retry risks double-applying. | ✓ |
| Retry reads, fail loud on writes | Kinder to query-heavy procedures; two behaviours to document and test. | |
| Retry once, always | Simplest contract; reopens the silent-loss/double-apply class. | |

**User's choice:** Fail loud, never auto-retry.

### How is a wedged-but-alive child detected?

| Option | Description | Selected |
|--------|-------------|----------|
| Passive + existing call timeout (Rec) | A wedge is a call that doesn't answer, caught by the existing 30s timeout. Pitfall 9(2)'s "accepts a connection while blocked" is an HTTP-mode shape; stdio has no accept step to lie. | ✓ |
| Fragile no-retry probe per call | Catches a wedge one round trip earlier, at the cost of a round trip on every call. | |
| Probe only after a suspicious call | Lazy probe to classify wedged-vs-dead; free on the happy path. | |

**User's choice:** Passive + existing call timeout.

### Should restarts be bounded?

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded, then refuse (Rec) | Otherwise a broken project becomes an invisible respawn loop — and the transparent-restart choice above is exactly what would hide it. | ✓ |
| Unlimited restarts | Maximum resilience; a crash loop becomes indistinguishable from slowness. | |
| You decide | | |

**User's choice:** Bounded, then refuse.

---

## Write serialisation shape

### SESS-04's wording vs research §Q1's wording — which wins?

| Option | Description | Selected |
|--------|-------------|----------|
| Coarse mutex; reads fan out at orchestration level (Rec) | One in-flight operation at the seam. SESS-04 satisfied where observable: playbooks fan out read-only subagents and the seam queues them. Likely loses nothing real if the child reads stdin serially. | ✓ |
| Reader-writer lock | Matches SESS-04's wording literally; costs a second concurrency mode and a live measurement to prove the gain. | |
| Coarse mutex now, measure later | Mutex plus a Phase 19 measurement task before any upgrade. | |

**User's choice:** Coarse mutex.
**Notes:** The measurement idea from the third option was carried forward anyway as D18-16 (deferred, not rejected) so the reader-writer question stays a decision rather than an omission.

### When the lock is held, what does the second caller experience?

| Option | Description | Selected |
|--------|-------------|----------|
| Queue and wait, bounded (Rec) | FIFO with a bounded wait that becomes a named error. An LLM-driven procedure handling "busy, try again" correctly isn't reliable; waiting is. | ✓ |
| Refuse while busy | Loudest and simplest; makes a legitimate fan-out fail rather than be slow. | |
| Queue, unbounded | Never fails on contention; a stuck holder reads as the hang SESS-02 exists to eliminate. | |

**User's choice:** Queue and wait, bounded.

### What is the atomic unit the lock protects?

| Option | Description | Selected |
|--------|-------------|----------|
| The whole mutate+save pair (Rec) | No second mutation interleaves between a change and its flush; `r2000_batch_execute`'s whole batch is likewise one unit. | ✓ |
| Per tool call | Simpler; reopens the exact window Phase 9's incident lived in, in its harder-to-notice single-owner form. | |
| You decide | | |

**User's choice:** The whole mutate+save pair.

### How should criterion 4 be proven?

| Option | Description | Selected |
|--------|-------------|----------|
| Planted-violation lost-update test (Rec) | Two concurrent mutations at the same address, both must land; then remove the lock and prove the test goes red. | ✓ |
| Green-path assertion only | Cheaper; this project has been taught the vacuous-guard lesson repeatedly. | |
| You decide | | |

**User's choice:** Planted-violation lost-update test.

---

## Orphan & lease discipline

### Which broker patterns actually have a problem to solve here?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-owner guard + verified kill; no lease file (Rec) | Port Rule A11's check-and-set and the verified-kill discipline. Skip the lease file — the broker is a separate long-lived host process with clients across sessions; here the child is a direct child of the proxy, single-slot and lazily opened. | ✓ |
| Full broker pattern including lease file | Maximum consistency, no judgment call; disk state nothing reads and a control plane with no second process to talk to. | |
| Exit hook only | Smallest; drops the one guard whose founding incident is about exactly this spawn path. | |

**User's choice:** Single-owner guard + verified kill; no lease file.

### How does a kill target the child?

| Option | Description | Selected |
|--------|-------------|----------|
| Only through the retained handle (Rec) | Never store or signal a bare PID, making the PID+argv identity check structurally unnecessary rather than skipped. | ✓ |
| PID + argv identity-verified kill | Port the broker's check verbatim; the belt guards a path this design doesn't have. | |
| You decide | | |

**User's choice:** Only through the retained handle.
**Notes:** This refines the previous answer rather than contradicting it — the "verified kill" is satisfied by construction. Reconciled explicitly in CONTEXT.md as D18-21.

### A child orphaned by a SIGKILLed proxy?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify stdin-EOF exit live, then rely on it (Rec) | It's an assumption about an external binary — measure it against real 0.9.20 rather than assert it (Pitfall 12). If it holds, no sweep needed and the reason is on record. | ✓ |
| Startup sweep for stale children | Robust regardless of EOF behaviour; reaches outside this process's own children, including another worktree's live session. | |
| Accept orphans, document it | Cheapest; leaves an unbounded-lifetime process behind a crash. | |

**User's choice:** Verify stdin-EOF exit live, then rely on it.

---

## D-32 re-decision

### Which route for `r2000_get_address_details`?

| Option | Description | Selected |
|--------|-------------|----------|
| Compose it client-side from curated reads (Rec) | Build it from the four curated reads and never call upstream's defective tool. The `u16` defect becomes unreachable by construction; follows the Phase 4 client-side derived-tool precedent. | ✓ |
| Detect the 64K case, fall back | Research's own suggestion; keeps a defective dependency on the happy path and needs the wrap condition detected correctly. | |
| Curate with a documented caveat | Smallest change; hands an LLM a tool that lies on exactly the project shape this milestone works on. | |
| Keep refusing, document the route | Honest and cheap; pushes the composition into every absorbed procedure. | |

**User's choice:** Compose it client-side.

### Does it ever call upstream's tool?

| Option | Description | Selected |
|--------|-------------|----------|
| Never — one code path (Rec) | No wrap-detection heuristic, no divergence between small and 64K projects, one path to write and test. | ✓ |
| Pass through when the project is small | Keeps upstream's answer where it works; two paths, two output shapes, a threshold to defend. | |
| You decide | | |

**User's choice:** Never — one code path.

### What does the tool get called?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `r2000_get_address_details` (Rec) | The name upstream uses and Phase 19's procedures will reach for; client-composed nature documented, not encoded in the name. | ✓ |
| A distinct name | Signals it's this repo's composition; costs a rename in every absorbed procedure. | |
| You decide | | |

**User's choice:** Keep `r2000_get_address_details`.

### How is the D-32 supersession recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Dated decision + named reversal trigger (Rec) | An upstream fix to issue #42 retires the composition. Same shape as `FORK-01`; pinned by a guard. | ✓ |
| Dated decision, no reversal trigger | Lighter; this is the second milestone the item has been carried, and a trigger is what stops a third. | |
| You decide | | |

**User's choice:** Dated decision + named reversal trigger.

---

## How far to widen the surface now

### Curate the cursor trio now?

| Option | Description | Selected |
|--------|-------------|----------|
| Hold for a demonstrated caller (Rec) | `r2000_read_region` already answers "read this routine" by range, making the trio largely redundant. Phase 19's absorption diff is where a real need would show, and adding then is additive not a rewrite. | ✓ |
| Curate all three now | Honours the ROADMAP's "aligned to what every later phase needs" literally; three tools with no measured caller. | |
| You decide | | |

**User's choice:** Hold for a demonstrated caller.

### Expose both `view` values?

| Option | Description | Selected |
|--------|-------------|----------|
| Both (Rec) | One enum parameter, both supported upstream. `hexdump` is what Phase 20/21 data-table work wants; `disasm` is what routine documentation wants. | ✓ |
| `disasm` only | Narrowest for this phase's demonstrated need. | |
| You decide | | |

**User's choice:** Both.

### Should the range be capped?

| Option | Description | Selected |
|--------|-------------|----------|
| Documented cap, named error over it (Rec) | A full-64K disasm view in an LLM's context is a real hazard; message embeds offending size and valid range per this repo's convention. | ✓ |
| Pass through uncapped | No threshold to defend; a foot-gun that grows with the fixture. | |
| Cap with an explicit override | Flexible; adds a parameter and a deliberate way to shoot yourself. | |

**User's choice:** Documented cap, named error over it.

### How is the pin/doc drift prevented?

| Option | Description | Selected |
|--------|-------------|----------|
| Same plan, existing guards (Rec) | Update the count pin and regenerate `docs/tool-support.md` in the same plan, leaning on the v0.2.0 byte-identity drift guard plus `r2000-verb-coverage.test.ts`. | ✓ |
| Add a dedicated drift test | More explicit; overlaps guards that already cover it. | |
| You decide | | |

**User's choice:** Same plan, existing guards.

---

## `use_illegal_opcodes` forcing

### Mechanism, given Pitfall 9(6)'s silent-revert hazard?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit before spawn, in the open path (Rec) | Read, force on disk, then spawn — exactly the window Pitfall 9(6) declares safe. The "never edit while a session owns it" rule then holds absolutely. | ✓ |
| Refuse to open a project lacking it | No silent mutation of a user's file; makes every older project a manual repair step mid-pipeline. | |
| Force at open, refuse if unwritable | Combines both. | |

**User's choice:** Edit before spawn, in the open path.
**Notes:** The unreadable/unparseable case was folded in as a named refusal anyway (D18-32), taking the useful half of option three.

### Where does the forcing logic live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract `r2000-project.ts`'s existing forcing (Rec) | One shared "ensure settings" function both the synthesiser and the session-open path call — the one-authoritative-place convention. | ✓ |
| New logic in `r2000-session.ts` | Fewer files touched; creates the second, drifting copy of a settings policy. | |
| You decide | | |

**User's choice:** Extract `r2000-project.ts`'s existing forcing.

### What happens to `system` at session open?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify and refuse on mismatch (Rec) | Force `use_illegal_opcodes` silently — it only widens what decodes correctly. Silently rewriting `system` could reinterpret every block classification in an annotated project, so a mismatch is a named refusal. | ✓ |
| Force both silently | One rule; a silent rewrite that could reinterpret an existing project. | |
| Only touch `use_illegal_opcodes` | Narrowest; a drifted `system` goes unnoticed until something reads wrong. | |

**User's choice:** Verify and refuse on mismatch.

### How is it proven?

| Option | Description | Selected |
|--------|-------------|----------|
| Planted-violation round trip (Rec) | Open a project with the flag false; assert true after open, assert a later save does not revert it, then remove the forcing and prove it goes red. The no-revert half is what actually tests Pitfall 9(6). | ✓ |
| Assert the value after open | Covers the edit, not the silent-revert hazard that has a recorded incident behind it. | |
| You decide | | |

**User's choice:** Planted-violation round trip.

---

## Closing check

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Write CONTEXT.md and hand off to plan-phase. | ✓ |
| Explore more gray areas | Three offered: the D-17/D-18 reversal record's required contents; live-versus-stub verification scope; whether `withR2000Session()` is retired. | |

**User's choice:** I'm ready for context.

## Claude's Discretion

The user selected a recommended option on every question — nothing was answered
"you decide" explicitly. The three declined gray areas were resolved by Claude
and recorded in CONTEXT.md so the planner does not re-open them:

- **Live-versus-stub verification** — default to live testing against the real
  installed `regenerator2000` 0.9.20 for anything that is a claim about the
  external binary (stdin-EOF exit, the session-reuse spawn transcript, the
  save-survives-SIGKILL round trip). The stub harness stays appropriate for
  protocol-shape and error-classification tests.
- **`withR2000Session()`** — not retired; it stays for CLI-verb callers, with
  the long-lived primitive added beside it.
- **Reversal-record contents** — enumerated against the Architecture Change
  Procedure's six steps rather than left to the plan's judgment.

Left to the planner with the constraint named: the restart bound, the
contention-queue timeout, the `read_region` cap value (all must be named
constants, never magic numbers at a call site), and which of
`r2000-session.ts` / the extended `r2000-mcp-client.ts` owns the mutex.

## Deferred Ideas

- Reader-writer lock for the session — deferred pending a Phase 19 measurement.
- A caller-visible `r2000_session_status` tool — no demonstrated caller yet.
- The cursor trio — Phase 19's absorption diff is where a caller would appear.
- A keyed map of concurrent multi-project sessions — already FUT-02.
- A startup sweep for stale stdio children — only if the EOF measurement fails.
- An upstream patch for regenerator2000 issue #42 — recorded as this project's
  reversal trigger instead.
- `r2000_export_source` / `r2000_hazard_report` as MCP tools — research names
  this an anti-pattern; the CLI-verb route is Phase 21's shape.
