---
phase: 34-the-host-tool-execution-seam
reviewed: 2026-09-03T16:25:31Z
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
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-ram-capture/scripts/derive-transients.test.mjs
  - src/skills/c64-ram-capture/scripts/mcp-module.mjs
  - src/skills/c64-ram-capture/scripts/mcp-module.test.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs
findings:
  critical: 4
  warning: 2
  info: 0
  total: 6
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-09-03T16:25:31Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Phase 34 builds the host-tool execution seam: a new, allowlisted, host-side
child-process execution path (`host-tool.mts`/`resources/host-tool.mjs`)
reachable from container-side callers over `broker-control.mts`'s new
`host_tool` op, plus a Ghidra per-run project resolver
(`ghidra-project.mts`) and a whole-tree CI gate that forbids skill scripts
from spawning host binaries directly (`scripts/check-no-skill-external-spawn.mjs`).

The lease-isolation design (`host_tool` dispatched before, and never composed
from, any of the seven VICE lease callbacks) is sound and is proven by a real
spy-based end-to-end test. The dot-segment refusal in `ghidra-project.mts`
correctly walks every path segment (not just the leaf), matches the project's
own live-measured finding, and is thoroughly tested. The migrated skill
scripts (`acme.mjs`, `packer-finding.mjs`) correctly move their spawn sites
behind the seam and never fall back to a local spawn.

