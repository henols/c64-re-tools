# Phase 61: The Install Tables Generated, and a Guard That Compares Facts - Research

**Researched:** 2026-09-19
**Domain:** In-repo documentation generation from a committed JSON declaration, plus a record-comparison drift guard (no external libraries, no network, no new runtime dependency)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: The generator emits two regions — the VICE ecosystem table, and one overview covering all eight records.** `README.md` today carries exactly one install table (the VICE one, `README.md:99-108`); the other seven declared prerequisites have no README presence at all. So: the VICE remedy tree is rendered once as the ecosystem table, and every record appears once in the overview. — **Reversibility:** costly.
- **D-11: The overview's columns are Claude's to choose.** The user declared ready for context with this open. Intent on record: one row per record, carrying the id, what it unblocks, its one-line remedy, and whether an environment variable overrides its location. `node` belongs in it but is not an "install this first" row in the same sense as `x64sc`.
- **D-02: This phase adds nothing to `src/mcp/vice/prerequisites.json`.** No top-level `ecosystems` map, no per-remedy `label`, no new field of any kind. Direct user decision, not up for re-litigation by the researcher or the planner.
- **D-03: The ecosystem column therefore comes from the id.** `debian-trixie`, not `Debian 13 "trixie"`. D-02 forecloses putting the label in the declaration, and a generator-side id→label map was rejected in the same breath.
- **D-04: Rows dedupe by `(ecosystem, text)`, with a generated `Platforms` column.** `homebrew` appears under both `linux` and `darwin` with identical text. The generated table keeps eight rows and carries the platform coverage as data (`linux, macOS`) rather than as prose inside a label.
- **D-05: A generated cell is the declaration's `text`, character for character.** No markdown injected, no formatting heuristic, no unwrapping on the guard side. Rejected: wrapping the whole cell in backticks. — **Reversibility:** costly.
- **D-06: The markers wrap the table alone.** The generator never owns English prose.
- **D-07: This phase hand-rewrites three prose neighbours, once.** `README.md:96-97`, `README.md:110-111`, `README.md:122-123` — all cite the version columns being dropped. — **Reversibility:** costly.
- **D-08: The citation ledger is re-anchored in the same commit that moves the lines.** Three ledger entries point into or around this table. Any line movement in `README.md` reds `phase58-citation-ledger.test.ts`. Treat a failure as the guard doing its job.
- **D-09: The 27 `"source": "README.md:NNN"` values in `prerequisites.json` are left exactly as they are, and the circularity is written down.**
- **D-10: Shared row-derivation, independently-parsed README.** The guard calls the generator's own row-derivation function on the declaration, and parses the committed README region into records with its own reader. Rejected: a fully independent second reader, and render-then-normalise-then-diff.
- **D-12: `GEN-03`'s planted divergence mutates the real pair in a temp directory.** Copy the real `prerequisites.json` and the real `README.md` into `mkdtempSync(tmpdir())`, change one record, run the guard, assert it fails and names the record that diverged.
- **D-13: Both the generator module and its guard live under `src/mcp/vice/`.** `node --test '*.test.*'` globs only that directory. The module is repo tooling, not shipped surface: leave it out of `src/mcp/vice/package.json`'s `files[]`. Rejected: a repo-root `scripts/` generator, and folding it into `build.ts`.
- Naming: `install-*` collides with `install-resources.ts`'s existing meaning. A `prereq-*` prefix has no incumbent.

### Claude's Discretion

