# Capture record — `saeger` (SECONDARY), checkpoint `$1BC2`, runs 1 and 2

Phase 23 / plan 23-03 / Task 3. Shape follows
`src/skills/c64-ram-capture/templates/capture-record.template.md`. Same conventions and
same accepted limits as `capture-record-primary.md`, which is the canonical release's
record and is the one this file defers to for anything phase-wide; the limits are named
here rather than restated.

Evidence convention 1: every `$ ...` line was appended before the call it names was made,
and the real result pasted underneath. `mcp <tool>` denotes an `mcp__vice__<tool>` call —
the only permitted route to the emulator. `x64sc` was never invoked by hand.

- Release: `saeger` — `canonical: false` in `RELEASES.json`; its numbers **never gate**
  (`DECISION-RULE.md` § *Hold-out precedence contract*)
- Corpus file sha256: `b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5`
- Booted from the gitignored working copy at `evidence/corpus/saeger.d64`, proven
  byte-identical to the operator-supplied original in `handoff-identification.txt` § 1
- `PROBE_DIR` = `/home/henrik/.cache/c64-re-tools/phase23`
- Backend: fork, `/usr/local/bin/x64sc`, VICE 3.10

## Transcript

### Run 1 — cold autostart, `hit_count == 1`

$ mcp vice_machine_reset {"mode":"hard","run_after":true}
{"status":"ok","mode":"hard","run_after":true,"message":"Machine power cycled"}

$ mcp vice_checkpoint_add {"start":"$1BC2","exec":true,"stop":true}
{"status":"ok","checkpoint_num":1,"start":7106,"end":7106,"stop":true,"load":false,"store":false,"exec":true}

$ mcp vice_autostart {"path":"<workspace>/.../evidence/corpus/saeger.d64","run":true}
{"status":"ok","path":".../evidence/corpus/saeger.d64","run":true,"index":0,"message":"Autostart initiated - program will load and run"}

$ mcp vice_checkpoint_list        # t+100 s, hit_count 0
$ mcp vice_execution_run          # resume only because hit_count read zero
$ mcp vice_checkpoint_list        # +60 s, hit_count 0
$ mcp vice_display_screenshot {"path":"<workspace>/dist/shot.png"}
Screen: light-blue border, blue screen — "BRUCE LEE / cracked in oktober  1984 by /
SAEGER SOFT GROUP". Saved to `$PROBE_DIR/capture-work/saeger-run1-intro.png`.

**This is a corpus fact worth recording where it is observed.** The two releases name
**different cracker groups on screen** — "DANISH CRACKERS" and "SAEGER SOFT GROUP" —
which is a stronger independence indicator than the disk-layout evidence
`../corpus/corpus-intake.txt` § 4 could reach before booting. It still does not prove the
depacked *game bytes* have no shared ancestor, which remains 23-06/23-07's measurement;
it does raise the recorded claim's support from "no shared-ancestor indicator found in the
directory and BAM" to "two distinct self-identified crackers". The outcome line
`INDEPENDENCE` in the intake file is left at the value it was committed with — this file
does not edit another plan's outcome line — and the strengthening is noted for the
findings document.

#### The keypress gate is a *different mechanism* in this release

The intro did not advance on `vice_keyboard_matrix`. Rather than retrying blind, the wait
loop was disassembled:

$ mcp vice_registers_get
{"PC":2297,"A":0,"X":1,"Y":160,"SP":246,...}          # $08F9

$ mcp vice_disassemble {"address":"$08F0","count":16}
$08F0: A9 36       LDA #$36
$08F2: 85 01       STA $01
$08F4: A9 00       LDA #$00
$08F6: 20 E4 FF    JSR $FFE4        <-- KERNAL GETIN
$08F9: C9 20       CMP #$20         <-- compare against PETSCII space
$08FB: D0 F7       BNE $08F4
$08FD: 4C 21 08    JMP $0821
$0900: 78          SEI
...

The saeger intro banks the KERNAL **in** (`$01 = $36`) and spins on `JSR $FFE4` (GETIN)
until it returns `$20`. It reads the **KERNAL keyboard buffer**, not the matrix — the exact
mirror image of the danish intro, which polls `$DC01` directly and is invisible to buffer
injection. So the two releases need the two different routes `c64-ram-capture` § *Find an
entry point* names, and which one is correct is decided by disassembling the gate rather
than by trying both:

$ mcp vice_keyboard_petscii {"data":[32]}
{"status":"ok","bytes_queued":1}
$ mcp vice_execution_run
$ mcp vice_checkpoint_list        # +50 s
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":1,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

`hit_count == 1` — stopped at the first execution of `$1BC2`.

#### The handoff address, re-verified on this release's own machine

$ mcp vice_disassemble {"address":"$1BC2","count":4}
$1BC2: A9 03       LDA #$03
$1BC4: 85 48       STA $48
$1BC6: 20 B8 19    JSR $19B8
$1BC9: AD 04 01    LDA $0104

Byte-identical to the danish release's `$1BC2` and to
`handoff-identification.txt` § 5. The plan's expectation — that two cracks of one title
carry the same game image and therefore the same frame-loop head — is **confirmed per
release by observation** rather than assumed.

#### Machine state at the capture instant (same paused window as the reads)

$ mcp vice_registers_get
{"PC":13056,"A":0,"X":20,"Y":2,"SP":248,"N":false,"V":false,"B":false,"D":true,"I":false,"Z":true,"C":false}
$ mcp vice_memory_read {"address":"$0000","size":2,"encoding":"hex"}   -> "EF35"
$ mcp vice_memory_read {"address":"$D018","size":1,"encoding":"hex"}   -> "33"
$ mcp vice_memory_read {"address":"$DD00","size":1,"encoding":"hex"}   -> "C1"
$ mcp vice_memory_read {"address":"$8FF8","size":8,"encoding":"hex"}   -> "06070F0F0F0F0F0F"
$ mcp vice_vicii_get_state
{"raster_line":311,"video_mode":1,"screen_enabled":true,"25_rows":true,"y_scroll":3,"x_scroll":0,
 "border_color":240,"background_color_0":252,"background_color_1":241,"background_color_2":254,
 "background_color_3":243,"irq_status":120,"irq_enabled":241,"memory_pointers":51, ...}

| Field | Value | Source |
|---|---|---|
| `$01` (processor port) | `$35` `%00110101` | `vice_memory_read` — BASIC and KERNAL banked **out** at the instant, RAM live under both |
| `$00` | `$EF` | same read |
| `$DD00` | `$C1` → `vic_bank = 2`, bank base `$8000` | `vice_memory_read` |
| `$D018` | `$33` → `screen_base = $8C00`, `charset_base = $8800` | `vice_memory_read` |
| sprite pointers (`$8FF8`) | `06 07 0F 0F 0F 0F 0F 0F` | `vice_memory_read` |
| video standard | PAL (raster 311, `$D011` = `$9B`) | `vice_vicii_get_state` |
| registers | PC `$3300`, A `$00`, X `$14`, Y `$02`, SP `$F8`, D set | `vice_registers_get` |
| epoch-drift errors during the capture | **none** | the proxy raises these itself |
| checkpoints armed at exit | `0` — see § *Disarm and resume* | `vice_checkpoint_list` |

**Every one of those fields is identical to the canonical release's run-1 instant**
(`capture-record-primary.md`): the same `$01`, the same `$DD00`/`$D018` and therefore the
same VIC bank, screen base and charset base, the same sprite-pointer bytes, the same PAL
raster, and a PC six bytes away inside the same BCD routine. Two independently-cracked
releases of one title, booted from different disk layouts through different keypress
mechanisms, arrive at the same game state at the same handoff. That is a substantive result
for `PROOF-01` and it is observation, not inference.

$ mcp vice_snapshot_save {"name":"saeger_r1_handoff", ...}
{"status":"ok","name":"saeger_r1_handoff","path":".../saeger_r1_handoff.vsf", ...}

### Run 2 — cold autostart, independent, `hit_count == 1`

$ mcp vice_checkpoint_delete {"checkpoint_num":1}
$ mcp vice_machine_reset {"mode":"hard","run_after":true}
$ mcp vice_checkpoint_add {"start":"$1BC2","exec":true,"stop":true}
$ mcp vice_autostart {"path":"<workspace>/.../evidence/corpus/saeger.d64","run":true}
$ mcp vice_checkpoint_list        # t+120 s, hit_count 0
$ mcp vice_execution_run
$ mcp vice_checkpoint_list        # +90 s, hit_count 0
$ mcp vice_registers_get
{"PC":2294,...}                   # $08F6 -- inside the GETIN wait loop, gate reached
$ mcp vice_keyboard_petscii {"data":[32]}
$ mcp vice_execution_run
$ mcp vice_checkpoint_list        # +50 s
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":1,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

