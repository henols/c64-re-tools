# Phase 65: Every Skill Script Through the One Endpoint, and CI With It - Research

**Researched:** 2026-09-25
**Domain:** Node.js/TypeScript MCP-server + skill-script transport migration (internal seam consolidation, no new external dependencies)
**Confidence:** HIGH for everything tagged `[VERIFIED: ...]` below (all measured this session against the real tree and/or a live broker); MEDIUM/LOW where marked, concentrated in the parts CONTEXT.md itself left to "Claude's Discretion" or to the planner's own judgment.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Thirteen decisions from five discussed areas, plus three folded todos. **One
decision went AGAINST the recommendation offered (D-07).** Its cost is
recorded verbatim from the option the owner chose. Every other decision is a
direct owner choice taken as the recommended option. None is open for
re-derivation by the researcher or the planner.

- **D-01: Each suite owns its broker.** A suite that runs a host tool through
  a skill script, or through `runHostToolFromContainer()`, starts the
  compiled broker (`resources/vice-broker.mjs`) itself, ephemeral port, temp
  `VICE_BROKER_HOME`, kills it in teardown. `ci.yml` gets no broker step,
  nothing touches port 19510. Under `VICE_REQUIRE_ACME`, a harness broker
  that fails to start is a FAIL, never a skip. Neighbouring cleanup the
  planner must decide explicitly: `skill-acme-build-cli.test.ts`'s
  `hostRouteChildEnv()` and its never-skipped contract case, and
  `ci-guardrails.test.mjs`'s workflow assertions — record what each now
  protects, or retire it, in writing.
- **D-02: With no broker running, each affected skill refuses by name, and
  its SKILL.md states the broker as a prerequisite.** Four skills affected:
  `acme-build`, `c64-disk-access`, `c64-petcat`, `c64-program-recon`
  (`packer-finding.mjs`). Reuses ENDPOINT-04's existing refusal
  (`describeDialFailure()`/`BROKER_START_COMMAND`) — do not word a second
  refusal.
- **D-03: A path-bearing input is uploaded as bytes through Phase 64's
  transfer, and the `host_tool` request names the minted handle instead of a
  path.** Not an alternative the discussion weighed — follows from the
  milestone and 64 D-01. Covers every single-file input across
  `c1541.*`/`petcat.decode`/`dxa.disassemble`/Ghidra/`oracle.run`.
- **D-04: `acme.build` uploads the source file's directory tree plus each
  `-I` tree, preserving relative layout, into a per-request broker scratch
  dir.** A `../` reference outside uploaded trees fails, naming the missing
  file and the `-I` remedy.
- **D-05: The tree walk skips dot-prefixed files/directories and refuses by
  name any symlink whose target leaves its tree.** Compare REAL paths
  (`realpathOfNearestExisting()` precedent), never lexical joins.
- **D-06: `ghidra.installExtension` installs from the broker's OWN vendored
  extension tree. The `sourceDir` wire key is removed.**
- **D-07 (AGAINST the recommendation offered): A host tool's results always
  land under the client's own `.c64-re-tools/<kind>/`, and the result
  carries that local path.** Cost quoted verbatim: "acme -o and outDir stop
  meaning anything, a visible regression for build users." Makes this phase
  the first live producer of 64 D-13's XFER-03 containment validator.
  Reversibility: one-way.
- **D-08: `acme`'s `-o`/`--out-dir` and the `outDir` argument on
  `c1541.*`/`petcat.decode`/`dxa.disassemble`/`acme.build` are REMOVED**, a
  caller who passes one gets a refusal by name. `HOST_TOOL_ARG_KEYS` and
  `HOST_TOOL_PATH_ARG_KEYS` lose the `outDir` entries;
  `host-tool.test.ts`'s census must move with them in the same change.
  Update every SKILL.md usage line and `acme.mjs:337`'s usage string too.
- **D-09: Only the declared results come back.** Everything else a tool
  produced broker-side stays there and is deleted when the request ends. The
  Ghidra project database never crosses the socket.
- **D-10: `host-tool.mts:64-65`'s byte-payload prohibition is amended.**
  Clause one survives (no inline bytes, only a handle). Clause two
  (`{path, sha256, byteLength}` where `path` is a broker path) goes stale and
  must be rewritten.
- **D-11: Phase 64's 16 MiB constant governs host-tool transfers, per file
  AND per request's upload aggregate.** Same constant, imported, not a
  second copy. No environment knob.
