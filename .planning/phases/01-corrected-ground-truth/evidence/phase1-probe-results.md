# Phase 1 — binary-monitor probe results

**Run date:** 2026-08-12 (UTC timestamps below)
**Host:** `Linux ho-laptop 6.12.100+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.12.100-1 (2026-07-30) x86_64 GNU/Linux`, `DISPLAY=:0`, no container (`/.dockerenv` absent), Node v22.22.0.
**Builds tested:**

| Build | Path | Version (from `VICE_INFO`) | Provenance |
|---|---|---|---|
| Stock | `/usr/bin/x64sc` | 3.9.0.0 | Debian-packaged, unmodified upstream VICE |
| Fork | `/usr/local/bin/x64sc` | 3.10.0.0 | barryw/vice-mcp fork (~17k lines of C patched onto an upstream 3.10-era tree); **not** a stock 3.10 build — see "Fork-as-3.10 accepted unknown" below |

Both builds were launched by hand (no broker) with:
```
DISPLAY=:0 <binary> -binarymonitor -binarymonitoraddress ip4://127.0.0.1:<port> -drive8truedrive -drive8type 1541
```
on ports 6502 (stock) and 6503 (fork), one at a time, each terminated before the next was
launched. `node .claude/mcp/vice/probe-binmon.mjs --selftest` was run first and passed
(`SELFTEST PASS`), confirming every wire-body builder and response parser offline before
either live run.

---

## Summary table (success criterion 3)

| Item | Stock 3.9 (`/usr/bin/x64sc`) | Fork 3.10 (`/usr/local/bin/x64sc`, **not stock** — see caveat) |
|---|---|---|
| api_version (observed, response header) | `0x2` | `0x2` |
| VICE version quad (from `VICE_INFO`) | `3.9.0.0` | `3.10.0.0` |
| `CPUHISTORY_GET` outcome | `INVALID_TYPE` (`0x83`) — opcode absent, matches the <3.10 expectation | `OK`, 1 entry returned — matches the >=3.10 expectation |
| `DISPLAY_GET` geometry (dw, dh, xo, yo, iw, ih, bpp) | dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8 | dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8 (identical to stock — same default screen geometry) |
| `PALETTE_GET` entry count | 16 | 16 |
| Observed unsolicited event sequence (full session) | `REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> CHECKPOINT_INFO -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED` | `REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> CHECKPOINT_INFO ×18` (session aborted after the flood — see "Anomaly observed on the fork build" below; cell is not empty, it reports exactly what happened) |

Every cell above is transcribed directly from the raw captures in the "Raw probe output"
section; none is filled from expectation. Note: on both builds `REGISTER_INFO` recurs on
every `STOPPED` transition, not only once at socket-connect time — consistent with
`CON-async-event-demux`'s "emitted on every monitor open" being the *monitor entering its
active/halted state* (i.e. every halt), not only the initial TCP connection.

---

## The five UNVERIFIED items (success criterion 4)

### 1. 9-byte `CHECKPOINT_SET` with the optional memspace byte

