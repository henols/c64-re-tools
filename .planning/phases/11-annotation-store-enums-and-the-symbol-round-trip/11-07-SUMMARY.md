---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 07
subsystem: infra
tags: [regenerator2000, annotation-store, evidence, criterion-1, d-26, two-session-proof]

# Dependency graph
requires:
  - phase: 11-05
    provides: "r2000-tools.ts's runR2000Tool()/CURATED_R2000_TOOLS/resolveStorePath() -- the ONE curated-tool seam this plan's session A drove directly, and the saveAndVerify()-vs-plain-save split that makes cross-call persistence possible under D-17's per-call lifecycle"
provides:
  - "evidence/criterion1/fixture/recon-subject.a + .prg: a purpose-made, byte-verified ACME fixture with vectors, an IRQ handler, a main loop, a byte table, an address table, and one region that decodes as valid code but is genuinely unreachable data"
  - "evidence/criterion1/recon-subject.regen2000proj: the committed annotation store, 7 user labels / 6 D-25-graded line comments / 3 classified blocks / 1 scope, written entirely through the curated r2000_* tools"
  - "evidence/criterion1/SESSION-A-TRANSCRIPT.md: the write-phase calls plus a genuinely separate-process fresh-session re-read, with the answer's own field values redacted per T-11-LEAK"
  - "evidence/criterion1/QUESTION.md + ANSWER.md + ANSWER.sha256: the store-only, falsifiability-checked question and its sealed answer for plan 11-09 (session B) to be checked against mechanically"
  - "r2000-answer-key.test.ts: the seal-drift and leak guards that keep the sealed answer honest"
