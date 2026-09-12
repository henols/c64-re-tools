# Phase 47: Multi-File Rebuildable Source - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 6 (new/modified) + 2 test files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/mcp/vice/anno-export-asm.ts` (extend, no second export route) | service/transform | batch (store rows -> file-tree text) | itself (existing exporter, extend in place) | exact — this file already owns the whole responsibility, just needs a new partitioning layer + one new emission branch |
| `src/mcp/vice/host-tool.mts` (`buildHostToolArgv()` acme.build branch, `spawnHostTool()`, `runHostTool()`) | service (spawn plumbing) | request-response (build a request, spawn, collect result) | itself (existing `acme.build` branch) | exact — thread one new `cwd` field through an existing three-function chain |
| `src/mcp/vice/anno-cli.ts` (`export-asm` verb, `cmdExportAsm`) | CLI/controller | request-response | itself (existing `export-asm` verb, `defaultExportAsmOut()`) | exact — decide `--out` semantics for a directory instead of one file |
| `src/mcp/vice/anno-store.ts` / `anno-types.ts` | model | CRUD (schema/read only, unchanged) | itself | exact — `listScopes()`/`ScopeRow`/`DATA_TYPES`/`external_file` already exist; this phase READS them, does not add new store surface |
| `src/mcp/vice/anno-export-asm.test.ts` (new cases) | test | integration (real ACME spawn) | itself, `buildStore()`/`buildStoreOverImage()` helpers (lines ~214/~243) | exact — stated idiom to extend, not invent |
| `src/mcp/vice/host-tool.test.ts` (new cases) | test | unit + integration | itself, existing in-process `runHostTool({ tool: "acme.build", ... })` pattern (~line 452) | exact |
| new determinism/drift test (new file or added to `anno-export-asm.test.ts`) | test | batch (walk + sort + byte-diff) | `src/mcp/vice/resources-sync.test.ts` | role-match (different domain, same walk-and-diff shape) |
| new "refuse unresolved cross-reference" error path in `anno-export-asm.ts` | error path | request-response | `assertDataTypeForExport()` / `assertExportableCommentText()` in the same file (lines 754-798) | exact — this project's own "refuse by name, never quote content" idiom, already used twice in this exact file |

## Pattern Assignments

### `src/mcp/vice/anno-export-asm.ts` (extend — scope partitioning + `external_file` branch)

**Analog:** itself. No external analog needed; the decoder/renderer/block-assertion
machinery this phase must NOT touch is already proven. What's new is a
partitioning layer above the existing per-block loop, plus one new
data-emission branch.

**"Refuse by name, never quote content" idiom to copy verbatim for the new
BUILD-03 unresolved-cross-reference refusal** (`anno-export-asm.ts:754-772`,
`assertExportableCommentText`):

