---
audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

# Phase 32 review — 25 findings, disposition: OPEN, not fixed

## Why this file exists

`/gsd-execute-phase 32` ran its required `execute:post` code-review gate after the last
wave merged. The review is advisory by contract and does not block the phase, but
`docs-review-disposition.test.ts` went red the moment `32-REVIEW.md` was written:

```
finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): CR-01
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): CR-02
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): CR-03
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): CR-04
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): IN-01 .. IN-07
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): WR-01, WR-02, WR-04 .. WR-14
```

They are dispositioned **here**, not by editing a SUMMARY or `32-VERIFICATION.md`, for the
reason the phase-28 round-2 and round-3 todos already give: those files are evidence written
by the agent that did the work, and editing them from the orchestrator seat to turn a guard
green is fact-laundering. A todo is the guard's own documented alternative and survives
re-verification.

**This is a tracking record, not a fix.** Full evidence — every reproduction driven through
the production code, with verbatim output — is in
`.planning/phases/32-the-deletion-and-the-grep-gate/32-REVIEW.md`. Do not re-derive it here;
read it there.

## Disposition: OPEN, out of scope for the phase that produced them

All 25 were found *by* the review that runs at the tail of phase 32, after all nine plans had
merged, so no plan in the phase could have addressed them. Closing the blockers is a gap-closure
round (`/gsd-plan-phase 32 --gaps` → `/gsd-execute-phase 32 --gaps-only`), not a repair
belonging to the waves just executed.

Note what the review did **not** find, because it bounds how much of the phase this calls into
question: `checkGuardFates()` is pure and injection-based, the three sub-set floors use `!==`
rather than `>=`, all 21 planted-violation tests drive the real exported predicate, the gate
runs green at 61/61 rows, and the reviewer independently re-verified the NUL offsets
(15097 / line 315), the one-hit `grep -a` difference at `anno-memmap-render.ts:79`, and the two
function-start line citations (`:1505` `gatherWedgeEvidence`, `:2985` `forwardToVice`). The
core of the audit instrument holds. The defects are in its periphery.

## The four blockers

### CR-01 — `--root=<dir>`, a valueless `--root`, and any typo are silently discarded

All six new `parseArgs()` copies accept only the space-separated form and fall back to
`DEFAULT_ROOT` otherwise. For the one script that *writes*, this is destructive rather than
merely inert:

```
$ node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here
generate-tool-support-table: wrote docs/tool-support.md      # the REAL one
```

That is verbatim the outcome the file's own docblock calls "worse than no flag at all". The
mutation harness rejects unknown args; the other six do not. This is the highest-value fix
here and the cheapest.

### CR-02 — `plant()` writes bytes that differ from the bytes it records

`text.replace(find, replace)` still honours `$$` and other `$`-patterns in the replacement
string. Row `src/mcp/vice/r2000-enum-gen.test.ts` records
`` replace: return `$${address…padStart(5, "0")}`; `` but what reached disk was
`` return `${address…padStart(5, "0")}`; `` — the `$` sigil was silently consumed. The
evidence at `32-sweep-renamed-rows.md:3889` is therefore not reproducible from its own record.
That matters more than an ordinary escaping bug: reproducibility of recorded evidence is the
property this phase exists to establish.

### CR-03 — "every path comes from ONE root" is false in four of five gates

`CAPABILITY_REGISTRY`, `CURATED_ANNO_TOOLS`, `VERB_OPTIONS` and `DENY_LIST` are static
`import`s from `../src/mcp/vice/*.ts` and are unaffected by `--root`. Under a synthetic tree
the gate compares the synthetic corpus against the *real* registry — a false green inside the
audit instrument itself.

### CR-04 — a guard child killed by a signal is recorded as an observed red

`spawnSync` returns `status: null` on a signal kill and `result.status ?? 1` turns that into
`exitStatus: 1`. The green control runs *before* the plant, so it offers no protection against
a kill that happens during the planted run. This host has earlyoom installed and `node --test`
suites are memory-hungry, so it is a live path, not a theoretical one. Same failure class as
the timeout-maps-to-1 problem the sweeps already worked around by hand.

## The fourteen warnings

`WR-01` every spawn error reported as a timeout · `WR-02` no `maxBuffer` on the guard
`spawnSync`, output silently truncated · `WR-03` the `restored` latch permanently disarms
restore-on-exit and buys nothing · `WR-04` `resolveContainedRoot()` is lexical, so `plant()`'s
containment claim is false under a symlink · `WR-05` `resolveBin()`'s documented
`["--run", …] -> npm` convention produces an invalid npm command (already hit and worked
around by plans 32-06 and 32-07) · `WR-06` `checkGuardFates()` never ties the observed red,
its control, or the plant to the row's subject · `WR-07` `removingCommit` validated only as a
non-empty string · `WR-08` `TOTAL_FLOOR` never checked against the three sub-floors, and is
the only `>=` comparison · `WR-09` `docs-linerefs.test.ts`'s `isFunctionStart` arm is
permanently unreachable but still weakens the assertion · `WR-10` the new blocking CI gate
hard-depends on live `.planning/` phase artifacts (a milestone archive reds CI) and demands a
`removalTrigger` from all 54 non-deleted rows while carrying none itself · `WR-11` the
`--root` seam (~500 lines across five scripts) ships with zero callers and zero tests; all 35
plants are `kind: "worktree"` · `WR-12` `evidenceMarkdown()` interpolates untrusted text into
inline code and fenced blocks without escaping · `WR-13` `audit-root.mjs` claims to be the
single containment seam but the one pre-existing `--root` consumer was not migrated ·
`WR-14` `--json` mode emits no JSON on the derive/load failure path.

**`WR-10` and `WR-11` deserve attention beyond their severity.** `WR-10` is a CI-availability
risk on a gate that is now blocking, and it interacts with this milestone's standing
`--no-archive-phases` constraint. `WR-11` says the entire `--root` seam that plan 32-02 spent
a wave building is currently dead code — which is a scope question for a future round, not a
defect to patch.

## The seven info findings

`IN-01` `allowExtra` has no production caller · `IN-02` the harness's "tree restored
byte-identical" claim excludes its own two writes · `IN-03` `restoreAll()` only restores what
the harness planted · `IN-04` `nameDescendantCandidates()`'s empty successor prefix can
mis-attribute a rename (related to, but distinct from, broken window #29) · `IN-05` no
`unhandledRejection` handler alongside `uncaughtException` · `IN-06` `parseArgs()` is
copy-pasted verbatim into six files · `IN-07` the `--root` refusal/typo preamble is duplicated
four times.

## What closing these looks like

`CR-01`, `CR-02` and `CR-04` are narrow and mechanical — accept `--flag=value` and reject
unknown args in the shared parser; use a replacement *function* so `$` is literal; treat
`status === null` with a non-null `signal` as UNMEASURABLE rather than as a red. `IN-06` and
`IN-07` fall out of `CR-01` for free if the parser is extracted rather than fixed six times.
`CR-03` is a design question of the same shape `--root` already answered once — what is the
source of truth under a synthetic tree — and should be planned, not patched. `WR-11` should be
settled before more is invested in the seam: either give it a caller or record why it stays.

Related open broken windows from the same phase, tracked separately in `.planning/WINDOWS.md`:
#28 (`audit-gate.mjs --json` cannot signal a structural error through its exit status), #29
(`r2000-upstream-audit.test.ts` is a rename the derivation cannot express), #30
(`block-class.ts:196`'s `"Undefined"` arm is already inert), #31 (the guard rejects
`observedRed` on `kept-unchanged`), #32 (`fork-live.test.ts` has no exercise route anywhere).
