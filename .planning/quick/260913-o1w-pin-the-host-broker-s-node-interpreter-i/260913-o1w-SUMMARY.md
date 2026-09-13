---
phase: quick-260913-o1w
plan: 01
subsystem: infra
tags: [bash, node, vice-launcher, vice-broker, host-tooling]

requires: []
provides:
  - "vice-launcher.sh resolves an explicit node interpreter (VICE_BROKER_NODE override, then PATH) instead of trusting a bare `exec node`"
  - "A resolved interpreter below the floor (mirrored from package.json's engines.node) is refused by name, before exec, with both remedies named"
  - "--print-paths reports the resolved node_bin/node_version unconditionally, never refusing"
  - "broker.json now records node_exec_path (process.execPath) alongside the existing node_version"
affects: [vice-broker, host-launcher, node-floor]

actuals:
  tokens: 10900
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Resolution ladder that separates 'resolve' from 'gate': --print-paths reuses the same resolution as the real exec path but skips the floor check, so a diagnostic never dies on the exact condition it exists to report."

key-files:
  created: []
  modified:
    - src/mcp/vice/resources/vice-launcher.sh
    - src/mcp/vice/host-scripts.test.ts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/vice-broker-launch.test.ts
    - src/mcp/vice/broker-kill.test.ts
    - CLAUDE.md

key-decisions:
  - "Floor is a single literal (NODE_FLOOR_MAJOR=24) mirroring package.json's engines.node major, pinned by a drift test in host-scripts.test.ts rather than hardcoded independently."
  - "No floor-override env var was added -- VICE_BROKER_NODE only ever points at a DIFFERENT conforming binary, never lowers the floor."
  - "Deliberately accepted a behavior change: a host whose PATH `node` is v22.22.0 (works today) is now refused with a named remedy instead of silently running."

requirements-completed: [QUICK-260913-o1w]

coverage:
  - id: D1
    description: "Launcher resolves an explicit interpreter (override then PATH), refuses by name before exec when below the floor or unresolvable, and --print-paths stays total"
    requirement: "QUICK-260913-o1w"
    verification:
      - kind: unit
        ref: "src/mcp/vice/host-scripts.test.ts (7 new cases: drift guard, structural exec form, below-floor override, override-points-at-nothing, nothing-resolvable, print-paths-stays-total, happy path)"
        status: pass
    human_judgment: false
  - id: D2
    description: "broker.json records node_exec_path (process.execPath) alongside node_version, fourteen-field discovery record"
    requirement: "QUICK-260913-o1w"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-broker-launch.test.ts (fourteen-key set equality + process.execPath assertion) -- manual-only file, run explicitly"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-09-13
status: complete
---

# Quick Task 260913-o1w: Pin the host broker's node interpreter Summary

**The host broker launcher now resolves and version-gates an explicit `node` interpreter (override, then PATH) instead of exec-ing whatever `node` PATH happened to resolve first, and refuses by name before ever reaching the broker artifact; `broker.json` now records which interpreter path a running broker actually used.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 2/2 completed
- **Files modified:** 7 (6 planned + 1 deviation, corrected twice after coordinator/verifier review)
- **Commits:** 5

## Accomplishments

- `vice-launcher.sh` resolves `node` via a two-rung ladder (`VICE_BROKER_NODE` absolute-path override, then `command -v node`) and refuses by name with exit code 4 before ever exec-ing, when nothing resolves or the resolved interpreter's major is below `NODE_FLOOR_MAJOR=24` (mirrored from `package.json`'s `engines.node`, pinned equal by a drift test).
- `--print-paths` now also prints `node_bin=`/`node_version=`, reporting the resolution (or its absence) unconditionally -- it never refuses, even when nothing resolved.
- The final line execs `"$NODE_BIN"` (the resolved, gated interpreter), never a bare `node` command; the comment-filtered body of the file has zero remaining occurrences of the old `exec node` form.
- `broker.json`'s discovery record widened from thirteen to fourteen fields with `node_exec_path: process.execPath`, so a triage session can tell which of several installed interpreters a given broker actually ran under -- truthful even when the broker is started directly, bypassing the launcher.
- The deployed copy at `.c64-re-tools/bin/vice-launcher.sh` (gitignored, hand-authored, never auto-refreshed by the installer) was refreshed to match the edited source, per F1a.

