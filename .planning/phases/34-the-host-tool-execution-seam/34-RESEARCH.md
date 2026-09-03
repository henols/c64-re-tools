# Phase 34: The Host-Tool Execution Seam - Research

**Researched:** 2026-09-03
**Domain:** Container-out control-plane extension (Node `net` TCP, child-process supervision, host/container path translation) plus one external tool integration surface (ACME, an unpacker oracle, dxa, Ghidra `analyzeHeadless`)
**Confidence:** MEDIUM overall — HIGH on everything read directly from this repo's source and everything live-probed this session; MEDIUM/LOW on the four externally-sourced capability claims in `seeds/host-tool-executor.md` (explicitly marked unprobed there) and on the GitHub Actions cost question, which this session could not answer.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEAM-01 | Host binaries reached over a typed namespaced control op on the existing broker socket, routed before any lease-bearing path | `broker-control.mts`'s dispatch is fully mapped below (file:line), including the exact point "before any lease-bearing path" resolves to, and the two tests that will go red the moment a new op is added |
| SEAM-02 | Typed per-tool allowlist, no argv passthrough, child process, invocation+exit status recorded | `DENY_LIST` (`vice.ts:201`) and `normaliseLaunchProfile()` (`broker-control.mts:328-350`) are the two precedents to mirror; async-only spawn constraint sourced from the seed and cross-checked against the broker's own `uncaughtException`→kill-pool handler |
| SEAM-03 | Results cross as path+digest+length via `containerpath.ts`, never payload; 64 KiB cap | **Live-probed this session** against the real `broker-control.mts` listener — see Finding 1 below, a genuine observed-red transcript, not a read-in-source claim |
| SEAM-04 | Ghidra: one project dir per run id, `-deleteProject`, no-dot refusal enforced in code | **Live-probed this session** against real Ghidra 12.1.3 — see Finding 2, including a discovery this session made that the ROADMAP's own framing does not state: the refusal fires on *every* path segment of the project location, not just the leaf |
| SEAM-05 | Two existing violations migrated; whole-tree grep gate bans reintroduction, reads what ships not `git ls-files` | Both violation files read in full below; `packFiles()` (`scripts/check-npm-packages.mjs:134-146`) identified as the exact mechanism the new gate must reuse |
| SEAM-06 | New module family inside closed-consumer discipline; non-vacuity floor with a real positive control | `hostpath-consumers.test.ts` read in full — the exact template (`annoProductionModules()`, `ANNO_MODULE_FLOOR`, pinned-equals-measured test, INT-01 positive-control test) to mirror for a second prefix |
| SEAM-07 | JVM lifetime binding recorded as a decision with measurement and reversal condition | JDK 21 confirmed present on this host; Ghidra 12.1.3 confirmed present out-of-tree; startup cost independently corroborated against 3 external OSS projects via web search (MEDIUM confidence, no new number obtained) |

</phase_requirements>

## Summary

This phase adds exactly one new capability to an already-well-understood subsystem: `broker-control.mts`'s newline-delimited-JSON TCP control plane, which today speaks a closed seven-member `ControlRequestKind` union entirely about VICE-instance lifecycle. Every constraint the seed document (`seeds/host-tool-executor.md`) predicted from reading the code is independently confirmed at HEAD in this session, with one addition this session's probing found and the seed did not state: Ghidra's no-dot-path refusal checks **every segment of the absolute project-location path**, not just the leaf — which rules out nesting a Ghidra project under this project's own `.vice-supervisor/` or `.planning/` conventions, both dot-prefixed.

Two structural facts dominate the design. First, the 64 KiB line cap is not a documentation claim — this session started the real `startControlListener()` implementation, dialed it with a 70,050-byte line and no trailing newline, and observed exactly what SEAM-03 requires be provable: a clean `close` event, `hadError=false`, zero bytes of response. That transcript is reproduced below and should be committed as the phase's own control, satisfying Success Criterion 2 without needing a live VICE instance at all. Second, because the container and host share a bind-mounted workspace, "return a path" is not a stub for "transfer bytes" — a host-tool output written inside the workspace can be opened directly by the container side after one `containerPath()` call (`containerpath.ts:151-157`), so the file literally never crosses the socket. This is what makes SEAM-03's constraint a genuine simplification rather than an added round trip, provided (and only provided) tool output lands inside the bind-mounted tree — a constraint this document surfaces prescriptively for Ghidra's project directory placement.

