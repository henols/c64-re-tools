# Pitfalls Research

**Domain:** Adding a text-monitor channel + runtime evidence layer to c64-re-tools
**Researched:** 2026-09-06
**Confidence:** MEDIUM-HIGH (mixed — several items are HIGH-confidence, sourced against the live
probe in `.planning/notes/text-monitor-channel-live-probe.md` and against VICE's own changelog and
`configure.ac`; the two-channel interference items are explicitly UNVERIFIED and flagged as such,
per the project's own "unverified hazard, do not assert" discipline)

This is a **subsequent-milestone** pitfalls file. Every entry below is scoped to adding these four
specific things to *this* system, not to text-parsing or emulator-driving in general. Several
entries extend a constraint already recorded in `CLAUDE.md` or `.planning/PROJECT.md` — each such
entry says explicitly what was already known and what is new here.

---

## Critical Pitfalls

### Pitfall 1: Format drift is semantic, not syntactic — VICE has silently inverted meaning before

**What goes wrong:**
A parser is built against one VICE binary's output and stops being *wrong in a way that errors* —
it keeps parsing successfully, just onto the wrong meaning. VICE's own changelog contains a
confirmed instance of exactly this: **VICE 3.4** changed `mc`/`ms` (memory bitmap dump) to "show
asterisk for 1s and dots for 0s, not the other way around" — the column layout, delimiters, and
line shape are all byte-identical before and after; only the *meaning* of the same two glyphs
flipped. A parser fixture pinned before 3.4 and never re-checked against a post-3.4 binary would
silently report the inverse of the truth, with no exception, no missing field, and no test failure
unless the fixture itself is periodically re-derived from a live binary.

Two further **confirmed** version-drift instances, weaker but still real:
- **VICE 3.0**: "`chis` command now prints a 12 digit cycle counter" — a column-width change to
  the exact field (`chis`'s trailing cycle count) this milestone's evidence layer keys runs by.
  A fixed-width column parser breaks; a whitespace-split parser survives by luck, not by design.
- **VICE 3.5**: "memmap extension: show reads of non initialized ram" — a **new access-class
  value** appended to `memmapshow`'s output. A parser enumerating a closed set of known classes
  (`IO`/`ROM`/`RAM` × `r`/`w`/`x`) throws or silently drops the new class depending on how the
  enum is handled; neither is caught by a fixture captured on an older binary.

**Why it happens:**
The text monitor's output was never a wire contract — it is written for a human reading a
terminal, and VICE's own release notes treat cosmetic-looking changes ("show asterisk for 1s...")
as ordinary bugfixes, not breaking changes, because from VICE's side nothing broke. This project
has no upstream changelog subscription and the live probe that grounds this milestone was run
against exactly one binary (stock 3.9).

**How to avoid:**
- Treat every parser as **pinned to the exact `(binary sha256, VICE version string)` pair it was
  fixture-tested against** — the same key discipline `CAP-01..04` already uses for capture
  records. Do not assume a parser fixture generalizes across versions without a live re-check.
- At connection time, read the version banner the text monitor already prints on connect and
  record it alongside every parsed result, the same way `CPUHISTORY_GET`'s per-binary three-way
  answer is already cached once per binary (`docs/stock-vice-parity.md`).
- Parse into a **closed, exhaustively-enumerated value set** per field (e.g. the six `ioRWXrwx`
  mask bits) and **fail loudly, never drop silently,** on an unrecognized token — the opposite of
  "be liberal in what you accept." A silently-dropped new access class is worse than a crash.
- Do not trust a single captured fixture as covering "the text monitor's output." Capture fixtures
  against the actual installed binaries this project supports (stock 3.9 confirmed live; anything
  claiming 3.10+ support needs its own live capture, exactly as `CPUHISTORY_GET`'s opcode-gate
  logic already does for the binary monitor).

**Warning signs:**
A parser that has never been re-run against a second real VICE binary; a fixture file whose
provenance comment does not name an exact version; any enum-of-known-values in the parser that
has no explicit "unrecognized value" branch; a green test suite that has never seen a real
post-3.4 or post-3.5 binary.

**Phase to address:**
The phase that builds the text-monitor output parsers (`memmapshow`, `prof flat`, `chis`, `bt`,
`io`) — before any evidence-layer phase consumes their output.

---

### Pitfall 2: The text protocol has no frame delimiter — end-of-output is inferred, not declared

**What goes wrong:**
Unlike the binary monitor this project already has a demux for (11-byte request header / 12-byte
response header, request-id keyed, per `CLAUDE.md`), the text monitor over `-remotemonitor` is a
raw line-oriented TCP stream with **no length prefix and no explicit end-of-response marker**. The
only signal that a command's output is finished is the reappearance of the interactive prompt
(shape like `(C:$e5cf)`) or, for some commands, simply "no more bytes arrived for a while." A
client that reads until it sees a prompt-shaped substring will falsely terminate early if a label,
comment, or disassembled string operand inside the output happens to contain that substring, and
will hang forever if a command's output is large enough to be delivered in multiple TCP segments
that split the prompt bytes across two `read()` calls.

**Why it happens:**
This project already solved framing once, for the binary monitor, and the fix does not transfer:
there is no `body_length` field to read for the text channel. Every general-purpose approach
(prompt-string matching, quiet-period timeout) is a heuristic, not a guarantee, and the two known
failure modes — false-early-stop on embedded prompt-like text, and false-hang on a coalesced or
split TCP segment — are the two failure modes every text-based REPL-over-socket integration
in this project's history (this is the *first* one) has never had to design around.

**How to avoid:**
- Do not key end-of-output detection on a literal prompt substring appearing anywhere in the
  stream. Anchor it to the **start of a line** (prompt always begins a line after a trailing
  newline) and, if the emulator supports it, prefer an unambiguous sentinel command issued
  immediately after the real command (e.g. request a value known not to appear in the target
  command's own output) as a fence.
- Buffer incrementally and re-scan the buffer tail on every `data` event rather than assuming one
  `read()` == one complete response; explicitly test a fixture that splits the prompt bytes across
  two writes.
- Bound every read with a timeout that raises a named, typed error (mirroring `vice-sync.ts`'s
  existing invariant of never silently waiting forever) rather than hanging indistinguishably from
  a wedge.

**Warning signs:**
A parser test suite that only ever feeds one single, complete buffer per command (never a split
write); no timeout on the text-channel read path; a command whose expected output could plausibly
contain the literal characters `(C:$`.

**Phase to address:**
The phase that builds the text-monitor TCP client (before the parsers are wired to it).

---

### Pitfall 3: Interleaved halt/resume between the text and binary channels — UNVERIFIED and gating

**What goes wrong (if true — not yet established):**
Both channels halt the *same* single emulated machine on any command (confirmed for both,
independently, in the live probe). If a text-channel command halts the machine while the binary
channel's client believes it is running (or vice versa), several corruptions become possible: the
binary client's `vice-sync.ts` poll-on-`hit_count` invariant could observe a hit count that didn't
change because the *other* channel is the one holding the machine stopped, misreading "not yet"
as "still running"; a text-channel `x` (resume) could resume a machine the binary side just halted
for its own read, producing a state change the binary side never issued and does not expect;
and conversely, a binary-side resume could silently invalidate a text-channel command already in
flight.

**Why it happens:**
`CLAUDE.md` already documents that a non-stopping *binary* checkpoint emits `CHECKPOINT_INFO`
synchronously "from inside the CPU loop" — proof the emulator's halt/resume machinery is not
scoped per-connection, it is global machine state that any connected monitor server observes.
The live probe confirms **bind-time coexistence only** — both `BinaryMonitorServer` and
`MonitorServer` resources are polled from the same `monitor_vsync_hook()` — and explicitly states
interleaved *command* behaviour "was not tested and must be established before any dual-channel
controller is designed." This project has never before had two live command channels to the same
machine; the binary monitor's own single-client rule (`CLAUDE.md`) was the only concurrency this
system's design has ever had to reason about.

**How to avoid:**
- **Do not design a dual-channel controller before running the specific live probe this note
  already names as missing**: hold a binary session at a checkpoint, issue a resume from the text
  channel, and observe whether the binary session's next read reflects it (and the reverse). This
  is a required, gating experiment for the first phase of this milestone, not an implementation
  detail to discover mid-build.
- If interleaving is confirmed unsafe, the two channels must be **mutually exclusive at the
  scheduler level within this project's own broker** — never issue a command on one channel while
  the other has an outstanding un-resumed halt — even though VICE itself imposes no such
  exclusion. This is a client-side serialization discipline layered on top of, not a replacement
  for, `vice-sync.ts`'s existing single-resume-per-wait invariant.
- If interleaving turns out to be safe in some specific ordering only (e.g. safe only when the
  text channel is used exclusively during a bracket the binary channel is not touching), that
  ordering must be written down as an explicit invariant and tested with a planted-violation
  control, per `ENGINEERING_RULES.md` §6 — not left as an implicit assumption the way the binary
  monitor's own single-client rule was discovered *through* a wedge-triage incident rather than
  designed in from the start.

**Warning signs:**
Any implementation plan that opens both channels and assumes they can be driven independently
without a shared scheduler; a test suite for the evidence layer that never exercises the binary
and text channels in the same test process at overlapping times; a live run where a checkpoint
that should have stopped the machine (armed on the binary side) is observed *not* stopping it,
with no error surfaced.

**Phase to address:**
The phase that claims the text-monitor channel as a second client — this is the explicit
"hard prerequisite... gate on everything else here" the project's own seed document
(`runtime-evidence-layer.md`) already names. No later phase should proceed past this uncertainty.

---

### Pitfall 4: `default_memspace` and checkpoint visibility races across channels — partially known, partially new

**What goes wrong:**
`CLAUDE.md` already records that a drive checkpoint hit contaminates `default_memspace` on the
**binary** monitor with no binary-side remedy, and the live probe confirms `device c:` on the
**text** channel is the fix. What is **new** here: if a text-channel `device c:` is issued to
repair contamination that a *binary-channel* drive checkpoint just caused, and the two channels are
not strictly serialized (Pitfall 3), the repair could race a binary-channel `ADVANCE_INSTRUCTIONS`
or `EXECUTE_UNTIL_RETURN` call that reads or depends on `default_memspace` at the same moment —
the fix and the symptom could interleave rather than strictly precede/follow each other. Likewise,
checkpoint state (armed/disarmed, hit counts) is *global* machine state; a checkpoint installed via
one channel and inspected via the other has never been tested for consistent visibility.

**Why it happens:**
This is a **new combination** of two previously-independent, previously-true facts: the memspace
contamination bug is real and already documented, and the text channel is now (per this milestone)
a second, concurrently-reachable command path into the same global state. Neither fact alone
predicts the race; the race exists only once both channels are live at once.

**How to avoid:**
- Do not treat `device c:` as a fire-and-forget remedy callable at any time. Gate it behind the
  same serialization discipline Pitfall 3 requires — issue it only when the controller can prove
  no binary-channel operation depending on memspace is outstanding.
- Add an explicit, tested assertion (not a comment) that checkpoint list/hit-count reads return
  the same answer regardless of which channel asks, before any code depends on that being true.

**Warning signs:**
A stepping call on the binary channel returning drive-CPU results shortly after a text-channel
`device c:` was issued from a *different* code path (e.g. the evidence layer's own bracket setup)
than the one that triggered the original contamination.

**Phase to address:**
Same phase as Pitfall 3 (the coexistence probe) for the underlying invariant; the phase that wires
`memmapzap`/`memmapshow` bracketing (evidence layer) for the specific interaction with drive
checkpoints, since that is where a text-channel `device c:` call is most likely to be issued
programmatically for the first time.

---

### Pitfall 5: Two-channel corruption can look *exactly* like the wedge-triage skill's known verdicts — and isn't one of them

**What goes wrong:**
`src/skills/vice-wedge-triage/SKILL.md` has a fixed, tested verdict vocabulary
(`live`/`checkpoint_trap`/`restarted`/`monitor_held_elsewhere`/`wedged`, stock) built entirely
around **one** channel's behaviour. A second live channel introduces failure signatures the skill
has no verdict for and will misclassify:
- A text-channel halt the binary channel's `vice_diagnose` bracket cannot see reads as **exactly
  the `wedged` signature** — "two consecutive cycle brackets read exactly 0" — because the machine
  genuinely isn't advancing, for a reason (a different channel is holding it) that is not the
  reason `wedged` exists to describe. Following the skill's own prescribed remedy, `vice_recycle`,
  would kill an instance that is not wedged at all — the exact class of destructive misdiagnosis
  the skill was built to prevent for `monitor_held_elsewhere` and `checkpoint_trap`, just via a
  route the skill's verdict enum does not cover.
- Conversely, a text-channel session left open by a stalled tool call would be this project's
  *own* new instance of "monitor held elsewhere" — but on a **second port** the skill's current
  single-slot mental model (one binary-monitor socket, one holder) does not name at all.

**Why it happens:**
The skill's evidence hierarchy (epoch check → checkpoint-trap check → cycle bracket) was built and
tested against a single-channel world and is silent about a second channel's existence by
construction, not by omission — it predates this milestone.

**How to avoid:**
- Do not extend `vice_diagnose`'s verdict set by guessing. Before adding a verdict, reproduce the
  specific failure signature live (mirroring how every existing verdict in the skill's provenance
  table is graded HIGH only after a live reproduction) and confirm it is *distinguishable* from
  `wedged` by some cheap, ordered check — the same design principle the skill already follows
  (cheapest check first, epoch before checkpoint before cycle bracket).
  This is a strong reason to prevent Pitfall 3's uncertainty from leaking into this skill's
  responses: `vice_diagnose` should not report `wedged` while a text-channel hold is a
  cheaper-to-check, more likely explanation, on the same principle that already routes
  `monitor_held_elsewhere` ahead of `wedged` for the binary channel.
- Add the second channel's hold state to the skill's evidence table (`evidence.jamObserved`-style
  additive field) rather than inventing a sixth verdict casually — the skill explicitly designed
  `jamObserved` as an orthogonal evidence field for exactly this "cuts across existing verdicts"
  reason, and a second-channel-hold signal is structurally the same shape of fact.
- Update the skill's own troubleshooting table with the new symptom **before** shipping the
  channel, not as a follow-up — a stale wedge-triage playbook actively encourages exactly the
  wrong remedy (recycle) for a genuinely healthy, merely-contended instance.

**Warning signs:**
Any `vice_recycle` call whose "reason" incident record, read after the fact, actually describes a
second channel holding the instance rather than a genuine hang; a live run where the text channel
was left connected (e.g. a crashed skill script's socket not closed) and the *binary* side then
reports `wedged`.

**Phase to address:**
The phase that claims the text-monitor channel as a second client, in the same pass that resolves
Pitfall 3 — the wedge-triage skill update should ship in the same phase, not a later one, since an
un-updated skill is actively dangerous the moment the second channel exists at all.

---

### Pitfall 6: The text server's single-client limit is UNVERIFIED — and if it holds, it inherits the exact same silent-hang signature the binary monitor already has

**What goes wrong (if true — not yet established):**
`CLAUDE.md` already documents, for the **binary** monitor: "services exactly one client. A second
`connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a
wedge." The live probe never tested whether `MonitorServer` (`monitor_network.c`, the text side)
has the same limit. If it does, then a second text-channel `connect()` — from a hand-run `nc`
session left open, a second Claude Code session, or a crashed-and-relaunched skill script that
never closed its old socket — produces the identical accepted-but-unserviced-forever signature the
binary side already has a named, tested verdict for (`monitor_held_elsewhere`). The text side
currently has **no** such verdict, because nothing has ever dialed it.

**Why it happens:**
This is explicitly called out as unresolved in `.planning/notes/text-monitor-channel-live-probe.md`
§"Not probed" is silent specifically on this question (it addresses interleaving, not the
single-client limit); the limit itself was never tested for the text side at all, on any VICE
version.

**How to avoid:**
- Test it directly and early: open two text-channel TCP connections to the same running instance
  and observe whether the second gets a reply, an EOF, or silence — the same experiment structure
  already used (and already trusted, live-proven) for the binary side per the wedge-triage skill's
  provenance table.
- If confirmed single-client, add the discriminator immediately — a socket that *accepts* but never
  answers is contention, not a hang — to whatever this project's controller uses to decide "is the
  text channel free," rather than inferring it later from a live incident the way the binary
  monitor's own limit was originally discovered operationally rather than up front.
- If NOT single-client (i.e. the text server tolerates multiple simultaneous connections), that
  changes Pitfall 3's shape entirely — a stray hand-run `nc` session against the text port becomes
  a plausible, unattributable source of the very halt/resume interleaving Pitfall 3 worries about,
  and needs its own detection (e.g. this project reserving the text port exclusively via the
  broker, the same way it already reserves the binary port).

**Warning signs:**
Any design document or plan that assumes text-channel connection semantics from the binary
channel's documented behaviour without a citation to an actual live test of the text server
specifically.

**Phase to address:**
The phase that claims the text-monitor channel as a second client (same phase as Pitfall 3 — this
is a sibling unverified fact from the same live-probe gap, and should be closed by the same
experiment pass).

---

### Pitfall 7: The evidence layer's soundness asymmetry is easy to violate quietly, at any of several layers

**What goes wrong:**
The design's one load-bearing axiom, already stated in the seed document
(`runtime-evidence-layer.md`): an address observed executing **is** code; an address never touched
proves **nothing** — a single run can license `code` and can never license `data`. This is
violated not by one obvious bug but by several small, independently-plausible implementation
choices, each of which reads as reasonable in isolation:
- **Defaulting an unobserved address to `data`.** Any code path that initializes a per-address
  evidence value to `data` (rather than a true third state, "no evidence") and only overwrites it
  on observed execution has silently promoted absence-of-evidence into evidence-of-absence.
- **Reading a union across N runs as exhaustive.** "Twelve scenarios never reached `$9C00`" is a
  real, strengthening fact — but only as a *count of runs tried*, never as "therefore data." A
  query or report that drops the run count and prints only the negative conclusion has quietly
  promoted a union into an exhaustive proof it isn't.
- **A percentage implying a denominator the query doesn't actually have.** "62% of this range
  executed" invites the reader to assume the other 38% is proven non-code, when the only sound
  reading is "38% has no execution evidence yet, from the runs attempted." This project has
  already built one coverage percentage before (`COV-01`/`COV-02`, byte-derived) — a real risk is
  the new execution-based percentage being rendered in the **same UI surface or the same field
  name** as that older, differently-grounded percentage, inviting a reader (or a future skill) to
  average or compare the two as if they measured the same thing.
- **A UI or query rendering "no evidence" as "data."** Any table, CLI verb, or MCP tool response
  that has exactly two visible states for a range (shown as "code" / "data", or as a boolean) has
  nowhere to put "not observed" and will render it as one of the two — almost certainly the
  negative one, since "code" reads as the affirmative claim needing justification.

**Why it happens:**
Three-valued logic (`code | data | undefined`, already the deliberate design of `block-class.ts`
per the seed doc) is easy to specify and easy to erode under normal engineering pressure toward
two-valued booleans, non-null defaults, and single summary percentages — none of which look wrong
in a code review that isn't specifically checking for this asymmetry.

**How to avoid:**
- Make "no evidence" a value that **must be explicitly handled**, not a default any type system or
  database schema falls back to silently — e.g. a nullable/absent row rather than a data row with
  a low-confidence flag, so a consumer that forgets to check for absence gets an error or an
  obviously-missing field, not a plausible-looking wrong answer.
- Every reported percentage or count must carry its denominator's provenance in the same output —
  which runs, how many — not just the number, mirroring how this project already required
  `COV-01`/`COV-02`'s coverage numbers to be "defended... against a vacuous pass" rather than
  presented bare.
- The join query between the evidence layer and the block table must have **three** output states
  per range — agree-code, agree-data-or-unclassified, and disagree — never a two-state
  overwrite, per the design decision already recorded in the seed doc ("Rejected: promoting
  observed-EXEC into the block table... it collapses two independent classifiers into one").
  Test that the disagreement state is reachable and rendered distinctly, with a planted case.
- Keep the execution-coverage percentage and the byte-derived coverage percentage in
  **differently-named fields**, ideally in different top-level report sections, specifically to
  prevent a future consumer from silently treating them as the same measurement.

**Warning signs:**
Any schema or type for a per-address evidence row that has no way to represent "absent" distinct
from `data`; a percentage rendered without its run-count denominator visible in the same call's
output; a query or CLI verb whose output has only two possible values for classification.

**Phase to address:**
The phase that builds the runtime-evidence table and its join query against the block table.

---

### Pitfall 8: `memmapzap` bracket validity races against anything else touching the map

**What goes wrong:**
A `memmapzap` → run → `memmapshow` bracket is only a valid "what did *this* run touch" measurement
if nothing else zapped or read-and-reset the map in between. The map is **global emulator state**,
not scoped to a caller or a run identity this project invents client-side. Two concrete ways this
breaks: (a) if the text channel is not exclusively reserved for this project's own bracketing
calls (see Pitfall 6) — a stray connection issuing its own `memmapzap` mid-bracket silently voids
the measurement with no error surfaced anywhere, since VICE has no concept of "whose bracket this
is"; (b) if the broker's warm-floor pool or crash-supervision relaunches or hands off the instance
mid-bracket (a live concern for *any* long-running bracket, per this project's existing broker
lifecycle), the zap-to-show pairing silently spans two different emulator processes, and the
"observed execution" is partly or wholly from before the relaunch.

**Why it happens:**
The bracket's validity is an invariant this project's own client code must enforce entirely by
discipline — VICE gives no acknowledgment, generation counter, or ownership token on `memmapzap`
that would let a reader detect "someone else zapped this since I did."

**How to avoid:**
- Treat a `memmapzap`→run→`memmapshow` bracket as requiring the **same exclusive-hold guarantee**
  this project's broker already gives an emulator lease (`vice-broker-client.ts`'s "the connection
  itself IS the lease") — extend that same ownership model to cover the memmap bracket window, not
  just the socket connection.
  its own epoch to a captured evidence record, and refuse to accept a bracket whose epoch changed
  mid-flight — mirroring `MachineRestartedError`'s existing epoch-drift detection for exactly this
  class of "state moved out from under me" problem.
- Do not allow this project's own concurrent tooling to zap the map — reserve `memmapzap` as a
  single-caller operation gated the same way `broker-launch.mts`'s single-owner `inFlight` guard
  gates launches, since two evidence-gathering calls racing each other on the same map is a
  self-inflicted version of this same bug.

**Warning signs:**
Two evidence-capture calls issued close together in time against the same instance; a broker
relaunch or recycle logged between a bracket's start and its read; a captured evidence record with
no epoch or generation field to detect either.

**Phase to address:**
The phase that builds the runtime-evidence layer's capture path (the bracketing logic
specifically), informed by whatever the text-channel-claiming phase establishes about exclusivity.

---

### Pitfall 9: Instrumentation cost may collide with the frame-exact reproducibility protocol this project just shipped — UNVERIFIED, must be measured before trusted

**What goes wrong (if true — not yet established):**
v0.8.0 shipped a frame-exact stop with two runs of the same release proven to stop in the same
frame and capture byte-identically, exact through anchor hit 50 (`REPRO-01..05`). VICE's own manual
warns that memmap/cpuhistory tracking "might decrease performance notably on slower hardware" —
but that warning is about **wall-clock throughput**, and this milestone's evidence layer needs
memmap/`prof`/`chis` tracking active *during* the very runs whose frame-exactness is the load-
bearing property. Two distinct risks, not one:
1. If enabling memmap/cpuhistory tracking changes anything about **instruction-level timing**
   (not just host wall-clock speed) — even by one extra internal bookkeeping cycle per opcode —
   it could shift the raster line/cycle position at any given point in the run, corrupting the
   run-equivalence oracle (raster line + raster cycle + 64K comparison) this milestone's evidence
   layer is meant to key its captures against.
2. Even if timing is provably unaffected, the mere act of running with tracking *enabled* changes
   the launch argv/resource set, and this project's own `REPRO-01..05` findings were explicit that
   launch nondeterminism sources had to be pinned one at a time (`-raminitrandomchance 0` was the
   load-bearing one) — an untested new resource is exactly the shape of thing that broke
   reproducibility before.

**Why it happens:**
No source consulted (VICE's own manual, its changelog, or the live probe) states whether
memmap/cpuhistory instrumentation is a side-channel tap on real cycle-accurate execution or
whether it perturbs timing at all — this is a genuine gap in available documentation, not a
question this research can close from outside a live measurement.

**How to avoid:**
- **Do not assume either way.** Before any phase relies on a bracket captured with instrumentation
  on being frame-exact-comparable to a bracket captured without it, run the existing `REPRO`
  anchor-hit sequence twice — once with memmap/`prof`/`chis` tracking enabled from launch, once
  without — and diff at anchor hit 50 exactly the way `REPRO-01..05` already did for its five
  pinned nondeterminism sources. Treat a diff as a real finding requiring a new pinned resource or
  a documented, named limit, not as noise.
- If instrumentation does perturb timing, keep evidence-gathering runs and reproducibility-keyed
  captures in **separate, explicitly labeled categories** — never claim a single run satisfies
  both properties unless the measurement above proves it does.
- Treat this as a **gate**, structurally identical to `GATE-01`'s "derived, not judged" pattern —
  decide the pass/fail rule and the escape hatch (if any) before running the measurement, exactly
  as `GATE-01` committed its rule set before any value was transcribed.

**Warning signs:**
Any plan that captures "the reproducible run" and "the profiled run" as the same artifact without
a stated A/B diff; a frame-exact capture whose launch argv includes `-enable-cpuhistory`-gated
tracking flags with no corresponding control run that omits them.

**Phase to address:**
The phase that wires `memmapshow`/`prof`/`chis` bracketing into the evidence layer — this A/B
measurement should be a stated exit criterion of that phase, not an assumption carried into the
next one.

---

### Pitfall 10: Compile-time feature gating is real, opt-out (not opt-in), and per-command — do not assume one flag covers all four parsers uniformly

**What goes wrong:**
It would be easy to treat "the feature might be absent in a distro build" as a single boolean to
check once. Research into VICE's actual build configuration complicates this in two ways, both
worth getting right before writing capability-detection code:
- The relevant configure flag family is `--disable-cpuhistory` (default **enabled**, defining
  `FEATURE_CPUMEMHISTORY`) — an **opt-out**, not an opt-in. This is the opposite polarity from
  `CLAUDE.md`'s existing `CPUHISTORY_GET` note, which is about a **version floor** (≥ 3.10 for the
  *binary-monitor opcode*), not a compile-time toggle. A build can be VICE ≥ 3.10 and still lack
  the feature if it was explicitly built with `--disable-cpuhistory`; conversely a VICE 3.9 build
  (this host's genuine stock package) already demonstrated `chis` working live over the text
  channel — the capability and the binary-monitor opcode are gated independently, exactly as the
  live probe already flagged for `CLAUDE.md`'s existing wording.
- `mon_profile.c` (the `prof`/`profile` command's implementation) was found to carry **no**
  `#ifdef` compile guard tied to the cpuhistory flag at all in the version inspected — meaning
  `profile`'s availability may not be governed by the same flag as `memmapshow`/`chis`, and an
  implementation that probes once and assumes the answer covers all four commands
  (`memmapshow`/`prof flat`/`chis`/`bt`) could be wrong for whichever ones are actually gated
  differently, or not gated at all, or gated by a *different*, unresearched flag this pass did not
  find.

**Why it happens:**
VICE's own manual describes the compile-time story for these features in the same breath it
describes their runtime syntax, without being explicit about which commands share one flag; the
actual gating is enforced in C source this research did not exhaustively trace across every
compile unit.

**How to avoid:**
- **Probe each of the four commands independently** at connection time — do not infer `prof`'s
  availability from `memmapshow`'s, or `chis`'s from either. This mirrors the project's own
  existing pattern for `CPUHISTORY_GET`'s "three-way answer settled once per binary" — extend that
  same per-capability, per-binary caching discipline to the text-channel command set, rather than
  building one combined flag.
  fully — expect the common case (an ordinary distro package, opt-out defaulted to on) to have all
  four available, exactly as this host's genuine stock 3.9 package already demonstrated live, and
  treat an actual failure to invoke any one of them as the trigger to determine what that specific
  build's response looks like, rather than guessing the response shape up front.

**Warning signs:**
A single "supportsCpuHistory: boolean" capability flag gating access to all four parsers; a design
document that cites `CLAUDE.md`'s existing `CPUHISTORY_GET` ≥ 3.10 note as if it settles the
text-channel commands' availability too (it settles a different, binary-monitor-only fact).

**Phase to address:**
The phase that builds the text-monitor client and its capability-detection layer, before the
parsers are trusted to be reachable.

---

### Pitfall 11: PATH shadowing is a whole-toolset risk, not just an `x64sc` risk

**What goes wrong:**
This project's own operating memory already records that the fork build shadows genuine
`/usr/bin/x64sc` earlier on `PATH`, and that tests "verifying against stock" have silently hit the
fork before. The same shadowing risk applies identically to `c1541`, `petcat`, and `cartconv` —
each is a **separate binary**, each can independently be shadowed by a different VICE
distribution's install (a Homebrew VICE, a locally-built fork checkout, or a second distro
package), and each shadow is invisible unless the resolved path is checked and logged. Because
these three tools are reached over the `host_tool` control op rather than the emulator connection,
none of the existing epoch/version-detection machinery built for `x64sc` (backend detection,
capability registry) applies to them at all — this is genuinely new surface, not an existing
mitigation extended.

**Why it happens:**
The whole VICE distribution ships as one tarball/package, so it is natural to assume "the same
VICE" is being used consistently across `x64sc`, `c1541`, `petcat`, and `cartconv` — but nothing in
this project's `host_tool` mechanism resolves or pins them as a set; each is resolved independently
by whatever the OS's `PATH` says at invocation time.

**How to avoid:**
- Resolve and **log the absolute path plus a version-string probe** (`c1541 --help` / `petcat -help`
  / `cartconv -help` or equivalent) for each of the three tools at first use, the same way
  `stock-vice-parity.md`'s `--help` discriminator already confirmed backend identity for `x64sc`.
- Add each to the `HOST_TOOL_PATH_ARG_KEYS`-style census this project already runs for the
  existing six host tools (`acme`, `dxa`, `analyzeHeadless`, etc.) — extending the existing seam,
  per `ENGINEERING_RULES.md`'s "prefer extending an existing stable seam," rather than writing a
  parallel resolution mechanism for just these three.
- Do not assume version parity with whichever `x64sc` the broker launched — treat "which VICE
  produced this disk image comparison" as a fact worth recording per call, not an invariant.

**Warning signs:**
A test or live comparison between "what the loader reads" and "what the disk claims" that never
logs which `c1541`/`petcat`/`cartconv` binary and version actually ran; two runs on the same
machine producing different results for the same disk image with no version difference logged to
explain it.

**Phase to address:**
The phase that wires `c1541`/`petcat`/`cartconv` onto the `host_tool` control op.

---

### Pitfall 12: Destructive host-tool writes need the same pre-write evidence discipline this project already uses for emulator kills

**What goes wrong:**
`c1541`'s `bpoke`/`bwrite` (and equivalent disk-image-mutating operations) write **in place** to a
disk image file with no built-in undo — unlike VICE's own snapshot/revert machinery, or this
project's own `.annostore` revert capability (`STORE-04`), a `.d64` mutated by `bwrite` cannot be
reverted by this project's tooling once written, only by whatever backup discipline the calling
code enforces itself. Because these tools are reached over the generic `host_tool` control op, it
is easy for a skill script to compose a destructive call exactly as easily as a read-only one — the
op has no built-in concept of "this argv is destructive, capture evidence first."

**Why it happens:**
The `host_tool` seam was built to route diverse host binaries through one typed control op; that
seam's job is dispatch, not knowing that a specific tool's specific verb is destructive. Nothing
currently in this project distinguishes `c1541 -read` from `c1541 -write`/`bpoke`/`bwrite` at the
seam level.

**How to avoid:**
- Apply the same pattern this project already proved for emulator recycling — write an
  incident/evidence record **before** any destructive action, not after — to any `host_tool` call
  whose argv is recognized as a disk-image-mutating verb. This is extending an existing pattern
  (`incident-record.ts`'s "written before any destructive action" invariant), not inventing a new
  one.
- Maintain an explicit, small, named list of destructive verbs per host tool (mirroring the
  existing `DENY_LIST` pattern of "one array, checked at every dispatch seam") rather than trying
  to infer destructiveness from argv shape at call time.
- Require a backup-or-copy of the target disk image before any first destructive write in a
  session, and surface that backup path in the response, so a caller (human or agent) can always
  answer "what did this look like before."

**Warning signs:**
A `host_tool` call with `bpoke`/`bwrite` (or a disk-image-mutating `c1541` verb) in its argv with
no preceding backup or incident record in the same call chain; a skill script that composes disk
writes without ever reading the pre-write bytes first.

**Phase to address:**
The phase that wires `c1541`/`petcat`/`cartconv` onto the `host_tool` control op.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Parsing only the columns exercised by the one captured fixture, rather than the full documented command grammar | Ships the phase faster | Breaks silently on the next VICE version or the next real capture that hits an unexercised branch (e.g. a `memmapshow` access class this project's fixture never triggered) | Never for the four production parsers; acceptable only for a throwaway exploratory script clearly marked as such |
| Skipping the per-command capability probe (Pitfall 10) and hardcoding "assume present" | One fewer round-trip per session | A future build with `--disable-cpuhistory`, or a command this pass mis-assumed shares that flag, fails in a way nothing was designed to explain | Never — the probe is cheap (one command, one reply) and this project already pays this cost pattern for `CPUHISTORY_GET` |
| Treating a `memmapzap`→run→`memmapshow` bracket as atomic without an epoch/generation check (Pitfall 8) | Simpler bracket code | An unnoticed relaunch or contending caller silently corrupts a "run's" evidence with no error | Acceptable only in a single-process, single-caller exploratory script never exposed as a tool |
| Adding a sixth `vice_diagnose` verdict for two-channel contention without a live-reproduced signature first | Ships a plausible-looking verdict quickly | An unverified verdict is exactly the "permanently-green test is not evidence" trap `ENGINEERING_RULES.md` §6 already names — a wrong verdict here actively causes a destructive recycle | Never |
| Rendering the execution-based coverage percentage in the same field/section as the existing byte-derived coverage percentage | Less UI work | Invites averaging or comparing two differently-grounded numbers as if equivalent (Pitfall 7) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Text-monitor TCP channel | Assuming it needs no framing logic because the binary monitor already has one | Build dedicated end-of-output detection (Pitfall 2); do not reuse the binary monitor's length-prefixed demux, it does not apply |
| `c1541` | Trusting whichever `c1541` resolves off `PATH` matches the `x64sc` the broker launched | Resolve and log path + version independently per call (Pitfall 11) |
| `petcat` | Relying on petcat's dialect auto-detection for PET/CBM-ASCII vs C64 charset when converting a BASIC listing | Pass an explicit dialect flag; verify a sample of the output against known tokens rather than trusting a silent guess |
| `cartconv` | Trusting a zero exit code as proof the output cartridge image is the right size for its declared type | Check the emitted file's byte length against the expected size table for the requested cartridge type before treating the conversion as successful |
| `memmapshow`/`prof`/`chis` capability detection | One combined "supports history features" flag | Independent per-command probe and cache (Pitfall 10) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Leaving memmap/cpuhistory tracking enabled on every warm-pool instance by default | Bulk/batch evidence-gathering runs across many scenarios run measurably slower than untracked runs (VICE's own manual: "might decrease performance notably on slower hardware") | Gate tracking behind an explicit per-launch flag, only on for instances actually running an evidence-capture bracket; keep the warm floor's default instances untracked | At scale — many scenarios run in sequence across a corpus, not a single one-off capture |
| Treating `prof flat N`'s cost as free because it "only" reports, not tracks | `profile on` must run continuously across the bracket to have anything to report at `profile flat`; the cost is incurred by `on`, not by the report call | Budget the tracking window (bracket length), not the report call, when estimating cost | Any bracket long enough that the tracked instrumentation window dominates wall-clock time |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `c1541`'s destructive verbs (`bpoke`/`bwrite`/write-mode operations) through `host_tool` with the same trust level as read-only verbs | An LLM-composed call silently overwrites a disk image with no recovery path | Explicit destructive-verb list plus mandatory pre-write backup/incident record (Pitfall 12), mirroring the existing `DENY_LIST` pattern for VICE resources that power-cycle the machine |
| Letting a text-channel session stay open across tool calls with no owner tracking | A stray held text-channel session becomes an unattributable second-client contention source (Pitfall 6) that a future debugging session cannot trace back to its origin | Track and log the holder identity for the text channel exactly as the broker already does for the binary monitor's lease |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| A query surface that shows "no execution evidence" identically to "classified as data" | A user (or a downstream skill) reads a genuinely-unobserved address as proven non-code and skips it, when it may be exactly the level-3 code a deeper run would reveal | Render three distinct states everywhere the evidence layer surfaces a verdict, with the "no evidence yet" state visually and structurally distinct from "data" (Pitfall 7) |
| A coverage percentage shown with no run count | Reads as more authoritative than it is — invites treating a partial union as exhaustive | Always co-render the denominator's provenance (how many runs, which scenarios) next to any percentage |
| `vice_diagnose` reporting `wedged` when the real cause is a second-channel hold | User (or agent) recycles a healthy instance, destroying an in-flight run, exactly the failure the skill exists to prevent | Add the second-channel-hold evidence field before shipping the second channel (Pitfall 5) |

## "Looks Done But Isn't" Checklist

- [ ] **Text-monitor parsers:** Often tested against only one captured fixture set from one
  binary — verify each parser has been re-run against a *second* real VICE binary (a different
  minor version) before trusting it as version-general.
- [ ] **Dual-channel design:** Often "works" because it was only tested with commands issued
  strictly sequentially, never with an overlapping halt/resume window — verify with a test that
  deliberately interleaves a text-channel command mid-way through an outstanding binary-channel
  halt (Pitfall 3), and vice versa.
- [ ] **Evidence-layer coverage reporting:** Often ships with a percentage that "looks right" on
  the one fixture it was built against — verify the denominator (run count, scenario identity) is
  present in the same output, not just the number.
- [ ] **`memmapzap` bracketing:** Often "just works" in a single-session, single-caller dev
  environment — verify it survives a broker relaunch or a second concurrent caller mid-bracket
  without silently returning a corrupted result (Pitfall 8).
- [ ] **Frame-exact reproducibility + instrumentation:** Often assumed unaffected because "it's
  just a read-side tap" — verify with an actual A/B diff at the existing anchor-hit sequence
  before any evidence-layer capture is trusted as frame-exact-comparable (Pitfall 9).
- [ ] **`c1541`/`petcat`/`cartconv` version identity:** Often assumed to match the `x64sc` in use
  because "it's the same VICE install" — verify the resolved path and version are actually logged
  per call, not assumed.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| A parser silently mis-renders a semantic drift (Pitfall 1) | MEDIUM | Re-capture fixtures against the actual installed binary, add the missed enum value or column-width case, and re-run any evidence already stored through the corrected parser to detect silently-wrong prior results |
| A bracket corrupted by a concurrent zap or relaunch (Pitfall 8) | LOW, if detected | Discard the bracket's evidence row (never silently overwrite the block table anyway, per the design), re-run with an epoch/generation check added |
| A destructive `host_tool` write with no prior backup (Pitfall 12) | HIGH, possibly unrecoverable | If a backup exists elsewhere (e.g. the original release archive this disk image was extracted from), re-extract; otherwise the mutation is permanent — this is exactly why the prevention step is mandatory, not optional |
| A wedge-triage misdiagnosis destroys a genuinely-healthy instance (Pitfall 5) | MEDIUM | Same as any recycle: the run is void, resume from the last recorded milestone snapshot — but also file the misdiagnosis as a defect against the skill's verdict set, since recovery here should also fix the root cause per `ENGINEERING_RULES.md` §19 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| 1. Format drift is semantic, not syntactic | Text-monitor parser phase | Fixtures re-captured against ≥ 2 real VICE binaries; parser fails loudly on an unrecognized enum value in a planted-fixture test |
| 2. No frame delimiter in the text protocol | Text-monitor client phase | A planted test that splits a prompt string across two writes, and a command whose output is crafted to contain prompt-shaped text |
| 3. Interleaved halt/resume across channels (UNVERIFIED) | Text-monitor channel-claiming phase | The named live experiment run and its result recorded, before any dual-channel controller design is finalized |
| 4. `default_memspace`/checkpoint races across channels | Channel-claiming phase (invariant); evidence-layer bracketing phase (specific interaction) | An explicit test asserting identical checkpoint-state visibility from both channels |
| 5. Wedge-triage misdiagnosis of two-channel contention | Channel-claiming phase, same pass as its skill update | `vice_diagnose`'s evidence table extended and live-reproduced for the new signature before ship |
| 6. Text server single-client limit (UNVERIFIED) | Channel-claiming phase | Two-connection live test against the text port, result recorded either way |
| 7. Soundness-asymmetry violations in the evidence layer | Runtime-evidence-table phase | Schema/type review confirms a true three-state representation; planted test proves the disagreement state is reachable and distinctly rendered |
| 8. `memmapzap` bracket races | Evidence-layer capture-path phase | Epoch/generation check present and tested against a planted concurrent-zap or relaunch scenario |
| 9. Instrumentation vs frame-exact reproducibility (UNVERIFIED) | Evidence-layer bracketing phase | A/B diff at the existing anchor-hit sequence, instrumentation on vs off, recorded as a stated exit criterion |
| 10. Compile-time feature gating, per-command | Text-monitor client phase | Independent capability probe per command, cached per binary, exercised against this host's genuine stock 3.9 |
| 11. PATH shadowing across the whole VICE toolset | `host_tool` wiring phase for `c1541`/`petcat`/`cartconv` | Path + version logged and asserted per call in a live test |
| 12. Destructive host-tool writes need pre-write evidence | Same `host_tool` wiring phase | A planted destructive-verb test proves a backup/incident record is written before the mutating call executes |

## Sources

- `CLAUDE.md` (this repository) — the normative constraint list; every "extends CLAUDE.md" claim
  above cites the exact bullet it extends.
- `.planning/PROJECT.md` — Validated/Active requirement history, especially `REPRO-01..05`,
  `CAP-01..04`, `COV-01`/`COV-02`, `STORE-04`, and the v0.9.0 Active-hypotheses section this
  research question was scoped against.
- `.planning/notes/text-monitor-channel-live-probe.md` — the only live-measured evidence this
  project has for text-channel behaviour; source of the halt-semantics finding and the explicit
  "not probed" interleaving gap.
- `.planning/seeds/runtime-evidence-layer.md` — the soundness-asymmetry design constraint and its
  "chosen shape" decision record.
- `.planning/ENGINEERING_RULES.md` — §6 (non-vacuous verification), §7 (independent oracle rule),
  §14 (broker/process safety) underpin several prevention strategies above.
- `src/skills/vice-wedge-triage/SKILL.md` — the existing verdict vocabulary Pitfall 5 concerns.
- VICE Manual, §12 Monitor (`https://vice-emu.sourceforge.io/vice_12.html`) — `profile`/`memmap`/
  `cpuhistory`/`backtrace`/`io` command syntax and the stated performance warning (MEDIUM
  confidence — official documentation, not independently re-verified against this repo's exact
  installed binary beyond what the live probe already covered).
- VICE `NEWS` changelog (`https://vice-emu.sourceforge.io/NEWS`) — concrete, dated instances of
  monitor output format drift: the 3.4 `mc`/`ms` bit-meaning inversion, the 3.0 `chis` column-width
  change, the 3.5 `memmapshow` new-access-class extension, and the 3.5/3.6 terminal-width-dependent
  wrapping/truncation fixes (MEDIUM confidence — official project changelog, read via automated
  summarization rather than the raw file; the specific quoted phrases should be re-confirmed
  against the raw `NEWS` file before being cited as exact quotes in any shipped documentation).
- VICE `configure.ac` (`VICE-Team/svn-mirror`) — confirms `--disable-cpuhistory` is opt-out
  (default enabled), defining `FEATURE_CPUMEMHISTORY` (MEDIUM confidence — read via automated
  summarization of the live file; the exact macro name and default polarity should be spot-checked
  against the raw file before being load-bearing in an implementation).
- `mon_profile.c` (`VICE-Team/svn-mirror`) — inspected for compile guards tied to the cpuhistory
  flag; none found in the version inspected (LOW-MEDIUM confidence — absence-of-evidence from an
  automated single-file read is weak evidence of actual absence; treat as a reason to probe
  empirically per Pitfall 10, not as a settled fact).

---
*Pitfalls research for: c64-re-tools v0.9.0 — The Text Channel and the Runtime Evidence Layer*
*Researched: 2026-09-06*
