# Phase 62: The Fixed Endpoint and the Broker That Owns the Machine - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A user starts one broker on their machine, by hand, and every client — the MCP
server on a bare host, the MCP server inside a devcontainer, a skill script
anywhere — finds it with nothing on disk telling them where it is. The dial
order **is** the host/container detection, so no client code reads
`isInsideContainer()` to decide how to reach the broker.

**What this phase writes:** a `hello` handshake on the existing control plane, a
two-candidate dial with per-candidate timeouts, a narrowed startup bind, a
machine-level state root, a `broker` verb on the `vice-mcp` bin, and two
committed service definitions with the CI gate that keeps them un-applied.

**Explicitly NOT in this phase:** any deletion. `broker.json`, `hostpath.ts` /
`containerpath.ts` / `stock-paths.ts`, the eight existing control ops and the
direct-dial path all keep working, untouched, in parallel for the whole phase.
`broker-launch.mts`'s `inFlight` guard is not touched — a machine-level broker
does not change how the broker spawns its own children.

**Two exceptions to "nothing changes", both deliberate and both recorded below:**
D-11 rewrites the stale `0.0.0.0` guidance now rather than in Phase 66, and D-12
records that narrowing the bind necessarily changes an existing default and
reddens two existing tests. Neither is a deletion; both are in-phase costs the
owner accepted with the cost stated.

**Also not in this phase:** the session model (`SESS-01..06`, Phase 63), file
transfer (`XFER-01..08`, Phase 64), the skill-script seam (`SEAM-01..03`, Phase
65), and every deletion (`RM-01..08`, Phases 65-67).

</domain>

<decisions>
## Implementation Decisions

### Starting the broker, and what replaces the per-project deployment

- **D-01: The start command is `npx -y @henols/vice-mcp broker`.** Claude's
  discretion, delegated. The decisive reason is not convenience: under this
  milestone there is no bind mount and no path translation, so a containerized
  client **cannot name a host path at all**. `ENDPOINT-04` requires the refusal
  to carry "the exact command to start one on their platform", and only an
  npm-invocation form is a fixed string that is correct and identical whether
  the client runs on the host or in a container. The two path-bearing
  alternatives (run `resources/vice-launcher.sh` in place; deploy a launcher to
  a machine-level bin) both produce a path the refusing client has no way to
  compute. This is an *invocation*, not an install — the same shape as the
  project's already-documented `npx -y @henols/vice-mcp anno <verb>` route,
  which `CLAUDE.md` explicitly carves out of the never-auto-install rule.
  — **Reversibility:** costly — the string is quoted in `ENDPOINT-04`'s refusal,
  in `README.md`, in both service definitions and as the documented universal
  fallback; changing it later means changing all five together.

- **D-02: The `broker` verb is a subcommand on the existing `vice-mcp` bin,**
  mirroring the existing `vice-mcp anno <verb>` CLI rather than adding a second
  bin entry.

- **D-03: The Node-floor refusal needs a `.mjs` entry point to survive.**
  `src/mcp/vice/package.json`'s bin is `vice-mcp` → `vice-proxy.ts`, a **`.ts`**
  file. Below Node 24, native type-stripping throws a syntax error before any
  code in that file runs, so a floor check written *inside* it can never
  execute. Today `resources/vice-launcher.sh` owns this refusal in bash
  (`VICE_BROKER_NODE`, the `engines.node` floor mirror, refusing by name before
  `exec`), and D-04 retires that script's deployment. The planner must therefore
  give the `broker` verb a `.mjs` entry that checks `process.versions.node`
  against the floor and refuses by name before importing anything type-stripped.
  `VICE_BROKER_NODE` keeps its meaning. — **Reversibility:** reversible.

