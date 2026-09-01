---
phase: 32-the-deletion-and-the-grep-gate
verified: 2026-09-01T02:20:00Z
status: gaps_found
score: 11/15 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/13
  previous_verified: 2026-08-31T20:10:00Z
  gaps_closed:
    - "Gap 1 — `docs-linerefs` had no recorded fate and no recorded exclusion. CLOSED by adjudication: `evidence/32-audited-set-reconciliation.md` §6.1 resolves all eleven names `CUT-04` lists, under a stated re-runnable basename-equality rule. I re-ran the extraction and the resolver myself: 11 names in, 10 CITED / 1 EXCLUDED / 0 AMBIGUOUS out. The exclusion measurement reproduces (0 occurrences at `0394cbc`, 0 at `345d5c4`, not added between the pins), and the stranger-row claim reproduces too — I planted a hand-written `docs-linerefs` row and the blocking gate went red, exactly as §6.1.4 predicts."
    - "Gap 3 (the `$`-substitution half) — `plant()` now substitutes through a replacer function and asserts a post-condition before writing. I re-ran the affected row through the fixed harness in the main checkout: it reproduced the recorded evidence exactly (same two failing subtests, same `'$0D011' !== '$D011'`, same green control), differing only in timing figures and worktree-vs-main absolute paths."
    - "Gap 3 (the signal half) — `runGuard()` no longer maps a signal-terminated child to exit 1; it returns `status: null, terminatedBySignal: true` and the row is recorded UNMEASURABLE. Observed against a scratch root by plan 32-14 pre-fix and post-fix, both readings recorded."
  gaps_remaining:
    - "Gap 2 — PARTIAL. Six of the EIGHT root-accepting scripts are now on the shared strict parser and the split read is settled for the four affected gates. But two scripts still hand-roll `--root` and still silently fall back to the default root, and one of them is the instrument that produces this phase's entire observed-red evidence."
  regressions:
    - "NEW: the post-condition added to close Gap 3 makes a committed evidence row un-re-measurable by the committed instrument, and aborts any `--all` sweep at planted row 23 of 35 (`CR-06`). Reproduced by one command."
    - "NEW: the completeness guard added to keep the `--root` matrix from falling behind derives its population from the REMEDY (`parseRootArg(`) rather than the FLAG (`--root`), so the only two scripts that are behind are the only two it cannot see (`CR-08`). Measured: 8 accept `--root`, 6 contain `parseRootArg(`."
gaps:
  - truth: "Every `--root` argument is resolved through `resolveContainedRoot()` and an out-of-repo root is refused with a diagnosable message, never a silent read of the default root (verifier truth 12, carried from round 1)"
    status: partial
    reason: >-
      Reproduced live in the main checkout at HEAD `05ca6c6`. The round-1 gap named SIX
      hand-rolled `parseArgs()` copies and cited `scripts/audit-mutation-harness.mjs` as
      "the model" that "already gets this right". Measured, the population is EIGHT, not
      six, and the model carries half the defect it was cited for.
      `grep -l -- '--root' scripts/*.mjs` returns 8 files; `grep -l 'parseRootArg(' scripts/*.mjs`
      returns 6. The two invisible ones are `scripts/audit-gate.mjs` and
      `scripts/audit-mutation-harness.mjs`.
      MEASURED, not inferred — the harness's reader does reject an unrecognised token, but a
      VALUELESS `--root` still yields `root === undefined`, which `resolveContainedRoot()`
      maps to the default root with no message:
      `node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --root`
      -> "row selection: "src/does/not/exist.ts" matched 0 registry row(s)", exit 1. Reaching
      row selection means it had ALREADY loaded the real repository's `guard-fates.json`.
      Nothing in the output mentions `--root`. The control run without the flag prints the
      identical message; the run with `--root /tmp` prints REFUSED, so the space form works
      and the defect is exactly the valueless path.
      The same reader also swallows a following flag as its value:
      `node scripts/audit-mutation-harness.mjs --root --row src/does/not/exist.ts`
      -> `unrecognised argument "src/does/not/exist.ts"` — `--row` was consumed as the root.
      `scripts/audit-gate.mjs` is worse: `--root=/tmp`, a bare `--root` and `--rooot /tmp` all
      produce the FULL real-tree gate report, because an unrecognised token is dropped and a
      valueless flag falls through. Three invocations, three identical real-tree runs.
      Compounding it, `scripts/lib/audit-root.mjs:119-122` cites the harness's reader as
      "the one copy that DID throw on an unrecognised token ... That is the model that was
      not reused; it is reused here" — a live docblock claim about a file that still carries
      the defect.
    artifacts:
      - path: "scripts/audit-mutation-harness.mjs"
        issue: "parseArgs() reads `root = argv[i + 1]` with no missing-value check; zero occurrences of `parseRootArg`. This is the ONE instrument in the phase that both MUTATES the tree and WRITES the registry and the evidence file."
      - path: "scripts/audit-gate.mjs"
        issue: "argv[i] === \"--root\" at :1123 with the same missing-value hole, plus silent drop of any unrecognised token; zero occurrences of `parseRootArg`."
      - path: "scripts/lib/audit-root.mjs"
        issue: ":119-122 records the harness's reader as the model that was reused everywhere — it was not reused in the file it was taken from, and that file is still defective."
    missing:
      - "Wire `scripts/audit-mutation-harness.mjs` to `parseRootArg()`. Its `--row`, `--rows` and `--out` are value-taking flags the shared parser does not know about, so either extend it with a declared `valueFlags` list (supplied in code, never from argv) or apply the same three rules — missing value, value starting with `--`, repeated flag — to each of them."
      - "Wire `scripts/audit-gate.mjs` to `parseRootArg()`, preserving its existing flags through `booleanFlags`."
      - "Correct the false model citation at `scripts/lib/audit-root.mjs:119-122` once the harness is fixed, or delete the sentence."
  - truth: "The completeness guard added to keep the `--root` matrix from falling behind measures the root-accepting population (plan 32-11 truth 6, `gaps[1].missing[2]` stated verbatim: \"At least one spawnSync test per --root-ised script\")"
    status: failed
    reason: >-
      The guard is the one mechanism the round added so a future root-accepting script cannot
      ship untested. Measured at HEAD, it cannot see either of the two that are behind TODAY.
      `src/mcp/vice/audit-root-args.test.ts:423` derives the population as
      `if (src.includes("parseRootArg(")) out.push(...)` — the REMEDY, not the FLAG. So the
      set it compares against MATRIX is "scripts that already use the seam", which is
      tautologically the set MATRIX covers.
      Measured: `grep -l -- '--root' scripts/*.mjs | wc -l` = 8;
      `grep -l 'parseRootArg(' scripts/*.mjs | wc -l` = 6. The two invisible scripts are
      exactly `audit-gate.mjs` and `audit-mutation-harness.mjs`, i.e. exactly the two behind.
      The file's own docblock at `:294-296` asserts the opposite in two places: "The table
      below is the whole population", and "a seventh root-accepting script added later fails
      this file by omission rather than passing unnoticed". Both are false as measured, and
      the second is false in the present tense, not only hypothetically — the seventh and
      eighth already exist and already pass unnoticed.
      This is a guard added by a phase whose success criterion is "none passes vacuously",
      which passes vacuously with respect to its own stated purpose.
    artifacts:
      - path: "src/mcp/vice/audit-root-args.test.ts"
        issue: ":423 — population predicate is `src.includes(\"parseRootArg(\")`; :294-296 — docblock claims that population is complete and that a new root-accepting script would fail the file. Neither holds."
    missing:
      - "Derive the population from the FLAG: a `scripts/*.mjs` whose source contains the token `--root` is a member, whether or not it uses the seam."
      - "That change reds the guard immediately with `audit-gate` and `audit-mutation-harness` named — which is the correct outcome, and the same one Gap 2 above asks for. Do not add an exclusion list to keep it green."
      - "Correct the two docblock sentences at :294-296 to state what the guard actually measures."
  - truth: "The recorded observed-red evidence is re-runnable by the committed instrument — a reader can re-measure any row, and a whole-set `--all` sweep completes (plan 32-01 prohibition 1's own promise; ROADMAP SC-1 'audited over the whole re-pointed set at once')"
    status: failed
    reason: >-
      A REGRESSION introduced by this round's own Gap-3 remedy. The write itself is now
      correct; the post-condition guarding it is not.
      `scripts/audit-mutation-harness.mjs:219` computes
      `const applied = mutated.split(descriptor.replace).length - 1` — the number of
      occurrences of the replacement string in the WHOLE mutated file, not the number the
      plant introduced — and throws unless it is exactly 1.
      Reproduced by me at HEAD, one command, tree clean before and after:
      `node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs`
      -> "plant post-condition FAILED ... the recorded `replace` string occurs 2 time(s) in
      the mutated text, expected exactly 1 ... Nothing was written. Fix the descriptor rather
      than the assertion (CR-02)." exit 1.
      That row's descriptor is honest: `find` occurs exactly once, the mutation is
      unambiguous, and the recorded find/replace IS what a reader would apply by hand. The
      un-negated `replace` form simply already occurs once elsewhere in the target file.
      Two consequences, both inside `CUT-04`'s own subject matter:
      (a) that row is registry index 23 of 61 and planted row 23 of 35, and the plant throw is
      caught by `main()`'s try/catch at :718 which calls `restoreAll()` and `process.exit(1)` —
      so an `--all` sweep ABORTS there, leaves the 12 planted rows after it unmeasured, and the
      registry write-back at :734 is never reached. The whole-set re-run the phase's central
      claim rests on cannot complete at HEAD.
      (b) the failure message instructs the operator to "Fix the descriptor rather than the
      assertion" — i.e. to alter honest recorded evidence to satisfy an incorrect check. In a
      repository whose stated value is that its audit instruments do not lie, an instrument
      that tells you to edit the evidence is worse than one that is merely wrong.
      SCOPE LIMIT, measured rather than assumed: this cannot produce a FALSE PASS (the
      replacer function guarantees the bytes written equal `replace`), and it corrupts no
      committed record — all 35 `observedRed` objects are structurally intact and I reproduced
      one end to end. It is over-strictness that invalidates re-runnability, which is exactly
      what `CUT-04` promises a later reader.
      Pre-existing? No. `git show 371750e:scripts/audit-mutation-harness.mjs` contains zero
      occurrences of "post-condition"; the check is new in `7638c6f` (plan 32-14).
    artifacts:
      - path: "scripts/audit-mutation-harness.mjs"
        issue: ":219-229 — post-condition counts total occurrences of `replace` in the file instead of occurrences the mutation introduced; :718 — the resulting throw aborts the whole sweep and suppresses the registry write-back at :734"
      - path: "scripts/lib/skill-honesty-checks.mjs"
        issue: "the row whose honest descriptor the instrument now refuses (registry index 23 of 61, planted row 23 of 35)"
    missing:
      - "Count what the mutation INTRODUCED, not what the file contains: `const before = text.split(descriptor.replace).length - 1; const applied = mutated.split(...).length - 1; if (applied - before !== 1) throw`. The overlap case is still caught by this form."
      - "Re-word the failure message so it does not instruct a reader to edit recorded evidence."
      - "Re-run `node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs` and confirm the recorded red still reproduces; then run `--all` once to prove the whole-set sweep completes."
