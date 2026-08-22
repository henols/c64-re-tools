# Phase 14: Backend Decision - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 8 (this phase is doc/decision-first; there is no fixed
"files to create" list from a CONTEXT.md — RESEARCH.md's Validation
Architecture and Wave 0 Gaps sections are the closest thing to a file list)
**Analogs found:** 8 / 8

## Branch note (read this first)

FORK-01 is decided **at a human checkpoint during execution**, not by this
pattern map. Everything below is organised into:

- **Shared** — needed regardless of branch, or is itself the decision record.
- **Retain-branch only** — new work if the checkpoint says "retain."
- **Remove-branch only** — new work if the checkpoint says "remove."

Do not delete any file listed under "Shared / not fork-only" even on the
remove branch — RESEARCH.md Q1 is explicit that `vice.ts` and
`capability-registry.ts` are both load-bearing for the stock backend too.

## File Classification

| File | Role | Data Flow | Branch | Closest Analog | Match Quality | Shared with stock? |
|------|------|-----------|--------|-----------------|---------------|---------------------|
| `.planning/PROJECT.md` → `## Key Decisions` (new FORK-01 row) | doc/decision record | request-response (human-read) | shared | existing rows in the same table | exact (same file, same table) | n/a |
| new `fork01-decision.test.ts` (or similarly named grep-shaped guard) | test (doc-content) | transform (grep + assert) | shared, Wave 0 | `.claude/mcp/vice/docs-linerefs.test.ts` | exact | n/a |
| `.claude/mcp/vice/capability-registry.ts` (`capabilityRefusalMessage()`, `CAPABILITY_REGISTRY`) | service (pure function + data table) | request-response | shared — edited on **both** branches, deleted on neither | itself (edit in place) | exact | **Yes — shared seam, never delete** |
| `scripts/check-skill-fork-honesty.mjs` (+ `scripts/lib/skill-honesty-checks.mjs`) | utility / CI guard script | batch / doc-content | shared — kept as-is on retain, **redesigned** (not deleted) on remove | itself | exact | n/a (doc-policing script, not runtime) |
| `.claude/mcp/vice/fork-manifest-surface.test.ts` | test | batch (assert-count) | remove-branch: template for a new "fully absent" test; retain-branch: unchanged | itself | exact (as a pattern to invert) | No — fork-only, safe to delete on remove |
| new `fork-absence.test.ts` (or similar) | test | batch (grep sweep) | **remove-branch only**, Wave 0 | `.claude/mcp/vice/fork-manifest-surface.test.ts` (count-gate pattern, inverted to zero) | role-match | n/a |
| new `fork-live.test.ts` | test (manual-only, live) | request-response (live HTTP) | **retain-branch only**, Wave 0 | `.claude/mcp/vice/stock-live.test.ts` | exact | n/a |
| `.claude/mcp/vice/test-gate.mjs` (`MANUAL_ONLY_TESTS`) | config/registry | n/a | **retain-branch only** — register `fork-live.test.ts` there | itself (append one entry) | exact | n/a |
| `.claude/mcp/vice/vice.ts` | service (HTTP transport) + shared error/util module | request-response | **remove-branch only** — must be split, not deleted wholesale | itself (source of the shared exports to extract) | n/a — this is the file being edited, not an analog target | **Yes — `ViceError`, `MachineRestartedError`, `readEpoch()`, `mcpHost()`, `ToolInfo` used by 13 `stock-*.ts` files** |

## Pattern Assignments

### 1. `.planning/PROJECT.md` — new `FORK-01` Key Decisions row

**Analog:** the table's own existing rows (`.planning/PROJECT.md:255-277`, read in full this session).

**Exact column shape (3 columns, no fourth "reversal criteria" column exists anywhere in this table today — confirmed by reading all rows):**

```markdown
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add a stock-VICE backend rather than replacing the fork | The fork retains SID read-back and matrix keyboard; keeping it costs almost nothing since it already exists and is tested, and it removes the single-point-of-failure bet | ✓ Good — v0.2.0 shipped both; the fork's 62-tool surface is byte-identical to v0.1.x |
```

