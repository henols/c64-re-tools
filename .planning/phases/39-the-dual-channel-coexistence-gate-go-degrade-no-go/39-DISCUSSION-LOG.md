# Phase 39: The Dual-Channel Coexistence Gate (Go/Degrade/No-Go) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-07
**Phase:** 39-the-dual-channel-coexistence-gate-go-degrade-no-go
**Areas discussed:** Gate inputs & could-not-run, Verdict thresholds, The probe client & launch, Fixture batch scope

The owner selected all four offered gray areas and answered every question. One
answer was given as free text rather than a listed option; it is reproduced
verbatim below.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Gate inputs & could-not-run | How the five experiments + two UNVERIFIED items map onto named gate inputs, and how criterion 1's explicit `could-not-run` decision is settled | ✓ |
| Verdict thresholds | Which measured outcomes force `no-go` versus `degrade`, and which inputs get pre-mapped narrowing | ✓ |
| The probe client & launch | What dials the text port, and how an instance with both channels live is reached given CHAN-02's gap | ✓ |
| Fixture batch scope | Which captures become committed fixtures, where they live, and what loads them | ✓ |

---

## Gate inputs & could-not-run

### Q1 — How many named gate inputs, and how do the five experiments map onto them?

| Option | Description | Selected |
|--------|-------------|----------|
| Seven: 5 + 2 UNVERIFIED (Recommended) | One input per experiment plus the two blocking UNVERIFIED items as their own inputs. Criterion 3 says both must be "settled by measurement and recorded either way" — a gate input is the only recording with teeth. Cost: a larger totality walk than Phase 33's 108 tuples | ✓ |
| Five, UNVERIFIED folded in | UNVERIFIED items answered as non-gating sub-facts inside two of the experiments. Smaller walk; criterion 3 becomes a prose claim | |
| Six — single-client split out only | Five experiment inputs plus `TEXT_SINGLE_CLIENT`, since it is measured by a separate two-connection test | |

**User's choice:** Seven: 5 + 2 UNVERIFIED
**Notes:** Recorded as `D-02`.

### Q2 — How is `could-not-run` settled explicitly?

