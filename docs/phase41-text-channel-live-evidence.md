# Phase 41 Plan 06: Live Text-Channel Evidence

This document is this phase's own live-evidence record, closing the gap named
in `41-CONTEXT.md`'s D-04: the three narrowed `CLAUDE.md` constraints
(`default_memspace`/`device c:`, the absent runtime `WarpMode` resource,
`CPUHISTORY_GET`'s version floor) all cited only the `/gsd-explore` live probe
of 2026-08-27 -- not a phase's own evidence discipline. This document is that
citation for the first two, and cross-references Phase 39's independent
citation for the third.

Every run below is against genuine, unpatched stock VICE, resolved by
absolute path (the fork build shadows `x64sc` on `$PATH`), with no broker
daemon and no leftover `x64sc` process running beforehand (`pgrep -fa
vice-broker`, `pgrep -fa x64sc` both confirmed empty immediately before each
run in this session).

- **Binary:** `/usr/bin/x64sc`
- **Reported version:** `x64sc (VICE 3.9)` (`/usr/bin/x64sc --version`)
- **Date:** 2026-09-09
- **Command (all runs below):**
  ```
  VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts
  ```
  run from `src/mcp/vice/`, with the two new cases added by this plan
  (`text-monitor-live (criterion 5, D-03/D-04)` and `text-monitor-live
  (D-04)`) run alongside the file's five pre-existing live cases (plans
  41-01, 41-02, 41-04), all of which stayed green in the same invocation.

## Run 1 -- the `default_memspace` contamination and remedy (criterion 5)

**What was measured, and what was not.** Criterion 5 asks for the remedy to
be exercised, not merely made available -- so this run actually contaminates
`default_memspace` (arms a real drive checkpoint and lets it hit) rather than
asserting the remedy is reachable and stopping there.

**No shipped tool can produce the contamination.** `stock-checkpoints.ts`'s
`handleCheckpointAdd` (`vice_checkpoint_add`) takes no `memspace` argument at
all -- this is D-03's own stated rationale for why `device c:` is not
auto-healing. This test therefore arms the drive checkpoint through the raw
wire encoder (`checkpointSetBody({ memspace: 0x01, ... })`,
`stock-protocol.ts`) directly against the binary session's client -- the one
place in `text-monitor-live.test.ts` that reaches past the tool surface, and
only because there is no tool surface here to reach through.

**Drive emulation is on by default.** `broker-launch.mts` already launches
every stock instance with `-drive8type 1541` explicitly, and this build's own
compiled-in default already reads `Drive8TrueEmulation=1` (FINDING-C1, plan
08.2-02; re-confirmed live in an earlier debug pass of this same plan via
`RESOURCE_GET` on `Drive8TrueEmulation` and `Drive8Type`, both returning `1`
and `1541` respectively). So the drive's own 6502 is genuinely emulated and
continuously executing its own ROM firmware from boot -- no disk image or
autostart was needed to produce drive activity.

**The checkpoint:** armed over the entire mapped 1541 ROM range
(`start=$C000, end=$FFFF, memspace=0x01, operation=Exec, stop=true`) rather
than one named routine address, since this project's own `memmap.json`
documents only C64 addresses, never 1541 drive ROM ones. The very next
drive-CPU instruction fetch anywhere in ROM trips it.

**MEASURED, not assumed: `CHECKPOINT_LIST` (0x14) is scoped to
`default_memspace`.** Polling `CHECKPOINT_LIST` immediately after arming the
drive checkpoint (while `default_memspace` was still `main`) returned `total:
0` on every single poll for the whole 15-second window -- not because the
checkpoint failed to arm, but because `CHECKPOINT_LIST`'s own answer only
lists whatever `default_memspace` currently names. This is a genuine
chicken-and-egg: you cannot see the drive checkpoint in the list until AFTER
it has already contaminated `default_memspace` to drive. This project has no
prior record of this fact (checked: `git grep -in "memspace" -- '*.md'`
across `docs/` and `CLAUDE.md` turns up nothing about `CHECKPOINT_LIST`'s own
scoping). Detection therefore uses the UNSOLICITED `CHECKPOINT_INFO` (0x11)
event VICE pushes on every checkpoint hit (already a `CLAUDE.md` Protocol
constraint), which arrives regardless of which memspace `CHECKPOINT_LIST`'s
own listing happens to be scoped to.

