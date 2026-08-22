---
phase: 16-packaging-and-repo-shape
plan: 06
subsystem: testing
tags: [node-test, cli-testing, acme, memory-map, program-recon, pkg-02]

requires:
  - phase: 16-packaging-and-repo-shape
    provides: "16-04's relocation of the MCP server package to src/mcp/vice/ (this plan's test files land in the post-move location) and 16-01's relocation of the skills to src/skills/ (the scripts under test)"
provides:
  - "Committed, discovered test coverage for all three previously-untested skill CLI scripts (acme-build, c64-memory-mapping, c64-program-recon), closing PKG-02/QUAL-01"
affects: [17-close-out, any future edit to derive.mjs/driver.mjs/acme.mjs]

actuals:
  tokens: 62000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Subprocess-CLI test pattern (argv vector via spawnSync(process.execPath, [scriptPath, ...]), never a shell string) for scripts that dispatch at module scope"
    - "In-process import pattern for a script that guards its CLI dispatch behind an entry-point check, reused from r2000-cli.test.ts's own convention"
    - "Scoped @ts-expect-error on a single import line (not a shipped sibling .d.mts) as the way to typecheck an import of an unmodifiable, undeclared .mjs skill script without adding a test-only artefact to the published tarball"

key-files:
  created:
    - src/mcp/vice/skill-program-recon-cli.test.ts
    - src/mcp/vice/skill-memory-mapping-cli.test.ts
    - src/mcp/vice/skill-acme-build-cli.test.ts
  modified: []

key-decisions:
  - "Used a single-line @ts-expect-error on driver.mjs's import instead of a sibling driver.d.mts declaration file, after confirming empirically that the .d.mts approach (which mirrors an existing repo precedent, scripts/lib/skill-honesty-checks.d.mts) would leak into the @henols/c64-re-tools installer tarball via sync-skills.mjs, since driver.mjs's declaration file would live inside the distributed src/skills/ tree rather than the CI-only scripts/lib/ tree the precedent uses."
  - "The 'null or absent address' behaviour named in the plan's memory-mapping <behavior> block is genuinely unreachable through the shipped surface: parseAddr()'s `s == null` branch is only reachable from a programmatic call, but only `lookup(addr: number)` is exported (not parseAddr), and the CLI always passes defined string argv elements. Pinned the nearest reachable proxy (an empty-string address argument) to its OBSERVED result (the malformed-address message) instead of inventing an unreachable call path or editing the script to expose parseAddr."

patterns-established:
  - "Pattern 1: derive.mjs/driver.mjs/acme.mjs test structure -- test file computes SCRIPT_PATH via `dirname(fileURLToPath(import.meta.url))` joined two levels up and back into src/skills/<skill>/scripts/<name>.mjs, asserts that path exists as its own first test, then drives every verb as a subprocess with an explicit argument vector."

requirements-completed: [PKG-02]

coverage:
  - id: D1
    description: "derive.mjs (c64-program-recon skill) has committed, discovered test coverage for every verb (vic, sprites, vectors), all three exit codes, radix-marker equivalence, and the exact-size vectors requirement in both directions"
    requirement: "PKG-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-program-recon-cli.test.ts (16 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "driver.mjs (c64-memory-mapping skill) has committed, discovered test coverage for the exported lookup() in process, the CLI's lookup/annotate verbs as subprocesses (all documented address forms, both overflow-message shapes, malformed-address message, stable argument-order output, file/stdin/no-header/empty annotate), and mechanical exclusion of the network-fetching rebuild verb"
    requirement: "PKG-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-memory-mapping-cli.test.ts (17 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "acme.mjs (acme-build skill) has committed, discovered test coverage for every verb (new, build, sym) through the shared r2000-test-gate.ts ACME-availability seam, with the assemble case mirroring CI's own library-free scaffold-and-assemble check including the load-address assertion"
    requirement: "PKG-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-acme-build-cli.test.ts (14 tests, 0 skipped under VICE_REQUIRE_ACME=1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Suite total after this plan is strictly above the 2292-test pre-phase baseline under both npm test and npm run test:automated, with zero new entries in the manual-only exclusion list, and no shipped script or committed data file changed"
    requirement: "PKG-02"
    verification:
      - kind: integration
        ref: "VICE_REQUIRE_ACME=1 npm test: 2340 tests / 2296 pass / 0 fail (was 2293/2249); npm run test:automated: 2160/2155/0 fail (was 2129/2124); scripts/package.sh (963 files) and check-npm-packages.mjs (36 files for @henols/c64-re-tools) both exit 0"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-22
