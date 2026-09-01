# Phase 32: The Deletion and the Grep Gate - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 7 (4 new, 3 modified)
**Analogs found:** 7 / 7

RESEARCH.md already chose the analogs (§2.1, §2.2, §3.1-3.3, §4.1, §4.3). This document turns
those choices into copy-ready excerpts with `file:line` citations. It does **not** re-derive them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.planning/phases/32-*/guard-fates.json` (NEW) | config / data | file-I/O (read-only by guard) | `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` block (`:132-165`) — same "frozen membership checked against a derived set" role, serialized instead of inlined | role-match |
| `scripts/check-guard-fates.mjs` (NEW) | guard / CI script | batch transform → exit status | `scripts/check-no-analyser.mjs` (structure, `need()`, exact-count `===`, entry-point guard, report block) + `scripts/audit-gate.mjs` (`--root`, derive-from-disk, floor) | exact |
| `scripts/check-guard-fates.d.mts` (NEW, only if a test imports it) | type declaration | n/a | `scripts/check-no-analyser.d.mts` (14 lines, whole file) | exact |
| `src/mcp/vice/guard-fates.test.ts` (NEW) | test (non-vacuity) | request-response (predicate in / assertion out) | `src/mcp/vice/removal-gate.test.ts:58-75` | exact |
| the mutation harness (NEW, `scripts/`) | phase instrument | event-driven loop (plant → spawn → assert → revert) | `scripts/audit-gate.mjs`'s `runGuardsLive()` (`:203-244`) | exact |
| `.github/workflows/ci.yml` (MODIFIED) | config | n/a | the six named steps at `:189-235` | exact |
| `src/mcp/vice/docs-linerefs.test.ts` (MODIFIED) | test (guard) | file-I/O | itself + `docs-dangling-refs.test.ts:50-56, 88-94` for the document-set shape | exact |
| `.planning/PROJECT.md` (MODIFIED) | doc | n/a | `CLAUDE.md:26`'s corrected twin | exact |

---

## Pattern Assignments

### `scripts/check-guard-fates.mjs` (guard, batch → exit status)

**Primary analog:** `scripts/check-no-analyser.mjs`. **Secondary:** `scripts/audit-gate.mjs`.

**Imports + root + error accumulator** — `scripts/check-no-analyser.mjs:114-125`:
```js
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { packFiles } from "./check-npm-packages.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};
```
Note: this shape has **no `--root`**. Take the root from `audit-gate.mjs` instead (below), per D-06/D-07.

**`--root <dir>` flag handling** — `scripts/audit-gate.mjs:1118-1145`:
```js
function parseArgs(argv) {
  let root;
  let json = false;
  let hook = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      root = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--json") {
      json = true;
    } else if (argv[i] === "--hook") {
      hook = true;
    }
  }
  return { root, json, hook };
}

