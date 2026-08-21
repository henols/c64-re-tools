# Phase 13 plan 03 — Phase 3 wire-assumption probe results

**Run date:** 2026-08-22 (UTC timestamps as printed by the host clock at run time).
**Host:** same session as plans 13-01/13-02, `DISPLAY=:0`, `x64sc`/`c1541` both resolve on
`$PATH`.

## Resolved binary (D-13-02 corollary)

Per this plan's instruction, the probe target was resolved dynamically via `command -v x64sc`
into a shell variable, and only that variable was used in every command below — no literal
path was typed into any launch or probe invocation.

```
$ command -v x64sc
/usr/local/bin/x64sc
$ /usr/local/bin/x64sc --version
x64sc (VICE 3.10)
$ /usr/local/bin/x64sc --help | grep -c mcpserver
6
```

| Field | Value |
|---|---|
| Resolved path | `/usr/local/bin/x64sc` |
| Kind | **fork** (barryw/vice-mcp) — `--help` names `-mcpserver`-family flags 6 times; a genuine stock build names it 0 times |
| Version (`VICE_INFO`, quad) | `3.10.0.0` |
| `api_version` (observed in the response header) | `0x2` |

**This is the fork build, not genuine stock, exactly as recorded by sibling plans 13-01/13-02
for this same host session** — `/usr/local/bin/x64sc` is first on `$PATH` and shadows the
genuine unpatched stock binary at `/usr/bin/x64sc` (VICE 3.9). Per the D-13-01/D-13-02 pattern
those plans established, this is recorded honestly as `fork:/usr/local/bin/x64sc` 3.10, not
silently presented as a stock result. Every verdict below is a fork-3.10 observation. Where a
verdict's mechanism plausibly differs by VICE version or by fork-vs-stock patching, that is
flagged explicitly in the verdict's own section rather than left for the reader to infer
coverage that was not obtained. Fork 3.10's binary-monitor opcode implementations
(`REGISTERS_GET/SET`, `JOYPORT_SET`, `AUTOSTART`, `ADVANCE_INSTRUCTIONS`) are upstream VICE
code carried into the fork's ~17k-line patch, so wire *shape* should track upstream — but a
*behavioural* verdict observed here is not automatically a verdict about genuine stock 3.9's
same opcode, and is not claimed as one.

## Launch commands run verbatim

Two independent live sessions were launched and probed, back to back, for reproducibility.
Both used the identical launch line (only the PID differed), with `-default` preceding
`-binarymonitor` per the project's settled ordering constraint:

```
DISPLAY=:0 "$RESOLVED_X64SC" -default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502 \
  -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6510
```

Run 1: PID 3316606. Run 2 (the transcript quoted in each section below): PID 3320343. Both
binary-monitor ports were confirmed listening (see "Independent corroboration" below) before
any probe was sent, and each session was terminated (`kill <pid>`) after its probes completed
— the emulator was relaunched between the two runs rather than trusting the first run's own
cleanup, per this plan's own instruction.

Probe invocation (per run):

```
cd .claude/mcp/vice && node probe-binmon.mjs --probe-assumptions 127.0.0.1 6502
```

## Independent corroboration — `ss -ltnp`

Captured immediately after launch, before any probe connected, confirming both ports are
genuinely bound listeners and not merely "the process didn't crash":

```
State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      2          127.0.0.1:6502       0.0.0.0:*    users:(("x64sc",pid=3320343,fd=12))
LISTEN 0      2          127.0.0.1:6510       0.0.0.0:*    users:(("x64sc",pid=3320343,fd=13))
```

