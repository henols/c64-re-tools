---
phase: 23-the-real-release-gate-go-degrade-no-go
plan: 10
subsystem: planning
tags: [verdict, decision-rule, provenance, dxa, ghidra, vice, analyzer-audit, findings]

requires:
  - phase: 23-01
    provides: "evidence/DECISION-RULE.md (R1..R9, frozen) and evidence/SCHEMA.md (outcome-line names, corpus.releases[] shape, criterion-1 definitions), plus evidence/README.md's conventions and the banked ordering proof"
  - phase: 23-02
    provides: "the pinned instruments (dxa 0.1.5, Ghidra 12.1.3, VICE fork 3.10) and the reproduced 279-byte fixture baseline with RC-1..RC-3"
  - phase: 23-03
    provides: "the two-release corpus identity, the $1BC2 handoff, and C0_CORPUS: partial -- rule R1's only input"
  - phase: 23-04
    provides: "C4_UNREPLACED_CAPABILITIES: 0 and the 26-capability analyzer.rs audit with three priced losses"
provides:
  - "docs/phase23-real-release-gate-findings.md -- the durable, machine-readable verdict artifact Phase 24's planner reads as a precondition"
  - "verdict: no-go, verdict_rule_applied: R1, derived from the pre-committed rule with no judgement step"
  - "the full DECISION-RULE.md reproduced verbatim in a durable docs/ file, so the derivation survives without any plan file"
  - "the five non-dispatched plans (23-05..23-09) named with their reason, their criteria recorded could-not-run"
  - "eight accepted limits collected unmerged, plus fifteen numbered corrections to prior documents"
  - "twelve scoped corrections applied to 23-RESEARCH.md -- this plan is its single owner"
  - "evidence/README.md's index table closed for every artifact produced, plus a Repo integrity section proving zero paths under src/"
affects: [24-the-two-engines, 25-the-annotation-store-and-the-cutover, 26-automatic-annotation, 23-11]

actuals:
  tokens: 82767
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "First-match-wins verdict derivation: state that no earlier rule exists rather than manufacturing a walk through rules that were never evaluated"
    - "A could-not-run criterion is written up at the same length as a measured one, and never rendered as not-exercised"
    - "A plan verify that can only pass by fabricating evidence is recorded as an unsatisfiable limit, not satisfied"

key-files:
  created:
    - docs/phase23-real-release-gate-findings.md
  modified:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/README.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-RESEARCH.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md
    - .planning/STATE.md

key-decisions:
  - "Phase 23's recorded verdict is no-go, rule R1, on C0_CORPUS: partial -- the pre-committed rule firing as written, five plans before the measurement existed"
  - "R1 is first under first-match-wins, so the re-derivation is two steps and no earlier-rule walk is manufactured; the six unevaluated inputs cannot flatter the verdict because the derivation never reads them"
  - "No override was taken: the escape hatch was considered and is explicitly unused, because `partial` fits R1's condition unambiguously"
  - "corpus.releases[].capture_sha256 is written could-not-run rather than a fabricated 64-hex value, so 23-10-PLAN.md Task 1's own verify is recorded as unsatisfiable -- the phase-wide SCHEMA-wins precedent"
  - "The snapshot-extraction finding (todo d6ed4fd) is carried forward as evidence that R1's secure-a-corpus branch is cheaper than it looks, and is explicitly marked as NOT having changed the verdict"

patterns-established:
  - "Verdict frontmatter carries every rule input, including the ones that were never evaluated, with a YAML comment naming why each is absent"
  - "The evidence index states what each artifact PROVES, and names the never-produced artifacts as such rather than deleting their rows"
  - "Repo integrity is proven by pasting the real `git diff --name-only <base>..HEAD`, not asserted"

requirements-completed: [PROOF-05, PROOF-01, PROOF-02, PROOF-03, PROOF-04]