function main() {
  const { root: rootArg, json, hook } = parseArgs(process.argv.slice(2));
  ...
  const root = resolve(rootArg ?? join(HERE, ".."));
```
There is **no explicit path-traversal refusal** in `audit-gate.mjs` — RESEARCH §Security cited
`:1147-1151`, but the code there is the WR-03 try/catch, not a containment check. Its comment
(`scripts/audit-gate.mjs:1147-1155`) states the real contract:
```js
  // WR-03 (12-REVIEW.md): pre-fix, a mistyped --root threw an uncaught
  // ENOENT from readdirSync here -- the same exit code (1) a legitimate
  // refusal uses, with no JSON at all on stdout under --json, so a --json
  // consumer could not tell a typo from a refusal. This wraps every call
  // below that can throw on a bad root ... in one try/catch, so both output
  // modes fail cleanly and diagnosably
  let result, guardFiles, auditFiles, statusCounts;
  try {
    result = checkAuditGate({ viceDir, planningDir });
```
**Copy the try/catch, and add the containment check the research asked for** (`resolve(root)` must be
inside the repo, or the harness's synthetic-fixture dir) — it does not exist to copy.

**Derive-from-disk, never a hand-typed second list** — `scripts/audit-gate.mjs:171-176`:
```js
export function docsGuardFiles(viceDir) {
  return readdirSync(viceDir)
    .filter((f) => /^docs-.*\.test\.ts$/.test(f))
    .sort();
}
```
with its header rule at `scripts/audit-gate.mjs:16-20`:
```
//  - Do not hand-type a second list of guard file names anywhere else in
//    this repo. The guard set below is derived from disk (D-12-07);
//    duplicating it by hand is exactly how a guard can silently drop out of
//    the set this gate protects.
```

**The non-vacuity floor idiom** (RESEARCH §4.2 item 4) — `scripts/audit-gate.mjs:112` and its
preceding comment block (`:96-111`):
```js
export const DOCS_GUARD_FLOOR = 7;
```
The comment records the discipline verbatim: the floor is only ever moved *in the same commit* that
retires or adds a guard, and it exists so "a silently-shrinking glob" is a structural failure.
Set the fate registry's floor to 43 and write the same same-commit clause.

**Exact-count assertion with `===`** — `scripts/check-no-analyser.mjs:891-899`:
```js
      const actual = byPath.get(p) ?? 0;
      need(
        actual === expected,
        `exemption "${cls.id}" non-vacuity: expected exactly ${expected} exempted occurrence(s) in ${p}, got ` +
          `${actual}. A HIGHER count means the exemption is being used to hide a reintroduction rather than ` +
          `covering the mentions it was measured against; a LOWER count means the prose it protects has been ` +
          `deleted or the path is stale (see the staleness contract in this file's header).`
      );
```
Both directions asserted, and the message names what each direction means. Mirror this for the
registry: a member with no row **and** a row naming no member both fail.

**Entry-point guard, so a test can import the predicates** — `scripts/check-no-analyser.mjs:754-768`:
```js
// Everything from here down is this gate's own DRIVER and runs only when this
// file is the process entry point. `removal-gate.test.ts` IMPORTS the two
// exported predicates above; without this guard that import would run the
// whole scan -- packing the installer, walking 391 files and, on any failure,
// calling process.exit(1) from inside an `import` statement, which no test can
// catch.
const IS_ENTRY_POINT =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_ENTRY_POINT) {
```

**Report block** — `scripts/check-no-analyser.mjs:747-758` (and the same shape at
`scripts/check-skill-tool-coverage.mjs:~tail`):
```js
if (errors.length) {
  console.error("check-no-<subject>: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log(
  `check-no-<subject>: OK -- scanned ${scanned.length} files ` + ...
);
```
The OK line always reports the **measured counts**, not the word "OK" alone — that is what makes a
vacuous run visible in CI logs.

---

### ⚠️ HAZARD 1 — the exact-count exemptions red on the landing commit

`scripts/check-no-analyser.mjs:217-222`:
```js
// PERMANENT EXEMPTIONS -- path-scoped or block-scoped, shape-matched, each
// with an EXACT hit count measured against THIS tree (never copied out of a
// research document). Every count is asserted with `===`: a count that has
// grown means the exemption is being used to hide a reintroduction.
```
The `===` assertion itself is at `:891-899` (quoted above), with three more at `:914`, `:932`,
`:943`, `:962`, `:980`, `:1052`.

The **`.planning/` prefix exclusion** that makes the registry's location safe — `scripts/check-no-analyser.mjs:180` and `:194-200`:
```js
/** PREFIX, never a substring: `docs/planning-notes.md` stays in scope. */
const PLANNING_PREFIX = ".planning/";

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean).filter((p) => !p.startsWith(PLANNING_PREFIX));
}
```
**Consequences for this phase's new files:**
- Registry under `.planning/phases/32-*/` → invisible to the gate. Its prose may name the subject freely.
- `scripts/check-guard-fates.mjs`, its `.d.mts`, `src/mcp/vice/guard-fates.test.ts`, the harness, and
  the new `ci.yml` step **are** in scope. None may contain the contiguous literal in any form —
  not in a name, not in a comment, not in an error message. `.github/workflows/ci.yml` is pinned at
  exactly **1** occurrence (the existing step name at `:199`).
- The gate composes its own path strings rather than typing them (`scripts/check-no-analyser.mjs:139-146`):
```js
export const SUBJECT_NEEDLE = the subject needle;
const GATE_PATH = `scripts/check-no-${SUBJECT_NEEDLE}.mjs`;
```
  If the new guard genuinely must name the subject, use this composition trick — but the cheaper
  answer is a name that does not.

---

### ⚠️ HAZARD 2 — `NODE_TEST_*` must be stripped, or every planted red records as green

**Copy verbatim** — `scripts/audit-gate.mjs:203-228`:
```js
export function runGuardsLive(viceDir, files) {
  // Strip NODE_TEST_* from the child's environment before spawning. When
  // this gate itself runs from inside a `node --test` process ... Node sets
  // `NODE_TEST_CONTEXT` in the parent's own process.env; inherited
  // unmodified, the NESTED `node --test` below silently switches its
  // reporter to the parent-child IPC/v8-serialization protocol instead of
  // TAP on stdout, so a genuinely failing guard is reported here as if it
  // had produced no output at all -- exit code 0, empty parsed output --
  // which is precisely the "green when it should be red" failure GATE-01
  // exists to make impossible.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST_")) delete env[key];
  }
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: viceDir,
    encoding: "utf8",
    env,
    timeout: GUARD_RUN_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
```
plus the timeout constant and its rationale at `scripts/audit-gate.mjs:194-202`:
```js
const GUARD_RUN_TIMEOUT_MS = 15000;
```
and the fail-closed error mapping at `:231-241`:
```js
  if (result.error) {
    let stderr = `${result.stderr ?? ""}\n${result.error.message ?? String(result.error)}`.trim();
    if (result.error.code === "ETIMEDOUT") {
      stderr = (
        `${stderr}\nguard run was killed after exceeding the ${GUARD_RUN_TIMEOUT_MS}ms timeout ` +
        "(GUARD_RUN_TIMEOUT_MS) -- treated as red rather than hanging the caller."
      ).trim();
    }
    return { status: 1, stdout: result.stdout ?? "", stderr };
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
```
The harness's observed-red assertion is `result.status !== 0` against **this** return shape.
`spawnSync` argv is an **array**, `shell` is never set — the ASVS V5 control RESEARCH names.

---

### the mutation harness (phase instrument, plant → spawn → assert → revert)

**Analog:** `scripts/audit-gate.mjs` `runGuardsLive()` (above) for the spawn leg;
`src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` for the plant leg.

**Committed plant shape** — `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt:1-19` (whole file):
```
// PLANTED VIOLATION FIXTURE -- route (a): a surviving `src/mcp/vice/*.ts`
// module body that has re-acquired a reference to the deleted static-analysis
// integration. Committed with a `.txt` suffix so no TypeScript program, no
// `node --test` glob and no runtime import ever loads it, and so the real
// removal gate scans it only through its `fixtures/planted-` prefix
// exemption rather than as a reintroduction.
//
// This body is the SUBJECT of removal-gate.test.ts, never a copy of it: the
// test drives the gate's own exported predicate against these bytes.

import { spawnSync } from "node:child_process";

/** Re-introduced helper: shells out to the analyser this project deleted. */
export function probeAnalyser(projectPath: string): string {
  const result = spawnSync("the external analyser", ["--mcp-server-stdio", projectPath], {
    encoding: "utf8",
  });
  return result.stdout ?? "";
}
```
Every new plant fixture needs the same four-part header: what route it plants, why the extension is
inert, that it is the *subject* not a copy of the guard, and which guard owns it.

**Register the new plant in the fixtures index** — `src/mcp/vice/fixtures/README.md:37-51`:
```markdown
# Planted-violation fixtures

`planted-*` files in this directory are **deliberate violations**, committed so a
structural guard can be proven by observing it bite rather than by reading it. They carry a
`.txt` suffix (or an inert extension) so that no TypeScript program, no `node --test` glob and no
runtime import ever loads them.

| Fixture | Guard it belongs to | Route it plants |
|---|---|---|
| `planted-removal-fixture.ts.txt` | the removal gate, ... | a surviving `src/mcp/vice/*.ts` module body |
```
⚠️ `fixtures/README.md` carries **1** pinned occurrence under the `gate-self` class. Adding a row
that names the subject moves that pin — re-pin in the same commit or word the row without it.
Also: `planted-removal-fixture.{ts,md}.txt` are covered by `prefixes: ["src/mcp/vice/fixtures/planted-"]`
with `prefixHits: 2` — a **new** `planted-*` fixture carrying the literal changes that total and
reds the gate (`scripts/check-no-analyser.mjs:958-966`):
```js
  if (cls.prefixes) {
    const total = [...byPath.entries()]
      .filter(([p]) => cls.prefixes.some((x) => p.startsWith(x)))
      .reduce((n, [, v]) => n + v, 0);
    need(
      total === cls.prefixHits,
      `exemption "${cls.id}" non-vacuity: expected exactly ${cls.prefixHits} exempted occurrence(s) under ` +
        `${cls.prefixes.join(", ")}, got ${total} -- update the pin in the same commit that changes the fixtures.`
    );
  }
```

---

### `src/mcp/vice/guard-fates.test.ts` (test, non-vacuity)

**Analog:** `src/mcp/vice/removal-gate.test.ts:32-75`.

**Imports + fixture reader:**
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ... } from "../../../scripts/check-no-analyser.mjs";   // :38-44

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}
```

**Planted-violation test body** — `src/mcp/vice/removal-gate.test.ts:58-75`:
```typescript
test("planted violation, route (a): a `src/mcp/vice/*.ts` module body is reported, with the line number", () => {
  const body = fixture("planted-removal-fixture.ts.txt");
  const hits = subjectHits("src/mcp/vice/some-surviving-module.ts", body);

  assert.equal(hits.length, 1, "the planted .ts fixture must be reported exactly once");
  const line = hits[0]!;
  assert.ok(line > 0, "the occurrence is in the CONTENT, so its reported line must not be the path sentinel 0");
  ...
  // Self-non-vacuity: if the predicate were stubbed to report nothing, this
  // is the assertion that would catch it.
  const stubbedAlwaysEmpty = (): number[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), hits);
});
```
The "delete a row → red" test (D-01/§4.2 item 5) is this shape: import the guard's **exported
predicate**, feed it a registry object with one row removed, assert it reports the missing member.
Drive the real predicate, never a re-implementation (`scripts/check-no-analyser.mjs:149-154`:
*"A planted violation proved against a re-implementation of the rule proves nothing about the rule
the real scan applies."*).

---

### `scripts/check-guard-fates.d.mts` (type declaration)

**Analog:** `scripts/check-no-analyser.d.mts` — whole file, 14 lines:
```typescript
// Type declarations for the removal gate (`scripts/check-no-<subject>.mjs`),
// so its colocated test (src/mcp/vice/removal-gate.test.ts) typechecks under
// strict mode. This is a CI-only helper with no runtime role, so it stays out
// of src/mcp/vice/package.json's files[] like its .mjs sibling -- the same
// arrangement scripts/lib/anno-cli-verbs.d.mts already uses.
export declare const SUBJECT_NEEDLE: string;
export declare function subjectHits(relPath: string, text: string): number[];
export interface NoticesBlock {
  firstLine: number;
  lastLine: number;
  text: string;
}
export declare function attributionBlocks(text: string): NoticesBlock[];
export declare function isInsideAttributionBlock(text: string, line: number): boolean;
```
Second instance of the same convention, `scripts/lib/anno-cli-verbs.d.mts:1-7`:
```typescript
// Type declarations for anno-cli-verbs.mjs, so the colocated test
// (src/mcp/vice/anno-verb-coverage.test.ts) typechecks under strict
// mode. This file is a CI-only helper with no runtime role, so it stays
// out of src/mcp/vice/package.json's files[] like its .mjs sibling.
export declare const ANNO_CLI_VERB_FLOOR: number;
export declare function parseAnnoCliVerbs(src: string): string[];
```
Header formula: *"Type declarations for X, so its colocated test (PATH) typechecks under strict mode.
CI-only helper with no runtime role, stays out of `src/mcp/vice/package.json`'s `files[]`."*
**Only write this file if a `*.test.ts` imports the guard.**

---

### `.github/workflows/ci.yml` (config, MODIFIED — one new named step)

**Analog:** the six existing steps at `:189-235`. Every one carries a `# Blocking:` comment stating
what breaks for the *user* if the gate is absent, then `- name:` naming the requirement id, then a
bare `run: node scripts/<file>.mjs`. Excerpt — `.github/workflows/ci.yml:192-200`:
```yaml
      - name: Validate npm package contents
        run: node scripts/check-npm-packages.mjs

      # Blocking (CUT-02/CUT-03): the removal gate. It asserts the deleted
      # static-analysis integration is named nowhere this repository tracks or
      # ships, outside a dated allow-list and a set of exact-count, path- or
      # block-scoped exemptions ...
      - name: Validate the removed integration stays removed (CUT-02/CUT-03)
        run: node scripts/check-no-analyser.mjs
```
and `:232-235`:
```yaml
      - name: Validate documented anno CLI invocations argument-by-argument (REPOINT-01/02)
        run: node scripts/check-skill-cli-invocations.mjs
```
New step goes immediately after `:235`, before `- name: Build installable package` (`:237`).
Its `name:` and `run:` lines must not contain the subject literal (Hazard 1: `ci.yml` pinned at 1).

**⚠️ MEASURED, and it closes RESEARCH Open Question 1:** `.github/workflows/ci.yml:29` is a bare
`- uses: actions/checkout@v4` with **no `with:` block and no `fetch-depth`** (same at `:257`, `:298`,
`:348`). CI clones **shallow (depth 1)**, so `0394cbc` is **not** in the object store on the runner.
A guard that shells `git ls-tree 0394cbc` will fail on CI. Take RESEARCH §1.3's fallback: either add
`with: { fetch-depth: 0 }` to the build job's checkout, or ship a committed regenerate-and-diff
manifest of the 43 paths. Decide this before writing the guard.

---

### `src/mcp/vice/docs-linerefs.test.ts` (test, MODIFIED — widen the document set)

**Current shape (the thing being changed)** — `src/mcp/vice/docs-linerefs.test.ts:35-46`:
```typescript
const CITATION_RE = /vice-proxy\.ts:(\d+)/g;

/** Isolates the one CLAUDE.md bullet that cites rewriteArguments()'s call
 * sites, so a citation added elsewhere in the file for an unrelated reason
 * is never swept into this test's non-vacuity count. Matches the bullet
 * that contains the literal string `rewriteArguments()`. */
function findRewriteArgumentsBullet(claudeMd: string): string {
  const lines = claudeMd.split("\n");
  const hit = lines.find((line) => line.includes("rewriteArguments()"));
  assert.ok(hit, "CLAUDE.md must contain a bullet mentioning rewriteArguments() -- none found");
  return hit as string;
}
```
and the two hard-coded reads at `:57` and `:67`:
```typescript
  const claudeMd = readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), "utf8");
