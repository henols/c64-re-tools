---
status: diagnosed
phase: 17-project-identity-and-ledger-close
source: [17-VERIFICATION.md]
started: 2026-08-23T10:00:00Z
updated: 2026-08-23T13:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Confirm whether CORE-01's must_have truth 3 is satisfied by what actually happened at the blocking-human gate

expected: A human confirms that attended, informed delegation ("you decide") after being shown the full evidence at the `gate="blocking-human"` checkpoint satisfies the intent of must_have truth 3 and its sibling prohibition — or determines the literal wording ("the option a human selected") was not met, and either corrects the wording for future phases or accepts it as a disclosed deviation.
result: issue
severity_revised_from: major
reported: "Asked (1) whether the recorded Provenance account is true — that a human was stopped at the blocking-human gate, shown the six-for/five-against evidence, and replied \"you decide\" — and (2) whether the session deciding on their behalf was acceptable. Answered: \"1. no  2. pass\". The human does not confirm ever seeing that gate prompt; the `keep-dated` verdict itself is accepted. POST-DIAGNOSIS: the transcript disproves the premise of this answer — the gate was rendered and answered \"you decide \" after 298s. The answer is non-recall, elicited by a badly-framed memory question. At disposition the human chose \"Fix the wording\": correct the unverifiable \"having read it\" clause across all 9 passages, severity minor."
severity: minor

**Context.** The record is unusually transparent about the exact shape of what
happened, in `17-02-SUMMARY.md`, PROJECT.md's `*Provenance.*` paragraph, and
REQUIREMENTS.md's CORE-01 closure note: a human read the full evidence at the
blocking-human checkpoint and explicitly said "you decide" rather than picking
`restate` or `keep-dated` themselves; the orchestrating session then selected
`keep-dated`.

This satisfies the **anti-auto-approval** half of the prohibition — a human
genuinely attended and responded, and auto-mode's default-first-option
resolution was bypassed. It does not satisfy the **literal** half of must_have
truth 3, since a human did not personally select the option word. This is a
judgment call about provenance and intent, not a mechanically checkable fact,
which is why it was not resolved in the phase's favour by the verifier.

### 2. Read PROJECT.md's `## Core Value` entry end to end and confirm it reads as evidence weighed rather than a conclusion asserted

expected: (a) names the verdict actually chosen at the checkpoint; (b) cites at least one piece of evidence by name rather than gesturing at "the evidence"; (c) engages with the case against the verdict it reached; (d) the reversal condition is specific enough that a future reader could tell whether it has been met.
result: pass

