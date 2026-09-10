# Phase 44: PROOF-04 — The Independent External Check - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 7 new + 6 read-only shipped dependencies
**Analogs found:** 7 / 7

All analog paths below were verified with `git ls-files -- <path>` (non-empty
output = tracked). None is a gitignored capability mirror.

## Convention determined first (governs file placement for every new file)

**Where does an evidence driver script physically live?** Under the phase
directory's own `evidence/` subdirectory, never under `src/mcp/vice/`. Confirmed
from three prior phases, each git-tracked:
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.mjs`
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs`
- `.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs`

So Phase 44's new files land at
`.planning/phases/44-proof-04-the-independent-external-check/evidence/*`, exactly
as RESEARCH.md's "Recommended Project Structure" already states. Nothing under
`src/mcp/vice/` should be created for this phase — every shipped module it needs
already exists there and is read-only for this phase.

**Second convention: NUL-byte file invisible to plain `grep`.**
`src/mcp/vice/anno-memmap-render.ts` contains a NUL byte and a plain-text `grep`
census over `src/mcp/vice/` silently skips it. Any structural/import-purity
census this phase's plan writes over that tree (e.g. verifying nothing in
`src/mcp/vice/` was modified, or scanning for banned imports) must use `grep -a`.
Not directly exercised by the new evidence scripts (which live outside
`src/mcp/vice/`), but load-bearing if a plan task greps that tree for any reason
(e.g. "confirm no shipped module changed").

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `evidence/README.md` | config/doc | N/A (process discipline) | `.planning/phases/38-.../evidence/README.md` | exact |
| `evidence/SCHEMA.md` | config/doc | N/A | `.planning/phases/38-.../evidence/SCHEMA.md` | exact |
| `evidence/proof04-subject-dxa.mjs` | utility (evidence driver) | file-I/O, offline batch | `.planning/phases/38-.../evidence/proof01-dxa-real-release.mjs` | exact |
| `evidence/proof04-subject-dxa.json` | data artifact | file-I/O (written output) | (no code analog needed — output of the script above) | n/a |
| `evidence/proof04-oracle-memmap.mjs` | utility (evidence driver) | streaming/event-driven (live monitor sockets) | `.planning/phases/43-.../evidence/evid06-instrumentation-ab.mjs` | exact |
| `evidence/proof04-oracle-memmap.json` | data artifact | file-I/O (written output) | n/a | n/a |
| `evidence/proof04-reconcile.mjs` | utility (join driver) | transform (pure join over two JSON files) | `src/mcp/vice/anno-cli.ts`'s `cmdEvidDisagreements()` (as a call-shape analog, not a file to copy wholesale) | role-match |
| `evidence/proof04-independence.test.ts` | test (structural/import-purity) | transform (grep own module source) | `src/mcp/vice/textmon-memmap.test.ts`'s purity test (lines 37-39) | exact |
| `evidence/proof04-false-positives.md` | config/doc (findings record) | N/A | `.planning/phases/38-.../evidence/proof01-dxa-real-release.md`, `docs/phase43-instrumentation-perturbation-ab.md` | exact |

### Read-only shipped dependencies (do not modify; call as-is)

