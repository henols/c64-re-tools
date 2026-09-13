# Phase 49: The Reassembly Gate, Committed Before the Phase It Gates - Research

**Researched:** 2026-09-13
**Domain:** CI/dev-time verification gate over an existing multi-file ACME export + byte-diff oracle + hazard report
**Confidence:** HIGH for existing-machinery facts (all read from source this session); MEDIUM for how the gate script itself should be built (no gate script exists yet, so its shape is a design decision, not a fact); LOW/ASSUMED only where explicitly marked

## Summary

Phase 49 does not need new architecture. Every load-bearing primitive it gates already
exists and was read end-to-end this session: `exportAsmTree()` (Phase 47) writes a real
multi-file ACME tree to disk with a lossless byte-diff target (`expectedBytes`);
`verifyAcmeAssembles()` in `acme-verify.ts` (a pre-existing, test-only, EXPORT-03 oracle)
turns "here is ACME source and the bytes it must produce" into a three-outcome verdict
(`ok`/`failed`/`skipped`) derived from a real byte-diff, never from exit status; and
`buildHazardReport()` (Phase 48) returns a `HazardReport` whose findings and regions are
read-only computed facts. What Phase 49 must build is: (1) a small extension to
`acme-verify.ts`'s oracle so it can verify a TREE (a directory ACME must `!source`-resolve
against, using `cwd`) rather than only a single in-memory source string; (2) a gate SCRIPT
that wires exportAsmTree → the extended oracle → the hazard report → a movement-relocation
step → a committed verdict artifact; and (3) the pre-committed rules/vocabulary documents
(`DECISION-RULE.md` + `SCHEMA.md`, this project's own established pattern from Phases 9,
23, 33 and 39) that must land in git BEFORE the gate's first real run.

Two structural facts change what "extend, don't fork" means in practice and must not be
glossed over. First, `verifyAcmeAssembles()` today spawns ACME directly with `spawnSync`
and **no `cwd` option** — it writes `options.source` (a single string) into one temp file
and assembles it in whatever directory the test process happens to be running in. A
multi-file tree with `!source "scope_0801.a"` lines (bare filenames, Phase 47's own
design) will not resolve unless the child's `cwd` is the tree's own directory — exactly
the fix Phase 47 had to make for `host-tool.mts`'s `acme.build` op (`cwd: dirname(sourcePath)`
at `host-tool.mts:1351`). `acme-verify.ts` carries no such field today (confirmed by reading
its full spawn call, `acme-verify.ts:755-779` — no `cwd` key in the options object). Second,
`runHostTool()`'s `acme.build` response envelope (`host-tool.mts:1843-1850`) returns only a
**sha256 digest and byte length** per output file (`HostToolFileResult { path, sha256,
byteLength }`), not the raw bytes and not ACME's per-segment stdout lines — so the gate
cannot get `acme-verify.ts`'s unanimity rule (rule 4, ACME's own `-v2` per-segment lines)
"for free" by calling `runHostTool()`. The two existing machineries diverge in argv (`-v1`
vs `-v2`) and in what they hand back. The planner must decide, explicitly, which of the two
executes the actual child process for the gate's real run — extending `verifyAcmeAssembles()`
itself with a `cwd`/tree option (keeping its `-v2` argv and direct byte read) is the
narrower, more honest extension; routing through `runHostTool()`'s `acme.build` would also
satisfy the "no fourth spawnSync site" note but requires either widening its response
envelope or having the gate read the produced `.prg` off disk itself using the `path` field
already returned.

