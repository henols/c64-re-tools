# Phase 59: The Tool-Location Seam and Its Precedence Order - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 7 (2 new source files, 1 new build artifact, 4 modified)
**Analogs found:** 7 / 7

All cited analog paths were verified with `git ls-files -- <path>` and are
tracked source (none are gitignored mirrors):
`src/mcp/vice/host-tool.mts`, `src/mcp/vice/backend-detect.mts`,
`src/mcp/vice/build.ts`, `src/mcp/vice/tsconfig.build.json`,
`src/mcp/vice/prerequisites.json`, `src/mcp/vice/prerequisites.test.ts`,
`src/mcp/vice/vice-errors.ts`, `src/mcp/vice/host-scripts.test.ts`,
`src/mcp/vice/resources/vice-launcher.sh`, `src/mcp/vice/repo-root.ts`.

**Hazard reminder for the planner/executor:** `src/mcp/vice/prerequisites.test.ts`
contains a real NUL byte (from a `.join()` separator written literally, not
as `\0`) and `src/mcp/vice/anno-memmap-render.ts` also does. Plain `grep`
silently skips both with zero matches and zero warning — every content
census over either file in this phase's tasks must use `grep -a`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/<seam>.mts` (planner names it; must not be `host-tool-*`) | service / utility (host-bound location-resolution seam) | request-response (one id in, one result out; no caching, no stream) | `src/mcp/vice/backend-detect.mts` (`resolvedBackend()`) for the per-call resolve shape; `src/mcp/vice/host-tool.mts` (`findDxaBinary`/`findAcmeLib`/`findSiblingBinary`) for the probe/candidate-list idiom | exact (role + data flow both match; this seam is explicitly modeled as "the four existing probes, widened") |
| `src/mcp/vice/<seam>.test.ts` | test | request-response (unit, real temp dirs + injected deps) | `src/mcp/vice/prerequisites.test.ts` (non-vacuity / planted-violation idiom) and `src/mcp/vice/host-scripts.test.ts` (executable-bit assertion, real subprocess fixtures) | exact for the non-vacuity pattern; role-match for the temp-dir/injection pattern |
| `src/mcp/vice/prerequisites.json` (modified: +`location`, `kind`, `marker` per record) | config / data (committed declaration) | CRUD (additive schema field, read-only at runtime this phase) | itself, prior shape (Phase 58) | exact (same file, additive edit) |
| `src/mcp/vice/prerequisites.test.ts` (modified: +field assertions) | test | batch (structural document assertions) | itself, prior shape (Phase 58); its own `assertClosedVocabularies`/`assertNoStrayVersionFloor` idiom is the template for the new field checks | exact |
| `src/mcp/vice/build.ts` (modified: +1 `HOST_BOUND_ARTIFACTS` entry) | config / build script | batch (compile step) | itself, prior shape — this is a one-line list addition, not a new pattern | exact |
| `src/mcp/vice/tsconfig.build.json` (modified: +1 `include[]` entry) | config | batch | itself, prior shape | exact |
| `src/mcp/vice/resources/<seam>.mjs` | generated artifact (committed) | batch (compiled output) | `src/mcp/vice/resources/host-tool.mjs` / `backend-detect.mjs` (any existing `HOST_BOUND_ARTIFACTS` output) | exact — produced mechanically by `build.ts`, never hand-written |

## Pattern Assignments

### `src/mcp/vice/<seam>.mts` (new host-bound service module)

**Analogs:** `src/mcp/vice/backend-detect.mts` (whole file, for the deps-object
and result-shape idiom) and `src/mcp/vice/host-tool.mts` lines 2190–2311 (for
the `{ path, tried }` probe family this seam widens).

