# Phase 34: The Host-Tool Execution Seam - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 13 (create/modify), plus 2 grep-gate-scope helpers
**Analogs found:** 13 / 13

All analog paths below were verified as git-tracked source (`src/mcp/vice/*`, `scripts/*`, `src/skills/*`) — none are `.gsd`-mirrored or install-tree paths.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/host-tool.mts` (new, host-bound) | service (host-bound executor) | request-response, event-driven (child process) | `src/mcp/vice/broker-launch.mts` (spawn+supervise) + `src/mcp/vice/broker-kill.mts` (identity-checked kill) | role-match |
| `src/mcp/vice/host-tool.test.ts` (new) | test | unit | `src/mcp/vice/broker-control.test.ts` (narrowing-function unit tests) | role-match |
| `src/mcp/vice/broker-control.mts` (modified) | controller (control-plane dispatch) | request-response | itself — extend existing `handleLine()` chain and `normaliseLaunchProfile()` pattern | exact |
| `src/mcp/vice/broker-control.test.ts` (modified) | test | integration | itself — extend the two byte-exact `ControlRequestKind` tests | exact |
| `src/mcp/vice/vice-broker.mts` (modified) | provider (wiring host-bound module into control listener) | event-driven | itself — the `startControlListener()` call site wiring the seven `on*` callbacks (`:1135-1171`) | exact |
| `src/mcp/vice/vice-broker-client.ts` (modified/extended) | service (container-side client) | request-response | itself — `acquireOverControlPlane()` (`:381-500`), the short-lived connect/send/close pattern | exact |
| a Ghidra path-validation pure function (new module or added to `host-tool.mts`) | utility (pure validation/refusal) | transform | `broker-control.mts`'s `normaliseLaunchProfile()` (`:328-350`) — narrow-at-one-site, refuse-by-name discipline | role-match |
| Ghidra path-validation test (new `*.test.ts`) | test | unit | `broker-control.test.ts`'s `normaliseLaunchProfile()` unit tests | role-match |
| `src/skills/acme-build/scripts/acme.mjs` (modified) | utility (CLI skill script) | request-response (was file I/O + spawn) | itself — migrate `build()`'s `spawnSync("acme", args, …)` call (line 124) to go through the seam | exact |
| `src/skills/c64-program-recon/scripts/packer-finding.mjs` (modified) | utility (CLI skill script) | request-response (was file I/O + spawn) | itself — migrate `probeUnp64` (line 255) and `runUnp64` (line 314) `spawnSync` calls | exact |
| `scripts/check-no-skill-external-spawn.mjs` (new) | config/gate (structural test script) | batch (whole-tree scan) | `scripts/check-npm-packages.mjs`'s `packFiles()` (`:134-146`) for scope; `src/mcp/vice/spawn-seam.test.ts` for discovery-not-enumeration shape | role-match |
| `scripts/check-no-skill-external-spawn.test.ts` or equivalent (new) | test | structural | `src/mcp/vice/spawn-seam.test.ts` (`EXPECTED_EMULATOR_SPAWN_SITES` set-equality-both-directions pattern) | exact |
| a second prefix-floor test (extend `hostpath-consumers.test.ts` or new sibling file) | test | structural | `hostpath-consumers.test.ts`'s `annoProductionModules()` / `ANNO_MODULE_FLOOR` template (`:211-297`) | exact |
| `build.ts` / `tsconfig.build.json` (modified) | config | build | itself — `HOST_BOUND_ARTIFACTS` array (`build.ts:42-51`) and `include[]` (`tsconfig.build.json:9-18`) | exact |
| decision record for JVM lifetime (new doc) | config/doc | N/A | none in-repo — no existing decision-record analog was located; follow `.planning/RE-FINDINGS.md`-style prose cited in `broker-control.mts`'s own header | no analog |

## Pattern Assignments

### `src/mcp/vice/host-tool.mts` (new, host-bound service module)

**Analogs:** `src/mcp/vice/broker-kill.mts` (header convention, identity-checked kill discipline) and `src/mcp/vice/broker-launch.mts` (async `spawn`, header convention).

**Header comment convention** (mirror this shape — WHY the file exists / what it is the ONE authoritative place for / what NOT to do), quoted verbatim from `broker-kill.mts:1-16`:
```typescript
// broker-kill.mts
//
// D (complete, this plan -- 01.6.2-04): the identity-verified kill discipline,
// ported from resources/vice-broker.sh's signal_recorded_pid()/
// signal_vice_child_pid(): zero-signal liveness check, identity check against
// the process's own argument string, SIGTERM, poll-then-SIGKILL. The
// expected-identity string always comes from the instance record (the
// resolved binary path recorded at spawn time by broker-launch.mts), never a
// module constant -- this broker spawns the emulator directly and there is
// no intermediate supervising script for an identity check to match against.
// See this module's own history: ...
```
Apply the same shape to `host-tool.mts`: name the incident/decision that motivates it (SEAM-01..07), state what it is the ONE authoritative place for (typed per-tool allowlist + async spawn + digest — see `normaliseLaunchProfile()`'s own "THIS IS THE ONE PLACE" banner below), and name what NOT to do (no `spawnSync`, no argv passthrough, no shell string).

**Import-extension rule**, quoted from `broker-kill.mts:35-40`:
```typescript
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// TYPE-ONLY imports, deliberately -- this module is imported directly
// (unbuilt, native Node type-stripping) by its own test file and by
// broker-e2e.test.ts, exactly like broker-launch.mts already is (plan 02's
// finding: a VALUE import of a sibling ".mjs" specifier only resolves once
```
`host-tool.mts` must follow the same rule: any sibling host-bound module it imports (e.g. `broker-launch.mjs` types) must be a **type-only** import against the `.mjs` specifier, exactly as `broker-control.mts:32` does:
```typescript
import type { LaunchProfile } from "./broker-launch.mjs";
```

**Async-only spawn (never `spawnSync`)** — RESEARCH.md Pattern 3, `broker-kill.mts:367-374` (why this matters — the uncaught-exception handler kills the whole VICE pool):
```typescript
register("uncaughtException", (err: Error) => {
  log(`vice-broker: uncaught exception: ${err && err.message ? err.message : String(err)}`);
  run("uncaughtException", 1);
});
register("unhandledRejection", (reason: unknown) => {
  log(`vice-broker: unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  run("unhandledRejection", 1);
});
```

**Naming pitfall (from RESEARCH.md, Pitfall 1):** do NOT name the resolved tool-binary-path local variable `binPath` — `spawn-seam.test.ts`'s `EMULATOR_BIN_SHAPE` regex is `\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b` (bare identifier-name match, not value match) and will misclassify it as an emulator spawn site. Use `toolPath`, `ghidraPath`, `acmePath`, etc.

**`build.ts` requires the new module added to `HOST_BOUND_ARTIFACTS`** (`build.ts:42-51`, verbatim):
```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
  "backend-detect.mjs",
];
```
`build()`'s own assertion (`build.ts:190-203`) — must be updated in the same commit, or the build fails loudly:
```typescript
const emitted = emittedMjsFilesUnder(stagingDir);
const expected = [...HOST_BOUND_ARTIFACTS].sort();
const missing = expected.filter((f) => !emitted.includes(f));
const unexpected = emitted.filter((f) => !expected.includes(f));
if (missing.length > 0 || unexpected.length > 0) {
  throw new Error(
    "build: emitted file set does not match HOST_BOUND_ARTIFACTS.\n" +
      `  expected:   ${JSON.stringify(expected)}\n` +
      `  emitted:    ${JSON.stringify(emitted)}\n` +
      `  missing:    ${JSON.stringify(missing)}\n` +
      `  unexpected: ${JSON.stringify(unexpected)}`
  );
}
```
`tsconfig.build.json`'s `include[]` (verbatim, must gain `"host-tool.mts"` in the same commit):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": ".",
    "outDir": "resources",
    "allowImportingTsExtensions": false
  },
  "include": [
    "vice-broker.mts",
    "container-guard.mts",
    "broker-state.mts",
    "broker-launch.mts",
    "broker-kill.mts",
    "broker-epoch.mts",
    "broker-control.mts",
    "backend-detect.mts"
  ]
}
```
Both arrays are strictly parallel lists — `host-tool.mts` must be added to both, and `resources-sync.test.ts` (lines 97-126, per RESEARCH.md) additionally asserts the generated file names no bare non-`node:`, non-relative import specifier.

---

### `broker-control.mts` (modified — new control-op branch)

**Analog:** itself, extending the existing `handleLine()` dispatch and `normaliseLaunchProfile()` narrowing pattern.

**`ControlRequestKind` union, verbatim, with its own D-15 comment** (`broker-control.mts:39-44`) — the two byte-exact tests below trip on ANY addition, which is deliberate:
```typescript
// Phase 33, plan 33-06 (D-15): STILL SEVEN. The launch profile is an added
// FIELD on the existing `acquire` op, not an eighth op -- ControlRequest
// already carries an index signature, so an added field parses today with no
// schema change at all. Adding an eighth kind here would have meant a second
// acquire path to keep in sync with this one; there is deliberately only one.
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release";
```

**The two byte-exact tests that WILL go red** (this is expected — RESEARCH.md Pitfall 3, not a bug to route around):

`broker-control.test.ts:889-902`:
```typescript
test("no new control-plane message kind was added by 01.6.2.1-03's gap closure -- ControlRequestKind still has exactly its original five members plus plan 05's two monitor ops", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const match = source.match(/export type ControlRequestKind = ([^;]+);/);
  assert.ok(match, "ControlRequestKind's own type declaration must be found");
  assert.equal(
    match![1].trim(),
    '"acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release"',
    "the union must be exactly 01.6.2.1-03's original five members plus plan 05's monitor_claim/monitor_release",
  );
});
```

`broker-control.test.ts:1360-1376`:
```typescript
test("ControlRequestKind (33-06, D-15): still exactly seven members -- the launch profile is a FIELD on the existing acquire op, never an eighth op", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const match = /export type ControlRequestKind =([^;]*);/.exec(source);
  assert.ok(match, "ControlRequestKind's declaration must be findable in broker-control.mts");
  const members = match![1]
    .split("|")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter((s) => s !== "");
  assert.deepEqual(
    members,
    ["acquire", "release", "recycle", "status", "host_state", "monitor_claim", "monitor_release"],
    "the seven-op message set must be unchanged -- 33-06 adds a profile FIELD to `acquire`, not an eighth op",
  );
});
```
**Repair, not workaround:** update both tests' expected string in the same commit that adds the new member (or add a new FIELD to an existing op, per the Open Question in RESEARCH.md — the planner must decide which shape and edit these tests to match, in the same commit).

**Dispatch site (`handleLine()`'s if/else chain), exact line numbers at HEAD** (`broker-control.mts:698-812`), showing where a new branch is inserted — anywhere in this chain before the `"acquire"` branch's `attemptAcquire()` call is reached, and the new branch must NOT be composed from the seven VICE callbacks:
```typescript
} else if (req.op === "release") {
    ...                                                    // :698
} else if (req.op === "recycle") {
    const recycleId = ...                                  // :705-706
} else if (req.op === "status") {
    writeLine(socket, { kind: "status", instances: opts.onStatus() });   // :742-743
} else if (req.op === "host_state") {
    ...                                                    // :744
} else if (req.op === "monitor_claim") {
    ...                                                    // :757
} else if (req.op === "monitor_release") {
    ...                                                    // :794
} else {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: `unknown op: ${String(req.op)}` });  // :811-812
}
```
Token gate runs strictly before all of the above (`broker-control.mts:627-635`):
```typescript
const token = typeof req.token === "string" ? req.token : "";
if (!tokensMatch(token, opts.token)) {
  writeLine(socket, { kind: "error", code: "unauthorized" as ControlErrorCode, message: "missing or invalid control token" });
  socket.destroy();
  return;
}
```

**`normaliseLaunchProfile()` — the narrow-at-one-site precedent to mirror for the new op's typed allowlist** (`broker-control.mts:306-350`, header + signature):
```typescript
// THIS IS THE ONE PLACE `profile` IS NARROWED. Do not re-derive this check
// anywhere else -- not in vice-broker.mts, not in broker-launch.mts, not in
// the container-side client. A second copy is how one of them ends up
// accepting a shape the other refuses.
//
// WHY UNKNOWN KEYS ARE REFUSED BY NAME rather than dropped: a silently
// accepted typo means a caller asked for warp, got an unwarped instance, and
// received a confident success. ...
const LAUNCH_PROFILE_KEYS: readonly string[] = Object.freeze(["warp", "headless"]);
const LAUNCH_PROFILE_SHAPE = `an object with optional boolean keys ${LAUNCH_PROFILE_KEYS.join("/")}, or absent`;
export type NormaliseLaunchProfileResult = { ok: true; profile: LaunchProfile | undefined } | { ok: false; message: string };

