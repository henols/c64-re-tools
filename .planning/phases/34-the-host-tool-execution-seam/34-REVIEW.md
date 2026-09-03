---
phase: 34-the-host-tool-execution-seam
reviewed: 2026-09-04T00:00:00Z
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

**Reviewed:** 2026-09-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

This is the THIRD review pass over Phase 34, run after the second gap-closure round
(`34-10`/`34-11`) landed specifically to close `CR-05` — the lexical, symlink-blind
confinement check in `resolveWorkspacePath()` this review itself raised last round. `CR-05`
is verified CLOSED in the code as it stands today, not merely claimed closed in a
SUMMARY/decision doc: `resolveWorkspacePath()` (`host-tool.mts:563-586`) now walks BOTH the
workspace root and the candidate path through a new local `realpathOfNearestExisting()`
ancestor-realpath walk (`host-tool.mts:487-559`, a line-for-line-documented mirror of
`anno-types.ts`'s already-reviewed `storePathWithinWorkspace()`/`realpathOfNearestExisting()`
pair) before the prefix comparison, and returns the WALKED real path, not the lexical join. I
independently re-read the full implementation (not just the diff) and traced the ancestor
walk, the dangling-symlink hop counter (bounded at `MAX_SYMLINK_HOPS = 40`, matching Linux's
own `MAXSYMLINKS`), and the cycle-refusal path by hand against several concrete scenarios
(a symlinked directory pointing outside the workspace with an existing target, the same
pointing at a not-yet-created target, a two-hop symlink cycle) and found the logic sound in
every case traced. I additionally ran the full `host-tool.test.ts` suite live (`node --test
host-tool.test.ts`): all 83 cases pass, including four live, on-disk planted-symlink cases (a
read-key escape, a write-key escape that asserts the outside directory is left untouched, an
inside-pointing link correctly followed, and a discriminating case that would redden an
over-broad "refuse every symlink" fix), a dangling-link trio, a symlink-cycle pair, and a
cross-implementation equivalence table pinned against `anno-types.ts`'s own confinement seam
over one shared fixture table. I also rebuilt the host-bound artifacts (`node build.ts`) and
confirmed `resources/host-tool.mjs` is byte-identical to what a fresh build produces (`git
status` clean afterward) — no compiled-artifact drift. `CR-05` is therefore marked CLOSED
below, not carried forward as open.

`CR-01` through `CR-04` remain CLOSED exactly as recorded in the prior review round — no plan
in this round touched their code, and I did not find any regression in them while re-reading
`host-tool.mts` end to end this round. `WR-01` and `WR-02` remain deferred-by-decision and
unchanged. `WR-03` (the unguarded `mkdirSync` in `runOracleRun()` and the CLI entry point's
missing `.catch()`) is still open and still unfixed in the code as of this round — its todo
sits in `.planning/todos/pending/`, its `STATE.md` ledger row is untouched, and I confirmed by
direct inspection that `host-tool.mts:1240`'s `mkdirSync(scratchDir, { recursive: true })` is
still outside `runOracleRun()`'s own `try`/`finally`, and the CLI entry point at
`host-tool.mts:1317-1320` still has no `.catch()` on `runHostTool(...)`. No new Critical or
Warning issue was found in this round beyond what the two carried-forward findings already
state. This review did not modify any source file; `node build.ts` was run to check for
artifact drift and produced no working-tree change.

## Structural Findings (fallow)

None provided for this review.

## Narrative Findings (AI reviewer)

### CR-01: `oracle.probe`'s `command` override let a container-side caller execute an arbitrary host file — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:125, 910-958`
**Disposition:** CLOSED, verified in code (plan `34-08`). Unchanged this round; re-confirmed by direct inspection that `HOST_TOOL_ARG_KEYS["oracle.probe"]` is still `Object.freeze([])` and `resolveOracleCommand()` is still the single site both `runOracleProbe()` and `runOracleRun()` consult.
**Evidence:** `HOST_TOOL_ARG_KEYS["oracle.probe"]` is now `Object.freeze([])` (line 125) — the wire `command` key is refused BY NAME as an "unknown key" by `normaliseHostToolRequest()`'s own generic unknown-key check, before any tool-specific narrowing runs. The oracle's location is now decided exclusively by `resolveOracleCommand()` (lines 1138-1158), which reads only the BROKER PROCESS'S OWN environment (`UNP64`/`UNP64_PATH`), and additionally requires `basename(configured) === DEFAULT_ORACLE_COMMAND` before accepting a host-configured override, closing the path even for a compromised broker environment naming an arbitrarily-located file whose basename isn't `unp64`. `host-tool.test.ts` proves the retired key is refused both locally (`normaliseHostToolRequest`) and end-to-end over the real control-plane route, and proves the configured path is never echoed back in any response field (T-19-18 carried forward).

