# Phase 29: The MCP Surface - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 21 (7 new modules, 5 new tests, 9 re-pointed guards, 1 registry-driven rename set)
**Analogs found:** 21 / 21 (every new file has a same-role in-repo analog; no file falls back to RESEARCH.md-only patterns)

All line numbers below were read from the working tree this session. Where
`29-CONTEXT.md` cites a different number, RESEARCH.md's "Measured Corrections"
table is authoritative and is repeated here.

---

## File Classification

### Kind 1 — New `anno-*` MCP surface modules

| New file | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/mcp/vice/anno-tools.ts` | tool-definition table + allow-list gate + runner | request-response | `src/mcp/vice/r2000-tools.ts` | exact (the family being replaced) |
| `src/mcp/vice/anno-register.ts` | committed decision register | config/data | `src/mcp/vice/module-classification.ts` | exact (role + enforcing-test shape) |
| `src/mcp/vice/anno-derive.ts` | derivation service (xrefs, search) | transform (never persists) | `src/mcp/vice/stock-vicii.ts` `decodeVicii()` + `disasm-decoder.ts` | role-match |
| `src/mcp/vice/anno-details.ts` | composition service | request-response | `r2000-tools.ts:1121` `composeAddressDetails()` | exact |
| `src/mcp/vice/anno-cli.ts` | CLI (renamed from `r2000-cli.ts`) | batch | `src/mcp/vice/r2000-cli.ts` itself | rename-in-place |
| `scripts/lib/anno-cli-verbs.mjs` | source-parsing seam | transform | `scripts/lib/r2000-cli-verbs.mjs` | exact (carry `stripComments()` verbatim) |
| `scripts/check-no-regenerator2000.mjs` | structural CI gate | file-I/O scan | `scripts/check-skill-fork-honesty.mjs` (walk + exemption + non-vacuity counter) and `scripts/check-npm-packages.mjs` (`packFiles`) | exact, two halves |

### Kind 1b — New tests (Wave 0 gaps)

| New test | Role | Analog | Match |
|---|---|---|---|
| `anno-tools.test.ts` | unit + planted violation | `r2000-verb-coverage.test.ts` planted-violation block | role-match |
| `anno-derivation.test.ts` | manifest-vs-surface guard | `r2000-upstream-audit.test.ts` | exact |
| `anno-register.test.ts` | enumerating registry guard | `module-classification.test.ts` (six named DIRECTIONs) | exact |
| `anno-derive.test.ts` | never-cached control | `anno-seam.test.ts` (four planted access routes) | role-match |
| `anno-verb-coverage.test.ts` | CLI-verb coverage guard | `r2000-verb-coverage.test.ts` | exact (port) |

### Kind 2 — Re-pointed structural guards (edits to existing files, not new files)

| File | Edit site | Current value |
|---|---|---|
| `src/mcp/vice/hostpath-consumers.test.ts` | `:180-182`, `:188`, `:199-206` | `r2000ProductionModules()` regex, `R2000_MODULE_FLOOR = 14`, 4-name positive control |
| `src/mcp/vice/stock-dispatch.test.ts` | `:1505`, `:1507-1517`, `:1519-1531`, `:1547`, `:1549-1562`, `:1564-1575` | ordered `BACKEND_SEAM_BYPASS_KEYS`, body-slice, manifest-absence loop |
| `scripts/generate-tool-support-table.mjs` | `:95` (prose), `:107` (regex) | `R2000_LOOP_VAR_RE` |
| `src/mcp/vice/tool-support-table.test.mjs` | `:66` | duplicate witness 1 |
| `src/mcp/vice/capability-registry.test.ts` | `:154` (stale "17"), `:161` | duplicate witness 2 |
| `scripts/check-skill-tool-coverage.mjs` | `:445-448`, `:464-471` | `extractedR2000.size >= 10` (measured 17), CLI-verb floor use |
| `scripts/check-skill-fork-honesty.mjs` | `:500-504` | `"r2000 export-asm"` positive pointer |
| `scripts/audit-gate.mjs` | `:109`, `:129-137` | `DOCS_GUARD_FLOOR = 7`, `EXPECTED_DOCS_GUARD_NAMES` |
| `src/mcp/vice/docs-r2000-decisions.test.ts` | `:48` | `GUARD_FILENAMES` naming a deleted file |
| `src/mcp/vice/r2000-upstream-audit.test.ts` | whole file | manifest guard; re-point, never delete |
| `src/mcp/vice/r2000-verb-coverage.test.ts` | `:142-175` | `assert.equal(verbs.length, 8)`, `export-asm` |
| `src/mcp/vice/package.json` | `files[]` `:56-71` | 16 `r2000` entries |

### Kind 3 — Registry-driven renames

Driven by `src/mcp/vice/module-classification.ts` — the entry, never the prefix.
RESEARCH F-3 narrows D-03's eleven to **nine** on the authority of two entries'
own `note` fields (`r2000-test-gate.ts` `:475-490`, `r2000-verify.ts` `:516-524`).

---

## Pattern Assignments

### `src/mcp/vice/anno-tools.ts` (tool table + gate + runner)

**Analog:** `src/mcp/vice/r2000-tools.ts` — read it before it is deleted.

**Header-comment convention** (`r2000-tools.ts:1-9` — every new module needs this
three-part shape: what it is the ONE place for / WHY it exists / what not to do):

```ts
#!/usr/bin/env node
// r2000-tools.ts -- the ONE authoritative place in this repo for the curated
// r2000_* tool surface: which 19 curated regenerator2000 MCP tools (of the
// 28 upstream offers) this project advertises, the allow-list gate
// (including its D-33 batch recursion), project-path validation, and the
// runner ...
```
and `:52-60`:
```
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the 19 curated
// `ToolDefinition`s (`R2000_TOOL_DEFINITIONS`), the allow-list
// (`CURATED_R2000_TOOLS`) and its enforcement (`assertCuratedTool()`,
// including the batch-recursion gate) ... No other module may hand-list
// a curated tool name ...
```
`anno-store.ts:1-6` is the other model of the same convention ("The ONE module in
this repo that names `node:sqlite`").

**Wire-shape declarations** (`r2000-tools.ts:110-140`) — copy verbatim with
identifiers substituted; the index signature is load-bearing for `buildViceTool()`:

```ts
export interface R2000ToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  // Structural compatibility with vice.ts's own ToolInfo (vice-proxy.ts's
  // ToolDefinition alias) ... lets buildViceTool() accept it directly.
  [key: string]: unknown;
}

