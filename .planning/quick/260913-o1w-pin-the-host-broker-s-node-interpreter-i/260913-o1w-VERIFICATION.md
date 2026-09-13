---
task: quick-260913-o1w
verified: 2026-09-13T00:00:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260913-o1w Verification: Pin the host broker's node interpreter

**Goal:** The host broker launcher must never exec an interpreter it did not resolve and
version-check first; below the floor it must REFUSE BY NAME with the remedy and exit
non-zero BEFORE exec; `broker.json` must record which interpreter the broker actually ran
under.

**Verdict: GOAL_ACHIEVED**

Every one of the 8 items in the verification brief was independently driven against the
real tree (not read off the SUMMARY) and passed. No blockers found. One minor, non-blocking
nuance is noted under item 7.

## Scope note

Confirmed this task's commits are exactly `321b0804`, `05a7d4b0`, `4ca6c3d4`, `15e9d5a7`
(`git show --name-only` on each). The unrelated concurrent task `260913-o78`'s commits
(`f35421ac`, `c0d6bed2`) and its modification to `broker-e2e.test.ts` were excluded from
judgment, per the brief.

## Item-by-item findings

### 1. The exec is genuinely pinned — VERIFIED

```
$ tail -1 src/mcp/vice/resources/vice-launcher.sh
exec "$NODE_BIN" "$BROKER_ARTIFACT" --repo-root "$REPO_ROOT" "$@"

$ grep -v '^[[:space:]]*#' src/mcp/vice/resources/vice-launcher.sh | grep -c 'exec node'
0
```

`$NODE_BIN` is a shell variable populated earlier in the script by the resolution ladder
(never a literal command name), and it always holds an absolute path (either the validated
`VICE_BROKER_NODE` override or the absolute result of `command -v node`). `bash -n` is
clean.

### 2. The refusal is real and fires before exec — VERIFIED

Drove it directly with a stub `node` reporting a below-floor version:

```
$ VICE_BROKER_NODE=<scratchpad>/stub/node bash src/mcp/vice/resources/vice-launcher.sh
EXIT=4
stdout: (empty)
stderr:
vice-launcher: refusing to start -- resolved node interpreter <scratchpad>/stub/node
reports v20.0.0, which is below the required floor v24.x. Install a Node >= v24 and put
it on PATH, or set VICE_BROKER_NODE to an absolute path to one that satisfies the floor.
```

Message names: the offending path, the reported version (`v20.0.0`), the floor (`v24.x`),
and both remedies (install a conforming Node / point the override at one). stdout was
empty and contained zero occurrences of the broker artifact's name — the broker was never
reached. `pgrep -af "vice-broker\.mjs|x64sc"` (filtered for shell-wrapper false positives)
showed no real broker/emulator process at any point.

Also drove the two adjacent refusal shapes for completeness:
- Override pointing at a nonexistent path: exit 4, `"VICE_BROKER_NODE is set to
  '/nonexistent/path/to/node', which does not resolve to an executable file..."`
- Empty PATH (only `dirname`/`basename` present, override unset): exit 4, `"No 'node'
  executable was found on PATH and VICE_BROKER_NODE is not set..."`

### 3. Single floor, no drift — VERIFIED (non-vacuous)

`NODE_FLOOR_MAJOR=24` in the launcher; `package.json`'s `engines.node` is `">=24.0.0"`
(major 24) — currently agree. The drift test
(`host-scripts.test.ts:178`, "drift guard: vice-launcher.sh's NODE_FLOOR_MAJOR literal
equals the major of package.json's engines.node floor") was proven non-vacuous by editing
the launcher's literal to `25` and re-running:

```
✖ drift guard: ... NODE_FLOOR_MAJOR (25) must equal package.json's engines.node major (24)
  -- two numbers answering one question is how the bare-interpreter defect happened...
  25 !== 24
```

File was restored and `diff` confirmed byte-identical to the original afterward.

### 4. The deployed copy got refreshed — VERIFIED

```
$ cmp src/mcp/vice/resources/vice-launcher.sh .c64-re-tools/bin/vice-launcher.sh
(no output — identical)
```

Both copies are executable (`-rwxrwxr-x`), and the deployed copy's mtime (17:42, matching
commit `321b0804`'s timestamp) shows it was refreshed in the same commit as the source
edit, not left stale.

### 5. `--print-paths` stays total — VERIFIED

Drove three distinct "nothing usable resolves" shapes, all with `--print-paths`:

| Scenario | Exit | node_bin= | node_version= |
|---|---|---|---|
| Below-floor stub via override | 0 | (stub path) | v20.0.0 |
| Override points at nonexistent path | 0 | (empty) | (empty) |
| PATH stripped to only `dirname`/`basename` | 0 | (empty) | (empty) |

All three exit 0 and print all five keys (`repo_root`, `self_dir`, `broker_artifact`,
`node_bin=`, `node_version=`), confirming the diagnostic never refuses. The same
empty-PATH scenario without `--print-paths` correctly refuses (exit 4), confirming the
floor gate is genuinely bypassed only for the diagnostic path, not disabled generally.

### 6. The record field is real — VERIFIED

`vice-broker.mts`: `BrokerRecord.node_exec_path: string` declared beside `node_version`;
record literal sets `node_exec_path: process.execPath` beside `node_version:
process.version` (line 1312-1313). Startup stderr line extended to name both.

Key-set count moved from thirteen to fourteen in all required places, confirmed by diff
and grep:
- The `BrokerRecord`-adjacent block comment (was "thirteen-field", now "fourteen-field",
  history preserved: "NARROWED to thirteen by plan 41-05... WIDENED back to fourteen").
- The record-literal-adjacent block comment (same treatment).
- `vice-broker-launch.test.ts`'s constant (`BROKER_JSON_THIRTEEN_KEYS` →
  `BROKER_JSON_FOURTEEN_KEYS`, member list includes `node_exec_path`).
