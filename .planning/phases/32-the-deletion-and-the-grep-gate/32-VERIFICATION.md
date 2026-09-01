---
phase: 32-the-deletion-and-the-grep-gate
verified: 2026-09-01T09:10:00Z
status: gaps_found
score: 14/16 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/15
  previous_verified: 2026-09-01T02:20:00Z
  gaps_closed:
    - "Gap 2 (the `--root` seam, 6/8 -> 8/8) — CLOSED. `grep -l -- '--root' scripts/*.mjs` and `grep -l 'parseRootArg(' scripts/*.mjs` now both return the SAME EIGHT files. I drove all four malformed forms against both previously-broken scripts myself: `--root` (valueless), `--root=/tmp`, `--rooot /tmp` and `--root /tmp` each produce a distinct named hard error at exit 1 (`BAD ARGUMENTS -- ...` for the three argv rejections, `REFUSED`/`FAIL` for the containment case). Neither script silently reads the default root on any form any more."
    - "Gap 5 (the tautological completeness guard) — CLOSED, and proven to BITE rather than merely to have been reworded. `audit-root-args.test.ts` now derives its population from the FLAG (`const ROOT_FLAG = \"--root\"`, `src.includes(ROOT_FLAG)` at the `walkRootAcceptingScripts()` read) and MATRIX carries all eight scripts. I planted a ninth root-accepting `scripts/*.mjs` and re-ran the file: 62 tests, 61 pass, 1 FAIL naming `zz-verifier-plant` by name. Removed the plant; back to 62/62 and the tree clean."
    - "Gap 4's SWEEP half — CLOSED. `node scripts/audit-mutation-harness.mjs --all` now runs to completion at HEAD: 61 rows reported in registry order, `counts: measured=35 skipped=26 total=61`, `tree: restored byte-identical to the baseline`. The round-2 abort at planted row 23 is gone, and the 26 evidence-owing-nothing rows are reported as SKIPPED with their verdict named rather than throwing."
    - "Gap 4's SINGLE-ROW half for the row it was named after — CLOSED. `--row scripts/lib/skill-honesty-checks.mjs` now returns `OBSERVED RED ... guard exit status 1 (control exit status 0)`, exit 0, tree restored byte-identical. The `introduced = afterMutation - preExisting` arithmetic is in place at `scripts/audit-mutation-harness.mjs:332-335`, and the failure message no longer tells the operator to edit the recorded evidence."
    - "Truth 13's behaviour-unverified state — CLOSED. The restore-on-signal invariant is now exercised by a real test rather than declared present. `node --test audit-harness-restore.test.ts` = 5 tests, 5 pass, 0 fail, including SIGINT x5 and SIGTERM x5 delivered inside a parent-OBSERVED plant window (the parent reads the mutated bytes off disk before signalling), each recording exit `130` and a byte-identical restore."
    - "Round 2's coincidental-reliance advisory on truth 2 — CLEARED. The undeclared precondition (the evidence is sound only because nobody exercised the harness's defective `--root` path) is now declared MECHANICALLY, not in prose: the harness carries a MATRIX row with a spawned test, so taking it off the strict parser reds `audit-root-args.test.ts`."
  gaps_remaining:
    - "Gap 4's `re-measure ANY row` half — STILL OPEN, narrowed. One of the 35 re-pointed rows (`src/mcp/vice/hop-chain-comments.test.ts`) is still refused by the corrected post-condition, and because `plantRefused` sets `failed`, the whole-set `--all` registry write-back is now permanently unreachable. Honestly logged by the executors as `WINDOWS.md` entry 35, open."
  regressions:
    - "NEW: plan 32-19 exported `plant()` and `restoreAll()` to make the signal handler reachable, but `restoreAll()`'s `restored` latch never resets, so the exit/SIGINT/SIGTERM handlers become permanently disarmed after the first restore. Reproduced independently by me against a scratch root: exit `130`, `pendingRestoreCount()` = 1, and the second plant left ON DISK (`CR-10`)."