interface ToolCallResult { content: { type: "text"; text: string }[]; isError: boolean; }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function okText(text: string): ToolCallResult { return { content: [{ type: "text", text }], isError: false }; }
```

**Allow-list gate** (`r2000-tools.ts:854-874`) — set membership is the FIRST check;
the throw text names both resolution routes:

```ts
export function assertCuratedTool(name: string, args?: unknown): void {
  if (!CURATED_R2000_TOOLS.includes(name)) {
    throw new R2000UncuratedToolError(
      `"${name}" is not part of the curated r2000_* tool surface. Resolution routes: implement it and ` +
        "add it to R2000_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
      { toolName: name },
    );
  }
  if (name === "r2000_set_label_name") { assertLegalLabelArg(args); }
  if (name === "r2000_read_region")    { assertReadRegionArgs(args); }
  if (name === "r2000_batch_execute")  { assertCuratedBatch(args); }
}
```

**D-33 batch recursion** (`r2000-tools.ts:801-838`) — this is the shape the batch
verb must carry; note refuse-WHOLE, malformed-is-refusal-not-empty, and the
self-recursion for a nested batch:

```ts
function assertCuratedBatch(args: unknown): void {
  if (!isPlainObject(args) || !Array.isArray(args.calls)) {
    throw new R2000UncuratedToolError(
      "r2000_batch_execute refused: \"calls\" must be an array of {name, arguments} objects -- a " +
        "malformed batch payload is treated as a refusal, never as an empty batch that passes through.",
      { toolName: "r2000_batch_execute" },
    );
  }
  const calls = args.calls as unknown[];
  calls.forEach((call, i) => {
    if (!isPlainObject(call) || typeof call.name !== "string") {
      throw new R2000UncuratedToolError(
        `r2000_batch_execute refused WHOLE: calls[${i}] is malformed (missing a string "name") -- ` +
          "treated as a refusal, never as an empty batch that passes through.",
        { toolName: "r2000_batch_execute", batchIndex: i },
      );
    }
    if (!CURATED_R2000_TOOLS.includes(call.name)) {
      throw new R2000UncuratedToolError(
        `r2000_batch_execute refused WHOLE: calls[${i}].name "${call.name}" is outside the curated ` +
          "r2000_* tool surface -- a batch is refused whole if any inner name is outside the curated set (D-33).",
        { toolName: call.name, batchIndex: i },
      );
    }
    if (call.name === "r2000_set_label_name") { assertLegalLabelArg(call.arguments, i); }
    if (call.name === "r2000_read_region")    { assertReadRegionArgs(call.arguments, i); }
    if (call.name === "r2000_batch_execute")  { assertCuratedBatch(call.arguments); }
  });
}
```
Its doc block at `:790-800` is the shared-validator discipline to carry: the same
per-argument validator is called from BOTH the outer gate and the batch-inner
loop, "so the refusal fires identically whether ... called directly or smuggled
inside a batch payload".

**Runner + error-to-result conversion** (`r2000-tools.ts:1159-1213`) — copy the
try/catch and the `errText` wording verbatim; note WR-02 is recorded in the
analog at `:772-774` (the gate sits OUTSIDE the `try`, so a refusal rejects the
promise). RESEARCH Pattern 2 moves `assertAnnoTool` INSIDE the `try` to close it:

```ts
export async function runR2000Tool(name: string, args: unknown): Promise<ToolCallResult> {
  assertCuratedTool(name, args);
  const projectPath = resolveStorePath(isPlainObject(args) ? args.project : undefined);
  ...
  } catch (err) {
    // Named by class (D18-12: a mid-window crash must surface a named,
    // distinguishable error, never a silent success)
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = err instanceof Error ? err.message : String(err);
    return errText(`${name} failed: [${errName}] ${errMessage}`);
  }
}
```

**Documented cap pattern, read-at-call-time** (`r2000-tools.ts:207-224`) — the
model for `anno_read_region` / `anno_disassemble` size limits:

```ts
export const R2000_READ_REGION_MAX_BYTES = 4096;
function currentReadRegionMaxBytes(): number {
  const raw = process.env.R2000_READ_REGION_MAX_BYTES;
  if (raw === undefined) return R2000_READ_REGION_MAX_BYTES;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : R2000_READ_REGION_MAX_BYTES;
}
```

**Store open/close** — the D-06 `finally` uses these exact signatures
(`anno-store.ts:413-416`, `:550-552`):

```ts
export function openStore(
  path: string,
  opts: { workspaceRoot?: string; mustExist?: boolean; unconfinedModuleDerivedPath?: boolean } = {},
): AnnoStoreHandle
/** Closes the connection. Safe to call once per handle. */
export function closeStore(handle: AnnoStoreHandle): void { handle.db.close(); }
```

**Error family** — every refusal must be an `AnnoStoreError` subclass
(`anno-types.ts:477`, which itself extends `ViceError`). Existing members at
`:492, 510, 556, 576, 595, 635, 664, 682, 718, 748, 791`. Any new MCP-layer
refusal class extends `AnnoStoreError`, never bare `Error`.

---

### `src/mcp/vice/anno-details.ts` (composition service)

**Analog:** `r2000-tools.ts:1113-1136` `composeAddressDetails()`. Copy the
composed-from disclosure shape; the store reads replace the `call()` reads:

```ts
export async function composeAddressDetails(call: R2000Call, address: number): Promise<unknown> {
  const symbols = await callJson(call, "r2000_get_symbols", { start_address: address, end_address: address });
  const comments = await callJson(call, "r2000_get_comments", { addresses: [address] });
  const allBlocks = (await callJson(call, "r2000_get_blocks", {})) as R2000Block[];
  const block = allBlocks.find((b) => address >= b.start_address && address <= b.end_address) ?? null;
  const crossReferences = await callJson(call, "r2000_get_cross_references", { address });
  return {
    address, symbols, comments, block, cross_references: crossReferences,
    composed_client_side: true,
    composed_from: ["r2000_get_symbols", "r2000_get_comments", "r2000_get_blocks", "r2000_get_cross_references"],
  };
}
```
Its doc block at `:1113-1120` is the "unreachable by construction, not merely
avoided by a heuristic" wording to carry forward.

---

### `src/mcp/vice/anno-derive.ts` (derived xrefs + search)

**Analog A — per-verb handler shape:** `stock-vicii.ts:275-297` (`handleViciiGetState`).
Argument-shape refusals come first, each naming the tool and the offending value:

```ts
export const handleViciiGetState: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_vicii_get_state: arguments must be an object");
  }
  const unexpected = Object.keys(args);
  if (unexpected.length > 0) {
    return isErrorText(`vice_vicii_get_state: unexpected argument(s): ${unexpected.join(", ")} -- this tool takes no arguments`);
  }
  ...
