---
phase: 09-the-assumption-probe-go-no-go
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - .planning/phases/09-the-assumption-probe-go-no-go/evidence/grammar-check.mjs
  - .planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs
  - .planning/phases/09-the-assumption-probe-go-no-go/evidence/vice-tool-harness.mjs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-08-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three throwaway evidence harnesses against the standard the scope rationale sets:
do they measure what the transcripts claim they measured, and could any defect turn a false pass
into a recorded pass?

`grammar-check.mjs` was checked line-by-line against the real consumer it claims to mirror
(`stock-symbols.ts:75` `VICE_LABEL_LINE_RE` and `parseViceLabelFile` at `stock-symbols.ts:196-226`).
The regex is byte-identical, the split-on-`"\n"`/trim/blank-line semantics match exactly, and the
match/no-match decision path is identical. No divergence was found that would let this harness
report a match the real consumer would refuse, or vice versa — `GRAMMAR_MATCH: 2/2` is trustworthy
evidence for `stock-symbols.ts`'s actual behavior. The only differences (separate `blankCount`
vs. `unmatchedCount` counters, no duplicate-name tracking, no line-count ceiling) are reporting-only
and do not touch the pass/fail signal this criterion depends on.

`mcp-harness.mjs` and `vice-tool-harness.mjs` are sound as MCP clients (argv-driven arguments,
never shell-interpolated; every call wrapped in try/catch so a refusal is captured rather than
thrown away). The issues found are not in whether they exercised the real dispatch path — they
did — but in cleanup and dead-code defects that are relevant to this project's own domain: a
harness that can leave an orphaned spawned process or hang past actual completion is exactly the
kind of thing this project's wedge-triage/broker-hang concerns exist to catch, even in a
throwaway script.

## Warnings

### WR-01: `withTimeout()`'s losing timer is never cleared, in both harnesses

**File:** `.planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs:18-25`
**File:** `.planning/phases/09-the-assumption-probe-go-no-go/evidence/vice-tool-harness.mjs:28-33`
**Issue:** `withTimeout()` races the real promise against a `setTimeout`-backed rejection but never
calls `clearTimeout` on the loser. When the real operation settles first (the common case), the
`setTimeout` callback is still scheduled and keeps the Node event loop alive until it fires —
up to `TIMEOUT_MS` (30s) later in `mcp-harness.mjs`, and up to `HARD_TIMEOUT_MS` (180s) later per
call in `vice-tool-harness.mjs`, compounding across every `connect`/`listTools`/`callTool` in a
multi-call invocation. A script whose actual work finished in seconds can appear to hang for
minutes — the exact ambiguity ("is this a wedge or just running?") this project's own
`vice-wedge-triage` skill and CLAUDE.md constraints exist to avoid, now self-inflicted by the
evidence tooling itself.
**Fix:**
```js
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

### WR-02: connect/initialize timeout leaves the spawned `vice-proxy.ts` child process orphaned

**File:** `.planning/phases/09-the-assumption-probe-go-no-go/evidence/vice-tool-harness.mjs:74-82`
**Issue:** `StdioClientTransport` spawns `node <mainRepoRoot>/.claude/mcp/vice/vice-proxy.ts` as a
child process at `connect()` time. If `client.connect(transport)` times out (or otherwise throws),
the `catch` block logs `CONNECT_INITIALIZE_FAILED` and returns immediately — the only
`client.close()` call in the file is at the very end of `main()` (line 105), reached only via the
normal completion path. On a slow or hung `vice-proxy.ts` startup, this leaves an unmanaged
`node vice-proxy.ts` process running in the background (which can itself acquire/launch a broker
and emulator instance), exactly the class of orphaned-process problem this same evidence session's
transcripts had to manually clean up (`criterion3-export-lbl.txt`'s teardown sections killing
orphaned broker/x64sc processes). Every other error path in the file (the per-call `catch` inside
the loop) correctly falls through to the final `client.close()`; only this one early-return path
skips it.
**Fix:**
```js
try {
  await withTimeout(client.connect(transport), HARD_TIMEOUT_MS, "connect+initialize");
  console.log("CONNECT_INITIALIZE: ok");
} catch (err) {
  console.log("CONNECT_INITIALIZE_FAILED:");
  console.log(JSON.stringify({ message: err?.message, stack: err?.stack, cause: err?.cause }, null, 2));
  try {
    await client.close();
  } catch {
    // best-effort cleanup of the spawned vice-proxy.ts process
  }
  process.exitCode = 1;
  return;
}
```

## Info

### IN-01: `overallResult` is built but never read, logged, or returned

**File:** `.planning/phases/09-the-assumption-probe-go-no-go/evidence/vice-tool-harness.mjs:72,95,100`
**Issue:** `overallResult.calls` accumulates `{ name, arguments, result }` or `{ name, arguments,
error }` for every call in the sequence, but the object is never printed, written, or returned
anywhere after the loop. Each call's result/error is already `console.log`'d individually inside
the loop, so no data is lost, but the accumulator is dead code that could mislead a future reader
into assuming a structured end-of-run summary exists (e.g. for a script consuming this harness's
stdout programmatically) when it does not.
**Fix:** Either log it once at the end (`console.log("OVERALL_RESULT:", JSON.stringify(overallResult, null, 2));`) or delete the accumulator entirely if per-call logging is sufficient.

### IN-02: unbalanced `<toolName> <argsJson>` pairs silently default to `"{}"` instead of failing

**File:** `.planning/phases/09-the-assumption-probe-go-no-go/evidence/vice-tool-harness.mjs:44-56`
**Issue:** The pairing loop (`for (let i = 3; i < process.argv.length; i += 2)`) reads
`argsJson = process.argv[i + 1] ?? "{}"`. If the invocation has an odd number of trailing
arguments (a missing final `argsJson`, e.g. a copy/paste mistake when adding one more tool call),
the last call silently runs with `{}` rather than the script refusing to start. The transcript
would still show the actual `{}` used (self-revealing), so this is low-impact, but a stricter
harness would fail loudly on a malformed invocation rather than silently substituting a default.
**Fix:**
```js
if ((process.argv.length - 3) % 2 !== 0) {
  console.error("Unbalanced tool/args pairs: every toolName needs a matching argsJson");
  process.exitCode = 1;
  return;
}
```

### IN-03: no transport/client cleanup on `CONNECT_FAILED` in `mcp-harness.mjs`

**File:** `.planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs:42-49`
**Issue:** Same shape as WR-02 but lower impact: this harness uses
`StreamableHTTPClientTransport` (no child process spawned), so a failed `connect()` leaves at most
an abandoned HTTP session rather than an orphaned OS process. Still, `client.close()`/
`transport.close()` is never attempted on this path, unlike the file's own stated care elsewhere
about capturing full error context.
**Fix:** Wrap the early return with a best-effort `try { await client.close(); } catch {}` as in WR-02's fix, for consistency.

---

_Reviewed: 2026-08-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
