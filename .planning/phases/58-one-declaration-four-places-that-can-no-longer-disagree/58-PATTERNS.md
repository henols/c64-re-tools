# Phase 58: One Declaration, Four Places That Can No Longer Disagree - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 6 (2 new source files, 1 new doc, 3 modified files) — plus 1 read-only prose edit
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/mcp/vice/prerequisites.json` | config (committed data file) | CRUD (static read) | `src/mcp/vice/anno-regbits.json` | exact |
| `src/mcp/vice/prerequisites.test.ts` | test (structural/architectural guard) | transform (validate-in-memory) | `src/mcp/vice/anno-regbits.test.ts` (+ planted-violation idiom from `src/mcp/vice/anno-cli.test.ts:1286-1311`) | exact |
| `scripts/check-npm-packages.mjs` (new assertion block) | build/packaging tooling | batch (tarball-list assertion) | itself — `scripts/check-npm-packages.mjs:180-184` (THIRD-PARTY-NOTICES.md assertion) | exact (self-analog, same file) |
| `.github/workflows/ci.yml` (new job/step) | CI/config | batch (one-shot proof step) | itself — the four existing `actions/setup-node@v4` blocks (lines 31-34, 235-237, 276-279, 341-344) | exact (self-analog, same file) |
| `docs/phase58-declaration-provenance.md` | docs | transform (decision record) | `docs/stock-hard-losses.md` (structure/tone) and `docs/phase40-preprocessing-tools-decisions.md` (frontmatter + "statements reversed" shape) | exact |
| `README.md:113-119` (prose rewrite, read-modify only) | docs | transform | itself — `README.md:90-119` (the surrounding install-table section) | exact (self-analog, same file) |

No component/controller/service/middleware/route/hook/provider/store files are touched — this phase is entirely data, test, docs, and CI/build tooling, per RESEARCH.md's Architectural Responsibility Map ("Phase 58 touches no runtime tier at all").

## Pattern Assignments

### `src/mcp/vice/prerequisites.json` (config, CRUD/static)

**Analog:** `src/mcp/vice/anno-regbits.json` (and structurally `src/mcp/vice/tools-manifest.stock.json`, both listed in `files[]` at `src/mcp/vice/package.json:67,97`)

**Shape pattern** (`anno-regbits.json:1-6`):
```json
{
  "_generated": {
    "generator": "anno-regbits-gen.ts",
    "memmapSha256": "60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe",
    "warning": "GENERATED FILE -- do not hand-edit. Regenerate via `node anno-regbits-gen.ts` from src/mcp/vice."
  },
  "$0001": { "label": "...", "fields": [ ... ] }
}
```
**Do NOT copy the `_generated` banner convention verbatim** — RESEARCH.md's "Generated but committed" anti-pattern note is explicit that `prerequisites.json` is **hand-authored, not generated** (nothing in Phase 58 touches `build.ts` or a generator script). A `_generated`/`_meta` banner claiming a generator would misrepresent authorship. If a top-level metadata key is wanted (see RESEARCH.md Open Question 1, `schemaVersion`), keep it minimal and honest, e.g. `{"schemaVersion": 1}` — no `generator` field, no digest pin (there is no source-of-truth file to digest against).

**Record shape to encode** (per CONTEXT.md D-06/D-07/D-08/D-09, and RESEARCH.md's illustrative schema sketch — this sketch is NOT copied from any existing file, it is new):
```typescript
type Provenance = "measured" | "carried" | "authored";

interface RemedyEntry {
  text: string;        // D-09: prose containing a command, never structured argv
  provenance: Provenance;
  source: string;       // file:line, CI step name, or upstream doc URL
}

