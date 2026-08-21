---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
reviewed: 2026-08-21T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - .claude/mcp/vice/r2000-mcp-client.ts
  - .claude/mcp/vice/r2000-tools.ts
  - .claude/mcp/vice/r2000-symbols.ts
  - .claude/mcp/vice/r2000-confidence.ts
  - .claude/mcp/vice/r2000-memmap-render.ts
  - .claude/mcp/vice/r2000-enum-gen.ts
  - .claude/mcp/vice/r2000-regbits-gen.ts
  - .claude/mcp/vice/r2000-test-gate.ts
  - .claude/mcp/vice/r2000-cli.ts
  - .claude/mcp/vice/r2000-d64.ts
  - .claude/mcp/vice/r2000-launch.ts
  - .claude/mcp/vice/r2000-verify.ts
  - .claude/mcp/vice/stock-symbols.ts
  - .claude/mcp/vice/vice-proxy.ts
  - .claude/mcp/vice/package.json
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/generate-tool-support-table.mjs
  - .claude/mcp/vice/r2000-tools.test.ts
  - .claude/mcp/vice/r2000-mcp-client.test.ts
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-21
**Depth:** standard
**Files Reviewed:** 21 (of 44 changed; the remainder are docs/skills/planning prose and
test-only files consulted for corroboration, not separately findings-bearing)
**Status:** issues_found

## Summary

This phase adds the `r2000_*` static-analysis tool surface (new MCP-client, curated
tool gate, symbol round trip, confidence-grade vocabulary, enum generation, memory-map
renderer) and closes several residual Phase 10 findings. The architecture-level
invariants hold up under direct inspection: `r2000_*` tools are registered via
`buildViceTool()` directly (`vice-proxy.ts`), never through `forwardToVice()`/`call()`,
so Rule A3 ("derived tools intercept before host-path rewriting") is satisfied by
construction rather than by an interception that could be forgotten. The single-seam
rules also hold: `r2000-mcp-client.ts` is the only spawner of `--mcp-server-stdio`,
`r2000-launch.ts` the only spawner of the other verbs, `r2000-tools.ts` the only
allow-list gate, and no module imports `hostpath.ts`/`containerpath.ts`. The WR-02/
WR-03/WR-04/WR-05/WR-06/WR-07 fixes from prior residual findings are implemented as
described and are non-vacuously guarded.

No Critical/Blocker-level defect was found: nothing here is silently trusting a lying
exit code, nothing bypasses the curated allow-list, and no path traversal succeeds
against an already-existing target. The findings below are Warnings and Info items —
mostly narrow, second-order gaps in defensive code that is otherwise unusually careful,
plus one genuine Markdown-generation correctness bug and one dead-code item.

Per the task's request to re-assess (not re-report) T-11-NAME-INJECT's blast radius:
finding WR-04 below (unescaped label/comment text in generated Markdown table cells)
is a previously-unrecorded consequence of that same unvalidated-label-name gap — a
discovered or user-set label name containing `|` or a newline reaches
`render-memmap`'s output, not only `--export_asm`'s ACME source as the existing
residual note describes. The blast radius is therefore wider than what 11-08-SUMMARY.md
recorded: both the symbol-export leg and the memory-map-render leg are exposed.

## Warnings

### WR-01: `resolveStorePath()`'s symlink guard misses a not-yet-existing target reached through an existing directory symlink

