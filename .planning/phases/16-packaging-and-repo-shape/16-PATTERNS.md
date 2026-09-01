# Phase 16: Packaging and Repo Shape - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 9 new-artifact classes (3 PKG-02 test files, 1 PKG-03 test file + fixture,
1 PKG-01 sweep of ~15 literal-path consumers, 1 PROJECT.md accepted-risk entry, plus the
`repoRoot()`/`repo-root.test.ts` pair the move must not break, plus `vice-proxy.test.ts`'s
structural path guard)
**Analogs found:** 9 / 9 (every file class has a strong, cited, verified-at-HEAD analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `skill-acme-build-cli.test.ts` (new, PKG-02) | test | request-response (subprocess CLI) | `.claude/mcp/vice/disasm-roundtrip.test.ts` (ACME-gated subprocess spawn) + `.claude/mcp/vice/anno-cli.test.ts` (argv-subcommand CLI test structure) | exact (role+flow) |
| `skill-memory-mapping-cli.test.ts` (new, PKG-02) | test | request-response (in-process import + subprocess) | `.claude/mcp/vice/anno-cli.test.ts` (mixes in-process `runAnnoCli()` calls with subprocess bin-level tests) | exact |
| `skill-program-recon-cli.test.ts` (new, PKG-02) | test | request-response (subprocess CLI, pure arithmetic) | `.claude/mcp/vice/anno-cli.test.ts` (subprocess pattern, no external binary dependency) | exact |
| `comment-phase-pointers.test.ts` (new, PKG-03) | test (guard) | batch (scan-all-shipped-source) | `.claude/mcp/vice/docs-dangling-refs.test.ts` (FLOW-02 test + `extractStringLiterals()` + `ASSIGNMENT_RES` + `shippedTsModules()`) | exact |
| Guard fixture for PKG-03 (new, under `fixtures/`, if planner wants a permanent fixture rather than the inline planted-violation style) | fixture/test-data | file-I/O | `.claude/mcp/vice/fixtures/planted-review-fixture.md` + `docs-review-disposition.test.ts`'s fixture-driven tests | exact |
| ~15 literal-path consumers swept for PKG-01 (`.mcp.json`, `plugin.json`, `scripts/*.mjs`, `scripts/package.sh`, `scripts/ensure-mcp-deps.sh`, `installer/scripts/sync-skills.mjs`, `assumption-label-discipline.test.ts`, `version.test.ts`, `anno-cli.ts`, `package.json`) | config/utility/test (mixed) | transform (path literal find-replace) | `repo-root.ts`'s own header — narrates the prior 3 moves and the exact literal-sweep discipline; `wireMcp()` is the merge-logic analog (see below) | role-match |
| PROJECT.md PKG-04 accepted-risk entry (new row) | config (documentation) | transform | `PROJECT.md`'s FORK-01 row (Key Decisions table, line 278) | exact |
| (Not modified, but must survive) `repo-root.ts` branch 4 + `repo-root.test.ts`'s synthetic pin | utility / test | transform | itself — this is the file the move's depth constraint is checked against | n/a (constraint, not new file) |
| (Not modified, but must survive as-is) `vice-proxy.test.ts`'s network-call structural guard | test | batch (directory scan) | itself — uses bare filenames via `readdirSync(HERE)`, so it needs **zero change** on the move | n/a (verify-only) |

## Pattern Assignments

### `skill-acme-build-cli.test.ts` / `skill-program-recon-cli.test.ts` (test, subprocess CLI)

**Analog:** `.claude/mcp/vice/disasm-roundtrip.test.ts` (for the ACME-gate shape) and
`.claude/mcp/vice/anno-cli.test.ts` (for general subprocess-CLI test structure)

**Imports pattern** (`disasm-roundtrip.test.ts:42-57`):
```typescript
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OPCODES, type OpcodeEntry, type AddressingMode } from "./disasm-opcodes.ts";
// ...
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./anno-test-gate.ts";
```
Reach the skill script under test the same way — a relative path computed from `HERE`
(`dirname(fileURLToPath(import.meta.url))`), one level up out of the MCP package directory
and back down into `src/skills/...` (post-move; verify exact hop count against final layout —
see PKG-01 target-shape note below).

**The ACME availability gate (reuse verbatim, do not reimplement)** — `anno-test-gate.ts:114-162`:
```typescript
export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";
// probeAcme(): spawnSync(ACME_BIN, ["--version"...]) falling back to ["--help"...]
export const ACME_AVAILABLE: boolean = probeAcme();
export function acmeSkipReasonFor(testFileName: string): string | false {
  if (ACME_AVAILABLE) return false;
  return (
    `${testFileName}'s ACME-dependent tests are skipped -- no real ACME was found at ` +
    `ACME_BIN="${ACME_BIN}". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an ` +
    `absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.`
  );
}
export function assertAcmeRequiredIfEnvSet(assert: ...) {
  if (process.env.VICE_REQUIRE_ACME) {
    assert.ok(ACME_AVAILABLE, `VICE_REQUIRE_ACME is set but no real ACME was found...`);
  }
}
```
Usage site (`disasm-roundtrip.test.ts:57,72,75`):
```typescript
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./anno-test-gate.ts";
const SKIP_REASON: string | false = acmeSkipReasonFor("disasm-roundtrip.test.ts");
// exactly one test always runs, never skipped:
test("ACME availability gate (D-08)", () => {
  assertAcmeRequiredIfEnvSet(assert);
});
```
**Never write a second `command -v acme` check.** Import `ACME_BIN`/`acmeSkipReasonFor`/
`assertAcmeRequiredIfEnvSet` from `anno-test-gate.ts` directly — this is the seam
RESEARCH.md's "Don't Hand-Roll" table names explicitly.

**Core subprocess-spawn pattern** (`disasm-roundtrip.test.ts:93`, argv array, never a shell string):
```typescript
const r = spawnSync(ACME_BIN, ["-f", "plain", "-o", outPath, srcPath], { encoding: "utf8" });
```
Apply the identical discipline to spawning `acme.mjs`/`derive.mjs`: `spawnSync("node", [scriptPath, ...args], { encoding: "utf8" })`, never `spawnSync(\`node ${scriptPath} ${args}\`, { shell: true })`.

**Temp-dir scratch pattern** (`disasm-roundtrip.test.ts` imports `mkdtempSync`/`rmSync` from `node:fs`, `tmpdir` from `node:os`) — use for `acme.mjs new`/`build` output, matching `anno-cli.test.ts`'s `withTempDir()` helper (`anno-cli.test.ts:60+`).

**Error-path convention:** `ok = status === 0 && the output file exists` — never treat stderr content alone as failure (ACME emits legal warnings). Apply the same "check exit status + expected artifact, not stderr" rule when asserting on `acme.mjs build`.

---

### `skill-memory-mapping-cli.test.ts` (test, in-process import + subprocess)

**Analog:** `.claude/mcp/vice/anno-cli.test.ts`

**In-process import pattern** (`anno-cli.test.ts:18-19`):
```typescript
import { runAnnoCli, VERB_OPTIONS } from "./anno-cli.ts";
```
Mirror this for `driver.mjs`'s one exported symbol (`driver.mjs:534`, `export { lookup };`,
guarded so importing does not also run the CLI):
```typescript
import { lookup } from "<relative-path-to>/driver.mjs";
```
Use direct assertions on `lookup()`'s return value for pure address-lookup cases; do **not**
spawn a subprocess for these — the export exists specifically to make this cheap.