interface ToolRecord {
  id: string;
  unblocks: { skills: string[]; mcp: string[] };
  versionFloor?: string;  // ONLY the "node" record may carry this (DECL-04)
  remedies: Record<string, Record<string, RemedyEntry>>; // platform -> ecosystem -> entry (D-06)
}
```

**Nine tool ids to author** (D-08's two closed vocabularies, both directly enumerable from the tree this session):
- `unblocks.skills` values must be drawn from the nine real directory names under `src/skills/`: `acme-build`, `c64-disk-access`, `c64-memory-mapping`, `c64-petcat`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`, `routine-queue-walker`, `vice-wedge-triage`.
- `unblocks.mcp` values must be drawn from `HostToolId` (`src/mcp/vice/host-tool.mts:167-179`, `HOST_TOOL_IDS` at `host-tool.mts:181-193`): `acme.build`, `dxa.disassemble`, `ghidra.analyze`, `ghidra.installExtension`, `c1541.bam`, `c1541.dir`, `c1541.entry`, `c1541.chain`, `c1541.read`, `petcat.decode` (plus `x64sc`'s own connect path, which is not a `host_tool` op — record it however the schema handles a non-`host_tool` capability; D-08 explicitly excludes individual `vice_*`/`anno_*` tool names from this vocabulary).
- Per D-07, `acme` (binary) and `acme-lib` (library) are separate records; per RESEARCH.md Open Question 2, `dxa`'s record should use a single non-platform-keyed remedy (e.g. `remedies.universal`) rather than repeating `bash vendor/dxa/build.bash build` under `linux`/`darwin`/`win32`.

**Remedy sources to carry verbatim (D-03 `carried`, cite `file:line`)**:
- VICE per-ecosystem remedies: `README.md:99-107` (the 8-row install table) — e.g. `"sudo apt install vice (enable the contrib component first — VICE ships there, not main; a stock debian:trixie installation has no vice candidate until it is)"` for `debian-trixie`.
- ACME library remedy: `export ACME=<dir holding cbm/c64/vic.a>` (`src/skills/acme-build/SKILL.md:255` — "for <...> includes, set $ACME to …" troubleshooting row); the four probe prefixes themselves are NOT remedy text, they are `findAcmeLib()`'s own candidate list (`host-tool.mts:2231-2246`) and belong in `docs/phase58-declaration-provenance.md`, not duplicated as a fifth remedy string.
- dxa remedy: `bash vendor/dxa/build.bash build` (`host-tool.mts:1472`, quoted verbatim in the refusal message: `"host_tool \"dxa.disassemble\" refuses: the vendored dxa binary does not exist (tried: ${dxaFound.tried.join(", ")}) -- run \"bash vendor/dxa/build.bash build\" to produce it"`).
- c1541/petcat remedy: per RESEARCH.md Pitfall 2, `findSiblingBinary()`'s refusal (`host-tool.mts:1555-1559`) carries **no remedy text at all** — reuse the VICE table's own text (`README.md:99-107`) tagged `carried` from that citation, with the reuse rationale written into the provenance doc (this is Pitfall 2's required worked case).
- ACME "measured" remedy: `sudo apt install acme` (`.github/workflows/ci.yml:65-81`) — tag `measured`, scoped ONLY to the ecosystem key CI's runner actually is (RESEARCH.md Pitfall 4: record the precise `ubuntu-latest`-resolved OS version at authoring time in the provenance doc, do not tag every Debian/Ubuntu-family row `measured` by association).
- Node floor: `installer/package.json:16` (`"node": ">=18"`) is the ONLY record permitted a `versionFloor` field (DECL-04).

**No-execute shape guard (D-09):** every `remedies.*.*.text` must be a plain string. No record anywhere may have an `argv`, `cmd`, or `args` key.

---

### `src/mcp/vice/prerequisites.test.ts` (test, structural)

**Analog:** `src/mcp/vice/anno-regbits.test.ts` (file-reading idiom) + `src/mcp/vice/anno-cli.test.ts:1286-1311` (planted-violation idiom)

**Imports pattern** (`anno-regbits.test.ts:1-20`):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
```

**Reader pattern** (`anno-regbits.test.ts:47-49`):
```typescript
function readCommittedDoc(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(HERE, "anno-regbits.json"), "utf8")) as Record<string, unknown>;
}
```
For `prerequisites.test.ts` this becomes `readPrerequisites()` reading `join(HERE, "prerequisites.json")` — same-directory read, no relative-hop risk (unlike the `skill-corpus.mjs` import discussed below).

**Closed-vocabulary pattern (DECL-01)** — mirrors `anno-regbits.test.ts:127-145`'s "every field name matches a rule" style, applied to `unblocks.skills`/`unblocks.mcp` against the two enumerable sets:
```typescript
// every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$  (anno-regbits.test.ts:127)
test("every unblocks.skills value is a real src/skills/<name>/ directory", () => {
  const doc = readPrerequisites();
  const realSkillDirs = new Set(readdirSync(join(HERE, "..", "..", "skills"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name));
  for (const [id, record] of Object.entries(doc)) {
    for (const skill of (record as ToolRecord).unblocks?.skills ?? []) {
      assert.ok(realSkillDirs.has(skill), `${id}: unblocks.skills names "${skill}", not a real src/skills/ directory`);
    }
  }
});
```
RESEARCH.md's Pattern 2 flags a documented recurring mistake in this repo: getting the relative-hop count wrong from `src/mcp/vice/` to `src/skills/` (fixed at 2 hops via `join(HERE, "..", "..", "skills")` for `src/mcp/vice/prerequisites.test.ts` — verify this against `anno-regbits.test.ts:96` which reaches `src/skills/c64-memory-mapping/memmap.json` via `join(HERE, "..", "..", "..", "src", "skills", ...)` from a DIFFERENT starting depth (its own comment: "3 levels deep... skills moved from `.claude/skills/` to `src/skills/`, changing the hop count from 2 to 3" — that 3-hop count is `anno-regbits-gen.ts`'s OWN internal formula, not this test file's `HERE`-relative depth to the repo root, so recompute independently rather than copying the digit). Alternative, avoiding hop-count risk entirely: import `topLevelSkillDirs` from `scripts/lib/skill-corpus.mjs` — but note that import already required an explicit hop-count fix once (Pattern 2's own caveat), so a direct `readdirSync` against `src/skills/` with a manually verified relative path is equally acceptable and lower-risk here.

**Non-vacuous planted-violation pattern (DECL-04)** — mirrors `anno-cli.test.ts:1286-1311`'s wrapped/bare planted-violation shape, applied via `structuredClone` per RESEARCH.md Pattern 3 (no fixture-file mutation, matches `anno-regbits.test.ts:72-121`'s own "mutate a SCRATCH COPY, never the real file" discipline):
```typescript
// structural (WR-09): the guard's planted violation is reported and its
// wrapped control is not (non-vacuity)  -- anno-cli.test.ts:1286
test("structural: the guard's planted violation is reported and its wrapped control is not (non-vacuity)", () => {
  const clean = readPrerequisites();
  assertNoStrayVersionFloor(clean); // passes on the real, committed file

  const poisoned = structuredClone(clean);
  (poisoned as any).acme.versionFloor = "0.97"; // planted, never committed
  assert.throws(() => assertNoStrayVersionFloor(poisoned));
});
```

**D-09 no-execute shape assertion** — new pattern (not copied, since no existing file asserts "never an argv shape"), structured like the identifier-legality sweep at `anno-regbits.test.ts:127-145`:
```typescript
test("every remedy text is a plain string; no record carries an argv/cmd/args field", () => {
  const doc = readPrerequisites();
  const serialized = JSON.stringify(doc);
  assert.doesNotMatch(serialized, /"argv"|"cmd"|"args"\s*:/);
  // plus a positive walk asserting every remedies.*.*.text is typeof "string"
});
```

---

### `scripts/check-npm-packages.mjs` (build/packaging tooling, modified)

**Analog:** itself — the existing D-07/criterion-5 notices-file assertion, same file

**Core pattern to copy** (`scripts/check-npm-packages.mjs:180-184`):
```javascript
// --- D-07 / criterion 5: the notices file must actually ship ---------------
need(
  vice.files.includes("THIRD-PARTY-NOTICES.md"),
  "vice-mcp: missing THIRD-PARTY-NOTICES.md -- criterion 5 requires the opcode table's zlib provenance to ship with the package (D-07)"
);
```
**New DECL-05 assertion, same shape, placed in the same `vice` block** (D-13 exact wording from RESEARCH.md's Code Examples section):
```javascript
need(
  vice.files.includes("prerequisites.json"),
  "vice-mcp: missing prerequisites.json -- DECL-05 requires the same remedies to reach an npm-installed user"
);
```
This reads `vice.files` (the packed tarball's own file list from `packFiles()`, `check-npm-packages.mjs:134-146`), never `existsSync` against a repo path — the file's own header (`check-npm-packages.mjs:8-11`) states exactly why: "A repo-root filesystem check would pass even when the published package silently omits the file; that is exactly the CR-07-shaped failure." Place the new assertion near line 184, inside the `if (IS_ENTRY_POINT)` block, alongside the other `vice.files.includes(...)` checks (`vice-proxy.ts`, `tools-manifest.stock.json`, `container-guard.mts` at lines 164-167).

**Also required:** add `"prerequisites.json"` to `src/mcp/vice/package.json`'s `files[]` array (analog: the existing entries `"anno-regbits.json"` at line 67 and `"tools-manifest.stock.json"` at line 97 — plain string entries in the array, no directory glob needed since it is a single file).

---

### `.github/workflows/ci.yml` (CI/config, modified)

**Analog:** itself — the four existing `actions/setup-node@v4` blocks in the same file

**Core pattern to copy** (`.github/workflows/ci.yml:31-34`, one of four identical instances at lines 235-237, 276-279, 341-344):
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "24"
    cache: npm
    cache-dependency-path: src/mcp/vice/package-lock.json
```
**New Node-18 proof, D-14/D-15's mirrored form** (from RESEARCH.md's Code Examples, adapted — no existing job in this file is pinned below "24", so this is the first such cell):
```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: "18"
- name: Prove prerequisites.json parses on the installer's own Node floor (DECL-02)
  run: node -e "JSON.parse(require('fs').readFileSync('src/mcp/vice/prerequisites.json','utf8')); console.log('OK')"
```
Since every existing job in this file (`build`, `release`, `publish-npm`, `release-on-merge`) is pinned to Node 24 with no matrix, the cleanest fit — least disruptive to the existing `build` job's own dependency chain — is a **new standalone job** (e.g. `decl-02-node18-proof`) with its own `runs-on: ubuntu-latest`, its own `actions/checkout@v4`, and the two steps above; it needs no `npm ci` (mirrors the installer test job's own comment at `ci.yml:190-191`: "No `npm ci` step is needed here" when the code under test has no dependency to install). This keeps the low-Node cell isolated from the `build` job's Node-24 toolchain rather than trying to retrofit a matrix onto an existing job that also runs typecheck and the full test suite at Node 24. D-15 is satisfied because `actions/setup-node@v4` provisions a language runtime, not an external prerequisite via a package manager — the same distinction the ACME step at `ci.yml:45-81` draws for itself.