| Module | Exported signature this phase's drivers must call | Convention a caller must follow |
|---|---|---|
| `src/mcp/vice/evid-reconcile.ts` | `reconcileObservedExecution(input: EvidReconcileInput): EvidReconciliation` where `EvidReconcileInput = { blocks: readonly BlockEntry[]; observations: readonly EvidExecRow[]; classifier?: BlockClassifier }` (lines 88-92, 217) | Pure — never fetches, never mutates `blocks`/`observations`. `disagreements` is returned FIRST. `blockCoveredNeverObservedCount` must never be reported as "confirmed data" (Pitfall 3). |
| `src/mcp/vice/evid-ingest.ts` | `execObservationsFrom(map: AccessMap): ExecObservation[]` (line 159); `runIdentityFrom(identity: IngestRunIdentity): RunIdentity` (line 125); `ingestAccessMap(parsed, identity)` (line 206) | Row written iff `execute` flag true; absence of a row is never converted to "data". Caller supplies raw `argv`, never a pre-computed digest (see Known Threat Patterns). |
| `src/mcp/vice/textmon-memmap.ts` | `parseAccessMap(text): AccessMapParseResult` | PURE, zero imports (mechanically enforced by its own test). Never re-parse `memmapshow` text by hand. |
| `src/mcp/vice/block-class.ts` | `blockClassAt: BlockClassifier` = `(blocks: readonly BlockEntry[], address: number) => BlockClass \| null`; `BlockEntry = { start_address: number; end_address: number; type: string }` (lines 113-129, 157-185) | `type` accepts a bare `"code"`/`"undefined"`/anything-else(→`"data"`) literal — no store required. This is how `proof04-subject-dxa.mjs` builds `BlockEntry[]` in memory (RESEARCH.md Pattern 2). |
| `src/mcp/vice/dxa-partition.ts` | `partitionByteDerived(input: ByteDerivedInput): ByteDerivedPartition` (line 494), `ByteDerivedInput = { bytes: Uint8Array; isPrg: boolean; origin?: number }` | `certainCode` is ALWAYS empty by design (A-09) — never treat it as populated. |
| `src/mcp/vice/dxa-run.ts` | `runDxaDisassemble(args: DxaRunArgs, opts?: DxaRunOptions): Promise<DxaRunResult>`, `DxaRunArgs = { image, imageKind: "prg"\|"flat64k", entrypointsPath?, datablocksPath?, labelsPath?, outDir?, knownDataRows? }` (lines 54-98) | Reaches dxa ONLY through the Phase 34 host-tool seam — never a direct `spawnSync`. `imageBytes`/`listingText` test seams exist on `DxaRunOptions` for hermetic use if ever needed, but the live driver should use the real filesystem/host-tool path as Phase 38's driver did. |
| `src/mcp/vice/anno-types.ts` | `interface EvidExecRow { id, imageSha256, argvDigest, seed, address, sourceBank }` (line 635) | This is the shape `execObservationsFrom()`/`ingestAccessMap()` produce/consume — do not hand-roll a different observation row shape. |
| `.planning/phases/39-.../evidence/probe-harness.mjs` | `buildProbeArgs()`, `spawnVice()`, `connectWithRetry()`, `pingReady()`, `armStoppingExec()`, `resumeExecution()`, `reapAll()`, `allocPorts()`, `preflight()`, `ViceMonitorClient`, `VICE_STOCK`, `sleep`, `log` | Import via dynamic `await import(path.join(PHASE39_EVIDENCE, "probe-harness.mjs"))` exactly as `evid06-instrumentation-ab.mjs` does (lines 121-138) — never re-author flag-order or spawn logic. |
| `src/mcp/vice/anno-cli.ts` | `cmdEvidDisagreements()` (line ~1527) | The already-shipped no-code-needed CLI route (`npx @henols/vice-mcp anno evid-disagreements --store FILE --json`) — cite as an alternative if the plan chooses the store-backed route over Pattern 2's in-memory route (Open Question 1). |

## Pattern Assignments

### `evidence/proof04-subject-dxa.mjs` (utility, offline batch — SUBJECT producer)

**Analog:** `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.mjs` (git-tracked, verified)

**Header/purity-statement pattern** (lines 1-33): states explicitly which
shipped seams are driven and why no private copy exists — same convention
`proof04-subject-dxa.mjs` should open with, updated to name the reduced import
set (`dxa-run.ts`'s `runDxaDisassemble`, `dxa-partition.ts`'s
`partitionByteDerived` if a byte-derived cross-check is wanted, and NOTHING from
`text-protocol.ts`/`textmon-memmap.ts`/`evid-ingest.ts`/probe-harness — this is
the independence boundary Criterion 2 needs).

**Dynamic-import-by-path pattern** (lines 40-52):
```javascript
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const { listEntries, extractEntry } = await import(path.join(MCP_DIR, "anno-d64.ts"));
const { runDxaDisassemble } = await import(path.join(MCP_DIR, "dxa-run.ts"));
const { partitionByteDerived } = await import(path.join(MCP_DIR, "dxa-partition.ts"));
```
Copy this exact shape (`import.meta.dirname`-relative `REPO_ROOT`, dynamic
`await import(path.join(...))` rather than a static relative import) — it is
how a `.planning/phases/**/evidence/*.mjs` script reaches a `src/mcp/vice/*.ts`
module without a build step.

