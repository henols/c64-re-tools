# Phase 13: External Verification - Research

**Researched:** 2026-08-22
**Domain:** Live-binary re-verification of three carried debt items (binmon wire
fixtures, backend `--help` discriminator, four Phase 3 wire assumptions) against
genuine stock and fork VICE builds. No new capability, no new dependency.
**Confidence:** HIGH — every claim below was either (a) confirmed by reading the
cited source file this session, or (b) confirmed live against the two real
`x64sc` binaries present on this host. Nothing in this document is sourced from
training-data guesswork about VICE's wire protocol; the protocol facts were
already settled in prior phases and are only re-cited here.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-13-01:** All three EXTV-01 fixtures are captured from **whichever `x64sc`
  resolves first in `PATH`** — today `/usr/local/bin/x64sc`, VICE 3.10, the
  fork. Sidecars record `fork` honestly. Stock-vs-fork byte drift is explicitly
  **out of scope** for EXTV-01: no cross-check capture against stock 3.9, and no
  artifact claiming to distinguish "upstream behaviour" from "fork patch
  behaviour".
- **D-13-02:** All four EXTV-03 assumptions probe against the **same
  first-in-`PATH` binary**. Corollary: probes resolve the binary through the
  project's own lookup and **never hardcode** `/usr/bin/x64sc` or
  `/usr/local/bin/x64sc`. Every artifact records what it was captured from
  rather than asserting a version.
- **D-13-03:** EXTV-02 commits **both raw `--help` transcripts verbatim**, plus
  a fixture-driven regression test built from the **real** strings, labelled
  `capturedFrom: "real hardware"` and kept **separate** from the existing
  ASSUMED fixtures in `backend-detect.test.ts` — never merged with them or
  presented as the same class of evidence. Also update
  `docs/phase2-backend-probe-evidence.md` §2's verdict from OPEN.
- **D-13-04:** The correction unit for a contradicted assumption is **every
  site carrying that assumption's `[ASSUMED]` label**, enumerated by `grep` at
  execution time. Verified table (re-verified this session, see "The
  `[ASSUMED]` label-site inventory" below — **no drift** from CONTEXT.md's
  2026-08-21 table):

  | Assumption | Sites carrying the label |
  |---|---|
  | A1 flag spelling | `.claude/mcp/vice/broker-launch.mts:140` |
  | A2 step-over | `.claude/mcp/vice/stock-execution.ts:227` **and** `.claude/mcp/vice/stock-protocol.ts:742` |
  | A3 joystick bits | `.claude/mcp/vice/stock-input.ts:161,166` **and** `.claude/mcp/vice/stock-protocol.ts:791` |
  | A5 autostart `fileIndex` | `.claude/mcp/vice/stock-protocol.ts:847` |

  A label comes off only when **all** of its sites come off together, and
  `stock-protocol.ts:408`'s module-level "never silently claimed as verified"
  convention is re-checked afterward. **Escape hatch:** if a probe shows an
  *advertised tool contract* is wrong (a behavioural-contract change), the
  phase records the finding and files a todo rather than redesigning the
  contract in-phase.
- **D-13-05:** **A4 is out of scope.** Stays open in
  `2026-08-14-probe-phase3-assumed-wire-details.md` after this phase.
- **D-13-06:** Replace the three synthetic `.bin`/`.json` pairs **in place**,
  `synthetic: false`, `specSections`/`note` keys removed. Also correct
  `fixtures/binmon/README.md`'s "genuine build" wording for
  `/usr/local/bin/x64sc` VICE 3.10 to say it is the **patched (fork)** build,
  not merely "genuine". Reversibility: costly (old bytes survive only in git
  history) — accepted deliberately.
- **D-13-07:** The live probes are **extensions to `probe-binmon.mjs`** (a
  script, not a test). Only the **offline fixture-driven assertions** become
  committed tests, in the automated gate.

### Claude's Discretion