**Retry/error-handling pattern NOT needed here** — the `retry_apt`/`timeout-minutes` wrapper at `ci.yml:62-81` exists specifically because that step calls an actual package manager against a possibly-unresponsive mirror; `actions/setup-node@v4` and a bare `node -e` string need neither.

---

### `docs/phase58-declaration-provenance.md` (docs, new)

**Analog:** `docs/stock-hard-losses.md` (tone/structure) + `docs/phase40-preprocessing-tools-decisions.md` (frontmatter + "statements reversed" shape)

**Structural pattern from `docs/stock-hard-losses.md:1-16`** (no frontmatter, plain prose header explaining WHY the doc exists, then one `##` section per case):
```markdown
# Stock VICE hard losses

As of 2026-09-12, ... Three capabilities ... have no route on stock at all,
and each is a hardware-level fact rather than an implementation gap — they
are recorded here as **permanent accepted losses**, not hedged ones ...
```

**Frontmatter + reversed-statement pattern from `docs/phase40-preprocessing-tools-decisions.md:1-23`** (use if the provenance doc needs to name statements it corrects, e.g. D-11's README rewrite):
```yaml
---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
decision: prerequisite-declaration-provenance
date: 2026-09-17
decision_ids: [D-03, D-04, D-05]
related_decisions: [D-01, D-02, D-06, D-07, D-08, D-09, D-10, D-11]
---
```
Required content, per CONTEXT.md D-04/D-05 and RESEARCH.md Pitfall 2:
1. **The D-05 worked example** — `README.md:96-97` (VICE-3.10-gate-as-load-bearing) vs. `.planning/REQUIREMENTS.md:88` ("No shipped tool refuses on one. `vice_cpu_history` runs over the text channel (`chis`)") — REQUIREMENTS.md wins, state why.
2. **The c1541/petcat reuse case** (Pitfall 2) — record explicitly that their remedy is the VICE table's own text, reused, tagged `carried` from `README.md:99-107`, because `apt install vice` installs all three binaries together — never freshly authored prose.
3. **The `measured` scope note** (Pitfall 4) — the exact CI runner OS/version `ubuntu-latest` resolved to at authoring time, and that only that one ecosystem key is tagged `measured` for ACME, not every Debian/Ubuntu-family row.
4. Whichever of RESEARCH.md's three Open Questions (`schemaVersion`, dxa's remedy shape, DECL-04 test cadence) the planner resolves — record the choice and reasoning here, the same way CONTEXT.md itself models "Claude's Discretion" choices with inline reasoning.

