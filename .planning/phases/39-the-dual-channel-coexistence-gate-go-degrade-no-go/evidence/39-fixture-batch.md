# Phase 39, plan 39-07 — the first text-channel fixture batch (`CHAN-01`, D-17/D-18/D-19/D-20)

Owned by `39-07`. Captures the raw response bytes for six parseable text-monitor
commands, from **both** binaries on this host, and commits them as
`src/mcp/vice/fixtures/textmon/*` payload+sidecar pairs — the fixture-loading
side of `SCHEMA.md`'s own stated mechanism ("the loader refusing a sidecar that
is missing a key is what makes this checkable rather than claimed"). Follows
the evidence conventions in `README.md` § *Evidence conventions*, binding on
this plan. This file records the CAPTURE run only — it writes no fixture-loader
code and no test; those are Task 2's own commit.

**Scope boundary, restated from the plan:** this file (and
`fixture-capture.mjs`) commit no interleaving transcript. Only parseable
single-command outputs become fixtures; the phase's other seven gate-input
evidence files are where an interleaving belongs.

---

## Precondition check (D-16), taken immediately before every run below

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc
(no output, exit 1 -- no genuine x64sc process alive)
```

Broker `inactive`, zero alive `x64sc` processes, confirmed again in code by
`preflight()` before every spawn below (`PREFLIGHT_BROKER inactive` /
`PREFLIGHT_X64SC (none)` in every transcript excerpt).

Both binaries resolved and confirmed present and executable before any run:

```
$ ls -la /usr/bin/x64sc /usr/local/bin/x64sc
-rwxr-xr-x 1 root root  4057928 30 dec  2024 /usr/bin/x64sc
-rwxr-xr-x 1 root root 18196824 26 aug 22.09 /usr/local/bin/x64sc

$ /usr/bin/x64sc --version
x64sc (VICE 3.9)

$ /usr/local/bin/x64sc --version
x64sc (VICE 3.10)
```

`VICE_BINARY: stock:/usr/bin/x64sc` / `VICE_VERSION_OBSERVED: x64sc (VICE 3.9)`
and `VICE_BINARY: fork:/usr/local/bin/x64sc` / `VICE_VERSION_OBSERVED: x64sc
(VICE 3.10)` — genuine unpatched stock and the patched fork, per `D-15`/`D-12`.

---

## Voided run 1 — connect-race, zero fixtures written

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs
PROBE fixture-capture.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T23:07:06.721Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
$ /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:43317 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:41577
FATAL Error: connect ECONNREFUSED 127.0.0.1:41577
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:2017:16)
```

**VOID: run 1: zero fixtures written.** The first draft called
`textmon-probe-client.mjs`'s `connectTextMonitor()` directly, which is a
single-shot connect with no retry. `x64sc` binds its monitor sockets some time
after `execve()` returns, not the instant it returns
(`probe-harness.mjs`'s own `connectWithRetry()` doc comment, previously
established for the binary port only) — the script raced the emulator's own
socket bind and lost. Reaped cleanly (`reapAll()` on the thrown-error path);
no orphan process, no fixture written.

**Fix (Rule 3 — blocking):** added a local `connectTextMonitorWithRetry()`
helper reproducing the same retry shape every prior plan in this phase already
uses locally for the text port (e.g. `text-single-client-probe.mjs`'s own
identically-named helper) — reused, not re-derived from nothing.

---