export function normaliseLaunchProfile(raw: unknown): NormaliseLaunchProfileResult {
  if (raw === undefined || raw === null) return { ok: true, profile: undefined };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: `profile must be ${LAUNCH_PROFILE_SHAPE}; got ${JSON.stringify(raw) ?? String(raw)}` };
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  const unknownKeys = entries.filter(([key]) => !LAUNCH_PROFILE_KEYS.includes(key)).map(([key]) => key);
  if (unknownKeys.length > 0) {
    return { ok: false, message: `profile has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${LAUNCH_PROFILE_SHAPE}` };
  }
  // ... boolean-only value check per key, never coerced (e.g. "yes"/1 refused)
}
```
A per-tool allowlist for `host-tool.mts` should be the identical shape: one `Object.freeze([...])` accepted-keys list, refuse unknown tool names and unknown argument keys **by name**, never coerce, never drop silently.

**`StartControlListenerOptions`'s seven VICE callbacks** (`broker-control.mts:157-205`) — a new `onHostTool` callback must sit ALONGSIDE these, never derived from them:
```typescript
onAcquire: (requestId: string, profile?: LaunchProfile) => Promise<AcquireOutcome>;
onRelease: (requestId: string) => void;
onRecycle: (targetId: string) => Promise<RecycleOutcome>;
onStatus: () => StatusInstanceEntry[];
onHostState: () => HostStateFields;
onMonitorClaim: (requestId: string, targetId: string) => MonitorClaimOutcome;
onMonitorRelease: (requestId: string, targetId: string) => MonitorReleaseOutcome;
```
Wiring site for the real broker (`vice-broker.mts:1135-1171`, the object literal passed to `startControlListener()`) — a new `onHostTool` entry belongs there.

**64 KiB cap — the enforcement site to test against, not re-derive** (`broker-control.mts:266`, `broker-control.mts:474-480`):
```typescript
const MAX_LINE_BYTES = 65536;
...
socket.on("data", (chunk: Buffer) => {
  buffer += chunk.toString("utf8");
  if (Buffer.byteLength(buffer, "utf8") > MAX_LINE_BYTES) {
    socket.destroy();
    return;
  }
  ...
```
Commit the session's live 64 KiB probe transcript (RESEARCH.md Finding 1) as a real `broker-control.test.ts` case: dial `startControlListener()` directly, send >64 KiB unterminated, assert `close` fires with `hadError=false` and zero response bytes.

---

### `src/mcp/vice/vice-broker-client.ts` (container-side client route)

**Analog:** `acquireOverControlPlane()` (`vice-broker-client.ts:381-500`) — the short-lived connect/send/close pattern to mirror for a `host-tool` client function.

```typescript
export function acquireOverControlPlane(dir: string = brokerRootDir(), opts: AcquireProfileOptions = {}): Promise<AcquireOverControlPlaneHandle> {
  return new Promise((resolvePromise, reject) => {
    const broker = readJsonMaybe(brokerJsonPath(dir));
    if (broker === null) {
      reject(new Error("acquireOverControlPlane: broker.json not present or unreadable"));
      return;
    }
    const controlHost = typeof broker.control_host === "string" ? broker.control_host : null;
    const port = typeof broker.control_port === "number" ? broker.control_port : null;
    const token = typeof broker.control_token === "string" ? broker.control_token : null;
    ...
    const socket = connect({ host, port });
    let buffer = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`acquireOverControlPlane: no grant within ${CONTROL_ACQUIRE_TIMEOUT_MS}ms`));
    }, CONTROL_ACQUIRE_TIMEOUT_MS);
    if (typeof timer.unref === "function") timer.unref();

    socket.on("connect", () => {
      const requestId = newRequestId();
      socket.write(`${JSON.stringify({ op: "acquire", id: requestId, token, ...acquireProfileFragment(opts.profile) })}\n`);
    });

    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      const newlineIdx = buffer.indexOf("\n");
      if (newlineIdx === -1) return;
      const line = buffer.slice(0, newlineIdx);
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error("acquireOverControlPlane: malformed response line"));
        return;
      }
      ...
