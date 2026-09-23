# Phase 64: Files as Bytes, Both Directions - Research

**Researched:** 2026-09-23
**Domain:** TCP file-transfer protocol over an existing single-endpoint control plane (Node.js stdlib streams, hashing, staging, atomic write)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Nineteen decisions, from six discussed areas. Three were delegated to Claude
("you decide") and are marked; every other decision is a direct owner choice
and is not open for re-derivation by the researcher or the planner.

**Two decisions went AGAINST the recommendation offered** (D-17 and the todo
disposition in D-08's neighbourhood). Where that happened, the option's own
stated cost is carried here verbatim rather than softened — the owner took the
cost knowingly.

**D-01: A file payload rides a short-lived, stateless transfer connection
that presents an opaque broker-minted handle. The `AUTOSTART`/`DUMP`/`UNDUMP`
command itself stays on the grant-holding connection.** Direct owner
decision. Ownership is checked where the command is issued (the grant
connection, which already holds the grant), and the payload is authorised by
the handle `XFER-04` already requires — the same pattern Phase 63 shipped and
tested (`broker-control.mts:1360-1363`, T-63-01: the `attach` op is
deliberately NOT gated by `ownsTarget()`, since a relay socket is brand new).
Named cost, accepted: one extra connection and one extra round trip per file,
on every transfer rather than only on a failure path. Reversibility: costly.

**D-02: The byte segment is framed as one JSON header line, then exactly N
raw bytes.** Direct owner decision. The header declares the kind, the
`byteLength` and the digest; the receiver then reads exactly N bytes and
never decodes them. `REQUIREMENTS.md` decision 6 forbids a new envelope
format; length-prefixed chunking was offered and declined as a new envelope.
base64-inside-the-JSON-line was not offered and must not be reached for
(33% inflation, `MAX_LINE_BYTES` is 65536, and it puts a payload back into
string mode).

**D-03: The two remaining UTF-8 string framers are left alone, and the
measurement that licenses that is recorded here.** Direct owner decision.
`broker-control.mts` was converted to a Buffer carry by Phase 63
(`broker-control.mts:953-988`). The other two (`vice-broker-client.ts:534`
and `vice-broker-client.ts:1013`) are in the legacy per-project-discovery
dial path, which `broker-endpoint.ts:17-25` explicitly forbids importing
and which `RM-02` deletes in Phase 66. Because the transfer rides
`broker-endpoint.ts` — which already accumulates as `Buffer`
(`broker-endpoint.ts:662-665`) — no payload byte can reach a string framer.
**The planner must not record this as an inherited obligation for Phase 66.**

**D-04: A payload moves by streaming through a hashing `Transform`.** Direct
owner decision. `createReadStream(path).pipe(hashAndCountTransform).pipe(socket)`
— stdlib `pipe()` owns backpressure end to end, and the `Transform` computes
the digest and enforces the cap as bytes pass, so nothing ever holds the
whole payload. A manual write/drain loop was offered and declined — it is
exactly the hand-rolled byte-copy loop `broker-relay.mts`'s header forbids.
Named cost, accepted: the cap can now fire mid-stream, so the refusal path
must unwind a partial write rather than simply returning a refusal before
anything happened, proven against "a receiver that deliberately stops
reading."

**D-05: A staged upload is keyed by `(grant, kind/unit)` and superseded on
reuse.** Direct owner decision. Uploading a new image for the same slot
replaces and deletes the previous one; otherwise the file lives until the
session closes. **`ROADMAP.md`'s own framing of this choice contains an
unsafe option the planner must not reach for:** "deleted as soon as its
`AUTOSTART` reply confirms consumption" — an `AUTOSTART` reply confirms the
command was accepted, not that the load completed, and for
`vice_disk_attach` the image stays attached to unit 8 for the rest of the
session (`stock-machine.ts`'s `DISK_ATTACH_APPROXIMATION`). Reversibility:
reversible — the slot key is internal to the broker.

**D-06: Staged files live in one directory per session,
`<VICE_BROKER_HOME>/staging/<session>/`, with handle-named files inside.**
Direct owner decision. "Gone when the session closes" becomes one `rm -rf`
of one directory rather than per-file bookkeeping, and the directory is
also the natural sweep unit.

**D-07: The `XFER-07` crash sweep runs at broker startup only. There is no
timer.** Direct owner decision. `SESS-03`/`SESS-04` already reclaim on
socket events and bounded liveness detection, so the only residue a sweep
can ever find is what a crashed broker left — unambiguous exactly when the
next broker starts. A periodic timer was offered and declined: it adds an
interval to tune and a window where the sweep can race a live transfer.

**D-08: The `vice-broker-vicerc-*` per-launch scratch dirs move under
`VICE_BROKER_HOME` and are reaped there.** Direct owner decision, folding
the `resolves_phase: 64` todo as real work. **The two kinds have OPPOSITE
lifetime rules and one sweeper must honour both.** A staged file must not
outlive its session. A vicerc dir must outlive the function that created
it, for the whole lifetime of the emulator process that uses it
(`broker-launch.mts:318-327` records this deliberately). The todo's own
live-pid guard is therefore mandatory, not optional. Named cost, accepted:
moving these dirs off `/tmp`'s tmpfs stops the RAM leak (4,779 dirs
measured after 7 days uptime) but lands them on real disk, surviving
reboot — the sweep becomes load-bearing rather than a nicety. Build-artifact
coupling: `broker-launch.mts` is `.mts`, compiled into committed
`resources/broker-launch.mjs`; `resources-sync.test.ts` fails CI on drift;
the regenerated artifact ships in the same commit, and the header comment
saying the code "deliberately does NOT clean the directory up" must be
rewritten in the same change. Reversibility: costly.

**D-09: The size cap is 16 MiB.** Direct owner decision. Roughly 19× the
largest fixed C64 artifact and ~16× a `.g64`. Sizing data: `.d64` = 174,848
bytes exactly; `.d71` = 349,696; `.d81` = 819,200; `.g64` ≈ 1 MB; a `.prg`
at most ~64 KB. A `.vsf` with `include_disks: true` embeds attached images
and is the one unbounded-ish case. Named cost, accepted: 16 MiB is NOT
headroom for Phase 65's host-tool outputs (Ghidra run artifacts can be tens
of MB) — the 64 MiB alternative was offered specifically so the number
would not be reopened and was declined. Phase 65 may have to revisit this
number, and that was foreseen here.

**D-10: The cap is a constant. There is no environment knob.** Direct owner
decision, following Phase 62's precedent. A cap that can be raised by env is
a cap an agent can talk a user into raising; a constant keeps the refusal
honest and the security posture trivially auditable. Reversibility:
reversible — adding a knob later is additive.

**D-11: The cap is enforced at BOTH ends.** Direct owner decision. The
sender refuses before a single payload byte moves, from the `byteLength`
declared in the header line. The receiver enforces independently as bytes
arrive, because a declared length is untrusted input. Named cost, accepted:
the receiver needs a mid-stream abort path that destroys the connection and
unlinks the partial file, not merely a refusal.

**D-12: One uniform cap across all four tools. Not per file kind.** Direct
owner decision. One number, one refusal message, and the transfer layer
stays ignorant of C64 file formats — which is what lets Phase 65 put
host-tool outputs through the same code without teaching it about Ghidra.
Named cost, accepted: the cap will not catch "you handed
`vice_disk_attach` a 4 MB file that cannot be a disk image" — that stays
the tool's own validation problem. **Settled by existing precedent, not
discussed, and not open:** the digest is sha256 (`host-tool.mts:2282` is
the in-repo precedent), and the client-side write is
write-to-temp-then-`renameSync` on the same filesystem — the established
pattern in five modules (`broker-incident.mts:222`, `broker-epoch.mts:104`,
`vice-broker.mts:349`, `anno-store.ts:1469`, `anno-export-asm.ts:2383`).

