# Phase 29 — deferred items

Out-of-scope discoveries logged rather than fixed, per `execute-plan.md`'s scope
boundary. Nothing here was introduced by this phase's changes.

## 1. `STORE-03`'s traceability status contradicts its own prose (Phase 28, pre-existing)

Found by plan 29-11 while cross-checking `.planning/REQUIREMENTS.md`'s
traceability table against `ROADMAP.md`'s per-phase `**Requirements**:` lines.

- The table row reads `| STORE-03 | Phase 28 | Complete |`.
- The paragraph three screens below it — the round-6 verifier's own authorising
  sentences — reads *"`STORE-03` STAYS `Gaps Found`, and its blocker is now
  `CR-10` rather than `CR-09`"*, and quotes the verifier: *"The third does not:
  the partial-overwrite behaviour for the four split members is pinned to an
  outcome that discards every recorded target."*

One of the two is wrong. Plan 29-11 did **not** change it: the row predates this
phase, belongs to Phase 28, and per prohibition 28-18 P2 a row moves only on a
verification verdict — which is exactly the rule that would be broken by an
executor of a different phase editing it on its own reading. Route it to a Phase
28 verification pass or a milestone audit.

*Logged 2026-08-30 by plan 29-11.*
