# Phase 46: The Lossless-Export Invariant and the Provenance Carry - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 5 (2 modified, 1 new module + 1 new test file, 1 possibly-modified)
**Analogs found:** 5 / 5 (all closed-tree, git-tracked)

All paths below were verified with `git ls-files -- <path>` (non-empty output = tracked). No gitignored mirror was ever the closest analog — every analog lives directly under `src/mcp/vice/` or `src/skills/c64-provenance-diff/scripts/`, this repo's real tracked source tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/anno-export-asm.ts` (MODIFY) | service / transform (pure store-rows+bytes → ACME text) | batch / transform | itself — extend in place, following its own `AUTO_NAME_MARKER`/refusal conventions | exact (same file) |
| `src/mcp/vice/anno-export-asm.test.ts` (MODIFY) | test | transform / structural-guard | itself — extend in place, following its own `buildStore()`, `PLANTED VIOLATION N`, and WR-07 idioms | exact (same file) |
| new ledger-reader module (e.g. `src/mcp/vice/provenance-ledger.ts`, planner-named) | utility / parser | transform (text-in → typed-rows-out) | `src/skills/c64-provenance-diff/scripts/diff-images.mjs`'s `renderLedger()` (the writer whose format this reads) + `anno-store.ts`'s refusal-by-name style | role-match (no existing *reader* analog — this is genuinely new) |
| new ledger-reader test file (sibling `*.test.ts`) | test | transform | `src/mcp/vice/anno-bank.test.ts` (RED-first TDD precedent) + `src/skills/c64-provenance-diff/scripts/diff-images.test.mjs` (fixture-via-pure-API precedent) | role-match |
| `src/mcp/vice/anno-types.ts` (MODIFY, conditional on exclusion table) | model / schema | CRUD | itself — `SCHEMA_VERSION` doc-comment block (EVID-02 template) | exact (same file) |
| `src/mcp/vice/anno-store.ts` (MODIFY, conditional on exclusion table) | model / schema (SQLite DDL + writer verbs) | CRUD | itself — `anno_evid_exec` table added at `SCHEMA_VERSION` 4 | exact (same file) |
| `src/mcp/vice/anno-tools.ts` (MODIFY, if exclusion setter becomes an MCP tool) | controller (MCP tool registration + dispatch) | request-response | itself — `anno_add_scope` / `anno_remove_scope` paired-verb registration | exact (same file) |

## Pattern Assignments

### `src/mcp/vice/anno-export-asm.ts` (service, transform) — extend in place

**Analog:** itself. Three existing conventions to copy exactly, not re-derive.

**1. The "mark, never drop, never silently resolve" marker convention** (`anno-export-asm.ts:522-541`, confirmed current line numbers):
```ts
/**
 * The fixed trailing comment that marks an auto-generated symbol name in the
 * emitted source. ONE spelling, in one place: a second wording would make the
 * marker ungreppable for the human reading the generated assembly, which is the
 * only reader it exists for.
 */
const AUTO_NAME_MARKER = "  ; auto-generated name -- still in the annotation backlog";

/**
 * The fixed trailing comment that marks a definition at an address carrying
 * MORE THAN ONE store label (30-REVIEW WR-02). ONE spelling, in one place, for
 * the same reason `AUTO_NAME_MARKER` is: a second wording makes it ungreppable
 * for the only reader it exists for.
 * ...
 */
const ALIAS_MARKER_PREFIX = "  ; ALIAS: this address also carries ";
```
A `PROVENANCE_MARKER_PREFIX` constant for the new verdict+confidence comment must follow this exact shape: one `const`, one doc-comment explaining WHY a second spelling would be wrong, declared once, applied verbatim at every call site. Do **not** reach for the `; PROVENANCE:` string that appears in `diff-images.mjs`'s `renderLedger()` header comment — RESEARCH.md's own flagged finding (Pitfall 6) confirms that string is an unrelated, unwired, forward-looking comment about a *different* concern, not existing precedent to inherit.