coverage:
  - id: D1
    description: "A durable findings document exists carrying machine-readable frontmatter with verdict: no-go and verdict_rule_applied: R1, plus per-release corpus identity and the tool pins"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "grep -qE '^verdict: (go|degrade|no-go)$' docs/phase23-real-release-gate-findings.md && grep -qE '^verdict_rule_applied: R[0-9]+$' ..."
        status: pass
      - kind: other
        ref: "grep -cE '^\\s+file_sha256: \"?[0-9a-f]{64}' -> 2; grep -cE '^\\s+canonical: true$' -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The verdict is derived by walking the actual outcome value through the pre-committed rule, and the document shows why no earlier rule fired (there is none -- R1 is first)"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "docs/phase23-real-release-gate-findings.md '## Verdict' section; C0_CORPUS: partial transcribed from evidence/capture/CAPTURE-SUMMARY.txt"
        status: pass
    human_judgment: true
    rationale: "That the re-derivation is genuinely judgement-free -- and that a reader can follow it without prior context -- is a reading judgement no grep asserts"
  - id: D3
    description: "The full decision rule R1..R9 is reproduced verbatim in the body, including the never-a-gate declarations, so the document is self-contained"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "grep -qE '^> .*R9' docs/phase23-real-release-gate-findings.md; blockquote generated programmatically from evidence/DECISION-RULE.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every present value is transcribed from a named evidence file; every absent one reads could-not-run with the reason named, and not-exercised is never rendered as a pass"
    requirement: "PROOF-01"
    verification:
      - kind: other
        ref: "'## Summary table' + '## Inputs that were never evaluated' -- each cell cites its file or states the file is absent"
        status: pass
    human_judgment: true
    rationale: "Transcription fidelity against eight evidence files is exactly the property a grep cannot establish; a reader must diff the cells against the outcome lines"
  - id: D5
    description: "The five non-dispatched plans (23-05..23-09) are named with their reason rather than silently absent"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "'## Inputs that were never evaluated, and why that cannot flatter the verdict' table names 23-05..23-09 and D-03"
        status: pass
    human_judgment: false
  - id: D6
    description: "The criterion-4 audit result is carried into the verdict: 26 audited, 23 replaced, 3 lost-accepted, 0 unreplaced, with the one row a re-run could move named"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "'## Criterion 4' section; counts transcribed from evidence/criterion4-analyzer-audit.md"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every ## ACCEPTED LIMIT block across the evidence tree is collected unmerged (eight), and every ## RESEARCH CORRECTIONS entry is collected and numbered (fifteen), with the applicable ones applied to 23-RESEARCH.md as scoped edits"
    requirement: "PROOF-03"
    verification:
      - kind: other
        ref: "grep -rn '^## ACCEPTED LIMIT' evidence/ -> 8 blocks; git diff --numstat 23-RESEARCH.md -> 54 insertions / 16 deletions over 1650 lines"
        status: pass
    human_judgment: false
  - id: D8
    description: "evidence/README.md's index table is closed for every artifact produced, and ## Repo integrity pastes the real git diff proving no path under src/"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "grep -q '## Repo integrity' && grep -q '## Ordering proof' && ! grep -qE '^src/' evidence/README.md"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-08-26
status: complete
---

# Phase 23 Plan 10: The Findings Document and the Machine-Readable Verdict Summary

**`docs/phase23-real-release-gate-findings.md` records Phase 23's verdict as `no-go`, rule `R1`, derived from `C0_CORPUS: partial` through a rule frozen five plans before the measurement existed — with the full rule reproduced verbatim, the five non-dispatched plans named with their reason, and no criterion softened into a pass.**

## Performance

- **Duration:** 47 min
- **Tasks:** 3 (plus one auto-fixed red gate)
- **Files created:** 1
- **Files modified:** 4

## Accomplishments

- **The verdict exists and is machine-readable.** `verdict: no-go`, `verdict_rule_applied: R1`,
  with `corpus.releases[]` as a two-element list carrying `release` / `file_sha256` /
  `capture_sha256` / `canonical` and exactly one canonical element, plus the three tool pins.
  Phase 24's planner has the precondition artifact `PROOF-05` requires.
- **The derivation is two steps and needs no judgement.** Read `C0_CORPUS:` out of
  `evidence/capture/CAPTURE-SUMMARY.txt`; observe that `R1` is listed first. `partial` is not
  `pass`, `R1` fires, verdict `no-go`. The document says explicitly that **there is no earlier
  rule to walk**, rather than manufacturing a pass through `R2`..`R9` that first-match-wins
  never performs.
- **The gap is proven unable to flatter the verdict.** Six of seven rule inputs were never
  evaluated, five of them because plans 23-05..23-09 were deliberately not dispatched (every
  one reads the depacked flat-64K capture as its substrate, D-03, and 23-03 could not produce
  one). Because `R1` is first and matched on the first input, the derivation never reads them —
  so no value they might have carried could change the outcome. That argument is stated in its
  own section with a per-input table.
- **The full rule is reproduced verbatim**, generated programmatically from
  `evidence/DECISION-RULE.md` rather than retyped, including the never-a-gate declarations — so
  `C4_LOST_ACCEPTED: 3` cannot later be misread as three failures, and the blockquote itself is
  the tamper check against the file in git.
- **Criterion 1's absence is written up as fully as a result would have been**, with the
  fixture's *reproduced* figures (`72.39 (97/134)` / `3` FP / `27.61 (37/134)`) printed beside an
  **empty release column** so no fixture number reads as a criterion-1 result, and with
  `FIXTURE_REPRODUCED: no` surfaced as the substantive finding it is: the pivot's 141/138
  partition is not source-derivable, and it is more generous to dxa than the source is in exactly
  the place that decides the "0 false positives" headline.
