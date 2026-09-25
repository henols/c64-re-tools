# Phase 65: Every Skill Script Through the One Endpoint, and CI With It - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

One module dials the fixed endpoint and speaks the wire protocol
(`broker-endpoint.ts`), and every host-tool call reaches the broker through
it. That covers the MCP-side callers (`ghidra-run.ts`, `dxa-run.ts`) through
an ordinary in-package import. It also covers the four skill scripts that run
a host tool (`acme.mjs`, `c1541.mjs`, `petcat.mjs`, `packer-finding.mjs`),
which reach it through the unchanged `mcp-module.mjs` ladder. No skill script
keeps a route that works only because it runs on the host. CI's ACME tests
pass without `hostToolOverHostRoute()`, so Phase 66 can delete that route.

**The design problem this phase actually solves.** The scout found that the
whole `host_tool` path still assumes a shared filesystem. Every path-bearing
argument is workspace-relative, and `host-tool.mts`'s `resolveWorkspacePath()`
resolves it against the broker's `--repo-root`. A machine-level broker that
serves a container has no such root. So SEAM-03's "same answer from
anywhere" requires input files and result files to cross the socket as
bytes, reusing Phase 64's transfer. D-03..D-11 decide how.

**Folded into scope by owner decision** (see Folded Todos): the 25 `anno_*`
tools leave the MCP surface (D-12, D-13). A pre-warm todo is closed, and it
turns out to be already done. A `broker-e2e.test.ts` timing flake is fixed.
No REQUIREMENTS id owns the anno work. It is folded todo work, and its own
criteria in D-12/D-13 verify it.

**Explicitly NOT in this phase:**

- **No deletion of the old seam.** `hostToolOverHostRoute()`, the two-route
  branch in `host-tool-client.ts`, `broker.json` and the token-gated legacy
  `host_tool` control op all survive until Phase 66's atomic cutover
  (RM-02, RM-03). This phase removes their last live callers only. The
  convergence metric is expected to read **3** at exit (ROADMAP note).
- **`vsf-slice.mjs` and `completeness-report.mjs` get no transport work.**
  Both use the ladder to spawn an in-tree module, not a host tool, and dial
  no broker. `mcp-module.mjs`'s own header draws that line: the ladder
  locates this project's files, and the host-tool seam is for host binaries.
- **The Ghidra runs-root alias** is Phase 67 (RM-06).

</domain>

<decisions>
## Implementation Decisions

Thirteen decisions from five discussed areas, plus three folded todos.
**One decision went AGAINST the recommendation offered (D-07).** Its cost is
recorded verbatim from the option the owner chose. Every other decision is a
direct owner choice taken as the recommended option. None is open for
re-derivation by the researcher or the planner.

A planner who finds a constraint none of the offered options contained must
say so in writing rather than implement an option as originally worded. This
is the same standing rule Phase 62's D-07/D-08 and Phase 64 established.

### How CI and the suite prove the host tools without the hatch (RM-08)

