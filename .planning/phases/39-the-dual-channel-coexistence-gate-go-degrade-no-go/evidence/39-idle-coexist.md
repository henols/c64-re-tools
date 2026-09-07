# Phase 39, plan 39-03 — `IDLE_COEXIST` (the sole `R1`/`R2` no-go trigger)

Owned by `39-03`. Measures the first of the phase's seven gate inputs, per
`SCHEMA.md` §2.1's frozen derivation. Follows the evidence conventions in
`README.md` § *Evidence conventions*, binding on this plan.

---

## Precondition check (D-16), taken immediately before the authoritative run

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -af x64sc
2751623 /bin/bash -c source /home/henrik/.claude/shell-snapshots/snapshot-bash-1788805127805-zziv51.sh 2>/dev/null || true && shopt -u extglob 2>/dev/null || true && { \builtin unalias -- 'unsetenv'; \builtin unset -f -- 'unsetenv'; } >/dev/null 2>&1 || true && eval 'systemctl --user is-active vice-broker; echo "rc=$?" pgrep -af x64sc; echo "rc=$?"' < /dev/null && pwd -P >| /tmp/claude-6f2d-cwd
```

The single line `pgrep -af x64sc` returns is its own invoking shell command
line (it contains the literal substring `x64sc` because that is the string
being searched for) — README.md § *Evidence conventions* 3's own documented
false positive: *"`pgrep -af x64sc` matches its own invoking command line
when run from a shell that echoes it, so filter that out before reading 'no
output' as the answer."* Filtered by exact-name match instead, which the
probe itself also uses (`probe-harness.mjs`'s `aliveX64sc()`, `pgrep -x`):

```
$ pgrep -x x64sc
(no output, exit 1 -- no genuine x64sc process alive)
```

Both observations confirm the precondition: broker `inactive`, zero alive
`x64sc` processes. `preflight()` in `probe-harness.mjs` re-asserts this same
pair in code, immediately before every spawn, and throws rather than warns if
either is violated.

---

## Run 1 — VOIDED (probe defect, not a measurement of the machine)

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/idle-coexist-probe.mjs
PROBE idle-coexist-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T20:41:38.008Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 43415
TEXT_PORT 44401
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:43415","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:44401"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 156
BINARY_MONITOR_READY_AFTER_PINGS 1
CONTROL_READ_0 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
CONTROL_READ_1 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
CONTROL_READ_2 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
CONTROL_THREE_READS_AGREE: yes
TEXT_TIME_TO_BIND_MS 1
TEXT_BIND_BUDGET_MS_MAX: 1
TEXT_NEEDED_MORE_BUDGET_THAN_BINARY: no
TEXT_BANNER_HEX:
TEXT_BANNER_TEXT: ""
TEXT_PROMPT_RE_ORIGINAL: /\(C:\$[0-9A-Fa-f]{4}\)\s*$/
TEXT_PROMPT_LITERAL_CONFIRMED: no
TEXT_PROMPT_RE_NOTE: the original matcher did not match the observed banner bytes within budget; the observed bytes are recorded above verbatim for a later plan to correct the matcher against
ANCHOR_CHECKPOINT_ID 1
ANCHOR_HITCOUNT_BEFORE 0
ANCHOR_HITCOUNT_AFTER_1S 0
IDLE_TEXT_CLIENT_HALTS: yes
MEASURED_READ_0 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
MEASURED_READ_1 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
MEASURED_READ_2 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
DESYNC_BYTES_DELTA: 0
DUPLICATE_REPLIES_DELTA: 0
UNSOLICITED_BROADCAST_FRAMES_DURING_WINDOW: 0
DERIVATION_INPUTS allMeasuredMatchControl=true noDesync=true noDup=true noUnsolicited=true
REMOTEMONITOR_FLAG_ORDER: default-first-assumed
IDLE_COEXIST: clean
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3536 / fail 5
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, audit-root-args.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/idle-coexist-run.json
```

