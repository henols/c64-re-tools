---
phase: 32-the-deletion-and-the-grep-gate
verified: 2026-09-01T14:05:00Z
status: passed
score: 17/17 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 14/16
  previous_verified: 2026-09-01T09:10:00Z
  gaps_closed:
    - >-
      Gap 1 (`CR-09` — the plant post-condition could not see an overlapping replacement, one
      committed observed red was un-reproducible, and `plantRefused -> failed -> hardFailure`
      made the whole-set registry write-back permanently unreachable) — CLOSED, and closed on
      MY OWN whole-set measurement rather than on the SUMMARY. `node scripts/audit-mutation-harness.mjs --all`
      at HEAD `048f810`, broker `inactive`: exit 0, `counts: measured=35 skipped=26 total=61`,
      **35 OBSERVED RED / 26 SKIPPED / 0 UNMEASURABLE / 0 REFUSED / 0 ZERO-EXIT**,
      `tree: restored byte-identical to the baseline`, and the final line reads
      `registry: /home/.../guard-fates.json` — a PATH, not `registry: NOT written (...)`.
      The write-back the round-3 report proved unreachable is reached. The row the gap was
      named after, `src/mcp/vice/hop-chain-comments.test.ts`, reports
      `OBSERVED RED ... guard exit status 1 (control exit status 0)` inside that sweep and
      also on its own (`--row`, exit 0). The mechanism is the per-site measurement the gap's
      `missing` asked for, present at `scripts/audit-mutation-harness.mjs:488-491`:
      `matchIndex = text.indexOf(find)`, `mutated.startsWith(replace, matchIndex)`, and
      `actualLengthDelta === expectedLengthDelta` — both exact under overlap.
    - >-
      Gap 2 (`CR-10` / `WR-27` — the module-level `restored` latch permanently disarmed the
      `exit` / `SIGINT` / `SIGTERM` / `uncaughtException` handlers on the newly-exported path)
      — CLOSED. The latch is GONE: `restoreAll()` at `:171-185` has no flag, no counter and no
      size check, and ends with `originals.clear()`, which the header note at `:196-201` names
      as the sole mechanism and forbids duplicating. The discriminating case the gap's
      `missing` asked for exists and is named: `gap 2 / CR-10: SIGINT in the SECOND window --
      after a restore cycle has already completed -- still restores`, plus its SIGTERM twin.
      `node --test audit-harness-restore.test.ts` = **15 tests, 15 pass, 0 fail, 0 skipped**,
      measured by me. The RED capture is committed and real:
      `evidence/32-restore-disarm.md` records `pass 5 / fail 2` against the committed latch
      (§3a), green after deletion (§3b), `pass 5 / fail 2` again against a DELIBERATELY
      RE-INTRODUCED latch (§3c) and `pass 7 / fail 0` once removed (§3d).
    - >-
      `.planning/WINDOWS.md` reconciled exactly as the gap required. Entry 33 `fixed` on its
      stated content; entry 35 `fixed` on the measurement that discharges it; and entry 40
      OPENED for the disarm defect and then `fixed` in the same round with the RED-first
      evidence cited. No entry closed without a successor.
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification:
  - test: >-
      Decide the disposition of the NINE round-4 code-review findings that are recorded OPEN
      in `.planning/todos/pending/2026-09-01-phase-32-review-round-4-nine-open-findings.md`
      (`severity: blocker`), and in particular of `CR-07` (Critical) and `WR-38`. Read that
      todo and `32-REVIEW.md` at `de598f2`, then choose one of: (a) close the phase and carry
      the nine into the milestone backlog, (b) run one more gap-closure round scoped to
      `CR-07` + `WR-38` + `WR-37`, or (c) accept them with a recorded override.
    expected: >-
      A recorded human decision. Neither ROADMAP success criterion is falsified by any of the
      nine — I measured that rather than assuming it — so this is a judgement about acceptable
      residual risk at phase close, not a repair the phase owes. The two facts that make it a
      human call rather than a verifier call: `CR-07` is a **Critical that has now been open
      across three review rounds and was absent from the round-3 report for one full round
      without ever being fixed**, so the record itself failed in the way this phase's own
      criterion 1 exists against; and `WR-38` is a self-applied criterion-1 defect inside the
      phase's own instrument.
    why_human: >-
      Both are latent, not observed. `CR-07` is a scheduling hazard against a **gitignored**
      tree (`installer/skills/`), so no porcelain assertion in the suite can see it and no
      run I can take proves it either way — the suite was green for me and green twice for the
      reviewer. `WR-38` is a judgement about whether a mislabelled assertion inside a
      case-group that DOES bite is acceptable. Neither is decidable by measurement; both are
      decidable by an owner.
