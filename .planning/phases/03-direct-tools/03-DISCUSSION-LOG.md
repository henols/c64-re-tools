# Phase 3: Direct Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 3-Direct Tools
**Areas discussed:** Answer shape vs fork, Halt/resume policy, Condition argument shape, Tools with no 1:1 opcode

---

## Answer shape vs fork

**Q1 — For a tool that exists on both backends, how closely must the stock backend's JSON answer match the fork's?**

| Option | Description | Selected |
|--------|-------------|----------|
| Documented common core | Per-tool core field set both backends must produce; stock may add fields; Phase 8 harness diffs the core | |
| Bug-for-bug identical | Capture the fork's actual JSON per tool and reproduce exactly; needs a live fork capture session first | |
| Stock-native, divergence logged | Design the cleanest shape for stock; record divergences in `docs/stock-vice-parity.md` | ✓ |

**User's choice:** Stock-native, divergence logged
**Notes:** Context surfaced during the question — `tools-manifest.json` carries no `outputSchema` on any tool, so the fork's answer shapes are undocumented and only observable by running the fork. Consequence flagged: skills that parse fork answer fields break on stock, widening SKILL-01 (Phase 8) beyond capability gaps.

**Q2 — What makes the stock answer shape discoverable rather than something a skill learns by breaking?**

| Option | Description | Selected |
|--------|-------------|----------|
| outputSchema on stock manifest | Each stock tool declares an outputSchema; machine-readable at tools/list, test-assertable | ✓ |
| Prose divergence list only | Record differences in the parity doc; Phase 8 treats listed items as expected | |
| Both | outputSchema as enforced contract plus a parity-doc appendix | |

**User's choice:** outputSchema on stock manifest
**Notes:** Fork manifest deliberately stays without `outputSchema` — adding it would be a fork-surface change BACK-02 forbids.

**Q3 — Do inputs also go stock-native, or stay fork-compatible?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fork-compatible + optional extras | Required args match the fork; stock may add optional args with safe defaults | (taken by default) |
| Inputs go stock-native too | Full freedom; reverses the standing CLAUDE.md same-argument-shape rule | |
| Fork-compatible, may drop unhonourable args | Keep fork names but omit args stock cannot honour | |

**User's choice:** [No preference] — Claude's discretion
**Notes:** Default taken was fork-compatible plus optional extras, because it preserves the standing rule and keeps existing skill *calls* working even though answers diverge. Recorded as D-03 with an explicit note that the planner may revisit with a stated reason.

**Q4 — How should stock handle a symbolic address in Phase 3, before the Phase 5 symbol store exists?**

| Option | Description | Selected |
|--------|-------------|----------|
| Shared parser with symbol hook | One `parseAddress()` seam, pluggable resolver empty until Phase 5; symbolic address refuses with "no symbol table loaded" | ✓ |
| Numeric only, no hook | Refuse anything non-numeric; Phase 5 adds resolution where it needs it | |
| Pull the symbol store forward | Land a minimal symbol table now; contradicts the roadmap phase split | |

**User's choice:** Shared parser with symbol hook
**Notes:** Avoids re-deriving an address parser per tool family — the codebase's own named anti-pattern.

---

## Halt/resume policy

**Q1 — A skill calls `vice_memory_read` while the emulator is running; on stock that command halts the machine. What happens next?**

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent restore | Issue EXIT after the command if the derived state was running; matches fork semantics | |
| Leave halted, say so | Every command leaves the machine stopped; the answer carries the run state; the agent resumes explicitly | ✓ |
| Transparent, but opt-out | Transparent restore with a `leaveStopped` arg for batches | |

**User's choice:** Leave halted, say so
**Notes:** Chosen with the consequence stated up front — this is the biggest behavioural divergence in the milestone, and `c64-ram-capture` / `c64-program-recon` both assume a read does not stop the game. It satisfies success criterion 1 maximally (no round trip at all) and lands on SKILL-01 in Phase 8.

**Q2 — Where does the run state surface?**

| Option | Description | Selected |
|--------|-------------|----------|
| On every stock answer | `runState` on every answer, derived purely from the event stream | ✓ |
| vice_ping and execution tools only | Leaner schemas; costs a second call after a read | |
| Only when it changed | Smallest answers; absence is ambiguous to a parser | |