$ mcp vice_registers_get
{"PC":13063,"A":0,"X":15,"Y":1,"SP":248,"N":false,"V":false,"B":false,"D":true,"I":false,"Z":false,"C":false}
$ mcp vice_memory_read {"address":"$8FF8","size":8,"encoding":"hex"}   -> "06070F0F0F0F0F0F"

**`hit_count == 1` on both runs.** Unlike the canonical release, both saeger runs stopped
inside game **frame 1**, and the sprite-pointer table is byte-identical between them. This
is the case danish never produced, and it is what makes the comparison below informative
rather than foregone.

---

## Comparison against sibling runs

Same substitution as the canonical record and for the same reason
(`capture-record-primary.md` § *ACCEPTED LIMIT 1*): run 1's instant was banked as a
snapshot and run 2's live memory compared against it, with the tool's output pasted
verbatim. The three ranges are compared separately so `compare.mjs`'s **region rule** can
be applied without hand-classifying anything: `$D000-$DFFF` is volatile by that rule (it is
I/O, not RAM) and is therefore not compared at all.

$ mcp vice_memory_compare {"mode":"snapshot","snapshot_name":"saeger_r1_handoff","start":"$0400","end":"$CFFF","max_differences":2000}
{"differences":[
  {"address":"$CB57","current":255,"reference":253},{"address":"$CB59","current":255,"reference":239},
  {"address":"$CBAB","current":128,"reference":0},  {"address":"$CBE8","current":253,"reference":255},
  {"address":"$CBEE","current":253,"reference":255},{"address":"$CC53","current":0,"reference":8},
  {"address":"$CC6B","current":16,"reference":0},   {"address":"$CD46","current":223,"reference":255},
  {"address":"$CE3D","current":0,"reference":8},    {"address":"$CE4A","current":64,"reference":0},
  {"address":"$CE67","current":191,"reference":255},{"address":"$CE81","current":191,"reference":255}],
 "total_differences":12,"truncated":false}

**All twelve differ by exactly one bit** — `$02`, `$10`, `$80`, `$02`, `$02`, `$08`, `$10`,
`$20`, `$08`, `$40`, `$40`, `$40`. Under `compare.mjs`'s rules every one of them is
**drift**, which is listed as a candidate and **passes**.

$ mcp vice_memory_compare {... "start":"$E000","end":"$FFFF" ...}
29 differing addresses: $F638 $F6F5 $F6F9 $F725 $F77B $F7B4 $F7CE $F834 $F869 $F86B
$F982 $F9D9 $FA11 $FA1B $FA1C $FA38 $FA75 $FA88 $FAA1 $FAFF $FB03 $FBEB $FBFD $FC0E
$FC63 $FCDF $FD0C $FDBA $FDDE

**All twenty-nine differ by exactly one bit.** `$E000-$FFFF` is RAM under KERNAL ROM and
`compare.mjs` deliberately does **not** exclude it; here it is pure drift, 29 addresses out
of 8192, which sits alongside the skill's own record of `$FAD8`/`$FC51` differing across
captures without explanation.

$ mcp vice_memory_compare {... "start":"$0000","end":"$03FF" ...}
386 differing addresses. Every one lies inside a `compare.mjs` volatile region
(`$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`) — **except one**:

  $00F6   current $00   reference $EB      -> 6 bits

### What the comparison returns, and the single byte it turns on

