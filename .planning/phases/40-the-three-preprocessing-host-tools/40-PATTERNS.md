# Phase 40: The Three Preprocessing Host Tools - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 20 (new + modified, excluding pure path-migration mechanical edits)
**Analogs found:** 20 / 20

**Scope correction honoured:** `cartconv`/`PREP-03` are OUT OF SCOPE
(CONTEXT.md D-30/D-31/D-32, confirmed in RESEARCH.md). No file below maps
`cartconv.*`, per-bank images, or cartridge work. `PREP-03`'s only remaining
work is a REQUIREMENTS.md/ROADMAP.md bookkeeping edit — no source pattern
needed for it.

All analog paths below were verified this session with `git ls-files --
<path>` (non-empty output = tracked) and line numbers were re-read directly
from the working tree, not carried from RESEARCH.md without re-verification.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/host-tool.mts` (six new `buildHostToolArgv()` branches: `c1541.bam`/`c1541.dir`/`c1541.entry`/`c1541.chain`/`c1541.read`/`petcat.decode`) | controller (typed-request dispatcher) | request-response | `dxa.disassemble` branch, same file, `:1206-1245` | exact |
| `src/mcp/vice/host-tool.mts` (six new `HostToolId` union members, `HOST_TOOL_IDS` entries) | config/type | — | `dxa.disassemble` at `:139-146` | exact |
| `src/mcp/vice/host-tool.mts` (six new `HOST_TOOL_ARG_KEYS` / `HOST_TOOL_PATH_ARG_KEYS` entries) | config | request-response | `dxa.disassemble` entries at `:217`, `:268` | exact |
| `src/mcp/vice/host-tool.mts` (six new `HOST_TOOL_TIMEOUT_MS` entries) | config | — | existing table, cited by `host-tool.test.ts:2033-2039`'s completeness assertion | exact |
| `src/mcp/vice/host-tool.mts` (six new narrowing arms in `runHostTool()`'s resolved-paths switch) | controller | request-response | `dxa.disassemble` arm at `:1706` | exact |
| `src/mcp/vice/host-tool.mts` (output-is-stdout condition, extended for the five `c1541`/`petcat` read verbs) | transform | file-I/O | `dxa.disassemble` digest condition at `:1869` | exact |
| `src/mcp/vice/host-tool.mts` (six new positive-shape classifier functions) | utility (pure classifier) | transform | new pattern — no existing classifier function in this file today; nearest precedent is the never-consult-exit-status DISCIPLINE already at `:1869` (dxa) and `host-tool.test.ts`'s existing oracle test posture | role-match (new capability, established discipline) |
| `src/mcp/vice/host-tool.mts` (`findSiblingBinary()` for `c1541`/`petcat`) | utility | file-I/O | `findDxaBinary()` candidate-list pattern (cited near `:1213`); `backend-detect.mts`'s `HELP_FLAG_CANDIDATES` ladder, `:105-154` (not read directly this session's excerpt but present per RESEARCH.md, corroborated by `binPath`/`binPathResolved` at `:358-366` below) | role-match |
| `src/mcp/vice/host-tool.mts` (`WR-03`: guard `runOracleRun()`'s `mkdirSync` inside its own `try`; add `.catch()` to CLI entry point) | error-handling fix | request-response | `host-tool-client.ts`'s already-correct `.catch()` shape, `:419-427` | exact |
| `src/mcp/vice/host-tool.test.ts` (census/timeout/path-key entries for six new ids; update pinned `17` total) | test | CRUD (assertion over static tables) | Existing `dxa.disassemble` census rows and the pinned-total assertions at `:1915`, `:1949` | exact |
| `src/mcp/vice/host-tool.test.ts` (two new integration tests: `c1541.*`/`petcat.decode` live-oracle happy path) | test | request-response (spawns real binary) | Existing `dxa.disassemble` live-oracle test in the same file (pattern, not a single cited range — same file's existing convention) | exact |
| `src/mcp/vice/host-tool.test.ts` (six new PREP-04 two-directional non-vacuous-control tests) | test | transform (classify text) | `D-12`'s own stated precedent: "the project's existing two-directional guard convention (test-gate's union, the deferred ledger, the resources sync)" — no single file is the template; write fresh per `host-tool.mts`'s new classifiers | no close analog (new capability) |
| `src/skills/c64-disk-access/SKILL.md` (new skill) | config/doc | — | `src/skills/acme-build/SKILL.md` frontmatter shape; `src/skills/c64-ram-capture/SKILL.md` (sibling `.d64`-adjacent skill being re-cut in the same phase) | role-match |
| `src/skills/c64-disk-access/scripts/c1541.mjs` (new script, one per binary per D-18) | component (skill script) | request-response | `src/skills/acme-build/scripts/acme.mjs`, `:1-95` | exact |
| `src/skills/c64-petcat/SKILL.md` (new skill) | config/doc | — | `src/skills/acme-build/SKILL.md` | role-match |
| `src/skills/c64-petcat/scripts/petcat.mjs` (new script) | component (skill script) | request-response | `src/skills/acme-build/scripts/acme.mjs`, `:1-95` | exact |
| `src/skills/c64-ram-capture/SKILL.md` (re-cut, D-19: drop `.d64` ownership claims) | doc | — | itself, prior version (in-place edit) | exact |
| `src/skills/c64-program-recon/SKILL.md` (gains a pointer to `c64-petcat`, D-17) | doc | — | itself, prior version (in-place edit) | exact |
| Fakery-detector port (`D-06`), new module/test under either `src/mcp/vice/` or a skill script | transform | CRUD (cross-reference two data sources) | `src/skills/c64-ram-capture/scripts/d64-parse.mjs:164-193` (the three named-reason signatures) — port the LOGIC, not the file; source becomes `c1541.entry`/`c1541.bam` outputs instead of raw bytes | exact (logic port) |
| `src/mcp/vice/repo-root.ts` (new `toolsDir()`) | utility | CRUD | `supervisorDir()`, same file, `:186-190` | exact |
| Five other path-migration writers (`stock-paths.ts`, `incident-record.ts`, `install-resources.ts`, `ghidra-project.mts`, `vice-broker.mts`) | config/utility | file-I/O | `vice-broker.mts`'s existing `stateDir ?? env-var ?? default` fallback chain (RESEARCH.md cites `vice-broker.mts:123`) as the three-tier override pattern every one of the five must preserve | exact |

## Pattern Assignments

### `src/mcp/vice/host-tool.mts` — six new `c1541.*`/`petcat.decode` branches

**Analog:** `dxa.disassemble`'s branch, same file, `:1206-1245` (verified this
session — line numbers match RESEARCH.md exactly, no drift).

**Core pattern to copy verbatim in shape** (`host-tool.mts:1206-1245`):
```typescript
if (request.tool === "dxa.disassemble") {
  const { args } = request;
  const { imagePath, outDirPath, entrypointsPath, datablocksPath, labelsPath } = resolved as ResolvedDxaDisassemblePaths;

  const dxaFound = findDxaBinary(HERE);
  if (dxaFound.path === null) {
    return {
      ok: false,
      message: `host_tool "dxa.disassemble" refuses: the vendored dxa binary does not exist (tried: ${dxaFound.tried.join(", ")}) -- run "bash vendor/dxa/build.bash build" to produce it`,
    };
  }
  const dxaPath = dxaFound.path;

  const argv: string[] = ["-p", "all-nmos6502", "-d", "skip-scanning", "-t", "detect-internal"];
  if (args.imageKind === "flat64k") argv.push("-g", "0000");
  if (entrypointsPath !== undefined) argv.push("-R", entrypointsPath);
  if (datablocksPath !== undefined) argv.push("-B", datablocksPath);
  if (labelsPath !== undefined) argv.push("-l", labelsPath);
  argv.push("-a", "dump");
  argv.push(imagePath);

  const imageStem = basename(imagePath).replace(/\.[^./]+$/, "");
  const listingPath = join(outDirPath, `${imageStem}.dxa-dump.lst`);

  return { ok: true, toolPath: dxaPath, argv, outputs: [listingPath] };
}
```

**What each new branch takes from this:**
1. Fixed flags first, in a fixed deterministic order (`-attach <image>` then
   the capability flag, e.g. `-dir`/`-bam`/`-chain <name>`/`-entry <name>`,
   for `c1541`; `-2` fixed dialect per `D-24` for `petcat`, never a wire field).
2. Resolved input path(s) last in argv (mirrors `imagePath` going last above).
3. A `toolPath` refusal-by-name when the binary does not exist, following
   the exact message shape (`host_tool "<id>" refuses: ... (tried: ...)`),
   but sourced from `findSiblingBinary()` (D-13's sibling-of-x64sc + PATH
   fallback), not `findDxaBinary()`.
4. Return `{ ok: true, toolPath, argv, outputs: [onePath] }` — never bytes
   inline (D-22).

**Digest/output-is-stdout wiring** (`host-tool.mts:1869`, condition guarding
the `writeFileSync(built.outputs[0]!, spawnResult.stdout, ...)` step):
extend the same boolean condition (or a small `TOOLS_WHOSE_OUTPUT_IS_STDOUT`
set, per RESEARCH.md's own recommendation) to include all five `c1541.*` /
`petcat.decode` ids — none of them have a native output-file flag (MEASURED:
no `-o` for `-bam`/`-dir`/`-entry`/`-chain`).

**Never-consult-exit-status discipline** (comment at `:1869`, restated in the
same branch's prose): *"digests the FILE, never the dxa process's own exit
status, which is not the pass/fail signal for a listing"* — this is the
literal sentence D-10/D-11 generalise to `c1541`/`petcat`.

---

### `src/mcp/vice/host-tool.mts` — six positive-shape classifier functions (NEW capability, no existing analog function)

**No existing classifier function exists in this file today** — this is
genuinely new logic, confirmed by RESEARCH.md's own "Don't Hand-Roll" table
(*"the one genuinely new piece of logic is the six positive-shape
classifiers"*). The DISCIPLINE they must honour is established, but no
function body to copy exists.

**Discipline to follow** (from `:1869`'s comment, generalised): pure,
host-side function `(capturedText) => { ok: true } | { ok: false; reason }`,
called from inside `runHostTool()` immediately after the existing digest
step and before the response object is constructed. Wire the failure into
the same `{ ok: false, message }` shape every other refusal in this file
already uses (verified by the `dxa.disassemble` no-binary refusal above —
same shape, same field name `message`).

**Concrete shapes to declare** (from CONTEXT.md D-09, MEASURED live this
session per RESEARCH.md's Code Examples section):
- `c1541.chain`: at least one `(t,s) -> (t,s)` arrow pair.
- `c1541.dir`: the `N blocks free` trailer.
- `c1541.entry`: a `T/S:` line — exact regex target confirmed live:
  `/T\/S:\s*(\d+)\/(\d+),\s*(\d+)\s*blocks/`.
- `petcat.decode`: the `;<path> ==<hex>==` banner line.
- `c1541.bam`: per-sector grid presence (`*`/`.` rows) — declare a shape,
  Claude's discretion on the exact regex (A1 in RESEARCH.md's Assumptions Log).
- `c1541.read`: file was actually written and is non-empty (this verb's
  "shape" is the produced host file, not stdout text).

---

### `src/mcp/vice/host-tool.mts` — binary resolution alongside `x64sc` (D-13/D-15)

**Analog:** `backend-detect.mts`'s `binPath`/`binPathResolved` field pair and
memoisation posture, `:339-366`, `:396` (verified this session, matches
RESEARCH.md).

**Memoise-once pattern** (`backend-detect.mts:396`, comment immediately
above, verified this session):
```typescript
// Memoised answer for the probe/cache path ONLY -- the override path
// (VICE_BACKEND set) is always answered fresh, on every call, straight from
// the environment, and never touches this memo ...
let memoisedResult: ResolvedBackendResult | null = null;
```

**`binPath` field's own doc comment** (`:339-358`, verified this session)
states exactly the hazard `findSiblingBinary()` must avoid — a name (not a
resolved path) shown to a human/agent "resolves to nothing at all" inside a
container. The new sibling-binary resolver must produce an absolute path,
same discipline, with a PATH fallback that logs a warning (per D-13's own
text, not silent).

**No version probing** (D-14, deliberate divergence — do NOT add a
`--version` probe for `c1541`/`petcat`; MEASURED both are unreliable/
unimplemented). Existence-check on the resolved sibling path only.

---

### `src/mcp/vice/host-tool.mts` — `WR-03` fix (two holes in "nothing throws")

**Analog:** `host-tool-client.ts`'s already-correct never-reject `.catch()`
shape, `:398-427` (verified this session, exact text below):

```typescript
      runHostToolFromContainer(tool, argsObj, repoRootArg ? { repoRoot: repoRootArg } : {})
        .then((response) => {
          process.stdout.write(`${JSON.stringify(response)}\n`);
          process.exitCode = response.ok ? 0 : 1;
        })
        .catch((err: unknown) => {
          process.stdout.write(`${JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) })}\n`);
          process.exitCode = 1;
        });
