---
phase: 60-the-seam-wired-into-the-code-that-ships
reviewed: 2026-09-18T16:44:29Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - docs/phase58-declaration-provenance.md
  - docs/phase59-tool-location-placement.md
  - src/mcp/vice/acme-verify.test.ts
  - src/mcp/vice/acme-verify.ts
  - src/mcp/vice/backend-detect.mts
  - src/mcp/vice/broker-launch.mts
  - src/mcp/vice/build.ts
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/host-tool-client.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/prerequisites.test.ts
  - src/mcp/vice/repo-root.ts
  - src/mcp/vice/resources/backend-detect.mjs
  - src/mcp/vice/resources/broker-launch.mjs
  - src/mcp/vice/resources/ghidra-project.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/resources/prerequisites.json
  - src/mcp/vice/resources/tool-location.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/tool-location-consumers.test.ts
  - src/mcp/vice/tool-location.mts
  - src/mcp/vice/tool-location.test.ts
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/vice-broker-launch.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-proxy.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-09-18T16:44:29Z
**Depth:** standard
**Files Reviewed:** 26 (`src/mcp/vice/resources/*.mjs` and `resources/prerequisites.json` reviewed as generated/committed artifacts per the phase's own stated convention -- not flagged for duplicating their `.mts`/`.json` sources)
**Status:** issues_found

## Summary

Phase 60 wires the Phase 59 `tool-location.mts` seam into the code paths that
actually spawn or locate an external tool: `backend-detect.mts`'s
`resolvedBackend()`, `broker-launch.mts`/`vice-broker.mts`'s real spawn
wiring, and `host-tool.mts`'s ACME/Ghidra/c1541/petcat/dxa resolution. The
wiring itself is careful and the commit history shows the team caught real
gaps during its own required full-suite baseline diff (the missing
`viceBin` thread into `onAcquire`, the missing `prerequisites.json` deploy
copy) -- both fixes are present and covered by real end-to-end tests
(`vice-broker-acquire.test.ts`, `vice-broker-launch.test.ts`). Typecheck is
clean, no dangerous spawn shape or shell-string spawn is present anywhere
in the diff, and no debug artifact (`console.log`, `TODO`, empty `catch`)
was found.

The one genuine correctness defect found is a silent behavioural narrowing
of the environment-variable override layer: `VICE_BIN`/`ACME_BIN`, which
previously could name a bare (`$PATH`-searched) executable name and have
the OS resolve it at spawn time, can no longer do so through the seam --
and the failure mode is not a clean refusal but a silent fall-through to
resolving a *different* id's `$PATH` candidate, in one case spawning a
binary the user's override did not name. This is untested anywhere in the
suite (every existing test drives these env vars with an absolute path),
and no design document records the narrowing as an intentional trade-off.
Two further findings are lower-severity quality/consistency issues in
`host-tool.mts`'s `findSiblingBinary()`.

## Critical Issues

### CR-01: A bare, `$PATH`-relying `VICE_BIN`/`ACME_BIN` override is silently dropped, and can silently resolve to a *different* binary than the one named

**File:** `src/mcp/vice/tool-location.mts:572-585` (the seam's environment
layer), consumed by `src/mcp/vice/backend-detect.mts:401-419` (`resolvedBackend()`'s
PD-01 branch, now the ONLY path a real broker resolves `VICE_BIN` through)
and `src/mcp/vice/host-tool.mts:1395-1404` (the `acme.build` branch's
`resolveTool("acme", ...)` call, now the ONLY path `ACME_BIN` is resolved
through).

**Issue:** Before this phase, an env-var override for the emulator/ACME
binary was handed to `spawn()` (or, for `resolvedBackend()`'s own old
`defaultResolveBinPath()`) as a raw string. A bare name with no `/` -- e.g.
`VICE_BIN=x64sc-3.9` or `ACME_BIN=acme-dev`, meant to be resolved by the
OS's own `$PATH` search at exec time (`child_process.spawn()` performs this
automatically for a slash-free command; the OLD `resolvedBackend()` did its
own explicit `$PATH` walk over exactly that string too) -- worked.

