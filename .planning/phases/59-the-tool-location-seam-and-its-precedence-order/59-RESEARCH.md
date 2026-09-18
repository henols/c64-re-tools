# Phase 59: The Tool-Location Seam and Its Precedence Order - Research

**Researched:** 2026-09-18
**Domain:** Host-bound Node/TypeScript module design (filesystem/env resolution seam), inside an existing `.mts` -> `resources/*.mjs` build pipeline
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All eleven `D-NN` decisions in `59-CONTEXT.md` are the user's accepted-as-written
reasoning (the user answered the recommended option on every question and raised
no counter-proposal), so they carry the same weight as a locked decision. Copied
verbatim below; **do not re-litigate any of these without new evidence**, and if
reversed, record the reversal the way `59-CONTEXT.md` records the original choice.

- **D-01: The seam wraps `resolvedBackend()` externally. Phase 59 edits no
  existing host-bound `.mts` module.** The seam owns the environment and
  `tools.json` layers for all eight ids itself. For `x64sc` it does **not**
  delegate to `resolvedBackend()` at all (see D-02).
- **D-02: The seam exports the `$PATH` walk, and the three copies are collapsed
  in Phase 60.** The seam owns the walk as a named export and uses it for every
  id's third layer. It never calls `resolvedBackend()`. The two existing private
  copies (`defaultResolveBinPath()` at `backend-detect.mts:204`, and
  `findSiblingBinary()`'s fallback loop at `host-tool.mts:2292`) stay untouched
  this phase. The seam's module header must say so, naming Phase 60 as where
  they collapse.
- **D-03: The seam caches nothing. Every call re-resolves.** No module-level
  memo, no caller-supplied cache, no `resetForTests()` hatch.
- **D-04: The result carries `layer` and `mechanism` as two separate fields.**
  `layer` is `"env" | "file" | "probe"`. `mechanism` is the specific one: the
  env-var name, `tools.json`, `$PATH`, sibling-of-`x64sc`, fixed-prefix list, or
  project-vendored path. Plus `tried: string[]`, matching the `{ path, tried }`
  shape all four existing probes already return.
- **D-05: Each `prerequisites.json` record gains an optional `location` block.**
  Shape: `{ envVar?: string, fileOverridable: boolean, reason?: string }`.
  `x64sc` -> `VICE_BIN`; `acme` -> `ACME_BIN`; `acme-lib` -> `ACME`; `ghidra` ->
  `GHIDRA_HOME`. `dxa` and `node` carry `fileOverridable: false` plus a `reason`
  string the `LOC-05` / `LOC-07` refusals quote **verbatim**. `schemaVersion`
  stays `1`.
- **D-06: `c1541` and `petcat` get no environment variables of their own.**
  Their records **omit** `envVar`; the doctor says "no environment variable --
  use `tools.json`".
- **D-07: Records declare a `kind`, and a directory record declares its
  `marker`.** `kind` is `"executable" | "directory"`. `acme-lib` -> `cbm/c64/vic.a`;
  `ghidra` -> `support/analyzeHeadless`. The seam returns the directory itself,
  never the marker.
- **CRITERION AMENDMENT (`LOC-06`).** `LOC-06` as written refuses a path that is
  "absent, not executable, or a directory". For `acme-lib` and `ghidra` a
  directory is the *correct* state, so the clause is inverted for two of eight
  tools. Amended text: *a `tools.json` entry is refused by name when the path
  is absent, or is not what its record's `kind` declares, or -- for a
  `directory` kind -- does not contain its declared marker; and the refusal
  says the file supplied it.* The planner must not build a triad that refuses
  `ghidra`.
- **D-08: Validation applies to the file layer only.** Only a
  `tools.json`-supplied path is validated and refused. The environment and
  probe layers keep today's `existsSync`-only behaviour. Nothing in this tree
  currently checks the executable bit at all outside `host-scripts.test.ts`'s
  own `node_bin` assertion (see Code Examples). Phase 61's doctor may still
  *report* on all three layers; reporting is not refusing.
- **D-09: One bad entry refuses one tool.** A malformed `acme` entry refuses
  `acme` by name and nothing else; `x64sc` still resolves through the file.
- **D-10: Two exports, and only two.** `resolveTool(id, …)` walks the three
  layers for one id. `validateToolsFile(…)` judges the file alone and returns
  every file-level problem -- an unknown key, a refused `dxa`/`node` entry, a
  malformed top level, unparseable JSON -- **without resolving anything**.
- **D-11: Keys beginning with `_` are reserved for prose and exempt from the
  unknown-key refusal.** The template ships `_readme` and a `_viceBrokerNode`
  entry. The file stays strict `JSON.parse` with zero new dependencies. A test
  must assert no declared tool id begins with `_`.

Recorded from the roadmap, not decided in discussion, but equally binding:

- Both exclusions (`dxa`, `node`/`VICE_BROKER_NODE`) are **refused**, not merely
  documented -- a silently ignored `node` key is the failure the phase goal
  names.
- Phase 59 owns the template *text* (an export: a string, or a builder taking
  resolved paths); Phase 61's doctor emits it. Phase 59 does **not** commit a
  `tools.json.example`.
- Path handling (`~` expansion, repo-root-relative resolution, the kind check)
  lives in the seam. A resolved path is never interpolated into a shell string.
- No static `repo-root.ts` import -- the seam takes the resolved tools
  directory as an explicit string parameter, exactly as `backend-detect.mts`
  does for `supervisorDir`.
- Never called from inside `broker-launch.mts`'s `inFlight` guard.

### Claude's Discretion

The user answered the recommended option on all eleven questions and raised no
counter-proposal, so every `D-NN` above is Claude's reasoning accepted rather
than a user directive. The planner may revisit any of them on new evidence, but
should record the reversal the way `59-CONTEXT.md` records the original choice.

Four smaller choices were made without asking and are binding on the plan:

- **Executable-bit check, where D-08 applies one, uses `accessSync(p, X_OK)`**,
  not mode-bit arithmetic.
- **A `.mts` module imports its host-bound siblings with a `.mjs` extension**
  (`host-tool.mts:124` imports `./backend-detect.mjs`). The new module follows
  that, and must be added to `HOST_BOUND_ARTIFACTS` (`build.ts:42`).
- **Tests use real temp directories and the module's injectable overrides.**
  This suite has no mocking library; the convention is a destructured options
  object with injectable env/fs/spawn hooks.
- **File naming** follows the repo's domain-prefix convention; the planner
  picks the prefix, but it must not be `host-tool-*` (that domain is the MCP
  dispatch surface, not location).

### Deferred Ideas (OUT OF SCOPE for Phase 59)

- Collapsing the three `$PATH`-walk copies (Phase 60).
- Deciding `resolvedBackend()`'s final role (Phase 60).
- `C1541_BIN` / `PETCAT_BIN` environment variables (declined this milestone).
- A single `VICE_TOOLS_DIR` naming a shared directory (rejected in D-06).
- Widening validation to the environment and probe layers (D-08 scopes it to
  the file layer only).
- A per-machine `~/.config/c64-re-tools/tools.json` (`DOCTOR-F2`, future).
- Correcting `CLAUDE.md`'s stale ACME-prefix citation (carried over from
  Phase 58, still unresolved, not this phase's job).
- The raw NUL byte in `prerequisites.test.ts` (and now confirmed, see Common
  Pitfalls) hiding it from plain `grep` -- fixing the literal-vs-escape is a
  small task, not a Phase 59 deliverable.

**Also explicitly NOT in this phase** (from the `<domain>` block): `LOC-01`,
`LOC-02`, `LOC-03`, `LOC-04`, `DECL-03` (all Phase 60); the doctor and its
template emission (Phase 61); the README generator (Phase 62); any edit to an
existing `.mts` module (D-01). **The seam is not wired into anything this
phase** -- no live resolution path calls it when Phase 59 ends.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| `LOC-05` | dxa stays un-overridable by file or environment, and a `tools.json` entry naming it is refused by name rather than silently ignored. | `host-tool.mts:126-131` gives the exact reason text (dxa is vendored **and built** by this project); confirmed no `envVar` exists for dxa anywhere in the tree. `validateToolsFile()` (D-10) is the export that must implement this refusal; the refusal text is read from `prerequisites.json`'s new `dxa.location.reason` field (D-05), never re-authored in code. See Code Examples and Common Pitfalls below for the exact refusal shape to copy. |
| `LOC-06` | A `tools.json` entry naming a path that is absent, not executable, or a directory is refused by name, and the refusal says the file supplied it. | **Read together with the CRITERION AMENDMENT above** -- the literal wording is wrong for `acme-lib`/`ghidra` (directory kind). `kind`/`marker` fields (D-07) resolve the ambiguity; `accessSync(p, X_OK)` (precedent: `host-scripts.test.ts:283`, verbatim quoted below) is the executable check. Validation is file-layer-only (D-08) -- `existsSync`-only precedent confirmed at all four current probe sites (`findAcmeLib`, `findDxaBinary`, `findSiblingBinary`, `resolveGhidraProject`'s `analyzeHeadless` check). |
| `LOC-07` | `VICE_BROKER_NODE` stays environment-only, and that exclusion is documented where a reader would otherwise expect it in the file. | `resources/vice-launcher.sh` (lines ~199-219, quoted verbatim below) is bash and reads `VICE_BROKER_NODE` before any Node exists to parse `tools.json` with -- this is the exact reason string `prerequisites.json`'s `node.location.reason` field must carry, and `_viceBrokerNode` (D-11) is where the template documents it. A `node` key in `tools.json` must be refused the same way `dxa` is (roadmap "Recorded from the roadmap" bullet), not merely documented. |
</phase_requirements>

## Summary

This phase adds exactly one new file pair to an already-settled architecture:
a host-bound `.mts` module (compiled by the existing `build.ts` pipeline into
`resources/*.mjs`, exactly like `host-tool.mts` and `backend-detect.mts`
already are) plus its colocated `.test.ts`. Every design question that would
normally require research -- precedence order, result shape, caching posture,
validation scope, refusal granularity, export surface, file format for the two
gray areas -- has already been decided in `59-CONTEXT.md`'s eleven `D-NN`
entries, all "Claude's reasoning accepted" by the user. This RESEARCH.md's job
is therefore not to explore alternatives, but to **ground every decision in
the real, currently-shipped code** the planner must write tasks against, with
line numbers and verbatim quotes a plan can cite directly, and to surface the
specific mechanical hazards (compiled-path resolution, `HOST_BOUND_ARTIFACTS`
sync, the NUL-byte-hidden test file, the stale `build.ts` header comment) that
are easy to get wrong on a first pass.

The four existing probes this seam sits in front of -- `resolvedBackend()`
(`backend-detect.mts`), `findAcmeLib()`, `findDxaBinary()`, `findSiblingBinary()`
(all three in `host-tool.mts`) -- were read directly this session, and every
claim about their current behaviour below (existsSync-only validation, memo
posture, candidate lists, the exact `{ path, tried }` return shape) is a
`[VERIFIED]` quote from that reading, not a recollection from `59-CONTEXT.md`'s
own paraphrase.

**Primary recommendation:** Write one new host-bound `.mts` module (name TBD by
the planner, not `host-tool-*`) exporting exactly two functions --
`resolveTool(id, deps)` and `validateToolsFile(raw, deps)` -- built entirely
around the `{ path, tried, layer, mechanism }` result shape, reading
`location`/`kind`/`marker` fields this phase also adds to `prerequisites.json`,
validated in the existing `prerequisites.test.ts` gate (never a new one), and
resolving `prerequisites.json` itself through the same two-candidate
same-directory/one-level-up idiom `findDxaBinary()` already uses for its own
compiled-vs-unbuilt duality.

## Architectural Responsibility Map

This project has no browser/frontend/backend web tiers; its own layered model
(from `CLAUDE.md`'s Component Responsibilities table) is Container-side MCP
process / Host-bound broker-and-tool layer / committed declaration data /
build pipeline. Mapped accordingly:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Precedence-order resolution (env -> file -> `$PATH`/probe) for one tool id | Host-bound module (new seam) | — | Must run on the bare host, same as every existing probe it fronts; no container-side caller exists yet (Phase 60) |
| `tools.json` schema validation (unknown keys, refused ids) | Host-bound module (new seam), `validateToolsFile()` | — | D-10: file-level judgement is its own export so a per-tool resolve never has to also detect a typo |
| Tool metadata (ids, env-var names, `kind`, remedy text) | Declaration (`prerequisites.json`) | — | D-05/D-07: the seam reads, never re-derives, this data; Phase 58 already owns the file's shape and its own structural gate (`prerequisites.test.ts`) |
| Compiling the new `.mts` into a committed `resources/*.mjs` artifact | Build pipeline (`build.ts`) | — | One new entry in `HOST_BOUND_ARTIFACTS` plus `tsconfig.build.json`'s `include[]`; `resources-sync.test.ts` is the drift gate |
| Wiring the seam into live dispatch (`host-tool.mts`, `backend-detect.mts`) | *Not this phase* | Host-bound (Phase 60) | Explicitly deferred by the roadmap and `59-CONTEXT.md`'s `<domain>` block -- "the seam is not wired into anything this phase" |
| The doctor's per-row report and template emission | *Not this phase* | Host-bound (Phase 61) | `DOCTOR-03`/`DOCTOR-08` consume this seam's exports but are a later phase's deliverable |

## Standard Stack

### Core

No new runtime dependency. The seam is built entirely from `node:fs`
(`existsSync`, `accessSync`, `lstatSync`/`statSync`), `node:path`
(`join`, `dirname`, `isAbsolute`, `resolve`), and `node:url`
(`fileURLToPath`) -- the same primitives every existing probe in `host-tool.mts`
and `backend-detect.mts` already uses `[VERIFIED: host-tool.mts:88-92,
backend-detect.mts:44-53]`. `~` expansion (D-05/roadmap "path handling lives in
the seam") is a plain string check against `process.env.HOME`, matching
`findAcmeLib()`'s own use of `process.env.HOME` at `host-tool.mts:2238`
`[VERIFIED: host-tool.mts:2238]`:
```
process.env.HOME ? join(process.env.HOME, ".acme") : undefined,
```

### Supporting

Nothing new. `node --test` (the project's only test runner) is unchanged for
this phase's colocated `.test.ts`.

### Alternatives Considered

Not applicable -- `59-CONTEXT.md` already closed every "library or hand-roll"
question (there is no library to consider; this is filesystem/env inspection
against a committed JSON schema).

**Installation:** none. No `npm install` step for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. The runtime
dependency set (`@mastra/mcp`, `@mastra/core`) is unchanged
`[VERIFIED: package.json:16-19]`:
```
  "dependencies": {
    "@mastra/mcp": "1.15.0",
    "@mastra/core": "1.55.0"
  },
```
D-11 explicitly requires the new `tools.json` template stay strict
`JSON.parse` "with **zero** new dependencies" -- no comment-stripping parser,
no schema-validation library. No package-legitimacy check is required for
this phase; skip Steps 1-3 of the gate.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────┐
                          │   prerequisites.json          │
                          │   (Phase 58 declaration,       │
                          │   this phase adds `location`,  │
                          │   `kind`, `marker` per record) │
                          └───────────────┬─────────────┘
                                          │ read, never re-derived
                                          ▼
   env var (VICE_BIN,      ┌─────────────────────────────┐
   ACME_BIN, ACME,         │  NEW host-bound seam .mts     │
   GHIDRA_HOME) ──layer 1─▶│                                │
                          │  resolveTool(id, deps)         │──▶ { path, tried,
   .c64-re-tools/          │    walks env -> file -> probe  │     layer, mechanism }
   tools.json     ──layer 2─▶│    for ONE tool id            │
                          │                                │
   $PATH walk / sibling-  │  validateToolsFile(raw, deps)  │──▶ file-level
   of-x64sc / fixed-      │    judges the FILE ALONE:      │     problem list
   prefix list / vendored │    unknown keys, refused dxa/  │     (no resolution)
   path      ──layer 3───▶│    node ids, malformed JSON    │
                          └───────────────┬─────────────┘
                                          │ compiled by build.ts
                                          │ (HOST_BOUND_ARTIFACTS)
                                          ▼
                          ┌─────────────────────────────┐
                          │  resources/<seam>.mjs           │
                          │  (committed, banner-marked,     │
                          │  byte-guarded by                │
                          │  resources-sync.test.ts)        │
                          └─────────────────────────────┘
                                          │
                            NOT CALLED BY ANYTHING YET
                            (Phase 60's job: wire host-tool.mts
                             and backend-detect.mts to call this
                             instead of their own env reads)
```

A reader tracing "where is x64sc" through this diagram in Phase 59 ends at the
seam's own return value -- there is deliberately no arrow onward into a live
dispatch path, because nothing calls this module yet.

### Recommended Project Structure

```
src/mcp/vice/
├── prerequisites.json          # gains `location`/`kind`/`marker` per record (D-05, D-07)
├── prerequisites.test.ts       # gains the new fields' structural assertions (NOT a new test file)
├── <new-seam>.mts              # the new host-bound module -- planner names it, not host-tool-*
├── <new-seam>.test.ts          # colocated, real temp dirs + injectable deps
├── build.ts                    # +1 entry in HOST_BOUND_ARTIFACTS
├── tsconfig.build.json         # +1 entry in include[]
└── resources/
    └── <new-seam>.mjs          # compiled, committed, banner-marked
```

### Pattern 1: The `{ path, tried }` result shape, widened

**What:** Every existing probe already returns "what I found plus everything I
looked at". D-04 widens this with `layer` and `mechanism`.

**When to use:** The new seam's `resolveTool()` return type.

**Example — the four existing shapes, verbatim, showing the pattern the new
type widens:**
```typescript
// Source: src/mcp/vice/host-tool.mts:2223 (findDxaBinary, [VERIFIED])
export function findDxaBinary(here: string): { path: string | null; tried: string[] } {
  const tried = [join(here, "vendor", "dxa", "dxa"), join(here, "..", "vendor", "dxa", "dxa")];
  for (const candidate of tried) {
    if (existsSync(candidate)) return { path: candidate, tried };
  }
  return { path: null, tried };
}

// Source: src/mcp/vice/host-tool.mts:2231 (findAcmeLib, [VERIFIED])
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

// Source: src/mcp/vice/host-tool.mts:2273 (findSiblingBinary, [VERIFIED])
function findSiblingBinary(binaryName: string, resolvedX64scPath: string, log?: (line: string) => void): { path: string | null; tried: string[] } {
  // ... memoised per binary name (see Common Pitfalls -- the seam must NOT do this, D-03)
}
```

The new type (planner's naming, shape from D-04):
```typescript
export type ToolLocationLayer = "env" | "file" | "probe";

export interface ResolveToolResult {
  path: string | null;
  tried: string[];
  layer: ToolLocationLayer | null;   // null when nothing resolved
  mechanism: string | null;          // the env-var name, "tools.json", "$PATH",
                                      // "sibling-of-x64sc", "fixed-prefix-list",
                                      // "vendored-path" -- or null
}
```

### Pattern 2: `Deps` injection object, never a positional boolean

**What:** Every host-bound module in this tree accepts an options object with
overridable `env`, `stat`/`exists`, `now`, etc. — never a bare boolean flag.

**When to use:** The new seam's `resolveTool`/`validateToolsFile` signatures.

**Example:**
```typescript
// Source: src/mcp/vice/backend-detect.mts:252-265 ([VERIFIED])
export interface ResolvedBackendDeps {
  env?: NodeJS.ProcessEnv;
  viceBin?: string;
  supervisorDir?: string;
  resolveBinPath?: (bin: string, env: NodeJS.ProcessEnv) => string | null;
  stat?: (resolvedPath: string) => BinaryIdentity | null;
  now?: () => number;
}
```
The new seam should follow the same shape: `env?`, `exists?`/`stat?`,
`accessSync?` (for the executable check), plus the caller-supplied
`toolsDir: string` (never imported from `repo-root.ts` -- see roadmap
constraint and Pattern 3 below).

### Pattern 3: No static `repo-root.ts` import — caller passes the resolved string

**What:** A host-bound `.mts` cannot statically import `repo-root.ts` (a `.ts`
module that resolves under Node's type-stripping, not under the compiled
`resources/` form) without breaking its own unbuilt-runnable-as-source
property.

**Example:**
```typescript
// Source: src/mcp/vice/backend-detect.mts:60-80 ([VERIFIED], comment verbatim)
// `supervisorDir` is ALWAYS an explicit string this module receives from its
// caller, never a default this module derives itself: the one true resolver
// for "where is .vice-supervisor" is repo-root.ts's own supervisorDir()
// (ARCHITECTURE.md's named "re-deriving a cross-cutting seam locally"
// anti-pattern -- this file must not become a second, silently-driftable
// copy of that resolution).
```
The new seam's `tools.json` path must be built the same way: the caller
resolves `toolsDir()` (or its own `tools.json` join) and passes the string in.

### Pattern 4: Resolving a bundled data file at two different `HERE`s

**What:** `host-tool.mts` ships two ways -- unbuilt source
(`src/mcp/vice/host-tool.mts`, `HERE == src/mcp/vice/`) and the compiled
artifact this project actually runs (`src/mcp/vice/resources/host-tool.mjs`,
`HERE == src/mcp/vice/resources/`). `findDxaBinary()` resolves this by trying
**both** candidate locations and taking whichever exists.

**When to use:** The new seam resolving `prerequisites.json` itself. This is
Specific #2 from `59-CONTEXT.md` (see Open Questions) and is the single
sharpest technical risk in this phase -- get the `HERE`-relative join wrong
and the seam silently can't find the declaration when running from
`resources/`.

**Example — the exact idiom to copy, verbatim:**
```typescript
// Source: src/mcp/vice/host-tool.mts:2207-2229 ([VERIFIED])
// ---------------------------------------------------------------------------
// The vendored dxa binary probe. This module ships two ways: as unbuilt
// source (src/mcp/vice/host-tool.mts, HERE == src/mcp/vice/) and as the
// compiled artifact this project actually runs
// (src/mcp/vice/resources/host-tool.mjs, HERE == src/mcp/vice/resources/).
// ...
// So "vendor/dxa/dxa relative to import.meta.url" means two DIFFERENT
// candidate locations depending on which form of this module is executing:
// same-directory for the unbuilt source, one level up for the compiled
// artifact.
// ---------------------------------------------------------------------------
export function findDxaBinary(here: string): { path: string | null; tried: string[] } {
  const tried = [join(here, "vendor", "dxa", "dxa"), join(here, "..", "vendor", "dxa", "dxa")];
  for (const candidate of tried) {
    if (existsSync(candidate)) return { path: candidate, tried };
  }
  return { path: null, tried };
}
```
`prerequisites.json` lives at `src/mcp/vice/prerequisites.json` — **one level
up** from `resources/`, same relationship `vendor/dxa/dxa` has. The new seam
should resolve it with the identical two-candidate list:
`[join(here, "prerequisites.json"), join(here, "..", "prerequisites.json")]`,
first-existing-wins — never a single hardcoded relative join, and never an
`import` of the JSON module (which would tie resolution to the *importing*
module's own location, not a caller-supplied `here`).

**Proving it, per Specific #2:** `prerequisites.test.ts:349-354` already
proves `DECL-05`'s packaging claim off the packed tarball's own file list
(`npm pack --dry-run --json`), never a repo-path `existsSync`
`[VERIFIED: prerequisites.test.ts:349-354]`:
```typescript
function packedFileList(): string[] {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: HERE, encoding: "utf8" });
  const parsed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
  return parsed[0]!.files.map((f) => f.path);
}
```
Extend this case (add an assertion that the new seam's compiled artifact can
resolve `prerequisites.json` from *inside a packed-and-unpacked tarball*, or
at minimum from a copy of `resources/` staged at the sibling relationship the
real package layout produces) rather than writing a second, independent gate.
`package.json`'s `files[]` already lists both `prerequisites.json` and
`resources` `[CITED: 59-CONTEXT.md canonical_refs, "package.json — files[]
already lists both prerequisites.json and resources"]`.

### Anti-Patterns to Avoid

- **Caching the resolution.** D-03 forbids a module-level memo, unlike
  `findSiblingBinary()`'s own `siblingBinaryMemo` (`host-tool.mts:2271`,
  `[VERIFIED]`) and `resolvedBackend()`'s `memoisedResult`
  (`backend-detect.mts:271`, `[VERIFIED]`). Do not reuse either idiom here —
  the reason both exist (`resolvedBackend()`'s own call being memoised, or a
  process-lifetime PATH assumption) does not apply to a seam that never calls
  `resolvedBackend()` (D-02) and must stay truthful for Phase 61's doctor
  (D-03's stated second reason).
- **Validating the env or probe layers.** D-08 confines validation to the file
  layer. Every current probe is `existsSync`-only; adding an executable-bit
  check to, say, `VICE_BIN`'s resolution would newly refuse setups that
  currently reach `spawn()` successfully.
- **A single `resolveAllTools()`.** D-10 rejects this: resolving one tool would
  walk `$PATH` and stat for all eight, on a seam decided not to cache.
- **Reinterpreting `LOC-06` literally for `acme-lib`/`ghidra`.** The CRITERION
  AMENDMENT exists precisely because the literal requirement text would refuse
  the *correct* state for two of eight tools. Build the amended triad, not the
  literal one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this a plain JSON object" narrowing | A new `isPlainObject` | The existing per-module private copy idiom (`backend-detect.mts:129`, `vice-errors.ts:209`, both `[VERIFIED]`, byte-identical bodies) | This tree deliberately duplicates this one-liner per module rather than cross-importing it — match the convention, don't introduce a shared import |
| Executable-bit check | Mode-bit arithmetic (`(stat.mode & 0o111) !== 0`) | `accessSync(p, fsConstants.X_OK)` | Explicit smaller-scope decision (Discretion list); mode-bit arithmetic gets group/other wrong and ignores ACLs/effective uid. Precedent already in the tree: `host-scripts.test.ts:283` (quoted below) |
| Comment-stripping JSON parser (to let `tools.json` carry `//` comments) | A custom or third-party JSONC parser | D-11's reserved `_`-prefixed-key convention, plain `JSON.parse` | D-11 explicitly rejects this route: "zero new dependencies... rather than a comment-stripping parser that must not corrupt a `//` inside a path string" |
| `$PATH` walk | A third independent copy | D-02: the seam exports the walk as a **named export**, reusing the *logic* `defaultResolveBinPath()` (`backend-detect.mts:204`) and `findSiblingBinary()`'s fallback loop (`host-tool.mts:2288-2306`) already implement, so there are three copies for exactly one phase rather than four | Phase 60 collapses to one; a fourth copy would make that collapse harder, not easier |

**Key insight:** This phase has almost nothing to hand-roll because the
patterns it needs already exist four times over in this exact file
(`host-tool.mts`) and its sibling (`backend-detect.mts`). The actual
engineering work is disciplined **extraction and generalisation** of an
already-proven shape (`{ path, tried }` → `{ path, tried, layer, mechanism }`),
not invention.

## Common Pitfalls

### Pitfall 1: Resolving `prerequisites.json` from the wrong `HERE`

**What goes wrong:** A seam compiled into `resources/<seam>.mjs` joins
`"prerequisites.json"` directly against its own `import.meta.url`-derived
directory and gets `ENOENT`, because from `resources/` the file is one level
*up*, not alongside.

**Why it happens:** The unbuilt source and the compiled artifact are two
different files at two different depths, and it is easy to test only against
the unbuilt source (where a naive same-directory join happens to work) and
never notice the compiled form is broken until Phase 60 tries to use it.

**How to avoid:** Copy `findDxaBinary()`'s two-candidate list verbatim (see
Pattern 4). Add a `.test.ts` case that builds (`build()` from `build.ts`,
per the existing `build()`-before-importing-the-artifact idiom in
`prerequisites.test.ts:47-51` and `host-tool.test.ts`) and then imports the
*compiled* `resources/<seam>.mjs` and calls its resolver, proving it finds
`prerequisites.json` from that location — not only from the unbuilt `.mts`.

**Warning signs:** A test that only ever imports the `.mts` source directly
(never builds first) will not catch this.

### Pitfall 2: `prerequisites.test.ts` and `anno-memmap-render.ts` — TWO files hide from plain `grep`, not one

**What goes wrong:** A content census over the codebase ("does anything read
`prerequisites.json`?", "does the gate assert X?") run with plain `grep`
silently reports nothing, and a researcher or planner concludes a gate does
not exist.

**Why it happens:** `prerequisites.test.ts` contains a literal NUL byte (not
the `\0` escape) at the point its own `.join()` separator was written —
`[VERIFIED: prerequisites.test.ts, confirmed this session]`: `grep -n
"readFileSync\|prerequisites.json\|import.meta.url" prerequisites.test.ts`
returned **zero matches**, while `grep -na` (binary-file override) on the
identical pattern returned matches at lines 30, 43, 50, 81, 218, 235, 245,
328, 332, 333, 356, 359, 360. `CLAUDE.md`'s architecture record currently
names only **one** such file (`anno-memmap-render.ts`); this is confirmed to
be at least a second.

**How to avoid:** Any grep-based content census this phase's planner or
executor runs over `prerequisites.test.ts` **must** pass `-a`. This is not a
Phase 59 deliverable to fix (per `59-CONTEXT.md`'s Deferred list — it "touches
a Phase 58 artifact and the mirrored constraint list"), but every task in this
plan that inspects that file's current content must know to add `-a`.

**Warning signs:** A grep against `prerequisites.test.ts` that returns nothing
for a term you can see in the file when you `cat` or `Read` it.

### Pitfall 3: `build.ts`'s own header comment is stale

**What goes wrong:** A planner reads `build.ts`'s top-of-file comment
("Compiles the host-bound TypeScript sources (today: vice-broker.mts only —
see tsconfig.build.json's `include`, which IS the definition of host-bound)")
and assumes only one artifact exists today.

**Why it happens:** The comment was written when `HOST_BOUND_ARTIFACTS` had
one entry; the array has since grown to ten
(`vice-broker.mjs`, `container-guard.mjs`, `broker-state.mjs`,
`broker-launch.mjs`, `broker-kill.mjs`, `broker-epoch.mjs`,
`broker-control.mjs`, `backend-detect.mjs`, `host-tool.mjs`,
`ghidra-project.mjs` — `[VERIFIED: build.ts:42-53]`) and the header comment
was never updated.

**How to avoid:** Trust the `HOST_BOUND_ARTIFACTS` array and
`tsconfig.build.json`'s `include[]` (both verified identical, ten entries
each, this session), not the prose above it. Adding the eleventh entry (the
new seam) is a one-line addition to each — this is the mechanical action
Success Criterion 1 requires ("compiled into `resources/` by the existing
`build.ts` pipeline... rather than by new machinery").

### Pitfall 4: Forgetting `tsconfig.build.json`'s `include[]` alongside `HOST_BOUND_ARTIFACTS`

**What goes wrong:** A new entry is added to `build.ts`'s
`HOST_BOUND_ARTIFACTS` array but not to `tsconfig.build.json`'s `include[]` (or
vice versa) — `tsc` either never emits the new file (build fails loudly,
"missing" in `build()`'s own assertion at `build.ts:194-205`) or emits
something `HOST_BOUND_ARTIFACTS` doesn't expect ("unexpected").

**Why it happens:** These are two separate files that must be kept in sync by
convention; nothing enforces it structurally except `build()`'s own runtime
assertion, which fails loudly rather than silently — this is a fail-safe, not
a guarantee you got it right on the first attempt.

**How to avoid:** Both files were confirmed this session to already list the
same ten filenames in the same order
(`[VERIFIED: build.ts:42-53, tsconfig.build.json:9-20]`). Add the new module
to both in the same commit.

### Pitfall 5: Reading `59-CONTEXT.md`'s `LOC-06` citation without the amendment

**What goes wrong:** A plan builds a triad that refuses `acme-lib` or `ghidra`
`tools.json` entries because they resolve to a directory, matching `LOC-06`'s
literal wording ("absent, not executable, or a directory").

**Why it happens:** `LOC-06` as written in `.planning/REQUIREMENTS.md:40` does
not carry the amendment; only `59-CONTEXT.md`'s own "CRITERION AMENDMENT"
section states the correction.

**How to avoid:** Every task implementing `LOC-06` must cite the amended text
(quoted in full in the User Constraints section above), not
`REQUIREMENTS.md`'s row directly.

## Code Examples

### The exact refusal-message shape to follow for `dxa` and `node`

```typescript
// Source: src/mcp/vice/host-tool.mts:1348-1354 ([VERIFIED] -- the established
// "name the tool, name the field, name the remedy" refusal shape this seam's
// validateToolsFile() should match for dxa/node)
const ghidraHome = process.env.GHIDRA_HOME;
if (ghidraHome === undefined || ghidraHome === "") {
  return {
    ok: false,
    message: `host_tool "ghidra.analyze" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
  };
}
```
The new seam's `dxa`/`node` refusals should follow the same "name the tool id,
state the fact, quote the reason" shape, with the reason sourced from
`prerequisites.json`'s new `location.reason` field (D-05), never re-authored:
- `dxa` reason source: `[VERIFIED: host-tool.mts:126-131]` —
  "This module's own directory, used ONLY to compute the vendored dxa binary's
  fixed path. Never an environment-variable override: dxa is vendored AND
  built by this project... so an override could only ever select a binary
  this project did not build and did not pin -- a substitution this seam must
  never allow." Condensed form already in `.planning/REQUIREMENTS.md:84`
  `[VERIFIED]`: "dxa is vendored **and built** by this project, so an override
  could only select a binary it did not build and did not pin".
- `node`/`VICE_BROKER_NODE` reason source: `.planning/REQUIREMENTS.md:85`
  `[VERIFIED]`: "`vice-launcher.sh` is bash and reads it before any working
  Node exists to parse JSON with". Confirmed against the actual script
  `[VERIFIED: src/mcp/vice/resources/vice-launcher.sh:199-219]`:
```bash
if [ -n "${VICE_BROKER_NODE:-}" ]; then
  if [ -f "${VICE_BROKER_NODE}" ] && [ -x "${VICE_BROKER_NODE}" ]; then
    ...
  else
    NODE_RESOLUTION_ERROR="VICE_BROKER_NODE is set to '$VICE_BROKER_NODE', which does not resolve to an executable file. ..."
  fi
else
  NODE_CANDIDATE="$(command -v node 2>/dev/null || true)"
  ...
  NODE_RESOLUTION_ERROR="No 'node' executable was found on PATH and VICE_BROKER_NODE is not set. Install Node >= v${NODE_FLOOR_MAJOR} and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one."
fi
```
This script runs entirely in bash, before any Node process exists to read a
JSON file — the literal mechanism `LOC-07`'s reason string must describe.

### The env-var-name-to-tool-id mapping, each verified against the actual read site

```typescript
// x64sc -> VICE_BIN, [VERIFIED: backend-detect.mts:312]
const viceBin = deps.viceBin ?? env.VICE_BIN ?? "x64sc";

// acme -> ACME_BIN, [VERIFIED: host-tool.mts:1292]
const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";

// acme-lib -> ACME, [VERIFIED: host-tool.mts:2234]
process.env.ACME, // first candidate in findAcmeLib()'s list

// ghidra -> GHIDRA_HOME, [VERIFIED: host-tool.mts:1348, 2534]
const ghidraHome = process.env.GHIDRA_HOME;
```
These four are exactly the four D-05 assigns, and exactly the four `LOC-03`
(Phase 60, not this phase) requires "still win over the file". No fifth
env-var name exists anywhere in the tree for `c1541`/`petcat`
`[VERIFIED: grep across host-tool.mts and backend-detect.mts found no
C1541_BIN/PETCAT_BIN reference]`, confirming D-06's premise.

### The executable-bit precedent already in the tree

```typescript
// Source: src/mcp/vice/host-scripts.test.ts:283 ([VERIFIED])
assert.doesNotThrow(() => accessSync(nodeBin, fsConstants.X_OK), "node_bin must be an executable file");
```
This is the one place in the current tree that already performs an
executable-bit check with `accessSync`/`X_OK` — confirming the Discretion
item's chosen idiom has in-tree precedent, even though it is a test
assertion rather than production validation logic today.

## State of the Art

Not applicable in the usual sense (no external ecosystem/library history to
track). The relevant "old approach -> current approach" shift is internal to
this milestone:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Each tool's location hand-coded at its own call site (`process.env.ACME_BIN ?? "acme"`, `process.env.GHIDRA_HOME`, fixed prefix lists, sibling probes) with no shared precedence order | One seam owning env -> file -> probe precedence per tool id, returning `{ path, tried, layer, mechanism }` | This phase (59) builds the seam; Phase 60 rewires the call sites to use it | `LOC-01`/`LOC-02` become true only once Phase 60 lands — this phase alone changes no live behaviour |
| No `tools.json` file exists at all; a user can only override via 4 env vars or none (`c1541`/`petcat`) | `tools.json` becomes a second, user-editable layer for all eight tools except the two explicitly excluded (`dxa`, `node`) | This phase adds the schema fields; Phase 60 makes callers honour the file | `LOC-04`'s gap (c1541/petcat un-locatable except as siblings) closes once Phase 60 lands |

**Deprecated/outdated:** None yet — nothing existing is removed or replaced
this phase; every current probe stays exactly as it is (D-01, D-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `tools.json` value shape (bare string vs. `{ path: string }` object) is left as an open specific by `59-CONTEXT.md` itself and is **not** decided by this research — the planner or a fresh discussion must pick one before Phase 59's implementation task is written. | Open Questions #1 below | If left undecided into planning, the plan risks silently picking one shape without recording the tradeoff `59-CONTEXT.md` flags (string is what a hand-written file most likely contains; object leaves room for `DOCTOR-F2`'s future per-machine layering) |
| A2 | The new seam's file name is left to the planner (per Discretion item 4); this research does not recommend a specific name beyond "not `host-tool-*`". | Recommended Project Structure | Low — purely cosmetic; any domain-prefixed name works as long as `HOST_BOUND_ARTIFACTS` and `tsconfig.build.json` both reference it consistently |
| A3 | `[ASSUMED]` The compiled-artifact test for Pitfall 1 (proving `prerequisites.json` resolves correctly from `resources/<seam>.mjs`) should extend `prerequisites.test.ts`'s existing `packedFileList()` machinery rather than add a wholly separate gate — this is a recommendation based on the project's stated "one authoritative structural gate" convention (`prerequisites.test.ts`'s own header, `[VERIFIED]`), not a decision `59-CONTEXT.md` itself makes for this specific test. | Pattern 4 / Code Examples | Low — if the planner instead writes the compiled-path test inside the new seam's own colocated `.test.ts`, that is equally defensible and does not violate any locked decision; only risk is a second npm-pack-driven test appearing if not coordinated |

**If this table is empty:** N/A — see above. All claims not listed here were
`[VERIFIED]` by direct `Read`/`grep` of the cited file and line range this
session, or `[CITED]` from `.planning/REQUIREMENTS.md` / `59-CONTEXT.md` text
quoted verbatim.

## Open Questions

1. **The `tools.json` value shape** (Specific #1 in `59-CONTEXT.md`).
   - What we know: two candidate shapes — `{"x64sc": "/path"}` (string) or
     `{"x64sc": {"path": "/path"}}` (object, room for a future per-entry
     field). D-11's `_`-prefix rule applies to the **keys** either way. The
     choice is user-facing file format and carries the same one-way weight
     D-11 does (withdrawing it after users have written files in one shape is
     a breaking change).
   - What's unclear: `59-CONTEXT.md` deliberately leaves this open ("Two gray
     areas were surfaced and deliberately left open, because the user
     declared ready for context").
   - Recommendation: the planner should resolve this explicitly in the
     PLAN.md (not silently default), stating the choice and its one-way
     reversibility cost, mirroring how `59-CONTEXT.md` records its own D-NN
     entries. The string form is simpler and is what `DOCTOR-08`'s
     doctor-emitted template (Phase 61) would most naturally produce for a
     user to read; the object form better serves `DOCTOR-F2`'s deferred
     per-machine layering. Absent a stronger signal, the string form is lower
     risk for *this* milestone (no consumer needs a second field yet) and
     defers the harder decision to whichever future phase actually implements
     `DOCTOR-F2`.

2. **How the compiled artifact reaches `prerequisites.json`** (Specific #2 in
   `59-CONTEXT.md`).
   - What we know: `findDxaBinary()`'s exact two-candidate,
     same-directory/one-level-up idiom is the established, working precedent
     for this exact problem shape (see Pattern 4 above, fully `[VERIFIED]`).
     `prerequisites.test.ts:349-354` already proves `DECL-05`'s packaging
     claim off `npm pack --dry-run --json`'s own file list — the technique to
     extend, not replace.
   - What's unclear: whether the planner extends `prerequisites.test.ts`'s
     existing packaging test case (my recommendation, A3 above) or writes the
     new seam's own colocated test for this — both are structurally sound;
     `59-CONTEXT.md` says "extend that case rather than writing a new gate"
     but does not specify which file the extension lives in.
   - Recommendation: extend `prerequisites.test.ts`'s packaging section with
     one additional assertion that a *built* `resources/<seam>.mjs`, invoked
     against a `HERE` computed from its own real post-build location, resolves
     `prerequisites.json` successfully — reusing `packedFileList()` if the
     proof needs the packed tarball's own layout, or a `build()`-then-import
     idiom (matching `host-tool.test.ts`'s and `prerequisites.test.ts`'s own
     "build before importing the artifact" pattern, `[VERIFIED:
     prerequisites.test.ts:47-51]`) if a scratch-directory proof suffices.

## Environment Availability

No external tool or service dependency exists for this phase's own
execution — no VICE, no ACME, no Ghidra, no dxa binary is required to write or
test the new seam, since its tests exercise real temporary directories and
injected `env`/`stat` overrides (Discretion item 3), not a live emulator.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Running the module, `node --test`, `tsc --noEmit` | ✓ | v24.20.0 (`[VERIFIED]`, confirmed this session, satisfies `engines.node: >=24.0.0`) | — |
| `npm` (for `npm pack --dry-run --json`, if extending the packaging proof per Open Question #2) | `prerequisites.test.ts`'s existing packaging section | ✓ (already required by, and passing in, Phase 58's tests) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate library `[VERIFIED: CLAUDE.md Frameworks section, and confirmed no jest/vitest/mocha config anywhere under src/mcp/vice]` |
| Config file | none — `package.json`'s `test` script is `node --test '*.test.*'` |
| Quick run command | `node --test src/mcp/vice/<new-seam>.test.ts` (single file) |
| Full suite command | `cd src/mcp/vice && npm test` (i.e. `node --test '*.test.*'`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| `LOC-05` | A `dxa` key in `tools.json` is refused by `validateToolsFile()`, naming the reason `prerequisites.json`'s `location.reason` field carries | unit | `node --test src/mcp/vice/<new-seam>.test.ts` | ❌ Wave 0 — new file |
| `LOC-06` | A `tools.json` entry that is absent, wrong-`kind`, or (for `directory` kind) missing its `marker` is refused by name, stating the file supplied it — amended per the CRITERION AMENDMENT, so `acme-lib`/`ghidra`'s directory state is accepted | unit | same file | ❌ Wave 0 — new file |
| `LOC-07` | A `node` key in `tools.json` is refused, quoting the `VICE_BROKER_NODE`/bash-reads-it-first reason | unit | same file | ❌ Wave 0 — new file |
| (structural, not a `LOC-NN` id but required by Success Criterion 1) | The new module is compiled into `resources/` by `build.ts`, byte-identical, no drift | unit (existing gate, extended, not new) | `node --test src/mcp/vice/resources-sync.test.ts` | ✓ exists, will pick up the new artifact automatically once added to `HOST_BOUND_ARTIFACTS` |
| (structural) | `prerequisites.json`'s new `location`/`kind`/`marker` fields are well-formed (every `location.envVar` a plausible env-var name, no tool id starts with `_`, every `kind: "directory"` record has a `marker`) | unit (existing gate, extended, not new) | `node --test src/mcp/vice/prerequisites.test.ts` | ✓ exists — this is D-05/D-07's designated home, per `59-CONTEXT.md`'s own "Established Patterns" note |

### Sampling Rate
- **Per task commit:** `node --test src/mcp/vice/<new-seam>.test.ts` and `node --test src/mcp/vice/prerequisites.test.ts`
- **Per wave merge:** `cd src/mcp/vice && npm run typecheck && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/mcp/vice/<new-seam>.mts` and its colocated `<new-seam>.test.ts` — no existing file covers this seam's behaviour (it is entirely new)
- [ ] `prerequisites.test.ts` extension for `location`/`kind`/`marker` field validation — the file exists but does not yet validate fields this phase adds
- [ ] Every refusal test needs a planted-violation control (per `ENGINEERING_RULES.md` §6, cited in `59-CONTEXT.md`'s canonical refs) — a malformed `acme` entry, a `dxa` key, a `node` key, a wrong-`kind` entry — each observed failing before the fix and passing after, matching `prerequisites.test.ts`'s own "the real document and a *planted violation* run the same code" idiom `[VERIFIED: prerequisites.test.ts:9-13]`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | not applicable — no auth surface in this module |
| V3 Session Management | no | not applicable |
| V4 Access Control | no | not applicable — this is a local-file/env resolver, not a multi-tenant surface |
| V5 Input Validation | yes | `validateToolsFile()` (D-10) is exactly a V5 control: refuse unknown keys by name (mirrors `normaliseHostToolRequest()`'s established discipline, `[VERIFIED: host-tool.mts:515-548]` — "never coerces a type... never drops a key silently"), refuse a wrong-`kind` path, refuse `dxa`/`node` keys explicitly |
| V6 Cryptography | no | not applicable — no secrets, no hashing, no crypto in this seam |
| V12 File and Resources | yes | Path handling lives entirely in the seam (roadmap constraint): `~` expansion, repo-root-relative resolution, and the `kind` check, with **a resolved path never interpolated into a shell string** — this is the load-bearing control against the class of vulnerability this codebase already names elsewhere (`host-tool.mts`'s own "No shell-form child process on any host-tool path" rule, `[VERIFIED: host-tool.mts:32-33]`), even though this seam itself never spawns anything — it exists so a **future** caller (Phase 60) inherits an already-safe resolved string rather than a raw, unvalidated one |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malicious or malformed `tools.json` entry pointing at an arbitrary path, later handed to a spawn call by a future caller | Tampering / Elevation of Privilege (if a future caller were to spawn it unchecked) | This phase's own validation (`kind`/`marker` checks, executable-bit check via `accessSync(p, X_OK)`) plus the standing project rule that a resolved path is **never** interpolated into a shell string (`~` expansion and repo-root-relative joins happen here, in the seam, not at the spawn call site) |
| A `tools.json` entry silently overriding a tool this project deliberately controls end-to-end (`dxa`) or that a launcher script needs before Node exists (`node`/`VICE_BROKER_NODE`) | Tampering / Spoofing (of the tool's actual identity) | D-05's `fileOverridable: false` + `reason` fields, enforced by `validateToolsFile()` refusing the key by name rather than silently accepting or silently ignoring it — the exact failure class the phase goal names ("the two deliberate exclusions are refused and documented rather than quietly ignored") |
| Prototype-pollution-style key names (`__proto__`, `constructor`) in a hand-edited `tools.json` | Tampering | Match the existing project convention for untrusted-key lookups: `host-tool.mts`'s allowlist uses exact, case-sensitive **array membership**, never an object-property lookup keyed by the untrusted string (`[VERIFIED: host-tool.mts:145-148]`, "so `__proto__`/`constructor`/`toString` refuse exactly like any other unrecognised value, with no separate special-case needed"). `validateToolsFile()` should check keys the same way — against the declaration's own known-id array, not by indexing an object with the raw key |

**Note on trust boundary:** `tools.json` is local, user-editable configuration
on the *user's own machine*, not untrusted input crossing a network or
container boundary (unlike `host-tool.mts`'s `host_tool` wire requests, which
this codebase's `untrusted-input-boundary.md` reference is chiefly concerned
with). The controls above are still warranted — a bad path here can still
crash a later caller, and the `dxa`/`node` refusals are a **policy** control
(preventing a user from accidentally defeating a supply-chain guarantee this
project makes about dxa specifically), not a defense against an adversarial
attacker.

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/mcp/vice/host-tool.mts` (read in full, lines 1-1028, 1280-1410,
  2190-2320, 2525-2565) — `findAcmeLib()`, `findDxaBinary()`,
  `findSiblingBinary()`, the `ACME_BIN`/`GHIDRA_HOME` read sites, the
  `HOST_TOOL_IDS` allowlist discipline, the module header's dxa reasoning
- `src/mcp/vice/backend-detect.mts` (read in full) — `resolvedBackend()`,
  `defaultResolveBinPath()`, `memoisedResult`, `ResolvedBackendDeps`
- `src/mcp/vice/build.ts` (read in full) — `HOST_BOUND_ARTIFACTS`,
  `GENERATED_BANNER()`, the staging/atomic-rename discipline
- `src/mcp/vice/tsconfig.build.json` (read in full) — the `include[]` array,
  confirmed identical membership to `HOST_BOUND_ARTIFACTS`
- `src/mcp/vice/repo-root.ts` (read in full) — `toolsDir()`, `supervisorDir()`,
  the "no static import, caller passes the resolved string" precedent
- `src/mcp/vice/broker-launch.mts` (read lines 1-1015) — the `inFlight`
  single-owner guard the seam must never be called from
- `src/mcp/vice/vice-errors.ts` (read in full) — `ViceError` base class,
  constructor shape, `isPlainObject` duplication convention
- `src/mcp/vice/prerequisites.json` (read in full) — the current 8-record
  shape, confirmed no `location`/`kind`/`marker` fields exist yet
- `src/mcp/vice/resources-sync.test.ts` (read in full) — the drift gate's
  mechanism, confirming it needs no phase-59-specific change (it walks
  `HOST_BOUND_ARTIFACTS` generically)
- `src/mcp/vice/prerequisites.test.ts` (read relevant sections, `grep -a`
  after discovering the NUL byte) — the packaging proof, the
  `build()`-before-import idiom, confirmed as the one authoritative
  structural gate over the declaration
- `src/mcp/vice/host-scripts.test.ts` (grep-confirmed line 283) —
  `accessSync`/`X_OK` precedent
- `src/mcp/vice/resources/vice-launcher.sh` (read lines 190-230) —
  `VICE_BROKER_NODE`'s bash-reads-it-first mechanism, verbatim
- `src/mcp/vice/package.json` (grep-confirmed) — `dependencies`, `engines`,
  `files[]`
- `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-CONTEXT.md`
  (read in full) — all eleven `D-NN` decisions, the CRITERION AMENDMENT, both
  Specifics, the Deferred list
- `.planning/REQUIREMENTS.md` (read in full) — `LOC-05`/`LOC-06`/`LOC-07`
  verbatim, the Out of Scope table's dxa/`VICE_BROKER_NODE` reason rows,
  `DOCTOR-03`/`DOCTOR-05`/`DOCTOR-08`
- `.planning/STATE.md` (tail read) — confirms Phase 58 is complete, Phase 59
  is next, and no intervening phase changed this module tree

### Secondary (MEDIUM confidence)
- `.planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-03-SUMMARY.md`
  (tail read) — confirms `prerequisites.json`'s current shape is the final
  Phase 58 output with no further pending edits before Phase 59 begins

### Tertiary (LOW confidence)
- None — every claim above traces to a direct `Read`/`grep` this session or a
  verbatim quote from `59-CONTEXT.md`/`REQUIREMENTS.md`, which are themselves
  the authoritative upstream decision records for this phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every primitive already in use elsewhere in the same file family
- Architecture: HIGH — every pattern cited is read directly from the shipped code this session, not recalled from training data
- Pitfalls: HIGH — Pitfall 2 (the NUL byte) was independently rediscovered and confirmed this session with both a failing plain-`grep` and a succeeding `grep -a`, not merely copied from `59-CONTEXT.md`'s own claim

**Research date:** 2026-09-18
**Valid until:** 30 days (stable internal codebase; no external ecosystem dependency to go stale) — but invalid immediately if Phase 60 or any other work lands in this same file family before Phase 59 is planned, since several line-number citations above would then need re-verification
