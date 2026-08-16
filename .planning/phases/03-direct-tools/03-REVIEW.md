---
phase: 03-direct-tools
reviewed: 2026-08-16T00:00:00Z
depth: standard
scope: gap-closure (diff base eb4f9b6d864bfb068cced475f81de84778bc468b)
files_reviewed: 11
files_reviewed_list:
  - .claude/mcp/vice/stock-registers.ts
  - .claude/mcp/vice/stock-registers.test.ts
  - .claude/mcp/vice/stock-live.test.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/test-gate.mjs
  - .claude/mcp/vice/test-gate.test.ts
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/mcp/vice/vice-proxy.test.ts
  - .claude/mcp/vice/broker-e2e.test.ts
  - .claude/mcp/vice/vice-broker-launch.test.ts
  - .claude/mcp/vice/README.md
findings:
  critical: 0
  warning: 8
  info: 6
  total: 14
status: issues_found
---

# Phase 3 (gap closure 03-14 .. 03-18): Code Review Report

**Reviewed:** 2026-08-16
**Depth:** standard
**Diff base:** `eb4f9b6` (commit immediately before the gap-closure wave)
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The three claimed fixes were verified against the running system, not just read:

- **03-14 (bits-vs-bytes)** — verified correct. `2 ** sizeBits - 1` yields 0xff for
  `sizeBits: 8` and 0xffff for `sizeBits: 16`; a bogus width is rejected by
  `!Number.isInteger(sizeBits) || sizeBits < 1 || sizeBits > 16` before the shift, so
  `2 ** 32` can never be produced. `-0`, non-integers and negatives are all refused.
  The two boundary regexes in the tests (`/0\.\.0xff\b/` vs `/0\.\.0xffff\b/`) are
  genuinely discriminating — the `\b` prevents the 8-bit assertion from passing against
  a 16-bit message. `tsc --noEmit` is clean.
- **03-15 (hang fix)** — the two named leak sites were genuinely fixed, but the
  "safety net" underneath them covers only **1 of 4** HTTP-server factories in
  `vice-proxy.test.ts` and **none** of its 29 control listeners (WR-02). The
  env-gated skips introduced alongside it have no guard asserting the gate is open
  where it is supposed to be open (WR-04).
- **03-16 (live harness)** — I ran it. Default-skip works and terminates
  (`node --test stock-live.test.ts` → 2 skipped, exit 0, 280ms). Opted in against
  genuine `/usr/bin/x64sc` it passes end-to-end (A=42 round-trip, PC=0xC000, range
  refusal, all seven flag refusals naming `FL`, `runState: stopped`) and leaves **no**
  orphaned `x64sc`. One narrow orphan window remains in the `before()` hook (WR-05).

`npm run test:automated` is green here: 955 tests, 0 fail. So none of the findings
below are "the build is red" — they are contract lies, holes in the new safety nets,
and false-green vectors that the current environment happens not to trip.

Highest-value finding: **WR-01** — the shipped stock manifest still tells the agent it
may pass `N|V|B|D|I|Z|C` to `vice_registers_set`, which plan 03-16 just proved *live*
always fails on stock.

No CLAUDE.md constraint violations found: `tools-manifest.json` (fork) is untouched by
this wave, every answer still goes through `stockAnswer()` (D-06), and no `.mts`
resource drift was introduced.

## Narrative Findings (AI reviewer)

### Critical Issues

None proven in this diff.

### Warnings

#### WR-01: The stock manifest advertises `vice_registers_set` argument values stock always refuses

**File:** `.claude/mcp/vice/tools-manifest.stock.json:156`
**Issue:** The stock entry keeps the fork's verbatim description
`"Register name: PC|A|X|Y|SP|N|V|B|D|I|Z|C"`. Seven of those twelve values
(`N V B D I Z C`) are processor-status **flag bits**, and `handleRegistersSet`
(`stock-registers.ts:255-267`) refuses every one of them. Plan 03-16 live-verified
that refusal for all seven against genuine VICE 3.9 in this same wave — and the
description was not updated. This is the shipped `tools/list` text the model reads
before choosing arguments, so the stock backend actively instructs the agent to make a
call that can never succeed. D-03 requires the *argument shape* to match the fork; it
does not require the description string to lie. `stock-dispatch.test.ts`'s manifest
compatibility test only compares `required` sets and property `type`s, so nothing
catches this.

**Fix:**
```json
"description": "Register name as the connected build enumerates it (e.g. PC|A|X|Y|SP|FL) -- call vice_registers_available for this build's own list. Individual status-register flag bits (N|V|B|D|I|Z|C) are NOT writable on stock: the binary monitor exposes only the whole status register, so those names are refused with an explanation."
```

