# Phase 42: The Text-Format Parsers and Their Two-Binary Fixtures - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 15 new (5 parser modules + 5 test files + 1 probe module + 1 probe test + 1 structural-test extension + `TEXT_COMMAND_ALLOWLIST` widening), 1 modified (`text-protocol.ts`)
**Analogs found:** 6 / 6 named targets (all four RESEARCH.md-named analogs read in full or targeted; two additional supporting analogs found for D-42-1/D-42-2)

No CONTEXT.md exists for this phase; the file list below is taken from RESEARCH.md's "Recommended Project Structure" and "Wave 0 Gaps" sections, since no CONTEXT.md decisions/discretion sections exist to cross-check against.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `textmon-memmap.ts` | utility (pure parser) | transform | `disasm-decoder.ts` | exact (shape), **partial on error discipline — see caveat below** |
| `textmon-profile.ts` | utility (pure parser) | transform | `disasm-decoder.ts` | exact (shape) |
| `textmon-cpuhistory.ts` | utility (pure parser) | transform | `disasm-decoder.ts` | exact (shape) |
| `textmon-backtrace.ts` | utility (pure parser) | transform | `disasm-decoder.ts` | exact (shape) |
| `textmon-registers.ts` | utility (pure parser) | transform | `disasm-decoder.ts` | exact (shape) |
| `textmon-memmap.test.ts` (+4 siblings) | test | transform | `textmon-fixtures.test.ts` (fixture-loading pattern) + `disasm-decoder.test.ts` (assertion shape, not read this session — not required, `loadTextFixture` usage is the load-bearing excerpt) | exact (fixture loading), role-match (assertions) |
| PARSE-04 capability-probe module (e.g. `text-capability-probe.ts`) | utility (probe + memoised cache) | request-response (in-process) | `findSiblingBinary()` in `host-tool.mts` (memoisation) + `resolvedBackend()` in `backend-detect.mts` (stock/fork identity + its own memo) | role-match |
| PARSE-04 probe test file | test | — | `hostpath-consumers.test.ts`'s pinned-floor/named-absence pattern (for the cache-key shape, not the probe logic itself) | partial |
| structural single-owning-module test | test (structural/enforcement) | — | `hostpath-consumers.test.ts` (`ANNO_MODULE_FLOOR`/`HOST_TOOL_FAMILY_FLOOR` family-floor pattern, `DERIVED_TOOL_MODULES` named-map pattern, named-absence-before-existence pattern) | exact |
| `text-protocol.ts` (modified: `TEXT_COMMAND_ALLOWLIST` parameterization) | config / transport (existing file) | request-response | itself — read in full, excerpts below | exact (this is the file being extended, not analogized) |
| five new MCP tool registrations (`vice_memmap_show` etc., names per A2) | route / dispatch entries | request-response | `vice_device_console`/`vice_warp_set` in `text-tools.ts` + `stock-derived.ts` + `stock-dispatch.ts` | exact |

## Pattern Assignments

### `textmon-memmap.ts` / `textmon-profile.ts` / `textmon-cpuhistory.ts` / `textmon-backtrace.ts` / `textmon-registers.ts` (utility, transform)

**Analog:** `src/mcp/vice/disasm-decoder.ts` (272 lines, full file read)

**Shape to copy verbatim:**

1. **Single exported pure function**, no class, no `node:` builtin import, only sibling in-repo imports (`disasm-decoder.ts:44`, its only import is `./disasm-opcodes.ts`):
```typescript
import { OPCODES, type AddressingMode } from "./disasm-opcodes.ts";
```
For the five new modules the equivalent is: **no import at all**, or at most a shared types/constants sibling if one is factored out — never `text-protocol.ts`, never `node:net`, never anything transport-side. RESEARCH.md's own diagram is explicit: "pure function: no socket, no timing, no channel-lock, no lease."

2. **A closed union type for structured notes/results**, not a free string (`disasm-decoder.ts:51`):
```typescript
export type DisasmNote = "nmos-page-wrap" | "truncated" | "acme-unassemblable" | "illegal-opcode";
```
Each `textmon-*.ts` module should define its own closed result-shape interface(s) this way (e.g. an `AccessMap` entry with `read`/`write`/`execute: boolean` fields per column, not a free-string glyph).

3. **Argument-narrowing predicates, declared locally, not imported** (`disasm-decoder.ts:94-117`):
```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
```
The file's own comment at `disasm-decoder.ts:90-93` states this predicate is "repeated per file, never centrally imported" — that is this module tree's established convention, not an oversight to fix.