**D-13: The client keeps owning the destination name. `XFER-03`'s validator
is built and tested but has NO live producer in this phase.** Direct owner
decision. `vice_snapshot_save`'s `name` stays client-owned and
`sanitizeSnapshotName()`'s existing rule (1–64 chars, alphanumeric,
underscore or hyphen, `stock-paths.ts:160`) stands. The containment
validator `XFER-03` requires is built and tested as a pure function over
traversal fixture strings with no I/O, covering `../../etc/passwd`,
`/etc/passwd`, `C:\`, and a NUL-embedded name, refusing rather than
sanitising. **Recorded so nobody later misreads a green test:** the
validator's first live producer is Phase 65; a passing test in Phase 64 is
evidence the validator is correct, NOT evidence a real broker-supplied name
was ever exercised. The alternative (broker supplies the name in the
download header) was offered and declined.

**D-14: `vice_autostart`'s and `vice_disk_attach`'s `path` stays
unrestricted — any absolute path on the client.** Direct owner decision,
taken with the security cost stated in the question and chosen anyway.
`resolve(path)` keeps its current meaning: the client reads that file and
streams it. Confining it to the workspace was offered and declined — it is
a regression dressed as hardening. Named cost, accepted and recorded rather
than discovered later: the broker is now machine-level and shared across
every project, so this is a route for reading any client-readable file
into broker-owned staging. It is bounded by D-09's 16 MiB cap and D-06's
session-scoped staging directory, and it is accepted. Reversibility:
costly.

**D-15: The result's broker-side `sentPath` field is replaced by the opaque
handle.** Direct owner decision. `ROADMAP.md`'s criterion 2 requires the
tool result to name the client's local path "and no broker-side path"; a
handle is not a path. `sentPath` was informally serving as the only
correlation thread between a tool result and broker-side diagnostics, which
`vice-wedge-triage` depends on — the handle preserves that thread without
leaking a path. Named cost, accepted: an opaque token now appears in a
result, and an agent will be tempted to reuse it as an argument somewhere
it is not accepted. Reversibility: one-way — a breaking change to a
published tool's result shape.

**D-16: A game's writes to an attached disk image are an ACCEPTED, NAMED
LOSS.** Direct owner decision. **This regression is named nowhere in
`ROADMAP.md` or `REQUIREMENTS.md` and was surfaced during this
discussion.** A disk image attached to unit 8 is writable; under the old
shared-filesystem model those writes landed in the user's own file. Under
D-01 + D-06 the emulator writes to the broker's staged copy, deleted when
the session closes — write-through-to-nowhere. The tool result and the docs
must say so explicitly and by name, matching `docs/stock-hard-losses.md`'s
shape. Pulling the image back on session close was offered and declined:
`SIGKILL`, a crash and a recycle all produce no clean close, so the
guarantee would be "usually," worse to document than a flat loss. A
read-only attach is not reachable and must not be planned — MEASURED
2026-09-23: no resource-set tool on the advertised surface, and `AUTOSTART`
(0xdd) has no read-only flag. Reversibility: reversible as a decision, but
the loss itself is a user-visible behaviour change documentation must carry
from here on.

**D-17: "No shared filesystem" is proved by disjoint roots plus
observation, NOT by an injected filesystem seam.** Direct owner decision,
taken AGAINST the recommendation offered. The test runs with the client's
`.c64-re-tools` under temp dir A and the broker's `VICE_BROKER_HOME` under
temp dir B, disjoint; it asserts the expected file appears under A, that
B's staging is empty after close, and that no B-side path appears in any
tool result or wire field. **The weaker guarantee, recorded verbatim from
the option the owner chose:** it proves nothing leaked, not that nothing
was opened — a stray read of a B path that happens to succeed still
passes. Two consequences the planner must carry: (1) the transfer modules
do NOT need an injectable filesystem-root seam — do not add one; (2) a
source-scanning guard is not an available fallback (`260914-poo` D-1 is
locked). A real container run in CI was offered as the only true proof and
declined.

**D-18: The convergence metric (6 → 4 at this phase's exit) is MEASURED AND
RECORDED in the phase evidence, not mechanically asserted.** Direct owner
decision. An importer count is a text question by construction, and D-1
bans asserting on text. Phase 66's exit is where the metric becomes a gate.
The precedent is genuinely mixed: `anno-hazard-report.test.ts:1127` still
runs a source-text scan that survived the D-1 purge — not a licence to add
another one. Named cost, accepted: nothing mechanical catches a regression
between Phase 64 and Phase 66. The metric moves because `stock-machine.ts`
stops importing `stock-paths.ts`; `stock-paths.ts` itself survives until
Phase 66 deletes it.

**D-19: `host-tool.mts`'s byte-payload prohibition is left entirely to
Phase 65.** Direct owner decision. MEASURED at `host-tool.mts:64-65`: "No
inline byte payload on a host-tool response, at any result size — every
result crosses as `{ path, sha256, byteLength }`, never bytes." Clause one
survives the whole milestone (under D-01 bytes ride a separate transfer
connection, so a host-tool response would carry a handle, never bytes).
Clause two goes stale only when Phase 65 replaces `path` with a handle.
Nothing is stale at this phase's exit, because Phase 64 never touches
`host_tool`.

### Claude's Discretion

The owner delegated the todo disposition (the `cross_reference_todos` step)
with "you decide." That judgement is recorded under Folded Todos in
64-CONTEXT.md with its reasoning, so the planner can disagree in writing
rather than silently.

Everything else is a direct owner decision. Fifteen of the nineteen were
taken as the recommended option; D-17 was taken against the recommendation
and its weaker guarantee is recorded verbatim above rather than softened.

A planner who finds a constraint none of the offered options contained
should say so in writing rather than implement an option as originally
worded — the same standing rule Phase 62's D-07 and D-08 established.

**Folded Todos:**
- **`Reap vicerc scratch dirs in broker kill/recycle path`** — FOLDED AS
  REAL WORK (see D-08 above). The fix does NOT go at the scratch-dir
  creation site — it goes in the kill/recycle path, which already knows
  when an instance's process has actually exited.
- **`wrapPossiblyChunked() is orphaned`** — FOLDED FOR AWARENESS ONLY, NOT
  AS WORK. A cap on tool-result CHARACTERS returned to Claude, not on
  payload BYTES crossing the socket — a different axis. The new `XFER-06`
  cap must not inherit the dead one's vocabulary, must not be wired into
  `_meta`, and must not imply `vice_result_continue` now works.

### Deferred Ideas (OUT OF SCOPE)

- A read-only disk attach, which would make D-16's loss visible rather
  than silent. Not reachable today: no resource-set tool exists on the
  advertised surface and `AUTOSTART` has no read-only flag.
- The 16 MiB cap may need revisiting in Phase 65 (D-09). Ghidra run
  artifacts can be tens of MB.
- Nothing mechanical guards the convergence metric between Phase 64 and
  Phase 66 (D-18). Accepted; named so Phase 66 does not assume continuous
  protection.
- `wrapPossiblyChunked()`'s orphaning stays open and still needs a product
  decision — not this phase's axis.
- `CR-01` at `text-protocol.ts:850` — an inert timeout inside the text
  channel, carried by decision. This phase does not plan to touch it; if a
  plan ends up there, record it as a deliberate closure.
- Reviewed-not-folded todos: `BACK-05` D-G ordering flake (resolves_phase:
  66; its trap CLASS — dynamic ports — is folded into this research's own
  testing guidance, its resolution is not); `disconnect-while-queued`
  timing flake in `broker-e2e.test.ts` (not this phase's to fix); "Remove
  anno from the MCP surface" and "Remove pre-warm" (owned by Phase 65 /
  unowned respectively).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XFER-01 | A request that produces a file returns its bytes over the socket; the client writes them under its own `.c64-re-tools/` per-kind directory and the response carries that local path | Architecture Patterns (system diagram, download path), Code Examples (Pattern 3, atomic publish), Validation Architecture test map |
| XFER-02 | A request that consumes a file is given a local path by its caller, reads it client-side, and streams the bytes to the broker | Architecture Patterns (system diagram, upload path), Code Examples (Pattern 2, streaming hash Transform) |
| XFER-03 | A client refuses a broker-supplied destination name that would escape its `.c64-re-tools/` per-kind directory — traversal segments, absolute paths, separators and NUL bytes are refused, not sanitised | Code Examples (`validateContainedDestination()`), Don't Hand-Roll (path traversal row), Security Domain (V5 Input Validation) |
| XFER-04 | The broker chooses its own staging paths and a client never supplies one; a client refers to a staged file only by an opaque handle the broker minted | Architecture Patterns (staging directory), Standard Stack (`node:crypto randomBytes` handle-minting precedent), Common Pitfalls (Pitfall 1) |
| XFER-05 | File bytes survive the round trip unaltered, including bytes that are not valid UTF-8 | Common Pitfalls (Pitfall 2, UTF-8 decode corruption), Validation Architecture (XFER-05 row, real multi-megabyte buffer requirement) |
| XFER-06 | A transfer is integrity-checked end to end, and one that exceeds the size cap is refused with a message naming the limit | Code Examples (Pattern 2, cap enforcement), Common Pitfalls (Pitfall 3), Security Domain (D-11 both-ends enforcement) |
| XFER-07 | Staged files are removed when their session closes, and a sweep removes those left behind by a crash | Architecture Patterns (D-06/D-07 staging lifecycle), Runtime State Inventory (D-08's sweeper), Common Pitfalls (Pitfall 4) |
| XFER-08 | `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save` and `vice_snapshot_load` all work over the socket with no shared filesystem between client and broker | Architecture Patterns (full system diagram), Code Examples (declared four-tool table), Validation Architecture (XFER-08 row, D-17's disjoint-roots proof) |
</phase_requirements>

## Summary

Phase 64 has almost no external-library surface. The entire deliverable —
framing a byte payload, streaming it with backpressure, hashing it end to
end, staging it broker-side, writing it atomically client-side, and
refusing a bad destination name — is built from Node's own `node:net`,
`node:crypto`, `node:stream` and `node:fs` primitives, composed the same
way this codebase already composes them elsewhere. Nothing here needs an
npm dependency; the "standard stack" for this phase **is** the Node
standard library, used through the same injectable-options, never-throw,
one-module-per-seam conventions the rest of `src/mcp/vice/` already
follows.

The load-bearing research finding is that **this phase is not inventing a
protocol from nothing** — it is the twelfth arm on an eleven-member
dispatch switch `[VERIFIED: src/mcp/vice/broker-control.mts:93]`
(`export type ControlRequestKind = "acquire" | "release" | "recycle" |
"status" | "host_state" | "monitor_claim" | "monitor_release" |
"host_tool" | "hello" | "attach" | "operation";`), and the dial half of it
is a near-literal copy of `dialMonitorRelay()`
(`src/mcp/vice/broker-endpoint.ts:706-779`), which already does "two-candidate
hello race, keep the winner, write one JSON line, read the reply with a
byte-level terminator search, hand back whatever pending bytes followed
it" for the `attach` op Phase 63 shipped. The five atomic-publish sites
already in the tree (`broker-incident.mts:222`, `broker-epoch.mts:104`,
`vice-broker.mts:349`, `anno-store.ts:1469`, `anno-store.ts:2668`,
`anno-export-asm.ts:2390` — six, not five, confirmed by direct grep this
session) establish `renameSync`-after-temp-write as this codebase's one
atomic-publish idiom, and `host-tool.mts:2269-2283`'s `digestOutputFile()`
establishes `createHash("sha256").update(contents).digest("hex")` as the
one digest idiom, though that helper reads the whole file into memory with
`readFileSync` first — the phase's own D-04 decision (a streaming hashing
`Transform`) is genuinely new work, not a second copy of an existing
pattern, because nothing in this codebase today streams a hash. A repo-wide
search this session (`grep -rn "node:stream\|Transform\|createReadStream" *.ts
*.mts`, excluding tests) returned zero non-test hits — no prior art to
imitate for the streaming half.

**Primary recommendation:** Reuse `dialMonitorRelay()`'s two-candidate
hello-race-then-attach shape verbatim for the transfer dial (new tag,
same `broker-endpoint.ts` module, same never-throw posture); reuse
`broker-control.mts`'s Buffer-carry `indexOf(0x0a)` line reader verbatim
for reading the header line off a transfer connection; and write the one
genuinely new primitive — a `Transform` that counts bytes, hashes them
with `node:crypto`'s streaming `Hash` object, and destroys the stream past
the cap — as a single new module, imported by both the upload and download
halves so the cap-enforcement and hashing logic exists exactly once.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File-transfer dial (candidate race, attach line) | API / Backend (`broker-endpoint.ts`, container-side) | — | Same module Phase 62/63 already made "THE ONE AUTHORITATIVE PLACE for dialling the fixed machine-level broker endpoint" (`broker-endpoint.ts:1-6`); a transfer dial is a new exported function in the same file, not a new module |
| Transfer connection dispatch (`transfer` op, handle check) | API / Backend (`broker-control.mts`, host-bound) | — | Twelfth arm on the existing `ControlRequestKind` switch, dispatched by `attachControlProtocol()` the same way `attach` is |
| Byte streaming with backpressure + hashing + cap | API / Backend, split across both processes | — | `pipe()`-based; the sending side runs wherever the file currently lives (client for upload, broker for download), the receiving side on the other |
| Staging directory lifecycle (mint, supersede, sweep) | Database / Storage (broker-owned, host filesystem) | API / Backend (`broker-launch.mts`/`vice-broker.mts` own the sweep trigger) | D-06: one directory per session under `VICE_BROKER_HOME`; D-07: swept only at broker startup |
| Client-side atomic write + local path in result | Browser / Client (in this project's vocabulary: the container-side MCP process, i.e. the "client" relative to the broker) | — | Bytes land under the client's own `.c64-re-tools/<kind>/`; `renameSync`-after-temp-write, the codebase's existing idiom |
| Path-containment validation (traversal refusal) | API / Backend (pure function, no I/O) | — | D-13: built and tested this phase but has no live producer until Phase 65 |
| Ownership / grant check on a transfer op | API / Backend (`broker-control.mts`'s `ownsTarget()`) | — | D-01: checked on the **command** connection (which holds the grant); the **payload** connection is authorised by the handle alone, mirroring `attach`'s own `T-63-01` precedent |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:net` | Node 24 built-in `[VERIFIED: node --version → v24.20.0, measured this session]` | TCP dial/listen for the transfer connection | Already the transport for every other connection in this codebase (`broker-endpoint.ts`, `broker-control.mts`) |
| `node:crypto` | Node 24 built-in | `createHash("sha256")`, used both in one-shot form (`host-tool.mts:2269-2283`, existing) and streaming form (new, D-04) | Existing in-repo precedent for the digest algorithm choice; no new dependency |
| `node:stream` (`Transform`) | Node 24 built-in | The hashing/counting transform D-04 requires between `createReadStream`/socket and the destination | Node's own composable stream primitive; `pipe()` is what the `broker-relay.mts` header explicitly requires for exactly this shape ("`Socket.prototype.pipe()` is the stdlib primitive for exactly this") |
| `node:fs` (`createReadStream`, `mkdtempSync`, `renameSync`, `rmSync`) | Node 24 built-in | Client-side file read, broker-side staging dir creation, atomic publish, staging cleanup | `renameSync`-after-temp-write is a six-site existing idiom (see Summary); `mkdtempSync` is the existing `broker-launch.mts:548` idiom for a fresh, race-free scratch dir |
| `node:crypto` (`randomBytes`) | Node 24 built-in | Minting the opaque broker-side handle (D-04/XFER-04) | Existing in-repo precedent: `monitorClients[channel].handle` is already "a 16-byte random hex string MINTED by `vice-broker.mts`'s `handleMonitorClaim()`" (`broker-state.mts` header comment, quoted verbatim in Code Context) — the same minting idiom, reused for a staged-file handle |

