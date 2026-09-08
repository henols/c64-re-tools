# Requirements: c64-re-tools

**Milestone:** v0.9.0 — The Text Channel and the Runtime Evidence Layer
**Defined:** 2026-09-06
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture
RAM, inspect chip state — and keep working when the emulator misbehaves.

**Inputs to this scoping.** Four parallel research dimensions
(`research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`) and their
synthesis (`research/SUMMARY.md`), plus two seeds selected at the milestone open
— [`seeds/runtime-evidence-layer.md`](seeds/runtime-evidence-layer.md), whose
design is *decided* with two alternatives already rejected on the record, and
[`seeds/host-tool-executor.md`](seeds/host-tool-executor.md), whose seam shipped
in v0.8.0 — and the live-probe note
[`notes/text-monitor-channel-live-probe.md`](notes/text-monitor-channel-live-probe.md),
which is measured output from genuine stock VICE 3.9 rather than manual claims.

**Measured / unverified discipline.** This document marks each load-bearing
claim **MEASURED** or **UNVERIFIED**. The two are different kinds of fact and are
never blended. Three UNVERIFIED items are *blocking* and each has a requirement
whose whole job is to settle it.

---

## v0.9.0 Requirements

### Channel — claiming the text monitor

- [x] **CHAN-01**: A pre-committed go / degrade / no-go gate answers, from live measurement against genuine stock VICE, whether a text-monitor client and a binary-monitor client can drive the same emulator without corrupting each other — covering at minimum idle coexistence, whether one channel's halt is visible to the other, concurrent in-flight commands, cross-channel resume, and recovery from an abrupt disconnect. The gate's rules and its pass/fail rule are committed **before** any measurement is taken, and the verdict selects which serialization shape is built rather than confirming one already chosen. *(Settles the milestone's two blocking UNVERIFIED items: interleaved halt/resume behaviour, and whether VICE's text-monitor server enforces the same single-client limit the binary monitor does.)*
- [ ] **CHAN-02**: A container-side caller can learn the text-monitor port of the instance it holds. *(Today it cannot: `remoteMonitorPort` is recorded host-side in the instance record but is never surfaced through the broker's acquire/status responses to the container — a plumbing gap MEASURED as zero grep hits, independent of any design choice, and nothing can dial the port until it closes.)*
- [ ] **CHAN-03**: A user's tool call can reach VICE's text monitor over the `-remotemonitor` channel the broker has appended to every stock launch since Phase 3 and that nothing has ever dialed, with responses framed reliably rather than by guesswork. *(The `(C:$xxxx) ` prompt is MEASURED as a dependable terminator on both builds on this host; framing must still survive the prompt arriving split across TCP segments, and must not mistake the prompt appearing inside data for the end of a response.)*
- [ ] **CHAN-04**: The two channels cannot corrupt each other in normal use, because every halt-taking operation on either channel passes through a single serialization authority whose shape is the one `CHAN-01` selected. The existing binary-side invariants — exactly one resume per wait, and polling on `hit_count` rather than on paused state — continue to hold unchanged. *(The text monitor halts the machine on command exactly as the binary one does — MEASURED: the stopwatch counter advanced only across an `x`. This is a second channel needing the same discipline, not a free side-channel.)*
- [ ] **CHAN-05**: When the emulator is merely contended between the two channels, a user is told that — not told it is wedged, and not silently recycled. `vice_diagnose` gains the evidence needed to tell contention from a genuine wedge, and the `vice-wedge-triage` playbook gains the verdict, both shipping alongside the text-channel code rather than after it. *(A regression this milestone would otherwise introduce into a shipped skill: its verdict set has no entry for two-channel contention, so it would reach `wedged` and recommend a destructive recycle of a healthy instance.)*

### Parsers — the text formats, behind one seam each

- [ ] **PARSE-01**: `memmapshow` output is parsed into a per-address access map that preserves **execute as its own bit** for both RAM and ROM, so a code-vs-data answer derived from real execution is available to the rest of the system as structured data rather than text.
- [ ] **PARSE-02**: `prof flat`, `chis`, `bt` and `io` output is parsed into structured results — ranked self/total cycles per address; CPU history entries carrying their per-entry cycle counts; the reconstructed JSR chain; and the semantically decoded register view. *(`chis` returning per-entry cycle counts on **3.9** is MEASURED, and matters: the *capability* is not gated on VICE ≥ 3.10 — only the binary `CPUHISTORY_GET` opcode is.)*
- [ ] **PARSE-03**: Each text format has exactly one owning module, with fixtures captured from **at least two real VICE binaries** and pinned to the exact binary they came from, carrying the same provenance discipline the existing binary-monitor fixtures already require. Nothing outside the owning module reads the raw text. *(Format drift across VICE releases is MEASURED as real and **semantic rather than syntactic** — 3.4 inverted the meaning of `mc`/`ms`'s glyphs with no syntax change to signal it, 3.0 widened `chis`'s cycle column, 3.5 added a `memmapshow` access class. A fixture-only defence would have kept passing while returning inverted answers, so an unrecognised value must fail loudly rather than be absorbed.)*
- [ ] **PARSE-04**: When the connected VICE was built without the tracing or profiling support a command needs, the user is told which capability is missing and on which binary — never handed a silent empty result or a parse error. Each affected command is probed on its own rather than gated behind one assumed build flag. *(MEASURED: this support is opt-**out** at build time — the opposite polarity to the existing ≥ 3.10 opcode note — and the commands do not share a single guard.)*

### Evidence — observed execution as its own accumulating fact

- [ ] **EVID-01**: What the emulator observed is stored as its own durable, accumulating rows in `.annostore`, **keyed by run identity**, so a later session queries the evidence instead of re-running the program. Run identity reuses the capture identity v0.8.0 already established rather than minting a second notion of "the same run".
- [ ] **EVID-02**: Adding the evidence table to an existing `.annostore` has a decided, recorded outcome for stores that already exist in the field — either a migration arm, or a deliberate re-affirmation of the current strict-equality refusal — reached from a factual check of whether such stores exist, and never defaulted into silently. *(The existing schema-version mechanism refuses on mismatch rather than migrating; the justification recorded for the last bump — "no store file exists yet" — is very likely stale after two milestones of real store use.)*
- [ ] **EVID-03**: A user can ask where the byte-derived block classification and the observed-execution evidence **disagree**, and get the disagreements first. The block table stays byte-derived and is never silently overwritten by an observation; agreement is reported as a count rather than as a wall of rows. *(Disagreement — bytes say data, execution says code — is the highest-value output of the whole design, and the two classifiers' independence is the asset that produces it.)*
- [ ] **EVID-04**: The evidence layer cannot state, imply, or render that an address is `data` on the strength of never having been observed executing. An address observed executing **is** code; an address never touched proves nothing, and a union across runs — however many — never becomes exhaustive. Any percentage or summary carries the denominator it is a fraction of. *(The soundness asymmetry is a design constraint of the whole layer, not a caveat on it. Several individually-plausible implementation choices violate it quietly, so this is stated as a requirement rather than left to care.)*
- [ ] **EVID-05**: Evidence gathered from a run states which bracket it belongs to, and a bracket can be reset and re-measured without a previous run's observations leaking into it.
- [ ] **EVID-06**: Before any evidence is trusted as comparable across runs, a measurement establishes whether turning the instrumentation on perturbs the frame-exact reproducibility v0.8.0 shipped — A/B at the existing anchor sequence, with the pass/fail rule fixed before the measurement is taken. If it does perturb it, instrumented and frame-exact runs are separated and labelled as such rather than quietly conflated. *(UNVERIFIED and blocking: the evidence layer keys rows by a reproducibility that instrumenting the run may itself destroy. No documentation source answers this; only the A/B does.)*

### Preprocessing — the three VICE host binaries

- [ ] **PREP-01**: A user can inspect a disk image's real structure — BAM, directory, and a named file's actual sector chain — through `c1541`, reached over the existing `host_tool` control op from a container-side skill script. *(The seam shipped in v0.8.0; this is integration, not new architecture.)*
- [ ] **PREP-02**: A user can see what a program's BASIC stub actually does and where it hands over to machine code, via `petcat`, before any disassembler is spent on it — and is told plainly when the stub cannot be resolved rather than given a guessed entry point.
- [ ] **PREP-03**: A cartridge image's bank structure is recovered through `cartconv` and presented as separate per-bank images the existing analysis engines can each consume, rather than as a flat ROM window that hides everything past the first bank.
- [x] **PREP-04**: A failure in any of these three tools is reported as a failure. *(MEASURED: `c1541` and `cartconv` exit **0 on error**; only `petcat` returns non-zero. Exit-code checking alone would pass failures silently, so each tool's own output is what decides the outcome — the same discipline the existing real-ACME verify path already applies.)*

### Proof — closing a named reversal condition

- [ ] **PROOF-04**: `PROOF-01` gains the independent external check it shipped without, using observed execution as the oracle, so its false-positive count becomes computable for the first time rather than structurally uncomputable. *(This closes the reversal condition stated verbatim at the v0.8.0 open — "a binary-monitor-reachable execution oracle, or a decision to open the text channel" — by taking the second branch deliberately. Continues the `PROOF-` numbering from v0.8.0's `PROOF-01..03` rather than opening a new family, because it is the same question.)*

---

## Future Requirements

Deferred. Tracked, not in this roadmap.

### The rebuild half — re-mapped to v1.0.0

- **DECOMP-01..04**, **BUILD-01..06**, **EQUIV-01..04** — text stands unchanged in
  [`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md).
  Re-mapped from v0.9.0 to v1.0.0 on 2026-09-06 because the runtime-evidence
  layer is upstream of it rather than parallel to it: `DECOMP-01`'s code-vs-data
  boundary guessing in `$8000-$BFFF` is precisely what an execution oracle
  answers, and `EQUIV-*`'s measured ceiling is one that `chis` over the text
  channel may lift.

### Carried, unowned

- **`PROOF-03` on real cracked code** — proven in both directions on a synthetic
  two-caller fixture; the `danish.d64` question stays open and stays recorded as
  open. Not taken by v0.9.0.
- **`ANNO-13` / `ANNO-14` / `ANNO-15`** — generated bit-name enums and the symbol
  round trip. Validated, withdrawn by the v0.7.0 removal, still no route and
  still no owner. v0.9.0 does not restore them and was not scoped to; the
  2026-08-26 "no parity is owed" decision stands for a second milestone running.
- **The `mkdtemp` fix for scratch fixtures written inside walked trees** — culprit
  and fix both named, no pass owns it. Eligible for any phase that touches the
  affected trees.

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep, and to stop a later
reader reading an absence as an oversight.

| Feature | Reason |
|---------|--------|
| VICE's text-monitor assembler and disassembler (`a` / `d`) | Owner decision 2026-09-06. Becomes available the moment the channel opens and was declined on the spot. Bulk disassembly already has two owned engines (vendored dxa 0.1.5, Ghidra 12.1.3 under this project's NMOS 6502 SLEIGH language); a third, unowned, text-parsed one would be a fourth classifier nobody asked for. Reverses only on a named consumer. |
| `x64` ↔ `x64sc` mode switching | Owner decision 2026-09-06. Declined as carrying no value here. |
| VICE event record/replay as the run-reproducibility mechanism | **It does not exist.** MEASURED, not assumed — `event.c` carries six event options, none `-record`, and `x64sc -record` exits 255. This was the false premise v0.8.0 opened on and had to correct mid-milestone; it must not re-enter through the exploration document that asserted it. |
| A text channel that runs concurrently with the binary channel *as a design assumption* | The exploration input recommends exactly this. It collides with stock VICE's one-client binary monitor, and whether the text server carries the same limit is UNVERIFIED. `CHAN-01` exists to settle it by measurement; no requirement here presumes the answer. |
| Deleting the three CLAUDE.md constraints the live probe narrowed | Each is literally true as written and each is correctly scoped to the *binary* monitor. They gain a scoping clause; they are not removed. The absent runtime `WarpMode` **resource** remains a real and separate fact from `warp on` being a working monitor **command**. |
| Promoting observed-EXEC into the block table under a confidence bracket | Rejected in the seed on the record, and re-affirmed here. Fewer moving parts, but it collapses two independent classifiers into one, destroys the disagreement signal that is the design's highest-value output, and a wrong promotion is unrecoverable. |
| Live read-only text-monitor tools with nothing persisted | Rejected in the seed on the record. Ships fastest, but each run's evidence dies with the session — the exact gap `CORE-01` already flagged and left as a dated open question. |
| Bank-qualified addressing as a modelled store feature | Carried forward from v0.8.0's exclusions, unchanged. `PREP-03` resolves a cartridge to N independent per-bank images through the existing single-image flow; it does not introduce bank-qualified addresses into the store. |
| Superseding or deleting the hand-written `.d64` parser | `PREP-01` is additive. Whether `c1541` eventually replaces `d64-parse.mjs` is a real question and is deliberately deferred rather than decided as a side effect of adding a tool. |
| The rebuild half (`DECOMP-*`, `BUILD-*`, `EQUIV-*`) | Not excluded — **re-mapped to v1.0.0**. See Future Requirements for the reason, which is sequencing, not doubt. |

---

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHAN-01 | Phase 39 | Complete |
| CHAN-02 | Phase 41 | Pending |
| CHAN-03 | Phase 41 | Pending |
| CHAN-04 | Phase 41 | Pending |
| CHAN-05 | Phase 41 | Pending |
| PARSE-01 | Phase 42 | Pending |
| PARSE-02 | Phase 42 | Pending |
| PARSE-03 | Phase 42 | Pending |
| PARSE-04 | Phase 42 | Pending |
| EVID-01 | Phase 43 | Pending |
| EVID-02 | Phase 43 | Pending |
| EVID-03 | Phase 43 | Pending |
| EVID-04 | Phase 43 | Pending |
| EVID-05 | Phase 43 | Pending |
| EVID-06 | Phase 43 | Pending |
| PREP-01 | Phase 40 | Pending |
| PREP-02 | Phase 40 | Pending |
| PREP-03 | Phase 40 | Pending |
| PREP-04 | Phase 40 | Complete |
| PROOF-04 | Phase 44 | Pending |

**Coverage:**

- v0.9.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

Mapped 2026-09-06 at roadmap creation, and cross-checked **mechanically** against
ROADMAP.md's own per-phase `**Requirements**:` lines rather than by eye: 20 ids
mapped, 20 unique, 0 duplicates, 0 orphans, 0 extras. Phase 39 — `CHAN-01`.
Phase 40 — `PREP-01..04`. Phase 41 — `CHAN-02..05`. Phase 42 — `PARSE-01..04`.
Phase 43 — `EVID-01..06`. Phase 44 — `PROOF-04`.

---

## Notes for the roadmapper

- **`CHAN-01` and `EVID-06` are gates, not features.** This project has a strong
  precedent for pre-committed go / degrade / no-go gates that fire and are
  obeyed (Phase 23 returned `no-go` and cancelled work; Phase 33 returned
  `degrade` and said why). Both belong in phases whose deliverable is *evidence*,
  with rules committed before measurement, and `CHAN-01` must be **first** —
  its verdict selects which serialization shape `CHAN-04` builds, so building
  before it returns is rework by construction.
- **`PREP-01..04` are fully independent** of the probe verdict and of the text
  channel, and can run in parallel with `CHAN-01` from day one.
- **One within-milestone ordering constraint** research surfaced that is easy to
  miss: comparing a file's *claimed* sector chain against the sectors a loader
  *really* reads needs drive-side checkpoints, which need the `default_memspace`
  reset that only `device c:` provides — a capability this same milestone opens.
  So the disk-analysis *runtime correlation* depends on the channel even though
  `PREP-01`'s static half does not.
- **`CHAN-05` must ship with the text-channel code**, not after it. Between the
  two, a shipped skill actively recommends a destructive remedy for a healthy
  instance.
- Two decision records in this set — `EVID-02` and the deferred `.d64`
  supersession question — are **decisions to be reached and recorded**, not
  features to be built. Fold them into phases that touch the relevant code
  rather than giving either its own phase.

---
*Requirements defined: 2026-09-06 at the open of milestone v0.9.0*
