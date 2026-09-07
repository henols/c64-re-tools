# Phase 39 — The outcome-line schema and measurement definitions

**Binding. Committed before any measurement exists.** Every literal name the rest of this
phase may emit is fixed here, together with the **derivation rule** that produces its value
from raw measurement — so no measuring plan can invent a favourable definition, and no plan
can mint a line name that flatters its own result. A measuring plan that needs a name not
declared below has found a gap in the pre-commitment; it records that as an `## ACCEPTED
LIMIT` in its **own** evidence file and the findings document records an explicit override.
**It does not invent a name, and it does not edit this file.**

`DECISION-RULE.md` reads its inputs from the lines declared here. The two files are one
pre-commitment in two parts and share its frozen status.

---

## 1. Outcome-line conventions

Every rule input and every recorded fact is a bare `NAME: value` at **column 0** of a named
evidence file. Never indented, never inside a fenced block that a reader would take for
sample output, never inside a table cell.

- **Final occurrence wins.** Where a line is written more than once in one file, the last
  occurrence is the value. Stated because Phase 9's own evidence carried a superseded early
  `INSTALLED_VERSION:` line that was only resolved 106 lines later.
- **One declared source file per line.** The tables below name exactly one file per line
  name. A gate input written into a second file is not a second opinion; it is a name
  collision, and the declared file is the one that counts.
- **Absence.** For the **seven gate inputs** an absent line is not a pass, not a default and
  not a defensible state — it is an incomplete phase. For every other line declared below,
  absence is permitted where the branch that would write it was not taken, and is noted as
  such in the tables.
- **Transcripts are appended, never reconstructed.** The `$ <command>` line convention, the
  `BROKER_STATE:` / `TEST_AUTOMATED_BASELINE:` requirement and the voided-run rule are in
  `README.md` § *Evidence conventions*, which is binding on every plan in this phase.

---

## 2. The seven gate inputs

These seven, and only these seven, are read by `DECISION-RULE.md`. Paths are relative to
`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/`.

| Line | Domain | Corpus-free | Declared source file |
|---|---|---|---|
| `IDLE_COEXIST` | `clean` \| `corrupts` \| `not-taken` | yes | `evidence/39-idle-coexist.md` |
| `FOREIGN_HALT_VISIBILITY` | `visible` \| `invisible` \| `corrupts` \| `not-taken` | yes | `evidence/39-foreign-halt.md` |
| `CONCURRENT_INFLIGHT` | `clean` \| `degraded` \| `corrupts` \| `not-taken` | yes | `evidence/39-concurrent-inflight.md` |
| `CROSS_CHANNEL_RESUME` | `clean` \| `corrupts` \| `not-taken` | yes | `evidence/39-cross-channel-resume.md` |
| `DISCONNECT_RECOVERY` | `recovers` \| `leaves-halted` \| `not-taken` | yes | `evidence/39-disconnect-recovery.md` |
| `HITCOUNT_INVARIANT_HOLDS` | `holds` \| `breaks` \| `not-taken` | yes | `evidence/39-hitcount-invariant.md` |
| `TEXT_SINGLE_CLIENT` | `single` \| `multi` \| `not-taken` | yes | `evidence/39-text-single-client.md` |

`could-not-run` is **not** in any of these seven domains. It is not a spelling this phase uses
for a gate input at all: every one of the seven is corpus-free, and each carries `not-taken`
as an input value for the case where the experiment could not be taken.

This is the **inversion** of Phase 33's distinguishing property: Phase 23's gate could return
`could-not-run` because every input needed a corpus; Phase 33 removed that by making four of
five inputs corpus-free, leaving one corpus-bound input whose absence was still a value
(`not-obtained`). Here **all seven** are corpus-free, so the abstention risk is not a missing
corpus but an **untakeable experiment**, and `not-taken` is what absorbs it.

### 2.1 `IDLE_COEXIST` — derivation

With the text client connected and having issued **no** command since its banner:

- **`clean`** iff three consecutive non-halting `MemoryGet` (0x01, `sidefx=false`) reads of the
  KERNAL ROM window `$E000-$E0FF` on the binary channel each return a 256-byte payload
  byte-identical to the same read taken with **no** text client connected, with zero desync
  bytes and zero duplicate replies on the binary client and no unsolicited frame at request-id
  `0xffffffff` arriving during the window. A ROM window is specified rather than RAM because
  it is invariant under execution, so byte-identity is a valid predicate.
- **`corrupts`** iff any read errors, times out, returns a differing payload, or the binary
  client counts a desync byte, a duplicate reply, or a pending request resolved by an event.
- **`not-taken`** iff the text port never accepted a connection, or the binary channel could
  not be established, with the reason named.

### 2.2 `FOREIGN_HALT_VISIBILITY` — derivation

With a non-stopping (`stop_when_hit=false`) exec checkpoint armed at the IRQ frame anchor
`$EA31` on the binary channel and a halting `memmapshow` issued on the text channel:

- **`visible`** iff at least one of (a) an unsolicited `STOPPED` (0x62) frame arrives on the
  binary channel at request-id `0xffffffff`, or (b) two `CheckpointGet` (0x11) reads
  bracketing the halt window show `hit_count` unchanged while the same bracket taken without a
  foreign halt shows it advancing — record which.
- **`invisible`** iff neither signal appears and `hit_count` advances across the halt window
  exactly as it does without one.
- **`corrupts`** iff the binary client desyncs, a pending request is resolved by an event, a
  request times out, or `hit_count` decreases.
- **`not-taken`** iff the checkpoint could not be armed or `memmapshow` produced no framed
  response.

### 2.3 `CONCURRENT_INFLIGHT` — derivation

Both channel writes issued before either is awaited (`Promise.all` over `AdvanceInstructions`
(0x71, count=1) on the binary channel and `prof flat 5` on the text channel, after `prof on`
and a resumed run window), repeated three times:

- **`clean`** iff all six replies arrive within the stated 15 s budget, each matched to its
  own request id, with zero desync bytes and zero duplicate replies.
- **`degraded`** iff every reply eventually arrives but at least one exceeded the budget,
  needed a retry, or the binary client counted desync bytes it recovered from.
- **`corrupts`** iff a reply is lost, matched to the wrong request id, a pending request is
  resolved by an unsolicited event, or the machine jams.
- **`not-taken`** iff the overlap could not be produced at all.

The wall-clock gap between the two `write()` calls is recorded as `CONCURRENT_WRITE_GAP_MS:`
in every case, so a reader judges how tight the overlap really was — it is a caveat, never a
threshold.

### 2.4 `CROSS_CHANNEL_RESUME` — derivation

Halt from the text channel, then read registers over the binary channel, then resume from the
**binary** channel with `Exit` (0xaa):

- **`clean`** iff the register read succeeds while halted, the resume is accepted, and the
  machine is observed running again — confirmed by the text channel's own `sw` counter having
  advanced between a reading taken before the resume and one taken at least one second after
  it.
- **`corrupts`** iff the register read returns an error or an implausible frame, the resume is
  rejected, the machine does not resume, or the binary client desyncs.
- **`not-taken`** iff no text-side halt could be established.

The mirror direction (halt on binary, read and resume from text via `x`) is run and recorded
in the same file as a second transcript; a disagreement between the two directions is
recorded loudly and resolves to the worse value.

### 2.5 `DISCONNECT_RECOVERY` — derivation

A separate child process holds a text-side halt and is `SIGKILL`ed by the parent — a separate
process rather than a same-process `socket.destroy()` so no client-side cleanup runs at all,
which is the literal reading of "SIGKILL the text client":