**The contamination signature, as measured (not the alternative D-03
names).** D-03's own text allows either manifestation ("a stepping call steps
the drive CPU, or a bank-qualified condition fails outright — assert
whichever the run actually shows"). This run's ground truth is
`vice_registers_get`, which always sends an explicit `memspace:0x00` (main)
on the wire (`stock-registers.ts`) and is therefore immune to contamination.
`vice_execution_step`'s own `ADVANCE_INSTRUCTIONS` request carries no
`memspace` field at all (the cited fact) -- contaminated, it silently steps
whichever CPU `default_memspace` currently names.

  - Main-CPU PC immediately before stepping: `0xfd83`.
  - `vice_execution_step` issued (contaminated `default_memspace`) -- its own
    reported `programCounter`: `64899` (`0xfd83` -- i.e. the STOPPED event's
    own PC field also reads `0xfd83`, the SAME value, not a step forward).
  - Main-CPU PC immediately after that step, read again via
    `vice_registers_get` (memspace explicit, unaffected): `0xfd83` -- FROZEN,
    unchanged. **This run's observed manifestation is the frozen-PC one**,
    not the bank-condition-failure alternative -- no bank-qualified
    checkpoint condition was exercised in this run.
  - No text-channel command was issued at any point up to here
    (`textCommandCount === 0`, asserted) -- D-03's requirement that `device
    c:` is not auto-healing on the stepping path holds: the two binary
    stepping calls above never touched the text channel.

**Cleanup before the remedy, and why.** The drive checkpoint, still armed,
kept re-firing on the drive's own extremely tight polling loop (a
three-instruction `INC $00,X` / `INY` / `BNE` sequence, observed firing
thousands of times across the run) and would otherwise re-contaminate
`default_memspace` back to drive on essentially every subsequent resume. An
earlier design of this test issued `device c:` with the checkpoint still
live and the remedy-confirmation assertion failed (`pcAfterRemedy ===
pcBefore`), because the checkpoint won the race and re-set
`default_memspace` to drive again before the following step's own reply.
Deleting the checkpoint (`CHECKPOINT_DELETE`, its job already done) before
invoking the remedy removes that confound -- mirroring how a real user would
stop reproducing the fault before diagnosing whether the remedy took.

**The remedy, issued through `vice_device_console`'s own underlying
verb.** `device c:` issued via `withTextChannelLock()` +
`TextMonitorClient.command()` -- exactly the path `handleDeviceConsole()`
(`text-tools.ts`) itself takes. Verbatim response (`2,270,500` bytes,
truncated here to head/tail for readability -- the full string was asserted
non-empty and used for the pass/fail check):

```
"#1 (Stop on  exec eab7) \n.8:eab7  F6 00       INC $00,X      - A:22 X:22 Y:11 SP:00 .V-..I.C     117936\n(8:$eab7) #1 (Stop on  exec eab7) \n.8:eab7  F6 00       INC $00,X      - A:22 X:22 Y:11 SP:00 .V-..I.C      99746\n ... [thousands more repeated drive-checkpoint hit banners, already-queued on the wire the instant CHECKPOINT_DELETE took effect -- a real race, not a bug in this test] ... \n#1 (Stop on  exec eab7) \n.8:eab7  F6 00       INC $00,X      - A:3E X:3E Y:20 SP:00 .V-..I.C     179543\nSetting default device to `Computer'\n"
```

The trailing `Setting default device to \`Computer'` line is `device c:`'s
own confirmation text -- the load-bearing content this remedy exists to
produce. The huge preceding block is a genuinely measured artifact of this
run's own aggressive checkpoint (still catching up on already-in-flight
banner bytes when the command was issued), not a claim about `device c:`'s
typical response size (the very first `device c:` call in this same test
file, with no contaminating checkpoint active, returns a two-line response
under 60 bytes).

**Confirmed: the remedy restored main-CPU stepping.**
  - `vice_execution_step` issued again, now with `default_memspace` reset to
    main.
  - Main-CPU PC read again via `vice_registers_get`: `0xfd80` -- ADVANCED
    from `0xfd83`, proving the step now moves the main CPU again.
  - `textCommandCount` stayed at `1` across this second step call -- no
    ADDITIONAL text-channel command was issued by the binary-side step, this
    run's second, independent confirmation of D-03.

**Outcome: MEASURED, not a gap.** This run reproduced the contamination and
confirmed the remedy on this host, in this session -- there is no skip to
record for this claim. (The test itself is written to `t.skip()` with a
named reason if the drive checkpoint does not hit within a bounded window on
some other host; that path was not taken here.)