deferred: []
behavior_unverified_items:
  - truth: "A harness run interrupted by SIGINT or SIGTERM while a plant is on disk restores every captured original byte-for-byte, exits 130, and leaves `git status --porcelain` byte-identical to its pre-run value; the second `restoreAll()` the exit handler makes after the signal handler's is a no-op rather than a re-write"
    test: >-
      Drive `node scripts/audit-mutation-harness.mjs --row <row>` to the window between
      `plant()` and the finally-revert and deliver SIGINT, then SIGTERM. Plan 32-14 attempted
      this mechanically ten times per signal against a scratch root using an observable rather
      than a timer, and MEASURED WHY it cannot be landed from outside: `main()` is wholly
      synchronous, so the JS event loop never turns between the plant and the revert and a
      JS-level signal handler cannot run mid-plant. 10/10 attempts exited 0 via the ordinary
      `finally` path, never 130. Landing it needs either an in-process driver (the harness
      exports nothing today) or an injected `await` in the plant window.
    expected: >-
      Exit 130 for the signals, every planted file byte-identical to its pre-run bytes,
      `git status --porcelain` byte-identical to the baseline, and the second `restoreAll()`
      a no-op rather than a re-write.
    why_human: >-
      A cancellation/cleanup invariant. The handlers are PRESENT and WIRED
      (`process.on("exit"|"SIGINT"|"SIGTERM"|"uncaughtException", ...)` at :103-114) and the
      NORMAL path is proven — I ran the harness against a live row at HEAD and the tree came
      back byte-identical, and :766/:769 void the evidence and exit 1 on a dirty tree. The
      SIGNAL path is exercised by no test, and the safety property held every time it was
      measured but via the ordinary `finally` path, not via the handler. `WR-03`'s doubt about
      the `restored` latch is therefore unsettled rather than resolved. Recorded as broken-
      windows entry 33.
coincidental_reliance_items:
  - truth: "None passes vacuously — each re-pointed guard's own planted violation re-run against its NEW subject and observed red"
    reason: undeclared-precondition
    harden: >-
      All 35 recorded reds were captured with `plant.kind === \"worktree\"` and with `--root`
      absent from `guard.argv` in 0 of 61 rows — i.e. the evidence is sound BECAUSE nobody
      exercised the defective `--root` path of the instrument, not because that path is safe.
      `CR-05` is live. Declare the precondition (the harness must be wired to the strict
      parser) rather than continuing to rely on the flag never being used.
human_verification:
  - test: "Drive the harness's restore-on-signal path with an in-process driver or an injected await in the plant window; deliver SIGINT and SIGTERM inside it."
    expected: "Exit 130, every planted file byte-identical, `git status --porcelain` byte-identical to the baseline, and the second restoreAll() a no-op."
    why_human: "Cancellation/cleanup invariant with no test; plan 32-14 measured that main() is wholly synchronous so the handler cannot be reached from outside the process."
---

# Phase 32: The Deletion and the Grep Gate — Verification Report (round 2)

**Phase Goal:** a retrospective audit whose subject does not exist until the last guard has
moved — every guard and CI script pinned to the deleted regenerator2000 subject has a
recorded fate and none passes vacuously; and no living document is left pointing a user at a
route that no longer exists.

**Verified:** 2026-09-01T02:20:00Z at HEAD `05ca6c68fea7828a238925eecf65573ea159253e`
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure round 1 (plans 32-10 … 32-14, all merged)

**Broker state, read before any measurement:** `pgrep -af "vice-broker.mjs"` returns nothing;
`ps -eo pid,args | grep -i vice-broker | grep -v -- "--test"` returns only the grep itself.
The broker is STOPPED. Every test figure below was taken in that state.

---

## The headline, stated before the tables

**The three round-1 gaps: two closed, one partially closed.** Gap 1 is closed properly and
its adjudication reproduces command-for-command in my hands. Gap 3's two named defects are
both fixed and both observed. Gap 2 is six-eighths closed.

**And the round introduced two new defects of the same kind it was created to remove, plus
left one uncounted.** This is not a technicality and I am not softening it: a phase whose
success criterion is *"none passes vacuously"* shipped (a) a new guard that passes vacuously
with respect to its own docblock's stated purpose, and (b) a new post-condition that makes a
committed piece of this phase's own evidence un-re-measurable by this phase's own instrument
and instructs the operator to edit the evidence instead. Both were reproduced by me from a
clean tree with a single command each.

**On whether `CR-05` / `CR-08` are in `CUT-04`'s scope — the question I was asked not to
duck.** `CUT-04`'s literal subject is the 61 audited-set members, and neither
`audit-root-args.test.ts` nor the harness's argv reader is one of them. Under the narrowest
reading they are out of scope, and I record that reading fairly. I do not adopt it, for two
measured reasons:

1. **`CR-05` is not adjacent to the evidence, it is upstream of it.**
   `scripts/audit-mutation-harness.mjs` is the sole producer of all 35 machine-captured
   observed reds that ARE `CUT-04`'s evidence. An instrument that can be pointed at the wrong
   tree without saying so is a soundness property of the evidence, not of a neighbouring
   file. The recorded evidence happens to be safe — `--root` appears in `guard.argv` in 0 of
   61 rows and all 35 plants are `kind: "worktree"` — but it is safe by non-use, which is
   precisely the "coincidental reliance" this report is required to flag rather than launder.
2. **`CR-08` is the mechanism Gap 2's closure was sold on.** Plan 32-11's must-have 6 is
   `gaps[1].missing[2]` quoted verbatim — "At least one spawnSync test per `--root`-ised
   script" — and the completeness guard is what makes that a standing property instead of a
   snapshot. Measured, it cannot see either of the two `--root`-ised scripts that lack a test.
   So the must-have is satisfied only under a population definition that excludes the
   counterexamples.

Criterion 1's "none passes vacuously" is therefore **NOT YET MET as a property of the phase's
own instruments**, while it IS met for the 61 audited members themselves. Those are two
different claims and this report keeps them apart.

**On criterion 2's phase-close half — the full `npm test` glob.** I ran it. It does not go
green with the broker stopped, and it cannot: `vice-proxy.test.ts` needs a live broker, hangs,
and is on `MANUAL_ONLY_TESTS` for that reason. **Plan 32-09 did not launder this** —
`evidence/32-close-gate.md` §2b records the timeout AS the measured result and states in
words: *"the whole-glob form was not run to green locally, and nothing in this document claims
it was."* My own run independently reproduces its finding, including the exact count of 39
broker-absent failures inside that one file. I judge criterion 2's gate half **discharged by a
stated, guarded substitution rather than by the literal command**, and I say plainly that the
literal command was not met and is not meetable on this host.

---

## Goal Achievement

### Observable Truths

Truths 1–13 are round 1's, carried forward verbatim so the two rounds can be compared row by
row. Truths 14–15 are new: they name the two instruments this round added.

| # | Truth | Source | Round 1 | Round 2 | Evidence |
|---|-------|--------|---------|---------|----------|
| 1 | Every guard and CI script pinned to the deleted subject has a recorded fate | ROADMAP SC-1 / CUT-04 | ⚠️ PARTIAL | ✓ VERIFIED | §6.1 adjudicates all 11 names `CUT-04` lists. I re-ran its own extraction command (11 names) and its own resolver (10 CITED / 1 EXCLUDED / 0 AMBIGUOUS) — reproduces exactly. `docs-linerefs` exclusion re-measured: `grep -aic r2000` = 0 at `0394cbc`, 0 at `345d5c4`, absent from `--diff-filter=A`. Non-demotion note present beside `CUT-04`; both rows still `[x]` / `Complete` |
| 2 | None passes vacuously — each **re-pointed** guard's planted violation re-run against its **new** subject and observed red | ROADMAP SC-1 / CUT-04 | ✓ VERIFIED | ✓ VERIFIED (coincidental-reliance) | Structural regression check clean: 35 `re-pointed` / 19 `kept-unchanged` / 7 `deleted` = 61; 35/35 non-zero `exitStatus`, 35/35 `control.exitStatus === 0`, 35 distinct non-empty excerpts, 35/35 `control.command` byte-identical to `command`, 0 signal artifacts. I re-ran one row end to end through the FIXED harness and it reproduced the recorded evidence exactly. Flagged coincidental-reliance: see the note under the table |
| 3 | Audited **as a set, at once, retrospectively**, on the settled tree | ROADMAP SC-1 | ✓ VERIFIED | ✓ VERIFIED | Two pinned commits, one mechanical derivation, one registry, one blocking CI gate. Gate re-run: `setA=43 setB=16 setC=2 total=61 rows=61`, exit 0 |
| 4 | The fate guard itself cannot pass vacuously | plan 32-01 | ✓ VERIFIED | ✓ VERIFIED | I drove the real gate against six registry mutations at HEAD — all six red. Table below |
| 5 | No living document points a user at a deleted route | ROADMAP SC-2 / CUT-06 | ✓ VERIFIED | ✓ VERIFIED | `check-no-regenerator2000.mjs` exit 0: 407 files scanned (floor 350), 157 permanently exempt, **0 temporarily allow-listed across 0 entries** |
| 6 | The phase-close gate is re-run and recorded with its broker state | ROADMAP SC-2 (gate half) / plan 32-09 | ✓ VERIFIED | ✓ VERIFIED | Re-run by me with the broker stopped: 7/7 `check-*.mjs` exit 0; `typecheck` exit 0; `docs/tool-support.md` regenerates byte-identical (md5 `bb47448…` before and after); full glob run and its non-completion recorded rather than laundered. The one red `docs-*` guard is the disposition guard, which this document closes |
| 7 | `PROJECT.md`'s `vice-proxy.ts` citations, its `r2000_*` clause and its `D-36` row repaired; `ARCHITECTURE.md` A21 dated-superseded | plan 32-03 / CUT-06 | ✓ VERIFIED | ✓ VERIFIED | `PROJECT.md:311` cites `:3050` / `:2985` / `:1529` / `:1505` and names `anno_*`; `grep -ac docs-r2000-decisions .planning/PROJECT.md` = 0; `ARCHITECTURE.md:231` carries "⚠ SUPERSEDED 2026-08-30" |
| 8 | `docs-linerefs.test.ts` widened onto `PROJECT.md` with a **per-document** non-vacuity floor | plan 32-04 / D-10 | ✓ VERIFIED | ✓ VERIFIED | `SCANNED_DOCS` = `["CLAUDE.md", ".planning/PROJECT.md"]`; floor at `:192`, per-document message at `:196`; **six** planted-violation tests measured at `:272 :339 :361 :376 :389 :405`; `node --test docs-linerefs.test.ts` = 12 pass / 0 fail |
| 9 | The sweep ledger carries one verdict row per swept file, numbers reconciled, no dated record rewritten | plan 32-05 / D-08, D-09 | ✓ VERIFIED | ✓ VERIFIED | Unchanged this round except for 32-14's additive 70-line CORRECTION block (`git show --stat`: 70 insertions, **0 deletions**) |
| 10 | Sweep rows, deleted rows, set-B rows and both deferred fates complete; tree left clean | plans 32-06/07/08 | ✓ VERIFIED | ✓ VERIFIED | Verdict census 35 / 19 / 7 = 61 reproduced; `git status --porcelain` identical before and after every command in this verification |
| 11 | D-16's named CI step with `fetch-depth: 0`, no package script, harness in no CI step | plan 32-09 | ✓ VERIFIED | ✓ VERIFIED | `ci.yml:258` `node scripts/check-guard-fates.mjs`; `fetch-depth: 0` at `:38`; exactly 1 subject literal in `ci.yml`; 0 `guard-fates`/`mutation-harness` entries in either `package.json` |
| 12 | Every `--root` argument is resolved through `resolveContainedRoot()`; out-of-repo refused; never a silent default-root read | plan 32-02, Gap 2 | ✗ FAILED | ✗ FAILED (narrowed 6/8) | Six scripts fixed and proven; **`audit-mutation-harness.mjs` and `audit-gate.mjs` still silently fall back**. Reproduced. See Gap 2 |
| 13 | The harness restores the tree on SIGINT / SIGTERM / uncaught exception / exit | plans 32-01, 32-06 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Handlers present at `:103-114`; normal path proven again at HEAD. Signal path still unexercised — 32-14 measured WHY (`main()` is wholly synchronous; 10/10 attempts exited 0, never 130). Broken-windows entry 33 |
| 14 | The recorded evidence is **re-runnable by the committed instrument** — any row re-measurable, a whole-set `--all` sweep completes | plan 32-01 prohibition 1 / ROADMAP SC-1 | — (not separated) | ✗ FAILED | `--row scripts/lib/skill-honesty-checks.mjs` -> post-condition FAILED, exit 1, nothing written. Row 23 of 35 planted; the throw aborts the sweep and suppresses the registry write-back. NEW this round. See Gap 4 |
| 15 | The `--root` completeness guard measures the root-accepting population | plan 32-11 truth 6 / `gaps[1].missing[2]` | — (did not exist) | ✗ FAILED | Population predicate is `src.includes("parseRootArg(")`. Measured 8 accept `--root`, 6 contain `parseRootArg(`; the 2 invisible are the 2 behind. Docblock `:294-296` asserts the opposite. NEW this round. See Gap 5 |

