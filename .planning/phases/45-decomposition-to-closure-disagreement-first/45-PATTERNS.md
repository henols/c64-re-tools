# Phase 45: Decomposition to Closure, Disagreement First - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 8 (new/modified) + 3 read-only discipline analogs
**Analogs found:** 8 / 8 (all matched — this project's one-owning-module convention makes analogs easy to find; the risk here is copying the wrong SHAPE, not finding no shape)

**Tree-vs-research note:** the tree confirms every file RESEARCH.md names. One
correction: RESEARCH.md's Recommended Project Structure lists
`anno-store-export.ts`/`anno-store-export.test.ts` as new — confirmed, `git
ls-files` shows neither exists today. No other disagreement found between
research and the tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/skills/routine-queue-walker/scripts/completeness-report.mjs` | utility (skill script, report renderer) | request-response (invokes CLI, renders text) | `src/skills/c64-disk-access/scripts/c1541.mjs` (structure/header/never-throw shape) + `src/mcp/vice/anno-cli.ts`'s `printEvidDisagreementsReport()` (rendering discipline) | role-match (script shape) + exact (rendering discipline) |
| `src/skills/routine-queue-walker/scripts/completeness-report.test.mjs` | test | unit + planted-control | `src/skills/c64-disk-access/scripts/c1541.test.mjs` (two-tier pure-unit + live-gated shape); `src/mcp/vice/anno-verb-coverage.test.ts` (frozen-registry / planted-red-control style) | role-match |
| `src/mcp/vice/anno-store-export.ts` | service/model (serializer) | CRUD (export/import round trip) | `src/mcp/vice/anno-import.ts` (importer discipline: build full write list before first mutation, never-write-partial) | role-match, same "one owning module" convention |
| `src/mcp/vice/anno-store-export.test.ts` | test | CRUD round-trip | `src/mcp/vice/anno-import.test.ts` (colocated `*.test.ts`, `node --test`) | role-match |
| `src/mcp/vice/anno-cli.ts` (5th verb added) | controller (CLI dispatch) | request-response | itself — precedent is its OWN `evid-disagreements` verb (added by plan 43-06): `parseEvidDisagreementsArgs`, `cmdEvidDisagreements`, `printEvidDisagreementsReport`, dispatch `case`, `VERB_OPTIONS` entry, header count/comment update | exact (in-file precedent) |
| `src/mcp/vice/anno-verb-coverage.test.ts` | test (frozen registry) | — | itself — `REAL_VERBS` array + comment history of the 8→2→3→4 raises | exact (in-file precedent) |
| `src/mcp/vice/anno-enum-gen.ts` (fetch/install route rebuilt) | service | CRUD (fetch rows, install enum) | itself — header's "WHAT LEFT / WHAT STAYED" spec names the exact functions (`variantNameFor`, `pairSearchRows`, `planEnumsForPairing`) the new route must feed, and the deleted route's shape (two fetches → parse → install) | exact (in-file spec) |
| `src/mcp/vice/anno-export-asm.ts` (OR-ed constant render added) + `.test.ts` | service + test (render + byte-diff oracle) | transform / batch (render then real-ACME diff) | itself — existing byte-diff oracle test pattern in `anno-export-asm.test.ts` | exact (in-file precedent) |
| `src/skills/routine-queue-walker/SKILL.md` | config/doc (skill playbook) | — | itself — existing Phase 5 `anno coverage` invocation section, and Phase 2.1/3.1 candidate-queue sections that need the xref/block-derived alternate path noted | exact (in-file precedent) |

## Pattern Assignments

### `src/skills/routine-queue-walker/scripts/completeness-report.mjs` (new script)

**Analog:** `src/skills/c64-disk-access/scripts/c1541.mjs` for shebang/header/never-throw shape — **but D-06 means this script does NOT need the host-tool seam** (`invokeSeam()`/`resolveMcpModule()` machinery is NOT applicable; this script is in-process/CLI-invocation only, confirmed by research §7: "no container-out seam is implicated, matching D-06 exactly"). Copy the header CONVENTION, not the seam code.

**Header/shebang pattern** (`c1541.mjs:1-25`):
```js
#!/usr/bin/env node
// completeness-report.mjs -- [ONE-LINE ROLE STATEMENT].
//
// Phase 45, plan NN-NN (D-04, D-06, D-07, D-08, D-09, D-10): [why it exists].
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: rendering the per-fixture
// decomposition-completeness report; REFUSING to render without the
// disagreement input (D-09).
//
// WHAT NOT TO DO:
//   - Never derive a completeness measure from the store's block-type
//     listing (this is `anno-coverage.ts`'s trap 1 — D-05 forbids extending
//     or reimplementing it here).
//   - Never render without the disagreement-query input; a missing input is
//     refused by name, never defaulted to an empty array (D-09).
//   - Never re-implement `evid-reconcile.ts`'s four-bucket join; call the
//     `evid-disagreements` CLI verb and reuse its field names verbatim.
```

**Invocation pattern** — call the CLI verb via `node`, exactly how `SKILL.md:198` already invokes `anno coverage` for Phase 5 (research §7 confirms this is the existing convention: `node vice-proxy.ts anno <verb>` in-process, no seam):
```js
import { spawnSync } from "node:child_process";
// or: import { runAnnoCli } from "<repo>/src/mcp/vice/anno-cli.ts" directly,
// in-process, since this script and anno-cli.ts share the same npm package
// and Node's native TS type-stripping makes an in-process import viable —
// prefer this over spawning a child process where D-06 already rules out
// any container/broker boundary.
```

**Required-argument-with-no-default pattern (D-09.1)** — copy `cmdEvidDisagreements()`'s own "required, refuse by name" shape (`anno-cli.ts:1526-1543`):
```ts
if (!store) {
  console.error("evid-disagreements: --store FILE is required -- this verb answers a question about ONE annotation store.\n");
  console.log(USAGE);
  return 1;
}
```
Apply identically to the disagreements-file/inline argument: no default, throws/refuses BY NAME when absent, never silently substitutes `[]`.

**Refusal/never-throw pattern** — from `c1541.mjs`'s `invokeSeam()` doc comment: "Never rejects: ... all resolve to `{ ok: false, message }`" — the completeness script should follow the CLI's own posture instead (`runAnnoCli`'s try/catch net at `anno-cli.ts:1650-1657`): every expected failure returns its own message and exit code; only genuinely unexpected errors escape to a last-resort net.

---

### `src/skills/routine-queue-walker/scripts/completeness-report.test.mjs`

**Analog:** `src/skills/c64-disk-access/scripts/c1541.test.mjs` — two-tier split (`c1541.test.mjs:1-18` header):
```js
// Two tiers, deliberately separated:
//   1. PURE unit tests against the exported parsers/report-builder core,
//      fed synthetic/literal-measured records -- never call VICE, always run.
//   2. LIVE end-to-end cases against a real derived store, gated on the
//      derivation tools actually being present, skipped with a named reason
//      otherwise (mirror this project's own live-test skip convention).
```

**Planted-control (D-09 verification) pattern** — copy the discipline named in RESEARCH.md §8 (`anno-store.test.ts`'s STORE-04 shape: observed red, then reverted, both recorded): a test that omits the disagreement input and asserts the render REFUSES BY NAME, then restores the input and asserts a normal render succeeds. Structurally mirror `anno-verb-coverage.test.ts`'s "frozen registry, deliberately not derived from the parser under test" posture (`:41-44`) — do not let the refusal-message assertion re-derive from the same code path it is testing.

---

### `src/mcp/vice/anno-store-export.ts` (new)

**Analog:** `src/mcp/vice/anno-import.ts` — copy the header shape and the "digest/build-before-write" discipline.

**Header pattern** (`anno-import.ts:1-38`):
```ts
#!/usr/bin/env node
// anno-store-export.ts
//
// Phase 45, plan NN-NN (D-02): the general JSON export/import module for a
// per-fixture `.annostore` — NOT Ghidra-shaped (that is anno-import.ts's
// job; this module is the general, whole-store-state round trip D-02 says
// does not exist today).
//
// THIS MODULE RECEIVES AN ALREADY-OPEN STORE HANDLE for export, and opens
// (or is handed) a fresh/existing handle for import — never resolves a
// workspace path itself (caller's job, same seam every anno-cli.ts verb
// already uses).
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the JSON schema for a full
// store export (typed ranges, labels, comments — tagged
// provenance: "derived"|"authored" per D-03 — project enums + usage
// bindings, cross-references, exec-observation rows), and the import
// round trip.
//
// WHAT NOT TO DO:
//   - Never write a row before the WHOLE document has parsed/validated
//     successfully (anno-import.ts's own rule — build the full write list
//     first, exactly the same reason: a partial import must never leave the
//     store in a state that is neither the old nor the new content).
//   - Never collapse the derived/authored provenance tag (D-03) — the
//     export schema exists specifically so a diff shows an authored
//     purpose-comment change, which a binary .annostore cannot.
```

**Import discipline to copy verbatim in spirit** (`anno-import.ts:24-38`, the "build write list, then commit" rule) — apply the same pattern: parse+validate the whole exported JSON document into an in-memory write plan before calling any `put*`/`set*` function on the target handle.

**Round-trip test analog:** `anno-import.test.ts` (colocated, `node --test`) — write export → import into fresh store → assert every row-class matches, same shape as this project's other round-trip tests (e.g. `anno-durability.test.ts`'s pattern of writing, closing, reopening, and asserting identity).

---

### `src/mcp/vice/anno-cli.ts` (5th verb — copy the `evid-disagreements` precedent verbatim)

**Analog:** the file's own fourth verb, `evid-disagreements` (added by plan 43-06). This is the EXACT precedent CONTEXT.md and RESEARCH.md both point at.

**Header count/comment update pattern** (`anno-cli.ts:9-16`, currently reads "FOUR VERBS. THAT IS THE WHOLE SURFACE (D-14 ...)"): must become five, with an explicit sentence recording that D-07 supersedes D-14 (per Flag 2) — do not silently bump the number without the supersession sentence.

**Args parser pattern** (`anno-cli.ts:1439-1468`, `parseEvidDisagreementsArgs`):
```ts
function parseEvidDisagreementsArgs(rest: string[]): EvidDisagreementsParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let json = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--store") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) { storeMissingValue = true; }
      else { store = value; i++; }
    } else if (a === "--json") { json = true; }
    else if (a.startsWith("--")) { unknownOption ??= a; }
    else { positional.push(a); }
  }
  return { positional, store, storeMissingValue, json, unknownOption };
}
```
The fifth verb needs an analogous required disagreements-file/inline flag with the same `*MissingValue` refusal shape (never silently swallow the next token).

**Command function pattern** (`anno-cli.ts:1526-1588`, `cmdEvidDisagreements`) — copy this shape exactly: parse args → refuse unknown option → refuse missing value → refuse missing required arg (by name) → confine path via `storePathWithinWorkspace()` → refuse if store doesn't exist (never auto-create) → open store `mustExist: true` → fetch/compute → `--json` branch prints raw JSON, else call a `print*Report()` function.

**Rendering discipline** (`anno-cli.ts:1471-1508`, `printEvidDisagreementsReport`) — copy verbatim for the new report: every measure under its own heading, disagreements printed FIRST as rows, agreement/never-observed as bare counts, `denominator` beside every count, explicit "absence proves nothing" sentence, NEVER a combined percentage/rate.

**`VERB_OPTIONS` registration** (`anno-cli.ts:277-282`):
```ts
export const VERB_OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "render-memmap": ["--provenance", "--out", "--force", "--check"],
  coverage: ["--store", "--out", "--force", "--sample"],
  "export-asm": ["--store", "--out", "--force"],
  "evid-disagreements": ["--store", "--json"],
  // ADD the fifth verb's own closed option set here — this is the ONE
  // declared verb-to-accepted-options fact (IN-06); a flag a verb doesn't
  // read must not be silently accepted.
});
```

**Dispatch switch + unknown-verb message** (`anno-cli.ts:1633-1645`) — add a `case`, and update the "this CLI has exactly four: ..." string to name five verbs including the new one.

**USAGE block** (`anno-cli.ts` around line 256) — add a verb section in the same prose shape as `evid-disagreements`'s own USAGE entry (`:256-271`): states what it answers, what it refuses, that it requires an EXISTING store and creates nothing.

---

### `src/mcp/vice/anno-verb-coverage.test.ts` (raise `REAL_VERBS` + floor)

**Analog:** itself — the comment history at lines 41-59 documents three prior raises (8→2, 2→3, 3→4), each moving `REAL_VERBS` and `ANNO_CLI_VERB_FLOOR` together in the SAME commit.

**Pattern to copy** (`anno-verb-coverage.test.ts:53-59`):
```ts
// RAISED FOUR -> FIVE by phase 45 plan NN-NN, together with
// ANNO_CLI_VERB_FLOOR again: [new verb name] landed as the CLI route for
// [reason], named in [skill file] in the same commit so the positive-control
// test below stays satisfied.
const REAL_VERBS = ["coverage", "export-asm", "render-memmap", "evid-disagreements", "<new-verb>"];
```
Also raise `ANNO_CLI_VERB_FLOOR` in `scripts/lib/anno-cli-verbs.mjs:92` and its assertion at `anno-verb-coverage.test.ts:191` (`assert.equal(ANNO_CLI_VERB_FLOOR, 5)`). **Both files must move together** — this is the guard RESEARCH.md's Pitfall #8 names as the one a plan easily forgets.

---

### `src/mcp/vice/anno-enum-gen.ts` (rebuild fetch/install route)

**Analog:** itself — the header (`:1-60`) is the exact spec.

**Surviving function signatures to feed (verify exact signatures in-file at their line numbers before calling — header cites approximate lines `:185`, `:314`, `:385`, `:443`, `:499`):**
- `variantNameFor(...)` — value → variant name, pinned by injectivity tests across all 256 values. Do not modify.
- `pairSearchRows(...)` (D-23 adjacent-pair rule) — pure function of two already-fetched row arrays (store row 2 bytes earlier than an immediate load, adjacent only). The new fetch supplies the rows; the rule itself is unchanged.
- `planEnumsForPairing(...)` (D-20) — one variant per distinct value actually written, never a 256-entry table; first-seen `lda` address is each value's representative binding site.
- `sanitizeVariantMap(...)` — identifier sanitization gate, unchanged.
- `buildEnumGenerationReport(...)` — "no silent caps" wording contract.

**What to build new:** the fetch (over `anno_disassemble`/`anno_search` rows — NOT the retired analyser's rows) and the install (`anno_create_project_enum` + `anno_apply_enum_usage`, both already-shipped tools), replacing the deleted route's shape: two fetches → `parseSearchRows()`-equivalent → feed heuristics → install. Model the new fetch/parse boundary on how `cmdEvidDisagreements()` fetches via already-shipped store/tool functions and passes plain data into a pure function (`reconcileObservedExecution`) — same "fetch here, compute there" separation this codebase enforces everywhere.

---

### `src/mcp/vice/anno-export-asm.ts` + `.test.ts` (OR-ed named-constant render, D-17)

**Analog:** itself — the existing real-ACME byte-diff oracle in `anno-export-asm.test.ts` is the invocation shape the new test case must copy (open store → render source text via the module under test → assemble with real ACME → diff bytes against the source image). No OR-expression emission exists today (confirmed by grep, RESEARCH.md §"D-17 verified live") — this is new render logic, added alongside the existing single-hex-constant render path, gated on a multi-bit write being detected against `anno-regbits.json`'s existing curated table (no new register data needed — `$D011`/`$D018` entries already exist).

**Concrete target shape** (verified live against real ACME 0.97, per RESEARCH.md):
```asm
lda #VIC_SCREEN_1024 | VIC_CHARSET_2048   ; screen=$0400, charset=$0800
sta $d018
```
Assembles to `a9 04` — identical to a direct `lda #$04`. The render function must emit BOTH the OR-ed named constants (reassembles byte-identically — the proof) AND the decoded comment (the readability) — D-17 requires both, neither alone satisfies criterion 5.

