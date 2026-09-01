# Phase 18: Persistent Session and Tool Surface - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers **the enabler**: one `analyser --mcp-server-stdio`
child process stays alive across many `anno_*` tool calls inside the
already-running `vice-proxy.ts` process, instead of the current
spawn-load-mutate-save-exit lifecycle per call — plus the two tool-surface
alignments (`anno_read_region`, and `anno_get_address_details`'s D-32
refusal) that every later v0.5.0 phase's absorbed procedures need.

**Requirements:** SESS-01, SESS-02, SESS-03, SESS-04, SURF-01, SURF-02 (6).

**In scope:**
- A new `src/mcp/vice/anno-session.ts` owning the long-lived child.
- `src/mcp/vice/anno-mcp-client.ts` **extended** (not replaced) with a
  long-lived session primitive beside the existing one-shot
  `withAnnoSession()`.
- `runAnnoTool()` (`anno-tools.ts`) rewired through the session, with
  save-per-mutation preserved byte-for-byte.
- The save-discipline planted-violation test (SESS-03) — this phase's own
  go/no-go gate, landed before anything else depends on the session.
- `anno_read_region` curated; `anno_get_address_details` re-decided.
- `spawn-seam.test.ts` fixtures extended for the long-lived path.
- The D-17/D-18 reversal record, per `.planning/ARCHITECTURE.md`'s
  Architecture Change Procedure.

**Out of scope for this phase** (milestone-level boundaries restated so no
plan re-opens them):
- HTTP MCP transport for the session — structurally disqualified (hardcoded
  port 3000, no `--mcp-port`/`--mcp-bind`).
- Concurrent multi-project sessions (FUT-02).
- Write-capable concurrent subagent fan-out as upstream authors it (FUT-03).
- Routing the session through `vice-broker.mts` — the broker exists to cross
  the container/host boundary for `x64sc`; the external analyser is container-side
  and has no such boundary. Reuse its *patterns*, never its code.
- Absorbing upstream's analyze procedures (Phase 19), the coverage instrument
  (Phase 19), decomposition (Phase 20), export/hazards (Phase 21),
  equivalence/modifiability (Phase 22).

</domain>

<decisions>
## Implementation Decisions

Decision IDs below are **phase-local** (`D18-nn`) to avoid colliding with the
project-wide `D-nn` series. Where a decision supersedes a project-wide one,
that is stated explicitly and the plan that implements it must allocate the
next project-wide ID.

### Session placement and lifecycle

- **D18-01:** The session lives **in-proxy** — a new
  `src/mcp/vice/anno-session.ts` holding module-level mutable state, built on
  an extended `anno-mcp-client.ts`. A host-side broker route and a new
  container-side supervisor process were both examined and rejected in
  research (`.planning/research/ARCHITECTURE.md` §Q1). Precedent: `vice.ts`
  already holds mutable module-level transport state for exactly this shape of
  problem. — **Reversibility:** costly — moving the session out of the proxy
  later would change every `anno_*` call path and require a new IPC surface
  and its own wedge-triage story.
- **D18-02:** **No third spawn site.** `anno-mcp-client.ts` remains the sole
  place in this repo that spawns `--mcp-server-stdio` and parses a JSON-RPC
  frame. `anno-session.ts` builds on a new export from it and never spawns
  itself. `spawn-seam.test.ts`'s enumerated site set is therefore
  unchanged in shape — it gains a session-reuse live-transcript fixture
  proving the long-lived path still calls `assertNoViceFlag()` before
  spawning. Never silently widened. — **Reversibility:** one-way — the
  enumerated-site guard is the structural half of the `--vice` invariant's
  dual enforcement; a third site, once merged, would have to be found and
  guarded retroactively rather than prevented.
- **D18-03:** The session opens **lazily, on the first `anno_*` call that
  needs a child.** No `anno_session_open` tool. The session is an invisible
  optimisation: every existing skill and every absorbed procedure works
  unchanged, and nothing can forget to open one. — **Reversibility:**
  reversible.
