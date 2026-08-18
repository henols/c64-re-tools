# Phase 8: Capability Honesty and the Install Story - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 13 (7 new, 6 modified/possibly-modified)
**Analogs found:** 13 / 13 (one entry — the generated support-table doc — has no *doc-shaped* analog and is flagged below)

**Drift check performed against current source (per CLAUDE.md's drift-tolerance note):** all `vice-proxy.ts`/`vice.ts`/`stock-dispatch.ts` line numbers below were re-read this session and match RESEARCH.md almost exactly, with two confirmed drifts noted inline (`FORK_ONLY_UNRECOVERABLE` moved from research's cited 141-159 to actual 171-184; `package.json`'s `"test"` script moved from research's cited line 58 to actual line 90). Treat both as drift, not as a research error to relitigate — the *content* research cited is unchanged, only the line numbers moved (the file grew).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.claude/mcp/vice/capability-registry.ts` (NEW) | utility (data + message-rendering module) | request-response (lookup, no I/O) | `.claude/mcp/vice/vice.ts` — `DENY_LIST` + `denyListRefusalMessage()` (lines 201-243) | exact |
| `.claude/mcp/vice/capability-registry.test.ts` (NEW) | test | request-response (unit) | no single direct analog; closest shape is any small pure-function unit test file in the same dir (e.g. `hostpath.test.ts`/`containerpath.test.ts`) — style only, not structure | role-match |
| `scripts/generate-tool-support-table.mjs` (NEW) | utility (repo-root generator script) | batch / transform (read 2 JSON manifests + registry → 1 markdown file) | `scripts/check-skill-tool-coverage.mjs` (classification/extraction code) for the *data* shape; `.claude/mcp/vice/build.ts` for the *generate-a-committed-artifact* discipline | role-match (coverage script) / exact (build discipline) |
| `.claude/mcp/vice/tool-support-table.test.ts` (NEW) | test (drift guard) | batch / transform (generate-into-scratch, byte-diff) | `.claude/mcp/vice/resources-sync.test.ts` (full file, 127 lines) | exact |
| `scripts/check-skill-fork-honesty.mjs` (NEW) | utility (repo-root lint script, CI-wired) | batch (walk `.claude/skills/`, regex-extract, proximity-assert) | `scripts/check-skill-tool-coverage.mjs` (full file, 348 lines) | exact |
| Generated per-backend support-table doc (path: planner's call, e.g. `docs/tool-support.md`) | config/doc (generated, committed artifact) | batch output | **No doc-shaped analog exists.** Closest structural analog is `resources/*.mjs` (generated-but-committed, per `resources-sync.test.ts`) — but that's compiled code, not markdown. Every existing file under `docs/` (`stock-vice-parity.md`, `phase0-binmon-findings.md`, etc.) is hand-written prose, never generated. This will be the *first* generated markdown file in the repo. | no analog (see "No Analog Found") |
| `.claude/mcp/vice/vice-proxy.ts` (MODIFY — `CallToolRequestSchema` override) | controller (MCP tools/call dispatch) | request-response | itself — the surrounding `DENY_LIST` check immediately above the edit site (same file, lines 3227-3232) is the pattern to extend, not a different file | exact (self-referential) |
| `.claude/mcp/vice/vice-proxy.test.ts` (MODIFY — new refusal test + backend-mismatch unit test) | test (integration + unit) | request-response | itself — `startProxy()`/`handshake()` harness (lines 268-324, 2100-2105) and the existing `tools_call`-nested-refusal test (lines 5174-5222) in the same file | exact (self-referential) |
| `README.md` (MODIFY — new "Backend and VICE install" section) | config/doc (user-facing install prose) | request-response (docs, no data flow) | itself — the existing `## Install` section (lines 19-60) is the structural analog for a new sibling `##` section; the stale ghost-reference at lines 123-126 is adjacent and in-scope for a drive-by fix | exact (self-referential) |
| `.claude/skills/c64-program-recon/SKILL.md` + `references/sound-and-input.md` + `references/observation-hazards.md` (MODIFY) | doc (skill playbook prose) | request-response | itself — `observation-hazards.md:88`'s already-correct `vice_sid_get_state` annotation ("is **fork-only**, since SID `$D400-$D418` is write-only…") is the exact wording pattern the four gap sites should match | exact (self-referential) |
| `.claude/skills/c64-ram-capture/SKILL.md` (MODIFY) | doc (skill playbook prose) | request-response | same as above — copy the annotation *shape*, not the exact sentence, from `observation-hazards.md:88` | exact (cross-skill) |
| `.github/workflows/ci.yml` (MODIFY — new lint step) | config (CI workflow) | batch | itself — the existing `check-skill-tool-coverage.mjs` step (lines 84-89) and `check-npm-packages.mjs` step (lines 81-82) are the two steps to sit beside | exact (self-referential) |
| `scripts/check-skill-tool-coverage.mjs` (POSSIBLY MODIFY — consolidate `FORK_ONLY_UNRECOVERABLE`) | utility (repo-root lint script) | batch | itself — see Open Question in RESEARCH.md #1; if consolidated, the registry becomes this script's data source instead of its own array | exact (self-referential) |
| `scripts/check-npm-packages.mjs` (POSSIBLY MODIFY — add `capability-registry.ts` and/or generated-doc entries) | utility (repo-root lint script) | batch | itself — `REQUIRED_DERIVED_MODULES` array (lines 79-90) is the exact list a new `.ts` module gets appended to | exact (self-referential) |

## Critical convention determination: `.ts` vs `.mts`

**`capability-registry.ts` must be a plain `.ts` file, NOT `.mts`.** Reasoning, confirmed against source this session:

- `.mts` in this repo is reserved for **host-bound** modules that run *outside* any container on the bare host and therefore cannot rely on Node's type-stripping the same way — `broker-launch.mts`, `vice-broker.mts`, `container-guard.mts`, `backend-detect.mts`, `broker-control.mts`, `broker-epoch.mts`, `broker-kill.mts`, `broker-state.mts` are the only members of this set, and `build.ts`/`resources-sync.test.ts` exist specifically to compile them into committed `resources/*.mjs` and catch drift.
- `capability-registry.ts` is consumed exclusively by `vice-proxy.ts` — a **container-side** module that runs inside the same Node process Claude Code spawns via stdio, under native type-stripping, with **no build step** (confirmed: `vice-proxy.ts` itself is `.ts`, not `.mts`, and ships as source in `package.json`'s `files[]`, line 11).
- Therefore `capability-registry.ts` follows every other container-side sibling in `.claude/mcp/vice/*.ts` (`stock-dispatch.ts`, `vice.ts`, etc.) — plain `.ts`, no `resources/` artifact, no `build.ts` involvement, no `resources-sync.test.ts` obligation. It only needs one addition: an entry in `.claude/mcp/vice/package.json`'s `files[]` array (Rule 2 — see below), exactly like `stock-dispatch.ts` or any `stock-*.ts` module already there.
- Getting this wrong (making it `.mts`) would force it to compile into `resources/`, which is the wrong tier entirely — `resources/` is host-launcher-only content, and `vice-proxy.ts` cannot import from `resources/` (that would be backwards — `resources/` is *output of*, never *input to*, the container-side proxy).

## Pattern Assignments

### `.claude/mcp/vice/capability-registry.ts` (utility, request-response)

**Analog:** `.claude/mcp/vice/vice.ts` lines 201-243 (`DENY_LIST` + `denyListRefusalMessage()`)

**The exact pattern to replicate (verified current, line numbers unchanged from research):**
```typescript
// Source: .claude/mcp/vice/vice.ts:201-243 (re-read this session, byte-identical to RESEARCH.md's quote)
export const DENY_LIST: readonly string[] = [
  "vice_disk_list",
  "tools_list",
  "tools_call",
  "initialize",
  "notifications_initialized",
];

export function denyListRefusalMessage(toolName: string): string {
  if (toolName === "vice_disk_list") {
    return (
      `${toolName} is permanently forbidden -- it is known to crash the shared host VICE MCP server ` +
      `(see CLAUDE.md's hazard note). Recovery requires a manual, host-side restart. Refusing to ` +
      `serialise this request; retrying will not help.`
    );
  }
  return (
    `${toolName} is permanently forbidden -- it is a generic-surface meta-tool that can carry a ` +
    `forbidden tool name as a nested argument, bypassing this exact outer-name-only guard (see ` +
    `.planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md). ` +
    `It does not itself crash the host. Refusing to serialise this request; retrying will not help.`
  );
}
```
Shape to copy: **one array/map (the registry), one message-rendering function, keyed by hazard/reason category rather than one wording reused for every entry.** The doc comment directly above (`vice.ts:209-228`) explains *why* it's keyed this way — "telling an agent the wrong hazard shape for what is otherwise the same permanent refusal invites a pointless retry" — the same justification applies to BACK-05's three reason categories (HARDWARE / PROTOCOL-DESCOPED / STOCK-ONLY-GAIN, RESEARCH.md's Capability Delta Registry § Step 3).

**Secondary tone reference (currently unreachable dead code, still good wording to extend):**
```typescript
// Source: .claude/mcp/vice/stock-dispatch.ts:732-741 (re-read this session — CONFIRMED at 732-741,
// not the summary's "734-738" shorthand; both point at the same function, the summary line range
// was just an abbreviated pointer, not a separate drift)
export async function dispatchStock(name: string, args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const handler = stockHandlerFor(name);
  if (!handler) {
    return isErrorText(
      `${name} is not implemented by the stock backend -- the fork backend provides this tool. ` +
        `Set VICE_BACKEND=fork to use it there, or wait for a later phase to extend the stock dispatch table.`,
    );
  }
  return handler(args, deps);
}
```
This wording already: (1) names the tool, (2) names the providing backend, (3) gives the actionable fix (`Set VICE_BACKEND=fork`). It is missing only the *reason* clause — extend this tone, don't invent a new one. Provably unreachable today (`stock-dispatch.test.ts:315-323`'s bidirectional manifest/dispatch-table agreement test guards this), so do not "fix" it — the new registry's call site is entirely in `vice-proxy.ts`.

**Type signature to use** (confirmed from `backend-detect.mts:67`):
```typescript
export type ViceBackend = "fork" | "stock"; // import this type, do not redeclare it
export function capabilityRefusalMessage(name: string, activeBackend: ViceBackend): string | undefined
```
`undefined` return = "not a known cross-backend capability, fall through to the generic `Unknown tool: ${name}` message" — this is the regression-guard contract VALIDATION.md's Wave-0 unit test asserts directly.

**Data seed (do not re-derive, consolidate):** `scripts/check-skill-tool-coverage.mjs`'s `FORK_ONLY_UNRECOVERABLE` array.
**DRIFT CONFIRMED:** RESEARCH.md's Code Examples section cited this at lines 141-159; it is now at **lines 171-184** (re-read this session, file grew by ~30 lines since research, content is byte-identical otherwise — same 3 entries, same wording, same "Route: BACK-05 ... SKILL-01, both Phase 8" reason strings):
```javascript
// Source: scripts/check-skill-tool-coverage.mjs:171-184 (re-verify again at plan/build time — CLAUDE.md's own drift-tolerance note applies)
const FORK_ONLY_UNRECOVERABLE = [
  [
    "vice_sid_get_state",
    "SID $D400-$D418 is write-only in hardware and the binary monitor has no SID command; read-back is unrecoverable on stock. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
  [
    "vice_keyboard_matrix",
    "KEYBOARD_FEED (0x72) injects PETSCII buffer text only; it cannot drive the raw keyboard matrix. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
  [
    "vice_keyboard_restore",
    "The RESTORE key pulses the NMI line and is not in the keyboard matrix; KEYBOARD_FEED cannot produce it. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
];
```
Extend to the full 24 fork-only + 2 stock-only entries per RESEARCH.md's "Capability Delta Registry" § Step 3 table — do not hand-derive reasons, that table already has all 26.

**Package manifest requirement (Rule 2):** add `"capability-registry.ts"` to `.claude/mcp/vice/package.json`'s `files[]` array (currently 39 entries, lines 11-58) — modeled exactly on how `stock-dispatch.ts` (line 27) is listed. Miss this and `scripts/check-npm-packages.mjs`'s transitive-closure walk (see below) will fail CI the moment `vice-proxy.ts` imports it.

---

### `.claude/mcp/vice/capability-registry.test.ts` (test, unit)

**Analog:** no single direct file; follow the project's universal unit-test conventions (Node's built-in `node --test`, `node:assert/strict`, colocated same-basename-plus-`.test.ts`). Structure per VALIDATION.md's Per-Task Verification Map:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilityRefusalMessage } from "./capability-registry.ts";

test("fork-only tool on stock backend names the tool, the reason, and 'fork'", () => {
  const msg = capabilityRefusalMessage("vice_sid_get_state", "stock");
  assert.match(msg!, /vice_sid_get_state/);
  assert.match(msg!, /write-only/i);
  assert.match(msg!, /fork/i);
});

test("stock-only tool on fork backend names 'stock'", () => {
  const msg = capabilityRefusalMessage("vice_execution_until_return", "fork");
  assert.match(msg!, /stock/i);
});

test("a genuinely unknown tool name returns undefined (regression guard)", () => {
  assert.equal(capabilityRefusalMessage("vice_totally_made_up_xyz", "stock"), undefined);
});
```
Quick-run command per VALIDATION.md: `cd .claude/mcp/vice && node --test capability-registry.test.ts`.

---

### `scripts/generate-tool-support-table.mjs` (utility, batch/transform)

**Analog 1 (data-read/classification shape):** `scripts/check-skill-tool-coverage.mjs` (full file, 348 lines, re-read this session — line numbers below are current, not from research)
```javascript
// Source: scripts/check-skill-tool-coverage.mjs:29-30, 99-102 (re-read this session)
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VICE_DIR = join(ROOT, ".claude/mcp/vice");
// ...
const forkManifest = JSON.parse(readFileSync(join(VICE_DIR, "tools-manifest.json"), "utf8"));
const stockManifest = JSON.parse(readFileSync(join(VICE_DIR, "tools-manifest.stock.json"), "utf8"));
const forkNames = new Set(forkManifest.tools.map((t) => t.name));
const stockNames = new Set(stockManifest.tools.map((t) => t.name));
```
Copy this exact `readFileSync` + `JSON.parse` + `Set` idiom — no new dependency, matches "Don't Hand-Roll" in RESEARCH.md.

**Analog 2 (generate-a-committed-artifact discipline):** `.claude/mcp/vice/build.ts` — read this session for "how it asserts its emitted file set":
```typescript
// Source: .claude/mcp/vice/build.ts:37-39, 190-199 (paraphrased structure, re-read this session)
// build.ts computes `emitted` (what tsc actually produced) and diffs it against
// a hardcoded expected list (HOST_BOUND_ARTIFACTS), failing loudly on either a
// missing or an unexpected entry:
const missing = expected.filter((f) => !emitted.includes(f));
const unexpected = emitted.filter((f) => !expected.includes(f));
if (missing.length || unexpected.length) {
  throw new Error(
    "build: emitted file set does not match HOST_BOUND_ARTIFACTS.\n" +
      `  emitted:    ${JSON.stringify(emitted)}\n` + /* ... */
  );
}
```
`generate-tool-support-table.mjs` doesn't need this exact missing/unexpected diff itself (it's a single-file generator, not a multi-file build) — the relevant transferable idea is: **export a pure function** (e.g. `export function generateTable({ forkManifestPath, stockManifestPath })` returning a string) so `tool-support-table.test.ts` can call it directly into memory, exactly the way `resources-sync.test.ts` imports `build()` from `build.ts` rather than shelling out.

**Cross-boundary import note (RESEARCH.md Open Question 1):** research recommends `generate-tool-support-table.mjs` import `capability-registry.ts` directly (Node's native type-stripping supports a `.mjs` importing a sibling `.ts` with explicit extension) rather than duplicating registry data — single source of truth, no drift risk. This differs from every existing `scripts/*.mjs`'s current posture (each only ever `readFileSync`s/`JSON.parse`s `.claude/mcp/vice/` files, never imports its TypeScript) — flag this as a **new** cross-boundary precedent this phase establishes, not a copy of an existing one.

---

### `.claude/mcp/vice/tool-support-table.test.ts` (test, drift guard)

**Analog:** `.claude/mcp/vice/resources-sync.test.ts` (full file, 126 lines — re-read this session; RESEARCH.md's citation of "127 lines" is off by one from a trailing-newline count, not a content drift — confirmed byte-for-byte match on every excerpt quoted in RESEARCH.md's Code Examples section)
```typescript
// Source: .claude/mcp/vice/resources-sync.test.ts:50-95 (full test body, re-read this session)
test("resources/ is byte-identical to a fresh build of its TypeScript source", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "resources-sync-"));
  try {
    build({ outDir: scratchDir });
    const scratchFiles = walk(scratchDir).sort();
    assert.ok(scratchFiles.length > 0, "scratch build produced no files -- build() is broken, not resources/");
    for (const rel of scratchFiles) {
      const committedPath = join(RESOURCES_DIR, rel);
      const scratchContent = readFileSync(join(scratchDir, rel));
      let committedContent;
      try {
        committedContent = readFileSync(committedPath);
      } catch {
        assert.fail(`committed resources/${rel} is missing but a fresh build produces it -- rebuild and commit`);
        return;
      }
      assert.ok(
        scratchContent.equals(committedContent),
        `committed resources/${rel} does not match a fresh build of its TypeScript source -- ` +
          "the committed tree is STALE. Run `node build.ts` and commit the result."
      );
    }
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});
```
Replace: `build({ outDir })` → the new generator's exported pure function; the directory-walk-and-compare → a single-file `readFileSync` + `assert.ok(generated === committed, ...)` byte comparison against the committed doc path. Keep the **exact failure-message discipline**: name the fix ("Run `node scripts/generate-tool-support-table.mjs` and commit the result.").

**Second required assertion (per VALIDATION.md row "structural"):** a scratch-manifest fixture with a changed tool count must change the generated row count — proves the table is mechanically derived, not hand-typed. No existing analog does exactly this in `resources-sync.test.ts` (its files are binary-identical build outputs, not counted rows); this is a genuinely new assertion shape, write it directly against the generator's exported function with an injected fixture path/object, following `stock-dispatch.test.ts`'s style of passing an injectable fixture rather than mutating real manifest files.

---

### `scripts/check-skill-fork-honesty.mjs` (utility, batch/lint, CI-wired)

**Analog:** `scripts/check-skill-tool-coverage.mjs` (full file, re-read this session)

**Imports + walk pattern to copy verbatim** (lines 25-60):
```javascript
// Source: scripts/check-skill-tool-coverage.mjs:25-60 (re-read this session)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VICE_DIR = join(ROOT, ".claude/mcp/vice");
const SKILLS_DIR = join(ROOT, ".claude/skills");

const errors = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };

function walkSkills(dir, acc, dirsSeen) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { walkSkills(p, acc, dirsSeen); }
    else if (/\.(md|mjs)$/.test(entry.name)) { acc.push(p); }
  }
  return acc;
}
```

**Extraction regex to copy verbatim** (lines 82-83):
```javascript
// Source: scripts/check-skill-tool-coverage.mjs:82-83 (re-read this session)
const MCP_PREFIX_RE = /mcp__[\w-]+_vice__/g;
const TOOL_NAME_RE = /\bvice_[a-z0-9_]+/g;
```

**New logic needed (no direct analog — this is the genuinely new part):** for each match of `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`, check "bounded proximity" (RESEARCH.md's Assumption A4 flags the exact threshold as an open judgment call) to a fork-requirement sentence. Model the **positive** pattern to detect on the already-compliant mention in the same skill tree:
```markdown
<!-- Source: .claude/skills/c64-program-recon/references/observation-hazards.md:88 (re-read this session, line number confirmed unchanged from research) -->
a proven guarantee. `vice_sid_get_state` is **fork-only**, since SID `$D400-$D418` is write-only
```
A cheap, defensible proximity rule matching this project's existing lint style (never AST-parse markdown, always plain regex/line-window, per `check-skill-tool-coverage.mjs`'s own no-`eval`/no-`import()` discipline in its header comment): assert the tool name and a `fork-only`/`stock`/`VICE_BACKEND` keyword co-occur within N lines (e.g. same line or ±2 lines) of each match.

**Non-vacuity control pattern to copy** (lines 313-331 — this project has a standing convention that a lint script asserting nothing found still fails loudly):
```javascript
// Source: scripts/check-skill-tool-coverage.mjs:316-331 (re-read this session)
need(
  extracted.size >= 30,
  `non-vacuity: expected at least 30 distinct vice_* names extracted from .claude/skills/, got ${extracted.size} -- the extraction regex or the skills walk may be broken`
);
```

**README presence-check (VALIDATION.md Wave 0 — "may be folded into this same file"):**
```javascript
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
need(readme.includes("VICE_BACKEND"), "README.md must mention VICE_BACKEND (DIST-02/03)");
need(readme.includes("vice_sid_get_state"), "README.md must mention vice_sid_get_state (DIST-02)");
need(readme.includes("vice_keyboard_matrix"), "README.md must mention vice_keyboard_matrix (DIST-02)");
```

**Four gap sites to fix, re-verified this session (all four line numbers UNCHANGED from RESEARCH.md — no drift found here):**
| File | Line | Current text |
|---|---|---|
| `.claude/skills/c64-program-recon/SKILL.md` | 171 | `` | `vice_keyboard_type` does nothing | The game polls `$DC00`/`$DC01` directly. Use `vice_keyboard_matrix`. | `` |
| `.claude/skills/c64-program-recon/references/sound-and-input.md` | 64 | `Assume it until shown otherwise, and drive input with `vice_keyboard_matrix` or the joystick` |
| `.claude/skills/c64-program-recon/references/observation-hazards.md` | 103 | `` `vice_keyboard_type` is invisible to them. Use `vice_keyboard_matrix`, and hold a key across a `` |
| `.claude/skills/c64-ram-capture/SKILL.md` | 158 | `` 1. Press past any "hit any key" gate with `mcp__plugin_c64-re-tools_vice__vice_keyboard_matrix`. `` |

Each needs a nearby fork-requirement clause matching `observation-hazards.md:88`'s tone (`` `vice_sid_get_state` is **fork-only**, since ... ``).

**CI wiring location:** `.github/workflows/ci.yml` — new step beside the existing pair, both re-verified this session:
```yaml
# Source: .github/workflows/ci.yml:84-89 (re-read this session, line numbers UNCHANGED from research)
      - name: Validate skill tool coverage against the stock manifest (Phase 5 criterion 5)
        run: node scripts/check-skill-tool-coverage.mjs
```
and, immediately above it:
```yaml
# Source: .github/workflows/ci.yml:81-82 (re-read this session, UNCHANGED from research)
      - name: Validate npm package contents
        run: node scripts/check-npm-packages.mjs
```
Insert the new `check-skill-fork-honesty.mjs` step directly after line 89 (after the coverage step), same job (`build`), same shape (`- name: ...` / `run: node scripts/...`), before the `Build installable package` step at line 91-92.

---

### `.claude/mcp/vice/vice-proxy.ts` (MODIFY — controller, request-response)

**Exact edit site, re-verified this session (line numbers UNCHANGED from RESEARCH.md — no drift):**
```typescript
// Source: .claude/mcp/vice/vice-proxy.ts:3219-3257 (re-read this session)
server.getServer().setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  if (DENY_LIST.includes(name)) {                                    // line 3227
    return {
      content: [{ type: "text", text: denyListRefusalMessage(name) }],
      isError: true,
    };
  }
  // ... (01.4-01 comment block, unchanged) ...
  const tool = tools[name];                                          // line 3254
  if (!tool || !tool.execute) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };  // line 3256 -- THE BUG SITE
  }
  // ...
```
**The fix:** insert the new lookup strictly between the `DENY_LIST` check (line 3227-3232) and the `Unknown tool` fallback (line 3254-3257) — i.e. right where `tools[name]` misses:
```typescript
const tool = tools[name];
if (!tool || !tool.execute) {
  const refusal = capabilityRefusalMessage(name, ACTIVE_BACKEND.backend);
  if (refusal !== undefined) {
    return { content: [{ type: "text", text: refusal }], isError: true };
  }
  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
}
```
`ACTIVE_BACKEND.backend` is already in scope at module level (line 187: `const ACTIVE_BACKEND = backendDetect.resolvedBackend();`) — no new resolution needed. This mirrors the `DENY_LIST` check immediately above it exactly: same file, same function, one more `if`, no new mechanism (RESEARCH.md's own Anti-Pattern warning: do not touch `stock-dispatch.ts`, the bug is entirely here).

**Security-critical ordering (VALIDATION.md's structural test row):** the new lookup MUST run strictly after `DENY_LIST` (line 3227) and, since it only fires on a `tools[name]` miss, it structurally cannot run before the deny-list check or in place of it — the deny-listed names (`tools_call`, `initialize`, etc.) are never even registered into `tools` (skipped at line 3184's `if (DENY_LIST.includes(def.name)) continue;`), so they'd never reach this branch anyway even if mis-ordered. Still worth a dedicated structural test per VALIDATION.md's T-08 threat ref.

---

### `.claude/mcp/vice/vice-proxy.test.ts` (MODIFY — test harness + new cases)

**Harness to reuse, re-verified this session (line numbers UNCHANGED from RESEARCH.md's citation of "5174-5199", full test read 5174-5222):**
```typescript
// Source: .claude/mcp/vice/vice-proxy.test.ts:268-324 (startProxy(), re-read this session)
function startProxy(env: Record<string, string>): ProxyHandle {
  const child = spawn(process.execPath, [PROXY_PATH], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"] as const,
  });
  // ... newline-delimited JSON stdout parser, nextMessage(), send() ...
}
```
```typescript
// Source: .claude/mcp/vice/vice-proxy.test.ts:2100-2105 (handshake(), re-read this session)
async function handshake(proxy: ProxyHandle): Promise<void> {
  proxy.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initThenListParams() });
  await proxy.nextMessage();
  proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  await proxy.nextMessage();
}
```
**Exact test case to copy the shape of, re-verified at lines 5174-5222 (unchanged from research):**
```typescript
// Source: .claude/mcp/vice/vice-proxy.test.ts:5174-5222 (full test body, re-read this session)
test("tools_call carrying a nested vice_disk_list argument is now refused before any request reaches the stand-in host (closes the gap the prior test proved)", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "tools_call", arguments: { name: "vice_disk_list", arguments: {} } } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, /* ... */);
    assert.match(resp.result.content[0].text, /tools_call/);
    // ...
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});
```
**The new BACK-05 end-to-end test to write, following this exact shape:**
```typescript
test("vice_sid_get_state on the stock backend is refused with tool name, reason, and 'fork'", async () => {
  const proxy = startProxy({ VICE_BACKEND: "stock", /* + whatever stock-manifest/binary env the stock harness already uses elsewhere in this file */ });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "vice_sid_get_state", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true);
    assert.match(resp.result.content[0].text, /vice_sid_get_state/);
    assert.match(resp.result.content[0].text, /fork/i);
  } finally {
    proxy.child.kill("SIGKILL");
  }
});
```
Confirmed `VICE_BACKEND` is a real env var `startProxy()`'s `spawn()` call passes straight through (`env: { ...process.env, ...env }`, line 270) and is read exactly once by `backendDetect.resolvedBackend()` (`backend-detect.mts:461`) — no existing test in this file currently sets `VICE_BACKEND` directly, so check how the file's *other* stock-backend tests (if any) provision a stock manifest/binary path before writing this one, to avoid needing a live VICE binary.

---

### `README.md` (MODIFY — doc, request-response)

**Analog:** itself. Structural pattern: existing `## Install` section (lines 19-60), which already has the "two independent ways to install; pick one" framing and a `### A.` / `### B.` sub-structure. The new content is a **sibling `##` section**, not a rewrite of `## Install`.

