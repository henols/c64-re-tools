# Testing Patterns

**Analysis Date:** 2026-09-01

## Test Framework

**Runner:**
- Node's built-in test runner (`node:test`) — no Jest, Vitest, or Mocha, and no runner config
  file. Every test file does `import { test } from "node:test";`.
- TypeScript test files (`.test.ts`) run directly under Node's native type-stripping — no ts-node,
  no Babel, no compile step. Requires **Node >= 24** (`src/mcp/vice/package.json` `engines`) and
  relies on `tsconfig.json`'s `erasableSyntaxOnly: true` (no `enum`, no constructor parameter
  properties — otherwise the stripper cannot run the file).

**Assertion library:**
- `node:assert/strict` exclusively: `import assert from "node:assert/strict";`. `assert.equal`,
  `assert.deepEqual`, `assert.ok`, `assert.match`, `assert.doesNotMatch`, `assert.throws`,
  `assert.rejects`.
- Every assertion carries a descriptive third-argument message saying WHAT is being checked and
  usually WHY it matters:
  ```ts
  assert.equal(
    probeCalls,
    1,
    "a broker that resolves the backend once at startup and reuses the answer for every later launch must never probe twice"
  );
  ```

**Run commands:**
```bash
cd src/mcp/vice
npm ci --no-audit --no-fund   # package-lock.json is committed
npm run typecheck             # tsc --noEmit -p tsconfig.json (strict) -- the only static gate
npm run test:automated        # node test-gate.mjs      <-- USE THIS LOCALLY
npm run test:manual           # node test-gate.mjs --manual (the 9 manual-only files)
npm test                      # node --test '*.test.*'  <-- HANGS LOCALLY, see traps below
npm run smoke                 # node smoke.mjs -- boots the MCP server, real MCP handshake

cd installer && npm test                                  # node --test '*.test.mjs'
node --test 'src/skills/*/scripts/*.test.mjs'             # the 5 skill suites
```

### Trap 1 — `npm test` blocks forever locally

`npm test` is the full `node --test '*.test.*'` glob over all 129 test files in
`src/mcp/vice/`. It **blocks forever on `vice-proxy.test.ts`** on a normal host (and
`vice-broker-launch.test.ts` / `broker-e2e.test.ts` stall the same way outside a devcontainer).
Do not use it as the local entry point. It is nonetheless what CI runs, deliberately — see
the CI section.

### Trap 2 — `test:automated` skips a manual-only set

`src/mcp/vice/test-gate.mjs` is the single source of truth for the split. It exports
`MANUAL_ONLY_TESTS`, a frozen list of **nine** files that `npm run test:automated` removes from
the glob:

| File | Why manual-only |
|------|-----------------|
| `vice-broker-launch.test.ts` | needs real broker topology; hangs outside devcontainer |
| `vice-proxy.test.ts` | hangs outside devcontainer; holds the only end-to-end wire proof (BACK-05) |
| `broker-e2e.test.ts` | spawns the real compiled broker artifact |
| `stock-live.test.ts` | opt-in `VICE_LIVE_STOCK_BIN`, spawns a real emulator |
| `stock-live-triage.test.ts` | opt-in `VICE_LIVE_TRIAGE_BIN`, real kill-and-relaunch |
| `stock-live-broker-monitor.test.ts` | opt-in `VICE_LIVE_BROKER_BIN`, real broker + emulator |
| `stock-broker-live.test.ts` | opt-in `VICE_LIVE_STOCK_BIN`, real broker + genuine-stock VICE |
| `fork-live.test.ts` | opt-in `VICE_LIVE_FORK_BIN`, real fork `-mcpserver` transport |
| `stock-a4-checkpoint-flood.test.ts` | opt-in `VICE_LIVE_A4_FLOOD_BIN`, drives a checkpoint flood that can stall the emulator thread on purpose |

`automatedTestFiles(dir)` in `test-gate.mjs` computes the automated set by subtraction from a real
`readdirSync`, and `test-gate.test.ts` is a drift guard that fails the build if any test file
escapes both lists. **Do not add a second list of these names anywhere** (npm script, CI workflow,
second runner) — that prohibition is written into `test-gate.mjs`'s header.

