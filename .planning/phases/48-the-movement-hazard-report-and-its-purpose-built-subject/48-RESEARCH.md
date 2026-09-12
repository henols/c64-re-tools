# Phase 48: The Movement-Hazard Report and Its Purpose-Built Subject - Research

**Researched:** 2026-09-12
**Domain:** Static hazard detection over 6502/C64 machine code (indexed dispatch tables, self-modifying code, page-alignment dependence, cycle-exact raster code) plus a purpose-built ACME fixture exercising all four, read through this project's own `.annostore` substrate
**Confidence:** MEDIUM — the existing-code-surface findings are HIGH (read at source, this session); the four-class variant taxonomy is MEDIUM/LOW by nature — the ROADMAP states plainly that no transferable prior art exists for three of the four classes, so the taxonomy below is domain reasoning, not a verified algorithm

## Summary

Phase 48 is two deliverables reviewed together: a synthetic ACME subject that
deliberately carries all four movement-hazard classes, and a read-only report
that finds them. Class 1 (indexed jump tables, including the RTS-trick) is
**not new work** — `scanIndirectDispatch()` in `src/mcp/vice/anno-coverage.ts`
already implements it, survived a real false-positive incident (CR-04), and is
to be imported, not re-derived (single-call-site test required by criterion
3). Classes 2–4 (self-modifying code, page-alignment dependence, cycle-exact
raster code) have no detector anywhere in this codebase and, per the
ROADMAP's own research flag, no transferable prior art exists for any of the
three — this is genuinely new domain analysis, not integration.

The report itself has a strong, already-shipped architectural precedent to
copy rather than invent: `evid-reconcile.ts`'s `reconcileObservedExecution()`
(EVID-03/04) is a pure function over two already-fetched inputs, opens no
store, writes nothing, and reports a named third/fourth bucket rather than
folding absence into a verdict — read-only-by-construction is asserted by a
source-text grep test in `anno-coverage.test.ts` (`"the coverage module
contains no file-write call..."`, line 4665) that the new hazard-report module
should copy verbatim in shape. `dxa-proof01-compare.ts`'s
`compareByteDerivedRecovery()` is the second precedent, and the closer match
for criterion 5's per-fixture cross-check: it returns `recovered` / `missed` /
`unclassifiedOverlap` counts with addresses, an explicit denominator, and a
named positive class — never a boolean — which is the exact shape criterion 4
demands ("a boolean clean/dirty report shape is refused by test").

The three committed fixtures named in criterion 5 (`tracer.prg`, `bank.prg`,
`smc.prg`) are genuinely useful as an *independent* cross-check, but not for
the reason their names suggest at a glance: none of them was authored for
Phase 48, all three predate any Phase 48 code (Phases 30, 35 and 36
respectively — 2026-08-29 to 2026-09-05, weeks before the Phase 48 open on
2026-09-10), and their content does not map one-to-one onto the four hazard
classes. `tracer.prg` is a trivial border-colour routine with no dispatch
table, no SMC and no alignment dependency — read at source this session, it is
best understood as a **negative control** all four detectors must stay silent
on, not a positive example of any class. `bank.prg` exercises `$01` CPU-port
bank-switching (the zero-page value changes what a fixed address *means*),
which is adjacent to but **not the same claim** as "page-alignment
dependence" (an address whose validity depends on its own 256-byte-page
position) — the planner should decide explicitly which reading `bank.prg`
serves before wiring it into the cross-check table, rather than assuming it is
a page-alignment positive example. `smc.prg` is the one fixture that
positively exercises a hazard class, and its **current, post-Phase-45**
annotation (read at source this session) already shows the discipline the
detector must respect: Phase 45 explicitly **declined** to name the
self-modified operand byte with a symbol (a `DECLINED` comment, not a label),
because its value varies per iteration. A detector that expects an
annotation-level marker for SMC will find nothing on this fixture; it must
derive the finding from the decoded byte stream, not from store labels.

`anno_evid_exec` (the runtime evidence table) and the `.annostore` schema are
not to be extended — `SCHEMA_VERSION` stays at **5** (`anno-store.ts:267-270`,
read this session), and the report must be a pure query over data the caller
already fetched, following the `reconcileObservedExecution()` shape exactly.

