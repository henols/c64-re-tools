---
phase: 52-remove-the-fork-backend
reviewed: 2026-09-12T14:17:06Z
depth: standard
files_reviewed: 106
files_reviewed_list:
  - CLAUDE.md
  - docs/stock-hard-losses.md
  - docs/stock-vice-parity.md
  - .github/workflows/ci.yml
  - README.md
  - scripts/audit-gate.mjs
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-capability-honesty.mjs
  - scripts/check-skill-cli-invocations.mjs
  - scripts/check-skill-description-overlap.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/lib/audit-root.mjs
  - scripts/lib/skill-corpus.mjs
  - scripts/lib/skill-descriptions.mjs
  - scripts/lib/skill-honesty-checks.mjs
  - src/mcp/vice/acme-gate.ts
  - src/mcp/vice/anno-confinement.test.ts
  - src/mcp/vice/anno-durability.test.ts
  - src/mcp/vice/anno-overlap.test.ts
  - src/mcp/vice/anno-store.test.ts
  - src/mcp/vice/anno-store.ts
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/audit-integrity.test.ts
  - src/mcp/vice/audit-root-args.test.ts
  - src/mcp/vice/backend-detect.mts
  - src/mcp/vice/backend-detect.test.ts
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-epoch.test.ts
  - src/mcp/vice/broker-kill.test.ts
  - src/mcp/vice/broker-launch.mts
  - src/mcp/vice/broker-launch.test.ts
  - src/mcp/vice/ci-guardrails.test.mjs
  - src/mcp/vice/docs-fork-absence.test.ts
  - src/mcp/vice/docs-fork-decision.test.ts
  - src/mcp/vice/evid-ingest.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-tool-oracle.test.ts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/host-tool-transport.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/README.md
  - src/mcp/vice/repo-root.test.ts
  - src/mcp/vice/resources/backend-detect.mjs
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/broker-launch.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/shipped-modules.ts
  - src/mcp/vice/skill-honesty-checks.test.ts
  - src/mcp/vice/smoke.mjs
  - src/mcp/vice/spawn-seam.test.ts
  - src/mcp/vice/stock-a4-checkpoint-flood.test.ts
  - src/mcp/vice/stock-address.ts
  - src/mcp/vice/stock-broker-live.test.ts
  - src/mcp/vice/stock-condition.ts
  - src/mcp/vice/stock-connect.test.ts
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/stock-derived.ts
  - src/mcp/vice/stock-diagnose.test.ts
  - src/mcp/vice/stock-diagnose.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/stock-handler.test.ts
  - src/mcp/vice/stock-handler.ts
  - src/mcp/vice/stock-live-broker-monitor.test.ts
  - src/mcp/vice/stock-paths.ts
  - src/mcp/vice/stock-petscii.ts
  - src/mcp/vice/stock-protocol.ts
  - src/mcp/vice/stock-recycle.ts
  - src/mcp/vice/stock-reproducible-run.test.ts
  - src/mcp/vice/stock-reproducible-run.ts
  - src/mcp/vice/stock-run-until.test.ts
  - src/mcp/vice/stock-symbols.ts
  - src/mcp/vice/stock-timing.test.ts
  - src/mcp/vice/stock-timing.ts
  - src/mcp/vice/test-gate.mjs
  - src/mcp/vice/test-gate.test.ts
  - src/mcp/vice/text-capability-probe.test.ts
  - src/mcp/vice/text-capability-probe.ts
  - src/mcp/vice/text-connect.ts
  - src/mcp/vice/text-monitor-live.test.ts
  - src/mcp/vice/text-protocol.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/vice-broker-client.test.ts
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-supervision.test.ts
  - src/mcp/vice/vice-errors.ts
  - src/mcp/vice/vice-proxy.test.ts
  - src/mcp/vice/vice-proxy.ts
  - src/skills/c64-disk-access/SKILL.md
  - src/skills/c64-memory-mapping/SKILL.md
  - src/skills/c64-petcat/SKILL.md
  - src/skills/c64-program-recon/references/control-flow.md
  - src/skills/c64-program-recon/references/observation-hazards.md
  - src/skills/c64-program-recon/references/sound-and-input.md
  - src/skills/c64-program-recon/references/tool-selection.md
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-ram-capture/SKILL.md
  - src/skills/routine-queue-walker/SKILL.md
  - src/skills/vice-wedge-triage/SKILL.md
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 52: Code Review Report

