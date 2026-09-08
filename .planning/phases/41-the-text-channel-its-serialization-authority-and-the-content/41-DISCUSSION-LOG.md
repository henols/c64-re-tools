# Phase 41: The Text Channel, Its Serialization Authority, and the Contention Verdict - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-08
**Phase:** 41-The Text Channel, Its Serialization Authority, and the Contention Verdict
**Areas discussed:** Text tool surface, Mutex scope & waiting, Contention's report, Socket lifecycle, Todo cross-reference

All four offered gray areas were selected for discussion (`multiSelect`, none
declined). Sixteen questions asked across five turns' worth of areas; the owner
answered every one. One answer was free text rather than an offered option.

---

## Text tool surface

### Q1 — What reaches the text channel from the MCP tool surface in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlisted verbs only *(recommended)* | One typed tool per capability, no free-text command field. Deny-by-default MCP guidance; matches `host_tool`'s per-capability ids and its on-the-record rejection of a generic run-command op | ✓ |
| One raw command tool | A single `vice_monitor_command` taking an arbitrary command string. Cheapest, unblocks every later phase — but is the generic unauthenticated remote-command seam `host_tool` refused, over a channel that can write host files | |
| Internal seam, no new MCP tool | `text-protocol.ts` ships and is exercised by tests only; nothing reaches `tools/list` until Phase 42 | |

**User's choice:** Allowlisted verbs only.
**Notes:** Research presented alongside the question — MCP guidance is
deny-by-default with an explicit allowlist of names *and* parameter constraints;
real shell-MCP implementations default to a narrow read-only allowlist requiring
explicit opt-in for unrestricted mode; argv-shaped execution over string
interpretation. The project's own launcher already warns the text monitor
"accepts arbitrary monitor commands" while "unauthenticated"
(`broker-launch.mts:370-376`).

### Q2 — The five Phase-42 commands have no parser until Phase 42. Expose them anyway, returning raw text?

| Option | Description | Selected |
|--------|-------------|----------|
| Remedies now, five wait *(recommended)* | Only `device c:` and `warp` reach `tools/list`; the five stay on the internal allowlist, covered by the framing controls, until their owning parser lands | ✓ |
| Expose all seven, raw text now | Most literal reading of criterion 2, gives a live channel immediately — but publishes an output contract the milestone then changes | |
| Remedies + one exemplar | The two remedies plus `memmapshow` alone as the end-to-end proof | |

**User's choice:** Remedies now, five wait.
**Notes:** A tool never ships returning a blob it cannot interpret. Phase 42 is
not blocked — its first fixture batch already exists from Phase 39
(`FIXTURE_COUNT: 12`, both binaries).

### Q3 — How does the `device c:` memspace remedy get applied in normal operation?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit tool + live test *(recommended)* | A typed tool a caller or skill invokes, plus the live test that contaminates `default_memspace` and shows the remedy restoring main-CPU stepping | ✓ |
| Automatic before every stepping op | Cannot ever silently step the wrong CPU — at the cost of a text round trip and a mutex acquisition on the hottest binary path | |
| Automatic on observed contamination | Targeted, no cost on the clean path — but the trigger cannot be built or tested end to end this phase | |

**User's choice:** Explicit tool + live test.
**Notes:** The deciding fact, surfaced in the option text: no shipped tool can
contaminate `default_memspace` today, because drive checkpoints are deferred
past this milestone. Auto-healing would defend a route nothing currently opens.

### Q4 — What does Phase 41 do with the three CLAUDE.md scoping clauses?

Raised because a mid-discussion check of the live file found the clauses
**already present** at `CLAUDE.md:32`, `:36`, `:42` — added 2026-08-27 by the
`/gsd-explore` probe, not by a phase. Criterion 5's clause half was therefore
already textually satisfied, which changed what remained to decide.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-anchor to phase evidence *(recommended)* | Re-cite `device c:` and `warp on` to this phase's own live evidence; `chis` gains Phase 39's citation beside the probe's | ✓ |
| Leave all three as written | They are literally true and correctly scoped; declare the clause half already-done on the record | |
| Re-anchor `device c:` only | Only the clause this phase's own test genuinely exercises | |

**User's choice:** Re-anchor to phase evidence.
**Notes:** Phase 39 independently re-confirmed only the `chis` one
(`FIXTURE_UNSUPPORTED: none`); `device c:` and `warp on` rest on the exploration
probe alone, and an exploration probe is not a phase's evidence discipline.

---

## Mutex scope & waiting

### Q1 — What unit does the mutex protect?

