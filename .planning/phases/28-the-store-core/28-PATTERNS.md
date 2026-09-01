# Phase 28: The Store Core - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 11 (3 new modules + 5 new test files + 1 new sibling script + 2 existing test files extended; plus `package.json` `files[]`)
**Analogs found:** 11 / 11 (10 to replicate, 1 to deliberately diverge from)

All line numbers below were read out of the tree at HEAD during this mapping pass.
Every RESEARCH.md citation checked here **still matches the tree** — see
`## Citation Re-Verification` at the end.

---

## File Classification

Names carry research assumption A1 (`anno-*`); map by **role**, not by name.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `anno-types.ts` (vocabulary, row types, validators, errors) | model / utility (pure data definition) | transform (validate-or-throw) | `anno-confidence.ts` (frozen vocabulary) + `vice.ts:245-290` (error classes) + `stock-address.ts:99-180` (parser) | exact for vocabulary + errors; **diverge** for parser |
| `anno-index.ts` (narrowest-wins paint index) | utility (pure) | transform (rows → Int32Array → O(1) lookup) | `block-class.ts` (pure, no-import, two-arg lookup module) | role-match (both are pure address→class lookups) |
| `anno-store.ts` (the ONLY `node:sqlite` importer) | service / persistence | CRUD + file-I/O | `hostpath.ts` (a confined single-seam module) header-wise; `prg-image.ts` / `acme-gate.ts` for the header convention | role-match; **no existing persistence analog in the tree** |
| `anno-types.test.ts` | test (unit) | transform | `block-class.test.ts` (vocabulary + structural assertions in one file) | exact |
| `anno-index.test.ts` | test (unit, cross-validation oracle) | transform | `block-class.test.ts` §1 (inclusive-end pins at `:48-50`) | role-match |
| `anno-store.test.ts` | test (unit + structural) | CRUD + file-I/O | `build-atomic.test.ts` (`mkdtempSync` + `finally` cleanup) | role-match |
| `anno-durability.test.ts` | test (integration, `SIGKILL`) | file-I/O + process spawn | `build-atomic.test.ts:153-158` (spawn a sibling script with `process.execPath`) + `broker-kill.test.ts:77-86` (`process.kill(pid,"SIGKILL")` in a `try`/ignore) | partial — **no existing test SIGKILLs a self-killing child**; composite analog |
| sibling mutator script (spawned + self-`SIGKILL`ed) | script (test helper) | file-I/O | `build.ts` invoked as a child by `build-atomic.test.ts:153`; `acme-gate.ts` for the "test-only, never in `files[]`" header clause | role-match |
| `anno-seam.test.ts` | test (structural) | transform | `hostpath-consumers.test.ts:130-150, 220-260` **plus** `spawn-seam.test.ts:53, 183` for the scanned set | exact (this is the direct template) |
| `block-class.test.ts` (extend) | test (unit) | transform | itself — `:26-50` and `:218-230` | exact |
| `anno-coverage.test.ts` (extend) | test (unit) | transform | itself — `:614-620` | exact |
| `block-class.ts` (modify 2 literals + header) | utility (pure) | transform | itself — `:126-137`, header `:32-35` | exact |
| `package.json` `files[]` (add 3 entries) | config | — | the `block-class.ts` / `prg-image.ts` entries at the tail of the array | exact |

---

## Pattern Assignments

### `anno-types.ts` — the frozen vocabulary (model, transform)

**Analog:** `src/mcp/vice/anno-confidence.ts:81-112` — **pattern to replicate**

Read at `:81-112`. The house shape for a frozen, single-home vocabulary is a
`readonly` array of records with `as const`, plus derived `.map()` projections
rather than second hand-written lists:

```typescript
export const CONFIDENCE_GRADES: readonly ConfidenceGrade[] = [
  { token: "confirmed-code", bracket: "[confirmed-code]", phrase: "confirmed code",
    meaning: "Executed during tracing, PC observed inside it" },
  ...
] as const;

/** Every valid bracket token, e.g. `["[confirmed-code]", ..., "[unknown]"]`. */
const VALID_BRACKETS: readonly string[] = CONFIDENCE_GRADES.map((g) => g.bracket);
```

Note the doc-comment sentence at `:78-79` — *"This is the ONE place the vocabulary is
written down -- see the module header's 'what NOT to do' list."* Copy that sentence
form for `DATA_TYPES`.

