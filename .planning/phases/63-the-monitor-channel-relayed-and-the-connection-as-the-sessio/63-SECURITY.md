---
phase: "63"
slug: "the-monitor-channel-relayed-and-the-connection-as-the-session"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-23"
---

# Phase 63 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase relays the VICE monitor channel through the broker and makes the
*connection* the session lease. That moves two things across a trust boundary that
never crossed one before: an unidentified local process now opens a relay
connection to the broker, and raw, non-UTF-8 binmon bytes now transit the broker
on their way to a client parser. The register below was authored at plan time —
every one of the twelve plans carries its own `<threat_model>` block — so this
audit verifies mitigations rather than scanning for new threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| any local process → broker fixed endpoint | A relay connection arrives from a process the broker cannot identify at the network layer; the loopback bind set is the only network-level narrowing | Control-plane JSON lines, then a per-claim handle |
| broker → emulator monitor port | The broker dials the single-client binary monitor on its own loopback. A second dial to a claimed channel is the unserviced-backlog state that must never be reachable | Raw binmon frames |
| relayed bytes → client parser | Arbitrary, non-UTF-8 bytes cross into a process that must not be corrupted by them | Raw binmon frames (never string-decoded) |
| broker → machine-wide incidents directory | An incident record is written outside the project tree, owner-only, before any reclaim | Operation name, grant id, port, epoch |

---

## Threat Register

The register is the union of all twelve plans' `<threat_model>` blocks: 52 entries
across two numbering families — the phase-level `T-63-NN` (plans 01–06) and the
per-plan `T-63-PP-NN` (gap-closure plans 07–12) — plus one supply-chain entry per
plan (`T-63-*-SC`).