status: complete
---

# Phase 16 Plan 06: Skill CLI Test Coverage (PKG-02) Summary

Three new `node --test`-discovered files give the acme-build, c64-memory-mapping and
c64-program-recon skills' CLI scripts (`acme.mjs`, `driver.mjs`, `derive.mjs`) their first
tests, driving each verb through the surface it actually supports — subprocess for the two
scripts that dispatch at module scope, in-process import for the one that guards its dispatch
behind an entry-point check — while leaving all three scripts byte-for-byte unmodified.

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-22T22:15:00Z (approx.)
- **Completed:** 2026-08-22T23:10:00Z
- **Tasks:** 3
- **Files modified:** 3 (all new test files; no production file touched)

## Accomplishments

- `src/mcp/vice/skill-program-recon-cli.test.ts` (16 tests): every verb of `derive.mjs`
  (`vic`, `sprites`, `vectors`) specified against hand-derived decode values from the script's
  own usage examples, all three distinct exit codes (0/1/2), four-form radix-marker
  equivalence, determinism, and the 65536-byte exact-size requirement asserted in both
  directions (one byte short, one byte long).
- `src/mcp/vice/skill-memory-mapping-cli.test.ts` (17 tests): the exported `lookup()` proven
  in process (safe because `driver.mjs` guards its CLI dispatch behind an entry-point check);
  the CLI's `lookup`/`annotate` verbs driven as subprocesses covering all five documented
  address forms, both overflow-message shapes (with and without the decimal-reading hint),
  the malformed-address message, argument-order-stable output, and file/stdin/no-header/empty
  `annotate` cases; the network-fetching `memmap` verb mechanically excluded via a
  self-scanning test, with the committed `memmap.json` asserted byte-identical before and
  after the suite runs.
- `src/mcp/vice/skill-acme-build-cli.test.ts` (14 tests, 0 skipped under
  `VICE_REQUIRE_ACME=1`): usage/unknown-verb/missing-path/nonexistent-path and the scaffold
  (`new`) verb run unconditionally since none needs an assembler; `build`, `sym`, the
  syntax-error diagnostic parse, and the output-path/output-dir/report-suppression options are
  gated behind the existing `r2000-test-gate.ts` ACME seam (imported, never re-probed); the
  assemble case mirrors CI's own library-free scaffold-and-assemble check exactly, including
  the load-address assertion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify the derivation tool** — `4f8a09d` (test)
2. **Task 2: Specify the memory-map driver** — `caf654f` (test)
3. **Task 3: Specify the assembler driver** — `8fb40ec` (test)

_No separate plan-metadata commit was required beyond this SUMMARY's own commit (below);
`.planning/STATE.md`/`ROADMAP.md` updates are folded into that commit per the sequential
(no-worktree) execution mode for this plan._

## Files Created/Modified

- `src/mcp/vice/skill-program-recon-cli.test.ts` — subprocess CLI tests for `derive.mjs`
- `src/mcp/vice/skill-memory-mapping-cli.test.ts` — in-process + subprocess CLI tests for
  `driver.mjs`
- `src/mcp/vice/skill-acme-build-cli.test.ts` — subprocess CLI tests for `acme.mjs`, gated
  through the shared ACME-availability seam

## Verbatim Evidence (per this plan's `<output>` spec)

**Per-file test counts and whole-suite counters, before and after:**

| Metric | Before (pre-phase baseline) | After |
|---|---|---|
| `VICE_REQUIRE_ACME=1 npm test` | 2293 tests / 2249 pass / 0 fail / 39 skipped / 5 todo / 23 suites | 2340 tests / 2296 pass / 0 fail / 39 skipped / 5 todo / 23 suites |
| `npm run test:automated` | 2129 tests / 2124 pass / 0 fail / 5 todo | 2160 tests / 2155 pass / 0 fail / 5 todo |
| `skill-program-recon-cli.test.ts` alone | — (new file) | 16 tests / 16 pass / 0 fail |
| `skill-memory-mapping-cli.test.ts` alone | — (new file) | 17 tests / 17 pass / 0 fail |
| `skill-acme-build-cli.test.ts` alone (`VICE_REQUIRE_ACME=1`) | — (new file) | 14 tests / 14 pass / 0 fail / 0 skipped |
| Combined three-file run (`VICE_REQUIRE_ACME=1`) | — | 47 tests / 47 pass / 0 fail / 0 skipped |