**User's choice:** On every stock answer

**Q3 — What are commands allowed to do while the derived state is `unknown` after connect?**

| Option | Description | Selected |
|--------|-------------|----------|
| Everything, never auto-resume | Nothing gated; simplest | |
| Resolve at connect | Assert "stopped" post-handshake; removes the third state | |
| Gate execution tools only | Memory/register/checkpoint run freely; step and execute-until-return refuse while unknown | ✓ |

**User's choice:** Gate execution tools only
**Notes:** "Resolve at connect" was flagged as asserting something the protocol did not report — the exact thing the roadmap note forbids.

**Q4 — How is pause/resume idempotency enforced?**

| Option | Description | Selected |
|--------|-------------|----------|
| Short-circuit on known state | No wire traffic on a genuine retry; while `unknown` the command is sent | ✓ |
| Always send, document harmless | Simpler client; a duplicate resume after an event race genuinely restarts the machine | |
| Short-circuit plus resume cooldown | Adds EXIT rate limiting per the roadmap's "cool resumes down" note | |

**User's choice:** Short-circuit on known state
**Notes:** The resume cooldown was explicitly not taken; recorded as a deferred idea to revisit only if a resume storm is observed.

---

## Condition argument shape

Stated up front and not re-decided: Phase 6 criterion 4 already settles that bare-decimal, `LIN`/`CYC`, lowercase, and unparenthesised conditions are refused with an explanation rather than sent.

**Q1 — How does the typed condition builder meet a fork tool whose condition argument is a plain string?**

| Option | Description | Selected |
|--------|-------------|----------|
| Parse string → AST → re-emit | `condition` stays a string; stock parses, refuses traps, re-emits canonically | |
| Structured AST argument | `condition` becomes an object; breaks the argument-shape rule and every skill call site | |
| Accept either | String or structured object, both funnelling into one AST and one emitter | ✓ |

**User's choice:** Accept either
**Notes:** Two input paths, one emitter — the emitter is the only thing that produces wire text.

**Q2 — Where does the condition registry / orphan-checkpoint cleanup land?**

| Option | Description | Selected |
|--------|-------------|----------|
| Build it in Phase 3 | Registry, immutable conditions, fail-closed deletion when CONDITION_SET fails | ✓ |
| Defer to Phase 6 | Smaller phase now; Phases 3–5 run with a known leak | |
| Cleanup now, registry later | Closes the armed-breakpoint hazard; listings can't show conditions until Phase 6 | |

**User's choice:** Build it in Phase 3
**Notes:** Supersedes the roadmap's placement of this note under Phase 6, for the registry and cleanup halves. The leak exists the moment DIRECT-03 ships.

**Q3 — Should stock's `vice_checkpoint_add` accept an optional condition (atomic add+condition)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional condition arg | Add + CONDITION_SET as one operation; the dangerous window never exists | |
| No, keep the fork's split | Mirror the fork exactly; fail-closed cleanup covers the window | ✓ |
| Yes, and make it the documented route | Atomic form plus doc steering | |

**User's choice:** No, keep the fork's split
**Notes:** Keeps both backends' call sequences identical for Phase 8's parity harness.

**Q4 — What does stock do with `stop:false` (trace) checkpoints?**

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in + rate limit + disable | Explicit acknowledging arg, per-second hit-rate limit, auto-toggle-off with the reason reported | ✓ |
| Refuse stop:false in Phase 3 | Smallest safe surface; a real fork capability missing until later | |
| Allow with a warning only | Cheapest; leaves a documented way to hang the emulator | |

**User's choice:** Opt-in + rate limit + disable

---

## Tools with no 1:1 opcode

Gap list presented: disk attach (AUTOSTART approximation), disk detach (no opcode), checkpoint ignore count (no native ignore), snapshot list/metadata (client bookkeeping).

**Q1 — What happens to disk detach?**

