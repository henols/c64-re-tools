# Phase 35: dxa, Vendored and Parsed - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 11
**Analogs found:** 9 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/dxa-listing.ts` | utility (parser/transform) | transform | `.planning/phases/23-.../evidence/dxa-listing-parse.mjs` (port), structurally like `ghidra-project.mts`'s pure-module role | exact (source to port) |
| `src/mcp/vice/dxa-run.ts` | service (orchestration) | request-response / file-I/O | `ghidra-project.mts` + the `ghidra.analyze` branch in `host-tool.mts`/`host-tool-client.ts` callers | role-match |
| `src/mcp/vice/dxa-partition.ts` | utility (transform) | transform / batch | `.planning/phases/23-.../evidence/fixture/fixture-baseline.mjs` (port) | exact (source to port) |
| `src/mcp/vice/dxa-listing.test.ts` | test | unit | any `*-project.test.ts` pure-module test (e.g. `ghidra-project.test.ts`) | role-match |
| `src/mcp/vice/dxa-partition.test.ts` | test | unit | `ghidra-project.test.ts` | role-match |
| `src/mcp/vice/dxa-build-gate.test.ts` | test (structural/digest) | file-I/O | `ensure-mcp-deps.sh`'s hash-gate idiom (bash, no direct test analog) — closest test-shape analog is `acme-gate.test.ts` (digest/gate style, "never added to MANUAL_ONLY_TESTS") | role-match |
| `src/mcp/vice/<manual-only-live-test>.ts` (name TBD, e.g. `dxa-live.test.ts`) | test (live/manual) | event-driven / file-I/O | `fork-live.test.ts` / `stock-live.test.ts` | exact |
| `src/mcp/vice/host-tool.mts` (modified) | service (execution seam) | request-response | itself — `acme.build` branch is the in-file precedent for the new `dxa.disassemble` branch | exact |
| `src/mcp/vice/resources/host-tool.mjs` (compiled, modified) | config/generated | — | `build.ts` + `resources-sync.test.ts` (compile-and-check pattern) | exact |
| `src/mcp/vice/hostpath-consumers.test.ts` (modified) | test (structural) | — | itself — `HOST_TOOL_FAMILY_FLOOR` already anticipates `dxa-listing.ts`/`dxa-run.ts` by name | exact |
| `src/mcp/vice/vendor/dxa/build.bash` | config/build script | batch | `scripts/ensure-mcp-deps.sh` (hash-gated idempotent provisioning script) | role-match |
| `src/mcp/vice/THIRD-PARTY-NOTICES.md` (modified) | doc/config | — | itself (existing "Incorporated material — cc65 (zlib)" section is the section-shape precedent) | exact |
| `.github/workflows/ci.yml` (modified, if needed) | config | — | existing `Test`/`typecheck` steps (no new directory needed — see Placement Guard below) | n/a — likely NO CHANGE NEEDED |

## Pattern Assignments

### `src/mcp/vice/dxa-listing.ts` (utility, transform)

**Analog:** `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/dxa-listing-parse.mjs` (read in full this session)

**Core pattern — port verbatim, one regex, refuse-by-name on mismatch:**
```javascript
const DUMP_LINE_RE = /^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$/;