```
A new `hostToolOverControlPlane()` (or similarly named) function should follow this exact shape: read `broker.json` once, open one connection, write one JSON line, await one response line, reject (never throw synchronously) on every failure mode (unreadable broker.json, connection error, `error` response, timeout). Note: this is a **session-less, short-lived** connection — open/send/close, no lease held — matching SEAM-01's "consumes no emulator lease" requirement directly.

---

### Result-by-reference through `containerpath.ts` (SEAM-03)

**Analog:** `containerPath()` (`containerpath.ts:151-157`), the existing tested inverse-translation primitive — reuse directly, do not duplicate:
```typescript
export function containerPath(hostish: unknown): string {
  const { candidates, reason, raw } = containerPathCandidates(hostish);
  if (!candidates.length) {
    throw new Error(`${reason || `cannot determine a container path for ${String(raw)}`}\n  Or ${SET_ENV_HINT}`);
  }
  return candidates[0];
}
```
**Constraint:** `containerPathCandidates()` can only translate paths under `hostRootCandidates()`'s known roots (all derived from the bind-mounted workspace). Tool output MUST land inside the workspace tree (e.g. under `installTargetDir(root) = join(root, "tools")`, `install-resources.ts:91-93`) or `containerPath()` throws.

---

### Declared host-path consumer set — SEAM-06's second prefix floor template

**Analog:** `hostpath-consumers.test.ts` in full — quote its `EXPECTED_IMPORTERS` block **including** the "REVIEWED DECISION" header comment (`hostpath-consumers.test.ts:14-21, 144-149`):
```typescript
// Widening the five-member list below is a REVIEWED DECISION, not a
// mechanical fix for a failing test -- a new tool that genuinely needs
// host-path translation is rare (D-17's own table is exactly four tools,
// all long-lived emulator-side file operations) and each addition should be
// deliberate. A DERIVED module (anything registered in
// STOCK_DERIVED_TOOLS, stock-derived.ts) may NEVER be added to this list at
// all -- see stock-derived.ts's own header for why translating a
// client-side-derived path is exactly the bug DERIV-07's seam exists to
// prevent.
...
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];