```

**Document-set pattern to copy** — `src/mcp/vice/docs-dangling-refs.test.ts:44-56, 88-94`:
```typescript
/* Paths are relative to the repo root and are all expected to exist -- a
 * missing one FAILS rather than silently shrinking the scanned set. */
const ALWAYS_PRESENT_NORMATIVE_DOCS = Object.freeze([
  ".planning/ROADMAP.md",
  "CLAUDE.md",
  "README.md",
  "docs/roadmap-stock-vice.md",
  "docs/stock-vice-parity.md",
]);

/** The full scanned set for this run ... Derived per call rather than frozen at
 * module load so the lifecycle state is read at test time. */
function normativeDocs(): string[] {
  const req = requirementsDocForScan();
  return req ? [...ALWAYS_PRESENT_NORMATIVE_DOCS, req] : [...ALWAYS_PRESENT_NORMATIVE_DOCS];
}
```
and its existence assertion at `docs-dangling-refs.test.ts:136`:
```typescript
    assert.ok(existsSync(path), `${doc} is in the normative set but does not exist -- update ALWAYS_PRESENT_NORMATIVE_DOCS/requirementsDocForScan() rather than letting the scanned set shrink silently`);
```
Copy that message shape: a missing document must fail, never shrink the set silently.

**Non-vacuity assertion to make per-document** — `docs-linerefs.test.ts:56-64`:
```typescript
test("CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)", () => {
  ...
  // Rewording the bullet so this regex matches nothing must FAIL this
  // test, not silently report zero checked citations as a pass -- that is
  // exactly the class of vacuous guard T-11-DOC-DRIFT exists to catch.
  assert.ok(citations.length >= 2, `expected at least two vice-proxy.ts:<N> citations in the rewriteArguments() bullet, found ${citations.length}`);
});
```

**⚠️ MEASURED, and it closes RESEARCH Open Question 2:** `.planning/PROJECT.md` contains
**6** lines with the literal `rewriteArguments()` — at `:230`, `:311`, `:375`, `:381`, `:1111`,
`:1319` (`grep -acn "rewriteArguments()" .planning/PROJECT.md` → 6). `.find()` returns **`:230`**:

> ``docs-linerefs.test.ts` pins CLAUDE.md's `rewriteArguments()` citations;`

