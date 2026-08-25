# Phase 19: Absorbed Procedures and the Coverage Instrument - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This context exists for **round 4 of gap closure only**. Every other success criterion of
Phase 19 is verified and closed (ABS-01…04, SURF-03, COV-02, and SC2/SC3/SC5). The single
open item is SC4's goal qualifier — *"a coverage instrument … that resists being gamed,
before any decomposition work runs under it"* — specifically the **structural-completeness
number**, which remains manufacturable out of ordinary 6502 data. That is COV-01.

Scope is `hasDispatchContext()` in `src/mcp/vice/r2000-coverage.ts`, the two passes that
consult it, and the control mechanism in `src/mcp/vice/r2000-coverage.test.ts` that is
supposed to hold it down. Nothing else. No new capability, no new report field, no new verb.

**This round is scoped to the DEFECT CLASS, not to the next instance.** Closing only the
`stack-return-push-idiom` branch is an explicitly INSUFFICIENT outcome for this round.

</domain>

<decisions>
## Implementation Decisions

### Why this round is framed differently

SC4 has now failed three consecutive verifications — 3/5, then 4/5, then 4/5 — and every
time in the same function, for the same reason, via a different shape:

| Round | Verification | What SC4 failed on |
|---|---|---|
| 1 | `d6d3fe3` | the class-3 split-table scan had **no** dispatch gate at all (8× census inflation) |
| 2 | `0d05fe6` | 19-08 added a gate; it accepted "two consecutive zero-page stores" — how every 16-bit pointer on a 6502 is built |
| 3 | `a1b39da` | 19-10 fixed that (CR-04) by requiring the consumer, and **left the sibling branch** |

Rounds 1–3 each closed the instance they targeted, verified by independent reproduction. The
loop is not caused by bad fixes. It is caused by **scoping gap plans to REVIEW finding ids**:
round 2's verification had already written that the gate accepted "one of THREE sufficient
shapes", naming that the others were unexamined, and round 3's plans addressed the shapes that
had ids. The shape without an id survived.

- **D-01:** Round 4 is scoped by defect class, not by finding id. A plan in this round MUST NOT
  take "the ids named in `19-VERIFICATION.md`" as its boundary. The boundary is the invariant in
  D-02, applied to every branch that exists and every branch that could be added.

### The defect class

- **D-02:** The invariant, and the acceptance boundary for this round:

  > A branch of `hasDispatchContext()` may return true only on a **proven data-flow link**
  > from the two reconstructed table bases to the dispatch mechanism — never on the mere
  > presence of a shape within the window.

  The evidence that this is a class and not an instance is that the two shipped branches are
  asymmetric. From `r2000-coverage.ts` as committed at `a1b39da`:

  ```
  // zeropage-vector-jumped-through -- PROVEN LINK (fixed by 19-10, CR-04)
  if (indirectJumpPointers.includes(a)) return true;

  // stack-return-push-idiom -- PRESENCE ONLY (the open blocker)
  if (insn.opcode === 0x60 && sawPha >= 2) return true;
  ```

  The second never consults the two indexed loads being paired: any two `pha`s and an `rts`
  anywhere in the window satisfy it. CR-04 *was* this defect, in the other branch.
  — **Reversibility:** costly — the invariant is what every control in D-04/D-05 is written
  against, so restating it later means rewriting the control mechanism, not just the predicate.

- **D-03:** Every true-returning site consults the pairing under test. For
  `stack-return-push-idiom` that means the two `pha`s must push the bytes loaded by *the two
  loads being paired* (`lda loBase,x : pha : lda hiBase,x : pha : rts`), not any two `pha`s in
  reach. The rationale currently in that branch's doc comment — that the class-4 pass "runs
  FIRST and claims its windows" so a pairing inside such a window "is skipped outright" — is
  **falsified** and must be corrected rather than preserved: class 4 claims only its exact
  five-instruction shape, and when it declines (mixed registers, implausible target, a longer
  gap before the `rts`), class 3 promotes the pairing through this branch anyway.

### The control mechanism — where round 3 leaked

- **D-04:** Interior controls are keyed by **(shape × route)**, not by shape.
  `r2000-coverage.test.ts:2250` is the line that let round 3's defect through:

  ```js
  const claimed = new Set(rows.filter(r => r.position !== OUTSIDE && r.polarity === "negative")
                              .map(r => r.position));
  ```

  One negative row per *shape* satisfies it. But `reachesGateInterior()`'s own comment states
  that `stack-return-push-idiom` is *"ruled on by TWO gates, not one"* — the class-3 pass and
  the class-4 pass — and then ORs the two routes together. All three declared negative controls
  (`STACK_RETURN`, `STACK_RETURN_MIXED_REGISTERS`, `STACK_RETURN_IMPLAUSIBLE_TARGET`) satisfy
  only the class-4 disjunct, so the class-3 route into that shape has never had a control at all.

  Required: re-key `position` to `{shape, route}` with route ∈ {`class-3-pass`, `class-4-pass`};
  change the signature to `reachesGateInterior(bytes, origin, shapeId, route)` and drop the OR;
  assert every reachable (shape × route) pair has a negative control that DECLINES.

  The knowledge was already in the source comment. Nothing forced a control for it. That is
  precisely the hole D-04 closes.
  — **Reversibility:** costly — every existing declaration row gains a field, so reverting means
  touching every row plus the two coverage assertions that read them.