- **D-12: `anno` runs as a client-local CLI (`vice-mcp anno <verb>`), and its
  SQLite store stays in the project's own `.c64-re-tools`.** No broker, no
  VICE binary, no transfer, stateless. Departs from half the owner's
  original todo directive (took "stateless, off-MCP", declined "via the
  broker").
- **D-13: The 25 `anno_*` tools are deleted outright from `tools/list`, in
  the same change that moves every skill off them.** No deprecated alias.
  About 49 `anno_*` references across five skills must move to the CLI:
  `c64-memory-mapping` (14), `c64-program-recon` (20),
  `routine-queue-walker` (11), `acme-build` (2), `c64-provenance-diff` (2).
  Reversibility: one-way.

### Claude's Discretion

- How a skill script invokes the resolved module: subprocess
  (`process.execPath <resolved> run ...`, today's shape) or dynamic
  `import()`. SEAM-02 forbids changing the ladder itself.
- The `<kind>` directory names under `.c64-re-tools/` and same-name
  collision handling for results. Must go through `toolsDir()`
  (`repo-root.ts`).
- How the new fixed-endpoint `host_tool` arm coexists with the legacy
  token-gated `host_tool` op in `broker-control.mts`. Constraints: answered
  ahead of the token gate like `attach`/`transfer` (`:1320`); no single
  function with a mode flag (`broker-endpoint.ts:17-25`); carries forward
  `HOST_TOOL_REQUEST_TIMEOUT_MS` and its cross-seam ordering test.
- The staging lifetime of host-tool uploads. Skill calls hold no session
  (SESS-01) — scope it per REQUEST, make sure 64 D-07's startup sweep still
  covers it.

### Deferred Ideas (OUT OF SCOPE)

- Anno routed through the broker (the literal reading of the directive).
  Declined in D-12.
- Caller-chosen result destinations. Declined in D-07.
- `CR-01` at `text-protocol.ts:850` — carried debt, not touched here.
- **No deletion of the old seam.** `hostToolOverHostRoute()`, the two-route
  branch in `host-tool-client.ts`, `broker.json` and the token-gated legacy
  `host_tool` control op all survive until Phase 66's atomic cutover.
  Convergence metric expected **3** at exit.
- `vsf-slice.mjs` and `completeness-report.mjs` get no transport work — the
  ladder locates in-tree files, the host-tool seam is for host binaries.
- The Ghidra runs-root alias is Phase 67 (RM-06).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEAM-01 | Exactly one module owns dialling the endpoint and speaking the wire protocol; MCP server and every skill script reach the broker through it | Confirmed `broker-endpoint.ts` is that module today for the fixed-endpoint dial; `host-tool-client.ts` is the ONE dispatcher both `ghidra-run.ts`/`dxa-run.ts` (same-package import) and the four skill scripts (subprocess, via the ladder) already funnel through. No second copy found. |
| SEAM-02 | Skill scripts reach that module through the existing resolution ladder, no second copy in the skills package | `mcp-module.mjs`'s three-rung ladder is unchanged and already used by all four target skill scripts. **MEASURED this session: rung 3 (the npm-installer route) crashes today** — see Critical Finding 1. This is the dominant fact the planner needs before choosing a shape. |
| SEAM-03 | Every skill script that needs a host tool goes through the single endpoint; host and container give the same answer | `host-tool-client.ts` today branches on `isInsideContainer()` between `hostToolOverControlPlane()` (legacy broker.json dial) and `hostToolOverHostRoute()` (bare spawn). This branch must collapse to one route dialling `broker-endpoint.ts`. `stage_file`'s `ownsTarget(targetId)` gate is incompatible with a stateless (SESS-01) call — see Critical Finding 2. |
| RM-08 | CI's bare-host route for the ACME tests is replaced before the escape hatch it depends on is deleted | `.github/workflows/ci.yml`'s three ACME-touching steps identified with exact env/step names. D-01's per-suite broker harness is the mechanism; `ci-guardrails.test.mjs` (cited by CONTEXT.md as a file to reconcile) **does not exist in this tree** — see Common Pitfall 6. |
</phase_requirements>

## Summary

This phase's mechanics are well-scoped by CONTEXT.md's own thirteen decisions
— what research adds is a set of **measured, load-bearing facts** CONTEXT.md
flagged as "verify, do not assume," plus two additional defects this session
found while verifying them that CONTEXT.md did not anticipate.

The single most important finding: **the npm-installer distribution route
for `@henols/vice-mcp` is broken today, right now, independent of this
phase's own work**, for any entry point that is a raw `.ts` file resolved
from inside a real `node_modules` tree. This was measured directly: `npm
pack` + a genuine `npm install` of the tarball into a fresh project's
`node_modules`, then running `vice-cli.mjs` (the package's own `bin`) with
no subcommand, with `anno`, and by hand-invoking `host-tool-client.ts` the
exact way the four skill scripts already invoke it — every one of the three
crashed with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Only `vice-cli.mjs
broker` (which imports a compiled `.mjs` artifact) worked. This is a Node.js
design decision with no override flag (confirmed against the official
TypeScript-modules doc), so the fix is architectural: ship a compiled `.mjs`
counterpart for whatever the ladder needs to resolve on the npm-installer
route, exactly the pattern `host-tool.mts` → `resources/host-tool.mjs`
already establishes. This directly answers the "Claude's Discretion"
question about subprocess-vs-`import()` invocation shape: **the shape
(subprocess spawn of a resolved path) is unaffected either way** — the fix
has to be in what file the ladder resolves TO, not in how it is invoked.

The second major finding is a genuine architectural gap CONTEXT.md's
"per-REQUEST staging lifetime" discretion note gestures at but does not
fully spell out: the **existing** `stage_file` control op that Phase 64
built for `vice_autostart`/`vice_disk_attach`/`vice_snapshot_save`/
`vice_snapshot_load` uploads is gated on `ownsTarget(targetId)` — it requires
an already-acquired emulator lease. A skill-script host-tool call is
stateless (SESS-01) and has no `targetId` at all. The `transfer` connection
itself (the actual byte-moving primitive, authorized purely by an opaque
`handle`) is fully reusable unchanged; only the **minting** step
(`stage_file`) needs a session-free sibling.

**Primary recommendation:** Treat this phase as two layers of work that can
be sequenced independently: (1) a transport-collapse layer inside
`host-tool-client.ts`/`broker-control.mts`/`broker-endpoint.ts` that gives
every host-tool call one route regardless of host/container (SEAM-03), built
on a NEW session-free staging/result mechanism (not `stage_file`); and (2) a
packaging-fix layer that makes the ladder's target actually executable from
a real npm install (SEAM-02), which the four skill scripts, `acme-cli`
subcommand, and — if the planner chooses to touch it — the `anno` CLI itself
all depend on. Do not let (2) block (1)'s design; do not skip (2) and mark
SEAM-02 done anyway, because criterion 2 explicitly requires the installed-
package route to work, and it measurably does not today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dialling the fixed broker endpoint, classifying the handshake | Container-side client library (`broker-endpoint.ts`) | — | SEAM-01: the one module; never touches fs, never imports the legacy discovery-record dialer |
| Host-tool request dispatch (route selection) | Container-side client library (`host-tool-client.ts`) | — | Currently branches host/container; SEAM-03 collapses it to one route through `broker-endpoint.ts` |
| Host-tool execution (spawning acme/c1541/petcat/dxa/Ghidra) | Host-bound executor (`host-tool.mts` → `resources/host-tool.mjs`) | — | Runs inside the broker process, on the real host, outside any container |
| Skill-script invocation of the seam | Skills package (`src/skills/*/scripts/*.mjs`) | Resolution ladder (`mcp-module.mjs`) | Cross-package boundary: skills ship in `@henols/c64-re-tools`, the seam ships in `@henols/vice-mcp` |
| File bytes crossing the socket | Broker (`broker-transfer.mts`) + client (`stock-connect.ts`/`host-tool-client.ts`) | Byte-cap/hash primitive (`transfer-hash.mts`) | Shared, dual-shipped module (source + compiled) — no second cap constant |
| Result destination validation | Client (`transfer-paths.ts`'s `validateContainedDestination()`) | — | Pure function, no fs access, refuse-not-sanitise; already exists, has NO live caller yet |
| Annotation store (post-D-12) | Client-local CLI (`vice-proxy.ts`'s `anno` subcommand → `anno-cli.ts`) | SQLite in project's own `.c64-re-tools` | Leaves the MCP tool surface entirely; no broker involvement |
| CI's proof that host tools work without the host-route escape hatch | Per-suite test harness (D-01) | `.github/workflows/ci.yml`'s three ACME steps | Each suite starts/stops its own ephemeral broker; nothing touches port 19510 |

## Critical Finding 1: The npm-installer route is broken today for every raw-`.ts` entry point reached through `node_modules`

**[VERIFIED: measured this session, Node v24.20.0]**

Reproduced with a **genuine** install, not a synthetic stand-in:

```bash
# From src/mcp/vice/
npm pack --pack-destination /tmp/scratch
# In a fresh throwaway project:
npm install /tmp/scratch/henols-vice-mcp-0.0.0-dev.tgz
node node_modules/@henols/vice-mcp/vice-cli.mjs < /dev/null
```

Output:
```
vice-cli: Stripping types is currently unsupported for files under node_modules, for "file:///.../node_modules/@henols/vice-mcp/vice-proxy.ts"
```

Exit code 1. The SAME crash reproduces for:
- `node node_modules/@henols/vice-mcp/vice-cli.mjs anno list-verbs` (the exact
  `npx -y @henols/vice-mcp anno <verb>` invocation D-12 and `NPX_INVOCATION`
  in `anno-cli.ts:181` depend on)
- `node node_modules/@henols/vice-mcp/host-tool-client.ts run --tool acme.build --args '{}'`
  — the **exact** pattern `acme.mjs`/`c1541.mjs`/`petcat.mjs`/
  `packer-finding.mjs` already use today via `mcp-module.mjs`'s ladder
  (`spawn(process.execPath, [resolved, "run", "--tool", ..., "--args", ...])`)

Only `node node_modules/@henols/vice-mcp/vice-cli.mjs broker --help` worked
(it dynamically imports the already-compiled `resources/vice-broker.mjs`).

`[CITED: nodejs.org/docs/latest-v24.x/api/typescript.html, and the tracking
issue nodejs/node#57215]` — this is Node's deliberate design decision to
refuse type-stripping any `.ts`/`.mts` file whose resolved path contains a
`node_modules` path segment, "to discourage publishing TypeScript packages."
There is **no flag to enable it for `node_modules`** — `--no-strip-types`
only *disables* stripping everywhere, it does not narrow the restriction.
The only documented remedy is to ship compiled JavaScript. This applies
equally whether the file is reached via a static import, a dynamic
`import()`, or as the direct process entry point (`node <path>`) — the error
comes from the ESM loader's translator layer, not from any one call style.

**Why the existing "route-agreement" proof from Phase 64 did not catch
this:** `.planning/phases/64-files-as-bytes-both-directions/evidence/
64-g641-state-dir-agreement.md` records an `npm pack` + extract + import
check, but it extracted the tarball into a **plain scratch directory** (not
literally named `node_modules`) with `node_modules` **symlinked in
separately** for `@mastra/mcp`'s own dependency resolution. The package's own
files therefore never sat under a path containing the literal segment
`node_modules`, so that check could not have observed this restriction. Its
own evidence file explicitly recommends (but does not build) "a committed
tarball-closure test... run in CI on every change" — this phase or a
follow-up is a natural home for that, scoped correctly this time (a real
`npm install` of the tarball as a dependency, not an extract-beside-a-
symlink).

**Consequence for CLAUDE.md's own claim.** CLAUDE.md and `vice-proxy.ts:
198-206`'s own comment assert `vice-mcp anno <verb>` is "the ONLY surface
that resolves identically on the plugin route and both npm-installer
routes." That claim is about path **resolution**, and on that narrow reading
it may still be true (the path IS found). But the surface does not
**execute** on a real npm-installer route today — it resolves to a path that
then crashes. D-12's own premise ("The CLI is that surface") rests on this
being a working route. **This is a fact for the planner to weigh, not a
license for me to override D-12** — CONTEXT.md's own rule states a
constraint discovered outside the offered options must be written down
rather than silently substituted.

**Recommended shape (MEDIUM confidence, consistent with existing
convention):** Whatever file the ladder resolves to on rung 3 must be
compiled JavaScript, not raw `.ts`. `transfer-hash.mts` already establishes
the "ship both a raw source file (`.mts` in `files[]`, used in-repo) and a
compiled counterpart under `resources/` (used cross-package / cross-install)"
pattern — `broker-transfer.mts` imports the compiled
`./transfer-hash.mjs`; `stock-connect.ts` imports the raw `./transfer-hash.mts`.
The same split could apply to whatever CLI-invocable entry point the four
skill scripts spawn: keep `host-tool-client.ts`'s value-export surface
(`runHostToolFromContainer()`) as plain `.ts` for `ghidra-run.ts`/
`dxa-run.ts`'s same-package import, and compile a CLI-entry counterpart into
`resources/` (added to `build.ts`'s `HOST_BOUND_ARTIFACTS` and
`tsconfig.build.json`'s `include`), with the ladder's callers in the four
skill scripts requesting that compiled filename instead of
`"host-tool-client.ts"`. This changes the **filename argument** passed to
`resolveMcpModule()`, not the ladder's three-rung mechanism — SEAM-02's "no
changing the ladder" constraint is about the mechanism, and this stays
inside it. Whether to ALSO fix the `anno` CLI's own crash (out of Phase 65's
named requirements, but load-bearing for D-12) is a decision the planner
should surface explicitly rather than silently absorb or silently ignore.

## Critical Finding 2: `stage_file`'s `ownsTarget(targetId)` gate does not fit a stateless host-tool call

**[VERIFIED: read this session, `broker-control.mts`]**

The existing Phase 64 upload-staging op:

```ts
// broker-control.mts:1730-1758 (abridged)
} else if (req.op === "stage_file") {
  const targetId = typeof req.target_id === "string" ? req.target_id : "";
  const slot = typeof req.slot === "string" ? req.slot : "";
  if (targetId === "" || slot === "") { /* bad_request */ }
  if (!ownsTarget(targetId)) { /* denied */ }
  const stageOutcome = opts.onStageFile(targetId, slot);
  // -> { kind: "file_staged", handle, emulator_filename }
```

`onStageFile?: (targetId: string, slot: string) => StageFileOutcome` is
keyed on `(targetId, slot)` and its success reply carries `emulator_filename`
— a VICE-side filename meaningful only to an already-acquired emulator
instance. This is the mechanism `vice_autostart`/`vice_disk_attach`/
`vice_snapshot_save`/`vice_snapshot_load` use, and every one of those tools
runs over an MCP connection that already holds a grant (`targetId`) from an
`acquire` op.

A host-tool call from a skill script is stateless (SESS-01): it never
acquires an emulator, so it has **no `targetId`** to present to
`ownsTarget()`. The current `stage_file` op therefore cannot be reused
as-is.

**What IS reusable unchanged:** the actual byte-moving `transfer` op and its
container-side dial primitive, `dialFileTransfer()` (`broker-endpoint.ts`).
`transfer`'s dispatch arm (`broker-control.mts:1433-1476`) checks nothing
but the presented `handle` string — no `ownsTarget()` call anywhere in that
arm. The handle-only authority is already the established pattern for
`attach` too (G-64-1, owner decision 5). This means the fix is scoped
narrowly: a **new minting op** (not a new byte-transport op) that produces a
handle without requiring `ownsTarget(targetId)` — most naturally dispatched
alongside the new fixed-endpoint `host_tool` arm itself, since both are
stateless and unauthenticated by design (SESS-01, D-02's "no client spawns
it" model already accepts an unauthenticated loopback+bridge bind for this
whole milestone, REQUIREMENTS.md Settled design decision 5).

**Consequence for the "staging lifetime" discretion note.** CONTEXT.md says
"scope it per REQUEST, and make sure 64 D-07's startup sweep still covers
it." The startup sweep (`sweepOrphanedStaging()`, run once at broker startup
per `vice-broker.mts`'s `run()`) operates on the staging **directory tree**
under `brokerStagingDir()` — it is not itself keyed on `targetId` vs.
per-request, so it should cover a new per-request staging area without
change, AS LONG AS the new mechanism stages files under the same root
`brokerStagingDir()` resolves (not a new, unswept location). This is a
planner-level design decision, not something I resolved — flagged here so
the plan states it explicitly rather than discovering the sweep gap during
execution.

## Standard Stack

This phase adds **no new external dependency of any kind** — it is entirely
internal transport/CLI consolidation using modules already in this tree
(`broker-endpoint.ts`, `broker-control.mts`, `host-tool.mts`,
`host-tool-client.ts`, `transfer-hash.mts`, `transfer-paths.ts`,
`mcp-module.mjs`). No `npm install` of any kind is implicated.

### Package Legitimacy Audit

**Not applicable — no external packages are installed by this phase.** The
only "installation" concept in play is this project's OWN published
packages (`@henols/vice-mcp`, `@henols/c64-re-tools`) being resolved from
`node_modules` after a real `npm install`/`npx` by an end user, which is
exactly the scenario Critical Finding 1 measured directly against the
project's own build output — not a third-party dependency question.

## Architecture Patterns

### System flow: today vs. target for a skill-script host-tool call

```
TODAY (SEAM-03 violated):
  skill script (acme.mjs)
    -> mcp-module.mjs ladder -> resolves host-tool-client.ts
    -> spawn(process.execPath, [resolved, "run", --tool, --args])
    -> host-tool-client.ts's runHostToolFromContainer()
         isInsideContainer()?
           YES -> hostToolOverControlPlane()  [dials broker.json's control_port+control_token]
           NO  -> hostToolOverHostRoute()      [direct spawn of resources/host-tool.mjs, SAME PROCESS TREE, no broker at all]
                                                  ^-- THIS is the route SEAM-03 forbids: it "depends on running on the host"

TARGET (SEAM-03 satisfied):
  skill script (acme.mjs)   [UNCHANGED invocation shape]
    -> mcp-module.mjs ladder [UNCHANGED, SEAM-02]  -> resolves <compiled CLI entry>
    -> spawn(process.execPath, [resolved, "run", --tool, --args])
    -> host-tool-client.ts's runHostToolFromContainer()
         ONE route, always: dial broker-endpoint.ts's fixed-endpoint host_tool arm
           -> mint per-request staging handle (new, session-free op)
           -> upload input bytes over dialFileTransfer() [UNCHANGED primitive]
           -> host_tool request names the handle, not a path
           -> broker executes on the HOST, inside the SAME process that always ran it
           -> download declared results over dialFileTransfer() [UNCHANGED primitive]
           -> client validates each destination via validateContainedDestination()
              and writes under toolsDir()/<kind>/
```

### Recommended module-responsibility boundary (do not blur)

```
broker-endpoint.ts   -- dials, classifies handshake, hello/attach/transfer
                         primitives. Gains: a host-tool dial function
                         paralleling dialFileTransfer(), OR the new staging-
                         mint op rides the same connection shape.
host-tool-client.ts  -- ROUTE SELECTION collapses to one branch. Loses:
                         isInsideContainer() branch, hostToolOverHostRoute()'s
                         role as a LIVE route (it survives dormant, per
                         "explicitly NOT in this phase", until Phase 66).
broker-control.mts   -- gains the new pre-token-gate host-tool arm(s),
                         alongside (not blended with) the legacy post-gate
                         host_tool op.
host-tool.mts        -- executor, mostly unchanged; result-shape amendment
                         (D-10), workspace-path resolution replaced by
                         handle-naming for inputs (D-03), outDir removed
                         (D-08).
transfer-paths.ts     -- validateContainedDestination() gets its FIRST live
                         caller here (D-07). transferKindDir() likewise.
mcp-module.mjs       -- UNCHANGED (SEAM-02). Only the fileName argument
                         callers pass to resolveMcpModule() may change.
```

### Pattern: dual-shipped module (source + compiled), no second copy

**Example — already established, reuse for the 16 MiB cap (D-11) and,
tentatively, for whatever CLI entry point fixes Critical Finding 1:**

```ts
// Source: src/mcp/vice/transfer-hash.mts:37 [VERIFIED: read this session]
export const TRANSFER_MAX_BYTES = 16 * 1024 * 1024;
```

Consumed on the broker (host-bound) side via the **compiled** artifact:
```ts
// src/mcp/vice/broker-transfer.mts:60
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES, type ExpectedTransfer } from "./transfer-hash.mjs";
```
Consumed on the container (client) side via the **raw source**:
```ts
// src/mcp/vice/stock-connect.ts:83
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES } from "./transfer-hash.mts";
```
`transfer-hash.mts` is listed in BOTH `package.json`'s `files[]` (raw source,
container-side ships it) AND `build.ts`'s `HOST_BOUND_ARTIFACTS` (compiled
into `resources/transfer-hash.mjs`). This answers CONTEXT.md's Item 3
directly: import `TRANSFER_MAX_BYTES` the same way for D-11 — no new
constant, no new copy.

### Pattern: pre-token-gate op, authorized by handle alone

```ts
// broker-control.mts:1361 region — the `attach` arm, and :1433 — the
// `transfer` arm — BOTH answered before the token check at :1494-1497.
// The NEW host-tool arm(s) this phase adds should follow the SAME
// positioning (ahead of the token gate) and the SAME handle-only
// authorization model, per D-02/G-64-1 owner decision 5.
if (req.op === "attach") { /* ... */ }
if (req.op === "transfer") { /* ... handle-only, no ownsTarget() call ... */ }
// >>> a NEW arm belongs here, ahead of the token gate <<<
// ... (token check at :1494) ...
if (req.op === "host_tool") { /* THE LEGACY op — token-gated, post-gate, untouched by Phase 65 per "explicitly NOT in this phase" */ }
```

**Open structural question for the planner (not resolved here on purpose):**
`ControlRequestKind`'s union (`broker-control.mts:134`) already contains the
literal `"host_tool"`, consumed by the LEGACY arm at `:1507`. A new arm
placed earlier in the `handleLine()` function using the SAME string literal
would shadow the legacy arm entirely for every request — not "coexist" with
it in any meaningful sense — unless the new arm's own condition is more
specific (e.g., checks for a `handle` field the legacy op never carries, and
falls through when absent). CONTEXT.md's phrase "no single function with a
mode flag" forbids blending the two IMPLEMENTATIONS; it does not by itself
resolve whether the two arms share one wire op NAME. This is exactly the
kind of constraint-outside-the-offered-options CONTEXT.md's own rule asks to
be written down rather than quietly resolved — the planner must pick and
record a wire-op naming scheme (a distinct op literal such as
`"host_tool_stateless"`, or a same-literal-with-field-discriminator design)
explicitly.

### Pattern: refuse-not-sanitise destination validation

```ts
// src/mcp/vice/transfer-paths.ts:83 [VERIFIED: read this session]
export function validateContainedDestination(candidate: string, rootDir: string): ContainedDestinationResult {
  // 6 checks, in order: NUL byte, empty, "." or "..", a ".." SEGMENT,
  // isAbsolute(), then a literal "/" or "\" anywhere in the candidate.
  // Pure -- no fs access. Already exists; "has NO live caller in this
  // phase [64] -- its first real caller is Phase 65" (the function's own
  // doc comment, verbatim).
}
export function transferKindDir(kind: string): string {
  return join(toolsDir(), kind);
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialling the broker / classifying a handshake | A second dialer inside `host-tool-client.ts` | `broker-endpoint.ts`'s `dialBrokerEndpoint()`/`dialFileTransfer()` | SEAM-01's whole point; this file's own header explicitly forbids a second copy, citing `mcpHost()`'s three-copy incident by name |
| Byte-count + digest streaming | A new `Transform` in `host-tool.mts` or `host-tool-client.ts` | `transfer-hash.mts`'s `createHashAndCountTransform()` | Already OOM-safe (never buffers the whole payload), already the one place the 16 MiB cap is written down |
| Destination-name safety | A new sanitiser/regex in `host-tool.mts` | `transfer-paths.ts`'s `validateContainedDestination()` | Already exists, already pure/testable, already the D-13 (Phase 64) decision — REFUSE, never sanitise |
| Resolving a module across the `src/mcp/vice/` ↔ `src/skills/` package boundary | A fourth copy of the three-rung lookup | `mcp-module.mjs`'s `resolveMcpModule()` | This file's own header names the exact incident (`vsf-slice.mjs` + two soon-to-migrate scripts) that motivated extracting it |
| Realpath-based symlink-escape checking | A new ad hoc `fs.realpathSync` walk for D-05's symlink refusal | `host-tool.mts`'s `realpathOfNearestExisting()` (already used by `resolveWorkspacePath()`) | Same lesson this file's own header already records: a lexical prefix check is defeated by a planted symlink, MEASURED once already in this project |

**Key insight:** almost everything this phase needs already exists as a
tested primitive from Phases 62-64 — `dialFileTransfer()`,
`awaitTransferComplete()`, `validateContainedDestination()`,
`createHashAndCountTransform()`/`TRANSFER_MAX_BYTES`, the ladder. The
genuine NEW work is narrow: (a) a session-free staging-mint op, (b) the
host-tool-client.ts route collapse, (c) whatever fixes Critical Finding 1,
(d) the D-01 per-suite broker harness, (e) the D-12/D-13 anno migration.
Building a new primitive for any of (a)-(c) where an existing one already
does the job is the actual hand-rolling risk here, not the reverse.

## Runtime State Inventory

This phase is not a pure rename, but D-12/D-13 (folding the `anno_*` tool
family into a client-local CLI) genuinely relocates a runtime capability, so
this inventory applies to THAT sub-scope.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None found.** The annotation SQLite store's on-disk location is unchanged by D-12 — it "stays in the project's own `.c64-re-tools`" (CONTEXT.md, verbatim). `anno-store.ts` is untouched by this phase's own decisions. | None — code edit only (how the store is REACHED changes; where it lives does not) |
| Live service config | **None found.** No external service (n8n, Datadog, Tailscale, Cloudflare Tunnel) references `anno_*` tool names or the MCP tool surface. | None |
| OS-registered state | **None found.** No systemd unit, launchd plist, or Task Scheduler entry names an `anno_*` tool. | None |
| Secrets / env vars | **None found.** No env var or SOPS key references an `anno_*` tool name by exact string. | None |
| Build artifacts / installed packages | The 25 `anno_*` tool registrations in `vice-proxy.ts:1608-1609`'s loop (`ANNO_TOOL_DEFINITIONS`) are a code construct, not an installed artifact — deleting the loop removes them from `tools/list` immediately on next server start, no stale cache anywhere. `tools-manifest.stock.json` never listed them (confirmed by the existing test `stock-dispatch.test.ts:1472`, "every curated anno_* name is absent from the STOCK manifest — served proxy-locally, in neither manifest, by design"). | Code edit only — delete the registration loop and its import; no separate artifact to rebuild beyond the normal `resources/*.mjs` regeneration if any `.mts` touched by this phase changes |

**Canonical question answered:** after `vice-proxy.ts`'s `anno_*`
registration loop is deleted, nothing else in the tree still has the old
tool names cached, stored, or registered — the tool surface is generated at
process start from `ANNO_TOOL_DEFINITIONS`, with no persisted manifest
snapshot of the curated set anywhere (unlike `tools-manifest.stock.json`,
which is a **committed** snapshot but explicitly never contains these
names).

## Common Pitfalls

### Pitfall 1: Treating "resolves" as "works" for the npm-installer route
**What goes wrong:** SEAM-02's success criterion says the ladder must
resolve "from an in-repo checkout and from an installed package alike."
`resolveMcpModule()` genuinely DOES find a path on rung 3 today (confirmed:
`require.resolve()` succeeds) — but the file it finds crashes on execution.
**Why it happens:** `resolveMcpModule()` only checks `existsSync()`; it has
no opinion about whether Node can actually load the file.
**How to avoid:** Any plan claiming SEAM-02 is satisfied must include an
actual **execution** proof against a real `npm install`ed tarball (the
Critical Finding 1 reproduction above), not just a path-resolution test —
`mcp-module.test.mjs`'s existing tests only assert path resolution.
**Warning signs:** A plan that only runs `mcp-module.test.mjs` (path-only)
and calls SEAM-02 done.

### Pitfall 2: Reusing `stage_file` for a stateless host-tool upload
**What goes wrong:** `stage_file` requires `target_id`/`ownsTarget()`. A
skill-script call has no target. A naive port of D-03/D-04's upload flow
onto the existing `stage_file` op will refuse every call with `denied`.
**Why it happens:** `stage_file`/`transfer` look like a generic "upload a
file" pair at a glance; only `stage_file`'s narrow `(targetId, slot)` keying
reveals it is session-scoped.
**How to avoid:** Design a session-free minting op (or fold minting into the
new host-tool request itself) rather than trying to make the skill script
"borrow" a session it doesn't have.
**Warning signs:** A plan task that says "call stage_file from the skill
script's own upload path" without addressing where `targetId` comes from.

### Pitfall 3: Colliding wire-op literals in `broker-control.mts`
**What goes wrong:** `ControlRequestKind` already contains `"host_tool"` for
the legacy, post-gate, token-checked op. A new pre-gate arm using the SAME
literal string will intercept every `host_tool` request — including ones a
future caller might still send with a valid token — because `handleLine()`
dispatches top-to-bottom on exact string equality and the earlier `if` wins.
**Why it happens:** "the new arm is answered ahead of the token gate, like
attach/transfer" (CONTEXT.md) is easy to read as "give it the op name
`host_tool` too."
**How to avoid:** Decide and record a distinct wire vocabulary for the new
arm (a new op literal, or a field-based discriminator checked BEFORE
falling through to the legacy arm) — do not let this be an implicit,
undiscussed side effect of dispatch ordering.
**Warning signs:** A diff that adds an `if (req.op === "host_tool")` block
ABOVE the existing token-gate check without also touching the existing
`:1507` block's own condition.

### Pitfall 4: Conflating `HOST_TOOL_REQUEST_TIMEOUT_MS`'s cross-seam ordering rule
**What goes wrong:** `host-tool-client.ts`'s `HOST_TOOL_REQUEST_TIMEOUT_MS`
table (client-side request deadline) must stay strictly greater than
`host-tool.mts`'s own per-tool timeout (server-side execution budget) for
the SAME tool id — enforced today by `host-tool.test.ts`'s cross-seam
ordering test, which imports both sides and iterates every tool id. If the
new fixed-endpoint route introduces a SECOND client-side timeout (e.g., a
connection-level timeout in `broker-endpoint.ts` distinct from the existing
table), it is easy to leave the new timeout unordered against the server
budget.
**Why it happens:** Two processes, two files, no shared value — only a test
keeps them from drifting.
**How to avoid:** Any new timeout constant this phase introduces for the
host-tool route must be added to that SAME ordering test, not left to the
existing one by coincidence.
**Warning signs:** A new `setTimeout(..., someNewConstant)` in the
host-tool dial path with no corresponding entry in
`host-tool.test.ts`'s cross-seam test.

### Pitfall 5: Assuming the outDir removal (D-08) is a small textual change
**What goes wrong:** `outDir` is threaded through THREE tables
(`HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`) across SIX tool ids
(`acme.build`, `dxa.disassemble`, `c1541.bam`/`dir`/`entry`/`chain`/`read`,
`petcat.decode` — `[VERIFIED: read this session, host-tool.mts:254-370]`),
PLUS every tool's own per-id args type (each carries its own `outDir?:
string` field), PLUS `acme.mjs:337`'s usage string, PLUS every affected
SKILL.md's documented usage line, PLUS `host-tool.test.ts`'s "both
directions" census (which the plan must keep in sync in the SAME change per
D-08's own text).
**Why it happens:** it reads like one decision but touches ~6 tool ids × ~3
locations each.
**How to avoid:** Enumerate every `outDir` occurrence via `grep -n
"outDir" src/mcp/vice/host-tool.mts` as a plan-time checklist rather than
relying on memory.
**Warning signs:** A plan task list with fewer than ~6 distinct edit sites
for D-08.

### Pitfall 6: `ci-guardrails.test.mjs` does not exist
**What goes wrong:** CONTEXT.md instructs, twice, that the planner must
"record what [`ci-guardrails.test.mjs`'s workflow assertions] now protect,
or retire it, in writing." **[VERIFIED: measured this session]** — no file
named `ci-guardrails.test.mjs` exists anywhere in this repository
(`find . -iname "*ci-guardrails*"` returns nothing under `src/`,
`installer/`, or anywhere else tracked). The only in-tree reference is a
**comment** inside `src/mcp/vice/vice-proxy.test.ts:207` that itself names
`ci-guardrails.test.mjs` as the file that "fails if that ledger and this
file's actual state ever drift apart" — i.e., the comment cites a file that
is not present.
**Why it happens:** unknown — either the file was renamed/deleted without
this comment being updated, or it was planned and never created. Either way
this is a stale citation, both in `65-CONTEXT.md` and in the comment it
appears to have been copied from.
**How to avoid:** The plan cannot "retire" or "update" a nonexistent file.
The planner must decide: (a) treat the comment in `vice-proxy.test.ts:207`
itself as the thing to correct (it references a phantom guard), or (b)
build the missing guard now since D-01's per-suite broker harness is exactly
the kind of workflow-shape change such a guard would want to catch, or (c)
explicitly note this as an unrelated pre-existing documentation defect out
of this phase's scope and move on. Silently treating CONTEXT.md's citation
as accurate (e.g., writing a plan step "update `ci-guardrails.test.mjs`")
will fail at execution time against a file that is not there.
**Warning signs:** Any plan task path naming `ci-guardrails.test.mjs`
without first re-verifying it exists.

### Pitfall 7: The D-01 broker-boots-without-x64sc claim is TRUE but not for the reason first assumed
**What goes wrong:** the absence of a `WARNING` line in the broker's startup
stderr does not by itself prove x64sc was found — `resolvedBackend()`'s
`locationRefusal` field (the thing that WOULD print a warning) is only
populated when an EXPLICIT environment-variable override was refused by the
tool-location seam; a plain "not found on PATH" case leaves
`locationRefusal: null` and prints the SAME `backend "stock" (binary:
x64sc)` line whether or not the binary was actually located
(`binPathFields()` falls back to the literal string `"x64sc"` either way).
**Why it happens:** the log line's wording is identical in the
found/not-found cases; only `resolvedPath`'s internal nullness (never
logged directly) differs.
**How to avoid:** the D-01 probe (reproduced live this session, see
Verification below) additionally proved the broker answers a REAL `hello`
AND a REAL `host_tool` request end-to-end with PATH stripped of every
directory that carries `x64sc` on this host — that is the stronger,
correct proof CONTEXT.md actually needs, and it is confirmed, not merely
the absence-of-warning inference.
**Warning signs:** A verification step that only greps broker startup
stderr for the word "WARNING" and calls D-01 proven.

## Code Examples

### Verified: broker boots and answers with no `x64sc` reachable (D-01)

Reproduced live this session (ephemeral port, temp `VICE_BROKER_HOME`, PATH
stripped of `/usr/local/bin`, `/usr/bin`, `/bin` — the three locations
`x64sc` occupies on this host per the user's own note):

```
$ env -i PATH="<node-only path>" HOME=<scratch> VICE_BROKER_HOME=<scratch> \
    VICE_BROKER_CONTROL_PORT=0 node resources/vice-broker.mjs --repo-root <scratch>
...
vice-broker: backend "stock" (binary: x64sc)
vice-broker: bound control listener on: 127.0.0.1, 172.25.0.1, 172.17.0.1 (port 33695)
vice-broker: wrote <scratch>/supervisor/broker.json ...
```
Then, dialled directly over the bound port:
```
--> {"op":"hello"}
<-- {"kind":"hello","protocol":"vice-mcp-broker-hello-v1","version":"0.0.0-dev","tag":"control"}
--> {"op":"host_tool","id":"probe2","token":"<real token from broker.json>","tool":"acme.build","args":{"source":"nope.a"}}
<-- {"ok":true,"tool":"acme.build","exitStatus":1,"results":[],"stderrTail":"Error: Cannot open toplevel file \"/tmp/.../nope.a\".\n"}
```
The broker never crashed, never refused to bind, and correctly executed the
`host_tool` control op end to end (a real ACME invocation, real non-zero
exit, real error text) — with `x64sc` unreachable on `$PATH` throughout.
This directly confirms `vice-broker.mts:2257-2281`'s `resolvedBackend()`
writing to stderr without throwing, as CONTEXT.md expected.
`[VERIFIED: measured this session]`.

### Verified: the ladder's rungs, unchanged target for SEAM-02

```js
// Source: src/skills/c64-ram-capture/scripts/mcp-module.mjs:112-138 [VERIFIED: read this session]
function ladder(fileName) {
  const rungs = [];
  // 1. VICE_MCP_DIR override
  // 2. in-repo relative path (walks up to an ancestor "skills" dir, then to mcp/vice)
  // 3. require.resolve(`${TARGET_PACKAGE}/${fileName}`) against @henols/vice-mcp
  return rungs;
}
```
Every one of the four target skill scripts already calls this with
`HOST_TOOL_CLIENT_FILE = "host-tool-client.ts"` — `acme.mjs:37`,
`c1541.mjs:39`, `petcat.mjs:37`, `packer-finding.mjs:134`
`[VERIFIED: read this session]`. This confirms the "how does a skill script
invoke the resolved module" discretion question is **already answered by
existing, working (in-repo) precedent** — subprocess spawn via
`process.execPath`. The open question is narrowly about what file name to
resolve, not how to invoke it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Host-tool call dials `broker.json`'s discovered `control_port`/`control_token`, or spawns `resources/host-tool.mjs` directly on the host | Dials the FIXED endpoint (port 19510, loopback + enumerated bridge gateways) via `broker-endpoint.ts`, no discovery file, no per-instance token | Phase 62 (the endpoint), this phase (the host-tool call itself) | No `broker.json` dependency for this call path; works identically inside a devcontainer with no bind mount |
| A host-tool call's path-bearing arguments are workspace-relative, resolved server-side against `--repo-root` | Path-bearing inputs are uploaded as bytes; the request names an opaque handle | This phase (D-03) | No shared filesystem assumption; `resolveWorkspacePath()`'s role for inputs is replaced (its role for OTHER things, if any survive, is a plan-level question) |
| A host-tool result's `path` field is a broker-side (container-translated) path | Result bytes download over the transfer connection; the client validates and writes under its OWN `.c64-re-tools/<kind>/` | This phase (D-07/D-09/D-10) | `-o`/`outDir` on four skill scripts stop meaning anything — a stated, accepted regression |
| 25 `anno_*` tools are MCP tools proxied through `vice-proxy.ts` | `vice-mcp anno <verb>` is a client-local CLI subcommand, no MCP tool registration at all | This phase (D-12/D-13) | Five skills' ~49 `anno_*` references migrate to CLI invocations; `tools/list` shrinks by 25 |

**Deprecated/outdated:** the `anno_*` MCP tool family is removed outright
(no alias period — v2.0.0 is a major version, deliberate owner choice).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Compiling a CLI-entry counterpart of `host-tool-client.ts` into `resources/*.mjs` (mirroring `transfer-hash.mts`'s dual-shipping pattern) is the correct fix for Critical Finding 1, rather than some other packaging change | Critical Finding 1 / Standard Stack | If wrong, the planner designs the wrong fix and SEAM-02's install-route criterion stays unmet after the phase closes; this is explicitly flagged as MEDIUM confidence, not a locked recommendation |
| A2 | The new session-free host-tool staging/minting op should be dispatched on the SAME control connection as the new fixed-endpoint `host_tool` request, rather than as a wholly separate connection type like `attach`/`transfer` | Critical Finding 2 | If wrong, the planner may build an extra connection round-trip that isn't needed, or miss that the existing `transfer` connection's dial function (`dialFileTransfer()`) is fully reusable as-is |
| A3 | The wire-op-literal collision in Pitfall 3 requires a NEW literal (not a same-literal-with-discriminator design) | Common Pitfall 3 | Low risk either way — both are workable; flagged as an explicit decision point, not asserted as the only correct answer |
| A4 | Whether to fix the `anno` CLI's own `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` crash is in scope for THIS phase (vs. a separate pre-existing-defect todo) | Critical Finding 1 | If treated as in-scope when the owner intended it out-of-scope (or vice versa), either wasted work or a phase that silently ships D-12 on a broken foundation |

**None of these are compliance, retention, or security-standard claims** —
they are architectural-shape recommendations the planner should confirm
against the owner's own preference, consistent with this project's standing
"point-of-use refusals, not doctor commands" preference and its general
pattern of the owner making final calls on load-bearing design questions.

## Open Questions

**Resolved at plan time (orchestrator seat, 2026-09-25):**
- Question 1 is answered by the owner as `65-CONTEXT.md` **D-14**: Phase 65
  fixes the npm-installed route for the four host-tool skill scripts only.
  The MCP server's and the anno CLI's npm route are out of scope and go to a
  follow-up todo.
- Question 3 is answered by git history.
  `git log --all --oneline -- '**/ci-guardrails*'` names
  `276c15c9 test(260914-poo): delete 43 non-qualifying tests and module-classification.ts`
  as the commit that deleted the file. The references in `65-CONTEXT.md`
  (D-01) and in the comment at `src/mcp/vice/vice-proxy.test.ts:207` point at
  a guard that no longer exists.

1. **Should Phase 65 also fix the `anno` CLI's own npm-installer crash?**
   - What we know: D-12/D-13 build the new `anno` CLI surface ON TOP OF a
     route (`npx -y @henols/vice-mcp anno <verb>`) that is measurably broken
     today for the same root cause as the skill-script ladder issue.
   - What's unclear: whether the owner considers this "the same bug, fix it
     once" or "a separate, larger, pre-existing defect outside SEAM-01..03's
     stated text."
   - Recommendation: surface explicitly in planning/discussion rather than
     silently deciding either way; the fix (compile a `.mjs` entry point) is
     likely small if bundled with the Critical Finding 1 fix, but scope
     creep risk is real given how large this phase already is.

2. **What wire-op vocabulary does the new pre-gate host-tool arm use?**
   - What we know: `"host_tool"` is taken by the legacy op; `attach`/
     `transfer` establish the pre-gate, handle-only-authority precedent.
   - What's unclear: a new literal name, or a discriminator-based shared
     literal — CONTEXT.md's "no mode-flag function" rule constrains the
     implementation, not the wire vocabulary.
   - Recommendation: the plan should name this explicitly as its own small
     decision, citing this research's Pitfall 3.

3. **Does the D-01 per-suite broker harness need a NEW guard test (Pitfall
   6), or is `ci-guardrails.test.mjs` simply a stale citation to correct?**
   - What we know: the file does not exist; only a comment references it.
   - What's unclear: whether a mechanical CI-workflow-assertion guard ever
     existed and was deleted, or was aspirational from the start.
   - Recommendation: `git log --all --oneline -- '**/ci-guardrails*'` (not
     run this session — a fast, safe check for the planner or an executor to
     run) would settle which case this is before deciding what to do about
     the dangling comment.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 24 | Type-stripping the whole container-side tree | ✓ | v24.20.0 (measured this session) | — |
| `x64sc` (stock VICE) | Broker startup identity resolution (not required for host-tool ids themselves) | ✓ (3 locations: `/usr/local/bin`, `/usr/bin`, `/bin` per standing user note) | 3.9 / 3.10 depending on path | Broker boots and answers regardless (D-01, verified) |
| ACME cross-assembler | `acme.build` host-tool id, CI's ACME steps | ✓ (`/home/henrik/.local/bin/acme`, ACME 0.97 "Zem" per CLAUDE.md) | 0.97 | — |
| `c1541`/`petcat` | `c1541.*`/`petcat.decode` host-tool ids | Not probed this session (unaffected by this phase's own decisions beyond arg-shape changes) | — | Resolved as siblings of `x64sc` per `findSiblingBinary()`, unchanged by this phase |
| GitHub Actions runner (CI) | RM-08's own subject | N/A (CI environment, not this machine) | ubuntu-latest per `ci.yml` | D-01's harness is designed specifically to work on a bare runner with no VICE preinstalled |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** none identified — every dependency
this phase touches is either already present on this dev host or is
explicitly designed (D-01, D-02) to degrade to a named refusal rather than
silently fail.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` |
| Config file | none — `package.json`'s `"test": "node --test '*.test.*'"` (`src/mcp/vice`); the skills tree runs via `node --test 'src/skills/*/scripts/*.test.mjs'` |
| Quick run command | `node --test <specific-file>.test.ts` |
| Full suite command | `npm test` (the wide glob CI uses, per its own documented rationale) from `src/mcp/vice`; `npm run test:automated` is the narrower local/dev-ergonomics subset |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEAM-01 | Exactly one module dials the endpoint | structural/census | `node --test broker-endpoint.test.ts` (existing) + a new census assertion (no second copy) | ✅ existing file, gap in the specific census |
| SEAM-02 | Ladder resolves on both distribution routes, real execution not just path resolution | integration | `node --test mcp-module.test.mjs` (existing, path-only) — **needs a NEW real-`npm install` execution test per Critical Finding 1** | ✅ existing (path-only) / ❌ execution case, Wave 0 |
| SEAM-03 | Host-tool call gives the same answer in container and on host | integration, broker-backed | `node --test host-tool-transport.test.ts` (existing, control-plane route) + new same-route-from-host case | ✅ existing (control-plane) / ❌ collapsed single-route case, Wave 0 |
| RM-08 | CI's ACME tests pass without the host-route escape hatch | CI harness + integration | `VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts` (existing, currently depends on `hostRouteChildEnv()`) — needs the D-01 broker-per-suite rewrite | ✅ existing file, needs the harness rewrite itself, Wave 0 |

### Sampling Rate
- **Per task commit:** the specific `*.test.ts` file(s) the task touches.
- **Per wave merge:** `npm run test:automated` at minimum; `VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts` whenever the ACME/CI path is touched.
- **Phase gate:** `VICE_REQUIRE_ACME=1 npm test` (the full CI-equivalent glob) green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] A real `npm install`-of-the-tarball execution test for whatever file the ladder resolves on rung 3 — covers SEAM-02's "resolves ... from an installed package alike" as an EXECUTION claim, not just a path-resolution claim (Critical Finding 1).
- [ ] A same-route-from-host-and-from-simulated-container test for the collapsed `host-tool-client.ts` dispatch (SEAM-03).
- [ ] The D-01 broker-per-suite harness itself (start ephemeral broker, point child env at it, kill in teardown, never-skip-on-VICE_REQUIRE_ACME) — currently no shared helper for this; each affected suite will need it.
- [ ] A cross-seam ordering test entry for any NEW client-side timeout constant this phase introduces for the host-tool dial (Common Pitfall 4).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This milestone deliberately removed the per-boot token (REQUIREMENTS.md Settled decision 5); the new host-tool arm follows the SAME handle-only-authority model already accepted for `attach`/`transfer` |
| V3 Session Management | yes (narrowly) | Stateless calls (SESS-01) — no session to manage; the new staging handle is a single-use, per-request opaque token, mirroring `attach`'s per-claim handle |
| V4 Access Control | yes | `ownsTarget()` for session-scoped ops; a NEW check (or deliberate absence, since the bind is already loopback+bridge-only) for the session-free host-tool arm — must be decided explicitly, not left implicit |
| V5 Input Validation | yes | `validateContainedDestination()` (D-07/XFER-03) refuses rather than sanitises; `HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS` allowlists; `realpathOfNearestExisting()` for symlink-escape (D-05) |
| V6 Cryptography | yes (narrow) | sha256 digest + byte-count verification on every transfer, already provided by `transfer-hash.mts` — never hand-rolled |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Symlink planted inside an uploaded tree, escaping the intended root | Tampering | `realpathOfNearestExisting()` walk, real-path comparison, never a lexical prefix check (D-05, already the lesson from a prior incident this project measured) |
| A broker-supplied result destination name that traverses out of `.c64-re-tools/<kind>/` | Tampering / Elevation of Privilege | `validateContainedDestination()` — refuse, never sanitise (D-07/XFER-03) |
| A skill-script upload exceeding memory via an unbounded read | Denial of Service | `createHashAndCountTransform()`'s per-chunk cap check BEFORE hash update, never a whole-buffer read (D-11, already established) |
| A new session-free host-tool op accidentally reachable without a broker-minted handle, if design drifts from the handle-only-authority pattern | Spoofing / Elevation of Privilege | Follow the SAME pattern `attach`/`transfer` already establish — handle presented, checked, never a bare targetId or bare op name with no proof of prior mint |
| A wire-op literal collision (Pitfall 3) accidentally granting the LEGACY token-gated op's behavior to an unauthenticated pre-gate caller, or vice versa | Elevation of Privilege | Explicit, tested wire-vocabulary decision (Open Question 2) — not an incidental side effect of `if`-chain ordering |

## Sources

### Primary (HIGH confidence — read/measured this session)
- `src/mcp/vice/broker-endpoint.ts` (full read) — the one dial module, its dial/relay/transfer functions, its own header prohibitions
- `src/mcp/vice/host-tool-client.ts` (full read) — the two-route dispatcher, `HOST_TOOL_REQUEST_TIMEOUT_MS`, the CLI entry point
- `src/mcp/vice/host-tool.mts` (targeted reads) — `HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS`, `resolveWorkspacePath()`, the byte-payload prohibition, result digesting
- `src/mcp/vice/broker-control.mts` (targeted reads) — `attach`/`transfer`/`stage_file`/legacy `host_tool` arms, `ControlRequestKind`, `onStageFile`/`onFileTransfer` signatures
- `src/mcp/vice/transfer-hash.mts`, `src/mcp/vice/transfer-paths.ts` (full reads) — the 16 MiB cap and the containment validator
- `src/mcp/vice/repo-root.ts` (targeted read) — `toolsDir()`
- `src/skills/c64-ram-capture/scripts/mcp-module.mjs` and its `.test.mjs` (full reads) — the ladder, confirmed unchanged and already used by all four target skill scripts
- `src/skills/{acme-build,c64-disk-access,c64-petcat,c64-program-recon}/scripts/*.mjs` (targeted greps) — confirmed existing subprocess-spawn invocation pattern
- `src/mcp/vice/vice-cli.mjs`, `src/mcp/vice/vice-proxy.ts` (targeted reads) — the `bin` entry, floor check, `anno`/`broker`/default dispatch
- `src/mcp/vice/build.ts` (targeted read) — `HOST_BOUND_ARTIFACTS`
- `.github/workflows/ci.yml` (full read) — the three ACME-touching steps, exact env/step text
- `src/mcp/vice/skill-acme-build-cli.test.ts`, `src/mcp/vice/acme-gate.ts` (targeted reads) — `hostRouteChildEnv()`, the loud-failure gate
- `src/mcp/vice/broker-e2e.test.ts` (targeted reads, lines ~930-1075) — the `waitFor()`-based fixed-deadline flake this phase folds in fixing
- `src/mcp/vice/ghidra-run.ts`, `src/mcp/vice/dxa-run.ts` (targeted greps) — confirmed same-package value-import usage of `runHostToolFromContainer()`
- `src/mcp/vice/vice-proxy.ts` (targeted reads, lines ~150-260, ~1600-1610) — `ANNO_TOOL_DEFINITIONS` registration, `anno` CLI dispatch, D-06's own comment
- `src/mcp/vice/stock-dispatch.test.ts` (targeted read, line ~1472) — the anno_*-absent-from-stock-manifest test
- Live measurement this session: `npm pack` + genuine `npm install` of the tarball + direct execution of `vice-cli.mjs`/`host-tool-client.ts` under real `node_modules` nesting
- Live measurement this session: a compiled broker (`resources/vice-broker.mjs`) started with `PATH` stripped of every `x64sc` location on this host, answering a real `hello` and a real `host_tool` request end to end

### Secondary (MEDIUM confidence)
- `[CITED: nodejs.org/docs/latest-v24.x/api/typescript.html]` — Node's TypeScript-modules documentation on the `node_modules` type-stripping restriction
- `[CITED: github.com/nodejs/node/issues/57215]` — the open tracking issue confirming there is no flag to enable stripping under `node_modules`, only to disable stripping globally

### Tertiary (LOW confidence)
- None used as load-bearing claims in this document; every design recommendation above is explicitly marked as a recommendation (MEDIUM confidence) or an open question, not stated as settled fact.

## Metadata

**Confidence breakdown:**
- Existing-seam facts (ladder, dial primitives, cap constant, validator, CI steps, op dispatch structure): HIGH — read directly from source this session, several cross-checked live
- The two Critical Findings (npm-installer route crash, stage_file/ownsTarget mismatch): HIGH that the problems are real (measured/read directly); MEDIUM on the specific recommended fix shape, explicitly flagged
- Recommended plan-shaping (module boundaries, wire-op naming): MEDIUM — architecturally consistent with established patterns in this codebase, but genuinely left to the planner per CONTEXT.md's own "Claude's Discretion" framing

**Research date:** 2026-09-25
**Valid until:** this phase's own execution (fast-moving — the Node.js
type-stripping restriction is stable/unlikely to change soon, but the exact
line numbers and function shapes cited throughout will drift the moment any
Phase 65 task lands; re-verify line numbers before citing them in a PLAN.md)
