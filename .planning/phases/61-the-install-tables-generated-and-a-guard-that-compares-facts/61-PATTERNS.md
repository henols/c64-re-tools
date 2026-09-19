# Phase 61: The Install Tables Generated, and a Guard That Compares Facts - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/mcp/vice/prereq-readme-gen.ts` (NEW) | utility (generator: derive + render + CLI writer) | transform (JSON declaration -> markdown) + file-I/O (reads `prerequisites.json`, writes `README.md`) | `src/mcp/vice/build.ts` (generator/CLI shape) + `src/mcp/vice/tool-location.mts` (`readDeclaration()`/`remedyTextsFor()`, declaration-reading shape) | role-match (composite: two analogs, one per concern) |
| `src/mcp/vice/prereq-readme-gen.test.ts` (NEW) | test (drift guard) | transform (parse two sides into records, compare) + file-I/O (`mkdtempSync` fixture) | `src/mcp/vice/resources-sync.test.ts` (shared-derivation guard shape) + `src/mcp/vice/phase58-citation-ledger.test.ts` (parse-into-records, named-failures, non-vacuous-fixture shape) | exact (both are guards of exactly this class — generated-artifact drift — already in the tree) |
| `README.md` (MODIFY: splice 2 generated regions, hand-rewrite 3 prose spots) | config/docs (static file, generated-but-committed) | file-I/O (spliced by the generator; read by a human) | `src/mcp/vice/resources/*.mjs` (the generated-but-committed precedent, one artifact kind over) — no markdown precedent exists, this is the first | role-match (pattern precedent, not a file-type precedent) |
| `docs/phase58-declaration-provenance.md` (MODIFY: re-anchor 3 ledger entries, add circular-citation note) | docs (provenance/citation ledger) | transform (line-range re-anchor) | itself — its own "Citation ledger" section (lines 368-405) and "Case five" section (lines 198-211) are the pattern to extend, not a different file | exact (same file, same section shape, additive edit) |

## Pattern Assignments

### `src/mcp/vice/prereq-readme-gen.ts` (generator, transform + file-I/O)

**Analog 1 — declaration reading:** `src/mcp/vice/tool-location.mts:269-289` (do NOT import — cross the `.mts`/`.ts` seam issue noted in RESEARCH.md; mirror the *shape* only)

**Reading pattern to mirror** (`src/mcp/vice/tool-location.mts:281-289`, verbatim):
```typescript
function readDeclaration(here: string): ToolDeclaration {
  const candidates = [join(here, "prerequisites.json"), join(here, "..", "prerequisites.json")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, "utf8")) as ToolDeclaration;
    }
  }
  throw new Error(`tool-location: prerequisites.json not found at any of: ${candidates.join(", ")}`);
}
```
Write a second, independent copy of this exact shape in the new `.ts` module (do not import the `.mts` one — see Integration Points in RESEARCH.md). Simpler variant since the generator always runs from its own source location, never a compiled/deployed copy — one candidate path is enough:
```typescript
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const declaration = JSON.parse(readFileSync(join(HERE, "prerequisites.json"), "utf8"));
```

**Remedy-collection pattern** (`src/mcp/vice/tool-location.mts:953-972`, `remedyTextsFor()`) — mirror its platform-key iteration order (`platform` entries first, then `universal`) and its "return structured data, never throw for a missing shape" discipline:
```typescript
const platformEntries = remedies[platform as keyof RemedyBlock] ?? [];
const universalEntries = remedies.universal ?? [];
return [...platformEntries, ...universalEntries].map((entry) => entry.text);
```
`deriveEcosystemRows()` needs the SAME iteration (`linux`/`darwin`/`win32` then `universal`) but must NOT collapse into `.text`-only strings — it needs `{ecosystem, text}` pairs per D-04's dedupe-by-`(ecosystem, text)` rule, and a `Platforms` column built by tracking which platform key(s) each `(ecosystem, text)` pair was seen under (D-04's Homebrew case: `homebrew` + `"brew install vice"` appears under both `linux` and `darwin` — dedupe to one row, `Platforms: "linux, macOS"` per Pitfall 3's fixed three-word translation, never `darwin`/`win32` raw).

**Analog 2 — CLI + generated-output writer shape:** `src/mcp/vice/build.ts:1-90`