**Primary recommendation:** add one new `ControlRequestKind` member (not one per tool) that carries a typed, server-narrowed payload the same way `acquire`'s `profile` field already works, dispatch it before the `acquire` branch in `handleLine()`, hand its handler a deps object containing none of the seven VICE callbacks, execute the actual tool as an async (never `spawnSync`) child process from a new host-bound `.mts` module added to `tsconfig.build.json`/`HOST_BOUND_ARTIFACTS`, and return every result as `{ path, sha256, byteLength }` translated through `containerpath.ts`. This keeps the two byte-exact `ControlRequestKind` tests' breakage to a single, deliberate, one-line diff rather than one diff per tool — but see the Open Question at the end: the seed's own prose ("prefixed op values slot into that chain directly") pulls toward the opposite (namespaced-op-per-tool) shape, and that tension is a real design decision this document surfaces rather than resolves.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Control-op routing (namespace dispatch, token gate) | Host broker process (`broker-control.mts`) | — | Already the one place every control-plane request is parsed and authorized; adding a branch here is cheaper and safer than a second listener |
| Tool argv construction (typed allowlist) | Host broker process, in a **new** host-bound `.mts` module | — | Must never run in the container (no PATH to the binaries) and must never touch VICE state (capability-passing isolation, seed constraint 1) |
| Tool child-process execution | Host OS, via `node:child_process.spawn` (async) | — | `spawnSync` would block the broker's single-threaded event loop for the tool's whole run — unacceptable given warm-floor/acquire traffic must keep flowing |
| Result materialization (files) | Host filesystem, inside the bind-mounted workspace | — | The only placement that lets the container-side reader open the result directly via `containerPath()` without a second data-transfer mechanism |
| Result path translation | Container-side skill script, via `containerpath.ts` | — | Mirrors the existing broker-grant translation (`vice-proxy.ts`'s `containerizeGrant()`) rather than inventing a second translation site |
| CLI/UX surface (verbs, JSON output) | Container-side skill scripts (`acme.mjs`, `packer-finding.mjs`, future `c1541`/`petcat`/`cartconv` drivers) | — | Unchanged from today — only the *body* of "how does the binary actually run" moves behind the seam; the documented CLI contract skill authors and CI already depend on should survive intact |
| Ghidra JVM lifetime | Host broker process (if resident) or per-invocation (if not) | — | SEAM-07's own undecided binding; see the dedicated section below |

## Standard Stack

No new external npm/pip/cargo packages are introduced by this phase. Every mechanism this phase needs is either already in the codebase (`node:net`, `node:child_process`, `node:crypto` for digests, `node:fs`) or is a pre-existing host binary this project already depends on operationally (`acme`, the packer-identifier oracle, and — in later phases — `dxa`, `c1541`, `petcat`, `cartconv`, Ghidra). **Package Legitimacy Audit is not applicable to this phase** — nothing here is `npm install`ed. Ghidra's own third-party status is already governed by `THIRD-PARTY-NOTICES.md` and is out of scope for a fresh audit here (SEAM-related requirements only reach the *seam*, not any specific tool's vendoring, which is DXA-01/GHID-01's business in Phases 35-36).

### Core (already in the repo, reused rather than added)
| Module | Role | Why standard here |
|--------|------|--------------------|
| `node:net` `createServer`/`connect` | The control-plane transport | Already what `broker-control.mts` uses; a second transport for host tools would violate "same socket port" (SEAM-01) |
| `node:child_process` `spawn` | Async child-process execution | `spawnSync` is banned by the seed's own constraint 1c (shared event loop) — see Common Pitfalls |
| `node:crypto` `createHash("sha256")` | Result digesting | Already the project's convention (capture sha256s throughout `evidence/`, `CAP-01`/`CAP-02`) |

## Package Legitimacy Audit

Not applicable — no external packages are installed by this phase.

## Architecture Patterns

### System Architecture Diagram

```
container-side skill script (e.g. acme.mjs "build" verb)
        │
        │ 1. open TCP connection to broker control port
        │    (same port existing acquire/release/status use)
        ▼
broker-control.mts :: attachControlProtocol() :: handleLine()
        │
        │ 2. token check (existing, unchanged, broker-control.mts:630-635)
        ▼
        │ 3. NEW: namespace/op check, dispatched BEFORE the "acquire" branch
        │    (handleLine()'s if/else chain, broker-control.mts:637 onward) --
        │    routes to a handler that receives NONE of the 7 VICE callbacks
        ▼
new host-bound module (e.g. host-tool.mts, compiled to resources/host-tool.mjs)
        │
        │ 4. typed per-tool allowlist narrows the request
        │    (mirrors normaliseLaunchProfile(), broker-control.mts:328-350)
        ▼
        │ 5. async spawn() of the real binary (acme / unp64 / dxa / Ghidra),
        │    argv array built entirely server-side, NEVER from wire argv
        ▼
host filesystem, INSIDE the bind-mounted workspace (e.g. <root>/tools/...)
        │
        │ 6. output file(s) written; sha256 + byteLength computed
        ▼
broker-control.mts responds: { path (host-absolute), sha256, byteLength, exitStatus }
        │
        │ 7. connection closes (short-lived, per-request -- no lease)
        ▼
container-side skill script
        │
        │ 8. containerPath(hostPath) -- containerpath.ts:151-157
        │    (works ONLY because step 5's output landed inside the
        │    bind-mounted tree -- see Common Pitfalls)
        ▼
skill script reads the result file directly off its OWN filesystem view,
never over the socket
```

### Recommended Project Structure (additions only)
```
src/mcp/vice/
├── broker-control.mts       # MODIFIED: new op branch in handleLine(), before "acquire"
├── host-tool.mts             # NEW, host-bound: typed allowlist + async spawn + digest
├── host-tool.test.ts         # NEW: unit tests for the allowlist/argv-construction logic
├── host-tool-client.ts       # NEW, container-side: short-lived connect/send/close helper
│                              #      (mirrors acquireOverControlPlane(), vice-broker-client.ts:381-500)
├── ghidra-*.ts / dxa-*.ts    # future phases (35/36) -- SEAM-06's second prefix floor
│                              #      must be ready for these BEFORE they exist, same
│                              #      discipline as hostpath-consumers.test.ts:191-196
├── tsconfig.build.json        # MODIFIED: host-tool.mts added to include[]
├── build.ts                  # MODIFIED: HOST_BOUND_ARTIFACTS gains "host-tool.mjs"
└── resources/
    └── host-tool.mjs          # GENERATED, committed -- delivered to consuming
                                #      projects by the existing install-resources.ts walk()
```

### Pattern 1: Route before any lease-bearing path (SEAM-01)

**What:** `handleLine()` (`broker-control.mts:611-814`) is a flat `if (req.op === "acquire") … else if (req.op === "release") … else { unknown op }` chain, checked strictly after the token gate (`broker-control.mts:627-635`) and strictly before any branch body runs. There is no shared pre-processing between branches — each branch is self-contained. "Before any lease-bearing path" is satisfiable by inserting the new branch **anywhere in that chain before `attemptAcquire()` is ever called** — branch order does not change which requests reach `attemptAcquire()`, since dispatch is on exact string equality, not fallthrough. What actually matters structurally (and is the real content of "before any lease-bearing path") is that the new branch's handler is **not the `attemptAcquire()`/`onAcquire` closure** and receives a **separate deps object**.

**When to use:** Any time a new control-plane capability must be provably unable to touch VICE lease state.

**Example (existing precedent to mirror — this is what the `deps` narrowing already looks like for `acquire`):**
```typescript
// Source: broker-control.mts:157-205 (StartControlListenerOptions)
onAcquire: (requestId: string, profile?: LaunchProfile) => Promise<AcquireOutcome>;
onRelease: (requestId: string) => void;
onRecycle: (targetId: string) => Promise<RecycleOutcome>;
onStatus: () => StatusInstanceEntry[];
onHostState: () => HostStateFields;
onMonitorClaim: (requestId: string, targetId: string) => MonitorClaimOutcome;
onMonitorRelease: (requestId: string, targetId: string) => MonitorReleaseOutcome;
// A new `onHostTool` callback added ALONGSIDE these seven (never composed from
// them) is what gives the new branch's handler zero reachability into lease
// state -- it is handed its own function, not the seven above.
```

**Wiring site (host-side, where the real broker connects `onAcquire` etc. to `handleAcquire()`):** `vice-broker.mts:1135-1171` — the exact object literal passed to `startControlListener()`. A new `onHostTool` callback belongs here, alongside (not derived from) the existing seven.

### Pattern 2: Typed narrowing at one site (SEAM-02)

**What:** `normaliseLaunchProfile()` (`broker-control.mts:328-350`) is this codebase's own precedent for "narrow an untrusted wire field into a typed value at exactly one site, refuse unknown keys by name, never coerce." A host-tool allowlist should do the identical thing: one function, one accepted-keys list (`Object.freeze([...])`, mirroring `LAUNCH_PROFILE_KEYS` at `broker-control.mts:309`), refusing unknown tool names and unknown argument keys by name rather than dropping them silently.

**Example:**
```typescript
// Source: broker-control.mts:306-350, the pattern to mirror
const LAUNCH_PROFILE_KEYS: readonly string[] = Object.freeze(["warp", "headless"]);
export function normaliseLaunchProfile(raw: unknown): NormaliseLaunchProfileResult {
  // ... refuses unknown keys BY NAME, never drops them, never coerces types
}
```

### Pattern 3: Async-only spawn, never `spawnSync` (SEAM-02, seed constraint 1c)

**What:** `broker-kill.mts:367-374` registers `uncaughtException`/`unhandledRejection` handlers that kill the **entire VICE pool** on any unhandled throw in the broker process. A synchronous `spawnSync()` call for a multi-second tool run blocks the single-threaded event loop for its whole duration — starving acquires, the warm floor, and monitor claims — and any throw inside a synchronous spawn path is exactly the kind of unhandled exception that handler exists to catch (i.e., a tool crash could plausibly take the whole pool down with it if run inline and unguarded). `acme.mjs`'s current `spawnSync("acme", args, …)` (line 124) and `packer-finding.mjs`'s two `spawnSync(...)` calls (`probeUnp64` at line 255, `runUnp64` at line 314) are exactly the calls that must become async when they move behind the seam.

**When to use:** Always, for any host-tool invocation initiated from inside the broker process.

### Pattern 4: Result-by-reference through `containerpath.ts` (SEAM-03)

**What:** `containerPath(hostish: unknown): string` (`containerpath.ts:151-157`) is the existing, tested inverse-translation primitive — it already exists precisely because the broker hands the container-side proxy host-rooted paths in grant records (`containerizeGrant()`'s own history, documented in `containerpath.ts`'s header, lines 12-25). A host-tool response's `path` field is translated through the exact same primitive; no new translation logic is needed.

```typescript
// Source: containerpath.ts:151-157
export function containerPath(hostish: unknown): string {
  const { candidates, reason, raw } = containerPathCandidates(hostish);
  if (!candidates.length) {
    throw new Error(`${reason || `cannot determine a container path for ${String(raw)}`}\n  Or ${SET_ENV_HINT}`);
  }
  return candidates[0];
}
```

**Constraint this imposes on tool output placement:** `containerPathCandidates()` (`containerpath.ts:120-147`) can only translate a host path that falls under one of `hostRootCandidates()`'s known roots — which are all derived from the bind-mounted workspace root. A tool that writes its output to, say, `/tmp` or a system Ghidra install directory **cannot** be translated back; `containerPath()` will throw. Every host-tool output must be written **inside the workspace tree** — the existing `installTargetDir(root) = join(root, "tools")` (`install-resources.ts:91-93`) is the natural, already-non-dot-prefixed candidate root for scratch output (see Finding 2 below for why "non-dot-prefixed" specifically matters for Ghidra).

### Pattern 5: Deliver a new host-bound module with no runtime build step

**What:** `build.ts`'s `HOST_BOUND_ARTIFACTS` array (`build.ts:42-51`) is the literal, asserted-exact emitted-file-set; `tsconfig.build.json`'s `include` array (lines 9-18) is what `tsc` actually compiles. Both must gain the new module's name in the same commit — `build()`'s own assertion (`build.ts:190-203`) throws loudly if they disagree (`missing`/`unexpected` diff). Once built, `install-resources.ts`'s recursive `walk()` (`install-resources.ts:99-...`) delivers **everything** under `resources/` — generated `.mjs` and the one hand-authored `vice-launcher.sh` alike — into the consuming project's `tools/` directory with no code change needed on the delivery side. `resources-sync.test.ts` additionally asserts (line 97-126) that no generated file names a bare (non-`node:`, non-relative) import specifier — the new module must import only Node builtins and sibling relative modules, exactly as `broker-control.mts` already does.

```typescript
// Source: build.ts:42-51 -- add the new artifact here
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs", "container-guard.mjs", "broker-state.mjs", "broker-launch.mjs",
  "broker-kill.mjs", "broker-epoch.mjs", "broker-control.mjs", "backend-detect.mjs",
  // + "host-tool.mjs"
];
```

### Anti-Patterns to Avoid
- **A generic `run_host_command` op accepting raw argv over the wire:** exactly the remote-execution seam the seed's constraint 5 names and forbids. Every tool gets a named, typed handler; the executor — never the wire payload — constructs argv.
- **Inline byte payloads for "small" results:** SEAM-03 states the file route is a *contract*, not a size-triggered workaround. Even a two-line ACME diagnostic list should cross as `{path, sha256, byteLength}` — the discipline is what makes a later megabyte Ghidra export unsurprising, not an emergency re-architecture.
- **Naming a tool-binary-path local variable `binPath`:** see Common Pitfalls — this trips `spawn-seam.test.ts`'s emulator-spawn detector, which is unrelated to this phase's own gate.
- **Placing Ghidra project directories under `.vice-supervisor/` or `.planning/`:** both are dot-prefixed ancestors; see Finding 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Host↔container path translation | A second `hostPath()`/`containerPath()` pair scoped to host-tool results | `hostpath.ts` / `containerpath.ts` (already tested, already the closed consumer set `hostpath-consumers.test.ts` governs) | A second implementation is exactly the drift `containerpath.ts`'s own header warns against — "the mapping is never written down as a literal" applies equally to a duplicate |
| Untrusted-field narrowing at a wire boundary | A bespoke per-tool validator | The `normaliseLaunchProfile()` pattern (refuse unknown keys by name, one narrowing site) | Same discipline, already reviewed and tested at `broker-control.mts:328-350` |
| Result digesting | A hand-rolled hash loop | `node:crypto`'s `createHash("sha256")` | Already this project's convention throughout `evidence/` and `CAP-01`/`CAP-02` |
| Process-identity-checked kill | A new kill routine for a runaway host-tool child (e.g. a stuck Ghidra JVM) | `verifiedKill()` (`broker-kill.mts:126`) as the pattern to mirror (kill-by-identity, not by raw pid) — not a direct reuse (it's typed around emulator instance records), but the discipline transfers | Prevents a supervision bug from killing an unrelated process that happens to reuse a pid |

**Key insight:** every primitive this phase needs already exists in this codebase in a tested, reviewed form — `normaliseLaunchProfile()` for narrowing, `containerpath.ts` for translation, `verifiedKill()` for supervised termination, `install-resources.ts`'s `walk()` for delivery. The actual net-new work is small: one new control-op branch, one new host-bound module, and the two grep gates SEAM-05/SEAM-06 require.

## Common Pitfalls

### Pitfall 1: `spawn-seam.test.ts` misclassifies a Ghidra/dxa/acme spawn as an emulator spawn
**What goes wrong:** `EXPECTED_EMULATOR_SPAWN_SITES` (`spawn-seam.test.ts:263-267`) currently has **exactly one** entry (`backend-detect.mts`), and the discovery scan's identifier-naming heuristic, `EMULATOR_BIN_SHAPE` (`spawn-seam.test.ts:179`), is `\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b` — a **generic identifier-name** match, not a value match. A new `spawnSync`/`spawn` call anywhere in a shipped module whose first-argument local variable happens to be named `binPath` (a natural, innocuous name for "the resolved path to the tool binary") is swept into this scan as if it spawned the *emulator*, and the "exactly one" assertion at `spawn-seam.test.ts:271-297` goes red.
**Why it happens:** the pattern is a bare word-boundary regex over identifier names in `codeOnly()`-stripped source (`spawn-seam.test.ts:191-204`), with no distinction between "this identifier resolves to the emulator" and "this identifier happens to share a common name."
**How to avoid:** name the host-tool executor's local variables for the resolved binary path something that does not match `\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b` — e.g. `toolPath`, `ghidraPath`, `dxaPath`, `acmePath`.
**Warning signs:** `npm run test:automated` (or `node --test spawn-seam.test.ts`) reports the "discovered emulator spawn-site set" test failing with an unexpected extra file — the file is almost certainly innocent and the fix is a rename, never an edit to `EXPECTED_EMULATOR_SPAWN_SITES`.

### Pitfall 2: `hostpath-consumers.test.ts`'s floor is structurally blind to a new family
**What goes wrong:** `annoProductionModules()` (`hostpath-consumers.test.ts:211-213`) filters strictly on `/^anno-.*\.ts$/`. A `ghidra-*.ts`/`dxa-*.ts`/host-tool-family module set sits entirely outside that glob, so the existing `ANNO_MODULE_FLOOR = 16 + 1` (line 257) and its "pinned-equals-measured" companion test (lines 287-297) never see the new family at all — a new family member that (incorrectly) imports `hostpath.ts` directly produces **no red anywhere** unless a second, prefix-scoped floor exists.
**Why it happens:** the floor is deliberately hand-pinned per-prefix (not derived from disk, by design — see the file's own "THE FLOOR MUST NEVER BE DERIVED FROM DISK" comment, lines 238-244) precisely so an empty/broken glob cannot pass vacuously; but a hand-pinned floor only protects the prefix it was written for.
**How to avoid:** SEAM-06 requires a **second**, separately-pinned floor over the new family's own prefix, following the exact template `hostpath-consumers.test.ts` already establishes: a `hostToolProductionModules()`-style disk-derived list function, a hand-pinned non-vacuity floor constant, a "floor equals measured count" companion test, and — per the ROADMAP's own success criterion — a **real on-disk positive control module** (an actual file matching the new prefix, committed, analogous to `anno-store.ts`'s role at `hostpath-consumers.test.ts:299-317`) so the floor is observed naming something real, not merely asserted to exist.
**Warning signs:** a code-review that adds a `ghidra-*.ts` module and sees every existing test suite stay green is the failure mode itself, not evidence of correctness.

### Pitfall 3: `ControlRequestKind`'s two byte-exact tests will go red on ANY new op — this is expected, not a bug to route around
**What goes wrong:** `broker-control.test.ts:889-902` and `:1360-1376` both assert `ControlRequestKind`'s literal union text equals the current seven-member string, verbatim. Adding any new member — whichever shape is chosen (see Open Questions) — breaks both tests immediately.
**Why it happens:** this is deliberate, by design (`D-15`'s own comment at `broker-control.mts:39-43`: "STILL SEVEN... Adding an eighth kind here would have meant a second acquire path to keep in sync"). The tests exist specifically to force a reviewer to notice and approve any widening of the control-plane surface.
**How to avoid:** update both tests' expected string in the same commit that adds the new member — this is the *correct* repair, not a workaround. Do **not** attempt to add a host-tool op as a field on an unrelated existing op (e.g. bolting it onto `status`) merely to dodge this test; that would violate SEAM-01's own "typed namespaced control op" requirement.
**Warning signs:** none — this is a expected, deliberate breakage. Its absence (i.e., a plan that claims to add host-tool routing without touching these two tests) is the actual warning sign of an incorrect design.

### Pitfall 4: `EXPECTED_TRACKED_SHELL_SCRIPTS` and the two skill-coverage gates are near-misses, not real blockers, for this phase
**What goes wrong:** a planner reading the ROADMAP note might expect `scripts/check-skill-cli-invocations.mjs` and `scripts/check-skill-tool-coverage.mjs` to need edits when `acme.mjs`/`packer-finding.mjs` are migrated.
**Why it happens:** those two scripts are scoped to the `anno` CLI verb surface and `vice_*` MCP tool names documented in `SKILL.md` files (confirmed by reading both files' headers and grepping for `acme.mjs`/`packer-finding.mjs` — the only hits are a historical pin comment in `scripts/lib/skill-honesty-checks.mjs:64-70` about a retired `disasm` verb, and an unrelated measurement comment in `check-skill-tool-coverage.mjs:641`). The **actual** governing test for `acme.mjs`'s CLI contract is `skill-acme-build-cli.test.ts`, which spawns `acme.mjs` as a subprocess and asserts on its stdout/exit code/produced `.prg` bytes — this is the file that must be re-verified (not necessarily edited, if the CLI surface is preserved) after migration. Its sibling for `packer-finding.mjs` is presumably `skill-program-recon-cli.test.ts` (not read in full this session — file exists in the directory listing but was not opened; treat as `[ASSUMED]` that it plays the same role).
**How to avoid:** verify `skill-acme-build-cli.test.ts` (and its packer-finding sibling) still pass after migration; do not assume the two `check-skill-*.mjs` scripts need changes.
**Warning signs:** if migration changes `acme.mjs`'s CLI argument shape at all, `skill-acme-build-cli.test.ts` will fail loudly and immediately (it spawns the real script), which is the correct signal.

### Pitfall 5: `EXPECTED_TRACKED_SHELL_SCRIPTS` only needs touching if a `.sh` wrapper is introduced
`EXPECTED_TRACKED_SHELL_SCRIPTS` (`host-scripts.test.ts:202-208`) is a `git ls-files -- '*.sh'` census, currently 5 entries. **Verified at HEAD: no drift** — the array matches what's on disk. This phase's design (a `.mts`→`.mjs` host-bound module, not a shell script) does not need to touch it. It only becomes relevant if a plan introduces a `.sh` launcher analogous to `vice-launcher.sh` for tool invocation — which nothing in this phase's scope requires.

## Findings from live probing this session

### Finding 1 (SEAM-03): the 64 KiB cap, observed red against the real listener, not read in source

This session started the actual `startControlListener()` (imported directly from `broker-control.mts`, no mock, no stub of the framing/token/dispatch logic) on a scratch port, connected a plain TCP client, and sent a single JSON line padded to 70,050 bytes with **no trailing newline**:

```
$ node probe-64k-cap.mjs
PROBE_LISTENING port=32895
PROBE_CONNECTED
PROBE_LINE_BYTES=70050
PROBE_CLOSE hadError=false gotData=false
```

**Observed:** the connection is silently destroyed — `close` fires with `hadError=false`, and the client receives **zero bytes** of any kind (no error frame, no partial JSON, nothing). This is exactly the "bare disconnect with no error frame" Success Criterion 2 requires be demonstrated, produced against the real `MAX_LINE_BYTES = 65536` check (`broker-control.mts:266`) and `socket.destroy()` call (`broker-control.mts:474-476`) inside `attachControlProtocol()`'s `socket.on("data", ...)` handler. `[VERIFIED: broker-control.mts:266,474-476 — live-probed this session]`

This transcript-producing script is cheap (no VICE, no broker process, ~50 lines, sub-second run) and should become a committed control for this phase — it directly proves the constraint without needing any host-tool code to exist yet.

### Finding 2 (SEAM-04): the no-dot refusal checks every path segment, not just the leaf — a discovery this session made

This session ran the real, locally-installed Ghidra 12.1.3 (`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/support/analyzeHeadless`) twice:

**Probe A — dot in the immediate leaf directory:**
```
$ analyzeHeadless /tmp/ghidra-seam-probe/.dotdir DotProj -import tiny.bin -deleteProject
...
INFO  Headless startup complete (12407 ms) (AnalyzeHeadless)
...
ERROR Abort due to Headless analyzer error: Path element starting with '.' is not permitted (HeadlessAnalyzer)
java.lang.IllegalArgumentException: Path element starting with '.' is not permitted
	at ghidra.util.NamingUtilities.checkName(NamingUtilities.java:108)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkValidProjectPath(GhidraURL.java:440)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkLocalAbsolutePath(GhidraURL.java:421)
	at ghidra.framework.model.ProjectLocator.<init>(ProjectLocator.java:75)
	at ghidra.app.util.headless.HeadlessAnalyzer.processLocal(HeadlessAnalyzer.java:420)
	at ghidra.app.util.headless.AnalyzeHeadless.launch(AnalyzeHeadless.java:199)
real 0m15.967s   (exit code confirmed separately: 1)
```

**Probe B — dot two segments ABOVE the leaf (`/tmp/ghidra-dotparent/.hidden/leafdir`, leaf itself clean):**
```
$ analyzeHeadless /tmp/ghidra-dotparent/.hidden/leafdir DotParentProj -import tiny.bin -deleteProject
...
ERROR Abort due to Headless analyzer error: Path element starting with '.' is not permitted (HeadlessAnalyzer)
	at ghidra.util.NamingUtilities.checkName(NamingUtilities.java:108)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkValidProjectPath(GhidraURL.java:440)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkLocalAbsolutePath(GhidraURL.java:421)
	at ghidra.framework.model.ProjectLocator.<init>(ProjectLocator.java:75)
exit code: 1
```

**Both refused, identically**, before `HEADLESS: execution starts` in probe A and evidently at the same pre-analysis stage in probe B — the refusal happens inside `ProjectLocator`'s constructor, before `analyzeHeadless` reaches any import or analysis step, and **before it ever creates the project location directory** (confirmed: the pre-created `.dotdir`/`.hidden/leafdir` directories were left untouched, no project files written inside them). `[VERIFIED: live Ghidra 12.1.3 run, this session]`

**What this changes for the design, beyond what the ROADMAP states:** the refusal is not scoped to the project *name* or the immediate *location leaf* — it walks the **entire absolute path**. This project's own `.vice-supervisor/` state directory and `.planning/` tree are both dot-prefixed at their root, so **neither may appear anywhere in the ancestry of a Ghidra project location**. The existing, already-non-dot-prefixed `installTargetDir(root) = join(root, "tools")` (`install-resources.ts:91-93`) is the natural placement root — e.g. `<root>/tools/ghidra-runs/<runId>/`.

**What this means for SEAM-04's "enforced in this project's code" requirement:** because the refusal is a hard `exit 1` after ~12-16 s of JVM startup, validating client-side **before ever invoking `analyzeHeadless`** (a simple per-segment `.`-prefix check against the constructed project-location path) is strictly better than parsing Ghidra's own stderr for the literal `IllegalArgumentException` string — it fails in milliseconds instead of ~15 s, and it is the only way to literally satisfy "refused before `analyzeHeadless` is ever reached" (Success Criterion 3's own wording), since Ghidra's own refusal necessarily happens *inside* a running `analyzeHeadless` process.

**`-deleteProject` (`analyzeHeadlessREADME.md`, local copy, lines 280-284):** "the Ghidra project will be deleted after scripts and/or analysis have completed (only applies if the project has been created in the current session with `-import`; existing projects are never deleted)." `[CITED: local analyzeHeadlessREADME.md, Ghidra 12.1.3]` — confirms per-run-directory-plus-`-deleteProject` is sufficient for cleanup on the `-import` path; it does *not* delete on `-process` mode, which is one reason a per-run-directory design (rather than relying on `-deleteProject` alone) is the "better answer" the ROADMAP itself already names.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase in the sense the inventory targets (no renamed identifiers, no data migration). The two skill-script migrations (SEAM-05) move *where a spawn happens*, not any stored identifier or external service configuration, so the five inventory categories are not triggered.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `c1541`'s `chain`/BAM output, `petcat`'s SYS-stub decode format, and `cartconv`'s CRT bank-structure output all have the specific subcommand/output shapes `seeds/host-tool-executor.md`'s "First consumers" section describes | Don't Hand-Roll / seed's own text | The seed document itself flags this as sourced from `docs/vice-mcp-ideas.md`, "an LLM-authored summary, not a primary source, and not probed." All three binaries ARE present on this host (`/usr/local/bin/c1541`, `/usr/local/bin/petcat`, `/usr/local/bin/cartconv`) but this session did not run them or read their `--help`/man output. A planner building a typed allowlist entry for any of these three should run `--help`/`-h` against the real binary first |
| A2 | `-process` batch framing amortizes JVM startup cost across multiple binaries in one Ghidra invocation | JVM lifetime decision section | Not measured this session (would require a real multi-binary corpus and timing harness, out of this phase's scope per the ROADMAP's own framing). If false, the resident-JVM-behind-socket design (SEAM-07) is even more clearly the right call than the external-project survey alone suggests |
| A3 | GitHub Actions cost of installing Ghidra + a JDK is acceptable for CI | JVM lifetime / Environment Availability | This session's web search could not find a concrete published number. The 543 MiB Ghidra archive size WAS independently confirmed (`ghidra.zip`, 569,445,154 bytes = ~543 MiB on this host, matching `REQUIREMENTS.md`'s own "543 MiB" figure) — download/unpack time is the open unknown, not archive size |
| A4 | `skill-program-recon-cli.test.ts` plays the same "governs the real CLI contract via subprocess spawn" role for `packer-finding.mjs` that `skill-acme-build-cli.test.ts` plays for `acme.mjs` | Common Pitfalls, Pitfall 4 | File exists in the directory listing (confirmed via `ls`) but its contents were not read this session. If its role differs, the "what must stay green after migration" list in the plan needs adjusting |

**Risk framing:** none of these four assumptions block this phase's own success criteria (which are about the seam's existence and the acme/packer-finding migration, not about c1541/petcat/cartconv/dxa/Ghidra's actual tool integration — those are Phases 35-36's business). They matter for how far ahead a plan should design the typed allowlist's *shape* for future tools without over-committing to unverified subcommand details.

## Open Questions

1. **Namespaced-op-per-tool vs. one op with a typed payload field.**
   - What we know: the seed's own prose (`seeds/host-tool-executor.md`, "Shape" section) says "Every request carries a prefix naming the subsystem... Prefixed op values slot into that chain directly" — reading naturally as *one distinct `ControlRequestKind` member per tool or tool-family* (e.g. `"tool.acme.build"`, `"tool.dxa.run"`, `"tool.ghidra.analyze"`). The codebase's own most recent precedent (`D-15`, `broker-control.mts:39-43`) pulls the opposite way: "the launch profile is an added FIELD on the existing acquire op, not an eighth op... Adding an eighth kind here would have meant a second acquire path to keep in sync."
   - What's unclear: which shape SEAM-01/SEAM-02 actually want. Both satisfy "typed namespaced control op" and "typed per-tool allowlist" — the difference is where the typing happens (in the `ControlRequestKind` string literal itself, vs. in a narrowing function over a payload field on one generic op).
   - Recommendation: this is a genuine phase-discuss-level decision, not something research should resolve unilaterally — it changes how many times the two byte-exact `ControlRequestKind` tests are edited (once vs. once-per-tool-ever-added) and how much of the "typed allowlist" the wire protocol itself expresses vs. defers to a narrowing function. Flag for `/gsd-discuss-phase` or the plan's own first task.

2. **Where does the "invocation and its exit status recorded" requirement (Success Criterion 1) write to?**
   - What we know: nothing in the existing control plane persists a log of past requests — `broker-control.mts` is entirely request/response, no audit trail. `incident-record.ts` is the closest existing pattern (writes a pre-kill incident record) but is scoped to VICE crash/recycle events, not arbitrary tool invocations.
   - What's unclear: whether "recorded" means an in-memory list surfaced via a `status`-like query, a file under `.vice-supervisor/`, or simply the response object itself (which already carries exit status) with no separate persistence.
   - Recommendation: the cheapest reading that satisfies the success criterion literally is "the response carries exit status" (already required by SEAM-02's own wording) plus a stderr/stdout log line on the broker's own process output (mirroring how `vice-broker.mts` already writes `process.stderr.write` diagnostics elsewhere, e.g. `vice-broker.mts:1128-1130`). A persistent audit file is a heavier reading; confirm with the project owner if unclear.

3. **`skill-program-recon-cli.test.ts`'s actual scope** (see Assumption A4) — read it before finalizing which tests the plan's verification step must re-run green after `packer-finding.mjs` migrates.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | ✓ | v24.20.0 | — |
| npm | `npm pack --dry-run --json` (SEAM-05 gate) | ✓ | 11.19.0 | — |
| ACME | `acme.mjs` migration testing | ✓ | `/home/henrik/.local/bin/acme` | — |
| `x64sc` (fork) | shadows PATH per user memory | ✓ | `/usr/local/bin/x64sc` | — |
| `x64sc` (stock) | referenced by CLAUDE.md as genuine unpatched | ✓ | `/usr/bin/x64sc` | — |
| `c1541` | future seam consumer (not this phase) | ✓ | `/usr/local/bin/c1541` | — |
| `petcat` | future seam consumer (not this phase) | ✓ | `/usr/local/bin/petcat` | — |
| `cartconv` | future seam consumer (not this phase) | ✓ | `/usr/local/bin/cartconv` | — |
| `dxa` | future seam consumer, Phase 35 | ✗ | — | Vendored copy exists at `.planning/phases/23-.../evidence/tools/dxa` from Phase 23, not on PATH, not this phase's concern |
| `java` (JDK) | Ghidra, SEAM-07's design input | ✓ | OpenJDK 21.0.12.1 (Debian trixie build) | matches REQUIREMENTS.md's stated "JDK floor is 21" claim |
| Ghidra | SEAM-04/SEAM-07 live probing this session | ✓ (out-of-tree, unpinned) | 12.1.3, at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` | not vendored, not on PATH — matches `REQUIREMENTS.md`'s GHID-01 amendment exactly |

**Missing dependencies with no fallback:** none block this phase — this phase builds the seam itself and migrates two already-present-binary consumers (ACME, the packer oracle). `dxa` and a properly vendored Ghidra are Phase 35/36 concerns.

**Missing dependencies with fallback:** `dxa` — not this phase's blocking concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`), no separate framework |
| Config file | none — `package.json`'s `"test": "node --test '*.test.*'"` (`package.json:116`) is the whole config |
| Quick run command | `cd src/mcp/vice && node --test broker-control.test.ts spawn-seam.test.ts hostpath-consumers.test.ts host-scripts.test.ts` (targeted, sub-few-seconds) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (per `.planning/config.json`'s own `workflow.test_command`) — **note the project's own recorded floor is 2 failing tests in `anno-register.test.ts`, not 0** (see `docs/phase33-reproducible-run-gate-findings.md`'s own "Never a gate" baseline section); do not treat any residual `anno-register.test.ts` failure as caused by this phase |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEAM-01 | New control op dispatched before any lease-bearing path, consumes no lease | integration | `node --test broker-control.test.ts` (extend with a live-socket test injecting a stub `onHostTool` deps object and asserting `onAcquire`/`onRelease`/etc. are never called) | ❌ Wave 0 — new test cases needed in `broker-control.test.ts` |
| SEAM-02 | Typed per-tool allowlist, no argv passthrough, async child process | unit | `node --test host-tool.test.ts` (new file) | ❌ Wave 0 |
| SEAM-03 | 64 KiB cap observed as bare disconnect; result-by-reference | integration | The live-probe script this session wrote (see Finding 1) should become a committed test — `node --test broker-control.test.ts` (extend) or a new `host-tool-64k-cap.test.ts` | ❌ Wave 0 — commit the probe script as a real test |
| SEAM-04 | Dot-path refused before `analyzeHeadless` is invoked; per-run project dir | unit | `node --test <ghidra-path-validation>.test.ts` (new; must NOT require a real Ghidra install to run — validate the pure path-checking function against synthetic paths) | ❌ Wave 0 |
| SEAM-05 | Two violations migrated; grep gate observes a planted violation | structural | New `scripts/check-no-skill-external-spawn.mjs` (mirrors `spawn-seam.test.ts`'s discovery-not-enumeration discipline) + its own `*.test.ts`, using `packFiles()` from `scripts/check-npm-packages.mjs:134-146` against BOTH `installer/` (npm route) and a direct `src/skills/**/scripts/*.mjs` walk (plugin route, tracked in git) | ❌ Wave 0 |
| SEAM-06 | Second prefix floor + real positive control | structural | New test in the pattern of `hostpath-consumers.test.ts:211-297`, scoped to the new family's prefix | ❌ Wave 0 |
| SEAM-07 | Recorded decision with measurement + reversal condition | manual/doc | No automated test — this is a documentation deliverable (a decision record, per the ROADMAP's own framing: "a recorded decision carrying its measurement and its reversal condition") | N/A — doc artifact, not code |

### Sampling Rate
- **Per task commit:** the quick run command above, scoped to the files touched
- **Per wave merge:** `npm run test:automated` (accepting the pre-existing 2-failure `anno-register.test.ts` baseline as unrelated)
- **Phase gate:** full suite at the recorded baseline before `/gsd-verify-work`, plus `tsc --noEmit` (this project's build command) and `scripts/check-npm-packages.mjs` (tarball-lean check) both green

### Wave 0 Gaps
- [ ] `host-tool.test.ts` — unit coverage for the typed allowlist / argv-construction logic (SEAM-02)
- [ ] Extended cases in `broker-control.test.ts` — new-op dispatch isolation from VICE deps (SEAM-01), 64 KiB cap as a committed test (SEAM-03)
- [ ] A Ghidra path-validation unit test that does NOT require a real Ghidra install (pure string-checking function, tested against synthetic dot-prefixed paths) (SEAM-04)
- [ ] `scripts/check-no-skill-external-spawn.mjs` + its test — the new whole-tree (npm-pack-scoped) grep gate (SEAM-05)
- [ ] A second prefix floor test mirroring `hostpath-consumers.test.ts`'s template, plus one real on-disk positive-control module (SEAM-06)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing per-boot capability token, constant-time compared (`broker-control.mts:262-267,360-369`) — reused unchanged, no new auth mechanism |
| V3 Session Management | no | Control-plane connections are explicitly session-less (open/send/close, no lease) by SEAM-01's own design |
| V4 Access Control | yes | The typed per-tool allowlist itself IS the access-control boundary — no tool outside the allowlist is reachable, mirroring `DENY_LIST`'s existing discipline (`vice.ts:201,698`) |
| V5 Input Validation | yes | `normaliseLaunchProfile()`-style narrowing (refuse unknown keys by name, never coerce) is the pattern to mirror for every host-tool argument |
| V6 Cryptography | yes (narrow) | `node:crypto`'s `createHash("sha256")` for result digesting — never hand-rolled |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via wire-supplied argv | Tampering / Elevation of Privilege | Typed per-tool allowlist; argv constructed entirely server-side from typed fields, never from a raw wire array — this is SEAM-02's whole subject |
| Shell-string interpolation of a host-tool path | Tampering | `spawn()`/`execFile()` with an argv array and `shell: false`, never `exec()`/`execSync()` with a template string — mirrors `spawn-seam.test.ts`'s own shell-vs-argv distinction (though that guard is scoped to the emulator binary, the discipline is identical) |
| Path traversal via a tool argument that names an arbitrary host file | Tampering / Information Disclosure | Every path argument narrowed and validated before reaching argv; results confined to writing inside the bind-mounted workspace tree (see Pattern 4) so a malicious "output path" cannot escape to an unreachable or sensitive host location |
| A wedged/hung host tool starving the broker | Denial of Service | Async spawn (never `spawnSync`) plus a bounded timeout per invocation (mirrors `packer-finding.mjs`'s own existing `ORACLE_TIMEOUT_MS = 20_000` convention, line 160) |
| Broker-process-wide crash from an unhandled tool-invocation exception | Denial of Service | Run tool invocation in a child process with all failure paths captured as a response (never an uncaught throw in the broker's own process) — this is precisely what `broker-kill.mts:367-374`'s kill-the-whole-pool handler makes load-bearing here |

## Sources

### Primary (HIGH confidence — read directly from this repo's source at HEAD, or live-probed this session)
- `src/mcp/vice/broker-control.mts` — full read, control-plane dispatch, token gate, 64 KiB cap, `normaliseLaunchProfile()`
- `src/mcp/vice/broker-control.test.ts` (relevant sections) — the two byte-exact `ControlRequestKind` tests
- `src/mcp/vice/vice-broker-client.ts` (relevant sections) — container-side dial pattern, `sendAndAwaitLine()`, short-lived-connection precedent
- `src/mcp/vice/vice-broker.mts` (relevant sections) — where the seven VICE callbacks are wired to `startControlListener()`
- `src/mcp/vice/spawn-seam.test.ts` — full read, `EXPECTED_EMULATOR_SPAWN_SITES`, `EMULATOR_BIN_SHAPE` regex
- `src/mcp/vice/hostpath-consumers.test.ts` — full read, `EXPECTED_IMPORTERS`, `ANNO_MODULE_FLOOR`, the template to mirror
- `src/mcp/vice/build.ts` — full read, `HOST_BOUND_ARTIFACTS`, staged-build assertion
- `src/mcp/vice/tsconfig.build.json` — full read
- `src/mcp/vice/resources-sync.test.ts` — full read
- `src/mcp/vice/containerpath.ts` — full read
- `src/mcp/vice/vice.ts` (DENY_LIST section) — `vice.ts:201,698`
- `src/mcp/vice/broker-kill.mts` (verifiedKill, uncaughtException handler) — `:126`, `:367-374`
- `src/mcp/vice/install-resources.ts` (relevant sections) — `installTargetDir()`, `walk()`
- `src/mcp/vice/vice-proxy.ts` (line citations only) — confirmed `rewriteArguments()` call sites at HEAD: `:1529` (inside `gatherWedgeEvidence`, function starts `:1505`), `:3050` (inside `forwardToVice`, function starts `:2985`) — **no drift from CLAUDE.md's stated numbers**
- `src/mcp/vice/docs-linerefs.test.ts` (relevant sections) — confirms the mechanism that checks the above citations
- `src/skills/acme-build/scripts/acme.mjs` — full read
- `src/skills/c64-program-recon/scripts/packer-finding.mjs` — full read (note: seed's cited line numbers 247/306 have drifted to 255/314 at HEAD — content unchanged, only line numbers moved)
- `src/mcp/vice/skill-acme-build-cli.test.ts` (header + relevant sections) — the real CLI-contract governor for `acme.mjs`
- `src/mcp/vice/acme-gate.ts` (header) — test-only ACME availability probe, not shipped
- `scripts/check-npm-packages.mjs` (relevant sections) — `packFiles()`, the `npm pack --dry-run --json` mechanism (`:134-146`)
- `src/mcp/vice/host-scripts.test.ts` (relevant section) — `EXPECTED_TRACKED_SHELL_SCRIPTS`, verified no drift at HEAD
- `.github/workflows/ci.yml` (relevant section) — confirms CI's flat (non-devcontainer) invocation of `acme.mjs build` today, and its `apt-get install acme` step
- `.planning/seeds/host-tool-executor.md` — full read, the project owner's own rule and its stated design constraints
- `.planning/REQUIREMENTS.md` (SEAM-01..07, and surrounding sections) — full read
- `docs/phase33-reproducible-run-gate-findings.md` — full read; confirms `GATE-01`'s `degrade` verdict via `R6` narrows only the stop-identity oracle's frame term and explicitly does not touch `SEAM-*`
- Live probe, this session: `startControlListener()` from `broker-control.mts`, dialed directly with a >64 KiB unterminated line — see Finding 1
- Live probe, this session: real Ghidra 12.1.3 `analyzeHeadless`, twice, against dot-prefixed project-location paths at two different ancestor depths — see Finding 2
- Live probe, this session: `java -version` (OpenJDK 21.0.12.1), `which c1541/petcat/cartconv/dxa/x64sc/acme`, `ghidra.zip` byte size (569,445,154 bytes)

### Secondary (MEDIUM confidence — web search, cross-checked against multiple independent sources)
- WebSearch: resident-JVM-behind-a-localhost-socket pattern independently corroborated across `akiselev/ghidra-cli`, `mrphrazer/ghidra-headless-mcp`, and related projects — supports (without adding a new number to) the REQUIREMENTS.md claim of "four independent comparable projects converge on one resident JVM behind a localhost socket"

### Tertiary (LOW confidence — unresolved this session)
- GitHub Actions cost of installing Ghidra + a JDK — WebSearch returned no concrete figure; see Assumption A3 and the cheapest-experiment note below
- `seeds/host-tool-executor.md`'s "First consumers" subcommand/output-shape claims for `c1541`/`petcat`/`cartconv` — explicitly unprobed by the seed's own admission and not probed further this session (see Assumption A1)

## Metadata

**Confidence breakdown:**
- Standard stack / architecture (the seam itself): HIGH — every claim traces to a file:line read this session or a live probe run this session
- Ghidra behavior (SEAM-04): HIGH for the two things actually probed (dot-path refusal shape, `-deleteProject` semantics); MEDIUM for everything else about Ghidra (exit-code-on-postscript-throw, `-process` batch amortization) since those are Phase 36's own concern and were only lightly cross-checked here
- JVM lifetime decision (SEAM-07): MEDIUM — the resident-JVM pattern is corroborated but no new timing number was obtained this session; the REQUIREMENTS.md-cited 12.6-17.4s range is itself a Phase-33-era measurement this document did not re-run (this session's own probe run observed "Headless startup complete (12407 ms)" as one additional consistent data point, at the low end of that range)
- `c1541`/`petcat`/`cartconv` capability claims: LOW — explicitly unprobed, both by the seed and by this session

**Research date:** 2026-09-03
**Valid until:** 30 days (stable subsystem, no fast-moving external dependency in this phase's own scope) — but re-verify the four `file:line` guard citations (`docs-linerefs.test.ts`'s four numbers, `spawn-seam.test.ts`'s `EXPECTED_EMULATOR_SPAWN_SITES`, `hostpath-consumers.test.ts`'s two pinned constants, `host-scripts.test.ts`'s tracked-shell-scripts list) immediately before planning if any other phase's plan has landed in between, since every one of them is a byte-exact/count-exact assertion any unrelated commit could shift.