- **D18-04:** **Single slot, evict-and-respawn.** At most one live session at
  a time. A call whose resolved project path differs from the open session's
  closes the current child and spawns a fresh one against the new path. This
  is lossless *by construction* because save-per-mutation (D18-08) has already
  persisted everything — which is precisely why the session design and the
  save-discipline invariant were designed together. A keyed map of live
  sessions is technically free on stdio (FUT-02's blocker is HTTP-only) but
  promises concurrent multi-project capability with no measured caller and
  multiplies the crash/orphan surface. — **Reversibility:** reversible —
  widening to a keyed map later is additive.
- **D18-05:** **No idle timeout.** The child lives until the proxy process
  exits or the project path changes. `vice-proxy.ts` is already one process
  per Claude Code session and a 64K project's footprint is trivial. Avoids a
  timer, and avoids the "was it idle-closed or did it crash" ambiguity that
  would muddy SESS-02's detection. — **Reversibility:** reversible.
- **D18-06:** **The session is invisible to callers.** No
  `anno_session_open`/`_close`/`_status` tools. Session health surfaces only
  through named errors on ordinary calls. Curated tool count moves 17 → **19**
  (`anno_read_region` + `anno_get_address_details`), not 20+. —
  **Reversibility:** reversible — adding a read-only status tool later is
  additive.
- **D18-07:** The one-shot `withAnnoSession()` contract **stays** for CLI-verb
  callers (`anno-cli.ts`, the enum generator, the memory-map renderer). The
  long-lived primitive is a new export beside it, not a replacement. Its
  header prose ("once per `withAnnoSession()` call", "Never keep a child
  alive between logical operations") becomes false for the module as a whole
  the moment the second primitive lands and **must be corrected in the same
  change** — not left to drift. — **Reversibility:** reversible.

### Save discipline (SESS-03)

- **D18-08:** **Persistence changes process lifetime, not the durability
  contract.** Every mutating `anno_*` call still calls
  `anno_save_project` inside the same session before that tool call resolves
  to its caller, identically to today. `runAnnoTool()`'s existing sequencing
  is preserved **byte-for-byte**; the only thing that changes is what happens
  to the child *after* the save (today it exits; now it stays). The internal
  auto-save stays a **plain** save, never `saveAndVerify()` — an idempotent
  mutation legitimately produces an unchanged hash, and `saveAndVerify()`'s
  contract is "throw when the hash does not change". `saveAndVerify()` remains
  reserved for `anno_save_project` invoked as the outer tool by name. —
  **Reversibility:** one-way — deferring saves "for performance" across
  multiple mutating calls reopens Phase 9's silent-loss class inside a
  single-owner session, where there is no second connection to blame.
- **D18-09:** SESS-03 is proven by a **planted-violation** test, and it is
  this phase's **go/no-go gate — landed before anything else depends on the
  session**, not a checkbox at the end. Three scenarios:
  1. *Green path:* mutate via `runAnnoTool()`; the instant the call resolves,
     `SIGKILL` the child directly, bypassing the graceful-close path entirely;
     reopen (or read `.regen2000proj` straight from disk) and assert the
     mutation is present.
  2. *Non-vacuity:* short-circuit the internal save, re-run scenario 1
     unchanged, assert the test **now fails**. If it still passes, the test
     never exercised the invariant and must be rewritten before it is trusted.
  3. *Mid-window crash:* kill the child between the mutating `tools/call` and
     its own save; assert a named, distinguishable error reaches the caller
     (never a silent success) and the file on disk is **unchanged**, not
     partially written.
  — **Reversibility:** reversible.

### Crash detection and restart (SESS-02)

- **D18-10:** The child's `exit` event is tracked **at all times**, not only
  mid-request. A crash between two calls is detected before the *next* call is
  attempted, never discovered as a broken-pipe write. — **Reversibility:**
  reversible.
- **D18-11:** **Dead between calls → transparent respawn, and the call runs.**
  The dead handle is discarded and the call executes against a fresh child.
  Genuinely invisible, and lossless because of D18-08. This is strictly better
  than SESS-02's floor ("a recoverable error rather than a hang") and keeps
  retry logic out of every Phase 19 absorbed procedure. — **Reversibility:**
  reversible.
- **D18-12:** **Dead mid-call → fail loud, never auto-retry.** Surface a
  named, distinguishable error (the existing `AnnoChildExitError` /
  `AnnoSessionFailedError` classes). A mutating call killed in that window
  may or may not have applied; auto-retry risks double-applying. Applies to
  read-only calls too — one behaviour to document and test, not two. —
  **Reversibility:** costly — relaxing this later means auditing every
  mutating tool for idempotence.
- **D18-13:** **Wedge detection is passive plus the existing call timeout.** A
  wedged child is a call that does not answer, caught by
  `DEFAULT_ANNO_CALL_TIMEOUT_MS` (30s) and turned into a named error that
  also discards the handle. No per-call liveness probe — a probe per call
  reintroduces most of the round-trip cost persistence was bought to remove.
  **Scope note for the planner:** Pitfall 9(2)'s "accepts a connection while
  the event loop is blocked" is an **HTTP-mode** shape; stdio has no accept
  step that can lie. Do not port `vice-probe.ts` on the strength of that
  pitfall alone. — **Reversibility:** reversible.
- **D18-14:** **Restarts are bounded**, then refused with a named error that
  states the crash count. Without a bound, a genuinely broken project or
  binary becomes an invisible respawn loop that burns a whole working session
  looking like slowness — and D18-11's transparent restart is exactly what
  would hide it. Bound value is the planner's call (3 within the working
  session is the assumed default). — **Reversibility:** reversible.

### Concurrency and serialisation (SESS-04, criterion 4)

- **D18-15:** **Coarse mutex at the seam** — exactly one in-flight logical
  operation per session. SESS-04's "concurrent fan-out is restricted to
  read-only queries" and research §Q1's "exactly one in-flight logical
  operation" pull apart on their face; the mutex wins, and SESS-04 is
  satisfied **at the orchestration level**: Phase 19's playbooks may fan out
  read-only subagents, and the seam quietly queues them. Mirrors Rule A11's
  "synchronous check-and-set with no `await` between" applied to a different
  resource. **This is the go/no-go answer Phase 19 inherits** — Phase 19 must
  not copy upstream's 7-way concurrent-subagent orchestration unchanged. —
  **Reversibility:** reversible — a reader-writer upgrade is additive.
- **D18-16:** A reader-writer lock (concurrent reads, exclusive writes) is
  **deferred, not rejected**. It would only pay off if the external analyser's stdio
  handler actually multiplexes requests rather than reading stdin serially —
  which is unmeasured. **Phase 19 carries a task to measure it** before any
  upgrade is considered. Recording the deferral this way keeps it a decision
  rather than an omission. — **Reversibility:** reversible.
- **D18-17:** **Contention is a bounded queue-and-wait.** FIFO, with a bounded
  wait that becomes a named error rather than hanging forever. Refuse-while-
  busy was rejected: an LLM-driven procedure handling a "busy, try again"
  error correctly is not something to rely on, and it would push retry logic
  into every absorbed procedure. The bound is what stops a stuck holder from
  reading as the hang SESS-02 exists to eliminate. — **Reversibility:**
  reversible.
- **D18-18:** **The critical section spans the mutating call *and* its own
  internal `anno_save_project`.** No second mutation can interleave between a
  change and its flush. Per-tool-call locking would leave exactly the window
  Phase 9's incident lived in. `anno_batch_execute`'s entire batch — every
  inner call plus the one trailing save — is likewise **one** unit. —
  **Reversibility:** one-way — narrowing the section later reopens the
  interleaving window this decision exists to close.
- **D18-19:** Criterion 4 is proven by a **planted-violation lost-update
  test**: fire two concurrent mutating calls at the same address through the
  seam and assert both land; then remove the lock and prove the same test goes
  red. Same non-vacuity shape as D18-09 and as
  `spawn-seam.test.ts`'s `--vice` guard. A lock nobody has watched catch
  the bug is not yet a lock. — **Reversibility:** reversible.

### Process ownership and orphans

- **D18-20:** Port the broker's **single-owner acquire guard** (Rule A11,
  synchronous check-and-set with no `await` between — the pattern built after
  the 2026-08-01 triple-launch outage) to the session-open path. Do **not**
  port a persisted identity/lease file: it exists because the broker is a
  separate long-lived *host* process whose clients come and go across Claude
  Code sessions. Here the child is a direct child of the proxy, single-slot
  (D18-04) and lazily opened (D18-03), so there is no cross-process ownership
  question to arbitrate. **Recorded as a decision with that rationale, not an
  omission** — Pitfall 9's warning is against re-deriving lighter versions of
  patterns whose problem exists here. — **Reversibility:** reversible.