- **D-01: Each suite owns its broker.** Direct owner decision. This is the
  operational choice the ROADMAP required this discussion to take.

  A suite that runs a host tool through a skill script, or through
  `runHostToolFromContainer()`, starts the compiled broker
  (`resources/vice-broker.mjs`) itself. It uses an ephemeral port and a temp
  `VICE_BROKER_HOME`, points its child at that port by environment, and kills
  the broker in teardown. `broker-endpoint.ts`'s `resolveEndpointPort()`
  reads the same `VICE_BROKER_CONTROL_PORT` the listener binds on, so a child
  needs only that one variable. **`ci.yml` gets no broker step, and nothing
  touches port 19510.**

  *Why not the ROADMAP's guess (a workflow step on 19510):* CI and a dev box
  would diverge, and a live broker on 19510 deterministically reddens at
  least one existing test (Phase 66's own cross-cutting note, measured).
  *Why not manual-only:* CI would stop proving the shipped scaffold
  assembles. That is the exact incident the scaffold step's own comment in
  `ci.yml` records (broken across many merges with nobody noticing).

  *Named cost, accepted:* the tests now own a broker lifecycle, and a leaked
  broker child is a real risk. Teardown must be proven: after the suite no
  broker process survives, even when a case fails. Under `VICE_REQUIRE_ACME`,
  a harness broker that fails to start is a **FAIL**, never a skip. This
  preserves the loud-failure gate `acme-gate.ts` and the CI `Test` step's
  comment describe.

  *For the researcher to confirm, not assume:* reading
  `vice-broker.mts:2257-2281`, `resolvedBackend()` at startup writes to
  stderr and does not throw, so the broker should boot on a runner with no
  `x64sc`. Prove this on a bare environment before the harness depends on
  it.

  *Neighbouring cleanup the planner must decide explicitly, not silently:*
  `skill-acme-build-cli.test.ts`'s `hostRouteChildEnv()` helper and its
  never-skipped contract case exist to keep the child on the **host route**.
  `ci-guardrails.test.mjs`'s workflow assertions guard the same original
  break. Under D-01 the host route has no live caller left. Record what each
  of these now protects, or retire it, in writing.

- **D-02: With no broker running, each affected skill refuses by name, and
  its SKILL.md states the broker as a prerequisite.** Direct owner decision.

  Four skills are affected: `acme-build`, `c64-disk-access`, `c64-petcat`
  and `c64-program-recon` (`packer-finding.mjs`). All four work on a bare
  host today with nothing running. After this phase they need a broker
  there too. That follows from SEAM-03 plus BROKER-02.

  The refusal is ENDPOINT-04's existing one (`describeDialFailure()` and
  `BROKER_START_COMMAND` in `broker-endpoint.ts`). **Do not word a second
  refusal.** The SKILL.md `description:` frontmatter is machine-read (see
  CLAUDE.md "Machine-read prose"), so apply that discipline to the added
  prerequisite text: one instruction per sentence, active voice, no
  semicolons.
  — **Reversibility:** costly — it is a user-visible behaviour change to
  four published skills, and undoing it would need the host route that
  Phase 66 deletes.

### How input files cross the socket (SEAM-03)

- **D-03: A path-bearing input is uploaded as bytes through Phase 64's
  transfer, and the `host_tool` request names the minted handle instead of a
  path.** This is not an alternative the discussion weighed. It follows from
  the milestone (no shared filesystem) and from 64 D-01, and all the other
  input decisions build on it. It covers every single-file input:
  `c1541.*`/`petcat.decode`/`dxa.disassemble` `image`, Ghidra's
  `importPath`/`preScript`/`postScript`/`scriptPath`/`entrypointsPath`/
  `exportPath`/`dataRangesPath`, dxa's `entrypointsPath`/`datablocksPath`/
  `labelsPath`, and `oracle.run`'s `source`. The broker owns every
  broker-side path (64 D-06, XFER-04). A client never supplies one.

- **D-04: `acme.build` uploads the source file's directory tree plus each
  `-I` tree, preserving relative layout, into a per-request broker scratch
  dir.** Direct owner decision. This keeps `!source "x.a"`/`!binary "y.bin"`
  of sibling and subdirectory files working with no ACME parsing on the
  client.

  A `../` reference outside the uploaded trees fails. The refusal names the
  missing file and tells the caller to add an `-I` for it.

  *Declined, with reasons:*
  - Named-files-only: every existing multi-file build would break.
  - A client-side `!source`/`!binary` directive scan: a second, partial
    ACME parser that diverges silently from the real assembler.

- **D-05: The tree walk skips dot-prefixed files and directories and refuses
  by name any symlink whose target leaves its tree.** Direct owner decision.
  Skipping dot-prefixed entries drops `.git`, `.c64-re-tools` and the like.
  The symlink rule carries forward the lesson `host-tool.mts`'s header
  records: a symlink planted inside the workspace once defeated a lexical
  prefix check. Compare REAL paths (the `realpathOfNearestExisting()`
  precedent), never lexical joins. Everything else is uploaded, and the D-11
  cap stops a runaway tree. A source at a repo root is refused by the cap
  with a message that names the limit.

