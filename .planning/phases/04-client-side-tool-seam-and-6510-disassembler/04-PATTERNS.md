# Phase 4: Client-Side Tool Seam and 6510 Disassembler - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 15 (8 new production modules + 6 new/paired test files + 4 modified files, some overlapping)
**Analogs found:** 11 exact/role-match / 15 total (opcode table and its test, the round-trip test, and THIRD-PARTY-NOTICES.md content itself have no in-repo code analog — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.claude/mcp/vice/stock-derived.ts` | middleware/adapter | request-response | `.claude/mcp/vice/stock-dispatch.ts` (`withStockSession()`) | exact |
| `.claude/mcp/vice/stock-derived.test.ts` | test | request-response + structural | `.claude/mcp/vice/stock-paths.test.ts` | exact |
| `.claude/mcp/vice/stock-disassemble.ts` | controller (tool handler) | CRUD-ish read (memory read → decode → render) | `.claude/mcp/vice/stock-memory.ts` (`handleMemoryRead`) | exact |
| `.claude/mcp/vice/stock-disassemble.test.ts` | test | request-response | existing family test files (e.g. `stock-memory` tests) + `stock-schema-check.ts` usage pattern | role-match |
| `.claude/mcp/vice/disasm-opcodes.ts` | model / pure-data module | transform (lookup table) | none in-repo (closest style precedent: `stock-protocol.ts`'s `CommandType` const-object + its attribution header comment) | no analog (see below) |
| `.claude/mcp/vice/disasm-opcodes.test.ts` | test | batch/exhaustive derivation | none in-repo (novel: bit-pattern derivation test) | no analog |
| `.claude/mcp/vice/disasm-decoder.ts` | service (pure transform) | transform | `.claude/mcp/vice/stock-schema-check.ts` (pure, dependency-free, recursive/no I/O module shape) | role-match |
| `.claude/mcp/vice/disasm-decoder.test.ts` | test | transform | `.claude/mcp/vice/stock-address.test.ts`-style pure unit tests (not read directly, but same family as `stock-schema-check.ts`'s tests) | role-match |
| `.claude/mcp/vice/disasm-renderer.ts` | service (pure transform) | transform | same as decoder — `stock-schema-check.ts` | role-match |
| `.claude/mcp/vice/disasm-roundtrip.test.ts` | test (integration, subprocess) | batch/subprocess | `.claude/mcp/vice/stock-live.test.ts` (env-gated skip shape) + `.claude/skills/acme-build/scripts/acme.mjs` (`spawnSync` shape) | role-match (two analogs, combined) |
| `.claude/mcp/vice/hostpath.ts` (consumer-list note only, not edited for logic) | utility | — | itself / `vice-broker-client.ts`'s header comment on the closed consumer set | exact (documentation precedent only) |
| `.claude/mcp/vice/tools-manifest.stock.json` | config | — | its own existing `vice_memory_read` entry (address/size/outputSchema shape) | exact |
| `.github/workflows/ci.yml` | config (CI) | — | itself, `build` job's existing step list | exact |
| `THIRD-PARTY-NOTICES.md` | config/doc | — | none in-repo (no NOTICE file exists); closest content precedent is `stock-protocol.ts`'s attribution header comment | no analog (content); `installer/package.json`'s `prepack` is the analog for **shipping** it |
| `scripts/check-npm-packages.mjs` (modified) | test/utility (packaging gate) | batch | itself (existing `need(...)` assertions) | exact |

## Pattern Assignments

### `.claude/mcp/vice/stock-derived.ts` (middleware/adapter, request-response)

**Analog:** `.claude/mcp/vice/stock-dispatch.ts` — specifically `withStockSession()` (lines 396-445) and `ensureStockSession()` (lines 225-334).

**Why this is the closest analog:** RESEARCH.md's Pattern 1 explicitly models `withDerivedTool()` on `withStockSession()` — same three-step shape (acquire-if-needed → convert handshake error → delegate → convert wire error), same dispatch-table registration discipline (D-03: one table, no fall-through), same never-throw boundary. The only genuine delta is D-04's conditional session (`needsSession: boolean`) and D-01/D-02's container-path-only discipline, neither of which changes the adapter's shape.

**Header-comment density to copy** (verbatim style, from `stock-dispatch.ts:1-26`):
```typescript
#!/usr/bin/env node
// stock-derived.ts
//
// THE derived-tool layer (DERIV-07, D-01/D-02/D-03/D-04). Sits BESIDE
// withStockSession() in stock-dispatch.ts's STOCK_DISPATCH_TABLE -- never a
// second dispatch table, never a fall-through. Owns the ONE thing
// stock-dispatch.ts does not: the container-path discipline for any tool
// whose answer is computed client-side. Mirror image of stock-paths.ts's
// D-17 (which translates an EMULATOR-side path outward); this file's job is
// the opposite direction -- guaranteeing a derived tool's output path is
// NEVER translated through hostpath.ts.
//
// WHAT NOT TO DO:
//   - Never call ensureStockSession() a second way, or re-implement any part
//     of session acquisition here (Pitfall 3, RESEARCH.md) -- needsSession:
//     false must mean "never call ensureStockSession() at all", not "call a
//     lighter version of it".
//   - Never import hostpath.ts from this file (the asserted absence, D-02).
//   - Never build a second STOCK_DISPATCH_TABLE or a fall-through path.
```

**Adapter shape to copy** (real code, `stock-dispatch.ts:426-445`):
```typescript
export function withStockSession(toolName: string, handler: StockSessionHandler): StockHandler {
  return async (args, deps) => {
    let outcome: EnsureStockSessionOutcome;
    try {
      outcome = await ensureStockSession(deps);
    } catch (err) {
      return convertHandshakeError(toolName, err);
    }
    if (!outcome.ok) return isErrorText(outcome.message);
    try {
      return await handler(args, outcome.session, deps);
    } catch (err) {
      return convertWireError(toolName, err);
    }
  };
}
```
`withDerivedTool(toolName, { needsSession }, handler)` should follow this exactly when `needsSession: true` (delegate straight into the SAME `ensureStockSession()` — imported from `stock-dispatch.ts`, never re-implemented), and skip the acquire step entirely (handler receives no session) when `needsSession: false`.

**Error handling / result types to reuse (do not re-derive):** `StockHandler`, `StockToolResult`, `isErrorText()`, `convertHandshakeError()`, `convertWireError()` — all from `stock-handler.ts` (see its own file below) and re-exported by `stock-dispatch.ts`. `stock-derived.ts` must import from `stock-handler.ts` directly (never from `stock-dispatch.ts` at runtime for these, to avoid a cycle — see `stock-handler.ts`'s own header comment on this).

**Container-path-only helper — model on the MIRROR IMAGE, `stock-paths.ts`:**
```typescript
// stock-paths.ts:94-123 -- withEmulatorSidePath()'s shape (translate OUT to
// host). stock-derived.ts's helper is the same shape but must NEVER call
// tryHostPaths()/hostPathCandidates() at all -- it exists purely to give a
// derived tool a single seam to route any output path through that is
// STRUCTURALLY incapable of reaching hostpath.ts (D-02's asserted absence).
export async function withEmulatorSidePath<T>(
  toolName: string,
  containerPath: string,
  send: (path: string) => Promise<T>,
): Promise<{ result: T; sentPath: string }> {
  if (!STOCK_EMULATOR_SIDE_PATH_TOOLS.has(toolName)) {
    throw new StockPathError(/* ... */);
  }
  // ...
}
```
The declared-table pattern (`STOCK_EMULATOR_SIDE_PATH_TOOLS: ReadonlySet<string>`, refuse-if-not-declared) is the exact shape to copy for whatever data-only "which tools are derived" list D-03 asks for — a plain `Set`/array, never a second dispatch path.

---

### `.claude/mcp/vice/stock-derived.test.ts` (test, behavioural + structural)

**Analog:** `.claude/mcp/vice/stock-paths.test.ts` (full file read).

**Why closest:** It is D-02's own cited precedent (`STOCK_EMULATOR_SIDE_PATH_TOOLS: exactly four entries, no screenshot/disassembly tool` test) and already demonstrates BOTH of D-02's required mechanisms in one file: (1) a behavioural test with `HOST_WORKSPACE_PATH`/`CONTAINER_WORKSPACE_PATH` set, asserting what path the handler actually received, and (2) a structural size/membership assertion on a declared `Set`.

**Copy this exact behavioural-test shape** (`stock-paths.test.ts:61-86`):
```typescript
test("withEmulatorSidePath: inside a container with HOST_WORKSPACE_PATH set, send() receives the mapped host path", async () => {
  setIsInsideContainerForTest(() => true);
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  process.env.CLAUDE_PROJECT_DIR = "/workspace";
  try {
    let received: string | null = null;
    const { sentPath } = await withEmulatorSidePath("vice_snapshot_save", "/workspace/.vice-snapshots/x.vsf", async (p) => {
      received = p;
      return "ok";
    });
    assert.equal(received, "/home/user/project/.vice-snapshots/x.vsf");
    assert.equal(sentPath, "/home/user/project/.vice-snapshots/x.vsf");
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH; else process.env.HOST_WORKSPACE_PATH = prevHostWs;
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
  }
});
```
D-02's INVERSE assertion (a derived tool must receive the CONTAINER path unchanged, never the host-translated one) is the same shape with the assertion polarity flipped — set `HOST_WORKSPACE_PATH` so translation WOULD visibly rewrite the path, then assert the derived handler's received argument is still the *container* path.

**Copy this exact structural-assertion shape** (`stock-paths.test.ts:25-33`):
```typescript
test("STOCK_EMULATOR_SIDE_PATH_TOOLS: exactly four entries, no screenshot/disassembly tool", () => {
  assert.equal(STOCK_EMULATOR_SIDE_PATH_TOOLS.size, 4);
  assert.ok(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_autostart"));
  // ...
  assert.equal(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_disassemble"), false);
});
```
For D-02's "asserted absence from `hostpath.ts`'s closed consumer set": no committed literal consumer-list test currently exists in the repo (the "closed consumer set" is presently enforced only by header-comment convention in `vice-proxy.ts:114` and `vice-broker-client.ts:23`, naming **four production modules**: `vice-sync.ts`, `containerpath.ts`, `install-resources.ts`, `vice-proxy.ts` — confirmed by grepping actual `from "./hostpath.ts"` imports). This means D-02's second mechanism is **new work, not an existing test to imitate** — model its shape on the `STOCK_EMULATOR_SIDE_PATH_TOOLS` size/membership assertion above (a frozen list/count plus a grep-based or import-based check that `stock-derived.ts` is not on it), but there is no existing "closed consumer set test" file to copy line-for-line. Flag this to the planner explicitly.

---

### `.claude/mcp/vice/stock-disassemble.ts` (controller, read/CRUD)

**Analog:** `.claude/mcp/vice/stock-memory.ts` (full file), specifically `handleMemoryRead` (lines 166-249).

**Why closest:** RESEARCH.md's own "Code Examples" section names this exact reuse (`stock-memory.ts`'s `MemoryGet` pattern). Both read a byte range from a stock session, both parse address/count via `stock-address.ts`, both build the answer via `stockAnswer()`.

**Imports pattern to copy** (`stock-memory.ts:28-31`):
```typescript
import { CommandType, memGetBody, memSetBody } from "./stock-protocol.ts";
import { parseAddress, parseByteCount } from "./stock-address.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler, type StockToolResult } from "./stock-handler.ts";
import type { StockConnectSession } from "./stock-connect.ts";
```
(`stock-disassemble.ts` additionally imports `decode` from `./disasm-decoder.ts` and `render` from `./disasm-renderer.ts`, and registers through `withDerivedTool` rather than `withStockSession` directly.)

**Argument parsing / validation pattern** (`stock-memory.ts:166-198`, `isPlainObject` guard + `parseAddress`/`parseByteCount` try/catch, each returning `isErrorText(...)` on failure):
```typescript
export const handleMemoryRead: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_read: arguments must be an object");
  }
  let address: number;
  try {
    address = parseAddress(args.address, { what: "address" });
  } catch (err) {
    return isErrorText(`vice_memory_read: ${err instanceof Error ? err.message : String(err)}`);
  }
  // ... size, then a combined range check: `if (end > 0xffff) return isErrorText(...)`
```
D-12's "`end` and `count` both supplied is refused" check is the same shape as this file's own `end > 0xffff` range-refusal branch — one more `isErrorText(...)` early return, no new error-handling mechanism.

**Wire call + response-shape guard** (`stock-memory.ts:215-231`):
```typescript
const body = memGetBody({ sidefx: sideEffects, start: address, end, memspace: 0x00, bank: bankResolution.id });
let response;
try {
  response = await session.client.send(CommandType.MemoryGet, body);
} catch (err) {
  return convertWireError("vice_memory_read", err);
}
if (response.type !== "memory_get") {
  return isErrorText(`vice_memory_read: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`);
}
if (response.bytes.length !== size) {
  return isErrorText(`vice_memory_read: expected ${size} byte(s), got ${response.bytes.length} -- a short read is a wrong answer, not a partial success`);
}
```
`vice_disassemble` should always pass `sidefx: false` per RESEARCH.md, over-read by a safety margin, then hand `response.bytes` to `decode()`.

**Answer construction** (`stock-memory.ts:234-248`):
```typescript
const payload: Record<string, unknown> = { address, size, encoding, sideEffects, bank: /* ... */, memspace: "main" };
// ...
return stockAnswer(session.client, payload);
```
D-13's answer (`instructions` array + `listing` string) plugs into this same `stockAnswer(session.client, payload)` call — never a hand-built `{ content, isError }` literal.

---

### `.claude/mcp/vice/stock-disassemble.test.ts` (test, request-response)

**Analog:** `.claude/mcp/vice/stock-schema-check.ts`'s intended consumer pattern (the file itself, not a test file — no single existing `*.test.ts` was read verbatim for a stock tool's own answer-conformance test, since none of the 25 existing tools has a dedicated schema-conformance test file separate from its family test). Use `checkAgainstSchema(value, schema)` (full API read above) directly against `tools-manifest.stock.json`'s `vice_disassemble` entry's `outputSchema`, exactly as its own header comment intends ("the dependency-free `outputSchema` checker Phase 3 built; D-13's answer plugs straight in").

**Injected fake resolver for DISASM-06** (D-14): model the injection point on `stock-address.ts`'s own `setSymbolResolver()` (lines 41-43) — `stock-disassemble.test.ts` should call `setSymbolResolver({ resolve: (name) => FAKE_TABLE[name] })` before a test and `setSymbolResolver(null)` after, exactly matching that module's own documented test-injection contract ("the default here stays `null`" / "Phase 5's DERIV-04 symbol store fills it later").

---

### `.claude/mcp/vice/disasm-opcodes.ts` (model / pure-data module)

**No close analog exists in this codebase.** This is flagged explicitly: nothing in `.claude/mcp/vice/*.ts` is a large (256-entry) flat data table. The closest **stylistic** precedent is `stock-protocol.ts`'s `CommandType` const-object (lines 95-110+, ~16 entries, `as const`-style plain object mapping names to wire values) — copy its *shape* (a plain exported object/array, no runtime codegen, "same numeric values with zero runtime codegen" idiom), not its content.

**The attribution/provenance header-comment style to copy verbatim** is `stock-protocol.ts`'s own header (lines 1-33) — this is the single existing precedent in the repo for vendoring/transcribing third-party source data into a TS module with a dated, named, defect-annotated attribution comment:
```typescript
// Attribution: this module is derived from henrik/c64-debug-mcp's
// src/vice-protocol.ts (v1.0.14, MIT, Henrik Olsson 2025). Three defects in
// that source are fixed on the way in: (a) ... (b) ... (c) ...
```
`disasm-opcodes.ts`'s header should follow this exact template: name the source (`cc65`'s `src/da65/opc6502x.c`, zlib), the version/commit if known, and any transcription corrections made — matching D-07's requirement that attribution live "in the opcode table module's own header comment."

**What NOT to do:** do not source any fact from VICE itself (GPL-2) — `stock-protocol.ts`'s header is itself a precedent of the *opposite* direction (a vendored dependency that IS compatible) and should not be misread as license to vendor from VICE.

---

### `.claude/mcp/vice/disasm-opcodes.test.ts` (test, exhaustive derivation)

**No analog.** D-06's bit-pattern derivation test (deriving addressing mode/length from the 6502's own `aaabbbcc` bit structure across all 256 entries) is a novel verification technique with no precedent test file in this repo. The closest structural discipline to copy is the "exhaustive, not sampled" ethic already used by `stock-schema-check.ts`'s own recursive walk and by `stock-paths.test.ts`'s declared-Set-size assertion (assert `OPCODES.length === 256`, then loop deriving expected mode/length per entry and comparing) — but the derivation logic itself must be invented.

---

### `.claude/mcp/vice/disasm-decoder.ts` / `.claude/mcp/vice/disasm-renderer.ts` (pure transforms)

**Analog:** `.claude/mcp/vice/stock-schema-check.ts` (full file) — the closest existing precedent for "a pure, dependency-free, no-I/O, no-protocol-import module with a documented supported-subset and an explicit never-throw discipline." Its header-comment structure (WHY THIS EXISTS RATHER THAN X / SUPPORTED SUBSET / WHAT NOT TO DO) is the template to copy for both `disasm-decoder.ts` and `disasm-renderer.ts`'s own headers, substituting "ajv-equivalent" concerns for "protocol-import" concerns:
```typescript
// disasm-decoder.ts
//
// A pure decode(bytes, startAddress, opts) -> Instruction[] function (D-05).
// NO import from anything under stock-*.ts or vice*.ts -- Phase 5's
// backtrace (DERIV-02) and Phase 6's CPU-history decode (GAIN-01) import
// THIS file directly, never a tool module, so a protocol import here would
// force those consumers to pull in transport code they do not need.
//
// WHAT NOT TO DO:
//   - Never import stock-protocol.ts, stock-dispatch.ts, or anything under
//     vice*.ts -- this module's only import is disasm-opcodes.ts.
//   - Never throw on malformed input -- return a `notes: ["truncated"]`
//     entry instead (D-10), matching this module tree's "never throw" ethic.
```
`isPlainObject()`-style defensive narrowing (seen throughout `stock-memory.ts`, `stock-schema-check.ts`) should gate any object-shaped `opts` argument.

---

### `.claude/mcp/vice/disasm-roundtrip.test.ts` (integration, subprocess)

**Two analogs, combined:**

1. **Env-gated skip shape** — `.claude/mcp/vice/stock-live.test.ts` (full file read), specifically the `SKIP_REASON` computation (lines 74-90) and its use via node:test's own `{ skip }` option on every test:
```typescript
const SKIP_REASON: string | false = !process.env.VICE_LIVE_STOCK_BIN
  ? `stock-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN=... to run it. ...`
  : !existsSync(resolvedBinPath)
    ? `VICE_LIVE_STOCK_BIN="${resolvedBinPath}" does not exist on disk -- ...`
    : false;
// ...
test("...", { skip: SKIP_REASON }, async () => { /* ... */ });
```
D-08's ACME-absence skip should follow this exact `string | false` computed-once pattern, checked via `command -v acme` or `existsSync` on a resolved binary path, never a hand-rolled early `return` (which reports a false PASS rather than a SKIP — the file's own stated rule).

2. **Subprocess invocation shape** — `.claude/skills/acme-build/scripts/acme.mjs`'s `cmdDisasm()` (lines 209-222) and `build()`'s own `spawnSync("acme", args, { encoding: "utf8", env })` call (line 124):
```javascript
const r = spawnSync("toacme", ["object", src, out], { encoding: "utf8" });
if (r.error) die("install the ACME cross assembler and put `toacme` on PATH");
if (r.status !== 0) die(`toacme: ${(r.stderr || r.stdout).trim()}`);
```
This is the repo's ONE existing precedent for shelling out to ACME from Node — an argv array, `spawnSync`, never a shell string (RESEARCH.md's Pitfall 4 / Security section explicitly names this as the pattern the round-trip test and D-09's substitution-assertion test must both follow). Not a test file itself, but the exact subprocess-invocation shape to reuse for both the round-trip test (assemble the renderer's `listing` output) and the D-09 substitution-membership test (assert ACME genuinely rejects each candidate mnemonic).

---

### `.claude/mcp/vice/tools-manifest.stock.json` (config, modified)

**Analog:** its own existing `vice_memory_read` entry (lines 27-70, read in full above) — the closest existing entry combining a `parseAddress`-style string address argument, an optional argument, and a rich `outputSchema` with an array-of-objects field (`bytes: { type: "array", items: { type: "number" } }`) and a `runState` enum tail:
```json
{
  "name": "vice_memory_read",
  "description": "Read a memory range ... On stock this halts the machine (D-05); the answer's runState reports it. ...",
  "inputSchema": {
    "type": "object",
    "properties": { "address": {"type": "string", "description": "..."}, "size": {"type": "number", "description": "..."} },
    "required": ["address", "size"]
  },
  "outputSchema": {
    "type": "object",
    "properties": { "...": {}, "runState": { "type": "string", "enum": ["running", "stopped", "unknown"] } },
    "required": ["address", "size", "..."]
  }
}
```
`vice_disassemble`'s stock entry copies this exact shape: `address` (string, D-04 pluggable), `count` (number, default 10 max 100 — the fork's own required arg per `tools-manifest.json:786-826`), `show_symbols` (boolean), plus the **new** optional `end` (D-12) and a mutual-exclusion note in `description`. `outputSchema` gets D-13's `instructions` (array of objects: address/bytes/mnemonic/operand/resolvedTarget/notes) and `listing` (string), both alongside the standard `runState` enum tail every stock entry ends with.

---

### `.github/workflows/ci.yml` (config, modified)

**Analog:** its own existing `build` job step list (lines 26-57) — insert one new step, same style as the existing ones (`name:` + `working-directory:` + `run:`), before the `Test` step:
```yaml
- name: Install ACME cross-assembler
  run: sudo apt-get update && sudo apt-get install -y acme