The seam's environment layer (`tool-location.mts:576-585`) does not walk
`$PATH` for the environment layer at all. It calls `matchesDeclaredKind(envValue)`,
which for an executable-kind record is `statKind(candidate) === "file"` --
a direct `statSync()` on the literal env value. A slash-free value is
resolved by Node's `fs` functions relative to `process.cwd()`, never
against `$PATH`. For a real broker (a long-running daemon whose working
directory is not the directory containing the binary), this stat almost
always fails silently: the layer does not match (this is coded as "not
found, not refused" -- `tool-location.mts:572-575`'s own comment), and
resolution falls through to the next layer.

The fall-through is where this stops being a merely narrower feature and
becomes a silent misbehaviour: layer 3 (`$PATH`, `tool-location.mts:685-691`)
does **not** retry the user's env-var value -- it walks `$PATH` for the
*declared tool id itself* (`"x64sc"`, `"acme"`), which is a different
string than what the user wrote in `VICE_BIN`/`ACME_BIN`. Two outcomes are
both silent:

1. If a binary literally named `x64sc` (or `acme`) also happens to be on
   `$PATH`, the broker spawns **that** binary -- not the one the user's
   `VICE_BIN=x64sc-3.9` named -- with no warning, and `vice-broker.mts`'s own
   host-state/log line reports the substituted binary's resolved path as if
   it were what the override asked for.
2. If no plain `x64sc`/`acme` is on `$PATH` either, resolution reports
   `path: null` and the caller falls back to a bare `"x64sc"`/`"acme"`
   literal display value (`backend-detect.mts:372`, `binPathFields()`) --
   again silently discarding the override rather than refusing by name with
   the override's own value in the message.

This directly undercuts this phase's own stated purpose ("the precedence
order exists in exactly one place" -- `docs/phase59-tool-location-placement.md:44-52`)
for exactly the class of value real users are likely to set, and it is a
regression from the pre-Phase-60 behaviour for every caller that now routes
through the seam (`resolvedBackend()`, `acme.build`'s branch of
`buildHostToolArgv()`). No test anywhere in the diff (`tool-location.test.ts`,
`vice-broker-acquire.test.ts`, `host-tool.test.ts`, `backend-detect.test.ts`)
exercises a bare, slash-free value for `VICE_BIN`/`ACME_BIN` -- every fixture
uses an absolute path (`writeStubExecutable()`/`envStubPath` shapes), so
this gap is real and currently unguarded.

**Fix:** Either (a) widen the environment layer to fall back to a `$PATH`
search of the env value itself when it contains no `/` and does not stat
directly (mirroring `resolveOnPath()`'s own `bin.includes("/")` branch), or
(b) if the narrowing is intentional, make it a **refusal** rather than a
silent substitution: when an env var is set but does not resolve, `resolveTool()`
should not fall through to a `$PATH` probe for the bare declared id at all
-- it should stop and report why the named override could not be honoured,
the same terminal contract the file layer already has (D-09). Either fix
should ship with a test using a slash-free `VICE_BIN`/`ACME_BIN` value
resolved via an injected `PATH`.

## Warnings

### WR-01: `findSiblingBinary()` discards the seam's specific tools.json refusal reason for c1541/petcat, reporting a generic "does not exist"

**File:** `src/mcp/vice/host-tool.mts:2515-2528` (the seam-refusal branch),
surfaced at `src/mcp/vice/host-tool.mts:1725` (c1541) and `:1806` (petcat).

**Issue:** When a `tools.json` entry names `c1541`/`petcat` but fails the
seam's own file-layer check (wrong kind, missing executable bit, path does
not exist -- `tool-location.mts`'s `buildFileLayerRefusal()`), `resolveTool()`
returns a specific, actionable `refusal` string (e.g. "exists but is not
executable (missing the executable bit)"). `findSiblingBinary()` receives
this refusal, discards the text, and returns only `{ path: null, tried }`:

```ts
if (seamResolved.refusal) {
  const result = { path: null, tried };
  siblingBinaryMemo.set(binaryName, result);
  return result;
}
```

The caller then composes a generic `"c1541" does not exist (tried: ...)`
message plus the declared remedy -- which is the *missing-tool* remedy
("install VICE"), not helpful for a user who has VICE installed and simply
wrote a bad `tools.json` entry (e.g. forgot `chmod +x`). Every other
resolution site in this same file (`acme.build`, `ghidra.analyze`,
`ghidra.installExtension`) surfaces `resolveTool()`'s `refusal` field
verbatim; only `findSiblingBinary()`'s two callers lose it.

**Fix:** Change `findSiblingBinary()`'s return shape to carry the optional
`refusal` string through (mirroring `ResolveToolResult`), and have the
c1541/petcat branches in `buildHostToolArgv()` prefer it over the generic
"does not exist" sentence when present, the same way the acme/ghidra
branches already do.

### WR-02: `findSiblingBinary()`'s process-lifetime memo contradicts the seam's own "never cache a location" design rationale, and is inconsistent with `findAcmeLib()`'s no-memo posture

**File:** `src/mcp/vice/host-tool.mts:2482-2528` (`siblingBinaryMemo`,
`findSiblingBinary()`), compare `src/mcp/vice/host-tool.mts:2419-2436`
(`findAcmeLib()`, no memo).

**Issue:** `tool-location.mts`'s own module header is emphatic that the
seam "deliberately holds no memo... a future doctor built on top of this
seam must never report a tool's location as something it no longer is;
caching here would make a stale answer structurally possible, and no
result this module returns is worth that risk." Phase 60 now makes the
seam's `tools.json` layer -- explicitly the user-editable, "go fix this"
layer the whole phase exists to wire up -- reachable through two different
`host-tool.mts` call paths with two different caching postures:
`findAcmeLib()` (used for `acme-lib`) re-resolves fresh on every
`runHostTool()` call, while `findSiblingBinary()` (used for `c1541`/`petcat`)
wraps the SAME seam call in a `Map` keyed by binary name that persists for
the process's entire lifetime (confirmed intentional and tested: "Plan
60-04 Test 5 (memo semantics)" in `host-tool.test.ts` explicitly asserts
that editing `tools.json` between two calls in the same process has *no
effect* on the second call's result).

This is a real, working, deliberately-chosen behaviour (not a crash risk),
but it means the exact same class of fix a user is told to make --
"edit `.c64-re-tools/tools.json`" -- silently does nothing for `c1541`/`petcat`
until the broker process restarts, while working immediately for
`acme`/`acme-lib`/`ghidra`/`dxa`/`x64sc` (none of which are memoised this
way, or in `x64sc`'s case are memoised only alongside a documented
identity-cache invalidation path). A user who edits the file, re-runs a
`c1541.*`/`petcat.decode` call in the same long-running broker session, and
sees no change has no way to know from the tool's own behaviour that this
particular pair is special.

**Fix:** Either drop the per-process memo for the seam-sourced (tools.json
and env) branch of `findSiblingBinary()` and keep it only around the
sibling-probe/`$PATH` fallback (which is comparatively expensive and where
the original memo was added for), or document the c1541/petcat exception
in `tool-location.mts`'s own header alongside the two other named
exceptions (`node`, `dxa`), since it is otherwise easy to read that header
as an exhaustive list of what the seam's own no-memo guarantee does not
cover.

## Info

### IN-01: `resolvedBackend()`'s reported `viceBin` display name is always the literal `"x64sc"`, even when a `tools.json`/`VICE_BIN` layer answered

**File:** `src/mcp/vice/backend-detect.mts:404-419`.

**Issue:** In the PD-01 (seam) branch, `viceBin` is hardcoded to the
literal `"x64sc"` regardless of which layer resolved the path, and is used
only as the `binPathFields()` fallback display value when `resolvedPath` is
`null`. This is documented as deliberate ("the display name... stays the
literal 'x64sc' regardless of which layer answered -- that field is what a
caller reads as 'which file did you actually mean', not which layer
answered"), and the fallback in the resolved-path case is unreachable
(`binPathFields()` uses `resolvedPath` itself when non-null). Not a
functional defect -- noted only because a reader skimming this branch
without the comment could plausibly assume `viceBin` reflects the actually
resolved name.

---

_Reviewed: 2026-09-18T16:44:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