**Subprocess pattern for the CLI surface** (`annotate`, which has no export) — reuse the
`spawnSync` + argv-array convention from `disasm-roundtrip.test.ts:93` above, invoking
`driver.mjs annotate --file <fixture>` against the already-committed `memmap.json`. **Never
invoke the `memmap` verb from a test** — it fetches over the network and overwrites a
committed file; RESEARCH.md flags this explicitly.

**Console-capture pattern**, if `annotate` writes to stdout rather than a file
(`anno-cli.test.ts:33-56`, `withCapturedConsole()`):
```typescript
async function withCapturedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const outLines: string[] = [];
  const errLines: string[] = [];
  console.log = (...args: unknown[]) => { outLines.push(args.map(String).join(" ")); };
  console.error = (...args: unknown[]) => { errLines.push(args.map(String).join(" ")); };
  try {
    const result = await fn();
    return { result, stdout: outLines.join("\n"), stderr: errLines.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}
```
Use this only for the in-process `lookup()` path; the CLI-surface (`annotate`) tests should
prefer real subprocess spawning matching the other two new test files, for consistency
(RESEARCH.md's stated preference: "subprocess tests for all three, uniformly").

---

### `skill-program-recon-cli.test.ts` (test, subprocess, pure arithmetic)

**Analog:** `.claude/mcp/vice/anno-cli.test.ts` (structure only — `derive.mjs` needs no
availability gate at all, unlike the other two, since it has no external dependency).

Spawn `derive.mjs vic`/`sprites`/`vectors` with `spawnSync("node", [scriptPath, verb, ...flags], { encoding: "utf8" })` and assert on stdout content directly (VIC bank/mode decode is fully deterministic). For `vectors`, write a synthetic 65536-byte buffer to a temp file first (`mkdtempSync`/`writeFileSync`, same as `disasm-roundtrip.test.ts`'s scratch-file pattern) and pass its path as the CLI argument.

---

### `comment-phase-pointers.test.ts` (test, guard, PKG-03)

**Analog:** `.claude/mcp/vice/docs-dangling-refs.test.ts` — this is the closest possible
match; the new guard should be built by **inverting** this file's own literal extractor, not
by writing a new one.

**Imports pattern** (`docs-dangling-refs.test.ts:29-35`):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
```

**The `ASSIGNMENT_RES` pattern family to extend** (`docs-dangling-refs.test.ts:75-80`, quoted
verbatim — the new guard needs a **broader** version of pattern 2's noun alternation plus a
comma-appositive form, per RESEARCH.md's dry-run-against-137-comments finding):
```typescript
const ASSIGNMENT_RES = Object.freeze([
  /\b(?:moves?|move|moved|deferred|defers?|belongs?|lands?|pushed|punted|reassigned|handed)\b[^.;]{0,80}?\bPhase\s+\d+/i,
  /\bPhase\s+\d+(?:'s|s')\s+[^.;]{0,60}?\b(?:extension|home|scope|deliverable|remit)\b/i,
  /\b(?:home|owner|owned by|covered by|claimed by|lives in)\b[^.;]{0,40}?\bPhase\s+\d+/i,
]);
```
Known real violations these three regexes miss (verified this session, exact wording the
new/extended patterns must catch): `"is Phase 8's business"` (`stock-cia.ts:39`), `"Phase 7,
via the text monitor"` and `"Phase 7's timing route"` (`stock-dispatch.ts:633-634`). Extend
pattern 2's noun list (add `business|job|task|route|timing route`) and add a dedicated
comma-appositive pattern (`/\bPhase\s+\d+\s*,\s*via\b/i`) plus an "is Phase N's" auxiliary
form. **Dry-run the extended set against all 137 existing comment mentions before finalizing**
— this is the single most important verification step per RESEARCH.md.

**The character-state-machine extractor to invert** (`docs-dangling-refs.test.ts:194-294`,
full function — extract COMMENT content instead of STRING/TEMPLATE content; keep the same
skip-strings/skip-templates logic so a phase number inside a string is not double-flagged,
since FLOW-02 already owns that surface):
```typescript
function extractStringLiterals(src: string): string[] {
  const literals: string[] = [];
  const n = src.length;
  let i = 0;
  interface TemplateFrame {
    buf: string;
    inInterp: boolean;
    interpBraceDepth: number;
  }
  const templateStack: TemplateFrame[] = [];
  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;
    if (top && !top.inInterp) {
      if (c === "\\") { top.buf += c + (src[i + 1] ?? ""); i += 2; continue; }
      if (c === "`") { literals.push(top.buf); templateStack.pop(); i++; continue; }
      if (c === "$" && src[i + 1] === "{") { top.inInterp = true; top.interpBraceDepth = 1; i += 2; continue; }
      top.buf += c; i++; continue;
    }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; } // <- INVERT: capture instead of skip
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; } // <- INVERT
    if (c === '"' || c === "'") {
      const quote = c; let buf = ""; i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { buf += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
        buf += src[i]; i++;
      }
      i++; continue; // <- do NOT push to literals[] in the inverted (comment-capturing) version
    }
    if (c === "`") { templateStack.push({ buf: "", inInterp: false, interpBraceDepth: 0 }); i++; continue; }
    if (top && top.inInterp) {
      if (c === "{") { top.interpBraceDepth++; i++; continue; }
      if (c === "}") { top.interpBraceDepth--; i++; if (top.interpBraceDepth === 0) top.inInterp = false; continue; }
    }
    i++;
  }
  return literals;
}
```

**The derived-module-set seam to reuse verbatim, not re-enumerate** (`docs-dangling-refs.test.ts:303-313`):
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

**Test-body pattern to mirror** (`docs-dangling-refs.test.ts:330-340`, FLOW-02's own test —
same shape, comment-scoped instead of literal-scoped):
```typescript
test("no shipped .claude/mcp/vice/ source comment assigns pending/future work to a numbered phase (PKG-03)", () => {
  const hits = danglingPhaseCommentAssignments();
  assert.deepEqual(hits, [], "…" + hits.map((h) => `  ${h.file}: ${h.comment.slice(0, 160)}`).join("\n"));
});
```

**Planted-violation proof, two established options in this repo — recommend both:**
1. **Inline planted-violation test** (cheapest, matches `docs-dangling-refs.test.ts:132-149`'s
   own `.vsf` planted-violation test — feeds the guard's own logic the exact wording that
   survived pre-fix, asserts it's flagged, then asserts the corrected wording is not):
   ```typescript
   test("planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not", () => {
     // exact quoted strings from stock-cia.ts:39 and stock-dispatch.ts:633-634
   });
   ```
   (See `docs-dangling-refs.test.ts:371-407` for the full pattern, including
   `extractStringLiterals(preFixUsage + preFixRefusal).filter(...)`.)
2. **Committed fixture file** (permanent-regression style, matching
   `.claude/mcp/vice/fixtures/planted-review-fixture.md` +
   `docs-review-disposition.test.ts:437-475`):
   ```typescript
   test("fixture-driven: the planted violation shapes are detected", () => {
     const fixturePath = join(HERE, "fixtures", "planted-phase-pointer-fixture.ts");
     const fixtureContent = readFileSync(fixturePath, "utf8");
     // assert scanner flags every planted shape in fixtureContent
   });
   ```
   RESEARCH.md recommends the fixture be `.ts`-shaped text but **not** ending in a name that
   `shippedTsModules()`'s `files[]`-derived scan would pick up (i.e., not added to
   `package.json`'s `files[]`), exactly how `planted-review-fixture.md` sits outside the real
   scan's own glob.

---

### PKG-01 literal-path sweep (config/utility, transform)

**Analog for the merge-logic half:** `wireMcp()`, `installer/bin/cli.mjs:168-201` (quoted
verbatim — reuse, do not reimplement):
```javascript
function wireMcp(target, { force, dryRun, vendor }) {
  const mcpPath = join(target, ".mcp.json");
  let config = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    const parsed = readJson(mcpPath);
    if (parsed === undefined) {
      console.error(`c64-re-tools: FAIL -- ${mcpPath} exists but is not valid JSON. Refusing to overwrite it; fix or remove it and re-run.`);
      process.exit(1);
    }
    config = parsed;
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      console.error(`c64-re-tools: FAIL -- ${mcpPath} is not a JSON object.`);
      process.exit(1);
    }
    if (typeof config.mcpServers !== "object" || config.mcpServers === null) {
      config.mcpServers = {};
    }
  }
  const existed = Object.prototype.hasOwnProperty.call(config.mcpServers, "vice");
  let action;
  if (existed && !force) {
    action = "kept";
  } else {
    action = existed ? "updated" : "added";
    if (!dryRun) {
      config.mcpServers.vice = viceServerEntry(vendor);
      mkdirSync(dirname(mcpPath), { recursive: true });
      writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n");
    }
  }
  return { mcpPath, action };
}
```
Apply this **unmodified** to the npm-installer route. Do not build a second merge for the
plugin route until Open Question 1 (does Claude Code's plugin loader write to the consumer's
`.mcp.json` at all?) is resolved — see RESEARCH.md Pitfall 3.

**CRITICAL — target-depth conflict the planner must resolve before choosing the move
target:** `repo-root.ts`'s own header comment (verified this session, `repo-root.ts` docblock
above `repoRoot()`) states branch 4 assumes exactly **three levels up from `from`**, matching
`<root>/.claude/mcp/<server>/`'s depth. `repo-root.test.ts` (test name: `"repoRoot() last-resort
fallback (quick-260731-p8a, path-anchor regression): climbs THREE levels from a
<root>/.claude/mcp/<server> path, not four"`) pins this with a synthetic directory tree and an
explicit comment:
```
// THIS ASSERTION IS ALSO WHY authored TypeScript stayed FLAT in
// .claude/mcp/vice/ (siblings of resources/) rather than moving into a
// src/ subdirectory during the 01.6.1 conversion: doing so would add a
// FOURTH level and silently break this exact hop count again. A future
// reader proposing that move should read this comment before doing it.
```
RESEARCH.md's proposed target (`src/mcp/vice/`) has 3 path segments identical to
`.claude/mcp/vice/`, so the depth is preserved **only if** the repo root itself does not also
change depth relative to that path — i.e. `src/mcp/vice/` sitting directly under the repo
root (same as `.claude/mcp/vice/` does today) requires zero change to branch 4's literal or
`repo-root.test.ts`'s synthetic pin. **If the planner instead nests under an existing `src/`
that itself sits one level below repo root in some other way, or otherwise changes the hop
count, three things must be updated together: `repoRoot()`'s `resolve(from, "..", "..", "..")`
literal (two call sites, `repo-root.ts`), its doc comment, and `repo-root.test.ts`'s synthetic
test.** Note the *inverse* caution already recorded in `repo-root.test.ts`'s own comment above
— a prior decision explicitly avoided introducing a `src/` subdirectory for exactly this
depth reason. The planner should treat this as a live tension to note explicitly, not silently
resolve either way.