### Supporting

None. This phase adds no new runtime dependency. `package.json`'s existing
`files[]` list and `dependencies` block (`@mastra/mcp`, `@mastra/core`)
[VERIFIED: src/mcp/vice/package.json:1-40, read this session] are
untouched by this phase's design — every primitive above is Node stdlib.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A JSON header line + raw byte count (D-02) | Length-prefixed binary chunking (`[4B BE length][payload]` repeated) | Offered and **declined** by the owner — "it would genuinely be a new envelope," and `REQUIREMENTS.md` decision 6 forbids a new envelope format |
| A JSON header line + raw byte count | base64-inside-the-JSON-line | Offered-and-rejected in CONTEXT.md itself: 33% size inflation, `MAX_LINE_BYTES` is 65536 (`broker-control.mts:487`), and it "puts a payload back into string mode — the exact corruption Phase 63's Buffer carry exists to prevent" |
| A streaming hashing `Transform` (D-04) | A manual write/drain loop | Declined — `broker-relay.mts`'s own header forbids hand-rolling the byte copy loop |
| A streaming hashing `Transform` | Reading the whole file with `readFileSync` then hashing one-shot (the existing `host-tool.mts:2269-2283` pattern) | Rejected by D-04 for the transfer path specifically: "a payload buffered whole into memory is a silent OOM ceiling that moves with whichever tool produces the largest artifact next" (`ROADMAP.md` cross-cutting constraint, quoted in the phase description) |

