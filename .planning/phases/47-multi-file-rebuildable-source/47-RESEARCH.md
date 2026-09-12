# Phase 47: Multi-File Rebuildable Source - Research

**Researched:** 2026-09-12
**Domain:** ACME cross-assembler multi-file source generation, over this
project's own `.annostore` annotation store and its existing single-file
`anno-export-asm.ts` exporter
**Confidence:** HIGH for everything tagged `[VERIFIED: ...]` below (all of it
either read from the actual source this session or measured live against the
installed ACME 0.97 "Zem"); MEDIUM/LOW where flagged

## Summary

`anno-export-asm.ts` (1661 lines) already does the hard half of this phase:
decoding, symbol substitution, comment placement, provenance annotation and
exclusion marking, all proven byte-identical against a real ACME through
`acme-verify.ts`'s oracle. **It does not know the word "scope" exists.**
`listScopes()`/`anno_scope` is read by nothing in the export path today, and
the whole exporter emits exactly one `!cpu 6510` + one header block + one
flat sequence of `* = ...` / `!if` bracketed blocks — one string, returned to
one caller. BUILD-01/02/03 are new wiring on top of a decoder that does not
need to change: partition the existing per-range blocks by which
`anno_scope` row contains their address (if any), write one `.a` file per
scope plus a root file that `!source`s them in a deterministic order, and
special-case `external_file`-typed ranges to write a sibling `.bin` and emit
`!binary` instead of `!byte`.

