# Capture record — `danish` (CANONICAL), checkpoint `$1BC2`, runs 1 and 2

Phase 23 / plan 23-03 / Task 3. Shape follows
`src/skills/c64-ram-capture/templates/capture-record.template.md`; the template's
three-run minimum is addressed under `## Deviations from the template` below.

Evidence convention 1 (`evidence/README.md`): every `$ ...` line below was appended
to this file **before** the call it names was made, and the real result pasted
immediately underneath. `mcp <tool> <args>` denotes a `mcp__vice__<tool>` MCP call —
the only permitted route to the emulator. `x64sc` was never invoked by hand.

- Release: `danish` — `canonical: true` in `RELEASES.json`
- Corpus file sha256: `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`
- Booted from: `<workspace>/.planning/phases/23-.../evidence/corpus/danish.d64`
  (gitignored working copy, byte-identical to the operator-supplied original —
  proven in `handoff-identification.txt` § 1)
- `PROBE_DIR` = `/home/henrik/.cache/c64-re-tools/phase23`
- Capture artifacts: `$PROBE_DIR/capture-data/danish/dumps/` — **outside the checkout**
- Backend: fork, `/usr/local/bin/x64sc`, VICE 3.10 (Task 3 `<precondition>`)

## The capture instant, restated

`CAPTURE_HANDOFF_PC` = **`$1BC2`**, and the instant is **the first execution of
`$1BC2` after a cold autostart**. How that address was identified — by disassembling
the running machine, never by dxa or Ghidra (D-06) — is
`handoff-identification.txt` § 3-§ 6. Two earlier runs were voided; both voids are
recorded in that file (§ 2 epoch drift, § 2b broker death).

The address is **re-verified on this run's own fresh machine** rather than carried
over on trust, because § 2b voided the machine it was found on.

## Transcript

### Calibration run C — VOIDED as a capture, kept as an instrument finding

Order matters and is deliberate: the checkpoint is armed **before** the disk is
autostarted, so the hit that stops the machine is provably the first execution of
`$1BC2` in this machine's life. Arming after the title screen appeared would stop on
some later frame, and "first execution after a cold autostart" would be a claim rather
than a fact.

$ mcp vice_checkpoint_list                       # zero armed before anything
{"checkpoints":[],"count":0}

$ mcp vice_machine_reset {"mode":"hard","run_after":true}    # cold machine
{"status":"ok","mode":"hard","run_after":true,"message":"Machine power cycled"}

(`vice_machine_reset` is not one of the three prohibited power-cycling *resources* —
MachineVideoStandard, VICIIModel and MachinePowerFrequency were never set at any
point. A deliberate hard reset here is what "cold autostart" means, and it happens
BEFORE the capture rather than under it.)

$ mcp vice_checkpoint_add {"start":"$1BC2","exec":true,"stop":true}
{"status":"ok","checkpoint_num":1,"start":7106,"end":7106,"stop":true,"load":false,"store":false,"exec":true}

vice hazard: a stopping exec checkpoint was just armed at $1BC2, and the call was NOT blocked -- it will not be, because this is core reverse-engineering technique.
[... the tool's standard stopping-checkpoint hazard notice, quoted in full in the run-1
transcript only; it is emitted identically on every arm below ...]

`start: 7106` = `$1BC2`, confirming the address the tool actually armed.

Reading of the hazard notice, per `vice-wedge-triage`: the notice's concern is a
stopping checkpoint on the **live IRQ handler**, whose tell is a hit count of zero on
a screen the machine must be drawing. `$1BC2` is not an IRQ handler — the game's
frame loop *waits* on the IRQ draining `$48` at `$1C32`, so `$1BC2` runs on the main
thread. The check that matters is applied anyway below: the hit count is polled and
must reach a non-zero value, and it does.

$ mcp vice_autostart {"path":"/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64","run":true}
{"status":"ok","path":".../evidence/corpus/danish.d64","run":true,"index":0,"message":"Autostart initiated - program will load and run"}

$ mcp vice_checkpoint_list                       # still armed across the autostart reset
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":0,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