affects: [11-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redact-in-place transcript pattern for a two-session evidence pair: record every real tool call and its real result, but replace the SPECIFIC argument/result values a later question will ask about with a named [REDACTED -- see QUESTION.md Part N] marker, so the transcript remains an honest, complete record without being the leak vector T-11-LEAK exists to close."
    - "Cross-process (not just cross-call) persistence proof: the fresh-session re-read ran as a second, independently-started node process, launched only after the first had fully exited, so the proof is against what r2000_save_project actually wrote to disk -- not against anything a still-running process might be holding in memory."
    - "Marker-fenced canonical answer line (ANSWER.md's <!-- CANONICAL-ANSWER-LINE --> / <!-- /CANONICAL-ANSWER-LINE -->) as the one extraction point a seal-recomputation test reads from, so the sealed hash can never silently diverge from the answer's own displayed text without a mechanical check catching it."

key-files:
  created:
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/fixture/recon-subject.a
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/fixture/recon-subject.prg
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/SESSION-A-TRANSCRIPT.md
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/QUESTION.md
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/ANSWER.md
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/ANSWER.sha256
    - .claude/mcp/vice/r2000-answer-key.test.ts
  modified: []

key-decisions:
  - "D-31 applied for this specific plan: built a purpose-made fixture (recon-subject.a/.prg) rather than reusing probe-illegal.prg, because that fixture has no vectors/handler/tables and cannot satisfy criterion 1's falsifiability rule (plan 11-08 makes the opposite call for the symbol round trip, where program structure is not what's under test)."
  - "Chose to redact SPECIFIC field values inside the transcript (both the write-call arguments and the fresh-session re-read results) rather than omitting whole sections, so the transcript stays a maximally honest, complete record of what session A actually did while still not leaking the answer -- the plan explicitly permits this over omission when the alternative is quoting the write calls' own arguments verbatim, which would otherwise leak by construction (the write call IS the answer's source)."
  - "Deliberately did not include any r2000_get_cross_references call in the committed transcript at all (rather than running-then-redacting it), since it is not one of the three calls (get_symbols/get_comments/get_blocks) the plan requires to be quoted, and the mechanism's correctness is already covered by plan 11-05's own committed integration test."
  - "The label field (a made-up, non-enumerated compound name) is the ONLY field checked in r2000-answer-key.test.ts as a bare-substring/whole-word leak check; the other three fields (confidence grade, block type, xref count) are checked only in their compound key=value form, since their values are drawn from small enumerated vocabularies that legitimately recur as illustrative examples in QUESTION.md's own grammar prose -- forbidding the bare word 'byte' or the digit '2' anywhere in the document would be a vacuous over-constraint on a question that is necessarily ABOUT a byte-typed block."

patterns-established:
  - "Redact-in-place two-session transcript, described above under tech-stack.patterns -- reusable by plan 11-11's criterion-4 walkthrough if it faces the same tension between 'record the exact calls made' and 'do not leak the mechanically-checked claim'."

requirements-completed: [R2000-10]

# Metrics
duration: 35min (estimated -- PLAN_START_TIME was not captured at kickoff; timed from first file read to final commit)
completed: 2026-08-21
---

# Phase 11 Plan 07: Criterion 1 Evidence, Session A -- Analyse and Write, Then Ask a Question Only the Store Can Answer Summary

**A purpose-made ACME fixture is bootstrapped, annotated end to end through the 17 curated `r2000_*` tools (one 17-call `r2000_batch_execute`), proven to persist across a genuinely separate process, and sealed behind a four-part question whose answer requires three stored human judgements no byte-level analysis can recover.**

## Performance

- **Duration:** ~35 min (estimated; PLAN_START_TIME was not captured at kickoff)
- **Completed:** 2026-08-21T00:36:05+02:00
- **Tasks:** 3
- **Files created:** 8 (0 modified)

## Accomplishments

- **Task 1 — the fixture.** `recon-subject.a` (ACME, `!cpu 6510`, origin `$0810`, no library `!source` per the same hand-rolled-constants posture as `probe-illegal.a`/`template.a`): an `init` routine setting `$D011`/`$D018`/`$DD00` and installing an IRQ vector at `$0314/$0315`; an IRQ handler reading `$D012` and chaining to `$EA31`; a `main_loop` reading a byte table and dispatching to two subroutines; a `byte_table` and a word-pair `addr_table`; and an 8-byte `ambiguous_region` that decodes as a syntactically valid instruction stream (`lda #0 / sta $d020 / rts / nop / nop`) but is reached by no `JSR`/`JMP`/vector anywhere in the program. Assembled to a 102-byte `.prg` (sha256 `eca741911c38c9d5f9398027aa59d781cd27b7a7018aba02e1c0525e734ca4a5`), recorded in the source's own header comment, and verified byte-identical to a fresh ACME 0.97 reassembly.
- **Task 2 — session A.** Bootstrapped the `.prg` into `recon-subject.regen2000proj` via `vice-mcp r2000 bootstrap`. Annotated it with one `r2000_batch_execute` call (17 inner operations): 7 user labels, 3 `r2000_set_data_type` classifications (byte_table → `byte`, addr_table → `address`, the ambiguous region → `byte`), one `r2000_add_scope` over the IRQ handler, and 6 D-25 confidence-prefixed line comments (`[confirmed-code]` ×2, `[confirmed-data]`, `[probable-data]` ×2, `[unknown]`). Proved persistence with a **second, independently-started `node` process**, launched only after the first had fully exited, re-reading `r2000_get_symbols`/`r2000_get_comments`/`r2000_get_blocks` — all annotations survived intact. Every call was driven directly by this executor agent through `runR2000Tool()`; no nested `claude -p` invocation appears anywhere.
- **Task 3 — the question and its seal.** `QUESTION.md` asks for a label name, a confidence grade, a block type (three stored human judgements) plus a cross-reference count (one part that exercises criterion 2's query layer but is explicitly named as not sufficient alone). Permitted/forbidden inputs are named explicitly, including this plan's own PLAN.md/SUMMARY.md/commits. `ANSWER.md` seals the canonical line `label=border_bump_up confidence=probable-data blocktype=byte xrefcount=2` behind a documented marker fence; `ANSWER.sha256` holds its sha256. `r2000-answer-key.test.ts` recomputes that hash from `ANSWER.md` itself and asserts it matches, and asserts `QUESTION.md` leaks neither the full line nor the label's distinctive value nor any field's compound `key=value` form.

## Task Commits

Each task was committed atomically:

1. **Task 1: a purpose-made recon subject with real structure** - `d08c7ef` (feat)
2. **Task 2: session A — write recon findings into the store through the curated tools** - `6d76ee5` (feat)
3. **Task 3: the store-only question, the sealed answer, and the test that keeps the seal honest** - `21c347a` (feat)

## Files Created

- `.planning/phases/.../evidence/criterion1/fixture/recon-subject.a` — the ACME source
- `.planning/phases/.../evidence/criterion1/fixture/recon-subject.prg` — the assembled 102-byte binary
- `.planning/phases/.../evidence/criterion1/recon-subject.regen2000proj` — the annotated store
- `.planning/phases/.../evidence/criterion1/SESSION-A-TRANSCRIPT.md` — the write calls plus the fresh-session re-read, redacted
- `.planning/phases/.../evidence/criterion1/QUESTION.md` — the store-only question, permitted/forbidden inputs, canonical format
- `.planning/phases/.../evidence/criterion1/ANSWER.md` — the sealed canonical answer line, marker-fenced, plus field explanations
- `.planning/phases/.../evidence/criterion1/ANSWER.sha256` — the sealed hash
- `.claude/mcp/vice/r2000-answer-key.test.ts` — the seal-drift and leak guard tests

## Decisions Made

See `key-decisions` in frontmatter. Summarized: purpose-built fixture over the existing `probe-illegal.prg` (D-31), redact-in-place over omission for the transcript, cross-references never quoted in the transcript at all, and label-only bare-substring leak checking (the other three fields checked only in compound `key=value` form) to avoid a vacuous over-constraint on common vocabulary words.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<automated>` verify commands pass as specified, and the falsifiability/persistence/non-vacuity requirements were all satisfied without needing a Rule 1-4 deviation.

## Guessability Self-Check (per QUESTION.md field, as the plan requires)

Could an agent that has never seen this program answer correctly by guessing?

- **Part 1 (label, `border_bump_up`):** No. Address `2124` is `sub_one` in the `.a` source (forbidden reading anyway); `border_bump_up` is an arbitrary, made-up compound name session A chose independently, with no derivable relationship to that internal label, to the address itself, or to any naming convention used elsewhere in this project. Space of plausible names is effectively unbounded. **Not guessable.**
- **Part 2 (confidence, `probable-data`):** Partially constrained. D-25's vocabulary has exactly five values, and an agent reasoning generically about "a region that looks like code but is unreached" might plausibly guess `probable-data` as the semantically fitting choice (one in five, better than random once the domain reasoning is applied). This is the weakest field in isolation. **Somewhat guessable in isolation; mitigated by requiring an exact match on all four fields together.**
- **Part 3 (block type, `byte`):** Partially constrained. Twelve enumerated block types exist; `byte` is a common default for "not code, not clearly one of the more specific shapes," giving a domain-aware agent perhaps 1-in-4 to 1-in-6 odds by elimination. **Somewhat guessable in isolation; same mitigation as Part 2.**
- **Part 4 (cross-references, `xrefcount=2`):** Explicitly named in `QUESTION.md`'s own "why store-only" section as, in principle, recoverable from the raw bytes alone (a `JSR` plus one address-table entry are both visible in the `.prg`) — this is why it is deliberately only one of four required parts and is stated as insufficient by itself.
- **Combined:** the full four-field line requires an exact, byte-identical match including the effectively-unguessable label. No credible guessing strategy reaches all four simultaneously; the label field alone reduces blind full-match probability to negligible. Judged sufficient — not tightened further, since narrowing Parts 2-3's vocabulary is not available (D-25 and r2000's own `BlockType` enum are both fixed, small, and finite by upstream design) and the plan's own rule permits a mixed-strength combination provided the overall answer is not derivable from the forbidden inputs.

## Non-Vacuity Transcript (Task 3, planted violation)

Edited `ANSWER.md`'s canonical line from `xrefcount=2` to `xrefcount=99` (an edit that does not touch `ANSWER.sha256`), ran the suite, then reverted (confirmed the file matches its pre-edit state and the suite is green again):

```
$ node --test r2000-answer-key.test.ts
...
not ok 2 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
...
# tests 5
# pass 4
# fail 1
```

Reverted; re-run: `# tests 5 / # pass 5 / # fail 0`.

## Issues Encountered

None specific to this plan. `node_modules/` had to be reprovisioned in this fresh worktree via `npm ci` before any test/typecheck command could run (standard first-session-in-a-worktree step, not a defect).

## User Setup Required

None. `regenerator2000 0.9.20` (`~/.cargo/bin/regenerator2000`) and ACME 0.97 (`~/.local/bin/acme`) were both already installed on this host from prior phase work.

## Verification Evidence

- `acme -f cbm -o /tmp/recon-subject.check.prg recon-subject.a && cmp /tmp/recon-subject.check.prg recon-subject.prg` → identical (Task 1's exact verify command).
- `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` → 21/21 pass (Task 2's exact verify command; unchanged from plan 11-05, re-run here to confirm nothing regressed).
- `node -e "... user_line_comments ..."` against the committed `.regen2000proj` → `OK: user_line_comments present` (Task 2's exact verify command).
- `node --test r2000-answer-key.test.ts` → 5/5 pass (Task 3's exact verify command).
- `cd .claude/mcp/vice && npm run typecheck` → clean.
- `cd .claude/mcp/vice && npm run test:automated` → 1832 pass, 1 fail (pre-existing, worktree-only `repo-root.test.ts` path-agreement failure — documented in the orchestrator's own prior-wave context and in 11-05-SUMMARY.md's Issues Encountered; not caused by or related to this plan), 5 todo.
- `node scripts/check-npm-packages.mjs` → OK (66 files for `@henols/vice-mcp`, 35 files + 6 skills for `@henols/c64-re-tools`) — this plan added a test-only file, which correctly does not appear in either tarball's file list.

## Evidence Ceiling (ENGINEERING_RULES.md §8)

This plan's own automated evidence (Tasks 1-3's `<automated>` commands) proves: the fixture reassembles byte-identically through a real external ACME; the store persists real writes across a real regenerator2000 child and survives a real process boundary; and the sealed answer key cannot silently drift from its own answer text. What it does **not** and cannot prove by itself is criterion 1's actual claim — that a **separate, later execution context**, given only the committed store and `QUESTION.md`, can answer correctly without having seen this plan's own prose. That is a claim about a session boundary that no single-process test can sample (11-VALIDATION.md's own stated reason for splitting this into two plans across two waves). This plan is the honest first half: it commits the artifacts and the falsifiability-checked question. Plan 11-09 is where the actual claim gets tested, against a genuinely separate execution context.

## Next Phase Readiness

- Plan 11-09 has exactly two permitted inputs (`recon-subject.regen2000proj`, `QUESTION.md`) and a mechanical pass/fail check (`r2000-answer-key.test.ts`, already green and already proven non-vacuous).
- No blockers. `regenerator2000` and ACME both remain available and live-verified on this host.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/fixture/recon-subject.a
- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/fixture/recon-subject.prg
- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj
- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/SESSION-A-TRANSCRIPT.md
- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/QUESTION.md
- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/ANSWER.md
- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/ANSWER.sha256
- FOUND: .claude/mcp/vice/r2000-answer-key.test.ts
- FOUND commit: d08c7ef (feat(11-07): purpose-made recon-subject fixture with real structure)
- FOUND commit: 6d76ee5 (feat(11-07): session A -- annotate recon-subject via the curated r2000_* tools)
- FOUND commit: 21c347a (feat(11-07): the store-only question, its sealed answer, and the seal-drift test)