**Standing rule (2026-08-18):** every payload shape a manual-only live suite depends on MUST have
a mirror assertion in the automated set, because a manual-only file is invisible to the gate. The
worked example is `stock-diagnose.test.ts`'s shape oracle for the restarted verdict's evidence
("both restarted branches carry EXACTLY `{baselineEpoch, currentEpoch, jamObserved}`") — it needs
no emulator, so it runs in the gate and reds the moment the live suite's assumed shape would.

### Trap 3 — expected-failure floor

**`test-gate.mjs` carries NO hardcoded failure baseline.** It spawns
`node --test <automated files>` with stdio inherited and exits with the child's status verbatim.
Earlier notes describing a 44-, 7-, or 5-failure baseline inside this gate are **superseded** —
verified against the current script: the only occurrence of the word "baseline" in the file is
inside a comment about `baselineEpoch`. **The current expected-failure floor is 0.** A non-zero
exit is a real regression, with one exception:

### Trap 4 — a live VICE broker deterministically reds one test

A running broker makes `vice-proxy.test.ts`'s **`"BACK-05 (D-G ordering, observed at the wire)"`**
test fail deterministically (not a flake; measured both directions at one commit: broker up →
`# fail 1`, broker down → `# pass 1`). Mechanism: the test starts its proxy with
`VICE_BACKEND: "stock"`; a broker already owning the emulator as `fork` makes the proxy's
backend-mismatch guard fire correctly, and the advice text (containing `VICE_BACKEND=fork`) trips
the test's own `doesNotMatch` assertion. The product code is right; the test is not isolated from
ambient host state. This test lives in the manual-only set, so it only bites `npm test` /
`npm run test:manual` — **stop the broker before trusting any full-suite reading.** With the
broker down, the full suite was green end to end (`# pass 2593  # fail 0`, exit 0).

Also: `npm test` rewrites the committed evidence file
`.planning/phases/18-persistent-session-and-tool-surface/evidence/18-session-reuse-transcript.json`
on every run — `git checkout --` that exact path afterwards.

## Test File Organization

