# Phase 40: The Three Preprocessing Host Tools - Research

**Researched:** 2026-09-08
**Domain:** Extending an existing typed host-tool execution seam
(`src/mcp/vice/host-tool.mts`) with two new VICE preprocessing binaries
(`c1541`, `petcat`), a `.d64` route supersession, a project-wide path
consolidation, and two carried bug fixes. No new external dependency, no new
framework, no new package.
**Confidence:** HIGH — every load-bearing claim below is either read directly
from this session's own `Read` of the source (cited with path + line range and
a verbatim quote) or reproduced live against the genuine stock VICE 3.9
binaries installed on this host.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The phase is now TWO tools, not three.** `cartconv` is **not built** and
`PREP-03` **leaves the roadmap** — a hard direction given by the project owner
during the 2026-09-08 discussion (`D-30`, `D-31`). A plan that reaches for
`cartconv`, cartridge banking, or per-bank images is out of scope.

- **D-01:** One `host_tool` id per capability, not per binary, not one
  batched survey. Follows `acme.build` / `ghidra.analyze` / `dxa.disassemble`
  exactly. Costly to reverse: each id is seven synchronized edit sites.
- **D-02:** The shipped id set is six ids: `c1541.bam`, `c1541.dir`,
  `c1541.entry`, `c1541.chain`, `c1541.read`, `petcat.decode`. `c1541.entry`
  is the only route to a directory entry's `first_track`/`first_sector`.
  `c1541.read` is what the three live tests' extraction callers need.
  `HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`, `HOST_TOOL_TIMEOUT_MS` all
  gain six entries; `host-tool.test.ts`'s pinned declared-path-key total of
  **17** moves and must be updated with the real new number, not a guess.
- **D-03:** No mutating `c1541` verb ships. Every shipped id is read-only.
  `c1541.read` writes a **host** file, not the disk image, so it is not a
  mutating verb under the evidence-before-write clause.
- **D-04:** `d64-parse.mjs` is fully replaced this phase and **deleted**.
  `c1541` becomes the only `.d64` route. This reverses ROADMAP success
  criterion 1 and REQUIREMENTS.md's Excluded-table line 109, both amended
  in-place with dated riders (`D-29`). Three costs accepted: (1) the `c1541`
  route needs the broker up, unlike the pure-Node parser; (2) the `--json`
  fakery detector has no `c1541` equivalent and must be ported (`D-06`);
  (3) `anno-d64.ts` is a deliberate MCP-side duplicate and goes too (`D-08`).
- **D-05:** No fallback when the seam is unreachable. A seam refusal is
  reported and the operation fails with its reason. No byte-level fallback
  path is retained.
- **D-06:** The fakery detector is **ported** onto `c1541`'s inputs, not
  dropped — three named-reason signatures (`block count is 0`; first T/S
  outside the image; first track reported entirely free by the BAM) plus a
  structural visited-set cycle guard. Signature 3 becomes sharper on
  `c1541 -bam`'s per-sector map.
- **D-07:** `c1541.read` is the single-file byte-extraction route (not
  `c1541.extract`), mirroring `extractEntry(image, entryName)`'s signature.
  Outputs cross as `{ path, sha256, byteLength }`, never bytes.
- **D-08:** `anno-d64.ts` is deleted too, confirmed after its blast radius was
  measured: `anno-d64.test.ts`; three LIVE tests (`ghidra-live.test.ts:59`,
  `ghidra-opcode-live.test.ts:38`, `dxa-live.test.ts:48`) which **acquire a
  broker dependency they do not have today**; `module-classification.ts:405-418`;
  `package.json:58`'s `files[]`; `scripts/check-npm-packages.mjs:234`;
  `vsf-slice.mjs:12,24` header prose (and `vsf-slice.test.mjs:213` asserts the
  header cites it); `prg-image.ts:39`, `vsf-slice.ts:395`,
  `ghidra-live.test.ts:1073` prose references.
- **D-09:** Positive-shape oracle. Each id declares the SHAPE its success
  output must have; absence of that shape is the failure. Neither a
  negative error-phrase matcher nor a both-directions check. Concrete shapes:
  `c1541.chain` must yield at least one `(t,s) -> (t,s)` arrow pair;
  `c1541.dir` must yield the `N blocks free` trailer; `c1541.entry` must
  yield a `T/S:` line; `petcat.decode` must yield the `;<path> ==<hex>==`
  banner line.
- **D-10:** The shape check lives host-side, in the seam (`runHostTool()`),
  following `dxa.disassemble`'s existing precedent of never reading exit
  status.
- **D-11:** Exit status is recorded in the log line and never consulted — for
  all tools, `petcat` included. One oracle discipline, one code path.
- **D-12:** `PREP-04`'s non-vacuous control is a **test assertion per tool**,
  asserting both directions in the same test: the positive-shape oracle
  refuses, AND a deliberately-written exit-status-only predicate returns
  "pass" on that identical output.
- **D-13:** Each binary is resolved alongside the resolved `x64sc` — from the
  directory of whichever `x64sc` `backend-detect.mts` already resolved — with
  a PATH fallback that records a warning.
- **D-14: DELIBERATE DIVERGENCE from the ROADMAP.** No version probing —
  path only. `c1541 --version` is unimplemented; `cartconv --version` prints
  an error beside a version banner. A planner must not re-add version
  probing.
