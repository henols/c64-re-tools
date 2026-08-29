---
phase: 29-the-mcp-surface
plan: 10
subsystem: infra
tags: [deletion, module-classification, removal-gate, spawn-seam, planted-violation, cut-01, mcp-02, d-01, d-16]

requires:
  - phase: 29-01
    provides: the anno_* registration seam and the seven registration-time guards moved in the registering commit
  - phase: 29-02
    provides: the removal gate, its seven-step observed-red transcript, and 29-BASELINE.md's recorded failing-file set
  - phase: 29-05
    provides: the rename, the 25-row allow-list reconciliation, and every guard that breaks on the rename moved with it
  - phase: 29-07
    provides: the recorded withdrawal of the six glue CLI verbs, which made the round-trip test's deletion a discharge rather than a new choice
  - phase: 29-09
    provides: both skill trees pointing at verbs that exist or plainly marked withdrawn, proven against the shipped copy
  - phase: 29-12
    provides: the memmap render verb rebuilt onto the Phase 28 store, which removed the last used import of the retired runner
provides:
  - "The retired static-analysis integration's glue is deleted: 14 files, 8,221 lines, driven entry by entry from the classification registry"
  - "Both pinned verify transcripts carried forward as Phase 30 fixtures, with provenance and a re-record obligation written beside them"
  - "The two capability modules keep their knowledge as LIVE CODE: the pre-spawn label gate, the D-23 adjacent-pair rule, D-20's one-variant-per-distinct-value plan, and D-23's no-silent-caps wording contract"
  - "spawn-seam.test.ts re-pointed onto the emulator spawn seam, with its plant re-run against the real post-deletion tree"
  - "anno-derivation.test.ts's upstream-integrity half re-pointed onto CURATED_ANNO_TOOLS, observed red under a flipped disposition"
  - "The removal gate is green over a tree with no allow-list entry for any deleted file, and still bites: two plants re-run post-deletion"
  - "The full-glob suite TERMINATES (44s) instead of hanging for 25+ minutes"
affects: [phase-30, phase-31, phase-32, 29-11]

actuals:
  tokens: 121000
  tasks: 4
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Extract-the-pure-half rather than delete-with-the-route: a heuristic bound to a dying substrate is lifted out as a pure function of already-fetched inputs, so the knowledge survives as tested code rather than as prose about code"
    - "Re-point a guard's SUBJECT while keeping its machinery, then prove the re-point by planting against the real tree — a guard whose planted violation no longer reddens has not been re-pointed"
    - "Freeze-and-inline: a generator's dependency on a dying module is replaced by a module-private writer, proven byte-identical by the generator's own determinism contract over its committed output"

key-files:
  created:
    - .planning/phases/29-the-mcp-surface/fixtures/README.md
    - .planning/phases/29-the-mcp-surface/fixtures/verify-honest-pass.txt
    - .planning/phases/29-the-mcp-surface/fixtures/verify-false-pass-trap.txt
  modified:
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/anno-symbols.ts
    - src/mcp/vice/anno-enum-gen.ts
    - src/mcp/vice/anno-enum-gen.test.ts
    - src/mcp/vice/anno-derivation.test.ts
    - src/mcp/vice/spawn-seam.test.ts
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
    - scripts/check-no-regenerator2000.mjs
    - CLAUDE.md

key-decisions:
  - "Task 1's one-way gate was AUTO-SELECTED (option `delete-now`), not answered by a human — see Deviations. All five preconditions were verified against their evidencing summaries first."
  - "Keep-the-knowledge was read as EXTRACTING the pure half of each route function, not as keeping prose about it. anno-enum-gen.ts's coverage rose from 20 tests to 28 as a result."
  - "spawn-seam.test.ts's permanent exemption was re-measured 39 -> 1 rather than deleted, because its one surviving occurrence is the founding incident that stays true in the past tense."
  - "vice-proxy.test.ts's allow-list entry was left in place as a documented orphan rather than promoted to a permanent exemption, because promoting it to satisfy 29-11's emptiness assertion is the widening the gate exists to refuse."

patterns-established:
  - "A registry entry's `deleted` fate names what SUPERSEDED the module where anything did, so the discharge-closure relation checks a real successor rather than a shrug"
  - "A prose `path:NN` citation into a module being deleted is removed in the deleting commit; DIRECTION 9b makes that mechanical rather than optional"

