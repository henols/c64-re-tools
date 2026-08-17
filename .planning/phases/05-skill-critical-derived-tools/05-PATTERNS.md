# Phase 5: Skill-Critical Derived Tools - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 11 new (5 production modules + 5 test files + 1 possible coverage script) + 5 modified
**Analogs found:** 11 / 11 (every new file has a strong existing analog; nothing falls into "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `.claude/mcp/vice/stock-memory-search.ts` | derived-tool handler (service) | request-response, batch scan over one read | `.claude/mcp/vice/stock-disassemble.ts` (session-needing derived tool shape) + `.claude/mcp/vice/stock-memory.ts` (MEM_GET read pattern) | exact (adapter) / role-match (read pattern) |
| `.claude/mcp/vice/stock-memory-search.test.ts` | test | unit, fake-session | `.claude/mcp/vice/stock-disassemble.test.ts` | exact |
| `.claude/mcp/vice/stock-symbols.ts` | derived-tool handler (service, no session) + file I/O | file-I/O, event-free client state | `.claude/mcp/vice/stock-address.ts` (SymbolResolver extension point) + `.claude/skills/acme-build/scripts/acme.mjs` (`curateLabels()` label-file parsing) | exact (resolver hook) / role-match (parser) |
| `.claude/mcp/vice/stock-symbols.test.ts` | test | unit, fixture-file | `.claude/mcp/vice/stock-disassemble.test.ts` (fake session) + `.claude/mcp/vice/stock-address.test.ts` (resolver install/reset) | role-match |
| `.claude/mcp/vice/stock-vicii.ts` | derived-tool handler (service) | request-response, bit-field decode | `.claude/mcp/vice/stock-disassemble.ts` (session-needing derived tool over one MEM_GET) | exact |
| `.claude/mcp/vice/stock-vicii.test.ts` | test | unit, fake-session | `.claude/mcp/vice/stock-disassemble.test.ts` | exact |
| `.claude/mcp/vice/stock-cia.ts` | derived-tool handler (service) | request-response, bit-field decode | `.claude/mcp/vice/stock-disassemble.ts` (same shape as stock-vicii.ts; sibling, not a second template) | exact |
| `.claude/mcp/vice/stock-cia.test.ts` | test | unit, fake-session | `.claude/mcp/vice/stock-disassemble.test.ts` | exact |
| `.claude/mcp/vice/stock-sprites.ts` | derived-tool handler (service) | request-response, pointer-chain arithmetic + render | `.claude/mcp/vice/stock-disassemble.ts` (adapter/session shape) + `.claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs` (`vicBank()`/`screenBase()`/sprite-data-address arithmetic to port) | exact (adapter) / exact (arithmetic, JS->TS port) |
| `.claude/mcp/vice/stock-sprites.test.ts` | test | unit, fake-session + fixture | `.claude/mcp/vice/stock-disassemble.test.ts` | exact |
| `scripts/check-skill-tool-coverage.mjs` (optional, planner's call) | utility / CI script | batch, static analysis | `scripts/check-npm-packages.mjs` (reads manifests/tarball metadata, `need()`-style assertions, greps source trees) | role-match |
| `.claude/mcp/vice/stock-dispatch.ts` (modified) | dispatch table / route registration | request-response | itself — extend `STOCK_DISPATCH_TABLE` with 4 more imports + 8 more `withDerivedTool(...)` entries, same shape as the existing `vice_disassemble` entry | exact (self-analog) |
| `.claude/mcp/vice/stock-derived.ts` (modified) | data-only registry | n/a | itself — extend `STOCK_DERIVED_TOOLS` set literal | exact |
| `.claude/mcp/vice/tools-manifest.stock.json` (modified) | config (manifest) | n/a | the existing `vice_disassemble` entry (`inputSchema` + `outputSchema`) | exact |
| `.claude/mcp/vice/package.json` (modified) | config (`files[]`) | n/a | the 5 modules 04-02/04-05 already added (`stock-disassemble.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`) | exact |
| `docs/stock-vice-parity.md` (modified) | docs | n/a | its own existing D-15/D-16 trim-precedent sections | exact |

## Pattern Assignments

### The shared adapter shape every one of the 8 handlers registers through

**Analog:** `.claude/mcp/vice/stock-dispatch.ts` (`withDerivedTool()`, lines 449-516) and `stock-derived.ts` (`STOCK_DERIVED_TOOLS`, lines 77-79).

`withDerivedTool()`'s exact two-overload signature (copy verbatim, do not re-derive):

```typescript
export function withDerivedTool(toolName: string, opts: { needsSession: true }, handler: StockSessionHandler): StockHandler;
export function withDerivedTool(toolName: string, opts: { needsSession: false }, handler: DerivedPureHandler): StockHandler;
export function withDerivedTool(
  toolName: string,
  opts: { needsSession: boolean },
  handler: StockSessionHandler | DerivedPureHandler,
): StockHandler {
  return async (args, deps) => {
    if (!STOCK_DERIVED_TOOLS.has(toolName)) {
      return isErrorText(`${toolName} is not declared in STOCK_DERIVED_TOOLS -- withDerivedTool refuses any undeclared tool.`);
    }

    if (!opts.needsSession) {
      try {
        return await (handler as DerivedPureHandler)(args, deps);
      } catch (err) {
        return convertWireError(toolName, err);
      }
    }

    let outcome: EnsureStockSessionOutcome;
    try {
      outcome = await ensureStockSession(deps);
    } catch (err) {
      return convertHandshakeError(toolName, err);
    }

    if (!outcome.ok) {
      return isErrorText(outcome.message);
    }

    try {
      return await (handler as StockSessionHandler)(args, outcome.session, deps);
    } catch (err) {
      return convertWireError(toolName, err);
    }
  };
}
```

The one existing table entry to copy the registration shape from (`stock-dispatch.ts` line 608):

```typescript
// derived (DERIV-07, DISASM-01)
vice_disassemble: withDerivedTool("vice_disassemble", { needsSession: true }, handleDisassemble),
```

Phase 5 adds, in the same `STOCK_DISPATCH_TABLE` literal, after that line (imports go beside the existing `import { handleDisassemble } from "./stock-disassemble.ts";` line, ~line 63):

```typescript
import { handleMemorySearch, handleMemoryCompare } from "./stock-memory-search.ts";
import { handleSymbolsLoad, handleSymbolsLookup } from "./stock-symbols.ts";
import { handleViciiGetState } from "./stock-vicii.ts";
import { handleCiaGetState } from "./stock-cia.ts";
import { handleSpriteGet, handleSpriteInspect } from "./stock-sprites.ts";

// ... inside STOCK_DISPATCH_TABLE:
vice_memory_search: withDerivedTool("vice_memory_search", { needsSession: true }, handleMemorySearch),
vice_memory_compare: withDerivedTool("vice_memory_compare", { needsSession: true }, handleMemoryCompare),
vice_symbols_load: withDerivedTool("vice_symbols_load", { needsSession: false }, handleSymbolsLoad),
vice_symbols_lookup: withDerivedTool("vice_symbols_lookup", { needsSession: false }, handleSymbolsLookup),
vice_vicii_get_state: withDerivedTool("vice_vicii_get_state", { needsSession: true }, handleViciiGetState),
vice_cia_get_state: withDerivedTool("vice_cia_get_state", { needsSession: true }, handleCiaGetState),
vice_sprite_get: withDerivedTool("vice_sprite_get", { needsSession: true }, handleSpriteGet),
vice_sprite_inspect: withDerivedTool("vice_sprite_inspect", { needsSession: true }, handleSpriteInspect),
```

And in `stock-derived.ts` (lines 77-79), grow the literal:

```typescript
export const STOCK_DERIVED_TOOLS: ReadonlySet<string> = new Set([
  "vice_disassemble",       // Phase 4
  "vice_memory_search",     // Phase 5, DERIV-01
  "vice_memory_compare",    // Phase 5, DERIV-01
  "vice_symbols_load",      // Phase 5, DERIV-04
  "vice_symbols_lookup",    // Phase 5, DERIV-04
  "vice_vicii_get_state",   // Phase 5, DERIV-05
  "vice_cia_get_state",     // Phase 5, DERIV-05
  "vice_sprite_get",        // Phase 5, DERIV-06
  "vice_sprite_inspect",    // Phase 5, DERIV-06
]);
```

`vice_symbols_load`/`vice_symbols_lookup` are the ONLY `needsSession: false` pair in this phase — every other new tool uses `needsSession: true`, going through the exact `ensureStockSession(deps)` → `convertHandshakeError`/`isErrorText`/`convertWireError` three-step preamble `stock-disassemble.ts`'s own registration already exercises. Do not write a second `needsSession: false` handler type — `DerivedPureHandler` (`stock-derived.ts` line 94) is already `(args, deps) => Promise<StockToolResult>`, with no session parameter at all, structurally incapable of reaching the wire.

---

### `stock-memory-search.ts` (derived handler, request-response + batch scan)

**Analog:** `stock-disassemble.ts` (full shape: arg parsing → bounded `MEM_GET` → decode/scan → `stockAnswer()`) plus `stock-memory.ts`'s `handleMemoryRead` (the plain single-range read a search/compare's own read degenerates to).

Shape to copy (from `stock-disassemble.ts` lines 111-251, adapted):

```typescript
export const handleMemorySearch: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_search: arguments must be an object");
  }

  let start: number, end: number;
  try {
    start = parseAddress(args.start, { what: "start" });
    end = parseAddress(args.end, { what: "end" });
  } catch (err) {
    return isErrorText(`vice_memory_search: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (end < start) {
    return isErrorText(`vice_memory_search: end (0x${end.toString(16)}) must be >= start (0x${start.toString(16)})`);
  }

  // pattern/mask array validation -- mirror vice_memory_write's data[] loop
  // (stock-memory.ts lines 267-280) verbatim in shape.
  if (!Array.isArray(args.pattern) || args.pattern.length === 0) {
    return isErrorText("vice_memory_search: pattern must be a non-empty array of integers 0..255");
  }
  // ... same per-element integer 0..255 validation as vice_memory_write's data[] loop ...

  const body = memGetBody({ sidefx: false, start, end, memspace: 0x00, bank: 0x0000 });
  let response;
  try {
    response = await session.client.send(CommandType.MemoryGet, body);
  } catch (err) {
    return convertWireError("vice_memory_search", err);
  }
  if (response.type !== "memory_get") {
    return isErrorText(`vice_memory_search: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`);
  }
  // ... client-side pattern/mask byte scan over response.bytes, capped at max_results ...

  return stockAnswer(session.client, { start, end, pattern: args.pattern, matches, count: matches.length, truncated });
};
```

`vice_memory_compare` (`mode:'ranges'`) reads TWO ranges the same way (two sequential `MEM_GET` calls, each through the same `memGetBody({ sidefx: false, ... })` shape) and diffs the two returned buffers byte-by-byte, capped at `max_differences`. `mode:'snapshot'` is refused by name (see Shared Patterns / Refusal-by-name below) before any `MEM_GET` is sent.

**Argument validation to copy verbatim in structure:**
- `start`/`end`/`range1_start`/`range1_end`/`range2_start` → `parseAddress()` (`stock-address.ts` lines 111-181).
- `pattern`/`mask` arrays → copy `vice_memory_write`'s `data` array validation loop verbatim in shape (`stock-memory.ts` lines 267-280):
```typescript
if (!Array.isArray(args.data)) {
  return isErrorText(`vice_memory_write: data must be an array of integers 0..255, got ${typeof args.data}`);
}
if (args.data.length === 0) {
  return isErrorText("vice_memory_write: data must not be empty");
}
const data: number[] = [];
for (let index = 0; index < args.data.length; index += 1) {
  const value: unknown = args.data[index];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xff) {
    return isErrorText(`vice_memory_write: data[${index}] must be an integer 0..255, got ${JSON.stringify(value)}`);
  }
  data.push(value);
}
```
- `max_results`/`max_differences` → clamp with the SAME `parseByteCount`-style bound-checking idiom `stock-address.ts` already uses (`value <= 0 || value > max` → throw), default 100, hard ceiling 10000 (the fork's own stated bounds).

**Error handling:** identical three-layer pattern as `stock-disassemble.ts` — `isErrorText()` for argument refusals (zero sends), `convertWireError()` for a `client.send()` rejection, `response.type !==` check for a wrong reply shape, `stockAnswer()` for the final payload.

---

### `stock-symbols.ts` (derived handler, `needsSession: false`, file I/O + resolver install)

**Analog (resolver hook):** `stock-address.ts`'s `SymbolResolver` interface (lines 37-43), `setSymbolResolver()` (lines 52-54), `symbolNameFor()` (lines 64-69), `hasSymbolStore()` (lines 76-78) — already widened in Phase 4 for exactly this consumer. Quote and install into it, never re-derive:

```typescript
export interface SymbolResolver {
  resolve(name: string): number | undefined;
  nameFor?(address: number): string | undefined;
}
export function setSymbolResolver(resolver: SymbolResolver | null): void { /* ... */ }
export function symbolNameFor(address: number): string | undefined { /* ... */ }
export function hasSymbolStore(): boolean { /* ... */ }
```

`stock-symbols.ts`'s job, following the research's own worked example verbatim:

```typescript
import { setSymbolResolver, type SymbolResolver } from "./stock-address.ts";