**Primary recommendation:** Add a tree-aware entry point to `acme-verify.ts` (e.g. a
sibling function or an additional `AcmeVerifyOptions` variant that accepts a pre-written
`outDir` and root file name instead of a raw `source` string, sets `cwd: outDir` on the
spawn, and reuses every one of the five existing verdict rules unchanged) rather than
building a second verify path or routing the byte-diff through `runHostTool()`'s
digest-only response. Build the gate itself as a new test-only script/test file (never
added to `package.json`'s `files[]`, matching `acme-verify.ts`'s own precedent for staying
outside the shipped-module and spawn-seam-scanned sets), and commit its `DECISION-RULE.md`
+ `SCHEMA.md` pair in the first wave, before any fixture-based measurement.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-file tree emission (`exportAsmTree`) | Store/export module (`anno-export-asm.ts`) | — | Already built (Phase 47); the gate is a pure consumer |
| Real ACME invocation for the gate's rebuild | Test-only oracle module (`acme-verify.ts`, extended) | Host-tool execution seam (`host-tool.mts`'s `acme.build`, if the planner instead routes through it) | Both are "host process execution"; the byte-diff verdict itself must stay in the oracle, never re-derived by the gate script |
| Byte-diff verdict derivation | Test-only oracle module (`acme-verify.ts`) | — | This is the ONE authoritative place for `AcmeOutcome`; a gate that re-derives its own pass/fail from bytes is exactly the "second independent verify path" ROADMAP criterion 2 forbids |
| Hazard-adjacency / acknowledgement check | Gate script (new, test-only) | `anno-hazard-report.ts` (read-only input) | The gate consumes `HazardReport` as data; it must not mutate or re-derive hazard findings |
| Movement/relocation exercise | Gate script (new, test-only), operating on the store or the exported tree | `anno-store.ts` (symbol/label address mutation) | "Movement" is a store-level or generated-source-level edit exercised once per gate run, not a capability that exists anywhere yet (see Q8/Q10) |
| Decision-rule vocabulary + machine-readable verdict | Committed docs (`.planning/phases/49-.../evidence/DECISION-RULE.md`, `SCHEMA.md`, `docs/phase49-...-findings.md`) | — | This project's own established pattern (Phases 9, 23, 33, 39); not CI/build tooling, but git-committed prose+YAML |

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. It reuses ACME (already an
accepted, user-installed external dependency per `CLAUDE.md`'s "External tools are never
auto-installed" constraint) through the existing `acme-gate.ts`/`acme-verify.ts`/
`host-tool.mts` seams. No `npm install` is introduced by this phase's design.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase — there was no discuss-phase pass. Design intent below
is derived from `.planning/ROADMAP.md`'s Phase 49 section and from the codebase, per the
task's own instruction.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-06 | "Reassembly plus a clean hazard report is a gate that exists before the phase it gates runs, not after" | §§ 1–7 below: the extension point in `acme-verify.ts`, the `expectedBytes`/tree contract from Phase 47, the `HazardReport` shape from Phase 48, the `host_tool` seam, and the committed-rules-before-measurement precedent are all grounded in read source. §8 (movement) and parts of the gate script itself are NOT pre-existing and must be designed fresh — flagged explicitly rather than assumed. |
</phase_requirements>

## Standard Stack

No new libraries. This phase is 100% internal composition of already-shipped or
already-test-only TypeScript modules in `src/mcp/vice/`, run under this project's existing
`node --test` harness. `ACME_BIN` (external, user-installed, per `CLAUDE.md`) is the only
"dependency," and it is already gated by `acme-gate.ts`.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ACME cross-assembler | 0.97 "Zem" (already verified live this project, per `acme-gate.ts` and CLAUDE.md) | Real reassembly of the Phase 47 export tree | This is the project's one accepted external assembler; no alternative is in scope |
| Node built-in test runner | Node ≥ 24 (`node --test`) | Runs the gate as a test file, exactly like every other gate in this project (Phase 9/23/33/39) | Matches project convention; no separate test framework exists |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` (`spawnSync`/`spawn`) | built-in | Already used by `acme-verify.ts` (`spawnSync`) and `host-tool.mts` (`spawn`) | Reused, not reinvented — see the "fourth spawnSync site" constraint in §5 |
| `node:fs` (`mkdtempSync`, `readFileSync`, `readdirSync`) | built-in | Fresh-directory-per-run discipline, byte reads | `acme-verify.ts` already does this; the gate must match it for its own tree-write step |

### Alternatives Considered

Not applicable — there is no ecosystem alternative under consideration; this is pure
internal composition per `CLAUDE.md`'s constraint against re-deriving cross-cutting seams
locally.

**Installation:** None required.

## Architecture Patterns

### System Architecture Diagram

```
   Annotation store (.annostore, unchanged by this phase)
              |
              | exportAsmTree()  [anno-export-asm.ts, Phase 47, SHIPPED]
              v
   Export tree on disk: root.a, symbols.a, scope_XXXX.a[, unscoped.a][, *.bin]
   + ExportAsmTreeResult { expectedBytes, blocks, outDir, files, sourceOrder, ... }
              |
              |  (gate script, NEW, test-only)
              v
   +-------------------------------------------------------------+
   | Reassembly Gate                                              |
   |                                                               |
   |  1. Fresh mkdtemp output dir (never a fixed/stale path)       |
   |  2. Write tree via exportAsmTree() into that fresh dir         |
   |  3. Invoke ACME against root.a, cwd = fresh dir                |
   |       -> via EXTENDED acme-verify.ts oracle (tree-aware)      |
   |          OR host-tool.mts's acme.build op (see open question) |
   |  4. Byte-diff produced bytes against exportAsmTree()'s own     |
   |     expectedBytes  -> AcmeOutcome: ok | failed | skipped       |
   |  5. Relocate >=1 symbol's address in the store, re-export,     |
   |     re-run steps 2-4 at the NEW layout (movement exercised     |
   |     every run, criterion 4)                                    |
   |  6. Read HazardReport (anno_hazard_report / buildHazardReport) |
   |     -> block on non-clean unless every finding has a recorded  |
   |     per-finding acknowledgement in the verdict artifact         |
   |  7. Emit machine-readable verdict: docs/phase49-...-findings.md |
   |     (YAML frontmatter, go/no-go-shaped) + evidence/ files       |
   +-------------------------------------------------------------+
              |
              v
   Phase 50's planner reads docs/phase49-...-findings.md's verdict
   as a precondition before EQUIV-* work begins.
```

### Recommended Project Structure

```
src/mcp/vice/
├── acme-verify.ts              # EXTEND: add tree-aware verify entry point (cwd-bearing)
├── acme-verify.test.ts         # existing tests unaffected; new tests for the tree entry point
├── anno-export-asm.ts          # UNCHANGED consumer: exportAsmTree() already returns everything needed
├── anno-hazard-report.ts       # UNCHANGED consumer: buildHazardReport() already returns everything needed
├── host-tool.mts               # UNCHANGED unless the planner routes the gate's spawn through it
├── reassembly-gate.test.ts     # NEW, test-only, never in package.json files[] (matches acme-verify.ts precedent)
└── fixtures/reassembly-gate/   # NEW, if planted RED controls need their own fixture directory
    └── make-reassembly-gate-fixtures.mjs   # committed generator, idempotent, git status --porcelain clean

.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/
└── evidence/
    ├── SCHEMA.md            # outcome-line vocabulary + findings-doc frontmatter shape, committed FIRST
    ├── DECISION-RULE.md      # the actual R1..Rn rule table, committed FIRST, alongside SCHEMA.md
    └── 49-*.md               # per-measurement evidence files, committed AFTER the two above

docs/
└── phase49-the-reassembly-gate-findings.md   # the machine-readable YAML-frontmatter verdict Phase 50 reads
```

### Pattern 1: Extend the byte-diff oracle without forking it

**What:** `acme-verify.ts`'s `verifyAcmeAssembles()` already implements the ENTIRE verdict
contract (five ordered rules, byte-diff basis, fresh-directory discipline, `classifySpawn`
availability check). The only thing it cannot do today is assemble a tree with `!source`
lines, because it never sets `cwd` and only ever writes one file.
**When to use:** Any time the gate needs a verdict on multi-file ACME source.
**Example (read this session, `acme-verify.ts:739-883`):**
```typescript
// Source: src/mcp/vice/acme-verify.ts:746-779 (existing, unmodified)
const dir = mkdtempSync(join(tmpdir(), "acme-verify-"));
try {
  const srcPath = join(dir, "export.a");
  const outPath = join(dir, "export.bin");
  writeFileSync(srcPath, options.source, "utf8");
  const absentBeforeSpawn = existsSync(outPath) === false;
  const r = spawnSync(assemblerBin, buildArgv(format, outPath, srcPath), {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
    // NOTE: no `cwd` key here today. A tree-aware extension must add one,
    // pointed at the directory holding the already-written tree, exactly as
    // host-tool.mts:1351 does for the real acme.build op.
  });
```
The extension the planner should specify: a new option (or sibling function) that accepts
`{ outDir: string; rootFileName: string; expectedBytes; expectedSegments }` instead of
`source`, skips the `writeFileSync(srcPath, ...)` step (the tree is already on disk, written
by `exportAsmTree()`), and passes `cwd: outDir` to the same `spawnSync` call — reusing
`buildArgv`, `classifySpawn`, `parseAcmeResultLines`, `parseAcmeDiagnostics`,
`firstResultLineDisagreement` and `compareBytes` completely unchanged.

### Pattern 2: The pre-committed decision-rule pair (this project's own gate precedent)

**What:** Every prior gate phase in this project (9, 23, 33, 39) committed two files BEFORE
any measurement: a `SCHEMA.md` (outcome-line vocabulary, one `NAME: value` per gate input,
final-occurrence-wins, absence rules, and the findings-document frontmatter key order) and a
`DECISION-RULE.md` (the actual `R1..Rn` ordered rule table, evaluated first-match-wins, with
an explicit "Status: pre-commitment, frozen" statement and a note that its own git commit
precedes every measurement commit).
**When to use:** For Phase 49's own rules (BUILD-06 criterion 1 demands exactly this).
**Example, read this session (`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/SCHEMA.md:1-14` and `DECISION-RULE.md:1-16`):**
```
SCHEMA.md:
  "Binding. Committed before any measurement exists. Every literal name the
  rest of this phase may emit is fixed here, together with the derivation
  rule that produces its value from raw measurement..."

DECISION-RULE.md:
  "Binding. Stated here, before the run, so the verdict is derived and not
  judged... This document's commit precedes every measurement commit in this
  phase. `git log` is the proof."
```
Verified via `git log --diff-filter=A` this session: Phase 39's `DECISION-RULE.md` and
`SCHEMA.md` were both added in commit `05c2c069` ("feat(39-01): freeze CHAN-01 decision
rules, schema and executable totality walk"), and the first measurement evidence file
(`39-idle-coexist.md`) landed in a LATER commit (`99ec2cb9`, "feat(39-03): measure
IDLE_COEXIST live"). This is the literal git-ordering proof the planner should replicate:
wave 1 of Phase 49 commits `evidence/SCHEMA.md` + `evidence/DECISION-RULE.md` (and, per this
project's own convention, a `blocking` decision-gate checkpoint confirming the rule text with
the human owner — see `DECISION-RULE.md:18-30` for Phase 39's own wording of that
checkpoint), and no measurement wave runs before that commit exists.

The findings document itself (`docs/phase49-the-reassembly-gate-findings.md`) is the
"machine-readable artifact that Phase 50's planner reads as a precondition" that criterion 1
names. Its shape, verified against `docs/phase39-dual-channel-coexistence-gate-findings.md:1-16`:
YAML frontmatter with `phase`, `requirement`, `probe_date`, `verdict`,
`verdict_rule_applied`, and `inputs.<name>` keys, each `inputs` value carrying an inline
comment citing `evidence/<file>.md:<line>` as its source.

### Anti-Patterns to Avoid

- **A second byte-diff implementation inside the gate script.** ROADMAP criterion 2 is
  explicit: "A test refuses a second independent verify path." The gate script must call
  into `acme-verify.ts`'s (extended) verdict function and read its `AcmeOutcome`/`byteDiff`
  — never open the produced file itself and `Buffer.compare` it a second time.
- **Reading `runHostTool()`'s `acme.build` response as if it carried raw bytes or
  per-segment lines.** It does not (`host-tool.mts:1843-1850`) — only `sha256`, `byteLength`
  and `path`. If the planner routes the actual spawn through `host_tool`, the gate must
  either widen that response type (a real, disclosed change) or read the file at `.path`
  itself and hand those bytes to `acme-verify.ts`'s comparison function — never invent a
  THIRD notion of "bytes match" based on the sha256 alone without also verifying
  `expectedBytes`'s own hash was computed the same way.
- **A fourth raw `spawnSync`/`spawn` call site for ACME.** Per the ROADMAP note, the ACME
  invocation for the rebuild must go through the same typed seam as everything else. Note
  precisely what this DOES and DOES NOT mean, per source read this session: `spawn-seam.test.ts`
  only scans for the EMULATOR binary (`VICE_BIN`/`x64sc`/`binPath`/`viceBin`,
  `spawn-seam.test.ts:179`) over the SHIPPED module set derived from `package.json`'s
  `files[]` (`shipped-modules.ts:151-162`) — it does not scan for ACME spawns at all, and
  `acme-verify.ts` is explicitly OUTSIDE that scanned set (confirmed: neither `acme-verify.ts`
  nor `acme-gate.ts` nor `host-tool.mts` itself appears literally in
  `src/mcp/vice/package.json`'s `files[]`; only `host-tool-client.ts` and the compiled
  `resources/` directory do). `check-no-skill-external-spawn.mjs` (scripts/) separately
  bans `acme`/`x64sc`/etc. as a literal spawn target ONLY inside `src/skills/*/scripts/*.mjs`
  (`check-no-skill-external-spawn.mjs:391-427`). **Neither existing guard would catch a new
  raw ACME spawn placed in a new test-only file under `src/mcp/vice/`.** The "fourth site"
  discipline in the ROADMAP note is therefore a PROSE commitment the plan must enforce by
  design (reuse the existing spawn call inside `acme-verify.ts`/`host-tool.mts`), not one
  that any committed test currently mechanically enforces — flag this to the planner as a
  gap: if this discipline needs to be checkable, a new structural test (mirroring
  `spawn-seam.test.ts`'s own pattern, scoped to ACME rather than the emulator) may be an
  in-scope task for this phase.
- **Trusting `-v1`'s aggregate line.** If the gate's spawn ever uses `host-tool.mts`'s
  `acme.build` argv builder (`-v1`, `host-tool.mts:1327`) instead of `acme-verify.ts`'s own
  `-v2` argv (`acme-verify.ts:411`), the per-segment unanimity rule (rule 4) has nothing to
  read. This is a load-bearing reason to prefer extending `acme-verify.ts` directly over
  routing the gate's spawn through `host_tool`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ACME availability detection | A new "is ACME installed" probe | `acme-gate.ts`'s `ACME_BIN`/`ACME_AVAILABLE`/`probeAcme()`/`acmeSkipReasonFor()`/`assertAcmeRequiredIfEnvSet()` | Already the ONE home of this logic; every ACME-gated test file in this repo imports it |
| Byte-diff verdict logic | A second byte-comparison function inside the gate | `acme-verify.ts`'s `compareBytes()`/`verifyAcmeAssembles()` (extended) | ROADMAP criterion 2 explicitly forbids a second verify path; a test already exists (`acme-verify.test.ts`) that would need to be the one place asserting this |
| ACME argv construction | A third hand-written ACME flag array | `ACME_VERIFY_ARGV_FLAGS` (`acme-verify.ts:390-412`) or `buildHostToolArgv()`'s `acme.build` branch (`host-tool.mts:1305-1352`) | `acme-verify.test.ts` already asserts the two existing constructions agree except for two DECLARED divergences (`acme-verify.test.ts:1017-1034`); a third construction would need its own agreement test or would silently drift |
| Hazard finding enumeration | A gate-local re-scan of the bytes for hazards | `buildHazardReport()` / `anno_hazard_report` (`anno-hazard-report.ts:1125`, `anno-tools.ts:1288`) | Phase 48's own governing constraint: the hazard report is read-only and the gate must consume it, never re-derive it |
| Decision-rule vocabulary | A bespoke ad hoc pass/fail flag | The `SCHEMA.md` + `DECISION-RULE.md` + YAML-frontmatter-findings-doc pattern from Phases 9/23/33/39 | This project has already solved "commit rules before measurement, produce a machine-readable verdict" four times; a fifth, different shape would be an unforced inconsistency |

**Key insight:** Nearly everything BUILD-06 needs already exists as tested, documented
machinery. The actual net-new work is: (a) a small, additive extension to
`acme-verify.ts` for tree/`cwd` support, (b) a movement-relocation step that has genuinely
no prior art in this codebase (see §8 below and Open Questions), (c) an acknowledgement
mechanism for hazard findings that also has no prior art (`HazardFinding` carries no stable
`id` field — see §4/§10), and (d) the gate script itself, which is orchestration, not new
verification logic.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase.

## Common Pitfalls

### Pitfall 1: Forgetting `cwd` for the tree assemble

**What goes wrong:** `!source "scope_0801.a"` (a bare filename, by Phase 47 design —
`anno-export-asm.ts`'s `exportAsmTree()` doc comment, "no directory component, no absolute
path, no host-machine path") fails to resolve unless ACME's own working directory is the
tree's directory.
**Why it happens:** `verifyAcmeAssembles()` as it exists today never sets `cwd`
(`acme-verify.ts:755-779`, confirmed by reading the full spawn options object) — it was
built when only single-file `source` strings existed.
**How to avoid:** The tree-aware extension MUST pass `cwd: outDir` to `spawnSync`, exactly
as `host-tool.mts:1351` already proves is load-bearing for the real `acme.build` op ("the
`cwd` fix is shown load-bearing rather than asserted: without it the same export fails to
resolve its own `!source` lines" — Phase 47 success criterion 1, ROADMAP.md:1084).
**Warning signs:** ACME reports "Cannot open input file" (quoted directly in `host-tool.mts:1287`'s doc comment) for a scope/unscoped `.a` file that visibly exists on disk in the output directory.

### Pitfall 2: Trusting a stale output path

**What goes wrong:** A gate reads yesterday's `.prg` and reports today's rebuild passed.
**Why it happens:** This is the EXACT recorded false-pass class `acme-verify.ts`'s own
header exists to prevent ("Never use a fixed output path across invocations... ACME leaves
a PRE-EXISTING output file completely untouched when it fails" — `acme-verify.ts:61-67`).
**How to avoid:** Fresh `mkdtempSync` per gate run (already the discipline
`verifyAcmeAssembles()` follows for its own single-file case), and the `absentBeforeSpawn`
check (`acme-verify.ts:753`, `854`) must extend to the tree case too — verify the tree's
target `.prg`/output artifact did not exist before this run's spawn.
**Warning signs:** A gate that passes even when ACME_BIN is pointed at `/bin/true` (the
exact paired control `acme-verify.test.ts:161-202` already exercises for the non-tree case)
— this is criterion 3's "stale-output-path scenario" RED control and should be planted the
same way.

### Pitfall 3: The `-v1` vs `-v2` argv mismatch silently disabling the unanimity rule

**What goes wrong:** If the gate's actual spawn goes through `host-tool.mts`'s
`buildHostToolArgv()` `acme.build` branch (which hardcodes `-v1`, `host-tool.mts:1327`) but
still tries to reuse `acme-verify.ts`'s `firstResultLineDisagreement()` (which expects
`-v2`'s per-segment lines, `acme-verify.ts:442-446`), the parsed `segmentLines` array will
always be empty regardless of what ACME actually did, and rule 4 will always report a count
disagreement (0 parsed vs N expected) — which happens to still be "failed", so this
particular defect fails SAFE rather than silently passing. But it means the gate can never
reach `"ok"` at all through that path, and a plan that discovers this late will misdiagnose
it as a bug in the tree rather than an argv mismatch.
**Why it happens:** Two independently-maintained ACME argv constructions exist by design
(`acme-verify.test.ts:886-897` documents this as a DELIBERATE, accepted divergence between
the test-only oracle and the real build driver) and they are not silently synced.
**How to avoid:** Keep the gate's real spawn on `acme-verify.ts`'s own `-v2` argv path
(extend it, don't route the byte-diff verdict's spawn through `host_tool`'s `-v1` path).
**Warning signs:** `AcmeVerifyResult.acmeResultLines` is always `[]`.

### Pitfall 4: Treating a `HazardFinding` as having a stable identity it doesn't have

**What goes wrong:** A per-finding acknowledgement scheme keyed on something that isn't
actually unique (or that silently matches the wrong finding after a re-export changes
ordering) either double-counts or silently drops an acknowledgement.
**Why it happens:** `HazardFinding` (`anno-hazard-report.ts:182-209`) has NO `id` field.
Its fields are `hazardClass`, `anchorAddress`, `blockedAddress`, `mechanism`, `strength`,
`detail`, `corroboration`. The closest thing to a stable identity is the TRIPLE
`(hazardClass, anchorAddress, mechanism)` — `anchorAddress` alone is not sufficient (a
single address could in principle carry findings under two different mechanisms), and
`findings` is returned as a plain array with no guaranteed stable ordering contract
documented anywhere read this session.
**How to avoid:** The planner should specify the acknowledgement identity as the
`(hazardClass, anchorAddress, mechanism)` triple explicitly, and the gate must FAIL (not
silently accept) if an acknowledgement's triple matches zero or more than one finding in
the current report.
**Warning signs:** An acknowledgement written against one export's finding set silently
"covers" a different finding after the store or the export changes.

### Pitfall 5: `npm test`'s full glob hangs

**What goes wrong:** Running `node --test '*.test.*'` directly (the raw `"test"` script,
`package.json:131`) can hang indefinitely.
**Why it happens:** `vice-proxy.test.ts` and other entries in `MANUAL_ONLY_TESTS`
(`test-gate.mjs:125-138`, 12 entries as of this session: `vice-broker-launch.test.ts`,
`vice-proxy.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`,
`stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`,
`stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`,
`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`) spawn real
long-lived processes and are excluded from the automated glob by design.
**How to avoid:** Use `npm run test:automated` (`package.json:132`, runs
`node test-gate.mjs`, which calls `automatedTestFiles()` — every `*.test.*` file MINUS the
12-member `MANUAL_ONLY_TESTS` set, `test-gate.mjs:143-146`), and redirect its output rather
than piping through `tail` (piping hides the real exit code — this project has an
independently recorded incident on exactly that mistake). Never run the bare `node --test
'*.test.*'` glob directly on this repo.
**Warning signs:** A test invocation that never returns within the expected time budget.

## Code Examples

### The tree-aware extension point (what the plan should modify)

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

### The multi-file tree the gate must reassemble (already shipped, Phase 47)

```typescript
// Source: src/mcp/vice/anno-export-asm.ts:2242-2245, 2387-2396 (exportAsmTree, real signature)
export function exportAsmTree(options: ExportAsmTreeOptions): ExportAsmTreeResult {
  const result = exportAsm(options);
  const { outDir } = options;
  // ... places every block into symbols.a / scope_XXXX.a / unscoped.a / *.bin,
  // then writes root.a LAST via a same-directory temp-name + renameSync.
  return { ...result, outDir, files, sourceOrder };
}
```

### The real `acme.build` host-tool call shape (if the planner routes the spawn this way)

```typescript
// Source: src/mcp/vice/host-tool.test.ts:499-595 (existing, real call sites)
const response = await runHostTool(
  { tool: "acme.build", args: { source: "a.a", includes: ["inc"], noReport: true } },
  { repoRoot: dir },
);
// response: { ok: true, tool: "acme.build", exitStatus, results: HostToolFileResult[], stderrTail }
// results[i]: { path: string; sha256: string; byteLength: number } -- NO raw bytes, NO stdout segment lines.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Exit-status-derived ACME verdict (the project's own recorded false pass) | Byte-diff-derived verdict via `verifyAcmeAssembles()` | Phase 30 (pre-dates this milestone) | This is exactly the discipline BUILD-06 must extend, not repeat the mistake of |
| Single-file-only export | Multi-file tree export (`exportAsmTree`) | Phase 47, completed 2026-09-12 | The gate's actual subject changed shape; a gate built only for the single-file case is already stale |
| No hazard report | `HazardReport` with three-outcome region disposition (`hazard-reported`/`no-signal`/`unclassified`) | Phase 48, completed 2026-09-13 | The gate's second input now exists and must be consumed read-only |

**Deprecated/outdated:** None specific to this phase; nothing here replaces prior Phase 49
work because none exists yet.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The tree-aware extension to `acme-verify.ts` should be a new option/sibling function rather than a breaking change to the existing `AcmeVerifyOptions` shape | Architecture Patterns, Pattern 1 | Low — this is a design recommendation, not a fact; the planner may choose differently as long as the five verdict rules are reused unchanged and a test refuses a second independent verify path |
| A2 | Routing the gate's real ACME spawn through `acme-verify.ts` (extended) rather than through `host-tool.mts`'s `acme.build` is the better choice | Summary, Anti-Patterns | Medium — if the planner instead extends `runHostTool()`'s response envelope to carry raw bytes/segment lines, that is also a valid design, but it is a wider, more invasive change touching a SHIPPED module (`host-tool.mts` compiles into `resources/host-tool.mjs`, which does ship) rather than a TEST-ONLY one |
| A3 | The acknowledgement identity for a hazard finding should be `(hazardClass, anchorAddress, mechanism)` | Common Pitfalls, Pitfall 4 | Medium — this is inferred from the available fields, not from any existing acknowledgement mechanism (none exists); the planner should treat this as a proposal requiring confirmation, not a locked decision |
| A4 | "Moving one half of a split hi/lo address table without the other" is best tested by relocating the underlying symbol's address and confirming the byte-diff at the new layout catches a construction where only one half's emission actually followed the symbol | Open Questions, §8 | Medium — no such planted-violation fixture exists yet in this codebase; this is a proposed test strategy, not an observed one |
| A5 | A new structural test (mirroring `spawn-seam.test.ts`) may be needed to make the "no fourth spawnSync site for ACME" discipline mechanically checked, since neither existing guard scans a new test-only `src/mcp/vice/*.test.ts` file for a raw ACME spawn | Architecture Patterns, Anti-Patterns | Low-Medium — if the planner instead relies on code review alone, the discipline is a documented convention rather than a checked property, consistent with how `acme-verify.ts` itself already sits outside every existing spawn-scanning guard today |

## Open Questions

1. **Which module actually executes the child process for the gate's real, trusted run: the extended `acme-verify.ts`, or `host-tool.mts`'s `acme.build`?**
   - What we know: both exist, are typed, and use the argv-array form. `acme-verify.ts` already has the full verdict machinery and the `-v2` argv the unanimity rule needs; `host-tool.mts`'s `acme.build` already has the `cwd` fix Phase 47 needed and is the real shipped executor everything else in the phase goes through, but its response is digest-only (no bytes, no stdout).
   - What's unclear: whether "the ACME invocation goes through the same typed `host_tool` op as everything else" (ROADMAP note) is meant literally (the gate must call `runHostTool()`) or is describing the EXISTING shipped surface's general discipline (never spawn ACME raw) which `acme-verify.ts` already satisfies on its own terms as a documented, accepted, test-only exception.
   - Recommendation: extend `acme-verify.ts` for the actual byte-diff spawn (matches "extends `acme-verify.ts`'s existing three-outcome oracle... rather than minting a second one" literally), and treat the ROADMAP note as satisfied by NOT adding a new raw `spawnSync`/`spawn` call anywhere else. Confirm this reading with the human owner during planning/discuss-phase, since it is a genuine two-way fork in the design and the ROADMAP text can support either reading.

2. **What does "movement" concretely mean as a per-run, non-optional gate step, and how is a relocated symbol represented?**
   - What we know: the store holds labels/symbols with addresses (`anno-store.ts`'s `setLabel`/label rows, used throughout `acme-verify.test.ts`'s own fixtures, e.g. `withStore(...)`'s `labels` parameter with `{ address, name }`); `exportAsmTree()` derives symbol definitions and block placement from the store's current state; nothing in the codebase today "relocates" a symbol as a first-class store operation for verification purposes — every existing test constructs a NEW store at a NEW address rather than moving an existing one in place.
   - What's unclear: whether "relocate a symbol" means (a) editing the store's own address/range rows and re-exporting, (b) hand-editing the generated `.a` tree text between export and reassemble, or (c) something else; and how the gate proves the two rebuilds (original layout, relocated layout) are testing the SAME underlying construction rather than two unrelated ones.
   - Recommendation: build the movement step as a store-level operation (re-run `exportAsmTree()` against a store whose label/range addresses were shifted by a fixed delta, or whose block `start` was moved) — this keeps the gate exercising the real Phase 47 export path rather than a hand-edited artifact, and mirrors how Phase 47's own `47-06-PLAN.md` frames the paired-symbol emission property (address-level, not text-level). This needs explicit confirmation at discuss-phase or plan time; it is not determinable from existing code because no such operation exists yet.

3. **Does `HazardReport.findings` carry a stable ordering across two calls against the same store/image?**
   - What we know: `findings: HazardFinding[]` is built by concatenating per-class detector outputs (`anno-hazard-report.ts:357-431` and onward) in a fixed class order (`HAZARD_CLASSES`, `anno-hazard-report.ts:133-138`).
   - What's unclear: whether within one class, finding order is deterministic (e.g. sorted by `anchorAddress`) — this session did not read every detector function's internal ordering logic given time constraints.
   - Recommendation: the acknowledgement matching scheme (A3 above) should match by the `(hazardClass, anchorAddress, mechanism)` triple rather than by array index, which is order-independent and therefore safe regardless of the answer to this question. NOT DETERMINED whether order is stable; treat it as irrelevant by construction rather than resolving it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ACME cross-assembler | The gate's real reassembly and byte-diff | Per `acme-gate.ts`'s own probe, gated by `ACME_AVAILABLE`/`SKIP_REASON` | 0.97 "Zem" (project's own verified baseline) | Every ACME-gated test in this repo already has a `{ skip: SKIP_REASON }` pattern; the gate's real-ACME tests should use the same pattern, and CI's own workflow sets `VICE_REQUIRE_ACME=1` (per `acme-verify.test.ts:25` header note) so a missing ACME hard-fails there rather than silently skipping |
| Node ≥ 24 | Running the gate as a `node --test` file | Yes (project baseline) | — | — |

**Missing dependencies with no fallback:** None beyond ACME itself, which is already
governed by the existing gate.

**Missing dependencies with fallback:** None beyond the existing `SKIP_REASON` pattern.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json:23` (not absent), so this
section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node:test`), no separate framework |
| Config file | none — `test-gate.mjs` (`src/mcp/vice/test-gate.mjs`) is the driver, not a config file |
| Quick run command | `cd src/mcp/vice && node --test acme-verify.test.ts anno-export-asm.test.ts anno-hazard-report.test.ts <new-gate-test-file>.test.ts` (scoped to the files this phase touches) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (NOT `npm test`, which hangs on the full unfiltered glob — see Common Pitfalls Pitfall 5) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-06 (criterion 1) | `DECISION-RULE.md`/`SCHEMA.md` committed before measurement; `git log` proves ordering | structural/manual (git history inspection) | `git log --diff-filter=A --format="%ad %h %s" -- .planning/phases/49-.../evidence/DECISION-RULE.md .planning/phases/49-.../evidence/49-*.md` (compare commit order) | ❌ Wave 0/1 — files don't exist yet |
| BUILD-06 (criterion 2) | Byte-diff verdict, no exit-status/aggregate/stale-path shortcut, extends `acme-verify.ts` | unit | `node --test acme-verify.test.ts` plus new tests in the same file or a sibling for the tree-aware entry point | ✅ existing file to extend; ❌ new tests, Wave 0 gap |
| BUILD-06 (criterion 3) | Gate observed RED on wrong-byte, stale-path, hazard-adjacent-range-excluded controls | unit (planted violation, mirroring `acme-verify.test.ts`'s MANDATORY RED pattern) | `node --test <new-gate-test-file>.test.ts` | ❌ Wave 0 gap — no such planted controls exist yet |
| BUILD-06 (criterion 4) | Movement exercised every run; split hi/lo half-moved-only is caught | unit + real ACME (`{ skip: SKIP_REASON }`) | `node --test <new-gate-test-file>.test.ts` | ❌ Wave 0 gap — no relocation mechanism exists yet (Open Question 2) |
| BUILD-06 (criterion 5) | Non-clean hazard report blocks or requires per-finding acknowledgement | unit | `node --test <new-gate-test-file>.test.ts` | ❌ Wave 0 gap — no acknowledgement mechanism exists yet |

### Sampling Rate

- **Per task commit:** the quick run command scoped to touched files.
- **Per wave merge:** `npm run test:automated`.
- **Phase gate:** Full suite green (`npm run test:automated`, exit code checked directly —
  never piped through `tail` or similar, per this project's own recorded incident on hiding
  exit codes) before `/gsd-verify-work`, AND the gate itself run for real, green or
  explicitly acknowledged, per the phase's own "Depends on" text for Phase 50.

### Wave 0 Gaps

- [ ] `.planning/phases/49-.../evidence/SCHEMA.md` — outcome-line vocabulary + findings-doc frontmatter shape, committed FIRST
- [ ] `.planning/phases/49-.../evidence/DECISION-RULE.md` — the R1..Rn rule table, committed alongside SCHEMA.md, BEFORE any measurement
- [ ] A tree-aware extension to `acme-verify.ts` (or a clearly justified sibling function) with its own unit tests
- [ ] A new gate test file (name TBD by the planner) with the three planted RED controls from criterion 3
- [ ] A movement/relocation mechanism and its own tests (genuinely new — no prior art, see Open Question 2)
- [ ] A hazard-finding acknowledgement mechanism and its own tests (genuinely new — no prior art, see Pitfall 4 / A3)
- [ ] `docs/phase49-the-reassembly-gate-findings.md` — the committed, machine-readable verdict artifact Phase 50 reads

## Security Domain

`security_enforcement` is `true` in `.planning/config.json:49` (not absent), so this section
is required, though this phase is CI/dev-time tooling with no network-facing surface, no
user input, and no shipped runtime behavior.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface — this is a local dev/CI gate |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No access boundary crossed beyond the existing workspace-confinement seams (`resolveWorkspacePath()`, already used by `host-tool.mts` if that path is chosen) |
| V5 Input Validation | yes (narrow) | The gate script's own inputs (store path, image path, output directory) should be confined the same way every other `anno_*`/`host_tool` consumer already is — reuse `resolveWorkspacePath()`/`storePathWithinWorkspace()`-style confinement rather than accepting an arbitrary path |
| V6 Cryptography | n/a | `sha256` appears only as `host-tool.mts`'s existing digest field for `HostToolFileResult`, not introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via ACME argv | Tampering | Already mitigated: `acme-verify.ts` and `host-tool.mts` both use the argv-array `spawnSync`/`spawn` form, never a shell string (`T-30-01`, and `host-tool.mts`'s own header). The gate must not introduce a new spawn call in any other form. |
| Path traversal via a caller-supplied `outDir`/store path | Tampering/Information Disclosure | Reuse `resolveWorkspacePath()` (`host-tool.mts:1123`) or the store's own workspace-confinement discipline; do not accept an unconfined path in the gate script's own CLI/test surface |
| A stale artifact silently read as fresh evidence | Tampering (of the verdict itself) | This IS Pitfall 2 above — fresh-mkdtemp-per-run plus absent-before-spawn is the mitigation, already proven in `acme-verify.ts` |

## Sources

### Primary (HIGH confidence — read directly this session)

- `src/mcp/vice/acme-verify.ts` (full file, 884 lines) — the oracle to extend
- `src/mcp/vice/acme-verify.test.ts` (partial, ~1057 of 1686 lines) — its existing test coverage and the argv-agreement discipline
- `src/mcp/vice/anno-export-asm.ts` (targeted reads: interfaces at lines 157-350, `exportAsmTree()` at 2148-2396) — the multi-file export contract
- `src/mcp/vice/anno-hazard-report.ts` (targeted reads: lines 125-431) — the `HazardReport`/`HazardFinding` shape
- `src/mcp/vice/host-tool.mts` (targeted reads: lines 1300-1400, 1820-1890, 2151-2170) — the `acme.build` op, its response envelope, and the async `spawn()` executor
- `src/mcp/vice/host-tool.test.ts` (targeted reads: lines 499-595) — real `runHostTool({ tool: "acme.build", ... })` call shapes
- `src/mcp/vice/spawn-seam.test.ts` (full file) — the emulator-only spawn-site guard and its shipped-module scope
- `src/mcp/vice/shipped-modules.ts` (targeted reads: `shippedTsModules()`, lines 151-162) — proof of what is/isn't in the scanned set
- `scripts/check-no-skill-external-spawn.mjs` (full file) — its skills-only scope and banned command list
- `src/mcp/vice/acme-gate.ts` (full file, 90 lines) — `ACME_BIN`/`probeAcme()`/`ACME_AVAILABLE`
- `src/mcp/vice/package.json` (`files[]` array) — confirms `acme-verify.ts`, `acme-gate.ts`, `host-tool.mts` are all absent as literal entries; `anno-export-asm.ts` and `anno-hazard-report.ts` are present
- `src/mcp/vice/test-gate.mjs` (targeted reads: `MANUAL_ONLY_TESTS`, lines 125-146)
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/SCHEMA.md` and `DECISION-RULE.md` (full/partial reads) — the precedent gate-documentation pattern
- `docs/phase39-dual-channel-coexistence-gate-findings.md` (partial read) — the findings-document shape
- `.planning/phases/47-multi-file-rebuildable-source/47-06-PLAN.md` (partial read) — split hi/lo address-table paired-symbol emission
- `.planning/ROADMAP.md` (Phases 46-51 sections) — the phase's own goal/criteria/notes text
- `.planning/REQUIREMENTS.md` (BUILD-* rows) and `.planning/STATE.md` — project decisions and current position
- `git log --diff-filter=A` against Phase 39's evidence files — verified the "committed before measurement" ordering claim directly, not merely asserted from prose

### Secondary (MEDIUM confidence)

- None beyond the above — this research relied entirely on direct source reads rather than web search, since the domain is 100% internal to this repository.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, pure internal composition, every claim traced to a read file
- Architecture: HIGH for existing machinery (Phases 47/48/acme-verify/host-tool all read directly); MEDIUM for the gate script's own design (a genuine open design decision, flagged as such)
- Pitfalls: HIGH — every pitfall cites a specific line range read this session, or a directly-run `git log` command
- Movement mechanism (criterion 4) and hazard acknowledgement (criterion 5): LOW/ASSUMED — explicitly flagged as having no prior art; treat as a discuss-phase or planning-time decision point, not a locked design

**Research date:** 2026-09-13
**Valid until:** 30 days (stable internal codebase; the main risk of staleness is if Phase 47/48's modules are modified by an intervening phase, which should not happen given the dependency ordering)
