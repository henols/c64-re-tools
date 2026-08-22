# Phase 14: Backend Decision - Research

**Researched:** 2026-08-22
**Domain:** Backend-removal/retention decision for a dual-transport MCP server (custom `-mcpserver` HTTP fork vs. stock VICE binary monitor)
**Confidence:** HIGH for code-surface inventory (all file:line evidence read this session); MEDIUM for the upstream-coupling claim (one authoritative live check, not a full source audit); LOW/ASSUMED for anything about the fork maintainer's own roadmap (out of this project's control, not checked this session).

## Summary

This is a decision phase, not a build phase: no new stack, no new packages, no
required code change either way — the plan that follows has to work whichever
way `FORK-01` goes. The two success criteria that make the outcome checkable
are (2) a real user-facing route for each of the three hard losses, and (3) a
live-checked reflection of the decision in the code's actual state. Both are
checkable today with commands recorded below, and both currently pass on the
**retain** side (the routes exist and are annotated; the fork's own tool
surface and dispatch table are unchanged from v0.1.x). What is *not* yet
checkable is criterion (1) — no dated `FORK-01` entry with named reversal
criteria exists in PROJECT.md → Key Decisions today; that is pure writing
work with a fixed target shape (see Q7).

The fork-backend code surface is **large and deeply interleaved with the
stock path**, not a separable module: `vice.ts` (772 lines) is simultaneously
the fork's HTTP transport *and* the shared home of `ViceError`,
`MachineRestartedError`, `readEpoch()`, `mcpHost()`, and the `DENY_LIST`
guard — all imported by a dozen `stock-*.ts` files that have nothing to do
with the fork. `broker-launch.mts` (1467 lines) and `vice-broker.mts` (1217
lines) each carry the fork as the *default* branch (`backend ?? "fork"`)
threaded through nearly every function, not a single isolated code path.
`capability-registry.ts`'s 26-entry table and the honesty-check script that
polices it (`scripts/check-skill-fork-honesty.mjs`, 505 lines) are entirely
premised on the fork existing as the answer to "where do I go for this
capability" — removing the fork does not shrink that script, it requires
*rewriting its premise*. This is the single largest sizing fact for the
"remove" branch: it is not a `git rm` of a few files, it is a decision that
must be threaded through ~15 production modules, ~23 test files (varying
from 1 to 53 fork-string mentions each), 4 skill playbooks, README, and one
generated doc, verified afterward by the very same honesty-check script
whose assertions must change shape.

The three hard losses' *routes* already exist and are already live at the
point of use — both in skill prose (annotated per-section, policed by a
mechanical proximity guard) and in the runtime refusal message itself
(`capabilityRefusalMessage()`, which names `Set VICE_BACKEND=fork` plus a
partial in-game alternative for the keyboard cases). That satisfies FORK-02
today, on the **retain** branch, by construction — no new writing is
required there. **If the decision is "remove," FORK-02's route disappears
along with it** for SID read-back and matrix keyboard/RESTORE — both are
sourced-confirmed unrecoverable on stock VICE with no workaround (see Q4/Q6)
— and FORK-02 can then only be satisfied by rewording every one of those
sites from "switch to the fork" to an honest "there is no route; this is a
permanent capability loss," which is new writing work of a different kind
than the retain branch needs (correcting text, not preserving it).