## Measured Facts (per plan's `<output>` requirements)

**Exact refusal message for a below-floor interpreter (copied from a real run):**

```
vice-launcher: refusing to start -- resolved node interpreter /tmp/.../stub/node reports v20.0.0, which is below the required floor v24.x. Install a Node >= v24 and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one that satisfies the floor.
```
(exit code 4)

**A Node 22.22.0 host that works today is now refused, live-verified:**

```
$ VICE_BROKER_NODE=/home/henrik/.nvm/versions/node/v22.22.0/bin/node bash src/mcp/vice/resources/vice-launcher.sh
vice-launcher: refusing to start -- resolved node interpreter /home/henrik/.nvm/versions/node/v22.22.0/bin/node reports v22.22.0, which is below the required floor v24.x. ...
EXIT=4
```

This is deliberate (F3): the floor is pinned to `package.json`'s `engines.node` major (24) rather than to what today's compiled `.mjs` artifact happens to tolerate at runtime (which is lower, because the compile step absorbs the gap). Pinning to the compiled artifact's own tolerance would certify exactly the configuration the project intends to be able to remove (TypeScript-everywhere, dropping the compile step) and would leave "which Node is this supposed to be" unanswered. `VICE_BROKER_NODE` exists to point at a *different conforming* binary, never to lower the floor -- no floor-override env var was added.

**Manual-only `vice-broker-launch.test.ts` pass/fail counts (run explicitly, not reached by `test:automated`):**

```
tests 15
pass 11
fail 0
skipped 4
```
Matches the plan's F5 baseline exactly (11 pass / 0 fail / 4 skipped; the 4 skips are container-environment cases this host cannot satisfy).

**Deployed copy under `.c64-re-tools/bin/`:** existed (byte-diverged the moment the source was edited, as F1a predicted) and was explicitly refreshed with `cp` (preserving the executable bit) so the fix reaches the path that actually runs. Verified with `cmp -s` after refresh.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve, gate and refuse -- the launcher stops trusting PATH** - `321b0804` (fix)
2. **Task 2: Record which interpreter the broker actually ran under** - `05a7d4b0` (feat)
3. **Deviation fix: narrow the broker's self-reexec structural gate** - `4ca6c3d4` (fix, Rule 1 -- see Deviations below)
4. **Coordinator-requested tightening: close the one-variable bypass in that gate** - `15e9d5a7` (fix -- see Deviations below)
5. **Verifier/coordinator-requested fix: widen the occurrence guard to cover bracket-notation access** - `ab0e15e1` (fix -- see Deviations below)

## Files Created/Modified

- `src/mcp/vice/resources/vice-launcher.sh` - interpreter-resolution ladder, floor gate, refusal, updated `--print-paths` and exit-code contract
- `src/mcp/vice/host-scripts.test.ts` - 7 new behavior cases (drift guard, structural exec form, below-floor override, override-points-at-nothing, nothing-resolvable, print-paths-stays-total, happy path); replaced the old bare-exec structural assertion
- `src/mcp/vice/vice-broker.mts` - `BrokerRecord.node_exec_path`, set from `process.execPath`, prose updated to fourteen fields
- `src/mcp/vice/resources/vice-broker.mjs` - rebuilt via `node build.ts` from the `.mts` source (sync guard stays green)
- `src/mcp/vice/vice-broker-launch.test.ts` - key-set constant/title/messages renamed thirteen -> fourteen, `node_exec_path`/`process.execPath` assertion added, history comment extended (not overwritten)
- `src/mcp/vice/broker-kill.test.ts` - **deviation, in three steps** (see below): narrowed an over-broad structural gate that this task's own legitimate change tripped, tightened that narrowing after coordinator review found a one-variable bypass, then widened the occurrence pattern after the verifier found a bracket-notation gap the comment had falsely claimed to cover
- `CLAUDE.md` - one clause added to the existing broker/control-plane tuning line documenting `VICE_BROKER_NODE`
- `.c64-re-tools/bin/vice-launcher.sh` - refreshed deployed copy (gitignored, not committed)