- **D-01** (generated scope) — "you decide".
- **D-04** (row dedupe and the `Platforms` column) — Claude's choice, with the nine-row alternative offered and not taken.
- **D-13** (module location) — "you decide", reasoned above.
- **D-11** (the overview's columns) — left open by the user, intent recorded above.
- Naming of the new module/test file is Claude's, deliberately, to avoid colliding with `install-resources.ts`.

### Deferred Ideas (OUT OF SCOPE)

- **A doctor, a `--check`, or any pre-flight verification surface.** Dropped at owner decision 2026-09-18; `DOCTOR-01`..`09` are in REQUIREMENTS.md § Future Requirements, unbuilt and un-retracted. Not a gap this phase may close, and not a thing a generator may grow into.
- **Correcting `CLAUDE.md`'s stale ACME-prefix citation** — carried forward unclosed from Phase 58's deferred list. Still real, still not this phase's.
- **`DECL-F1` / `DECL-F2` / `DOCTOR-F2`** — the installer consuming the declaration, generating `acme-build/SKILL.md`'s prefix list, and a per-machine `~/.config/c64-re-tools/tools.json`. All already recorded in REQUIREMENTS.md § Future Requirements.
- **Labels for the eight ecosystem ids**, in any location. Foreclosed by D-02 for this phase.
- **`DECL-05` reads Complete but its proof no longer exists in the tree** — flagged during discussion, belongs to Phase 58, not Phase 61. Independently reconfirmed this session (see State of the Art / Deprecated section below).
- Two reviewed todos (`audit-gate.mjs`'s guard budget; "six skills" count) — adjacent, not folded, not this phase's to close.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| GEN-01 | `README.md`'s per-platform install tables are generated from the declaration rather than maintained by hand. | Architecture Patterns (System Architecture Diagram, Recommended Project Structure) define the generator module and its two output regions; Common Pitfalls #1 and #3 cover the concrete rendering hazards (region boundaries, Platforms-column wording); Open Question 1 flags the one unresolved rendering choice (overview's remedy cell) the planner must close before tasks are written. |
| GEN-02 | A build-failing guard catches divergence between the declaration and the generated section by comparing parsed records, never bytes. | Architecture Pattern 2 (Record-comparison, not byte-comparison) gives the exact `compareRecordSets` shape; Pattern 1 (shared derivation, independently-parsed README) gives D-10's required structure with a verbatim precedent (`resources-sync.test.ts`); Common Pitfall 4 (vacuous guard from shared parser bugs) covers the residual risk beyond the minimum bar. |
| GEN-03 | The guard is proven non-vacuous by a planted divergence that makes it fail. | Architecture Pattern 3 gives the exact `mkdtempSync(tmpdir())` fixture recipe (D-12) with a worked code example; Validation Architecture's Phase Requirements → Test Map names the concrete automated test command; ENGINEERING_RULES.md §6 (Non-Vacuous Verification) is the governing rule, cited directly. |

</phase_requirements>

## Summary

This phase has almost no "technology" to research — there is no framework, no
new dependency, and no external service. The entire domain is: read
`src/mcp/vice/prerequisites.json` (frozen, D-02), derive two sets of markdown
rows from it, splice them into two marker-delimited regions of `README.md`,
hand-rewrite three prose neighbours the dropped version columns leave false,
and write a `node --test` guard that parses the committed README region back
into records and asserts those records equal what the same derivation
function produces from the live declaration — never a byte or string diff.
Every technical building block this needs already exists in the tree as a
precedent: `resources-sync.test.ts` for "drive the same function, never
re-derive it", `phase58-citation-ledger.test.ts` for "parse into records with
named failures, and prove it non-vacuously against a planted fixture in
`mkdtempSync(tmpdir())`", and `prerequisites.json` itself, already read three
ways (`readDeclaration()`, `remedyTextsFor()`, `prerequisites.test.ts`'s
structural validators) with zero third-party JSON tooling.

The real work is not technical, it is *decision completion*: `61-CONTEXT.md`
locks nine decisions (D-01 through D-13) but leaves at least two concrete
render questions open that the planner must close before tasks can be
written — the Platforms-column wording (`linux, macOS` vs `linux, darwin`)
and what the overview's "one-line remedy" cell shows for a record with eight
platform-specific commands rather than one universal line. Both are answered
below with recommendations grounded in the locked decisions, not left as
research gaps.

**Primary recommendation:** One new plain-`.ts` module under `src/mcp/vice/`
(not `.mts` — this is repo tooling, not a host-bound artifact) exports pure
functions — `deriveEcosystemRows(declaration)`, `deriveOverviewRows(declaration)`,
`renderMarkdownSection(rows, columns)` — plus a small CLI entry that writes
`README.md` in place between two pairs of HTML-comment markers. A colocated
`.test.ts` guard imports those same derive functions, parses the committed
`README.md` region with its own independent reader (mirroring D-10's
"shared derivation, independently-parsed README"), and diffs the two record
sets with `assert.deepEqual` after sorting both by a stable key — never a
string or byte comparison anywhere in the file. `GEN-03`'s non-vacuity case
copies both real files into `mkdtempSync(tmpdir())`, mutates one declaration
record, and asserts the guard's diff names it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reading the declaration | Repo tooling (Node script, `.ts`) | — | `prerequisites.json` is a build-time/doc-time artifact, not something the shipped MCP server needs this module for; `tool-location.mts`/`remedyTextsFor()` already own the *runtime* read, this phase owns a *generation-time* read |
| Rendering markdown | Repo tooling (Node script, `.ts`) | — | Pure string formatting, no framework; runs under `node` directly (native TS type-stripping), never compiled by `build.ts` |
| Drift detection | `node --test` guard (`.test.ts`) | CI (`Test` step) | Runs in the same `node --test '*.test.*'` glob that already gates every PR; no new CI job needed (D-13) |
| The generated README region | Static file (`README.md`, repo root) | — | Consumed by a human reading install instructions; the generator never runs at install time or MCP-server-startup time |
| The frozen declaration | `src/mcp/vice/prerequisites.json` | — | Untouched by this phase (D-02); both the generator and the guard are read-only consumers of it |

## Standard Stack

### Core
There is no new library to add. Everything below is already a dependency of
the repository or a Node built-in.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in (Node ≥24) | read `prerequisites.json`, read/write `README.md`, `mkdtempSync` fixtures | Every comparable module in this tree (`tool-location.mts`, `phase58-citation-ledger.test.ts`, `resources-sync.test.ts`) uses only this — `[VERIFIED: src/mcp/vice/tool-location.mts:1-40, src/mcp/vice/phase58-citation-ledger.test.ts:23-42]` |
| `node:path` | built-in | path joins, repo-root walk | Same as above |
| `node:test` + `node:assert/strict` | built-in | the guard itself | Project's only test framework — `[VERIFIED: src/mcp/vice/package.json:132]` `"test": "node --test '*.test.*'"` |

### Supporting
None. No markdown-table parsing library, no YAML/frontmatter library, no
templating engine is needed or wanted — `CLAUDE.md`'s Conventions section
states the runtime dependency set is exactly `@mastra/mcp` and `@mastra/core`,
and this module ships as repo tooling excluded from `package.json`'s
`files[]` (D-13), so it cannot add a *runtime* dependency at all; a *dev*
dependency (e.g. a markdown-table formatter) would still be an unjustified
addition given the input is measured hostile-character-free (D-05: no `|`,
no newline, longest cell 157 chars) and the table shape is small and fixed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written markdown table renderer (~20 lines) | An npm markdown-table library | Adds a dependency for a problem this repo's own measured data (D-05) shows has no edge cases to outsource — pipe/newline-in-cell handling, which is the entire value such a library provides, is proven absent |
| HTML-comment markers (`<!-- prereq-gen:x:start -->`) | A YAML-frontmatter-driven include system, or a separate generated `.md` file `\`include\`d` | No existing tool in this repo's toolchain processes markdown includes; GitHub itself renders plain markdown with no include mechanism, so the generated content must live inline in `README.md` (this is also what D-06's "the markers wrap the table alone" implies — markers, not a separate file) |
| Sorting both record sets by a stable key before `assert.deepEqual` | A "record set" custom equality with manual pairwise diffing | Sorting-then-deepEqual is simpler and is exactly what criterion 4 (order-independence) requires; a manual pairwise diff would have to reimplement multiset comparison for no benefit |

