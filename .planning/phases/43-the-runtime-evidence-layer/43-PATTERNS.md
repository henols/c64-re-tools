# Phase 43: The Runtime Evidence Layer - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 6 (5 new/extended TypeScript modules + 1 evidence script)
**Analogs found:** 6 / 6

All paths below were verified with `git ls-files -- <path>` and are tracked
source under `src/mcp/vice/` or `.planning/phases/33-.../evidence/`. No
gitignored mirror path (`.claude/gsd-core/`, `.claude/mcp/`) is named anywhere
in this document.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/mcp/vice/anno-store.ts` (extend `DDL`, bump `SCHEMA_VERSION`) | model / migration | CRUD | itself, prior `DDL` table additions (`anno_enum_usage` at v3) | exact — same file, same pattern, one more table |
| `src/mcp/vice/anno-types.ts` (extend, new row type(s)) | model | CRUD | `RangeRow`/`CommentRow`-shaped exports already there | exact |
| `src/mcp/vice/anno-tools.ts` (extend `ANNO_TOOL_DEFINITIONS`, `dispatch()`, `READ_ONLY_ANNO_VERBS`) | controller (proxy-local tool registration) | request-response (SQLite-only, no transport) | itself — the existing 21 `anno_*` entries | exact |
| `src/mcp/vice/evid-ingest.ts` (new, or a case folded into `anno-tools.ts`'s `dispatch()`) | service / transform | transform (AccessMap → store rows) | `textmon-memmap.ts`'s `parseAccessMap()` (pure parser feeding this) + `anno-tools.ts` write-verb dispatch cases | role-match |
| `src/mcp/vice/evid-reconcile.ts` (new) | service (pure join) | transform, CRUD-adjacent | `src/mcp/vice/dxa-proof01-compare.ts` | exact |
| `src/mcp/vice/evid-reconcile.test.ts` (new) | test | — | `src/mcp/vice/dxa-proof01-compare.test.ts` | exact |
| `src/mcp/vice/anno-store.test.ts` (extend) | test | CRUD | itself, existing DDL/insert/read test cases | exact |
| `src/mcp/vice/anno-durability.test.ts` (extend, two-run-identity concurrent case) | test | event-driven (SIGKILL harness) | itself — the existing STORE-04 harness | exact |
| `.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs` (new) | utility (one-off evidence script) | batch / file-I/O | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/frame-anchor-probe.mjs` | exact |
| A structural banned-key test for the evidence layer's report output | test | — | `anno-coverage.test.ts`'s `COV-01` banned-key regex test | exact |

## Pattern Assignments

### `src/mcp/vice/anno-store.ts` — extend the one `DDL`, bump `SCHEMA_VERSION`

**Analog:** itself (the file already contains three precedent schema bumps: v1→v2, v2→v3).

**The exact `DDL` shape to extend** (verbatim, `src/mcp/vice/anno-store.ts:245-311`):
```sql
export const DDL = `
create table anno_meta (
  id integer primary key check(id = 1),
  schema_version integer not null,
  revision integer not null
);

create table anno_range ( ... );
create table anno_label ( ... );
create table anno_comment ( ... );
create table anno_scope ( ... );
create table anno_enum ( ... );
create table anno_enum_usage (
  id integer primary key autoincrement,
  address integer not null,
  enum_id integer not null references anno_enum(id),
  bank integer,
  unique(address, bank)
);
create table anno_xref ( ... );
create table anno_snapshot ( revision integer primary key );

create index anno_range_end_start on anno_range(end_inclusive, start);
create index anno_label_address on anno_label(address);
create index anno_comment_address on anno_comment(address);
create index anno_enum_usage_address on anno_enum_usage(address);
create index anno_xref_to on anno_xref(to_address);
`;
```
New evidence table(s) (e.g. `anno_evid_range` per Wave 0 gaps) are appended
inside this same template literal — never a second `DDL` string, never a
second store file (`anno-seam.test.ts` forbids the latter structurally).
Follow `anno_enum_usage`'s own shape for a per-address, run-keyed table:
`id integer primary key autoincrement`, the observed fact columns, an index
on the lookup column, and — per the research's run-identity discipline — a
column set that stores `(binary_sha256, argv_digest, seed, address)` rather
than inventing a new "run" or "bracket" label column.

