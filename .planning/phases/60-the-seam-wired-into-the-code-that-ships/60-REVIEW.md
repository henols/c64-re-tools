---
phase: 60-the-seam-wired-into-the-code-that-ships
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/mcp/vice/tool-location.mts
  - src/mcp/vice/tool-location.test.ts
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/resources/tool-location.mjs
  - docs/phase58-declaration-provenance.md
  - docs/phase59-tool-location-placement.md
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 60: Code Review Report (incremental re-review, round 2)

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 6
**Status:** clean

## Summary

This is a second incremental re-review of Phase 60, scoped to what plan 60-08 changed
since the prior round's commit `e002897a`. Plan 60-08 was dispatched specifically to
close the prior review's WR-03 (the environment layer's terminal refusal falsely
claiming a `$PATH`-substitution risk for a `directory`-kind id) and to correct a
same-phase regression plan 60-06 had left in place (a separator-containing,
unresolvable declared-variable value silently falling through to the declared-id
`$PATH` probe, which plan 60-01 had made reachable and which pre-phase-60 code never
exhibited).

Every claim in the incoming context was independently verified against the actual
diff and the actual running tests, not assumed:

- **`envUnresolved = true` moved out of the separator-gated branch.** Confirmed at
  `tool-location.mts:677-695`. Before this plan, the assignment sat inside `if
  (!envValue.includes("/")) { ... }`, so a value containing a `/` never registered as
  unresolved and fell through silently to Layer 3's declared-id `$PATH` probe — the
  regression `60-VERIFICATION.md` traced to plan 60-01, not to pre-phase behaviour.
  The assignment is now unconditional for any declared variable's non-empty value,
  whatever its shape, while the narrower `!envValue.includes("/") && record.kind ===
  "executable"` test still gates the `$PATH` *walk* alone — two genuinely distinct
  expressions, confirmed by reading both, not merely by the header comment's own
  claim to that effect.
- **`buildEnvLayerRefusal()` branches its trailing clause on `record.kind`.** Confirmed
  at `tool-location.mts:711-723`: an `executable`-kind record keeps the
  `$PATH`-shadowing sentence byte-for-byte; a `directory`-kind record gets a
  kind-appropriate sentence ("resolution is terminal for ...; tools.json was
  consulted and had nothing to say ... either") that asserts no mechanism the seam
  does not actually have. This message is reached only after Layer 2 (`tools.json`)
  has already returned or fallen through, so the claim "tools.json ... had nothing to
  say" is accurate at every call site that reaches it — traced by hand, not assumed.
  This directly closes WR-03 as filed: the two negative-assertion tests
  ("Plan 60-06 Test G", "Plan 60-08 Test 8") and the one positive control ("Plan
  60-08 Test 7") that pin this are present and pass.
- **The two shipped tests rewritten in place both retain their stated surviving
  intents.** `vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4" still proves the two
  original properties (two `resolveTool()` calls in one process agree on
  path/layer/mechanism; the environment candidate is tried before any `$PATH`
  candidate — now vacuously true, since no declared-id `$PATH` candidate exists once
  the variable is left unresolved) while its assertions on the *outcome* are
  reversed to match the corrected contract (refuses, rather than silently resolving
  through the probe). `tool-location.test.ts`'s separator-containing case was
  rewritten the same way, with a companion clean-positive-control case (Test 4)
  proving a resolving separator-containing value still wins outright — so the
  rewrite narrows the assertion correctly rather than merely weakening it.
- **`resources/tool-location.mjs` is in sync with its source.** Read side by side
  with `tool-location.mts`; every changed expression (the moved `envUnresolved`
  assignment, the kind-branched `buildEnvLayerRefusal()`) is present in the compiled
  artifact in the same shape, and the compiled-artifact tests (`tool-location.test.ts`'s
  "Plan 60-08 Test 12", `vice-broker-acquire.test.ts`'s dynamic-import-driven cases)
  exercise it directly, not only the unbuilt source.
- **The two doc files' four-line diffs are citation-line-number churn only**, caused
  by the header comment growing in `tool-location.mts` and shifting
  `resolveOnPath()`'s own line range. Confirmed via `git diff`: no prose changed, and
  `phase58-citation-ledger.test.ts` (11 cases) passes against both documents'
  regenerated line numbers.

All 86 cases in `tool-location.test.ts`, all 35 in `vice-broker-acquire.test.ts`, and
all 11 in `phase58-citation-ledger.test.ts` were run directly (no live broker or
`x64sc` process was running beforehand) and pass. No new defect was introduced by
this plan's diff. One Info item is carried forward from the prior round, downgraded
from "hiding a wrong message" to "an existing stylistic inconsistency with no live
consequence," now that the message it was hiding is fixed.

**Prior findings, disposition after this round:**

- **CR-01, WR-01, WR-02** (from the first-round review, commit `546782a2`): unaffected
  by this round's diff. Not re-verified against source in this pass since none of the
  files this round touches (`tool-location.mts`, its tests, `vice-broker-acquire.test.ts`,
  the compiled artifact, the two docs) overlap the modules those findings were about
  (`host-tool.mts`'s `findSiblingBinary()`). Their prior disposition (both closed, per
  the second-round review) stands un-relitigated here; this round's scope is narrower
  than a full re-audit.
- **WR-03** ("the environment layer's terminal refusal message falsely claims a
  `$PATH`-substitution risk for a `directory`-kind id") — **CLOSED, independently
  confirmed.** `buildEnvLayerRefusal()` now composes a kind-appropriate sentence, the
  false claim is gone for both `ghidra` (`GHIDRA_HOME`) and `acme-lib` (`ACME`), and
  the fix is proven by a positive control (an executable-kind refusal still carries
  the clause) as well as two negative assertions (a directory-kind refusal does not).
- **IN-02** ("`findAcmeLib()` silently discards the seam's `refusal` for `acme-lib`,
  unlike every other seam consumer in this file") — **disposition unchanged, and now
  moot as a hazard.** `host-tool.mts` is untouched by this round's diff (confirmed:
  it does not appear in `git diff --stat` against the prior round's commit), so
  `findAcmeLib()` still discards `seamResolved.refusal` exactly as before. The prior
  review's own conditional guidance — "if WR-03 is fixed by correcting the message
  text, no change is required here" — is now satisfied: WR-03 was fixed by option
  (a), not by routing `findAcmeLib()` to surface `refusal`, so the inconsistency
  `IN-02` named is real but no longer masks a wrong message. Restated below as an
  Info item purely for completeness, not as a live defect.

## Info

### IN-02 (carried forward, disposition updated): `findAcmeLib()` still discards the seam's `refusal` for `acme-lib`, unlike every other seam consumer in this file

**File:** `src/mcp/vice/host-tool.mts:2444-2452` (unchanged by this round's diff).

**Issue:** Every other `resolveTool()` call site in this file branches on `.refusal`
and surfaces it verbatim before falling back to a generic not-found sentence.
`findAcmeLib()` remains the one exception, per its own pre-existing comment ("folded
into 'not found' here rather than surfaced separately"). This was previously
significant because it was silently discarding a *wrong* message (WR-03); now that
WR-03 is fixed, discarding the (now-correct) refusal is a plain, pre-existing
stylistic inconsistency with the rest of the file — defensible UX (falling through to
the fixed-prefix probe on any seam failure), not a functional defect.

**Fix:** None required. If `findAcmeLib()` is ever changed to surface `refusal` the
way `ghidra.analyze` already does, the message it would surface is now correct, so
there is no remaining reason to sequence that change after anything else.

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