**Installation:** None required — no `npm install` for this phase.

**Version verification:** Not applicable — no package to verify against a
registry. `node --version` on this host resolves to v24.20.0 — `[VERIFIED: local `node --version` output, 2026-09-19]` — comfortably above the project's `>=24.0.0` floor stated in `src/mcp/vice/package.json`'s `engines.node` `[VERIFIED: src/mcp/vice/package.json engines field, confirmed via `node -e` read this session]`.

## Package Legitimacy Audit

**Not applicable — no external packages are installed by this phase.** The
generator and its guard use only Node built-ins (`node:fs`, `node:path`,
`node:test`, `node:assert/strict`) and import two existing in-repo modules
(the shared derive function it writes, and nothing else). No `npm install`,
no new `package.json` dependency or devDependency entry.

**Packages removed due to [SLOP] verdict:** none — none proposed.
**Packages flagged as suspicious [SUS]:** none — none proposed.

## Architecture Patterns

### System Architecture Diagram

```
prerequisites.json (frozen, D-02)
        │
        │  readDeclaration-equivalent: JSON.parse, read-only
        ▼
┌───────────────────────────────┐
│ new module (e.g. prereq-       │
│ readme-gen.ts)                │
│                                │
│  deriveEcosystemRows(decl)  ──┼──► [{ecosystem, platforms, text}, ...]  (8 rows, D-04)
│  deriveOverviewRows(decl)   ──┼──► [{id, unblocks, remedy, envVar}, ...] (8 rows, D-11)
│  renderMarkdownSection(rows)──┼──► markdown table text
│  writeGeneratedRegions(...)  ─┼──► splices both tables between their
└───────────────────────────────┘     own HTML-comment markers in README.md
        │                                       │
        │  (generator writes, on demand,        │  (guard reads, on every
        │   via a CLI entry — "Open Question"   │   `npm test` run)
        │   in 61-CONTEXT.md: name the command) │
        ▼                                       ▼
   README.md (repo root)              ┌──────────────────────────────┐
   ── generated region A (ecosystem)  │ new guard (e.g. prereq-        │
   ── generated region B (overview)   │ readme-gen.test.ts)           │
   ── 3 hand-rewritten prose spots    │                                │
      (D-07)                         │  parseReadmeRegion(readmeText,│
                                      │    markerPair) ──► records    │
                                      │    (INDEPENDENT reader, D-10) │
                                      │                                │
                                      │  calls the SAME               │
                                      │  deriveEcosystemRows/          │
                                      │  deriveOverviewRows exported   │
                                      │  by the generator module       │
                                      │                                │
                                      │  compareRecordSets(parsed,     │
                                      │    derived) ──► diff[] (empty  │
                                      │    = pass); sorted by stable   │
                                      │    key, never byte-compared    │
                                      └──────────────────────────────┘
                                              │
                                              ▼
                                    node --test '*.test.*' (CI `Test` step,
                                    no workflow change — D-13)

GEN-03 non-vacuity path (separate test case, same file):
  real prerequisites.json + real README.md
        │  copy into mkdtempSync(tmpdir())            (D-12)
        ▼
  mutated copy (one record's `text` changed)
        │  run the SAME guard logic against the fixture pair
        ▼
  assert: guard reports failure AND names the diverged record
```

### Recommended Project Structure
```
src/mcp/vice/
├── prereq-readme-gen.ts        # generator: derive*, render*, CLI writer (NEW)
├── prereq-readme-gen.test.ts   # guard: independent README parser + record diff + GEN-03 fixture case (NEW)
├── prerequisites.json          # untouched (D-02)
├── tool-location.mts           # untouched; NOT imported by the new module (see Integration Points)
└── package.json                # untouched: no files[] entry for the new module (D-13), no new script *decision needed* — see Open Questions
```
Naming note carried from `61-CONTEXT.md`: `install-resources.ts` already
means "deploy host launcher scripts" — a name starting `install-*` collides
with it in a reader's head. `prereq-*` has no incumbent in this tree
(`[VERIFIED: grep for "prereq-" under src/mcp/vice/ returns no existing file — this session]`). The exact stem
(`prereq-readme-gen`, `prereq-docs-gen`, `readme-from-declaration`, etc.) is
Claude's naming to make deliberately at plan time, per D-13's closing note.

### Pattern 1: Shared derivation, independently-parsed target (D-10)
**What:** The guard never re-derives what rows *should* look like — it calls
the generator's own exported row-derivation function. It *does* write its own
reader for what rows the committed file *actually contains*, because that is
the thing under test.
**When to use:** Any generated-artifact guard in this repo, per `ENGINEERING_RULES.md` §11 and the precedent below.
**Example:**
```typescript
// Source: src/mcp/vice/resources-sync.test.ts:11-13 (verbatim comment, this session)
// "Drives the SAME build() entry point task 2's build.ts exports, through its
//  out-directory flag, into a scratch mkdtempSync(tmpdir()) directory -- the
//  banner text must never exist in two implementations, so this test never
//  re-derives it."
import { build } from "./build.ts";
```
`[VERIFIED: src/mcp/vice/resources-sync.test.ts:1-13]` — quoted verbatim above.
This phase's guard should read:
```typescript
import { deriveEcosystemRows, deriveOverviewRows } from "./prereq-readme-gen.ts";
// never a second implementation of what a row "should" contain
```