**Structural guard verified to need ZERO change on the move:** `vice-proxy.test.ts:5162-5205`
(quoted above, network-call structural guard) enumerates offenders via
`readdirSync(HERE)`+bare filenames (`broker-launch.mts`, `vice-probe.ts`, `vice.ts`), never a
full path — since the test always lives in the same directory as the files it scans, this
guard is directory-move-safe by construction. **Do not touch this test as part of the PKG-01
sweep**; flag it in the plan as "verify unchanged" rather than "update."

---

### PROJECT.md PKG-04 accepted-risk entry (documentation)

**Analog:** PROJECT.md's Key Decisions table, FORK-01 row (`PROJECT.md:278`, quoted verbatim
above in Sources) — same table, same shape: a **Decision** phrase, inline **Rationale**
naming the specific mechanism and file, a **reverses if** clause naming a concrete future
condition, and a status glyph (`⚠️ Revisit` / `✓ Good`) in the adjacent column. Match this
shape exactly for the new PKG-04 row — RESEARCH.md's draft entry (Decision / Rationale /
Residual risk / Reverses if) should be folded into the FORK-01 row's actual column structure
rather than kept as free-standing prose. Read `PROJECT.md`'s Key Decisions table header row
(the columns immediately preceding line 276) before writing the new row, to match column
count/order exactly.

