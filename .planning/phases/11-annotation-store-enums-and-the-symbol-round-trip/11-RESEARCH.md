# Phase 11: Annotation Store, Enums, and the Symbol Round Trip - Research

**Researched:** 2026-08-20
**Domain:** MCP client implementation (this repo's first); regenerator2000 0.9.20 tool surface; enum-based semantic disassembly; VICE-label round trip
**Confidence:** HIGH on mechanism (everything load-bearing was run against the real binary on this host); MEDIUM-LOW on the two-session evidence protocol and the D-24/D-27 renderer shape, which are genuinely the planner's design work

## Summary

This phase turns this repo into an MCP **client** for the first time, proxying a
curated `r2000_*` tool surface through a child `regenerator2000 --mcp-server-stdio`
process. Every claim below that matters for that decision was measured on this
host: the protocol is MCP `2024-11-05` (hardcoded server-side,
`handler.rs:16`), framing is newline-delimited JSON with exactly one response per
request line processed synchronously (`mcp/stdio.rs:67-122`), and the SDK
(`@modelcontextprotocol/sdk@1.30.0`) is present in `node_modules` only as an
**undeclared transitive dependency** of `@mastra/mcp` — importing it directly
would be a phantom-dependency violation of this project's own `ENGINEERING_RULES.md`
§4. `@mastra/mcp` itself already exports a public `MCPClient` class built exactly
for this stdio-spawn shape, with zero new dependency footprint. Recommendation:
use it, with a fallback to a ~120-line hand-rolled client if `MCPClient`'s
heavier abstraction (OAuth, elicitation, roots, prompts — none of which this
phase needs) proves awkward for the fine-grained failure handling this phase's
own philosophy demands.

The most consequential, previously-undocumented finding: this repo already has
an **established pattern for a tool that never touches the emulator** —
`vice_result_continue` — registered as a proxy-local synthetic `ToolDefinition`
that bypasses `tools-manifest.json` and `forwardToVice()` entirely. The
`r2000_*` family should follow this exact pattern, not the manifest-tool
pattern. Doing so makes CLAUDE.md's "derived tools must be intercepted before
`forwardToVice()`" constraint moot by construction — the `r2000_*` runners
never call `forwardToVice()`, so `rewriteArguments()` (now at `vice-proxy.ts:2943`
inside `forwardToVice()`, and at `vice-proxy.ts:1422` inside
`gatherWedgeEvidence()` — both drifted from CLAUDE.md's cited line numbers)
is structurally unreachable for them.

Also measured, and materially reshaping the plan: `r2000_apply_enum_usage`
binds to the **instruction address holding the immediate operand** (the `lda`,
confirmed by direct call and by `handler.rs:1236-1264`'s description text),
not the store target. The ACME-exported enum reference uses `EnumName_VARIANT`
(underscore) exactly as criterion 3 quotes it — confirmed end-to-end via
`--export_asm` on a synthesized project — but the **live MCP `search_disassembly`
view renders the same reference with a dot** (`EnumName.VARIANT`), a real,
previously undocumented discrepancy between the in-session query surface and
the exported artifact that the planner must design around (see Priority 2).
Enum variant **names** are validated by nothing server-side (only the enum
**name** goes through `validate_new_enum_name`) — sanitization of variant
identifiers is entirely this repo's responsibility.

**Primary recommendation:** build the `r2000_*` surface as proxy-local synthetic
tools (mirroring `vice_result_continue`/`RECYCLE_TOOL`/`DIAGNOSE_TOOL`), backed
by `@mastra/mcp`'s `MCPClient` driving `r2000-launch.ts`'s (extended) argv
builders, registered identically on both backends since regenerator2000 never
touches VICE.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawn/lifecycle of the r2000 child process | Container-side MCP proxy (`vice-proxy.ts` + new `r2000-launch.ts` builders) | — | Same tier as every other regenerator2000 spawn (D-06); never host-side (D-R4) |
| MCP client protocol (initialize/tools-call/exit) | Container-side MCP proxy, new seam module | — | New responsibility; must be one seam per CLAUDE.md's "single seam per concern" |
| Annotation store (labels/comments/blocks/enums) | regenerator2000's own `AppState` (external, via the child process) | — | This project owns zero storage; the store lives entirely inside the `.regen2000proj` file regenerator2000 reads/writes |
| Enum generation from `memmap.json` | Container-side MCP proxy (new module, testable in CI) | `c64-memory-mapping` skill (source of `memmap.json`) | Must be `.ts` under `.claude/mcp/vice` to get CI coverage (Priority 7) — a skill-side `.mjs` never runs in CI |
| Symbol round trip (`--export_lbl`/`--import_lbl`) | Container-side MCP proxy (`r2000-launch.ts` argv builders) + `stock-symbols.ts` (existing store) | Stock `x64sc` (live half, `vice_symbols_load`) | `stock-symbols.ts` already owns the symbol-file parser; D-29 makes the store (not `vice_symbols_load`) the merge point |
| Markdown memory-map rendering | Container-side MCP proxy (new renderer, CI-testable) | `c64-program-recon` skill (invokes it) | Same CI-coverage argument as the enum generator |
| Confidence-grade convention (`[confirmed-code]` etc.) | r2000's own comment storage, read via `r2000_get_comments`/`search_disassembly` | — | No new storage; a string-prefix convention enforced by a parser + test on this repo's side |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**Store access and lifecycle**
- D-16: the store is reached by proxying `r2000_*` tools through our own MCP
  server, which drives `regenerator2000 --mcp-server-stdio` as a child and
  forwards calls. Not a second MCP server in the manifest, not CLI-only.
- D-17: per-call lifecycle — spawn, load, mutate, `r2000_save_project`, exit.
  No long-lived child, no process supervision.
- D-18: the surface is a curated subset named for the criteria, not a 28-tool
  passthrough. In: `set_label_name`, `set_comment`, `set_data_type`,
  `add_scope`, `get_cross_references`, `search_disassembly`, `get_symbols`,
  `get_comments`, `get_blocks`, `get_binary_info`, `disassemble`, the enum
  trio (`create_project_enum`, `update_project_enum`, `delete_project_enum`),
  `apply_enum_usage`, `save_project`, `batch_execute`. Out: TUI-shaped tools,
  `undo`/`redo`, `get_address_details` (D-32).
- D-19: every `r2000_*` tool takes an explicit `.regen2000proj` path argument.
- D-32 (Claude's call): `r2000_get_address_details` excluded; upstream issue
  #42 filed with reproduction and affected/unaffected tool table.
- D-33: `r2000_batch_execute` is exposed, with every inner call's tool name
  validated against the curated set before forwarding — mirrors `vice.ts`'s
  `DENY_LIST` smuggling guard. Pinned by a smuggling test.

**Enum generation (`R2000-13`)**
- D-20: generate program-specific enums — name only the values the program
  actually writes (2-5 variants per register typically), via adjacent
  `lda #imm` → `sta <register>` pairing.
- D-21: generated enums live project-level, inside the `.regen2000proj`, via
  `r2000_create_project_enum` + `r2000_save_project`. Never the global config
  dir.
- D-22: bit names come from `memmap.json`'s 29 structured `bits` entries plus
  a curated address→bit-name table in this repo, generated from memmap and
  reviewed once, re-runnable per R2000-13. `$D015`/`$D017`/`$D01A`-`$D01D` are
  absent from the 29 and land in the curated table if they land at all.
- D-23: pair `lda #imm` → `sta <register>` as an adjacent pair only, no
  dataflow. Report coverage explicitly (paired vs. total register stores).

**Store vs. prose in recon (`R2000-10`, `R2000-11`)**
- D-24: the store is canonical; the Markdown memory map becomes a rendered
  view.
- D-25: confidence grades live as a machine-readable prefix inside r2000 line
  comments (e.g. `[confirmed-code]`). Pinned by a test that a typo fails, not
  silently degrades.
- D-26: criterion 1 is demonstrated by a recorded two-session transcript on
  one real program — session A writes the store, session B (no access to A's
  prose) answers a question purely from `r2000_*` queries.
- D-27: run-scoped facts (capture SHA-256, `$01`, `$DD00`, video standard,
  raster positions) stay in Markdown as a provenance header — an input to the
  renderer, not a hand-edited region of a generated file.
  **⚠ Planner must reconcile D-24 with D-27** (see Priority 6).

**The symbol round trip (`R2000-14`, `R2000-15`)**
- D-28: the inbound leg is `--import_lbl` **plus** `--mcp-server-stdio` **plus**
  `r2000_save_project`. `--import_lbl` under plain `--headless` discards
  (measured, `main.rs:800-806`) — there is no CLI-only route.
- D-29: the store is the merge point — regenerate the full `.lbl` and reload.
  No merge mode added to `vice_symbols_load`.
- D-30: the live half runs against stock, with the fork verified unregressed
  under the standing BACK-02 gate.
- D-31: committed fixture for CI, a real program for the walkthrough.
- D-35 (Claude's call): `stock-symbols.ts`'s "STATED ASSUMPTION" note is
  corrected — `--export_lbl` compatibility is now verified (scoped to 0.9.20
  and one fixture).

**Scope corrections**
- D-34: `.vsf` is explicitly out of Phase 11; ROADMAP.md's Phase 10 criterion
  3 note, the milestone's standing `.vsf` preference, and Phase 10 CONTEXT.md's
  deferred-ideas entry all need correcting to point at "filed as backlog," not
  at this phase.

### Claude's Discretion

- D-32 — excluding `r2000_get_address_details`, filing upstream issue #42
  (already done; see Sources).
- D-35 — correcting `stock-symbols.ts`'s unverified-assumption note (already
  evidence-backed; see this document's own live reproduction below, which
  independently reconfirms it).
- The exact final tool-name list under D-18's rule.
- The CLI verb names.
- The file layout of the new modules inside the directory D-06 already fixed
  (`.claude/mcp/vice/`).

### Deferred Ideas (OUT OF SCOPE)

- `.vsf` as a bootstrap input (D-34) — file as backlog, do not implement.
- An upstream fix for `get_address_details` (issue #42) — not this phase's
  work.
- Enums as a reusable cross-project asset / upstream bitfield-enum feature
  request — out of scope, worth filing upstream separately.
- `$D015`/`$D017`/`$D01A`-`$D01D` widening `memmap.json` itself — that is
  `c64-memory-mapping` work, not this phase's.
- Non-ACME export formats (`64tass`, `ca65`, `kick`).
- Two-project-limit detection (permanently folded, `R2000-04`).
- `r2000_undo`/`r2000_redo` — unusable under D-17; git revert of the project
  file is the substitute.
- `r2000_set_immediate_format`'s `low_byte`/`high_byte` modes — candidate for
  a later phase, not this one.
- The fork-backend removal todo and the plugin-payload relocation todo —
  reviewed, not folded into this phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R2000-10 | `c64-program-recon` writes labels/comments/block types/scopes into queryable state | Priority 6 (store-canonical renderer shape); D-24/D-25 mechanism confirmed against real tool schemas below |
| R2000-11 | Query cross-references and search labels/comments/instructions | `get_cross_references`/`search_disassembly` argument and return shapes measured below (Priority 2/3 evidence) |
| R2000-13 | Enums generated from `memmap.json`, re-runnable | Priority 2 — full mechanism measured end-to-end including the exact ACME output and the search-view discrepancy |
| R2000-14 | Symbols export via `--export_lbl` into the symbol store, resolve through `vice_symbols_load` | Priority 3 — D-28/D-29 sequencing, `stock-symbols.ts` parser already verified compatible |
| R2000-15 | Names discovered live flow back via `--import_lbl`, closing the loop | Priority 3 — the `--import_lbl` discard trap and its fix are source-confirmed at `main.rs:800-806` |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Node ≥ 22.18, no build step for the shipped server.** New `.ts` modules
  under `.claude/mcp/vice` need no compilation; only host-bound `.mts` files
  compile to `resources/*.mjs`. The r2000 MCP-client seam is container-side —
  confirm it does **not** need a `resources/` artifact (it does not: it never
  runs outside the container, same as `r2000-launch.ts` today).
- **Derived tools must be intercepted before `forwardToVice()`, not behind
  `call()`.** `rewriteArguments()` currently runs at `vice-proxy.ts:2943`
  inside `forwardToVice()` (which itself starts at line 2878), and a second
  time at `vice-proxy.ts:1422` inside `gatherWedgeEvidence()` (which starts
  at line 1398) for the `vice_display_screenshot` path argument. **Both line
  numbers have drifted from CLAUDE.md's cited `2889`/`1368`** — re-verify at
  plan time, as CLAUDE.md itself warns. The `r2000_*` surface avoids this
  hazard entirely by never calling `forwardToVice()` (see Priority 4).
- **Any host-facing path goes through the closed `hostpath.ts`/
  `containerpath.ts` consumer set** (currently exactly five members, enforced
  by `hostpath-consumers.test.ts`). New r2000 modules join the "must be
  absent" side, per D-08's precedent — regenerator2000 runs container-side
  and no argument to it is ever host-translated.
- **ENGINEERING_RULES.md §4 (Dependency Policy):** a new runtime dependency
  needs explicit justification (why existing code/stdlib can't do it,
  maintenance status, install/packaging impact, container/host implications,
  prerequisite-story impact). This directly gates the MCP-client-shape
  decision (Priority 1) — importing `@modelcontextprotocol/sdk` directly
  would be a new, *undeclared* dependency riding on another package's
  transitive resolution, which several linters and this project's own
  `check-npm-packages.mjs` "no new runtime dependency" pattern
  (`DISASM-07`) treat as an anti-pattern class worth flagging explicitly.
- **ENGINEERING_RULES.md §6 (Non-Vacuous Verification):** the deny-by-scan
  guard for `r2000-launch.ts` must be shown failing under a planted
  violation. This is precisely what WR-02 (Priority 5) already proves is
  currently NOT true — the guard test's own `stripCommentLines()` can be
  fooled, which is a live, demonstrated violation of this exact rule.
- **§7 Independent Oracle Rule:** real regenerator2000 for static-analysis
  claims is the top of the evidence hierarchy for this milestone — this
  document practices that by driving the real 0.9.20 binary by hand rather
  than reasoning from CONTEXT.md's prior measurements alone.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mastra/mcp` | 1.15.0 (already a direct dependency, `package.json`) | Provides `MCPClient`, a public class purpose-built for spawning a stdio MCP server and calling its tools | Already declared; adds zero new dependency footprint; used nowhere else in this repo yet, but is exactly the shape D-16 needs |
| `regenerator2000` (external binary) | 0.9.20 (installed, `~/.cargo/bin/regenerator2000`) | The annotation-store backend this whole milestone integrates | Not an npm package; a required external prerequisite per the milestone's standing constraints |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` (builtin) | Node 22.18+ | Spawning the r2000 child, if the hand-rolled fallback is chosen instead of `MCPClient` | Only if `MCPClient`'s abstraction proves a poor fit for D-17's failure-mode requirements (see Priority 1) |
| `node:readline` (builtin) | Node 22.18+ | Newline-delimited JSON-RPC framing for the hand-rolled fallback | Same condition as above — the wire format is confirmed newline-delimited (measured, see Priority 1), so `readline`'s line-based interface is a natural fit, no custom buffer needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mastra/mcp`'s `MCPClient` | `@modelcontextprotocol/sdk`'s `Client` + `StdioClientTransport` directly | Same underlying transport (the SDK is what `MCPClient` wraps internally, confirmed via `client.d.ts`'s `private client` field), but importing it directly is an undeclared phantom dependency — resolvable today only because it happens to be hoisted into `.claude/mcp/vice/node_modules/@modelcontextprotocol/sdk` by npm's current dedup pass. A future `@mastra/mcp` bump that nests it instead of hoisting would silently break a bare `import "@modelcontextprotocol/sdk/..."` in this repo's own code, with no `package.json` line to explain why. Do not do this. |
| `@mastra/mcp`'s `MCPClient` | Hand-rolled ~120-line newline-JSON-RPC client | Full control over every named failure mode (spawn failure, mid-call exit, stderr interleaving, never-answers timeout) with zero new dependency and a shape matching this repo's own established style (`r2000-launch.ts`, `vice-broker-client.ts`). Cost: reimplements `initialize`/protocol-version negotiation and request/response correlation that `MCPClient` already has tested. Recommended as the **fallback**, not the default — reach for it only if `MCPClient`'s connection-state machine (which the SDK's own changelog and `client.d.ts`'s own doc comments flag as having had a real stale-transport bug, issue #19862, worked around inside `InternalMastraMCPClient`) makes it hard to guarantee "never trust a misleading success" for this phase's specific lifecycle. |
| Curated tool subset (D-18) | Mirror all 28 tools | Rejected by CONTEXT.md already; not revisited here. |

**Installation:** no new `npm install` is required for the recommended path —
`@mastra/mcp` is already a declared dependency. If the fallback hand-rolled
client is chosen, it also requires no `npm install` (Node builtins only).

**Version verification (measured):**
```
$ regenerator2000 --version
regenerator2000 0.9.20
$ cat .claude/mcp/vice/node_modules/@modelcontextprotocol/sdk/package.json | grep version
"version": "1.30.0",
$ cat .claude/mcp/vice/node_modules/@mastra/mcp/package.json | grep version
"version": "1.15.0",
```
`@mastra/mcp`'s own `package.json` declares
`"@modelcontextprotocol/sdk": "^1.29.0"` as a real dependency (not dev-only),
so the SDK's presence is guaranteed wherever `@mastra/mcp` installs — but only
reachable through `@mastra/mcp`'s own exports, not as a bare import from this
repo's code.

## Package Legitimacy Audit

No new external package is being added by this phase under the recommended
path (`@mastra/mcp`'s existing `MCPClient`, or Node builtins for the
hand-rolled fallback). `slopcheck`/registry verification is not applicable —
skipped, not omitted:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | N/A — no new package |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Claude session
     │  tools/call "r2000_search_disassembly" {project, ...}
     ▼
vice-proxy.ts  (existing MCP stdio server, unchanged entry point)
     │
     │  synthetic tool lookup — r2000_* names registered directly in the
     │  `tools` record (SAME pattern as vice_result_continue), NEVER through
     │  the manifest loop, NEVER through buildBackendAwareTool()
     ▼
new module: r2000-mcp-client.ts (the ONE seam that is "we are an MCP client")
     │
     │  1. runR2000Verb("mcp-server-stdio", { projectPath })  [r2000-launch.ts,
     │     new argv builder — argv = ["--mcp-server-stdio", projectPath]]
     │  2. spawn child, get stdin/stdout pipes
     │  3. write one newline-terminated JSON-RPC request per r2000_* call
     │     (initialize → the caller's single tools/call → optional
     │     batch_execute wrapping N calls → close stdin)
     │  4. read exactly one newline-terminated JSON-RPC response per request,
     │     matched by id, off a readline/ReadBuffer-equivalent
     │  5. never resolve success without inspecting BOTH the JSON-RPC "error"
     │     field AND (for save_project) the child's exit code AND stderr,
     │     mirroring r2000-verify.ts's no-exit-code-trust posture
     ▼
regenerator2000 --mcp-server-stdio <path>.regen2000proj  (child process,
container-side, --vice guarded absent by r2000-launch.ts's existing
assertNoViceFlag(), never touches VICE)
     │
     │  reads/mutates AppState in memory; r2000_save_project writes it back
     ▼
<path>.regen2000proj  (the annotation store — labels, comments, blocks,
scopes, enums, enum_usages — on disk, git-diffable)
```

Separately, the symbol round trip (criterion 4) is a second, narrower flow
through the SAME `r2000-mcp-client.ts` seam plus `stock-symbols.ts`:

```
running x64sc (stock)  --[vice_symbols_lookup / a discovered name]-->
this repo's Claude session  --[writes the name via r2000_set_label_name OR
  hands it to the --import_lbl leg below]-->
.regen2000proj (store)
     │  r2000_save_project
     ▼
.regen2000proj on disk
     │  vice-mcp r2000 export-lbl <verb, new> --> spawns
     │  regenerator2000 --headless --export_lbl <path> --assembler acme <proj>
     ▼
<name>.lbl  (VICE label file, `al C:xxxx .Name` lines, USER labels only —
  measured: auto-generated a_D011-style externals do NOT export)
     │  vice_symbols_load {path}  (existing DERIV-04 tool, stock backend)
     ▼
running x64sc: name resolves a live address
     │  (a NEW name discovered live, e.g. via vice_symbols_lookup failing,
     │   then a human/session naming it)
     ▼
append to the SAME .lbl file (or a delta file, merged by regenerating)
     │  regenerator2000 --headless --import_lbl <path> --mcp-server-stdio <proj>
     │  (D-28: import_lbl alone under --headless DISCARDS -- main.rs:800-806 --
     │  --mcp-server-stdio must ALSO be present so mcp_server=true skips the
     │  early return, THEN the client must still call r2000_save_project
     │  itself over that same stdio session, since import_lbl only mutates
     │  in-memory state)
     ▼
.regen2000proj (store) updated -- closes the loop
```

### Recommended Project Structure

```
.claude/mcp/vice/
├── r2000-launch.ts          # EXTENDED, not replaced: add buildMcpServerStdioArgs(),
│                            #   buildExportLblArgs(), buildImportLblArgs() alongside
│                            #   the existing buildExportAsmArgs()/buildVerifyArgs()
├── r2000-mcp-client.ts      # NEW: the ONE "we are an MCP client" seam --
│                            #   spawn, initialize, call, batch, close, with
│                            #   every named failure mode handled explicitly
├── r2000-tools.ts           # NEW: the curated r2000_* ToolDefinition objects
│                            #   (name/description/inputSchema) + their runners,
│                            #   registered as PROXY-LOCAL SYNTHETIC tools in
│                            #   vice-proxy.ts (mirrors vice_result_continue)
├── r2000-enum-gen.ts        # NEW: memmap.json -> curated bit-name table ->
│                            #   program-specific enum variants -> r2000_create_project_enum
│                            #   calls. Re-runnable, CI-testable (Priority 7).
├── r2000-memmap-render.ts   # NEW: store (via r2000_* queries) + a provenance
│                            #   header input -> rendered memory-map.md
├── r2000-confidence.ts      # NEW: the [confirmed-code]-style prefix
│                            #   convention: parse/validate/render, pinned by
│                            #   a typo-fails test (D-25)
└── (existing r2000-launch.ts, r2000-project.ts, r2000-verify.ts, r2000-d64.ts,
    r2000-cli.ts unchanged in shape, extended in content)
```

### Pattern 1: Proxy-local synthetic tool (the established precedent)

**What:** A tool advertised in `tools/list` and dispatched from `vice-proxy.ts`
that is NOT sourced from `tools-manifest.json` and NEVER calls
`forwardToVice()`/`call()`/`dispatchStock()`.

**When to use:** Any capability that is backend-independent by construction —
exactly regenerator2000's case, since it "never touches VICE" (ROADMAP.md,
milestone overview) and behaves identically on fork or stock.

**Example (existing precedent, read not written by this phase):**
```typescript
// Source: .claude/mcp/vice/vice-proxy.ts (existing, ~line 3238)
// vice_result_continue is "Backend-INDEPENDENT by construction: ... served
// entirely from this proxy's own CONTINUATION_STORE and opens no socket of
// any kind" -- the exact category the r2000_* family belongs to.
tools[RESULT_CONTINUE_TOOL.name] = buildViceTool(
  RESULT_CONTINUE_TOOL,
  (args) => Promise.resolve(handleResultContinue(args)),
);
```
Every `r2000_*` tool should be registered the same way:
```typescript
// NEW pattern, following the precedent above exactly
for (const def of R2000_TOOL_DEFINITIONS) {
  tools[def.name] = buildViceTool(def, (args) => runR2000Tool(def.name, args));
}
```
`buildViceTool()` (not `buildBackendAwareTool()`) is the correct wrapper —
there is no fork/stock distinction to make.

### Pattern 2: `lda #imm` / `sta <register>` pairing without `read_region`

**What:** D-18's curated set excludes `r2000_read_region` and
`r2000_get_address_details`, so the enum generator cannot ask "what
instruction sits at address X" directly. It CAN ask `r2000_search_disassembly`
twice — once matching immediate loads, once matching stores to known
registers — and pair results by address arithmetic.

**When to use:** The enum generator's `lda #imm` → `sta <register>` pass
(R2000-13/D-23).

**Example (mechanism, confirmed by direct measurement below):**
```typescript
// Pass 1: every "lda #..." instruction anywhere in the disassembly.
const ldas = await callR2000("r2000_search_disassembly", {
  query: "^lda #",
  use_regex: true,
  search_labels: false,
  search_comments: false,
  search_instructions: true,
  max_results: 10000, // default is 50 -- MUST override for a full-program pass
});
// Pass 2: every store to a register this repo's curated bit-name table knows.
const stores = await callR2000("r2000_search_disassembly", {
  query: `^sta \\$(${knownRegisterHexAlternation})`,
  use_regex: true,
  search_instructions: true,
  search_labels: false,
  search_comments: false,
  max_results: 10000,
});
// Pair: "lda #imm" is ALWAYS exactly 2 bytes in immediate addressing mode
// (opcode + 1-byte operand), so the adjacent store begins at ldaAddr + 2.
// This holds regardless of the store's own addressing mode (zero-page,
// absolute, or absolute-indexed all begin their own encoding at ldaAddr+2).
const byAddr = new Map(ldas.map((r) => [r.address_decimal, r]));
for (const store of stores) {
  const lda = byAddr.get(store.address_decimal - 2);
  if (lda) pairs.push({ ldaAddr: lda.address_decimal, imm: parseImmediate(lda.operand), register: store.operand });
}
```
**Measured caveat:** `max_results` defaults to 50 (`handler.rs:1041-1105`); a
real program's full immediate-load count can exceed that easily, and the
default would silently truncate coverage — exactly the "no silent caps"
posture CLAUDE.md and D-23 both call out. Always pass an explicit
`max_results` and log when the returned count equals the requested cap
(a possible truncation signal).

### Anti-Patterns to Avoid

- **Registering `r2000_*` tools through the manifest loop or
  `buildBackendAwareTool()`:** `tools-manifest.json`/`tools-manifest.stock.json`
  are regenerated FROM the live host VICE server's own `tools/list`
  (`refresh-manifest.ts`) — an `r2000_*` entry hand-added there would be
  silently wiped on the next refresh, and `resources-sync.test.ts`/manifest
  drift tests have no reason to know about it. Use the synthetic-tool
  pattern instead (Pattern 1).
- **Calling `rewriteArguments()` or `forwardToVice()` from any `r2000_*`
  runner:** would apply host-path translation to a container-side-only
  argument, the exact mirror-image bug CLAUDE.md's own "inversion hazard"
  note in ROADMAP.md's Standing Constraints describes.
- **Trusting `r2000_save_project`'s text response as sufficient proof of
  persistence:** the response is `{"content":[{"type":"text","text":"Project
  saved to <path>"}]}` — a string, not a checksum or a re-read. Given this
  project's own "never trust a misleading success" history
  (`r2000-verify.ts`), the client should re-open the saved file (or re-run a
  read-only query in a FRESH child process against the same path) before a
  plan step is allowed to claim the save succeeded.
- **Assuming `search_disassembly`'s rendered operand text matches the ACME
  export text for an applied enum.** Measured: it does not (dot vs.
  underscore separator — see Priority 2). Any acceptance check for criterion
  3 must run `--export_asm` (or `--verify`) and inspect THAT text, not the
  live MCP query surface's own rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP client protocol handshake / message correlation | A bespoke `initialize` + request-id bookkeeping implementation from scratch as the DEFAULT choice | `@mastra/mcp`'s `MCPClient` (already a declared dependency) | Zero new dependency, already tested against real MCP servers, exactly the stdio-spawn shape this phase needs |
| VICE label file parsing (`al C:xxxx .Name`) | A third parser for the `.lbl` format | `stock-symbols.ts`'s existing parser (already the hardened reader; D-29's regenerate-and-reload route reuses it) | This repo already has two parsers of this format (`stock-symbols.ts`, `acme.mjs`'s `curateLabels()`); D-16/D-28 deliberately avoid a third by using r2000's OWN `--import_lbl`/`--export_lbl` |
| Cross-reference / xref computation | Re-implementing address-reference tracking in Node | `r2000_get_cross_references` (measured working, returns a plain array of addresses) | This is literally why Tier 2 (the MCP surface) exists instead of a CLI-only route — D-16's own rejected-alternative reasoning |
| Enum bit-OR composition | A client-side bitmask formatter that emits an OR'd expression | Nothing — r2000 genuinely has no bit-OR enum mechanism in 0.9.20 (source-confirmed, `EnumDefinition.variants: BTreeMap<u16,String>`); D-20's flat program-specific value enum is the only shape available | Building bit-OR composition client-side would mean re-implementing `format_enum_definition`'s role for a formatter that doesn't exist — out of scope; file upstream instead (already noted as a deferred idea) |

**Key insight:** Nearly everything this phase needs is already a real,
measured-working `r2000_*` tool call. The only genuinely new code is (1) the
MCP client seam itself, (2) the enum-generation pairing/naming logic (which
combines two already-working queries), and (3) the Markdown renderer. Resist
building a fourth thing.

## Common Pitfalls

### Pitfall 1: Trusting the live MCP view's enum rendering as the criterion-3 proof
**What goes wrong:** `search_disassembly`'s returned `operand` text for an
applied enum reads `D011.YSCROLL3_ROW25_SCREENON_TEXT` (a dot), not
`D011_YSCROLL3_ROW25_SCREENON_TEXT` (an underscore) as criterion 3's own
quoted wording requires.
**Why it happens:** `search_disassembly`'s rendering path is internal to
`state/search.rs` and is NOT the same code as `disassembler/formatter_acme.rs`'s
`format_enum_reference()` (which literally does `format!("{enum_name}_{variant_name}")`).
Measured directly (see Sources): `--export_asm` on the identical project
produces the underscore form exactly matching the criterion.
**How to avoid:** Verify criterion 3 against `--export_asm`/`--verify` output
(the ACME text), never against `search_disassembly`'s own rendering. Treat
the live-view rendering as a convenience for finding WHERE an enum applies,
not as the acceptance surface.
**Warning signs:** A test that asserts on `search_disassembly`'s `operand`
field containing an underscore-joined enum name will falsely fail even when
the actual generated ACME source is correct.

### Pitfall 2: `default max_results=50` silently truncating enum-pairing coverage
**What goes wrong:** A real program can have far more than 50 immediate
loads; the default cap on `r2000_search_disassembly` silently returns only
the first 50 matches with no indication more exist.
**Why it happens:** `handler.rs:1074-1077`, `.unwrap_or(50)`.
**How to avoid:** Always pass an explicit `max_results` well above any
expected count (e.g. 10000) for a full-program pairing pass, and log the
returned-count-vs-cap comparison so a future truncation is visible (D-23's
"report coverage explicitly" rule already demands this discipline).
**Warning signs:** Exactly 50 results returned from a search that "feels"
like it should have more.

### Pitfall 3: Enum variant names are unvalidated by r2000 — a bad name reaches ACME silently
**What goes wrong:** `create_project_enum_impl` (`handler.rs:2014-2057`)
validates the enum NAME (`validate_new_enum_name`) but performs zero
validation on variant name strings — they flow straight from the caller's
JSON `variants` map into `EnumDefinition.variants` and then into
`format!("{}_{}", enum_def.name, variant)` at export time. A variant name
with a space, a leading digit, or an ACME-reserved character produces
invalid ACME source that only fails at assembly time, far from the enum
creation call.
**How to avoid:** Sanitize/validate every generated variant identifier
client-side before calling `r2000_create_project_enum` — this IS the
"curated table" work D-22 already names, just extended to cover generated
identifier legality, not only bit-name accuracy.
**Warning signs:** A `--verify`/`acmeVerdict()`-style reassembly failure with
an ACME syntax error pointing at a `= $xx` enum-definition line.

### Pitfall 4: `--import_lbl` silently discarding under plain `--headless`
**What goes wrong:** Names imported via `--import_lbl --headless <proj>`
appear to succeed (no error) but are never persisted; a subsequent
`--export_lbl` reads only the pre-existing labels.
**Why it happens:** `main.rs:800-806`: `if headless && !mcp_server { return
Ok(()) }` — the save-on-exit path is skipped whenever the process is headless
but NOT also an MCP server.
**How to avoid:** D-28's fix: always pair `--import_lbl` with
`--mcp-server-stdio` (which sets `mcp_server=true`, `main.rs:709-711`) and
have the client explicitly call `r2000_save_project` over that session —
`--import_lbl` only mutates in-memory state; only an explicit save (or the
non-headless TUI's own save) persists it.
**Warning signs:** A round-trip test that only checks the import call's own
JSON-RPC response for `error: null` — that response is `Ok` even on the
silently-discarded path, since the import itself succeeds; only a
subsequent re-read proves persistence.

### Pitfall 5: `stripCommentLines()`'s guard test can go vacuous (WR-02)
**What goes wrong:** `.claude/mcp/vice/r2000-launch.test.ts:39-56`'s
`stripCommentLines()` sets `inBlock = true` when a trimmed line starts with
`/*` and does not ALSO end with `*/` on that same line, and only clears
`inBlock` when a LATER line's trimmed text ends with `*/` **exactly at the
end of the line**. A legitimate multi-line JSDoc block whose closing line has
trailing content after `*/` (e.g. `*/ someRealCode();`) never satisfies
`trimmed.endsWith("*/")`, so `inBlock` stays `true` for the rest of the file
— everything after is silently dropped from the guard's scan, including a
genuine rest-parameter pass-through the guard exists to catch.
**Why it happens:** The state machine's "close the block" condition is an
exact suffix match rather than a substring/`includes()` check, and it
discards the trailing code on the closing line instead of re-scanning it.
**How to avoid:** This is D-06/D-16's own load-bearing guard — Phase 11
depends on `r2000-launch.ts` staying the only spawn path, and this guard
being real is what makes that true. Fix `stripCommentLines()` to detect `*/`
anywhere in the remaining text (not only as a line-ending suffix) and
continue scanning the remainder of that same line as code, then prove the
fix by **planting exactly the violation the reviewer already demonstrated**
(a rest-param pass-through hidden after such a comment) and confirming the
test now fails before the fix and passes after — the Non-Vacuous
Verification rule (ENGINEERING_RULES.md §6) applied literally.
**Warning signs:** None visible without deliberately planting the violation
— that is precisely why this is a "verify non-vacuously" item, not a
"read the code and see" item.

## Code Examples

### Driving `--mcp-server-stdio` by hand (verified pattern, this session)

```javascript
// Source: measured directly against regenerator2000 0.9.20 on this host
// (see "Sources" -> Primary, live reproduction).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn("regenerator2000", ["--mcp-server-stdio", projPath], {
  stdio: ["pipe", "pipe", "pipe"],
});
const rl = createInterface({ input: child.stdout });
rl.on("line", (line) => {
  const msg = JSON.parse(line); // one complete JSON-RPC message per line, always
  // correlate by msg.id against a pending-request map
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "vice-mcp", version: "0" } } }) + "\n");
// ... tools/call requests follow the same shape ...
child.stdin.end(); // closing stdin is what ends the child's read loop (mcp/stdio.rs:72, `while reader.read_line(...) > 0`)
```

### Enum creation and application (measured, end to end)

```javascript
// Source: measured directly, see "Sources" -> Primary.
await callR2000("r2000_create_project_enum", {
  name: "D011",
  variants: { "$1b": "YSCROLL3_ROW25_SCREENON_TEXT" }, // hex string keys accepted (parse_variants, types.rs:481-525)
});
await callR2000("r2000_apply_enum_usage", { address: 0x0810, name: "D011" }); // 0x0810 is the LDA address, confirmed
await callR2000("r2000_save_project", {});
// Later, out-of-process:
//   regenerator2000 --headless --export_asm out.a --assembler acme proj.regen2000proj
// produces (measured verbatim):
//   ; ENUMS
//   ;   Enum: D011
//   D011_YSCROLL3_ROW25_SCREENON_TEXT = $1b
//   * = $0810
//                       lda #D011_YSCROLL3_ROW25_SCREENON_TEXT
//                       sta $d011            ; VIC Control Register 1
//                       rts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| This repo as MCP server only | This repo as MCP server AND MCP client | Phase 11 (this phase) | New failure-mode surface: a child process, not just a socket to a host; needs its own "never trust a misleading success" discipline, same as `r2000-verify.ts` already established for CLI verbs |
| Markdown memory map as the primary artifact | Markdown memory map as a generated view over a queryable store | Phase 11 (D-24) | `templates/memory-map.template.md`'s confidence vocabulary and structure survive as the RENDERER's target shape, not as a hand-filled template |

**Deprecated/outdated:**
- `R2000-13`'s own wording crediting `--dump-enum-files` as "the enum
  mechanism" is corrected by D-22: that flag only dumps the three built-in
  enums and exits; it is a discovery tool for the TOML shape, not an install
  path. The install path is `r2000_create_project_enum`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@mastra/mcp`'s public `MCPClient` class is stable/suitable API surface for this use (not merely a convenience wrapper the Mastra team could change without notice) | Standard Stack, Priority 1 | If `MCPClient`'s public shape changes in a future `@mastra/mcp` bump, this seam needs rework; mitigated by it being a genuinely public, documented class (not `@internal`) |
| A2 | The dot-vs-underscore enum rendering discrepancy (search view vs. ACME export) is consistent across regenerator2000 versions, not an 0.9.20-specific quirk | Common Pitfalls #1 | If a future r2000 version unifies the two renderers, a plan step written to specifically re-verify via `--export_asm` costs nothing extra; if this document's finding is instead treated as permanent by a later phase, that would be the risk — flag it as version-scoped |
| A3 | `stripCommentLines()`'s WR-02 fix (detect `*/` anywhere, not only as a line suffix) is sufficient and does not introduce a new false-negative for a `/*` appearing inside a string literal on the same line as real code | Common Pitfalls #5 | Low risk given `r2000-launch.ts` has no such string literals today, but the fix should still be verified against the reviewer's exact planted-violation case, not merely reasoned about |

**If this table is empty:** N/A — see entries above; none of them are load-bearing enough to block planning, all are flagged for a cheap follow-up check during execution.

## Open Questions (RESOLVED)

All three were dispositioned during planning (2026-08-20); each carries an
inline `RESOLVED:` line naming the task that settles it. None blocked planning.

1. **Does `MCPClient`'s connection-state machine correctly surface a "never answers" `tools/call` as a timeout, or does it hang indefinitely?**
   - What we know: `@mastra/mcp`'s `MCPClientOptions.timeout` (default 60000ms) is a *global* per-server timeout; `client.d.ts`'s own doc comments reference a real historical bug (issue #19862) around stale transports after a failed connect, worked around internally.
   - What's unclear: whether that same timeout applies per-`tools/call` (protecting against regenerator2000 hanging mid-request) or only to the initial `connect()`.
   - Recommendation: the planner should write one focused integration test that spawns a script (not real regenerator2000) which accepts `initialize` but never answers a subsequent `tools/call`, and confirm `MCPClient` surfaces this as a bounded-time failure rather than hanging the whole plan step. If it does not, this is the strongest argument for the hand-rolled fallback.
   - **RESOLVED by `11-04` Task 2** — the `MCPClient`-vs-hand-rolled choice is made by a determinate five-property measurement rule against a stub server, with "child exit code reachable" and "stderr reachable" named as the fallback triggers.

2. **Why does this session's minimal `synthesizeProject()`-bootstrapped project never populate `a_D011`-style auto-labels, while CONTEXT.md's own D-19/D-20 evidence block shows `sta a_D011` in its example?**
   - What we know: `get_symbols({kind: "system"})` and `get_symbols({kind: "auto"})` both returned `[]` on a project built purely via `synthesizeProject()` + `r2000_disassemble`; the ACME export rendered `sta $d011 ; VIC Control Register 1` (raw hex, with an auto-attached comment) rather than `sta a_D011`. The `a_` prefix is `LabelType::AbsoluteAddress` (`state/types.rs:387`), populated during analysis (`analyzer.rs:81,116,149,326`).
   - What's unclear: whether CONTEXT.md's original measurement used a project bootstrapped through a different route (e.g. the pty/TUI Save-As path from Phase 9, which may trigger a broader `auto_analyze` pass than the direct-JSON-synthesis route this phase's D-19 lifecycle will actually use in production), or whether it is order-of-operations sensitive (e.g. calling `get_cross_references` before `disassemble` seeds the label differently).
   - Recommendation: this discrepancy is immaterial to criterion 3's literal acceptance target (the LDA/enum half reproduces byte-for-byte), so it should not block planning — but the planner should note it and NOT write a task that asserts `a_D011`-style auto-labels appear in the exported output, since this session's reproduction (using the exact bootstrap route D-19 commits to) shows they do not.
   - **RESOLVED by `11-08`** — carries an explicit instruction not to assert `a_`-prefixed auto-labels in exported output. The discrepancy itself stays open upstream and is not this phase's to settle.

3. **Does `r2000_batch_execute`'s inner-call error handling stop on first failure or continue?**
   - What we know: `handler.rs:506-...` (partially read) shows a loop over `calls` pushing `{"status": "success", "result": ...}` per successful inner call; the failure-arm was not fully captured in this session's reading.
   - What's unclear: the exact partial-failure semantics (does one bad inner call abort the batch, or does it report per-call status and continue?).
   - Recommendation: read `handler.rs:506-542` fully at plan/implementation time (not deferred to research) since D-33's smuggling-gate task needs to know whether a rejected inner name should short-circuit the WHOLE batch (current CONTEXT.md wording: "A batch is refused whole if any inner name is outside the curated set") — that refusal happens on THIS repo's side, before any call reaches r2000, so r2000's own partial-failure semantics only matter for a batch that mixes a valid new-annotation call with one that fails for an unrelated reason (e.g. an out-of-range address).
   - **RESOLVED by `11-05` Task 1** — requires reading `handler.rs:506-542` in full at implementation time and recording the observed partial-failure semantics in the module header.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `regenerator2000` binary | The entire phase | ✓ (measured, `~/.cargo/bin/regenerator2000`) | 0.9.20 | None — required prerequisite (D-R2), not optional |
| `@mastra/mcp` | MCP client shape (recommended path) | ✓ (already a declared+installed dependency) | 1.15.0 | Hand-rolled client (Node builtins only) |
| `@modelcontextprotocol/sdk` | Transitively, via `@mastra/mcp` | ✓ (present in `node_modules`, NOT declared directly) | 1.30.0 | N/A — never import this directly (see Standard Stack, Alternatives) |
| Genuine stock `x64sc` | Criterion 4's live half (D-30) | ✓ (measured, `/usr/bin/x64sc`, unpatched — fork shadows it on `PATH`) | (unpatched stock, per project memory) | None needed — this is the primary route, not a fallback |
| `probe-illegal.prg` (committed fixture) | D-31's CI-side fixture, if reused | ✓ (`.planning/phases/09.../evidence/fixture/probe-illegal.prg`) | — | Build a purpose-made small `.prg` instead (planner's choice per D-31) |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** the MCP client library choice itself
has a documented fallback (hand-rolled), covered above.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `package.json`'s `"test": "node --test '*.test.*'"` in `.claude/mcp/vice` |
| Quick run command | `cd .claude/mcp/vice && node --test r2000-mcp-client.test.ts` (per-module, once it exists) |
| Full suite command | `cd .claude/mcp/vice && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2000-10 | Recon writes labels/comments/blocks/scopes to the store | integration (real r2000 child, gated) | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ❌ Wave 0 — new file |
| R2000-10 | A LATER session answers a question by querying only | human-witnessed transcript (see below — not sampleable by a single-process unit test) | N/A — recorded artifact | ❌ Wave 0 — new evidence file under the phase's `evidence/` dir |
| R2000-11 | `get_cross_references`/`search_disassembly` return correct results | integration (real r2000 child, gated) | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ❌ Wave 0 |
| R2000-13 | Enum generation from `memmap.json`, re-runnable, produces the literal `lda #imm`/`sta $d011` semantic render | integration (real r2000 child, `--export_asm`, real `acme`) | `VICE_REQUIRE_R2000=1 ACME_AVAILABLE=1 node --test r2000-enum-gen.test.ts` | ❌ Wave 0 |
| R2000-14 | `--export_lbl` produces a format `stock-symbols.ts` parses | integration (real r2000 child) — already partially proven this session | `VICE_REQUIRE_R2000=1 node --test r2000-launch.test.ts` (extend existing) | Partial — `r2000-launch.ts`/`.test.ts` exist, need new builders + tests |
| R2000-15 | `--import_lbl` + `--mcp-server-stdio` + `save_project` persists, and a store-is-merge-point reload closes the loop | integration (real r2000 child) + live stock `x64sc` walkthrough (D-30, D-31) | `VICE_REQUIRE_R2000=1 node --test r2000-symbol-roundtrip.test.ts`; live half is human-witnessed, not automated in CI | ❌ Wave 0 for the automated fixture half |

### Sampling Rate

- **Per task commit:** the module's own `node --test <file>.test.ts` (no
  `VICE_REQUIRE_R2000`/real-binary requirement forced locally, following the
  `SKIP_REASON` convention — CI without the real binary SKIPS, never FAILs
  unless `VICE_REQUIRE_R2000` is explicitly exported).
- **Per wave merge:** full `npm test` inside `.claude/mcp/vice`.
- **Phase gate:** full suite green, PLUS the two human-witnessed artifacts
  (two-session transcript for criterion 1, one-real-program walkthrough for
  criterion 4) committed under the phase's `evidence/` directory before
  `/gsd-verify-work`.

**The sampling-rate problem, named explicitly:** criterion 1's claim — "a
LATER session answers a question by querying the store" — is a claim about
**session boundaries and prose-blindness**, not about the store's query API
working. A single-process `node --test` run cannot sample "a different
Claude session, with no access to the first session's prose" at all; it can
only sample "does `get_symbols`/`search_disassembly` return correct data,"
which is necessary but not sufficient evidence for criterion 1. This is why
D-26 requires a recorded two-session transcript as a SEPARATE evidence class
from the automated fixture test (D-31's parallel structure for criterion 4)
— the automated test guards the query layer from regressing (closing Phase
10's WR-02-shaped "vacuous construction test" risk), while the transcript is
the only artifact that actually samples the criterion's real claim. Concretely:

- **Do not** design the two-session protocol as a nested headless `claude -p`
  invocation from inside an executor agent — this project has a documented,
  repeated failure mode of nested headless sessions stalling
  (`gsd-executor-nested-headless-session-stall`).
- **Do** structure it as two SEPARATE waves/plans in this phase's own plan
  set: Wave N's plan drives session A's work (recon on a real program,
  writing to the store, closing with `r2000_save_project`) and commits the
  resulting `.regen2000proj` plus a written-down QUESTION (not the answer) as
  a committed artifact. Wave N+1's plan is executed as a genuinely separate
  execution context — a fresh `/gsd-execute-phase` continuation or a fresh
  agent invocation with ONLY the committed `.regen2000proj` and the committed
  question in its context, explicitly prohibited from reading the prior
  wave's PLAN.md prose or session transcript. Its output (the answer, plus
  the exact `r2000_*` calls it made to derive it) is the transcript D-26
  wants. This makes the "no access to A's prose" property structural
  (enforced by what context the second execution is actually given) rather
  than a request the agent might not honor.
- **Falsifiability, to avoid a WR-02-shaped vacuous artifact:** the committed
  question must be answerable ONLY from the store (not answerable by reading
  the `.prg`/`.a` source directly, and not a question whose answer is
  guessable from the program's name or a comment in the plan file itself).
  A good test: could the question be answered correctly by an agent that has
  never seen the program at all, just by guessing? If yes, tighten it.

## Security Domain

Not applicable in the ASVS sense — this phase has no authentication, session,
or externally-facing input-validation surface. The nearest analogue is
**trust boundary between this repo's code and the regenerator2000 child
process**, already covered under Common Pitfalls (enum variant name
injection into generated ACME source) and Don't Hand-Roll (no new parsers of
untrusted external formats). `security_enforcement` is not explicitly set to
`false` in `.planning/config.json` for this project (not checked this
session, but the code/config nature of this phase — no new network surface,
no new user-facing input — makes this section low-value; the planner should
confirm the config flag but expects no dedicated security wave is needed
beyond the pitfalls already documented).

## Sources

### Primary (HIGH confidence — measured this session, live)
- `regenerator2000 --version` → `0.9.20` (this host, `~/.cargo/bin/regenerator2000`).
- Live drive of `regenerator2000 --mcp-server-stdio <synthesized .regen2000proj>`
  via a hand-written Node script (newline-delimited JSON-RPC over
  `spawn(..., {stdio:["pipe","pipe","pipe"]})`): confirmed `initialize` returns
  `protocolVersion: "2024-11-05"`, `serverInfo.name: "regenerator2000-core-mcp"`,
  `version: "0.9.20"`; confirmed `r2000_disassemble`, `r2000_search_disassembly`,
  `r2000_get_cross_references`, `r2000_create_project_enum`,
  `r2000_apply_enum_usage`, `r2000_save_project` argument/return shapes exactly
  as reproduced in Code Examples above.
- Live `regenerator2000 --headless --export_asm out.a --assembler acme
  <proj>` on the identical project: confirmed the underscore-separated
  `D011_YSCROLL3_ROW25_SCREENON_TEXT = $1b` / `lda
  #D011_YSCROLL3_ROW25_SCREENON_TEXT` / `sta $d011 ; VIC Control Register 1`
  output — the criterion-3 acceptance target, byte-for-byte.
- `regenerator2000-core-0.9.20/src/mcp/handler.rs` (full tool list at
  lines ~50-500, tool dispatch bodies at lines ~500-1270) — read directly
  from `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`, confirming
  every curated tool's exact `inputSchema` and response shape.
- `regenerator2000-core-0.9.20/src/mcp/stdio.rs` — confirmed newline-delimited
  JSON-RPC framing, synchronous one-request-one-response processing, and
  that the read loop ends on stdin EOF (`while reader.read_line(...) > 0`).
- `regenerator2000-core-0.9.20/src/state/app_state.rs:436-455` —
  `validate_new_enum_name`'s exact rule (non-empty, alphanumeric+underscore,
  no collision with existing project/global/builtin enum names) and
  confirmation that variant NAMES are unvalidated.
- `regenerator2000-core-0.9.20/src/disassembler/formatter_acme.rs:365-369` —
  `format_enum_reference()`'s literal `format!("{enum_name}_{variant_name}")`.
- `regenerator2000-0.9.20/src/main.rs:709-711,800-806` — the headless/mcp_server
  flag disjunction and the `--import_lbl` discard condition.
- `.claude/mcp/vice/package.json`, `.claude/mcp/vice/node_modules/@mastra/mcp/package.json`,
  `.claude/mcp/vice/node_modules/@modelcontextprotocol/sdk/package.json` —
  confirmed dependency declarations and installed versions.
- `.claude/mcp/vice/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js` —
  `SUPPORTED_PROTOCOL_VERSIONS` includes `2024-11-05`.
- `.claude/mcp/vice/node_modules/@mastra/mcp/dist/client/client.d.ts`,
  `configuration.d.ts` — `InternalMastraMCPClient`/`MCPClient`'s full public
  surface, including the documented stale-transport bug workaround
  (issue #19862).
- `.claude/mcp/vice/vice-proxy.ts` (lines ~3130-3250) — the
  `vice_result_continue`/`RECYCLE_TOOL`/`DIAGNOSE_TOOL` synthetic-tool
  registration pattern; confirmed current `rewriteArguments()` call sites at
  lines 1422 (inside `gatherWedgeEvidence()`, starting line 1398) and 2943
  (inside `forwardToVice()`, starting line 2878) — both drifted from
  CLAUDE.md's cited `1368`/`2889`.
- `.claude/mcp/vice/hostpath-consumers.test.ts` — confirmed the closed
  five-member host-path consumer set and its own (simpler, single-line-only)
  `stripCommentLines()`.
- `.claude/mcp/vice/r2000-launch.test.ts:39-56` — the buggy block-comment
  `stripCommentLines()` implementation (WR-02), confirmed distinct from the
  hostpath-consumers.test.ts one.
- `scripts/check-npm-packages.mjs` — confirmed the manifest/dependency
  validation shape (`DISASM-07`'s "exactly these two runtime dependencies"
  assertion) and the transitive-closure import-walk pattern.
- `.github/workflows/ci.yml` (lines 111-126) — confirmed `npm test` runs
  with `working-directory: .claude/mcp/vice` only; no skill-side `.mjs`
  tests run in CI.
- `.claude/skills/c64-program-recon/templates/memory-map.template.md` — the
  62-line template's exact structure (provenance line, confidence vocabulary
  table, graphics-chain/interrupts/routines sections).
- `.planning/ENGINEERING_RULES.md` §4 (Dependency Policy), §6 (Non-Vacuous
  Verification), §7 (Independent Oracle Rule) — read in full.

### Secondary (MEDIUM confidence)
- `.planning/phases/11.../11-CONTEXT.md` and `11-DISCUSSION-LOG.md` — treated
  as already-measured (per this document's own instruction not to re-derive
  what CONTEXT.md verified clean), except where this session's own live
  reproduction surfaced a discrepancy (the `a_D011` auto-label and the
  enum-separator rendering — both flagged explicitly above rather than
  silently reconciled).
- `.planning/ROADMAP.md` (Phase 11 section, Standing Constraints, Phase 10
  criterion 3 notes) — read in full.
- `.planning/REQUIREMENTS.md:82-104` — read in full.

### Tertiary (LOW confidence)
- None relied upon — every load-bearing claim in this document is either
  Primary (measured/sourced this session) or Secondary (CONTEXT.md's own
  prior measurement, explicitly trusted per the research brief's
  instruction).

## Metadata

**Confidence breakdown:**
- Standard stack (MCP client shape): HIGH — dependency graph and protocol
  version confirmed by direct file inspection; the recommendation's tradeoff
  is a judgment call CONTEXT.md explicitly delegates to research, stated
  with reasoning rather than asserted as settled.
- Architecture (synthetic-tool registration pattern): HIGH — this is an
  existing, working pattern in this exact codebase (`vice_result_continue`),
  not a novel proposal.
- Enum generation mechanism: HIGH — every step measured end to end against
  the real 0.9.20 binary, including a real ACME export.
- Two-session evidence protocol / D-24-D-27 reconciliation: MEDIUM — the
  mechanism (separate waves, structural context isolation) is a sound design
  but is this document's own recommendation, not something CONTEXT.md or the
  source code settles; the planner should treat it as a strong default, not
  a locked decision.
- Pitfalls: HIGH — five of five drawn from direct source reading or live
  reproduction, not speculation.

**Research date:** 2026-08-20
**Valid until:** 30 days, OR immediately upon any `regenerator2000` version
bump past 0.9.20 (several findings here — the enum separator discrepancy, the
auto-label absence, `max_results` default — are version-specific behaviors
that should be re-measured against any newer installed version before reuse).