**Location:** strictly co-located and flat, same directory as the implementation. Never a
`test/`, `tests/`, or `__tests__/` directory. Four locations hold tests:
- `src/mcp/vice/*.test.ts` / `*.test.mjs` — 129 files, the bulk of the suite.
- `installer/wire-mcp.test.mjs` — pins `wireMcp()`, the installer's only code that rewrites a file
  it does not own (a consumer's `.mcp.json`).
- `src/skills/*/scripts/*.test.mjs` — 5 files: `d64-parse`, `watch-loads`, `dump-artifacts`
  (c64-ram-capture), `diff-images` (c64-provenance-diff), `packer-finding` (c64-program-recon).
- `scripts/lib/` helpers are proven by test files under `src/mcp/vice/` (e.g. `removal-gate.test.ts`
  proves `scripts/check-no-analyser.mjs`, `guard-fates.test.ts` proves
  `scripts/check-guard-fates.mjs`).

`ci-suite-coverage.test.ts` exists to keep this from drifting: it derives the set of directories
holding committed test files from the repository itself and fails when a directory is not provably
covered by a step in `.github/workflows/ci.yml`'s `build` job. Adding a test file in a new
directory therefore requires adding a CI step.

**Naming:** `<module-basename>.test.ts` / `.test.mjs`. One test file per module is the norm; some
files cover a cluster (`broker-launch.test.ts` also imports `broker-state.mts` / `broker-epoch.mts`
as real fixtures).

## Test Structure

**Flat `test()` calls with long, sentence-style names** stating the exact property and often why it
matters:
```ts
test("repoRoot() ladder: a .git ancestor resolves with no env set; a containing CONTAINER_WORKSPACE_PATH wins over a NEARER .git; a non-containing CONTAINER_WORKSPACE_PATH loses to the .git walk", () => {
  const outer = mkdtempSync(join(tmpdir(), "reporoot-"));
  ...
  assert.equal(repoRoot({ from: inner, env: {} }), outer);
});
```
A single `test()` commonly asserts several related sub-cases in sequence (numbered `1.`, `2.`,
`3.` in comments) when they share setup and are conceptually one property.

**`describe()` is used sparingly**, only where a file has genuinely separate concern groups —
`disasm-renderer.test.ts`, `disasm-decoder.test.ts`, `disasm-opcodes.test.ts`,
`anno-coverage-grammar.test.ts`, `audit-integrity.test.ts`, `ci-suite-coverage.test.ts`.
Elsewhere grouping is comment-based (`// ---- section ----` / `// ==== section ====`).

**Setup/teardown:**
- `beforeEach` IS now used, but for exactly one purpose: resetting module-level caches in the
  stock backend via the exported `reset*ForTest()` functions. This is the pattern for any module
  with a cache:
  ```ts
  import { test, beforeEach } from "node:test";
  beforeEach(() => {
    resetBankCatalogsForTest();
    resetRunStateTrackersForTest();
  });
  ```
  Files doing this: `stock-memory`, `stock-checkpoints`, `stock-address`, `stock-execution`,
  `stock-diagnose`, `stock-recycle`, `stock-input`, `stock-sprites`, `stock-disassemble`,
  `stock-timing`, `stock-symbols`.
- Otherwise setup is inline per-test, typically `mkdtempSync(join(tmpdir(), "<prefix>-"))` for an
  isolated real directory. Tests that spawn processes or servers clean up with inline
  `try { ... } finally { rmSync(dir, { recursive: true, force: true }); child.kill(); }`.
- Global mutable state a test needs to silence (`console.error`) is saved and restored inside the
  test body.

**Skip/opt-in:** live suites use `{ skip: ... }` on `test()` keyed off their opt-in env var, so
they are a named SKIP rather than a failure when the binary is absent. The inverse also exists:
`VICE_REQUIRE_ACME=1` turns `disasm-roundtrip.test.ts`'s "ACME absent" SKIP into a hard FAIL, and
CI sets it.

**Assertion density:** prefer several separate, individually-labelled assertions over one aggregate
`deepEqual` when the purpose is catching a partial regression — "translating two fields and
forgetting the third must fail this test, not just the aggregate `changes.length`".

## Mocking

**No mocking library.** No `sinon`, no `jest.mock`. `node:test`'s own `mock` API appears in only
four files (`vice-proxy.test.ts`, `stock-execution.test.ts`, `anno-store.test.ts`,
`stock-live-triage.test.ts`) and is not the house pattern. Isolation is achieved four ways, in
order of preference:

1. **Dependency injection via optional parameters / deps objects** — the primary pattern:
   ```ts
   repoRoot({ from: inner, env: {} })                 // env injection, never mutate process.env
   superviseChild({ spawn: fakeSpawn, ...epochDeps }) // injected spawn
   handleMemoryRead(session, args, DEPS)              // StockDispatchDeps stub
   ```
2. **Hand-built fakes satisfying the real interface.** The stock-backend convention, stated in
   `stock-memory.test.ts`'s header and shared with `stock-dispatch.test.ts`: a fake
   `StockConnectSession` whose `client` is a **real `EventEmitter`** with a `send` spy recording
   every call as `[commandType, body]`, and a `sendImpl` callback deciding what each call resolves
   or throws:
   ```ts
   const client = Object.assign(new EventEmitter(), {
     send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
       calls.push([commandType, body]);
       return sendImpl(commandType, body);
     },
   });
   const session = { client } as unknown as StockConnectSession;
   ```
   These tests assert **wiring** — call order, call count, byte-level body contents, answer shape
   — never a real protocol round trip. Reply builders (`memoryGetReply()`, `banksAvailableReply()`,
   `ackReply()`) are small local factories at the top of the file.
   `broker-launch.test.ts` uses the same idea for a ChildProcess: a real `EventEmitter` with a
   fake `pid`, so the code's real `child.once("exit", ...)` wiring runs unmodified and the test
   controls timing by emitting itself.
3. **Real subprocesses, real temp directories, real sockets** for integration-shaped tests —
   `broker-e2e.test.ts` spawns the real compiled `resources/vice-broker.mjs` under `node` with
   `VICE_BIN` stubbed to `/bin/sleep` (no emulator ever runs) and drives it over real TCP with the
   real client; `vice-proxy.test.ts` stands up a real `node:http` server as the host MCP endpoint.
4. **Real emulator, opt-in only** — the nine manual-only live suites.

**What to fake:** the external boundary only — the emulator binary, a real network host,
non-deterministic timing (spawn, clocks/epoch writers), `console.error` noise.

**What NOT to fake:** the module under test's own logic, and any adjacent first-party module whose
real behaviour is cheap and deterministic — `broker-launch.test.ts` deliberately injects the REAL
`epochPathFor`/`writeEpochRecord` from `broker-epoch.mts` "exactly like the real caller's wiring
will".

## Fixtures and Factories

`src/mcp/vice/fixtures/` holds three kinds of asset:
- **Frozen evidence** — `bash-broker.json`, `bash-epoch-6510.json`, `bash-epoch-6514.json`, plus
  the `binmon/`, `backend-detect/`, `coverage/`, `export-asm/`, `harness-signal/` subdirectories.
  `fixtures/README.md` declares these "FROZEN EVIDENCE ... never to be regenerated, reformatted,
  'tidied', or hand-edited" — byte-for-byte captures of real runtime state pinning a contract a
  since-deleted script produced. Treat everything under `fixtures/` as read-only unless the README
  says otherwise.
- **Planted-violation fixtures** — `planted-disposition-fixture.md`, `planted-hop-chain-fixture.ts.txt`,
  `planted-phase-pointer-fixture.ts.txt`, `planted-removal-fixture.md.txt`,
  `planted-removal-fixture.ts.txt`, `planted-review-fixture.md`. See the planted-violation
  convention below.
- **Mutators/generators** — `anno-durability-mutator.mjs`, `anno-schema-v2-fixture.mjs`,
  `scripts/audit-mutation-harness.mjs`.

**In-test synthetic builders:** rather than a shared factories module, each test file defines small
local builders at the top — `blankImage()` / `writeDirEntry()` / `markTrackOccupied()` in
`d64-parse.test.mjs`, `makeSession()` / `*Reply()` in the stock tests. Colocated, not shared.

**Polling helper convention:** async tests that wait on eventual state use a local
`waitFor(predicate, { timeoutMs, pollMs })` polling to a bounded deadline — never a fixed
`setTimeout` sleep. It is intentionally redefined locally in `broker-launch.test.ts`,
`broker-e2e.test.ts`, `host-scripts.test.ts` rather than shared. Follow polling-over-sleeping for
any new async test.

## Coverage

**Requirements:** none enforced. No coverage tool anywhere — no `c8`, no `nyc`, and
`--experimental-test-coverage` appears in no script, workflow, or config file (verified by grep
across the repo).

**View coverage:** would require running
`node --experimental-test-coverage --test '*.test.*'` by hand; no npm script exists and the full
glob hangs, so scope it to specific files.

What stands in for coverage measurement is a set of **structural coverage guards** that assert
things ARE tested/reachable: `ci-suite-coverage.test.ts` (every test directory is run by CI),
`test-gate.test.ts` (no test file escapes both gate lists), `anno-verb-coverage.test.ts`,
`anno-coverage.test.ts`, `fork-manifest-surface.test.ts`, `stock-schema-check.test.ts`,
`shipped-modules.test.ts`, `module-classification.test.ts`.

## Deliberate coverage exclusion: `vice-sync.ts`

`vice-sync.ts`'s checkpoint-synchronisation primitives — `readCheckpoint()`,
`waitCheckpointHit()`, `runToCheckpoint()`, `reset()`, `screenshot()` — are **by policy not unit
tested**, and this must be preserved. Both `vice-sync.ts`'s and `vice-sync.test.ts`'s headers state
the reason: each is only meaningful against a real emulator's timing, a stub server answering fast
and deterministically "would test the stub, not the invariant, manufacturing a false pass in
exactly the area this project grades most carefully"; and `mcp__vice__*` is the project's only
permitted route to the emulator, so a test process cannot open its own connection. The gap is
recorded as five named `todo` entries in `vice-sync.test.ts` rather than filled with a fake.

The three invariants that stand in for those tests (from `vice-sync.ts`'s header — do not break
them):
1. **Exactly one resume** (`vice_execution_run`) per wait.
2. **Never poll on whether execution is paused — poll on the checkpoint's own `hit_count`.**
3. **Never delete a checkpoint VICE marked `temporary`.**

Everything else in the module (`addrNum`, `hex4`, `POLL_WINDOWS_MS`, `PING_INTERVAL_MS`,
`armedCheckpoints`) is pure or near-pure and IS covered for real in `vice-sync.test.ts`.

## Mechanically-checked documentation (a real convention here)

A substantial slice of the suite asserts on **documentation and comments**, not runtime behaviour.
This exists because a prose decision "written once and never re-checked" is this project's
observed defect class. These files are deliberately kept OUT of `package.json`'s `files[]` (they
verify planning-facing docs, not shipped behaviour) — `scripts/check-npm-packages.mjs` enforces
that.