- **D-15:** Availability is established once per process and memoised
  (mirrors `backend-detect.mts`'s posture).
- **D-16:** Every per-call log line carries the resolved absolute path,
  alongside tool id, exit status, elapsed ms.
- **D-17:** Two new skills. A disk-access skill owning `.d64` access via
  `c1541` (BAM, directory, entry, chain, read) — where `d64-parse.mjs`'s
  replacement lands. A `petcat` skill owning PETSCII/BASIC detokenization AND
  the `SYS` decline logic. `c64-program-recon` gains a pointer, not the logic.
- **D-18:** One script per binary, not one per capability (file layout only;
  the `host_tool` id set stays per-capability).
- **D-19:** The two existing overlapping skill descriptions (`c64-ram-capture`,
  `c64-program-recon`) are re-cut in the same phase by making the
  descriptions actually true, not by tuning wording around a threshold.
- **D-20:** Both new skills are silent on backend (VERIFIED: they reach the
  seam through `host-tool-client.ts`, naming no `vice_*` tool at all).
- **D-21:** A resolved "no" for `PREP-02` is a SUCCESS: `ok: true`,
  `entrypoint: null`, plus a named reason. Keeps `ok: false` meaning "the
  tool did not work" for `D-09`'s shape-based oracle.
- **D-22:** The detokenized listing goes to a workspace file (`{ path,
  sha256, byteLength }`); the verdict crosses inline. No inline byte payload
  at any result size.
- **D-23:** The computed-`SYS` fixture is **authored, not found** — a tiny
  `.prg` whose BASIC stub does a computed `SYS`. Sits beside
  `src/mcp/vice/fixtures/dxa/basic-stub.prg`, which already covers the
  literal fast path.
- **D-24:** `petcat`'s BASIC dialect is fixed at `-2` server-side in
  `buildHostToolArgv()`. No wire field, no validation.
- **D-25:** A synthetic `.d64` is authored with `c1541` and committed under
  `src/mcp/vice/fixtures/`, pinned by sha256. Mutating verbs are used ONCE as
  a throwaway to build it; no mutating id ships. One real-corpus assertion
  stays live-gated (Claude's discretion where).
- **D-26 (`WR-03`, carried):** Two holes in `host-tool.mts`'s "NOTHING throws"
  contract: (1) `runOracleRun()`'s `mkdirSync(scratchDir, ...)` at
  `host-tool.mts:2068` sits outside its own `try` (opens at `:2071`);
  (2) the standalone CLI entry point's `.then()` at `host-tool.mts:2145` has
  no `.catch()`. Mirror `host-tool-client.ts:419-427`'s already-correct
  shape. Requires a `build.ts` re-run.
- **D-27 (carried):** The unowned `mkdtemp` fix for scratch fixtures written
  inside walked trees is taken here.
- **D-28:** Two pending todos folded (path consolidation; installer
  self-ignore its deployed `tools/`); one NOT folded (vicerc scratch-dir
  reaping — routed to a broker kill/recycle change this phase never opens).
- **D-29:** The `.d64` supersession gets a decisions doc
  (`docs/phase40-preprocessing-tools-decisions.md`) AND in-place amendments
  to ROADMAP criterion 1 and REQUIREMENTS.md line 109, with dated riders.
- **D-30/D-31:** `cartconv`/`PREP-03` removed. `PREP-03`'s REQUIREMENTS.md
  line is struck as removed with a dated rider, not deleted. Coverage becomes
  19 total / 19 mapped / 0 unmapped.
- **D-32:** The new disk-access skill survives `cartconv`'s removal — kept as
  a `c1541`-only disk-access skill.
- **D-33:** `.c64-re-tools/` adopted now, all six writers, **clean break, no
  back-compat**. Layout: `supervisor/`, `snapshots/`, `bin/`,
  `runs/ghidra/`, `incidents/`, `cache/`. Any live broker under the old
  layout must be stopped before the upgrade.
- **D-34:** The migration stands on its own merit after `cartconv`'s removal
  (six scattered write locations, ~40 lines of `.gitignore`).
- **D-35:** No retention/cleanup policy invented here — belongs with the
  vicerc-reaper todo.
- **D-36 — three hard ordering constraints:**
  1. The `.c64-re-tools/` migration lands before anything writes new output.
  2. The two deletions (`d64-parse.mjs`, `anno-d64.ts`) land LAST, on a
     branch merged BY HAND (`cleanup-wave` refuses any branch whose diff
     contains a deletion, unconditionally — stock GSD behaviour).
  3. The ROADMAP/REQUIREMENTS amendments (`D-29`, `D-31`) go in a plan
     carrying `USE_WORKTREES_FOR_PLAN=false`.

### Claude's Discretion

Plan decomposition beyond `D-36`'s three constraints; exact new-skill
directory and script names; the new skills' frontmatter description wording
(subject to `D-19`'s re-cut); test placement and naming; where the shape
declarations physically live inside `host-tool.mts`; the `runId` derivation;
and how the `D-25` live-gated corpus assertion is placed.

Three decisions flagged by the owner's context as worth a second look before
the first plan is committed: (1) `D-04`/`D-08` together delete two source
files and put three live tests behind the broker — the largest irreversible
step in the phase; (2) `D-33`'s clean break has no back-compat by explicit
decision; (3) `D-14`'s divergence from the ROADMAP note — a planner reading
the ROADMAP Notes bullet directly will see a version-probe requirement the
owner has dropped, and **must not re-add it**.

### Deferred Ideas (OUT OF SCOPE)

- `cartconv` and all cartridge/bank work — removed by owner direction, not
  deferred to a named phase.
- Bank-qualified addressing as a modelled store feature — moot now.
- `c1541.extract` (whole-image extraction) — declined in favour of
  `c1541.read`.
- Any mutating `c1541` verb on the shipped seam (`-format`, `-write`,
  `-bwrite`, `-delete`).
- Version probing for the host tools.
- Runtime correlation of claimed vs. actually-read sectors — needs
  drive-side checkpoints and the `device c:` `default_memspace` reset
  (Phase 41), plus `Drive8TrueEmulation` and a non-zero `Drive8Type`.
- A `petcat` BASIC dialect option.
- A retention/cleanup policy for per-run directories.
- Whether `c64-ram-capture` should be renamed — not raised, not decided.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREP-01 | A user can inspect a disk image's real structure — BAM, directory, and a named file's actual sector chain — through `c1541`, reached over the existing `host_tool` control op. | Architecture Patterns (the five `c1541.*` branches), Code Examples, live-measured output shapes below. |
| PREP-02 | A user can see what a program's BASIC stub actually does and where it hands over to machine code, via `petcat`, before any disassembler is spent on it — and is told plainly when the stub cannot be resolved. | Code Examples (the computed-SYS fixture, MEASURED and built this session), Architecture Patterns (`petcat.decode` branch), Common Pitfalls (dialect/case sensitivity). |
| PREP-04 | A failure in `c1541`/`petcat` is reported as a failure. | Validation Architecture, Common Pitfalls (Pitfall 11-adjacent exit-0-on-error facts), Architecture Patterns (positive-shape oracle placement). |
| PREP-03 | EXCLUDED — `cartconv` is not built (`D-30`/`D-31`). No research support needed or provided; its measured behaviour is recorded once, in Common Pitfalls, only because it is the strongest argument for the positive-shape oracle design that governs `PREP-04`. |
</phase_requirements>

## Summary

This phase has almost no external-technology risk: no new npm package, no new
framework, no new language runtime. Its entire technical surface is (a)
extending one already-well-understood in-repo seam
(`src/mcp/vice/host-tool.mts`) with two more tool ids following an existing,
five-times-repeated template (`dxa.disassemble` is the closest analogue), and
(b) a large but mechanical path-migration and two-file-deletion exercise whose
every touched site CONTEXT.md has already named with exact line numbers. The
research value this document adds beyond CONTEXT.md is: (1) independent live
re-verification of the load-bearing exit-code and output-shape claims against
the actual host binaries (not re-derivation, confirmation); (2) a concrete,
tested computed-`SYS` fixture recipe (built and round-tripped this session,
not merely described); (3) exact source citations with line numbers and
verbatim quotes for every "seven synchronized edit sites" location so the
planner does not have to re-open the files; (4) a Validation Architecture
section mapping each requirement to a concrete, runnable test; and (5) a
flagged arithmetic discrepancy in the skill count that the planner should not
silently inherit.

**Primary recommendation:** Copy `dxa.disassemble`'s branch shape exactly for
both new tools (fixed-flags-first argv, single spawn call via the existing
`spawnHostTool()`, stdout/output digested to a file, exit status recorded but
never consulted) and add the positive-shape oracle as a small, pure
`(capturedOutput) => { ok, reason }` classifier function per tool id, called
from inside `runHostTool()` immediately after the existing digest loop, before
the response is constructed — this keeps `D-10`'s "shape check lives host-side,
in the seam" requirement satisfied without inventing a second envelope shape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `c1541` disk inspection (BAM/dir/entry/chain/read) | Host process (broker) | Container-side skill script | The binary only exists host-side; `host-tool.mts` is the one place a child process may be spawned. The skill script is a thin typed-request builder, never a spawn site. |
| `petcat` BASIC detokenization + SYS resolution | Host process (broker) | Container-side skill script | Same reasoning. The SYS-resolution *decision logic* (literal vs. computed) can live either host- or container-side; `D-21`/`D-22` place the verdict shape host-side (in the response contract) but the actual regex/parse of the detokenized line is Claude's discretion — see Open Questions. |
| Positive-shape failure oracle (`PREP-04`) | Host process (`host-tool.mts`, inside `runHostTool()`) | — | `D-10` locks this: "re-deriving a cross-cutting seam locally" (container-side re-check) is the named anti-pattern to avoid. |
| Binary resolution (`c1541`/`petcat` path) | Host process (`host-tool.mts`, reusing `backend-detect.mts`'s resolved `x64sc.binPath`) | — | `D-13`: siblings of whichever `x64sc` was actually resolved, not a second independent PATH search. |
| `.c64-re-tools/` path resolution | Host process (`repo-root.ts`'s new `toolsDir()`) | Both container and host consumers via `hostpath.ts`/`containerpath.ts` | `D-33`: one owning function, five derived writers. |
| Skill scripts (`c1541`/`petcat` drivers) | Container-side | — | Never spawn a host binary directly; reach the seam only through `host-tool-client.ts`, per `acme.mjs`'s established pattern. |

## Standard Stack

### Core

No new runtime dependency is introduced by this phase. `c1541` and `petcat`
are host binaries this project does not vendor, install, or version-pin — they
ship alongside whichever `x64sc` is already on the host (stock package or the
project's own fork build), exactly as the ROADMAP Notes bullet states. There
is nothing to `npm install`.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `c1541` | VICE 3.9 (`/usr/bin`, MEASURED this session) or the fork's VICE build (`/usr/local/bin`, MEASURED this session, dated 26 Aug 2026) | Disk-image (D64/D71/D81/G64) maintenance CLI, used read-only here | Ships with every VICE distribution; this project already depends on VICE for `x64sc` | 
| `petcat` | Same as above | BASIC (de)tokenizer / PETSCII↔ASCII converter | Same |
| `node:child_process` `spawn` (async) | Node >= 24 built-in | The one spawn mechanism `spawnHostTool()` (host-tool.mts:1450) already provides; both new branches reuse it, never add a second | Already the project's only sanctioned async, non-shell, argv-array spawn path |

### Supporting

None. No new npm dependency, no new devDependency. `host-tool.test.ts`'s
existing `node --test` harness and fixture-generation helpers (temp scripts
under a test-created directory, `chmodSync` to make them executable) are
reused unchanged.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-capability `host_tool` ids (`c1541.bam`, `c1541.dir`, ...) | One `c1541.*` id with a typed `verb` field | Rejected on the record (`D-01`): widens `HOST_TOOL_ARG_KEYS` into a per-verb union, weakening the refuse-unknown-keys-BY-NAME discipline `host-tool.mts`'s own header calls authoritative. |
| Positive-shape oracle | Negative (stderr-non-empty) or exit-status oracle | Both measured wrong on this host: `c1541` prints an `OPENCBM` library-load complaint on every call (100% false-positive rate for "stderr non-empty"), and `c1541`/`cartconv` exit 0 on error while `petcat` exits 0 on garbage input. |
| `c1541.read` (single named file) | `c1541.extract` (whole-image dump) | Declined (`D-07`): pays for the whole disk plus a PETSCII filename-mangling surface, for no stated requirement. |

**Installation:** None required — the binaries are already present on this
host at `/usr/bin/c1541`, `/usr/bin/petcat` (VICE 3.9, stock, dated 30 Dec
2024) and `/usr/local/bin/c1541`, `/usr/local/bin/petcat` (the fork build,
dated 26 Aug 2026). MEASURED this session:

```
$ ls -la /usr/bin/c1541 /usr/bin/petcat /usr/local/bin/c1541 /usr/local/bin/petcat
-rwxr-xr-x 1 root root  373688 30 dec  2024 /usr/bin/c1541
-rwxr-xr-x 1 root root  120984 30 dec  2024 /usr/bin/petcat
-rwxr-xr-x 1 root root 1890184 26 aug 22.09 /usr/local/bin/c1541
-rwxr-xr-x 1 root root  137816 26 aug 22.09 /usr/local/bin/petcat
```

**Version verification:** N/A in the npm/pip/cargo sense — these are not
package-manager-installed dependencies. `c1541 --version` is unimplemented
(MEASURED, matches CONTEXT.md `D-14`); no version string is obtainable for
either binary by design (`D-14` deliberately excludes version probing).

## Package Legitimacy Audit

Not applicable. This phase installs no external package via any package
manager. `c1541`/`petcat` are pre-existing host binaries, already present
alongside `x64sc`, resolved by absolute path per `D-13` — never fetched,
never a wire-selectable command, never a `npm`/`pip`/`cargo` dependency. The
Package Legitimacy Gate protocol has nothing to check here.

## Architecture Patterns

### System Architecture Diagram

```
container-side skill script (new c1541/petcat driver .mjs)
        │  builds a TYPED request: { tool: "c1541.chain", args: { image, name } }
        ▼
host-tool-client.ts  (spawns process.execPath on this in-tree module, --tool/--args/--repo-root)
        │  control-plane request, over host-tool-client's own spawn -- NOT the broker's
        │  TCP control session; host-tool.mts is itself host-bound and answers directly
        ▼
host-tool.mts :: runHostTool(raw, deps)
        │
        ├─ normaliseHostToolRequest(raw)        -- refuse unknown tool/key BY NAME
        ├─ resolveWorkspacePath(repoRoot, path) -- confine every path-bearing arg (D64 image,
        │                                          output listing path) to the bind-mounted tree,
        │                                          walking symlinks, never a lexical join
        ├─ resolve c1541/petcat absolute path    -- D-13: sibling of resolvedBackend().binPath,
        │                                          memoised once per process (D-15)
        ├─ buildHostToolArgv(request, resolved)  -- fixed flags first, in a fixed order, argv
        │                                          built ONLY from typed fields, image path last
        ▼
spawnHostTool(toolPath, argv, timeoutMs)          -- the ONE spawn call, async, never spawnSync,
        │                                            bounded by a per-tool timeout that kills
        │                                            and reports a refusal on expiry
        ▼
child process (c1541 / petcat)  -- writes to stdout/stderr; c1541/cartconv both exit 0 on error
        │
        ▼
runHostTool() resumes:
        ├─ capture combined stdout (+stderr for some tools) to an outputs[] FILE
        ├─ digestOutputFile()  -- sha256 + byteLength over the REAL file bytes
        ├─ POSITIVE-SHAPE ORACLE (new, this phase, D-09/D-10) -- classify the captured text
        │    against the tool's declared success shape; absence of the shape = { ok:false }
        └─ log one line: tool id, exit status (recorded, never consulted), elapsed ms, path
        ▼
{ ok: true, tool, exitStatus, results:[{path,sha256,byteLength}], stderrTail }
   or { ok: false, message }     -- crosses the wire back through host-tool-client.ts,
                                    then invokeSeam()'s never-rejecting Promise, to the
                                    container-side skill script
```

### Recommended Project Structure

Two new skill directories join the existing seven under `src/skills/`
(current count MEASURED this session — see Common Pitfalls for the count
discrepancy against `D-17`'s stated "six → eight"):

```
src/skills/
├── c64-disk-access/            # NEW (D-17, D-32) -- .d64 access via c1541 only
│   ├── SKILL.md
│   └── scripts/
│       └── c1541.mjs           # one script per binary (D-18): -bam/-dir/-entry/-chain/-read
│                                # subcommands, mirroring d64-parse.mjs's own
│                                # `<directory|bam> --image <path> [--json]` CLI idiom
├── c64-petcat/                 # NEW (D-17) -- PETSCII/BASIC conversion + SYS resolution
│   ├── SKILL.md
│   └── scripts/
│       └── petcat.mjs          # one script: decode subcommand + SYS-target extraction
│                                # + named-decline logic (D-21)
├── acme-build/                 # unchanged
├── c64-memory-mapping/         # unchanged
├── c64-program-recon/          # gains a pointer to c64-petcat, not the logic (D-17)
├── c64-provenance-diff/        # unchanged
├── c64-ram-capture/            # SKILL.md re-cut (D-19): drops .d64 ownership claims
├── routine-queue-walker/       # unchanged
└── vice-wedge-triage/          # unchanged
```

### Pattern 1: The `dxa.disassemble`-style branch (template for both new tools)

**What:** Fixed flags first in a fixed deterministic order, then optional
resolved paths, then the resolved input path last; capture stdout (dxa has no
output-file option, and neither will the new `c1541`/`petcat` branches for
their read-only text output); write it to one `outputs[]` file; digest the
FILE, never the child's exit status.

**When to use:** Every new `host_tool` branch in `buildHostToolArgv()` and its
matching resolution branch in `runHostTool()`.

**Example (grounded in the real, existing branch — read this session):**

```typescript
// Source: src/mcp/vice/host-tool.mts:1206-1245 (dxa.disassemble branch),
// read this session -- this is the exact pattern to replicate for
// c1541.* and petcat.decode, not a paraphrase.
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

A `c1541.chain` branch follows the identical shape: `argv = ["-attach",
imagePath, "-chain", name]`, capture stdout, write it to
`join(outDirPath, "${imageStem}.chain.txt")`, return `{ ok: true, toolPath:
c1541Path, argv, outputs: [chainPath] }`. `c1541` writes nothing to its own
files for a read-only verb — like `dxa`, its "output" IS the captured stdout,
so it needs the same `writeFileSync(built.outputs[0]!, spawnResult.stdout, ...)`
step `runHostTool()` already applies for `dxa.disassemble` at
`host-tool.mts:1869-1878` — add `|| request.tool === "c1541.bam" ||
request.tool === "c1541.dir" || ...` (or a small `TOOLS_WHOSE_OUTPUT_IS_STDOUT`
set) to that condition rather than writing a sixth near-duplicate branch.

### Pattern 2: Binary resolution alongside `x64sc` (`D-13`, `D-15`)

**What:** Never an independent PATH search or an env-var override for
`c1541`/`petcat` — resolve them from the directory of whichever `x64sc` path
`backend-detect.mts`'s `resolvedBackend()` already resolved, memoised once
per process exactly as that module already memoises its own answer.

**Why:** `resolvedBackend()`'s `binPath` field (host-tool.mts's sibling
module, read this session — `backend-detect.mts:358` `binPath: string`) is
already the absolute resolved path to whichever `x64sc` this process is
driving (fork build or stock build), computed once and cached
(`backend-detect.mts:396` `let memoisedResult: ResolvedBackendResult | null =
null;`). `dirname()` of that path is the directory `c1541`/`petcat` live in,
on this host and on any host where this project's own binary-discovery
convention holds (VICE ships all its CLI utilities into the same `bin`
directory).

**Example:**

```typescript
// New code, following backend-detect.mts's own findAcmeLib()/findDxaBinary()
// "candidate list, first existing wins" idiom (host-tool.mts:1535-1557,
// read this session), extended with a PATH fallback per D-13's own text
// ("a PATH fallback that records a warning").
function findSiblingBinary(binaryName: string, resolvedX64scPath: string, log?: (line: string) => void): { path: string | null; tried: string[] } {
  const tried = [join(dirname(resolvedX64scPath), binaryName)];
  if (existsSync(tried[0]!)) return { path: tried[0]!, tried };
  // PATH fallback -- records a warning (D-13), never silent.
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = join(dir, binaryName);
    tried.push(candidate);
    if (existsSync(candidate)) {
      log?.(`host_tool: ${binaryName} not found alongside resolved x64sc (${resolvedX64scPath}); falling back to PATH match ${candidate} -- Pitfall 11 risk: this may be a DIFFERENT VICE build than the emulator`);
      return { path: candidate, tried };
    }
  }
  return { path: null, tried };
}
```

MEASURED risk this mitigates (Pitfall 11, confirmed live this session): both
`/usr/bin/` (VICE 3.9, stock, 30 Dec 2024) and `/usr/local/bin/` (the fork
build, 26 Aug 2026) carry all of `c1541`, `petcat`, `cartconv`, `x64sc`
simultaneously on this host. A bare-name PATH resolve (`spawn("c1541", ...)`)
would silently pick whichever comes first on `$PATH` — observed to be the
fork build — even when `x64sc` itself resolved to the stock build, or vice
versa, producing a `c1541`/`x64sc` version mismatch that can disagree about
disk-image format details.

### Pattern 3: The positive-shape oracle (`D-09`/`D-10`)

**What:** A pure, host-side classifier per tool id, applied to the captured
output text (never the exit code), called from inside `runHostTool()` after
the digest loop, before the response object is constructed.

**Example (new code, following the existing response-shape convention):**

```typescript
// New: one classifier per tool id, colocated with buildHostToolArgv() so
// the declared shape and the argv construction stay next to each other.
// Each returns { ok: true } or { ok: false, reason } -- reason is what
// crosses the wire as HostToolResponse's message on a shape failure.
function classifyC1541ChainOutput(stdout: string): { ok: true } | { ok: false; reason: string } {
  // D-09's declared shape: at least one "(t,s) -> (t,s)" arrow pair.
  // MEASURED shape (this session, against a real corpus image):
  // "(17, 0) -> (17,10) -> ... -> 117"
  if (/\(\s*\d+\s*,\s*\d+\s*\)\s*->\s*\(\s*\d+\s*,\s*\d+\s*\)/.test(stdout)) return { ok: true };
  return { ok: false, reason: `c1541.chain: no "(track,sector) -> (track,sector)" pair found in output -- the requested file was not resolved to a real sector chain` };
}

function classifyC1541DirOutput(stdout: string): { ok: true } | { ok: false; reason: string } {
  // D-09's declared shape: the "N blocks free" trailer.
  // MEASURED: "486 blocks free."
  if (/\d+\s+blocks free\.?/.test(stdout)) return { ok: true };
  return { ok: false, reason: `c1541.dir: no "<N> blocks free" trailer in output -- the image was not opened as a valid directory` };
}

function classifyPetcatDecodeOutput(stdout: string): { ok: true } | { ok: false; reason: string } {
  // D-09's declared shape: the ";<path> ==<hex>==" banner line.
  // MEASURED: ";/path/to/basic-stub.prg ==0801=="
  if (/;\S+\s+==[0-9a-fA-F]+==/.test(stdout)) return { ok: true };
  return { ok: false, reason: `petcat.decode: no ";<path> ==<hex>==" banner in output -- the file was not recognised as a BASIC program` };
}
```

Wire this in immediately before `runHostTool()`'s existing `return { ok: true,
tool: request.tool, exitStatus: ..., results, stderrTail }` at
`host-tool.mts:1915-1921` — for the six new tool ids only, apply the matching
classifier to the captured stdout and, on a shape failure, return `{ ok:
false, message: reason }` instead of the success envelope. `exitStatus` stays
recorded in the log line exactly as it already is for every existing tool
(`host-tool.mts:1861`, read this session) — `D-11`'s "never consulted" rule is
already the pattern this codebase uses for `dxa.disassemble`, `ghidra.analyze`,
etc.; the new tools do not diverge from it.

### Pattern 4: Container-side skill script (`acme.mjs`'s pattern)

**What:** A skill script that constructs a typed request and reaches the
seam ONLY through `host-tool-client.ts`, via `process.execPath` on an
in-tree module — never a direct spawn of a host binary.

**Example (the exact pattern already shipping, read this session):**

```javascript
// Source: src/skills/acme-build/scripts/acme.mjs:39-95, read this session.
// The two new scripts (c1541.mjs, petcat.mjs) copy this shape verbatim,
// substituting the tool id and args.
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
    // ... (never rejects -- resolves { ok:false, message } on any failure)
  });
}
```

### Anti-Patterns to Avoid

- **Adding a second argv-construction site.** `buildHostToolArgv()` is the
  one place; the header comment names this explicitly (`host-tool.mts:66-67`,
  read this session: *"No second copy of a tool's argv construction --
  buildHostToolArgv() is the one place."*).
- **Reading exit status to decide pass/fail for `petcat`.** `D-11` explicitly
  rejects using `petcat`'s exit 1 as an extra veto even though it is real
  signal for one class (missing file) — the asymmetry it would introduce is
  the named cost, and the shape check already catches everything the exit
  code would.
- **A container-side re-check of the failure oracle.** Named as
  "Re-deriving a cross-cutting seam locally" and explicitly declined in
  `D-10`.
- **Re-deriving `.c64-re-tools/`'s location anywhere but `repo-root.ts`'s new
  `toolsDir()`.** Mirrors the existing `supervisorDir()` precedent
  (`repo-root.ts:188-190`, read this session: `export function
  supervisorDir(opts: RepoRootOptions = {}): string { return
  join(repoRoot(opts), ".vice-supervisor"); }`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disk-image directory/BAM/sector-chain parsing | A second hand-written `.d64` byte parser (or extending `d64-parse.mjs`) | `c1541` over the `host_tool` seam | `D-04`: `c1541` supplies strictly richer inputs (per-sector BAM vs. per-track free counts; first T/S plus raw entry bytes) and is the project's own decided direction this phase. |
| BASIC detokenization / SYS target extraction | A hand-written BASIC tokenizer/detokenizer | `petcat -2` (fixed dialect, `D-24`) over the seam | petcat already handles every C64 BASIC v2.0 token; a hand-rolled detokenizer would have to reimplement VICE's own token tables and would drift on every VICE release. |
| Child-process spawning / timeout / kill-on-expiry | A new spawn helper | `spawnHostTool()` (`host-tool.mts:1450`) | Already async, argv-array, shell:false, bounded, and battle-tested by five existing tool ids; a second spawn function is exactly the "second copy" anti-pattern this module's header forbids. |
| Path confinement to the workspace root | A `path.resolve()` + `startsWith()` check | `resolveWorkspacePath()` (`host-tool.mts:914-937`) | The naive lexical check is exactly what a prior code review (CR-05) found defeated by a planted symlink; `resolveWorkspacePath()` walks BOTH the root and the candidate through `realpathOfNearestExisting()` before comparing. |
| Detecting whether the host has a working `c1541`/`petcat` | A version-string parse | An existence check on the resolved sibling path only (`D-14`/`D-15`) | Version probing was explicitly tried and dropped this phase: `c1541 --version` is unimplemented, and `cartconv --version`'s banner arrives beside an unrelated error, making "parse the version" unreliable even where it exists. |

**Key insight:** Every one of these problems already has an owning mechanism
in this codebase from a prior phase (34-37). This phase's job is almost
entirely "add two more entries to five existing tables," not "design a new
mechanism." The one genuinely new piece of logic is the six positive-shape
classifiers (`Pattern 3` above) and `PREP-02`'s SYS-target extraction/decline
logic — neither of which any existing code owns yet.

## Runtime State Inventory

> Included because this phase deletes two source files (`d64-parse.mjs`,
> `anno-d64.ts`) and migrates six writers' on-disk state root
> (`.vice-supervisor/`, `.vice-snapshots/`, `tools/`, `.planning/incidents/`,
> `mcp-deps.lock.sha256` → `.c64-re-tools/{supervisor,snapshots,bin,runs/ghidra,incidents,cache}/`).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None found that needs a data migration.** `.vice-supervisor/backend.json` (the capability/backend detection cache, written by `backend-detect.mts`'s `writeCacheRecordAtomic()`) is pure cache — re-derived on next probe, safe to lose. `.vice-snapshots/*.vsf` + sidecars are user-facing captures, not internal bookkeeping — D-33's clean-break decision means these are simply not carried forward automatically; a user who wants them keeps the old directory tree around and reads it manually. No schema-versioned store (`.annostore`) location is touched by this phase's writers. | Document in release notes (per `D-33`'s own text: "release notes tell people to delete it"), not a code migration. |
| Live service config | **A live broker process** holds `.vice-supervisor/` open as its rendezvous point between the container-side client and the host daemon (CONTEXT.md, confirmed via `vice-broker.mts:123` MEASURED this session: `const resolvedStateDir = stateDir ?? process.env.VICE_POOL_DIR ?? (repoRoot ? join(repoRoot, ".vice-supervisor") : ".vice-supervisor");`). | Any live broker under the old layout **must be stopped before the upgrade** — not hot-swappable. This is an operational note for whoever executes the plan on this host (a broker may currently be running), not a code change. |
| OS-registered state | None found. This project does not register OS-level scheduled tasks, pm2 processes, or systemd units for its own operation on this host (`vice-broker-must-run-as-systemd-unit` is a *recommendation* in this operator's MEMORY, not a shipped mechanism this phase touches). | None. |
| Secrets/env vars | `VICE_POOL_DIR`, `VICE_EPOCH_FILE`, `VICE_SUPERVISOR_DIR` env-var overrides **keep working and keep winning over the new default** (`D-33`, confirmed against the existing `vice-broker.mts:123` fallback chain read this session — the same three-tier `stateDir ?? env-var ?? default` pattern generalizes to the other five writers). No secret or CI env-var name changes; these are path overrides, not credentials. | Verify the same override-wins-over-default chain is preserved in each of the five other writers being migrated (`stock-paths.ts`, `incident-record.ts`, `install-resources.ts`, `ghidra-project.mts`) — a code-review item, not a data migration. |
| Build artifacts | `install-resources.ts`'s `installTargetDir()` (MEASURED this session, `install-resources.ts:91-93`: `export function installTargetDir(root: string): string { return join(root, "tools"); }`) deploys `resources/*.mjs` into the *consumer's* `<root>/tools/` today. After `D-33`, this moves to `.c64-re-tools/bin/`. A consumer project that already has `<root>/tools/*.mjs` deployed from a prior version has a stale, now-unreferenced directory after upgrading — this is the "installer self-ignore its deployed tools/" todo folded by `D-28`. | The installer/plugin's `SessionStart` hook must deploy to the NEW location on next run; the OLD `tools/` directory is left in place (not auto-deleted, per the clean-break "old-layout tree is ignored and left where it is" decision) and should be named in release notes as safe to `rm -rf`. |

**Nothing found in category "OS-registered state":** verified by grepping
this repo for `systemd`, `launchd`, `pm2`, `schtasks` — none of the project's
own code registers such state; only the operator's personal MEMORY notes
recommend running the broker under systemd, which is an operational choice
outside this repo's code.

## Common Pitfalls

### Pitfall 1: `c1541`/`cartconv` exit 0 on error — the whole reason for `PREP-04`

**What goes wrong:** Any code that checks `exitCode === 0` to decide success
silently accepts a failed `c1541`/`cartconv` invocation.
**Why it happens:** Both binaries print a message (`cannot open file
'<path>'` / `Error - Cannot open file '<path>'.` for `c1541`; nothing at all
for `cartconv` on a non-cartridge input) but still return 0.
**How to avoid:** The positive-shape oracle (`D-09`), never an exit-status
check.
**Warning signs:** A test that "passes" against a deliberately broken input
fixture is the tell — `PREP-04`'s own non-vacuous control (`D-12`) exists
specifically to catch a regression back to exit-status checking.

MEASURED this session (reproducing CONTEXT.md's own measurement independently):

```
$ /usr/bin/c1541 -attach /nonexistent-test-image.d64 -dir; echo "EXIT=$?"
cannot open file `/nonexistent-test-image.d64'
OPENCBM: opening dynamic library libopencbm.so failed!
Error - Cannot open file `/nonexistent-test-image.d64'.
EXIT=0
```

### Pitfall 2: `petcat` exits 0 on garbage input, 1 ONLY on a missing file

**What goes wrong:** Treating `petcat`'s exit code as a general error signal
covers exactly one failure class (file-not-found) and silently passes
"successfully" detokenized junk on every other input.
**Why it happens:** `petcat` decodes whatever bytes it is given as if they
were tokenized BASIC; a non-BASIC file produces PETSCII noise, not a refusal.
**How to avoid:** The same positive-shape oracle (the `;<path> ==<hex>==`
banner is present regardless of whether the content downstream is garbage,
but `PREP-02`'s own logic — extracting a SYS target — is what actually
catches unparseable content, by finding no `SYS` token and issuing a named
decline).
**Warning signs:** A "successful" decode with no recognisable BASIC keywords
in the output.

MEASURED this session:

```
$ /usr/bin/petcat -2 /nonexistent-test-file.prg; echo "EXIT=$?"
/usr/bin/petcat: Can't open file /nonexistent-test-file.prg
EXIT=1
```

### Pitfall 3 (Pitfall 11 in CONTEXT.md numbering): the fork/stock binary shadowing hazard

**What goes wrong:** A bare-name spawn (`spawn("c1541", ...)`) resolves
whichever build appears first on `$PATH`, independent of which `x64sc` build
this process is actually driving.
**Why it happens:** Both a stock package build and this project's fork build
install their full VICE toolset (`x64sc`, `c1541`, `petcat`, `cartconv`) under
different prefixes, and both are on `$PATH` simultaneously on a dev host.
**How to avoid:** `D-13`'s sibling-of-`x64sc` resolution (Pattern 2 above),
never a bare name.
**Warning signs:** `c1541`/`petcat` disagreeing with `x64sc` about a disk
format detail, or a version-mismatch symptom with no version string to check
against (`D-14` deliberately removes version probing, making this pitfall
harder to diagnose after the fact if the resolution logic is wrong — all the
more reason to get the resolution logic right rather than rely on a
diagnostic).

MEASURED this session:

```
$ ls -la /usr/bin/c1541 /usr/local/bin/c1541
-rwxr-xr-x 1 root root  373688 30 dec  2024 /usr/bin/c1541        (stock VICE 3.9)
-rwxr-xr-x 1 root root 1890184 26 aug 22.09 /usr/local/bin/c1541  (fork build)
```

### Pitfall 4: The `OPENCBM` noise line defeats any "stderr non-empty" heuristic

**What goes wrong:** A negative oracle ("stderr has content → failure")
fails on literally every `c1541` invocation on this host.
**Why it happens:** `c1541` prints `OPENCBM: opening dynamic library
libopencbm.so failed!` on every single call, success or failure, because this
build was compiled with OpenCBM (real hardware IEC-bus) support that has
nothing to do with disk-image file operations.
**How to avoid:** Positive-shape oracle only; never treat non-empty
stderr/stdout noise as signal.
**Warning signs:** 100% of test runs "fail" under a naive stderr check —
this is not flaky, it is deterministic and was the decisive measured case
that ruled out negative-oracle designs in the discuss-phase session.

### Pitfall 5: `petcat`'s tokenizer requires lowercase BASIC keywords

**What goes wrong:** Hand-authoring a computed-`SYS` fixture's source text
with `SYS` (uppercase) silently produces a NON-tokenized program — the
tokenizer treats it as literal PETSCII text instead of the `SYS` token.
**Why it happens:** [CITED: vice-emu.sourceforge.io/vice_16.html — official
VICE manual, petcat chapter] states tokenizer keyword input must be
lowercase; VERIFIED independently this session by direct construction (see
Code Examples below): an uppercase-keyword source round-tripped through
`petcat -w2` produced garbled PETSCII output (`valvalgo(43)...`) instead of a
`SYS`/`PEEK` token stream, while the identical source with lowercase
keywords produced the correct byte-exact tokenization.
**How to avoid:** Always author `.bas` fixture source with lowercase BASIC
keywords when driving `petcat -w<version>` to tokenize it.
**Warning signs:** A round-trip decode (`petcat -2` on the freshly tokenized
`.prg`) that does not echo the original keyword text back verbatim.

### Pitfall 6: `c1541 -dir` output alone cannot supply `first_track`/`first_sector`

**What goes wrong:** Assuming `c1541.dir`'s output is a complete replacement
for `d64-parse.mjs`'s `entries[]` (which includes `first_track`/
`first_sector` per file) leaves the fakery detector (`D-06`) with no data to
cross-reference against the BAM.
**Why it happens:** `-dir`'s per-line format (`178  "bruce lee   (dc)" prg`,
MEASURED this session against `danish.d64`) carries the block count and name
only.
**How to avoid:** `c1541.entry` is the only route to first T/S (`D-02`) —
`c1541.dir` and `c1541.entry` are BOTH required for the ported fakery
detector, not substitutes for each other.
**Warning signs:** A port of `D-06`'s signature 3 (first-track-fully-free
check) that only calls `c1541.dir`.

### Pitfall 7: `d64-parse.mjs`'s directory walk has a cycle guard; `c1541`'s does not

**What goes wrong:** Porting the fakery detector without reproducing the
visited-set cycle guard leaves a self-referential/cyclic `Next directory T/S`
chain able to hang the walk.
**Why it happens:** `c1541 -entry`'s own directory traversal reports no
cycle guard (CONTEXT.md `D-06`, un-contradicted by anything read this
session).
**How to avoid:** Reproduce the guard in the container-side (or host-side)
code that repeatedly calls `c1541.entry` to walk a directory chain, keyed on
visited `(track, sector)` pairs, stopping and reporting `chain_error` on a
repeat — exactly `d64-parse.mjs`'s own `parseDirectory()` behaviour (verbatim
quote below, VERIFIED).
**Warning signs:** An infinite loop or timeout when walking a directory on a
deliberately corrupted fixture image.

[VERIFIED: src/skills/c64-ram-capture/scripts/d64-parse.mjs:164-193, read
this session]:
```
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
    }
    if (nextTrack === 0) break; // end of chain, by DOS convention
```

### Pitfall 8: The unowned `mkdtemp` scratch-file race (carried fix, `D-27`)

**What goes wrong:** A test-suite run intermittently shows 3-4 failures that
are not a real regression.
**Why it happens:** [VERIFIED:
src/mcp/vice/skill-honesty-checks.test.ts:97-109, read this session] —
`runCiScriptWithScratchFile()` writes a **fixed-name** scratch file
(`zz-scratch-in03-negative.md`, etc.) directly under
`src/skills/acme-build/` — deliberately inside a directory
`check-skill-fork-honesty.mjs`/`check-skill-tool-coverage.mjs` walks, because
a tmpdir file would never be seen by the scanner it is testing:
```
  const scratchFile = join(ROOT, "src", "skills", "acme-build", scratchRelPath);
  writeFileSync(scratchFile, content, "utf8");
```
Node's test runner executes test files concurrently, so a directory-walking
test (`audit-root-args.test.ts`) can observe this file mid-write or mid-delete
from a different, concurrently-running test file. A second, structurally
identical site exists under `resources/vendor/dxa/` (RETROSPECTIVE.md, v0.8.0
close, un-re-verified line numbers this session — treat as a pointer, not a
citation).
**How to avoid:** The named fix idiom is `mkdtempSync`, already used
correctly elsewhere in this exact tree — [VERIFIED:
src/mcp/vice/dxa-live.test.ts:201,279, read this session]:
```
    const scratch = mkdtempSync(join(tmpdir(), "dxa-live-boundary-"));
```
— but note `dxa-live.test.ts`'s own usage puts the temp directory OUTSIDE the
repo entirely (`tmpdir()`), which is the wrong shape for
`skill-honesty-checks.test.ts`'s case: that scratch file must stay INSIDE
`src/skills/acme-build/` for the scanner under test to see it at all. The
applicable fix is therefore `mkdtempSync(join(ROOT, "src", "skills",
"acme-build", "zz-scratch-"))` — a uniquely-named subdirectory INSIDE the
walked tree, not outside it — so concurrent runs no longer collide on the
same fixed filename while the scanner still walks over it.
**Warning signs:** An intermittent (not deterministic) 3- or 4-failure count
on an otherwise green suite run.

### Pitfall 9: The skill-count arithmetic in `D-17` does not match this session's directory listing

**What goes wrong:** CONTEXT.md's `D-17` states "Two new skills, six →
eight." MEASURED this session: `ls src/skills/` returns **seven** existing
directories (`acme-build`, `c64-memory-mapping`, `c64-program-recon`,
`c64-provenance-diff`, `c64-ram-capture`, `routine-queue-walker`,
`vice-wedge-triage`), not six.
**Why it happens:** Unclear from anything read this session — possibly a
stale count carried from an earlier phase, or `D-17`'s "six" refers to a
different accounting (e.g. skills at the moment `c1541`+`cartconv` was still
one merged skill proposal, before the mid-discussion split). The `at least 6`
assertions in `skill-description-overlap.test.ts:308-309,348-349` (VERIFIED,
read this session) are relation-based and stay trivially satisfied either
way, so nothing is BLOCKED by this discrepancy — but a planner should not
silently carry the "eight" total forward into a task description or a commit
message.
**How to avoid:** State the actual post-phase total as **nine** (7 existing +
2 new), not eight, in any plan artifact, OR flag this to the user as a
confirmation item before committing to phrasing. See Assumptions Log.
**Warning signs:** None functional — this is a documentation-accuracy issue
only. `scripts/check-skill-tool-coverage.mjs:3` and
`scripts/lib/skill-descriptions.mjs:68` both carry literal "six skills" prose
(VERIFIED, read this session) that is ALREADY stale today (seven skills
exist, not six) — this phase's two new skills make it stale by a larger
margin, and `D-19`'s re-cut work is a natural place to fix this prose too,
though CONTEXT.md does not explicitly ask for it.

## Code Examples

### The computed-`SYS` fixture (D-23) — built and round-tripped this session

CONTEXT.md's `D-23` asks for a tiny, authored `.prg` whose BASIC stub does a
computed `SYS` (its own worked example: `SYS PEEK(43)+256*PEEK(44)`). This
session built and verified one directly, discovering that `petcat` itself is
the simplest authoring tool (no `acme.build` seam call, no hand-assembly
needed) — MEASURED, this is a genuine finding beyond what CONTEXT.md
recorded:

```bash
# Source text MUST use lowercase BASIC keywords (Pitfall 5).
$ printf '10 sys peek(43)+256*peek(44)\n' > computed-sys.bas
$ /usr/bin/petcat -w2 -o computed-sys.prg -- computed-sys.bas
$ xxd computed-sys.prg
00000000: 0108 1708 0a00 9e20 c228 3433 29aa 3235  ....... .(43).25
00000010: 36ac c228 3434 2900 0000                 6..(44)...
# 0108 = load addr $0801; 1708 = next-line ptr; 0a00 = line 10;
# 9e = SYS token; 20 = space; c2 = PEEK token; 28/29 = ( );
# "343 3"/"3434" = ASCII "43"/"44"; aa = +; "323536" = "256"; ac = *;
# 00 = end of line; 00 00 = end of program. 18 bytes total.

# Round-trip confirms petcat itself agrees this is a valid computed SYS:
$ /usr/bin/petcat -2 computed-sys.prg
;computed-sys.prg ==0801==
   10 sys peek(43)+256*peek(44)
```

This is a smaller, more directly-verifiable authoring route than either
alternative `D-23` names (the `acme.build` seam, or hand-assembling ~20
tokenized bytes) — `petcat -w2` IS the tokenizer, so there is no risk of a
hand-assembled fixture disagreeing with what `petcat -2` itself will decode.
Recommend the plan use this exact recipe for the fixture-authoring task,
committing both `computed-sys.bas` (the readable source of truth) and the
tokenized `.prg` (pinned by sha256, per `D-25`'s convention for the
synthetic `.d64`).

### Confirming the literal-SYS fast path still works (regression check against the existing fixture)

```bash
$ /usr/bin/petcat -2 src/mcp/vice/fixtures/dxa/basic-stub.prg
;src/mcp/vice/fixtures/dxa/basic-stub.prg ==0801==
   10 sys2064
```
MEASURED this session, confirming CONTEXT.md's own claim independently.

### `c1541 -entry`'s exact output shape (grounds `c1541.entry`'s classifier and `D-06`'s port)

```bash
$ /usr/bin/c1541 -attach danish.d64 -entry "bruce*"
Next directory T/S: 0/255
Type: 0x82: prg
T/S: 17/0,  178 blocks
Name: 42 52 55 43 45 20 4c 45 45 20 20 20 28 44 43 29
Side sector T/S: 0/0,  Record length: 0
@-replacement T/S: 0/0
GEOS: IT/S: 0/0
GEOS: struct: 00,  type: 00
GEOS: YY/mm/dd hh:mm 0/0/0 0:0
```
MEASURED this session, against a real corpus image
(`.planning/phases/23-.../evidence/corpus/danish.d64`) — confirms the `T/S:`
line CONTEXT.md's `D-09` names as `c1541.entry`'s declared success shape, and
gives the exact regex target: `/T\/S:\s*(\d+)\/(\d+),\s*(\d+)\s*blocks/`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `d64-parse.mjs` — hand-written, pure-Node `.d64` byte parser, works with no VICE running | `c1541` over the `host_tool` seam — richer data (per-sector BAM, raw entry bytes), but needs the broker up | This phase (`D-04`) | Three live tests acquire a new broker dependency they did not have before; accepted knowingly. The "works whether or not VICE happens to be up" property is deliberately given up. |
| `anno-d64.ts` — a second, MCP-side duplicate of the same disk-parsing logic | Deleted outright (`D-08`) | This phase | Removes a maintenance-burden duplicate; several unrelated modules' prose comments reference it and go stale until updated. |
| Six scattered top-level state directories (`.vice-supervisor/`, `.vice-snapshots/`, `tools/`, `.planning/incidents/`, `mcp-deps.lock.sha256`) | One `.c64-re-tools/` root with named subdirectories | This phase (`D-33`) | A consumer project gets one directory to `.gitignore` and one directory to delete, instead of five scattered entries and ~40 lines of `.gitignore` prose explaining them. |
| Exit-status-based success/failure for a host-tool invocation | Positive-shape, host-side oracle | Established for `dxa.disassemble` in Phase 35; generalised to `c1541`/`petcat` this phase | A tool that exits 0 on error (measured for two of the three VICE preprocessing binaries) can no longer silently report success. |

**Deprecated/outdated:**
- `d64-parse.mjs` and `anno-d64.ts`: both deleted this phase, not merely
  superseded. Any documentation or skill prose still citing them (several
  sites named in `D-08`) must be updated in the same phase, not left dangling.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact regex shapes proposed for the six positive-shape classifiers (Pattern 3) are a reasonable first draft, not a locked spec — CONTEXT.md's `D-09` names the SHAPE ("at least one arrow pair", "the trailer", "a T/S: line", "the banner line") but not the exact regex. | Architecture Patterns, Code Examples | Low — these are illustrative; the plan/executor should re-derive the precise pattern against the committed fixture's actual bytes, which may differ cosmetically (e.g. exact whitespace) from this session's ad-hoc probe against `danish.d64`. |
| A2 | `c1541 -bam`'s output writes nothing to a file itself (same as `dxa`/`c1541 -dir`/`-chain`/`-entry`) and therefore needs the same "capture stdout, write to outputs[0]" treatment as `dxa.disassemble` gets at `host-tool.mts:1863-1878`. | Architecture Patterns, Pattern 1 | Low — MEASURED this session that `c1541` always writes to stdout for these read-only verbs (no `-o`/output-file flag exists for `-bam`/`-dir`/`-entry`/`-chain`); confirmed by `c1541 --help` (not reproduced in full here) showing no such flag for these verbs. |
| A3 | The exact skill directory names (`c64-disk-access`, `c64-petcat`) and script file names shown in Recommended Project Structure are illustrative — CONTEXT.md's own `<decisions>` section explicitly leaves "exact new-skill directory and script names" to Claude's discretion. | Architecture Patterns | None — this is explicitly discretionary per CONTEXT.md; not a risk, a placeholder for the planner to fix. |
| A4 | The post-phase skill-count total should be stated as **nine**, not `D-17`'s literal "eight" — based on this session's own `ls src/skills/` returning seven pre-existing directories. | Common Pitfalls (Pitfall 9) | Low functional risk (no test pins an exact count), but a plan or commit message that repeats "eight" would be visibly wrong against a one-command check. |
| A5 | The second `mkdtemp`-fix site under `resources/vendor/dxa/` (referenced in RETROSPECTIVE.md alongside the `skill-honesty-checks.test.ts` site) was NOT independently re-opened and line-cited this session — only the primary site was read directly. | Common Pitfalls (Pitfall 8) | Low — RETROSPECTIVE.md's own text is itself a project artifact describing a named, accepted defect; worst case the planner spends a few extra minutes locating the second site when writing the task. |
| A6 | The `c1541`/`petcat` "official documentation" citations (vice_14.html, vice_16.html) were retrieved via WebSearch snippets, not a direct `WebFetch` of the manual pages themselves. | Common Pitfalls (Pitfall 5), Standard Stack | Low — every specific behavioural claim attributed to these citations was ALSO independently reproduced by direct live invocation this session; the citation is corroboration, not the sole source. |

## Open Questions

1. **Where exactly does `PREP-02`'s literal-vs-computed `SYS` parse live —
   host-side (inside `host-tool.mts`, as part of the response construction)
   or container-side (inside the new `petcat.mjs` skill script, reading the
   detokenized listing file `petcat.decode` already wrote)?**
   - What we know: `D-22` places the DETOKENIZED LISTING in a workspace file
     and the VERDICT crosses inline (`{ entrypoint, reason }`-shaped, per
     `D-21`). This means *something* parses the detokenized text for a `SYS`
     token and either extracts a literal decimal argument or detects a
     computed expression.
   - What's unclear: CONTEXT.md's Claude's-discretion list does not name this
     specific split point, and the existing precedent (`ghidra.analyze`'s
     `outputs[0]` being the run log, always host-side; `dxa.disassemble`'s
     stdout capture, also host-side) suggests the VERDICT LOGIC could
     reasonably live in either tier.
   - Recommendation: Host-side, inside `runHostTool()`'s `petcat.decode`
     branch (immediately after the shape classifier confirms the banner line
     is present) — this keeps `D-10`'s "oracle logic lives in the seam"
     precedent consistent for the decline verdict too, and avoids the
     container-side skill script needing to re-open and re-parse the
     workspace-file listing petcat.decode itself just wrote. A regex on the
     line matching `/^\s*\d+\s+sys\s*/i` followed by either an all-digit
     remainder (literal, resolvable) or anything else (computed, decline) is
     a reasonable first cut, matching both this session's `10 sys2064`
     (literal) and `10 sys peek(43)+256*peek(44)` (computed) fixtures.

2. **Does the "six writers" `D-33` migration belong in the SAME plan as the
   two new tool ids, or a separate plan that lands first per `D-36`'s
   ordering constraint 1?**
   - What we know: `D-36` requires the migration to land "before anything
     writes new output" — this is an ordering constraint on COMMITS, not
     necessarily on PLANS; a single plan with the migration as an early task
     and the new tool ids as later tasks would satisfy it equally.
   - What's unclear: whether splitting into separate plans better isolates
     the `USE_WORKTREES_FOR_PLAN=false` carve-out (`D-36` constraint 3, for
     the ROADMAP/REQUIREMENTS amendments) from the rest of the phase's
     worktree-isolated work.
   - Recommendation: This is explicitly named as within Claude's discretion
     ("plan decomposition beyond `D-36`'s three constraints"); the planner
     should decide based on wave-parallelization concerns, not a research
     finding — flagging only because it is the single highest-leverage
     sequencing choice in the phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `c1541` (host binary) | PREP-01, all `c1541.*` tool ids | ✓ (both `/usr/bin` and `/usr/local/bin`, MEASURED) | VICE 3.9 (stock) / fork build (unversioned, `D-14`) | None needed — already present |
| `petcat` (host binary) | PREP-02, `petcat.decode` | ✓ (both `/usr/bin` and `/usr/local/bin`, MEASURED) | Same | None needed |
| `x64sc` (host binary, for `backend-detect.mts`'s resolution anchor) | `D-13`'s sibling-binary derivation | ✓ (already a hard requirement of this project) | Same | None needed |
| VICE broker / `.vice-supervisor` (or post-migration `.c64-re-tools/supervisor`) rendezvous | `c1541.read`'s host-tool-client path if routed through the broker; NOTE: `host-tool.mts` itself is reached via `host-tool-client.ts`'s own spawn, which does NOT require a live broker instance — it is a direct host-tool-client → host-tool.mts CLI invocation | ✓ / N/A | — | The `host_tool` control op's existing precedent (`acme.build`, `dxa.disassemble`) already runs with no broker acquire in the loop; `c1541`/`petcat` follow the same pattern, so no broker instance needs to be running for these tools to function |
| Node.js >= 24 | Running `host-tool.mts` unbuilt / `build.ts`'s recompile into `resources/host-tool.mjs` | ✓ (existing project requirement) | — | None needed |

**Missing dependencies with no fallback:** None — every dependency this
phase needs is already present and already a hard requirement of the
project.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `package.json:58`'s `"test": "node --test '*.test.*'"` script, run from `src/mcp/vice/` |
| Quick run command | `cd src/mcp/vice && npm run typecheck` (per `.planning/config.json`'s `build_command`) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (per `.planning/config.json`'s `test_command` — MEMORY notes this floor is 2-in-1 as of 2026-09-03, not 0; a live broker reddens BACK-05 deterministically, so stop any running broker before trusting a result) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREP-01 | `c1541.bam`/`c1541.dir`/`c1541.entry`/`c1541.chain`/`c1541.read` each return the declared shape against a real (committed synthetic, `D-25`) `.d64` | integration (spawns real `c1541`) | `node --test host-tool.test.ts` (extend the existing census pattern) | ❌ Wave 0 — new test cases inside the existing `host-tool.test.ts`, following the `dxa.disassemble` live-oracle pattern already there |
| PREP-01 (fakery detector, `D-06`) | Directory entries with a fabricated first-track are flagged `suspicious`/`suspicious_reasons`, and a cyclic chain reports `chain_error` rather than hanging | unit (against a planted-corrupt fixture) | `node --test <new-fakery-detector-port>.test.ts` | ❌ Wave 0 — new file, plus a planted-cycle fixture |
| PREP-02 | Literal `SYS` resolves to an address (fixture: `basic-stub.prg`, `10 sys2064`, MEASURED confirmed this session) | integration | `node --test host-tool.test.ts` (`petcat.decode` case) | ❌ Wave 0 — new test case; existing fixture already committed |
| PREP-02 (decline path) | Computed `SYS` produces `ok:true, entrypoint:null` with a named reason, never a guessed address | integration (against the new computed-SYS fixture, this session's recipe) | `node --test host-tool.test.ts` | ❌ Wave 0 — new fixture (`.bas` + `.prg`, see Code Examples) plus new test case |
| PREP-04 | Each tool's planted-failure fixture is refused by the shape oracle AND separately shown to PASS under a deliberately-written exit-status-only predicate, in the same test (`D-12`) | unit, two-directional | `node --test host-tool.test.ts` (one test per tool, non-vacuous control) | ❌ Wave 0 — new test cases; the exit-status-only predicate is deliberately written INSIDE the test, never imported from production code |
| N/A (`D-33` migration) | `.gitignore` and the deployed set stay in two-way parity after the path move | unit | `node --test host-scripts.test.ts` | ✅ EXISTS — `host-scripts.test.ts:120` already asserts this; must be RE-RUN, not assumed green, after the literal prefix changes from `/tools/` |
| N/A (guards that must not go red) | `scripts/check-no-skill-external-spawn.mjs`'s planted-violation controls re-run and still catch a violation | integration | `node scripts/check-no-skill-external-spawn.mjs` plus its test companion | ✅ EXISTS — `src/mcp/vice/skill-external-spawn-gate.test.ts` |
| N/A | `host-tool.test.ts`'s both-directions census (declared path-key total) updated from 17 to the new real total | unit | `node --test host-tool.test.ts` | ✅ EXISTS, needs an edit — `host-tool.test.ts:1915,1949` pin the literal `17` |

### Sampling Rate
- **Per task commit:** `npm run typecheck` (fast; catches the seven-synchronized-edit-sites class of defect immediately — a missing `HOST_TOOL_TIMEOUT_MS` entry, for instance, is a type error, not just a test failure).
- **Per wave merge:** `npm run test:automated`.
- **Phase gate:** Full suite green before `/gsd-verify-work`, PLUS a manual re-run of `check-no-skill-external-spawn.mjs`'s planted-violation controls (ROADMAP criterion 1 explicitly requires this be re-run, not assumed).

### Wave 0 Gaps
- [ ] A new or extended fakery-detector test file porting `d64-parse.test.mjs`'s synthetic-plus-real fixture posture onto `c1541`'s inputs (`D-06`, `D-25`).
- [ ] A planted-corrupt-directory-chain fixture (cyclic `Next directory T/S`) for the cycle-guard regression test (Pitfall 7).
- [ ] The computed-`SYS` fixture pair (`.bas` source + tokenized `.prg`), buildable with the exact `petcat -w2` recipe verified this session (Code Examples).
- [ ] The synthetic `.d64` fixture itself (`D-25`) — authored via a one-time, uncommitted `c1541 -format`/`-write` throwaway script, output committed and pinned by sha256.
- [ ] Six new test cases (one per tool id) for `PREP-04`'s two-directional non-vacuous control (`D-12`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Not applicable — no new auth surface. |
| V3 Session Management | no | Not applicable. |
| V4 Access Control | no | Not applicable — this is a single-user local tool, not a multi-tenant service. |
| V5 Input Validation | yes | `normaliseHostToolRequest()`'s existing refuse-unknown-keys-BY-NAME discipline, extended to the six new tool ids with the same pattern (no coercion, no silent drop) — already the project's own established control, not a new library. |
| V6 Cryptography | no | Not applicable — `createHash("sha256")` is already used for output digests (integrity, not confidentiality) and is unchanged by this phase. |
| V12 File and Resources | yes | `resolveWorkspacePath()`'s existing symlink-safe, realpath-walked confinement, extended to any new path-bearing argument (the `.d64` image path, `c1541.read`'s output-file path, `petcat.decode`'s image path and listing-output path) — no new mechanism, reuse of the existing one. |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via a wire-supplied `.d64`/`.prg` path escaping the workspace root (e.g. `../../etc/passwd`, or a symlink planted inside the workspace pointing outside it) | Tampering / Information Disclosure | `resolveWorkspacePath()` (`host-tool.mts:914-937`), already used by every existing path-bearing field; extend `HOST_TOOL_PATH_ARG_KEYS` for every new path-bearing key on the six new ids (this IS the seven-synchronized-edit-sites discipline — a key omitted here is exactly what `host-tool.test.ts`'s census test at `:1891-1915` is designed to catch). |
| Argument injection into `c1541`/`petcat` via a wire-supplied filename containing shell metacharacters or a leading `-` (interpreted as a flag) | Tampering | `spawn()` with an argv array and no shell (already the project's universal rule — `child.kill`/`spawn(toolPath, argv, ...)` never interpolates into a command string); a leading-`-` filename risk is a real, distinct residual worth naming explicitly in the plan (VICE's own CLI tools may interpret a bare `-something` filename as a flag) — recommend validating that a wire-supplied CBM filename argument (`c1541.chain`'s `name`, `c1541.entry`'s `name`) does not begin with `-`, refusing BY NAME rather than silently prefixing `./`. |
| A hung or hostile `c1541`/`petcat` process stalling the broker's single-threaded event loop | Denial of Service | Per-tool `HOST_TOOL_TIMEOUT_MS` entry with kill-on-expiry, exactly as every existing tool id already has — `host-tool.test.ts:2033-2039`'s completeness assertion (every `HOST_TOOL_IDS` member has a finite table entry) already fails CI if a new id is added without one. |
| A malformed/oversized disk image causing `digestOutputFile()` or the classifier regexes to consume excessive memory/CPU | Denial of Service | `STDERR_TAIL_CAP_BYTES`/`ORACLE_STDOUT_CAP_BYTES`-style caps already exist for other tools' captured text; the new classifiers (Pattern 3) should be written against BOUNDED capture (the existing stdout accumulation in `spawnHostTool()` has no explicit cap today for `c1541`/`petcat` — `c1541 -chain` on a maliciously long chain could, in principle, produce a very large text blob; this is a pre-existing property of `spawnHostTool()`'s stdout accumulation, not introduced by this phase, but worth flagging since a disk-image-driven verb is new attack surface for it). |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/mcp/vice/host-tool.mts` (2151 lines) — the entire seam: `HostToolId`/`HOST_TOOL_IDS` (`:139-148`), `HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS` (`:179-271`), `resolveWorkspacePath()` (`:914-937`), `buildHostToolArgv()`'s `dxa.disassemble` branch (`:1206-1245`), `DEFAULT_HOST_TOOL_TIMEOUT_MS`/`HOST_TOOL_TIMEOUT_MS` (`:1305-1348`), `spawnHostTool()` (`:1450-1503`), `runHostTool()` (`:1572-1922`), the log line (`:1861`), `runOracleRun()`'s unguarded `mkdirSync` (`:2068`, `try` opens `:2071`), the CLI entry point's un-`.catch()`'d `.then()` (`:2145`).
- `src/mcp/vice/host-tool-client.ts` — the correct `.catch()` shape (`:398-427`).
- `src/mcp/vice/host-tool.test.ts` — the census (`:1819-1949`), the pinned `17` (`:1915,1949`), the timeout completeness test (`:2033-2039`).
- `src/mcp/vice/backend-detect.mts` — `HELP_FLAG_CANDIDATES`/`probeBackend()` (`:105-154`), the memoise pattern (`:396,452-479`), `binPath`/`binPathResolved` (`:339-366`).
- `src/mcp/vice/repo-root.ts` — `supervisorDir()` (`:188-190`).
- `src/mcp/vice/vice-broker.mts` — the `.vice-supervisor` fallback chain (`:123`).
- `src/mcp/vice/install-resources.ts` — `installTargetDir()` (`:91-93`).
- `src/mcp/vice/module-classification.ts` — `anno-d64.ts`'s registration (`:405-418`).
- `src/mcp/vice/host-scripts.test.ts` — the two-way `/tools/` parity gate (`:102-127`).
- `src/skills/c64-ram-capture/scripts/d64-parse.mjs` — header (`:1-11`), the fakery signatures (`:164-193`).
- `src/skills/acme-build/scripts/acme.mjs` — `invokeSeam()` (`:39-95`).
- `src/mcp/vice/skill-honesty-checks.test.ts` — the mkdtemp-fix culprit (`:97-135`).
- `src/mcp/vice/dxa-live.test.ts` — the mkdtemp-fix precedent (`:201,279`).
- `src/mcp/vice/capability-registry.ts` — `providedBy` shape (`:74-224`, sampled).
- `src/mcp/vice/skill-description-overlap.test.ts` — the "at least 6" relation-based assertions (`:308-309,348-349`).
- `.gitignore` — the current six-writer stanzas (`:7-28,49,150-157`).
- Live shell commands against `/usr/bin/c1541`, `/usr/bin/petcat`, `/usr/local/bin/c1541`, `/usr/local/bin/petcat` (this session, exact commands and outputs reproduced in Code Examples / Common Pitfalls).

### Secondary (MEDIUM confidence)
- [VICE Manual, Chapter 14 (c1541)](https://vice-emu.sourceforge.io/vice_14.html) — command-line option reference, corroborates measured exit-0-on-success/failure convention.
- [VICE Manual, Chapter 16 (petcat)](https://vice-emu.sourceforge.io/vice_16.html) — `-w<version>` tokenizer option, lowercase-keyword requirement (independently reproduced this session, see Pitfall 5).

### Tertiary (LOW confidence)
- `.planning/RETROSPECTIVE.md`'s reference to a second `mkdtemp`-fix site under `resources/vendor/dxa/` — named but not independently line-cited this session (see Assumptions Log A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new package; every binary version/path claim is MEASURED this session.
- Architecture: HIGH — the extension pattern is a direct copy of five existing, working tool-id branches, all read this session with line numbers.
- Pitfalls: HIGH — every load-bearing exit-code/output-shape claim was independently reproduced live this session, not merely re-cited from CONTEXT.md.

**Research date:** 2026-09-08
**Valid until:** 30 days (stable — the underlying seam and the host binaries are not expected to change on this timeframe; re-verify the binary paths/exit codes if the host's VICE packages are upgraded in the interim).
