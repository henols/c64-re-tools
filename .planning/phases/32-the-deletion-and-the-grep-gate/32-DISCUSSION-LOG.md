# Phase 32: The Deletion and the Grep Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 32-the-deletion-and-the-grep-gate
**Areas discussed:** Fate ledger form + set, Vacuity proof method, Living-doc sweep policy, Close-gate run, Wiring the new artifacts

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Fate ledger form + set | Where each guard's fate lives, whether machine-checked, how the set is derived on the settled tree | ✓ |
| Vacuity proof method | How each guard is observed red across the whole set at once | ✓ |
| Living-doc sweep policy | CUT-06: correct-vs-keep-dated across three file classes, verdict coverage, guard pinning | ✓ |
| Close-gate run | How "full npm test, broker stopped" is honoured given the local hang and the manual-only split | ✓ |

**User's choice:** All four.

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| BACK-05 live-broker test | D-G ordering test fails deterministically on a live-broker host | ✓ (Claude's call) |
| research/questions.md false claim | Corpus-claim honesty work | |
| Phase 7 Pitfall 5 overgeneralization | docs/ accuracy, unrelated to regenerator2000 | |
| Fold none | Keep phase to CUT-04 and CUT-06 | |

**User's choice:** "You decide what's best."
**Notes:** Folded BACK-05 only, and as a *recorded precondition* of the gate run rather
than as adopted fix work — ROADMAP.md states this phase contains no build work by design.
The other two were rejected on the same ground: both would widen the sweep from "documents
pointing at a deleted route" to "all stale doc claims", which is a different requirement.

---

## Fate ledger form + set

### Question 1 — Where does each guard's recorded fate live, and is it machine-checked?

| Option | Description | Selected |
|--------|-------------|----------|
| Registry + derive-from-disk guard | Committed registry plus a test deriving the set from disk, failing if a member lacks a row. Matches audit-gate.mjs's D-12-07 | ✓ (Claude's call) |
| One-time phase evidence doc | Prose ledger under evidence/, no standing artifact, nothing to maintain | |
| Prose ledger pinned by a guard | Readable doc as canonical record, test pins its row set against disk | |

**User's choice:** "You decide."
**Notes:** Chose the registry. The deciding argument was audit-gate.mjs's own header —
"duplicating it by hand is exactly how a guard can silently drop out of the set this gate
protects." A prose-only record for an audit whose entire subject is that failure mode would
reproduce the 4f048bb shape. The third option was rejected for splitting one record across
two places that can drift apart.

### Question 2 — How is the audited set defined, given the historical numbers were measured against a vanished tree?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-derive on settled tree, reconcile against historical | Derive mechanically now, reconcile against the requirement's 43-file list, reason every delta | ✓ |
| Map historical set forward | Follow each of the 43 through rename/deletion to its descendant | |
| Audit both, report the delta | Run both derivations, make the difference an artifact | |

**User's choice:** Re-derive and reconcile.
**Notes:** Map-forward was blind to guards Phase 29 *created*, and Phase 29 is the source of
most of the set. Audit-both roughly doubles cost for a delta the reconciliation already
surfaces.

### Question 3 — What must a fate row record?

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict + new subject + observed-red evidence + trigger | Four fields; the trigger field is what the two deferred fates need | ✓ |
| Verdict + evidence only | Two fields, leaner | |
| Add a fifth superseded-by field | For D-36's explicit superseded-by fate | |

**User's choice:** Four fields.
**Notes:** D-36's superseded-by requirement is satisfied by verdict `superseded` plus the
new-subject field naming the replacement, so no fifth field was added. The two-field option
left the deferred fates with nowhere to record their new removal trigger, making a deliberate
survivor indistinguishable from an overlooked one.

---

## Vacuity proof method

### Question 1 — How is "observed red" produced across the whole set?

| Option | Description | Selected |
|--------|-------------|----------|
| Committed re-runnable mutation harness | Per row: plant, run that guard, assert non-zero, revert | ✓ |
| Manual plant / observe / revert per guard | Hand-worked transcript, zero new tooling | |
| Reuse in-test assertions, hand-plant the rest | Cheapest honest route | |

**User's choice:** Mutation harness.
**Notes:** The third option was rejected on a stated distinction — "the guard asserts it can
fail" and "the guard was observed failing against its new subject" are different claims, and
CUT-04 asks for the second. The manual option produces a transcript nobody can re-run, which
is precisely the increment CUT-04 adds over Phase 29's per-commit proofs.