**Imports pattern** — copy `backend-detect.mts:44-53` verbatim in shape (Node
builtins only, no runtime dependency):
```typescript
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  renameSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, resolve as resolvePath } from "node:path";
```
Add `accessSync` and `constants as fsConstants` from `node:fs` for the D-08
executable-bit check (precedent below), and `dirname`/`fileURLToPath` from
`node:path`/`node:url` for the compiled-artifact `HERE` resolution (Pattern
4, next section). Per D-02, import nothing from `host-tool.mts` or
`backend-detect.mts` — the seam owns its own `$PATH` walk as a named export,
it does not call either module's version. Per the roadmap constraint ("no
static `repo-root.ts` import"), do not import `repo-root.ts`.

**`Deps` injection object pattern** (`backend-detect.mts:252-265`, `[VERIFIED]`
— the model D-04's Discretion section names explicitly):
```typescript
export interface ResolvedBackendDeps {
  env?: NodeJS.ProcessEnv;
  viceBin?: string;
  supervisorDir?: string;
  resolveBinPath?: (bin: string, env: NodeJS.ProcessEnv) => string | null;
  stat?: (resolvedPath: string) => BinaryIdentity | null;
  now?: () => number;
}
```
The new seam's own deps object should follow this exact shape: `env?`,
`exists?`/`stat?`, `accessSync?`, plus a caller-supplied `toolsDir: string`
(required, not optional — passed the same way `supervisorDir` is passed to
`resolvedBackend()`, never derived internally). No `resetForTests()` hatch
(D-03 forbids it; contrast with `backend-detect.mts:280`'s
`resetResolvedBackendForTests()`, which exists ONLY because that module
memoises and this one must not).

**Core "probe with a candidate list" pattern to widen** — the exact idiom to
copy for the seam's `$PATH`-walk export and its file/probe layers
(`host-tool.mts:2223-2229`, `[VERIFIED]`):
```typescript
export function findDxaBinary(here: string): { path: string | null; tried: string[] } {
  const tried = [join(here, "vendor", "dxa", "dxa"), join(here, "..", "vendor", "dxa", "dxa")];
  for (const candidate of tried) {
    if (existsSync(candidate)) return { path: candidate, tried };
  }
  return { path: null, tried };
}
```
and the fixed-prefix-list variant (`host-tool.mts:2231-2245`, `[VERIFIED]`):
```typescript
function findAcmeLib(): { path: string | null; tried: string[] } {
  const tried: string[] = [];
  const candidates = [
    process.env.ACME,
    "/usr/local/share/acme",
    "/usr/share/acme",
    "/usr/lib/acme",
    process.env.HOME ? join(process.env.HOME, ".acme") : undefined,
  ].filter((c): c is string => typeof c === "string" && c !== "");
  for (const c of candidates) {
    tried.push(c);
    if (existsSync(join(c, ACME_LIB_MARKER))) return { path: c, tried };
  }
  return { path: null, tried };
}
```
and the `$PATH`-walk fallback loop to copy as the seam's own named export
(`host-tool.mts:2288-2306`, `[VERIFIED]` — D-02 says reuse the *logic*, not
the memo around it):
```typescript
const pathEnv = process.env.PATH ?? "";
for (const dir of pathEnv.split(":")) {
  if (!dir) continue;
  const candidate = join(dir, binaryName);
  tried.push(candidate);
  if (existsSync(candidate)) { /* ... */ }
}
```
Widen every one of these `{ path, tried }` returns to
`{ path, tried, layer, mechanism }` per D-04:
```typescript
export type ToolLocationLayer = "env" | "file" | "probe";

export interface ResolveToolResult {
  path: string | null;
  tried: string[];
  layer: ToolLocationLayer | null;
  mechanism: string | null;
}
```

**Result-shape / memo anti-pattern to explicitly NOT copy**
(`host-tool.mts:2260-2271`, `[VERIFIED]`):
```typescript
const siblingBinaryMemo = new Map<string, { path: string | null; tried: string[] }>();
```
and `backend-detect.mts:271` (`let memoisedResult: ResolvedBackendResult | null = null;`).
D-03 forbids a module-level memo in the new seam; the module header must say
in as many words that this is a deliberate departure from
`findSiblingBinary()`'s and `resolvedBackend()`'s own memo idiom, and why
(Phase 61's doctor must never observe a stale answer).

**Resolving `prerequisites.json` from two possible `HERE`s** — the exact
technique to copy verbatim, per D-nothing-new-needed (this is Pattern 4 of
RESEARCH.md and the single sharpest technical risk in this phase). Same
idiom as `findDxaBinary()` above, comment included nearly verbatim
(`host-tool.mts:2207-2221`, `[VERIFIED]`):
```typescript
// This module ships two ways: as unbuilt source (HERE == src/mcp/vice/)
// and as the compiled artifact this project actually runs
// (HERE == src/mcp/vice/resources/). "prerequisites.json relative to
// import.meta.url" therefore means two DIFFERENT candidate locations
// depending on which form is executing: same-directory for the unbuilt
// source, one level up for the compiled artifact.
const tried = [join(here, "prerequisites.json"), join(here, "..", "prerequisites.json")];
```
`here` itself is computed the same way `host-tool.mts:132` computes its own
`HERE`:
```typescript
const HERE = dirname(fileURLToPath(import.meta.url));
```

**Executable-bit check** (D-08/Discretion item 1) — the one place in the
tree this check already exists, currently only in a test, to be promoted
into production logic for the first time in this phase
(`host-scripts.test.ts:283`, `[VERIFIED]`):
```typescript
assert.doesNotThrow(() => accessSync(nodeBin, fsConstants.X_OK), "node_bin must be an executable file");
```
The seam's own file-layer validator uses the same primitive without the
`assert` wrapper — `try { accessSync(p, fsConstants.X_OK); } catch { /* refuse */ }`.

**Refuse-by-name pattern for `dxa`/`node`** — the exact "name the tool,
state the fact, quote the reason" shape to match
(`host-tool.mts:1348-1354`, `[VERIFIED]`):
```typescript
const ghidraHome = process.env.GHIDRA_HOME;
if (ghidraHome === undefined || ghidraHome === "") {
  return {
    ok: false,
    message: `host_tool "ghidra.analyze" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
  };
}
```
For `dxa`/`node` the message must quote `prerequisites.json`'s new
`location.reason` field verbatim (D-05) rather than re-authoring the reason
in code — see `prerequisites.json`'s pattern assignment below for exactly
which string.

**Refuse-unknown-key discipline for `validateToolsFile()`** — mirror
`normaliseHostToolRequest()`'s own array-membership discipline
(`host-tool.mts:520-548` and the allowlist comment at `host-tool.mts:140-148`,
`[VERIFIED]`):
```typescript
// Matched by EXACT, case-sensitive ARRAY membership -- never an
// object-property lookup keyed by the untrusted wire string -- so
// "__proto__"/"constructor"/"toString" refuse exactly like any other
// unrecognised value, with no separate special-case needed.
const unknownKeys = Object.keys(argsObj).filter((key) => !acceptedKeys.includes(key));
if (unknownKeys.length > 0) {
  return { ok: false, message: `host_tool "${tool}" args has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${acceptedShape}` };
}
```
`validateToolsFile()` should check each `tools.json` key the same way —
against the declared tool-id array (D-11's exemption: a key starting with
`_` is skipped before this check runs, never treated as an unknown key).

**Error handling / "prefer a structured result over a throw" pattern**
(`vice-errors.ts:158-168`, `[VERIFIED]` — cited to show the alternative that
this domain deliberately does NOT use):
```typescript
export class ViceError extends Error {
  code?: number | string;
  data?: unknown;
  constructor(message: string, { code, data }: ViceErrorOptions = {}) {
    super(message);
    this.name = "ViceError";
    this.code = code;
    this.data = data;
  }
}
```
`ViceError` exists in this codebase, but every probe in this domain
(`findAcmeLib`, `findDxaBinary`, `findSiblingBinary`, `resolvedBackend`)
returns a result and throws nothing. The new seam follows THAT convention,
not `ViceError`'s — `resolveTool()` and `validateToolsFile()` both return a
result object; a refusal is a field on it (`{ ok: false, message }` for
`validateToolsFile`'s per-problem entries, matching `buildHostToolArgv`'s own
`{ ok: false, message }` shape at `host-tool.mts:1350-1354`).

---

### `src/mcp/vice/<seam>.test.ts` (new)

**Analogs:** `src/mcp/vice/prerequisites.test.ts` (non-vacuity idiom, `build()`-
before-import idiom) and `src/mcp/vice/host-scripts.test.ts` (real subprocess
fixtures, executable-bit assertion).

**Non-vacuous validator pattern** — every validator is a named, exported
function so the real-document case and a planted-violation case run the same
code (`prerequisites.test.ts` header comment, `[VERIFIED]` via `grep -a`,
since this file contains a NUL byte):
```
// Every validator below is a named, exported function so the real-committed-
// document case and its planted-violation case run the SAME code -- the
// version-floor guard's planted-violation case is what keeps that guard
// from passing vacuously (a validator with no planted-violation case cannot
// tell "always passes" from "correctly passes").
```
Concrete planted-violation test to mirror, one bad entry / one field
(`prerequisites.test.ts:307-325`, referenced by name — "structural (T-58-01):
assertNoStrayVersionFloor's planted violation is reported and the real
document is not (non-vacuity)" and the sibling `assertNoExecutableShape`
case). Every `LOC-05`/`LOC-06`/`LOC-07` refusal test in the new seam's suite
must have a matching "planted violation observed failing, then fixed and
observed passing" pair, not just a green assertion against the real file.

**`build()`-before-import idiom** (`prerequisites.test.ts:47-51`, `[VERIFIED]`
via `grep -a`):
```typescript
import { build } from "./build.ts";
// ...
build();
const hostTool = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  HOST_TOOL_IDS: readonly HostToolId[];
};
```
The new seam's `.test.ts` must use the identical idiom for its Pitfall-1
compiled-artifact proof: build first, then dynamically import
`./resources/<seam>.mjs` and call its exported resolver against a `HERE`
computed from the *compiled* location, proving `prerequisites.json` resolves
from `resources/` and not only from unbuilt `.mts` source.

**Real-temp-directory + injected-deps test fixture pattern**
(`host-scripts.test.ts`, whole-file convention; concrete assertion at line
283, `[VERIFIED]`):
```typescript
assert.doesNotThrow(() => accessSync(nodeBin, fsConstants.X_OK), "node_bin must be an executable file");
```
This suite has no mocking library — tests build real scratch directories
(`mkdtempSync`) and pass real files through the module's injectable `env`/
`stat`/`accessSync` overrides, exactly as `backend-detect.test.ts` (not read
this session, but named by the same convention in CONVENTIONS.md) already
does for `resolvedBackend()`.

**Subset-relation assertion pattern (never a record count)**
(`prerequisites.test.ts:249-255`, `[VERIFIED]` via `grep -a`):
```typescript
test("all eight required tool ids are present (subset relation over the required set, never a record count)", () => {
  const doc = readPrerequisites();
  const required = ["x64sc", "c1541", "petcat", "acme", "acme-lib", "ghidra", "dxa", "node"];
  const have = new Set(Object.keys(doc.tools));
  const missing = required.filter((id) => !have.has(id));
  assert.deepEqual(missing, []);
});
```
The new field assertions this phase adds (every `location.envVar` is a
plausible env-var name, no tool id starts with `_`, every `kind: "directory"`
record has a `marker`) must follow this same relation-not-count style.

---

### `src/mcp/vice/prerequisites.json` (modified)

**Analog:** itself, Phase 58's committed shape (read in full this session,
8 records, no `location`/`kind`/`marker` fields yet).

**Current per-record shape to extend** (`prerequisites.json:291-312`,
verbatim, the `ghidra` record — chosen because it needs both new blocks:
`location` with no `envVar`... actually it DOES have `GHIDRA_HOME`, D-05):
```json
"ghidra": {
  "id": "ghidra",
  "unblocks": { "skills": ["c64-program-recon"], "mcp": ["ghidra.analyze", "ghidra.installExtension"] },
  "remedies": {
    "universal": [
      {
        "ecosystem": "generic",
        "text": "Set the GHIDRA_HOME environment variable to name a Ghidra installation directory.",
        "provenance": "carried",
        "source": "src/mcp/vice/host-tool.mts:1352"
      }
    ]
  }
}
```
D-05 adds a `location` block here: `{ "envVar": "GHIDRA_HOME", "fileOverridable": true }`.
D-07 adds `"kind": "directory", "marker": "support/analyzeHeadless"` (the
exact marker path already used at `host-tool.mts:1358`).

**The `dxa` record's exclusion reason, verbatim source to quote**
(`prerequisites.json:313-333`, plus `host-tool.mts:126-131`, `[VERIFIED]`):
```json
"dxa": {
  "id": "dxa",
  "remedies": { "universal": [ { "text": "bash vendor/dxa/build.bash build", ... } ] }
}
```
The module comment this seam must quote as `location.reason` verbatim
(`host-tool.mts:126-131`):
```
// This module's own directory, used ONLY to compute the vendored dxa
// binary's fixed path. Never an environment-variable override: dxa is
// vendored AND built by this project (unlike ACME_BIN/GHIDRA_HOME, which
// name a HOST PREREQUISITE a user installs anywhere), so an override could
// only ever select a binary this project did not build and did not pin --
// a substitution this seam must never allow.
```
Condensed form already accepted into `.planning/REQUIREMENTS.md` (per
RESEARCH.md): "dxa is vendored **and built** by this project, so an override
could only select a binary it did not build and did not pin". D-05:
`{ "fileOverridable": false, "reason": "<that sentence>" }`, no `envVar` key.

**The `node` record's exclusion reason, verbatim source to quote**
(`resources/vice-launcher.sh:199-223`, `[VERIFIED]`):
```bash
if [ -n "${VICE_BROKER_NODE:-}" ]; then
  if [ -f "${VICE_BROKER_NODE}" ] && [ -x "${VICE_BROKER_NODE}" ]; then
    ...
  else
    NODE_RESOLUTION_ERROR="VICE_BROKER_NODE is set to '$VICE_BROKER_NODE', which does not resolve to an executable file. ..."
  fi
