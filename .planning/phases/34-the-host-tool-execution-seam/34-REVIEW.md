---
phase: 34-the-host-tool-execution-seam
reviewed: 2026-09-03T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - docs/phase34-host-tool-seam-decisions.md
  - .github/workflows/ci.yml
  - .gitignore
  - scripts/check-no-skill-external-spawn.d.mts
  - scripts/check-no-skill-external-spawn.mjs
  - src/mcp/vice/acme-verify.test.ts
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/build.ts
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/ghidra-project.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-tool-client.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/host-tool-transport.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/ghidra-project.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/skill-external-spawn-gate.test.ts
  - src/mcp/vice/tsconfig.build.json
  - src/mcp/vice/vice-broker-client.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-proxy.test.ts
  - src/skills/acme-build/scripts/acme.mjs
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-program-recon/scripts/packer-finding.mjs
  - src/skills/c64-program-recon/scripts/packer-finding.test.mjs
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-ram-capture/scripts/derive-transients.test.mjs
  - src/skills/c64-ram-capture/scripts/mcp-module.mjs
  - src/skills/c64-ram-capture/scripts/mcp-module.test.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs
findings:
  critical: 5
  warning: 3
  info: 0
  total: 8
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-09-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

This is a re-review of Phase 34 after gap-closure plans `34-07`, `34-08` and
`34-09` landed specifically to close `CR-01` through `CR-04` from the prior
`34-REVIEW.md`. All four are verified CLOSED in the code as written (not
merely claimed closed in a SUMMARY): `oracle.probe`'s wire `command` field is
gone entirely and the oracle's location is now resolved host-side only
(`resolveOracleCommand()`, host-tool.mts); `ghidra.analyze`'s
`preScript`/`postScript` and `acme.build`'s `includes` now flow through
`resolveWorkspacePath()` before reaching argv, with a second independent
parent-segment check in `ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()`;
and the client/server timeout budgets are now split into a connect-phase
timer and a per-tool request-deadline timer, with `ghidra.analyze` given a
600s/660s (server/client) budget instead of the old fixed 20s/5s ceiling that
made it structurally unable to complete. All four closures are backed by
real, non-vacuous tests, including two real end-to-end control-plane round
trips that exercise a fake launcher sleeping past the old connect-timeout
constant. The compiled `resources/host-tool.mjs`/`resources/ghidra-project.mjs`
artifacts were spot-checked against their `.mts` sources and are in sync (no
drift). `WR-01` and `WR-02` were deliberately deferred by decision in
`34-07-PLAN.md`/`34-09-PLAN.md` and are recorded as such here, not as new
failures — confirmed against the current code: `check-no-skill-external-spawn.mjs`'s
call-site detector is still evadable by aliasing the spawn function (WR-01
unchanged), and `broker-control.mts`'s `host_tool` dispatch still has no
per-broker concurrency ceiling (WR-02 unchanged).