## Voided run 2 — framing bug, fixtures written but WRONG, overwritten by the authoritative run

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs
...
CAPTURE_STOCK_access-map: command="memmapshow" bytes=10 matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_access-map_TEXT: "(C:$e5d4) "
CAPTURE_STOCK_flat-profile: command="prof flat 5" bytes=1625056 matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_flat-profile_TEXT: "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n0001: --- --- rw-\n...[1.6MB of memmapshow's own dump]...        Total      %          Self      %\n------------- ------ ------------- ------\n2 326 155  98,5% 2 326 155  98,5% ffcf                                    \n     34 897   1,5%      17 031   0,7% ff48                                    \n      8 968   0,4%       8 968   0,4% ea87                                    \n      8 671   0,4%       8 671   0,4% ffea                                    \n          161   0,0%           161   0,0% ea1c                                    \n(C:$e5d4) "
```

**VOID: run 2: all 12 fixtures WRITTEN, but the `access-map` and
`flat-profile` cases (both binaries) are wrong — a real capture-framing defect,
not a corrupt byte stream.** `memmapshow`'s TRUE reply is captured whole
(1,624,557 bytes, confirmed by run 3 below), but the SECOND SCRIPT'S own
`sendAndAwaitPrompt()` call (imported unmodified from
`textmon-probe-client.mjs`) resolved as soon as `PROMPT_RE` first matched the
accumulated buffer's end — and the stock text monitor frames every reply in
THREE parts: an immediate echo of the current halted PC (`(C:$e5d4) `, written
BEFORE the command has actually executed), the command's own output, then a
second, final exit prompt. For a command slow enough to compute
(`memmapshow`, scanning all 65536 addresses), the entry-echo and the rest of
the reply routinely arrive as SEPARATE TCP segments — so the naive client
resolved on the entry-echo alone (10 bytes), and the socket (paused once the
`data` listener was removed, per Node's own stream semantics) buffered the
REST of `memmapshow`'s real ~1.6MB dump until the NEXT listener attached
(`prof flat 5`'s own `sendAndAwaitPrompt()` call), which then received it
first, ahead of `prof flat`'s own genuine (509-byte) reply. `access-map` and
`flat-profile`'s committed `.txt` files from this run were consequently wrong
— `access-map` truncated to 10 bytes, `flat-profile` inflated to 1,625,056
bytes carrying someone else's data — though the OTHER four command pairs
(`cpu-history`, `backtrace`, `register-decode`, `connect-banner`) captured
correctly in this same run, since none of them are slow enough to split
across TCP segments the way `memmapshow` is.

**Fix (Rule 1 — bug):** `textmon-probe-client.mjs`'s own file header already
documents this exact class of hazard as out of that file's scope ("does NOT
distinguish a prompt-shaped substring appearing inside a command's own
output... wrong for a protocol implementation that has to be robust") — and
per `D-13`, that file is a throwaway that does not survive this phase, so it
is not modified. Fixed locally in `fixture-capture.mjs` instead: a new
`sendAndAwaitSettledReply()` helper waits for `PROMPT_RE` to match, THEN
requires the socket to go quiet for a fixed window (800ms for command
captures, 500ms for the `prof on` setup step) before finalizing — any further
data arriving during the quiet window resets the timer. This correctly spans
both the double-prompt (entry+exit) framing and slow/large outputs, confirmed
empirically before committing the fix: a standalone reproduction against a
live stock instance (`memmapshow` / `prof flat 5` / `chis 4` / `bt` /
`io $d020` sent in sequence) produced clean, correctly-bounded captures with
every reply beginning and ending with a genuine prompt for its OWN command,
and no cross-command bleed.

All 12 fixtures from this voided run were overwritten by run 3 below (same
filenames — regeneration, not hand-editing, per this tree's own discipline).

---

## Run 3 (authoritative) — full transcript

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs
PROBE fixture-capture.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T23:19:31.908Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
$ /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:34611 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:42569
TEXT_BIND_MS_STOCK: 153
CONNECT_BANNER_STOCK: bytes=0 matchedPromptRe=false hex=
SETUP_PROF_ON_STOCK: matchedPromptRe=true text="(C:$e5d4) Profiling restarted.\n(C:$e5d4) "
SETUP_RESUME_STOCK: sent x (EXIT), no reply awaited -- free-running window follows
CAPTURE_STOCK_access-map: command="memmapshow" bytes=1624557 sha256=c53c36d74dd261f82e6655aa36d4bf6c4346fe244a491a11b5f7475ef471c828 matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_access-map_TEXT: "(C:$e5d1) addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n0001: --- --- rw-\n...[elided 1623957 chars]...ffea: --- --x ---\nfffc: --- r-- ---\nfffd: --- r-- ---\nfffe: --- r-- ---\nffff: --- r-- ---\n(C:$e5d1) "
CAPTURE_STOCK_flat-profile: command="prof flat 5" bytes=509 sha256=8f57d2ad8be7fafae870b02a1a8732d7df397f985f0303ac37b2000b4dc10cf6 matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_flat-profile_TEXT: "        Total      %          Self      %\n------------- ------ ------------- ------\n2 326 151  98,5% 2 326 151  98,5% ffcf                                    \n     34 897   1,5%      17 031   0,7% ff48                                    \n      8 968   0,4%       8 968   0,4% ea87                                    \n      8 671   0,4%       8 671   0,4% ffea                                    \n          161   0,0%           161   0,0% ea1c                                    \n(C:$e5d1) "
CAPTURE_STOCK_cpu-history: command="chis 4" bytes=326 sha256=8c80b0dd769bb6d83648ecdd56d1ea6e6870cdf9708ac0eb98d2eb872c01caa3 matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_cpu-history_TEXT: ".C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302187\n.C:e5d4  F0 F7       BEQ $E5CD      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302191\n.C:e5cd  A5 C6       LDA $C6        A:00 X:00 Y:0a SP:f3 ..-...Z.     11302194\n.C:e5cf  85 CC       STA $CC        A:00 X:00 Y:0a SP:f3 ..-...Z.     11302197\n(C:$e5d1) "
CAPTURE_STOCK_backtrace: command="bt" bytes=335 sha256=fe6da9cc26206a046d44de52fcd1900ee5a441158678645dd5096ca893264f90 matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_backtrace_TEXT: "             PC        .C:e5d1   8D 92 02    STA $0292\ne112 -> ffcf [SP +  3] .C:e112   20 CF FF    JSR $FFCF\na562 -> e112 [SP +  5] .C:a562   20 12 E1    JSR $E112\na483 -> a560 [SP +  7] .C:a483   20 60 A5    JSR $A560\ne39a -> e422 [SP + 11] .C:e39a   20 22 E4    JSR $E422\nRST  -> fce2 [SP +-241] .C:3139   00          BRK\n(C:$e5d1) "
CAPTURE_STOCK_register-decode: command="io $d020" bytes=1001 sha256=3140f166ece4b5a0f9fe381e3f31c0e49bb1ac6b97d57f6b60d307b66297c1dd matchedPromptRe=true refusalCandidate=false
CAPTURE_STOCK_register-decode_TEXT: "VIC-II:\n>C:d000  00 00 00 00  00 00 00 00  00 00 00 00  00 00 00 00   @@@@@@@@@@@@@@@@\n>C:d010  00 9b 37 00  00 00 c8 00  15 71 f0 00  00 00 00 00   @.7@@@H@uQ.@@@@@\n>C:d020  fe f6 f1 f2  f3 f4 f0 f1  f2 f3 f4 f5  f6 f7 fc ff   ................\n>C:d030  ff ff ff ff  ff ff ff ff  ff ff ff ff  ff ff f...[elided 401 chars]...00\nMC:      $00 $00 $00 $00 $00 $00 $00 $00\nMCBASE:  $00 $00 $00 $00 $00 $00 $00 $00\nX-Pos:  $000$000$000$000$000$000$000$000\nY-Pos:     0   0   0   0   0   0   0   0\nX/Y-Exp:  /   /   /   /   /   /   /   / \nPri./MC: s/  s/  s/  s/  s/  s/  s/  s/ \nColor:     1   2   3   4   5   6   7   c\n(C:$d040) "
VICE_BINARY: fork:/usr/local/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.10)
$ /usr/local/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:44209 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:40805
TEXT_BIND_MS_FORK: 152
CONNECT_BANNER_FORK: bytes=0 matchedPromptRe=false hex=
SETUP_PROF_ON_FORK: matchedPromptRe=true text="(C:$e5d4) Profiling restarted.\n(C:$e5d4) "
SETUP_RESUME_FORK: sent x (EXIT), no reply awaited -- free-running window follows
CAPTURE_FORK_access-map: command="memmapshow" bytes=1624557 sha256=cc05bbe02268a5a8e5cad2a4939edaddaec7f53fb48cbd0ce85cc1ebe4810a06 matchedPromptRe=true refusalCandidate=false
CAPTURE_FORK_access-map_TEXT: "(C:$e5d4) addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n0001: --- --- rw-\n...[elided 1623957 chars]...ffea: --- --x ---\nfffc: --- r-- ---\nfffd: --- r-- ---\nfffe: --- r-- ---\nffff: --- r-- ---\n(C:$e5d4) "
CAPTURE_FORK_flat-profile: command="prof flat 5" bytes=509 sha256=d4589e9123c6d121035fef45d8b3b64192e6f0c839ee8ad128582bddf1c125de matchedPromptRe=true refusalCandidate=false
CAPTURE_FORK_flat-profile_TEXT: "        Total      %          Self      %\n------------- ------ ------------- ------\n2 326 051  98,5% 2 326 051  98,5% ffcf                                    \n     35 003   1,5%      17 092   0,7% ff48                                    \n      8 968   0,4%       8 968   0,4% ea87                                    \n      8 671   0,4%       8 671   0,4% ffea                                    \n          184   0,0%           184   0,0% ea1c                                    \n(C:$e5d4) "
CAPTURE_FORK_cpu-history: command="chis 4" bytes=326 sha256=7d676892ae5de1229efcbcab4d809069e518f5ac9ed3b29148ed34a90978072c matchedPromptRe=true refusalCandidate=false
CAPTURE_FORK_cpu-history_TEXT: ".C:e5d4  F0 F7       BEQ $E5CD      A:00 X:00 Y:0a SP:f3 ..-...Z.     12186708\n.C:e5cd  A5 C6       LDA $C6        A:00 X:00 Y:0a SP:f3 ..-...Z.     12186711\n.C:e5cf  85 CC       STA $CC        A:00 X:00 Y:0a SP:f3 ..-...Z.     12186714\n.C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     12186717\n(C:$e5d4) "
CAPTURE_FORK_backtrace: command="bt" bytes=335 sha256=ddd8d2ca527b16e65e2df001886845f0a963cd7bb737a75b3d40b895e7c0a29a matchedPromptRe=true refusalCandidate=false
CAPTURE_FORK_backtrace_TEXT: "             PC        .C:e5d4   F0 F7       BEQ $E5CD\ne112 -> ffcf [SP +  3] .C:e112   20 CF FF    JSR $FFCF\na562 -> e112 [SP +  5] .C:a562   20 12 E1    JSR $E112\na483 -> a560 [SP +  7] .C:a483   20 60 A5    JSR $A560\ne39a -> e422 [SP + 11] .C:e39a   20 22 E4    JSR $E422\nRST  -> fce2 [SP +-241] .C:3139   00          BRK\n(C:$e5d4) "
CAPTURE_FORK_register-decode: command="io $d020" bytes=999 sha256=e31c196d496b11ad096bddf79ff67f5043d43a9649f1d200e9d2653d8a43a988 matchedPromptRe=true refusalCandidate=false
CAPTURE_FORK_register-decode_TEXT: "VIC-II:\n>C:d000  00 00 00 00  00 00 00 00  00 00 00 00  00 00 00 00   @@@@@@@@@@@@@@@@\n>C:d010  00 1b 00 00  00 00 c8 00  15 71 f0 00  00 00 00 00   @[@@@@H@uQ.@@@@@\n>C:d020  fe f6 f1 f2  f3 f4 f0 f1  f2 f3 f4 f5  f6 f7 fc ff   ................\n>C:d030  ff ff ff ff  ff ff ff ff  ff ff ff ff  ff ff f...[elided 399 chars]...00\nMC:      $00 $00 $00 $00 $00 $00 $00 $00\nMCBASE:  $00 $00 $00 $00 $00 $00 $00 $00\nX-Pos:  $000$000$000$000$000$000$000$000\nY-Pos:     0   0   0   0   0   0   0   0\nX/Y-Exp:  /   /   /   /   /   /   /   / \nPri./MC: s/  s/  s/  s/  s/  s/  s/  s/ \nColor:     1   2   3   4   5   6   7   c\n(C:$d040) "
FIXTURE_WRITTEN: case=access-map-stock bytes=1624557 sha256=c53c36d74dd261f82e6655aa36d4bf6c4346fe244a491a11b5f7475ef471c828 payload=src/mcp/vice/fixtures/textmon/access-map-stock.txt sidecar=src/mcp/vice/fixtures/textmon/access-map-stock.json
FIXTURE_WRITTEN: case=access-map-fork bytes=1624557 sha256=cc05bbe02268a5a8e5cad2a4939edaddaec7f53fb48cbd0ce85cc1ebe4810a06 payload=src/mcp/vice/fixtures/textmon/access-map-fork.txt sidecar=src/mcp/vice/fixtures/textmon/access-map-fork.json
FIXTURE_WRITTEN: case=flat-profile-stock bytes=509 sha256=8f57d2ad8be7fafae870b02a1a8732d7df397f985f0303ac37b2000b4dc10cf6 payload=src/mcp/vice/fixtures/textmon/flat-profile-stock.txt sidecar=src/mcp/vice/fixtures/textmon/flat-profile-stock.json
FIXTURE_WRITTEN: case=flat-profile-fork bytes=509 sha256=d4589e9123c6d121035fef45d8b3b64192e6f0c839ee8ad128582bddf1c125de payload=src/mcp/vice/fixtures/textmon/flat-profile-fork.txt sidecar=src/mcp/vice/fixtures/textmon/flat-profile-fork.json
FIXTURE_WRITTEN: case=cpu-history-stock bytes=326 sha256=8c80b0dd769bb6d83648ecdd56d1ea6e6870cdf9708ac0eb98d2eb872c01caa3 payload=src/mcp/vice/fixtures/textmon/cpu-history-stock.txt sidecar=src/mcp/vice/fixtures/textmon/cpu-history-stock.json
FIXTURE_WRITTEN: case=cpu-history-fork bytes=326 sha256=7d676892ae5de1229efcbcab4d809069e518f5ac9ed3b29148ed34a90978072c payload=src/mcp/vice/fixtures/textmon/cpu-history-fork.txt sidecar=src/mcp/vice/fixtures/textmon/cpu-history-fork.json
FIXTURE_WRITTEN: case=backtrace-stock bytes=335 sha256=fe6da9cc26206a046d44de52fcd1900ee5a441158678645dd5096ca893264f90 payload=src/mcp/vice/fixtures/textmon/backtrace-stock.txt sidecar=src/mcp/vice/fixtures/textmon/backtrace-stock.json
FIXTURE_WRITTEN: case=backtrace-fork bytes=335 sha256=ddd8d2ca527b16e65e2df001886845f0a963cd7bb737a75b3d40b895e7c0a29a payload=src/mcp/vice/fixtures/textmon/backtrace-fork.txt sidecar=src/mcp/vice/fixtures/textmon/backtrace-fork.json
FIXTURE_WRITTEN: case=register-decode-stock bytes=1001 sha256=3140f166ece4b5a0f9fe381e3f31c0e49bb1ac6b97d57f6b60d307b66297c1dd payload=src/mcp/vice/fixtures/textmon/register-decode-stock.txt sidecar=src/mcp/vice/fixtures/textmon/register-decode-stock.json
FIXTURE_WRITTEN: case=register-decode-fork bytes=999 sha256=e31c196d496b11ad096bddf79ff67f5043d43a9649f1d200e9d2653d8a43a988 payload=src/mcp/vice/fixtures/textmon/register-decode-fork.txt sidecar=src/mcp/vice/fixtures/textmon/register-decode-fork.json
FIXTURE_WRITTEN: case=connect-banner-stock bytes=0 sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 payload=src/mcp/vice/fixtures/textmon/connect-banner-stock.txt sidecar=src/mcp/vice/fixtures/textmon/connect-banner-stock.json
FIXTURE_WRITTEN: case=connect-banner-fork bytes=0 sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 payload=src/mcp/vice/fixtures/textmon/connect-banner-fork.txt sidecar=src/mcp/vice/fixtures/textmon/connect-banner-fork.json
DIVERGENCE_access-map: stock refusal=false bytes=1624557; fork refusal=false bytes=1624557
DIVERGENCE_flat-profile: stock refusal=false bytes=509; fork refusal=false bytes=509
DIVERGENCE_cpu-history: stock refusal=false bytes=326; fork refusal=false bytes=326
DIVERGENCE_backtrace: stock refusal=false bytes=335; fork refusal=false bytes=335
DIVERGENCE_register-decode: stock refusal=false bytes=1001; fork refusal=false bytes=999
FIXTURE_COUNT: 12
FIXTURE_BINARIES: 2
FIXTURE_ENCODING: has-high-bytes
FIXTURE_DIVERGENCE: access-map, flat-profile, cpu-history, backtrace, register-decode
FIXTURE_UNSUPPORTED: none
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/fixture-capture-run.json

$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

---

## Divergence, described per command (not averaged, not dropped)

All five non-banner commands show byte differences between stock and fork on
this host; `connect-banner` is 0 bytes identically on both. Full byte diffs:

**`access-map` / `backtrace`:** only the entry-echo/exit-prompt PC value
differs (`e5d1` on stock, `e5d4` on fork) — both addresses are inside the
SAME five-address idle loop `bt`'s own reconstructed call chain shows
(`.C:e5d1 STA $0292` / `.C:e5d4 BEQ $E5CD` / `.C:e5cd LDA $C6` / `.C:e5cf STA
$CC`, looping). This is which instruction of that idle loop the CPU happened
to be paused at when the monitor re-entered, not a different program
location — the rest of `access-map`'s 1,624,557-byte body (every address's
IO/ROM/RAM flags) is otherwise identical between the two captures.

**`flat-profile` / `cpu-history`:** only the accumulated cycle counts (stock
`2 326 151` self-cycles at `ffcf`; fork `2 326 051`) and cycle timestamps
(stock `11302187`..`11302197`; fork `12186708`..`12186717`) differ — two
independently-launched processes reaching the same idle steady-state after a
slightly different number of real-time-driven wall-clock cycles, even with
the shared `STOCK_DETERMINISM_FLAGS` fixing the RNG seed. Command syntax and
output shape are identical.

**`register-decode`:** the byte-level diff is confined to the raster/beam
state — `Raster cycle/line: 0/311` (stock) vs `1/0` (fork), `VC $3e8` (stock)
vs `VC $000` (fork), `Phi1 $ff` (stock) vs `$00` (fork), and one byte in the
`$D010`-$D01F sprite-position row that reflects the same live raster state.
`io $d020` samples LIVE, continuously-advancing VIC-II hardware state, so
reading it at two different real-time instants necessarily reads two
different raster positions — this is not a stock/fork semantic difference.
`$D020`'s own value (the actual border-colour register this command's case
name names) is IDENTICAL on both binaries (`fe`).

None of the above is a command-syntax, output-shape, or stock/fork behavioural
difference — every one is explained by real-time nondeterminism inherent to
sampling a running (or just-resumed) machine at two independent moments. Both
captures stay committed; per this phase's own rule, neither is treated as
canonical or corrected toward the other.

---

## Unsupported commands (D-20)

`FIXTURE_UNSUPPORTED: none`. Every one of the six commands in the set answered
successfully on BOTH binaries — no refusal fired anywhere in this batch. This
is a real, measured finding, not an assumption: in particular, `chis 4` (the
CPU-history listing) succeeded on genuine stock VICE 3.9, returning real
per-entry cycle counts, exactly as
`.planning/notes/text-monitor-channel-live-probe.md` already measured
independently. **The binary-monitor side's `CPUHISTORY_GET` (0x86) `>= 3.10`
version floor does NOT apply here** — that floor is about the wire opcode's
existence in the binary protocol, not about the CPU-history CAPABILITY, which
the text-monitor `chis` command reaches by a completely different code path.
No finding in this file treats the two as the same gate. Since no refusal
fired, there is no `<case>-unsupported-<kind>` pair to describe in this batch;
if a future re-capture against a different build ever produces one, it is
committed per `fixtures/binmon/cpuhistory-get-unsupported.json`'s own model
(a `note` naming both the missing capability and the binary).

## Encoding

`FIXTURE_ENCODING: has-high-bytes` — measured across every byte actually
captured in this batch, not assumed. The high bytes are confined to
`flat-profile-{stock,fork}.txt`: VICE's flat-profiler report uses the UTF-8
encoding of U+202F (NARROW NO-BREAK SPACE, the three bytes `e2 80 af`) as its
thousands-group separator in the cycle-count columns — e.g. the digits in
`2 326 151` are separated by this three-byte sequence, not an ASCII space.
Every other captured command's bytes are pure 7-bit ASCII. This is exactly why
the payload buffer, not a lossily-decoded string, is this tree's authoritative
capture: a naive ASCII/Latin-1 decode of `flat-profile`'s bytes would silently
mangle these separators, and a UTF-8 decode-then-recode round-trip would
"fix" what is actually the real captured byte stream — the fixture's on-disk
byte length and the loader's returned buffer length must agree, which is
exactly what Task 2's behaviour block asserts.

---

## Post-run discipline check

```
$ git status --porcelain | grep -cE '\.(prg|d64|t64|crt|vsf|bin|rep|gpr)$'
0