**VOID reason (`IDLE_TEXT_CLIENT_HALTS` line only — every other line in this
run is independently reproduced and confirmed by Run 3 below, and none of
them changes).** `idle-coexist-probe.mjs`, as first written, never sent an
`EXIT` (0xaa) resume command anywhere in its whole sequence. Reviewing the
result against the raw fact that `ANCHOR_HITCOUNT_BEFORE` and
`ANCHOR_HITCOUNT_AFTER_1S` were both `0` surfaced a previously-unmeasured
fact about this exact launch shape (`-console` plus both monitor flags,
recorded properly below as a deviation): **the CPU starts halted and stays
halted until an explicit resume is sent** — it is not merely idle at the
BASIC prompt. Reading state (`MEMORY_GET`, `REGISTERS_GET`, `CHECKPOINT_GET`)
does not itself start it running. The recorded `IDLE_TEXT_CLIENT_HALTS: yes`
in this run is therefore an artifact of the probe never asking the machine to
run at all — not a fact about whether a silently-connected text client halts
it. `idle-coexist-probe.mjs` was corrected (see `probe-harness.mjs`'s
`resumeExecution()` and `awaitFirstCheckpointHit()`, added after this run)
and Run 3 below is the corrected, authoritative measurement of this fact.
`IDLE_COEXIST` itself was already correct in this run (the ROM window
comparison does not depend on CPU running state at all — the KERNAL ROM at
`$E000-$E0FF` is invariant under execution either way), so this line is
reproduced, not contradicted, by Run 3.

Also visible above: the test:automated baseline this run happened to observe
(`fail 5`, `audit-root-args.test.ts` twice) is a known, unrelated flake — a
`zz-scratch-*` ENOENT race in the repo-tree test suite, not a regression and
not caused by this plan. Run 3's own baseline observation below shows the
more common `fail 3` shape.

---

## Run 3 — authoritative

Preflight re-verified immediately before this run:

```
$ systemctl --user is-active vice-broker
inactive
$ pgrep -x x64sc
(no output, exit 1)
```

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/idle-coexist-probe.mjs
PROBE idle-coexist-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T20:59:26.074Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 45193
TEXT_PORT 36041
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:45193","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:36041"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 153
BINARY_MONITOR_READY_AFTER_PINGS 1
CONTROL_READ_0 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
CONTROL_READ_1 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
CONTROL_READ_2 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
CONTROL_THREE_READS_AGREE: yes
TEXT_TIME_TO_BIND_MS 0
TEXT_BIND_BUDGET_MS_MAX: 0
TEXT_NEEDED_MORE_BUDGET_THAN_BINARY: no
TEXT_BANNER_HEX:
TEXT_BANNER_TEXT: ""
TEXT_PROMPT_RE_ORIGINAL: /\(C:\$[0-9A-Fa-f]{4}\)\s*$/
TEXT_PROMPT_LITERAL_CONFIRMED: no
TEXT_PROMPT_RE_NOTE: the original matcher did not match the observed banner bytes within budget; the observed bytes are recorded above verbatim for a later plan to correct the matcher against
ANCHOR_CHECKPOINT_ID 1
RESUMED_ONCE_FOR_HALT_CHECK
ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2034}
ANCHOR_HITS_DURING_1S_SAMPLE_WINDOW: 59
IDLE_TEXT_CLIENT_HALTS: no
MEASURED_READ_0 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
MEASURED_READ_1 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
MEASURED_READ_2 len=256 hex_prefix=8556200fbca561c988900320d4ba20cc
DESYNC_BYTES_DELTA: 0
DUPLICATE_REPLIES_DELTA: 0
UNSOLICITED_BROADCAST_FRAMES_DURING_WINDOW: 0
DERIVATION_INPUTS allMeasuredMatchControl=true noDesync=true noDup=true noUnsolicited=true
--- supplementary, documentation only, after the gate window closed above ---
POST_MEASUREMENT_PROMPT_HEX 28433a24653563662920
POST_MEASUREMENT_PROMPT_TEXT "(C:$e5cf) "
POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE true
REMOTEMONITOR_FLAG_ORDER: default-first-assumed
IDLE_COEXIST: clean
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/idle-coexist-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

### Raw connect-banner bytes, before any command was sent

The first byte-exact text-monitor connect-banner capture in this project's
history:

```
hex:  (empty -- zero bytes received within the 10000ms awaitBanner() budget)
text: ""
```

