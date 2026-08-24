# Phase 18 Gate Evidence

Date: 2026-08-24. Host tools: `regenerator2000 0.9.20`; Node `v22.22.0`.

## Command Results

| Command | Result | Observed result |
|---|---:|---|
| `npx tsc --noEmit -p tsconfig.json` | 0 | Type check passed under Node 22.22. |
| `npm test` | 0 | Full suite completed under Node 22.22; no `not ok` records in `/tmp/phase18-npm-test-final.log`. The default Node 20 attempt failed before discovery because it cannot run the TypeScript glob; rerun with Node 22.22 passed. |
| `node scripts/check-skill-tool-coverage.mjs` | 0 | 37 `vice_*` names; 10 `r2000_*` names, all curated; 19 curated tools; 7/7 CLI verbs resolved. |
| `node scripts/check-npm-packages.mjs` | 0 | 57-module closure clean; `@henols/vice-mcp` 74 files; root package 31 files and 6 skills. |
| `bash scripts/package.sh` | 0 | Passed in clean detached worktree `/tmp/c64-re-tools-phase18-gate`: 1,052 tracked files, artifact SHA-256 `8a3efc90e81da6253fdcc3cfdc822de136cf5eace987afeee5e94b9957ebbdac`. The workspace invocation correctly rejected the reinstalled root `.claude/skills` directory; that is local tooling, not package payload. |
| `pgrep -f 'regenerator2000 --mcp-server-stdio'` | empty | No surviving session child; confirmed with `ps -ef | rg '[r]egenerator2000 --mcp-server-stdio'`. |
| `git status --porcelain` | reviewed | Phase files plus the deterministic `repoRoot()` test fix are present. Existing GSD/skill reinstall artifacts and the session transcript were left untouched. |

## Skipped-Test Census

The full suite has no skipped live-gated `r2000` scenario. The opt-in skips are legitimate: one container-layout probe requires `CONTAINER_WORKSPACE_PATH` and `HOST_WORKSPACE_PATH`; six fork-live probes require an explicitly configured fork VICE binary; one stock checkpoint-flood probe and five stock-broker-live probes require explicitly configured real stock VICE binaries. These are not R2000 tests and their external prerequisites are absent by design.

## Requirement To Evidence

| Requirement | Test that ran | Plan |
|---|---|---|
| SESS-01 | `r2000-session.test.ts`: `gated: three consecutive r2000_* calls against the same project are served by ONE held child` | 18-03 |
| SESS-02 | `r2000-session.test.ts`: live child killed between calls transparently respawns | 18-04 |
| SESS-03 | `r2000-session.test.ts`: save-discipline SIGKILL persistence scenario | 18-03 |
| SESS-04 | `r2000-session.test.ts`: `plan 18-06: the queue prevents a client-side lost update` | 18-06 |
| SURF-01 | `r2000-tools.test.ts`: `r2000_read_region is curated with the live schema` | 18-05 |
| SURF-02 | `r2000-tools.test.ts`: `gated: composeAddressDetails against a real full-64K regenerator2000 project` | 18-05 |

## Planted-Violation Census

| Guard | Plan | Observed red assertion |
|---|---|---|
| Decision-record guards | 18-01 | `Expected exactly one FORK-01 row` after a record mutation. |
| Settings forcing | 18-02 | `real implementation must force the setting to true -- false !== true`. |
| Save discipline | 18-03 | `the mutation must be present on disk after SIGKILL`. |
| One-spawn-site invariant | 18-03 | `flipping the one-spawn-site invariant to fail`. |
| Planning-record registry guard | 18-01 | `runtime registry names every guard the disk-derived set carries`. |
| Lost-update mutex | 18-06 | bypassed interleaving produced `1` or `10`, not locked result `11`. |
| Session-open settings call | 18-07 | `D18-35 first half: session open must force use_illegal_opcodes on disk -- false !== true`. |

## Carried Findings

The D18-23 stdin-EOF measurement ran four times against Regenerator2000 0.9.20: children exited within about 200 ms after parent SIGKILL, so no startup sweep follow-up was created. The SESS-04 non-vacuity oracle uses controlled interleaved read-modify-write callbacks: bypassing the mutex deterministically loses an update, while the locked run produces `11`. Plan 18-05 records the remaining upstream batch limitation: a batch-embedded `r2000_get_address_details` still uses the upstream batch implementation and is deferred for a SURF follow-up.