```

**Analog B — the "not available, by name" body:** `stock-cia.ts:494-497` plus the
type at `stock-recycle.ts:86` / `vice-proxy.ts:1461`:

```ts
type CaptureStepResult<T> = { available: true; value: T } | { available: false; reason: string };

const unavailable: Record<string, { available: false; reason: string }> = {};
for (const [name, reason] of CIA_UNAVAILABLE_FIELDS) {
  unavailable[name] = { available: false, reason };
}
```
The frozen `[name, reason]` pair table is `stock-vicii.ts:98`
(`VICII_UNAVAILABLE_FIELDS`) — copy that shape for any `anno_*` verb that must
refuse by name rather than return a plausible zero.

**Analog C — decode + derive:** `stock-vicii.ts:141` `decodeVicii(bytes)` is the
pure-transform half; `disasm-decoder.ts:61-82`'s `Instruction`/`DecodedOperand` is
the input. The header at `stock-vicii.ts:1-15` shows how a derived module states
its DERIVED-ness and its unavailability constraint up front.

---

### `src/mcp/vice/anno-register.ts` (D-08's second committed register)

**Analog:** `src/mcp/vice/module-classification.ts`.

**Entry shape** (`:200-251`) — note `note?` is a first-class field and the registry
exists to be read for it (F-3 rests entirely on two `note`s):

```ts
export interface ModuleConsumer { path: string; symbol: string; line?: number; }
export interface ModuleBasis {
  consumers: readonly ModuleConsumer[];
  requirements: readonly string[];
  rationale: string;
}
export interface ModuleClassificationEntry {
  module: string;
  scope: ModuleScope;
  verdict: ModuleVerdict;
  basis: ModuleBasis;
  extractables: readonly string[];
  note?: string;
}
export const MODULE_CLASSIFICATION: readonly ModuleClassificationEntry[] = [ ... ];
```

**Citation discipline** (`module-classification.ts:184-199`), the rule the new
register must restate:
> `path` is ALWAYS repository-root-relative ... `symbol` names what the consumer
> actually takes from the module ... It is a CITATION, never a justification.
> `line` is OPTIONAL AND ADVISORY. Where present, the enforcing test asserts that
> line of that file contains `symbol`; it never trusts the number. Omit it rather
> than guess.

**A filled entry to copy** (`:254-277`, `r2000-acme-ident.ts`) shows a
`requirements: ["EXPORT-01", "EXPORT-03"]` basis carrying the weight when the
measured consumers do not survive — exactly the situation `anno_search`
(`STORE-06`) and `anno_remove_scope` (F-5) are in.

**Enforcing-test analog:** `module-classification.test.ts` — six named DIRECTIONs
(`:288` non-vacuity DERIVED not pinned, `:314` completeness names the offender,
`:323` no orphans, `:332` full-filename matching) and, at `:11-14`, the rule that
the planted-violation test shares the predicate with the real scan.

---

### `scripts/lib/anno-cli-verbs.mjs` (replaces the deleted verb parser)

**Analog:** `scripts/lib/r2000-cli-verbs.mjs`. Carry `stripComments()` verbatim
(`:47-60`) and its rationale:
> A single-pass character scanner, not a regex -- this repo's own
> `docs-dangling-refs.test.ts` measured a regex-alternation extractor silently
> missing a literal at the exact site a real defect lived, so ... a commented-out
> `case "ghost-verb":` must never be mistaken for a real one.

**Floor convention** (`:31-44`) — and the honesty rule the plan must state, since
the replacement floor is 5 where the old one was 8:
```js
export const R2000_CLI_VERB_FLOOR = 8;
```
> A future phase that adds a 9th verb ... must raise this floor to the new true
> count when it lands -- never lower it to make a regression pass.

**Placement rule** (`:25-30`): `scripts/lib/` on purpose — no runtime role, so it
stays OUT of `src/mcp/vice/package.json`'s `files[]` while staying git-tracked for
`scripts/package.sh`'s `git archive`.

---

### `scripts/check-no-regenerator2000.mjs` (new structural CI gate)

**Analog A — walk + exemption + non-vacuity counter:**
`scripts/check-skill-fork-honesty.mjs:421-495`. This is the whole template:

```js
const DISASM_LINE_EXEMPTION = 'evidence: "disasm"';
let exemptionHits = 0;