| Option | Description | Selected |
|--------|-------------|----------|
| Holdable critical section *(recommended)* | Acquired per logical operation, spans many wire commands, so resume→wait→observe holds it end to end | ✓ |
| Per-wire-command lock | Simplest, deadlock-free — but a text command can land between the resume and the checkpoint hit | |
| Per-tool-call lock at `withStockSession()` | Cheap, the wrapper already exists — but the text channel needs a second seam and derived tools sit outside it | |

**User's choice:** Holdable critical section.
**Notes:** Research presented alongside — FIFO queue is the fairness answer;
Node's single thread is not protection because any `await` inside a critical
section spans event-loop turns; `Promise.race` on `acquire()` is the standard
fail-fast timeout. The load-bearing project fact: Phase 39 measured that a text
command *halts* the machine, so a per-command lock preserves the resume count
while destroying what it protects.

### Q2 — A checkpoint wait can hold the lock for tens of seconds. A text command arrives. What happens?

| Option | Description | Selected |
|--------|-------------|----------|
| FIFO queue, bounded wait, named refusal *(recommended)* | Arrival order with a timeout; on expiry refuse by name, naming the holder and hold duration — never a generic timeout | ✓ |
| Refuse immediately if held | Never blocks, trivially starvation-free — but callers get refused unpredictably and must build their own retry | |
| Queue with no timeout | No spurious refusals — but a hung holder converts every queued caller into an indefinite hang, the exact signature criterion 4 must not misread | |

**User's choice:** FIFO queue, bounded wait, named refusal.
**Notes:** `POLL_WINDOWS_MS` runs 3s → 28s, so the bound must exceed a
legitimate wait. `monitor_claim`'s `monitor_owned` refusal is the precedent, and
its own comment — never suggest the emulator itself has stopped answering — is
binding on the wording.

### Q3 — Where does the mutex live?

| Option | Description | Selected |
|--------|-------------|----------|
| Own module, its own seam *(recommended)* | A new `channel-lock.ts` owning the primitive, queue, holder record and refusal text; imported by both channels | ✓ |
| Inside `stock-dispatch.ts` | No new file or import edge — but that file's header already declares it the ONE place the tool surface is dispatched | |
| Inside `text-protocol.ts` | Fewest files — but inverts the dependency so the binary path imports the newcomer | |

**User's choice:** Own module, its own seam.
**Notes:** Single-seam-per-concern. The holder record living here is also what
makes it readable by `vice_diagnose` for criterion 4's evidence.

### Q4 — Where does the line fall between unit and live testing?

| Option | Description | Selected |
|--------|-------------|----------|
| Unit the primitive, live the interleaving *(recommended)* | FIFO order, timeout, release-on-throw and holder record unit-tested with no emulator; cross-channel visibility and mid-wait interleaving live | ✓ |
| Live-only, follow the vice-sync precedent | Consistent with the existing rule as written — but leaves the queue and its timeout covered only by tests `test:automated` skips | |
| Unit-only plus a planted interleaving | Fast and runs in CI — but a stub proves nothing about a real resume count, which is the existing exemption's own reasoning | |

**User's choice:** Unit the primitive, live the interleaving.
**Notes:** Respects `CLAUDE.md`'s deliberate non-unit-testing of the
checkpoint-wait functions without letting it excuse an untested lock — a FIFO
queue and its timeout have nothing to do with emulator timing.

---

## Contention's report

Framed by two findings surfaced during the scout: `STOCK_DIAGNOSE_VERDICTS` is
`Object.freeze`d at exactly five by `D-03` with an explicit never-add comment and
a test asserting the list verbatim; and criterion 4's own wording splits the
deliverable — `vice_diagnose` gains the **evidence**, `vice-wedge-triage` gains
the **verdict**.

### Q1 — How is contention reported?

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence field + skill verdict *(recommended)* | Always-present evidence field on the `jamObserved` model, cutting across verdicts; the frozen five and its test untouched; the skill's table gains a contention row | ✓ |
| Sixth verdict `contended` | Most legible to a caller — but re-opens a decision closed with an explicit never-add comment and diverges the backends further | |
| Widen `monitor_held_elsewhere` | No enum change, and its "never recycle" response is already correct — but conflates two causes with different remedies | |
| Ninth unavailable reason class | Honest that no verdict was established — but reports UNKNOWN for a positively-known healthy state | |

**User's choice:** Evidence field + skill verdict.
**Notes:** `monitor_held_elsewhere` was noted as semantically adjacent — its
skill row already says "Never a reason to recycle" — but it means *a different
client* holds the binary slot, not *your own other channel*.

### Q2 — What does "reproduced live" at the skill's confidence discipline mean here?

