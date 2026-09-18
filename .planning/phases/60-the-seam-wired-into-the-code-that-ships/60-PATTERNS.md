# Phase 60: The Seam Wired Into the Code That Ships - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 8 modified (no new production module), 1-2 new test cases sets
**Analogs found:** 8 / 8 — this is a rewiring phase; every "analog" is the file itself,
read at its CURRENT (pre-Phase-60) shape, since RESEARCH.md's Live Callsite Inventory
already names every touched `file:line`.

All cited analog paths were verified with `git ls-files -- <path>` and are tracked
source (none are gitignored mirrors): `src/mcp/vice/tool-location.mts`,
`src/mcp/vice/backend-detect.mts`, `src/mcp/vice/broker-launch.mts`,
`src/mcp/vice/vice-broker.mts`, `src/mcp/vice/host-tool.mts`,
`src/mcp/vice/host-tool-client.ts`, `src/mcp/vice/hostpath-consumers.test.ts`,
`src/mcp/vice/prerequisites.test.ts`, `src/mcp/vice/prerequisites.json`,
`src/mcp/vice/build.ts`, `src/mcp/vice/vice-errors.ts`.

**Hazard reminder (carried from Phase 59, still true):** `src/mcp/vice/prerequisites.test.ts`
and `src/mcp/vice/anno-memmap-render.ts` both contain a real NUL byte and are silently
skipped by plain `grep` with zero warning. Every content census this phase runs over
`prerequisites.test.ts` — which this phase's `DECL-03` work will very likely extend —
MUST use `grep -a` (confirmed again this session: `grep -n "readPrerequisites"
prerequisites.test.ts` returns nothing, `grep -na` returns 5 matches).

**New hazard found this session, not in RESEARCH.md:** the comment convention "never name
a local `binPath`/`viceBin`/`VICE_BIN`/`x64sc`, `spawn-seam.test.ts` scans for exactly those
four tokens" appears **verbatim in three still-live files** —
`src/mcp/vice/host-tool.mts:1289-1291` and `:1355-1357`, `src/mcp/vice/host-tool-client.ts:43-45`,
`src/mcp/vice/acme-verify.ts:81-85` — but `spawn-seam.test.ts` **does not exist on disk**
(`git ls-files` and `find` both return nothing; `git log --oneline -- '*spawn-seam*'` shows
it was deleted by commit `276c15c9`, "delete 43 non-qualifying tests and module-classification.ts").
The naming discipline itself is still worth keeping (it is cheap and these three files still
advertise it), but the planner must not assume any live grep-based guard enforces it today —
if `LOC-02`'s new structural test is meant to also close this gap, that is a decision to make
explicitly, not something already covered. Do not cite `spawn-seam.test.ts` as an existing
analog for anything; it is gone.

## File Classification