else
  NODE_RESOLUTION_ERROR="No 'node' executable was found on PATH and VICE_BROKER_NODE is not set. ..."
fi
```
The reason string this file's own `location.reason` must carry (per
RESEARCH.md, citing `.planning/REQUIREMENTS.md`): "`vice-launcher.sh` is bash
and reads it before any working Node exists to parse JSON with". D-05:
`{ "fileOverridable": false, "reason": "<that sentence>" }`, no `envVar` key
(`VICE_BROKER_NODE` stays environment-only per `LOC-07`).

**The four env-var mappings (D-05), each verified against its real read
site:**
| Tool id | `envVar` | Verified read site |
|---|---|---|
| `x64sc` | `VICE_BIN` | `backend-detect.mts:312` — `const viceBin = deps.viceBin ?? env.VICE_BIN ?? "x64sc";` |
| `acme` | `ACME_BIN` | `host-tool.mts:1292` — `const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";` |
| `acme-lib` | `ACME` | `host-tool.mts:2234` — first candidate in `findAcmeLib()`'s list, `process.env.ACME` |
| `ghidra` | `GHIDRA_HOME` | `host-tool.mts:1348` — `const ghidraHome = process.env.GHIDRA_HOME;` |

`c1541`/`petcat` omit `envVar` entirely (D-06) — no read site exists for
either name anywhere in the tree (confirmed absent this session by grep).