However, this round found a NEW, unresolved Critical issue that none of the
three gap-closure plans touched: `resolveWorkspacePath()` — the single seam
this module's own header calls "the ONLY place a wire-supplied path becomes a
real path" and the mechanism CR-02/CR-03's fixes were built on top of — uses
plain lexical `path.resolve()` with no symlink resolution, which is the exact
bug class (`28-REVIEW.md` CR-03/CR-04, fixed in `anno-types.ts`'s
`storePathWithinWorkspace()` by walking to each side's realpath) this project
has already found and fixed once, elsewhere in this same codebase. Every one
of the seven path-bearing `host_tool` argument keys (`acme.build`'s
`source`/`outDir`/`includes`, `ghidra.analyze`'s
`importPath`/`preScript`/`postScript`, `oracle.run`'s `source`) inherits this
gap, so the CR-02/CR-03 fixes correctly close the "raw wire string reaches
argv" defect while leaving the underlying confinement check itself bypassable
by a symlink planted anywhere inside the workspace tree. A second, narrower
robustness gap (`WR-03`, new) was also found: `runOracleRun()`'s
`mkdirSync(scratchDir, ...)` is not exception-guarded, and the standalone
`host-tool.mjs` CLI entry point has no `.catch()` on `runHostTool()`'s
returned promise, so an environmental failure on that one path (disk
full/permission denied) becomes an unhandled rejection rather than the
`{ ok: false, message }` JSON line every other failure path in this module
promises.

## Structural Findings (fallow)

None provided for this review.

## Narrative Findings (AI reviewer)

### CR-01: `oracle.probe`'s `command` override let a container-side caller execute an arbitrary host file — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:125, 910-958`
**Disposition:** CLOSED, verified in code (plan `34-08`).
**Evidence:** `HOST_TOOL_ARG_KEYS["oracle.probe"]` is now `Object.freeze([])` (line 125) — the wire `command` key is refused BY NAME as an "unknown key" by `normaliseHostToolRequest()`'s own generic unknown-key check, before any tool-specific narrowing runs. The oracle's location is now decided exclusively by `resolveOracleCommand()` (lines 938-958), which reads only the BROKER PROCESS'S OWN environment (`UNP64`/`UNP64_PATH`), and additionally requires `basename(configured) === DEFAULT_ORACLE_COMMAND` before accepting a host-configured override, closing the path even for a compromised broker environment naming an arbitrarily-located file whose basename isn't `unp64`. `host-tool.test.ts` proves the retired key is refused both locally (`normaliseHostToolRequest`) and end-to-end over the real control-plane route, and proves the configured path is never echoed back in any response field (T-19-18 carried forward). `resolveOracleCommand()` is also now the single site both `runOracleProbe()` and `runOracleRun()` consult (previously `runOracleRun()` had no such gate at all) — closing a second, previously-unstated defect in the same commit.

---

### CR-02: `ghidra.analyze`'s `preScript`/`postScript` reached `analyzeHeadless`'s argv unvalidated — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:817-832, 505-514`; `src/mcp/vice/ghidra-project.mts:293-317`
**Disposition:** CLOSED, verified in code (plan `34-07`).
**Evidence:** `runHostTool()`'s `ghidra.analyze` branch now resolves both `preScript` and `postScript` through `resolveWorkspacePath()` (lines 817-832) BEFORE `buildHostToolArgv()` is ever called, threading only `preScriptPath`/`postScriptPath` (never `request.args.preScript`/`postScript`) into `buildAnalyzeHeadlessArgv()`'s input. `ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()` independently re-checks both fields for a literal `".."` path SEGMENT (not a substring test — `ghidra-project.test.ts` proves `"..foo.java"` is accepted while `"../x.java"` is refused), so the rule holds even for a caller that bypassed `resolveWorkspacePath()` entirely. `host-tool.test.ts` proves the resolved-path-only read with a disagreement case (wire value `"wire-pre.java"` vs. resolved `"/repo/some/resolved-pre.java"` — only the latter appears in argv), and proves an escaping/absolute `preScript`/`postScript` is refused with the workspace-escape/not-absolute message and logs zero lines. The header comment at `host-tool.mts:96-100`, which the prior review quoted as false, now accurately states the resolved-path discipline.

---

### CR-03: `acme.build`'s `includes` array reached `-I <dir>` unresolved — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:792-804, 467-472`
**Disposition:** CLOSED, verified in code (plan `34-07`).
**Evidence:** `runHostTool()`'s `acme.build` branch now resolves every `includes` entry through `resolveWorkspacePath()` (lines 792-804), refusing the WHOLE request on the FIRST escaping entry (no partial resolution, no silent drop). `buildHostToolArgv()` reads ONLY `resolved.includePaths` (line 472), never `request.args.includes`. `host-tool.test.ts` proves this with a disagreement case (wire `["wire-inc-1", ...]` vs. resolved `["/repo/resolved-inc-1", ...]` — only the latter reaches argv), an escaping-entry refusal case, an absolute-entry refusal case, an empty-string-entry refusal case (never silently skipped), and an END-TO-END case over the real control-plane route proving all seven VICE lease callbacks stay uncalled on a refusal.

---

### CR-04: `ghidra.analyze` could not complete over the shipped control-plane route (timeout budget shorter than JVM startup cost) — **CLOSED**

**File:** `src/mcp/vice/host-tool-client.ts:86-121, 169-208`; `src/mcp/vice/host-tool.mts:544-583`; `src/mcp/vice/vice-broker.mts:1163-1180`
**Disposition:** CLOSED, verified in code (plan `34-09`).
**Evidence:** `hostToolOverControlPlane()` now runs TWO independent timers (lines 169-208): a connect-phase timer bounded by `CONTROL_CONNECT_TIMEOUT_MS` (5000ms), cleared the instant `connect` fires, and a SEPARATE per-tool request-deadline timer sized by `hostToolRequestTimeoutMs()` (lines 103-121), which reads a new `HOST_TOOL_REQUEST_TIMEOUT_MS` table giving `ghidra.analyze` 660,000ms. Server-side, `host-tool.mts`'s `HOST_TOOL_TIMEOUT_MS` table (lines 563-570) gives `ghidra.analyze` 600,000ms while every other tool keeps the pre-existing 20,000ms default; `vice-broker.mts`'s real wiring (lines 1163-1180) is documented as deliberately supplying no override, letting the per-tool table govern. `host-tool.test.ts` proves this is not merely configured but WORKS: a real end-to-end control-plane round trip with a fake launcher sleeping 6s (comfortably longer than the OLD 5s connect-timeout constant) resolves `ok: true`, with the measured elapsed time asserted to exceed `CONTROL_CONNECT_TIMEOUT_MS`; a cross-seam ordering test iterates every `HOST_TOOL_IDS` member asserting the client deadline is strictly greater than the server budget; and a kill-on-expiry case proves raising the budget never removed the bound (a 500ms override still kills the child and names the budget in the refusal). This is exactly the round trip CR-04 stated could not complete before this plan, now proven completing.

---

### CR-05 (NEW): `resolveWorkspacePath()` uses lexical `path.resolve()` with no symlink resolution — a container-side caller can escape the workspace root through a planted symlink, for every one of the seven path-bearing `host_tool` argument keys, INCLUDING two that let the host WRITE outside the workspace

**File:** `src/mcp/vice/host-tool.mts:370-386` (the seam), consumed at `host-tool.mts:780-843` (acme.build's `source`/`outDir`/`includes`, ghidra.analyze's `importPath`/`preScript`/`postScript`) and `host-tool.mts:1013-1017` (oracle.run's `source`)
**Disposition:** NEW — not raised in the prior review, not touched by any of `34-07`/`34-08`/`34-09`.
**Issue:**

```ts
export function resolveWorkspacePath(repoRoot: string, relative: string): ResolveWorkspacePathResult {
  ...
  const rootAbs = resolvePath(repoRoot);
  const resolved = resolvePath(rootAbs, relative);
  if (resolved !== rootAbs && !resolved.startsWith(rootAbs + sep)) {
    return { ok: false, message: `workspace path escapes the workspace root: ...` };
  }
  return { ok: true, path: resolved };
}
```

`resolvePath` is Node's `path.resolve` — a purely lexical, string-level normalisation. It does not consult the filesystem and does not follow symbolic links. If the workspace tree contains a symlink anywhere along a supplied relative path's ancestor chain (e.g. `<repoRoot>/link -> /etc`), a caller-supplied `source: "link/hostname"` resolves LEXICALLY to `<repoRoot>/link/hostname`, which passes the `startsWith(rootAbs + sep)` check and is accepted as `ok: true` — but the actual file the OS subsequently opens, reads, or writes is `/etc/hostname`, entirely outside the workspace root this function's own name and every calling site's own comments claim it enforces.

This is not a hypothetical: this exact class of bug was already found and fixed once in this codebase. `anno-types.ts`'s `storePathWithinWorkspace()` (the analogous confinement seam for the annotation store, `28-REVIEW.md` CR-03/CR-04) resolves BOTH the candidate path and the workspace root through `realpathOfNearestExisting()` — an ancestor walk that follows real symlinks and handles the dangling-link case — specifically because a bare `resolve()`-based check "SUCCEEDED and the store file was CREATED outside the workspace root" under a planted symlink (`anno-confinement.test.ts`'s own header, describing the exact prior incident). `host-tool.mts`'s `resolveWorkspacePath()`, introduced fresh in this phase as "the ONLY place a wire-supplied path becomes a real path" (this module's own header, lines 34-37), reintroduces the identical vulnerable shape with none of that project-established mitigation. No test in `host-tool.test.ts`, `host-tool-transport.test.ts` or `ghidra-project.test.ts` plants a symlink anywhere — the word "symlink" does not appear in any file in this module family.

The blast radius is worse than a read-only escape: `HOST_TOOL_PATH_ARG_KEYS`'s own census (`host-tool.test.ts:1220`, "the declared path-key total across all tools must be 7") counts exactly the seven vulnerable keys, and two of them are WRITE destinations, not read sources. `acme.build`'s `outDir` (resolved at `host-tool.mts:783-790`) becomes the directory ACME is told to write `<stem>.prg`/`.sym`/`.vs`/`.rep` into via the `-o`/`-l`/`--vicelabels`/`-r` flags `buildHostToolArgv()` constructs (lines 449-465) — a caller who can plant one symlink inside the workspace (which they can, since they already control `source`'s own containing directory) can point `outDir` at that symlink and have the HOST broker process write assembler output to an arbitrary host-writable location, e.g. overwriting a file the broker process's own user can write. `oracle.run`'s `source` (resolved at `host-tool.mts:1013-1017`) lets a caller read an arbitrary host file's bytes back through the oracle's stdout capture, via a symlink pointing at it. `ghidra.analyze`'s `preScript`/`postScript` (now correctly workspace-bounded by CR-02, but still symlink-blind) let a caller select an arbitrary host script for `analyzeHeadless` to execute inside the JVM's analysis session via the same symlink technique.

**Fix:** Mirror `anno-types.ts`'s existing, already-reviewed fix: resolve both `rootAbs` and `resolved` through an ancestor-realpath walk (either export and reuse `realpathOfNearestExisting()` from `anno-types.ts`, or implement the equivalent discipline locally) before the prefix comparison, and return the REALPATH (not the lexical join) as the `ok: true` result — the same shape `storePathWithinWorkspace()` already returns for exactly this reason:

```ts
export function resolveWorkspacePath(repoRoot: string, relative: string): ResolveWorkspacePathResult {
  if (typeof relative !== "string" || relative === "") { ... }
  if (isAbsolute(relative)) { ... }
  const rootAbs = realpathOfNearestExisting(resolvePath(repoRoot));
  const resolved = realpathOfNearestExisting(resolvePath(rootAbs, relative));
  if (resolved !== rootAbs && !resolved.startsWith(rootAbs + sep)) {
    return { ok: false, message: `workspace path escapes the workspace root: ...` };
  }
  return { ok: true, path: resolved };
}
```
Add a planted-symlink test to `host-tool.test.ts` for at least one read key (`acme.build`'s `source`) and one write key (`acme.build`'s `outDir`), mirroring `anno-confinement.test.ts`'s own live-link discipline (a real symlink planted on disk, not a synthetic string), so this class of gap is provably closed rather than asserted closed.

---

## Warnings

### WR-01 (from prior review): spawn-gate detector evadable by aliasing the spawn function — **DEFERRED BY DECISION, unchanged**

**File:** `scripts/check-no-skill-external-spawn.mjs:270-304`
**Disposition:** Deferred by explicit decision, not silently dropped. `34-07-PLAN.md` and `34-09-PLAN.md` both record this as a visible deferral naming this review by id, with no plan in this round editing the file. Confirmed still true against the current code: `findArgvCallSites()` still matches only the literal identifiers in `ARGV_SPAWN_NAMES` directly adjacent to `(`, so a bracket-notation call (`cp["spawn"](...)`) or a destructuring rename not yet covered by `resolvesToInterpreter()`'s own declaration-lookback would still evade detection. No new evidence changes this finding's substance; carried forward verbatim.
**Fix:** Unchanged from the prior review — resolve a bare identifier call site back to its own declaration for the CALLED FUNCTION NAME (not just the first-argument token, which is already covered), or at minimum add a planted-violation test naming this gap as a documented limitation.

### WR-02 (from prior review): `host_tool` has no admission control / concurrent-JVM ceiling — **DEFERRED BY DECISION, unchanged**

**File:** `src/mcp/vice/broker-control.mts:672-690`; `src/mcp/vice/host-tool.mts:637-737`
**Disposition:** Deferred by explicit decision. `34-09-PLAN.md` records this as explicitly out of that round's scope, breadcrumbed to `/gsd-secure-phase`, and `34-VERIFICATION.md` recorded it as a warning rather than scoring it as a gap. Confirmed still true against the current code: `broker-control.mts`'s `host_tool` dispatch branch (line 680) still calls `opts.onHostTool(req)` unconditionally with no per-broker in-flight counter or ceiling, for any connection holding the shared control token. CR-04's fix makes this WORSE in one respect worth flagging for whoever eventually picks this up: `ghidra.analyze` invocations can now legitimately run for up to 600 seconds each (versus the old, effectively-unreachable 20s ceiling), so the window during which several concurrent JVM-spawning requests can pile up unbounded is now ten minutes long per invocation instead of twenty seconds — the underlying admission-control gap is unchanged, but the now-usable long-running tool makes it materially easier to hit in practice.
**Fix:** Unchanged from the prior review — track in-flight `host_tool` invocations per broker process and reject once a configurable ceiling is reached, mirroring the `at_capacity` vocabulary the `acquire` path already has.

### WR-03 (NEW): `runOracleRun()`'s scratch-directory creation is unguarded, and the CLI entry point has no `.catch()` — an environmental failure becomes an unhandled rejection instead of the module's own `{ ok: false, message }` contract

**File:** `src/mcp/vice/host-tool.mts:1039-1040` (the unguarded `mkdirSync`), `src/mcp/vice/host-tool.mts:1117-1121` (the CLI entry point's missing `.catch()`)
**Disposition:** NEW.
**Issue:** `runHostTool()`'s own doc comment states "NOTHING throws out of this function -- every failure path (refusal, launch error, timeout, non-zero exit, unreadable output) resolves to a response object, because broker-kill.mts's uncaughtException/unhandledRejection handlers kill the whole VICE pool on an unhandled throw in this process" (lines 748-752). `runOracleRun()` does not honour this: its `mkdirSync(scratchDir, { recursive: true })` call (line 1040) sits OUTSIDE the function's own `try`/`finally` (the `try` starts on the next line, at the `spawnHostTool()` call), so a `mkdirSync` failure (e.g. a full disk, or a permission error on the `tools/oracle-runs/` parent) throws synchronously out of `runOracleRun()`, and therefore out of `runHostTool()`, contradicting the file's own stated invariant. Inside the real broker process this is caught by `broker-control.mts`'s own `.catch()` around `opts.onHostTool(req)` (line 686), so it does not reach `broker-kill.mts`'s process-wide handlers there — but the standalone CLI entry point at the bottom of `host-tool.mts` has no equivalent guard:
```ts
runHostTool(raw, { repoRoot }).then((response) => {
  process.stdout.write(`${JSON.stringify(response)}\n`);
  process.exitCode = response.ok ? 0 : 1;
});
```
A rejected promise here is an unhandled rejection in the standalone `host-tool.mjs` process (used by the host-local route in CI and by `hostToolOverHostRoute()`), which — depending on Node's configured unhandled-rejection behaviour — prints an uncaught-exception trace and/or exits non-zero with NOTHING on stdout, breaking `hostToolOverHostRoute()`'s own contract ("host-tool.mjs produced no output on stdout") rather than surfacing a clean, diagnosable `{ ok: false, message }` line.
**Fix:** Wrap the `mkdirSync` call in `runOracleRun()` in the same try/catch discipline the rest of the module uses (or move it inside the existing `try` block, before the `spawnHostTool()` call, converting a thrown error into `{ ok: false, tool: "oracle.run", stdout: "", reason: ... }`), and add a `.catch()` to the CLI entry point's `runHostTool(...)` call that prints a `{ ok: false, message }` JSON line and sets a non-zero exit code, mirroring `host-tool-client.ts`'s own CLI entry point, which already does this correctly (`host-tool-client.ts:419-427`).

---

_Reviewed: 2026-09-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