- **D18-21:** **Kill only through the retained `ChildProcess` handle.** Never
  store or signal a bare PID. This makes the broker's PID+argv identity check
  *structurally unnecessary rather than skipped*: there is no stored-pid path
  through which a reused PID could be reachable. Same "unreachable by
  construction" idiom as the `--vice` guard's fixed per-verb argv builders.
  **Reconciles with D18-20's "verified kill":** the verification is satisfied
  by construction, not by an added check. — **Reversibility:** costly — any
  future code that stores a pid reintroduces the need for the identity check,
  and the reason it was safe to omit would no longer hold.
- **D18-22:** **A clean-exit hook** so the proxy's own exit does not orphan a
  live child.
- **D18-23:** For a child orphaned by a `SIGKILL`ed proxy (no exit hook runs):
  **measure the stdin-EOF exit behaviour against real the external analyser 0.9.20
  in this phase, then rely on it.** A stdio child should see EOF on stdin when
  the proxy dies and terminate itself — but that is an assumption about an
  external binary, and this project has been taught the "internal check
  standing in for an external one" lesson repeatedly (Pitfall 12). If it
  holds, no startup sweep is needed and the reason is on record; if it does
  not, the sweep becomes a planned task rather than a later surprise. A
  startup sweep was rejected as the default because it reaches outside this
  process's own children — including another worktree's live session. —
  **Reversibility:** reversible.