export function parseDumpListing(text, imageSize) {
  const code = new Set(), data = new Set();
  let accounted = 0;
  for (const line of text.split("\n")) {
    const m = DUMP_LINE_RE.exec(line);
    if (m === null) continue;                       // label-only / mid-instruction lines
    const address = parseInt(m[1], 16);
    const bytes = m[2].trim().split(/ +/);
    const isData = m[3].startsWith(".byt") || m[3].startsWith(".word");
    const target = isData ? data : code;
    for (let i = 0; i < bytes.length; i += 1) { target.add(address + i); accounted += 1; }
  }
  if (accounted !== imageSize) {
    throw new Error(
      `dxa-listing-parse: accounted byte total ${accounted} does not equal ` +
      `expected image size ${imageSize}. Refusing to report an under-counted classification.`
    );
  }
  return { code, data, accounted };
}
```
Do NOT re-derive this regex or grammar — it is already proven against the rebuilt 279-byte fixture (`PARSE_ACCOUNTED_BYTES: 279`, exact match). Add `unclassified` handling for overlapping decodes per DXA-02 (not present in the ported source — new logic, stated-reason required, never a forced winner).

**Import discipline (Pitfall 6):** this module must NEVER import `hostpath.ts`. It receives an already-container-translated file path (via `containerPath()`, done by the caller — `dxa-run.ts`) and only reads/parses text. Mirrors `host-tool-client.ts`'s own header discipline: *"never through `hostpath.ts`, which this file must NEVER import"* (`src/mcp/vice/host-tool-client.ts:29-38`).

---

### `src/mcp/vice/dxa-run.ts` (service, request-response/file-I/O)

**Analogs:** `ghidra-project.mts` (pure-module split pattern) + the `ghidra.analyze` request path in `host-tool.mts:1011-1041` and its caller-side counterpart.

**Split-module pattern (from `ghidra-project.mts:1-40` header):** container-side orchestration that resolves paths through `resolveWorkspacePath()` / receives paths back from the host-tool seam, builds the typed request, and hands the digested output to the pure parser — never itself doing raw `child_process.spawn`:
```
// ghidra-project.mts's own header states the THIS-IS-THE-ONE-AUTHORITATIVE-
// PLACE discipline dxa-run.ts should mirror for orchestration specifics
// (never re-derived in host-tool.mts, which reaches these by value-importing
// this module's compiled .mjs sibling instead).
```

**Core call pattern** — build a typed `HostToolRequest`, call through the seam, never `child_process.spawn` directly (SEAM-05's `BANNED_COMMAND_SHAPES` already lists `dxa`):
```typescript
// Mirrors: runHostToolFromContainer({ tool: "ghidra.analyze", args: {...} })
// dxa-run.ts's equivalent:
const result = await runHostToolFromContainer({
  tool: "dxa.disassemble",
  args: { image: imagePath, entrypointsPath, datablocksPath, outDir },
});
// result.results carries { path, sha256, byteLength } per digested output file
// (host-tool.mts's HostToolFileResult shape) -- never raw listing bytes over
// the wire. dxa-run.ts then reads the file at the CONTAINER-translated path
// (containerPath(), never hostPath()) and hands its text to
// dxa-listing.ts::parseDumpListing().
```

**Import discipline (Pitfall 6):** `dxa-run.ts` never imports `hostpath.ts` — it only ever sees paths already translated by the host-tool response, exactly as `ghidra.analyze` callers do today.

---

### `src/mcp/vice/host-tool.mts` (modified — add `dxa.disassemble`)

**Analog:** itself — the existing `acme.build` branch throughout the file, verbatim shape.

**1. `HostToolId` union** (`host-tool.mts:109`):
```typescript
export type HostToolId = "acme.build" | "ghidra.analyze" | "oracle.probe" | "oracle.run" | "dxa.disassemble";