$ mcp vice_ping                                   # the machine is running, not paused by the list call
{"status":"ok","version":"3.10","machine":"C64SC","execution":"running"}

`hit_count: 0` here is the load-bearing fact: `$1BC2` has NOT yet executed at the
moment the disk starts loading, so whichever hit arrives is the first one.
`vice_checkpoint_list` is also shown not to pause the machine on this backend, which
is what makes it safe to use as the poll — the documented `vice-sync.ts` invariant is
**poll on the hit count, never on paused state**, and that is what is done below.

Waiting for the loader in real time (WarpMode is unavailable — see
`handoff-identification.txt` § 7).

$ mcp vice_checkpoint_list                        # t+95 s
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":0,...,"enabled":true,...}],"count":1}

$ mcp vice_display_screenshot {"path":"<workspace>/dist/shot.png"}   # then moved to $PROBE_DIR
{"status":"ok","format":"PNG","path":".../dist/shot.png"}

Screen at t+95 s: "DANISH CRACKERS / Presents / BRUCE LEE / hit any key /
CRACKERS in 1984." — the crack intro, at its keypress gate. `hit_count` is still 0,
so the game's frame loop has not started. Saved to
`$PROBE_DIR/capture-work/danish-run1-intro.png`.

(The `vice` surface refuses any absolute path outside the mounted workspace, so a
screenshot cannot be written straight to `PROBE_DIR`. It is written to the repository's
root-gitignored `dist/` — `git check-ignore -v dist/shot.png` → `.gitignore:38:dist/` —
and moved out immediately. Nothing enters the repository; `git status --porcelain` is
checked at the end of the plan and shows no image.)

$ mcp vice_keyboard_matrix {"key":"SPACE","hold_frames":12}
{"status":"ok","row":7,"col":4,"pressed":true,"hold_frames":12,"auto_release_scheduled":true}

(`vice_keyboard_matrix` is fork-only and is the route `c64-ram-capture` § *Find an
entry point* names for a "hit any key" gate. This intro polls `$DC01` directly, so
KERNAL buffer injection would be invisible to it.)

Now polling the checkpoint's **hit count** — never the paused state — until the first
hit of `$1BC2` arrives.

$ mcp vice_checkpoint_list                        # t+140 s
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":1,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

`hit_count: 1` — the machine stopped **itself** at the first execution of `$1BC2`.
Per `vice-wedge-triage` this is the `checkpoint_trap` state and is the intended one:
it is not a wedge and must not be recycled. Everything from here to the resume is
one paused window.

$ mcp vice_registers_get
{"PC":13042,"A":0,"X":20,"Y":255,"SP":248,"N":false,"V":false,"B":false,"D":true,"I":false,"Z":false,"C":false}

**PC = `$32F2`, not `$1BC2`.** The checkpoint reported exactly one hit and the machine
is paused, but it is paused ~a frame's worth of work PAST the address it was armed at.
This is the finding that voided this run as a capture, and it is recorded rather than
worked around. What was done to establish it, and what each step ruled out:

$ mcp vice_ping                                   # is it really at rest?
{"status":"ok","version":"3.10","machine":"C64SC","execution":"paused"}
$ mcp vice_registers_get                          # read twice: is the PC moving?
{"PC":13042,...}                                  # identical -- genuinely at rest, not running

$ mcp vice_disassemble {"address":"$32F2","count":12}
$32F2: 0E 9A 43    ASL $439A
$32F5: 2E 99 43    ROL $4399
$32F8: 2E 98 43    ROL $4398
$32FB: A0 03       LDY #$03
$32FD: B9 9B 43    LDA $439B,Y
$3300: 79 9B 43    ADC $439B,Y
$3303: 99 9B 43    STA $439B,Y
$3306: 88          DEY
$3307: 10 F4       BPL $32FD
$3309: CA          DEX
$330A: 10 E6       BPL $32F2
$330C: 28          PLP

