# Phase 64: Files as Bytes, Both Directions - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The four file-carrying tools — `vice_autostart`, `vice_disk_attach`,
`vice_snapshot_save` and `vice_snapshot_load` — stop naming a path the other
side must be able to open. Bytes cross the socket. The client writes only under
its own `.c64-re-tools/`; the broker chooses and owns every path on its own
side.

**What this phase writes:** a file-transfer protocol (a JSON header line
followed by a declared byte count, on its own short-lived connection), a
broker-side staging model with a minted handle, an end-to-end integrity check
and size cap, a startup sweep, an atomic client-side write, a path-containment
validator, and the four tool handlers migrated onto all of it one at a time.

**Explicitly NOT in this phase:**

- **`vice_symbols_load` and `vice_program_load` get no transport work.** Both
  were verified NOT file-carrying. `vice_program_load` refuses a filename
  outright and takes an enumerated subject id (`text-tools.ts:859`);
  `vice_symbols_load` reads client-side with `readFileSync` under
  `needsSession: false` (`stock-symbols.ts:350`). Planning transfer work for
  either is a scope error, not a thoroughness bonus.
- **`host_tool` is not touched.** Skill-script host tools are `SEAM-03`,
  Phase 65. See D-19 for what that means for `host-tool.mts`'s standing
  byte-payload prohibition.
- **No deletion.** `stock-paths.ts` survives this phase; Phase 66 deletes it
  (`RM-01`). This phase only stops `stock-machine.ts` importing it.
- **The session model, the endpoint and the skill-script seam** are Phases 63,
  62 and 65 respectively and are all settled or not yet due.

</domain>

<decisions>
## Implementation Decisions

Nineteen decisions, from six discussed areas. Three were delegated to Claude
("you decide") and are marked; every other decision is a direct owner choice
and is not open for re-derivation by the researcher or the planner.