which carries **zero** `vice-proxy.ts:N` citations. A naive widening therefore fails the non-vacuity
test on the first run for the wrong reason. The citations live at `:311`. The bullet-isolation
predicate must select the line that **both** mentions `rewriteArguments()` **and** matches
`CITATION_RE`, or filter to all such lines and assert the count — not `.find()`.

Also `:1319` is a *dated* record of past drift (`":3029"/":2964"/":1508"/":1484"`) — it must not be
swept in, or the guard reds on correctly-preserved history. Same for `.planning/ROADMAP.md:541`
(`vice-proxy.ts:3216`, non-`rewriteArguments` context).

---

### `.planning/PROJECT.md` (doc, MODIFIED)

**Analog:** `CLAUDE.md:26` — the already-corrected twin of the same bullet.

Two edits land on the same line, `.planning/PROJECT.md:311`:
1. Line-citation repair, mechanical: `3052→3050`, `2987→2985`, `1531→1529`, `1507→1505`.
   (All four CLAUDE.md numbers re-verified correct against `vice-proxy.ts` this research cycle.)
2. Live-pointer correction: `` `anno_*` family `` → `` `anno_*` family ``, matching CLAUDE.md:26.

**Ordering (RESEARCH Pitfall 3, D-07):** (a) repair `:311` → (b) widen `docs-linerefs.test.ts` →
(c) measure it. Widening onto an unrepaired `PROJECT.md` makes the guard red on landing, and
ordering constraint 5 then forbids recording anything green.