review_dispositions:
  note: >-
    Round-4 `32-REVIEW.md` (commit `de598f2`) raised nine findings after both round-3 plans had
    merged. All nine are dispositioned OPEN in the pending todo, which is the disposition
    source `docs-review-disposition.test.ts` documents for exactly this case — and that guard
    is GREEN at HEAD, measured by me (exit 0). I re-measured the three that bear on this
    phase's own criteria rather than adopting the review's or the todo's reading.
  findings:
    - id: CR-07
      disposition: >-
        CONFIRMED AS LATENT, and CARRIED TO THE HUMAN — not closed by me, and explicitly not
        closed by the todo's existence.
      evidence: >-
        The mechanism is real and reads straight off the code: `audit-root-args.test.ts`'s
        adjacency loop spawns `check-skill-cli-invocations.mjs` five times; each spawn takes
        the `P.root === DEFAULT_ROOT` branch and drives an `rmSync` + `cpSync` rebuild of
        `installer/skills/`, which four other test files read under the concurrent runner.
        `installer/skills/` is gitignored, so `attributablePorcelainDelta()` and every other
        porcelain assertion in the suite are blind to it BY CONSTRUCTION. Not observed
        failing: `npm run test:automated` is 3021 pass / 0 fail on the merged tree, and each
        of the four readers is green individually. The RECORD defect is the part I weight
        highest, and I checked the commit trail the todo gives rather than trusting it:
        `05ca6c6` (round 2) raises CR-07, `e35af74` (round 3) does not contain it, `de598f2`
        (round 4) re-raises it. Round 3's report — my own — therefore dispositioned 18 ids and
        not this one, because the review it was reading had dropped it. A Critical stopped
        being counted because it stopped being written down. That is the failure mode
        criterion 1 exists against, applied to the phase's own audit trail.
    - id: WR-38
      disposition: >-
        CONFIRMED — and I reproduced it rather than adopting it. Recorded as a WARNING, not a
        gap, on a measured distinction the finding does not draw.
      evidence: >-
        I patched `plant()` in place to bypass `resolveContainedRoot()` entirely
        (`abs = join(root, descriptor.file)`), ran the driver's escape case against a scratch
        root, and reverted the patch (`git checkout`, tree clean). Result:
        `planted = false`, `refusalMessage = "row ...: plant target /.../plant-contract-escape-target.txt does not exist."`,
        `pendingRestoreCount = 0`. So the assertion at `:1209-1215` labelled
        **"This assertion is the one that must never change"** DOES pass with containment
        removed — the escape target does not exist on disk, so `!existsSync(abs)` refuses the
        plant for an unrelated reason. The finding is factually correct.
        WHAT THE FINDING OMITS, measured in the same run: the CASE GROUP is NOT vacuous. Two
        of its five assertions go red in that state — `assert.match(msg, /OUTSIDE the repository root/)`
        and the ``/`plant\.file`/`` match — because the ENOENT message carries neither. So
        `node --test audit-harness-restore.test.ts` fails with containment removed, and no
        guard here "cannot be made to fail". The defect is a MISLABELLED assertion inside a
        biting group, not a vacuous guard. That is why it is a WARNING and why it is also in
        the human item: the label is a promise the assertion does not keep, in the one file
        whose whole purpose is to keep that kind of promise.
    - id: WR-39
      disposition: CONFIRMED — a docblock over-claim, WARNING.
      evidence: >-
        `attributablePorcelainDelta()`'s docblock (`:232-236`) says the assertion is narrowed
        to "proving the harness did not write outside the scratch root it was pointed at".
        The call sites read porcelain AFTER the child has exited (`:462-464`, `:636`, `:800`,
        `:990`), and the child's exit is precisely when the restore handler under test runs.
        So the property actually asserted is "no write escaped the scratch root AND survived
        restoration" — strictly weaker, and weaker in the exact direction that matters here,
        because a mis-contained plant that the harness then correctly restores is invisible to
        it. Not a live exposure: `WR-29`'s widening (measured against the registry — 23 `src/`
        targets, 10 `scripts/`, 2 `.planning/`, 0 `/fixtures/`) means the filter now admits
        every tree the registry can name. The sentence over-reaches; the filter is right.
        Independently corroborated as NON-vacuous, by accident: my first run of this file
        overlapped my own `--all` sweep and the assertion went red naming
        `M src/mcp/vice/anno-confidence.ts` — a real concurrent plant, caught.
    - id: WR-37
      disposition: CONFIRMED AS LATENT — WARNING, and the narrowest of the three.
      evidence: >-
        Read at the source rather than from the report. Plan 32-15's row-level containment
        wraps `plant()` only (`:793-803`). The UNPLANTED control at `:761` —
        `const control = runGuard(root, row, "control (unplanted)")` — is NOT wrapped, so a
        bad `guard.cwd`, a bad `guard.argv` or a `re-pointed` row that has lost its `guard`
        still throws out of the row loop and aborts the whole sweep, which is the class of
        defect the comment at `:779-792` claims was fixed. Latent today: all 35 re-pointed
        rows carry a valid guard descriptor and my `--all` sweep completed with 0 aborts.
    - id: WR-40
      disposition: ACCEPTED — carried in the todo, no independent measurement taken.
    - id: IN-16
      disposition: ACCEPTED — cosmetic, carried in the todo.
    - id: IN-17
      disposition: ACCEPTED — cosmetic, carried in the todo.
    - id: IN-18
      disposition: ACCEPTED — cosmetic, carried in the todo.
    - id: IN-19
      disposition: ACCEPTED — cosmetic, carried in the todo.
    - id: WR-36
      disposition: >-
        Round 3's standing WARNING — now MOSTLY DISCHARGED, measured. Downgraded from
        "MISSING" to "PARTIAL".
      evidence: >-
        Round 3 recorded that the harness's three new behaviours shipped with no standing
        guard. Plan 32-21 added a standing plant-contract case group to
        `audit-harness-restore.test.ts`: eight named cases now pin the post-condition
        arithmetic, including `overlap-accepted` (the CR-09 shape),
        `substitution-is-verbatim` (the CR-02 pin), `non-latin1-refused` (CR-11) and
        `bad-plant-target-attribution` (WR-34). All eight green in my 15/15 run. What still
        has NO standing coverage is the SWEEP-level reporting — the SKIPPED branch and the
        `plantRefused` branch — which remain proven only by whole-set runs (the executor's and
        mine).