**RESOLVED.** Both an 8-byte `CHECKPOINT_SET` body and a 9-byte body (with the optional
`memspace` byte appended) returned `OK` on **both** builds — check 9's line: `8-byte: OK
9-byte(+memspace): OK` (stock and fork, identical). Neither build rejects the longer body on
length; the optional ninth byte is accepted rather than causing an `INVALID_LENGTH` error on
either the pre-3.10 or the 3.10-vintage tree tested.

### 2. `Drive8TrueEmulation` under that exact per-unit name on VICE 3.9

**RESOLVED (on stock 3.9).** `RESOURCE_GET Drive8TrueEmulation` returned `int=1` and
`RESOURCE_GET Drive8Type` returned `int=1541` against the stock 3.9 build (launched with
`-drive8truedrive -drive8type 1541`), confirming the resource exists under exactly that
per-unit name on 3.9 and is readable as a nonzero int, not `OBJECT_MISSING`. The fallback-name
probe (`DriveTrueEmulation`) was not exercised because the primary name was not missing. A
fork-3.10 corroboration data point was not obtained: check 11 on the fork run timed out as a
consequence of the check-10 anomaly (see below) before it could query this resource. This gap
does not weaken the 3.9 disposition — item 2 as phrased asks specifically about VICE 3.9,
which is answered.

### 3. `MEM_SET` into drive ROM — safe no-op or worse

**RESOLVED (on stock 3.9).** With the check-11 precondition confirmed on (`Drive8TrueEmulation`
int=1, `Drive8Type` int=1541 nonzero), check 13 wrote `0xff` to drive memspace `$C000` and
read it back: the byte was **unchanged** (`$97` before and after) — `13. MEM_SET drive ROM ->
OK but byte UNCHANGED ($97) -- silent no-op store stub`. This is the "safe no-op" branch, not
a crash and not a silent write-through. The emulator instance survived the write cleanly. A
fork-3.10 data point was not obtained: on the fork run, check 13 was `SKIPPED` because its
precondition (check 11's `Drive8TrueEmulation`/`Drive8Type` confirmation) never completed —
check 11 itself timed out as a downstream consequence of the check-10 anomaly, and the probe's
own precondition guard correctly refused to attempt the destructive write without confirmed
evidence that TDE was actually on (exactly the gating logic `01-03` built to avoid a
meaningless "zero read-back looks like a no-op" false result).

### 4. `RL`/`CY` condition acceptance + firing, and the `$D012` phase relationship

**Acceptance-and-firing half: RESOLVED.** On stock 3.9, `CONDITION_SET` with
`(RL == $64) && (CY == $14)` was accepted (`OK`), the `LIN`/`CYC` negative control on the same
checkpoint was rejected (`CMD_FAILURE`, `0x8f`) exactly as the corrected documentation
predicts, and the relaxed single-token condition `(RL == $64)` fired and halted cleanly:
`hitCount=1 FIRED`, with the events sequence showing one `CHECKPOINT_INFO` followed by
`REGISTER_INFO -> STOPPED` and no further hits — a single, clean stop. On the fork 3.10 build,
`CONDITION_SET` was likewise accepted (`OK`) and `LIN`/`CYC` likewise rejected
(`CMD_FAILURE`) — no contradiction of the corrected `RL`/`CY` documentation on either build.
The condition did fire on the fork too (18 `CHECKPOINT_INFO` events observed before the run
was aborted), but it did **not** halt cleanly the way it did on stock — see "Anomaly observed
on the fork build" below for the full, unvarnished account; this anomaly does not change the
RESOLVED disposition of "are `RL`/`CY` conditions accepted and do they fire" (yes, on both
builds), it is a separate, additionally-observed behavior about checkpoint stop semantics
under repeated condition matches.

**`$D012` phase-offset half: ACCEPTED UNKNOWN.** Not attempted — it needs a running program
with a known raster interrupt to compare `RL`/`CY` against what that program reads at `$D012`,
which is materially more setup than a bare-monitor probe provides. What breaks if the
assumption (that the phase relationship is straightforward) is wrong: GAIN-06 (raster-precise
conditions) tools that promise "break at the exact line a program sees at `$D012`" would be
systematically off by a fixed cycle count — silently wrong demo/raster-effect RE results, not
a crash.

### 5. `PALETTE_GET` entry count and `DISPLAY_GET` pixel-vs-live-register match

**Entry count: RESOLVED.** `PALETTE_GET` returned exactly 16 entries on both builds
(`7. PALETTE_GET -> OK, 16 entries`, identical on stock and fork).

**Pixel-vs-register match: RESOLVED, with an important caveat about sample coordinates, not
about the mapping itself.** The border-pixel probe (`corner(4,4)`) returned palette index `0`
(RGB `0,0,0`, black) against a live `$D020` value of `14` (masked) on **both** builds — a
`MISMATCH`. The centre-pixel probe (explicitly informational, since it may land on a glyph)
returned index `6` against a live `$D021` value of `6` on both builds — a **match**, and
identical across builds. Given `DISPLAY_GET`'s reported inner offset is `xo=136, yo=51`, pixel
`(4,4)` in the debug (uncropped) frame lands well inside the pre-visible blanking padding, not
in the rendered border strip the probe intended to sample — the mismatch is best read as a
probe coordinate choice that undershoots the visible area's offset, not as a fault in
`PALETTE_GET`'s index-to-RGB table or `DISPLAY_GET`'s buffer layout, both of which are
corroborated by the correct, identical-across-builds centre-pixel match. A future probe
revision should sample at `(xo + few px, yo + few px)` rather than `(4, 4)` to land inside the
actual border, but that is a probe refinement, not part of this plan's scope.

---

## Fork-as-3.10 accepted unknown

The only VICE >= 3.10 build available in this environment is the barryw fork
(`/usr/local/bin/x64sc`, version 3.10.0.0), not a stock 3.10 binary. Probing the fork's binary
monitor for `CPUHISTORY_GET` (which succeeded, `OK`, 1 entry) is **acceptable corroborating
evidence** that the opcode exists and returns sane data on a 3.10-vintage tree, but this is
**not** upgraded to VERIFIED for the claim "stock VICE 3.10 behaves identically." The fork's
patch set is not known to touch `monitor_binary.c`'s `CPUHISTORY_GET` path, but this has not
been diffed against upstream to confirm. **What breaks if the assumption is wrong:** downstream
code gated on ">= 3.10 works" would have been validated against fork-only behaviour and could
fail against a genuine stock 3.10 build such as a Homebrew or official release. No work is
planned to obtain a stock 3.10 build for this milestone; that is out of scope by decision.

Separately — and this cuts the other way from the usual "fork looks the same as stock" framing
— the fork run in this session also surfaced an anomaly (below) that stock 3.9 did not, during
check 10's fire test. Whether that anomaly is fork-specific, an artifact of running a
maximally-broad ($0000-$FFFF) exec checkpoint for long enough to hit repeatedly, or something
that would also occur on a genuine stock 3.10 given the same conditions, is itself unverified —
recorded here as part of the same accepted-unknown posture, not resolved either way.

## Anomaly observed on the fork build (check 10's fire test)

On the fork 3.10 run only, after `CONDITION_SET (RL == $64)` was applied to a `stop=1`,
non-temporary, full-address-range (`$0000`-`$FFFF`) exec checkpoint and `EXIT` was sent to
resume the machine, the checkpoint did not stop cleanly after one hit the way it did on stock
3.9. Instead, 18 `CHECKPOINT_INFO` events arrived in rapid succession with no interleaved
`STOPPED`/`RESUMED` pair between them, and every subsequent command sent on that connection
(`CHECKPOINT_GET` to read back `hitCount`, `RESOURCE_GET Drive8TrueEmulation`,
`ADVANCE_INSTRUCTIONS`) timed out at the probe's fixed 4-second limit. The probe process was
terminated by hand after the second of these timeouts made it clear the connection would not
recover, and the fork's `x64sc` process (which remained alive, in state `Sl`, and did not exit
on its own) was terminated by hand as well, by its known PID — no `pkill -f` or broad process
match was used. This left checks 11 ("Drive8TrueEmulation" resource probe), 12
(`ADVANCE_INSTRUCTIONS` event-pair observation) and 13 (`MEM_SET` drive ROM, correctly
`SKIPPED` on its unmet precondition) without fork-build data points; their dispositions above
rest on the stock 3.9 data only.

**Probe defect that prolonged, but did not cause, the failure.** A later code review
found that check 10 deleted its checkpoint *after* the `CHECKPOINT_GET` read-back,
inside the same `try` — so when that read timed out, the delete never ran and the
enabled, full-range, `stop=1` checkpoint was left live on a machine that `EXIT` had
just resumed. That leak does not explain the initial 18-event burst (it happened
before the delete would have run either way), but it does plausibly explain why the
connection never recovered afterwards and why checks 11-13 each timed out in turn:
the leaked breakpoint would re-fire on essentially every instruction. The probe now
deletes the checkpoint in a `finally`. Treat the *non-recovery* as partly
probe-induced; the *trigger* remains the open question described above.

This does not contradict any corrected claim in `docs/phase0-binmon-findings.md` or
`docs/stock-vice-parity.md` — neither document claims a `stop=1` checkpoint is guaranteed to
halt cleanly on its first condition match under a maximally broad address range with a
condition that can re-match many times before the halt takes effect. It is new information,
not previously probed, and is recorded here rather than silently absorbed or re-run away.
Per the plan's own instruction for a comparable destructive/unexpected outcome (check 13):
this is a result, not a failure of the run, and it was not re-run to obtain a cleaner log.

---

## Raw probe output

> **Correction — `PC=` on `REGISTER_INFO` and `CHECKPOINT_INFO` lines is a probe
> defect, not emulator telemetry.** The transcripts below are preserved exactly as
> the probe printed them, so the two mislabeled values still appear verbatim
> (`REGISTER_INFO PC=$000a` ×11, `CHECKPOINT_INFO PC=$0001` ×19). At the time of
> this run, `probe-binmon.mjs` decoded the first two body bytes of *every*
> unsolicited event as a program counter. That is correct only for `STOPPED` and
> `RESUMED`, whose bodies are a 2-byte PC — so every `STOPPED`/`RESUMED PC=$e5xx`
> value below is genuine. It is wrong for the other two event types, whose bodies
> are different structures entirely:
>
> | Printed as | Actually is |
> |---|---|
> | `REGISTER_INFO PC=$000a` | the **register-item count**, 10 registers — `REGISTER_INFO`'s body is a count-prefixed register list and carries no PC |
> | `CHECKPOINT_INFO PC=$0001` | the **checkpoint number**, 1 — `CHECKPOINT_INFO`'s body begins with a `uint32` `checkpointNum` (its `hit_count` is at offset 13) |
>
> Both are constant across every occurrence precisely because they are static
> fields, not a moving PC — which is the tell. No program counter was ever
> reported for either event type on either build, and no conclusion in the
> sections above rests on these values. The probe was fixed after this run (the
> handler now decodes a PC only for `STOPPED`/`RESUMED` and prints
> `checkpoint=#N hit_count=N` / `register_count=N` instead), so a future run will
> not reproduce these lines. The transcripts are deliberately **not** rewritten:
> altering a verbatim capture to show output the tool never produced would be a
> worse defect than the mislabel it hides.