for (const f of skillFiles) {
  const rel = f.slice(ROOT.length + 1);
  const lines = readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("toacme")) {
      need(false, `${rel}:${i + 1}: "toacme" reappeared -- ...`);
    }
    if (isStandaloneDisasmToken(line)) {
      if (line.includes(DISASM_LINE_EXEMPTION)) { exemptionHits++; continue; }
      need(false, `${rel}:${i + 1}: a bare "disasm" verb token reappeared -- ...`);
    }
  }
}

need(
  exemptionHits === 1,
  `WR-03 non-vacuity: expected the "${DISASM_LINE_EXEMPTION}" exemption to fire exactly once ... got ${exemptionHits} -- a second occurrence means the exemption is being used to hide a reintroduction rather than covering the one pinned, harmless string.`
);
```
Two rules from its header (`:430-449`) the new gate must obey: (a) the
unconditional checks run BEFORE the exemption is consulted — WR-03 was a line
whose exemption substring short-circuited all three checks; (b) the exemption is
**line/block scoped and shape-matched**, never a substring, and its hit count is
asserted exact.

**Analog B — the shipped-file half of the scope predicate:**
`scripts/check-npm-packages.mjs:140-152` — reuse `packFiles`, do not
re-implement, and note `assertLeanTarball`'s per-class filters as the model for
per-class reporting:

```js
function packFiles(dir) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const packed = { name: entry.name, version: entry.version, files: (entry.files ?? []).map((f) => f.path) };
  assertLeanTarball(packed);
  packedNames.push(packed.name);
  return packed;
}
```

**Analog C — the planted-violation proof.** Two conventions exist; both are valid,
pick per file:
1. **Inline fixture constant** — `r2000-verb-coverage.test.ts:157-171`. The gate's
   predicate is called against a synthetic source string; the real corpus is used
   as the negative control in the same test, plus a self-non-vacuity check:
```ts
test("planted violation: an 8th, genuinely new case is parsed and reported missing, while a real, documented verb is not", () => {
  const verbs = parseR2000CliVerbs(PLANTED_VIOLATION_SRC);
  assert.equal(verbs.length, 8);
  assert.ok(verbs.includes("ghost-verb"), "the planted 8th case must be parsed as a verb");
  const missing = verbsMissingFromSkills(verbs, realSkillTexts());
  assert.ok(missing.includes("ghost-verb"), "the guard must fire on a new, undocumented verb");
  assert.ok(!missing.includes("export-asm"), "the guard must NOT fire on a verb that is genuinely documented");
  const stubbedAlwaysEmpty = () => [] as string[];
  assert.notDeepEqual(stubbedAlwaysEmpty(), missing);
});
```
   Note the sibling at `:173-176` — "a case hidden in a block comment or a line
   comment is never parsed as a verb" — which is `stripComments()`'s own control
   and must be ported with the parser.
2. **Committed fixture file** — `src/mcp/vice/fixtures/planted-*.ts.txt` /
   `planted-*.md` (`planted-hop-chain-fixture.ts.txt`,
   `planted-phase-pointer-fixture.ts.txt`, `planted-disposition-fixture.md`,
   `planted-review-fixture.md`). Use `.ts.txt` so the planted violation is not
   itself scanned by the real gate.
3. **Multi-route planted set** — `anno-seam.test.ts:139-150` plants all four
   access routes through the same predicate the real scan uses. Use this if the
   grep gate has more than one evasion route (`.md` vs `.ts` vs packed file).

---

### `src/mcp/vice/anno-derivation.test.ts` (MCP-01 manifest check)

**Analog:** `src/mcp/vice/r2000-upstream-audit.test.ts` — re-point, never delete.

Its header `:1-31` is the model for stating a mechanical guard's three
invariants, and carries the two prohibitions the new test inherits:
> - Do not loosen the commit regex back to `/^[0-9a-f]{7,40}$/` ...
> - Do not let an ABSENT upstream clone read as agreement. The live-gated
>   re-hash check below SKIPs by default ... and hard-FAILs under the opt-in
>   `VICE_REQUIRE_R2000_UPSTREAM` env var. A silent pass on a missing oracle is
>   the defect class D-11 exists to close; do not reintroduce it here.

Load-bearing constants to reuse: `MANIFEST_PATH` `:44-47`,
`KNOWN_DISPOSITIONS = ["curated", "omit", "adapt-to-address-input"]` `:53`.
Existing tests at `:79`, `:96`, `:156`, `:177`, `:187`.

---

## Kind 2 — Re-pointed guards: exact before-excerpts

### `hostpath-consumers.test.ts`

Disk-derivation helper (`:175-182`) — the doc comment names INT-01 and the reuse
rule; keep both, swap only the regex:
```ts
/** The r2000 production module family, derived from disk rather than typed
 * (INT-01/D-11.1-03) ... This is the SAME `readdirSync`-based helper the
 * five-member EXPECTED_IMPORTERS test above uses -- reused, not a second
 * directory walk -- filtered down to the r2000 name pattern. */