- **Criteria 2 and 3 separate `could-not-run` from `not-exercised` explicitly**, and criterion
  2's section preserves the detection design that makes it non-circular — unresolved is detectable
  only as the absence of a reference from an independently enumerated site, because Ghidra reports
  nothing when it fails.
- **Eight accepted limits collected unmerged, fifteen corrections numbered**, including the three
  the plan named in advance, plus twelve scoped edits applied to `23-RESEARCH.md` (54 insertions
  over 1650 lines — everything the runs confirmed is untouched).
- **Repo integrity is proven, not asserted.** `evidence/README.md` now pastes the real
  `git diff --name-only fd1093b..HEAD`: 55 paths, all under `.planning/` or `docs/`, zero under
  `src/`.

## Task Commits

1. **Task 1: Collect every outcome line and derive the verdict** — `c5de118` (docs)
2. **Task 2: Per-criterion body, summary table and accepted limits** — `e1fe38b` (docs)
3. **Task 3: Corrections, evidence index, `23-RESEARCH.md` edits, repo integrity** — `7e01bd6` (docs)
4. **Deviation fix: missing Deferred Items ledger row** — `646d4d0` (fix)

**Plan metadata:** see the final `docs(23-10)` commit.

## Files Created/Modified

- `docs/phase23-real-release-gate-findings.md` (created, 1049 lines) — the durable verdict
  artifact: frontmatter, `## Verdict` with `### What the milestone becomes instead`,
  `## Inputs that were never evaluated`, the verbatim rule, `## Run date, corpus and builds
  tested`, `## Summary table`, `## Criterion 1`..`## Criterion 5`, `## Accepted limits` with
  `### Limits recorded by this document itself`, `## Other findings (carried forward, not
  scored)`, `## Corrections to prior documents`, `## Reproducing this`.
- `.planning/phases/23-.../evidence/README.md` — index table filled for every artifact produced
  (and the five never-produced ones named as such, with what their absence proves), plus a new
  `## Repo integrity` section.
- `.planning/phases/23-.../23-RESEARCH.md` — twelve scoped corrections. This plan is its single
  owner; plans 23-02..23-04 recorded theirs locally so parallel plans could not collide.
- `.planning/phases/23-.../deferred-items.md` — item 4 added, refining item 3's `2408` entry.
- `.planning/STATE.md` — Deferred Items ledger row + prose for the snapshot-extraction todo, then
  the standard position/decision/metric updates.

## Decisions Made

- **The verdict is `no-go` and no override was taken.** The rule's escape hatch was considered
  and is explicitly unused, and the document says so — `partial` fits `R1`'s condition
  unambiguously, so reinterpreting the rule would have been the failure the whole phase exists to
  prevent.
- **`### Scope amendments` is not emitted; `### What the milestone becomes instead` is.** The
  plan specifies `### Scope amendments` conditionally on a `degrade` verdict and directs a
  no-go to name what the milestone becomes. `R1`'s own text is reproduced rather than
  re-authored: *secure a corpus first, or re-scope v0.6.0 to a claim explicitly qualified as
  fixture-only.*
- **The six never-evaluated inputs are recorded as `could-not-run` in `criteria.*` with YAML
  comments naming why**, rather than adding a frontmatter key `SCHEMA.md` § 2 does not declare.
  `DECISION-RULE.md` § *Inputs* sanctions `could-not-run` generically for any input a
  measurement could not complete.
- **The precondition halt was not triggered, and the reason is structural.** Task 1's
  `<precondition>` requires all seven inputs readable and says the derivation halts on a gap
  rather than treating it as favourable. Under first-match-wins the derivation reads exactly one
  input, `c0_corpus`, and stops — so the gap it guards against cannot arise, and the guarded
  property (a gap must not favour the verdict) holds by construction. This is stated in the
  document's own `## Inputs that were never evaluated` section rather than left implicit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing STATE.md Deferred Items row reddened three tests**

- **Found during:** Task 1's `cd src/mcp/vice && npm test` acceptance gate.
- **Issue:** `docs-deferred-ledger.test.ts` direction A (`AUDIT-04`) was red — the pending todo
  `2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex`, filed at
  `d6ed4fd` before this plan, had no own-table-cell row in `.planning/STATE.md`. Its
  planted-violation sibling (test `427`) and `audit-integrity.test.ts`'s D-12-02 cascade (test
  `11`, which reported seven guards red from one cause) were red for the same single reason.
- **Fix:** added the ledger row (`| capture | … | major | Pending |`), corrected the
  "three rows above" count to four, and added a prose paragraph recording the todo — including
  that it did **not** change the verdict.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `node --test docs-deferred-ledger.test.ts` → 6/6 pass;
  `node --test audit-integrity.test.ts` → 44/44 pass.
