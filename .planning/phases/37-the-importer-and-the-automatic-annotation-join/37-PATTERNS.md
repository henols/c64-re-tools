# Phase 37: The Importer and the Automatic Annotation Join - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 8 (2 new module pairs, 1 modified TS, 1 modified Java, 2 new fixtures, 1 new pre-script, 1 possibly-modified pair)
**Analogs found:** 7 / 8 (the Ghidra "mark range as data" pre-script has NO analog — stated plainly below, per instructions, rather than forced onto a weak match)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/anno-import.ts` | service (importer, container-side) | file-I/O + transform (parse text → store writes) | `src/mcp/vice/anno-tools.ts`'s `runAnnoTool()` dispatch + `dxa-blocks.ts`'s "reads rows a caller passes in, never opens the store" seam discipline | role-match (no prior "parse an external text export and call store writes" module exists; the *shape* of one-open-one-close-per-call and never-touch-sqlite is exact) |
| `src/mcp/vice/anno-import.test.ts` | test | hermetic unit + planted-violation | `src/mcp/vice/sleigh-compile-gate.test.ts` (SKIP_REASON gating, scratch-tree discipline, planted-violation-must-observe-red pattern) | role-match |
| `src/mcp/vice/anno-join.ts` | service (pure transform over store reads + memmap.json) | transform (CRUD read-then-write, no external I/O) | `src/mcp/vice/dxa-blocks.ts` (reads rows a caller supplies, writes derived files, never opens the store itself) | role-match |
| `src/mcp/vice/anno-join.test.ts` | test | unit + planted-violation | `src/mcp/vice/sleigh-compile-gate.test.ts` (planted-violation shape); `anno-store.test.ts` (store round-trip assertions, not read this session but same family) | role-match |
| `src/mcp/vice/anno-tools.ts` (MODIFY) | controller/route (MCP tool registration) | request-response | itself — `anno_set_data_type` / `anno_set_label_name` entries, `ANNO_TOOL_DEFINITIONS` array | exact (extend the same array, same shape) |
| `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` (MODIFY) | service (host-side export writer) | batch/transform | itself — the `## DECOMPILED_TEXT` section, added additively in plan 36-05 | exact (same file, same additive-section precedent) |
| `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a`/`.prg` | fixture (assembly source + build artifact) | batch (build once, commit) | `src/mcp/vice/fixtures/ghidra/bank.a`/`bank.prg` + `fixtures/ghidra/README.md` | exact |
| A new Ghidra pre-script ("mark range as data") | service (host-side Ghidra script) | batch/transform | `src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java`'s `readEntryPoints()`/`createFunction()` loop | role-match, structurally closest, but **no true analog** — nothing in this repo marks a range as *data* before analysis (RESEARCH.md §E confirms this directly) |
| `src/mcp/vice/dxa-blocks.ts` / `dxa-run.ts` (POSSIBLY MODIFY) | service | CRUD/event-driven | itself | exact — RESEARCH.md states this mechanism is already fully built (`emitDataBlocks()`/`emitLabels()` + `knownDataRows`); expect NO changes unless the join needs a `sym` field threaded through that isn't already there |

## Pattern Assignments

### `src/mcp/vice/anno-import.ts` (service, file-I/O + transform)

**Analog:** `src/mcp/vice/anno-tools.ts` (the runner shape) + `src/mcp/vice/dxa-blocks.ts` (the "never open the store yourself" seam discipline)