**Corpus-identity-before-anything-else pattern** (lines 55-105, `resolveCorpusPath()`
and Step 1/Step 2 of `main()`): resolve `$C64_CORPUS_DIR` else the Phase 23
repo-relative corpus path, sha256-assert BOTH the whole `.d64` and the extracted
entry before doing anything else, fail loudly naming both attempted paths. Reuse
verbatim — same corpus (`danish.d64`), same entry (`BRUCE LEE   (DC)`), same two
expected sha256 constants already measured (`RELEASE_SHA256_EXPECTED`,
`ENTRY_SHA256_EXPECTED` at lines 61-62).

**Scratch workspace pattern** (lines 108-113, 138-146): `mkdtempSync` under
`PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase38")`
(adapt to `phase44`), never inside the checkout, never `/tmp` (tmpfs, emptied
only on reboot — CLAUDE.md/MEMORY.md both note this), torn down in `finally`.

**Output-artifact pattern:** write `BlockEntry[]` (per RESEARCH.md Pattern 2:
`{ start_address, end_address, type: "code"|"data" }` built directly from
`runDxaDisassemble()`'s listing / `partitionByteDerived()`'s output) to
`proof04-subject-dxa.json`, print its own sha256 to the transcript (Phase 38's
`sha256Hex()` helper, lines 69-71).

**Forbidden imports (Criterion 2):** must NOT import/require
`text-protocol.ts`, `textmon-memmap.ts`, `evid-ingest.ts`, or
`probe-harness.mjs` — these name the oracle's exclusive domain.

---

### `evidence/proof04-oracle-memmap.mjs` (utility, streaming/event-driven — ORACLE producer)

**Analog:** `.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs` (git-tracked, verified)

**Header/pass-fail-rule-fixed-before-measurement pattern** (lines 1-40): states
the fixed inputs (genuine `/usr/bin/x64sc`, `danish.d64` at its known sha256,
`buildProbeArgs()`'s `STOCK_DETERMINISM_FLAGS` unmodified) and the exact
protocol sequence (S3: connect → arm STOPPING Exec checkpoint at `$ea31` while
halted → `memmapzap` over text channel → `AUTOSTART runAfter:true fileIndex:0`
→ count `CHECKPOINT_INFO` hits to N ≤ 50, one resume per hit → `memmapshow`
before any RESET/DUMP). Copy this discipline: state the rule BEFORE the run.

**Dynamic-import-of-probe-harness pattern** (lines 108-121):
```javascript
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const PHASE39_EVIDENCE = path.join(REPO_ROOT, ".planning", "phases",
  "39-the-dual-channel-coexistence-gate-go-degrade-no-go", "evidence");
const harness = await import(path.join(PHASE39_EVIDENCE, "probe-harness.mjs"));
const textProto = await import(path.join(MCP_DIR, "text-protocol.ts"));
const memmap = await import(path.join(MCP_DIR, "textmon-memmap.ts"));
```
Copy exactly — this is the established way an evidence script in one phase's
`evidence/` directory reuses another phase's harness script (Phase 39's), never
by copying `probe-harness.mjs` itself.

**Destructured seam list** (lines 123-138): `preflight, allocPorts,
buildProbeArgs, spawnVice, connectWithRetry, pingReady, armStoppingExec,
resumeExecution, reapAll, ViceMonitorClient, VICE_STOCK, sleep, log` from
`harness`; `TextMonitorClient, withTextChannelLock` from `textProto`;
`parseAccessMap` from `memmap`. Same destructure list applies to
`proof04-oracle-memmap.mjs`, minus whatever A/B-pairing-only helpers EVID-06
needed that a single-run oracle capture does not (e.g. no
`normalisePorts()`/`vsf-slice.mjs` pairing needed unless a capture-pair
comparison is also wanted).