```typescript
export function assertExportableCommentText(text: string, address: number): string {
  try {
    return assertCommentText(text);
  } catch (err) {
    const reason = err instanceof AnnoCommentError && err.reason !== undefined ? err.reason : "refused by the store's comment-text vocabulary";
    throw new Error(
      `exportAsm: the comment at ${hex4(address)} cannot be emitted (${reason}). Every comment this exporter emits is a single line of text ` +
        `that the store's own comment-text vocabulary accepts; a stored line break would put everything after it into the ACME source at ` +
        `column zero, as assembler input rather than as a comment. REFUSED rather than repaired -- stripping or truncating here would change ` +
        `what somebody wrote and report success.`,
    );
  }
}
```

Same shape again, for a range/dataType instead of a comment
(`anno-export-asm.ts:774-798`, `assertDataTypeForExport`) — note the explicit
"the offending value is deliberately NOT quoted here" discipline in both:

```typescript
export function assertDataTypeForExport(row: { start: number; endInclusive: number; dataType: unknown }): DataType {
  try {
    return assertDataType(row.dataType);
  } catch {
    throw new Error(
      `exportAsm: the range ${hex4(row.start)}..${hex4(row.endInclusive)} (inclusive) carries a data type that is not one of the ` +
        `${DATA_TYPES.length} the store defines (${DATA_TYPES.join(", ")}) -- refusing to guess what it meant. This module copies a ` +
        `range's data type VERBATIM into the emitted source's block comment, so an unvalidated value reaches ACME as text: one ` +
        `containing a line break would put everything after it at column zero, as assembler input rather than as a comment. ` +
        `The offending value is deliberately NOT quoted here -- an exporter error that echoes a file's contents is a ` +
        `content-disclosure oracle.`,
    );
  }
}
```

**Apply to BUILD-03's unresolved cross-reference refusal:** `throw new
Error(...)` (plain `Error`, not `ViceError` — this file never imports
`vice-errors.ts`), message names the ADDRESS and the fact/rule that fired,
never the symbol/label text or file bytes, and states plainly why guessing
(e.g. falling back to raw hex) is refused rather than attempted. This is the
same idiom the Open Questions section's own scope-crossing-range refusal
should use.

**Existing generic `throw new Error(...)` shape used throughout this file**
(20 call sites, e.g. `anno-export-asm.ts:480`, `:938`, `:1215`) — no
`ViceError`/custom class anywhere in this file; every refusal is a plain
`Error` with a long, address-anchored, content-free message. New refusals in
this phase (scope-crossing range, unresolved symbol) must match this house
style, not introduce a new error class.

**Scope model to read (unchanged, read-only this phase):**
- `listScopes()` — `anno-store.ts:3088` (returns `ScopeRow[]`)
- `ScopeRow` — `anno-types.ts:611`
- `DATA_TYPES` (12-member array including `"external_file"`) — `anno-types.ts:363-374`

---

### `src/mcp/vice/host-tool.mts` (thread `cwd` through the `acme.build` spawn)

**Analog:** itself — extend the existing three-function chain, do not add a
second spawn site.

**`buildHostToolArgv()`'s current `acme.build` branch** (`host-tool.mts:1287-1327`,
argv is built as an array, source path resolved through the same site
`outDir`/`includes` use, ACME's own binary-name local variable deliberately
named `acmePath` — never `binPath`/`viceBin`/`VICE_BIN`/`x64sc`):

```typescript
export function buildHostToolArgv(request: HostToolRequest, resolved: ResolvedHostToolPaths, log?: (line: string) => void): BuildHostToolArgvResult {
  if (request.tool === "acme.build") {
    const { args } = request;
    const { sourcePath, outDirPath, includePaths } = resolved as ResolvedAcmeBuildPaths;
    const stem = join(outDirPath, basename(sourcePath).replace(/\.(a|asm|s)$/i, ""));
    const prg = `${stem}.prg`;
    // Overridable local variable named for what it holds -- never `binPath`/
    // `viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's
    // EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site.
    const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";
    const argv: string[] = [ /* ...fixed flags..., */ "-o", prg, "-l", `${stem}.sym`, "--vicelabels", `${stem}.vs` ];
    if (!args.noReport) argv.push("-r", `${stem}.rep`);
    for (const define of args.defines ?? []) argv.push(`-D${define}`);
    for (const include of includePaths ?? []) argv.push("-I", include);
    if (args.setpc) argv.push("--setpc", args.setpc);
    argv.push(sourcePath);
    return { ok: true, toolPath: acmePath, argv, outputs: [prg] };
  }
  ...
```

**`spawnHostTool()`'s current signature** (`host-tool.mts:2125-2141` — the
ONE spawn call in this module, argv-array form, never a shell string):

```typescript
function spawnHostTool(
  toolPath: string,
  argv: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<HostToolSpawnResult> {
  return new Promise((resolvePromise) => {
    ...
    child = spawn(toolPath, argv, { stdio: ["ignore", "pipe", "pipe"], ...(env ? { env } : {}) });
    ...
```

**Fix shape:** add a `cwd?: string` parameter to `spawnHostTool()`'s
signature (spread into the same options object as `env`: `{ stdio, ...(env ?
{ env } : {}), ...(cwd ? { cwd } : {}) }`), thread it from
`BuildHostToolArgvResult`/`ResolvedAcmeBuildPaths` (or a new field next to
`outputs`) through `runHostTool()`'s `acme.build` dispatch into the call to
`spawnHostTool()`. This is a plain string option-object key, never
concatenated into argv text — matches this file's own stated Command
Injection mitigation.

**Confirmed does NOT touch the frozen spawn-site guard**
(`spawn-seam.test.ts:179`):

```typescript
const EMULATOR_BIN_SHAPE = /\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b/;
```

This regex only matches identifiers naming the VICE emulator binary;
`acmePath` is deliberately outside its shape. A plan task should NOT edit
`spawn-seam.test.ts`'s frozen set for this phase.

---

### `src/mcp/vice/anno-cli.ts` (`export-asm` verb — decide `--out FILE` vs `--out DIR`)

**Analog:** itself, `defaultExportAsmOut()` (`anno-cli.ts:1317-1332`) —
today computes a single-file default destination beside the store:

```typescript
function defaultExportAsmOut(imagePath: string, storeDir: string): string {
  const base = basename(imagePath);
  const ext = extname(base);
  const stem = ext === "" ? base : base.slice(0, -ext.length);
  return join(storeDir, `${stem}.a`);
}
```

Verb usage line today: `export-asm <image> --store FILE [--out FILE]
[--ledger FILE] [--force]` (`anno-cli.ts:249`, `:1339`). Per RESEARCH.md's
Open Question 2, a plan must explicitly decide whether `--out` becomes a
directory (breaking existing single-file callers/tests in
`anno-cli-invocations.test.ts`/`anno-cli.test.ts`) or a new flag is added
instead — not left to fall out of implementation.

---

### `src/mcp/vice/anno-export-asm.test.ts` (new cases — extend, don't invent)

**Analog:** itself, `buildStore()` (`anno-export-asm.test.ts:~214`) and
`buildStoreOverImage()` (`~243`) — the two fixture-construction helpers
every existing exporter test already uses:

```typescript
function buildStore(dir: string, spec: StoreSpec): StoreFixture {
  mkdirSync(dir, { recursive: true });
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([spec.origin & 0xff, (spec.origin >> 8) & 0xff, ...spec.body]));
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    for (const range of spec.ranges) setDataType(handle, range);
    for (const label of spec.labels ?? []) setLabel(handle, { ...label, kind: "User" });
    for (const comment of spec.comments ?? []) setComment(handle, comment);
    for (const projectEnum of spec.enums ?? []) createProjectEnum(handle, projectEnum);
    for (const usage of spec.enumUsage ?? []) applyEnumUsage(handle, usage);
    for (const exclusion of spec.exclusions ?? []) addExcludedRange(handle, exclusion);
  } finally {
    closeStore(handle);
  }
  return { dir, storePath, imagePath };
}

function buildStoreOverImage(tag: string, imagePath: string, spec: Omit<StoreSpec, "origin" | "body">): StoreFixture {
  const dir = freshDir(tag);
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try { /* same per-kind loop as buildStore() */ } finally { closeStore(handle); }
  return { dir, storePath, imagePath };
}
```

**Apply:** BUILD-03's dispatch-table demonstration should use `buildStore()`
over a small hand-picked synthetic body (per RESEARCH.md Pitfall 4's
recommendation (a) or (b)) rather than `fixtures/dxa/tracer.prg`, which this
mapping independently confirmed carries no dispatch table (see Fixture
Verification below). BUILD-02's `!binary` swap demonstration should use
`buildStore()` with a synthetic `external_file`-typed range, OR
`buildStoreOverImage()` against a fresh, THIS-TEST-ONLY store built over
`charset-phantom.prg`'s bytes (never mutating the committed
`charset-phantom.annostore.json`, confirmed below to be typed `"code"`, not
swappable).

---

### `src/mcp/vice/host-tool.test.ts` (new `cwd`-plumbing cases)

**Analog:** itself, the existing in-process call pattern (`~line 452`):

```typescript
const response = await runHostTool(
  { tool: "acme.build", args: { source: "a.a" /* , cwd once added */ } },
  { repoRoot: dir },
);
```

**Apply:** add cases asserting `cwd` is passed through as a spawn option
(never interpolated into generated source text), and that `!source`/
`!binary` resolution actually uses it (a real ACME spawn against a temp
directory tree, matching the byte-diff oracle rule in Don't-Hand-Roll: never
extend `acme-verify.ts`, always call `runHostTool()` in-process).

---

### Determinism / drift guard (new test, modeled on `resources-sync.test.ts`)

**Analog:** `src/mcp/vice/resources-sync.test.ts` — walk, sort, then
byte-diff BOTH directions (fresh-build-vs-committed AND
committed-vs-fresh-build, catching both staleness and orphans):

```typescript
function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${dirent.name}` : dirent.name;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...walk(abs, rel));
    } else if (dirent.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

test("resources/ is byte-identical to a fresh build of its TypeScript source", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "resources-sync-"));
  try {
    build({ outDir: scratchDir });
    const scratchFiles = walk(scratchDir).sort();
    // Direction 1: every scratch file exists at the same relative path,
    // byte-identical, under the committed tree (catches staleness).
    // Direction 2: every already-committed generated file was reproduced
    // by the scratch build (catches an orphan).
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});
```

**Apply to criterion 4's drift guard:** export the SAME store twice into two
scratch directories, sort the file list from each, assert file-for-file
byte-identity and assert the sorted NAME list itself is identical — the
same two-direction discipline (nothing produced that wasn't expected,
nothing expected that wasn't produced), scoped to the export function's own
in-memory scratch output rather than a committed tree (this phase has no
committed multi-file output to compare against, unlike `resources/`).

**`build.ts`'s companion "assert the emitted set is EXACTLY expected" idiom**
(`build.ts:41-50`, `:193-203`) — the sibling half of the same guard family,
useful if the planner wants an explicit expected-file-list assertion for the
root + per-scope filenames instead of only a two-run diff:

```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [ /* ...literal expected relative paths... */ ];
...
const expected = [...HOST_BOUND_ARTIFACTS].sort();
const missing = expected.filter((f) => !emitted.includes(f));
const unexpected = emitted.filter((f) => !expected.includes(f));
if (missing.length > 0 || unexpected.length > 0) {
  throw new Error(
    `...\n  expected:   ${JSON.stringify(expected)}\n  unexpected: ${JSON.stringify(unexpected)}`
  );
}
```

Note: this phase's per-scope filenames are DERIVED from `scope.start` (an
address), not a fixed literal list like `HOST_BOUND_ARTIFACTS` — so this
idiom applies as "compute the expected list from the store's own scopes,
then assert equality," not as a hardcoded array.

## Shared Patterns

### Refuse-by-name, never-quote-content error idiom
**Source:** `src/mcp/vice/anno-export-asm.ts:754-798` (`assertExportableCommentText`, `assertDataTypeForExport`)
**Apply to:** every new refusal this phase adds — unresolved cross-file
symbol reference (BUILD-03), a range crossing a scope boundary (Open
Question 1), any new scope-derived filename validation. Pattern: `throw new
Error(...)`, message anchored to an address/range/count, explicit statement
of why the value itself is not echoed, explicit statement of why guessing
is refused rather than attempted.

### Argv-array spawn, never a shell string
**Source:** `src/mcp/vice/host-tool.mts:2125-2141` (`spawnHostTool`)
**Apply to:** the `cwd` addition — a plain string option-object key passed
alongside `env`, never concatenated into `argv` or interpolated into a
command string.

### Store-fixture construction through public write verbs only
**Source:** `src/mcp/vice/anno-export-asm.test.ts` `buildStore()`/`buildStoreOverImage()`
**Apply to:** every new test case in this phase — never raw SQL against
`anno.sqlite`, always the store's own `setDataType`/`setLabel`/`setComment`/etc.

### Two-direction walk-and-diff for a generated-file-set guard
**Source:** `src/mcp/vice/resources-sync.test.ts`
**Apply to:** the new determinism/drift test for criterion 4 (BUILD-01 determinism).

## No Analog Found

None. Every file this phase touches or adds is either an extension of an
existing file with a clear existing analog inside itself, or a genuinely new
test file whose closest cross-domain analog (`resources-sync.test.ts`) is
extracted above.

## Fixture Verification (independently checked, not merely cited from RESEARCH.md)

- **`fixtures/dxa/tracer.prg` (23 bytes) — CONFIRMED no dispatch table.**
  Read the committed `fixtures/dxa/README.md`'s own byte-layout table and
  the raw bytes (`xxd`): `LDA #$00` / `STA $D020` / `RTS` — three plain
  instructions, no indirect `JMP`, no jump/dispatch table of any kind. Matches
  RESEARCH.md Pitfall 4 exactly. BUILD-03's cross-file dispatch/JSR-JMP
  demonstration must use `buildStore()` over a synthetic body, not this
  fixture.
- **`fixtures/ghidra/charset-phantom.annostore.json`'s `$1000-$17ff` range —
  CONFIRMED typed `"code"`, not swappable.** Parsed the committed JSON
  directly: the `{start: 4096, endInclusive: 6143, ...}` row reads
  `"dataType": "code"`. Matches RESEARCH.md Pitfall 5 exactly. BUILD-02's
  `!binary` swap demonstration must use either a synthetic
  `external_file`-typed range via `buildStore()`, or a fresh, test-local store
  over `charset-phantom.prg`'s own bytes that types that range
  `external_file` for that test's own purposes only — never mutating the
  committed `charset-phantom.annostore.json` (Phase 37/45 tests depend on it
  staying `"code"`).
- Both files are git-tracked (`git ls-files` confirms `fixtures/dxa/tracer.prg`
  and `fixtures/ghidra/charset-phantom.annostore.json` are tracked source,
  not a gitignored mirror).

## Metadata

**Analog search scope:** `src/mcp/vice/` (anno-*.ts, host-tool.mts,
build.ts, resources-sync.test.ts, spawn-seam.test.ts, vice-errors.ts,
fixtures/dxa/, fixtures/ghidra/) — all read directly this session via `Read`
and targeted `grep -a`/`sed -n` (no plain `grep` used against
`src/mcp/vice/` given the known NUL-byte file in that tree).
**Files scanned:** 10 source files, 3 test files, 2 fixture files
**Pattern extraction date:** 2026-09-12