**The single-seam constraint (must copy verbatim in spirit):**
```typescript
// Source: src/mcp/vice/anno-tools.ts:2090-2101 (runAnnoTool)
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
`anno-import.ts` must NOT hold its own store handle or open/close pair — it is a new `dispatch(name, ...)` branch (or a new verb `anno_import_ghidra_export` whose implementation function lives in `anno-import.ts` but is invoked from inside `anno-tools.ts`'s existing `runAnnoTool()`/`dispatch()`), receiving the ALREADY-OPEN `handle` as an argument, exactly like `putXref`/`setDataType` do. Do not write a second `openStore`/`closeStore` pair anywhere in this file — `anno-seam.test.ts` polices `node:sqlite` naming, and any local sqlite open is a distinct, separately-caught violation of D-06 even if it does not name `node:sqlite` (it would still require a second store-path argument the tool schema doesn't have).

**Path confinement pattern (transfer file argument):**
```typescript
// Source: src/mcp/vice/anno-tools.ts:1467-1469 (resolveStoreArg)
function resolveStoreArg(name: string, args: unknown): string {
  return resolveWorkspacePath(assertStoreArg(name, args));
}
```
`anno-tools.ts`'s own header states this module "must never import `hostpath.ts`" (`hostpath-consumers.test.ts` fixes the consumer set at five modules, and `anno-tools.ts` is not one of them) — the transfer-file path argument the new `anno_import_*` tool takes must be validated the SAME way the store path already is: through `resolveWorkspacePath()`, never through `hostpath.ts`/`containerPath()` directly. Per `ghidra-run.ts`'s own documented posture (RESEARCH §A), the export file's path arrives ALREADY translated by `containerPath()` upstream (inside `runHostToolFromContainer()`), so the importer reads it "AS GIVEN" and only needs workspace-boundary confinement, not translation.

**Error-on-corruption pattern (V5 in RESEARCH's Security Domain):**
```typescript
// Source: src/mcp/vice/anno-store.ts (assertAccessKind / assertDataType shape,
// e.g. anno-types.ts's XREF_ACCESS_KINDS validation used inside putXref())
const accessKind: XrefAccessKind = assertAccessKind(args.accessKind);
```
Follow this "validate before any write" idiom for parsed export lines: a malformed `## REFERENCES` line should throw a named error (mirroring `ViceError`-family construction: `class <X>Error extends Error` with a `message` embedding the offending line/section) BEFORE any `putXref()`/`setDataType()` call, per RESEARCH's "refuse loudly, never partially import" mitigation.

**Digest-and-delete pattern (IMP-02) — no existing precedent, closest shape to imitate:**
```typescript
// Source: src/mcp/vice/host-tool.mts:1361-1372 (digestOutputFile — the shape to imitate for the READ half)
const contents = readFileSync(path);
const sha256 = createHash("sha256").update(contents).digest("hex");
return { path, sha256, byteLength: contents.length };
```
RESEARCH §F confirms explicitly: "IMP-02 is genuinely a new pattern this phase must invent." Compose it from parts that already exist rather than inventing new ones: reuse `digestOutputFile()`'s hash shape for the digest half, and delete the file with `unlinkSync()` ONLY after every `applyWrite()`-backed store call in the batch has returned (i.e., after the `try` body inside `runAnnoTool()`'s open/close pair fully succeeds) — never delete-then-write. Do this deletion inside the SAME tool call, not a follow-up one, per D-06.

---

### `src/mcp/vice/anno-join.ts` (service, transform)

**Analog:** `src/mcp/vice/dxa-blocks.ts` (the "reads rows a caller already fetched, never opens the store" discipline) — read in full, header quoted:
```
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` ... It also NEVER NAMES `node:sqlite` and
// NEVER OPENS THE STORE FILE ITSELF: `anno-store.ts` is the one module
// `anno-seam.test.ts` allows to name that dependency, and this module reads
// only the ALREADY-FETCHED rows a caller passes in (typically
// `anno-store.ts`'s own `listRanges()` result...)
```
`src/mcp/vice/dxa-blocks.ts:14-22` (verbatim above). Copy this exact posture: `anno-join.ts` takes `listXrefs()`/`listRanges()` results (or a store `handle` supplied by the calling tool, per whichever shape the planner chooses) as plain data, computes the three selection rules + bank decode + graphics derivation as pure functions, and returns rows to write — the ACTUAL `putXref()`/`setDataType()` calls happen at the call site (inside a `runAnnoTool()`-opened session), not inside `anno-join.ts` itself, UNLESS the planner deliberately makes `anno-join.ts` itself a dispatch target that receives the open handle (mirroring how `putXref`/`setDataType` in `anno-store.ts` take `handle` as their first argument). Either is consistent with D-06 as long as no second open/close pair is introduced.

**The store's read-back APIs to call (verbatim, read this session):**
```typescript
// Source: src/mcp/vice/anno-store.ts:3440-3466 (putXref)
putXref(handle, {
  fromAddress: 0x0812,
  toAddress: 0x0001,
  accessKind: "WRITE",   // one of XREF_ACCESS_KINDS: READ | WRITE | READ_WRITE | COMPUTED_JUMP
});