**Primary recommendation:** Build a new pure module (e.g.
`anno-hazard-report.ts`) shaped exactly like `evid-reconcile.ts` /
`dxa-proof01-compare.ts` — take already-fetched symbols, comments, ranges,
cross-references, `IndirectDispatchScan` (from `scanIndirectDispatch()`, one
new call site) and (optionally) `EvidExecRow[]` as plain arguments; derive
class-2/3/4 findings from the decoded instruction stream using the same
primitives `anno-coverage.ts` already exposes (`decode()`, `Instruction`,
`zeroPageStoreTarget`-style operand inspection); emit one finding per hazard
occurrence carrying `class`, `mechanism`, `confidence`, and default every
undecidable region to `"unclassified"` rather than `"clean"`. Resolve the
CONFIDENCE_GRADES-vs-new-vocabulary tension (below) explicitly before writing
code — `anno-coverage.ts`'s own header forbids a second confidence vocabulary
in that file, and it is an open question whether that constraint is
file-scoped or project-wide.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-04 | A hazard report enumerates what blocks movement across four classes — indexed jump tables including the RTS-trick idiom, self-modifying code, page-alignment dependence, and cycle-exact raster code. It reports and never acts. The purpose-built synthetic subject carrying all four classes is delivered in this same phase, so fixture and detector are reviewed together against a non-vacuity bar rather than the fixture being written to match the detector. | The **Variant Taxonomy Per Hazard Class** section supplies the per-class textbook/non-canonical framing criterion 1 requires; **Standard Stack**/**Don't Hand-Roll** identify `scanIndirectDispatch()` as the required class-1 reuse (criterion 3) and the read-only report shape (criterion 2); **Confidence and the `unclassified` Third Outcome** and **Read-Only / No-Write Constraint** address criteria 2 and 4 directly; **Existing Committed Fixtures — Provenance** and its cross-check pattern address criterion 5; **Phase 47 Multi-File Export Path** addresses criterion 1's reassembly requirement |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Purpose-built ACME subject (source + assembled `.prg`) | Build/fixture tier (`acme-build` skill + `src/mcp/vice/fixtures/`) | Annotation tier (must be decomposed into `.annostore` before export) | A committed synthetic program is a build artifact; it only becomes hazard-report input once annotated |
| Class-1 detection (indexed dispatch, RTS-trick) | Analysis/library tier (`anno-coverage.ts`) | — | Already lives here; reused, not re-derived |
| Class-2/3/4 detection (SMC, page-alignment, cycle-exact raster) | Analysis/library tier (new pure module) | — | New static analysis over decoded bytes; no store write, no transport |
| Hazard report assembly (the read-only computed query) | Analysis/library tier (new pure module, `evid-reconcile.ts`-shaped) | — | Must open no new store table (Out-of-Scope row, `REQUIREMENTS.md:130`) |
| MCP/CLI surface for the report | MCP surface tier (`anno-tools.ts`, `anno-cli.ts`, `anno-register.ts`) | Skill tier (a shipped skill's routing table) | Four registration sites, precedent: `anno_evid_disagreements` / `anno_exclude_range` |
| Assembly + reassembly verification | Host-tool execution seam (`host-tool.mts`'s `acme.build`) | — | `runHostTool()` is the only route to ACME; never a second `spawnSync` |
| "Runs in VICE with visible on-screen behaviour" | Emulator tier (VICE MCP tools, out of this repo's own analysis code) | — | Verification-time only; this phase's code does not drive VICE, a human/skill session does |

## Standard Stack

No new libraries. This phase is explicitly barred from adding npm runtime
dependencies or host prerequisites (`REQUIREMENTS.md` → Out of Scope: *"New
npm runtime dependencies and new host prerequisites... every capability is
reachable by extending code this project already owns"* — `REQUIREMENTS.md:129`,
read this session). No Package Legitimacy Audit is required; no packages are
installed.

### Core (existing, reused)
| Module | Symbol | Purpose | Why this one |
|---|---|---|---|
| `src/mcp/vice/anno-coverage.ts` | `scanIndirectDispatch()` (exported, line 967) | Detects class-1 (indexed dispatch incl. RTS-trick) from raw bytes + decoded instructions | `[VERIFIED: src/mcp/vice/anno-coverage.ts:967-971]` — `export function scanIndirectDispatch(instructions: readonly Instruction[], bytes: Uint8Array, origin: number): IndirectDispatchScan` — already survived CR-04 (a real false-positive incident) and carries a mechanically-enforced closed shape list (`DISPATCH_CONTEXT_SHAPES`) plus negative controls |
| `src/mcp/vice/anno-coverage.ts` | `splitTableCandidates` (field on `IndirectDispatchScan`, line 650) | The "unproven, flagged" bucket for ungated split lo/hi pairings | `[VERIFIED: src/mcp/vice/anno-coverage.ts:637-650]` — quoted in full below |
| `src/mcp/vice/evid-reconcile.ts` | `reconcileObservedExecution()` | The precedent shape for "read-only computed query over existing tables, no new store table" | `[VERIFIED: src/mcp/vice/evid-reconcile.ts:2-46]` header, read this session |
| `src/mcp/vice/dxa-proof01-compare.ts` | `compareByteDerivedRecovery()` | The precedent shape for a three-outcome (never boolean) per-fixture cross-check | `[VERIFIED: src/mcp/vice/dxa-proof01-compare.ts:78-152]` |
| `src/mcp/vice/anno-confidence.ts` | `CONFIDENCE_GRADES` | The **one** existing confidence vocabulary in this codebase | `[VERIFIED: src/mcp/vice/anno-confidence.ts:81-113]`, quoted below |
| `src/mcp/vice/anno-store.ts` | `listRanges`, `listLabels`, `listComments`, `listXrefs`, `listExecObservations` | The existing read query layer over `.annostore` tables | `[VERIFIED: src/mcp/vice/anno-cli.ts:148]` import list |
| `src/mcp/vice/disasm-decoder.ts` | `decode()`, `Instruction` | Byte-level decode primitive `scanIndirectDispatch()` and the census both already use | `[VERIFIED: src/mcp/vice/anno-coverage.ts:142]` import |
| `src/skills/acme-build/scripts/acme.mjs` | `new` / `build` / `sym` verbs | Assembles the purpose-built subject | `[VERIFIED: src/skills/acme-build/SKILL.md:10-16]` |
| `src/mcp/vice/anno-export-asm.ts` | `exportAsm()` (Phase 47 multi-file export) | Turns the subject's `.annostore` into a tree the reassembly criterion re-runs | `[VERIFIED: src/mcp/vice/anno-export-asm.ts]` header, read this session (mid-instruction label handling at lines 1447-1553) |

### Supporting (existing, read this session)
| Module | Symbol | Purpose |
|---|---|---|
| `src/mcp/vice/anno-types.ts` | `XREF_ACCESS_KINDS` (line 463) | `["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"]` — a real, existing vocabulary for cross-reference access kind; **not** auto-populated (see Don't Hand-Roll) |
| `src/mcp/vice/block-class.ts` | `blockClassAt`, `BlockClass` | The neutral `"code" \| "data" \| "undefined"` comparison boundary the census already uses |
| `src/mcp/vice/host-tool.mts` | `acme.build` allowlist entry | The only route to spawn ACME |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `CONFIDENCE_GRADES` for per-finding hazard confidence | A new, hazard-report-local confidence scale (e.g. `HIGH`/`MEDIUM`/`LOW` detection certainty) | `CONFIDENCE_GRADES` answers "is this code or data" (a classification axis); hazard confidence answers "how sure is the detector this specific finding is real" — a different axis wearing similar words. `anno-coverage.ts`'s own header (line 85-87) states "NEVER define a second confidence vocabulary... that module's own header forbids a second spelling," which reads as a project-wide rule. This is a genuine open question for the planner, not a research-settled one — see Open Questions |
| Deriving `scanIndirectDispatch()`'s inputs directly | Calling `buildCoverageReport()` and reading `.dispatch` off its result | `buildCoverageReport()` bundles seed-derivation and census logic the hazard report does not need and could not meet criterion 2's "opens no new store table" test as cleanly if it inherits an unrelated code path. Calling `scanIndirectDispatch()` directly, once, is the narrower and more testable route, and is what criterion 3's single-call-site test implies |

**Installation:** none — no new packages.

## Package Legitimacy Audit

Not applicable. This phase adds zero npm runtime dependencies and zero host
prerequisites (explicit Out-of-Scope row, `REQUIREMENTS.md:129`, read this
session). No packages are installed; no audit is required.

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────────┐
                    │  Purpose-built subject (new)             │
                    │  hazard-subject.a  →  acme.build  →      │
                    │  hazard-subject.prg  (committed)         │
                    └───────────────┬───────────────────────────┘
                                    │ decompose (Phase 45 discipline:
                                    │ anno_set_data_type / anno_set_label /
                                    │ anno_set_comment, per-class documented)
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  hazard-subject.annostore (SQLite)       │
                    │  anno_range / anno_label / anno_comment  │
                    │  anno_xref / anno_evid_exec (unchanged   │
                    │  schema, SCHEMA_VERSION 5)                │
                    └───────────────┬───────────────────────────┘
                                    │ read-only fetch (existing anno_get_* /
                                    │ listRanges / listLabels / listXrefs /
                                    │ listExecObservations)
                                    ▼
              ┌─────────────────────────────────────────────────────┐
              │  Hazard report module (NEW, pure function)           │
              │                                                       │
              │  scanIndirectDispatch()  ──▶ class 1 findings         │
              │  (imported, ONE call site — criterion 3)              │
              │                                                       │
              │  new class-2 detector (SMC)     ──▶ class 2 findings  │
              │  new class-3 detector (page-align) ──▶ class 3        │
              │  new class-4 detector (raster)   ──▶ class 4 findings │
              │                                                       │
              │  every finding: {class, mechanism, confidence}        │
              │  every undecided region: "unclassified" (never clean) │
              │                                                       │
              │  anno_evid_exec observations: STRENGTHEN only,        │
              │  never suppress (evid-reconcile.ts's own discipline)  │
              └───────────────┬───────────────────────────────────────┘
                              │ result (in-memory, never written back)
                              ▼
              ┌─────────────────────────────────────────────────────┐
              │  Cross-check against tracer.prg / bank.prg / smc.prg  │
              │  (independently-sourced: authored Phases 30/35/36,    │
              │  weeks before Phase 48 existed)                       │
              │  per fixture: detected / missed / false-positive      │
              │  (compareByteDerivedRecovery()-shaped, never boolean) │
              └─────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/mcp/vice/
├── anno-hazard-report.ts        # NEW — the pure module (naming: planner's choice)
├── anno-hazard-report.test.ts   # co-located, per project convention
├── anno-coverage.ts             # UNCHANGED — scanIndirectDispatch() imported, not modified
├── evid-reconcile.ts            # UNCHANGED — the shape precedent
├── anno-tools.ts                # + new anno_hazard_report tool definition/dispatch
├── anno-cli.ts                  # + new CLI verb
├── anno-register.ts             # + new AnnoVerbRegisterEntry
└── fixtures/
    └── hazard-subject/           # NEW — the purpose-built synthetic subject
        ├── hazard-subject.a       # ACME source (or a Phase-47-style multi-file tree)
        ├── hazard-subject.prg     # committed assembled output
        ├── hazard-subject.annostore.json  # committed store export (Phase 45 pattern)
        └── FIXTURE-DESIGN.md      # criterion 1's per-class variant rationale document
```

### Pattern 1: Read-only computed query, no new store table
**What:** A pure function taking already-fetched data (ranges, labels,
comments, xrefs, dispatch scan, exec observations) and returning a report
object. No `openStore()` call, no write function imported, no file write.
**When to use:** Any report that must satisfy "opens no new store table,
writes nothing" (criterion 2).
**Example (the exact precedent to copy):**
```typescript
// Source: src/mcp/vice/evid-reconcile.ts (read this session, header lines 2-46)
// "NEVER fetch either side here. `blocks` and `observations` arrive as
//  plain data the caller already fetched ... this module never opens a
//  store, reaches a transport, or names a filesystem/child-process
//  specifier. A structural source assertion in this module's own test
//  file bars exactly that."
export function reconcileObservedExecution(input: {
  blocks: readonly BlockEntry[];
  observations: readonly EvidExecRow[];
}): ReconciliationResult { /* pure join, no I/O */ }
```
The hazard-report module should read:
```typescript
export function buildHazardReport(input: {
  bytes: Uint8Array;
  origin: number;
  symbols: readonly AnnoSymbol[];
  comments: readonly AnnoComment[];
  ranges: readonly BlockEntry[];
  xrefs: readonly XrefRow[];
  execObservations?: readonly EvidExecRow[];
}): HazardReport { /* calls scanIndirectDispatch() once; runs 3 new detectors; never writes */ }
```

### Pattern 2: Three-outcome cross-check, never a boolean
**What:** For each independently-sourced fixture, record `detected` /
`missed` / `falsePositive` counts and address lists, with an explicit
denominator — never a pass/fail boolean.
**When to use:** Criterion 5's per-fixture detector validation.
**Example:**
```typescript
// Source: src/mcp/vice/dxa-proof01-compare.ts (read this session, lines 78-152)
export interface Proof01Comparison {
  denominator: number;
  recovered: number;
  missed: number;
  unclassifiedOverlap: number;   // a THIRD bucket, never folded into either
  recoveredAddresses: number[];
  missedAddresses: number[];
  overlapAddresses: number[];
  positiveClass: "data";
}
```
Map this onto criterion 5 as `{detected, missed, falsePositive}` with
addresses, per class, per fixture — a `falsePositive` count on `tracer.prg`
(the fixture this research reads as a negative control across all four
classes) is the single most important number the cross-check produces.

### Pattern 3: Single-call-site enforcement (for criterion 3's reuse test)
**What:** A test that greps the whole non-test source tree for a function's
call sites and asserts an exact count, so a second implementation cannot
silently appear.
**Example (the exact precedent to copy):**
```typescript
// Source: src/mcp/vice/stock-reproducible-run.test.ts (read this session, comment at line 886)
// "8. runReproducible() is reached from exactly one call site"
```
Today `scanIndirectDispatch(` has exactly one call site outside its own
test files: `anno-coverage.ts`'s `buildCoverageReport()`
(`[VERIFIED: src/mcp/vice/anno-coverage.ts:2324]`, `const dispatch =
scanIndirectDispatch(linear, loaded.bytes, loaded.origin);`). Adding the
hazard report's own call site makes the correct asserted count **2**, not
**1** — the planner must decide whether the test asserts "exactly one call
site outside `anno-coverage.ts`" or "exactly two call sites project-wide,"
and either is defensible, but the test must name the count explicitly rather
than assert `<= 1` (which would silently pass forever after the count moves
to 2 for the wrong reason).

### Mid-instruction label / SMC operand naming — read at source, not assumed
`anno-export-asm.ts` already computes, for export rendering, which user
labels sit strictly inside a decoded instruction's byte range
(`midInstructionLabelAddresses`, `[VERIFIED: src/mcp/vice/anno-export-asm.ts:1447-1553]`).
This is a **rendering** concern (how to spell a label inline in `.a` source),
not a hazard-detection primitive, and it must not be read as one: Phase 45's
own decomposition of the current `smc.prg` fixture **declined** to name the
self-modified operand with a label at all. Read this session, verbatim, from
`src/mcp/vice/fixtures/export-asm/smc.annostore.json`:
```json
{
  "address": 2050,
  "commentType": "line",
  "text": "DECLINED: this is smc.prg's own self-modified operand byte -- the immediate operand of the LDA #$00 at $0801, rewritten in place by INC $0802 every loop iteration. Its effective value varies per iteration by construction (0, 1, 2, ... wrapping at 256) and there is no single correct symbol or value to name here -- see export-asm/README.md.",
  "provenance": "authored"
}
```
and the ranges around it:
```json
{"start": 2049, "endInclusive": 2050, "dataType": "code", "provenance": "derived"},
{"start": 2051, "endInclusive": 2053, "dataType": "code", "provenance": "derived"}
```
**Implication:** the class-2 (SMC) detector cannot rely on an annotation-level
marker (a label, a grade comment) being present — the correctly-decomposed
fixture has none. It must derive the finding from the **decoded byte stream
itself**: a store/read-modify-write instruction (`STA`/`STX`/`STY`/`INC`/
`DEC`/`ASL`/`LSR`/`ROL`/`ROR`) whose target address falls **inside** the
byte-range of any decoded instruction (its own or another's) is the
structural signal — the same "does a value land inside an already-decoded
instruction's byte range" question `scanIndirectDispatch()`'s own
`isPlausibleEntryPoint()` helper already asks in the opposite direction (is
X the *start* of an instruction) at `[VERIFIED: src/mcp/vice/anno-coverage.ts:998-1019]`.

### `anno_xref`'s `WRITE`/`COMPUTED_JUMP` access kinds exist, but are never auto-populated
Read this session at `[VERIFIED: src/mcp/vice/anno-types.ts:463]`:
```typescript
export const XREF_ACCESS_KINDS = Object.freeze(["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"] as const);
```
This is a real, already-typed vocabulary that would be a natural fit for both
class-1 (`COMPUTED_JUMP`) and class-2 (`WRITE`/`READ_WRITE`) hazard evidence —
**but** `putXref()`'s own header (`[VERIFIED: src/mcp/vice/anno-store.ts:3930-3953]`)
states plainly: *"nothing derivable is ever written here... the only rows
ever written here are references that CANNOT be recovered from the bytes —
hand-asserted, or resolved from something outside the program image."* Cross-checked
against the real fixture: `smc.annostore.json`'s `xrefs` array is `[]` (empty,
read this session). **The hazard report cannot depend on `anno_xref` rows
existing** for SMC or dispatch evidence on an ordinary fixture; it may
optionally *read* them where present (a hand-asserted `COMPUTED_JUMP` xref
would be corroborating evidence, exactly like `anno_evid_exec` — strengthen,
never require).

### Anti-Patterns to Avoid
- **Treating a store label/comment as the SMC detection signal.** Refuted by the current `smc.prg` fixture, which correctly has none (see above). Detect from bytes.
- **Emitting a boolean `clean`/`dirty` report shape.** Explicitly refused by criterion 4's own text and by this project's two closest precedents (`coverageFindings()`'s `{clean, findings}` — which is itself a *count*, not a single boolean gate — and `compareByteDerivedRecovery()`'s three-bucket shape). The `unclassified` outcome must be a real, reachable third state, not a derived absence.
- **Defining a second confidence vocabulary without addressing the existing one.** See Open Questions.
- **Assuming `tracer.prg` is a positive example of any hazard class.** Read at source this session, it is a two-instruction border-colour routine reached from a BASIC stub — no dispatch table, no SMC, no alignment dependency. Wire it in as a negative control, not a positive fixture, unless the planner finds content this research missed.
- **Reading `bank.prg` as the page-alignment positive fixture without a stated decision.** It exercises `$01` CPU-port bank-switching, a different (though address-space-adjacent) concept from 256-byte page-alignment dependence. State the mapping explicitly in the fixture design document rather than assuming it by name similarity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Indexed jump table / RTS-trick detection | A second static scanner | `scanIndirectDispatch()`, imported | Already exists, already survived a real false-positive incident (CR-04), explicitly named in the ROADMAP as reuse-not-rebuild |
| Confidence-graded findings | A silent third confidence spelling | Either extend `CONFIDENCE_GRADES` deliberately, or get an explicit planning decision to add a second, differently-named vocabulary | `anno-coverage.ts`'s own header states the project rule; violating it silently is the exact drift class this project's "single seam per concern" convention exists to prevent |
| A new `.annostore` table for hazard findings | `anno_hazard_finding` table + migration | A derived report over existing tables, following `reconcileObservedExecution()`'s pattern | Explicit Out-of-Scope row: *"A store table for the hazard report... It is a derived query over existing tables"* (`REQUIREMENTS.md:130`) |
| Spawning ACME for the subject build/verify | A second `spawnSync`/`execFile` site | `runHostTool()`'s `acme.build` allowlist entry, via `acme-build`'s `acme.mjs` or the same seam Phase 49's gate will use | `scripts/check-no-skill-external-spawn.mjs` is observed biting on planted violations; a fourth spawn site is explicitly banned in Phase 49's own notes and the same discipline applies here |

**Key insight:** every reusable primitive this phase needs (decode, census,
dispatch scan, confidence vocabulary, read-only query shape, three-outcome
comparison shape, host-tool spawn seam) already exists in this codebase.
Nothing here should be reached for a second time; the actual new work is
three detector *algorithms* (SMC, page-alignment, raster) applied to bytes
this project already knows how to decode.

## Variant Taxonomy Per Hazard Class

**Confidence on this whole section: MEDIUM for class 1 (grounded in this
project's own shipped code), LOW/MEDIUM for classes 2-4 (general 6502/C64
domain knowledge, `[CITED]` where a specific source was checked this session,
`[ASSUMED]` where it is synthesis without an external check).** The ROADMAP is
explicit that no transferable prior art exists for classes 2-4 — this
taxonomy is the "written before implementation" deliverable the ROADMAP asks
for, not a validated algorithm.

### Class 1: Indexed jump table, including the RTS-trick idiom

**Already detected** by `scanIndirectDispatch()`. Four sub-shapes exist in the
shipped code today, each with its own finding collection
(`[VERIFIED: src/mcp/vice/anno-coverage.ts:630-664]`):
1. `indirectJumps` — a real `jmp ($nnnn)`, including the zero-page-vector case upstream misses entirely.
2. `multiEntryTables` — a multi-entry dispatch table an indirect jump names.
3. `splitTables` (PROVEN) / `splitTableCandidates` (ADVISORY, unproven) — split lo/hi address-table pairs, gated by `hasDispatchContext()` on one of exactly two accepted shapes (`DISPATCH_CONTEXT_SHAPES`, `[VERIFIED: anno-coverage.ts:761-764]`): `"stack-return-push-idiom"` and `"zeropage-vector-jumped-through"`.
4. `stackReturnDispatch` — **the RTS-trick idiom itself**: `indexed load : pha : indexed load : pha : rts`, matched as a five-instruction shape (`[VERIFIED: anno-coverage.ts:840-853]`).

**Textbook variant (general knowledge, `[CITED: nesdev.org "RTS Trick"]`):**
push high byte then low byte **minus one** from a split lo/hi table, then
`rts` — exploiting that RTS resumes at `pulled address + 1`. Every table
entry must be pre-adjusted by −1, and this off-by-one is exactly what the old
v0.5.0 requirement text called out by name (*"the RTS-trick idiom's off-by-one
bias recorded explicitly"*, `milestones/v0.5.0-ROADMAP.md:339`).

**Non-canonical variant the purpose-built subject should plant:** a variant
that still satisfies `hasDispatchContext()`'s exact five-instruction window
but is **not shaped like the existing test suite's fixtures** — e.g. indexing
through `Y` instead of `X` (the code is register-agnostic per
`indexRegisterOf()`, `[VERIFIED: anno-coverage.ts:673-677]`, but every shipped
test fixture this research sampled uses one register consistently — verify
against the actual fixture corpus at plan time rather than assume), or a
table whose entries are **not** contiguous with the dispatch code (stored in
a separate scope/file, which Phase 47's multi-file export must still resolve
across file boundaries). A genuinely interesting non-canonical stress case:
a **jump table that is itself split across two files** post-Phase-47-export
(paired hi/lo symbols, per `ROADMAP.md:1123`'s note on Phase 47), since that
tests both the detector and the multi-file reassembly criterion together.

**Named limit:** `hasDispatchContext()`'s shape list is deliberately closed
(two shapes) and mechanically pinned — a third real-world RTS-trick
construction that does not match either accepted shape will **not** be
promoted to `splitTables`; it lands in `splitTableCandidates` instead
(advisory, unproven). This is by design (CR-04's lesson), and the fixture's
design document should state which of the two shapes its own RTS-trick
instance satisfies, and why a plausible third real-world shape would
correctly decline rather than false-positive.

### Class 2: Self-modifying code

**No existing detector.** General technique (`[CITED: 6502.org forum "Self
modifying code"; wilsonminesco.com/SelfModCode/`]`, both checked this
session): a store or read-modify-write instruction whose target address
falls inside the byte range of a decoded instruction is self-modifying code.
This project's own v0.5.0 requirement text names exactly this signal:
*"self-modifying-code write-targets landing inside `Code` blocks"*
(`milestones/v0.5.0-ROADMAP.md:339`, `[VERIFIED]`, read this session).

**Textbook variant:** direct absolute/zero-page addressing, operand-byte
patch — `inc smc_operand` / `sta target_op+1`, changing an **operand**
(immediate value or address) of a subsequent instruction. This is exactly
what the current `smc.a`/`smc.prg` fixture does (`INC $0802` rewriting the
immediate operand of `LDA #$00` at `$0801`, read at source this session) —
**already the textbook idiom**, so the purpose-built subject's SMC instance
should deliberately be something else, per criterion 1's "why it is not the
textbook idiom" requirement.

**Non-canonical variants to consider for the new subject** (all `[ASSUMED]`,
general synthesis from the cited forum sources plus this project's own
detection-signal reasoning):
- **Opcode-byte patch rather than operand-byte patch** — overwriting the
  opcode itself (e.g. toggling a branch's condition, or writing `$60` (RTS)
  mid-routine to shorten a loop) changes *control flow*, not a data value.
  Structurally identical write-into-code-range signal, but the target byte
  is an opcode position rather than an operand position — a detector that
  only checks "did a store hit an operand byte" would miss this.
- **Indirect-indexed store into code** — `sta (zp),y` where the pointer at
  `zp` was computed at runtime to point somewhere in the code range, rather
  than `sta absolute` with a literal, symbolic-looking target. The literal
  target address is not present anywhere in the instruction stream as an
  operand, which is exactly the kind of case a naive "does this STA's
  operand fall in code" check would miss and a genuine false-negative for
  any static detector — flag this as a named limit rather than silently
  passing it.
- **Self-modification across a JSR/RTS boundary** (a subroutine patches an
  instruction in its *caller*, or in a routine it does not itself contain) —
  tests whether the detector's "falls inside a decoded instruction" check is
  scoped to the whole image or only to some local window.

**Named limit:** indirect-indexed self-modification (`sta (zp),y` with a
runtime-computed pointer) has no static operand to match against — this is
structurally the same class of gap that makes cycle-exact raster detection
unownable, and should be named in the report's own limits, not silently
absent.

### Class 3: Page-alignment dependence

**No existing detector, and — checked this session — no further definition
anywhere in this project's own history.** Both the current (`REQUIREMENTS.md:63`)
and the original v0.5.0 (`milestones/v0.5.0-ROADMAP.md:339`) requirement text
use the bare phrase "page-alignment dependence" with no elaboration. This is
a genuinely open definitional question, not merely an open implementation
question — flagged for the planner rather than resolved here.

**Two plausible readings, both `[ASSUMED]`, general C64 domain knowledge:**

1. **VIC-II hardware alignment requirement** (`[CITED: dustlayer.com "VIC-II
   for Beginners Part 5"; devili.iki.fi "Sprite Pointers"`], checked this
   session): sprite shape data must sit on a 64-byte boundary (sprite
   pointer registers `$07f8`-`$07ff` store `address / 64`); the character set
   must sit on a 2K boundary within the current 16K VIC-II bank. Relocating
   sprite/charset data to an address that does not satisfy this alignment
   silently breaks the graphics — the VIC-II reads the wrong bytes with no
   error signal. **This directly matches criterion 1's own list of required
   subject content — "sprite, charset, level and music tables" — so this
   reading has the advantage of being exercisable by the same data the
   subject must carry anyway.**
