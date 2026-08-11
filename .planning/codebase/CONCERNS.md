# Codebase Concerns

**Analysis Date:** 2026-08-11

## Tech Debt

**Entire tool surface depends on a non-upstream, out-of-repo VICE fork:**
- Issue: `vice-proxy.ts` and `vice.ts` talk HTTP JSON-RPC to a `/mcp` endpoint that only exists on a **custom/patched `x64sc -mcpserver`** build. Stock upstream VICE has no `-mcpserver` flag and serves no `/mcp` endpoint at all — this is documented as "the load-bearing dependency" in `docs/roadmap-stock-vice.md`.
- Files: `.claude/mcp/vice/vice.ts`, `.claude/mcp/vice/vice-proxy.ts`, `.claude/mcp/vice/broker-launch.mts` (constructs `-mcpserver -mcpserverhost -mcpserverport` args)
- Impact: the project cannot run against any VICE binary a user installs from apt/Homebrew/vice-emu.sourceforge.io. It requires a fork that is not built, vendored, or even referenced by build scripts anywhere in this repo — a silent, undocumented-to-the-installer external dependency. `README.md`'s install instructions never mention needing a special VICE build.
- Fix approach: `docs/roadmap-stock-vice.md` already lays out a 6-phase migration to drive stock VICE via its binary monitor protocol (`-binarymonitor`). Not started; tracked as "proposed."

**`vice_disk_list` is permanently deny-listed because it crashes the shared host server:**
- Issue: calling this tool is a known crash hazard for the external VICE MCP server process. The client-side workaround is a hardcoded refusal (`DENY_LIST`), not a fix.
- Files: `.claude/mcp/vice/vice.ts:171-243` (`DENY_LIST`, `denyListRefusalMessage`)
- Impact: functionality is permanently unavailable, and recovery from an accidental trigger (if the deny-list were ever bypassed) requires a **manual, host-side restart** of the emulator process — the MCP layer cannot self-heal from it.
- Fix approach: only resolvable upstream in the external VICE fork, or obsoleted entirely by the stock-VICE migration (binary monitor has no equivalent unsafe call).

**Confused-deputy gap in the generic-surface deny-list:**
- Issue: comments in `vice.ts` document that `tools_call`/`tools_list`/`initialize`/`notifications_initialized` were added to `DENY_LIST` specifically because a generic meta-tool could carry a forbidden tool name (`vice_disk_list`) as a **nested argument**, bypassing the outer-name-only guard.
- Files: `.claude/mcp/vice/vice.ts:183-243`
- Impact: the fix as implemented is described as closing this for the four named tools; the code references `.planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md` for the full history of the bypass — that file does not exist in this repo (see "Orphaned planning references" below), so the current completeness of the fix cannot be independently verified from this tree alone.
- Fix approach: re-derive/re-verify the bypass closure by grepping live tool schemas for any nested-argument path that could still carry `vice_disk_list`, since the original tracking document is unavailable.

**Historical concurrent-launch race ("the 2026-08-01 outage"):**
- Issue: extensive comments across the broker subsystem describe a real historical incident — three simultaneous `x64sc` launches raced the same `count_launching()` check, producing one SEGV, one `exit 1`, and one `exit 0` at the identical spawn second.
- Files: `.claude/mcp/vice/broker-launch.mts:53-75,400-441`, `.claude/mcp/vice/broker-state.mts:335-345`, `.claude/mcp/vice/vice-broker.mts:430-440`, `.claude/mcp/vice/broker-kill.mts:255-265,360-370,600-610`
- Impact: the fix (a single in-process `inFlight` boolean guard, "checked and set synchronously with no `await` between") is now load-bearing correctness for the whole broker; a regression here reproduces a real, previously-observed production outage, not a theoretical one.
- Fix approach: already mitigated by `tryLaunchOne()`'s single-owner guard and covered by `broker-launch.test.ts` ("criterion C: two concurrent launch requests... produce exactly one spawn (2026-08-01 triple-launch regression)"). Any future refactor of the launch path must preserve the synchronous check-and-set invariant.