**Two decisions went AGAINST the recommendation offered** (D-17 and the todo
disposition in D-08's neighbourhood). Where that happened, the option's own
stated cost is carried here verbatim rather than softened — the owner took the
cost knowingly.

### Where the bytes ride

- **D-01: A file payload rides a short-lived, stateless transfer connection
  that presents an opaque broker-minted handle. The `AUTOSTART`/`DUMP`/`UNDUMP`
  command itself stays on the grant-holding connection.** Direct owner
  decision.

  *This resolves a real contradiction rather than picking a side.*
  `REQUIREMENTS.md` decision 6 says short-lived stateless connections carry
  files; `ROADMAP.md`'s Phase 64 cross-cutting constraint says a file-transfer
  op "runs through the same connection-holds-grant check the existing recycle
  path uses, never a bare `target_id` lookup." Both hold under this split:
  **ownership is checked where the command is issued** (the grant connection,
  which already holds the grant), and **the payload is authorised by the
  handle** `XFER-04` already requires.

  *This shape is not novel here — Phase 63 shipped and tested it.*
  `broker-control.mts:1360-1363` records that the `attach` op is
  **deliberately NOT gated by `ownsTarget()`**, because a relay socket is
  brand new and `requestIdForThisConnection` is null on it, so "the per-claim
  `handle` presented below is the ONLY authority this arm can check (T-63-01)."
  The transfer connection is the same pattern with a different tag.

  *Named cost, accepted:* one extra connection and one extra round trip per
  file, on every transfer rather than only on a failure path.
  — **Reversibility:** costly — the split is visible in the op vocabulary, in
  `broker-endpoint.ts`'s exported dial surface and in every one of the four
  migrated handlers; collapsing it later means re-deciding ownership checking
  for all four at once.

- **D-02: The byte segment is framed as one JSON header line, then exactly N
  raw bytes.** Direct owner decision. The header declares the kind, the
  `byteLength` and the digest; the receiver then reads exactly N bytes and
  never decodes them.

  *Why this and not a new envelope.* `REQUIREMENTS.md` decision 6 forbids a
  new envelope format. A JSON line followed by an opaque payload is what this
  protocol **already does** — `broker-relay.mts`'s `readAttachLine()` decodes
  the bytes strictly before the first `0x0a` and hands everything after it on
  as an untouched `Buffer`. Length-prefixed chunking (`[4B BE length][payload]`
  repeated) was offered and declined: it would genuinely be a new envelope.

  *base64-inside-the-JSON-line was not offered and must not be reached for.*
  `MAX_LINE_BYTES` is 65536, it inflates 33%, and it puts a payload back into
  string mode — the exact corruption Phase 63's Buffer carry exists to prevent.

- **D-03: The two remaining UTF-8 string framers are left alone, and the
  measurement that licenses that is recorded here.** Direct owner decision.

  *`ROADMAP.md`'s cross-cutting constraint on this is partly stale.* It names
  three sites. Measured 2026-09-23:
  - `broker-control.mts` was converted to a Buffer carry by Phase 63
    (`broker-control.mts:953-988`), with its own header comment explaining
    that the corruption happens at decode time.
  - The other two (`vice-broker-client.ts:534` and `vice-broker-client.ts:1013`)
    are in the **legacy per-project-discovery dial path**, which
    `broker-endpoint.ts:17-25` explicitly **forbids importing** and which
    `RM-02` deletes in Phase 66.

  Because the transfer rides `broker-endpoint.ts` — which already accumulates
  as `Buffer` (`broker-endpoint.ts:662-665`) — no payload byte can reach a
  string framer. The constraint is satisfied by construction, not by editing a
  module scheduled for deletion. Converting them was offered and declined; it
  would weaken the "that path is legacy, do not extend it" boundary
  `broker-endpoint.ts`'s header draws.

  **The planner must not record this as an inherited obligation for Phase 66.**
  There is nothing there to convert.

- **D-04: A payload moves by streaming through a hashing `Transform`.** Direct
  owner decision. `createReadStream(path).pipe(hashAndCountTransform).pipe(socket)`
  — stdlib `pipe()` owns backpressure end to end, and the `Transform` computes
  the digest and enforces the cap **as bytes pass**, so nothing ever holds the
  whole payload.

  *Why not a manual write/drain loop.* It is exactly the hand-rolled byte-copy
  loop `broker-relay.mts`'s header forbids ("`Socket.prototype.pipe()` is the
  stdlib primitive for exactly this"). Taking it would have meant recording
  that prohibition as narrowed. It was offered and declined.

  *Named cost, accepted:* the cap can now fire mid-stream, so the refusal path
  must unwind a partial write rather than simply returning a refusal before
  anything happened. `ROADMAP.md` already requires proving this against "a
  receiver that deliberately stops reading."

### Staged files and their lifetime

- **D-05: A staged upload is keyed by `(grant, kind/unit)` and superseded on
  reuse.** Direct owner decision. Uploading a new image for the same slot
  replaces and deletes the previous one; otherwise the file lives until the
  session closes.

  ***The roadmap's own framing of this choice contains an unsafe option, and
  the planner must not reach for it.*** `ROADMAP.md`'s notes offer "deleted as
  soon as its `AUTOSTART` reply confirms consumption." An `AUTOSTART` reply
  confirms **the command was accepted**, not that the load completed. Worse,
  for `vice_disk_attach` the image stays attached to unit 8 for the rest of
  the session — that is the entire purpose of the tool
  (`stock-machine.ts`'s `DISK_ATTACH_APPROXIMATION`). Deleting a staged `.d64`
  on reply pulls the disk out from under a running emulator.

  *What this buys over plain session-lifetime retention:* staged bytes are
  bounded by (slots × cap) rather than (uploads × cap), and a re-attach of the
  same image needs no second upload.
  — **Reversibility:** reversible — the slot key is internal to the broker.

- **D-06: Staged files live in one directory per session,
  `<VICE_BROKER_HOME>/staging/<session>/`, with handle-named files inside.**
  Direct owner decision. "Gone when the session closes" becomes one `rm -rf` of
  one directory rather than per-file bookkeeping — far harder to get wrong —
  and the directory is also the natural sweep unit.

- **D-07: The `XFER-07` crash sweep runs at broker startup only. There is no
  timer.** Direct owner decision. `SESS-03` and `SESS-04` already reclaim on
  socket events and on bounded liveness detection, so the only residue a sweep
  can ever find is what a **crashed** broker left — and that is unambiguous
  exactly when the next broker starts. A periodic timer was offered and
  declined: it adds an interval to tune and a window where the sweep can race
  a live transfer, which the startup-only variant structurally cannot.

- **D-08: The `vice-broker-vicerc-*` per-launch scratch dirs move under
  `VICE_BROKER_HOME` and are reaped there.** Direct owner decision, folding the
  `resolves_phase: 64` todo as real work (see Folded Todos).

  ***The two kinds have OPPOSITE lifetime rules and one sweeper must honour
  both.*** A staged file must **not** outlive its session. A vicerc dir must
  outlive the function that created it, for the whole lifetime of the emulator
  process that uses it (`broker-launch.mts:318-327` records this deliberately).
  A sweeper that applies the wrong rule either deletes a live emulator's config
  or leaks a payload. The todo's own live-pid guard is therefore **mandatory,
  not optional** — a crashed broker can leave orphaned but still-running
  emulator children.

  *Named cost, stated at the point of decision and accepted:* on this host
  `/tmp` is a tmpfs whose aging is disabled, so moving these dirs off it stops
  the RAM leak (4,779 dirs measured after 7 days uptime) but lands them on real
  disk, where they survive reboot. **The sweep becomes load-bearing rather
  than a nicety.**

  *Build-artifact coupling the planner must not miss:* `broker-launch.mts` is
  `.mts`, compiled by `build.ts` into committed `resources/broker-launch.mjs`,
  and `resources-sync.test.ts` fails CI on drift. The regenerated artifact ships
  in the same commit. The `:318-327` header comment says the code
  "deliberately does NOT clean the directory up" and must be rewritten in the
  same change — leaving it would be actively misleading.

  *`CLAUDE.md`'s frozen spawn set is unaffected:* `broker-launch.mts` remains
  the one module that spawns the emulator binary, in argv-array form. This
  change alters an environment variable it passes, not how it spawns.
  — **Reversibility:** costly — the location is baked into the sweep, the
  launcher and `BROKER-06`'s claim.

### The cap and the integrity check

- **D-09: The size cap is 16 MiB.** Direct owner decision. Roughly 19× the
  largest fixed C64 artifact and ~16× a `.g64`, so every legitimate transfer in
  this phase clears it with room for a `.vsf` that embeds several attached
  disks.

  *Sizing data the decision was taken against:* `.d64` = 174,848 bytes exactly;
  `.d71` = 349,696; `.d81` = 819,200; `.g64` ≈ 1 MB; a `.prg` at most ~64 KB. A
  `.vsf` with `include_disks: true` embeds the attached images and is the one
  unbounded-ish case.

  *Named cost, accepted:* 16 MiB is **not** headroom for Phase 65's host-tool
  outputs (Ghidra run artifacts can be tens of MB). The 64 MiB alternative was
  offered specifically so the number would not be reopened and was declined.
  **Phase 65 may have to revisit this number, and that was foreseen here.**

- **D-10: The cap is a constant. There is no environment knob.** Direct owner
  decision, following D-09's precedent from Phase 62, where the
  allowlist-plus-env-override variant was offered and deliberately not taken.
  A cap that can be raised by env is a cap an agent can talk a user into
  raising; a constant keeps the refusal honest and the security posture
  trivially auditable — the property this milestone rests on now the token is
  gone.
  — **Reversibility:** reversible — adding a knob later is additive.

- **D-11: The cap is enforced at BOTH ends.** Direct owner decision. The sender
  refuses before a single payload byte moves, from the `byteLength` declared in
  the header line (fail fast, nothing wasted, one round trip). The receiver
  enforces independently as bytes arrive, **because a declared length is
  untrusted input** and a sender can lie or be buggy.

  *Named cost, accepted:* the receiver needs a mid-stream abort path that
  destroys the connection and unlinks the partial file, not merely a refusal.
  This is the same path D-04's mid-stream cap firing needs.

- **D-12: One uniform cap across all four tools. Not per file kind.** Direct
  owner decision. One number, one refusal message, and **the transfer layer
  stays ignorant of C64 file formats** — which is what lets Phase 65 put
  host-tool outputs through the same code without teaching it about Ghidra.

  *Named cost, accepted:* the cap will not catch "you handed `vice_disk_attach`
  a 4 MB file that cannot be a disk image." That stays the tool's own
  validation problem, not the transport's.

  **Settled by existing precedent, not discussed, and not open:** the digest is
  **sha256** (`host-tool.mts:2282` is the in-repo precedent, streaming via
  `node:crypto`), and the client-side write is **write-to-temp-then-`renameSync`
  on the same filesystem** — the established pattern in five modules
  (`broker-incident.mts:222`, `broker-epoch.mts:104`, `vice-broker.mts:349`,
  `anno-store.ts:1469`, `anno-export-asm.ts:2383`). The `fsync`-on-Windows
  portability limit already carries a recorded accepted disposition
  (`.planning/todos/pending/2026-08-28-phase-28-review-in-02-fsync-portability-on-windows.md`)
  and is not this phase's to solve.

### What the four tools' arguments and results become

- **D-13: The client keeps owning the destination name. `XFER-03`'s validator
  is built and tested but has NO live producer in this phase.** Direct owner
  decision.

  `vice_snapshot_save`'s `name` stays client-owned and
  `sanitizeSnapshotName()`'s existing rule (1–64 chars, alphanumeric,
  underscore or hyphen, `stock-paths.ts:160`) stands. The containment validator
  `XFER-03` requires is built and tested — as the **pure function over
  traversal fixture strings with no I/O** `ROADMAP.md` already mandates —
  covering `../../etc/passwd`, `/etc/passwd`, `C:\` and a NUL-embedded name,
  refusing rather than sanitising.

  **Recorded so nobody later misreads a green test:** the validator's first
  live producer is Phase 65, where the broker genuinely names host-tool output
  artifacts. A passing test in Phase 64 is evidence the validator is correct,
  **not** evidence that a real broker-supplied name was ever exercised.

  The alternative (broker supplies the name in the download header) was offered
  and declined: it makes the broker name a file in the client's own tree for a
  tool where the client asked for that name in the first place, and it would run
  `sanitizeSnapshotName()` and the containment validator on the same value from
  opposite sides.

- **D-14: `vice_autostart`'s and `vice_disk_attach`'s `path` stays
  unrestricted — any absolute path on the client.** Direct owner decision,
  taken with the security cost stated in the question and chosen anyway.

  `resolve(path)` (`stock-machine.ts`'s `handleAutostart` and
  `handleDiskAttach`) keeps its current meaning: the client reads that file and
  streams it. Confining it to the workspace was offered and declined — it is a
  regression dressed as hardening, and this tree's whole purpose is analysing
  artifacts that live wherever the user put them (`~/Downloads`, a shared ROM
  library).

  *Named cost, accepted and recorded rather than discovered later:* the broker
  is now **machine-level and shared across every project**, so this is a route
  for reading any client-readable file into broker-owned staging. It is bounded
  by D-09's 16 MiB cap and D-06's session-scoped staging directory, and it is
  accepted.
  — **Reversibility:** costly — narrowing it later breaks a documented tool
  argument in a way a major version would normally be required for.

- **D-15: The result's broker-side `sentPath` field is replaced by the opaque
  handle.** Direct owner decision. `ROADMAP.md`'s criterion 2 requires the tool
  result to name the client's local path "and no broker-side path"; a handle is
  not a path, so the criterion holds.

  *Why not remove it outright.* `sentPath` was informally serving as the only
  correlation thread between a tool result and broker-side diagnostics, which
  `vice-wedge-triage` depends on. The handle preserves that thread without
  leaking a path.

  *Named cost, accepted:* an opaque token now appears in a result, and an agent
  will be tempted to reuse it as an argument somewhere it is not accepted. The
  tool schema and the refusal wording should anticipate that.
  — **Reversibility:** one-way — this is a breaking change to a published
  tool's result shape; it is in budget because v2.0.0 is a major version, but
  reverting it after release means a second breaking change.

- **D-16: A game's writes to an attached disk image are an ACCEPTED, NAMED
  LOSS.** Direct owner decision.

  ***This regression is named nowhere in `ROADMAP.md` or `REQUIREMENTS.md` and
  was surfaced during this discussion.*** A disk image attached to unit 8 is
  writable — a C64 game can save to it. Under the old shared-filesystem model
  those writes landed in the user's own file. Under D-01 + D-06 the emulator
  writes to the **broker's staged copy**, which is deleted when the session
  closes. The staged image is write-through-to-nowhere.

  The tool result and the docs must say so **explicitly and by name**, matching
  how this tree already handles capabilities stock cannot deliver (see
  `docs/stock-hard-losses.md`'s shape).

  *Why not pull the image back on session close.* Offered and declined: `SIGKILL`,
  a crash and a recycle all produce no clean close, so the guarantee would be
  "usually" — worse to document than a flat loss — and it would make every
  `disk_attach` a two-way transfer.

  *A read-only attach is not reachable and must not be planned.* MEASURED
  2026-09-23: there is no resource-set tool on the advertised surface
  (`tools-manifest.stock.json` carries 47 `vice_*` tools; none sets a VICE
  resource), and `AUTOSTART` (0xdd) has no read-only flag. Making the loss
  *visible* rather than silent would need a launch-time resource or a text-channel
  route, neither of which is in this phase.
  — **Reversibility:** reversible as a decision, but the loss itself is a
  user-visible behaviour change that documentation must carry from here on.

### How the phase proves itself

- **D-17: "No shared filesystem" is proved by disjoint roots plus observation,
  NOT by an injected filesystem seam.** Direct owner decision, taken **against
  the recommendation offered**, with the weaker guarantee stated in the option
  and chosen anyway.

  The test runs with the client's `.c64-re-tools` under temp dir A and the
  broker's `VICE_BROKER_HOME` under temp dir B, disjoint. It asserts the
  expected file appears under A, that B's staging is empty after close, and
  that **no B-side path appears in any tool result or any wire field**.

  *The weaker guarantee, recorded verbatim from the option the owner chose:*
  **it proves nothing leaked, not that nothing was opened** — a stray read of a
  B path that happens to succeed still passes.

  *Two consequences the planner must carry:*
  1. **The transfer modules do NOT need an injectable filesystem-root seam.**
     That was the recommended option's cost and it is now out of scope. Do not
     add one.
  2. **A source-scanning guard is not an available fallback.** `260914-poo`
     D-1 ("No test may assert on text at all") is locked, and `ROADMAP.md`'s
     Phase 53 withdrawal records that moving such a check into CI does not
     escape it either.

  A real container run in CI was offered as the only true proof and declined:
  this repo is host-developed with no devcontainer, so CI would be the only
  place the proven configuration ever exists.

- **D-18: The convergence metric (6 → 4 at this phase's exit) is MEASURED AND
  RECORDED in the phase evidence, not mechanically asserted.** Direct owner
  decision. An importer count is a text question by construction, and D-1 bans
  asserting on text. Phase 66's exit is where the metric becomes a gate.

  *The precedent is genuinely mixed, and the planner should know rather than
  rediscover:* `anno-hazard-report.test.ts:1127` still runs
  `assert.ok(!/hostpath|containerpath/.test(source), ...)` — a source-text scan
  that survived the D-1 purge. That survivor is **not** a licence to add
  another one.

  *Named cost, accepted:* nothing mechanical catches a regression between
  Phase 64 and Phase 66.

  *The metric moves because `stock-machine.ts` stops importing `stock-paths.ts`.*
  `stock-paths.ts` itself survives until Phase 66 deletes it (`RM-01`).

### What this phase deliberately leaves standing

- **D-19: `host-tool.mts`'s byte-payload prohibition is left entirely to
  Phase 65.** Direct owner decision.

  *The prohibition has two clauses with different fates.* MEASURED at
  `host-tool.mts:64-65`: *"No inline byte payload on a host-tool response, at
  any result size — every result crosses as `{ path, sha256, byteLength }`,
  never bytes."*
  - **Clause one survives the whole milestone.** Under D-01 bytes ride a
    separate transfer connection, so a host-tool response would carry a
    *handle*, never bytes. The design honours the rule rather than contradicting
    it.
  - **Clause two goes stale**, and only when Phase 65 replaces `path` (a broker
    path) with a handle.

  Nothing is stale at **this** phase's exit, because Phase 64 never touches
  `host_tool`. Phase 65 amends the second clause in the same change that makes
  it untrue — rule and reality move together.

  *Why the pre-emptive alternative was declined.* It is exactly D-11's shape
  from Phase 62: Phase 66 there found its work already done and its requirement
  ledger needing reconciliation rather than execution, and `STATE.md` still
  carries that as an open loose end.

### Claude's Discretion

The owner delegated the todo disposition (the `cross_reference_todos` step) with
"you decide". That judgement is recorded under Folded Todos below with its
reasoning, so the planner can disagree in writing rather than silently.

Everything else on this page is a direct owner decision. **Fifteen of the
nineteen were taken as the recommended option; D-17 was taken against the
recommendation** and its weaker guarantee is recorded verbatim above rather
than softened.

A planner who finds a constraint none of the offered options contained should
say so in writing rather than implement an option as originally worded — the
same standing rule Phase 62's D-07 and D-08 established.

### Folded Todos

- **`Reap vicerc scratch dirs in broker kill/recycle path`** — FOLDED AS REAL
  WORK.
  (`.planning/todos/pending/2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path.md`,
  tagged `resolves_phase: 64`.) `broker-launch.mts:329` `mkdtemp`s a per-launch
  `XDG_CONFIG_HOME` and never removes it; 4,779 dirs measured after 7 days
  uptime, on a tmpfs, so it is leaked RAM. 62-CONTEXT already recorded "reaping
  it is Phase 64."
  **How it fits:** this is the phase where the broker first grows a cleanup
  discipline at all, and two independent sweepers in one process is exactly the
  duplication this codebase's one-module-per-seam rule exists to prevent.
  **The decisive caveat is in D-08:** the two kinds have opposite lifetime
  rules, so they share a sweeper and a root, never a rule.
  The fix does **not** go at `:329` — it goes in the kill/recycle path, which
  already knows when an instance's process has actually exited.

- **`wrapPossiblyChunked() is orphaned`** — FOLDED FOR AWARENESS ONLY, NOT AS
  WORK.
  (`.planning/todos/pending/2026-09-13-result-chunking-orphaned-by-the-fork-removal.md`.)
  The server still advertises `anthropic/maxResultSizeChars` and still registers
  `vice_result_continue`, which can only refuse.
  **Why it is not this phase's work:** it is a cap on **tool result characters
  returned to Claude**, not on **payload bytes crossing the socket** — a
  different axis. A 175 KB `.d64` payload is not a 25K-character tool result.
  **Why the planner must still know:** the new `XFER-06` cap must not inherit
  the dead one's vocabulary, must not be wired into `_meta`, and must not be
  described in a way that implies `vice_result_continue` now works.
  Its four still-failing tests are the only surviving evidence of that
  regression and must not be retired to make a file green.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

`ROADMAP.md` carries no `Canonical refs:` line for this phase; the list below
was assembled from `REQUIREMENTS.md`, the roadmap section, prior-phase context
and the codebase scout during this discussion.

### Milestone decisions and requirements
- `.planning/REQUIREMENTS.md` § "Settled design decisions" — the six owner
  decisions. **Decisions 4 and 6 bind this phase directly** and are not
  re-derivable: files as bytes saved under the client's own
  `.c64-re-tools/<kind>/`; one endpoint with multiple tagged connections, no
  new envelope format, and `stock-protocol.ts`'s socket-consumption contract
  untouched. `XFER-01..08` are at lines 68-75.
- `.planning/ROADMAP.md` § "Phase 64" — the five success criteria, the five
  cross-cutting constraints (one of which, the string-framer constraint, is
  partly stale — see D-03), the convergence-metric note, and the explicitly
  flagged staged-upload-lifetime choice (answered by D-05).
- `.planning/ROADMAP.md` § "Phase 53" criterion 6 (lines 1556-1573) — the
  **withdrawn** guard, and the locked `260914-poo` D-1/D-2/D-6 rules that
  withdrew it. This is what makes D-17 and D-18 what they are.
- `.planning/STATE.md` § "Current Position" — the convergence metric at **6**
  and its six named importers, and the `CR-01` coupling warning about
  `text-protocol.ts:850` inside a milestone that rewrites the transport.

### Prior-phase context that must not be re-derived
- `.planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-CONTEXT.md`
  — D-13/D-14 (`~/.c64-re-tools/` machine-level root, `VICE_BROKER_HOME`
  superseding four older vars), D-09/D-10 (the bind allowlist with **no knob**,
  the precedent D-10 here follows), and the specifics note that the connection
  **tag vocabulary should be open-ended** because "Phase 64 [adds] the
  short-lived file tag."
- Phase 63's artifacts under
  `.planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/`
  — there is no 63-CONTEXT.md; the SUMMARY and VERIFICATION files carry what
  the relay actually shipped.

### Project constraints that bind what may be written
- `CLAUDE.md` § Constraints — the frozen argv-array emulator-spawn set (one
  member, `broker-launch.mts`, which D-08 edits without widening), the
  never-auto-install rule, the `inFlight` guard's provenance, and the
  single-binmon-client concurrency rule.
- `CLAUDE.md` § Conventions — **`docs/` is operator-owned**; every artifact this
  phase produces goes under
  `.planning/phases/64-files-as-bytes-both-directions/evidence/`, never `docs/`.
  D-16's user-facing loss note is the one thing that may legitimately need a
  `docs/` change, and that is the operator's call, not an executor's.
- `docs/stock-hard-losses.md` — the shape D-16's accepted loss should be
  documented in.

### The code this phase changes
- `src/mcp/vice/stock-machine.ts` — `handleAutostart`, `handleDiskAttach`
  (and `DISK_ATTACH_APPROXIMATION` at :161), `handleSnapshotSave`,
  `handleSnapshotLoad`. All four call `withEmulatorSidePath()`; all four stop.
  Its `:37` import of `stock-paths.ts` is the one the convergence metric counts.
- `src/mcp/vice/broker-endpoint.ts` — **"THE ONE AUTHORITATIVE PLACE for
  dialling the fixed machine-level broker endpoint."** `dialMonitorRelay():706`
  is the template for the transfer dial: the same two-candidate hello race,
  winning socket kept, one JSON line written over it, reply read with a
  `Buffer` carry and `indexOf(0x0a)` at :662-665. `RELAY_TAG_BINARY`/
  `RELAY_TAG_TEXT` at :575-576 are where a file tag joins. `SEAM-01` (Phase 65)
  will require exactly one module to own dialling, so new dial code belongs
  here. **Its header forbids importing `vice-broker-client.ts` or touching the
  filesystem — both still bind.**
- `src/mcp/vice/broker-control.mts` — `ControlRequestKind:96` (eleven ops
  today; the transfer op joins), the `attach` dispatch arm at :1359 and its
  **not-gated-by-`ownsTarget()`** comment at :1360-1363 (D-01's precedent),
  `MAX_LINE_BYTES`, and the Buffer carry at :953-988.
- `src/mcp/vice/broker-relay.mts` — `readAttachLine():88` (D-02's framing
  precedent) and the header's standing prohibitions on string-decoding a
  crossed byte and on hand-rolling the copy loop (D-04).
- `src/mcp/vice/broker-launch.mts:318-329` — the `mkdtemp` scratch dir, and the
  header comment D-08 must rewrite.
- `src/mcp/vice/stock-paths.ts` — `STOCK_EMULATOR_SIDE_PATH_TOOLS:63` (the
  declared four), `withEmulatorSidePath():97`, `sanitizeSnapshotName():160`
  (survives per D-13), `snapshotPathFor():181`, `snapshotMetaPathFor():187`.
  **Survives this phase**; `RM-01` deletes it in Phase 66.
- `src/mcp/vice/repo-root.ts` — `toolsDir():282`, the single tool-written root
  (D-33) the client writes under.
- `src/mcp/vice/host-tool.mts:64-65` — the byte-payload prohibition D-19 leaves
  standing, and `:2269-2283`'s sha256 digest helper, the in-repo precedent.
- `src/mcp/vice/build.ts` — `HOST_BOUND_ARTIFACTS`. Read before renaming
  anything across the `.ts` / `.mts` boundary; `broker-launch.mts`'s edit needs
  its regenerated `resources/*.mjs` in the same commit
  (`resources-sync.test.ts` fails CI on drift).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The stateless-connection-plus-minted-handle pattern already ships.** Phase
  63's `attach` op is the same shape D-01 chooses, including the reasoning for
  why a brand-new connection can be authorised by a handle alone
  (`broker-control.mts:1360-1363`, T-63-01). The transfer op is a twelfth arm on
  an existing switch, not a new protocol.
- **`dialMonitorRelay()` is a near-complete template** — two-candidate hello
  race, winning socket retained, one JSON line, `Buffer`-carry reply read. A
  transfer dial is that function with a different op and a payload phase after
  the reply.
- **Atomic publish is a five-module pattern.** `renameSync` after a temp write,
  same filesystem, never EXDEV — `broker-incident.mts:222`,
  `broker-epoch.mts:104`, `vice-broker.mts:349`, `anno-store.ts:1469`,
  `anno-export-asm.ts:2383`. Criterion 3's "never leaves a file visible at its
  final name" is this pattern, not new work.
- **sha256 digesting of a produced file already exists** at
  `host-tool.mts:2269-2283`, returning `{ path, sha256, byteLength }`.
- **The broker-side Buffer carry already exists** (`broker-control.mts:953-988`),
  so the receiving half of the transfer needs no framing rework on that side.

### Established Patterns
- **Detect, then refuse by name with the remedy in the message.** `XFER-06`'s
  oversize refusal must name the limit; that is this pattern applied to a cap.
- **Generated but committed.** Any `.mts` edit ships its regenerated
  `resources/*.mjs` in the same commit.
- **Never-throw at the boundary.** Every byte from the other side is untrusted
  input; the JSON header line is parsed in try/catch and every field
  type-checked before use. D-11's receiver-side cap enforcement is the same
  posture applied to a declared length.
- **One module per seam.** `broker-endpoint.ts` owns dialling;
  `stock-protocol.ts` owns binary-monitor bytes and is not touched.

### Integration Points
- `stock-dispatch.ts` routes all four tools; `heldSession` is one of the four
  global-state holders.
- `vsf-slice.ts:75` reads a snapshot from `snapshotPathFor()`. Under D-13 that
  file still lands there client-side, so it keeps working — **verify rather
  than assume** during planning.
- `.mcp.json` launches `vice-proxy.ts` with `timeout: 150000`. A 16 MiB
  transfer plus a dial plus a command must fit well inside it.
- **Four source files under `src/mcp/vice/` contain NUL bytes** —
  `anno-memmap-render.ts`, `anno-store-export.ts`, `prereq-readme-gen.ts`,
  `prerequisites.test.ts` (measured 2026-09-19; `CLAUDE.md`'s single-file claim
  is stale). Any content census must use `grep -a`.
- **Testing traps that bite this phase:** `/tmp` is a tmpfs with aging disabled
  (D-08's whole subject); scratch fixtures go under a fresh temp directory per
  test, never a fixed path inside the repository tree; and a machine-level
  broker is now *expected* to be running, which makes the live-broker port
  collision class strictly more likely — every test this phase writes uses a
  dynamically allocated port or refuses to run against an unexpected listener.

</code_context>

<specifics>
## Specific Ideas

- **The oversize refusal must name the limit as a number a person can act on**,
  not "too large". `XFER-06` says so explicitly, and the four-distinct-sentences
  principle from Phase 62's D-07 applies: "that file is 22 MB; the limit is
  16 MiB" is actionable, "transfer refused" is not.
- **D-16's loss needs wording that survives being read out of context.** A user
  who attaches a disk, plays, saves, and closes the session will have lost
  their save. The result field should say what happened to the writes, not
  merely that the attach was an approximation — the existing
  `DISK_ATTACH_APPROXIMATION` sentence is about reset-and-load behaviour and
  does not cover this.
- **The file tag should join the tag vocabulary as an open-ended value**, per
  62-CONTEXT's specifics note. A closed union written now is a rewrite when the
  `anno` stateless call arrives.
- **The migration order should start with the pair that self-verifies.** A
  `.vsf` is binary and definitely not valid UTF-8, so `vice_snapshot_save` +
  `vice_snapshot_load` is the natural `XFER-05` byte-for-byte fixture and the
  two tools prove each other. Not locked — the planner may sequence
  differently with a reason.

</specifics>

<deferred>
## Deferred Ideas

- **A read-only disk attach, which would make D-16's loss visible rather than
  silent.** Not reachable today: no resource-set tool exists on the advertised
  surface and `AUTOSTART` has no read-only flag. It would need a launch-time
  resource or a text-channel route. Worth raising at roadmap level if the
  silent save-loss proves painful in use.
- **The 16 MiB cap may need revisiting in Phase 65** (D-09). Ghidra run
  artifacts can be tens of MB. The 64 MiB alternative was offered here and
  declined; this is a foreseen reopening, not a discovered one.
- **Nothing mechanical guards the convergence metric between Phase 64 and
  Phase 66** (D-18). Accepted; named so Phase 66 does not assume continuous
  protection.
- **`wrapPossiblyChunked()`'s orphaning stays open** and still needs a product
  decision — rewire the chunking into the surviving dispatch path, or
  deliberately withdraw the `_meta` advertisement and unregister
  `vice_result_continue` as an accepted loss. Not this phase's axis (see Folded
  Todos).
- **`CR-01` at `text-protocol.ts:850`** — an inert timeout inside the text
  channel, carried by decision. `STATE.md` warns that a phase touching it while
  redesigning the socket path must say so rather than fix it silently. This
  phase does not plan to touch it; if a plan ends up there, record it as a
  deliberate closure.

### Reviewed Todos (not folded)
- **`BACK-05 D-G ordering test fails deterministically on a live-broker host`**
  — `resolves_phase: 66`. Reviewed; its *trap class* is folded into the testing
  guidance above (dynamic ports), its resolution is not.
- **`disconnect-while-queued samples once after a fixed deadline`** — a
  `broker-e2e.test.ts` timing flake. This phase adds tests to that file and
  should avoid copying the pattern, but fixing the existing case is not in
  scope.
- **`Remove anno from the MCP surface`** and **`Remove pre-warm`** — owners are
  `SEAM-03` (Phase 65) and an unowned warm-floor decision respectively. Neither
  is this phase's; both were already folded for awareness in Phase 62.

</deferred>

---

*Phase: 64-Files as Bytes, Both Directions*
*Context gathered: 2026-09-23*