**Score:** 11/15 truths verified (1 present, behavior-unverified; 3 failed). Round 1 was
10/13.

**Coincidental-reliance note on truth 2 (advisory, does not change the score or the status).**
Truth 2 holds. It holds partly because of an **undeclared precondition**: the harness's
defective `--root` path was never exercised. Measured — `--root` appears in `guard.argv` in
**0 of 61** rows, and all 35 plants are `kind: "worktree"`. Nothing in the code or in a
declared prerequisite guarantees a future operator will keep the flag unused; `CR-05` makes
the flag actively dangerous. Harden by wiring the harness to the strict parser (Gap 2), not by
documenting the habit.

---

### The fate guard's own non-vacuity — driven by me at HEAD, not read from a SUMMARY

Six mutations applied to `guard-fates.json`, gate re-run, registry restored from a byte copy
after each. `git diff --stat` on the registry is empty at the end.

| # | Mutation | Gate exit | Verdict |
|---|----------|-----------|---------|
| M1 | Delete one row | 1 | RED — `rows=60` against `total=61` |
| M2 | Strip one `observedRed` | 1 | RED |
| M3 | Set an `observedRed.exitStatus` to 0 | 1 | RED |
| M4 | Set a `control.exitStatus` to 1 | 1 | RED |
| M5 | **Add a hand-written `docs-linerefs.test.ts` row** | 1 | RED — `rows=62`. This independently confirms §6.1.4's claim that giving the excluded guard a row would red the gate, which is the reason Gap 1 was closed by adjudication rather than by a row |
| M6 | Delete a `kept-unchanged` row's `removalTrigger` | 1 | RED |

6/6 red. The guard cannot pass vacuously.

---

### Gap 1's adjudication, re-derived rather than read

I ran §6.1.1's own extraction and §6.1.2's own resolver against the committed registry.

