# Phase 18: Persistent Session and Tool Surface - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 10 (7 modified, 1 new production module, 2 new/extended test files)
**Analogs found:** 10 / 10 (all files have at least a role-match or exact analog already inside this repo — CONTEXT.md/RESEARCH.md deliberately reuse existing seams rather than introducing new architecture)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/r2000-session.ts` (NEW) | service (process lifecycle owner) | event-driven + request-response | `src/mcp/vice/broker-launch.mts` (`tryLaunchOne`/`acquirePortAndLaunch`) | role-match (same single-owner launch-guard shape, different resource: child process vs. TCP port) |
| `src/mcp/vice/r2000-mcp-client.ts` (extend) | service (transport/protocol seam) | request-response (stdio JSON-RPC) | itself — extend `withR2000Session()` in place | exact (same file, new sibling export) |
| `src/mcp/vice/r2000-tools.ts` (modify `runR2000Tool`, `assertCuratedTool`, tool tables) | controller (tool dispatch) | CRUD (mutating) / request-response (reads) | itself — extend `runR2000Tool()`'s existing `r2000_save_project` special-case dispatch | exact |
| `src/mcp/vice/r2000-project.ts` (extend) | utility (settings synthesiser → generalise to read-patch-write) | file-I/O (transform) | itself — `synthesizeProject()`'s forced-settings convention | exact (shape-only reuse; no literal function to extract, see Pitfall 1 below) |
| `src/mcp/vice/vice-proxy.ts` (extend `onTeardown`) | controller (process entry point / teardown) | event-driven | itself — `onTeardown()`/`releaseLeaseNow()` | exact |
| `src/mcp/vice/r2000-spawn-seam.test.ts` (extend fixture) | test (structural guard) | batch (static scan) | itself | exact |
| `src/mcp/vice/r2000-tools.test.ts` (extend count pin) | test | batch | itself | exact |
| `src/mcp/vice/vice-proxy.test.ts` (fix undeclared "17" drift, lines 533, 594, 858) | test | batch | itself | exact |
| `src/mcp/vice/r2000-session.test.ts` (NEW) | test (integration, live-preferred) | event-driven + request-response | `src/mcp/vice/r2000-mcp-client.test.ts` (`STUB_SOURCE`/`STUB_MODE` harness) + `src/mcp/vice/r2000-test-gate.ts` (live/skip gate) | exact (explicitly named by RESEARCH.md as the harness to reuse) |
| Restart-budget error class (new, ~5 lines) | model (error type) | — | `src/mcp/vice/r2000-mcp-client.ts`'s existing `R2000*Error` taxonomy (e.g. `R2000ChildExitError`) | exact |

## Pattern Assignments

### `src/mcp/vice/r2000-session.ts` (NEW — service, event-driven)

**Analog:** `src/mcp/vice/broker-launch.mts`

**Single-owner synchronous check-and-set** (`broker-launch.mts:372-380`, verified verbatim this session):
```typescript
export function tryLaunchOne(reason: string, port: number, deps: TryLaunchDeps): InstanceRecord | null {
  if (inFlight) return null;
  inFlight = true;
  try {
    return spawnAndRecordInstance(reason, port, deps);
  } finally {
    inFlight = false;
  }
}
```
The load-bearing property (per CLAUDE.md's pinned Rule A11) is **zero `await` between the check and the set** — a `Promise`-based mutex whose check-then-set can itself interleave defeats the guarantee. `r2000-session.ts`'s acquire path (D18-20) must reproduce this exact synchronous shape.

For the wider guard spanning an async sequence (port allocation → launch), the same module's `acquirePortAndLaunch()` (`broker-launch.mts:445-454`) shows the pattern extended across an `await`:
```typescript
export async function acquirePortAndLaunch(reason: string, deps: AcquirePortAndLaunchDeps): Promise<AcquireLaunchResult> {
  const log = deps.log ?? defaultLog;
  if (inFlight) {
    log(`vice-broker: launch-slot decision -- ${inFlightReason ?? "unknown"} holds the slot; ${reason} waits (D-07)`);
    return { ok: false, reason: "launch_in_flight" };
  }
  inFlight = true;
  inFlightReason = reason;
  try {
    const portResult = await deps.allocatePort(deps.state);
```
This is the shape D18-15/D18-18's coarse mutex should mirror: the synchronous flag is set **before** the first `await` (spawn or the settings-forcing read), and the critical section (mutating call + its own save, per D18-18) stays inside the `try` before the flag resets in `finally`.

**What NOT to port from this analog:** `broker-state.mts`'s persisted identity/lease file, and `broker-kill.mts`'s PID+argv identity-verified kill. D18-20/D18-21 explicitly reject both — there is no cross-process ownership question here (single child, direct child of the proxy), and kill-by-retained-`ChildProcess`-handle makes the identity check structurally unreachable rather than skipped. Do not copy `broker-kill.mts`'s verification code; only cite it in comments as "why this repo normally verifies kills, and why this session doesn't need to."

**Never spawn directly** — `r2000-session.ts` must call into `r2000-mcp-client.ts`'s new export rather than calling `spawn()`/`spawnSync()` itself, or `r2000-spawn-seam.test.ts`'s `EXPECTED_R2000_SPAWN_SITES` set-equality guard (below) fails.

---

### `src/mcp/vice/r2000-mcp-client.ts` (extend — service, request-response)

**Analog:** itself (in-place extension beside `withR2000Session()`)

**Extension point** (`r2000-mcp-client.ts:322-334`, current signature):
```typescript
export async function withR2000Session<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>,
  opts: WithR2000SessionOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_R2000_CALL_TIMEOUT_MS;
  const bin = opts.bin ?? process.env.R2000_BIN ?? "regenerator2000";
  const argv = opts.argv ?? buildMcpServerStdioArgs({ projectPath });
  assertNoViceFlag(argv);

  const child = spawn(bin, argv, { stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;

  await waitForSpawn(child);
```
The new long-lived primitive needs the identical `spawn(bin, argv, ...)` call, the identical `assertNoViceFlag(argv)` guard placement (before spawn), and the identical `waitForSpawn()` helper.

**Named error classes to reuse unchanged** (`r2000-mcp-client.ts:101-240`, full bodies read this session):
```typescript
export class R2000ClientError extends Error {
  constructor(message: string, { cause }: R2000ClientErrorOptions = {}) {
    super(message);
    this.name = "R2000ClientError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class R2000ChildExitError extends R2000ClientError {
  exitCode: number | null;
  stderr: string;
  constructor(message: string, { exitCode, stderr, ...rest }: R2000ChildExitErrorOptions) {
    super(message, rest);
    this.name = "R2000ChildExitError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}
```
`R2000ChildExitError` is the class SESS-02's "dead mid-call"/D18-12's fail-loud path resolve to. `R2000SessionFailedError` and `R2000SaveNotPersistedError` (same file, same shape) are likewise reused unchanged.

**One new error class needed** (D18-14's exhausted-restart-budget case). Follow the exact constructor pattern above — extend `R2000ClientError`, carry a dedicated public field (never buried in message text only), e.g.:
```typescript
export interface R2000RestartBudgetExhaustedErrorOptions extends R2000ClientErrorOptions {
  crashCount: number;
  limit: number;
}
export class R2000RestartBudgetExhaustedError extends R2000ClientError {
  crashCount: number;
  limit: number;
  constructor(message: string, { crashCount, limit, ...rest }: R2000RestartBudgetExhaustedErrorOptions) {
    super(message, rest);
    this.name = "R2000RestartBudgetExhaustedError";
    this.crashCount = crashCount;
    this.limit = limit;
  }
}
```

**Header prose to correct in the same change** (D18-07/D18-36 step 6) — the now-false lines, `r2000-mcp-client.ts:42-46`:
```
Never keep a child alive between logical operations (D-17). The lifecycle
is spawn -> initialize -> call(s) -> (optional save) -> stdin close ->
exit, once per `withR2000Session()` call. There is no long-lived child,
no supervision, and no second wedge class to add to this project's
existing stock-VICE one.
```
Must be rewritten to describe both primitives (one-shot `withR2000Session()` for CLI verbs, the new long-lived export for `r2000_*` MCP tool calls) and name the D-17/D-18 reversal.

---

### `src/mcp/vice/r2000-tools.ts` (modify — controller, CRUD/request-response)

**Analog:** itself — extend the existing `r2000_save_project` special-case dispatch inside `runR2000Tool()`

**Save-then-hold sequencing to preserve byte-for-byte** (`r2000-tools.ts:900-910`, quoted in full):
```typescript
    // A mutating tool (including r2000_batch_execute, whose own inner calls
    // all run inside this SAME session per regenerator2000's own
    // batch_execute implementation): call, then save PLAINLY (no hash
    // verification -- see the block comment above), before the session
    // exits.
    const result = await withR2000Session(projectPath, async (call) => {
      const callResult = await call(name, rest);
      await call("r2000_save_project", {});
      return callResult;
    });
```
The rewrite replaces `withR2000Session(projectPath, async (call) => {...})` with the equivalent call against the new session primitive — the **body** (call, then plain save) must not move or change (D18-08).

**Allow-list gate two new tools must pass through** (`r2000-tools.ts:656-673`):
```typescript
export function assertCuratedTool(name: string, args?: unknown): void {
  if (name === "r2000_get_address_details") {
    throw new R2000UncuratedToolError(ADDRESS_DETAILS_REFUSAL, { toolName: name });
  }
  if (!CURATED_R2000_TOOLS.includes(name)) {
    throw new R2000UncuratedToolError(
      `"${name}" is not part of the curated r2000_* tool surface. Resolution routes: implement it and ` +
        "add it to R2000_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
      { toolName: name },
    );
  }
  if (name === "r2000_set_label_name") {
    assertLegalLabelArg(args);
  }
  if (name === "r2000_batch_execute") {
    assertCuratedBatch(args);
  }
}
```
D18-27 requires the **first `if` block deleted** (the D-32 refusal). `r2000_get_address_details` gets a **new entry** in `R2000_TOOL_DEFINITIONS`/`CURATED_R2000_TOOLS` whose composition happens in `runR2000Tool()`, mirroring the existing `r2000_save_project` special-case-before-generic-dispatch idiom (RESEARCH.md Open Question 1's recommendation).

**Refusal text superseded** (`r2000-tools.ts:148-156`, verbatim so the replacement decision can cite the exact upstream issue it retires):
```typescript
const ADDRESS_DETAILS_REFUSAL =
  "r2000_get_address_details is not on the curated r2000_* surface (D-32): on a full 64K project " +
  "(exactly what c64-ram-capture produces) it returns {\"type\":\"OutOfRange\"} for EVERY address, " +
  "because handler.rs:1894's `raw_data.len() as u16` wraps 65536 to 0. Filed upstream as " +
  "https://github.com/ricardoquesada/regenerator2000/issues/42. ...";
```
D18-30 requires the plan to allocate the next project-wide `D-nn` and state it supersedes D-32.

**Read-only classification set** (`r2000-tools.ts:851-858`):
```typescript
const READ_ONLY_R2000_TOOLS: ReadonlySet<string> = new Set([
  "r2000_get_symbols", "r2000_get_comments", "r2000_get_blocks",
  "r2000_get_cross_references", "r2000_search_disassembly", "r2000_get_binary_info",
]);
```
`r2000_read_region` belongs in this set (plain read); `r2000_get_address_details`'s membership is a documentation/consistency choice only, since its composed dispatch may bypass this branch entirely (D18-28's one-code-path rule).

---

### `src/mcp/vice/r2000-project.ts` (extend — utility, file-I/O transform)

**Analog:** itself — `synthesizeProject()`'s forced-settings convention (shape-only; **no literal function to extract** — see Pitfall below)

**Forced-values convention to reproduce identically in a new function** (`r2000-project.ts:71-75`, `140-146`):
```typescript
export const R2000_SYSTEM_C64 = "Commodore 64";
...
  const project = {
    origin,
    raw_data_base64,
    blocks: [] as unknown[],
    settings: {
      // Forced true, never configurable -- see the function doc comment
      // above and D-05. Do not add a parameter that overrides this.
      use_illegal_opcodes: true,
      // Always written explicitly, never omitted -- see the function doc
      // comment above and D-05/Phase 9's .vsf finding.
      system,
    },
  };
```

**PITFALL — do not treat this as extractable.** `synthesizeProject()` (`r2000-project.ts:121-150`, full body read this session) only ever **builds a brand-new project object from raw bytes** (`gzipSync(bytes).toString("base64")`) — there is no `readFileSync`/`JSON.parse` of an *existing* file anywhere in this module. D18-32/D18-33's "ensure settings" function (`ensureProjectSettings(projectPath): void` or similar) must be written new: (1) read the existing `.regen2000proj` bytes, (2) `JSON.parse`, (3) check/force `settings.use_illegal_opcodes === true` (silent) and refuse on a `settings.system` mismatch (D18-34, named refusal — follow this file's existing `throw new Error(...)`-with-embedded-values convention, e.g. the `origin` range-check at the top of `synthesizeProject()`), (4) rewrite the file. Share only the *values* (`true`, and the literal `Commodore 64` via `R2000_SYSTEM_C64`), not code, with `synthesizeProject()`.

---

### `src/mcp/vice/vice-proxy.ts` (extend `onTeardown` — controller, event-driven)

**Analog:** itself — `onTeardown()`/`releaseLeaseNow()`, the mechanically-guarded teardown region (`vice-proxy.ts:3145-3179`, full region quoted):
```typescript
// TEARDOWN-REGION-BEGIN -- vice-proxy.test.mjs's source assertion slices
// the file between this marker and its closing counterpart further below,
// and asserts that slice contains no promise-awaiting construct and calls
// the control session's release function exactly once. Do not move either
// marker away from the code each one bounds.
let teardownRan = false;

function releaseLeaseNow(trigger: string): void {
  if (!controlSession) return;
  controlSession.release().catch((err: unknown) => {
    console.error(`vice-proxy: lease_release_failed trigger=${trigger}: ${err && (err as Error).message ? (err as Error).message : err}`);
  });
}

function onTeardown(trigger: string): void {
  if (teardownRan) return; // idempotent -- SIGINT then SIGTERM ~100ms later both call in
  teardownRan = true;
  releaseLeaseNow(trigger);
}

process.stdin.on("end", () => onTeardown("stdin_end"));
process.stdin.on("close", () => onTeardown("stdin_close"));
process.on("SIGINT", () => onTeardown("SIGINT"));
process.on("SIGTERM", () => onTeardown("SIGTERM"));
process.on("SIGHUP", () => onTeardown("SIGHUP"));
// TEARDOWN-REGION-END
```
**Structural constraint (do not violate):** a committed test (`vice-proxy.test.ts:2550-2577`) slices exactly this marked region and asserts `assert.doesNotMatch(region, /\bawait\b/)`, `/\.then\s*\(/`, `/\basync\s+function\b|\basync\s*\(/`, plus exactly one `controlSession.release()` call-site. D18-22's r2000-session kill call must therefore be **fire-and-forget-synchronous** — model it on `releaseLeaseNow()`'s own `.catch(...)`-not-`await`ed shape, or better, a genuinely synchronous `child.kill("SIGKILL")` (mirrors `killAfter()`'s own synchronous kill call at `r2000-mcp-client.ts:525`). Do not add `await`, `.then(`, or `async function` anywhere inside the marked region.

---

### `src/mcp/vice/r2000-spawn-seam.test.ts` (extend fixture — test, structural scan)

**Analog:** itself — `EXPECTED_R2000_SPAWN_SITES` (`r2000-spawn-seam.test.ts:302-305`):
```typescript
const EXPECTED_R2000_SPAWN_SITES: Readonly<Record<string, string>> = Object.freeze({
  "r2000-launch.ts": "sync CLI seam -- runR2000()'s blocking spawnSync",
  "r2000-mcp-client.ts": "async MCP session -- withR2000Session()'s long-lived spawn",
});
```
`r2000-session.ts` must contain **zero** matches of the file's own spawn-call discovery regex (`spawnSync|spawn|execFileSync|execFile|exec` called with a regenerator2000-binary-shaped argument) — add a session-reuse live-transcript fixture proving the long-lived path still calls `assertNoViceFlag()` before spawning, but do **not** add a third entry to this map; the map stays at two sites (D18-02).

---

### `src/mcp/vice/r2000-tools.test.ts` (extend count pin — test, batch)

**Analog:** itself (`r2000-tools.test.ts:45-66`, current list/count):
```typescript
const EXPECTED_CURATED_NAMES = [
  "r2000_set_label_name", "r2000_set_comment", "r2000_set_data_type", "r2000_add_scope",
  "r2000_get_symbols", "r2000_get_comments", "r2000_get_blocks", "r2000_get_cross_references",
  "r2000_search_disassembly", "r2000_disassemble", "r2000_get_binary_info",
  "r2000_create_project_enum", "r2000_update_project_enum", "r2000_delete_project_enum",
  "r2000_apply_enum_usage", "r2000_save_project", "r2000_batch_execute",
];

test("CURATED_R2000_TOOLS has exactly 17 members, matching the plan's objective table (set-equality, both directions)", () => {
  assert.equal(CURATED_R2000_TOOLS.length, 17, `expected exactly 17 curated tools, got ${CURATED_R2000_TOOLS.length}`);
```
Add `r2000_read_region` and `r2000_get_address_details` to the array; change both literal `17`s (assertion value and message string) to `19`; update the test title text (also says "17").

---

### `src/mcp/vice/vice-proxy.test.ts` (fix undeclared drift — test, batch)

**Analog:** itself — three literal "17" prose sites not in CONTEXT.md's touched-file list, found by RESEARCH.md this session: `vice-proxy.test.ts:533` (comment), `:594` (comment), `:858` (assertion-failure message string inside `assert.deepEqual`). The assertions themselves already derive from `CURATED_R2000_TOOLS.length`/`...CURATED_R2000_TOOLS` dynamically and will not fail — only the prose lies once the count moves to 19. Update all three literal occurrences from "17" to "19". Verify with `grep -n "17 curated" src/mcp/vice/*.ts` returning zero hits after the change.

---

### `src/mcp/vice/r2000-session.test.ts` (NEW — integration, live-preferred)

**Analog 1 (stub harness to reuse):** `src/mcp/vice/r2000-mcp-client.test.ts`'s `STUB_SOURCE`/`STUB_MODE` (lines 127-168+, excerpt):
```javascript
const STUB_SOURCE = `
import { createInterface } from "node:readline";
const MODE = process.env.STUB_MODE || "happy";
const rl = createInterface({ input: process.stdin, terminal: false });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === "initialize") { send({ jsonrpc: "2.0", id: msg.id, result: { ... } }); return; }
  if (msg.method === "tools/call") {
    if (MODE === "never-answers-call") return; // (b): swallow forever, no response
    if (MODE === "exit-mid-call") { process.exit(0); } // (c): die before answering
    if (MODE === "exit-with-stderr") { process.stderr.write("...\\n"); process.exit(3); }
    ...
  }
});
`;
```
Extend `STUB_MODE`'s set with whatever new scenarios D18-09/D18-10/D18-11/D18-19's planted-violation tests need (e.g. a mode that exits cleanly between calls but not mid-call, to exercise D18-11's transparent-respawn path; a mode that stalls exactly one call to exercise the mutex/queue).

**Analog 2 (live/skip gate seam):** `src/mcp/vice/r2000-test-gate.ts` (full header + `probeR2000()`/`R2000_AVAILABLE`, lines 1-56, quoted above in required reading):
```typescript
export const R2000_BIN: string = process.env.R2000_BIN ?? "regenerator2000";

export function probeR2000(): boolean {
  const r = spawnSync(R2000_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (r.error) return false;
  const banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return /regenerator2000/i.test(banner);
}

export const R2000_AVAILABLE: boolean = probeR2000();
```
`r2000-session.test.ts` must import `skipReasonFor`/`assertR2000RequiredIfEnvSet` from this module (not re-derive a probe), exactly as `r2000-tools.test.ts`'s existing gated integration test does (lines 468-559 of that file). This module is TEST-ONLY — never add it to `package.json`'s `files[]`.

---

## Shared Patterns

### Single-owner synchronous check-and-set (Rule A11)
**Source:** `src/mcp/vice/broker-launch.mts:372-380` (`tryLaunchOne`)
**Apply to:** `r2000-session.ts`'s acquire/launch path (D18-20) and its coarse mutex (D18-15/D18-18).
**Rule:** zero `await` between the boolean check and the boolean set. A `Promise`-chain mutex is acceptable for the *queueing* shape (FIFO, per D18-17) but the *guard itself* (is a launch or a critical section already in flight) must be the synchronous flag idiom above, not a promise whose check-then-set can interleave.

### Named, distinguishable error taxonomy
**Source:** `src/mcp/vice/r2000-mcp-client.ts:101-240` (`R2000ClientError` and its six subclasses)
**Apply to:** all of SESS-02/SESS-03/SESS-04's failure surfacing. Reuse `R2000ChildExitError`, `R2000SessionFailedError`, `R2000SaveNotPersistedError`, `R2000TimeoutError` unchanged; add exactly one new subclass (`R2000RestartBudgetExhaustedError` or similar) following the identical constructor pattern (dedicated public fields, never message-text-only).

### Save-then-hold, never save-then-defer
**Source:** `src/mcp/vice/r2000-tools.ts:900-910`
**Apply to:** the rewired `runR2000Tool()` call site — the `call(name, rest)` → `call("r2000_save_project", {})` sequence body must not move, only what wraps it (session-reuse instead of session-per-call) changes (D18-08).

### Teardown-region structural constraint
**Source:** `src/mcp/vice/vice-proxy.ts:3145-3179` + `vice-proxy.test.ts:2550-2577`
**Apply to:** D18-22's clean-exit hook. No `await`/`.then(`/`async function` inside `TEARDOWN-REGION-BEGIN`/`END`; kill the session synchronously (mirror `killAfter()`'s `child.kill("SIGKILL")`, `r2000-mcp-client.ts:525`), never attempt an awaited graceful close there.

### Live-vs-stub test gating (D-11 convention)
**Source:** `src/mcp/vice/r2000-test-gate.ts` + `src/mcp/vice/r2000-mcp-client.test.ts`'s `STUB_SOURCE`
**Apply to:** `r2000-session.test.ts` (new) — stub harness for protocol-shape/error-classification assertions; live gate (`skipReasonFor`/`assertR2000RequiredIfEnvSet`) for the claims this phase makes about the real binary (stdin-EOF exit behaviour, session-reuse spawn transcript, save-survives-SIGKILL).

## No Analog Found

None — every file in scope has at least a role-match analog already in this repo (this phase is explicitly designed by CONTEXT.md/RESEARCH.md to port existing patterns rather than invent new ones). The two genuinely new pieces of logic (the settings read-patch-write function in `r2000-project.ts`, and the restart-budget error class) are *shape*-analogs only — see the Pitfall notes above for why no literal function/class can be extracted rather than newly written.

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts` (all read or targeted-read this session; no broader `Glob`/`Grep` sweep was needed since CONTEXT.md/RESEARCH.md already named every pattern source file explicitly).
**Files scanned:** 10 target files + 7 named pattern-source files (`r2000-mcp-client.ts`, `r2000-tools.ts`, `r2000-project.ts`, `broker-launch.mts`, `vice-proxy.ts`, `vice.ts`, `r2000-test-gate.ts`, `r2000-mcp-client.test.ts`, `r2000-spawn-seam.test.ts`, `r2000-tools.test.ts`) — all excerpts above verified by direct read this session (line numbers current as of 2026-08-24; treat a mismatch at implementation time as drift to re-verify, per this repo's own convention).
**Pattern extraction date:** 2026-08-24