The rise (2293→2340 = +47; 2129→2160 = +31, the automated subset excludes the
`skill-acme-build-cli.test.ts` cases that would otherwise skip locally but this host has ACME
installed so none were excluded here) exactly matches 16+17+14 = 47 new tests.

**The quoted assemble assertion (skill-acme-build-cli.test.ts), showing it keys on status plus
artefact, never on stderr being empty:**

```ts
const buildRes = runAcme(["build", src], { libraryFree: true });
// Check on exit status plus the produced artefact, never on stderr
// being empty -- ACME emits legal warnings on this very scaffold
// ("Label name not in leftmost column" is a known one), so an
// empty-stderr assertion would be flaky by construction.
assert.equal(buildRes.status, 0);
const prgPath = join(dir, "game.prg");
assert.ok(existsSync(prgPath), "expected game.prg to be produced");
...
assert.equal(bytes[0], 0x01);
assert.equal(bytes[1], 0x08);
```

**The quoted rebuild-verb exclusion message (skill-memory-mapping-cli.test.ts):**

```
"the memmap verb must never be spawned as a CLI argument in this file -- it fetches over the
network and overwrites the committed memmap.json"
```

**The quoted ordering assertion (skill-memory-mapping-cli.test.ts):**

```ts
const headers = [...r.stdout.matchAll(/=== \$([0-9A-F]{4}) ===/g)].map((m) => m[1]);
assert.deepEqual(headers, ["D020", "D020"], "expected exactly 2 header blocks, in the same order as the 2 arguments");
```

**Observed script behaviour pinned as-found (not defects, recorded per this plan's
instruction to pin rather than assume):**

1. `derive.mjs sprites` with an empty `--ptrs` list does not crash: every enabled sprite row
   prints a blank pointer/address pair (`  --      ---------`) rather than throwing or
   omitting the row. Pinned in `skill-program-recon-cli.test.ts`.
2. `acme.mjs new` refuses to overwrite an existing scaffold path (`error: <path> already
   exists`, exit 1) rather than overwriting it. Pinned in `skill-acme-build-cli.test.ts`.
3. **Testability gap, not a script defect:** `driver.mjs`'s `parseAddr()` has an
   `s == null` branch documented in the plan's behaviour spec ("Lookup with a null or absent
   address throws the documented required-address message"), but this branch is unreachable
   through the shipped surface — only `lookup(addr: number)` is exported (not `parseAddr`),
   and the CLI's `lookup <addr>...` verb always passes defined string `argv` elements, so
   `parseAddr` is never called with `null`/`undefined` in practice. Pinned the nearest
   reachable proxy (an empty-string address argument) to its actual observed result (the
   malformed-address message, not the required-address one) rather than inventing an
   unreachable call path or editing the script to export `parseAddr` (out of scope — the plan
   forbids editing the three skill scripts). Recorded here as a finding for a later phase if
   this coverage gap is ever judged worth closing by exporting `parseAddr`.

## Decisions Made