- **D-06: `ghidra.installExtension` installs from the broker's OWN vendored
  extension tree. The `sourceDir` wire key is removed.** Direct owner
  decision. The broker ships from the same `@henols/vice-mcp` package, so
  uploading bytes it already has is waste. ENDPOINT-05 already refuses
  package-major skew. Removing the key follows `normaliseHostToolRequest()`'s
  discipline: a caller that still sends `sourceDir` gets a refusal that names
  the key, and the key is never silently dropped.

### Where result files land

- **D-07: A host tool's results always land under the client's own
  `.c64-re-tools/<kind>/`, and the result carries that local path.** Direct
  owner decision, **taken AGAINST the recommendation offered** (which was
  "honour the caller's outDir").

  *The cost, recorded verbatim from the option the owner chose:*
  **"acme -o and outDir stop meaning anything, a visible regression for
  build users."**

  This follows XFER-01's wording literally for host tools, as Phase 64 did
  for the four `vice_*` tools. It makes this phase **the first live producer
  of 64 D-13's XFER-03 containment validator**: the broker supplies each
  result's name, and the client runs the validator against the per-kind dir
  before writing, refusing rather than sanitising. Every test or CI assertion
  that reads a result next to its source (for example
  `skill-acme-build-cli.test.ts`'s scaffold `.prg` check) must follow the
  result's returned path instead.
  — **Reversibility:** one-way — it breaks the published CLI contract of
  four skill scripts and every documented `-o`/`outDir` usage line.
  Restoring caller-chosen destinations later is a second breaking change.

- **D-08: `acme`'s `-o`/`--out-dir` and the `outDir` argument on
  `c1541.*`/`petcat.decode`/`dxa.disassemble`/`acme.build` are REMOVED, and
  a caller who passes one gets a refusal by name.** Direct owner decision.
  The refusal names the flag and says where results now land. This follows
  the tree's refuse-not-sanitise rule.

  *Declined, with reasons:*
  - A post-copy to the old destination: two writes, and a second
    destination rule to test.
  - Ignore-with-a-warning: results land somewhere else, silently, for any
    caller that does not read stderr.

  `HOST_TOOL_ARG_KEYS` and `HOST_TOOL_PATH_ARG_KEYS` lose the `outDir`
  entries. `host-tool.test.ts`'s both-directions census must move with them
  in the same change. Update every SKILL.md usage line and `acme.mjs`'s
  usage string (`acme.mjs:337`) in the same change.

- **D-09: Only the declared results come back. Everything else a tool
  produced broker-side stays there and is deleted when the request ends.**
  Direct owner decision. "Declared results" means what `runHostTool()`
  already lists in `results[]`: the `.prg`/`.sym`/report, Ghidra's export
  and run log, the dxa listing, the c1541/petcat outputs. The Ghidra project
  database never crosses the socket. This is also why D-11's cap holds for
  Ghidra: 64 D-09's "tens of MB" concern was the project dir, which stays
  broker-side.

- **D-10: `host-tool.mts`'s byte-payload prohibition (`host-tool.mts:64-65`)
  is amended in the same change that makes its second clause untrue.** This
  is inherited from 64 D-19 and is not open. Clause one survives: a
  host-tool response still carries no inline bytes, only a handle, and the
  bytes ride a transfer connection. Clause two (`{ path, sha256, byteLength }`,
  where `path` is a broker path) goes stale here and must be rewritten here.

### The size cap

- **D-11: Phase 64's 16 MiB constant governs host-tool transfers, per file
  AND per request's upload aggregate.** Direct owner decision. It is the same
  constant, imported from wherever Phase 64 defined it, not a second copy of
  the number. The refusal names the limit. There is no environment knob
  (64 D-10). **This closes 64 D-09's foreseen reopening: the number was
  reopened here and kept.**

  *Declined, with reasons:*
  - 64 MiB everywhere: this reopens a decision the owner declined in
    Phase 64.
  - A separate larger aggregate: two numbers and two refusal messages.

### Anno leaves the MCP surface (folded todo)

- **D-12: `anno` runs as a client-local CLI (`vice-mcp anno <verb>`), and its
  SQLite store stays in the project's own `.c64-re-tools`.** Direct owner
  decision. It needs no broker, no VICE binary and no transfer. It is
  stateless: one invocation answers one call.

  *This departs from half of the owner's original directive, knowingly.* The
  directive (todo, 2026-09-11) read *"remove it from the mcp and it shall
  acces the broker as a state less call"*. The owner took the
  "stateless, off-MCP" half and declined the "via the broker" half. That
  half predates v2.0.0, when getting the store to the host side of the
  container split was its motivation (the todo's "host-placement reading").
  Under v2.0.0 a client-local store has nothing to cross. Anno never needed
  the host.

  *Constraints from the todo that this choice satisfies, and that the plan
  must keep satisfying:*
  - `anno` keeps working with no VICE binary installed. This is measured
    behaviour today.
  - D-06 at `vice-proxy.ts:198-206` names `vice-mcp anno <verb>` as the ONLY
    surface that resolves identically on the plugin route and both
    npm-installer routes. The CLI is that surface.
  - MCP-02 ("derived tools must be intercepted before `forwardToVice()`")
    becomes moot for anno rather than restated, because anno leaves the
    dispatch surface entirely.

  *Declined, with reasons:*
  - Broker executes, store broker-side: annotation would need a running
    broker, the store would leave the project tree and stop being
    committable, and a project-identity key would have to be invented.
  - Remove now, decide routing later: the owner decided the routing now.

- **D-13: The 25 `anno_*` tools are deleted outright from `tools/list`, in
  the same change that moves every skill off them.** Direct owner decision.
  v2.0.0 is a major version. A one-release deprecated alias was declined.

  About 49 `anno_*` references across five skills must move to the CLI:
  `c64-memory-mapping` (14), `c64-program-recon` (20),
  `routine-queue-walker` (11), `acme-build` (2), `c64-provenance-diff` (2).
  These are unique names per SKILL.md, measured 2026-09-25. The existing
  structural guard that catches a skill claiming a tool the server does not
  advertise is what proves none is left behind. Things that change with it:
  - `stock-dispatch.test.ts` asserts `vice_result_continue` and the `anno_*`
    family as its two by-name transport exceptions. The anno half of that
    assertion changes here.
  - The advertised tool count changes: CLAUDE.md says 76 tools, 47 from the
    manifest plus 29 registered directly. CLAUDE.md's sections are
    GENERATED from `.planning/codebase/*.md`, so fix the source there, not
    only the generated text.
  - `installer/skills/**` inherits the SKILL.md changes only through
    `installer/scripts/sync-skills.mjs`.
  — **Reversibility:** one-way — it removes 25 tools from a published MCP
  surface. Restoring them after release is a second breaking change.

### Plan-time owner decision (2026-09-25, during /gsd-plan-phase 65)

- **D-14: Phase 65 fixes the npm-installed route for the four host-tool skill scripts only.**
  Direct owner decision, taken at plan time as the recommended option,
  after research measured a defect the discussion did not have.

  *What was measured* (`65-RESEARCH.md` "Critical Finding 1", reproduced
  again at the orchestrator seat on Node v24.20.0): Node refuses to
  type-strip any `.ts` file whose path sits under `node_modules`
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). No flag lifts the
  restriction. `vice-cli.mjs` imports `./vice-proxy.ts`, so
  `npx -y @henols/vice-mcp` (the MCP server) and
  `npx -y @henols/vice-mcp anno <verb>` crash today on every npm-installed
  route. Only `vice-cli.mjs broker` runs, because it imports a compiled
  `.mjs`. The plugin route and an in-repo checkout are unaffected.

  *In scope:* the file that the four host-tool skill scripts (`acme.mjs`,
  `c1541.mjs`, `petcat.mjs`, `packer-finding.mjs`) resolve on ladder rung 3
  must execute from a real `npm install`. An execution test proves it. A
  path-resolution test alone does not. SEAM-02 criterion 2 needs this.

  *Out of scope, filed as a follow-up:* the MCP server's own npm route and
  the anno CLI's `npx` route stay broken exactly as they are today. A plan
  files that follow-up as a pending todo that carries the measured
  reproduction.

  *Consequence for D-12 and D-13:* every SKILL.md line that invokes the
  anno CLI names a form that runs today (the plugin or in-repo form). No
  SKILL.md line names the `npx -y` form, which crashes. This covers the
  lines D-13 moves off the `anno_*` tools and the `npx -y` lines that
  already exist. D-12's premise that `vice-mcp anno <verb>` resolves
  identically on every route holds for path resolution only. A plan must
  not restate it as a claim that the CLI executes on every route.

### Claude's Discretion

The owner explicitly left these to Claude at the close of the discussion
("I'm ready for context", with the three listed as discretion):

- **How a skill script invokes the resolved module:** a subprocess
  (`process.execPath <resolved> run ...`, today's shape) or a dynamic
  `import()` of the resolved path. *Researcher, verify rather than assume:*
  rung 3 of the ladder resolves into `node_modules/`, and Node refuses to
  type-strip `.ts` under `node_modules`
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). That affects BOTH shapes
  equally. Find out how the npm-installer route works today before choosing.
  SEAM-02 forbids changing the ladder itself.
- **The `<kind>` directory names under `.c64-re-tools/`** (for example one
  per tool family) **and how same-name results from different sources
  collide.** Whatever is chosen must go through `toolsDir()`
  (`repo-root.ts`), the one owner of that root.
- **The legacy token-gated `host_tool` control op** keeps existing until
  Phase 66. How the new fixed-endpoint `host_tool` arm coexists with it is
  the planner's call. Constraints: the new arm is answered ahead of the token
  gate, as `attach` and `transfer` are (`broker-control.mts` around
  `:1320`). It does not blend the legacy and the new path into one function
  with a mode flag (`broker-endpoint.ts:17-25`). It carries forward the
  per-tool client request deadlines (`HOST_TOOL_REQUEST_TIMEOUT_MS`) and
  their cross-seam ordering test.
- **The staging lifetime of host-tool uploads.** Skill calls hold no session
  (SESS-01), so 64 D-06's per-SESSION staging directory has no session to
  hang on. Scope it per REQUEST, and make sure 64 D-07's startup sweep still
  covers it.

### Folded Todos

- **`Remove anno from the MCP surface; reach it via a stateless broker
  call`** (`.planning/todos/pending/2026-09-11-remove-anno-from-the-mcp-surface-reach-it-via-a-stateless-br.md`).
  FOLDED AS REAL WORK. It is D-12 and D-13. Close the todo with D-12's
  reading recorded, because the todo itself says not to pick a reading
  without the owner, and the owner has now picked.
- **`Remove pre-warm; launch VICE only on first request`**
  (`.planning/todos/pending/2026-09-07-remove-pre-warm-launch-vice-on-first-request.md`).
  FOLDED, and **measured as already done**: `vice-broker.mts:312` and
  `broker-state.mts:616` both record `maintainWarmFloor()` and the warm floor
  as RETIRED. The work is to verify that no live reader of
  `VICE_BROKER_WARM_FLOOR` or warm-floor residue remains, then move the todo
  to completed with that evidence. Do not plan new broker work for it.
- **`disconnect-while-queued samples once after a fixed deadline instead of
  polling`** (`.planning/todos/pending/2026-09-20-broker-e2e-disconnect-while-queued-samples-once.md`).
  FOLDED AS REAL WORK. Replace the fixed wall-clock deadline plus single
  `readdirSync` sample (`broker-e2e.test.ts:955`, `:1055-1065`) with polling
  of the condition under test. It fits this phase because D-01 adds new
  broker-spawning suites, and they must not copy this pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and locked decisions
- `.planning/REQUIREMENTS.md`: "Settled design decisions" 1-6 (fixed port
  19510, stateless skill calls, bytes over socket, no token, one endpoint
  with tagged connections, no new envelope), plus SEAM-01..03 and RM-08.
- `.planning/ROADMAP.md` § "Phase 65": the success criteria, the
  cross-cutting constraints (no second copy of the client, no cross-package
  npm dependency, never auto-install, never `spawnSync` from a skill script)
  and the notes (convergence metric 3, the `sync-skills.mjs` mirror, the
  14-module host-tool seam).
- `.planning/ROADMAP.md` § "Phase 66": what this phase must leave deletable,
  and the live-broker trap.
- `.planning/phases/64-files-as-bytes-both-directions/64-CONTEXT.md`:
  D-01/D-02 (transfer connection and framing), D-04 (streaming Transform),
  D-06/D-07 (staging dir and startup sweep), D-09..D-12 (cap), D-13 (XFER-03
  validator, whose first live producer is here), D-17/D-18 (no source-text
  assertions, and the metric is measured rather than asserted), D-19
  (`host-tool.mts` prohibition amended here).
- `.planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/62-CONTEXT.md`:
  D-05 (major-version compatibility), D-06/D-07 (hello handshake and dial
  order), D-13/D-14 (`VICE_BROKER_HOME`).
- `CLAUDE.md`: "Never auto-install an external tool", "Machine-read prose",
  and the Architecture constraints (one module per seam, no module cycles,
  `.mts` to `resources/` build coupling).

### The seam being migrated
- `src/mcp/vice/broker-endpoint.ts`: the ONE dial module (SEAM-01), its
  header prohibitions (no fs, never import `vice-broker-client.ts`, no
  container detector), `dialFileTransfer()`, `awaitTransferComplete()`,
  `describeDialFailure()`, `BROKER_START_COMMAND`.
- `src/mcp/vice/host-tool-client.ts`: the two-route client, the legacy
  broker.json dial, `hostToolOverHostRoute()`, the CLI entry the skill
  scripts spawn, and `HOST_TOOL_REQUEST_TIMEOUT_MS`.
- `src/mcp/vice/host-tool.mts`: the executor, `HOST_TOOL_IDS`,
  `HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`, `resolveWorkspacePath()`,
  and the `:64-65` prohibition. It is compiled to `resources/host-tool.mjs`.
- `src/mcp/vice/broker-control.mts`: the pre-token-gate op arms
  (`hello`/`attach`/`transfer`, around `:1320`) and the legacy `host_tool`
  arm (`:1507`).
- `src/mcp/vice/vice-broker.mts`: broker startup (`:2257-2281`), `onHostTool`
  wiring, and `--repo-root` (still optional).
- `src/skills/c64-ram-capture/scripts/mcp-module.mjs`: the three-rung ladder
  (SEAM-02, unchanged).
- The skill scripts: `src/skills/acme-build/scripts/acme.mjs`,
  `src/skills/c64-disk-access/scripts/c1541.mjs`,
  `src/skills/c64-petcat/scripts/petcat.mjs`,
  `src/skills/c64-program-recon/scripts/packer-finding.mjs`.
- The MCP-side callers: `src/mcp/vice/ghidra-run.ts` and
  `src/mcp/vice/dxa-run.ts`.

### CI and the tests it runs
- `.github/workflows/ci.yml`: the "Install ACME", "Assemble the acme-build
  scaffold (library-free)" and "Test" steps, plus their comments.
- `src/mcp/vice/skill-acme-build-cli.test.ts`: `hostRouteChildEnv()` and the
  scaffold case.
- `src/mcp/vice/acme-gate.ts`: the `VICE_REQUIRE_ACME` loud-failure seam.
- `src/mcp/vice/broker-e2e.test.ts:955`, `:1055-1065`: the folded flake.

### Anno
- `src/mcp/vice/vice-proxy.ts:173`: `ANNO_TOOL_DEFINITIONS` registration.
- `src/mcp/vice/vice-proxy.ts:198-206`: D-06 (the three-route CLI rule).
- `src/mcp/vice/vice-proxy.ts:273`: the `anno <verb>` CLI.
- `src/mcp/vice/anno-tools.ts` and `src/mcp/vice/anno-cli.ts`.
- `src/skills/{c64-memory-mapping,c64-program-recon,routine-queue-walker,acme-build,c64-provenance-diff}/SKILL.md`.
- `installer/scripts/sync-skills.mjs`: the mirror.

### Build coupling
- `src/mcp/vice/build.ts` `HOST_BOUND_ARTIFACTS` and `tsconfig.build.json`
  `include`, plus `resources-sync.test.ts`: regenerate `resources/*.mjs` in
  the same commit as every `.mts` change.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dialFileTransfer()` / `awaitTransferComplete()` (`broker-endpoint.ts`):
  the upload and download primitive D-03/D-04/D-07 ride on. Do not build a
  second one.
- The XFER-03 containment validator (Phase 64, a pure function with fixture
  tests): D-07 wires its first live producer.
- `describeDialFailure()` + `BROKER_START_COMMAND`: the D-02 refusal text.
- `resolveMcpModule()` / `refusalMessage()` (`mcp-module.mjs`): the only
  ladder. Never carry a second copy.
- `realpathOfNearestExisting()` (`host-tool.mts`): the real-path walk D-05's
  symlink refusal follows.
- `toolsDir()` (`repo-root.ts`): the one owner of the client's
  `.c64-re-tools` root, which D-07's per-kind dirs sit under.
- Phase 63/64 tests already bind port 0 and read the port back. D-01's
  harness follows that convention.

### Established Patterns
- Pre-token-gate op arms authorised by an opaque handle (`attach`,
  `transfer`). The new endpoint `host_tool` arm has the same shape.
- A JSON header line followed by N raw bytes (64 D-02). No base64 in the
  JSON line, and no length-prefixed chunk envelope.
- Refuse-by-name for unknown or removed wire keys
  (`normaliseHostToolRequest()`). D-06 and D-08 removals follow it.
- Write-to-temp then `renameSync` on the same filesystem, with a sha256
  digest (64 D-12's settled precedent).
- No test asserts on source text (`260914-poo` D-1). The SEAM-01 census and
  the convergence metric are MEASURED and recorded in phase evidence, not
  asserted (64 D-18).

### Integration Points
- The skill scripts spawn `host-tool-client.ts run --tool --args` today.
  That CLI surface is where the new endpoint route is reached from the
  skills side.
- `ghidra-run.ts` / `dxa-run.ts` value-import `runHostToolFromContainer()`.
  That is the same-package route SEAM-01 keeps.
- The host-tool seam spans 14 referencing modules: 8 under `src/mcp/vice/`
  (including the two generated `resources/` mirrors) and 6 under
  `src/skills/` (ROADMAP note).

</code_context>

<specifics>
## Specific Ideas

- The owner's anno directive, verbatim (2026-09-11): *"remove it from the
  mcp and it shall acces the broker as a state less call"*. D-12 records
  which half was taken and why.
- D-07's cost sentence is quoted verbatim from the option chosen, and it
  must reach the user-facing docs in plain words: results no longer land
  beside the source.

</specifics>

<deferred>
## Deferred Ideas

- **Anno routed through the broker (the literal reading of the directive).**
  Declined in D-12. If a future need ever puts the annotation store on the
  host side, that is its own phase, with a project-identity key to design.
- **Caller-chosen result destinations.** Declined in D-07. If the
  `-o`/`outDir` regression proves painful in use, restoring it is a
  breaking change to raise at roadmap level, not a patch.
- **`CR-01` at `text-protocol.ts:850`** is carried debt (STATE.md). This
  phase does not plan to touch it. If a plan ends up there, record it as a
  deliberate closure rather than a silent fix.

### Reviewed Todos (not folded)
- **`BACK-05 D-G ordering test fails deterministically on a live-broker
  host`**: `resolves_phase: 66`. D-01's use of ephemeral ports is what keeps
  this phase from adding to that trap class.
- **`A devcontainer client cannot see the host broker's broker.json`**:
  Phase 66 (RM-02) owns it. This phase's endpoint route never reads
  `broker.json`, which is the permanent fix's shape.
- **`Reap vicerc scratch dirs in broker kill/recycle path`**: folded by
  Phase 64 (64 D-08) but still sitting in `todos/pending/`. Not this phase's
  work. Flagged so the Phase 64 close-out can move it if it is done.

</deferred>

---

*Phase: 65-every-skill-script-through-the-one-endpoint-and-ci-with-it*
*Context gathered: 2026-09-25*