2. **Code/data alignment assumption for a cycle or byte-count optimization**
   (`[ASSUMED]`, general 6502 idiom): a table whose base address's low byte
   is `$00` (or otherwise page-aligned) so that code can hardcode or omit the
   high byte, or so an indexed access never crosses a page boundary (which
   would otherwise cost an extra cycle on 6502 indexed addressing modes).
   Moving such a table off its page changes behaviour or timing that the
   surrounding code silently assumed. This reading is closer to a *movement*
   hazard in the strict sense (relocation breaks it) but has no committed
   in-project fixture and would be entirely novel work to detect.

**Recommendation:** favour reading 1 for the fixture (it composes with the
required sprite/charset/level/music tables and produces an observable,
verifiable failure — "wrong sprite shows" or "garbled characters" — when
deliberately mis-aligned as a negative-control demonstration), while
documenting reading 2 as a real, separate hazard the report may also flag if
the planner chooses to scope it in. **This choice belongs in planning /
discuss-phase, not in this research document** — it was never settled by any
prior phase and both readings are defensible.

**`bank.prg`'s relevance, stated precisely:** its fixture comment reads *"the
SAME address means different things under different `$01`"*
(`[VERIFIED: src/mcp/vice/fixtures/ghidra/bank.a]`, read this session) — this
is CPU-port bank-switching (a temporal/state dependency on the `$01`
register), not a page-alignment (spatial/256-byte-boundary) dependency. It
should not be assumed to be the page-alignment cross-check fixture without
an explicit decision recorded in the fixture design document; it may instead
serve as a **negative control** for class 3 (a program with a real hardware
address-meaning hazard that is *not* the class-3 hazard, exercising that the
detector doesn't conflate the two).

### Class 4: Cycle-exact raster code

**No existing detector, and — per the ROADMAP's own text — "no static
algorithm... exists at all."** This is stated as a hard limit, not a gap to
close: *"Cycle-exact raster detection cannot be guaranteed and must not be
stated as if it could... state the limit beside the capability rather than
behind it"* (`ROADMAP.md:1158`).

**Textbook variant** (`[CITED: bumbershootsoft.wordpress.com "Stabilizing
the VIC-II Raster"; antimon.org/dl/c64/code/stable.txt; codebase64.net
"stable_raster_routine"`], all checked this session): the classic double-IRQ
stabilizer — a first raster IRQ at a known line sets up cycle-accurate entry
to a second IRQ one line later, then a NOP/branch sled compensates the
remaining 0-7 cycles of interrupt-entry jitter, reading `$D012` (and
sometimes comparing it against itself) to confirm alignment.