#### WR-02: The 03-15 leak registry covers one of four server factories and none of the control listeners

**File:** `.claude/mcp/vice/vice-proxy.test.ts:140-165`, registration only at `221-222`
**Issue:** `OPEN_SERVERS.add(server)` is called only inside `startStandInServer()`
(62 call sites). The file has three other HTTP-server factories and one TCP-listener
factory that are never registered:

| Factory | Line | Call sites | Registered? |
|---|---|---|---|
| `startStandInServer` | 179 | 62 | yes |
| `startBigPayloadServer` | 984 | 4 | **no** |
| `startAliveButFailingServer` | 1630 | 2 | **no** |
| `startFlexibleStandInServer` | 5326 | 28 | **no** |
| `startControlBroker` (real `startControlListener`) | 2121 | 29 | **no** |

The registry's own header says it exists "so that if a FUTURE test reintroduces the
same open-before-try shape, the suite still terminates." For ~63 of ~125 listener
acquisitions in this file, it does not: an `open-before-try` throw at any of those
sites still orphans a LISTEN socket and hangs `npm test` with no diagnostic — the exact
2026-08-16 failure this plan was written to net.

**Fix:** register inside each factory (and inside `startControlBroker` for the
`NetServer`), not at one of them:
```ts
function trackServer<T extends Server | NetServer>(server: T): T {
  OPEN_SERVERS.add(server);
  server.once("close", () => OPEN_SERVERS.delete(server));
  return server;
}
// then in every factory: const server = trackServer(createServer(...));
```

#### WR-03: `test-gate.mjs` can report success having run zero tests

**File:** `.claude/mcp/vice/test-gate.mjs:44-47, 53-57, 59-69`
**Issue:** Two independent false-green vectors in the file that is the declared
"single source of truth" for the automated gate:

1. `automatedTestFiles(process.cwd())` (line 61) globs the **current working
   directory**, not the module's own directory. Invoked as
   `node .claude/mcp/vice/test-gate.mjs` from the repo root, `readdirSync` finds no
   `*.test.*`, `files` is `[]`, and `runNodeTest([])` spawns bare `node --test`, which
   falls back to Node's own discovery and exits **0**. `npm run test:automated`
   reports success having executed nothing.
2. The direct-invocation guard `import.meta.url === \`file://${process.argv[1]}\``
   (line 67) is string concatenation, not URL construction. Any repo path containing a
   space, `#`, `%` or a non-ASCII character makes it false, `main()` never runs, and
   the process exits 0 — again, a green gate that ran nothing.

Neither trips on this machine (`/home/henrik/dev/...`, cwd set by the npm script),
which is precisely why it will not be noticed until it matters.