gaps:
  - truth: "The recorded evidence is re-runnable by the committed instrument — a reader can re-measure ANY row (plan 32-01 prohibition 1 / verifier truth 14, carried from round 2, narrowed)"
    status: partial
    reason: >-
      The SWEEP half is closed and that is a real advance, measured not read: `--all` reports
      all 61 rows, `measured=35 skipped=26 total=61`, tree byte-identical. What remains is one
      row, and I reproduced its arithmetic by hand rather than trusting either the SUMMARY or
      the review.

      Row `src/mcp/vice/hop-chain-comments.test.ts` plants into
      `src/mcp/vice/absorbed-answer-key.test.ts` with
      `replace = "\n" + find` — the recorded replacement is the recorded find with ONE newline
      prepended. Measured directly against the file at HEAD: `find` occurs exactly 1 time;
      `replace` occurs 1 time BEFORE the mutation and 1 time AFTER it, so
      `introduced = 1 - 1 = 0` and the post-condition throws. The mutation is nevertheless
      REAL and the descriptor is HONEST — I applied it in memory and the file changes, by
      exactly +1 byte. The introduced occurrence textually OVERLAPS the pre-existing one, and
      a subtraction of total counts cannot see an overlap.

      This falsifies, in the merged code, the exact sentence round 2's own gap text prescribed
      as the remedy — "The overlap case is still caught by this form" — and plan 32-15 adopted
      that sentence and reproduced it in the code comment at
      `scripts/audit-mutation-harness.mjs:325-329` ("the narrowing costs nothing"). It does
      cost something: one committed observed red, whose recorded evidence is sound
      (`exitStatus: 1`, `control.exitStatus: 0`), cannot be reproduced by the committed
      instrument.

      SECOND CONSEQUENCE, and it is not cosmetic. `plantRefused` sets `report.failed = true`
      (`:642-643`), `failed` sets `hardFailure = true` (`:924`), and the registry write-back at
      `:958` is guarded by `if (!hardFailure)`. So while this one row stands refused, an
      `--all` sweep can NEVER write the registry. My run printed it verbatim:
      `registry: NOT written (a row's plant was refused; a row was unmeasurable)`.
      The instrument does not lie about it — the four suppression causes are enumerated at
      `:947-956` and the one that fired is named — but the phase's central artefact can no
      longer be regenerated by its own whole-set command.

      WHAT IS NOT WRONG, measured rather than assumed: no false pass is possible (the
      replacer function still guarantees the bytes written equal `replace`), no committed
      record is corrupted (35/35 `observedRed` objects structurally intact, 35 distinct
      excerpts, 35/35 green controls, 35/35 `control.command` equal to `command`), and the
      other 34 rows re-measure. 33 reproduced OBSERVED RED in my sweep; the 34th
      (`scripts/audit-gate.mjs`) came back UNMEASURABLE for an unrelated and transient reason
      — its UNPLANTED control is `node scripts/audit-gate.mjs`, which exits 1 today only
      because `docs-review-disposition.test.ts` is red on the round-3 review's own ids. CONFIRMED
      BY RE-MEASUREMENT: once this document's dispositions took that guard green I re-ran that
      single row and it returned `OBSERVED RED ... guard exit status 1 (control exit status 0)`.
      So the true figure is 34 of 35 re-measurable, and `hop-chain-comments` is the only row
      that is not. (The re-run wrote its `observedRed` back into the registry; I reverted the
      one-line change with `git checkout` and confirmed the tree clean.)
    artifacts:
      - path: "scripts/audit-mutation-harness.mjs"
        issue: ":332-335 — `introduced = afterMutation - preExisting` cannot see a replacement that OVERLAPS its own pre-existing occurrence, so it refuses an honest descriptor; :325-329 — the comment asserts 'the narrowing costs nothing', which is false for this shape; :642/:924/:958 — plantRefused -> failed -> hardFailure permanently suppresses the whole-set registry write-back"
      - path: ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json"
        issue: "the `src/mcp/vice/hop-chain-comments.test.ts` row carries a sound recorded red that the committed instrument now refuses to reproduce"
    missing:
      - "Count introduced occurrences in a way that survives overlap. The count that actually means 'the mutation introduced the recorded replacement' is a per-site check at the match position, not a whole-file difference: apply the replacer, then assert `mutated.startsWith(replace, matchIndex)` and `mutated.length - text.length === replace.length - find.length`. Both facts are exact for overlapping and non-overlapping shapes alike, and both still reject a replacement that never reaches the text."
      - "Correct the `:325-329` comment: state that the subtraction form is blind to an overlapping replacement, and name `hop-chain-comments.test.ts` as the measured case, rather than asserting the narrowing is free."
      - "Separate `plantRefused` from `failed` for write-back purposes, or decide explicitly that a refused row must block the write-back and say so — but do not leave the whole-set regeneration path permanently unreachable without a recorded decision."
      - "Then re-run `--all` once and confirm `measured=35` with 35 OBSERVED RED and the registry written."
  - truth: "The harness's restore machinery cannot be disarmed — every plant that is captured is restored on SIGINT / SIGTERM / uncaught exception / exit (plan 32-19 must-have 1, stated verbatim: 'restores every captured original byte-for-byte')"
    status: failed
    reason: >-
      A REGRESSION introduced by this round's own remedy, and I reproduced it independently
      rather than adopting the review's report of it.

      `scripts/audit-mutation-harness.mjs:169-174` — `let restored = false;` and
      `export function restoreAll() { if (restored) return; restored = true; ... }`. The latch
      is set on the FIRST call and never reset. Plan 32-19 exported `plant()` and
      `restoreAll()` so an in-process driver could reach the real registered handler; the two
      together mean any consumer that completes one restore cycle permanently disarms the
      `exit`, `SIGINT`, `SIGTERM` and `uncaughtException` handlers for the rest of the process.

      MEASURED, against a scratch root outside the repository, with my own driver:
      plant -> `PLANTED_ONE`, `pendingRestoreCount()` = 1;
      `restoreAll()` -> `ORIGINAL`, `pendingRestoreCount()` = 0;
      plant again -> `PLANTED_TWO`, `pendingRestoreCount()` = 1;
      SIGINT -> `EXIT=130`, and `FINAL ON DISK: PLANTED_TWO`.
      The process exited 130 as advertised and left a captured original unrestored, which is
      precisely the half of the plan's must-have that says "restores every captured original
      byte-for-byte".

      SCOPE, measured and stated plainly so this is not read as bigger than it is. The SHIPPED
      CLI PATH IS SAFE and I proved it twice: `main()` calls `revert()` per row (`:362-367`,
      which deletes from `originals` WITHOUT touching the latch) and `restoreAll()` exactly
      once, in the `finally` after the row loop — so the latch is never set while a plant is
      on disk. My own `--all` sweep over all 61 rows finished with
      `tree: restored byte-identical to the baseline` and `git status --porcelain` unchanged.
      The one in-process consumer that exists (`audit-harness-restore.test.ts`) plants once per
      child process and is unaffected — which is exactly why its 5/5 green does not catch this.

      THE ONE-LINE REMEDY IS ALREADY PROVEN BY THE CODE ITSELF. `restoreAll()` ends with
      `originals.clear()` (`:185`), so a second call iterates an empty map and writes nothing
      even with the latch deleted. The latch is therefore redundant for the property it was
      added for AND harmful for the property it breaks. Deleting it keeps the committed WR-03
      test green by construction — which is also the substance of `WR-27`: that test cannot
      distinguish the latch from `originals.clear()`, so it passes while the disarm defect
      stands.
    artifacts:
      - path: "scripts/audit-mutation-harness.mjs"
        issue: ":169-174 — `restored` is a permanent latch, never reset, on a now-EXPORTED restore path; :185 — `originals.clear()` already provides the idempotence the latch was added for"
      - path: "src/mcp/vice/audit-harness-restore.test.ts"
        issue: ":449 — the WR-03 test writes a sentinel between two `restoreAll()` calls, which distinguishes no-op from re-write but NOT latch from `originals.clear()`, so it is green against a live disarm defect"
    missing:
      - "Delete the `restored` latch and the `if (restored) return;` early exit. `originals.clear()` already makes a second call a genuine no-op, and the committed WR-03 sentinel test stays green."
      - "Add the discriminating case to `audit-harness-restore.test.ts`: plant, restoreAll, plant AGAIN, signal — and assert the second plant is also restored. Without it the fix is unguarded and the same regression can return."
      - "Reconcile `.planning/WINDOWS.md`: entry 33's stated content (the restore-on-signal invariant is behaviour-unverified) IS now discharged and the entry can close on that content, but it must not close without a NEW entry opened for this disarm defect."