| File (existing, modified by this phase) | Role | Data Flow | What changes | Analog for the change |
|---|---|---|---|---|
| `src/mcp/vice/vice-broker.mts` | host broker daemon (startup wiring) | request-response (one-shot resolve at process startup, then per-acquire callback wiring) | Add one `resolveTool("x64sc", …)` call alongside the existing `resolvedBackend()` call at startup; thread the winning path into `handleAcquire()`'s `deps` the same way `backend` is already threaded | itself — the existing `backend` threading through `HandleAcquireDeps`/`onAcquire` is the exact shape to copy for `viceBin` |
| `src/mcp/vice/broker-launch.mts` | host broker daemon (launch primitive + guard) | request-response, synchronous critical section (`inFlight`) | **No new seam call here.** `spawnAndRecordInstance()`'s and `launchSupervised()`'s `deps.viceBin ?? process.env.VICE_BIN ?? "x64sc"` expressions become `deps.viceBin ?? "x64sc"` (env fallback removed) once the caller always populates `deps.viceBin` | itself — `deps.backend`'s existing "resolved once by the caller, never re-read here" pattern is the model |
| `src/mcp/vice/backend-detect.mts` | service (identity/capability probe) | request-response, memoised once-per-process | Either (a) gains an internal `tools.json` layer via `resolveTool()`, called once inside the existing `if (memoisedResult !== null) return` guard, or (b) is left alone and the caller (`vice-broker.mts`) picks between its answer and the seam's — Open Question 2 in RESEARCH.md; planner decides explicitly | itself — `resolvedBackend()`'s existing `memoisedResult`/`ResolvedBackendDeps` shape is what any new internal call must respect |
| `src/mcp/vice/host-tool.mts` | host-tool executor (per-request dispatch) | request-response, per-invocation (no process-lifetime memo except `findSiblingBinary()`'s own) | `findAcmeLib()`, the `ACME_BIN` read, `GHIDRA_HOME` reads (×3), and `findSiblingBinary()`'s fallback all gain a `tools.json` layer via `resolveTool()`; `dxa`/`ghidra`/`acme` refusal messages read `prerequisites.json`'s `remedies`/`location.reason` instead of a hand-authored literal | itself — `findDxaBinary()`'s existing "vendored, un-overridable, refuse by name" shape is the model for what a seam-backed refusal must still read like |
| `src/mcp/vice/prerequisites.test.ts` | test (structural gate) | batch (document assertions) | New cases: mutate a scratch copy's `remedies`/`location.reason` text, assert a live refusal message tracks the mutation (`DECL-03`'s non-vacuity proof) | itself — `assertNoStrayVersionFloor`'s `structuredClone(doc)` + mutate + assert-offenders idiom |
| new structural test (file TBD by planner, e.g. `tool-location-consumers.test.ts`) | test (closed-consumer-set) | batch (static source scan) | Asserts `process.env.VICE_BIN`/`ACME_BIN`/`ACME`/`GHIDRA_HOME` occur only inside `tool-location.mts`/`tool-location.test.ts` and (if kept) `vice-broker.mts`'s reporting-only `resolveViceBinForHostState()` | `src/mcp/vice/hostpath-consumers.test.ts` — exact idiom to copy, see below |
| `src/mcp/vice/build.ts` / `tsconfig.build.json` | config / build script | batch (compile step) | **No new `HOST_BOUND_ARTIFACTS` entry** — `tool-location.mjs` is already listed (Phase 59). Only a rebuild is needed once `backend-detect.mts`/`host-tool.mts`/`broker-launch.mts`/`vice-broker.mts` are edited | itself — same list, no structural change |
| `src/mcp/vice/resources/*.mjs` (regenerated, committed) | generated artifact | batch | `backend-detect.mjs`, `host-tool.mjs`, and whichever of `broker-launch.mjs`/`vice-broker.mjs` are actually edited get regenerated and committed — **this is the first regeneration of an existing `HOST_BOUND_ARTIFACTS` entry**, per the roadmap's own naming of this fact | `resources-sync.test.ts` — the existing drift gate, needs no phase-specific edit |

## Pattern Assignments

### `src/mcp/vice/vice-broker.mts` (resolve-once-at-startup, thread down through an existing override)

**Analog:** itself — the file's own existing `backend` threading is the load-bearing model,
not an external one.

**The exact model to copy, verbatim shape** (`vice-broker.mts:1142-1146`, `[VERIFIED]` —
resolved once, outside any guard, at startup):
```typescript
const backendResult = resolvedBackend({ supervisorDir: args.stateDir });
const backend: ViceBackend = backendResult.backend;
process.stderr.write(
  `vice-broker: backend "${backend}" (binary: ${backendResult.binPath})\n`,
);
```

**How that resolved value is threaded into every downstream call, without a second
resolution** (`vice-broker.mts:440-446`, `[VERIFIED]` — `HandleAcquireDeps.backend`'s own
doc comment states the exact discipline the new `viceBin` field must follow):
```typescript
/** Which backend's launch argv to build -- the real broker
 * wiring (run()'s onAcquire callback below) resolves this ONCE at startup
 * via backend-detect.mts's resolvedBackend() and passes the SAME resolved
 * value on every call (resolvedBackend() itself is never called
 * per-acquire). Defaults to `"stock"` -- broker-launch.mts's own
 * buildViceArgs() default -- when a caller omits it entirely. */
backend?: ViceBackend;
```

**The actual per-acquire wiring site to extend** (`vice-broker.mts:1188-1201`, `[VERIFIED]`):
```typescript
onAcquire: (requestId, profile) =>
  handleAcquire(requestId, args.stateDir, state, {
    backend,
    allocateRemoteMonitorPort: (s: BrokerState, exclude: ReadonlySet<number>) => nextFreePort(s, { exclude }),
    profile,
  }),
```
A `viceBin` field belongs beside `backend` here, resolved once above (alongside the
`resolvedBackend()` call, `:1142`) via `resolveTool("x64sc", { toolsDir, projectRoot: args.repoRoot })`,
never re-read per acquire — exactly the comment on `backend` already promises for itself.

**Where `handleAcquire()` forwards it to the real launch call**
(`vice-broker.mts:695-733`, `[VERIFIED]` — the same `backend` local this function computes
at its own top is threaded into `acquirePortAndLaunch()`'s deps a few lines later; `viceBin`
must follow the identical path):
```typescript
export async function handleAcquire(requestId: string, stateDir: string, state: BrokerState, deps: HandleAcquireDeps = {}): Promise<AcquireOutcome> {
  const backend = deps.backend ?? "stock";
  // ...
  const result = await acquirePortAndLaunch("acquire", {
    state,
    stateDir,
    allocatePort: nextFreePort,
    backend,
    allocateRemoteMonitorPort: deps.allocateRemoteMonitorPort,
    // ...
```
`AcquirePortAndLaunchDeps` already declares `viceBin?: string` (`broker-launch.mts:595`) and
threads it, unpopulated today, straight through to `spawnAndRecordInstance()`. The fix is
**"populate an already-plumbed field"**, not "add new plumbing" — confirmed by reading
`acquirePortAndLaunch()`'s own body: it forwards `viceBin: deps.viceBin` to
`spawnAndRecordInstance()` (`broker-launch.mts:740-746`) already.