**Directory-`kind` markers (D-07):**
| Tool id | `kind` | `marker` | Verified source |
|---|---|---|---|
| `acme-lib` | `"directory"` | `"cbm/c64/vic.a"` | `host-tool.mts:2205` — `const ACME_LIB_MARKER = join("cbm", "c64", "vic.a");` |
| `ghidra` | `"directory"` | `"support/analyzeHeadless"` | `host-tool.mts:1358` — `const ghidraPath = join(ghidraHome, "support", "analyzeHeadless");` |

All other six tool ids get `"kind": "executable"`.

---

### `src/mcp/vice/prerequisites.test.ts` (modified)

**Analog:** itself. Extend, never duplicate, the existing validators.

**Pattern to copy for the new field assertions** — same "named exported
function returning offender list, empty = pass" shape as
`assertClosedVocabularies` (`prerequisites.test.ts:125-146`, `[VERIFIED]`
via `grep -a`):
```typescript
export function assertClosedVocabularies(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  const skillDirs = new Set(readdirSync(SKILLS_DIR));
  const hostToolIds = new Set<string>(HOST_TOOL_IDS);
  for (const [id, record] of Object.entries(doc.tools)) {
    for (const s of record.unblocks.skills) {
      if (!skillDirs.has(s)) offenders.push(`${id}.unblocks.skills:${s}`);
    }
    // ...
  }
  return offenders;
}
```
New validators this phase must add, in the same style: one that every
`location.envVar` (where present) matches a plausible env-var-name pattern
(e.g. `/^[A-Z][A-Z0-9_]*$/`); one that no tool id begins with `_` (D-11);
one that every `kind: "directory"` record carries a non-empty `marker` and
every `kind: "executable"` record carries none. Each needs its own
planted-violation test pair, matching `assertNoStrayVersionFloor`'s own
non-vacuity companion test at `prerequisites.test.ts:302-315`.