interface SymbolTable {
  byName: Map<string, number>;
  byAddress: Map<number, string>;
}

function installSymbolTable(table: SymbolTable): void {
  const resolver: SymbolResolver = {
    resolve: (name) => table.byName.get(name),
    nameFor: (address) => table.byAddress.get(address),
  };
  setSymbolResolver(resolver);
}
```

**Analog (label-file format to parse):** `.claude/skills/acme-build/scripts/acme.mjs`'s `curateLabels()` (lines 79-91) — the confirmed `al C:xxxx .Name` line format:

```javascript
function curateLabels(vsPath, symbols) {
  if (!existsSync(vsPath)) return { kept: 0, dropped: 0 };
  const addr = new Set(symbols.filter((s) => s.isAddress && s.used).map((s) => s.name));
  const kept = [];
  let dropped = 0;
  for (const l of readFileSync(vsPath, "utf8").split("\n")) {
    const m = l.match(/^al\s+C:[0-9a-f]+\s+\.(\S+)/i);
    if (!m) continue;
    if (addr.has(m[1])) kept.push(l); else dropped++;
  }
  writeFileSync(vsPath, kept.join("\n") + (kept.length ? "\n" : ""));
  return { kept: kept.length, dropped };
}
```

`vice_symbols_load`'s own parser is the read-side inverse: for each line, `line.match(/^al\s+C:([0-9a-f]+)\s+\.(\S+)/i)` capturing BOTH the hex address (group 1) and the name (group 2), skipping (not refusing the whole file on) any non-matching line — the Pitfall-5 defensive posture the research calls for. Per Pitfall 5, do NOT claim regenerator2000-compatibility; only claim the confirmed ACME `--vicelabels` shape.

**Argument validation (`path`) — analog `stock-paths.ts`'s `sanitizeSnapshotName()` (lines 148-166), read but adapted for a DIFFERENT direction (read, not host-emulator-side write):**

```typescript
const SNAPSHOT_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
export function sanitizeSnapshotName(name: unknown): string {
  if (typeof name !== "string" || !SNAPSHOT_NAME_RE.test(name)) {
    throw new StockPathError(/* ... */);
  }
  return name;
}
```

`vice_symbols_load`'s `path` argument follows the SAME workspace-containment discipline (resolve against `repoRoot()` from `repo-root.ts`, reject anything that escapes it) but must NEVER import `hostpath.ts` — `hostpath.ts` exists solely for the OPPOSITE direction (container path → HOST path, for a filename stock VICE itself opens across the wire). `vice_symbols_load` reads a file with Node's `fs` inside the MCP server's OWN process; there is no wire filename argument at all, so the translation `stock-paths.ts` exists for does not apply here. `hostpath-consumers.test.ts`'s closed five-member consumer list (`containerpath.ts`, `install-resources.ts`, `stock-paths.ts`, `vice-proxy.ts`, `vice-sync.ts`) must stay exactly five — `stock-symbols.ts` joining it would fail that test outright.

**Resolver replace, not merge:** "load" always calls `setSymbolResolver(newResolver)`, replacing whatever was installed previously — never merging into the existing table.

**Test analog (integration assertion against the live holder):** `stock-disassemble.test.ts`'s own `setSymbolResolver`/`afterEach(() => setSymbolResolver(null))` pattern (lines 13, 22-24) — `stock-symbols.test.ts` must reset the SAME holder in its own `afterEach`, and should include one assertion that after `handleSymbolsLoad` installs a table, `stock-address.ts`'s `parseAddress()` (imported directly in the test) resolves a symbol name with zero code changes anywhere else — the exact "no code change needed" claim 04-05's readiness note makes.

---

### `stock-vicii.ts` / `stock-cia.ts` (derived handlers, chip-state decode)

**Analog:** `stock-disassemble.ts`'s full shape (arg parse → ONE `sidefx:false` `MEM_GET` → decode → `stockAnswer()`), and the exact register-read snippet the research already verified live:

```typescript
// ALWAYS sidefx:false -- this is what avoids clearing $D01E/$D01F/$DC0D/$DD0D.
const body = memGetBody({ sidefx: false, start: 0xd000, end: 0xd02e, memspace: 0x00, bank: 0x0000 });
const response = await session.client.send(CommandType.MemoryGet, body);
if (response.type !== "memory_get") {
  return isErrorText(`vice_vicii_get_state: unexpected response type "${response.type}", expected "memory_get"`);
}
if (response.bytes.length !== 0x2f) {
  return isErrorText(`vice_vicii_get_state: expected 47 bytes, got ${response.bytes.length} -- a short read is a wrong answer`);
}
```

`vice_vicii_get_state` takes NO arguments at all (`additionalProperties: false`, confirmed live from the fork's `tools-manifest.json` line 409-414) — mirror `handleMemoryBanks`'s own "no arguments, refuse any extra key" preamble (`stock-memory.ts` lines 142-149):

```typescript
export const handleMemoryBanks: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_banks: arguments must be an object");
  }
  const unexpected = Object.keys(args);
  if (unexpected.length > 0) {
    return isErrorText(`vice_memory_banks: unexpected argument(s): ${unexpected.join(", ")} -- this tool takes no arguments`);
  }
  // ...