D-13-03 through D-13-07 carry explicit user delegation ("if it matters you
decide"). Within the locked decisions above, the planner has latitude on: how
the three sub-items split across plans (independent, may run in parallel per
ROADMAP.md); where exactly the EXTV-02 transcripts live on disk; and the
probe-extension shape inside `probe-binmon.mjs`. Anything that would widen
scope past D-13-04's escape hatch is not discretionary — it becomes a todo.

### Deferred Ideas (OUT OF SCOPE)

- Stock-vs-fork fixture drift (capturing the same three frames from both
  builds) — cut from EXTV-01 by D-13-01.
- A4, the `stop:false` rate limiter under a real `CHECKPOINT_INFO` flood — out
  of scope per D-13-05, stays tracked in its own todo.
- `fixtures/binmon/README.md`'s "genuine build" wording — corrected as a
  side effect of D-13-06, not scope creep.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTV-01 | Re-record the three `VERIF-02` binmon wire fixtures from a real VICE binary; no sidecar still declares itself synthetic while relied on as ground truth | "`probe-binmon.mjs` capture mechanics" and "Fixture contract" sections below: the tool already implements all three cases unchanged; the work is running it, inspecting the real bytes' embedded request ids, and updating two test assertions plus the header/README narrative that currently *require* `synthetic: true` |
| EXTV-02 | Confirm the `--help` backend discriminator against a real stock and a real fork `x64sc`, both transcripts committed | "The `--help` discriminator" section: both binaries confirmed live this session to classify correctly today (0/2 stock, 5/2 fork); remaining work is committing transcripts + a real-hardware regression test kept separate from the ASSUMED fixtures |
| EXTV-03 | Run the four Phase 3 `[ASSUMED]` wire details (A1, A2, A3, A5) against a real binary; correct any contradicted detail at its source | "The four A1/A2/A3/A5 probes" section: exact probe recipe, exact `[ASSUMED]` label sites (re-verified, zero drift), and what a correction touches for each |
</phase_requirements>

## Summary

This is a verification phase with **zero new dependencies and (on the EXTV-01
side) zero new tool code** — `probe-binmon.mjs` already implements
`display-get`, `event-interleaved`, and `checkpoint-list` as first-class
`--capture` cases, unchanged since plan 02-02/07-12. The phase's actual work is
threefold: (1) run three already-built capture cases and reconcile what
changes downstream when their fixtures flip from `synthetic: true` to `false`
— which is more than "swap the bytes", because two tests in
`binmon-fixtures.test.ts` currently *assert* `synthetic: true` for exactly
these three cases, and `stock-protocol.test.ts`'s `checkpoint-list`/
`event-interleaved` correlation tests hardcode a `ViceMonitorClient`
`initialRequestId` matched to the *synthetic* model's assumed request-id
numbering, not to whatever a live capture will actually produce; (2) commit
two `--help` transcripts and a small regression test — genuinely new work,
but the discriminator itself was **live-confirmed correct this session**
against both real binaries (stock: 0 `-mcpserver` hits / 2 `-binarymonitor`
hits; fork: 5 / 2 — exactly D-02's expected split), so EXTV-02 is now a
commit-the-evidence task, not a discovery task; (3) extend `probe-binmon.mjs`
with four small request/response round-trips (A1, A2, A3, A5) and correct
whichever `[ASSUMED]` labels a probe contradicts — the label-site inventory in
CONTEXT.md's D-13-04 table was independently re-`grep`'d this session and
shows **zero line-number drift** from the 2026-08-21 measurement, so the
planner can cite those line numbers directly rather than re-deriving them.

The single highest-value finding of this research session: `docs/phase1-probe-results.md`,
already committed from the Phase 1 live probe run, recorded the REAL
`ADVANCE_INSTRUCTIONS` event order for a single step as
`[RESUMED, REGISTER_INFO, STOPPED]` (verdict logged as `"(other)"` — the
probe script itself had no named bucket for this shape). The
`event-interleaved.bin` synthetic fixture instead models
`RESUMED, STOPPED, REGISTER_INFO, then the correlated reply`. These orders
disagree (`REGISTER_INFO` and `STOPPED` are swapped). This is not proof the
new capture will show the same order — a step over different code, or a build
version difference, could differ — but it is strong prior evidence, already
in the repository, that this specific synthetic assumption is likely to be
contradicted, exactly as the todo itself flagged as the single most likely
divergence.

**Primary recommendation:** Treat EXTV-01 as "run the existing tool, then fix
the two tests whose assertions currently *require* synthetic fixtures to stay
synthetic" rather than as new tooling work; treat EXTV-02 as "commit evidence
for an already-confirmed classifier"; treat EXTV-03 as "four bounded
request/response probes plus a `grep`-driven label removal", with the A2
step-over probe and the A3 joystick bit probe as the two most likely to
surface an actual behavioural correction (both are runtime-semantic claims,
not wire-shape claims, and neither has ever been exercised against a real
binary).

## Architectural Responsibility Map

This project has no browser/SSR/API/CDN/DB tiers — it is a CLI/MCP-server
project. Substituting the project's own real tiers (per `CLAUDE.md` →
Component Responsibilities):

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Binmon wire fixture capture (EXTV-01) | Host-side probe script (`probe-binmon.mjs`) | Fixture/test layer (`binmon-fixtures.ts`, `*.test.ts`) | The script owns the live socket to a real `x64sc`; the fixture layer owns consuming and asserting on the resulting bytes — this phase touches both, never the container-side MCP surface |
| Backend discriminator confirmation (EXTV-02) | Host-side detection module (`backend-detect.mts`) | Test layer (`backend-detect.test.ts`) | `probeBackend()`/`classifyHelpOutput()` already run correctly; the phase adds evidence, not logic |
| Wire-assumption probing (EXTV-03) | Host-side probe script (`probe-binmon.mjs`, new checks) | Container-side dispatch (`stock-execution.ts`, `stock-input.ts`, `stock-protocol.ts`, `broker-launch.mts`) | The probe script is the ONLY place this tree ever dials a real binary directly; a contradicted assumption is corrected in the container-side encoder/handler that carries its `[ASSUMED]` label |
| Fixture provenance / label bookkeeping | Documentation (`README.md`, `docs/phase2-backend-probe-evidence.md`) | — | No code tier owns this; it is pure record-keeping, but it is exactly the artifact class this milestone (`EXTV-*`) exists to keep honest |

## Standard Stack

No new external dependencies. This phase reuses existing in-repo tooling
exclusively:

| Tool | Role |
|------|------|
| `.claude/mcp/vice/probe-binmon.mjs` | Bare-Node TCP client against the binary monitor; owns `--capture`, `--selftest` |
| `.claude/mcp/vice/binmon-fixtures.ts` | Fixture loader/synthesizer consumed by tests |
| `.claude/mcp/vice/backend-detect.mts` | `classifyHelpOutput()`/`probeBackend()`/`resolvedBackend()` |
| Node's built-in test runner (`node:test`) | The only test framework in this package |
| Real `x64sc` binaries on this host | `/usr/bin/x64sc` (stock, VICE 3.9), `/usr/local/bin/x64sc` (fork, VICE 3.10) |

**Installation:** none — nothing to install. `node --version` on this host is
`v22.22.0` (verified live), satisfying the package's `engines` floor of
`>= 22.18`.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

## Architecture Patterns

### System flow this phase exercises

```
Operator                probe-binmon.mjs              real x64sc              fixtures/tests
   |                          |                             |                        |
   |--- launch x64sc -------------------------------------->|                        |
   |    (-default before -binarymonitor, per CLAUDE.md)     |                        |
   |                          |                             |                        |
   |--- node probe-binmon.mjs |                             |                        |
   |    --capture <case> ---->|                             |                        |
   |                          |--- CHECKPOINT_SET/          |                        |
   |                          |    ADVANCE_INSTRUCTIONS/    |                        |
   |                          |    DISPLAY_GET request ---->|                        |
   |                          |<--- reply + any interleaved |                        |
   |                          |     broadcast events --------|                        |
   |                          |--- writeAtomic(.bin, .json)------------------------->|
   |                          |    (tmp-sibling -> rename)                           |
   |                                                                                 |
   |--- git status / diff, then commit -------------------------------------------->|
   |                                                                                 |
   |=== separately: npm run test:automated ========================================|
   |    binmon-fixtures.test.ts / stock-protocol.test.ts load the committed .bin    |
   |    via loadCapturedFixture(), replay it through a STUB net server, and assert  |
   |    on ViceMonitorClient's parsed/correlated result — no live emulator involved |
```

### Pattern: capture is already generic across all three EXTV-01 cases

`CAPTURE_CASES` in `probe-binmon.mjs` already lists `"display-get"`,
`"event-interleaved"`, `"checkpoint-list"` alongside the three
`cpuhistory-get*` cases plan 07-12 added later — **no new case, no
parameterisation needed.** [VERIFIED: `.claude/mcp/vice/probe-binmon.mjs:110-117`]
```
const CAPTURE_CASES = [
  "display-get",
  "event-interleaved",
  "checkpoint-list",
  "cpuhistory-get",
  "cpuhistory-get-multi",
  "cpuhistory-get-unsupported",
];
```
Each has a runner already registered in `CAPTURE_RUNNER_BY_CASE`
[VERIFIED: `.claude/mcp/vice/probe-binmon.mjs:1399-1406`]:
- `captureDisplayGetCase(mon)` — sends one `DISPLAY_GET` (0x84), body
  `[0x00, 0x00]` (use_vic=0, format=INDEXED8). [VERIFIED: `probe-binmon.mjs:1309-1313`]
- `captureEventInterleavedCase(mon)` — sends one `ADVANCE_INSTRUCTIONS`
  (0x71), body `[stepOver=0x00, count=1 (u16LE)]`, then sleeps 200ms to let
  interleaved events land. [VERIFIED: `probe-binmon.mjs:1315-1327`]
- `captureCheckpointListCase(mon)` — sends two narrow `CHECKPOINT_SET`
  (0x12) calls (`start===end`, `stop:1, enabled:0, temporary:1`, at
  `0xea31`/`0xea81` — deliberately NOT the fork's full-range shape that
  produced the CHECKPOINT_INFO ×18 flood), then one `CHECKPOINT_LIST`
  (0x14), sleeps 100ms, and deletes both checkpoints in a `finally` block
  **outside** the capture window. [VERIFIED: `probe-binmon.mjs:1329-1365`]

Every case is wrapped by `withFrameCapture()`, which bounds accumulation at
`MAX_CAPTURE_FRAMES = 32` and sets `aborted = true` (writing no `.bin`)
rather than looping forever on a flood. [VERIFIED: `probe-binmon.mjs:105,1283-1307`]

**Launch flags each case needs, resolved via `parseTarget()`'s `VICE_BINMON`
env var (or positional host/port), against a manually-launched binary:**
```
x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
```
[CITED: `probe-binmon.mjs`'s own header comment, lines 15-19] — this is a
plain binary-monitor launch; none of the three EXTV-01 cases needs
`-remotemonitor`, drive flags, or a display beyond what VICE itself requires
to start. CLAUDE.md's settled constraint that `-default` must precede
`-binarymonitor` applies to the **broker's** own `buildViceArgs()`
construction, not to this manual single-shot launch — but the manual launch
command above already puts `-binarymonitor` last with no `-default` at all,
which is fine for a bare manual launch (the constraint is specifically about
flag *order* between the two, and there is no `-default` in this command to
misorder).

### Pattern: the sidecar `capturedFrom` field is a manual, unvalidated string

`runCapture()` builds `capturedFrom` from two env vars with an honest
fallback:
```js
// probe-binmon.mjs:1476-1480 [VERIFIED]
const capturedFrom = `${process.env.CAPTURE_BACKEND_KIND || "unknown"}:${process.env.VICE_BIN || `${host}:${port}`}`;
```
Neither `CAPTURE_BACKEND_KIND` nor `VICE_BIN` is derived automatically from
`resolvedBackend()` or from which binary actually answered — the operator
must set them by hand. **This has already gone wrong once**: the two
existing real `cpuhistory-get*` captures under
`fixtures/binmon/cpuhistory-get.json` and `cpuhistory-get-multi.json` both
read `"capturedFrom": "stock:/usr/local/bin/x64sc"`
[VERIFIED: `.claude/mcp/vice/fixtures/binmon/cpuhistory-get.json`, quoted
verbatim: `"capturedFrom": "stock:/usr/local/bin/x64sc"`] — but
`/usr/local/bin/x64sc` is the **fork**, not stock, per `CLAUDE.md`'s own
description of the project's two backends and per this session's live
`--help` grep (5 `-mcpserver` hits). The operator who ran plan 07-12's
capture typed `CAPTURE_BACKEND_KIND=stock` for a fork binary. D-13-01
requires this phase's new sidecars to "record `fork` honestly" — so the
capture command for EXTV-01 must set `CAPTURE_BACKEND_KIND=fork` explicitly.
This pre-existing mislabel in the two `cpuhistory-get*` sidecars is **not**
one of the three fixtures D-13-06 scopes for correction (`display-get`,
`event-interleaved`, `checkpoint-list` only) — flagged here as an Open
Question, not a required fix, per D-13-04's escape hatch (file a todo rather
than widen scope).

## Fixture contract (`loadCapturedFixture()`)

[VERIFIED: `.claude/mcp/vice/binmon-fixtures.ts:231,258-301`]

Required sidecar keys, enforced by `REQUIRED_PROVENANCE_KEYS`:
```
const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"] as const;
```
A sidecar missing any of these five throws `MissingFixtureError`, naming the
regenerate command. `synthetic` must be a real, present key — an omitted key
is a load-time error, not a value that defaults to `false`
[VERIFIED: `binmon-fixtures.ts:222-230` comment explains why the key was made
required in WR-09]. Optional keys `specSections` and `note` are read by
nothing in code — they exist purely for human narrative and are the two
keys D-13-06 says to remove from the re-recorded sidecars.

`buildSidecar()` in `probe-binmon.mjs` is the ONE place a live sidecar is
constructed; it throws before writing if `capturedFrom`/`viceVersion` are
empty or if `caseName` has no entry in `CAPTURE_COMMAND_BY_CASE`
[VERIFIED: `probe-binmon.mjs:1423-1452`]. It always emits `synthetic: false`
— there is no way to call it and get `synthetic: true`; only the hand-written
`.json` sidecars carry `true`.

### Tests that consume the three fixtures — full list, by file and test name

**`binmon-fixtures.test.ts`** [VERIFIED: line numbers from this session's
`grep`/`Read`]:
- Lines 306-321, `"WR-09: every committed sidecar under fixtures/binmon/
  STATES its provenance, and the three CPUHISTORY_GET captures state it as
  real"` — **asserts `synthetic: true` for `display-get`, `event-interleaved`,
  `checkpoint-list` by name in a hardcoded `cases` array.** Must be edited to
  `false` for these three once re-recorded, or the test fails on the exact
  condition EXTV-01 exists to change.
- Lines 327-332, `"WR-10: the three committed fixtures report synthetic:
  true, matching the recorded 2026-08-13 D-19 override"` — **this test's
  entire premise inverts.** It asserts `loaded.synthetic === true` and
  `provenance.capturedFrom === "synthesized-fallback"` for exactly these
  three cases. This test must be rewritten (not merely tweaked) — its name
  and docstring describe the pre-EXTV-01 world.
- Lines 333-343, `"WR-10: binmon-fixtures.ts's own header does not claim
  the three fixtures are real captures"` — asserts the module header
  matches `/NOT currently real captures/` and links the re-record todo. Once
  the module header is rewritten to describe an all-real fixture set (see
  next item), this exact regex assertion becomes backwards and must be
  rewritten alongside the header, or it will pass by literal accident (the
  substring currently survives inside a *historical* narrative sentence
  about the header's own past wording — see next bullet) while asserting
  something no longer true of the fixtures it describes.
- Lines 1-56 (module header of `binmon-fixtures.ts` itself, not the test
  file) — the "PROVENANCE — MIXED, per fixture" narrative currently lists
  `display-get`/`event-interleaved`/`checkpoint-list` under "SYNTHETIC" and
  the three `cpuhistory-get*` cases under "REAL CAPTURES". Once EXTV-01
  lands, **all six** fixtures are real captures — this header needs a
  structural rewrite, not a word swap, and the rewrite is what the test
  above (lines 333-343) checks a substring of.
- `fixture:` -parameterised tests at lines 387-434 (`loads without
  throwing`, `sidecar carries all four provenance keys`, `decomposes into at
  least one complete frame`, plus the size/shape assertions for
  `display-get.bin` >157000 bytes, `event-interleaved.bin` has both a
  broadcast-id and non-broadcast-id frame, `checkpoint-list.bin` has at
  least two frames sharing one non-broadcast request id) — these are
  provenance-agnostic and should pass unchanged against real bytes, **unless**
  the real event/frame shapes differ from what these loose bounds assume
  (see Pitfall 1 below for the specific case that is likely to differ).

**`stock-protocol.test.ts`** [VERIFIED: line numbers from this session's
`grep`/`Read`]:
- Lines 151-161, `display-get` geometry/size assertions via `parseBuffer()`
  directly — no request-id coupling, low risk.
- Lines 606-621, chunked-delivery test for `display-get` — connects a client
  passively and asserts on the *pushed* response; **no request-id
  coupling** (the client never sends its own request in this test), so it is
  robust to whatever id the real capture embeds.
- Lines 852-866, `"correlat: the captured checkpoint-list fixture resolves
  exactly once..."` — constructs `new ViceMonitorClient({ initialRequestId: 4
  })`, then calls `client.send(CommandType.CheckpointList)` and expects the
  fixture's terminal `CHECKPOINT_LIST` reply to carry reqId **4**. **This
  number is an artifact of the synthetic model, not a protocol fact** — see
  Pitfall 1.
- Lines 876-891, `"correlat: the captured event-interleaved fixture
  resolves..."` — same pattern, `initialRequestId: 2`, expects the
  `ADVANCE_INSTRUCTIONS` reply at reqId **2**.

## Common Pitfalls

### Pitfall 1: hardcoded `initialRequestId` values are artifacts of the synthetic model, not protocol facts — the single most likely EXTV-01 execution trap

**What goes wrong:** `stock-protocol.test.ts`'s `checkpoint-list` and
`event-interleaved` correlation tests construct
`new ViceMonitorClient({ initialRequestId: N })` with `N` hand-picked to
match whatever request id the *synthetic* fixture assumed for its terminal
reply (4 and 2 respectively). A real capture's embedded request id is
whatever `BinMon.nextId` (in `probe-binmon.mjs`) happened to be when that
particular request was sent — and that counter is **shared across every
case run in a single `--capture all` invocation**, since `runCapture()`
opens exactly one socket/`BinMon` instance for the whole run and loops over
`casesToRun` on it [VERIFIED: `probe-binmon.mjs:1454-1520`, one `mon =
new BinMon(socket)` before the `for (const c of casesToRun)` loop]. If the
three cases are captured via the todo's literal acceptance-check command
(`--capture all`), the request ids will be assigned in `CAPTURE_CASES`
order: `display-get`→1, `event-interleaved`→2 (this one happens to match the
existing test's hardcoded `2`), then `checkpoint-list`'s two `CHECKPOINT_SET`
calls consume 3 and 4, and its `CHECKPOINT_LIST` itself becomes **5** — not
the hardcoded **4**. Captured standalone (`--capture checkpoint-list` on a
fresh connection) it would instead be **3**. Either way it is very unlikely
to still be 4.

**Why it happens:** the test's `initialRequestId` exists so the client's
own outgoing request is assigned the exact id the fixture's terminal reply
carries — `ViceMonitorClient`'s dispatch keys strictly on request id
[VERIFIED: `stock-protocol.ts:1966-1969`, `constructor({ initialRequestId
}) { ... this.#nextRequestId = initialRequestId; }`]. A mismatch means the
client's `send()` promise has no pending entry to resolve when the fixture
bytes arrive, and the awaited call hangs rather than failing loudly.

**How to avoid:** after running the real capture, read back the actual
embedded request id from each `.bin`'s terminal reply header (bytes 8-11,
u32LE) — a five-line Node script or `probe-binmon.mjs --selftest`-style
decode is enough — and update `initialRequestId` in both tests to match.
Do this as an explicit task, not as an afterthought discovered by a failing
test; a hung `await` in a Node test can look like a slow test rather than a
wrong assumption.

**Warning signs:** `stock-protocol.test.ts`'s `checkpoint-list`/
`event-interleaved` correlation tests hang or time out after the fixtures
are replaced, with no assertion failure message — that is this exact
mismatch, not a framing regression.

### Pitfall 2: two tests currently assert the opposite of what EXTV-01 will make true

**What goes wrong:** `binmon-fixtures.test.ts`'s WR-09 and WR-10 tests
(lines 306-332, see above) currently assert `synthetic: true` for exactly
the three fixtures this phase makes `false`. If the fixtures are replaced
without touching these tests, `npm test` (CI's actual command — see
"automated test gate" below) goes red on a condition this phase created on
purpose, not a regression.

**How to avoid:** budget explicit edits to these two tests (and the header
regex test, Pitfall 3) as EXTV-01 tasks, not as "the fixture swap should
just work."

### Pitfall 3: `binmon-fixtures.ts`'s own module header narrates provenance history — rewriting it changes what a downstream regex-matching test checks

**What goes wrong:** the "PROVENANCE — MIXED, per fixture" header comment
[VERIFIED: `binmon-fixtures.ts:19-47`] currently lists the three EXTV-01
cases as SYNTHETIC. A test (`binmon-fixtures.test.ts:333-343`) asserts this
header text contains the literal substring `"NOT currently real captures"`
and a link to the re-record todo — but that substring today lives inside a
sentence describing what an OLDER version of the header used to (wrongly)
claim, not a live assertion about current fixture state. Rewriting the
header to describe an all-real fixture set risks either (a) accidentally
deleting the substring the test greps for, breaking the test for the wrong
reason, or (b) leaving the substring in by coincidence while the header's
surrounding meaning has flipped, which is exactly the kind of stale-comment
drift this milestone exists to stop.

**How to avoid:** rewrite the header AND its consuming test together, in the
same task/commit — verify what the new header should assert (probably: "all
six fixtures under fixtures/binmon/ are real, hardware-recorded captures";
keep the historical note about the 2026-08-13 D-19 override for archaeology)
and write a new, accurately-named test assertion rather than preserving the
old regex by coincidence.

### Pitfall 4: the `checkpoint-list` terminator-frame reading is the highest-probability wire-shape contradiction

**What goes wrong:** `stock-protocol.ts`'s parser for the terminal
`CHECKPOINT_LIST` (0x14) reply reads a bare 4-byte `u32LE` count as the
entire body:
```ts
// stock-protocol.ts:1371-1378 [VERIFIED]
case ResponseType.CheckpointList: {
  // total's checkpoints are filled by request-id correlation across the
  // preceding CHECKPOINT_INFO events sharing this request id -- that
  // demux is plan 02-06's, not this parser's; always empty here, same as
  // the vendor.
  need(body, 4, responseType, requestId);
  return { type: "checkpoint_list", requestId, errorCode, total: body.readUInt32LE(0), checkpoints: [] };
}
```
This is the exact `0x14`/`u32LE` reading the todo names as "a reasonable but
unverified reading... not sourced from any spec text this plan had access
to." If the real terminal reply's body differs (e.g. no body at all, or a
different field before/after the count), `need(body, 4, ...)` throws
(visible immediately, not silent) but the fix touches this one `case`
branch plus its two consuming tests
(`binmon-fixtures.test.ts`'s frame-count assertion and
`stock-protocol.test.ts`'s `correlat:` checkpoint-list test).

**How to avoid:** treat this as the single most likely EXTV-01 contradiction
(the todo itself flags it as unverified-by-construction, unlike the
`display-get` geometry, which was already confirmed once against a real
build in Phase 1) and budget a correction path for it explicitly, rather
than assuming the re-capture will be a clean bytes-swap.

### Pitfall 5: `event-interleaved`'s assumed event order already has a contradicting live data point in this repo

**What goes wrong:** the synthetic `event-interleaved.bin` models the order
`RESUMED, STOPPED, REGISTER_INFO, <reply>`
[VERIFIED: `.claude/mcp/vice/fixtures/binmon/event-interleaved.json`,
quoted verbatim: `"Event ordering (RESUMED, STOPPED, REGISTER_INFO, then
the command's own correlated reply) follows the documented pause/run model
and the recorded async-event demux behaviour; it is a plausible
spec-conformant sequence, not an observed one."`]. But `docs/phase1-probe-results.md`,
already committed, recorded the REAL order for a single `ADVANCE_INSTRUCTIONS`
step on the stock 3.9 build as:
```
12. ADVANCE_INSTRUCTIONS event pair -> [RESUMED, REGISTER_INFO, STOPPED] (other)
```
[VERIFIED: `docs/phase1-probe-results.md:248`, quoted verbatim above] — note
`REGISTER_INFO` and `STOPPED` are swapped relative to the synthetic model,
and the probe script's own verdict logic had no named bucket for this shape
(it only recognised `"RESUMED then STOPPED"` or `"STOPPED only", `and
fell through to the literal string `"other"`).

**How to avoid:** do not be surprised if the real `event-interleaved.bin`
capture shows `RESUMED, REGISTER_INFO, STOPPED` rather than the synthetic
model's order — this is not a new risk this research invented, it is a
data point already sitting in the repository that the original synthesis
did not cross-check against. If the re-capture confirms this order, correct
`event-interleaved.json`'s own historical `note` field's claim (it will
simply be replaced/removed per D-13-06) and any test whose assertion
depends on ordering rather than presence — the `binmon-fixtures.test.ts`
`fixture:` tests for this case only check "at least one broadcast-id frame
and at least one non-broadcast-id frame" (order-agnostic), but
`stock-protocol.test.ts`'s `correlat:` test asserts `order[order.length - 1]
=== "resolved"` (the correlated reply must be last, which holds either way)
and `>= 1` events before it (also holds either way) — so this specific
contradiction is **unlikely to break either committed test**, but IS likely
to require updating `event-interleaved.json`'s descriptive prose and
`docs/phase2-backend-probe-evidence.md`'s corresponding claim.

### Pitfall 6: A2 and A3 are runtime-semantic claims, not wire-shape claims — a wire-level "accepted" result does not confirm them

**What goes wrong:** the todo's own acceptance check (step 1) checks that
each new probe's `errorCode` is not `InvalidLength`/`InvalidParameter`/
`InvalidType` — i.e., that the body layout is accepted. But A2 (does
`stepOver: true` actually skip a `JSR` as one step, landing the PC after the
call rather than inside it) and A3 (does bit0 in `JOYPORT_SET`'s `value`
actually correspond to physical "up", read back correctly through the CIA
port) are BEHAVIOURAL claims that an accepted body says nothing about — a
wrong bit mapping or a no-op step-over would still return `errorCode: OK`.

**How to avoid:** the todo already encodes the right follow-up checks (step
2 for A2: compare PC after stepping over a known `JSR` against
`address_of_JSR + 3`; step 3 for A3: drive each direction/fire individually
and read back through `MEM_GET` against the CIA1 joystick port) — do not
skip these once the wire-shape check passes; a passing wire-shape check is
necessary but not sufficient evidence for either assumption.

### Pitfall 7: capturing `checkpoint-list` and any other checkpoint work in the same live session leaks stale checkpoints across probes

**What goes wrong:** `captureCheckpointListCase()`'s two `CHECKPOINT_SET`
calls use `enabled: 0` (inert) and are deleted in a `finally` block, but if
a probe session is interrupted between the `CHECKPOINT_SET` and the
`finally`'s `CHECKPOINT_DELETE` (e.g. a crashed process), the checkpoints
remain registered on the running emulator instance and could interfere with
a later probe in the same live session (e.g. A2's step-over PC comparison,
which also uses checkpoints implicitly via the machine's run state).

**How to avoid:** if extending `probe-binmon.mjs` to run all of EXTV-01's
and EXTV-03's new checks in one live session against one launched `x64sc`
instance, prefer a fresh `x64sc` relaunch between the checkpoint-heavy
`checkpoint-list` capture and any later checkpoint-dependent probe, or
explicitly `CHECKPOINT_GET`/enumerate before trusting a clean slate.

## Code Examples

### Running the existing EXTV-01 capture (no new code required)

```bash
# 1. Launch the fork (first-in-PATH, per D-13-01) with the binary monitor:
/usr/local/bin/x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502 &

# 2. Capture all three EXTV-01 cases (plus the two cpuhistory-get cases this
#    build's version family satisfies) in one run, honestly labelled per D-13-01:
cd .claude/mcp/vice
CAPTURE_BACKEND_KIND=fork VICE_BIN=/usr/local/bin/x64sc \
  VICE_BINMON=127.0.0.1:6502 node probe-binmon.mjs --capture all
```
[VERIFIED: composed directly from `probe-binmon.mjs`'s own header comment
(lines 15-19, 27-39) and `runCapture()`'s env var reads (lines 1476-1480)]

### Confirming the `--help` discriminator live (already run this research session)

```bash
$ /usr/bin/x64sc --help 2>&1 | grep -c -- '-mcpserver'     # stock
0
$ /usr/bin/x64sc --help 2>&1 | grep -c -- '-binarymonitor'  # stock
2
$ /usr/local/bin/x64sc --help 2>&1 | grep -c -- '-mcpserver'    # fork
5
$ /usr/local/bin/x64sc --help 2>&1 | grep -c -- '-binarymonitor' # fork
2
```
[VERIFIED: run live in this session, matching CONTEXT.md's 2026-08-21
measurement exactly, and confirming `classifyHelpOutput()`'s behaviour on
real transcripts: `hasFork = text.includes("-mcpserver")` is true only for
the fork, `hasStock` is true for both (both builds' help text mentions
`-binarymonitor`), and `classifyHelpOutput()` checks `hasFork` FIRST
[VERIFIED: `backend-detect.mts:83-89`], so the fork classifies correctly
via its own discriminator rather than the "both present" tie-break].

Both binaries also exit **0** on `--help`
[VERIFIED: run live this session, `echo $?` = 0 for both], which resolves
the todo's assumption #2 ("does stock's `--help` exit non-zero on an
unrecognised flag") as moot for the actual code path: `probeBackend()`'s
fallback ladder only advances past `--help` when the run exits non-zero
**with empty output**
[VERIFIED: `backend-detect.mts:151`, `if (outcome.exitedZero || text.trim()
!== "") break;`] — since `--help` succeeds with non-empty output on both
real builds, the `-help`/`-?` fallback branches are never reached in
practice, on this host, today.

### The `JOYPORT_SET` bit mapping this phase must probe (A3)

```ts
// stock-input.ts:174 [VERIFIED]
export const JOYPORT_BITS = { up: 0x01, down: 0x02, left: 0x04, right: 0x08, fire: 0x10 } as const;
```
Matches the todo's stated assumption exactly (bit0=up, bit1=down, bit2=left,
bit3=right, bit4=fire). The probe (todo step 3) drives each direction/fire
individually via `vice_joystick_set`-equivalent `JOYPORT_SET` calls and
reads back CIA1's joystick port (`$DC00` for port 1, `$DC01` for port 2)
through `MEM_GET` — note real joystick CIA bits are conventionally
active-LOW on hardware, so the read-back comparison must account for
polarity, not just bit position.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact `.bin` embedded request ids this research predicts for `--capture all` (event-interleaved=2, checkpoint-list terminal=5) are a **deduction from source, not an observed capture** — no live emulator capture was run during this research session (per the phase's own instruction to leave long-running emulator captures to execution) | Pitfall 1 / Code Examples | Low — the deduction is mechanical (sequential `nextId` counter, fixed `CAPTURE_CASES` order) and easily confirmed at execution time by reading the actual captured bytes; the general risk (hardcoded `initialRequestId` needs updating) holds regardless of the exact numbers |
| A2 | Whether the real `event-interleaved` capture will actually reproduce `docs/phase1-probe-results.md`'s recorded `[RESUMED, REGISTER_INFO, STOPPED]` order is a prior, not a certainty — a different instruction, a different VICE version (3.10 vs the 3.9 build that produced that record), or a different machine state could produce a third order | Pitfall 5 | Low — either committed test (`binmon-fixtures.test.ts`'s presence-only check, `stock-protocol.test.ts`'s last-event-is-reply check) tolerates any order, so a wrong prediction here does not block the phase, only informs expectations |

No other `[ASSUMED]` claims were introduced by this research; every other
factual claim above is either `[VERIFIED]` against a source file read this
session, or `[VERIFIED]` against a live command run this session. Claims
already tagged `[ASSUMED]` inside the *codebase itself* (A1/A2/A3/A5's own
JSDoc labels) are the subject of EXTV-03, not a research assumption — they
are quoted, not asserted, throughout this document.

## Open Questions

1. **Should the pre-existing `"stock:/usr/local/bin/x64sc"` mislabel in
   `cpuhistory-get.json`/`cpuhistory-get-multi.json` be corrected in this
   phase?**
   - What we know: it is factually wrong (that binary is the fork), and it
     is the exact defect class (`EXTV-*`/provenance-that-lies) this
     milestone exists to close.
   - What's unclear: D-13-06 scopes correction to the README's prose and the
     three named fixtures, not to these two pre-existing sidecars from plan
     07-12.
   - Recommendation: file a todo rather than fix in-phase, per D-13-04's
     escape-hatch principle (a cheap fix is still a scope decision the user
     should see named, not absorbed silently) — unless the planner judges a
     one-line JSON edit alongside the README fix as trivially in-scope.

2. **Where should the two EXTV-02 `--help` transcripts live on disk?**
   - What we know: this repo's precedent for committed raw evidence is
     `.planning/phases/<N>-<name>/evidence/` (used by Phases 9, 10, 11) and,
     separately, `fixtures/<subsystem>/` with a sidecar (used by
     `fixtures/binmon/`).
   - What's unclear: D-13-03 leaves this to Claude's discretion explicitly.
   - Recommendation: `.claude/mcp/vice/fixtures/backend-detect/{stock,fork}-help-transcript.txt`
     plus a small provenance sidecar per transcript, mirroring
     `fixtures/binmon/`'s existing pattern (a package-adjacent fixtures
     directory, not `.planning/`) since the regression test that consumes
     them lives in the same package and should not need to reach outside it.

3. **Does the A2 step-over probe need a fresh, deterministic `JSR` target, or
   can it reuse an existing KERNAL routine address?**
   - What we know: the probe needs a known `JSR $xxxx` instruction and must
     compare the post-step PC to `address_of_JSR + 3`.
   - What's unclear: whether stepping over a KERNAL `JSR` mid-execution risks
     side effects (e.g. `$FFD2` CHROUT) that complicate the comparison, or
     whether a purpose-built tiny program (poked directly into RAM via
     `MEM_SET`) is cleaner.
   - Recommendation: poke a minimal `JSR $EA31 ... ` (or any known-length
     KERNAL entry) into a scratch RAM location via `MEM_SET`, set the PC via
     `REGISTERS_SET` (if available) or `AUTOSTART`, then step — this avoids
     depending on whatever program is already loaded.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stock `x64sc` | EXTV-01, EXTV-02, EXTV-03 | ✓ (verified live: `/usr/bin/x64sc --version` → `VICE 3.9`) | 3.9.0.0 | — |
| Fork `x64sc` | EXTV-01 (ground truth per D-13-01), EXTV-02, EXTV-03 | ✓ (verified live: `/usr/local/bin/x64sc --version` → `VICE 3.10`) | 3.10.0.0 | — |
| `$DISPLAY` / X11 socket | VICE needs a display to launch | ✓ (verified live: `DISPLAY=:0`, `/tmp/.X11-unix/X0` present) | — | — |
| `ss` (socket stats) | A1's port-binding check (todo step 5) | ✓ (verified live: `/usr/bin/ss`) | — | — |
| Node.js ≥ 22.18 | Running `probe-binmon.mjs`, the test suite | ✓ (verified live: `v22.22.0`) | v22.22.0 | — |
| `node --test` (built-in) | All committed regression tests | ✓ (no separate install; part of Node) | — | — |

**Missing dependencies with no fallback:** none — every dependency this
phase needs is present and was confirmed live on this host during research.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node:test`), no third-party framework |
| Config file | none — `package.json`'s `scripts.test` is `node --test '*.test.*'` [VERIFIED: `.claude/mcp/vice/package.json:106`] |
| Quick run command | `cd .claude/mcp/vice && node --test binmon-fixtures.test.ts stock-protocol.test.ts backend-detect.test.ts` |
| Full suite command | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`, excludes the seven manual-only live-emulator suites) [VERIFIED: `.claude/mcp/vice/test-gate.mjs:69-77`] — CI itself runs the broader bare `npm test` glob, not this narrower command [VERIFIED: `.github/workflows/ci.yml:115-122`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXTV-01 | Three re-recorded fixtures load, decompose, and correlate correctly | unit (fixture-driven) | `node --test binmon-fixtures.test.ts stock-protocol.test.ts` | ✅ — existing files, edits required (Pitfalls 1-4) |
| EXTV-02 | `classifyHelpOutput()`/`probeBackend()` classify real transcripts correctly | unit (fixture-driven) | `node --test backend-detect.test.ts` | ✅ existing file; ❌ new real-hardware fixture test to add |
| EXTV-03 | Each probed assumption's wire body is accepted; behavioural claims (A2, A3) confirmed or corrected | manual/script (live emulator) via `probe-binmon.mjs`, per D-13-07 | `node probe-binmon.mjs` (extended) | script only — no committed test depends on a live emulator, per D-13-07 |

### Sampling Rate

- **Per task commit:** quick run command above (offline, no emulator, ~seconds)
- **Per wave merge:** full suite command (`npm run test:automated`)
- **Phase gate:** `npm test` (CI's actual command) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] A committed, real-hardware `backend-detect` fixture (transcript files +
  sidecar) does not yet exist — D-13-03's "fixture-driven regression test...
  kept separate from the existing ASSUMED fixtures" needs new fixture files
  under (recommended) `fixtures/backend-detect/`.
- [ ] No other framework/config gap — `node:test` is already wired, and the
  package's `automatedTestFiles()` picks up any new `*.test.ts` file
  automatically as long as it is not added to `test-gate.mjs`'s
  `MANUAL_ONLY_TESTS` array [VERIFIED: `test-gate.mjs:72-79`].

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surface; VICE's binary monitor is documented (CLAUDE.md) as deliberately unauthenticated by design, unchanged here |
| V3 Session Management | No | Not applicable |
| V4 Access Control | No | Not applicable |
| V5 Input Validation | Marginal | Any A2/A3/A5 correction lands in an existing encoder (`stock-protocol.ts`) that already throws `StockEncodingError` before writing bytes on out-of-range input (`requireU16`, ASCII-length checks) — a correction must preserve that pattern, not bypass it |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A capture/probe script hardcoding a binary path | Tampering (of evidence provenance) | D-13-02's corollary: resolve the binary through `PATH`, never hardcode `/usr/bin/x64sc` or `/usr/local/bin/x64sc` — already the locked decision, re-stated here as the security-relevant reason it exists (a hardcoded path silently captures against the wrong build with a correct-looking sidecar) |
| A sidecar mislabeling `capturedFrom` | Repudiation (false evidence) | Already observed once in this exact fixture set (Pitfall/finding above) — the mitigation is operator discipline (set `CAPTURE_BACKEND_KIND` correctly) since the field is not mechanically derived |
| The binary monitor accepting an unbounded `CHECKPOINT_LIST`/checkpoint flood | Denial of Service (of the emulator process) | Already mitigated by `MAX_CAPTURE_FRAMES` in the capture tool and by using narrow single-address checkpoints in `captureCheckpointListCase()`, not the fork's full-range shape that produced the recorded flood |

No new threat surface is introduced by this phase — it corrects labels and
adds read-only/inert probes against a local, already-unauthenticated
protocol on a developer-controlled host.

## Sources

### Primary (HIGH confidence — read directly this session)
- `.claude/mcp/vice/probe-binmon.mjs` — full read, all 1567 lines
- `.claude/mcp/vice/binmon-fixtures.ts` — full read
- `.claude/mcp/vice/backend-detect.mts` — full read
- `.claude/mcp/vice/stock-protocol.ts` — targeted reads at every `[ASSUMED]` site plus `CheckpointList` parsing and `ViceMonitorClient` constructor
- `.claude/mcp/vice/stock-input.ts`, `stock-execution.ts`, `broker-launch.mts` — targeted reads at each `[ASSUMED]` label site
- `.claude/mcp/vice/binmon-fixtures.test.ts`, `stock-protocol.test.ts`, `backend-detect.test.ts` — targeted reads of every test consuming the three EXTV-01 fixtures or the ASSUMED backend-detect fixtures
- `.claude/mcp/vice/fixtures/binmon/*.json`, `README.md` — full read
- `.claude/mcp/vice/test-gate.mjs`, `package.json` scripts block — full/targeted read
- `docs/phase0-binmon-findings.md`, `docs/phase1-probe-results.md`, `docs/phase2-backend-probe-evidence.md`, `docs/stock-vice-parity.md` — targeted reads
- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`, `2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`, `2026-08-14-probe-phase3-assumed-wire-details.md` — full read (the phase's actual content, per CONTEXT.md's instruction)
- `.planning/phases/13-external-verification/13-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — full read
- Live commands run this session: `/usr/bin/x64sc --help`/`--version`, `/usr/local/bin/x64sc --help`/`--version`, `node --version`, `node probe-binmon.mjs --selftest`, `command -v ss` — all confirmed working on this host

### Secondary (MEDIUM confidence)
- None — no web search was needed; this phase is entirely internal, no new library or external API is involved.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all tooling read directly
- Architecture: HIGH — capture/fixture/test flow read end-to-end
- Pitfalls: HIGH for Pitfalls 1-4, 6-7 (derived from reading the exact source); MEDIUM for Pitfall 5's specific prediction (a real prior data point, but not this exact capture)

**Research date:** 2026-08-22
**Valid until:** until the source files cited above change — this is
internal-only research with no external dependency drift risk; treat as
valid through this phase's execution.