| Guard | What it asserts |
|-------|-----------------|
| `docs-linerefs.test.ts` | every `vice-proxy.ts:<N>` citation in `CLAUDE.md` **and** `.planning/PROJECT.md` really points at `rewriteArguments(` (call site) or a `function` keyword (function start). Scanned documents are a **declared set** looped over — hard-coding one document is what let a second stale copy live unguarded (D-10, phase 32 plan 32-04). |
| `docs-absorbed-decisions.test.ts` | a superseding dated decision (D-36 over D-32) stays recorded |
| `docs-core-value-decision.test.ts` | `PROJECT.md`'s `## Core Value` dated verdict does not drift |
| `docs-dangling-refs.test.ts` | no deferral points at a phase/requirement that does not exist; no shipped string names a stale phase |
| `docs-deferred-ledger.test.ts` | `STATE.md`'s Deferred Items table matches `.planning/todos/` reality |
| `docs-fork-decision.test.ts` | the fork-backend decision stays a dated decision, not prose drift |
| `docs-review-disposition.test.ts` | every review finding has a recorded disposition |
| `docs-uat-abstention.test.ts` | a UAT file cannot record passes for items nobody tested |
| `docs-worktree-isolation.test.ts` | `workflow.use_worktrees` cannot be silently flipped with standing instructions grown around it |
| `assumption-label-discipline.test.ts` | an `[ASSUMED]` row's label is consistent at every source site naming it |
| `comment-phase-pointers.test.ts` | shipped comments carry no stale phase pointers |
| `hop-chain-comments.test.ts` | hop-chain comments' path references are correct |
| `absorbed-answer-key.test.ts`, `guard-fates.test.ts`, `removal-gate.test.ts`, `audit-integrity.test.ts`, `audit-root-args.test.ts`, `audit-harness-restore.test.ts` | audit/removal ledgers are non-vacuous |
| `skill-attribution.test.ts`, `skill-honesty-checks.test.ts`, `skill-description-overlap.test.ts`, `skill-*-cli.test.ts` | skill docs match the tool surface they claim |

