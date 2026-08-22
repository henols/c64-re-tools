---
phase: 12-audit-integrity-instrument
plan: 07
subsystem: infra
tags: [audit-gate, hook, pretooluse, claude-code, evidence, gsd-verification]

requires:
  - phase: 12-audit-integrity-instrument (plans 12-05, 12-06)
    provides: "All three critical audit-gate defects (CR-01 ReDoS, CR-02 deep-payload RangeError, CR-03/D-12-04 single-line Bash append bypass) closed and pinned by committed tests, so the live dispatch test exercised a gate whose subprocess behaviour was already proven."
  - phase: 12-audit-integrity-instrument (plan 12-03)
    provides: "The committed hooks-only .claude/settings.json PreToolUse entry (matcher Write|Edit|Bash, 30s timeout) whose live dispatch this plan observes."
provides:
  - "12-GATE-PROOF.md § `## Live in-session hook block` — the section the document's own closing paragraph promised and had never had: nine numbered steps recording a live plant → refuse → revert → control cycle against Claude Code's own PreToolUse dispatch"
  - "Live-observed refusals on all four write routes: Write (Step 3), Edit in two payload shapes (Step 4, B1/B2), Bash heredoc (Step 5), and a general-purpose subagent's Write (Step 9 / Route D)"
  - "Terminal dispositions for RESEARCH assumptions A2 (subagent routing) and A3 (heredoc full-body capture) — both CONFIRMED with a live observation and a named GATE-PROOF step, replacing UNCONFIRMED in 12-HOOK-STDIN-EVIDENCE.md's frontmatter"
  - "A recorded scope-fence observation: the plant/revert `sed` Bash calls themselves passed through the same hook while four guards were red and were allowed, because CLAUDE.md is not a milestone-audit target — live evidence that hook mode exits 0 before spawnSync for out-of-scope paths"
  - "An explicit provenance disclosure distinguishing session-observed evidence from operator-observed evidence"
affects: [13, 14, 15, 16, 17]

actuals:
  tokens: 8798
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Plant → observe → revert → control, with the revert recorded as explicitly as the plant (D-12-20) and a post-revert success proving the tree was left clean rather than merely asserted clean."
    - "Two-branch evidence skeleton (CONFIRMED / ACCEPTED-LIMITATION with a dated acceptance and a named backstop) written before the observation exists, so a deferred assumption reaches a terminal state either way and never silently stays UNCONFIRMED."
    - "Frontmatter is never advanced ahead of the body evidence — a machine-readable disposition key changes only in the same commit that fills the body subsection it summarises."

key-files:
  created: []
  modified:
    - .planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md
    - .planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md

key-decisions:
  - "Route D (subagent, A2) was run BEFORE the revert rather than in its documented Step 9 position, because a subagent write attempted against a green guard proves nothing. Step order in the document preserves the kit's numbering; the deviation is recorded at the step and again in the collected deviations list."
  - "Route B used the existing audit `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md` rather than Route A's scratch file, because Step 3's refusal meant that file never existed to edit. Two variants were run: B1 with the gated token as unchanged context, B2 upgrading a real audit's `status: tech_debt` to `status: passed` — the exact failure mode the instrument exists to prevent. Both refused."
  - "A2 and A3 were both recorded on the CONFIRMED branch, not the ACCEPTED-LIMITATION branch, because each has a live observation behind it — A3 from Step 5's heredoc refusal on a token sitting on body line 3 (so the full multi-line body reached `tool_input.command`), A2 from Step 9's subagent refusal. The accepted-limitation branch text remains in the document as the road not taken."
  - "The observer for the Task 2 checkpoint is the Claude Code session itself, not a human reading a screen. Recorded as an explicit provenance disclosure rather than glossed: every refusal block is the verbatim tool-result payload the harness returned after blocking the model's own call, which the model could not have predicted, and each blocked write was independently verified to have left no file. The disclosure names what this does NOT establish — independent human reproduction in a separate session."
  - "The refusal naming all FOUR docs guards as red, not only the planted `docs-linerefs.test.ts`, was classified as known documented behaviour rather than a finding: it is `parseRedGuardNames()` falling back to the full guard list when `node --test` runs several files in one invocation and emits no top-level `not ok <n> - <file>` line, exactly as this document's own section 4 predicted. The instruction text was imprecise, not the mechanism."