**File:** `.claude/mcp/vice/r2000-tools.ts:633-678` (`resolveStorePath`)
**Issue:** The function correctly refuses (a) a literal `..`-style escape (caught by
`isContained(resolved, root)` on the un-resolved path) and (b) a symlink to an
**already-existing** out-of-workspace file (caught by `isContained(real, realRoot)`
after `realpathSync(resolved)` succeeds). But when the final path component does not
exist yet — the documented, deliberately-tolerated case, since `r2000_save_project`
creates fresh projects — `realpathSync(resolved)` throws `ENOENT` for the *whole*
path (Node's `realpath` cannot partially resolve past a missing leaf), and the catch
block falls back to `real = resolved`, the **literal, symlink-unresolved** path. If an
intermediate path component is itself an existing directory symlink that already
points outside the workspace root (e.g. `<root>/linked -> /tmp/evil`, planted by any
prior write inside the repo), a project path like `linked/new.regen2000proj` passes
both containment checks (the literal string still starts with `root`), yet the
filesystem operation performed by the spawned `regenerator2000` child follows the
symlink and actually creates/writes the file at `/tmp/evil/new.regen2000proj`.
**Failure scenario:** A directory symlink already exists inside the workspace root
(planted by some earlier, unrelated write — e.g. another tool call in the same
session, or a checked-in symlink). An LLM later calls `r2000_save_project` (or any
mutating `r2000_*` tool, since every one of them auto-saves) with
`project: "linked/new.regen2000proj"`. `resolveStorePath()` returns the literal,
unresolved path and reports it as "inside the workspace"; the actual write lands
outside the workspace, at whatever the symlink target is, with no diagnostic. This
directly contradicts the module's own header comment ("refuse anything that escapes
the workspace root either directly or via a symlink") and its `T-11-PATH-ESCAPE`
label, for exactly the code path (fresh-project creation) that tolerating ENOENT
exists to support.
**Fix:** Resolve the *parent directory* of `resolved` with `realpathSync` (which does
exist, in the common case) and join the literal basename back on, then contain-check
against `realRoot` — rather than falling back to the fully-unresolved literal path
when the leaf itself is missing:
```ts
let real: string;
try {
  real = realpathSync(resolved);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw ...;
  const parentReal = realpathSync(dirname(resolved)); // still throws if parent itself is missing/escapes
  real = join(parentReal, basename(resolved));
}
```

### WR-02: `runR2000Tool()`'s allow-list and path guards throw instead of returning the codebase's own graceful refusal shape

**File:** `.claude/mcp/vice/r2000-tools.ts:735-769` (`runR2000Tool`)
**Issue:** Every other refusal path in this codebase (`DENY_LIST` in `vice-proxy.ts:3314-3317`,
the capability-registry refusal at `vice-proxy.ts:3354`, and every *other* failure inside
`runR2000Tool()` itself) returns a `CallToolResult`-shaped `{content, isError:true}` value
from an `async` function that resolves, not one that rejects. But `runR2000Tool()` calls
`assertCuratedTool(name, args)` and `resolveStorePath(...)` **before** its own `try` block
(lines 736-737), so a smuggled uncurated name inside `r2000_batch_execute` (D-33's own
named attack surface) or a path-escape attempt makes the function's returned promise
*reject* with `R2000UncuratedToolError`/`R2000StorePathError`, rather than resolve with
`errText(...)`. This is confirmed by the project's own test
(`r2000-tools.test.ts:234-274`, `runR2000Tool refuses a smuggled batch WHOLE...`), which
asserts via `assert.rejects(...)`, not by inspecting a resolved `isError:true` result.
**Failure scenario:** An LLM calls `r2000_batch_execute` with one legitimate inner call and
one smuggled `r2000_get_address_details` (or any other uncurated name). The refusal still
happens (no child is spawned — the security property holds), but it surfaces as a rejected
promise from the tool's `execute()` handler (`buildViceTool()`, `vice-proxy.ts:3160`)
instead of the `isError:true` `CallToolResult` every other refusal in this project produces.
Depending on how the MCP SDK's tool-execution wrapper treats a rejected `execute()` promise
(a JSON-RPC-level error vs. a `CallToolResult`), the calling agent may see a different, less
actionable failure shape than the one every other guard in this codebase was deliberately
built to produce — and if nothing catches it, `vice-proxy.ts`'s global "uncaughtException:
ignored, staying alive" handler swallows it, leaving that specific tool call permanently
unresolved from the LLM's point of view.
**Fix:** Wrap the two early guards in the same `try/catch` as the rest of the function, or
catch `R2000UncuratedToolError | R2000StorePathError` explicitly and return `errText(...)`
for both, exactly like every other refusal path.

### WR-03: `assertCuratedBatch()` recurses into nested `r2000_batch_execute` payloads with no depth limit

**File:** `.claude/mcp/vice/r2000-tools.ts:544-578` (`assertCuratedBatch`)
**Issue:** When a batch's inner call name is `r2000_batch_execute`, the function recurses
into `call.arguments` with no depth counter or ceiling. This is deliberate defense against a
two-level smuggling attempt (per the module's own comment), but the recursion itself is
unbounded.
**Failure scenario:** A caller submits `r2000_batch_execute` with a `calls` array containing
a nested `r2000_batch_execute` whose own `calls` array nests another, repeated to a depth in
the low thousands (a JSON payload of a few hundred KB is enough to exceed V8's default call
stack). `assertCuratedBatch()` throws `RangeError: Maximum call stack size exceeded` instead
of a clean, named refusal — and per WR-02 above, that exception also escapes `runR2000Tool()`'s
own `try/catch`, so this single malformed call degrades to the same "silently unresolved from
the LLM's perspective" shape WR-02 describes, rather than a bounded, informative refusal.
**Fix:** Track recursion depth explicitly and throw a named `R2000UncuratedToolError` (e.g.
"batch nesting exceeds N levels") once a small fixed ceiling (batches have no legitimate use
for deep nesting) is exceeded.

### WR-04: `renderMemoryMap()` embeds unescaped store text directly into Markdown table cells

**File:** `.claude/mcp/vice/r2000-memmap-render.ts:384-431` (the block/routines table rows)
**Issue:** Every table row is built by string interpolation directly from `sym.name` and the
comment `evidence` text (`parseConfidencePrefix()`'s `rest`), e.g.
`` `| ${range} | ${block.type} | ${grade} | ${evidence} |` `` and
`` `| ${hex4(sym.address)} | ${sym.name} | ${confirmedBy} | ${grade} |` ``, with no escaping
of `|` (a Markdown table cell delimiter) or embedded newlines. `r2000_set_comment`'s own
schema explicitly documents that a `'line'`-type comment "supports multi-line" — this is not
a hypothetical input shape, it is a documented, supported feature of the tool this renderer
consumes. Label names are unvalidated on entry (the already-recorded T-11-NAME-INJECT gap),
so either a discovered live symbol name or a comment's evidence text can carry a `|` or a
newline.
**Failure scenario:** A user (or a live-discovered symbol via `regenerateAndReload()`,
were it wired up — see IN-02) sets a multi-line `r2000_set_comment` at an address inside a
rendered block, e.g. `"[unknown] line one\nline two"`. `renderMemoryMap()` produces a table
row whose cell content contains a literal newline, splitting what should be one Markdown
table row into two physical lines — the second of which is not a valid table row at all,
corrupting every row after it when the file is rendered by a Markdown viewer. A label or
comment containing a bare `|` silently shifts every subsequent column in that row.
`checkRenderedMemoryMap()`'s drift check would still correctly detect *that the file
changed* on a later run, but the *broken* output itself is never flagged as broken — the
renderer will happily emit and report success on malformed Markdown.
**Fix:** Escape `|` (e.g. to `\|`) and collapse/reject embedded newlines in any store-sourced
string (`sym.name`, `evidence`, `confirmedBy`, `block.type`) before interpolating it into a
table cell.

### WR-05: No `"error"` listener remains on the regenerator2000 child after a successful spawn

**File:** `.claude/mcp/vice/r2000-mcp-client.ts:489-516` (`waitForSpawn`), used by
`withR2000Session` at line 334
**Issue:** `waitForSpawn()` attaches `child.once("error", onError)` and
`child.once("spawn", onSpawn)`; `onSpawn` calls `child.removeListener("error", onError)`.
After a successful spawn, `child` therefore has **no** `"error"` listener at all for the rest
of its lifetime. Node's `ChildProcess` can emit `"error"` after a successful spawn (for
example, when `child.kill()` fails to deliver a signal) — and Node's `EventEmitter` throws
synchronously when `"error"` is emitted with zero listeners.
**Failure scenario:** `killAfter()` (line 522) calls `child.kill("SIGKILL")` if the child
has not exited within `timeoutMs` of stdin being closed. If that kill attempt itself fails
(e.g. a permission or already-reaped-process edge case), the resulting `"error"` event has no
listener and becomes an uncaught exception. `vice-proxy.ts`'s global
`process.on("uncaughtException", ...)` handler prevents a full process crash (it logs and
"stays alive," per that file's own documented policy), but the specific `withR2000Session()`
call that triggered it never resolves or rejects through its own promise chain — from the
calling tool's perspective the call simply times out via its own `timeoutMs`/`killAfter`
race rather than failing cleanly and immediately, and the log entry carries no correlation to
which `r2000_*` call caused it.
**Fix:** Attach a permanent, no-op-but-present `child.on("error", (err) => { stderrBuf += ...
})` (or equivalent) for the lifetime of the session, so a post-spawn error is captured and
surfaces through the normal pending-request-rejection path instead of becoming a detached
global exception.

## Info

### IN-01: `generateEnums()`'s per-value `ldaAddr` is stored as "last seen," documented as "first seen," and never read

**File:** `.claude/mcp/vice/r2000-enum-gen.ts:565-571`
**Issue:** The comment above `byRegister` says `"value -> representative ldaAddr (first
seen)"`, but the loop calls `.set(occ.value, occ.ldaAddr)` for every occurrence in
iteration order, so a later occurrence of the same `(regKey, value)` pair silently
overwrites an earlier one — the map actually holds the **last** seen address, not the
first. In practice this has no observable effect: only `.keys()` of `valuesToLdaAddr` is
ever read (`for (const value of valuesToLdaAddr.keys())`), so the stored address itself is
dead data regardless of which occurrence wins.
**Fix:** Either delete the now-unused per-value address (a plain `Set<number>` of values
would say the same thing more honestly), or fix the comment/logic to agree if a future
change starts reading it.

### IN-02: `regenerateAndReload()` (the D-29 live-discovery merge point) has no production caller

**File:** `.claude/mcp/vice/r2000-symbols.ts:301-317`
**Issue:** This function is exported and described as "the store is the merge point for a
live-discovered name," but it is referenced nowhere outside its own module and its test
file — no `r2000_*` tool, CLI verb, or skill playbook calls it. The actual live-discovery
walkthrough recorded in `11-11-SUMMARY.md` drives the equivalent sequence by hand
(`r2000_set_label_name` then a manual `export-lbl`/`vice_symbols_load`), not through this
function.
**Fix:** Not a defect in the function itself, but worth flagging so a future phase does not
assume this convenience wrapper is already wired into a real workflow — either give it a
caller (a CLI verb or a documented skill step) or note explicitly that it is a
library-only convenience pending adoption.

---

_Reviewed: 2026-08-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
