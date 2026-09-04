---
phase: 36-the-sleigh-language-and-the-ghidra-harness
reviewed: 2026-09-04T20:51:35Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .gitignore
  - docs/phase36-sleigh-language-and-harness-findings.md
  - src/mcp/vice/fixtures/ghidra/README.md
  - src/mcp/vice/fixtures/ghidra/bank.a
  - src/mcp/vice/fixtures/ghidra/runlog-benign-base0-conflict.txt
  - src/mcp/vice/fixtures/ghidra/runlog-script-error.txt
  - src/mcp/vice/ghidra-harness-gates.test.ts
  - src/mcp/vice/ghidra-live.test.ts
  - src/mcp/vice/ghidra-opcode-live.test.ts
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/ghidra-project.test.ts
  - src/mcp/vice/ghidra-run.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/resources/ghidra-project.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/sleigh-compile-gate.test.ts
  - src/mcp/vice/test-gate.mjs
  - src/mcp/vice/test-gate.test.ts
  - src/mcp/vice/vendor/ghidra-ext/Module.manifest
  - src/mcp/vice/vendor/ghidra-ext/data/languages/6502_nmos.ldefs
  - src/mcp/vice/vendor/ghidra-ext/data/languages/6502_nmos.slaspec
  - src/mcp/vice/vendor/ghidra-ext/data/languages/6502_undocumented.sinc
  - src/mcp/vice/vendor/ghidra-ext/data/sleighArgs.txt
  - src/mcp/vice/vendor/ghidra-ext/extension.properties
  - src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java
  - src/mcp/vice/vendor/ghidra-scripts/README.md
  - src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-09-04T20:51:35Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This phase adds a vendored SLEIGH extension (`6502:LE:16:nmos`) covering all 105 undocumented
6502/6510 opcode bytes, the `ghidra.installExtension`/extended `ghidra.analyze` host-tool
seam fields, the run-log classifier (`ghidra-run.ts`), and two committed Ghidra
pre/post-scripts (`VolatileCarve.java`, `GhidraStructExport.java`). The SLEIGH source, the
`.ldefs`/`.slaspec` shape, the compile gate, and the seam's typed narrowing/path-confinement
discipline are all solid and internally consistent with the rest of the codebase's conventions
(never-throw boundaries, second-layer independent re-validation, workspace-path confinement).
`ghidra-project.mts` and its compiled `resources/ghidra-project.mjs` sibling are byte-for-byte
consistent (no drift); the larger line-count difference between `host-tool.mts` and
`resources/host-tool.mjs` is fully accounted for by stripped TypeScript-only interface/type
declarations, and the new `ghidra.installExtension`/`importRoute`/`loaderBaseAddr` logic is
present and matches in both — no drift found there either.

The one finding that matters most: **`runGhidraAnalyze()` — the production, end-to-end
function this whole plan built specifically so "a run whose post-script threw is never
readable as success" — never actually checks the `scriptThrew` signal it computes.** This is
not a hypothetical: this phase's own `ghidra-live.test.ts` "GATE 1" case deliberately plants a
thrown post-script and calls `runGhidraAnalyze()` expecting it to return normally (no
`assert.throws`), then has to manually re-parse the run log a second time, itself, to observe
`scriptThrew === true` — because the function under test does not surface that fact. A caller
that trusts `runGhidraAnalyze()`'s return value (as any real consumer would) cannot tell a
completed run from one whose script blew up.

Two further robustness findings (a resource-leak on a foreseeable early-failure path, and an
un-workspace-scoped copy target for `ghidra.installExtension`) round out the Warning tier, and
three Info-level dead-code/unused-import items are listed for completeness.

## Critical Issues

### CR-01: `runGhidraAnalyze()` never checks `scriptThrew`, so a run whose script threw is reported as success