**Anti-pattern this phase must NOT introduce** — `resolveViceBinForHostState()`
(`vice-broker.mts:223-225`, `[VERIFIED]`, the fourth independent `VICE_BIN` read):
```typescript
function resolveViceBinForHostState(): string {
  return process.env.VICE_BIN ?? "x64sc";
}
```
This is reporting-only (`host_state.viceBin`), the lowest-risk of the four sites, and is the
one RESEARCH.md's own `LOC-02` test explicitly allows to survive as a documented exception —
but only if the planner decides to keep it that way explicitly, not by leaving it unexamined.
If it is folded into the seam instead, this becomes a fifth caller of the once-resolved value
from `run()`'s own scope, threaded the same way as `viceBin` above rather than re-read here.

---

### `src/mcp/vice/broker-launch.mts` (the guard: pattern to preserve, not to extend)

**Analog:** itself.

**The `inFlight` guard, byte-for-byte, showing exactly where a seam call must NEVER be
added** (`broker-launch.mts:573-581`, `[VERIFIED]`):
```typescript
export function tryLaunchOne(reason: string, port: number, deps: TryLaunchDeps): InstanceRecord | null {
  if (inFlight) return null;
  inFlight = true;
  try {
    return spawnAndRecordInstance(reason, port, deps);
  } finally {
    inFlight = false;
  }
}
```
and the async variant (`broker-launch.mts:677-684`, `[VERIFIED]`):
```typescript
export async function acquirePortAndLaunch(reason: string, deps: AcquirePortAndLaunchDeps): Promise<AcquireLaunchResult> {
  if (inFlight) {
    log(`vice-broker: launch-slot decision -- ${inFlightReason ?? "unknown"} holds the slot; ${reason} waits`);
    // ...
  }
  inFlight = true;
  inFlightReason = reason;
```
Neither function may gain a `resolveTool(` call inside this region. The existing
`TryLaunchDeps.viceBin` doc comment already states the intended discipline
(`broker-launch.mts:390-397`, `[VERIFIED]`):
```typescript
/** Which backend's argv shape to build -- optional and defaulting to
 * `"stock"` when omitted, the only value `ViceBackend` has now that the
 * fork backend is gone. The real broker resolves this ONCE at startup
 * via backend-detect.mts's resolvedBackend() and passes the resolved
 * value down through every real launch call site -- see that module's own
 * doc comment; this file reads no environment variable itself. */
backend?: ViceBackend;
```
**The literal edit this phase makes here**, once `vice-broker.mts` always populates
`deps.viceBin`, is narrowing the two duplicated fallback expressions
(`broker-launch.mts:445`, `spawnAndRecordInstance()`, and `:1523`, `launchSupervised()`):
```typescript
const viceBin = deps.viceBin ?? process.env.VICE_BIN ?? "x64sc";
```
to drop the `process.env.VICE_BIN ??` clause — the env read moves entirely into the seam,
called once upstream; this file becomes a pure consumer of an already-resolved string, with
`"x64sc"` kept only as the last-resort default for a caller (a test) that supplies neither.

---

### `src/mcp/vice/host-tool.mts` (per-request resolution inside `runHostTool()`)

**Analog:** itself — `findDxaBinary()`'s existing shape is the refusal-message model;
`runHostTool()`'s own `repoRootAbs` computation is the "already-available root" this phase's
new `resolveTool()` calls derive `toolsDir`/`projectRoot` from.

**The already-available root, no new plumbing needed** (`host-tool.mts:2326-2339`,
`[VERIFIED]`):
```typescript
export async function runHostTool(raw: unknown, deps: HostToolDeps): Promise<HostToolResponse> {
  const narrowed = normaliseHostToolRequest(raw);
  if (!narrowed.ok) return { ok: false, message: narrowed.message };
  const { request } = narrowed;
  // ...
  const repoRootAbs = resolvePath(deps.repoRoot);
```
`toolsDir` (`join(repoRootAbs, ".c64-re-tools")`) and `projectRoot` (`repoRootAbs` itself)
for every `resolveTool()` call this phase adds inside this function's body derive from this
one value — matching D-nothing-new for `ResolveToolDeps`'s own required-explicit-string
convention (Phase 59 D-nothing, "no static `repo-root.ts` import").

