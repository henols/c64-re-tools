# Phase 5: Skill-Critical Derived Tools - Research

**Researched:** 2026-08-17
**Domain:** Client-side MCP tool derivation over stock VICE's binary monitor (TypeScript/Node) — memory scanning, a pure client-side symbol table, memory-mapped chip-state decoding, and sprite pointer arithmetic + ASCII rendering
**Confidence:** HIGH (seam mechanics, opcode absence, register maps — all confirmed live against this repo's own source and `memmap.json`) / MEDIUM (exact fork answer shapes — the fork ships no `outputSchema`, so nothing is reproducible to check against) / LOW (regenerator2000 `.lbl` format compatibility, `vice_memory_compare`'s `mode: 'snapshot'` semantics — both genuinely unresolved upstream)

## Summary

Phase 5's eight tools split into four independent families, and for **all eight**
the finding is the same: **no binary-monitor opcode exists for any of them.**
`docs/phase0-binmon-findings.md`'s confirmed command set has no `MEMORY_SEARCH`,
`MEMORY_COMPARE`, or chip/sprite-state opcode, and `docs/roadmap-stock-vice.md`'s
own tool-by-tool mapping independently classifies all four families as
"Client-side derivation (compose over A)." Every one of the eight tools is
therefore built the same way this codebase already builds `vice_disassemble`:
one or more `MEM_GET` reads (with `sidefx: false`, never triggering the
project's own documented read-hazards) through the derived-tool seam Phase 4
already finished, decoded and shaped entirely client-side.

The seam itself needs **no new mechanism**. `withDerivedTool()` /
`STOCK_DERIVED_TOOLS` (`stock-derived.ts`, `stock-dispatch.ts`) already exist,
already support both a session-needing and a session-free branch, and
`hostpath-consumers.test.ts` already generalizes its asserted-absence check
across every future `STOCK_DERIVED_TOOLS` entry. Phase 5's seam work is
"register eight more tools through the adapter that already exists," not new
plumbing.

The one genuinely open design question this research could not close from
in-repo evidence is `vice_memory_compare`'s `mode: 'snapshot'` — the fork's own
schema names a `snapshot_name` with no corresponding memory-only snapshot tool
anywhere in either manifest, and no skill calls that mode. The second open
item is DERIV-04's second producer: regenerator2000's `--export_lbl` format has
not been probed against a real build (`R2000-16(c)` is unanswered), so the
symbol-file parser should be built against the one format this repo can
verify today (ACME's own `--vicelabels` output, confirmed byte-for-byte via
`acme-build/scripts/acme.mjs`'s own parser) and kept defensive rather than
assumed compatible with an unverified producer.

**Primary recommendation:** Build four new sibling-module families —
`stock-memory-search.ts` (search/compare), `stock-symbols.ts` (load/lookup,
installing into `stock-address.ts`'s existing `SymbolResolver` holder),
`stock-vicii.ts` + `stock-cia.ts` (chip-state decode), `stock-sprites.ts`
(sprite state + ASCII inspect) — each registering its tool(s) into
`STOCK_DISPATCH_TABLE` through `withDerivedTool()`, each declaring an
`outputSchema` in `tools-manifest.stock.json`, and each read backed by a
single `sidefx: false` `MEM_GET` (no chunking needed — the entire address
space fits one call). Scope `vice_memory_compare` to `mode: 'ranges'` only for
this phase and refuse `mode: 'snapshot'` by name with a stated reason;
scope `vice_symbols_load`'s `format` to `'vice'`/`'auto'` only, refusing
`'kickasm'`/`'simple'` by name; scope `vice_sprite_inspect`'s `format` to
`'ascii'` and `'binary'`, omitting `'png_base64'` — all three trims follow the
exact "no skill calls it" reasoning Phase 3's D-15/D-16 already established as
this project's own precedent for narrowing a tool's surface.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Memory search/compare (DERIV-01) | API/Backend (container-side MCP process, pure client-side scan) | Database/Storage (`MEM_GET`, itself a Database/Storage-tier concern from this server's point of view) | Client-side scan over one bounded read; no new wire mechanism |
| Symbol store (DERIV-04) | API/Backend (pure client-side state, no wire access at all) | — | `withDerivedTool(needsSession:false)` — the store never touches the emulator |
| VIC-II / CIA chip-state decode (DERIV-05) | API/Backend | Database/Storage (`MEM_GET` over the chips' memory-mapped register blocks) | Decoding is pure client-side bit arithmetic over one read per chip |
| Sprite state + ASCII inspect (DERIV-06) | API/Backend | Database/Storage (`MEM_GET` over VIC-II registers, `$DD00`, and the resolved sprite data block) | Pointer-chain arithmetic and ASCII rendering are pure client-side computation |
| The derived-tool seam itself (already built) | API/Backend | — | `withDerivedTool()`/`STOCK_DERIVED_TOOLS`/`STOCK_DISPATCH_TABLE` — no change needed, only new registrations |

No browser, SSR, or CDN tier exists in this architecture (a stdio MCP server
plus an external emulator process) — identical framing to Phase 4's map. The
one thing worth flagging for tier correctness: none of these four families
should ever import `hostpath.ts` (Database/Storage-adjacent host-path
translation belongs exclusively to tools that hand a filename to VICE itself
across the wire — none of these eight do).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DERIV-01 | User can search and compare memory ranges on the stock backend (narrowed: `fill` cut) | No `MEMORY_SEARCH`/`MEMORY_COMPARE` opcode exists (confirmed absent from `docs/phase0-binmon-findings.md`'s command set and independently classified as client-side derivation in `docs/roadmap-stock-vice.md`). Client-side scan over one `MEM_GET(sidefx:false)` read per range — the whole 64K address space fits one call (`memGetBody`'s start/end are each 0..0xffff). Fork schema for both tools captured verbatim below. |
| DERIV-04 | User can load a symbol file and have addresses resolved to symbol names | Pure client-side state (roadmap: "symbols load/lookup (pure client state)"). Installs into `stock-address.ts`'s existing `SymbolResolver` holder via `setSymbolResolver()` — the SAME holder Phase 4's `vice_disassemble` already reads from (`resolve`) and was widened for (`nameFor`). VICE label-file format (`al C:xxxx .Name`) confirmed live from `acme-build/scripts/acme.mjs:85`'s own parser regex. Second producer (regenerator2000 `--export_lbl`) is UNVERIFIED — `R2000-16(c)` has not been run. |
| DERIV-05 (read side) | User can read decoded VIC-II and CIA state, with unavailable internal fields explicitly marked unavailable, never zero | No opcode; client-side decode of one `MEM_GET(sidefx:false)` per chip (VIC-II $D000-$D02E, 47 bytes; CIA1 $DC00-$DC0F / CIA2 $DD00-$DD0F, 16 bytes each — all four ranges cross-verified against `memmap.json` and against the fork's own `*_set_state` tool descriptions' stated offset ranges). `sidefx:false` is what makes this read safer than the fork's own documented-as-unverified read path (`docs/stock-vice-parity.md` item 5) — a genuine stock advantage, not merely a port. Internal-only fields (raster-IRQ latch, timer latches, flip-flops) are enumerated and their unavailability representation is proposed below. |
| DERIV-06 (read side) | User can read and inspect sprites, including ASCII rendering | No opcode; pointer-chain arithmetic (`$DD00` bank → `$D018` screen base → sprite pointer table at screen+`$03F8` → `pointer*64` data address) already implemented and tested client-side in `c64-ram-capture/scripts/dump-artifacts.mjs` — reuse those formulas verbatim, do not re-derive. ASCII legend confirmed byte-for-byte from the fork's own tool description in `tools-manifest.json`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are locked, not discretionary, and this research treats them as such:

- **Derived tools MUST be intercepted before `forwardToVice()`, never behind
  `call()`.** Already satisfied structurally by Phase 4's seam — every one of
  this phase's eight tools registers through `withDerivedTool()` into
  `STOCK_DISPATCH_TABLE`, which `buildBackendAwareTool()` routes to on the
  stock backend BEFORE `forwardToVice()`/`rewriteArguments()` exist in the call
  path at all. No new interception work; only new registrations.
- **The stdio tool surface is trimmed per backend; a tool on both backends
  keeps the same name and argument shape; the fork's list stays unchanged from
  v0.1.x.** All eight new tools already exist on the fork with the argument
  shapes captured verbatim below (Standard Stack / Code Examples). D-03 of
  Phase 3 (required argument names/types match the fork's; stock-only optional
  extras permitted) applies unchanged. `tools-manifest.json` (fork) is not
  touched by this phase.
- **SID `$D400-$D418` is write-only; VIC-II/CIA internal state (raster-IRQ
  latch, timer latches) is not readable — only the readable register map is.**
  This is the load-bearing constraint for DERIV-05's Common Pitfall 3 below:
  every internal-only field must be represented as explicitly unavailable,
  never omitted and never zero.
- **Node >= 22.18, no build step for the shipped server; host-bound `.mts`
  files are compiled by `build.ts` into `resources/*.mjs`.** All Phase 5 code
  is container-side `.ts`, exactly like Phase 3/4's family modules — **no
  `.mts` file is touched by this phase, and no `build.ts` rebuild is implied.**
  Confirmed by inspection: none of the four new families need broker/launcher
  changes; they are pure `MEM_GET`-composition tools.
- **Tests are colocated `*.test.ts`, run by `node --test`, no separate
  framework.** Matches every existing `stock-*.ts`/`stock-*.test.ts` pair in
  this tree.

## Standard Stack

### Core
No new runtime dependency is needed or proposed — every one of the eight
tools is Node built-ins plus this repo's own existing seams (`stock-address.ts`,
`stock-handler.ts`, `stock-dispatch.ts`, `stock-protocol.ts`).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-ins only | Node >= 22.18 (repo floor) | Byte-array scanning, bit decoding, string formatting, `node:fs` for symbol-file loading | Matches the project's existing zero-runtime-dependency posture for `.claude/mcp/vice` |

### Supporting
None. No CI tool, no apt package, no external binary is needed by this phase
(unlike Phase 4's ACME dependency for the disassembler round-trip).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-transcribing ~15 VIC-II/CIA bit-field decodes into a committed TS module | Importing `.claude/skills/c64-memory-mapping/memmap.json` at runtime from the MCP server package | Rejected: `memmap.json` lives in a DIFFERENT package's directory (`.claude/skills/c64-memory-mapping/`), not `.claude/mcp/vice/`'s `files[]` — the exact same repo-root-vs-package-dir tarball gap Phase 4's Pitfall 2 found for `THIRD-PARTY-NOTICES.md`. A runtime cross-package import would either be silently absent from the published npm tarball (breaking at runtime for any consumer who installed via npm rather than the plugin) or require duplicating ~959 JSON entries' worth of `files[]` bloat for ~40 registers' actual need. Transcribe once, cross-checked against `memmap.json` at write time (as this research did), the same "committed literal, cross-checked once" pattern D-06 of Phase 4 used for the opcode table. |
| Parsing VICE's `.vsf` snapshot format to serve `vice_memory_compare`'s `mode: 'snapshot'` without touching the live machine | Restoring the named snapshot (destructive) then reading, or refusing the mode outright | Recommended: refuse `mode: 'snapshot'` by name for this phase (see Open Questions) — no skill calls it, the `.vsf` internal module layout is unverified in this repo, and guessing at binary offsets for a feature nothing needs is exactly the kind of unrequested complexity this milestone's own scope-cut precedent (D-15/D-16, Phase 3) argues against. |
| A PNG encoder for `vice_sprite_inspect`'s `format: 'png_base64'` | ASCII + binary formats only | Rejected building the encoder: `SHOT-01`..`SHOT-05` were cut from this exact milestone specifically because no skill calls `vice_display_screenshot`'s PNG path — the identical reasoning applies here; no skill's `vice_sprite_inspect` call ever names `format`, so it defaults to `'ascii'`. |

**Installation:** None — no new package, no new CI step.

**Version verification:** Not applicable — DISASM-07's "no new npm dependency"
posture (carried forward as this codebase's standing convention, not a Phase 5
requirement by name) is satisfied trivially since nothing new is proposed.

## Package Legitimacy Audit

Not applicable — this phase adds zero new npm/pip/cargo packages and zero new
external (apt/binary) dependencies. `slopcheck`/registry verification is
skipped because no package name is being introduced.

**Packages removed due to slopcheck verdict:** none — none proposed.
**Packages flagged as suspicious:** none — none proposed.

## Architecture Patterns

### System Architecture Diagram

```
Claude Code (MCP client)
        │  tools/call { name: "vice_memory_search" | "vice_symbols_load" | ... }
        ▼
vice-proxy.ts  CallToolRequestSchema handler (deny-list, tool lookup)
        │
        ▼
buildBackendAwareTool()  ◄── the ONE fork/stock split (unchanged since Phase 2)
        │
        ├── backend === "fork" ──► forwardToVice() ─► rewriteArguments() ─► call() ─► fork HTTP /mcp
        │                            (UNCHANGED by this phase -- fork implements all 8 in-emulator)
        │
        └── backend === "stock" ─► dispatchStock(name, args, deps)   [stock-dispatch.ts]
                                        │
                                        ├─ STOCK_DISPATCH_TABLE[name]
                                        │
                                        │   memory search/compare ──► withDerivedTool(needsSession:true)
                                        │     stock-memory-search.ts    → MEM_GET(sidefx:false) once per range
                                        │                                 → client-side pattern/mask scan or byte diff
                                        │
                                        │   symbols load/lookup ─────► withDerivedTool(needsSession:false)
                                        │     stock-symbols.ts           → fs.readFile the workspace-relative path
                                        │                                 → parse "al C:xxxx .Name" lines
                                        │                                 → setSymbolResolver({resolve, nameFor})
                                        │                                    into stock-address.ts's ONE holder
                                        │                                    (the SAME holder vice_disassemble
                                        │                                    already reads from, Phase 4)
                                        │
                                        │   vicii/cia get_state ─────► withDerivedTool(needsSession:true)
                                        │     stock-vicii.ts/stock-cia.ts → MEM_GET(sidefx:false) over the
                                        │                                    chip's register block
                                        │                                 → decode bytes into named bit fields
                                        │                                 → wrap internal-only fields as
                                        │                                    { available:false, reason }
                                        │
                                        │   sprite get/inspect ──────► withDerivedTool(needsSession:true)
                                        │     stock-sprites.ts           → MEM_GET($DD00, $D000-$D02E)
                                        │                                 → resolve bank/screen/pointer/data
                                        │                                    (formulas reused from
                                        │                                    c64-ram-capture/dump-artifacts.mjs)
                                        │                                 → MEM_GET(63-byte sprite data block)
                                        │                                 → ASCII-render per multicolour bit
                                        │
                                        └─ table miss ── explicit "not implemented by stock" refusal (unchanged)

All four families reuse, never re-derive: stockAnswer()/convertWireError()/
convertHandshakeError() (stock-handler.ts), parseAddress()/parseByteCount()
(stock-address.ts), memGetBody() (stock-protocol.ts), STOCK_DERIVED_TOOLS /
derivedContainerPath() (stock-derived.ts).
```

### Recommended Project Structure
```
.claude/mcp/vice/
├── stock-dispatch.ts            # existing -- adds 4 imports + 8 table entries under withDerivedTool(), no structural change
├── stock-derived.ts             # existing -- STOCK_DERIVED_TOOLS grows from 1 to 9 entries
├── stock-memory-search.ts       # NEW -- vice_memory_search, vice_memory_compare(mode:'ranges')
├── stock-memory-search.test.ts  # NEW
├── stock-symbols.ts             # NEW -- vice_symbols_load, vice_symbols_lookup; installs into stock-address.ts's SymbolResolver holder
├── stock-symbols.test.ts        # NEW
├── stock-vicii.ts               # NEW -- vice_vicii_get_state
├── stock-vicii.test.ts          # NEW
├── stock-cia.ts                 # NEW -- vice_cia_get_state
├── stock-cia.test.ts            # NEW
├── stock-sprites.ts             # NEW -- vice_sprite_get, vice_sprite_inspect
├── stock-sprites.test.ts        # NEW
├── stock-address.ts             # existing -- NO code change needed (SymbolResolver hook already widened in Phase 4)
├── hostpath-consumers.test.ts   # existing -- STOCK_DERIVED_TOOLS loop already generalizes; no edit needed unless a naming mismatch is found
├── tools-manifest.stock.json    # existing -- 8 new entries (inputSchema + outputSchema), 26 -> 34 tools
├── package.json                 # existing -- files[] gains the 5 new production modules (test files never ship)
└── docs/stock-vice-parity.md    # existing -- record this phase's divergences (mode:'snapshot' refusal, format:'png_base64' omission, format:'kickasm'/'simple' omission)
```

### Pattern 1: Every new handler is `withDerivedTool()`-registered, exactly like `vice_disassemble`
**What:** No new adapter, no new dispatch table. Each of the 8 tools is one
more line in `STOCK_DISPATCH_TABLE`, one more entry in `STOCK_DERIVED_TOOLS`.
**When to use:** Every tool in this phase.
**Example (the exact registration shape to copy, from `stock-dispatch.ts`):**
```typescript
// derived (DERIV-01)
vice_memory_search: withDerivedTool("vice_memory_search", { needsSession: true }, handleMemorySearch),
vice_memory_compare: withDerivedTool("vice_memory_compare", { needsSession: true }, handleMemoryCompare),

// derived (DERIV-04) -- no session: pure client-side state, never touches the wire
vice_symbols_load: withDerivedTool("vice_symbols_load", { needsSession: false }, handleSymbolsLoad),
vice_symbols_lookup: withDerivedTool("vice_symbols_lookup", { needsSession: false }, handleSymbolsLookup),

// derived (DERIV-05)
vice_vicii_get_state: withDerivedTool("vice_vicii_get_state", { needsSession: true }, handleViciiGetState),
vice_cia_get_state: withDerivedTool("vice_cia_get_state", { needsSession: true }, handleCiaGetState),

// derived (DERIV-06)
vice_sprite_get: withDerivedTool("vice_sprite_get", { needsSession: true }, handleSpriteGet),
vice_sprite_inspect: withDerivedTool("vice_sprite_inspect", { needsSession: true }, handleSpriteInspect),
```
And in `stock-derived.ts`:
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
**Important, `symbols_load`/`symbols_lookup` are the ONLY `needsSession: false`
tools in this phase** — they never touch the emulator at all, which means
loading a symbol table never halts a running program (a genuine ergonomic
win the fork cannot claim, since the fork's `vice_symbols_load` almost
certainly still round-trips through the emulator process).

### Pattern 2: The symbol store installs into `stock-address.ts`'s existing holder — it does not create a second one
**What:** `stock-address.ts`'s `SymbolResolver` interface already has both
`resolve(name): number|undefined` and the optional `nameFor(address):
string|undefined` (widened in Phase 4, 04-05). DERIV-04's job is to build ONE
object implementing both and call the existing `setSymbolResolver()`.
**When to use:** `vice_symbols_load`'s handler, on every successful load
(replacing whatever was previously installed — "load" is a replace, not a
merge, matching the fork's own single active symbol table framing).
**Example:**
```typescript
// stock-symbols.ts
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
`vice_disassemble`'s `show_symbols` and every future symbolic-address caller
picks this up with **zero code changes anywhere else** — confirmed by 04-05's
own "Next Phase Readiness" note: "Phase 5's DERIV-04 store, when it lands,
installs an object implementing both `resolve()` and `nameFor()` into
`stock-address.ts`'s one holder via the existing `setSymbolResolver()` — no
code change needed in this plan's files to pick it up."

### Pattern 3: Reuse the sprite pointer-chain formulas verbatim — they are already implemented and tested
**What:** `c64-ram-capture/scripts/dump-artifacts.mjs` already implements and
tests `vicBank(dd00Raw)`, `screenBase(d018Raw, dd00Raw)`, and
`spriteDataAddresses` (pointer table → data address), verified against a
committed real capture (`dd00_raw=193, d018_raw=49 -> screen_base=35840`).
**When to use:** `stock-sprites.ts`'s pointer resolution for both
`vice_sprite_get` and `vice_sprite_inspect`.
**Example (verified against the real file this session):**
```javascript
// Source: .claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs (read live)
export function vicBank(dd00Raw) {
  return 3 - (dd00Raw & 3);                       // $DD00 bits 0-1, INVERTED
}
export function screenBase(d018Raw, dd00Raw) {
  const bank = vicBank(dd00Raw);
  const bankBase = bank * 16384;
  const screenOffset = ((d018Raw >> 4) & 0xf) * 1024;
  return bankBase + screenOffset;
}
// Sprite pointer table = screenBase + 0x3F8 .. 0x3FF (8 bytes)
// Sprite N's data address = bankBase + pointerByte[N] * 64
```
Port this to TypeScript in `stock-sprites.ts` rather than re-deriving the
arithmetic from the hardware description a second time — the JS is already
correct and has a real regression fixture behind it.

### Pattern 4: Unavailable internal fields are wrapped, never omitted, never zero
**What:** DERIV-05's own wording ("never reported as zero") demands a
concrete representation, not just a policy. Recommend a per-field wrapper
applied uniformly.
**When to use:** `vice_vicii_get_state`'s raster-IRQ latch and any internal
timing state; `vice_cia_get_state`'s timer LATCH values (as opposed to
CURRENT counts, which the register map does expose).
**Example:**
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

// e.g. in the VIC-II answer:
rasterIrqLatch: { available: false, reason: "internal VIC-II latch, not exposed by the binary monitor's register map -- only the current raster line ($D012/$D011 bit 6) is readable" } satisfies Field<number>,
```
`outputSchema` for such a field declares it as an object with `available` and
either `value` or `reason` — `checkAgainstSchema()`'s supported keyword subset
(`type`/`properties`/`required`/`items`/`enum`/`additionalProperties`) can
express this directly with no schema-checker changes needed.

### Anti-Patterns to Avoid
- **A second `SymbolResolver` holder, or a re-derived address→name map inside
  `stock-symbols.ts`.** `stock-address.ts`'s own header comment already
  forbids this explicitly ("Never add a second resolver holder").
- **Chunked/paginated `MEM_GET` reads for search or chip-state.** Unnecessary:
  `memGetBody()`'s `start`/`end` are each bounded 0..0xffff, so any range up to
  the full 64K address space is one call — confirmed by `stock-memory.ts`'s
  existing `vice_memory_read` handler, which already sends single-call reads
  up to size 0xffff, and by the protocol client's own buffer sizing being
  proven against a ~157KB `DISPLAY_GET` frame (well above a 64KB `MEM_GET`
  response).
- **A side-effecting (`sidefx: true`) read anywhere in these four families.**
  Every one of DERIV-05/06's reads touches at least one register this
  project's own skill docs (`observation-hazards.md`, `sound-and-input.md`)
  explicitly warn clears on read (`$D01E`/`$D01F`, `$DC0D`/`$DD0D`). `stock-
  disassemble.ts`'s own header comment states the rule for its own case
  ("Never turn the MEM_GET body's side-effect flag on") — the same discipline
  applies here, with higher stakes, since these tools exist specifically to
  read those registers.
- **Building a PNG encoder or a `.vsf`-snapshot parser "just in case."** Both
  were considered and rejected above (Standard Stack / Alternatives) on the
  same "no skill calls it" basis this milestone already used to cut
  `SHOT-01`..`05` and `GAIN-01`..`09` wholesale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session acquisition + error conversion | A second `ensureStockSession()`-equivalent | `withDerivedTool()`'s existing `needsSession: true` branch, which delegates to the same `ensureStockSession()`/`convertHandshakeError()`/`convertWireError()` trio every other family uses | Already the tested, `runState`-attaching, never-throw seam every existing tool uses |
| Address/byte-count parsing for `start`/`end`/`range1_start`/`sprite`/`address` arguments | A family-specific regex parser | `stock-address.ts`'s `parseAddress()`/`parseByteCount()` | D-04 of Phase 3 built this specifically so every family shares one parser and one symbol-resolution hook — the SAME hook DERIV-04 installs into |
| VIC bank / screen base / sprite data address arithmetic | Re-deriving the bit shifts from the hardware description | `c64-ram-capture/scripts/dump-artifacts.mjs`'s `vicBank()`/`screenBase()`/pointer-to-data formulas, ported to TS | Already implemented, already has a real regression fixture (`dd00_raw=193, d018_raw=49 -> screen_base=35840`) |
| `outputSchema` conformance checking | A hand-rolled deep-equal/type-check | `stock-schema-check.ts`'s `checkAgainstSchema()` | Dependency-free, already built, already supports the flat object/array/enum shapes every one of this phase's answers needs (including the `available`/`reason` wrapper pattern above) |
| VIC-II/CIA register bit-field names and meanings | A second bit table hand-derived from raw datasheet knowledge with no cross-check | `.claude/skills/c64-memory-mapping/memmap.json`'s existing entries, read (not imported at runtime — see Standard Stack) and transcribed once, cross-checked | This repo already carries a source-cross-checked register map; re-deriving a second one from memory risks a silent field-meaning error nobody would catch |

**Key insight:** Every one of this phase's four families composes primitives
Phase 3/4 already built and tested (`MEM_GET` via `stock-memory.ts`'s pattern,
`parseAddress()`, `withDerivedTool()`, `stockAnswer()`, the symbol-resolver
hook). The genuinely new work is the DECODING logic (bit fields, pointer
arithmetic, pattern matching, ASCII rendering) — everything around it is
composition, not invention.

## Common Pitfalls

### Pitfall 1: Assuming a `MEMORY_SEARCH`/`MEMORY_COMPARE` opcode exists somewhere unexplored
**What goes wrong:** Time spent hunting the binary-monitor opcode table for a
search/compare primitive that does not exist, when the actual work is a
client-side scan.
**Why it happens:** The fork's tool descriptions read like thin wrappers over
a monitor primitive ("Search for byte patterns in memory with optional
wildcards") and could plausibly map to a VICE command if one were not looked
up directly.
**How to avoid:** `docs/phase0-binmon-findings.md` §5's confirmed command set
is exhaustive and has no such opcode; `docs/roadmap-stock-vice.md`'s own
"Client-side derivation" bucket independently lists "memory search / compare /
fill" by name. Both sources agree — this is settled, not a research gap.
**Warning signs:** A plan task that says "encode the search request body" —
there is no such wire message.

### Pitfall 2: `vice_memory_compare`'s `mode: 'snapshot'` has no producer tool anywhere in either manifest
**What goes wrong:** Implementing `mode: 'snapshot'` by silently reinterpreting
`snapshot_name` as a `vice_snapshot_save` name and either (a) destructively
restoring the whole machine to read memory out of it, corrupting whatever
session state the agent had, or (b) guessing at the VICE `.vsf` binary
snapshot module layout to extract main RAM without restoring — both are
high-risk without verification.
**Why it happens:** The fork's schema names `snapshot_name` right next to
`vice_snapshot_save`'s own snapshot concept, making the connection look
obvious, but grepping every skill and script in this repo shows **zero**
callers of `vice_memory_compare` with `mode: 'snapshot'` — the skills only
ever use the comparison-of-two-live-ranges idea (`control-flow.md`: "pause at
a title screen and again in gameplay, diff the two captures").
**How to avoid:** Scope this phase's `vice_memory_compare` to `mode: 'ranges'`
only. Refuse `mode: 'snapshot'` explicitly, naming the reason ("not
implemented on stock — compare two live ranges captured at different points
in time instead, or use `c64-ram-capture`'s own full-image diff"), following
the exact precedent Phase 3's D-15 (`vice_checkpoint_set_ignore_count`, trimmed
entirely) and D-16 (`vice_snapshot_list`, deleted) already set for "no
consumer, no obligation to build it."
**Warning signs:** A plan task titled "parse the VSF snapshot format" — this
was never verified against a real `.vsf` file in this session and there is no
existing in-repo parser to build on.

### Pitfall 3: Reporting an unavailable internal chip-state field as `0` or omitting it
**What goes wrong:** A caller reads `rasterIrqLatch: 0` and cannot tell "the
latch is genuinely at 0" from "this field cannot be read on stock" — exactly
the ambiguity Success Criterion 3 exists to forbid, and exactly the trap
CLAUDE.md's own SID-write-only constraint names as the general shape of this
hazard class.
**Why it happens:** The natural first draft of a decoder just fills in
whatever `undefined` decodes to, or defaults a missing bit-field to 0.
**How to avoid:** Pattern 4 above — every internal-only field is `{available:
false, reason: "..."}`, applied uniformly and asserted by a test that
specifically checks these fields are objects with `available === false`, not
absent keys and not the number `0`.
**Warning signs:** A decoder function that returns a flat number for every
field with no per-field availability wrapper.

### Pitfall 4: Treating `$D019`/`$D01A` the same as `$D01E`/`$D01F`, or `MEM_GET`'s `sidefx:false` as a magic fix for everything
**What goes wrong:** Either (a) assuming ALL VIC-II/CIA status registers clear
on read and therefore needlessly complicating the decode with speculative
side-effect avoidance for registers that don't need it, or (b) the inverse —
assuming `sidefx:false` alone is what protects `$D01E`/`$D01F`/`$DC0D`/`$DD0D`
without actually setting it, and shipping a side-effecting read by omission.
**Why it happens:** The four side-effecting registers are easy to conflate
with `$D019` (interrupt STATUS — different register, does not clear on read;
cleared only by WRITING a 1 to the bit) and `$D01A` (interrupt ENABLE mask,
plain read/write, no side effects at all).
**How to avoid:** This project's own skill docs single out EXACTLY four
registers as read-hazards: `$D01E`, `$D01F` (VIC collisions), `$DC0D`, `$DD0D`
(CIA interrupt status) — never `$D019`/`$D01A`. Use `sidefx: false`
UNCONDITIONALLY for the entire chip-state `MEM_GET` (it is harmless on the
non-hazardous registers and load-bearing on the four hazardous ones), and
write a dedicated test asserting the wire body's `sidefx` byte is `0x00` for
both `stock-vicii.ts` and `stock-cia.ts`, mirroring `stock-disassemble.ts`'s
own header-comment discipline ("Never turn the MEM_GET body's side-effect
flag on").
**Warning signs:** A decoder or test that special-cases `$D01E`/`$D01F`/
`$DC0D`/`$DD0D` with a different read call than the rest of the block — the
correct shape is ONE `sidefx:false` read per chip covering every offset,
never a per-register side-effect decision.

### Pitfall 5: Assuming regenerator2000's `--export_lbl` output is byte-compatible with the parser this phase writes
**What goes wrong:** Building `vice_symbols_load`'s `'vice'` format parser
against an assumption of regenerator2000's exact output (whitespace,
comments, memspace-letter casing) rather than against the one format actually
observed in this repo (ACME's `--vicelabels` output).
**Why it happens:** `.planning/notes/regenerator2000-integration.md` states
"r2000's `--export_lbl` emits VICE label files" as a design premise, but its
own "Verification owed before planning" section (`R2000-16(c)`) explicitly
lists this as UNVERIFIED, and no probe has been run in this repo (confirmed:
no regenerator2000 artifacts, fixtures, or probe scripts exist anywhere in the
tree).
**How to avoid:** Build the parser against the CONFIRMED format
(`^al\s+C:[0-9a-f]+\s+\.(\S+)`, case-insensitive on the hex, confirmed live
from `acme-build/scripts/acme.mjs:85`'s own regex and cross-checked against a
real worked build example in `acme-build/SKILL.md`), and write it defensively:
tolerate blank lines and any line that does not match the `al` pattern by
skipping it silently (VICE's own text-monitor "add label" script format is
line-oriented and typically permits other commands interleaved), rather than
refusing the whole file on the first unrecognized line. Do not claim
compatibility with regenerator2000's output beyond "should work if it emits
the same `al C:xxxx .Name` syntax" — record this explicitly as an assumption
(see Assumptions Log) so `R2000-16(c)` running later either confirms or
contradicts a stated bet, not a silent one.
**Warning signs:** A `THIRD-PARTY-NOTICES.md` or parity-doc entry claiming
"regenerator2000-compatible" as a verified fact rather than an assumption.

## Code Examples

### The fork's exact argument shapes for all eight tools (verified live against `tools-manifest.json`)
```jsonc
// vice_memory_search
{ "start": "string", "end": "string", "pattern": "number[]", "mask?": "number[]", "max_results?": "number (default 100, max 10000)" }
// required: start, end, pattern

// vice_memory_compare
{ "mode": "'ranges'|'snapshot'", "range1_start?": "string", "range1_end?": "string", "range2_start?": "string",
  "snapshot_name?": "string", "start?": "string", "end?": "string", "max_differences?": "number (default 100, max 10000)" }
// required: mode. NOTE: no range2_end -- range2 takes range1's length. NOTE: no memory-only
// snapshot producer tool exists anywhere in either manifest (see Pitfall 2).

// vice_symbols_load
{ "path": "string", "format?": "'auto'|'kickasm'|'vice'|'simple' (default auto)" }
// required: path

// vice_symbols_lookup
{ "name?": "string", "address?": "number" }
// neither required by the fork's own schema -- recommend refusing only when BOTH are omitted

// vice_vicii_get_state
{}   // additionalProperties: false -- takes no arguments at all

// vice_cia_get_state
{ "cia?": "number (1 or 2, default both)" }

// vice_sprite_get
{ "sprite?": "number (0-7, omit = all sprites)" }

// vice_sprite_inspect
{ "sprite_number": "number (0-7)", "format?": "'ascii'(default)|'binary'|'png_base64'" }
// required: sprite_number. Recommend omitting 'png_base64' from the stock enum (Pitfall/Alternatives above).
```

### Reading a chip's register block (the pattern every DERIV-05/06 handler follows)
```typescript
// Source: .claude/mcp/vice/stock-memory.ts (read live this session), adapted.
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

### VIC bank and screen base (verified live against the real file, `c64-ram-capture/scripts/dump-artifacts.mjs`)
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
// Sprite pointer table: screenBase(...) + 0x3F8, 8 bytes.
// Sprite N data address: bankBase + pointerByte[N] * 64.
```

### VICE label-file line format (confirmed live against `acme-build/scripts/acme.mjs:85`)
```
al C:0810 .SomeLabel
```
```javascript
// The exact confirmed regex this repo's own parser uses:
const m = line.match(/^al\s+C:[0-9a-f]+\s+\.(\S+)/i);
// group 1 is the label name; the hex after "C:" is the address; "C:" is the
// TEXT-monitor's memspace-letter convention for "computer"/main memory --
// distinct from the wire protocol's 0x00 memspace byte, but the same concept.
```

### The ASCII sprite legend (confirmed byte-for-byte from the fork's own `tools-manifest.json` description)
```
'.' = transparent (bit pair 00)
'#' = sprite colour (bit pair 10)
'@' = multicolour 1 (bit pair 01)
'%' = multicolour 2 (bit pair 11)
```
For a non-multicolour (hi-res) sprite, decode one BIT per pixel (24 columns
per row): `1 -> '#'`, `0 -> '.'` — `'@'`/`'%'` only ever appear when `$D01C`'s
bit for this sprite is actually set, decoded per-sprite, never assumed
globally.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fork's in-emulator chip/sprite/search/symbol tools (opaque, undocumented answer shapes — no `outputSchema` anywhere in `tools-manifest.json`) | Client-side derivation with declared `outputSchema` on every stock entry | This phase | Machine-checkable answers; but a skill parsing fork answer FIELDS breaks on stock — already flagged as a standing SKILL-01 (Phase 8) concern by Phase 3's D-01, and this phase adds four more tool families' worth of the same drift |
| Fork's chip-state reads (side-effect behaviour explicitly marked "unverified" in this project's own skill docs) | `MEM_GET(sidefx:false)` — provably side-effect-free per `docs/stock-vice-parity.md` item 5 | This phase | A genuine stock ADVANTAGE, not merely a port — record this in the parity doc as a stock GAIN for DERIV-05, not only a "partial loss" |

**Deprecated/outdated:** None specific to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | regenerator2000's `--export_lbl` output is compatible with the `al C:xxxx .Name` VICE label-file parser this phase builds against ACME's confirmed output | Common Pitfalls Pitfall 5, Phase Requirements DERIV-04 | Medium — if the real format differs (different memspace letter, different comment syntax, different whitespace), the v0.3.0 symbol round trip (`R2000-14`) silently fails to load real regenerator2000 exports even though this phase's own tests (built against ACME output) all pass. Mitigation already built in: defensive line-skipping rather than whole-file refusal, and this assumption is flagged rather than asserted as verified. `R2000-16(c)` should be run before v0.3.0 Phase 10 relies on this. |
| A2 | `$D019`/`$D01A` do not clear or otherwise side-effect on read (standard 6567/6569 VIC-II hardware behaviour: `$D019` is cleared only by WRITING a 1 to a bit; `$D01A` is a plain enable mask) | Common Pitfalls Pitfall 4 | Low — this is well-established 6502/VIC-II hardware knowledge, not sourced from VICE's own source in this session, but consistent with this project's own in-repo skill docs which name ONLY `$D01E`/`$D01F`/`$DC0D`/`$DD0D` as read-hazards and never mention `$D019`/`$D01A` in that context. Even if this assumption were somehow wrong, the unconditional `sidefx:false` read this phase recommends for the ENTIRE chip block would still protect it — the assumption only affects whether a future single-register fast-path could safely skip `sidefx:false`, which this research does not recommend building anyway. |
| A3 | `vice_memory_compare`'s fork `mode: 'snapshot'` has no dedicated memory-only snapshot producer and is genuinely unreachable without either a destructive restore or an unverified `.vsf` parse | Common Pitfalls Pitfall 2 | Low — confirmed by grepping BOTH manifests for any snapshot-producing tool besides `vice_snapshot_save` (a whole-machine `.vsf` dump) and confirming zero skill callers of `mode:'snapshot'`. If a producer does exist that this research missed, the cost of being wrong is simply that the refusal text undersells a buildable feature — not a correctness bug. |
| A4 | The VIC-II/CIA bit-field names transcribed from `memmap.json` into the new TS modules will be transcribed correctly and stay in sync if `memmap.json` is later revised | Standard Stack Alternatives, Don't Hand-Roll | Low — the SAME risk class Phase 4's D-06 already accepted for the opcode table (a committed literal, cross-checked once, not re-verified automatically against its source on every change). No automated drift check is proposed; a manual note in the new modules' header comments pointing at the exact `memmap.json` entries checked is the mitigation, matching this codebase's existing provenance-comment convention. |

## Open Questions

1. **`vice_memory_compare`'s `mode: 'snapshot'` — build it, refuse it, or defer it?**
   - What we know: no skill calls it; no memory-only snapshot producer tool
     exists in either manifest; `vice_snapshot_save` only produces
     whole-machine `.vsf` dumps.
   - What's unclear: whether the fork's own implementation actually restores
     the snapshot to read it (destructive, expensive) or has some
     out-of-band memory cache this repo has no visibility into (the fork is
     an external, non-vendored binary — its implementation cannot be
     inspected from this repo).
   - Recommendation: refuse `mode: 'snapshot'` explicitly for this phase,
     following Phase 3's D-15/D-16 precedent for "no consumer, no obligation."
     Record it in `docs/stock-vice-parity.md` as a stock-manifest trim, not a
     silent omission.

2. **Should `vice_symbols_load`'s `format: 'kickasm'`/`'simple'` be refused by name or simply unimplemented (auto-detect fails silently to "not vice format")?**
   - What we know: no skill or script in this repo produces a KickAssembler
     label file or names a "simple" format anywhere; only ACME
     (`--vicelabels`) and regenerator2000 (`--export_lbl`, unverified format)
     are named producers, and both are stated as "VICE label files."
   - What's unclear: whether `'auto'` should attempt to sniff KickAssembler
     syntax and refuse it BY NAME ("this looks like a KickAssembler label
     file; only VICE-format `.lbl`/`.vs` files are supported on stock") versus
     just failing to parse any `al ...` lines and reporting "0 symbols
     loaded" silently.
   - Recommendation: refuse by name when `format` is explicitly `'kickasm'` or
     `'simple'` (both declared, both refused with a clear reason); for
     `'auto'`, parse only the `al C:xxxx .Name` pattern and report the count
     of symbols actually loaded — a 0-symbol load from a genuinely
     unrecognized file format is itself diagnostic (the agent sees "0
     symbols" and can investigate) without needing format-sniffing logic
     that risks a false-positive misclassification.

3. **Does `vice_sprite_inspect`'s answer need the full 24×21 grid for hi-res sprites, or is a scaled/half-width representation preferable for agent readability?**
   - What we know: the fork's legend implies a fixed mapping; the roadmap and
     REQUIREMENTS.md both simply say "ASCII rendering" with no format spec.
   - What's unclear: whether an agent-facing ASCII grid should render at
     native pixel width (24 columns for hi-res, 12 for multicolour — visually
     inconsistent aspect ratios between the two modes) or normalize somehow.
   - Recommendation: render at native resolution per mode (24 cols hi-res, 12
     cols multicolour, always 21 rows) — this is what the fork's own legend
     literally describes, and normalizing introduces a design decision
     nothing in this phase's requirements asks for. Revisit only if a skill
     later complains about the visual inconsistency.

## Environment Availability

Not applicable — this phase adds no new external dependency (no new binary,
no new package, no new CI step). Every tool composes existing in-repo seams
(`stock-address.ts`, `stock-handler.ts`, `stock-protocol.ts`,
`stock-dispatch.ts`, `stock-derived.ts`) against the same stock `x64sc
-binarymonitor` connection every other Phase 3/4 tool already uses. The
project memory's live-testing setup (`/usr/bin/x64sc` as genuine stock VICE;
`-default` must precede `-binarymonitor`) applies unchanged — see Validation
Architecture below for how it is used per family.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test`, run via `node --test '*.test.*'` |
| Config file | none — `.claude/mcp/vice/package.json`'s `"test"`/`"test:automated"` scripts are the only config |
| Quick run command | `node --test stock-memory-search.test.ts stock-symbols.test.ts stock-vicii.test.ts stock-cia.test.ts stock-sprites.test.ts` (per-file, fast, no emulator) |
| Full suite command | `npm run test:automated` (`.claude/mcp/vice/test-gate.mjs`, excludes the 4 frozen `MANUAL_ONLY_TESTS`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DERIV-01 | `vice_memory_search` finds an exact and a wildcard-masked pattern; respects `max_results` | unit (synthetic byte buffer, injected via a fake `session.client.send`) | `node --test stock-memory-search.test.ts` | ❌ Wave 0 |
| DERIV-01 | `vice_memory_compare` (`mode:'ranges'`) reports byte-level differences; same-length range2 derived from range1's length; `mode:'snapshot'` refused with an explanatory message | unit | `node --test stock-memory-search.test.ts` | ❌ Wave 0 |
| DERIV-04 | `vice_symbols_load` parses a real ACME `--vicelabels`-shaped fixture; `vice_symbols_lookup` resolves both directions; `vice_disassemble`'s existing `show_symbols` path picks up the installed resolver with no code change | unit + one integration assertion against `stock-address.ts`'s live holder | `node --test stock-symbols.test.ts` | ❌ Wave 0 |
| DERIV-05 | `vice_vicii_get_state`/`vice_cia_get_state` decode every readable bit field correctly against a known byte pattern; every internal-only field is `{available:false, reason}`, never a bare `0` | unit, exhaustive per declared field | `node --test stock-vicii.test.ts stock-cia.test.ts` | ❌ Wave 0 |
| DERIV-05 | `sidefx:false` is asserted on the wire body for both chips (Pitfall 4's regression guard) | unit (captured wire body) | `node --test stock-vicii.test.ts stock-cia.test.ts` | ❌ Wave 0 |
| DERIV-06 | `vice_sprite_get`'s decoded fields match a hand-resolved fixture (reuse `dump-artifacts.mjs`'s own verified `dd00_raw=193, d018_raw=49 -> screen_base=35840` case as the cross-check) | unit | `node --test stock-sprites.test.ts` | ❌ Wave 0 |
| DERIV-06 | `vice_sprite_inspect`'s ASCII output matches the legend exactly for both a synthetic hi-res and a synthetic multicolour sprite bitmap | unit | `node --test stock-sprites.test.ts` | ❌ Wave 0 |
| Success Criterion 5 (manifest cross-check) | Every one of the six skills' documented tool calls for these 8 tools resolves against `tools-manifest.stock.json` with no unadvertised-tool failure | **No existing mechanical check found** — see below | none today | ❌ needs building or a documented manual pass |

**On Success Criterion 5's mechanical verification:** no automated skill-vs-manifest
cross-check tool exists in this repo today (confirmed: no script under
`.claude/mcp/vice/` or `scripts/` greps the six `SKILL.md`/reference files for
`vice_*` tool names and diffs against either manifest — the "28 tools /16
work/12 don't" analysis in `REQUIREMENTS.md`/`ROADMAP.md` was evidently done
by hand for the scope cut). Recommend the planner either (a) build a small
script (`scripts/check-skill-tool-coverage.mjs`, grepping
`mcp__plugin_c64-re-tools_vice__vice_\w+` across `.claude/skills/**/*.md` and
`.claude/skills/**/*.mjs`, then checking every match against
`tools-manifest.stock.json`'s tool names) as a Wave 0/1 deliverable feeding
both this phase's own criterion 5 and Phase 8's `DIST-01`'s "derived from the
shipped manifests" requirement — the two would share the same underlying
extraction logic — or (b) treat criterion 5 as a manual verification step
recorded in a `05-VERIFICATION.md`-style artifact for this phase alone,
deferring the reusable script to Phase 8. Given Phase 8's `DIST-01` needs
essentially the same mechanism, building it once here is likely the lower
total-cost option, but this is a planner judgment call, not a locked
decision.

### Sampling Rate
- **Per task commit:** the quick-run command above (all five new test files,
  fast, no external process).
- **Per wave merge:** `npm run test:automated`.
- **Phase gate:** full suite green before `/gsd-verify-work`, plus a real
  live-VICE pass for at least one call per family (memory search against a
  known pattern; a symbol load/lookup round trip; VIC-II/CIA state read
  against a running program; sprite get/inspect against a game with visible
  sprites) — the project memory's own guidance is to default to live-testing
  against `/usr/bin/x64sc` (genuine stock VICE) rather than asking first, and
  to remember `-default` must precede `-binarymonitor` in the launch
  command or the monitor never binds.

### Wave 0 Gaps
- [ ] `stock-memory-search.ts` + `.test.ts` — nothing exists yet.
- [ ] `stock-symbols.ts` + `.test.ts` — nothing exists yet; the extension
      point it installs into (`stock-address.ts`'s `SymbolResolver`) already
      exists and needs no change.
- [ ] `stock-vicii.ts` + `.test.ts`, `stock-cia.ts` + `.test.ts` — nothing
      exists yet.
- [ ] `stock-sprites.ts` + `.test.ts` — nothing exists yet; the pointer-chain
      arithmetic to port exists (JavaScript, `dump-artifacts.mjs`) but has
      never been imported into `.claude/mcp/vice/`.
- [ ] A skill-vs-manifest coverage script, if the planner chooses option (a)
      above for Success Criterion 5's mechanical verification — otherwise a
      documented manual pass.
- [ ] `tools-manifest.stock.json` — 8 new entries (26 -> 34 tools).
- [ ] `docs/stock-vice-parity.md` — record this phase's three trims
      (`mode:'snapshot'` refused, `format:'kickasm'/'simple'` refused,
      `format:'png_base64'` omitted) and the DERIV-05 stock GAIN
      (`sidefx:false` chip-state reads, side-effect-free unlike the fork's
      unverified read path).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no auth surface |
| V3 Session Management | no | Reuses the existing stock monitor session (`ensureStockSession`) for the four session-needing tool families; the two symbol tools open no session at all |
| V4 Access Control | no | No new access-control surface; all eight tools are read-only (DERIV-05/06's write halves are explicitly out of scope) |
| V5 Input Validation | yes | Every argument (`start`/`end`/`pattern`/`mask`/`path`/`sprite`/`cia`/`address`/`name`) is parsed through `stock-address.ts`'s `parseAddress()`/`parseByteCount()` or explicit array/type validation matching `stock-memory.ts`'s existing `vice_memory_write` `data` array pattern; `max_results`/`max_differences` are clamped to the fork's own stated bounds (default 100, max 10000) to prevent an unbounded answer payload |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted `path` argument to `vice_symbols_load` escaping the container workspace (path traversal) | Tampering / Information Disclosure | This tool reads a file with Node's `fs` inside the MCP server process — never through `hostpath.ts` (which exists for the OPPOSITE direction: paths VICE itself opens on the host). Resolve `path` against the workspace root using the SAME resolver `repo-root.ts`/`install-resources.ts` already establish, and reject any resolved path that escapes that root — mirroring `stock-paths.ts`'s existing `sanitizeSnapshotName()` discipline for `vice_snapshot_save`'s `name` argument, even though this is a read rather than a write |
| An unbounded `pattern`/`mask` array, or a `max_results`/`max_differences` value above the fork's documented ceiling, causing an oversized answer or excessive client-side scan cost | Denial of Service | Clamp `max_results`/`max_differences` to the fork's own stated bounds (100 default, 10000 max) exactly as written into the schema; reject a `pattern` array longer than the address range being searched (a pattern that cannot possibly match should fail validation, not silently scan and return zero results) |
| A crafted VICE label file with an extremely long line or an enormous label count causing excessive memory use in the client-side symbol table | Denial of Death (resource exhaustion) | Apply a defensive line-count/file-size ceiling when reading the label file (matching this project's general "never trust an external artifact's size" posture, e.g. `MAX_DESCRIPTION_LENGTH`-style caps already used in `stock-machine.ts`'s snapshot handlers) |

## Sources

### Primary (HIGH confidence)
- `docs/phase0-binmon-findings.md` (read live, full file) — the confirmed
  binary-monitor command set; no `MEMORY_SEARCH`/`MEMORY_COMPARE`/chip-state
  opcode exists anywhere in it.
- `docs/roadmap-stock-vice.md` (read live, full file) — independently
  classifies all four families as "Client-side derivation (compose over A)."
- `docs/stock-vice-parity.md` (read live, full file) — item 5's exact
  characterization of what is/isn't readable for VIC-II/CIA; item 6/7's
  precedent for stock-native answer shapes and D-15/D-16's trim precedent.
- `.claude/mcp/vice/stock-address.ts` (read live, full file) — the
  `SymbolResolver` interface and both `setSymbolResolver()`/`symbolNameFor()`/
  `hasSymbolStore()`, already widened in Phase 4 for exactly this phase's use.
- `.claude/mcp/vice/stock-derived.ts`, `stock-dispatch.ts` (read live) —
  `withDerivedTool()`'s two-branch signature, `STOCK_DERIVED_TOOLS`,
  `STOCK_DISPATCH_TABLE`'s exact registration shape.
- `.claude/mcp/vice/stock-memory.ts`, `stock-handler.ts` (read live, full
  files) — the `MEM_GET`/`stockAnswer()`/error-converter patterns every new
  handler reuses.
- `.claude/mcp/vice/stock-schema-check.ts` (read live, full file) — confirms
  the `available`/`reason` wrapper pattern is expressible in the existing
  schema-checker subset with no changes.
- `.claude/mcp/vice/hostpath-consumers.test.ts` (read live, full file) —
  confirms the derived-tool absence check already generalizes to future
  `STOCK_DERIVED_TOOLS` members.
- `.claude/mcp/vice/tools-manifest.json` (grepped live) — the exact fork
  input schemas for all eight tools, captured verbatim above.
- `.claude/mcp/vice/tools-manifest.stock.json` (read live) — the
  `vice_disassemble` entry's exact `inputSchema`/`outputSchema` shape, the
  template this phase's eight new entries follow.
- `.claude/skills/c64-memory-mapping/memmap.json` (queried live) — cross-
  verified the full VIC-II $D000-$D02E register map (47 bytes) and both CIA
  $DC00-$DC0F/$DD00-$DD0F register maps (16 bytes each) against the fork's own
  stated offset ranges in `vice_vicii_set_state`/`vice_cia_set_state`.
- `.claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs` (read live) —
  `vicBank()`, `screenBase()`, and the sprite-pointer-to-data-address formula,
  each with a real verified fixture already committed.
- `.claude/skills/acme-build/scripts/acme.mjs` (read live) — the exact
  `al C:xxxx .Name` label-file regex this project's own `curateLabels()`
  parses, and the confirmed `--vicelabels`/`.vs` producer chain.
- `.claude/skills/c64-program-recon/references/observation-hazards.md`,
  `sound-and-input.md`, `graphics.md`, `tool-selection.md`,
  `reconstruction.md`, `control-flow.md` (read live) — every skill-usage claim
  and read-hazard claim in this document is sourced from these files.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
  `.planning/phases/04-*/04-CONTEXT.md`, `04-RESEARCH.md`, `04-02-SUMMARY.md`,
  `04-05-SUMMARY.md`, `.planning/phases/03-*/03-CONTEXT.md` (all read live,
  full files) — phase scope, the built seam's exact current state, and every
  carried-forward decision cited above.

### Secondary (MEDIUM confidence)
- `.planning/notes/regenerator2000-integration.md` (read live) — the
  `--export_lbl` "VICE label files" claim is the note's own premise, marked
  by the note itself as unverified (`R2000-16(c)`).

### Tertiary (LOW confidence)
- Standard 6502/VIC-II hardware knowledge for `$D019`/`$D01A`'s non-clearing
  read behaviour (Assumptions Log A2) — not sourced from VICE's own source in
  this session, cross-checked only against this repo's own in-repo docs'
  silence on those two registers as hazards.

## Metadata

**Confidence breakdown:**
- Opcode absence (no search/compare/chip-state/sprite primitive): HIGH — two
  independent in-repo sources agree exhaustively.
- Seam mechanics (`withDerivedTool()`, `STOCK_DERIVED_TOOLS`, registration
  shape): HIGH — read directly from the real, already-merged Phase 4 code.
- Register maps (VIC-II 47 bytes, CIA 16 bytes x2): HIGH — cross-verified
  against `memmap.json` and the fork's own stated offset ranges.
- Sprite pointer-chain arithmetic: HIGH — reusing an already-implemented,
  already-fixture-verified formula from this repo's own `c64-ram-capture`
  skill.
- VICE label-file format: HIGH for the ACME-producer direction (confirmed
  live against this repo's own parser); LOW for the regenerator2000-producer
  direction (explicitly unverified upstream, `R2000-16(c)`).
- `vice_memory_compare`'s `mode:'snapshot'` semantics: LOW — no in-repo
  evidence of how the fork implements it, no skill calls it; recommendation
  is to refuse rather than guess.
- Fork's exact answer JSON shapes for all eight tools: N/A/unknowable — the
  fork ships no `outputSchema` on any tool (confirmed, `tools-manifest.json`),
  so D-01 of Phase 3's "stock answers are stock-native" applies fully; there
  is nothing to reproduce.

**Research date:** 2026-08-17
**Valid until:** Effectively indefinite for the hardware-register-map and
opcode-absence facts (do not change). 30 days for the regenerator2000-format
assumption (re-check once `R2000-16` actually runs) and for anything
describing this repo's own in-progress code shape (module names, exact line
numbers).