- **`recovers`** iff within a stated 60 s budget the machine is observed running again from
  the binary channel (a non-stopping checkpoint's `hit_count` advances) with **no** further
  action.
- **`leaves-halted`** iff `hit_count` does not advance within the budget; record separately
  whether a fresh text connection followed by `x` restores it, since that is the mechanism
  `R11`'s narrowing names.
- **`not-taken`** iff the victim could not establish a halt.

### 2.6 `HITCOUNT_INVARIANT_HOLDS` — derivation

With a non-stopping exec checkpoint armed at `$EA31` on the binary channel, a foreign halt
induced from the text channel and released with `x`:

- **`holds`** iff throughout, (a) no pending binary request is resolved by an unsolicited
  event, (b) `hit_count` is monotonically non-decreasing across every read, and (c) a wait
  keyed on the checkpoint's own `hit_count` — never on paused state — is **not** satisfied by
  the foreign halt and completes exactly once when the client's own stop arrives.
- **`breaks`** iff a foreign `STOPPED` satisfies a wait that was waiting for the client's own
  stop, or `hit_count` decreases or resets, or a pending request is resolved by an event.
- **`not-taken`** iff the checkpoint could not be armed or no foreign halt could be induced.

### 2.7 `TEXT_SINGLE_CLIENT` — derivation

With client A connected and served (banner plus one successful command), a second TCP
connection B is opened to the same text port under a stated **60 s** budget, and exactly one
of three observations is recorded as `TEXT_SECOND_CONNECT_OBSERVATION:`:

- **`accepted-and-served`** (B receives a banner and a command reply) maps to **`multi`**.
- **`accepted-then-silent`** (connect succeeds, no banner, no EOF within the budget) maps to
  **`single`**.
- **`refused-outright`** (connection refused or reset) maps to **`single`**.

**A timeout on B is `single` via `accepted-then-silent`, never `not-taken`** — the second
`connect()` to a single-client server is documented as indistinguishable from a wedge, and
recording `not-taken` because a short timeout expired would launder the real answer into
silence. `not-taken` is reachable only if client A itself could not be established.

---

## 3. Recorded facts that are not gate inputs

Declared here so a measuring plan cannot mint them and a later plan cannot promote them. For
each: the line name, its domain, and its single declared source file. **None of them appears
in any rule** in `DECISION-RULE.md`, and none may be added to one (see that file's § *Never a
gate*).

| Line | Domain | Declared source file |
|---|---|---|
| `IDLE_TEXT_CLIENT_HALTS` | `yes` \| `no` \| `not-taken` | `evidence/39-idle-coexist.md` |
| `REMOTEMONITOR_FLAG_ORDER` | `default-first-assumed` \| `default-first-measured-required` \| `order-irrelevant-measured` | `evidence/39-idle-coexist.md` |
| `TEXT_PROMPT_LITERAL_CONFIRMED` | `yes` \| `no` | `evidence/39-idle-coexist.md` |
| `TEXT_BIND_BUDGET_MS_MAX` | non-negative integer, milliseconds | `evidence/39-idle-coexist.md` |
| `TEXT_SECOND_CONNECT_OBSERVATION` | `accepted-and-served` \| `accepted-then-silent` \| `refused-outright` | `evidence/39-text-single-client.md` |
| `CONCURRENT_WRITE_GAP_MS` | non-negative integer, milliseconds | `evidence/39-concurrent-inflight.md` |
| `FIXTURE_COUNT` | non-negative integer | `evidence/39-fixture-batch.md` |
| `FIXTURE_BINARIES` | non-negative integer | `evidence/39-fixture-batch.md` |
| `FIXTURE_ENCODING` | `ascii-7bit` \| `has-high-bytes` | `evidence/39-fixture-batch.md` |
| `FIXTURE_DIVERGENCE` | `none` \| `<comma-separated commands>` | `evidence/39-fixture-batch.md` |
| `FIXTURE_UNSUPPORTED` | `none` \| `<comma-separated commands>` | `evidence/39-fixture-batch.md` |
| `TOTAL_TUPLES` | integer, expected `3888` | `evidence/39-totality.md` |
| `TOTALITY` | `holds` \| `violated` | `evidence/39-totality.md` |
| `TSC_INDEPENDENCE` | `holds` \| `violated` | `evidence/39-totality.md` |
| `COULD_NOT_RUN_EMITTABLE` | `no` \| `yes` | `evidence/39-totality.md` |
| `RULE_HIT_R1` .. `RULE_HIT_R15` | non-negative integer, summing to `TOTAL_TUPLES` | `evidence/39-totality.md` |

Plus the three lines every evidence file in this phase carries: `BROKER_STATE:`,
`TEST_AUTOMATED_BASELINE:` and `VICE_BINARY:` / `VICE_VERSION_OBSERVED:` (README.md § *Evidence
conventions* 3, 4 and 5).

---

## 4. The findings-document frontmatter shape

Fixed here, before `docs/phase39-dual-channel-coexistence-gate-findings.md` exists, mirroring
`docs/phase33-reproducible-run-gate-findings.md`. Keys in this order:

| Key | Domain |
|---|---|
| `phase` | `39-the-dual-channel-coexistence-gate-go-degrade-no-go` |
| `requirement` | `CHAN-01` |
| `probe_date` | `YYYY-MM-DD` |
| `verdict` | exactly one of `go`, `degrade`, `no-go` — `could-not-run` is **not** in this field's domain, and that is structural rather than a promise |
| `verdict_rule_applied` | matches `R[1-9]` or `R1[0-5]` — the id of the **first** rule that fired |
| `inputs.idle_coexist` | the `IDLE_COEXIST` domain in § 2.1 |
| `inputs.foreign_halt_visibility` | the `FOREIGN_HALT_VISIBILITY` domain in § 2.2 |
| `inputs.concurrent_inflight` | the `CONCURRENT_INFLIGHT` domain in § 2.3 |
| `inputs.cross_channel_resume` | the `CROSS_CHANNEL_RESUME` domain in § 2.4 |
| `inputs.disconnect_recovery` | the `DISCONNECT_RECOVERY` domain in § 2.5 |
| `inputs.hitcount_invariant_holds` | the `HITCOUNT_INVARIANT_HOLDS` domain in § 2.6 |
| `inputs.text_single_client` | the `TEXT_SINGLE_CLIENT` domain in § 2.7 |

The seven `inputs.*` values are **transcribed** from the literal outcome lines declared in
§ 2, each with a trailing comment citing the evidence file and line its value was transcribed
from, final occurrence wins.

**Incremental population.** The `inputs:` block is populated as measurements land. A
not-yet-transcribed input carries the literal placeholder **`not-yet-transcribed`**, and that
placeholder is **not** a member of any input's value domain. The `verdict:` and
`verdict_rule_applied:` keys are **absent** until all seven inputs carry real domain members —
a findings document with the `verdict:` key present alongside any `not-yet-transcribed`
placeholder is an incomplete phase, exactly as an absent outcome line is.

The body reproduces the full rule set verbatim and walks the actual outcome values through it,
so a reader mechanically re-derives the verdict rather than taking it on trust, and names
which rules were **not evaluated** because an earlier one matched.