**The ACME binary read to widen** (`host-tool.mts:1283-1292`, `[VERIFIED]`):
```typescript
export function buildHostToolArgv(request: HostToolRequest, resolved: ResolvedHostToolPaths, log?: (line: string) => void): BuildHostToolArgvResult {
  if (request.tool === "acme.build") {
    // ...
    // Overridable local variable named for what it holds -- never `binPath`/
    // `viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's
    // EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site.
    const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";
```
**Note (Pitfall 4, confirmed this session):** there is no existence check here at all before
`spawn()` — a missing `acme` today surfaces as a raw OS `ENOENT`, not a curated refusal
(confirmed: no `existsSync`/refusal branch surrounds this read anywhere in `buildHostToolArgv`'s
`acme.build` arm). `DECL-03`'s `acme` closure is new pre-spawn-existence-check behaviour, built
on `resolveTool("acme", …)`, not a text-source repoint of something that already exists.

**The `GHIDRA_HOME` refuse-by-name shape to match for `DECL-03`'s remedy-reading rewiring**
(`host-tool.mts:1346-1364`, `[VERIFIED]` — two refusal branches, both currently
hand-authored, both duplicated a second time at `:1513-1526` for `ghidra.installExtension`):
```typescript
// Named environment variable, never a guessed install location and
// never this repository's own local probe directory (T-34-16).
const ghidraHome = process.env.GHIDRA_HOME;
if (ghidraHome === undefined || ghidraHome === "") {
  return {
    ok: false,
    message: `host_tool "ghidra.analyze" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
  };
}
const ghidraPath = join(ghidraHome, "support", "analyzeHeadless");
if (!existsSync(ghidraPath)) {
  return {
    ok: false,
    message: `host_tool "ghidra.analyze" refuses: GHIDRA_HOME's resolved launcher does not exist on disk (${ghidraPath})`,
  };
}
```
Under `DECL-03`, both branches become one `resolveTool("ghidra", { toolsDir, projectRoot })`
call whose `refusal`/`path` fields drive the same two-shaped response, but the "requires…"
sentence is read from `prerequisites.json`'s `ghidra` record rather than re-authored — see
the `prerequisites.json` section below for exactly which field.

**The `dxa` refusal, already correctly un-overridable, and the shape `DECL-03` must preserve
while only changing WHERE the sentence comes from** (`host-tool.mts:1459-1472`, `[VERIFIED]`):
```typescript
// A-01: fixed, computed path -- never an env-var override (see the HERE
// and findDxaBinary() comments above). Refuses BY NAME when the vendored
// binary does not exist at EITHER candidate location, naming build.bash
// as the remedy, per PLAN.md item 6.
const dxaFound = findDxaBinary(HERE);
if (dxaFound.path === null) {
  return {
    ok: false,
    message: `host_tool "dxa.disassemble" refuses: the vendored dxa binary does not exist (tried: ${dxaFound.tried.join(", ")}) -- run "bash vendor/dxa/build.bash build" to produce it`,
  };
}
```
This message hardcodes `"bash vendor/dxa/build.bash build"` — `prerequisites.json`'s own
`dxa` remedy (see below) carries the same text by *coincidence* today (two independently
authored strings). `DECL-03` makes this message interpolate the declaration's remedy string
instead of the literal, while keeping `findDxaBinary()`'s own existence check exactly as is
(D-05/`LOC-05`: `dxa` stays project-vendored, never routed through `resolveTool()`'s
env/file layers — only its refusal MESSAGE gains a declaration-backed source).

**`findSiblingBinary()`, the widen-not-replace site for `LOC-04`**
(`host-tool.mts:2260-2311`, `[VERIFIED]` — full body, already the RESEARCH.md-cited memo/
fallback/warning shape):
```typescript
const siblingBinaryMemo = new Map<string, { path: string | null; tried: string[] }>();

