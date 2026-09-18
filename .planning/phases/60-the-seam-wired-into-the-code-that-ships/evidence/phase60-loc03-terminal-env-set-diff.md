# Phase 60 — Terminal Environment Layer Failing-Set Difference (LOC-03, third measurement)

Plan 60-08, Task 3. Re-measures "nothing changed for anyone who already had it working" as a SET
difference between the tree as it stood at the end of the phase's second gap-closure round and the
tree as it stands after this round — the third time this claim is measured in this phase, because
this round changes the environment-layer contract again (the separator-containing shape becomes
terminal, and one shipped test's contract is deliberately reversed). Repeats plan 60-05's and plan
60-07's own method (`phase60-suite-set-diff.md`, `phase60-gap-closure-suite-set-diff.md`), never a
total or a percentage, per this project's own operational record of three distinct ways to measure
this claim wrongly (Pitfall 3, `60-RESEARCH.md`) and per `60-VALIDATION.md`'s two standing facts
binding every command in this note.

## SHAs

- **Baseline (the last commit touching `src/mcp/vice/` before this round began, and the tree
  `60-VERIFICATION.md` reproduced the residual against):** `d7d5a151`
  (`d7d5a1517e3997c9c14f5cfb3f1777c8f620bc0f`) — "feat(60-07): the seam's own reason reaches the
  c1541 and petcat refusals a user reads."
- **Post-round (this note's final measurement, this plan's own HEAD at measurement time):**
  `2cf21509` (`2cf21509c019f3846662969a10634205124218c4`) — "fix(60-08): refusal stops claiming a
  $PATH protection that cannot apply to a directory-kind id," built on `f0a51757`
  ("feat(60-08): stale absolute VICE_BIN refuses by name instead of starting a decoy"), itself
  built on `d7d5a151`.

## Commands, exit status, and the no-broker precondition

Every command below is the FULL `npm test` glob (`node --test '*.test.*'`), never
`npm run test:automated`, which filters out `MANUAL_ONLY_TESTS` (`test-gate.mjs`) and therefore
cannot support this claim. Every exit status is read on the SAME line as the redirect, never
through a pipe.

**Precondition, both runs:** no `vice-broker` process running. Checked with a self-exclusion
pattern (`pgrep -af '[v]ice-broker'`) so the check's own shell invocation text — which trivially
contains the search string `vice-broker` once quoted — is never mistaken for a match; the bracket
around the first letter is a regex character class of one, matching the literal `v`, so the
invoking process's own command line never satisfies its own pattern.

```text
$ pgrep -af '[v]ice-broker'
NO_BROKER
```

Re-run immediately before the post-round measurement and again before the baseline measurement,
with the identical `NO_BROKER` result both times.

### Post-round (final, at `2cf21509`, in the working tree)

```text
$ cd src/mcp/vice && node --test --test-reporter=tap '*.test.*' > /tmp/60-08-t3-post.tap 2>&1; echo "POST_EXIT=$?"
POST_EXIT=0
```

Summary: `4032 tests / 3951 pass / 0 fail / 81 skipped`.

**Reporter note (repeated from the prior two notes because it is load-bearing every time):** this
run passes `--test-reporter=tap` explicitly, placed before the glob argument. Node 24.20.0's
default `node --test` reporter on this host is the spec-style reporter (`✔`/`✖`) even when stdout
is redirected to a file, so a bare `npm test > file 2>&1` produces no `# tests`/`# pass`/`# fail`
summary line and no `not ok` line to grep for — the regex-based failing-set extraction this task's
own verify block specifies would silently report zero failures regardless of the real result.
`--test-reporter=tap` restores the TAP summary and `not ok` lines this note's failing-set
extraction depends on, with no other behavioural difference.

### Baseline (at `d7d5a151`, in a `mktemp -d` detached worktree)

```text
$ R=$(git rev-parse --show-toplevel)
$ W=$(mktemp -d)
$ git worktree add --detach "$W/base" d7d5a151
WORKTREE_EXIT=0
$ ln -s "$R/src/mcp/vice/node_modules" "$W/base/src/mcp/vice/node_modules"
$ cd "$W/base/src/mcp/vice" && node --test --test-reporter=tap '*.test.*' > /tmp/60-08-t3-base.tap 2>&1; echo "BASE_EXIT=$?"
BASE_EXIT=1
```

Summary: `4020 tests / 3931 pass / 7 fail / 82 skipped`.

The baseline worktree was removed with `git worktree remove --force "$W/base"` and the `mktemp -d`
scratch directory was deleted with `rm -rf` immediately after the baseline run — this host's system
temp directory is RAM-backed (tmpfs) with automatic cleanup disabled. `git worktree list` afterward
showed only the main working tree.

## Baseline failing SET (7)

```text
resolveStagingParent(): the DEFAULT outDir stages inside node_modules/.cache -- the one directory the project's recursive walks structurally exclude
a real default build leaves no .build-tmp-* directory in the walked tree, before or after
D-3: containerpath.ts's own source contains no literal of the runtime-derived host root
the real captured grant: all three fields translate independently, three separate assertions
the committed provenance document's citation ledger is complete and every anchor resolves
the committed phase59 placement document's citation ledger is complete and every anchor resolves
containerize safety net: a grant whose epoch_file translates outside the workspace is refused, falling back to the port-derived path
```

Five of the seven are the identical measurement-methodology artifacts both prior evidence notes in
this phase already found and explained (`build-atomic.test.ts` (2), `containerpath.test.ts` (2),
`vice-proxy.test.ts` (1)) — a consequence of the `mktemp -d`/`/tmp` scratch worktree this task's own
instructions specify (a container-only filesystem by `hostpath.ts`'s own detection, and a
different-device symlink target for `build-atomic.test.ts`'s device-identity check), not a
baseline source-code defect. These are attributable to the measurement environment, not to
`d7d5a151`'s own correctness, and are reproduced here because the same baseline methodology is used
a third time.

The remaining two (`phase58-citation-ledger.test.ts`'s two subtests) are attributable to
`d7d5a151` predating plan 60-07's own citation-drift fix commit `e3beb3f5` — `e3beb3f5` is built ON
TOP OF `d7d5a151` in the commit graph (`d7d5a151` is `e3beb3f5`'s direct parent), so `d7d5a151`'s
own citation ledger is known-stale relative to the committed docs from `e3beb3f5` onward. This is
expected: the baseline commit for this note is deliberately chosen as "the last commit touching
`src/mcp/vice/` before this round began," which sits upstream of that unrelated docs fix. Both
subtests are absent from the post-round set below, because this plan's own HEAD `2cf21509`
descends from `e3beb3f5` (which already carries the fix) — and this plan's own Task 1 additionally
repaired two further, DIFFERENT citation drifts its own header rewrite introduced on top of that
(see "Regressions found and fixed" below).

## Post-round failing SET (0)

```text
(empty)
```

## Two-way difference

```text
$ comm -13 /tmp/60-08-base-failset.txt /tmp/60-08-post-failset.txt   # regressions: in post, not in base
end_of_regressions
```

**The regression list is EMPTY.** No test that passed at the baseline fails in the post-round tree.
(For completeness, `comm -23` — present in base, absent from post — reproduces all seven
baseline-only entries above; none is a regression by definition, since the post-round set they are
being compared against is itself empty.)

## Regressions found and fixed (within this plan, before the final measurement above)

This task's own required full-suite run is a REAL comparison. Task 1's header rewrite into
`tool-location.mts` (rewriting the module's own Phase-60 explanatory paragraph and the Layer 1
block comment to record the corrected LOC-03 history) shifted the line range of
`export function resolveOnPath(...)` from `293-308` to `313-328`, which drifted TWO citations:

```text
phase58-citation-ledger.test.ts :: the committed phase59 placement document's citation ledger is complete and every anchor resolves
```

**Caused by this plan's own Task 1.** Fixed by updating both the prose line reference and the
ledger's own `citation` field in `docs/phase59-tool-location-placement.md` from
`src/mcp/vice/tool-location.mts:293-308` to `src/mcp/vice/tool-location.mts:313-328`, re-verified
against the live source by re-running `phase58-citation-ledger.test.ts` itself.

A second, unrelated citation-ledger failure was ALSO surfaced by the same run, into
`docs/phase58-declaration-provenance.md`:

```text
phase58-citation-ledger.test.ts :: the committed provenance document's citation ledger is complete and every anchor resolves
```

Its cited range (`.planning/ROADMAP.md:1999-2002`) no longer contained the anchor text "a user
missing ACME learns that" — the text had drifted to line 2004 from unrelated ROADMAP edits
accumulated since the citation was written (the identical failure class plan 60-07's own evidence
note recorded for a different ROADMAP citation: "orchestrator-driven progress-table updates across
this phase's plans, not any single plan's source diff"). **Not caused by this plan's own source
diff — pre-existing drift this measurement happened to be the first in THIS round to catch,**
following the identical precedent plan 60-07 set for the same situation. Fixed by updating the
cited range to `.planning/ROADMAP.md:2002-2005`, re-verified the same way.

Both fixes were made within Task 1 (committed at `f0a51757`) rather than merely reported, per this
project's own precedent (plan 60-05's and plan 60-07's regressions-found-and-fixed sections) and
per this task's own acceptance criterion: "If a test that passed at baseline fails now and is not
on the deliberate list, the verdict names it and this task is NOT done." Both are documentation-only
fixes — no `src/mcp/vice` production or test source was touched by either.

## Deliberate contract changes named (so a reader can tell intended from regression)

- **`vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4", rewritten in place — named under BOTH its
  old assertion and its new one.** OLD (asserted by plan 60-06, and never touched by plan 60-07):
  `first.layer === "probe"` and `first.path === onPathStub` — i.e. a separator-containing,
  unresolvable `VICE_BIN` (`/definitely/does/not/exist/x64sc`) with a decoy `x64sc` on the injected
  `PATH` resolved through the declared-id `$PATH` probe layer and returned the decoy's own path.
  NEW (this plan): `first.path === null`, `first.layer === null`, `first.mechanism === null`, and a
  non-null `refusal` naming both `VICE_BIN` and the unresolved value; the on-PATH stub is asserted
  `notEqual` to the returned path, and no `$PATH` candidate for the declared id appears in `tried`
  at all. **The correction that justifies the reversal:** plan 60-06's own SUMMARY (Deviation #1)
  recorded this test as pinning "pre-existing behaviour... unchanged before this plan," but this
  was a mischaracterisation — `60-VERIFICATION.md` read the pre-phase source directly
  (`git show d54d98a1:src/mcp/vice/backend-detect.mts`) and found that `defaultResolveBinPath()`
  returned `null` with NO `$PATH` walk at all for a separator-containing value that resolved
  nowhere, before Phase 60 began. The behaviour this test pinned was therefore introduced by plan
  60-01's own unconditional declared-id `$PATH` probe, added earlier in this same phase — not
  pre-phase behaviour — and plan 60-06 kept it on a mistaken belief. This plan's rewrite corrects
  the pinned contract to match the pre-phase truth rather than the phase-introduced regression.
- **`tool-location.test.ts`'s "an environment variable set to an absolute path that does not exist
  behaves exactly as today..." case, rewritten in place as "Plan 60-08 Test 2".** OLD: asserted
  `result.refusal === null` and that `result.tried.slice(-2)` equalled two `$PATH`-joined
  candidates built from the DECLARED id (`x64sc`), i.e. the declared-id probe ran and answered
  nothing (silently). NEW: asserts `result.path === null`, `result.layer === null`,
  `result.mechanism === null`, and a non-null refusal naming both `VICE_BIN` and the value verbatim
  — with an actual decoy executable named `x64sc` placed on the injected `PATH` to prove the
  refusal holds even when a same-named binary is sitting right there. Same correction as above:
  this case previously pinned the same same-phase regression the seam-level half of, traced by the
  same pre-phase-source read.
- **A carried-forward accepted limit from plan 60-07's own evidence note is now CLOSED, not merely
  carried forward again.** That note recorded: "a separator-containing, unresolvable environment
  override... still falls through to a declared-id `$PATH` probe and can still silently substitute
  a different binary, with `refusal: null`... This is NOT a defect this plan is asked to fix... it
  is 60-06's own deliberate, documented scoping decision." This plan is the one that fixes it: the
  environment layer is now terminal for a declared variable's non-empty value WHATEVER its shape
  (Task 1), so the separator-containing substitution hazard no longer exists on either shape. A
  reader of all three evidence notes in sequence should not be left believing this limitation is
  still open.
- **The kind-correct refusal message (Task 2, fixing `60-REVIEW.md`'s WR-03) is a message-text
  change only**, branching `buildEnvLayerRefusal()`'s trailing justification clause on
  `record.kind` — an `executable`-kind id keeps the `$PATH`-shadowing warning byte-for-byte; a
  `directory`-kind id (`ghidra`, `acme-lib`) no longer claims a `$PATH`-substitution protection that
  structurally cannot apply to it (Layer 3 has no probe for a directory-kind id at all, D-15). No
  shipped test's PASS/FAIL outcome depends on the exact wording of this clause except the new tests
  this plan itself adds (all passing), so this change contributes no entry to either failing set.

## Outcomes for `60-RESEARCH.md` § item 6's enumerated invocations

Per-file/category check against the final post-round run (`2cf21509`). Every file named in
`60-RESEARCH.md` § item 6 EXISTS in the glob and was invoked; the question is whether its own
env-var-dependent case(s) ran or were skipped in this sandboxed environment (no `VICE_LIVE_*` /
`GHIDRA_HOME` opt-in set for this run).

**`VICE_BIN`-setting files that stub to a harmless local binary — all RAN (no live-binary opt-in
required):** `vice-broker-launch.test.ts`, `broker-kill.test.ts`, `vice-broker-acquire.test.ts`,
`host-tool-oracle.test.ts`, `broker-e2e.test.ts`, `broker-control.test.ts`, `host-tool.test.ts` — 0
failures in any of these files.

**`VICE_BIN`-setting files that are opt-in live-emulator suites — SKIPPED, not run (category: live
emulator, `VICE_LIVE_*` not set), 32 cases total:** `stock-a4-checkpoint-flood.test.ts` (1),
`stock-broker-live.test.ts` (5), `stock-live-broker-monitor.test.ts` (1),
`stock-live-triage.test.ts` (3), `stock-live.test.ts` (14), `text-monitor-live.test.ts` (8). None
require `VICE_LIVE_STOCK_BIN` / `VICE_LIVE_STOCK_BIN_39` / `VICE_LIVE_STOCK_BIN_310` /
`VICE_LIVE_A4_FLOOD_BIN` / `VICE_LIVE_BROKER_BIN` / `VICE_LIVE_TRIAGE_BIN` to be set, which they
were not in this run — a host without a live stock VICE opted in for this measurement, an expected
skip category on this host per this project's own operational record. (`stock-live.test.ts`'s own
skip count grew from the second evidence note's recorded 10 to 14 here — this reflects new cases
this suite accumulated across the phases between that measurement and this one, not a change this
plan made; `stock-live.test.ts` is untouched by this plan's own diff.)

**`ACME_BIN`/`ACME`-setting files — all RAN:** `skill-acme-build-cli.test.ts`,
`anno-export-asm.test.ts`, `acme-verify.test.ts`, `host-tool.test.ts`, `anno-derivation.test.ts`,
`hazard-subject-variants.test.ts`, `disasm-roundtrip.test.ts`, `hazard-subject-fixture.test.ts`,
`host-tool-transport.test.ts`, `dxa-seam.test.ts` — this host has a real, locally-installed ACME on
`$PATH`, and `VICE_REQUIRE_ACME` was not set (so a missing-ACME case would SKIP rather than
hard-fail), but ACME being genuinely present meant these ran for real, 0 failures.

**`GHIDRA_HOME`-setting files — SKIPPED, not run (category: live Ghidra, `VICE_LIVE_GHIDRA=1` not
set for this run), 37 cases total:** `ghidra-live.test.ts` (24), `ghidra-opcode-live.test.ts` (8),
`sleigh-compile-gate.test.ts`'s COMPILE half (5). `ghidra-project.test.ts` (the non-live structural
companion, not itself in the item-6 enumeration) ran in full, 0 failures. This host has a real,
non-standard-path Ghidra install per this project's own operational record, but this specific run
did not opt in via `VICE_LIVE_GHIDRA=1`; the skip is explicitly recorded here rather than silently
read as a pass.

**Additional opt-in live/manual categories observed in this run's 81-line skip set, outside item
6's four-variable enumeration but disclosed for completeness, 12 cases total:** `dxa-live.test.ts`
(5 skipped — category: live dxa, `VICE_LIVE_DXA` not set), `anno-store-export.test.ts`'s live tier
(1 skipped — category: live annotation-store export, `ANNO_STORE_EXPORT_LIVE_STORE` not set), the
upstream re-hash check (1 skipped — category: live upstream-clone comparison, `ANNO_UPSTREAM_CLONE`
not set), `anno-tools.test.ts`'s live `anno_evid_ingest` case (1 skipped — category: opt-in live,
matching item 6's own footnote), `text-tools.test.ts`'s `vice_memmap_zap` live case (1 skipped —
category: opt-in live), and `vice-proxy.test.ts`'s three container-workspace cases (3 skipped —
category: requires `CONTAINER_WORKSPACE_PATH`/`HOST_WORKSPACE_PATH` set in this process's own
environment when the file is run directly, not a live-tool gate). Sum of every category above:
32 (VICE_BIN live) + 37 (GHIDRA_HOME live) + 12 (additional) = 81, exactly the run's own reported
skip count — no skip in this run is unaccounted for by a named category.

`test-gate.mjs` is not a `node:test` file (it is the gate script itself, per `60-RESEARCH.md`'s own
parenthetical) and is not part of this enumeration's per-file skip/run accounting.

## Verdict

The failing SET after this round, at the final committed state (`2cf21509`), contains NOTHING that
was passing before it. The regression list is empty by direct comparison against the baseline's own
seven-entry failing set — five explained as measurement-methodology artifacts of the
`mktemp -d`/`/tmp` worktree this task's own instructions specify (none a source-behaviour
difference), and two explained as `d7d5a151` predating an ancestor citation-ledger fix — and the
post-round set itself is empty. This task's own first measurement pass DID surface two genuine
regressions against the immediate baseline (both `phase58-citation-ledger.test.ts` subtests, one
caused by this plan's own Task 1 header rewrite, one pre-existing ROADMAP drift this measurement
happened to be the first to catch this round), and both were fixed within this plan (documentation
only, no production or test source touched) rather than merely reported, per this task's own
acceptance criterion and per plan 60-05's and plan 60-07's own precedent for a regression found by
this exact required measurement. The two deliberate contract reversals from this round (the
rewritten `vice-broker-acquire.test.ts` "Plan 60-01 Test 4" and the rewritten `tool-location.test.ts`
"Plan 60-08 Test 2", both given under their old and new assertions above) are confirmed present
under their new assertions in the passing post-round set and absent under any failing name from
either set. The carried-forward accepted limit recorded in plan 60-07's own evidence note — a
separator-containing unresolvable override still substituting silently — is CLOSED by this round.
`test:automated` was used nowhere in this note as a source of any result — named above only as the
gate this claim does NOT rely on.