**Derived-projection rule to copy:** `SPLIT_TYPES` must be
`DATA_TYPES.filter(...)`, exactly as `VALID_BRACKETS` is a `.map()` — never a second
literal array. RESEARCH.md's Pattern 1 prescribes the same.

**Do NOT copy `AnnoConfidenceGradeError`'s base class.** Read at
`anno-confidence.ts:139`:

```typescript
export class AnnoConfidenceGradeError extends Error {
```

It extends `Error`, **not** `ViceError`. RESEARCH.md flags this as an asymmetry the
store must either wrap or state. The new errors follow `vice.ts` below instead.

---

### `anno-types.ts` — the error family (model)

**Analog:** `src/mcp/vice/vice.ts:245-290` + `src/mcp/vice/stock-address.ts:82-87` — **pattern to replicate**

Base, read at `vice.ts:245-259`:

```typescript
export interface ViceErrorOptions {
  code?: number | string;
  data?: unknown;
}

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

Field-carrying subclass, read at `vice.ts:281-290`:

```typescript
export class MachineRestartedError extends ViceError {
  baselineEpoch?: number | null;
  currentEpoch?: number | null;
  where?: string;
  lastToolCall?: string | null;

  constructor(message: string, { baselineEpoch, currentEpoch, where, lastToolCall }: MachineRestartedErrorOptions = {}) {
    super(message);
    this.name = "MachineRestartedError";
    this.baselineEpoch = baselineEpoch;
    ...
  }
}
```

Note: `super(message)` **without** forwarding options — `code`/`data` stay
`undefined`. Copy that.

Field-free subclass (the shorter variant, which **does** forward), read at
`stock-address.ts:82-87`:

```typescript
export class StockAddressError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockAddressError";
  }
}
```

Use this second form for the family base (`AnnoStoreError`) and the first form for
every error carrying evidence (`AnnoStoreCorruptError{path}`,
`AnnoStoreStaleRevisionError{baseRevision,currentRevision}`, `AnnoTypeError`,
`AnnoAddressError`, `AnnoLabelError`, `AnnoRangeShapeError`).

**Import specifier** (established at `stock-address.ts:35`, read verbatim):

```typescript
import { ViceError, type ViceErrorOptions } from "./vice.ts";
```

`vice.ts`'s own imports, read at `:14-18`, are `node:path`, `node:fs`,
`./repo-root.ts`, `./container-guard.mts` — so importing `ViceError` pulls in **no**
transport machinery and **no** `hostpath.ts`. Safe, as RESEARCH.md states.

**Also copy the message convention** — every refusal embeds the offending value and
the valid range. From `stock-address.ts:132-134`:

```typescript
throw new StockAddressError(`${what}: "${trimmed}" is not a valid "$hex" address -- expected "$" followed by hex digits, e.g. "$D019"`);
```

---

### `anno-types.ts` — address/argument parsing (transform)

**Analog:** `src/mcp/vice/stock-address.ts:99-180` — ⚠️ **pattern to DELIBERATELY DIVERGE FROM** (research finding C-4)

Two independent reasons, both re-read this pass:

**(1) It accepts a bare decimal string.** Read at `stock-address.ts:155-161`:

```typescript
  if (/^[0-9]+$/.test(trimmed)) {
    const value = parseInt(trimmed, 10);
    if (!inAddressRange(value)) {
      throw new StockAddressError(`${what}: "${trimmed}" is out of range -- expected a decimal integer 0..65535`);
    }
    return value;
  }
```

and its own doc comment says so, read at `:100-105`:

> `` * `number` in range; a `"$hex"` string (leading `$`, hex digits, ``
> `` * case-insensitive); a `"0x"`/`"0X"` string; or a bare decimal string ``
> `` * (`"4096"`) -- decimal here, deliberately, since this is the MCP argument ``
> `` * surface, not VICE's own condition lexer where bare literals are hex. ``

The store must **refuse** that form. Record the divergence and its reason in the new
module's header: *a mis-based address written into the store is persistent and
silently wrong; a mis-based read is transient.*

**(2) Module-level mutable resolver state.** Read at `stock-address.ts:44-54`:

```typescript
// The ONE module-level holder for the installed resolver. `null` in Phase 3
// -- no symbol resolution happens until a later phase installs one.
let symbolResolver: SymbolResolver | null = null;