function r2000ProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^r2000-.*\.ts$/.test(name));
}
```
Floor (`:183-188`):
```ts
// Measured true count as of this phase (11.1-03, 2026-08-21): 14 production
// r2000-*.ts modules on disk. This floor must be RAISED, never lowered ...
const R2000_MODULE_FLOOR = 14;
```
Positive control (`:198-206`):
```ts
test("INT-01's positive control: the four modules the audit found uncovered are present in the derived r2000 set", () => {
  const modules = r2000ProductionModules();
  for (const name of ["r2000-acme-ident.ts", "r2000-regbits-gen.ts", "r2000-symbols.ts", "r2000-test-gate.ts"]) {
    assert.ok(modules.includes(name), `${name} (named by INT-01 as uncovered) must be present in the derived r2000 module set`);
  }
});
```
Untouchable (`:144-149`) — `MCP-02`'s "no new module imports hostpath.ts" IS this
assertion; it must stay at exactly five:
```ts
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];
test("hostpath.ts's production consumer set is exactly the five declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 5);
});
```

### `stock-dispatch.test.ts` — four sites, ordered

`:1499-1505` (rename entry 2 in place; the comment's "spawned child process"
rationale must be rewritten to "a proxy-local store, never VICE"):
```ts
/** The two registration keys permitted to bypass buildBackendAwareTool()
 * entirely (plan 11-05 Task 2): RESULT_CONTINUE_TOOL.name ... and
 * r2000Def.name ... */