**REMINDER:** every `grep`/content-census command run against this file
during planning or execution MUST pass `-a`, or it silently returns zero
matches (confirmed this session: `grep -n "readFileSync"` returned nothing,
`grep -na "readFileSync"` returned 13 matches).

---

### `src/mcp/vice/build.ts` (modified)

**Analog:** itself. This is a one-line addition, not a new pattern.

**Exact array to extend** (`build.ts:42-53`, `[VERIFIED]`):
```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
  "backend-detect.mjs",
  "host-tool.mjs",
  "ghidra-project.mjs",
  // + "<seam>.mjs" -- Phase 59's one new entry
];
```
`build()`'s own runtime assertion (`build.ts:192-205`) fails loudly if this
array and the actual `tsc` output ever disagree — no separate test needed to
catch a missed entry, but `tsconfig.build.json`'s `include[]` must be edited
in the SAME commit (see next file) or `build()` throws
"emitted file set does not match HOST_BOUND_ARTIFACTS".

---

### `src/mcp/vice/tsconfig.build.json` (modified)

**Analog:** itself.

**Exact array to extend** (`tsconfig.build.json:9-20`, `[VERIFIED]`,
confirmed identical membership and order to `HOST_BOUND_ARTIFACTS`):
```json
"include": [
  "vice-broker.mts",
  "container-guard.mts",
  "broker-state.mts",
  "broker-launch.mts",
  "broker-kill.mts",
  "broker-epoch.mts",
  "broker-control.mts",
  "backend-detect.mts",
  "host-tool.mts",
  "ghidra-project.mts"
]
```
Add `"<seam>.mts"` here in the same commit as the `build.ts` edit.