---

### `README.md:113-119` (docs, prose rewrite only)

**Analog:** itself — the surrounding install-table section (`README.md:90-119`)

**Current false prose to replace** (`README.md:113-119`, header only — read the section before editing):
```markdown
### What a sub-3.10 VICE costs

Nothing breaks. `CPUHISTORY_GET` (the exact per-instruction cycle counter) is
...
```
Per D-10/D-11: the corrected prose must state that the declaration and this project's shipped tools carry **no VICE version dependency at all** — no floor, no dated observation — and that `vice_cpu_history` runs over the text channel (`chis`) regardless of version, citing `.planning/REQUIREMENTS.md:88` as the measured evidence (the same fact the provenance doc's D-05 worked example documents). Do **not** touch `README.md:99-107` (the 8-row table itself) — that is Phase 62's generated section, out of scope here (D-11's explicit split).

---

## Shared Patterns

### Assert relations, not counts
**Source:** `scripts/check-npm-packages.mjs:29-45` (the header's own incident record: pinning a skill count to six turned CI red on a correct tree) and its live application at lines 379-390 (`srcSkillDirs.length >= 6` floor before the equality).
**Apply to:** `prerequisites.test.ts`'s DECL-01 closed-vocabulary checks — assert every `unblocks.skills`/`unblocks.mcp` value is a member of the real enumerated set (a relation), never assert the declaration has exactly N tool records (a count that will grow, e.g. if dxa or acme-lib's shape changes, or a tenth tool is added later).