## Shared Patterns

### ACME availability gating
**Source:** `.claude/mcp/vice/anno-test-gate.ts:114-162` (`ACME_BIN`, `acmeSkipReasonFor`,
`assertAcmeRequiredIfEnvSet`)
**Apply to:** `skill-acme-build-cli.test.ts` (the only one of the three new PKG-02 tests
needing this)
```typescript
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./anno-test-gate.ts";
```

### Subprocess spawning discipline (argv array, never shell string)
**Source:** `disasm-roundtrip.test.ts:93`, `anno-cli.test.ts` (bin-level tests)
**Apply to:** all three PKG-02 test files
```typescript
spawnSync("node", [scriptPath, verb, ...args], { encoding: "utf8" })
```

### `HERE`/`repoRoot()` for locating files outside the test's own directory
**Source:** `docs-dangling-refs.test.ts:31-33`, `repo-root.ts`
**Apply to:** all three PKG-02 test files (locating skill scripts under `src/skills/**`),
`comment-phase-pointers.test.ts` (locating shipped modules via `package.json`'s `files[]`)
```typescript
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
```

### Character-state-machine literal/comment extraction (never a regex extractor)
**Source:** `docs-dangling-refs.test.ts:194-294` (`extractStringLiterals()`)
**Apply to:** `comment-phase-pointers.test.ts` — invert to capture comment spans, not literal
spans. A regex-based extractor was measured in this repo to miss a real violation inside a
template literal; do not reintroduce that failure mode for the comment-scanning side.

### `wireMcp()` merge semantics
**Source:** `installer/bin/cli.mjs:168-201`
**Apply to:** PKG-01's `.mcp.json` consolidation, npm-installer route only (plugin route
pending Open Question 1)

## No Analog Found

None. Every file class named in RESEARCH.md has a direct, cited, HEAD-verified analog in this
codebase — this phase's own research explicitly frames the work as "almost everything already
exists... mostly reuse and sweep" (RESEARCH.md's "Don't Hand-Roll" section), and that framing
held up under verification.

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.test.ts` (all colocated tests), `.claude/mcp/vice/repo-root.ts`, `repo-root.test.ts`, `vice-proxy.test.ts`, `installer/bin/cli.mjs`, `.claude/mcp/vice/fixtures/`, `.planning/PROJECT.md`
**Files scanned:** ~12 read directly this session (`anno-cli.test.ts`, `disasm-roundtrip.test.ts`, `anno-test-gate.ts`, `docs-dangling-refs.test.ts`, `docs-review-disposition.test.ts`, `repo-root.ts`, `repo-root.test.ts`, `vice-proxy.test.ts`, `installer/bin/cli.mjs`, `PROJECT.md`), all citations verified at current HEAD (2026-08-22), matching RESEARCH.md's own citations with two confirmed line-number drifts already noted by RESEARCH.md itself (`stock-dispatch.ts` 614-615 → 633-634)
**Pattern extraction date:** 2026-08-22