### Question 2 — How do unplantable rows discharge the non-vacuity obligation?

| Option | Description | Selected |
|--------|-------------|----------|
| Typed rows with per-verdict discharge rules | Verdict decides what evidence the row owes | ✓ |
| Observed red or an explicit written exemption | Default red, reasoned exemption otherwise | |
| Restrict the set to plantable guards only | Deletions recorded separately as a manifest | |

**User's choice:** Typed rows.
**Notes:** The exemption option was rejected because an exemption set with no non-vacuity
assertion of its own is exactly what CUT-03 was written against, and audit-gate.mjs's D-12-14
carries a standing prohibition on relaxation hatches. Restricting the set contradicts the
requirement's "every guard and CI script … has a recorded fate".

### Question 3 — Where does a planted violation live while the harness runs?

| Option | Description | Selected |
|--------|-------------|----------|
| Committed fixtures, guard pointed at a temp root | audit-gate.mjs's existing --root pattern | ✓ |
| Ephemeral working-tree mutation, reverted after | Works uniformly regardless of root support | |
| Temp worktree per plant | Total isolation | |

**User's choice:** Committed fixtures + temp root.
**Notes:** Worktree-per-plant was rejected on speed and on this repo's known friction with
cleanup refusing branches containing deletions. This answer opened a gap — guards with no
root override — which became the follow-up below.

### Follow-up — Fallback for guards with no root override

| Option | Description | Selected |
|--------|-------------|----------|
| Add a root override where cheap, mutate-and-restore otherwise | Keeps most of the sweep non-mutating | ✓ |
| Mutate-and-restore for all non-root guards | Nothing being measured changes while being measured | |
| Record as unplantable, discharge by inspection | No mutation at all | |

**User's choice:** Add where cheap, mutate-and-restore otherwise.
**Notes:** Carried an ordering constraint into CONTEXT.md as D-07: any --root addition must
land in a commit *before* the sweep measures that guard, never in the same change. The third
option was rejected as the weakest evidence — it proves the subject exists, not that the guard
would notice it vanishing.

---

## Living-doc sweep policy

### Question 1 — Verdict policy across the three file classes

| Option | Description | Selected |
|--------|-------------|----------|
| Correct live prerequisite claims, keep-dated everything historical | Findings docs, licence notices and dated decision rows stay byte-identical | ✓ |
| Per-class rule decided up front, applied mechanically | Faster and more consistent | |
| Correct every live mention, strip historical to citations | Least residue | |

**User's choice:** Correct live claims, keep-dated historical.
**Notes:** Matches the keep-dated verdict already reached for CORE-01 and D-36. The mechanical
per-class option was rejected because a file straddling two classes — a skill playbook carrying
both a withdrawal notice and an attribution header — would get the wrong verdict from whichever
class it landed in. The aggressive option rewrites dated records, which this project's
convention treats as destroying evidence.

### Question 2 — Does a file left alone get a recorded verdict?

| Option | Description | Selected |
|--------|-------------|----------|
| Every file in the swept set gets a row, including "left unchanged" | ~35 rows, most one line | ✓ |
| Only changed files are recorded | The diff is the record | |

**User's choice:** Every file gets a row.
**Notes:** Same distinction the fate ledger draws for guards, applied to documents: "we looked
and it's fine" must be distinguishable from "we never looked". PROJECT.md's 46 mentions are
where that ambiguity would bite hardest.

### Question 3 — PROJECT.md's stale vice-proxy.ts line citations

| Option | Description | Selected |
|--------|-------------|----------|
| Repair, and bring PROJECT.md under docs-linerefs.test.ts | Fix and guard against re-rot | ✓ |
| Repair only, leave unguarded | Smaller blast radius | |
| Replace citations with symbol names | Permanently removes the rot | |

**User's choice:** Repair and guard.
**Notes:** CLAUDE.md's own bullet already records that these numbers drift every phase, so the
unguarded option would be stale again within a milestone. Accepted cost recorded as D-10's
reversibility: PROJECT.md now reds CI whenever vice-proxy.ts shifts.

---

## Close-gate run

**Correction made during discussion:** an earlier framing said `test:automated` carries its
own failure baseline. Reading `src/mcp/vice/test-gate.mjs:95-131` showed it does not — it
exits with `node --test`'s own status over the glob minus exactly nine MANUAL_ONLY_TESTS. The
gap is coverage, not a laundered baseline. A second finding revised the picture again: CI
already runs the *full* glob deliberately (`.github/workflows/ci.yml:130-161`), so the hang is
a local-only condition.