- **`@ts-expect-error` over a sibling `.d.mts` for `driver.mjs`'s import.** The obvious fix for
  strict-mode's TS7016 ("implicitly has an 'any' type") on `import { lookup } from
  ".../driver.mjs"` is a sibling declaration file, mirroring this repo's own existing
  precedent (`scripts/lib/skill-honesty-checks.d.mts` next to `skill-honesty-checks.mjs`).
  Tried that first (`src/skills/c64-memory-mapping/scripts/driver.d.mts`), confirmed
  typecheck passed, then ran `cd installer && npm pack --dry-run --json` and found the new
  `.d.mts` leaked into the published `@henols/c64-re-tools` tarball (37 files instead of the
  prior 36) — because unlike the CI-only `scripts/lib/` tree, `src/skills/` IS the tree
  `sync-skills.mjs` copies into the installer package for real end users, who have no use for
  a TypeScript declaration file next to a plain `.mjs` skill script. Removed the `.d.mts`,
  used a single scoped `@ts-expect-error` comment on the one import line instead (with every
  later use of the returned value explicitly typed against a local `MemMapEntry` interface,
  so the suppression buys untyped import resolution only, not untyped usage). Confirmed via a
  second `npm pack --dry-run` that the tarball returned to 36 files.
- **Address-form-equivalence and error-message cases for `driver.mjs` are all CLI subprocess
  tests, not in-process calls to an exported parser.** The plan's action text for Task 2 reads
  as if all "Lookup ..." behaviours are testable in process, but `driver.mjs` only exports
  `lookup(addr: number)` — a pure numeric filter with no string parsing and no throw path.
  The actual address-string parsing, overflow messages and malformed-address message all live
  in `parseAddr()`, which is NOT exported. Every one of those cases is therefore driven
  through the CLI's `lookup <addr>...` verb as a subprocess (still never a shell string),
  which is the only route that actually exercises `parseAddr()` without editing the script.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `driver.mjs` import fails strict-mode typecheck (TS7016) with no
declaration file**
- **Found during:** Task 2 (writing the in-process `lookup()` import)
- **Issue:** `import { lookup } from "../../skills/c64-memory-mapping/scripts/driver.mjs"` in
  a `.ts` file under this package's strict `tsconfig.json` (`allowJs: false`) fails with
  `TS7016: Could not find a declaration file for module '...driver.mjs'`. `npm run typecheck`
  is a hard plan/acceptance-criteria gate; this blocked the whole task.
- **Fix:** A single `@ts-expect-error` comment scoped to the one import line, plus a local
  `MemMapEntry` interface used to explicitly type every downstream use of the returned value.
  (An initial attempt used a sibling `driver.d.mts` declaration file mirroring an existing
  repo precedent; reverted after confirming it leaked into the installer npm tarball — see
  "Decisions Made" above for the full before/after evidence.)
- **Files modified:** `src/mcp/vice/skill-memory-mapping-cli.test.ts` only. `driver.mjs`
  itself was never touched, and no `.d.mts` file was left behind — confirmed via
  `ls src/skills/c64-memory-mapping/scripts/` (only `driver.mjs` present) and a second
  `npm pack --dry-run` (36 files, unchanged from the pre-plan baseline).
- **Verification:** `npm run typecheck` exits 0; `node --test skill-memory-mapping-cli.test.ts`
  reports 17/17 pass.
- **Committed in:** `caf654f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3).
**Impact on plan:** The fix is scoped to a single import line in one test file and does not
touch any shipped script, shipped data file, or ship any new artefact into either npm tarball.
No scope creep against the plan's own prohibitions.

## Issues Encountered

None beyond the deviation above. Every acceptance criterion for all three tasks was re-run
live (not assumed) and passed; see the counter table above for the whole-suite before/after
proof.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PKG-02/QUAL-01 closed: all three previously-untested skill CLI scripts now have committed,
  discovered, passing test coverage.
- The one remaining open item this plan's own `<verification>` block names for a sibling plan
  (16-07, PKG-03) is unaffected by this plan's work — `comment-phase-pointers.test.ts` and its
  fixture are 16-07's own deliverable, not touched here.
- No blockers for the phase's remaining plan(s).

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-22*

## Self-Check: PASSED

- All three created test files confirmed present on disk (`[ -f ... ]`).
- All three task commit hashes (`4f8a09d`, `caf654f`, `8fb40ec`) confirmed present in
  `git log --oneline --all`.
- All acceptance criteria for all three tasks re-run live during execution (grep counts,
  `git diff --quiet` checks, live `node --test` runs) — see the counter table and verbatim
  quotes above.
- Plan-level `<verification>` block re-run live: `npm run typecheck` (exit 0),
  `VICE_REQUIRE_ACME=1 npm test` (2340/2296/0 fail), `npm run test:automated` (2160/2155/0
  fail), the combined three-file run (47/47/0 fail/0 skipped), `git diff --quiet -- src/skills`
  (clean), `git diff HEAD~3 -- src/mcp/vice/test-gate.mjs` (empty), `git status --porcelain`
  (clean), `bash scripts/package.sh` and `node scripts/check-npm-packages.mjs` (both exit 0).
