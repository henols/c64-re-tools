---
phase: 40-the-three-preprocessing-host-tools
reviewed: 2026-09-08T18:29:25Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/ghidra-project.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-supervision.test.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/ghidra-live.test.ts
  - src/mcp/vice/repo-root.ts
  - src/mcp/vice/repo-root.test.ts
  - src/mcp/vice/resources/ghidra-project.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - .gitignore
  - CLAUDE.md
  - docs/phase34-host-tool-seam-decisions.md
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 40 (gap closure, `G-40-1`): Code Review Report

**Reviewed:** 2026-09-08T18:29:25Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

**This report SUPERSEDES the earlier 40-REVIEW.md for source scope.** The
previous review covered the wider phase-40 pass (52 files, plans 40-01
through 40-07); that pass is closed and its findings were dispositioned in
`40-REVIEW-FIX.md`, which this report does not re-derive, re-open, or
retract. This report covers **only** the 15-file gap-closure surface
computed as `git diff --name-only f2b01477..HEAD` (planning artifacts
excluded) for gap `G-40-1` / requirement `PREP-05`, delivered by plans
40-08 through 40-11.

## Summary

This gap-closure change moves the Ghidra per-run project root from
`<repoRoot>/tools/ghidra-runs/<runId>` (outside the project's single
tool-written root) to `<repoRoot>/.c64-re-tools/runs/ghidra/<runId>`,
reached through a broker-minted, non-dotted alias symlink at
`<repoRoot>/c64-re-tools` (relative target `.c64-re-tools`). The change is
motivated by a specific, cited measurement
(`.planning/notes/ghidra-dot-path-check-semantics.md`) that Ghidra's
project-location refusal binds `getAbsolutePath()`, never
`getCanonicalPath()`, and therefore never resolves a symlink.

This is an unusually well-verified change. I traced the full mechanism
(`ensureGhidraRunsHandle()`, `resolveGhidraProject()`,
`buildAnalyzeHeadlessArgv()`, the broker's startup mint at `vice-broker.mts`,
and every consuming call site in `host-tool.mts`) against the four review
priorities named in scope, and additionally:

- Ran the full colocated unit suites for all five touched modules
  (`ghidra-project.test.ts` — 53/53 pass; `vice-broker-supervision.test.ts` —
  5/5 pass, including the two new R2 ordering/structural gates;
  `repo-root.test.ts` — 9/9 pass, including the new NUL-tolerant census
  gate; `host-tool.test.ts` — 104/104 pass, including the four new
  handle-only-invariant gates).
- Rebuilt `resources/*.mjs` from source (`node build.ts`) and confirmed
  **zero drift** against the committed artifacts (`git status --short
  resources/` clean after rebuild) — the three touched artifacts
  (`ghidra-project.mjs`, `host-tool.mjs`, `vice-broker.mjs`) are byte-true
  to their `.mts` sources.
- Live-tested the `.gitignore` symlink-vs-trailing-slash claim in a
  throwaway repo: confirmed `/c64-re-tools` (no trailing slash) ignores the
  symlink and `/c64-re-tools/` does not — the comment's own empirical claim
  is correct.
- Ran the **opt-in, default-skipped** `ghidra-live.test.ts` suite live
  against real Ghidra 12.1.3 (`GHIDRA_HOME` pointed at a genuine local
  install): **22/22 non-corpus tests pass**, including both new SYMLINK
  GUARD cases (positive: production route lands the project database
  physically under `.c64-re-tools/`, with only the handle symlink in the
  non-dotted tree; negative control: a literal dot-prefixed location
  produces no project database at all, proving the guard is non-vacuous).
  This directly confirms the core claim the whole change rests on, against
  the real external tool, not merely against this project's own predicate.
- Confirmed the `HOST_TOOL_PATH_ARG_KEYS['ghidra.analyze']` "handle-only
  invariant" holds by direct source inspection: `resolveGhidraProject()` is
  called directly in `host-tool.mts` (never routed through
  `resolveWorkspacePath()`), and the project location has exactly one
  derived sibling path (`dirname(projectLocation)` for the run log) — both
  match the structural test's own claims.
- Confirmed the ordering requirement (R2): `ensureGhidraRunsHandle()` is
  called in `vice-broker.mts`'s `run()` after the unconditional startup
  reap and before `startControlListener()` binds, matching both the
  structural test and direct source reading.

One genuine defect surfaced from tracing the error surface of
`ensureGhidraRunsHandle()` specifically, per this review's stated priority
1 — see WR-01 below. It is a narrow race, not a design flaw in the overall
approach, and does not undermine the mechanism itself (confirmed live and
by the exhaustive unit suite above). No BLOCKER findings.

## Warnings

### WR-01: `ensureGhidraRunsHandle()` can throw despite its own "Never throws" contract, on a narrow TOCTOU between its verification `lstatSync()` and the immediately-following `readlinkSync()`

**File:** `src/mcp/vice/ghidra-project.mts:249` (contract stated at line 157;
mirrored, byte-true, in `src/mcp/vice/resources/ghidra-project.mjs:244`)

**Issue:** The function's own doc comment states plainly: *"Mints (or
verifies) the broker-owned symlink HANDLE ... **Never throws**; idempotent"*
(line 157), and its own numbered "VERIFY unconditionally" step states
*"`lstatSync()` must report a symbolic link, and `readlinkSync()` must equal
`GHIDRA_RUNS_HANDLE_TARGET` by EXACT string comparison. **Anything else
refuses.**"* (i.e. the documented contract is: any anomaly here — including
a read failure — becomes an `ok: false` refusal, never an exception).

