# Phase 38: PROOF-01..03 on Real Cracked Code - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** ~9 (comparator + test, evidence README/SCHEMA, proof01/02/03 outcome files, PROOF-02 site-enumeration probe, capture pipeline if PROOF-02 goes deep)
**Analogs found:** 9 / 9

All analogs below were verified with `git ls-files` (all print non-empty — none are gitignored mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/dxa-proof01-compare.ts` (name TBD — the PROOF-01 comparator) | utility/service | transform (batch, pure) | `src/mcp/vice/dxa-partition.ts` | exact (same author's module, same "never sees the other tier" discipline) |
| `src/mcp/vice/dxa-proof01-compare.test.ts` | test | transform | `src/mcp/vice/dxa-partition.test.ts` | exact |
| `.planning/phases/38-.../evidence/README.md` | config/doc (evidence convention) | — | `.planning/phases/33-.../evidence/README.md` | exact |
| `.planning/phases/38-.../evidence/SCHEMA.md` | config/doc (outcome-line vocabulary) | — | `.planning/phases/33-.../evidence/SCHEMA.md` | exact |
| `.planning/phases/38-.../evidence/proof01-dxa-real-release.md` | evidence outcome file | request-response (measurement transcript) | `.planning/phases/35-.../evidence/35-dxa03-real-image.md` (real-release dxa run) + `docs/phase23-real-release-gate-findings.md` (beside-the-fixture framing) | role-match |
| `.planning/phases/38-.../evidence/proof01-dxa-real-release.mjs` (if a driver script is wanted) | script (CLI, evidence) | file-I/O + batch | `.planning/phases/33-.../evidence/capture-pair.mjs` | exact (convention: "drive the shipped seams, not private copies") |
| `.planning/phases/38-.../evidence/proof02-computed-dispatch.mjs` | script (CLI, evidence) | file-I/O + batch (static site enumeration) | `.planning/phases/33-.../evidence/capture-pair.mjs` (script shape/header) + `.planning/phases/23-.../23-08-PLAN.md` (site-enumeration method, never dispatched) | role-match / partial (method analog is a plan doc, not code) |
| `.planning/phases/38-.../evidence/proof02-computed-dispatch.md` | evidence outcome file | request-response | `.planning/phases/36-.../evidence/36-07-acceptance-run.md` | exact |
| `.planning/phases/38-.../evidence/proof03-bank-boundary.md` | evidence outcome file | request-response | `.planning/phases/37-.../evidence/37-06-bank-decode-bypass-red.md` + `37-06-path-dependent-decline-red.md` | exact |

**Note on scope:** RESEARCH.md is explicit that no other shipped `src/` files are created — every other instrument (`dxa-run.ts`, `dxa-listing.ts`, `ghidra-run.ts`, `anno-bank.ts`, `anno-join.ts`, `anno-d64.ts`) is imported unchanged. The evidence `.mjs` driver scripts are the only "new code that touches the seams," and the PROOF-01 comparator is the only genuinely new piece of logic.

---

## Pattern Assignments

### `src/mcp/vice/dxa-proof01-compare.ts` (utility, transform) — the PROOF-01 comparator

**Analog:** `src/mcp/vice/dxa-partition.ts` (full file read, 689 lines)

This is the closest available analog because it is written by the same discipline this new module must follow: never import the two things it joins (dxa-listing's output stays a *sibling* concern, never re-exported by the comparator itself), always name both tiers/inputs even if one didn't run, and print rate lines with `POSITIVE_CLASS` and an explicit numerator/denominator — never a bare percentage.

**Header-comment convention to copy** (module purpose statement, this project's WHY-first style):
```typescript
// dxa-partition.ts
//
// Phase 35, plan 35-03 (DXA-04): the ONE producer of a ground-truth
// code/data partition in this project. `dxa-listing.ts` parses dxa's OWN
// CLAIM about a listing; this module never sees dxa's output at all --
// neither tier below imports `dxa-listing.ts`, and a rate comparing the two
// is always computed by a caller that names both, never folded together
// here (T-35-13).
```
For the new comparator, invert this exact framing: it is precisely the caller T-35-13 anticipates — it MUST import both `dxa-run.ts`'s `runDxaDisassemble()` result and `dxa-partition.ts`'s `partitionByteDerived()` result, and join them. State this in its own header, citing `dxa-partition.ts:462-464`'s `certainCode`-always-empty doc comment directly (quoted below) since the comparator's false-positive line depends on it.

**No-execution-oracle / no-guessing discipline** (lines 39-58) — copy verbatim as a constraint statement in the new module's header:
```typescript
// NO EXECUTION ORACLE ANYWHERE IN THIS MODULE. ...
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` ... and MUST NEVER CALL
// `node:child_process` (mirrors `dxa-listing.ts` and `dxa-run.ts`'s SEAM-05
// discipline) -- ground truth here is read from a report and from raw bytes
// the caller already has; it is never derived by running anything.
```
The comparator itself should follow the same rule: it takes a `DumpListingMap` (from `runDxaDisassemble()`'s result, already fetched by the caller) and a `ByteDerivedPartition` (from `partitionByteDerived()`) as plain data — it does not itself spawn dxa or touch the filesystem.

**Rate-formatting pattern to reuse exactly** (`formatPercent()`, lines 128-156) — import, do not reimplement:
```typescript
export function formatPercent(numerator: number, denominator: number): string {
  ...
  if (denominator === 0) {
    throw new Error("formatPercent: refusing a zero denominator -- no rate exists to print for an empty class.");
  }
  ...
  return `${wholePart}.${String(fracPart).padStart(2, "0")} (${numerator}/${denominator})`;
}
```
Import this directly from `dxa-partition.ts` rather than reimplementing rounding — it already handles the exact half-up integer-rounding requirement this project uses everywhere ("`72.39 (97/134)`" shape).

**The load-bearing fact the comparator must state, not compute around** (lines 463-467, quoted verbatim, this is the single most important excerpt for this phase):
```typescript
/** The byte-derived ground-truth partition. `certainCode` is ALWAYS empty
 * (A-09: this tier decides exactly two facts, and neither is ever code) --
 * it exists as a field purely so the denominator discipline (`certainCode
 * .size + certainData.size`, never the image size) reads identically to the
 * source-derived tier's. */
```
Because `certainCode` is always empty, `PROOF01_FALSE_POSITIVES` cannot be a computed integer against the byte-derived tier. Follow the report-refusal pattern from `renderByteDerivedReport()` (lines 566-571) — a *stated* refusal, never a silent `0`:
```typescript
const denominator = partition.certainCode.size + partition.certainData.size;
if (denominator === 0) {
  lines.push("BYTE_DERIVED_DATA_FRACTION: refused -- denominator is 0 (no classifiable bytes)");
} else {
  lines.push(`BYTE_DERIVED_DATA_FRACTION: ${formatPercent(partition.certainData.size, denominator)}`);
}
```
For the comparator's false-positive line, the equivalent form is: `PROOF01_FALSE_POSITIVES: structurally-uncomputable (certainCode.size is always 0 on the byte-derived tier -- see dxa-partition.ts:462-464)` — never `0`.

**"Both tiers always named" pattern** (`renderPartitionReport()`, lines 594-636) — the report always prints both tier sections even when one didn't run, with an explicit reason string rather than omission. The new comparator's report should follow the same shape: print the real-release numbers AND the fixture numbers side by side, unconditionally, never omitting one because it's less flattering.

**CLI entry-point convention** (lines 639-689) — mirror this exact `main(argv)` + `if (process.argv[1] && resolvePath(...) === fileURLToPath(...))` guard so the module is both importable and directly runnable:
```typescript
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

---

### `src/mcp/vice/dxa-proof01-compare.test.ts`

**Analog:** `src/mcp/vice/dxa-partition.test.ts` (402 lines, full read of header + Task 1 section)

**Imports/header pattern** (lines 1-31, quoted):
```typescript
#!/usr/bin/env node
// dxa-partition.test.ts
//
// Phase 35, plan 35-03 (DXA-04). Three task sections, marked below: ...
// HERMETIC. No ACME, no dxa, no `node:child_process` INSIDE the module under
// test (dxa-partition.ts never imports either) -- the only `spawnSync` calls
// in this FILE drive the CLI as a subprocess for the task-3 CLI cases, which
// is a property of the test, not of the module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  directiveLength,
  partitionSourceDerived,
  ...
} from "./dxa-partition.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "dxa");
```
Copy this exact "HERMETIC" framing and the `HERE`/`FIXTURES` constant pattern. The new comparator's test needs its own hermetic fixture (likely a tiny synthetic `.prg` + a fabricated `DumpListingMap`-shaped object, NOT the real, gitignored `danish.d64` — the live corpus test belongs in an evidence script/manual-only test, per Pitfall 6 in RESEARCH.md, joining `MANUAL_ONLY_TESTS` if it becomes a `*.test.ts`).

**Test naming convention:** `test("task1: <what>, <why/source>", () => {...})` — descriptive strings citing the exact source of the expected numbers (e.g. "reproduces Phase 23's independently re-derived 145/131/3/90/4 exactly, from the committed fixture").

---

### `.planning/phases/38-.../evidence/README.md` and `SCHEMA.md`

**Analog:** `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d.../evidence/README.md` and `SCHEMA.md` (both read in full/substantial excerpt)

**README.md structure to copy:**
- Opening paragraph stating why the evidence dir exists and where cross-wave working artifacts live (if any binary/scratch work happens, e.g., for PROOF-02's depacked capture route): `PROBE_DIR=$HOME/.cache/c64-re-tools/phase33` is Phase 33's own convention — Phase 38 should mint its own `PROBE_DIR=$HOME/.cache/c64-re-tools/phase38` if PROOF-02 goes the deep/capture route, never `/tmp` (tmpfs, no reboot-cleanup) and never inside the checkout.
- **"Nothing binary lands here"** disclosure line — copy verbatim in spirit: `**Nothing binary lands here.** No corpus image, no `.vsf` snapshot and no flat 64K capture is ever committed (`D-27`); identity travels as name plus sha256 and nothing else.`
- A **Files** table: one row per artifact, columns `File | Owner (plan id) | What it is | What it proves`.
- A numbered **"Evidence conventions"** section, binding on every plan in the phase, reused directly:
  1. Transcript convention (`$ <exact command>` line, then real stdout/stderr, never reconstructed).
  2. Worktree-independent probe directory (if PROOF-02 needs one).
  3. Broker stopped, recorded (`D-11`) — quote directly, this applies verbatim to Phase 38 too since `test:automated` sampling is identical:
     ```
     Every live run in this phase is taken with the VICE broker **stopped**...
     Verify before the run with `systemctl --user is-active vice-broker` (expect
     `inactive`) and `pgrep -af x64sc` (expect no output), and paste both.
     ```
  4. Baseline stated, never re-derived — Phase 38's own version must cite the Phase 37 closing baseline (`tests 3519 / pass 3517 / fail 2`, per 38-VALIDATION.md) using the exact same "never re-derived, never a gate" wording.
  5. Voided runs recorded, not discarded.

**SCHEMA.md structure to copy** (read in full, section 1-2):
- Opening: **"Binding. Committed before any measurement exists."**
- **Outcome-line conventions** section, copied near-verbatim:
  ```
  Every rule input and every recorded fact is a bare `NAME: value` at **column 0**
  of a named evidence file. Never indented, never inside a fenced block...
  - **Final occurrence wins.**
  - **One declared source file per line.**
  - **Absence.**
  - **Transcripts are appended, never reconstructed.**
  ```
- A table declaring every `PROOF01_*`/`PROOF02_*`/`PROOF03_*` line name, its value domain, and its single declared source file — mirroring Phase 33's "the five gate inputs" table shape (`Line | Domain | Corpus-free | Declared source file`). Phase 38's own outcome lines (per 38-VALIDATION.md's per-task verification map) already have real names to slot in directly: `PROOF01_RELEASE_SHA256`, `PROOF01_DATA_RECOVERY_PCT`, `PROOF01_FALSE_POSITIVES`, `FIXTURE_DATA_RECOVERY_PCT`, `FIXTURE_FALSE_POSITIVES`, `FIXTURE_REPRODUCED`, `PROOF02_COMPUTED_DISPATCH`, `PROOF02_SITES_ENUMERATED`, `PROOF02_SEARCH_DEPTH`, `PROOF03_*`.
- Note: unlike Phase 33 (which has a rules-vs-inputs `DECISION-RULE.md`), Phase 38 is explicitly NOT gate-and-rule-shaped (38-RESEARCH.md: "not a full rule table") — SCHEMA.md alone (no DECISION-RULE.md analog needed) is sufficient; confirm this scope choice rather than importing DECISION-RULE.md's rule-ordering machinery wholesale.

---

### `.planning/phases/38-.../evidence/proof01-dxa-real-release.md`

**Analog:** `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa03-real-image.md` (real-release dxa extraction/run record) + framing from `docs/phase23-real-release-gate-findings.md:456-479` (the "beside the fixture" table format, quoted in RESEARCH.md).

**Pattern to copy:** state the corpus identity (name + sha256) before any number, per the sha256-first discipline in `capture-pair.mjs`'s header ("Identity is name plus digest over the exact bytes... the script refuses outright when the file on disk digests to anything else"). Then print the real-release numbers and the fixture numbers as adjacent, separately labelled blocks (never merged into one series), each with `POSITIVE_CLASS`, numerator, denominator explicit. State the false-positive line as the structurally-uncomputable statement (see comparator section above), naming it as a NEW, separately-named weakness from the already-disclosed "no independent external check (`memmapshow` absent)" per resolved decision #3.

---

### `.planning/phases/38-.../evidence/proof02-computed-dispatch.mjs` and `.md`

**Analog (script shape):** `.planning/phases/33-.../evidence/capture-pair.mjs` header (read in full) — copy the "IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM" section structure and the "WHAT NOT TO DO" bullet-list convention:
```javascript
// IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM
// -------------------------------------------------------
// Everything below that could have been re-authored is imported or invoked
// instead, because a second copy of any of it would make this measurement a
// measurement of the copy: ...
```
For PROOF-02, the equivalent list is: `anno-d64.ts`'s `listEntries()`/`extractEntry()` for corpus access, `dxa-listing.ts`'s `parseDumpListing()` for the independent (non-Ghidra) site-enumeration route (grep the `-a dump` listing for raw opcode `$6C`, `JMP (abs)`), `ghidra-run.ts`'s `runGhidraAnalyze()` for the resolution check, and (if the deep/capture route is chosen) `vsf-slice.ts` + `stock-reproducible-run.ts` for the depacked flat-64K capture.

**Analog (method):** `.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-08-PLAN.md` (never dispatched, read in RESEARCH.md) supplies the D-06 circularity-guard method: enumerate candidate indirect-jump sites via a static, non-Ghidra route FIRST (independent of Ghidra's own export), THEN check whether Ghidra resolved each one — never scan Ghidra's own `## REFERENCES`/`## STRUCTURAL_FACTS` output to discover which sites to check.

**Analog (outcome file):** `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-07-acceptance-run.md` (quoted in RESEARCH.md lines 227-233) — the exact `STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found` line shape and the explicit depth-of-search disclosure ("Not known / not established here... the game's own real code is packed and never appears as static bytes..."). Copy this disclosure-of-scope-limit pattern directly: state the depth searched, name it plainly, and use `not-exercised` (never `pass`/`could-not-run`) per the criterion's own required spelling.

---

### `.planning/phases/38-.../evidence/proof03-bank-boundary.md`

**Analog:** `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md` and `37-06-path-dependent-decline-red.md` (both read).

**Structure to copy exactly** (from `37-06-bank-decode-bypass-red.md`'s own opening):
```markdown
# AUTO-04's bank decode observed RED (Phase 37, plan 37-06, Task 2)

**What this record is:** a hand-run transcript proving `anno-bank.ts`'s
`decodeBankState()` -- ... genuinely matters: bypassing it, in a scratch
copy only, makes the `$34`/`$33` two-value flip **stop changing the
annotation**...

Date: 2026-09-05.

## Part 1: the [thing bypassed/measured]

`decodeBankState()`'s committed form, `src/mcp/vice/anno-bank.ts`:
```typescript
[real excerpt of the unmutated function]
```

Bypassed, in a scratch copy only, to a form that ...:
```typescript
[the mutated form, clearly labelled BYPASS/mutation]
```

## Part 2: the scratch tree, and the red observation
[scratch-tree construction: mutated module + unmutated siblings via re-export
shims, driven against the real committed capture, git status --porcelain
clean before/after]
```
Phase 38's PROOF-03 file should re-run this identical scratch-copy technique (not re-author it) against the same committed fixture (`fixtures/ghidra/bank-path-dependent.a` / `export-bank-path-dependent.txt`), producing a fresh, self-contained transcript per resolved decision #4, and cite (not merely repeat) `37-06`'s prose. State both directions explicitly: (1) same address annotates differently under two bank states, (2) the disagreeing-values program point where forward-carrying produces a confident wrong label vs. the committed code's correct decline.

Also carry forward the fixture's own self-correction note (`bank-path-dependent.a:9-11`): `$34`'s bit 2 IS set (0b100), contrary to a mislabelled comment in sibling `bank.a` — do not repeat that error if citing the fixture.

---

## Shared Patterns

### Seam discipline: host-tool invocation
**Source:** `src/mcp/vice/dxa-run.ts:171` (`confineToWorkspace()`), `src/mcp/vice/ghidra-run.ts:106-118` (`GhidraRunOptions`, injectable `run` seam)
**Apply to:** every new evidence script and the comparator module.
```typescript
// dxa-run.ts:171
function confineToWorkspace(root: string, relative: string, what: string): string { ... }
```
Any new script that reads a corpus binary, writes an extracted `.prg`, or invokes `dxa`/`ghidra` MUST pass through `runDxaDisassemble()`/`runGhidraAnalyze()` with an explicit `repoRoot` pointed at a `mkdtempSync` scratch dir OUTSIDE the checkout (per RESEARCH.md Pitfall 2, citing `ghidra-live.test.ts`'s `D-36-12` convention) — never a direct `child_process.spawn("dxa"/"analyzeHeadless", ...)`, which SEAM-05's whole-tree grep gate bans outright.

### Corpus identity: sha256-before-processing
**Source:** `.planning/phases/33-.../evidence/capture-pair.mjs` header ("Identity is name plus digest over the exact bytes... the script refuses outright when the file on disk digests to anything else")
**Apply to:** `proof01-*.mjs`, `proof02-*.mjs` (any script reading `danish.d64`/`saeger.d64`).
Assert `sha256sum` of the corpus file against the recorded value in `docs/phase33-reproducible-run-gate-findings.md`'s frontmatter BEFORE any extraction/measurement; fail loudly (throw), never silently substitute or skip.

### Outcome-line recording convention
**Source:** `.planning/phases/33-.../evidence/SCHEMA.md` §1 (Outcome-line conventions)
**Apply to:** all three `proof0N-*.md` files.
Bare `NAME: value` at column 0, never indented or fenced; final occurrence wins; one declared source file per line name; absence permitted only where explicitly noted, never silent.

### Bank-state model (read-only reuse)
**Source:** `src/mcp/vice/anno-bank.ts` (`decodeBankState()`), `src/mcp/vice/anno-bank.test.ts` (18 cases, 2 planted violations)
**Apply to:** PROOF-03 — read and cite, never modify. The existing planted-violation test cases already mechanically check the exact regression `37-06`'s scratch-copy bypass demonstrated by hand.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| A hermetic synthetic fixture pair for the comparator's own test (if the planner wants a synthetic mini-`.prg` + fabricated `DumpListingMap`, distinct from the real corpus) | test fixture | — | No prior module joins a `DumpListingMap` (dxa's own output shape) against a `ByteDerivedPartition` in one hermetic test; `dxa-partition.test.ts`'s Task-1/Task-2 fixtures (`fixture.rep`/`fixture.prg`/`basic-stub.prg`) are close in *spirit* but test each tier standalone, never the join — the planner should compose a small new fixture pair (or synthesize a `DumpListingMap` object literal directly in the test file) rather than search further for an analog that doesn't exist. |

---

## Metadata

**Analog search scope:** `src/mcp/vice/dxa-*.ts`, `src/mcp/vice/ghidra-run.ts`, `src/mcp/vice/anno-bank.ts`, `.planning/phases/33-*/evidence/`, `.planning/phases/35-*/evidence/`, `.planning/phases/36-*/evidence/`, `.planning/phases/37-*/evidence/`, `.planning/phases/23-*/23-08-PLAN.md`
**Files scanned:** 9 read in full or substantial excerpt, all confirmed git-tracked via `git ls-files`
**Pattern extraction date:** 2026-09-05
