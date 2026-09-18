---
phase: 60-the-seam-wired-into-the-code-that-ships
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - docs/phase58-declaration-provenance.md
  - docs/phase59-tool-location-placement.md
  - src/mcp/vice/backend-detect.mts
  - src/mcp/vice/backend-detect.test.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/resources/backend-detect.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/resources/tool-location.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/tool-location.mts
  - src/mcp/vice/tool-location.test.ts
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/vice-broker.mts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 60: Code Review Report (incremental re-review)

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This is an incremental re-review of Phase 60 scoped to what changed between
the first review's commit (`546782a2`) and HEAD -- plans 60-06 and 60-07,
which were dispatched specifically to close the first review's CR-01 and
WR-01 findings and to record WR-02 as a deliberate, open decision.

**Prior findings, disposition:**

- **CR-01** ("a bare, `$PATH`-relying `VICE_BIN`/`ACME_BIN` override is
  silently dropped, and can silently resolve to a different binary") --
  **CLOSED.** `tool-location.mts`'s environment layer now widens a
  slash-free candidate onto `$PATH` for its own literal value first
  (`resolveOnPath(envValue, env)`, never the declared id), and refuses by
  name, before the declared-id `$PATH` probe, when nothing answers. The
  closure is proven end to end: `vice-broker-acquire.test.ts`'s Plan 60-06
  Test 2 drives a decoy binary literally named `x64sc` on the injected
  `PATH` and asserts the real spawn call's first argument is the
  developer's own unresolved string, never the decoy's path. Verified
  directly against the compiled artifact (`resources/tool-location.mjs`
  carries the same widened logic byte-for-byte with the source). The
  closure's own residual scope (a separator-*containing* value that
  resolves to nothing keeps the old silent-fallthrough posture, by design,
  to hold `vice-broker-acquire.test.ts`'s pre-existing "Plan 60-01 Test 4"
  green) is exactly the narrow, documented limit this review's own context
  names as deliberate and graded -- not re-reported here as a defect.