However, the allowlist that is supposed to be the whole point of this seam
has three separate places where an unvalidated, caller-supplied value reaches
either a spawn's executable path or its argv, in contradiction of the
module's own stated invariants ("argv is built ENTIRELY from typed fields...
never from a raw wire array or a raw wire string", "no wire-supplied path
becomes a real path" outside `resolveWorkspacePath()`). Two of these
(`oracle.probe`'s `command` override, and `ghidra.analyze`'s
`preScript`/`postScript`) let a container-side caller select what amounts to
an arbitrary host executable or script for the host-side broker process to
run, and the third (`acme.build`'s `includes`) lets a caller point the
assembler's include search path at an arbitrary host directory, all outside
the workspace-boundary check every other path argument goes through. In
addition, the host_tool round-trip timeout budget is broken for this phase's
own headline feature: `ghidra.analyze` cannot complete successfully through
the shipped, default-configured control-plane route at all, because both the
client-side and server-side timeouts are shorter than Ghidra's own
documented JVM startup cost.

## Critical Issues

### CR-01: `oracle.probe`'s `command` override lets a container-side caller execute an arbitrary host file, bypassing the allowlist entirely

**File:** `src/mcp/vice/host-tool.mts:757-778`
**Issue:**
`runOracleProbe()` accepts a caller-supplied `args.command` string and, once
`existsSync(command)` passes, spawns it directly as the executable:

```ts
const overridden = typeof args.command === "string" && args.command !== "";
const command = overridden ? (args.command as string) : DEFAULT_ORACLE_COMMAND;
...
const spawnResult = await spawnHostTool(command, ["--version"], timeoutMs);
```

There is no check that `command` names anything resembling `unp64`, no
extension check, and — critically — no `resolveWorkspacePath()`-style
boundary check. `command` is a raw, caller-chosen **host-absolute path**,
and any file on disk the broker process can read+execute will be spawned
with `["--version"]`. This directly contradicts the module's own claimed
design ("Matched by EXACT, case-sensitive ARRAY membership everywhere in
this module ... T-34-04") and its own comment on this very field ("34-04,
SEAM-05: no raw argv, no raw command string" — followed immediately by code
that is exactly a raw, unchecked command string).

This is also a trust-boundary regression introduced by the migration, not a
pre-existing risk merely relocated: before this phase, `packer-finding.mjs`
read `UNP64`/`UNP64_PATH` from the **container's own environment** and
executed the result **inside the container**, the same sandbox the calling
process already runs in. After migration, the identical caller-supplied
value is honored as a **host-absolute path** and executed by the **host**
broker process, a strictly more privileged execution context, with no added
validation for the new boundary it now crosses. A container-side actor that
can write a file into the shared bind-mounted workspace and knows (or can
derive, following this project's own `hostpath.ts` conventions) that file's
host-side absolute path can set `UNP64_PATH` to it and have the host broker
execute it — host code execution originating from container-side input.

**Fix:** Require `command` (when overridden) to resolve inside the
workspace via the same `resolveWorkspacePath()` boundary check every other
path argument uses, or — since the intent is "point at a different install
of the SAME named binary" — restrict it to naming a file whose `basename()`
equals `DEFAULT_ORACLE_COMMAND` (or one of a small allowlisted set of
basenames), never an arbitrary path:

```ts
if (overridden && basename(command) !== DEFAULT_ORACLE_COMMAND) {
  return { ok: true, tool: "oracle.probe", available: false, command: null, version: null,
    reason: "the configured oracle path's basename does not match the expected binary name" };
}
```

---

### CR-02: `ghidra.analyze`'s `preScript`/`postScript` reach `analyzeHeadless`'s argv completely unvalidated, contradicting this module's own documented invariant

**File:** `src/mcp/vice/host-tool.mts:434-441` (also see the false claim at `host-tool.mts:96-100`)
**Issue:**
`runHostTool()` passes `request.args.preScript`/`postScript` straight into
`buildAnalyzeHeadlessArgv()`'s `argvInput` with no resolution step at all:

```ts
if (args.preScript !== undefined) argvInput.preScript = args.preScript;
if (args.postScript !== undefined) argvInput.postScript = args.postScript;
```

Compare this to `importPath`, three lines above, which is only used after
`resolveWorkspacePath(repoRootAbs, request.args.importPath)` has bounded it
inside the workspace. `preScript`/`postScript` get no such treatment — they
are typed strings (`normaliseHostToolRequest` only checks
non-empty-string), and flow directly to `-preScript`/`-postScript` in
`analyzeHeadless`'s argv (`ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()`,
which re-checks the dot-segment rule on `projectLocation` but performs no
check whatsoever on `preScript`/`postScript`).

This directly contradicts this same file's own header comment, which
explicitly claims the opposite is true:

```
// `ghidra.analyze`'s accepted keys carry no raw argv array and no raw
// command string -- only `runId`/`importPath`/`preScript`/`postScript`,
// each a plain string that flows through resolveWorkspacePath()/
// resolveGhidraProject() before it ever reaches argv.
```
(`host-tool.mts:96-100`)

Ghidra's `-preScript`/`-postScript` name a script to run inside the
analysis session with full access to the opened program; depending on how
Ghidra resolves the name (a bundled/user script directory match, or a
literal filesystem path), a caller-chosen value here can select an
arbitrary existing script for the host-side JVM to execute. No test in
`host-tool.test.ts` or `ghidra-project.test.ts` exercises a path-escaping
or absolute `preScript`/`postScript` value — the gap is untested as well as
unvalidated.

**Fix:** Route `preScript`/`postScript` through the same
`resolveWorkspacePath()` call `importPath` already uses before they are
placed in `argvInput`, and correct the header comment to describe what the
code actually does (or make the code match the comment):

```ts
if (args.preScript !== undefined) {
  const r = resolveWorkspacePath(repoRootAbs, args.preScript);
  if (!r.ok) return { ok: false, message: r.message };
  argvInput.preScript = r.path;
}
```

---

### CR-03: `acme.build`'s `includes` array reaches `-I <dir>` unresolved, letting a caller point the assembler at an arbitrary host directory

**File:** `src/mcp/vice/host-tool.mts:400`
**Issue:**
`buildHostToolArgv()`'s `acme.build` branch resolves `source` and `outDir`
through `resolveWorkspacePath()`, but `includes` bypasses that entirely:

```ts
for (const include of args.includes ?? []) argv.push("-I", include);
```

Each `include` is a raw string straight from the wire request (validated
only as `Array<string>` by `normaliseHostToolRequest`), passed directly as
an ACME include-search-path argument with no workspace-boundary check. This
contradicts `buildHostToolArgv()`'s own documented contract ("argv is built
ENTIRELY from typed fields already narrowed... and paths already resolved
by `resolveWorkspacePath()` -- never from a raw wire array or a raw wire
string", `host-tool.mts:334-339`).

A caller that also controls the assembled source (workspace-bounded, but
content is never inspected) can request an `includes` entry naming an
arbitrary host directory (e.g. `/etc`, `/home/<user>`) and use ACME's
`!source`/include-resolution machinery to pull bytes from files in that
directory into the build's diagnostics or output — turning a
container-scoped actor into one that can read host files outside the
bind-mounted workspace, which is exactly the boundary SEAM-01/A-03 exist to
hold.

**Fix:** Resolve each `includes` entry through `resolveWorkspacePath()`
alongside `source`/`outDir`, and refuse the whole request if any entry
escapes:

```ts
const resolvedIncludes: string[] = [];
for (const include of request.args.includes ?? []) {
  const r = resolveWorkspacePath(repoRootAbs, include);
  if (!r.ok) return { ok: false, message: r.message };
  resolvedIncludes.push(r.path);
}
```
and thread `resolvedIncludes` into `buildHostToolArgv()`'s resolved-paths
parameter instead of `args.includes` directly.

---

### CR-04: `ghidra.analyze` cannot complete successfully through the shipped control-plane route — the timeout budget is shorter than Ghidra's own documented startup cost

**File:** `src/mcp/vice/host-tool-client.ts:132-138`, `src/mcp/vice/host-tool.mts:462,690`, `src/mcp/vice/vice-broker.mts:1167-1171`
**Issue:**
Two independent timeouts bound a `host_tool` request over the container
route, and both are too short for `ghidra.analyze`:

1. **Client-side, 5 seconds.** `hostToolOverControlPlane()` starts a single
   timer at call time and only clears it once the response line arrives:
   ```ts
   const timer = setTimeout(() => {
     ...
     reject(new Error(`hostToolOverControlPlane: no response within ${CONTROL_CONNECT_TIMEOUT_MS}ms`));
   }, CONTROL_CONNECT_TIMEOUT_MS);
   ```
   `CONTROL_CONNECT_TIMEOUT_MS` is `5000` (`vice-broker-client.ts:546`) and,
   by that constant's own header comment, is meant to bound "a TCP connect
   over the docker bridge" — elsewhere in this same codebase
   (`openBrokerControl()`, `vice-broker-client.ts:1147-1163`) it is used
   correctly, cleared in `onConnect()` before a *separate*, larger
   request-deadline timer takes over. `hostToolOverControlPlane()` instead
   reuses it to bound the entire round trip including the spawned tool's
   own execution time.
2. **Server-side, 20 seconds, and not overridable.** `runHostTool()`
   defaults to `DEFAULT_HOST_TOOL_TIMEOUT_MS = 20_000`
   (`host-tool.mts:462,690`), and the real broker's wiring
   (`vice-broker.mts:1167-1171`) never supplies a `timeoutMs`, so every
   `host_tool` call — including `ghidra.analyze` — runs under this fixed
   20-second ceiling with no way for a caller to ask for more (no
   `timeoutMs` field exists anywhere in the wire request shape or in
   `HOST_TOOL_ARG_KEYS`).

This project's own decision record for this exact tool
(`docs/phase34-host-tool-seam-decisions.md`, Part 1) states Ghidra's JVM
startup alone measures **12.6–17.4 seconds**, before any analysis work
begins, and that real analysis runs can take multiple minutes. Given that:
the client-side 5-second bound will reject essentially every real
`ghidra.analyze` call before the host side even finishes launching the JVM,
and even if that bound were removed, the server-side 20-second default
would SIGKILL the child during JVM startup, before `-import`/analysis ever
runs. No test in `host-tool.test.ts` exercises a slow ghidra.analyze
invocation over the control-plane route (`withFakeGhidraHome()`'s fake
`analyzeHeadless` exits immediately), so this is untested as well as
broken.

**Fix:** Give `hostToolOverControlPlane()` its own request-deadline timer
distinct from `CONTROL_CONNECT_TIMEOUT_MS` (mirroring
`openBrokerControl()`'s own connect-timer/request-timer split), and make
the server-side timeout per-tool (or wire-supplied and capped), with a
default for `ghidra.analyze` that comfortably exceeds the documented
12.6–17.4 s JVM-startup cost plus a realistic analysis budget.

## Warnings

### WR-01: `check-no-skill-external-spawn.mjs`'s call-site detector can be evaded by aliasing the spawn function

**File:** `scripts/check-no-skill-external-spawn.mjs:270-304`
**Issue:** `findArgvCallSites()`/`findShellCallSites()` match a call site by
requiring the literal identifier `spawnSync`/`spawn`/`execFileSync`/
`execFile`/`execSync`/`exec` to appear directly before the opening `(`:

```js
const scanRe = new RegExp(`\\b(${ARGV_SPAWN_NAMES.join("|")})\\s*\\(\\s*`, "g");
```

A future skill script that aliases the spawn function first —
`const run = spawnSync; run("acme", [...]);`, a destructuring rename
(`const { spawnSync: run } = require("node:child_process")`), or
bracket-notation (`cp["spawn"]("acme", [...])`) — calls a banned binary
without the literal name `spawnSync`/`spawn`/etc. ever appearing adjacent to
the call parenthesis, so it is invisible to this gate. `A-11`'s stated goal
("the discovered violation set is EXACTLY EMPTY... with deliberately NO
allowlist") depends on this predicate being airtight; it currently is not,
and `skill-external-spawn-gate.test.ts` has no planted-violation case for
any aliasing shape.

**Fix:** Additionally resolve a bare identifier call site
(`run("acme", ...)`) back to its own declaration (the same
`resolvesToInterpreter()`/`resolvedBannedName()` machinery already used for
the *first argument*, applied instead to the *called function name*) before
concluding a site is not a spawn call, or at minimum add a planted-violation
test naming this gap so it is a documented limitation rather than a silent
one.

### WR-02: `host_tool` has no admission control — an unbounded number of concurrent host-side child processes (including JVMs) can be requested with no lease, no queue, and no ceiling

**File:** `src/mcp/vice/broker-control.mts:672-690`, `src/mcp/vice/host-tool.mts:637-737`
**Issue:** Unlike `acquire` (bounded by `maxInstances`/the warm floor and an
arrival-ordered pending queue), `host_tool` requests are dispatched
immediately and unconditionally to `onHostTool()` for any connection holding
the shared control token — there is no per-broker ceiling on how many
`host_tool` invocations may run concurrently. A caller (or several
concurrent callers sharing the same token) can issue many overlapping
`ghidra.analyze` requests, each spawning a full JVM (`analyzeHeadless`), or
many overlapping `acme.build`/`oracle.run` requests, with nothing in this
module bounding concurrent host resource use beyond the per-request
20-second timeout (itself the subject of CR-04). This is in scope as
"unbounded resource use" per this review's stated priorities, distinct from
general performance concerns.
**Fix:** Track in-flight `host_tool` invocations per broker process and
reject (with a distinguishable `bad_request`/new error code) once a
configurable ceiling is reached, mirroring the existing `at_capacity`
vocabulary the `acquire` path already has.

---

_Reviewed: 2026-09-03T16:25:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