**Context.** This is task 2's harvested `<human-check>` from `17-02-PLAN.md`,
deferred to end-of-phase per `workflow.human_verify_mode: end-of-phase`. It is
the one check that reaches the "weighed, not bookkeeping" half of CORE-01's
criterion. The verifier's own direct reading found all four sub-criteria
satisfied, but the plan's own workflow contract requires a human to confirm it
rather than accepting the verifier's reading alone.

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-17-1
  truth: "The provenance recorded for CORE-01's verdict accurately describes how the verdict was reached — specifically, that a human was shown the full evidence at plan 17-02 task 1's gate=\"blocking-human\" checkpoint and explicitly delegated the choice to the orchestrating session."
  status: failed
  reason: "User reported: asked whether that account is true, the human answered no — they do not confirm ever seeing the gate prompt or the six-for/five-against evidence, and did not say \"you decide\" in response to it. The human separately accepted the `keep-dated` verdict itself (answer 2 = pass), so the defect is the provenance record, not the decision."
  severity: minor
  severity_was: major
  test: 1
  disposition: |
    Human disposition at 2026-08-23 (post-diagnosis, options presented with the
    transcript evidence in hand): "Fix the wording" — keep this a gap at minor,
    correct the unverifiable comprehension clause across all 9 passages in 6
    documents, fix the four stale "5 tests" counts, and record that the
    transcript rather than operator recall is what settles the provenance
    question. CORE-01 stays [x], reported as intent-satisfied with a disclosed
    deviation (must_have truth 3 literally unmet: delegated, not selected).
    Explicitly NOT chosen: adding a provenance predicate to
    docs-core-value-decision.test.ts (offered, declined — the guard needs no
    change for correctness); PROJECT.md-only minimal fix; and passing test 1
    with no fix.
  scope: |
    Three artifacts assert the delegation as fact and would all be wrong together:
      1. .planning/PROJECT.md → `## Core Value` → the `*Provenance.*` paragraph
         ("The human, having read it, declined to select between the two options
         and explicitly delegated the call to the orchestrating session").
      2. .planning/phases/17-project-identity-and-ledger-close/17-02-SUMMARY.md
         → key-decisions entry, plus the "How the verdict was reached, stated
         precisely and not overstated" and "Acceptance criterion honesty note"
         paragraphs.
      3. .planning/REQUIREMENTS.md → CORE-01 closure note ("The choice was
         escalated to a human ... The human, having read it, declined to select
         between the two options and explicitly delegated the call").
    Also implicated: src/mcp/vice/docs-core-value-decision.test.ts asserts the
    string `blocking-human` is present in the Core Value section, so any
    correction to the provenance wording must keep that guard meaningful (or the
    guard must be updated in step with the corrected claim).
  severity_note: |
    Recorded `major` per the workflow's inference default (the user's answer was
    terse, with no blocker language). Arguable escalation to `blocker`: Phase 17
    is the audit-integrity phase, and its own stated purpose was to avoid
    "a record that reads as more human-decided than it was" (17-02-SUMMARY.md).
    An unsubstantiated claim of human attendance is precisely that failure mode,
    and it makes CORE-01's must_have truth 3 unmet rather than
    intent-satisfied. Diagnosis should settle whether the claim is false or
    merely unverifiable, and planning may raise the severity accordingly.
  root_cause: |
    NOT what the gap's `reason` supposed. The gate DID happen and the delegation
    IS real — the primary transcript was recovered and independently re-verified
    by the orchestrator:
    `~/.claude/projects/-home-henrik-dev-henrik-git-c64-re-tools/7ea4522f-2915-4ab7-a8b3-42c61f0a12f3.jsonl`
    carries the session's only CORE-01 `AskUserQuestion` (rendered 08:32:48Z,
    answered 08:37:46Z — 298s later) with the recorded answer, verbatim and
    including its trailing space: `"you decide "`, in reply to a question naming
    both `restate` and `keep-dated`. Auto-mode is ruled out (it resolves to the
    first option label instantly and without latency; note `keep-dated` WAS the
    first label, so the verdict is the same one a naive auto-resolve would have
    produced — but the transcript shows that is not how it was reached).
    Git metadata cannot corroborate either way: every Phase 17 commit is
    author+committer "Henrik Olsson" with no co-author trailers.

    The human's UAT "no" is therefore best explained as NON-RECALL, not as a
    denial of the event. Two aggravating factors in how it was elicited: the
    orchestrator framed test 1 as a memory question ("Does it match what you
    remember?") and asserted that absent memory was itself the defect; and the
    question came ~106 minutes after the exchange, right after the human had
    twice said they did not understand what was being asked of them.

    The RESIDUAL defect is real but far narrower than the gap first supposed —
    one clause, plus its propagation:
      (1) "The human, **having read it**, declined to select ..." asserts
          COMPREHENSION. That is unverifiable by construction: no artifact can
          evidence it, and it cannot be made true or false by inspection. It was
          synthesized by the orchestrator into its own continuation hand-off
          (transcript entry 178, 08:39:21Z) under a header reading "record this
          accurately, do not embellish it", and then MANDATED for publication in
          both PROJECT.md and 17-02-SUMMARY.md. The anti-overstatement guard it
          wrote for itself policed only the selection-vs-delegation axis and
          never noticed it was crossing the attendance-vs-comprehension axis.
      (2) "shown the full evidence (six for, five against)" is true of the
          TERMINAL RENDER preceding the modal (compressed paraphrases), but
          overstated as to the DECISION MODAL itself, which carried only the two
          option labels plus one "strongest argument" each. A human who engaged
          only the modal was not shown six-and-five.
      (3) No gate exists on provenance claims at all, which is why (1) and (2)
          propagated unchallenged: the continuation agent, 17-03 and the
          verifier each re-transcribed rather than re-derived
          (`17-02-SUMMARY.md:89` disclaims first-hand knowledge outright), and
          `17-VERIFICATION.md:149-150` corroborates the claim by citing the
          human's STANDING "you decide" preference — which is circular, since a
          standing delegation is precisely what permits an UNINFORMED response.
    Verdict on gap truth as originally worded: substantially TRUE. Verdict on
    the "having read it" clause: UNVERIFIABLE. Confidence: high on both.
  artifacts:
    - path: ".planning/PROJECT.md"
      issue: "lines 54-55, `## Core Value` → `*Provenance.*`: \"The human, having read it, declined to select between the two options\" — the sole indefensible clause, and the canonical copy"
    - path: ".planning/REQUIREMENTS.md"
      issue: "line 228, CORE-01 closure note: same \"having read it\" claim; also carries a stale \"5 tests\" count for docs-core-value-decision.test.ts, which now has 6"
    - path: ".planning/STATE.md"
      issue: "lines 75-77 and 427: \"the full evidence was presented to a human, who read it, declined to select\"; line 81 repeats the stale 5-test count"
    - path: ".planning/ROADMAP.md"
      issue: "line 528 \"a human saw the full evidence and responded to it\" (defensible as written); line 532 stale 5-test count"
    - path: ".planning/phases/17-project-identity-and-ledger-close/17-02-SUMMARY.md"
      issue: "line 35 \"having seen the full evidence\"; line 98 near-verbatim transcription of the synthesized entry-178 narrative; line 100 the honesty note that policed the wrong axis"
    - path: ".planning/phases/17-project-identity-and-ledger-close/17-03-SUMMARY.md"
      issue: "lines 28, 41, 136 restate the delegation; line 80 stale 5-test count"
    - path: ".planning/phases/17-project-identity-and-ledger-close/17-VERIFICATION.md"
      issue: "lines 149-150 corroborate human comprehension by citing the standing \"you decide\" preference — circular reasoning, since that preference is what permits an uninformed answer"
    - path: "src/mcp/vice/docs-core-value-decision.test.ts"
      issue: "NOT broken and does NOT pin the false claim — 6/6 green, and empirically all 6 predicates still hold with the entire *Provenance.* paragraph deleted. Its exposure is the opposite: it asserts nothing whatsoever about provenance, which is why the overstatement propagated. The `blocking-human` grep was a one-time acceptance criterion at 17-02-PLAN.md:295, never committed as an assertion."
  missing:
    - "Replace \"having read it\" with only what the artifacts evidence: the prompt was rendered, a free-text \"you decide\" was received ~5 minutes later, and the orchestrator then selected keep-dated. State plainly that comprehension is not evidenced."
    - "Correct \"shown the full evidence (six for, five against)\" to distinguish the terminal render from the two-label decision modal."
    - "Apply the correction to all 9 passages across 6 documents — not the 3 this gap originally named."
    - "Record that the operator did not recall the exchange when asked at UAT ~106 minutes later, and that the transcript rather than recall is what settles it."
    - "Consider ADDING a provenance predicate to docs-core-value-decision.test.ts — its silence on provenance is the propagation mechanism, though it needs no change for correctness."
    - "Fix the stale \"5 tests\"/\"5/5\" counts in REQUIREMENTS.md, ROADMAP.md:532, STATE.md:81 and 17-03-SUMMARY.md:80 (the guard has had 6 tests since ab9a28a)."
    - "Do NOT flip CORE-01 to unmet: must_have truth 3 is literally unmet (delegated, not selected), but that was already disclosed and the human passed it at UAT Q2. Report as intent-satisfied with a disclosed deviation."
  debug_session: ".planning/debug/core-01-provenance-overstates-human-involvement.md"
  diagnosis_note: |
    Severity recommendation from diagnosis: DOWNGRADE from `major`. The
    `severity_note` above argued for possible escalation to `blocker` on the
    premise that the gate might never have happened; that premise is now
    disproven by transcript. What remains is an overstatement-of-comprehension
    defect spread across 9 passages, plus four stale test counts.