**Non-canonical variant to consider:** a CIA timer-based stabilization (using
`$DC04`/`$DC05` one-shot timer reload rather than comparing `$D012` directly)
achieves the same cycle-exact effect without referencing the raster register
at all in the hot path — `[ASSUMED]`, general synthesis; not independently
checked against a worked example this session, so treat as a direction to
verify at plan time rather than a confirmed idiom.

**What a detector can realistically do, given no algorithm exists:**
structural signature matching only — flag code that (a) writes `$D012`/`$D011`
from inside an IRQ handler reached via `$0314`/`$FFFE`, or (b) contains a
tight NOP/branch sequence immediately following a raster-register read/write
— as **hazard-adjacent**, with an explicitly bounded confidence and a
mandatory `unclassified` (never "verified cycle-exact") disposition for the
actual timing claim. `anno_evid_exec` observations (if the fixture was run
and its raster IRQ observed firing) may **strengthen** such a flag — e.g.
"this address was observed executing inside a real run" — but per criterion
5's own text, absence of an observation must never be read as "therefore not
cycle-exact" or "therefore safe to move." This is the same EVID-04 asymmetry
`evid-reconcile.ts` already enforces for the unrelated code/data question,
extended here to timing.

**Named limit, to state verbatim in the report's own output:** cycle-exact
correctness after relocation cannot be verified statically on the 6502
because indexed-addressing and branch-taken instructions cost an extra cycle
when they cross a page boundary — moving a raster routine's start address
can change which of its own instructions cross a page, silently altering its
total cycle count even though every opcode byte is unchanged. `[ASSUMED]`,
general 6502 timing fact, not independently re-derived this session, but
this **is** the mechanistic reason a "movement hazard" framing applies to
raster code at all (as opposed to graphics alignment or SMC, which fail for
different reasons) — flag it as a testable claim to verify at plan time if a
concrete worked timing example is wanted (e.g. cycle-count an absolute,X load
before and after shifting its base by one byte across a page boundary, in an
emulator or manually against the 6502 cycle-timing table).