| Option | Description | Selected |
|--------|-------------|----------|
| Trim from stock manifest | Absent; BACK-05 reports it in Phase 8 | |
| Broker relaunch | Genuinely detaches but destroys all emulation state | |
| Text monitor route | The text monitor's detach exists over a concurrent `-remotemonitor`; reopens Phase 2's D-12 | ✓ |

**User's choice:** Text monitor route

**Q2 — How much of the text-monitor route lands in Phase 3?**

| Option | Description | Selected |
|--------|-------------|----------|
| Flag + minimal client | Launch flag, second port, and a minimal text client used only for attach/detach | |
| Flag only, detach in Phase 7 | Launch flag and port allocation now; the tool and the client ship in Phase 7 | ✓ |
| Full text transport now | Complete text transport built in Phase 3 | |

**User's choice:** Flag only, detach in Phase 7
**Notes:** Keeps Phase 3 purely binary-monitor at the protocol layer. Two knock-ons flagged: it reverses Phase 2's D-12, and the second socket touches Phase 2's D-13 ownership record. Requires a roadmap change moving DIRECT-06's detach half to Phase 7.

**Q3 — How is `vice_checkpoint_set_ignore_count` resolved against the leave-halted policy?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sanctioned exception | Implement as the single documented carve-out to leave-halted | |
| Trim from stock manifest | Absent; halt policy stays absolute; DIRECT-03 partially met | ✓ |
| Rename the semantics | Report ignored hits without resuming; no longer an ignore count in any useful sense | |

**User's choice:** Trim from stock manifest
**Notes:** The halt policy stays absolute with no carve-out.

**Q4 — Who translates emulator-side path arguments (DUMP/UNDUMP, AUTOSTART) on the stock path?**

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit per-tool, declared | A declared table names which stock tools have emulator-side path args; those handlers call `hostpath.ts` | (taken) |
| Reuse rewriteArguments() | Imports the fork transport's helper into a path D-09 says must never touch it | |
| Require host paths from caller | Pushes the container/host distinction onto every skill | |

**User's choice:** "you decide" — Claude's discretion
**Notes:** Option 1 taken. Noted as the mirror image of the DERIV-07 hazard: there translating is the bug, here not translating is.

**Q5 — Where does `vice_snapshot_list` belong?**

**User's response (free text):** "if it ever used? if not just delete it"

Verified before answering: no skill, no script, no source calls `vice_snapshot_list`. The only reference in the repo is `vice_snapshot_load`'s own description (`tools-manifest.json:1000`). Constraint surfaced in reply: removing it from the fork manifest changes the fork's advertised list, which BACK-02 pins to v0.1.x.

| Option | Description | Selected |
|--------|-------------|----------|
| Absent from stock, keep on fork | Never ported; fork untouched so BACK-02 holds | |
| Drop from both | Cleanest end state; needs the same explicit reconciliation D-07 got | ✓ |
| Drop from both, file it separately | Absent from stock now; fork cleanup as its own reviewed change | |

**User's choice:** Drop from both
**Notes:** Recorded as a deliberate BACK-02 exception requiring roadmap reconciliation, with `vice_snapshot_load`'s description updated in the same change.

---

## Claude's Discretion

- **Input argument shape** (D-03) — user expressed no preference; fork-compatible required args plus optional stock extras taken as the default, preserving the standing rule.
- **Emulator-side path translation** (D-17) — user said "you decide"; explicit per-tool declared table via `hostpath.ts` taken.
- Module layout for Phase 3 handlers; request-body encoder design in `stock-protocol.ts`.

## Deferred Ideas

- Resume cooldown / EXIT rate limiting — not implemented; revisit only if a resume storm is observed.
- The text-monitor transport itself — Phase 7, alongside the stopwatch route.
- `vice_disk_detach` — Phase 7. `vice_disk_read_sector` — Phase 5.
- Low-level keyboard, `vice_sid_get_state` — hard losses; absent from the stock manifest.
- `vice_machine_config_get`/`set` — Phase 6 (GAIN-07).
- Two roadmap reconciliations: DIRECT-06's detach half moving to Phase 7, and BACK-02's exception for `vice_snapshot_list`.
- Widening SKILL-01 (Phase 8) to cover answer-shape drift and the read-halts-the-machine divergence.