**When you edit a comment, a `CLAUDE.md` bullet, or a `.planning/` decision, expect a test to have
an opinion about it.**

## Planted-violation convention

**A structural guard is proven in this project by a PLANTED VIOLATION OBSERVED RED, never by
reading the guard.** ~20 test files follow this: they construct a document/module that violates the
rule and assert the real rule rejects it. Two flavours:
- **In-memory** (preferred) — the guard's predicates *return* their findings instead of asserting
  internally, so the test drives the REAL rule against a synthetic body with no filesystem writes
  (`docs-linerefs.test.ts`).
- **Fixture file** — `fixtures/planted-*.txt` / `.md`, used when the rule must see a real file.

Re-implementing the rule inside the test proves nothing about the rule the guard applies; that
lesson is recorded at `scripts/check-no-analyser.mjs:149-154`.

## Test Types

- **Unit** — the majority: pure functions and small modules with injected deps
  (`repo-root.test.ts`, `containerpath.test.ts`, `disasm-decoder.test.ts`, `anno-*.test.ts`,
  `stock-*.test.ts`, `d64-parse.test.mjs`).
- **Wiring/protocol** — the `stock-*.test.ts` family: real handlers against a fake session,
  asserting command order, call count, and byte-level request bodies.
- **Integration** — multiple real modules against a real filesystem/subprocess with only the true
  external boundary stubbed: `install-resources.test.ts`, `resources-sync.test.ts`,
  `load-order.test.ts`, `host-scripts.test.ts` (spawns real shell scripts), `build-atomic.test.ts`,
  and the path-agreement tests in `repo-root.test.ts` that run a bash script and a fresh Node child
  and assert they agree.
