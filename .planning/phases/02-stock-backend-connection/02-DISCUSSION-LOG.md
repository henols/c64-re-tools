# Phase 2: Stock Backend Connection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 2-Stock Backend Connection
**Areas discussed:** Folded todos, Selection surface & default, Connect handshake & version gating, Stock launch flags & exclusive ownership, Client provenance & test fixtures

---

## Folded Todos

| Option | Description | Selected |
|--------|-------------|----------|
| Broker orphan-reap substring kill | HIGH — `discoverBandProcesses()` picks SIGKILL targets by substring match on any host process's argv; Phase 2 widens the band with a second launch shape | ✓ |
| Exclude non-automatable tests from gate | LOW but load-bearing — BACK-02's "existing suite passes unchanged" is unverifiable without a defined gate | ✓ |

**User's choice:** Both folded.
**Notes:** The reap todo was subsequently resolved by the port-allocation decision rather than by a new identity heuristic.

---

## Selection surface & default

| Option | Description | Selected |
|--------|-------------|----------|
| Default to fork | Unset = today's behaviour bit-for-bit; cheapest route to BACK-02 | |
| Default to stock | Unset = the VICE anyone can install; existing installs silently migrate | ✓ (later superseded) |
| No default — require it | Unset is a startup error; hard breaking change | |

**User's choice:** Default to stock — then superseded mid-area by the detection redirect below.
**Notes:** Claude flagged that default-to-stock silently switches existing v0.1.x installs on upgrade.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate path setting, verified at connect | `VICE_BACKEND` picks protocol, a path var picks binary; handshake proves the pairing | |
| Backend implies the binary | Per-backend default paths baked in | |
| One knob, probe the binary | Broker probes the resolved `x64sc` and refuses to launch if it cannot serve the selected backend | ✓ |

**User's choice:** One knob, probe the binary.
**Notes:** Claude noted the probe must be cached and must not sit inside the `inFlight` launch guard's critical section.

**Redirect (free text):** *"try first to start vice with MCP flag and if it fails then we know it's stock vice, that changes which is default"*

This reversed the default question entirely — backend became **detected**, with `VICE_BACKEND` demoted to an explicit override. Claude noted this is the "backend follows the emulator" option the milestone-intent note had recorded as *rejected*, and that the real discriminator is `-mcpserver` (fork-only) rather than `-binarymonitor` (which the fork also accepts, being a 3.10 tree).

Claude offered two probe mechanisms (trial launch vs `-help` introspection) and asked about cache invalidation.

**User's response (free text):** *"does it matter how it's probed it only needs to be done once when the broker is started for the first time and then it can remember what was started"*

Mechanism left to the planner; only the cached result matters.

| Option | Description | Selected |
|--------|-------------|----------|
| Fields on the existing `vice_ping` | Backend + version + binary path on the tool an agent already calls first | ✓ |
| A new dedicated tool | `vice_backend_info`; cleanly extensible but worse discoverability | |
| Both — ping summary, tool for detail | Two things to keep consistent | |

**User's choice:** Fields on the existing `vice_ping`.

| Option | Description | Selected |
|--------|-------------|----------|
| One-time stderr note when unset | Follows `repo-root.ts`'s existing warning pattern | ✓ |
| Silent — unset is just stock | Docs carry the migration note | |
| Warn only when it would matter | Conditional on probe results; fires late | |

**User's choice:** One-time stderr note when unset.

---

## Connect handshake & version gating

| Option | Description | Selected |
|--------|-------------|----------|
| Version quad plus one trial call | `VICE_INFO` then a minimum-count `CPUHISTORY_GET`; separates absent / not-compiled-in | |
| Version quad only | Cheap, side-effect-free, but cannot separate `0x83` from `0x8f` | |
| Fold it into the same cached probe | Determined once per binary, remembered under `.vice-supervisor/` | ✓ |

**User's choice:** Fold it into the same cached probe.
**Notes:** Consistent with the detection decision. Cache keying must catch a binary replaced in place.

### Tool surface — the contested one

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit table, loud error for the rest | Full manifest both backends; unimplemented tools error by name; Phase 8 upgrades the text | |
| Table plus fork fallback where reachable | Falls through to HTTP forward if a fork build is present | |
| Trim the manifest per backend | Stock advertises only what it implements | ✓ |

**User's choice:** Trim the manifest per backend.

Claude raised the conflict: this reverses the locked *"keep every tool, annotate per backend"* decision and the standing constraint that the stdio surface must not change, and takes DIST-01 and BACK-05 with it. Two readings were offered.

| Option | Description | Selected |
|--------|-------------|----------|
| Temporary — grows per phase, full by Phase 8 | Locked decision survives; interim trim is scaffolding | |
| Permanent — stock advertises only what it can do | Reverses the locked decision; ROADMAP, REQUIREMENTS, the intent note and CLAUDE.md need updating | ✓ |
| Keep the locked decision — full manifest, loud errors | Revert to the recommended option | |