### Pattern 2: Record-comparison, not byte-comparison, for drift guards
**What:** Parse both sides into structured records; sort each side by a
stable key; `assert.deepEqual` (or a manual diff that reports which key
differs) — never `assert.equal(stringA, stringB)`.
**When to use:** Exactly this phase's `GEN-02`, and explicitly required by
the owner decision of 2026-09-13 removing "byte-identical guarding of the
generated README" as an assertion class — `[CITED: .planning/REQUIREMENTS.md § Out of Scope, "Byte-identical guarding of the generated README"]`.
**Example (recommended shape, not yet in the tree):**
```typescript
function compareRecordSets<T>(
  actual: T[],
  expected: T[],
  keyOf: (r: T) => string,
): { missing: T[]; extra: T[]; changed: { key: string; actual: T; expected: T }[] } {
  const byKeyActual = new Map(actual.map((r) => [keyOf(r), r]));
  const byKeyExpected = new Map(expected.map((r) => [keyOf(r), r]));
  const missing = [...byKeyExpected.keys()]
    .filter((k) => !byKeyActual.has(k))
    .map((k) => byKeyExpected.get(k)!);
  const extra = [...byKeyActual.keys()]
    .filter((k) => !byKeyExpected.has(k))
    .map((k) => byKeyActual.get(k)!);
  const changed = [...byKeyExpected.keys()]
    .filter((k) => byKeyActual.has(k))
    .map((k) => ({ key: k, actual: byKeyActual.get(k)!, expected: byKeyExpected.get(k)! }))
    .filter(({ actual: a, expected: e }) => JSON.stringify(a) !== JSON.stringify(e));
  return { missing, extra, changed };
}
```
This shape mirrors `auditProvenanceCitations()`'s own return-a-string-array-
of-failures discipline (`[VERIFIED: src/mcp/vice/phase58-citation-ledger.test.ts:151-236]`,
quoted in Code Examples below) rather than throwing, and its `key`-based
comparison naturally gives criterion 4's row-order independence for free —
order was never part of the key.

### Pattern 3: Fixture-based non-vacuity in `mkdtempSync(tmpdir())`, never the repo tree
**What:** A planted-violation test copies real committed files into a scratch
temp directory, mutates the copy, and re-runs the SAME production code
against the copy — never against a hand-built toy fixture, and never leaving
a scratch file inside the repository tree.
**When to use:** `GEN-03` names this shape directly (D-12).
**Why "never leaves it in the repo tree" matters here, concretely, not
abstractly:** `[VERIFIED: MEMORY note "Suite races on repo-tree scratch files" — a sibling test in this exact suite already leaks a gitignored `zz-scratch` directory and fails deterministically until it is deleted by hand]`. This is a real, previously-hit failure mode in this project's test suite, not a hypothetical.
**Example:**
```typescript
// Pattern mirrored from phase58-citation-ledger.test.ts's own fixture cases
// and host-tool.test.ts's realpathSync(mkdtempSync(...)) wrapper (needed
// because a mkdtempSync path can itself sit under a symlinked /tmp).
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "prereq-readme-gen-")));
copyFileSync(realDeclPath, join(scratch, "prerequisites.json"));
copyFileSync(realReadmePath, join(scratch, "README.md"));

// Mutate one record's text in the SCRATCH copy only.
const decl = JSON.parse(readFileSync(join(scratch, "prerequisites.json"), "utf8"));
decl.tools.x64sc.remedies.linux[0].text = "MUTATED FOR TEST";
writeFileSync(join(scratch, "prerequisites.json"), JSON.stringify(decl, null, 2));

// Run the guard's own audit function against the scratch pair.
const diff = auditGeneratedSection({ declPath: join(scratch, "prerequisites.json"), readmePath: join(scratch, "README.md") });
assert.ok(diff.changed.length > 0, "planted divergence must be caught");
assert.ok(diff.changed.some((c) => c.key.includes("debian-trixie")), "the guard must NAME the diverged record");
```

### Anti-Patterns to Avoid
- **Byte or string comparison anywhere in the guard.** Explicitly the class of
  assertion the 2026-09-13 owner decision removed. Reflowed whitespace,
  column padding, and row order must all be tolerated (criterion 4); a record
  comparison gets this for free, a string comparison does not.
- **Re-deriving the "expected" rows a second time inside the test file.**
  Violates D-10 directly and is the exact failure mode `resources-sync.test.ts`'s
  header names: "the banner text must never exist in two implementations."
- **A markdown-table renderer that wraps cells in backticks or otherwise
  reformats the declaration's `text`.** D-05 is explicit and marked
  "Reversibility: costly" — the whole guard design depends on a generated
  cell being the declaration's `text` character-for-character.
- **Adding an id→label map for the ecosystem column, in the generator or
  anywhere else.** D-02/D-03 foreclose this outright; it was proposed and
  directly declined by the owner. Do not "fix" the `fedora-rpmfusion` /
  `Fedora (via RPM Fusion Non-Free...)` mismatch — it is an accepted trade,
  not a bug.
- **Growing `prerequisites.json`** to add an `ecosystems` map, a `label`
  field, or any new field. D-02. Any planning need that seems to require this
  must be solved generator-side or recorded as a gap instead.