The one blocking infrastructure gap is exactly what the phase notes name:
`host-tool.mts`'s `acme.build` spawn passes no `cwd` to `child_process.spawn`,
and this session measured, live, against the installed ACME 0.97, that both
`!source "x.a"` and `!binary "x.bin"` resolve a bare filename against the
**process's own working directory**, not against the directory of the file
that contains the directive. Today's exporter never emits either directive,
so this is inert; the moment BUILD-01 emits `!source`, it is not. The fix is
small (thread a `cwd` string through `buildHostToolArgv()`'s return and
`spawnHostTool()`'s call) and — confirmed by reading `spawn-seam.test.ts`'s
actual regex, not assumed — it does not touch that guard's scanned identifier
set (`VICE_BIN`/`x64sc`/`binPath`/`viceBin`) at all, because that guard is
about the **emulator** binary, and ACME's own local variable is deliberately
named `acmePath` to keep it out of that shape.

**Primary recommendation:** Keep `anno-export-asm.ts`'s existing block-emission
logic completely unchanged; add a thin partitioning layer above it (group
blocks by `listScopes()`, emit one file per group plus a root `!source` file,
special-case `external_file` blocks into `!binary` + sibling `.bin`), fix
`host-tool.mts` to accept and pass a `cwd`, and prove reassembly by calling
`runHostTool()` in-process from the test file exactly as `host-tool.test.ts`
already does for `acme.build` — never by extending `acme-verify.ts`, which is
explicitly test-only, single-string, and has no multi-file concept.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scope-to-file partitioning, `!binary` emission for `external_file` | `anno-export-asm.ts` (container-side library) | — | Store-derivation logic belongs in the `anno_*` family per the phase's own Notes; a second export route in a skill script would duplicate it |
| Writing the file tree to disk | New CLI/library boundary (extends `anno-cli.ts`'s `export-asm` verb or a sibling) | — | `exportAsm()` today returns a string in memory; something must decide the output directory and write N files. Currently nothing does |
| `cwd`-aware ACME spawn | `host-tool.mts` (host-side broker) | — | `runHostTool()` is the ONLY route to any host binary (project law); the fix belongs where the spawn already lives |
| Byte-diff / reassembly oracle | Test-only, in-process `runHostTool()` call (new pattern for this file) or a widened `acme-verify.ts` | — | `acme-verify.ts` is single-file/single-string only; extending it to multi-file duplicates `runHostTool()`'s own path resolution. Calling `runHostTool()` directly (as `host-tool.test.ts` already does) is the existing precedent |
| Symbol/label uniqueness, ACME identifier legality | `anno-acme-ident.ts` / `anno-store.ts` (unchanged) | — | Already enforced; no new work needed for cross-file resolution because ACME's own label-visibility rules make it a non-issue (see Pitfall/Finding below) |

## User Constraints

No `CONTEXT.md` exists for this phase (confirmed: `ls .planning/phases/47-multi-file-rebuildable-source/` shows no `*-CONTEXT.md`). Planning proceeds from `ROADMAP.md` + `REQUIREMENTS.md` + this research only.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-01 | Export emits one ACME source file per annotation-store scope, wired by `acme-build`'s `!source` and assembling to a single output | See "The scope model" and "The `cwd` fix" sections below — the partitioning is entirely new; the `cwd` fix is the one blocking infra change |
| BUILD-02 | Data tables are extracted to their own files, so graphics, levels and music can be swapped without touching code | See "`external_file` — zero consumers today" — `emitDataLines()` needs a new branch; `!binary` syntax and its cwd-relative resolution are measured live |
| BUILD-03 | Every branch, `JSR`/`JMP` and data reference goes through a symbol, so code can move | Already true inside one file (D-11/renderer); the NEW risk is purely cross-file/cross-scope symbol visibility, which is measured safe below (unprefixed identifiers stay global under `!zone`, and — more simply — under plain `!source` with no `!zone` at all) |
</phase_requirements>

## Standard Stack

**No new npm runtime dependency and no new host prerequisite is in scope** —
this is an explicit, dated `REQUIREMENTS.md` "Out of Scope" row
("New npm runtime dependencies and new host prerequisites", added 2026-09-10):
"every capability is reachable by extending code this project already owns."
This phase is pure extension of `anno-export-asm.ts`, `host-tool.mts`, and the
`anno-cli.ts` CLI surface, plus new tests. ACME itself is an existing host
prerequisite, already probed by `acme-gate.ts` / `findAcmeLib()`, not a new
one.

### Core
| Component | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ACME cross-assembler | 0.97 "Zem" (31 Jan 2021) `[VERIFIED: acme --version, run live this session]` | Assembles the emitted multi-file tree back to bytes | Already this project's one assembler (CLAUDE.md, `docs/stock-hard-losses.md` sibling decisions); no alternative considered or in scope |
| `anno-export-asm.ts` | in-repo, 1662 lines as of this session | Owns block/decoder/symbol emission | Extend, never duplicate — see "Don't Hand-Roll" |
| `host-tool.mts` / `runHostTool()` | in-repo | The one route to any host binary | Project law; unaffected by this phase except the `cwd` addition |

### Package Legitimacy Audit

**Not applicable.** No external package is installed, upgraded, or newly
imported by this phase. The Package Legitimacy Gate protocol is skipped
because its trigger condition (installing external packages) does not occur.

## Architecture Patterns

### System Architecture Diagram

```text
 anno.sqlite (.annostore)                 game.prg / flat 64K image
        │                                          │
        ▼                                          ▼
 listRanges() / listLabels() / listComments() / listProjectEnums()
 listEnumUsage() / listExcludedRanges()  ──────────┐   (ALL EXISTING, unchanged)
        │                                          │
        ▼                                          │
 [NEW] listScopes()  ──► partition ranges/labels/comments by containing scope
        │                                          │
        ▼                                          ▼
 per-scope block emission (decode(), renderLine(), emitDataLines() — EXISTING,
 unchanged code path) PLUS a new branch: dataType === "external_file" writes
 the block's bytes to a sibling .bin and emits "!binary "name.bin"" instead of
 "!byte" lines
        │
        ▼
 [NEW] N per-scope .a files + 1 root .a file, "!source \"bare-name.a\"" lines
 in scope-start order, written to one output directory
        │
        ▼
 runHostTool({ tool: "acme.build", args: { source: root.a, cwd: outDir } })
   — host-tool.mts spawns real ACME with cwd = outDir (THE FIX)
        │
        ▼
 assembled .prg  ──byte-diff──►  expectedBytes (built from the IMAGE, exactly
                                  as exportAsm() already does — unchanged)
```

### Recommended Project Structure (export output, not source tree)

```
<outDir>/
├── root.a                 # !source lines only, deterministic scope-start order
├── scope_0810.a            # one file per anno_scope row (name derived from start —
├── scope_1000.a             # FUT-08 confirms no name column exists, so derive)
├── scope_1000_charset.bin  # external_file-typed range's raw bytes, sibling to its .a
└── ...
```

### Pattern 1: `!source`/`!binary` resolve against the assembler's CWD, not the including file's directory

**What:** ACME resolves a quoted, bare (non-absolute) filename in `!source`
and `!binary` relative to the **process working directory at spawn time**,
never relative to the directory of the file that contains the directive.

**MEASURED live this session, ACME 0.97 "Zem":**

```
$ cd /tmp/acmetest && acme -o out.prg root.a        # root.a has: !source "code.a"
# code.a is in the SAME directory as root.a          -> exit 0

$ cd /tmp && acme -o /tmp/acmetest/out2.prg /tmp/acmetest/root.a
# absolute path to root.a, but cwd is /tmp, not the file's own directory
Error - File .../root.a, line 3: Cannot open input file "code.a".   # exit 1
```

The identical result was reproduced for `!binary "data.bin"`. This is why
`host-tool.mts`'s `acme.build` spawn (which sets no `cwd` today — confirmed by
reading `spawnHostTool()`'s call at `host-tool.mts:2139`, which only passes
`{ stdio, env }`) is a real blocker the moment the exporter emits `!source` or
`!binary`, and why the fix is `cwd: outDirPath` on the spawn, not a path
rewrite inside the generated source (which would hardcode a host path into a
portable artifact — the phase notes' own stated constraint).

**When to use:** Every multi-file export must set `cwd` to the directory the
`.a`/`.bin` tree is written into, and every `!source`/`!binary` argument in
generated text must be a **bare filename** (no directory component), matching
criterion 1's own wording.

**Discovered alternative (not the prescribed fix, noted for completeness):**
ACME's `-I <dir>` (include-path) flag was also measured, live, to make the
SAME `root2.a` resolve `!binary "data.bin"` successfully even when invoked
from an unrelated `cwd`. `cwd` is still the fix this phase names explicitly
("This is the phase that fixes it" — the `host-tool.mts` Notes bullet), and it
is the simpler one-line change to `spawnHostTool()`; `-I` is recorded here
only so a planner is not surprised to find it works too.

### Pattern 2: Splitting into files needs no `!zone` at all — the store's global-unique label names make ACME's default flat namespace sufficient

**What:** ACME's default behaviour (no `!zone` anywhere) is one flat symbol
namespace across every `!source`d file, and forward references across file
boundaries resolve correctly (ACME is multi-pass).

**MEASURED live, ACME 0.97:** a root file `!source`s `fwd_a.a` (which
contains `routineA: jmp routineB`) then `fwd_b.a` (which contains
`routineB: rts`) — assembles at exit 0, `jmp routineB` resolves to the
address `routineB` gets in the LATER file. Since `anno_label.name` is
`unique` in the schema (`anno-store.ts:296`) and `assertLegalAcmeIdentifier()`
only accepts `^[A-Za-z_][A-Za-z0-9_]*$` (`anno-acme-ident.ts:41` — no leading
`.`/`@`), every name the exporter emits is *already* a plain global ACME
symbol. There is therefore **no motivation to wrap each scope's file in an
explicit `!zone`** — doing so would only be useful if the store allowed
name reuse across scopes, and it does not.

**Cross-check performed (why this matters for criterion 3's "cross-zone
reference... still resolves" wording):** this session also measured, live,
what happens if a planner *does* choose to wrap each scope file in `!zone
<name> { ... }` anyway (e.g. for cosmetic grouping): an unprefixed label
defined inside one `!zone` remains globally visible and resolves correctly
from a `jmp`/`sta` inside a different `!zone` (confirmed with a
`scope_a`/`scope_b` pair, `jmp routineB` from inside `scope_a`'s zone to
`routineB` defined inside `scope_b`'s zone — exit 0, correct target address).
Only **dot-prefixed** (`.loop`) names are auto-scoped to the enclosing zone and
would collide across files if reused with no `!zone` — this project's emitter
never produces a dot-prefixed name, so this hazard is closed by construction,
not by anything a planner needs to add. **Recommendation: do not use `!zone`
at all** — plain, unwrapped per-scope files are simpler, already correct, and
avoid introducing a mechanism with its own (unused) local-label rules.

### Pattern 3: Zero-page symbol two-byte encoding depends on file *sourcing order*, not just intra-file position

**What:** `formatSymbolDefinition()`'s existing "two hex digits below `$0100`"
rule only produces the narrow (zeropage) 2-byte encoding if the symbol's
definition is textually reached by ACME **before** its first use, across the
whole `!source` chain — not merely within one file.

**MEASURED live, multi-file, ACME 0.97 (root sources the zero-page file
FIRST):**

```
root: !source "zp_defs.a"   (contains: zpf = $10)
      * = $0801
      !source "zp_user.a"   (contains: lda zpf / rts)
```
→ `0801 a510` (2 bytes, zeropage), exit 0, no warning.

**Root sources the SAME two files in the OPPOSITE order** (user file before
defs file):
→ `0801 ad1000` (3 bytes, absolute), exit 0, with
`Warning (Zone <untitled>): Using oversized addressing mode.` on stderr.

This is exactly criterion 5's "caught" requirement: the failure is silent in
the sense that ACME still exits 0, but the `.rep` listing (`-r` flag, already
passed by `buildHostToolArgv()`'s `acme.build` branch at
`host-tool.mts:1318`) shows the byte count directly, and this project's
existing end-of-block `!if * != ...` assertion (`emitBlock()`,
`anno-export-asm.ts:456-463`) will **already** catch the resulting drift as an
`!error` + exit 1, because every byte after the widened instruction shifts.
So no NEW correctness guard is needed for this — the existing per-block
assertions are sufficient — but the ROOT FILE'S OWN `!source` ordering must
put the zero-page-symbol-defining file(s) first, which is a real design
constraint on the root-file-generation code (not a hazard needing a new
runtime check).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding operand width / symbol substitution | A second `renderLine()`/`decode()` for multi-file output | The existing `disasm-renderer.ts`/`disasm-decoder.ts` pair, called exactly as `exportAsm()` already calls them | D-09/D-11 invariants are proven against real ACME across all 256 opcodes; this phase changes WHERE blocks land (which file), never HOW a block's bytes become text |
| Reassembly verification | A second single-string spawn helper in a new file | `runHostTool()`, called in-process from the test file exactly as `host-tool.test.ts:452` already does for `acme.build` | `acme-verify.ts` is explicitly test-only, single-file, and does not go through `runHostTool()` — extending it to be multi-file would either duplicate `host-tool.mts`'s own path-resolution logic or leave the byte-diff oracle NOT reached through `runHostTool()`, which criterion 1 explicitly requires ("reached through `runHostTool()`, with `cwd` set to the output directory") |
| ACME zone/scoping logic | A custom cross-file symbol-resolution pass | Nothing — ACME's own default global namespace already does this correctly (Pattern 2 above) | Building a resolution pass to prevent a collision that cannot occur (names are store-unique and un-prefixed) would be unverifiable complexity solving a non-problem |
| `external_file` byte extraction | A second byte-range-to-file writer | Extend `emitDataLines()` and the block loop in `anno-export-asm.ts` with one new branch, following the exact pattern `WORD_PAIR_DATA_TYPES` already uses for a type-conditioned emission choice | One emitter, one place that decides byte layout, per the file's own "Never write a second `!byte` emitter" rule |

**Key insight:** almost nothing about the *bytes* changes in this phase. Every
byte-correctness guarantee (`decode()`, `renderLine()`, the block `!if`
assertions, `expectedBytes` built from the image) is already proven. This
phase's actual new surface area is: (1) partitioning existing blocks into
files by scope, (2) one new `external_file` emission branch, (3) one `cwd`
parameter threaded through an existing spawn, and (4) a determinism/drift test
over the new multi-file writer. Scope creep here looks like "re-verify the
decoder" or "build a symbol resolver" — both already exist and are already
correct.

## Common Pitfalls

### Pitfall 1: Writing a host path into generated `!source`/`!binary` text
**What goes wrong:** A tempting shortcut is `!source "/abs/path/to/scope_x.a"` to sidestep the cwd problem entirely.
**Why it happens:** It "just works" locally and avoids touching `host-tool.mts`.
**How to avoid:** The phase notes explicitly forbid this ("must not be worked around by writing host paths into generated source, which would hardcode a machine-specific path into a store-derived artifact that is supposed to be portable"). Fix `cwd` in `host-tool.mts` instead; emit only bare filenames.
**Warning signs:** Any generated `.a` file containing a `/` or a drive letter inside a `!source`/`!binary` string literal.

### Pitfall 2: Assuming `external_file` already does something
**What goes wrong:** Treating `external_file`'s presence in `DATA_TYPES` (`anno-types.ts:374`) as evidence the export path already handles it.
**Why it happens:** It IS a real, schema-level, twelve-member vocabulary entry, described in the `anno_set_data_type` tool's own input schema (`anno-tools.ts:579-588`) as "large binary blob to export as-is".
**How to avoid:** Confirmed this session by `grep -a` across the shipped tree: the only non-test occurrences are the `DATA_TYPES` array itself and the tool-schema description string. `emitDataLines()` (`anno-export-asm.ts:342`) has exactly two branches — the `WORD_PAIR_DATA_TYPES` check and the fallback `!byte` loop — and `external_file` falls through to the fallback today, emitting inline `!byte` bytes exactly like `"byte"` would. BUILD-02 is 100% new logic.
**Warning signs:** A plan that describes BUILD-02 as "wiring an existing type" rather than "adding a new emission branch."

### Pitfall 3: Extending `acme-verify.ts` for the multi-file oracle
**What goes wrong:** `acme-verify.ts` looks like the natural place to add multi-file support, since it already owns "the ONE place this package spawns a real ACME" for tests.
**Why it happens:** Its header literally claims that role.
**How to avoid:** Its own header is explicit: "This module is TEST-ONLY. It must never appear in `package.json`'s `files[]`... and it must never be imported by a shipped module." It also, by design, writes ONE source string to ONE temp file and assembles ONE file (`assembleRaw()`, `verifyAcmeAssembles()`) — it never calls `runHostTool()` and has no `cwd`/multi-file concept. Criterion 1 requires the byte-diff oracle be "reached through `runHostTool()`" — so the new test-side verification must call `runHostTool()` in-process (as `host-tool.test.ts` already does for `acme.build`), not extend `acme-verify.ts`.
**Warning signs:** A plan task that edits `acme-verify.ts` to accept a file-tree instead of a string.

### Pitfall 4: Believing `tracer.prg` carries a dispatch table
**What goes wrong:** Planning a BUILD-03 cross-file dispatch-table demonstration against `fixtures/dxa/tracer.prg` because the phase description names it for that purpose.
**Why it happens:** The phase description's own Notes section says "tracer.prg for a dispatch table."
**How to avoid — DISCREPANCY, flagged honestly, not silently corrected:** `fixtures/dxa/tracer.prg` (23 bytes) is, per its own committed `README.md`, a minimal decoder fixture — `10 SYS 2064` BASIC stub, three pad bytes, then exactly `LDA #$00` / `STA $D020` / `RTS`. It contains **no jump table, no indirect JMP, and no dispatch mechanism of any kind** `[VERIFIED: src/mcp/vice/fixtures/dxa/README.md:1-40, src/mcp/vice/fixtures/dxa/tracer.prg byte layout table quoted above]`. A real dispatch-table fixture (a genuine `jmp ($00fb)` indirect jump) exists in this repo at `src/mcp/vice/fixtures/coverage/fp2-zeropage-data-pointer/` and its `SPLIT_TABLE` sibling, generated by `make-coverage-fixtures.mjs` — but this is a *different*, smaller fixture family built for `anno-coverage-grammar.test.ts`'s dispatch-detection gate, with no annotation store necessarily prepared for export. **Recommendation for the planner:** either (a) treat "cross-file symbol reference for a JSR/JMP" as sufficiently demonstrated by any code range split across scopes (which needs no dispatch table at all — a plain cross-scope `jmp`/`jsr` is enough, and is exactly what Pattern 2 above already measured working), or (b) build a small new ad hoc store over a hand-picked dispatch-table body using the test file's own `buildStore()` idiom (`anno-export-asm.test.ts:214`, which every other exporter test already uses for synthetic bodies) rather than relying on a committed fixture that does not carry one.
**Warning signs:** A verify command that asserts `fixtures/dxa/tracer.prg` "has a dispatch table" — it does not, and the assertion would be checking a fact about the wrong file.

### Pitfall 5: Believing `charset-phantom.prg`'s `$1000-$17ff` range is a ready-to-swap data table
**What goes wrong:** Reaching for `fixtures/ghidra/charset-phantom.prg` for criterion 2's "real graphics or charset table" demonstration because its address range (`$1000-$17ff`, 2048 bytes) and name match a real C64 character-set size exactly.
**Why it happens:** It IS the closest address/size match among the three named fixture families (`bank.prg`/`bank-path-dependent.prg`, `charset-phantom.prg`, `smc.prg`, `tracer.prg`).
**How to avoid — MEASURED, not assumed:** `[VERIFIED: src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json — read this session via python3 json.load; the `ranges` array's `{start: 4096, endInclusive: 6143, dataType: "code", ...}` entry, quoted verbatim]`. The committed store types that exact range as `"code"`, not `"byte"`/`"external_file"` — because the fixture's entire purpose (per its own header comment in `charset-phantom.a`) is to demonstrate Ghidra mis-labeling a real character-set region as phantom functions before a data-range-seed correction. Reusing it as-is for criterion 2 would export it through the CODE path (a `jsr`/`rts` chain), not the data path, and a `!binary` swap demo needs a `byte`-or-`external_file`-typed range with content someone actually reads.
**Recommendation:** build a small ad hoc store (same `buildStore()` idiom named in Pitfall 4) typing a synthetic byte range as `external_file`, OR construct a fresh store over `charset-phantom.prg`'s own `$1000-$17ff` bytes that types that range as `external_file` for THIS test's own purposes only (never mutate the committed `charset-phantom.annostore.json`, which Phase 37/45's own tests depend on staying `"code"`). Either way, state plainly in the plan which route was chosen — this is the honest answer research emphasis #5 asked for: **no existing committed fixture currently carries a store-typed real data/graphics table ready for a `!binary` swap demonstration.**

### Pitfall 6: Assuming the `cwd` fix touches the emulator spawn-seam guard
**What goes wrong:** Treating `spawn-seam.test.ts`'s frozen spawn-site set as something this phase's `host-tool.mts` change must update.
**Why it happens:** `host-tool.mts` is a shipped module and does spawn a child process.
**How to avoid — MEASURED, not assumed:** `[VERIFIED: src/mcp/vice/spawn-seam.test.ts:179]` — `const EMULATOR_BIN_SHAPE = /\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b/;`. This regex only matches identifiers naming the **VICE emulator** binary. `host-tool.mts`'s ACME-spawning local variable is deliberately named `acmePath` (its own comment at `host-tool.mts:1293-1296`: "never `binPath`/`viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site"). Adding a `cwd` parameter to `spawnHostTool()`'s signature and its one call site (`host-tool.mts:2649`) touches neither this regex nor CLAUDE.md's separately-stated (and currently EMPTY) "modules that spawn the emulator binary" set.
**Warning signs:** A plan task that edits `spawn-seam.test.ts`'s expected-site list for this phase — it should not need to change at all.

## Code Examples

### `!source` and `!binary` both resolve bare filenames against the process CWD
```
; MEASURED, ACME 0.97 "Zem", this session:
; cwd=/tmp/acmetest, root.a and code.a both in /tmp/acmetest -> exit 0
!source "code.a"
; ---
; cwd=/tmp, root.a passed by absolute path, code.a still bare -> exit 1
;   "Error - File .../root.a, line 3: Cannot open input file "code.a"."
```

### `!binary` syntax (verified, no separate offset/length args needed for a whole-file swap)
```
!cpu 6510
* = $0801
lda #$00
rts
mydata
!binary "data.bin"
```
Assembling this with `data.bin` = 4 bytes (`01 02 03 04`) produced
`a9 00 60 01 02 03 04` — the binary's bytes inlined verbatim at `mydata`'s
address, exactly like `!byte` would, but sourced from a sibling file.
Replacing `data.bin`'s 4 bytes with 4 DIFFERENT bytes (same length) and
reassembling changes only those bytes in the output — no code line touched.
This is the exact mechanism criterion 2 asks to be demonstrated.

### Zero-page ordering, multi-file, both directions (the criterion 5 proof shape)
```
; root sources the zero-page-defining file FIRST:
!source "zp_defs.a"     ; contains: zpf = $10
* = $0801
!source "zp_user.a"     ; contains: lda zpf / rts
; -> .rep shows "0801 a510" (2 bytes)

; root sources them in the OPPOSITE order:
* = $0801
!source "zp_user.a"
!source "zp_defs.a"
; -> .rep shows "0801 ad1000" (3 bytes) + stderr:
;    "Warning (Zone <untitled>): Using oversized addressing mode."
```
Both measured live this session, ACME 0.97, via `acme -r <file>.rep -o ...`.

### Existing test harness pattern to reuse for the new byte-diff oracle (in-process `runHostTool()`)
```typescript
// Source: src/mcp/vice/host-tool.test.ts:452 (existing, already-passing pattern)
const response = await runHostTool(
  { tool: "acme.build", args: { source: "a.a" /* , cwd once added */ } },
  { repoRoot: dir },
);
```
This is the call shape the new multi-file export test should use — never
`acme-verify.ts`'s `spawnSync` helper, and never a raw `spawnSync` in the new
test file itself.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase; it is new
export capability added over existing, unchanged store schema and decoder
code. No runtime state (stored data, live service config, OS-registered
state, secrets, build artifacts) is renamed or relocated by this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The per-scope filename should derive deterministically from `scope.start` (e.g. `scope_0810.a`), since `anno_scope` has no `name` column (`FUT-08`, deferred) | Recommended Project Structure | If the planner instead derives names from something else (an address range string, an ordinal index), criterion 4's determinism requirement is still satisfiable, but the exact filenames this research assumes would differ — low impact, purely cosmetic |
| A2 | Ranges NOT covered by any `anno_scope` row should be grouped into a distinguished "unscoped" file (or the root file itself), since the store allows ranges and scopes to be entirely independent (no FK, no containment enforcement observed in `anno-store.ts`'s schema) | Architecture Patterns / System Diagram | If the planner instead REFUSES an export when a range falls outside every scope, that is a stricter, equally defensible design choice BUILD-01's wording does not rule out — recorded as an assumption because the store schema does not force either answer |
| A3 | No `!zone` wrapping is used for per-scope files (Pattern 2's recommendation) | Pattern 2 | If the planner instead wraps each file in `!zone`, this research's own live measurement shows it is SAFE (unprefixed labels still cross-resolve), so being wrong here costs nothing but an unnecessary line of generated text — not a correctness risk |

**All other claims in this research are `[VERIFIED]`** (read from source this
session, or measured live against the installed ACME 0.97) or `[CITED]`
(REQUIREMENTS.md/STATE.md text quoted directly). Pitfalls 4 and 5 are
DISCREPANCIES between the phase description's own Notes and what this session
found on disk, flagged explicitly rather than silently corrected or silently
followed.

## Open Questions

1. **Does a range spanning MULTIPLE scopes, or overlapping a scope boundary, need a refusal?**
   - What we know: `anno_scope` rows are non-nested and non-overlapping by construction (`addScope()`'s own overlap refusal, `anno-store.ts:3013-3078`), but a `anno_range` row is a SEPARATE table with no foreign key to `anno_scope` — nothing stops a range from straddling a scope boundary.
   - What's unclear: whether BUILD-01 should refuse an export where a range crosses a scope boundary (ambiguous "which file does this block belong in"), or split the range's own block across two files.
   - Recommendation: refuse by name (this project's own consistent "refuse rather than guess" posture, e.g. `assertDataTypeForExport()`, the mid-instruction label floor). Splitting a block across two files would also break the existing single-block `!if * != ...` bracketing invariant, which assumes one block lives in one contiguous emission.

2. **Should the CLI `export-asm` verb's `--out FILE` become `--out DIR`, or gain a new flag?**
   - What we know: today `--out` names a single file (`anno-cli.ts:1317-1339` region); nothing in the CLI surface writes a directory tree.
   - What's unclear: whether BUILD-01 changes `--out`'s own contract (breaking existing single-file callers/tests) or adds a distinct flag/verb for the multi-file tree.
   - Recommendation: a plan should decide this explicitly rather than let it fall out of implementation — `anno-cli-invocations.test.ts`/`anno-cli.test.ts`'s existing single-file assertions are a real regression surface either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ACME cross-assembler | Every reassembly/byte-diff test in this phase | ✓ | 0.97 "Zem", 31 Jan 2021 `[VERIFIED: acme --version]` | — (already gated by `acme-gate.ts`'s existing SKIP_REASON machinery; CI enforces via `VICE_REQUIRE_ACME`) |
| Node.js (native TS type-stripping) | Running/editing `.ts`/`.mts` sources | ✓ | v24.20.0 `[VERIFIED: node --version]` | — |

**Missing dependencies with no fallback:** none — everything this phase needs is already installed and already gated.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`) |
| Config file | none — `package.json`'s `"test"`/`"test:automated"` scripts drive it |
| Quick run command | `cd src/mcp/vice && node --test anno-export-asm.test.ts` (targeted; avoids the full-glob hang — see below) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` |

**Do not run the bare full glob.** `[CITED: this repo's own CLAUDE.md-adjacent
project memory]` `npm test` (`node --test '*.test.*'`) is known to hang
indefinitely on `vice-proxy.test.ts` in this environment; `test:automated`
(via `test-gate.mjs`) is the command this project's own `.planning/config.json`
names as `workflow.test_command`, and is the one to use for phase gating.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | Multi-file export assembles to one `.prg` matching `expectedBytes`, via `runHostTool()` with `cwd` set | integration (real ACME spawn) | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ Wave 0 — new test cases needed in this existing file, plus `host-tool.test.ts` coverage for the new `cwd` param |
| BUILD-02 | `external_file` range emits `!binary` + sibling `.bin`; swapping bytes changes only data | integration (real ACME spawn) | same file | ❌ Wave 0 |
| BUILD-03 | Every JSR/JMP/data ref resolves through a symbol across file boundaries; unresolved ref refuses by name | unit + integration | same file | ❌ Wave 0 |
| BUILD-01 (determinism) | Two exports of an unchanged store are byte-identical, file-for-file | unit, modeled on `resources-sync.test.ts`'s two-scratch-build walk-and-diff pattern | new test file or a new test in `anno-export-asm.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd src/mcp/vice && node --test anno-export-asm.test.ts` (and `host-tool.test.ts` if that file was touched)
- **Per wave merge:** `cd src/mcp/vice && npm run test:automated`
- **Phase gate:** Full `test:automated` green, plus `cd src/mcp/vice && npm run typecheck` (this project's `workflow.build_command`)

### Wave 0 Gaps
- [ ] New test cases in `anno-export-asm.test.ts` (or a new sibling test file) for scope partitioning, `external_file`/`!binary` emission, cross-file symbol resolution, and the determinism drift guard
- [ ] New test cases in `host-tool.test.ts` for the `cwd` parameter's plumbing through `buildHostToolArgv()`/`spawnHostTool()` for `acme.build`
- [ ] No new test framework or fixture-generation tool needed — `buildStore()`/`buildStoreOverImage()` (`anno-export-asm.test.ts:214`/`243`) already exist and are the right idiom to extend

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | not applicable — local CLI/library, no auth surface |
| V3 Session Management | no | not applicable |
| V4 Access Control | no | not applicable |
| V5 Input Validation | yes | Already covered by existing validators this phase must keep calling: `assertLegalAcmeIdentifier()` (label/symbol names), `assertExportableCommentText()` (comment text), `assertDataTypeForExport()` (data-type strings). Any NEW string this phase emits into generated source (a scope-derived filename) must go through the same "reject, never sanitise" discipline rather than a new ad hoc check |
| V6 Cryptography | no | not applicable |
| V12 File and Resources (path handling) | yes | `resolveWorkspacePath()` — the existing confinement site `acme.build`'s `source`/`outDir`/`includes` already use. The NEW output-directory argument this phase introduces (wherever the multi-file tree is written) must be resolved through the SAME site, never a second one |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a scope-derived filename escaping the output directory | Tampering | Filenames are DERIVED (from `scope.start`, an integer under this project's own control), never taken from free-text store input, so this class of injection has no attacker-controlled string to exploit — but any future change deriving a filename from a LABEL name or comment text must route through the same identifier/comment validators named above |
| Content-disclosure via an error message quoting file bytes | Information Disclosure | Already this file's own stated discipline (`anno-export-asm.ts`'s header: "Never interpolate a read file's own bytes into an error message"); any new refusal message this phase adds (unresolved cross-file symbol, scope-boundary-crossing range) must follow the same rule — paths/addresses/counts only |
| Command injection via a spawned ACME argv | Tampering | Already mitigated — `spawnHostTool()` uses the argv-array form, never a shell string (`host-tool.mts:2139`); the new `cwd` parameter is a plain string option object key, not concatenated into any command text |

## Sources

### Primary (HIGH confidence)
- `src/mcp/vice/anno-export-asm.ts` (read in full, 1662 lines, this session) — the exporter's current behavior, its documented invariants, and its `dataType`/block-emission logic
- `src/mcp/vice/anno-store.ts` (relevant sections read this session) — `anno_scope`/`anno_range`/`anno_excluded_range` schema, `listScopes()`/`addScope()`/`removeScope()`
- `src/mcp/vice/anno-types.ts` (relevant sections read this session) — `DATA_TYPES`, `SplitDataType`, `ScopeRow`
- `src/mcp/vice/host-tool.mts` (relevant sections read this session) — `buildHostToolArgv()`'s `acme.build` branch, `spawnHostTool()`, `runHostTool()`'s `acme.build` dispatch
- `src/mcp/vice/spawn-seam.test.ts` (relevant section read this session) — `EMULATOR_BIN_SHAPE` regex, confirming the `cwd` fix does not touch this guard
- `src/mcp/vice/acme-verify.ts` (header + relevant lines read this session) — confirms TEST-ONLY status, single-file/single-string design, no `cwd`
- `src/mcp/vice/anno-export-asm.test.ts` (relevant sections read this session) — `buildStore()`/`buildStoreOverImage()`/`verifyExport()` test idioms to extend
- `src/mcp/vice/host-tool.test.ts` (relevant lines read this session) — existing in-process `runHostTool({ tool: "acme.build", ... })` call pattern
- `src/mcp/vice/resources-sync.test.ts` (relevant section read this session) — the drift-guard (walk + sort + byte-diff both directions) pattern to model criterion 4's guard on
- `src/mcp/vice/fixtures/ghidra/README.md` + `charset-phantom.a` + `charset-phantom.annostore.json` (read/parsed this session) — confirms the charset-phantom range is typed `code`, not a swappable data table
- `src/mcp/vice/fixtures/dxa/README.md` + `tracer.prg`'s own byte layout (read this session) — confirms `tracer.prg` carries no dispatch table
- ACME 0.97 "Zem", installed locally at `~/.local/bin/acme` — every `!source`/`!binary`/zero-page/`!zone` claim in this document marked `[VERIFIED: measured live this session]` was run against this exact binary, in the session's scratchpad directory
- `.planning/REQUIREMENTS.md` (read in full this session) — `BUILD-01`/`BUILD-02`/`BUILD-03` verbatim, the "New npm runtime dependencies..." Out-of-Scope row
- `.planning/STATE.md` (Current Position + relevant Decisions sections read this session)

### Secondary (MEDIUM confidence)
- none used — every claim above was either read from source this session or measured live

### Tertiary (LOW confidence)
- none used

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every existing component version-confirmed live
- Architecture: HIGH — read from actual source this session, cross-checked against live ACME behavior
- Pitfalls: HIGH for the ACME-semantics pitfalls (measured live); HIGH for the fixture-discrepancy pitfalls (read the fixture's own committed evidence directly)

**Research date:** 2026-09-12
**Valid until:** 30 days (stable in-repo code + a fixed-release external tool, ACME 0.97, not expected to change)
