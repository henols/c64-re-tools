---
tested_artifact_sha: d526f52068099de7fa9f950eaa8cf4cdb5d09bb9
tested_artifact_route: local-checkout-HEAD
stock_binary_path: /usr/bin/x64sc
vice_version: "x64sc (VICE 3.9)"
stock_binary_package_version: "3.9+dfsg-1"
c1541_binary_path: /usr/bin/c1541
acme_version: "ACME, release 0.97 (\"Zem\"), 31 Jan 2021, Platform independent version"
node_version: v22.22.0
driven_by: agent (this plan's own executor, live opt-in node --test run plus one uncommitted ad-hoc probe script for the joystick measurement -- see § Driving mechanism)
date: 2026-08-22
scenario_1_verdict: pass
scenario_2_verdict: partial
audit_acknowledged:
  milestone: v0.4.0
  at: 2026-08-23
  gap_snapshot: "unknown::scenarios=0"
---

# Phase 15 Plan 08 — Scenario 1 and Scenario 2 Live Evidence

Live execution of Phase 03's UAT scenarios 1 and 2 against genuine, unpatched stock
`/usr/bin/x64sc` (VICE 3.9, Debian package `3.9+dfsg-1`) through the real broker-launched
production code path (`stock-broker-live.test.ts`'s own harness: `resources/vice-broker.mjs`,
`buildViceArgs()`, `dispatchStock()` against a genuinely granted instance) -- never a hand-built
argv or an in-process shortcut for the launch under test.

## Driving mechanism

Scenario 1's three tools and scenario 2's keyboard half are each a committed, opt-in
`node --test` case in `.claude/mcp/vice/stock-broker-live.test.ts` (default-skipped,
`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-broker-live.test.ts` to run). Scenario 2's
joystick half is a **measurement, not a pass/fail** (see § Scenario 2, below), so per this plan's
own instruction it is **not** in the committed test file -- it was run via a one-off Node script
that imports the exact same production modules (`build.ts`, `vice-broker-client.ts`,
`stock-dispatch.ts`, `stock-connect.ts`, `broker-launch.mts`) and reuses the real
`resources/vice-broker.mjs` artifact, never a parallel hand-spawned emulator. That script lived
only under this session's own scratch directory (`/tmp/claude-.../scratchpad/scenario2/probe.mts`),
was never copied into the repository, and no longer exists on disk. Its full console output is
quoted verbatim below.

## Scenario 1 — `vice_autostart` / `vice_disk_attach` / `vice_snapshot_load` against real fixtures

**Verdict: PASS.** All three tools were exercised end to end against a real broker-launched
genuine-stock instance, through a real `.d64` built at run time. Two of the three legs
(`vice_disk_attach`, `vice_autostart`) were already covered by this file's own pre-existing
`.d64` test case (Task 1's own header comment traces this to audit item I-2 / phase 8.2 plan 03);
this plan added the third leg, `vice_snapshot_load`, as a new committed test case.

### Fixture provenance

The `.d64` is built at run time by the absolute-path `/usr/bin/c1541` from a synthetic `.prg`
this test file writes in-process (never a copyrighted image): 2-byte little-endian load address
(`$0801`), 2 sacrificial bytes (written `0x00 0x00`, deliberately never asserted on -- see
FINDING-D1 below), then a 16-byte verified payload of fifteen `0xEA` (NOP) bytes followed by one
`0x60` (RTS), landing at `$0803`-`$0812` after load.

**FINDING-D1 (pre-existing, this test file's own header comment, re-confirmed by this run):** a
raw machine-code `.prg` whose first two bytes at `$0801` are not a valid BASIC "next line" link
pointer does not survive VICE's own simulated-RUN autostart byte-for-byte -- the BASIC program
relink scans forward from `$0801` for a terminating zero byte and overwrites those first two
bytes with a computed value. This fixture's own first two bytes are therefore sacrificial by
design and never checked; the verified payload starts two bytes later, at `VERIFIED_PAYLOAD_ADDRESS`
= `$0803`.

### `vice_autostart`

Raw payload (from the pre-existing `.d64` case, re-run this session):

```json
{"path":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","sentPath":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","run":true,"index":0,"runState":"running"}
```

Observed delta: the verified payload region (`$0803`-`$0812`) matched
`[234,234,234,234,234,234,234,234,234,234,234,234,234,234,234,96]` (the expected NOP-run-ending-RTS
pattern) after 2 poll attempts (resume -> sleep -> read, per this file's own load-timing
discipline). **Verdict: PASS** -- the load-then-run round trip completes and lands the payload.

### `vice_disk_attach`

Raw payload:

```json
{"unit":8,"path":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","sentPath":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","approximation":"AUTOSTART with the run flag clear (D-14)","runState":"running"}
```

**The machine WAS reset and a program WAS loaded**, consistent with Phase 13's A5 finding
(`13-PROBE-RESULTS.md` § A5: `AUTOSTART` with `runAfter=false` still performs a full machine
reset and loads a program from the attached image, contradicting the advertised "attach without
loading or running anything" approximation). This run's own `runState: "running"` in the answer
above is the same signature A5 recorded: a pure attach-only operation would leave the machine in
whatever state it already was, not report `"running"`. This is not a new finding -- it is this
run's own independent corroboration of an already-filed one
(`.planning/todos/pending/` — the `vice_disk_attach` D-14 approximation todo from Phase 13 plan
13-05, not re-filed here). **Verdict: PASS** (the call succeeds and the payload lands, per the
`vice_autostart` result immediately after it in the same test) **with the pre-existing,
already-filed caveat that its advertised approximation undersells its real side effects.**

### `vice_snapshot_load` (the new leg this plan adds)

A `vice_snapshot_save` -> perturb -> `vice_snapshot_load` round trip, added as a new committed
test case. The verdict rests on two byte comparisons, never on the absence of an error:

1. **Baseline** (before any perturbation), read from `$C000` (RAM under BASIC ROM in bank 0,
   always plain RAM regardless of banking, and outside the loaded program's own `$0801`-`$0812`
   region): `[255,255,0,0]`.

2. **`vice_snapshot_save`** raw payload:
   ```json
   {"name":"brokerlive_roundtrip","path":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","sentPath":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","includeRoms":false,"includeDisks":false,"metadataWritten":true,"metadataPath":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.json","runState":"stopped"}
   ```

3. **Perturbation**: `vice_memory_write` wrote `[222,173,190,239]` (`0xDE 0xAD 0xBE 0xEF`) to
   `$C000`; a read immediately after confirmed it stuck: `[222,173,190,239]`.

4. **`vice_snapshot_load`** raw payload:
   ```json
   {"name":"brokerlive_roundtrip","path":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","sentPath":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","programCounter":58836,"metadata":{"description":null,"createdAt":"2026-08-22T15:21:55.292Z"},"runState":"stopped"}
   ```

5. **Half 1 (restore proof):** `$C000` read back **after** the load: `[255,255,0,0]` -- exactly
   the pre-perturbation baseline, **not** the perturbed pattern. The load restored state.

6. **Half 2 (identity proof):** the program's own verified payload region (`$0803`-`$0812`) read
   back after the load: `[234,234,234,234,234,234,234,234,234,234,234,234,234,234,234,96]` --
   still byte-identical to what it was before the save/perturb/load cycle. The load restored
   *this* machine, not some other one.

**Verdict: PASS**, decided entirely by the two byte comparisons above, never by the wire calls'
own reported success.

### Cleanup

`stock-paths.ts`'s `snapshotPathFor()`/`snapshotMetaPathFor()` are fixed to
`<repoRoot()>/.vice-snapshots/<name>.{vsf,json}` with no override to redirect into this harness's
own scratch directory (by design, T-3-05: keeps every snapshot inside the workspace's
`hostpath.ts`-translatable tree). `.vice-snapshots/` is gitignored, but the test still cleans up
its own two artifacts explicitly in a `finally` block rather than leaving them on disk. Confirmed
absent after the run:

```
$ ls .vice-snapshots/
r2000_probe_vsf.json  r2000_probe_vsf.vsf  r2000_probe_vsf_v2.json  r2000_probe_vsf_v2.vsf
```

(the two `r2000_probe_vsf*` files are pre-existing, unrelated artifacts from earlier regenerator2000
work -- `brokerlive_roundtrip.vsf`/`.json` are not present.)

### Process/scratch cleanup, whole opt-in run

```
$ pgrep -af x64sc
(no output -- no x64sc process from this run)
$ pgrep -af vice-broker
676247 .../vice-broker.mjs --repo-root /tmp/fake-repo-root-singleton --state-dir /tmp/broker-control-singleton-live-JAwkm0
```

The one `vice-broker` process listed is `broker-control.test.ts`'s own long-lived singleton
fixture (confirmed via `ps -o lstart`: started ~4 hours before this session, well before this
plan's work began, and `grep -l "broker-control-singleton" *.test.ts` resolves it to that file, not
`stock-broker-live.test.ts`) -- not a process this run started or leaked. Every `withBrokerHarness()`
scratch directory (`mkdtempSync(tmpdir(), "stock-broker-live-...")`) is removed in that helper's
own `finally` block; none was found left behind by manual inspection after the run.

## Scenario 2 — `vice_keyboard_petscii` and `vice_joystick_set` against a running program

**Verdict: PARTIAL.** The keyboard half is a clean PASS, deterministically asserted in a new
committed test case. The joystick half reproduced Phase 13 A3's exact zero-delta result --
against a program this run itself proved was genuinely running -- which is a real, valuable
negative result, recorded honestly rather than massaged into a pass.

### The reacting program

Hand-rolled, hardware addresses as literals (no C64 library -- the acme-build scaffold's own
library gap is a recorded Phase 8.1 finding; this follows the same worked-around convention as
the scaffold's `template.a`), assembled with the real `acme` binary on `$PATH`:

```
acme --version -> ACME, release 0.97 ("Zem"), 31 Jan 2021
                  Platform independent version.
```

Source, recorded verbatim (this is the exact string assembled both by the committed test and by
the ad-hoc joystick probe below):

```asm
!cpu 6510

* = $0801

        !word .eol, 10
        !byte $9e
        !byte '0' + entry % 10000 / 1000
        !byte '0' + entry %  1000 /  100
        !byte '0' + entry %   100 /   10
        !byte '0' + entry %    10
        !byte 0
.eol    !word 0

entry
        sei
loop
        lda $c6
        beq skipkey
        lda $0277
        sta $0400
skipkey
        lda $dc00
        sta $0401
        lda $dc01
        sta $0402
        jmp loop
```

This is the standard "10 SYS &lt;entry&gt;" BASIC-stub launch idiom (identical shape to
`acme-build/template.a`) -- **not** a raw-code fixture, so FINDING-D1's relink corruption does not
apply here: ACME's own computed `.eol` link pointer and VICE's independent relink-on-RUN scan land
on the identical value for a well-formed BASIC program (confirmed empirically below: the program
runs correctly). ACME's own `.rep` listing (real output, this session) gives the exact assembled
addresses:

```
     4  0801 0b080a00                   !word .eol, 10
     5  0805 9e                         !byte $9e
     6  0806 32                         !byte '0' + entry % 10000 / 1000
     7  0807 30                         !byte '0' + entry %  1000 /  100
     8  0808 36                         !byte '0' + entry %   100 /   10
     9  0809 31                         !byte '0' + entry %    10
    10  080a 00                         !byte 0
    11  080b 0000               .eol    !word 0
    13                          entry
    14  080d 78                         sei
    15                          loop
    16  080e a5c6                       lda $c6
    17  0810 f006                       beq skipkey
    18  0812 ad7702                     lda $0277
    19  0815 8d0004                     sta $0400
    20                          skipkey
    21  0818 ad00dc                     lda $dc00
    22  081b 8d0104                     sta $0401
    23  081e ad01dc                     lda $dc01
    24  0821 8d0204                     sta $0402
    25  0824 4c0e08                     jmp loop
```

`entry` = `$080D`, `loop` = `$080E`; the loop's own instruction range is `[$080E, $0826]`
(inclusive, the last byte of the final `jmp loop`).

The program is autostarted as a bare `.prg` (no disk needed at all for this scenario).

### Running-state proof (both runs -- committed test and ad-hoc probe)

Committed test run (`node --test`, this session):

```
running-state attempt 0: registers={"PC":61105,"A":79,"X":1,"Y":8,"SP":243,"00":47,"01":55,"FL":119,"LIN":0,"CYC":1}
running-state attempt 1: registers={"PC":2078,"A":127,"X":0,"Y":0,"SP":246,"00":47,"01":55,"FL":4,"LIN":0,"CYC":2}
running-state proof -- PC=0x81e inside loop range [0x80e, 0x826], confirmed=true
```

`0x81e` (`$081E`, the `lda $dc01` instruction) sits squarely inside `[$080E, $0826]` -- the CPU is
executing this program's own loop, not sitting at some KERNAL/BASIC address. Attempt 0's PC
(`61105` = `$EEF1`, a KERNAL address) is the machine still finishing its boot/RUN sequence at the
first sample; attempt 1 lands inside the loop, one resume-sleep-read cycle later. Ad-hoc probe run
(ACME + broker launch fresh) produced the equivalent proof independently: `PC=0x81b` inside the
same range on its second sample.

### Keyboard half (committed, deterministic)

```
$0400 before injection = [32]
vice_keyboard_petscii([0x41]) -> {"byteCount":1,"petsciiHex":"41","note":"Bytes are queued in the KERNAL keyboard buffer -- nothing consumes them until the machine runs. This client never issues an unrequested resume (D-05); resume explicitly to have the buffer read.","runState":"stopped"}
$0400 after injection (byte 0x41) = [65]
```

`32` (`$20`, PETSCII space -- the default screen-fill character) before; `65` (`$41`, the exact
injected byte) after. **Verdict: PASS**, asserted in the committed test
(`stock-broker-live.test.ts`).

### Joystick half (ad-hoc probe, not committed -- a measurement, not a pass/fail)

Single-bit rounds, fixed order (up, down, left, right, fire), never two bits at once -- identical
methodology to Phase 13 A3, this time against a program independently proven running (above). Both
CIA1 port bytes (`$dc00`/`$dc01`) read before and after every round, resumed and given 800ms of
real run time between the `vice_joystick_set` call and the read:

```
vice_joystick_set(up) -> {"port":1,"directions":["up"],"fire":false,"value":1,"valueBits":["up"],"runState":"stopped"}
joystick up: $dc00/$dc01 before=[127,255] after=[127,255]
vice_joystick_set(center) -> {"port":1,"directions":["center"],"fire":false,"value":0,"valueBits":[],"runState":"stopped"}
vice_joystick_set(down) -> {"port":1,"directions":["down"],"fire":false,"value":2,"valueBits":["down"],"runState":"stopped"}
joystick down: $dc00/$dc01 before=[127,255] after=[127,255]
vice_joystick_set(center) -> {"port":1,"directions":["center"],"fire":false,"value":0,"valueBits":[],"runState":"stopped"}
vice_joystick_set(left) -> {"port":1,"directions":["left"],"fire":false,"value":4,"valueBits":["left"],"runState":"stopped"}
joystick left: $dc00/$dc01 before=[127,255] after=[127,255]
vice_joystick_set(center) -> {"port":1,"directions":["center"],"fire":false,"value":0,"valueBits":[],"runState":"stopped"}
vice_joystick_set(right) -> {"port":1,"directions":["right"],"fire":false,"value":8,"valueBits":["right"],"runState":"stopped"}
joystick right: $dc00/$dc01 before=[127,255] after=[127,255]
vice_joystick_set(center) -> {"port":1,"directions":["center"],"fire":false,"value":0,"valueBits":[],"runState":"stopped"}
vice_joystick_set(fire) -> {"port":1,"directions":["center"],"fire":true,"value":16,"valueBits":["fire"],"runState":"stopped"}
joystick fire: $dc00/$dc01 before=[127,255] after=[127,255]
```

**Zero delta on every one of the five single-bit rounds, at both port bytes** -- `$DC00` stayed
`127` (`0x7F`) and `$DC01` stayed `255` (`0xFF`) through every `JOYPORT_SET` call, including the
`fire` round. This is byte-identical to Phase 13's A3 result
(`13-PROBE-RESULTS.md` § A3: `up 0x7f->0x7f / 0x01: ff->ff`, etc., zero delta across two
independent sessions).

**Cross-reference to A3, and what this eliminates.** A3 named three candidate explanations for its
null result: (a) `JOYPORT_SET` has no effect on the emulated CIA1 lines on this build, (b)
`port=1` maps to neither `$DC00` nor `$DC01` and a different port value would show a delta, or (c)
some other precondition -- e.g. a running program actively driving the CIA data-direction register
-- is required before a read reflects the joystick lines. **This run's own running-state proof
(above) directly tests candidate (c) and finds no delta even with a program continuously reading
both CIA1 port bytes into its own observation cells while genuinely executing.** Candidate (c) is
therefore eliminated as the explanation for A3's null result; candidates (a) and (b) remain open
(this run cannot distinguish between them -- both would produce the identical zero-delta
observation).

**Verdict: PARTIAL, honestly.** The keyboard half passed cleanly; the joystick half reproduces a
genuine negative result under a strictly stronger precondition than A3 tested (a confirmed-running
program, not merely an accepted wire body). No delta was observed at either candidate port for any
of the five single-bit directions or fire, so **no bit-to-port mapping is recorded** and **no
`[ASSUMED]` label in `stock-input.ts`/`stock-protocol.ts` is touched by this plan** --
`assumption-label-discipline.test.ts`'s all-or-nothing guard (`EXPECTED_LABEL_SITES.A3 =
["stock-input.ts", "stock-protocol.ts"]`) stays exactly as it was; `git diff --stat
.claude/mcp/vice/stock-input.ts` is empty. If a future plan (or a future probe with a different
precondition, e.g. genuine `Drive8Type`/CIA data-direction-register setup) DOES observe a delta,
that plan is the one to update the label -- not this one, and not by inference from this null
result.

### Cleanup

The ad-hoc probe's own broker daemon reported `shutdown complete -- 0 instance(s) processed, 0
signalled` after its own explicit SIGTERM-then-SIGKILL teardown, and its `mkdtempSync` scratch
directory was removed in the same `finally` block. `pgrep -af x64sc` after both runs (committed
test suite and ad-hoc probe) showed no process from this scenario; `pgrep -af vice-broker` showed
only the same pre-existing `broker-control.test.ts` singleton named in Scenario 1's cleanup
section, confirmed unrelated by the same `ps -o lstart` timestamp check.