- **Committed in:** `646d4d0`

### Recorded limits, not fixes

**2. `23-10-PLAN.md` Task 1's automated verify is unsatisfiable and is not satisfied.** It greps
for a 64-hex `capture_sha256` in the frontmatter. `CAPTURE_SHA256` is `could-not-run` for both
releases because the 64K image was never assembled, so the only way to pass would be to fabricate
a hash. `could-not-run` is written instead, per `DECISION-RULE.md` § *Inputs*, and the
unsatisfiable verify is recorded in the findings document under
`## Accepted limits` → `### Limits recorded by this document itself`. This follows the
operator-confirmed phase-wide precedent (`evidence/corpus/corpus-intake.txt` ACCEPTED LIMIT 2,
applied by 23-02 and 23-03): where a plan's verify disagrees with the frozen pre-commitment or
with the facts, the evidence is not bent. Every other clause of that verify passes.

**3. Two corrections were collected but not applied**, and the document says which and why:
`.planning/research/questions.md` (outside this plan's `files_modified`; the filed todo owns it)
and `23-02-PLAN.md`'s `-a dump` attribution (a committed plan file, not this plan's to edit).

---

**Total deviations:** 1 auto-fixed (1 bug), 2 recorded limits.
**Impact on plan:** the auto-fix was necessary to get a readable gate result and touched only
`.planning/STATE.md`. The recorded limits are refusals to fabricate evidence, which is the
behaviour this phase exists to enforce. No scope creep; nothing under `src/` was touched.

## Issues Encountered

**The regression gate is not green, and the honest result is reported rather than a green one
manufactured.** Three full `cd src/mcp/vice && npm test` runs were taken on this tree:

| Run | Result | Failing identities |
|---|---|---|
| 1 | 2587 pass / **6 fail** | not captured (the run was piped through `tail`, losing the `not ok` lines) |
| 2 | 2589 pass / **4 fail** | `11` D-12-02 cascade; `423` + `427` deferred-ledger; `2408` BACK-05 D-G ordering |
| 3 (reported) | **2592 pass / 1 fail** / 40 skipped / 5 todo | `2408` BACK-05 D-G ordering |

**Run 3 is the reported run.** `423`/`427`/`11` were a single real defect and are fixed
(`646d4d0`). The surviving failure, `2408`, is in the flake-identity set already recorded in this
phase's `deferred-items.md` item 3, and `2592/2638` matches that item's documented signature
exactly. Investigated further and **root-caused**: it reproduces in isolation
(`node --test vice-proxy.test.ts` → 118 pass / 1 fail, same test) with
`vice_diagnose: diagnosis_unavailable (session_refused)` and a **backend mismatch** — this
process resolves `stock` while a live broker owns the emulator as `fork`. It is host state, not
suite parallelism, and it is unreachable from anything this plan changed (`.planning/` and
`docs/` only). Logged as `deferred-items.md` item 4 rather than fixed: phase 23 may not modify
anything under `src/`.

**The `npm test` run leaves a committed Phase 18 evidence file dirty on every invocation**
(`deferred-items.md` item 1). Restored with `git checkout --` after each run; every stage in this
plan named its paths individually, so nothing unrelated entered a commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 24 has its precondition artifact.** `docs/phase23-real-release-gate-findings.md`
  carries `verdict: no-go` / `verdict_rule_applied: R1` in machine-readable frontmatter, and the
  ROADMAP already marks Phases 24, 25 and 26 verdict-gated. **Nothing downstream may be planned
  as though the answer were `go`.**
- **Plan 23-11 remains** — the ROADMAP and STATE pointers gating Phase 24 and the PROOF
  traceability flip. This plan deliberately wrote no Phase 24/25/26 plan and made no ROADMAP
  scope amendment beyond the per-plan progress row; 23-11 owns those pointers.
- **What the milestone becomes**, quoted from `R1`: secure a corpus first, or re-scope v0.6.0 to a
  claim explicitly qualified as fixture-only. Two carried-forward findings bear on which branch is
  cheaper: the hex-transcription blocker is **solved** with a validated snapshot-extraction method
  (`.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`,
  `d6ed4fd`), and the fork's non-frame-exact stopping checkpoint is **unsolved** — 201 multi-bit
  divergences between two `danish` snapshots diffed directly, with no transcription anywhere. That
  single problem is the whole remaining distance to a real measurement.
- **Concern:** criteria 1, 2 and 3 are `could-not-run`, not `not-exercised`. Nothing is known
  about dxa's error rate, Ghidra's computed-dispatch resolution, or where a forward-carried `$01`
  stops being correct, against real code. Any later document that reads this phase as having
  partially validated those is reading it wrong.