### Non-vacuous planted-violation guard
**Source:** `src/mcp/vice/anno-cli.test.ts:1286-1311` (wrapped/bare control pair) and `src/mcp/vice/anno-regbits.test.ts:72-121` (scratch-copy mutation, never the committed file).
**Apply to:** `prerequisites.test.ts`'s DECL-04 test — `structuredClone` the real document, inject `versionFloor` onto a non-`node` record, assert the shared validator throws. Never mutate `prerequisites.json` on disk.

### Tarball-list assertion, never filesystem existence
**Source:** `scripts/check-npm-packages.mjs:1-58` header (states the CR-07 failure shape by name) and its `vice.files.includes(...)` idiom at lines 164-167, 181-184.
**Apply to:** The new DECL-05 assertion — read `packFiles(join(ROOT, "src/mcp/vice")).files`, never `existsSync(join(ROOT, "src/mcp/vice/prerequisites.json"))`.

### Detect-then-refuse-by-name-with-remedy (why this file matters downstream)
**Source:** `src/mcp/vice/host-tool.mts:1555-1559` (c1541 refusal), `:1472` (dxa refusal), `:2231-2246` (`findAcmeLib()`), `src/mcp/vice/backend-detect.mts:304-345` (`resolvedBackend()`).
**Apply to:** Nothing in Phase 58 wires these — this pattern is documented here only so the planner understands WHY every remedy string in `prerequisites.json` must stay copy-pasteable verbatim into a refusal sentence: Phase 60 will read this file to build exactly the messages these four functions currently hard-code inline. A remedy string authored with different wording than the source it's `carried` from breaks that future substitution silently.

### Generated-but-committed does NOT apply here
**Source:** `src/mcp/vice/build.ts`'s `HOST_BOUND_ARTIFACTS` array and `resources-sync.test.ts`'s byte-identical drift guard; contrast with `anno-regbits.json`'s own `_generated` banner (produced by `anno-regbits-gen.ts`).
**Apply to:** Explicitly do NOT give `prerequisites.json` a `_generated`/banner/digest-pin field claiming a generator — it is hand-authored. Do NOT add it to `build.ts`'s `HOST_BOUND_ARTIFACTS`. Do NOT add a byte-identical drift-guard test for it (that guard class exists for files with an actual generator to drift against; `prerequisites.json` has none).

## No Analog Found

None — every file this phase touches has a strong same-role, same-data-flow analog already in the tree (see table above). RESEARCH.md's own "Standard Stack" section independently confirms this: "No new dependency of any kind."

## Metadata

**Analog search scope:** `src/mcp/vice/*.json`, `src/mcp/vice/*.test.ts`, `scripts/*.mjs`, `scripts/lib/*.mjs`, `.github/workflows/ci.yml`, `docs/*.md`, `README.md`, `src/skills/acme-build/SKILL.md`, `src/mcp/vice/package.json`, `installer/package.json`.
**Files scanned:** 15 (all confirmed git-tracked via `git ls-files`, none are `.gsd`-mirrored or otherwise gitignored install artifacts).
**Pattern extraction date:** 2026-09-17
