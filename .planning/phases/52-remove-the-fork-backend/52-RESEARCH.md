# Phase 52: Remove the Fork Backend - Research

**Researched:** 2026-09-11
**Domain:** In-repo deletion / decision-reversal (no new library, no external service) — TypeScript/`.mts` source tree, planning-doc guards, and skill playbooks in a single npm-published Claude Code plugin.
**Confidence:** HIGH for everything tagged `[VERIFIED: <path>]` below (all obtained by `Read`ing the cited file or running the cited grep this session, 2026-09-11). `[ASSUMED]` is used only for the handful of forward-looking recommendations (e.g. exact new requirement-id spelling), which are decisions for the planner/owner, not facts.

There is no CONTEXT.md for this phase — per the phase brief, the ROADMAP §Phase 52 section (goal, 7 success criteria, 6 Notes) is itself the decision record and constrains this research the same way a CONTEXT.md normally would. No `<user_constraints>` block follows for that reason.

## Summary

This is a deletion phase with a paper trail, not a build phase. Two things make it harder than "delete backend === fork branches everywhere":

1. **`vice.ts` (772 lines) is two modules wearing one file.** Roughly half of it — `ViceError`/`MachineRestartedError` (the shared error hierarchy), `readEpoch`/`EPOCH_FILE` (epoch bookkeeping), and, critically, `activeInstance()`/`useInstance()`/`mcpHost()` — is **shared infrastructure the STOCK backend's own lease-acquisition path depends on today** (`buildHeldLease()` in `vice-proxy.ts:2350` reads `activeInstance()` to build the `HeldLease` stock handlers use). The other half — `DEFAULT_ENDPOINT`, `rpc()`, `ensureInitialized()`, `withReconnect()`, `call()`/`callTool`, `serverInfo()`, `DENY_LIST`/`denyListRefusalMessage()` — is the fork's HTTP/JSON-RPC transport and dies outright. The ROADMAP's own Notes undercounted the blast radius here: it names 8 "shared-infra-only" importers and says "ten," but a fresh grep (below) finds **23 non-test modules** importing from `vice.ts` today, including several (`vice-broker-client.ts`, `refresh-manifest.ts`, `vice-proxy.ts`) the Notes did not mention and which need very different treatment.
2. **A second, larger fork-only code region hides inside `vice-proxy.ts` itself and was not named in the ROADMAP Notes at all**: `forwardToVice()` (from `:3035`), `gatherWedgeEvidence()`/`gatherCheckpointTrapEvidence()`/`gatherBracketEvidence()` (from `:1505`), `handleRecycle()`/`handleDiagnose()`'s fork arms, and `rewriteArguments()` (`:2013`, called only from those two sites) are **all unreachable once `buildBackendAwareTool()`'s fork arm is deleted** — `stock-paths.ts:20-24` independently confirms, in its own header comment, that stock never calls `rewriteArguments()` and has its own, parallel path-translation mechanism (`withEmulatorSidePath()` / `hostpath.ts`). This means CLAUDE.md's whole "derived tools must be intercepted before `forwardToVice()`" Architecture bullet — and the `docs-linerefs.test.ts` guard built specifically to pin its two line-number citations — describe a hazard that no longer exists once the fork is gone, not a hazard that needs re-citing at new line numbers.

**Primary recommendation:** Sequence this phase in the order the ROADMAP Notes already state (decision record + its guard first, against a green baseline, then code), but insert one more step before any deletion: **split `vice.ts` into a shared module and delete the rest**, because the stock backend's own lease path already depends on symbols this file happens to also define. Budget real time for the `vice-proxy.ts` fork-only region (`forwardToVice`/`gatherWedgeEvidence`/`rewriteArguments`) — it is bigger and more load-bearing (CLAUDE.md architecture text + a dedicated test file) than the ROADMAP Notes disclose. Route `capability-registry.ts`'s six `"hardware"`-category entries into whatever document holds the criterion-3 acceptance record — their `reason` text already IS the evidence criterion 3 asks for — and delete the rest of that registry (the runtime-refusal message becomes actively false once there is no second backend to redirect to).

## Requirement ID Guidance

The phase brief says requirement IDs are "TBD — declare at planning time." Concretely:

- `FORK-01` / `FORK-02` are **not** milestone requirements — they are rows in `.planning/PROJECT.md`'s `## Key Decisions` table (`FORK-01` at `PROJECT.md:933`, full text `PROJECT.md:933`-ish block quoted below) and an `### Out of Scope` bullet (`PROJECT.md:438`). They were also *mirrored* into an archived milestone requirements file, `.planning/milestones/v0.4.0-REQUIREMENTS.md` (marked `Complete` there) `[VERIFIED: grep -rln "FORK-01\|FORK-02" .planning/milestones/]` — that file is a historical snapshot and is **not** edited by this phase; only the live `PROJECT.md` Key Decisions row and Out of Scope bullet are in scope for criterion 2.
- The current `.planning/REQUIREMENTS.md` is v1.0.0-scoped (`DECOMP-*`, `BUILD-*`, `EQUIV-*` only, confirmed by reading its `## v1.0.0 Requirements` and `## Traceability` sections `[VERIFIED: .planning/REQUIREMENTS.md:49-135]`) and contains **no** `FORK-*` id today. Its `## Traceability` table asserts "every v1.0.0 requirement maps to exactly one phase; none are orphaned" — so if this phase declares requirements there, they need a new subsection and new Traceability rows pointing at Phase 52, in a fresh id namespace (e.g. `FORKRM-01..0N`) so as not to collide with the historical `FORK-01`/`FORK-02` decision-table ids, which stay where they are (PROJECT.md) and get amended in place, not renumbered.
- Recommend minting one requirement per success criterion (7 total) so `## Traceability` stays 1:1, e.g. `FORKRM-01` (backend selection removed) … `FORKRM-07` (test floor green). `[ASSUMED — exact spelling/count is the planner's call, not a measured fact]`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Backend selection (`VICE_BACKEND`, `probeBackend`/`resolvedBackend`) | MCP server process (`vice-proxy.ts` module scope) | Host broker (`vice-broker.mts`, compiled) | Both sides resolve backend independently today and cross-check (`vice-proxy.ts:2440-2486`); collapsing to one backend removes the cross-check, not just one side |
| Fork HTTP/JSON-RPC transport (`call`, `rpc`, `serverInfo`) | MCP server process (`vice.ts`) | — | Single seam by design (CLAUDE.md); dies whole |
| Stock binary-monitor dispatch (`stockDispatch.dispatchStock`) | MCP server process (`stock-dispatch.ts`) | Broker (leases the emulator) | Unaffected — this is what survives as *the* dispatch path |
| Broker lease bookkeeping (`activeInstance`/`useInstance`, port/url/epochFile) | MCP server process (`vice.ts`, shared half) | Host broker | Used by **both** the (dying) fork transport and the (surviving) stock lease path — this is the split's hard part |
| Capability-gap messaging (`capability-registry.ts`) | MCP server process | Generated docs (`docs/tool-support.md`) | Per-backend-comparison concept; vacuous with one backend except for the "hardware" reasons, which must migrate to a permanent-acceptance record |
| Skill-text backend routing (`requires the fork` / `fork-only` prose) | Documentation (`src/skills/**`) | CI gate (`scripts/check-skill-fork-honesty.mjs`) | Both need rewriting together — the gate derives its policed name list from `capability-registry.ts`, so registry and prose changes are coupled |

## Project Constraints (from CLAUDE.md)

Directives this phase must honor while deleting code:

- **Planning vocabulary stays out of shipped files.** `src/mcp/vice/*.ts` and `src/skills/**` must never gain a `.planning/*` path, phase number, or bare `D-NN`/`G-NN-N` id (enforced on skills by `skills-planning-vocabulary.test.ts`; this phase's rewrites of skill fork-language must stay clean of it, and any new source comments explaining *why* the fork is gone must cite `docs/`-rooted paths, not `.planning/` ones).
- **The one surviving citation form** is a decision id resolving OUTSIDE `.planning/`, cited with its document named (e.g. `` `docs/stock-vice-parity.md` D-03 ``) — relevant if this phase leaves any in-code comment citing the reversal.
- **`docs-linerefs.test.ts`'s line-number guard** — this phase is very likely to falsify its premise (see Guards section below), not just drift its numbers.
- **Never auto-install external tools** — inapplicable; this phase installs nothing.
- **GSD workflow / worktree isolation** — standard; no phase-specific interaction found.
- **Comments rule**: "what NOT to do, with the specific past mistake named" — every deleted fork call site currently carries exactly this shape of comment (e.g. `stock-paths.ts:19-24`'s "WHAT NOT TO DO: Never call rewriteArguments() from a stock handler"); deleting the fork side does not retire the *lesson*, since a future contributor could still be tempted to reintroduce cross-talk — consider whether any of these comments should survive in trimmed form rather than vanish with their code.

## Package Legitimacy Audit

Not applicable. This phase installs no new external package (npm, PyPI, or otherwise) — it is pure deletion/rewrite of in-repo TypeScript, JSON manifests, and Markdown. `.planning/config.json`'s `brave_search`/`exa_search`/`firecrawl` are all `false` for this project, consistent with no external-library research being needed here.

---

## 1. The exact removal inventory, per success criterion

All counts below were produced this session (2026-09-11) against the working tree; grep commands are given so the planner/executor can re-run them and detect drift.

### Criterion 1 — `VICE_BACKEND`, `probeBackend()`, `resolvedBackend()`'s fork branch, `buildBackendAwareTool()`, every `backend === "fork"` test

| Symbol / file | Defined at | Consumers (non-test) | Disposition |
|---|---|---|---|
| `VICE_BACKEND` env var | read inside `backend-detect.mts` | `vice-proxy.ts` (via `resolvedBackend()`), `vice-broker.mts`, `broker-launch.mts` | Env var itself disappears from prose/docs; the *resolution* logic collapses to "always stock" |
| `export type ViceBackend = "fork" \| "stock"` | `backend-detect.mts:67` | 6 non-test files `[VERIFIED: grep -rl 'ViceBackend' --include='*.ts' --include='*.mts' . \| grep -v test]` | Narrows to a single literal type, or is deleted and callers drop the parameter entirely |
| `export function probeBackend(...)` | `backend-detect.mts:145` | `resolvedBackend()` internally | Whole function dies — nothing left to probe between |
| `export function resolvedBackend(...)` | `backend-detect.mts:452` | `vice-proxy.ts:337` (`const ACTIVE_BACKEND = backendDetect.resolvedBackend();`), `vice-broker.mts:69`, `broker-launch.mts` (type only) | Collapses to a stub, or is deleted and every call site hard-codes stock — **this is also the cross-check site** (`vice-proxy.ts:2440-2486` compares this process's verdict against the broker's own, over the control-plane `hostState()` call); deleting one side without the other leaves dead cross-check code |
| `function buildBackendAwareTool(def, forkRun)` | `vice-proxy.ts:3378` | Called at `:3397`, `:3413`, `:3414` (manifest loop + `RECYCLE_TOOL` + `DIAGNOSE_TOOL`) | Collapses into `buildViceTool()` directly calling `stockDispatch.dispatchStock(...)` — the `ACTIVE_BACKEND.backend === "fork" ? ... : ...` ternary at `:3379-3387` is deleted, one arm survives |
| `backend === "fork"` test assertions | 12 test files, 69 total `"fork"`-string hits `[VERIFIED: per-file grep, see table below]` | — | Each file needs its fork-conditional branches removed, not skipped (criterion 7) |
| Fork transport imports | `vice.ts`'s `call`, `rpc`, `ensureInitialized`, `withReconnect`, `serverInfo` | `vice-proxy.ts` (heavily), `refresh-manifest.ts`, orphaned `vice-sync.ts` (see §2) | Deleted with `vice.ts`'s fork half |

**Test-file blast radius, re-measured 2026-09-11** (command: `grep -ac '"fork"' <file>` per file in `src/mcp/vice/`):

```
backend-detect.test.ts        22   broker-control.test.ts        10
broker-launch.test.ts          8   stock-dispatch.test.ts         6
capability-registry.test.ts    6   text-capability-probe.test.ts  5
vice-proxy.test.ts             4   text-tools.test.ts             3
vice-broker-client.test.ts     2   host-tool.test.ts              2
vice-broker-supervision.test.ts 1  vice-broker-acquire.test.ts    1
```

This **exactly matches** the ROADMAP Notes' 2026-09-11 measurement — no drift in the two weeks(none, actually same day)/since that note was written. Confirmed unchanged; safe for the planner to treat as current.

**Non-test module blast radius, re-measured 2026-09-11** (`grep -rl '"fork"' --include='*.ts' --include='*.mts' . | grep -v test`, excluding `node_modules`):

```
vice-broker.mts   backend-detect.mts   vice-broker-client.ts   vice-proxy.ts
capability-registry.ts   broker-launch.mts   stock-dispatch.ts   broker-control.mts
```

8 real files (the ROADMAP note's "9" figure included one `node_modules/@types/node/cluster.d.ts` false-positive hit from an ungrepped-out `node_modules/` — same measurement method, same result, no actual drift). `buildBackendAwareTool` itself additionally appears in `stock-derived.ts` (a doc-comment reference, not a call) — 4 files total for that token.

**`vice-broker.mts` / `broker-launch.mts` / `broker-control.mts` are host-bound `.mts` sources compiled by `build.ts` into committed `resources/*.mjs`.** Editing them requires re-running `node build.ts` before `resources-sync.test.ts` will pass again (see §7).

### Criterion 2 — `PROJECT.md`'s `FORK-01` row, `docs-fork-decision.test.ts`

Covered in full in §3 below (ordering). Six assertions, all read directly from `docs-fork-decision.test.ts` this session `[VERIFIED: src/mcp/vice/docs-fork-decision.test.ts:93-181]`.

### Criterion 3 — Stock's three hard losses recorded as ACCEPTED

Covered in §5 (skills) and §6 (capability-registry.ts) — the evidence text already exists in `capability-registry.ts`'s six `"hardware"` entries; the work is *routing* it to a permanent record and stripping "routed to the fork" language from skill text (9 sites found, see §5).

### Criterion 4 — `DENY_LIST` / `denyListRefusalMessage()` gone, `anno-tools.ts` untouched

Full consumer list already measured in `.planning/notes/deny-list-is-a-fork-artifact.md` and re-confirmed this session by reading `vice.ts` directly:

| Site | Confirmed this session |
|---|---|
| `vice.ts:201` — `export const DENY_LIST` (5 entries: `vice_disk_list`, `tools_list`, `tools_call`, `initialize`, `notifications_initialized`) | `[VERIFIED: src/mcp/vice/vice.ts:201-207]` |
| `vice.ts:229` — `denyListRefusalMessage()` | `[VERIFIED: src/mcp/vice/vice.ts:229-243]` |
| `vice.ts:698` — `call()`'s guard (`if (DENY_LIST.includes(toolName))`) | `[VERIFIED: src/mcp/vice/vice.ts:697-700]` — dies with `call()` itself |
| `vice.ts:771` — `serverInfo()`'s discovery filter | `[VERIFIED: src/mcp/vice/vice.ts:766-772]` — dies with `serverInfo()` itself |
| `vice-proxy.ts:3396` — manifest-registration skip (`if (DENY_LIST.includes(def.name)) continue;`) | `[VERIFIED: src/mcp/vice/vice-proxy.ts:3396]` |
| `capability-registry.ts:22,31,49,99,389` — cites `DENY_LIST` as precedent/exclusion in comments | Comment-only; needs a rewrite pass, not a code change |
| `anno-tools.ts:81,2010` — cites `DENY_LIST` as the precedent the inverted allowlist inverted | `[VERIFIED: src/mcp/vice/anno-tools.ts:81, :2010]` (`grep -n "DENY_LIST" anno-tools.ts` → exactly these two lines) — **comment-only citation; `CURATED_ANNO_TOOLS`/`assertAnnoBatch`/`ANNO_MAX_BATCH_DEPTH` code itself is untouched (see §8)** |

`vice_disk_list` is independently confirmed dead on both manifests already (`.planning/notes/deny-list-is-a-fork-artifact.md`, not re-derived here per instructions).

### Criterion 5 — `capability-registry.ts` resolved deliberately

See §6 — this needs its own decision write-up; consumers are wider than the ROADMAP Notes disclose (5 files: `vice-proxy.ts`, `stock-dispatch.ts`, `text-capability-probe.ts`, plus **4 `scripts/*.mjs` CI-gate consumers not named in the Notes**: `scripts/generate-tool-support-table.mjs`, `scripts/check-skill-fork-honesty.mjs`, `scripts/check-skill-tool-coverage.mjs`, `scripts/lib/skill-corpus.mjs` `[VERIFIED: grep -rln 'capability-registry' --include='*.ts' --include='*.mts' --include='*.mjs' src/ scripts/ | grep -v '\.test\.']`).

### Criterion 6 — `tools-manifest.stock.json` the only manifest

| File | Size | Disposition |
|---|---|---|
| `tools-manifest.json` (fork manifest) | 1223 lines, 36KB `[VERIFIED: wc -l/ls -la]` | Deleted |
| `refresh-manifest.ts` | 124 lines | Deleted whole — its only reason to exist is regenerating the fork manifest from a live fork host (`serverInfo()`, `activeInstance()` imports, `vice-proxy.ts:11`) |
| `tools-manifest.stock.json` | 138KB | Survives unchanged, becomes *the* manifest |
| `package.json`'s `files[]` | lines 13-14, 29, 32-33, 100-101 | `vice-sync.ts`, `vice-probe.ts`, `refresh-manifest.ts`, `backend-detect.mts`, `capability-registry.ts`, `tools-manifest.json` all listed — each deleted/repurposed file needs its `files[]` entry removed too, or `check-npm-packages.mjs` (which asserts `vice.files.includes("tools-manifest.json")` at line 165, and ties `capability-registry.ts` to requirement id `BACK-05` at line 205) goes red |

`vice-probe.ts` (278 lines): its only non-test consumer is `vice-proxy.ts:101` (`import { probeInstance, ... } from "./vice-probe.ts"`), called inside `forwardToVice()` (`:3062`) — i.e. **fork-only**, dies with `forwardToVice()`. No stock consumer exists `[VERIFIED: grep -rn 'from "\./vice-probe\.ts"' --include='*.ts' --include='*.mts' .]`.

### Criterion 7 — test floor green, fork-conditional branches removed not skipped

See §4.

---

## 2. The `vice.ts` split — the hardest single item, and a correction to the ROADMAP Notes

**The ROADMAP Notes undercount this.** They say "ten non-test modules import from it" and name 8: `stock-symbols.ts`, `stock-petscii.ts`, `stock-paths.ts`, `anno-types.ts`, `stock-reproducible-run.ts`, `stock-handler.ts`, `stock-recycle.ts`, `vice-sync.ts`. A fresh grep this session (`grep -rn 'from "\./vice\.ts"' --include='*.ts' --include='*.mts' . | grep -v '\.test\.ts'`) finds **23** non-test importers:

```
stock-derived.ts    vice-sync.ts        stock-address.ts      stock-paths.ts
stock-symbols.ts    stock-petscii.ts    anno-store.ts          refresh-manifest.ts
stock-timing.ts     stock-recycle.ts    stock-reproducible-run.ts  text-protocol.ts
anno-types.ts       stock-handler.ts    vice-broker-client.ts  vice-proxy.ts
stock-protocol.ts   stock-connect.ts    stock-condition.ts     evid-ingest.ts
stock-diagnose.ts   text-connect.ts     stock-dispatch.ts
```

Grouped by what they actually import `[VERIFIED: individual grep -n "from \"\./vice\.ts\"" per file, this session]`:

| Group | Symbols imported | Files | Fate |
|---|---|---|---|
| Error hierarchy only | `ViceError`, `ViceErrorOptions` | `stock-derived.ts`, `stock-address.ts`, `stock-paths.ts`, `stock-symbols.ts`, `stock-petscii.ts`, `anno-store.ts`, `text-protocol.ts`, `anno-types.ts`, `stock-protocol.ts`, `stock-condition.ts`, `evid-ingest.ts`, `text-connect.ts` (12 files) | **Survives** — must move to the new shared module |
| Error hierarchy + epoch | `MachineRestartedError`, plus `readEpoch`/`EpochResult` on some | `stock-timing.ts` (Error only), `stock-reproducible-run.ts` (Error only), `stock-handler.ts` (Error only), `stock-connect.ts` (Error+readEpoch+EpochResult), `stock-diagnose.ts` (Error+readEpoch+EpochResult) (5 files) | **Survives** |
| Epoch only | `readEpoch` | `stock-recycle.ts` | **Survives** |
| `mcpHost` + Error | `mcpHost`, `ViceError` | `vice-broker-client.ts` | **Survives** — `mcpHost()` resolves the broker's own dial address regardless of backend, used by both the (dying) fork transport and the (surviving) broker-control client |
| Fork transport function | `call` | `vice-sync.ts` | **Dead file, see below — delete, do not split** |
| Fork transport (whole seam) | `serverInfo`, `activeInstance` | `refresh-manifest.ts` | **Dies with the file (criterion 6)** |
| Type only | `ToolInfo` | `stock-dispatch.ts` | Type moves to shared module (or its own types file) |
| Everything, including lease state | `call`, `activeInstance`, `useInstance`, `DENY_LIST`, `denyListRefusalMessage`, `readEpoch`, `beginSession`, `MachineRestartedError`, `mcpHost`, + 4 types | `vice-proxy.ts:82-96` | **Needs the full split** — this file alone uses both halves and is the entry point that currently glues them together |

**The corrected shared/dead split, by symbol** (not by file — this is the actual granularity the planner needs):

- **Shared — moves to a new module** (suggested name: `vice-errors.ts`, or fold into `repo-root.ts`'s sibling tier; `[ASSUMED]` — naming is the planner's call): `ViceError`, `ViceErrorOptions`, `MachineRestartedError`, `MachineRestartedErrorOptions`, `readEpoch`, `EpochResult`, `EPOCH_FILE`, `mcpHost`, `activeInstance`, `useInstance`, `ActiveInstance`, `UseInstanceOptions`, `DEFAULT_ENDPOINT`'s *mechanism* is not needed but its role (resolving the human-launched-instance default port 6510) may still be — check whether `activeInstance()`'s current default value (derived from `DEFAULT_ENDPOINT`) is still meaningful with no fork to default to; if the stock lease path always calls `useInstance()` before reading `activeInstance()`, the fallback becomes dead too and can be simplified.
  - **Why `activeInstance`/`useInstance` are shared, not fork-only** (this is the one correction that most changes the plan): `vice-proxy.ts`'s `buildHeldLease()` (`:2337-2367`) — used by `ensureBrokerLease()`, which **every** tool call goes through on **both** backends — reads `activeInstance()` for `{url, port, epochFile}` to build the `HeldLease` a stock handler needs, and `useInstance()` (`:2552`) is what a granted broker lease writes those fields with. Deleting `vice.ts` wholesale would break stock lease acquisition, not just fork transport.
- **Dead — deletes with the fork transport**: `DEFAULT_TIMEOUT_MS`, `rpc()`, `ensureInitialized()`, `withReconnect()`, `call()`/`callTool`, `serverInfo()`, `DENY_LIST`, `denyListRefusalMessage()`, `SessionInfo`, `beginSession()`, `sessionReconnects()`, `lastToolCall()`, `assertSameMachine()`, `CallFn` — this whole "session identity" apparatus exists specifically to detect the fork's HTTP server silently restarting mid-reconnect (`withReconnect()`'s own doc comment); the stock backend has its own, separate reconnect/identity mechanism (`stock-connect.ts` imports `readEpoch` directly and does its own thing per its header comment — confirm during implementation that none of `beginSession`/`assertSameMachine` is secretly called from a stock path; grep found zero non-test importers of `beginSession`/`assertSameMachine` outside `vice.ts` itself, so this looks safe to delete `[VERIFIED: no hits for 'beginSession\(' or 'assertSameMachine\(' outside vice.ts and vice.test.ts]`).

**`vice-sync.ts` is not a "split candidate" — it is dead code today and should simply be deleted.** Its only import is `call` from `vice.ts` (the fork transport), and a repo-wide grep for `from "./vice-sync` finds **zero** non-test consumers `[VERIFIED: grep -rn 'from "\./vice-sync' --include='*.ts' --include='*.mts' .` → only `vice-sync.test.ts` itself]`. It is nonetheless listed in `package.json`'s `files[]` (line 13) and therefore **shipped in the published npm tarball today with no production caller**. CLAUDE.md and `.planning/codebase/ARCHITECTURE.md` still describe it as a live "checkpoint sync helpers" module — that description is stale independent of this phase; Phase 52 is a natural, cheap place to also delete this orphan and its `files[]` entry, since its only import dies here anyway. Flag this finding to the planner explicitly — it's a pre-existing defect this phase surfaces, not something the ROADMAP asked for, so it should be called out as a decision (delete vs. keep-and-document) rather than silently swept in.

---

## 3. Ordering and the green baseline

**`docs-fork-decision.test.ts` (181 lines) — read directly this session, all six assertions confirmed:**

1. `test 1`: `## Key Decisions` heading locatable, ≥20 data rows (non-vacuity)
2. `test 2`: **exactly one** row contains `FORK-01`
3. `test 3`: that row matches `/\d{4}-\d{2}-\d{2}/` (an ISO date)
4. `test 4`: that row contains the literal, **case-sensitive** substring `KEYBOARD_MATRIX_SET`
5. `test 5`: that row contains at least one of `["reverses if", "would reverse", "reversal criteria"]`
6. `test 6`: the `### Out of Scope` fork-backend bullet (matched by `/^-\s+\*\*[^*]*fork backend[^*]*\*\*/`) contains `FORK-01`

**This test reds the instant the `FORK-01` row's text changes at all** (even a same-day amendment), because tests 3-5 re-match the *current* row text every run — there is no way to "pass through" an edit. The ROADMAP Notes' prescribed order is correct and confirmed by reading the test: **amend `PROJECT.md`'s `FORK-01` row and this test file together, in one commit/step, before touching any source file** — the new row still needs an ISO date (the reversal date), still needs to name `KEYBOARD_MATRIX_SET` (the reversal-trigger opcode is now moot but the guard's regex requires the literal string to appear somewhere in the row — the amended row can state "the `KEYBOARD_MATRIX_SET` reversal trigger is now moot; the fork is removed outright" and still satisfy test 4), and still needs one of the three reversal phrases (a reversal row narrating its own reversal naturally uses this vocabulary) so the guard need not be gutted — it can be **repointed** to assert the new row's *own* new invariants, per criterion 2's instruction not to delete it.