**CLI entry / module header pattern to mirror** (`src/mcp/vice/build.ts:1-11`, verbatim):
```typescript
// build.ts
//
// Compiles the host-bound TypeScript sources ... into banner-marked,
// committed JavaScript under resources/. Run directly as `node build.ts`
// (native type stripping, no tsc needed to run THIS file...).
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, ... } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
```
Follow this header discipline exactly (per CLAUDE.md Conventions § Comments): state WHY the file exists, name what NOT to do, name the guard that will catch drift (`prereq-readme-gen.test.ts`), and give every export a JSDoc block.

**Exported artifact-list pattern** (`src/mcp/vice/build.ts:38-55`, `HOST_BOUND_ARTIFACTS`) — the precedent for naming an explicit, exported, asserted set rather than a directory walk. Mirror this shape for the generator's own row-derivation exports so the guard imports the SAME functions (D-10):
```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [ /* explicit list */ ];
```
becomes, in the new module:
```typescript
export function deriveEcosystemRows(declaration: ToolDeclaration): EcosystemRow[] { ... }
export function deriveOverviewRows(declaration: ToolDeclaration): OverviewRow[] { ... }
export function renderMarkdownSection(rows: unknown[], columns: string[]): string { ... }
```

**No error-handling analog needed beyond "return structured data, never throw for a missing shape"** — this module reads a frozen, already-validated (`prerequisites.test.ts`) JSON file and writes markdown; there is no external input to guard against (Security Domain section of RESEARCH.md: risk surface is nil).

---

### `src/mcp/vice/prereq-readme-gen.test.ts` (guard, transform + file-I/O)

**Analog 1 — shared-derivation import discipline:** `src/mcp/vice/resources-sync.test.ts:1-24`

**Imports + header pattern** (verbatim, lines 1-24):
```typescript
// resources-sync.test.ts
//
// ... Drives the SAME build() entry point task 2's build.ts exports, through
// its out-directory flag, into a scratch mkdtempSync(tmpdir()) directory --
// the banner text must never exist in two implementations, so this test
// never re-derives it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";
```
For the new guard, replace `import { build } from "./build.ts"` with:
```typescript
import { deriveEcosystemRows, deriveOverviewRows } from "./prereq-readme-gen.ts";
```
State the same rule in the header comment (this is exactly what `[VERIFIED: RESEARCH.md Pattern 1]` names as the required shape): "never a second implementation of what a row 'should' contain."

**Core comparison pattern** (`src/mcp/vice/resources-sync.test.ts:50-95`) — the "Direction 1 / Direction 2" two-way check (every expected row has an actual match; every actual row was expected) is the exact shape `compareRecordSets` (RESEARCH.md Pattern 2) needs, generalized from byte-equality to record-equality:
```typescript
test("resources/ is byte-identical to a fresh build of its TypeScript source", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "resources-sync-"));
  try {
    build({ outDir: scratchDir });
    // Direction 1: every expected file exists in actual, matching.
    // Direction 2: every actual generated file was expected.
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});
```
Adapt to records: sort both sides by a stable key (e.g. `${ecosystem}|${text}` for ecosystem rows, `id` for overview rows), then `assert.deepEqual` — never `assert.ok(a.equals(b))` (that is resources-sync's byte-identity check, the WRONG comparison class per RESEARCH.md's Pattern 2 / owner decision 2026-09-13).

**Analog 2 — parse-into-records with named failures, non-vacuous fixture:** `src/mcp/vice/phase58-citation-ledger.test.ts`