**`vice_execution_run` is the single highest-risk call against the external host server:**
- Issue: `vice-sync.ts` documents "six outages in one session, the last three all on that call" against the resume/run tool. The mitigation is entirely client-side call-count minimization (poll via the non-pausing `vice_ping` instead of re-issuing resumes), not a fix to the underlying instability.
- Files: `.claude/mcp/vice/vice-sync.ts:1-40,204-230`
- Impact: any future change to `waitCheckpointHit()`/`runToCheckpoint()` that increases the resume call count directly increases the odds of crashing the shared emulator process for the whole session.
- Fix approach: preserve the "exactly one resume per wait" and "poll on hit_count, never on paused state" invariants documented at the top of `vice-sync.ts`; these functions are explicitly *not* unit-tested because their correctness only means something against a real emulator's timing.

**Generated build output (`resources/*.mjs`) is committed alongside its `.mts`/`.ts` sources:**
- Issue: `resources/` is `tsc` output that happens to be checked into git (per `resources-sync.test.ts`'s own header comment: "resources/ has just stopped being authored source and become build output that happens to be committed").
- Files: `.claude/mcp/vice/resources/*.mjs`, `.claude/mcp/vice/build.ts`
- Impact: a developer editing `broker-launch.mts` etc. and forgetting to rebuild would silently ship a stale deployed artifact.
- Fix approach: already mitigated by `resources-sync.test.ts`, which fails CI if the committed tree drifts from a fresh `build()` output — keep this test in the loop for any change under `.claude/mcp/vice/*.mts`.

**Skill scripts without any automated tests:**
- Issue: three of the six skills' driver scripts have no `*.test.mjs` counterpart, unlike `c64-provenance-diff` and `c64-ram-capture`, which do.
- Files: `.claude/skills/acme-build/scripts/acme.mjs` (263 lines), `.claude/skills/c64-memory-mapping/scripts/driver.mjs` (553 lines), `.claude/skills/c64-program-recon/scripts/derive.mjs` (364 lines)
- Impact: regressions in ACME diagnostic parsing, memory-map resolution, or program-recon derivation logic have no automated safety net.
- Fix approach: add `*.test.mjs` files mirroring the pattern already established in `c64-ram-capture/scripts/*.test.mjs`.

**Extensive orphaned planning references embedded in source comments:**
- Issue: hundreds of code comments across `.claude/mcp/vice/*.ts`/`*.mts` cite decision records and incident logs by ID (e.g. `D-04`, `D-07`, `D-24`, `01.6.2-CONTEXT.md`, `01.4-RESEARCH.md`) and reference `.planning/STATE.md`, `.planning/RE-FINDINGS.md`, `CLAUDE.md`'s "hazard note", and `.planning/todos/pending/*.md`. **None of these files exist in this repository** — this repo has no `CLAUDE.md`, no `.planning/STATE.md`, no `.planning/RE-FINDINGS.md`, and no `.planning/todos/` directory.
- Files: pervasive; heaviest concentration in `.claude/mcp/vice/vice-proxy.ts` (82 references), `vice-broker.mts` (40), `broker-launch.mts` (36), `vice.ts` (24), `install-resources.ts` (15), `broker-control.mts` (15), `broker-kill.mts` (14)
- Impact: the code was evidently extracted from a different project's development history (its own `.planning/` tree with full decision records) into this repo, but the referenced source-of-truth documents did not travel with it. Comments instructing a future maintainer to "re-verify against `.planning/STATE.md`" or "see CLAUDE.md's hazard note" point at nothing — any claim in these comments (measured cycle rates, incident timelines, decision rationale) is now unverifiable from this tree alone.
- Fix approach: either reconstruct a minimal `.planning/` (or `docs/`) record capturing the load-bearing claims these comments depend on (the 986,693 vs 991,569 cycles/s pause-on-read measurement, the 2026-08-01/08-02 outage timeline, the vice_disk_list crash hazard), or systematically strip dangling references and inline the still-relevant facts directly into the comments.

## Known Bugs

**`vice_disk_list` crashes the external VICE MCP server (deny-listed, not fixed):**
- Symptoms: calling this tool kills the shared host-side emulator process for every consumer of that instance.
- Files: `.claude/mcp/vice/vice.ts:171-176,229-235`
- Trigger: calling the tool by name, or (the closed bypass) via a nested argument inside a generic meta-tool call.
- Workaround: permanent client-side refusal via `DENY_LIST`; recovery after an actual crash requires a manual host-side restart of the emulator, which the MCP layer cannot perform itself.

**Ctrl-C during a broker operation on 2026-08-02 produced a specific bad state:**
- Symptoms: comment in `broker-kill.mts:367` states "On 2026-08-02 a `^C` produced [an interrupt or a closed terminal that] destroys [something]" — a real terminal-interrupt-induced failure mode.
- Files: `.claude/mcp/vice/broker-kill.mts:360-370`
- Trigger: interrupting (`SIGINT`) or closing the terminal mid-operation.
- Workaround: not fully quotable from this tree (the file this comment might have originally cross-referenced is one of the orphaned planning documents); read `broker-kill.mts:355-375` directly before touching signal handling in this file.

## Security Considerations

**The VICE control-plane host binds `0.0.0.0` by design (wildcard, not loopback):**
- Risk: `broker-control.mts`, `vice-broker.mts`, and `broker-launch.mts` all default their listeners to `0.0.0.0` (documented rationale: `host.docker.internal` is a bridge address, not loopback, so a loopback-only bind would be unreachable from inside a devcontainer). This means, on a machine without a host firewall, the broker's TCP control plane **and** the emulator's own HTTP `/mcp` endpoint are reachable from any other host on the same network segment, not just the local container.
- Files: `.claude/mcp/vice/broker-control.mts:16-20,507`, `.claude/mcp/vice/vice-broker.mts:795`, `.claude/mcp/vice/broker-launch.mts:90-100`
- Current mitigation: the broker's own TCP control plane (acquire/release/recycle/status) is gated by a per-boot random capability token compared with `timingSafeEqual` (`broker-control.mts:19-20`, using `node:crypto`'s `randomBytes`/`timingSafeEqual`) — this part is done correctly. **No equivalent token/auth was found protecting the VICE emulator's own `-mcpserver` HTTP endpoint itself** (`vice.ts`'s `call()` issues plain unauthenticated HTTP POSTs to `http://<host>:<port>/mcp`) — that endpoint allows arbitrary memory read/write, register control, and execution control of the emulator process to anyone who can reach the port.
- Recommendations: verify whether the external `-mcpserver` fork implements any auth of its own (not visible from this repo, since the fork's source is not vendored here); if not, restrict the bind to a firewalled/loopback-reachable interface where feasible, or document the network-exposure risk prominently for users running on shared/untrusted networks.

**Process-identity verification before kill signals guards against PID reuse, but is a string-substring match:**
- Risk: `verifiedKill()` refuses to signal a PID whose live `ps -o args=` output does not contain the `expectedIdentity` string, to avoid signalling an unrelated process that reused the tracked PID.
- Files: `.claude/mcp/vice/broker-kill.mts:59-142`
- Current mitigation: refusal path (`identity_refused`) is tested and logged rather than silently signalling.
- Recommendations: a substring match on `ps` output is heuristic, not a cryptographic identity check — a coincidentally-matching unrelated process's argv could in theory still pass. Low likelihood in practice given the identity strings used (full binary paths), but worth keeping in mind if this logic is ever generalized to less-specific identity strings.

**Filesystem write paths built from caller-controlled data are deliberately hardened, but the pattern is not universal:**
- Risk: `incident-record.ts` explicitly sanitizes all path-building inputs (UTC timestamp, integer port, integer epoch) and states "No caller-supplied string — specifically, never the caller's own 'reason' — ever reaches a path," a purposeful hardening against path injection via free-text fields.
- Files: `.claude/mcp/vice/incident-record.ts:12-19,38-55`
- Current mitigation: strong in this module. Not independently re-verified in this pass for every other module that builds filesystem paths from tool arguments (e.g. `containerpath.ts`, `hostpath.ts`, `install-resources.ts`) — worth a dedicated audit pass given how many host-filesystem writes this MCP server performs on behalf of an LLM-driven client.
- Recommendations: extend the same "no caller string reaches a path" discipline check to `containerpath.ts`/`hostpath.ts` explicitly during any future security review.

## Performance Bottlenecks

**Every state-reading VICE call pauses the emulator without resuming it:**
- Problem: per `vice-probe.ts`/`vice-sync.ts` comments, only `vice_ping` is measured non-pausing (986,693 cycles/s vs. 991,569 cycles/s fully quiet); every other `vice_*` state-read (checkpoint list, register get, etc.) pauses emulation and never auto-resumes.
- Files: `.claude/mcp/vice/vice-probe.ts:15-22`, `.claude/mcp/vice/vice-sync.ts:12-25`
- Cause: a property of the external `-mcpserver` fork's implementation, not something this repo's client code controls.
- Improvement path: `vice-sync.ts` already minimizes resume/read call counts as a workaround (poll via `vice_ping`, resume exactly once). Any new tool or workflow that reads emulator state repeatedly in a loop should follow the same pattern rather than polling a pausing call.

**`vice-proxy.ts` and its test file are very large single files:**
- Problem: `.claude/mcp/vice/vice-proxy.ts` is 3,093 lines and `.claude/mcp/vice/vice-proxy.test.ts` is 6,002 lines — the single largest source and test file in the repo by a wide margin.
- Files: `.claude/mcp/vice/vice-proxy.ts`, `.claude/mcp/vice/vice-proxy.test.ts`
- Cause: this is the sole seam that registers, translates, and forwards the entire ~63-tool MCP surface plus the continuation-token pagination mechanism, deny-list enforcement, and incident/recycle handling — a large amount of genuinely-related cross-cutting logic concentrated in one place by design (per its own header comments), not accidental sprawl.
- Improvement path: not urgent given the deliberate single-seam design, but any further growth (e.g. the stock-VICE migration's group B "client-side derivation" tools — disassembler, symbol store) should be evaluated for extraction into sibling modules rather than appended here, to keep the file navigable.

## Fragile Areas

**The broker launch/warm-floor/supervision subsystem (`broker-launch.mts`, `vice-broker.mts`, `broker-state.mts`, `broker-kill.mts`):**
- Files: `.claude/mcp/vice/broker-launch.mts` (893 lines), `.claude/mcp/vice/vice-broker.mts` (992 lines), `.claude/mcp/vice/broker-state.mts` (365 lines), `.claude/mcp/vice/broker-kill.mts` (637 lines)
- Why fragile: this is the area with the most historical-incident commentary in the whole codebase (the 2026-08-01 triple-launch outage, the 2026-08-02 outages, a documented Ctrl-C failure mode). The invariants that prevent recurrence are subtle and cross-file: a single synchronous in-process `inFlight` boolean with no `await` between check and set, a fixed-order evaluation pass for warm-floor maintenance, PID-reuse-safe kill verification, and epoch-based restart detection.
- Safe modification: any change to launch sequencing, port allocation, or the crash-supervision exit handler must preserve the "at most one launch in flight, checked and set synchronously" invariant and should be validated against `broker-launch.test.ts`'s explicit regression test for the 2026-08-01 incident before merging.
- Test coverage: strong for the synchronous-guard and state-machine logic (extensive `.test.ts`/`.test.mts` files exist per module), but the underlying real-emulator timing behavior these decisions were tuned against (measured cycle rates, actual `x64sc` crash conditions) cannot be exercised in CI at all — it is inherently only verifiable against the live, unvendored, non-upstream `x64sc -mcpserver` fork.

**`vice-sync.ts`'s checkpoint-wait functions are explicitly excluded from unit testing:**
- Files: `.claude/mcp/vice/vice-sync.ts` (`readCheckpoint`, `waitCheckpointHit`, `runToCheckpoint`, `reset`, `screenshot`)
- Why fragile: the file's own comments state these functions "are only meaningful against a real emulator's timing (a stub server answering fast and deterministically would prove nothing about a resume count or a hit_count race)" — meaning a regression here can only be caught by manual/live testing, never by the automated test suite.
- Safe modification: preserve the three documented invariants verbatim (exactly one resume per wait; poll on `hit_count`, never on paused state; never delete a VICE-marked `temporary` checkpoint) and manually verify against a live emulator before merging any change to this file.
- Test coverage: none for the timing-dependent core logic; `vice-sync.test.ts` carries a named todo entry acknowledging the gap.

## Scaling Limits

**Single-connection, single-machine emulator control:**
- Current capacity: the broker manages a pool of `x64sc` instances on one host, gated by `max_instances`/warm-floor settings and a port-allocation scheme starting at a configurable base port band (6600+ for the broker, 6510-6599 reserved for a human-launched instance).
- Limit: no distributed/multi-host broker model exists; scaling beyond what a single host's process/port budget allows is out of scope for the current architecture.
- Scaling path: not attempted or planned in current docs; the roadmap work (`docs/roadmap-stock-vice.md`) explicitly flags that the binary monitor is "a single, stateful TCP connection," meaning the migration itself will need to "review" the broker's concurrency model — a currently-unresolved open question, not just a future capacity question.

## Dependencies at Risk

**Runtime dependencies are not vendored and require network access on first use:**
- Risk: `@mastra/mcp` (1.15.0) and `@mastra/core` (1.55.0) are pinned exact versions but never committed to the repo (`node_modules/` is gitignored). `scripts/ensure-mcp-deps.sh` runs `npm ci` on `SessionStart`, requiring `node`+`npm` on `PATH` and live registry access on the consumer's machine.
- Impact: on an air-gapped, offline, or registry-restricted machine, the entire `vice` MCP server silently becomes unavailable ("tools will be unavailable until it succeeds" — the hook is designed to degrade gracefully rather than block the session, but the practical effect is a non-obvious missing toolset).
- Migration plan: none currently planned; `--vendor` installer flag (`installer/bin/cli.mjs`) allows a project to `npm install` `@henols/vice-mcp` locally instead of via `npx`, which is the existing mitigation for consumers who need offline/pinned operation.

**TypeScript 7.0.2 as a `devDependency`:**
- Risk: `.claude/mcp/vice/package.json` pins `"typescript": "7.0.2"` — a major-version jump from the TS 5.x line most of the ecosystem is on, tracking TypeScript's native-compiler rewrite. Tooling/editor compatibility for a pre-5→7 jump is less battle-tested than a mainstream version.
- Impact: contributors on older TypeScript-aware tooling (editor plugins, other build systems) may see inconsistent type-checking behavior versus CI's `npm run typecheck`.
- Migration plan: none needed unless compatibility issues surface; note the version choice is deliberate (paired with `"type": "module"`, `verbatimModuleSyntax`, and native Node type-stripping execution of `.ts` files directly as documented in multiple header comments).

## Missing Critical Features

**No auth-verification story for the external VICE `-mcpserver` HTTP endpoint from within this repo:**
- Problem: as noted under Security, this repo's client code assumes an HTTP endpoint it does not control and cannot audit (the fork's source is not vendored). There is no capability in this codebase to detect or warn a user if that endpoint is exposed without authentication on their network.
- Blocks: any confident security posture statement about the "run a host VICE emulator reachable from a container" architecture, until the external fork's own security properties are documented.

## Test Coverage Gaps

**Real-emulator-timing-dependent broker/sync logic:**
- What's not tested: `waitCheckpointHit`, `runToCheckpoint`, `reset`, `screenshot` in `vice-sync.ts`; the actual crash/outage conditions that motivated the broker's launch-serialization design.
- Files: `.claude/mcp/vice/vice-sync.ts`, `.claude/mcp/vice/vice-sync.test.ts` (named todo entry)
- Risk: a regression in resume-count or hit_count-polling logic would only surface as a live emulator outage, potentially reproducing a historical incident, not as a CI failure.
- Priority: High — this is the exact class of bug that has caused multiple documented production outages already.

**Three of six skill scripts have no automated tests:**
- What's not tested: `acme-build/scripts/acme.mjs`, `c64-memory-mapping/scripts/driver.mjs`, `c64-program-recon/scripts/derive.mjs`.
- Files: see paths above; contrast with `c64-provenance-diff/scripts/diff-images.test.mjs` and `c64-ram-capture/scripts/*.test.mjs`, which do exist.
- Risk: diagnostic-parsing regressions (e.g. ACME's `--msvc` error-format regex in `acme.mjs`) or memory-map/derivation logic errors would ship undetected.
- Priority: Medium.

**External-fork security properties are entirely untested/unverifiable from this repo:**
- What's not tested: whether the `-mcpserver` HTTP endpoint on the emulator itself has any authentication, rate-limiting, or input validation against malformed/hostile JSON-RPC payloads.
- Files: n/a — the surface under question lives entirely outside this repo, in the unvendored custom `x64sc` fork.
- Risk: unknown; cannot be assessed without access to that fork's source.
- Priority: Medium — mitigated in practice by the architecture's assumption of a trusted local/dev-network environment, but worth flagging explicitly for anyone deploying this in a shared or multi-tenant setting.

---

*Concerns audit: 2026-08-11*
