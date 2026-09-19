# Phase 62: The Fixed Endpoint and the Broker That Owns the Machine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 62-The Fixed Endpoint and the Broker That Owns the Machine
**Areas discussed:** install-resources.ts's fate; Handshake, skew and refusal text; Which addresses the broker binds; State root and start command

---

## Todo cross-reference

Five pending todos keyword-matched Phase 62. Four were presented; three of those
carry an explicit `resolves_phase` tag pointing at another phase.

| Option | Description | Selected |
|--------|-------------|----------|
| BACK-05 live-broker test | Tagged `resolves_phase: 66`. Fails deterministically whenever a live broker owns the emulator; the roadmap names it as a Phase 62 testing trap | ✓ |
| Reap vicerc scratch dirs | Tagged `resolves_phase: 64`. Per-launch `XDG_CONFIG_HOME` under `tmpdir()`, never removed; same surface as `BROKER-06` | ✓ |
| Remove pre-warm | Untagged. Warm floor climbs from broker startup with no acquire in sight | ✓ |
| Anno off the MCP surface | Untagged owner directive. `SESS-01` / `SEAM-03` territory — Phases 63 and 65 | ✓ |

**User's choice:** all four folded.
**Notes:** Recorded in CONTEXT.md with honest scoping — two are folded *for
awareness only* and are not resolved by this phase. The five lower-scoring
matches (`audit-gate-shared-budget-reds-tail-guards`, the `research/questions.md`
corpus claim, three phase-review disposition records) were reviewed and are
unrelated.

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| install-resources.ts's fate | Roadmap open question 1; blocks Phase 66's convergence metric reaching 0 | ✓ |
| Handshake, skew, refusal text | `ENDPOINT-03/04/05` plus roadmap open question 2 | ✓ |
| Which addresses it binds | `BROKER-03`'s enumeration filter and late-bridge behaviour | ✓ |
| State root and start command | `BROKER-05/06`, the machine root, env vars, service definitions | ✓ |

**User's choice:** all four.

---

## install-resources.ts's fate

### Q1 — What does a user type to start the one broker?

| Option | Description | Selected |
|--------|-------------|----------|
| `npx -y @henols/vice-mcp broker` | Invocation not install; matches the documented `anno <verb>` route; identical on every platform; costs an npx resolution per cold start | |
| The launcher script, in place | No deployment, no npm fetch, preserves the bash Node-floor refusal — but the path differs between plugin and npm-installer projects | |
| Machine-level deployed launcher | Keeps the deploy mechanism, retargeted once to `~/.c64-re-tools/bin/`; still needs a deploy trigger | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected `npx -y @henols/vice-mcp broker` (CONTEXT.md D-01).
Decisive reason found during the discussion rather than offered in the options: a
containerized client cannot name a host path at all under this milestone, so
`ENDPOINT-04`'s refusal text must be host-path-independent, which eliminates both
path-bearing alternatives on correctness rather than preference.

### Q2 — The verdict on install-resources.ts itself

| Option | Description | Selected |
|--------|-------------|----------|
| Obsolete — delete in Phase 66 | Verdict recorded now, deletion later; keeps Phase 62 additive; unblocks the census | |
| Obsolete — delete in Phase 62 | Contradicts the phase's "nothing is deleted here" shape | |
| Survives, retargeted | Stays a census importer, so the metric's target of 0 needs restating | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected obsolete-with-deletion-in-66 (D-04). Two findings from
the scout settled it: `vice-launcher.sh:135` execs the broker artifact *beside
itself*, so the deployment exists only to co-locate two files that already sit
together in `resources/`; and `vice-launcher.sh:287` passes
`--repo-root "$REPO_ROOT"`, which is the per-project binding `BROKER-01` removes.

---

## Handshake, skew and refusal text

### Q1 — What proves the listener is genuinely this broker?

