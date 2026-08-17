# Phase 4: Client-Side Tool Seam and 6510 Disassembler - Research

**Researched:** 2026-08-17
**Domain:** MCP tool dispatch seam (TypeScript/Node) + a pure 6502/6510 opcode-table disassembler
**Confidence:** HIGH (seam) / HIGH (opcode data, cross-verified against cc65's real source) / MEDIUM (packaging mechanics for the notices file, a gap this research found that CONTEXT.md did not examine)

## Summary

Phase 4 has almost no open design questions left — `04-CONTEXT.md` is a fully-decided,
14-decision context document from `/gsd-discuss-phase`, and this research exists to
ground those decisions in the real files rather than to re-litigate them. Every decision
below was checked against the actual source and confirmed correct, with three
corrections/additions this pass found that the planner should carry:

1. **The interception seam already exists and was directly confirmed by reading
   `vice-proxy.ts`.** `buildBackendAwareTool()` (line 3165) is the one construction-time
   fork/stock split; on stock every tool routes to `dispatchStock()`
   (`stock-dispatch.ts`), which never imports or calls `forwardToVice()`/
   `rewriteArguments()`. DERIV-07's Phase 4 work is genuinely "add a `withDerivedTool()`
   adapter beside `withStockSession()`", not "build a seam from nothing" — CONTEXT.md's
   scouting finding is correct.
2. **The opcode-table provenance is real and independently re-verified against cc65's
   live GitHub source** (`src/da65/opc6502x.c`, not `src/common/` — CONTEXT.md doesn't
   specify the directory). The zlib header, the 4-field entry shape (mnemonic/size/
   flags/addressing-mode enum), the 12 JAM opcodes, the `$8B`/`$AB`/`$EB` illegal triple,
   and the `$6C` NMOS page-wrap bug all check out against this file and a second
   independent source (masswerk.at). **`fluffy-6502`, the second cross-check source
   named in ROADMAP.md and carried into CONTEXT.md's D-06, could not be found under
   that name anywhere on GitHub or the web** — see Assumptions Log A1. This does not
   block planning (D-06's bit-pattern derivation test and D-08's real-ACME round-trip
   are both independent of any named source), but the planner should not cite
   `fluffy-6502` as a real, checked cross-reference until someone finds the actual repo.
3. **D-07's packaging mechanism has a real gap CONTEXT.md's decision doesn't address:**
   `@henols/vice-mcp`'s `package.json` lives at `.claude/mcp/vice/`, and npm's `files`
   array can only reference paths inside that directory — a repo-root
   `THIRD-PARTY-NOTICES.md` cannot appear in the tarball without an explicit copy step.
   The repo's own `LICENSE` file demonstrates this gap today: it is at the repo root,
   is **not** in `vice-mcp`'s `files` array, and a live `npm pack --dry-run --json` in
   this session confirmed it is **not** in the tarball. `check-npm-packages.mjs`
   asserting a notices file inside the tarball therefore needs either (a) a `prepack`
   script that copies the root file in (mirroring `installer/scripts/sync-skills.mjs`'s
   exact pattern for skills), or (b) the canonical file located inside
   `.claude/mcp/vice/` itself with the repo root pointing at it. See Common Pitfalls.

**Primary recommendation:** Build `withDerivedTool()` as a sibling to
`withStockSession()` in a new module (e.g. `stock-derived.ts`), registering into the
same `STOCK_DISPATCH_TABLE`; build the disassembler as three files (opcode table →
decoder → renderer) with zero imports from anything protocol-related; wire
`vice_disassemble` through the new adapter with a session (it reads memory); add one
`prepack` copy step to `.claude/mcp/vice/package.json` for the third-party-notices file;
add one `apt-get install acme` step to the existing single `build` CI job.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Derived-tool interception (DERIV-07) | API/Backend (container-side MCP process) | — | Pure dispatch-routing concern inside the stdio MCP server; no browser, no CDN, no DB tier exists in this architecture |
| Opcode table + decoder (DISASM-02/04/05/06) | API/Backend (pure library, no I/O) | — | Deliberately protocol-independent (roadmap's own "no protocol dependency" framing) so Phase 5/6 can import the decoder without importing any transport code |
| Memory read for `vice_disassemble` (DISASM-01) | API/Backend | Database/Storage (the binary monitor's `MEM_GET` opcode, itself a `Database/Storage`-tier concern from this server's point of view) | Reuses `stock-memory.ts`'s existing `MemoryGet` pattern verbatim — no new wire mechanism |
| ACME round-trip verification (DISASM-03) | Build/CI tooling (external process, not part of the runtime tiers at all) | — | `acme` is invoked only from a test, never from the running MCP server |
| Third-party notices / packaging gate (criterion 5) | Build/CI tooling | — | `scripts/check-npm-packages.mjs` + `package.json`'s `files`/`prepack`, not runtime code |

This phase has no browser, SSR, or CDN tier — the entire system is a stdio MCP server
plus an external emulator process, so the map above collapses to two runtime rows and
two build-time rows. No misassignment risk of the kind multi-tier web apps have; the
map exists mainly to record that DISASM's decoder must stay import-clean of the
Backend's transport code, which is the one place a tier boundary could blur.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**The derived-tool seam (DERIV-07)**
- **D-01:** Build a derived-tool layer above `stock-dispatch.ts`, not a test that pins
  the existing one. A `withDerivedTool()` adapter in a sibling module (never appended to
  `vice-proxy.ts`), owning container-path discipline as the mirror image of Phase 3's
  D-17 (emulator-side path translation).
- **D-02:** Two enforcement mechanisms: (1) a simulated-container behavioural test with
  `HOST_WORKSPACE_PATH` set, asserting the derived handler receives the container path;
  (2) an asserted absence from `hostpath.ts`'s closed consumer set, so a future derived
  tool that reaches `hostpath.ts` fails a test rather than shipping. Precedent: CR-07
  (a structural test that passed while three synthetic tools reached the fork's HTTP
  transport on stock).
- **D-03:** One dispatch table, one adapter, a data-only derived registry. Derived
  tools register into the same `STOCK_DISPATCH_TABLE` through `withDerivedTool()`
  instead of `withStockSession()`. Never a second `DERIVED_DISPATCH_TABLE`.
- **D-04:** `withDerivedTool()` takes a per-tool session flag; a session is not
  mandatory. Session-requiring derived tools (`vice_disassemble`, Phase 5's
  screenshots) get one exactly as today; an emulator-free derived tool opens no
  connection.

**The disassembler library**
- **D-05:** A standalone pure module — table → decoder → renderer — with no protocol
  import. Phase 5's backtrace (DERIV-02) and Phase 6's CPU-history decode (GAIN-01)
  import the decoder, not the renderer or the tool.
- **D-06:** The opcode table is a committed TypeScript literal, pinned by a bit-pattern
  derivation test. Transcribe cc65's `opc6502x.c` (zlib) into a plain TS table, then add
  a test deriving addressing mode and instruction length from the 6502's own `aaabbbcc`
  bit structure across all 256 entries, with genuine irregulars listed explicitly.
  Cross-check sources per the roadmap: `fluffy-6502` (MIT) and ACME's illegal-opcode
  matrix. Mnemonics re-spelled to ACME's `!cpu 6510` set. Nothing sourced from VICE
  (GPL-2).
- **D-07:** `THIRD-PARTY-NOTICES.md` at the repo root, gated by the packaging check.
  Zlib licence text + a provenance line per source; attribution in the opcode table
  module's own header comment; extend `scripts/check-npm-packages.mjs` so
  `@henols/vice-mcp` fails to publish without it.

**Rendering: the round-trip and the opcodes ACME cannot express**
- **D-08:** Install ACME in CI. The round-trip is a real gate, not a manual suite. Add
  an apt step to the CI test job, with a named env-gated skip locally when `acme` is
  absent (same shape as `stock-live.test.ts`'s `VICE_LIVE_STOCK_BIN`).
- **D-09:** Every opcode ACME's `!cpu 6510` cannot express renders as `!byte`, with the
  decoded mnemonic in a trailing comment. All bytes emitted so the following instruction
  still lands at the correct address. The round-trip then has zero exclusions and is
  byte-exact by construction. Known-verified 18 `!cpu 6510` illegal mnemonics (from
  `acme-build/SKILL.md`): `lax dcp sax slo rla sre rra isc anc alr arr sbx las tas sha
  shx shy jam`. Not in that list, and therefore substitution candidates pending the
  assertion test: `ANE`/`XAA` (`$8B`), `LXA` (`$AB`), the duplicate `SBC #` (`$EB`), and
  every multi-byte NOP variant. The exact set is determined by the assertion test
  against the installed ACME, not by this list.
- **D-10:** One structured `notes` list per decoded instruction, rendered as trailing
  `;` comments: `nmos-page-wrap`, `acme-unassemblable`, `truncated`, resolved branch
  target.
- **D-11:** The renderer's invariant is that the rendered operand's width equals the
  decoded instruction's width — forced explicitly where it could shrink (e.g.
  `lda $0080` re-encoded to zero page breaks round-trip). Render those with ACME's
  forced-16-bit form. DISASM-06 falls out of the same rule: a symbol substitutes only
  where the forced width already pins the encoding — never in an immediate operand,
  never where the assembler could still pick a shorter mode.

**`vice_disassemble` on the stock backend**
- **D-12:** Fork arguments stay required (`address`, `count` default 10 max 100,
  `show_symbols`); `end` is added as an optional stock extra. Supplying both `end` and
  `count` is refused, never silently resolved.
- **D-13:** The answer carries structured `instructions` (address, bytes, mnemonic,
  operand, resolved target, `notes`) *and* a rendered `listing` string, both under one
  `outputSchema`. Bounded by `count`'s existing max of 100.
- **D-14:** DISASM-06 ships its mechanism now, wired to `stock-address.ts`'s
  `setSymbolResolver()` extension point (still `null`). With no store installed,
  `show_symbols` is a no-op that says so, matching `parseAddress()`'s existing "no
  symbol table is loaded" behaviour.

**Carried forward, not re-decided:** stock answers are stock-native (Phase 3 D-01);
`outputSchema` on every stock manifest entry (D-02); required argument names/types
match the fork's, optional stock extras permitted (D-03); one `parseAddress()` with the
pluggable symbol hook (D-04); disassembling reads memory, halts the machine, never
issues an unrequested resume, `runState` appears on the answer (D-05/D-06 Phase 3); one
dispatch table, no fall-through (Phase 2 D-09); client-side derivations in sibling
modules never appended to `vice-proxy.ts`; fork backend's advertised list unchanged from
v0.1.x; byte-identical disassembly parity with the fork is explicitly **not** an
acceptance bar (`docs/stock-vice-parity.md` already licenses the divergence).

### Claude's Discretion
- Module naming and file split for the derived layer and the disassembler, subject to
  the sibling-module rule and the existing `stock-*.ts` naming convention.
- `gatherWedgeEvidence()` is named now as the derived-path helper's second consumer but
  not repointed here — Phase 5 owns the fix; it is currently unreachable on stock
  anyway (`handleRecycle()` is backend-aware and refused by name).
- The exact `!byte` comment format and label emission for branch/jump targets.
- Whether the renderer is pluggable for Phase 6's CPU-history output format, or Phase 6
  composes the decoder with its own renderer.
- The precise membership of D-09's substitution table — determined by the assertion
  test against the ACME build installed by D-08, not by the list in D-09's prose.

### Deferred Ideas (OUT OF SCOPE)
- Repointing `acme-build`'s `disasm` command (`acme.mjs:209`'s `toacme` shell-out) at
  the new library. Real value, held back because it changes a shipped skill's output
  format inside a phase scoped to the stock backend. Its own change, or a Phase 8
  skill-revision companion.
- `gatherWedgeEvidence()`'s host-translation fix — Phase 5 criterion 5.
- Whether the renderer becomes pluggable for Phase 6's CPU-history format — decide when
  GAIN-01 is planned.
- A Phase 8 parity-harness entry for disassembly output divergence.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DERIV-07 | Derived tools live in sibling modules, intercepted before argument rewriting | `buildBackendAwareTool()` confirmed at `vice-proxy.ts:3165`; stock path never reaches `rewriteArguments()`. New `withDerivedTool()` sibling module, modelled on `withStockSession()` (`stock-dispatch.ts:426`), registers into the same `STOCK_DISPATCH_TABLE`. |
| DISASM-01 | User can disassemble a memory range on the stock backend | `vice_disassemble` handler reuses `stock-memory.ts`'s `MemoryGet` pattern (parse address/count via `stock-address.ts`, send `CommandType.MemoryGet`, `stockAnswer()`); registers through `withDerivedTool()` with a session. |
| DISASM-02 | All 256 opcodes decode correctly, including undocumented set and NOP variants | cc65 `opc6502x.c` re-verified live against GitHub; full NOP-class opcode enumeration below (27 opcodes across 6 addressing-mode groups, not literally "twelve" — see Common Pitfalls). |
| DISASM-03 | Reassembles through ACME, round-trip with enumerated+asserted exclusions | D-08 (install ACME in CI) + D-09 (`!byte` substitution eliminates exclusions structurally) — round-trip becomes byte-exact by construction; substitution table is assertion-tested against the installed ACME. |
| DISASM-04 | Branch instructions render resolved target, not raw offset | D-10's `notes`/target mechanism; decoder computes `address + 2 + signedOffset` for relative-mode opcodes. |
| DISASM-05 | Truncated partial instruction reported, not fabricated | Over-read by 2 bytes past `end`/`count` boundary, drop instructions starting past the requested end, per roadmap note; `notes: ["truncated"]`. |
| DISASM-06 | Symbol substitution only where it cannot change encoding | D-11's forced-width invariant; wired through `stock-address.ts`'s `setSymbolResolver()` (still `null` in Phase 4). |
| DISASM-07 | No npm dependency, no GPL material | Confirmed: `.claude/mcp/vice/package.json` has exactly two runtime deps (`@mastra/mcp`, `@mastra/core`), neither disassembly-related; opcode table sourced from zlib-licensed cc65, never VICE (GPL-2). |

## Standard Stack

### Core
No new runtime dependency is added or needed — DISASM-07 forbids it, and everything
required (bit manipulation, string formatting, `node:child_process` for the ACME
round-trip test) is Node built-in.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-ins only | Node ≥ 22.18 (repo floor) | Table/decoder/renderer logic, test spawning of `acme` | Matches the project's existing zero-runtime-dependency posture for `.claude/mcp/vice` |

### Supporting (build/CI only, not npm)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| ACME cross-assembler | 0.97 "Zem" (verified present in this repo's dev history, 2026-08-04; **absent from this session's host and from CI today** — `command -v acme` returned nothing when checked live) | Round-trip verification (D-08) | CI test job only, via `apt-get install acme` (Debian/Ubuntu package name is `acme`, confirmed by the skill's own historical probe of `/usr/local/share/acme`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Committed TS opcode table | Probe ACME at build time to generate the table | Rejected in CONTEXT.md (D-06): puts ACME on the build's critical path, and ACME cannot express the opcodes that most need covering (illegals) |
| `!byte` substitution (D-09) | An enumerated exclusion list, skipped in the round-trip | Rejected: criterion 4 says "asserted rather than skipped"; `!byte` substitution makes the round-trip byte-exact with zero exclusions instead |
| A hermetic table-driven re-encoder oracle instead of real ACME | Self-contained parse/render symmetry check | Rejected (D-08): proves render/parse symmetry, not that ACME itself accepts the output — DISASM-03 explicitly says "reassembles through ACME" |

**Installation:**
```bash
# CI only (added to the single existing `build` job in .github/workflows/ci.yml)
sudo apt-get update && sudo apt-get install -y acme
```

**Version verification:** No npm package is added, so `npm view`/`pip index
versions`/`cargo search` do not apply to this phase. The one external dependency
(ACME) is verified by version string, not registry lookup:
```bash
acme --version   # expect "ACME cross-assembler ... release 0.97 'Zem'" or newer
```
This session confirmed `acme`/`toacme` are **not currently installed** on this
development host (`command -v acme` returned nothing), matching CONTEXT.md's own
"ACME is absent from CI and from the development host" ground-truth finding.

## Package Legitimacy Audit

Not applicable — DISASM-07 requires **zero** new npm/pip/cargo dependencies, and none
is proposed. `slopcheck`/registry verification is skipped because no package name is
being introduced. The only new "dependency" (ACME) is an apt package installed in CI,
verified by running `acme --version`, not by a package-registry legitimacy check.

**Packages removed due to slopcheck verdict:** none — none proposed.
**Packages flagged as suspicious:** none — none proposed.

## Architecture Patterns

### System Architecture Diagram

```
Claude Code (MCP client)
        │  tools/call { name: "vice_disassemble", arguments: {...} }
        ▼
vice-proxy.ts  CallToolRequestSchema handler (deny-list check, tool lookup)
        │
        ▼
buildBackendAwareTool()  ◄── the ONE fork/stock split, decided once at process start
        │
        ├── backend === "fork" ──────────────► forwardToVice() ─► rewriteArguments() ─► call() ─► fork HTTP /mcp
        │                                        (host-translated path; UNCHANGED by this phase)
        │
        └── backend === "stock" ─► dispatchStock(name, args, deps)   [stock-dispatch.ts]
                                        │
                                        ├─ table hit? ── STOCK_DISPATCH_TABLE[name]
                                        │                     │
                                        │                     ├─ withStockSession(...)   (existing 24 tools + ping)
                                        │                     │
                                        │                     └─ withDerivedTool(...)    ◄── NEW in this phase (D-01/D-03)
                                        │                            │
                                        │                            ├─ needsSession? ── ensureStockSession(deps) ─► session.client.send(MemoryGet)
                                        │                            │                         │
                                        │                            │                         ▼
                                        │                            │                    disassembler.decode(bytes, startAddress)
                                        │                            │                         │  [pure, no protocol import]
                                        │                            │                         ▼
                                        │                            │                    disassembler.render(instructions, {showSymbols})
                                        │                            │                         │
                                        │                            │                         ▼
                                        │                            │                    stockAnswer(client, {instructions, listing})
                                        │                            │
                                        │                            └─ container-path-only helper (never hostpath.ts) ─► for any future derived tool with an output path
                                        │
                                        └─ table miss? ── explicit "not implemented by stock" refusal (D-09 of Phase 2, unchanged)

Offline (no emulator, no protocol):
  opcode-table.ts ──► decoder.ts ──► renderer.ts
        │                                │
        │ (imported directly, no tool)   └─ ACME round-trip test: renderer output ─► `acme` subprocess ─► compare bytes to original range
        ▼
  Phase 5 backtrace / Phase 6 CPU-history decode import decoder.ts only
```

A reader can trace `vice_disassemble` end to end: MCP call → backend split →
`dispatchStock` → `withDerivedTool` → session → memory read → decode → render →
answer. The disassembler's own three-stage pipeline (table → decoder → renderer) is
independent of everything above it and is what Phase 5/6 import.

### Recommended Project Structure
```
.claude/mcp/vice/
├── stock-dispatch.ts        # existing — adds one import + one table entry, no structural change
├── stock-derived.ts         # NEW — withDerivedTool() adapter, container-path-only helper (D-01/D-02/D-03/D-04)
├── stock-disassemble.ts     # NEW — the vice_disassemble StockSessionHandler-shaped tool, thin: parse args, read memory, call decoder+renderer, build answer (D-12/D-13/D-14)
├── disasm-opcodes.ts        # NEW — the committed 256-entry table, transcoded from cc65 opc6502x.c (D-06)
├── disasm-decoder.ts        # NEW — pure decode(bytes, startAddress, opts) -> Instruction[] (D-05, no protocol import)
├── disasm-renderer.ts       # NEW — pure render(instructions, opts) -> string listing (D-09/D-10/D-11)
├── disasm-opcodes.test.ts   # NEW — D-06's bit-pattern derivation test, all 256 entries
├── disasm-decoder.test.ts   # NEW — DISASM-04/05 (branch resolution, truncation, page-wrap note)
├── disasm-roundtrip.test.ts # NEW — D-08's real-ACME round-trip, named env-gated skip when acme absent
├── stock-derived.test.ts    # NEW — D-02's two mechanisms (behavioural + closed-consumer-absence)
├── stock-disassemble.test.ts# NEW — tool-level test against stock-schema-check.ts's outputSchema
├── hostpath.ts              # existing — stock-derived.ts is added to its documented non-consumer list
├── tools-manifest.stock.json # existing — vice_disassemble entry added (inputSchema D-12, outputSchema D-13)
├── package.json             # existing — files[] gets the 6 new modules; a prepack step is added (see Common Pitfalls)
└── THIRD-PARTY-NOTICES.md   # location TBD — see Common Pitfalls (repo-root vs. package-dir tension)
```

### Pattern 1: `withDerivedTool()` mirrors `withStockSession()` exactly, differing only in the preamble
**What:** `stock-dispatch.ts`'s `withStockSession(toolName, handler)` already establishes
the shape: acquire, convert errors, delegate, convert wire errors. `withDerivedTool()`
should be the same three-step shape, but its "acquire" step is conditional (D-04's
per-tool session flag) and it additionally guarantees any output path the handler
produces goes through a new container-path-only helper — never `hostpath.ts`.
**When to use:** Every tool registered into `STOCK_DISPATCH_TABLE` whose answer is
computed client-side rather than answered directly by a single binary-monitor opcode.
**Example (verified against the real file, `stock-dispatch.ts:426`):**
```typescript
// Existing precedent this phase's adapter is modelled on, verbatim from stock-dispatch.ts:
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
The new `withDerivedTool()` should reuse this preamble when `needsSession: true`
(`vice_disassemble`'s case) rather than re-deriving session acquisition — the simplest
correct shape is likely `withDerivedTool(toolName, { needsSession: true }, handler)`
delegating internally to the same `ensureStockSession()`/`convertHandshakeError()`/
`convertWireError()` trio `stock-handler.ts` already exports, with **no** new error
converter (matching the codebase's "never write a third error converter" rule).

### Pattern 2: The disassembler is table → decoder → renderer, each independently testable
**What:** `disasm-opcodes.ts` exports a flat, indexable 256-entry array (or
`Record<number, OpcodeEntry>`); `disasm-decoder.ts` exports a pure
`decode(bytes: Uint8Array, startAddress: number, opts): Instruction[]`; `disasm-
renderer.ts` exports a pure `render(instructions: Instruction[], opts): string`.
**When to use:** Any consumer that needs decoded instructions without a listing
(Phase 5 backtrace, Phase 6 CPU-history) imports only `disasm-decoder.ts` (and
transitively `disasm-opcodes.ts`) — never `disasm-renderer.ts` or `stock-
disassemble.ts`.
**Example shape (this session's own design, not sourced from any external doc):**
```typescript
// disasm-opcodes.ts
export type AddressingMode =
  | "implicit" | "accumulator" | "immediate" | "zeropage" | "zeropage_x" | "zeropage_y"
  | "absolute" | "absolute_x" | "absolute_y" | "indirect" | "indirect_x" | "indirect_y"
  | "relative";

export interface OpcodeEntry {
  mnemonic: string;      // ACME !cpu 6510 spelling, e.g. "lax", "jam"
  mode: AddressingMode;
  length: 1 | 2 | 3;
  acmeExpressible: boolean; // false for the D-09 substitution candidates until the
                             // assertion test against a real installed ACME confirms it
}

export const OPCODES: readonly OpcodeEntry[] = [ /* 256 entries, transcoded from
  cc65 src/da65/opc6502x.c (zlib) */ ];
```
```typescript
// disasm-decoder.ts — no import of anything under stock-*.ts or vice*.ts
import { OPCODES } from "./disasm-opcodes.ts";

export interface Instruction {
  address: number;
  bytes: number[];
  mnemonic: string;
  operand?: { role: "absolute" | "immediate" | "relative" | "zeropage"; value: number; width: 1 | 2 };
  resolvedTarget?: number;   // DISASM-04 — for relative/absolute jump/branch operands
  notes: string[];           // D-10 — "nmos-page-wrap" | "truncated" | "acme-unassemblable"
}

export function decode(bytes: Uint8Array, startAddress: number, opts: { count?: number; end?: number } = {}): Instruction[] {
  // over-read by 2 bytes past the requested range so the LAST instruction's
  // full length is available; drop any instruction that starts past `end`
  // (roadmap's own truncation rule) rather than fabricating bytes.
  // ...
}
```

### Anti-Patterns to Avoid
- **A second dispatch table for derived tools.** D-03 explicitly forbids this —
  `STOCK_DISPATCH_TABLE` stays the one table; "derived" is a property of which adapter
  wraps the handler, never a separate routing decision. Confirmed by reading
  `stock-dispatch.ts`'s own header comment, which grep-gates "exactly one
  `dispatchStock(` call" in `vice-proxy.ts`.
- **Calling `rewriteArguments()` or importing anything from `vice-proxy.ts` inside the
  new derived module.** `stock-paths.ts`'s own header comment states this prohibition
  for the mirror-image (emulator-side) case; the same rule applies here in the opposite
  direction.
- **A branded `ContainerPath` type as the sole guarantee (D-02 rejected this).** Node's
  type-stripping erases it at runtime; `tsc --noEmit` would be the only thing that ever
  checks it. Use the behavioural test + closed-consumer-absence test instead.
- **Sourcing any opcode fact from VICE's own source.** VICE is GPL-2; this repo is MIT.
  `docs/stock-vice-parity.md` and the roadmap are explicit that nothing here comes from
  VICE — only cc65 (zlib) and ACME's own illegal-opcode matrix (used only to determine
  which mnemonics ACME accepts, not to source the opcode/length data itself).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session acquisition + error conversion for a derived tool | A second `ensureStockSession()`-equivalent inside the new derived module | `stock-dispatch.ts`'s existing `ensureStockSession()` + `stock-handler.ts`'s `convertHandshakeError()`/`convertWireError()`/`stockAnswer()` | These are already the tested, `runState`-attaching, never-throw-converting seam every one of the 25 existing stock tools uses; re-deriving them is this codebase's own named anti-pattern |
| Address/byte-count parsing for `vice_disassemble`'s `address`/`count`/`end` arguments | A disassembler-specific regex parser | `stock-address.ts`'s `parseAddress()`/`parseByteCount()` | D-04 of Phase 3 built this specifically so every family (including this one) shares one parser and one symbol-resolution hook |
| `outputSchema` conformance checking for the new answer shape | A hand-rolled deep-equal/type-check | `stock-schema-check.ts`'s `checkAgainstSchema()` | Dependency-free, already built for exactly this (D-02 of Phase 3), supports the flat object/array/enum shapes DISASM-13's answer needs |
| Opcode table construction | Probing a live VICE or ACME instance at runtime/build time | A committed TS literal transcoded once from cc65's zlib-licensed `opc6502x.c` | Rejected explicitly in CONTEXT.md D-06 — puts an external tool on the critical path and can't express the illegal opcodes that most need covering |
| A general JSON-Schema validator for the tool's outputSchema | `ajv` or similar | The existing `stock-schema-check.ts` | This project has zero runtime npm dependencies beyond `@mastra/*`; `stock-schema-check.ts`'s own header explains why a general validator was rejected already |

**Key insight:** Every "don't hand-roll" item in this phase already has an in-repo,
tested implementation from Phase 3 — the disassembler is the only genuinely new
subsystem, and even it reuses the memory-read pattern verbatim from `stock-memory.ts`.

## Common Pitfalls

### Pitfall 1: The "twelve NOP variants" figure in the roadmap/success-criterion 2 does not match any standard 6502/6510 opcode enumeration
**What goes wrong:** A plan or test that targets exactly 12 specific NOP opcodes will
under-cover the real set, silently leaving some NOP-class opcodes with an unverified
length.
**Why it happens:** Cross-verified against cc65's live `opc6502x.c` source and a second
independent source (masswerk.at / oxyron.de) this session: the real NMOS 6502/6510 NOP
class is **27 opcodes across 6 addressing-mode groups**:
- Implied, 1 byte: `1A 3A 5A 7A DA FA` (6 opcodes)
- Immediate, 2 bytes: `80 82 89 C2 E2` (5 opcodes)
- Zeropage, 2 bytes: `04 44 64` (3 opcodes)
- Zeropage,X, 2 bytes: `14 34 54 74 D4 F4` (6 opcodes)
- Absolute, 3 bytes: `0C` (1 opcode)
- Absolute,X, 3 bytes: `1C 3C 5C 7C DC FC` (6 opcodes)

No grouping of these yields exactly 12 (6 mode-groups; 21 opcodes if you exclude the
trivially-safe 1-byte implied group; 27 total). This appears to be an imprecise figure
carried from the roadmap into CONTEXT.md's success criteria, not a verified count.
**How to avoid:** Word DISASM-02's verification as "every one of the 27 NOP-class
opcodes across all 6 addressing-mode groups decodes with the correct length" (or,
simpler and equally correct, "all 256 opcodes decode with correct instruction length,
verified by D-06's bit-pattern derivation test covering every entry") rather than a
specific count of "twelve." D-06's bit-pattern derivation test already covers all 256
regardless of wording, so this is a documentation-precision fix, not a design change.
**Warning signs:** A test file with exactly 12 hardcoded NOP test cases; a plan task
description that says "test the twelve NOP opcodes."

### Pitfall 2: `THIRD-PARTY-NOTICES.md` at the repo root will not ship in the `@henols/vice-mcp` npm tarball without an explicit copy step
**What goes wrong:** D-07 says the file is created at the repo root and
`check-npm-packages.mjs` is extended to require it — but `npm pack`'s `files` array is
resolved relative to the directory containing `package.json` (`.claude/mcp/vice/`),
which cannot reference a path outside itself (`../../../THIRD-PARTY-NOTICES.md` is not
how npm's `files` field works — it packs files, not arbitrary filesystem references).
**Why it happens:** Verified live this session: the repo's own root `LICENSE` file is
**not** in `vice-mcp`'s `package.json` `files` array, and a real `npm pack --dry-run
--json` run in `.claude/mcp/vice/` confirmed it is **absent from the tarball today**.
This is a pre-existing, unrelated gap that demonstrates the exact same mechanism would
silently swallow a root-level notices file too.
**How to avoid:** Two structurally sound options, either satisfies D-07's intent:
  1. Add a `prepack` script to `.claude/mcp/vice/package.json` that copies the
     repo-root `THIRD-PARTY-NOTICES.md` into `.claude/mcp/vice/` before packing (mirrors
     `installer/package.json`'s existing `"prepack": "node scripts/sync-skills.mjs"`
     pattern exactly — same mechanism, one file instead of six skill directories), then
     add the copied path to `files`.
  2. Keep the canonical file inside `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` directly
     (no repo-root file at all, or a trivial repo-root file that just points at the
     canonical location for GitHub browsing) and add it straight to `files` with no
     copy step.
Option 2 is simpler and has no moving parts; option 1 matches "at the repo root" more
literally if that phrasing in D-07 is load-bearing. Either way, `check-npm-packages.mjs`
must assert the file's presence **inside the packed tarball**, not merely on disk at
the repo root — a check against the repo-root path alone would pass while the actual
published package still omits it, exactly the CR-07-shaped failure mode this repo has a
named aversion to.
**Warning signs:** `check-npm-packages.mjs`'s new assertion reads `existsSync(join(ROOT,
"THIRD-PARTY-NOTICES.md"))` instead of checking `vice.files.includes(...)` — that
checks the wrong filesystem location for what actually ships.

### Pitfall 3: `withDerivedTool()` must not become a second acquisition path
**What goes wrong:** `ensureStockSession()`'s own header comment is emphatic that it
must be the only thing that ever calls `openBrokerControl()`/`session.acquire()`/
`adoptGrant()`, because D-13's "the claim precedes every dial" guarantee depends on
there being exactly one acquisition. A derived-tool adapter that reimplements any part
of session acquisition (even "just for the emulator-free case") risks a second
acquisition path.
**Why it happens:** D-04 introduces a genuinely new branch — "a session is not
mandatory" — and it would be easy to special-case the no-session branch by skipping
`ensureStockSession()` entirely rather than skipping only the *decision to open one*.
**How to avoid:** `withDerivedTool()`'s `needsSession: false` branch should simply never
call `ensureStockSession()` at all (not call a lighter-weight version of it) — the
handler receives no session argument and cannot reach the wire. Only
`needsSession: true` delegates to the exact same `ensureStockSession()` the direct
tools use.
**Warning signs:** Any new function in the derived module whose name resembles
`ensureSession`, `acquire`, or `connect`.

### Pitfall 4: The round-trip test's "exclusions enumerated and asserted" must assert against a live ACME process, not a static list
**What goes wrong:** A plan that ships a hardcoded substitution list (`ANE`, `LXA`,
`$EB`, the NOP variants) without a test that actually invokes `acme` on each one and
checks it genuinely rejects that mnemonic silently reintroduces the CR-07 failure mode
— the list looks right and was never checked against reality.
**Why it happens:** D-09's own prose explicitly warns about this: "the exact set is
determined by the assertion test against the installed ACME, not by this list."
**How to avoid:** The substitution table's membership test must actually spawn `acme`
on a tiny fixture source containing each candidate mnemonic and assert a non-zero exit
code / error output for each. `acme-build/scripts/acme.mjs`'s `spawnSync` pattern
(`cmdDisasm`, line ~209) is the existing precedent for shelling out to ACME from Node in
this repo.
**Warning signs:** A test file with `const KNOWN_UNASSEMBLABLE = [...]` and no
subprocess call anywhere near it.

### Pitfall 5: Do not source cross-check opcode data from a project that cannot be found
**What goes wrong:** Citing `fluffy-6502` as a verified MIT cross-check source when
planning or writing the opcode table's provenance comment overstates what was actually
checked.
**Why it happens:** The name is carried from `ROADMAP.md` into `04-CONTEXT.md` (D-06)
without an independent check at either point — this research session searched GitHub
and the general web for "fluffy-6502" and found no matching project under that name.
**How to avoid:** Either find the actual repository (it may be a misremembered name —
possible the roadmap author meant a different small MIT-licensed 6502 opcode table
project) before citing it in the table's attribution comment, or drop the citation and
rely on the two sources this research *did* independently verify: cc65's `opc6502x.c`
(zlib, confirmed live) and ACME's own illegal-opcode acceptance (checked by the D-08
round-trip / D-09 assertion test itself, which is a stronger check than a second
static table would be anyway).
**Warning signs:** A source comment or `THIRD-PARTY-NOTICES.md` entry naming
`fluffy-6502` with a URL that 404s.

## Code Examples

### Reading memory for disassembly (exact pattern to reuse from `stock-memory.ts`)
```typescript
// Source: .claude/mcp/vice/stock-memory.ts (read live this session), adapted
const body = memGetBody({ sidefx: false, start: address, end, memspace: 0x00, bank: 0x0000 });
const response = await session.client.send(CommandType.MemoryGet, body);
if (response.type !== "memory_get") {
  return isErrorText(`vice_disassemble: unexpected response type "${response.type}", expected "memory_get"`);
}
// response.bytes.length is checked against the requested size before decoding
```
`vice_disassemble` should always request `sidefx: false` (disassembly must never
trigger I/O side effects) and read `count`-instructions'-worth of bytes conservatively
— over-request by a safety margin (the roadmap's own "over-read by two bytes" rule)
since instruction lengths aren't known until decoded.

### NMOS `JMP ($xxFF)` page-wrap detection (verified against masswerk.at this session)
```typescript
// On the original NMOS 6502/6510, if the low byte of an indirect JMP's pointer
// is 0xFF, the high byte is fetched from the SAME page (pointer & 0xFF00) rather
// than the next page -- confirmed live against masswerk.at's 6502 instruction set
// reference this session.
function hasNmosPageWrapBug(pointerAddress: number): boolean {
  return (pointerAddress & 0x00ff) === 0x00ff;
}
// In the decoder, opcode 0x6C (JMP indirect) with hasNmosPageWrapBug(operand) true
// attaches notes: ["nmos-page-wrap"] -- D-10's mechanism, criterion 3's requirement.
```

### The 18 verified ACME `!cpu 6510` illegal mnemonics (confirmed against `acme-build/SKILL.md`, read live this session)
```
lax dcp sax slo rla sre rra isc anc alr arr sbx las tas sha shx shy jam
```
Verified assembling example from the same file: `lax $fb / dcp $fc / sax $fd / slo $02
/ anc #$0f / sbx #$10` assembles to `a7 fb c7 fc 87 fd 07 02 0b 0f cb 10`.

### The 12 JAM/KIL opcodes (confirmed against masswerk.at this session)
```
$02 $12 $22 $32 $42 $52 $62 $72 $92 $B2 $D2 $F2
```
All 12 are in the 18-mnemonic verified ACME list above (`jam`), so no `!byte`
substitution is needed for JAM — only the genuinely un-expressible ones (`ANE`/`LXA`/
duplicate-`SBC`/NOP variants) are D-09 substitution candidates pending the assertion
test.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fork's in-emulator `vice_disassemble` (opaque, undocumented answer shape) | Client-side library with `outputSchema`-conformant structured + rendered answer | This phase | Machine-checkable answer, importable decoder for Phase 5/6, but formatting/illegal-opcode rendering diverges from the fork by design (licensed divergence, `docs/stock-vice-parity.md`) |
| `acme-build`'s `toacme`-based `disasm` (external binary shell-out, admittedly needs hand-fixing per its own SKILL.md) | This phase's library (not yet wired into the skill — deferred) | Deferred to a future phase | Not a Phase 4 change; noted so the planner doesn't accidentally scope-creep into it |

**Deprecated/outdated:** None specific to this phase — no existing disassembler code is
being replaced within Phase 4's scope; the skill's `toacme` usage continues unchanged
until the deferred swap.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fluffy-6502` (named in ROADMAP.md and carried into CONTEXT.md's D-06 as an MIT cross-check source) is a real, findable project | Standard Stack / Common Pitfalls Pitfall 5 | Low — D-06's bit-pattern derivation test and D-08's real-ACME round-trip are both independent verification mechanisms that do not depend on this source existing; the only risk is a `THIRD-PARTY-NOTICES.md` entry citing a non-existent project as a checked source, which is a documentation-accuracy issue, not a correctness one |
| A2 | ACME's Debian/Ubuntu apt package is named exactly `acme` (used in D-08's proposed `apt-get install acme` CI step) | Standard Stack | Medium — if the actual Debian package name differs (e.g. it could be `acme-cross-assembler` or similar in some distro versions), the CI step silently fails to install it and D-08's gate either errors or (worse) the test's env-gated skip masks the absence. Verify with `apt-cache search acme` or `apt list -a acme` on the actual CI runner image (`ubuntu-latest`) before merging the workflow change |
| A3 | The 4-field `OpcodeEntry` shape (mnemonic/size/flags/addressing-mode) reported by the WebFetch summary of `opc6502x.c` is a complete and accurate rendering of that file's real C struct | Architecture Patterns Pattern 2 | Low-Medium — this was read via an AI-summarized WebFetch of the raw GitHub file rather than a byte-for-byte transcription; before committing the 256-entry TS literal, the implementer should fetch the raw file directly (`curl -s https://raw.githubusercontent.com/cc65/cc65/master/src/da65/opc6502x.c`) and transcribe from the actual bytes, not from this research's summary |

**If this table is empty:** N/A — three items above need light confirmation, none
blocks planning.

## Open Questions

1. **Exact Debian/Ubuntu apt package name for ACME**
   - What we know: ACME 0.97 "Zem" was verified present in this container's history
     (2026-08-04, per `acme-build/SKILL.md`) resolving to `/usr/local/share/acme` (built
     from source or a non-apt install, based on the `/usr/local/` prefix) — this does
     NOT confirm an apt package exists under the name `acme`.
   - What's unclear: whether `sudo apt-get install acme` on `ubuntu-latest` actually
     resolves to the ACME cross-assembler and not an unrelated package also named
     "acme" in some Ubuntu suite.
   - Recommendation: the first CI-change task under D-08 should run `apt-cache
     policy acme` (or attempt the install and check `acme --version` immediately after)
     before trusting the package name; if it does not exist under that name, fall back
     to a source build or a GitHub release download step instead.

2. **Where exactly should `THIRD-PARTY-NOTICES.md` live, given the packaging gap in
   Pitfall 2**
   - What we know: D-07 says "repo root"; the packaging mechanism cannot pull a
     repo-root file into the `.claude/mcp/vice/` tarball without a copy step.
   - What's unclear: whether "at the repo root" in D-07's prose is load-bearing (e.g.
     GitHub's own repo page convention of surfacing root-level files) or just the
     default assumption at discussion time, before this packaging detail was checked.
   - Recommendation: the planner should pick one of Pitfall 2's two options explicitly
     as a plan decision, rather than leaving "gated by the packaging check" ambiguous
     about which file the check actually gates on.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test`, run via `node --test '*.test.*'` |
| Config file | none — `.claude/mcp/vice/package.json`'s `"test"` script is the only config |
| Quick run command | `node --test disasm-opcodes.test.ts disasm-decoder.test.ts stock-derived.test.ts` (per-file, fast, no emulator/ACME needed) |
| Full suite command | `npm run test:automated` (`.claude/mcp/vice/test-gate.mjs`, excludes the 4 `MANUAL_ONLY_TESTS`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DERIV-07 | Derived tool receives container path, never host-translated | unit (behavioural, `HOST_WORKSPACE_PATH` set) | `node --test stock-derived.test.ts` | ❌ Wave 0 |
| DERIV-07 | Derived module absent from `hostpath.ts`'s closed consumer set | unit (structural/grep, mirrors `stock-paths.test.ts`'s `STOCK_EMULATOR_SIDE_PATH_TOOLS` assertion pattern) | `node --test stock-derived.test.ts` (or a dedicated `hostpath-consumers.test.ts`) | ❌ Wave 0 |
| DISASM-01 | `vice_disassemble` returns a valid answer conforming to its own `outputSchema` | unit (via `stock-schema-check.ts`) | `node --test stock-disassemble.test.ts` | ❌ Wave 0 |
| DISASM-02 | All 256 opcodes decode with correct length | unit, exhaustive (not sampled) | `node --test disasm-opcodes.test.ts` | ❌ Wave 0 |
| DISASM-03 | Round-trip through real ACME, byte-exact | integration, real subprocess | `node --test disasm-roundtrip.test.ts` (env-gated skip if `acme` absent locally; real gate in CI per D-08) | ❌ Wave 0 |
| DISASM-04 | Branch targets resolved | unit | `node --test disasm-decoder.test.ts` | ❌ Wave 0 |
| DISASM-05 | Truncation reported, not fabricated | unit | `node --test disasm-decoder.test.ts` | ❌ Wave 0 |
| DISASM-06 | Symbol substitution only where width-safe | unit (injected fake resolver, per D-14) | `node --test disasm-decoder.test.ts` or `stock-disassemble.test.ts` | ❌ Wave 0 |
| DISASM-07 | No new npm dependency, no GPL material | structural (grep `package.json` deps unchanged; grep for VICE source references) | `node scripts/check-npm-packages.mjs` (extended per D-07) | ❌ Wave 0 (extension) |

### Sampling Rate
- **Per task commit:** the quick-run command above (opcode/decoder/derived-seam unit
  tests, all fast, no external process).
- **Per wave merge:** `npm run test:automated` (excludes only the 4 pre-existing
  manual-only files; this phase's new tests are NOT manual-only and must run in the
  automated gate per D-08's explicit rejection of the `MANUAL_ONLY_TESTS` route).
- **Phase gate:** Full suite green before `/gsd-verify-work`, **plus** confirmation that
  the CI `build` job's new ACME-install step actually ran the round-trip test (not
  merely that it exists) — Open Question 1 above must be resolved first, or this gate
  is unverifiable.

### Wave 0 Gaps
- [ ] `disasm-opcodes.ts` + `disasm-opcodes.test.ts` — the 256-entry table and its
      bit-pattern derivation test (D-06). Nothing exists yet.
- [ ] `disasm-decoder.ts` + `disasm-decoder.test.ts` — pure decode, no framework install
      needed.
- [ ] `disasm-renderer.ts` — no dedicated test file needed on its own; covered by the
      round-trip test's use of its output.
- [ ] `disasm-roundtrip.test.ts` — needs the local-skip pattern from `stock-live.test.ts`
      (named env var, e.g. `VICE_LIVE_ACME` or simply detect `command -v acme`) plus the
      CI apt-get step (D-08) so it is NOT in `MANUAL_ONLY_TESTS`.
- [ ] `stock-derived.ts` + `stock-derived.test.ts` — the seam itself; nothing exists yet
      beyond the `withStockSession()` precedent it's modelled on.
- [ ] `stock-disassemble.ts` + `stock-disassemble.test.ts` — the tool handler.
- [ ] CI workflow edit (`.github/workflows/ci.yml`) — one `apt-get install acme` step in
      the existing `build` job, before the `Test` step.
- [ ] `THIRD-PARTY-NOTICES.md` + the packaging mechanism decided per Pitfall 2/Open
      Question 2, plus the extension to `scripts/check-npm-packages.mjs`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Entire `.claude/mcp/vice` server, all new modules | ✓ | v22.22.0 (checked live, exceeds the `>=22.18.0` floor in `package.json`) | — |
| `acme` (ACME cross-assembler) | DISASM-03's round-trip test (D-08) | ✗ (checked live this session: `command -v acme` returned nothing) | — | Named env-gated skip locally (`VICE_LIVE_ACME`-style, matching `stock-live.test.ts`'s pattern); real CI gate via a new `apt-get install acme` step in `.github/workflows/ci.yml`'s single `build` job |
| `toacme` | Not needed by this phase (only by the deferred `acme-build` skill swap) | ✗ (same check) | — | N/A — out of scope for Phase 4 |
| GitHub Actions `ubuntu-latest` runner | D-08's CI gate | Not directly checkable from this session; assume available per existing 4-job CI setup | — | — |

**Missing dependencies with no fallback:** none — ACME's absence has a documented,
already-precedented fallback (the env-gated skip pattern).

**Missing dependencies with fallback:** `acme` locally (skip pattern); `acme` in CI
(install step, contingent on Open Question 1's apt package name confirmation).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no auth surface |
| V3 Session Management | no | Reuses the existing stock monitor session (`ensureStockSession`), no new session concept |
| V4 Access Control | no | No new access-control surface; `vice_disassemble` is read-only (memory read with `sidefx: false`) |
| V5 Input Validation | yes | `address`/`count`/`end` parsed through the existing `stock-address.ts` `parseAddress()`/`parseByteCount()` seam, which already enforces range (`0..0xffff`) and refuses malformed input; the new `end`-vs-`count` mutual-exclusion check (D-12) is additional input validation this phase introduces |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A derived tool's output path escaping the container's workspace via a maliciously crafted argument | Tampering / Elevation of Privilege | Not directly applicable to `vice_disassemble` (it has no output-path argument at all — its only output is the tool's returned JSON), but the new `withDerivedTool()` seam's container-path-only helper should still be built defensively for Phase 5's screenshot/derivation consumers that DO take path-like arguments; D-02's asserted-absence-from-hostpath test is the concrete control |
| Command injection via the ACME round-trip test's subprocess invocation | Tampering | `acme-build/scripts/acme.mjs` already establishes the precedent: `spawnSync("toacme", [...argsArray], {...})` — argv array, never a shell string. The new round-trip test must follow the identical pattern (`spawnSync("acme", [...], { encoding: "utf8" })`), never string-interpolating disassembler output into a shell command |
| Untrusted memory bytes (attacker-controlled program content) driving unbounded decoder behavior (e.g. an unterminated loop) | Denial of Service | The decoder is bounded by construction: `count`'s existing max of 100 (D-13) and the over-read-by-two-bytes rule cap how much memory is ever requested or decoded per call; no user-controlled recursion or unbounded loop should exist in `disasm-decoder.ts` |

## Sources

### Primary (HIGH confidence)
- `.claude/mcp/vice/vice-proxy.ts` (read live, lines 85-130, 1343, 1845, 2823-2923, 3100-3277) — confirmed `buildBackendAwareTool()`, `forwardToVice()`/`rewriteArguments()` call site, `gatherWedgeEvidence()` location, the closed hostpath consumer set
- `.claude/mcp/vice/stock-dispatch.ts` (read live, full file) — `withStockSession()`, `STOCK_DISPATCH_TABLE`, `dispatchStock()`, `ensureStockSession()`
- `.claude/mcp/vice/stock-handler.ts` (read live, full file) — `stockAnswer()`, `convertHandshakeError()`, `convertWireError()`
- `.claude/mcp/vice/stock-address.ts` (read live, full file) — `parseAddress()`, `parseByteCount()`, `setSymbolResolver()`
- `.claude/mcp/vice/stock-memory.ts` (read live, lines 1-230) — the `MemoryGet` pattern `vice_disassemble` reuses
- `.claude/mcp/vice/stock-paths.ts` (read live, full file) — D-17's mirror-image precedent, `STOCK_EMULATOR_SIDE_PATH_TOOLS`
- `.claude/mcp/vice/stock-paths.test.ts` (grepped live) — confirms `vice_disassemble` is already asserted absent from that table
- `.claude/mcp/vice/stock-schema-check.ts` (read live, full file) — the dependency-free `outputSchema` checker
- `.claude/mcp/vice/tools-manifest.json` (grepped live, lines 786-826) — the fork's exact `vice_disassemble` input schema (`address`, `count` max 100, `show_symbols`)
- `.claude/mcp/vice/test-gate.mjs` (read live, full file) — `MANUAL_ONLY_TESTS`, exactly 4 entries, frozen
- `scripts/check-npm-packages.mjs` (read live, full file) — the packaging validation this phase must extend
- `.github/workflows/ci.yml` (read live, full file) — confirmed exactly one `build` job with no ACME step
- `.claude/mcp/vice/package.json` (read live) — confirmed `files` array, no `prepack` script, exactly 2 runtime deps
- `installer/scripts/sync-skills.mjs` (read live) — the exact `prepack`-copy pattern recommended for the notices-file gap
- `.claude/skills/acme-build/SKILL.md` (grepped live) — the 18 verified `!cpu 6510` illegal mnemonics, the disassembly section, ACME version/location history
- `.claude/skills/acme-build/scripts/acme.mjs` (read live, `cmdDisasm`) — the existing `spawnSync("toacme", ...)` subprocess precedent
- Live shell commands this session: `command -v acme`/`toacme` (absent), `node --version` (v22.22.0), `npm pack --dry-run --json` in `.claude/mcp/vice` (confirmed LICENSE absent from tarball today)
- `github.com/cc65/cc65/src/da65/opc6502x.c` (fetched live via WebFetch, raw file) — zlib license header, 4-field entry struct, verified NOP-variant/JMP-indirect opcode data
- `masswerk.at/6502/6502_instruction_set.html` (fetched live via WebFetch) — 12 JAM/KIL opcodes, `$8B`/`$AB`/`$EB` addressing modes, NMOS `JMP` indirect page-wrap bug confirmation

### Secondary (MEDIUM confidence)
- `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/04-CONTEXT.md` (read live, full file) — the locked decisions this research grounds; treated as MEDIUM rather than HIGH only where it makes an external factual claim (e.g. "fluffy-6502 exists") this session could not independently confirm
- `www.oxyron.de/html/opcodes02.html` (fetched live via WebFetch) — cross-check for the NOP-class opcode enumeration

### Tertiary (LOW confidence)
- WebSearch results for "fluffy-6502" (no matching project found under that name — see Assumptions Log A1)
- The AI-summarized rendering of `opc6502x.c`'s exact C struct fields (Assumption A3) — recommend a raw re-fetch before transcription

## Metadata

**Confidence breakdown:**
- Standard stack (no new npm deps, ACME as the one external tool): HIGH — directly verified live, no external doc needed
- Architecture / seam design: HIGH — `buildBackendAwareTool()`, `withStockSession()`, `stock-paths.ts`'s mirror-image precedent all read directly from the real files
- Opcode data (NOP variants, JAM count, illegal opcode addressing modes, page-wrap bug): HIGH — cross-verified against two independent live sources (cc65 GitHub raw source, masswerk.at)
- Packaging mechanics (D-07's notices-file gate): MEDIUM — a real gap was found and two concrete resolutions proposed, but the planner must pick one
- `fluffy-6502` provenance: LOW — could not be found; flagged, not blocking

**Research date:** 2026-08-17
**Valid until:** Effectively indefinite for the opcode-table facts (6502/6510 hardware
behavior does not change); 30 days for the CI/packaging specifics (apt package
availability, npm packaging mechanics) in case the runner image or npm's own `files`
resolution semantics shift.