**Fixed-inputs constants block** (lines 140-155): `RELEASE` path built the same
way, `RELEASE_SHA256_EXPECTED`, `FRAME_ANCHOR = 0xea31`, `MEMSPACE_MAIN = 0x00`.
Reuse identically — same corpus, same anchor.

**Output-artifact pattern:** after `memmapshow`, run `parseAccessMap()` then
(if reusing `evid-ingest.ts`) `execObservationsFrom()`/`runIdentityFrom()` to
produce `EvidExecRow[]`-shaped rows, write to `proof04-oracle-memmap.json`,
print its sha256.

**Forbidden imports (Criterion 2):** must NOT import/require `dxa-partition.ts`,
`dxa-run.ts`, `block-class.ts`, or any annotation-store module (`anno-store.ts`,
`anno-tools.ts`) — these name the subject's exclusive domain.

---

### `evidence/proof04-reconcile.mjs` (utility, transform — JOIN)

**Analog (call shape):** `src/mcp/vice/anno-cli.ts`'s `cmdEvidDisagreements()`
(around line 1527) — not copied wholesale (it opens a store; this script reads
two JSON files instead), but its call shape is the one to mirror:

```typescript
// Source: src/mcp/vice/anno-cli.ts, cmdEvidDisagreements() body
// (VERIFIED, read this session): fetches both sides itself, maps to
// BlockEntry via the one seam, then calls the SAME pure join
// anno_evid_disagreements calls — reconcileObservedExecution().
```

**Core pattern:** read `proof04-subject-dxa.json` (→ `BlockEntry[]`) and
`proof04-oracle-memmap.json` (→ `EvidExecRow[]`) by path, dynamic-`import()`
`evid-reconcile.ts`'s `reconcileObservedExecution` exactly as `evid06`/Phase 38
scripts dynamic-import their seams, call it once, print
`disagreements`/`disagreementCount`/`agreementCount`/
`blockCoveredNeverObservedCount`/`observedOutsideAnyBlockCount`/
`observedAtUndefinedBlockCount`/`denominator` to the transcript — never
re-derive any of the four buckets by hand (`evid-reconcile.ts`'s own header,
"NEVER fetch either side here", lines 47-52, and the Don't-Hand-Roll table row
in RESEARCH.md).

**Error handling pattern:** none of the read-only shipped modules throw on
malformed input in the parse path (`parseAccessMap` returns a discriminated
result instead) — but at the file-read boundary in this script, follow Phase
38's pattern: assert artifact sha256 (if recorded) before use, fail loudly
naming the attempted path.

---

### `evidence/proof04-independence.test.ts` (test, structural/transform)

**Analog:** `src/mcp/vice/textmon-memmap.test.ts` (lines 30-39, git-tracked, verified)

**Purity-test pattern** (lines 37-39):
```typescript
test("purity (PARSE-03): textmon-memmap.ts contains no top-level ES import statement", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
  assert.deepEqual(importLines, [], `expected zero import lines, found: ${JSON.stringify(importLines)}`);
});
```

Adapt to Phase 44's two-producer shape exactly as RESEARCH.md's own Code
Examples section already shows (verified against real file conventions, not
just proposed):
```typescript
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("subject producer never imports the oracle's domain", () => {
  const src = readFileSync("evidence/proof04-subject-dxa.mjs", "utf8");
  for (const forbidden of ["text-protocol", "textmon-memmap", "evid-ingest", "probe-harness"]) {
    assert.equal(src.includes(forbidden), false, `subject producer imports ${forbidden}`);
  }
});

test("oracle producer never imports the subject's domain", () => {
  const src = readFileSync("evidence/proof04-oracle-memmap.mjs", "utf8");
  for (const forbidden of ["dxa-partition", "dxa-run", "block-class", "anno-store", "anno-tools"]) {
    assert.equal(src.includes(forbidden), false, `oracle producer imports ${forbidden}`);
  }
});
```
Use `readFileSync` with a path resolved relative to `import.meta.url`
(`fileURLToPath`), matching `textmon-memmap.test.ts`'s own `HERE`/`OWN_MODULE`
pattern (lines 26-27), rather than a bare relative string, so the test is
runnable from any cwd.