```
$ sed -n '141p' .planning/REQUIREMENTS.md | sed 's/.*Named explicitly: //' \
    | sed 's/([^)]*)//g' | grep -ao '`[^`]*`' | tr -d '`' | wc -l
11
```

| Name | rows matched | resolution |
|---|---|---|
| `docs-linerefs` | 0 | EXCLUDED |
| `docs-dangling-refs` | 1 | `src/mcp/vice/docs-dangling-refs.test.ts` [re-pointed] |
| `docs-r2000-decisions` | 1 | `src/mcp/vice/docs-r2000-decisions.test.ts` [re-pointed] |
| `hostpath-consumers` | 1 | `src/mcp/vice/hostpath-consumers.test.ts` [re-pointed] |
| `stock-dispatch` | 1 | `src/mcp/vice/stock-dispatch.test.ts` [re-pointed] |
| `vice-proxy` | 1 | `src/mcp/vice/vice-proxy.test.ts` [re-pointed] |
| `capability-registry` | 1 | `src/mcp/vice/capability-registry.test.ts` [re-pointed] |
| `skill-attribution` | 1 | `src/mcp/vice/skill-attribution.test.ts` [**kept-unchanged**] |
| `tool-support-table` | 1 | `src/mcp/vice/tool-support-table.test.mjs` [re-pointed] |
| `check-skill-tool-coverage.mjs` | 1 | `scripts/check-skill-tool-coverage.mjs` [re-pointed] |
| `generate-tool-support-table.mjs` | 1 | `scripts/generate-tool-support-table.mjs` [re-pointed] |

**CITED=10 EXCLUDED=1 AMBIGUOUS=0** — the figures §6.1.5 records, reproduced.

Every supporting citation in §6.1.4 also reproduces: `docs-linerefs.test.ts:192` is
`const meetsFloor = citations.length >= 2;`, `:196` is the per-document message,
`check-guard-fates.mjs:672` is the stranger-row message, and `SCANNED_DOCS` at `:64-67` is the
two-document array.

**The recorded citation correction is genuine and I carry it.** Plan 32-13 was directed to
cite "three planted-violation tests at `:361-383`". Measured, there are **six**, at
`:272 :339 :361 :376 :389 :405`, and the range `:361-383` spans two of them, cutting the
second mid-body. §6.1.4 records the measurement rather than the instruction, states why
(writing a line citation from expectation *inside the paragraph adjudicating the guard that
exists to catch stale line citations* would be self-refuting), and the previous
`32-VERIFICATION.md:328` carried the wrong figure. This report supersedes that figure.

---

### The set-C line-number discrepancy — adjudicated, not a defect

| Source | Line cited | Status |
|---|---|---|
| `check-guard-fates.mjs` output today | **830** | measured by me |
| `evidence/32-audited-set-reconciliation.md` §1.3 | 814 | dated record |
| previous `32-VERIFICATION.md:280` | 814 | dated record |
| `evidence/32-audited-set-reconciliation.md` §6-adjacent note | 830, with the discrepancy explained | dated record |

**Verdict: acceptable, not a defect.** Three measured reasons. (1) The gate does not compare
against a pinned number — it *derives* the line from content and prints where it found it, so
a stale figure in a dated record cannot make the gate lie. (2) `sed -n '830p' .planning/ROADMAP.md`
returns the deferred-fates bullet today, so the current reading is correct. (3) The
reconciliation already discloses the drift and refuses to rewrite the earlier records, with the
reason stated: *"a dated record that gets rewritten to stay green stops being a record."* That
is this project's own discipline applied against its author's convenience, which is the
behaviour a verifier should reward rather than penalise. The figure moved again during this
session's orchestrator tracking edits; that changes nothing, for the same reason.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/lib/audit-root.mjs` | `resolveContainedRoot` + strict `parseRootArg` + `splitReadRefusalReason` | ✓ VERIFIED | 3 exported functions; `parseRootArg` at `:173` rejects the equals form, an unrecognised token, a missing value, a following flag, an empty value and a repeated flag, each with its own named message |
| `scripts/lib/audit-root.d.mts` | declares the module's exports | ⚠️ PARTIAL | Declares 2 of 3 — `splitReadRefusalReason` is missing (`WR-22`, confirmed) |
| `scripts/generate-tool-support-table.mjs` | wired; refuses a non-default root before any read or write | ✓ VERIFIED | `SPLIT READ REFUSED` on a contained non-root; `docs/tool-support.md` byte-identical afterwards |
| `scripts/check-guard-fates.mjs` | wired; boolean flag preserved | ✓ VERIFIED | All four malformed forms exit 1 |
| `scripts/check-skill-tool-coverage.mjs` | wired; split read refused naming both identifiers | ✓ VERIFIED | Names `CAPABILITY_REGISTRY` and `CURATED_ANNO_TOOLS` |
| `scripts/check-skill-fork-honesty.mjs` | wired; split read refused naming its identifier | ✓ VERIFIED | Names `CAPABILITY_REGISTRY` |
| `scripts/check-skill-cli-invocations.mjs` | wired; split read refused naming its identifier | ✓ VERIFIED | Names `VERB_OPTIONS` |
| `scripts/check-skill-description-overlap.mjs` | wired; the one gate that HONOURS an arbitrary contained root | ✓ VERIFIED | The only file still carrying the "do not re-derive a path from DEFAULT_ROOT" docblock sentence — the one file where it is true (`grep -c` = 1 there, 0 in the other five) |
| `scripts/audit-mutation-harness.mjs` | replacer function, post-condition, signal→UNMEASURABLE, strict argv | ⚠️ PARTIAL | Replacer ✓, signal mapping ✓, post-condition present but **wrong** (`CR-06`), argv **not wired** (`CR-05`) |
| `scripts/audit-gate.mjs` | — (not in any plan's `files_modified`) | ⚠️ ORPHANED FROM THE SEAM | Accepts `--root`, no `parseRootArg`, silently defaults on all three malformed forms |
| `src/mcp/vice/audit-root-args.test.ts` | ≥300 lines; six-script matrix; split-read contract; completeness guard | ⚠️ PARTIAL | 866 lines, 44 tests, 44 pass / 0 fail. Matrix and split-read contract sound; the completeness guard is tautological (`CR-08`) |
| `evidence/32-audited-set-reconciliation.md` §6.1 | eleven names adjudicated | ✓ VERIFIED | Reproduced above |
| `evidence/32-gap2-root-seam-coverage.md` | raw before/after for the three verifier reproductions | ✓ VERIFIED | 533 lines added in `2c375da`; contains `definitely-not-here` |
| `evidence/32-gap3-harness-correction.md` | the re-measured run in full plus the signal-path attempt log | ✓ VERIFIED | 763 lines across `205dc3c` and `326ea72`; states what the run does and does NOT establish |
| `guard-fates.json` | 61 rows, r2000 row re-measured | ✓ VERIFIED | `205dc3c` changed exactly that row (2 insertions / 2 deletions); the new excerpt reads `'$0D011' !== '$D011'` — sigil present, which is the fix's whole visible effect |
| `.planning/REQUIREMENTS.md` | non-demotion note beside `CUT-04` | ✓ VERIFIED | Present at `:145`; both rows still `[x]` and `Complete` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| six `scripts/*.mjs` | `scripts/lib/audit-root.mjs` | `import { parseRootArg }` | ✓ WIRED | 6 files contain `parseRootArg(`; all six reject all four malformed forms |
| `scripts/audit-mutation-harness.mjs` | `scripts/lib/audit-root.mjs` | should import `parseRootArg` | ✗ NOT WIRED | 0 occurrences of `parseRootArg`; hand-rolled reader retains the missing-value hole |
| `scripts/audit-gate.mjs` | `scripts/lib/audit-root.mjs` | should import `parseRootArg` | ✗ NOT WIRED | 0 occurrences; `:1123` hand-rolled |
| `src/mcp/vice/audit-root-args.test.ts` | the real exported `parseRootArg` | direct import at `:81` | ✓ WIRED | Unit assertions drive the real function, not a copy |
| `src/mcp/vice/audit-root-args.test.ts` | the six scripts | `spawnSync` of the real files | ✓ WIRED | Three cases per script × six scripts, all green |
| `src/mcp/vice/audit-root-args.test.ts:423` | the root-accepting population | `src.includes("parseRootArg(")` | ✗ WRONG SOURCE | Reads the remedy, not the flag. See Gap 5 |
| `scripts/audit-mutation-harness.mjs` | `guard-fates.json` | reads the plant descriptor, writes back `observedRed` | ⚠️ PARTIAL | Works per-row for 34 of 35; aborts the sweep at row 23 and suppresses the write-back (`CR-06`) |
| §6.1 | `guard-fates.json` | each CITED name quotes its row's `historicalPath` and `verdict` | ✓ WIRED | Re-resolved by me; 10/10 |
| §6.1 | `docs-linerefs.test.ts` | the EXCLUDED verdict cites the floor and the plants | ✓ WIRED | `:192` / `:196` and six plants, all measured |
| `.planning/REQUIREMENTS.md` | §6.1 | the dated note points at the adjudication | ✓ WIRED | Note at `:145` names `32-audited-set-reconciliation.md` §6.1 |
| `guard-fates.json` | `.planning/ROADMAP.md` § Phase 32 | set C parsed from the deferred-fates note | ✓ WIRED | Gate prints "line 830"; `sed -n '830p'` returns the deferred-fates bullet |

---

### Behavioural Spot-Checks

All run at HEAD `05ca6c6`, broker stopped, from a clean tree.

| # | Behaviour | Command | Result | Status |
|---|---|---|---|---|
| 1 | The fate gate is green on the real tree | `node scripts/check-guard-fates.mjs` | exit 0, `setA=43 setB=16 setC=2 total=61 rows=61` | ✓ PASS |
| 2 | All CI check scripts are green | each of `scripts/check-*.mjs` | 7/7 exit 0 | ✓ PASS |
| 3 | `docs/tool-support.md` regenerates byte-identical | `node scripts/generate-tool-support-table.mjs` | md5 `bb4744890855e58887142e5a97f44fc0` before **and** after; `git diff --exit-code` clean | ✓ PASS |
| 4 | The removal gate is green tree-wide | `node scripts/check-no-regenerator2000.mjs` | exit 0; 407 files; 157 permanent exemptions; **0** temporary allow-list entries | ✓ PASS |
| 5 | Typecheck | `npm run typecheck` | exit 0 | ✓ PASS |
| 6 | The nine `docs-*.test.ts` guards | `node --test docs-*.test.ts` individually | 8 green; `docs-review-disposition.test.ts` **red** (19 undispositioned round-2 finding ids) | ✗ FAIL → closed by this document's dispositions |
| 7 | `test:automated` | `npm run test:automated` | 2994 tests, 2986 pass, **2 fail**, 1 skipped, 5 todo | ✗ FAIL — both failures share ONE root cause: the undispositioned ids (`docs-review-disposition.test.ts:338` and `audit-integrity.test.ts:234`, the D-12-02 gate that reds when any docs guard is red). Closed by this document |
| 8 | The full `npm test` glob, broker stopped | `node --test '*.test.*'` | 3121 tests, 3036 pass, **41 fail**, 39 skipped. 39 of the 41 are inside `vice-proxy.test.ts` (broker-absent); 2 are the pair in row 7 | ✗ FAIL — see the criterion-2 adjudication below |
| 9 | The seam's own suite | `node --test audit-root-args.test.ts` | 44 tests, 44 pass, 0 fail | ✓ PASS |
| 10 | The four split-read gates refuse a contained non-root | each with `--root <in-repo dir>` | 4/4 exit 1 with `SPLIT READ REFUSED` naming the exact identifiers | ✓ PASS |
| 11 | A recorded row still reproduces through the FIXED harness | `--row src/mcp/vice/r2000-enum-gen.test.ts` | OBSERVED RED, guard exit 1, control exit 0, tree restored byte-identical. Excerpt matches the committed one modulo timing and worktree-vs-main paths | ✓ PASS |
| 12 | **CR-05** — a valueless `--root` on the harness | `--row src/does/not/exist.ts --root` | Reached ROW SELECTION against the REAL registry; no message mentions `--root`; exit 1 | ✗ FAIL (defect reproduced) |
| 13 | **CR-06** — a recorded row re-measured | `--row scripts/lib/skill-honesty-checks.mjs` | post-condition FAILED, exit 1, nothing written, tree clean | ✗ FAIL (defect reproduced) |
| 14 | **CR-08** — the root-accepting population | `grep -l -- '--root' scripts/*.mjs` vs `grep -l 'parseRootArg(' scripts/*.mjs` | **8** vs **6**; the 2 invisible are `audit-gate.mjs` and `audit-mutation-harness.mjs` | ✗ FAIL (defect reproduced) |
| 15 | Decision coverage | `gsd-tools query check.decision-coverage-verify` | 17/17 honored, 0 not honored | ✓ PASS |

**The full four-form argv matrix, all eight root-accepting scripts, measured:**

| Script | `--root=/tmp` | `--rooot /tmp` | bare `--root` | `--root /tmp` |
|---|---|---|---|---|
| `check-guard-fates` | 1 | 1 | 1 | 1 |
| `check-skill-cli-invocations` | 1 | 1 | 1 | 1 |
| `check-skill-description-overlap` | 1 | 1 | 1 | 1 |
| `check-skill-tool-coverage` | 1 | 1 | 1 | 1 |
| `check-skill-fork-honesty` | 1 | 1 | 1 | 1 |
| `generate-tool-support-table` | 1 | 1 | 1 | 1 |
| `audit-gate` | 1 | 1 | 1 | 1 |
| `audit-mutation-harness` | 2 | 2 | 2 | 2 |

The exit codes alone look clean and **are misleading**, which is why this table is not the
evidence. `audit-gate`'s exit 1 is its ordinary REFUSED verdict about the **real** tree in
all four columns — it never saw the flag. `audit-mutation-harness`'s exit 2 is its
row-selector usage error, reached only *after* the real registry was loaded. Adding a valid
selector unmasks it: `--row <p> --root` exits 1 having read the real registry. A per-form exit
code is not a per-form behaviour, and this is exactly the shape of check that `CR-08` lets
pass.

---

### Criterion 2's phase-close half — the full glob, judged plainly

**What criterion 2 asks for:** full `npm test` over the whole glob with the broker STOPPED,
both `check-*.mjs` CI scripts, `docs/tool-support.md` byte-identical, and every
`docs-*.test.ts` guard green.

**What I measured:**

| Component | Result |
|---|---|
| `check-*.mjs` (all seven, not two) | 7/7 exit 0 ✓ |
| `docs/tool-support.md` byte-identical | ✓ (md5 identical before and after regeneration) |
| every `docs-*.test.ts` green | 8/9 at HEAD; the 9th is the disposition guard, closed by this document |
| full `npm test` glob, broker stopped | 3121 tests / 41 fail. 39 failures inside `vice-proxy.test.ts` alone. The run does not terminate on its own — I had to kill the hung child to make the parent print totals |

**Judgement.** The literal command is **not met and is not meetable on this host**, and I say
so rather than scoring it green. `vice-proxy.test.ts` requires a live broker; it is on
`MANUAL_ONLY_TESTS` for exactly that reason; running it with the broker stopped is a
guaranteed 39-failure hang by construction, not a regression this phase introduced.

**But the phase did not launder it.** `evidence/32-close-gate.md` §2b records
`timeout 180 node --test vice-proxy.test.ts` -> `exit=124` and says in words: *"the whole-glob
form was not run to green locally, and nothing in this document claims it was."* §7 then
states the substitution and its guard: `automatedTestFiles()` at `test-gate.mjs:107-114`
removes exactly `MANUAL_ONLY_TESTS` from the `*.test.*` glob, so `test:automated ∪ test:manual`
= the whole glob by construction, with `test-gate.test.ts` as the drift guard. My own run
independently reproduces the close-gate's finding down to the count — **39** broker-absent
failures in that one file, the same number §2b records.

I therefore score truth 6 ✓ VERIFIED on the basis that the criterion's gate half was *re-run
and recorded with its broker state*, which is what the criterion asks of THIS phase ("is
**re-run** here rather than established here"), and I record the literal-command shortfall
here in full so no later reader mistakes the green for a whole-glob green. This is a judgement
about wording, and a reader who disagrees has every figure needed to overrule me.

---

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| `CUT-04` — every guard and CI script pinned to the deleted subject has a recorded fate and none passes vacuously | 32-01, 32-02, 32-06, 32-07, 32-08, 32-09, 32-10, 32-11, 32-12, 32-13, 32-14 | ⚠️ **SATISFIED FOR THE AUDITED SET, NOT FOR THE PHASE'S OWN INSTRUMENTS** | 61/61 fates recorded and all 11 named guards adjudicated (Gap 1 closed, reproduced). 35/35 machine-captured reds with green controls, structurally intact, one reproduced end-to-end by me. Fate guard red under 6/6 mutations. **Against that:** the evidence is no longer re-runnable as a whole set (`CR-06`), the producing instrument can be pointed at the wrong tree without saying so (`CR-05`), and the guard added to keep the seam honest is tautological (`CR-08`) |
| `CUT-06` — no living document names the deleted subject as a required prerequisite | 32-03, 32-04, 32-05, 32-09, 32-10, 32-13, 32-14 | ✓ **SATISFIED** | Removal gate exit 0 over 407 files with 0 temporary allow-list entries; `PROJECT.md`, `ARCHITECTURE.md` A21, `CLAUDE.md` and the seven skill playbooks all verified; sweep ledger one verdict row per swept file |

**Orphaned requirements:** none. `.planning/REQUIREMENTS.md`'s traceability table maps exactly
`CUT-04` and `CUT-06` to Phase 32, and both appear in plan frontmatter.

**On the `[x]` / `Complete` status of both rows.** Plan 32-13 deliberately did not demote
them, on the previous verifier's own quoted recommendation, and recorded that decision beside
`CUT-04` rather than silently. I **do not demote them either**, and I record my reason rather
than inheriting theirs: `CUT-06` is fully satisfied and demoting it would be false; `CUT-04`'s
substantive claim about the 61 audited members is satisfied and reproducible, and the three
open defects are in the phase's *instruments*, which the gaps above name precisely. Demoting
the row would blur a precise finding into an imprecise one. The gaps are the record.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/audit-mutation-harness.mjs` | 219-229 | Post-condition that refuses honest evidence and instructs the reader to edit it | 🛑 BLOCKER | Gap 4 / `CR-06` |
| `scripts/audit-mutation-harness.mjs` | ~389-427 | Hand-rolled argv reader with a missing-value hole, in the one instrument that mutates and writes | 🛑 BLOCKER | Gap 2 / `CR-05` |
| `src/mcp/vice/audit-root-args.test.ts` | 423, 294-296 | Guard whose population is its own remedy; docblock asserts completeness it does not have | 🛑 BLOCKER | Gap 5 / `CR-08` |
| `scripts/audit-gate.mjs` | 1123 | Same missing-value hole; silently drops unrecognised tokens | ⚠️ WARNING | Gap 2 |
| `scripts/lib/audit-root.mjs` | 119-122 | Docblock cites a still-defective file as "the model that was not reused; it is reused here" | ⚠️ WARNING | Gap 2 |
| `.gitignore` | ~53 | Cites `scripts/audit-mutation-harness.mjs:654` for the dirty-tree-voids-evidence claim; measured, `:654` is inside `evidenceMarkdown()`'s raw-output block and the real claim is at `:766`/`:769` | ⚠️ WARNING | `WR-15`. A stale line citation written by this phase, in a repository whose `docs-linerefs.test.ts` exists to catch that exact class |
| `scripts/lib/audit-root.d.mts` | — | Declares 2 of the module's 3 exports | ⚠️ WARNING | `WR-22` |
| `src/mcp/vice/audit-root-args.test.ts` | 275-282, 553-573 | The suite writes the committed byte-pinned `docs/tool-support.md` six times per run, in parallel with its own drift guard | ⚠️ WARNING | `WR-20`. Not a false green today (the `:275` case captures `before` first and the tree stayed byte-identical across my full run), but a self-healing hazard |
| — | — | Debt markers (`TBD` / `FIXME` / `XXX`) in the ten gap-closure files | ℹ️ NONE | Scanned; zero. `TODO` / `HACK` / `PLACEHOLDER` also zero |
| `src/mcp/vice/audit-root-args.test.ts` | — | Skipped / todo tests | ℹ️ NONE | Zero `.skip` / `.todo`; 44 active, 44 pass |

---

### Test Quality Audit

| Test file | Linked requirement | Active | Skipped | Circular | Assertion level | Verdict |
|---|---|---|---|---|---|---|
| `src/mcp/vice/audit-root-args.test.ts` | CUT-04 (the `--root` seam) | 44 | 0 | No — drives the REAL exported `parseRootArg` and `spawnSync`s the REAL scripts | Behavioural (exit status + stderr content + tree byte-identity) | ⚠️ SOUND EXCEPT ITS COMPLETENESS GUARD, which is tautological (`CR-08`) |
| `src/mcp/vice/docs-linerefs.test.ts` | CUT-06 / D-10 | 12 | 0 | No | Behavioural, with six planted-violation controls | ⚠️ PASS with `WR-19` noted: the citation-resolution plant re-implements the two lines it drives instead of calling an extracted predicate, against the file's own stated discipline at `:32-37` |
| `scripts/check-guard-fates.mjs` (driven as a gate) | CUT-04 | — | — | No | Behavioural | ✓ PASS — 6/6 mutations red, driven by me |

**Disabled tests on requirements:** 0. **Circular patterns:** 0. **Insufficient assertions:** 0.
**Tautological population predicate:** 1 → BLOCKER, already recorded as Gap 5.

---

### Decision Coverage

`gsd-tools query check.decision-coverage-verify`: **17 of 17** trackable `32-CONTEXT.md`
decisions are honored by shipped artifacts. `not_honored: []`. Non-blocking gate, recorded for
drift tracking.

---

### Code Review Disposition

`docs-review-disposition.test.ts` derives its finding set from every `*-REVIEW.md` under
`.planning/phases/` and requires each id to be named in a recognised disposition source. This
document is source 2 (the phase's own `*-VERIFICATION.md`). Every id below is dispositioned
here.

**Record-hygiene note, measured:** commit `05ca6c6` REPLACED `32-REVIEW.md` (556 insertions /
533 deletions) rather than appending, so round 1's findings (`CR-01`–`CR-04`, `WR-01`–`WR-14`,
`IN-01`–`IN-07`) are no longer in that file. They survive in
`.planning/todos/pending/2026-08-31-phase-32-review-twenty-five-open-findings.md`. Their
dispositions are restated below so the round-1 record is not lost by the overwrite.

#### Round 2 — critical (4)

| Id | Disposition |
|---|---|
| **CR-05** | **CONFIRMED AND ESCALATED TO A GAP.** I reproduced it independently: `--row <p> --root` reaches row selection against the real registry with no mention of the flag, and `--root --row <p>` swallows `--row` as the root's value. Recorded as Gap 2 (`gaps[0]`). Plan 32-11 fenced this script out on the ground that it "already rejects unknown arguments correctly" — true for `--rooot`, **false** for a valueless `--root`, and the fence therefore rests on a premise the round-1 verifier supplied and I now falsify. Must be fixed before this phase closes |
| **CR-06** | **CONFIRMED AND ESCALATED TO A GAP.** Reproduced in one command from a clean tree. New in `7638c6f`; `git show 371750e:scripts/audit-mutation-harness.mjs` has zero occurrences of "post-condition". Recorded as Gap 4 (`gaps[2]`). The reviewer's proposed fix (count introduced occurrences, not total) is correct and I endorse it. The failure message must also stop telling the operator to edit the evidence |
| **CR-07** | **ACCEPTED, DEFERRED, NOT REPRODUCED.** The adjacency-accept loop deletes and repopulates `installer/skills/` five times per run while four other test files read it, under a parallel runner. I did not reproduce a flake — my `audit-root-args.test.ts` run (44/44) and my full-glob run were both clean on that axis — so I record it as an un-triggered race rather than an observed failure. It is real and should be fixed (point those runs at a throwaway tree), but it does not block either success criterion and I will not manufacture a failure I did not see |
| **CR-08** | **CONFIRMED AND ESCALATED TO A GAP.** Measured 8 root-accepting vs 6 in the guard's population, with the two invisible ones being exactly the two behind, and the docblock at `:294-296` asserting the opposite in the present tense. Recorded as Gap 5 (`gaps[1]`). Fix by deriving the population from the FLAG. **Do not add an exclusion list** — the guard will go red naming `audit-gate` and `audit-mutation-harness`, and that red is correct |

#### Round 2 — warnings (12)

| Id | Disposition |
|---|---|
| **WR-15** | **CONFIRMED, WARNING.** Measured: `.gitignore` cites `audit-mutation-harness.mjs:654` for the dirty-tree-voids-evidence claim; `:654` is inside `evidenceMarkdown()`'s raw-output block, and the claim lives at `:766`/`:769`. Fix the citation. Recorded in Anti-Patterns |
| **WR-16** | **ACCEPTED, WARNING.** `resolve(base, rootArg)` makes every relative `--root` repo-relative rather than cwd-relative. Behaviour is safe (it can only resolve inside the repo) but undocumented. Document it in `parseRootArg`'s usage line |
| **WR-17** | **ACCEPTED, WARNING.** `carriesSplitReadRefusal()` is a bare `text.includes("SPLIT READ REFUSED")`, satisfiable by a comment. Not exploited today — all four consequents are real refusals, verified by running them. Tighten to require the refusal be reachable code |
| **WR-18** | **ACCEPTED, WARNING.** The split-read antecedent matches only direct `from "../src/…"` specifiers, so a transitively-bound registry would not be caught. No such case exists today (I checked the four consumers' imports). Widen when one appears |
| **WR-19** | **ACCEPTED, WARNING — and directly on SC-1's by-construction re-check.** `docs-linerefs.test.ts`'s citation-resolution plant at `:279-284` verbatim re-implements the two lines at `:261-266` it is meant to drive, against the file's own stated discipline at `:32-37`. The guard is non-vacuous overall (12/12 pass, six plants) but this one plant proves nothing about the real rule. Extract the predicate. Noted in the Test Quality Audit |
| **WR-20** | **ACCEPTED, WARNING.** Six writes to the committed byte-pinned `docs/tool-support.md` per suite run, concurrent with its drift guard. Measured not a false green today — the `:275` case captures `before` first, and my full run left the file byte-identical (md5 unchanged). Still a self-healing hazard; point those runs at a throwaway output |
| **WR-21** | **ACCEPTED, WARNING.** Stated run budget does not match the code's actual run count. Documentation drift; no behavioural effect |
| **WR-22** | **CONFIRMED, WARNING.** Measured: `audit-root.mjs` exports 3 functions (`grep -c '^export function'` = 3); `audit-root.d.mts` declares 2. `splitReadRefusalReason` is missing. Add it |
| **WR-23** | **CONFIRMED, WARNING.** `check-guard-fates.d.mts` has zero occurrences of `plant`, while all 35 committed `observedRed` objects carry one (verified by parsing the registry). Add the field |
| **WR-24** | **ACCEPTED, WARNING.** Five of six consumers advertise `[--root <dir>]` in their usage line while refusing every value but a spelling of the repository root. Honest but misleading; narrow the usage text to match the refusal |
| **WR-25** | **ACCEPTED, WARNING.** `deriveAuditedSet`'s `roadmapText` docblock claim is false as written. Documentation defect; correct the sentence |
| **WR-26** | **ACCEPTED, WARNING — and I want it read as a standing risk, not a nit.** Two CI-blocking checks now hard-depend on live `.planning/` phase artifacts. This restates `WR-10`, which the round widened rather than closed, and it compounds the `--no-archive-phases` constraint the milestone already carries for two other reasons. Route to the milestone close for a decision |

#### Round 2 — info (3)

| Id | Disposition |
|---|---|
| **IN-08** | **ACCEPTED, INFO.** `showAt()`'s bare `catch { return ""; }` turns a transient git failure into "object not present". Narrow the catch |
| **IN-09** | **ACCEPTED, INFO.** Recorded excerpts embed absolute worktree paths, against `runGuard()`'s own stated reason for recording a root-relative `cwd`. Visible in the `r2000-enum-gen` row I re-ran (the committed excerpt names `agent-a4c097c848a03c6d7`). Cosmetic; the row still reproduces |
| **IN-10** | **ACCEPTED, INFO — and it is the amplifier on Gap 4.** `hardFailure` discards a whole sweep's measurements when any single row fails. Harmless in isolation; combined with `CR-06` it is what turns one over-strict row into a whole-set sweep that cannot complete. Fix `CR-06` first, then reconsider whether per-row write-back is safer |

#### Round 1 — restated so the `05ca6c6` overwrite does not lose them (25)

`CR-01`, `CR-02`, `CR-03`, `CR-04`; `WR-01`, `WR-02`, `WR-03`, `WR-04`, `WR-05`, `WR-06`,
`WR-07`, `WR-08`, `WR-09`, `WR-10`, `WR-11`, `WR-12`, `WR-13`, `WR-14`; `IN-01`, `IN-02`,
`IN-03`, `IN-04`, `IN-05`, `IN-06`, `IN-07`.

Ledger: `.planning/todos/pending/2026-08-31-phase-32-review-twenty-five-open-findings.md`.
Status changes measured this round:

- **`CR-02` (plant writes what it records) — FIXED.** Replacer function at `:207`; verified by
  re-running the affected row and observing the `$` sigil now present in both record and
  reality. Its remedy's post-condition, however, is `CR-06`.
- **`CR-03` (split read) — FIXED.** Four gates refuse a non-default root naming the exact
  bound identifiers; measured, all four. The false docblock sentence survives in exactly one
  file, the one where it is true.
- **`CR-04` (signal→red) — FIXED.** `runGuard()` returns `terminatedBySignal` and the row is
  recorded UNMEASURABLE; observed pre-fix and post-fix against a scratch root by plan 32-14.
- **`IN-06` (six copies of one reader) — MOSTLY FIXED.** Six of eight consolidated onto the
  shared seam; two remain (`CR-05`).
- **`WR-03` (the `restored` latch) — STILL OPEN.** Unsettled for the reason in
  `behavior_unverified_items`: the signal path cannot be reached from outside the process.
- **`WR-11` (the seam is untested and unused) — FIXED for the six wired scripts** (44 tests,
  three cases per script), **still true for the two unwired ones**.
- **`CR-01`** and the remaining `WR-*` / `IN-*` ids: no change measured this round; they remain
  open in the ledger above.

---

### Process observations, adjudicated because I was asked to

| # | Item | Verdict |
|---|---|---|
| 1 | Plan 32-10's blocking `checkpoint:decision` was answered `A` by the OPERATOR on 2026-09-01, after the executor had already proceeded on `A` provisionally | ✓ **RECORD INTACT AND CORRECTLY ATTRIBUTED.** `32-10-SUMMARY.md:32` records the answer, the date, that it came from the operator via the standard non-auto checkpoint flow, AND that the executor proceeded provisionally without waiting; `:57-98` names the deviation as a process deviation in its own words and states that the authority behind the outcome is the operator's, not the executor's. That is the honest shape |
| 2 | Plan 32-14's one authorised in-place correction measured as a NO-OP: 70 additions / 0 deletions, not the 1 deletion its `[edge:CUT-06/ordering]` criterion anticipated | ✓ **ACCEPTANCE CRITERION CORRECTLY SUPERSEDED BY MEASUREMENT, NOT UNMET.** Verified: `git show --stat 205dc3c` gives `32-sweep-renamed-rows.md | 70 +++`, zero deletions. The criterion assumed the committed `replace:` line was wrong; measured, it was right all along — the fix's whole effect is that the recorded value now reaches disk. Writing the interpreted string there instead would have been a *retyped* value, which the plan's own prohibition forbids. The executor measured, disclosed, filed broken-windows entry 34, and did not act. Correct |
| 3 | Plan 32-12 modified `scripts/lib/audit-root.mjs`, not in its declared `files_modified` | ✓ **ACCEPTED.** The alternative was inlining ~12 lines of refusal-message construction four times, which re-commits `IN-06` — the exact defect the round exists to remove. The file is this phase's own declared single seam, created by 32-10. Disclosed in the SUMMARY. Right call |
| 4 | Plan 32-14 modified `.planning/WINDOWS.md`, not in its declared `files_modified` | ✓ **ACCEPTED.** Verified: the change is two appended ledger entries (33, 34) plus the three frontmatter counters the ledger tooling maintains. Both entries are honest self-disclosures of this plan's own shortfalls. A phase that files its own broken windows is behaving correctly |
| 5 | The set-C line-number discrepancy (830 vs 814) | ✓ **NOT A DEFECT** — see the dedicated section above |
| 6 | The `:361-383` / three-planted-violations citation that does not reproduce | ✓ **CORRECTION CONFIRMED AND CARRIED.** Six plants at `:272 :339 :361 :376 :389 :405`. 32-13 recorded the measurement instead of the instruction; the previous `32-VERIFICATION.md:328` carried the wrong figure and is superseded by this document |

---

### Human Verification Required

#### 1. The harness's restore-on-signal invariant

**Test:** Drive `scripts/audit-mutation-harness.mjs` to the window between `plant()` and the
finally-revert with an in-process driver (the module exports nothing today, so this needs an
`export` or an injected `await`), then deliver SIGINT and SIGTERM inside that window.

**Expected:** Exit 130; every planted file byte-identical to its pre-run bytes;
`git status --porcelain` byte-identical to the baseline; the exit handler's `restoreAll()`
after the signal handler's is a no-op rather than a re-write.

**Why human:** A cancellation/cleanup invariant with no test. Plan 32-14 attempted it ten
times per signal against a scratch root using an observable rather than a timer and measured
*why* it is unreachable from outside: `main()` is wholly synchronous, so the event loop never
turns in the plant window and a JS signal handler cannot run there. 10/10 attempts exited 0
via the ordinary `finally` path. The safety property held every time — but via the path that
was never in doubt, so `WR-03`'s doubt about the `restored` latch is unsettled rather than
resolved. Broken-windows entry 33.

---

### Gaps Summary

Three gaps, in the order they should be fixed.

**Gap 4 first, because it is a live regression in committed evidence.** The post-condition
that plan 32-14 added to close Gap 3 refuses an honest descriptor, aborts any whole-set sweep
at planted row 23 of 35, suppresses the registry write-back, and tells the operator to edit
the evidence. One-line fix (count introduced occurrences, not total), plus a message rewrite,
plus a `--row` re-run and one `--all` run to prove the sweep completes.

**Gap 2 second, because it is the one truth that has now failed twice.** Six of eight scripts
are fixed and proven; the two that remain are `audit-gate.mjs` and — worse —
`audit-mutation-harness.mjs`, the sole producer of this phase's observed-red evidence. The
committed evidence is not corrupted (measured: `--root` appears in `guard.argv` in 0 of 61
rows), but it is sound by non-use, not by construction.

**Gap 5 third, because it is what would have caught Gap 2 and did not.** The completeness
guard's population is its own remedy. Derive it from the flag instead; the guard will
immediately go red naming the two scripts Gap 2 names, which is the correct outcome and the
cheapest possible regression test for Gap 2's fix.

**Not a gap, and deliberately so:** the `docs-review-disposition.test.ts` red at HEAD. That
guard was doing its job — nineteen round-2 finding ids had no disposition anywhere. This
document dispositions all nineteen and restates the twenty-five from round 1 that commit
`05ca6c6`'s overwrite removed from the review file. Re-running the guard after this document
lands is the correct closure, and it also closes `audit-integrity.test.ts:234`'s D-12-02 gate,
which reds on the same root cause.

**No deferrals are possible.** Phase 32 is the last phase of v0.7.0 (`ROADMAP.md`: "Last,
non-negotiably"), so nothing here can be pushed to a later phase. Every gap above is either
fixed in this phase or carried into the milestone close as recorded debt.

---

_Verified: 2026-09-01T02:20:00Z at `05ca6c6`, broker stopped_
_Verifier: Claude (gsd-verifier), round 2_
_Supersedes the 2026-08-31T20:10:00Z report (10/13, three gaps)_

---

## Addendum — the disposition guard re-run after this document landed

Recorded because the tables above say "closed by this document" and a claim of closure that is
not measured is exactly what this phase exists to forbid. Run at `05ca6c6` with this file on
disk, broker still stopped.

| Check | Before this document | After |
|---|---|---|
| `node --test docs-review-disposition.test.ts` | exit 1, 6 pass / 1 fail, 19 undispositioned ids | **exit 0, 7 pass / 0 fail** |
| `node --test audit-integrity.test.ts` (D-12-02) | exit 1, 1 fail | **exit 0, 44 pass / 0 fail** |
| the other eight `docs-*.test.ts` | green | green (56 pass / 0 fail across the eight) |
| `node scripts/audit-gate.mjs` | exit 1, REFUSED | **exit 0 — "9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status"** |
| `npm run test:automated` | 2994 tests, **2 fail** | **2994 tests, 2988 pass, 0 fail, 1 skipped, 5 todo** |

Both round-2 failures shared one root cause and both are closed. **This changes no truth, no
gap and no status** — the three gaps are code defects reproduced by command, not record
defects, and none of them is touched by dispositioning a finding id. `status: gaps_found`
stands.

The full `npm test` glob is unchanged by this and remains not-green with the broker stopped,
for the structural reason recorded above.