| Option | Description | Selected |
|--------|-------------|----------|
| A dedicated `hello` op | Ninth `ControlRequestKind`; reuses existing framing and dispatch; a stale broker's `unauthorized` is a clean discriminator | |
| Reuse the `status` op | No new op, but requires the dropped token and describes instances, not identity | |
| Server speaks first | Fastest foreign-listener rejection; inverts the protocol shape and confuses the existing parallel client | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected the dedicated `hello` op (D-06).

### Q2 — The compatibility rule

| Option | Description | Selected |
|--------|-------------|----------|
| A separate wire integer | Moves only on a breaking wire change; ordinary skew stays silent | |
| Package major must match | No new number; ties the wire contract to release cadence | ✓ |
| Exact version match | Maximally safe, maximally hostile to the independent-update premise | |
| You decide | | |

**User's choice:** Package major must match.
**Notes:** Direct owner decision, not delegated. Supporting fact surfaced
afterwards and recorded in CONTEXT.md D-05: CI derives both packages' versions
from the same `v*` tag, so within a release they are always equal and skew exists
only across independent updates. Named cost accepted: an unrelated major bump
forces a lockstep broker upgrade.

### Q3 — Candidate 1 completes TCP but fails the handshake

| Option | Description | Selected |
|--------|-------------|----------|
| Try candidate 2 anyway | Most robust; matches "first candidate that completes a handshake" | |
| Stop and refuse by name | Sharpest on a bare host; wrong inside a container | |
| Depends on the failure kind | Most precise; needs the handshake to tell stale-broker from foreign-listener | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected a refinement none of the three options contained
(D-07): both candidates are always dialled, the first *completed* handshake wins,
and the refusal reports the most informative of four ranked outcomes seen across
both. A version refusal is not a completed handshake, so it does not
short-circuit — which is what stops a compatible broker at candidate 2 from
being lost. Cost is one extra bounded timeout, on the failure path only.

### Q4 — Rootless-Docker disclosure prominence

| Option | Description | Selected |
|--------|-------------|----------|
| Only when it might apply | Gated on the conditions under which the gap could be the cause | |
| A doc pointer, always | Shortest primary message; costs a hop for the person already stuck | |
| Named in full, always | Unmissable; every bare-host user reads it for an unconfirmed claim | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected conditional disclosure, but on a **different gate**
than the option as worded (D-08). Gating on "client is in a container" would
reintroduce the `isInsideContainer()` call `RM-03` deletes and contradict this
phase's premise that the dial order *is* the detection. The gate is instead
dial-observed: `host.docker.internal` resolved but the connection failed. MEDIUM
confidence and community-sourced provenance are disclosed in the wording; Podman's
`pasta` default stays `DEFER-01` and is not mentioned.

---

## Which addresses the broker binds

### Q1 — The enumeration filter

| Option | Description | Selected |
|--------|-------------|----------|
| Interface-name allowlist | `docker0`, `br-*`, `podman*`, `cni-*`; precise, misses unlisted names | ✓ |
| Every RFC1918 address | Catches custom bridges — and the machine's own LAN address | |
| Allowlist plus an override | Safe default with an escape hatch; one more knob | |
| You decide | | |

**User's choice:** Interface-name allowlist.
**Notes:** Direct owner decision. The override variant was offered and not taken,
so there is no knob. Platform asymmetry recorded in CONTEXT.md D-09: on macOS
there is no host-side bridge interface, so finding no bridge candidate is correct
rather than a failure, and the startup refusal must fire only when the *total*
bound set is empty.

### Q2 — A bridge that appears after startup

| Option | Description | Selected |
|--------|-------------|----------|
| Static — restart the broker | Immutable bind set, trivially auditable; cost lands on the user | ✓ |
| Re-enumerate on an interval | Container just works; bind set becomes mutable at runtime | |
| Re-enumerate, refuse to grow | Immutable set plus a visible warning; costs a watching timer | |
| You decide | | |

**User's choice:** Static — restart the broker.

### Q3 — The stale `0.0.0.0` guidance