**How reversed decisions are recorded (retroactively, in the Outcome cell — copy this shape, not a new column):**

```markdown
| All three stock-only gain groups in scope, not parity-first | User elected the fuller scope; makes the milestone materially larger than the ADR's 7-phase plan | ⚠️ Revisit — **reversed 2026-08-17.** `GAIN-01..09` and all of Phase 6 were cut: no shipped skill calls any of them. Capability surplus, not a gap |
```

**FORK-01's row is the FIRST to need reversal criteria stated prospectively, not retroactively** (RESEARCH.md Q7). Fold `UP-01`'s ready-made sentence (`.planning/REQUIREMENTS.md:87`) into the Rationale or Outcome cell rather than inventing a fourth column:

> "A `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`) — closes stock's hardest loss for everyone, and would satisfy one of FORK-01's reversal criteria"

Write a dated, single-row entry (Decision | Rationale-with-reversal-criteria | Outcome) exactly like the existing rows — do not restructure the table.

---

### 2. Wave 0 guard: `FORK-01` co-occurs with `KEYBOARD_MATRIX_SET` in PROJECT.md

**Analog:** `.claude/mcp/vice/docs-linerefs.test.ts` (108 lines, read in full).

This is this project's established pattern for a mechanical doc-content check: read real prose (never a copy pasted into the test), isolate the relevant bullet/line by a `.includes()`/`.find()` scan, extract with a regex, assert non-vacuously, then assert content.