**Primary recommendation:** This research does not make the call (per the
deliverable notes), but the evidence leans toward **retain, deprecate the
default** — not because removal is wrong, but because nothing in this
milestone's evidence base shows the standing "capability-loss decision taken
deliberately, per tool" (the todo's own words) has actually been taken yet;
the 24-tool disposition table in the pending todo is still `TBD` per tool.
Taking "remove" inside this phase would mean deciding 24 individual
capability dispositions with no requirement covering that work — Phase 14's
own requirements are FORK-01 (the decision) and FORK-02 (the routes), not
"reimplement or drop 24 tools." The strongest counter-argument: the fork is
explicitly named in ROADMAP.md as "the largest single simplification
available," and REQUIREMENTS.md's Out-of-Scope table already forbids
*silent* removal — a **recorded** decision to remove, deferring the 24-tool
disposition itself to a follow-on phase/milestone as a named, owned todo, is
not the same failure mode the requirement exists to stop, and would be a
legitimate way to satisfy FORK-01 without expanding this phase's scope into
Phase 15/17-sized work.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FORK-01 | The fork-backend question is answered by a dated decision in PROJECT.md → Key Decisions that names the criteria which would reverse it, including the upstream `KEYBOARD_MATRIX_SET` coupling — not retained by default for a third close | Q6 states the coupling precisely (VICE 3.10 manual confirmed live to have no such opcode); Q7 states the exact table shape PROJECT.md's Key Decisions already use, since no prior entry carries a "reversal criteria" sub-field the planner can copy verbatim |
| FORK-02 | Whichever way FORK-01 goes, a user hitting any of the three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) is given a route they can actually follow | Q4 quotes every current point-of-use route verbatim and judges each; Validation Architecture below gives the exact commands to check both branches |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Backend selection (`VICE_BACKEND`, `resolvedBackend()`) | Container-side MCP server (`backend-detect.mts`) | Host broker (`broker-launch.mts`, same env var, second reader) | Both processes must agree; the container side is where the tool-call dispatch decision lives, the host side is where the binary is actually launched with backend-specific argv |
| Fork HTTP transport (`call()`, `vice.ts`) | Container-side MCP server | Host (target: `-mcpserver` HTTP endpoint served by the emulator process) | The `call()` seam is the one place that speaks HTTP/MCP to the fork's endpoint — deliberately the single transport seam per CLAUDE.md's Architecture constraint |
| Capability refusal at point of use (`capabilityRefusalMessage()`) | Container-side MCP server (`capability-registry.ts`, `vice-proxy.ts`'s `tools/call` miss branch) | — | Runtime refusal must fire before any network request, strictly after `DENY_LIST` |
| Skill-level routing text (SKILL.md / references/*.md) | Documentation tier (first-party prose, read as data by CI) | — | Not code — but mechanically policed by `check-skill-fork-honesty.mjs`, which imports `CAPABILITY_REGISTRY` as its one source of truth |
| Fork process launch argv (`buildViceArgs()`'s fork branch) | Host broker (`broker-launch.mts:218`) | — | Argv construction happens host-side where the actual `x64sc -mcpserver` child process spawns |
| Published npm tool-list contract (`tools-manifest.json`) | Package/distribution tier | — | `@henols/vice-mcp`'s advertised 62-tool fork surface is a contract a real npm consumer may depend on; changing it is a semver-relevant event, not merely a repo edit |

## Q1 — The exact fork-backend code surface today

All figures below are `wc -l` / grep counts run against the current tree this
session — `[VERIFIED: .claude/mcp/vice/*, tools-manifest*.json — read/counted this session]` unless noted.

### Production modules

| File | Lines | Fork role | Shared with stock? |
|------|------:|-----------|---------------------|
| `.claude/mcp/vice/vice.ts` | 772 | `call()` (HTTP/MCP transport to the fork's `/mcp` endpoint), `activeInstance`/`useInstance`, `beginSession()`, `DENY_LIST` (`vice_disk_list` — a fork-only hazard tool that crashes the shared host MCP server, `vice.ts:9-13`), `denyListRefusalMessage()` | **Yes — cannot be deleted wholesale.** Exports `ViceError`, `MachineRestartedError`, `readEpoch()`, `mcpHost()`, `type ToolInfo` consumed by `stock-condition.ts:49`, `stock-recycle.ts:67`, `stock-diagnose.ts:51`, `stock-dispatch.ts:30`, `stock-connect.ts:45`, `stock-derived.ts:79`, `stock-handler.ts:39`, `stock-address.ts:35`, `stock-petscii.ts:38`, `stock-paths.ts:38`, `stock-timing.ts:48`, `stock-symbols.ts:56`, `vice-broker-client.ts:47` — 13 stock modules, none of which use `call()` |
| `.claude/mcp/vice/vice-sync.ts` | 336 | Checkpoint-sync primitives built on `vice.ts`'s `call()` (line 70) — `readCheckpoint()`, `waitCheckpointHit()`, `runToCheckpoint()`, `reset()`, `screenshot()` | Fork-only in practice — no stock module imports it (only `vice-sync.test.ts` does); `vice-proxy.ts` still imports it for fork tool dispatch |
| `.claude/mcp/vice/vice-probe.ts` | 278 | The fork's deliberately-fragile liveness probe (fast HTTP round-trip, no retry) | Fork-only per its own header — `vice-proxy.ts` still imports `probeInstance` |
| `.claude/mcp/vice/backend-detect.mts` | 645 | `resolvedBackend()` — the ONE reader of `VICE_BACKEND`; `"fork"` is the fallback on an indeterminate `--help` probe | **Shared infrastructure**, not fork code — same file also resolves `"stock"`. Removing the fork removes the *branch*, not the file; the capability-cache mechanism under `.vice-supervisor/` stays needed for stock alone only if a future capability (e.g. `CPUHISTORY_GET`) still needs caching |
| `.claude/mcp/vice/resources/backend-detect.mjs` | 424 | Compiled host-bound mirror of the above, committed per the project's "no build step for the shipped server, but host-bound `.mts` must be compiled" architecture rule | Same shared-vs-fork split as its source |
| `.claude/mcp/vice/refresh-manifest.ts` | 124 | Regenerates `tools-manifest.json` (the **fork's** manifest) from a live fork server's `tools/list` | Fork-only, by design — its own header states it is the ONLY writer of that file |
| `.claude/mcp/vice/fork-manifest-surface.test.ts` | 108 | Hard-coded 62-tool-count regression gate on `tools-manifest.json`, protecting `BACK-02` ("fork's list is unchanged from v0.1.x") | Fork-only test, but its *reasoning pattern* (derive from the manifest, never hand-count) is the template `check-skill-fork-honesty.mjs` reuses |
| `.claude/mcp/vice/capability-registry.ts` | 388 | 26-entry `CAPABILITY_REGISTRY` — every tool one backend has that the other doesn't. 6 `hardware` (fork-only, unrecoverable on stock), 18 `descoped` (fork-only, simply unbuilt on stock), 2 `stock-only-gain` | **Shared seam** — `capabilityRefusalMessage()` is called for BOTH directions (a fork user calling a stock-only tool gets refused too). Cannot be deleted; must be *edited* (26 entries → fewer) on removal |
| `.claude/mcp/vice/broker-launch.mts` | 1467 | `buildViceArgs()`'s fork branch (`-mcpserver -mcpserverhost <ip> -mcpserverport <port>`, line 218) plus a `backend ?? "fork"` default threaded through the launch-readiness probe (`probeReady(port, { backend: deps.backend ?? "fork" })`, line 960) and the whole flag-shape contract at line 118 ("`backend: "fork"` returns exactly the pre-Phase-2 shape, byte-identical") | **Shared file, fork is the historical default branch** — not a separable fork module; every call site that omits `backend` silently gets fork behaviour |
| `.claude/mcp/vice/vice-broker.mts` | 1217 | Same `deps.backend ?? "fork"` default pattern (lines 321, 398-410, 575) governing which launch argv a crash-respawn or warm-floor spare uses | Shared file, same interleaving as `broker-launch.mts` |
| `.claude/mcp/vice/vice-proxy.ts` | 3467 | 12 literal `fork` string occurrences: the backend-mismatch error message (lines 2402-2430), `RECYCLE_TOOL`/`DIAGNOSE_TOOL` evidence-gathering backend branch (lines 3282-3345), a log-line arm (line 3458-3464); imports `call`, `activeInstance`, `useInstance`, `DENY_LIST`, `denyListRefusalMessage`, `readEpoch`, `beginSession`, `MachineRestartedError`, `mcpHost` from `vice.ts` | The single largest shared file touched — 3467 lines total, but only ~30-40 lines are fork-branch-specific; the rest is the stdio MCP entry point serving both backends |
| `.claude/mcp/vice/stock-dispatch.ts` | (imports `ViceBackend` type, line 29) | `withDerivedTool()`'s `if (backend === "fork") return syntheticDef unchanged` branch (line 145); a refusal message at line 737 (`Set VICE_BACKEND=fork to use it there...`) | Shared — the whole point of this file is deciding per-tool behaviour by backend |
| `.claude/mcp/vice/broker-control.mts` | (excerpt) | `backend: "fork" \| "stock"` type field threaded through the control-plane protocol (lines 128-136, 224) | Shared protocol type |

### Tests

23 test files reference the literal string `fork` at least once (grep count
per file below; most of these files primarily test the **stock** dispatch
path and mention "fork" only in a comment, a decision-record citation, or a
byte-identity comparison against the fork manifest — not fork-only test
bodies):

| File | `fork` mentions | Character |
|------|-----------------:|-----------|
| `stock-dispatch.test.ts` | 53 | Stock test asserting per-tool backend behaviour differs correctly from fork |
| `backend-detect.test.ts` | 28 | Tests `resolvedBackend()`'s fork-fallback branch directly — genuinely fork-coupled |
| `manifest-arg-compat.test.ts` | 22 | Cross-backend argument-shape compatibility (D-07) — inherently dual-backend |
| `broker-launch.test.ts` | 19 | Tests `buildViceArgs()`'s fork branch alongside stock |
| `capability-registry.test.ts` | 11 | Tests the 26-entry table directly |
| `fork-manifest-surface.test.ts` | 11 | Fork-only, as above |
| `vice-proxy.test.ts` | 11 | Backend-mismatch error message tests |
| `skill-honesty-checks.test.ts` | 7 | Tests the honesty-check script's own predicate library |
| `vice-broker-acquire.test.ts` | 7 | Fork-as-default-branch tests |
| `stock-broker-live.test.ts`, `vice-broker-supervision.test.ts`, `broker-control.test.ts` | 3-4 each | Backend-parametrised live/supervision tests |
| remaining 12 files | 1-3 each | Single decision-record citation or a shared-fixture comment |

`vice.test.ts` (187 lines) exercises `call()` directly — this is the fork
transport's own primary unit-test file and would be deleted or radically
rewritten on removal, since 13 stock modules only need the *types/errors* it
exports, not `call()` itself.

### Docs, skills, manifests, and the honesty guard

- `README.md:72-157` — the entire "Installing VICE, and choosing a backend"
  section (`[VERIFIED: README.md — read this session]`).
- `docs/stock-vice-parity.md` — the two-way gap analysis this whole migration
  produced; its "losses" section (§A) is written entirely in fork-vs-stock
  terms.
- `docs/roadmap-stock-vice.md` — pre-migration ADR, now historical; still
  live-linked from `stock-vice-parity.md`'s header.
- `.claude/skills/c64-program-recon/{SKILL.md, references/{observation-hazards,control-flow,sound-and-input,tool-selection}.md}`,
  `.claude/skills/c64-ram-capture/SKILL.md`, `.claude/skills/vice-wedge-triage/SKILL.md`
  — every fork-only tool mention, annotated per-section (see Q4 for the
  verbatim text).
- `scripts/check-skill-fork-honesty.mjs` (505 lines) + its predicate library
  `scripts/lib/skill-honesty-checks.mjs` (94 lines) — **the single largest
  removal-cost item that is not obviously code.** `[VERIFIED: scripts/check-skill-fork-honesty.mjs — read in full this session]`.
  Its non-vacuity assertions are hard-coded around the fork's *current*
  existence: `FORK_ONLY_NAMES.size >= 20` (line 483), `totalForkMentions >= 8`
  (line 470), plus README-required-substring assertions naming
  `vice_sid_get_state`/`vice_keyboard_matrix` explicitly (lines 244-260) and
  `VICE_BACKEND` itself (line 245). On removal, every one of these assertions
  is *wrong on its own terms*, not merely stale — the whole script's premise
  ("does every fork-only mention carry a fork-requirement annotation")
  stops applying once there is no fork. It needs a redesigned premise
  ("does every hard-loss mention carry an honest no-route statement"), not a
  parameter tweak.
- `.mcp.json` — does **not** set `VICE_BACKEND` (`[VERIFIED: .mcp.json — read this session]`), so today's default (fork, via `resolvedBackend()`'s indeterminate-probe fallback) is silent unless a consumer sets the env var explicitly. This is itself evidence for the todo's framing: the fork is retained *by default*, not by an active per-project choice, for anyone who has not read the README closely.
- `tools-manifest.json` (1223 lines, 62 tools) — the fork's own manifest,
  entirely fork-scoped; deleting the file is trivial, but `check-npm-packages.mjs:55` asserts its presence in the published `@henols/vice-mcp` tarball, so its removal is a **published-package-contract change**.

### Not shared — safe to delete outright on "remove"

`vice-probe.ts`, `refresh-manifest.ts` (+ its test), `fork-manifest-surface.test.ts`,
`tools-manifest.json`, `vice-sync.ts` (+ its test, once `vice-proxy.ts`'s fork
dispatch branch that calls it is also removed), and the fork-argv branch in
`broker-launch.mts:218` are the cleanly separable pieces. Everything else in
the table above requires an edit to a shared file, not a deletion.

## Q2 — What "remove" actually costs, and what breaks

**Package contract.** `tools-manifest.json`'s 62-tool list is what
`@henols/vice-mcp`'s current published tarball advertises
(`check-npm-packages.mjs:55` asserts the file exists in the pack). Dropping
62 named tools from a package a real npm consumer may already depend on is
a breaking change under semver; the pending todo (line 95-98) already names
this explicitly: "the fork's 62-tool list is a published contract... dropping
it is semver-major, and every merge to `main` auto-publishes a patch, so the
release path needs handling." `[VERIFIED: .planning/todos/pending/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md — read this session]`.
This project's own release automation (per PROJECT.md's Technology Stack)
auto-publishes a patch on every merge to `main` unless the commit subject
says `[skip release]` — a removal PR must either carry that skip marker and
be handled by a deliberate major-version release, or the breaking removal
ships silently as a patch bump, which would be the exact "silent" failure
mode `FORK-01`'s requirement text exists to forbid, applied to the package
contract instead of the planning record.

**Guards that assume fork text exists, and would need redesign, not deletion:**

1. `scripts/check-skill-fork-honesty.mjs` (505 lines) — as detailed in Q1,
   every one of its non-vacuity assertions and required-substring checks is
   written assuming the fork is a live alternative. A "remove" branch must
   either delete this script entirely (losing the mechanical honesty check
   that currently prevents a skill from silently assuming a capability it
   doesn't have) or rewrite it to check the *new* invariant: every mention
   of `vice_sid_get_state`/`vice_keyboard_matrix`/`vice_keyboard_restore`
   in skill prose carries an honest "permanently unavailable" statement
   instead of a fork pointer.
2. `docs-linerefs.test.ts` — CLAUDE.md's own header states this test
   "mechanically checks the two `rewriteArguments()` citations" and flags
   drift; it is not fork-specific, but any removal PR that edits
   `vice-proxy.ts` (which it will — the backend-mismatch branch lives there)
   risks moving those two line numbers, and this guard will correctly fail
   until they're re-pinned. Not a new cost, but a live tripwire to expect.
3. `fork-manifest-surface.test.ts` — hard-deletes cleanly; its entire reason
   to exist (BACK-02, "fork surface unchanged") stops applying once there is
   no fork surface to protect.
4. `manifest-arg-compat.test.ts` (22 fork mentions) — tests cross-backend
   argument-shape compatibility; on removal this collapses to a single-backend
   test, a simplification rather than new work, but every one of its 22
   fork-referencing assertions needs review to confirm none of them was
   quietly protecting a stock behaviour too.
5. `capability-registry.ts`'s 26-entry table — the 6 `hardware` entries
   (`providedBy: "fork"`) become entries with **no** `providedBy` to point
   to, since there is no other backend; `capabilityRefusalMessage()`'s
   `"hardware"` branch (lines 366-373) is written assuming
   `entry.providedBy` is always a real, callable backend name — it would
   need a new branch for "no backend provides this, ever" rather than
   "the other backend provides this."

**Docs/skills/installer touch list** (from the pending todo, cross-checked
against this session's own grep):

- `README.md:72-157` rewritten in full (the entire backend-choice section
  stops applying — no more `VICE_BACKEND`, no more per-ecosystem "which VICE
  you get" framing insofar as it discriminates by backend capability rather
  than just version).
- `docs/stock-vice-parity.md` §A (the two-way gap analysis) collapses to a
  one-way "what this project cannot do" list — most of the file's ~493 lines
  concern this framing.
- `docs/roadmap-stock-vice.md` — already historical/superseded prose; would
  likely move to an archive note rather than be edited line-by-line.
- Four `c64-program-recon` reference files, `c64-ram-capture/SKILL.md`,
  `vice-wedge-triage/SKILL.md` — every "requires the fork backend" sentence
  (see Q4's verbatim list) must become an honest "no route exists" sentence.
- `CLAUDE.md`'s own Compatibility constraint ("the fork's list is unchanged
  from v0.1.x") and its `## Constraints` capability bullets for SID/matrix
  keyboard need editing to drop the now-false "route to the fork" framing.
- `installer/` — not directly fork-coupled per this session's grep (the
  installer copies skills and wires `.mcp.json`; it does not itself branch
  on backend), but any skill file it syncs picks up the same edits.

**What removal does NOT have to touch:** the stock dispatch table, the 38
stock tools, the binary-monitor protocol client (`stock-protocol.ts`,
`stock-connect.ts`, etc.), or any of Phase 2-13's stock-side work. This
project's stock backend is fully independent code, not built on top of the
fork transport — confirmed by the import-graph check in Q1 (13 stock modules
import only `ViceError`/`MachineRestartedError`/`readEpoch`/`mcpHost`/`ToolInfo`
from `vice.ts`, never `call()`).

## Q3 — What "retain" actually costs, and the cheapest real exercise

**No test in this repository currently drives the fork's HTTP transport
against a real, live `-mcpserver` process.** `[VERIFIED: broker-e2e.test.ts — read this session]`
— the one end-to-end broker test that spawns a real child process
explicitly stubs `VICE_BIN` to `/bin/sleep`, with its own header stating "no
real emulator runs anywhere in this test and no test opens a connection to
the host VICE." `08-HUMAN-UAT.md` (Phase 8's human walkthrough, the one
document in this repo that records a genuine live end-to-end capture) is
scoped entirely to the **stock** backend (`vice_version: "x64sc (VICE 3.9)"`
in its frontmatter) — it never exercised the fork. Phase 13's EXTV-01/EXTV-02
live captures also ran against `/usr/local/bin/x64sc` (the fork *binary*)
but spoke the **stock binary-monitor protocol** to it (`-binarymonitor`), not
the fork's own `-mcpserver` HTTP endpoint — so even those recent, real,
live-binary captures did not exercise the fork transport itself.

This means criterion 3's "exercised once more against a real fork binary and
still passes" is not a formality on the retain branch — **it would be the
first live exercise of the fork's actual HTTP transport this milestone, and
possibly since v0.1.x.** The cheapest real exercise, concretely:

```sh
# Launch the real fork binary with its own flag (confirmed by this session's grep of broker-launch.mts:218)
/usr/local/bin/x64sc -mcpserver -mcpserverhost 127.0.0.1 -mcpserverport 6510 &
# Then, from the container/dev environment, with VICE_BACKEND=fork and
# VICE_MCP_URL pointed at that host:port, call a handful of tools through
# the real vice-proxy.ts dispatch -- vice_ping (the liveness-probe's own
# target, vice-probe.ts's header), vice_registers_get, vice_sid_get_state
# (one of the three hard-loss tools FORK-02 names), and vice_recycle's
# incident-record path -- then kill the process.
```

No existing harness wraps this; it would need to be written fresh (a
`fork-live.test.ts`-shaped manual-only test, following the pattern
`stock-live.test.ts` already establishes for the stock side — env-gated,
skipping cleanly where no fork binary exists, listed in `test-gate.mjs`'s
`MANUAL_ONLY_TESTS`). That is a small, one-plan-sized piece of work, not a
new subsystem — the pattern to copy already exists and is proven.

**Ongoing carrying cost of retain** (already paid, not new): the dual test
matrix (23 fork-string-referencing test files, most already shared with
stock coverage rather than duplicated), the dual manifest
(`tools-manifest.json` + `tools-manifest.stock.json`), the honesty-check
script (505 lines, already committed and running in CI), and the doc
caveats throughout README/skills (already written and mechanically policed).
The pending todo's own framing (line 26-29) puts this at "near zero" —
"already written and tested" — and this session's inventory does not
contradict that for the steady-state cost; the *first-time* live-exercise
gap above is the one real, unpaid cost retain still owes.

## Q4 — The three hard losses' current documented routes, verbatim

### 1. SID state read-back (`vice_sid_get_state`)

`[VERIFIED: .claude/skills/c64-program-recon/references/observation-hazards.md:79-96 — read this session]`, quoted:

> "Prefer the whole-chip reads — `vice_vicii_get_state`, `vice_cia_get_state`, `vice_sid_get_state` — over raw register reads... `vice_sid_get_state` is **fork-only**, since SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command."

`[VERIFIED: .claude/skills/c64-program-recon/references/tool-selection.md:18 — read this session]`:

> "Whole-chip SID state without the read hazards | `vice_sid_get_state` (**requires the fork** — SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command; unrecoverable on stock)"

At point of use (runtime refusal, `[VERIFIED: capability-registry.ts:366-373 — read this session]`, format string):

> "`vice_sid_get_state` is unrecoverable on the stock backend: SID's `$D400-$D418` registers are write-only in hardware, and the binary monitor exposes no SID read command. Use the fork backend instead (Set `VICE_BACKEND=fork`)."

**Judgment:** on **retain**, this is a route a user can actually follow —
switch the env var and relaunch. It costs a full instance relaunch, not a
runtime toggle, but it is real and named at exactly the point of use (both
the skill doc's own section and the tool-call refusal). **On remove, this
route stops existing** — there is no client-side SID write-shadowing
mitigation (explicitly out of scope, PROJECT.md → Out of Scope: "SID
read-back routes to the fork backend... Shadowing was never parity") — so
"remove" turns this into a stated, routeless permanent loss, and every one
of the three quoted texts above needs rewriting from "here is the fork
route" to "there is no route."

### 2. Matrix keyboard (`vice_keyboard_matrix`, plus chord/press/release)

`[VERIFIED: .claude/skills/c64-program-recon/references/observation-hazards.md:106-112 — read this session]`:

> "**`vice_keyboard_matrix` requires the fork backend.** The binary monitor's `KEYBOARD_FEED` (0x72) only injects PETSCII text into the KERNAL keyboard buffer; the emulator recomputes CIA port B from its own keyboard array on every read, so there is no wire command that can drive the raw matrix — this is unrecoverable on stock, not merely unbuilt. On stock, use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or `vice_joystick_set` when it polls the matrix directly instead."

`[VERIFIED: .claude/skills/c64-ram-capture/SKILL.md:158-159 — read this session]`:

> "Press past any 'hit any key' gate with `mcp__plugin_c64-re-tools_vice__vice_keyboard_matrix`. **This call requires the fork backend** — the binary monitor's `KEYBOARD_FEED` only injects..."

**Judgment:** this is the strongest of the three routes on retain — it
names both a backend-switch route AND a genuine partial stock-side
alternative (`vice_joystick_set` for matrix-polling *in-game* input, per
`capability-registry.ts`'s `KEYBOARD_ALTERNATIVE` constant, line 91-95). On
**remove**, the joystick-based partial mitigation still stands (it does not
depend on the fork), but the "press any key" / chord / hold-down cases with
no joystick equivalent become a stated, routeless loss — this is documented
already in `.planning/notes/stock-vice-migration-revised-loss-ledger.md`'s
"Loss 2" section as genuinely unrecoverable by any client-side trick
(`read_ciapb()` recomputes live on every read; checkpoint-substitution fails
because watchpoints fire after the load already completed).

### 3. RESTORE/NMI (`vice_keyboard_restore`)

`[VERIFIED: .claude/skills/c64-program-recon/references/control-flow.md:83-93 — read this session]`:

> "NMI and RESET sharing one entry is the shape of an anti-tamper trap: RESTORE and reset are the two ways a user perturbs a running game... press RESTORE with `mcp__plugin_c64-re-tools_vice__vice_keyboard_restore`... **`vice_keyboard_restore` requires the fork backend.** The RESTORE key pulses the NMI line directly and is not part of the keyboard matrix, so stock's `KEYBOARD_FEED` (which only injects PETSCII text into the buffer) cannot produce it. Calling it on the stock backend returns an error naming the reason and the fork backend, rather than pulsing RESTORE."

**Judgment:** same shape as the other two — a real route on retain (switch
backend), no client-side substitute at all on stock (unlike the keyboard
matrix case, there is no joystick-equivalent partial mitigation for RESTORE
specifically — it is a dedicated NMI-line pulse). **On remove, this becomes
the cleanest of the three "must be honestly worded as a total loss" cases**
— there is no partial workaround to point to instead, only the disappearing
fork route.

**Cross-cutting observation:** all three routes today are annotated in the
*same shape* — "requires the fork backend" — both in skill prose and in the
runtime refusal string, and both surfaces are already mechanically checked
(`check-skill-fork-honesty.mjs`'s section-scoped proximity rule for the
skills, `capability-registry.test.ts` for the runtime string). FORK-02 is
**already satisfied on the retain branch**, evidenced live by the quoted
text above and by the passing state of both guards today. The work FORK-02
requires is entirely conditional on FORK-01's outcome: zero new writing if
retain, a full rewrite of the same sites (skills + `capabilityRefusalMessage()`'s
now-inapplicable "hardware" branch + `check-skill-fork-honesty.mjs`'s premise)
if remove.

## Q5 — What existing artifacts already establish, and where they disagree

| Artifact | What it already establishes | Read this session |
|---|---|---|
| `.planning/todos/pending/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` | The 24-tool fork-only disposition list (6 hardware, 18 descoped), a sketch of 5 removal steps, and the **open question the todo itself never answers**: "is this 'delete the fork backend' or 'stop defaulting to it and stop testing it'?" (deprecate-first is explicitly offered as a lower-risk alternative to full deletion) | Yes, in full |
| `.planning/notes/stock-vice-migration-revised-loss-ledger.md` | Source-verified (against `VICE-Team/svn-mirror` @ `e50d42c`, 2026-08-09) that only 2 of the original 6 claimed losses are genuine (SID, matrix keyboard); On-demand pause and cycle stopwatch were "dissolved" by later research. Explicitly recommends **dual backend, not replacement** — "staying on the fork is not the low-risk option, it is the deferred-risk option." Also the origin of the "~60 lines, `keyboard_set_keyarr_any`" `KEYBOARD_MATRIX_SET` estimate | Yes, in full |
| `docs/stock-vice-parity.md` | The current, maintained two-way gap analysis (§A losses, §B gains, §C fork value-add) — supersedes the loss-ledger note's numbering per its own header, and is the file the honesty-check script actively polices for staleness | Yes, in full |
| `docs/roadmap-stock-vice.md` | Pre-migration ADR (status: "proposed"), explicitly superseded by `docs/phase0-binmon-findings.md` for wire facts; historical value only — its "Costs" framing ("broker/concurrency model needs review") is the exact claim the loss-ledger note corrects as overstated | Yes, in full |
| `docs/phase2-backend-probe-evidence.md` | Not read this session in full (Phase 13 already resolved its retired verdicts per STATE.md's own record) — the planner should treat its EXTV-01/EXTV-02 closures as settled rather than re-deriving them | No — deferred to Phase 13's own closure record in STATE.md |
| PROJECT.md → Out of Scope, "Removing or deprecating the fork backend" entry | Already states the *rationale* for retaining (hedge against 3 hard losses, near-zero incremental cost) and reaffirms at v0.2.0 close — but this entry predates Phase 14's requirement and is exactly what FORK-01 exists to either formalize with reversal criteria or supersede with a dated removal decision | Yes (PROJECT.md read in full this session) |

**Where two disagree:** `docs/roadmap-stock-vice.md` frames the single-TCP-connection
binary monitor as a *cost* of going stock ("the broker/concurrency model
needs review"). `.planning/notes/stock-vice-migration-revised-loss-ledger.md`
explicitly corrects this as a non-issue — the fork's existing HTTP session
is *already* one stateful connection per instance, so the topology carries
over unchanged; only the event-demux shape differs. This is already resolved
in the newer document and does not need re-litigating, but a planner reading
`docs/roadmap-stock-vice.md` cold without also reading the loss-ledger note
would inherit the stale, corrected claim.

**No disagreement found between the loss-ledger note and `stock-vice-parity.md`
on the two genuine hard losses (SID, matrix keyboard)** — both agree they are
unrecoverable on stock with no full workaround; `stock-vice-parity.md` adds
the third (RESTORE/NMI, found later at Phase 5, per its own §A.7 "Criterion
5's exception count is three, not two" note) which the older loss-ledger note
does not mention (it predates that Phase 5 finding). This is not a
disagreement, just an artifact of the loss-ledger note being older.

## Q6 — The `KEYBOARD_MATRIX_SET` coupling, precisely

**What it is:** a proposed, never-submitted ~60-line addition to VICE's
`monitor_binary.c` that would add a binary-monitor opcode calling the
existing `keyboard_set_keyarr_any()` function (which already exists in VICE
core, used today only by the SDL virtual-keyboard UI and joystick→key
mapping — `.planning/notes/stock-vice-migration-revised-loss-ledger.md:95-98`,
sourced against `VICE-Team/svn-mirror` @ `e50d42c`, 2026-08-09). It is listed
in REQUIREMENTS.md's Future Requirements as `UP-01` and **already explicitly
named there as one of FORK-01's reversal criteria**: `[VERIFIED: .planning/REQUIREMENTS.md:87 — read this session]`

> "**UP-01**: A `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`) — closes stock's hardest loss for everyone, and would satisfy one of `FORK-01`'s reversal criteria"

**What would have to be true upstream for the decision to flip:**

1. The opcode would have to actually **land** in a VICE release — checked
   live this session, `[VERIFIED: https://vice-emu.sourceforge.io/vice_13.html — fetched this session, VICE 3.10 manual]`:
   the current binary-monitor command list has no keyboard-matrix-set opcode
   at all — the only keyboard-related command is `0x72` (Keyboard feed,
   buffer-text injection only). **As of VICE 3.10, this has not landed.**
2. It would then have to reach the ecosystems this project's install table
   actually cares about — Debian/Ubuntu's `apt` path is already one full
   version behind (shipping 3.9, which lacks even the *existing* `CPUHISTORY_GET`
   from 3.10 — the same "apt lags upstream" pattern would apply here too), so
   even a landed opcode would take a further release cycle to reach the
   install path this project's README documents as the primary route.
3. Even landing would only close **one** of the two-to-three genuine losses
   (matrix keyboard + RESTORE, since RESTORE pulses NMI, not the matrix
   proper — whether `keyboard_set_keyarr_any` or a sibling call could also
   drive NMI is not established by any artifact read this session; treat
   RESTORE's closure by the same opcode as **unconfirmed**, not assumed).
   SID read-back (`vice_sid_get_state`) has **no** proposed upstream fix at
   all in this project's own docs — it is a hardware fact (write-only
   registers), not a missing opcode, so no upstream coupling closes it.

**Where the project would notice:** nowhere automatically today. There is no
version probe for a hypothetical future opcode (unlike `CPUHISTORY_GET`,
which has a real, live `VICE_INFO`-based capability probe in
`stock-connect.ts`). If `FORK-01`'s reversal criteria are written to cite
`KEYBOARD_MATRIX_SET` landing as a trigger, the planner should note this is
presently a **manually-tracked** trigger (re-check the VICE manual / changelog
at some future point), not a mechanically-monitored one — building a probe
for an opcode that does not exist yet is out of scope for this phase.

## Q7 — Where the dated decision goes, and in what shape

`[VERIFIED: .planning/PROJECT.md:253-277 — read in full this session]`. The
`## Key Decisions` table's established format is exactly three columns:

```markdown
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| <short imperative statement of what was decided> | <why, in one clause> | <✓ Good / ⚠️ Revisit — followed by what actually happened, with concrete evidence citations> |
```

**No existing entry has a dedicated "criteria that would reverse it"
column or sub-field.** Entries that were later reversed record that fact
retroactively in the `Outcome` cell (e.g. "⚠️ Revisit — **reversed
2026-08-17.** `GAIN-01..09`..."), not prospectively. FORK-01 is therefore
the **first** entry in this table's history required to state its own
reversal criteria *at the time it is written*, not after the fact — there is
no prior-entry template to copy verbatim for that specific sub-shape. The
planner should write the `Rationale` or `Outcome` cell to explicitly name
the criteria (following the existing prose density of e.g. the
"Backend selected project-level..." entry, which already runs to several
sentences inside one cell), rather than inventing a fourth column, since a
fourth column would break every existing row's shape and the table-rendering
convention this file uses throughout.

The entry must, per FORK-01's own text, explicitly include the
`KEYBOARD_MATRIX_SET` coupling — `UP-01`'s Future Requirements text (quoted
in Q6) is the ready-made source sentence to fold in; it is already written
in exactly the right shape ("...would satisfy one of `FORK-01`'s reversal
criteria") and just needs to be *the entry itself* rather than a forward
reference to it.

## Q8 — Downstream phases this outcome touches

- **Phase 15 (`warp-over-resource_set` todo,
  `.planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md`):**
  item 3 of that todo's own Solution section explicitly names
  `vice_machine_config_set`'s fork-only `WarpMode` claim as something to
  "mark fork-only per SKILL-01" **if the fork is retained**, or presumably
  delete outright if removed. The todo's own header already flags this
  coupling: "Related: ... touches the fork tool's `WarpMode` claim, which
  this would make moot" (referring to full fork removal). Phase 15 should
  not fix this todo's fork-facing half until Phase 14's outcome is known —
  which is exactly why ROADMAP.md sequences Phase 14 first.
- **Phase 15 (bulk disposition, GATE-02/DEBT-01/02/03):** any pending
  code-review finding or todo that names a fork-specific file (e.g.
  `WR-13` — "a second capability-refusal string hardcodes 'the fork backend
  provides this tool'... verified unreachable today", per STATE.md's
  Deferred Items) has its disposition's *correctness* depend on Phase 14's
  outcome — a `wont-fix` rationale written against "the fork exists and this
  is dead code" reads differently once the fork itself might not exist.
- **Phase 16 (packaging, PKG-01..04):** ROADMAP.md's own Phase 16 rationale
  states it is sequenced after Phase 14 specifically because "the fork
  decision in Phase 14 may delete code under the current tree" — the `src/`
  relocation and line-reference sweep should happen exactly once, after
  removal (if that is the outcome) rather than before.
- **Phase 17 (Core Value, ledger close, DEBT-04):** the deferred-items count
  and the fork-removal todo itself (`2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`)
  is one of the 18 pending todos counted in STATE.md's ledger. If Phase 14's
  outcome is "retain, with named reversal criteria," this specific todo
  should move to `completed/` with a `wont-fix`-shaped resolution citing the
  new PROJECT.md decision — directly reducing the count DEBT-04 measures. If
  the outcome is "remove," the todo is *superseded* by a real implementation
  plan, likely promoted rather than closed (per REQUIREMENTS.md's own
  "Promoted by DEBT-01" future-requirements bucket), which does **not**
  reduce the count the same way.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding which skill mentions of a fork-only tool need a route annotation | A new hand-maintained list of "fork-only tool names" anywhere in a plan or a new script | `CAPABILITY_REGISTRY` in `capability-registry.ts` (`providedBy === "fork"` filter) | Already the single source of truth; `check-skill-fork-honesty.mjs`'s own header explicitly warns against a second hand-copied list, and it would drift the moment a tool's category changes |
| Checking whether a removal PR left a dangling fork reference | A one-off grep run by hand at review time | Extend `check-skill-fork-honesty.mjs`'s existing walk-and-assert pattern (or a new script following the exact same shape) | The pattern (derive names from a first-party module, walk skills + README + a named doc, assert both directions) is proven and already CI-wired; a bespoke one-off grep would not survive to catch regression on the next phase |
| Recording the reversal criteria's future re-check | A version-probe for an opcode that does not exist yet (`KEYBOARD_MATRIX_SET`) | A plain PROJECT.md prose note that this is manually tracked, per Q6 | Building live-detection infrastructure for a capability that has zero wire presence today is speculative work outside this phase's two requirements |

## Common Pitfalls

### Pitfall 1: Treating "remove" as a `git rm`

**What goes wrong:** a plan scopes "remove the fork" as deleting
`vice.ts`/`vice-sync.ts`/`vice-probe.ts` and calling it done.
**Why it happens:** those three files *look* like the fork module, and in
isolation they are — but `vice.ts` alone is imported by 13 stock files for
shared error types and utilities that have nothing to do with the fork
transport (Q1).
**How to avoid:** any removal plan must first extract the shared exports
(`ViceError`, `MachineRestartedError`, `readEpoch`, `mcpHost`, `ToolInfo`)
into a module that survives the deletion, before deleting `call()` and its
direct dependents.
**Warning signs:** a typecheck failure across 13 unrelated `stock-*.ts`
files the moment `vice.ts` is deleted.

### Pitfall 2: Fixing `check-skill-fork-honesty.mjs`'s assertions one at a time

**What goes wrong:** on removal, a plan tries to make the existing script
pass again by deleting individual `need()` calls until it's green.
**Why it happens:** the script is large (505 lines) and its failures, once
the fork is gone, will look like a long list of independent broken
assertions rather than one broken premise.
**How to avoid:** recognize this is a premise change (Q1/Q2) — redesign what
the script checks (honest no-route statements, not fork-requirement
annotations) rather than deleting assertions piecemeal, or the non-vacuity
guards (`FORK_ONLY_NAMES.size >= 20`, etc.) will silently stop protecting
anything.

### Pitfall 3: Assuming FORK-02 needs new writing on the retain branch

**What goes wrong:** a plan budgets time to write new route text for the
three hard losses, assuming FORK-02 is unmet today.
**Why it happens:** the roadmap's phrasing ("a user... has an actual route
to follow") reads as a gap to close.
**How to avoid:** Q4 shows all three routes already exist, are already
annotated per-section, and are already mechanically checked by two separate
guards (skill honesty script + `capability-registry.test.ts`). On retain,
FORK-02's work is *verification* (run the checks, cite them as evidence),
not authoring.
**Warning signs:** a plan with tasks like "write the SID read-back route
into observation-hazards.md" when that text already exists verbatim.

### Pitfall 4: Deciding the 24-tool disposition inside this phase

**What goes wrong:** a plan for "remove" tries to decide, tool-by-tool,
whether each of the 24 fork-only tools is reimplemented, dropped, or ported —
inside Phase 14.
**Why it happens:** the pending todo lists all 24 with a `TBD` sketch, which
reads like ready-made scope.
**How to avoid:** Phase 14's requirements are FORK-01 (the decision) and
FORK-02 (the three hard-loss routes) — not "reimplement or drop 24 tools."
A "remove" decision can and should be recorded without also completing that
tool-by-tool disposition in the same phase; the disposition itself is
follow-on work with its own sizing (per-tool feasibility varies — some like
`vice_display_screenshot` have a documented client-side path, others like
`vice_sid_get_state` do not).
**Warning signs:** a plan with 24 sub-tasks, one per fork-only tool.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — invoked via `npm test` / `npm run test:automated` in `.claude/mcp/vice/package.json` |
| Quick run command | `cd .claude/mcp/vice && node --test capability-registry.test.ts fork-manifest-surface.test.ts backend-detect.test.ts` |
| Full suite command | `cd .claude/mcp/vice && npm test` (or `npm run test:automated` for the narrowed gate — both currently green per STATE.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORK-01 | PROJECT.md → Key Decisions carries a dated entry naming reversal criteria incl. `KEYBOARD_MATRIX_SET` | doc-content check | `grep -n "FORK-01" .planning/PROJECT.md \| grep -i "KEYBOARD_MATRIX_SET"` (manual grep — no existing test asserts PROJECT.md content shape) | ❌ no automated guard exists for this; Wave 0 gap |
| FORK-02 (annotation half) | Every skill mention of a hard-loss tool carries an honest route/no-route statement | doc-content check, mechanical | `cd /home/henrik/dev/henrik/git/c64-re-tools && node scripts/check-skill-fork-honesty.mjs` | ✅ exists, currently green (retain branch); needs redesign if remove is chosen |
| FORK-02 (runtime half) | The tool-call refusal for each hard-loss tool names an actual route | unit | `cd .claude/mcp/vice && node --test capability-registry.test.ts` | ✅ exists |
| FORK-01/02 criterion 3, "remove" branch | No code path still advertises or spawns the fork transport | grep/live | `grep -rn "mcpserver" .claude/mcp/vice/*.ts .claude/mcp/vice/*.mts` returns nothing outside deleted files; `grep -rn 'VICE_BACKEND' .` returns nothing outside a historical-decision note | ❌ no test asserts "fork is fully absent" today (it currently should NOT be absent); Wave 0 gap on the remove branch only |
| FORK-01/02 criterion 3, "retain" branch | The retained path is exercised once more against a real fork binary and still passes | manual-only, live | `/usr/local/bin/x64sc -mcpserver -mcpserverhost 127.0.0.1 -mcpserverport 6510 &` then drive `vice_ping`/`vice_registers_get`/`vice_sid_get_state` through the real MCP dispatch with `VICE_BACKEND=fork`, then kill the process | ❌ no such live test exists (Q3); Wave 0 gap on the retain branch |

### Sampling Rate

- **Per task commit:** `node scripts/check-skill-fork-honesty.mjs` (fast, deterministic, catches most doc-drift immediately)
- **Per wave merge:** full `npm test` in `.claude/mcp/vice`
- **Phase gate:** the live exercise above (retain) or the full-absence grep sweep (remove), plus a manual read of PROJECT.md's new `FORK-01` entry against FORK-01's own literal requirement text, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] No automated check exists that PROJECT.md's `FORK-01` entry actually names `KEYBOARD_MATRIX_SET` and a reversal trigger — this is inherently a human-readable prose check, but a cheap `grep`-based smoke assertion (does the string "FORK-01" co-occur with "KEYBOARD_MATRIX_SET" in PROJECT.md) is worth adding as a regression guard, following this project's own established pattern (`docs-*.test.ts`).
- [ ] **Retain branch only:** a live fork-transport smoke test (`fork-live.test.ts`, manual-only, env-gated) does not exist and must be written to satisfy criterion 3 — see Q3 for the concrete command sequence to wrap.
- [ ] **Remove branch only:** no guard currently asserts "the fork transport is fully absent" (today it should not be — this guard would need to be *added* as part of the removal PR itself, then immediately pass, mirroring `fork-manifest-surface.test.ts`'s existing "assert an exact count" pattern but inverted to zero).

## Security Domain

`security_enforcement` is enabled (ASVS level 1) per `.planning/config.json`.
This phase's own scope is primarily a documentation/decision change; the two
branches carry different, narrow security-relevant considerations:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Neither backend has an auth layer; out of this phase's scope either way |
| V4 Access Control | Marginal — remove branch only | `DENY_LIST`'s `vice_disk_list` hazard entry (`vice.ts:9-13`) exists specifically to block a fork-only tool that crashes the shared host MCP server. On removal, this hazard tool no longer exists to guard against — the guard becomes moot, not a gap, since there is nothing left to deny |
| V5 Input Validation | No new surface | This phase adds no new tool arguments |
| V6 Cryptography | No | Not applicable to either branch |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A removal PR silently drops the `0.0.0.0`-bind exposure note without addressing it | Information Disclosure (tangential) | Out of scope for Phase 14 specifically — `QUAL-03`/`PKG-04` (Phase 16) owns the emulator control-plane exposure; a removal plan should not attempt to fix it opportunistically, per this project's own scope discipline |
| A published-package breaking change (62→fewer tools) ships as a silent patch bump | Tampering-adjacent (unexpected behavior for downstream consumers) | Explicit `[skip release]` + a deliberate major-version release note, per Q2's package-contract finding |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `keyboard_set_keyarr_any` (or a sibling VICE-core call) could also be extended to drive the RESTORE/NMI line, so a hypothetical future `KEYBOARD_MATRIX_SET`-shaped opcode might close all three hard losses rather than just the matrix-keyboard one | Q6 | If wrong, PROJECT.md's reversal-criteria entry would overstate what landing the opcode actually buys — should be phrased as closing matrix-keyboard specifically, with SID and RESTORE named as independently-required (RESTORE) or fundamentally unfixable (SID) closures |
| A2 | The fork maintainer (`barryw/vice-mcp`) has no near-term plan to abandon or diverge further from upstream VICE, i.e. retain's steady-state cost stays "near zero" as the pending todo asserts | Q3 (carrying cost) | Not checked this session (would require reaching the third-party repo's own issue tracker/commit history) — if the fork has drifted or gone stale, retain's "near zero" framing from 2026-08-11 may already be wrong |
| A3 | No shipped skill or documented workflow depends on the fork's HTTP transport ever actually completing a full round trip in production today (i.e. retain's untested-transport gap in Q3 has not silently broken) | Q3 | If a real consumer is currently running `VICE_BACKEND=fork` in production, an untested transport regression would be invisible until Phase 14's own live exercise (or a user report) surfaces it |

**Risk framing for the planner:** none of the above three assumptions is
load-bearing for FORK-01/FORK-02's own success criteria — they matter only
for how confidently the reversal-criteria wording and the retain-branch
carrying-cost framing can be stated. All three are worth a one-line caveat
in the final PROJECT.md entry rather than blocking the decision.

## Open Questions

1. **Is "remove" scoped as full deletion, or deprecate-and-default-to-stock-first?**
   - What we know: the pending todo itself raises this as its own open
     question and never answers it; deprecate-first (keep the code, flip the
     default, remove a release later) is explicitly offered as lower-risk.
   - What's unclear: whether Phase 14's `FORK-01` requirement — "answered by
     a dated decision... not retained by default" — is satisfied by a
     deprecate-first decision (which is still, technically, retaining the
     code) or requires the harder either/or the roadmap's phrasing implies.
   - Recommendation: this is exactly the call the human checkpoint in the
     plan should make explicitly, with this ambiguity named rather than
     silently resolved by whichever branch a plan happens to pick first.

2. **Does FORK-02's "route" requirement, on the remove branch, need a
   *replacement capability* or only an *honest statement of loss*?**
   - What we know: FORK-02's text says "given a route they can actually
     follow" — for SID and RESTORE, no client-side route exists at all if
     the fork is gone (Q4); for matrix keyboard, `vice_joystick_set` is a
     genuine partial route independent of the fork.
   - What's unclear: whether "a route to follow" can mean "an honest
     statement that no route exists, plus where to file an issue/whom to ask"
     — i.e. does FORK-02 require an *action* the user can take, or is a
     truthful "this is permanently gone on this backend" itself the
     satisfying route for the two totally-unrecoverable cases?
   - Recommendation: treat "honest, complete statement of the loss with no
     dangling promise of a fix" as satisfying FORK-02 for SID/RESTORE on the
     remove branch, since no actual technical route exists to offer instead
     — this matches how `capability-registry.ts`'s own `"descoped"` category
     already phrases genuinely-unbuilt (not unrecoverable) losses today.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `/usr/local/bin/x64sc` (fork build) | Criterion 3's retain-branch live exercise; the fork's `-mcpserver` flag | ✓ | VICE 3.10, fork-patched | — |
| `/usr/bin/x64sc` (genuine stock) | Not required by this phase directly (no stock-side work), but available for any cross-check | ✓ | VICE 3.9 | — |
| A reachable display/broker to run `08-HUMAN-UAT.md`-style full walkthrough | Criterion 3's live exercise, if done as a full agent-driven capture rather than a raw protocol probe | Not checked this session — this project's broker infrastructure already exists and is proven (Phase 8.1/8.2), so this is a re-use, not a new dependency | — | The raw standalone probe in Q3 (bare `x64sc -mcpserver` + a direct tool call) does not need the broker at all and is cheaper |

**Missing dependencies with no fallback:** none — both binaries needed for
either branch's validation already exist on this host.

## Sources

### Primary (HIGH confidence — read/executed this session)
- `.claude/mcp/vice/*.ts`, `*.mts` (vice.ts, vice-sync.ts, vice-probe.ts, backend-detect.mts, capability-registry.ts, broker-launch.mts, vice-broker.mts, vice-proxy.ts, stock-*.ts, fork-manifest-surface.test.ts, broker-e2e.test.ts) — read/grepped directly
- `.claude/mcp/vice/tools-manifest.json`, `tools-manifest.stock.json` — parsed and counted (62 / 38 tools)
- `scripts/check-skill-fork-honesty.mjs` — read in full
- `README.md`, `.mcp.json`, `CLAUDE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` — read in full
- `.claude/skills/c64-program-recon/references/{observation-hazards,control-flow,tool-selection,sound-and-input}.md`, `.claude/skills/c64-ram-capture/SKILL.md` — read the relevant sections
- `.planning/todos/pending/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`, `.planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` — read in full
- `.planning/notes/stock-vice-migration-revised-loss-ledger.md`, `docs/stock-vice-parity.md`, `docs/roadmap-stock-vice.md` — read in full
- https://vice-emu.sourceforge.io/vice_13.html — fetched live this session to confirm no `KEYBOARD_MATRIX_SET`-equivalent opcode exists in VICE 3.10's documented binary-monitor command set

### Secondary (MEDIUM confidence)
- `docs/phase2-backend-probe-evidence.md` — not re-read this session; treated as settled per STATE.md's own record of Phase 13's closure of its retired verdicts

### Tertiary (LOW confidence / marked `[ASSUMED]`)
- Any claim about the fork maintainer's (`barryw/vice-mcp`) future plans, activity level, or upstream-contribution likelihood — not checked against the third-party repository this session (see Assumptions Log A2)

## Metadata

**Confidence breakdown:**
- Code-surface inventory (Q1/Q2): HIGH — every figure is a file read or grep run this session
- Hard-loss routes (Q4): HIGH — every quote is read verbatim this session, cross-checked against the runtime refusal source
- Upstream coupling (Q6): MEDIUM — one authoritative live fetch confirms current absence; the closure scope (RESTORE vs. matrix-only) is not independently confirmed and is flagged as Assumption A1
- Retain/remove cost sizing (Q2/Q3): HIGH for what exists and what's missing; MEDIUM for effort estimates (no plan has yet been written to time-box the actual edit work)

**Research date:** 2026-08-22
**Valid until:** 30 days (stable domain — no external dependency is expected to change on its own; the one live-checked external fact, VICE's opcode set, changes on VICE's own release cadence, not daily)