const BACKEND_SEAM_BYPASS_KEYS = ["RESULT_CONTINUE_TOOL.name", "r2000Def.name"];
```
`:1519-1531` — the order-sensitive half:
```ts
const bypassing = registrations.filter(([, rhs]) => !rhs.includes("buildBackendAwareTool(")).map(([key]) => key);
assert.deepEqual(bypassing, BACKEND_SEAM_BYPASS_KEYS,
  "exactly two registrations may bypass the backend-aware seam: ...");
```
`:1547-1562` — the body-slice assertion `MCP-02` names, plus the file read that
must move with the module:
```ts
const R2000_TOOLS_SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "r2000-tools.ts"), "utf8");
...
  const start = R2000_TOOLS_SOURCE.indexOf("export async function runR2000Tool(");
  assert.ok(start > 0, "runR2000Tool() must still exist in r2000-tools.ts");
  const body = R2000_TOOLS_SOURCE.slice(start, R2000_TOOLS_SOURCE.indexOf("\n}", start));
  for (const forbidden of ["forwardToVice", "ensureViceSession", "rewriteArguments"]) {
    assert.ok(!body.includes(forbidden), `runR2000Tool() must not reach ${forbidden} -- that is what makes the r2000_* family's backend-independence sound`);
  }
```
Its sibling at `:1533-1546` (`handleResultContinue`) is the second, independent
instance of the same shape — the pattern to imitate, not to share a helper with.
`:1564-1575` — `MCP-03`'s "neither manifest gains an entry" half, iterating
`CURATED_R2000_TOOLS` with its own non-vacuity guard
(`assert.ok(CURATED_R2000_TOOLS.length > 0, ...)`).

### `generate-tool-support-table.mjs:104` → actually `:107`

```js
export function discoverSyntheticToolNames(proxySource) {
  const REGISTRATION_RE = /tools\[(\w+)\.name\]\s*=/g;
  const LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+manifestTools\s*\)/;
  const R2000_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+R2000_TOOL_DEFINITIONS\s*\)/;
  ...
    if (ident === r2000LoopVar) continue; // the r2000_* family's own loop registration -- not a VICE capability at all