```

**Mirror this exact shape** at `host-tool.mts`'s own standalone CLI entry
point (RESEARCH.md cites `:2145` for the un-`.catch()`'d `.then()` — re-grep
before editing, since line numbers move as new branches are added earlier
in the file this same phase). Also wrap `runOracleRun()`'s
`mkdirSync(scratchDir, { recursive: true })` (RESEARCH.md cites `:2068`,
outside its own `try` opening at `:2071`) inside that `try`.

---

### `src/mcp/vice/host-tool.test.ts` — census/completeness updates

**Analog:** the existing pinned-total assertions, verified this session,
exact text at `:1915` and `:1949`:
```typescript
assert.equal(totalDeclared, 17, "the declared path-key total across all tools must be 17 -- a different count means a key was added or dropped without updating this census");
...
assert.equal(totalDeclared, 17, "sanity: the declared path-key total must still be 17");
```
Update both `17`s to the real new total once the six ids' path-key counts
are known (do not guess — compute from the actual `HOST_TOOL_PATH_ARG_KEYS`
entries written for the six new ids, per D-02's explicit instruction).

**Non-vacuous two-directional test pattern (D-12):** no single file is the
template (D-12's own text names the class of guard, not a file to copy
verbatim: *"test-gate's union, the deferred ledger, the resources sync"*).
Each of the six new tests must, in one test body: (1) run a planted-failure
fixture through the real classifier and assert refusal, AND (2) run a
deliberately-written, test-local exit-status-only predicate over the
identical captured output and assert it wrongly "passes" — proving the
classifier is doing real work, not vacuously agreeing with exit status.

---

### `src/skills/c64-disk-access/scripts/c1541.mjs`, `src/skills/c64-petcat/scripts/petcat.mjs`

**Analog:** `src/skills/acme-build/scripts/acme.mjs`, `:1-52` and beyond
(verified this session, header and `invokeSeam()` opening reproduced below).

**Header pattern — WHAT NOT TO DO block** (`acme.mjs:1-21`, verified this
session):
```javascript
#!/usr/bin/env node
// ACME -> C64 assembler driver.  Target is fixed: C64, 6510 CPU, cbm output.
// Scope is assembling only: source in, .prg + symbol files out.  Running the
// result on a C64 belongs to the emulator skill.
//
// Phase 34, plan 34-04 (SEAM-05): the assembler is now reached ONLY through
// the host-tool execution seam -- the project owner's rule of 2026-08-28
// (.planning/seeds/host-tool-executor.md) is that this script runs
// container-side, `acme` lives host-side, and there is no container PATH to
// find it on. This file used to spawn `acme` directly (a synchronous
// `spawnSync("acme", args, { env })`) and probed FOUR fixed HOST paths
// (`/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme`)
// for its `<...>`-include library -- both are exactly what the owner's rule
// says cannot work from inside a container. The spawn and the library probe
// both moved to `src/mcp/vice/host-tool.mts`'s `acme.build` allowlist entry;
// this file now only constructs a TYPED request and reads the produced files
// back off the shared workspace tree.
//
// WHAT NOT TO DO: never reintroduce a local child-process call to the
// assembler as a fallback when the seam is unreachable -- a fallback that
// works on the developer's own host and silently fails inside a container is
// the exact failure this seam exists to remove. A seam refusal is reported
// and the build fails; it is never retried by spawning `acme` here.
```
Both new scripts need the equivalent header naming what NOT to do:
never `spawnSync("c1541"/"petcat", ...)` directly from the skill script
(this is exactly what `scripts/check-no-skill-external-spawn.mjs` /
`skill-external-spawn-gate.test.ts` guard against — re-run those planted-
violation controls per ROADMAP criterion 1, not assumed still valid).

**Imports and seam-invocation pattern** (`acme.mjs:23-52`, verified this
session):
```javascript
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join, basename, relative, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { resolveMcpModule, refusalMessage } from "../../c64-ram-capture/scripts/mcp-module.mjs";

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