- **A doctor, a `--check` flag, or any pre-flight verification surface.**
  Dropped at owner decision 2026-09-18. This phase's generator writes
  documentation once (or on demand); it must never become a runtime
  verification tool.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Repo-root discovery from `src/mcp/vice/` | A third implementation of the `.git`-marker walk | Copy the existing `findRepoRoot()` pattern verbatim, as `phase58-citation-ledger.test.ts` itself did from `phase50-findings-contract.test.ts` (its own header says so) | Third copy of the same 8-line function is the thing this repo's own conventions ("one module per seam") warns against; `src/mcp/vice/repo-root.ts` should be checked first per the CONTEXT's Reusable Assets note, though note it is `.ts` not `.mts` and its exact API needs a read before assuming it fits (see Open Questions) |
| Fixture trees for the guard's own tests | Hand-built toy JSON/markdown strings | `mkdtempSync(tmpdir())` copies of the REAL committed files, mutated (D-12) | Exercises the guard's actual configuration against all eight real records, matching the precedent `phase58-citation-ledger.test.ts` set for exactly this reason |
| Markdown table cell escaping | A general-purpose markdown-table library with pipe/newline escaping | Nothing — D-05 measured that no remedy string contains `|` or a newline, and the longest is 157 characters | Building escaping logic for an input class proven not to occur is exactly the "solving a problem you don't have" the project's engineering rules discourage implicitly through its avoid-unhandled-dependency conventions |

**Key insight:** There is no deceptively-complex sub-problem in this phase.
The two things that look hard at a glance — "parse a markdown table
reliably" and "compare two arbitrary record sets" — are both trivial here
specifically *because* of measured facts already on record: the cell
alphabet is hostile-character-free (D-05), and the record shape is fixed and
small (8 records, ≤9 remedy entries each). Do not import tooling sized for a
harder version of this problem than the one that exists.

## Common Pitfalls