- **D-04: `install-resources.ts` is obsolete. The verdict is recorded here; the
  deletion is executed in Phase 66.** This answers the roadmap's flagged open
  question 1, explicitly and not by inference. Phase 62 deletes nothing, so the
  module keeps working untouched through this phase.

  *Evidence the deployment has no consumer left.*
  `resources/vice-launcher.sh:135` sets
  `BROKER_ARTIFACT="$SELF_DIR/vice-broker.mjs"` — it execs the broker artifact
  sitting **beside itself**, which means the whole per-project deployment exists
  only to co-locate those two files, and `src/mcp/vice/resources/` already
  contains both. `resources/vice-launcher.sh:287` then execs
  `--repo-root "$REPO_ROOT"`: that argument **is** the per-project binding
  `BROKER-01` removes.

  *What goes with it:* `repo-root.ts:59`'s import and `repo-root.ts:303`'s
  module-load `ensureResourcesInstalled({ root: repoRoot() })` side effect,
  `installTargetDir()`, the `VICE_SKIP_RESOURCE_INSTALL` opt-out, and
  `vice-proxy.ts:721-739`'s `hostLaunchInstructions()` D-4 prose (which points
  the user at the deployed copy). `host-tool.mts:3247` cites
  `installTargetDir()`'s convention in a **comment**, not an import — that
  comment needs updating, but it is not a census importer.

  *What does NOT go with it:* `build.ts` and `resources-sync.test.ts`.
  Compiling the host-bound `.mts` files into committed `resources/*.mjs` is
  independent of *deploying* them, and an npx-started broker runs the package's
  own `resources/*.mjs` in place. A reader who deletes the build step by
  association has broken the one thing that still needs to work.

  *Milestone effect:* this unblocks Phase 66's convergence metric. The count of
  real importers of the path-translation trio stands at **6** at the milestone
  open and must reach **0**; `install-resources.ts` is one of the six and was
  the only one whose fate was undecided.
  — **Reversibility:** one-way — restoring it would mean reinstating the
  per-project deployment model this milestone exists to retire, and the
  `--repo-root` argument that goes with it.

### The handshake, version skew, and what the client says when the dial fails

- **D-05: Compatibility is "package major version must match."** Direct owner
  decision, taken after the alternative (a separate wire-protocol integer moving
  only on a breaking wire change) was put and declined. Not up for
  re-litigation by the researcher or the planner.

  *Supporting fact the planner should know:* CI derives both packages' versions
  from the same `v*` tag and publishes them together, so within a release
  `@henols/vice-mcp` and `@henols/c64-re-tools` are always equal. Skew therefore
  exists only when a user updates one and not the other — which is exactly the
  case `ENDPOINT-05` exists to make legible.

  *Named cost, accepted:* the wire contract is tied to release cadence, so a
  major bump taken for an unrelated reason forces a lockstep broker upgrade that
  nothing technically required.
  — **Reversibility:** costly — introducing a separate wire integer later means
  a compatibility rule that must understand both schemes during the overlap.

- **D-06: The handshake is a dedicated `hello` op, sent as the first line of
  every connection.** Claude's discretion, delegated. It becomes the ninth
  `ControlRequestKind` in `broker-control.mts:57` and drops into the existing
  op switch; it reuses the existing one-JSON-object-per-line framing, so no new
  envelope format is introduced and decision 6 holds. The reply carries a magic
  string identifying this protocol, the broker's package version, and the
  connection's tag.

  The two alternatives were rejected for concrete reasons: reusing `status`
  requires the token that decision 5 drops and describes instances rather than
  identity; a server-speaks-first banner inverts the protocol's shape and the
  existing client — which must keep working in parallel all phase — would read
  the banner as an unsolicited response.

  *The stale-broker discriminator falls out for free.* A pre-v2.0.0 broker
  checks the per-boot token **before** any dispatch, so `{"op":"hello"}` with no
  token returns `{"ok":false,"code":"unauthorized"}`; if a token check were
  somehow satisfied it would return `bad_request` for an unknown op. Both codes
  are already in `ControlErrorCode`, so "speaks this protocol but not this
  handshake" is a positive identification of a stale broker, not a guess.