**Repo-root walk** (lines 33-42, verbatim — copy this exact function, it is already the third copy in the tree per RESEARCH.md's Reusable Assets note; check `src/mcp/vice/repo-root.ts` first per Open Question 3, but if its API does not fit cleanly, mirroring this plain walk verbatim is the established, accepted pattern):
```typescript
/** The plain `.git`-marker walk, mirrored from phase50-findings-contract.test.ts. */
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}
```

**Marker-region extraction pattern** (lines 65-85, `LEDGER_HEADING_RE` + slice-to-region) — mirror the shape (a regex constant naming the marker, a function that slices `docText` between two anchors) but use a matched START/END pair per Pitfall 1, NOT "heading to EOF" (the install-table section is not the file's final section):
```typescript
const LEDGER_HEADING_RE = /^## Citation ledger\s*$/m;
export function parseCitationLedger(docText: string): { entries: CitationLedgerEntry[]; errors: string[] } {
  const headingMatch = LEDGER_HEADING_RE.exec(docText);
  if (!headingMatch) {
    return { entries: [], errors: ["Citation ledger region not found: ..."] };
  }
  const ledgerRegion = docText.slice(headingMatch.index);
  // ...
}
```
Adapt to matched markers:
```typescript
const START_RE = /<!-- prereq-gen:ecosystem-table:start -->/;
const END_RE = /<!-- prereq-gen:ecosystem-table:end -->/;
function extractGeneratedRegion(readmeText: string, startRe: RegExp, endRe: RegExp): string { /* slice strictly between */ }
```

**Never-throw, named-failures return contract** (lines 157-236, `auditProvenanceCitations()`, quoted verbatim in RESEARCH.md Code Examples):
```typescript
export function auditProvenanceCitations(options: CitationAuditOptions): string[] {
  const failures: string[] = [];
  // ... push named, specific failure strings, never throw ...
  return failures;
}
```
Mirror this exact discipline for the guard's top-level audit function — return a `string[]` of named divergences (e.g. `"debian-trixie/x64sc: declaration says X, README says Y"`), empty array = pass. This is also what makes `GEN-03`'s assertion ("guard reports failure AND names the diverged record") checkable.

**Options-object injection pattern** (lines 56-63, `CitationAuditOptions`) — both `docPath`/`repoRoot` as plain strings "so a planted fixture tree can be fed to the same code as the committed one." Mirror exactly for the new guard's audit options (`declPath`, `readmePath`), per CLAUDE.md Conventions § Injection ("Pass parameters as a destructured options object").

**Analog 3 — GEN-03's fixture recipe:** RESEARCH.md's own worked example (Architecture Pattern 3), grounded in `host-tool.test.ts`'s `realpathSync(mkdtempSync(...))` wrapper and `phase58-citation-ledger.test.ts`'s `mkdtempSync(tmpdir())` fixture-per-test-case pattern (11 occurrences, lines 252-611 in that file — every structural/non-vacuity test builds its own scratch tree, never shares one):
```typescript
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "prereq-readme-gen-")));
copyFileSync(realDeclPath, join(scratch, "prerequisites.json"));
copyFileSync(realReadmePath, join(scratch, "README.md"));

const decl = JSON.parse(readFileSync(join(scratch, "prerequisites.json"), "utf8"));
decl.tools.x64sc.remedies.linux[0].text = "MUTATED FOR TEST";
writeFileSync(join(scratch, "prerequisites.json"), JSON.stringify(decl, null, 2));

const diff = auditGeneratedSection({ declPath: join(scratch, "prerequisites.json"), readmePath: join(scratch, "README.md") });
assert.ok(diff.length > 0, "planted divergence must be caught");
assert.ok(diff.some((f) => f.includes("debian-trixie")), "the guard must NAME the diverged record");
```
Use `realpathSync(mkdtempSync(...))`, not bare `mkdtempSync(...)` — `host-tool.test.ts`'s comment explains why: a `mkdtempSync` path can itself sit under a symlinked `/tmp`.

**Cleanup pattern** (`src/mcp/vice/resources-sync.test.ts:51-94`, `try { ... } finally { rmSync(scratchDir, { recursive: true, force: true }); }`) — every fixture-using test in this tree cleans up in a `finally` block. Mirror this exactly; per MEMORY note "Suite races on repo-tree scratch files," a leaked scratch directory has already caused deterministic failures in this exact suite.

---

### `README.md` (generated regions + 3 hand-rewritten prose spots)

**No prior markdown-generation analog exists in this tree** — `resources-sync.test.ts` + `build.ts` is the closest precedent for the *principle* ("generated but committed," `src/mcp/vice/build.ts:78-90`'s `GENERATED_BANNER()`), one artifact kind over (compiled `.mjs`, not markdown). Do not copy the banner text verbatim (it names `tsc`/`install-resources.mjs`, which do not apply here) — but mirror its INTENT: a short comment at the top of each generated region stating it is generated and naming the regenerate command (Open Question 2 in RESEARCH.md — the planner must name this command; RESEARCH.md's own recommendation is an npm script, e.g. `"generate:readme"` in `src/mcp/vice/package.json`'s `scripts` block, following the existing `"build": "node build.ts"` naming convention at `src/mcp/vice/package.json:136`).

**Marker syntax (recommendation, no locked precedent — RESEARCH.md Assumption A1):**
```markdown
<!-- prereq-gen:ecosystem-table:start -->
| Ecosystem | ... |
|-----------|-----|
...
<!-- prereq-gen:ecosystem-table:end -->
```
and a second pair for the overview table, e.g. `<!-- prereq-gen:overview-table:start/end -->`.

**Current hand-written table being replaced** (`README.md:99-108`) — read for exact column semantics before removing (two version columns drop per D-10/D-11 carried from Phase 58; only `Ecosystem` and `Install command` survive into the generated table, renamed per D-03/D-04 to `Ecosystem` (raw id) / remedy text / `Platforms`).

**Three prose spots requiring hand rewrite (D-07), exact citations:**
- `README.md:96-97` — currently: `"Checked live against each ecosystem on 2026-08-18. \`CPUHISTORY_GET\`, the opcode behind this project's exact cycle stopwatch, requires **VICE >= 3.10**:"` — introduces the two columns being dropped; must be rewritten to introduce only what survives.
- `README.md:110-111` — currently: `"No MSYS2/pacman package exists for VICE on Windows; the alternatives there are the official SourceForge 3.9 zips **above** or a source build."` — cites the version column's content ("3.9"); the generated table no longer carries a version number, so this sentence's "above" reference needs rewriting or removal.
- `README.md:122-123` (inside the "VICE version compatibility" section, `README.md:117-125`) — currently: `"The 3.10 floor **named in the table above** binds \`CPUHISTORY_GET\` itself, an opcode no shipped tool calls..."` — the clause "named in the table above" goes false outright once the column is gone; must be rewritten to state the 3.10 floor as a fact on its own, not as a table citation.

---

### `docs/phase58-declaration-provenance.md` (re-anchor 3 ledger entries + new circularity note)

**Analog: itself.** The "Citation ledger" section (lines 368-405) is a fenced ` ```json ` array of `{citation, anchor}` objects, machine-read by `phase58-citation-ledger.test.ts`. The 3 entries needing re-anchoring after `README.md`'s lines move (D-08):
```json
{ "citation": "README.md:96-97", "anchor": "Checked live against each ecosystem on 2026-08-18." },
{ "citation": "README.md:117-123", "anchor": "No shipped tool in this project refuses on a VICE version." },
{ "citation": "README.md:107", "anchor": "brew install vice" }
```
(lines 384, 385, 398 in the current file, verbatim above). After `README.md`'s prose is rewritten (D-07) and the table region moves, update each `citation`'s line numbers to match the new locations AND update `anchor` if the rewritten prose no longer contains that exact substring (per D-07, the anchors for the two rewritten sentences will need genuinely new anchor text, not just shifted line numbers — the 96-97 and 117-123 sentences are being REPLACED, not moved verbatim; the 107 anchor `"brew install vice"` may survive unchanged if that exact string still appears in the generated table's Homebrew row per D-05's character-for-character rule).

**New section pattern to add (D-09, the 27 circular citations):** Follow the existing "Case five: one ecosystem under two platforms" section shape (`docs/phase58-declaration-provenance.md:198-211`) — a level-2 heading, one paragraph of prose stating the fact plainly, no code block needed:
```markdown
## Case five: one ecosystem under two platforms

The Homebrew row in `README.md:107` covers `macOS + Linux` in a single row,
so the `homebrew` ecosystem entry appears under both the `linux` and the
`darwin` platform keys in `x64sc`, `c1541`, and `petcat`'s `remedies` trees,
with byte-identical `text` ... This is a deliberate duplication ...
```
Mirror this exact style (heading + one plain-prose paragraph stating the fact, "not an error a future consumer should try to collapse") for the new section documenting D-09's circularity: state plainly that the 27 `"source": "README.md:NNN"` values now cite the generator's own output, why nothing audits the JSON's `source` field today (the ledger guard reads documents, never the JSON), and that following one post-generation lands on output rather than original authorship.

---

## Shared Patterns

### Repo-root discovery (`findRepoRoot`)
**Source:** `src/mcp/vice/phase58-citation-ledger.test.ts:33-42` (itself mirrored from `phase50-findings-contract.test.ts`, per its own header comment)
**Apply to:** `prereq-readme-gen.test.ts` (needs to reach `README.md` at the repository root from `src/mcp/vice/`) and `prereq-readme-gen.ts` if the CLI writer needs the repo root rather than a path relative to its own directory.
```typescript
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}
```
Before adding a fourth copy, `Read` `src/mcp/vice/repo-root.ts` (exports `repoRoot()`, `toolsDir()`, `supervisorDir()` at lines 132/276/283) to check whether its `repoRoot({from, env, exists})` shape fits cleanly — RESEARCH.md Open Question 3 leaves this explicitly unresolved and asks the planner/first executor to make the call in a five-minute check, not to assume either way.

### Never-throw, named-failures return contract
**Source:** `src/mcp/vice/phase58-citation-ledger.test.ts:157-166` (`auditProvenanceCitations()`, quoted verbatim above)
**Apply to:** The guard's top-level comparison function — return `string[]` of failures (or a small structured `{missing, extra, changed}` shape per RESEARCH.md's `compareRecordSets` example), never throw, so `GEN-03`'s fixture test can assert on the failure array's contents rather than catching an exception.

### Fixture cleanup discipline (`try/finally` + `mkdtempSync(tmpdir())`, never repo-tree scratch)
**Source:** `src/mcp/vice/resources-sync.test.ts:51-94`, `src/mcp/vice/phase58-citation-ledger.test.ts` (11 separate `mkdtempSync` call sites, one per test case), `src/mcp/vice/host-tool.test.ts` (`realpathSync(mkdtempSync(...))`)
**Apply to:** Every fixture-based test case in `prereq-readme-gen.test.ts`, especially `GEN-03`'s planted-divergence case (D-12 explicitly mandates this, "stays out of the repository tree" — a previously-hit failure mode per the MEMORY note on repo-tree scratch races).

### Generated-but-committed, with a named regenerate command
**Source:** `src/mcp/vice/build.ts` + `src/mcp/vice/resources-sync.test.ts` (the pair), `src/mcp/vice/package.json:131-138`'s `scripts` block (`"build": "node build.ts"` at line 136 is the naming precedent for a new `"generate:readme"`-shaped script, per RESEARCH.md Open Question 2's recommendation)
**Apply to:** `prereq-readme-gen.ts`'s CLI entry point and whatever `package.json` script the planner names for regeneration; the guard's own failure message should name that exact command verbatim (mirroring how `resources-sync.test.ts:73-75` names `"Run \`node build.ts\` and commit the result"` inline in its assertion message).

### Options-object injection (never a positional boolean)
**Source:** `src/mcp/vice/phase58-citation-ledger.test.ts:56-63` (`CitationAuditOptions { docPath, repoRoot }`), CLAUDE.md Conventions § Injection
**Apply to:** Every function in the new module and its test that touches the filesystem — `deriveEcosystemRows(declaration)` is pure (no injection needed), but any function reading/writing `README.md` or `prerequisites.json` from a path should take a destructured options object (`{ declPath, readmePath }`) so `GEN-03`'s fixture test can drive it against the scratch pair without touching the real files.

## No Analog Found

None. All four files (2 new, 2 modified) have a strong, tracked, in-tree analog. The one genuine gap — no markdown-table generator exists anywhere in this tree — is not a missing analog for a *pattern*, since RESEARCH.md's Don't-Hand-Roll section and D-05's measured facts (no `|`, no newline, 157-char max) establish that no library or prior in-tree renderer is needed; the render function is novel but trivial (~20 lines per RESEARCH.md's own estimate) and has no failure mode to copy a defense against.

## Metadata

**Analog search scope:** `src/mcp/vice/` (all `.ts`/`.mts`/`.test.ts` files reachable from CONTEXT.md's Reusable Assets and Integration Points sections), `README.md`, `docs/phase58-declaration-provenance.md`. No `Glob`/`Grep` beyond targeted reads was needed — CONTEXT.md and RESEARCH.md had already named every relevant analog file explicitly with line citations; this pass verified each citation by direct read and confirmed git-tracked status (`git ls-files`) rather than searching blind.
**Files scanned:** 9 (`resources-sync.test.ts`, `phase58-citation-ledger.test.ts`, `tool-location.mts`, `prerequisites.json`, `repo-root.ts`, `build.ts`, `package.json`, `README.md`, `docs/phase58-declaration-provenance.md`) plus `anno-enum-gen.ts` (read and rejected as an analog — different domain, no markdown output, no doc-generation shape).
**Tracked-source gate:** All 9 analog paths confirmed via `git ls-files -- <path>` — every path printed non-empty (tracked). No gitignored mirror encountered; this repo has no `.gsd/capabilities/` mirror tree relevant to this phase's files.
**Pattern extraction date:** 2026-09-19

---

*Phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts*