---

## Shared Patterns

### Derive from disk, never hand-type a second list
**Source:** `scripts/audit-gate.mjs:16-20` (rule) and `:171-176` (implementation)
**Apply to:** the fate registry's guard, the harness's guard-set enumeration
Registry rows are the *frozen membership check*, in `EXPECTED_DOCS_GUARD_NAMES`'s role; the derived
set is the authority. Both directions asserted.

### No relaxation hatch; testability comes from `--root`
**Source:** `scripts/audit-gate.mjs:21-26`
```
//  - Do not add a waiver file, an environment-variable override, or any
//    other relaxation hatch (D-12-14). There is deliberately no such thing
//    anywhere in this file. Testability comes from the `--root <dir>` CLI
//    flag instead, which points this whole script at a synthetic tree
//    without touching any real behaviour or reading any real environment
//    variable.
```
**Apply to:** every new guard and any `--root` added under D-07.

### Guards are invoked as their own file names, never from the package scripts block
**Source:** `scripts/audit-gate.mjs:27-34`
```
//  - Do not make this script reachable from this repo's own top-level
//    package-script entries (see `src/mcp/vice/package.json`'s
//    `scripts` block). D-12-11 requires the guard files be invoked
//    directly, as their own file names, never through that broader
//    automated-suite entry point
```
**Apply to:** `check-guard-fates.mjs` (D-16) and the harness (D-17).