### Pitfall 1: Reading `README.md`'s H2 heading region the same way `phase58-citation-ledger.test.ts` reads its ledger — but forgetting the generated region can appear ANYWHERE in the file, not just at the end
**What goes wrong:** `phase58-citation-ledger.test.ts`'s ledger parser takes
"everything from the heading through end of file" (`LEDGER_HEADING_RE` to EOF,
`[VERIFIED: src/mcp/vice/phase58-citation-ledger.test.ts:65-66]`) because the
ledger genuinely is the document's final section. `README.md:94-115`'s
install-table section is NOT the file's final section — there is unrelated
content both above and below it (`README.md:117-133` "VICE version
compatibility" and "Capabilities with no route on stock" follow it directly).
**Why it happens:** Copying the "heading to EOF" pattern verbatim without
noticing the two documents have different shapes.
**How to avoid:** Use a matched START/END marker pair per generated region
(recommended: HTML comments, e.g. `<!-- prereq-gen:ecosystem-table:start -->`
… `<!-- prereq-gen:ecosystem-table:end -->`), and slice strictly between them.
**Warning signs:** A guard that silently swallows the "VICE version
compatibility" prose into its parsed table region, or fails to notice content
was appended after the table.

### Pitfall 2: Moving `README.md` lines without re-anchoring the citation ledger in the same commit (D-08)
**What goes wrong:** `src/mcp/vice/phase58-citation-ledger.test.ts` re-verifies
a literal anchor against the live file **on every run**. Three ledger entries
in `docs/phase58-declaration-provenance.md` cite exact line ranges inside or
around the table this phase moves/regenerates: `README.md:96-97`, `README.md:117-123`,
`README.md:107` (`[VERIFIED: docs/phase58-declaration-provenance.md:384-385,398, read this session]`
— quoted in the Sources section below). Regenerating the table changes line
numbers; the ledger test goes red the instant that happens.
**Why it happens:** The generator's own commit is naturally scoped to
`README.md` + the new module; it is easy to forget the ledger doc is a THIRD
file that must move in the same commit.
**How to avoid:** Treat a `phase58-citation-ledger.test.ts` failure after
running the generator as **the guard doing its job**, per D-08's own text —
never route around it. Update the three ledger entries' line ranges (and
`README.md:107`'s citation, since D-07 also rewrites the prose that cites it)
in the same commit that moves the lines.
**Warning signs:** `npm test` in `src/mcp/vice` going red on
`phase58-citation-ledger.test.ts` right after the generator runs — this is
expected and must be fixed by updating the ledger, not by reverting the
generator.

### Pitfall 3: Treating D-04's `Platforms` column wording as settled when it is only partially settled
**What goes wrong:** D-04's own text gives the example value `linux, macOS`
for the Platforms column — that is a *translated* word for the `darwin`
platform key, sitting right next to a *raw* ecosystem id column (`debian-trixie`,
per D-03) in the same table. A planner or executor could read D-02/D-03's
"no labels, ever" as blocking this translation too, and render `linux, darwin`
instead, silently deviating from what was actually decided.
**Why it happens:** D-02/D-03 forbid a *label map over the 8 ecosystem ids*
(an open-ended, growable vocabulary). The Platforms column is a *translation
over exactly 3 platform keys* (`linux`/`darwin`/`win32`, closed by the
schema itself — `[VERIFIED: src/mcp/vice/prerequisites.json:6-9 keys used across the file are exactly linux/darwin/win32/universal, this session's read]`)
— a fundamentally smaller, fixed, schema-bound set, not the same kind of
decision. The two rules address different columns for different reasons.
**How to avoid:** Read D-04's literal text as authoritative for what the
Platforms column shows: `linux`, `macOS`, `Windows` as the three fixed,
hardcoded words (never derived from `prerequisites.json`, since the schema
doesn't carry them), while the Ecosystem column stays the raw id. State this
explicitly in the plan rather than leaving it for an executor to infer.
**Warning signs:** A generated table whose Platforms column reads `darwin`/`win32`
instead of `macOS`/`Windows` — technically defensible under D-02/D-03 alone,
but contradicts D-04's own worked example.

### Pitfall 4: Guard passes vacuously because the "expected" and "actual" derivations share a bug
**What goes wrong:** If the guard's independent README parser and the
generator's row-render function make the SAME wrong assumption (e.g. both
assume exactly one row per ecosystem id, silently dropping the Homebrew
dedup case), the guard is green even though the rendered table is wrong.
**Why it happens:** D-10 correctly keeps derivation shared (never
re-implemented), but the *parser* reading the committed markdown back into
records is independent BY DESIGN — its correctness is exactly what
`GEN-03`'s planted-divergence test exists to prove, and only for the failure
direction (divergence detected), not for "the parser correctly reconstructs
every field the derivation produces."
**How to avoid:** `ENGINEERING_RULES.md` §6 (Non-Vacuous Verification) — "a
permanently-green test is not evidence." Beyond the one required planted
divergence (`GEN-03`), consider adding at least one round-trip assertion:
generate → parse the generated output back → assert it equals the derived
rows, on the REAL declaration, so the parser's fidelity is checked against
real data, not only against the single mutated fixture.
**Warning signs:** The guard test suite has exactly one assertion and it is
the required `GEN-03` case — a real README round-trip check strengthens
confidence beyond the minimum bar.

## Code Examples

### Reading the frozen declaration without duplicating `tool-location.mts`'s private reader
```typescript
// Source: src/mcp/vice/tool-location.mts:281-289 (verbatim, this session) --
// readDeclaration() is module-private and this file is .mts (host-bound,
// compiled by build.ts). A plain .ts generator module should NOT import
// from tool-location.mts (crosses the .mts/.ts seam CONVENTIONS warns
// about) and should not import prerequisites.json as a JSON module either
// (adds an import-assertion / resolution wrinkle for no benefit). Read it
// directly, exactly as prerequisites.test.ts and tool-location.mts's own
// readDeclaration() both do:
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const declaration = JSON.parse(readFileSync(join(HERE, "prerequisites.json"), "utf8"));
```
Quoted source, verbatim (`[VERIFIED: src/mcp/vice/tool-location.mts:269-289]`):
```
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

### The repo-root walk to reach `README.md` from `src/mcp/vice/`
Quoted verbatim (`[VERIFIED: src/mcp/vice/phase58-citation-ledger.test.ts:31-38]`):
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

### The non-vacuous failure-array discipline (never throw, return named failures)
Quoted verbatim, the return contract this phase's guard should mirror
(`[VERIFIED: src/mcp/vice/phase58-citation-ledger.test.ts:157-166]`):
```typescript
export function auditProvenanceCitations(options: CitationAuditOptions): string[] {
  const failures: string[] = [];
  const docText = readFileSync(options.docPath, "utf8");
  const { entries, errors } = parseCitationLedger(docText);
  failures.push(...errors);
  // ... more relations pushed onto `failures` ...
  return failures;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Hand-maintained `README.md` install table (`README.md:99-108`), edited by a human on every VICE ecosystem change | Generated from `prerequisites.json`, regenerated on demand | This phase (GEN-01) | Removes the two-place divergence risk this whole milestone (v1.1.0) exists to close |
| "Byte-identical" drift guards in this repo's own recent history | "Equivalent deterministic drift check" via parsed-record comparison | Owner decision, 2026-09-13, already codified in `ENGINEERING_RULES.md` §11 | This phase is the FIRST guard in the tree built under the new rule from scratch — there is no existing record-comparison guard to copy wholesale, only adjacent precedents (`resources-sync.test.ts` is still byte-identical, by design, for compiled `.mjs` output — that is a DIFFERENT artifact class where byte-identity is still correct: compiled code has no "equivalent" form) |

**Deprecated/outdated:**
- The "doctor" concept (`DOCTOR-01`..`09`) — dropped 2026-09-18, un-retracted
  but explicitly out of scope for this phase and this milestone's remainder.
- `scripts/check-npm-packages.mjs` — deleted 2026-09-17 (`d0e9fb2e`). Its
  DECL-05 packaging-proof intent was NOT fully carried into `prerequisites.test.ts`
  despite that file's own header comment claiming "DECL-05's packaging proof
  lives HERE" — `[VERIFIED: grep for "npm pack"/"DECL-05"/"tarball" in src/mcp/vice/prerequisites.test.ts returns zero matches, this session]`. This is a real, already-flagged gap (`61-CONTEXT.md`'s "Flagged during this discussion, not this phase's to fix") — confirmed independently this session, not this phase's to close, but the planner should not assume the header comment describes working code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HTML-comment markers (`<!-- prereq-gen:...:start/end -->`) are the right delimiter mechanism for the two generated regions | Architecture Patterns, Recommended Project Structure | Low — this is a design recommendation with no locked precedent in `61-CONTEXT.md` to contradict it; any unambiguous, greppable marker pair works equally well for D-06/D-10's needs. If the planner picks a different marker syntax, no other decision in this research depends on the specific syntax chosen. |
| A2 | The module should be plain `.ts` (not `.mts`) since it is repo tooling excluded from `package.json`'s `files[]` and never compiled by `build.ts` | Recommended Project Structure | Medium — if wrong, the module would need `HOST_BOUND_ARTIFACTS`/`tsconfig.build.json` wiring it does not need under D-13's stated rationale ("keeping the derive, render and parse functions in one module... The module is repo tooling, not shipped surface"), adding unnecessary build-step coupling |
| A3 | The overview's "one-line remedy" cell (D-11) should show a single representative line for multi-platform records (e.g. `x64sc`) rather than every platform's command | Architecture Patterns / Open Questions below | Medium — this is explicitly left open by the user in D-11 ("the overview's columns are Claude's to choose") and is not fully specified even by Claude's own recorded intent; wrong choice means a planner writes tasks against the wrong cell content and the executor re-derives it differently, risking exactly the two-places-disagree failure mode this milestone exists to close |
| A4 | The regeneration command (how a developer re-runs the generator after editing the declaration) should be a `node` CLI invocation of the new module itself (e.g. `node src/mcp/vice/prereq-readme-gen.ts --write`) rather than an `npm run` script | Open Questions below | Low — `61-CONTEXT.md`'s own "Specific Ideas" section states this was deliberately left open ("an npm script... a `--write` flag on the module, or something else... the planner owns naming it") — any reasonable, documented choice satisfies `ENGINEERING_RULES.md` §11's four-step procedure as long as the guard's failure message names the exact command |

**If this table is empty:** N/A — see rows above. None of these assumptions
bear on `GEN-01`/`GEN-02`/`GEN-03`'s pass/fail criteria; they bear only on
specific rendering and ergonomics choices the planner must make deliberately.

## Open Questions

1. **What does the overview's "one-line remedy" cell show for `x64sc`/`c1541`/`petcat` (8-9 platform-specific commands, no `universal` entry) versus `acme` (2 linux + 1 universal) versus `ghidra`/`acme-lib`/`dxa`/`node` (exactly one `universal` line each)?**
   - What we know: D-11 says "its one-line remedy" as if every record has
     exactly one; measured, four of eight records (`ghidra`, `acme-lib`,
     `dxa`, `node`) genuinely do (single `universal` entry — `[VERIFIED: src/mcp/vice/prerequisites.json:278-286,304-313,332-341,358-367,404-413]`),
     but `x64sc`/`c1541`/`petcat` have 9 entries each and `acme` has 3.
   - What's unclear: whether the overview cell for the multi-entry records
     should say something like "see table above", pick one platform's
     command arbitrarily, or omit the remedy cell content for records
     already covered by the ecosystem table.
   - Recommendation: For `x64sc`/`c1541`/`petcat`, render the overview's
     remedy cell as a pointer to the ecosystem table (e.g. "see table
     above") rather than picking one arbitrary command — arbitrarily picking
     one of nine equally-valid platform commands risks the same kind of
     silent-drift confusion this milestone exists to remove, and D-01's own
     stated reason for having TWO tables was to avoid "three byte-identical
     copies... in the README", which argues against re-flattening the
     ecosystem detail back into the overview. For `acme`, either its
     `universal` entry ("Install ACME.") or its most common ecosystem line
     is defensible; the `universal` line matches how `acme-lib`/`ghidra`/
     `dxa`/`node` are shown, giving one consistent rule: "prefer `universal`
     if present, else point at the ecosystem table." The planner should
     state this rule explicitly rather than leave it to the executor.

2. **What is the exact regeneration command name and location?**
   - What we know: `61-CONTEXT.md`'s own "Specific Ideas" section names this
     as deliberately unresolved during discuss-phase, and `ENGINEERING_RULES.md`
     §11 requires the four-step procedure (update source → regenerate →
     run drift guard → verify delta) to exist, naming the command.
   - What's unclear: npm script (`"generate:readme": "node prereq-readme-gen.ts --write"`
     in `src/mcp/vice/package.json`) vs. a bare CLI invocation vs. something
     else; and whether the guard's own failure message should print the
     exact command inline.
   - Recommendation: An npm script is the more discoverable option (visible
     in `package.json`, consistent with how `npm test`/`npm run typecheck`
     already work) and costs one line; the guard's assertion-failure message
     should name it verbatim so a red CI run tells a developer exactly what
     to run, not just that something diverged.

3. **Does `src/mcp/vice/repo-root.ts` (the project's stated owning resolver for
   the project root, per `CLAUDE.md`'s Conventions) already export something
   this module should use instead of a fourth copy of the `.git`-marker walk?**
   - What we know: `CLAUDE.md` names `repo-root.ts` as "the one shared
     resolver for the project root", and `61-CONTEXT.md`'s Reusable Assets
     section explicitly flags it as "should be checked first" before adding
     a third copy of the plain walk.
   - What's unclear: this research did not read `repo-root.ts`'s exact
     exported API/signature this session, so it is unconfirmed whether its
     shape (sync vs. async, options object vs. bare call, `.ts` vs. `.mts`)
     fits a generator module cleanly, or whether it is itself `.mts`
     (host-bound) and therefore crosses the same seam boundary `tool-location.mts`
     does.
   - Recommendation: The planner or first executor task should `Read` `src/mcp/vice/repo-root.ts`
     before deciding whether to import it or to mirror the plain walk a
     third/fourth time — this is a five-minute check this research did not
     spend the budget on since three separate copies already coexist in this
     tree without apparent harm (`61-CONTEXT.md`'s own Reusable Assets note
     names this duplication as pre-existing, not newly introduced here).

## Environment Availability

Skipped — this phase has no external tool, service, or runtime dependency
beyond the Node interpreter already required to run and test the whole
`src/mcp/vice` package (`>=24.0.0`, already verified present on this host).
No VICE, ACME, Ghidra, or dxa involvement; no network access; no database.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`) — no separate framework `[VERIFIED: src/mcp/vice/package.json:132]` |
| Config file | none — `test-gate.mjs` names manual-only exclusions, everything else is auto-globbed |
| Quick run command | `cd src/mcp/vice && node --test prereq-readme-gen.test.ts` |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (excludes the twelve manual-only files per `test-gate.mjs`; this phase's guard is NOT manual-only — it needs no host binary, no emulator, no network) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | README's install tables come from the declaration, hand-maintained copy gone | unit (structural: no leftover hand-authored table alongside the generated one) | `node --test prereq-readme-gen.test.ts -t "no hand-maintained table remains"` | ❌ Wave 0 |
| GEN-02 | Guard compares parsed records, fails on divergence, never bytes | unit | `node --test prereq-readme-gen.test.ts -t "record comparison"` | ❌ Wave 0 |
| GEN-03 | Guard is proven non-vacuous by a planted, committed divergence | unit (fixture-based, `mkdtempSync`) | `node --test prereq-readme-gen.test.ts -t "planted divergence"` | ❌ Wave 0 |
| (regression) | `phase58-citation-ledger.test.ts` still passes after the ledger is re-anchored (D-08) | unit | `node --test phase58-citation-ledger.test.ts` | ✅ exists, must stay green after this phase's edits |
| (regression) | `prerequisites.test.ts`'s structural gates over `prerequisites.json` still pass (declaration untouched, D-02) | unit | `node --test prerequisites.test.ts` | ✅ exists, no change expected |

### Sampling Rate
- **Per task commit:** `node --test prereq-readme-gen.test.ts` plus `node --test phase58-citation-ledger.test.ts` (the second is load-bearing per D-08 — any README line movement risks it)
- **Per wave merge:** `npm run test:automated` (`cd src/mcp/vice`)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `npm run typecheck`

### Wave 0 Gaps
- [ ] `src/mcp/vice/prereq-readme-gen.test.ts` — covers GEN-01, GEN-02, GEN-03
- [ ] `src/mcp/vice/prereq-readme-gen.ts` — the generator itself (not a test gap, but nothing to test until it exists)
- No shared fixture/conftest infrastructure needed — this test file is self-contained per the fixture patterns shown above
- No framework install needed — `node --test` is already wired

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface in this phase — a build-time generator and test guard |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Marginal — yes | The generator reads a committed, repo-controlled JSON file (`JSON.parse`, no external/untrusted input) and writes to a committed markdown file; no user-supplied input crosses this boundary at generation time |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via declaration `text` fields rendered into a user-facing shell command example | Tampering | Not applicable here — the generator only ever writes markdown PROSE (a code-fenced or table-cell string a human reads and types manually); this phase's cross-cutting constraint is explicit that the generator "never writes, and never implies, a command that is run on the user's behalf." No `exec`/`spawn` of any declaration string occurs anywhere in this phase's scope. |
| Path traversal via a malicious `mkdtempSync` fixture path | Tampering | Not a realistic threat surface — `mkdtempSync(tmpdir())` fixture paths are process-generated, not user-supplied, mirroring the existing pattern in `host-tool.test.ts` and `phase58-citation-ledger.test.ts` |

This phase's risk surface is effectively nil: it is a documentation generator
over a static, repo-controlled, already-audited (`prerequisites.test.ts`)
JSON file, with no network, no process spawning, and no runtime code path
change to the shipped MCP server. The never-auto-install constraint (CLAUDE.md,
restated in `61-CONTEXT.md`'s Phase Boundary) is the one standing constraint
worth re-verifying at review time: confirm the generator never emits, and
the overview table never implies, an executable command the tool runs on
the user's behalf — every remedy string stays prose for the user to type.

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/mcp/vice/prerequisites.json` — full file, all 8 records, read this session
- `src/mcp/vice/tool-location.mts` — header, `readDeclaration()` (lines 269-289), `remedyTextsFor()` (930-968), `resolveTool()` (520-560)
- `src/mcp/vice/resources-sync.test.ts` — header and first test (lines 1-60)
- `src/mcp/vice/phase58-citation-ledger.test.ts` — header through `auditProvenanceCitations()` (lines 1-236)
- `src/mcp/vice/prerequisites.test.ts` — header (lines 1-40); confirmed via grep that its "DECL-05 lives HERE" claim has no matching `npm pack`/tarball code
- `src/mcp/vice/host-tool.mts` — `withRemedy()` (1352-1355) and surrounding usage
- `src/mcp/vice/build.ts` — `HOST_BOUND_ARTIFACTS`, `HOST_BOUND_DATA_FILES` (lines 1-100)
- `src/mcp/vice/package.json` — `files[]`, `test` script, `engines`
- `README.md:85-133` — the full install-table section and its neighbours
- `docs/phase58-declaration-provenance.md` — "Case five" (185-211) and Citation ledger (368-398)
- `.planning/ENGINEERING_RULES.md` §6 (Non-Vacuous Verification) and §11 (Generated Artifacts)
- `.planning/REQUIREMENTS.md` — full file, this milestone's requirement table and Out of Scope table
- `.planning/phases/61-.../61-CONTEXT.md` — full file, all locked and discretionary decisions

### Secondary (MEDIUM confidence)
- None used — this phase required no external/web research; every claim traces to a file read this session or a locked decision in `61-CONTEXT.md`.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every building block verified present in the tree this session
- Architecture: HIGH — directly mirrors two existing, working guards (`resources-sync.test.ts`, `phase58-citation-ledger.test.ts`) with named line citations
- Pitfalls: HIGH — all four pitfalls trace to a specific, quoted, locked decision or a measured fact already on record, not speculation

**Research date:** 2026-09-19
**Valid until:** No expiry pressure — the domain (in-repo Node tooling, no external dependency) does not go stale on a 30-day clock; re-check only if `prerequisites.json`'s schema, `README.md`'s table section, or the citation ledger tests change before this phase executes.