export const HOST_TOOL_IDS: readonly HostToolId[] = Object.freeze([
  "acme.build",
  "ghidra.analyze",
  "oracle.probe",
  "oracle.run",
  "dxa.disassemble",
]);
```

**2. `HOST_TOOL_ARG_KEYS`** (`host-tool.mts:138-150`), following the `acme.build` entry's exact shape:
```typescript
"acme.build": Object.freeze(["source", "outDir", "format", "setpc", "defines", "includes", "noReport"]),
// new entry, candidate fields per RESEARCH.md Pattern 1 (image, entrypointsPath,
// datablocksPath, outDir):
"dxa.disassemble": Object.freeze(["image", "entrypointsPath", "datablocksPath", "outDir"]),
```

**3. `HOST_TOOL_PATH_ARG_KEYS`** (`host-tool.mts:170-177`) — all four dxa fields are path-bearing, mirroring `acme.build`'s `source`/`outDir`/`includes`:
```typescript
"acme.build": Object.freeze(["source", "outDir", "includes"]),
"dxa.disassemble": Object.freeze(["image", "entrypointsPath", "datablocksPath", "outDir"]),
```

**4. Args interface**, mirroring `AcmeBuildArgs` (`host-tool.mts:179-187`):
```typescript
export interface DxaDisassembleArgs {
  image: string;
  entrypointsPath?: string;
  datablocksPath?: string;
  outDir?: string;
}
```

**5. `buildHostToolArgv()` branch**, mirroring the `acme.build` branch (`host-tool.mts:634-671`) — fixed flags first (Pattern 2's exact skeleton `-g 0000 -p all-nmos6502 -d skip-scanning -t detect-internal -R <entrypoints> -B <datablocks> -a dump`), then resolved paths, deterministic argv, `toolPath` resolved from a vendored fixed location (per RESEARCH.md Open Question 1's recommendation) — NOT an env-var like `ACME_BIN`, since dxa is vendored+built by this project, not a declared host prerequisite:
```typescript
if (request.tool === "dxa.disassemble") {
  const { imagePath, entrypointsPathResolved, datablocksPathResolved, outDirPath } = resolved as ResolvedDxaDisassemblePaths;
  const dxaPath = join(dirname(fileURLToPath(import.meta.url)), "vendor", "dxa", "dxa"); // fixed, computed path
  const argv: string[] = ["-g", "0000", "-p", "all-nmos6502", "-d", "skip-scanning", "-t", "detect-internal"];
  if (entrypointsPathResolved) argv.push("-R", entrypointsPathResolved);
  if (datablocksPathResolved) argv.push("-B", datablocksPathResolved);
  argv.push("-a", "dump", imagePath);
  return { ok: true, toolPath: dxaPath, argv, outputs: [/* listing output path */] };
}
```

**6. `runHostTool()` request-resolution branch**, mirroring `acme.build`'s block (`host-tool.mts:979-1010`) — resolve `image`/`entrypointsPath`/`datablocksPath`/`outDir` each through the SAME `resolveWorkspacePath()` site `acme.build`'s `source` uses; first refusal returns unchanged (no partial-success degradation).

**7. `HOST_TOOL_TIMEOUT_MS`** (`host-tool.mts:765`) — add a `"dxa.disassemble": <value>` entry alongside `"acme.build": DEFAULT_HOST_TOOL_TIMEOUT_MS`.

**8. Result envelope** (`host-tool.mts:808`) — widen the `ok: true` union member to include `"dxa.disassemble"`:
```typescript
| { ok: true; tool: "acme.build" | "ghidra.analyze" | "dxa.disassemble"; exitStatus: number | null; results: HostToolFileResult[]; stderrTail: string }
```

`[VERIFIED: src/mcp/vice/host-tool.mts:90-1070, read this session]`

---

### `src/mcp/vice/vendor/dxa/build.bash` (build script)

**Analog:** `scripts/ensure-mcp-deps.sh` — hash-checked, idempotent provisioning-script style. (No direct excerpt taken — RESEARCH.md's own Installation section under Standard Stack already supplies the exact command sequence: write the sha256 pin BEFORE fetch, `curl` fetch, `sha256sum -c`, `tar xzf --strip-components=1`, `make`, then `sha256sum` the produced binary against the pinned `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` digest.)

**CRITICAL naming constraint (Pitfall 3):** name it `build.bash`, NOT `build.sh` — `host-scripts.test.ts:202-208` pins `EXPECTED_TRACKED_SHELL_SCRIPTS` to exactly 5 entries via `git ls-files -- "*.sh"`. A sixth tracked `.sh` file reds that test.

---

### `src/mcp/vice/THIRD-PARTY-NOTICES.md` (modified)

**Analog:** itself — existing "Incorporated material — cc65 (zlib)" section shape (`THIRD-PARTY-NOTICES.md:1-15`, read this session):
```markdown
**No GPL-licensed material is incorporated into this package: no GPL-licensed
material appears anywhere in `@henols/vice-mcp`'s source or its published
tarball.** Every source named below is either zlib-licensed (incorporated),
reference-only (nothing copied), or a build/test-time subprocess whose
licence therefore never attaches to anything shipped.