The implementation does not honor this for `readlinkSync()`. In the
verification block:

```ts
// VERIFY unconditionally -- never trust the write above, whichever branch
// took it.
let stat: ReturnType<typeof lstatSync>;
try {
  stat = lstatSync(handlePath);
} catch (e) {
  return { ok: false, message: `...` };
}

if (!stat.isSymbolicLink()) {
  ... return { ok: false, ... };
}

const target = readlinkSync(handlePath);   // <-- NOT wrapped in try/catch
if (target !== GHIDRA_RUNS_HANDLE_TARGET) {
  ... return { ok: false, ... };
}

return { ok: true, handle: handlePath, target };
```

The preceding `lstatSync()` call *is* wrapped in try/catch (as is the
identical-shaped first `lstatSync()` earlier in the function, used to
decide `handleAlreadyExists`), so the omission on `readlinkSync()` is an
inconsistency within the same function rather than a stylistic choice.

If the handle is deleted, replaced, or otherwise made unreadable in the
narrow window between the successful `lstatSync()` (which proved it is
currently a symbolic link) and the `readlinkSync()` call a few lines later,
`readlinkSync()` throws (e.g. `ENOENT`), and that exception is **not**
caught anywhere in `ensureGhidraRunsHandle()` — it propagates to the
caller as an uncaught exception, not a `{ ok: false, message }` result.

This matters concretely for the broker's own call site
(`src/mcp/vice/vice-broker.mts`'s `run()`, added by this same gap-closure
plan 40-09):

```ts
const ghidraHandleResult = ensureGhidraRunsHandle(args.repoRoot);
if (ghidraHandleResult.ok) { ... } else { ... }
```

This call sits with **no try/catch around it**, by explicit design — the
adjacent comment states: *"Handled WITHOUT throwing: run() has no try/catch
around this region and the broker must start regardless of the outcome
here -- it serves twelve allowlisted tool ids and only one of them
(ghidra.analyze) needs this handle."* If `ensureGhidraRunsHandle()` throws
here, the exception propagates out of the `async function run()`, is
caught only by `main()`'s outer `run(args).catch((e) => { ...
process.exitCode = 1; })`, and the **entire broker fails to start** —
`startControlListener()` is never reached, so all twelve allowlisted tool
ids become unreachable, not merely `ghidra.analyze`. This is the exact
opposite of R2's stated and tested intent ("the broker must start
regardless of the outcome here").

The trigger is a genuine, if narrow, race: the function's own docstring
explicitly anticipates concurrent callers racing on this exact path (*"two
host-side callers (the broker at startup, a concurrent brokerless spawn)
can race here"*), and its own refusal message invites a human to intervene
concurrently (*"Remove it by hand if it is safe to do so, then retry"*) —
either of those, timed to land between the verification `lstatSync()` and
`readlinkSync()`, reproduces this.

The consequence is less severe on the other production call site
(`resolveGhidraProject()` → `host-tool.mts`'s `runHostTool()`, invoked as an
`async function`): a synchronous throw inside an `async` function becomes a
rejected promise automatically, and `broker-control.mts`'s dispatch does
`.catch()` that rejection into a generic `{ kind: "error", code:
"internal", message: "host_tool threw" }` response — so only the single
`ghidra.analyze` request fails (with its real message discarded in favor of
the generic text), not the whole broker. The broker-startup call site is
the one with the severe, contract-violating consequence.

**Fix:** Wrap the `readlinkSync()` call the same way the two `lstatSync()`
calls in this function already are, refusing by name rather than throwing:

```ts
let target: string;
try {
  target = readlinkSync(handlePath);
} catch (e) {
  return {
    ok: false,
    message: `ensureGhidraRunsHandle: failed to read the handle's link target (${handlePath}) after confirming it is a symbolic link -- a concurrent change won a race with this verification: ${e instanceof Error ? e.message : String(e)}`,
  };
}
if (target !== GHIDRA_RUNS_HANDLE_TARGET) {
  ...
}
```

## Info

### IN-01: The two-part `.gitignore` stanza's rationale is now split across two comments with a subtle historical claim worth double-checking on the next touch

**File:** `.gitignore:1-33` (the `/.c64-re-tools/` and `/c64-re-tools`
stanzas)

**Issue:** Not a defect — the split ignore-stanza design is correct and its
central claim (no trailing slash on a symlink-to-directory pattern) was
independently verified live in this review (see Summary). This is a
forward-looking note only: the comment states *"tools/ itself is now
vestigial -- `git ls-files tools/` is empty, and ghidra.analyze's old
`tools/ghidra-runs/` location (this stanza's predecessor) was its last
production writer (D-33)."* This is presented as a settled, checked fact
(and it is, at review time — `git ls-files tools/` is indeed empty in this
tree). Because it's phrased as a factual claim about the *current* tree
rather than a structural invariant a test enforces, a future writer adding
a file under `tools/` would make this specific sentence quietly false again
with nothing to catch it (unlike the `.c64-re-tools` literal census, which
gained a mechanical gate in this same phase). Given the census-gate pattern
this same gap-closure round just established for exactly this class of
claim (`repo-root.test.ts`'s new gate, and its own stated motivation, "T-40-10-02"),
this is a plausible next candidate for the same treatment, not an issue to
fix now.

**Fix:** No action required for this phase. If `tools/` regains a
production writer in a later phase, either drop the "vestigial" claim or
add an equivalent mechanical check.

---

_Reviewed: 2026-09-08T18:29:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