```
Per RESEARCH.md's Open Question 1, verify the apt package name resolves to the real ACME cross-assembler (`apt-cache policy acme` or `acme --version` immediately after) before trusting it — this is a real open risk, not just a copy-paste.

---

### `THIRD-PARTY-NOTICES.md` + `scripts/check-npm-packages.mjs` (modified)

**No content analog** — no `NOTICE`/`THIRD-PARTY` file exists anywhere in the repo today (only `LICENSE`); this file's content (zlib license text + provenance line per source) is new prose, not a copy of anything.

**Packaging-mechanism analog:** `installer/package.json`'s `prepack` script (line 51: `"prepack": "node scripts/sync-skills.mjs"`) plus `installer/scripts/sync-skills.mjs` (full file read above) — the exact precedent for "a repo-root-adjacent file that must be copied INTO a package directory before `npm pack` can ship it," which RESEARCH.md's Pitfall 2 identifies as the mechanism `.claude/mcp/vice/package.json` needs (a `prepack` step copying `THIRD-PARTY-NOTICES.md` in, or keeping the canonical file inside `.claude/mcp/vice/` directly — RESEARCH.md leaves this as an open planner decision, Option 2 being simpler with no moving parts).

**Test-assertion analog to extend:** `scripts/check-npm-packages.mjs`'s own `need(...)` pattern (full file read above):
```javascript
need(vice.files.includes("tools-manifest.json"), "vice-mcp: missing tools-manifest.json");
```
Add one more `need(vice.files.includes("THIRD-PARTY-NOTICES.md"), "vice-mcp: missing THIRD-PARTY-NOTICES.md")`-shaped line — checking `vice.files` (the **actual packed tarball list**, from `npm pack --dry-run --json`), never `existsSync()` against the repo-root path alone (RESEARCH.md's Pitfall 2 warning sign, explicitly: that would pass while the real gate silently omits the file, the CR-07 failure shape this repo has a named aversion to).

## Shared Patterns

### Never-throw dispatch boundary
**Source:** `.claude/mcp/vice/stock-dispatch.ts`'s `withStockSession()` (two nested try/catch, `convertHandshakeError`/`convertWireError`) — reused unchanged by `withDerivedTool()`.
**Apply to:** `stock-derived.ts`, `stock-disassemble.ts`.

### One error type per module, extending `ViceError`
**Source:** `.claude/mcp/vice/vice.ts:250-260` (`ViceError` base), `.claude/mcp/vice/stock-address.ts:47-52` (`StockAddressError`), `.claude/mcp/vice/stock-paths.ts:47-52` (`StockPathError`).
```typescript
export class StockAddressError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockAddressError";
  }
}
```
**Apply to:** any new error type `stock-derived.ts`/`disasm-decoder.ts` needs (e.g. a `DisasmError`) — never a bare `Error`.

### `isPlainObject()` narrowing at every JSON boundary
**Source:** `.claude/mcp/vice/stock-memory.ts:33-39`, `.claude/mcp/vice/stock-schema-check.ts:41-43` — identical one-line predicate repeated per file (not centrally imported, by established convention).
```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```
**Apply to:** `stock-disassemble.ts`'s argument parsing, `disasm-decoder.ts`'s `opts` argument.

### `stockAnswer()` as the ONE answer constructor
**Source:** `.claude/mcp/vice/stock-handler.ts:172-175`.
```typescript
export function stockAnswer(client: ViceMonitorClient, payload: Record<string, unknown>): StockOkResult {
  const runState = runStateFor(client);
  return { content: [{ type: "text", text: JSON.stringify({ ...payload, runState }) }], isError: false };
}
```
**Apply to:** `stock-disassemble.ts` — never build `{ content, isError: false }` by hand.

### Address/byte-count parsing — one seam, never re-derived
**Source:** `.claude/mcp/vice/stock-address.ts` (`parseAddress()`, `parseByteCount()`, `setSymbolResolver()`).
**Apply to:** `stock-disassemble.ts`'s `address`/`count`/`end` arguments (D-12, D-14).

### `outputSchema` conformance checking
**Source:** `.claude/mcp/vice/stock-schema-check.ts` (`checkAgainstSchema()`).
**Apply to:** `stock-disassemble.test.ts`'s validation of the `instructions`/`listing` answer against `tools-manifest.stock.json`'s `vice_disassemble` entry.

### Argv-array subprocess invocation, never a shell string
**Source:** `.claude/skills/acme-build/scripts/acme.mjs:124,213` (`spawnSync("acme"|"toacme", [...args], { encoding: "utf8" })`).
**Apply to:** `disasm-roundtrip.test.ts` and the D-09 substitution-membership assertion test.

### Env-gated, computed-once skip reason (never a hand-rolled early return)
**Source:** `.claude/mcp/vice/stock-live.test.ts:74-90` (`SKIP_REASON: string | false`, passed to node:test's own `{ skip }` option on every test).
**Apply to:** `disasm-roundtrip.test.ts`'s local ACME-absence skip (D-08).

### Long, structured header comments naming the specific past mistake
**Source:** every file above — `stock-dispatch.ts`, `stock-paths.ts`, `stock-handler.ts`, `stock-schema-check.ts`, `stock-address.ts`, `stock-protocol.ts`, `test-gate.mjs` all open with a WHY-THIS-EXISTS / WHAT-NOT-TO-DO block naming a real code-review finding (CR-05, CR-06, CR-07) or incident by name/date.
**Apply to:** every new file in this phase (`stock-derived.ts`, `stock-disassemble.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`) — match this density; do not write a terse one-line header.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.claude/mcp/vice/disasm-opcodes.ts` | model/pure-data | transform | No 256-entry (or any comparably large) flat data table exists anywhere in `.claude/mcp/vice`; nearest stylistic precedent is `stock-protocol.ts`'s 16-entry `CommandType` const-object plus its attribution-header convention — shape only, not content. Needs invention from cc65's `opc6502x.c` (per D-06), not imitation. |
| `.claude/mcp/vice/disasm-opcodes.test.ts` | test | exhaustive derivation | The bit-pattern (`aaabbbcc`) derivation-test technique has no precedent test file in this repo — must be designed from the 6502 opcode encoding rules directly. |
| `.claude/mcp/vice/disasm-roundtrip.test.ts` | test | subprocess integration | No existing test spawns a real *external assembler* and diffs re-encoded bytes; it combines two existing patterns (see Shared Patterns above) but the round-trip diff logic itself is new. |
| `THIRD-PARTY-NOTICES.md` | doc/config | — | No NOTICE/THIRD-PARTY file exists in the repo at all today; only `LICENSE`. Content is new prose (zlib text + provenance lines), though the *packaging mechanism* to ship it (`prepack`) has a direct analog (`installer/package.json`). |
| `.claude/mcp/vice/stock-derived.test.ts`'s hostpath-closed-consumer-set assertion (D-02's second mechanism) | test | structural | No committed literal "closed consumer list" test currently exists — the closed-set discipline is presently enforced only by header-comment convention in `vice-proxy.ts:114` and `vice-broker-client.ts:23` (confirmed via `from "./hostpath.ts"` import grep: `vice-sync.ts`, `containerpath.ts`, `install-resources.ts`, `vice-proxy.ts`). This phase's D-02 is the FIRST time this set gets a real committed test — model its shape on `stock-paths.test.ts`'s `STOCK_EMULATOR_SIDE_PATH_TOOLS` size/membership test, but there is no existing file performing this exact check to copy from. |

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.ts`, `.claude/mcp/vice/*.mts`, `.claude/mcp/vice/*.json` (manifests), `.claude/skills/acme-build/scripts/*.mjs`, `installer/*.json` + `installer/scripts/*.mjs`, `.github/workflows/ci.yml`, `scripts/check-npm-packages.mjs`.
**Files scanned (read in full or targeted):** `stock-dispatch.ts`, `stock-handler.ts`, `stock-address.ts`, `stock-paths.ts`, `stock-paths.test.ts`, `stock-schema-check.ts`, `stock-live.test.ts`, `stock-memory.ts`, `acme.mjs`, `vice-proxy.ts` (targeted sections), `hostpath.ts`/`vice-broker-client.ts` (consumer-set grep), `tools-manifest.json`/`tools-manifest.stock.json` (targeted sections), `check-npm-packages.mjs`, `package.json` (vice-mcp + installer), `sync-skills.mjs`, `ci.yml`, `test-gate.mjs`, `stock-protocol.ts` (header + `CommandType`), `vice.ts` (`ViceError`).
**Pattern extraction date:** 2026-08-17