A BCD shift-and-add loop (the `D` flag is set in the registers above, and `$330C` pops
the pushed `P`) — a score/number routine the frame loop calls. So the machine is inside
frame 1's body, downstream of `$1BC2`, exactly as a late stop would leave it.

$ mcp vice_execution_run                          # resume: does the next stop land on $1BC2?
$ mcp vice_checkpoint_list                        # hit_count 2
$ mcp vice_registers_get
{"PC":21229,...}                                  # $52ED -- again far from $1BC2, and a DIFFERENT address

$ mcp vice_run_until {"address":"$1BC2"}
{"status":"ok","target_address":7106,"message":"Execution resumed, will stop at target or breakpoint"}
$ mcp vice_checkpoint_list
... checkpoint_num 2, start 7106, temporary true, hit_count 0 ...

`vice_run_until` is the same mechanism wearing a different hat: it arms a *temporary*
checkpoint at the target and resumes. It inherits the same late stop and is not a
precise-stop primitive.

$ mcp vice_execution_step {"count":1}   ;  $ mcp vice_registers_get
{"status":"ok","instructions":1,"step_over":false}
{"PC":21219,...}                                  # unchanged
$ mcp vice_execution_step {"count":10}  ;  $ mcp vice_registers_get   -> unchanged
$ mcp vice_execution_step {"count":20000} ; $ mcp vice_checkpoint_list -> hit_count unchanged at 2

`vice_execution_step` reports success and advances nothing observable on this build, so
it is not available as a precise-approach primitive either.

$ mcp vice_diagnose
vice_diagnose verdict: live
Load-bearing evidence: the restart epoch (already checked, at zero emulator cost) and the
stopwatch cycle delta across the bracket -- bracket 1 retired 19656 cycles (1 bracket run,
1 resume call).
Machine state left: paused, after the bracket that reached this verdict.

Triage (`vice-wedge-triage`): `live`, epoch unchanged, cycles retiring. This is **not** a
wedge, **not** a `restarted`, and **not** a `checkpoint_trap` needing recovery. The
instrument is healthy; it simply stops later than it is asked to. No `vice_recycle` was
called and none was warranted.

#### What the late stop costs, measured rather than assumed

$ mcp vice_snapshot_save {"name":"probe_frame_a", ...}
$ mcp vice_execution_run                          # advance to another checkpoint stop
$ mcp vice_memory_compare {"mode":"snapshot","snapshot_name":"probe_frame_a","start":"$0000","end":"$FFFF","max_differences":4000}
... "total_differences":3143,"truncated":false

3143 differing addresses sounds fatal and is not. Every one of them except **22** lies in
`$D000-$DFFF`, which `compare.mjs` classifies as **volatile** (it is I/O, not RAM) and
excludes from the verdict. The complete non-volatile difference set between two
title-menu stops is:

| Address | A | B | bits |
|---|---|---|---|
| `$000E` | `$C0` | `$00` | 2 |
| `$000F` | `$81` | `$83` | 1 |
| `$0016` | `$0A` | `$07` | 3 |
| `$001D` | `$03` | `$02` | 1 |
| `$0052` | `$01` | `$02` | 2 |
| `$005D` | `$64` | `$65` | 1 |
| `$005E` | `$EC` | `$ED` | 1 |
| `$007B` | `$00` | `$01` | 1 |
| `$007F` | `$0A` | `$07` | 3 |
| `$0098` | `$00` | `$0F` | 4 |
| `$009B` | `$00` | `$0F` | 4 |
| `$00CE` | `$01` | `$02` | 2 |
| `$277D` | `$01` | `$00` | 1 |
| `$43BD` | `$0C` | `$0D` | 1 |
| `$4EEC` | `$F8` | `$FB` | 2 |
| `$8FF8`-`$8FFC` | `$06`-`$0A` | `$0B`-`$0F` | 2-3 each |

That is 22 addresses out of 65536, and they are per-frame animation counters, not code.
`$8FF8`-`$8FFC` advance in lockstep by five, which is what a colour/animation cycle does
across a handful of frames.

