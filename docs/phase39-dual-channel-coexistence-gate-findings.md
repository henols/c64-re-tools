---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
requirement: [CHAN-01]
probe_date: 2026-09-07
verdict: go
verdict_rule_applied: R15
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared source file. Paths are relative to
  # .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/.
  idle_coexist: clean                # evidence/39-idle-coexist.md:279
  foreign_halt_visibility: visible    # evidence/39-foreign-halt.md:307
  concurrent_inflight: clean          # evidence/39-concurrent-inflight.md:363
  cross_channel_resume: clean         # evidence/39-cross-channel-resume.md:354
  disconnect_recovery: recovers       # evidence/39-disconnect-recovery.md:368
  hitcount_invariant_holds: holds     # evidence/39-hitcount-invariant.md:481
  text_single_client: single          # evidence/39-text-single-client.md:291
---

This document carries YAML frontmatter, unlike its sibling probe documents under
`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/`, which have
none — the departure is deliberate, mirroring `docs/phase33-reproducible-run-gate-findings.md`
for the same reason it was taken there: `CHAN-01` requires a machine-readable `go` / `degrade` /
`no-go` verdict that a downstream planner reads as a gate, and a prose sentence in the body is
**not** a machine-readable verdict. `SCHEMA.md` § 4 fixed these keys, in this order, before this
file existed.

**The transcription rule, which is the whole basis of the verdict's honesty.** Every value in
this document is taken from a literal outcome line at **column 0** of a named evidence file,
**cited by path** relative to
`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/`. Where a line appears
more than once in one file, the **final occurrence** is the one taken (`evidence/README.md` §
*Evidence conventions* 7). Nothing here is written from memory and nothing is taken from a plan
SUMMARY's paraphrase — a numeric or enumerated result with no transcript behind it is a
restatement wearing a measurement's clothes.

**A note on owning-plan attribution.** `evidence/README.md`'s own artifact table names
provisional owners for six of the eight measuring plans, written at `39-01` before the phase's
waves were dispatched — the table says so itself: "every other row is a promise this table makes
on the phase's behalf." Four of those promises diverged from what `.planning/ROADMAP.md`
actually dispatched: `39-concurrent-inflight.md` and `39-hitcount-invariant.md` were produced by
`39-05` (not `39-06`/`39-07`), and `39-cross-channel-resume.md` and `39-disconnect-recovery.md`
were produced by `39-04`/`39-06` respectively (not `39-05`/`39-08`). The plan ids cited
throughout this document are taken from each evidence file's own header and cross-checked
against `.planning/ROADMAP.md`'s wave descriptions, not from the README's promissory table.

## Verdict

**`go` — rule `R15` fired.** This is the first `go` this project's four go/degrade/no-go gates
have returned — Phase 9's `R4` returned `degrade`, Phase 23's `R1` returned `no-go`, Phase 33's
`R6` returned `degrade`. Both of the milestone's blocking UNVERIFIED items are settled by this
same set of measurements: interleaved halt/resume behaviour (`hitcount_invariant_holds: holds`)
and whether the text monitor enforces the binary monitor's single-client limit
(`text_single_client: single`).

`R15`'s text, reproduced verbatim from `evidence/DECISION-RULE.md`:

> - **R15 → `go`.** Reached only when `IDLE_COEXIST: clean`, `FOREIGN_HALT_VISIBILITY: visible`,
>   `CONCURRENT_INFLIGHT: clean`, `CROSS_CHANNEL_RESUME: clean`, `DISCONNECT_RECOVERY: recovers`
>   and `HITCOUNT_INVARIANT_HOLDS: holds`, at **any** value of `TEXT_SINGLE_CLIENT`. `R15` has
>   **no antecedent** — it is the exhaustive default, which is what makes `could-not-run`
>   structurally unemittable (`D-03`) rather than merely discouraged.

### The walk, in written order, first match wins