```

`vice_cia_get_state` takes one optional `cia` argument (1, 2, or omitted = both). One `MEM_GET(sidefx:false)` per CIA, over its 16-byte block ($DC00-$DC0F for CIA1, $DD00-$DD0F for CIA2). `memmap.json` register-name cross-check for the modules' header-comment provenance note (Assumption A4's mitigation — name the exact entries checked):

| Offset | Register name (from `memmap.json`) |
|--------|-------------------------------------|
| `$D011` | Screen control register #1 / VIC Control Register |
| `$D018` | Memory setup register / VIC Memory Control Register |
| `$D019` | Interrupt status register / VIC Interrupt Flag Register |
| `$D01A` | Interrupt control register / IRQ Mask Register |
| `$D01E` | Sprite-sprite collision register |
| `$D01F` | Sprite-background collision register |
| `$D02E` | Sprite #7 color (last VIC-II offset, 0x2E) |
| `$DC00` | CIA1 Port A (keyboard matrix / joystick #2) |
| `$DC0D` | CIA1 Interrupt control and status register |
| `$DD00` | CIA2 Port A (serial bus / VIC bank select) |

Per Pitfall 4, `$D019`/`$D01A` are plain read/write registers (no clear-on-read) and must be decoded exactly like every other byte in the block — the discipline is ONE unconditional `sidefx:false` read covering the WHOLE block, never a per-register branch.

**Unavailable-field wrapper (DERIV-05's Common Pitfall 3 / Pattern 4) — quote verbatim:**

```typescript
interface AvailableField<T> {
  available: true;
  value: T;
}
interface UnavailableField {
  available: false;
  reason: string;
}
type Field<T> = AvailableField<T> | UnavailableField;

