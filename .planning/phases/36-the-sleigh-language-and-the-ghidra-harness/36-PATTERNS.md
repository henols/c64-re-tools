# Phase 36: The SLEIGH Language and the Ghidra Harness - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 12 (new/modified)
**Analogs found:** 10 / 12 (2 have no internal analog — external Ghidra reference named instead)

All analog paths below were verified with `git ls-files` — every one is git-tracked source
(none are `.gsd/`-mirrored or otherwise gitignored install copies).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/mcp/vice/host-tool.mts` (extend `GhidraAnalyzeArgs`, `HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`, the `ghidra.analyze` validation branch) | middleware (typed allowlist / request normaliser) | request-response | same file's existing `dxa.disassemble` branch (added Phase 35) | exact — same file, same seam, worked precedent for adding fields |
| `src/mcp/vice/ghidra-project.mts` (extend `buildAnalyzeHeadlessArgv()`) | utility (argv builder) | transform | same function, current 9-line body (below) | exact — extend in place |
| `src/mcp/vice/ghidra-run.ts` (NEW) | service (container-side orchestrator) | request-response | `src/mcp/vice/dxa-run.ts` | exact — RESEARCH.md names this explicitly as the shape to mirror |
| `src/mcp/vice/sleigh-compile-gate.test.ts` (NEW) | test (hermetic build gate) | batch | `src/mcp/vice/dxa-build-gate.test.ts` | role-match — same hermetic-scratch-tree discipline, **different pass/fail signal** (mtime+exit0+artifact, not digest) |
| `src/mcp/vice/ghidra-harness-gates.test.ts` (NEW) | test (hermetic string-logic gate) | transform | `src/mcp/vice/dxa-listing.ts` + its test (classification/grep logic) — no single strong analog; closest shape is `dxa-build-gate.test.ts`'s structural (non-live) cases | partial |
| A new live-Ghidra suite, e.g. `src/mcp/vice/ghidra-live.test.ts` (NEW, name set by planner) | test (manual-only, opt-in live integration) | event-driven / request-response | `src/mcp/vice/dxa-live.test.ts` | exact — env-var opt-in, default-SKIP, `{ skip }` option pattern |
| `src/mcp/vice/test-gate.mjs` (extend `MANUAL_ONLY_TESTS`) | config (manual-test disposition list) | — | same file, existing array + header-comment convention (10th entry added by Phase 35) | exact — extend in place, 11th entry |
| `src/mcp/vice/test-gate.test.ts` (extend "exactly ten" assertion) | test (drift guard) | — | same file's existing assertion | exact — extend in place |
| `.github/workflows/ci.yml` (new step for the new live-Ghidra test file / gate files) | config (CI) | — | existing `dxa-live.test.ts`/`dxa-build-gate.test.ts` steps in the same workflow | exact — mirror the existing step shape |
| `src/mcp/vice/vendor/ghidra-ext/**` (`.ldefs`, `.slaspec`, `.sinc`, copied `.pspec`/`.cspec`, `Module.manifest`, `extension.properties`) | config / vendored source (SLEIGH language extension) | file-I/O | none in this repo — external reference: stock Ghidra 6502 module at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/Ghidra/Processors/6502/data/languages/{6502.ldefs,6502.slaspec,6502.pspec,6502.cspec}`; in-repo committed content precedent is `docs/undocumented-opcodes-ghidra.md` (the `.sinc` source to fix, not copy) | no internal analog |
| `src/mcp/vice/vendor/ghidra-scripts/{GhidraStructExport.java, VolatileCarve.java}` (renamed-on-promotion successors to Phase 23's evidence scripts) | service (host-bound JVM pre/post scripts) | event-driven | `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/{FlatVolatile.java,ExportAnalysis23.java}` (direct ancestors — promote, rename, do not rewrite from scratch) | exact — direct ancestor within this repo |
| `.gitignore` (new entries for the built `.sla` and any per-run Ghidra extension materialisation) | config | — | existing `tools/ghidra-runs/` and `/src/mcp/vice/vendor/dxa/dxa` entries (lines 18-28, 142-143) | exact — same file, same convention |

## Pattern Assignments

### `src/mcp/vice/host-tool.mts` (middleware, request-response)

**Analog:** same file's own `dxa.disassemble` addition (Phase 35) and the current `ghidra.analyze` branch.

**Current shape, VERIFIED this session** (`host-tool.mts:211-217`):
```typescript
export interface GhidraAnalyzeArgs {
  runId: string;
  importPath: string;
  preScript?: string;
  postScript?: string;
}
```

**Allowlist entries to extend** (`host-tool.mts:156`, `:192`):
```typescript
"ghidra.analyze": Object.freeze(["runId", "importPath", "preScript", "postScript"]),
// ... (HOST_TOOL_PATH_ARG_KEYS, line 192):
"ghidra.analyze": Object.freeze(["importPath", "preScript", "postScript"]),
```
Both arrays gain the new keys (`processor`, `loader`, `loaderBaseAddr`, `scriptPath`,
`noanalysis`, `preScriptArgs`, `postScriptArgs`) — `scriptPath` also joins the
PATH_ARG_KEYS array since it is workspace-relative and must route through
`resolveWorkspacePath()`; `processor`/`loader`/`loaderBaseAddr`/`noanalysis` do NOT
(they are typed/pattern-validated strings or booleans, never paths).

**Validation branch to extend** (`host-tool.mts:370-393`, the `if (tool === "ghidra.analyze")`
block) — each existing field follows this shape; copy it per new field:
```typescript
if (tool === "ghidra.analyze") {
  const runIdRaw = args.runId;
  if (typeof runIdRaw !== "string" || runIdRaw === "") {
    return { ok: false, message: `host_tool "ghidra.analyze" requires a non-empty string "runId"; got ${describe(runIdRaw)}` };
  }
  // importPath, preScript, postScript follow the same non-empty-string-or-absent shape
}
```
A new `processor` field must be validated against an anchored pattern (mirroring
`RUN_ID_PATTERN`, `ghidra-project.mts:87`: `/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/`) — it becomes
a literal argv token, not merely "any string." `noanalysis` is a `boolean`, validated with
`typeof value !== "boolean"`, not the string checks the others use.

### `src/mcp/vice/ghidra-project.mts` (utility, transform)

**Analog:** `buildAnalyzeHeadlessArgv()` itself, `ghidra-project.mts:263-336`, VERIFIED this
session (line numbers current, matching RESEARCH.md's `263-335` citation to within one line).

**Current body to extend:**
```typescript
export function buildAnalyzeHeadlessArgv(input: unknown): BuildAnalyzeHeadlessArgvResult {
  // ... unknown-key check against BUILD_ANALYZE_HEADLESS_ARGV_KEYS ...
  const { projectLocation, projectName, importPath, preScript, postScript } = input;
  // ... non-empty-string checks per field ...
  // ... dot-segment / parent-segment refusals (T-34-14, CR-02) ...
  const argv: string[] = [projectLocation as string, projectName as string, "-import", importPath as string, "-deleteProject"];
  if (typeof preScript === "string") argv.push("-preScript", preScript);
  if (typeof postScript === "string") argv.push("-postScript", postScript);
  return { ok: true, argv };
}
```
**Pattern to replicate for each new field:** destructure it alongside the existing five,
validate with the same `typeof value !== "string" || value === ""` shape (or boolean check for
`noanalysis`), then push typed, individually-validated array entries — **never
string-concatenate into an existing argv entry** (Standing Constraint / RESEARCH.md's Argv
injection threat pattern). Order per the MEASURED invocation shape (`docs/phase23-...
findings.md:1107-1129`, quoted in RESEARCH.md): `-processor <id> -loader BinaryLoader
-loader-baseAddr <addr> -noanalysis -scriptPath <dir> -preScript <name> <preScriptArgs...>
-postScript <name> <postScriptArgs...> -deleteProject` — note `-deleteProject` stays last in
the emitted argv, matching current behavior; the RESEARCH.md sample invocation's trailing
`-deleteProject` position is illustrative of the flags being present, not of final argv order,
so keep this function's existing "last" placement of `-deleteProject` unless the executor's own
task decides otherwise.

**BUILD_ANALYZE_HEADLESS_ARGV_KEYS / BUILD_ANALYZE_HEADLESS_ARGV_SHAPE** (referenced but not
shown above — grep for these two names near the top of the function's module scope before
editing; extend both alongside the destructure) must gain the new keys in the same edit or the
new fields are silently rejected by the unknown-key check at the top of the function.

---

### `src/mcp/vice/ghidra-run.ts` (NEW; service, request-response)

**Analog:** `src/mcp/vice/dxa-run.ts:1-60+` (full header comment block quoted; VERIFIED
tracked and current).

**Header rule to copy verbatim in spirit** (`dxa-run.ts:1-19`):
```typescript
// Phase 35, plan 35-01 (DXA-02): CONTAINER-SIDE orchestration ONLY for the
// `dxa.disassemble` host tool. Reaches dxa through
// `runHostToolFromContainer("dxa.disassemble", …)` (host-tool-client.ts) and
// NEVER `node:child_process` -- SEAM-05's `BANNED_COMMAND_SHAPES` already
// names `dxa`, so a direct spawn here is a caught violation, not an
// invisible one.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` ...
```
`ghidra-run.ts` must carry the equivalent header naming `ghidra.analyze` (not `dxa`) as the
tool id, and the identical "never `node:child_process`, never `hostpath.ts`" rule.

**Import pattern** (`dxa-run.ts:34-40`):
```typescript
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, sep, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { runHostToolFromContainer, type HostToolClientResult, type RunHostToolFromContainerOptions } from "./host-tool-client.ts";
import { repoRoot } from "./repo-root.ts";
```
`ghidra-run.ts` swaps the `dxa-listing.ts`/`prg-image.ts`/`dxa-blocks.ts` imports for whatever
its own export-format reader needs (none yet exist — this phase stops at "the export exists and
is proven correct," per RESEARCH.md's Architectural Responsibility Map), but keeps the
`host-tool-client.ts` + `repo-root.ts` pair as-is.

**Wire-request interface pattern** (`dxa-run.ts:48-58`, the `DxaRunArgs` shape) — mirror as
`GhidraRunArgs` field-for-field against the extended `GhidraAnalyzeArgs` in `host-tool.mts`:
```typescript
export interface DxaRunArgs {
  image: string;
  imageKind: "prg" | "flat64k";
  entrypointsPath?: string;
  datablocksPath?: string;
  labelsPath?: string;
  outDir?: string;
  // ...
}
```

---

### `src/mcp/vice/sleigh-compile-gate.test.ts` (NEW; test, batch)

**Analog:** `src/mcp/vice/dxa-build-gate.test.ts` (full file read; VERIFIED tracked).

**Copy this discipline** (`dxa-build-gate.test.ts:1-30`, `makeScratchTree()`):
```typescript
interface ScratchTree {
  root: string;
  dir: string;
  cacheDir: string;
}
function makeScratchTree(): ScratchTree {
  const root = mkdtempSync(join(tmpdir(), "dxa-build-gate-test-"));
  const dir = join(root, "vendor-dxa-copy");
  cpSync(VENDOR_DIR, dir, { recursive: true });
  const cacheDir = join(root, "scratch-cache");
  mkdirSync(cacheDir, { recursive: true });
  return { root, dir, cacheDir };
}
function removeScratchTree(tree: ScratchTree): void {
  rmSync(tree.root, { recursive: true, force: true });
}
```
Rename `VENDOR_DIR` to point at `vendor/ghidra-ext/`; copy the whole extension source tree
into a scratch dir per test, run `support/sleigh <name>.slaspec <name>.sla` there (never in
the committed tree), then tear down with `removeScratchTree()`.

**DO NOT copy this part** — the digest-based pass/fail signal
(`dxa-build-gate.test.ts`'s "built binary sha256 does not match the pinned digest" test, the
`createHash("sha256")` comparison). Per RESEARCH.md's Common Pitfalls ("A failed `sleigh`
compile leaves the stock `.sla` in place") and VALIDATION.md, the correct gate is:
1. `spawnSync` exit code `=== 0`
2. the `.sla` file exists on disk after the run
3. the `.sla`'s mtime is strictly newer than every input file's mtime (the `.slaspec`, every
   `@include`d `.sinc`, and the copied `6502.pspec`/`6502.cspec`)

Also copy the **planted-violation** pattern from the same file's structural test (revert one
sized-local fix and assert the exact `Could not resolve at least 1 variable size` compiler
message) — mirrors `dxa-build-gate.test.ts`'s "wrong bytes still refused" case in spirit (prove
the gate actually gates, not merely that a green run exists).

---

### A new live-Ghidra suite, e.g. `ghidra-live.test.ts` (NEW; test, event-driven)

**Analog:** `src/mcp/vice/dxa-live.test.ts` (header read in full; VERIFIED tracked).

**Header/opt-in pattern to copy** (`dxa-live.test.ts:1-30`):
```typescript
// OPT-IN, MANUAL-ONLY. Drives ... against a REAL ... -- the one path
// this repository's automated suite (`npm run test:automated`) never
// exercises ...
//
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file via `*.test.*`, and
// CI has no built dxa binary. SKIP_REASON is computed once, and EVERY test
// in this file passes it through node:test's own `{ skip }` option -- never
// a hand-rolled early return, which would report a false PASS rather than a
// SKIP. It is registered in test-gate.mjs's MANUAL_ONLY_TESTS ...
//
// Opt in with:
//   VICE_LIVE_DXA=1 node --test dxa-live.test.ts
```
The new file's opt-in var per RESEARCH/VALIDATION should follow the same `VICE_LIVE_<NAME>`
convention (e.g. `VICE_LIVE_GHIDRA=1`), computed once as `SKIP_REASON`, and every `test(...)`
call passes `{ skip: SKIP_REASON }` — never a hand-rolled early `return`.

**Import pattern** (`dxa-live.test.ts:38-48`):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runDxaDisassemble, type DxaRunFn } from "./dxa-run.ts";
```
Swap `dxa-run.ts`'s `runDxaDisassemble` import for `ghidra-run.ts`'s equivalent orchestration
entry point.

**Corpus-gating pattern** (`dxa-live.test.ts`'s header, "the CORPUS case ... is gated behind
its OWN opt-in, `VICE_LIVE_DXA_CORPUS=1`, in addition to `VICE_LIVE_DXA=1`") — directly
applicable to `OPC-03`/`GHID-04`'s `danish.d64` corpus requirement: gate those cases behind a
second, narrower env var stacked on top of the file-level one.

---

### `src/mcp/vice/test-gate.mjs` (config, extend in place)

**Analog:** the file's own existing convention — every prior addition follows the identical
three-part pattern: (1) a dated header-comment paragraph naming the phase/plan and why the file
is manual-only, (2) one line added to the `MANUAL_ONLY_TESTS` array, (3) nothing else changes.

**Current tail of the array** (`test-gate.mjs`, VERIFIED):
```javascript
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-live-triage.test.ts",
  "stock-live-broker-monitor.test.ts",
  "stock-broker-live.test.ts",
  "fork-live.test.ts",
  "stock-a4-checkpoint-flood.test.ts",
  "dxa-live.test.ts",
]);
```
Add the eleventh entry (the new live-Ghidra suite's filename) plus a new dated header paragraph
following the exact style of the "This section's TENTH entry (Phase 35, plan 35-01,
DXA-01/DXA-02) covers dxa-live.test.ts: ..." paragraph immediately above the array.

### `src/mcp/vice/test-gate.test.ts` (test, extend in place)

**Analog:** the file's own existing "contains exactly the ten dispositioned files" assertion
(VALIDATION.md cites `test-gate.test.ts:16-30`). Both the count word ("ten" → "eleven") and the
array-length/contents assertion must change in the **same commit** as the `test-gate.mjs`
array edit — this is VALIDATION.md's explicit "Placement guard."

---

### `.github/workflows/ci.yml` (config)

**Analog:** the existing steps that already run `dxa-build-gate.test.ts` and reference
`dxa-live.test.ts`'s exclusion from `test:automated`. `ci-suite-coverage.test.ts` asserts a
committed test file has a matching CI step added in the same commit — copy whichever existing
step shape covers `sleigh-compile-gate.test.ts` (hermetic, runs in the automated CI step
already, needs no new step) versus the new live-Ghidra suite (needs no CI step at all, since it
is manual-only and CI has no Ghidra provisioning — RESEARCH.md's Environment Availability
table). Verify via `grep -n "dxa" .github/workflows/ci.yml` before editing which of the two
treatments applies to each new file.

---

### `src/mcp/vice/vendor/ghidra-ext/**` (NEW; config/vendored source, file-I/O)

**No internal analog** — this repo has no prior SLEIGH source tree. External reference,
READ-IN-SOURCE this session per RESEARCH.md:
`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/Ghidra/Processors/6502/data/languages/`:
- `6502.ldefs` — the `.ldefs` shape to add a **new** `<language>` element to (never edit the
  stock file; author a new one under `vendor/ghidra-ext/data/languages/`)
- `6502.pspec`, `6502.cspec` — copy unmodified into the vendored tree
- `6502.slaspec` — the `@include` target for the new `.slaspec`'s first line

**In-repo precedent for the fix content itself:** `docs/undocumented-opcodes-ghidra.md` (the
8-constructor sized-local fix table, RESEARCH.md § "Code Examples" — this is the committed
source to correct, not an example to copy from elsewhere).

**Closest in-repo *packaging* precedent** (vendor-then-build discipline, not SLEIGH content):
`src/mcp/vice/vendor/dxa/build.bash` and its `.gitignore` treatment (`/src/mcp/vice/vendor/dxa/dxa`
and `/src/mcp/vice/vendor/dxa/*.o` ignored, source committed) — the `.sla` gets the equivalent
`.gitignore` entry, the `.slaspec`/`.sinc`/`.ldefs`/`.pspec`/`.cspec` do not.

---

### `src/mcp/vice/vendor/ghidra-scripts/{GhidraStructExport.java, VolatileCarve.java}` (NEW; service, event-driven)

**Analog:** direct ancestors, both tracked and read in full this session:
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/FlatVolatile.java` →
promote/rename to `VolatileCarve.java`; `.../evidence/ExportAnalysis23.java` → promote/rename to
`GhidraStructExport.java` (or planner's chosen non-phase-numbered name).

**Split-first pattern to preserve verbatim** (`FlatVolatile.java:81-125` region, quoted in
RESEARCH.md):
```java
private static final long[] SPLIT_AT = { 0x0002L, 0xd000L, 0xe000L };
private static final long[][] VOLATILE_RANGES = {
    { 0x0000L, 0x0002L },   // 6510 processor port
    { 0xd000L, 0x1000L },   // VIC-II / SID / colour RAM / CIA / expansion
};
// carve(): mem.split(blk, addr) at each SPLIT_AT boundary FIRST, THEN
// makeVolatile(): mem.getBlock(addr) -- if non-null, setVolatile(true) on
// the EXISTING (now-carved) block; if null, createUninitializedBlock(...,
// volatile=true). Both routes share ONE script -- branches on getBlock(),
// never on a caller-passed route flag.
```

**`DecompInterface` pattern to extend** (`ExportAnalysis23.java`'s `## REFERENCES` section,
`rf.getReferenceType()` at line ~122-123 per RESEARCH.md citation) plus the new
`DecompileResults.isTimedOut()` / `decompileCompleted()` accounting named in RESEARCH.md's
"Code Examples" section (VERIFIED via `javap -p` against the real 12.1.3 jars this session,
not re-verified independently here — trust RESEARCH.md's class-signature citation).

**Naming guard (load-bearing):** VALIDATION.md's "Naming guard" — `docs-dangling-refs.test.ts`'s
FLOW-02 state machine scans shipped **TypeScript** string literals for phase numbers; the moment
`ghidra-run.ts` (a shipped `.ts` module) contains a string literal naming
`"ExportAnalysis23.java"` as a `-postScript` argument, THAT literal trips the guard. Confirmed
tracked: `src/mcp/vice/docs-dangling-refs.test.ts`. Name the promoted files for function, never
phase number, from the start.

---

## Shared Patterns

### Typed allowlist / unknown-key refusal
**Source:** `src/mcp/vice/host-tool.mts:139-217` (`HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`,
`GhidraAnalyzeArgs`) and `ghidra-project.mts`'s `BUILD_ANALYZE_HEADLESS_ARGV_KEYS` unknown-key
check (`ghidra-project.mts:263-273`).
**Apply to:** every new `ghidra.analyze` field, both `host-tool.mts` and `ghidra-project.mts` —
each is a "seven-synchronized-edit" (RESEARCH.md's own phrase) that must land together: the
interface field, both allowlist arrays, the validation branch, the workspace-path routing (if
path-shaped), the argv builder's destructure, the argv builder's own unknown-key array, and the
argv builder's push logic.

### Never `node:child_process` outside the host-tool seam
**Source:** `src/mcp/vice/dxa-run.ts:4-19` header comment; `SEAM-05`'s `BANNED_COMMAND_SHAPES`.
**Apply to:** `ghidra-run.ts` and any container-side test helper — always
`runHostToolFromContainer(...)` via `host-tool-client.ts`, never a direct spawn.

### Never import `hostpath.ts` from a container-side orchestrator
**Source:** `dxa-run.ts` header ("THIS MODULE MUST NEVER IMPORT `hostpath.ts`...") and
`hostpath-consumers.test.ts`'s closed consumer set (Standing Constraint / `HOST_TOOL_FAMILY_FLOOR`).
**Apply to:** `ghidra-run.ts` — the response path is already `containerPath()`-translated by
`runHostToolFromContainer()` before `ghidra-run.ts` ever sees it. Check whether adding
`ghidra-run.ts` moves `HOST_TOOL_FAMILY_FLOOR` (Phase 35 had to raise it in the same commit as
`dxa-run.ts`) — grep `hostpath-consumers.test.ts` for the constant before finalizing the plan.

### Workspace-path confinement for every new path-bearing wire field
**Source:** `resolveWorkspacePath()`, `host-tool.mts:647-670` (full body quoted above).
**Apply to:** `scriptPath` (new) exactly as `preScript`/`postScript`/`importPath` already are —
never a second hand-rolled `path.resolve()`+`startsWith()` check (RESEARCH.md's "Don't
Hand-Roll" table names this explicitly).

### Argv stays an array, never a shell string
**Source:** `host-tool.mts:1002-1004`'s documented invariant (cited in RESEARCH.md); enforced
structurally by `buildAnalyzeHeadlessArgv()`'s return type (`{ ok: true; argv: string[] }`).
**Apply to:** every new field pushed in `ghidra-project.mts`'s argv builder — `argv.push(flag,
value)` as separate array entries, never `argv.push(`${flag} ${value}`)`.

### Manual-only test disposition (three-part edit)
**Source:** `test-gate.mjs`'s header-comment convention + `MANUAL_ONLY_TESTS` array +
`test-gate.test.ts`'s "exactly N" assertion, all three edited together historically (Phase 35's
`dxa-live.test.ts` addition is the most recent worked example).
**Apply to:** the new live-Ghidra suite file — same three edits, same commit
(VALIDATION.md's "Placement guard").

### mtime-based build-freshness gate (NOT digest)
**Source:** RESEARCH.md's own explicit correction — `dxa-build-gate.test.ts`'s digest discipline
does NOT transfer; the `sleigh` gate needs exit-0 + artifact-present + mtime-newer-than-every-input.
**Apply to:** `sleigh-compile-gate.test.ts` only. Do not import or adapt
`dxa-build-gate.test.ts`'s `createHash("sha256")` comparison logic for this gate.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/mcp/vice/vendor/ghidra-ext/data/languages/*.ldefs`, `*.slaspec`, `*.sinc` | config/vendored source | file-I/O | No SLEIGH source exists anywhere in this repo today. External reference: stock Ghidra 6502 module at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/Ghidra/Processors/6502/data/languages/` (READ-IN-SOURCE this session, per RESEARCH.md). The FIX content (sized-locals) is committed in-repo at `docs/undocumented-opcodes-ghidra.md` and should be corrected there / carried into the new `.sinc`, not re-derived. |
| `src/mcp/vice/vendor/ghidra-ext/Module.manifest`, `extension.properties`, `data/sleighArgs.txt` | config | file-I/O | No extension-module packaging exists in this repo. External reference: the stock 6502 module's own `Module.manifest` (measured empty, RESEARCH.md § "The minimum extension-module file set") — copy its emptiness convention, not its content (no analog to read). |

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts`, `src/mcp/vice/*.test.ts`,
`src/mcp/vice/vendor/dxa/`, `.planning/phases/23-*/evidence/`, `.github/workflows/ci.yml`,
`.gitignore`, plus the external Ghidra 12.1.3 probe install for SLEIGH-source-shaped files with
no in-repo analog.
**Files scanned:** 15 read/grepped directly this session (all confirmed git-tracked via
`git ls-files`); 2 additional external (non-repo) reference files inspected per RESEARCH.md's
own prior-session findings, not re-read here.
**Pattern extraction date:** 2026-09-04