```
Prose naming the array is at `:93-102`. The three-witness prohibition is stated
in-line at `:133-141`:
> This bounding expression is independently written in three places (here,
> tool-support-table.test.mjs, capability-registry.test.ts) BY DESIGN ... Do not
> "helpfully" extract a shared bounding helper; that would collapse three
> independent witnesses into one and destroy the property.

Duplicate witnesses: `tool-support-table.test.mjs:66`,
`capability-registry.test.ts:161` (and its stale `"an array of 17"` comment at
`:154` — measured 19).

### `check-skill-tool-coverage.mjs`

Tool-name floor (`:445-448`) with its raise-never-lower comment at `:436-444`:
```js
need(
  extractedR2000.size >= 10,
  `non-vacuity: expected at least 10 distinct r2000_* names extracted from src/skills/, got ${extractedR2000.size} -- the extraction regex or plan 11-12's skill edits may have regressed`
);
```
CLI-verb section (`:459-471`) — the "fourth, independent section" comment
explains why the two surfaces are not merged; keep that framing:
```js
const r2000CliSrc = readFileSync(join(VICE_DIR, "r2000-cli.ts"), "utf8");
const r2000CliVerbs = parseR2000CliVerbs(r2000CliSrc);
need(
  r2000CliVerbs.length >= R2000_CLI_VERB_FLOOR,
  `non-vacuity: expected at least ${R2000_CLI_VERB_FLOOR} r2000 CLI verbs parsed from r2000-cli.ts's dispatch switch, got ${r2000CliVerbs.length} -- the parser or the switch statement itself may be broken`
);
```
Also `:450-456`: the `render-memmap` generated-artifact non-vacuity need — survives
unchanged (D-24), do not re-point it by accident.

### `check-skill-fork-honesty.mjs:497-505` (D-10)

```js
// Positive check: the replacement pointer must still exist (D-12) -- the
// deletion must not be "fixed" by deleting the pointer to the proven route too.
const ACME_BUILD_SKILL_PATH = join(SKILLS_DIR, "acme-build", "SKILL.md");
const acmeBuildSkillSource = readFileSync(ACME_BUILD_SKILL_PATH, "utf8");
need(
  acmeBuildSkillSource.includes("r2000 export-asm"),
  `${ACME_BUILD_SKILL_PATH.slice(ROOT.length + 1)} is missing the replacement pointer string "r2000 export-asm" -- ` +
    `the deletion must not be "fixed" by deleting the pointer to the proven route too.`
);
```

### `audit-gate.mjs` (D-12, one commit with `docs-r2000-decisions.test.ts`)

`:109` `export const DOCS_GUARD_FLOOR = 7;` and `:129-137`:
```js
export const EXPECTED_DOCS_GUARD_NAMES = Object.freeze([
  "docs-linerefs.test.ts", "docs-dangling-refs.test.ts", "docs-deferred-ledger.test.ts",
  "docs-review-disposition.test.ts", "docs-fork-decision.test.ts",
  "docs-core-value-decision.test.ts", "docs-r2000-decisions.test.ts",
]);
```
CR-02's recorded failure at `:117-128` is the exact hazard this edit re-runs: the
array was frozen through two guard additions and a deletion left
`checkAuditGate()` reporting `allowed: true, structuralErrors: []`. The
cross-check that now catches it lives in `audit-integrity.test.ts` ("the runtime
registry names every guard the disk-derived set carries") and must be re-run.

### `docs-r2000-decisions.test.ts:48`

```ts
/** Named, non-empty set of guard filenames the Architecture Change Record's
 * step 5 must name. Its own length is asserted non-zero in test 1 ... */