rasterIrqLatch: {
  available: false,
  reason: "internal VIC-II latch, not exposed by the binary monitor's register map -- only the current raster line ($D012/$D011 bit 6) is readable",
} satisfies Field<number>,
```

Confirmed against `stock-schema-check.ts` (full file read, lines 1-171): this shape needs NO schema-checker change. `checkAgainstSchema()` already supports a `type: "object"` with `properties: { available: {...}, value: {...}, reason: {...} }` and no `required` (since exactly one of `value`/`reason` is present depending on `available`) — the checker's object-shaped-keyword branch (lines 129-158) walks `properties`/`required` independently per key and never requires BOTH `value` and `reason` to co-exist. Every internal-only field on both `vice_vicii_get_state` and `vice_cia_get_state`'s `outputSchema` declares `available`/`value|reason` this way.

**Wire-body regression test (Pitfall 4's own required guard):** `stock-vicii.test.ts`/`stock-cia.test.ts` must assert the captured `MEM_GET` body's `sidefx` byte (`body[0]`, per `memGetBody()`'s own encoding, `stock-protocol.ts` line 493: `body[0] = sidefx ? 0x01 : 0x00;`) is `0x00` on every call — mirror the `calls` array capture from `stock-disassemble.test.ts`'s `makeSession()` (below) and assert `calls[0][1][0] === 0x00`.

---

### `stock-sprites.ts` (derived handler, pointer-chain arithmetic + ASCII render)

**Analog (adapter/session shape):** `stock-disassemble.ts`, as above.

**Analog (arithmetic to port verbatim, not re-derive):** `.claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs`, full functions (lines 74-91, 121-122):

```javascript
export function vicBank(dd00Raw) {
  return 3 - (dd00Raw & 3);
}
export function screenBase(d018Raw, dd00Raw) {
  const bank = vicBank(dd00Raw);
  const bankBase = bank * 16384;
  const screenOffset = ((d018Raw >> 4) & 0xf) * 1024;
  return bankBase + screenOffset;
}
// sprite pointer table = screenBase + 0x3F8 .. 0x3FF (8 bytes)
const spritePointers = raw.sprite_pointers ?? [];
const spriteDataAddresses = spritePointers.map((p) => bankBase + p * 64);
```

**Verified regression fixture to reuse as-is in `stock-sprites.test.ts`:** `dd00_raw=193` (0xC1), `d018_raw=49` (0x31) → `screen_base=35840` (`dump-artifacts.mjs`'s own committed docstring, lines 82-84). Cross-check `vicBank(193) === 2` (bank base `32768`), `screenBase(49, 193) === 35840`.

**Port notes (what changes vs. what must not):**
- Changes: file extension (`.mjs` → `.ts`), module system stays ESM (no change needed — `.claude/mcp/vice` is already `"type": "module"`), add explicit return types (`number`) per this project's TypeScript convention, JSDoc header comment restating WHY (per CLAUDE.md's "documentation-as-code" pattern) rather than copying the skill's own header verbatim.
- Must NOT change: the bit arithmetic itself (`3 - (dd00Raw & 3)`, `bank * 16384`, `((d018Raw >> 4) & 0xf) * 1024`, `bankBase + pointerByte * 64`) — these are already fixture-verified; re-deriving them from the hardware description a second time is exactly the anti-pattern the research names.

**Read shape:** ONE `MEM_GET(sidefx:false)` over `$DD00` (1 byte, VIC bank) — or better, fold it into the SAME single read as `$D000-$D02E` if contiguous-enough, but `$DD00` is far from `$D000-$D02E` so this is realistically a second small `MEM_GET`, still `sidefx:false` — plus the sprite-pointer table (`screenBase + 0x3F8`, 8 bytes) and, for `vice_sprite_inspect`, the resolved 63-byte sprite data block. Each read follows the exact `memGetBody({ sidefx: false, ... })` → `session.client.send(CommandType.MemoryGet, body)` → `response.type !== "memory_get"` → length-check shape `stock-disassemble.ts` and `stock-memory.ts` both already use.

**ASCII legend (confirmed byte-for-byte from the fork's own `tools-manifest.json` description, line 1204):**
```
'.' = transparent (bit pair 00)
'#' = sprite colour (bit pair 10)
'@' = multicolour 1 (bit pair 01)
'%' = multicolour 2 (bit pair 11)
```
Render at native resolution per mode (24 cols hi-res / 12 cols multicolour, always 21 rows) — per the research's own recommendation, do not normalize.

**`format` enum trim:** `vice_sprite_inspect`'s stock `inputSchema` enum omits `'png_base64'`, keeping only `'ascii'` (default) and `'binary'` — same "no skill calls it" reasoning as D-15/D-16 (see Shared Patterns below).

---

## Shared Patterns

### Address/byte-count parsing
**Source:** `.claude/mcp/vice/stock-address.ts`, `parseAddress()` (lines 111-181) and `parseByteCount()` (lines 190-219).
**Apply to:** every `start`/`end`/`range1_start`/`range1_end`/`range2_start`/`address`/`sprite`-as-numeric-index argument across all 5 new modules. Every new module imports these two functions — never a family-local regex.

### Data-array validation
**Source:** `.claude/mcp/vice/stock-memory.ts`, `handleMemoryWrite`'s `data` array loop (lines 267-280), quoted in full above under `stock-memory-search.ts`.
**Apply to:** `vice_memory_search`'s `pattern`/`mask` arrays.

### Never-throw error conversion (exactly two converters, never a third)
**Source:** `.claude/mcp/vice/stock-handler.ts` — `isErrorText()` (line 63-65), `convertHandshakeError()` (lines 84-121), `convertWireError()` (lines 147-161), `stockAnswer()` (lines 172-175).
**Apply to:** every one of the 8 new handlers, identically to `stock-disassemble.ts`'s usage. No new handler may write its own wire-error prose or its own `{ content, isError }` literal outside `stockAnswer()`.

### `runState` on every answer
**Source:** `stockAnswer()` (`stock-handler.ts` line 172-175) — reads `runStateFor(client)` and merges it into the payload automatically. No handler ever supplies its own `runState` key.
**Apply to:** all 8 new handlers' successful answers (the two `needsSession: false` symbol tools never touch the client at all, so they build their own plain `{ content, isError: false }` result the same way `stock-disassemble.ts`'s never does — actually: since symbol tools never get a `session`, they cannot call `stockAnswer()` at all; they return a plain `StockOkResult` literal directly, e.g. `{ content: [{ type: "text", text: JSON.stringify({...}) }], isError: false }`, with no `runState` field, since there is no session to read one from).

### Refusal-by-name for an out-of-scope enum/mode value
**Source/precedent:** D-15 (`vice_checkpoint_set_ignore_count`, trimmed) and D-16 (`vice_snapshot_list`, deleted) — documented in `docs/stock-vice-parity.md` lines 65, 116-124.
**Apply to:**
- `vice_memory_compare`'s `mode: 'snapshot'` → refuse explicitly with reason text ("not implemented on stock — compare two live ranges captured at different points in time instead, or use `c64-ram-capture`'s own full-image diff"), checked BEFORE any `MEM_GET` is sent.
- `vice_symbols_load`'s `format: 'kickasm'` / `format: 'simple'` → refuse by name ("only VICE-format `.lbl`/`.vs` label files are supported on stock"); `format: 'auto'`/`'vice'` parse the `al C:xxxx .Name` pattern only.
- `vice_sprite_inspect`'s `format: 'png_base64'` → omitted from the stock `inputSchema` enum entirely (not merely refused at runtime — the enum itself narrows).

### Argument object shape guard
**Source:** `isPlainObject()`, duplicated identically across `stock-memory.ts` (line 37-39), `stock-disassemble.ts` (line 46-48), `stock-schema-check.ts` (line 41-43) — this module tree's own established convention of a small private per-file copy rather than a shared import.
**Apply to:** the first line of every new handler:
```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