deferred: []
coincidental_reliance_items: []
review_dispositions:
  note: >-
    Round-3 `32-REVIEW.md` (commit `e35af74`) raised 18 findings AFTER every plan merged.
    Each is dispositioned below on my own measurement, not on the review's say-so. Three were
    put to me as leads: two are CONFIRMED and are carried as this report's two gaps; one is
    confirmed LATENT. This block is what takes `docs-review-disposition.test.ts` back to green.
  findings:
    - id: CR-09
      disposition: CONFIRMED, both halves — carried as gap 1 of this report
      evidence: >-
        Reproduced independently. `hop-chain-comments`'s descriptor measures find=1, replace
        pre=1 post=1, introduced=0, and the mutation is real (+1 byte). `--all` prints
        `registry: NOT written (a row's plant was refused; a row was unmeasurable)`.
        The review's reading is correct; the SUMMARY's is not. Note the code comment at
        `:630-634` and `WINDOWS.md` entry 35 DO record the refusal honestly — what is wrong is
        the arithmetic and the "costs nothing" claim beside it, not the record.
    - id: CR-10
      disposition: CONFIRMED — carried as gap 2 of this report
      evidence: >-
        Reproduced independently against a scratch root with my own driver:
        `FINAL ON DISK: PLANTED_TWO`, `EXIT=130`, `pendingRestoreCount()` = 1 at signal time.
        This contradicts 32-19's SUMMARY claim that the invariant is observed and `WR-03`
        settled. Scope limited and stated in the gap: the shipped CLI path is provably safe.
    - id: CR-11
      disposition: CONFIRMED AS LATENT — not a gap, recorded as a hardening item
      evidence: >-
        `Buffer.from(mutated, "latin1")` does truncate code points above U+00FF while the
        string-level post-condition still counts them, so it would be silent if it fired.
        Measured across the committed corpus: 35 plant descriptors, 0 with any code point
        above U+00FF in `find` or `replace`. Nothing is wrong on disk today. Cheapest fix is
        an assertion that every descriptor is latin1-representable, alongside the gap-1 fix in
        the same function.
    - id: WR-27
      disposition: CONFIRMED — folded into gap 2's `missing`
      evidence: >-
        Read `audit-harness-restore.test.ts:449-508`. The sentinel distinguishes a no-op from
        a re-write, which is what `WR-03` literally asked, but not the latch from
        `originals.clear()`. My `CR-10` repro is the proof: the test is green and the disarm
        defect is live.
    - id: WR-28
      disposition: ACCEPTED as a robustness note, not blocking
      evidence: >-
        The negative control shares the same poll loop as the signal cases; the loop asserts on
        the plant deadline but reads `exited` only in the marker loop above it. Measured: the
        file is 5/5 green and finishes in ~1.95 s, so no flake is observable today. Worth
        tightening when gap 2's discriminating case is added to the same file.
    - id: WR-29
      disposition: CONFIRMED — real, minor
      evidence: >-
        `attributablePorcelainDelta()` at `:174-187` filters new porcelain lines to
        `.planning/`, `scripts/` and the scratch prefix. `src/` is excluded, and `src/` is
        where a mis-contained plant would land. Narrowing the assertion was the right call for
        the pre-existing untracked files; excluding `src/` was one path too many.
    - id: WR-30
      disposition: CONFIRMED — a comment, not code
      evidence: >-
        `.gitignore:57-66` justifies `/.harness-signal-scratch-*/` with a porcelain assertion
        the same round narrowed. The ignore entry is still correct and still needed; only its
        stated reason drifted.
    - id: WR-31
      disposition: CONFIRMED — a docblock over-claim on a guard that is otherwise correct
      evidence: >-
        `audit-root-args.test.ts:641` says "ACCEPTS a root, HOWEVER IT READS IT" while the
        predicate keys on the literal token `--root`. A script reading a root under another
        spelling is invisible. That is still strictly better than round 2's `parseRootArg(`
        predicate — I proved the flag-keyed form BITES on a planted ninth script — so the guard
        is fixed; the sentence over-reaches.
    - id: WR-32
      disposition: ACCEPTED — the decision stands, the basis should name one more fact
      evidence: >-
        `audit-gate.mjs:56-66` records "never writes" as the basis for being wired to the argv
        seam but not to `resolveContainedRoot()`. It does spawn guard suites, so an uncontained
        root is executed rather than merely read. The decision is defensible; the recorded
        basis is incomplete and should say so.
    - id: WR-33
      disposition: ACCEPTED as a predicate-precision note
      evidence: >-
        A text predicate with a known evasion. No live evasion exists in the tree — every
        `check-*.mjs` and both audit scripts are on the seam and the matrix covers 8/8 — so it
        is a hardening item, not a hole with something in it.
    - id: WR-34
      disposition: CONFIRMED — a diagnosis-quality defect, not a safety one
      evidence: >-
        `plant()` resolves the descriptor's `file` through `resolveContainedRoot()` (`:280`),
        so a bad registry `plant.file` is reported in the vocabulary of a `--root` refusal. The
        containment itself is correct and load-bearing; only the message misattributes the
        cause.
    - id: WR-35
      disposition: ACCEPTED — hardening, not a live exposure
      evidence: >-
        `resolveBin()` (`:381`) branches on three conventions and spawns `process.execPath` or
        `npm` with the row's own argv. The registry is a committed, CI-gated artefact, so the
        input is trusted by construction today. An allow-list would make that a property of
        the code rather than of the review process.
    - id: WR-36
      disposition: CONFIRMED — recorded as a WARNING against criterion 1's own standard
      evidence: >-
        Measured: `grep -rln "audit-mutation-harness" src/mcp/vice/*.test.*` returns only
        `audit-root-args.test.ts` and `audit-harness-restore.test.ts`, neither of which
        exercises the corrected post-condition arithmetic, the SKIPPED reporting or the
        plantRefused reporting. All three behaviours are proven only by one-off manual runs
        (the executor's and mine). In a phase whose criterion is "a guard that cannot be made
        to fail has not been re-pointed", the instrument's own new behaviours ship without a
        standing guard. Not a gap on its own; it is why gap 1's `missing` asks for a re-run
        rather than a promise.
    - id: IN-11
      disposition: ACCEPTED — cosmetic
    - id: IN-12
      disposition: ACCEPTED — the six-file CORRECTION block is verbose; the correction itself is genuine and measured (I re-read `scripts/lib/audit-root.mjs:119-135` and the false model citation IS gone, replaced by reported speech so a census for the false sentence returns a real zero)
    - id: IN-13
      disposition: ACCEPTED — stale forward reference, cosmetic
    - id: IN-14
      disposition: ACCEPTED — the attempt-log test's ordering dependence is real; measured 5/5 green with no doubled failure today
    - id: IN-15
      disposition: CONFIRMED — measured. `node scripts/audit-gate.mjs --json --json` is accepted silently at exit 0 while a repeated VALUE flag is a named hard error. An asymmetry in the strict parser worth closing for consistency, with no behavioural consequence today.
---

# Phase 32: The Deletion and the Grep Gate — Verification Report (round 3)

**Phase Goal:** the deletion stays clean — every guard and CI script re-pointed off the
deleted regenerator2000 subject is audited as a set, after the dust has settled, and proven
non-vacuous; and no living document is left pointing a user at a route that no longer exists.

**Verified:** 2026-09-01T09:10:00Z at HEAD `e35af7452f50e680b88e53880b636cfc1c5cc2e9`
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure round 2 (plans 32-15 … 32-19, all merged)

**Broker state, read before any measurement:** `systemctl --user is-active vice-broker` →
`inactive`; `pgrep -af vice-broker` → nothing. Every figure below was taken in that state.

**Tree state:** `git status --porcelain` before and after every command in this verification
shows the same four pre-existing untracked files and nothing else. Every mutation I made —
two registry mutations, one planted ninth script, one harness evidence write — was reverted
and the revert measured.

---

## The headline, stated before the tables

**Round 2's three gaps: two closed outright, one closed by three-quarters.** Gap 2 (`--root`)
is now 8/8 and every malformed form is a named hard error on both previously-broken scripts.
Gap 5 (the tautological completeness guard) is not merely reworded — I planted a ninth
root-accepting script and watched the guard go red naming it. Gap 4's sweep half is closed:
`--all` runs to completion over all 61 rows and leaves the tree byte-identical, which it could
not do at round 2's HEAD.

**And the behaviour-unverified truth is now genuinely observed, not argued.** Truth 13 carried
`⚠️ PRESENT_BEHAVIOR_UNVERIFIED` through two rounds. Plan 32-19 built the in-process driver the
round-2 report asked for, without injecting an `await` into the instrument, and the invariant
is exercised: 10 signal attempts across SIGINT and SIGTERM, each with the parent observing the
plant on disk before signalling, each recording exit `130` and a byte-identical restore. That
is a real advance and I record it as one.

**Two defects survive, and both are in code this round merged.** I put the review's three
BLOCKER leads to my own instruments rather than adopting them:

- **`CR-09` is right and the SUMMARY is wrong.** The overlap case that round 2's own gap text
  promised "is still caught by this form" is not caught — it is *refused*. I measured the
  descriptor by hand: the mutation is real, the descriptor is honest, and
  `introduced = after - before` computes 0 because the introduced occurrence overlaps the
  pre-existing one. One committed observed red is un-reproducible, and the whole-set registry
  write-back is now permanently unreachable.
- **`CR-10` is right and the SUMMARY is wrong.** I reproduced the disarm with my own driver.
  Exit 130, and a captured original left on disk.
- **`CR-11` is right and latent.** 0 of 35 descriptors can trigger it today.

**What I will not do is call the round a failure.** Two of three gaps closed, a two-round
behaviour-unverified truth landed, and a coincidental-reliance advisory hardened into a
mechanical guard is substantial progress. The two remaining defects are precisely scoped, both
have a one-line-class remedy that I verified against the code rather than guessed, and one of
them (`hop-chain-comments`) the executors found themselves and logged as open rather than
absorbing — `WINDOWS.md` entry 35, filed 2026-09-01T07:18Z, before any review existed. That is
the honesty this phase's criterion is about, applied by the people it would have been easiest
for to skip it.

**On the `docs-review-disposition.test.ts` red and criterion 2.** At the moment I started,
`npm run test:automated` was 3009 pass / 2 fail, both traceable to the 18 undispositioned
round-3 finding ids (the second failure is `audit-integrity.test.ts` D-12-02, which refuses a
gated milestone-audit status while any docs guard is red — a cascade, not an independent
failure). This report's `review_dispositions` block is a recognised disposition source under
that guard's own documented rules (source 2: "that phase's own `*-VERIFICATION.md` naming the
id"), and every one of the 18 is dispositioned above on my own measurement. The measured
result after writing is recorded in the Behavioural Spot-Checks table below. I state plainly
that the red was caused by producing a review round, not by the merged plan work, and that
nothing in the merged work was green over a red guard at merge time.

---

## Goal Achievement

### Observable Truths

Truths 1–15 are carried from rounds 1 and 2 so the three rounds compare row by row. Truth 16
is new: it names the defect this round introduced.

| # | Truth | Source | R1 | R2 | R3 | Evidence (measured by me at `e35af74`) |
|---|-------|--------|----|----|----|----------------------------------------|
| 1 | Every guard and CI script pinned to the deleted subject has a recorded fate | ROADMAP SC-1 / CUT-04 | ⚠️ | ✓ | ✓ VERIFIED | Registry census re-derived: 35 `re-pointed` / 19 `kept-unchanged` / 7 `deleted` = 61. Gate green: `setA=43 setB=16 setC=2 total=61 rows=61` |
| 2 | None passes vacuously — each re-pointed guard's planted violation re-run against its NEW subject and observed red | ROADMAP SC-1 / CUT-04 | ✓ | ✓ (coincidental-reliance) | ✓ VERIFIED | 35/35 rows carry a sound `observedRed`: non-zero `exitStatus`, `control.exitStatus === 0`, 35 distinct non-empty excerpts, 35/35 `control.command` byte-identical to `command`, 0 signal artifacts. **Round 2's coincidental-reliance flag is CLEARED** — the undeclared precondition is now a standing spawned MATRIX row |
| 3 | Audited as a set, at once, retrospectively, on the settled tree | ROADMAP SC-1 | ✓ | ✓ | ✓ VERIFIED | `--all` re-run by me: 61 rows in registry order, `measured=35 skipped=26 total=61`, tree byte-identical |
| 4 | The fate guard itself cannot pass vacuously | plan 32-01 | ✓ | ✓ | ✓ VERIFIED | Regression spot-check, 2 registry mutations driven at HEAD: delete-a-row → exit 1; zero an `observedRed.exitStatus` → exit 1. Registry restored, `git diff --stat` empty |
| 5 | No living document points a user at a deleted route | ROADMAP SC-2 / CUT-06 | ✓ | ✓ | ✓ VERIFIED | `check-no-regenerator2000.mjs` exit 0; 157 permanent exemptions; **temporary allow-list asserted EMPTY** |
| 6 | The phase-close gate is re-run and recorded with its broker state | ROADMAP SC-2 (gate half) / plan 32-09 | ✓ | ✓ | ✓ VERIFIED | Broker `inactive`. 7/7 `check-*.mjs` exit 0; `typecheck` exit 0; `docs/tool-support.md` regenerates byte-identical (md5 `bb47448…` before **and** after, `git diff --exit-code` clean); 9 `docs-*.test.ts` run individually — 8 green, 1 red, and that one red is closed by this document's dispositions (measured below) |
| 7 | `PROJECT.md`'s citations, `r2000_*` clause and `D-36` row repaired; `ARCHITECTURE.md` A21 dated-superseded | plan 32-03 / CUT-06 | ✓ | ✓ | ✓ VERIFIED | `PROJECT.md:311` cites `:3050` / `:2985` / `:1529` / `:1505`; `grep -ac docs-r2000-decisions .planning/PROJECT.md` = 0; `ARCHITECTURE.md:231` carries "⚠ SUPERSEDED 2026-08-30" |
| 8 | `docs-linerefs.test.ts` widened onto `PROJECT.md` with a per-document non-vacuity floor | plan 32-04 / D-10 | ✓ | ✓ | ✓ VERIFIED | `SCANNED_DOCS` = `["CLAUDE.md", ".planning/PROJECT.md"]`; `node --test docs-linerefs.test.ts` = 12 pass / 0 fail |
| 9 | The sweep ledger carries one verdict row per swept file, numbers reconciled, no dated record rewritten | plan 32-05 / D-08, D-09 | ✓ | ✓ | ✓ VERIFIED | Untouched this round |
| 10 | Sweep rows, deleted rows, set-B rows and both deferred fates complete; tree left clean | plans 32-06/07/08 | ✓ | ✓ | ✓ VERIFIED | 35 / 19 / 7 = 61 reproduced; porcelain identical before and after every command in this report |
| 11 | D-16's named CI step with `fetch-depth: 0`, no package script, harness in no CI step | plan 32-09 | ✓ | ✓ | ✓ VERIFIED | `ci.yml:258` `node scripts/check-guard-fates.mjs`; `fetch-depth: 0` at `:38`; 0 `guard-fates`/`mutation-harness` entries in either `package.json` |
| 12 | Every `--root` resolved through the strict seam; out-of-repo refused; never a silent default-root read | plan 32-02, Gap 2 | ✗ | ✗ (6/8) | ✓ VERIFIED | **8/8.** `grep -l -- '--root'` and `grep -l 'parseRootArg('` return the same eight files. Four-form matrix driven against both previously-broken scripts, all four named hard errors. Full table below |
| 13 | The harness restores the tree on SIGINT / SIGTERM / uncaught exception / exit (the shipped CLI path) | plans 32-01, 32-06 | ⚠️ | ⚠️ | ✓ VERIFIED | **Behaviourally exercised at last.** `node --test audit-harness-restore.test.ts` = 5/5. 10 signal attempts, each with a parent-observed plant on disk, each exit `130` with a byte-identical restore. Independently corroborated: my own `--all` sweep over 61 rows ended `tree: restored byte-identical to the baseline` |
| 14 | The recorded evidence is re-runnable by the committed instrument — ANY row re-measurable, `--all` completes | plan 32-01 prohibition 1 / ROADMAP SC-1 | — | ✗ | ✗ FAILED (narrowed) | Sweep half CLOSED (61 rows, completes, tree clean). Row half OPEN: `hop-chain-comments` PLANT REFUSED, and `plantRefused → failed → hardFailure` makes the registry write-back permanently unreachable. See Gap 1 |
| 15 | The `--root` completeness guard measures the root-accepting population | plan 32-11 truth 6 | — | ✗ | ✓ VERIFIED | Population keyed on `ROOT_FLAG = "--root"`; MATRIX = 8 rows. **Proven to bite:** I planted a ninth root-accepting script and the file went 61/62 with `zz-verifier-plant` named. Removed; back to 62/62 |
| 16 | The restore machinery cannot be disarmed — every captured plant is restored on signal | plan 32-19 must-have 1 | — | — | ✗ FAILED | `restored` latch never resets on a now-EXPORTED path. Reproduced: exit `130`, `pendingRestoreCount()` = 1, `FINAL ON DISK: PLANTED_TWO`. NEW this round. See Gap 2 |

**Score:** 14/16 truths verified (0 present-but-behavior-unverified; 2 failed).
Round 1 was 10/13, round 2 was 11/15.

---

### The `--root` four-form matrix — the two scripts that were behind, driven by me at HEAD

| Script | `--root` (valueless) | `--root=/tmp` | `--rooot /tmp` | `--root /tmp` |
|---|---|---|---|---|
| `audit-mutation-harness.mjs` | `BAD ARGUMENTS -- \`--root\` requires a directory, but it was the last argument`, exit 1 | `BAD ARGUMENTS -- "--root=/tmp" uses the equals form`, exit 1 | `BAD ARGUMENTS -- unrecognised argument "--rooot"`, exit 1 | `REFUSED -- --root "/tmp" resolves to /tmp, which is OUTSIDE the repository root`, exit 1 |
| `audit-gate.mjs` | `BAD ARGUMENTS -- \`--root\` requires a directory…`, exit 1 | `BAD ARGUMENTS -- "--root=/tmp" uses the equals form`, exit 1 | `BAD ARGUMENTS -- unrecognised argument "--rooot"`, exit 1 | `FAIL`, exit 1 (uncontained by design, plan 32-16 — see `WR-32`) |

Round 2 measured three identical full real-tree runs from `audit-gate.mjs` on the first three
of these, and a real-registry read from the harness on the first. None of that reproduces now.

---

### The hop-chain overlap, derived rather than quoted

I applied the descriptor in memory against the file at HEAD rather than reading either the
SUMMARY or the review.

```
plant.file    = src/mcp/vice/absorbed-answer-key.test.ts
plant.find    = "// src/mcp/vice -> repo root -> .planning/phases/11-.../evidence/criterion1"
plant.replace = "\n" + plant.find            <- the find with ONE newline prepended

find occurrences            : 1
replace occurrences BEFORE  : 1
replace occurrences AFTER   : 1
introduced (after - before) : 0     -> post-condition throws
file actually changed?      : true, by exactly +1 byte
recorded observedRed        : exitStatus 1, control.exitStatus 0
```

The descriptor is honest, the mutation is real, and the recorded red is sound. The arithmetic
is what cannot see it. This is the case round 2's own prescribed remedy asserted was still
caught, so the defect is inherited from the gap text, not invented by the executor — and the
executor found it, recorded it in the code comment at `:630-634`, and filed it as an open
`unmet-truth` rather than absorbing it.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/lib/audit-root.mjs` | strict `parseRootArg` with declared `valueFlags`, `resolveContainedRoot`, `splitReadRefusalReason` | ✓ VERIFIED | Value flags land; the false model citation at `:119-122` is replaced by reported speech so a census for the false sentence returns a real zero. `WINDOWS.md` entry 37 (a stale `audit-gate.mjs:1147-1151` citation at `:13`) is still open and honestly logged |
| `scripts/audit-mutation-harness.mjs` | corrected post-condition, strict argv, SKIPPED/plantRefused reporting, three exports | ⚠️ PARTIAL | Argv ✓ (8/8 seam), SKIPPED ✓, plantRefused reporting ✓, sweep completes ✓. Post-condition arithmetic still refuses an overlap (Gap 1); `restored` latch disarms the handlers (Gap 2) |
| `scripts/audit-gate.mjs` | wired to the argv seam, uncontained by recorded decision | ✓ VERIFIED | `parseRootArg` at `:1170`, `--json`/`--hook` as `booleanFlags`, hand-rolled reader gone. Round 2's ⚠️ ORPHANED FROM THE SEAM is resolved |
| `src/mcp/vice/audit-root-args.test.ts` | flag-derived population, 8-row matrix, split-read contract | ✓ VERIFIED | 62 tests, 62 pass. Population walk is `latin1` (NUL-safe) and cross-checked against a spawned shell glob — a deliberately different mechanism, not a second `readdirSync` |
| `src/mcp/vice/audit-harness-restore.test.ts` | signal-window driver, byte-identical restore, WR-03 latch | ⚠️ PARTIAL | 537 lines, 5/5 green, and the driver is genuine (parent reads the mutated bytes off disk before signalling). Blind to the disarm defect (`WR-27`); porcelain attribution excludes `src/` (`WR-29`) |
| `.planning/phases/…/guard-fates.json` | 61 rows, all fates recorded | ✓ VERIFIED | 35/19/7; 35/35 sound observed reds; 35 distinct excerpts |
| `.planning/WINDOWS.md` | the round's open items honestly logged | ✓ VERIFIED | Entry 35 (hop-chain, open) filed at 07:18Z, before any review existed. Entry 33 (restore-on-signal) still open — see the assessment below. Entries 34, 36, 37 recorded as deviations |
| `.planning/REQUIREMENTS.md` | `CUT-04` / `CUT-06` traceable and undemoted | ✓ VERIFIED | Both `[x]`, both `Complete`, both mapped to Phase 32, non-demotion note at `:145` |
| Automated coverage for plan 32-15's three harness behaviour changes | a standing guard | ✗ MISSING | `WR-36`, confirmed by census. Recorded as a WARNING, not a gap |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| all EIGHT root-accepting `scripts/*.mjs` | `scripts/lib/audit-root.mjs` | `import { parseRootArg }` | ✓ WIRED | 8 of 8. Round 2's two NOT WIRED links are both closed |
| `src/mcp/vice/audit-root-args.test.ts` | the root-accepting population | `src.includes(ROOT_FLAG)` on a `latin1` read | ✓ WIRED (correct source) | Round 2's ✗ WRONG SOURCE is closed; proven by a planted ninth script |
| `src/mcp/vice/audit-harness-restore.test.ts` | the harness's REAL registered handler | in-process driver + three exports, no injected `await` | ✓ WIRED | `grep -n 'await\|async \|\.then(' … \| grep -vE ':[[:space:]]*(//\|\*)'` exits 1 with no output — the instrument is still wholly synchronous |
| `scripts/audit-mutation-harness.mjs` | `guard-fates.json` | reads descriptors, writes back `observedRed` | ⚠️ PARTIAL | Per-row write-back works (I re-measured one row end to end). Whole-set write-back is unreachable while any row refuses |
| `restoreAll()` | the `exit`/`SIGINT`/`SIGTERM`/`uncaughtException` handlers | `process.on(...)` at `:200-211` | ⚠️ DISARMABLE | Registered and reached — exit 130 observed — but permanently no-op after the first restore |
| `ci.yml:258` | `scripts/check-guard-fates.mjs` | named CI step, `fetch-depth: 0` | ✓ WIRED | Unchanged |

---

### Behavioural Spot-Checks

All at HEAD `e35af74`, broker `inactive`, from a clean tree.

| # | Behaviour | Command | Result | Status |
|---|---|---|---|---|
| 1 | The fate gate is green | `node scripts/check-guard-fates.mjs` | exit 0, `setA=43 setB=16 setC=2 total=61 rows=61` | ✓ PASS |
| 2 | All CI check scripts green | each `scripts/check-*.mjs` | 7/7 exit 0 | ✓ PASS |
| 3 | `docs/tool-support.md` byte-identical | `node scripts/generate-tool-support-table.mjs` | md5 `bb4744890855e58887142e5a97f44fc0` before and after; `git diff --exit-code` clean | ✓ PASS |
| 4 | Removal gate green tree-wide | `node scripts/check-no-regenerator2000.mjs` | exit 0; 157 permanent exemptions; temporary allow-list EMPTY | ✓ PASS |
| 5 | Typecheck | `npm run typecheck` | exit 0 | ✓ PASS |
| 6 | The nine `docs-*.test.ts` guards, individually | `node --test docs-<name>.test.ts` ×9 | 8 green; `docs-review-disposition` 6 pass / 1 fail, naming exactly the 18 round-3 ids and no others | ✗ FAIL → closed by this document (row 13) |
| 7 | `test:automated` | `npm run test:automated` | 3017 tests, 3009 pass, **2 fail**, 1 skipped, 5 todo. Both failures are the disposition guard and the D-12-02 cascade off it | ✗ FAIL → closed by this document (row 13) |
| 8 | **Gap 4, single row** — the row `CR-06` was named after | `--row scripts/lib/skill-honesty-checks.mjs` | `OBSERVED RED … guard exit status 1 (control exit status 0)`, exit 0, tree restored byte-identical | ✓ PASS (round-2 defect fixed) |
| 9 | **Gap 4, whole set** — does `--all` complete? | `--all --out <scratch>` | 61 rows in registry order; `measured=35 skipped=26 total=61`; `tree: restored byte-identical to the baseline`; exit 1 | ✓ PASS for completion |
| 10 | …and what did the 35 measured rows say? | (same run) | **33 OBSERVED RED**, 1 PLANT REFUSED (`hop-chain-comments`), 1 UNMEASURABLE (`audit-gate`) | ⚠️ PARTIAL — Gap 1 |
| 10b | Was `audit-gate`'s UNMEASURABLE really just the disposition cascade? | re-ran `--row scripts/audit-gate.mjs` after this document took the docs guards green | `OBSERVED RED … guard exit status 1 (control exit status 0)`. **34 of 35 rows re-measure; only `hop-chain-comments` does not** | ✓ PASS (diagnosis confirmed) |
| 11 | Does `--all` write the registry? | (same run) | `registry: NOT written (a row's plant was refused; a row was unmeasurable)` | ✗ FAIL — Gap 1 |
| 12 | **Gap 2** — the four-form matrix on the two behind scripts | 8 invocations | 8/8 named hard errors at exit 1 | ✓ PASS (round-2 defect fixed) |
| 13 | **Gap 5** — does the completeness guard bite? | plant `scripts/zz-verifier-plant.mjs` containing `--root`, re-run `audit-root-args.test.ts` | 62 tests, 61 pass, **1 fail** naming `zz-verifier-plant`. Plant removed → 62/62, tree clean | ✓ PASS (round-2 defect fixed) |
| 14 | **Truth 13** — restore-on-signal | `node --test audit-harness-restore.test.ts` | 5 tests, 5 pass. SIGINT ×5 + SIGTERM ×5, each exit `130`, each byte-identical | ✓ PASS (two-round item landed) |
| 15 | **CR-10** — is the restore machinery disarmable? | my own driver: plant → `restoreAll()` → plant → SIGINT | `EXIT=130`; `pendingRestoreCount()` = 1; `FINAL ON DISK: PLANTED_TWO` | ✗ FAIL (defect reproduced) — Gap 2 |
| 16 | **CR-11** — is the `latin1` truncation live? | census of all 35 descriptors for code points > U+00FF | 35 descriptors, **0** affected | ✓ PASS (latent only) |
| 17 | **CR-09** — is the overlap refusal real? | apply the `hop-chain-comments` descriptor in memory | find=1, replace pre=1 post=1, introduced=0, file changes by +1 byte | ✗ FAIL (defect reproduced) — Gap 1 |
| 18 | **WR-36** — coverage for 32-15's behaviour changes | `grep -rln audit-mutation-harness src/mcp/vice/*.test.*` | 2 files, neither covering the post-condition, SKIPPED or plantRefused paths | ✗ FAIL (WARNING) |
| 19 | Fate-guard non-vacuity regression | 2 registry mutations | 2/2 exit 1; registry restored, `git diff --stat` empty | ✓ PASS |
| 20 | **Criterion 2's gate half, after this document's dispositions** | `node --test docs-review-disposition.test.ts` and `audit-integrity.test.ts` | *measured after writing — see the note directly below this table* | — |

**Row 20, measured after this file was written.** Both previously-red assertions go green with
this document in place: `docs-review-disposition.test.ts` = 7 pass / 0 fail, and
`audit-integrity.test.ts`'s D-12-02 assertion passes. That makes **9/9 `docs-*.test.ts` guards
green** and takes `test:automated` to **3017 tests, 3011 pass, 0 fail, 1 skipped, 5 todo** (exit 0), which is criterion 2's phase-close gate
half met — by disposition, and every disposition is my own measurement rather than an
acknowledgement. Recorded transparently: the guard's rule is that a finding id must be
*mentioned* in a recognised source, and the reason it is deliberately weak is stated in its own
header — it catches silence, not disposition quality. Two of the ids it now sees are carried as
this report's two open gaps, so nothing is being closed by being written down.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| `CUT-04` | 32-01…32-19 (`requirements: [CUT-04]`, `[CUT-04, CUT-06]`) | Every guard and CI script pinned to the deleted subject has a recorded fate and none passes vacuously | ⚠ **SATISFIED WITH ONE NAMED EXCEPTION** | 61/61 fates recorded; 35/35 sound machine-captured reds with green controls; whole-set sweep completes; fate guard non-vacuous under 2/2 mutations; completeness guard proven to bite. Exception: 1 of 35 rows is not RE-measurable by the committed instrument (Gap 1), honestly logged as `WINDOWS.md` entry 35 |
| `CUT-06` | 32-03, 32-05, 32-09, 32-16, 32-17 | No living document points a user at a deleted route | ✓ **SATISFIED** | Removal gate exit 0 with an EMPTY temporary allow-list; `PROJECT.md`/`ARCHITECTURE.md` repairs in place; both `check-*.mjs` green; `docs/tool-support.md` byte-identical; 9/9 `docs-*.test.ts` green after this document's dispositions |

**Orphan check:** `grep -E "Phase 32" .planning/REQUIREMENTS.md` maps exactly `CUT-04` and
`CUT-06` to this phase, and both are declared in plan frontmatter. **No orphaned requirements.**

**On demotion.** I do **not** recommend demoting either row. `CUT-04`'s substantive claim —
every fate recorded, none vacuous, audited over the whole set at once — is measured true. What
Gap 1 breaks is the *re-runnability* of one row, which is a property of the instrument rather
than of the fate record, and it is already recorded as open beside the work. Demoting a row
whose own audit trail names its exception would punish the disclosure.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/audit-mutation-harness.mjs` | 325-329 | Comment asserts "the narrowing costs nothing", measured false for the overlap shape | ⚠️ Warning | A future reader trusts an arithmetic claim the same file's `:630-634` comment already contradicts |
| `scripts/audit-mutation-harness.mjs` | 169-174 | Permanent latch on an exported cleanup path | 🛑 Blocker | Gap 2 |
| `src/mcp/vice/audit-harness-restore.test.ts` | 179-186 | Porcelain attribution excludes `src/` | ⚠️ Warning | `WR-29`; the tree a mis-contained plant lands in is the one not asserted |
| `src/mcp/vice/audit-root-args.test.ts` | 641 | Docblock claims "HOWEVER IT READS IT" over a literal-token predicate | ⚠️ Warning | `WR-31`; over-claim on an otherwise-correct and proven guard |
| `scripts/lib/audit-root.mjs` | 13 | Stale line citation (`audit-gate.mjs:1147-1151`, now ~1191) | ℹ️ Info | Already logged as `WINDOWS.md` entry 37, open |
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`) in files this phase modified | — | **None.** Scanned `scripts/audit-mutation-harness.mjs`, `scripts/audit-gate.mjs`, `scripts/lib/audit-root.mjs`, `src/mcp/vice/audit-root-args.test.ts`, `src/mcp/vice/audit-harness-restore.test.ts` — zero unreferenced markers |

---

### The `WINDOWS.md` entry 33 question, answered on the evidence

Plan 32-19 asked that entry 33 move to `resolved` and `WR-03` close. The orchestrator declined
to make that edit from its own seat. I was asked to assess whether it *should* close.

**Entry 33's stated content is discharged.** Its text is *"Restore-on-signal invariant still
behaviour-unverified: SIGINT/SIGTERM handlers cannot run mid-plant because main() is wholly
synchronous."* That is no longer true. The window is created outside the instrument, the real
registered handler is reached, and 10/10 attempts across both signals record exit `130` with a
byte-identical restore. On its own words the entry can close.

**But it must not close alone.** `CR-10` shows the invariant the entry is *about* is
conditionally false on the very surface that was added to prove it. Closing entry 33 without
opening a new one for the disarm defect would convert a measured limitation into an
unrecorded one — the exact laundering this phase exists against.

**Recommendation, for the human to action rather than for me to write:** close entry 33 citing
`evidence/32-restore-on-signal.md` and the 5/5 test, and open a new entry for `CR-10` citing
`scripts/audit-mutation-harness.mjs:169-174` and the reproduction in this report. `WR-03`
itself — "is the second `restoreAll()` a genuine no-op?" — **is** settled, and settled well:
the sentinel test distinguishes no-op from re-write, and the answer is yes. It is the latch's
*other* consequence that is unsettled, and that is a different question than the one `WR-03`
asked.

---

### Gaps Summary

Two gaps, both in code merged this round, both precisely scoped, both with a remedy I verified
against the source rather than proposed from expectation.

**Gap 1 — one committed evidence row is un-reproducible, and the whole-set registry write-back
is unreachable.** The corrected post-condition is right for every shape except an overlapping
replacement, and exactly one of the 35 descriptors has that shape. The consequence chain
(`plantRefused → failed → hardFailure → no write-back`) means the artefact at the centre of
`CUT-04` can no longer be regenerated by its own `--all` command. The fix is to stop measuring
the introduction with a whole-file difference: assert the replacement lands *at the match
position* and that the length delta equals `replace.length - find.length`. Both facts are exact
under overlap.

**Gap 2 — the restore machinery is disarmable.** Exporting `plant()` and `restoreAll()` was the
right call and it landed a two-round behaviour-unverified truth. But `restored` is a permanent
latch on a path that is now reachable more than once per process, so the second plant in any
in-process consumer is unprotected. The remedy is to delete the latch: `originals.clear()`
already provides the idempotence it was added for, and the committed WR-03 test stays green by
construction. The discriminating test — plant, restore, plant again, signal — must land with
it, or this returns.

**Grouped by root cause:** the two gaps are independent (one is arithmetic in `plant()`, one is
state in `restoreAll()`), but they live in the same 200 lines of the same file and both need a
new test in a file that already exists. One focused plan can close both.

**Not gaps, recorded so they are not re-litigated:** `CR-11` (latent, 0/35), `WR-36` (no
standing coverage for three harness behaviours — a warning against the phase's own standard,
and the reason Gap 1's remedy asks for a re-run rather than a promise), and the nine
`WR`/`IN` items dispositioned in the frontmatter.

---

_Verified: 2026-09-01T09:10:00Z at `e35af7452f50e680b88e53880b636cfc1c5cc2e9`_
_Verifier: Claude (gsd-verifier), round 3_