**Reviewed:** 2026-09-12T11:25:27Z (round 1); round 2 gap-closure review appended 2026-09-12T14:17:06Z
**Depth:** standard
**Files Reviewed:** 106
**Status:** issues_found

## Summary

Phase 52 removes the custom `barryw/vice-mcp` fork backend across roughly 30
files: `vice.ts`, `vice-probe.ts`, `refresh-manifest.ts`, `tools-manifest.json`,
`capability-registry.ts`, the `DENY_LIST`/`denyListRefusalMessage()` apparatus,
`docs/tool-support.md`, `scripts/generate-tool-support-table.mjs`, plus large
fork-only regions inside `vice-proxy.ts` and all backend detection inside
`backend-detect.mts`. The deletions themselves are clean: `vice-proxy.ts`'s
dispatch is now unconditional through `stockDispatch.dispatchStock()` with no
fall-through path, `stock-dispatch.ts`'s `resolveAdvertisedToolDefinition()`
and `manifestPathForBackend()` correctly dropped their now-unreachable
`backend === "fork"` branches rather than leaving them stubbed, and the new
`docs-fork-absence.test.ts`/`docs-fork-decision.test.ts` guards are genuinely
falsifiable — both carry non-vacuity floors, planted-violation tests in both
directions, and negative controls (comment/string-literal exemptions,
`RegExp.prototype.exec()` disambiguation) rather than asserting nothing. The
`spawn-seam.test.ts` frozen set is emptied correctly (FORKRM-01), and its
set-equality assertion still fails in both directions, so it is not a guard
that quietly stopped checking anything.

Two real defects survived the deletion pass, both consistent with this
phase's known failure mode of leftover code built for a two-backend world:

1. `broker-launch.mts` still carries a `backend !== "stock"` fork code path
   (`buildViceArgs()`'s `-mcpserver` branch, `probeReady()`'s HTTP-probe
   fallback, and the now-unreachable `defaultHttpProbe()` it feeds) even
   though `ViceBackend` was narrowed to the single literal `"stock"` by this
   same phase (`backend-detect.mts`). This mirrors the already-known
   `buildViceArgs()`/`probeReady()` dead-code example called out for this
   phase, and is recorded here as still present on this tree.
2. A previously-undocumented one: `vice-broker-client.ts`'s
   `ControlHostStateFields`/`hostState()` still declares and parses a
   `warm_floor` field that the broker (`broker-control.mts`/`vice-broker.mts`)
   stopped sending back in an earlier phase (41-05) and that
   `broker-control.test.ts` explicitly asserts is now ABSENT from the wire.
   The client-side type claims a `number`; the real runtime value is always
   `NaN`.

No security vulnerabilities, hardcoded secrets, or data-loss risks were
found. No blocker-level findings.

## Warnings

### WR-01: Dead fork-only code paths survive in broker-launch.mts after ViceBackend was narrowed to one literal