### Symbol resolver — one holder, never a second
**Source:** `stock-address.ts` (full file, quoted above under `stock-symbols.ts`).
**Apply to:** `stock-symbols.ts` exclusively. No other new module may call `setSymbolResolver()`.

## Manifest Entry Shape

**Template (verbatim, `tools-manifest.stock.json` lines 785-839, the `vice_disassemble` entry):**

```jsonc
{
  "name": "vice_disassemble",
  "description": "Disassemble memory to 6502 instructions, computed client-side (DERIV-07) -- the binary monitor has no disassemble opcode. Stock divergences from the fork: ...",
  "inputSchema": {
    "type": "object",
    "properties": { "address": { "type": "string", "description": "..." }, "count": {...}, "end": {...}, "show_symbols": {...} },
    "required": ["address"]
  },
  "outputSchema": {
    "type": "object",
    "properties": { "address": {...}, "instructions": { "type": "array", "items": { "type": "object", "properties": {...}, "required": [...] } }, "runState": { "type": "string", "enum": ["running", "stopped", "unknown"] } },
    "required": ["address", "count", "instructions", "listing", "symbolsApplied", "limitReached", "runState"]
  }
}
```

Every one of the 8 new entries follows this exact two-schema shape: `inputSchema` mirrors the fork's own argument names/types (D-03), with stock-only narrowing (enum trims, refused modes named in the description text, not silently omitted); `outputSchema` is a full flat/nested object description including the `runState` enum for the 6 session-needing tools (the 2 symbol tools' answers have NO `runState` at all — they never touch a session — so their `outputSchema.required` must NOT list `runState`, unlike `vice_disassemble`'s).