**The consequence for this plan is precise.** `compare.mjs` fails a pairing on any
difference of two or more bits outside its volatile ranges, so two stops *in different
frames* cannot compare equivalent on this title screen. Two stops *in the same frame*
have no reason to differ in those counters at all. That is what makes the plan's own
definition of the instant — the **first** execution of `$1BC2`, i.e. game frame 1,
pinned by `hit_count == 1` — the reproducible one, and it is why the runs below are
each taken from a cold autostart at `hit_count == 1` and never from a resumed machine.

This calibration run is **voided as a capture**: it was resumed repeatedly and is no
longer at any defined instant. No capture artifact was written from it, so there is
nothing to rename `.VOID-`; the void is recorded here, per `c64-ram-capture`
§ *Void a run*. Nothing measured below descends from it.

---

### Run 1 — cold autostart, capture at the first `$1BC2`

The procedure below is executed identically for run 1 and run 2, and identically again
for the secondary release in `capture-record-secondary.md`. Nothing is tuned per run.

$ mcp vice_checkpoint_delete {"checkpoint_num":1}   # clear the calibration run's checkpoint
{"status":"ok","checkpoint_num":1}

$ mcp vice_checkpoint_list                          # zero armed before the cold start
{"checkpoints":[],"count":0}

$ mcp vice_machine_reset {"mode":"hard","run_after":true}
{"status":"ok","mode":"hard","run_after":true,"message":"Machine power cycled"}

$ mcp vice_checkpoint_add {"start":"$1BC2","exec":true,"stop":true}
{"status":"ok","checkpoint_num":1,"start":7106,"end":7106,"stop":true,"load":false,"store":false,"exec":true}
vice hazard (repeat): a stopping exec checkpoint was armed again at $1BC2 -- the full hazard note for this address was already issued earlier this session; see that note.

$ mcp vice_autostart {"path":"<workspace>/.../evidence/corpus/danish.d64","run":true}
{"status":"ok","path":".../evidence/corpus/danish.d64","run":true,"index":0,"message":"Autostart initiated - program will load and run"}

(real time: ~95 s to the crack intro, ~40 s more to the handoff — WarpMode is
unavailable, `handoff-identification.txt` § 7)

$ mcp vice_checkpoint_list                          # t+100 s
{"checkpoints":[{"checkpoint_num":1,...,"hit_count":0,...}],"count":1}

$ mcp vice_keyboard_matrix {"key":"SPACE","hold_frames":12}
{"status":"ok","row":7,"col":4,"pressed":true,"hold_frames":12,"auto_release_scheduled":true}

$ mcp vice_checkpoint_list                          # t+145 s
{"checkpoints":[{"checkpoint_num":1,...,"hit_count":0,...}],"count":1}

$ mcp vice_display_screenshot {"path":"<workspace>/dist/shot.png"}
Screen: gameplay — "1UP 000000  TOP 000000  FALLS 04", the first Bruce Lee room, with
Bruce, a lantern and the two guards' scenery. This is the title screen's **attract
demo**, reached by the menu timing out, not by any key this run pressed.

**Run 1 is VOIDED.** The machine ran clean past the instant the capture is defined at:
the keypress landed later relative to the load than in the calibration run, the title
menu timed out into attract mode, and `hit_count` never left 0. A capture taken here
would not be at the first execution of `$1BC2` — it would not be at any defined instant
at all. No artifact was written, so there is nothing to rename `.VOID-`; the void is
recorded here per `c64-ram-capture` § *Void a run*.

$ mcp vice_diagnose                                 # is the instrument still sound?
vice_diagnose verdict: live
Load-bearing evidence: ... bracket 1 retired 0 cycles, bracket 2 retired 38052 cycles
(2 brackets run, 2 resume calls).
Machine state left: paused, after the bracket that reached this verdict.

$ mcp vice_registers_get
{"PC":64878,"A":0,"X":0,"Y":48,"SP":253,...,"I":true,...}     # $FD6E, KERNAL, I set
$ mcp vice_display_screenshot ...                   # black screen