**User's choice:** Permanent. Reaffirmed after the conflict was stated explicitly.
**Notes:** Claude recorded it as a deliberate reversal with the affected artifacts enumerated, and did not edit ROADMAP.md or REQUIREMENTS.md from inside discuss-phase. Claude also corrected a premise on the way through: `tools-manifest.json` is already committed and static and serves both paths today, so what actually differs per backend is dispatch, not listing.

---

## Stock launch flags & exclusive ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Binary monitor only | `-binarymonitor` + `-binarymonitoraddress`, nothing else | ✓ |
| Also enable the text monitor now | `-remotemonitor` alongside, keeping Phase 7's Route 2 open | |
| Monitor plus launch-time warp | No runtime `WarpMode` exists, so warp is launch-time or never | |

**User's choice:** Binary monitor only.

| Option | Description | Selected |
|--------|-------------|----------|
| Broker-side, the lease is the owner | Second acquire refused as an ownership conflict; the ambiguous state cannot be entered | ✓ |
| Client-side connect probe | Timeout heuristic on a signal with no distinguishing shape | |
| Both — broker refuses, client corroborates | Belt and braces; still needs the timeout guess | |

**User's choice:** Broker-side, the lease is the owner.

### The reap todo

| Option | Description | Selected |
|--------|-------------|----------|
| Stamp our own launches, reap only what we stamped | Broker-owned marker argument required as an exact token | |
| Exact-token match on resolved binary plus port | No new flags; still identity-by-coincidence | |
| Track PIDs in state, reap only those | Loses the orphan case the reap exists for | |

**User's choice (free text):** *"it's sounds complicated, use the same connection agreement as the MCP does it"*

Claude reflected this back as: stop scanning argv; a process is ours if the thing on our band port answers our protocol and matches our instance record. Claude then named the wrinkle — on stock, probing a port by connecting consumes the single monitor client slot — and proposed skipping ports held under a live lease.

**User's response (free text):** *"if you think after MVP and stock vice can never be mixed up, and I an instance of vice that is started with an occupied port we must launch it on a free port and the broker can keep track of that"*

This simplified it past Claude's proposal: one broker only ever launches one kind of binary (backend is fixed at broker start), so nothing has to disambiguate two launch shapes; and occupied ports are never contested, probed, or killed — the broker allocates a free port and records it. Ownership is the broker's own allocation record. The substring match and the `>= basePort` gate both disappear with nothing heuristic replacing them.

| Option | Description | Selected |
|--------|-------------|----------|
| Socket lifecycle is the signal | Close/reset is unambiguous and immediate; timeout stays reserved for "connected but silent" | ✓ |
| Reuse the epoch file for both backends | One meaning for `MachineRestartedError`, but polled not pushed | |
| Socket primary, epoch corroborates | Distinguishes died from died-and-relaunched; two mechanisms to keep in agreement | |

**User's choice:** Socket lifecycle is the signal.

---

## Client provenance & test fixtures

| Option | Description | Selected |
|--------|-------------|----------|
| Vendor the file, fix on the way in | Copy `c64-debug-mcp`'s `vice-protocol.ts` with both known defects fixed, then extend | ✓ |
| Rewrite in this repo's conventions | Reimplements working framing; risks reintroducing the two defects | |
| Vendor now, converge later | "Later" has a poor record on a file this load-bearing | |

**User's choice:** Vendor the file, fix on the way in.
**Notes:** Same author, MIT, no dependencies. Convention alignment folded into landing it rather than deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Synthesised in-test, one recorded sanity frame | Several cases cannot be recorded at all; one real frame as a reality check | |
| Record everything a real emulator will produce | Capture mode in `probe-binmon.mjs`; commit real frames; synthesise only the impossible ones | ✓ |
| Synthesised only | No emulator needed, no blobs in git; nothing checks the spec reading against a real build | |

**User's choice:** Record everything a real emulator will produce.
**Notes:** Accepted costs — a ~157 KB binary fixture in git, and fixture provenance/staleness to track. Capture must be bounded against the `CHECKPOINT_INFO` flood Phase 1 observed on the fork build.

---

## Claude's Discretion

- Probe mechanism: trial launch vs `-help` introspection — explicitly delegated.
- Exact cache-key composition for the probe result.
- Module layout for the vendored client and the stock dispatch path.

## Deferred Ideas

- Text monitor (`-remotemonitor`) at launch — Phase 7 decides by measurement.
- Launch-time warp — wrong for the raster-precise work in Phases 6-7.
- Reconciling ROADMAP.md / REQUIREMENTS.md / the milestone-intent note / CLAUDE.md with the permanent per-backend manifest trim — a roadmap edit, not phase work.
- Un-discussed and still open (offered, user chose to proceed): whether the fork's own code may be touched under BACK-02; request-id minting and concurrent-in-flight limits beyond "never `0xffffffff`, full uint32".