---

### `src/mcp/vice/resources/<seam>.mjs` (generated, committed)

**Analog:** any existing entry, e.g. `resources/host-tool.mjs` or
`resources/backend-detect.mjs` — not hand-written; produced by running
`build()` after the two config edits above. `resources-sync.test.ts` is the
existing drift gate and needs no phase-specific change — it walks
`HOST_BOUND_ARTIFACTS` generically and will pick up the new artifact
automatically. Every emitted artifact carries the banner produced by
`GENERATED_BANNER()` (`build.ts:60-69`, `[VERIFIED]`):
```
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from <seam>.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build...
```

## Shared Patterns

### Deps-object injection, never a positional boolean
**Source:** `src/mcp/vice/backend-detect.mts:252-265` (`ResolvedBackendDeps`)
**Apply to:** the new seam's `resolveTool()` and `validateToolsFile()`
signatures — both take a single destructured options object
(`env?`, `exists?`, `accessSync?`, `toolsDir`), never a positional flag.
```typescript
export interface ResolvedBackendDeps {
  env?: NodeJS.ProcessEnv;
  viceBin?: string;
  supervisorDir?: string;
  resolveBinPath?: (bin: string, env: NodeJS.ProcessEnv) => string | null;
  stat?: (resolvedPath: string) => BinaryIdentity | null;
  now?: () => number;
}
```