### Question 1 — How is the whole-glob claim honoured?

| Option | Description | Selected |
|--------|-------------|----------|
| test:automated green + test:manual file-by-file | Union of the two legs is the whole glob | ✓ |
| Per-file spawn across the whole glob with timeouts | One artifact, hang becomes a recorded timeout | |
| Fix the hang first | Cleanest end state | |

**User's choice:** Two legs.
**Notes:** The split is this repo's own documented seam rather than one invented for the audit.
Building a new runner inside an auditing phase was rejected — its results would match neither
existing npm script. Fixing the hang is unbounded debugging in a phase ROADMAP.md says contains
no build work, and would not help the six emulator-dependent files.

### Question 2 — How is "broker stopped" handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Asserted precondition, recorded in the evidence | A red is never ambiguous between real failure and live broker | ✓ |
| Stop the broker as a scripted step | Removes the human step | |
| Note it in the runbook only | Zero implementation | |

**User's choice:** Asserted precondition.
**Notes:** The scripted stop was rejected because the broker runs as a systemd unit here and an
audit script that tears down the developer's environment is the wrong shape. The runbook-only
option is the state that produced the BACK-05 todo in the first place.

### Question 3 — What is the recorded artifact?

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence file with raw commands, output and environment | Matches 29-21-SUMMARY.md | ✓ |
| Summary table with exit codes | Easier to read at a glance | |
| Both — table up front, raw output below | | |

**User's choice:** Raw evidence file.
**Notes:** A table of exit codes cannot be re-derived, and this milestone has already had to
correct figures whose provenance did not reproduce.

---

## Wiring the new artifacts

### Question 1 — Does the fate-registry guard follow D-12-11?

| Option | Description | Selected |
|--------|-------------|----------|
| Own CI step, own file name, not in package scripts | Alongside the six existing check-*.mjs steps | ✓ |
| Plain *.test.ts under the normal glob | Simplest wiring, runs locally | |
| Both — test file plus a named CI step | Maximum coverage | |

**User's choice:** Own CI step.
**Notes:** The test-file option was rejected because audit-gate.mjs finds its guard set by
directory listing, so a new file landing there has effects beyond its own assertions. The
both-option is the duplication D-12-07 warns about.

### Question 2 — Does the mutation harness run in CI?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase instrument, committed and re-runnable, not in CI | Registry guard holds the line; harness produces evidence | ✓ |
| CI on a schedule or manual dispatch | Catches a guard quietly made vacuous | |
| Full CI on every push | Vacuity as a continuous contract | |

**User's choice:** Phase instrument.
**Notes:** The scheduled option's drift window is recorded as a known accepted gap in CONTEXT's
deferred ideas rather than being silently dropped.

### Question 3 — What does the close-gate evidence cite?

| Option | Description | Selected |
|--------|-------------|----------|
| CI whole-glob green + local legs, with the SKIP nuance stated | Honest about what each leg establishes | ✓ |
| CI whole-glob green is sufficient | Simplest defensible reading | |
| Local legs only, CI as corroboration | Strongest on the emulator-dependent files | |

**User's choice:** Both legs plus the stated nuance.
**Notes:** Citing CI alone quietly counts nine SKIPs as coverage — the exact shape of claim this
milestone has already had to correct once.

---

## Claude's Discretion

- **The fate ledger's form** (user: "You decide") — chose registry + derive-from-disk guard on
  audit-gate.mjs's D-12-07 precedent. The registry's concrete file format and location remain
  open to the planner; the derive-from-disk property and the no-second-list rule do not.
- **Todo folding** (user: "You decide what's best") — folded BACK-05 only, as a recorded
  precondition rather than adopted fix work.
- The harness's concrete invocation surface, the registry's serialization format, and the
  plan/wave decomposition are all left to the planner.

## Deferred Ideas

- Re-spelling the twelve committed `project.regen2000proj` coverage fixtures, and with them
  removing `block-class.ts`'s transitional capitalised arm and re-pointing
  `make-coverage-fixtures.mjs`'s frozen writer. ROADMAP.md is explicit this phase records the
  fate and does not perform the re-point.
- Fixing the BACK-05 D-G ordering test's live-broker sensitivity.
- Diagnosing `vice-proxy.test.ts`'s local hang so `npm test` means locally what it means on CI.
- Running the mutation harness on a schedule to catch a guard that is still listed but has
  quietly become vacuous between phases.