### Tool surface (SURF-01, SURF-02)

- **D18-24:** `anno_read_region` is curated, with **both** views
  (`view: "disasm" | "hexdump"`). Live schema:
  `{start_address, end_address, view}`, required
  `[start_address, end_address]`. Both views are one enum parameter and both
  already work upstream; `hexdump` is what Phase 20's data-table
  classification and Phase 21's table extraction will want, `disasm` is what
  routine documentation wants. Each addition carries a named criterion per
  `anno-tools.ts`'s own discipline, and it goes into
  `ANNO_TOOL_DEFINITIONS` / `CURATED_ANNO_TOOLS` / `READ_ONLY_ANNO_TOOLS`.
  — **Reversibility:** reversible.
- **D18-25:** `anno_read_region` carries a **documented range cap** with a
  named error over it, whose message embeds the offending size and the valid
  range (this repo's existing range-validation message convention). A full-64K
  disasm view dumped into an LLM's context is a real hazard, and the point of
  the tool is reading a routine rather than the program. Cap value is the
  planner's call. — **Reversibility:** reversible.
- **D18-26:** The **cursor trio is held** —
  `anno_get_disassembly_cursor`, `anno_jump_to_address`,
  `anno_read_selected` are not curated in this phase. `anno_read_region`
  already answers "read this routine" directly by range, which makes them
  largely **redundant** rather than merely unproven. Phase 19's absorption
  diff is the exercise that would show a real need, and adding a tool then is
  additive, not a rewrite — the rewrite risk the ROADMAP note warns about is
  the *lifecycle*, not the tool list. Consistent with the measured-caller
  discipline used at the v0.2.0 manifest cut and the v0.3.0 ANNO cut. —
  **Reversibility:** reversible.
- **D18-27:** **`anno_get_address_details` is composed entirely
  client-side** from the four already-curated reads (`anno_get_symbols`,
  `anno_get_comments`, `anno_get_blocks`,
  `anno_get_cross_references`) and **never calls upstream's tool at all**.
  The live `u16` overflow at `handler.rs:1894` (`raw_data.len() as u16`
  wrapping 65536 → 0, re-confirmed against the installed 0.9.20 during v0.5.0
  research) becomes **unreachable by construction** rather than detected and
  routed around. Follows the Phase 4 client-side derived-tool precedent.
  **Constraint already satisfied:** CLAUDE.md requires derived tools to be
  intercepted before `forwardToVice()`; the `anno_*` family registers through
  `buildViceTool()` and never reaches `forwardToVice()`, so neither
  `rewriteArguments()` call site is reachable from it — satisfied by
  construction for this family, not by an added interception. —
  **Reversibility:** costly — retiring the composition in favour of a fixed
  upstream tool means reconciling output shape at every caller.
- **D18-28:** **One code path — it never passes through to upstream's tool**,
  not even for small projects. No wrap-detection heuristic to get subtly
  wrong, no divergence between what a small project and a 64K project get
  back, one path to write and test. Upstream's tool stays off the curated
  surface. — **Reversibility:** reversible.
- **D18-29:** **It keeps the name `anno_get_address_details`** — the name
  upstream uses and the name Phase 19's absorbed procedures will reach for, so
  nothing needs rewriting there. Its client-composed nature is documented in
  the tool description and the module header, not encoded in the name. —
  **Reversibility:** costly — renaming after Phase 19 absorbs procedures
  against it means editing every absorbed procedure.
- **D18-30:** **D-32 is superseded by a dated decision with a named reversal
  trigger**: an upstream fix to the external analyser issue #42 would let the
  client-side composition be retired in favour of the native tool. Same shape
  as `FORK-01`'s retain-with-reversal-criteria and `CORE-01`'s keep-dated.
  Pinned by a guard so it cannot drift back to unexamined — this is the second
  milestone the item has been carried, and the trigger is what stops a third.
  The plan must allocate the next project-wide `D-nn` and state that it
  supersedes D-32. — **Reversibility:** reversible.
- **D18-31:** SURF-01's no-drift clause is met **inside the same plan** that
  curates the tools: update `anno-tools.test.ts`'s count pin (17 → 19) and
  regenerate `docs/tool-support.md`, leaning on the byte-identity drift guard
  built at v0.2.0 plus `anno-verb-coverage.test.ts`. No new drift test — the
  existing guards bite on exactly this. — **Reversibility:** reversible.

### Project settings at session open

- **D18-32:** Settings are forced **before spawn**, in the session-open path:
  read the `.regen2000proj`, force the setting on disk, **then** spawn the
  child. That is exactly the window Pitfall 9(6) declares safe ("before a
  session opens the file"), and it needs no tool that does not exist. The
  "never edit while a session owns the file" rule then holds absolutely,
  because the only editor runs before any child exists. A project file that
  cannot be read or parsed is a **named refusal**, not a best-effort spawn. —
  **Reversibility:** reversible.
- **D18-33:** The forcing logic is **extracted from `anno-project.ts`** into
  one shared "ensure settings" function that both the existing synthesiser and
  the session-open path call. Not a second copy in `anno-session.ts` with
  slightly different semantics — that is the same drift anti-pattern research
  names for save timing. — **Reversibility:** reversible.
- **D18-34:** **`use_illegal_opcodes` is forced silently; a `system`
  mismatch is a named refusal.** Different risk profiles, deliberately
  different treatment: forcing `use_illegal_opcodes: true` only ever widens
  what decodes correctly and cannot invalidate existing annotations, whereas
  silently rewriting `system` on an already-annotated project could
  reinterpret every block classification in it. This closes the ROADMAP note's
  gap — the existing synthesiser forces it only at creation, so a session
  re-opening an older project would otherwise silently re-degrade every
  illegal opcode to an opaque `!byte` fallback. — **Reversibility:**
  reversible.
- **D18-35:** Proven by a **planted-violation round trip**: hand the open path
  a project file with `use_illegal_opcodes: false`; assert it reads `true`
  after open; assert a subsequent mutating call's own save does **not** revert
  it; then remove the forcing step and prove the test goes red. **The
  no-revert half is the one that actually tests Pitfall 9(6)** rather than
  just the edit. — **Reversibility:** reversible.

### The D-17/D-18 reversal record

- **D18-36:** This phase is an **explicit reversal of D-17/D-18** and must run
  `.planning/ARCHITECTURE.md`'s Architecture Change Procedure in full, in the
  plan that implements it — all six steps: (1) name D-17/D-18 by id; (2)
  explain why the existing architecture cannot support the requirement (the
  session-model mismatch: cursor-shaped tools are meaningless under per-call
  spawn, and `c64-program-recon`'s own text already concedes the respawn cost
  — "batching is what makes that affordable under the per-call
  spawn-load-mutate-save-exit lifecycle"); (3) name the alternative that
  preserves the original safety property (D18-08's save-per-mutation
  invariant, unchanged); (4) record the change in decision history; (5) add or
  update a machine-checkable regression guard (D18-09's planted-violation
  test, plus the D18-02 spawn-seam fixture); (6) only then implement. The
  now-false header prose in `anno-mcp-client.ts` is corrected in the **same**
  change (D18-07) — CLAUDE.md's own line-reference guard exists because this
  kind of drift happens. — **Reversibility:** reversible.

### Claude's Discretion

The user answered "you decide" on nothing explicitly, but three gray areas
were offered and declined at the close. My calls, recorded so the planner does
not re-open them:

- **Live-versus-stub verification:** default to **live** testing against the
  real installed `the external analyser` 0.9.20 (`~/.cargo/bin/analyser`) for
  anything that is a claim about the external binary — the stdin-EOF exit
  behaviour (D18-23), the session-reuse spawn transcript (D18-02), and the
  save-survives-`SIGKILL` round trip (D18-09). The existing stub-server
  harness in `anno-mcp-client.test.ts` stays appropriate for protocol-shape
  and error-classification tests where the child's behaviour is the thing
  being simulated rather than the thing being measured. Rationale: Pitfall
  12's "internal check standing in for an external one" is the lesson this
  project has been taught six times.
- **`withAnnoSession()` retirement:** not retired (D18-07). CLI verbs have no
  session-continuity need and the one-shot contract is already tested.
- **Reversal-record contents:** as enumerated in D18-36 rather than left to
  the plan's judgment.

Additionally at the planner's discretion, with the constraint named:
- The restart bound's numeric value (D18-14) and the contention-queue timeout
  (D18-17) — both must be named constants with the env-var/override convention
  this repo uses, never magic numbers at a call site.
- The `anno_read_region` cap value (D18-25).
- Whether `anno-session.ts` or the extended `anno-mcp-client.ts` owns the
  mutex, so long as it is one place and D18-18's critical-section boundary is
  the unit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone framing and requirements
- `.planning/ROADMAP.md` §"Phase 18: Persistent Session and Tool Surface" —
  goal, the five success criteria, and the four Notes (the enabler rationale,
  the broker-pattern-reuse instruction, criterion 4 as Phase 19's go/no-go,
  and the `use_illegal_opcodes` session-open requirement).
- `.planning/REQUIREMENTS.md` §"Persistent Session" and §"Tool Surface" —
  SESS-01..04, SURF-01, SURF-02 verbatim; also §"Out of Scope" (the HTTP
  transport and `vice-broker.mts` rows) and §"Future Requirements" (FUT-02,
  FUT-03).
- `.planning/PROJECT.md` — v0.5.0 Active list, and the "session-model
  mismatch" analysis around the Target Features section.

### Architecture rules and the change procedure
- `.planning/ARCHITECTURE.md` §"Architecture Change Procedure" — the six steps
  D18-36 must execute for the D-17/D-18 reversal.
- `.planning/ARCHITECTURE.md` Rule A4 (keep derived implementations outside
  the proxy monolith), Rule A11 (single-owner launch guard), Rule A16
  (container-side static analysis remains container-side), Rule A18
  (static-analysis-only integration), Rule A19 (queryable annotation state is
  authoritative), Rule A20 (symbol round trip via explicit adapters).
- `CLAUDE.md` — the derived-tool interception constraint and its note that the
  `anno_*` family satisfies it by construction (registered through
  `buildViceTool()`, never reaches `forwardToVice()`).

### v0.5.0 research (read before planning — it did the live probing)
- `.planning/research/ARCHITECTURE.md` §0 ("What was verified live this
  session" — the 28-tool `tools/list`, `anno_read_region`'s live schema, the
  `--mcp-server-stdio` no-port finding), §2 (component responsibilities table,
  new vs modified), §Q1 (where the session lives, and why (b)/(c) were
  rejected), §Q2 (the save-discipline invariant and the exact test shape), §Q6
  (Phase 18's build order), §4 (the four integration anti-patterns).
- `.planning/research/PITFALLS.md` §"Pitfall 9" (the six session-lifecycle
  failure modes and the Phase 9 incident that generalises), §"Pitfall 11"
  (why the concurrency model is a separable decision — the go/no-go this phase
  answers), §"Pitfall 12" (internal check standing in for an external one),
  §"Pitfall 6" (why `use_illegal_opcodes` is load-bearing).
- `.planning/research/STACK.md` §the D-32 paragraph — the live re-confirmation
  of the `handler.rs:1894` `u16` overflow in installed 0.9.20.
- `.planning/research/SUMMARY.md` — the one-paragraph Phase 18 deliverable
  statement.

### Prior decisions this phase reverses or supersedes
- `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/11-CONTEXT.md`
  — D-16 (this repo as MCP *client*), D-17/D-18 (per-call lifecycle, being
  reversed here), D-32 (the `anno_get_address_details` exclusion and upstream
  issue #42), D-33 (batch-whole refusal).
- `docs/phase9-external-analyser-probe-findings.md` — the `degrade` verdict, the
  Accepted Limits, and the recorded three-separate-connections `.vsf`
  incident that generalises to this session model.

### Source files this phase touches
- `src/mcp/vice/anno-mcp-client.ts` — the sole spawn/parse seam; its header
  is the D-17 statement being reversed and must be corrected in the same
  change. `withAnnoSession()`, `saveAndVerify()`, and the named error classes
  (`AnnoChildExitError`, `AnnoSessionFailedError`,
  `AnnoSaveNotPersistedError`) all live here.
- `src/mcp/vice/anno-tools.ts` — `ANNO_TOOL_DEFINITIONS` (17 entries),
  `CURATED_ANNO_TOOLS`, `assertCuratedTool()`, `READ_ONLY_ANNO_TOOLS` (6
  entries), `runAnnoTool()` and its save-per-mutation sequencing, and the
  D-32 refusal message.
- `src/mcp/vice/spawn-seam.test.ts` — the enumerated spawn-site guard.
- `src/mcp/vice/anno-launch.ts` — `buildMcpServerStdioArgs()`,
  `assertNoViceFlag()`, the fixed per-verb argv builders.
- `src/mcp/vice/anno-project.ts` — the `.regen2000proj` synthesiser whose
  settings-forcing logic D18-33 extracts.
- `src/mcp/vice/vice.ts` — the module-level-mutable-transport-state precedent,
  and `MachineRestartedError` as the restart-detection analogue.
- `src/mcp/vice/vice-broker.mts` — pattern source only (single-owner
  `inFlight` guard); explicitly **not** a routing target.
- `docs/tool-support.md` and its byte-identity drift guard;
  `anno-tools.test.ts`'s count pin; `anno-verb-coverage.test.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`anno-mcp-client.ts`'s named error classes** —
  `AnnoChildExitError`, `AnnoSessionFailedError`,
  `AnnoSaveNotPersistedError` already exist and are exactly what D18-12's
  fail-loud path and D18-09's scenario 3 assert on. No new error taxonomy
  needed for the mid-call crash case; the session may need one new class for
  the exhausted-restart-budget case (D18-14).
- **`saveAndVerify()`** — already proves persistence by re-reading the project
  file's own content hash before and after, never by trusting the child's text
  response (the T-11-FALSESUCCESS defence). Unchanged by this phase.
- **`resolveStorePath()`** (`anno-tools.ts`) — already resolves the project
  path per call, so D18-04's "different project path" comparison has an
  existing single source for the key.
- **`assertNoViceFlag()` + the fixed per-verb argv builders**
  (`anno-launch.ts`) — the `--vice` invariant's dual enforcement. The
  long-lived spawn path reuses both; D18-02's new fixture proves it.
- **`vice-broker.mts`'s single-owner `inFlight` guard** — the synchronous
  check-and-set pattern D18-20 ports (pattern, not code).
- **The existing stub-server harness in `anno-mcp-client.test.ts`** — reusable
  for protocol-shape tests; see Claude's Discretion for where it is *not* the
  right oracle.
- **`docs/tool-support.md`'s byte-identity drift guard** (built v0.2.0) and
  `anno-verb-coverage.test.ts` — D18-31 leans on both rather than adding a
  new test.

### Established Patterns
- **One authoritative place per concern.** `anno-mcp-client.ts` owns
  spawn/protocol; `anno-tools.ts` owns tool names and save timing;
  `anno-session.ts` will own lifecycle only. Research's named anti-pattern is
  a second save-timing policy — D18-08 keeps it in one place.
- **Guard by construction, then pin it.** The `--vice` invariant is
  unreachable *and* denied; D18-21 and D18-27 both use the same idiom
  (unreachable-by-construction, with the reason recorded).
- **Planted-violation non-vacuity proof.** `spawn-seam.test.ts` and the
  `docs-*.test.ts` family all demonstrate the guard catching the bug it was
  built for. D18-09, D18-19 and D18-35 each follow it.
- **Instrument before the work it gates.** v0.4.0's Phase 12 audit-gate-first
  precedent; here it is D18-09's save-discipline test landing before anything
  depends on the session.
- **Dynamic import of the client from the tools module** — importing
  `ANNO_TOOL_DEFINITIONS` at `vice-proxy.ts` module scope costs no child
  process. The session must preserve this: registration must not spawn.
- **Named constants over magic numbers**, with the env-var override
  convention (`DEFAULT_ANNO_CALL_TIMEOUT_MS` is the local example).

### Integration Points
- `runAnnoTool()` is the single call site rewired from the one-shot path to
  the session — its `assertCuratedTool()` → `resolveStorePath()` → dynamic
  import → save-per-mutation ordering is preserved.
- `anno-session.ts` is a new sibling module, never inline in
  `vice-proxy.ts` (Rule A4, and every `anno-*.ts` module's existing shape).
- The proxy's existing exit handling gains the D18-22 clean-exit hook.
- No host/container path translation applies anywhere in this phase —
  the external analyser is container-side (D-R4, Rule A16), asserted structurally by
  the closed host-path consumer-set test.

</code_context>

<specifics>
## Specific Ideas

- The user's framing throughout was to prefer the option that makes a hazard
  **unreachable by construction** over one that detects and routes around it —
  chosen three times independently (D18-21 kill-by-handle, D18-27
  compose-client-side, D18-28 one-code-path).
- Where SESS-04's wording and research §Q1's wording conflicted, the
  resolution was to satisfy the requirement at the layer where it is
  observable (orchestration-level read fan-out) rather than to build the more
  complex mechanism its literal reading implies — with the deferred capability
  recorded as D18-16 and a Phase 19 measurement task, so it stays a decision.
- Every "prove it" answer chose the planted-violation form over the green-path
  assertion, without exception.

</specifics>

<deferred>
## Deferred Ideas

- **Reader-writer lock for the session** (concurrent reads, exclusive writes)
  — D18-16. Deferred pending a Phase 19 measurement of whether
  the external analyser's stdio handler multiplexes requests. Not rejected.
- **A caller-visible `anno_session_status` tool** — declined in this phase
  (D18-06) because no caller has been demonstrated. Revisit if Phase 19's
  procedures or a wedge-triage playbook need to query session state.
- **The cursor trio** (`anno_get_disassembly_cursor`,
  `anno_jump_to_address`, `anno_read_selected`) — D18-26. Phase 19's
  absorption diff is the place a real caller would appear. Adding them then is
  additive.
- **A keyed map of concurrent multi-project sessions** — D18-04 chose a single
  slot; the milestone already defers the capability as FUT-02.
- **A startup sweep for stale `analyser --mcp-server-stdio`
  processes** — becomes a planned task only if D18-23's stdin-EOF measurement
  fails.
- **An upstream patch for the external analyser issue #42** — the project's standing
  position is that pull requests against repositories it does not own are
  follow-ups, not deliverables. D18-30 records the fix as this project's
  reversal *trigger* instead.
- **`anno_export_source` / `anno_hazard_report` as MCP tools** — research
  §4 names this as an anti-pattern; the CLI-verb route is Phase 21's shape,
  not this phase's concern.

</deferred>

---

*Phase: 18-Persistent Session and Tool Surface*
*Context gathered: 2026-08-23*