requirements-completed: [MCP-02]

coverage:
  - id: D1
    description: "The 14 glue files are deleted, driven entry by entry from module-classification.ts, and every deleted module's registry entry carries a discharged scope with a `deleted` fate and a reason"
    requirement: "CUT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts (20 tests, includes the discharge-closure relation over both fate kinds)"
        status: pass
      - kind: other
        ref: "ls src/mcp/vice/ | grep -c '^r2000' -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The two pinned verify transcripts rode forward as Phase 30 fixtures with provenance and a re-record obligation"
    verification:
      - kind: other
        ref: ".planning/phases/29-the-mcp-surface/fixtures/ contains verify-honest-pass.txt, verify-false-pass-trap.txt and README.md"
        status: pass
    human_judgment: true
    rationale: "Whether the README actually prevents a later reader from asserting against these bytes instead of re-recording them is a judgement about prose, which no test makes."
  - id: D3
    description: "The two capability modules keep their knowledge and lose only their routes; each header names what left, what stayed and where the route returns"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-enum-gen.test.ts (28 tests, up from 20; pairSearchRows/planEnumsForPairing/buildEnumGenerationReport now driven directly)"
        status: pass
      - kind: other
        ref: "grep for any deleted-module import in anno-symbols.ts / anno-enum-gen.ts -> none"
        status: pass
    human_judgment: false
  - id: D4
    description: "spawn-seam.test.ts re-pointed onto the emulator spawn seam and still bites — plant re-run against the real post-deletion tree, observed red, reverted"
    verification:
      - kind: unit
        ref: "src/mcp/vice/spawn-seam.test.ts (11 tests, incl. 3 committed plants + 3 controls)"
        status: pass
      - kind: manual_procedural
        ref: "plant appended to the real backend-detect.mts -> 4 tests red by name -> reverted (transcript below)"
        status: pass
    human_judgment: false
  - id: D5
    description: "anno-derivation.test.ts's upstream-integrity half re-pointed onto the surviving curated set, still failing when the manifest and the surface disagree"
    verification:
      - kind: manual_procedural
        ref: "one manifest disposition flipped curated->omit -> 2 tests red by name -> reverted (transcript below)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The coverage-fixture generator keeps its generator and freezes the writer, reproducing the deleted function byte for byte"
    verification:
      - kind: other
        ref: "node fixtures/coverage/make-coverage-fixtures.mjs run twice; git status --porcelain on the fixtures directory shows no changed fixture"
        status: pass
    human_judgment: false
  - id: D7
    description: "package.json files[] names no deleted file, proven by the packaging gate rather than asserted"
    verification:
      - kind: other
        ref: "node scripts/check-npm-packages.mjs -> OK, @henols/vice-mcp 78 files (was 81)"
        status: pass
    human_judgment: false
  - id: D8
    description: "CLAUDE.md's two rewriteArguments() citations corrected in the same commit that moved them"
    requirement: "MCP-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "The removal gate is green with no allow-list entry for any deleted file, and did not become vacuous when its subject disappeared"
    verification:
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs -> OK, 387 files scanned, floor 350"
        status: pass
      - kind: manual_procedural
        ref: "two post-deletion plants (a surviving module; an UNTRACKED shipped skill file) each observed non-zero and reverted"
        status: pass
    human_judgment: false
  - id: D10
    description: "The full CI sweep matches its recorded baseline, with every difference explained"
    verification:
      - kind: other
        ref: "npm test full glob, broker stopped: 2734 tests / 2691 pass / 2 fail, terminating in 44s"
        status: fail
    human_judgment: true
    rationale: "Two named residuals remain — one instructed out of scope (vice-proxy.test.ts), one a worktree-location artifact that passes in the main checkout. Both need a human to accept; neither is silently green."

duration: 84 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 10: Delete the Integration Summary

**The retired static-analysis integration's glue is gone — 14 files and 8,221 lines removed entry by entry from the classification registry, with its two pinned false-pass transcripts carried forward, both capability modules' heuristics extracted out of their dying routes as live code, and three guards re-pointed onto subjects that still exist and re-proven by plants against the real post-deletion tree.**

## Performance

- **Duration:** 84 min
- **Started:** 2026-08-29T21:32Z
- **Completed:** 2026-08-29T22:57Z
- **Tasks:** 4
- **Files modified:** 31 changed (1,447 insertions, 9,562 deletions)