**2. The lossless block-construction loop — the invariant BUILD-07 must preserve** (`anno-export-asm.ts:857-890`, confirmed current lines: `sortedRanges` at 857, `blocks` map at 862-890):
```ts
if (ranges.length === 0) {
  throw new Error(
    `exportAsm: the annotation store at "${storePath}" holds no ranges -- refusing to emit an empty ACME source, ` +
      `because "nothing is annotated" and "the export produced nothing" must not read the same.`,
  );
}

const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);

const blocks: ExportBlock[] = sortedRanges.map((row) => ({
  start: row.start,
  endExclusive: row.endInclusive + 1,
  dataType: assertDataTypeForExport(row) as string,
  lineCount: 0,
}));
```
This is a bare `.map()` — 1:1 with `sortedRanges`, never `.filter()`. Any ledger/exclusion lookup added by this phase must attach a **comment field** onto each block (or thread a lookup into `content` before `emitBlock()` is called), never gate which rows reach this `.map()` or which blocks the emission loop below it reaches.

**3. The refusal-by-name shape** (`anno-export-asm.ts:851-854` and `:896-900`, both confirmed current):
```ts
throw new Error(
  `exportAsm: the annotation store at "${storePath}" holds no ranges -- refusing to emit an empty ACME source, ` +
    `because "nothing is annotated" and "the export produced nothing" must not read the same.`,
);
```
```ts
throw new Error(
  `exportAsm: the range ${hex4(block.start)}..${hex4(block.endExclusive - 1)} (inclusive) is not covered by the ` +
    `image at "${imagePath}", which covers ${hex4(imageStart)}..${hex4(imageEndExclusive - 1)} (inclusive). ` +
    `Refusing to export a range whose bytes the image does not contain.`,
);
```
Pattern: `exportAsm: <what was checked> -- refusing to <action>, because <the specific bad outcome this prevents>.` A "ledger absent" refusal (BUILD-05 criterion 4) must match this exact shape — name the requested path, state what was tried, name the remedy — and must never interpolate the ledger's own file *contents* (see Comment-text validator below).

**4. The comment-text validator to reuse, never re-derive** (`anno-export-asm.ts:667-679`, confirmed current):
```ts
export function assertExportableCommentText(text: string, address: number): string {
  try {
    return assertCommentText(text);
  } catch (err) {
    const reason = err instanceof AnnoCommentError && err.reason !== undefined ? err.reason : "refused by the store's comment-text vocabulary";
    throw new Error(
      `exportAsm: the comment at ${hex4(address)} cannot be emitted (${reason}). Every comment this exporter emits is a single line of text ` +
        `that the store's own comment-text vocabulary accepts; a stored line break would put everything after it into the ACME source at ` +
        `column zero, as assembler input rather than as a comment. REFUSED rather than repaired -- stripping or truncating here would change ` +
        `what somebody wrote and report success.`,
    );
  }
}
```
Every ledger-derived free-text field that reaches an emitted comment (the Evidence/Reason cell, an exclusion reason) must route through this exact function — call site precedent at `anno-export-asm.ts:779` (`const checked = assertExportableCommentText(row.text, row.address);`). Do not write a second validator.

---

### `src/mcp/vice/anno-export-asm.test.ts` (test) — extend in place

**Analog:** itself. Three idioms to copy exactly.

**1. `buildStore()` fixture builder** (`anno-export-asm.test.ts:163-181`, confirmed current):
```ts
/**
 * ... every row in a fixture has passed the same validators a
 * live `anno_*` tool call would have passed it through.
 */