---

# Phase 32: The Deletion and the Grep Gate — Verification Report (round 4)

**Phase Goal (ROADMAP, narrowed by D-01):** every guard and CI script re-pointed off the
deleted regenerator2000 subject is audited as a set, after the dust has settled, and proven
non-vacuous (`CUT-04`); and no living document is left pointing a user at a route that no
longer exists (`CUT-06`).

**Verified:** 2026-09-01T14:05Z at HEAD `048f810`
**Status:** human_needed
**Re-verification:** Yes — round 4, after gap-closure round 3 (plans 32-20 and 32-21, both
merged)

**Broker state, read before any measurement:** `systemctl --user is-active vice-broker` →
`inactive`; `pgrep -af vice-broker` → nothing but my own grep. Every figure below was taken in
that state, because a live broker deterministically reddens the BACK-05 test.

**Tree state:** `git status --porcelain` before and after every command shows the same four
pre-existing untracked files (`docs/dissambler-workflow.md`,
`docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`) and
nothing else. I made four mutations — a harness single-row write-back, a whole-set write-back,
a containment-bypass patch to `plant()`, and a registry row deletion — and reverted and
re-measured every one.

---

## The headline, stated before the tables

**Both of round 3's gaps are closed, and closed on my own measurement, not on the SUMMARYs.**

- **Gap 1 is not merely reported fixed — the whole-set sweep now does the thing round 3 proved
  it could not do.** `--all` at HEAD: exit 0, `measured=35 skipped=26 total=61`, **35 OBSERVED
  RED, 26 SKIPPED, 0 UNMEASURABLE, 0 REFUSED, 0 ZERO-EXIT**, tree byte-identical, and the
  registry line prints a PATH rather than `NOT written (...)`. The row the gap was named after
  now reads `OBSERVED RED`.
- **And the sweep reproduces the committed record exactly.** I parsed the registry the sweep
  wrote against `HEAD:guard-fates.json` field by field: 61 rows both sides, **0 verdict
  changes, 0 exit-status changes, 0 control-status changes**; 27 rows differ in the `excerpt`
  string ALONE, and every one of those differences is Node's test-reporter format (the
  committed excerpts are TAP, captured inside GSD worktrees; mine are the spec reporter). That
  is the strongest form of the phase's central claim available: an independent re-run of the
  committed instrument reproduces every recorded fate.
- **Gap 2's latch is genuinely gone, not renamed.** No flag, no counter, no size check on the
  restore path — `originals.clear()` and nothing else, with a header note that forbids adding
  a second mechanism and says why. The discriminating case pair exists by name and the
  RED-first evidence is committed at four measured states (5/2 against the original latch,
  green, 5/2 against a deliberately re-introduced one, 7/0 clean).

**What I will not do is call this a clean pass.** A round-4 review that ran after both plans
merged raised nine findings including one **Critical**, and I put the three that bear on this
phase's own criteria to my own instruments:

- **`WR-38` is right, and the finding is also incomplete.** I removed containment from
  `plant()` and measured: the assertion labelled *"the one that must never change"* passes.
  But the case group it sits in goes RED anyway — two of its other four assertions fail,
  because the ENOENT refusal carries neither `OUTSIDE the repository root` nor the
  `plant.file` field name. So criterion 1 survives on the standard it sets ("a guard that
  cannot be made to fail has not been re-pointed"): this guard CAN be made to fail. What is
  wrong is a label that promises more than its assertion delivers, in the one file whose job
  is to keep that promise. A WARNING, and named in the human item.
- **`CR-07` is the one I weight highest, and not for its severity.** It is latent — a
  concurrency hazard against a gitignored tree, never observed failing, and structurally
  invisible to every porcelain assertion in the suite. What matters is the record: I traced
  the commit trail myself and it holds — raised in round 2 (`05ca6c6`), **absent from round 3
  (`e35af74`) without ever being fixed**, re-raised in round 4 (`de598f2`). Round 3's report
  is mine, and it did not disposition CR-07 because the review it read had dropped it. A
  Critical stopped being counted because it stopped being written down. That is precisely the
  failure this phase's criterion 1 exists against, and it happened to the phase's own audit
  trail. It is not a gap in the deliverable; it is a decision an owner has to take at close,
  which is why the status is `human_needed` and not `passed`.

**Neither ROADMAP success criterion is falsified by any of the nine.** I state that as a
measured conclusion, not a concession: `CUT-04`'s subject is the 61 registry rows and all 61
re-measure; `CUT-06`'s gate is green with its temporary allow-list asserted empty. The nine
are quality and latency defects in the instrument's own scaffolding.

---

## Goal Achievement

### Observable Truths

Truths 1–16 are carried from rounds 1–3 so all four rounds compare row by row. Truth 17 is new
and names the round-4 concern the coordinator asked me to weigh.

| # | Truth | Source | R2 | R3 | R4 | Evidence (measured by me at `048f810`) |
|---|-------|--------|----|----|----|----------------------------------------|
| 1 | Every guard and CI script pinned to the deleted subject has a recorded fate | ROADMAP SC-1 / CUT-04 | ✓ | ✓ | ✓ VERIFIED | `node scripts/check-guard-fates.mjs` exit 0: `setA=43 setB=16 setC=2 total=61 rows=61` against floors `43/16/2/61`; derived from 273 paths at `0394cbc`; 21 same-path / 15 renamed / 7 gone / 22 raw set-B minus 6 already-claimed / set C from `ROADMAP.md:856` |
| 2 | None passes vacuously — each re-pointed guard's planted violation re-run against its NEW subject and observed red | ROADMAP SC-1 / CUT-04 | ✓ (coincidental-reliance) | ✓ | ✓ VERIFIED | **35/35 OBSERVED RED in my own `--all` sweep**, each with a green unplanted control (`control exit status 0`). Field-by-field diff of the sweep's write-back against `HEAD:guard-fates.json`: 0 verdict changes, 0 exit-status changes, 0 control-status changes |
| 3 | Audited as a set, at once, retrospectively, on the settled tree | ROADMAP SC-1 | ✓ | ✓ | ✓ VERIFIED | One command, one process, all 61 rows in registry order: `measured=35 skipped=26 total=61`, exit 0, `tree: restored byte-identical to the baseline` |
| 4 | The fate guard itself cannot pass vacuously | plan 32-01 | ✓ | ✓ | ✓ VERIFIED | Planted at HEAD: deleted the last registry row → `check-guard-fates: FAIL -- ... rows=60`, naming `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` as having no recorded fate. Registry restored, porcelain clean |
| 5 | No living document points a user at a deleted route | ROADMAP SC-2 / CUT-06 | ✓ | ✓ | ✓ VERIFIED | `check-no-regenerator2000.mjs` exit 0; 157 permanent exemptions in four named categories; **temporary allow-list asserted EMPTY** since 2026-08-30 |
| 6 | The phase-close gate is re-run and recorded with its broker state | ROADMAP SC-2 (gate half) / plan 32-09 | ✓ | ✓ | ✓ VERIFIED | Broker `inactive`. **7/7 `scripts/check-*.mjs` exit 0** and **9/9 `docs-*.test.ts` exit 0**, each run individually by me. `typecheck` exit 0 and `test:automated` 3021 pass / 0 fail (orchestrator, cited) |
| 7 | `PROJECT.md`'s citations and `r2000_*` clause repaired; `ARCHITECTURE.md` A21 dated-superseded | plan 32-03 / CUT-06 | ✓ | ✓ | ✓ VERIFIED | `PROJECT.md:311` cites `:3050` / `:2985` / `:1529` / `:1505`; `grep -c "r2000_" CLAUDE.md` = 0; `ARCHITECTURE.md:231` carries `⚠ SUPERSEDED 2026-08-30 (Phase 29, plan 29-10, commit 1d40ad0)` with the keep-dated rationale |
| 8 | `docs-linerefs.test.ts` widened onto `PROJECT.md` with a per-document non-vacuity floor | plan 32-04 / D-10 | ✓ | ✓ | ✓ VERIFIED | `SCANNED_DOCS = ["CLAUDE.md", ".planning/PROJECT.md"]` at `:64-67`; guard exit 0 |
| 9 | The sweep ledger carries one verdict row per swept file, numbers reconciled, no dated record rewritten | plan 32-05 / D-08, D-09 | ✓ | ✓ | ✓ VERIFIED | Untouched since round 3; registry census reproduced (35 re-pointed / 19 kept-unchanged / 7 deleted = 61) |
| 10 | Sweep rows, deleted rows, set-B rows and both deferred fates complete; tree left clean | plans 32-06/07/08 | ✓ | ✓ | ✓ VERIFIED | 35 / 19 / 7 = 61 reproduced from the JSON; porcelain identical before and after every command in this report |
| 11 | D-16's named CI step with `fetch-depth: 0`, no package script, harness in no CI step | plan 32-09 | ✓ | ✓ | ✓ VERIFIED | Carried from round 3; `ci.yml:258` `node scripts/check-guard-fates.mjs`, `fetch-depth: 0` at `:38` |
| 12 | Every `--root` resolved through the strict seam; out-of-repo refused; never a silent default-root read | plan 32-02, R2 gap 2 | ✗ (6/8) | ✓ | ✓ VERIFIED | **8/8 holds.** `grep -l -- '--root' scripts/*.mjs` and `grep -l 'parseRootArg(' scripts/*.mjs` return the SAME EIGHT files |
| 13 | The harness restores the tree on SIGINT / SIGTERM / uncaught exception / exit (shipped CLI path) | plans 32-01, 32-06 | ⚠️ | ✓ | ✓ VERIFIED | `node --test audit-harness-restore.test.ts` = **15/15**. Corroborated by my 61-row sweep ending `tree: restored byte-identical to the baseline` with porcelain unchanged |
| 14 | The recorded evidence is re-runnable by the committed instrument — ANY row re-measurable, `--all` completes, registry written | plan 32-01 prohibition 1 / ROADMAP SC-1 | ✗ | ✗ (narrowed) | ✓ VERIFIED | **Closed.** `--all` exit 0, `measured=35 skipped=26 total=61`, `registry: <path>`. Per-site post-condition at `:488-491`. `--row hop-chain-comments.test.ts` → `OBSERVED RED`, exit 0 |
| 15 | The `--root` completeness guard measures the root-accepting population | plan 32-11 truth 6 | ✗ | ✓ | ✓ VERIFIED | Carried; population keyed on the literal `--root` flag, MATRIX = 8 rows, guard exit 0 |
| 16 | The restore machinery cannot be disarmed — every captured plant is restored on signal | plan 32-19 must-have 1 | — | ✗ FAILED | ✓ VERIFIED | **Closed.** Latch deleted (`:171-185`, no flag/counter/size check; `originals.clear()` sole mechanism). Two named second-window cases green. RED-first evidence committed at four states in `evidence/32-restore-disarm.md` |
| 17 | The phase's own instrument guards can themselves be made to fail | ROADMAP SC-1, self-applied | — | — | ✓ VERIFIED **with a named exception** | I removed containment from `plant()` and the `bad-plant-target-attribution` case group went RED (2 of 5 assertions). But the single assertion labelled *"the one that must never change"* PASSED in that state — `WR-38`, confirmed by my own measurement. The guard bites; the label over-promises |

**Score:** 17/17 truths verified (0 present-but-behavior-unverified, 0 failed).
Round 1 was 10/13, round 2 was 11/15, round 3 was 14/16.

---

### The whole-set sweep, reproduced independently

```
$ systemctl --user is-active vice-broker      -> inactive
$ node scripts/audit-mutation-harness.mjs --all
  ...
  OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)
                command: node --test hop-chain-comments.test.ts
  ...
  counts: measured=35 skipped=26 total=61
  evidence: .../evidence/32-tracer-observed-red.md
  registry: .../guard-fates.json
  tree: restored byte-identical to the baseline
  EXIT=0

  grep -c 'OBSERVED RED'  -> 35
  grep -c 'SKIPPED'       -> 26
  grep -c 'UNMEASURABLE'  ->  0
  grep -c 'REFUSED'       ->  0
  grep -c 'ZERO-EXIT'     ->  0
```

And the write-back compared field-by-field against the committed registry before I reverted it:

```
rows head/cur: 61 61
differences: {'excerpt-only': 27}
verdict changes: []
exitStatus / control.exitStatus changes: []
```

Twenty-seven excerpts differ and nothing else does. Every one is the same cause: the committed
excerpts were captured under Node's TAP reporter inside GSD worktrees
(`.claude/worktrees/agent-*/`), mine under the spec reporter in the real tree. Same assertion,
same failure, same exit statuses. This is the fact the phase's criterion 1 is actually about,
and it is now demonstrable rather than asserted.

---

### The `WR-38` experiment, in full

I did not take the review's word and I did not take the todo's. I patched the production
function, measured, and reverted.

```
patch:  scripts/audit-mutation-harness.mjs:382
        - abs = resolveContainedRoot(join(root, descriptor.file), { repoRoot: root });
        + abs = join(root, descriptor.file);          // containment removed

run:    node src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs \
            <scratch> bad-plant-target-attribution

result: planted        = false      <- the "must never change" assertion PASSES
        refusalMessage = "row ...: plant target /.../plant-contract-escape-target.txt
                          does not exist."
        pendingRestoreCount = 0

revert: git checkout -- scripts/audit-mutation-harness.mjs ; porcelain clean
```

`planted === false` because `!existsSync(abs)` refuses first — the escape target is a path the
driver never creates. So that assertion is insensitive to the property it is labelled with.

But the refusal message carries neither `OUTSIDE the repository root` nor the `plant.file`
field name, and the same case asserts both. The group therefore FAILS with containment
removed. Criterion 1's standard is met at the level it is written about; the label is what is
wrong.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/audit-mutation-harness.mjs` | per-site post-condition, no restore latch, strict argv, SKIPPED/plantRefused reporting | ✓ VERIFIED | Post-condition at `:488-491` is `indexOf` + `startsWith(replace, matchIndex)` + exact length delta — no regex, exact under overlap. Restore path at `:171-185` has `originals.clear()` and nothing else. Round 3's two ⚠️ PARTIAL causes are both gone. Residual: `WR-37` (the unplanted control at `:761` is outside the row-level containment) — latent |
| `src/mcp/vice/audit-harness-restore.test.ts` | signal-window driver, WR-03 latch case, second-window disarm pair, plant-contract group | ✓ VERIFIED | 15/15 green, 0 skipped, 0 todo. Includes `gap 2 / CR-10` SIGINT and SIGTERM second-window cases and eight plant-contract cases. Residual: `WR-38` (one mislabelled assertion) and `WR-39` (docblock over-claim) — both WARNINGs |
| `src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs` | in-process driver for the plant contract, JSON verdict | ✓ VERIFIED | Nine cases; overlap anchor written so `"\n" + ANCHOR` pre-exists (the CR-09 shape); reports `replacementVerbatimAtMatchIndex` measured on the FILE, plus base64 of both byte states |
| `scripts/lib/audit-root.mjs` | strict `parseRootArg`, `resolveContainedRoot`, `splitReadRefusalReason` | ✓ VERIFIED | 8/8 consumers on the seam. `WINDOWS.md` entry 37 (a stale `audit-gate.mjs:1147-1151` citation at `:13`) is still open and honestly logged |
| `scripts/audit-gate.mjs` | wired to the argv seam, uncontained by recorded decision | ✓ VERIFIED | Exit 0 at HEAD; all nine docs guards green individually |
| `src/mcp/vice/audit-root-args.test.ts` | flag-derived population, 8-row matrix, split-read contract | ⚠️ VERIFIED WITH A WARNING | Guard behaviour correct and green. `CR-07`: its adjacency loop drives five `rm -rf`+rebuild cycles of gitignored `installer/skills/` under a concurrent runner — latent, three rounds open, carried to the human |
| `.planning/phases/…/guard-fates.json` | 61 rows, all fates recorded, all reproducible | ✓ VERIFIED | 61 rows; 35 re-pointed / 19 kept-unchanged / 7 deleted; 35/35 sound observed reds; **all 35 independently re-measured with identical verdicts** |
| `.planning/WINDOWS.md` | the round's items honestly logged, nothing closed without a successor | ✓ VERIFIED | Entry 33 `fixed` on stated content; entry 35 `fixed` on the discharging measurement; entry 40 opened AND fixed in-round with RED-first evidence cited. ℹ Entry 38 ("red by design, plan 32-18 owns the row") still reads `open` although the assertion it describes is green — ledger hygiene, not a defect |
| `.planning/todos/pending/2026-09-01-…-nine-open-findings.md` | every round-4 id dispositioned somewhere | ✓ VERIFIED | All nine ids present with reasons; `docs-review-disposition.test.ts` exit 0 as a result. The todo is a TRACKING record and does not close anything — stated in the file itself and honoured here |
| Standing coverage for the harness's sweep-level reporting (SKIPPED / plantRefused) | a standing guard | ⚠️ PARTIAL | `WR-36` downgraded from MISSING: the plant contract now has eight standing cases. The two sweep-level report branches are still proven only by whole-set runs |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `.github/workflows/ci.yml:258` | `scripts/check-guard-fates.mjs` | named CI step, `fetch-depth: 0` at `:38` | ✓ WIRED | The registry is gated in CI, and the deep fetch the derivation needs is present |
| `scripts/check-guard-fates.mjs` | `guard-fates.json` | reads all 61 rows, enforces four floors | ✓ WIRED | Proven non-vacuous by a planted row deletion at HEAD |
| `scripts/audit-mutation-harness.mjs` | `guard-fates.json` | `--all` re-measures and writes back | ✓ WIRED | Write-back REACHED (round 3: permanently unreachable). 35 rows re-measured, verdicts identical |
| 8 × `scripts/*.mjs` | `scripts/lib/audit-root.mjs` | `parseRootArg()` / `resolveContainedRoot()` | ✓ WIRED | Same eight files on both greps |
| `audit-harness-restore.test.ts` | `scripts/audit-mutation-harness.mjs` | spawned child importing `plant()` / `restoreAll()` / `pendingRestoreCount()` | ✓ WIRED | The child reaches the harness's OWN registered handlers; parent observes the plant on disk before signalling |
| `plant-contract-driver.mjs` | `plant()` | direct in-process import | ✓ WIRED | Nine cases; exercises the corrected post-condition |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `guard-fates.json` | `rows[].observedRed.{exitStatus, excerpt}` | `spawnSync` of the row's own guard command against a planted tree | ✓ — 35/35 re-derived from live subprocess runs by me, verdicts identical | ✓ FLOWING |
| `guard-fates.json` | `rows[].observedRed.control` | `spawnSync` of the SAME command against the unplanted tree | ✓ — 35/35 green controls re-derived | ✓ FLOWING |
| `check-guard-fates.mjs` | derived audited set (61) | `git diff` over two pinned commits (`0394cbc` → `345d5c4`), 273 paths | ✓ — not read from the registry it checks | ✓ FLOWING |
| `check-no-regenerator2000.mjs` | exemption counts (157) | live repository census, four named categories | ✓ — temporary allow-list asserted EMPTY | ✓ FLOWING |

No hardcoded literal, static return, or mock terminates any of these chains.

---

### Behavioural Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Whole-set audit completes and writes back | `node scripts/audit-mutation-harness.mjs --all` | exit 0, `measured=35 skipped=26 total=61`, 35 OBSERVED RED, registry path printed, tree byte-identical | ✓ PASS |
| The row gap 1 was named after re-measures | `node scripts/audit-mutation-harness.mjs --row src/mcp/vice/hop-chain-comments.test.ts` | `OBSERVED RED ... guard exit status 1 (control exit status 0)`, exit 0 | ✓ PASS |
| Re-measurement reproduces the committed record | JSON field diff, sweep write-back vs `HEAD:guard-fates.json` | 61/61 rows, 0 verdict changes, 0 status changes, 27 excerpt-only | ✓ PASS |
| Restore machinery survives a second plant window | `node --test audit-harness-restore.test.ts` | 15 tests, 15 pass, 0 fail, 0 skipped — incl. both `gap 2 / CR-10` second-window cases | ✓ PASS |
| The fate guard reddens on a missing row | delete last registry row, `node scripts/check-guard-fates.mjs` | `FAIL -- ... rows=60`, names the orphaned path | ✓ PASS |
| Containment removal reddens its case group | patch `plant()` to bypass `resolveContainedRoot()`, run driver | `planted=false` (assertion passes — `WR-38`) but message assertions fail → group RED | ✓ PASS (with WARNING) |
| The deleted-route gate is green with an empty temporary allow-list | `node scripts/check-no-regenerator2000.mjs` | exit 0; 157 permanent exemptions; temporary allow-list EMPTY | ✓ PASS |
| Every close-gate script is green | 7 × `node scripts/check-*.mjs` | 7/7 exit 0 | ✓ PASS |
| Every docs guard is green individually | 9 × `node --test docs-*.test.ts` | 9/9 exit 0 | ✓ PASS |
| Full suite / typecheck | `npm run test:automated`, `npm run typecheck` | `tests 3027, pass 3021, fail 0, skipped 1, todo 5`, exit 0; typecheck exit 0 | ✓ PASS (orchestrator, cited, not re-run) |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repository, and neither PLAN nor SUMMARY
declares a probe. This phase's equivalent instrument is `scripts/audit-mutation-harness.mjs`,
and I executed it in my own process rather than reading its recorded output — see the sweep
above. **Step 7c: satisfied by the harness run; no conventional probes to discover.**

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| `CUT-04` | 18 of 21 plans | Every guard and CI script pinned to the deleted subject has a recorded fate and none passes vacuously, measured mechanically | ✓ SATISFIED | 61/61 fates recorded and gate-enforced; 35/35 machine-verified observed reds, all 35 independently re-measured with identical verdicts; the whole-set command completes and writes back |
| `CUT-06` | 12 of 21 plans | Every living document naming regenerator2000 as a required prerequisite is corrected | ✓ SATISFIED | `check-no-regenerator2000.mjs` exit 0 with an EMPTY temporary allow-list; `CLAUDE.md` `r2000_*` count 0; `PROJECT.md:311` citations current; `ARCHITECTURE.md` A21 dated-superseded; all seven skill playbooks pass the gate |

**Orphan check:** `grep -E "^\| [A-Z]+-[0-9]+ \| Phase 32 " .planning/REQUIREMENTS.md` returns
exactly two rows, `CUT-04` and `CUT-06`, both `Complete`. The plans declare exactly those two
ids and no others. **No orphaned requirements.** Both rows carry the non-demotion note at
`:145` explaining the round-1 adjudication.

---

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---|---|---|---|---|
| `src/mcp/vice/audit-harness-restore.test.ts` | CUT-04 | 15 | 0 | No | Behavioral (spawned child, signals, byte comparison, porcelain delta) | ✓ PASS, one insufficient assertion (`WR-38`) |
| `src/mcp/vice/audit-root-args.test.ts` | CUT-04 | 62 | 0 | No | Behavioral (spawned four-form argv matrix) | ✓ PASS, latent concurrency hazard (`CR-07`) |
| 9 × `src/mcp/vice/docs-*.test.ts` | CUT-06 | all green | 0 | No | Value-level document assertions with per-document non-vacuity floors | ✓ PASS |

**Disabled tests on requirements:** 0.
**Circular patterns detected:** 0. The registry is written BY the harness and read BY
`check-guard-fates.mjs`, which could look circular — it is not: the guard derives its expected
population independently from `git diff` over two pinned commits (273 paths at `0394cbc`), and
I proved that derivation bites by deleting a row and watching it name the orphan.
**Insufficient assertions:** 1 (`WR-38`) → WARNING, detailed above.
**Debt markers** (`TBD` / `FIXME` / `XXX`) across the six files this round touched: **0**.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/mcp/vice/audit-harness-restore.test.ts` | 1209-1215 | Assertion labelled "the one that must never change" is insensitive to the property named | ⚠️ Warning | Reproduced by me. The enclosing case group still reddens, so no guard is vacuous — but the label is unearned in the phase's own instrument |
| `src/mcp/vice/audit-harness-restore.test.ts` | 232-236 | Docblock claims a stronger property than the code takes (`WR-39`) | ⚠️ Warning | Porcelain is read post-exit, so the property is "did not escape AND survive restoration". No live exposure |
| `scripts/audit-mutation-harness.mjs` | 761 | Unplanted control run is outside the row-level containment (`WR-37`) | ⚠️ Warning | A bad `guard.cwd`/`argv`/missing `guard` would still abort a whole sweep. Latent — 0 aborts in my 61-row run |
| `src/mcp/vice/audit-root-args.test.ts` | 928-948 | Five `rm -rf`+rebuild cycles of gitignored `installer/skills/` under a concurrent runner (`CR-07`) | ⚠️ Critical, latent | Never observed failing; invisible to every porcelain assertion by construction. Escalated to the human, not treated as a phase gap |
| `.planning/WINDOWS.md` | entry 38 | Ledger row still `open` describing an assertion that is now green | ℹ️ Info | Hygiene; `open_count` overstates by at least one |

**No blocker anti-pattern found.** No unreferenced debt marker exists in any file this phase
modified, and every one of the warnings above is attached to a named finding id with a
recorded disposition.

---

### Human Verification Required

This is an infrastructure/tooling phase with no user-facing surface, so UAT auto-passes. The
single item below is not an invented manual step — it is a decision that measurement cannot
take.

#### 1. Accept, defer or close the nine open round-4 findings — principally `CR-07` and `WR-38`

**Test:** Read
`.planning/todos/pending/2026-09-01-phase-32-review-round-4-nine-open-findings.md`
(`severity: blocker`) and `32-REVIEW.md` at `de598f2`. Then choose:
(a) close the phase and carry the nine into the milestone backlog;
(b) run one more gap-closure round scoped to `CR-07` + `WR-38` + `WR-37`;
(c) accept them with a recorded `overrides:` entry.

**Expected:** A recorded decision. Both ROADMAP success criteria are met — I verified that by
measurement, not by inference — so this is a residual-risk judgement at close, not a repair
the phase owes.

**Why human:** Two facts make it a judgement rather than a measurement.
*First,* `CR-07` is a **Critical open across three review rounds** that **vanished from the
record for one of them** — raised at `05ca6c6`, absent at `e35af74`, re-raised at `de598f2` —
and it went uncounted in round 3 precisely because it went unwritten. That is this phase's own
criterion-1 failure mode, applied to its own audit trail, and whether a phase whose subject is
"nothing passes vacuously" may close over it is an owner's call. Its technical content is
undecidable by measurement anyway: the hazard is against a **gitignored** tree, so no porcelain
assertion in the suite can observe it and the suite is green for everyone who has run it.
*Second,* `WR-38` is a mislabelled assertion inside a case group that DOES bite — I measured
both halves — so whether the label is a defect worth a round or a comment worth a line is a
standards question, not a fact question.

---

### Gaps Summary

**None.** Round 3's two gaps are closed and I closed them on my own instruments:

- **Gap 1 (`CR-09`)** — the arithmetic is replaced by a per-site measurement, the refused row
  now reports `OBSERVED RED`, and the whole-set registry write-back that round 3 proved
  permanently unreachable is reached. The strongest single piece of evidence in this report is
  not the sweep's own output but the field-by-field diff of what it wrote against what was
  committed: **0 verdict changes, 0 exit-status changes** across 61 rows.
- **Gap 2 (`CR-10` / `WR-27`)** — the latch is deleted with nothing put in its place, the
  header note forbids a replacement and says why, and the discriminating second-window pair
  was captured RED against a deliberately re-introduced latch before it was trusted.

What remains are four warnings and one Critical, none of which falsifies a success criterion,
all of which are dispositioned, and two of which are put to the owner because they are
judgements rather than measurements. The phase's deliverable is sound; its residual-risk
decision is not mine to take.

---

_Verified: 2026-09-01T14:05Z at `048f810`, broker `inactive`_
_Verifier: Claude (gsd-verifier), round 4_

---

## Acknowledged Gaps

Recorded by `/gsd-verify-work 32` at phase close (2026-09-01), per the `scan_phase_artifacts`
step. These are open items the operator explicitly chose to carry rather than fix. The
acknowledgement is not implicit: it is the recorded answer to `32-UAT.md` test 1, option **(a)
— close the phase and carry the nine into the milestone backlog**.

| Item | Scope | Severity | Why acknowledged rather than fixed |
|------|-------|----------|-------------------------------------|
| `.planning/todos/pending/2026-09-01-phase-32-review-round-4-nine-open-findings.md` | 9 findings — `CR-07` (Critical), `WR-37`, `WR-38`, `WR-39`, `WR-40`, `IN-16`, `IN-17`, `IN-18`, `IN-19` | blocker | All nine were raised **by** the `execute:post` review that runs after the round-3 gap-closure plans (32-20, 32-21) had already merged, so no plan in that round could have addressed them. Neither ROADMAP success criterion is falsified by any of them — the verifier measured that (17/17 must-haves, `behavior_unverified: 0`). Closing them is a further gap-closure round, not a repair this phase owes. |
| `.planning/todos/pending/2026-08-31-phase-32-review-twenty-five-open-findings.md` | 25 findings — `CR-01`–`CR-04`, `WR-01`–`WR-14`, `IN-01`–`IN-07`; 8 of them (`CR-09`, `CR-10`, `CR-11`, `WR-27`, `WR-28`, `WR-29`, `WR-34`, `WR-36`) were subsequently closed by plans 32-20/32-21 | blocker | Same structure: raised by the advisory review at the tail of the executing round. Dispositioned in the todo rather than by editing a SUMMARY or this file, because those are evidence written by the agent that did the work and editing them from the orchestrator seat to turn a guard green is fact-laundering. |

**The `CR-07` record is the one a future reader should not inherit silently.** It is a
Critical that has now been open across three review rounds, and it was **absent from the
round-3 report for one full round without ever being fixed** (`05ca6c6` raised it, `e35af74`
dropped it, `de598f2` re-raised it). That omission is also why the disposition guard was green
between those two commits — an unresolved Critical stopped being counted because it stopped
being written down. That is precisely the failure mode this phase's own criterion 1 exists
against, which is why it was escalated to a human decision rather than absorbed.

**Security audit intersection (2026-09-01, `32-SECURITY.md`).** All nine were checked against
the 119-row threat register for the single question *"does this falsify a mitigation the
register claims, at severity ≥ high?"* — **none does**. `CR-07` is an *unregistered* flag, not
a falsified mitigation: no register row claims `installer/skills/` is isolated under the
parallel runner, and `installer/scripts/sync-skills.mjs` reads no argv (`DEST` is fixed by
module location), so there is no untrusted-input path — only a concurrency hazard on a
gitignored build artifact. `threats_open: 0` at the `high` block threshold.

**Next round, when it is planned:** scope it `CR-07` + `WR-38` + `WR-37` first, per the
ranking in the round-4 todo — `/gsd-plan-phase 32 --gaps` then
`/gsd-execute-phase 32 --gaps-only`.