---

### CR-02: `ghidra.analyze`'s `preScript`/`postScript` reached `analyzeHeadless`'s argv unvalidated — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:1017-1032, 679-720`; `src/mcp/vice/ghidra-project.mts`
**Disposition:** CLOSED, verified in code (plan `34-07`). Unchanged this round.
**Evidence:** `runHostTool()`'s `ghidra.analyze` branch resolves both `preScript` and `postScript` through `resolveWorkspacePath()` BEFORE `buildHostToolArgv()` is ever called, threading only `preScriptPath`/`postScriptPath` (never `request.args.preScript`/`postScript`) into `buildAnalyzeHeadlessArgv()`'s input. `ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()` independently re-checks both fields for a literal `".."` path SEGMENT, so the rule holds even for a caller that bypassed `resolveWorkspacePath()` entirely. `host-tool.test.ts` proves the resolved-path-only read with a disagreement case and proves an escaping/absolute `preScript`/`postScript` is refused with the workspace-escape/not-absolute message and logs zero lines. Because `CR-05`'s fix changed `resolveWorkspacePath()`'s underlying confinement mechanism (now realpath-based rather than lexical), and `preScript`/`postScript` sit downstream of that same seam, I re-verified this round that the disagreement/escape/absolute test cases for these two fields still pass against the new implementation — they do (see the full 83/83 run cited under `CR-05`).

---

### CR-03: `acme.build`'s `includes` array reached `-I <dir>` unresolved — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:992-1004, 634-677`
**Disposition:** CLOSED, verified in code (plan `34-07`). Unchanged this round; re-verified against the new realpath-based `resolveWorkspacePath()` (see `CR-05`) that the disagreement/escape/absolute/empty-string cases for `includes` still pass.
**Evidence:** `runHostTool()`'s `acme.build` branch resolves every `includes` entry through `resolveWorkspacePath()`, refusing the WHOLE request on the FIRST escaping entry. `buildHostToolArgv()` reads ONLY `resolved.includePaths`, never `request.args.includes`. `host-tool.test.ts` proves this with a disagreement case, an escaping-entry refusal case, an absolute-entry refusal case, an empty-string-entry refusal case, and an END-TO-END case over the real control-plane route proving all seven VICE lease callbacks stay uncalled on a refusal. A NEW case this round (`34-10` Task 3) additionally proves two `includes` entries reaching the SAME real directory through two DIFFERENT symlinks both still appear in the spawned argv, in caller order — i.e. `CR-05`'s realpath-return change collapses two spellings to one real path, but not to one list entry, so `CR-03`'s no-partial-resolution guarantee is intact under the new confinement mechanism.

---

### CR-04: `ghidra.analyze` could not complete over the shipped control-plane route (timeout budget shorter than JVM startup cost) — **CLOSED**

**File:** `src/mcp/vice/host-tool-client.ts`; `src/mcp/vice/host-tool.mts:746-783`; `src/mcp/vice/vice-broker.mts`
**Disposition:** CLOSED, verified in code (plan `34-09`). Unchanged this round; no plan in this round touched any timeout table or client/server timer.
**Evidence:** `hostToolOverControlPlane()` runs two independent timers: a connect-phase timer bounded by `CONTROL_CONNECT_TIMEOUT_MS` (5000ms), cleared the instant `connect` fires, and a separate per-tool request-deadline timer sized by `hostToolRequestTimeoutMs()`, giving `ghidra.analyze` 660,000ms. Server-side, `host-tool.mts`'s `HOST_TOOL_TIMEOUT_MS` table gives `ghidra.analyze` 600,000ms while every other tool keeps the pre-existing 20,000ms default. `host-tool.test.ts` proves this works end to end: a real control-plane round trip with a fake launcher sleeping 6s (longer than the OLD 5s connect-timeout constant) resolves `ok: true`; a cross-seam ordering test asserts the client deadline strictly exceeds the server budget for every tool id; a kill-on-expiry case proves the bound is never removed. I re-ran this suite live this round (see `CR-05`'s evidence) and it still passes, including a new-this-round two-concurrent-slow-invocations case (`34-09`/`34-10` era) proving two overlapping slow `ghidra.analyze` requests both resolve `ok:true`, reserve distinct project locations, and complete in appreciably less than the sum of the two sleeps.

---