test("hostpath.ts's production consumer set is exactly the five declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 5);
});
```
This new module family (`host-tool.mts` and any future `ghidra-*.ts`/`dxa-*.ts`) is deliberately **absent** from this five-member set — the family must NOT import `hostpath.ts` directly (mirrors the `anno-*.ts` family's own absence, asserted at `hostpath-consumers.test.ts` around the "named-absence" test for `anno-tools.ts` etc.). Use the same **named-absence-before-it-exists** pattern for `host-tool.mts` and its future siblings.

**`ANNO_MODULE_FLOOR` computation and scan — the template to copy for a second, separately-pinned floor** (`hostpath-consumers.test.ts:211-213, 238-244, 257-263, 287-297`):
```typescript
function annoProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^anno-.*\.ts$/.test(name));
}

// ... THE FLOOR MUST NEVER BE DERIVED FROM DISK, and this is the one number in this
// directory where that matters most. A floor computed from `readdirSync` at test
// time can never fail -- `disk.length >= disk.length` is a guard re-pointed to a
// subject that cannot fail ... Keep it a hand-pinned integer literal.
const ANNO_MODULE_FLOOR = 16 + 1;

test("the annotation module family ... is derived from disk with a non-vacuity floor, not a hard-coded list", () => {
  const modules = annoProductionModules();
  assert.ok(
    modules.length >= ANNO_MODULE_FLOOR,
    `expected >= ${ANNO_MODULE_FLOOR} anno-*.ts production modules on disk, found ${modules.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the absence assertion below pass trivially",
  );
});

test("... the hand-pinned annotation module floor equals the measured count ...", () => {
  const modules = annoProductionModules();
  assert.equal(
    modules.length,
    ANNO_MODULE_FLOOR,
    `ANNO_MODULE_FLOOR is pinned at ${ANNO_MODULE_FLOOR} but ${modules.length} anno-*.ts production modules are on ` +
      `disk (${modules.join(", ")}) -- the module set moved underneath the plan that pinned this number. Re-derive ` +
      "the floor deliberately, naming the plan that added or removed the module; do NOT adjust the literal to fit, " +
      "and never compute it from disk, which would make it unfailable.",
  );
});
```
And a real on-disk **positive control**, mirroring `anno-store.ts`'s role (`hostpath-consumers.test.ts` "INT-01's positive control" test): the new prefix floor needs at least one real, committed module matching its prefix (e.g. `host-tool.mts` itself, or a first `ghidra-*.ts`) so the floor names something real, not merely asserted to exist.

**NUL-byte grep pitfall (per orchestrator instructions):** any manual census over this directory must use `grep -a`, not plain `grep` — a source file in this tree contains a NUL byte that plain `grep` silently skips (this was not directly re-verified this session but is a standing project caution; do not rely on plain `grep` for any file-presence census here).

---

### Skill script migration: `src/skills/acme-build/scripts/acme.mjs`

**Current spawn site** (line 124, inside `build()`):
```javascript
const env = { ...process.env };
if (ACME_LIB.path) env.ACME = ACME_LIB.path;
const r = spawnSync("acme", args, { encoding: "utf8", env });
if (r.error) {
  die(r.error.code === "ENOENT"
    ? "install the ACME cross assembler and put `acme` on PATH"
    : String(r.error));
}
```
**Surrounding CLI contract:**
- argv parsing: `parseOpts(argv)` (lines 210-229) — flags `--json`, `--no-report`, `-o/--out`, `--out-dir`, `-f/--format`, `--setpc`, `-D`, `-I`, positional `src`.
- verb dispatch: `VERBS = { new: cmdNew, build: cmdBuild, sym: cmdSym }` (line 234), `process.argv.slice(2)`.
- output handling: `reportBuild(res, { json })` — either `console.log(JSON.stringify(res, null, 2))` (line 159) or human-readable diagnostics per line.
- exit codes: `process.exit(res.ok ? 0 : 1)` (`cmdBuild`, line 183); `die()` helper does `console.error` + `process.exit(1)` (line 36).
- The governing test that must stay green after migration (per RESEARCH.md Pitfall 4): `skill-acme-build-cli.test.ts` — spawns `acme.mjs` as a real subprocess and asserts stdout/exit code/produced `.prg` bytes.

**Migration scope:** replace the `spawnSync("acme", args, …)` call (and the `ACME_LIB` env-based library discovery it depends on) with a call through the new host-tool seam (`hostToolOverControlPlane`-style client), preserving `build()`'s return shape (`{ ok, prg, stem, diags, errors, symbols, labels, range, size }`) so `reportBuild()` and both `cmdBuild`/`cmdSym` verbs are unaffected. The CLI surface (`parseOpts`, `VERBS`, exit codes) must not change, per Pitfall 4.

---

### Skill script migration: `src/skills/c64-program-recon/scripts/packer-finding.mjs`

**Current spawn sites** — `probeUnp64` (line 255, `--version` probe):
```javascript
const probe = spawnSync(command, ["--version"], {
  encoding: "utf8",
  timeout: ORACLE_TIMEOUT_MS,
  shell: false,
  windowsHide: true,
});
```
and `runUnp64` (line 314, the real invocation):
```javascript
export function runUnp64(probe, filePath) {
  ...
  let scratch = null;
  try {
    scratch = mkdtempSync(join(tmpdir(), "packer-finding-"));
    const scratchOut = join(scratch, "unpacked.out");
    const run = spawnSync(probe.command, [filePath, scratchOut], {
      encoding: "utf8",
      timeout: ORACLE_TIMEOUT_MS,
      shell: false,
      windowsHide: true,
      maxBuffer: MAX_ORACLE_STDOUT_BYTES,
    });
    if (run.error) {
      return { ok: false, stdout: "", reason: "the oracle could not be run against the input file" };
    }
    return { ok: true, stdout: `${run.stdout ?? ""}`, reason: null };
  } catch {
    return { ok: false, stdout: "", reason: "a scratch directory for the oracle's output could not be created" };
  } finally {
    if (scratch !== null) { /* cleanup */ }
  }
}
```
**Surrounding contract to preserve:**
- `ORACLE_TIMEOUT_MS = 20_000` — the existing per-invocation timeout convention (RESEARCH.md's own DoS-mitigation citation).
- `MAX_ORACLE_STDOUT_BYTES = 64 * 1024` and `MAX_PACKER_NAME_LENGTH = 64` — caps to preserve or re-derive server-side.
- Both functions never throw — every failure returns `{ ok: false, reason }` / `{ available: false, reason }`. The seam's client wrapper must preserve this never-throw discretion for the skill script's callers.
- `ORACLE_ENV_VARS = ["UNP64", "UNP64_PATH"]` and `REQUIRE_ORACLE_ENV_VAR = "VICE_REQUIRE_UNP64"` — the existing opt-in/absent-vs-required convention; decide in the plan whether these move server-side (host-tool allowlist config) or stay client-side as a pre-check before calling the seam.
- Governing test to re-verify (per RESEARCH.md Assumption A4, `[ASSUMED]`, not confirmed this session): `skill-program-recon-cli.test.ts` — read it before finalizing the plan's verification step.

---

### Grep gate: `scripts/check-no-skill-external-spawn.mjs` (new)

**Analog for scope:** `packFiles()`, `scripts/check-npm-packages.mjs:134-146` — reuse this to get the exact post-sync tarball file list rather than re-implementing `npm pack --dry-run --json`:
```javascript
// EXPORTED (29-02): the removal gate (`scripts/check-no-<subject>.mjs`,
// named without its literal so this comment is not itself a subject mention)
// reuses this helper
// rather than re-implementing `npm pack --dry-run --json`, because THIS one
// runs the installer's `prepack` hook -- and therefore its skill-sync -- so
// the file list it returns is post-sync BY CONSTRUCTION. A re-implementation
// would have to remember to sync first; this cannot forget.
export function packFiles(dir) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const packed = {
    name: entry.name,
    version: entry.version,
    files: (entry.files ?? []).map((f) => f.path),
  };
  assertLeanTarball(packed);
  packedNames.push(packed.name);
  return packed;
}
```
Note the comment's own naming convention: the gate script name deliberately does not spell out the literal it bans in a re-quotable way in *this* comment ("named without its literal so this comment is not itself a subject mention") — apply the same discretion in the new gate's own header comment.

**Discovery-not-enumeration shape to mirror:** `spawn-seam.test.ts`'s `EXPECTED_EMULATOR_SPAWN_SITES` set-equality-in-both-directions pattern (`spawn-seam.test.ts:255-297`):
```typescript
const EXPECTED_EMULATOR_SPAWN_SITES: Readonly<Record<string, string>> = Object.freeze({
  "backend-detect.mts":
    "the --help probe -- probeBackend() runs one candidate flag against the resolved VICE binary to " +
    "classify it as the fork or stock upstream, argv array and shell:false, bounded by a timeout",
});

test("the discovered emulator spawn-site set equals EXPECTED_EMULATOR_SPAWN_SITES exactly, in both directions", () => {
  const discovered = discoverEmulatorSpawnSites().map((r) => r.file);
  const discoveredSet = new Set(discovered);
  const expectedFiles = Object.keys(EXPECTED_EMULATOR_SPAWN_SITES);
  const missing = expectedFiles.filter((f) => !discoveredSet.has(f));
  const extra = discovered.filter((f) => !(f in EXPECTED_EMULATOR_SPAWN_SITES));
  assert.deepEqual(missing, [], `expected emulator spawn site(s) not discovered -- ...: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `an emulator spawn site was discovered that is NOT in EXPECTED_EMULATOR_SPAWN_SITES -- ...: ${extra.join(", ")}`);
  assert.equal(Object.keys(EXPECTED_EMULATOR_SPAWN_SITES).length, 1, "EXPECTED_EMULATOR_SPAWN_SITES must have exactly one entry");
});
```
The new gate should discover `spawnSync`/`spawn`/`execFile`/`exec` calls naming an external binary (`acme`, `unp64`/oracle, `dxa`, Ghidra) across **whatever ships** (both `installer/` packed files, via `packFiles()`, and a direct `src/skills/**/scripts/*.mjs` walk for the plugin route), and assert the discovered set is EXACTLY EMPTY after migration (an ALLOWLIST of zero, not a frozen non-empty record like `spawn-seam.test.ts`'s emulator set — since after SEAM-05 no skill script should spawn directly at all).

**Overall gate-script shape (shebang, argv, failure message, exit code)** — mirror `scripts/check-npm-packages.mjs`'s driver bottom:
```javascript
if (errors.length) {
  console.error("check-npm-packages: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `check-npm-packages: OK\n` +
    `  ${vice.name}@${vice.version} -- ${vice.files.length} files\n` +
    `  ${inst.name}@${inst.version} -- ${inst.files.length} files, ${skillMds.length} skills`
);
```
And `#!/usr/bin/env node` shebang at the top, per house convention (`check-npm-packages.mjs:1`).

## Shared Patterns

### Async-only spawn, never `spawnSync`
**Source:** `broker-kill.mts:367-374` (uncaughtException/unhandledRejection kill-the-pool handler); RESEARCH.md Pattern 3.
**Apply to:** `host-tool.mts`'s tool invocation, and the migrated `acme.mjs`/`packer-finding.mjs` call sites once they route through the seam server-side.

### Typed narrowing at one site, refuse unknown keys by name
**Source:** `normaliseLaunchProfile()`, `broker-control.mts:328-350`.
**Apply to:** the new host-tool per-tool allowlist (SEAM-02), and the Ghidra dot-path refusal function (SEAM-04) — both are pure, never-throw, discriminated-result functions in the same shape.

### Result-by-reference through `containerpath.ts`
**Source:** `containerPath()`, `containerpath.ts:151-157`.
**Apply to:** every host-tool response's `path` field (SEAM-03) — reuse directly, never duplicate.

### `node:crypto` sha256 digesting
**Source:** RESEARCH.md's "Don't Hand-Roll" table — `createHash("sha256")`, already this project's convention throughout `evidence/`, `CAP-01`/`CAP-02`.
**Apply to:** `host-tool.mts`'s `{ path, sha256, byteLength }` result construction.

### Discovery-not-enumeration structural gates
**Source:** `spawn-seam.test.ts`'s `EXPECTED_EMULATOR_SPAWN_SITES` both-directions set-equality; `hostpath-consumers.test.ts`'s hand-pinned, disk-derived, non-vacuity-floor pattern.
**Apply to:** `scripts/check-no-skill-external-spawn.mjs`'s own test (SEAM-05) and the second prefix floor (SEAM-06).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| JVM lifetime decision record (SEAM-07) | doc/config | N/A | No existing decision-record file convention was located in-repo beyond narrative references inside code headers (e.g. `broker-control.mts`'s own citation of `.planning/RE-FINDINGS.md`); RESEARCH.md's own Open Question 2 flags this as needing a project-owner decision on where "recorded" persists. Follow the prose-record convention `broker-control.mts:16-19` cites (`.planning/RE-FINDINGS.md`-style) as the nearest shape, or use whatever this project's `/gsd-` decision-record tooling emits. |

## Metadata

**Analog search scope:** `src/mcp/vice/*.{ts,mts}`, `src/skills/{acme-build,c64-program-recon}/scripts/*.mjs`, `scripts/*.mjs`
**Files scanned (read in full or targeted-range):** `broker-control.mts`, `broker-control.test.ts`, `broker-kill.mts`, `broker-launch.mts`, `vice-broker-client.ts`, `containerpath.ts`, `hostpath-consumers.test.ts`, `build.ts`, `tsconfig.build.json`, `spawn-seam.test.ts`, `check-npm-packages.mjs`, `acme.mjs`, `packer-finding.mjs`
**Pattern extraction date:** 2026-09-03