**Installation:** none required — no `npm install` line for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new npm packages. Every
primitive it needs (`node:net`, `node:crypto`, `node:stream`, `node:fs`,
`node:path`) is a Node.js built-in module, already imported throughout
`src/mcp/vice/`. The Package Legitimacy Gate protocol (registry lookup,
`gsd_run query package-legitimacy check`) has nothing to check against and
was not run for that reason, not skipped by oversight.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          CLIENT (container-side MCP process, or a skill script)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  vice_snapshot_save / vice_snapshot_load / vice_autostart / disk_attach  │
  │                                                                            │
  │   1. Command connection (existing, grant-holding)                        │
  │      -> stock-machine.ts handler -> session.client.send(DUMP/UNDUMP/     │
  │         AUTOSTART) over the RELAYED monitor connection (Phase 63)        │
  │                                                                            │
  │   2. Transfer connection (NEW, short-lived, stateless)  ─────────────┐   │
  │      dial via broker-endpoint.ts's new transfer-dial function        │   │
  │      (same two-candidate hello race as dialMonitorRelay())           │   │
  │                                                                        │   │
  │   UPLOAD (client produces bytes, e.g. vice_disk_attach's `path`):    │   │
  │     createReadStream(localPath)                                      │   │
  │       .pipe(hashAndCountTransform)   <- new D-04 primitive           │   │
  │       .pipe(transferSocket)  ── JSON header line, then N raw bytes ──┼──▶│
  │                                                                        │   │
  │   DOWNLOAD (broker produces bytes, e.g. vice_snapshot_save's result):│   │
  │     transferSocket  ◀── JSON header line, then N raw bytes ──────────┼───│
  │       .pipe(hashAndCountTransform)                                   │   │
  │       .pipe(writeStream(tmpPath))                                    │   │
  │     renameSync(tmpPath, finalPath) once digest+length verified       │   │
  │     -> result carries LOCAL path only, plus the opaque handle        │   │
  └──────────────────────────────────────────────────────────────────────┘   │
                                                                                │
                                                            same fixed :19510  │
                                                            endpoint, new tag  │
                                                                                ▼
                          BROKER (host-bound, machine-level, one process)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  broker-control.mts: attachControlProtocol()                             │
  │    ControlRequestKind gains a 12th member alongside "attach"             │
  │    (broker-control.mts:93) -- dispatched the SAME way: relayMode-style   │
  │    flag flips true, ownership NOT checked here (D-01 -- the handle IS    │
  │    the authority, same as T-63-01's attach precedent), remaining bytes   │
  │    on this connection are the payload, never re-parsed as JSON           │
  │                                                                            │
  │  Staging: <VICE_BROKER_HOME>/staging/<session>/<handle>  (D-06)          │
  │    keyed by (grant, kind/unit) (D-05) -- superseded on reuse             │
  │    swept at broker startup only (D-07); rm -rf'd on session close        │
  │                                                                            │
  │  Ownership check happens on the COMMAND connection, not this one:        │
  │    broker-control.mts's `attach`-sibling arm does NOT call ownsTarget()  │
  │    (broker-control.mts:1360-1363, T-63-01) -- same posture inherited     │
  └──────────────────────────────────────────────────────────────────────────┘
```

A reader tracing `vice_snapshot_save` end to end: `stock-machine.ts`'s
`handleSnapshotSave` (unchanged call shape) issues `DUMP` over the
existing relayed monitor connection → the emulator writes the `.vsf` to a
broker-chosen staging path (not a shared filesystem path the client named)
→ the handler opens a **new, short-lived transfer connection** through
`broker-endpoint.ts`, presents the handle the DUMP reply carried → the
broker streams the staged bytes down that connection with a hashing
`Transform` in front → the client writes them atomically under
`.c64-re-tools/snapshots/` → the tool result names that local path and the
handle, never a broker path.

### Recommended Project Structure

No new top-level directories. The transfer protocol's code lands beside
its siblings by the existing per-seam convention:

```
src/mcp/vice/
├── broker-endpoint.ts       # + dialFileTransfer() (or similarly named),
│                             #   alongside dialBrokerEndpoint()/dialMonitorRelay()
├── broker-control.mts       # + "transfer" (or "download"/"upload") arm on
│                             #   ControlRequestKind, dispatched like "attach"
├── broker-relay.mts         # possibly extended, or a new sibling
│                             #   broker-transfer.mts -- planner's call; either
│                             #   way it is ONE module that owns the streaming
├── transfer-hash.{ts,mts}   # NEW: the streaming counting+hashing Transform
│                             #   (D-04) and the size-cap enforcement, shared
│                             #   by upload and download, both processes
├── transfer-paths.ts        # NEW (or folds into stock-paths.ts's successor):
│                             #   the pure path-containment validator (D-13/
│                             #   XFER-03), no I/O, tested against fixture
│                             #   strings only
├── stock-machine.ts         # the four handlers migrate off withEmulatorSidePath()
│                             #   onto the transfer dial
└── stock-paths.ts           # UNCHANGED this phase (survives to Phase 66);
                              #   sanitizeSnapshotName()/snapshotPathFor() are
                              #   still the client-side name owner per D-13
```

### Pattern 1: Two-candidate dial, keep the winner, one line, byte-level read

**What:** `dialMonitorRelay()`'s exact shape — race `DIAL_CANDIDATES` on the
fixed port, destroy the losers, write one JSON line over the winner,
read the reply by scanning for `0x0a` on the raw `Buffer` accumulator
(never `.toString("utf8")` on the whole thing), hand back whatever bytes
followed the terminator.

**When to use:** For the transfer dial. It is the identical connection
-establishment shape; only the line's `op` and what happens after the
reply differ (a payload phase instead of a splice).

**Example:**
```typescript
// Source: src/mcp/vice/broker-endpoint.ts:639-693 (performAttach()) and
// :706-779 (dialMonitorRelay()) -- read this session, adapted here to show
// the shape a transfer dial would copy. Field names below (`op: "transfer"`,
// etc.) are illustrative, NOT verified wire values -- the exact vocabulary
// is the planner's/executor's to choose within D-01/D-02's constraints.
function performTransferHandshake(
  socket: Socket,
  opts: { targetId: string; handle: string; direction: "upload" | "download" },
  replyTimeoutMs: number,
  resolveOuter: (result: TransferDialResult) => void,
): void {
  let carry: Buffer = Buffer.alloc(0);
  let settled = false;
  // ... identical timer/finish() scaffolding to performAttach() ...
  socket.on("data", (chunk: Buffer) => {
    carry = Buffer.concat([carry, chunk]);
    const idx = carry.indexOf(0x0a); // byte-level, never string search
    if (idx === -1) return;
    const headerText = carry.subarray(0, idx).toString("utf8");
    const pendingPayloadBytes = carry.subarray(idx + 1); // may already
    // contain some/all of the payload in the same TCP segment -- the same
    // "pending" concern performAttach()'s own header names for REGISTER_INFO
    let header: unknown;
    try { header = JSON.parse(headerText); } catch { header = null; }
    // ... validate header shape, then hand `pendingPayloadBytes` to the
    // streaming Transform as its first chunk, exactly as dialMonitorRelay()
    // hands `pending` to ViceMonitorClient.attach() ...
  });
}
```

### Pattern 2: A streaming hash+count `Transform` with a hard cap (new to this codebase)

**What:** A `Transform` subclass (or `stream.Transform({ transform, flush })`
factory) that updates a `node:crypto` `Hash` object and a running byte
count in its `_transform`, calls `callback(err)` with an error the instant
the running count exceeds the cap (D-11: enforced as bytes arrive, not
only from the declared header length), and exposes the final digest/count
in `flush` or via a property read after `'finish'`.

**When to use:** Spliced into every transfer pipe, both directions —
`createReadStream(path).pipe(hashAndCountTransform).pipe(socket)` on the
sending side, `socket.pipe(hashAndCountTransform).pipe(writeStream)` on
the receiving side. `pipe()` supplies real backpressure (pause on a slow
destination, resume on `'drain'`) with zero extra code — this is exactly
what `broker-relay.mts`'s header cites `Socket.prototype.pipe()` for.

**Example:**
```typescript
// New primitive -- no direct in-repo precedent (Summary's own repo-wide
// grep for Transform/createReadStream returned zero non-test hits). Shape
// follows Node's own documented Transform contract; the crypto/backpressure
// composition is this project's design choice, not copied from source.
import { Transform, type TransformCallback } from "node:stream";
import { createHash, type Hash } from "node:crypto";

export interface HashAndCountResult {
  byteLength: number;
  sha256: string;
}

export function createHashAndCountTransform(capBytes: number, onExceeded: (seenBytes: number) => Error): Transform {
  const hash: Hash = createHash("sha256");
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc: BufferEncoding, callback: TransformCallback) {
      seen += chunk.length;
      if (seen > capBytes) {
        // D-11's mid-stream abort: destroy rather than merely refuse --
        // the receiving side's partial temp file must be unlinked by the
        // caller on this error, never left at its final name (D-04's named
        // cost, criterion 3).
        callback(onExceeded(seen));
        return;
      }
      hash.update(chunk);
      callback(null, chunk); // pass the bytes through unchanged
    },
  });
}
```

### Pattern 3: Atomic publish — temp write, then `renameSync` on the same filesystem

**What:** Write to a temp path inside the SAME directory as the final
destination, then `renameSync(tmpPath, finalPath)` once the transfer is
fully verified (length matches, digest matches). A dropped connection or
a cap violation mid-stream must `rmSync`/`unlink` the temp path and never
reach the `renameSync` call — this is what makes criterion 3 ("never
leaves a file visible at its final name") true by construction rather
than by a cleanup pass.

**When to use:** Client-side write of a downloaded file (snapshot bytes
arriving for `vice_snapshot_load`... actually for `vice_snapshot_save`'s
result, or any produced artifact under `.c64-re-tools/<kind>/`).

**Example:**
```typescript
// Source: the six-site existing idiom, e.g.
// src/mcp/vice/broker-epoch.mts:104 (renameSync(tmpPath, finalPath)) and
// src/mcp/vice/anno-store.ts:1469 (renameSync(stagingPath, snapPath)) --
// read this session; this is the SAME shape, not a new one.
const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
try {
  const ws = createWriteStream(tmpPath);
  await pipeline(transferSocket, hashAndCountTransform, ws); // node:stream/promises
  if (observedDigest !== headerDigest || observedLength !== headerByteLength) {
    throw new Error(`vice: transfer integrity check failed -- expected sha256 ${headerDigest} (${headerByteLength} bytes), got ${observedDigest} (${observedLength} bytes)`);
  }
  renameSync(tmpPath, finalPath); // same filesystem, never EXDEV
} catch (err) {
  try { rmSync(tmpPath, { force: true }); } catch { /* best-effort */ }
  throw err;
}
```

### Anti-Patterns to Avoid

- **Accumulating the payload as a JS string.** The two remaining legacy
  framers at `vice-broker-client.ts:534` and `vice-broker-client.ts:1013`
  [VERIFIED: read this session — both use `buffer += chunk.toString("utf8")`]
  are the exact corruption D-03 documents and explicitly declines to fix,
  because that whole module is legacy (`broker-endpoint.ts:17-25`
  forbids importing it) and `RM-02` deletes it in Phase 66. Do not pattern
  -match new transfer code on those two sites.
- **Buffering the whole payload before hashing or writing.** This is
  exactly what `host-tool.mts:2269-2283`'s existing `digestOutputFile()`
  does (`readFileSync` then `createHash(...).update(contents)`) — correct
  for that call site's small, already-on-disk artifacts, wrong for a
  transfer that must stream (D-04's whole point).
- **Deleting a staged upload on the AUTOSTART/DUMP/UNDUMP reply.** D-05
  explicitly names this as the roadmap's own unsafe framing: a reply
  confirms the command was *accepted*, not that the load *completed*, and
  for `vice_disk_attach` the staged image must remain attached to unit 8
  for the rest of the session.
- **A periodic sweep timer.** D-07 explicitly declines this — startup-only
  sweep, because `SESS-03`/`SESS-04` (Phase 63) already reclaim on socket
  events, so only a crashed broker leaves residue, and that is unambiguous
  exactly once, at the next broker's startup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Byte streaming with flow control | A manual `socket.write()`/`'drain'` loop | `Stream.pipe()` (or `stream/promises`' `pipeline()`) | `broker-relay.mts`'s own header forbids this exact hand-roll: "Never hand-roll the byte copy loop between the two sockets. `Socket.prototype.pipe()` is the stdlib primitive for exactly this" |
| SHA-256 digesting | A hand-rolled incremental hash accumulator | `node:crypto`'s `createHash("sha256")`, fed via `Transform._transform`'s `hash.update(chunk)` | `host-tool.mts:2269-2283` already establishes sha256 as this codebase's digest algorithm; `node:crypto`'s `Hash` object is already streaming-capable, no library needed |
| Opaque handle minting | A sequential counter or a predictable ID | `node:crypto`'s `randomBytes` (or the equivalent `crypto.randomUUID()`/hex encoding) | `monitorClients[channel].handle` is already "a 16-byte random hex string MINTED by `vice-broker.mts`'s `handleMonitorClaim()`" (verbatim, `broker-state.mts` header) — same idiom, same rationale: a predictable ID would let a caller guess another session's handle |
| Path traversal defense | A sanitiser that strips `..`/absolute prefixes | A validator that REFUSES rather than sanitises (D-13/XFER-03) | `sanitizeSnapshotName()`'s own pattern (`stock-paths.ts:160-169`, a strict allow-list regex that throws) is the precedent to follow, not a strip-and-continue transform — silently rewriting a malicious name can still collide with something real |
| Atomic file publish | `fs.copyFile` then `fs.unlink` the source, or a direct overwrite of the final path | Temp-write-then-`renameSync` (six existing sites, see Summary) | A direct write leaves a half-written file visible at its final name if the process dies mid-write; `renameSync` on the same filesystem is atomic at the OS level |

**Key insight:** Every primitive this phase needs already has an in-repo
precedent *except* the streaming hash+cap `Transform`, and even that one
composes two well-precedented halves (`node:crypto`'s streaming `Hash`
API, already implicitly used one-shot; `Stream.pipe()`, already mandated
by `broker-relay.mts`'s header) that this codebase simply had not yet
needed to combine, because Phase 63's relay is byte-transparent and
untouched (it never hashes or caps anything) — Phase 64 is the first place
a payload needs to be measured and verified while it moves, not merely
forwarded.

## Runtime State Inventory

> This phase is primarily greenfield (a new transfer protocol, new staging
> directories, four tool migrations). It is included here narrowly because
> D-08 folds in one genuine migration: relocating `broker-launch.mts`'s
> per-launch `XDG_CONFIG_HOME` scratch directories.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — this phase creates new staging state, it does not rename or relocate any existing data record (no database, no collection name, no user_id touched). | None |
| Live service config | None — no external service (n8n, Datadog, etc.) is in scope for this codebase at all; not applicable here. | None |
| OS-registered state | **`broker-launch.mts:548`'s `mkdtempSync(join(tmpdir(), "vice-broker-vicerc-"))` scratch dirs move from the OS temp dir to under `VICE_BROKER_HOME` (D-08).** Confirmed by direct read: the function "deliberately does NOT clean the directory up" (comment at `broker-launch.mts` immediately preceding line 548, read this session) because "the spawned emulator process outlives this function's return and needs the directory for its whole lifetime." 4,779 such directories were measured after 7 days of uptime on this host's tmpfs (CONTEXT.md D-08, cited from a prior measurement, not re-measured this session — carries `[CITED: 62-CONTEXT.md / prior todo]`, not `[VERIFIED]` here). | **Code edit**, not data migration: `broker-launch.mts:548`'s `tmpdir()` call is redirected to a path under `brokerHome()`/`VICE_BROKER_HOME` (from `broker-home.mts`, already exists — `[VERIFIED: src/mcp/vice/broker-home.mts, read this session]`), and the header comment naming the deliberate no-cleanup must be rewritten in the SAME change (it becomes actively misleading once a sweeper exists). A live-pid guard in the kill/recycle path is MANDATORY (D-08) — a crashed broker can leave a still-running emulator child whose scratch dir must not be reaped out from under it. |
| Secrets/env vars | None — no secret or credential is renamed; the milestone already dropped the per-boot token (`REQUIREMENTS.md` decision 5), unaffected by this phase. | None |
| Build artifacts | **`broker-launch.mts` is `.mts`, compiled by `build.ts` into `resources/broker-launch.mjs`; `resources-sync.test.ts` fails CI on drift.** [VERIFIED: build.ts's `HOST_BOUND_ARTIFACTS` array includes broker-launch.mts, confirmed by grep this session — `grep -n "broker-launch" build.ts` returns a match inside that array] | Any edit to `broker-launch.mts` for D-08 ships its regenerated `resources/broker-launch.mjs` in the SAME commit. |

**Nothing else found in any other category** — verified by reading
`stock-machine.ts`, `stock-paths.ts`, `broker-endpoint.ts`,
`broker-control.mts` and `broker-relay.mts` directly this session; none of
them hold a runtime state record whose *key* (as opposed to its
implementation) is being renamed by this phase. The four migrated tools'
*argument names* (`path`, `name`, `unit`) are explicitly UNCHANGED by
`REQUIREMENTS.md`'s Out of Scope table ("Changing any tool's semantics or
arguments... This milestone changes how requests and files reach the
broker, not what the emulator is asked to do").

## Common Pitfalls

### Pitfall 1: Treating an AUTOSTART/DUMP/UNDUMP reply as proof of completion

**What goes wrong:** Deleting a staged upload as soon as the command reply
arrives (the framing `ROADMAP.md`'s own notes offered and D-05 rejected).
**Why it happens:** The reply *looks* like "done" from the caller's side.
**How to avoid:** Key staged files by `(grant, kind/unit)` (D-05) and
delete only on supersession or session close — never on a command reply.
**Warning signs:** A `vice_disk_attach` that works once then fails on any
subsequent read from the same unit within the same session; a game's save
silently vanishing mid-session rather than only at session close.

### Pitfall 2: Decoding a mid-payload chunk as UTF-8 anywhere in the receive path

**What goes wrong:** `chunk.toString("utf8")` on a chunk that straddles
the header/payload boundary, or on any payload chunk at all, corrupts
non-UTF-8 bytes (a lone `0x80`–`0xFF` byte collapses under UTF-8
replacement) — the exact bug class `broker-relay.mts`'s header exists to
prevent, and the reason `broker-control.mts` moved from a string
accumulator to a Buffer carry in Phase 63 (`broker-control.mts:940-950`,
read this session).
**Why it happens:** Every OTHER framer in this codebase (`vice-broker
-client.ts`) still does exactly this, so it is easy to copy the wrong
sibling.
**How to avoid:** Decode to a string ONLY for the header line, using a
byte-level `indexOf(0x0a)` to find its end first — never `.toString()` on
the accumulator as a whole. Follow `readAttachLine()`'s own pattern
(`broker-relay.mts:88-99`) exactly.
**Warning signs:** A `.vsf` round-trip test (D-04's own self-verifying
pair, per the phase's "specifics" note) failing byte comparison at a
specific offset that correlates with a `0x80`-range byte in the source
file.

### Pitfall 3: Buffering the whole file before the cap check, defeating D-04's own purpose

**What goes wrong:** Reading the file (or the socket) fully into memory
with `readFileSync`/an array of chunks, THEN checking length against the
16 MiB cap — this reintroduces exactly the OOM ceiling D-04 exists to
avoid, and does it silently, since 16 MiB alone is not dangerous but the
pattern is what fails when Phase 65's host-tool outputs (tens of MB) ride
the same code later.
**Why it happens:** It is the simpler-looking implementation, and
`host-tool.mts`'s existing `digestOutputFile()` does exactly this for its
own (already-small, already-on-disk) use case — an easy pattern to copy
into the wrong context.
**How to avoid:** Enforce the cap inside the streaming `Transform`
(Pattern 2 above), as bytes arrive — never after a `Buffer.concat()`.
**Warning signs:** A test with "a receiver that deliberately stops
reading" (`ROADMAP.md`'s own required test shape) passing anyway because
the sender already buffered everything before the receiver even
mattered.

### Pitfall 4: Applying the vicerc sweeper's lifetime rule to a staged file, or vice versa

**What goes wrong:** D-08 explicitly names this: "the two kinds have
OPPOSITE lifetime rules and one sweeper must honour both" — a staged file
must NOT outlive its session; a vicerc scratch dir MUST outlive the
function that created it, for the whole lifetime of the spawned emulator
process. A single sweeper applying one rule to both either deletes a live
emulator's config out from under it, or leaks a payload.
**Why it happens:** Both are "temp-ish directories the broker created and
should eventually clean up" at a glance, inviting one shared sweep
function with one rule.
**How to avoid:** A live-pid guard on the vicerc side (mandatory per D-08)
distinguishes "the process that owns this dir is still running" from
"gone" — session-closed staging cleanup needs no such guard because a
session's *close event* IS the trigger, not a pid check.
**Warning signs:** A running emulator that suddenly can't find its own
vicerc config mid-session; a staged snapshot surviving well past its
session's close.

### Pitfall 5: Testing against a fixed path inside the repo tree, or on the unaged `/tmp` tmpfs

**What goes wrong:** `/tmp` on this host is a tmpfs whose aging is
disabled (per the operator's own standing note, corroborated by D-08's
"4,779 dirs measured after 7 days uptime" finding) — a test fixture that
writes there and does not clean up leaks real RAM across the whole test
suite's lifetime, and a fixed path inside the repo tree risks a real
concurrent-test collision (the exact class the operator's own memory note
`test-suite-races-on-repo-tree-scratch-files.md` already documents for
three other sites).
**Why it happens:** `mkdtempSync(join(tmpdir(), ...))` is the path of
least resistance for "give me a scratch dir."
**How to avoid:** Every test this phase writes uses `mkdtempSync` under a
FRESH temp directory per test (never a fixed repo-tree path), consistent
with CONTEXT.md's own testing guidance, and cleans up in a `finally` or
`after()` hook.
**Warning signs:** A test suite that passes in isolation but fails when
run twice in a row without a reboot.

### Pitfall 6: Racing the machine-level broker's fixed port in a test

**What goes wrong:** A test that dials `19510` directly collides with a
REAL running broker on a developer's machine, since this milestone makes a
machine-level broker an *expected*, not incidental, background process.
**Why it happens:** Copy-pasting `DEFAULT_CONTROL_PORT` into a test
instead of binding port 0.
**How to avoid:** Every test binds an ephemeral port (`port: 0`) and reads
the assigned port back — the existing convention at
`broker-control.test.ts:173,1672,2432` and `broker-endpoint.test.ts:78,168,213`
[VERIFIED: grep this session] — never the literal 19510.
**Warning signs:** A test that is flaky ONLY on a machine with the systemd
broker unit installed and running.

## Code Examples

### The existing eleven-member dispatch union a twelfth "transfer" arm joins

```typescript
// Source: src/mcp/vice/broker-control.mts:93 (read this session, quoted
// verbatim -- this IS the discrete value this phase's plan must extend).
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release" | "host_tool" | "hello" | "attach" | "operation";
```

### The existing four-tool declared table this phase's tools currently route through (survives this phase, per D-13's scope note)

```typescript
// Source: src/mcp/vice/stock-paths.ts:63-68 (read this session, quoted
// verbatim). These four names are EXACTLY what STOCK_EMULATOR_SIDE_PATH_TOOLS
// declares today; the four handlers stop calling withEmulatorSidePath() but
// stock-paths.ts itself is untouched until Phase 66 (RM-01).
export const STOCK_EMULATOR_SIDE_PATH_TOOLS: ReadonlySet<string> = new Set([
  "vice_autostart", // AUTOSTART (0xdd) request body's filename field
  "vice_disk_attach", // AUTOSTART (0xdd) again -- the D-14 approximation
  "vice_snapshot_save", // DUMP (0x41) request body's filename field
  "vice_snapshot_load", // UNDUMP (0x42) request body's filename field
]);
```

### The path-containment validator, as a pure function (D-13/XFER-03 shape)

```typescript
// New module this phase adds -- no in-repo precedent for the exact
// signature, but the REFUSE-not-sanitise posture and the regex-allowlist
// style directly follow sanitizeSnapshotName() (stock-paths.ts:160-169,
// read this session, quoted): "Refuses anything not matching
// /^[A-Za-z0-9_-]{1,64}$/ -- the name is used to build a filename, so path
// separators, '..' and absolute paths are rejected outright rather than
// sanitised." The containment validator generalises this to a full path
// under a fixed root, per D-13's own four required fixtures.
export function validateContainedDestination(candidate: string, rootDir: string): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (candidate.includes("\0")) return { ok: false, reason: "destination name contains a NUL byte" };
  if (candidate.includes("..")) return { ok: false, reason: "destination name contains a traversal segment ('..')" };
  if (isAbsolute(candidate)) return { ok: false, reason: "destination name is an absolute path" };
  if (candidate.includes("/") || candidate.includes("\\")) return { ok: false, reason: "destination name contains a path separator" };
  // No I/O in this function -- pure, testable against fixture strings only
  // (ROADMAP.md's own required test shape). Required fixtures per D-13:
  // "../../etc/passwd", "/etc/passwd", "C:\\", a NUL-embedded name.
  return { ok: true, resolved: join(rootDir, candidate) };
}
```

### Test-port convention this phase's new tests must follow

```typescript
// Source: src/mcp/vice/broker-endpoint.test.ts:78 and broker-control.test.ts:173
// (grep-confirmed this session). Never the literal 19510 in a test.
const listener = await startControlListener({ port: 0, host: "127.0.0.1", ...opts });
const assignedPort = listener.port; // read back, never assumed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `withEmulatorSidePath()` + `hostpath.ts`/`containerpath.ts` bind-mount translation for the four file-carrying tools | Bytes over a short-lived transfer connection, client writes locally, broker stages locally | This phase (Phase 64), continuing the v2.0.0 milestone's Phase 62/63 direction | `stock-machine.ts` stops importing `stock-paths.ts`, dropping the milestone's convergence-metric count from 6 toward 4 (D-18: measured and recorded, not mechanically gated) |
| Whole-file `readFileSync`-then-hash for a produced artifact (`host-tool.mts:2269-2283`) | Streaming hash+count `Transform` in the byte path | This phase, for the transfer layer only — `host-tool.mts`'s own helper is untouched (D-19: `host_tool` gets no transport work this phase) | Removes the OOM ceiling for large transfers; `host-tool.mts`'s helper remains correct for its own already-small, already-on-disk use case and needs no change here |