**Location convention:** colocated in the same `evidence/` directory as the
two producers it checks (not under `src/mcp/vice/`), matching this phase's own
placement convention (see top of this document) — this deviates slightly from
`textmon-memmap.test.ts`'s colocation-with-source-under-test convention only
because the sources under test here are themselves evidence-directory scripts,
not shipped `src/mcp/vice/` modules.

---

### `evidence/README.md`, `evidence/SCHEMA.md`, `evidence/proof04-false-positives.md` (docs)

**Analogs:** `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/README.md`
(numbered evidence conventions 1-5+: transcript convention, worktree-independent
`PROBE_DIR`, broker-stopped-and-recorded, no binaries committed — identity
travels as name+sha256) and `.planning/phases/38-.../evidence/SCHEMA.md` (every
outcome-line name/domain/source stated before any run). Also
`docs/phase43-instrumentation-perturbation-ab.md` and
`docs/phase41-text-channel-live-evidence.md` for the "quoted PASS/FAIL rule
fixed before measurement" prose shape used in `proof04-false-positives.md`.

**Findings-doc shape to copy:** the outcome-line naming convention
(`PROOF04_FALSE_POSITIVES = disagreementCount / denominator`, stated beside
`PROOF01_DATA_RECOVERY_PCT`, `FIXTURE_DATA_RECOVERY_PCT`,
`PIVOT_PUBLISHED_DATA_RECOVERY_PCT` per RESEARCH.md's system diagram, lines
149-154) and the `not-exercised`/`resolved`/`unresolved` derivation-rule shape
verbatim from `proof02-computed-dispatch.md:14-21` (quoted in RESEARCH.md Code
Examples).

## Shared Patterns

### Broker-inactive + PROBE_DIR discipline (applies to both `.mjs` drivers)
**Source:** `.planning/phases/38-.../evidence/README.md` conventions 2-3,
reused unchanged by every evidence plan since Phase 38/39.
```
PROBE_DIR = $HOME/.cache/c64-re-tools/phase44   # never inside checkout, never /tmp
Verify before run: systemctl --user is-active vice-broker  (expect inactive)
                    pgrep -x x64sc                          (expect no output)
Record BROKER_STATE: inactive alongside TEST_AUTOMATED_BASELINE: in the transcript.
```
**Apply to:** `proof04-oracle-memmap.mjs` (launches a live `x64sc`) primarily;
`proof04-subject-dxa.mjs` should still use a `PROBE_DIR` scratch dir for its
dxa host-tool invocation, per the same convention.

### Dynamic cross-directory import (`.mjs` reaching `src/mcp/vice/*.ts` or a sibling phase's `evidence/*.mjs`)
**Source:** both `proof01-dxa-real-release.mjs:40-52` and
`evid06-instrumentation-ab.mjs:108-121`.
```javascript
const REPO_ROOT = path.resolve(import.meta.dirname /* or dirname(fileURLToPath(import.meta.url)) */, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const { someExport } = await import(path.join(MCP_DIR, "some-module.ts"));
```
**Apply to:** both new `.mjs` producers and the reconcile script.

### Corpus/artifact identity-before-use (sha256-first)
**Source:** `proof01-dxa-real-release.mjs`'s `resolveCorpusPath()` +
`sha256Hex()` pattern (lines 60-105); reused by `evid06`'s own
`RELEASE_SHA256_EXPECTED` constant.
**Apply to:** every artifact this phase reads or writes (`danish.d64`, the
extracted `BRUCE LEE (DC)` entry, both JSON producer outputs).

## No Analog Found

None — every new file in RESEARCH.md's Wave 0 Gaps list has a verified,
git-tracked analog above.

## Metadata

**Analog search scope:** `.planning/phases/{38,39,43}-*/evidence/`,
`src/mcp/vice/{evid-reconcile,evid-ingest,textmon-memmap,textmon-memmap.test,
block-class,dxa-partition,dxa-run,anno-types,anno-cli}.ts`
**Files scanned:** ~14
**Pattern extraction date:** 2026-09-10
**Tracked-source gate:** every path cited above verified via `git ls-files --
<path>` returning non-empty (all tracked; none is a `.gsd/capabilities/` or
other gitignored mirror).