const HOST_TOOL_CLIENT_FILE = "host-tool-client.ts";

function invokeSeam(tool, args, repoRoot) {
  return new Promise((resolvePromise) => {
    const resolved = resolveMcpModule(HOST_TOOL_CLIENT_FILE);
    if (!resolved.ok) {
      resolvePromise({ ok: false, message: refusalMessage(HOST_TOOL_CLIENT_FILE, resolved.rungs) });
      return;
    }
    const cliArgs = [resolved.path, "run", "--tool", tool, "--args", JSON.stringify(args), "--repo-root", repoRoot];
    let child;
    try {
      child = spawn(process.execPath, cliArgs, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolvePromise({ ok: false, message: `spawn failed: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    // ... never rejects -- resolves { ok:false, message } on any failure
  });
}
```
Copy `invokeSeam()` verbatim (same cross-package import path pattern —
`../../c64-ram-capture/scripts/mcp-module.mjs`'s `resolveMcpModule`/
`refusalMessage` is the shared resolver ladder both new scripts also need).
`c1541.mjs` builds one CLI subcommand per capability (`bam`/`dir`/`entry`/
`chain`/`read`), mirroring `d64-parse.mjs`'s own `<directory|bam> --image
<path> [--json]` idiom (D-18: one script per binary, not per capability).
`petcat.mjs` builds one `decode` subcommand plus the SYS-target
extraction/decline logic (D-21).

---

### Fakery-detector port (`D-06`) — logic source, new host

**Analog:** `src/skills/c64-ram-capture/scripts/d64-parse.mjs:164-193`
(verified this session, exact text reproduced):
```javascript
      const reasons = [];
      if (blocks === 0) reasons.push("block count is 0");
      if (!isInImage(firstTrack, firstSector)) {
        reasons.push(`first track/sector ${firstTrack}/${firstSector} is outside the image`);
      } else if (isTrackFullyFree(bam, firstTrack)) {
        reasons.push(`first track ${firstTrack} is reported entirely free by the BAM (0 sectors allocated) -- the file cannot really start there`);
      }

      entries.push({
        ...
        suspicious: reasons.length > 0,
        suspicious_reasons: reasons,
      });
```
Port these three signatures (block count 0; first T/S outside image; first
track reported fully free by BAM) plus the structural cycle guard
(`if (nextTrack === 0) break;` plus a visited-set check this file's
`parseDirectory()` also carries, per D-06's text) — but source the inputs
from `c1541.entry`'s parsed `T/S:` line and `c1541.bam`'s per-sector grid
instead of raw disk-image bytes. Output shape (`suspicious`,
`suspicious_reasons` as a named-reason array, never a bare boolean) must be
preserved exactly — downstream provenance consumers read this shape.

---

### `src/mcp/vice/repo-root.ts` — new `toolsDir()`

**Analog:** `supervisorDir()`, same file, `:186-190` (verified this session):
```typescript
/** The one shared directory name every module in this skill reads/writes
 * host-synchronised state through -- `join(repoRoot(...), ".vice-supervisor")`,
 * so the literal directory name also has exactly one definition. */
export function supervisorDir(opts: RepoRootOptions = {}): string {
  return join(repoRoot(opts), ".vice-supervisor");
}
```
`toolsDir()` follows the identical one-line `join(repoRoot(opts), "...")`
shape, but returns `.c64-re-tools` as the root that the other five writers
(`stock-paths.ts`, `incident-record.ts`, `install-resources.ts`,
`ghidra-project.mts`, `vice-broker.mts`) each derive their subdirectory from
(`supervisor/`, `snapshots/`, `bin/`, `runs/ghidra/`, `incidents/`,
`cache/` per D-33's stated layout). Each of the five writers keeps its own
existing `stateDir ?? env-var ?? default` three-tier override chain
(verified pattern present in `vice-broker.mts`) — env vars
(`VICE_POOL_DIR`/`VICE_EPOCH_FILE`/`VICE_SUPERVISOR_DIR`) must keep winning
over the new default, per D-33.

## Shared Patterns

### Never-consult-exit-status (D-10/D-11)
**Source:** `host-tool.mts:1869`'s comment on the `dxa.disassemble` digest
condition (verified this session).
**Apply to:** All six new `c1541.*`/`petcat.decode` branches and their
classifiers. Exit status is recorded in the log line (`host-tool.mts:1861`
region) but never gates the response.

### Refuse-unknown-keys-BY-NAME (V5 input validation)
**Source:** `normaliseHostToolRequest()`'s existing discipline (this file's
own header, cited by RESEARCH.md as authoritative) plus the seven-
synchronized-edit-sites note (`host-tool.mts:128-138` region).
**Apply to:** Every new `HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS` entry
for the six new ids — no coercion, no silent drop of an unrecognised key.

### Symlink-safe workspace confinement
**Source:** `resolveWorkspacePath()`, `host-tool.mts:914-937` (per
RESEARCH.md's Don't-Hand-Roll table; not re-read line-by-line this session
but its existence and role is corroborated by the census test's own
purpose at `:1891`).
**Apply to:** Every new path-bearing argument: `.d64`/`.prg` image paths,
`c1541.read`'s output-file path, `petcat.decode`'s image and listing-output
paths. Never a naive `path.resolve()` + `startsWith()` check (a prior
review found that shape defeated by a planted symlink).

### Container-side seam-only invocation, never a direct spawn
**Source:** `acme.mjs`'s header WHAT-NOT-TO-DO block, `:1-21`; enforced by
`scripts/check-no-skill-external-spawn.mjs` / `skill-external-spawn-gate.test.ts`.
**Apply to:** Both new skill scripts (`c1541.mjs`, `petcat.mjs`) — reach
`c1541`/`petcat` ONLY through `host-tool-client.ts`, never `spawnSync` a
host binary directly. Re-run the planted-violation controls after adding
these scripts (ROADMAP criterion 1 requires this explicitly, not an
assumption of continued validity).

### Amend-in-place with a dated rider, never delete
**Source:** `.planning/milestones/v0.8.0-REQUIREMENTS.md`'s eleven amended
ids (named in CONTEXT.md D-29/D-31 as the precedent; not re-read this
session — file was not required reading, cited for provenance only).
**Apply to:** ROADMAP.md success criterion 1 (D-04/D-29) and
REQUIREMENTS.md's `PREP-03` line (D-31) and Excluded-table line 109 —
struck with a dated rider stating what changed and on what evidence, never
silently deleted.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| The six positive-shape classifier functions themselves | utility | transform | Genuinely new logic per RESEARCH.md's own Don't-Hand-Roll table — no existing classifier function exists in `host-tool.mts` today; only the DISCIPLINE (never consult exit status) has a precedent, not a function body. |
| `docs/phase40-preprocessing-tools-decisions.md` (D-29) | doc | — | New decisions doc; `docs/phase39-dual-channel-coexistence-gate-findings.md` is named as the format precedent (machine-readable-verdict-in-a-findings-doc shape) but was not read this session — planner should open it directly rather than rely on this pattern map's secondhand description. |
| PREP-04's six two-directional non-vacuous-control tests | test | transform | D-12 names a CLASS of existing guard convention, not a single file to copy — each must be authored fresh against its own tool's planted-failure fixture. |

## Metadata

**Analog search scope:** `src/mcp/vice/*.{ts,mts}`, `src/mcp/vice/*.test.ts`,
`src/skills/*/scripts/*.mjs`, `src/skills/*/SKILL.md`.
**Files scanned:** ~15 read directly this session (all listed under Sources
above with verified line numbers); remainder drawn from RESEARCH.md's own
line-numbered citations, spot-checked for drift (none found — RESEARCH.md
was authored the same day, 2026-09-08, and every checked citation matched
exactly).
**Pattern extraction date:** 2026-09-08
