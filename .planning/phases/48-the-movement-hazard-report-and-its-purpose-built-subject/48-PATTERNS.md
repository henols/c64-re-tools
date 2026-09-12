# Phase 48: The Movement-Hazard Report and Its Purpose-Built Subject - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 8 (new/modified, from RESEARCH.md's Wave 0 Gaps + Recommended Project Structure)
**Analogs found:** 8 / 8

All excerpts below were re-read at source this session (not copied from RESEARCH.md's summaries). Three corrections to RESEARCH.md are called out explicitly where this session's read disagreed with it.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/anno-hazard-report.ts` | service (pure analysis module) | transform (batch, read-only query) | `src/mcp/vice/evid-reconcile.ts` (shape) + `src/mcp/vice/dxa-proof01-compare.ts` (three-outcome shape) + `src/mcp/vice/anno-coverage.ts`'s `scanIndirectDispatch()` (the one call site to reuse) | exact (composite of three) |
| `src/mcp/vice/anno-hazard-report.test.ts` | test | batch/transform | `src/mcp/vice/anno-coverage.test.ts` (read-only structural test, line 4664-4670) + `src/mcp/vice/anno-cli.test.ts` (call-site-count test, lines 948-965) | exact |
| `src/mcp/vice/anno-tools.ts` (+ new tool def/dispatch) | route/controller (MCP tool surface) | request-response | Existing `anno_exclude_range`/`anno_include_range` entries, same file (lines 637-699, 1349-1370, 1978-1979, 2216-2229, 3092) | exact |
| `src/mcp/vice/anno-register.ts` (+ new registry entry) | config/registry | CRUD (registry metadata) | `anno_exclude_range` / `anno_include_range` entries (lines 210-243) | exact |
| skill-doc routing update | config (docs) | — | `src/skills/c64-provenance-diff/SKILL.md`'s existing mentions of `anno_exclude_range`/`anno_include_range` | role-match |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.a` | fixture (ACME source) | file-I/O | `src/mcp/vice/fixtures/export-asm/smc.a` (+ its README/provenance table) | exact |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` + `.annostore.json` | fixture (build artifact + store export) | file-I/O | `src/mcp/vice/fixtures/export-asm/smc.prg` / `smc.annostore.json` | exact |
| `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` | docs | — | `src/mcp/vice/fixtures/export-asm/README.md`, `src/mcp/vice/fixtures/ghidra/README.md` | exact |

**Correction to RESEARCH.md #1 (file path):** the host-tool seam module is `src/mcp/vice/host-tool.mts`, not `src/mcp/vice/host-tool.ts` as one bullet in the pattern-mapping brief assumed. `findSiblingBinary()` and the `acme.build` allowlist entry are both in `host-tool.mts` (confirmed at source, lines ~10, 141-229, 493-608). There is no `host-tool.ts`.

**Correction to RESEARCH.md #2 (registration site count):** RESEARCH.md's "Recommended Project Structure" and the pattern-mapping brief both describe a **four**-registration-site precedent for `anno_exclude_range`/`anno_include_range` (`anno-tools.ts`, `anno-cli.ts`, `anno-register.ts`, skill-doc). Verified at source this session: `anno_exclude_range`/`anno_include_range` have **no** entry anywhere in `anno-cli.ts` (`grep` returns zero matches) — they are MCP-surface-only verbs, deliberately (`anno-register.ts`'s own rationale field, quoted below, states "The surface is the right home rather than the CLI because an exclusion is a small bounded piece of state a session sets while looking at a range, not a filesystem artefact"). The real precedent is **three** sites: `anno-tools.ts` (definition + dispatch), `anno-register.ts` (registry entry), and the skill-doc (`src/skills/c64-provenance-diff/SKILL.md`). If the new hazard-report verb is a read-only query rather than a mutating CLI-style command, the planner should decide explicitly whether it needs an `anno-cli.ts` entry at all, rather than assuming four sites are required by precedent.

**Correction to RESEARCH.md #3 (single-call-site test precedent):** RESEARCH.md cites `src/mcp/vice/stock-reproducible-run.test.ts:886` ("`runReproducible()` is reached from exactly one call site") as "the exact precedent to copy." Read at source this session (lines 886-920): that test is a **behavioral** test (it drives `handleRunUntil()` through a fake client and asserts on the resulting protocol answer's shape), not a source-text grep counting call sites. The actual source-text call-site-count precedents in this codebase are:
- `anno-coverage.test.ts` lines 4330-4358 (`PIN 1`): strips comments, counts occurrences of `hasDispatchContext(` minus its one `function hasDispatchContext(` declaration, and asserts the resulting call-site count equals the number of `DISPATCH_GATE_ROUTES` entries with `consultsSharedGate: true`.
- `anno-cli.test.ts` lines 948-965: strips comments/literals, counts occurrences of `\brefuseOverwrite\(` minus its one `function refuseOverwrite\(` declaration, and asserts the call-site count equals a stated number (`2`), with a message telling the next editor which two doc paragraphs to update if the count is intentionally different.

These are the shape the hazard-report's own `scanIndirectDispatch(` single-call-site test should copy — count occurrences minus declarations, assert an **exact** number, and word the failure message to name what changed the count and where to update the doc paragraph, rather than asserting `<= 1` (which the research itself already flags as the wrong shape).

## Pattern Assignments

### `src/mcp/vice/anno-hazard-report.ts` (service, transform/read-only-query)

**Analog 1 — read-only computed-query shape:** `src/mcp/vice/evid-reconcile.ts`

Header (lines 1-20, read this session):
```typescript
#!/usr/bin/env node
// evid-reconcile.ts
//
// Plan 43-04 (EVID-03, EVID-04): the ONE place that joins the byte-derived
// block table (`block-class.ts`'s own vocabulary, read through `blockClassAt`)
// against the runtime evidence table (`anno_evid_exec`, plan 43-02's
// `EvidExecRow`) and reports where the two independent classifiers disagree.
// Shaped exactly like `dxa-proof01-compare.ts` (Phase 38, plan 38-01): two
// already-fetched classifications in, buckets with an explicit denominator
// and named third/fourth buckets out, nothing fetched and nothing mutated.
```

Input/signature (lines 89-90, 217-220):
```typescript
export interface EvidReconcileInput {
  blocks: readonly BlockEntry[];
  observations: readonly EvidExecRow[];
}
...
export function reconcileObservedExecution(input: EvidReconcileInput): EvidReconciliation {
  const blocks: readonly BlockEntry[] = Array.isArray(input.blocks) ? input.blocks : [];
  const observations: readonly EvidExecRow[] = Array.isArray(input.observations) ? input.observations : [];
```
Note: the actual exported symbol is `EvidReconcileInput` / `EvidReconciliation`, not the inline anonymous object type RESEARCH.md's own example sketched — copy the pattern of a named input interface plus a defensive `Array.isArray(...) ? ... : []` normalization on every array field, since the new module's inputs (symbols/comments/ranges/xrefs/exec observations) are exactly this same "plain data the caller already fetched" shape.

**Analog 2 — three-outcome, never-boolean, explicit-denominator shape:** `src/mcp/vice/dxa-proof01-compare.ts`

The exact result type to mirror (lines 78-108, read this session):
```typescript
export interface Proof01Comparison {
  /** `groundTruth.certainCode.size + groundTruth.certainData.size`. */
  denominator: number;
  /** Count of `recoveredAddresses`. */
  recovered: number;
  /** Count of `missedAddresses`. */
  missed: number;
  /** Count of `overlapAddresses`. */
  unclassifiedOverlap: number;
  recoveredAddresses: number[];
  missedAddresses: number[];
  overlapAddresses: number[];
  positiveClass: "data";
  tier: "byte-derived";
}
```
The join itself (lines 112-135) — the exact three-way branch to copy for the per-fixture cross-check (`detected`/`missed`/`falsePositive` in criterion 5's vocabulary):
```typescript
export function compareByteDerivedRecovery(input: Proof01ComparisonInput): Proof01Comparison {
  const { listing, groundTruth } = input;
  const denominator = groundTruth.certainCode.size + groundTruth.certainData.size;

  const recoveredAddresses: number[] = [];
  const missedAddresses: number[] = [];
  const overlapAddresses: number[] = [];
  for (const address of groundTruth.certainData) {
    if (listing.unclassified.has(address)) {
      overlapAddresses.push(address);
    } else if (listing.data.has(address)) {
      recoveredAddresses.push(address);
    } else {
      missedAddresses.push(address);
    }
  }
  ...
```
Every address array is sorted ascending via a small `sortAscending()` helper (lines 109-111) — copy this too, so two logically-identical inputs never produce differently-ordered output.

**Analog 3 — the one call site to add:** `src/mcp/vice/anno-coverage.ts`

`IndirectDispatchScan`'s real field set (verified at lines 630-664, matches RESEARCH.md's summary closely but the two ADVISORY-vs-PROVEN doc comments are richer than quoted there):
```typescript
export interface IndirectDispatchScan {
  indirectJumps: IndirectJumpFinding[];
  splitTables: SplitTableFinding[];              // PROVEN only
  multiEntryTables: DispatchTableFinding[];
  stackReturnDispatch: StackReturnFinding[];      // the RTS-trick idiom
  splitTableCandidates: SplitTableFinding[];      // ADVISORY -- never summed into discoveredTargets
  discoveredTargets: number[];
  tableEntryAddresses: number[];
  truncated: boolean;
}
```
Function signature and the existing (only) call site (verified at lines 967-971 and 2323-2324):
```typescript
export function scanIndirectDispatch(
  instructions: readonly Instruction[],
  bytes: Uint8Array,
  origin: number,
): IndirectDispatchScan { ... }

// buildCoverageReport()'s call site:
const linear = decode(loaded.bytes, loaded.origin);
const dispatch = scanIndirectDispatch(linear, loaded.bytes, loaded.origin);
```
The hazard report's own module should compute or receive this same `{linear, bytes, origin}` triple and call `scanIndirectDispatch()` exactly once — this becomes the second call site the single-call-site test (see below) must account for.

**Class-2 (SMC) detection signal — confirmed at source, not assumed:**
`src/mcp/vice/fixtures/export-asm/smc.annostore.json` line 53, verbatim:
```json
"text": "DECLINED: this is smc.prg's own self-modified operand byte -- the immediate operand of the LDA #$00 at $0801, rewritten in place by INC $0802 every loop iteration. Its effective value varies per iteration by construction (0, 1, 2, ... wrapping at 256) and there is no single correct symbol or value to name here -- see export-asm/README.md."
```
This confirms RESEARCH.md's claim: the correctly-decomposed fixture carries **no** label/marker at the self-modified operand. The class-2 detector must derive its finding purely from the decoded byte stream (a store/RMW instruction whose target address falls inside a decoded instruction's byte range), never from store metadata.

**Confidence vocabulary — do not collide with this:** `src/mcp/vice/anno-confidence.ts` lines 75-113 (verified verbatim):
```typescript
export const CONFIDENCE_GRADES: readonly ConfidenceGrade[] = [
  { token: "confirmed-code", bracket: "[confirmed-code]", phrase: "confirmed code", meaning: "Executed during tracing, PC observed inside it" },
  { token: "probable-code", bracket: "[probable-code]", ... },
  { token: "confirmed-data", bracket: "[confirmed-data]", ... },
  { token: "probable-data", bracket: "[probable-data]", ... },
  { token: "unknown", bracket: "[unknown]", meaning: "No reliable interpretation yet" },
] as const;
```
These five tokens (and their `[bracket]` spelling convention) must never be reused or near-collided with for a new hazard-confidence enum — if the plan adds a new vocabulary, name it distinctly (e.g. `"observed"`/`"static-strong"`/`"static-weak"` as RESEARCH.md suggests) and record the departure from "one vocabulary" as a deliberate decision.

### `src/mcp/vice/anno-hazard-report.test.ts` (test)

**Analog 1 — read-only-by-construction structural test:** `src/mcp/vice/anno-coverage.test.ts` lines 4661-4670, verbatim (this is the EXACT test to copy, confirmed at source — RESEARCH.md's line number (4665) was off by a few lines but the content matches exactly):
```typescript
test("the coverage module contains no file-write call, no project-save call and no live-session import", () => {
  const source = readFileSync(join(HERE, "anno-coverage.ts"), "utf8");
  for (const forbidden of ["writeFileSync", "renameSync", "appendFileSync", "save_project", "anno-session.ts"]) {
    assert.ok(!source.includes(forbidden), `anno-coverage.ts mentions ${forbidden} -- a coverage run must be read-only by construction`);
  }
  assert.ok(!/hostpath|containerpath/.test(source), "the anno module family must stay absent from the path-translation consumer set");
});
```
The new module's own test should run the identical scan against its own source text, extended per RESEARCH.md's recommendation with `openStore(`, `putXref(`, `applyWrite(`.

**Analog 2 — exact-count call-site test (corrected precedent, see above):** `src/mcp/vice/anno-cli.test.ts` lines 948-965, the shape to copy for `scanIndirectDispatch(`'s call-site count:
```typescript
test("refuseOverwrite()'s call-site count matches the number its own doc states...", () => {
  const stripped = stripCommentsAndLiterals(readFileSync(ANNO_CLI_SOURCE_PATH, "utf8"));
  const declarations = (stripped.match(/\bfunction refuseOverwrite\(/g) ?? []).length;
  assert.equal(declarations, 1, "refuseOverwrite() must be declared exactly once -- it is the ONE shared overwrite check");
  const callSites = (stripped.match(/\brefuseOverwrite\(/g) ?? []).length - declarations;
  assert.equal(callSites, 2, `refuseOverwrite() has ${callSites} call site(s) in anno-cli.ts. If that is correct, update BOTH paragraphs...`);
});
```
Apply the same arithmetic to `scanIndirectDispatch(` across the whole `src/mcp/vice/` tree (or within `anno-coverage.ts` + `anno-hazard-report.ts` specifically): count occurrences minus the one `export function scanIndirectDispatch(` declaration, assert the exact expected count (2, per RESEARCH.md's own reasoning), and word the failure message to say which two call sites are expected and why a third would be wrong.

### `src/mcp/vice/anno-tools.ts` (route/controller — new tool definition + dispatch)

**Analog:** the existing `anno_exclude_range` / `anno_include_range` entries, same file.

Tool definition shape (lines 637-664, verified):
```typescript
{
  name: "anno_exclude_range",
  description: "Records the user's request to leave an inclusive span out, WITH the reason, as a durable row (BUILD-05/BUILD-07). ...",
  inputSchema: {
    type: "object",
    properties: {
      ...STORE_PROPERTY,
      start_address: { description: "Start of the excluded span, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
      end_address: { description: "End of the excluded span, INCLUSIVE." },
      reason: { type: "string", description: "Why the user asked for this span to be left out. REQUIRED and must be non-empty..." },
      ...BASE_REVISION_PROPERTY,
    },
    required: ["store", "start_address", "end_address", "reason"],
  },
},
```
Argument validation (line 1349, 1362, 1978-1979) and dispatch (line 2216, 2229, 3092) each have one shared-helper pattern: a single `assertExcludedRangeArgs()` validator called from both verb names, and a single `dispatchExcludedRange()` dispatcher called from both verb names. Since the hazard report is a single read-only verb (not a pair), the new tool needs its own (simpler) single-verb validator + dispatch function, but should follow the same "one function serving the verb name(s)" shape rather than inlining logic at each call site.

### `src/mcp/vice/anno-register.ts` (registry entry)

**Analog:** `anno_exclude_range` entry, lines 210-227, verbatim:
```typescript
{
  verb: "anno_exclude_range",
  kind: "unclassified",
  consumers: [
    { path: "src/mcp/vice/anno-store.ts", symbol: "addExcludedRange" },
    { path: "src/mcp/vice/anno-tools.ts", symbol: "anno_exclude_range" },
  ],
  requirements: ["BUILD-05", "BUILD-07"],
  rationale: "BUILD-05 requires that any exclusion be one the user asked for...",
  note: "This verb's existence is what makes the requirement's 'never the tool's' clause CHECKABLE rather than aspirational...",
},
```
The new registry entry should list `requirements: ["BUILD-04"]`, name its real consumer symbol (the new module's exported entry function, not a store-mutating symbol since there is none), and its `rationale` should state the "read-only, no new store table" property explicitly, mirroring how this entry's own rationale states its positive requirement.

### `src/mcp/vice/fixtures/hazard-subject/` (fixture tier)

**Analog:** `src/mcp/vice/fixtures/export-asm/` (smc.a / smc.prg / smc.annostore.json / README.md), directory layout verified via `ls`:
```
fixtures/export-asm/
├── make-export-asm-fixtures.mjs   # the regenerator; refuses to write a partial fixture
├── README.md                      # provenance table + "what this fixture proves"
├── smc.a                          # ACME source
├── smc.annostore.json             # committed store export (labels/comments/ranges)
└── smc.prg                        # assembled output, captured by the regenerator only
```
README.md's structure (verified, lines 1-60) to copy for `FIXTURE-DESIGN.md`: an opening paragraph naming what the fixture proves and against what real assembler version; a "What is in this directory" file table; a "Provenance table" (`File | Produced by | Assembler | Host | Captured at | Requirement anchor`); a byte-level annotated hex dump; and a "What this fixture proves" section that states explicitly what a naive/weaker construction would NOT prove — the same rigor RESEARCH.md's own "not the textbook idiom" requirement (criterion 1) demands for each of the four planted hazard classes.

**Provenance discipline:** `smc.prg` is stated as "a real assembler output, not synthesized bytes" — captured by a regenerator script (`make-export-asm-fixtures.mjs`) that is the only writer of the `.prg`, with a test (`anno-export-asm.test.ts`) that re-assembles the `.a` source on every run and byte-compares. The new `hazard-subject/` fixture should follow the identical discipline: a regenerator script, never hand-edited bytes, and a reassembly test.

**ACME/host-tool seam (corrected path — see correction #1 above):** `src/mcp/vice/host-tool.mts`, `acme.build` allowlist entry (verified at lines 141-229, 493-608). The only route to spawn ACME. `anno-export-asm.test.ts` (lines 170-186) shows the idiom to copy for a test that needs the built artifact:
```typescript
build();
const hostToolModule = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  runHostTool: (raw: unknown, deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number }) => Promise<...>;
};
const { runHostTool } = hostToolModule;

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});
```
This is the pattern for tests that need to actually invoke ACME (e.g. verifying the subject reassembles byte-identically) — never a second `spawnSync`/`execFile` site.

## Shared Patterns

### Read-only / no-write structural enforcement
**Source:** `src/mcp/vice/anno-coverage.test.ts:4661-4670` (verified verbatim above)
**Apply to:** `anno-hazard-report.ts` and its test file — the module's own source text must never contain `writeFileSync`, `renameSync`, `appendFileSync`, `save_project`, `anno-session.ts`, and (per RESEARCH.md's extension) `openStore(`, `putXref(`, `applyWrite(`.

### Exact-count call-site assertion (never `<=`)
**Source:** `src/mcp/vice/anno-cli.test.ts:948-965` and `src/mcp/vice/anno-coverage.test.ts:4338-4358` (both verified verbatim above; supersedes RESEARCH.md's `stock-reproducible-run.test.ts:886` citation, which is a behavioral test, not a source-grep)
**Apply to:** the `scanIndirectDispatch(` single-call-site test (criterion 3) — count matched occurrences minus the function's own declaration, assert an exact literal number, and word the assertion failure to name which doc paragraph to update if the count legitimately changes.

### Never a boolean clean/dirty shape; three-outcome buckets with an explicit denominator
**Source:** `src/mcp/vice/dxa-proof01-compare.ts:78-135` (verified verbatim above)
**Apply to:** both the hazard report's own per-finding shape (never a single verdict) and the criterion-5 cross-check comparator (`detected`/`missed`/`falsePositive`, sorted-ascending address arrays, an explicit denominator).

### MCP verb registration (single read-only verb, no CLI entry required by precedent)
**Source:** `src/mcp/vice/anno-tools.ts:637-699` + `src/mcp/vice/anno-register.ts:210-227` (verified verbatim above)
**Apply to:** the new `anno_hazard_report`-style tool. Note the corrected site count (3, not 4) — confirm at plan time whether an `anno-cli.ts` entry is actually wanted for this verb, since the closest precedent verbs (`anno_exclude_range`/`anno_include_range`) deliberately have none.

### ACME fixture provenance and regeneration discipline
**Source:** `src/mcp/vice/fixtures/export-asm/README.md` (verified, lines 1-60) + `make-export-asm-fixtures.mjs`
**Apply to:** `fixtures/hazard-subject/` — a regenerator script as the only writer of the `.prg`, a provenance table naming the exact ACME version/host/date, and a reassembly test that re-derives the `.prg` from the `.a` source and byte-compares on every test run.

## No Analog Found

None. Every file in the Wave 0 Gaps list has a strong, verified in-repo analog (see table above). The three genuinely new detector *algorithms* (class 2 SMC, class 3 page-alignment, class 4 raster) have no existing detector code to copy from — RESEARCH.md's own Variant Taxonomy section is the correct reference for those, not a codebase analog, since none exists.

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts`, `src/mcp/vice/*.test.ts`, `src/mcp/vice/fixtures/**`, `src/skills/**`
**Files scanned (read at source this session):** `evid-reconcile.ts`, `dxa-proof01-compare.ts`, `anno-coverage.ts` (multiple ranges), `anno-coverage.test.ts` (multiple ranges), `anno-confidence.ts`, `anno-tools.ts` (multiple ranges), `anno-register.ts` (multiple ranges), `anno-cli.ts` (grepped, no exclude/include-range entries found), `anno-cli.test.ts` (multiple ranges), `stock-reproducible-run.test.ts`, `anno-export-asm.ts` (partial), `anno-export-asm.test.ts` (partial), `host-tool.mts` (grepped), `fixtures/export-asm/README.md`, `fixtures/export-asm/smc.annostore.json`, directory listings of `fixtures/ghidra/`, `fixtures/export-asm/`, `fixtures/dxa/`
**Pattern extraction date:** 2026-09-12