### Stock VICE 3.9 (`/usr/bin/x64sc`, port 6502)

```
Connecting to VICE binary monitor at 127.0.0.1:6502 ...
Connected.

   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d4
1. PING            -> OK
2. VICE_INFO       -> OK, version 3.9.0.0
3. REGS_AVAILABLE  -> OK (body 61B)
4. CPUHISTORY_GET  -> INVALID_TYPE  => CPU history NOT available in this build (no cycle stopwatch)
5. DISPLAY_GET     -> OK, debug 504x312, inner 320x200, 8bpp indexed  => screenshots feasible
   [async event] RESUMED PC=$e5d4
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5cd
6. ASYNC EVENTS    -> observed 5 event(s): REGISTER_INFO, STOPPED, RESUMED, REGISTER_INFO, STOPPED
7. PALETTE_GET     -> OK, 16 entries, first RGB=(0,0,0)
   geometry: dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8
8. PIXEL vs $D020  -> corner(4,4) index=0 expected(masked $D020)=14 MISMATCH rgb=(0,0,0)
   centre(252,156) index=6 vs expected(masked $D021)=6 (informational only; may land on a glyph)
   [async event] RESUMED PC=$e5cd
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d4
   [async event] RESUMED PC=$e5d4
9. CHECKPOINT_SET  -> 8-byte: OK  9-byte(+memspace): OK
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5cf
10a. RL/CY vs LIN/CYC -> RL/CY: OK  LIN/CYC: CMD_FAILURE
   [async event] RESUMED PC=$e5cf
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d4
10b. FIRE TEST      -> hitCount=1 FIRED; events so far: REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> CHECKPOINT_INFO -> REGISTER_INFO -> STOPPED
11. Drive8TrueEmulation -> int=1
    Drive8Type          -> int=1541
   [async event] RESUMED PC=$e5d4
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5cd
12. ADVANCE_INSTRUCTIONS event pair -> [RESUMED, REGISTER_INFO, STOPPED] (other)
13. MEM_SET drive ROM -> OK but byte UNCHANGED ($97) -- silent no-op store stub
   [async event] RESUMED PC=$e5cd

=== Phase-1 verdict ===
connect/ping ............ PASS
api_version (observed) .. 0x2
vice version ............ 3.9.0.0
cpuhistory_get ........... unavailable (INVALID_TYPE 0x83 on <3.10, CMD_FAILURE 0x8f if disabled on >=3.10)
display_get geometry ..... AVAILABLE
palette_get entries ...... 16
checkpoint_set 8/9-byte .. 8-byte: OK  9-byte: OK
RL/CY condition .......... accepted=true  LIN/CYC rejected=true  fired=true
Drive8TrueEmulation ...... on=true  Drive8Type nonzero=true
ADVANCE_INSTRUCTIONS ..... event slice: [RESUMED, REGISTER_INFO, STOPPED]
drive ROM MEM_SET ........ silent-no-op
unsolicited event sequence (full session) -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> CHECKPOINT_INFO -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED

VICE >= 3.10 is the gate for CPUHISTORY_GET, not a compile flag -- see docs/phase1-probe-results.md for the recorded run.
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d4
```