**Stale content to fix while in this file (RESEARCH.md's adjacent finding, confirmed still present this session, lines UNCHANGED — 123-126):**
```markdown
<!-- Source: README.md:123-126 (re-read this session) -->
Two repo-wide documentation guardrail tests (`skill-docs.test.ts`,
`vice-mcp-selector-docs.test.ts`) intentionally did **not** move here — they
validate a full project's docs (`CLAUDE.md`, `.planning/`, `docs/`) against the
tool surface and remain in the originating project.
```
Confirmed by repo-wide grep this session: neither file exists anywhere in this repository. Not a Phase 8 requirement per se, but directly adjacent to the DIST-02/03 edit and worth a drive-by correction (RESEARCH.md flags this explicitly; QUAL-02 owns the larger ghost-reference cleanup, this is just the one sentence in the file Phase 8 is already touching).

**Required literal strings** (per `check-skill-fork-honesty.mjs`'s presence-check, VALIDATION.md): `VICE_BACKEND`, `vice_sid_get_state`, `vice_keyboard_matrix` must all appear somewhere in the new section.

**Where a generated support-table link belongs:** README.md's `## Layout` section (lines 72-87) already documents where things live in a `\`\`\`text` tree block — the new `docs/tool-support.md` (or wherever planner places it) should get one line in that block, plus a prose link from the new install section, following the existing pattern of linking `docs/stock-vice-parity.md`-style references from README (though note: no *current* README reference to `docs/stock-vice-parity.md` exists today — this will be a new outbound link, not an edit to an existing one).

---

### `.github/workflows/ci.yml` (MODIFY — config)

**Exact insertion point, re-verified this session (lines UNCHANGED from research: step names at 81 and 88, `run:` lines at 82 and 89):**
```yaml
# Source: .github/workflows/ci.yml:81-89 (re-read this session)
      - name: Validate npm package contents
        run: node scripts/check-npm-packages.mjs

      # Blocking: a skill that documents a tool the active backend does not
      # advertise fails at runtime for the user with an unknown-tool error,
      # and the six skills are the product surface this milestone exists to
      # keep working (Phase 5 criterion 5).
      - name: Validate skill tool coverage against the stock manifest (Phase 5 criterion 5)
        run: node scripts/check-skill-tool-coverage.mjs
```
Add the new step immediately after (before line 91's `Build installable package`), same job (`build`, starts line 26), same `working-directory`-less repo-root invocation style both existing steps use.

---

### `scripts/check-skill-tool-coverage.mjs` (POSSIBLY MODIFY)

If the planner takes RESEARCH.md's recommendation (consolidate rather than duplicate), this file's `FORK_ONLY_UNRECOVERABLE` array (now confirmed at **lines 171-184**, not research's cited 141-159 — drift confirmed, re-verify again at plan/build time) becomes a re-export or import from the new `capability-registry.ts`, rather than an independent literal array. The surrounding assertions (lines 256-264, "FORK_ONLY_UNRECOVERABLE present in fork, absent from stock") stay unchanged — they operate on whatever `[name, reason]` pairs the array (now sourced from the registry) contains.

### `scripts/check-npm-packages.mjs` (POSSIBLY MODIFY)

**Analog:** itself — `REQUIRED_DERIVED_MODULES` array, re-verified this session at **lines 79-90** (unchanged from expectations, though research did not cite exact lines for this array):
```javascript
// Source: scripts/check-npm-packages.mjs:79-90 (re-read this session)
const REQUIRED_DERIVED_MODULES = [
  ["stock-derived.ts", "DERIV-07"],
  ["stock-disassemble.ts", "DISASM-01"],
  // ...
];
for (const [file, req] of REQUIRED_DERIVED_MODULES) {
  need(vice.files.includes(file), `vice-mcp: missing ${file} -- ${req} would ship a package that throws ERR_MODULE_NOT_FOUND`);
}
```
If the planner wants an explicit regression guard (rather than relying solely on the transitive-closure walk at lines 102-132 to catch a missing `files[]` entry), append `["capability-registry.ts", "BACK-05"]` to this array. The transitive-closure walk (verified this session, unchanged shape) will catch a missing entry anyway once `vice-proxy.ts` imports the new module — this addition is belt-and-suspenders, not strictly required.

**On the generated support-table doc:** per RESEARCH.md Open Question 3, default to **GitHub-only** (not shipped in the npm tarball) — matches every existing `docs/*.md` file's current placement (none are in `files[]` today, confirmed by the `files[]` array read this session containing zero `docs/` entries). No `check-npm-packages.mjs` change needed for the doc itself unless the planner overrides this default.

---

### `.claude/skills/*/SKILL.md` sync mechanism (informational — not a file to pattern-map, but load-bearing for all skill edits)

**Confirmed:** editing `.claude/skills/c64-program-recon/SKILL.md`, `references/sound-and-input.md`, `references/observation-hazards.md`, or `.claude/skills/c64-ram-capture/SKILL.md` requires **no manual sync step**. `installer/skills/` is a gitignored, generated copy, rebuilt from scratch by `installer/scripts/sync-skills.mjs` on every `prepack` (`installer/package.json:51`, re-read this session):
```javascript
// Source: installer/scripts/sync-skills.mjs:1-8 (re-read this session)
// Copies the canonical skills from the repo's .claude/skills/ into installer/skills/
// so `npm pack`/`npm publish` bundles them into the @henols/c64-re-tools tarball.
// The canonical source of truth stays .claude/skills/ (also used by the Claude Code
// plugin); installer/skills/ is a generated, gitignored copy regenerated on every
// pack via the package's `prepack` script.
```
This is enforced by `installer/package.json`'s `"prepack": "node scripts/sync-skills.mjs"` (line 51) — `npm pack`/`npm publish`/`check-npm-packages.mjs`'s own `packFiles()` (which shells out to `npm pack --dry-run`) all trigger it automatically. No new test or step is needed for the skill edits themselves to reach the installer tarball.

## Shared Patterns

### One-array-one-function refusal shape (BACK-05's core mechanism)
**Source:** `.claude/mcp/vice/vice.ts:201-243`
**Apply to:** `capability-registry.ts` (new registry + function), `vice-proxy.ts`'s `CallToolRequestSchema` override (new call site)
```typescript
export const DENY_LIST: readonly string[] = [ /* ... */ ];
export function denyListRefusalMessage(toolName: string): string { /* keyed by hazard shape */ }
```
Never duplicate refusal text inline at a second call site — always reuse the one exported function.

### Generate-into-scratch-then-byte-diff (DIST-01's drift guard)
**Source:** `.claude/mcp/vice/resources-sync.test.ts` (full file) + `.claude/mcp/vice/build.ts`'s exported `build()` function
**Apply to:** `tool-support-table.test.ts` + `generate-tool-support-table.mjs`
Regenerate into memory/scratch, byte-compare against the committed artifact, fail CI with a message naming the exact regeneration command.

### Repo-root lint script over `.claude/skills/` (SKILL-01's mechanism)
**Source:** `scripts/check-skill-tool-coverage.mjs` (full file)
**Apply to:** `scripts/check-skill-fork-honesty.mjs`
Same walk function, same `MCP_PREFIX_RE`/`TOOL_NAME_RE` extraction regexes, same `need()`/`errors` accumulator pattern, same non-vacuity controls, same CI wiring shape (a `- name:` / `run: node scripts/...` step in the `build` job).

### `files[]` allow-list + transitive-closure gate (npm packaging correctness)
**Source:** `.claude/mcp/vice/package.json`'s `files[]` array + `scripts/check-npm-packages.mjs`'s closure walk (lines 102-132)
**Apply to:** `capability-registry.ts` (must be added to `files[]`; the closure walk auto-verifies it once imported by `vice-proxy.ts`)

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Generated per-backend support-table doc (e.g. `docs/tool-support.md`) | config/doc | batch output | This repo has never generated a committed markdown file before — every `docs/*.md` today is hand-authored prose (`stock-vice-parity.md`, `phase0-binmon-findings.md`, `phase1-probe-results.md`, `phase2-backend-probe-evidence.md`, `roadmap-stock-vice.md`, confirmed via `ls docs/` this session). The closest *mechanism* analog is `resources/*.mjs` (generated-but-committed code), but that is a different file type and a different consumer (a Node host launcher, not a human reader). Use `resources-sync.test.ts`'s drift-guard *mechanism* (already mapped above) — there is simply no prior markdown-generation precedent to also copy prose/formatting conventions from. Planner should keep the generated file visually simple (one table, per RESEARCH.md's "one markdown table, generated by one script" scope note) rather than inventing new doc styling. |

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.ts`, `.claude/mcp/vice/*.mts`, `.claude/mcp/vice/*.test.ts`, `scripts/*.mjs`, `.github/workflows/ci.yml`, `README.md`, `docs/*.md`, `.claude/skills/**/*.md`, `installer/scripts/*.mjs`, `installer/package.json`, `.claude/mcp/vice/package.json`
**Files scanned:** `vice.ts`, `vice-proxy.ts`, `vice-proxy.test.ts`, `stock-dispatch.ts`, `stock-dispatch.test.ts` (referenced only), `resources-sync.test.ts`, `build.ts`, `backend-detect.mts`, `vice-broker.mts`, `check-skill-tool-coverage.mjs`, `check-npm-packages.mjs`, `ci.yml`, `README.md`, `docs/stock-vice-parity.md`, four skill files, `installer/scripts/sync-skills.mjs`, `installer/package.json`, `.claude/mcp/vice/package.json`
**Pattern extraction date:** 2026-08-18

**Confirmed drifts found this session (both minor, both flagged per CLAUDE.md's drift-tolerance instruction):**
1. `scripts/check-skill-tool-coverage.mjs`'s `FORK_ONLY_UNRECOVERABLE` array: RESEARCH.md cited lines 141-159; actual is **171-184**. Content unchanged.
2. `.claude/mcp/vice/package.json`'s `"test"` script: RESEARCH.md/VALIDATION.md cited line 58 (`package.json:58`); actual `"test": "node --test '*.test.*'"` is at **line 90**. Content unchanged.

**Confirmed NOT drifted (re-verified byte-for-byte or line-for-line against RESEARCH.md's citations):** `vice.ts:201-243` (DENY_LIST/denyListRefusalMessage), `vice-proxy.ts:3219-3257` (CallToolRequestSchema override, including the exact 3227/3254/3256 lines), `stock-dispatch.ts:732-741` (dispatchStock, research's summary line "734-738" was an abbreviated pointer to the same function, not a separate drift), `vice-proxy.test.ts:268-324` (startProxy), `vice-proxy.test.ts:2100-2105` (handshake), `vice-proxy.test.ts:5174-5222` (tools_call nested-refusal test), `ci.yml:81-89` (both existing lint steps), `README.md:123-126` (ghost-reference), all four skill-file gap-site line numbers (171, 64, 103, 158).
