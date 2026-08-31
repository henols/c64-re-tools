---
phase: 32-the-deletion-and-the-grep-gate
verified: 2026-08-31T20:10:00Z
status: gaps_found
score: 10/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "Every guard and CI script pinned to the deleted subject has a recorded fate (ROADMAP SC-1, CUT-04)"
    status: partial
    reason: >-
      61/61 members of the mechanically derived set carry a fate, and the derivation
      reproduces independently (I re-derived setA=43 and setB=22-raw from the git object
      store with my own script). But `src/mcp/vice/docs-linerefs.test.ts` — named
      EXPLICITLY in CUT-04's own requirement text as one of the guards whose planted
      violation must be re-run ("`docs-linerefs` (deletion shifts its cited line
      numbers)") and named again in ROADMAP SC-1 as one of the three that went red by
      construction — has NO registry row, and `evidence/32-audited-set-reconciliation.md`
      never mentions it. It is correctly outside the mechanical predicate (measured:
      `git show 0394cbc:src/mcp/vice/docs-linerefs.test.ts | grep -ic r2000` returns 0,
      and it was not added between the pins), but §6 of the reconciliation reconciles
      only against research §1.5's candidate list and §2 only against CUT-04's FIGURES —
      never against CUT-04's NAMED list. So the one guard the requirement names by name
      is the one guard with neither a fate nor a recorded exclusion reason. D-09's own
      test ("a later reader can tell `we looked and it is fine` from `we never looked`")
      is not met for it.
    artifacts:
      - path: ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json"
        issue: "No row for src/mcp/vice/docs-linerefs.test.ts; 61 rows, none naming it"
      - path: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-audited-set-reconciliation.md"
        issue: "Zero occurrences of `docs-linerefs`; §6's exclusion table does not adjudicate it"
    missing:
      - "An explicit exclusion paragraph in 32-audited-set-reconciliation.md adjudicating every guard CUT-04 names by NAME (not only its figures), with docs-linerefs's measured 0-occurrence exclusion stated and its in-band discharge cited (plan 32-04's widening + the three planted-violation tests at docs-linerefs.test.ts:361-383)"
      - "OR a set-D/manual row in guard-fates.json for docs-linerefs.test.ts with its removalTrigger and the pointer to plan 32-04's non-vacuity proof"
  - truth: "Every `--root` argument is resolved through resolveContainedRoot() and an out-of-repo root is refused with a diagnosable message, never an uncaught ENOENT (plan 32-02 must-have 4)"
    status: failed
    reason: >-
      Reproduced live in the main checkout at HEAD. The six hand-rolled parseArgs()
      copies match only the exact token "--root" and read argv[i+1]. The equals form,
      a valueless --root and any typo are silently discarded, resolveContainedRoot()
      is never reached, and the script runs against the REAL repository while
      reporting success. Measured by me:
      `node scripts/check-guard-fates.mjs --root=/tmp` -> "check-guard-fates: OK", exit 0.
      `node scripts/check-guard-fates.mjs --rooot /tmp` -> "check-guard-fates: OK", exit 0.
      `node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here`
      -> "generate-tool-support-table: wrote docs/tool-support.md" — the REAL one — exit 0.
      That last is precisely the outcome that file's own paths() docblock (:56-62) names
      as the thing that must never happen. The space form DOES work correctly (I verified
      both the out-of-repo refusal and that an in-repo synthetic root reads and writes
      inside itself), so the defect is exactly the unmatched-token path.
      Compounding it, CR-03 is also reproduced: four of the five --root-ised gates still
      statically import their source-of-truth (CAPABILITY_REGISTRY, CURATED_ANNO_TOOLS,
      VERB_OPTIONS, DENY_LIST) from ../src/mcp/vice/*.ts — i.e. from DEFAULT_ROOT — while
      four of the five carry the verbatim docblock contract "do not re-derive a path from
      DEFAULT_ROOT anywhere below" (grep -c confirms 1 in each of
      check-skill-cli-invocations, check-skill-tool-coverage, check-skill-description-overlap,
      check-skill-fork-honesty). The seam's central soundness property is false even when
      used correctly, and it has zero callers: `guard.argv` in guard-fates.json passes
      --root in 0 of 61 rows and all 35 plants are kind:"worktree".
    artifacts:
      - path: "scripts/generate-tool-support-table.mjs"
        issue: "parseArgs() at :312-321 drops --root=<dir>; the script then WRITES the real docs/tool-support.md and prints success"
      - path: "scripts/check-guard-fates.mjs"
        issue: "parseArgs() at :836-848, same defect; a planted violation in a synthetic tree would be recorded as `the plant did not bite`"
      - path: "scripts/check-skill-tool-coverage.mjs"
        issue: "parseArgs() :99-107 same defect; plus :50-51 imports CAPABILITY_REGISTRY / CURATED_ANNO_TOOLS from DEFAULT_ROOT against its own docblock contract"
      - path: "scripts/check-skill-fork-honesty.mjs"
        issue: "parseArgs() :117-125 same defect; :70 imports CAPABILITY_REGISTRY from DEFAULT_ROOT"
      - path: "scripts/check-skill-cli-invocations.mjs"
        issue: "parseArgs() :94-102 same defect; :43 imports VERB_OPTIONS from DEFAULT_ROOT"
      - path: "scripts/check-skill-description-overlap.mjs"
        issue: "parseArgs() :111-119 same defect"
    missing:
      - "A shared parseRootArg() in scripts/lib/audit-root.mjs that throws on --root=<dir>, on a valueless --root and on any unrecognised token, called by all six scripts (audit-mutation-harness.mjs:347-353 already gets this right and is the model)"
      - "Either root-parameterised dynamic imports for the four DEFAULT_ROOT-bound registries, or an outright refusal of --root != DEFAULT_ROOT in those four with the false docblock claim deleted"
      - "At least one spawnSync test per --root-ised script: contained root reads the synthetic tree; out-of-repo root exits 1 with REFUSED; --root=<dir> exits non-zero"
      - "OR revert the flag from the four gates no plant ever needed (WR-11's second option) — the seam is currently untested, unused and unsound"
  - truth: "A fate row's plant descriptor records the mutation that was applied, so the evidence is re-runnable by hand (plan 32-01 prohibition 1; CR-02)"
    status: partial
    reason: >-
      plant() checks occurrences with text.split(find) (literal) but writes with
      text.replace(find, replace) — a STRING replacement, so `$$`, `$&`, `` $` ``, `$'`,
      `$n` and `$<name>` are still interpreted in the replacement. Row
      `src/mcp/vice/r2000-enum-gen.test.ts` records
      `replace: "return \`$${address...padStart(5, \"0\")}\`;"`, but what reached disk was
      `return \`${address...padStart(5, "0")}\`;` — the `$$` collapsed and the plant also
      silently deleted the `$` hex sigil. The registry's own captured excerpt proves it:
      `'0D011' !== '$D011'` (5 chars, no sigil) rather than the `'$0D011'` the recorded
      mutation would produce.
      IMPORTANT SCOPE LIMIT, MEASURED BY ME RATHER THAN INFERRED — this does NOT overturn
      the row's conclusion. I applied the literally-recorded mutation with a replacer
      function (no `$` interpretation) and ran the guard: exit 1, 10 failures, including
      the same named assertion `registerKeyFor formats addresses as $XXXX`. The guard is
      non-vacuous under either mutation. And I re-ran the real harness on this row in the
      main checkout: it reproduced the recorded red EXACTLY — same two failing subtests,
      same `'0D011' !== '$D011'`, same green control — differing only in timing figures
      and worktree-vs-main absolute paths. So the evidence IS machine-reproducible via the
      harness; it is only non-reproducible by hand-applying find -> replace, which is what
      the artifact promises a reader.
      Only 1 of 61 rows is affected. The two other `$`-carrying rows (`${verb}`, `$/`) are
      safe by luck, not design.
    artifacts:
      - path: "scripts/audit-mutation-harness.mjs"
        issue: ":190-201 — occurrence check is `$`-blind but the write is not; no assertion that the applied bytes equal the recorded replacement"
      - path: ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json"
        issue: "row src/mcp/vice/r2000-enum-gen.test.ts records a `replace` string that is not what was written"
      - path: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md"
        issue: ":3889 carries the same non-applied replacement string"
    missing:
      - "Use a replacer function — `text.replace(find, () => replace)` — and assert the mutated text actually contains the recorded replacement exactly once, throwing if not"
      - "Re-run the r2000-enum-gen row and correct both the registry and 32-sweep-renamed-rows.md:3889"
      - "Treat a signal-terminated child as UNMEASURABLE rather than red (CR-04): runGuard() at :295-304 maps `result.status ?? 1`, so `null` (SIGKILL/OOM/segfault) becomes a recorded exitStatus 1 with a passing pre-plant control. I checked all 35 recorded reds and NONE is a signal artifact — every one carries a distinct, failure-shaped excerpt naming an assertion — so this is a latent defect in the instrument, not a corruption of this phase's data. Fix it before the harness is used again."
deferred: []
behavior_unverified_items:
  - truth: "A harness run interrupted by SIGINT, SIGTERM, an uncaught exception or a plain process exit restores every captured original byte-for-byte, idempotently, and `git status --porcelain` returns to its pre-run value (plan 32-01 must-have 3 / plan 32-06 prohibition 1)"
    test: >-
      Send SIGINT to `node scripts/audit-mutation-harness.mjs --row <row>` while a plant
      is on disk (between plant() at :409 and the finally-revert at :416 — the planted
      guard run is the window), then compare `git status --porcelain` to its pre-run
      value. Repeat for SIGTERM and for an injected uncaughtException. Note the harness
      exports nothing (no `export` statement anywhere in the file), so this cannot be
      driven in-process; it needs a real spawned child and a race the caller controls.
    expected: >-
      Exit 130 for the signals, every planted file byte-identical to its pre-run bytes,
      and `git status --porcelain` byte-identical to the baseline. A second restoreAll()
      after the first must be a no-op rather than a re-write (the `restored` latch).
    why_human: >-
      This is a cancellation/cleanup invariant: the handlers are PRESENT and WIRED
      (`process.on("exit"|"SIGINT"|"SIGTERM"|"uncaughtException", ...)` at :103-114) and
      the NORMAL path is proven — I ran the harness four times against a live row and the
      source tree came back byte-identical every time, and :654 voids the evidence on a
      dirty tree. But the SIGNAL path is exercised by no test (nothing imports
      audit-mutation-harness.mjs anywhere in the repo) and I could not land a signal
      inside the plant window in four timed attempts (2.2s / 2.6s / 3.0s / 4.0s — all
      arrived after main() completed, exit 0, tree clean). Presence is not behaviour, and
      WR-03 raises a specific doubt about the `restored` latch that only a real
      interrupt can settle.
coincidental_reliance_items: []
---

# Phase 32: The Deletion and the Grep Gate — Verification Report

**Phase Goal:** The deletion **stays** clean — every guard and CI script that was re-pointed
off the deleted subject is audited **as a set, after the dust has settled**, and proven
non-vacuous; and no living document is left pointing a user at a route that no longer exists.

**Verified:** 2026-08-31T20:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Verdict in one paragraph

**The phase's core deliverable is real, and it is not vacuous.** I did not take the
registry's word for anything: I re-derived set A (43) and set B's raw candidates (22) from
the git object store with my own script, drove the real exported `checkGuardFates()`
predicate against nine independently mutated registries and watched it go red on every one,
re-ran the real mutation harness against a live row in the main checkout and got the recorded
red back byte-for-byte modulo timings, and re-applied one row's literally-recorded plant by
hand to check the conclusion survived CR-02. It did. Criterion 2 is met: the removal gate is
green tree-wide, all nine `docs-*.test.ts` guards pass, and my own independent short-form
(`r2000`) sweep over every tracked markdown outside `.planning/` turned up nothing but
attribution notices, dated findings documents and the gate's own fixtures. **Three things
keep this from `passed`.** One guard that `CUT-04`'s own text names by name —
`docs-linerefs.test.ts` — has no recorded fate and no recorded exclusion. Plan 32-02's
`--root` seam does not do what its own must-have says: `--root=<dir>` is silently discarded
and the writing script then overwrites the real repository while printing success, which I
reproduced. And one row's recorded mutation is not the mutation that was applied. None of the
three invalidates a recorded red, but the first and third are defects *in the record*, which
is this phase's entire product.

---

## Goal Achievement

### Observable Truths

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | Every guard and CI script pinned to the deleted subject has a recorded fate | ROADMAP SC-1 / CUT-04 | ⚠️ PARTIAL (gap) | 61/61 derived members have rows; derivation independently reproduced (setA=43, setB raw 22). But `docs-linerefs.test.ts`, named explicitly in CUT-04 and SC-1, has neither a row nor a recorded exclusion. See Gap 1 |
| 2 | None passes vacuously — each **re-pointed** guard's own planted violation re-run against its **new** subject and observed red | ROADMAP SC-1 / CUT-04 | ✓ VERIFIED | 35 `re-pointed` rows; 35/35 carry a machine-captured non-zero `exitStatus`, 35/35 a `control.exitStatus === 0`, 35/35 a distinct non-empty failure-shaped excerpt, 35/35 `control.command` byte-identical to `command`. Zero signal/timeout artifacts. Harness re-run by me reproduced one row exactly |
| 3 | Audited **as a set, at once, retrospectively**, on the settled tree | ROADMAP SC-1 | ✓ VERIFIED | Two pinned commits (`0394cbc`/`345d5c4`), one mechanical derivation, one registry, one blocking CI gate. No hand-typed member list anywhere in `check-guard-fates.mjs` (grepped) |
| 4 | The fate guard itself cannot pass vacuously | plan 32-01 | ✓ VERIFIED | I drove the real exported predicate against 9 mutations — all red. See the table below |
| 5 | No living document points a user at a deleted route | ROADMAP SC-2 / CUT-06 | ✓ VERIFIED | Removal gate exit 0; 9/9 `docs-*.test.ts` green; sweep ledger has one verdict row per file in a declared 3-clause set with the 35-vs-37 discrepancy explicitly resolved; my own independent short-form sweep found only KEEP-class text |
| 6 | The phase-close gate is re-run and recorded with its broker state | ROADMAP SC-2 (gate half) / plan 32-09 | ✓ VERIFIED | `test:automated` 0 fail, `typecheck` 0, 7/7 `check-*.mjs` 0, `docs/tool-support.md` byte-identical, `audit-gate --json` `allowed=true redGuards=[]`. Broker read read-only and recorded twice; the whole-glob substitution stated in words, not laundered |
| 7 | `PROJECT.md`'s four `vice-proxy.ts` citations, its `r2000_*` clause and its `D-36` row are repaired; `ARCHITECTURE.md`'s A21 is dated-superseded | plan 32-03 / CUT-06 | ✓ VERIFIED | `PROJECT.md:311` now cites `:3050`/`:2985`/`:1529`/`:1505` and names `anno_*`; `docs-r2000-decisions` occurs 0 times in the file; A21 carries "⚠ SUPERSEDED 2026-08-30" and is written in the past tense with no historical sentence rewritten |
| 8 | `docs-linerefs.test.ts` widened onto `PROJECT.md` with a **per-document** non-vacuity floor | plan 32-04 / D-10 | ✓ VERIFIED | `SCANNED_DOCS` = `["CLAUDE.md", ".planning/PROJECT.md"]`; floor asserted per document at `:196`; three planted-violation tests including the explicit "a global summed floor would be SATISFIED here (2 + 0 = 2)" control; `node --test docs-linerefs.test.ts` exit 0 |
| 9 | The sweep ledger carries one verdict row per swept file, numbers reconciled, no dated record rewritten | plan 32-05 / D-08, D-09 | ✓ VERIFIED | 3-clause swept set with the command for each; `grep -a` mandated and its NUL-byte proof reproduced; 35 (content) vs 37 (gate predicate) resolved with both extra files given rows; `PROJECT.md:715` adjudicated KEEP with the counter-case stated and an additive remedy named |
| 10 | The sweep rows, deleted rows, set-B rows and both deferred fates are complete and the tree is left clean | plans 32-06/07/08 | ✓ VERIFIED | 7 `deleted` rows with `newSubject: null` + `removingCommit`; 19 `kept-unchanged` with `removalTrigger`; both set-C rows recorded against their NEW triggers with no re-point performed; `vice-proxy.test.ts`'s hang avoided by a scoped guard with a first-failed-attempt recorded rather than hidden |
| 11 | D-16's named CI step with `fetch-depth: 0`, no package script, harness in no CI step | plan 32-09 | ✓ VERIFIED | `ci.yml:257-258` "Validate every audited guard has a recorded, non-vacuous fate (CUT-04)" → `node scripts/check-guard-fates.mjs`; `fetch-depth: 0` on the build job only, with its reason in a comment; exactly 1 subject literal in `ci.yml`; zero `guard-fates`/`mutation-harness` entries in either `package.json` |
| 12 | Every `--root` argument is resolved through `resolveContainedRoot()`; out-of-repo refused | plan 32-02 | ✗ FAILED | `--root=<dir>`, valueless `--root` and any typo are silently dropped by all six `parseArgs()` copies; `generate-tool-support-table.mjs --root=/tmp/definitely-not-here` overwrote the REAL `docs/tool-support.md` and exited 0. Reproduced. See Gap 2 |
| 13 | The harness restores the tree on SIGINT / SIGTERM / uncaught exception / exit | plan 32-01, 32-06 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Handlers present and wired at `:103-114`; the NORMAL path proven (4 live runs, tree byte-identical each time). The SIGNAL path has no test — the harness exports nothing — and I could not land a signal inside the plant window in 4 timed attempts. See Human Verification |

**Score:** 10/13 truths verified (1 present, behavior-unverified; 1 partial; 1 failed)

---

### The fate guard's own non-vacuity — driven by me, not read from a SUMMARY

I imported `checkGuardFates` and `deriveAuditedSet` from `scripts/check-guard-fates.mjs` and
drove the **real exported predicate** against the real derived set (union = 61) with mutated
registries:

| Mutation | Result |
|---|---|
| baseline (unmodified registry) | **GREEN** |
| one row deleted | RED (1) — "no recorded fate: `src/mcp/vice/r2000-verb-coverage.test.ts` is in the derived audited set but has no…" |
| stranger row naming a path outside the derived set | RED (2) — "stranger row: … names `scripts/not-in-set.mjs`…" |
| registry emptied | RED (62) — "structural: … carries ZERO rows" |
| all `observedRed` objects stripped | RED (35) |
| every `observedRed.exitStatus` set to 0 | RED (35) — "A recorded fate needs a…" |
| every `observedRed.control.exitStatus` set to 1 | RED (35) — "must be exactly 0" |
| every `removalTrigger` removed | RED (54) |
| every `observedRed.excerpt` blanked | RED (35) |
| every re-pointed `newSubject` pointed at a non-existent file | RED (36) |

Ten independent mutations, ten reds, one green baseline. Combined with the orchestrator's
measurement that `scripts/check-guard-fates.mjs` has exactly **one** commit (`371750e`) — so
the file reporting green is byte-identical to the file committed red, and only the registry
moved — this is a genuinely non-vacuous gate. I also confirmed by grep that the file contains
**no hardcoded member paths** (the only string literal ending in `.mjs`/`.test.ts` is its own
`./lib/audit-root.mjs` import).

### The derivation, re-derived independently

I wrote my own script against the git object store rather than calling the guard:

```
independent setA: 43            # matches SET_A_FLOOR
independent setB raw candidates: 22   # 22 - 6 already-claimed = 16, matches SET_B_FLOOR
```

The plans' 43/15/2 = 60 arithmetic was wrong and the executors corrected it to 43/16/2 = 61
with the reproducing commands in `evidence/32-audited-set-reconciliation.md` §4.1 and §7.1.
I reproduce the corrected figures, not the plans'. The correction is the right behaviour and
is not scored against the phase.

The same-path `re-pointed`/`kept-unchanged` split is mechanical and I re-ran it: all three
`kept-unchanged` same-path rows (`skill-descriptions.mjs`, `skill-attribution.test.ts`,
`stock-connect.test.ts`) return **0** subject-touching diff lines between the pins, so none is
a re-pointed guard dodging its evidence obligation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/check-guard-fates.mjs` | Derive-from-disk fate guard, floors, `--root` | ✓ VERIFIED | 952 lines; exports `deriveAuditedSet`, `checkGuardFates`, all four floors; wired into CI; exit 0. `--root` equals-form defect is Gap 2, not a stub |
| `scripts/audit-mutation-harness.mjs` | Plant → run → assert non-zero → revert, restore-on-exit | ⚠️ WIRED, TWO DEFECTS | 662 lines; strips `NODE_TEST_*`; per-row `finally { revert }` + `assertTreeClean`; voids evidence on a dirty tree. CR-02 (`$` substitution) and CR-04 (signal → false red) are real; **exports nothing**, so it is untestable in-process |
| `scripts/lib/audit-root.mjs` | `resolveContainedRoot()` | ✓ VERIFIED | 93 lines; segment-wise containment (I confirmed the `-evil` suffix note is honoured in the refusal message); refuses out-of-repo with a diagnosable message |
| `scripts/check-guard-fates.d.mts` / `scripts/lib/audit-root.d.mts` | Ambient declarations | ✓ VERIFIED | 104 / 9 lines; `npm run typecheck` exit 0 |
| `src/mcp/vice/guard-fates.test.ts` | The fate guard's own non-vacuity proof | ✓ VERIFIED | 463 lines (floor was 60); drives the real exported predicate — confirmed by my own independent drive of the same predicate |
| `src/mcp/vice/docs-linerefs.test.ts` | Widened onto PROJECT.md, per-document floor | ✓ VERIFIED | 431 lines (floor 110); `SCANNED_DOCS` names both documents; per-document floor at `:196`; 3 planted-violation tests; exit 0 |
| `.planning/phases/32-…/guard-fates.json` | The fate registry | ⚠️ VERIFIED WITH ONE BAD ROW | 61 rows, 297 KB; every verdict/evidence rule satisfied by the guard. One row's `plant.replace` is not the applied mutation (Gap 3) |
| `.planning/…/evidence/32-audited-set-reconciliation.md` | D-02's reconciliation, every addition and removal reasoned | ⚠️ INCOMPLETE | Reconciles CUT-04's **figures** and research §1.5's **candidate list**; does not adjudicate CUT-04's **named list** — `docs-linerefs` appears 0 times (Gap 1) |
| `.planning/…/evidence/32-document-sweep.md` | The CUT-06 ledger | ✓ VERIFIED | 3-clause swept set, one row per file, `grep -a` mandated and proven, 35-vs-37 resolved, `:715` adjudicated with the counter-case |
| `.planning/…/evidence/32-close-gate.md` | D-15's record with D-14's SKIP nuance in words | ✓ VERIFIED | Broker read twice read-only with the `pgrep` false-positive trap documented; the whole-glob substitution stated explicitly; six MANUAL_ONLY tests actually exercised against real VICE 3.9 **and** 3.10 |
| `.planning/…/evidence/32-tracer-observed-red.md`, `32-root-override-inventory.md`, `32-sweep-renamed-rows.md`, `32-sweep-same-path-rows.md`, `32-setb-repointed-rows.md`, `32-deferred-fates.md`, `32-fate-guard-green.md` | Per-plan raw evidence | ✓ PRESENT, SUBSTANTIVE | 10 evidence files, 647 KB total; the two sweep files carry raw command + raw output + exit status + plant + broker state per row |
| `.github/workflows/ci.yml` | `fetch-depth: 0` + one new named step | ✓ VERIFIED | Both present, on the build job, with the shallow-clone reason in a comment; exactly 1 subject literal |
| `.planning/PROJECT.md`, `.planning/ARCHITECTURE.md` | CUT-06 part A | ✓ VERIFIED | Confirmed by reading both |
| `.planning/…/COVERAGE.md`, `deferred-items.md` | Declarations | ✓ VERIFIED | Reasoned no-external-API declaration; the `repo-root.test.ts` worktree failure correctly attributed and left alone with the right reason |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `check-guard-fates.mjs` | `lib/audit-root.mjs` | `resolveContainedRoot` | ✓ WIRED | Imported and called; space-form refusal reproduced |
| `audit-mutation-harness.mjs` | `guard-fates.json` | reads plant descriptors, writes back `observedRed` | ✓ WIRED | I ran it: it read the row, planted, ran the guard, reverted, and wrote back an excerpt matching the committed one |
| `guard-fates.test.ts` | `check-guard-fates.mjs` | imports the real predicate | ✓ WIRED | Confirmed by driving the same export myself |
| `.github/workflows/ci.yml` | `check-guard-fates.mjs` | named `run:` step | ✓ WIRED | `:257-258` |
| `docs-linerefs.test.ts` | `.planning/PROJECT.md` + `vice-proxy.ts` | `SCANNED_DOCS` + read-back of cited lines | ✓ WIRED | 12/12 against the real files |
| `guard-fates.json` | `.planning/ROADMAP.md` § Phase 32 | set C parsed from the deferred-fates note | ✓ WIRED | Guard reports "set C parsed from `.planning/ROADMAP.md` line 814" |
| Five re-pointed scripts | `lib/audit-root.mjs` | `--root` | ⚠️ PARTIAL | Space form wired; equals form bypasses the seam entirely (Gap 2). **Zero callers**: 0 of 61 `guard.argv` pass `--root`, 35/35 plants are `kind:"worktree"` |
| Four `--root`-ised gates | `../src/mcp/vice/*.ts` | static ESM imports of the comparison data | ✗ CONTRADICTS THE STATED CONTRACT | The data is read from `DEFAULT_ROOT` regardless of `--root`, against each file's own verbatim docblock prohibition |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces real data | Status |
|---|---|---|---|---|
| `guard-fates.json` rows | 61 member paths | `git ls-tree` / `git diff` at two pinned commits + `ROADMAP.md` parse | Yes — independently re-derived by me | ✓ FLOWING |
| `guard-fates.json` `observedRed` | exit status + excerpt | `spawnSync` of the named guard, captured | Yes — I re-ran one row and the excerpt reproduced | ✓ FLOWING |
| `guard-fates.json` `plant.replace` | recorded mutation string | hand-authored descriptor, applied through `String.replace` | **No** for 1 of 61 rows — recorded ≠ applied | ⚠️ STATIC (one row) |
| `check-guard-fates.mjs` floors | 43 / 16 / 2 / 61 | re-measured constants, `!==` asserted per set | Yes — all three reproduce | ✓ FLOWING |
| `docs-linerefs.test.ts` citations | `vice-proxy.ts:N` | extracted from the live documents, read back against the live source | Yes | ✓ FLOWING |
| `32-document-sweep.md` counts | per-file line/occurrence counts | byte-level `latin1` scan + `grep -a` | Yes — the NUL-byte 35-vs-34 delta reproduces | ✓ FLOWING |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Fate guard green on the real tree | `node scripts/check-guard-fates.mjs` | `OK -- setA=43 setB=16 setC=2 total=61 rows=61` | ✓ PASS |
| Fate predicate non-vacuous | drove `checkGuardFates()` against 9 mutated registries | 9/9 red, baseline green | ✓ PASS |
| Set derivation reproducible | my own git-only script | setA=43, setB raw=22 | ✓ PASS |
| Recorded red re-runnable | `node scripts/audit-mutation-harness.mjs --row src/mcp/vice/r2000-enum-gen.test.ts` | Reproduced the committed excerpt exactly (timings/paths aside); tree restored byte-identical | ✓ PASS |
| CR-02 conclusion survives the literal plant | applied the recorded `replace` with a replacer fn, ran `node --test anno-enum-gen.test.ts` | exit 1, 10 failures, same named assertion | ✓ PASS |
| All nine `docs-*.test.ts` | `node --test docs-*.test.ts` individually | 9/9 exit 0 | ✓ PASS |
| All seven `check-*.mjs` | each invoked bare | 7/7 exit 0 | ✓ PASS |
| `docs/tool-support.md` byte-identical | regenerate + `git diff --exit-code` | IDENTICAL | ✓ PASS |
| `audit-gate.mjs --json` | as written | `allowed:true, redGuards:[]` | ✓ PASS |
| CR-01 — `--root=<dir>` on the read gate | `node scripts/check-guard-fates.mjs --root=/tmp` | `OK …`, exit 0 (should have refused) | ✗ FAIL |
| CR-01 — typo'd flag | `node scripts/check-guard-fates.mjs --rooot /tmp` | `OK …`, exit 0 | ✗ FAIL |
| CR-01 — `--root=<dir>` on the WRITING script | `node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here` | `wrote docs/tool-support.md` — the real one | ✗ FAIL |
| `--root <dir>` space form, out of repo | `… --root /tmp/…/synth` | `REFUSED — … OUTSIDE the repository root …`, exit 1 | ✓ PASS |
| `--root <dir>` space form, in repo | `… --root .synth-verify` | Read inputs from inside the synthetic root, did not touch the real table | ✓ PASS |
| CR-03 — four gates import from `DEFAULT_ROOT` | grep for `^import.*from "\.\./src` | 2+1+1+2 static imports found; 4/5 files also carry the contradicting docblock | ✗ FAIL |
| Harness restore on SIGINT mid-plant | 4 timed `kill -INT` attempts | Signal always landed post-completion; tree clean each time but the path was not exercised | ? SKIP → human |
| Working tree after all of my probing | `git status --porcelain` | Identical to the pre-verification baseline (4 pre-existing untracked files) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no PLAN or SUMMARY declares one.
This phase's probe equivalents are `scripts/check-*.mjs` and `scripts/audit-mutation-harness.mjs`,
all of which I executed directly and recorded above. **Step 7c: satisfied by the check-script
and harness runs; no conventional probe corpus exists.**

### Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
|---|---|---|---|---|
| `CUT-04` | 32-01, 32-02, 32-06, 32-07, 32-08, 32-09 | Every guard and CI script pinned to the deleted subject has a recorded fate and none passes vacuously | ⚠️ **SATISFIED WITH ONE NAMED EXCEPTION** | 61/61 fates, 35/35 machine-captured reds with green controls, guard non-vacuous under 10 mutations. **But** `docs-linerefs` — named in this requirement's own "Named explicitly:" list — has no fate and no exclusion. Its non-vacuity IS established in-band (plan 32-04's per-document floor + 3 planted-violation tests), so the substance holds and only the record is short. The `[x]` is *defensible* but premature until the exclusion is written down |
| `CUT-06` | 32-03, 32-04, 32-05, 32-09 | Every living document naming the deleted route as a required prerequisite is corrected | ✓ **SATISFIED** | Removal gate green tree-wide; 9/9 docs guards green; one verdict row per swept file across a declared 3-clause set; my own independent short-form sweep found only attribution notices, dated findings and gate fixtures. The `[x]` is justified |

**Orphaned requirements:** none. `grep "Phase 32" .planning/REQUIREMENTS.md` maps exactly
`CUT-04` and `CUT-06`, both claimed by plan frontmatter. The six rows `D-01` moved to Phase 29
(`REPOINT-01/02`, `CUT-01/02/03/05`) are correctly absent from this phase's `requirements:`
lines, so every requirement still maps to exactly one phase.

**On plan 32-09 flipping both to `[x]` / Complete:** `CUT-06` — justified, verified
independently. `CUT-04` — the substantive claim is verified and I would not revert the row,
but the requirement text names a guard the deliverable does not account for. My
recommendation is to close Gap 1 (a paragraph, not code) rather than to demote the row, and
to record that decision beside it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None.** Scanned all 16 phase-modified source and planning files; zero debt markers. The debt gate is clean |
| `scripts/generate-tool-support-table.mjs` | 312-321 | Silent argument drop on a **writing** script | 🛑 Blocker | Overwrites the real repository under an operator typo while printing success — the exact outcome its own docblock forbids |
| `scripts/check-guard-fates.mjs` + 4 others | 836-848 et al | Same `parseArgs()` copy-pasted six times | ⚠️ Warning | Six copies of one defect; `audit-mutation-harness.mjs:347-353` is the correct model and was not reused |
| `scripts/check-skill-{tool-coverage,fork-honesty,cli-invocations}.mjs`, `generate-tool-support-table.mjs` | 50-51, 70, 43, 40-41 | Static import from `DEFAULT_ROOT` under a docblock forbidding exactly that | 🛑 Blocker (of the seam, not the goal) | A plant in a synthetic tree is invisible to the comparison data — a false green in the audit instrument itself |
| `scripts/audit-mutation-harness.mjs` | 190-201 | Recorded mutation ≠ applied mutation | ⚠️ Warning | 1 of 61 rows; conclusion survives (I checked) but the record is not hand-reproducible |
| `scripts/audit-mutation-harness.mjs` | 295-304 | `result.status ?? 1` swallows `signal` | ⚠️ Warning | A signal-killed child would be a false red. **Latent only** — I audited all 35 reds and none is a signal artifact |
| `src/mcp/vice/docs-linerefs.test.ts` | 262-266 | `isCallSite \|\| isFunctionStart` relaxation arm | ⚠️ Warning | Unreachable for a correct document, reachable for a drifted one — a relaxation branch with no upside in a non-vacuity guard |
| `scripts/check-guard-fates.mjs` | 80-90, 483; `ci.yml:257` | Blocking CI gate hard-depends on live `.planning/` phase artifacts | ⚠️ Warning | Survives this milestone (`--no-archive-phases`), but CI goes red on archive or `phases.clear` for a reason unrelated to the code. The gate also demands a `removalTrigger` of 54 rows while having none itself |
| `scripts/audit-mutation-harness.mjs` | whole file | No `export` statement anywhere | ⚠️ Warning | The phase's own instrument is the one artifact in the phase with no test seam; this is why truth 13 cannot be closed |

None of these is an *implementation stub*. Every artifact this phase claims is present,
substantive and wired; the defects are correctness defects in real code, which is the harder
class.

---

## Answers to the four questions put to me

**1. Is criterion 1 actually met, or only apparently met?**
**Met in substance, with one row I would qualify and one guard I would not yet call
recorded.** I did not rely on the SUMMARY or on the guard's own green. I drove the real
predicate against ten registry mutations and it went red on every one; I re-derived the set
from git independently and got the same 43/22; I re-ran the harness against a live row and it
reproduced the committed excerpt exactly; and I audited all 35 reds for the two failure modes
`32-REVIEW.md` raises. **On CR-02:** the defect is real (I reproduced the `$$` collapse) but
narrower than "the reds are untrustworthy". The recorded excerpt for
`src/mcp/vice/r2000-enum-gen.test.ts` is *machine*-reproducible — re-running the harness
regenerates it byte-for-byte — it is only *hand*-reproducible-from-the-record that fails. And
I applied the literally-recorded mutation myself: the guard still goes red, on the same named
assertion. So the conclusion for that row stands; the record needs correcting. **On CR-04:**
it is a live mechanism but it did not fire here — all 35 reds carry a distinct, failure-shaped
excerpt naming an assertion; none is a bare non-zero status. **Rows I would not rely on:**
exactly one, `src/mcp/vice/r2000-enum-gen.test.ts`, and only for its `plant` field, not for
its verdict. The remaining 34 reds I would rely on.

**2. Is the `--root` seam load-bearing or decorative?**
**Decorative, and worse than decorative — it is an unsound instrument with a plausible
footgun.** Plan 32-02 was a whole wave and its deliverable serves the goal in no measurable
way: 0 of 61 rows pass `--root` in `guard.argv`, all 35 plants are `kind:"worktree"`, no CI
step and no test touches it on any of the five scripts, and the registry's own notes say so.
Meanwhile its central claim is false in two independent ways I reproduced live — the equals
form silently measures (and, for the generator, **writes**) the real repository while printing
success, and four of the five gates read their comparison data from `DEFAULT_ROOT` in direct
contradiction of the contract each states verbatim. Applying the phase's own standard to its
own deliverable: **this is the vacuity CUT-04 exists to catch, shipped inside CUT-04's phase.**
It is not a goal blocker, because no recorded evidence depends on it. It is a must-have
failure and it should be either fixed with tests or reverted before anyone reaches for it.

**3. Does criterion 2's document sweep establish what it claims?**
**Yes.** The 35-vs-37 discrepancy is not a hole — it is explicitly derived, explained
(`subjectHits()` scans path *and* text, and the gate and its `.d.mts` carry the literal only
in their paths), and **both** extra files get verdict rows, on the stated D-09 ground that a
file the gate itself counts is a file we must be able to say we looked at. On `PROJECT.md:715`:
I read the passage and both plans' reasoning. The KEEP is correct on the test that matters —
`CUT-06` corrects *routes*, and that sentence names no tool, no package and no command, so a
reader cannot be mis-routed by it. What makes it a good decision rather than a lucky one is
that plan 32-05 recorded the measurement that makes the sentence stale (seven zeros across the
playbooks), stated the case *for* correcting it first, and named the additive remedy it
deliberately did not apply. That is the opposite of laundering. I also ran my own check the
ledger does not: a **short-form** (`r2000`, not `regenerator2000`) sweep over every tracked
markdown outside `.planning/`. It surfaces only attribution notices, dated findings documents,
and the removal gate's own planted fixtures — no live route.

**4. Is anything green for the wrong reason?**
**Two things, and one near-miss.** (a) The `--root` seam is green because nothing exercises
it — precisely the "no caller, no test, therefore no red" shape. (b) `CUT-04`'s `[x]` is green
partly because the reconciliation reconciled the requirement's *figures* and not its *names*,
so the one guard it names by name fell out of the audit without anyone recording that it had.
(c) The near-miss: `checkGuardFates()`'s `redOwed()` does not require `control.command ===
command`, does not tie the red to the row's subject, and does not require a `plant` at all
(WR-06) — so a hand-typed `observedRed` would pass the CI gate. I checked the actual data and
it is clean on all three counts (35/35 command-paired, 35/35 distinct excerpts, 35/35 with a
plant), so the registry is honest today; but it is honest because the harness was honest, not
because the gate forces it. That is a gap between the gate's strength and the claim it
licenses, and it is worth closing while the phase's context is fresh.

---

### Human Verification Required

#### 1. The harness's restore-on-signal invariant

**Test:** Send `SIGINT` to `node scripts/audit-mutation-harness.mjs --row <any re-pointed row>`
while a plant is on disk — the window is between `plant()` (`:409`) and the `finally { revert }`
(`:416`), i.e. during the planted guard run. Then compare `git status --porcelain` to its
pre-run value. Repeat for `SIGTERM`, and for an injected `uncaughtException`. Note the harness
has **no exports**, so this needs a spawned child and a controlled race.
**Expected:** exit 130 for the signals; every planted file byte-identical to its pre-run bytes;
`git status --porcelain` byte-identical to the baseline; a second `restoreAll()` a no-op.
**Why human:** a cleanup/cancellation invariant that presence checks cannot see. The handlers
are wired at `:103-114` and the **normal** path is proven (I ran the harness four times against
a live row; the source tree came back byte-identical every time, and `:654` voids the evidence
on a dirty tree). But nothing in the repository imports this file, so the signal path has no
test, and my four timed `kill -INT` attempts (2.2s / 2.6s / 3.0s / 4.0s) all landed after
`main()` had already returned. WR-03 raises a specific doubt about the `restored` latch that
only a real mid-plant interrupt can settle.

---

### Gaps Summary

Three gaps, in descending order of how much they bear on the goal.

**Gap 2 (`--root`) is the one I would fix first**, not because it threatens this phase's
evidence — it does not, since no plant used it — but because it is *shipped, blocking-CI-adjacent
code with a live footgun*: a plausible operator typo makes a writing script overwrite the real
repository and report success. It is also the phase's clearest self-inflicted vacuity: ~500
lines, zero callers, zero tests, and a soundness property that is false in two independent ways.
Either land the missing coverage and fix CR-01/CR-03, or revert the flag from the four gates
that never needed it. Both are acceptable; keeping the claim *and* the split read is the one
option that should not stand.

**Gap 1 (`docs-linerefs`'s missing fate) is the smallest fix and the most on-point.** This is an
audit phase whose central deliverable is a *record*, and the one guard its own requirement names
by name is the one guard with no record. The substance is fine — plan 32-04 widened that guard,
gave it a per-document non-vacuity floor and three planted-violation controls, and it is green —
so this is a paragraph in `32-audited-set-reconciliation.md`, not code. Write down why the
mechanical predicate cannot reach it (measured: 0 subject occurrences at `0394cbc`, not added
between the pins) and where its non-vacuity was discharged instead. Until that exists, a later
reader cannot tell "we looked and it is fine" from "we never looked", which is D-09's own test.

**Gap 3 (CR-02 / CR-04 in the harness) is evidence hygiene.** One row's recorded mutation is not
the applied mutation; I verified the conclusion survives, so no verdict changes, but the row and
its evidence line should be re-run and corrected, and `plant()` should use a replacer function
with a post-condition assertion so it cannot recur. CR-04 should be fixed in the same edit —
it did not fire here (I audited all 35 reds) but it is a live path on a host with earlyoom
installed, and it would produce exactly the false red this phase exists to prevent.

**Not counted against the phase**, and recorded here so a later reader does not re-litigate
them: the plans' 43/15/2 arithmetic was wrong and the executors corrected it *with reproducing
commands* — that is the correct behaviour and I reproduce the corrected figures; the
`repo-root.test.ts` worktree failure is environmental and correctly attributed in
`deferred-items.md`; broken windows #28–#32 were **filed by** this phase as findings, which is
a deliverable of an audit phase; and the 25 review findings post-date all nine plans, so no plan
could have addressed them — I weighed them as evidence about the artifact and reproduced the
four critical ones myself rather than citing them.

**One structural note for the milestone close**, flagged now because it is cheap now and
expensive later: the new blocking CI gate reads two live `.planning/` phase artifacts
(`ROADMAP.md` § Phase 32's deferred-fates note, and this phase's `guard-fates.json`). The close
is `--no-archive-phases`, so it holds — but the coupling should be recorded on the close
checklist, and the gate should be given the removal trigger it demands of 54 other rows.

---

_Verified: 2026-08-31T20:10:00Z_
_Verifier: Claude (gsd-verifier) — every measurement in this report was taken in the main
checkout at HEAD by the verifier, not read from a SUMMARY. The working tree was returned to its
pre-verification state (confirmed by `git status --porcelain`) after every mutation probe._