function findSiblingBinary(binaryName: string, resolvedX64scPath: string, log?: (line: string) => void): { path: string | null; tried: string[] } {
  const memoised = siblingBinaryMemo.get(binaryName);
  if (memoised) return memoised;

  const tried: string[] = [];
  const siblingCandidate = join(dirname(resolvedX64scPath), binaryName);
  tried.push(siblingCandidate);
  if (existsSync(siblingCandidate)) {
    const result = { path: siblingCandidate, tried };
    siblingBinaryMemo.set(binaryName, result);
    return result;
  }

  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, binaryName);
    tried.push(candidate);
    if (existsSync(candidate)) {
      log?.(
        `host_tool: "${binaryName}" was not found alongside the resolved x64sc (${resolvedX64scPath}); ` +
          `falling back to a $PATH match at ${candidate} -- this may be a DIFFERENT VICE build than the emulator`,
      );
      const result = { path: candidate, tried };
      siblingBinaryMemo.set(binaryName, result);
      return result;
    }
  }

  const result = { path: null, tried };
  siblingBinaryMemo.set(binaryName, result);
  return result;
}
```
"Widened, not replaced" (D-15/Open Question 1) means: insert a `tools.json` check via
`resolveTool("c1541"|"petcat", …)` **between** the sibling-of-`x64sc` check and the `$PATH`
fallback loop, memoising a `tools.json` hit exactly like the other two branches already do
(same `siblingBinaryMemo.set(binaryName, result)` call), and calling `log?.()` **only** for
the `$PATH`-fallback branch — never for a `tools.json` hit, which is an intentional override,
not a hazard.

**The two call sites this widening must keep passing an unchanged `resolvedBackend().binPath`
as the sibling-candidate seed** (`host-tool.mts:1555`, `[VERIFIED]`):
```typescript
const c1541Found = findSiblingBinary("c1541", resolvedBackend().binPath, log);
if (c1541Found.path === null) {
  return {
    ok: false,
    message: `host_tool "${request.tool}" refuses: "c1541" does not exist (tried: ${c1541Found.tried.join(", ")})`,
  };
}
```
and (`host-tool.mts:1629-1636`, `[VERIFIED]` — resolves RESEARCH.md's Open Question 3, the
exact `c1541`/`petcat` refusal text was flagged as unread past `:1560`/`:1636`; both are now
confirmed as the identical shape):
```typescript
const petcatFound = findSiblingBinary("petcat", resolvedBackend().binPath, log);
if (petcatFound.path === null) {
  return {
    ok: false,
    message: `host_tool "petcat.decode" refuses: "petcat" does not exist (tried: ${petcatFound.tried.join(", ")})`,
  };
}
```
Both refusal messages stay shaped exactly this way (name the tool, state absence, list
`tried`) once `tried` also carries whatever `resolveTool()`'s file-layer check inspected.

**The `findAcmeLib()` widening site** (`host-tool.mts:2231-2245`, `[VERIFIED]`, full body):
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
where `ACME_LIB_MARKER` (`host-tool.mts:2205`) is `join("cbm", "c64", "vic.a")` — identical
to `prerequisites.json`'s `acme-lib.marker` field (Phase 59 already declared it), so
`resolveTool("acme-lib", …)`'s own `matchesDeclaredKind()` directory+marker check is already
exactly this function's own check, just generalized. `resolveTool()` is a drop-in for this
whole function's body once wired — the only caller-visible change is that a `tools.json`
entry now wins between the environment (`process.env.ACME`) and the fixed-prefix list, which
today has no such layer at all.

**Naming-discipline comment appearing at both env-read sites** — cite so the planner does not
add a new local named `binPath`/`viceBin`/`VICE_BIN`/`x64sc` inside `host-tool.mts` while
rewiring, matching the file's own two extant occurrences (`host-tool.mts:1289-1291`,
`:1355-1357`), even though the enforcing test (`spawn-seam.test.ts`) no longer exists on disk
(see the Hazard note above) — the convention is worth keeping voluntarily.

---

### `src/mcp/vice/hostpath-consumers.test.ts` (the LOC-02 closed-consumer-set analog)

**Analog:** itself, in full — this is the strongest direct analog in the whole phase; the
`LOC-02` test is a same-shaped scan over a different token set.

**The predicate + regex pair to copy, adapted from "imports hostpath.ts" to "reads
`process.env.VICE_BIN`" (etc.)** (`hostpath-consumers.test.ts:35-71`, `[VERIFIED]`):
```typescript
const HOSTPATH_IMPORT_RE = /^\s*import\s[^;]*from\s+"\.\/hostpath\.(ts|mts|mjs)"/m;
const HOSTPATH_DYNAMIC_IMPORT_RE = /import\s*\(\s*["'][^"']*\/hostpath\.(ts|mts|mjs)["']\s*\)/;