## Incorporated material — cc65 (zlib)
...
```
This opening sentence MUST be edited (Pitfall 1) in the SAME commit that adds `vendor/dxa/`, and a new `## Incorporated material — dxa (GPL-2.0-or-later)` section added, quoting `main.c`'s header verbatim (RESEARCH.md Pitfall 2 supplies the exact text) and noting the per-file copyright-year variance rather than flattening it.

---

### `src/mcp/vice/hostpath-consumers.test.ts` (modified)

**Analog:** itself — `HOST_TOOL_FAMILY_FLOOR` (`hostpath-consumers.test.ts:447`) and the named-absence test (`:507-518`) already anticipate `dxa-listing.ts`/`dxa-run.ts` by name.

**Exact change required:**
```typescript
// currently:
const HOST_TOOL_FAMILY_FLOOR = 2 + 1;
// must become, in the SAME commit that adds dxa-listing.ts + dxa-run.ts:
const HOST_TOOL_FAMILY_FLOOR = 2 + 1 + 2; // = 5, naming the plan that raised it
```
Per that test's own instruction: "do NOT adjust the literal to fit... [without] naming the plan" — the comment above the literal must cite this phase.

`[VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:440-518, read this session]`

---

### `src/mcp/vice/<manual-only-live-test>.ts` (test, live/manual)

**Analog:** `fork-live.test.ts` (`fork-live.test.ts:1-40`, read this session) — identical shape to `stock-live.test.ts`.

**Default-SKIP-with-env-var-opt-in pattern:**
```typescript
// DEFAULT-SKIP IS MANDATORY: npm test globs this file via *.test.*, and CI
// has no dxa build. SKIP_REASON is computed once, and EVERY test in this
// file passes it through node:test's own { skip } option -- never a
// hand-rolled early return, which would report a false PASS rather than a
// SKIP. Registered in test-gate.mjs's MANUAL_ONLY_TESTS (the ONE list) as
// the [Nth] manual-only file, so npm run test:automated never runs it either.
// Named by absolute-path env var (e.g. VICE_LIVE_DXA_BIN or similar),
// never a bare command name.
```

**Where the list itself lives:** `src/mcp/vice/test-gate.mjs`, `export const MANUAL_ONLY_TESTS = Object.freeze([...])` at line 95. The file's own header (`test-gate.mjs:1-24`) states: "If a ninth file needs the same treatment, add it to `MANUAL_ONLY_TESTS` below and nowhere else" — the drift guard (`test-gate.test.ts`) fails the build if a test file escapes both this list and the automated set. This must be updated in the SAME commit as the new test file (per Wave 0 requirements in VALIDATION.md).

`[VERIFIED: src/mcp/vice/fork-live.test.ts:1-40, src/mcp/vice/test-gate.mjs:1-127, read this session]`

---

### `src/mcp/vice/vendor/dxa/*.c,*.h,Makefile` (vendored source tree)

**No analog** — this is the first vendored-and-built (as opposed to purely referenced) GPL source tree in this repo. Treat `THIRD-PARTY-NOTICES.md`'s existing "reference-only" vs "incorporated" distinction (see above) as the closest existing framework, but the build-from-source mechanics have no precedent to copy.

---

## Shared Patterns

### Host-tool allowlist extension
**Source:** `src/mcp/vice/host-tool.mts:90-1070` (the `acme.build` branch, in full)
**Apply to:** `dxa-run.ts`, `host-tool.mts`'s own modification
Every new `HostToolId` member requires SIX synchronized edits in `host-tool.mts`: (1) `HostToolId` union, (2) `HOST_TOOL_IDS` array, (3) `HOST_TOOL_ARG_KEYS` entry, (4) `HOST_TOOL_PATH_ARG_KEYS` entry, (5) a `Resolved*Paths` interface + `buildHostToolArgv()` branch, (6) `HOST_TOOL_TIMEOUT_MS` entry, plus the `runHostTool()` per-field `resolveWorkspacePath()` resolution block. Skipping any one produces an inconsistent allowlist that a data-driven census test (`host-tool.test.ts`) is designed to catch.