### Never evaluate, load, or shell-execute scanned text
**Source:** `scripts/audit-gate.mjs:35-39`
```
//  - Never evaluate, dynamically load, or shell-execute any text this
//    script scans (ASVS V5, threat T-12-03). The only subprocess this file
//    spawns receives an argv array built exclusively from a directory
//    listing filtered by a fixed pattern -- never a shell string, and never
//    anything derived from scanned document content, CLI argv, or stdin.
```
**Apply to:** the harness's every `spawnSync`. Array argv, no `shell: true`, no `execSync` on an
interpolated string.

### Report the measured numbers, not the word OK
**Source:** `scripts/check-skill-tool-coverage.mjs` tail, `scripts/check-no-analyser.mjs:761-778`
**Apply to:** `check-guard-fates.mjs`'s success path — print the derived-set size, the row count and
the floor, so a vacuous run is visible in the CI log rather than green-and-silent.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.planning/phases/32-*/guard-fates.json` | data | file-I/O | No committed JSON data registry exists in this repo. Nearest is `EXPECTED_DOCS_GUARD_NAMES` (inlined `Object.freeze` array). Its *comment discipline* — per-entry provenance, naming the commit and CI run that made each addition necessary (`scripts/audit-gate.mjs:143-165`) — is the pattern to carry into JSON, e.g. a per-row `note` field. |
| the `--root` containment / path-traversal refusal | validation | n/a | Does not exist in `audit-gate.mjs` despite RESEARCH's citation; only the WR-03 try/catch does. Must be written new. |
| restore-on-exit handler (`process.on("exit"/"SIGINT"/"SIGTERM")`, idempotent) | utility | file-I/O | No existing script mutates and restores the working tree. RESEARCH §3.2 specifies the shape; there is nothing to copy. |

---

## Metadata

**Analog search scope:** `scripts/`, `scripts/lib/`, `src/mcp/vice/*.test.ts`,
`src/mcp/vice/fixtures/`, `.github/workflows/`
**Files read this pass:** `scripts/audit-gate.mjs` (targeted ranges 1-60, 100-250, 1110-1175),
`scripts/check-no-analyser.mjs` (110-235, 740-800, 880-1000, tail),
`scripts/check-no-analyser.d.mts`, `scripts/lib/anno-cli-verbs.d.mts`,
`scripts/check-skill-tool-coverage.mjs` (1-40, tail), `src/mcp/vice/docs-linerefs.test.ts` (full),
`src/mcp/vice/docs-dangling-refs.test.ts` (targeted), `src/mcp/vice/removal-gate.test.ts` (targeted),
`src/mcp/vice/fixtures/planted-removal-fixture.ts.txt`, `src/mcp/vice/fixtures/README.md`,
`.github/workflows/ci.yml` (185-245, checkout blocks)
**Pattern extraction date:** 2026-08-31