---

### `src/skills/routine-queue-walker/SKILL.md` (extend)

**Analog:** itself. Two existing sections need surgical additions, not rewrites:
- Phase 5 (`SKILL.md:192-258`) already invokes `anno coverage` — leave this call untouched; add prose distinguishing it from the NEW completeness-report verb (two different, non-overlapping measurements — do not let the new report read as replacing this one, per RESEARCH.md §7).
- Phase 2.1/3.1 (`SKILL.md:85-93`, `:134-138`) build the candidate queue from the eleven legacy label prefixes (`zpf_ f_ zpa_ a_ p_ zpp_ e_ j_ s_ b_ r_`) — this logic cannot fire against a dxa/Ghidra-derived store (research measured: derivation writes zero labels). Add an alternate/additional candidate-source step: build the queue from `anno_get_cross_references`/`anno_get_blocks` (a `JSR` target inside a code range is a routine candidate; an address referenced by a split lo/hi pair or table is a symbol candidate), per RESEARCH.md Open Question 1's recommendation.
- Add the numeric stop condition (D-08's stated job for the new report): the completeness report supplies the walk's own stop condition, wired into the SKILL.md's existing "measure the pass instead of asserting it finished" convention.

---

## Shared Patterns

### One-owning-module header convention
**Source:** every `anno-*.ts` file's header (`evid-reconcile.ts:1-73`, `anno-coverage.ts:1-70`, `anno-import.ts:1-38`, `anno-enum-gen.ts:1-60`, `anno-cli.ts:1-45`)
**Apply to:** `anno-store-export.ts` and `completeness-report.mjs` (both new modules)
**Shape:** WHY the file exists (what motivated it) → WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR → WHAT NOT TO DO (each item names the specific past mistake or forbidden shortcut it prevents).

### Never-throw / structured refusal
**Source:** `anno-cli.ts:1650-1657` (`runAnnoCli`'s last-resort net); `c1541.mjs`'s `invokeSeam()` doc comment ("Never rejects... all resolve to `{ ok: false, message }`")
**Apply to:** `completeness-report.mjs`, the new CLI verb's command function
**Rule:** every EXPECTED failure returns its own message/code at the point of detection; only a genuinely unexpected error reaches a top-level catch, and that catch reports it verbatim rather than swallowing it.

### Rendering discipline (report modules)
**Source:** `anno-cli.ts:1471-1508` (`printEvidDisagreementsReport`), `anno-coverage.ts` header trap 1
**Apply to:** the new completeness report
**Rule:** every measure gets its own heading; counts always carry an explicit `denominator`; never compute or print a combined figure, percentage, or rate at the point of display; state explicitly what absence of a row does NOT prove.

### Path confinement
**Source:** `anno-cli.ts:1546-1553` (`storePathWithinWorkspace`, "never grow a second path validator")
**Apply to:** every new caller-supplied path in the new CLI verb and the export/import module
**Rule:** route every caller-supplied path through the existing confinement seam; never write a bespoke validator.

### Frozen-registry / planted-red-control testing
**Source:** `anno-verb-coverage.test.ts:33-44` (`REAL_VERBS` deliberately hand-maintained, not derived from the parser under test); RESEARCH.md §8's STORE-04 citation
**Apply to:** `anno-verb-coverage.test.ts`'s raise, and `completeness-report.test.mjs`'s D-09 planted control
**Rule:** a guard's own positive-control list must never be derived from the code path it tests (that makes the assertion a tautology); a "fails safely" claim must be proven by observing the failure happen (omit the required input, watch it refuse by name), not merely asserted present.

## No Analog Found

None. Every new/modified file in this phase has at least one exact or role-match in-tree analog — consistent with RESEARCH.md's own finding that "zero new architecture" is required.

## Read-Only Discipline Analogs (not modified, but their shape is binding)

| File | Discipline being copied | Do NOT do |
|---|---|---|
| `src/mcp/vice/evid-reconcile.ts` | Four-bucket join + explicit denominator; import and call `reconcileObservedExecution()`, reuse `EvidReconciliation` field names VERBATIM (`disagreements`, `disagreementCount`, `agreementCount`, `blockCoveredNeverObservedCount`, `observedOutsideAnyBlockCount`, `observedAtUndefinedBlockCount`, `denominator`, `positiveClass`, `tier`) | Never re-derive or rename these fields in the new report; never re-implement the join |
| `src/mcp/vice/anno-coverage.ts` | RENDERING discipline (per-measure headings, no combined figure) is copyable | D-05: must NOT extend this module, must NOT derive a completeness measure from the store's block-type listing (trap 1, quoted verbatim in RESEARCH.md §10 item 11) |
| `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` | "Deterministic and idempotent, `git status --porcelain` empty after re-run" bar for the derived provenance half (D-03) | Note: RESEARCH.md §6 found this bar is NOT CI-enforced today (convention only) — the plan should decide whether to accept that convention or add a new CI check; either is defensible, but state the choice explicitly |

## Metadata

**Analog search scope:** `src/mcp/vice/anno-*.ts`, `src/skills/*/scripts/*.mjs`, `src/skills/routine-queue-walker/`
**Files scanned:** ~45 (`anno-*.ts`/`.test.ts` census, all `scripts/*.mjs` under `src/skills/`)
**Pattern extraction date:** 2026-09-10
**Tracked-source gate:** all cited analog paths verified via `git ls-files` (12 spot-checked, all tracked; no `.gsd/capabilities/` or other gitignored mirror path is cited anywhere in this document)