- **Structural / meta** — the documentation guards, planted-violation gates, `test-gate.test.ts`,
  `ci-suite-coverage.test.ts`, `shipped-modules.test.ts`, `telemetry-import.test.ts`,
  `manifest-arg-compat.test.ts`, `ci-guardrails.test.mjs`, `tool-support-table.test.mjs`.
- **E2E, no emulator** — `broker-e2e.test.ts`: real compiled artifact, real OS process, real TCP,
  real client; `VICE_BIN` stubbed to `/bin/sleep`.
- **Live, opt-in** — the nine `MANUAL_ONLY_TESTS`, each behind its own env var, each default-SKIP.
- **Smoke** — `npm run smoke` (`smoke.mjs`) boots the actual MCP server under type-stripping and
  performs a real MCP handshake.

## CI

`.github/workflows/ci.yml`'s `build` job is the only job that runs on a pull request (`release`,
`publish-npm`, `release-on-merge` all `needs: build` and fire on tag/`main` only). It:
1. checks out with `fetch-depth: 0` (the guard-fate gate fails closed on a missing pinned object);
2. Node 24, `npm ci` in `src/mcp/vice`;
3. `npm run typecheck`;
4. installs ACME and **proves** it is ACME by grepping its banner (with `timeout-minutes: 5` and
   an apt retry helper), so `disasm-roundtrip.test.ts` cannot silently skip;
5. runs **`npm test`** — the wide glob, `VICE_REQUIRE_ACME=1`. This is deliberate: on
   `ubuntu-latest` every `MANUAL_ONLY_TESTS` entry runs to completion in under two minutes with
   zero failures, because none reaches its live branch without its opt-in env var. CI's set is
   deliberately wider than `test:automated`, which exists for local ergonomics (avoiding the
   local hang), not as CI's contract;
6. `npm run smoke`;
7. `cd installer && npm test`;
8. `node --test 'src/skills/*/scripts/*.test.mjs'`;
9. package validation via `scripts/check-npm-packages.mjs` and the structural guards under
   `scripts/`.

It sets `CONTAINER_WORKSPACE_PATH: ${{ github.workspace }}` and
`HOST_WORKSPACE_PATH: /host${{ github.workspace }}` at the workflow level, because the path
translation tests read them.

## Common Patterns

**Async testing** — `async` test functions and direct `await`; no `done()` callback style anywhere.
Long waits use the local `waitFor()` poller.
```ts
test("acquire: resolves a typed deadline failure within its own bound and does not hang, using a short bound injected for the test", async () => {
  const result = await acquireOverControlPlane(/* ... */);
  assert.equal(result.outcome, "deadline_exceeded");
});
```

**Error testing** — `assert.throws(fn, /regex/)` matched against the message; error messages are
written expecting this (see CONVENTIONS.md § Error Handling).
```ts
test("tsToOffset throws for a track below 1", () => {
  assert.throws(() => tsToOffset(0, 0), /track 0 out of range/);
});
```

**Guard-removal sensitivity as a design goal** — test headers state it explicitly
(`containerpath.test.ts`: "Every test here is guard-removal-sensitive (D-6): each one is written so
it fails if the property it covers is removed, not merely absent from a description"). Assert the
actual side effect or output value, never that a function "was called" or "didn't throw".

**Guards must assert their own extraction is well-formed** — e.g. `ci-suite-coverage.test.ts`
checks its regex-extracted CI job block is non-empty and strictly shorter than the whole file, so a
regex bug returning the whole document could not make every later check pass for the wrong reason.

**A test file's header is part of the test** — it names the incident, the requirement id, and what
the file deliberately does not do. Write one for any new test file.

---

*Testing analysis: 2026-09-01*