## Existing Committed Fixtures — Provenance, Read This Session

| Fixture | Path | Size | Authored | Content (read at source) | Role for criterion 5 |
|---|---|---|---|---|---|
| `tracer.prg` | `src/mcp/vice/fixtures/dxa/tracer.prg` | 23 bytes | Phase 35, commit `1c276312` ("feat(35-01): wire dxa.disassemble through the host-tool seam end to end") | BASIC stub (`10 SYS 2064`) handing off to `$0810`: `LDA #$00 / STA $D020` — sets border colour black, nothing else | **Negative control** for all four classes — no dispatch table, no SMC, no alignment dependency |
| `bank.prg` | `src/mcp/vice/fixtures/ghidra/bank.prg` | 60 bytes | Phase 36, commit `9368ce23` ("feat(36-03): promote VolatileCarve.java and commit the bank fixture pair") | `$01` CPU-port bank-switching: same addresses (`$D000`, `$D020`) mean different things (Character ROM vs. VIC register vs. plain RAM) under different `$01` values | Adjacent to, but not literally, class 3 (page-alignment). Needs an explicit planner decision on its role — see Class 3 above |
| `smc.prg` | `src/mcp/vice/fixtures/export-asm/smc.prg` | 13 bytes | Phase 30, commit `46037885` ("feat(30-04): emit mid-instruction =*+$NN labels, proved on a self-modifying fixture") | `LDA #$00 / INC $0802 / STA $D020 / JMP $0801` — a genuinely self-modifying border-colour loop, `INC` rewriting `LDA`'s own immediate operand each iteration | **Positive example**, class 2 (SMC) — textbook operand-patch idiom |

All three predate Phase 48's 2026-09-10 open by 5-12 days and none was
written with any hazard-report detector in mind (they were built for dxa
vendoring, Ghidra volatile-I/O carving, and mid-instruction label export,
respectively) — this is what makes them genuinely "independently-sourced" for
criterion 5's cross-check, not merely committed-before-this-phase. The
cross-check's actual value comes from this independence, not from any of them
being designed as hazard-report test fixtures.

**Fourth existing fixture, not named in criterion 5 but present:**
`bank-path-dependent.prg`/`.a` (`src/mcp/vice/fixtures/ghidra/`, from the same
Phase 36/45 lineage) — a `$01`-value-dependent address whose target is
genuinely ambiguous, used in Phase 45 to demonstrate an explicit decline.
Not required by BUILD-04's text, but available if the planner wants a fourth
cross-check point.

## Confidence and the `unclassified` Third Outcome

**No existing structure in this repo carries a numeric or graded per-finding
confidence for a *hazard*.** Two existing, genuinely different things use the
word "confidence" or a tri-state disposition, and the planner must decide
which (if either) the hazard report should reuse:

1. **`CONFIDENCE_GRADES`** (`anno-confidence.ts`, `[VERIFIED]`, read this
   session) — five grades (`confirmed-code`, `probable-code`,
   `confirmed-data`, `probable-data`, `unknown`) answering "what does this
   *address* classify as." `anno-coverage.ts`'s own header states, verbatim
   (`[VERIFIED: anno-coverage.ts:85-87]`): *"NEVER define a second confidence
   vocabulary. `CONFIDENCE_GRADES` from `./anno-confidence.ts` is the only
   one; that module's own header forbids a second spelling."* This reads as
   a project-wide rule, not a file-scoped one, but it was written for a
   classification axis (code-vs-data), and hazard-detection confidence is
   "how sure is this specific static signal" — a different question. **This
   tension is unresolved by this research and should be an explicit planning
   decision**, not a silent choice either way.
2. **`c64-provenance-diff`'s verdict vocabulary** (`CRACKER-PATCH`, `UNKNOWN`,
   `HIGH`/`MEDIUM-HIGH` confidence — `[VERIFIED: src/skills/c64-provenance-diff/SKILL.md]`,
   read this session) — a different domain (provenance, not hazards), and
   explicitly out of this phase's scope (BUILD-05/07 own it).

**The `unclassified`/tri-state precedent that *is* directly reusable in
shape (not vocabulary) is `dxa-proof01-compare.ts`'s three-bucket design**
(recovered / missed / **unclassifiedOverlap**, `[VERIFIED, quoted above]`) —
an "overlapping decode is neither a recovery nor a miss; it is a distinct,
named outcome," which is exactly criterion 4's requirement that a region the
detectors cannot decide is reported as undecided, never as clean. Copy this
shape; it does not carry a confidence-vocabulary decision with it.

**Recommendation:** define the hazard report's per-finding confidence as its
own small, explicitly-scoped enum (e.g. `"observed"` when corroborated by
`anno_evid_exec`, `"static-strong"` for a fully-matched shape like the
existing `hasDispatchContext()` gate, `"static-weak"`/`"heuristic"` for a
structural-signature-only flag like the raster-register-write check), named
differently enough from `CONFIDENCE_GRADES`'s five tokens that the two are
never confused in a rendered comment — and record this as a deliberate,
reasoned departure from "the only vocabulary" rule if the planner goes this
route, rather than silently adding a same-shaped second spelling.

