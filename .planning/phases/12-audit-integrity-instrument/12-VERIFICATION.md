---
phase: 12-audit-integrity-instrument
verified: 2026-08-21T18:40:00Z
status: gaps_found
score: 6/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The hook detects a gated status written through Bash — heredoc, append and tee shapes (D-12-04, plan 12-02 must_have truth)"
    status: failed
    reason: >
      Independently reproduced: `isHookInScope("Bash", {command: 'echo "status: passed"
      >> .planning/v9.9.9-MILESTONE-AUDIT.md'}, extraction)` returns `false` (should be
      `true`). `writtenDeclaresGatedStatus()` is line-anchored (`/^\s*status:\s*(.*)$/`)
      and a one-line shell command has no `\n`, so the single most ordinary way to append
      a status line from a shell one-liner is never caught, contradicting the plan's own
      explicit claim that "append" shape is covered. This is not the accepted T-12-02
      obfuscation limitation (base64/python -c) — the text `status: passed` is verbatim
      in the command.
    artifacts:
      - path: "scripts/audit-gate.mjs"
        issue: "isHookInScope()'s Bash branch (:550-553) reuses the line-anchored writtenDeclaresGatedStatus() (:495-511) instead of a line-agnostic token scan"
    missing:
      - "A Bash-specific gated-status scan that searches the command text anywhere, not line-anchored (e.g. reuse isGatedStatus()'s value set against /\\bstatus:\\s*['\"]?(passed|tech_debt)/i on the whole command string)"
      - "A committed test exercising the single-line echo/printf append form (only the heredoc form is currently pinned)"
  - truth: "In-scope internal errors fail closed (exit 2); out-of-scope calls exit 0 fast; a bug in the gate cannot brick unrelated Write/Edit/Bash calls (D-12-14, scoped, plan 12-02 must_have truth)"
    status: failed
    reason: >
      Two independently confirmed defects violate this. (1) collectStringLeaves()
      (scripts/audit-gate.mjs:404-420, recursion at :411) has no depth guard; a
      60,000-level-deep array under an unrecognised tool_input key crashes the process
      with an uncaught RangeError (exit code 1) before scope is even determined —
      reproduced directly against the committed exports. (2) BASH_INPLACE_EDIT_RE
      (scripts/audit-gate.mjs:522-523) exhibits super-linear backtracking: 10k/20k/30k
      filler chars after "sed -i " measured at 64ms/304ms/564ms in this verification run
      (independently corroborating the reviewer's 20k=422ms/40k=2196ms table) — an
      ordinary large sed -i/perl -i Bash call unrelated to any milestone audit can hang
      the hook process for seconds to minutes. This hook is wired to every Bash call in
      every session via the committed .claude/settings.json (matcher "Write|Edit|Bash",
      timeout 30), so both defects are live, not theoretical.
    artifacts:
      - path: "scripts/audit-gate.mjs"
        issue: "collectStringLeaves() (:404-420) unbounded recursion; BASH_INPLACE_EDIT_RE (:522-523) catastrophic-backtracking-prone regex"
    missing:
      - "A depth cap on collectStringLeaves() (iterative walk or explicit depth limit) so it degrades to exit 2 instead of crashing with an uncaught RangeError"
      - "A bounded, non-backtracking replacement for BASH_INPLACE_EDIT_RE (input slice cap or two independent non-overlapping regexes)"
      - "A try/catch around the hook's scope-determination path so an internal error here also produces the documented exit 2, matching hookGuardVerdict()'s existing try/catch pattern (WR-03 in 12-REVIEW.md notes the same asymmetry exists in check mode)"
  - truth: "scripts/audit-gate.mjs --hook refuses via exit 2 + stderr only, never a silent/wrong exit code, for any in-scope call (D-12-03, plan 12-02 must_have truth)"
    status: failed
    reason: >
      Direct consequence of the collectStringLeaves() crash above: the documented
      contract is exit 0 (out-of-scope, fail-open) or exit 2 (in-scope, fail-closed
      refusal) — never anything else. The reproduced RangeError crash exits 1 with a raw
      Node stack trace, which is neither contract, for exactly the fallback path
      (T-12-08's unrecognised-shape defense) built to be the most defensive one.
    artifacts:
      - path: "scripts/audit-gate.mjs"
        issue: "hookMain()'s try/catch around hookGuardVerdict() does not cover the earlier extractHookTarget()/isHookInScope() call path where the crash originates"
    missing:
      - "Same fix as above: bound collectStringLeaves() and/or widen the try/catch in hookMain() to cover extraction, not just guard verdict computation"
deferred:
  - truth: "docs-review-disposition.test.ts is currently red because 12-REVIEW.md's CR-01/CR-02/CR-03/WR-01..WR-04 findings have no recorded disposition, which is why audit-integrity.test.ts's own real-tree D-12-02 assertion currently fails and node scripts/audit-gate.mjs currently refuses on this tree"
    addressed_in: "Phase 15"
    evidence: "REQUIREMENTS.md GATE-02 (mapped to Phase 15): 'Every open code-review finding across all phases is dispositioned ... and docs-review-disposition.test.ts runs green from a clean checkout' — this is a general, all-phases requirement that by its own wording covers Phase 12's own review findings, not only the named legacy ones."
human_verification:
  - test: "Restart the Claude Code session (or run /hooks and approve the newly committed project hook) so the committed .claude/settings.json PreToolUse entry is actually loaded, then: plant the same CLAUDE.md digit so docs-linerefs.test.ts is red; attempt to write a gated-status milestone audit via Write, via Edit, and via a Bash heredoc; confirm all three are refused live, in-session, with the gate's stderr text visible; revert and confirm the same Write succeeds; append the observed results to 12-GATE-PROOF.md under a 'Live in-session hook block' section."
    expected: "All three write routes refused live with the documented refusal text while the guard is red; the same Write succeeds after the revert."
    why_human: "This is exactly the deferred <human-check> block in 12-04-PLAN.md's <verify> section. It was never performed: 12-GATE-PROOF.md contains no 'Live in-session hook block' section (grep confirms zero matches), and the document's own closing section states plainly that 'The live in-session hook block is not exercised by this document.' Everything captured so far runs the mechanism as a direct subprocess, which proves the mechanism's logic works but not that Claude Code's actual PreToolUse dispatch (session-loaded hook config) fires it."
  - test: "Confirm subagent-routed tool calls (A2) and a real Bash heredoc's full multi-line body (A3) actually reach the --hook payload the way 12-HOOK-STDIN-EVIDENCE.md assumes."
    expected: "Either both are confirmed CONFIRMED with a captured transcript, or the current UNCONFIRMED status is accepted as a standing, disclosed limitation."
    why_human: "12-HOOK-STDIN-EVIDENCE.md's own frontmatter records both as UNCONFIRMED ('no live PreToolUse hook exists on this host to test either context against' for A2; A3 'could not be resolved by transcript' inspection). This is honestly disclosed, not hidden, but remains an open empirical question a human with a live hook-enabled session needs to close."
---

# Phase 12: Audit Integrity Instrument Verification Report

**Phase Goal:** A milestone audit cannot record `status: passed` while any of the four
`docs-*.test.ts` guards is red — the precondition is mechanically enforced, not documented.
**Verified:** 2026-08-21T18:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC1) A guard deliberately turned red is proven to block the audit-`passed` path | ✓ VERIFIED (with caveat, see gap rows) | `12-GATE-PROOF.md` §2-4 transcript; independently reproduced live: `node scripts/audit-gate.mjs` on this real tree right now returns `audit-gate: REFUSED`, exit 1, naming red guards and quoting failing assertion text — the exact D-12-15 three-part refusal shape, on a genuinely red tree |
| 2 | (SC2) With all four guards genuinely green, the same mechanism allows `status: passed` | ✓ VERIFIED | `12-GATE-PROOF.md` §1 (baseline) and §9 (post-revert): `audit-gate: OK` exit 0 captured both before and after the plant; the committed planted-false-negative test (D-12-16, test 7 of `audit-integrity.test.ts`) still passes in this verification's own run of the suite |
| 3 | (SC3) The check point lives in code/an executable script the audit command actually calls, cited by file and line | ✓ VERIFIED | `checkAuditGate()` at `scripts/audit-gate.mjs:298`; `hookMain()`/`hookGuardVerdict()` at `:744-756`/`:588-604`; wired live via `.claude/settings.json:9` (`node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook`, matcher `Write\|Edit\|Bash`); wired into `npm test`/CI via `.claude/mcp/vice/audit-integrity.test.ts` (spawns the real CLI). Confirmed by reading and by running both invocation paths directly. Caveat: the code exists and is genuinely called — but see gap rows for its reliability once called |
| 4 | (D-12-10/11) Guards re-run live in a subprocess every invocation, invoked as guard files directly, never `npm test` | ✓ VERIFIED | `runGuardsLive()` (`scripts/audit-gate.mjs:128`) calls `spawnSync(process.execPath, ["--test", ...files], ...)` with an explicit file list derived from `docsGuardFiles()`, not a package-script name |
| 5 | (D-12-12/13) `status: passed` and `status: tech_debt` both gated; `status: gaps_found` never gated | ✓ VERIFIED | `isGatedStatus()` exported; live real-tree evidence in `12-GATE-PROOF.md` §5 shows exactly the 4 gated files (3 `tech_debt` + 1 `passed`) and 2 `gaps_found` files passing through ungated, reproduced by this verification's own `node scripts/audit-gate.mjs` run above (same 4 gated files named) |
| 6 | (D-12-16) A committed planted-violation/false-negative pair proves the gate bites/clears | ✓ VERIFIED | `audit-integrity.test.ts` tests 6-7 ("planted violation"/"planted false-negative") pass in this verification's own run of the 27-test suite, independent of the real tree's current red state |
| 7 | (D-12-03) Hook mode refuses via exit 2 + stderr only for every in-scope call; field-name-agnostic fallback cannot silently no-op | ✗ FAILED | See gap: `collectStringLeaves()` crashes with an uncaught `RangeError` (exit 1, not 0 or 2) on a deeply-nested unrecognised `tool_input` — reproduced independently in this verification |
| 8 | (D-12-04) Hook detects a gated status written through Bash — heredoc, append, and tee shapes | ✗ FAILED | See gap: `echo "status: passed" >> ...MILESTONE-AUDIT.md"` is NOT detected (`isHookInScope` returns `false`) — reproduced independently in this verification, exit 0 where exit 2 is required |
| 9 | (D-12-14, scoped) A bug in the gate cannot brick unrelated Write/Edit/Bash calls repo-wide | ✗ FAILED | See gap: `BASH_INPLACE_EDIT_RE` shows measured super-linear blowup (64/304/564ms at 10k/20k/30k chars in this verification's own run) on ordinary large `sed -i` commands unrelated to any audit file; this hook is live on every Bash call via committed `.claude/settings.json` |
| 10 | Live in-session hook block (the 12-04-PLAN.md end-of-phase human-check) was performed and recorded | ? UNCERTAIN | `12-GATE-PROOF.md` contains zero matches for "Live in-session hook block"; the document's own closing section states the live in-session block "is not exercised by this document" |
| 11 | Hook payload field-shape assumptions A2 (subagent routing) and A3 (heredoc full-body capture) are resolved | ? UNCERTAIN | `12-HOOK-STDIN-EVIDENCE.md` frontmatter records both as `UNCONFIRMED`, honestly disclosed but unresolved |

**Score:** 6/11 truths verified (3 failed as blockers, 2 uncertain pending human decision)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | The current real-tree red state of `docs-review-disposition.test.ts` (caused by 12-REVIEW.md's own CR-01/02/03/WR-01-04 findings having no recorded disposition) | Phase 15 | REQUIREMENTS.md GATE-02: "Every open code-review finding across all phases is dispositioned ... and `docs-review-disposition.test.ts` runs green from a clean checkout" |

Note: the deferral above covers only the *symptom* (the guard being red because findings are undispositioned). It does **not** cover the underlying functional defects (CR-01/02/03) themselves — those are failures of this phase's own plan 12-02 must-have truths (D-12-03, D-12-04, D-12-14) and are listed as gaps above, not deferred, because GATE-02 only requires a *disposition* (fix, accept, or defer with rationale), not that the code actually work as originally claimed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/audit-gate.mjs` | Single check point: check mode + `--hook` mode | ✓ EXISTS, SUBSTANTIVE, WIRED — but contains 3 independently-confirmed defects (CR-01/02/03) in the `--hook` Bash/fallback paths | 860 lines; exports `checkAuditGate`, `hookMain` (via CLI dispatch), `docsGuardFiles`, `runGuardsLive`, `isGatedStatus`, `frontmatterStatus`, `milestoneAuditFiles`, `extractHookTarget`, `isHookInScope`, `writtenDeclaresGatedStatus` — all confirmed present by direct import |
| `.claude/mcp/vice/audit-integrity.test.ts` | Layer 1 (clean-checkout) + hook-mode + settings-wiring tests | ✓ EXISTS, SUBSTANTIVE, WIRED | 711 lines, 27 tests (2 suites); 26 pass / 1 fail in this verification's own run — the 1 failure is the expected real-tree D-12-02 assertion, correctly firing because the tree is genuinely red right now (see Deferred Items) |
| `.claude/settings.json` | Committed, hooks-only `PreToolUse` wiring | ✓ EXISTS, SUBSTANTIVE, WIRED | Contains exactly one top-level key (`hooks`), matcher `Write\|Edit\|Bash`, command `node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook`, timeout 30 — confirmed by direct read |
| `.gitignore` | Amended to ignore `settings.local.json` instead of `settings.json`, with rationale | ✓ EXISTS, SUBSTANTIVE | Lines 51-61 confirmed by direct read: rationale comment present, `/.claude/settings.local.json` ignored |
| `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md` | Real-tree red/green plant-and-revert transcript | ✓ EXISTS, SUBSTANTIVE for criteria 1/2 — ⚠️ INCOMPLETE for the live in-session human-check task it itself defers | 380+ lines; contains `audit-gate: REFUSED`, `audit-gate: OK`, `docs-linerefs.test.ts`, `reverted: true`; missing the "Live in-session hook block" section its own closing text promises via a deferred human-check |
| `.planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md` | Empirical resolution of RESEARCH assumption A1 | ✓ EXISTS, SUBSTANTIVE — A1 resolved, A2/A3 openly UNCONFIRMED | Confirmed via transcript-derived evidence, not a live hook (none was registered on this host); honestly labelled |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `.claude/mcp/vice/audit-integrity.test.ts` | `scripts/audit-gate.mjs` | `spawnSync` of the CLI with `--root`/`--json` | ✓ WIRED | Confirmed: `GATE = join(ROOT, "scripts", "audit-gate.mjs")` at line 58, invoked via `spawnSync` throughout |
| `scripts/audit-gate.mjs` | `.claude/mcp/vice/docs-*.test.ts` | `readdirSync`-derived glob + `spawnSync(node, ["--test", ...guards])` | ✓ WIRED | Confirmed: `docsGuardFiles()`/`runGuardsLive()`; live run in this verification named exactly the 4 expected guard files |
| `scripts/audit-gate.mjs --hook` | `checkAuditGate()` / shared guard logic | Same exported functions as check mode | ✓ WIRED (logic shared) — ⚠️ but the shared logic's Bash/fallback extraction path has confirmed defects | `hookGuardVerdict()` reuses `docsGuardFiles()`/`runGuardsLive()`/`DOCS_GUARD_FLOOR`/`EXPECTED_DOCS_GUARD_NAMES` — one seam confirmed by reading; the seam's own extraction helpers (`collectStringLeaves`, `bashTargetsMilestoneAudit`) are where CR-01/02/03 live |
| `.claude/settings.json` | `scripts/audit-gate.mjs` | `PreToolUse` `hooks[].command` | ✓ WIRED (as configuration) — ? UNCERTAIN whether it fires live in any given session (see human verification) | Confirmed the file declares it; not confirmed that a live Claude Code session actually dispatches through it (12-GATE-PROOF.md's own closing section states this explicitly) |
| `CLAUDE.md` | `docs-linerefs.test.ts` | planted-then-reverted `vice-proxy.ts:<N>` digit | ✓ WIRED | Confirmed: `git status --porcelain` is clean on this tree right now; `CLAUDE.md` carries the original `3029` citation, matching the "reverted" claim |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Check mode refuses on the real, currently-red tree | `node scripts/audit-gate.mjs` | `audit-gate: REFUSED`, exit 1, names all 4 red guards + quotes failing assertion text | ✓ PASS |
| `audit-integrity.test.ts` real-tree assertion fires correctly given the real red state | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | 26 pass / 1 fail — the 1 failure is exactly the expected D-12-02 real-tree assertion | ✓ PASS (expected-failure confirmed, not a defect) |
| Hook mode: Bash echo-append bypass (CR-03) | `isHookInScope("Bash", {command:'echo "status: passed" >> ...MILESTONE-AUDIT.md'}, extraction)` | `false` (should be `true`) | ✗ FAIL |
| Hook mode: unbounded recursion crash (CR-02) | `extractHookTarget("Write", {unknown_field: <20000-deep nested array>})` | `RangeError: Maximum call stack size exceeded` | ✗ FAIL |
| Hook mode: regex backtracking blowup (CR-01) | `isHookInScope("Bash", {command:"sed -i " + "x".repeat(N)}, extraction)` timed at N=10k/20k/30k | 64ms / 304ms / 564ms — super-linear growth confirmed | ✗ FAIL (confirms reviewer's finding independently) |
| `npm run typecheck` | `cd .claude/mcp/vice && npm run typecheck` | Clean, no errors | ✓ PASS |
| Settings wiring self-guard | `node --test audit-integrity.test.ts` "settings wiring" suite | 5/5 pass | ✓ PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` files or PLAN/SUMMARY references to a probe convention were found for this phase. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GATE-01 | 12-01, 12-02, 12-03, 12-04 (all four) | A milestone audit cannot record `status: passed` while any of the four `docs-*.test.ts` guards is red — mechanically enforced | ⚠️ PARTIALLY SATISFIED | Layer 1 (`checkAuditGate()`, the documented unevadable enforcement point) is solid and independently confirmed working on the real tree. Layer 2 (`--hook`, the live in-session deterrent) has three independently-confirmed defects (CR-01/02/03) that let realistic, non-adversarial Bash writes either bypass detection, crash, or hang the hook — undermining the "mechanically enforced" claim for the in-session path specifically. No requirement was left completely unaddressed; GATE-01 is not fully, reliably delivered as-is. |

No orphaned requirements: REQUIREMENTS.md maps only `GATE-01` to Phase 12 (`.planning/REQUIREMENTS.md:39`, and the phase table at line 98), and all four plans declare `requirements: [GATE-01]`. `GATE-02` is explicitly Phase 15's, not Phase 12's.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/audit-gate.mjs` | 522-523 | Catastrophic-backtracking regex (`BASH_INPLACE_EDIT_RE`) | 🛑 Blocker | Live DoS risk on every Bash call in every session via the committed hook (CR-01) |
| `scripts/audit-gate.mjs` | 404-420 | Unbounded recursion, no depth guard (`collectStringLeaves`) | 🛑 Blocker | Crashes the hook process with an uncaught exception on a small crafted/deeply-nested payload, violating the documented fail-closed contract (CR-02) |
| `scripts/audit-gate.mjs` | 495-511, 550-553 | Line-anchored status scan applied to a single-line Bash command | 🛑 Blocker | The single most ordinary shell append form (`echo ... >> file`) bypasses hook-mode detection entirely (CR-03) |
| `scripts/audit-gate.mjs` | 147-151 | `spawnSync` with no `timeout` in `runGuardsLive()` | ⚠️ Warning | No bound if a guard test itself hangs (WR-01, not independently re-verified beyond code inspection) |
| `scripts/audit-gate.mjs` | 304-329 | Empty guard set triggers full-suite `node --test` auto-discovery instead of "run zero guards" | ⚠️ Warning | Slow diagnostic path on a structural failure (WR-02, not independently re-verified beyond code inspection) |
| `scripts/audit-gate.mjs` | 298-329 vs 744-756 | Asymmetric error handling: check mode has no try/catch equivalent to hook mode's | ⚠️ Warning | An uncaught `ENOENT` from a bad `--root` crashes check mode with a raw stack trace (WR-03, not independently re-verified) |
| `scripts/audit-gate.mjs` | 453-455 | Dead code: Bash `command` pushed to `pathish` but never read there | ℹ️ Info | Cosmetic/confusing, not functionally harmful (WR-04) |

No `TBD`/`FIXME`/`XXX` debt markers found in any file modified by this phase (`scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`, `.claude/settings.json`, `.gitignore`) — the debt-marker gate does not apply here. The critical findings above are functional defects, not deferred-work markers, which is arguably worse: they are undisclosed-until-review bugs in code already live-wired into every tool call in this repo.

### Human Verification Required

### 1. Live in-session `PreToolUse` hook block (deferred from 12-04-PLAN.md)

**Test:** Restart the Claude Code session (or run `/hooks` and approve the newly committed project hook) so `.claude/settings.json`'s `PreToolUse` entry is actually loaded. Plant the same one-digit `CLAUDE.md` change so `docs-linerefs.test.ts` is red. Attempt to write a gated-status milestone audit via the `Write` tool, via the `Edit` tool, and via a Bash heredoc. Confirm all three are refused live with the gate's stderr text visible. Revert the digit and confirm the same `Write` now succeeds. Append the results to `12-GATE-PROOF.md` under a "Live in-session hook block" section.
**Expected:** All three write routes refused live while the guard is red; the write succeeds after revert.
**Why human:** This is 12-04-PLAN.md's own deferred `<human-check>` block. It has never been performed — `12-GATE-PROOF.md` contains no "Live in-session hook block" section, and the document's own text states the live in-session path "is not exercised by this document." Everything verified so far (by this report and by the phase's own transcript) runs the mechanism as a direct subprocess call, which proves the logic works but does not prove Claude Code's actual tool-call dispatch fires it.

### 2. Hook payload shape assumptions A2/A3

**Test:** With a live, hook-enabled session, trigger a subagent tool call and observe whether/how it routes through `PreToolUse`; trigger a real Bash heredoc and inspect whether the full multi-line body reaches `tool_input.command` intact.
**Expected:** Either both resolve to CONFIRMED with a captured transcript, or the project explicitly accepts the current UNCONFIRMED state as a standing, disclosed limitation.
**Why human:** `12-HOOK-STDIN-EVIDENCE.md`'s own frontmatter marks both `UNCONFIRMED`; no PreToolUse hook existed on the research host to test against, and heredoc full-body capture could not be resolved from transcript inspection alone.

### Gaps Summary

Layer 1 — the documented "unevadable enforcement point" (`checkAuditGate()` re-reading the real committed file, run via `npm test`/CI through `audit-integrity.test.ts`) — is solid. It is genuinely code, genuinely wired, genuinely re-run live every invocation, and I independently reproduced it correctly refusing on this repository's real, currently-red tree (exit 1, all four red guards named, D-12-15's three-part refusal shape present) and correctly allowing on the recorded green baseline/post-revert runs in `12-GATE-PROOF.md`. Roadmap success criteria 2 and 3 hold.

Layer 2 — the live `PreToolUse --hook` mode, which is the part of the mechanism that actually intercepts a write *before* it lands rather than catching it after the fact — has three independently-confirmed, previously-undisclosed defects that go beyond the one limitation (`T-12-02`, base64/`python -c` obfuscation) the phase's own documents already accept:

1. **CR-03**: a plain `echo "status: passed" >> file.md` Bash append is not detected at all (bypass, exit 0 where exit 2 is required) — directly contradicting plan 12-02's own must-have claim that append shape is covered.
2. **CR-02**: a small, deeply-nested `tool_input` crashes the hook process with an uncaught `RangeError` (exit 1), neither the documented exit-0 nor exit-2 contract, in exactly the fallback path built to be the most defensive one.
3. **CR-01**: a catastrophic-backtracking regex hangs the hook for seconds-to-minutes on an ordinary large `sed -i`/`perl -i` Bash command unrelated to any audit file — and this hook is wired live to every Bash call in every session in this repo right now, via the committed `.claude/settings.json`.

All three were independently reproduced in this verification (not merely re-read from `12-REVIEW.md`), and all three map directly to explicit, falsifiable must-have truths in plan 12-02's own PLAN frontmatter (D-12-03, D-12-04, D-12-14 scoped). They are BLOCKER-severity because the hook is already live and wired against every tool call in this and every future session in this repo, and its whole stated value proposition — catching the write live, in-session — is what these three defects break for realistic, non-adversarial input.

Separately, and lower severity but still open: the phase's own end-of-phase human-check (a fresh-session test of the actual live hook dispatch) was never performed, and two research assumptions (A2/A3) remain openly unconfirmed. Both are honestly disclosed in the phase's own artifacts, not hidden, but they mean roadmap success criterion 1's "the mechanism refusing" has only ever been observed via direct subprocess invocation, never via Claude Code's real tool-call pipeline.

The current real-tree red state (`docs-review-disposition.test.ts` failing because this phase's own review findings are undispositioned) is deferred to Phase 15 (GATE-02), since that phase's stated goal explicitly covers dispositioning open findings across all phases — but that deferral covers only the disposition of the finding, not a guarantee that CR-01/02/03 get fixed. Those three remain open gaps against this phase's own must-haves regardless of what Phase 15 later decides to do with the finding record.

**This could be accepted as intentional scope** if the project's position is that Layer 1 alone satisfies GATE-01 and Layer 2 is explicitly a best-effort deterrent whose known-broken edge cases are acceptable pending a fix in a later phase. If so, add an override to this file's frontmatter:

```yaml
overrides:
  - must_have: "The hook detects a gated status written through Bash — heredoc, append and tee shapes (D-12-04)"
    reason: "Layer 1 (checkAuditGate() via npm test/CI) is the accepted unevadable enforcement point; Layer 2's Bash coverage gaps are a known, accepted limitation pending a follow-up fix"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
  - must_have: "A bug in the gate cannot brick unrelated Write/Edit/Bash calls repo-wide (D-12-14, scoped)"
    reason: "<rationale for accepting the live ReDoS/crash risk pending a follow-up fix>"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

---

_Verified: 2026-08-21T18:40:00Z_
_Verifier: Claude (gsd-verifier)_