### CR-05: `resolveWorkspacePath()` uses lexical `path.resolve()` with no symlink resolution — a container-side caller can escape the workspace root through a planted symlink — **CLOSED**

**File:** `src/mcp/vice/host-tool.mts:428-586` (the seam and its new ancestor-realpath walk), consumed at `host-tool.mts:975-1044` (acme.build's `source`/`outDir`/`includes`, ghidra.analyze's `importPath`/`preScript`/`postScript`) and `host-tool.mts:1212-1220` (oracle.run's `source`)
**Disposition:** CLOSED, verified in code (plan `34-10`), decision record updated (plan `34-11`). This finding was raised NEW in the prior (`34-09`-era) review round and is closed in this round after direct re-verification against the code as it stands, not against the SUMMARY's claim.
**Evidence:** `resolveWorkspacePath()` (`host-tool.mts:563-586`) now walks both `repoRoot` and the resolved candidate through a new local function, `realpathOfNearestExisting()` (`host-tool.mts:487-559`), before the `startsWith(rootAbs + sep)` prefix comparison, and returns the WALKED real path as the `ok: true` result — not the lexical join. The walk: climbs the ancestor chain via `lstatSync(..., { throwIfNoEntry: false })` to find the nearest existing path ENTRY (never following a symlink at the leaf while checking existence); when the stopping entry is a symlink whose target does not exist, it counts a hop (bounded at `MAX_SYMLINK_HOPS = 40`, refusing a chain or cycle past that bound) and re-resolves the link's target against the LINK'S OWN directory (never the process cwd); otherwise it calls `realpathSync` on the existing entry and rejoins any non-existent tail. Every filesystem failure along the walk becomes a named `{ ok: false, message }` refusal, preserving the module's own never-throw contract. This is a documented, line-for-line mirror of `anno-types.ts`'s already-reviewed `storePathWithinWorkspace()`/`realpathOfNearestExisting()` pair (duplicated locally per `A-15` because `host-tool.mts` is host-bound and cannot import a container-side `.ts` module), pinned against drift by a cross-implementation equivalence test (`host-tool.test.ts`, "resolveWorkspacePath and anno-types.ts's storePathWithinWorkspace() agree").

I independently traced the walk by hand against three scenarios not identical to the test names (a symlinked directory whose target exists, the same with a not-yet-created target, and a two-hop symlink cycle) and found the logic correct in each: the symlinked-directory-with-existing-target case resolves to the real path outside the workspace and is refused; the not-yet-created-target case still resolves the real, outside-workspace location by rejoining the walked tail and is refused; the cycle case is refused by the hop-count bound before an infinite loop can occur. I then ran `host-tool.test.ts` live end to end: 83/83 pass, including four live on-disk planted-symlink cases (a read-key escape via `acme.build`'s `source`, a write-key escape via `acme.build`'s `outDir` that asserts the outside directory's listing is unchanged afterward — i.e. no file was actually created outside the workspace, closing the write-side blast radius this finding named as the more serious of the two demonstrated escapes — an inside-pointing link correctly FOLLOWED and accepted, and a dangling-inside-link accepted while a dangling-outside link is refused, discriminating against an over-broad "refuse every symlink" fix), a symlink-cycle pair (leaf position and ancestor position, the latter via the kernel's own `ELOOP` surfacing through the walk rather than the manual hop counter), and the cross-implementation equivalence table against `anno-types.ts`. I rebuilt the host-bound artifacts (`node build.ts`) and confirmed `resources/host-tool.mjs` is unchanged from its already-committed state (no drift between the `.mts` source and the shipped compiled artifact).

Two residuals from this fix are explicitly recorded (not silently dropped) rather than closed: (1) the check-then-open window between this confinement decision and the child process's own filesystem open is not closed at this layer — the child is a third-party binary handed a path string, so there is no descriptor-based route to making the check and the open one atomic operation (`T-34-52`, accepted, matching the identical residual `anno-confinement.test.ts` already records for the same class of check); (2) the comparison is byte-wise with no Unicode normalisation, so two spellings of a path differing only in normalisation form are treated as distinct (same residual as `anno-types.ts`'s comparison). Both are pre-existing, accepted, documented limits of this general confinement approach, not new gaps introduced by this fix, and I am not raising either as a new finding — they are the same accepted residuals this project already lives with for the identical mechanism in `anno-types.ts`.

