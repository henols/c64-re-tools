# Phase 32: The Deletion and the Grep Gate - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a **retrospective, mechanically-measured vacuity audit over
the whole re-pointed guard and CI-script set at once, on a settled tree**
(`CUT-04`), plus the **living-document sweep** that leaves no document pointing a
user at a deleted route (`CUT-06`), plus a **re-run of the phase-close gate**.

**It contains no product build work by design.** Its deliverables are a fate
registry, a mutation harness, corrected documents and evidence files. But it is
not thin: Phase 29 is the source of most of the guards it audits, so this phase's
scope *grew* when `CUT-01`, `CUT-02`, `CUT-03` and `CUT-05` were pulled forward
into Phase 29 by `D-01`.

**In scope:**

1. A committed **fate registry** with a recorded, typed fate for every guard and
   CI script that was pinned to the deleted subject, plus a derive-from-disk
   guard that fails if a set member has no row.
2. A committed, re-runnable **mutation harness** that produces the observed-red
   evidence behind each re-pointed row.
3. The **`CUT-06` living-document sweep** — a recorded verdict for every file in
   the swept set, including files deliberately left unchanged.
4. `PROJECT.md`'s stale `vice-proxy.ts` line citations repaired **and** brought
   under `docs-linerefs.test.ts`.
5. The **phase-close gate re-run**, recorded with its environment.