Every one of `R1`..`R14` was evaluated against the seven transcribed values (§ *Inputs* below
gives each value's citation) and **none matched** — `R15`, the exhaustive default, is the rule
that fired. Because the fired rule is the last one in the list, no rule is skipped: this is the
opposite case from Phase 33's `R6`, where `R7`-`R9` were never reached.

| Rule | Antecedent | Matched? | Why not (the transcribed value that fails a conjunct) |
|---|---|---|---|
| `R1` | `IDLE_COEXIST` is `corrupts` | no | `IDLE_COEXIST: clean` |
| `R2` | `IDLE_COEXIST` is `not-taken` | no | `IDLE_COEXIST: clean` |
| `R3` | `IDLE_COEXIST` clean **and** `FOREIGN_HALT_VISIBILITY` is `corrupts` | no | `FOREIGN_HALT_VISIBILITY: visible` |
| `R4` | ...**and** `FOREIGN_HALT_VISIBILITY` is `invisible` | no | `FOREIGN_HALT_VISIBILITY: visible` |
| `R5` | ...**and** `FOREIGN_HALT_VISIBILITY` is `not-taken` | no | `FOREIGN_HALT_VISIBILITY: visible` |
| `R6` | `IDLE_COEXIST` clean, `FOREIGN_HALT_VISIBILITY` visible **and** `CONCURRENT_INFLIGHT` is `corrupts` | no | `CONCURRENT_INFLIGHT: clean` |
| `R7` | ...**and** `CONCURRENT_INFLIGHT` is `degraded` | no | `CONCURRENT_INFLIGHT: clean` |
| `R8` | ...**and** `CONCURRENT_INFLIGHT` is `not-taken` | no | `CONCURRENT_INFLIGHT: clean` |
| `R9` | ...`CONCURRENT_INFLIGHT` clean **and** `CROSS_CHANNEL_RESUME` is `corrupts` | no | `CROSS_CHANNEL_RESUME: clean` |
| `R10` | ...**and** `CROSS_CHANNEL_RESUME` is `not-taken` | no | `CROSS_CHANNEL_RESUME: clean` |
| `R11` | ...`CROSS_CHANNEL_RESUME` clean **and** `DISCONNECT_RECOVERY` is `leaves-halted` | no | `DISCONNECT_RECOVERY: recovers` |
| `R12` | ...**and** `DISCONNECT_RECOVERY` is `not-taken` | no | `DISCONNECT_RECOVERY: recovers` |
| `R13` | ...`DISCONNECT_RECOVERY` recovers **and** `HITCOUNT_INVARIANT_HOLDS` is `breaks` | no | `HITCOUNT_INVARIANT_HOLDS: holds` |
| `R14` | ...**and** `HITCOUNT_INVARIANT_HOLDS` is `not-taken` | no | `HITCOUNT_INVARIANT_HOLDS: holds` |
| `R15` | *(none — exhaustive default)* | **YES — fires, derivation stops here** | reached because `R1`..`R14` each failed a conjunct above |

### Narrowings — checked independently of the fired rule

`evidence/DECISION-RULE.md`'s own `## Narrowings are not scoped to the fired rule` subsection is
binding here: **both** pre-mapped `degrade` narrowings (`D-10` on `R11`, `D-11` on `R13`) apply
whenever their own input carries its triggering value, independently of which rule id fired. `R15`
itself carries no narrowing (it is the exhaustive default), so this document checks both
pre-mapped narrowings directly against the transcribed values rather than only against the fired
rule:

- **`R11`'s narrowing (`D-10`) — checked, not triggered.** Its trigger is
  `DISCONNECT_RECOVERY: leaves-halted`. The transcribed value is `recovers`
  (`evidence/39-disconnect-recovery.md:368`), so the narrowing does not fire. This is the
  narrowing the ROADMAP's own Phase 39 Notes anticipated might name required Phase 41 mechanism —
  see § *Recorded facts that gate nothing* below for what that means concretely.
- **`R13`'s narrowing (`D-11`) — checked, not triggered.** Its trigger is
  `HITCOUNT_INVARIANT_HOLDS: breaks`. The transcribed value is `holds`
  (`evidence/39-hitcount-invariant.md:481`), so the narrowing does not fire.

Both checks are stated explicitly, per the rules file's own instruction, rather than silently
omitted because `R15` fired without reaching either rule's antecedent.

## Inputs

One subsection per input, in `DECISION-RULE.md` § *Inputs* row order. Each reproduces
`SCHEMA.md`'s derivation for that input, the transcribed value with its citation, and a short
reading of what was observed, drawn from that input's own evidence file.

### `idle_coexist`

**Derivation (`SCHEMA.md` § 2.1).** With the text client connected and having issued no
command since its banner: `clean` iff three consecutive non-halting `MemoryGet` (0x01,
`sidefx=false`) reads of the KERNAL ROM window `$E000-$E0FF` on the binary channel each return a
256-byte payload byte-identical to the same read taken with no text client connected, with zero
desync bytes and zero duplicate replies on the binary client and no unsolicited frame at
request-id `0xffffffff` arriving during the window. `corrupts` iff any read errors, times out,
returns a differing payload, or the binary client counts a desync byte, a duplicate reply, or a
pending request resolved by an event. `not-taken` iff the text port never accepted a connection,
or the binary channel could not be established, with the reason named.

**Transcribed value: `clean`** (`evidence/39-idle-coexist.md:279`, final column-0 occurrence).

Both the no-text-client control leg and the silent-text-client measured leg read the same
256-byte KERNAL ROM window three times each; all six reads share sha256
`c5fccb8583eefe727f816ca4a8034cbba9a54b2a240d7919de9169e49a85f45e`. The binary client's own
desync-byte and duplicate-reply counters were unchanged across the measured window
(`DESYNC_BYTES_DELTA: 0`, `DUPLICATE_REPLIES_DELTA: 0`), and zero unsolicited broadcast frames
arrived during it (`UNSOLICITED_BROADCAST_FRAMES_DURING_WINDOW: 0`). A silently-connected
text-monitor client does not disturb a non-halting binary-channel memory read on this build.
Owning plan: `39-03`.

### `foreign_halt_visibility`

**Derivation (`SCHEMA.md` § 2.2).** With a non-stopping exec checkpoint armed at the IRQ frame
anchor `$EA31` on the binary channel and a halting `memmapshow` issued on the text channel:
`visible` iff an unsolicited `STOPPED` frame arrives on the binary channel, or two
`CheckpointGet` reads bracketing the halt window show `hit_count` unchanged while the same
bracket without a foreign halt shows it advancing. `invisible` iff neither signal appears and
`hit_count` advances across the halt window exactly as it does without one. `corrupts` iff the
binary client desyncs, a pending request is resolved by an event, a request times out, or
`hit_count` decreases. `not-taken` iff the checkpoint could not be armed or `memmapshow` produced
no framed response.

**Transcribed value: `visible`** (`evidence/39-foreign-halt.md:307`, final column-0 occurrence).

Both admissible signals were present in **every** one of the three repetitions: an unsolicited
`STOPPED` (0x62) frame at request-id `0xffffffff` arrived during every measured window, and the
measured checkpoint-hit bracket collapsed from a steady `60`/s control to `0`-`1`/s while the
foreign halt was in effect (the residual `1` in reps 2/3 is a single `checkpoint_info` that lands
in the few milliseconds before the halt actually takes effect). The unsolicited `STOPPED` frame
is paired, every single time, with a previously-unrecorded unsolicited `REGISTER_INFO` (0x31)
frame at the same timestamp — a fact not previously recorded anywhere in this project's
`CLAUDE.md`, which currently documents `REGISTER_INFO` arriving only "on every monitor open."
Neither `corrupts` (zero desync/duplicate deltas throughout) nor `not-taken` (the checkpoint hit
at 60/s before any foreign halt, and `memmapshow` produced a fully framed response every time)
applies. Owning plan: `39-04` (Task 1).

### `concurrent_inflight`

**Derivation (`SCHEMA.md` § 2.3).** Both channel writes issued before either is awaited
(`Promise.all` over `AdvanceInstructions` on the binary channel and `prof flat 5` on the text
channel, after `prof on` and a resumed run window), repeated three times: `clean` iff all six
replies arrive within a 15s budget, each matched to its own request id, with zero desync bytes
and zero duplicate replies. `degraded` iff every reply eventually arrives but at least one
exceeded the budget, needed a retry, or the binary client counted desync bytes it recovered
from. `corrupts` iff a reply is lost, matched to the wrong request id, a pending request is
resolved by an unsolicited event, or the machine jams. `not-taken` iff the overlap could not be
produced at all.

**Transcribed value: `clean`** (`evidence/39-concurrent-inflight.md:363`, final column-0
occurrence).

Across all three repetitions of the authoritative run, both replies arrived every time
(`binaryOk=true`, `textOk=true`), each within `0`-`1`ms of the 15,000ms budget (nowhere near
exceeding it), the binary reply matched its own request id in every repetition
(`binaryMatchedReqId=true`), and both the desync-byte and duplicate-reply deltas read `0` in
every repetition. `CONCURRENT_WRITE_GAP_MS: 0` in every repetition — recorded as a caveat on how
tight the overlap really was, not a threshold: stock VICE services both monitor servers from one
single-threaded poll loop, so the measured overlap is "the text-channel write issued before the
binary channel's in-flight command was acknowledged," never literal instruction-level
simultaneity (`CONCURRENT_OVERLAP_CHARACTERISATION`, same file). Owning plan: `39-05` (Task 1).

### `cross_channel_resume`

**Derivation (`SCHEMA.md` § 2.4).** Halt from the text channel, then read registers over the
binary channel, then resume from the binary channel with `Exit` (0xaa): `clean` iff the register
read succeeds while halted, the resume is accepted, and the machine is observed running again —
confirmed by the text channel's own `sw` counter having advanced between a reading taken before
the resume and one taken at least one second after it. `corrupts` iff the register read returns
an error or an implausible frame, the resume is rejected, the machine does not resume, or the
binary client desyncs. `not-taken` iff no text-side halt could be established. The mirror
direction (halt on binary, read and resume from text via `x`) is run and recorded as a second
transcript in the same file; a disagreement between the two directions resolves to the worse
value.

**Transcribed value: `clean`** (`evidence/39-cross-channel-resume.md:354`, final column-0
occurrence).

Both directions read `clean` in both repetitions of the authoritative run. Direction 1 (halt
text, resume binary): registers and a 16-byte KERNAL-ROM memory read both succeed while halted,
`EXIT` is accepted, and the text channel's own `sw` counter is independently observed to advance
after the resume (e.g. `27027000` → `28226017`). Direction 2 (halt binary, resume text): the text
channel's `sw` and register view are read while the binary side holds the halt, `x` is sent to
release it (its own reply is not gated on, since the checkpoint's continuous trace flood means
the buffer's tail is never a stable prompt within budget), and a non-stopping checkpoint's
hit-count bracket (60 hits/1s) confirms the machine ran again. Zero desync/duplicate deltas
throughout, in every repetition of both directions. A related, previously-unmeasured reciprocal
fact surfaced building Direction 2: a binary-owned checkpoint hit (stopping or non-stopping)
pushes an unsolicited "monitor entered" breakpoint-notification banner to the TEXT console,
ending in a real prompt, with no command from the text client at all — the reciprocal of
`foreign_halt_visibility`'s binary-side unsolicited `STOPPED` frame. Owning plan: `39-04`
(Task 2).

### `disconnect_recovery`

**Derivation (`SCHEMA.md` § 2.5).** A separate child process holds a text-side halt and is
`SIGKILL`ed by the parent, so no client-side cleanup runs at all: `recovers` iff within a 60s
budget the machine is observed running again from the binary channel (a non-stopping
checkpoint's `hit_count` advances) with no further action. `leaves-halted` iff `hit_count` does
not advance within the budget; whether a fresh text connection followed by `x` restores it is
recorded separately. `not-taken` iff the victim could not establish a halt.

**Transcribed value: `recovers`** (`evidence/39-disconnect-recovery.md:368`, final column-0
occurrence).

Both runs agree: in both, the machine was observed running again within `~100ms` of the
`SIGKILL` (the front-loaded sampling schedule's earliest bucket, `tMs=99`..`101`) — far inside the
60s budget — with no further action taken, and the hit-count series across the full 60,000ms
budget is monotonically non-decreasing with no gaps in either run. Because the value is
`recovers` and not `leaves-halted`, the fresh-connection follow-up `SCHEMA.md` names for the
other branch was never triggered — a documented, deliberate branch skip, not an omission. This
measurement newly establishes that VICE's own text-monitor server treats an abruptly-killed
client's socket closing — with the victim registering zero cleanup code of its own — as a reason
to release a halt it was holding, and does so almost instantly. This is functionally the same
"connection close IS the release" property the binary side's own `broker-control.mts` code
implements at the **broker** layer (`~388-397`, per `.planning/ROADMAP.md`'s Phase 39 Notes),
except here it appears to be a property of the emulator's **own** monitor accept/select loop
noticing the peer's close — no broker process is involved anywhere in this measurement (the
probe spawns `x64sc` directly). Owning plan: `39-06` (Task 1).

### `hitcount_invariant_holds`

**Derivation (`SCHEMA.md` § 2.6).** With a non-stopping exec checkpoint armed at `$EA31` on the
binary channel, a foreign halt induced from the text channel and released with `x`: `holds` iff
throughout, no pending binary request is resolved by an unsolicited event, `hit_count` is
monotonically non-decreasing across every read, and a wait keyed on the checkpoint's own
`hit_count` — never on paused state — is not satisfied by the foreign halt and completes exactly
once when the client's own stop arrives. `breaks` iff a foreign `STOPPED` satisfies a wait that
was waiting for the client's own stop, or `hit_count` decreases or resets, or a pending request
is resolved by an event. `not-taken` iff the checkpoint could not be armed or no foreign halt
could be induced.

**Transcribed value: `holds`** (`evidence/39-hitcount-invariant.md:481`, final column-0
occurrence).

All three conjuncts held, across all three injection timings (`before`, `around`, `after` an
outstanding binary wait). No pending binary request was ever resolved by an unsolicited event —
guaranteed by construction (`stock-protocol.ts`'s `#dispatch()` routes a broadcast request id to
`'event'` before any pending-request lookup runs at all) and empirically confirmed
(`ANY_PENDING_RESOLVED_BY_EVENT: false` throughout). `hit_count` readings (`0, 1, 2, 4, 6`) never
decreased (`HIT_COUNT_NON_DECREASING: true`). And in all three timings the wait was never
satisfied by anything other than its own checkpoint's `checkpoint_info` event
(`satisfiedByForeign: false`, `finalResult.satisfiedBy: "checkpoint_info"`), including in the
`before` timing — the one where the wait was genuinely still outstanding when the foreign command
was sent, the exact adjacency collision this measurement exists to detect
(`EVERY_WAIT_RESUME_COUNT_EXACTLY_ONE: true`). Owning plan: `39-05` (Task 2).

### `hitcount_invariant_holds` — what this means for the four native upholders

Per the owning task's own instruction, an observation carried forward without changing any of
the four modules (all read-only in this plan): `stock-run-until.ts`'s `waitForCheckpointHit()`
and `stock-reproducible-run.ts`'s `waitForReproducibleStop()` both narrow on
`.type === "checkpoint_info"` then the specific checkpoint id, exactly as measured here, and both
are confirmed sound against a foreign halt. `stock-checkpoints.ts` implements no event-driven
wait path at all — its handlers are request/reply operations — so this measurement does not
apply to a wait path it does not have, though the underlying demux guarantee it also depends on
was exercised live throughout the run. `stock-diagnose.ts`'s `runStockLivenessBracket()`
explicitly does **not** follow the hit-count-polling discipline by its own author's design (it
uses wall-clock timing because stock has no non-pausing observation of any kind), so the
discipline this measurement tests does not apply to its own wait path — not because of anything
this run found.

### `text_single_client`

**Derivation (`SCHEMA.md` § 2.7).** With client A connected and served (banner plus one
successful command), a second TCP connection B is opened to the same text port under a 60s
budget, and exactly one of three observations is recorded as `TEXT_SECOND_CONNECT_OBSERVATION:`:
`accepted-and-served` maps to `multi`; `accepted-then-silent` (connect succeeds, no banner, no
EOF within budget) maps to `single`; `refused-outright` maps to `single`. A timeout on B is
`single` via `accepted-then-silent`, never `not-taken` — `not-taken` is reachable only if client
A itself could not be established.

**Transcribed value: `single`** (`evidence/39-text-single-client.md:291`, final column-0
occurrence).

In both repetitions, connection B was accepted at the OS level and never serviced at the
application level within the 60s budget (`TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent`
in both runs, `evidence/39-text-single-client.md:290`), mapping to `single` per `SCHEMA.md`
§ 2.7's explicit rule. Client A remained demonstrably served both before and after B's
connection, with no lasting effect from B's presence once it was closed. This is the text-side
analogue of the binary monitor's own documented single-client behaviour, now confirmed measured
rather than assumed for the text port too. Owning plan: `39-06` (Task 2).

**This input formally gates nothing (D-08), even though it is one of the seven declared gate
inputs.** `evidence/DECISION-RULE.md` § *Never a gate* and `evidence/39-totality.md`'s own
`TSC_INDEPENDENCE: holds` (re-run below, § *Totality, re-run*) prove mechanically, over all 1,296
tuple groups differing only in this input, that `TEXT_SINGLE_CLIENT` never changes which of
`R1`..`R15` fires. It is recorded here as a fact that constrains Phase 41's connection
management — one text client per instance, the same rule the broker already enforces for the
binary monitor — and never as something that moved this verdict.

## What this selects for the next phase

Reproduced from `evidence/DECISION-RULE.md` § *The three shapes the verdict selects*, with the
`go` branch stated concretely since it is the one this verdict selects:

- **`go` (selected) → an in-process async mutex.** Both channels stay connected for the
  session's lifetime; `broker-state.mts:129-137`'s already-anticipated `channel: "binary" |
  "text"` discriminator is kept purely for bookkeeping, never for enforcement. No broker round
  trip is added to any halting call, and no connect/release choreography is needed between the
  two channels.
- **`degrade` (not selected) → a broker-level cross-channel halt-authority lease.** Would have
  moved correctness from one process's in-memory mutex to the broker, at the cost of a round
  trip per halting call.
- **`no-go` (not selected) → a connect-gate.** Would have required opening one channel to release
  the other's claim, the two time-sharing and never coexisting live — the heaviest of the three
  shapes to build, per `.planning/ROADMAP.md`'s own Phase 41 Notes.

**Phase 43's capture step is CONCURRENT under this verdict, not scheduled.** The `no-go`
re-scoping named in `evidence/DECISION-RULE.md` and `.planning/ROADMAP.md`'s Phase 43 entry
(release the binary lease, claim/dial/capture/release the text lease, re-claim) does not apply —
this verdict selects the shape under which both leases can be held for the run's lifetime.

**`R15` is reached at all three values of `TEXT_SINGLE_CLIENT`** (`RULE_HIT_R15: 3` in
§ *Totality, re-run* below), so this verdict's selection did not depend on that input at all —
consistent with `text_single_client`'s own "gates nothing" finding above.

## Recorded facts that gate nothing

Every non-gating fact line this phase measured, transcribed and cited, with the reason it is not
a gate and what it implies for the phase(s) that consume it. None of these appears in any rule in
`evidence/DECISION-RULE.md`, and none may be added to one (`evidence/DECISION-RULE.md` §
*Never a gate*).

1. **`IDLE_TEXT_CLIENT_HALTS: no`** (`evidence/39-idle-coexist.md:275`). An idle, silently-connected
   text client does not itself halt the machine — only issuing a command does. Not a gate
   (`SCHEMA.md` § 3 declares it a recorded fact only). *Phase 41 implication:* holding the text
   client connected for the session's lifetime under the `go` shape's mutex costs nothing while
   the client is idle.
2. **`REMOTEMONITOR_FLAG_ORDER: default-first-assumed`** (`evidence/39-idle-coexist.md:276`). The
   assumed argv order (`-binarymonitor` pair, then `-remotemonitor` pair, both trailing the
   determinism block) bound both ports successfully on the first attempt in every run; the
   alternative (swapped) order was never tried. *Phase 41 implication:* the launcher's current
   argv order needs no change, though the untried alternative order remains formally unmeasured
   (`REMOTEMONITOR_FLAG_ORDER`'s own domain names this precisely for that reason).
3. **`TEXT_PROMPT_LITERAL_CONFIRMED: no`** (`evidence/39-idle-coexist.md:277`). For the connect
   banner specifically — the stock text monitor sends **nothing** on connect (an empty capture
   within the 10s `awaitBanner()` budget, not a bug in the capture code); the prompt half of the
   same acceptance criterion was confirmed matching `PROMPT_RE` byte-for-byte in a supplementary
   post-measurement check sent after the gate measurement had already concluded
   (`POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE: true`, same file). **This is a correction to a
   claim `39-CONTEXT.md` carried as already MEASURED** — `.planning/ROADMAP.md`'s own Phase 39
   Notes state "the `(C:$xxxx) ` prompt is a dependable terminator on both," which this
   measurement confirms for the prompt itself, but the same Notes paragraph's framing implicitly
   assumed a banner exists to be matched against; there is no banner at all. *Phase 41
   implication:* `CHAN-03`'s framing logic must not wait for a connect banner under any
   circumstance — there is none to wait for.
4. **`TEXT_BIND_BUDGET_MS_MAX: 0`** (`evidence/39-idle-coexist.md:278`). The text port was already
   listening and accepted instantly in the runs where it was measured, well under the binary
   port's own `~150ms`. *Phase 41 implication:* no separate bind-timeout budget is needed for the
   text port beyond what the binary port already uses.
5. **`TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent`** (`evidence/39-text-single-client.md:290`).
   The raw observation `text_single_client`'s derivation maps to `single`; recorded separately
   because the mapping rule, not the raw observation, is what the gate itself consumes. *Phase 41
   implication:* a second text connection attempt must be handled by explicit policy (refuse or
   queue) — it cannot be diagnosed automatically as a wedge from protocol signal alone, because it
   is, by this project's own prior documentation and this measurement alike, indistinguishable
   from one at the wire level.
6. **`CONCURRENT_WRITE_GAP_MS: 0`** (`evidence/39-concurrent-inflight.md:362`, every repetition).
   The wall-clock gap between the two `write()` calls; a caveat on how tight the exercised overlap
   really was, never a threshold (`evidence/DECISION-RULE.md` § *Never a gate*). No implication
   for Phase 41 beyond context: the overlap was real, not merely nominal.
7. **`FIXTURE_COUNT: 12`, `FIXTURE_BINARIES: 2`, `FIXTURE_ENCODING: has-high-bytes`,
   `FIXTURE_DIVERGENCE: access-map, flat-profile, cpu-history, backtrace, register-decode`,
   `FIXTURE_UNSUPPORTED: none`** (all `evidence/39-fixture-batch.md:342-346`). The first
   text-channel fixture batch, captured from both stock 3.9 and fork 3.10, with per-command
   divergence recorded rather than averaged (every divergence traced to real-time nondeterminism
   in raster/cycle state or process launch timing, never a stock/fork semantic difference — see
   that file's own § *Divergence*) and no command refused on either binary. Not a gate — this is
   ROADMAP success criterion 5's deliverable, not one of `CHAN-01`'s four criteria. **`FIXTURE_UNSUPPORTED: none` is itself a correction worth recording explicitly:** `chis` succeeded
   on genuine stock VICE 3.9 over the text channel, returning real per-entry cycle counts. The
   binary-monitor side's `CPUHISTORY_GET` (0x86) `>= 3.10` version floor does **not** transfer to
   the text channel's `chis` command, which reaches CPU-history capability by a completely
   different code path — no finding in this phase treats the two floors as the same gate. *Phase
   42 implication:* `PARSE-01..03`'s two-binary fixture provenance discipline is exercised and
   real from the first capture; `PARSE-02`'s `chis`-on-3.9 capability claim is independently
   confirmed here too.
8. **A stock `x64sc` launched with `-console` plus either monitor flag starts CPU-HALTED** until
   an explicit `EXIT` (0xaa) resume is sent, and a cold C64 boot additionally masks interrupts for
   its KERNAL RAM test — measured at `2034ms` on this host (`ANCHOR_FIRST_HIT`) — before the first
   `$EA31` jiffy IRQ fires (`evidence/39-foreign-halt.md` § *The four `R2`-mitigation facts*).
   Neither fact was previously recorded anywhere in this project. *Phase 41 implication:* any
   launch sequencing that assumes the machine is already running immediately after launch is
   wrong on this build; an explicit resume is required first, on every later plan in this phase
   that needed the machine actually running (`39-04` through `39-07`).
9. **ANY binary-channel command re-halts a running CPU on this build, not only `EXIT`.** Every
   command reaching the monitor, including `EXIT` itself, transits through a momentary halt —
   confirmed by the `stopped`/`registers`/`resumed` event triple accompanying this probe's own
   startup `EXIT` (`evidence/39-hitcount-invariant.md` § *Full event log summary*). *Phase 41
   implication:* any future liveness check must be passive (poll on `hit_count`, never on paused
   state); an explicit running-state poll measures its own side effect.
10. **A binary-owned checkpoint hit pushes an unsolicited breakpoint-notification banner to the
    TEXT console**, ending in a real prompt (`(C:$ea31) `), with **no command from the text client
    at all** — the reciprocal of the binary-side unsolicited `STOPPED` frame
    (`evidence/39-cross-channel-resume.md` § *A related, previously-unmeasured fact*). *Phase 41 /
    `CHAN-03` implication:* text-channel framing must drain this passively-arriving banner before
    treating the next prompt as a genuine command reply — direct input to `CHAN-03`'s framing
    scope.
11. **A foreign halt surfaces on the binary channel as an unsolicited `STOPPED` (0x62) paired,
    every time, with a previously unrecorded unsolicited `REGISTER_INFO` (0x31) at the same
    timestamp** (`evidence/39-foreign-halt.md`, and see § *Inputs* → `foreign_halt_visibility`
    above). *Phase 41 implication:* the serialization authority's foreign-halt detection can key
    on the `STOPPED` frame alone; the paired `REGISTER_INFO` is a bonus signal, not a required
    one.
12. **A killed text client's socket close releases the machine within `~100ms`, with no broker
    involved** — mirroring `broker-control.mts`'s "connection close IS the release" semantics at
    the emulator's own monitor accept loop rather than at the broker layer
    (`evidence/39-disconnect-recovery.md`, and see § *Inputs* → `disconnect_recovery` above).
    **`.planning/ROADMAP.md`'s own Phase 39 Notes anticipated the opposite outcome** and
    pre-mapped a required Phase 41 mechanism (`R11`'s pre-mapped narrowing, `D-10`) for a machine
    left permanently halted by a killed text client. Since neither `R11` nor its narrowing fired
    (checked explicitly above, § *Narrowings*), **that mechanism is not needed** under this
    verdict.

## Assumptions this phase closed

Four of the five research assumptions `39-RESEARCH.md`'s § *Assumptions Log* logged as open at
planning time were specifically about the text channel's own runtime behaviour once connected
(`A2`-`A5`); the fifth (`A1`, the launch-flag ordering discipline) is closed by
`REMOTEMONITOR_FLAG_ORDER` above rather than restated here.

- **`A2` — the `(C:$xxxx) ` prompt regex correctly identifies response-complete.** CLOSED, true
  for actual prompts: a bare newline sent strictly after the gate measurement concluded produced
  `(C:$e5cf) `, which matched `PROMPT_RE` byte-for-byte
  (`POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE: true`, `evidence/39-idle-coexist.md`). The
  banner half of the same acceptance criterion does not apply — see `TEXT_PROMPT_LITERAL_CONFIRMED: no` above.
- **`A3` — the greeting banner does not require framing before the first command can be sent.**
  CLOSED, and more strongly true than assumed: there is no greeting banner at all — zero bytes
  received within the 10s `awaitBanner()` budget on connect (`evidence/39-idle-coexist.md` §
  *Raw connect-banner bytes*). Since nothing is sent by VICE on connect, there is nothing to
  frame or race.
- **`A4` — the text port's bind-time budget is the same order of magnitude as the binary port's.**
  CLOSED: `TEXT_BIND_BUDGET_MS_MAX: 0` (`evidence/39-idle-coexist.md:278`), well under the binary
  port's own `~150ms` — the text port actually binds faster, not merely comparably.
- **`A5` — a second connection's outcome is distinguishable in bounded time from a genuine
  crash/wedge, without broker tooling in the loop.** CLOSED, but **not** in the direction assumed:
  `TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent` is explicitly described, in the same
  file, as "indistinguishable from a hang under a short budget"
  (`evidence/39-text-single-client.md`). The risk `A5` named partly materialized — a second
  connection's outcome is **not** distinguishable from a wedge by protocol signal alone. `SCHEMA.md`
  § 2.7's own frozen rule resolves this procedurally (any timeout on B is `single` via
  `accepted-then-silent`, never `not-taken`) rather than by disproving the indistinguishability.

## Accepted limits

No measuring plan in this phase recorded a `## ACCEPTED LIMIT` section, and this is itself a
recorded fact rather than an oversight: `evidence/39-concurrent-inflight.md` and
`evidence/39-hitcount-invariant.md` each state explicitly, in their own § *Derivation*, "No
`## ACCEPTED LIMIT` section is needed"; the remaining five evidence files
(`39-idle-coexist.md`, `39-foreign-halt.md`, `39-cross-channel-resume.md`,
`39-disconnect-recovery.md`, `39-text-single-client.md`, `39-fixture-batch.md`) never raise the
question at all. This phase is therefore the first of this project's four go/degrade/no-go gates
to close with zero accepted limits: every ambiguity `evidence/DECISION-RULE.md` anticipated —
`R2`'s residual probe-defect risk, the frozen ordering claim — either resolved cleanly against the
measurement itself or was addressed by `SCHEMA.md`'s own procedural fact-lines (§ *R2-mitigation
facts* above) rather than by an override. No explicit override of a committed rule or narrowing
was taken anywhere in this document.

## Ordering, re-verified

`CHAN-01` rests on commit ordering and nothing else (`D-06` declined a test guard). Re-run now,
after all seven measurements have landed:

```
$ E=.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence
$ RULES=$(git log --diff-filter=A --format=%H -- "$E/DECISION-RULE.md" | tail -1)
$ echo "$RULES"
05c2c06916b8e41669e7d6a8b8e8447b4e760f59

$ git rev-list --count "$RULES" -- "$E"
1

$ git log --oneline -1 -- "$E/DECISION-RULE.md"
05c2c069 feat(39-01): freeze CHAN-01 decision rules, schema and executable totality walk

$ FIRST=$(git rev-list --reverse HEAD -- "$E" | head -1)
$ echo "$FIRST"
05c2c06916b8e41669e7d6a8b8e8447b4e760f59

$ test "$RULES" = "$FIRST" && echo "ORDERING_MATCH: yes"
ORDERING_MATCH: yes
```

**Still `1`, and still the earliest.** The adding commit of `DECISION-RULE.md`
(`05c2c069`) remains the only commit reachable from itself that touches `evidence/`, and it is
still the first commit in the whole reachable history to touch that path — re-checked here,
after every one of this phase's seven measurements has landed, rather than only at `39-01` when
nothing else existed yet.

## Totality, re-run

The committed walk (`evidence/totality-walk.mjs`) re-executed against the same seven declared
value domains, unchanged since `39-01`:

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/totality-walk.mjs
TOTAL_TUPLES: 3888
RULE_HIT_R1: 1296
RULE_HIT_R2: 1296
RULE_HIT_R3: 324
RULE_HIT_R4: 324
RULE_HIT_R5: 324
RULE_HIT_R6: 81
RULE_HIT_R7: 81
RULE_HIT_R8: 81
RULE_HIT_R9: 27
RULE_HIT_R10: 27
RULE_HIT_R11: 9
RULE_HIT_R12: 9
RULE_HIT_R13: 3
RULE_HIT_R14: 3
RULE_HIT_R15: 3
TOTALITY: holds
TSC_INDEPENDENCE: holds
COULD_NOT_RUN_EMITTABLE: no
TSC_GROUP_COUNT: 1296

$ echo "EXIT: $?"
EXIT: 0
```

**Unchanged from the banked output in `evidence/39-totality.md`** — same total (`3888`), same
per-rule histogram, `TOTALITY: holds`, `TSC_INDEPENDENCE: holds`,
`COULD_NOT_RUN_EMITTABLE: no`. This re-confirms, after all seven measurements have landed: every
one of the 3,888 input tuples resolves to exactly one rule; `could-not-run` remains structurally
unemittable; and `TEXT_SINGLE_CLIENT` is proven, mechanically, to gate nothing — the concrete
finding this verdict's own `text_single_client` section rests on, and the reason `RULE_HIT_R15: 3`
(this verdict's own rule, reached at all three values of that input) is load-bearing rather than
coincidental.