$ git status --porcelain src/mcp/vice/fixtures/binmon | wc -l
0
```

No snapshot, disk-image or program-image path entered the working tree; the
existing binary fixture tree under `fixtures/binmon/` is untouched by this
plan, confirmed mechanically rather than by inspection alone.

## Self-check: the plan's own automated `<verify>` blocks, re-run against the final committed tree

```
$ D=src/mcp/vice/fixtures/textmon && N=$(ls "$D"/*.json | wc -l) && test "$N" -ge 8 && for j in "$D"/*.json; do node -e "..." "$j" || exit 1; done && K=$(node -e "...") && test "$K" -ge 2 && echo "FIXTURE_PROVENANCE_OK pairs=$N binaries=$K"
FIXTURE_PROVENANCE_OK pairs=12 binaries=2

$ test "$(git status --porcelain | grep -cE '\.(prg|d64|t64|crt|vsf|bin|rep|gpr)$' || true)" -eq 0 && test "$(git status --porcelain src/mcp/vice/fixtures/binmon | wc -l)" -eq 0 && echo NO_BINARY_LEAK_OK
NO_BINARY_LEAK_OK
```

---

## Host left clean

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc
(no output, exit 1)
```

## Outcome lines

```
BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
VICE_BINARY: fork:/usr/local/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.10)
FIXTURE_COUNT: 12
FIXTURE_BINARIES: 2
FIXTURE_ENCODING: has-high-bytes
FIXTURE_DIVERGENCE: access-map, flat-profile, cpu-history, backtrace, register-decode
FIXTURE_UNSUPPORTED: none
```