**The version-assertion pattern to copy** (`src/mcp/vice/anno-store.ts:540-542`):
```typescript
if (meta.schema_version !== SCHEMA_VERSION) {
  throw new AnnoStoreCorruptError(`${resolved}: schema_version ${meta.schema_version}, expected ${SCHEMA_VERSION}`, { path: resolved });
}
```
This is strict-equality refusal, never an upgrade path — reuse verbatim; a
version-3 store simply becomes unopenable at version 4, exactly as version-2
became unopenable at version 3 (D-15 precedent).

**The doc-comment discipline to copy** (`src/mcp/vice/anno-types.ts:117-186`,
the `SCHEMA_VERSION` doc comment): every bump names, in prose, above the
constant: what the bump buys, whether a migration arm was written, and the
factual basis for that decision (recorded, not just decided) — the version-3
paragraph is the direct template for the version-4 paragraph EVID-02 requires:
```typescript
/**
 * VERSION 3, 2026-08-29 (D-15) -- AND THE COST IS NAMED HERE RATHER THAN LEFT
 * IN A PLANNING DIRECTORY ...
 * NO MIGRATION ARM WAS WRITTEN, AND THAT IS THE ACCEPTED COST: ...
 * The basis measured on the day of the decision: no store file is tracked
 * in this repository and none exists in its working tree ...
 */
export const SCHEMA_VERSION = 3;
```

---

### `src/mcp/vice/anno-tools.ts` — new `anno_evid_*` verbs via the existing loop, never a second one

**Analog:** the existing 21 `anno_*` entries in `ANNO_TOOL_DEFINITIONS`
(`src/mcp/vice/anno-tools.ts:442` onward).