- **D-07: Both candidates are always dialled. The first *completed* handshake
  wins, and the refusal reports the most informative failure seen across both.**
  Claude's discretion, delegated. This is a refinement of the "depends on the
  failure kind" option rather than any of the three as offered.

  *Why not stop on candidate 1.* Inside a container, `127.0.0.1:19510` is the
  **container's own loopback** — a different network namespace entirely — so
  candidate 1 failing is expected rather than exceptional, and candidate 1
  *answering* is not evidence of anything about the host. A version refusal is
  not a completed handshake, so it does not short-circuit either: stopping there
  would lose a compatible broker reachable at candidate 2. The cost is one extra
  bounded timeout, and only on the failure path.

  *Four observable outcomes per candidate, ranked by informativeness. Report the
  highest rank seen across both:*
  1. connect refused, or `host.docker.internal` does not resolve → nothing listening
  2. connected, but no valid reply / timeout / non-JSON → a foreign listener squatting the port
  3. connected, replies `unauthorized` or `bad_request` → a stale pre-v2.0.0 broker (per D-06)
  4. connected, valid `hello`, incompatible major → a genuine broker at the wrong version; name which side to update (`ENDPOINT-05`)

  `ENDPOINT-02`'s per-candidate timeout is what makes this safe: a wedged
  listener parked on candidate 1 must not prevent candidate 2 from being tried.

- **D-08: The rootless-Docker disclosure is gated on a dial-observed condition,
  never on container detection.** Claude's discretion, delegated; this answers
  the roadmap's flagged open question 2.

  The obvious gate — "show it when the client is in a container" — would
  reintroduce in the client exactly the `isInsideContainer()` call `RM-03`
  deletes, and would contradict this phase's own premise that the dial order
  *is* the detection. The dial gives a better signal anyway: **`host.docker.internal`
  resolved, but the connection failed.** If it does not resolve, the client is
  on a bare host or in a container missing `--add-host`. If it resolves and the
  connection fails, the gateway route is blocked — which is precisely the
  RootlessKit `slirp4netns --disable-host-loopback` signature.

  *Wording constraint:* the claim is community-sourced with no vendor
  confirmation (MEDIUM confidence). The line states it as a possibility to
  check, with that provenance disclosed, and never as the diagnosis. Podman
  >= 5.0's `pasta` default is `DEFER-01` and is not mentioned at all.

### What the broker binds

- **D-09: An interface-name allowlist.** Direct owner decision. The broker binds
  loopback plus addresses on interfaces named `docker0`, `br-*`, `podman*` and
  `cni-*`. The "allowlist plus an env override" variant was offered and **not**
  taken, so there is no knob — a bridge under an unlisted name is simply not
  bound, and that cost was accepted. Binding every RFC1918 address was rejected
  because it would also bind the machine's own LAN address, which on untrusted
  wifi is close to the `0.0.0.0` decision 5 forbids.

  *Platform asymmetry the planner must not misread as a bug.* On macOS, Docker
  Desktop runs in a VM and there is no host-side bridge interface;
  `host.docker.internal` NATs to the host's loopback. Enumeration finding **no
  bridge candidate on macOS is correct**, not a failure. The roadmap's "refuse by
  name if no candidate can be bound" must therefore fire only when the *total*
  bound set is empty — that is, loopback itself failed — never when only the
  bridge set is empty.
  — **Reversibility:** reversible — the allowlist is a list.

- **D-10: The bind set is enumerated once at startup and is immutable for the
  process's life.** Direct owner decision. A bridge that appears later — Docker
  started after the broker — needs a broker restart, and that is documented
  rather than worked around. Neither periodic re-enumeration nor a
  watch-and-warn timer is built. This matches `BROKER-03`'s "enumerates at
  startup" wording literally and keeps the bind set trivially auditable, which
  is the property the whole security posture rests on now that the token is
  gone.