function importsHostpath(strippedSrc: string): boolean {
  return HOSTPATH_IMPORT_RE.test(strippedSrc) || HOSTPATH_DYNAMIC_IMPORT_RE.test(strippedSrc);
}
```
For `LOC-02`, the equivalent predicate matches a real property-access read of
`process.env.VICE_BIN` / `.ACME_BIN` / `.ACME` / `.GHIDRA_HOME` (never a bracket lookup, never
a substring inside a comment or string literal) against comment-stripped source — reuse
`stripCommentLines()` verbatim (`hostpath-consumers.test.ts:86-119`, the same block-comment-
and-line-comment stripper, already newline-tolerant).

**The comment-stripper to reuse verbatim** (`hostpath-consumers.test.ts:86-119`, `[VERIFIED]`,
full body — copy this function rather than re-deriving a second stripper):
```typescript
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return;
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true;
        return;
      }
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return;
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}
```

**The directory-walk + closed-set-membership assertion to mirror**
(`hostpath-consumers.test.ts:121-166`, `[VERIFIED]`):
```typescript
function topLevelProductionModules(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

function hostpathImporters(): string[] {
  const importers: string[] = [];
  for (const name of topLevelProductionModules()) {
    const src = readFileSync(join(HERE, name), "utf8");
    const stripped = stripCommentLines(src);
    if (importsHostpath(stripped)) {
      importers.push(name);
    }
  }
  return importers.sort();
}

const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts"];

test("hostpath.ts's production consumer set is exactly the four declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 4);
});
```
For `LOC-02`, `EXPECTED_ENV_READERS` (or similarly named) is a **per-env-var** closed set:
`tool-location.mts`/`tool-location.test.ts` for all four, plus — only if the planner
explicitly decides to keep it — `vice-broker.mts` for `VICE_BIN` alone
(`resolveViceBinForHostState()`, reporting-only). Assert the set with `assert.deepEqual`
against a named array, exactly as above, never a bare count.

**The planted-violation non-vacuity proof to mirror**
(`hostpath-consumers.test.ts:406-415`, `[VERIFIED]`):
```typescript
test("planted violation (INT-01 proof): a synthetic anno-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses", () => {
  const plantedViolation = `import { hostPath } from "./hostpath.ts";\nexport function doSomething() {}\n`;
  const plantedClean = `export function doSomething() {}\n`;
  assert.equal(
    importsHostpath(stripCommentLines(plantedViolation)),
    true,
    "the predicate must report a genuine hostpath.ts import -- if this fails, the absence assertion above is not actually capable of catching a real violation",
  );
  assert.equal(importsHostpath(stripCommentLines(plantedClean)), false, "a clean source with no hostpath.ts mention must not be reported");
});
```
`LOC-02`'s own test needs the same pair: a synthetic source containing a genuine
`process.env.VICE_BIN` read (reported) and one containing only a comment/string-literal
mention of the same text (not reported) — matching the "three import shapes" test at
`hostpath-consumers.test.ts:417-461` if the planner wants the same rigor against multi-line
or computed-property-access shapes.

---

### `src/mcp/vice/prerequisites.test.ts` (the DECL-03 non-vacuity idiom)

**Analog:** itself — `assertNoStrayVersionFloor()` and its own planted-violation test are
the exact idiom `DECL-03`'s "a refusal message tracks a mutated declaration" tests must copy.

**The named-exported-validator idiom** (`prerequisites.test.ts:91-98`, `[VERIFIED]` via
`grep -a`, full body):
```typescript
export function assertNoStrayVersionFloor(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  for (const [id, record] of Object.entries(doc.tools)) {
    if (id === "node") continue;
    if (Object.prototype.hasOwnProperty.call(record, "versionFloor")) offenders.push(id);
  }
  return offenders;
}
```

**The planted-violation test to mirror exactly, adapted to a live refusal message rather than
a validator's offender list** (`prerequisites.test.ts:387-395`, `[VERIFIED]` via `grep -a`):
```typescript
test("structural (T-58-01): assertNoStrayVersionFloor's planted violation is reported and the real document is not (non-vacuity)", () => {
  const doc = readPrerequisites();
  assert.deepEqual(assertNoStrayVersionFloor(doc), [], "the real, unmodified document must pass");

  const mutated = structuredClone(doc);
  (mutated.tools.x64sc as ToolRecord).versionFloor = ">=99.0.0";
  const offenders = assertNoStrayVersionFloor(mutated);
  assert.deepEqual(offenders, ["x64sc"], "a version-floor field planted on a non-node record must be reported");
});
```
`DECL-03`'s equivalent (likely landing in `host-tool.test.ts`, driven against a scratch
`prerequisites.json` copy rather than the real committed one, since `host-tool.mts`'s
declaration read is file-based, not `structuredClone`-based): write a scratch declaration
file with `dxa`'s (or `ghidra`'s) `remedies`/`location.reason` text mutated to a distinctive
sentence, point `resolveTool`'s `here`/declaration-lookup override at the scratch directory,
call the real refusal path, and assert the returned message contains the MUTATED sentence —
proving the refusal reads the file rather than a code literal. Pair it with the real-document
case passing first (`readPrerequisites()`'s own committed text appears in the message), the
same two-part shape `assertNoStrayVersionFloor`'s own test uses.

**The `location` block's current shape, source for the mutation target**
(`prerequisites.test.ts:175-209`, `[VERIFIED]` via `grep -a`, full body — this is also the
existing structural gate `assertLocationBlockShape`/`assertKindAndMarker` any new
`DECL-03`-adjacent field check must extend, never duplicate):
```typescript
const ENV_VAR_NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const LOCATION_KEYS = new Set(["envVar", "fileOverridable", "reason"]);