| Class | Count | Effect on the verdict |
|---|---|---|
| volatile (`$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, `$D000-$DFFF`) | 385 + all of `$D000-$DFFF` | counted, never fails |
| drift — exactly one bit | 41 (12 in `$0400-$CFFF`, 29 in `$E000-$FFFF`) | candidates, pass |
| **divergence — two or more bits** | **1** (`$00F6`) | **fails the comparison** |

`CAPTURE_EQUIVALENT` for this release is therefore **`no`**, and it is `no` on the strength
of **one byte**. That is the tool's rule applied to the tool's output; `$00F6` was not
reclassified into drift to obtain a pass, and no threshold was invented here.

**What `$00F6` is.** `$00F5-$00F6` is the KERNAL's *pointer to the current keyboard
decoding table*. Run 1 holds `$EB` in the high byte — the KERNAL's own decode tables live
at `$EB81` and up — and run 2 holds `$00`. This release's intro drives the KERNAL keyboard
scan through `GETIN`, so whether that pointer is still set at the handoff depends on how
the keyboard scan happened to be left when the second load took over. It is loader/KERNAL
scratch, not game state, and it is *at* the boundary the capture instant sits on.

### Why this matters for the plan's conclusion

The canonical release failed the comparison with **100** non-volatile multi-bit
differences, because its two runs stopped in **different frames** (`hit_count` 1 and 2).
The secondary release, whose two runs both stopped in **frame 1**, fails with **one**. The
two results together separate the two causes cleanly:

- **Frame-index nondeterminism** — the checkpoint stop straddling a frame boundary — is
  what produces a large, structural divergence. It is the dominant defect and it is a
  property of the instrument, not of the corpus.
- **Intra-frame position** costs 41 one-bit drifts and nothing that fails.
- **One KERNAL scratch byte at the loader/game boundary** is what remains after both.

So the route is *nearly* reproducible, and what stands between it and a clean comparison is
a frame-exact stop the fork's stopping checkpoint does not provide. Recorded here as the
finding it is rather than reported as a flat failure.

---

## Verdict

- [ ] Size is exactly 65536 bytes — **NOT ESTABLISHED**. The 64K image was not assembled;
      see `capture-record-primary.md` § *ACCEPTED LIMIT 1*. Recorded unchecked.
- [x] No epoch-drift error appeared at any point during the capture — **PASS**. No
      forwarded call on either run raised epoch drift.
- [x] `vice_checkpoint_list` reported zero checkpoints before resuming — **PASS**, below.
- [x] Machine resumed exactly once, at the end — **PASS as qualified**: after the last
      paused read the machine was resumed exactly once, at the end of the plan. Every
      earlier resume was taken immediately after reading `hit_count == 0`, i.e. only while
      the instant provably had not arrived.

Box 1 is unchecked, so **both runs are voided as captures** under the template's rule. No
`.bin`, `.state.json`, `.map.json` or `.capture.json` was written for either run, so there
is nothing to rename `.VOID-<UTC timestamp>`; the voids are recorded here, which is the
rule's instruction for the artifact-less case. No partial chunk file was produced for this
release at all.

## Accepted limits

Both limits are phase-wide and are recorded in full in `capture-record-primary.md`:
**ACCEPTED LIMIT 1** (the 64K image could not be assembled — re-emitting 64K of hex through
the agent truncated once and silently dropped characters once) and **ACCEPTED LIMIT 2**
(`WarpMode` unavailable, so every run is real-time). Both apply here unchanged. This
release additionally cost two more real-time boots at roughly four minutes each.

## Deviations from the template

- Two runs, not the template's three-run minimum, for the reason given in the canonical
  record: a third run feeds the `floor` derivation, which needs the `.bin` files that
  ACCEPTED LIMIT 1 explains are absent.
- The per-pairing table is replaced by the verbatim `vice_memory_compare` output.

---

## Disarm and resume

This is the single disarm-and-resume record for the whole plan; the canonical record points
here rather than carrying a second, contradictory one.

$ mcp vice_checkpoint_list                          # before deleting
{"checkpoints":[{"checkpoint_num":1,"start":7106,"end":7106,"hit_count":1,"ignore_count":0,"stop":true,"enabled":true,"check_load":false,"check_store":false,"check_exec":true,"temporary":false}],"count":1}

$ mcp vice_checkpoint_delete {"checkpoint_num":1}
{"status":"ok","checkpoint_num":1}

$ mcp vice_checkpoint_list                          # the enumeration IS the proof
{"checkpoints":[],"count":0}

$ mcp vice_execution_run                            # the one closing resume
{"status":"ok","message":"Execution resumed"}

Zero checkpoints armed, taken from the enumeration and not from the delete call's own word
(`c64-ram-capture` step 8), and the machine left running. Nothing armed by this plan
survives it.