### Fork VICE 3.10 (`/usr/local/bin/x64sc`, port 6503)

```
Connecting to VICE binary monitor at 127.0.0.1:6503 ...
Connected.

   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d1
1. PING            -> OK
2. VICE_INFO       -> OK, version 3.10.0.0
3. REGS_AVAILABLE  -> OK (body 61B)
4. CPUHISTORY_GET  -> OK, entries=1
   newest cycle: t0=20186709  t1=20186709  elapsed=0
   => history present but cycle did not advance (was the machine running?).
5. DISPLAY_GET     -> OK, debug 504x312, inner 320x200, 8bpp indexed  => screenshots feasible
   [async event] RESUMED PC=$e5d1
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d4
6. ASYNC EVENTS    -> observed 5 event(s): REGISTER_INFO, STOPPED, RESUMED, REGISTER_INFO, STOPPED
7. PALETTE_GET     -> OK, 16 entries, first RGB=(0,0,0)
   geometry: dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8
8. PIXEL vs $D020  -> corner(4,4) index=0 expected(masked $D020)=14 MISMATCH rgb=(0,0,0)
   centre(252,156) index=6 vs expected(masked $D021)=6 (informational only; may land on a glyph)
   [async event] RESUMED PC=$e5d4
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5cf
   [async event] RESUMED PC=$e5cf
9. CHECKPOINT_SET  -> 8-byte: OK  9-byte(+memspace): OK
   [async event] REGISTER_INFO PC=$000a
   [async event] STOPPED PC=$e5d1
10a. RL/CY vs LIN/CYC -> RL/CY: OK  LIN/CYC: CMD_FAILURE
   [async event] RESUMED PC=$e5d1
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
   [async event] CHECKPOINT_INFO PC=$0001
10. RL/CY CONDITION -> FAILED (timeout waiting for response to cmd 0x11)
11. Drive8TrueEmulation -> FAILED (timeout waiting for response to cmd 0x51)
12. ADVANCE_INSTRUCTIONS event pair -> FAILED (timeout waiting for response to cmd 0x71)
13. MEM_SET drive ROM -> SKIPPED (Drive8TrueEmulation/Drive8Type precondition from check 11 not confirmed on; a zero read-back here would not be evidence of a safe no-op)

=== Phase-1 verdict ===
connect/ping ............ PASS
api_version (observed) .. 0x2
vice version ............ 3.10.0.0
cpuhistory_get ........... OK
display_get geometry ..... AVAILABLE
palette_get entries ...... 16
checkpoint_set 8/9-byte .. 8-byte: OK  9-byte: OK
RL/CY condition .......... accepted=true  LIN/CYC rejected=true  fired=?
Drive8TrueEmulation ...... on=?  Drive8Type nonzero=?
ADVANCE_INSTRUCTIONS ..... event slice: [?]
drive ROM MEM_SET ........ skipped-precondition-unmet
unsolicited event sequence (full session) -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> REGISTER_INFO -> STOPPED -> RESUMED -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO -> CHECKPOINT_INFO

VICE >= 3.10 is the gate for CPUHISTORY_GET, not a compile flag -- see docs/phase1-probe-results.md for the recorded run.
```

*(The fork-run node process and the fork `x64sc` process were terminated by hand, by known
PID, after this output was captured — the script's own cleanup `EXIT`/`socket.end()` calls
never ran because `main()` was still awaiting the timed-out `ADVANCE_INSTRUCTIONS` response
when the process was killed. `pgrep -x x64sc` confirmed zero processes and `ss -ltn` confirmed
neither port 6502 nor 6503 was listening after cleanup.)*

---

*Recorded as part of Phase 1 Plan 04. Supersedes the "outstanding" framing in
`docs/phase0-binmon-findings.md`'s empirical-step section and resolves
`.planning/intel/constraints.md`'s `CON-probe-outstanding`.*