export function assertLocationBlockShape(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  for (const [id, record] of Object.entries(doc.tools)) {
    const location = (record as unknown as { location?: unknown }).location;
    if (location === null || location === undefined || typeof location !== "object" || Array.isArray(location)) {
      offenders.push(`${id}.location`);
      continue;
    }
    const loc = location as Record<string, unknown>;
    for (const key of Object.keys(loc)) {
      if (!LOCATION_KEYS.has(key)) offenders.push(`${id}.location.${key}`);
    }
    if (typeof loc.fileOverridable !== "boolean") {
      offenders.push(`${id}.location.fileOverridable`);
    } else if (loc.fileOverridable === false && (typeof loc.reason !== "string" || loc.reason.length === 0)) {
      offenders.push(`${id}.location.reason`);
    }
    if (loc.envVar !== undefined && (typeof loc.envVar !== "string" || !ENV_VAR_NAME_RE.test(loc.envVar))) {
      offenders.push(`${id}.location.envVar`);
    }
  }
  return offenders;
}
```

---

### `src/mcp/vice/prerequisites.json` (read-only this phase; source of the remedy/reason text)

**Analog:** itself, its own already-committed `location.reason` strings for `dxa` and `node`
(`[VERIFIED]` via `grep -a`, exact strings a `DECL-03` refusal must quote verbatim):
```json
"dxa": {
  "location": {
    "fileOverridable": false,
    "reason": "dxa is vendored and built by this project, so an override could only select a binary it did not build and did not pin."
  }
}
```
```json
"node": {
  "location": {
    "fileOverridable": false,
    "reason": "vice-launcher.sh is bash and reads VICE_BROKER_NODE before any working Node exists to parse JSON with."
  }
}
```
`tool-location.mts`'s own `resolveTool()` already reads and quotes `record.location.reason`
verbatim for these two ids (confirmed this session, `tool-location.mts:477-486`) — nothing
new to build there; `DECL-03`'s work is entirely inside `host-tool.mts`'s callers threading
the seam's `refusal` field into their existing response shape.

**Every `location.envVar` mapping this phase's wiring reads, already declared** (confirmed
`[VERIFIED]` this session against the live file):
| Tool id | `envVar` | `kind` | `marker` |
|---|---|---|---|
| `x64sc` | `VICE_BIN` | `executable` | — |
| `acme` | `ACME_BIN` | `executable` | — |
| `acme-lib` | `ACME` | `directory` | (declared, matches `ACME_LIB_MARKER`) |
| `ghidra` | `GHIDRA_HOME` | `directory` | (declared, matches `support/analyzeHeadless`) |
| `c1541` | none (D-06) | `executable` | — |
| `petcat` | none (D-06) | `executable` | — |
| `dxa` | none, `fileOverridable: false` | `executable` | — |
| `node` | none, `fileOverridable: false` | `executable` | — |

---

### `src/mcp/vice/build.ts` / `resources/*.mjs` (regeneration only, no structural edit)

**Analog:** itself. `tool-location.mjs` is **already** a member of `HOST_BOUND_ARTIFACTS`
(`build.ts:42-53`, `[VERIFIED]`, current full list):
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
  "tool-location.mjs",
];
```
Phase 60 makes **no edit to this array** — it edits the `.mts` SOURCES of four already-listed
entries (`backend-detect.mts`, `host-tool.mts`, and whichever of `broker-launch.mts`/
`vice-broker.mts` end up touched) and must run `node build.ts` (or the plan's own build step)
to regenerate and commit the corresponding `.mjs` files before `resources-sync.test.ts` can
pass. This is the literal mechanism behind the roadmap's "first regeneration of the committed
`resources/*.mjs` artifacts" cross-cutting constraint — not a metaphor, and not a task that
needs a new pattern: it is the exact same `build()` call Phase 59 already ran once for
`tool-location.mts` itself.

## Shared Patterns

### Resolve once outside a synchronous guard, thread through an already-plumbed override field
**Source:** `src/mcp/vice/vice-broker.mts:1142-1146` (the `resolvedBackend()` call) and
`:1188-1201`/`:695-733` (how `backend` is threaded through `HandleAcquireDeps` into
`acquirePortAndLaunch()`); the target field, `AcquirePortAndLaunchDeps.viceBin` /
`TryLaunchDeps.viceBin`, already exists and is already unpopulated at every real call site.
**Apply to:** the `x64sc` resolution rewiring inside `vice-broker.mts` — resolve once at
startup, pass the winning string down through the SAME parameter path `backend` already uses.
**Never:** call `resolveTool()` from inside `broker-launch.mts`'s `inFlight` window
(`tryLaunchOne()`, `acquirePortAndLaunch()`'s pre-`await` region) — both are cited above,
byte-for-byte, as the region a seam call must never enter.

### Refuse by name, quoting a declared field rather than a re-authored literal
**Source:** `src/mcp/vice/tool-location.mts:470-486` (`resolveTool()`'s own `fileOverridable:
false` refusal, already quoting `record.location.reason` verbatim) and
`src/mcp/vice/host-tool.mts:1346-1364`/`:1459-1472` (the CURRENT hand-authored refusal shapes
this phase repoints)
**Apply to:** every `dxa`/`ghidra`/`acme` refusal branch this phase rewires — the tool id is
named, the fact is stated, and the sentence explaining what to do about it is read from
`prerequisites.json` at call time, never re-typed in `host-tool.mts`.

### Closed-consumer-set structural test, comment-stripped source scan, named array, planted-violation proof
**Source:** `src/mcp/vice/hostpath-consumers.test.ts` in full — `stripCommentLines()`,
`topLevelProductionModules()`, the `EXPECTED_IMPORTERS` deep-equal assertion, and the
planted-violation pair at `:406-415`.
**Apply to:** `LOC-02`'s new test, closing the four env-var names into a named, asserted
consumer set exactly this shape, never a bare `grep` one-liner with no non-vacuity proof.

### Non-vacuous validator: `structuredClone`, mutate one field, assert the offender/message tracks it
**Source:** `src/mcp/vice/prerequisites.test.ts:91-98` (`assertNoStrayVersionFloor`) and its
companion test at `:387-395`.
**Apply to:** every `DECL-03` refusal-tracks-declaration test — real-document-passes case,
then a mutated-scratch-copy case whose message changes to match, per
`.planning/ENGINEERING_RULES.md` §6.

### Widen a probe's candidate order without changing its memo semantics
**Source:** `src/mcp/vice/host-tool.mts:2260-2311` (`findSiblingBinary()`, full body,
including its per-binary-name `Map` memo and its `log?.()` warning callback, reserved for the
`$PATH`-fallback branch alone)
**Apply to:** `LOC-04`'s `c1541`/`petcat` widening — insert the `tools.json` check between the
sibling-of-`x64sc` check and the `$PATH` walk; memoise a `tools.json` hit exactly like the
other two branches already do; never call `log?.()` for an intentional `tools.json` override.

## No Analog Found

None. Every file this phase touches is edited in place; RESEARCH.md's own Live Callsite
Inventory already names every `file:line`, and every rewiring pattern needed (resolve-once-
outside-a-guard, refuse-by-name-with-a-declared-reason, closed-consumer-set structural test,
non-vacuous mutate-and-assert) already exists at least once in this exact file family. The
one genuinely new *behavior* (`acme`'s pre-spawn existence check, Pitfall 4) still reuses an
existing shape — `findDxaBinary()`'s "refuse by name before spawning" pattern — it is new
code, not a new pattern.

## Metadata

**Analog search scope:** `src/mcp/vice/` only — same single-package, single-directory scope
Phase 59 used; nothing in this phase's rewiring touches any other directory.
**Files scanned this session:** `tool-location.mts` (full header + `resolveTool()` body),
`backend-detect.mts` (header + `resolvedBackend()`/`ResolvedBackendDeps`/memo),
`broker-launch.mts` (header, `TryLaunchDeps`, `spawnAndRecordInstance`, `tryLaunchOne`,
`AcquirePortAndLaunchDeps`, `acquirePortAndLaunch`, `launchSupervised`), `vice-broker.mts`
(startup `resolvedBackend()` call, `resolveViceBinForHostState()`, `HandleAcquireDeps`,
`handleAcquire()`, the `run()` `onAcquire` wiring), `host-tool.mts` (import header,
`findDxaBinary`/`findAcmeLib`/`findSiblingBinary`, `ghidra.analyze`/`ghidra.installExtension`/
`dxa.disassemble`/`c1541.*`/`petcat.decode` branches, `runHostTool()`'s `repoRootAbs`),
`host-tool-client.ts` (header, naming-discipline comment), `hostpath-consumers.test.ts`
(full file), `prerequisites.test.ts` (targeted via `grep -a`: validator functions, planted-
violation tests, `location` block shape), `prerequisites.json` (full file, via `grep -a` and
direct read), `build.ts` (`HOST_BOUND_ARTIFACTS`, `GENERATED_BANNER`), `stock-dispatch.ts` /
`vice-proxy.ts` (grep for `resolvedBackend`/`resolvedBinaryPath` reporting consumers) — all
confirmed git-tracked via `git ls-files`.
**Pattern extraction date:** 2026-09-18
