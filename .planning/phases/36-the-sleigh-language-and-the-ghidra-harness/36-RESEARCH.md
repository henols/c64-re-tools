# Phase 36: The SLEIGH Language and the Ghidra Harness - Research

**Researched:** 2026-09-04
**Domain:** Ghidra SLEIGH language extensions; Ghidra headless (`analyzeHeadless`) harness
scripting (`DecompInterface`, memory volatility, reference export); this project's
host-tool execution seam (Phase 34) and its dxa consumer (Phase 35) as the worked analog.
**Confidence:** HIGH for facts carried from this milestone's own MEASURED research corpus
(`.planning/research/{STACK,PITFALLS,ARCHITECTURE,SUMMARY}.md`) and for facts this session
verified directly against real Ghidra 12.1.3 class files and this repo's source; MEDIUM for
the two open architectural questions named below (extension-install ownership, seam
argv-surface gap sizing).

**Mode: CONSOLIDATION, not discovery.** Per the ROADMAP's own directive, this document does
not re-derive the SLEIGH compile failure, its root cause, the verified fix, the `.ldefs`
shape, the drop-in-extension route, or Phase 23's harness. Those are cited with file:line
below. What this document adds is the file-by-file shape of the work: **the current
`ghidra.analyze` host-tool seam (Phase 34) does not yet support `-processor`, `-loader`,
`-loader-baseAddr`, `-scriptPath`, `-noanalysis`, or per-script arguments** — a gap this
session verified directly by reading `host-tool.mts` and `ghidra-project.mts` in full, and
which the Standing Constraints, ROADMAP criterion 1 (the language assertion) and criterion 3
(the three gates) cannot be satisfied without closing.

## Summary

Phase 36 has two halves that must land in a fixed order: a SLEIGH language extension
(`OPC-01`/`OPC-02`/`OPC-04`, then `OPC-03`), and a Ghidra headless harness that uses it
(`GHID-01`..`GHID-05`). The SLEIGH half is **measured and mechanical**: the committed source
(`docs/undocumented-opcodes-ghidra.md`) fails to compile at exactly 8 constructors, all one
root-cause class (an unsized token-field/pcodeop-return value), the fix is verified
(explicitly sized locals), and the drop-in extension-module route (no Gradle, no Ghidra
rebuild) is proven end to end against real Ghidra 12.1.3. The Ghidra-harness half is **partly
built and partly missing**: Phase 34 already shipped a working `ghidra.analyze` host-tool
(runId/importPath/preScript/postScript, workspace-confined paths, a 10-minute budget sized
from measured JVM-startup numbers) — but its argv builder (`buildAnalyzeHeadlessArgv()`,
`ghidra-project.mts:263-335`) emits only `[projectLocation, projectName, -import, importPath,
-deleteProject, -preScript?, -postScript?]`. It has **no `-processor` field at all**, which
makes `OPC-04`'s criterion-1 language assertion — "the `-processor` change made in the same
commit as the `.ldefs` id" — impossible to satisfy without extending the seam first. It also
has no `-loader`/`-loader-baseAddr`/`-scriptPath`/`-noanalysis` and no way to pass script
arguments to the pre/post scripts Phase 23's `FlatVolatile.java`/`ExportAnalysis23.java`
already need (an entry-points file, an output path, an expected-line count). Closing that gap
is this phase's first engineering task, ahead of anything SLEIGH-specific.

