# Testing Patterns

**Analysis Date:** 2026-08-11

## Test Framework

**Runner:**
- Node's built-in test runner, `node:test` — no Jest, Vitest, or Mocha. Every test file imports
  `import { test } from "node:test";`.
- No config file exists for the runner; behavior is whatever `node --test` defaults to.
- Config used only in `.claude/mcp/vice/package.json`'s `scripts.test`: `node --test '*.test.*'`
  (glob matches both `.test.ts` and `.test.mjs` in that directory, non-recursive — tests live
  flat alongside their source files, not in a nested `test/`/`__tests__/` directory).
- TypeScript test files (`.test.ts`) run directly under Node's native type-stripping — no ts-node,
  no Babel, no compile step. This requires Node >=22.18.0 (`package.json`'s `engines` field) and
  relies on `tsconfig.json`'s `erasableSyntaxOnly: true` (only syntax Node's stripper can erase is
  allowed — e.g. no `enum`, no parameter-property shorthand in constructors).
- Skill scripts (`.claude/skills/*/scripts/*.mjs`) have their own `.test.mjs` siblings run the same
  way, but are not wired into `.claude/mcp/vice`'s `npm test` — run them directly with
  `node --test path/to/file.test.mjs` or `node --test` from within that skill's `scripts/` dir.

**Assertion Library:**
- `node:assert/strict` exclusively: `import assert from "node:assert/strict";`. Uses
  `assert.equal`, `assert.deepEqual` (strict variants under this import), `assert.ok`,
  `assert.throws`, `assert.rejects`, `assert.notEqual`.
- Every assertion call includes a descriptive third-argument message explaining WHAT property is
  being checked and often WHY it matters, not just a bare comparison:
  ```ts
  assert.equal(
    resourcesLauncherVals.repo_root,
    launcherVals.repo_root,
    "resources/vice-launcher.sh and tools/vice-launcher.sh must agree on repo_root even though self_dir/broker_artifact deliberately differ"
  );
  ```

**Run Commands:**
```bash
cd .claude/mcp/vice
npm ci --no-audit --no-fund   # install deps first (package-lock.json committed)
npm run typecheck             # tsc --noEmit -p tsconfig.json (strict mode gate)
npm test                      # node --test '*.test.*'
npm run smoke                 # node smoke.mjs -- boots the MCP server for real, checks the handshake
```
No coverage tool is configured (no `c8`, `nyc`, or `--experimental-test-coverage` flag wired into
`npm test`) — coverage is not measured or enforced anywhere in this repo.

## Test File Organization

**Location:** Strictly co-located, flat, same directory as the implementation file — never a
separate `test/`, `tests/`, or `__tests__/` directory.

**Naming:** `<module-basename>.test.ts` for TypeScript modules (`repo-root.ts` ->
`repo-root.test.ts`), `<module-basename>.test.mjs` for skill scripts (`d64-parse.mjs` ->
`d64-parse.test.mjs`). One test file per implementation file is the norm, though some test files
cover a cluster of closely related modules (e.g. `broker-launch.test.ts` also imports
`broker-state.mts` and `broker-epoch.mts` functions it needs as fixtures for the module actually
under test).

**Structure within a file:** Long files use `// ---- section ----` or `// ==== section ====`
divider comments to group related `test()` calls under a named concern (see `containerpath.test.ts`'s
`round-trip`, `D-3`, `real captured grant`, `loopback matrix` sections). There is no `describe()`
nesting — `node:test`'s flat `test()` is used throughout; grouping is purely comment-based plus
long, self-describing test names.

## Test Structure