**Imports pattern** (`docs-linerefs.test.ts:20-27`):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";
```

**Isolate-the-relevant-text pattern** (`docs-linerefs.test.ts:38-44`):
```typescript
function findRewriteArgumentsBullet(claudeMd: string): string {
  const lines = claudeMd.split("\n");
  const hit = lines.find((line) => line.includes("rewriteArguments()"));
  assert.ok(hit, "CLAUDE.md must contain a bullet mentioning rewriteArguments() -- none found");
  return hit as string;
}
```

**Non-vacuity + content assertion pattern** (`docs-linerefs.test.ts:57-64`):
```typescript
test("CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)", () => {
  const claudeMd = readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), "utf8");
  const bullet = findRewriteArgumentsBullet(claudeMd);
  const citations = extractCitations(bullet);
  assert.ok(citations.length >= 2, `expected at least two vice-proxy.ts:<N> citations in the rewriteArguments() bullet, found ${citations.length}`);
});
```

**Apply to the FORK-01 guard** by reading `.planning/PROJECT.md` instead of `CLAUDE.md`, isolating the row/line containing `"FORK-01"`, and asserting it also contains `"KEYBOARD_MATRIX_SET"` (case-insensitive per RESEARCH.md's own grep example: `grep -n "FORK-01" .planning/PROJECT.md | grep -i "KEYBOARD_MATRIX_SET"`). Follow this file's failure-message style: name the exact string missing and what mechanism might be broken if it's zero.

---

### 3. `scripts/check-skill-fork-honesty.mjs` — the mechanical skill-text honesty guard

**Read in full** (imports/header: lines 1-70; non-vacuity block: lines 464-505).

**Structure:**
- Imports `CAPABILITY_REGISTRY` from the first-party TS module (`capability-registry.ts`) — **never** a hand-copied list (its own header warns against this explicitly, lines 44-48).
- Walks `.claude/skills/` recursively (`walkSkills()`, skipping `node_modules`), plus reads `README.md` and `docs/stock-vice-parity.md` as flat strings.
- Derives `FORK_ONLY_NAMES` from the registry (`providedBy === "fork"` filter, line 115-118).
- Scans each skill file's sections for tool-name mentions (`TOOL_NAME_RE`) and requires a same-section annotation match (`ANNOTATION_RE = /(fork-only|requires the fork backend|requires the fork|fork backend|VICE_BACKEND)/i`).
- Requires/forbids literal substrings in README.md and the parity doc (`REQUIRED_README_SUBSTRINGS`, `FORBIDDEN_README_SUBSTRINGS`, mirrored for the parity doc).
- **Non-vacuity controls at the bottom** — this is the load-bearing pattern to copy: assert the *number of things checked* is above a floor, not just that zero violations occurred:
```javascript
need(
  totalForkMentions >= 8,
  `non-vacuity: expected at least 8 fork-only tool mentions across .claude/skills/, got ${totalForkMentions} -- the skills walk or extraction regex may be broken`
);
need(
  FORK_ONLY_NAMES.size >= 20,
  `non-vacuity: expected at least 20 fork-only names derived from CAPABILITY_REGISTRY, got ${FORK_ONLY_NAMES.size} -- the registry import may be broken`
);
```
- Reporting pattern: collect into an `errors` array via a `need(cond, msg)` closure, then a single fail/pass block at the end that prints every collected error, `process.exit(1)` on any failure.

**Retain branch:** no change needed — this script stays green as-is.

**Remove branch:** RESEARCH.md's Pitfall 2 is explicit — do **not** delete `need()` calls one at a time to make it pass. The premise changes from "every fork-only mention carries a fork-requirement annotation" to "every hard-loss mention carries an honest no-route statement." Concretely: `ANNOTATION_RE` needs a new pattern (something like `/(permanently unavailable|no route exists|unrecoverable on this backend)/i`), `FORK_ONLY_NAMES` still derives from the registry but the registry's `hardware` entries lose their `providedBy: "fork"` alternative-backend framing, and the non-vacuity floors (`>= 8`, `>= 20`) should be re-examined against the new (likely just SID + matrix keyboard + RESTORE, i.e. 3, not 20+) footprint rather than copied unchanged.

---

### 4. `capability-registry.ts` + `capabilityRefusalMessage()` — the runtime refusal, and its entry shape

**Read in full — this file is edited on BOTH branches, deleted on neither.**

**Entry shape** (`capability-registry.ts:104-127`, the three hard-loss entries, `category: "hardware"`):
```typescript
{
  name: "vice_sid_get_state",
  category: "hardware",
  providedBy: "fork",
  reason:
    "SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes " +
    "no SID read command.",
},
{
  name: "vice_keyboard_matrix",
  category: "hardware",
  providedBy: "fork",
  reason:
    "The binary monitor's KEYBOARD_FEED (0x72) only injects PETSCII buffer text; the emulator " +
    "recomputes CIA port B from its own keyboard array on every read, so there is no wire " +
    "command that can drive the raw matrix.",
  alternative: KEYBOARD_ALTERNATIVE,
},
```
`KEYBOARD_ALTERNATIVE` (line 91-95) is the shared stock-side partial mitigation string (`vice_keyboard_type`/`vice_joystick_set`) — this is the one alternative that survives on the **remove** branch too, since it doesn't depend on the fork.

**Refusal-message function** (`capability-registry.ts:350-385`), the `"hardware"` branch that names a route — this is exactly the shape a "remove" edit must change:
```typescript
if (entry.category === "hardware") {
  return (
    `${entry.name} is unrecoverable on the ${activeBackend} backend: ${entry.reason} ` +
    `Use the ${entry.providedBy} backend instead (Set VICE_BACKEND=${entry.providedBy}).${alt}`
  );
}
```
On **remove**, this branch's "Use the {providedBy} backend instead" clause is no longer true — RESEARCH.md's Q2 item 5 and Open Question 2 both flag that `entry.providedBy` becomes a route to nothing. The fix must be a genuinely new branch/wording ("no backend provides this, ever"), not a parameter tweak, and the literal token `"unrecoverable"` constraint (documented in the header comment just above `capabilityRefusalMessage`, lines 340-348) must still hold: never reuse it for a merely-unbuilt ("descoped") tool.

**Retain branch:** no change required — the existing three-branch function (`hardware` / `descoped` / `stock-only-gain`) already satisfies FORK-02 (RESEARCH.md Q4's "already satisfied" finding). Verify via `capability-registry.test.ts`, don't rewrite.

---

### 5. Remove-branch Wave 0 gap: "fork transport fully absent" guard

**Analog:** `.claude/mcp/vice/fork-manifest-surface.test.ts` (108 lines, read in full) — the project's "assert an exact count" pattern, to be inverted to zero.

**Imports** (`fork-manifest-surface.test.ts:27-33`):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
```