function buildStore(dir: string, spec: StoreSpec): StoreFixture {
  mkdirSync(dir, { recursive: true });
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([spec.origin & 0xff, (spec.origin >> 8) & 0xff, ...spec.body]));

  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    for (const range of spec.ranges) setDataType(handle, range);
    for (const label of spec.labels ?? []) setLabel(handle, { ...label, kind: "User" });
    for (const comment of spec.comments ?? []) setComment(handle, comment);
    for (const projectEnum of spec.enums ?? []) createProjectEnum(handle, projectEnum);
    for (const usage of spec.enumUsage ?? []) applyEnumUsage(handle, usage);
  } finally {
    closeStore(handle);
  }

  return { dir, storePath, imagePath };
}
```
`StoreSpec` has no provenance/verdict field — the planted-control fixture needs a **second**, separate synthetic ledger artifact built via `renderLedger()`'s own pure API (see ledger-reader analog below), joined by address at test time. Do not add a `provenance` field to `StoreSpec` — keep the two fixtures separate, matching the real architectural separation (store vs. ledger are genuinely different data sources).

**2. `PLANTED VIOLATION N` idiom** (`anno-export-asm.test.ts:439`, `:466`) — the template for BUILD-07 criterion 1's planted control, inverted per RESEARCH.md's own note: build a test-only, deliberately-filtering variant of `exportAsm()` (e.g. one added `.filter(r => r.verdict !== "CRACKER-PATCH")` line, local to the test file, never shipped), run it over the planted fixture, assert the excluded range is MISSING — establishing the control can fail — then run the real, shipped `exportAsm()` over the same fixture and assert the range IS present.

**3. WR-07 structural source-text-scan guard — the exact template for the "no threshold" structural regression test** (`anno-export-asm.test.ts:866-878`, confirmed current):
```ts
test("the exporter hands decode() the INCLUSIVE bound (30-REVIEW WR-07)", () => {
  // Structural, over the module's own source: ...
  const source = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  assert.match(
    source,
    /decode\(slice, block\.start, \{ end: block\.endExclusive - 1 \}\)/,
    "the ONE decode() call must pass an INCLUSIVE end -- `end: block.endExclusive` is WR-07",
  );
});
```
Copy this shape verbatim for BUILD-07's structural guard: `readFileSync` the module's own source, `assert.match` pinning the exact `.map()` block-construction line quoted above (positive assertion, more robust than a negative `doesNotMatch` per RESEARCH.md's own recommendation), plus a behavioral assertion `blocks.length === sortedRanges.length` in a companion test.

**4. Non-vacuity assertion precedent** (`anno-coverage.test.ts:918-923`, confirmed tracked):
```ts
assert.ok(
  Array.isArray(store.symbols) && store.symbols.length > 0,
  `the ${WELL_DOCUMENTED} fixture must actually carry symbols -- otherwise the zero asserted below is an empty ` +
    "input, not a collapse, and this test measures nothing",
);
```
Apply the same discipline to the planted-control fixture: assert the fixture genuinely contains the range/verdict that would trigger a hypothetical filter, before asserting it survives.

---

### New ledger-reader module (path TBD by planner, e.g. `src/mcp/vice/provenance-ledger.ts`)

**Analog:** `src/skills/c64-provenance-diff/scripts/diff-images.mjs`'s `renderLedger()` (`:677-721`, confirmed current) — this is the writer whose exact output format the new reader must parse. Do not duplicate its verdict/confidence derivation; only parse its emitted text.

**The exact format to parse** (`diff-images.mjs:696-709`, confirmed current):
```js
let generated = `<!-- GENERATED, DO NOT HAND-EDIT. Regenerate with: node .claude/skills/c64-provenance-diff/scripts/diff-images.mjs ledger --gap-tolerance ${gapTolerance} -->\n\n`;
generated += `| Start | End | Kind | Verdict | Confidence | Agreeing releases | Evidence / Reason |\n`;
generated += `|---|---|---|---|---|---|---|\n`;
for (const r of sorted) {
  const confidence =
    r.verdict === "ORIGINAL" ? (r.agreeing_releases >= 3 ? "HIGH" : "MEDIUM-HIGH") :
    r.verdict === "CRACKER-PATCH" ? "HIGH (patch), MEDIUM-LOW (what original there replaced)" :
    "LOW";
  const kind = D02_KINDS.has(r.kind) ? r.kind : (r.kind ?? "unresolved");
  const text = (r.evidence || r.reason || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  generated += `| ${hex4(r.start)} | ${hex4(r.end)} | ${kind} | ${r.verdict} | ${confidence} | ${r.agreeing_releases} | ${text} |\n`;
}
```
Seven columns, fixed header row, pipe-escaped cell text (`\|`), single-line cells (newlines already collapsed by the writer). The reader must reject — never best-effort-parse — any row that doesn't match this exact 7-column shape (project's reject-not-repair discipline, CLAUDE.md).

**`renderLedger()`'s refusal preconditions the reader can rely on as invariants of a well-formed ledger** (`diff-images.mjs:679-694`, confirmed current): UNKNOWN rows always carry a non-empty reason; ORIGINAL rows always carry `agreeing_releases >= 2`; the full range set always covers exactly `$0000-$FFFF` with no gap or overlap. A hand-edited file violating these was never producible by the writer — treat a violation as evidence of tampering/corruption and refuse by name (V5 Input Validation, ASVS).

**Refusal-by-name style to copy** — same three shapes cited in `anno-export-asm.ts` above, plus the host-tool family precedent (`host-tool.mts:1475`, confirmed tracked):
```ts
message: `host_tool "dxa.disassemble" refuses: the vendored dxa binary does not exist (tried: ${dxaFound.tried.join(", ")}) -- run "bash vendor/dxa/build.bash build" to produce it`,
```
And the store schema-mismatch refusal (`anno-store.ts`, `SCHEMA_VERSION` check, confirmed present at `anno-types.ts:261` / referenced refusal in `anno-store.ts`):
```
${resolved}: schema_version ${meta.schema_version}, expected ${SCHEMA_VERSION} -- refusing to open rather than upgrade. This file is
  left exactly as it was: nothing on it is read, rewritten or deleted by this refusal. ...
```
A "ledger absent/malformed" refusal should: name the requested path; state what shape was expected vs. found (line number, not content); name the remedy ("run `c64-provenance-diff`'s `ledger` verb first, or omit `--ledger` to export without provenance annotation"). Never interpolate the ledger's own row text into the error (V5/Information-Disclosure, matches the "never quote a read file's own bytes" rule already documented in `anno-export-asm.ts`'s header).

---

### New ledger-reader test file

**Analog 1 — RED-first TDD precedent, the strongest real match found in this suite for criterion 1's "observed failing first" requirement** (`anno-bank.test.ts:1-5`, confirmed current):
```ts
// anno-bank.test.ts -- Phase 37 plan 37-06, Task 1 (AUTO-04/AUTO-05): the
// processor-port bit decode, the region resolution, and the decline. Every
// `<behavior>` bullet below is written FIRST and observed to fail before the
// implementation in `anno-bank.ts` / `anno-join.ts` exists, per this plan's
// own TDD instruction.
```
This is a file-header-level declaration of "written first, observed red before the implementation existed" — the direct precedent for how the plan should document BUILD-07's planted control having been proven to fail against a genuinely filtering variant.

**Analog 2 — an even more concrete inline precedent, a test whose comment records the actual by-hand negative-control run** (`channel-lock.test.ts:108-118`, confirmed current):
```ts
// FIFO: op-1 (enqueued first) wakes first, then op-2, then op-3.
// DISCRIMINATING POWER (recorded per the plan's own requirement): a LIFO
// variant -- wakeNext() implemented as `queue.pop()` instead of
// `queue.shift()` (equivalently, an enqueue that used `unshift()`) --
// would instead wake op-3 first, then op-2, then op-1, producing
// ["op-3", "op-2", "op-1"] here and failing this exact assertion. This
// test was run by hand against that LIFO variant during authoring and
// observed to fail with that reversed order, confirming the assertion
// below actually distinguishes the two disciplines rather than merely
// reading whichever order happens to fall out.
assert.deepEqual(order, ["op-1", "op-2", "op-3"]);
```
This is the **exact template** for BUILD-07 criterion 1's planted-control comment: name the specific broken variant tried (here, `pop()` vs `shift()`; for BUILD-46, a `.filter(r => r.verdict !== ...)` line), state what output it would have produced, and record that it was actually run and observed to fail. Use this comment shape verbatim in the new planted-control test.

**Analog 3 — pure, filesystem-free fixture construction** (`diff-images.mjs:677` signature, exercised at `diff-images.test.mjs:507-551`, both confirmed tracked): build synthetic `generatedRanges` arrays and call `renderLedger({ generatedRanges, gapTolerance, prose })` directly, with zero filesystem I/O, exactly as the existing `diff-images.test.mjs` suite already does. Reuse this same call shape for the ledger-reader's own fixtures rather than writing files to a temp directory and re-reading them (round-trip through the reader is fine as an additional assertion, but the *source* fixture should be built via `renderLedger()`'s pure API per RESEARCH.md's own recommendation).

---

### `src/mcp/vice/anno-types.ts` (conditional MODIFY — only if exclusion table needs a schema bump)

**Analog:** itself, the `SCHEMA_VERSION` 4 doc-comment block (confirmed: `SCHEMA_VERSION = 4` at `anno-types.ts:261`, doc-comment starting ~`:186`). Structure to copy verbatim (heading shape, not literal 2026-09-10 content):
```
VERSION <N>, <date> (<REQ-ID>) -- THE DECISION IS <decision-name>, AND THE FACTUAL BASIS IS TRANSCRIBED HERE RATHER THAN LEFT IN A PLANNING DIRECTORY...
WHAT THE BUMP BUYS: <table/column>, the <one-line description>...
THE OPTION SELECTED, BY NAME: <name>. ...
THE FACTUAL CHECK, RUN <date>, SCOPE <machine/environment>: [numbered evidence]
THE REVERSAL CONDITION, RECORDED SO THIS DOES NOT QUIETLY HARDEN INTO PRECEDENT: ...
```
If BUILD-07's exclusion mechanism needs a bump to `SCHEMA_VERSION = 5`, this doc-comment block is the mandatory template (ROADMAP.md's own Phase 46 note names it explicitly).

---

### `src/mcp/vice/anno-store.ts` (conditional MODIFY — exclusion table DDL)

**Analog:** the `anno_evid_exec` table, added at `SCHEMA_VERSION` 4 (`anno-store.ts:330-338`, confirmed current, plus its index at `:345`):
```sql
create table anno_evid_exec (
  id integer primary key autoincrement,
  image_sha256 text not null,
  argv_digest text not null,
  seed text not null,
  address integer not null,
  source_bank text not null,
  unique(image_sha256, argv_digest, seed, address, source_bank)
);

create index anno_evid_exec_address on anno_evid_exec(address);
```
The project's stated precedent (RESEARCH.md A4) is a **new table**, not a nullable column bolted onto `anno_range`. Existing tables for reference (`anno-store.ts:272-346`, confirmed current):
```sql
create table anno_range (
  id integer primary key autoincrement,
  start integer not null,
  end_inclusive integer not null,
  data_type text not null,
  bank integer
);

create table anno_scope (
  id integer primary key autoincrement,
  start integer not null,
  end_inclusive integer not null
);
```
**Confirmed correction to RESEARCH.md's own upstream architecture note:** `anno_range` has no `scope` column — verified directly against this DDL. An exclusion/provenance lookup keyed by scope must derive containment by address range, never assume a stored FK.

---

### `src/mcp/vice/anno-tools.ts` (conditional MODIFY — if exclusion setter becomes an MCP tool pair)

**Analog:** `anno_add_scope` / `anno_remove_scope` paired-verb registration (all line numbers confirmed current):
- Tool definitions: `anno-tools.ts:593` (`anno_add_scope`), `:613` (`anno_remove_scope`)
- Argument validation dispatch: `:1898-1899` (`if (name === "anno_add_scope") return assertScopeArgs(...)`, mirrored for remove)
- Write dispatch: `:2126` (`const written = name === "anno_add_scope" ? addScope(handle, span) : removeScope(handle, span);`)
- Outer dispatch gate: `:2986` (`if (name === "anno_add_scope" || name === "anno_remove_scope") return dispatchScope(name, handle, args);`)

If the plan adds `anno_exclude_range` / `anno_include_range`, follow this identical four-site registration pattern: `ANNO_TOOL_DEFINITIONS` entry pair, `assert*Args` validation arm pair, a single `written = name === X ? setter(...) : unsetter(...)` write dispatch, and one outer-gate `if` clause naming both verbs. `vice-proxy.ts`'s `ANNO_TOOL_DEFINITIONS` loop needs no separate change (confirmed by RESEARCH.md, not independently re-verified this session — low risk, mechanical fact).

## Shared Patterns

### Refusal-by-name (applies to every new refusal path: ledger absent, ledger malformed, unresolvable overlapping ledger ranges)
**Source:** `anno-export-asm.ts:851-854`, `:896-900`; `host-tool.mts:1475`; `anno-store.ts`'s `SCHEMA_VERSION` mismatch message
**Apply to:** the new ledger-reader module, any exclusion-setter refusal
**Shape:** `<module>: <what was checked/tried> -- refusing to <action>, because <the specific bad outcome this prevents>. <remedy, named>.` Never interpolate a read file's own bytes/content — only paths, addresses, line numbers, and shape descriptions.

### Comment-text validation (applies to every free-text field reaching emitted ACME source)
**Source:** `anno-export-asm.ts:667-679`, `assertExportableCommentText()`, call site at `:779`
**Apply to:** ledger Evidence/Reason cell, exclusion reason string — both must route through this exact function before reaching a block comment. Do not write a second validator.

### "Mark, never drop, never silently resolve" (applies to verdict/confidence comment AND exclusion marker)
**Source:** `anno-export-asm.ts:522-541`, `AUTO_NAME_MARKER` / `ALIAS_MARKER_PREFIX`
**Apply to:** the new provenance marker constant and the exclusion marker constant — each declared once, one fixed spelling, doc-commented with the same "why a second spelling would be wrong" rationale.

### RED-first / discriminating-power precedent (applies to the planted-control test)
**Source:** `anno-bank.test.ts:1-5` (file-header declaration) and `channel-lock.test.ts:108-118` (inline, most concrete — names the specific broken variant, its predicted wrong output, and records it was run by hand and observed to fail)
**Apply to:** BUILD-07 criterion 1's planted-control test — build a test-only deliberately-filtering `exportAsm()` variant, run it, assert the range is missing (control fails as predicted), record this in a comment matching `channel-lock.test.ts`'s shape, then assert the real exporter's output retains the range.

### Pure, filesystem-free fixture construction (applies to every new ledger fixture)
**Source:** `diff-images.mjs:677` (`renderLedger()` signature) + `diff-images.test.mjs:507-551`
**Apply to:** both the planted-control fixture and the ledger-absent-refusal test — build `generatedRanges` literals in-memory, call `renderLedger()` directly, never touch `recovery/PROVENANCE.md` or any real corpus (none exists in this repo; RESEARCH.md confirmed by `find`).

## No Analog Found

None. Every file this phase touches or creates has either a direct self-analog (files being modified in place) or a role-appropriate cross-file analog identified above. The one genuinely novel piece of code — the ledger *reader* — has no existing reader analog (only the *writer*, `renderLedger()`), which RESEARCH.md itself already flags; its refusal style and validation discipline are nonetheless fully covered by the shared patterns above.

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.test.ts`, `src/skills/c64-provenance-diff/scripts/*.mjs`
**Files scanned directly this session (Read/Grep, line numbers reconfirmed against current tree, not just RESEARCH.md's citations):** `anno-export-asm.ts` (marker block, refusal block, comment validator), `anno-export-asm.test.ts` (`buildStore()`, WR-07 guard, PLANTED VIOLATION headers), `anno-types.ts` (`SCHEMA_VERSION`), `anno-store.ts` (DDL block), `anno-tools.ts` (scope tool registration sites), `diff-images.mjs` (`renderLedger()` full body), `anno-bank.test.ts` and `channel-lock.test.ts` (RED-first precedent search)
**Tracked-source gate:** all 8 analog files independently verified via `git ls-files -- <path>` — all tracked, none are `.gsd/` or other gitignored mirrors
**Pattern extraction date:** 2026-09-11