**Suite organization** — flat `test()` calls with long, sentence-style names that state the exact
property under test and often the reason it matters:
```ts
test("repoRoot() ladder: a .git ancestor resolves with no env set; a containing CONTAINER_WORKSPACE_PATH wins over a NEARER .git; a non-containing CONTAINER_WORKSPACE_PATH loses to the .git walk", () => {
  const outer = mkdtempSync(join(tmpdir(), "reporoot-"));
  mkdirSync(join(outer, ".git"));
  ...
  assert.equal(repoRoot({ from: inner, env: {} }), outer);
});
```
A single `test()` block commonly asserts several related sub-cases in sequence (numbered `1.`,
`2.`, `3.` in comments) rather than splitting into many tiny tests, when the sub-cases share setup
and are conceptually one property (e.g. one precedence ladder).

**Setup/teardown:**
- No `beforeEach`/`afterEach` hooks are used anywhere observed. Setup is inline per-test, typically
  `mkdtempSync(join(tmpdir(), "<prefix>-"))` to get an isolated real filesystem directory per test.
- Cleanup is often *not* explicit (relies on OS temp cleanup) for simple cases, but tests that spawn
  real child processes or servers use `try { ... } finally { rmSync(dir, { recursive: true, force:
  true }); child.kill(); }`-style teardown inline within the test body.
- Global mutable state (e.g. `console.error`) that a test needs to silence is saved and restored
  within the test itself:
  ```ts
  const originalError = console.error;
  console.error = () => {};
  try { ... } finally { console.error = originalError; }
  ```

**Assertion density:** Prefer several separate, individually-labeled `assert.equal`/`assert.ok`
calls over one aggregate `assert.deepEqual` when a test's purpose is "catch a partial regression" —
explicit comment: "Three separate expectations -- translating two fields and forgetting the third
must fail this test, not just the aggregate `changes.length` below."

## Mocking

**No mocking library is used** — no `sinon`, no `jest.mock`, and `node:test`'s own `t.mock`/`mock.fn`
API was not found in use anywhere in the suite. Test isolation is achieved through three patterns
instead, in order of preference:

1. **Dependency injection via optional parameters** — the primary pattern. Functions under test
   accept an options object whose fields default to the real implementation/environment but can be
   overridden in a test:
   ```ts
   repoRoot({ from: inner, env: {} })          // env injection instead of mutating process.env
   superviseChild({ spawn: fakeSpawn, ...epochDeps })  // injected spawn instead of a real process
   ```
2. **Hand-built fake objects that satisfy a real interface**, not a mocking-framework double — e.g.
   `broker-launch.test.ts` builds "a fully-controlled stand-in ChildProcess" as a real
   `EventEmitter` with a fake `pid`, so the code under test's real `child.once("exit", ...)` wiring
   runs unmodified against it, and the test controls timing by calling `.emit("exit", ...)` itself.
3. **Real subprocesses, real temp directories, real sockets/servers** for integration-shaped tests —
   `broker-e2e.test.ts` spawns the actual built `resources/vice-broker.mjs` artifact under `node`,
   with `VICE_BIN` stubbed to `/bin/sleep` so no real emulator ever runs, and drives it over a real
   TCP connection using the real client code (`acquireOverControlPlane()`). `vice-proxy.test.ts`
   spins up a real `node:http` server as a stand-in host MCP endpoint.

**What to mock (i.e., inject a fake for):** the external boundary that would otherwise require a
real emulator (`x64sc`/VICE), a real network host, or non-deterministic timing (spawn functions,
epoch/clock-adjacent writers, `console.error` for noise suppression).