| Option | Description | Selected |
|--------|-------------|----------|
| Unemittable; not-taken is a value (Recommended) | Verdict domain stays exactly go/degrade/no-go; every input domain carries an explicit `not-taken` member; totality asserted with a terminal antecedent-free rule (Phase 33's R9 shape) | ✓ |
| Named antecedent for could-not-run | `could-not-run` joins the verdict domain with one explicit rule. Cost: re-opens the spelling Phase 33 removed on purpose | |
| Unemittable; not-taken forces no-go | Any untakeable experiment drives `no-go` directly. Cost: an unrelated host limitation cancels the design on evidence that says nothing about coexistence | |

**User's choice:** Unemittable; not-taken is a value
**Notes:** Recorded as `D-03`. Note the interaction settled in `D-09`: the
blanket "not-taken forces no-go" was rejected here, but for `IDLE_COEXIST`
specifically the untakeable case does reach `no-go`, by a separate rule with its
own stated reason. That extension is Claude's, not the owner's, and is flagged
in CONTEXT.md's discretion section as the first thing to re-check.

### Q3 — How is the totality walk discharged over thousands of tuples?

| Option | Description | Selected |
|--------|-------------|----------|
| Executable walk, count in evidence (Recommended) | A committed script enumerates the cross-product, asserts exactly one antecedent per tuple, emits tuple count and per-rule hit histogram as column-0 lines | ✓ |
| Executable walk, and also an automated test | Same script plus a suite assertion. Cost: guards a file nobody may edit after the first measurement | |
| Prose walk over collapsed equivalence classes | Argue totality over a handful of classes. Cost: the collapse is itself an unchecked claim, and is where a gap would hide | |

**User's choice:** Executable walk, count in evidence
**Notes:** Recorded as `D-04`. The script is committed in `39-01`, so the walk predates every measurement.

### Q4 — Where do the rules, schema and evidence conventions live?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Phase 33's layout exactly (Recommended) | `evidence/DECISION-RULE.md` + `SCHEMA.md` + `README.md`; verdict in `docs/phase39-…-findings.md` with the same frontmatter key order | ✓ |
| Mirror, plus a shared conventions doc | Lift README's conventions into a shared docs/ file. Cost: edits a closed phase's evidence tree; turns drift into a conflict | |
| Single combined GATE.md | One file. Cost: lets a rule edit and a name edit hide in one diff | |

**User's choice:** Mirror Phase 33's layout exactly
**Notes:** Recorded as `D-07`. Conventions are copied, not shared.

---

## Verdict thresholds

### Q1 — What does `TEXT_SINGLE_CLIENT: single` produce on its own?

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing on its own (Recommended) | Single-client on the text side constrains the broker but says nothing about text-plus-binary coexistence; bind-time coexistence is already MEASURED, so the limit is per-server | ✓ |
| Forces degrade | The unserviced second connection is indistinguishable from a wedge. Cost: conflates "two text clients" with "text plus binary" | |
| Forces no-go | Treat any single-client limit as proof of incompatibility. Cost: contradicted by the measured bind-time coexistence | |

**User's choice:** Nothing on its own
**Notes:** Recorded as `D-08`. It appears in no antecedent; it is recorded as a fact shaping Phase 41's connection management.

### Q2 — A SIGKILLed text client leaves the machine permanently halted. Verdict?

| Option | Description | Selected |
|--------|-------------|----------|
| degrade, with the fix named (Recommended) | The ROADMAP already states the obligation. A leaked halt with no analogue to the binary side's "connection close IS the release" is a missing mechanism, not proof of incompatibility — and it points at the broker-lease shape | ✓ |
| no-go | A channel that can strand the emulator cannot coexist live. Cost: forecloses the shape a lease would specifically fix | |
| degrade, narrowing at verdict time | Author the narrowing against what the evidence shows. Cost: the ROADMAP explicitly says this should be discovered here | |

**User's choice:** degrade, with the fix named
**Notes:** Recorded as `D-10`, pre-mapped in `39-01`.

### Q3 — Which outcome is the `no-go`?

| Option | Description | Selected |
|--------|-------------|----------|
| Idle coexistence fails (Recommended) | `IDLE_COEXIST: corrupts` — if the channels cannot survive each other doing nothing, no serialization authority helps and only the connect-gate survives. The one input whose failure is unfixable by discipline | ✓ |
| Idle coexistence or cross-channel resume fails | Adds `CROSS_CHANNEL_RESUME: corrupts`. Cost: that is arguably exactly what a serialization authority exists to prevent | |
| Any experiment returning corrupts | Maximally conservative. Cost: makes the three-shape distinction dead text | |

**User's choice:** Idle coexistence fails
**Notes:** Recorded as `D-09`. The `not-taken` arm was reasoned out afterwards and is Claude's extension, flagged for re-check.

### Q4 — Which inputs get pre-mapped degrade narrowing?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-map disconnect + hit_count (Recommended) | The two where a narrowing written after seeing the result would be most suspect — one named by the ROADMAP, one the milestone's other blocking UNVERIFIED item. The other five are plain enumerated values | ✓ |
| Pre-map all seven | Maximum pre-commitment. Cost: Phase 33 deliberately left plain-enumerated inputs unmapped because a blind mapping fits badly and then has to be overridden | |
| Pre-map disconnect only | Cost: the hit_count narrowing is where an after-the-fact author would be most tempted to declare the existing invariant already sufficient | |

**User's choice:** Pre-map disconnect + hit_count
**Notes:** Recorded as `D-11`.

---

## The probe client & launch

### Q1 — How does the probe reach an emulator with both channels live?

| Option | Description | Selected |
|--------|-------------|----------|
| Spawn x64sc directly (Recommended) | `execve` with `-default` first, both ports the probe's own. The broker cannot surface the text port (CHAN-02, MEASURED as zero grep hits) and closing that gap is Phase 41 work. Precedent: 33's determinism-probe.mjs | ✓ |
| Broker acquire, then read the instance record | Reads `remoteMonitorPort` off disk. Cost: a side channel around the gap; the broker must run, which reddens BACK-05 and contaminates every baseline | |
| Close CHAN-02 first, acquire normally | Most realistic. Cost: ships a Phase 41 production module, which this phase's roadmap forbids | |

**User's choice:** Spawn x64sc directly
**Notes:** Recorded as `D-12`, with the direct-spawn route named as a trust boundary in the threat model.

### Q2 — What speaks to the text port, and does anything survive into Phase 41?

| Option | Description | Selected |
|--------|-------------|----------|
| Throwaway probe helper, nothing survives (Recommended) | A small helper in the evidence dir, framing on the prompt crudely and deliberately — CHAN-03 owns reliable framing. What survives is the captured text and the verdict | ✓ |
| Minimal module in src/, Phase 41 extends it | Saves rework. Cost: a shipped client is exactly the thing whose shape the verdict is supposed to select | |
| Throwaway helper, but reuse the binary side | Same helper, but the binary channel driven through shipped stock-protocol.ts encoders | |

**User's choice:** Throwaway probe helper, nothing survives
**Notes:** Recorded as `D-13`. The third option's substance — driving the binary
half through the shipped encoders — was not mutually exclusive and was adopted
separately as `D-14` under Claude's discretion, following Phase 33's
"what it does not retype" precedent.

### Q3 — Does every experiment run on both binaries?

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on stock, capture on both (Recommended) | Seven inputs measured on stock 3.9; the fork run supplies criterion 5's two-binary provenance only | |
| Run all seven on both, gate on the worse | Full matrix, pessimistic per input | |
| Run all seven on both, gate on stock, record fork | Full matrix, stock-only gating | |
| *(free text)* | — | ✓ |

**User's choice (verbatim):** *"Baseline is 3.9 and it doesn't matter if it's a later version"*
**Notes:** Reflected back to the owner during the discussion and not corrected.
Read as: the gate baseline is stock 3.9 at `/usr/bin/x64sc`; VICE version is a
recorded provenance fact, never a gate input; and "3.10" in criterion 5
describes what happens to be on this host rather than pinning the second binary.
Criterion 5's two-binary capture stays, because a discuss-phase decision cannot
delete a roadmap success criterion. Recorded as `D-15`, together with the PATH
hazard (the fork shadows stock on `PATH`, so probes resolve by absolute path).

---

## Fixture batch scope

### Q1 — Which captured text becomes a committed fixture?

| Option | Description | Selected |
|--------|-------------|----------|
| Parseable command outputs only (Recommended) | `memmapshow`, `prof flat`, `chis`, `bt`, `io` and the bare prompt as payload + sidecar; experiment interleavings stay transcripts. A fixture is something a loader loads | ✓ |
| Everything the probe captured | Nothing is lost. Cost: a corpus whose majority has no consumer, and `command` is meaningless for a trace with no single command | |
| Command outputs plus the interleaving traces | Both, second class opaque. Cost: a transcript wearing a fixture's clothes | |

**User's choice:** Parseable command outputs only
**Notes:** Recorded as `D-17`.

### Q2 — Where do the text fixtures live, and what loads them?

| Option | Description | Selected |
|--------|-------------|----------|
| fixtures/textmon/, sibling loader (Recommended) | binmon-fixtures.ts's contract is byte-exact binary frames and its header declares it the ONE such loader; text shares only the five provenance keys | ✓ |
| fixtures/textmon/, extend binmon-fixtures.ts | One loader, zero duplication. Cost: makes that header sentence false and invites a text test to reach for a frame encoder | |
| Defer the loader to Phase 42 | Cost: criterion 5 says the refusing loader is what makes provenance checkable rather than claimed | |

**User's choice:** fixtures/textmon/, sibling loader
**Notes:** Recorded as `D-18`.

### Q3 — What guards the loader, and what does it cost the test gate?

| Option | Description | Selected |
|--------|-------------|----------|
| One automated test, no MANUAL_ONLY entry (Recommended) | Corpus-free: the loader refuses a sidecar missing any of the five keys, and every sidecar carries `synthetic: false` with a real `capturedFrom`. MANUAL_ONLY_TESTS unchanged | ✓ |
| Also a live capture test | Adds a default-SKIP live entry. Cost: the union guard fails both directions, and the capture is a one-time act, not a regression surface | |
| No test; the sidecars are evidence | Cheapest. Cost: contradicts criterion 5's own words | |

**User's choice:** One automated test, no MANUAL_ONLY entry
**Notes:** Recorded as `D-19`. Default expectation: zero new MANUAL_ONLY_TESTS entries.

### Q4 — What is committed when a command is unsupported on a binary?

| Option | Description | Selected |
|--------|-------------|----------|
| Commit the refusal as a fixture (Recommended) | The unsupported response is the capture, sidecar naming the missing capability and the binary — what cpuhistory-get-unsupported.json already does. PARSE-04 needs a real one | ✓ |
| Skip it, record in the evidence file | Cost: Phase 42 re-runs a capture this phase was standing in front of | |
| Commit it, and pin the binary that can re-record it | Adds a CAPTURE_REQUIRES_VERSION-shaped guard. Cost: a re-capture guard for a corpus with no re-capture tool yet | |

**User's choice:** Commit the refusal as a fixture
**Notes:** Recorded as `D-20`.

---

## Todo cross-reference

Eleven pending todos matched Phase 39. Offered as a single question after the four areas.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold the Pitfall 5 correction (Recommended) | "Phase 7 Pitfall 5 overgeneralizes text monitor unreachable". Phase 33 declined it because that milestone kept the channel out; this phase is the first to dial the port and produces the correcting evidence | ✓ |
| Fold none | Avoids the STATE.md ledger row move; the correction lands in Phase 41 | |
| Fold Pitfall 5 and BACK-05 | Also the live-broker ordering test. Cost: not in CHAN-01's requirement set; Phase 33 declined on that ground | |

**User's choice:** Fold the Pitfall 5 correction
**Notes:** The todo already carries `resolves_phase: 39`. The other ten are
listed with per-item reasoning in CONTEXT.md's `<deferred>` section. The two
that scored 0.9 (vicerc reaping, remove pre-warm) scored on keyword overlap with
"broker"/"launch" alone and have no bearing on a phase that spawns `x64sc`
directly.

---

## Claude's Discretion

- **`D-14`** — driving the binary half of every experiment through the shipped
  `stock-protocol.ts` encoders. Not put to the owner; adopted from Phase 33's
  probe precedent.
- **`D-09`'s `not-taken` arm** — the owner chose `IDLE_COEXIST: corrupts` as the
  sole `no-go`; routing the untakeable case to the same verdict by a separate
  rule is Claude's extension and is flagged in CONTEXT.md for re-check.
- Plan decomposition, which experiments run concurrently, the concurrent
  in-flight experiment's timing method, and evidence file naming.

## Deferred Ideas

Captured in CONTEXT.md's `<deferred>` section. Nothing raised in this discussion
was scope creep — no new capability was proposed. The deferred list is composed
of Phase 41/42 work this phase deliberately does not do (`CHAN-02` port
surfacing, `CHAN-03` framing, `monitor-lock.ts` in any shape, a shipped text
client), two declined guards (`D-06`'s downstream binding guard, `D-19`'s live
capture suite), and the two text-monitor capabilities the owner declined at the
milestone open on 2026-09-06 (`a`/`d` assemble-disassemble, `x64` ↔ `x64sc` mode
switching).