**Registration entry shape to copy** (`src/mcp/vice/anno-tools.ts:443-467`,
`anno_set_label_name`'s entry — a write verb):
```typescript
{
  name: "anno_set_label_name",
  description: "...", // long prose, states refusal conditions explicitly
  inputSchema: {
    type: "object",
    properties: {
      ...STORE_PROPERTY,
      address: { description: "..." },
      name: { type: "string", description: "..." },
      ...BASE_REVISION_PROPERTY,
    },
    required: ["store", "address", "name"],
  },
},
```
A new `anno_evid_ingest` (write) or `anno_evid_query`/`anno_evid_reconcile`
(read) entry follows this exact shape: `...STORE_PROPERTY` spread first,
domain fields next, `required` always includes `"store"`.

**The registration loop itself — do not duplicate** (`src/mcp/vice/vice-proxy.ts:3436-3439`):
```typescript
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
Adding entries to the array is picked up here with zero edits to
`vice-proxy.ts`.

**Read-only registration** (`src/mcp/vice/anno-tools.ts:1676-1687`):
```typescript
const READ_ONLY_ANNO_VERBS: readonly string[] = Object.freeze([
  "anno_get_symbols",
  "anno_get_comments",
  "anno_get_blocks",
  "anno_save_project",
  "anno_disassemble",
  "anno_read_region",
  "anno_get_binary_info",
  "anno_get_cross_references",
  "anno_search",
  "anno_get_address_details",
]);
```
Any new read-only verb (evidence read-back, the disagreement query) must be
appended here so `openStore` opens it with `mustExist: true`.

**Never-throw dispatch boundary to copy verbatim** (`src/mcp/vice/anno-tools.ts:2339-2358`):
```typescript
export async function runAnnoTool(name: string, args: unknown): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);
    const storePath = resolveStoreArg(name, args);
    const inodeBefore = assertStorePresent(name, storePath);
    const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: READ_ONLY_ANNO_VERBS.includes(name) });
    try {
      assertSameFile(name, storePath, inodeBefore);
      return okText(JSON.stringify(await dispatch(name, args, handle)));
    } finally {
      closeStore(handle);
    }
  } catch (err) {
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = err instanceof Error ? err.message : String(err);
    return errText(`${name} failed: [${errName}] ${errMessage}`);
  }
}
```

**Never-create-on-read refusal to copy** (`src/mcp/vice/anno-tools.ts:1693-1707`):
```typescript
function assertStorePresent(name: string, storePath: string): number {
  if (!existsSync(storePath)) {
    throw new AnnoStorePathError(
      `${name} refused: no annotation store exists at ${JSON.stringify(storePath)} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same. Create the store deliberately first.',
      { path: storePath },
    );
  }
  // ... inode identity captured and compared post-open (WR-04) ...
}
```
The new ingest verb (a write verb) must reuse this discipline: it never
creates the store it was asked to annotate.

---

### `src/mcp/vice/evid-reconcile.ts` (new) — the pure-join reconciliation module

**Analog:** `src/mcp/vice/dxa-proof01-compare.ts` (read in full,
`:1-133`).

**Imports pattern to copy** (`dxa-proof01-compare.ts:44-48`):
```typescript
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import { formatPercent, type ByteDerivedPartition } from "./dxa-partition.ts";
import type { DumpListingMap } from "./dxa-listing.ts";
```
For `evid-reconcile.ts`: import `listRanges()`'s row type from
`anno-store.ts`/`anno-types.ts` and the new evidence row type, never
`node:sqlite` itself (this module must stay outside `anno-seam.test.ts`'s
single-consumer set).

**Input/output shape to copy** (`dxa-proof01-compare.ts:59-95`):
```typescript
export interface Proof01ComparisonInput {
  listing: DumpListingMap;
  groundTruth: ByteDerivedPartition;
}
export interface Proof01Comparison {
  denominator: number;
  recovered: number;
  missed: number;
  unclassifiedOverlap: number;         // a THIRD bucket
  recoveredAddresses: number[];
  missedAddresses: number[];
  overlapAddresses: number[];
  positiveClass: "data";
  tier: "byte-derived";
}
```
For EVID-03: `EvidReconcileInput { blockRows: RangeRow[]; evidenceRows: EvidRow[] }`,
output `{ agreementCount: number; disagreementRows: ...[]; noEvidenceCount: number; denominator: number }`
— disagreement (bytes say `data`, evidence shows `execute:true`) must be the
**first**-named field/bucket, agreement a **count** not a row list, and a
third "no evidence" bucket kept distinct from both (never folded into
agreement).

**The join function shape to copy** (`dxa-proof01-compare.ts:114-133`):
```typescript
export function compareByteDerivedRecovery(input: Proof01ComparisonInput): Proof01Comparison {
  const { listing, groundTruth } = input;
  const denominator = groundTruth.certainCode.size + groundTruth.certainData.size;
  const recoveredAddresses: number[] = [];
  const missedAddresses: number[] = [];
  const overlapAddresses: number[] = [];
  for (const address of groundTruth.certainData) {
    if (listing.unclassified.has(address)) overlapAddresses.push(address);
    else if (listing.data.has(address)) recoveredAddresses.push(address);
    else missedAddresses.push(address);
  }
  // sortAscending() on every returned address array -- never insertion order
  // ...
}
```
Never fetches either side itself — both inputs arrive as plain data the
caller (`anno-tools.ts`'s dispatch case) already fetched via `listRanges()`
and a new `listEvidence()`-shaped read. No VICE observation, no store open,
inside this module.

**Percent formatting to reuse, never hand-roll:**
`formatPercent(numerator, denominator)` from `src/mcp/vice/dxa-partition.ts:139-148`
— refuses a zero denominator by name rather than printing `0.00`/`NaN`/`100.00`.

---

### `src/mcp/vice/evid-ingest.ts` (new, or a `dispatch()` case) — AccessMap → store rows

**Analog (upstream parser, reused verbatim, never re-parsed):**
`src/mcp/vice/textmon-memmap.ts:58-96`:
```typescript
export interface AccessFlags {
  readonly read: boolean;
  readonly write: boolean;
  readonly execute: boolean;   // never derived from read -- its own bit
}
export interface AccessMapEntry {
  readonly address: number;
  readonly io: AccessFlags;
  readonly rom: AccessFlags;
  readonly ram: AccessFlags;
  readonly annotations: readonly AccessAnnotation[];
}
export interface AccessMap {
  readonly entries: readonly AccessMapEntry[];  // SPARSE by design
}
export type AccessMapParseResult = { ok: true; value: AccessMap } | { ok: false; refusal: TextParseRefusal };
export function parseAccessMap(text: string): AccessMapParseResult { /* ... */ }
```
The ingest verb must check `.ok` on this discriminated result and refuse
(never absorb) a `{ ok: false }` refusal rather than writing a partial or
garbled row — mirrors `parseAccessMap()`'s own never-throw discipline
(`textmon-memmap.ts` header: "Never throw on a malformed or drifted input
... Return the discriminated `AccessMapParseResult` instead").

**No-data-from-absence discipline to mirror exactly**
(`src/mcp/vice/textmon-memmap.ts:32-38`, quoted):
```
Never add a field, key, label or enum member anywhere in this module
or its answer types that classifies an address as DATA on the
strength of never having been observed. An address absent from
`AccessMap.entries` is reported only as a count against
`addressesQueried` ... -- never rendered, named, or implied as anything else.
```
The new evidence table and the ingest verb must carry this forward: write a
row only for an observed `execute: true` address (per RESEARCH.md's Code
Examples recommendation), never write a `data`/`not-code` row from an
address's absence.

**Run identity to reuse verbatim, never reinvent** (`src/mcp/vice/capture-predicate.ts:570-596`):
```typescript
/** sha256 over an exact argv array, NUL-joined, lowercase hex. */
export function argvDigest(argv: readonly string[]): string {
  if (!Array.isArray(argv)) throw new CaptureComparisonError("argvDigest: expected an array of argv strings", argv);
  if (argv.length === 0) {
    throw new CaptureComparisonError(
      "argvDigest: refusing to digest an empty argv array -- the digest of nothing is a stable value that would look like a run identity",
      argv,
    );
  }
  // ...
  return createHash("sha256").update(argv.join(ARGV_SEPARATOR), "utf8").digest("hex");
}
```
The evidence table's run-identity columns are `(binary_sha256, argv_digest,
seed)` computed via this function and `compareCaptures()`'s existing binary
sha256 discipline (`src/mcp/vice/capture-predicate.ts:491` onward) — never a
new "bracket"/"scenario" label column.

---

### `.planning/phases/43-.../evidence/evid06-instrumentation-ab.mjs` (new) — the A/B script

**Analog:** `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/frame-anchor-probe.mjs` (git-tracked, verified via `git ls-files`).

**Header/shape to copy** (`frame-anchor-probe.mjs:1-27`):
```javascript
#!/usr/bin/env node
// -----------------------------------------------------------------------------
// frame-anchor-probe.mjs -- Phase 33, plan 33-11, Task 2 (`REPRO-03`).
//
// WHAT THIS MEASURES, AND WHICH DIRECTION IT HAS TO RUN IN
// -------------------------------------------------------
// ... states the antecedent, the risk, and why the probe surveys before it
// concludes, in prose, before any code ...
```
`evid06-instrumentation-ab.mjs` must be a one-off evidence script living
under this phase's own `evidence/` directory (never shipped code, never
imported by anything under `src/mcp/vice/`), stating in its own header: the
S3 sequence reused verbatim (`connect → arm anchor while halted → AUTOSTART →
count hits → REGISTERS_GET`, no `RESET`), the control vs. instrumented run
definitions, and the pass/fail rule fixed *before* the measurement — mirroring
`frame-anchor-probe.mjs`'s own "measures... before it concludes" framing.
Reuses `capture-predicate.ts`'s `compareCaptures()` unmodified for the actual
comparison (RESEARCH.md's Code Examples section, `capture-predicate.ts`
citation).

---

### Structural tests: mirror, do not fork

**`anno-seam.test.ts`'s single-consumer assertion — must stay true after this phase**
(`src/mcp/vice/anno-seam.test.ts:140-147`, quoted):
```typescript
test("node:sqlite is named by exactly one module of the shipped module set (STORE-07)", () => {
  // ...
  assert.deepEqual(importers, [THE_ONE_SEAM], "exactly one shipped module may name the SQLite builtin");
});
```
where `const THE_ONE_SEAM = "anno-store.ts";` (`anno-seam.test.ts:28`). No new
file (`evid-ingest.ts`, `evid-reconcile.ts`, `anno-tools.ts`) may import
`node:sqlite` in any of the four forms this test scans for (static import,
namespace import, dynamic `import()`, `process.getBuiltinModule`/
`createRequire`).

**`capability-registry.test.ts`'s anno-exclusion regex** (`src/mcp/vice/capability-registry.test.ts:187-193`, quoted):
```typescript
// The anno_* family is not a VICE capability at all (D-16/Rule A18), so it
// never enters this test's registry-divergence set either way.
const annoLoopVarMatch = proxySource.match(/for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/);
```
A new `anno_evid_*` entry is excluded from capability-registry checks for
free as long as it is added to the existing `ANNO_TOOL_DEFINITIONS` array and
registered through the existing loop — never a second array/loop name.

**`stock-dispatch.test.ts`'s CR-07 exemption** (`src/mcp/vice/stock-dispatch.test.ts:1624-1630`, quoted):
```typescript
test("structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family", () => {
  // ...
  const bypassing = registrations.filter(([, rhs]) => !rhs.includes("buildBackendAwareTool(")).map(([key]) => key);
});
```
Same consequence: new `anno_evid_*` verbs registered via
`ANNO_TOOL_DEFINITIONS`/`buildViceTool()` are automatically in the exempted
set; a second registration loop would need its own name added to this test's
allow-list by hand.

**`anno-coverage.test.ts`'s COV-01 banned-key regex — the structural pattern
for EVID-04's "no combined figure" enforcement** (`src/mcp/vice/anno-coverage.test.ts:597-609`):
```typescript
test("COV-01: no key anywhere in the report matches a combined-figure vocabulary", () => {
  const banned = /overall|combined|aggregate|composite|score|headline|totalcoverage/i;
  const seen: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { for (const v of value) walk(v); return; }
    if (value === null || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      seen.push(key);
      // ... recurse, then assert none of `seen` match `banned`
    }
  };
  // ...
});
```
Build the new evidence-layer report's banned-key test the same way: walk the
disagreement-query's JSON output recursively, assert no key matches an
equivalent banned vocabulary (e.g. add `overallcoverage`-style combined-figure
words plus anything implying "data from absence" — e.g. ban a bare `data`
boolean/enum value reachable with no accompanying `observed`/`executed`
qualifier, per EVID-04's type-level control requirement).

**`anno-durability.test.ts`'s STORE-04 harness — reuse the shape, extend the case**
(`src/mcp/vice/anno-durability.test.ts:1-49`, structure only, not to be
duplicated as a new file):
```typescript
import { execFileSync, spawn } from "node:child_process";
// ...
const MUTATOR_FILENAME = "anno-durability-mutator.mjs"; // spawned, never imported
const MUTATOR = join(HERE, MUTATOR_FILENAME);
// Blocks until `marker` exists, with a HARD CAP (waitForMarker, Atomics.wait)
// SIGKILL a separate OS process mid-write; a FRESH process reopens and reads
// back BY VALUE.
```
For EVID-05's concurrent-reset case: extend this same file (not a new one)
with a planted scenario using **two distinct run identities** writing
concurrently, asserting a `SIGKILL` mid-ingest for bracket A leaves bracket
B's rows untouched and readable — reuse `waitForMarker()` and the spawned
mutator pattern, add a second mutator invocation with a different
run-identity argv rather than inventing a new harness.

## Shared Patterns

### Never-throw dispatch boundary
**Source:** `src/mcp/vice/anno-tools.ts:2339-2358` (`runAnnoTool`)
**Apply to:** every new `anno_evid_*` tool handler — resolve, never reject;
`finally` always closes the store handle.

### Store-open discipline (never create on read, inode identity check)
**Source:** `src/mcp/vice/anno-tools.ts:1693-1707` (`assertStorePresent`) plus
the post-open `assertSameFile` call in `runAnnoTool`.
**Apply to:** the new ingest verb (a write verb) and any read verb over the
evidence table.

### Pure-join reconciliation shape (denominator, positive class, third bucket)
**Source:** `src/mcp/vice/dxa-proof01-compare.ts:59-133`
**Apply to:** `evid-reconcile.ts` — disagreement-first, agreement-as-count,
explicit third "no evidence" bucket, never a silent merge.

### Percent/rate formatting
**Source:** `formatPercent()`, `src/mcp/vice/dxa-partition.ts:139-148`
**Apply to:** any percentage the reconciliation query or its render surface
prints — refuses a zero denominator by name.

### Run identity (never re-invented)
**Source:** `argvDigest()`, `src/mcp/vice/capture-predicate.ts:570-596`, plus
`compareCaptures()`'s binary-sha256 discipline at `capture-predicate.ts:491`.
**Apply to:** every new evidence row's run-identity columns.

### SQL discipline
**Source:** `src/mcp/vice/anno-store.ts` module header (parameterized
`prepare().run()`, never string interpolation into `exec()`).
**Apply to:** the new table's insert/read functions inside `anno-store.ts`.

### No-data-from-absence
**Source:** `src/mcp/vice/textmon-memmap.ts:32-38` (module header, "WHAT NOT
TO DO") and `anno-coverage.test.ts`'s COV-01 banned-key regex
(`src/mcp/vice/anno-coverage.test.ts:601`).
**Apply to:** the evidence table's schema (no row for an unobserved address),
the runtime classifier's return type (no `data` member — `"code" |
"unobserved"` union per RESEARCH.md's Pitfall 3), and the new structural
banned-key test.

## No Analog Found

None — every file this phase's Wave 0 gaps name has a strong, git-tracked
analog in the existing tree (see table above). RESEARCH.md's own "Don't
Hand-Roll" table independently confirms this: every mechanism the phase needs
(reconciliation shape, run-identity composite, reproducible-run sequence,
percent formatting, store corruption-refusal path) already exists.

## Metadata

**Analog search scope:** `src/mcc/vice/*.ts` (typo-checked: `src/mcp/vice/*.ts`,
`*.mts`, `*.test.ts`), `.planning/phases/33-.../evidence/`.
**Files scanned:** `anno-store.ts`, `anno-types.ts`, `anno-tools.ts`,
`anno-seam.test.ts`, `anno-durability.test.ts`, `anno-coverage.test.ts`,
`dxa-proof01-compare.ts`, `dxa-partition.ts`, `textmon-memmap.ts`,
`capture-predicate.ts`, `block-class.ts`, `capability-registry.test.ts`,
`stock-dispatch.test.ts`, `vice-proxy.ts` (registration loop only),
`frame-anchor-probe.mjs`, `anno-memmap-render.ts` (checked for the NUL-byte
trap via `grep -a`/`grep -an`; contains a NUL byte, confirmed via `grep -ac ""`
returning a line count rather than failing silently — any census of this file
must use `grep -a`).
**Pattern extraction date:** 2026-09-10