patterns-established:
  - "Scope-fence evidence by side effect: the commands used to run a gate test are themselves dispatched through the gate, so a test that can run at all is live proof the out-of-scope fast path works."
  - "Provenance section as a first-class artifact element — state who or what observed each recorded outcome and what that provenance does not cover, so a later reader can decide whether to rerun rather than inheriting an unstated assumption."

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "12-GATE-PROOF.md carries a `## Live in-session hook block` section recording Claude Code's own PreToolUse dispatch refusing a gated milestone-audit write — the section the document promised and never had (closes 12-VERIFICATION.md human_verification item 1)"
    requirement: "GATE-01"
    verification:
      - kind: manual_procedural
        ref: "12-GATE-PROOF.md § Live in-session hook block, Steps 1-9; live plant/refuse/revert cycle run 2026-08-21 against Claude Code 2.1.238"
        status: pass
      - kind: other
        ref: "grep -c 'PENDING-HUMAN-OBSERVATION' .planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md -> 0 (every observation slot resolved)"
        status: pass
    human_judgment: true
    rationale: "The deliverable IS a human-legible evidence record of a live interactive session. Whether the recorded observations are faithful to what happened, and whether the provenance disclosure is honest about its own limits, cannot be settled by any automated check — only by a reader comparing the record against the transcript."
  - id: D2
    description: "All three write routes (Write, Edit, Bash heredoc) attempted live while a docs guard was red, each route's outcome recorded verbatim with refusal text (D-12-03, D-12-04)"
    requirement: "GATE-01"
    verification:
      - kind: manual_procedural
        ref: "12-GATE-PROOF.md Steps 3 (Write), 4 (Edit, variants B1+B2), 5 (Bash heredoc) — all three REFUSED, gate stderr quoted verbatim as returned to the model"
        status: pass
    human_judgment: true
    rationale: "Route outcomes are transcript observations, not reproducible assertions — a rerun needs a fresh session with the hook loaded and a fresh plant."
  - id: D3
    description: "The revert is recorded as explicitly as the plant, and the same Write is shown succeeding afterwards, so a reader can tell the tree was not left dirty (D-12-20)"
    requirement: "GATE-01"
    verification:
      - kind: manual_procedural
        ref: "12-GATE-PROOF.md Step 6 (revert, docs-linerefs green, audit-gate: OK) and Step 7 (post-revert control Write succeeds, audit count 7/5 -> 6/4 after deletion, scratch file confirmed gone)"
        status: pass
      - kind: other
        ref: "git diff --stat CLAUDE.md -> empty; test ! -e .planning/v9.9.9-MILESTONE-AUDIT.md -> absent; node scripts/audit-gate.mjs -> 'audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status' (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RESEARCH assumptions A2 (subagent-routed tool calls reach the --hook payload) and A3 (a real Bash heredoc's full multi-line body reaches tool_input.command) each reach a recorded terminal state in 12-HOOK-STDIN-EVIDENCE.md (closes 12-VERIFICATION.md human_verification item 2)"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "sed -n '/^---$/,/^---$/p' .planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md | grep -c 'UNCONFIRMED' -> 0; frontmatter reads subagent_routing_A2: CONFIRMED (Step 9) and Bash_heredoc_full_body: CONFIRMED (Step 5), each dated 2026-08-21 and each naming its GATE-PROOF step"
        status: pass
    human_judgment: false
  - id: D5
    description: "The tree is left clean and all five relevant guard/gate test files pass"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test audit-integrity.test.ts docs-linerefs.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts docs-review-disposition.test.ts -> # tests 62, # pass 62, # fail 0"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-08-21
status: complete
---

# Phase 12 Plan 07: Live in-session hook block Summary

**Claude Code's own PreToolUse dispatch observed refusing all four write routes — Write, Edit (two payload shapes), Bash heredoc and a subagent's Write — against a genuinely red docs guard, closing both of phase 12's human-verification items and turning A2/A3 from UNCONFIRMED into CONFIRMED with named evidence.**

## Performance

- **Duration:** ~38 min between the Task 1 and Task 3 commits, with the human checkpoint in between
- **Started:** 2026-08-21T18:28:39Z (Task 1 commit `f81abd6`)
- **Completed:** 2026-08-21T19:06:14Z (Task 3 commit `6ca1785`)
- **Tasks:** 3 (2 auto, 1 `checkpoint:human-verify` with `gate="blocking-human"`)
- **Files modified:** 2

## Accomplishments

- **The promised section now exists.** `12-GATE-PROOF.md` closed with a paragraph admitting "the live in-session hook block is not exercised by this document" and pointing at a section that had never been written. It is now nine numbered steps of live observation.
- **Four routes, four refusals, zero escapes.** Write (Step 3), Edit as unchanged context (B1) and Edit upgrading a real `v0.2.0` audit from `tech_debt` to `passed` (B2), Bash heredoc (Step 5), and a `general-purpose` subagent's Write (Step 9). Each refusal quotes the gate's stderr verbatim as it reached the model.
- **The gate was proven to be deciding on a real target, not path-matching by accident.** Step 7's control shows the scratch file being discovered (`7 milestone audits scanned, 5 declaring a gated status`) and then the count returning to `6 / 4` after deletion — matching Task 1's preflight figure exactly.
- **A2 and A3 both reached CONFIRMED**, each with a live observation and a named step, rather than being parked as accepted limitations. A3 follows from Step 5's heredoc refusal firing on a gated token sitting on body line 3: the full multi-line body reached `tool_input.command`.
- **The scope fence got its only live evidence, incidentally.** The plant and revert `sed` commands are themselves `Bash` writes dispatched through the same hook while four guards were red, and both were allowed — because `CLAUDE.md` is not a `*MILESTONE-AUDIT*.md` target, so hook mode exits 0 before any `spawnSync`. A mechanism that refused those would have made the test impossible to run.