## Read-Only / No-Write Constraint — Structural Enforcement Points

The exact seams to test against, all read this session:

1. **Never import a write function.** `evid-reconcile.ts` never imports
   `putXref`, `applyWrite`, or `openStore` — its only imports are types. A
   structural test can assert the hazard-report module's own source text
   never contains `openStore(`, `applyWrite(`, `putXref(`, or any
   `insert into` / `update` / `delete` SQL fragment.
2. **The exact precedent test to copy**, `[VERIFIED: src/mcp/vice/anno-coverage.test.ts:4665]`:
   `test("the coverage module contains no file-write call, no project-save
   call and no live-session import", ...)` — reads the module's own source
   text and asserts the absence of `writeFileSync`, `renameSync`,
   `appendFileSync`, `save_project`, `anno-session.ts`. The hazard-report
   module's own test file should run the identical check against its own
   source text (`readFileSync(join(HERE, "anno-hazard-report.ts"), "utf8")`
   then scan for the same forbidden substrings plus `openStore`/`putXref`/
   `applyWrite`).
3. **No new `create table` in `anno-store.ts`'s `DDL`.** `SCHEMA_VERSION` is
   currently **5** (`[VERIFIED: src/mcp/vice/anno-store.ts:267-270]`, the
   `anno_excluded_range` table's own version-history comment). A structural
   test could additionally assert `SCHEMA_VERSION` is unchanged by this
   phase's diff, though the module-level no-write-import test above already
   makes a new table structurally unreachable from the report itself.
4. **Function signature discipline.** Every function in the new module
   should take plain data (arrays/objects) as parameters and never a store
   handle (`AnnoStoreHandle`) — mirroring `evid-reconcile.ts`'s
   `{ blocks, observations }` input shape and `dxa-proof01-compare.ts`'s
   `{ listing, groundTruth }` shape exactly.

## Acme Build Path and "Visible On-Screen Behaviour"

`[VERIFIED: src/skills/acme-build/SKILL.md]`, read this session:

- The only assembly route is `node src/skills/acme-build/scripts/acme.mjs
  build <file>.a`, which wraps `acme` through `host-tool.mts`'s `acme.build`
  allowlist entry — never a second `spawnSync` site (`SKILL.md:205-216`).
- Output: `.prg` (the program), `.sym` (all symbols), `.vs` (address labels
  for a debugger — load with `vice_symbols_load`, format `vice`), `.rep`
  (source-line-to-bytes map).
- "Visible on-screen behaviour" has a cheap, already-established convention
  in this project's own fixtures: every one of the three existing
  cross-check fixtures writes to `$D020` (VIC-II border colour) as its
  observable effect (`smc.a`: `STA $D020` in a loop; `bank.a`: `STA $D020`
  under two different bank states; `tracer`'s handoff routine: `STA
  $D020`). This is the cheapest possible "visible" signal (a colour change,
  readable either by eye in VICE or by reading `$D020` back through
  `vice_memory_get`) and is a reasonable default for the new subject's
  liveness check, though criterion 1 ("visible on-screen behaviour," plural
  tables including sprite/charset/level) implies something more elaborate
  than a border flash is actually wanted — likely a sprite moving and/or
  text rendering via the character set, given the required table list.
- Assembling and running the fixture in VICE (to observe the behaviour) is
  outside this repo's own static-analysis code — it is a skill/session-time
  verification step (the `vice_*` MCP tools), not something the hazard
  report or its detectors touch.

## Phase 47 Multi-File Export Path — What the Subject Must Satisfy

`[VERIFIED: .planning/ROADMAP.md:1085-1123]`, Phase 47's own success criteria
and notes, read this session — the multi-file export the subject must
reassemble through requires:

1. One `.a` file per annotation-store **scope**, plus a root file wiring
   them with bare-filename `!source`; `acme.build`'s spawn must set `cwd` to
   the output directory (already fixed in Phase 47; the subject's own build
   does not need to re-fix this, only to exercise it).
2. Data tables (sprite/charset/level/music, per criterion 1) go through the
   store's `external_file` type, emitted as their own file and referenced by
   `!binary` — meaning the subject's `.annostore` must actually type these
   ranges `external_file`, not merely `byte`/`word`.
3. Every branch/`JSR`/`JMP`/data reference resolves through a symbol,
   including across file boundaries — the subject's indexed jump table (if
   split across scopes) must have both halves resolvable post-split.
4. Split hi/lo address tables must emit **paired** names from one symbol per
   entry (`Phase 47 plan 47-06`, `[VERIFIED: ROADMAP.md:1115]`) — directly
   relevant if the class-1 hazard's split-table variant is planted across
   file boundaries as suggested above.
5. Two exports from an unchanged store must be byte-identical (drift guard)
   — applies to the subject's export exactly as to any other.

Because the subject is new, none of this has been exercised on it yet — this
is explicitly named as the "named cost of Strategy B" the ROADMAP records
(`ROADMAP.md:1532-1537`): Phase 47 ran its own criteria against the existing
fixtures, and Phase 48 must **re-run** the multi-file export over the new
subject as one of its own success criteria (criterion 1's "assembles under
real ACME... through the multi-file path").

## Common Pitfalls

### Pitfall 1: Reading fixture names as their hazard-class labels
**What goes wrong:** assuming `tracer.prg` demonstrates dispatch, `bank.prg`
demonstrates alignment, `smc.prg` demonstrates SMC, one-to-one, because the
directory names (`dxa/`, `ghidra/`, `export-asm/`) suggest a story.
**Why it happens:** the names are plausible and the ROADMAP text lists them
together with the four classes in the same sentence.
**How to avoid:** read every fixture's actual bytes and current
`.annostore.json` before wiring it into the cross-check table (this research
did so; the planner should verify no fixture has changed since).
**Warning signs:** a cross-check table with a `falsePositive` column that is
always 0 for every fixture/class pairing — check whether that is because the
detector is good, or because the fixture never actually exercised that class.

### Pitfall 2: Expecting a store-level marker for SMC
**What goes wrong:** writing a class-2 detector that looks for a label or a
specific comment pattern (e.g. "self-modif" in text), which will not fire on
the correctly-decomposed `smc.prg` fixture (its operand is `DECLINED`, not
named).
**Why it happens:** the mid-instruction label mechanism is a real, adjacent
feature (`anno-export-asm.ts`) and easy to mistake for a detection signal.
**How to avoid:** detect from the decoded byte stream (store/RMW instruction
target falls inside a decoded instruction's range), never from annotation
metadata.
**Warning signs:** the detector passes on a hand-crafted test fixture but
misses the real committed `smc.prg` — that mismatch is exactly what
criterion 5's cross-check exists to catch.

### Pitfall 3: Stating cycle-exact raster detection as solved
**What goes wrong:** the report (or its doc comment) implies "verified
cycle-exact" for a raster finding, when only a structural signature was
matched.
**Why it happens:** the temptation to make the fourth class look as complete
as the other three.
**How to avoid:** the report's own field for this class should read
something like `mechanism: "raster-register-write-signature"`,
`confidence: "heuristic"`, and the finding's own text should name the limit
(no static cycle-count verification) inline — matching the ROADMAP's own
instruction to "state the limit beside the capability rather than behind
it."
**Warning signs:** any test asserting the raster detector "confirms" or
"proves" timing correctness rather than "flags register-write pattern."

### Pitfall 4: A second confidence vocabulary that nobody decided to add
**What goes wrong:** a new `HazardConfidence` type ships beside
`CONFIDENCE_GRADES` with no record of the tradeoff, silently violating the
stated project rule.
**Why it happens:** the two concepts (code/data classification confidence vs.
hazard-detection confidence) are genuinely different axes and it is easy to
reach for a fresh enum without re-reading `anno-coverage.ts`'s header.
**How to avoid:** make the choice explicit in the plan, with a one-line
rationale, whichever way it goes.
**Warning signs:** a code review or `docs-constraints-sync`-style guard
flagging a second bracket-token or grade-like string that isn't one of the
five in `CONFIDENCE_GRADES`.

## Code Examples

### The exact shape of `IndirectDispatchScan` the hazard report will consume
```typescript
// Source: src/mcp/vice/anno-coverage.ts:630-664 (read this session)
export interface IndirectDispatchScan {
  indirectJumps: IndirectJumpFinding[];
  splitTables: SplitTableFinding[];              // PROVEN only
  multiEntryTables: DispatchTableFinding[];
  stackReturnDispatch: StackReturnFinding[];      // the RTS-trick idiom
  splitTableCandidates: SplitTableFinding[];      // ADVISORY -- carry through verbatim (criterion 3)
  discoveredTargets: number[];
  tableEntryAddresses: number[];
  truncated: boolean;
}
```

### The one call site to add
```typescript
// Precedent: src/mcp/vice/anno-coverage.ts:2323-2324 (read this session)
const linear = decode(loaded.bytes, loaded.origin);
const dispatch = scanIndirectDispatch(linear, loaded.bytes, loaded.origin);
```
The hazard report's own module computes (or receives) the same
`{linear, bytes, origin}` triple and calls `scanIndirectDispatch()` exactly
once — this is the second call site criterion 3's single-call-site test must
account for.

### `XREF_ACCESS_KINDS` — a real vocabulary, optional corroborating input only
```typescript
// Source: src/mcp/vice/anno-types.ts:463 (read this session)
export const XREF_ACCESS_KINDS = Object.freeze(["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"] as const);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No coverage instrument existed (pre-v0.5.0) | `anno-coverage.ts`'s multi-measure report, never aggregated | v0.5.0 (Phase 19) | This phase's report must follow the same "never aggregate, never boolean" discipline |
| `follow_indirect_jumps()` (deleted external-analyser code) only found `jmp ($nnnn)` on already-classified `Code` | `scanIndirectDispatch()` reaches zero-page vectors, multi-entry tables, split lo/hi tables, and the RTS-trick with no opcode-keyed search at all | v0.7.0-era (Phase 19/20 lineage, `anno-coverage.ts` header) | Class 1 is solved; do not re-derive |
| Class-3 split-table gate assigned lo/hi roles via `Math.min`/`Math.max` (WR-01, a real defect) | Orientation is resolved from the pairing's own store-construction evidence | Fixed before this phase (see `anno-coverage.ts:603-611`) | Not directly this phase's concern, but the same "construction, not convention" discipline should apply to any new class-2/3/4 orientation questions |

**Deprecated/outdated:** none specific to this phase — no library or API
churn is involved; this is new domain-analysis code over an already-stable
internal substrate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Page-alignment dependence" means VIC-II hardware alignment (sprite/charset boundaries) rather than a code/timing page-crossing assumption | Class 3 taxonomy | The fixture and detector could be built for the wrong reading, failing to satisfy BUILD-04's actual (unstated) intent; needs a planning/discuss-phase decision, not a research guess |
| A2 | A CIA-timer-based raster stabilizer is a real, detectably-different non-canonical variant from the `$D012`-compare stabilizer | Class 4 taxonomy | If wrong, the "non-canonical" raster fixture variant may not actually differ structurally from the textbook one, weakening criterion 1's "not one shape reskinned four times" bar |
| A3 | Indirect-indexed self-modification (`sta (zp),y` into code) is undetectable by a static operand-match check | Class 2 named limit | If a workable heuristic exists (e.g. tracking a zero-page pointer's possible value range), the stated limit may be overly pessimistic; worth a quick spike at plan time rather than accepting the limit at face value |
| A4 | `anno-coverage.ts`'s "never define a second confidence vocabulary" rule is project-wide, not file-scoped | Confidence/unclassified section | If file-scoped only, a hazard-report-local confidence enum is uncontroversial; if project-wide, it needs a recorded, deliberate exception |
| A5 | `bank.prg` is not intended as the page-alignment positive fixture, and its role in criterion 5's cross-check should be decided explicitly | Fixture provenance table / Class 3 | If the planner wires it in as a page-alignment positive example without checking, the cross-check table would silently test the wrong claim |

## Open Questions

1. **Does "page-alignment dependence" mean VIC-II hardware alignment or a
   code/timing page-crossing assumption (or both)?**
   - What we know: the phrase is unelaborated in both the current and the
     original (v0.5.0) requirement text, checked this session across both
     documents.
   - What's unclear: which reading (or a third one) the phase's success
     criteria actually intend to be checkable against.
   - Recommendation: raise explicitly in `/gsd-discuss-phase` before
     planning locks in a fixture design; reading 1 (VIC-II alignment) is
     recommended above because it composes naturally with the required
     sprite/charset content, but this is a judgement call, not a finding.

2. **Should the hazard report's per-finding confidence reuse
   `CONFIDENCE_GRADES` or define a new, explicitly-scoped vocabulary?**
   - What we know: `CONFIDENCE_GRADES` is the one vocabulary that exists
     today, built for a different axis (code-vs-data classification); its
     owning module's header states a "never define a second" rule whose
     scope (file vs. project) is not stated.
   - What's unclear: whether reusing five code/data-classification tokens to
     describe "how sure is this hazard detection" would read as a category
     error to a future maintainer, versus whether a new, differently-named
     enum would violate the stated rule.
   - Recommendation: decide and record the rationale explicitly in the plan,
     rather than silently picking either option.

3. **Is a fully-solved SMC detector for indirect-indexed self-modification
   (`sta (zp),y` into code) worth a plan-time spike, or should it be a named,
   accepted limit from the start?**
   - What we know: a direct-operand/absolute-target check is straightforward;
     tracking a zero-page pointer's possible runtime value range to catch the
     indirect case is a much larger static-analysis undertaking with no
     existing primitive in this codebase.
   - What's unclear: whether BUILD-04's bar requires attempting this, or
     whether naming it as a limit (parallel to the raster class's own named
     limit) satisfies the requirement.
   - Recommendation: name it as a limit unless the fixture design explicitly
     wants to plant this exact non-canonical SMC variant — in which case the
     detector's stated "miss" on it becomes the demonstration of the limit,
     which is arguably more valuable than solving it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `acme` on `$PATH` (host) | Assembling the purpose-built subject | Not probed this session (research does not require a build) — prior phases (45-47) already depend on and exercise this; `acme-build/SKILL.md` documents the probe/refusal path | 0.97 "Zem" (project's own pinned reference) | None needed — `acme-build` refuses by name with the remedy if absent, per project standing policy |
| A reachable stock VICE (`x64sc`) | "Runs in VICE with visible on-screen behaviour" (criterion 1) | Not probed this session; per project memory, `/usr/bin/x64sc` is genuine unpatched stock and available for live testing | 3.9 (project's documented baseline) | None — this is a verification-time dependency, not a build-time one, and the project's standing policy is "detect, never auto-install" |

**Missing dependencies with no fallback:** none identified — both
dependencies are already load-bearing for prior, completed phases (45-47) in
this same milestone, so their availability is not new risk this phase
introduces.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — colocated `*.test.ts` files, `package.json`'s `"test"` script (`node --test '*.test.*'`) |
| Quick run command | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` (once the file exists) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (`node test-gate.mjs`, excludes `MANUAL_ONLY_TESTS` — currently a 6-member floor per project memory) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-04 (criterion 1) | Subject assembles under real ACME, exports/reassembles through the Phase 47 multi-file path | integration | `acme-verify.test.ts`-style byte-diff, extended to the new fixture | ❌ Wave 0 — new fixture + test |
| BUILD-04 (criterion 2) | Report opens no new store table, writes nothing | unit (structural, source-text grep) | `node --test anno-hazard-report.test.ts` | ❌ Wave 0 |
| BUILD-04 (criterion 3) | Each class fires on a planted variant, declines on a negative control; `scanIndirectDispatch()` single-call-site | unit | `node --test anno-hazard-report.test.ts` | ❌ Wave 0 |
| BUILD-04 (criterion 4) | Every finding carries mechanism + confidence; `unclassified` reachable; no boolean shape | unit | `node --test anno-hazard-report.test.ts` | ❌ Wave 0 |
| BUILD-04 (criterion 5) | Cross-check against `tracer.prg`/`bank.prg`/`smc.prg`, detected/missed/false-positive recorded | unit (fixture-driven) | `node --test anno-hazard-report.test.ts` | ❌ Wave 0 (fixtures exist; the comparison test does not) |

### Sampling Rate
- **Per task commit:** the new module's own test file, run directly.
- **Per wave merge:** `npm run test:automated`.
- **Phase gate:** full suite green (or explicitly acknowledged, per this
  milestone's standing "no opening gate, distributed RED-observed controls"
  discipline) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/mcp/vice/anno-hazard-report.ts` — the new pure module (name is the planner's choice)
- [ ] `src/mcp/vice/anno-hazard-report.test.ts` — its structural no-write test, its per-class fire/decline tests, its three-fixture cross-check
- [ ] `src/mcp/vice/fixtures/hazard-subject/` — the new committed ACME source, assembled `.prg`, and `.annostore.json` export
- [ ] `FIXTURE-DESIGN.md` (or equivalent, criterion 1's own required document) — per-class variant choice and rationale
- [ ] Four registration-site additions for the report's own MCP/CLI verb: `anno-tools.ts` (definition + dispatch), `anno-cli.ts` (verb + arg validation), `anno-register.ts` (derivation-registry entry), and a skill-doc routing update — precedent: Phase 46's `anno_exclude_range`/`anno_include_range` (`ROADMAP.md:1062`)
- Framework install: none — `node --test` is already wired

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no auth surface |
| V3 Session Management | No | No new session/transport code |
| V4 Access Control | No | No new access boundary |
| V5 Input Validation | Yes | Reuse existing `anno-tools.ts` arg-assertion patterns (`assertStoreArg`, `assertMaxResults`, etc.) for the new tool's arguments; the report itself takes plain in-memory data, not user-controlled paths |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A "read-only" analysis module gaining a write path through a later edit (e.g. someone adds a convenience `putXref()` call to persist a hazard finding) | Tampering | The structural no-write source-text test (Pattern above, copied from `anno-coverage.test.ts:4665`) catches this at test time, not review time |
| Host-tool spawn seam bypass (a new script spawning `acme` directly instead of through `runHostTool()`) | Elevation of Privilege / Tampering | `scripts/check-no-skill-external-spawn.mjs`, already observed biting on planted violations project-wide; run it against any new script this phase adds |
| A hazard finding rendered as a false guarantee ("clean" when the class genuinely could not be evaluated) misleading a downstream reader into skipping manual review before relocating code | Repudiation-adjacent (false assurance) | The mandatory `unclassified` outcome and the ban on boolean clean/dirty shape (criterion 4) are the direct mitigation; this is the actual security-relevant property of this phase, more than any ASVS category |

## Sources

### Primary (HIGH confidence — read at source, this session)
- `src/mcp/vice/anno-coverage.ts` (lines 1-210, 568-820, 960-1030, 1320-1393, 2280-2465) — `scanIndirectDispatch()`, `IndirectDispatchScan`, dispatch-context gate, `provenDispatchTargets()`, `buildCoverageReport()`, `coverageFindings()`
- `src/mcp/vice/evid-reconcile.ts` (lines 1-60) — the read-only computed-query precedent
- `src/mcp/vice/dxa-proof01-compare.ts` (lines 1-160) — the three-outcome cross-check precedent
- `src/mcp/vice/anno-confidence.ts` (lines 1-190) — `CONFIDENCE_GRADES`, the one existing confidence vocabulary
- `src/mcp/vice/anno-store.ts` (lines 270-370, 3660-3900, 3920-3999) — DDL/`SCHEMA_VERSION`, `anno_evid_exec`, `anno_xref`/`putXref()`/`listXrefs()`
- `src/mcp/vice/anno-types.ts` (line 463) — `XREF_ACCESS_KINDS`
- `src/mcp/vice/anno-export-asm.ts` (header, lines 1447-1553) — mid-instruction label handling
- `src/mcp/vice/anno-cli.ts` (lines 148-162, 1690-1760) — the query-layer import list, `reconcileObservedExecution()` call site
- `src/mcp/vice/anno-register.ts` (lines 100-320) — `AnnoVerbRegisterEntry` shape, `anno_evid_disagreements`/`anno_evid_ingest` entries
- `src/mcp/vice/block-class.ts` (lines 90-200) — `BlockClass` neutral vocabulary
- `src/skills/acme-build/SKILL.md` (whole file) — assembly path, host-tool seam, output files
- `src/mcp/vice/fixtures/export-asm/smc.prg`, `.a`, `.annostore.json`; `src/mcp/vice/fixtures/dxa/tracer.prg`, `.annostore.json`; `src/mcp/vice/fixtures/ghidra/bank.prg`, `.a` — fixture bytes and current annotation state
- `.planning/ROADMAP.md` (Phase 45/46/47/48/49 sections, lines 979-1220, 1502-1547) — phase goals, criteria, sequencing rationale
- `.planning/REQUIREMENTS.md` (whole file) — BUILD-04 text, Out-of-Scope rows
- `.planning/STATE.md` (lines 695-744, 2920-2937) — Strategy B rationale, operator next steps
- `.planning/milestones/v0.5.0-ROADMAP.md` (lines 300-380) — the original, more detailed BUILD-04 text (indexed-range/off-by-one, write-targets-in-Code-blocks)
- `git log --follow` on the three fixtures — provenance/authorship-date confirmation
- `src/mcp/vice/stock-reproducible-run.test.ts` (line 886) — single-call-site test precedent
- `src/mcp/vice/anno-coverage.test.ts` (line 4665) — the structural no-write-call test precedent

### Secondary (MEDIUM confidence — WebSearch, checked this session)
- [RTS Trick - NESdev Wiki](https://wiki.nesdev.com/w/index.php/RTS_Trick) — RTS-trick mechanics and off-by-one adjustment
- [Stabilizing the VIC-II Raster | Bumbershoot Software](https://bumbershootsoft.wordpress.com/2015/12/29/stabilizing-the-vic-ii-raster/) — double-IRQ stabilizer technique
- [Making stable raster routines (C64 and VIC-20) - Antimon](https://www.antimon.org/dl/c64/code/stable.txt) — worked stabilizer code
- [base:stable_raster_routine - Codebase64 wiki](https://codebase64.net/doku.php?id=base%3Astable_raster_routine) — community-standard raster stabilization reference
- [VIC-II for Beginners Part 5 - Bringing Sprites in good Shape — Dustlayer](https://dustlayer.com/vic-ii/2013/4/28/vic-ii-for-beginners-part-5-bringing-sprites-in-shape) — sprite 64-byte block alignment
- [Sprite Pointers - C64 Programmer's Reference Guide](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_3/page_133.html) — sprite pointer register mechanics
- [Self modifying code - 6502.org forum](https://6502.org/forum/viewtopic.php?t=1255) — operand-patch idioms
- [self-mod'ing code on 65xx - Wilson Mines Co.](https://wilsonminesco.com/SelfModCode/) — SMC technique catalogue

### Tertiary (LOW confidence — WebSearch only, not cross-checked against a worked example)
- CIA-timer-based raster stabilization as a non-canonical class-4 variant (A2 in Assumptions Log)
- Page-crossing cycle-cost as the mechanistic reason class-4 is a movement hazard (named limit, class 4) — general 6502 timing knowledge, not re-derived from the instruction-timing table this session

## Metadata

**Confidence breakdown:**
- Standard stack / existing code surface (class 1 reuse, report-shape precedents, fixture provenance): HIGH — everything cited was read at source this session with line numbers
- Class 2 (SMC) taxonomy: MEDIUM — general technique is well-established and cross-checked against this project's own v0.5.0 requirement text; specific non-canonical variants are `[ASSUMED]` synthesis
- Class 3 (page-alignment) taxonomy: LOW-MEDIUM — the phrase itself is undefined anywhere in this project's history; the VIC-II-alignment reading is well-cited but the mapping to "page-alignment dependence" is this researcher's inference, not a confirmed intent
- Class 4 (cycle-exact raster) taxonomy: LOW-MEDIUM — the textbook idiom is well-cited; the ROADMAP itself states no algorithm exists, so "what a detector can do" is necessarily a bounded, structural-signature-only answer
- Confidence/unclassified-outcome design: MEDIUM — strong in-repo precedent for the *shape*, genuinely open question for the *vocabulary*

**Research date:** 2026-09-12
**Valid until:** No expiry driven by external library churn (no new dependencies). Re-check if Phase 45/46/47's shipped code (`anno-coverage.ts`, `evid-reconcile.ts`, `anno-export-asm.ts`, the three fixtures) changes before Phase 48 planning executes — this research reads their state as of commit history through `47-06` (Phase 47 complete, 2026-09-12).