**File:** `src/mcp/vice/broker-launch.mts:382-383` (also `:852-875`, `:1092-1093`)
**Issue:** `backend-detect.mts` narrows `export type ViceBackend = "stock"` (FORKRM-01, plan 52-06) — the type has exactly one inhabitant. `broker-launch.mts`'s `buildViceArgs()` still ends with an `else` branch that builds `-mcpserver`/`-mcpserverhost`/`-mcpserverport` argv for a backend value that can no longer exist:
```ts
  const host = mcpHost ?? process.env.VICE_BROKER_MCP_HOST ?? "0.0.0.0";
  return ["-mcpserver", "-mcpserverhost", host, "-mcpserverport", String(port)];
```
Likewise `probeReady()` falls through to `defaultHttpProbe()` (a whole ~25-line function, lines 846-875) whenever `deps.backend !== "stock"` — a condition that is now provably unreachable given every real call site threads `backend: ViceBackend` down from the single `resolvedBackend()` call. This is exactly the class of leftover-after-deletion issue this phase is expected to be checked for (its own header material calls out this same function pair as a known example), and it is still present on this tree at review time. It costs real maintenance surface: a future reader has to re-derive that the branch is dead, `mcpHost`/`VICE_BROKER_MCP_HOST` plumbing threads through `TryLaunchDeps`, `AcquirePortAndLaunchDeps`, `HandleAcquireDeps` and `superviseDepsFor()` for a flag that can never be emitted, and `ProbeDeps.httpProbe`/`defaultHttpProbe()` exist purely to serve a branch nothing can reach.
**Fix:** Since `backend` is typed as the single-member `ViceBackend` literal, drop the `if (backend === "stock")`/`else` split in `buildViceArgs()` and `probeReady()` down to the stock body directly (or, if the `backend` parameter is being kept for a future second backend, say so explicitly in the doc comment rather than leaving live-reading callers to conclude it is reachable). Delete `defaultHttpProbe()`, the `mcpHost`/`VICE_BROKER_MCP_HOST` argv path, and their now-unexercised plumbing in the same pass, or add a one-line note stating why it is being deliberately retained as a template for a hypothetical future backend.

### WR-02: vice-broker-client.ts's hostState() parses a `warm_floor` field the broker no longer sends

**File:** `src/mcp/vice/vice-broker-client.ts:626-644, 1084-1109`
**Issue:** `ControlHostStateFields` declares `warm_floor: number` and `hostState()` builds its return value as:
```ts
warm_floor: Number(line.warm_floor),
```
but the broker's own wire response (`broker-control.mts`'s `ControlResponse`'s `"host_state"` variant, and `vice-broker.mts`'s `onHostState()` callback) has not carried a `warm_floor`/`warmFloor` field since plan 41-05 retired the warm floor — confirmed by `broker-control.test.ts:347`: `assert.equal(Object.prototype.hasOwnProperty.call(resp, "warm_floor"), false, ...)`. Because the field is genuinely absent on the wire, `Number(undefined)` evaluates to `NaN`, so every `hostState()` caller's `warmFloor` is silently `NaN` rather than a value the type (`number`) promises. This phase (52) touched this exact interface (narrowing `backend: ViceBackend | null`) without removing the adjacent stale field, so it is a leftover the fork-removal pass should have caught rather than a new regression it introduced — but it sits in a file this phase edited, at the same interface. No production caller currently reads `.warmFloor` from a `hostState()` result (only `.backend`/`.vice_bin` are consumed, in `text-tools.ts`), so this is not exploitable today, but it is a live trap: a future consumer trusting the `number` type will silently receive `NaN`.
**Fix:** Delete the `warm_floor` field from `ControlHostStateFields` and from `hostState()`'s return object, matching the wire's actual shape and the discipline `broker-control.mts`/`vice-broker.mts` already apply.

### WR-03: Missing semicolon after handleRecycle's function-expression assignment