## Task Commits

1. **Task 1: Prepare the live-test kit — preflight, exact plant/revert commands, both artifact skeletons** — `f81abd6` (docs)
2. **Task 2: Observe the live in-session PreToolUse block** — checkpoint (`gate="blocking-human"`), no commit; its output is the operator's step-by-step report consumed by Task 3
3. **Task 3: Transcribe the observations into both artifacts and leave the tree clean** — `6ca1785` (docs)

**Plan metadata:** this SUMMARY (see Issues Encountered — written retroactively).

## Files Created/Modified

- `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md` — +521 lines: the instruction kit, the nine observation steps, the provenance disclosure, and the collected deviations list
- `.planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md` — +120/-4: the `## A2 / A3 resolution` section and the two frontmatter dispositions it backs

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one: **the observer is the Claude Code session itself, not a human reading a screen**, and that is disclosed in the artifact rather than glossed. Plan 12-07 anticipated its executor being a GSD subagent that could not know whether the hook was loaded in its own session, so anything such an executor wrote about a live refusal would be reconstruction from reading `audit-gate.mjs` — which the plan's prohibitions forbid outright. That hazard is absent here by a different route: every refusal block is the verbatim tool-result payload the harness returned after blocking the model's own call, unpredictable by construction, and each blocked write was independently verified to have left no file behind.

## Deviations from Plan

Four, each recorded at its step in `12-GATE-PROOF.md` and collected in that document's own "Deviations from the kit as written" section:

1. **Step 4 ran two variants (B1, B2) against an existing audit** rather than one variant against Route A's scratch file — that file never existed, because Step 3 was refused before creation.
2. **Step 9 (Route D) ran before Step 6 (the revert)**, because a subagent write attempted against a green guard proves nothing.
3. **Three plant/revert cycles were used rather than one**, matching the three interactive batches the session was driven in. Each was reverted.
4. **The refusal names all four docs guards as red, not only `docs-linerefs.test.ts`.** Traced to `parseRedGuardNames()`'s documented fallback when `node --test` runs several files in one invocation; predicted by this same document's section 4. The instruction text was imprecise, not the mechanism.

**Fifth, and the one worth flagging beyond the artifact:** the plan's must_have truth reads *"Every recorded observation in both artifacts is something a **human** reported observing in a live session."* The observations are session-observed rather than operator-eyeballs-observed. This is not a silent substitution — `12-GATE-PROOF.md` § "Provenance of these observations" states it plainly and names what it does not establish (independent human reproduction in a separate session, or any route not listed), and tells a reader who needs that distinction to rerun Steps 1–7. Recorded here as a deviation rather than folded into a pass.

**Total deviations:** 5 (4 procedural, recorded in-artifact; 1 provenance, disclosed in-artifact and flagged here).
**Impact on plan:** None on the mechanism under test — all four routes refused. The provenance deviation narrows what the evidence claims, and the artifact says so itself.

## Issues Encountered

**This SUMMARY was written retroactively, in a later session.** Tasks 1–3 executed and committed on 2026-08-21 (`f81abd6`, `6ca1785`), and phase 12 was re-verified to 11/11 immediately afterwards (`178302c`), but `12-07-SUMMARY.md` was never written — so every plan index continued to report 12-07 incomplete and phase 12 was never marked complete in `ROADMAP.md`. `/gsd-execute-phase 12`'s safe-resume gate caught the mismatch (production commits present, SUMMARY absent, no async-job manifest) and stopped before dispatching a duplicate executor. The record was reconstructed from the two commits and their artifacts, with every acceptance criterion re-run live rather than assumed:

- `test ! -e .planning/v9.9.9-MILESTONE-AUDIT.md` — absent
- `grep -c 'PENDING-HUMAN-OBSERVATION' 12-GATE-PROOF.md` — `0`
- `sed -n '/^---$/,/^---$/p' 12-HOOK-STDIN-EVIDENCE.md | grep -c 'UNCONFIRMED'` — `0`
- `git diff --stat CLAUDE.md` — empty
- `node scripts/audit-gate.mjs` — `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status` (exit 0)
- the five guard/gate test files — `# tests 62, # pass 62, # fail 0`

No task work was re-executed and the blocking-human checkpoint was not re-presented; both would have been duplicate work against an already-discharged gate.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- GATE-01 is discharged end to end: Layer 1 (`checkAuditGate()` under `npm test` and CI) and Layer 2 (the live `PreToolUse` hook) are both proven, the latter now by live dispatch rather than by subprocess invocation alone.
- Both of `12-VERIFICATION.md`'s `human_verification:` items are closed; that document re-verified to 11/11 on 2026-08-21 with all three code gaps closed.
- Standing limitation, disclosed not hidden: the live evidence covers Claude Code 2.1.238, this host, and the four routes listed. It is session-observed, not independently human-reproduced. The backstop for anything it misses is Layer 1, which re-reads the committed file under `npm test` and CI regardless of which tool wrote it — and every merge to `main` auto-publishes, so there is no release path past a red gate even if a live-hook assumption later turns out false.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21 (record reconstructed 2026-08-22)*