- **WR-01** ("`findSiblingBinary()` discards the seam's specific `tools.json`
  refusal reason for c1541/petcat, reporting a generic 'does not exist'") --
  **CLOSED.** `findSiblingBinary()`'s return shape now carries an explicit
  `refusal: string | null` field, both `c1541.*` and `petcat.decode` branch
  on it before the generic not-found sentence, and a refusal is quoted
  verbatim with **no** remedy appended -- mirroring the ACME branch's own
  precedent. Six new tests (`host-tool.test.ts`, "Plan 60-07 Test 1"
  through "Test 6") exercise the absent-on-disk case, the missing-executable-
  bit case, the genuine not-found case (remedy still present), the
  no-remedy-on-refusal case for both tools, and the memo replaying a
  refusal verbatim on a second call. Verified against the compiled artifact.
- **WR-02** ("`findSiblingBinary()`'s memo contradicts the seam's own
  no-memo rationale") -- **recorded as an open, deliberately unresolved
  decision**, as intended. `siblingBinaryMemo`'s own header now states the
  tension explicitly, names why no reset hatch was added, and names the
  trigger for revisiting it (the sibling-probe mechanism moving inside the
  seam itself). That is an adequate record of a real, live tension, not an
  oversight -- no further finding raised here.
- **IN-01** ("`resolvedBackend()`'s reported `viceBin` is always the
  literal `"x64sc"`") -- **superseded/closed** as a side effect of the
  same plan: the PD-01 branch's display name now falls back to the seam's
  own `envCandidate` (the value the developer actually wrote) before
  falling back to the literal `"x64sc"`, and the 60-06 diff's own comment
  explicitly retires this note.

One new, genuine defect was found in the gap-closure code itself (below),
plus one point recorded as Info for completeness. Both are inside the
`tool-location.mts`/`resources/tool-location.mjs` diff introduced by plan
60-06, not restatements of anything the prior review already raised.

## Warnings

### WR-03: The environment layer's terminal refusal message falsely claims a `$PATH`-substitution risk for a `directory`-kind id, which structurally cannot occur for that kind

**File:** `src/mcp/vice/tool-location.mts:665-674` (`envUnresolved` set
unconditionally) and `:685-692` (`buildEnvLayerRefusal()`'s message text),
surfaced verbatim at `src/mcp/vice/host-tool.mts:1471-1483`
(`ghidra.analyze`'s refusal). Present identically in the compiled artifact,
`src/mcp/vice/resources/tool-location.mjs:481-497`.

**Issue:** The widened environment layer's step 2 (the `$PATH` walk of the
raw env value) is correctly gated to `record.kind === "executable"` only --
`tool-location.mts`'s own header and Layer 3's own comment both say a
`$PATH` search for a directory-kind id is "meaningless" (D-15), and the
code enforces this (`if (record.kind === "executable") { ... }`). But the
`envUnresolved = true` assignment that follows sits **outside** that
kind-gated block, so it fires for a `directory`-kind record's bare,
unresolved env value exactly as it does for an `executable`-kind one. Two
of the eight declared ids are `directory`-kind with a declared `envVar`:
`ghidra` (`GHIDRA_HOME`) and `acme-lib` (`ACME`).

The consequence is not that resolution behaves differently (a directory-kind
id was always going to end up `path: null` either way -- Layer 3 never runs
for it) but that the **refusal message composed for it is factually wrong**:

```
$ node --experimental-strip-types -e '...'
"ghidra"'s GHIDRA_HOME environment variable is set to "ghidra-bare-name",
which did not resolve to a directory carrying its required marker
(support/analyzeHeadless) (tried: ghidra-bare-name); the seam will not
fall back to searching $PATH for "ghidra" itself, because that could
start a different binary than the one GHIDRA_HOME named
```

The seam never had a `$PATH` fallback to decline for `ghidra` in the first
place -- Layer 3 is gated to `executable`-kind ids only, so there was no
substitution risk this refusal is protecting against for a directory. This
is not merely cosmetic: this project's own convention treats a `reason`/
`refusal` field as "prose a caller shows a user directly... not a code
meant to be mapped later" (CLAUDE.md, Errors), and this specific sentence
is reached at a real, live call site -- `host-tool.mts:1472-1483`'s
`ghidra.analyze` branch quotes `ghidraResolved.refusal` verbatim into the
MCP tool's own error response. A user debugging a bad `GHIDRA_HOME` reads a
claim about a `$PATH`-search mechanism that never existed for their case,
which will send them looking for a nonexistent risk instead of the real
one (their `GHIDRA_HOME` value simply is not a directory carrying the
required marker).

For `acme-lib` the same wrong refusal is computed inside `resolveTool()`
but is currently invisible to a user: `findAcmeLib()`
(`host-tool.mts:2451-2452`) discards `seamResolved.refusal` entirely and
falls through to its own fixed-prefix probe regardless of what the seam
says (by design, and unrelated to this defect) -- so the wrong message is
wasted work today, not a live user-facing bug, but it is one edit away
(making `findAcmeLib()` surface `refusal` the way `ghidra.analyze` already
does, which is the natural next step given the ACME *binary* branch's own
precedent two hundred lines above it) from becoming one.

This is baked into plan 60-06's own design text, not only a coding slip --
the plan's own refusal-message prose (`60-06-PLAN.md:251-252`) states the
sentence generically ("say plainly that the seam will not fall back to
searching `$PATH` for the tool id") without carving out the directory-kind
case, and the shipped test that proves a directory-kind bare value refuses
(`tool-location.test.ts`'s "Plan 60-06 Test G") only asserts the message
`.includes("GHIDRA_HOME")` and `.includes("ghidra-bare-name")` -- it never
asserts on (and so never caught) the specific, kind-inapplicable
justification clause.

**Fix:** Either (a) compose two different `wants`-shaped refusal sentences
in `buildEnvLayerRefusal()` -- the `$PATH`-substitution clause only for
`record.kind === "executable"`, and a plainer "did not resolve to a
directory carrying its required marker" sentence with no `$PATH` clause at
all for `record.kind === "directory"` -- or (b) if a terminal refusal is
still wanted for a directory-kind bare value (as `60-06-PLAN.md`'s own Test
G requires), keep the refusal but simplify its justification to something
true for every kind ("no value matching what this variable requires was
found; tools.json was also not consulted for a different candidate" or
similar), dropping the `$PATH`-specific clause for a `directory`-kind
record. Add an assertion to "Plan 60-06 Test G" that the message does
**not** contain the substitution-risk clause, so the fix stays pinned.

## Info

### IN-02: `findAcmeLib()` silently discards the seam's `refusal` for `acme-lib`, unlike every other seam consumer in this file

**File:** `src/mcp/vice/host-tool.mts:2444-2452`.

**Issue:** Every other `resolveTool()` call site touched by this phase
(`acme.build`'s `acmeResolved`, `ghidra.analyze`'s `ghidraResolved` at two
call sites, and, as of plan 60-07's WR-01 fix, `findSiblingBinary()`'s
`c1541`/`petcat` callers) branches on `.refusal` and surfaces it verbatim
before falling to a generic not-found sentence. `findAcmeLib()` is the one
remaining seam consumer that does not: its own comment says a refusal is
"folded into 'not found' here rather than surfaced separately," which
predates this phase and is not itself new. Noted only because this phase
made every *sibling* consumer of the exact same pattern consistent with
the ACME-binary branch's own precedent, leaving `findAcmeLib()` as the one
remaining inconsistency in the same file -- and because WR-03 above means
that inconsistency is currently *hiding* a wrong refusal message rather
than merely dropping a right one. Not a functional defect on its own
(falling through to the fixed-prefix probe on any seam failure, refusal or
not, is defensible UX), but worth fixing in the same pass as WR-03 so the
two changes do not have to be reconciled twice.

**Fix:** If WR-03 is fixed by correcting the message text, no change is
required here. If `findAcmeLib()` is ever changed to surface `refusal` the
way `ghidra.analyze` already does, do so only after WR-03 is fixed, not
before.

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