- **D-05:** The route set is **derived from source text**, not hand-maintained. The assertion at
  `r2000-coverage.test.ts:2322` already reads `hasDispatchContext()`'s own source to prove its
  true-returning-site count equals `DISPATCH_CONTEXT_SHAPES.length`. Apply the same technique to
  enumerate the **call sites that consult the gate**, so adding a third consumer reds the suite
  rather than silently creating an uncontrolled route.

### The move that ends the loop

- **D-06:** D-03…D-05 still scale with the number of shapes — they put the suite one round *ahead*
  of the defect rather than past it. The class-scoped control is a **property assertion over
  generated input**, replacing "one hand-built fixture per shape":

  Generate payloads from a small grammar of ordinary 6502 idioms — indexed copy loops, zero-page
  pointer setups, `lda ($fb),y` indirect-indexed DATA reads, and the immediate-addressing twin of
  each — and assert over the whole generated set:

  1. no payload lacking a proven dispatch link reports `provenDispatchTargets().length > 0`;
  2. no data byte is classified `reached-as-instruction` without a proven link;
  3. each indexed payload and its immediate twin report the SAME `structural.reachedAsInstruction`,
     neither exceeding the code size its fixture declares.

  Assertion 3 is the generalisation of the `fp1`/`fp1b` and `fp2`/`fp2b` twin pairs already
  committed — those are a two-element instance of exactly this grammar. Stated as a property, it
  would have caught all three prior rounds' defects without knowing about any of them.
  — **Reversibility:** reversible — additive test surface; the generator is a new file and the
  per-shape controls stay in place beside it.

### Acceptance for this round

- **D-07:** Acceptance is NOT "SC4 passes". Each new gate must be demonstrated to **fail** when
  its control is removed, because the lesson of round 3 is that `reachesGateInterior()` was built
  specifically to catch this defect class and shipped with a disjunction that let every control
  satisfy one half. A gate nobody has watched fail is not known to be a gate. Concretely:
  1. the (shape × route) coverage assertion exists, is source-derived, and FAILS when one route's
     negative control is deleted — shown with a planted violation;
  2. the generated-payload property assertion exists and FAILS against the pre-D-03 predicate —
     shown by reverting D-03 locally and observing red;
  3. the round-3 blocker payload — `lda $0830,x / sta $fb / lda $0838,x / sta $fc / pha / txa /
     pha / tya / rts`, 15 code bytes, no `0x6c` anywhere in the image — reports
     `splitTables === 0`, `provenDispatchTargets() === []`, and `classAt($0840) === "unreached"`.

- **D-08:** If round 4's verification returns SC4 partial **again**, the conclusion is that the
  criterion is over-specified for what a heuristic disassembler can prove, and the next action is
  to rescope SC4 to advisory-not-gate — NOT to run a round 5. Record that verdict rather than
  planning another shape fix.
  — **Reversibility:** one-way — rescoping SC4 edits a ROADMAP success criterion and a
  REQUIREMENTS entry (COV-01) that Phase 20's entry conditions read, so it changes a published
  contract between phases. Requires explicit user confirmation before it is acted on.

### Claude's Discretion