The machine had left the game entirely by this point and was executing KERNAL boot code
with a blank screen. Recorded as observed rather than explained: nothing in this run's
own transcript accounts for it, and it is a second, independent reason the run cannot
carry a capture. `vice_diagnose` reports `live` with the epoch unchanged, so this is not
a crash-and-respawn and not a wedge; per `vice-wedge-triage` no `vice_recycle` is
warranted and none was called.

**Procedure correction carried into every run below**, recorded because it is the
difference between a run that reaches the instant and one that does not: the keypress is
sent only after a screenshot has **confirmed the intro's "hit any key" gate is on
screen**, and `hit_count` is polled every 10 s from the moment of autostart rather than
after a single long wait. The calibration run, which did reach `hit_count == 1`, did
confirm the screen first; this run did not. Timing against a real-time load is the
variable, and it is removed by observing instead of assuming.

---

### Run 1 (attempt 2) — cold autostart, `hit_count == 1`

Same procedure, with the correction above applied: the intro gate confirmed on screen
before pressing, and `hit_count` polled from autostart.

$ mcp vice_checkpoint_delete {"checkpoint_num":1}   ;  $ mcp vice_checkpoint_list
{"status":"ok","checkpoint_num":1}
{"checkpoints":[],"count":0}

$ mcp vice_machine_reset {"mode":"hard","run_after":true}
{"status":"ok","mode":"hard","run_after":true,"message":"Machine power cycled"}

$ mcp vice_checkpoint_add {"start":"$1BC2","exec":true,"stop":true}
{"status":"ok","checkpoint_num":1,"start":7106,"end":7106,"stop":true,"load":false,"store":false,"exec":true}
vice hazard (repeat): a stopping exec checkpoint was armed again at $1BC2 ...

$ mcp vice_autostart {"path":"<workspace>/.../evidence/corpus/danish.d64","run":true}
{"status":"ok","path":".../evidence/corpus/danish.d64","run":true,"index":0,"message":"Autostart initiated - program will load and run"}

$ mcp vice_display_screenshot ...                  # t+70 s: black (loader, screen blanked)
$ mcp vice_checkpoint_list                         # hit_count 0
$ mcp vice_display_screenshot ...                  # t+145 s: still black
$ mcp vice_ping
{"status":"ok","version":"3.10","machine":"C64SC","execution":"paused"}

**Second procedure correction, and the cause of run 1 attempt 1's failure.** The machine
was **paused**, and had been for minutes: on this backend a read call
(`vice_checkpoint_list`, `vice_display_screenshot`) leaves the machine paused, and nothing
resumes it. `vice_ping` is the only non-pausing read, and it is the one call that reports
the fact. So a "wait and poll" loop silently stops the emulator instead of observing it.

The corrected loop, used from here on and for the secondary release, is exactly the
documented invariant with the resume made explicit:

1. `vice_checkpoint_list` — read `hit_count`.
2. If `hit_count == 0`, the machine has not reached the instant: `vice_execution_run` and
   wait. **Resuming is safe precisely because the hit count says the instant has not
   arrived.**
3. If `hit_count >= 1`, the machine stopped itself at the checkpoint: **do not resume**,
   capture in this window.

Poll on the hit count, never on paused state — and never resume without having just read
the hit count as zero.

$ mcp vice_execution_run                           # resume; 40 s
$ mcp vice_checkpoint_list                         # hit_count 0
$ mcp vice_execution_run                           # resume; 60 s
$ mcp vice_checkpoint_list                         # hit_count 0
$ mcp vice_display_screenshot ...
Screen: "DANISH CRACKERS / Presents / BRUCE LEE / hit any key / 1984. / DANISH CRACKERS"
— the intro gate, confirmed on screen before any key is sent.

$ mcp vice_keyboard_matrix {"key":"SPACE","hold_frames":12}
{"status":"ok","row":7,"col":4,"pressed":true,"hold_frames":12,"auto_release_scheduled":true}
$ mcp vice_execution_run                           # resume so the held key and the second load can run
$ mcp vice_checkpoint_list                         # +30 s
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":1,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

**`hit_count == 1`.** The machine stopped itself at the first execution of `$1BC2`. Every
read below is in that one paused window, before any resume.