**Fork input schemas for two of the eight (verbatim, cross-check that argument names/types match):**

`vice_memory_search` (`tools-manifest.json` lines 185-215):
```jsonc
{
  "type": "object",
  "properties": {
    "start": { "type": "string", "description": "Start address: number, hex string ($C000), or symbol name" },
    "end": { "type": "string", "description": "End address: number, hex string ($FFFF), or symbol name" },
    "pattern": { "type": "array", "description": "Byte pattern to find, e.g., [0x4C, 0x00, 0xA0] for JMP $A000", "items": { "type": "number" } },
    "mask": { "type": "array", "description": "Per-byte mask: 0xFF=exact match, 0x00=wildcard (optional)", "items": { "type": "number" } },
    "max_results": { "type": "number", "description": "Maximum matches to return (default: 100, max: 10000)" }
  }
}
```

`vice_vicii_get_state` (`tools-manifest.json` lines 409-414, takes no arguments at all):
```jsonc
{ "type": "object", "additionalProperties": false }
```

`vice_symbols_load` (`tools-manifest.json` lines 810-828):
```jsonc
{
  "type": "object",
  "properties": {
    "path": { "type": "string", "description": "Path to symbol file (.sym, .lbl)" },
    "format": { "type": "string", "description": "Format: 'auto' (default), 'kickasm', 'vice', or 'simple'. ..." }
  },
  "required": ["path"]
}
```

