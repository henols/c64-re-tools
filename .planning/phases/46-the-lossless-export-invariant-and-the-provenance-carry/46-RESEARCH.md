# Phase 46: The Lossless-Export Invariant and the Provenance Carry - Research

**Researched:** 2026-09-11
**Domain:** In-repo TypeScript/SQLite annotation store + ACME-source exporter, joined against a separate Node.js provenance-diff skill's generated markdown ledger. No new runtime dependency, no emulator, no MCP transport involvement.
**Confidence:** HIGH for everything quoted directly against the real source (file:line, verbatim). MEDIUM/flagged inline where a design choice is a documented recommendation (`.planning/research/ARCHITECTURE.md`'s Answer 6) rather than a locked decision, and where the phase's own success-criterion wording is internally inconsistent (flagged below rather than silently resolved).

No `CONTEXT.md` exists for this phase — there is no `## User Constraints` section to reproduce. Plan from `REQUIREMENTS.md` + `ROADMAP.md` + the real codebase, as instructed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-05 | *"The rebuild is provenance-aware: `c64-provenance-diff`'s verdict is carried to point of use so that for any range the operator can see what the evidence says about it. What gets reversed, kept or left out is the end-user's decision, never the tool's — the export emits every byte in scope by default, and any exclusion is one the user asked for, made explicit and recorded rather than silently applied."* (`.planning/REQUIREMENTS.md:64`) | §"Where the invariant is enforced" (Answer 6, `.planning/research/ARCHITECTURE.md:359-418`), §"The ledger's real on-disk shape", §"The exporter's current block loop" below |
| BUILD-07 | *"The export path is lossless by default — no range is dropped, filtered, or omitted on the tool's own judgement, and a user-requested exclusion is emitted as a recorded excluded range rather than a hole. Proven by a planted control: a fixture where a heuristic would want to drop a range, showing the range survives."* (`.planning/REQUIREMENTS.md:66`) | §"The invariant already holds vacuously today", §"The planted-control idiom already in this test file" below |

</phase_requirements>

## Summary

`anno-export-asm.ts`'s `exportAsm()` is, today, **already lossless by construction**: its block array is built with `sortedRanges.map(...)` (`anno-export-asm.ts:862-890`), never `.filter()`, and the whole file contains zero `.filter()` calls over `ranges`/`blocks` (confirmed by reading the file in full; the only `.filter()` calls in the module are over `enumUsage` and `comments` bookkeeping sets, not over emitted ranges). BUILD-07's job is therefore **not** to fix a bug — it is to make that already-true invariant *structurally checkable* (a regression guard) and to add the one feature that currently doesn't exist at all: a **recorded, visible exclusion mechanism** so a future contributor cannot quietly turn the vacuous invariant false by adding a provenance-keyed `.filter()`.

BUILD-05's job is materially harder than "add a comment": `c64-provenance-diff`'s verdict does **not** live in a JSON structure with a reader function today. It lives in `recovery/PROVENANCE.md` — a **generated Markdown table**, written once by `diff-images.mjs`'s `ledger` CLI verb (`renderLedger()`, `src/skills/c64-provenance-diff/scripts/diff-images.mjs:677-721`), with no counterpart JSON export and no parser anywhere in the tree. It is also **project-specific, per-consuming-project data** (resolved via `dataRoot()` → `<project root>/recovery/`, `src/skills/c64-ram-capture/scripts/project-paths.mjs:41-47`) — nothing named `PROVENANCE.md` or `RELEASES.json` exists anywhere in this repository today (`find` returned zero hits under this repo's own recovery/, matching this milestone's "no copyrighted game image enters this repository" bar). A committed **synthetic** ledger fixture, exercised through `renderLedger()`'s own exported, pure, in-memory API (`{ generatedRanges, gapTolerance, prose } → markdown string`, already unit-tested in `diff-images.test.mjs:507-551` with no filesystem I/O), is the natural way to build both the planted-control fixture and the "ledger absent → decline by name" test without ever touching real recovery data.

**Primary recommendation:** Build a small, new, pure ledger-reader (a parser over the generated-tier Markdown table `renderLedger()` already emits, or — if the planner decides recomputing is acceptable, see Open Questions — a thin wrapper around `diffRanges()`/`splitRangeByManifestKind()`) that takes an **optional** ledger path/handle on `ExportAsmOptions`, is **address-range-join only** (never branches on the verdict string's value), and writes the verdict+confidence as a fixed-prefix marker comment on every block using the *same* "mark, never drop" idiom `AUTO_NAME_MARKER`/`ALIAS_MARKER_PREFIX` already use (`anno-export-asm.ts:529,541`). Add the structural regression test in the same style as the file's own existing WR-07 guard (`anno-export-asm.test.ts:867-879`, a `readFileSync` + `assert.match` scan of the module's own source text) asserting `blocks.length === sortedRanges.length` unconditionally and that no verdict/confidence-keyed conditional exists between `listRanges()` and block emission.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reading annotation-store ranges into ACME text | Derived-tool / offline computation (`anno_*` family, `anno-export-asm.ts`) | — | Pure `(store rows, image bytes) → text`; touches no emulator, no MCP transport (MCP-02's shape) |
| Parsing `recovery/PROVENANCE.md`'s generated tier | Derived-tool / offline computation (new module, same family) | — | Pure text parsing over a committed/consumer-owned file; no host boundary, no emulator |
| Recording a user-requested exclusion | Annotation store (`anno-store.ts`, SQLite via `node:sqlite`) | Derived-tool (setter/lister `anno_*` verb, mirroring `anno_add_scope`/`anno_remove_scope`) | Persistent, revisioned state belongs in the store, exactly like every other store-owned fact (labels, comments, scopes) |
| Emitting the exclusion + verdict as visible text | Derived-tool (`anno-export-asm.ts`) | — | Same seam that already owns every other "mark, never silently resolve" convention (`AUTO_NAME_MARKER`, `ALIAS_MARKER_PREFIX`) |
| CLI surface for the widened `export-asm` verb | Derived-tool (`anno-cli.ts`) | — | `export-asm` is already CLI-only (`anno-cli.ts:1314`); Answer 1 of the milestone's own architecture research explicitly recommends keeping the export CLI-only rather than adding an MCP tool for a filesystem-tree artifact |

## User Constraints

Not applicable — no `CONTEXT.md` exists for this phase.

## Project Constraints (from CLAUDE.md)

Directives with direct bearing on this phase's plan, extracted from the project's `CLAUDE.md`:

- **No new npm runtime dependencies, no new host prerequisites** (`.planning/REQUIREMENTS.md`'s Out of Scope table, restated in `CLAUDE.md`'s dependency-tools bullet). This phase touches zero external tools — pure TypeScript/SQLite/Markdown-parsing — so this is satisfied by construction as long as the ledger reader stays hand-rolled text parsing rather than pulling in a Markdown-table library.
- **"Detect, then refuse by name with the remedy in the message"** — the standing pattern for any missing external state (CLAUDE.md's dependency bullet; also the *exact* pattern `anno-store.ts`'s `SCHEMA_VERSION` mismatch refusal and `anno-export-asm.ts`'s own two existing refusals already use). BUILD-05 criterion 4 ("ledger absent → declines by name") must match this house style, not invent a new one.
- **`Never interpolate a read file's own bytes into an error message`** (`anno-export-asm.ts`'s own header, "WHAT NOT TO DO", quoted verbatim below). A ledger-parse-failure error must name the path, the line number and the malformed shape — never the ledger's own text content, which could itself be attacker-influenced Markdown.
- **`Never sanitise a label name` / reject-not-repair discipline** — the same discipline should extend to a malformed ledger row: refuse by name, never "best-effort" parse a row that doesn't match the expected 7-column shape.
- **`Any pipeline behaviour that removes, strips, drops or excludes part of a subject binary on its own judgement` is explicitly Out of Scope** (`.planning/REQUIREMENTS.md:118`) — this is BUILD-05/07's governing constraint restated; the plan must not let a verdict value (e.g. `CRACKER-PATCH`) change emission in *any* code path, including an "obviously helpful" default like auto-excluding cracktros.
- **A store table for the hazard report is explicitly Out of Scope; an exclusion table is explicitly In Scope** (ROADMAP.md's own Phase 46 note, quoted above) — do not conflate the two if BUILD-04's hazard work (Phase 48) is visible in the same session.
- **Do not add a `name` column to `anno_scope`** (ROADMAP.md's Phase 46 note) — `FUT-08`, deliberately unowned here.
- **GSD workflow enforcement**: direct repo edits must go through a GSD command (`/gsd-execute-phase`, etc.) — not itself a technical constraint on the plan's content, but binds how the phase must be executed.
- **`test_command`** in `.planning/config.json` is `cd src/mcp/vice && npm run test:automated` and **`build_command`** is `cd src/mcp/vice && npm run typecheck` — the plan's verify steps should use exactly these, not a bespoke invocation.

## Standard Stack

No new libraries. Every capability BUILD-05/BUILD-07 need is reachable by extending code this project already owns:

### Core (existing, reused)
| Module | Role in this phase | Why reused rather than new |
|---|---|---|
| `src/mcp/vice/anno-export-asm.ts` | The single seam every store range passes through (`exportAsm()`, `anno-export-asm.ts:824-1471`) — extend in place | Already "the ONE place annotation-store rows plus image bytes become ACME source text" (its own header, `anno-export-asm.ts:1-2`) |
| `src/mcp/vice/anno-store.ts` | New exclusion table (or column) lives here alongside `anno_range`, `anno_scope`, `anno_evid_exec` | The one module in this repo permitted to name `node:sqlite`, structurally asserted (per `.planning/research/ARCHITECTURE.md:82-83`) |
| `src/mcp/vice/anno-cli.ts` | `export-asm` verb widened with the ledger-path option | Already the CLI surface for `export-asm` (`anno-cli.ts:1314-1451`) |
| `src/skills/c64-provenance-diff/scripts/diff-images.mjs` | Source of the verdict data — `renderLedger()` (`:677-721`) is the function whose OUTPUT SHAPE the new reader must parse; do not duplicate its verdict/confidence derivation logic | It is the one place `ORIGINAL`/`CRACKER-PATCH`/`UNKNOWN` and `HIGH`/`MEDIUM-HIGH`/`LOW` confidence strings are computed |
| `node:sqlite` (`DatabaseSync`) | Unchanged, already the store's engine | Node built-in, no new dependency |

### Supporting
| Item | Purpose |
|---|---|
| `acme-gate.ts` / `acme-verify.ts` (existing, test-only) | Byte-diff oracle the planted-control test should reuse — `verifyExport()`/`verifyExportText()` helpers already exist in `anno-export-asm.test.ts:254-267` |
| `src/mcp/vice/anno-types.ts`'s `SCHEMA_VERSION` doc-comment block | The template to copy if an exclusion table requires a schema bump — see "SCHEMA_VERSION precedent" below |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Markdown-table-row parser for `recovery/PROVENANCE.md`'s generated tier | A Markdown-table parsing npm package | Forbidden by this milestone's "no new npm runtime dependencies" constraint; the table shape is fixed and small (7 columns, one file, `renderLedger()` is the one writer), so a narrow regex/split parser matched against that writer's exact format is proportionate |
| Parsing the persisted `PROVENANCE.md` file | Re-running `diffRanges()`/`splitRangeByManifestKind()` in-process against the release registry to recompute `generatedRanges` | Recomputing is *not* "reading the existing ledger" — it silently changes what "ledger absent" means (registry absent vs. file absent) and duplicates `ledger`'s own CLI verb logic; flagged as an Open Question for the planner rather than resolved unilaterally |

**Installation:** none — zero new packages.

## Package Legitimacy Audit

Not applicable. This phase adds no new npm packages (npm/PyPI/crates or otherwise). Every module touched or added is internal TypeScript/JavaScript inside this repository.

## Architecture Patterns

### The exporter's current block loop — read in full, line-cited

`exportAsm()` (`anno-export-asm.ts:824`) opens the store, fetches five row sets, and closes the handle in a `finally` (`:834-848`). It then does the one thing BUILD-07 needs verified:

```ts
// anno-export-asm.ts:857-890 (structure preserved, comments trimmed)
const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);

const blocks: ExportBlock[] = sortedRanges.map((row) => ({
  start: row.start,
  endExclusive: row.endInclusive + 1,
  dataType: assertDataTypeForExport(row) as string,
  lineCount: 0,
}));
```

This is a straight `.map()`, 1:1 with `sortedRanges` — **no `.filter()` exists anywhere over `ranges`/`blocks` in this file** (verified: `grep -n "\.filter(" anno-export-asm.ts` returns only `enumUsage.filter(...)` at `:1422` and `comments.filter(...)` at `:1439`, both post-hoc "what did we NOT use" reporting, never gating emission).

The per-block emission loop (`anno-export-asm.ts:1041-1392`) builds a `content: string[]` array per block (`:1043`), fills it with decoded/rendered instruction or data lines, and finally:

```ts
// anno-export-asm.ts:1388-1391
// EVERY block goes through `emitBlock()`, code and data alike, so there is
// exactly one place that brackets a block and no route that emits an
// unbracketed one.
blockLines.push(...emitBlock(block.start, block.endExclusive, content));
```

**This is the exact insertion point for a per-block provenance-verdict comment**: prepend a line to `content` (or to the lines `emitBlock()` wraps) sourced from a ledger lookup keyed on `block.start`/`block.endExclusive`, before this `push`. The lookup must be a pure **address-range join**, never a conditional that changes which blocks reach this line.

`emitBlock()` itself (`anno-export-asm.ts:426-433`) wraps every block in an ACME origin (`* = ...`) and two `!if * != ...` assertions — the byte-diff oracle (see Data Flow below) is completely blind to a *text* comment added inside a block; it only cares that `expectedBytes` (derived from the image, never from source, `anno-export-asm.ts:1-27`'s own header) still matches. A provenance comment is therefore free to add lines without affecting the round-trip claim, as long as it's a genuine ACME comment (`;`-prefixed) and never alters an instruction's byte width.

### The "mark, never drop, never silently resolve" convention already in this file

Two existing markers are the direct precedent for how a verdict/confidence comment should be spelled:

```ts
// anno-export-asm.ts:529
const AUTO_NAME_MARKER = "  ; auto-generated name -- still in the annotation backlog";

// anno-export-asm.ts:541
const ALIAS_MARKER_PREFIX = "  ; ALIAS: this address also carries ";
```

Both are declared as a **single fixed-spelling constant, in one place**, explicitly so the emitted source stays greppable for a human reader (`anno-export-asm.ts:524-528,531-541`). A provenance marker (e.g. `PROVENANCE_MARKER_PREFIX = "  ; PROVENANCE: "`) should follow the identical shape: one constant, one spelling, applied verbatim, never re-derived or reformatted per call site.

**A tempting but misleading lead, flagged so it is not mistaken for an existing convention:** `diff-images.mjs`'s `renderLedger()` header comment (`:712-718`) says *"docs/provenance.md will be a summary pointer and inline `; PROVENANCE:` tags in `src/` will be the point-of-use copy ... per ARCHITECTURE.md"*. Grepping confirms this sentence is the **only** occurrence of `; PROVENANCE:` anywhere in the tree, it is phrased as a future aspiration ("will be"), and `.planning/ARCHITECTURE.md` (the real one, not `.planning/research/ARCHITECTURE.md`) contains **zero** occurrences of the word "provenance" anywhere. Read in context this sentence is almost certainly about **this project's own documentation-provenance conventions** (how `c64-re-tools`' own facts get tagged in its own source, a general "one direction of truth" principle), not a description of the C64-game export feature BUILD-05 asks for. It is noted here only so a planner does not mistake it for a pre-existing, already-wired mechanism — it is not wired to anything, and the `; PROVENANCE:` spelling coincidence with this phase's goal should be treated as just that: a coincidence, not a locked convention. `[ASSUMED — interpretation of an ambiguous comment, not verified against ARCHITECTURE.md's actual text since the phrase does not occur there]`

### The ledger's real on-disk shape — this is the hard part of BUILD-05

`c64-provenance-diff`'s three verdicts are **`ORIGINAL`, `CRACKER-PATCH`, `UNKNOWN`** (`src/skills/c64-provenance-diff/SKILL.md:110-111`, `diff-images.mjs`'s `diffRanges()`/`coalesceRanges()` implementation), each carrying a **separately-computed confidence string**:

```js
// diff-images.mjs:702-709 (renderLedger, generated-tier row emission)
const confidence =
  r.verdict === "ORIGINAL" ? (r.agreeing_releases >= 3 ? "HIGH" : "MEDIUM-HIGH") :
  r.verdict === "CRACKER-PATCH" ? "HIGH (patch), MEDIUM-LOW (what original there replaced)" :
  "LOW";
const kind = D02_KINDS.has(r.kind) ? r.kind : (r.kind ?? "unresolved");
const text = (r.evidence || r.reason || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
generated += `| ${hex4(r.start)} | ${hex4(r.end)} | ${kind} | ${r.verdict} | ${confidence} | ${r.agreeing_releases} | ${text} |\n`;
```

So the generated tier of `recovery/PROVENANCE.md` is a **Markdown table**, one row per coalesced range, columns `Start | End | Kind | Verdict | Confidence | Agreeing releases | Evidence / Reason` (header at `diff-images.mjs:700-701`), preceded by a fixed `<!-- GENERATED, DO NOT HAND-EDIT -->` comment (`:699`) and followed by a hand-maintained "Prose tier" (`:712-720`). **There is no JSON export of this data anywhere** — `ledger`'s CLI verb (`diff-images.mjs:845-896`) only ever `writeFileSync`s the Markdown file; `diff --json` (`:809-810`) exists but returns `diffResult.ranges` **before** the kind-split (`splitRangeByManifestKind`) that `ledger` applies, so it is not the same partition the committed ledger shows.

**Phase-46-relevant correction to `.planning/REQUIREMENTS.md`/`ROADMAP.md`'s own wording:** Success criterion 3 reads *"`HIGH`, `UNKNOWN` and `CRACKER-PATCH` ranges are all annotated"* (`.planning/ROADMAP.md:1044`). `HIGH` is a **confidence** value; `UNKNOWN` and `CRACKER-PATCH` are **verdict** values — these are two different columns in the real ledger, not three members of one enum. Read charitably this sentence means "every verdict, and every confidence tier, must be annotated regardless of value" — but read literally it asks for something the ledger's own schema cannot produce (a range that is simultaneously verdict `HIGH`). **This should be raised as a discuss-phase/planning clarification, not silently resolved by picking one interpretation.** Flagged in Open Questions below.

`recovery/PROVENANCE.md` and `recovery/RELEASES.json` are **project-specific, per-consuming-project artifacts**, not fixtures shipped in this repo:

```
$ find /home/henrik/dev/henrik/git/c64-re-tools -iname "PROVENANCE.md" -o -iname "RELEASES.json"
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/RELEASES.json
```
(one historical evidence artifact from a *different, already-closed* phase's manual investigation — not a committed, regenerable fixture usable by this phase's tests). This confirms REQUIREMENTS.md's stated bar — *"Proving ground is committed synthetic fixtures only... no copyrighted game image enters this repository"* — extends to the ledger too: **Phase 46's planted-control and ledger-absent tests must build their own synthetic ledger fixture**, most cleanly by calling `renderLedger()` directly with a hand-built `generatedRanges` array (exactly as `diff-images.test.mjs:507-551` already does, with zero filesystem I/O), never by pointing at real project data.

`dataRoot()`/`registryFile()` (`src/skills/c64-ram-capture/scripts/project-paths.mjs:41-68`) resolve `<project root>/recovery/` by walking up for a `.git` marker, overridable via `C64RE_DATA_DIR`/`C64RE_PROJECT_ROOT`. If the exporter's new ledger option takes an explicit path (recommended — mirrors `storePath`/`imagePath` already being explicit, caller-confined options on `ExportAsmOptions`, `anno-export-asm.ts:143-159`), none of this path-resolution machinery needs importing at all — one fewer coupling, and it keeps the exporter blind to `c64-provenance-diff`'s own project-layout conventions.

### The invariant already holds vacuously today — what BUILD-07 actually adds

Read in full, `anno-export-asm.ts` has no provenance/confidence-based conditional anywhere (it has never seen a provenance value at all — BUILD-05 is what would introduce the first one). So the **risk** BUILD-07 guards against is prospective, not a present bug: *"the risk this requirement guards against is a future change... tempting someone to add a provenance-based skip inside this same function"* (`.planning/research/ARCHITECTURE.md:366-371`). Concretely, BUILD-07 needs three artifacts, none of which exist yet:

1. **A recorded exclusion mechanism** — the store gains a new place to record "the user asked to exclude `$XXXX..$YYYY`, for this reason", and the exporter still emits that range's real bytes (never a hole), tagged with a marker comment (same idiom as `AUTO_NAME_MARKER`).
2. **A structural regression test** — a `readFileSync` + `assert.match`/`assert.doesNotMatch` scan of `anno-export-asm.ts`'s own source text (exact precedent already in this file, see next section), asserting `blocks.length === sortedRanges.length` unconditionally and that the block-construction `.map()` call is exactly the form quoted above, so a future `.filter()` reds a named test rather than shipping silently.
3. **The planted-heuristic-survives control itself** — a fixture where a ledger verdict (`CRACKER-PATCH`) or a shape (cracktro-like printable run, or a range with zero xrefs/unreferenced) is attached to a range, run through the real `exportAsm()`, asserting the bytes are present in `expectedBytes` — **and, per criterion 1's own text, first run against a deliberately-filtering variant of the exporter and observed to fail**, before the real exporter's green result is trusted.

### The planted-control idiom already in this test file

`anno-export-asm.test.ts` already contains the exact "prove the assertion bites, don't just assert it exists" idiom BUILD-07 asks for, twice (`:439-465`, `:466-495`, both named `PLANTED VIOLATION N:`). The pattern:

```ts
// anno-export-asm.test.ts:439-465 (structure, trimmed)
test("PLANTED VIOLATION 1: removing the `+2` width force shrinks an instruction, ...",
  { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = plantedFixture("planted-1");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const planted = result.source.replace(forced, "sta zpf_90");
  assert.notEqual(planted, result.source, "the substitution must change the source");
  const widened = assembleRaw(planted);
  // ... assert ACME's own `!if * != ...` REFUSES the mutated source (exit 1, no output file)
});
```

For BUILD-07 the shape is inverted but the discipline is the same: instead of mutating the *emitted source* and proving a real assembler catches the drift, the control must build (or the plan must add) a **deliberately-filtering variant of `exportAsm()`** (e.g. a local copy of the function with one added `.filter(r => r.verdict !== "CRACKER-PATCH")` line, used ONLY inside the test file, never shipped), run it over the planted fixture, and assert **that** variant's output is MISSING the range — establishing the control is capable of failing — before running the real, shipped `exportAsm()` over the same fixture and asserting the range **is** present. This is the same "assert the negative control is non-vacuous before trusting the positive" discipline already used elsewhere in this codebase, e.g.:

```ts
// anno-coverage.test.ts:918-923 (non-vacuity assertion before a rewrite)
assert.ok(
  Array.isArray(store.symbols) && store.symbols.length > 0,
  `the ${WELL_DOCUMENTED} fixture must actually carry symbols -- otherwise the zero asserted below is an empty ` +
    "input, not a collapse, and this test measures nothing",
);
```

and the file's own WR-07 structural guard:

```ts
// anno-export-asm.test.ts:867-879
test("the exporter hands decode() the INCLUSIVE bound (30-REVIEW WR-07)", () => {
  const source = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  assert.match(
    source,
    /decode\(slice, block\.start, \{ end: block\.endExclusive - 1 \}\)/,
    "the ONE decode() call must pass an INCLUSIVE end -- `end: block.endExclusive` is WR-07",
  );
});
```

This is a directly reusable template for BUILD-07's own structural regression guard: `assert.doesNotMatch(source, /\.filter\(\s*\(?r(ange)?\)?\s*=>.*verdict/i)` (or, more robustly, a positive assertion pinning the exact `.map()` line quoted above) plus a behavioral assertion `blocks.length === sortedRanges.length`.

### Fixture-construction pattern already in this test file

`anno-export-asm.test.ts` already has a `buildStore()` helper (`:163-181`) that writes a `.prg` and a **real store**, through the store's own public write verbs (`setDataType`, `setLabel`, `setComment`, `createProjectEnum`, `applyEnumUsage` — never raw SQL, `:157-161`'s own comment says why):

```ts
// anno-export-asm.test.ts:163-181
function buildStore(dir: string, spec: StoreSpec): StoreFixture {
  mkdirSync(dir, { recursive: true });
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([spec.origin & 0xff, (spec.origin >> 8) & 0xff, ...spec.body]));
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    for (const range of spec.ranges) setDataType(handle, range);
    for (const label of spec.labels ?? []) setLabel(handle, { ...label, kind: "User" });
    // ... comments, enums, enum usage
  } finally {
    closeStore(handle);
  }
  return { dir, storePath, imagePath };
}
```

`StoreSpec` (`:141-149`) has no `provenance`/`verdict` field — this confirms provenance is genuinely **external** to the annotation store today; the planted-control fixture needs a **second**, separate synthetic artifact (the ledger) alongside this existing store-fixture builder, joined by address range at test time.

### SCHEMA_VERSION precedent — the exact template if an exclusion table is chosen

`SCHEMA_VERSION` is currently **4** (`anno-types.ts:261`). The most recent bump (Phase 43, EVID-02, "version 4") is documented in a long doc-comment directly above the constant (`anno-types.ts:186-259`) with a fixed structure the plan should copy verbatim if BUILD-07's exclusion mechanism needs a bump to 5:

> `VERSION 4, 2026-09-10 (EVID-02) -- THE DECISION IS reaffirm-refusal, AND THE FACTUAL BASIS IS TRANSCRIBED HERE RATHER THAN LEFT IN A PLANNING DIRECTORY...`
> `WHAT THE BUMP BUYS: anno_evid_exec, the durable, run-identity-keyed table...`
> `THE OPTION SELECTED, BY NAME: reaffirm-refusal. The strict-equality refusal inside openStore stays exactly as VERSION 3 left it...`
> `THE FACTUAL CHECK, RUN 2026-09-10, SCOPE ONE DEVELOPMENT MACHINE: [numbered evidence]`
> `THE REVERSAL CONDITION, RECORDED SO THIS DOES NOT QUIETLY HARDEN INTO PRECEDENT: ...`

(`anno-types.ts:187-259`, quoted structure headings verbatim). This is directly what ROADMAP.md's own Phase 46 note points at: *"if it needs a `SCHEMA_VERSION` bump, that is a decision recorded beside the code that adds it (the `EVID-02` shape from Phase 43), not a separate phase."* The corresponding DDL precedent (a new table, not a column bolted onto `anno_range`):

```sql
-- anno-store.ts:330-338, the EVID-02 table added at SCHEMA_VERSION 4
create table anno_evid_exec (
  id integer primary key autoincrement,
  image_sha256 text not null,
  argv_digest text not null,
  seed text not null,
  address integer not null,
  source_bank text not null,
  unique(image_sha256, argv_digest, seed, address, source_bank)
);
-- anno-store.ts:345
create index anno_evid_exec_address on anno_evid_exec(address);
```

The relevant existing tables for reference (verified by reading `DDL` directly, `anno-store.ts:265-346`):

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

**Correction to `.planning/research/ARCHITECTURE.md`'s Answer 1** (worth flagging since it is read as required context for this phase): Answer 1 states BUILD-01's multi-file split would group *"listRanges()'s rows by their `anno_range.scope` column"* (`.planning/research/ARCHITECTURE.md:91-92`). **`anno_range` has no `scope` column** — confirmed by reading the DDL directly, quoted above. `anno_scope` is a separate table of disjoint address spans with no foreign key from `anno_range`; the scope a range belongs to must be derived by address containment, not a stored reference. This is Phase 47's (BUILD-01's) problem, not Phase 46's, but it means Phase 46's plan must not assume a `scope` column exists on `anno_range` if it wants to key an exclusion or provenance lookup by scope rather than by raw address range.

### `anno_*` setter/lister pairing convention (if an exclusion-recording MCP tool is chosen)

```
anno-tools.ts:593   name: "anno_add_scope"
anno-tools.ts:613   name: "anno_remove_scope"
```

Every mutating `anno_*` verb pairs a setter with an undo/lister (`.planning/research/ARCHITECTURE.md:415-417`'s own recommendation: `anno_exclude_range`/`anno_include_range`, symmetric with this pair). New tools register by adding one entry to `ANNO_TOOL_DEFINITIONS` (`anno-tools.ts:480`) plus one dispatch arm — `vice-proxy.ts`'s `ANNO_TOOL_DEFINITIONS` loop needs **no further change** to pick up a new entry (`.planning/research/ARCHITECTURE.md:434`).

### Refusal-by-name precedent — three real examples to match

1. **Inside this exact module**, already shipped:
   ```ts
   // anno-export-asm.ts:851-854
   throw new Error(
     `exportAsm: the annotation store at "${storePath}" holds no ranges -- refusing to emit an empty ACME source, ` +
       `because "nothing is annotated" and "the export produced nothing" must not read the same.`,
   );
   ```
   ```ts
   // anno-export-asm.ts:896-900
   throw new Error(
     `exportAsm: the range ${hex4(block.start)}..${hex4(block.endExclusive - 1)} (inclusive) is not covered by the ` +
       `image at "${imagePath}", which covers ${hex4(imageStart)}..${hex4(imageEndExclusive - 1)} (inclusive). ` +
       `Refusing to export a range whose bytes the image does not contain.`,
   );
   ```
2. **Host-tool family** (`findDxaBinary`, matching CLAUDE.md's "detect, then refuse by name with the remedy in the message"):
   ```ts
   // host-tool.mts:1475
   message: `host_tool "dxa.disassemble" refuses: the vendored dxa binary does not exist (tried: ${dxaFound.tried.join(", ")}) -- run "bash vendor/dxa/build.bash build" to produce it`,
   ```
3. **Store-schema mismatch** (`anno-store.ts`, `SCHEMA_VERSION` refusal):
   ```ts
   // anno-store.ts:580-582
   `${resolved}: schema_version ${meta.schema_version}, expected ${SCHEMA_VERSION} -- refusing to open rather than upgrade. This file is ` +
     `left exactly as it was: nothing on it is read, rewritten or deleted by this refusal. Open it with a build whose SCHEMA_VERSION is ` +
     `${meta.schema_version} to read it...`
   ```

A "ledger absent" refusal for BUILD-05 criterion 4 should match this exact shape: name the requested path, state what was tried (if multiple candidate locations are probed), and name the remedy (e.g. "run `c64-provenance-diff`'s `ledger` verb first, or omit `--ledger` to export without provenance annotation" — **if** provenance annotation is optional; see Open Questions).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Deciding whether an address is `code` or `data` for rendering | A second `dataType` interpreter in the ledger-reader | Nothing — the ledger reader never touches `dataType` at all; it only reads `start`/`end`/`verdict`/`confidence`. `block-class.ts` remains the one place that interprets `dataType` (`anno-export-asm.ts:56-63`'s own "WHAT NOT TO DO") | Confusing two unrelated address-keyed vocabularies (store `dataType` vs. ledger `kind`/`verdict`) in one module is exactly the kind of cross-cutting seam duplication this project's incident history warns against |
| Computing verdict/confidence from raw release bytes | A parallel "mini `diffRanges()`" inside the exporter | `c64-provenance-diff`'s existing `diffRanges()`/`renderLedger()` (`diff-images.mjs`) | BUILD-05 explicitly requires the verdict be *read*, not re-derived; re-implementing the diff logic inside the exporter is precisely the "tool becomes the decider" anti-pattern Answer 6 names |
| Storing a second copy of store ranges to join against the ledger | A denormalised cache table | `listRanges(handle)` (`anno-store.ts:2403`), called fresh per export, exactly as today | The store is already the single source of truth for ranges; nothing in this phase needs to persist a join result |
| A Markdown-table parsing library | `npm install` a table parser | A narrow, test-pinned parser matched exactly against `renderLedger()`'s own emitted format (fixed header row, `|`-escaped cell text) | Forbidden by this milestone's "no new npm runtime dependencies" constraint; the format is small, fixed, and owned by one writer function in this same repo |
| A general symbol-name sanitiser for exclusion reasons | Ad hoc string cleanup | `assertExportableCommentText()` (`anno-export-asm.ts:667`) — reuse the SAME refuse-not-sanitise comment-text validator already gating every other user-authored string reaching ACME source | The module's own "WHAT NOT TO DO" section forbids a second comment-text validator; an exclusion reason is exactly a comment |

**Key insight:** every piece of infrastructure BUILD-05/07 need (store writer verbs, comment-text validation, marker-comment convention, byte-diff oracle, `listRanges()`, `SCHEMA_VERSION` discipline) already exists in this exact file family. The only genuinely new code is (1) a ledger *reader* (parsing `recovery/PROVENANCE.md`'s generated tier — nothing reads it today) and (2) an exclusion *table* (nothing records "user asked to exclude X" today).

## Common Pitfalls

### Pitfall 1: Implementing the provenance carry as a threshold inside `exportAsm()`
**What goes wrong:** a plan adds `if (verdict === "CRACKER-PATCH") continue;` (or any conditional keyed on verdict value) inside the block loop.
**Why it happens:** it is the most obvious way to "use" a verdict once it's available, and BUILD-05's *previous* wording (before the 2026-09-10 reword, see `.planning/REQUIREMENTS.md`'s "Departures" table) literally asked for this.
**How to avoid:** the verdict/confidence must only ever be interpolated into a **comment string**. A structural test (see "The invariant already holds vacuously today" above) should fail the build the moment any conditional branches on the verdict value anywhere in the emission path.
**Warning signs:** any `if`/`switch`/`.filter()` anywhere between `listRanges()`'s result and `blockLines.push(...)` that reads a verdict, confidence, or provenance field.

### Pitfall 2: Conflating "verdict" and "confidence" as one enum
**What goes wrong:** treating `HIGH`/`UNKNOWN`/`CRACKER-PATCH` as three values of one field (this is literally what the phase's own success criterion 3 text does — see the flagged discrepancy above).
**Why it happens:** `ROADMAP.md`'s own wording does this, so a plan copying it verbatim inherits the ambiguity.
**How to avoid:** the real ledger has two independent fields — Verdict (`ORIGINAL`/`CRACKER-PATCH`/`UNKNOWN`) and Confidence (`HIGH`/`MEDIUM-HIGH`/`HIGH (patch), MEDIUM-LOW (...)`/`LOW`). The exported comment should almost certainly carry both, verbatim, never collapsed into one.
**Warning signs:** a test or type that has only one string field for "the verdict".

### Pitfall 3: Assuming a real `recovery/PROVENANCE.md` fixture already exists to test against
**What goes wrong:** a plan references "the committed ledger fixture" as if one already exists in this repo.
**Why it happens:** the milestone's other synthetic fixtures (e.g. `fixtures/export-asm/smc.prg`) create the expectation that everything needed is already committed.
**How to avoid:** none exists — `find -iname PROVENANCE.md -o -iname RELEASES.json` returns only one unrelated historical evidence file from Phase 23. The plan must include a task to build a synthetic ledger fixture (via `renderLedger()`'s pure API, no filesystem I/O needed) alongside the store fixture.
**Warning signs:** a plan step that says "use the existing ledger fixture" without a preceding step that creates one.

### Pitfall 4: Letting the exclusion mechanism create a byte hole
**What goes wrong:** "excluding" a range is implemented by skipping its block entirely (reintroducing exactly BUILD-07's forbidden shape, just gated by an explicit user action instead of a heuristic).
**Why it happens:** "exclude" reads, in isolation, like "don't emit".
**How to avoid:** criterion 2's own text is explicit — *"the export emits every byte in scope by default, and any exclusion is one the user asked for, made explicit and recorded rather than silently applied"* and *"a user-requested exclusion is emitted as a recorded excluded range... never as a silent hole. Reading the export back recovers what was excluded and why."* The exclusion must still walk the range's full byte span and emit a real block (with `expectedBytes` unaffected), tagged with a marker comment.
**Warning signs:** `expectedBytes`'s span shrinking, or a gap appearing between two emitted blocks, when an exclusion is applied.

### Pitfall 5: Assuming a zero-failure baseline for `npm run test:automated`
**What goes wrong:** a plan's verify step asserts the whole suite is green, and gets blocked (or worse, "fixes" unrelated pre-existing failures) because 4 tests are already red for reasons unconnected to this phase.
**Why it happens:** the natural assumption for "run the tests" is "expect zero failures".
**How to avoid:** MEASURED 2026-09-11 (this session), `cd src/mcp/vice && npm run test:automated`: **3898 passing, 4 distinct pre-existing failures**, none in `anno-export-asm.test.ts`:
  - `anno-register.test.ts` — 3 failures, all "requirement id ... is well-shaped but is NOT declared in .planning/REQUIREMENTS.md" (stale requirement-id citations against the rewritten v1.0.0 `REQUIREMENTS.md` — pre-existing drift, unrelated to this phase).
  - `audit-root-args.test.ts` — 1 failure, `check-skill-fork-honesty: every spelling that RESOLVES to the repository root is accepted`.
  This is a **different count** than the project's own `MEMORY.md` note ("stable floor 3 ... plus 2 named flakes") — consistent with that note's own instruction to "compare the failure set, never the count": the floor has drifted since 2026-09-10. The plan's verify step must diff the **failing test names** against this list, not assert an absolute pass count.
**Warning signs:** a verify command that greps for a nonzero exit code without inspecting which tests failed.

### Pitfall 6: Reaching for `; PROVENANCE:` as an already-wired marker spelling
**What goes wrong:** treating `diff-images.mjs:717`'s `; PROVENANCE:` mention as evidence of an existing, cross-file convention.
**Why it happens:** the string coincidentally matches this phase's exact goal.
**How to avoid:** see "A tempting but misleading lead" above — it is a single, forward-looking comment about a different concern (this project's own documentation provenance), not a wired mechanism. Pick a marker spelling based on this file's own `AUTO_NAME_MARKER`/`ALIAS_MARKER_PREFIX` convention instead, and record the choice explicitly rather than inheriting it silently.
**Warning signs:** a plan step citing `diff-images.mjs:717` as precedent for the exporter's marker text.

## Code Examples

### The exporter's block-construction loop (no filtering, the invariant to preserve)
```ts
// anno-export-asm.ts:857-890
const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);

const blocks: ExportBlock[] = sortedRanges.map((row) => ({
  start: row.start,
  endExclusive: row.endInclusive + 1,
  dataType: assertDataTypeForExport(row) as string,
  lineCount: 0,
}));
```

### The ledger's generated-tier row format (what a reader must parse)
```js
// diff-images.mjs:700-710
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

### `renderLedger()`'s pure, filesystem-free API (build synthetic fixtures against this)
```js
// diff-images.mjs:677 (signature), exercised with zero I/O in diff-images.test.mjs:507-551
export function renderLedger({ generatedRanges, gapTolerance, prose }) { /* ... */ }
```
`generatedRanges` items carry `{ start, end, kind, verdict, agreeing_releases, reason/evidence }` (inferred from `renderLedger()`'s own field reads at `diff-images.mjs:681-709`; `refusal` preconditions at `:681-694` require UNKNOWN rows to carry a non-empty `reason` and ORIGINAL rows to carry `agreeing_releases >= 2`, and the full set must cover exactly `$0000-$FFFF` with no gap/overlap — a synthetic fixture for Phase 46's tests must satisfy all three or `renderLedger()` itself will refuse to emit).

### Existing refusal-by-name shape (match this for "ledger absent")
```ts
// anno-export-asm.ts:851-854
throw new Error(
  `exportAsm: the annotation store at "${storePath}" holds no ranges -- refusing to emit an empty ACME source, ` +
    `because "nothing is annotated" and "the export produced nothing" must not read the same.`,
);
```

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `package.json`'s `"test"` / `"test:automated"` scripts, plus `test-gate.mjs` (the automated-file-list gate) |
| Quick run command | `cd src/mcp/vice && node --test anno-export-asm.test.ts` |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (project's own `test_command` in `.planning/config.json`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-07 (criterion 1) | Planted-control range (ledger-flagged `CRACKER-PATCH`/cracktro-shaped/unreferenced) survives export byte-for-byte, control observed red first against a deliberately-filtering exporter variant | unit | `node --test anno-export-asm.test.ts` | ❌ Wave 0 — new test(s) in `anno-export-asm.test.ts` |
| BUILD-07 (criterion 2) | Excluded range emitted as recorded, marked block — never a hole; readable back | unit | `node --test anno-export-asm.test.ts` (+ `anno-store.test.ts` if a new table/verb is added) | ❌ Wave 0 |
| BUILD-05 (criterion 3) | Every emitted block carries an inline verdict+confidence comment sourced from the ledger, regardless of value; structural test asserts no threshold/inclusion decision reads the verdict | unit + structural (source-text scan, WR-07 idiom) | `node --test anno-export-asm.test.ts` | ❌ Wave 0 |
| BUILD-05 (criterion 4) | Verdict read from ledger, never re-derived; ledger absent → named refusal | unit | `node --test anno-export-asm.test.ts` (+ a new ledger-reader test file if the reader lands in its own module) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd src/mcp/vice && node --test anno-export-asm.test.ts` (and the new ledger-reader test file, if separate)
- **Per wave merge:** `cd src/mcp/vice && npm run test:automated`
- **Phase gate:** Full suite compared against the MEASURED baseline above (3898 pass / 4 pre-existing, named failures) — green means "no new failures", not "zero failures"

### Wave 0 Gaps
- [ ] A synthetic ledger fixture builder (calling `renderLedger()`'s pure API, or an equivalent literal `generatedRanges` array) inside `anno-export-asm.test.ts` or a new sibling test file
- [ ] A "deliberately-filtering exporter variant" (test-only, local to the test file — never shipped) to prove the planted control is capable of failing before trusting it green
- [ ] The new ledger-reader module itself (design pending — see Open Questions), plus its own test file if it does not live directly in `anno-export-asm.ts`
- [ ] If an exclusion table is added: the `SCHEMA_VERSION` 5 doc-comment block (copy the EVID-02 template above) and its own `anno-store.test.ts` coverage

*(Framework install: none — `node --test` is already wired.)*

## Security Domain

`security_enforcement` is enabled (`.planning/config.json`: `"security_enforcement": true, "security_asvs_level": 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched — pure local file/DB computation |
| V3 Session Management | no | No session concept in this module |
| V4 Access Control | no | Single-user local tool, no access-control boundary crosses this phase |
| V5 Input Validation | **yes** | The new ledger reader parses an **externally-generated, potentially hand-edited** Markdown file. Must refuse (not best-effort parse) any row that doesn't match the exact 7-column shape `renderLedger()` writes; reuse `assertExportableCommentText()`'s reject-don't-sanitise discipline for any free-text field (Evidence/Reason) before it can reach an ACME comment |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted `recovery/PROVENANCE.md` "Evidence / Reason" cell containing a line break or ACME-meaningful token (`{`, `!error`, etc.) reaching the emitted ACME source verbatim | Tampering | Route every ledger-derived free-text field through `assertExportableCommentText()` (`anno-export-asm.ts:667`) — the same validator already gating every other user-authored string, exactly as the module's own header requires ("Never re-derive... a second comment-text validator") |
| A ledger-parse failure message quoting the malformed row's own raw text, disclosing ledger content the operator did not intend to expose (e.g. via a shared error log) | Information Disclosure | Match `anno-export-asm.ts`'s own documented rule: *"Never interpolate a read file's own bytes into an error message... a path, an address and a length are facts ABOUT a file; its contents are not"* — name the path, line number and expected shape; never the row's own text |
| A ledger range silently "wins" over a conflicting/overlapping store range's provenance, producing a comment that looks authoritative but is arbitrarily picked | Tampering / Repudiation | The join must be deterministic and, like the existing `labelIndex` alias handling (`anno-export-asm.ts:914-946`), any ambiguity (multiple ledger ranges overlapping one store range) should be **recorded in the output**, never silently resolved by picking one |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ACME cross-assembler | Existing round-trip tests in `anno-export-asm.test.ts` (unaffected by this phase, but the plan's verify step will exercise them) | ✓ (MEASURED, this session) | 0.97 "Zem", `/home/henrik/.local/bin/acme` | n/a — `acme-gate.ts`'s `SKIP_REASON` already handles absence gracefully in CI without ACME |
| Node.js ≥ 24 | Running/testing the MCP server tree at all | ✓ (this environment) | — | n/a |
| Real `recovery/PROVENANCE.md` / cracked-release corpus | NOT required — this phase's fixtures must be synthetic | n/a (confirmed absent from this repo) | — | Build via `renderLedger()`'s pure API, no real corpus needed |

No missing dependencies block this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `; PROVENANCE:` string in `diff-images.mjs:717` is unrelated to this phase's marker-comment convention and should not be treated as a locked spelling | Architecture Patterns → "A tempting but misleading lead" | Low — worst case the planner independently arrives at the same spelling by coincidence; flagged only to prevent over-attributing intent to an ambiguous comment |
| A2 | Provenance annotation should be an **optional** `exportAsm()` input (e.g. `ledgerPath`), preserving current no-ledger behavior for every existing caller/test, rather than a mandatory input that would break ~40 existing tests that call `exportAsm()` with no ledger argument | Summary; Open Questions | Medium — if BUILD-05 is read as mandating provenance annotation on *every* export unconditionally, most of the existing 2708-line test file's call sites would need updating just to keep compiling, a much larger blast radius than "extends... against existing fixtures" implies |
| A3 | A new, hand-rolled parser over `recovery/PROVENANCE.md`'s generated-tier Markdown table (rather than recomputing via `diffRanges()`) is the correct reading of "read from the existing ledger, never re-derived" | Standard Stack → Alternatives Considered; Open Questions | Medium — if the planner instead chooses to recompute in-process by importing `diffRanges()`/`splitRangeByManifestKind()`, criterion 4's "ledger absent" refusal condition changes meaning (registry/corpus absent vs. `PROVENANCE.md` file absent) |
| A4 | The exclusion mechanism should be a **new SQLite table** (`anno_excluded_range`-shaped) rather than a nullable column on `anno_range`, following this project's stated preference (`anno_evid_exec` at `SCHEMA_VERSION` 4 over widening `anno_range`) | Architecture Patterns → SCHEMA_VERSION precedent | Low-Medium — a column would also satisfy BUILD-07's text, but diverges from the project's own precedent pattern; either choice needs its bump-decision documented per the EVID-02 template regardless |

## Open Questions

1. **Is provenance annotation opt-in or mandatory on every `exportAsm()` call?**
   - What we know: no ledger-related option exists on `ExportAsmOptions` today; criterion 4 implies a "ledger absent" state is reachable and handled by refusal, which only makes sense if invoking ledger-mode is itself an explicit, distinguishable caller action.
   - What's unclear: whether "declines by name" means "the whole export refuses" or "the export proceeds without provenance annotation, refusing only if ledger-mode was explicitly requested and the file can't be read."
   - Recommendation: make it an optional input (`ledgerPath` or similar); refuse only when the option is supplied and the file is missing/malformed. Confirm this reading explicitly with the user/discuss-phase before planning, since it changes the shape of every new test.

2. **Should the ledger reader parse the persisted `recovery/PROVENANCE.md` Markdown, or recompute via `diffRanges()`/`splitRangeByManifestKind()` in-process?**
   - What we know: `renderLedger()` is the only function that currently produces the verdict-per-range data; there is no JSON reader; recomputing would technically reuse existing, tested code (`diffRanges`, `splitRangeByManifestKind`) rather than writing a new Markdown parser.
   - What's unclear: whether "read from the existing ledger, never re-derived" (BUILD-05 criterion 4's own wording) specifically forbids recomputation, or merely forbids inventing a NEW derivation algorithm inside the exporter.
   - Recommendation: parse the persisted file. Recomputation would (a) require the exporter to import a registry-resolution path (`dataRoot()`) it has no other reason to know about, coupling two modules that are today cleanly separate, and (b) make "ledger absent" ambiguous between "no `PROVENANCE.md`" and "no `RELEASES.json`"/"no release registry at all" — a materially different, harder-to-test refusal condition.

3. **Success criterion 3's wording literally asks for a range whose verdict is `HIGH`** (`.planning/ROADMAP.md:1044`: *"`HIGH`, `UNKNOWN` and `CRACKER-PATCH` ranges are all annotated"*), but the real ledger schema has no such value — `HIGH` is a Confidence value, `UNKNOWN`/`CRACKER-PATCH` are Verdict values (verified directly against `diff-images.mjs:702-709`).
   - What we know: both fields exist and both should almost certainly be carried into the emitted comment.
   - What's unclear: whether the requirement's author meant "every verdict value AND every confidence tier, in combination" or made a genuine drafting error conflating the two fields.
   - Recommendation: raise this explicitly rather than silently picking an interpretation — it is exactly the kind of ambiguity `/gsd-discuss-phase` exists to resolve before planning locks in a test's pass condition.

4. **Should the exclusion-setter be a new `anno_*` MCP tool (`anno_exclude_range`/`anno_include_range`), or CLI-only like the export itself?**
   - What we know: `.planning/research/ARCHITECTURE.md`'s Answer 6 recommends the paired-verb MCP-tool shape, matching `anno_add_scope`/`anno_remove_scope`; Answer 1 (for a different capability, the multi-file split) argues the *export* itself should stay CLI-only because a filesystem tree isn't "a bounded, chunkable answer an agent queries mid-session."
   - What's unclear: an exclusion, unlike a file tree, IS a small bounded piece of state an agent would plausibly want to set mid-session (matching the `anno_add_scope`-style pattern), so the two capabilities may reasonably land on different sides of the CLI/MCP-tool line even though they ship in the same phase.
   - Recommendation: MCP tool for the exclusion setter/lister (matches the paired-verb precedent every other mutating `anno_*` capability uses), CLI-only for the export widening itself (matches Answer 1's existing, adopted reasoning).

## Sources

### Primary (HIGH confidence — read directly this session, quoted verbatim with line numbers)
- `src/mcp/vice/anno-export-asm.ts` (full file, 1471 lines) — exporter structure, block loop, existing refusals, marker conventions
- `src/mcp/vice/anno-export-asm.test.ts` (structure + targeted sections, 2708 lines) — fixture patterns, planted-violation idiom, WR-07 structural guard
- `src/mcp/vice/anno-store.ts` (DDL block + `SCHEMA_VERSION` refusal + `listRanges()`) — schema, refusal wording
- `src/mcp/vice/anno-types.ts` (`SCHEMA_VERSION` doc-comment, `RangeRow` interface) — schema-bump precedent template
- `src/mcp/vice/anno-cli.ts` (export-asm verb, option table) — CLI surface
- `src/mcp/vice/anno-tools.ts` (`anno_add_scope`/`anno_remove_scope` registration) — setter/lister pairing precedent
- `src/mcp/vice/anno-coverage.test.ts` (non-vacuity assertion pattern) — testing idiom precedent
- `src/mcp/vice/host-tool.mts` (`findDxaBinary()` refusal) — refusal-by-name precedent
- `src/skills/c64-provenance-diff/SKILL.md` — verdict/confidence vocabulary, worked example
- `src/skills/c64-provenance-diff/scripts/diff-images.mjs` (`renderLedger()`, `ledger` CLI verb, full VERBS object) — ledger's real on-disk format
- `src/skills/c64-provenance-diff/scripts/diff-images.test.mjs` (`renderLedger` tests) — pure, filesystem-free fixture API
- `src/skills/c64-ram-capture/scripts/project-paths.mjs` (`dataRoot()`, `projectRoot()`) — where the ledger physically lives
- `.planning/REQUIREMENTS.md` — BUILD-05/BUILD-07 verbatim text, governing constraint, departures table
- `.planning/ROADMAP.md` (Phase 46 entry, lines 1030-1053) — success criteria, notes
- `.planning/research/ARCHITECTURE.md` (Answers 1 and 6, and the Anti-Patterns section) — prior integration research for this exact milestone
- `.planning/ARCHITECTURE.md` — checked directly; confirmed it does NOT contain the "Letting the exporter learn about provenance verdicts directly" section (that content lives in `.planning/research/ARCHITECTURE.md` instead — a path correction from the phase brief)
- `.planning/config.json` — `nyquist_validation`, `security_enforcement`, `test_command`, `build_command`
- Live measurement: `cd src/mcp/vice && npm run test:automated`, run this session, 2026-09-11 — 3898 pass / 4 named pre-existing failures, none in `anno-export-asm.test.ts`
- Live measurement: `find /home/henrik/dev/henrik/git/c64-re-tools -iname "PROVENANCE.md" -o -iname "RELEASES.json"` — confirms no committed ledger fixture exists
- `.agents/skills/mastra/SKILL.md` — checked per required agent-skills reading; not applicable to this phase (no `@mastra/*` API touched by anything BUILD-05/BUILD-07 requires)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md`'s specific module/line recommendations for the exclusion table and MCP-tool naming (Answer 6) are a documented recommendation, not a locked decision — treated as MEDIUM and flagged in Open Questions rather than presented as settled fact

### Tertiary (LOW confidence)
- None — no WebSearch was needed; this phase is 100% in-repo, no external ecosystem research required

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every module identified by reading its source directly
- Architecture: HIGH for what exists today (exporter, store, ledger format all read directly); MEDIUM for the specific new-module design (ledger reader shape, exclusion table vs. column) since these are recommendations, not locked decisions
- Pitfalls: HIGH — every pitfall is grounded in a real, cited discrepancy or measured fact, not a generic warning

**Research date:** 2026-09-11
**Valid until:** 30 days (stable, in-repo domain; the one time-sensitive fact — the 4-failure test baseline — should be re-measured at plan/execute time rather than trusted from this document alone)