**File:** `src/mcp/vice/ghidra-run.ts:236-256`
**Issue:** `classifyGhidraRunLog()` computes three independent signals — `scriptThrew`,
`language`, and `classification` — specifically because (per this module's own header)
`analyzeHeadless`'s exit status "carries no information about whether a script inside the run
succeeded." `runGhidraAnalyze()` is the one production consumer of that classifier, but its
implementation only inspects `verdict.language`:

```ts
const verdict = classifyGhidraRunLog(text);

if (!verdict.language.present) {
  throw new Error(...);
}
if (verdict.language.id !== args.processor) {
  throw new Error(...);
}

return { runLogPath: runLogResult.path, sha256: ..., byteLength: ..., exitStatus: response.exitStatus, language: verdict.language };
```

`verdict.scriptThrew` is discarded. This means a run whose `preScript`/`postScript` threw a
real exception (e.g. `GhidraStructExport.java`'s own classification-mismatch refusal, or any
other script-level failure) is returned by `runGhidraAnalyze()` as an ordinary, non-throwing
`GhidraRunResult`, indistinguishable from a fully-completed run, as long as the requested
language happens to match. This is proven live by this same phase's own
`ghidra-live.test.ts` "GATE 1" case (`src/mcp/vice/ghidra-live.test.ts:195-243`): it plants a
wrong `expectedClassificationLines` so the post-script throws for real, calls
`await runGhidraAnalyze(...)` with **no** `assert.throws`/try-catch around it, receives a
normal `result` back, and only THEN re-reads the run log and calls `classifyGhidraRunLog()`
itself a second time to notice `verdict.scriptThrew === true`. Every other caller of
`runGhidraAnalyze()` that does not repeat that manual re-parse (which is the entire point of
having a return-value contract at all) will treat a thrown-script run as a success.
**Fix:**
```ts
const verdict = classifyGhidraRunLog(text);

if (verdict.scriptThrew) {
  throw new Error(
    `runGhidraAnalyze: a script threw during this run (run log at ${runLogResult.path} carries ` +
    `"ERROR REPORT SCRIPT ERROR:") -- analyzeHeadless's own exit status (${response.exitStatus}) ` +
    `carries no information about this and must never be read as success`,
  );
}
if (!verdict.language.present) {
  ...
```
Add this check before the language checks (or after — order doesn't matter, but it must be
present), and update `ghidra-live.test.ts`'s GATE 1 case to assert the throw directly via
`assert.rejects(runGhidraAnalyze(...), /scriptThrew|thrown/i)` rather than manually re-deriving
the fact the function itself should have surfaced.

## Warnings

### WR-01: A foreseeable `ghidra.analyze` failure (unset `GHIDRA_HOME`, or processor not yet installed) permanently burns the run directory with no cleanup

**File:** `src/mcp/vice/host-tool.mts:1568-1634` (resolution order) and `src/mcp/vice/host-tool.mts:1041-1095` (the checks that can still fail)
**Issue:** In `runHostTool()`'s `"ghidra.analyze"` branch, `resolveGhidraProject()` is called
and — per its own documented contract — CREATES the run directory as a genuine reservation
before returning `ok: true` (`src/mcp/vice/ghidra-project.mts:392-410`). Only afterward is
`buildHostToolArgv(request, {...})` called, and that function's `"ghidra.analyze"` branch
performs several checks that can still fail *after* the reservation has already been made:
`GHIDRA_HOME` unset (`host-tool.mts:1047-1053`), the `analyzeHeadless` launcher missing on disk
(`host-tool.mts:1058-1063`), the requested `processor` not declared by any installed language
(`host-tool.mts:1075-1086`), or declared but its `.sla` not yet built
(`host-tool.mts:1087-1095` — exactly the state before `ghidra.installExtension` has ever been
run, a completely ordinary first-call sequencing mistake). When any of these trip,
`runHostTool()` returns `{ ok: false, message: built.message }` with the reserved directory
already sitting on disk, empty, forever. `resolveGhidraProject()` refuses to reuse ANY existing
directory under the same `runId` — even one from "an earlier, separate process"
(`ghidra-project.test.ts:196-204` asserts this deliberately) — so a caller who retries with the
same `runId` after fixing `GHIDRA_HOME` or after running `ghidra.installExtension` gets an
unrelated "refuses to reuse an existing run directory ... choose a different runId" refusal
instead of a successful run, with no indication that the original attempt never actually
reached `analyzeHeadless`.
**Fix:** Either (a) move the `GHIDRA_HOME`/launcher/language-preflight checks in
`buildHostToolArgv()`'s `ghidra.analyze` branch to run *before* `resolveGhidraProject()` is
called in `runHostTool()` (they don't need `projectLocation`/`projectName` to run), or (b) on a
`buildHostToolArgv` failure for `ghidra.analyze`, `rmSync(projectResolved.projectLocation, { recursive: true, force: true })`
before returning the refusal, so a fixable, foreseeable error doesn't cost the caller a `runId`
permanently.

### WR-02: `ghidra.installExtension`'s `sourceDir` may be any workspace-relative directory, copied wholesale into the shared Ghidra installation

**File:** `src/mcp/vice/host-tool.mts:1680-1730`
**Issue:** `sourceDir` is validated only as "a non-empty string, resolved through
`resolveWorkspacePath()`" (`host-tool.mts:684-696`, `host-tool.mts:1689-1690`) — any directory
inside the workspace, not just the vendored `vendor/ghidra-ext/` tree, is accepted and then
`cpSync`'d recursively into `<GHIDRA_HOME>/Ghidra/Extensions/<moduleName>/`
(`host-tool.mts:1719`), a location outside this project's own workspace and potentially shared
with other users/processes on the host (`GHIDRA_HOME` is host-wide, not per-project). A caller
that supplies `sourceDir: "."` or `sourceDir: ".git"` would copy the entire repository (or its
git history) into that shared location with no size, shape, or content check first. Every
other host-tool consumer of a workspace-relative directory (e.g. `dxa.disassemble`'s
`outDir`, `acme.build`'s `includes`) only ever *reads from* or writes small, expected outputs
inside the workspace; this is the one path that *copies a caller-chosen tree out* of the
workspace to a shared host location.
**Fix:** Before copying, verify `sourceDirResolved.path` contains (at minimum) the expected
`Module.manifest` file, or compare its resolved path against the known vendored location
(`join(repoRootAbs, "src", "mcp", "vice", "vendor", "ghidra-ext")`) and refuse by name
otherwise — mirroring the "checked, non-materialising preflight" discipline this same phase
already applies to `ghidra.analyze`'s language check.

### WR-03: `digestOutputFile()`'s `byteLength` comes from a separate `statSync`, not the buffer that was actually hashed

**File:** `src/mcp/vice/host-tool.mts:1361-1370`
**Issue:**
```ts
function digestOutputFile(path: string): HostToolFileResult | null {
  try {
    const stat = statSync(path);
    const contents = readFileSync(path);
    const sha256 = createHash("sha256").update(contents).digest("hex");
    return { path, sha256, byteLength: stat.size };
  } catch {
    return null;
  }
}
```
`stat.size` and `contents` are two separate reads of the filesystem. If the file is written to
between the `statSync` and the `readFileSync` (plausible for `ghidra.analyze`'s run-log file,
which this same module writes with `writeFileSync` immediately before this digest loop runs —
`host-tool.mts:1779-1788` — under a concurrent second request racing the same path, however
unlikely today), the returned `byteLength` would describe a different byte string than the one
`sha256` was computed over, silently breaking the digest's own internal consistency.
**Fix:** Derive `byteLength` from the buffer that was actually hashed: `byteLength: contents.length`.

## Info

### IN-01: Unused import `dirname` in `ghidra-project.mts`

**File:** `src/mcp/vice/ghidra-project.mts:64`
**Issue:** `import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"; import { dirname, join, sep } from "node:path";` — `dirname` is never referenced anywhere in this file (confirmed by `grep -n "dirname" ghidra-project.mts`, which matches only the import line itself). The same unused import is present verbatim in the compiled `resources/ghidra-project.mjs` (line 70), so it is not build drift, just a genuine dead import in both.
**Fix:** Remove `dirname` from the import list in `ghidra-project.mts` and rebuild `resources/ghidra-project.mjs`.

### IN-02: Unused import `ghidra.program.model.data.DataType` in `GhidraStructExport.java`

**File:** `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java:140`
**Issue:** `import ghidra.program.model.data.DataType;` is never referenced in the file (the script uses fully-qualified `ghidra.program.model.data.Composite` and `DataTypeManager` instead). Confirmed via `grep -n "DataType\b"`, which matches only the import statement.
**Fix:** Remove the unused import.

### IN-03: Dead export `GHIDRA_EXTENSION_MODULE_NAME` — defined, never consumed anywhere

**File:** `src/mcp/vice/ghidra-project.mts:150`
**Issue:** `export const GHIDRA_EXTENSION_MODULE_NAME = "C64Undocumented6502";` is exported with a
comment explaining it exists "so no future caller re-types the literal," but no production
module or test file in this repository imports it — `host-tool.mts`'s `ghidra.installExtension`
handling takes `moduleName` entirely from the caller-supplied wire value, and no live test
(`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`) references this constant either. It is
inert today.
**Fix:** Either wire it in as the default/example `moduleName` a live test or a future
orchestration layer actually uses, or remove it until a real consumer exists.

---

_Reviewed: 2026-09-04T20:51:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