**File:** `src/mcp/vice/vice-proxy.ts:676-678`
**Issue:** Every other top-level statement in this file (and the project's documented code-style convention — "Semicolons are used consistently (not an ASI-reliant style)") ends with an explicit semicolon. `handleRecycle` is assigned via a `const ... = async function handleRecycle(args) { ... }` expression with no trailing `;`:
```ts
const handleRecycle: (args: Record<string, unknown>) => Promise<ToolCallResult> = async function handleRecycle(args) {
  return dispatchStockFor(RECYCLE_TOOL.name, args);
}

// ----------------------------------------------------------- vice_diagnose
...
async function handleDiagnose(args: Record<string, unknown>): Promise<ToolCallResult> {
```
ASI happens to make this safe here because the next statement (`async function handleDiagnose`) cannot be parsed as a continuation of the previous expression, but the file otherwise never relies on ASI, and this is the one place that does.
**Fix:** Add the trailing semicolon after the closing `}` on line 678, matching every other declaration in the file.

## Info

### IN-01: `docs/stock-vice-parity.md`'s legacy "two things lost" count and `docs/stock-hard-losses.md`'s three-section split read as disagreeing at a glance

**File:** `docs/stock-vice-parity.md:26-30`
**Issue:** `stock-vice-parity.md`'s "Net" summary says "The two things genuinely lost were SID state read-back and low-level/matrix keyboard", grouping RESTORE/NMI under the keyboard-family bullet. `stock-hard-losses.md` (the newer, authoritative acceptance record this same phase adds) instead lists three separate accepted losses: SID read-back, matrix keyboard, and RESTORE/NMI as its own section. The document's own dated note at the top explains it is retained for historical measurement records and explicitly defers loss accounting to `stock-hard-losses.md`, so this is not a functional defect, but a reader skimming only the "Net:" line without reaching the dated note at the very top could walk away with a stale two-loss count.
**Fix:** Optional: add a one-clause parenthetical to the "Net:" line (e.g. "now split into three permanent losses, see `docs/stock-hard-losses.md`") so the count does not need the reader to have already read the header disclaimer.

---

## Round 2 Findings — Gap-Closure Review (CLAUDE.md + docs-fork-absence.test.ts, reviewed 2026-09-12T14:17:06Z)

This round reviewed exactly the two non-`.planning/` files changed between `edbbf159` and `HEAD`:
`CLAUDE.md` (documentation-drift repair — replacing every stale reference to a deleted module or
concept with the surviving one) and `src/mcp/vice/docs-fork-absence.test.ts` (grew from 13 to 24
tests, adding `findDeletedModuleCitations()`/`scanTextForDeletedModuleCitations()` and
`FORBIDDEN_TRANSPORT_PHRASES`/`STALE_MANIFEST_FILENAMES` plus their wiring over a prose corpus).

`CLAUDE.md`'s changes were checked against the actual source tree, not just read for plausibility:
`ViceError`/`MachineRestartedError` do live in `vice-errors.ts` (confirmed at `vice-errors.ts:158`
and `:185`), `stock-connect.ts` does own `stockConnect()`/`stockDisconnect()`/`stockReconnect()`,
`stock-dispatch.ts` does hold the mutable `heldSession` module-level state, and
`tools-manifest.stock.json` does exist and is resolved through `stock-dispatch.ts`. No stale or
fabricated cross-reference was found in this file's diff.

The new predicate logic in `docs-fork-absence.test.ts` was run directly (`node --test`, all 24
tests pass) and probed with adversarial in-memory inputs beyond its own planted-violation suite,
since this file is itself a guard and the review brief for this round explicitly weighs a guard
that passes vacuously (or matches too little/too much) above style. One real asymmetry was found
in the new regex construction (WR-04, below); it does not currently make any check pass
vacuously — the existing planted-violation and non-vacuity tests are sound and all 24 tests are
green — but it is a genuine latent robustness gap in a guard whose entire job is boundary
precision. Two minor quality nits are recorded as Info.

### WR-04: `DELETED_MODULE_CITATION_RE` only enforces a leading word-boundary, not a trailing one, unlike its sibling `STALE_MANIFEST_CITATION_RE` in the same file

**File:** `src/mcp/vice/docs-fork-absence.test.ts:154-155` (contrast `:203-206`)
**Issue:** The regex built for deleted-module filename citations is:
```ts
const DELETED_MODULE_CITATION_SOURCE = `(?:^|[^A-Za-z0-9_.-])(${DELETED_MODULES.map((m) => m.replace(/\./g, "\\.")).join("|")})`;
const DELETED_MODULE_CITATION_RE = new RegExp(DELETED_MODULE_CITATION_SOURCE, "g");
```
This only requires a non-word/start-of-string character *before* the filename; it has no equivalent trailing assertion. Its sibling in the very same file, `STALE_MANIFEST_CITATION_RE`, gets both sides:
```ts
const STALE_MANIFEST_CITATION_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_.-])(${STALE_MANIFEST_FILENAMES.map((m) => m.replace(/\./g, "\\.")).join("|")})(?:$|[^A-Za-z0-9_.-])`,
  "g",
);
```
The doc comment above `DELETED_MODULE_CITATION_SOURCE` frames the whole construction as "boundary-aware" and motivates it entirely by the leading-edge `device.ts`/`vice.ts` false positive, but never states that the trailing edge is deliberately left open — reading the comment, a maintainer would reasonably expect symmetric treatment, exactly as the sibling regex two blocks down provides. Verified directly against the real, exported `findDeletedModuleCitations()` (not a re-implementation):
```
findDeletedModuleCitations("see vice.tsx for details")   -> [ 'vice.ts' ]
findDeletedModuleCitations("see vice.ts-old for details") -> [ 'vice.ts' ]
```
A hypothetical future filename that merely starts with a deleted module's name (`vice.tsx`, `vice.ts.bak`, a markdown anchor like `vice.ts#history`) is indistinguishable from a real citation of the deleted `vice.ts`, and would report exactly the failure mode this guard exists to prevent people from routing around: a false positive that gets a future maintainer to loosen or delete the check rather than fix a real one. It does not currently fire (no such string exists in the scanned corpus today, confirmed by a live run), so this is latent rather than active, and it can only ever widen matches (never narrow them), so it is not a silent-miss risk — but it is an inconsistency inside one guard file that undermines the file's own stated design contract.
**Fix:** Give `DELETED_MODULE_CITATION_SOURCE` the same trailing assertion `STALE_MANIFEST_CITATION_RE` already uses:
```ts
const DELETED_MODULE_CITATION_SOURCE =
  `(?:^|[^A-Za-z0-9_.-])(${DELETED_MODULES.map((m) => m.replace(/\./g, "\\.")).join("|")})(?:$|[^A-Za-z0-9_.-])`;
```
and add a planted-violation control mirroring the existing `device.ts` one for the trailing side (e.g. asserting `vice.tsx` is not reported), the same way `tools-manifest.stock.json` already gets one for `STALE_MANIFEST_CITATION_RE`.

