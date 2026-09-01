<!-- refreshed: 2026-09-01 -->
# Codebase Concerns

**Analysis Date:** 2026-09-01

**Scope:** full repo, excluding `.claude/gsd-core/` (vendored, gitignored third-party
install — out of scope by `.planning/ENGINEERING_RULES.md` § 20.1) and `node_modules/`.

**Refresh note:** this replaces the 2026-08-11 audit, which was written against a tree
where the MCP server lived under `.claude/mcp/vice/`. **Every path in that audit is stale** —
the plugin payload moved to `src/` in v0.4.0 (Phase 16). Six of its entries are now
resolved and are recorded as such below rather than carried forward. A census of
`TODO`/`FIXME`/`HACK`/`XXX`/`@deprecated` across `src/`, `scripts/` and `installer/`
(`grep -a`, so `anno-memmap-render.ts`'s NUL byte cannot hide a hit) returns **zero real
markers** — every `XXXX` hit is a `$XXXX` hex-address placeholder in prose. This codebase
does not carry its debt in code comments; it carries it in
`.planning/todos/pending/` and in the per-phase `*-REVIEW.md` ledgers, which is where the
entries below come from.

---

## Resolved Since The Last Audit

Confirmed against the current tree. Do not re-raise these.

| Prior concern | Status | Evidence |
|---|---|---|
| "Entire tool surface depends on a non-upstream VICE fork; stock migration not started" | **Resolved as a decision, not as a removal.** A second, project-selectable stock backend shipped in v0.2.0 — `src/mcp/vice/tools-manifest.stock.json` advertises **38** tools against stock `x64sc`'s binary monitor, `tools-manifest.json` **62** for the fork. `FORK-01` = **retain**, dated 2026-08-22, with `KEYBOARD_MATRIX_SET` named as the reversal criterion. | `.planning/ROADMAP.md:221`; `src/mcp/vice/docs-fork-decision.test.ts:79-88` pins the decision row |
| "Three of six skill scripts have no automated tests" | **Resolved at the CLI contract level.** All three now have a driver test in the MCP suite. | `src/mcp/vice/skill-acme-build-cli.test.ts`, `skill-memory-mapping-cli.test.ts`, `skill-program-recon-cli.test.ts` |
| "Extensive orphaned planning references in source comments; no `CLAUDE.md`, no `.planning/`" | **Resolved.** `CLAUDE.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/ENGINEERING_RULES.md` and `.planning/todos/` all exist and are the live sources of truth. Two mechanical guards now keep the pointers honest. | `src/mcp/vice/docs-dangling-refs.test.ts`, `src/mcp/vice/docs-linerefs.test.ts` |
| "Three power-cycling resources are a safety hazard for any resource-set tool" | **Resolved by construction — the tool was cut, not guarded.** There is no `resourceSetBody()` and no `ResponseType.ResourceSet` case in the tree; only the read side exists. | `src/mcp/vice/stock-protocol.ts:955-970` (the load-bearing "do not add one" comment); `stock-protocol.ts:824` |
| "Generated `resources/*.mjs` committed alongside sources could go stale" | **Mitigated and holding.** | `src/mcp/vice/resources-sync.test.ts`, `build-atomic.test.ts` |
| "Phase-28 store blockers CR-05 / CR-06 / CR-07 open" | **Fixed in source**, though the todo still says otherwise — see *Stale disposition ledger* below. | `anno-store.ts:1057` (`FIX (CR-07)`), `:1121` (`STEP 3 IS GONE ON PURPOSE, and its absence is the fix for CR-05`), `:1691` (`CR-06, THE COMMIT ARM`) |

---

## Tech Debt

**`installer/skills/` is destroyed and rebuilt five times per audit run while four other test files read it (phase-32 `CR-07`, open across four review rounds):**
- Issue: `scripts/check-skill-cli-invocations.mjs:266-271` calls `execFileSync` on
  `installer/scripts/sync-skills.mjs` **at module scope**, before any check runs, whenever the
  resolved root is the repository. That script `rmSync`s and repopulates `installer/skills/`
  (`installer/scripts/sync-skills.mjs:74-80`). The adjacency loop at
  `src/mcp/vice/audit-root-args.test.ts:928-948` spawns the gate five times (baseline plus four
  `--root` spellings), all resolving to the repo root.
- Files: `scripts/check-skill-cli-invocations.mjs:266-271`,
  `installer/scripts/sync-skills.mjs:74-80`, `src/mcp/vice/audit-root-args.test.ts:928-948`
- Impact: under the parallel test runner, five other test files read `installer/skills/` while it
  is mid-rebuild. This is the **only Critical** finding in the phase-32 review and it has been
  carried untouched through rounds 3 and 4 with no mitigation added.
- Fix approach: gate the module-scope sync behind an explicit opt-in, or hoist it to a single
  run-once fixture the reading tests depend on. Named and re-verified live at
  `.planning/phases/32-the-deletion-and-the-grep-gate/32-REVIEW.md` § Critical Issues.

**Fifty-two open review findings on the in-flight phase, half-closed in a recognisable pattern:**
- Issue: the phase-32 round-4 review records `critical: 1, warning: 36, info: 15`. Three of the
  four things round 4 set out to fix are **half** closed, and in each case the unclosed half is
  the one the phase's own standard names: `WR-34` fixed for `plant.file` and left for
  `guard.cwd` (`scripts/audit-mutation-harness.mjs:560`, which still aborts the whole sweep on a
  bad registry value); `WR-28`'s liveness check added but the `'exit'`-vs-`'close'` half not
  (`src/mcp/vice/audit-harness-restore.test.ts:337, 361-368`); `WR-36` closed for `plant()` while
  `measureRow()`, `selectRows()` and `main()` — plan 32-15's whole deliverable — still ship with
  **zero standing coverage**.
- Files: `.planning/phases/32-the-deletion-and-the-grep-gate/32-REVIEW.md`;
  `scripts/audit-mutation-harness.mjs` (1235 lines), `scripts/audit-gate.mjs` (1286 lines)
- Impact: the audit instrument that gates every other guard is itself the least-covered code in
  the tree.
- Fix approach: the review already enumerates each id with a `path:line`. Prioritise `CR-07`,
  then `WR-34`'s `guard.cwd` half (blast radius: aborts the sweep), then `WR-36`'s coverage gap.

**Stale disposition ledger — pending todos assert findings are open that the source has fixed:**
- Issue: `.planning/todos/pending/2026-08-28-phase-28-review-round-3-five-open-findings.md`
  is titled *"disposition: OPEN, not fixed"* and carries `severity: blocker`, but all three of
  its blockers are fixed in `src/mcp/vice/anno-store.ts` (see the resolved table above). The
  todo files exist to give a review id a disposition that survives a `VERIFICATION.md` rewrite
  (`docs-review-disposition.test.ts:83-84,315`), so they are load-bearing for a guard — but
  nothing moves them to `completed/` when the code lands.
- Files: `.planning/todos/pending/` (10 files),
  `src/mcp/vice/docs-review-disposition.test.ts:315`
- Impact: a future session reading the todo tree to find live risk gets a false blocker count.
  `severity: blocker` on a closed item is worse than no record.
- Fix approach: sweep `pending/` against source, move the discharged files to
  `.planning/todos/completed/`, and consider having the disposition guard assert the *direction*
  (a fixed id must not sit in `pending/`) rather than only that some disposition exists.

**Line-number citations in tracked prose drift and are only partly machine-checked:**
- Issue: `CLAUDE.md` pins four `vice-proxy.ts` line numbers for the `rewriteArguments()`
  interception constraint (`MCP-02`), and `docs-linerefs.test.ts` mechanically checks two of
  them. Outside that guarded pair, citations rot: the review records `WR-15` as having drifted a
  **third** time — `.gitignore:53` cites `scripts/audit-mutation-harness.mjs:654`, where line 654
  is now an unrelated regex, and `IN-13` drifted to
  `scripts/generate-tool-support-table.mjs:384`.
- Files: `CLAUDE.md` (Architecture constraint `MCP-02`),
  `src/mcp/vice/docs-linerefs.test.ts`, `.gitignore:53,57-66`
- Impact: the project's own convention is to treat a mismatch as drift to re-verify, not as
  evidence the constraint changed — which works only if a reader knows which citations are
  guarded. Two are; the rest are not.
- Fix approach: extend `docs-linerefs.test.ts`'s pinned set, or replace unguarded numeric
  citations with a greppable semantic anchor (the pattern § 20.1 already mandates for the
  vendored tree).

**`vice-proxy.test.ts` cannot be run by the default `npm test` glob:**
- Issue: `src/mcp/vice/package.json`'s `test` script is `node --test '*.test.*'`, which hangs
  indefinitely on `vice-proxy.test.ts`. The usable gate is `npm run test:automated`
  (`package.json:113` → `node test-gate.mjs`), which excludes nine `MANUAL_ONLY_TESTS`
  (`src/mcp/vice/test-gate.mjs:95-106`).
- Files: `src/mcp/vice/package.json`, `src/mcp/vice/test-gate.mjs:95-106`
- Impact: the obvious command is the wrong one. A contributor running `npm test` gets an
  apparent freeze.
- Fix approach: the exclusion mechanism is sound and singly-sourced (a drift guard in
  `test-gate.test.ts` fails the build if a file escapes both lists). The remaining debt is that
  `npm test` itself is a trap — point it at `test-gate.mjs` and give the raw glob a distinct name.

**Skill scripts have CLI-contract tests but no unit tests of their internals:**
- Issue: several skill scripts still have no colocated `*.test.mjs`, including
  `src/skills/c64-provenance-diff/scripts/recovery-schema.mjs` (393 lines),
  `src/skills/c64-ram-capture/scripts/compare.mjs` (258 lines),
  `src/skills/acme-build/scripts/acme.mjs` (246 lines).
- Files: as above; contrast the colocated pattern in
  `src/skills/c64-ram-capture/scripts/watch-loads.test.mjs` and
  `src/skills/c64-provenance-diff/scripts/diff-images.test.mjs`.
- Impact: the CLI tests in `src/mcp/vice/skill-*-cli.test.ts` pin invocation and output shape,
  not internal logic (e.g. `acme.mjs`'s `--msvc` diagnostic regex).
- Fix approach: follow the colocated `*.test.mjs` pattern already established in two skills.

## Known Bugs

**`vice_disk_list` crashes the fork's shared host MCP server (deny-listed, never fixed):**
- Symptoms: the call kills the host-side emulator process for every consumer of that instance.
- Files: `src/mcp/vice/vice.ts:201-207` (`DENY_LIST`), `:229+` (`denyListRefusalMessage`)
- Trigger: calling the tool by name, or — the closed bypass — as a **nested argument** inside a
  generic meta-tool, which is why `tools_list`, `tools_call`, `initialize` and
  `notifications_initialized` are also in `DENY_LIST`.
- Workaround: permanent client-side refusal. Recovery after a real crash needs a manual host-side
  restart. Now defended at three layers: the name never reaches the stock manifest
  (`stock-dispatch.test.ts:435-439`), never duplicates into the capability registry
  (`capability-registry.test.ts:96-101`), and is stripped from discovery
  (`vice.test.ts:22`). `capability-registry.ts:22` states plainly that the registry is
  *"NEVER an authorization boundary"* and `DENY_LIST` remains the only one.

**`BACK-05` D-G ordering test fails deterministically whenever a live broker is running:**
- Symptoms: `src/mcp/vice/vice-proxy.test.ts:6382` fails with the `systemctl --user` broker unit
  active and passes with it stopped — same commit, same host.
- Files: `src/mcp/vice/vice-proxy.test.ts:6382`
- Trigger: a live VICE broker owning the emulator.
- Workaround: stop the broker before trusting any test result. **This is not a flake** — the todo
  measured it as deterministic in both directions
  (`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`,
  `severity: major`, unresolved).

**`WR-01`/`WR-02`: every `spawnSync` failure in the audit harness is reported as a timeout:**
- Symptoms: `timedOut: true` is set unconditionally inside `if (result.error)`, so `ENOENT`,
  `EACCES` and `ENOBUFS` all print "The control TIMED OUT." The guard `spawnSync` also keeps
  Node's 1 MiB default `maxBuffer` (`maxBuffer` is set only on `porcelain()`), so a chatty guard
  overflows into that same branch and is likewise misreported.
- Files: `scripts/audit-mutation-harness.mjs:578-600,767`; `:258` vs `:569-575`
- Trigger: any non-timeout spawn failure of a guard under the harness.
- Workaround: none. Read the raw spawn error rather than the rendered verdict when a guard
  reports a timeout that does not reproduce.

**Test-leaked scratch directories accumulate in `.planning/`:**
- Symptoms: 13 `.planning/vice-proxy-evidence-test-*` directories exist on the working tree.
- Files: `src/mcp/vice/vice-proxy.test.ts:4711-4726` (`tmpWorkspaceIncidentsDir()`)
- Trigger: running `vice-proxy.test.ts`. The directory *must* live inside the mounted workspace
  for the path translation under test to be real, so `/tmp` is not an option — but the caller's
  `finally` block does not remove the empty parent.
- Workaround: they are empty, so git does not track them and `git status` stays clean; they are
  **not** gitignored (`git check-ignore` → rc 1), so a non-empty one would show up as untracked
  noise. Harmless today, latent tomorrow. `rm -rf .planning/vice-proxy-evidence-test-*`.

## Security Considerations

**The broker control plane and the fork's MCP endpoint both bind `0.0.0.0` by design:**
- Risk: `src/mcp/vice/broker-control.mts:671` and `vice-broker.mts:987` default the control
  listener to `0.0.0.0`; `broker-launch.mts:217` does the same for the fork's `-mcpserver` host.
  The documented rationale is sound — `host.docker.internal` is a bridge address, not loopback,
  so a loopback-only bind is unreachable from a consumer's devcontainer.
- Files: `src/mcp/vice/broker-control.mts:22,671`, `vice-broker.mts:987`,
  `broker-launch.mts:120-126,217`
- Current mitigation: the broker's own control plane is gated by a per-boot random capability
  token compared with `timingSafeEqual`, *"checked BEFORE any state read or write"*
  (`broker-control.mts:22`) — this half is done correctly. The **stock** launch path is
  deliberately narrower than the fork's (`broker-launch.mts:126`) because the binary monitor
  serves exactly one client. The fork's own `-mcpserver` HTTP endpoint carries **no
  project-side auth**: `vice.ts`'s `call()` issues plain unauthenticated POSTs, and that endpoint
  offers arbitrary memory read/write, register and execution control.
- Recommendations: unchanged from the prior audit and still open — the fork is unvendored, so its
  auth properties cannot be audited here. Treat "the host running VICE is on a trusted network"
  as an undocumented deployment precondition and say so in `README.md`, or narrow
  `VICE_BROKER_MCP_HOST` where a bridge address is not needed.

**`guard.argv` from the registry is handed to `process.execPath` with no allow-list (`WR-35`):**
- Risk: `scripts/audit-mutation-harness.mjs:530-541,569-575` spawns `process.execPath` with
  registry-supplied argv. An entry of `argv: ["-e", "<js>"]` would be **evaluated** — which
  directly contradicts the file's own header clause at `:126-128`.
- Files: `scripts/audit-mutation-harness.mjs:126-128,530-541,569-575`
- Current mitigation: the registry (`guard-fates.json`) is committed and reviewed, so this is
  reachable only by someone who can already commit. `resolveBin()` also still maps
  `argv[0] === "--run"` to `npm` for a convention **0 of 61 rows use** (`WR-05`).
- Recommendations: add an argv allow-list, or drop the `-e`-shaped forms explicitly, so the
  header's claim becomes true rather than aspirational.

**Path-confinement discipline is now enforced by dedicated guards, but per-seam rather than globally:**
- Risk: the "no caller-supplied string ever reaches a path" hardening in
  `src/mcp/vice/incident-record.ts` is no longer the only instance — workspace confinement is
  `openStore`'s **default** as of Phase 28 (`df619ad`, plan 28-21), and three consumer-set guards
  now exist.
- Files: `src/mcp/vice/anno-confinement.test.ts`, `hostpath-consumers.test.ts`,
  `anno-cli-path-consumers.test.ts`, `incident-record.ts`
- Current mitigation: `CLAUDE.md`'s Architecture constraint requires every host-facing path
  through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`, with a *"tested closed
  consumer set"* — the guards above are that test.
- Recommendations: the model is sound; the residual is that `WR-04` records **no `realpathSync`
  anywhere in the seam or the harness** (`scripts/lib/audit-root.mjs:31-34,84-88`), so a symlink
  can still present a confined path that resolves outside. Latent, and the same shape as the
  store's `CR-05` symlink-aliasing bug that was already found and fixed once.

**Relative `--root` means two different things across the eight root-accepting scripts (`WR-16`):**
- Risk: `scripts/lib/audit-root.mjs:86` resolves against the **repo root**;
  `scripts/audit-gate.mjs:1187` resolves against the **process cwd**.
- Files: `scripts/lib/audit-root.mjs:86`, `scripts/audit-gate.mjs:1187`
- Current mitigation: none. Both refuse paths outside the repo root, so this is a correctness and
  containment-surface concern rather than an escape.
- Recommendations: make the seam the single resolver for all eight, which is what it exists for.

## Performance Bottlenecks

**A non-stopping checkpoint can stall the emulator thread from inside the CPU loop:**
- Problem: on the stock backend, a `stop:false` checkpoint emits one `CHECKPOINT_INFO` frame per
  hit **synchronously, over the blocking socket, from inside the CPU loop** —
  `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot
  address this stalls emulation.
- Files: `src/mcp/vice/stock-checkpoints.ts` (the `D-11` rate-limit guard);
  `src/mcp/vice/stock-a4-checkpoint-flood.test.ts` (measures the hazard deliberately)
- Cause: upstream VICE behaviour, not client code. Independently confirms `vice-sync.ts`'s
  *"poll on `hit_count`, never on paused state"* invariant.
- Improvement path: keep the `D-11` rate-limit guard in the path. The flood test is
  `MANUAL_ONLY` and *"must never run unattended in CI"* (`test-gate.mjs`, ninth entry).

**Every fork-backend state read pauses the emulator without resuming it:**
- Problem: only `vice_ping` is measured non-pausing (986,693 cycles/s vs 991,569 fully quiet);
  every other `vice_*` state read pauses and never auto-resumes.
- Files: `src/mcp/vice/vice-probe.ts`, `src/mcp/vice/vice-sync.ts`
- Cause: a property of the fork's `-mcpserver` implementation.
- Improvement path: unchanged — any new loop that reads emulator state repeatedly must poll via
  `vice_ping` and resume exactly once, per `vice-sync.ts`'s documented invariants.

**`vice_execution_run` remains the highest-risk single call against the fork:**
- Problem: `vice-sync.ts` records *"six outages in one session, the last three all on that
  call."* The mitigation is entirely client-side call-count minimisation.
- Files: `src/mcp/vice/vice-sync.ts`
- Cause: fork instability, not addressable here.
- Improvement path: preserve "exactly one resume per wait." Any change that raises the resume
  count raises the odds of crashing the shared emulator for the whole session.

**The largest files keep growing and two are the widest seams in the tree:**
- Problem: `src/mcp/vice/vice-proxy.ts` is **3,489** lines (was 3,093 at the last audit) and
  `vice-proxy.test.ts` **6,513**. `anno-store.ts` is **3,486** and `anno-tools.ts` **2,111**.
- Files: as above
- Cause: deliberate single-seam design — `vice-proxy.ts` owns registration, translation,
  forwarding, pagination, deny-list enforcement and incident/recycle handling for both backends.
  Not accidental sprawl.
- Improvement path: the prior audit's advice held for the stock backend (which landed as ~30
  sibling `stock-*.ts` modules rather than as growth in `vice-proxy.ts`) and the annotation store
  followed the same shape. Keep doing that; the concern is only that `vice-proxy.ts` still grew
  ~400 lines regardless.

## Fragile Areas

**Derived tools must be intercepted before `forwardToVice()`, never behind `call()`:**
- Files: `src/mcp/vice/vice-proxy.ts` (`rewriteArguments()` at `:3050` inside
  `forwardToVice()` at `:2985`; the second call site in `gatherWedgeEvidence()` at `:1529`,
  function start `:1505`)
- Why fragile: a derived tool placed behind `call()` receives **host-translated paths** and acts
  on them inside the container. `CLAUDE.md`'s `MCP-02` names this and both call sites. The
  `anno_*` family is safe *by construction* (it registers through `buildViceTool()` and never
  reaches `forwardToVice()`), not by an interception — so the guarantee does not transfer to the
  next family added.
- Safe modification: re-derive the constraint before adding any derived tool. All four cited line
  numbers moved by −2 in plan 29-10; treat a mismatch as drift, not as a changed constraint.
- Test coverage: `docs-linerefs.test.ts` checks the two `rewriteArguments()` citations
  mechanically. The *architectural* property is not mechanically checked.

**The broker launch / warm-floor / supervision subsystem:**
- Files: `src/mcp/vice/broker-launch.mts`, `vice-broker.mts`, `broker-state.mts`,
  `broker-kill.mts` (plus the compiled `resources/*.mjs` twins)
- Why fragile: the densest concentration of historical-incident commentary in the tree. The
  invariants that prevent recurrence are subtle and cross-file: a **single synchronous in-process
  `inFlight` boolean with no `await` between check and set** (the 2026-08-01 triple-launch
  outage), fixed-order warm-floor evaluation, PID-reuse-safe kill verification via a `ps -o args=`
  substring match, and epoch-based restart detection.
- Safe modification: `CLAUDE.md` states the guard *"must stay a synchronous check-and-set with no
  `await` between"* and is regression-tested. Validate any launch-path change against
  `broker-launch.test.ts`'s explicit 2026-08-01 regression case before merging.
- Test coverage: strong for the guard and state machine. The real-emulator timing it was tuned
  against is unreachable in CI — `vice-broker-launch.test.ts`, `broker-e2e.test.ts`,
  `stock-live-broker-monitor.test.ts` and `stock-broker-live.test.ts` are all `MANUAL_ONLY`.

**`vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested:**
- Files: `src/mcp/vice/vice-sync.ts` (`readCheckpoint`, `waitCheckpointHit`, `runToCheckpoint`,
  `reset`, `screenshot`)
- Why fragile: `CLAUDE.md` records this as an accepted testing decision — their correctness only
  means something against a real emulator's timing, and a fast deterministic stub would prove
  nothing about a resume count or a `hit_count` race. A regression is invisible to CI.
- Safe modification: preserve the documented invariants verbatim (exactly one resume per wait;
  poll on `hit_count`, never on paused state; never delete a VICE-marked `temporary` checkpoint)
  and verify live before merging.
- Test coverage: none for the timing-dependent core; the gap is acknowledged in
  `vice-sync.test.ts`. **This is a deliberately accepted risk, not an oversight.**

**Manual-only live suites are invisible to the automated gate, and have gone red silently before:**
- Files: `src/mcp/vice/test-gate.mjs:95-106` (nine files)
- Why fragile: on 2026-08-18 an additive widening of the restarted verdict's evidence
  (`jamObserved`) reddened `stock-live-triage.test.ts` on both real stock binaries **with zero
  signal from the gate**, surfacing only as a UAT miss.
- Safe modification: honour the standing rule added that day — every payload shape a manual-only
  suite depends on **must** have a mirror assertion in the automated set. The worked example is
  `stock-diagnose.test.ts`'s shape oracle for the restarted verdict.
- Test coverage: `test-gate.test.ts`'s drift guard ensures no file escapes both lists; it cannot
  ensure a manual-only file still passes.

**Assertions that pass under a total relaxation of the thing they claim to guard (`WR-38`):**
- Files: `src/mcp/vice/audit-harness-restore.test.ts` (`bad-plant-target-attribution`)
- Why fragile: the assertion carrying the comment *"This assertion is the one that must never
  change"* stayed green with the containment check **removed entirely**, because the escape target
  does not exist and `existsSync` refuses first. The test as a whole still reds via a message
  match, so it is not vacuous — but the assertion labelled as the containment guard is not the one
  guarding.
- Safe modification: point the escape target at something that exists, so `existsSync` cannot
  short-circuit ahead of the containment check.
- Test coverage: this *is* the coverage; the concern is that its self-description is wrong.

## Scaling Limits

**The stock binary monitor services exactly one client, machine-wide per instance:**
- Current capacity: one driver per emulator instance. A second `connect()` sits unserviced in the
  backlog with **no reply and no EOF** — indistinguishable from a wedge.
- Limit: any concurrent driver corrupts the evidence. `ENGINEERING_RULES.md` § 20 cites this as
  one of the two genuine reasons not to delegate a live task to a nested session.
- Scaling path: the broker must guarantee single-client-per-instance and must **not** diagnose
  this state as a hang — which is what the `monitor_held_elsewhere` verdict exists for
  (`src/mcp/vice/stock-diagnose.ts:410,623,885`; `stock-connect.ts:28`). Handled, and the handling
  is load-bearing.

**Single-host emulator pool:**
- Current capacity: one host's process and port budget; broker band from 6600, with 6510-6599
  reserved for a human-launched instance.
- Limit: no distributed/multi-host broker model.
- Scaling path: not planned, and given the one-client-per-instance constraint above, horizontal
  scale is bounded by instances rather than connections.

**`CPUHISTORY_GET`'s count wraps at 65536, and the opcode does not exist before VICE 3.10:**
- Current capacity: counts must be clamped client-side to 65535 — the wire field is read as uint32
  but stored in a `uint16_t` (`monitor_binary.c:1492`).
- Limit: Debian trixie/forky/sid and all current Ubuntu ship VICE **3.9**, which lacks the opcode
  entirely.
- Scaling path: Homebrew and official builds are fine. This is a capability floor on the stock
  backend, documented in `CLAUDE.md`'s Dependency constraint.

## Dependencies at Risk

**A patched, non-upstream VICE fork is a load-bearing runtime dependency for 62 of the tools:**
- Risk: `barryw/vice-mcp` (~17k lines of C patched into the emulator) is neither vendored, built,
  nor referenced by any build script here. `FORK-01` = **retain** is a dated, reviewed decision
  (2026-08-22) with a named reversal criterion, so this is **accepted, not unresolved** — but the
  dependency itself remains unauditable from this tree, which is why the fork endpoint's auth
  properties are unknown (see Security).
- Impact: the fork surface cannot run against any VICE a user installs from apt or Homebrew. The
  38-tool stock manifest is the answer for those users, and the surface is **trimmed per backend**
  by design (`D-07`), so a skill written against the full fork surface *breaks* on stock rather
  than degrading — the playbooks must name the stock route or the fork requirement (`SKILL-01`).
- Migration plan: none needed; the decision is retain. `docs/roadmap-stock-vice.md` and
  `docs/stock-vice-parity.md` are the live records, both pinned by `docs-dangling-refs.test.ts`.

**Resource names are not version-stable across VICE releases:**
- Risk: `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with **no alias**.
- Impact: a resource read that works on one stock build silently fails on another.
- Migration plan: `CLAUDE.md` records this as a Compatibility constraint;
  `stock-timing.ts:159-194` demonstrates the required shape — a `palFallback()` on every
  unexpected reply rather than a throw.

**Runtime dependencies are not vendored and need registry access on first use:**
- Risk: `@mastra/mcp` 1.15.0 / `@mastra/core` 1.55.0 are pinned but gitignored;
  `scripts/ensure-mcp-deps.sh` runs `npm ci` on `SessionStart`, hash-gated on the lockfile.
- Impact: on an air-gapped or registry-restricted machine the whole `vice` toolset is silently
  absent — the hook degrades gracefully rather than blocking, which makes the failure non-obvious.
- Migration plan: the installer's `--vendor` flag (`installer/bin/cli.mjs`) is the existing
  mitigation for consumers needing offline operation.

**Node ≥ 24 is now a hard floor for the MCP server:**
- Risk: the shipped server has **no build step** — it runs `.ts` directly via native type
  stripping. `src/mcp/vice/package.json:29` requires Node ≥ 24 (bumped 2026-09-01, commit
  `42f83bc`); CI moved four jobs from 22 → 24 in the same change.
- Impact: consumers on Node 22 lose the server entirely. The installer package still accepts
  Node ≥ 18 (`installer/package.json:11`), so a user can install successfully and then find the
  server will not start.
- Migration plan: none required, but the two engine floors disagreeing is a support trap worth a
  preflight check in the installer.

**TypeScript 7.0.2 as a typecheck-only devDependency:**
- Risk: a major-version jump ahead of the 5.x mainstream, tracking the native-compiler rewrite.
- Impact: contributors on older TS-aware tooling may see type-checking behaviour that differs from
  CI's `tsc --noEmit`.
- Migration plan: none needed; the choice is deliberate and paired with `verbatimModuleSyntax`
  and native type-stripping.

## Missing Critical Features

**Frame-exact emulator stop is the single gate on a real corpus, and nothing owns it:**
- Problem: `ROADMAP.md` calls a frame-exact stop *"the single gate"* on rule `R1`'s "secure a
  corpus first" branch. **No phase and no other todo owns it.** Phase 23 identified it and closed;
  Phase 24 *consumes* a corpus rather than producing one; Phase 26 records `AUTO-04`/`AUTO-05` as
  unvalidated rather than narrowed. Phases 24 and 26 are **held** for v0.8.0 on exactly this.
- Blocks: any real-release measurement. This is the largest single unowned gap in the project.
- Files: `src/mcp/vice/vice-sync.ts`;
  `.planning/todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md` (`severity: major`)

**Flat 64K capture still transcribes hex through the tool surface:**
- Problem: `vice_snapshot_save` already writes a `.vsf` containing the exact 64K, but the capture
  path reads 64 KB out as hex and reassembles it — which is how 23-03 lost a 32 KB write to
  truncation and an 8 KB write to ten silently dropped characters.
- Blocks: verified flat captures. The method to fix it is *already validated* (2026-08-26) and
  explicitly leaves the frame-exact-stop blocker untouched; between the two todos they are the
  whole of what stands between this project and a real-release measurement.
- Files: `src/skills/c64-ram-capture/SKILL.md`;
  `.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`

**No auth-verification story for the fork's `-mcpserver` HTTP endpoint:**
- Problem: nothing in this codebase can detect or warn a user that the endpoint is exposed
  unauthenticated on their network.
- Blocks: any confident security statement about the "host VICE reachable from a container"
  architecture. Carried forward from the prior audit, unchanged.

**Capability floors on the stock backend that no amount of client code can lift:**
- Problem: SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command,
  so read-back is **unrecoverable**. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches)
  is likewise unavailable — only the readable register map is. The matrix keyboard is not
  recoverable; `KEYBOARD_FEED` (0x72) injects buffer text only. There is no runtime `WarpMode`
  resource (deliberately, `vsync.c:220-241`), so warp must be launch-time. There is no monotonic
  cycle register.