## Run 2 -- the `warp on` / `warp off` re-probe (D-04), with the channel open

Issued through the real `vice_warp_set` tool (needsSession:false --
`dispatchStock()` reaches `text-tools.ts`'s `handleWarpSet()` directly, no
binary session opened by this test at all), while the text channel is open
for the whole call.

**Command (as issued by the test):** `dispatchStock("vice_warp_set", {
enabled: true }, deps)`, then `dispatchStock("vice_warp_set", { enabled:
false }, deps)`.

**Verbatim responses:**
  - `enabled: true` ("warp on"): `"(C:$fd75) (C:$fd75) "`
  - `enabled: false` ("warp off"): `"(C:$fd70) "`

**What this means, read plainly.** Both responses are, after prompt
stripping, essentially empty of confirmation TEXT -- what remains is a
residual leading prompt (the same measured "residual leading prompt arriving
as its own chunk" phenomenon `text-protocol.ts`'s own header comment already
documents for `device c:`'s first-command case), not a human-readable
"warp: on" / "warp: off" line. **This is a genuine, newly-measured nuance
against the existing `CLAUDE.md` clause's "and it reports its own state"
wording**: on this build, `warp on`/`warp off` themselves do not echo a
state-confirming message the way this document's earlier drafts assumed they
might. What the response DOES carry is the framed round trip succeeding --
the command was accepted and the monitor returned to a ready prompt, which is
the observable proof the write reached the emulator. Neither `vice_warp_set`
tool description nor this document claims the response text itself names the
new state; `text-tools.ts`'s own doc comment for `handleWarpSet` already says
this precisely ("the answer carries the observed state rather than an
assumption that the write took" -- "observed state" here is the framed
round-trip response, not a guaranteed textual confirmation).

**The absent runtime `WarpMode` resource stays a real and separate fact,
unmeasured by this run and not claimed to be.** This run says nothing new
about `RESOURCE_GET` on `WarpMode` (that measurement is Phase 39/the
2026-08-27 probe's own, unchanged) -- it only re-confirms that the `warp on`
/ `warp off` MONITOR COMMAND round-trips successfully with the channel open,
which is the fact `CLAUDE.md`'s clause distinguishes from the absent
resource.

## Cross-reference: the `chis`-on-3.9 citation (third narrowed constraint)

The `CPUHISTORY_GET` bullet's re-citation does not need a new live run from
THIS plan -- Phase 39 already independently re-confirmed `chis` on genuine
stock 3.9 with its own fixture batch:
`docs/phase39-dual-channel-coexistence-gate-findings.md` §7,
`FIXTURE_UNSUPPORTED: none` -- `chis` succeeded on genuine stock VICE 3.9
over the text channel, returning real per-entry cycle counts, and the
binary-monitor side's `CPUHISTORY_GET` (0x86) `>= 3.10` version floor does
NOT transfer to the text channel's `chis` command (a completely different
code path). `CLAUDE.md`'s third narrowed bullet cites that document directly
alongside the 2026-08-27 probe's own citation.

## Cross-reference: 41-04's contention run

Plan 41-04's own live evidence (`41-04-SUMMARY.md`'s "Accomplishments" and
"Task Commits" sections) measured, against this same genuine stock
`/usr/bin/x64sc` (VICE 3.9), that a real text-channel hold (`device c:`
issued inside `withTextChannelLock()`) is read by a concurrently-dispatched
`vice_diagnose` as `verdict: live`, `evidence.bracketsRun: 0`,
`evidence.channelContention: {held:true, channel:"text",
operation:"device c:"}` -- and that after release, the same call answers
`channelContention.held: false` with a real bracket having run
(`bracketsRun: 1`, `advanced: true`). This plan's own live suite (which
includes 41-04's `CHAN-05` case unmodified) reproduced the identical shape in
the same session (see the full-suite run in the SUMMARY): `verdict=live`,
`bracketsRun=0`, `channelContention.held=true, channel="text",
operation="device c:"` during the hold, and `bracketsRun=1, advanced=true,
channelContention.held=false` after release.

## Named gaps

None for this run. The only gap this document is structured to name -- a
drive checkpoint that never hits within the bounded window on some other
host -- was not reproduced here: the checkpoint hit reliably (twice,
across two independent full-suite invocations in this same session), and
both the contamination and the remedy were measured, not skipped.