(Run 1's table was byte-identical except for the PID, `3316606`.)

---

## A1 — `-remotemonitoraddress` binding

**Requests sent:** one plain TCP connect to `127.0.0.1:6510` (not a binmon frame — A1 is a
port-binding question, not a wire-body question, so the wire-shape gate does not apply here).

**Raw observation (from the `--probe-assumptions` transcript, run 2):**

```
--- A1 ---
  request: plain TCP connect 127.0.0.1:6510 -> N/A (plain TCP, not a binmon frame)
  observation:
    connection to 127.0.0.1:6510 was ACCEPTED. no banner bytes arrived within 500ms --
    still a bound, accepting listener (an accepted connection with no banner is not
    downgraded from CONFIRMED)
  verdict: CONFIRMED
```

Corroborated independently by the `ss -ltnp` table above, which shows `127.0.0.1:6510` as a
genuine `LISTEN` entry owned by the launched `x64sc` PID, not an artifact of the probe's own
socket.

**Verdict: A1 — CONFIRMED.** `-remotemonitor -remotemonitoraddress ip4://<host>:<port>` binds a
real, accepting text-monitor listener on the fork 3.10 build, launched with `-default` ahead of
`-binarymonitor` exactly as the project's ordering constraint requires. This is a wire-shape/
binding question, not a behavioural one, so no separate behavioural observation is needed beyond
the accepted connection plus the kernel listener-table corroboration.

---

## A2 — `ADVANCE_INSTRUCTIONS` step-over semantics

**Requests sent (run 2, in order), each with its error code:**

```
request: PING (halt-on-demand) -> OK
request: REGISTERS_AVAILABLE memspace=0x00 -> OK
request: REGISTERS_GET memspace=0x00 (baseline PC) -> OK
request: MEM_SET $c000 (JSR $c010 + filler) -> OK
request: MEM_SET $c010 (RTS) -> OK
request: REGISTERS_SET PC=$c000 -> OK
request: ADVANCE_INSTRUCTIONS stepOver=true count=1 -> OK
request: REGISTERS_GET memspace=0x00 (post-step PC) -> OK
```

All eight replies passed the wire-shape gate (none returned `INVALID_LENGTH`/`INVALID_PARAMETER`/
`INVALID_TYPE`) — necessary, but explicitly not sufficient by itself for this behavioural claim.

**Behavioural observation the verdict actually rests on:** the machine was brought to a
confirmed halt via a bare `PING` (per `docs/phase0-binmon-findings.md` §4, "any inbound byte
halts the machine"; no checkpoint of any kind was armed), confirmed by observing a `STOPPED`
event with no subsequent `RESUMED` in the 300ms window that followed. The PC register id was
then discovered from the live `REGISTERS_AVAILABLE` reply — **id=3, name="PC"** — rather than
hardcoded. A deterministic subject was written to free RAM: `JSR $C010` + a filler `NOP` byte at
`$C000` (four bytes, `$C000`-`$C003`), and a bare `RTS` at `$C010`. PC was set to `$C000` and
`ADVANCE_INSTRUCTIONS` was sent with `stepOver=true, count=1`.

```
discovered PC register id=3 ("PC"), JSR at $c000, expected post-step PC = JSR+3 = $c003,
observed post-step PC = $c003 -- MATCH: stepOver=true skipped the subroutine as one step
```

This is the same numeric result both runs produced (run 1 and run 2 both landed on `$c003`),
so the observation is reproducible, not a one-off.

**An accepted request body was necessary but not sufficient here:** every send above returned
`OK`, which only proves the *body layout* is accepted — it says nothing about what `stepOver`
actually *does*. The verdict rests entirely on the post-step PC landing at `$c003` (JSR address
+ 3), not at `$c010` (the subroutine's own address, which would have meant `stepOver` behaved
like a plain single step).

**Verdict: A2 — CONFIRMED.** On fork 3.10, `ADVANCE_INSTRUCTIONS`'s `stepOver=true` byte causes
the emulator to execute a `JSR`'s subroutine to completion and land on the instruction
immediately following the `JSR`, matching the fork's own `stepOver` field semantic that
`stock-execution.ts`'s JSDoc names as the assumption under test.

Cleanup: the original bytes at `$C000`-`$C003` and `$C010` were restored via `MEM_SET`, PC was
restored to its pre-probe value via `REGISTERS_SET`, and `EXIT` was sent to resume the machine
— all in the probe's own `finally` block.

---

## A3 — `JOYPORT_SET` bit mapping

**Requests sent (run 2), each with its error code — five single-bit rounds, in the fixed order
up, down, left, right, fire, never two bits at once:**

```
request: JOYPORT_SET port=1 value=0x01 (up)    -> OK
request: JOYPORT_SET port=1 value=0x02 (down)  -> OK
request: JOYPORT_SET port=1 value=0x04 (left)  -> OK
request: JOYPORT_SET port=1 value=0x08 (right) -> OK
request: JOYPORT_SET port=1 value=0x10 (fire)  -> OK
```

All five wire-shape-gate-passed (`OK` on every send) — necessary, not sufficient.

**Behavioural observation the verdict actually rests on** — both CIA1 port bytes (`$DC00`,
`$DC01`) read back before and after every single-bit round, with side effects suppressed
(`sidefx=0`):

```
up    (bit 0x01): $DC00 7f -> 7f; $DC01 ff -> ff
down  (bit 0x02): $DC00 7f -> 7f; $DC01 ff -> ff
left  (bit 0x04): $DC00 7f -> 7f; $DC01 ff -> ff
right (bit 0x08): $DC00 7f -> 7f; $DC01 ff -> ff
fire  (bit 0x10): $DC00 7f -> 7f; $DC01 ff -> ff
```

Zero delta on every single one of the five rounds, at both port bytes, in both live sessions
(run 1 and run 2 both produced this identical result). No polarity claim can be derived from an
all-zero delta set — there is no set/clear transition to characterize as active-low or
active-high.

**An accepted request body was necessary but not sufficient here, and in this case it produced
no behavioural signal at all:** every `JOYPORT_SET` send returned `OK`, proving the 4-byte
`port(u16LE) value(u16LE)` body layout is accepted, but neither `$DC00` nor `$DC01` moved by a
single bit for any of the five assumed positions. This is exactly the failure mode this plan's
`must_haves` anticipated: "if no single-bit write produces any observable delta in either port
byte — which the keyboard-matrix multiplexing on port B can cause — record INCONCLUSIVE, not
CONFIRMED."

**Verdict: A3 — INCONCLUSIVE.** Neither the assumed bit positions (`up=0x01, down=0x02,
left=0x04, right=0x08, fire=0x10`) nor the assumed active-low polarity nor which physical
port (`$DC00` vs `$DC01`) the wire `port=1` value maps to can be confirmed or refuted from this
observation — the CIA1 port bytes simply did not move. Two live sessions produced the identical
null result, so this is not a one-off fluke of a single run.

**What this does not resolve, named explicitly for plan 13-04:** it is not established here
whether (a) `JOYPORT_SET` genuinely has no effect on the emulated CIA1 lines on this build, (b)
`port=1` maps to neither `$DC00` nor `$DC01` and a different port value would show a delta, or
(c) some other precondition (e.g. a running program actively driving the CIA data-direction
register) is required before a `MEM_GET` read reflects the joystick lines. This probe recorded
the raw null result honestly rather than picking one of those explanations without evidence.

---

## A5 — `AUTOSTART` `fileIndex` with the run flag clear

**Scratch image:** built via `c1541`, checked available first (`command -v c1541` resolved to
`/usr/local/bin/c1541`, so this probe never silently skipped). Two distinct programs were
written to a fresh `.d64` in a process-owned temp directory: `PROG1` (body bytes `11 11 11 11`,
load address `$0801`) and `PROG2` (body bytes `22 22 22 22`, same load address), so index 0 and
index 1 are byte-distinguishable.

**Requests sent (run 2), each with its error code:**

```
request: AUTOSTART runAfter=false fileIndex=0 filename=/tmp/probe-a5-AveuO7/probe.d64 -> OK
request: AUTOSTART runAfter=false fileIndex=1 filename=/tmp/probe-a5-AveuO7/probe.d64 -> OK
```

Both passed the wire-shape gate — necessary, not sufficient.

**Behavioural observation the verdict actually rests on**, per index, with a sentinel
(`DE AD BE EF`) written to the BASIC program area (`$0801`-`$0804`) and the zero-page BASIC
start-of-text pointer (`$2B`-`$2C`) read back immediately before and ~700ms after each call:

```
fileIndex=0: sentinel CHANGED; zero-page pointer $2b before=0108 after=0108 (unchanged);
             PC before=$e5cf after=$e5d1 (reset-looking heuristic: false)
fileIndex=1: sentinel CHANGED; zero-page pointer $2b before=0108 after=0108 (unchanged);
             PC before=$e5d1 after=$e5d4 (reset-looking heuristic: false)
```

The sentinel did **not** survive at either index — the `DE AD BE EF` pattern written at `$0801`
was gone after both `AUTOSTART` calls. (The zero-page start-of-BASIC pointer itself stayed at
`$0801`, i.e. unchanged, but the *bytes at that address* were overwritten — a nuance recorded
here rather than smoothed over: the pointer being stable does not mean the program area was
left alone.)

**Independent corroboration from the emulator's own log** (condensed log level; `x64sc`'s
stdout during run 2, `AUTOSTART`/`RESET` lines only):

```
Main CPU: RESET.
Unit 8: RESET.
AUTOSTART: Autodetecting image type of `/tmp/probe-a5-AveuO7/probe.d64'.
AUTOSTART: Attached file `/tmp/probe-a5-AveuO7/probe.d64' as a disk image.
AUTOSTART: mounted image is type: 1541, not changing drive.
AUTOSTART: Resetting drive 8
AUTOSTART: Resetting the machine to autostart '*'
AUTOSTART: Turning Warp mode on.
AUTOSTART: `/tmp/probe-a5-AveuO7/probe.d64' recognized as disk image.
Main CPU: RESET.
Unit 8: RESET.
AUTOSTART: Loading program '*'
```

This is the emulator's own account of what `AUTOSTART` with `runAfter=false` actually did: it
performed a **full machine reset** (`Main CPU: RESET.`) and then **loaded a program** ("`AUTOSTART:
Loading program '*'`" — note the wildcard `'*'`, not a specific `fileIndex`-selected name). This
log line appeared once per session, associated with the *first* `AUTOSTART` call in each run
(`fileIndex=0`); the second call (`fileIndex=1`, same already-attached image) produced an `OK`
wire reply but no second logged reset/load sequence in either run — recorded as an open,
unresolved detail (the wire accepted the second call; whether it was a genuine no-op because the
image was already attached, or whether its effects were simply not logged at this log level, was
not established).

A follow-up read of `$0801`-`$0805` after the session (ad-hoc, outside the committed script,
against the still-running run-1 instance) showed `07 08 11 11 ff` — a BASIC program
next-line-link pointer (`$0807`) followed by `PROG1`'s `11 11` body bytes, consistent with the
KERNAL's BASIC loader having relinked the program chain after loading `PROG1`'s content. This
corroborates, at the byte level, that a real program load occurred despite `runAfter=false`.

**An accepted AUTOSTART body was necessary but not sufficient here:** both calls returned `OK`,
proving the `runAfter(1) fileIndex(u16LE) filenameLen(1) filename(ASCII)` layout is accepted. The
verdict rests entirely on the behavioural evidence above — the sentinel's destruction, the
emulator's own reset/load log lines, and the byte-level corroboration — none of which is implied
by an accepted wire body.

**Verdict: A5 — CONTRADICTED.** `AUTOSTART` with `runAfter=false` on fork 3.10 does **not** leave
the machine untouched. It performs a full machine reset and loads a program from the attached
image regardless of the `fileIndex` value sent — the run flag being clear did not suppress the
load, only (as far as this probe's evidence shows) whatever "run" step follows loading. This
directly refutes the approximation `stock-machine.ts`'s `handleDiskAttach` (`vice_disk_attach`)
and `stock-machine.ts`'s `vice_autostart` handler both build on: "attach a disk image without
loading or running anything."

### Advertised tool contract finding (D-13-04's escape hatch)

**`vice_disk_attach`'s advertised approximation is wrong, not merely unconfirmed.**
`stock-machine.ts`'s `handleDiskAttach` sends `AUTOSTART` with `runAfter: false, fileIndex: 0`
and reports back `approximation: "AUTOSTART with the run flag clear (D-14)"`
(`docs/stock-vice-parity.md`'s D-14 entry: "a documented approximation, not an exact port").
The documented intent of this approximation is an *attach*, distinct from `vice_autostart`
(which is documented as loading/running). This probe's live evidence shows the run-flag-clear
call still performs a full machine reset and loads a program from the disk — the same side
effect `vice_autostart` produces, minus (as far as observed) the final RUN step. An agent
calling `vice_disk_attach` expecting only "the image is now visible to the drive" is not told
that the call also resets the machine and loads whatever program the image's directory wildcard
resolves to. **This finding is recorded here and handed to plan 13-05 as a todo, per this
plan's own scope fence — it is not redesigned in this task.**

---

## Folded todo's numbered acceptance steps, answered

(`.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`, "Acceptance check
for closing this todo")

1. **Extend `probe-binmon.mjs` with one check per wire assumption (A1, A2, A3, A5), asserting
   the reply's `error_code` is not `InvalidLength`/`InvalidParameter`/`InvalidType`.** Done —
   `--probe-assumptions` mode, all four probes apply the wire-shape gate before their
   behavioural half. Every one of the requests sent above (A1's plain-TCP dial excepted, which
   carries no binmon `error_code` at all) returned `OK`, i.e. none was rejected on layout
   grounds in this run.
2. **A2: step over a known `JSR` and compare reported PC to JSR+3.** Done — see A2 above.
   Result: **matches** (`$c003` observed, `$c003` expected). Confirmed on fork 3.10.
3. **A3: drive each joystick direction and fire individually, read the CIA port back.** Done —
   see A3 above. Result: **no observable delta at any single bit**, recorded INCONCLUSIVE
   rather than assumed either way.
4. **A5: attach a `.d64` via `AUTOSTART` with `runAfter=0`, confirm no program loaded.** Done —
   see A5 above. Result: **contradicted** — a program was loaded (and the machine reset) despite
   `runAfter=0`, at both probed indices.
5. **A1: launch stock VICE with both `-binarymonitor` and `-remotemonitor`, `ss -ltnp` to
   confirm both are listening.** Done — see "Independent corroboration" above. Both ports
   confirmed as genuine `LISTEN` entries owned by the launched process, in both runs.

## Step 6 (A4) — deliberately not run

**A4 (the `stop:false` rate limiter's auto-disable deferral timing) was not run, on purpose.**
It requires arming a **non-stopping checkpoint on a hot, frequently-executed address** to
observe the auto-disable rate limiter under a real flood. Per `docs/phase0-binmon-findings.md`
§4 and CLAUDE.md's own Protocol constraint, a non-stopping checkpoint's `CHECKPOINT_INFO` hit
frame is emitted **synchronously, over the blocking socket, from inside the emulator's CPU
loop** (`mon_breakpoint.c:557-562`) — on a hot address this can stall the emulator thread. This
plan's own scope fence (D-13-05) excludes A4 for exactly this reason, and no probe in this file
or this run armed any checkpoint of any kind (`grep -c CHECKPOINT_SET` over the
`--probe-assumptions` region of `probe-binmon.mjs` finds only the comment stating this
exclusion — no `CHECKPOINT_SET` is ever sent by any of the four probes).

**The folded todo (`2026-08-14-probe-phase3-assumed-wire-details.md`) therefore stays open, with
A4 as its only remaining unresolved item.** A1, A2, A3, A5 are all now answered (three of four
with a definitive verdict, one — A3 — honestly inconclusive) by this plan; closing the todo
itself, or filing A4's continuation as a fresh todo, is plan 13-04/13-05's decision, not this
task's.

---

## Consequences for plan 13-04

| Assumption | Verdict | Consequence |
|---|---|---|
| **A1** — `-remotemonitoraddress` spelling/binding | CONFIRMED | The `[ASSUMED]` label may come off at `broker-launch.mts`'s `buildViceArgs()` stock-branch JSDoc and the corresponding `03-RESEARCH.md` Assumptions Log row. The flag spelling and binding are now live-confirmed on fork 3.10; note in the label removal that stock 3.9 was not independently probed in this run (see "Resolved binary" caveat above) — the spelling itself is not version-sensitive (a symmetrical CLI flag pair), so this is a low-risk carry-forward, but say so rather than imply stock-3.9 coverage that wasn't obtained. |
| **A2** — `ADVANCE_INSTRUCTIONS` step-over semantics | CONFIRMED | The `[ASSUMED]` label may come off `stock-protocol.ts`'s `advanceInstructionsBody()` JSDoc and `stock-execution.ts`'s step-over note, plus the `03-RESEARCH.md` row. Confirmed against a real `JSR` on fork 3.10, reproduced identically across two independent live sessions. |
| **A3** — `JOYPORT_SET` bit mapping | INCONCLUSIVE | The `[ASSUMED]` label **must stay on** at `stock-input.ts`'s `JOYPORT_BITS` constant and the `03-RESEARCH.md` row. Nothing here confirms or refutes the assumed bit positions, polarity, or port-number mapping — the CIA1 port bytes showed zero delta across all five single-bit rounds in two separate live sessions. This is not evidence the mapping is wrong; it is an absence of the signal needed to judge it either way. A follow-up probe attempt (e.g. varying the wire `port` value, or checking whether a running program is a precondition for the CIA read to reflect joystick state) is a candidate for a fresh todo, not a correction to make now. |
| **A5** — `AUTOSTART` `fileIndex` with the run flag clear | CONTRADICTED | The `[ASSUMED]` label **must stay on**, and this is a correction-plus-regression-test case, not a label removal — the approximation `stock-machine.ts`'s `handleDiskAttach` documents ("attach a disk image without loading or running anything") is actively wrong: the run-flag-clear call performs a full machine reset and loads a program regardless of `fileIndex`. Additionally, see the "Advertised tool contract finding" above (D-13-04's escape hatch) — this is handed to plan 13-05 as a todo, not redesigned here. |

Every assumption above carries an explicit, non-omitted, non-hedged entry, per this plan's own
requirement that a missing or hedged entry means the label stays on by default.
