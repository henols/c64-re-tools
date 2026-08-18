---
phase: 08-capability-honesty-and-the-install-story
plan: 03
subsystem: docs-generation
tags: [generated-markdown, drift-guard, capability-registry, tools-manifest, node-test]

# Dependency graph
requires:
  - "capability-registry.ts -- CAPABILITY_REGISTRY, plan 08-01"
provides:
  - "scripts/generate-tool-support-table.mjs -- generateToolSupportTable(), a pure, injectable generator plus a CLI"
  - "docs/tool-support.md -- the generated, committed 63-row per-backend support table (DIST-01)"
  - ".claude/mcp/vice/tool-support-table.test.mjs -- byte-identity drift guard, derived-union completeness proof"
affects: [08-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First script/ file to import .claude/mcp/vice/*.ts directly (a repo-root .mjs importing a sibling .ts under Node's native type-stripping) -- new cross-boundary precedent, documented in the generator's own header"
    - "Two-hop mechanical discovery of proxy-local synthetic tools: match tools[IDENT.name] = registration sites, resolve IDENT via its const IDENT: ToolDefinition = { name: \"...\" } declaration, exclude the manifest loop's own tools[def.name] site by matching the for (const def of manifestTools) loop-variable pattern structurally (never by hardcoding \"def\")"
    - "generate-into-scratch-then-byte-diff (resources-sync.test.ts's shape) applied to a markdown document for the first time in this repo"

key-files:
  created:
    - scripts/generate-tool-support-table.mjs
    - docs/tool-support.md
    - .claude/mcp/vice/tool-support-table.test.mjs
  modified: []

key-decisions:
  - "tool-support-table.test.mjs is .mjs, not .ts as 08-VALIDATION.md named it -- a .ts test importing a repo-root .mjs fails tsc --noEmit with TS7016 because tsconfig.json sets allowJs:false and includes only **/*.ts and **/*.mts (verified empirically). Recorded deviation, matches Task 2's own <action> instruction."
  - "The derived-union equality test re-implements the two-hop synthetic-name discovery independently in its own code, rather than importing discoverSyntheticToolNames() from the generator -- so a shared bug between generator and test cannot pass silently."
  - "Note labels: 'hardware-unrecoverable' (only this one carries the literal token 'unrecoverable'), 'not yet built (descoped)', 'stock-only gain' -- mirrors capability-registry.ts's own never-use-'unrecoverable'-for-descoped contract."

requirements-completed: [DIST-01]

# Metrics
duration: 55min
completed: 2026-08-18
---

# Phase 8 Plan 03: Generated Tool Support Table Summary

**`scripts/generate-tool-support-table.mjs` derives a 63-row, per-backend tool support table from the two shipped manifests plus `capability-registry.ts` -- mechanically discovering all three proxy-local synthetic tools via a two-hop regex resolution over `vice-proxy.ts`, never a hand-typed list -- and `tool-support-table.test.mjs` proves the committed `docs/tool-support.md` byte-identical to a fresh run plus proves the row set equals an independently-recomputed union.**

## Performance

- **Duration:** 55 min
- **Completed:** 2026-08-18
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Derived Counts (matches this plan's prediction exactly)

The generator's run against the real manifests produced:

- **Total: 63** rows
- **Shared (available on both): 37** (34 genuine overlap + 3 mechanically-discovered synthetic tools)
- **Fork-only: 24**
- **Stock-only: 2**

This matches the plan's predicted **63 total / 37 shared (34 genuine + 3 synthetic) / 24 fork-only / 2 stock-only** exactly. Verified independently in this session via a standalone Python cross-check of the raw manifests before any synthetic-name handling: raw fork = 62 tools, raw stock = 38 tools; after removing `DENY_LIST` names (`tools_list`, `tools_call`, `initialize`, `notifications_initialized` all present only in the fork manifest; `vice_disk_list` present in neither) fork = 58, stock = 38 unchanged; raw overlap = 34, raw fork-exclusive = 24, raw stock-exclusive = 4 (`vice_diagnose`, `vice_recycle`, `vice_execution_until_return`, `vice_registers_available`). Adding the three mechanically-discovered synthetic names to both sets moves `vice_diagnose`/`vice_recycle` from "stock-exclusive" into "shared" and adds `vice_result_continue` (present in neither raw manifest) to "shared" as well, landing at the final 37/24/2/63 split.

## Two-Hop Synthetic Discovery Result

Run against the current `.claude/mcp/vice/vice-proxy.ts`, `discoverSyntheticToolNames()` returned exactly:

```
["vice_diagnose", "vice_recycle", "vice_result_continue"]
```

(sorted; set-equal to the plan's predicted `{vice_result_continue, vice_recycle, vice_diagnose}`). All three rows in the committed table show `✅ | ✅` (available on both backends). The discovery excluded the manifest loop's own `tools[def.name] = ...` registration site by matching `for (const def of manifestTools)` structurally -- `def` was never hardcoded as a skip name anywhere in the generator or the test.

## Exported Signature (for plan 08-06 and later consumers)

```javascript
// scripts/generate-tool-support-table.mjs
export function discoverSyntheticToolNames(proxySource) // -> string[], sorted
export function generateToolSupportTable(options = {}) // -> string (the whole markdown document)
// options: { forkManifestPath, stockManifestPath, registry, proxySourcePath }
// each defaults to the real repo path / the real imported CAPABILITY_REGISTRY.
// Pure: performs readFileSync only, zero writes. The CLI half (guarded by
// test-gate.mjs's import.meta.url direct-invocation pattern) writes
// docs/tool-support.md only when the module is run directly.
```

## Task Commits

1. **Task 1: Write the generator and commit its output as docs/tool-support.md** - `cc4b235` (feat)
2. **Task 2: tool-support-table.test.mjs -- byte-identity drift guard plus derived-union proof** - `78d6051` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created

- `scripts/generate-tool-support-table.mjs` -- `discoverSyntheticToolNames()`, `generateToolSupportTable()`, CLI guard
- `docs/tool-support.md` -- the generated, committed 63-row table (82 lines)
- `.claude/mcp/vice/tool-support-table.test.mjs` -- 6 `node:test` subtests (byte-identity, determinism, non-vacuity, reduced-manifest structural proof, add-to-stock structural proof, derived-union equality)

## Transient-Edit Proofs (proved, then reverted)

**Task 1 -- injecting `tools[BOGUS_TOOL.name] = ...` into a copy of `vice-proxy.ts`** (real file never touched; passed via `proxySourcePath`) made the generator throw:
```
generate-tool-support-table: could not resolve synthetic tool registration identifier "BOGUS_TOOL"
(from `tools[BOGUS_TOOL.name] = ...`) to a literal tool name -- expected a
`const BOGUS_TOOL: ToolDefinition = { name: "..." }` declaration in vice-proxy.ts. Add the
declaration, or if this is not a synthetic proxy-local tool registration, fix the discovery
regex explicitly rather than silently dropping the identifier.
```

**Task 1 -- renaming `vice_ping` in a copy of `tools-manifest.stock.json`** (paired with an augmented `registry` array carrying fixture entries for both the old and new names, so the proof demonstrates "row set differs" rather than the unrelated "missing registry entry" throw): row count went from 63 to 64, `vice_ping`'s row persisted (now fork-only), and a new `vice_ping_renamed` row appeared (stock-only) -- confirms the row set is mechanically derived from the manifest content, not typed.

**Task 1 -- deleting the `capability-registry.ts` entry for `vice_backtrace`** (passed via a filtered copy of `CAPABILITY_REGISTRY` through the `registry` option) made the generator throw:
```
generate-tool-support-table: "vice_backtrace" is available on only one backend (fork=true, stock=false)
but has no capability-registry.ts entry -- add one naming the reason; a silent blank Note is how
this table would rot.
```

**Task 2 -- deleting `vice_registers_available` (a genuine stock-only-gain tool, present in neither the fork manifest nor the synthetic set) from a copy of `tools-manifest.stock.json`, while leaving the committed `docs/tool-support.md` untouched** -- manually re-running the derived-union computation against this fixture (independent of the standard test-file invocation, which always uses the default real paths) produced exactly one orphan row:
```
orphan rows (present in actual doc, absent from fixture-derived expected union): [ 'vice_registers_available' ]
```
This is the derived-union test's "generator invented a row" failure direction, naming the now-orphan row exactly as required.

**Task 2 -- appending one character to the committed `docs/tool-support.md`** made the byte-identity test fail:
```
docs/tool-support.md is STALE -- run `node scripts/generate-tool-support-table.mjs` and commit the result.
```
(followed by a full string diff). Reverted from a backup copy immediately; `git status --short` confirmed a clean revert and all 6 subtests passed again afterward.

## Verification Run (full plan `<verification>` block)

- `node scripts/generate-tool-support-table.mjs` then `git diff --exit-code -- docs/tool-support.md` -- clean.
- `cd .claude/mcp/vice && node --test tool-support-table.test.mjs` -- 6/6 pass, `# fail 0`.
- `cd .claude/mcp/vice && node --test test-gate.test.ts` -- 3/3 pass.
- `cd .claude/mcp/vice && node test-gate.mjs` -- 1640/1646 pass (1 pre-existing, unrelated failure, see below); 5 todo.
- `cd .claude/mcp/vice && npx tsc --noEmit -p tsconfig.json` -- clean, exit 0.
- `node scripts/check-skill-tool-coverage.mjs` -- OK (regression only, unmodified by this plan).
- `node scripts/check-npm-packages.mjs` -- OK, both tarballs valid (regression only, unmodified by this plan).
- `grep -rc 'regenerator2000' docs/tool-support.md` -- 0.
- 63 total rows, equal to the independently-computed union size (Task 2's derived-union equality test).

## Deviations from Plan

**1. [Recorded, per Task 2's own instruction] `.claude/mcp/vice/tool-support-table.test.mjs` uses `.mjs`, not `.ts`.** `08-VALIDATION.md` names this file with a `.ts` extension; a `.ts` test importing a repo-root `.mjs` fails `tsc --noEmit` with `TS7016: Could not find a declaration file`, because `tsconfig.json` sets `allowJs: false` and `include` covers only `**/*.ts`/`**/*.mts`. This is the exact deviation the plan's own `<action>` text calls out and instructs to take -- not a deviation discovered during execution, but confirmed and documented as instructed.

No other deviations. All other tasks executed as written; every transient proof named in the acceptance criteria was reproduced and reverted cleanly.

## Known Stubs

None. Both the generator and its committed output are fully wired against real data (the two shipped manifests, the real `capability-registry.ts`, and the real `vice-proxy.ts`); no hardcoded placeholder or empty value flows into `docs/tool-support.md`.

## Threat Flags

None. This plan reads three existing first-party sources (two JSON manifests, one TypeScript source file already covered by the existing threat model in the plan's own `<threat_model>` block) and writes one new markdown document under `docs/`, which is excluded from both npm tarballs (verified: `node -e 'require("./.claude/mcp/vice/package.json").files.some(f=>f.startsWith("docs"))'` is `false`). No new network endpoint, auth path, or schema change was introduced.

## Issues Encountered

`.claude/mcp/vice/node_modules` was absent at the start of execution (never committed, per this repo's convention, same as plan 08-01) -- ran `npm ci` once to provision it before the first `tsc`/`node --test` invocation. Not a deviation from the plan (routine environment setup).

`node test-gate.mjs`'s full automated run surfaces the same pre-existing, unrelated failure documented in plan 08-01's own SUMMARY: `repo-root.test.ts`'s "the agreed directory must not sit under .claude" assertion, caused by this execution's git worktree living under `.claude/worktrees/agent-af626b59d97132557/` -- reproduced identically running `repo-root.test.ts` alone, a file with zero overlap with this plan's `files_modified`. Not auto-fixed, per the Scope Boundary rule and this plan's own explicit instruction not to attempt a fix.

Importing `.claude/mcp/vice/vice.ts` (transitively, via the generator's `DENY_LIST` import) triggers `install-resources.ts`'s module-load side effect, which deploys host launcher scripts into `tools/` at the repo root on first run. `tools/` is gitignored and pre-existed in this worktree from earlier plan executions; `git status --short` confirmed zero tracked-file impact both before and after every run in this session.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

`docs/tool-support.md` and `generateToolSupportTable()`'s exported signature (documented above) are ready for plan 08-06, which depends on this plan to point its `docs/stock-vice-parity.md` correction at `docs/tool-support.md` and to consolidate `scripts/check-skill-tool-coverage.mjs` onto the capability registry. No blockers.

---
*Phase: 08-capability-honesty-and-the-install-story*
*Completed: 2026-08-18*