#### The handoff address, re-verified on this run's own machine

$ mcp vice_disassemble {"address":"$1BC2","count":4}
$1BC2: A9 03       LDA #$03
$1BC4: 85 48       STA $48
$1BC6: 20 B8 19    JSR $19B8
$1BC9: AD 04 01    LDA $0104

Byte-identical to `handoff-identification.txt` § 5: `$1BC2` loads 3 into the per-frame
counter `$48` and enters the frame loop. The address the capture broke at is proven on
the machine that took it, not carried over from the machine § 2b voided.

#### Machine state at the capture instant (same paused window as the reads)

$ mcp vice_registers_get
{"PC":13062,"A":0,"X":20,"Y":3,"SP":248,"N":false,"V":false,"B":false,"D":true,"I":false,"Z":true,"C":false}

$ mcp vice_memory_read {"address":"$0000","size":2,"encoding":"hex"}
{"address":0,"size":2,"encoding":"hex","data_hex":"EF35"}
$ mcp vice_memory_read {"address":"$D018","size":1,"encoding":"hex"}   -> "33"
$ mcp vice_memory_read {"address":"$DD00","size":1,"encoding":"hex"}   -> "C1"
$ mcp vice_memory_read {"address":"$8FF8","size":8,"encoding":"hex"}   -> "06070F0F0F0F0F0F"

$ mcp vice_vicii_get_state
{"raster_line":311,"video_mode":1,"screen_enabled":true,"25_rows":true,"y_scroll":3,"x_scroll":0,
 "border_color":240,"background_color_0":252,"background_color_1":241,"background_color_2":254,
 "background_color_3":243,"sprite_sprite_collision":0,"sprite_background_collision":0,
 "irq_status":124,"irq_enabled":241,"memory_pointers":51,
 "registers":[52,225,52,225,177,141,177,141,128,141,226,141,0,0,0,0,0,155,55,213,91,3,216,0,51,124,241,0,0,255,0,0,240,252,241,254,243,244,240,255,240,245,240,240,247,253,252]}

$ mcp vice_sprite_get
sprite_0 x=52 y=225 enabled=true color=255 | sprite_1 x=52 y=225 enabled=true color=240
sprite_2..7 enabled=false (x/y 177/141, 177/141, 128/141, 226/141, 0/0, 0/0)

| Field | Value | Source |
|---|---|---|
| `$01` (processor port) | `$35` `%00110101` | `vice_memory_read` — LORAM=1, HIRAM=0, CHAREN=1: BASIC **and** KERNAL ROM banked out, RAM live at `$A000-$BFFF` and `$E000-$FFFF`, I/O visible |
| `$00` (data direction) | `$EF` | same read |
| `$DD00` | `$C1` → `vic_bank = 3 - (C1 & 3) = 2`, bank base `$8000` | `vice_memory_read` |
| `$D018` | `$33` → `screen_base = $8C00`, `charset_base = $8800` | `vice_memory_read` |
| sprite pointers (`screen_base+$3F8` = `$8FF8`) | `06 07 0F 0F 0F 0F 0F 0F` | `vice_memory_read` |
| video standard | PAL (raster 311, `$D011` = `$9B`) | `vice_vicii_get_state` |
| registers | PC `$3306`, A `$00`, X `$14`, Y `$03`, SP `$F8`, D set | `vice_registers_get` |
| epoch-drift errors during the capture | **none** — no drift error appeared on any forwarded call | the proxy raises these itself |
| checkpoints armed at exit | see § *Disarm and resume* below | `vice_checkpoint_list` |

`$01 = $35` is the field criterion 3 needs, and it is a substantive fact about this
release: with HIRAM = 0 the KERNAL is **out**, so the live vector pair is the RAM one at
`$FFFA-$FFFF`, not the KERNAL's. The processor-port value was read in the same paused
window as everything else above, per the plan's requirement.