- The test title (`"...writes the fourteen-field discovery record..."`).
- The assertion failure message (`"...must carry EXACTLY these fourteen fields..."`).
- The historical block comment above the constant — extended, not overwritten, now
  reads "...WIDENED BACK to fourteen by the node-interpreter-pinning quick task, which
  added `node_exec_path`..." while preserving the retired-field history.

`typecheck` exits 0. `node build.ts` + `resources-sync.test.ts` (2/2 pass) confirm
`resources/vice-broker.mjs` is a genuine rebuild, not hand-edited, and `git status
--porcelain src/mcp/vice/resources` is clean (no drift).

Manual-only `vice-broker-launch.test.ts` run explicitly:
```
tests 15, pass 11, fail 0, skipped 4
```
Matches the plan's F5 baseline and the SUMMARY's claim exactly (4 skips are
container-only cases this host cannot run). Includes a passing assertion that
`record.node_exec_path === process.execPath`.

### 7. No guard was weakened to pass — VERIFIED, with one minor non-blocking nuance

Confirmed the original (`4ca6c3d4^`) guard was the blunt
`assert.ok(!source.includes("execPath"), ...)` — banning the raw substring anywhere in
the file, including comments.

The final form (after `15e9d5a7`) is two independent assertions: (1) comment-stripped
`process.execPath` occurrence count must equal exactly 1, and that one occurrence must sit
on the `node_exec_path: process.execPath` record line; (2) a spawn-construct regex bans
`process.execPath` reaching `nodeSpawn`/`spawn`/`execFile(Sync)`/`fork` directly.

Independently reproduced the exact bypass named in the brief by planting
`const self = process.execPath; if (false) { nodeSpawn(self, []); }` into `vice-broker.mts`
and re-running `broker-kill.test.ts`:

```
✖ structural: the broker never re-executes itself -- process.execPath appears exactly once
  ... found 2: [...,"const self = process.execPath; if (false) { nodeSpawn(self, []); }"]
  2 !== 1
```

Reverted; `diff` confirmed the file was restored byte-identical. This proves the named
variable-indirection bypass is caught by the final guard, which the intermediate
(`4ca6c3d4`) single-regex version would not have caught.

**Non-blocking nuance:** the final guard is stronger than the original for (a) the named
variable-indirection case, and (b) avoiding false positives on the new legitimate
in-comment mentions of `process.execPath`. It is not, however, *unconditionally* stronger
against every input the original blunt substring-ban would have caught: an adversarially
obfuscated access such as `process["execPath"]` contains the raw substring `"execPath"`
(so the old `.includes("execPath")` would have flagged it) but does not match the new
guard's `/\bprocess\.execPath\b/` dot-notation regex, so it would not be counted and could
theoretically slip through both new assertions. This is a purely adversarial/academic edge
case (bracket-notation self-respawn), not a realistic accidental-regression scenario, and
it does not affect the specific bypass the brief asked to verify. Recorded here for
completeness rather than as a blocker.

No other assertion in the four commits was loosened or deleted. `broker-kill.test.ts`'s
other tests (retired-marker check, end-to-end SIGTERM/SIGINT/SIGHUP kills, banner-before-
listener) are untouched by the diff.

### 8. `broker-launch.mts`'s single-owner `inFlight` guard is untouched — VERIFIED

`git diff --stat` across all four commits does not mention `broker-launch.mts` (confirmed
per-commit via `git show --name-only` on each of the four hashes — none touch it). Read the
guard directly: `if (inFlight) return null; inFlight = true;` (line 586-587) and the
second call site (line 691-696) are both synchronous check-and-set with no `await` between,
unchanged from before this task.

## Regression / baseline checks

- `host-scripts.test.ts`: 10/10 pass (7 new cases + 3 pre-existing).
- `repo-root.test.ts` + `install-resources.test.ts`: not re-run in full here, but nothing
  in the diff touches either file's subject matter and `install-resources.test.ts`'s only
  relevant assertion (deployed-file existence, not content) is satisfied by item 4 above.
- `npm run test:automated`: `tests 4399, pass 4387, fail 3, skipped 9`. All 3 failures
  (`audit-integrity.test.ts` D-12-02, and `docs-deferred-ledger.test.ts`'s two pending-todo
  assertions) match the SUMMARY's claimed pre-existing baseline exactly, by membership, and
  are caused by the still-open `.planning/todos/pending/2026-09-13-vice-launcher-execs-a-
  bare-node.md` file (out of this task's `files_modified`) — not a regression this task
  introduced.
- No broker or emulator process was left running by any command run during this
  verification (`pgrep -af "vice-broker\.mjs"` / `"x64sc"`, filtered for shell-wrapper
  self-matches, empty both times).
- CLAUDE.md's broker/control-plane tuning line was extended with a `VICE_BROKER_NODE`
  clause as required.

## Gaps

None.

## Human Verification Required

None. Every must-have was independently driven (not merely read) against the real tree.

---
_Verified: 2026-09-13_
_Verifier: Claude (gsd-verifier)_