**Primary recommendation:** Sequence the phase as (1) extend the `ghidra.analyze` host-tool
seam to carry `processor`, `loader`/`loaderBaseAddr`, `scriptPath`, `noanalysis`, and
per-script argument lists — a `host-tool.mts`/`ghidra-project.mts` change with no SLEIGH
content; (2) the `sleigh` compile gate (OPC-01, earliest task in the phase, mtime+exit0+`.sla`
discipline, not dxa's digest discipline); (3) the extension module + new `.ldefs` id +
`-processor` change in the same commit (OPC-04, criterion 1); (4) `OPC-02`'s declared-unknown
and non-collision checks; (5) `OPC-03` against the real `danish.d64` corpus; (6) the harness's
three gates and volatile carve on both routes (`GHID-01`..`GHID-03`); (7) the `DecompInterface`
export with `attempted == decompiled + timedOut` accounting and the `DataTypeManager` control,
on the same image (`GHID-04`/`GHID-05`), which is `GHID-04`'s acceptance run and therefore the
phase's last major criterion.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SLEIGH extension source (`.slaspec`/`.sinc`/`.ldefs`) | Host prerequisite (Ghidra install) | Committed repo source | The compiled `.sla` must live inside a Ghidra-loadable extension location; the human-authored source is committed in-repo and materialised there by a build/install step, mirroring dxa's vendor-then-build pattern (Phase 35). |
| `sleigh` compile gate | Host-bound tooling | Container-side test | The `sleigh` binary is part of the Ghidra host prerequisite; the gate itself (a Node test spawning it) runs container-side exactly like `dxa-build-gate.test.ts` does for `make`. |
| `analyzeHeadless` invocation | Host-bound executor (`host-tool.mts`/`ghidra-project.mts`) | Container-side orchestration (`dxa-run.ts`-shaped consumer) | Established seam: Phase 34's `runHostTool()` is the ONE place a child process is spawned on the host; a container-side module (analogous to `dxa-run.ts`) calls `runHostToolFromContainer("ghidra.analyze", …)` and never `node:child_process`. |
| Pre/post Ghidra scripts (`FlatVolatile.java`, `ExportAnalysis23.java`-successor) | Host-bound (JVM-internal) | — | These execute inside the JVM Ghidra spawns; they are Java, not TypeScript, and are reached via `-preScript`/`-postScript`, never re-implemented container-side. |
| Structural-fact export format | Host-bound (Java script output) | Container-side consumer (next phase, `IMP-01`) | This phase only produces the export file; `IMP-01`'s importer (Phase 37) is the container-side consumer. Do not design the importer here. |
| Volatile-I/O carve, block classification, timeout accounting | Host-bound (JVM-internal, `FlatVolatile.java`/export script) | — | All API surface (`Memory`, `DecompInterface`) is Ghidra-internal Java; no equivalent exists container-side. |

## <phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPC-01 | Fix, compile, integrate and verify all 105 opcode bytes under a SLEIGH extension; compile gate (exit 0 + `.sla` produced + mtime newer than every input) is the earliest task. | § A.3, A.4, A.7 below; `.planning/research/STACK.md:531-620`, `PITFALLS.md:626-693`. |
| OPC-02 | XAA/LAX-immediate/AHX/TAS/SHX/SHY modelled as declared unknowns (opaque userops), not plausible p-code; `65c02.slaspec` non-collision. | § A.5, A.6 below; `docs/undocumented-opcodes-ghidra.md:45-50,458-533`. |
| OPC-03 | Verified against real code containing illegal opcodes (the corpus), sequenced after OPC-01/OPC-04 and ahead of GHID-04's acceptance run. | § A.7, D.3 below; `docs/phase33-reproducible-run-gate-findings.md:428-479`. |
| OPC-04 | Extension installed as its own Ghidra language, new `.ldefs` id, `-processor` change in the same commit; phase's first criterion asserts the language the run log says it used. | § A.1, A.2 below; `.planning/research/STACK.md:531-568`, `PITFALLS.md:721-756`. |
| GHID-01 | `analyzeHeadless` runs headless under a committed script, given dxa's map as hints, reproducible; three independent gates (script-error grep, block-total classification count, Ghidra as a declared host prerequisite). | § B.1, B.3, B.4 below; `.planning/research/STACK.md:488-529`, `PITFALLS.md:550-604`. |
| GHID-02 | `$0000-$0001` and `$D000-$DFFF` marked volatile before `analyzeAll()`, proven by planted-violation (disappearance) test. | § B.5, B.6 below; `.planning/notes/ghidra-volatile-io-and-banking.md`, `PITFALLS.md:606-618`. |
| GHID-03 | Loader-owned block at the same address gets the flag set on the existing block; control observed red on BOTH import routes. | § B.5 below; `PITFALLS.md:606-618`. |
| GHID-04 | Structural facts exported through `DecompInterface`, not `DataTypeManager`; per-function attempted/decompiled/timedOut accounting; control on the same image as the acceptance run. | § C.1, C.2, C.3 below; `PITFALLS.md:781-793`. |
| GHID-05 | Typed cross-references exported with access kind (READ/WRITE/READ_WRITE/COMPUTED_JUMP) preserved. | § C.4 below; `RefType`/`FlowType` class inspection this session. |

</phase_requirements>

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|---------------|
| Ghidra | `12.1.3 PUBLIC`, build `2026-Aug-17` | SLEIGH compiler + headless decompiler harness | Declared host prerequisite (not vendored). MEASURED [carried, `.planning/research/STACK.md:474-483`]: zip sha256 `93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54`, 543 MiB, JDK floor 21 (no ceiling). READ-IN-SOURCE this session: exists on this host at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/`, unpinned out-of-tree probe unpack, not on `$PATH`, not vendored. |
| `analyzeHeadless` | ships with Ghidra 12.1.3 | Headless import/analyze/script-run entry point | The only non-GUI Ghidra entry point; already integrated behind `host-tool.mts`'s `ghidra.analyze` tool id (Phase 34). |
| `support/sleigh` | ships with Ghidra 12.1.3 | SLEIGH `.slaspec`/`.sinc` → `.sla` compiler | READ-IN-SOURCE this session: exists at `.../support/sleigh` (also under `Ghidra/Features/Decompiler/os/linux_x86_64/sleigh`). |
| Node.js host-tool seam | this repo, `src/mcp/vice/host-tool.mts` + `ghidra-project.mts` | Container→host execution boundary for `analyzeHeadless`/`sleigh` | Already shipped (Phase 34); this phase extends its argv surface, does not replace it. |

### No new npm/external packages this phase

Ghidra is a **host prerequisite by version**, not an npm dependency — nothing to `npm view`.
The `sleigh`/`analyzeHeadless` binaries ship inside the Ghidra distribution already declared
in `.planning/research/STACK.md`. No new package.json dependency is introduced.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Editing `6502.slaspec` in place to add undocumented opcodes | A new language variant (`6502:LE:16:nmos`) with its own `.ldefs` id | READ-IN-SOURCE, `65c02.slaspec:1` is `@include "6502.slaspec"` (confirmed this session by directory listing at `.../Processors/6502/data/languages/65c02.slaspec`) — an in-place edit makes `65C02` inherit the illegal bytes rather than avoid them. This is why `OPC-04` exists as its own requirement. |
| Committing a built `.sla` | Building it at test/install time from committed `.slaspec`/`.sinc` source | ROADMAP's own recommendation: "build the `.sla`, do not commit it" — a `.sla` is a build artifact of a specific Ghidra version; committing it pins that version silently. See § D.3 below for the `.gitignore`/build-gate shape to copy. |

**Installation:** No `npm install`. Ghidra installation is a host-prerequisite concern
(`GHIDRA_HOME` env var, already read by `host-tool.mts:784-800`, READ-IN-SOURCE).

## Package Legitimacy Audit

**Not applicable this phase.** No new npm/PyPI/crates packages are introduced. Ghidra is a
host prerequisite identified by version and sha256 (see Standard Stack above), not a package
manager dependency, so the Package Legitimacy Gate protocol does not apply.

## Architecture Patterns

### System Architecture Diagram

```
container side                          host side (broker process)
───────────────                          ───────────────────────────
future ghidra-run.ts  ──runHostToolFromContainer──▶  host-tool.mts: runHostTool()
  (mirrors dxa-run.ts,        ("ghidra.analyze",         │
   Phase 35 pattern)           {runId, importPath,       │ normaliseHostToolRequest()
                                processor, loader,        │ resolveWorkspacePath() (paths)
                                loaderBaseAddr,            │ resolveGhidraProject()  (runId)
                                scriptPath, noanalysis,     ▼
                                preScript, postScript,   ghidra-project.mts:
                                preScriptArgs,              buildAnalyzeHeadlessArgv()
                                postScriptArgs})             │ (MUST GAIN: -processor,
                                                              │  -loader, -loader-baseAddr,
                                                              │  -scriptPath, -noanalysis,
                                                              │  script args)
                                                              ▼
                                                        spawn(analyzeHeadless, argv)
                                                              │
                                                    ┌─────────┴─────────┐
                                                    ▼                   ▼
                                          -preScript FlatVolatile   -postScript
                                          (volatile carve,          ExportAnalysis-successor
                                           analyzeAll())            (DecompInterface walk,
                                                                     classification + refs +
                                                                     attempted/decompiled/
                                                                     timedOut counts)
                                                    │                   │
                                                    └─────────┬─────────┘
                                                              ▼
                                                   digestOutputFile() → {path, sha256, byteLength}
                                                              │
                                              response crosses seam back to container
                                                              │
                                                              ▼
                                          future ghidra-run.ts reads the digested export
                                          via containerPath()-translated path (Phase 37's
                                          importer is the eventual container-side consumer;
                                          THIS phase stops at "the export exists and is
                                          proven correct")
```

### Recommended Project Structure

```
src/mcp/vice/
├── ghidra-project.mts          # EXISTING (Phase 34) -- extend buildAnalyzeHeadlessArgv()
├── host-tool.mts                # EXISTING (Phase 34) -- extend GhidraAnalyzeArgs, HOST_TOOL_ARG_KEYS
├── ghidra-run.ts                # NEW -- container-side orchestrator, mirrors dxa-run.ts exactly
├── ghidra-scripts.ts            # NEW -- OR keep script filenames as bare string literals passed
│                                 #   through preScript/postScript wire fields (avoids FLOW-02
│                                 #   phase-number-in-shipped-string risk entirely, see § D.1)
├── vendor/ghidra-ext/            # NEW -- committed SLEIGH extension source (never the .sla)
│   ├── Module.manifest           #   may be empty (stock 6502 module's is, MEASURED this session)
│   ├── extension.properties
│   └── data/
│       ├── sleighArgs.txt        #   may be empty
│       └── languages/
│           ├── 6502_nmos.ldefs   #   NEW language id, e.g. 6502:LE:16:nmos
│           ├── 6502_nmos.slaspec # @include "<...>/6502.slaspec" + @include "6502_undocumented.sinc"
│           ├── 6502_undocumented.sinc  # the FIXED (sized-locals) extension source
│           ├── 6502.pspec        #   copied from Ghidra's own 6502 module (unmodified)
│           └── 6502.cspec        #   copied from Ghidra's own 6502 module (unmodified)
└── vendor/ghidra-scripts/        # NEW -- committed Java pre/post scripts (successors to
    ├── FlatVolatile.java         #   Phase 23's evidence scripts; RENAME on promotion, see § D.1)
    └── ExportAnalysis36.java     #   -- do not literally name a phase number in the filename;
                                   #   name it for its function instead (e.g. GhidraStructExport.java)
```

### Pattern 1: Extending the host-tool seam's typed allowlist (mirrors Phase 35's `dxa.disassemble` addition)

**What:** Add new fields to `GhidraAnalyzeArgs`, `HOST_TOOL_ARG_KEYS["ghidra.analyze"]`,
`HOST_TOOL_PATH_ARG_KEYS["ghidra.analyze"]`, and thread them through
`resolveWorkspacePath()`/`buildAnalyzeHeadlessArgv()` — following the exact seven-synchronized-edit
discipline the `dxa.disassemble` addition already used.

**When to use:** This is the phase's first non-SLEIGH engineering task; `OPC-04`'s criterion 1
cannot be satisfied without a `-processor` field existing on the wire.

**Example (current shape, READ-IN-SOURCE — what exists today, to extend, not replace):**
```typescript
// src/mcp/vice/host-tool.mts:212-217, VERIFIED [read this session]
export interface GhidraAnalyzeArgs {
  runId: string;
  importPath: string;
  preScript?: string;
  postScript?: string;
}
// host-tool.mts:156 — accepted keys today:
"ghidra.analyze": Object.freeze(["runId", "importPath", "preScript", "postScript"]),
```

```typescript
// src/mcp/vice/ghidra-project.mts:263-335, VERIFIED [read this session]
// buildAnalyzeHeadlessArgv() emits EXACTLY:
//   [projectLocation, projectName, "-import", importPath, "-deleteProject",
//    "-preScript", preScript?, "-postScript", postScript?]
// -- no -processor, no -loader, no -loader-baseAddr, no -scriptPath, no
// -noanalysis, no script-argument passthrough for preScript/postScript.
```

**The gap this phase must close** (not yet built; no file currently does this):
- `processor: string` (required, non-empty) → emits `-processor <value>` — this is what makes
  criterion 1 (OPC-04) checkable at all: the wire request names the language, the argv emits
  it, the run log echoes it back (`INFO Using Language/Compiler: <id>`, MEASURED
  `.planning/research/STACK.md:555`).
- `loader?: string`, `loaderBaseAddr?: string` → `-loader <name> -loader-<argname> <value>`
  (Phase 23's recorded invocation uses `-loader BinaryLoader -loader-baseAddr 0x0` or `0x801`,
  `docs/phase23-real-release-gate-findings.md:1116-1128`).
- `scriptPath?: string` (workspace-relative, through `resolveWorkspacePath()` like `preScript`)
  → `-scriptPath <dir>`, needed because the committed `.java` scripts will not sit in Ghidra's
  own default script directories.
- `noanalysis?: boolean` → `-noanalysis`. Load-bearing: `FlatVolatile.java`'s own `run()` body
  calls `analyzeAll(currentProgram)` itself (`FlatVolatile.java:190`, read this session) —
  without `-noanalysis`, Ghidra's own automatic post-preScript analysis would ALSO run,
  duplicating (and racing) the manual call.
- `preScriptArgs?: string[]`, `postScriptArgs?: string[]` → appended after `-preScript <name>`
  / `-postScript <name>` respectively. Required because `FlatVolatile.java` takes an
  entry-points-file argument (`getScriptArgs()[0]`) and the export script takes an output path
  plus an optional expected-count argument — **neither is passable today**: the current
  `HOST_TOOL_ARG_KEYS`/`buildAnalyzeHeadlessArgv()` carry no argument-list field for either
  script.

### Pattern 2: Container-side orchestration mirrors `dxa-run.ts` exactly

**What:** A new `ghidra-run.ts` (or similarly named) module calls
`runHostToolFromContainer("ghidra.analyze", { ... })` (`host-tool-client.ts`) and reads the
returned, already-`containerPath()`-translated result path. It **never** imports
`node:child_process` and **never** imports `hostpath.ts` directly.

**Example, the worked analog (READ-IN-SOURCE, `src/mcp/vice/dxa-run.ts:1-60`):**
```typescript
// dxa-run.ts's own header states the rule this phase's Ghidra orchestrator must follow:
// "Reaches dxa through runHostToolFromContainer(...) and NEVER node:child_process --
//  SEAM-05's BANNED_COMMAND_SHAPES already names dxa, so a direct spawn here is a
//  caught violation, not an invisible one."
// "THIS MODULE MUST NEVER IMPORT hostpath.ts ... The response's [path] has ALREADY
//  been translated through containerPath() by runHostToolFromContainer() ...
//  before this module ever sees it."
import { runHostToolFromContainer, ... } from "./host-tool-client.ts";
```

A `ghidra-run.ts` module built the same way keeps the `hostpath.ts` consumer set closed by
construction — directly relevant to the Standing Constraint on `hostpath-consumers.test.ts`'s
`ANNO_MODULE_FLOOR` and the ROADMAP's own "prefer not to become a consumer" guidance
(`.planning/ROADMAP.md:196-211`, quoted in Standing Constraints, CITED [this repo]).

### Anti-Patterns to Avoid

- **Re-deriving the dot-segment rule or the per-run project-directory reservation anywhere
  outside `ghidra-project.mts`.** It already exists (`hasDotPrefixedSegment()`,
  `resolveGhidraProject()`), is independently re-checked inside `buildAnalyzeHeadlessArgv()`
  for a caller that bypasses the resolver, and is explicitly commented "THIS IS THE ONE
  AUTHORITATIVE PLACE" (`ghidra-project.mts:17-29`, READ-IN-SOURCE).
- **Trusting `analyzeHeadless`'s exit status.** MEASURED, carried: exit 0 even when a
  post-script throws (`.planning/research/PITFALLS.md:550-582`; Standing Constraint,
  `ROADMAP.md:184-194`). Grep the run log for the exact literal `ERROR REPORT SCRIPT ERROR`.
- **A naive `error`/`fail` grep on the run log.** MEASURED false-fire: `ZERO_PAGE`/`STACK`
  "Failed to add language defined memory block due to conflict" INFO lines appear on **any**
  base-`0x0` import, not just the flat-64K route specifically (`.planning/research/STACK.md:523-529`,
  widening Phase 23's original "flat-64K route only" framing).
- **Catching (`try`/`catch`) around the volatile carve.** MEASURED: this is exactly what makes
  a `MemoryConflictException` silently degrade the whole run to non-volatile
  (`.planning/research/PITFALLS.md:606-619`; Standing Constraint, `ROADMAP.md:58-68`).
- **A hard-coded `65536` (or any fixed number) in the classification-completeness assertion.**
  MEASURED: the correct expectation is the **block total from `mem.getBlocks()`**, computed and
  printed by the script itself, and it differs by route: `.prg` route 4887 lines / 279 image
  bytes; flat-64K route 65536/65536 (`.planning/research/PITFALLS.md:583-602`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace-path confinement for a new wire-supplied path field | A second `path.resolve()`+`startsWith()` check | `resolveWorkspacePath()` (`host-tool.mts:647-670`) | Already hardened against the symlink-blind defect CR-05 found and fixed (ancestor-realpath walk); a second copy reintroduces exactly that bug class. |
| Per-run Ghidra project isolation | A lock file, a mutex, a "is this project busy" check | `resolveGhidraProject()`'s reservation-on-`mkdirSync` (`ghidra-project.mts:207-227`) | Already makes Ghidra's single-writer project lock structurally unreachable by never reusing a directory; re-deriving a lock is solving an already-solved problem worse. |
| Detecting a Ghidra post-script throw | Parsing exit status, or a heuristic log scan | Grep the exact literal `ERROR REPORT SCRIPT ERROR` | The one string this milestone's own measurement proved reliable; anything else either misses the throw (exit 0) or false-fires (naive `error`/`fail`). |
| SLEIGH size-inference for a token field or pcodeop return | Ad-hoc casts, implicit widening | An explicitly sized `local` (`local i8:1 = imm8;` then use `i8`) | MEASURED, verified fix; the 8-failure compile transcript names the exact pattern. |

**Key insight:** Every "don't hand-roll" item above already has a working, tested
implementation in this repo (Phase 34/35) or a measured fix (this milestone's own research).
This phase's job is almost entirely **extend and apply**, not invent.

## Common Pitfalls

*(Full detail is in `.planning/research/PITFALLS.md` Pitfalls 11-19 and 23, MEASURED this
milestone. Summarized here with the exact citation; do not re-run these experiments.)*

### Pitfall: `analyzeHeadless` exits 0 on a thrown post-script
**What goes wrong:** A harness that trusts exit status reports success on a run that produced
nothing. **Citation:** `.planning/research/PITFALLS.md:550-582`; Standing Constraint,
`ROADMAP.md:184-194`. **How to avoid:** grep the run log for the exact literal `ERROR REPORT
SCRIPT ERROR`.

### Pitfall: Classification count must be the block total, not the image size
**What goes wrong:** A hard-coded `lines == imageSize` assertion fires spuriously on the `.prg`
route (4887 lines vs 279 image bytes) once weakened to pass, or a `> 0` check stops asserting
anything. **Citation:** `.planning/research/PITFALLS.md:583-602`. **How to avoid:** compute the
expectation from `mem.getBlocks()` inside the script itself, print both, assert equality
internally.

### Pitfall: `MemoryConflictException` route-dependence
**What goes wrong:** A pre-script proven correct on the `.prg` fixture meets a conflict on the
flat-64K route it was never tested against, because the flat image already occupies
`$0000-$01FF` and the language's own `ZERO_PAGE`/`STACK` blocks collide there.
**Citation:** `.planning/research/PITFALLS.md:606-618`; MEASURED reference-dump proof:
`4002 -> d020 WRITE`, `4007 -> d020 WRITE`, `400a -> 0001 READ`, `400e -> 0001 WRITE`
surviving with the fix; two consecutive `$D020` writes with no intervening read is the exact
dead-store pattern deleted without it. **How to avoid:** `mem.getBlock(addr)` first,
`setVolatile(true)` on the EXISTING block; `createUninitializedBlock` only on null; exercise
and assert on BOTH routes.

### Pitfall: SLEIGH extension source does not compile
**Citation:** `.planning/research/PITFALLS.md:626-693`, `.planning/research/STACK.md:531-620`.
See § A.4 below for the full 8-constructor table and fix pattern — do not re-run this
experiment, the transcript is already captured.

### Pitfall: A failed `sleigh` compile leaves the stock `.sla` in place
**What goes wrong:** The harness runs against `6502.sla` (5094 bytes, pre-shipped) with no
error, decoding none of the 105 bytes. **Citation:** `.planning/research/PITFALLS.md:696-709`.
**How to avoid:** gate on exit 0 AND a produced `.sla` AND an mtime strictly newer than every
input (`.slaspec`, every `@include`d `.sinc`, and the `6502.pspec`/`6502.cspec` it depends on).

### Pitfall: No `.ldefs` entry — the extension compiles, ships, and is never loaded
**What goes wrong:** A compiled `.sla` sits unreachable because no `-processor` argument names
it. **Citation:** `.planning/research/PITFALLS.md:721-756`. This is why criterion 1 (the
language-used assertion) is the phase's FIRST criterion, not merely a task.

### Pitfall: Unresolved computed dispatch is invisible in Ghidra's own export
**What goes wrong:** Ghidra emits no diagnostic for a dispatch site it failed to resolve; a
criterion built only from Ghidra's own output degrades to "Ghidra resolved what Ghidra found."
**Citation:** `.planning/research/PITFALLS.md:759-777`; `docs/phase23-real-release-gate-findings.md:512-523`.
**Relevance to this phase:** the ROADMAP's own `C2_SITES_ENUMERATED` narrowing (stated absent,
`memmapshow` excluded by owner decision) means unresolved dispatch is reported as a **count and
a list with no denominator** — do not attempt to source a denominator this milestone has no
independent enumerator for.

### Pitfall: `DecompInterface`'s own silent-partial mode — the decompile timeout
**What goes wrong:** A timed-out function yields no facts and no error, failing short in
exactly the shape the `DataTypeManager` control exists to catch. **Citation:**
`.planning/research/PITFALLS.md:781-793`. **How to avoid:** count attempted/decompiled/timedOut
per function, assert `attempted == decompiled + timedOut`, assert `timedOut` under a committed
ceiling.

## Code Examples

### A working `DecompInterface` sequence (READ-IN-SOURCE, `/home/henrik/dev/_ghidra-probe/scripts/Decomp.java`, the prior probe's own "the one that works")

```java
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.Function;
import java.io.*;

public class Decomp extends GhidraScript {
    @Override
    public void run() throws Exception {
        PrintWriter out = new PrintWriter(new FileWriter(getScriptArgs()[0]));
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            DecompileResults r = di.decompileFunction(f, 30, monitor);
            out.println("//===== " + f.getName() + " @ " + f.getEntryPoint());
            out.println(r.decompileCompleted() ? r.getDecompiledFunction().getC()
                                              : "// FAILED: " + r.getErrorMessage());
        }
        out.close();
    }
}
```

`decompileFunction(function, timeoutSeconds, monitor)` — the timeout parameter is **seconds**.

### `DecompileResults`'s timeout-vs-failure distinction (VERIFIED this session — `javap -p` against the real `Decompiler.jar` inside Ghidra 12.1.3)

```
public class ghidra.app.decompiler.DecompileResults {
  public boolean decompileCompleted();
  public boolean isTimedOut();       // <-- distinct from decompileCompleted()/isCancelled()/failedToStart()
  public boolean isCancelled();
  public boolean failedToStart();
  public boolean isValid();
  public java.lang.String getErrorMessage();
  public ghidra.program.model.pcode.HighFunction getHighFunction();
  ...
}
```
Extracted from `Ghidra/Framework/.../Decompiler.jar`'s `ghidra/app/decompiler/DecompileResults.class`
this session via `javap -p`. This answers `GHID-04`'s attempted/decompiled/timedOut
requirement directly: call `isTimedOut()` on every `DecompileResults`, separately from
`decompileCompleted()`, and increment the right counter.

### Cross-reference access-kind constants (VERIFIED this session — `javap -p -constants` against `SoftwareModeling.jar`'s `RefType.class`)

```
public static final ghidra.program.model.symbol.RefType READ;
public static final ghidra.program.model.symbol.RefType WRITE;
public static final ghidra.program.model.symbol.RefType READ_WRITE;
public static final ghidra.program.model.symbol.FlowType COMPUTED_JUMP;
```
`Reference.getReferenceType()` returns a `RefType` (a `FlowType` subtype); its printed/name
form is what `ExportAnalysis23.java`'s existing `## REFERENCES` section already emits
(`rf.getReferenceType()`, READ-IN-SOURCE `.planning/phases/23-.../evidence/ExportAnalysis23.java:122-123`)
— `GHID-05`'s access-kind requirement is satisfied by continuing to print this field, not by
building a new one.

### The pcode opcode PIECE (62) underlies the "CONCAT11" idiom named in criterion 5 (VERIFIED this session — `javap -p -constants` against `PcodeOp.class`)

```
public static final int PIECE = 62;
```
Ghidra's decompiler C-output renders a `PIECE` combining two 1-byte varnodes as `CONCAT11(hi,
lo)` in the printed C text `Decomp.java` already captures via `getDecompiledFunction().getC()`.
A postScript can detect the idiom either by scanning the printed C text for the literal
`CONCAT11(` or by walking `HighFunction`'s p-code for a `PcodeOp` with `getOpcode() ==
PcodeOp.PIECE`. The text-scan route is simpler and reuses the export the harness already
produces.

### The 8 failing SLEIGH constructors and the verified fix (MEASURED, carried verbatim — `.planning/research/PITFALLS.md:655-676`)

| `.sinc` line | doc line (`docs/undocumented-opcodes-ghidra.md`) | constructor |
|---|---|---|
| 217 | 220 | `:NOP imm16 is op=0x0c` — `local ignored:1 = *:1 imm16;` |
| 390 | 393 | `:LAX "#"imm8 is op=0xab` — `unstableLAXImmediate(A, imm8)` |
| 449 | 452 | `:SBC "#"imm8 is op=0xeb` — `undocSBC(imm8)` |
| 458 | 461 | `:XAA "#"imm8 is op=0x8b` — `unstableXAA(A, X, imm8)` |
| 493 | 496 | `:AHX imm16,Y is op=0x9f` — `unstableAHXStore(A, X, imm16, Y)` |
| 504 | 507 | `:TAS imm16,Y is op=0x9b` — `unstableTASStore(…)` |
| 518 | 521 | `:SHY imm16,X is op=0x9c` — `unstableSHYStore(Y, imm16, X)` |
| 525 | 528 | `:SHX imm16,Y is op=0x9e` — `unstableSHXStore(X, imm16, Y)` |

**The fix, verified to compile clean (MEASURED):**
```
local i8:1  = imm8;      # then pass i8 to the userop, or as the deref/macro argument
local a16:2 = imm16;     # then pass a16, and deref *:1 a16
```
Compiles the entire file with zero errors; a `t.sla` of 8,423 bytes was produced, with only
benign warnings (`2 NOP constructors found`, `5 operations wrote to temporaries that were not
read`). **The control that must be observed red:** revert one of the eight sized-local fixes
and observe `Could not resolve at least 1 variable size` naming that exact line — eight red
observations available for free (`.planning/research/PITFALLS.md:685`).

### The `.ldefs` shape for the new language (stock file, READ-IN-SOURCE this session — `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/Ghidra/Processors/6502/data/languages/6502.ldefs`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<language_definitions>
  <language processor="6502"
            endian="little"
            size="16"
            variant="default"
            version="1.0"
            slafile="6502.sla"
            processorspec="6502.pspec"
            manualindexfile="../manuals/6502.idx"
            id="6502:LE:16:default">
    <description>6502 Microcontroller Family</description>
    <compiler name="default" spec="6502.cspec" id="default"/>
    <external_name tool="IDA-PRO" name="m6502"/>
  </language>
  <language processor="65C02" ... id="65C02:LE:16:default"> ... </language>
</language_definitions>
```

**What Phase 36 adds** — a NEW `<language>` element in a NEW `.ldefs` file (never edit this
stock file, which is inside the unpinned host prerequisite and not this repo's to modify), with
a new `variant` under the existing `processor="6502"` (MEASURED shape,
`.planning/research/STACK.md:563-567`, giving id `6502:LE:16:nmos`):
```xml
<language processor="6502" endian="little" size="16" variant="nmos" version="1.0"
          slafile="6502_nmos.sla" processorspec="6502.pspec"
          id="6502:LE:16:nmos">
  <description>NMOS 6502/6510 with undocumented opcodes</description>
  <compiler name="default" spec="6502.cspec" id="default"/>
</language>
```
`slafile`/`processorspec`/`id` are mandatory and `id` must be globally unique across every
`.ldefs` Ghidra loads (both the stock one and this new extension's). `processorspec`
(`6502.pspec`) and `compiler`/`spec` (`6502.cspec`) can be **copied unmodified** from the stock
module — MEASURED, this session confirmed both files exist at
`Ghidra/Processors/6502/data/languages/6502.pspec` / `6502.cspec` and Finding 1's own minimum
file set (`.planning/research/STACK.md:538-548`) lists them as copied, not authored.

### The minimum extension-module file set (MEASURED, carried — `.planning/research/STACK.md:538-548`)

```
$GHIDRA/Ghidra/Extensions/<ModuleName>/
  Module.manifest            # may be EMPTY -- the shipped 6502 module's is zero-length
  extension.properties       # name= description= author= createdOn= version=
  data/sleighArgs.txt        # may be empty
  data/languages/
    <name>.ldefs
    <name>.slaspec            # @include "<path>/6502.slaspec" + @include "6502_undocumented.sinc"
    <name>.sla                 # produced by support/sleigh -- BUILD, do not commit
    6502.pspec  6502.cspec    # copied from Ghidra/Processors/6502/data/languages/
```
Built with `support/sleigh <name>.slaspec <name>.sla`, then verified end to end:
```
analyzeHeadless <dir> langprobe -import tiny.bin \
  -processor 6502:LE:16:nmos -loader BinaryLoader -loader-baseAddr 0x0 -noanalysis -deleteProject
→ INFO  Using Language/Compiler: 6502:LE:16:nmos:default (ProgramLoader)
→ INFO  REPORT: Import succeeded (HeadlessAnalyzer)          [exit 0]
```
No `gradle` needed or present on this host's `$PATH` (MEASURED, `.planning/research/STACK.md:559-561`).

### The `analyzeHeadless` invocations, both routes (MEASURED, carried verbatim — `docs/phase23-real-release-gate-findings.md:1107-1129`)

```
# .prg route
analyzeHeadless <proj> <name> -import <image.prg> \
  -processor <LANGUAGE_ID> -loader BinaryLoader -loader-baseAddr 0x801 \
  -noanalysis -scriptPath <scriptdir> \
  -preScript FlatVolatile.java <entrypoints-file> \
  -postScript <ExportScript>.java <out.txt> [<expected-classification-lines>] -deleteProject

# flat-64K route
analyzeHeadless <proj> <name> -import <flat64k.bin> \
  -processor <LANGUAGE_ID> -loader BinaryLoader -loader-baseAddr 0x0 \
  -noanalysis -scriptPath <scriptdir> \
  -preScript FlatVolatile.java <entrypoints-file> \
  -postScript <ExportScript>.java <out.txt> [<expected-classification-lines>] -deleteProject
```
Both are SINGLE invocations (import + pre-script + post-script in one call) because
`-deleteProject` destroys the project on exit — a second `-process` call would have nothing
left to open. `<LANGUAGE_ID>` in Phase 23's own recorded runs was `6502:LE:16:default` (the
stock language, since Phase 23 predates the extension); **this phase's own acceptance run must
use the new extension's id**, and criterion 1 requires observing the stock-language run FAIL
the 105-byte assertion first.

### The volatile pre-script's split-first pattern (READ-IN-SOURCE, `.planning/phases/23-.../evidence/FlatVolatile.java:81-125`, quoted verbatim above its own header comment)

```java
private static final long[] SPLIT_AT = { 0x0002L, 0xd000L, 0xe000L };
private static final long[][] VOLATILE_RANGES = {
    { 0x0000L, 0x0002L },   // 6510 processor port
    { 0xd000L, 0x1000L },   // VIC-II / SID / colour RAM / CIA / expansion
};
// carve(): mem.split(blk, addr) at each SPLIT_AT boundary FIRST (skips no-op splits
//   with a printed reason), THEN makeVolatile(): mem.getBlock(addr) -- if non-null,
//   setVolatile(true) on the EXISTING (now-carved) block; if null (the .prg route,
//   where no block covers I/O), createUninitializedBlock(..., volatile=true).
// Both routes share ONE script -- it branches on which getBlock() returns, never on
// a route flag the caller passes.
```

## State of the Art

| Old belief | Corrected belief | When Changed | Impact |
|--------------|------------------|---------------|--------|
| "The SLEIGH source already exists in full … this phase integrates and verifies it; it does not write it" (v0.6.0 Phase 24 block, `.planning/ROADMAP.md:591`) | FALSIFIED: it does not compile (8 constructors), fix verified | 2026-09-02, MEASURED twice independently | `OPC-01` is fix→compile→integrate→verify, not integrate→verify. |
| `MANUAL_ONLY_TESTS` = nine files (`.planning/research/ARCHITECTURE.md:423`, `PITFALLS.md`) | **TEN** files — `dxa-live.test.ts` was added by Phase 35 | READ-IN-SOURCE this session, `src/mcp/vice/test-gate.test.ts:16-30` | Any new live-Ghidra suite this phase adds becomes the **eleventh** entry, not the tenth. |
| "the flat-64K route only" for the `ZERO_PAGE`/`STACK` conflict INFO lines (Phase 23's original framing) | The real trigger is "the image covers `$0000-$01FF`", not "the image is 64K" — also fires on a 4096-byte base-0 image | `.planning/research/STACK.md:523-529` | A log-grep exemption scoped to "flat-64K route" is too narrow; scope it to "any base-0x0 import" instead. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new language extension should be organised as a committed `vendor/ghidra-ext/` (or similarly named) source tree, built/materialised into the host's `$GHIDRA_HOME/Ghidra/Extensions/` at run/setup time — mirroring dxa's vendor-then-build pattern. `.planning/research/STACK.md`'s own measurement only proves the drop-in route WORKS when files are placed under `$GHIDRA_HOME/Ghidra/Extensions/<ModuleName>/`; it does not resolve WHO performs that placement (a dedicated `ghidra.installExtension` host-tool op, a one-time setup script, or a check-and-materialise step inside `ghidra.analyze` itself) or whether writing into the externally-managed Ghidra installation directory is acceptable given Ghidra is explicitly "a declared host prerequisite by version, not vendored." | Architecture Patterns, Standard Stack | If wrong, the extension-install mechanism needs redesigning after tasks are already written against the wrong seam shape; could also mean Ghidra's per-user extension directory (`~/.ghidra/.ghidra_<version>/Extensions/`) is the correct target instead of the shared install tree, which changes multi-run/multi-host idempotency requirements. |
| A2 | `-loader-baseAddr` and `-loader BinaryLoader` are the correct loader arguments for both the `.prg` and flat-64K routes on the NEW language id exactly as they were on the stock language id in Phase 23's rehearsal. Not independently re-verified against the new `6502:LE:16:nmos`-shaped id this session (Phase 23's rehearsal used `6502:LE:16:default`). | Code Examples (`analyzeHeadless` invocations) | Low risk — `-loader`/`-loader-baseAddr` are loader-level flags, orthogonal to `-processor`; extremely unlikely to interact, but not measured together. |
| A3 | The volatile pre-script's `analyzeAll()` call and the `-noanalysis` flag together produce the SAME final analysis state as Ghidra's own automatic (non-`-noanalysis`) analysis would on a language that also needs the entry-point seeding `FlatVolatile.java` performs before `analyzeAll()`. Not measured on the NEW language specifically — only carried from Phase 23's rehearsal on the stock language. | Common Pitfalls, Code Examples | If the new language's analyzer behaves differently under `-noanalysis` + manual `analyzeAll()` than under Ghidra's default automatic-analysis ordering, criterion 5's structural facts could differ from what a stock-language run would have produced, though this is the intended reduced-differences design. |

## Open Questions

1. **Who owns installing the SLEIGH extension into the host Ghidra installation, and when?**
   - What we know: the drop-in route works with no Gradle and no Ghidra rebuild (MEASURED,
     `.planning/research/STACK.md:535-561`); the file set is small and mostly copied files.
   - What's unclear: whether this is a one-time host-side setup step (analogous to a
     `vendor/dxa/build.bash install` verb, but installing into the EXTERNAL Ghidra tree rather
     than this repo's own `vendor/`), a new `host_tool` op (`ghidra.installExtension`), or a
     check-and-materialise preflight inside `ghidra.analyze` itself (idempotent, checked every
     invocation).
   - Recommendation: treat as a planner decision informed by this phase's own Wave 0 —
     probably a dedicated setup script/host-tool op run once per Ghidra installation, checked
     (not silently re-materialised) at the start of `ghidra.analyze`, following the pattern
     `findAcmeLib()`/`findDxaBinary()` already use for "probe, refuse by name if absent."

2. **Where should the committed Java pre/post scripts live, given `docs-dangling-refs.test.ts`'s
   FLOW-02 guard (READ-IN-SOURCE, `src/mcp/vice/docs-dangling-refs.test.ts:355-375`) scans
   shipped TS **string literals** for phase numbers, not `.java` filenames directly?**
   - What we know: the guard scans `shippedTsModules()`'s string literals with a hand-written
     character state machine; `.java` files are not TS and are not directly scanned.
   - What's unclear: if a TS module (e.g. a wire-request builder) contains the literal string
     `"ExportAnalysis23.java"` as a script-name argument, THAT string literal (inside a shipped
     `.ts` file) would trip FLOW-02 on the embedded "23". Renaming the Java files to something
     with no phase number (e.g. `GhidraStructExport.java`, `VolatileCarve.java`) sidesteps this
     entirely and is simpler than tracking whether/when the guard's scope would include them.
   - Recommendation: name the promoted scripts for their function, never their originating
     phase, from the start — avoids the rename-on-promotion problem entirely rather than
     deferring it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ghidra | `sleigh` compile gate, `analyzeHeadless` harness | ✓ (unpinned probe unpack) | `12.1.3 PUBLIC`, build `2026-Aug-17`, at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/` | None — this IS the declared host prerequisite; `GHIDRA_HOME` env var must point here for local dev, and CI needs its own install step (unresolved cost, carried from Phase 34's Assumption A3, `.planning/research/STACK.md`/`docs/phase34-host-tool-seam-decisions.md:79-85`). |
| JDK ≥ 21 | Ghidra runtime | ✓ | OpenJDK 21.0.12.1 (Debian 13), MEASURED `.planning/research/STACK.md:481` | None needed — floor already met. |
| `gradle` | Building a Java-bearing Ghidra extension | ✗ (not on `$PATH`) | — | Not needed — this phase's extension ships NO compiled Java, only `.slaspec`/`.sinc`/`.ldefs` plus copied `.pspec`/`.cspec`; MEASURED the drop-in route needs no Gradle at all. |
| `GHIDRA_HOME` env var | `host-tool.mts`'s `ghidra.analyze` branch (`host-tool.mts:784-800`, READ-IN-SOURCE) | Must be set by whoever runs the harness | — | Refuses by name today if unset or if `support/analyzeHeadless` doesn't exist at the resolved path — already implemented, no fallback needed beyond setting the env var. |
| Real cracked corpus (`danish.d64`) | `OPC-03`, `GHID-04` acceptance run | Present on disk, gitignored, never committed | sha256 `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` (`docs/phase33-reproducible-run-gate-findings.md:19-24`) | None — `saeger.d64` exists too but was never exercised in Phase 33 and has no recorded flat-64K capture; `danish` is the only corpus release with a recorded, gate-passing capture pair (`C0_CAPTURE_PAIR: pass`). |

**Missing dependencies with no fallback:** None that block this phase locally — Ghidra is
present on this host (as an unpinned probe). CI's own Ghidra provisioning cost remains an open,
carried, unmeasured item (Phase 34's Assumption A3) but is out of THIS phase's scope to resolve.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework — READ-IN-SOURCE, project-wide convention |
| Config file | none — `package.json:58`'s `test:automated` script (`node --test '*.test.*'` minus `MANUAL_ONLY_TESTS`) |
| Quick run command | `cd src/mcp/vice && npx tsx --test host-tool.test.ts ghidra-project.test.ts` (targeted, no live Ghidra) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (excludes the ten `MANUAL_ONLY_TESTS`, per-commit floor is 2 pre-existing failures unrelated to this phase — `anno-register.test.ts`, `docs/phase33-reproducible-run-gate-findings.md`'s own `TEST_AUTOMATED_BASELINE` note) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPC-01 | `sleigh` compile gate: exit 0 + `.sla` produced + mtime newer than every input | unit/hermetic | `node --test sleigh-compile-gate.test.ts` | ❌ Wave 0 — new file, pattern to copy is `dxa-build-gate.test.ts`'s hermetic-scratch-tree discipline, but the pass/fail signal is mtime+exit0+artifact, NOT digest comparison (dxa's own pattern does not transfer directly — see Common Pitfalls "A failed `sleigh` compile leaves the stock `.sla` in place"). |
| OPC-02 | Declared-unknown check + `65c02.slaspec` non-collision | unit, live-Ghidra required for the decode-check half | `analyzeHeadless` run against a synthetic opcode sweep, asserting XAA/LAX-imm/AHX/TAS/SHX/SHY decode to opaque userops not p-code | ❌ Wave 0 — this is inherently a live-Ghidra assertion (reads `analyzeHeadless` output), so it belongs in a NEW file added to `MANUAL_ONLY_TESTS` (the eleventh entry) or a CI-gated live suite. |
| OPC-03 | Real corpus decoder-output before/after comparison | live-Ghidra, manual/CI-gated | A new script against `danish.d64`'s flat-64K capture | ❌ Wave 0 — same MANUAL_ONLY_TESTS consideration as OPC-02. |
| OPC-04 | Language-used assertion (criterion 1) | live-Ghidra | Assert the run log's `INFO Using Language/Compiler:` line names the new id | ❌ Wave 0 — same file as GHID-01's harness test, live-Ghidra. |
| GHID-01 | Three gates (script-error grep, block-total count, host-prerequisite declaration) | live-Ghidra + hermetic unit tests for the grep/count logic in isolation | `node --test ghidra-harness-gates.test.ts` (unit, string literals) + a live-Ghidra integration test | Unit half ❌ Wave 0 (new); live half added to `MANUAL_ONLY_TESTS`. |
| GHID-02/GHID-03 | Volatile carve disappearance proof, on both routes | live-Ghidra, planted-violation (remove flag → observe writes vanish) | new live suite | ❌ Wave 0 — mirrors `bank.a`'s existing fixture pattern (`.planning/notes/dxa-ghidra-pivot-evidence/bank.a`, already committed and reusable). |
| GHID-04/GHID-05 | `DecompInterface` export + `DataTypeManager` control, same image; access-kind preservation | live-Ghidra, real corpus | new live suite | ❌ Wave 0. |

### Sampling Rate

- **Per task commit:** `node --test ghidra-project.test.ts host-tool.test.ts` (existing seam
  tests, hermetic, no live Ghidra needed for seam-shape changes).
- **Per wave merge:** `npm run test:automated` (excludes live-Ghidra suites) PLUS a manual/CI
  live-Ghidra run of whichever new `MANUAL_ONLY_TESTS` entries the wave added.
- **Phase gate:** Full `test:automated` green (floor: the 2 pre-existing `anno-register.test.ts`
  failures, unrelated to this phase, already recorded in `docs/phase33-reproducible-run-gate-findings.md`)
  PLUS every new live-Ghidra suite run at least once and its output inspected for the exact
  literal `ERROR REPORT SCRIPT ERROR` before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `sleigh-compile-gate.test.ts` — covers `OPC-01`'s compile gate (mtime+exit0+artifact
      discipline; NOT dxa's digest discipline — different pass/fail signal)
- [ ] Extension of `ghidra-project.test.ts` / `host-tool.test.ts` — covers the seam-argv-surface
      gap named in Architecture Patterns § Pattern 1 (`-processor`/`-loader`/`-scriptPath`/
      `-noanalysis`/script-args)
- [ ] A new live-Ghidra suite (name TBD by planner) — covers `OPC-02`, `OPC-03`, `OPC-04`
      criterion 1, `GHID-01` (three gates), `GHID-02`/`GHID-03` (volatile carve, both routes),
      `GHID-04`/`GHID-05` (export + control). MUST be added to `test-gate.test.ts`'s
      `MANUAL_ONLY_TESTS` array (currently 10 entries, READ-IN-SOURCE `test-gate.test.ts:16-30`)
      in the SAME commit that adds the file, or it silently runs in `test:automated` and fails
      on any machine without `GHIDRA_HOME` set.
- [ ] `ci.yml` step for whichever new test directory/file the above adds — `ci-suite-coverage.test.ts`
      asserts a committed test file has a matching CI step in the same commit
      (`.planning/research/ARCHITECTURE.md:438`).

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` — treated as
enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface — internal container/host control-plane, unchanged trust model. |
| V3 Session Management | no | Not applicable — no session concept introduced. |
| V4 Access Control | no | Not applicable at this layer. |
| V5 Input Validation | yes | `normaliseHostToolRequest()`'s typed-allowlist discipline (`host-tool.mts:277-464`, READ-IN-SOURCE) — every new `ghidra.analyze` field must be added there with an explicit type check, never coerced, unknown keys refused by name. |
| V6 Cryptography | no | No new crypto surface — `digestOutputFile()`'s sha256 use is unchanged and pre-existing. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal / workspace escape via a new `scriptPath`/`preScriptArgs`/`postScriptArgs` wire field | Tampering / Elevation of Privilege | Route every new path-bearing field through `resolveWorkspacePath()` (`host-tool.mts:647-670`) — the SAME site every existing tool's path arguments use, including its symlink-aware ancestor-realpath walk (CR-05 fix). A non-path field like `processor` (a language-id STRING, not a path) does NOT go through this resolver — but must still be validated against a narrow, explicit pattern (mirroring `RUN_ID_PATTERN`'s anchored-regex discipline, `ghidra-project.mts:87`) rather than passed through unchecked, since it becomes a literal argv token handed to `analyzeHeadless`. |
| Argv injection via an unvalidated `processor`/`loaderBaseAddr` string | Tampering | `buildAnalyzeHeadlessArgv()` already builds argv as an array (never a shell string) passed to `spawn()` (never `spawnSync`, never shell-form) — `runHostTool()`'s own documented invariant (`host-tool.mts:1002-1004`, READ-IN-SOURCE: "argv is an ARRAY, never a shell string; the command interpreter is never enabled"). New fields must preserve this — append typed, validated array entries, never string-concatenate into an existing entry. |
| A malicious or malformed `.slaspec`/`.sinc` committed to the extension source tree | Tampering | Not a live threat model concern (source is authored/reviewed by this project, not caller-supplied at runtime) — but the `sleigh` compile gate itself is the correctness backstop: a broken extension source fails the gate before it ever reaches `analyzeHeadless`. |

## Sources

### Primary (HIGH confidence, MEASURED or READ-IN-SOURCE this session)
- `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/` — real Ghidra 12.1.3 install, inspected directly: `Ghidra/Processors/6502/data/languages/{6502.ldefs,6502.slaspec,65c02.slaspec,6502.pspec,6502.cspec}`, `support/{analyzeHeadless,sleigh}`.
- `javap -p [-constants]` against `Decompiler.jar`'s `DecompileResults.class`, `SoftwareModeling.jar`'s `PcodeOp.class` and `RefType.class` — this session, real class files from the real Ghidra 12.1.3 install.
- `src/mcp/vice/host-tool.mts` (1565 lines, read in full this session) — the shipped `ghidra.analyze` host-tool seam.
- `src/mcp/vice/ghidra-project.mts` (336 lines, read in full this session) — the shipped dot-segment rule, per-run project reservation, and `buildAnalyzeHeadlessArgv()`.
- `src/mcp/vice/dxa-run.ts` — the worked container-side-orchestrator analog.
- `src/mcp/vice/test-gate.test.ts`, `host-scripts.test.ts`, `docs-dangling-refs.test.ts` — guard tests, read this session to confirm current constants/scope.
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/{FlatVolatile.java,ExportAnalysis23.java}` — read in full this session.
- `.planning/notes/dxa-ghidra-pivot-evidence/bank.a` — read in full this session.
- `docs/undocumented-opcodes-ghidra.md` — the committed SLEIGH extension source, read in relevant part this session.
- `.planning/research/{STACK,PITFALLS,ARCHITECTURE,SUMMARY}.md` — this milestone's own MEASURED research corpus, cited by file:line throughout (not re-derived).
- `docs/phase23-real-release-gate-findings.md`, `docs/phase33-reproducible-run-gate-findings.md`, `docs/phase34-host-tool-seam-decisions.md` — this milestone's recorded harness/corpus/seam evidence.

### Secondary (MEDIUM confidence)
- None beyond the above — no web search was used; the ROADMAP directive to prefer this repo's own committed evidence over web search was followed throughout, and no gap required an external lookup.

## Metadata

**Confidence breakdown:**
- SLEIGH compile fix and language-extension shape: HIGH — MEASURED twice independently, carried verbatim, cross-checked against real Ghidra directory listings this session.
- Host-tool seam extension (the gap this document surfaces): HIGH — read the current implementation in full this session; the absence of `-processor`/`-loader`/`-scriptPath`/`-noanalysis`/script-args is a direct, verifiable fact, not an inference.
- `DecompInterface`/`DataTypeManager` API surface: HIGH — verified via `javap` against the real installed jars this session.
- Extension-install ownership (who materialises the extension into `$GHIDRA_HOME`): MEDIUM — flagged as Open Question 1, not resolved by existing research.

**Research date:** 2026-09-04
**Valid until:** Ghidra version-pinned facts (12.1.3-specific line numbers, class signatures)
are valid until the next Ghidra upgrade; the host-tool seam facts are valid until Phase 34's
modules are next modified. Re-verify before use if either has changed.