**Fix:**
```js
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));

function main() {
  const manual = process.argv.includes("--manual");
  const files = manual ? [...MANUAL_ONLY_TESTS] : automatedTestFiles(HERE);
  if (files.length === 0) throw new Error(`test-gate: no test files found in ${HERE} -- refusing to report a pass`);
  process.exit(runNodeTest(files.map((f) => join(HERE, f))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

#### WR-04: Nothing asserts the env gate is OPEN where it is meant to be open

**File:** `.claude/mcp/vice/vice-proxy.test.ts:75-76`,
`.claude/mcp/vice/broker-e2e.test.ts:32-36`,
`.claude/mcp/vice/vice-broker-launch.test.ts:37-40`
**Issue:** Eight tests — including all four container-guard refusal tests, which are
the regression proof for a *safety* invariant (the broker must never launch `x64sc`
inside a container) — are now `{ skip: WORKSPACE_ENV ? false : REASON }`. CI supplies
`CONTAINER_WORKSPACE_PATH`/`HOST_WORKSPACE_PATH` from `ci.yml`'s top-level `env:`
block, so they run there today. But no test asserts that. If that `env:` block is
edited, renamed, or scoped to a different job, every one of those tests silently
degrades to SKIP and CI stays green — the failure mode is invisible in the exit code
and only visible in TAP output nobody reads. That is exactly the "env-gated skips
silently hide real failures" risk. (Note the gate is coincidentally self-consistent:
`CONTAINER_WORKSPACE_PATH` being set *is itself* one of `container-guard.mts`'s five
signals, so opening the gate is what makes the guard fire — which makes a silent
close even harder to notice.)

**Fix:** add one drift guard to `test-gate.test.ts` (the file that already owns
gate drift):
```ts
test("gate: the workspace env gate must be OPEN in CI -- a silently-closed gate skips the container-guard suite", () => {
  if (!process.env.CI) return;
  assert.ok(
    process.env.CONTAINER_WORKSPACE_PATH && process.env.HOST_WORKSPACE_PATH,
    "CI must set CONTAINER_WORKSPACE_PATH and HOST_WORKSPACE_PATH (ci.yml env:) or the path-translation and container-guard tests skip silently",
  );
});
```

#### WR-05: `stock-live.test.ts` can still orphan an `x64sc` process and a scratch dir

**File:** `.claude/mcp/vice/stock-live.test.ts:152-209`
**Issue:** The file's own WHAT NOT TO DO says "Never acquire the child process or the
socket outside the try/after pair" — but the `before()` hook does exactly that for
part of its body. Only `connectWithRetry()` sits inside the try/catch that kills the
child. If `attachRunStateTracker(client)` (line 178) or the session/deps object
construction (lines 180-206) throws, `fixture` is never assigned, `after()` returns at
line 212 on `if (!fixture) return`, and the spawned emulator is **never killed** and
the `mkdtempSync` scratch dir is never removed. Same for a throw out of `spawn()`
itself (line 160), which happens after `mkdtempSync` (line 156). Small windows, but
this file exists specifically to prove that window is closed.

**Fix:** record the teardown handles the instant they exist, before anything else can
throw:
```ts
const child = spawn(...);
fixture = { child, client: null as unknown as ViceMonitorClient, deps: null as never, scratchDir };
// ...then fill in client/deps once built; after() already tolerates a partial fixture
```
or wrap the whole hook body in `try { ... } catch (err) { child?.kill("SIGKILL"); rmSync(scratchDir, {recursive:true, force:true}); throw err; }`.

#### WR-06: The opt-in skip message states a default that can never apply

**File:** `.claude/mcp/vice/stock-live.test.ts:74-85`
**Issue:** The skip text says *"Defaults to `/usr/bin/x64sc` when set to a truthy
non-path value."* That is false. `resolvedBinPath = process.env.VICE_LIVE_STOCK_BIN ?? DEFAULT`
only falls back when the variable is **unset** — and when it is unset, the first
branch skips unconditionally, so `VICE_LIVE_STOCK_BIN_DEFAULT` is never the value the
tests actually run against. A user following the message with
`VICE_LIVE_STOCK_BIN=1` gets the *second* skip reason (`"1" does not exist on disk`),
not the documented default. I reproduced the message verbatim in the default-skip run.

**Fix:** either delete the sentence, or make it true:
```ts
const raw = process.env.VICE_LIVE_STOCK_BIN;
const resolvedBinPath = raw && raw.startsWith("/") ? raw : VICE_LIVE_STOCK_BIN_DEFAULT;
```

#### WR-07: The widened `vice-proxy:` identity detector opens a new false-negative class

**File:** `.claude/mcp/vice/vice-proxy.test.ts:3856-3875`
**Issue:** The rule changed from "`console.error(` immediately precedes the literal" to
"the nearest preceding `console.error(` is nearer than the nearest preceding
`text:` / `content:` / `isErrorText(`". That fixes the real ternary (I confirmed lines
3275-3276 are the only two matches the old 40-char lookback missed), but it also
exempts *any* `vice-proxy:` literal that reaches the agent through a path that is not
one of those three markers. Concretely, this now passes the guard:

```ts
console.error(`some unrelated line`);
throw new ViceError(`vice-proxy: ...`);   // agent-visible via the error path, now EXEMPT
```

Secondary defect in the same function: `before.lastIndexOf("text:")` matches the
substring inside the ordinary English word `"context:"`, so a comment mentioning
"context:" acts as an agent-visible marker and can flip an exempt literal into a
reported violation. The heuristic is documented as a heuristic, but its new blind spot
(thrown errors) is not the one the header names.

**Fix:** add `throw new` / `Error(` to the marker set, and anchor the `text:` marker so
it cannot match mid-word:
```ts
const markers = [/(^|[^A-Za-z])text:/g, /content:/g, /isErrorText\(/g, /throw new /g];
const lastMarker = Math.max(...markers.map((re) => lastMatchIndex(before, re)));
```

#### WR-08: `README.md` Development section is already stale against this same wave

**File:** `.claude/mcp/vice/README.md:67-68` and the Environment table at `47-52`
**Issue:** Two drifts introduced/left by this wave:
1. Line 67 says `npm run test:automated` "excludes the **three** manual-only files".
   Plan 03-16 made it four (`test-gate.mjs:34-39`), and `test-gate.test.ts:16` asserts
   "exactly the four dispositioned files". The README is the only place still saying
   three — a reader now gets a different count from the docs than from the guard test.
2. Plan 03-16 introduced a new environment variable, `VICE_LIVE_STOCK_BIN`, and did not
   add it to the README's Environment table, which lists every other consumer-facing
   variable.

**Fix:** change "three" → "four", and add
`| \`VICE_LIVE_STOCK_BIN\` | Absolute path to a genuinely unpatched stock VICE binary; opts \`stock-live.test.ts\` in (default-skipped). |`
to the Environment table.

### Info

#### IN-01: `in` operator walks the prototype chain on the flag-bit table

**File:** `.claude/mcp/vice/stock-registers.ts:256`
**Issue:** `if (name in FLAG_BIT_POSITIONS)` tests `Object.prototype` too. Not
exploitable today (the key is `.toUpperCase()`d and every `Object.prototype` member is
camelCase, so `"TOSTRING"`/`"CONSTRUCTOR"` never hit), but it is one lowercase change
away from a wrong branch, and `FLAG_BIT_POSITIONS[name]` would then interpolate
`undefined` into "test/set bit undefined".
**Fix:** `if (Object.hasOwn(FLAG_BIT_POSITIONS, name))`, or declare the table as a
`Map<string, number>`.

#### IN-02: `registerCatalogFor()` has no in-flight dedupe

**File:** `.claude/mcp/vice/stock-registers.ts:99-129`
**Issue:** The header states the catalog is fetched "exactly once and cached", but the
cache is only written after `await session.client.send(...)` resolves. Two handlers
awaiting concurrently on a fresh session both miss the cache and both send
REGISTERS_AVAILABLE. Harmless on the wire, but it contradicts the stated invariant and
the "never re-fetch the catalog per call" WHAT NOT TO DO rule.
**Fix:** cache the in-flight `Promise<RegisterCatalog>` rather than the resolved value.

#### IN-03: The leak registry's `NetServer` union member is dead, and would not work if used

**File:** `.claude/mcp/vice/vice-proxy.test.ts:140, 146-152`
**Issue:** `Set<Server | NetServer>` never receives a `NetServer` (see WR-02).
If one were added, `closeAllConnections?.()` is `undefined` on `net.Server`, so
`close()` would not complete while any control-plane socket is still open and the
event loop would stay alive — the net would not actually net it.
**Fix:** when fixing WR-02, `server.unref()` (or destroy tracked sockets) for the
`net.Server` branch instead of relying on `close()`.

#### IN-04: Stale source line references in a test comment

**File:** `.claude/mcp/vice/stock-registers.test.ts:50-52`
**Issue:** The comment cites `stock-registers.ts:260-268` as the pre-fix location; that
range no longer exists after the 03-14 edit (the width ladder is now 272-290).
**Fix:** cite the plan/commit (`03-14-PLAN.md`, `ff82edc`) rather than line numbers.

#### IN-05: Shebang on a non-executable test file

**File:** `.claude/mcp/vice/stock-live.test.ts:1`
**Issue:** `#!/usr/bin/env node` is the project's convention for standalone scripts;
no other `*.test.ts` in this directory carries one, and this file is never invoked
directly (it is run by `node --test`).
**Fix:** drop the shebang.

#### IN-06: Live flag-refusal assertion is weakly anchored

**File:** `.claude/mcp/vice/stock-live.test.ts:373-377`
**Issue:** `new RegExp(statusEntry.name)` — the status register name is resolved from
the live catalog and may be a single character (`"P"` is in
`STATUS_REGISTER_CANDIDATES`). On such a build the assertion matches almost any
refusal text, including one that never mentions the status register.
**Fix:** assert on the full phrase the handler emits, e.g.
`` new RegExp(`as "${escaped}"`) ``.

---

## Verification performed during this review

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run test:automated` | 955 tests, 0 fail, 5 todo |
| `node --test stock-live.test.ts` (no opt-in) | 2 skipped, exit 0, 280ms — cannot hang CI |
| `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` | 2 pass, 1.98s; A=42 round-trip, PC=0xC000, `0..0xff` refusal, all 7 flag refusals name `FL`, `runState: stopped` |
| Orphan check (`pgrep -af x64sc` after live run) | no test-spawned process left behind |
| `npm pack --dry-run` | no test file, and no `test-gate.mjs`, leaks into either tarball |
| Fork manifest (`tools-manifest.json`) unchanged in diff | confirmed |

---

_Reviewed: 2026-08-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (gap-closure scope, base `eb4f9b6`)_
