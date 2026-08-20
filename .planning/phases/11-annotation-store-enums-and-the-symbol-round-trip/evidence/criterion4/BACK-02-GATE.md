# BACK-02 standing gate -- Phase 11 plan 11-11

BACK-02 ("the fork backend keeps working exactly as it does today when selected")
is a success criterion in Phase 2 only, plus a standing per-phase regression gate
(ROADMAP.md "Standing Constraints") -- not a criterion repeated per phase. This is
that gate's result for Phase 11, run against the phase's final state (worktree
`agent-a3f4a3db8d60a3ae0`, based on `39f1636`).

All commands below were run from `.claude/mcp/vice/` unless stated otherwise.
Every gate that was actually run is recorded with its quoted output. None is
reported as passed without that output.

## 1. `npm run test:automated`

```
$ npm run test:automated
...
1..1730
# tests 1899
# suites 21
# pass 1893
# fail 1
# cancelled 0
# skipped 0
# todo 5
# duration_ms 23058.53648
```

The one failure is:

```
not ok 621 - path agreement (D-3, D-6, THE regression this task exists to catch):
  the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
  supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

This is the pre-existing, worktree-only failure already documented in 11-08's own
SUMMARY.md ("Next Phase Readiness"): the worktree's own checkout path lives under
`.claude/worktrees/...`, which this assertion treats as a violation on the main
tree it does not see. It is not caused by this plan's changes -- this plan touched
no file `repo-root.test.ts` or its subject module reads. 1893/1899 pass (5 todo,
unrelated), 0 caused by 11-11.

## 2. `npm run typecheck`

```
$ npm run typecheck

> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json

(clean exit, no diagnostics)
```

## 3. `npm run smoke`

```
$ npm run smoke

> @henols/vice-mcp@0.0.0-dev smoke
> node smoke.mjs

vice-broker: detected backend "fork" for x64sc (source: probe) -- set VICE_BACKEND=stock or VICE_BACKEND=fork to override this detection explicitly
vice-proxy: MAX_MCP_OUTPUT_TOKENS is not set in this process's environment -- this project requires at least 25000. Set it in .claude/settings.json's "env" block (untracked -- see tools/README.md's "Per-machine setup" section for why and the exact value).
vice-proxy: ready, forwarding to http://127.0.0.1:6510/mcp (port 6510)
smoke: OK -- initialize + tools/list handshake completed (server vice, 78 tool(s) advertised)
```

The stdio server still boots under type-stripping with this phase's new modules
(`r2000-symbols.ts` et al.) in the graph. The `MAX_MCP_OUTPUT_TOKENS` line is an
unrelated, pre-existing per-machine-setup notice, not an error (smoke still
reports `OK`).

## 4. `node scripts/check-npm-packages.mjs`

```
$ node scripts/check-npm-packages.mjs
check-npm-packages: transitive closure from vice-proxy.ts -- 53 modules, clean

> @henols/c64-re-tools@0.0.0-dev prepack
> node scripts/sync-skills.mjs

sync-skills: copied 6 skill(s) into <repo>/installer/skills: acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, vice-wedge-triage
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 70 files
  @henols/c64-re-tools@0.0.0-dev -- 35 files, 6 skills
```

Both published tarballs still contain every module the new dynamic imports reach
-- 11-08's own folded todo-1 fix (declaring `r2000-symbols.ts` in `package.json`'s
`files[]`) is what makes this meaningful for the r2000 family for the first time;
53 modules is the closure walked from `vice-proxy.ts` including that file.

## 5. `fork-manifest-surface.test.ts`'s 62-tool count

```
$ node --test fork-manifest-surface.test.ts
...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
```

The asserting test itself: `fork-manifest-surface: tools-manifest.json parses and
its tools array has length exactly 62 (D-16)` -- passes. **62**, unchanged.

## 6. `stock-dispatch.test.ts`'s 38-key count

```
$ node --test stock-dispatch.test.ts
...
1..127
# tests 127
# suites 0
# pass 127
# fail 0
```

The asserting test: `dispatch: the table's key count is exactly 38` -- passes.
**38**, unchanged.

## 7. The fork half of the symbol surface (live, against genuine fork VICE)

Launched `/usr/local/bin/x64sc` (the fork build) with `-mcpserver -mcpserverhost
127.0.0.1 -mcpserverport <ephemeral>`, waited for its HTTP `/mcp` endpoint, then
called the fork's own `vice_symbols_load`/`vice_symbols_lookup` (reached through
`vice.ts`'s `call()` seam, wholly unrelated code path to `stock-symbols.ts`) on
`regenerated.lbl` from this same plan's Task 2:

```
call("vice_ping", {}) -- fork
{
  "status": "ok",
  "version": "3.10",
  "machine": "C64SC",
  "execution": "paused"
}

call("vice_symbols_load", {path: regenerated.lbl}) -- fork
{
  "status": "ok",
  "path": ".../evidence/criterion4/regenerated.lbl",
  "format_detected": "vice",
  "symbols_loaded": 9
}

call("vice_symbols_lookup", {name: "counter_wrap_reentry"}) -- fork
{ "status": "ok", "name": "counter_wrap_reentry", "address": 2105 }

call("vice_symbols_lookup", {name: "selector_ff_handler"}) -- fork
{ "status": "ok", "name": "selector_ff_handler", "address": 2118 }
```

**Fork version banner:** `x64sc (VICE 3.10)`, reported both by `x64sc --version`
and by the fork's own `vice_ping` (`"version": "3.10", "machine": "C64SC"`).

Both names this plan's Task 1/Task 2 wrote into the store resolve correctly
against the fork's own, separate, in-emulator symbol implementation -- the fork
is unregressed by this phase's changes. This gate is fully satisfied, not partial.

## Summary

| Gate | Result |
|------|--------|
| `npm run test:automated` | 1893/1899 pass, 1 pre-existing worktree-only failure (unrelated), 5 todo |
| `npm run typecheck` | clean |
| `npm run smoke` | OK, 78 tools advertised |
| `node scripts/check-npm-packages.mjs` | OK, both tarballs valid, 53-module closure clean |
| `fork-manifest-surface.test.ts` 62-count | pass, unchanged |
| `stock-dispatch.test.ts` 38-count | pass, unchanged |
| Fork symbol surface, live | pass, fully satisfied (not partial) -- VICE 3.10 fork, both names resolved |

No gate above is reported as passed without its quoted output above.
