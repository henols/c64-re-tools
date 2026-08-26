# Phase 27: Shared Seams Extracted - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 11 new (7 modules + 4 tests) + 24 modified
**Analogs found:** 11 / 11 (every new file has an in-repo analog; this phase is pure extraction)

All paths below are relative to `src/mcp/vice/` unless stated. Line numbers checked
against the tree at `1785165`, and cross-checked against RESEARCH.md's
`## Corrections` (C-1..C-6) — **RESEARCH.md wins over CONTEXT.md on every fact**.

Names resolved by RESEARCH.md `## Discretion Resolutions`:
- adapter → **`block-class.ts`** (exported `blockClassAt()`, moved type renamed `BlockEntry`)
- registry → **`module-classification.ts`** (must NOT be `r2000-classification.ts`: it would
  match its own enumerating glob; must NOT be `capability-registry.*`: taken)
- shared test helper → **not resolved by RESEARCH.md**. Constraint set is fixed:
  a plain `.ts` (never `*.test.*`), out of `files[]`, name free in the directory.
  `shipped-modules.ts` is free (`ls | grep -iE "block|annotation|prg|acme|registry|shipped"`
  returned only `capability-registry*`, `r2000-acme-ident.ts`, `skill-acme-build-cli.test.ts`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `acme-gate.ts` (new) | test-harness seam (not in `files[]`) | process-probe / module-load const | `r2000-test-gate.ts` (the module it moves out of) | exact (it *is* the source) |
| `acme-gate.test.ts` (new) | test | child-process spawn + structural guard | `r2000-launch.test.ts:497-512` (child spawn) + `r2000-verify.test.ts:187-194` (`files[]` absence) | exact, two analogs |
| `block-class.ts` (new) | adapter / vocabulary translator (store side only) | transform (pure) | `stock-condition.ts` (single-emitter seam header + "no other module may construct") ; body from `r2000-coverage.ts:1662-1690` | role-match + source |
| `block-class.test.ts` (new, optional) | test | pure unit | `stock-condition.test.ts` | role-match |
| `prg-image.ts` (new, **in `files[]`**) | shipped utility, byte-format parser | file-I/O transform (pure bytes) | `r2000-d64.ts` (shipped pure C64-format module) ; body from `r2000-project.ts:171-204` | exact |
| `prg-image.test.ts` (new) | test | pure unit | `r2000-project.test.ts:110-128` (the four tests that move) | exact (tests relocate) |
| `module-classification.ts` (new) | typed-const data registry | static data lookup | `capability-registry.ts` (typed const + interface + long header) ; `fork-deleted-tools.ts` (minimal typed const) | exact |
| `module-classification.test.ts` (new) | structural guard test | disk enumeration + relation assertions | `hostpath-consumers.test.ts:175-232` (disk glob + floor + planted violation) ; `capability-registry.test.ts:119` (mechanical completeness) | exact, two analogs |
| `shipped-modules.ts` (new) | test-only shared helper | `files[]` → module list | `r2000-test-gate.ts` (non-`*.test.*` helper imported by tests) ; body verbatim from `docs-dangling-refs.test.ts:353-362` | exact |
| `r2000-test-gate.ts` (mod: remove ACME half `:97-166`) | seam | — | itself | — |
| 4 ACME importers (`disasm-roundtrip.test.ts:57`, `skill-acme-build-cli.test.ts:47`, `r2000-cli.test.ts:22-28`, `r2000-answer-key.test.ts:227-231`) | test | — | `r2000-spawn-seam.test.ts:50-53` (two sibling-module imports, side by side) | exact — this is the target *shape* |
| `r2000-coverage.ts` (mod: 3 sites → adapter; header `:61-66` corrected) | service (census) | transform | itself | — |
| `r2000-coverage.test.ts` (mod: + substitutability test) | test | fixture-substitution | `r2000-coverage.test.ts:604-623` (the independence test, incl. non-vacuity half) | exact |
| `r2000-project.ts`, `r2000-cli.ts:56,75`, 6 more importers (mod: **split**, not rewrite) | mixed | — | `r2000-spawn-seam.test.ts:50-53` | exact |
| 4 × `shippedTsModules()` copies (`docs-dangling-refs.test.ts:353`, `r2000-spawn-seam.test.ts:176`, `stock-dispatch.test.ts:2902`, `comment-phase-pointers.test.ts:400`) | test | — | `r2000-spawn-seam.test.ts:53` (importing a neutral non-test helper) | exact |
| `comment-phase-pointers.test.ts:53-59` **and** `hop-chain-comments.test.ts:46-50` (mod: comment) | test comment | — | each other (C-4: both must be rewritten) | exact |
| `package.json` `files[]` (mod: + `prg-image.ts` only) | config | — | existing `r2000-d64.ts` entry | exact |

## Pattern Assignments

### `acme-gate.ts` (test-harness seam, not shipped)

**Analog:** `r2000-test-gate.ts` — the module the five symbols move out of.

**Header pattern to reproduce** (`r2000-test-gate.ts:1-33`, verbatim):

```typescript
#!/usr/bin/env node
// r2000-test-gate.ts -- the ONE place the D-11 regenerator2000 availability
// gate is implemented.
//
// WHY THIS SEAM EXISTS (plan 11-01, R2000-10): ... Six-plus hand-copied
// `probeR2000()`/`R2000_AVAILABLE`/`SKIP_REASON`/`VICE_REQUIRE_R2000` bodies
// is exactly how a gate silently diverges -- one copy gets its timeout
// changed, another its regex loosened, and nobody notices ...
//
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only helper has no business in the published npm tarball), and it
// must never be imported by a production module -- only by `*.test.ts`
// files. `r2000-verify.test.ts` asserts the `files[]` absence mechanically.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file, and must never be
// collected as one.
import { spawnSync } from "node:child_process";
```

Both TEST-ONLY paragraphs travel to `acme-gate.ts` verbatim except the
`r2000-verify.test.ts` attribution, which becomes `acme-gate.test.ts` (D-04).

**Rationale block that moves with the code** (`r2000-test-gate.ts:97-112`) — the
ACME divergence story; RESEARCH.md quotes it verbatim in its Verified Reference Map.

**Body to move verbatim** (`r2000-test-gate.ts:116-166`): `ACME_BIN` `:116`,
`probeAcme` `:122`, `ACME_AVAILABLE` **`:134`** (CONTEXT's `:132` is stale, C-5),
`acmeSkipReasonFor` `:143`, `assertAcmeRequiredIfEnvSet` `:158`.
`import { spawnSync } from "node:child_process";` (`:34`) must be **duplicated**,
not moved — the R2000 half still uses it.

**Naming convention:** `<domain>-<role>.ts`, as `backend-detect.mts`,
`stock-condition.ts`, `disasm-decoder.ts`. Name confirmed free.

**Constraint:** no `[ASSUMED]` label in the new header —
`assumption-label-discipline.test.ts:45-53` scans authored non-test `.ts` under
`src/mcp/vice/`. The moved ACME half contains none today.

---

### `acme-gate.test.ts` (test: child-process hard-FAIL + `files[]` absence)

**Analog A — the child-process idiom** (`r2000-launch.test.ts:497-512`, verbatim):

```typescript
test("runR2000({ timeoutMs: 250 }) against a genuinely slow child throws a named, actionable error -- never a raw spawnSync error object", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const childProgram =
    `import { runR2000 } from ${JSON.stringify(join(here, "r2000-launch.ts"))};\n` +
    ...
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", childProgram], {
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, R2000_BIN: process.execPath },
  });
```

Copy: absolute-path import via `JSON.stringify(join(HERE, "acme-gate.ts"))`, env
override on the spawn, generous explicit `timeout`. Difference forced by D-05:
`node --test` cannot take `-e`, so write `probe.test.mjs` into
`mkdtempSync(join(tmpdir(), "acme-gate-fail-"))` — **outside `src/mcp/vice/`** so
`node --test '*.test.*'` and `test-gate.test.ts:33-49` never collect it — and
`rmSync(..., { recursive: true, force: true })` in a `finally`.

**Analog B — the `files[]`-absence assertion** (`r2000-verify.test.ts:187-194`,
verbatim; left in place, copied in shape only, per D-04):

```typescript
test("r2000-test-gate.ts is absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("r2000-test-gate.ts"),
    false,
    "r2000-test-gate.ts is test-only and must never ship in the published npm tarball"
  );
});
```

**Analog C — the non-vacuity control.** Repo house style is that every absence or
guard assertion carries a paired positive control. Two in-repo shapes:
`hostpath-consumers.test.ts:220-229` ("planted violation … if this fails, the
absence assertion above is not actually capable of catching a real violation")
and `r2000-coverage.test.ts:619-622` ("the divergence sub-report did not move at
all -- if it cannot move, the independence assertion above is vacuous"). Apply as
RESEARCH.md V-1 step 4: assert `status !== 0` (never `=== 1`), assert the output
matches the assertion message, and assert the same child with
`VICE_REQUIRE_ACME` **unset** exits zero.

---

### `block-class.ts` (adapter, store side only)

**Analog A — the seam-header shape** (`stock-condition.ts:1-30`, verbatim head):

```typescript
#!/usr/bin/env node
// stock-condition.ts
//
// The ONE place that builds a checkpoint-condition expression for stock
// VICE's binary monitor: ... No other module in this tree may construct
// condition text.
//
// WHY THIS FILE EXISTS: ... three independent traps ...
//
// WHAT NOT TO DO:
//   - Never string-concatenate a condition ...
```

Reproduce the exact three-part structure: one-line "the ONE place…", a
`WHY THIS FILE EXISTS` paragraph, an explicit `WHAT NOT TO DO` list. For
`block-class.ts` the WHAT-NOT-TO-DO list is fixed by RESEARCH.md: never accept
the census or the raw bytes as an argument (`r2000-coverage.ts:124-127`'s
BYTES-VERSUS-STORE independence axis collapses if it does), and never re-compare
a Rust `Display` literal outside this module.

**Analog B — the code that moves** (`r2000-coverage.ts:1662-1690` + `:1983-1986`,
both quoted verbatim in RESEARCH.md `## The Coverage Boundary, Measured`).
Exhaustive literal inventory: `:211` (doc comment), `:1687`, `:1688`, `:1985`,
`:1986`. Both `storeBlockTypeAt()` call sites — `:1921` and `:1983` — route
through the adapter, not just the comparisons.

**Type that moves:** `R2000BlockEntry` (`r2000-coverage.ts:208`) → `BlockEntry`.
The unprefixed-exported-type convention is `stock-*.ts`'s. Consumers to repoint:
`r2000-coverage.ts:208,1655,1662,1974,2059`, `r2000-coverage.test.ts:58,122,606`,
`r2000-cli.ts:75` (type-only import — **split**). `R2000Symbol` / `R2000Comment`
stay.

**Header correction in the same commit** (`r2000-coverage.ts:61-66`): its claim
that the block listing "enters this file at one call site (`computeDivergence()`)"
is already false (`:1921` is a second). The adapter makes it true for the first
time — restate it as entering only through `block-class.ts`.

---

### `r2000-coverage.test.ts` — the substitutability test (D-13)

**Analog:** `r2000-coverage.test.ts:604-623`, verbatim:

```typescript
test("independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report", () => {
  const before = reportFor(WELL_DOCUMENTED);
  const oneType: R2000BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];
  const after = reportFor(WELL_DOCUMENTED, { blocks: oneType });

  for (const key of ["reachedAsInstruction", "tableEntry", "referencedAsData", "unreached", "linearSweepDecodable", "rangeBytes"] as const) {
    assert.equal(after.structural[key], before.structural[key],
      `mass block-type rewrite moved structural.${key} -- the census must be a pure function of the bytes and the seed set`);
  }
  assert.deepEqual(after.structural.classRuns, before.structural.classRuns);

  assert.equal(before.divergence.censusCodeStoreNotCode, 0);
  assert.ok(after.divergence.censusCodeStoreNotCode > 0,
    "the divergence sub-report did not move at all -- if it cannot move, the independence assertion above is vacuous");
});
```

Copy the key list, the `deepEqual` on `classRuns`, **and** the trailing
non-vacuity assertion. Per RESEARCH.md V-3, choose a second vocabulary with
**zero overlap** with `"Code"`/`"Undefined"`/`"Byte"` so a comparison site left
behind at `:1985`/`:1986` shows up as a moved byte count.

**Reference the test by title string or line, never by `COV-01`/`COV-02`** — C-6:
those ids name different tests at `:578`, `:592`, `:816`, `:913`.

---

### `prg-image.ts` (shipped, in `files[]`)

**Analog A — a shipped pure C64-format module's header** (`r2000-d64.ts:1-22`):

```typescript
#!/usr/bin/env node
// Pure, offline `.d64` directory listing and named-entry byte extraction --
// the container-side half of D-02's ".d64 is a first-class bootstrap input"
// requirement.
//
// WHY THIS FILE EXISTS HERE, AND NOT AS AN EXTENSION OF
// `src/skills/c64-ram-capture/scripts/d64-parse.mjs`: ... this MCP server
// ships as `@henols/vice-mcp`, whose `files[]` in `package.json` lists only
// `src/mcp/vice/` contents ... `scripts/check-npm-packages.mjs`'s
// transitive-closure walk over `files[]` would fail the pack the moment a
// reachable module sat outside the listed set.
```

This is the analog precisely because it already reasons about the `files[]`
transitive-closure rule that forces `prg-image.ts` into `files[]` (D-14, via
`r2000-cli.ts:56`).

**Analog B — the bodies that move**, with their doc comments, from
`r2000-project.ts`: `parsePrg` `:166-180`, `flatImageOrigin` `:182-194`, and —
per **C-1**, RESEARCH.md's HIGH-IMPACT correction, overriding CONTEXT's
parenthetical — `decodeRawData` `:196-204` (`r2000-coverage.ts:132` and
`r2000-coverage.test.ts:64` import it, so leaving it behind means Phase 32's
deletion of `r2000-project.ts` silently breaks the census). Moving it adds a
`node:zlib` (`gunzipSync`) import to `prg-image.ts`.

**Import shape at every consumer:** all six static consumers mix a moving symbol
with the staying `synthesizeProject`, so each is a **split**, never a rewrite
(`r2000-cli.ts:56`, `r2000-symbol-roundtrip.test.ts:49`, `r2000-verify.test.ts:38`,
`r2000-tools.test.ts:36`, `r2000-mcp-client.test.ts:98`, `r2000-project.test.ts:54-59`),
plus `r2000-cli.ts:75` (type-only) and the dynamic
`r2000-d64.test.ts:370-379` path constant.

**Guards that begin scanning it the moment it enters `files[]`** — RESEARCH.md
`## Guards That Will Automatically See the New Modules`:
`docs-dangling-refs.test.ts:353,371,411` (no `/\bPhase\s+\d/i` inside a **string
literal**), `comment-phase-pointers.test.ts:400,414,424,446` (no dangling
phase-comment assignment — check its pattern families before writing the header),
`stock-dispatch.test.ts:2902,2929,2949`, `r2000-spawn-seam.test.ts:176,296,363`,
`scripts/check-npm-packages.mjs`.

---

### `module-classification.ts` (typed-const registry)

**Analog A — the typed registry with a long header** (`capability-registry.ts:1-88`).
Verbatim excerpts to shape the header and the types after:

```typescript
// capability-registry.ts
//
// WHY THIS FILE EXISTS (BACK-05): ...
// This module is the ONE authoritative place holding that per-backend
// capability data ... so a future call site ... reads exactly one source
// rather than re-deriving or hand-copying it.
//
// WHAT NOT TO DO: do not hand-maintain a second copy of this data anywhere
// else in the repo (D-E; see CLAUDE.md's "re-deriving a cross-cutting seam
// locally" anti-pattern). ...
//
// EXCLUDED, DELIBERATELY (see docs/stock-vice-parity.md and
// 08-RESEARCH.md's "Capability Delta Registry"):
//   - "vice_diagnose" and "vice_recycle" are NOT capability gaps: ...
```

```typescript
export type CapabilityCategory = "hardware" | "descoped" | "stock-only-gain";

export interface CapabilityEntry {
  name: string;
  category: CapabilityCategory;
  providedBy: ViceBackend;
  reason: string;
  alternative?: string;
}

export const CAPABILITY_REGISTRY: readonly CapabilityEntry[] = [
  // --- hardware (6), providedBy: fork -------------------------------------
  {
    name: "vice_sid_get_state",
    category: "hardware",
    providedBy: "fork",
    reason:
      "SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes " +
      "no SID read command.",
  },
```

Copy exactly: `export type X = "a" | "b" | "c"` union for the verdict
(`"capability" | "glue" | "glue-with-extractable"`, D-08), an `export interface`
one-row shape with a doc comment stating what each field must and must not
contain, `export const NAME: readonly Entry[] = [...]` with `// --- group ---`
section banners, and — critically — the **`EXCLUDED, DELIBERATELY`** header
section. RESEARCH.md `## Registry Scope Gaps` supplies the three exclusions that
must be written down: `scripts/lib/r2000-cli-verbs.{mjs,d.mts}` (named by
`CUT-04`), `docs-r2000-decisions.test.ts` (r2000-named but not glob-matched), and
the `r2000-*.test.ts` family. Entry shape per RESEARCH.md's "Suggested minimal
entry shape" (`module`, `verdict`, `basis.{consumers,requirements}`,
`extractables`), with `consumers[].line` **optional/advisory** — the line-drift
liability this very research pass measured.

**Analog B — the minimal typed-const with the "why not a `.test.ts`" note**
(`fork-deleted-tools.ts`, full file, 21 lines):

```typescript
// fork-deleted-tools.ts
//
// The single named source of truth for "deliberately deleted from the fork
// manifest, not stale." ...
//
// Deliberately a plain `.ts` module, never a `.test.ts` file: importing a
// `.test.ts` module for its exports would also re-run every top-level
// `node:test` `test(...)` call it registers as an import side effect,
// silently duplicating that file's test execution inside whatever file
// imports it.
export const DELIBERATELY_DELETED_FORK_TOOLS: readonly string[] = ["vice_snapshot_list"];
```

That last paragraph is the one to reproduce in **both** the registry and
`shipped-modules.ts` — it is this repo's canonical statement of the
non-`*.test.*`-name rule.

**`files[]` absence** (D-09): `module-classification.test.ts` carries the
`r2000-verify.test.ts:187-194` assertion for it.

---

### `module-classification.test.ts` (structural guard — assert relations, not counts)

**Analog A — disk enumeration + growing floor + planted violation**
(`hostpath-consumers.test.ts:178-232`, verbatim). This is the guard to hold up
against the standing hazard, because it already models exactly the
relation-not-count discipline CONTEXT.md demands:

```typescript
function r2000ProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^r2000-.*\.ts$/.test(name));
}

// Measured true count as of this phase (11.1-03, 2026-08-21): 14 production
// r2000-*.ts modules on disk. This floor must be RAISED, never lowered, as
// the family grows -- an empty or broken glob (e.g. a typo'd filter regex,
// or a directory walk that silently resolves to the wrong path) must fail
// this test rather than pass vacuously, which is the exact defect INT-01
// found in the ten-name hard-coded array this replaces.
const R2000_MODULE_FLOOR = 14;

test("... derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)", () => {
  const modules = r2000ProductionModules();
  assert.ok(
    modules.length >= R2000_MODULE_FLOOR,
    `expected >= ${R2000_MODULE_FLOOR} r2000-*.ts production modules on disk, found ${modules.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the absence assertion below pass trivially",
  );
});
```

```typescript
test("planted violation (INT-01 proof): a synthetic r2000-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses", () => {
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

Copy three things: (1) `>=` floor with the "RAISED, never lowered" comment —
never `assert.equal(modules.length, 16)`; (2) the explicit non-vacuity guard
before any absence loop (`:214`: `assert.ok(r2000Modules.length > 0, ...)`);
(3) the planted-violation test running the *same predicate* the real scan uses,
now over a synthetic entry with an empty `basis` and a nonexistent consumer path.

**Contrast to hold up as the anti-pattern:** `audit-integrity.test.ts` pinned
per-milestone totals and goes red on a correct tree (recorded project knowledge).
`hostpath-consumers.test.ts:188` is the same author's family with the floor fix
applied — that is the analog, not the equality.

**Analog B — the "mechanical completeness" bidirectional test**
(`capability-registry.test.ts:119`): derives the expected set from disk/manifest
rather than a hard-coded array, and its header comment (`:126-158`) records that
a hardcoded `new Set([...])` was the previous defect (WR-05). Reproduce
RESEARCH.md V-2's five directions: completeness, no orphans, basis integrity,
the prefix prohibition (no `basis` text matching `/prefix/i` or a bare `r2000-`
pattern), and verdict/extractables coherence.

**Analog C — the line-citation check** (`docs-linerefs.test.ts:66-83`): the
in-repo precedent for asserting *the cited line contains the symbol* rather than
pinning the number — the fix for the `consumers[].line` drift liability.

**Also do NOT touch:** `hostpath-consumers.test.ts:204` — RESEARCH.md resolves
CONTEXT's open check: `acme-gate.ts` can never match `r2000ProductionModules()`,
so adding it **breaks** the test. `R2000_MODULE_FLOOR = 14` vs 16 on disk still
holds (phase adds and removes zero `r2000-*.ts`).

---

### `shipped-modules.ts` (shared test-only helper) + the four repoints

**Analog A — the canonical body to move verbatim** (`docs-dangling-refs.test.ts:353-362`):

```typescript
function shippedTsModules(): string[] {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    assert.ok(
      existsSync(join(HERE, entry)),
      `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
    );
  }
  return entries;
}
```

The existence assertion is load-bearing (`docs-dangling-refs.test.ts:344-352`:
the INT-01 lesson). Extracted, the helper cannot use the caller's `assert`
implicitly — either take `assert` as a parameter or throw its own named `Error`.
It **must not** be able to return a short list silently.

**Rationale that travels with it:** `r2000-spawn-seam.test.ts:155-175`'s doc
comment explains why the set is `files[]`-derived rather than `readdirSync`-derived,
using `r2000-test-gate.ts` as the motivating unshipped-spawn-site example. After
this phase `acme-gate.ts` is a second instance of the same shape, so the moved
comment gains a second example.

**Analog B — the target import shape** (`r2000-spawn-seam.test.ts:50-53`):

```typescript
import { skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";
```

This is D-16's precedent (a guard test importing a neutral non-test helper) and
the template for every split import in the phase: real `.ts` extension, one
statement per source module, side by side.

**`codeOnly()`** (`r2000-spawn-seam.test.ts:65`) has exactly **one** definition
and **one** consuming file (C-3) — the rationale is *survival*, not divergence.
The four "variants" at `disasm-decoder.test.ts:308`, `disasm-renderer.test.ts:346`,
`disasm-opcodes.test.ts:394`, `r2000-tools.test.ts:201` are local `const`s doing a
different job (`r2000-tools.test.ts:193-201` states why in code) — Deferred.

**Both convention comments rewritten in the same commit** (C-4):
`comment-phase-pointers.test.ts:53-59` **and** `hop-chain-comments.test.ts:46-50`.
The second is worded more broadly and ends with a positive instruction to keep
duplicating; rewriting only the first leaves the record self-contradictory.
`hop-chain-comments.test.ts` duplicates the *comment extractor*, not
`shippedTsModules()`, so nothing repoints there — comment only.

## Shared Patterns

### The structured single-seam header
**Sources (best exemplars, in order):** `stock-condition.ts:1-30` (ONE-place line
+ `WHY THIS FILE EXISTS` + `WHAT NOT TO DO` list), `capability-registry.ts:1-58`
(+ `SECURITY POSTURE` + `EXCLUDED, DELIBERATELY`), `r2000-test-gate.ts:1-33`
(the divergence-incident narrative + the TEST-ONLY / non-`*.test.*` rules),
`r2000-d64.ts:1-22` (the `files[]` transitive-closure reasoning),
`fork-deleted-tools.ts:1-20` (the shortest complete instance).
**Apply to:** all five new modules.
**Hazards:** no `Phase N` inside a *string literal* in a shipped module
(`docs-dangling-refs.test.ts`); no dangling phase-pointer assignment
(`comment-phase-pointers.test.ts`); no new `[ASSUMED]` label
(`assumption-label-discipline.test.ts:45-53` — the one most likely to bite, since
a long seam header invites recording an assumption).

### `files[]`-absence assertion for every unshipped new module
**Source:** `r2000-verify.test.ts:187-194` (quoted above). **Apply to:**
`acme-gate.ts` (in `acme-gate.test.ts`, D-04), `module-classification.ts`,
`shipped-modules.ts`. **Never extend `r2000-verify.test.ts` itself** (D-04) —
that re-creates the prefix hazard.

### Non-vacuity / planted-violation pairing
**Sources:** `hostpath-consumers.test.ts:220-229`, `r2000-coverage.test.ts:619-622`,
`hostpath-consumers.test.ts:190-197` (the floor). **Apply to:** every new guard
and every new absence assertion in this phase. A guard that cannot be made to
fail has not been written.

### Colocated tests, `node --test`, no framework
**Source:** any `*.test.ts`; import block idiom from `capability-registry.test.ts:16-25`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CAPABILITY_REGISTRY, capabilityEntryFor, capabilityRefusalMessage } from "./capability-registry.ts";
import type { ViceBackend } from "./backend-detect.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
```

`HERE` is the repo-wide idiom name. Real `.ts`/`.mts` extensions on every
relative import; `import type` for type-only. **Apply to:** all four new test
files. New `*.test.ts` files are auto-discovered by `test-gate.test.ts:33-49` —
do **not** add them to `MANUAL_ONLY_TESTS`.

### Split, never rewrite
**Source shape:** `r2000-spawn-seam.test.ts:50-53`.
**Apply to:** `r2000-cli.test.ts:22-28` (C-2 — imports both gate halves),
`r2000-cli.ts:56` and `:75`, `r2000-symbol-roundtrip.test.ts:49`,
`r2000-verify.test.ts:38`, `r2000-tools.test.ts:36`,
`r2000-mcp-client.test.ts:98`, `r2000-project.test.ts:54-59`,
`r2000-coverage.ts` (type + adapter imports). `npm run typecheck`
(`tsc --noEmit`) is the mechanical check for a half-done split.

### Rewrite the record, don't route around it
Four comments become false in this phase and must be corrected in the same commit:
`r2000-coverage.ts:61-66` (the "one call site" claim, already false),
`comment-phase-pointers.test.ts:53-59`, `hop-chain-comments.test.ts:46-50` (C-4),
and the prose sites naming `r2000-test-gate.ts` as the ACME seam:
`disasm-roundtrip.test.ts:60-65`, `skill-acme-build-cli.test.ts:15-16`,
`r2000-cli.test.ts:679-684`, `r2000-answer-key.test.ts:220-221`,
`r2000-spawn-seam.test.ts:158-175`.

## No Analog Found

None. Every new file has a concrete in-repo analog — expected, since this phase
is a pure extraction. Two thin spots the planner should know about:

| File | Role | Gap | Mitigation |
|---|---|---|---|
| `acme-gate.test.ts` | test | no existing test spawns a child **`node --test`** run (the precedent at `r2000-launch.test.ts:497-512` spawns `--input-type=module -e`) | the delta is only the argv shape + a `mkdtemp` probe file; RESEARCH.md V-1 specifies it step by step |
| `shipped-modules.ts` | test-only helper | its name is the one item RESEARCH.md leaves unresolved | constraints are fully determined (plain `.ts`, out of `files[]`, name free); `fork-deleted-tools.ts`'s closing paragraph is the rule to quote |

## Metadata

**Analog search scope:** `src/mcp/vice/` (all `*.ts` / `*.mts` / `*.test.*`),
`src/mcp/vice/package.json`, `scripts/`, `.github/workflows/ci.yml`.
**Files read this pass:** `capability-registry.ts`, `capability-registry.test.ts`,
`fork-deleted-tools.ts`, `r2000-test-gate.ts` (header), `stock-condition.ts`
(header), `r2000-d64.ts` (header), `r2000-project.ts:160-205`,
`hostpath-consumers.test.ts:175-235`, `package.json` `files[]`; plus every
verbatim excerpt RESEARCH.md had already verified at `1785165` (not re-read).
**Pattern extraction date:** 2026-08-26