### `{ path, tried }` result shape, widened with `layer`/`mechanism`
**Source:** `src/mcp/vice/host-tool.mts:2223-2311` (all three probes),
`src/mcp/vice/backend-detect.mts:243-249` (`binPath`/`binPathResolved` pair)
**Apply to:** `resolveTool()`'s return type on the new seam — every caller of
this pattern across the codebase already expects "what I found plus
everything I looked at"; D-04 only adds two fields, it does not replace the
shape.

### Refuse by name, with the remedy/reason in the message
**Source:** `src/mcp/vice/host-tool.mts:1350-1354` (`ghidra.analyze`
refusal), `src/mcp/vice/host-tool.mts:520-548` (`normaliseHostToolRequest`'s
unknown-key refusal)
**Apply to:** every `LOC-05`/`LOC-06`/`LOC-07` refusal in
`validateToolsFile()`. Each names the tool id, states the fact, and — for
`dxa`/`node` — quotes `prerequisites.json`'s own `location.reason` field
verbatim rather than re-authoring the sentence in code.

### No module-level memo in this seam (deliberate anti-pattern callout)
**Source (what NOT to copy):** `src/mcp/vice/host-tool.mts:2260-2271`
(`siblingBinaryMemo`), `src/mcp/vice/backend-detect.mts:267-282`
(`memoisedResult` / `resetResolvedBackendForTests()`)
**Apply to:** the new seam's module header must state explicitly, in prose,
that three memoised precedents exist in this file family and the new seam
deliberately does not follow them (D-03), naming the two reasons (the
CLAUDE.md four-module global-state ledger, and Phase 61's doctor needing a
structurally-guaranteed-fresh answer).

### Committed JSON data file read with plain `JSON.parse`, zero new deps
**Source:** `src/mcp/vice/prerequisites.test.ts:80-81` (`readPrerequisites()`)
**Apply to:** the new seam's own `prerequisites.json` read — same
`JSON.parse(readFileSync(...))` idiom, no schema-validation library, no
JSONC/comment-stripping parser (D-11 explicitly rejects one).

### Non-vacuous validator / planted-violation test idiom
**Source:** `src/mcp/vice/prerequisites.test.ts` header comment (`grep -a`
required) and its `assertNoStrayVersionFloor`/`assertNoExecutableShape`
pairs (lines 302-325)
**Apply to:** every `LOC-05`/`LOC-06`/`LOC-07` refusal test in the new
seam's `.test.ts` — each needs a real-document-passes case AND a
planted-violation-fails case, per `.planning/ENGINEERING_RULES.md` §6.

## No Analog Found

None. Every file in this phase's scope has at least a role-match analog
already in the same file family (`host-tool.mts`/`backend-detect.mts` for
the seam itself; `prerequisites.json`/`prerequisites.test.ts` for the
declaration edits; `build.ts`/`tsconfig.build.json` for the build-pipeline
edits). This phase's own RESEARCH.md and CONTEXT.md independently confirm
this: "almost nothing to hand-roll because the patterns it needs already
exist four times over in this exact file... and its sibling."

## Metadata

**Analog search scope:** `src/mcp/vice/` only (this is a single-package,
single-directory phase; no other directory in the repo is relevant to a
host-bound tool-location seam).
**Files scanned:** `host-tool.mts`, `backend-detect.mts`, `build.ts`,
`tsconfig.build.json`, `prerequisites.json`, `prerequisites.test.ts`,
`vice-errors.ts`, `host-scripts.test.ts`, `resources/vice-launcher.sh`,
`repo-root.ts` — all read directly this session (not recalled), all
confirmed git-tracked via `git ls-files`.
**Pattern extraction date:** 2026-09-18