`vice_sprite_inspect` (`tools-manifest.json` lines 1203-1221):
```jsonc
{
  "type": "object",
  "properties": {
    "sprite_number": { "type": "number", "description": "Sprite number 0-7 to inspect" },
    "format": { "type": "string", "description": "Output format: 'ascii' (default), 'binary', or 'png_base64'" }
  },
  "required": ["sprite_number"]
}
```
(Stock's own `inputSchema` for this tool keeps `sprite_number`/`format` but narrows the `format` values described in `description` text to `'ascii'`/`'binary'` only.)

**Fork manifest must stay byte-identical (BACK-02 standing gate):** `fork-manifest-surface.test.ts` (lines 56-63) asserts `tools-manifest.json`'s `tools.length === 62` exactly — this phase touches ONLY `tools-manifest.stock.json`, never `tools-manifest.json`. Do not add, remove, or edit any fork entry.

## `{available:false, reason}` unavailability wrapper — schema-checker confirmation

**Source:** `.claude/mcp/vice/stock-schema-check.ts`, full file (171 lines), read live. `checkAgainstSchema()`'s supported keyword set (`type`, `properties`, `required`, `items`, `enum`, `additionalProperties`, line 34) already expresses the wrapper with zero changes: an object property declared as `{ "type": "object", "properties": { "available": { "type": "boolean" }, "value": {...}, "reason": { "type": "string" } } }` and no `required` array (or `required: ["available"]` only) validates either branch correctly, because the object-shaped-keyword branch (lines 129-158) checks each declared property independently and only enforces `required` for keys actually listed. No modification to this file is needed for Phase 5.

## Test-File Conventions

**Fake-session injection (source: `stock-disassemble.test.ts`, lines 1-46, quoted in full above under execution flow):**

```typescript
type SendCall = [number, Buffer];

function makeSession(sendImpl: (commandType: number, body: Buffer) => unknown): {
  session: StockConnectSession;
  calls: SendCall[];
} {
  const calls: SendCall[] = [];
  const client = Object.assign(new EventEmitter(), {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      calls.push([commandType, body]);
      return sendImpl(commandType, body);
    },
  });
  const session = { client } as unknown as StockConnectSession;
  return { session, calls };
}

const DEPS = {} as unknown as StockDispatchDeps;

function memoryGetReply(bytes: number[], requestId = 1) {
  return { type: "memory_get" as const, requestId, errorCode: ErrorCode.Ok, bytes: Buffer.from(bytes), related: [] };
}

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}
```

Every one of the 5 new test files reuses this EXACT `makeSession()`/`DEPS`/`memoryGetReply()`/`parseAnswer()` quartet (copy, don't reinvent) — `calls` is the assertion surface for "zero sends on an argument refusal" and for the `sidefx` wire-body regression guard (`calls[0][1][0] === 0x00`). `stock-symbols.test.ts` additionally needs `setSymbolResolver`/`afterEach(() => setSymbolResolver(null))` (`stock-disassemble.test.ts` lines 13, 22-24) since it is the one file that installs into that holder.

**`resetRunStateTrackersForTest()` in `beforeEach()`** (`stock-disassemble.test.ts` lines 18-20) is required in every new test file that constructs a fake session and calls a `needsSession: true` handler, since `stockAnswer()` reads `runStateFor(client)` and that tracker is module-level state that must not leak between tests.

**Guards that must not break:**
- `hostpath-consumers.test.ts` (full file, 112 lines, read live) — its five-member `EXPECTED_IMPORTERS` list (`containerpath.ts`, `install-resources.ts`, `stock-paths.ts`, `vice-proxy.ts`, `vice-sync.ts`) must stay EXACTLY those five; none of the 5 new modules may import `hostpath.ts`. Its fourth test loops `STOCK_DERIVED_TOOLS` and guesses a module name via `stock-${toolName.replace(/^vice_/, "")}.ts` (note: this guess uses UNDERSCORES from the tool name, e.g. `vice_memory_search` → guessed `stock-memory_search.ts`, NOT the real hyphenated `stock-memory-search.ts` — the guess simply will not match any real file for any of this phase's multi-word tool names, which is harmless since the assertion only checks ABSENCE from the importer set, but worth knowing so a plan task does not misread this as requiring underscore-named files).
- `fork-manifest-surface.test.ts` (lines 56-63) — the fork manifest's tool count stays exactly 62; this phase edits `tools-manifest.stock.json` only.
- `stock-dispatch.test.ts` — its own structural grep-gate ("zero occurrences of `forwardToVice(` in this file's own code lines") must keep passing; the 8 new table entries are plain `withDerivedTool(...)` calls, nothing that could introduce a fall-through.

## Packaging Closure (Phase 3 Rule 2)

**Source:** `scripts/check-npm-packages.mjs` (lines 72-113, read live) and `.claude/mcp/vice/package.json`'s `files[]` array (lines 10-50, read live).

The check-npm-packages.mjs comment names the exact precedent this phase repeats:
```javascript
// These five entries were added to files[] by 04-02 (stock-derived.ts) and
// 04-05 (stock-disassemble.ts, disasm-opcodes.ts, disasm-decoder.ts,
// disasm-renderer.ts) in the SAME COMMIT that made each reachable from
// vice-proxy.ts's import closure. This loop asserts every reachable local
// module is either an exact files[] entry or a resources/ prefix match.
```
followed by a transitive-closure walk (lines 89-113) that resolves every relative import reachable from `vice-proxy.ts` and asserts each target resolves to an entry in `vice.files` (either exact or `resources/`-prefixed).

**Action:** add exactly `stock-memory-search.ts`, `stock-symbols.ts`, `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts` to `package.json`'s `files[]` array (never the `.test.ts` siblings — `check-npm-packages.mjs` line 60-61 asserts zero test files leak into the tarball), in the SAME commit that adds their imports to `stock-dispatch.ts` (the commit that makes them reachable) — never a separate "wire it up" commit and a separate "ship it" commit. Insert alongside the existing Phase 4 entries (`stock-disassemble.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`, `package.json` lines 41-44) rather than at the end of the array, matching the file's existing family-grouped ordering.

## No Analog Found

None. Every new production file has at least one strong existing analog (`stock-disassemble.ts` for the adapter/session shape, `stock-address.ts`/`acme.mjs` for the symbol resolver and label-file parser, `dump-artifacts.mjs` for the sprite arithmetic), and every new test file has `stock-disassemble.test.ts`'s fake-session harness to copy directly.

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.ts` (all `stock-*.ts` family modules, `stock-handler.ts`, `stock-address.ts`, `stock-dispatch.ts`, `stock-derived.ts`, `stock-schema-check.ts`, `stock-paths.ts`, `stock-protocol.ts`), `.claude/mcp/vice/*.test.ts` (`stock-disassemble.test.ts`, `hostpath-consumers.test.ts`, `fork-manifest-surface.test.ts`), `.claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs`, `.claude/skills/acme-build/scripts/acme.mjs`, `scripts/check-npm-packages.mjs`, `.claude/mcp/vice/package.json`, `.claude/mcp/vice/tools-manifest.json`, `.claude/mcp/vice/tools-manifest.stock.json`, `.claude/skills/c64-memory-mapping/memmap.json`, `docs/stock-vice-parity.md`.
**Files scanned (read in full or targeted):** 17.
**Pattern extraction date:** 2026-08-17.