**Out of scope:** Re-deriving the grep gate, its scope predicate or its exemption
axes (Phase 29 built and proved all of it — audit it, do not rebuild it).
Performing the two deferred re-points (`block-class.ts`'s capitalised block-type
arm; `make-coverage-fixtures.mjs`'s frozen writer) — this phase records their
fate against their **new** triggers only; the re-spelling is later work.
Debugging `vice-proxy.test.ts`'s local hang. Automatic annotation (v0.8.0).

</domain>

<decisions>
## Implementation Decisions

### The fate ledger

- **D-01 — The recorded fate lives in a committed registry with a
  derive-from-disk guard, not in a one-time evidence document.** The guard
  derives the audited set from disk and fails if any member lacks a fate row.
  This follows `scripts/audit-gate.mjs`'s `D-12-07` — *"Do not hand-type a second
  list of guard file names anywhere else in this repo. The guard set below is
  derived from disk; duplicating it by hand is exactly how a guard can silently
  drop out of the set this gate protects."* A prose-only record for an audit
  whose entire subject is "a guard can silently drop out of a set" would
  reproduce the `4f048bb` failure mode this project keeps legislating against.
  *(User answered "You decide" on this one; recorded as Claude's discretion
  below.)*
  — **Reversibility:** costly — the registry becomes an artifact later phases
  must keep fed, and its guard will red on any future guard rename.

- **D-02 — The audited set is re-derived on the settled tree and then reconciled
  against the requirement's historical list, with every addition and removal
  given a reason.** `CUT-04`'s "**32 test files** … and **11 files under
  `scripts/`**" was measured at the v0.7.0 open, against a tree Phase 29's
  renames and deletions have since reshaped. Measured at discussion time: 126
  `*.test.*` files now sit in `src/mcp/vice/`, `scripts/lib/` is fully renamed to
  `anno-*`, and `scripts/` has gained `check-no-regenerator2000.mjs`. Mapping the
  historical 43 forward alone would be blind to guards Phase 29 *created* — and
  Phase 29 is the source of most of the set. Re-deriving alone would lose the
  requirement's own auditable numbers. The reconciliation is the deliverable that
  keeps both honest.
  — **Reversibility:** reversible.

- **D-03 — A fate row records four fields: verdict, new subject, observed-red
  evidence, and new removal trigger.** Verdict is one of `re-pointed`, `deleted`,
  `superseded`, `kept-unchanged`. "New subject" is what the guard now asserts
  against. "Observed-red evidence" is the raw command and its output. "New
  removal trigger" is required wherever a guard survives its own original removal
  trigger. The fourth field is what the two deferred fates need; without it they
  read as unexplained survivors rather than deliberate ones. **`D-36`'s explicit
  "superseded-by" fate**, which ROADMAP.md requires, is expressed as verdict
  `superseded` plus a new-subject field naming the replacement — no fifth field
  is added for it.

### The vacuity proof

- **D-04 — A committed, re-runnable mutation harness produces the observed-red
  evidence, rather than a hand-worked transcript.** Per registry row it plants
  that guard's violation, runs only that guard, asserts a non-zero exit, and
  reverts. This is what makes the sweep a *measurement* rather than a transcript,
  which is precisely the increment `CUT-04` adds over Phase 29's per-commit
  individual proofs. Reusing each guard's existing in-test non-vacuity assertion
  was rejected: "the guard asserts it can fail" and "the guard was observed
  failing against its new subject" are different claims, and `CUT-04` asks for
  the second.
  — **Reversibility:** costly — the harness must revert cleanly; a crashed run
  leaving the tree dirty would corrupt this phase's own close-gate run, which
  happens on that tree.

- **D-05 — Rows are typed, and the verdict decides what evidence the row owes.**
  `re-pointed` owes an observed red. `deleted` owes proof of absence plus the
  commit that removed it. `superseded` owes the replacement's own observed red.
  `kept-unchanged` owes proof its subject still exists untouched. Every row is
  then checkable against a stated rule rather than judged case by case. An
  "observed red or a written exemption" scheme was rejected: an exemption set
  with no non-vacuity assertion of its own is exactly what `CUT-03` was written
  against, and this repo's gate design deliberately carries no relaxation
  hatches (`audit-gate.mjs`, `D-12-14`).

- **D-06 — Planted violations live in committed fixtures and the guard is pointed
  at a synthetic tree; the real working tree is not mutated where that is
  avoidable.** This is `audit-gate.mjs`'s existing `--root <dir>` pattern —
  *"Testability comes from the `--root <dir>` CLI flag instead, which points this
  whole script at a synthetic tree without touching any real behaviour"* — and
  the shape `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` and
  `.md.txt` already follow.

- **D-07 — Guards with no root override get one where the change is cheap and
  self-contained; the rest fall back to guarded working-tree mutation with a
  restore-on-exit handler.** **Ordering constraint:** any such `--root` addition
  must land in a commit **before** the sweep measures that guard, never in the
  same change — the auditor must not be modifying the audited guard while
  measuring it.
  — **Reversibility:** reversible.

### The living-document sweep (`CUT-06`)

- **D-08 — Only text that tells a reader to use, install or invoke a deleted
  route is corrected. Everything historical stays byte-identical.** Measured at
  discussion time: 35 tracked non-`.planning` files still contain the literal
  `regenerator2000`, in three classes — dated findings documents
  (`docs/phase9-regenerator2000-probe-findings.md`,
  `docs/phase23-real-release-gate-findings.md`), licence and attribution notices
  (`THIRD-PARTY-NOTICES.md`, `src/mcp/vice/THIRD-PARTY-NOTICES.md`,
  `installer/THIRD-PARTY-NOTICES.md` — which ROADMAP.md records as **remaining
  true** for the retained prose), and live pointers. This is the same keep-dated
  verdict this project already reached for `CORE-01` and `D-36`. Rewriting dated
  records is the one move this project's convention treats as destroying evidence
  rather than tidying it.
  — **Reversibility:** reversible.

- **D-09 — Every file in the swept set gets a row, including "left unchanged".**
  So a later reader can distinguish "we looked and it is fine" from "we never
  looked" — the same distinction `D-01`'s registry draws for guards, applied to
  documents. `.planning/PROJECT.md` alone carries 46 `regenerator2000` mentions
  and 26 `r2000_` occurrences, which is exactly where a silent omission would
  bite.

- **D-10 — `PROJECT.md`'s stale `vice-proxy.ts` line citations are repaired AND
  brought under `docs-linerefs.test.ts`.** `CLAUDE.md`'s equivalents are already
  mechanically checked; `PROJECT.md`'s are not, and CLAUDE.md's own bullet
  records that these numbers drift every phase. Widening the existing guard's
  scanned set is a small change to a guard this phase is auditing anyway — and it
  is subject to `D-07`'s ordering constraint.
  — **Reversibility:** costly — `PROJECT.md` now reds CI whenever `vice-proxy.ts`
  shifts. That is the intended pressure, but it is new pressure on a file edited
  every milestone.

- **D-11 — `CLAUDE.md` is already clean and needs no work.** Measured at
  discussion time: 0 `regenerator2000` mentions, 0 `r2000_` occurrences. Phase 29
  discharged it. A planner must not re-derive this as outstanding. Likewise there
  is **no `ARCHITECTURE.md` outside `.planning/`** — ROADMAP.md's "Rule A21"
  reference resolves to `.planning/ARCHITECTURE.md`.

### The close-gate re-run

- **D-12 — The whole-glob claim is honoured by `test:automated` to a real zero
  plus `test:manual` worked file-by-file, and the union is the whole glob.** No
  single local command produces it: `npm test` is `node --test '*.test.*'` over
  the full glob including nine `MANUAL_ONLY_TESTS`
  (`src/mcp/vice/test-gate.mjs:95-104`), one of which hangs locally and six of
  which want a live emulator; `test:automated` is defined as that glob **minus**
  those nine (`automatedTestFiles()`, same file). The split is this repo's own
  documented seam, not one invented for the audit. Building a new per-file
  timeout runner was rejected — a new runner inside an auditing phase, whose
  results would match neither existing npm script.

- **D-13 — Broker-down is an asserted, recorded precondition of the gate run, not
  a prose instruction and not a scripted kill.** The run checks the broker is
  down before starting and records that state beside the results, so a red is
  never ambiguous between a real failure and a live broker. A scripted stop was
  rejected: the broker runs as a systemd unit in this project, and an audit
  script that tears down the developer's environment is the wrong shape.

- **D-14 — The evidence cites CI's whole-glob green AND the local legs, and
  states the SKIP nuance plainly.** `.github/workflows/ci.yml:130-161` already
  runs `npm test` — the **full** glob, deliberately, decided from run
  32517575905 (2026-08-21) — and records that all nine manual-only files reach
  their default-SKIP branches on the runner. So CI's green proves they **did not
  fail**, not that they exercised anything, and the evidence must say so. Citing
  the CI green alone was rejected: it quietly counts nine SKIPs as coverage,
  which is the exact shape of claim this milestone has already had to correct
  once.

- **D-15 — The evidence artifact carries raw commands, raw output, broker state
  and the commit measured** — under the phase's `evidence/` directory, matching
  how `29-21-SUMMARY.md` recorded its measurements. That is the record this
  milestone's provenance corrections were able to **re-derive from**; a summary
  table of exit codes is not.

### Wiring the new artifacts

- **D-16 — The fate-registry guard gets its own named CI step and its own file
  name, and stays OUT of `src/mcp/vice/package.json`'s `scripts` block.**
  `audit-gate.mjs`'s `D-12-11` states the prohibition and its reason: guard files
  must be invoked directly, as their own file names, never through the broader
  automated-suite entry point. It sits alongside the six existing named steps
  (`check-no-regenerator2000.mjs`, `check-npm-packages.mjs`,
  `check-skill-tool-coverage.mjs`, `check-skill-fork-honesty.mjs`,
  `check-skill-description-overlap.mjs`, `check-skill-cli-invocations.mjs`).
  Making it a plain `*.test.ts` was rejected: `audit-gate.mjs` finds its guard set
  by directory listing, so a new file landing there has effects beyond its own
  assertions.

- **D-17 — The mutation harness is a committed phase instrument, not a CI job.**
  It lives in the repo so a later phase can re-measure, but nothing runs it
  automatically. It mutates files and drives the whole guard set — the wrong
  shape for every-push CI, and its output is an audit measurement rather than a
  pass/fail contract. **The fate registry's guard is what holds the line
  continuously; the harness is what produces the evidence behind a row.**

### Carried forward — already decided, do NOT re-open

- The deletion, the CLI verb split and the dated withdrawal notices landed in
  **Phase 29** (`D-01`, `D-02` of `29-CONTEXT.md`). `CUT-01`, `CUT-02`, `CUT-03`
  and `CUT-05` are discharged there and are not this phase's work.
- `scripts/check-no-regenerator2000.mjs`, its scope predicate (`git ls-files`
  minus the `.planning/` prefix, plus a post-sync read of `packFiles()`'s
  `installer/**` paths) and **both** exemption axes are **built and observed
  biting** on four planted routes plus the exemption non-vacuity plant, with a
  green false-positive control. Audit it; do not re-derive any of it.
- The three by-construction reds (`docs-linerefs`, `docs-dangling-refs`,
  `docs-absorbed-decisions`) were **pre-declared before the deletion** and
  discharged by rewriting content rather than loosening guards. This phase
  re-checks that judgement over the settled tree; it does not re-take it.
- `D-36` stays as **dated history** with an explicit superseded-by fate.
- `absorbed-answer-key.test.ts` was **kept**, not deleted.
- Close with **`--no-archive-phases`**. The deletion is not a route to relaxing
  that constraint.
- Nothing here may be recorded green over a guard that is already red
  (ordering constraint 5 / the `4f048bb` precedent).

### Claude's Discretion

- **`D-01`'s ledger form** — the user answered "You decide". Chosen: registry
  plus derive-from-disk guard, on `audit-gate.mjs`'s `D-12-07` precedent. The
  planner may choose the registry's concrete file format and location; the
  derive-from-disk property and the no-hand-typed-second-list rule are **not**
  discretionary.
- **Todo folding** — the user answered "You decide what's best". Chosen: fold
  BACK-05 only, as a recorded precondition rather than as adopted fix work.
- The harness's concrete invocation surface, the registry's serialization format,
  and the plan/wave decomposition are all open to the planner.

### Folded Todos

- **"BACK-05 D-G ordering test fails deterministically on a live-broker host"**
  (`.planning/todos/pending/`, area `testing`, score 0.6). *Original problem:*
  the BACK-05 ordering test is not flaky — it reds deterministically whenever a
  broker is live on the host, which reads as a spurious failure. *How it fits:*
  it is the recorded reason `D-13`'s broker-down precondition exists. Folded as a
  **known condition of the gate run**, not as adopted fix work — ROADMAP.md
  states this phase contains no build work by design, and fixing the ordering
  test is not this phase's scope. The todo stays open.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` § Phase 32 — the two success criteria, the six Notes
  (especially "Why `CUT-04` stayed here", "The gate … is BUILT, not outstanding",
  and the two deferred guard fates), and Sequencing Rationale constraints 3, 4,
  5, 7 and 8
- `.planning/REQUIREMENTS.md` lines 136-146 — `CUT-04`'s full text with the
  disagreement it resolves (32 test files + 11 `scripts/` files, and the eleven
  guards it names explicitly), and `CUT-06`'s document list
- `.planning/phases/29-the-mcp-surface/29-CONTEXT.md` — `D-01` through `D-06`:
  what was deleted, what was renamed, and why the deletion moved into Phase 29
- `.planning/phases/29-the-mcp-surface/29-VERIFICATION.md` — enumerates the three
  renamed test files individually; the surviving-file predicate depends on it
- `.planning/phases/29-the-mcp-surface/29-21-SUMMARY.md` — quotes every
  measurement command and its raw output; the model for `D-15`'s evidence file,
  and the record the milestone's provenance corrections re-derive from

### The conventions this phase's new artifacts must obey
- `scripts/audit-gate.mjs` — read the header block in full. `D-12-07`
  (derive-from-disk, no hand-typed second list), `D-12-11` (guards invoked as
  their own file names, never from the package `scripts` block), `D-12-14` (no
  waiver file, no env override, no relaxation hatch), and the `--root <dir>`
  testability pattern `D-06` reuses
- `scripts/check-no-regenerator2000.mjs` — the built gate. Its scope predicate
  and both exemption axes are the subject of the audit, not its work
- `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt`,
  `src/mcp/vice/fixtures/planted-removal-fixture.md.txt` — the committed-plant
  shape `D-06` follows

### The close-gate facts
- `src/mcp/vice/test-gate.mjs` lines 95-131 — `MANUAL_ONLY_TESTS` (nine entries)
  and `automatedTestFiles()`. **`test-gate.test.ts`'s drift guard is the single
  source of truth for which files are manual-only; do not write a second list**
- `.github/workflows/ci.yml` lines 130-161 — why CI runs the full `npm test`
  glob rather than `test:automated`, and the recorded evidence (run 32517575905,
  2026-08-21) that all nine manual-only files reach default-SKIP on the runner
- `.github/workflows/ci.yml` lines 190-235 — the six existing named `check-*.mjs`
  CI steps `D-16`'s new step sits alongside

### The `CUT-06` sweep targets
- `.planning/PROJECT.md` — 46 `regenerator2000` mentions, 26 `r2000_`
  occurrences, the constraints and Key Decisions rows, the stale `vice-proxy.ts`
  line citations, and the `D-36` row
- `.planning/ARCHITECTURE.md` — Rule A21. **There is no `ARCHITECTURE.md`
  outside `.planning/`**
- `src/mcp/vice/docs-linerefs.test.ts` — the guard `D-10` widens onto
  `PROJECT.md`
- `THIRD-PARTY-NOTICES.md`, `src/mcp/vice/THIRD-PARTY-NOTICES.md`,
  `installer/THIRD-PARTY-NOTICES.md` — the dual-licence notices ROADMAP.md
  records as remaining **true** for the retained prose
- `README.md`, `docs/stock-vice-parity.md`,
  `docs/phase9-regenerator2000-probe-findings.md`,
  `docs/phase23-real-release-gate-findings.md` — the remaining non-skill,
  non-source mentions

### Project-level constraints
- `CLAUDE.md` — MCP-02's interception constraint and its standing note that the
  four cited line numbers drift every phase and must be re-verified, never
  assumed changed
- `.planning/ENGINEERING_RULES.md` § 20 and § 20.1 — GSD execution isolation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/audit-gate.mjs`'s `--root <dir>` flag** — the working precedent for
  pointing a guard at a synthetic tree without touching real behaviour or reading
  any environment variable. `D-06` and `D-07` both build on it.
- **`src/mcp/vice/fixtures/planted-removal-fixture.{ts,md}.txt`** — committed
  planted-violation text already in the repo, in the exact shape `D-06` needs.
- **`src/mcp/vice/test-gate.mjs`'s `automatedTestFiles()`** — an exported,
  already-drift-guarded derivation of the test set. Any set derivation this phase
  writes should reuse it rather than re-globbing.
- **`scripts/lib/skill-honesty-checks.mjs`, `anno-cli-verbs.mjs`,
  `anno-cli-invocations.mjs`** — the established shape for a `scripts/lib/`
  helper with a committed `.d.mts` sibling, if the harness needs one.
- **In-test non-vacuity assertions** already exist in `skill-attribution`,
  `docs-dangling-refs`, `anno-derivation`, `removal-gate`, `anno-verb-coverage`,
  `absorbed-answer-key`, `spawn-seam`, `acme-gate` and others — useful as a map
  of which guards already know how to fail, even though `D-04` does not accept
  them as the proof.

### Established Patterns
- **Derive from disk, never hand-type a second list** (`D-12-07`). This is the
  single strongest convention in the repo's guard layer and `D-01` is built on
  it.
- **No relaxation hatches** (`D-12-14`) — no waiver file, no env override, no
  skip flag. `D-05`'s typed rows exist so that "cannot be planted" is a *typed
  verdict with its own discharge rule*, never an exemption.
- **Guards are invoked as their own file names** (`D-12-11`), which is why the
  six `check-*.mjs` scripts each have a named CI step and none is in the package
  `scripts` block.
- **Keep-dated over rewrite** for historical records — the verdict already
  reached for `CORE-01` (pinned by `docs-core-value-decision.test.ts`) and for
  `D-36`. `D-08` applies the same rule to the document sweep.
- **Evidence must re-derive** — this milestone has already had to correct figures
  whose provenance did not reproduce, which is why `D-15` demands raw commands
  and output rather than a summary.

### Integration Points
- **`.github/workflows/ci.yml`** — one new named step for `D-16`'s fate guard,
  placed with the existing six `check-*.mjs` steps (lines 190-235). Nothing is
  added to `src/mcp/vice/package.json`'s `scripts` block.
- **`src/mcp/vice/docs-linerefs.test.ts`** — its scanned document set widens to
  include `.planning/PROJECT.md` (`D-10`), under `D-07`'s ordering constraint.
- **`scripts/` and `scripts/lib/`** — where the fate guard and the mutation
  harness land, following the existing `.mjs` + committed `.d.mts` convention.
- **`.planning/phases/32-the-deletion-and-the-grep-gate/evidence/`** — where
  `D-15`'s close-gate record and the sweep's raw output live.

</code_context>

<specifics>
## Specific Ideas

- The phrase that decided `D-01`: `audit-gate.mjs`'s own header — *"duplicating
  it by hand is exactly how a guard can silently drop out of the set this gate
  protects."* The audit's subject is that failure mode, so its own record must
  not reproduce it.
- The distinction `D-04` turns on: *"the guard asserts it can fail"* and *"the
  guard was observed failing against its new subject"* are different claims.
  `CUT-04` asks for the second, which is why existing in-test non-vacuity
  assertions were not accepted as the proof.
- The honesty clause `D-14` insists on: CI's whole-glob green proves the nine
  manual-only files **did not fail**, not that they exercised anything. The
  evidence must say this in words, not leave it inferable.
- The measurements taken at discussion time, for the researcher to re-verify
  rather than trust: 35 tracked non-`.planning` files contain `regenerator2000`;
  `.planning/PROJECT.md` has 46 mentions and 26 `r2000_` occurrences; `CLAUDE.md`
  has 0 and 0; `src/mcp/vice/` holds 126 `*.test.*` files against the
  requirement's historical 32; no `ARCHITECTURE.md` exists outside `.planning/`.

</specifics>

<deferred>
## Deferred Ideas

- **Re-spelling the twelve committed `project.regen2000proj` coverage fixtures**,
  and with them removing `block-class.ts`'s transitional capitalised block-type
  arm and re-pointing `make-coverage-fixtures.mjs`'s frozen writer onto the
  Phase 28 store. ROADMAP.md is explicit that this phase **records the fate**
  against the new trigger and does not perform the re-point. Later work.
- **Fixing the BACK-05 D-G ordering test's live-broker sensitivity** — folded
  here only as a recorded precondition (`D-13`); the fix itself stays out.
- **Diagnosing `vice-proxy.test.ts`'s local hang** so `npm test` means locally
  what it means on CI. Real and worth doing; it is unbounded debugging work
  inside a phase ROADMAP.md says contains no build work by design.
- **Running the mutation harness on a schedule or in CI** to catch a guard that
  is still listed but has quietly become vacuous between phases. `D-17` keeps it
  a phase instrument for now; the drift window it leaves is a known, accepted
  gap.

### Reviewed Todos (not folded)

- **"Correct the false real-corpus claim in research/questions.md"** — document
  honesty work, but about a corpus claim rather than a deleted route. Adjacent to
  `CUT-06`'s subject, not inside it. Folding it would widen the sweep from
  "deleted routes" to "all stale doc claims".
- **"Phase 7 Pitfall 5 overgeneralizes 'text monitor unreachable' and is why the
  `-remotemonitor` port stayed unclaimed"** — doc-accuracy work in `docs/`,
  unrelated to regenerator2000. Same widening objection.
- The remaining six keyword matches (`broker` and `capture` area todos) are
  false positives from generic term overlap and were not considered further.

</deferred>

---

*Phase: 32-the-deletion-and-the-grep-gate*
*Context gathered: 2026-08-31*
