---
status: issues_found
phase: 14-backend-decision
depth: standard
reviewed: 2026-08-22
files_reviewed: 6
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
---

# Phase 14 Code Review — Backend Decision

## Scope

Six files, the entire code surface of a phase whose deliverable was a recorded
decision rather than a feature. Scope came from the five plan SUMMARYs plus a
git-diff cross-check, which correctly surfaced one file belonging to no plan
(`audit-integrity.test.ts`, changed by the orchestrator's wave-1 post-merge fix
`db96a18`).

| File | Change | Verdict |
|------|--------|---------|
| `.claude/mcp/vice/docs-fork-decision.test.ts` | new (181 lines) | clean |
| `.claude/mcp/vice/fork-live.test.ts` | new (318 lines) | 1 info |
| `.claude/mcp/vice/audit-integrity.test.ts` | modified | clean |
| `.claude/mcp/vice/capability-registry.test.ts` | modified (+2 tests) | clean |
| `.claude/mcp/vice/test-gate.mjs` | modified (registry entry) | clean |
| `.claude/mcp/vice/test-gate.test.ts` | modified (assertion target) | clean |

## Findings

### IN-01 (Info) — `fork-live.test.ts:80-91`: skip-reason sentence describes behaviour the code does not have

`resolvedBinPath` is computed with `??`:

```ts
const resolvedBinPath = process.env.VICE_LIVE_FORK_BIN ?? VICE_LIVE_FORK_BIN_DEFAULT;
```

`??` falls back only on `undefined` or `null` — never on a truthy string. But the
FIRST arm of `SKIP_REASON`, taken when `!process.env.VICE_LIVE_FORK_BIN` (unset or
empty), tells the reader:

> Defaults to `/usr/local/bin/x64sc` when set to a truthy non-path value.

A truthy non-path value cannot reach that arm. It falls to the SECOND arm and
reports `does not exist on disk`. The sentence is factually misplaced and would
mislead a developer debugging why their opt-in did not take effect.

Impact is confined to a diagnostic string; no assertion or control flow depends on
it. **Resolved in this phase** — see the fix commit below.

## Verified, not flagged

- **The fifth pinned guard name cannot perturb `audit-integrity.test.ts`.**
  `EXPECTED_GUARD_NAMES_FOR_ASSERTION` is also indexed by `buildSyntheticTree()`
  via `[i] ?? 'docs-extra-'+i`, but every synthetic case uses the default
  `guardCount: 4`, so indices 0-3 are unchanged, `RED_GUARD_NAME` (`[0]`) is
  unchanged, and the `>= 4` non-vacuity floor still holds.
- **`fork-live.test.ts` forces loopback.** It genuinely overrides
  `buildViceArgs()`'s `0.0.0.0` default, and asserts `-mcpserverhost` is
  immediately followed by the literal `127.0.0.1`.
- **No cross-file leak from the unrestored `useInstance()` mutation.** Node's
  `--test` isolates each file into its own process, so it cannot reach sibling
  manual-only tests.
- **`docs-fork-decision.test.ts` matches `KEYBOARD_MATRIX_SET` case-sensitively**,
  as its plan required, and was proven non-vacuous by a real break-and-restore
  (lower-casing the literal produced exactly one failure naming the missing
  string).
- **The manual-only registration is in one place.** `test-gate.mjs` holds the
  registry; `test-gate.test.ts` imports that real constant and deep-equals it
  against a literal — an assertion target, which is the established idiom, not a
  competing second discovery list.
- **A transient `audit-integrity.test.ts` failure did not reproduce.** It is the
  repository's documented full-suite-concurrency flakiness, not a defect in this
  diff.

## Disposition

No Critical or Warning findings. The single Info finding was confirmed against the
source and fixed in this phase rather than deferred, since it is a two-line
correction to a diagnostic string with no behavioural risk.