**Proposed wave-ordered work sequence** (dependency-derived from the above, not a plan — the planner turns this into actual PLAN.md waves):

1. **Wave 0 — decision record + its guard, together.** Amend `PROJECT.md`'s `FORK-01` Key Decisions row (state REVERSAL, date, basis — cite `.planning/notes/fork-removal-reversal-basis.md`'s two grounds without using that path *inside* PROJECT.md's own prose per the planning-vocabulary rule — PROJECT.md is itself a planning doc so this specific rule is about `src/` and `src/skills/`, not PROJECT.md; confirm scope before assuming). Amend the `### Out of Scope` fork bullet (`:438`). Rewrite `docs-fork-decision.test.ts` to assert the new row's properties. Run `npm run test:automated` — must be green (at the floor, §4) before Wave 1. **Also in this wave**: write wherever criterion 3's permanent-acceptance record for the three hard losses lives (new section in PROJECT.md, or a new `docs/` file — planner's call, material is in §6) — doing this alongside the FORK-01 row edit means both narrative changes land in the tree together, before code deletion starts, so a reader mid-phase never sees "fork reversed" without also seeing "here's what that costs."
2. **Wave 1 — the `vice.ts` split.** Create the shared module, move the 12 shared symbols into it, repoint all ~17 surviving importers' import paths, delete `vice.ts`'s fork half, delete `vice-sync.ts` outright (dead code, §2), delete `vice-probe.ts` (fork-only, §1 criterion 6). Typecheck (`npm run typecheck`) must pass — this is a pure mechanical repoint plus deletion, should not touch runtime behavior for stock.
3. **Wave 2 — `vice-proxy.ts`'s fork-only region.** Delete `forwardToVice()`, `gatherWedgeEvidence()`/`gatherCheckpointTrapEvidence()`/`gatherBracketEvidence()`, `handleRecycle()`/`handleDiagnose()`'s fork arms (confirm nothing else calls them first — grep shows their only registration is via `buildBackendAwareTool()`'s fork arm), `rewriteArguments()` and its helpers (`pathArgsFor`, `rewritePathsIn`, `PathResolution`, `PathOutOfWorkspaceError`, `PathTranslationError` — confirm no other call site before deleting each), `buildBackendAwareTool()` itself (collapse into direct `stockDispatch.dispatchStock` calls), `probeInstance` usage. Delete `refresh-manifest.ts`, `tools-manifest.json`. Amend `package.json`'s `files[]`. Delete/rewrite the 12 test files' fork branches.
4. **Wave 3 — `backend-detect.mts`/broker collapse.** Delete `probeBackend()`, collapse `resolvedBackend()`, remove `VICE_BACKEND` handling, remove the broker/proxy cross-check (`vice-proxy.ts:2440-2486`) — or keep a trivial always-agrees version if removing it outright is riskier than leaving a vestigial no-op; planner's call. Edit `vice-broker.mts`/`broker-launch.mts`/`broker-control.mts` (host-bound `.mts`), then **run `node build.ts`** to resync `resources/*.mjs` before `resources-sync.test.ts` is expected to pass.
5. **Wave 4 — `capability-registry.ts` decision + skill/doc rewrite.** Execute whichever disposition Wave 0's record settled on (§6). Rewrite the 9 skill sites (§5). Rewrite/retire `scripts/check-skill-fork-honesty.mjs`, `scripts/generate-tool-support-table.mjs`, README.md, `docs/stock-vice-parity.md`, `docs/tool-support.md`, CLAUDE.md's Compatibility/Architecture bullets, `docs-linerefs.test.ts` (§7).
6. **Wave 5 — full-suite green at the floor.** Confirm `npm run test:automated` matches the pre-phase floor (§4), with the actual failing-test-id set compared, not just the count.

Each wave boundary above is a point where `npm run test:automated` should be re-run and its failure **set** compared against the pre-phase floor before proceeding — this is the "green between steps, not only at the end" property the research focus asked for.

---

## 4. The test floor and how to measure it

**Do not run `npm test`** (`node --test '*.test.*'`) — it hangs (project's own recorded finding, not re-derived here). The gate is:

```bash
cd src/mcp/vice && npm run test:automated > /tmp/floor.log 2>&1; echo "EXIT=$?"; tail -40 /tmp/floor.log
```

Note the `echo "EXIT=$?"` on the **same line** as the test command (via `;`, not a pipe) — piping through `| tail` reports `tail`'s exit code (always 0), silently hiding a real failure. This is a previously-documented project pitfall, restated here because the phase's own verify commands must not repeat it.

`npm run test:automated` runs `node test-gate.mjs`, which excludes 13 `MANUAL_ONLY_TESTS` entries (confirmed by reading `test-gate.mjs:129-142` this session) — including **`fork-live.test.ts`**, a live-fork-binary test not previously flagged in the project's own memory note about this list. `fork-live.test.ts` is manual-only and therefore does not affect the automated floor, but it is squarely in scope for deletion under criterion 1 ("every `backend === 'fork'` test are gone") and its `MANUAL_ONLY_TESTS` entry in `test-gate.mjs` needs removing alongside it.

**Documented stable floor (project's own record, re-cited not re-derived): 3 failures, all in two files** — `anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479` (stale requirement-id citations, unrelated to this phase). **Two known flakes ride above the floor and are NOT regressions if seen**: `audit-root-args.test.ts:982` (a `zz-scratch-*` ENOENT scan race) and `text-protocol.test.ts:516` (a 0ms timing control). **Compare the failure-id set, not the count**, at every wave boundary in §3.

**Live broker check, performed this session (2026-09-11):** no `x64sc` or `vice-broker` process is running (`ps aux` clean). `.c64-re-tools/supervisor/broker.json` is absent/empty. A **stale** `.vice-supervisor/broker.json` exists (the pre-D-33 legacy location, left on disk per the project's documented "clean break, no migration" policy) recording `pid: 25165`, last heartbeat `2026-08-26T15:34:53Z` — confirmed **not running** (`ps -p 25165` → no such process). **So right now there is no live broker to redden `BACK-05`'s test** — but this is a point-in-time observation, not a standing fact; the planner/executor must re-check (`ps aux | grep -iE 'vice-broker|x64sc'`) immediately before trusting any test run during actual execution, since a broker started in a different session would silently change the floor.

---

## 5. The skills rewrite — complete site list

The `questions.md` hand-off names **8** sites. A broader grep this session (`grep -rniE 'requires the fork|fork-only|fork backend' src/skills/ --include='*.md'`) finds a **9th**, not in the hand-off list:

| # | File:Line | Current text (paraphrase) | Stock route exists? | Rewrite type |
|---|---|---|---|---|
| 1 | `c64-program-recon/references/tool-selection.md:17` | `vice_sid_get_state` "(requires the fork — SID …)" | No | State permanent limitation |
| 2 | `c64-program-recon/references/control-flow.md:89` | `vice_keyboard_restore` "requires the fork backend" | No | State permanent limitation |
| 3 | `vice-wedge-triage/SKILL.md:225` | `vice_ping` ×3 poll "is fork-only" (stock equivalent already stated in the same section) | Yes, already named | Drop the fork clause, keep the stock instruction — smallest edit on the list |
| 4 | `c64-program-recon/SKILL.md:698` | `vice_keyboard_matrix` "(requires the fork backend — see references/observation-hazards.md § 4 for the stock route)" | Partial (KERNAL-buffer/joystick alternative) | State permanent limitation, keep the "see § 4" pointer |
| 5 | `c64-program-recon/references/sound-and-input.md:64` | `vice_keyboard_matrix` "requires the fork backend" | Partial (same alternative as #4) | State permanent limitation |
| 6 | `c64-program-recon/references/observation-hazards.md:88` | `vice_sid_get_state` is "**fork-only**" | No | State permanent limitation |
| 7 | `c64-program-recon/references/observation-hazards.md:106` | `vice_keyboard_matrix` "requires the fork backend" | Partial | State permanent limitation |
| 8 | `c64-ram-capture/SKILL.md:163` | fork-only keyboard-matrix capture call | No | State permanent limitation, may need an alternate capture strategy documented if the fork route was the *only* documented path here — check surrounding §2 for a fallback before rewriting |
| **9 (not in hand-off list)** | `vice-wedge-triage/SKILL.md:132` | `liveness_unmeasurable` row: "Judge liveness from outside the monitor (screenshot, process state), **or use the fork backend**." | No (the non-fork half of the sentence already names the real remedy) | Simplest rewrite on the list — delete the trailing "or use the fork backend" clause only |

**Lower-priority wording to review, found in the same grep pass but not "routing" language** — `observation-hazards.md:95`: "An answer with **no** bank field — an older transcript, or **the fork backend** — is suspect…" This describes a *symptom of old data*, not a route recommendation; it likely still needs a wording pass (there is no more "the fork backend" category of answer to be suspicious of, project-wide) but is not a rewrite-as-permanent-limitation case like the other 9.

**Two ride-along skill defects** (per ROADMAP Notes — not this phase's success criteria, but land in the same pass since both sit in `c64-program-recon`/`routine-queue-walker`, the same neighborhood as sites 1-9 above): `routine-queue-walker` §2.2/§3.2's undelegated paraphrase (missing the 4096-byte `anno_read_region` cap and tail-call/fall-through bounds rules), and `c64-memory-mapping`'s 623-line three-jobs-in-one-file scope mismatch. Full detail already in `.planning/notes/skill-redundancy-audit.md`, not re-derived here. **Neither may be scored as a Phase 52 success criterion** per the ROADMAP's own text.

**A CI gate is coupled to this rewrite and was not named in the ROADMAP Notes or the questions.md hand-off**: `scripts/check-skill-fork-honesty.mjs` derives its policed `FORK_ONLY_NAMES` set from `capability-registry.ts`'s `CAPABILITY_REGISTRY` (`providedBy === "fork"` entries), asserts README.md contains the literal strings `VICE_BACKEND`, `vice_sid_get_state`, `vice_keyboard_matrix`, and requires ≥20 fork-only names and ≥8 fork mentions across skills as non-vacuity floors (`[VERIFIED: scripts/check-skill-fork-honesty.mjs:290-292, 484-506, 730-749]`, read in full this session). **Every one of these assertions is falsified by this phase's own success criteria** (no `VICE_BACKEND` to name, no fork-only tool to warn about, no capability registry to derive names from). This script needs a full rewrite or retirement, not a tweak — flag prominently to the planner; it is a whole additional file of work not mentioned anywhere in the provided ROADMAP/notes/questions material.

---

## 6. `capability-registry.ts` — the open decision, with material

**456 lines.** `[VERIFIED: wc -l capability-registry.ts]` Its `CAPABILITY_REGISTRY` array holds 31 entries in three categories (read in full this session, `capability-registry.ts:102-336`):

- **6 `"hardware"` entries, `providedBy: "fork"`**: `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`, `vice_keyboard_chord`, `vice_keyboard_key_press`, `vice_keyboard_key_release`. **These 6 entries' `reason` fields already contain, verbatim, the technical evidence criterion 3 asks for** (e.g. `vice_sid_get_state`'s reason: `"SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes no SID read command."`). This is the closest thing in the tree to a ready-made acceptance record for the three hard losses (SID read-back = 1 entry, matrix keyboard = 4 entries covering the matrix/chord/press/release sub-capabilities, RESTORE/NMI = 1 entry).
- **17 `"descoped"` entries, `providedBy: "fork"`**: fork tools stock never implemented because no shipped skill calls them (e.g. `vice_disk_detach`, `vice_display_screenshot`, the four `vice_checkpoint_group_*` tools, `vice_memory_fill`, …). With the fork gone these tools simply cease to exist project-wide — there is no "gap" to explain any more, just an absent tool.
- **8 `"stock-only-gain"` entries, `providedBy: "stock"`**: native stock features the fork's HTTP API never had (`vice_execution_until_return`, `vice_registers_available`, `vice_device_console`, `vice_warp_set`, `vice_memmap_show`, `vice_memmap_zap`, `vice_cpu_history`, `vice_profile_flat`, `vice_io_registers`). With one backend, "gain over the other backend" is a vacuous concept — these tools just exist, full stop.

**`capabilityRefusalMessage(name, activeBackend)`** (the runtime BACK-05 refusal, `capability-registry.ts:389-456`) renders, for every category, some variant of *"Use the `<otherBackend>` backend instead (Set `VICE_BACKEND=<otherBackend>`)"*. **This sentence becomes actively false once there is only one backend** — there is no other backend to switch to. This is the strongest argument for removing the *runtime refusal mechanism* entirely rather than merely updating its wording: a tool name absent from `tools-manifest.stock.json` should fall through to the plain "Unknown tool" message, which is now the *true* answer (the tool does not exist anywhere), not a special "capability gap" answer pointing at a place that no longer exists.

**Recommendation, with basis:** (1) **Delete** `capabilityRefusalMessage()`, the `"descoped"`/`"stock-only-gain"` categories, and their call sites in `vice-proxy.ts:3503` and `stock-dispatch.ts:874` — the generic unknown-tool fallback is correct and honest for all 25 of those entries once there's one backend. (2) **Extract** the 6 `"hardware"` entries' `reason` (and `alternative`, where present — `KEYBOARD_ALTERNATIVE`, `capability-registry.ts:91-94`) text into whatever document Wave 0 (§3) creates for the criterion-3 permanent-acceptance record — this is reuse, not re-derivation, and keeps the technical wording (write-only hardware, CIA recompute-on-read, no NMI wire command) that a hand-rewrite risks garbling. (3) Delete `capability-registry.ts` itself once its content has migrated, along with its 5 code consumers and 4 script consumers (§1 criterion 5 table). This is a "goes" disposition, not "repurposed-in-place" — the file's whole premise (a per-backend delta) is gone; only its *data* survives, relocated.

`[ASSUMED — this is a recommendation for the planner to record as a decision, not a measured fact; the alternative (repurpose the file in place as a static "accepted limitations" registry with no `activeBackend` parameter) is viable too and should be presented to the owner/planner as the considered alternative]`.

---

## 7. Guards that will fire — full inventory

| Guard | What it currently asserts | What this phase does to it | Action needed |
|---|---|---|---|
| `docs-fork-decision.test.ts` (181 lines) | 6 properties of `PROJECT.md`'s `FORK-01` row (§3) | Reds the instant the row is edited | **Rewrite in Wave 0**, together with the row edit — not deleted (criterion 2 says so explicitly) |
| `docs-linerefs.test.ts` | Two `vice-proxy.ts:<N>` citations in CLAUDE.md's + PROJECT.md's `rewriteArguments()` Architecture bullet, cross-checked against real source | `rewriteArguments()` and both its call sites (`forwardToVice()`, `gatherWedgeEvidence()`) are deleted in Wave 2 — the citations it checks would point at **deleted code**, and the underlying hazard the bullet describes ("derived tool sitting behind `call()` receives host-translated paths") cannot occur once `call()` and `forwardToVice()` are both gone | The CLAUDE.md/PROJECT.md Architecture bullet must be **removed or substantially rewritten**, and this guard's `SCANNED_DOCS` / assertions rewritten or the whole file deleted alongside it — this is a bigger casualty than a line-number drift; the *invariant itself* stops applying |
| `manifest-arg-compat.test.ts` | Backward-compatibility (no removed/retyped/newly-required property) between `tools-manifest.json` (fork) and `tools-manifest.stock.json` (stock) for all shared tools | `tools-manifest.json` is deleted (criterion 6) — there is no second manifest to compare against | **Whole-file deletion**, not a rewrite — its entire premise (two manifests) is gone `[VERIFIED: read manifest-arg-compat.test.ts:1-60, 194-195 this session]` |
| `check-npm-packages.mjs` | `vice.files.includes("tools-manifest.json")` (line 165); ties `capability-registry.ts` to requirement id `BACK-05` (line 205); references `backend-detect.mjs` compiled-resource paths (line 278) | All three assertions describe files/ids this phase removes | Edit all three call sites; likely becomes `!vice.files.includes(...)` or the check is dropped entirely |
| `scripts/check-skill-fork-honesty.mjs` | Derives fork-only names from `CAPABILITY_REGISTRY`; requires README.md/docs/skill text to carry fork-routing language; non-vacuity floors of ≥20 names / ≥8 mentions | Every assertion is falsified by this phase's own goal | **Full rewrite or retirement** — see §5, this is the single biggest undisclosed guard casualty found this session |
| `scripts/generate-tool-support-table.mjs` → `docs/tool-support.md` | Generates a per-tool two-backend support table from both manifests + `CAPABILITY_REGISTRY` | No second manifest, no registry (if §6's recommendation is taken) | Retire the generator and the generated doc, or repoint README/docs away from it |
| `resources-sync.test.ts` | Committed `resources/*.mjs` byte-match the `.mts` sources run through `build.ts` | Wave 3 edits `vice-broker.mts`/`broker-launch.mts`/`broker-control.mts` | Passes again once `node build.ts` is re-run post-edit — not a guard casualty, just a required build step |
| `spawn-seam.test.ts` | Frozen shipped-module spawn set, derived from `package.json`'s `files[]` via `shipped-modules.ts` | This phase does not add/remove a spawn site (only `backend-detect.mts`'s `probeBackend()` `--help` probe spawns today, and it's deleted whole) | Should stay green automatically once `probeBackend()` and its spawn call are gone — the frozen *set* shrinks by exactly the entries removed from `files[]`, no new member appears |
| `skills-planning-vocabulary.test.ts` | No `.planning/*` path / phase id / bare `D-NN` in `src/skills/**` | This phase rewrites 9 skill sites with new prose | Just write clean prose — no structural change to the guard needed, but worth double-checking new skill wording doesn't accidentally cite `.planning/notes/fork-removal-reversal-basis.md` by path |
| `docs-uat-abstention.test.ts`, `audit-integrity.test.ts`, `docs-review-disposition.test.ts` | Unrelated subject matter (UAT abstention laundering, review-finding census) | No fork-specific content found in these; not expected to fire from this phase's changes | No action anticipated — flagged only because the research brief asked for the full census; **not independently verified beyond a targeted grep for "fork"/"backend" turning up nothing** `[ASSUMED — absence of a grep hit, not a full read of each file]` |

**CLAUDE.md itself needs amending, not just its guarded citations**: the "Compatibility" constraint bullet quoted in the project's own CLAUDE.md ("the stdio MCP surface is trimmed per backend — stock advertises only the tools it implements... the fork's list is unchanged from v0.1.x...") describes a two-backend world in the present tense and will be false the moment this phase lands. Same for the "Architecture" bullet about `rewriteArguments()`/`forwardToVice()` (above). Both need rewriting as part of this phase, not left stale.

---

## 8. What must NOT change

- **`anno-tools.ts`'s inverted allowlist** — `CURATED_ANNO_TOOLS`, `assertAnnoBatch()`, `ANNO_MAX_BATCH_DEPTH` — is explicitly protected by criterion 4. Its only relationship to `DENY_LIST` is two **comment citations** (`anno-tools.ts:81`, `:2010`) naming `DENY_LIST` as the precedent it inverted; these citations should be **rewritten to describe the pattern in the abstract** ("this project's earlier fork-era `DENY_LIST` established the precedent...") rather than deleted outright, since they explain *why* this guard is shaped the way it is (per `.planning/notes/deny-list-is-a-fork-artifact.md`'s own explicit instruction). No code in this file changes.
- **`STOCK_EMULATOR_SIDE_PATH_TOOLS`, `withEmulatorSidePath()` (`stock-paths.ts`)** — stock's own, independent path-translation mechanism. Explicitly documented (in its own header) as never touching `rewriteArguments()`/`forwardToVice()`; nothing about this phase should cause anyone to "helpfully" merge it with the dying fork-side translator.
- **`hostpath.ts`/`containerpath.ts`** — the general host/container path-translation seam both `stock-paths.ts` and (formerly) `rewriteArguments()` build on. Only the fork-side *caller* dies; the seam itself is load-bearing for stock and untouched.
- **`stock-dispatch.ts`'s `STOCK_DISPATCH_TABLE`** and the entire `stock-*.ts` family (~40 files) — none of this is fork-related; it is the surviving dispatch mechanism. The only edits inside this family are the `capabilityRefusalMessage()` call site in `stock-dispatch.ts:874` (§6) and the `ViceBackend`/error-hierarchy import repoints (§2).
- **`vice-broker-client.ts`'s control-plane protocol** (acquire/release/recycle/monitor_claim/monitor_release) — backend-agnostic already; only its `backend === "fork"` conditionals (2 hits) and its `mcpHost`/`ViceError` imports (repoint targets, not behavioral changes) are in scope.
- **The `anno_*` family's `buildViceTool()` proxy-local registration** — explicitly backend-independent by construction (never reaches `forwardToVice()`/`call()`); nothing here changes.
- **Test floor's 3 known-stale-requirement-id failures and 2 named flakes** (§4) — pre-existing, unrelated to this phase; do not "fix" them as a side effect and do not let them block the phase's own green-baseline checks (compare failure-id sets, not counts).

## Common Pitfalls

### Pitfall 1: Deleting `vice.ts` wholesale before checking `buildHeldLease()`
**What goes wrong:** A contributor reads "the fork transport dies" and deletes the whole file, breaking stock's own lease-acquisition path (`ensureBrokerLease()`/`buildHeldLease()` read `activeInstance()`).
**Why it happens:** The ROADMAP Notes' own phrasing ("most for the shared error hierarchy... and readEpoch, not the HTTP transport") undersells how deep the sharing goes — it reads as "a few stray imports," not "the stock lease path's own state."
**How to avoid:** Do the split (§2) before any deletion; typecheck after each symbol move.
**Warning signs:** `npm run typecheck` failing with "cannot find name 'activeInstance'" in `vice-proxy.ts` or a stock handler.

### Pitfall 2: Treating `rewriteArguments()`'s two call sites as "just drift the line numbers"
**What goes wrong:** `docs-linerefs.test.ts` exists specifically because these citations drifted twice before; a contributor familiar with that history may reflexively re-verify and re-cite new line numbers instead of noticing the whole bullet (and the hazard it names) no longer applies.
**Why it happens:** The guard's own header text ("treat a mismatch as drift to re-verify, never as evidence the constraint itself changed") is quoted verbatim in CLAUDE.md and primes exactly this reflex.
**How to avoid:** Confirm (as this research did) that both call sites die with `forwardToVice()`/`gatherWedgeEvidence()` before touching the citation — if both call sites are gone, this is not drift, it's obsolescence.
**Warning signs:** `docs-linerefs.test.ts` failing with "no rewriteArguments() call found at cited line" after the deletion — that failure is a signal to remove the bullet/guard, not to hunt for a new line number.

### Pitfall 3: Skipping fork-conditional test branches instead of deleting them
**What goes wrong:** Criterion 7 explicitly requires removal, not skip — a `test.skip()` or an early `return` for `backend === "fork"` leaves 69 hits of dead conditional logic across 12 files that reads as "still supported, just not tested right now."
**Why it happens:** Skipping is mechanically the smallest diff.
**How to avoid:** Grep each of the 12 files (`grep -n '"fork"' <file>`) and remove the branch structurally, not just its execution.
**Warning signs:** `grep -c '"fork"' *.test.ts` still returning non-zero after the phase claims completion.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact new-module name for the `vice.ts` shared-infrastructure split (`vice-errors.ts` suggested) | §2 | Low — cosmetic, easily renamed; no behavioral risk |
| A2 | Exact requirement-id spelling/count to mint (`FORKRM-01..07` suggested) | Requirement ID Guidance | Low — id namespace is arbitrary as long as it's fresh and 1:1 with success criteria |
| A3 | `capability-registry.ts` should be deleted-with-data-migrated rather than repurposed-in-place | §6 | Medium — this is presented as a recommendation with an explicit named alternative; if the owner prefers repurposing, the Wave 4 task list changes shape but not its size |
| A4 | `docs-uat-abstention.test.ts`, `audit-integrity.test.ts`, `docs-review-disposition.test.ts` are unaffected by this phase | §7 | Low-Medium — based on a targeted grep finding no "fork"/"backend" hits, not a full read of each file; if wrong, an extra guard-repair task appears mid-phase |
| A5 | No production code secretly calls `beginSession()`/`assertSameMachine()` from a stock path | §2 | Medium — if wrong, deleting the "session identity" apparatus would remove a real reconnect-safety check from a live stock path, not just dead fork-era code; verified only by grep, not by tracing every call graph |

**All other claims in this research are `[VERIFIED: <path>]`** — obtained by reading the cited source file or running the cited grep command in this session (2026-09-11).

## Open Questions

1. **Does `activeInstance()`'s `DEFAULT_ENDPOINT`-derived fallback (port 6510, the "human-launched instance" band) still matter once the fork is gone?**
   - What we know: `DEFAULT_ENDPOINT` builds an HTTP URL (`http://<host>:6510/mcp`) that only ever made sense for the fork's HTTP transport; `activePort`'s fallback-to-6510 logic exists "for the same human-launched instance" reasoning.
   - What's unclear: whether any stock code path ever calls `activeInstance()` *before* a broker lease has called `useInstance()` (i.e., whether the fallback default is ever actually read in the stock world, or whether it's already dead weight there too).
   - Recommendation: trace `activeInstance()`'s call sites during Wave 1 implementation; if every stock caller runs after a `useInstance()` write, simplify the fallback rather than preserving an HTTP-URL-shaped default for a protocol nothing speaks anymore.

2. **Should `capability-registry.ts`'s six `"hardware"` entries' text move into `PROJECT.md`, a new standalone `docs/` file, or both?**
   - What we know: the text itself (§6) is ready to reuse; criterion 3 wants it "somewhere a reader hits before asking why a capability is missing."
   - What's unclear: whether that's PROJECT.md (already the FORK-01 decision's home), README.md (what a first-time reader hits), or a new dedicated doc that both cross-reference.
   - Recommendation: planner/owner decision at Wave 0 — this research supplies the text and the consumers (§5's `check-skill-fork-honesty.mjs` also needs a canonical location to point at from its rewritten README assertions), but not the final placement.

3. **Does deleting the broker/proxy backend cross-check (`vice-proxy.ts:2440-2486`) need a replacement invariant, or is it simply gone?**
   - What we know: this check exists because the container-side proxy and the host-side broker each resolve `ViceBackend` independently and could, in the two-backend world, disagree.
   - What's unclear: with one backend, is there *any* remaining reason the two processes' resolutions could differ (e.g. one process finding no `x64sc` binary at all vs. finding one) that's worth a lighter-weight sanity check, or is the whole concept vacuous?
   - Recommendation: read `resolvedBackend()`'s "unknown" branch behavior during Wave 3 implementation before deciding whether to delete the cross-check outright or replace it with a simpler "binary found / not found" liveness signal.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — invocation is via `package.json` scripts (`test`, `test:automated`, `test:manual`) and `test-gate.mjs`'s own file-list logic |
| Quick run command | `cd src/mcp/vice && node --test docs-fork-decision.test.ts` (single-file, fastest signal on the Wave 0 edit) |
| Full suite command (project's gate, not the hanging full glob) | `cd src/mcp/vice && npm run test:automated > /tmp/floor.log 2>&1; echo "EXIT=$?"` |

### Phase Requirements → Test Map

Since requirement IDs are TBD (see Requirement ID Guidance), this maps to success **criteria** instead, 1:1, pending the planner minting ids:

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|--------------------|--------------|
| 1 | No backend-selection code/tests remain | structural (grep) | `grep -rc '"fork"' src/mcp/vice/*.ts src/mcp/vice/*.mts \| awk -F: '$2>0'` (expect empty) | ✅ (grep-based, no new file) |
| 2 | `FORK-01` row reversed, guard repointed | unit | `node --test docs-fork-decision.test.ts` | ✅ exists, needs rewrite |
| 3 | Three hard losses recorded as accepted | doc-presence (manual/grep) | `grep -c "SID read-back\|matrix keyboard\|RESTORE" <chosen doc>` | ❌ — new doc/section, Wave 0 gap |
| 4 | `DENY_LIST` gone, `anno-tools.ts` unchanged | unit + diff | `git diff --stat src/mcp/vice/anno-tools.ts` (expect empty) + existing anno-tools tests green | ✅ existing anno-tools.test.ts |
| 5 | `capability-registry.ts` resolved | structural | `test -f src/mcp/vice/capability-registry.ts` (expect absent, or repurposed content asserted) | ❌ — depends on Wave 4 decision |
| 6 | Single manifest | structural | `test -f src/mcp/vice/tools-manifest.json` (expect absent) | ✅ trivial |
| 7 | Test floor green | full automated run | `npm run test:automated` failure-set comparison | ✅ `test-gate.mjs` |

### Sampling Rate
- **Per task commit:** the single-file quick command for whatever file the task touched (e.g. `node --test vice-proxy.test.ts` after a `vice-proxy.ts` edit)
- **Per wave merge:** `npm run test:automated`, failure-set compared against the pre-phase floor (§4)
- **Phase gate:** full `test:automated` green-at-floor before `/gsd-verify-work`, plus `npm run typecheck` (the project's configured `build_command`)

### Wave 0 Gaps
- [ ] The criterion-3 permanent-acceptance record itself does not exist yet as a file/section — Wave 0 must create it (material is in §6).
- [ ] No automated test currently asserts "no fork-routing language remains in skill text" in the *rewritten* sense — `check-skill-fork-honesty.mjs` asserts the opposite today and needs inverting, not just relying on manual grep.
- [ ] Framework install: none — `node --test` is already in place, no new dependency needed.

## Security Domain

`security_enforcement` is `true` in `.planning/config.json` (ASVS level 1, block-on `high`) — section included per policy, though this phase's content is almost entirely deletion/documentation and touches no new input-handling surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface touched — the broker's existing CSPRNG control-plane token (unrelated to this phase) is untouched |
| V3 Session Management | No | The "session identity" apparatus being deleted (`beginSession`/`assertSameMachine`) is an emulator-restart detector, not an auth session |
| V4 Access Control | Marginal | `DENY_LIST`'s removal (criterion 4) is the one access-control-shaped change in this phase — but it is documented (`.planning/notes/deny-list-is-a-fork-artifact.md`) as guarding a surface (the fork's generic meta-tools) that ceases to exist, not as a control being weakened while its target surface remains. `anno-tools.ts`'s inverted allowlist (the one *live* access-control mechanism adjacent to this work) is explicitly unchanged (§8) |
| V5 Input Validation | No | No new input surface; existing manifest-schema validation (`manifest-arg-compat.test.ts`) is being *deleted* because its comparison target disappears, not because validation is being loosened for a surface that still exists |
| V6 Cryptography | No | Untouched — the broker's token comparison (`timingSafeEqual`) is unrelated to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A confused-deputy bypass via a generic meta-tool carrying a forbidden tool name as a nested argument (the reason `DENY_LIST` existed) | Elevation of Privilege | Not reintroduced: the fork's generic meta-tool surface (`tools_call`/`tools_list`/`initialize`/`notifications_initialized`) that made this possible ceases to exist project-wide once the fork's manifest and transport are gone — there is no new outer-name-only gate to build, because there is no new generic-dispatch surface to gate. Confirm during Wave 2/4 that no replacement single-entry-point dispatcher is accidentally introduced without the same inverted-allowlist discipline `anno-tools.ts` already uses for its own nested-argument case (`anno_batch_execute`) |
| Stale documentation asserting a security boundary that no longer exists (a README/skill claiming "requires the fork" when the fork doesn't exist) | Information Disclosure / Tampering (misleads an operator into believing a wrong mitigation is active) | `scripts/check-skill-fork-honesty.mjs`'s rewrite (§5/§7) is itself the mitigation — it is a documentation-honesty CI gate; leaving it un-rewritten (still asserting fork-era claims) is the actual risk this phase must avoid, not a new code vulnerability |

## Sources

### Primary (HIGH confidence — read/grepped directly this session, 2026-09-11)
- `src/mcp/vice/vice.ts` (full file, 772 lines) — export inventory, `DENY_LIST`, session-identity apparatus
- `src/mcp/vice/vice-proxy.ts` (targeted reads: imports `:80-102`, backend resolution `:315-340`, `forwardToVice()` `:3025-3139`, registration seam `:3240-3439`) — backend branching, `forwardToVice`/`gatherWedgeEvidence` fork-only region, `buildHeldLease`/`ensureBrokerLease`
- `src/mcp/vice/stock-paths.ts` (full header + table) — confirms stock's independent path-translation mechanism, proving `rewriteArguments()` is fork-only
- `src/mcp/vice/docs-fork-decision.test.ts` (full file, 181 lines) — the six pinned assertions
- `src/mcp/vice/docs-linerefs.test.ts` (header + scanned-docs declaration) — confirms scope (CLAUDE.md + PROJECT.md) and rationale
- `src/mcp/vice/capability-registry.ts` (full file, 456 lines) — 31-entry registry, `capabilityRefusalMessage()`
- `src/mcp/vice/manifest-arg-compat.test.ts` (header + top) — confirms two-manifest premise
- `scripts/check-skill-fork-honesty.mjs` (full file) — undisclosed CI-gate casualty
- `src/mcp/vice/test-gate.mjs` (`MANUAL_ONLY_TESTS` array, `:129-142`) — `fork-live.test.ts` finding
- `.planning/ROADMAP.md:1275-1374` (Phase 52 section in full)
- `.planning/notes/fork-removal-reversal-basis.md`, `.planning/notes/deny-list-is-a-fork-artifact.md`, `.planning/notes/skill-redundancy-audit.md` (full files, cited not re-derived)
- `.planning/research/questions.md:1-220` (both open-question sections)
- `.planning/PROJECT.md` (targeted: `:380-450`, `:690-720`, `:925-940`, `:1740-1800` — Key Decisions table, Out of Scope, standing items)
- `.planning/REQUIREMENTS.md` (full structural read) — confirms `FORK-*` absence from current milestone requirements
- Live shell measurements this session: `ps aux`, broker.json reads, all grep commands quoted inline above with their exact invocation

### Secondary (MEDIUM confidence)
- None — this phase required no external documentation lookup (no new library; `.planning/config.json`'s search providers are all `false`)

### Tertiary (LOW confidence)
- A4 in the Assumptions Log (unaffected-guards claim, grep-only, not full-file-read)

## Metadata

**Confidence breakdown:**
- Removal inventory (§1, §2): HIGH — every count reproduced by a live grep this session, with the exact command given for re-verification
- `vice.ts` split (§2): HIGH for the symbol-grouping and the `buildHeldLease()` dependency finding (both read directly); MEDIUM for the exact new-module boundary (a design choice, not a fact)
- Ordering/green-baseline (§3): HIGH — `docs-fork-decision.test.ts`'s six assertions read in full
- Test floor (§4): HIGH — floor and flakes are the project's own dated, re-measured record, cross-checked against a live `ps aux`/broker.json check this session
- Skills rewrite (§5): HIGH for the 9 sites found (grep + manual line reads); MEDIUM for the "lower-priority wording" item (observation-hazards.md:95), which needs a human read to confirm it needs changing at all
- `capability-registry.ts` (§6): HIGH for content/consumers; the disposition recommendation itself is explicitly flagged `[ASSUMED]` as a decision for the planner/owner
- Guards inventory (§7): HIGH for the guards read in full; LOW-MEDIUM for the three guards only grep-checked for absence of "fork" (A4)

**Research date:** 2026-09-11
**Valid until:** This is a deletion phase against a fast-moving repo (multiple commits/day per git log) — re-run the grep commands in §1 immediately before planning execution if more than a few days have elapsed, since every count here is a live-tree measurement, not a stable external fact.