- Blocks: any skill step needing those reads on stock. Recorded as Capability constraints in
  `CLAUDE.md` and surfaced in `docs/tool-support.md`; the honesty of that surfacing is guarded by
  `src/mcp/vice/skill-honesty-checks.test.ts` and `check-skill-fork-honesty.mjs`.

**`default_memspace` contamination has no remedy over the binary monitor:**
- Problem: a drive checkpoint hit sets it (`monitor.c:3393-3396`) and **no command resets it**,
  after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU and `@bank:`
  conditions fail outright.
- Blocks: any stepping code written after drive debugging is added. Latent today because drive
  debugging is not in the surface; a trap for whoever adds it.

## Test Coverage Gaps

**The audit instrument's own driver functions have zero standing coverage (`WR-36`):**
- What's not tested: `measureRow()`, `selectRows()` and `main()` in
  `scripts/audit-mutation-harness.mjs` — nothing in the tree imports or spawns them. That means
  the `D-05` verdict skip (whose own comment at `:743-748` names *"driven by the VERDICT, never by
  the absence of a descriptor"* as the load-bearing property) and the refused-plant containment
  that is **plan 32-15's entire deliverable** both ship uncovered.
- Files: `scripts/audit-mutation-harness.mjs:743-756,793-804`
- Risk: the instrument that gates every other guard in the repo is the least-guarded code present.
- Priority: **High.**

**Real-emulator timing behaviour, across the board:**
- What's not tested in CI: `waitCheckpointHit`, `runToCheckpoint`, `reset`, `screenshot`; the
  actual crash conditions that motivated launch serialisation; the fork's `-mcpserver` transport;
  broker-mediated monitor ownership; the A4 checkpoint flood.
- Files: `src/mcp/vice/vice-sync.ts`; the nine `MANUAL_ONLY_TESTS` in `test-gate.mjs:95-106`
- Risk: a regression surfaces as a live outage, not a CI failure. Partly structural (a stub
  emulator proves nothing about timing) and partly deliberate (the flood test must never run
  unattended).
- Priority: **High**, but mitigated by the standing mirror-assertion rule rather than closable.

**`withoutComments()` still strips trailing `//` from code lines (`WR-33`):**
- What's not tested correctly: `const doc = "see https://x"; writeFileSync(p, doc);` strips to
  zero write calls, so a real write can be missed. Whole-line comments are now blanked first, but
  the trailing arm still applies to code.
- Files: `src/mcp/vice/audit-root-args.test.ts:1295-1300`
- Risk: only-false-greens direction (it under-reports writes, never over-reports), and it is the
  sole mechanical revocation of `T-32-22`.
- Priority: **Medium.**

**The external fork's own security and input-validation properties:**
- What's not tested: whether the `-mcpserver` endpoint has any authentication, rate limiting, or
  validation against malformed JSON-RPC.
- Files: n/a — the surface lives entirely outside this repo.
- Risk: unknown and unknowable from here. Mitigated in practice by the trusted-local-network
  assumption; flag it for anyone deploying on a shared network.
- Priority: **Medium.**

## Notes For Future Auditors

- **`src/mcp/vice/anno-memmap-render.ts` contains two NUL bytes** — at offset 15097, inside a
  deliberate canonical-form separator (`JSON.stringify(...) + "\0" + sidecarBytes`). Plain `grep`
  treats the file as binary and **silently skips it**. Always use `grep -a` for a content census;
  a plain grep has already produced one false decision on this repo.
- **Do not run `npm test`** in `src/mcp/vice` — it hangs forever on `vice-proxy.test.ts`. Use
  `npm run test:automated`.
- **Stop the broker before trusting a test result** (`systemctl --user`), or `BACK-05` fails
  deterministically.
- **Licensing and attribution risk is explicitly owned and accepted by the maintainer** and is
  deliberately not listed as a concern here.
- The `.claude/gsd-core/` tree and its siblings are a vendored, gitignored install carrying zero
  local customisations; its defects are out of scope, and `.claude/gsd-local-patches/` should
  always be empty (`.planning/ENGINEERING_RULES.md` § 20.1).

---

*Concerns audit: 2026-09-01*