The stock text monitor sends **nothing** on connect — no greeting, no
prompt — and only replies once it receives input. `awaitBanner()` therefore
correctly reports an empty capture; this is the honest, observed byte
sequence, not a bug in the capture code. Because the accumulated buffer was
empty, `PROMPT_RE` (`/\(C:\$[0-9A-Fa-f]{4}\)\s*$/`) could not match it, which
is why `TEXT_PROMPT_LITERAL_CONFIRMED: no` is recorded below — that line
answers "did the connect banner match", and the honest answer is "there was
no banner to match".

### The prompt half of the acceptance criterion, captured supplementarily

Taken strictly **after** the `IDLE_COEXIST` gate measurement above had
already concluded (so it cannot contaminate it), by sending the most inert
input possible — a bare newline, no monitor command — on the same text
socket:

```
hex:  28433a24653563662920
text: "(C:$e5cf) "
```

This **does** match `PROMPT_RE` byte-for-byte (`POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE true`).
Combined with the empty-banner finding above, the honest picture is: the
banner half of research assumption A2/A3 resolves to "there is no banner",
and the prompt half resolves to "the assumed `PROMPT_RE` shape is correct
once a prompt actually exists" — both now resting on observed bytes rather
than on assumption.

### Control vs. measured payload digests ($E000-$E0FF, 256 bytes each)

All six reads (three no-text-client control reads, three
text-client-attached measured reads) are byte-identical:

```
sha256 (all six reads): c5fccb8583eefe727f816ca4a8034cbba9a54b2a240d7919de9169e49a85f45e
```

Full hex of one representative 256-byte payload (every one of the six is
identical to this):

```
8556200fbca561c988900320d4ba20ccbca507186981f0f338e90148a205b569b46195619469ca10f5a55685702053b820b4bfa9c4a0bf2059e0a900856f6820b9ba608571847220cabba9572028ba205de0a957a0004c28ba8571847220c7bbb1718567a471c898d002e6728571a4722028baa571a4721869059001c8857184722067b8a95ca000c667d0e4609835447a006828b14600202bbc3037d02020f3ff86228423a004b1228562c8b1228564a008b1228563c8b12285654ce3e0a98ba00020a2bba98da0e02028baa992a0e02067b8a665a56285658662a663a56485638664a9008566a5618570a980856120d7b8a28ba0004cd4bbc9f0d007843886
```

---

## The four `R2`-mitigation facts (`SCHEMA.md` §3), plus one boot-timing note

- **`REMOTEMONITOR_FLAG_ORDER: default-first-assumed`.** The assumed argv
  order (`-binarymonitor` pair, then `-remotemonitor` pair, both trailing the
  determinism block) bound both ports successfully on the first attempt in
  every run above (`TEXT_TIME_TO_BIND_MS 0`) — the alternative (swapped)
  order was never tried, per `SCHEMA.md` §2.1's own instruction that this
  value is used precisely when the assumed order succeeds without needing
  the alternative.
- **`TEXT_PROMPT_LITERAL_CONFIRMED: no`** for the banner specifically (there
  is none to match), with the prompt-half confirmation recorded
  supplementarily above (`POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE true`).
- **`TEXT_BIND_BUDGET_MS_MAX: 0`.** The text port was already listening and
  accepted instantly in both Run 1 and Run 3 (`1ms` and `0ms` respectively) —
  well under the binary port's own `~150ms`. `TEXT_NEEDED_MORE_BUDGET_THAN_BINARY: no`
  in both runs.
- **Deviation, recorded here because it is this file's own fact, not a
  gate input:** a stock `x64sc` launched with `-console` plus either
  monitor flag starts with the CPU halted and stays halted until an
  explicit `EXIT` (0xaa) resume is sent; once resumed it free-runs
  autonomously until the *next* command reaches the monitor. A cold C64
  boot additionally masks interrupts for its KERNAL RAM test — measured at
  `2034ms` on this host (`ANCHOR_FIRST_HIT`) — before the first `$EA31`
  jiffy IRQ fires. Neither fact was previously recorded anywhere in this
  project; both are now load-bearing for every later plan in this phase
  that needs the machine actually running (`39-04` through `39-07`).

---

<!-- Bare column-0 outcome lines. Final occurrence wins (README.md convention 7). -->

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
IDLE_TEXT_CLIENT_HALTS: no
REMOTEMONITOR_FLAG_ORDER: default-first-assumed
TEXT_PROMPT_LITERAL_CONFIRMED: no
TEXT_BIND_BUDGET_MS_MAX: 0
IDLE_COEXIST: clean
