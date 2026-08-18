# Deferred Items — Phase 07 (cycle-timing-and-wedge-triage)

## 07-01: pre-existing worktree-path test failure (out of scope)

`npm run test:automated` reports 1 failure out of 1429 tests:

```
not ok 375 - path agreement (D-3, D-6, THE regression this task exists to catch): the
launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

This is the same `repo-root.test.ts` worktree-path artifact already documented as
deferred for `04-01` (commit `5499f10`) and the `260817-n6p` quick task (commit
`ff87d94`) — a property of running inside a Claude Code git worktree
(`.claude/worktrees/agent-*`), not caused by this plan's changes to
`stock-connect.ts` / `stock-connect.test.ts`. Not fixed here; scope boundary
excludes pre-existing failures unrelated to the current task's files.

## 07-10: Route A (`CPUHISTORY_GET`) live decode mismatch against genuine VICE 3.10 (out of scope, needs a dedicated fix plan)

While performing 07-10's Task 3 manual-only verification pass (`07-VALIDATION.md`),
an ad hoc live probe dispatched `vice_cycles_stopwatch` through the real
`dispatchStock()` seam against a genuine, unmodified VICE 3.10 build
(`/usr/local/bin/x64sc -version` reports `VICE 3.10`; the fork's own build target,
confirmed to also support `-binarymonitor`) with `session.capabilities.cpuHistory`
forced to `"available"` so Route A would be exercised. The call failed:

```
vice_cycles_stopwatch: the binary monitor's reply could not be decoded
(response type 0x86 body is 52 byte(s), needs at least 65).
```

A follow-up raw-wire probe (hand-built binary-monitor request/response framing,
bypassing this tree's parser entirely) confirmed the real `CPUHISTORY_GET`
(`0x86`) reply for `count:1` against this build:

```
body (hex, 52 bytes): 010000002f080003037cfd0300ab0003010000030270000304fd0003
05a4000335ffff0336ffff73b20b000000000004d1c1d0ff
```

Decoded per `stock-protocol.ts`'s own documented layout (`count(u32LE)` then
per-entry `item_size(1) + register-block(item_size bytes) + cycle(u64LE) +
instruction_length(1) + opcode(1) + p1(1) + p2(1) + placeholder(1)`): `count=1`,
`item_size=0x2f=47`. But `5 (count+item_size bytes) + 47 (declared register
block) = 52` — exactly the entire body, with **no bytes left** for the
documented trailing `cycle(8) + instruction fields(5) = 13` bytes the parser
requires (`need(body, offset + 1 + itemSize + 8 + 5, ...)` at
`stock-protocol.ts:1436`). Either `item_size` denotes something other than "raw
register-block byte count" on this real build (e.g. the whole entry's stride,
with `cycle`/opcode fields living *inside* those 47 bytes rather than after
them), or the documented layout (`monitor_binary.c:1563-1617`, cited in
`stock-protocol.ts`'s own comment) does not match this VICE 3.10 build's actual
wire behavior. `07-05-SUMMARY.md`'s claim that Route A is "exact for any bracket
length" and `07-VALIDATION.md`'s Manual-Only row "Route A stopwatch on a >= 3.10
build" have **not** been live-proven — the existing unit tests
(`stock-protocol.test.ts`, `stock-timing.test.ts`) all construct synthetic wire
bodies from the same assumed layout, so they cannot catch a wrong assumption
shared between the fixture and the code (the exact failure mode Phase 2's and
Phase 5's post-mortems both warned about).

**Not fixed here** — root-causing the real per-entry wire layout (consulting
VICE's actual `monitor_binary.c` source for this build's version, or capturing
and diffing against a second real 3.10 build) is protocol-level investigation
well outside 07-10's docs-only scope (three corrected documents, no code
changes). `07-VALIDATION.md`'s Manual-Only Verifications table records this
row as **outstanding** rather than a clean pass, and `nyquist_compliant` is
left `false` naming this row as the blocker. Recommend a dedicated follow-up
plan (Phase 8 or a Phase 7 gap-closure plan) to re-derive the real entry
layout from source and fix `stock-protocol.ts`'s `CpuHistoryGet` parser and/or
`stock-timing.ts`'s Route A consumer.

The other three manual-only behaviors this same pass exercised **did** pass
live, against both `/usr/bin/x64sc` (genuine unpatched stock 3.9) and
`/usr/local/bin/x64sc` (genuine VICE 3.10): Route B's stopwatch (including a
live wraparound refusal on the 3.9 run), `vice_run_until` reaching a real
address ($EA31, the KERNAL IRQ entry) and timing out on an unreached one
($C000) with checkpoint auto-cleanup, and `vice_diagnose`'s `live` verdict via
a real liveness bracket. See `07-VALIDATION.md`'s Manual-Only Verifications
table for the recorded results.
