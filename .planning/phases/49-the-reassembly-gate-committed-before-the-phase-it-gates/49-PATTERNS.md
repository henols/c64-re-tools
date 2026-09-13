# Phase 49: The Reassembly Gate, Committed Before the Phase It Gates - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 8 (from RESEARCH.md's Wave 0 Gaps)
**Analogs found:** 6 exact/strong / 8 total (2 have NO prior art in this codebase — flagged, not forced)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `.planning/phases/49-.../evidence/SCHEMA.md` | documentation-contract (evidence vocabulary) | transform (raw measurement → named outcome line) | `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/SCHEMA.md` | exact |
| `.planning/phases/49-.../evidence/DECISION-RULE.md` | documentation-contract (rule table) | transform (named inputs → verdict) | Phase 39 sibling of the same name | exact |
| `src/mcp/vice/acme-verify.ts` (extended) | pure-function module / test-only oracle | request-response (spawn ACME, byte-diff) | itself, `verifyAcmeAssembles()` (extend, don't fork) | exact (self-extension) |
| `src/mcp/vice/reassembly-gate.test.ts` (new) | test (gate + 3 planted RED controls) | event-driven (planted violation → assert red) | `src/mcp/vice/acme-verify.test.ts` (MANDATORY RED pattern) | exact |
| A movement/relocation mechanism (new, likely inside the gate test file or a small helper) | pure-function module | transform (store address mutation → re-export) | **no prior art** — nearest partial analog `anno-export-asm.ts`'s `exportAsmTree()` (consumed, not a movement analog) | none — new design |
| A hazard-finding acknowledgement mechanism (new) | pure-function module | CRUD-like (match triple → mark acknowledged) | **no prior art** — nearest analog is `HazardFinding`'s shape in `anno-hazard-report.ts:182-209` (read-only input, no id/ack field) | none — new design |
| `docs/phase49-the-reassembly-gate-findings.md` | evidence artifact (YAML-frontmatter verdict) | batch (aggregate named inputs → one verdict document) | `docs/phase39-dual-channel-coexistence-gate-findings.md` | exact |
| `src/mcp/vice/fixtures/reassembly-gate/make-reassembly-gate-fixtures.mjs` (possible) | fixture generator | file-I/O (deterministic regenerate, git-clean check) | `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` | exact |

## Pattern Assignments

### `src/mcp/vice/acme-verify.ts` (pure-function module / test-only oracle, request-response)

**Analog:** itself — this is an additive extension, not a new file with an external analog.

**The exact gap to close** (`acme-verify.ts:746-751`, read this session, confirmed no `cwd` key anywhere in the spawn options object):
```typescript
// Source: src/mcp/vice/acme-verify.ts:739-751 (existing signature and entry to extend)
export function verifyAcmeAssembles(options: AcmeVerifyOptions): AcmeVerifyResult {
  const format = options.format ?? "plain";
  const assemblerBin = options.acmeBin ?? ACME_BIN;
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-"));
  try {
    const srcPath = join(dir, "export.a");
    const outPath = join(dir, "export.bin");
    writeFileSync(srcPath, options.source, "utf8");
    // ... unchanged from here down for the single-file case
```

**Fresh-directory + absent-before-spawn discipline to REUSE unchanged** (`acme-verify.ts:744-753`, verbatim):
```typescript
  // A FRESH directory per invocation. This is what makes the verdict
  // reproducible and makes two concurrent invocations independent: no output
  // path is ever shared, so a second run cannot read a first run's bytes.
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-"));
  try {
    const srcPath = join(dir, "export.a");
    const outPath = join(dir, "export.bin");
    writeFileSync(srcPath, options.source, "utf8");

    // "Did THIS run create it" is the property, not "does a file exist".
    const absentBeforeSpawn = existsSync(outPath) === false;
```

**The spawn call the tree-aware extension must add `cwd` to** (`acme-verify.ts:755-779`, verbatim, comments included so the planner sees exactly what is documented here and what is silently missing):
```typescript
    const r = spawnSync(assemblerBin, buildArgv(format, outPath, srcPath), {
      encoding: "utf8",
      timeout: 30_000,
      // AN EXPLICIT, GENEROUS maxBuffer (30-REVIEW WR-06, added 2026-08-31).
      // Node's default is 1 MiB. `-v2` emits ONE per-segment result line per
      // block, so a store with enough ranges (roughly 17 000 at ~60 bytes per
      // line) overflowed stdout, at which point `spawnSync` sets
      // `error.code = "ENOBUFS"` and kills the child -- and before CR-03's
      // fix that landed in `"unavailable"` -> `"skipped"`, the same false
      // "no assembler ran" report as CR-03 from a different cause. Worse,
      // `refuseOnCompetingAggregates()` and `firstResultLineDisagreement()`
      // -- the two rules that READ stdout -- would then never run at all, so
      // a truncated stream could not disagree with anything.
      //
      // 64 MiB is chosen to be far past any plausible real store rather than
      // tuned: this is a test-only oracle run once per verification, and the
      // cost of a buffer that is never filled is nothing, while the cost of
      // one that overflows is a verdict about the wrong thing.
      //
      // ENOBUFS IS NOW `"ran"` REGARDLESS, via `classifySpawn()`'s
      // signal/timeout rules: `spawnSync` kills the child on overflow, which
      // sets `signal`. So an overflow that somehow still happened is a real
      // observation with truncated evidence, not an absent binary.
      maxBuffer: 64 * 1024 * 1024,
      // NOTE: no `cwd` key here today. A tree-aware extension must add one,
      // pointed at the directory holding the already-written tree, exactly as
      // host-tool.mts:1351 does for the real acme.build op.
    });
```

**The five ordered verdict rules to reuse completely unchanged** (`acme-verify.ts:783-883`; the tree-aware extension must NOT re-derive any of rules 1–6 — it only changes how `dir`/`srcPath` are obtained):
1. `classifySpawn(r) === "unavailable"` → `"skipped"` (never a false pass/fail)
2. ACME's own fatal diagnostic wins (`parsed.find(isFatal)`)
3. Competing authoritative aggregates → refuse to guess (`refuseOnCompetingAggregates`)
4. Unanimity against the exporter's own blocks (`firstResultLineDisagreement`, needs `-v2`'s per-segment lines — this is why the gate must NOT route its real spawn through `host-tool.mts`'s `-v1` argv)
5. No output file at all → `"failed"`
6. Byte-diff IS the verdict, AND the path must have been `absentBeforeSpawn`:
```typescript
    // Rule 6: the byte-diff IS the verdict.
    const actual = readFileSync(outPath);
    const byteDiff = compareBytes(Buffer.from(options.expectedBytes), actual);
    if (byteDiff.equal && absentBeforeSpawn) {
      return { exitStatus, acmeResultLines, aggregateLines, diagnostics, byteDiff, outcome: "ok",
        reason: `the output file this run created is byte-identical to the expected bytes ` +
          `(${byteDiff.actualLength} byte(s) across ${expected.length} segment(s)).` };
    }
```

**The reference `cwd` fix already proven load-bearing elsewhere** (`host-tool.mts:1300-1352`, the `acme.build` argv branch — copy this `cwd` reasoning, not this argv, since the gate must stay on `-v2` not `-v1`):
```typescript
export function buildHostToolArgv(request: HostToolRequest, resolved: ResolvedHostToolPaths, log?: (line: string) => void): BuildHostToolArgvResult {
  if (request.tool === "acme.build") {
    const { args } = request;
    const { sourcePath, outDirPath, includePaths } = resolved as ResolvedAcmeBuildPaths;
    ...
    const argv: string[] = [
      "--cpu", "6510", "-f", args.format ?? "cbm",
      "-Wtype-mismatch", "--strict-segments", "--msvc",
      "-v1",                    // <-- NOTE: -v1, NOT -v2. Do not copy this flag into the gate's spawn.
      "-o", prg, "-l", `${stem}.sym`, "--vicelabels", `${stem}.vs`,
    ];
    ...
    // The directory holding the resolved ROOT SOURCE, never `outDirPath`:
    // `outDir` governs where the `.prg` lands and a caller may point it
    // elsewhere, while `!source` resolution is about where the SOURCES live,
    // beside `sourcePath` itself.
    return { ok: true, toolPath: acmePath, argv, outputs: [prg], cwd: dirname(sourcePath) };
  }
```

**The digest-only response envelope the gate must NOT rely on for bytes/segment-lines** (`host-tool.mts:1843-1850`, verbatim):
```typescript
export type HostToolResponse =
  | {
      ok: true;
      tool: "acme.build" | "ghidra.analyze" | "dxa.disassemble" | "ghidra.installExtension" | "c1541.bam" | "c1541.dir" | "c1541.entry" | "c1541.chain" | "c1541.read";
      exitStatus: number | null;
      results: HostToolFileResult[];   // { path, sha256, byteLength } -- NO raw bytes, NO stdout segment lines
      stderrTail: string;
    }
```

**Availability gate to reuse verbatim, never re-probe** (`acme-gate.ts`, whole 90-line file — key exports):
```typescript
export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";

export function probeAcme(): boolean {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8", timeout: 10_000 });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return false;
  return /acme/i.test(banner);
}

export const ACME_AVAILABLE: boolean = probeAcme();
```
Every ACME-gated test in the new gate file must use `{ skip: SKIP_REASON }` on the real-ACME
tests, exactly like every existing consumer of this module.

---

### `src/mcp/vice/reassembly-gate.test.ts` (new, test, event-driven — planted violation → assert red)

**Analog:** `src/mcp/vice/acme-verify.test.ts`'s "MANDATORY RED" pattern.

**Structure to copy** — an honest control FIRST (proves the baseline passes and that a real,
non-degenerate ACME diagnostic exists), THEN a single, named, minimal corruption, THEN
assertions on the co-occurrence of fields, never on outcome alone. Full worked example, MANDATORY
RED 2 (`acme-verify.test.ts:1131-1197`, verbatim, corruption technique is generic and directly
reusable for the gate's own planted-violation controls — e.g. corrupt one relocated byte, corrupt
one hazard-adjacent byte, or point `ACME_BIN` at a stale/wrong binary):
```typescript
test("MANDATORY RED 2: a corrupted export byte fails the byte-diff while ACME itself exits 0", { skip: SKIP_REASON }, () => {
  buildTracerExport((result) => {
    // 1. The honest control FIRST, so the red below is a change of exactly one
    //    byte against the same export and nothing else.
    const honest = verifyAcmeAssembles({
      source: result.source,
      expectedBytes: result.expectedBytes,
      expectedSegments: result.blocks,
    });
    assert.equal(honest.outcome, "ok",
      `the honest control must pass before the corruption means anything; reason: ${honest.reason}`);
    assert.ok(honest.diagnostics.length >= 1,
      "the tracer source trips a real ACME Warning; if it stopped doing so this control silently stopped proving " +
        `that warnings are non-fatal. diagnostics: ${JSON.stringify(honest.diagnostics)}`);

    // 2. Flip ONE operand byte -- both forms assemble, both exit 0, the bytes differ.
    const CORRUPTED_INDEX = 1;
    const corrupted = Uint8Array.from(result.expectedBytes);
    assert.equal(corrupted[CORRUPTED_INDEX], 0x00, "the byte about to be corrupted must be the `lda #$00` operand");
    corrupted[CORRUPTED_INDEX] = 0x01;

    // 3. The red.
    const red = verifyAcmeAssembles({
      source: result.source,
      expectedBytes: corrupted,
      expectedSegments: result.blocks,
    });
    assert.equal(red.outcome, "failed", `a wrong expected byte must FAIL:\n${JSON.stringify(red, null, 2)}`);
    assert.equal(red.byteDiff?.equal, false, "the byte-diff is the verdict and it must disagree");
    assert.equal(red.byteDiff?.firstDifferingOffset, CORRUPTED_INDEX,
      "the first differing offset is a BYTE offset and must name the byte that was flipped");
    assert.equal(red.exitStatus, 0,
      "ACME REPORTED SUCCESS -- exit status 0 -- AND THE BYTE-DIFF CAUGHT IT ANYWAY.");
  });
});
```
**Stale-output-path control to copy for criterion 3's second planted RED** (naming convention
only — `acme-verify.test.ts:1218` opens with `mkdtempSync(join(tmpdir(), "acme-verify-stale-"))`
and reproduces "ACME leaves a pre-existing output file untouched on failure" directly; the gate's
own equivalent should reuse the SAME `absentBeforeSpawn` field rather than re-deriving staleness).

**Test-file naming/scope convention this file must match** (`acme-gate.ts` header, quoted because
it states the rule explicitly): this file's name must NOT collide with the `*.test.*` glob's
import-side-effect hazard, must never appear in `package.json`'s `files[]`, and — per RESEARCH.md's
own flagged gap (A5) — the planner should consider whether a NEW structural test, mirroring
`spawn-seam.test.ts`'s pattern but scoped to ACME rather than the emulator binary, is needed to
mechanically enforce "no fourth raw ACME spawn site," since neither existing guard scans a new
`src/mcp/vice/*.test.ts` file for one.

---

### `.planning/phases/49-.../evidence/SCHEMA.md` and `DECISION-RULE.md` (documentation-contract)

**Analog:** Phase 39's pair, same filenames, same directory shape
(`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/{SCHEMA,DECISION-RULE}.md`).

**SCHEMA.md opening frame to copy verbatim in structure** (`.../39-.../evidence/SCHEMA.md:1-14`):
```
# Phase 39 — The outcome-line schema and measurement definitions

**Binding. Committed before any measurement exists.** Every literal name the rest of this
phase may emit is fixed here, together with the **derivation rule** that produces its value
from raw measurement — so no measuring plan can invent a favourable definition, and no plan
can mint a line name that flatters its own result. A measuring plan that needs a name not
declared below has found a gap in the pre-commitment; it records that as an `## ACCEPTED
LIMIT` in its **own** evidence file and the findings document records an explicit override.
**It does not invent a name, and it does not edit this file.**

`DECISION-RULE.md` reads its inputs from the lines declared here. The two files are one
pre-commitment in two parts and share its frozen status.
```
Key conventions to replicate for Phase 49's own `SCHEMA.md`: bare `NAME: value` at column 0,
final-occurrence-wins, one declared source file per line name, explicit absence rules for the
gate's own N required inputs (Phase 49's analog of Phase 39's "seven gate inputs" — likely
byte-diff outcome, movement-rebuild outcome, hazard-clean-or-acknowledged outcome, and any
planted-RED-control confirmation).

**DECISION-RULE.md opening frame to copy verbatim in structure** (`.../39-.../evidence/DECISION-RULE.md:1-16`):
```
# Phase 39 — The binding decision rule (CHAN-01)

**Binding. Stated here, before the run, so the verdict is derived and not judged.**
Read the inputs from the evidence files, **never from a summary's paraphrase**, then
evaluate the rules **in order** and take the first that matches. Record which rule fired.

This document's commit precedes every measurement commit in this phase. `git log` is the
proof; see `README.md` § *Ordering proof*.

**Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
or "clarified" after the first measurement commit lands...
```
Note the **decision checkpoint** convention embedded in the same file (`DECISION-RULE.md:18-30`
in Phase 39): a `blocking` gate confirming the rule text with the human owner BEFORE any
measurement — Phase 49's own `DECISION-RULE.md` should carry the same checkpoint language,
scoped to its own rules.

**Git-ordering proof to replicate for Phase 49** (verified this session via
`git log --diff-filter=A`): Phase 39's `DECISION-RULE.md`/`SCHEMA.md` landed in commit
`05c2c069` and its FIRST measurement evidence file landed later, in `99ec2cb9` — a distinct,
later commit. Phase 49 must reproduce this same ordering: commit the SCHEMA/DECISION-RULE pair
in an isolated wave-1 commit, with NO `evidence/49-*.md` measurement file in that same commit.

---

### `docs/phase49-the-reassembly-gate-findings.md` (evidence artifact, YAML-frontmatter verdict)

**Analog:** `docs/phase39-dual-channel-coexistence-gate-findings.md`.

**Frontmatter shape to copy exactly** (`docs/phase39-dual-channel-coexistence-gate-findings.md:1-16`):
```yaml
---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
requirement: [CHAN-01]
probe_date: 2026-09-07
verdict: go
verdict_rule_applied: R15
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared source file. Paths are relative to
  # .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/.
  idle_coexist: clean                # evidence/39-idle-coexist.md:279
  foreign_halt_visibility: visible    # evidence/39-foreign-halt.md:307
  ...
---
```
Phase 49's frontmatter must carry `phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates`,
`requirement: [BUILD-06]`, and one `inputs.<name>` key per named gate input declared in its own
`SCHEMA.md`, each with an inline `# evidence/<file>.md:<line>` citation — never a bare value with
no traceable source line.

---

### `src/mcp/vice/fixtures/reassembly-gate/make-reassembly-gate-fixtures.mjs` (possible, fixture generator, file-I/O)

**Analog:** `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs`.

**Header pattern to copy in structure (not verbatim text)** — a WHY-A-GENERATOR-RATHER-THAN-A-BLOB
comment, an explicit determinism contract, and a refuse-rather-than-partial-write discipline
(header, verbatim):
```
// WHY A GENERATOR RATHER THAN A HAND-COMMITTED BLOB: `hazard-subject.prg` is
// only evidence for anything while it is EXACTLY what `hazard-subject.a`
// (which pulls in every other part with `!source`) assembles to...
//
// DETERMINISM IS PART OF THE CONTRACT: running this script twice must leave
// `git status --porcelain src/mcp/vice/fixtures/hazard-subject` empty. There
// is no timestamp, no random value and no host-dependent path in either
// emitted file -- ACME's `-f cbm` output is a pure function of the source
// tree.
//
// IT REFUSES RATHER THAN WRITING A PARTIAL FIXTURE. If the assembler is
// missing, or exits non-zero, or writes no output file, this script prints
// the reason and exits non-zero WITHOUT touching either committed `.prg`.
```
Only build this file if the gate's planted RED controls need their own committed fixture tree
(as opposed to synthesizing a tiny in-memory tree per test, the way `acme-verify.test.ts`'s
`buildTracerExport()` helper does) — RESEARCH.md does not commit to needing one; the planner
should decide based on whether the movement/hazard-adjacency controls need a multi-file tree
bigger than what a test can build inline.

---

## Files With NO Prior Art (design fresh, do not force an analog)

### A movement/relocation mechanism

**Role:** pure-function module (or inline test helper). **Data flow:** transform — mutates a
store's label/range address, re-runs `exportAsmTree()`, and re-verifies at the new layout.

No file in this codebase relocates a symbol/label in place for verification purposes; every
existing test constructs a NEW store at a NEW address rather than moving one. The nearest
thing to read for the SHAPE of what it consumes is `anno-export-asm.ts`'s `exportAsmTree()`
signature (already quoted in RESEARCH.md, `anno-export-asm.ts:2242-2245, 2387-2396`) — but this
is a consumed dependency, not an analog for the relocation operation itself. RESEARCH.md's own
recommendation (A4, Open Question 2): build it as a store-level operation — shift a label's or
block's address by a fixed delta and re-export — not a hand-edited `.a` text splice, so the gate
still exercises the real Phase 47 export path.

### A hazard-finding acknowledgement mechanism

**Role:** pure-function module. **Data flow:** CRUD-like — matches an acknowledgement entry
against `HazardReport.findings` by the `(hazardClass, anchorAddress, mechanism)` triple and
must FAIL (not silently accept) on zero or multiple matches.

`HazardFinding` (`anno-hazard-report.ts:182-209`, quoted verbatim below) has no `id` field, so
there is nothing existing to extend:
```typescript
export interface HazardFinding {
  hazardClass: HazardClass;
  anchorAddress: number;
  blockedAddress: number | null;
  mechanism: string;
  strength: HazardDetectionStrength;
  detail: string;
  corroboration: "runtime-observed" | "none";
}
```
RESEARCH.md's own recommendation (A3, Pitfall 4): use the `(hazardClass, anchorAddress, mechanism)`
triple as the acknowledgement identity (order-independent, since `findings` array ordering is
not documented as stable — Open Question 3), and fail loudly on an ambiguous or empty match
rather than accepting it.

## Shared Patterns

### Byte-diff-is-the-verdict (never exit status, never a second implementation)
**Source:** `src/mcp/vice/acme-verify.ts:783-865` (rules 1–6, quoted in full above)
**Apply to:** the extended `verifyAcmeAssembles()` AND the gate test file — the gate must call
into the (extended) oracle's `AcmeOutcome`/`byteDiff`, never re-open the produced file and
`Buffer.compare` it a second time (ROADMAP criterion 2's explicit "no second independent verify
path").

### Fresh-mkdtemp + absent-before-spawn (never a fixed/stale output path)
**Source:** `src/mcp/vice/acme-verify.ts:744-753`
**Apply to:** any new spawn site the gate introduces (there should be none beyond the extended
oracle's own) and the movement-mechanism's re-export/re-verify cycle, which must use a FRESH
directory per rebuild, not reuse of the original export's directory.

### ACME availability probe (never re-derive, never hand-copy a second probe)
**Source:** `src/mcp/vice/acme-gate.ts` (`ACME_BIN`, `probeAcme()`, `ACME_AVAILABLE`)
**Apply to:** the new gate test file's real-ACME tests, using the same `{ skip: SKIP_REASON }`
idiom every existing ACME-gated test file uses.

### Committed-rules-before-measurement, proven by git history
**Source:** Phase 39's `evidence/SCHEMA.md` + `evidence/DECISION-RULE.md`, and the verified
`git log --diff-filter=A` ordering (`05c2c069` before `99ec2cb9`)
**Apply to:** Phase 49's own `SCHEMA.md`/`DECISION-RULE.md` pair — commit them in an isolated
wave-1 commit with no measurement evidence file alongside, exactly reproducing this project's
own established gate precedent (Phases 9, 23, 33, 39).

### No fourth raw spawn site for ACME
**Source:** `src/mcp/vice/spawn-seam.test.ts` (emulator-only scope, does NOT scan ACME),
`scripts/check-no-skill-external-spawn.mjs` (skills-only scope, does NOT scan
`src/mcp/vice/*.test.ts`)
**Apply to:** every new file this phase adds — reuse the extended `verifyAcmeAssembles()`'s
existing spawn call; do not add a new `spawnSync`/`spawn` call anywhere in the gate script or
its test file. Flagged gap (RESEARCH.md A5): consider a new structural test mirroring
`spawn-seam.test.ts`, scoped to ACME, if this discipline needs to be mechanically checked rather
than only documented.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Movement/relocation mechanism | pure-function module | transform | No file in this codebase relocates a symbol/label address for verification; every test builds a new store at a new address instead. Design per RESEARCH.md A4/Open Question 2. |
| Hazard-finding acknowledgement mechanism | pure-function module | CRUD-like | `HazardFinding` carries no stable `id`; no acknowledgement scheme exists anywhere. Design per RESEARCH.md A3/Pitfall 4, using the `(hazardClass, anchorAddress, mechanism)` triple. |

## Metadata

**Analog search scope:** `src/mcp/vice/acme-verify.ts`, `acme-verify.test.ts`, `acme-gate.ts`,
`anno-export-asm.ts`, `anno-hazard-report.ts`, `host-tool.mts`, `host-tool.test.ts`,
`fixtures/hazard-subject/make-hazard-subject-fixtures.mjs`,
`.planning/phases/39-.../evidence/{SCHEMA,DECISION-RULE}.md`,
`docs/phase39-dual-channel-coexistence-gate-findings.md`
**Files scanned:** 11 (all read directly this session, per RESEARCH.md's own Sources list;
no new codebase search was needed since RESEARCH.md already named every analog with line
numbers)
**Pattern extraction date:** 2026-09-13

**Project-convention notes for the planner:**
- `SCHEMA.md`/`DECISION-RULE.md`/the findings doc are `.planning/`-tree and `docs/`-tree
  prose/YAML files — the "no planning vocabulary in product files" rule (CLAUDE.md) does NOT
  restrict them; it restricts `src/mcp/vice/*.ts` and `src/skills/**`. The extended
  `acme-verify.ts` and the new `reassembly-gate.test.ts` MUST NOT cite `.planning/*` paths,
  phase/plan numbers, or bare `D-NN`/`G-NN-N` ids in their own source comments — cite only
  `docs/phase49-...-findings.md` (a document outside `.planning/`) if a cross-reference is
  needed at all, matching the project's one surviving citation form.
- All quoted analog code follows this repo's 2-space indent, double-quoted strings, semicolons,
  and header-comment-states-the-WHY convention; no additional style translation is needed when
  copying these excerpts.