// Source: src/mcp/vice/anno-store.ts:2322-2352 (setDataType)
setDataType(handle, {
  start: 0xd020,
  endInclusive: 0xd020,
  dataType: "byte",   // no graphics-specific member exists in the frozen twelve (DATA_TYPES, anno-types.ts:213-226)
});
```
Both functions insert `bank: null` today (`putXref`'s insert statement hard-codes the fourth bound parameter to `null`, `anno-store.ts:3440-3466`) — AUTO-04's bank-state write is the first caller in this project's history to need a non-null `bank`. Expect to touch `putXref()`'s call site (and possibly `listXrefs()`/`listRanges()`'s pass-through, which already reads the column) to accept a `bank` argument; this is new plumbing inside `anno-store.ts`, not something `anno-join.ts` can work around from outside the seam.

**memmap.json is read as a static file, never mutated** — `anno-join.ts` should treat it exactly the way `c64-memory-mapping`'s skill scripts already treat it (a plain JSON load, `{ sources, entries }`, `start`/`end` inclusive integers) — no existing loader module was found in `src/mcp/vice/*.ts` to reuse verbatim; RESEARCH §C measured the schema directly via a Python json load, so plan to write a small local loader inside `anno-join.ts` (or a sibling `memmap-lookup.ts`, per the Recommended Project Structure) rather than importing skill-side script code.

---

### `src/mcp/vice/anno-tools.ts` (MODIFY — extend `ANNO_TOOL_DEFINITIONS`)

**Analog:** an existing entry, verbatim, to copy the shape from:
```typescript
// Source: src/mcp/vice/anno-tools.ts:498-521 (anno_set_data_type, the closest
// existing entry in shape: STORE_PROPERTY spread, address-range args,
// BASE_REVISION_PROPERTY spread, required array)
{
  name: "anno_set_data_type",
  description:
    "Types an inclusive address range, preserving whatever the overlapping rows said about the addresses outside it. " +
    "...",
  inputSchema: {
    type: "object",
    properties: {
      ...STORE_PROPERTY,
      start_address: { description: "Start of the range, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
      end_address: { description: "End of the range, INCLUSIVE. A one-byte range has end_address === start_address." },
      data_type: { /* ... */ },
      ...BASE_REVISION_PROPERTY,
    },
    required: ["store", "start_address", "end_address", "data_type"],
  },
},
```
A new `anno_import_ghidra_export` (or similarly-named) entry follows this EXACT shape: `...STORE_PROPERTY` spread (the store path arg), a new property for the transfer-file path (validated the same way, per the path-confinement pattern above), `...BASE_REVISION_PROPERTY` spread if the write should support optimistic-concurrency, and a `required` array. **Add entries to this SAME array — never a second array, second loop, or second `tools[key] = ...` registration.** The registration loop this feeds (verbatim):
```typescript
// Source: src/mcp/vice/vice-proxy.ts:3388-3390
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
This loop is unaffected by array length — `stock-dispatch.test.ts`'s `BACKEND_SEAM_BYPASS_KEYS` stays a 2-entry, order-sensitive array (`["RESULT_CONTINUE_TOOL.name", "annoDef.name"]`) regardless of how many `anno_*` entries exist. MCP-02 is satisfied by construction for every entry added here, per the comment immediately above this loop in `vice-proxy.ts` (quoted in RESEARCH §B) — no interception code is needed in the new tool itself.

**Guards a new entry must also satisfy (from RESEARCH §B, condensed):**
- `anno-verb-coverage.test.ts`'s hand-maintained `REAL_VERBS = ["coverage", "export-asm", "render-memmap"]` (`anno-verb-coverage.test.ts:53`) — if a CLI verb is added (e.g. `anno import`), add it here AND document it in at least one `src/skills/` file.
- `anno-derivation.test.ts` — any new `anno_*` tool name needs a matching `anno-register.ts` entry (`annoRegisterEntryFor()`, `anno-register.ts:238`) or the bidirectional route check reddens.
- `check-skill-tool-coverage.mjs` — the new tool name needs a citation somewhere under `src/skills/`.

---

### `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` (MODIFY — additive `## BANK_WRITES` section)

**Analog:** the file's own `## DECOMPILED_TEXT` section, added additively in plan 36-05 — this is a same-file, same-precedent analog, not a different file.