const GUARD_FILENAMES: readonly string[] = ["r2000-session.test.ts", "r2000-spawn-seam.test.ts"];
```
`r2000-session.test.ts` is deleted, so this re-points or the guard reds on its own
content. Its header `:16-21` also records why the file is deliberately kept OUT of
`package.json` `files[]` — carry that if the file is renamed.

### `r2000-verb-coverage.test.ts:142-176`

```ts
test("real-source parse: r2000-cli.ts's dispatch switch yields exactly the 8 known verbs, never 'default'", () => {
  const src = readFileSync(join(HERE, "r2000-cli.ts"), "utf8");
  const verbs = parseR2000CliVerbs(src);
  assert.deepEqual(verbs, [...REAL_VERBS].sort());
  assert.ok(!verbs.includes("default"), "the switch's own default: branch must never be parsed as a verb");
});
```
plus the planted-violation and comment-hygiene tests quoted above.

---

## Kind 3 — Renames: the driving registry

**Source of the work-list:** `module-classification.ts` entries, never a prefix
sweep. Two entries' `note` fields (`:475-490` `r2000-test-gate.ts`, `:516-524`
`r2000-verify.ts`) both say in their own words *"Do NOT read this verdict as a
claim that the module survives a prefix deletion"* / *"do not read this verdict as
a claim that the route survives"* — so the rename set is 9, not 11, and those two
are deleted. Every rename must also update the `module` field and the
`basis.consumers[].path`/`line` citations, which `module-classification.test.ts`
DIRECTION 1/2 assert against disk.

---

## Shared Patterns

### Header comments (apply to every new module and test)
**Sources:** `r2000-tools.ts:1-9,52-60`; `anno-store.ts:1-17`;
`docs-r2000-decisions.test.ts:1-21`; `scripts/lib/r2000-cli-verbs.mjs:1-30`;
`stock-vicii.ts:1-15`.
Three required parts, in this order: (1) what this file is the ONE authoritative
place for; (2) WHY IT EXISTS, naming the dated incident/finding id; (3) WHAT NOT
TO DO, naming the specific past mistake (WR-03, INT-01, CR-02, WR-08, D-33).

### Disk-derived sets with a floor that only rises
**Sources:** `hostpath-consumers.test.ts:175-196`;
`check-skill-tool-coverage.mjs:436-448`; `scripts/lib/r2000-cli-verbs.mjs:31-44`;
`audit-gate.mjs:100-109`.
**Apply to:** the `anno-` module floor, the `anno_*` skill-name floor, the new CLI
verb floor. Never a hand-typed array; always a paired positive control naming real
filenames.

### Refuse by name, never a plausible zero
**Sources:** `stock-cia.ts:494-497`; `stock-vicii.ts:98`, `:275-283`;
`vice-proxy.ts:1458-1461`; `stock-recycle.ts:86`.
**Apply to:** every `anno_*` verb with an unsupported/ambiguous input, and
specifically `anno_apply_enum_usage` if RESEARCH F-1 option (c) is taken.

### Errors are named subclasses carrying the offending value
**Sources:** `anno-types.ts:477` (`AnnoStoreError extends ViceError`) and its 11
subclasses; `r2000-tools.ts:854-861` for the message shape ("Resolution routes:
... or remove the caller reference").
**Apply to:** every refusal in `anno-tools.ts` / `anno-derive.ts` / `anno-cli.ts`.

### Planted violation observed red, then reverted
**Sources:** `r2000-verb-coverage.test.ts:157-176`; `anno-seam.test.ts:139-150`;
`module-classification.test.ts:11-14` (the predicate-sharing rule);
`src/mcp/vice/fixtures/planted-*`.
**Apply to:** `scripts/check-no-regenerator2000.mjs` (before the deletion commit),
`anno-register.test.ts`, `anno-derive.test.ts`'s never-cached control.

### Independent witnesses are never collapsed into a helper
**Sources:** `generate-tool-support-table.mjs:133-141`;
`tool-support-table.test.mjs:60-88`; `capability-registry.test.ts:155-174`.
**Apply to:** all three `ANNO_TOOL_DEFINITIONS` re-points, in one commit, each
keeping its own bounding technique.

---

## No Analog Found

None. Every file in this phase's set has a same-role in-repo analog. The two
weakest matches, flagged for the planner:

| File | Role | Data Flow | Weakness |
|---|---|---|---|
| `anno-derive.ts` | derivation service | transform | No existing module derives xrefs or searches a decode corpus; the analogs supply the *shape* (`decodeVicii`, `handleViciiGetState`, `Instruction`) but not the algorithm. RESEARCH `## STORE-06` supplies the algorithm. |
| `scripts/check-no-regenerator2000.mjs` | CI gate | file-I/O scan | No existing gate spans `git ls-files` ∪ packed files; it is a union of two analogs (`check-skill-fork-honesty.mjs`'s walk, `check-npm-packages.mjs`'s `packFiles`), not a copy of one. |

---

## Metadata

**Analog search scope:** `src/mcp/vice/`, `src/mcp/vice/fixtures/`, `scripts/`,
`scripts/lib/`
**Files read this session:** 18 (targeted ranges; no full reads of files > 2,000 lines)
**Pattern extraction date:** 2026-08-29