## Decisions Made

- Floor pinned to `package.json`'s `engines.node` major (24), mechanically tied by a test, rather than to whatever the compiled `.mjs` artifact currently tolerates (lower) -- see F3 rationale above.
- No third resolution rung was added. The MCP server's own `process.execPath` cannot be threaded to the launcher: nothing in the shipped tree spawns `vice-launcher.sh` (every reference is a path printed in a message for a human to type), and under a devcontainer that path would name a container-only location with no host counterpart anyway.
- No floor-override env var. `VICE_BROKER_NODE` only ever redirects to a different conforming binary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `broker-kill.test.ts`'s self-reexec structural gate was over-broad and blocked Task 2's legitimate field**
- **Found during:** Task 2 verification (`npm run test:automated`, run to compare the failure set against the pre-existing baseline)
- **Issue:** `structural: the broker never re-executes itself -- no reference to its own executable path anywhere in vice-broker.mts` asserted `!source.includes("execPath")` -- banning the bare substring, not just a self-spawn construct. Adding `node_exec_path: process.execPath` (a plain object-literal field, never passed to a spawn/exec/fork call) tripped it.
- **Fix:** Narrowed the assertion to the actual hazard it guards against -- `process.execPath` reaching a `spawn`/`execFile`/`fork` call -- via a regex (`/\b(?:nodeSpawn|spawn|execFile(?:Sync)?|fork)\s*\(\s*process\.execPath\b/`). The D-25 self-reexec guarantee (detaching stays the operator's own choice) is unchanged; the test's intent is preserved, its implementation is now precise.
- **Files modified:** `src/mcp/vice/broker-kill.test.ts`
- **Verification:** `node --test src/mcp/vice/broker-kill.test.ts` -- 38/38 pass. Re-ran `npm run test:automated` twice after the fix: stable at 3 pre-existing failures (down from 5 before the fix), none touching any file this plan modified.
- **Committed in:** `4ca6c3d4`

**2. [Coordinator review - hardening] The Rule-1 replacement guard above was bypassable with one variable of indirection**
- **Found during:** Coordinator review of commit `4ca6c3d4`, before this plan was reported complete.
- **Issue:** The spawn-construct regex (`/\b(?:nodeSpawn|spawn|execFile(?:Sync)?|fork)\s*\(\s*process\.execPath\b/`) caught `nodeSpawn(process.execPath, [...])` directly but not `const self = process.execPath; nodeSpawn(self, [...])` -- one local variable defeats it silently. The substring ban it replaced had no such bypass; the replacement had traded "unbypassable but blunt" for "precise but evadable" instead of getting both properties.
- **Fix:** Split into two independent assertions in the same test: (1) an occurrence count -- comment-strip `vice-broker.mts`, assert there is EXACTLY ONE remaining `process.execPath` occurrence, and assert it sits on the `node_exec_path: process.execPath` record line. This has no regex to defeat: any new use anywhere in the file, via any amount of indirection, moves the count to 2 and reds the test. (2) The original spawn-construct regex, kept as a second, independent assertion stating the actual hazard in readable form -- not redundant, since it names the failure precisely for the direct form even if assertion 1 is ever loosened.
- **Verified non-vacuous, per coordinator instruction:** planted a second `process.execPath` use in `vice-broker.mts` via a local variable (`const TEMPORARY_PLANTED_VIOLATION_self = process.execPath;`), ran `node --test src/mcp/vice/broker-kill.test.ts`, confirmed RED:
  ```
  ✖ structural: the broker never re-executes itself -- process.execPath appears exactly once (the node_exec_path record field) and is never passed to a spawn/exec/fork construct
    AssertionError [ERR_ASSERTION]: expected exactly one comment-stripped occurrence of process.execPath in vice-broker.mts, found 2: [{"line":982,...},{"line":996,"text":"const TEMPORARY_PLANTED_VIOLATION_self = process.execPath;"}] ...
    2 !== 1
  ```
  Reverted the planted line, confirmed `git diff --stat src/mcp/vice/vice-broker.mts` was empty, and re-ran: `tests 38, pass 38, fail 0`.
- **Post-fix re-verification (all measured):**
  - `node --test src/mcp/vice/vice-broker-launch.test.ts` (manual-only, run explicitly): `tests 15, pass 11, fail 0, skipped 4` -- F5 baseline unchanged.
  - `npm run test:automated`: `tests 4399, pass 4387, fail 3, skipped 9` -- same 3-member failure set as before this fix (`audit-integrity.test.ts` D-12-02, and `docs-deferred-ledger.test.ts`'s two pending-todo assertions), compared by membership, not just count.
- **Files modified:** `src/mcp/vice/broker-kill.test.ts`
- **Committed in:** `15e9d5a7`

**3. [Verifier/coordinator review - guard-vs-comment mismatch] The occurrence-count assertion above keyed on dot notation only, and its own comment overstated that**
- **Found during:** Independent verifier run (GOAL_ACHIEVED 8/8, live-driven) flagged one residual before this plan was reported complete.
- **Issue:** Assertion 1's pattern was `\bprocess\.execPath\b`, so `process["execPath"]` (or single/backtick-quoted bracket access) was invisible to it -- the count stayed 1 and the test passed. The ORIGINAL blunt substring ban (`!source.includes("execPath")`) this guard replaced DID catch that spelling; for that one form the replacement was weaker, not stronger. Worse than the adversarial gap itself: the comment at the assertion's own definition claimed "any new use anywhere in the file -- direct, via a variable, a destructure, an alias, whatever -- moves the count to 2 and reds this test", which was never true of a pattern keyed on dot notation alone -- a false claim about a structural guard's own strength is worse than a blunt guard that reads honestly, since the next editor trusts the comment over re-deriving the regex.
- **Fix:** Widened assertion 1's pattern only (per instruction, assertion 2's spawn-construct regex was left untouched -- it is the legible half stating the ordinary hazard, and widening it buys nothing): `` /process\s*(?:\.\s*execPath\b|\[\s*(['"`])execPath\1\s*\])/ ``, matching dot access or bracket access with any of the three quote characters (backreferenced so the same quote must open and close). Rewrote the comment to state precisely what the pattern covers (dot and bracket property reads at the one call site) instead of the unearned "whatever" framing, and to name explicitly what it does NOT prove (a dynamically-computed property name could still smuggle the value out, which is why assertion 2 exists as a second, independent check).
- **Verified non-vacuously, both spellings, per instruction:**
  - Planted `const A = process["execPath"];` in `vice-broker.mts` -> RED:
    ```
    AssertionError [ERR_ASSERTION]: expected exactly one comment-stripped occurrence of process.execPath in vice-broker.mts, found 2: [{"line":982,"text":"node_exec_path: process.execPath,"},{"line":996,"text":"const A = process[\"execPath\"];"}] ...
    2 !== 1
    ```
    Reverted -> `git diff --stat -- src/mcp/vice/vice-broker.mts` empty -> GREEN: `tests 38, pass 38, fail 0`.
  - Planted `const B = process.execPath;` (confirming no regression on the spelling that already worked) -> RED:
    ```
    AssertionError [ERR_ASSERTION]: expected exactly one comment-stripped occurrence of process.execPath in vice-broker.mts, found 2: [{"line":982,"text":"node_exec_path: process.execPath,"},{"line":996,"text":"const B = process.execPath;"}] ...
    2 !== 1
    ```
    Reverted -> `git diff --stat -- src/mcp/vice/vice-broker.mts` empty -> GREEN: `tests 38, pass 38, fail 0`.
- **Post-fix re-verification (all measured):**
  - `node --test src/mcp/vice/broker-kill.test.ts`: `tests 38, pass 38, fail 0`.
  - `node --test src/mcp/vice/vice-broker-launch.test.ts` (manual-only, run explicitly): `tests 15, pass 11, fail 0, skipped 4` -- F5 baseline unchanged.
  - `npm run test:automated`: `tests 4399, pass 4387, fail 3, skipped 9` -- same 3-member pre-existing failure set (`audit-integrity.test.ts` D-12-02, `docs-deferred-ledger.test.ts` x2), compared by membership.
- **Files modified:** `src/mcp/vice/broker-kill.test.ts`
- **Committed in:** `ab0e15e1`

---

**Total deviations:** 3 (1 auto-fixed under Rule 1 during execution; 2 further correctness fixes requested by coordinator/verifier review before completion)
**Impact on plan:** All three necessary for correctness -- the first because Task 2's own required field would otherwise have shipped alongside a red, previously-green test; the second and third because each successive replacement guard was found to be strictly weaker, in a specific measurable way, than the invariant it was meant to preserve. No scope creep: all three are narrow, targeted edits to the one test assertion, not a rewrite of the gate's intent. `broker-launch.mts` (the single-owner launch guard, explicitly out of bounds per the plan's `must_haves`) was not touched by any of them.

**Note on the shared working tree:** while this plan's commits were landing, an unrelated concurrent quick task (`260913-o78`, plan file `.planning/quick/260913-o78-close-the-ci-only-test-gap-vice-proxy-an/260913-o78-PLAN.md`) also committed to `main` interleaved with this plan's commits (visible in `git log --oneline af89cd9c..HEAD`), and left `src/mcp/vice/broker-e2e.test.ts` modified in the working tree at one point during this plan's final verification pass. That file was never staged or touched by this plan -- every `git add` in this plan named its own files explicitly, never `-A`/`.` -- and is entirely that other task's work.

## Issues Encountered

None beyond the deviation above. Both baselines (`host-scripts.test.ts`: 10/10 including the 7 new cases; `repo-root.test.ts` + `install-resources.test.ts`: 31/31) stayed green throughout. `npm run test:automated`'s failure set went from a pre-existing 5-member set down to 3 (all pre-existing, none touching this plan's files: `audit-integrity.test.ts`'s D-12-02 gate and `docs-deferred-ledger.test.ts`'s two pending-todo-row assertions -- the latter caused by the still-open `.planning/todos/pending/2026-09-13-vice-launcher-execs-a-bare-node.md`, which predates this task and names the exact defect this plan fixes; resolving/filing that todo is outside this plan's `files_modified` and is left for the orchestrator/user to close).

## User Setup Required

None -- no external service configuration required. Nothing was installed, fetched, or handed to a package manager, per the plan's threat model (T-o1w-SC).

## Next Phase Readiness

- `vice-launcher.sh` and `vice-broker.mts`/`.mjs` are in sync (`resources-sync.test.ts` green) and ready for a systemd unit deployment that sets `VICE_BROKER_NODE` explicitly, closing the concrete trap the originating todo named (`~/.config/systemd/user/*.service`-shaped PATH with no nvm entry).
- The still-open pending todo `.planning/todos/pending/2026-09-13-vice-launcher-execs-a-bare-node.md` names exactly the defect this plan resolved; it should be moved/closed by whoever owns `.planning/todos/` bookkeeping so `docs-deferred-ledger.test.ts` goes green again (out of this plan's scope, see Issues Encountered).
- No broker or emulator process was left running at any point during this session (`pgrep -af "vice-broker.mjs|x64sc"` verified empty after every test run).

---
*Phase: quick-260913-o1w*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 5 commit hashes (`321b0804`, `05a7d4b0`, `4ca6c3d4`, `15e9d5a7`, `ab0e15e1`) verified present in `git log --oneline --all`. All 8 files listed in Files Created/Modified verified present on disk.