## Info (round 2)

### IN-02: `findDeletedModuleCitations` is the only predicate in the file exported with no consumer

**File:** `src/mcp/vice/docs-fork-absence.test.ts:163`
**Issue:** Every sibling predicate in this file — `findForbiddenIdentifiers`, `scanTextForForbiddenIdentifiers`, `scanTextForDeletedModuleCitations`, `findStaleTransportPhrases`, `scanTextForStaleTransportPhrases` — is declared as a plain, unexported `function`, consistent with the file's own comment that planted-violation tests should "drive this EXACT function" from within the same module. `findDeletedModuleCitations` alone is declared `export function`. A repo-wide grep found no importer anywhere else in `src/` or `scripts/`. This is a harmless but unnecessary widening of the module's surface for a test-only file that is deliberately excluded from `package.json`'s `files[]`.
**Fix:** Drop the `export` keyword unless a specific external consumer is planned; if one is planned, note it in the doc comment so a future reader does not have to grep for it to find out it is currently unused.

### IN-03: Non-vacuity floor comment overstates its own headroom

**File:** `src/mcp/vice/docs-fork-absence.test.ts:324-337`
**Issue:** The comment above the `proseScanned >= 18` assertion states "The real count today is twenty files; the floor is set well under that with headroom so a deliberate pruning does not red this." Measured directly (`README.md` + `CLAUDE.md` + `skillMarkdownFiles()`), the real count is indeed 20, but the floor of 18 gives only 2 files of headroom (10%) — adding a single new template/reference `.md` file under `src/skills/**` and later deleting two unrelated ones would already approach the floor. "Well under… with headroom" reads as more slack than the numbers actually provide; this is a documentation-accuracy nit inside the guard's own comment, not a functional defect (the floor still does its job of catching a fully-emptied population).
**Fix:** Either tighten the prose ("floor is set 2 files below today's count") or lower the floor further (e.g. `>= 15`) if more real headroom is intended, so the comment and the assertion agree on how much slack actually exists.

---

_Reviewed: 2026-09-12T14:17:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