export function setSymbolResolver(resolver: SymbolResolver | null): void {
  symbolResolver = resolver;
}
```

`anno-types.ts` must hold **no** module-level mutable state (and
`block-class.test.ts:194-212`'s idiom is the way to assert that — see below).

**What to replicate from it:** the shape only — `inAddressRange()` at `:95-97`, the
per-form branch ladder, the `opts: { what?: string }` parameter threading the caller's
field name into every message, and the ordering rule at `:89-92` (*"checked only after
every numeric form below has already failed to match, so a malformed numeric string
(e.g. `0xzz`) is refused as malformed, never misread as a candidate symbol"*).

**Mnemonic denylist source** — read at `disasm-opcodes.ts:183-186, 207-211`:

```typescript
export interface OpcodeEntry {
  /** Lowercase three-letter canonical 6502/6510 mnemonic (ACME source is
   * lowercase, and the renderer (04-04) emits this verbatim). */
  mnemonic: string;
  mode: AddressingMode;
  length: 1 | 2 | 3;
  /** `true` for every opcode outside the documented NMOS 6502 set. */
  illegal: boolean;
  ...
}

export const OPCODES: readonly OpcodeEntry[] = [
  { mnemonic: "brk", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $00
  { mnemonic: "ora", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $01
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: true }, // $02
  { mnemonic: "slo", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $03
```

Confirmed: no `access`/`reads`/`writes` field exists (C-5's "the mnemonic→access map is
new code" holds). Denylist = `new Set(OPCODES.map((o) => o.mnemonic))`, compared
case-insensitively; `jam`/`slo` are present, so the derived set is strictly wider than
any hand-typed 56-name list.

---

### `anno-index.ts` — the pure narrowest-wins index (utility, transform)

**Analog:** `src/mcp/vice/block-class.ts` — **pattern to replicate** (structurally), with its capitalisation defect avoided

Read `:1-60` (header) and `:126-137` (body). Three things to copy:

**(a) The "ONE place / WHY THIS FILE EXISTS / WHAT NOT TO DO" header**, `:1-60`. Note
the numbered, individually-justified trap list at `:38-60` — traps 1–4 each name a
specific failure mode, not a style preference. `anno-index.ts`'s equivalent traps are
RESEARCH.md's: never put narrowest-wins behind the write path (kills the tie-break
pin), never cache the index on disk, never add an adjacency/coalescing pass.

**(b) Purity, asserted not promised.** `block-class.ts:53-56` (trap 3):

```
//   3. NEVER hold module-level mutable state. The lookup is a pure function
//      of its two arguments, so interleaved or repeated calls cannot observe
//      each other. There is nothing to reset and nothing to synchronise.
```

**(c) The inclusive-both-ends comparison**, `:130-131`:

```typescript
    if (address >= block.start_address && address <= block.end_address) {
```

RESEARCH.md Pattern 3 (`endInclusive`, never a bare `end`) is a **divergence in
naming only** — `block-class.ts`'s `BlockEntry` carries inclusivity in prose under the
name `end_address`; the new rows carry it in the identifier.

---

### `block-class.ts` — the two-literal fix (modify)

**Analog:** itself — **pattern to modify, with the header rationale replaced**

Defect confirmed at `:130-134`:

```typescript
    if (address >= block.start_address && address <= block.end_address) {
      if (block.type === "Code") return "code";
      if (block.type === "Undefined") return "undefined";
      return "data";
    }
```

The header rationale that becomes false, read at `:32-35`:

```
// The neutral classes are LOWERCASE on purpose. The store's vocabulary is
// capitalised, so a comparison site left behind somewhere else cannot
// accidentally still agree -- it gets a different answer and moves a
// measured number, loudly.
```

**Hard constraint reconfirmed** — `block-class.test.ts:187-192` asserts the import
list is **empty**:

```typescript
  assert.deepEqual(
    specifiers,
    [],
    "block-class.ts must import NOTHING -- giving the classifier the census, the bytes, a decoder or a grade " +
      "collapses the bytes-versus-store independence axis while the independence test keeps passing",
  );
```

plus `:181-185`, which separately forbids a dynamic `import(`. So the cross-check must
live in the **test**.

---

### `block-class.test.ts` (extend) — the total derived cross-check

**Analog:** itself, `:31-38` and `:194-212` — **pattern to replicate, with one clause consciously overridden**

The current hard-coded constants, read at `:31-38`:

```typescript
/** The store spellings the production mapping recognises by name, plus one it
 * deliberately does not. Written out here rather than imported so a silent
 * change to the mapping cannot silently change its own test. */
const STORE_CODE = "Code";
const STORE_UNDEFINED = "Undefined";
const STORE_OTHER = "Byte";
```

The new total cross-check **must** import `DATA_TYPES` (that is the point: total over
twelve, derived), which contradicts the "written out here rather than imported"
rationale for those three constants. **Keep both:** leave the hand-written constants
driving the existing spot-check tests (updated to the new spellings), and add the
derived total loop as a *separate* test with its own comment explaining why the
derived form is the stronger guard here. Record the reversal rather than silently
deleting the old rationale.

Its `files[]` assertion idiom, read at `:218-230`, is the template for the three new
`files[]` assertions:

```typescript
test("block-class.ts IS present in package.json's files[] array", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(pkg.files.includes("block-class.ts"), true, "...");
});
```

And the no-module-level-mutable-state scan, read at `:194-212` — reuse verbatim for
`anno-index.ts` and `anno-types.ts`:

```typescript
  const source = codeOnly(readFileSync(join(HERE, "block-class.ts"), "utf8"));
  const offenders = source
    .split("\n")
    .filter(
      (line) =>
        /^\s*(let|var)\s/.test(line) ||
        /^\s*const\s+\w+\s*(:[^=]*)?=\s*(new\s+(Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line),
    );
  assert.deepEqual(offenders, [], "...");
```

Note the comment at `:196-201`: a `let`-only grep already let a real offender through
(WR-04) — do not weaken it back.

---

### `anno-coverage.test.ts` (extend) — the label-kind agreement

**Analog:** `anno-coverage.test.ts:614-620` — **pattern to replicate and widen**

Read verbatim; this is the test RESEARCH.md says covers **blocks only**:

```typescript
test("independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report", () => {
  const before = reportFor(WELL_DOCUMENTED);
  const oneType: BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];
  const after = reportFor(WELL_DOCUMENTED, { blocks: oneType });
```

The four uncovered label-kind sites, all re-read and **all still at the cited lines**:

```
1430:    if (kind === "System" || kind === "Platform") {
1432:    } else if (kind === "User") {
1869:    if (s && typeof s.name === "string" && String(s.kind ?? "") === "User") nameByAddress.set(s.address, s.name);
2180:    if (sym && String(sym.kind ?? "") === "User") seeds.add(sym.address);
```

The new test mirrors `:614`'s shape but rewrites **symbol `kind`** rather than block
`type`, and asserts a lowercase `"user"` drives `nameByAddress`/`seeds` to empty —
i.e. it makes the silent-zero failure loud. (Per RESEARCH.md Open Question 1, the
recommended disposition is: the store emits `"User"`/`"Auto"`/`"System"` verbatim, and
this test pins the agreement.)

---

### `anno-store.ts` — the `node:sqlite` seam (service, CRUD + file-I/O)

**Analog:** `src/mcp/vice/prg-image.ts:1-46` and `src/mcp/vice/acme-gate.ts:1-42` — **header convention to replicate**. **No behavioural analog exists** — this is the tree's first persistence module, so the implementation shape comes from RESEARCH.md `## Code Examples`, not from an existing file.

`prg-image.ts:1-8` — the opening "the ONE authoritative place" sentence:

```typescript
#!/usr/bin/env node
// prg-image.ts -- the ONE authoritative place in this repo holding pure C64
// image byte-layout knowledge: how a `.prg` splits into a load address plus a
// body, ...
```

`prg-image.ts:30-36` — the `files[]` clause a new shipped module carries, verbatim
shape to copy:

```typescript
// THIS MODULE MUST BE LISTED IN `package.json`'s `files[]`. It is reachable
// from the published entry point's import closure -- ...
// `scripts/check-npm-packages.mjs` walks that closure over `files[]` and fails
// the pack the moment a reachable module sits outside the listed set, ...
```

⚠️ **Adapt, do not copy, that reason.** The new modules are **not yet reachable** from
`vice-proxy.ts` in Phase 28 (P-9). The honest reason to list them is: `STORE-07`'s
assertion scans `shippedTsModules()`, and an unlisted module makes it vacuous. Copying
prg-image's reachability sentence would put a false claim in a seam header — exactly
what `block-class.ts`'s stale rationale demonstrates.

`prg-image.ts:38-46` — the "no path parameter / no hostpath import" clause, directly
reusable for the store's *inverse* (the store **does** take a path, so its clause is
"confine it to the workspace, and never route it through `hostpath.ts`"):

```typescript
// WHAT NOT TO DO:
//   - Never give any function here a filesystem PATH parameter. ... For the
//     same reason this module imports nothing from either of this repo's two
//     host/container path-translation seams; that absence is asserted
//     structurally by `hostpath-consumers.test.ts`, not merely stated here.
```

`acme-gate.ts:31-42` — the **inverse** clause, and the template for the new sibling
mutator script (test-only, must *not* be in `files[]`, and must not match the
`*.test.*` glob):

```typescript
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only helper has no business in the published npm tarball), and it
// must never be imported by a production module -- only by `*.test.ts` files.
// `acme-gate.test.ts` asserts the `files[]` absence mechanically, on every
// suite run.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file, and must never be collected
// as one.
```

The mutator script is *spawned*, not imported, so both clauses apply to it and the
second one is load-bearing: name it e.g. `anno-durability-mutator.mjs`, never
`*.test.*`.

**Header pitfall carried from RESEARCH.md P-1/P-2, and it applies to every one of
these headers:** cite requirement ids (`MCP-01`), never `Phase 29` in an assignment
shape, and never a phase number in a shipped string literal.

---

### `anno-seam.test.ts` — the structural single-seam assertion (test, structural)

**Analog:** `src/mcp/vice/hostpath-consumers.test.ts` — **pattern to replicate, widened**; scanned set from `spawn-seam.test.ts`; enumerator/stripper from `shipped-modules.ts`

**The non-vacuity pairing**, read at `hostpath-consumers.test.ts:143-150`:

```typescript
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];

test("hostpath.ts's production consumer set is exactly the five declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 5);
});
```

**The single shared predicate** — the 11-01 discipline, read at `:64-70`:

```typescript
/** True iff the (already comment-stripped) source imports hostpath.ts,
 * statically or dynamically. Extracted into ONE named predicate -- both the
 * real consumer-set scan below and the planted-violation tests call this
 * same function, so there is exactly one definition of "counts as an
 * import" ... */
function importsHostpath(strippedSrc: string): boolean {
  return HOSTPATH_IMPORT_RE.test(strippedSrc) || HOSTPATH_DYNAMIC_IMPORT_RE.test(strippedSrc);
}
```

Copy this exactly: one `namesNodeSqlite(strippedSrc)` predicate, called by both the
real scan and all four plantings.

**The two regexes to NOT copy**, read at `:50` and `:60`:

```typescript
const HOSTPATH_IMPORT_RE = /^\s*import\s[^;]*from\s+"\.\/hostpath\.(ts|mts|mjs)"/m;
const HOSTPATH_DYNAMIC_IMPORT_RE = /import\s*\(\s*["'][^"']*\/hostpath\.(ts|mts|mjs)["']\s*\)/;
```

⚠️ **Diverge:** these two cover static + dynamic import only, and `node:sqlite` has
four routes. Use the single substring test over `codeOnly(src, true)` instead. Keep
the doc-comment *density* of `:34-49` and `:52-59` though — each regex there explains
the specific self-invalidation it avoids, naming real files that mention the forbidden
string in comments. Do the same for the new detector.

**The planted-violation block**, read at `:220-262` — the direct template for the four
plantings. Its three-shape test at `:231-262` already labels its cases `(a)` multi-line
static, `(b)` dynamic, `(c)` control-only-in-comment-and-string-literal:

```typescript
  const multiLineStaticImport = ["import {", '  hostPath,', ... '} from "./hostpath.ts";', ...].join("\n");
  const dynamicImport = 'export async function useIt() {\n  const { hostPath } = await import("./hostpath.ts");\n  return hostPath;\n}\n';
  const commentAndStringLiteralOnly = [
    "// MUST NOT import hostpath.ts -- this module runs container-side.",
    "export const EXAMPLE_IMPORT_TEXT = 'import { hostPath } from \"./hostpath.ts\";';",
    ...
  ].join("\n");
```

⚠️ **The `(c)` control is where the new test must diverge and say so.** That control
relies on a comment-only stripper blanking a string literal; the `node:sqlite`
detector deliberately **keeps** literal bodies (`keepLiteralBodies = true`), so a bare
`"node:sqlite"` string literal is indistinguishable from a `getBuiltinModule`
argument. RESEARCH.md names this as a genuine design decision: either a wider detector
with a weaker control (drop the string-literal half, keep the comment half) or a
narrower access-position detector with the full control. **The plan must state which**
— the hostpath guard records having made the opposite trade, and this one must record
its own.

**Scanned set** — from `spawn-seam.test.ts:53, 178-187` (read verbatim):

```typescript
import { codeOnly, shippedTsModules } from "./shipped-modules.ts";
...
  for (const file of shippedTsModules()) {
    const rawSrc = readFileSync(join(HERE, file), "utf8");
```

Use `shippedTsModules()`, **not** `hostpath-consumers.test.ts:124-127`'s local
`readdirSync` — `STORE-07` says "over the shipped module set". `shippedTsModules()`
read at `shipped-modules.ts:151-162`:

```typescript
export function shippedTsModules(dir: string = HERE): string[] {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    if (!existsSync(join(dir, entry))) {
      throw new ShippedFilesEntryMissingError(
        `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
      );
    }
  }
  return entries;
}
```

**The stripper's `keepLiteralBodies` mode**, read at `shipped-modules.ts:198-205` —
its doc comment names this exact caller shape:

```
 * `keepLiteralBodies` exists for the one caller shape that needs the opposite:
 * an import-specifier assertion, where the thing being read IS a string, so
 * blanking literal bodies would make it unobservable. Default `false` keeps
 * the strict behaviour, so a module name appearing in a comment or a message
 * string still cannot satisfy a code check.
```

**Also plant `enableLoadExtension` / `loadExtension` / `allowExtension` absence** over
`anno-store.ts` in this same file (security section of RESEARCH.md) — same predicate
idiom, `codeOnly()` in **strict** mode there, since those are code identifiers, not
specifiers.

---

### `anno-durability.test.ts` + sibling mutator (test, integration, process spawn)

**Analog (composite, both patterns to replicate):**

**(a) Spawning a sibling script with `process.execPath`** — `build-atomic.test.ts:153-158`:

```typescript
            const child = spawn(process.execPath, [buildScript, "--out-dir", sharedDir], {
              cwd: HERE,
              stdio: "ignore",
            });
            return new Promise<number | null>((resolve) => {
              child.on("exit", (code) => resolve(code));
```

⚠️ **Diverge on `stdio`:** use `"pipe"`, never `"ignore"` and never `"inherit"` — the
child's `node:sqlite` `ExperimentalWarning` must not reach the parent's TAP stream
(P-4). RESEARCH.md's example uses `execFileSync(..., { stdio: "pipe" })` wrapped in a
`try {} catch {}` because status 137 is the expected outcome.

**(b) `SIGKILL` inside a swallow-everything `try`** — `broker-kill.test.ts:77-86`:

```typescript
function killIfAlive(pid: number | undefined): void {
  if (typeof pid !== "number") return;
  if (isAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}
```

And the "kill in `finally`, then `rmSync`" cleanup shape at `broker-kill.test.ts:548-553`:

```typescript
    } finally {
      if (handle.child.exitCode === null && handle.child.signalCode === null) {
        handle.child.kill("SIGKILL");
      }
      rmSync(stateDir, { recursive: true, force: true });
    }
```

⚠️ **The genuinely new shape:** no existing test has a child that `SIGKILL`s *itself*
mid-transaction. That is the mutator script's whole job
(`process.kill(process.pid, "SIGKILL")` after the insert, before/instead of the
`COMMIT` in the planted configuration). No analog — take it from RESEARCH.md's
prototype.

**(c) Temp-dir hygiene (P-7)** — `build-atomic.test.ts:47-48, 102-104`:

```typescript
    const target = mkdtempSync(join(tmpdir(), "build-atomic-inode-"));
    try {
```

Copy the `mkdtempSync(join(tmpdir(), "<prefix>-"))` + `try`/`finally rmSync` pairing
unconditionally. The parent must clean up, because on the `SIGKILL` path the child
cannot.

---

### Planted-violation fixture files (if the planner chooses fixture-driven plantings)

**Analog:** `src/mcp/vice/fixtures/planted-phase-pointer-fixture.ts.txt` + its consumer `comment-phase-pointers.test.ts:498-528` — **pattern to replicate**

Existing fixtures on disk (read via `ls fixtures/`):
`planted-phase-pointer-fixture.ts.txt`, `planted-hop-chain-fixture.ts.txt`,
`planted-disposition-fixture.md`, `planted-review-fixture.md`.

The consumer idiom, read at `comment-phase-pointers.test.ts:498-528`:

```typescript
// Fixture-driven tests: every planted violation shape and every negative
// control from fixtures/planted-phase-pointer-fixture.ts.txt is asserted
// individually. The fixture's own `[bracket-label]` prefixes are parsed
// here rather than duplicated as a second hand-written expectation list --
// one file, read two ways ... so the fixture and its expectations cannot
// drift apart silently.

const FIXTURE_PATH = join(HERE, "fixtures", "planted-phase-pointer-fixture.ts.txt");

function readFixture(): string {
  assert.ok(existsSync(FIXTURE_PATH), `${FIXTURE_PATH} is missing -- the planted-violation fixture must be committed`);
  return readFileSync(FIXTURE_PATH, "utf8");
}
```

Note the `.ts.txt` double extension — it keeps the fixture out of the typecheck and
out of the `*.test.*` glob. **Two viable routes for Phase 28's four plantings:** the
`.ts.txt` fixture route above, or `hostpath-consumers.test.ts:231-262`'s inline
template-string route. The inline route is the closer match (four small synthetic
sources, all about one specifier) and is what RESEARCH.md's example uses; the fixture
route wins if a planting needs to be a whole plausible module. **Pick one and say
why.**

---

### `package.json` `files[]` (config)

**Analog:** the array's own tail — **pattern to replicate**

Read from `src/mcp/vice/package.json`, the tail of `files[]`:

```json
    "anno-memmap-render.ts",
    "anno-coverage.ts",
    "block-class.ts",
    "prg-image.ts",
    "resources",
    "tools-manifest.json",
    "tools-manifest.stock.json",
    "README.md",
    "THIRD-PARTY-NOTICES.md"
```

Non-`anno-` modules go **after** the `anno-*` run and **before** `"resources"`, in
the position `block-class.ts` and `prg-image.ts` occupy. The three new entries join
there. `acme-gate.ts` is deliberately absent — the mutator script must be too.

**Precondition confirmed:** `module-classification.test.ts:73-78` (read verbatim)
enumerates only `startsWith("anno-")`, so `anno-*` needs **no** classification entry:

```typescript
function inEnumerationOnDisk(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => name.startsWith("anno-"))
    .filter((name) => /\.(ts|json)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name))
    .sort();
}
```

---

## Shared Patterns

### The module header

**Source:** `prg-image.ts:1-46`, `acme-gate.ts:1-42`, `block-class.ts:1-60`
**Apply to:** all three new production modules **and** the mutator script

Structure, in order: `#!/usr/bin/env node` shebang · `// <filename>.ts -- the ONE …`
one-liner · `WHY THIS FILE EXISTS` (name the concrete incident or defect motivating
it) · what it is the one authoritative place for · `WHAT NOT TO DO`, as a numbered
list where each entry names a specific past mistake or measured failure mode · the
`files[]` status and its reason.

Two committed guards constrain the prose (both re-read this pass): no `Phase N` in an
assignment shape (`comment-phase-pointers.test.ts`), no phase number in any shipped
string literal (`docs-dangling-refs.test.ts`). Cite requirement ids.

### Named-error refusals

**Source:** `vice.ts:245-290`, `stock-address.ts:82-87`
**Apply to:** `anno-types.ts` (definitions), `anno-store.ts` + `anno-index.ts` (throws)

`interface XErrorOptions` → `class XError extends ViceError` → plain public fields →
`super(message)` → `this.name = "XError"` → assign. Message embeds the offending value
**and** the valid range.

### Structural self-assertion in the colocated test

**Source:** `block-class.test.ts:176-212, 218-230`; `hostpath-consumers.test.ts:64-70, 143-150`
**Apply to:** all five new test files

Every claim a module header makes about *itself* (empty imports, no mutable state, no
`node:sqlite`, in/out of `files[]`, no dynamic `import(`) is asserted from the
module's own source via `codeOnly()` — never merely stated in prose. Every structural
assertion is paired with a non-vacuity check (`deepEqual` + `length`, or
`assert.ok(set.length > 0)` as at `hostpath-consumers.test.ts:214`) and with at least
one planted violation exercising the **same named predicate** the real scan uses.

### Test temp-dir and child-process hygiene

**Source:** `build-atomic.test.ts:47-48, 153-158`; `broker-kill.test.ts:77-86, 548-553`
**Apply to:** `anno-store.test.ts`, `anno-durability.test.ts`

`mkdtempSync(join(tmpdir(), "anno-"))` + unconditional `finally rmSync(…, {recursive:
true, force: true})`; `stdio: "pipe"` on every spawn; `process.kill` wrapped in a
swallowing `try`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `anno-store.ts` — the SQL body (DDL, revision CAS, `vacuum into`, split-and-preserve, corrupt-file refusal) | service | CRUD + file-I/O | **The tree contains no database code at all.** `grep`-confirmed: `node:sqlite` appears nowhere. The header convention has strong analogs (above); the *implementation* has none, so the planner must use RESEARCH.md `## Code Examples` (openStore / applyWrite / retype) as the source, all three of which were executed on this host |
| the self-`SIGKILL`ing mutator script | script | file-I/O | Every existing `SIGKILL` in the tree is a *parent killing a child*. No existing child kills itself mid-write. Composite analog only (`build-atomic.test.ts` for the spawn, `broker-kill.test.ts` for the signal); the self-kill line comes from RESEARCH.md's prototype |
| the mnemonic→access-kind map (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`) | utility | transform | Confirmed by reading `disasm-opcodes.ts:183-201`: `OpcodeEntry` has `mnemonic`, `mode`, `length`, `illegal`, `acmeExpressible` and **no access field**. The vocabulary is `[CITED]` from Ghidra via project research notes, not read from any code here (A5/A7). New code, no analog |

---

## Citation Re-Verification

Every RESEARCH.md line citation touched by this pass was re-read. **No drift found.**

| Citation | Status |
|---|---|
| `vice.ts:245-259` (`ViceError`), `:281-290` (`MachineRestartedError`), `:14-18` (imports) | ✅ exact |
| `block-class.ts:32-35` (lowercase rationale), `:126-137` (`blockClassAt`), `:41-52` (traps 1–2) | ✅ exact — the capitalised-literal defect at `:130-131` is real and present |
| `block-class.test.ts:34` (`STORE_CODE = "Code"`), `:186-191` (empty-import `deepEqual`) | ✅ exact (the `deepEqual` call spans `:187-192`; the assertion is at `:186-192`) |
| `anno-coverage.ts:1430, 1432, 1869, 2180` (label-kind literals) | ✅ all four exact |
| `anno-coverage.test.ts:616` (`oneType` block rewrite) | ✅ exact |
| `anno-confidence.ts:81-114` (`CONFIDENCE_GRADES`), `:139` (`extends Error`, not `ViceError`) | ✅ exact |
| `shipped-modules.ts:151-162` (`shippedTsModules`), `:198-205` (`keepLiteralBodies` doc) | ✅ exact |
| `hostpath-consumers.test.ts:50, 60` (the two regexes), `:124-127` (local enumerator), `:143-150` (the pairing), `:220-260` (plantings) | ✅ exact |
| `spawn-seam.test.ts:53, 183` (`shippedTsModules()` scan) | ✅ exact |
| `stock-address.ts:35` (import specifier), `:52-76` (module-level resolver state), `:82-87` (`StockAddressError`), `:100-105` (doc), `:155-160` (bare-decimal branch) | ✅ exact — C-4's divergence is fully justified by the tree |
| `disasm-opcodes.ts:183-201` (`OpcodeEntry`, no access field), `:207-215` (`OPCODES`) | ✅ exact |
| `module-classification.test.ts:72-78` (`startsWith("anno-")`) | ✅ exact (`:73-78`) |
| `package.json` `files[]` includes `block-class.ts` + `prg-image.ts`, excludes `acme-gate.ts` | ✅ exact |

---

## Metadata

**Analog search scope:** `src/mcp/vice/` (all `*.ts`, `*.mts`, `*.test.ts`,
`fixtures/`, `package.json`), `scripts/`
**Files opened this pass:** 16 (`vice.ts`, `block-class.ts`, `block-class.test.ts`,
`anno-coverage.ts`, `anno-coverage.test.ts`, `anno-confidence.ts`,
`shipped-modules.ts`, `hostpath-consumers.test.ts`, `spawn-seam.test.ts`,
`comment-phase-pointers.test.ts`, `stock-address.ts`, `disasm-opcodes.ts`,
`prg-image.ts`, `acme-gate.ts`, `module-classification.test.ts`, `package.json`) plus
targeted greps over `build-atomic.test.ts`, `broker-kill.test.ts`, `repo-root.test.ts`,
`fixtures/`
**Pattern extraction date:** 2026-08-27