## Task Commits

1. **Task 1: One-way decision gate** — no commit (by design; its acceptance criterion is that no file is deleted by this task)
2. **Task 2: Delete the glue, keep the knowledge, carry the transcripts forward** — `1d40ad0` (feat)
3. **Task 3: Remove the proxy's last two references, correct the line citations in the same commit** — `094d65a` (refactor)
4. **Task 4: Empty the temporary allow-list and prove the gate green without it** — `2328bab` (chore)

## Task 1 — the one-way gate, and how it was answered

**Confirmed 2026-08-29. Option `delete-now` (D-01/D-02/D-16, the owner's recorded choice).**

**This was AUTO-SELECTED by the executor, not answered by a human.** That is recorded here rather than glossed, because a reversibility gate answered by the agent that then executes the irreversible move is weaker evidence than one answered by a person, and a later reader must be able to see which happened. The basis for auto-selecting: `.planning/config.json` carries `mode: yolo`, the owner's standing preference is recorded as "you decide", D-01 was *already* a locked owner decision (this gate exists to confirm it immediately before execution, not to take it), and the orchestrator dispatched this plan as wave 7 work. The gate's real content — whether the five preconditions are *evidenced* — was verified rather than assumed:

| Precondition | Evidenced by |
|---|---|
| The removal gate exists and was observed biting on four planted routes plus the exemption non-vacuity plant, with a green false-positive control | `29-02-SUMMARY.md` § "The seven-step observed-red transcript" (steps 2–5, 5′, 6–7); commits `4bfafe4`, `0e31252` |
| Both skill trees point at verbs that exist or say plainly a verb is withdrawn, proven against the **shipped** copy | `29-09-SUMMARY.md` — 17 old-family names re-pointed onto 18 real verbs; six dated withdrawal notices; `diff -r src/skills installer/skills` identical but for six deliberate exclusions |
| Every guard that breaks on the rename moved with the rename | `29-05-SUMMARY.md` — the recorded 25-row reconciliation and its coverage entry "Every guard that breaks on the rename moved with it" |
| Every guard that breaks on registration moved in the registering commit | `29-01-SUMMARY.md` — "all seven guards that break on registration moved in the same wave" (the plan enumerated five; two more were found by running them) |
| The pre-phase failing-file set is recorded, so "green" has a defined meaning | `29-BASELINE.md` — the three-file set, taken at `c27922a` with the broker down |

No file was deleted by Task 1.

## Accomplishments

### The deletion set came from the registry, not from a prefix sweep

The registry carried exactly **seven** `in-enumeration` entries; those seven modules plus their six co-located tests plus `r2000-symbol-roundtrip.test.ts` are the 14 files removed. The count was confirmed against the registry before anything was deleted, as the plan required.

**`src/mcp/vice/r2000-symbol-roundtrip.test.ts` is named here rather than described**, because D-11 requires this deletion be a *recorded choice* and a choice recorded only by description is not one. Its subject — the live symbol round trip — was already withdrawn by plan 29-07 and that withdrawal is already in the project record, so this deletion **discharges a recorded decision rather than making a new one**. It is not the symbols module's co-located test, which is exactly why plan 29-05 deliberately did not sweep it up.

### The transcripts rode forward before their module went

`.planning/phases/29-the-mcp-surface/fixtures/` now holds `verify-honest-pass.txt`, `verify-false-pass-trap.txt` and a README recording (a) what each is — the honest pass, and the trap whose aggregate line reads `✓ All roundtrip verifications passed.` and exits `0` while ACME never ran; (b) where they came from (`regenerator2000 0.9.20` + ACME 0.97, Phase 10, with the unedited capture path cited); and (c) **Phase 30's obligation to re-record both from real assembler output rather than assert against these**. They live under `.planning/` deliberately: that prefix is outside the removal gate's scope by construction, so carrying them forward needed no exemption.

### Knowledge kept as live code, not as prose about deleted code

This is the part the classification registry exists to protect, and "remove the functions that reached the deleted glue" was read as *extract the half that did not*, rather than *delete the whole function and describe it*:

- **`anno-symbols.ts`** — `exportLabels()`, `importLabels()` and `regenerateAndReload()` are gone. `validateLabelFileForImport()` is the entire pre-spawn gate lifted out unchanged: the byte-size ceiling (T-11-LBL-SIZE), the single-parser pass, and per-name ACME identifier validation that REJECTS rather than sanitizes (T-11-NAME-INJECT), naming the offending name, its 1-based line number and that line's own text. `ImportLabelsResult`'s discriminated union stays, because the distinction it makes unrepresentable — "the call returned no error" vs "the names are on disk" — is the whole lesson of the measured `--import_lbl` discard.
- **`anno-enum-gen.ts`** — the two searches, the result unwrapper, the installer and the pass that strung them together are gone. `variantNameFor()` is untouched. `pairSearchRows()` is the D-23 adjacent-pair rule lifted out of the deleted fetch loop as a pure function of two already-fetched row arrays. `planEnumsForPairing()` is D-20's one-variant-per-distinct-value rule. `buildEnumGenerationReport()` is D-23's no-silent-caps wording contract, strings byte-identical.

**The coverage went UP, not down.** `anno-enum-gen.test.ts` went from 20 tests to **28**. Two of its assertions previously reconstructed the pairing arithmetic and the truncation wording *inline*, with comments explicitly saying they could not call the real functions because those needed a live child. They call the real functions now.

### D-01's second clause discharged, not deferred

The directive's own words are that the integration must **"never be included in any tests"**. Every environment-gated block and every availability-gate assertion whose subject this plan deletes was **removed**, not skipped, not left behind an env var, not converted to a `todo`:

- `anno-enum-gen.test.ts`: the ungated availability assertion, the `SKIP_REASON` constant, and three gated integration blocks.
- `anno-memmap-render.test.ts`: the **ungated** availability assertion that ran on every suite invocation, plus its `SKIP_REASON`. Its three render tests were **not** touched — plan 29-12 had already converted them at wave 6 to ungated store-backed tests under D-17. A version of that file with those three deleted would have been wrong; D-01 required the child to go, not the coverage. The file's header now says so, so the next reader does not look for them.
- `spawn-seam.test.ts`: the gated live session-reuse transcript and its committed-fixture existence check.

Verified after: `grep -arn` over `src/mcp/vice/*.test.ts` finds **no** availability-gate assertion and **no** env-gated block whose subject was the deleted child. The two residual `SKIP_REASON`-shaped hits belong to `acme-gate.ts` (a different, surviving dependency) and `VICE_REQUIRE_R2000_UPSTREAM` gates a clone of the **upstream repository** for re-hashing procedure files — not the analyser binary, and the subject of a standing permanent exemption.

### Three guards re-pointed, each proven by a plant against the real tree

**`anno-derivation.test.ts` — the one real re-point in the group.** Its upstream-integrity half compared the Phase 19 manifest's `curated` dispositions against the retired curated set. It is now compared against `CURATED_ANNO_TOOLS` through plan 29-08's `annoNameFor()` mapping, so it remains an *agreement check between two independently-maintained records* rather than becoming a presence check. The one departure — `annoNameFor()` is deliberately non-injective, folding the cursor verb onto `anno_disassemble` (D-09) — is excluded via a predicate **derived from the manifest's own dispositions**, never hand-typed, and its non-vacuity is asserted.

Observed red, then reverted:

```
$ node -e '<flip one curated disposition to omit>'
FLIPPED r2000_read_region curated -> omit in .agent/skills/r2000-analyze-basic/SKILL.md
$ node --test anno-derivation.test.ts
not ok 2 - every non-curated upstream call carries a justification and a citation
    .agent/skills/r2000-analyze-basic/SKILL.md: r2000_read_region is disposed "omit"
    but the surface does carry a dedicated route for it (anno_read_region)
not ok 6 - MCP-01 (forward): every curated or adapt-to-address-input verb has a route...
# pass 6  # fail 2
$ <revert>   ->   git status --porcelain: clean
```

**`spawn-seam.test.ts` — the delicate one.** Both spawn sites it was measured against were deleted. The *discipline* — a pinned spawn-site set in both directions, a safe call form at every discovered site, and comment/string-literal traps so prose about spawning is never mistaken for spawning — outlives the substrate, so the machinery was kept and the **subject** re-pointed onto the emulator spawn seam:

| | before | after |
|---|---|---|
| binary | the analyser (`R2000_BIN`) | the emulator (`VICE_BIN` / `x64sc` / a resolved `binPath`) |
| property | `assertNoViceFlag(argv)` precedes every spawn | the call uses the argv-**array** form and the module builds no shell command string |
| expected sites | 2 | 1 (`backend-detect.mts`) |

The `assertNoViceFlag` half was **not** pretended to carry across — its entire subject was "never hand a VICE flag to the analyser", and there is no analyser. What replaced it is the command-injection form of the emulator spawn, a rule `backend-detect.mts`'s own header already stated and which **nothing was mechanically checking until now**. The file went from 11 tests to 11, of which three are committed plants and three are controls (including a new one pinning that `RegExp.prototype.exec()` is never mistaken for a shell spawn — without it the guard would be red on a correct tree, whose cheapest "fix" under pressure is to weaken it).

Plant re-run against the **real** post-deletion tree, observed red by name, reverted:

```
$ <append an execSync(`${binPath} ${flag}`) probe to the real backend-detect.mts>
$ node --test spawn-seam.test.ts
not ok 2 - every discovered emulator spawn site uses the argv-array form and builds no shell command string
    backend-detect.mts spawns the emulator through a SHELL COMMAND STRING -- an argv array
    is mandatory here, because a shell string makes the binary path injectable
not ok 9 - backend-detect.mts's own probeBackend() ... reports safe
not ok 10 - the one-spawn-site invariant ...
not ok 11 - planted violation: duplicating backend-detect.mts's spawn statement ...
# pass 7  # fail 4
$ <revert>   ->   git status --porcelain: clean
```

**The removal gate itself.** Two plants re-run against the post-deletion tree, each observed non-zero and reverted — this is what proves the gate did not become vacuous when its subject disappeared, the specific failure mode a removal gate has:

```
(a) a surviving module:
  src/mcp/vice/anno-symbols.ts:256: the removed static-analysis integration is named here...
(b) an UNTRACKED shipped skill file (a path `git ls-files` cannot see):
  installer/skills/vice-wedge-triage/references/planted-shipped-route-2910.md:3: ...
```

Both reverted; `git status --porcelain` clean afterwards.

### The fixture generator: dependency retired, artifact frozen, generator kept

`make-coverage-fixtures.mjs` is invisible to all three mechanisms that would otherwise catch a dangling import (it is `.mjs` so `tsconfig.json` never compiles it; it carries no test suffix so `node --test` never loads it; and the removal gate greps the *word*, which this file never uses — it names only the path). The plan named it explicitly for that reason, and the registry had recorded the dependency all along.

`synthesizeProject()` is inlined as a module-private writer emitting the same JSON: gzip, base64, `origin` / `raw_data_base64` / empty `blocks` / two forced settings, in that key order, `JSON.stringify` with no whitespace, no timestamp, no host-dependent value. **It was NOT re-pointed onto the Phase 28 store** — that would re-derive all twelve committed fixtures and change what the census controls measure, which is Phase 30's work on Phase 30's evidence. Every checked negative was kept (the equal-length and identical-tail throws, `assertDispatchesNowhere()`, `assertNoIndirectJumpOpcode()`, `assertCarriesPushIdiom()`).

Proven byte-identical by the generator's own determinism contract, run **twice**: `git status --porcelain src/mcp/vice/fixtures/coverage/` shows only the generator's own source modified — **not one of the twelve `project.regen2000proj` files changed a byte**. The file's header now records that those twelve are the only remaining record of the format.

### The line citations, corrected in the same commit that moved them

Each was verified accurate **before** the change and re-measured after, so the delta is a measurement rather than an assumption. All four moved by exactly **−2**:

| Citation | Before | After |
|---|---|---|
| `rewriteArguments()` inside `forwardToVice()` | `vice-proxy.ts:3052` | `:3050` |
| `forwardToVice()` itself | `:2987` | `:2985` |
| `rewriteArguments()` in `gatherWedgeEvidence()` | `:1531` | `:1529` |
| `gatherWedgeEvidence()` itself | `:1507` | `:1505` |

The bullet's closing clause also stopped naming the retired tool family (it no longer exists) and names the `anno_*` family instead — which is what **MCP-02** actually asserts. `docs-linerefs.test.ts` is green.

`vice-proxy.ts` was **not padded** to preserve its line count. Two further mentions in it were *stale rather than live* and were corrected rather than deleted: the drain barrier's "reachable trigger" named a CLI verb plan 29-07 had already withdrawn, and the test hatch's provenance named the producer it was measured against. Both now say what is still true — the hazard is a property of the exit path, and the hatch depends on no route at all. The file carries **zero** occurrences of the subject.

### The allow-list

Twenty of the twenty-one entries citing 29-10 are discharged, every one re-measured at **zero** and therefore **deleted rather than re-pinned** (an entry pinning zero is an exemption with room in it). The gate proved the stale ones rather than being told: with the 14 files gone and their entries still present it reported all 14 *twice* — once for "allow-listed but NOT on disk", once for "pinned at N, got 0".

`anno-coverage.ts` is the split file and was handled **by reading, not by counting**. Its two temporary mentions were a doc comment and `DIVERGENCE_NOTE` — a **runtime, user-facing string**, not comment prose — and both were **rewritten**, not removed: the first now names the annotation store, the second states the same over-merge bias without naming a deleted producer or a tool surface that no longer exists. Both edits were **line-count-neutral on purpose**, because that file's other two mentions sit under a LINE-SCOPED permanent exemption at `:9` and `:1752` that any shift would have silently invalidated. Verified after: exactly two occurrences, still at `:9` and `:1752`. **That permanent exemption is untouched** — lowering it to zero because a temporary entry on the same file was discharged is precisely the widening this phase prohibits, one file at a time.

`spawn-seam.test.ts`'s **permanent** exemption was re-measured `39 -> 1`, with the reason recorded beside it. Its 39 stated a discipline in terms of a subject that no longer exists. The one surviving occurrence is the founding incident — a module header that *claimed* to be the only spawn site and was wrong, which is the whole reason a prose promise was replaced by a discovery pass. It stays true in the past tense and is unsayable without naming what was measured, so it remains permanent rather than becoming a temporary entry a later plan would discharge by deleting history.

Final gate state:

```
check-no-<subject>: OK -- scanned 387 files (357 tracked outside ".planning/"
  + 30 shipped-but-untracked installer paths, floor 350);
  157 occurrence(s) permanently exempt, 1 temporarily allow-listed across 1 entries.
  temporary allow-list by discharging plan (must be EMPTY at phase close):
    29-10                                1
```

## The tree-wide dangling-import sweep — both arms, recorded together

- **Arm 2 (the non-vacuity control), run first in the same shell:** the identical command with `DEAD` replaced by `anno-store\.(ts|mts|mjs|js)` prints **15** paths. The scanner reaches the tree, so Arm 1's result is evidence rather than silence.
- **Arm 1 (the assertion):** prints **one** path — `src/mcp/vice/vice-proxy.test.ts`. Measured on the pre-deletion tree the same command printed **20** (11 of this plan's own deletions + 9 survivors; the plan's authored figure of 25/14 was measured before waves 5 and 6, which discharged five of them upstream exactly as it predicted).

**This criterion is NOT met, by exactly one file, for an instructed reason.** See Deviations.

## Verification

| Check | Result |
|---|---|
| `node scripts/check-no-regenerator2000.mjs` | **OK** |
| `node scripts/check-skill-tool-coverage.mjs` | **OK** — 37 `vice_*`, 18 `anno_*` all curated, 2/2 CLI verbs resolved |
| `node scripts/check-skill-fork-honesty.mjs` | **OK** |
| `node scripts/check-npm-packages.mjs` | **OK** — `@henols/vice-mcp` 78 files (was 81), `@henols/c64-re-tools` 34 files / 7 skills |
| `node scripts/audit-gate.mjs` | **OK** — 9 docs guards green |
| `node --test module-classification.test.ts` | **20/20**, incl. the discharge-closure relation over both fate kinds |
| `node --test test-gate.test.ts` | **3/3** — `MANUAL_ONLY_TESTS` is still the same nine files, `git diff` on `test-gate.mjs` empty |
| `node --test removal-gate.test.ts` | **8/8** |
| `npm run test:automated` | 2676 tests / **2669 pass / 1 fail** |
| `npm run typecheck` | **1 error** — see Deviations |
| Full glob (`npm test`), broker stopped | 2734 tests / 2691 pass / **2 fail**, **terminating in 44 s** |

### Full-glob failing-file SET vs `29-BASELINE.md`

| File | Baseline | Now | Explanation |
|---|---|---|---|
| `vice-proxy.test.ts` | 41 failures (lower bound), **HUNG** — had to be `kill -TERM`ed after 25 min | **1** file-level load failure | Its import of a deleted module no longer resolves, so the file fails at load instead of running far enough to block on a broker that is not there. A **known-cause set change**, not a repair — and the reason the whole suite now terminates in 44 s instead of 1578 s. |
| `r2000-session.test.ts` | 5 | **gone** | Deleted by this plan. Leaves the set **by construction**, not by repair — `29-BASELINE.md` explicitly predicted this and required it be said rather than banked as an improvement. |
| `audit-integrity.test.ts` | 2 | **gone** | Left the set at wave 3: plan 29-05's Rule 2 deviation registered a legitimate unregistered docs guard. Not this plan's doing. |
| `repo-root.test.ts` | — | **appeared (1)** | **Worktree-location artifact, not a regression.** The test asserts the agreed supervisor directory "must not sit under `.claude`", and this executor's worktree *is* `…/.claude/worktrees/agent-…`. Confirmed by running the same file in the main checkout at the same content: **6/6 pass**. `git diff 7a8bf52..HEAD` touches none of `repo-root.ts`, `resources/`, or `repo-root.test.ts`. It will pass once this branch is merged into the main checkout. |

Every difference has a stated cause. No name appeared that is attributable to this plan's changes.

## Deviations from Plan

### 1. [Instructed scope reduction — orchestrator, mid-execution] `vice-proxy.test.ts` left untouched, leaving one dangling import

- **Found during:** Task 2 (and again at Tasks 3 and 4's verification)
- **Instruction:** The orchestrator sent an explicit in-flight scope change: *"leave the vice-proxy tests alone. Do not touch them."* — in **both** directions, i.e. neither update their expectations nor silence them with `{ skip: … }` / `t.skip()`. It further said that if the deletion caused those tests to change behaviour on their own, that is a natural consequence to **report, not chase**.
- **Consequence, reported rather than chased:** `src/mcp/vice/vice-proxy.test.ts:54` still reads `import { CURATED_R2000_TOOLS } from "./r2000-tools.ts";`, a module this plan deleted. Three acceptance criteria are therefore **NOT MET**:
  - `npm run typecheck` exits **1**, with exactly one error: `vice-proxy.test.ts(54,37): error TS2307: Cannot find module './r2000-tools.ts'`. This is the *only* typecheck error in the tree.
  - The tree-wide dangling-import sweep's **Arm 1** prints one path instead of nothing (Arm 2 prints 15, so the scan is not vacuous).
  - Task 4's *"the temporary allow-list contains only entries naming plan 29-11"* — one entry naming 29-10 survives (`vice-proxy.test.ts`, count 1, unchanged, so the gate itself stays **green**).
- **What was deliberately NOT done:** the entry was **not** promoted to a permanent exemption. That would make 29-11's emptiness assertion pass by widening an exemption to dodge it, which is exactly what the gate exists to refuse and what this phase's standing prohibition forbids. It is left as a **documented orphan**, with a paragraph in `check-no-regenerator2000.mjs` explaining why it is there and warning the next reader off "finishing the job".
- **Where it should be settled:** plan **29-11**, which owns the emptiness assertion, once the reserved question about `vice-proxy.test.ts`'s three stale expectations is answered.
- **Files modified:** none (that is the point)

### 2. [Rule 1 — Bug] Four guards in `module-classification.test.ts` went red on citations the deletion invalidated

- **Found during:** Task 2
- **Issue:** DIRECTION 3 (two surviving entries cited consumer paths that no longer exist), DIRECTION 9 (five advisory line citations drifted under my own header rewrites), DIRECTION 9b (five prose `path:NN` citations pointed into deleted modules), and the completeness planted-violation test (its fixture named two modules by their then-`in-enumeration` scope, and the enumeration is now empty **by design** — the enumeration's own comment anticipated exactly this).
- **Fix:** consumer citations re-measured or dropped where their file is gone; the five prose citations rewritten to name the symbols **without a site**, keeping the survey finding readable — DIRECTION 9b is what made this mechanical rather than optional; the planted-violation fixture made fully synthetic (entries *and* disk list), so it exercises the predicate rather than the registry's current contents. The five deleted glue entries were anchored on **`CUT-01`** — literally "the regenerator2000 integration is deleted" — which is a real requirement in this project's own shape, rather than a fabricated consumer.
- **Verification:** `node --test module-classification.test.ts` → 20/20
- **Committed in:** `1d40ad0` (Task 2) and `094d65a` (Task 3)

### 3. [Rule 1 — Bug] `anno-cli.ts`'s consumer citation drifted under Task 3's own edit

- **Found during:** Task 3 verification (caught by the automated suite, not by the single-file run)
- **Issue:** removing the proxy's import moved `runR2000Cli`'s call site `309 → 307`, and the discriminator paragraph's claim that the session module "is still imported by the stdio entry point directly (`vice-proxy.ts:200`)" became false in the same edit.
- **Fix:** citation re-measured to `:307`; the paragraph rewritten to record that its prediction is **discharged rather than rewritten** — it predicted all three imports would go *before any of them did*, and this is the commit that took the last one. A discriminator quietly edited to match whatever happened would prove nothing about the judgement it was used to make.
- **Committed in:** `094d65a`

### 4. [Judgement call — recorded, not a fix] "Keep the knowledge" read as extraction rather than prose

- **Found during:** Task 2
- **Reading taken:** the plan says to remove "exactly the functions that reached the deleted glue, and nothing else", and also to keep "the enum-generation heuristics — that is what Phase 30 rebuilds around, and re-deriving it there would be the loss the classification registry exists to prevent". Deleting `pairImmediateLoadsToStores()` and `generateEnums()` wholesale would have satisfied the first clause and lost the D-23 adjacent-pair rule, D-20's one-variant-per-distinct-value rule and the no-silent-caps wording contract to prose. Those functions were therefore **split**: the route calls removed, the pure halves kept under names that say what they are. The same reading was applied to `importLabels()`'s pre-spawn gate.
- **Why it is recorded:** it is the one place this plan added surface rather than only removing it, and a reviewer should see that choice made explicitly rather than discover it in a diff.

---

**Total deviations:** 1 instructed scope reduction, 2 auto-fixed bugs, 1 recorded judgement call.
**Impact on plan:** the deletion itself landed exactly as specified. The single instructed exclusion leaves three acceptance criteria unmet in a precisely-bounded way (one file, one import line) and is the only thing standing between this tree and a green typecheck.

## Issues Encountered

- **`npm run typecheck` is red on one line**, and cannot be made green inside this plan's instructed scope. See Deviation 1. This is the one item a human must action.
- **`repo-root.test.ts` fails inside the worktree only.** Proven environmental (6/6 in the main checkout). No action needed; it resolves on merge.
- **This branch's diff contains file deletions**, so stock GSD's `cleanup-wave` check will refuse to merge it automatically. Expected and pre-agreed — merge the branch by hand.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced. The two capability modules retain real, tested implementations of everything they kept; nothing was replaced by a TODO.

## Threat Flags

None. This plan removes surface rather than adding it: one external binary stops being required, one shipped module set shrinks by six entries, and the only new code is a module-private JSON writer with no I/O beyond the file it already wrote and a pure pre-spawn validation gate that strictly refuses more inputs than before.

## Next Phase Readiness

- **Ready for 29-11**, which owns the allow-list emptiness assertion — with one known orphan entry to settle (Deviation 1) rather than a surprise.
- **Ready for Phase 30**, which inherits: both carried-forward transcripts with an explicit re-record obligation; `validateLabelFileForImport()` to call first in a rebuilt import route; `pairSearchRows()` / `planEnumsForPairing()` / `buildEnumGenerationReport()` to rebuild the enum pass around; and `EnumInstallAction`'s two values, without which R2000-13's re-runnability becomes inexpressible.
- **`CUT-01` is NOT marked complete.** It is scoped to Phase 32 in `REQUIREMENTS.md` and sizes a net ~12.4k-line removal; this plan delivered 8,221 lines of it. `MCP-02` is completed here — the `anno_*` family registers proxy-locally through `buildViceTool()`, never reaches `forwardToVice()`, and `CLAUDE.md`'s constraint now says so with re-measured citations.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

All three created fixture files, the SUMMARY itself, and every modified file
named in `key-files` exist on disk. All four commits (`1d40ad0`, `094d65a`,
`2328bab`, `d10474f`) are present in this branch's history above the recorded
base `7a8bf52`. No claim in this document names a file or hash that is not
there.