| Threat ID | Category | Severity | Disposition | Mitigation | Status |
|-----------|----------|----------|-------------|------------|--------|
| T-63-01 | Elevation of Privilege | high | mitigate | `monitor_claim` mints a 16-byte random handle (`vice-broker.mts:1019`); attach requires the per-boot control token AND a length check *before* `timingSafeEqual` (`vice-broker.mts:1289-1292`). A bare target id is never trusted. A second attach on an attached channel is refused. | closed |
| T-63-02 | Denial of Service | high | mitigate | Broker-owned bounded idle deadline, suspended while an operation is declared, resumed with a fresh interval on clear (`handleOperationNote`). Proven with an injected clock, never a real sleep. | closed |
| T-63-03 | Information Disclosure | medium | mitigate | Session label sanitised and capped; status identity resolved by the same port-and-pid comparison the release path uses. | closed |
| T-63-04 | Tampering | low | accept | Byte-transparency is the requirement; the broker deliberately does not inspect frames. `stock-protocol.ts`'s client-side framing, desync and accumulation-cap validation is the only defence and is unchanged. | closed (accepted) |
| T-63-05 | Spoofing | low | accept | The handshake tag is a self-declared connection label answered ahead of the token gate and carries no authority. Every authority decision is the control token plus the per-claim handle. | closed (accepted) |
| T-63-06 | Repudiation | medium | mitigate | Incident record written and durably `fsync`'d before any claim release, socket destroy or kill; teardown idempotent per grant and channel. | closed |
| T-63-07 | Denial of Service | medium | mitigate | Pre-splice `Buffer` carry enforces the same 65536 cap the control reader applies, and destroys the socket rather than buffering further. No string decode of relayed bytes. | closed |
| T-63-08 | Denial of Service | medium | mitigate | Text attach refuses a missing text-monitor port by name before any dial; no fallback from one channel's port to the other's. | closed |
| T-63-09 | Repudiation | medium | mitigate | A dead text relay fails the session; no reconnect entry point exists on the text path. | closed |
| T-63-10 | Tampering | medium | mitigate | Operation declaration ownership-gated and sanitised before any state sees it. | closed |
| T-63-11 | Elevation of Privilege | high | mitigate | `monitor_release` refuses a non-holder (`denied`) and an unknown target (`bad_request`); a refused release tears down nothing, so a non-holder can never destroy the holder's live connection. | closed |
| T-63-12 | Information Disclosure | medium | mitigate | Release sent before the socket close on both channels, so a released channel never leaves a live splice behind it. | closed |
| T-63-13 | Denial of Service | medium | mitigate | Declaration never blocks or fails a tool call. | closed |
| T-63-14 | Denial of Service | medium | mitigate | Teardown idempotent per grant and channel; the same channel dropping twice produces one record total. | closed |
| T-63-15 | Tampering | high | mitigate | Evidence written strictly ahead of the identity-verified kill; pid-match discipline unchanged. Asserted by "the record must be written strictly BEFORE the kill is even invoked". | closed |
| T-63-16 | Information Disclosure | low | accept | Keepalive labelled secondary; the broker-owned deadline is the primary bound. | closed (accepted) |
| T-63-17 | Spoofing | high | mitigate | No target-naming op accepts a session label as a selector; the refusal never quotes the label back. | closed |
| T-63-18 | Tampering | medium | mitigate | Label sanitised and capped before storage. | closed |
| T-63-19 | Elevation of Privilege | high | mitigate | A stateless, skill-script-shaped call acquires no grant and fires no lease callback; `host-tool-client.ts` must never write an acquire line. | closed |
| T-63-20 | Denial of Service | medium | mitigate | The live proof default-skips with a reported reason, never a false pass, and is registered manual-only so the automated gate never runs it. | closed |
| T-63-21 | Tampering | medium | mitigate | No emulator or broker process outlives the live run; verified empty by `pgrep` before and after. | closed |
| T-63-22 | Repudiation | medium | mitigate | A failing live case is recorded as a finding, not a relaxed assertion. Both non-reproductions kept real, unrelaxed `assert.ok()` calls. | closed |
| T-63-07-01 · -02 · -03 · -04 | DoS / Info Disc. / Repudiation / DoS | medium–low | mitigate (×2), accept (×2) | Satisfied per `63-07-SUMMARY.md` § Threat Flags: the recycle/release teardown-before-kill fix itself, asserted by the recorder-count-zero criteria in Tasks 1 and 2, plus the distinctly-worded stderr lines both call sites emit. | closed |
| T-63-08-01 · -02 · -03 | Repudiation / Tampering / Info Disc. | medium–low | mitigate (×2), accept (×1) | Declare-after-lock ordering: the text operation is declared only after the shared lock is granted, proven under cross-channel contention. | closed |
| T-63-09-01 · -02 · -03 | Spoofing / DoS / Tampering | medium–low | mitigate | Demux by request id under a JAM/reply interleave; a zero-length-body JAM crosses the relay with a null program counter. | closed |
| T-63-10-01 · -02 · -03 · -04 · -05 | EoP / Info Disc. / Tampering / Repudiation / DoS | high–medium | mitigate | Live gap probe run against genuine `/usr/bin/x64sc` (VICE 3.9) with no broker or emulator process surviving the run; outcomes recorded as data in `evidence/phase63-gap-closure-live-measurements.md`. `-jamaction` values 0, 4 and 5 deliberately not probed (modal dialog; standing T-07-17-05 ban on power-cycle and quit). | closed |
| T-63-11-01 · -02 · -03 · -04 | Spoofing/DoS / DoS / Repudiation / Tampering | high–medium | mitigate | Satisfied per `63-11-SUMMARY.md` § Threat Flags: the two refusal-contract cases, the teardown keying on the exact `(targetId, channel)` pair, every pre-existing relay-death case staying green, and the rebuilt committed `resources/vice-broker.mjs`. | closed |
| T-63-12-01 · -02 · -03 · -04 | Repudiation / DoS / DoS / Info Disc. | high–low | mitigate (×3), accept (×1) | Caller-side release-before-close reorder on both the text and binary channels. | closed |
| T-63-SC, T-63-07-SC … T-63-12-SC | Tampering (supply chain) | high–low | mitigate / accept | **Measured:** `git diff main..HEAD` over `src/mcp/vice/package.json`, `src/mcp/vice/package-lock.json` and `installer/package.json` is **empty** for the whole phase. The runtime dependency set is still exactly `@mastra/mcp@1.15.0` + `@mastra/core@1.55.0`. No package was installed, added or upgraded, so the package-legitimacy gate has no subject. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-63-01 | T-63-04 | Byte-transparency is the phase requirement. The broker must not inspect or rewrite relayed frames, so tampering defence stays entirely client-side in `stock-protocol.ts`'s framing, desync and accumulation-cap validation — unchanged by this phase. | Plan-time disposition (`63-01-PLAN.md`) | 2026-09-19 |
| R-63-02 | T-63-05 | The relay handshake tag is a self-declared label answered ahead of the token gate and carries no authority. Spoofing it grants nothing; the control token plus the per-claim handle are the only authority decisions. | Plan-time disposition (`63-01-PLAN.md`) | 2026-09-19 |
| R-63-03 | T-63-16 | The TCP keepalive is deliberately labelled secondary. The broker-owned, injected-clock idle deadline is the primary bound, so the OS's ~7200s default is never load-bearing. | Plan-time disposition (`63-04-PLAN.md`) | 2026-09-19 |
| R-63-04 | WR-01 (`63-REVIEW.md`); substantively a Repudiation risk against ROADMAP Success Criterion 4 | `handleMonitorRelease()`'s no-current-holder branch unconditionally calls `tearDownRelaySessionForChannel()`, and cannot distinguish "a prior release already ran" from "`handleExit()` just cleared the holder because the emulator crashed". A client's own in-flight `monitor_release` landing in the window between `handleExit()`'s synchronous `record.monitorClients = {}` and that channel's relay socket's asynchronous `"close"`/`"error"` event deletes the `relaySessions` entry, making `handleRelayDeath()` early-return and silently absorbing an incident record. **Verified reachable in principle** — all four load-bearing code claims were re-read against the working tree and hold — but judged an acceptably narrow edge case: no production client legitimately races its own release against an unrelated crash notification, and the crash itself is still handled correctly by `handleExit()`'s respawn/backoff logic. Only the evidence record is lost, and only in that window. Fix (b) from `63-REVIEW.md` was explicitly **not** adopted. | Henrik Olsson, via UAT test 1 (`63-UAT.md`) | 2026-09-23 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-23 | 52 | 52 | 0 | `/gsd-secure-phase 63` (orchestrator, ASVS L1) |