**The count-gate shape to invert** (`fork-manifest-surface.test.ts:56-64`):
```typescript
test("fork-manifest-surface: tools-manifest.json parses and its tools array has length exactly 62 (D-16)", () => {
  const manifest = readManifest();
  assert.ok(Array.isArray(manifest.tools), "manifest.tools must be an array");
  assert.equal(
    manifest.tools.length,
    62,
    "fork manifest tool count changed -- BACK-02 says the fork's advertised list is unchanged from v0.1.x; " +
      "62 is the count D-16 established after deleting vice_snapshot_list. Do not edit this number without a decision record."
  );
});
```

**Inverted-to-zero shape for the remove branch** (new file, e.g. `fork-absence.test.ts`): grep-sweep `.claude/mcp/vice/*.ts`/`*.mts` for `"mcpserver"` and `.` (repo-wide) for `"VICE_BACKEND"`, per RESEARCH.md's exact commands:
```
grep -rn "mcpserver" .claude/mcp/vice/*.ts .claude/mcp/vice/*.mts   # must return 0 hits outside deleted files
grep -rn "VICE_BACKEND" .                                            # must return 0 hits outside a historical-decision note
```
Follow the same "the number/pattern is load-bearing evidence, don't casually edit it" comment style this file's header uses, and note in the header comment WHY zero is now correct (mirroring D-16's own decision-record citation style) — cite the FORK-01 PROJECT.md row as the decision record.

This file's own header comment (lines 1-25) also doubles as the reasoning-pattern source `check-skill-fork-honesty.mjs`'s header explicitly says it reused (RESEARCH.md Q1) — cite that lineage in the new test's header too.

---

### 6. Retain-branch Wave 0 gap: `fork-live.test.ts`

**Analog:** `.claude/mcp/vice/stock-live.test.ts` (its manual-only, env-gated live idiom) + `.claude/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS` registry.

**Gating idiom to copy** (`stock-live.test.ts:75-80`):
```typescript
const resolvedBinPath = process.env.VICE_LIVE_STOCK_BIN ?? VICE_LIVE_STOCK_BIN_DEFAULT;
const SKIP_REASON: string | false = !process.env.VICE_LIVE_STOCK_BIN
  ? /* ... default-skip message ... */
  : false;
```
Every `test()` in the file passes `SKIP_REASON` through `node:test`'s own `{ skip }` option — **default-skip is mandatory** (the file's own header, lines 27-34, states `npm test` globs this via `*.test.*` and CI has no VICE; every test must pass `{ skip: SKIP_REASON }`, never fail or hang where no binary is available).

**Registration — the ONE list, no second list anywhere** (`test-gate.mjs:72-80`):
```javascript
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-live-triage.test.ts",
  "stock-live-broker-monitor.test.ts",
  "stock-broker-live.test.ts",
]);
```
`test-gate.test.ts`'s own drift guard fails the build if a test file escapes both this list and the automated set — so `fork-live.test.ts` MUST be appended here, following the same one-line-per-file comment convention the header above each addition uses (e.g. `stock-live-triage.test.ts`'s own joining comment, lines 29-34).

**What NOT to reuse:** `broker-e2e.test.ts` stubs `VICE_BIN` to `/bin/sleep` specifically because it does *not* want a real emulator (RESEARCH.md Q3) — `fork-live.test.ts` is the opposite: it must NOT stub the binary, and should instead default-point at the real fork build, following the "shadowed on PATH" warning `stock-live.test.ts`'s own header calls out (lines 20-23: `/usr/local/bin/x64sc` — the fork build — shadows `/usr/bin/x64sc` on PATH; always name the binary by absolute path via an env var with a sane default, e.g. `VICE_LIVE_FORK_BIN` defaulting to `/usr/local/bin/x64sc`).

**Concrete command sequence to wrap** (from RESEARCH.md Q3, already spelled out):
```sh
/usr/local/bin/x64sc -mcpserver -mcpserverhost 127.0.0.1 -mcpserverport 6510 &
# then, with VICE_BACKEND=fork and VICE_MCP_URL pointed at that host:port,
# call vice_ping, vice_registers_get, vice_sid_get_state, vice_recycle
# through the real vice-proxy.ts dispatch, then kill the process.
```