**PC is `$3306`, not `$1BC2`** — the late-stop behaviour calibrated above. `$3306` is
inside the BCD score routine at `$32F2` the frame loop calls, i.e. downstream of `$1BC2`
inside frame 1. The stop is on the game side of the handoff and within the first frame
(`hit_count` is 1, so `$1BC2` has executed exactly once), which is what the instant's
definition requires; it is not at the instruction the checkpoint names, which is what the
instrument cannot deliver.

$ mcp vice_snapshot_save {"name":"danish_r1_handoff", ...}
{"status":"ok","name":"danish_r1_handoff","path":"/home/henrik/.config/vice/mcp_snapshots/danish_r1_handoff.vsf", ...}

The instant is banked as a snapshot so it survives the rest of the session and can be
returned to without re-booting. Verified faithful on reload: `$0000-$0001` reads back
`EF 35` and `$8FF8` reads back `06 07 0F 0F 0F 0F 0F 0F`, both byte-identical to the
values above.

---

### Run 2 — cold autostart, independent, `hit_count == 2`

Identical procedure. Transcript compressed to the load-bearing calls; the intro gate was
again confirmed on screen before the keypress.

$ mcp vice_checkpoint_delete {"checkpoint_num":1}
$ mcp vice_machine_reset {"mode":"hard","run_after":true}
$ mcp vice_checkpoint_add {"start":"$1BC2","exec":true,"stop":true}
$ mcp vice_autostart {"path":"<workspace>/.../evidence/corpus/danish.d64","run":true}
$ mcp vice_checkpoint_list      # t+110 s, hit_count 0
$ mcp vice_display_screenshot   # black
$ mcp vice_execution_run
$ mcp vice_checkpoint_list      # +60 s, hit_count 0
$ mcp vice_display_screenshot   # intro gate on screen, "hit any key"
$ mcp vice_keyboard_matrix {"key":"SPACE","hold_frames":12}
$ mcp vice_execution_run
$ mcp vice_checkpoint_list      # +30 s
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":2,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

**`hit_count == 2`, not 1.** This is the decisive observation of the whole plan. The stop
request straddled a frame boundary: `$1BC2` executed a second time before the pause took
effect. Run 1 stopped inside frame 1; run 2 stopped inside frame 2. The two runs are
therefore **at different game frames**, and no procedure available on this surface can
make them agree — the stop is neither instruction-exact nor frame-exact, and there is no
`ignore_count`-style control that fixes the *intra-frame* position.

$ mcp vice_registers_get
{"PC":21229,"A":4,"X":17,"Y":4,"SP":249,"N":false,"V":false,"B":false,"D":false,"I":false,"Z":false,"C":false}
$ mcp vice_memory_read {"address":"$0000","size":2,"encoding":"hex"}  -> "EF35"
$ mcp vice_memory_read {"address":"$D018","size":1,"encoding":"hex"}  -> "33"
$ mcp vice_memory_read {"address":"$DD00","size":1,"encoding":"hex"}  -> "C1"
$ mcp vice_memory_read {"address":"$8FF8","size":8,"encoding":"hex"}  -> "060708090A0F0F0F"

$ mcp vice_vicii_get_state
raster 311, video_mode 1, memory_pointers 51, irq_status 124, irq_enabled 241,
background_color_1 242 / _2 241 (run 1: 241 / 254) — the title screen's colour cycle has advanced
$ mcp vice_sprite_get
sprite_0 color 247 (run 1: 255); geometry otherwise identical

$ mcp vice_snapshot_save {"name":"danish_r2_handoff", ...}
{"status":"ok","name":"danish_r2_handoff","path":".../danish_r2_handoff.vsf", ...}

The invariant fields agree exactly across the two runs — `$01 = $35`, `$DD00 = $C1`,
`$D018 = $33`, so `vic_bank`, `screen_base` and `charset_base` are the same, and
`CAPTURE_PORT01` and `CAPTURE_HANDOFF_PC` are reproducible facts. What differs is
per-frame state: the sprite-pointer table at `$8FF8` reads `06 07 0F 0F ...` in run 1 and
`06 07 08 09 0A 0F ...` in run 2, and two VIC background colours have moved.