- **D-11: The stale `0.0.0.0` guidance is rewritten in Phase 62, not Phase 66.**
  Direct owner decision, taken with the ownership cost stated in the question
  and chosen anyway.

  *Consequence to reconcile, recorded so it is not discovered later:* `RM-04`
  ("the stale in-code guidance that the broker must bind `0.0.0.0` is rewritten
  wherever it appears") is a **Phase 66** requirement and will find its work
  already done. Phase 66's ledger needs reconciling rather than re-executing,
  and `REQUIREMENTS.md`'s traceability table still maps `RM-04` to Phase 66.

  *Scope — four production sites, not one:*
  - `src/mcp/vice/broker-control.mts:20` — the rule itself
  - `src/mcp/vice/resources/broker-control.mjs:26` — the compiled copy. It is
    regenerated by `build.ts` and `resources-sync.test.ts` fails CI on drift, so
    the regenerated file must be committed in the same change.
  - `src/mcp/vice/vice-broker-client.ts:195-197` — **quotes the rule verbatim**
    as the justification for its own dial behaviour
  - `src/mcp/vice/vice-errors.ts:51` — states "the broker binds `0.0.0.0`" as fact
  - (`src/mcp/vice/vice-proxy.ts:820` references the bind address in prose and
    should be checked in the same pass.)

- **D-12: Narrowing the bind is a behaviour change to an existing default, and
  it reddens two existing tests. This is an accepted in-phase cost.** Recorded
  separately from D-11 because it has nothing to do with comments. The default
  at `vice-broker.mts:1134` and `broker-control.mts:920` is
  `VICE_BROKER_CONTROL_HOST ?? "0.0.0.0"`, and `broker-e2e.test.ts:364` and
  `vice-broker-launch.test.ts:231` both assert `control_host === "0.0.0.0"`.
  Those assertions must be updated in this phase. The phase's "nothing is
  deleted, everything keeps working in parallel" shape covers deletions; it does
  not cover a changed default, and a planner who assumes otherwise will be
  surprised by a red suite.

### Where the broker lives on the machine

- **D-13: The machine-level root is `~/.c64-re-tools/`, with an env override.**
  Direct owner decision. The same directory name the project already uses, one
  level up from any repo — one string on every platform, one docs line. The
  per-platform conventional alternative (`$XDG_STATE_HOME` on Linux,
  `~/Library/Application Support/` on macOS) was offered and not taken.

- **D-14: One new `VICE_BROKER_HOME` names that root and supersedes the existing
  four.** Direct owner decision. `VICE_POOL_DIR`, `VICE_SUPERVISOR_DIR`,
  `VICE_INCIDENTS_DIR` and `VICE_EPOCH_FILE` keep working unchanged through the
  parallel period and are removed in Phase 66. D-13's override and D-14's
  superseding variable are **the same variable** — there is one new knob, not
  two.

  *Flagged rather than silently absorbed:* **no v2.0.0 requirement currently
  owns removing those four.** `RM-01..05` and `RM-07` cover the path-translation
  trio, `broker.json`, the two-route host/container branch, the stale
  `0.0.0.0` guidance and the dead guard comments — not these env vars. Phase 66
  taking this on is unowned work, and it should be raised at roadmap level
  rather than assumed by a planner.
  — **Reversibility:** costly — the four names appear across tests, `CLAUDE.md`
  and the broker's own resolution paths; collapsing them is a one-way trim of a
  documented interface in a major version.

- **D-15: Service definitions ship as committed files, and "never auto-applied"
  is made structural by a CI grep gate.** Claude's discretion, delegated. A
  systemd `--user` unit and a launchd plist are committed with README copy-paste
  steps the *user* runs, and a gate asserts that no module anywhere in the tree
  invokes `systemctl` or `launchctl` — the same shape as the project's existing
  host-tool route gate, which has been observed biting on planted violations.

  *Why no `--print-unit` verb.* Its only justification was that a committed unit
  cannot embed a correct absolute path for every machine. D-01 removes that:
  `npx -y @henols/vice-mcp broker` works verbatim as `ExecStart` via
  `/usr/bin/env`, so the committed unit needs no machine-specific path. A second
  rendering path that can drift from a committed file is precisely the failure
  mode the v1.1.0 milestone existed to remove.

  *`VICE_BROKER_NODE` stays reachable* through the unit's `Environment=` — it
  exists for exactly the service case, where PATH may carry no usable node.

  *The universal fallback is the same string:* `npx -y @henols/vice-mcp broker`
  run in the foreground. One command, three places, no divergence.

- **D-16: The warm floor is untouched in Phase 62.** See Deferred Ideas for the
  sharpened reasoning this discussion produced.

### Claude's Discretion

The user delegated six decisions with "you decide". Each is recorded above with
its reasoning so the planner can disagree **in writing** rather than silently:

| Decision | What was delegated |
|---|---|
| D-01 / D-02 / D-03 | The start command, its CLI shape, and where the Node-floor refusal lives |
| D-04 | `install-resources.ts`'s verdict and when the deletion lands |
| D-06 | The handshake's shape |
| D-07 | Candidate-failure handling and the refusal's ranking |
| D-08 | The rootless-Docker disclosure's gate and wording |
| D-15 | The service-definition shape |
| D-16 | Whether the warm floor is this phase's work |

D-07 and D-08 are refinements that no offered option contained. Both were
produced by a constraint the options had missed — D-07 by the container's
separate loopback namespace, D-08 by `RM-03`'s deletion of client-side container
detection. A planner who finds a third such constraint should say so rather than
implement an option as originally worded.

### Folded Todos

All four keyword matches were folded. Two carry an explicit `resolves_phase` tag
pointing at another phase; they are folded **for awareness**, and this phase does
not resolve them.

- **`BACK-05 D-G ordering test fails deterministically on a live-broker host`**
  (`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`,
  tagged `resolves_phase: 66`). `vice-proxy.test.ts:6382` fails deterministically
  whenever a live VICE broker owns the emulator and passes when none is running.
  **How it fits:** the roadmap already names this as one of four testing traps
  Phase 62 must design around from the start. Folding it means every test this
  phase writes uses a dynamically allocated port or explicitly refuses to run
  against an unexpected listener — and that a machine-level broker, which is now
  *expected* to be running, makes this trap strictly more likely to fire.
  Resolution still belongs to Phase 66.

- **`Reap vicerc scratch dirs in broker kill/recycle path`**
  (`.planning/todos/pending/2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path.md`,
  tagged `resolves_phase: 64`). `broker-launch.mts:329` `mkdtemp`s a per-launch
  `XDG_CONFIG_HOME` under `tmpdir()` and never removes it. **How it fits:**
  `BROKER-06` moves broker-owned scratch to the machine-level root, which is the
  same surface. Two notes for the planner: this project's `/tmp` is a tmpfs whose
  aging is disabled, so leaked scratch is leaked RAM until reboot; and a
  machine-level broker started at login leaks for the whole uptime rather than
  for one project session. Whether the vicerc scratch dir moves under
  `VICE_BROKER_HOME` is a legitimate D-13/D-14 follow-on; reaping it is Phase 64.

- **`Remove pre-warm; launch VICE only on first request`**
  (`.planning/todos/pending/2026-09-07-remove-pre-warm-launch-vice-on-first-request.md`,
  untagged). Folded as context, not as work — see D-16 and Deferred Ideas.

- **`Remove anno from the MCP surface; reach it via a stateless broker call`**
  (`.planning/todos/pending/2026-09-11-remove-anno-from-the-mcp-surface-reach-it-via-a-stateless-br.md`,
  untagged, owner directive). Folded for awareness only. Its requirement owners
  are `SESS-01` (Phase 63) and `SEAM-03` (Phase 65). **Phase 62 must not
  implement it, and must not foreclose it** — the `hello` op's connection tag
  (D-06) is the mechanism a later stateless `anno` call would use to identify
  itself, so the tag vocabulary should be designed as open rather than closed to
  the two tags this phase needs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

`ROADMAP.md` carries no `Canonical refs:` line for this phase; the list below
was assembled from `REQUIREMENTS.md`, the roadmap section, and the codebase
scout during this discussion.

### Milestone decisions and requirements
- `.planning/REQUIREMENTS.md` — the six settled owner decisions (§ "Settled
  design decisions"), all 36 v2.0.0 requirements, the Out of Scope table, and
  the traceability mapping. **Decisions 1, 2, 5 and 6 are not re-derivable.**
- `.planning/ROADMAP.md` § "Phase 62" — the five success criteria, the five
  cross-cutting constraints, the two flagged open questions (both answered here:
  D-04 and D-08), and the four named testing traps.
- `.planning/STATE.md` § "Current Position" — the convergence metric, standing at
  **6** at the milestone open, which must reach 0 before Phase 66 completes.
  Phase 62's exit leaves it at 6; recording it unchanged is the point.

### Project constraints that bind what may be written
- `CLAUDE.md` § Constraints — the never-auto-install rule and its explicit
  carve-out for `npx -y @henols/vice-mcp anno <verb>` (D-01 depends on this
  carve-out); the frozen argv-array emulator-spawn set; the `inFlight` guard's
  provenance; the single-binmon-client concurrency rule.
- `docs/stock-hard-losses.md` — the three permanent accepted losses. A transport
  redesign recovers none of them; `REQUIREMENTS.md` puts that Out of Scope.
- `.planning/notes/nothing-is-installed-automatically.md` — the standing
  detect-then-refuse-by-name pattern `ENDPOINT-04` must match.

### The code this phase changes
- `src/mcp/vice/broker-control.mts` — framing, the op union
  (`ControlRequestKind:57`), `ControlErrorCode:64`, `resolveControlPort():419`
  (the 19510 default), `startControlListener():919` and its
  `VICE_BROKER_CONTROL_HOST ?? "0.0.0.0"` at :920. **Its header at :20 teaches
  the reversed decision** — see D-11.
- `src/mcp/vice/vice-broker-client.ts` — `resolveControlTarget()` and its
  existing `bridge_alias` / `dial_override` sources, the
  `VICE_BROKER_CONTROL_DIAL_HOST` override, and the wildcard-bind matcher at
  :239. Lines 195-197 quote the reversed rule verbatim.
- `src/mcp/vice/vice-broker.mts:1134` — the second `"0.0.0.0"` default.
- `src/mcp/vice/install-resources.ts` — `installTargetDir():100`,
  `resourceEntries():122`, `ensureResourcesInstalled():539`. Obsolete per D-04.
- `src/mcp/vice/repo-root.ts:59` and `:303` — the import and the module-load
  side effect that go with it.
- `src/mcp/vice/resources/vice-launcher.sh` — `:135` (the beside-itself broker
  artifact), `:190-222` (the `VICE_BROKER_NODE` resolution ladder), `:256-267`
  (the refuse-before-exec floor check), `:287` (the `--repo-root` per-project
  binding). D-03 must preserve the refusal this script owns.
- `src/mcp/vice/package.json` — `bin`, `main` and `engines.node`; the `.ts` bin
  entry is why D-03 exists.
- `src/mcp/vice/build.ts` — `HOST_BOUND_ARTIFACTS`; read it before renaming
  anything across the `.ts` / `.mts` boundary.

### Prior-phase context worth not re-deriving
- `.planning/phases/61-the-install-tables-generated-and-a-guard-that-compares-facts/61-CONTEXT.md`
  — D-02 there froze `prerequisites.json`'s shape for Phase 61 only. Phase 62 is
  not bound by that freeze, but the owner's standing principle it rests on is:
  **a tool that needs something absent says so at the point of use**, not through
  a doctor or pre-flight check. `ENDPOINT-04` is a point-of-use refusal.
- `docs/phase58-declaration-provenance.md` — how `prerequisites.json` records a
  remedy per platform, if the planner proposes the broker start command join it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The control plane already exists and already defaults to 19510.**
  `broker-control.mts:421-424` reads `VICE_BROKER_CONTROL_PORT` and falls back
  to 19510. Decision 1's "fixed port" is today's default, which is why the
  stale-broker collision is near-certain during upgrade rather than
  hypothetical — and why D-06's handshake is what tells them apart.
- **One JSON object per line, connection-open-is-the-claim.** The framing
  `hello` reuses is already there, along with `writeLine()`, `defaultRequestId()`
  and an eight-arm op switch that a ninth arm joins without restructuring.
- **`resolveControlTarget()` already separates bind address from dial address.**
  It already refuses to yield a recorded `0.0.0.0` as a dial target, already
  knows the bridge alias, and already carries `VICE_BROKER_CONTROL_DIAL_HOST`.
  The two-candidate dial is an extension of an existing function, not a new
  concept — though `SEAM-01` (Phase 65) will later require exactly one module to
  own dialling, so where the new code lands matters for that phase.
- **`bindControlListener(host, port)` at `broker-control.mts:532`** already
  takes a host, so binding a *set* of addresses is a loop over an existing
  primitive plus a refusal when the set ends up empty.
- **A CI route gate already exists** for the host-tool seam and has been
  observed biting on planted violations. D-15's `systemctl`/`launchctl` gate
  copies that shape rather than inventing one.

### Established Patterns
- **Detect, then refuse by name with the remedy in the message.** `x64sc`,
  `c1541`, `petcat`, ACME, Ghidra and dxa all follow it; `ENDPOINT-04` and
  `BROKER-02` are the same pattern applied to the broker itself.
- **Generated but committed.** `build.ts` → `resources/*.mjs`, guarded by
  `resources-sync.test.ts`. Any edit to `broker-control.mts` (D-11) must ship
  its regenerated `.mjs`.
- **One module per seam, asserted structurally.** `stock-protocol.ts` is the only
  `node:net` binary-monitor module; decision 6 says its socket-consumption
  contract is not touched.
- **Never-throw at the boundary.** `vice-broker-client.ts` parses every
  untrusted read in try/catch and never caches a negative result. The `hello`
  reply from an unknown listener is untrusted input by the same standard.

### Integration Points
- `vice-proxy.ts` acquires, releases and recycles over the control plane — the
  first consumer of the new handshake.
- `broker-launch.mts`'s `inFlight` guard sits downstream of everything here and
  is explicitly untouched.
- `.mcp.json` launches `vice-proxy.ts` with `timeout: 150000`; a dial that now
  has two bounded candidate timeouts must still fit well inside it.
- **Four source files under `src/mcp/vice/` contain NUL bytes**, not the one
  `CLAUDE.md` names: `anno-memmap-render.ts`, `anno-store-export.ts`,
  `prereq-readme-gen.ts` and `prerequisites.test.ts` (measured 2026-09-19 by
  scanning every `git ls-files` entry for a zero byte, fixtures and vendor tree
  excluded). Plain `grep` skips all four without a warning, so any content
  census run during this phase must use `grep -a`. `CLAUDE.md`'s single-file
  claim is stale and is not this phase's to fix.

</code_context>

<specifics>
## Specific Ideas

- The refusal's four-outcome ranking (D-07) should read as four distinct
  sentences a person can act on, not one message with a variable clause. "Nothing
  is listening", "something else is on that port", "that is an old broker" and
  "that broker is too old for this client" are four different problems with four
  different remedies.
- `ENDPOINT-05`'s message must **say which side to update**, not merely report a
  mismatch. Both package names and both versions belong in the text, because the
  user's next action differs depending on which is behind.
- The `hello` reply's tag vocabulary should be open-ended. Phase 63 adds the
  long-lived monitor-relay tag and Phase 64 the short-lived file tag; the folded
  `anno` todo implies a third later. A closed two-value union written now is a
  rewrite later.

</specifics>

<deferred>
## Deferred Ideas

- **The warm floor's rationale under a machine-level broker (D-16).** The
  discussion produced a sharper case than the todo currently records: with a
  systemd `--user` unit, the floor is climbed **at login** rather than at first
  project use, so an `x64sc` window appears on the user's desktop with no
  session in sight. That is a worse symptom than today's per-project hand-start,
  and it strengthens the pending todo without making it Phase 62's work.
  Changing `VICE_BROKER_WARM_FLOOR`'s default is a one-line behaviour change
  that still interacts with acquire-timing tests, which is why it is not folded
  into a phase whose stated shape is additive.

- **Removing `VICE_POOL_DIR` / `VICE_SUPERVISOR_DIR` / `VICE_INCIDENTS_DIR` /
  `VICE_EPOCH_FILE` is unowned work (D-14).** No v2.0.0 requirement covers it.
  Raise at roadmap level before Phase 66 absorbs it by inference.

- **`RM-04`'s ownership needs reconciling (D-11).** Phase 62 does the rewrite;
  Phase 66 still owns the requirement in `REQUIREMENTS.md`'s traceability table.

- **Whether the broker start command joins `prerequisites.json`.** Not decided.
  It would let `ENDPOINT-04` quote its remedy through the existing `withRemedy()`
  seam and the generated README tables, which is the v1.1.0 pattern. It would
  also put a record in that file for something which is not an external tool the
  user installs, which is what every other record there is. Left open for the
  researcher to weigh rather than settled here.

### Reviewed Todos (not folded)
None — all four matches were folded, two of them for awareness only (see Folded
Todos). The five lower-scoring keyword matches (`audit-gate-shared-budget-reds-tail-guards`,
the `research/questions.md` corpus claim, and three phase-review disposition
records) were reviewed and are unrelated to this phase's subject.

</deferred>

---

*Phase: 62-The Fixed Endpoint and the Broker That Owns the Machine*
*Context gathered: 2026-09-19*