I did not find live planted-symlink coverage for `ghidra.analyze`'s `preScript`/`postScript` or `oracle.run`'s `source` specifically (only `acme.build`'s `source`/`outDir`/`includes` got a live on-disk symlink case) — but since all seven path-bearing keys route through the exact same `resolveWorkspacePath()` seam that IS symlink-tested, and that seam is additionally pinned against `anno-types.ts`'s own already-reviewed implementation by an equivalence table, I judge this a reasonable test-scope decision rather than a residual gap worth a separate finding.

---

## Warnings

### WR-01 (from prior review): spawn-gate detector evadable by aliasing the spawn function — **DEFERRED BY DECISION, unchanged**

**File:** `scripts/check-no-skill-external-spawn.mjs:270-304`
**Disposition:** Deferred by explicit decision, not silently dropped. Re-confirmed unchanged this round — no plan in `34-10`/`34-11` touched this file, and direct inspection shows `findArgvCallSites()` still matches only the literal identifiers in `ARGV_SPAWN_NAMES` directly adjacent to `(`, so a bracket-notation call (`cp["spawn"](...)`) or an unresolved destructuring rename would still evade detection.
**Fix:** Unchanged from the prior review — resolve a bare identifier call site back to its own declaration for the CALLED FUNCTION NAME (not just the first-argument token, which is already covered), or at minimum add a planted-violation test naming this gap as a documented limitation.

### WR-02 (from prior review): `host_tool` has no admission control / concurrent-JVM ceiling — **DEFERRED BY DECISION, unchanged**

**File:** `src/mcp/vice/broker-control.mts`; `src/mcp/vice/host-tool.mts`
**Disposition:** Deferred by explicit decision. Re-confirmed unchanged this round — no plan in `34-10`/`34-11` touched `broker-control.mts`'s `host_tool` dispatch branch, which still calls `opts.onHostTool(req)` unconditionally with no per-broker in-flight counter or ceiling. `CR-04`'s (unchanged, already-closed) fix means `ghidra.analyze` invocations can still legitimately run for up to 600 seconds each, so the ten-minute-wide window during which several concurrent JVM-spawning requests can pile up unbounded is unchanged from the prior review.
**Fix:** Unchanged from the prior review — track in-flight `host_tool` invocations per broker process and reject once a configurable ceiling is reached, mirroring the `at_capacity` vocabulary the `acquire` path already has.

### WR-03 (from prior review): `runOracleRun()`'s scratch-directory creation is unguarded, and the CLI entry point has no `.catch()` — an environmental failure becomes an unhandled rejection instead of the module's own `{ ok: false, message }` contract — **OPEN, unchanged**

**File:** `src/mcp/vice/host-tool.mts:1240` (the unguarded `mkdirSync`), `src/mcp/vice/host-tool.mts:1317-1320` (the CLI entry point's missing `.catch()`)
**Disposition:** OPEN — filed as a pending todo (`.planning/todos/pending/2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md`), its `STATE.md` Deferred Items ledger row untouched, and `docs/phase34-host-tool-seam-decisions.md` Part 4 explicitly records it as deliberately not folded into the `34-10`/`34-11` round. Re-confirmed unfixed by direct inspection of the current file: `mkdirSync(scratchDir, { recursive: true })` still sits before the `try` block starts on the next line, and the CLI entry point's `runHostTool(raw, { repoRoot }).then(...)` still has no `.catch()`.
**Issue:** `runHostTool()`'s own doc comment states "NOTHING throws out of this function", but `runOracleRun()`'s `mkdirSync` call sits OUTSIDE its own `try`/`finally`, so a `mkdirSync` failure (full disk, permission error on the `tools/oracle-runs/` parent) throws synchronously out of `runOracleRun()` and therefore out of `runHostTool()`, contradicting the file's own stated invariant. Inside the real broker process this is caught by `broker-control.mts`'s own `.catch()` around `opts.onHostTool(req)`, so it does not reach `broker-kill.mts`'s process-wide handlers there — but the standalone CLI entry point has no equivalent guard, so a rejected promise there is an unhandled rejection in the standalone `host-tool.mjs` process, breaking `hostToolOverHostRoute()`'s own contract rather than surfacing a clean `{ ok: false, message }` line.
**Fix:** Wrap the `mkdirSync` call in `runOracleRun()` in the same try/catch discipline the rest of the module uses (or move it inside the existing `try` block, before the `spawnHostTool()` call, converting a thrown error into `{ ok: false, tool: "oracle.run", stdout: "", reason: ... }`), and add a `.catch()` to the CLI entry point's `runHostTool(...)` call that prints a `{ ok: false, message }` JSON line and sets a non-zero exit code, mirroring `host-tool-client.ts`'s own CLI entry point, which already does this correctly.

---

_Reviewed: 2026-09-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
