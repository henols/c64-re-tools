---
phase: 3
slug: direct-tools
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-14
updated: 2026-08-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § "Validation Architecture (Focus Item 9)".
> Per-task IDs populated by `/gsd-plan-phase` on 2026-08-14 against the 13 PLAN files.

**Environment note (load-bearing):** no live stock VICE is reachable in this
environment. Every row below is validated **offline** — encoder byte-layout
round-trips, golden emitter tests, synthetic-event projection tests, and
manifest/`outputSchema` conformance. What cannot be validated offline is
enumerated under *Manual-Only Verifications* and is filed as verification debt in
`.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`
(created by plan 03-05 task 3), never silently claimed as passing.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no third-party framework, no new runtime deps |
| **Config file** | none — `node --test` defaults; `.claude/mcp/vice/package.json` `scripts.test` is `node --test '*.test.*'` |
| **Quick run command** | `cd .claude/mcp/vice && node --test stock-*.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`; excludes the three manual-only suites `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`) |
| **Estimated runtime** | ~10–30 seconds (pure unit, no emulator, no network) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` command (every task in every plan carries one).
- **After every plan wave:** Run `npm run test:automated`.
- **Before `/gsd-verify-work`:** Full automated suite green **plus** `npm run typecheck`.
- **Max feedback latency:** 30 seconds.

**Continuity rule check:** satisfied by construction — all 33 tasks across the 13
plans carry an `<automated>` verify command, so no 3 consecutive tasks can land
without an automated check.

---

## Wave 0 Requirements — CLOSED

Infrastructure already existed (Node's test runner, `test-gate.mjs`, the three
`stock-*.test.ts` suites from Phase 2). No framework install was needed. Every
Wave 0 gap `03-RESEARCH.md` listed is created **by the same task that creates the
module it tests**, so there is no separate Wave 0 plan:

| Wave 0 gap | Created by |
|---|---|
| `stock-address.test.ts` | 03-01 T2 |
| `stock-runstate.test.ts` | 03-01 T1 |
| `stock-handler.test.ts` | 03-01 T3 |
| `stock-condition.test.ts` | 03-03 T1, extended by T2 |
| `stock-checkpoints.test.ts` | 03-08 T1, extended by T2/T3 |
| `stock-execution.test.ts` | 03-09 T1, extended by T2 |
| `stock-machine.test.ts` | 03-10 T2, extended by T3 |
| `stock-paths.test.ts` | 03-10 T1 |
| `stock-registers.test.ts` | 03-07 T1, extended by T2 |
| `stock-memory.test.ts` | 03-06 T1, extended by T2 |
| `stock-petscii.test.ts` | 03-11 T1 |
| `stock-input.test.ts` | 03-11 T2, extended by T3 |
| `stock-schema-check.test.ts` | 03-12 T3 |
| `fork-manifest-surface.test.ts` | 03-05 T1 |
| `stock-protocol.test.ts` **extension** (encoder cases) | 03-02 T1, T2 |
| `stock-dispatch.test.ts` **extension** (contract + conformance) | 03-12 T1/T2/T3, 03-13 T3 |

---

## Per-Task Verification Map

Task IDs are `{phase}-{plan}-T{n}`. Every task in every plan appears exactly once.

| Task ID | Plan | Wave | Requirement | Decisions | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|------------|-----------------|-----------|-------------------|--------|
| 03-01-T1 | shared seams | 1 | DIRECT-05 | D-06, D-07, D-08 | T-3-06 | `runState` derives only from `STOPPED`/`RESUMED`/`JAM`; starts `"unknown"`; one listener per client; the projection never `send()`s | unit (synthetic event frames) | `node --test stock-runstate.test.ts` | ⬜ pending |
| 03-01-T2 | shared seams | 1 | DIRECT-01 | D-04 | T-3-01 | `parseAddress()` refuses a symbolic address with "no symbol table loaded", not a parse error; every address bounded to `0..0xffff` | unit (golden tables) | `node --test stock-address.test.ts` | ⬜ pending |
| 03-01-T3 | shared seams | 1 | DIRECT-01, DIRECT-05 | D-03, D-05, D-06 | T-3-04, T-3-06 | `stockAnswer()` stamps `runState` on every answer; exactly two error converters exist; no runtime import cycle | unit + regression (Phase 2's suite unchanged) | `node --test stock-handler.test.ts stock-dispatch.test.ts` | ⬜ pending |
| 03-02-T1 | encoders | 1 | DIRECT-01, DIRECT-02, DIRECT-03 | D-09 | T-3-01, T-3-02, T-3-04 | `MEM_GET` `sidefx` byte defaults to 0 and the body is always exactly 8 bytes; `memspaceByte(0x08)` refuses; `conditionSetBody` refuses >255 bytes before encoding | unit (encode → hand-decode each field at its literal offset) | `node --test stock-protocol.test.ts` | ⬜ pending |
| 03-02-T2 | encoders | 1 | DIRECT-04, DIRECT-06, DIRECT-07, DIRECT-08, DIRECT-09 | D-05, D-17 | T-3-04, T-3-05 | Every variable-length body's `u8` length field is range-checked before encoding; `resetBody` rejects any mode outside the named set; no encoder exists for the five empty-body opcodes | unit | `node --test stock-protocol.test.ts` | ⬜ pending |
| 03-03-T1 | condition AST | 1 | DIRECT-03 | D-09, D-10 | T-3-02 | Emitter parenthesises every comparison **and** every boolean node, emits `$hex`, uses uppercase `RL`/`CY`; `RL`/`CY` range-checked | unit (golden: exact expected wire string) | `node --test stock-condition.test.ts` | ⬜ pending |
| 03-03-T2 | condition AST | 1 | DIRECT-03 | D-09 | T-3-02, T-3-04 | `LIN`/`CYC`, lowercase names, bare decimals, unparenthesised conjunctions and empty input each refuse with the correct form named; both input paths emit byte-identical text | unit (golden refusals) | `node --test stock-condition.test.ts` | ⬜ pending |
| 03-04-T1 | broker | 1 | DIRECT-06 | D-13 | T-3-07, T-3-08 | Text monitor binds the same resolved host as the binary monitor with one widened-bind note; second socket left deliberately unclaimed with the reason in a code comment; fork argv byte-identical | unit | `node --test broker-state.test.ts broker-launch.test.ts` | ⬜ pending |
| 03-04-T2 | broker | 1 | DIRECT-06 | D-13 | T-3-08 | Second-port allocation failure degrades to launching without `-remotemonitor` rather than failing the acquire; `resources/*.mjs` rebuilt with no drift | unit | `node build.ts && node --test resources-sync.test.ts broker-launch.test.ts` | ⬜ pending |
| 03-05-T1 | surface & docs | 1 | DIRECT-08 | D-16 | T-3-09 | `vice_snapshot_list` gone from the fork manifest, `snapshot.list` gone from every description, fork surface gated at exactly 62 tools with BACK-02 named in the gate's header | unit | `node --test fork-manifest-surface.test.ts` | ⬜ pending |
| 03-05-T2 | surface & docs | 1 | DIRECT-03, DIRECT-06, DIRECT-07 | D-01, D-05, D-14, D-15 | T-3-06 | Every Phase 3 divergence, default flip, approximation and trim recorded with its decision id; the stale "client counts hits and auto-resumes" claim removed | doc assertion | `grep -c 'Expected divergences' docs/stock-vice-parity.md` and `test "$(grep -c 'auto-resumes' docs/stock-vice-parity.md)" = 0` | ⬜ pending |
| 03-05-T3 | surface & docs | 1 | DIRECT-06, DIRECT-07 | — | T-3-02 | All four `[ASSUMED]` wire details plus the A4 design assumption filed as one high-priority pending todo with runnable confirmation steps | file assertion | `grep -c 'JOYPORT_SET' .planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md` | ⬜ pending |
| 03-06-T1 | family A memory | 2 | DIRECT-01 | D-03, D-04, D-05, D-06 | T-3-01 | Reading `$D019` encodes `sidefx = 0` by default; range overflow and short reads refused explicitly; zero sends on a refused argument | unit (stubbed client, byte-level) | `node --test stock-memory.test.ts` | ⬜ pending |
| 03-06-T2 | family A memory | 2 | DIRECT-09 | D-06 | T-3-01 | Named banks resolve through the emulator's own `BANKS_AVAILABLE` enumeration, cached once per session; unknown bank names refuse listing the available names | unit | `node --test stock-memory.test.ts` | ⬜ pending |
| 03-07-T1 | family A registers | 2 | DIRECT-09 | D-01, D-06 | T-3-01 | Register catalog fetched once per session from `REGISTERS_AVAILABLE`; an empty enumeration refuses rather than caching; no hardcoded id table | unit (synthetic `registers_available` fixture) | `node --test stock-registers.test.ts` | ⬜ pending |
| 03-07-T2 | family A registers | 2 | DIRECT-02 | D-03, D-05 | T-3-01, T-3-02 | Value range-checked against the register's wire-declared size; unknown names refuse listing available names; flag-bit names get an explanatory refusal; read-back reported alongside the request | unit | `node --test stock-registers.test.ts` | ⬜ pending |
| 03-08-T1 | family B | 2 | DIRECT-03 | D-06, D-12, D-15 | T-3-04 | `stop: false` without `acknowledgeTraceRisk` refuses with the synchronous-CPU-loop hazard named and zero sends; no ignore-count tool; no inline `condition` on add | unit | `node --test stock-checkpoints.test.ts` | ⬜ pending |
| 03-08-T2 | family B | 2 | DIRECT-03 | D-09, D-10, D-12 | T-3-02, T-3-03 | A failed `CONDITION_SET` deletes the checkpoint it was conditioning; a failed cleanup reports BOTH failures; conditions immutable once set; wire bytes carry the emitter's parenthesised text | unit (stubbed client forced to fail) | `node --test stock-checkpoints.test.ts` | ⬜ pending |
| 03-08-T3 | family B | 2 | DIRECT-03 | D-11 | T-3-04 | 20 hits/second per checkpoint, then exactly one auto-disable toggle, **deferred out of the event-handler stack** (asserted: zero sends immediately after the crossing `emit()`, one after the `setImmediate` tick); id + reason + rate reported | unit (synthetic hit bursts, injected clock) | `node --test stock-checkpoints.test.ts` | ⬜ pending |
| 03-09-T1 | family C | 2 | DIRECT-05 | D-05, D-08 | T-3-06 | Pause short-circuits when `"stopped"`, resume when `"running"` — a genuine retry produces **zero** wire traffic; the command **is** sent while `"unknown"`; exactly one `EXIT` site | unit (stubbed `send()`, asserted not-called) | `node --test stock-execution.test.ts` | ⬜ pending |
| 03-09-T2 | family C | 2 | DIRECT-04 | D-07 | T-3-02 | Step and execute-until-return **refuse** while `runState === "unknown"` with zero sends, and DO send while `"running"`; the refusal scopes the gate to the execution tools | unit | `node --test stock-execution.test.ts` | ⬜ pending |
| 03-10-T1 | family D machine | 2 | DIRECT-08 | D-17 | T-3-05 | One declared four-entry table; translation refuses an undeclared tool; snapshot names cannot escape the workspace (`../etc/passwd` refused); host mode bypasses translation | unit | `node --test stock-paths.test.ts` | ⬜ pending |
| 03-10-T2 | family D machine | 2 | DIRECT-06 | D-05, D-13, D-14 | T-3-06 | `run_after` defaults to false (one send, no `EXIT`); units 9-11 refuse with `no drive-unit field` named and zero sends; `program` refused, not dropped; `vice_disk_detach` absent | unit | `node --test stock-machine.test.ts` | ⬜ pending |
| 03-10-T3 | family D machine | 2 | DIRECT-08 | D-17 | T-3-05, T-3-10 | `DUMP`/`UNDUMP` filenames routed through the D-17 seam; a failing `DUMP` leaves no metadata sidecar; a sidecar write failure reported as `metadataWritten: false` rather than swallowed | unit (encoder) + integration (translation call made, via stub) | `node --test stock-machine.test.ts` | ⬜ pending |
| 03-11-T1 | family D input | 2 | DIRECT-07 | — | T-3-01 | The ASCII→PETSCII table refuses **every** byte it does not map (including `0x93` clear-screen and non-Latin-1), naming the index; asserted exhaustively over all 256 code points | unit (exhaustive table test, ≥10 assertions) | `node --test stock-petscii.test.ts` | ⬜ pending |
| 03-11-T2 | family D input | 2 | DIRECT-07 | D-03, D-05 | T-3-01 | Conversion only through the one table; a control code in `text` refuses with zero sends; `data` elements range-checked with the index named; the exact wire bytes echoed as `petsciiHex` | unit | `node --test stock-input.test.ts` | ⬜ pending |
| 03-11-T3 | family D input | 2 | DIRECT-07 | D-05, D-15 | T-3-02, T-3-06 | One `[ASSUMED]`-labelled bit constant; contradictory direction pairs and invalid ports refused with zero sends; composed `value` and decoded `valueBits` reported; no `handleJoystickTap` | unit | `node --test stock-input.test.ts` | ⬜ pending |
| 03-12-T1 | integration | 3 | DIRECT-01..09 | D-06, D-07, D-09 | T-3-04, T-3-06 | Tracker attached at exactly the two fresh-client branches and **not** in the reuse branch (listener count asserted across a reuse call); an escaped handler exception becomes a refusal, never reaching the never-throw boundary | unit | `node --test stock-dispatch.test.ts` | ⬜ pending |
| 03-12-T2 | integration | 3 | DIRECT-01..09 | D-09, D-13, D-15, D-16 | T-3-05, T-3-09 | 25 table keys, one table, one dispatch site, no fall-through; the eight decision-trimmed tools refused **without reading `deps`** (asserted with a throwing `ensureLease`) | unit | `node --test stock-dispatch.test.ts` | ⬜ pending |
| 03-12-T3 | integration | 3 | DIRECT-01..09 | D-02, D-03, D-06, D-07 | T-3-09 | Dependency-free schema checker reports unsupported keywords rather than ignoring them; fork-compatible `required` sets enforced; `STOCK_ONLY_TOOLS` an explicit named list; bidirectional table/manifest agreement; `runState` enum required on every `outputSchema` | unit | `node --test stock-schema-check.test.ts stock-dispatch.test.ts` | ⬜ pending |
| 03-13-T1 | manifest | 4 | DIRECT-01, DIRECT-02, DIRECT-04, DIRECT-05, DIRECT-09 | D-02, D-03, D-06, D-07 | T-3-01 | 11 entries with fork-verbatim `required` lists, stock-only additions optional, `outputSchema` inside the checker's subset with a required `runState` enum; no `oneOf`/`$ref` | unit (node one-liner over the manifest) | `node -e "<manifest assertions>"` (see 03-13 T1 verify) | ⬜ pending |
| 03-13-T2 | manifest | 4 | DIRECT-03, DIRECT-06, DIRECT-07, DIRECT-08 | D-02, D-03, D-11, D-12, D-14, D-16 | T-3-04, T-3-06, T-3-09 | 25 entries total; `vice_checkpoint_set_ignore_count`, `vice_snapshot_list`, `vice_disk_detach`, `vice_joystick_tap` all absent; `acknowledgeTraceRisk` optional on both checkpoint-arming tools; no `condition` on `vice_checkpoint_add` | unit | `node --test stock-dispatch.test.ts` | ⬜ pending |
| 03-13-T3 | manifest | 4 | DIRECT-01..09 | D-02, D-06 | T-3-09 | Every one of the 25 tools dispatched through `dispatchStock()` and its real answer validated against its own `outputSchema`; completeness guard ties the case list to the manifest; negative control proves the checker is not vacuous | unit (schema-conformance harness) | `node --test stock-dispatch.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Threat Register Index

`T-3-01`..`T-3-05` are the ids this document reserved; `T-3-06`..`T-3-10` were
added during planning for threats the reserved five did not cover.

| Threat ID | Description | Mitigated by |
|---|---|---|
| T-3-01 | A side-effecting read (`sidefx` byte non-zero, or an out-of-range address wrapping) silently alters the debugged program | 03-01-T2, 03-02-T1, 03-06-T1, 03-06-T2, 03-07-T1, 03-07-T2, 03-11-T1, 03-11-T2, 03-13-T1 |
| T-3-02 | A silently-always-false checkpoint condition — the agent believes a breakpoint is armed when it is not | 03-02-T1, 03-03-T1, 03-03-T2, 03-05-T3, 03-08-T2, 03-09-T2, 03-11-T3 |
| T-3-03 | An armed **unconditioned** full-range breakpoint left behind when `CONDITION_SET` fails | 03-08-T2 |
| T-3-04 | A `stop: false` trace checkpoint deadlocking client and emulator from inside the CPU loop; also framing desync and never-throw-boundary escapes | 03-02-T1, 03-02-T2, 03-03-T2, 03-08-T1, 03-08-T3, 03-12-T1, 03-13-T2 |
| T-3-05 | An LLM-supplied path escaping the workspace via `AUTOSTART`/`DUMP`/`UNDUMP`/disk attach | 03-02-T2, 03-10-T1, 03-10-T3, 03-12-T2 |
| T-3-06 | An unrequested `EXIT` restarting a machine the agent believed halted (D-05/D-08) | 03-01-T1, 03-01-T3, 03-04-T2, 03-05-T2, 03-09-T1, 03-10-T2, 03-11-T3, 03-12-T1, 03-13-T2 |
| T-3-07 | The second (`-remotemonitor`) socket exposed past loopback, or claimed by an uncoordinated client | 03-04-T1 |
| T-3-08 | Second-port allocation exhausting the band or failing the whole acquire | 03-04-T1, 03-04-T2 |
| T-3-09 | Tool-surface regression or capability misrepresentation (a tool advertised with no handler, an answer shape the handler does not produce, an accidental fork-manifest change) | 03-05-T1, 03-12-T2, 03-12-T3, 03-13-T1, 03-13-T2, 03-13-T3 |
| T-3-10 | A snapshot metadata sidecar claiming a snapshot that does not exist | 03-10-T3 |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New encoders are byte-for-byte accepted by a real VICE binary | DIRECT-01..09 | No live stock VICE in this environment. Body layouts are grounded in the normative docs and the repo's own tested `probe-binmon.mjs` builders, but `ADVANCE_INSTRUCTIONS` step-over semantics (A2), `JOYPORT_SET`'s bit layout (A3), `-remotemonitoraddress`'s spelling (A1) and `AUTOSTART`'s `fileIndex` with the run flag clear (A5) are `[ASSUMED]` | Follow `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`'s numbered acceptance procedure. **Not a Phase 3 blocker** |
| Real-world event ordering across connect → tool call → disconnect matches the `runState` projection | DIRECT-05, D-06/07/08 | `runState`'s honesty is provable against synthetic events; its real-world correctness depends on the ordering a real emulator emits, which `docs/phase1-probe-results.md` recorded only for a subset of transitions | Same session: log the raw event stream across the full new tool set and diff against the projection's expected transitions |
| `-remotemonitor` actually binds the second port and coexists with `-binarymonitor` | DIRECT-06 (D-13 launch half) | Phase 3 builds no text client, so nothing dials the port; only the launch flag and allocation are in scope | Launch stock with both flags, `ss -ltnp` both ports, confirm both accept a connection. Phase 7 owns the transport |
| The D-11 rate limiter's `setImmediate` deferral is race-free under a real synchronous flood | DIRECT-03 (D-11) | The deferral's *ordering* is unit-tested (zero sends before the tick, one after), but whether it suppresses a genuine CPU-loop flood without reentering it is only observable against a real emulator (RESEARCH.md A4) | Arm a `stop: false` checkpoint on a hot address; confirm the checkpoint is disabled and neither client nor emulator stalls |
| `vice-sync.ts` checkpoint-wait timing invariants | DIRECT-03 | Deliberately not unit-tested by project convention (CLAUDE.md) — correctness only means anything against a real emulator's timing. **Untouched by Phase 3** (that module is fork-side, using `call()` from `vice.ts`, not the stock dispatch table) | Preserve by inspection: exactly one resume per wait; poll on `hit_count`, never on paused state; never delete a VICE-marked temporary checkpoint |
| Manual-only suites excluded from `npm run test:automated` | DIRECT-06, DIRECT-08 | `vice-broker-launch.test.ts`, `vice-proxy.test.ts` and `broker-e2e.test.ts` stall outside the devcontainer (user-dispositioned 2026-08-12, not a bug) | Plans 03-04 T2 and 03-05 T1 and 03-13 T3 each run their relevant manual-only suite **explicitly** and record the result in their SUMMARY |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify — 33/33 tasks across 13 plans
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ references above — every test file is created by the task that creates its module
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] Every offline-unverifiable claim is filed as a pending todo (03-05 T3), not silently claimed
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-14 by `/gsd-plan-phase 3`