| Option | Description | Selected |
|--------|-------------|----------|
| Live on both binaries, HIGH *(recommended)* | Reproduce on stock 3.9 and fork 3.10 the way `monitor_held_elsewhere` and `wedged` were; the table's HIGH rows are all two-binary | |
| Live on stock 3.9 only, MEDIUM | Prove it where it ships and record MEDIUM with the single-binary basis named | ✓ |
| Live on stock, plus a unit control | One live reproduction plus a unit test, grades recorded separately | |

**User's choice:** Live on stock 3.9 only, MEDIUM — **against the
recommendation.**
**Notes:** The owner chose the grade that matches what would actually be
measured over the one that matches the neighbouring rows. Recorded in CONTEXT.md
as a standing preference, and as an explicit instruction not to enter the row as
HIGH or imply a two-binary basis.

### Q3 — A contended instance produces exactly the `wedged` signature. Where does the guard live?

| Option | Description | Selected |
|--------|-------------|----------|
| In the code: never say wedged while contended *(recommended)* | `vice_diagnose` checks the holder record before it can reach `wedged`, making it structurally unreachable in that state | ✓ |
| In the skill: a precondition on the wedged row | Exactly the `jamObserved` treatment, and the one precedent this codebase has for a cross-cutting evidence flag | |
| Both: code guard plus skill row | Belt and braces — at the cost of the two drifting apart | |

**User's choice:** In the code.
**Notes:** A guard in prose is advice; a guard in code is a guarantee, and the
failure mode is destroying a healthy instance. This is a deliberate departure
from the `jamObserved` precedent, flagged in CONTEXT.md's discretion notes so a
later reader does not "fix" the asymmetry.

### Q4 — What verdict does `vice_diagnose` return instead, while contended?

| Option | Description | Selected |
|--------|-------------|----------|
| `live`, carrying the contention evidence *(recommended)* | The instance is healthy and responsive; the evidence explains the zero bracket. Parallel to how `jamObserved` already qualifies `live` | ✓ |
| `monitor_held_elsewhere` + evidence | Zero new response semantics — but that verdict's manifest text says "a different client", which would be false | |
| `diagnosis_unavailable`, new reason class | Maximally honest the bracket measured nothing — but reports UNKNOWN for a known healthy state | |

**User's choice:** `live`, carrying the contention evidence.
**Notes:** The manifest already tells readers a `live` verdict can be a false
negative on liveness, and `machinePaused` is never false for any verdict that
was reached — so `live` has never meant "advancing".

---

## Socket lifecycle

### Q1 — When does the text socket get opened?

| Option | Description | Selected |
|--------|-------------|----------|
| Eagerly at `stockConnect()`, held for the session *(recommended)* | What the `go` verdict was won to permit; Phase 39 measured it costs nothing idle and the port binds instantly | ✓ |
| Lazily on first text command | Nothing spent on sessions that never touch the channel — but the first call pays a dial, and a dial failure surfaces inside an unrelated tool call | |
| Per-command connect and close | Never holds a single-client port — but throws away the session-lifetime coexistence the verdict was won to allow | |

**User's choice:** Eagerly at `stockConnect()`, held for the session.
**Notes:** With the socket already open, a contention diagnosis has a real
holder to name rather than a dial to attempt mid-triage.

### Q2 — Claimed through the broker, or just dialed?

| Option | Description | Selected |
|--------|-------------|----------|
| Claimed, `channel: "text"` *(recommended)* | A second MCP process is refused by name on a working control socket instead of vanishing into `accepted-then-silent` | ✓ |
| Dial only, no claim | Literal reading of "bookkeeping, never enforcement" — but leaves a second client with no answer, measured indistinguishable from a wedge | |
| Dial, record for status only | Observable after the fact — but a second client still gets silence | |

**User's choice:** Claimed, `channel: "text"`.
**Notes:** Phase 39 fact #5 demands explicit policy precisely because the wire
gives nothing. Distinction recorded in CONTEXT.md: what is enforced is
one-text-client-per-instance; cross-channel serialization stays the in-process
mutex's job, as the ROADMAP requires.

### Q3 — Which broker responses carry the text port?

| Option | Description | Selected |
|--------|-------------|----------|
| `grant` + `HeldLease` *(recommended)* | Exactly what the claim-and-dial flow needs and nothing more, matching criterion 1's "no more weight than it deserves" | ✓ |
| `grant` + `status` + `HeldLease` | Broker status would show the whole picture of an instance | |
| `grant` only | Narrowest — but every consumer re-plumbs a value `adoptGrant()` already had | |

**User's choice:** `grant` + `HeldLease`.

### Q4 — What happens when a caller invokes a text tool on an instance with no text port?