**What NOT to mock:** the module under test's own real logic, and any adjacent first-party module
whose real behavior is cheap and deterministic to run (e.g. `broker-launch.test.ts` imports the
REAL `epochPathFor`/`writeEpochRecord` from `broker-epoch.mts` rather than faking them, explicitly
noting these are "the REAL... functions, injected... exactly like [the real caller's] wiring will
eventually inject them").

## Fixtures and Factories

**Frozen fixture files:** `.claude/mcp/vice/fixtures/*.json` (`bash-broker.json`,
`bash-epoch-6510.json`, `bash-epoch-6514.json`) are byte-for-byte captures of real prior runtime
state, documented in `.claude/mcp/vice/fixtures/README.md` as "FROZEN EVIDENCE ... never to be
regenerated, reformatted, 'tidied', or hand-edited" — they pin a contract a since-deleted script
used to produce, so a rewrite can be proven behavior-compatible. Treat any file under `fixtures/`
as read-only unless the README documents otherwise.

**In-test synthetic data builders:** rather than a separate fixtures/factories module, test files
define small local builder functions at the top of the file, e.g. `d64-parse.test.mjs`'s
`blankImage()` (builds a well-formed synthetic 35-track D64 image byte-for-byte) and
`writeDirEntry()`/`markTrackOccupied()` helpers used to construct specific defect scenarios. These
builder functions are colocated in the test file itself, not shared across files.

**Polling helper convention:** async tests that wait on eventual state (a child process reaching a
condition, a file appearing) use a local `waitFor(predicate, { timeoutMs, pollMs })` helper that
polls on a short interval to a bounded deadline — never a fixed `setTimeout` sleep. This exact
helper is redefined locally in multiple files (`broker-launch.test.ts`, `broker-e2e.test.ts`,
`host-scripts.test.ts`) rather than imported from a shared test-utils module; follow the same
polling-over-sleeping approach when adding new async tests.

## Coverage

**Requirements:** None enforced. No coverage tool is wired into CI or `npm test`.

**View Coverage:** Not applicable — would require running
`node --experimental-test-coverage --test '*.test.*'` manually; no npm script exists for this.

## Test Types

**Unit tests:** The majority — pure functions and small modules tested in isolation with injected
dependencies (e.g. `repo-root.test.ts`, `containerpath.test.ts`, `d64-parse.test.mjs`).

**Integration tests:** Tests that exercise multiple real modules together against a real
filesystem/subprocess but stub only the true external boundary — e.g. `install-resources.test.ts`,
`resources-sync.test.ts`, `load-order.test.ts`, `host-scripts.test.ts` (spawns real shell scripts
via `execFile`), and the `path agreement` tests in `repo-root.test.ts` that run both a bash script
and a fresh Node child process and assert they agree.

**End-to-end tests:** `broker-e2e.test.ts` is the explicit E2E test — builds the real compiled
artifact, spawns it as a real OS process, and drives it over a real TCP connection with the real
client library, verifying "the WHOLE path this plan wires, not one layer of it." `VICE_BIN` is
stubbed to `/bin/sleep` so no real VICE emulator is ever required or contacted.

**CI gate:** `npm run smoke` (`smoke.mjs`) additionally boots the actual MCP server process under
Node's type-stripping and performs a real MCP handshake — a smoke test distinct from and run after
the main `npm test` suite in `.github/workflows/ci.yml`.

## Common Patterns

**Async testing:**
```ts
test("acquire: resolves a typed deadline failure within its own bound and does not hang, using a short bound injected for the test", async () => {
  // async test functions are used directly; no done() callback style anywhere
  const result = await acquireOverControlPlane(/* ... */);
  assert.equal(result.outcome, "deadline_exceeded");
});
```
Async tests `await` real promises/child-process exits directly; long-running waits use the local
`waitFor()` polling helper (see Fixtures section) rather than a fixed sleep.

**Error testing:**
```ts
test("tsToOffset throws for a track below 1", () => {
  assert.throws(() => tsToOffset(0, 0), /track 0 out of range/);
});
```
`assert.throws(fn, /regex/)` matching against the thrown error's message is the standard idiom —
error messages are written expecting to be matched this way (see CONVENTIONS.md's Error Handling
section on message content).

**Guard-removal-sensitivity as a design goal:** test file headers frequently state the intent
explicitly, e.g. `containerpath.test.ts`: "Every test here is guard-removal-sensitive (D-6): each
one is written so it fails if the property it covers is removed, not merely absent from a
description." When writing a new test, prefer asserting the actual side effect/output value over
merely asserting that a function "was called" or "didn't throw."

---

*Testing analysis: 2026-08-11*