4. **The bounded, single-`while`-loop, cursor-advancing parse loop** (`disasm-decoder.ts:148-272`) — every iteration consumes at least one line/entry, no recursion. For the five text formats this maps to "one iteration per output line" (or per fixed-width record for `chis`/`bt`/`prof flat`, or per `>C:` hex row for `io`'s register dump).

**CRITICAL CAVEAT — error-handling discipline does NOT transfer as-is:**

`disasm-decoder.ts` is documented to **never throw** (`decode()`'s own doc comment, line 142-146: "Never throws — malformed input ... returns `[]` ... never wrapping ... and returning a plausible-looking but wrong listing"). It signals problems through the closed `DisasmNote` union embedded in each result item, never an exception.

RESEARCH.md's own "Pattern 1" illustrative example (a `TextParseError extends Error`, thrown on an unrecognised glyph) is explicitly **not** this repo's existing precedent — RESEARCH.md itself labels that example "illustrative shape, not verbatim source — no such module exists yet in this repo" (`42-RESEARCH.md` Pattern 1 code block). PARSE-03's own success criterion 4 ("a drifted format fails loudly instead of returning an inverted answer") is the actual functional requirement driving this, and a thrown, named error is one legitimate way to satisfy "fails loudly" — but it is a **deliberate divergence from `disasm-decoder.ts`'s own never-throw discipline**, not a continuation of it. The planner/executor must decide explicitly (and should record the decision, e.g. in a plan's own header comment) whether the five `textmon-*.ts` modules throw a named `TextParseError`-style class on an unrecognised value (RESEARCH.md's suggested shape) or instead return a discriminated-union result (`{ ok: true, ...} | { ok: false, reason, offendingLine }`) matching `disasm-decoder.ts`'s own never-throw convention more closely. Either is defensible; silently assuming `disasm-decoder.ts`'s pattern extends to "never throw, ever" would contradict PARSE-03's explicit refusal requirement, since a `DisasmNote`-shaped mechanism has no slot for "I do not understand this input at all" — only "I understood it and it looks unusual."

**Test file pattern — `textmon-fixtures.test.ts`-style fixture loading** (analog: `src/mcp/vice/textmon-fixtures.ts`, 209 lines, full file read; the loader itself, reused directly, not re-derived):
```typescript
// Source: src/mcp/vice/textmon-fixtures.ts (already committed)
import { loadTextFixture } from "./textmon-fixtures.ts";

const stockFixture = loadTextFixture("access-map-stock");
const forkFixture = loadTextFixture("access-map-fork");
// stockFixture.text     -- UTF-8 convenience string
// stockFixture.buffer   -- authoritative bytes (needed for flat-profile's U+202F separators)
// stockFixture.provenance -- { capturedFrom, viceVersion, capturedAt, command, synthetic }
// stockFixture.synthetic === false -- real hardware capture, not hand-written
```
`loadTextFixture(caseName, { dir })` throws `MissingTextFixtureError` (named class, `textmon-fixtures.ts:65-75`) naming the expected path and the regenerating command (`node .planning/phases/39-.../evidence/fixture-capture.mjs`) when a fixture or its sidecar is absent/malformed/missing a provenance key. **Do not hand-roll a second loader or a second sidecar-key check** — `textmon-fixtures.ts`'s own header comment states this file is "the ONE place any test in this package loads a text-monitor capture's provenance sidecar."

Case names available today (`fixtures/textmon/`, both `-stock` and `-fork` variants of each): `access-map`, `flat-profile`, `cpu-history`, `backtrace`, `register-decode`, `connect-banner` (zero-byte).

**`U+202F` byte-exact caveat for `textmon-profile.ts` specifically:** use `stockFixture.buffer`, not `.text`, if the parser needs byte-exact control over the thousands separator — though per RESEARCH.md, `TextMonitorClient` itself already UTF-8-decodes the live-wire response exactly once (`text-protocol.ts:523`, `#finishPending()`), so on the real wire path the parser always receives a proper JS string with `U+202F` intact; the buffer-vs-string distinction matters only for fixture-loading test code, not the parser's own runtime input type (which should be `string`, matching what `TextMonitorClient.command()` resolves to).

---

### `text-protocol.ts` (modified — `TEXT_COMMAND_ALLOWLIST` parameterization, D-42-1)

**This file is the analog for itself** — read in full relevant part this session. Exact current state to extend, not replace:

**Imports** (`text-protocol.ts:56-59`):
```typescript
import { EventEmitter } from "node:events";
import net from "node:net";
import { ViceError } from "./vice.ts";
import { acquireChannelLock, currentChannelLockHolder } from "./channel-lock.ts";
```

**The allowlist to widen** (`text-protocol.ts:90-99`):
```typescript
export const TEXT_COMMAND_ALLOWLIST = Object.freeze([
  "device c:",
  "warp on",
  "warp off",
  "memmapshow",
  "prof flat",
  "chis",
  "bt",
  "io",
] as const);

export type TextCommand = (typeof TEXT_COMMAND_ALLOWLIST)[number];

export function isAllowlistedTextCommand(cmd: string): cmd is TextCommand {
  return (TEXT_COMMAND_ALLOWLIST as readonly string[]).includes(cmd);
}
```
D-42-1 locks that parameter validation stays here, not in the five parser modules — the file's own header comment already states the security rule this must not violate (`text-protocol.ts:44-49`): "Never accept a caller-supplied, free-text command string anywhere in this module's public surface. VICE's text monitor accepts arbitrary monitor commands and is UNAUTHENTICATED." Widening `isAllowlistedTextCommand()` from exact-literal membership to a per-verb validator function (accepting `"chis 4"`, `"prof flat 5"`, `"io $d020"`-shaped strings only within a bounded/typed domain, then still building the final command from validated parts) is the change RESEARCH.md Open Question 1 flags as needing an explicit design — no prior phase recorded one.

**The refusal-before-any-byte-reaches-the-socket ordering to preserve** (`command()`, `text-protocol.ts:373-397`):
```typescript
command(cmd: string, _opts: TextCommandOptions = {}): Promise<string> {
  if (FORBIDDEN_COMMAND_CHARS_RE.test(cmd)) {
    return Promise.reject(
      new ViceError(`text-protocol: refusing command ${JSON.stringify(cmd)} containing a CR, LF, or C0 control character`),
    );
  }
  if (!isAllowlistedTextCommand(cmd)) {
    return Promise.reject(
      new ViceError(
        `text-protocol: refusing non-allowlisted command ${JSON.stringify(cmd)} -- every outbound text-monitor ` +
          `command must come from TEXT_COMMAND_ALLOWLIST (D-01)`,
      ),
    );
  }
  // ... channel-lock-holder check, connection-state checks ...
}
```
`FORBIDDEN_COMMAND_CHARS_RE` (`text-protocol.ts:132`, exact excerpt):
```typescript
const FORBIDDEN_COMMAND_CHARS_RE = /[\r\n\x00-\x1f]/;
```
`TEXT_MAX_BUFFERED_LEN` (`text-protocol.ts:162`, the transport-level DoS cap this phase's parsers must NOT re-implement on top of):
```typescript
export const TEXT_MAX_BUFFERED_LEN = 4 * 1024 * 1024;
```

**No existing per-verb-validator or discriminated-dispatch analog was found in `stock-dispatch.ts` or `manifest-arg-compat.ts`** for this specific "widen a frozen literal-string allowlist to accept bounded parameters" shape — both files were checked (`stock-dispatch.ts` grep for `withDerivedTool`/`STOCK_DERIVED_TOOLS`; `manifest-arg-compat.ts` not found under this name in `src/mcp/vice/` — confirm the file exists before citing it further, RESEARCH.md's reference may itself be approximate). `handleWarpSet()` (`text-tools.ts:175-195`) is the closest thing this repo has to a per-argument-validated-then-branch-to-a-fixed-literal pattern, shown below — it validates a boolean and selects between exactly two frozen literals, never string-building a parameterized command. This is a smaller-scope precedent than what `chis`/`prof flat`/`io` need (which require validating an unbounded-looking numeric/hex domain, not a binary choice), but it is the closest real analog in this tree; **report this as a partial-match gap** rather than pretend a closer one exists.

---

### Five new MCP tool registrations (`vice_memmap_show`, `vice_prof_flat`, `vice_chis`, `vice_bt`, `vice_io_registers` — names per RESEARCH.md's A2, not locked)

**Analog:** `handleDeviceConsole()` / `handleWarpSet()` in `src/mcp/vice/text-tools.ts` (195 lines, full file read) + their registration in `stock-derived.ts` + `stock-dispatch.ts`.

**The `withTextTool()` wrapper every new handler must call through** (`text-tools.ts:86-138`, exact — lease resolution, `textConnect()`, `withTextChannelLock()`, always-tear-down `finally`):
```typescript
async function withTextTool(
  toolName: string,
  deps: StockDispatchDeps,
  fn: (client: TextMonitorClient) => Promise<StockToolResult>,
): Promise<StockToolResult> {
  const leaseOutcome = await deps.ensureLease();
  if (!leaseOutcome.ok) {
    return isErrorText(leaseOutcome.message);
  }
  const lease = leaseOutcome.lease;
  if (lease === null) {
    return isErrorText(
      `${toolName}: VICE_MCP_URL is set, so there is no broker-managed instance and no broker control session to ` +
        `claim the text-monitor socket through -- unset VICE_MCP_URL to use the on-demand broker, or connect to a ` +
        `broker-managed instance directly.`,
    );
  }
  let session;
  try {
    session = await textConnect({
      host: lease.host,
      remoteMonitorPort: lease.remoteMonitorPort,
      targetId: lease.targetId,
      brokerControl: lease.brokerControl,
    });
  } catch (err) {
    if (err instanceof MonitorOwnershipError) return convertHandshakeError(toolName, err);
    return convertWireError(toolName, err);
  }
  try {
    return await withTextChannelLock(toolName, () => fn(session.client), { timeoutMs: deps.channelLockTimeoutMs });
  } catch (err) {
    if (err instanceof ChannelLockTimeoutError) return isErrorText(err.message);
    return convertWireError(toolName, err);
  } finally {
    try {
      await textDisconnect(session);
    } catch (releaseErr) {
      console.error(`${toolName}: textDisconnect after use did not complete: ${String(releaseErr)}`);
    }
  }
}
```

**A concrete handler to copy the shape of** — `handleDeviceConsole()` (no-argument case, `text-tools.ts:153-161`) and `handleWarpSet()` (validated-argument case, `text-tools.ts:175-195`):
```typescript
export async function handleDeviceConsole(_args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  return withTextTool("vice_device_console", deps, async (client) => {
    const response = await client.command("device c:");
    return derivedAnswer({ response, note: "default device (memspace) reset to the main CPU" });
  });
}

export async function handleWarpSet(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const enabled = args.enabled;
  if (typeof enabled !== "boolean") {
    return isErrorText(
      `vice_warp_set: "enabled" must be a boolean (got ${JSON.stringify(enabled)}) -- refusing before any ` +
        `text-monitor byte is written`,
    );
  }
  const command = enabled ? "warp on" : "warp off";
  return withTextTool("vice_warp_set", deps, async (client) => {
    const response = await client.command(command);
    return derivedAnswer({ requested: enabled, response, note: "..." });
  });
}
```
The new handlers' bodies must additionally call the relevant `textmon-*.ts::parse()` on `response` before building `derivedAnswer(...)`, turning the raw framed string into the typed structure the tool actually returns.

**Registration — `STOCK_DERIVED_TOOLS` entry** (`stock-derived.ts:117-118`):
```typescript
"vice_device_console", // Plan 41-06, CHAN-03 -- text-channel remedy tool, needsSession:false (text-tools.ts)
"vice_warp_set", // Plan 41-06, CHAN-03 -- text-channel remedy tool, needsSession:false (text-tools.ts)
```

**Registration — `stock-dispatch.ts` dispatch table** (`stock-dispatch.ts:830-831`):
```typescript
vice_device_console: withDerivedTool("vice_device_console", { needsSession: false }, handleDeviceConsole),
vice_warp_set: withDerivedTool("vice_warp_set", { needsSession: false }, handleWarpSet),
```
`needsSession: false` is required, not optional, for every one of the five new tools — `text-tools.ts`'s own header comment explains why (`needsSession: true` wraps the whole handler in `withChannelLockHeld()`'s binary-channel mutex; a text handler calling `withTextChannelLock()` from inside that would be a second, non-reentrant `acquireChannelLock()` call on the same stack — a de facto deadlock expiring only after `CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS`, 630s by default).

**Registration — `hostpath-consumers.test.ts`'s `DERIVED_TOOL_MODULES` map** (`hostpath-consumers.test.ts:642-658`, must add five entries mapping each new tool name to whichever module implements its handler — likely `text-tools.ts` again, or a new sibling if the planner splits handlers out):
```typescript
const DERIVED_TOOL_MODULES: Record<string, string> = {
  // ...existing entries...
  vice_device_console: "text-tools.ts",
  vice_warp_set: "text-tools.ts",
};
```
This map is asserted (`hostpath-consumers.test.ts:660-670`) to have exactly the same key set as `STOCK_DERIVED_TOOLS`, and every named module file is asserted to exist on disk — a new derived tool with no matching entry here fails that test rather than silently escaping the closed-consumer-set discipline. **Every one of the five new tool names must be added here in the same task that registers them**, or `D-05-12`'s test goes red.

---

### PARSE-03's structural single-owning-module enforcement

**Analog:** `src/mcp/vice/hostpath-consumers.test.ts` (684 lines, full file read) — three separable mechanisms, all reusable:

**1. Family-floor pattern** (`ANNO_MODULE_FLOOR`, `hostpath-consumers.test.ts:310`; `HOST_TOOL_FAMILY_FLOOR`, `:496`) — a hand-pinned integer literal, never derived from disk, paired with a companion test asserting the pinned number equals the measured count:
```typescript
// derivation helper, reused verbatim (already exists, do not re-derive):
function topLevelProductionModules(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

// family filter, per-prefix (the pattern to copy for `textmon-`):
function annoProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^anno-.*\.ts$/.test(name));
}

const ANNO_MODULE_FLOOR = 17 + 2 + 1 + 1 - 1; // hand-pinned, RAISED never lowered, arithmetic shows provenance

test("... floor, not a hard-coded list ...", () => {
  const modules = annoProductionModules();
  assert.ok(modules.length >= ANNO_MODULE_FLOOR, `expected >= ${ANNO_MODULE_FLOOR} ... found ${modules.length}`);
});

test("MCP-05: the hand-pinned ... floor equals the measured count -- a same-wave change ... fails HERE ...", () => {
  const modules = annoProductionModules();
  assert.equal(modules.length, ANNO_MODULE_FLOOR, `... Re-derive the floor deliberately, naming the plan ...`);
});
```
A third such family floor, for `/^textmon-.*\.ts$/`, is the direct precedent named in RESEARCH.md's own guidance — pinned at 5 (the five parser modules) once they all land, with the same "raised never lowered" / "pinned equals measured" pairing.

**2. Named-absence-before-existence pattern** (`hostpath-consumers.test.ts:207-212`, exact):
```typescript
test("every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists", () => {
  const importers = hostpathImporters();
  for (const name of ["anno-tools.ts", "anno-derive.ts", "anno-details.ts", "anno-register.ts", "anno-cli.ts"]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});
```
The PARSE-03-equivalent version: name the five `textmon-*.ts` modules (and, if the design calls for it, assert something like "no module other than `textmon-memmap.ts` and `textmon-memmap.test.ts` contains the substring `memmapshow`" or similar) before they exist, so the constraint is testable pre-implementation.

**3. Declared-map + existence + non-membership pattern** (`DERIVED_TOOL_MODULES`, `hostpath-consumers.test.ts:642-683`) — see the tool-registration section above; the same three-test group (key-set-equals, filenames-exist-on-disk, distinct-modules-excluded-from-some-consumer-set) is the shape to adapt for "exactly one owning module per text-monitor command."

**A simpler, cheaper alternative RESEARCH.md itself flags** (`42-RESEARCH.md`, "Existing seam patterns... single-seam enforcement" section, final paragraph): rather than a full family-floor apparatus, a smaller structural test asserting "the only files importing `textmon-fixtures.ts` (or receiving a `TextMonitorClient.command()` return value) for `<command>` are `textmon-<command>.ts` and its own test file" may be sufficient and cheaper — this is a real design choice RESEARCH.md leaves to the planner, not a settled recommendation.

**On `anno-store.ts`'s single-`node:sqlite`-consumer discipline being asserted by a possibly different mechanism:** grepped for `node:sqlite` across `hostpath-consumers.test.ts` and found no reference — this file's own enforcement machinery targets `hostpath.ts` consumers and the `STOCK_DERIVED_TOOLS` map specifically, not a `node:sqlite` import census. **No second mechanism was found in the files read this session; report this as an open item for the planner to grep for directly (e.g. `grep -rn "node:sqlite" src/mcp/vice/*.test.ts`) rather than assume one exists**, since RESEARCH.md's phrasing ("check whether... is asserted by a different mechanism") anticipates this may need a fresh look outside this pattern-mapping pass's scope.

**4. Planted-violation control pattern** (`hostpath-consumers.test.ts:383-392`, `:572-580`, not excerpted verbatim here for space — both construct a synthetic source string that DOES violate the rule and assert the shared predicate catches it). Pair this with the "unrecognised-value refusal" control below — they are two different controls (one for the closed-consumer-set structural rule, one for the parser's own refusal-on-unrecognised-enum-value behavior) and both are needed per PARSE-03's four clauses.

---

### PARSE-03's "unrecognised value refuses loudly" control

**Analog:** `text-protocol.test.ts:229-269` ("Control 2 (planted RED, without the fix)" / "Control 2 (fixed, GREEN)") — **not read in full this session** (only cited by RESEARCH.md); if the executor needs the exact excerpt, read `text-protocol.test.ts` lines 229-269 directly before writing the new controls. The shape RESEARCH.md describes: construct a synthetic fixture text carrying a value VICE has never emitted (e.g. a `memmapshow` line using `z` instead of `r`/`w`/`x`/`-`), assert the real parser refuses (throws or returns the discriminated `ok: false` shape — see the CRITICAL CAVEAT above) on it, paired with a second assertion that every real committed fixture parses without refusal — proving the control is discriminating rather than passing vacuously.

---

### PARSE-04's per-command, per-binary build-capability probe (D-42-2)

**Analog 1 — per-process memoisation shape:** `findSiblingBinary()` in `src/mcp/vice/host-tool.mts` (exact excerpt, `host-tool.mts:2263-2312`):
```typescript
/** Memoised per binary name for the process lifetime ... A `null` (not
 * found) answer is memoised too ... */
const siblingBinaryMemo = new Map<string, { path: string | null; tried: string[] }>();

function findSiblingBinary(binaryName: string, resolvedX64scPath: string, log?: (line: string) => void): { path: string | null; tried: string[] } {
  const memoised = siblingBinaryMemo.get(binaryName);
  if (memoised) return memoised;
  // ... resolve, then siblingBinaryMemo.set(binaryName, result); return result; ...
}
```
For PARSE-04, the same shape applies with the cache keyed by `stock|fork:<resolved absolute path>` (D-42-2) rather than by binary name alone, e.g.:
```typescript
const capabilityMemo = new Map<string, Map<string, boolean>>(); // key: "stock:/usr/bin/x64sc" -> command -> capable
```

**Analog 2 — deriving the `stock:`/`fork:` key itself:** `resolvedBackend()` in `src/mcp/vice/backend-detect.mts` already resolves and memoises `{ backend: "stock" | "fork", binPath: string, binPathResolved: boolean }` at module scope (`backend-detect.mts:396` `memoisedResult`, `:452` `resolvedBackend()`). This is the existing seam to build the cache key FROM — do not re-derive backend identity independently. A second, narrower precedent for the literal key-string SHAPE (not the resolution mechanism) is `probe-binmon.mjs:2320` (test/tooling script, not shipped runtime code, but shows the established string format):
```javascript
const capturedFrom = `${process.env.CAPTURE_BACKEND_KIND || "unknown"}:${process.env.VICE_BIN || `${host}:${port}`}`;
```
The shipped runtime probe should build its key from `resolvedBackend().backend` + `resolvedBackend().binPath` directly (both already resolved, absolute, and memoised), producing e.g. `` `${backend}:${binPath}` `` — matching D-42-2's mandated `stock|fork:<resolved absolute path>` shape without going through an env-var-keyed test-only convention.

**No existing "capability probe with a fixed stub-string match" analog was found** — `findSiblingBinary()` and `resolvedBackend()` both cover memoisation/identity, but neither implements "run a command, compare its response against a known degradation string, cache a boolean." This part of PARSE-04 (matching VICE's own `"Disabled. configure with --enable-cpuhistory and recompile."` stub string, per RESEARCH.md's Pitfall 3) has no in-repo precedent; report this as a genuine gap for the planner — the probe logic itself must be authored fresh, only its caching/keying shape has a direct analog.

## Shared Patterns

### Pure-parser shape (no transport, no throw-by-default — see caveat)
**Source:** `src/mcp/vice/disasm-decoder.ts`
**Apply to:** all five `textmon-*.ts` modules
Never import `text-protocol.ts`, `node:net`, or any transport/session module. Take a plain `string` (the already-framed, prompt-stripped reply) as input. Bounded, single-pass loop, no recursion.

### Fixture loading (do not re-derive)
**Source:** `src/mcp/vice/textmon-fixtures.ts`
**Apply to:** all five `*.test.ts` files
`import { loadTextFixture } from "./textmon-fixtures.ts";` — never hand-roll a second sidecar loader or provenance-key check.

### Text-channel tool handler wrapper (do not call `command()` directly)
**Source:** `src/mcp/vice/text-tools.ts` (`withTextTool()`)
**Apply to:** all five new tool handlers
Every handler must go through `withTextTool()` → `withTextChannelLock()` → `client.command(...)`. Register with `withDerivedTool(name, { needsSession: false }, handler)`, never `needsSession: true` (self-deadlock).

### Closed-consumer-set / single-seam structural enforcement
**Source:** `src/mcp/vice/hostpath-consumers.test.ts`
**Apply to:** the PARSE-03 structural test, and the `DERIVED_TOOL_MODULES` map extension for the five new tool registrations
Family-floor (hand-pinned + pinned-equals-measured pair) for "one owning module per text format"; declared map + existence + non-membership assertions for tool→module registration; named-absence-before-existence for constraints on modules not yet written.

### Refuse-before-any-byte-reaches-the-socket discipline
**Source:** `src/mcp/vice/text-protocol.ts` (`command()`, `FORBIDDEN_COMMAND_CHARS_RE`, `isAllowlistedTextCommand()`)
**Apply to:** the `TEXT_COMMAND_ALLOWLIST` parameterization (D-42-1) and any parameter validation the five tool handlers perform (mirroring `handleWarpSet()`'s boolean check, `text-tools.ts:177-182`, which refuses "before any text-monitor byte is written")

### Per-process memoisation with resolved-identity keying
**Source:** `src/mcp/vice/host-tool.mts` (`findSiblingBinary()`) + `src/mcp/vice/backend-detect.mts` (`resolvedBackend()`)
**Apply to:** the PARSE-04 capability-probe module (D-42-2) — in-process `Map`, keyed off `resolvedBackend()`'s own resolved `backend`+`binPath`, never persisted under `.c64-re-tools/`

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| PARSE-04's actual stub-string-matching probe logic (not its cache/key shape) | utility (probe) | request-response | No existing module in this repo runs a command and pattern-matches its response against a known "feature disabled" literal string with a cached boolean outcome; `findSiblingBinary()`/`resolvedBackend()` cover only the memoisation/identity half |
| `manifest-arg-compat.ts` | — | — | File not found under this name in `src/mcp/vice/` during this session's search — RESEARCH.md's citation could not be independently confirmed; the planner should verify this file exists before relying on it as an analog for D-42-1 |
| A confirmed second enforcement mechanism for `anno-store.ts`'s single-`node:sqlite`-consumer discipline | — | — | Grepped `hostpath-consumers.test.ts` for `node:sqlite`, zero matches; RESEARCH.md's own phrasing anticipates this may need a fresh look the planner should do directly |
| The RED/GREEN planted-refusal control's exact source lines | test (control) | — | `text-protocol.test.ts:229-269` was cited by RESEARCH.md but not read in full this session (budget); the executor should read it directly before authoring the PARSE-03 refusal controls rather than rely on this document's paraphrase |

## Metadata

**Analog search scope:** `src/mcp/vice/` (all `.ts`/`.mts` top-level modules, targeted greps + full reads of the four RESEARCH.md-named analogs plus `host-tool.mts`/`backend-detect.mts` for D-42-2, `text-tools.ts`/`stock-derived.ts`/`stock-dispatch.ts` for tool registration)
**Files scanned:** `disasm-decoder.ts` (full), `textmon-fixtures.ts` (full), `text-protocol.ts` (targeted: header, allowlist, `command()`), `text-tools.ts` (full), `hostpath-consumers.test.ts` (targeted: family-floor block, `DERIVED_TOOL_MODULES` block, named-absence blocks), `host-tool.mts` (targeted: `findSiblingBinary()` + memo), `backend-detect.mts` (targeted: `resolvedBackend()`/`memoisedResult`), `stock-derived.ts` + `stock-dispatch.ts` (targeted: registration entries), `probe-binmon.mjs` (targeted: `capturedFrom` key-string precedent)
**Pattern extraction date:** 2026-09-09