---

### 7. `vice.ts` — the shared/not-shared split (applies mainly to the remove branch)

**Not a pattern-analog case — a warning to carry into any plan.** `vice.ts` (772 lines) is simultaneously:
- The fork's HTTP transport (`call()`, `activeInstance`/`useInstance`, `beginSession()`, `DENY_LIST`, `denyListRefusalMessage()`) — genuinely fork-only.
- The **shared** home of `ViceError`, `MachineRestartedError`, `readEpoch()`, `mcpHost()`, `type ToolInfo` — imported by 13 `stock-*.ts` files (`stock-condition.ts:49`, `stock-recycle.ts:67`, `stock-diagnose.ts:51`, `stock-dispatch.ts:30`, `stock-connect.ts:45`, `stock-derived.ts:79`, `stock-handler.ts:39`, `stock-address.ts:35`, `stock-petscii.ts:38`, `stock-paths.ts:38`, `stock-timing.ts:48`, `stock-symbols.ts:56`, `vice-broker-client.ts:47`) — **none of these 13 import `call()`**.

**Remove-branch rule:** extract the shared exports into a surviving module (e.g. rename/split into an errors/utils module) *before* deleting `call()` and its direct dependents (`vice-sync.ts`, `vice-probe.ts`, `refresh-manifest.ts`, `fork-manifest-surface.test.ts`, `tools-manifest.json` — these five are cleanly, safely deletable per RESEARCH.md Q1's "Not shared" list). A plan that deletes `vice.ts` wholesale will break 13 unrelated stock modules at typecheck time — this is Pitfall 1 in RESEARCH.md, called out explicitly.

**Retain branch:** no change to `vice.ts` at all.

## Shared Patterns

### Doc-content mechanical guards
**Source:** `.claude/mcp/vice/docs-linerefs.test.ts`
**Apply to:** the new FORK-01 co-occurrence guard (item 2 above)
**Idiom:** read the real file, isolate the relevant line/section by substring match (never re-paste text into the test), extract via regex, assert non-vacuity (`length >= N`) before asserting content — a lint that finds nothing must fail loudly, not pass silently.

### "Assert an exact count, inverted to zero" guards
**Source:** `.claude/mcp/vice/fork-manifest-surface.test.ts`
**Apply to:** the new remove-branch absence sweep (item 5 above)
**Idiom:** one `test()` per property, a load-bearing literal number/pattern with a header comment naming the decision record that justifies the number, explicit "do not edit this without a decision record" language.

### Manual-only, env-gated live tests
**Source:** `.claude/mcp/vice/stock-live.test.ts`, registered in `.claude/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS`
**Apply to:** `fork-live.test.ts` (item 6 above)
**Idiom:** default-skip via a computed `SKIP_REASON` passed to every `test()`'s `{ skip }` option; absolute-path binary env var with a documented default; one central registry list, never a second list.

### Capability-registry-derived honesty checks
**Source:** `scripts/check-skill-fork-honesty.mjs` importing `CAPABILITY_REGISTRY` from `.claude/mcp/vice/capability-registry.ts`
**Apply to:** any future skill-text check on either branch
**Idiom:** never hand-maintain a second list of fork-only/hard-loss tool names anywhere else in the repo — always derive from the one registry.

## No Analog Found

None — all files RESEARCH.md/VALIDATION.md name as new-or-edited this phase have a close, verified analog in the codebase (this is a decision phase over an already-mature dual-backend codebase, not new architecture).

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.ts`, `*.mts`, `*.test.ts`; `scripts/*.mjs`; `.planning/PROJECT.md`
**Files scanned (read this session):** `14-RESEARCH.md`, `14-VALIDATION.md`, `fork-manifest-surface.test.ts`, `docs-linerefs.test.ts`, `check-skill-fork-honesty.mjs`, `capability-registry.ts`, `PROJECT.md` (Key Decisions table), `broker-e2e.test.ts`, `stock-live.test.ts`, `test-gate.mjs`
**Pattern extraction date:** 2026-08-22