Asked because `acquirePortAndLaunch()` deliberately degrades — a failed
second-port allocation launches without `-remotemonitor` rather than failing the
acquire.

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse by name at call time *(recommended)* | The standing detect-then-refuse-by-name pattern; leaves the degrade path as it is | |
| Fail the acquire instead of degrading | No stock instance ever lacks a text port, no refusal path needed | |
| Lazily relaunch to obtain one | Self-healing — but a relaunch destroys all emulation state | |

**User's choice:** **Free text, not an offered option** — *"it shuld not be
possible, vice must be started witht the text channel"*.
**Notes:** Stronger than option 2's framing: the text channel is **mandatory**
on a stock launch. The degrade path is removed, so the state the refusal would
have handled is designed out rather than handled. Recorded as `D-16` and rated
one-way — it converts a survivable degradation into a hard acquire failure, and
every caller and test that tolerated a portless stock instance changes with it.

### Q5 — Does "must be started with the text channel" bind the fork backend too?

Follow-up, asked because the answer changes what the planner builds.

| Option | Description | Selected |
|--------|-------------|----------|
| Stock only; fork unchanged *(recommended)* | Mandatory on every stock launch; the fork keeps launching with no `-remotemonitor`, honouring `D-07`'s frozen v0.1.x list | ✓ |
| Both backends | One invariant with no backend branch — but changes fork launch argv, and the fork advertises no text tools to use it | |

**User's choice:** Stock only; fork unchanged.

---

## Todo cross-reference

Seven pending todos keyword-matched Phase 41 via `todo.match-phase 41`.

### Q1 — Which fold into scope? *(multiSelect)*

| Option | Description | Selected |
|--------|-------------|----------|
| None — note them as reviewed *(recommended)* | Both adjacent ones are separate capabilities; the BACK-05 one is already honoured as measurement discipline | |
| Reap vicerc scratch dirs | This phase touches launch and the recycle decision path | |
| Remove pre-warm | The mandatory-text-port change already reopens `acquirePortAndLaunch()` | ✓ |

**User's choice:** Remove pre-warm.
**Notes:** The synergy is real — the warm-floor call site is a *second* launch
call site that would otherwise also need the mandatory-text-port change, and the
todo shows it is the one that is structurally useless.

### Q2 — The pre-warm todo's own unanswered open question: latency or grant certainty?

| Option | Description | Selected |
|--------|-------------|----------|
| Neither — just remove it *(recommended)* | Delete the floor, launch strictly on demand; first-cold-launch latency accepted | ✓ |
| Latency — keep warming, per profile | The todo itself calls this "a different todo"; would grow the phase by a capability | |
| Grant certainty — keep it as-is | Leave the mechanism alone and unfold the todo | |

**User's choice:** Neither — just remove it.
**Notes:** Settles a question the todo explicitly recorded as open. The measured
basis is the todo's own: `profileEligible()` compares `warp`/`headless`
`=== true` on both sides while the warm call site passes no `profile:` at all,
so every spare is `{}` and any warp request cold-launches anyway. Four
`broker-e2e.test.ts` fixtures already run with the floor at `0`, so no-warm is
an already-exercised configuration.

---

## Claude's Discretion

The owner answered every question put to them; nothing was deferred with "you
decide". The following were never put to them and are Claude's discretion,
recorded in CONTEXT.md:

- Plan decomposition and wave structure across the four criteria.
- Module and symbol naming (`channel-lock.ts` indicative; `text-protocol.ts`
  fixed by the ROADMAP's Phase 42 note).
- `D-06`'s exact timeout bound, subject to exceeding a legitimate
  `POLL_WINDOWS_MS` wait.
- The evidence field's name and shape, subject to `jamObserved`'s always-present
  discipline.
- Whether the text channel gets its own reconnect/identity story, and how the
  unsolicited banner drain is implemented without racing a genuine reply.
- The two remedy tools' names and argument shapes.
- Evidence file naming and layout.

Three flagged for a second look before the first plan is committed: `D-16`'s
blast radius (the one one-way decision), `D-10`'s deliberate departure from the
`jamObserved` precedent, and `D-05`'s 28-second critical section making `D-06`'s
bound delicate.

## Deferred Ideas

Nothing proposed during the discussion grew the phase. Adjacent capabilities
named and held out:

- Warming per profile instead of removing the floor — the folded todo's own
  "different todo".
- Routing `vice_cycles_stopwatch` through the text `stopwatch` command.
- Automatic `device c:` on observed drive-checkpoint contamination — blocked
  until drive checkpoints ship.
- Exposing the five parse-target commands as MCP tools — Phase 42.
- Promoting contention to a sixth `vice_diagnose` verdict — still available;
  the additive evidence field does not foreclose it.

Six of the seven todo matches reviewed and not folded, with reasons, in
CONTEXT.md's `<deferred>` section.