### `hostpath.ts` import ban for the host-tool family
**Source:** `src/mcp/vice/host-tool-client.ts:29-38`, enforced by `src/mcp/vice/hostpath-consumers.test.ts:495-518`
**Apply to:** `dxa-listing.ts`, `dxa-run.ts`
Neither new module may import `hostpath.ts` directly — both reach host paths only through `containerPath()`, receiving already-translated paths from the host-tool response envelope.

### Build-then-commit-only-the-.mjs discipline
**Source:** `src/mcp/vice/build.ts` (header, lines 1-11) + `resources-sync.test.ts`
**Apply to:** `host-tool.mts` (any modification to it requires a matching, committed, banner-marked `resources/host-tool.mjs` recompile — `resources-sync.test.ts` fails CI on drift). Note: confirm whether `host-tool.mts` is actually one of `build.ts`'s compiled sources (its header currently names only `vice-broker.mts` and siblings) before assuming this applies; if `host-tool.mts` is NOT host-bound/compiled today, this phase's edit to it may not trigger a `resources/*.mjs` recompile at all — verify against `build.ts`'s own source list at plan time.

### Digest-not-exit-code refusal discipline
**Source:** `.planning/phases/23-.../evidence/dxa-listing-parse.mjs` (byte-total refusal) + RESEARCH.md's own "Treating dxa's exit status as the refusal signal" anti-pattern
**Apply to:** `dxa-listing.ts`, `dxa-build-gate.test.ts`
Never treat a spawned dxa process's exit code (or `sha256sum -c`'s exit code, framed loosely) as the sole pass/fail signal where a stronger, named, thrown assertion is available — `dxa-listing.ts` throws by name on byte-total mismatch; `dxa-build-gate.test.ts` compares digests directly, never merely "did the build script exit 0."

### `.bash` not `.sh` for new tracked shell scripts
**Source:** `src/mcp/vice/host-scripts.test.ts:202-208`
**Apply to:** `vendor/dxa/build.bash`, any future ground-truth-partition-adjacent shell tooling
`EXPECTED_TRACKED_SHELL_SCRIPTS` is a hand-pinned 5-entry array over `git ls-files -- "*.sh"`. New scripts must be named `.bash` or the array must be deliberately extended in the same commit.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/mcp/vice/vendor/dxa/*.c, *.h, Makefile` | vendored source | file-I/O (build) | First vendored-and-built GPL C source tree in the repo; no prior "vendor a native tool's source and build it" precedent exists (`acme`/`ghidra` are both declared host prerequisites, never vendored) |
| `.github/workflows/ci.yml` | config | — | Likely **no change needed** per VALIDATION.md's Placement Guard: all new tests must live under `src/mcp/vice/*.test.ts` (already covered by `FROZEN_REGISTRY["src/mcp/vice"]`, `proof: "npm test"`), never under a new `vendor/dxa/` test directory that would require a new `ci-suite-coverage.test.ts` registry entry and CI step. Confirm this holds before editing `ci.yml` at all. |

## Metadata

**Analog search scope:** `src/mcp/vice/` (host-tool.mts, host-tool-client.ts, ghidra-project.mts, ghidra-project.test.ts, fork-live.test.ts, stock-live.test.ts, test-gate.mjs, hostpath-consumers.test.ts, anno-types.ts, THIRD-PARTY-NOTICES.md, host-scripts.test.ts, build.ts), plus `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/` (dxa-listing-parse.mjs, fixture/fixture-baseline.mjs, SCHEMA.md).
**Files scanned:** ~15 read directly this session (targeted ranges, no full-file reads over 2,000 lines).
**Pattern extraction date:** 2026-09-04
