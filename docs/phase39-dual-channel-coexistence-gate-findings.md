---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
requirement: [CHAN-01]
probe_date: 2026-09-07
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared source file. Paths are relative to
  # .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/.
  idle_coexist: clean          # evidence/39-idle-coexist.md:279
  foreign_halt_visibility: not-yet-transcribed
  concurrent_inflight: not-yet-transcribed
  cross_channel_resume: not-yet-transcribed
  disconnect_recovery: not-yet-transcribed
  hitcount_invariant_holds: not-yet-transcribed
  text_single_client: not-yet-transcribed
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

## Status

**Incomplete by construction.** One of the seven gate inputs is transcribed
(`inputs.idle_coexist`); the other six carry the literal placeholder `not-yet-transcribed`,
which is not itself a member of any input's value domain (`SCHEMA.md` § 4). The `verdict:` and
`verdict_rule_applied:` frontmatter keys are **absent**, not provisional — `SCHEMA.md` requires
they stay absent until all seven inputs carry real domain members, and this document does not
state or imply a verdict anywhere below.

| Input | Status | Owning plan |
|---|---|---|
| `idle_coexist` | transcribed (`clean`) | `39-03` (this plan) |
| `foreign_halt_visibility` | not-yet-transcribed | `39-04` |
| `concurrent_inflight` | not-yet-transcribed | `39-06` |
| `cross_channel_resume` | not-yet-transcribed | `39-05` |
| `disconnect_recovery` | not-yet-transcribed | `39-08` |
| `hitcount_invariant_holds` | not-yet-transcribed | `39-07` |
| `text_single_client` | not-yet-transcribed | `39-08` |

## Inputs

One subsection per input, in `DECISION-RULE.md` § *Inputs* row order. Each reproduces
`SCHEMA.md`'s derivation for that input; the measured subsection additionally carries the
transcribed value, its citation, and a short reading of what was observed.

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

Not yet measured. Owned by `39-04`.

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

Not yet measured. Owned by `39-06`.

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

Not yet measured. Owned by `39-05`.

### `disconnect_recovery`

**Derivation (`SCHEMA.md` § 2.5).** A separate child process holds a text-side halt and is
`SIGKILL`ed by the parent (so no client-side cleanup runs at all): `recovers` iff within a 60s
budget the machine is observed running again from the binary channel (a non-stopping
checkpoint's `hit_count` advances) with no further action. `leaves-halted` iff `hit_count` does
not advance within the budget; whether a fresh text connection followed by `x` restores it is
recorded separately. `not-taken` iff the victim could not establish a halt.

Not yet measured. Owned by `39-08`.

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

Not yet measured. Owned by `39-07`.

### `text_single_client`

**Derivation (`SCHEMA.md` § 2.7).** With client A connected and served (banner plus one
successful command), a second TCP connection B is opened to the same text port under a 60s
budget, and exactly one of three observations is recorded as `TEXT_SECOND_CONNECT_OBSERVATION:`:
`accepted-and-served` maps to `multi`; `accepted-then-silent` (connect succeeds, no banner, no
EOF within budget) maps to `single`; `refused-outright` maps to `single`. A timeout on B is
`single` via `accepted-then-silent`, never `not-taken` — `not-taken` is reachable only if client
A itself could not be established.

Not yet measured. Owned by `39-08`.

## The three shapes

Reproduced verbatim from `evidence/DECISION-RULE.md` § *The three shapes the verdict selects*,
so a reader of this document alone can see what each verdict would select for the next phase:

- **`go`** → an in-process async mutex, both channels connected for the session's lifetime,
  the `channel` discriminator kept for bookkeeping only.
- **`degrade`** → a broker-level cross-channel halt-authority lease, moving correctness from
  one process's in-memory mutex to the broker, at the cost of a round trip per halting call.
- **`no-go`** → a connect-gate in which opening one channel requires releasing the other's
  claim, the two time-sharing and never coexisting live.

A `no-go` does not kill the runtime-evidence layer: it makes Phase 43's capture step
**scheduled** rather than concurrent, and Phase 43 is written to survive it.

No verdict is stated or implied anywhere in this document. Deriving it is `39-08`'s single job,
from all seven transcribed values in one place.