**Method and its limits.** `register_authored_at_plan_time: true` — all twelve plans
carry a parseable `<threat_model>` block, so this run verified that each
`mitigate` entry's control is present rather than scanning for new threats, and
`asvs_level: 1` with `threats_open: 0` took the workflow's documented
short-circuit (L1 grep-depth sufficient; no auditor subagent spawned, no L2
boundary-placement or L3 end-to-end trace checks performed). Every high-severity
`mitigate` entry was checked directly against the working tree rather than taken
from a summary's narration:

- **T-63-01** — `randomBytes(16)` at `vice-broker.mts:1019`; `timingSafeEqual` guarded
  by an explicit length check at `vice-broker.mts:1289-1292`; double-attach refused.
- **T-63-15 / T-63-17 / T-63-19** — proving assertions located by name in
  `broker-relay.test.ts` / `broker-control.test.ts` / `host-tool-transport.test.ts`.
- **T-63-SC family** — measured as an empty `git diff` over all three manifests for
  the whole phase, not inferred from the absence of an install step.

Test evidence, exit codes read on the same line as the command, never through a pipe:
`node --test broker-relay.test.ts broker-relay-text.test.ts broker-incident.test.ts
broker-control.test.ts broker-endpoint.test.ts resources-sync.test.ts` → 212 pass /
0 fail, exit 0. Full glob `npm --prefix src/mcp/vice test` → 4281 tests, 4197 pass /
0 fail / 84 skipped, exit 0.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log — four entries, three plan-time and one from UAT
- [x] `threats_open: 0` confirmed — no open threat at or above the `high` block threshold
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-23