**Deprecated/outdated:** Nothing is deprecated by this phase's own scope —
`stock-paths.ts` survives (RM-01 is Phase 66's job), and `vice-broker
-client.ts`'s legacy string framers survive too (RM-02 is Phase 66's job).
Do not remove either in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 4,779 leaked vicerc scratch directories after 7 days of uptime | Runtime State Inventory | This figure is carried from CONTEXT.md/a prior todo, not re-measured this session — if stale, the sizing urgency for D-08's fix may be over- or under-stated, but the fix itself (move + sweep) is correct regardless of the exact count |
| A2 | Exact field names for the transfer header line (`kind`, `byteLength`, digest field name, `op` value for the new `ControlRequestKind` member) | Architecture Patterns, Code Examples | These are explicitly NOT settled by any decision record — D-01/D-02 constrain the SHAPE (one JSON line, then N raw bytes; ownership on the command connection, handle-only on the transfer connection) but not the literal strings. A planner choosing different names does not violate any research finding here — the examples above are illustrative only, tagged as such |
| A3 | Whether the new op should be literally `"transfer"`, or split into `"upload"`/`"download"`, or reuse `"attach"` with a `kind: "file"` discriminator | Architecture Patterns | Purely a naming/dispatch-shape choice for the planner; no decision record picks one, and D-01's "twelfth arm on an existing switch" framing is satisfied by any of the three |

**If this table is short:** most of this phase's factual ground — the
existing dispatch union, the existing dial template, the existing digest
helper, the existing atomic-publish sites, the existing sanitiser pattern,
the existing test-port convention — was verified by direct `Read`/`grep`
this session, not assumed. What remains open is genuinely the planner's
design surface, not a researchable fact.

## Open Questions

1. **Migration order across the four tools**
   - What we know: CONTEXT.md's own "specifics" section suggests
     `vice_snapshot_save` + `vice_snapshot_load` first, because a `.vsf` is
     "binary and definitely not valid UTF-8," making it the natural
     `XFER-05` byte-for-byte self-verifying fixture, and the two tools
     "prove each other."
   - What's unclear: whether `vice_autostart`/`vice_disk_attach` (upload
     direction only, no download) are easier or harder to migrate second —
     they exercise D-14's unrestricted-client-path decision and D-16's
     write-loss disclosure, which the snapshot pair does not.
   - Recommendation: CONTEXT.md explicitly says this is "Not locked — the
     planner may sequence differently with a reason." Plan the snapshot
     pair first per the stated rationale unless a concrete reason favors
     otherwise.

2. **Where the new transfer-streaming code physically lives**
   - What we know: `broker-relay.mts` already owns "never string-decode a
     relayed byte" and "never hand-roll the copy loop" as standing
     prohibitions for the monitor-splice case; the transfer case has the
     same two prohibitions but a different shape (payload has a known
     length and a digest to verify, a splice does not).
   - What's unclear: whether the transfer streaming logic belongs inside
     `broker-relay.mts` itself (widening its scope) or in a new sibling
     module (e.g. `broker-transfer.mts`), per this codebase's "one module
     per seam" convention.
   - Recommendation: a new sibling module is more consistent with the
     stated convention (`anno-store.ts` is "the only `node:sqlite`
     consumer," `stock-protocol.ts` is "the only module that handles
     `node:net` and binary-monitor bytes") — `broker-relay.mts`'s job is
     splicing, not measuring/verifying, and mixing the two makes a future
     structural guard test harder to write cleanly. Not settled by any
     decision record; the planner should decide and record the reason.

3. **Exact D-08 sweep trigger point in the kill/recycle path**
   - What we know: D-08 says the fix "does NOT go at [`broker-launch.mts`]
     :329 [sic, the scratch-dir creation site around :548 in the version
     read this session] — it goes in the kill/recycle path, which already
     knows when an instance's process has actually exited," and the
     live-pid guard is mandatory.
   - What's unclear: the exact function this hooks into was not identified
     by name in this research pass (the kill/recycle module,
     `broker-kill.mts`, was not read this session).
   - Recommendation: the planner/executor should read `broker-kill.mts`
     directly before writing this task — it was out of this research
     pass's scope but is squarely in the phase's implementation scope.

## Environment Availability

> This phase is code/protocol work with no new external tool or service
> dependency. It runs against the SAME machine-level broker Phase 62/63
> already require (a manually-started `x64sc` process reached over TCP
> :19510) — no new dependency to audit beyond what Phase 62/63 already
> established as available in this environment.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All new streaming/crypto/net code | ✓ | v24.20.0 `[VERIFIED: node --version, measured this session]` | — |
| A running machine-level broker (`x64sc` via `@henols/vice-mcp broker`) | End-to-end testing of the four migrated tools | Not probed this session (out of scope for a code-and-protocol research pass; the operator's own standing note records "always live-test against real stock VICE... default to live-testing, don't ask first" for implementation/verification phases) | — | Unit/integration tests can and should exercise the transfer protocol against a hand-written loopback TCP server (mirroring `broker-endpoint.test.ts`'s own fixture pattern) without a live emulator at all — only the end-to-end four-tool proof needs the real broker |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the live broker, for the specific
end-to-end criterion (Success Criterion 1); everything else (framing,
hashing, cap enforcement, path validation, staging lifecycle) is testable
with synthetic sockets and `mkdtempSync` fixtures alone.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner, `node --test` `[VERIFIED: src/mcp/vice/package.json:133, "test": "node --test '*.test.*'"]` |
| Config file | none — no separate config file; convention is a colocated `*.test.ts`/`*.test.mts` beside the module under test |
| Quick run command | `node --test <specific-file>.test.ts` (or `.test.mts`), run from `src/mcp/vice/` |
| Full suite command | `npm --prefix src/mcp/vice test` (equivalently `npm run test:automated` per `.planning/config.json`'s `workflow.test_command`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XFER-01 | A produced file's bytes arrive over the socket; client writes under its own `.c64-re-tools/<kind>/`; result names the local path | integration | `node --test <new-transfer-download>.test.ts` | ❌ Wave 0 — new module, no existing test file |
| XFER-02 | A consumed file is read client-side from a caller path and streamed to the broker | integration | `node --test <new-transfer-upload>.test.ts` | ❌ Wave 0 |
| XFER-03 | A broker-supplied destination name escaping the per-kind directory is refused, not sanitised | unit (pure function, no I/O per CONTEXT.md's own mandate) | `node --test transfer-paths.test.ts` (or equivalent name) | ❌ Wave 0 |
| XFER-04 | Broker chooses its own staging path; client refers to it only by opaque handle | unit + integration | `node --test broker-control.test.ts` (extended) + new staging test | Partially — `broker-control.test.ts` exists and already tests `attach`'s handle-only authority pattern (T-63-01); extend, don't replace |
| XFER-05 | Bytes survive the round trip unaltered, including non-UTF-8 bytes | integration, real loopback socket, real multi-megabyte buffer (per CONTEXT.md's own explicit test-shape mandate) | new test, e.g. `transfer-integrity.test.ts` | ❌ Wave 0 |
| XFER-06 | A transfer exceeding the cap is refused with a message naming the limit; integrity-checked end to end | unit (cap logic) + integration (real receiver that stops reading, per CONTEXT.md's own mandate) | new test | ❌ Wave 0 |
| XFER-07 | Staged files removed on session close; startup sweep removes crash residue | integration | new test exercising `broker-relay.mts`/`vice-broker.mts`'s close path + a broker-restart sweep test | ❌ Wave 0 |
| XFER-08 | All four tools work with no shared filesystem (D-17's disjoint-roots proof) | integration, disjoint temp dirs A (client) and B (broker), asserting no B-side path anywhere in a tool result or wire field | `node --test` against `stock-machine.test.ts` (extended) or a new phase-level integration test | Partially — `stock-machine.test.ts` likely exists for the current four handlers (not confirmed by this research pass; check before Wave 0 planning) |

### Sampling Rate

- **Per task commit:** the specific new/changed test file(s)
- **Per wave merge:** `npm --prefix src/mcp/vice test` (full suite)
- **Phase gate:** full suite green, plus `npm --prefix src/mcp/vice run typecheck`, before `/gsd-verify-work` — matching Phase 63's own verification pattern (`63-VERIFICATION.md`'s own spot-check table)

### Wave 0 Gaps

- [ ] A new streaming hash+count `Transform` module and its unit tests (pure logic: cap enforcement, digest correctness) — no existing file to extend
- [ ] A new pure-function path-containment validator and its fixture-string tests (D-13/XFER-03) — no existing file to extend
- [ ] A new transfer-dial function in `broker-endpoint.ts` and its tests, mirroring `broker-endpoint.test.ts`'s existing structure for `dialMonitorRelay()`
- [ ] A new `ControlRequestKind` arm and its dispatch tests in `broker-control.mts`/`broker-control.test.ts`, mirroring the existing `attach` arm's test coverage
- [ ] Confirm whether `stock-machine.test.ts` exists and what it currently covers, before planning XFER-08's disjoint-roots proof — this research pass did not open that file
- [ ] `broker-kill.mts` was not read this session (Open Question 3) — read it before planning D-08's sweep-trigger task

## Security Domain

### Applicable ASVS Categories

(`security_asvs_level: 1` per `.planning/config.json`, read this session.)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Out of scope for v2.0.0 — the per-boot token was deliberately dropped (`REQUIREMENTS.md` decision 5); this phase's transfer connection is authorised by a broker-minted handle, not a credential, per D-01/D-04 |
| V3 Session Management | Partially — the staging directory IS a session-scoped resource | D-06's one-directory-per-session model; cleanup is tied to the session's own close event (Phase 63's `SESS-03`/`SESS-04`), not a separate session token |
| V4 Access Control | Yes — ownership of a transfer op | D-01's split: the command connection is checked with `ownsTarget()` (`broker-control.mts:1030-1032`, the SAME predicate `monitor_claim`/`monitor_release`/`recycle` use); the transfer connection is authorised by the handle alone, mirroring the `attach` op's own `T-63-01` precedent (`broker-control.mts:1360-1363`) |
| V5 Input Validation | Yes — the central concern of this phase | The path-containment validator (D-13/XFER-03), refuse-not-sanitise; the size cap enforced at BOTH ends (D-11 — sender pre-checks the declared length, receiver enforces independently because a declared length is untrusted input); the JSON header line parsed in try/catch with every field type-checked before use, per this codebase's established never-throw-at-the-boundary posture |
| V6 Cryptography | Yes, narrowly — integrity, not confidentiality | sha256 for end-to-end integrity checking only (D-12, "Settled by existing precedent... not discussed, and not open"); NOT an authentication or confidentiality mechanism — `REQUIREMENTS.md`'s Out of Scope table explicitly excludes TLS/mTLS ("the bind is narrowed to loopback and bridge gateways; there is no network path to encrypt") |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via a broker-supplied destination name | Tampering / Elevation of Privilege | D-13/XFER-03's refuse-not-sanitise validator — `../../etc/passwd`, `/etc/passwd`, `C:\`, a NUL-embedded name all refused by name, matching the four required fixtures |
| Reading an arbitrary client-readable file into broker-owned staging | Information Disclosure | D-14's ACCEPTED, NAMED cost: `vice_autostart`/`vice_disk_attach`'s `path` stays unrestricted by deliberate owner decision — bounded by the 16 MiB cap (D-09) and session-scoped staging (D-06), not eliminated. This is a recorded, accepted risk, not an oversight — do not "fix" it in this phase |
| A malicious or buggy sender lying about the declared payload length | Denial of Service (memory exhaustion) | D-11: cap enforced independently at the RECEIVER, from bytes actually observed, never trusting the declared header length alone |
| Mid-transfer connection drop leaving a partial file visible at its final name | Tampering (a caller reading a corrupt file believing it complete) | Temp-write-then-`renameSync`, only after length+digest verification (Pattern 3) |
| Guessing another session's staged-file handle | Elevation of Privilege | `node:crypto` `randomBytes`-derived handle, same entropy class as the existing `monitorClients[channel].handle` minting (`broker-state.mts` header, quoted verbatim above) |
| A game writing to an attached disk image, believing the write persists | (Not a STRIDE threat — a functional/data-integrity regression) | D-16's ACCEPTED, NAMED loss: writes to a staged, broker-owned disk copy are lost when the session closes; the tool result must say so explicitly, matching `docs/stock-hard-losses.md`'s existing shape for other stock-imposed losses |

## Sources

### Primary (HIGH confidence — direct code reads this session)

- `src/mcp/vice/broker-endpoint.ts` (full file, 779 lines) — `dialBrokerEndpoint()`, `dialMonitorRelay()`, `performAttach()`, `classifyHelloReply()`, the four dial ranks, `DIAL_CANDIDATES`, `DEFAULT_CONTROL_PORT`
- `src/mcp/vice/stock-machine.ts` (full file, 368 lines) — `handleAutostart`, `handleDiskAttach`, `handleSnapshotSave`, `handleSnapshotLoad`, `DISK_ATTACH_APPROXIMATION`
- `src/mcp/vice/stock-paths.ts` (full file, 195 lines) — `STOCK_EMULATOR_SIDE_PATH_TOOLS`, `withEmulatorSidePath()`, `sanitizeSnapshotName()`, `snapshotPathFor()`, `snapshotMetaPathFor()`
- `src/mcp/vice/broker-control.mts` (targeted reads: lines 80-140, 940-995, 1330-1420, 1450-1560) — `ControlRequestKind`, the `attach`/`monitor_release`/`operation` dispatch arms, the Buffer-carry line reader, `MAX_LINE_BYTES`, `ownsTarget()`, `startControlListener()`/`startControlListenerOnHosts()`
- `src/mcp/vice/broker-relay.mts` (lines 1-110) — module header prohibitions, `readAttachLine()`, `MAX_ATTACH_LINE_BYTES`
- `src/mcp/vice/broker-launch.mts` (lines 250-335, 505-560) — the `-default`/`-drive8type` ordering context, the `mkdtempSync` vicerc scratch-dir creation and its "deliberately does NOT clean up" comment
- `src/mcp/vice/broker-home.mts` (lines 1-100) — `BROKER_HOME_ENV`/`VICE_BROKER_HOME`, `brokerHome()`
- `src/mcp/vice/host-tool.mts` (lines 55-75, 2260-2300) — the byte-payload prohibition, `digestOutputFile()`
- `src/mcp/vice/repo-root.ts` (targeted grep) — `toolsDir()`, `supervisorDir()`
- `src/mcp/vice/broker-state.mts` (lines 100-200) — `InstanceRecord.monitorClients`, the handle-minting comment quoted verbatim above
- `src/mcp/vice/vice-broker-client.ts` (lines 525-545, 1000-1020) — the two legacy string framers D-03 declines to convert
- `src/mcp/vice/vsf-slice.ts` (lines 60-90) — the byte-array-only, no-path-parameter constraint, confirming `.vsf` reads stay client-side
- `.planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-VERIFICATION.md` (full file) — what Phase 63 actually shipped and verified (relay byte-transparency, `SESS-01..06`, the residual WR-01 human-decision item)
- `.planning/REQUIREMENTS.md` (full file) — the six settled design decisions, `XFER-01..08`, the Out of Scope table
- `.planning/phases/64-files-as-bytes-both-directions/64-CONTEXT.md` (full file) — all 19 numbered decisions (D-01..D-19), canonical refs, code context, specifics, deferred ideas
- `.planning/config.json` (full file) — `security_enforcement: true`, `security_asvs_level: 1`, `nyquist_validation: true`, `test_command`
- `src/mcp/vice/package.json` (lines 1-40) — `files[]`, dependency set, `test` script
- Repo-wide `grep -rn "node:stream|Transform|createReadStream|createWriteStream"` over `*.ts`/`*.mts` excluding tests — zero non-test hits, confirming no in-repo streaming precedent

### Secondary (MEDIUM confidence)

- None — no WebSearch or external documentation lookup was needed for this
  phase; every primitive is Node stdlib already exercised by this repo's
  own conventions (`.mts` build step, `renameSync` atomic publish,
  never-throw boundary parsing), and Node's own `Transform`/`crypto`
  streaming API surface is stable, well-documented stdlib behavior not
  subject to the kind of version drift that warrants a live doc check for
  a Node 24 target.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entirely Node stdlib, zero new dependencies, every choice traced to an in-repo precedent or an explicit, quoted owner decision in 64-CONTEXT.md
- Architecture: HIGH — the transfer dial and dispatch shape are near-literal extensions of Phase 63's shipped, verified `dialMonitorRelay()`/`attach` pattern, read directly this session
- Pitfalls: HIGH — every pitfall above traces to either a direct code read (the two legacy string framers, the `digestOutputFile()` whole-buffer pattern) or a verbatim-quoted owner decision (D-05, D-07, D-08, D-11)

**Research date:** 2026-09-23
**Valid until:** 30 days (stable domain — Node stdlib and this repo's own established conventions; the only fast-moving element, the exact wire vocabulary for the new op, is explicitly unsettled and left to the planner, not a research staleness risk)