**The fixed-order section-writing pattern (verbatim shape to imitate):**
```java
// Source: src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java:259-273
// (## REFERENCES, the closest existing section in shape: a StringBuilder,
// one line per fact, a trailing _COUNT line, no cap)
referencesSection.append("## REFERENCES\n");
// ... while (ri.hasNext()) { ... referencesSection.append(rf.getFromAddress())
//         .append(" -> ").append(rf.getToAddress()).append(" ")
//         .append(rf.getReferenceType()).append("\n"); }
referencesSection.append("## REFERENCE_COUNT ").append(referenceCount).append("\n");
```
A new `## BANK_WRITES` section (Open Question 1's recommendation) follows this exact shape: a `StringBuilder`, opened with its own `## BANK_WRITES\n` header, one line per resolved immediate STORE to `$0001` (`<address> <constant-value>`), a trailing `## BANK_WRITES_COUNT <n>` line, and — per the file's own documented discipline — an explicit not-found line when none are found (mirroring `## STRUCTURAL_FACTS`'s five-fact-kind "each with an explicit not-found line when absent" rule, `GhidraStructExport.java:7-8`). Append this new section AFTER the existing six, in the same single `PrintWriter` pass, at the same fixed-order write site:
```java
// Source: src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java:483
// ---- Write every section, in the fixed order, opened for OVERWRITE.
```
Do this additively — never rename or reorder the existing five sections (`## CLASSIFICATION`, `## REFERENCES`, `## STRUCTURAL_FACTS`, `## DECOMPILE_ACCOUNTING`, `## UNRESOLVED_DISPATCH`, `## DECOMPILED_TEXT`), since 36-04's own live GATE 1/2/3 tests assert against the current fixed order and this file's header states the additive-only convention explicitly (header comment: `"A `## `-delimited plain-text file, one fact per line, in a FIXED section order"`).

---

### `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a` / `.prg` (NEW fixture)

**Analog:** `src/mcp/vice/fixtures/ghidra/bank.a` / `bank.prg`, and `fixtures/ghidra/README.md`'s own documented build/provenance convention.

**Exact build command to reuse (verbatim from the README):**
```
$ acme -f cbm -o fixtures/ghidra/bank-path-dependent.prg fixtures/ghidra/bank-path-dependent.a
[exit 0]
```
Run from `src/mcp/vice/`, ACME 0.97 "Zem" (31 Jan 2021) confirmed present. Commit BOTH the `.a` source and the assembled `.prg`, and add a new section to `fixtures/ghidra/README.md` (or a sibling README) recording: the exact command, version, date, byte counts, and sha256 of both files — following the EXACT table shape `bank.a`/`bank.prg`'s own entry uses (see the `| File | Bytes | sha256 |` table, `fixtures/ghidra/README.md`). Also record the `.prg`-route header-offset correction (`README.md`'s own "CORRECTED 2026-09-04" section) as it applies to the NEW fixture's own labels — the two-byte load-address header shift is a property of the `.prg` route generally, not specific to `bank.a`, so the new fixture's README entry must account for it the same way.

**Structural requirement `bank.a` does NOT satisfy (confirmed, RESEARCH §D):** the new fixture MUST contain a single shared program point (a subroutine at a fixed address, or an instruction reached via two different callers/paths) that is reached under two DIFFERENT `$01` bank states — `bank.a` is straight-line code with no such site and is confirmed unusable for AUTO-04/AUTO-05's criteria no matter how it is read.

---

### A new Ghidra pre-script ("mark range as data", AUTO-07's Ghidra-side feedback half)

**No analog exists.** RESEARCH §E states this directly: `ghidra.analyze`'s seven existing wire fields cover script wiring and entry-point seeding; none marks a range as data before analysis. The closest STRUCTURAL analogue — not a true precedent, offered only as the shape to follow for the new script's plumbing, not its semantics — is `VolatileCarve.java`'s entry-point-seeding loop:
```java
// Source: src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java:135,191-193
// (readEntryPoints() reads a file of addresses; createFunction() is called per address)
private List<Address> readEntryPoints(AddressSpace sp) throws Exception { /* ... */ }
// ...
for (Address entry : readEntryPoints(sp)) {
    // ...
    createFunction(entry, null);
}
```
An equivalent `readDataRanges()` (reading a similarly-formatted range file, supplied the same way `entrypointsPath` is supplied to `VolatileCarve.java` today per `ghidra.analyze`'s wiring) calling `Listing.createData()` (or clearing+retyping a range as undefined data) is the natural extension — but this is NEW SCRIPT LOGIC with no committed precedent to copy from, not a modification of an existing mechanism. The planner should treat this as greenfield within the additive-pre-script pattern, not as "port an existing capability."

## Shared Patterns

### The single seam (`anno-store.ts`)
**Source:** `src/mcp/vice/anno-store.ts:1-19` (header), `putXref()` (`:3440-3466`), `setDataType()` (`:2322-2352`)
**Apply to:** `anno-import.ts`, `anno-join.ts` — neither may name `node:sqlite`, open the `.db` file, or hold a store handle across calls. Both take an already-open `handle` (or plain row data) as an argument.
```typescript
putXref(handle, { fromAddress, toAddress, accessKind });
setDataType(handle, { start, endInclusive, dataType });
```

### One-shot store session per tool call (D-06)
**Source:** `src/mcp/vice/anno-tools.ts:2090-2101` (`runAnnoTool`)
**Apply to:** whichever tool call ends up parsing the ENTIRE transfer file and issuing every write — must all happen inside ONE `runAnnoTool()` invocation, with `closeStore()` in a `finally`.

### Extend the array, never register a second family
**Source:** `src/mcp/vice/anno-tools.ts:438` (`ANNO_TOOL_DEFINITIONS`), `src/mcp/vice/vice-proxy.ts:3388-3390` (registration loop), `src/mcp/vice/stock-dispatch.test.ts:1507-1510` (`BACKEND_SEAM_BYPASS_KEYS`)
**Apply to:** `anno-tools.ts`'s modification — 1-3 new entries in the SAME array.

### Additive-only export sections
**Source:** `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` header comment + `## DECOMPILED_TEXT`'s plan-36-05 precedent
**Apply to:** the new `## BANK_WRITES` section — append after the existing six, never reorder or rename them.

### Path confinement without `hostpath.ts`
**Source:** `src/mcp/vice/anno-tools.ts:1467-1469` (`resolveStoreArg` → `resolveWorkspacePath()`), `src/mcp/vice/hostpath-consumers.test.ts:1-23` (closed five-module consumer set)
**Apply to:** any new path-bearing argument on the importer tool (the transfer-file path) — confine via `resolveWorkspacePath()`, never import `hostpath.ts`/`containerpath.ts` directly from `anno-tools.ts` or `anno-import.ts`.

### Planted-violation-observed-red test shape
**Source:** `src/mcp/vice/sleigh-compile-gate.test.ts:310-360` (the `:NOP imm16` revert case) — the worked example for the six red transcripts this phase requires (Pitfall 23)
**Apply to:** `anno-import.test.ts`, `anno-join.test.ts` — each planted-violation case: (1) mutates a SCRATCH copy only, never the committed fixture; (2) asserts the specific, named failure signal (not just "non-zero"/"different"); (3) tears down the scratch tree in a `finally`; (4) is cross-referenced by a `.planning/phases/37-.../evidence/37-0N-topic.md` transcript, per the established evidence-file convention (RESEARCH §G).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| A new Ghidra "mark range as data" pre-script | service (host) | batch/transform | RESEARCH §E confirms directly: no existing wire field, no existing script logic marks a range as data before analysis. `VolatileCarve.java`'s entry-point loop is structurally adjacent (reads addresses from a file, calls a Ghidra API per address) but marks CODE, not data — a semantically different operation. Plan this as new work, following the additive-pre-script PATTERN only, not any existing DATA-marking precedent. |
| IMP-02's transfer-file digest-and-delete discipline | (spans importer + host-tool seam) | file-I/O | RESEARCH §F confirms directly: no existing "transfer file, consumed and deleted in the same command" convention exists anywhere in this repo. `digestOutputFile()`'s `{path, sha256, byteLength}` shape (`host-tool.mts:1361-1372`) is the closest precedent for the DIGEST half only; the deletion half is genuinely new. |
| `memmap.json`'s three selection rules as a lookup module | container (pure data) | transform | No existing `src/mcp/vice/*.ts` module loads/queries `memmap.json` programmatically — only skill-side scripts under `src/skills/c64-memory-mapping/` touch it, and RESEARCH did not identify one as a reusable loader. Plan a small local loader inside `anno-join.ts` (or `memmap-lookup.ts`) rather than importing skill code. |

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts`, `src/mcp/vice/*.test.ts`, `src/mcp/vice/vendor/ghidra-scripts/*.java`, `src/mcp/vice/fixtures/ghidra/`
**Files scanned:** `anno-store.ts`, `anno-types.ts`, `anno-tools.ts`, `anno-register.ts`, `dxa-blocks.ts`, `dxa-run.ts`, `vice-proxy.ts`, `stock-dispatch.test.ts`, `hostpath-consumers.test.ts`, `host-tool.mts`, `sleigh-compile-gate.test.ts`, `GhidraStructExport.java`, `VolatileCarve.java`, `fixtures/ghidra/README.md`, `fixtures/ghidra/bank.a`
**Pattern extraction date:** 2026-09-05