The user delegated this round explicitly ("sort it out and fix it so we can break out of this
endless loop"). Claude has discretion over: how the generator grammar in D-06 is expressed and
where it lives; whether the `{shape, route}` key in D-04 is a tuple, a composite string, or two
fields; task decomposition and wave assignment; and whether the D-06 property test supersedes or
merely joins the per-shape controls. Claude does NOT have discretion over D-01, D-02 or D-07 —
those are the reason this round exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The open gap and its history
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VERIFICATION.md` — round-3 verification (`a1b39da`), status `gaps_found` 4/5. Its `gaps_remaining` entry carries the reproduced blocker payload and its measured report values.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW-FIX.md` — the durable disposition ledger for all 24 finding ids. **Read to know what is already dispositioned; do not scope this round to its ids (D-01).**
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — executed-evidence rows for rounds 1–3. Extend, never replace.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — open items, including item 3 (out of scope, see `<deferred>`).

### The code under change
- `src/mcp/vice/r2000-coverage.ts` — `hasDispatchContext()` and its doc comment (the falsified rationale, D-03); `DISPATCH_CONTEXT_SHAPES`; `resolveSplitOrientation()`; the class-3 and class-4 passes that consult the gate.
- `src/mcp/vice/r2000-coverage.test.ts` — `GATE_INTERIOR_DECLARATIONS` (:2117), the shape-keyed `claimed` assertion (:2250, the D-04 hole), the source-derived branch-count assertion (:2322), `reachesGateInterior()` (:1990, the disjunction).
- `src/mcp/vice/fixtures/coverage/README.md` and `make-coverage-fixtures.mjs` — the committed twin-pair fixtures that D-06 generalises.

### Project constraints
- `CLAUDE.md` — the derived-tool interception constraint, the "no build step" rule, and the testing conventions. Note especially that `vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested; that exemption does NOT extend to `r2000-coverage.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The source-text assertion technique** (`r2000-coverage.test.ts:2322`) already reads a function's own body and asserts a property of it. D-05 is the same technique pointed at call sites instead of return sites — extend it, do not invent a second mechanism.
- **`GATE_INTERIOR_DECLARATIONS` + `polarity`** — the table and its positive/negative split (added by 19-11) is the right shape; it needs one more key (D-04), not a redesign.
- **The twin-pair fixtures** (`fp1`/`fp1b`, `fp2`/`fp2b`) — indexed payload vs byte-identical immediate twin, same origin and length. This is already the D-06 property at N=2; the generator should produce this pairing, not a new convention.
- **`isPlausibleEntryPoint()`** (extracted by 19-11) — the shared decodability/in-image predicate both gated reconstructions already read. A new branch's link check should compose with it rather than re-deriving bounds.
- **The single derived `effectiveEnd`** (`r2000-coverage.ts:793`, added by 19-12) — one clamped bound read by five sites. Any new index computation reads it too.

### Established Patterns
- **Every tightening ships its both-directions control in the same commit.** A gate that declines everything measures nothing; `SPLIT_TABLE` and `STACK_RETURN` must still be PROVEN after this round.
- **A control built from OUTSIDE the predicate it constrains is not a control.** Position and polarity are declared and mechanically checked, never claimed in prose.
- **`COVERAGE_SCHEMA_VERSION`** — a report-shape change bumps it. D-01…D-07 are predicate and test changes; if the report shape genuinely must change, that is a decision to surface, not to absorb.
- **The instrument is read-only by construction** — a committed source-level assertion proves `r2000-coverage.ts` performs no filesystem write and imports no live session. It must still pass.

### Integration Points
- `provenDispatchTargets()` is the single seam deciding what may seed a recursive descent. Both passes feed it; the gate is what stands between them and it.
- Phase 20 consumes `buildCoverageReport()`'s JSON continuously and runs *under* the structural number, which is why an inflatable number blocks it (the phase goal's "before any decomposition work runs under it").

</code_context>

<specifics>
## Specific Ideas

The reproduced blocker payload, to be used verbatim as an acceptance fixture (D-07.3):

```
lda $0830,x / sta $fb / lda $0838,x / sta $fc / pha / txa / pha / tya / rts
```

15 bytes of code in a 64-byte payload, **no `0x6c` opcode anywhere in the image**. Measured at
`a1b39da`: `reached=31, tableEntry=16, splitTables=1, stackReturn=0, proven=8` ($0840–$0847),
with `classAt($0840) = "reached-as-instruction"` on a cleared buffer. Moving the `rts` one
instruction past the window collapses it to `16 / 0 / 0 / 0` with `$0840` unreached — which is
the control half.

</specifics>

<deferred>
## Deferred Ideas

- **`r2000-session.test.ts:631` — the 200 ms call-timeout flake.** `deferred-items.md` item 3;
  measured 3 red in 7 full-suite runs vs 0 in 5 standalone. It drives a real spawned child
  against a wall-clock budget while `node --test` runs files concurrently across 12 cores. It
  needs a plan that OWNS `r2000-session.ts`; do not widen a timeout from a plan fenced out of
  that file, and do not treat a green full-suite observation as proof the tree is stable.
- **WR-03** — 4 code bytes plus 60 bytes of `$02` reports `reached=64, unreached=0,
  linearSweepDecodable=4`, so the report contradicts itself 16×. Same defect family, already
  dispositioned, flagged by the round-3 verification as a human decision. Deliberately NOT folded
  into this round: it is a census-classification question rather than a dispatch-gate question.
  If the D-06 generator surfaces it as a property violation, that is a finding to report, not a
  licence to widen scope.
- **Rescoping SC4 to advisory-not-gate** — held behind D-08. Not this round.

</deferred>

---

*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Context gathered: 2026-08-25*