| Option | Description | Selected |
|--------|-------------|----------|
| A SUPERSEDED marker now | Removes the trap without doing `RM-04`'s rewrite | |
| Leave it exactly as is | Cleanest ownership boundary; leaves a live trap in the most-read file | |
| Rewrite it now | Fixes it where the decision is implemented; completes `RM-04` early | ✓ |

**User's choice:** Rewrite it now.
**Notes:** Chosen with the ownership cost stated in the option text. Consequence
recorded in CONTEXT.md D-11: `RM-04` is a Phase 66 requirement and will find its
work done, so Phase 66's ledger needs reconciling. A census run afterwards found
the guidance in **four** production sites, not one.

---

## State root and start command

### Q1 — Where the machine-level root lives

| Option | Description | Selected |
|--------|-------------|----------|
| `~/.c64-re-tools/` | Same name one level up; one string per platform | |
| Per-platform conventional | XDG on Linux, Application Support on macOS; two code paths | |
| `~/.c64-re-tools/` plus override | Flat default with one env var escape hatch | ✓ |
| You decide | | |

**User's choice:** `~/.c64-re-tools/` plus override.

### Q2 — The four existing path env vars

| Option | Description | Selected |
|--------|-------------|----------|
| Re-anchor, keep all four | Nothing deleted, fully additive; leaves four knobs | |
| One new var supersedes them | Ends simpler; the four survive the parallel period and go in Phase 66 | ✓ |
| Leave all four untouched | Zero risk; leaves broker state resolvable to a project directory | |
| You decide | | |

**User's choice:** One new var supersedes them.
**Notes:** Q1's override and Q2's superseding variable are the same variable —
`VICE_BROKER_HOME`, one new knob rather than two. Flagged in CONTEXT.md D-14: no
v2.0.0 requirement owns removing the four, so Phase 66 absorbing it is unowned
work and belongs at roadmap level.

### Q3 — Service definition shape

| Option | Description | Selected |
|--------|-------------|----------|
| Committed files plus a grep gate | "Never auto-applied" becomes structural, copying the existing host-tool route gate | |
| Committed, plus a print verb | Machine-correct rendering; a second path that can drift | |
| Committed files only | Smallest surface; the claim stays prose | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected committed files plus the grep gate (D-15). The print
verb's only justification — that a committed unit cannot embed a correct absolute
path — is removed by D-01, since `npx -y @henols/vice-mcp broker` works verbatim
as `ExecStart` via `/usr/bin/env`.

### Q4 — Does the warm floor belong in Phase 62?

| Option | Description | Selected |
|--------|-------------|----------|
| Note it, don't act here | Records the sharper rationale, leaves behaviour untouched | |
| Default the floor to 0 | One-line change, reversible by env var | |
| Remove pre-warm in this phase | Resolves the todo; contradicts the additive shape | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude selected note-it-don't-act (D-16). Sharpened reasoning kept in
CONTEXT.md's Deferred Ideas: under a systemd `--user` unit the floor is climbed
at *login*, not at first project use, so an `x64sc` window appears with no
session in sight — a worse symptom than today, which strengthens the pending todo
without making it this phase's work.

---

## Claude's Discretion

Six of eleven questions were delegated with "you decide":

- The start command, its CLI shape, and where the Node-floor refusal lives (D-01, D-02, D-03)
- `install-resources.ts`'s verdict and when the deletion lands (D-04)
- The handshake's shape (D-06)
- Candidate-failure handling and the refusal's ranking (D-07)
- The rootless-Docker disclosure's gate and wording (D-08)
- The service-definition shape (D-15)
- Whether the warm floor is this phase's work (D-16)

Two of these (D-07, D-08) are refinements that no offered option contained, each
produced by a constraint the options had missed.

## Deferred Ideas

- The warm floor's weakened rationale under a machine-level broker
- Removing the four path env vars is unowned by any v2.0.0 requirement
- `RM-04`'s ownership needs reconciling between Phases 62 and 66
- Whether the broker start command joins `prerequisites.json`
